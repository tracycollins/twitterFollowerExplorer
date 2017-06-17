var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var YouTubePlaylistSchema = new Schema({
	nodeId: {   // youtube playlistId
		type: String,
		unique: true
	},
	name: {   
		type: String
	},
	channelTitle: {   
		type: String
	},
	name: {   
		type: String
	},
	tags: {  // most recent
		type: Object
	},
	latestVideoTitle: {  // most recent
		type: String,
		default: ""
	},
	latestVideoDate: {  // most recent
		type: Number,
		default: 0
	},
	nextPageToken: {
		type: String,
		default: ''
	},
	numberOfVideosServer: {  // number of videos
		type: Number,
		default: 0
	},
	numberOfVideosDb: {  // number of videos
		type: Number,
		default: 0
	},
	videosInDb: {  // number of videos
		type: Object,
		default: []
	}
});

mongoose.model('YouTubePlaylist', YouTubePlaylistSchema);