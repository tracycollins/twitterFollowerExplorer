var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var UrlSchema = new Schema({
	urlId: { // 'cfc3oNLAok' of http(s)://t.co/cfc3oNLAok
		type: String,
		trim: true,
		unique: true
	},
	nodeType: { 
		type: String,
		default: 'url'
	},
	nodeId: {  // for D3.js
		type: String
	},
	url: { 
		type: String
	},
	displayUrl: { 
		type: String
	},
	expandedUrl: { 
		type: String
	},
	tags: { 
		type: Object,
		default: {}
	},
	lastSeen: {   
		type: String
	},
	mentions: {
		type: Number,
		default: 0
	}
});


mongoose.model('Url', UrlSchema);