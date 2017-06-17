var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;
var moment = require('moment');

var PhraseSchema = new Schema({
	phraseId: { 
		type: String,
		unique: true
	},
	nodeId: { 
		type: String
	},
	text: { 
		type: String
	},
	length: { 
		type: Number
	},
	userId: { 
		type: String
	},
	sessionId: { 
		type: String
	},
	tags: { 
		type: Object,
		default: {}
	},
	links: {   
		type: Object
	},
	createdAt: { 
		type: Number,
		default: moment().valueOf()
	},
	lastSeen: { 
		type: Number,
		default: moment().valueOf()
	},
	mentions: {
		type: Number,
		default: 0
	}
});

mongoose.model('Phrase', PhraseSchema);