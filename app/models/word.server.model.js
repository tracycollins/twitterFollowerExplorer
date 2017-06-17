var mongoose = require('mongoose'),
	crypto = require('crypto'),
	moment = require('moment'),
	Schema = mongoose.Schema;

var WordSchema = new Schema({
	nodeId: { 
		type: String,
		unique: true
	},
	raw: { 
		type: String
	},
	url: { 
		type: String
	},
	createdAt: { 
		type: Number,
		default: moment().valueOf()
	},
	lastSeen: {   
		type: Number,
		default: moment().valueOf()
	},
	sessionId: {   
		type: String
	},
	wordChainIndex: {   
		type: Number,
		default: 0
	},
	links: {   
		type: Object
	},
	mentions: {
		type: Number,
		default: 0
	},
	rate: {
		type: Number,
		default: 0
	},
	isTwitterUser: {
		type: Boolean,
		default: false
	},
	isTopTerm: {
		type: Boolean,
		default: false
	},
	isTrendingTopic: {
		type: Boolean,
		default: false
	},
	isKeyword: {
		type: Boolean,
		default: false
	},
	keywords: {
		type: Object,
		default: {}
	},
	isIgnored: {
		type: Boolean,
		default: false
	},
	tags: {
		type: Object,
		default: {}
	},
	noun: {
		type: Object
	},
	verb: {
		type: Object
	},
	adjective: {
		type: Object
	},
	adverb: {
		type: Object
	},
	wapiSearched: {
		type: Boolean,
		default: false
	},
	wapiFound: {
		type: Boolean,
		default: false
	},
	wapiResults: {
		type: Object
	},
	bhtSearched: {
		type: Boolean,
		default: false
	},
	bhtFound: {
		type: Boolean,
		default: false
	},
	bhtAlt: {  // 303 Redirected
		type: String
	},
	mwDictSearched: {
		type: Boolean,
		default: false
	},
	mwDictFound: {
		type: Boolean,
		default: false
	},
	mwThesSearched: {
		type: Boolean,
		default: false
	},
	mwThesFound: {
		type: Boolean,
		default: false
	},
	mwEntry: {  // mw thesaurus
		type: Object
	},
	mwSuggestion: { // mw dictionary
		type: Object
	}
});

mongoose.model('Word', WordSchema);