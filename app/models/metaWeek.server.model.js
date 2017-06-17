var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var MetaWeekSchema = new Schema({
	metaId: { 
		type: String,
		trim: true,
		unique: true
	},
	nodeId: {  // for D3.js
		type: String
	},
	nodeType: { 
		type: String,
		default: 'meta_week'
	},
	metaSource: { 
		type: String,
		default: 'twitter'
	},
	metaType: { 
		type: String,
		default: 'rate'
	},
	metaSpan: { 
		type: String,
		default: 'week'
	},
	metaTimestamp: { 
		type: Date
	},
	testMode: { 
		type: Boolean,
		default: false
	},
	addHashmap: { // KLUDGE!
		type: Object,
		default: {
			tweets: [],
			retweets: [],
			users: [],
			hashtags: [],
			places: [],
			media: [],
			urls: []
		}
	},
	tweetsPerMetaSpan: {
		type: Number,
		default: 0
	},
	tweets: {
		type: Object,
		default: []
	},
	retweets: {
		type: Object,
		default: []
	},
	users: {
		type: Object,
		default: []
	},
	hashtags: {
		type: Object,
		default: []
	},
	places: {
		type: Object,
		default: []
	},
	media: {
		type: Object,
		default: []
	},
	urls: {
		type: Object,
		default: []
	}
});


mongoose.model('MetaWeek', MetaWeekSchema);