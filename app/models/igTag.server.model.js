var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var IgTagSchema = new Schema({
	igTagId: { 
		type: String,
		trim: true,
		unique: true
	},
	nodeType: { 
		type: String,
		default: 'ig_tag'
	},
	nodeId: { 
		type: String
	},
	text: { 
		type: String
	},
	mediaCount: {
		type: Number,
		default: 0
	},
	lastSeen: {   // in ms
		type: String
	},
	minTagId: {   // in ms
		type: String,
		default: '0'
	},
	mentions: {
		type: Number,
		default: 0
	}
});

mongoose.model('IgTag', IgTagSchema);