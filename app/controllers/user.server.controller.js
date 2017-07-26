/*jslint node: true */
"use strict";

const chalk = require("chalk");
const async = require("async");

const chalkAlert = chalk.red;
const chalkInfo = chalk.yellow;
const chalkTest = chalk.bold.yellow;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.bold.yellow;
const chalkLog = chalk.gray;

const moment = require("moment");
const User = require("mongoose").model("User");
const debug = require("debug")("user");
const defaults = require("object.defaults/immutable");

const compactDateTimeFormat = "YYYYMMDD HHmmss";

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


exports.findOneUser = function (user, params, callback) {

	let inc = 1;
	if (params.noInc) { inc = 0; }

	const query = { userId: user.userId  };
	const update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: "user",
			nodeId: user.nodeId,
			threeceeFollowing: user.threeceeFollowing,
			tags: user.tags,
			entities: user.entities,
			keywordsAuto: user.keywordsAuto,
			histograms: user.histograms,
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
			languageAnalyzed: user.languageAnalyzed,
			languageAnalysis: user.languageAnalysis
		}
	};

	const options = { 
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
					+ " | LAd: " + us.languageAnalyzed 
					+ " | LS: " + moment(new Date(us.lastSeen)).format(compactDateTimeFormat) 
				);
				const mentionsString = us.mentions.toString() ;
				us.mentions = mentionsString ;
				callback(err, us);
			}
		}
	);
};

exports.updateHistograms = function (params, callback) {

	debug(chalkAlert("updateHistograms\n" + jsonPrint(params)));

	const query = { userId: params.userId };

	User.findOne(query, function(err, user){

		if (err){
			console.error(chalkError("USER FIND ONE ERROR: " + err));
			return(callback(err, null));
		}

		if (user) {

			debug("updateHistograms | FOUND USER: @" + user.screenName + " | HISTOGRAMS: " + jsonPrint(user.histograms));

      let comboHistogram = {};

      async.each(Object.keys(params.histograms), function(type, cb){

        comboHistogram[type] = defaults(user.histograms[type], params.histograms[type]);
        cb();

      }, function(){

      	user.histograms = comboHistogram;
        
      	exports.findOneUser(user, {noInc: true}, function(err, updatedUser){

					debug("updateHistograms | UPDATED USER: @" + user.screenName + " | HISTOGRAMS: " + jsonPrint(user.histograms));

      		callback(err, updatedUser);
      	});


      });
		}
		else {
  		callback(null, null);
		}

	});

};
