var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var SessionSchema = new Schema({
	sessionId: {   // just use socket.id???
		type: String,
		trim: true,
		unique: true
	},
	userId: { 
		type: String
	},
	tags: { 
		type: Object,
		default: {}
	},
	createdAt: { 
		type: Date
	},
	wordChain: {
		type: Object
	}
});

mongoose.model('Session', SessionSchema);