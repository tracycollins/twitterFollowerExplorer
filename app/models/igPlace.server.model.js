var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var IgPlaceSchema = new Schema({
	placeId: {
		type: String,
		unique: true
	},
	nodeType: { 
		type: String,
		default: 'ig_place'
	},
	nodeId: { 
		type: String
	},
	geocodeNodeId: { 
		type: String
	},
	formattedAddress: { 
		type: String
	},
	name: { 
		type: String
	},
	latitude: { 
		type: String
	},
	longitude: { 
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


mongoose.model('IgPlace', IgPlaceSchema);