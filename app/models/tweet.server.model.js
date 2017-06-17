var mongoose = require('mongoose'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var TweetSchema = new Schema({
	tweetId: { 
		type: String,
		trim: true,
		unique: true
	},
	nodeId: {  // for D3.js
		type: String
	},
	nodeType: { 
		type: String,
		default: 'tweet'
	},
	user: {
		type: Object
	},
	tags: { 
		type: Object,
		default: {}
	},
	userMentions: {
		type: [Schema.Types.Mixed],
		default: []
	},
	url: {
		type: String,
		trim: true
	},
	profileImageUrl: {
		type: String,
		trim: true
	},
	imageUrl: {
		type: String,
		trim: true
	},
	createdAt: { 
		type: Date
	},
	lastSeen: {   
		type: Date
	},
	mentions: {
		type: Number,
		default: 0
	},
	retweeted: {
		type: Boolean,
		default: false
	},
	isRetweet: {
		type: Boolean,
		default: false
	},
	retweetedId: {
		type: String,
		default: 0
	},
	retweetedStatus: {
		type: Object
	},
	retweets: {
		type: String,
		default: 0
	},
	favorites: {
		type: Number,
		default: 0
	},
	text: {
		type: String
	},
	extendedText: {
		type: String
	},
	lang: {
		type: String
	},
	translations: { // translation = { lang: 'en', text: 'What?'}
		type: Object
	},
	// addHashMap: { // KLUDGE!
	// 	type: Object,
	// 	default: {
	// 		translations: []
	// 	}
	// },
	hashtags: {
		type: [Schema.Types.Mixed],
		default: []
	},
	place: {
		type: Object,
		trim: true
	},
	media: {
		type: [Schema.Types.Mixed],
		default: []
	},
	urls: {
		type: [Schema.Types.Mixed],
		default: []
	},
	status: Object
});


mongoose.model('Tweet', TweetSchema);