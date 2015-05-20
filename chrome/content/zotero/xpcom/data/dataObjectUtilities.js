/*
    ***** BEGIN LICENSE BLOCK *****
    
    Copyright © 2009 Center for History and New Media
                     George Mason University, Fairfax, Virginia, USA
                     http://zotero.org
    
    This file is part of Zotero.
    
    Zotero is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.
    
    Zotero is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.
    
    You should have received a copy of the GNU Affero General Public License
    along with Zotero.  If not, see <http://www.gnu.org/licenses/>.
    
    ***** END LICENSE BLOCK *****
*/


Zotero.DataObjectUtilities = {
	"checkLibraryID": function (libraryID) {
		if (!libraryID) {
			throw new Error("libraryID not provided");
		}
		var intValue = parseInt(libraryID);
		if (libraryID != intValue || intValue <= 0) {
			throw new Error("libraryID must be a positive integer");
		}
		return intValue;
	},
	
	"checkDataID": function(dataID) {
		var intValue = parseInt(dataID);
		if (dataID != intValue || dataID <= 0)
			throw new Error("id must be a positive integer");
		return intValue;
	},
	
	"checkKey": function(key) {
		if (!key) return null;
		if (!Zotero.Utilities.isValidObjectKey(key)) {
			throw new Error("key is not valid");
		}
		return key;
	},
	
	
	getObjectTypeSingular: function (objectTypePlural) {
		return objectTypePlural.replace(/(s|es)$/, '');
	},
	
	
	"getObjectTypePlural": function(objectType) {
		return objectType == 'search' ? 'searches' : objectType + 's';
	},
	
	
	"getObjectsClassForObjectType": function(objectType) {
		var objectTypePlural = this.getObjectTypePlural(objectType);
		var className = objectTypePlural[0].toUpperCase() + objectTypePlural.substr(1);
		return Zotero[className]
	},
	
	/**
	 * Determine whether two API JSON objects are equivalent
	 *
	 * @param {Object} data1 - API JSON of first object
	 * @param {Object} data2 - API JSON of second object
	 * @param {Array} [ignoreFields] - Fields to ignore
	 * @param {Boolean} - True if objects are the same, false if not
	 */
	equals: function (data1, data2, ignoreFields) {
		var skipFields = {};
		for (let field of ['key', 'version'].concat(ignoreFields || [])) {
			skipFields[field] = true;
		}
		
		for (let field in data1) {
			if (skipFields[field]) {
				continue;
			}
			
			let val1 = data1[field];
			let val2 = data2[field];
			let val1HasValue = val1 || val1 === 0;
			let val2HasValue = val2 || val2 === 0;
			
			if (!val1HasValue && !val2HasValue) {
				continue;
			}
			
			let changed;
			
			switch (field) {
			case 'creators':
			case 'collections':
			case 'tags':
			case 'relations':
				changed = this["_" + field + "Equals"](val1, val2);
				if (changed) {
					return true;
				}
				break;
			
			default:
				changed = val1 !== val2;
				if (changed) {
					return true;
				}
			}
			
			skipFields[field] = true;
		}
		
		for (let field in data2) {
			// Skip ignored fields and fields we've already compared
			if (skipFields[field]) {
				continue;
			}
			
			// All remaining fields don't exist in data1
			
			if (data2[field] === false) {
				continue;
			}
			
			return true;
		}
		
		return false;
	},
	
	_creatorsEquals: function (data1, data2) {
		if (!data2 || data1.length != data2.length) return true;
		for (let i = 0; i < data1.length; i++) {
			if (!Zotero.Creators.equals(data1[i], data2[i])) {
				return false;
			}
		}
		return true;
	},
	
	_collectionsEquals: function (data1, data2) {
		if (!data2 || data1.length != data2.length) return true;
		let c1 = data1.concat();
		let c2 = data2.concat();
		c1.sort();
		c2.sort();
		return Zotero.Utilities.arrayEquals(c1, c2);
	},
	
	_tagsEquals: function (data1, data2) {
		if (!data2 || data1.length != data2.length) return true;
		for (let i = 0; i < data1.length; i++) {
			if (!Zotero.Tags.equals(data1[i], data2[i])) {
				return false;
			}
		}
		return true;
	},
	
	_relationsEquals: function (data1, data2) {
		if (!data2) return true;
		var pred1 = Object.keys(data1);
		pred1.sort();
		var pred2 = Object.keys(data2);
		pred2.sort();
		if (!Zotero.Utilities.arrayEquals(pred1, pred2)) return false;
		for (let i in pred1) {
			if (!Zotero.Utilities.arrayEquals(pred1[i], pred2[i])) {
				return false;
			}
		}
		return true;
	},
	
	
	/**
	 * Compare two API JSON objects and generate a changeset
	 *
	 * @param {Object} data1
	 * @param {Object} data2
	 * @param {String[]} [ignoreFields] - Fields to ignore
	 */
	diff: function (data1, data2, ignoreFields) {
		var changeset = [];
		
		var skipFields = {};
		for (let field of ['key', 'version'].concat(ignoreFields || [])) {
			skipFields[field] = true;
		}
		
		for (let field in data1) {
			if (skipFields[field]) {
				continue;
			}
			
			let val1 = data1[field];
			let val2 = data2[field];
			let val1HasValue = (val1 && val1 !== "") || val1 === 0;
			let val2HasValue = (val2 && val2 !== "") || val2 === 0;
			
			if (!val1HasValue && !val2HasValue) {
				continue;
			}
			
			switch (field) {
			case 'creators':
			case 'collections':
			case 'relations':
			case 'tags':
				let changes = this["_" + field + "Diff"](val1, val2);
				if (changes.length) {
					changeset = changeset.concat(changes);
				}
				break;
			
			default:
				var changed = val1 !== val2;
				if (changed) {
					if (val1HasValue && !val2HasValue) {
						changeset.push({
							field: field,
							op: 'delete'
						});
					}
					else if (!val1HasValue && val2HasValue) {
						changeset.push({
							field: field,
							op: 'add',
							value: val2
						});
					}
					else {
						changeset.push({
							field: field,
							op: 'modify',
							value: val2
						});
					}
				}
			}
			
			skipFields[field] = true;
		}
		
		for (let field in data2) {
			// Skip ignored fields and fields we've already compared
			if (skipFields[field]) {
				continue;
			}
			
			// All remaining fields don't exist in data1
			
			if (data2[field] === false || data2[field] === "") {
				continue;
			}
			
			changeset.push({
				field: field,
				op: "add",
				value: data2[field]
			});
		}
		
		return changeset;
	},
	
	/**
	 * For creators, just determine if changed, since ordering makes a full diff too complicated
	 */
	_creatorsDiff: function (data1, data2) {
		if (!data2 || !data2.length) {
			if (!data1.length) {
				return [];
			}
			return [{
				field: "creators",
				op: "delete"
			}];
		}
		if (!this._creatorsEquals(data1, data2)) {
			return [{
				field: "creators",
				op: "modify",
				value: data2
			}];
		}
		return [];
	},
	
	_collectionsDiff: function (data1, data2) {
		data2 = data2 || [];
		var changeset = [];
		var removed = Zotero.Utilities.arrayDiff(data1, data2);
		for (let i = 0; i < removed.length; i++) {
			changeset.push({
				field: "collections",
				op: "member-remove",
				value: removed[i]
			});
		}
		let added = Zotero.Utilities.arrayDiff(data2, data1);
		for (let i = 0; i < added.length; i++) {
			changeset.push({
				field: "collections",
				op: "member-add",
				value: added[i]
			});
		}
		return changeset;
	},
	
	_tagsDiff: function (data1, data2) {
		data2 = data2 || [];
		var changeset = [];
		outer:
		for (let i = 0; i < data1.length; i++) {
			for (let j = 0; j < data2.length; j++) {
				if (Zotero.Tags.equals(data1[i], data2[j])) {
					continue outer;
				}
			}
			changeset.push({
				field: "tags",
				op: "member-remove",
				value: data1[i]
			});
		}
		outer:
		for (let i = 0; i < data2.length; i++) {
			for (let j = 0; j < data1.length; j++) {
				if (Zotero.Tags.equals(data2[i], data1[j])) {
					continue outer;
				}
			}
			changeset.push({
				field: "tags",
				op: "member-add",
				value: data2[i]
			});
		}
		return changeset;
	},
	
	_relationsDiff: function (data1, data2) {
		if (!data1.length && !data2.length) {
			return [];
		}
		throw new Error("Unimplemented");
	},
	
	
	/**
	 * Apply a set of changes generated by Zotero.DataObjectUtilities.diff() to an API JSON object
	 *
	 * @param {Object} json - API JSON object to modify
	 * @param {Object[]} changeset - Change instructions, as generated by .diff()
	 */
	applyChanges: function (json, changeset) {
		for (let i = 0; i < changeset.length; i++) {
			let c = changeset[i];
			if (c.op == 'delete') {
				delete json[c.field];
			}
			else if (c.op == 'add' || c.op == 'modify') {
				json[c.field] = c.value;
			}
			else if (c.op == 'member-add') {
				switch (c.field) {
				case 'collections':
					if (json[c.field].indexOf(c.value) == -1) {
						json[c.field].push(c.value);
					}
					break;
				
				case 'creators':
					throw new Error("Unimplemented");
					break;
				
				case 'relations':
					throw new Error("Unimplemented");
					break;
				
				case 'tags':
					let found = false;
					for (let i = 0; i < json[c.field].length; i++) {
						if (Zotero.Tags.equals(json[c.field][i], c.value)) {
							found = true;
							break;
						}
					}
					if (!found) {
						json[c.field].push(c.value);
					}
					break;
					
				default:
					throw new Error("Unexpected field");
				}
			}
			else if (c.op == 'member-remove') {
				switch (c.field) {
				case 'collections':
					let pos = json[c.field].indexOf(c.value);
					if (pos == -1) {
						continue;
					}
					json[c.field].splice(pos, 1);
					break;
				
				case 'creators':
					throw new Error("Unimplemented");
					break;
				
				case 'tags':
					for (let i = 0; i < json[c.field].length; i++) {
						if (Zotero.Tags.equals(json[c.field][i], c.value)) {
							json[c.field].splice(i, 1);
							break;
						}
					}
					break;
					
				default:
					throw new Error("Unexpected field");
				}
			}
			// TODO: properties
			else {
				throw new Error("Unimplemented");
			}
		}
	}
};