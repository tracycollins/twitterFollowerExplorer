var mongoose = require('mongoose'),
	moment = require('moment'),
	crypto = require('crypto'),
	Schema = mongoose.Schema;

var UserSchema = new Schema({
	userId: { type: String,	unique: true },
	nodeId: { type: String	},
	nodeType: { type: String, default: "user"},
	name: { type: String },
	isTwitterUser: { type: Boolean },
	screenName: { type: String },
	url: { type: String	},
	profileUrl: { type: String },
	profileImageUrl: { type: String	},
	verified: { type: Boolean, default: false },
	description: { type: String },

	createdAt: { type: Number, default: moment().valueOf() },
	lastSeen: { type: Number, default: moment().valueOf() },

	ip: { type: String },
	domain: { type: String },
	namespace: { type: String },
	connected: { type: Boolean, default: false },
	connectTime: { type: Number, default: 0 },
	disconnectTime: { type: Number, default: 0 },
	sessionId: { type: String },
	sessions: { type: [ String ],	trim: true },
	lastSession: { type: String },

	entities: { type: Object, default: {} },
	tags: { type: Object, default: {} },

	mentions: { type: Number, default: 0 },

	status: { type: Object, default: {} },
	statusesCount: { type: Number },
	followersCount: { type: Number },
	friendsCount: { type: Number },
	following: { type: Boolean,	default: false },
	threeceeFollowing: { type: Object, trim: true },

	rate: { type: Number, default: 0 },
	isTopTerm: { type: Boolean, default: false },

	keywords: { type: Object, default: {} },
	keywordsAuto: { type: Object, default: {} },

	histograms: { type: Object, default: {} },

	languageAnalyzed: { type: Boolean, default: false },
	languageAnalysis: { type: Object, default: {} }
});

mongoose.model('User', UserSchema);