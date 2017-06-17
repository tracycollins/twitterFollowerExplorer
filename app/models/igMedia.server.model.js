var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var IgMediaSchema = new Schema({

	mediaId: { 
		type: String,
		unique: true
	},

	nodeId: { // for D3.js
		type: String
	},

	nodeType: { 
		type: String,
		default: 'ig_media'
	},

	mediaType: { 
		type: String
	},

	user: { // 
		type: Object
	},

	usersInPhoto: {
		type: [Schema.Types.Mixed],
		default: []
	},

	url: {
		type: String
	},

	tags: {
		type: [Schema.Types.Mixed],
		default: []
	},

	createdAt: {   // in ms
		type: String
	},

	lastSeen: {   // in ms
		type: String
	},

	likes: {
		type: Number,
		default: 0
	},

	mentions: {
		type: Number,
		default: 0
	},

	imageUrl: {
		type: String
	},

	width: {
		type: Number,
		default: 1
	},

	height: {
		type: Number,
		default: 1
	},
	
	location: {
		type: Object
	}
	
});

mongoose.model('IgMedia', IgMediaSchema);