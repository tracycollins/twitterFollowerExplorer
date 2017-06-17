var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var PlaceSchema = new Schema({
	placeId: {
		type: String,
		unique: true
	},
	nodeType: { 
		type: String,
		default: 'place'
	},
	nodeId: {  // for D3.js
		type: String
	},
	tags: { 
		type: Object,
		default: {}
	},
	isKeyword: {  // for D3.js
		type: Boolean,
		default: true
	},
	keywords: {  // for D3.js
		type: Object,
		default: { "neutral": 100}
	},
	geocodeNodeId: { 
		type: String
	},
	formattedAddress: { 
		type: String
	},
	boundingBox: { 
		type: Object
	},
	centroid: { 
		type: [Number],
		default: []
	},
	name: { 
		type: String
	},
	fullName: { 
		type: String
	},
	countryCode: { 
		type: String
	},
	country: { 
		type: String
	},
	placeType: { 
		type: String
	},
	url: {   
		type: String
	},
	sourceUrl: {   
		type: String
	},
	imageUrl: {   
		type: String
	},
	lastSeen: {   
		type: String
	},
	mentions: {
		type: Number,
		default: 0
	}
});


mongoose.model('Place', PlaceSchema);