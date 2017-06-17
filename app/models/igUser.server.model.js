var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var IgUserSchema = new Schema({
	userId: { 
		type: String,
		unique: true
	},
	nodeId: {  
		type: String
	},
	nodeType: { 
		type: String,
		default: 'ig_user'
	},
	username: {
		type: String
	},
	fullname: {
		type: String,
		trim: true
	},
	website: { 
		type: String,
		trim: true
	},
	profileImageUrl: { // url
		type: String,
		trim: true
	},
	profileBio: { 
		type: String,
		trim: true
	},
	lastSeen: {   
		type: String
	},
	mediaCount: {
		type: Number,
		default: 0
	},
	followsCount: {
		type: Number,
		default: 0
	},
	followedByCount: {
		type: Number,
		default: 0
	},
	mentions: {
		type: Number,
		default: 0
	}
});


mongoose.model('IgUser', IgUserSchema);

