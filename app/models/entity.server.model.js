var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema,
	moment = require('moment');

var EntitySchema = new Schema({
	entityId: {   // 
		type: String,
		unique: true
	},
	groups: {
		type: Object,
		default: []
	},
	screenName: {
		type: String
	},
	name: {
		type: String
	},
	description: {
		type: String
	},
	sessions: {  // number of sessions transmitted
		type: Number,
		default: 0
	},
	words: {  // number of words transmitted
		type: Number,
		default: 0
	},
	mentions: { // number of times mentioned, by self or others
		type: Number,
		default: 0
	},
	tags: {  // i.e., channel
		type: Object,
		default: {}
	},
	createdAt: { 
		type: Number,
		default: moment().valueOf()
	},
	lastSeen: { 
		type: Number,
		default: moment().valueOf()
	}
});

mongoose.model('Entity', EntitySchema);