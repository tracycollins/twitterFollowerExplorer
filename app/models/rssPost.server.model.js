var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var RssPostSchema = new Schema({
	nodeId: {   // guid
		type: String,
		unique: true
	},
	feedName: {   
		type: String
	},
	link: {   // entity main site
		type: String
	},
	url: {   // post url
		type: String
	},
	title: { 
		type: String
	},
	author: {   
		type: String
	},
	tags: {   
		type: Object
	},
	meta: {   
		type: Object
	},
	description: { 
		type: String
	},
	summary: {   
		type: String
	},
	createdAt: {   
		type: Number
	},
	lastSeen: {   
		type: Number
	},
	mentions: {
		type: Number,
		default: 0
	},
	post: {
		type: Object
	}
});

mongoose.model('RssPost', RssPostSchema);