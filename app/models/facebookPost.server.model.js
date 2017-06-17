var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var FacebookPostSchema = new Schema({
	nodeId: {   // facebookId
		type: String,
		unique: true
	},
	feedName: {   
		type: String
	},
	userId: {   
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

mongoose.model('FacebookPost', FacebookPostSchema);