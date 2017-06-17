var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var HashtagSchema = new Schema({
	hashtagId: { 
		type: String
	},
	nodeType: { 
		type: String,
		default: 'hashtag'
	},
	nodeId: { // for D3.js
		type: String
	},
	text: { 
		type: String,
		unique: true
	},
	lastSeen: {   // in ms
		type: String
	},
	mentions: {
		type: Number,
		default: 0
	}
});


mongoose.model('Hashtag', HashtagSchema);