var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var YouTubeVideoSchema = new Schema({
	nodeId: {   // guid
		type: String,
		unique: true
	},
	url: {   
		type: String
	},
	channelId: {   
		type: String
	},
	channelTitle: {   
		type: String
	},
	playlistId: {   
		type: String
	},
	title: {   
		type: String
	},
	creator: {   
		type: String
	},
	description: {   
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
	// contentDetails: {  // youtube video info
	// 	type: Object
	// },
	// info: {  // youtube video info
	// 	type: Object
	// },
	caption: {  // youtube caption exists
		type: Boolean
	},
	captions: {  // youtube video info
		type: Object
	}
});

mongoose.model('YouTubeVideo', YouTubeVideoSchema);