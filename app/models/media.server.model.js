var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var MediaSchema = new Schema({

	mediaId: { 
		type: String,
		trim: true,
		unique: true
	},

	nodeId: { // for D3.js
		type: String
	},

	nodeType: { 
		type: String,
		default: 'media'
	},

	sourceUrl: {
		type: String
	},

	url: {
		type: String,
		trim: true
	},

	lastSeen: {   // in ms
		type: String
	},

	mentions: {
		type: Number,
		default: 0
	},

	width: {
		type: Number,
		default: 1
	},

	height: {
		type: Number,
		default: 1
	}
	
});


mongoose.model('Media', MediaSchema);