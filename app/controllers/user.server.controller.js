var S = require('string');
var chalk = require('chalk');
var util = require('util');

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkDb = chalk.gray;

var moment = require('moment');
var User = require('mongoose').model('User');
var debug = require('debug')('user');

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
var compactDateTimeFormat = "YYYYMMDD HHmmss";

exports.findOneUser = function (user, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	var query = { userId: user.userId  };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: "user",
			nodeId: user.nodeId,
			threeceeFollowing: user.threeceeFollowing,
			tags: user.tags,
			entities: user.entities,
			isTwitterUser: user.isTwitterUser,
			screenName: user.screenName,
			name: user.name,
			description: user.description,
			url: user.url,
			profileUrl: user.profileUrl,
			profileImageUrl: user.profileImageUrl,
			verified: user.verified,
			following: user.following,
			status: user.status,
			statusesCount: user.statusesCount,
			followersCount: user.followersCount,
			friendsCount: user.friendsCount,
			rate: user.rate,
			isTopTerm: user.isTopTerm,
			connectTime: user.connectTime,
			disconnectTime: user.disconnectTime,
			sessionId: user.sessionId,
			sessions: user.sessions,
			lastSession: user.lastSession,
			lastSeen: moment().valueOf()
		},
		"$max": {
			keywords: user.keywords,
			keywordsAuto: user.keywordsAuto,
			languageAnalysis: user.languageAnalysis
		}
	};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	User.findOneAndUpdate(
		query,
		update,
		options,
		function(err, us) {
			if (err) {
				console.log(moment().format(compactDateTimeFormat) + "\n\n***** USER FINDONE ERROR: USER ID: " + user.userId + "\n" + err);
				if (err.code === 11000) {
					User.remove({userId: user.userId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE USER ERROR " + err + "\n" + user.userId);
						}
						else {
							console.log("REMOVED DUPLICATE USER " + user.userId);
						}
					});
				}
				callback(err, user);
			}
			else {
				debug("> US UPDATED"
					+ " | " + us.userId 
					+ " | @" + us.screenName
					+ " | " + us.name
					+ " | Vd: " + us.verified 
					+ " | FLg: " + us.following 
					+ " | Ts: " + us.statusesCount 
					+ " | FLRs: " + us.followersCount 
					+ " | Ms: " + us.mentions 
					+ " | LS: " + moment(new Date(us.lastSeen)).format(compactDateTimeFormat) 
				);
				var mentionsString = us.mentions.toString() ;
				us.mentions = mentionsString ;
				callback(err, us);
			}
		}
	);
}
