var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var YouTubeCaptionSchema = new Schema({
	nodeId: {   // guid
		type: String,
		unique: true
	},
	channelId: {   
		type: String
	},
	channelTitle: {   
		type: String
	},
	title: {   
		type: String
	},
	videoId: {   
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
	tags: {
		type: Object
	},
	data: {
		type: Object
	}
});

mongoose.model('YouTubeCaption', YouTubeCaptionSchema);