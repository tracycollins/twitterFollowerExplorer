var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var MetaMaxSchema = new Schema({
	metaMaxId: { 
		type: String,
		trim: true,
		unique: true
	},
	nodeId: {  // for D3.js
		type: String
	},
	nodeType: { 
		type: String,
		default: 'metaMax'
	},
	metaSource: { 
		type: String,
		default: 'twitter'
	},
	metaType: { 
		type: String,
		default: 'rateMax'
	},
	maxSecond: {
		metaId: String 
	},
	maxMinute: {
		metaId: String
	},
	maxHour: {
		metaId: String
	},
	maxDay: {
		metaId: String
	},
	maxWeek: {
		metaId: String
	},
	maxMonth: {
		metaId: String
	},
	maxYear: {
		metaId: String
	}
});


mongoose.model('MetaMax', MetaMaxSchema);