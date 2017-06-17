var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema,
	moment = require('moment');

var GroupSchema = new Schema({
	groupId: {   // 
		type: String,
		unique: true
	},
	entities: {
		type: Object,
		default: []
	},
	name: {
		type: String
	},
	mentions: { // number of times mentioned, by self or others
		type: Number,
		default: 0
	},
	tags: {  // i.e., channel
		type: Object,
		default: []
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

mongoose.model('Group', GroupSchema);