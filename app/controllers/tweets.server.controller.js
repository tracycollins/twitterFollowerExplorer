/*jslint node: true */
"use strict";

var chalk = require("chalk");
var _ = require("lodash");

var chalkError = chalk.bold.red;
var chalkAlert = chalk.red;
var chalkTwitter = chalk.blue;

var moment = require("moment");
var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

var Tweet = require("mongoose").model("Tweet");
var Hashtag = require("mongoose").model("Hashtag");
var Media = require("mongoose").model("Media");
var User = require("mongoose").model("User");
var Url = require("mongoose").model("Url");
var Place = require("mongoose").model("Place");

var debug = require("debug")("tweets");
var async = require("async");

var DEFAULT_X = 100;
var DEFAULT_Y = 100;

var recentTweetArray = [] ;
var maxRecentTweets = 20 ;

var recentHashtagArray = [] ;
var maxRecentHashtags = 20 ;

var recentPlaceArray = [] ;
var maxRecentPlaces = 20 ;

var recentMediaArray = [];
var maxRecentMedia = 20 ;

function jsonPrint (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return ("UNDEFINED");
  }
}

function getTimeStamp(inputTime) {
  var currentTimeStamp ;

  if (!inputTime) {
    currentTimeStamp = moment.utc();
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment.utc(inputTime);
  }
  else {
    currentTimeStamp = moment.utc(new Date(inputTime));
  }
  return currentTimeStamp.format(defaultDateTimeFormat);
}

exports.findOneUser = function (user, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	// if (typeof user.following === "undefined") user.following = false;
	// if (user.following === null) user.following = false;

	var query = { userId: user.userId  };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: "user",
			isTwitterUser: user.isTwitterUser,
			threeceeFollowing: user.threeceeFollowing,
			nodeId: user.nodeId,
			tags: user.tags,
			screenName: user.screenName,
			name: user.name,
			description: user.description,
			keywords: user.keywords,
			url: user.url,
			profileUrl: user.profileUrl,
			profileImageUrl: user.profileImageUrl,
			verified: user.verified,
			following: user.following,
			status: user.status,
			statusesCount: user.statusesCount,
			followersCount: user.followersCount,
			friendsCount: user.friendsCount,
			lastSeen: moment().valueOf()
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
				console.log(getTimeStamp() + "\n\n***** USER FINDONE ERROR: USER ID: " + user.userId + "\n" + err);
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

				debug(chalkTwitter("> US UPDATED"
					+ " | " + us.userId 
					+ " | @" + us.screenName
					+ " | " + us.name
					+ " | Vd: " + us.verified 
					+ " | FLg: " + us.following 
					+ " | Ts: " + us.statusesCount 
					+ " | FLRs: " + us.followersCount 
					+ " | Ms: " + us.mentions 
					+ " | LS: " + moment(new Date(us.lastSeen)).format(defaultDateTimeFormat) 
				));
				// var mentionsString = us.mentions.toString() ;
				us.mentions = us.mentions.toString();

				if (params.io) {
					// console.log("IO EMIT USER " + us.nodeId);
					params.io.of("/admin").emit("node", us);	
					params.io.of("/client").emit("node", us);	
				}			

				callback(err, us);
			}
		}
	);
};

function findOnePlace (place, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	var query = { placeId: place.placeId  };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: place.nodeType,
			nodeId: place.nodeId,
			tags: place.tags,
			name: place.name,
			fullName: place.fullName,
			countryCode: place.countryCode,
			country: place.country,
			placeType: place.placeType,
			url: place.url,
			sourceUrl: place.sourceUrl,
			imageUrl: place.imageUrl,
			centroid: place.centroid,
			boundingBox: place.boundingBox,
			lastSeen: Date.now() 
		} 
	};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	Place.findOneAndUpdate(
		query,
		update,
		options,
		function(err, pl) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** PLACE FINDONE ERROR: PLACE ID: " + place.placeId + "\n" + err);
				if (err.code === 11000) {
					Place.remove({placeId: place.placeId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE PLACE ERROR " + err + "\n" + place.placeId);
						}
						else {
							console.log("REMOVED DUPLICATE PLACE " + place.placeId);
						}
					});
				}
				callback(err, place);
			}
			else {
				debug("> PL UPDATED: "
					+ pl.nodeId 
					+ " | MENTIONS: " + pl.mentions 
					+ " | Ls: " + moment(new Date(pl.lastSeen)).format(defaultDateTimeFormat)
					+ " | " + pl.placeType
					+ " | " + pl.name
					+ " | " + pl.fullName
					+ " | " + pl.countryCode
					+ " | " + pl.country
					+ "\nSOURCE URL: " + pl.sourceUrl
					+ "\nIMAGE URL:  " + pl.imageUrl
					);

				// var mentionsString = pl.mentions.toString() ;
				pl.mentions = pl.mentions.toString() ;

				if (!params.noInc) { recentPlaceArray.push(pl); }
				if (recentPlaceArray.length > maxRecentPlaces) { recentPlaceArray.shift(); }

				if (params.io) {
					debug("IO EMIT PLACE " + pl.nodeId + " | " + pl.fullName);
					params.io.of("/admin").emit("node", pl);	
					params.io.of("/client").emit("node", pl);	
				}			
				callback(err, pl);
			}

		}
	);
}

function findOneMedia (media, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	var query = { mediaId: media.mediaId };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: media.nodeType,
			nodeId: media.nodeId,
			tags: media.tags,
			url: media.url, 
			sourceUrl: media.sourceUrl, 
			width: parseInt(media.width), 
			height: parseInt(media.height), 
			lastSeen: Date.now() 
		} 
	};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	Media.findOneAndUpdate(
		query,
		update,
		options,
		function(err, me) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** MEDIA FINDONE ERROR: MEDIA ID: " + media.mediaId + "\n" + err);
				if (err.code === 11000) {
					Media.remove({mediaId: media.mediaId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE MEDIA ERROR " + err + "\n" + media.mediaId);
						}
						else {
							console.log("REMOVED DUPLICATE MEDIA " + media.mediaId);
						}
					});
				}
				callback(err, media);
			}
			else {

				debug(chalkTwitter("> ME UPDATED [" + me.mediaId + "]" 
					+ " Ms: " + me.mentions 
					+ " Ls: " + moment(new Date(me.lastSeen)).format(defaultDateTimeFormat)
					+ " SRC: " + me.sourceUrl
					+ " " + me.width + " x " + me.height 
					+ " URL: " + me.url 
					// + "\n      " + me.filePath
				));

				// var mentionsString = me.mentions.toString() ;
				me.mentions = me.mentions.toString() ;

				recentMediaArray.push(me);
				if (recentMediaArray.length > maxRecentMedia) { recentMediaArray.shift();	}

				if (params.io) {
					// console.log("IO EMIT MEDIA " + me.nodeId);
					params.io.of("/admin").emit("node", me);	
					params.io.of("/client").emit("node", me);	
				}		
				callback(err, me);
			}
		}
	);
}

function findOneHashtag (hashtag, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	var query = { text: hashtag.text.toLowerCase() };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: hashtag.nodeType,
			nodeId: hashtag.nodeId,
			tags: hashtag.tags,
			lastSeen: Date.now() 
		} 
	};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	Hashtag.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ht) {
			if (err) {
				console.log(getTimeStamp() 
					+ "\n\n***** HASHTAG FINDONE ERROR: HASHTAG TEXT: " + hashtag.text 
					+ "\n" + err);
				if (err.code === 11000) {
					Hashtag.remove({text: hashtag.text.toLowerCase()}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE HASHTAG ERROR " + err 
								+ "\n" + hashtag.text.toLowerCase());
						}
						else {
							console.log("REMOVED DUPLICATE HASHTAG " + hashtag.text.toLowerCase());
						}
					});
				}
				callback(err, hashtag);
			}
			else {
				debug("> HT UPDATED" 
					+ " | " + ht.nodeId 
					+ " | MTNs: " + ht.mentions 
					+ " | Ls: " + moment(new Date(ht.lastSeen)).format(defaultDateTimeFormat)
					+ " | " + ht.text
					);
				// var mentionsString = ht.mentions.toString() ;
				ht.mentions = ht.mentions.toString() ;

				recentHashtagArray.push(ht);
				if (recentHashtagArray.length > maxRecentHashtags) { recentHashtagArray.shift(); }
				if (params.io) {
					params.io.of("/admin").emit("node", ht);	
					params.io.of("/client").emit("node", ht);	
				}		
				callback(err, ht);
			}
		}
	);
}

function findOneUrl (url, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	var query = { urlId: url.urlId };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: url.nodeType,
			// urlId: url.urlId,
			nodeId: url.nodeId,
			url: url.url,
			tags: url.tags,
			displayUrl: url.displayUrl,
			expandedUrl: url.expandedUrl,
			lastSeen: Date.now() 
		} 
	};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	Url.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ur) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** URL FINDONE ERROR: URL ID: " + url.urlId + "\n" + err);
				if (err.code === 11000) {
					Url.remove({urlId: url.urlId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE URL ERROR " + err + "\n" + url.urlId);
						}
						else {
							console.log("REMOVED DUPLICATE URL " + url.urlId);
						}
					});
				}
				callback(err, url);
			}
			else {
				debug("> UL UPDATED" 
					+ " | " + ur.urlId 
					+ " | " + ur.nodeId 
					+ " | " + ur.url 
					+ " | " + ur.displayUrl 
					+ " | " + ur.expandedUrl 
					+ " | MTNS: " + ur.mentions 
					+ " | Ls: " + moment(new Date(ur.lastSeen)).format(defaultDateTimeFormat)
					);
				// var mentionsString = ur.mentions.toString() ;
				ur.mentions = ur.mentions.toString() ;

				if (params.io) {
					// console.log("IO EMIT URL " + ur.nodeId);
					params.io.of("/admin").emit("node", ur);	
					params.io.of("/client").emit("node", ur);
				}		
				callback(err, ur);
			}
		}
	);
}

function findOneTweet (tweet, params, callback) {

	var inc = 1;
	if (params.noInc) { inc = 0; }

	var query = { tweetId: tweet.tweetId  };
	var update = { 
		"$inc": { mentions: inc }, 
		"$set": { 
			nodeType: tweet.nodeType,
			nodeId: tweet.nodeId,
			// testMode: tweet.testMode,
			user: tweet.user, 
			url: tweet.url, 
			imageUrl: tweet.imageUrl,
			place: tweet.place, 
			createdAt: tweet.createdAt, 
			lang: tweet.lang,  
			text: tweet.text,
			extendedText: tweet.extendText,
			lastSeen: Date.now(), 
			retweeted: tweet.retweeted, 
			retweetedStatus: tweet.retweetedStatus, 
			retweets: tweet.retweets, 
			favorites: tweet.favorites, 
			isRetweet: tweet.isRetweet, 
			retweetedId: tweet.retweetedId,
			userMentions: tweet.userMentions, 
			tags: tweet.tags, 
			hashtags: tweet.hashtags, 
			media: tweet.media, 
			urls: tweet.urls, 
			status: tweet.status 
		}
	};

	if (!_.isEmpty(tweet.addHashMap)) {
		// var addToSet = "$addToSet";
		update.addToSet = {};

		Object.keys(tweet.addHashMap).forEach(function(prop){

			var addArray = [];

			Object.keys(tweet.addHashMap[prop]).forEach(function(id){
				var obj = {};
				obj[id] = tweet.addHashMap[prop][id];

				debug(chalkError(
					prop 
					+ " | ID: " + id 
					+ " | obj[id]: " + obj[id] 
					+ "\nobj\n" + jsonPrint(obj) 
				));
	      
	      var newTranslationObj = {};
	      newTranslationObj[id] = tweet.addHashMap[prop][id];

				addArray.push(newTranslationObj);
				update.addToSet[prop] = { "$each": addArray};
				delete tweet.addHashMap[prop][id];
			});
		});
	}

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	Tweet.findOneAndUpdate(
		query,
		update,
		options,
		function(err, tw) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** TWEET FINDONE ERROR: TWEET ID: " + tweet.tweetId + "\n" + err);
				console.log(chalkTwitter("tweet: " + JSON.stringify(tweet, null, 3)));
				if (err.code === 11000) {
					Tweet.remove({tweetId: tweet.tweetId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE TWEET ERROR " + err + "\n" + tweet.tweetId);
						}
						else {
							console.log("REMOVED DUPLICATE TWEET " + tweet.tweetId);
						}
					});
				}
				callback(err, tweet);
			}
			else {

				tw.test = "TEST" ;
				tw.x = DEFAULT_X ;
				tw.y = DEFAULT_Y ;

				var textReformatted = tw.extendedText 
				? tw.extendedText.replace("\n", " ") : tw.text.replace("\n", " ") ;

				// console.log("tw: " + JSON.stringify(tw, null, 3));

				debug("> TW UPDATED [" + tw.tweetId + "]"
					+ " " + tw.createdAt 
					// + "|UID: " + tw.user.userId + " | @" + tw.user.screenName
					+ "|IURL: " + tw.imageUrl 
					+ "|RTs: " + tw.retweets 
					+ "|isRT: " + tw.isRetweet 
					+ "|RTID: " + tw.retweetedId 
					+ "|RTd: " + tw.retweeted 
					+ "|MTNs: " + tw.mentions 
					+ "|FAVs: " + tw.favorites 
					+ "|LAST SEEN: " + moment(new Date(tw.lastSeen)).format(defaultDateTimeFormat)
					+ "|LANG: " + tw.lang
					+ "\n " + textReformatted
					+ "\n TRANS\n " + jsonPrint(tw.translations)
					);

				var smallTw = {
					tweetId: tw.tweetId, 
					createdAt: tw.createdAt
					// screenName: tw.user.screenName
				};

				if (params.noInc && (tw.mentions === 0)){
					debug("+ N A TW " + tw.tweetId
						+ " " + getTimeStamp(tw.createdAt) 
						// + " | M: " + tw.mentions 
						// + " | F: " + tw.favorites 
						// + " | U: " + tw.user.userId 
						// + " | @" + tw.user.screenName
					);
					params.twitterEvents.emit("NEW_TWEET", smallTw);
				}
				else if (params.noInc && (tw.mentions > 0)){
					debug("- F A TW " + tw.tweetId
						+ " " + getTimeStamp(tw.createdAt) 
						// + " | M: " + tw.mentions 
						// + " | F: " + tw.favorites 
						// + " | U: " + tw.user.userId 
						+ " | @" + tw.user.screenName
					);
					params.twitterEvents.emit("OLD_TWEET", smallTw);
				}

				recentTweetArray.push(tw);
				if (recentTweetArray.length > maxRecentTweets) { recentTweetArray.shift(); }

				if (params.io) {
					// debug("IO EMIT TWEET " + tw.nodeId);
					params.io.emit("node", tw);	
					params.io.of("/admin").emit("node", tw);	
					params.io.of("/client").emit("node", tw);	
					params.io.of("/util").emit("node", tw);	
					params.io.of("/util").in("meta").emit("node", tw);	
				}

				callback(err, tw);

			}

		}
	);
}

exports.createStreamTweet = function(params, callback) {	

	var newTweet = params.tweetStatus;
	var io = params.io;

	var tweetObj ;
	var userProfileImageUrl = newTweet.user.profile_image_url.replace(/_normal/i, "");

	debug(chalkTwitter("newTweet: " + newTweet.text));
	if (newTweet.truncated && newTweet.extended_tweet) {
		debug(chalkTwitter("newTweet extendedText: " + newTweet.extended_tweet.full_text));
	}
	debug(chalkTwitter("newTweet.testMode: " + newTweet.testMode));
	debug(chalkTwitter("newTweet.addHashMap: " + jsonPrint(newTweet.addHashMap)));

	tweetObj = new Tweet({ 
		nodeType: "tweet",
		testMode: newTweet.testMode,
		nodeId : newTweet.id_str,
		tweetId : newTweet.id_str,
		// user: newTweet.user,
		url: "http://twitter.com/" + newTweet.user.screen_name + "/status/" + newTweet.id_str,
		imageUrl: userProfileImageUrl,
		createdAt : newTweet.created_at, 
		lastSeen : Date.now(),
		retweeted : newTweet.retweeted, 
		retweets : newTweet.retweet_count, 
		favorites : newTweet.favorite_count, 
		text : newTweet.text,
		status : newTweet
	});

	if (newTweet.addHashMap) { tweetObj.addHashMap = newTweet.addHashMap; }
	if (newTweet.truncated && newTweet.extended_tweet) {
		tweetObj.extendedText = newTweet.extended_tweet.full_text;
	}

	if (newTweet.retweeted_status) {
		tweetObj.isRetweet = true;
		tweetObj.retweetedId = newTweet.retweeted_status.id_str;
		tweetObj.retweetedStatus = newTweet.retweeted_status;
	}

	async.parallel({

    user: function(cb) {

			var userObj = new User({ 
				nodeType: "user",
				isTwitterUser: true,
				nodeId : newTweet.user.id_str, 
				userId : newTweet.user.id_str, 
				name : newTweet.user.name,
				screenName : newTweet.user.screen_name || "UNDEFINED",
				url: newTweet.user.url,
				profileUrl: "http://twitter.com/" + newTweet.user.screen_name,
				profileImageUrl: userProfileImageUrl,
				verified: newTweet.user.verified,
				following: newTweet.user.following,
				description: newTweet.user.description,
				createdAt : newTweet.created_at, 
				lastSeen : Date.now(),
				statusesCount : newTweet.user.statuses_count,
				friendsCount : newTweet.user.friends_count,
				followersCount : newTweet.user.followers_count,
				mentions : 0
			});

			exports.findOneUser(userObj, params, function(err, updatedUserObj){
				if (err) { 
					console.log(chalkError("ERROR createStreamTweet: user: " + err));
				}
				cb(err, updatedUserObj);
			});	
    },

    userMentions: function(cb) {

			if (newTweet.entities.user_mentions.length === 0) {
  			debug(chalkAlert("!userMentionsX"));
				cb(null, null);
			} 
			else if (newTweet.entities.user_mentions) {

				if (newTweet.entities.user_mentions.length === 0) { 
					return(cb(null, null));
				}

				async.concat(newTweet.entities.user_mentions, function (umObj, cb2) {

					var userMentionObj = new User({ 
						nodeType: "user",
						isTwitterUser: true,
						nodeId : umObj.id_str, 
						userId : umObj.id_str, 
						name : umObj.name,
						screenName : umObj.screen_name || "UNDEFINED",
						profileUrl: "http://twitter.com/" + umObj.screen_name,
						profileImageUrl: "http://twitter.com/" + umObj.screen_name + "/profile_image?size=normal",
						url: umObj.url,
						verified: umObj.verified,
						following: umObj.following,
						lastSeen : moment().valueOf(),
						mentions : 0
					});

					if (newTweet.user.id_str === umObj.id_str) {
						debug(chalkAlert("userMentions SKIPPING: USER MENTION == USER: " + newTweet.user.id_str));
						cb2(null, userMentionObj);
					}
					else {
						exports.findOneUser(userMentionObj, {noInc: newTweet.noInc, io: io}, function(err, updatedUserMentionObj){
							if (err) { console.log(chalkError("ERROR createStreamTweet: userMentions: " + err)); }
							cb2(err, updatedUserMentionObj);
						});							
					}

				}, function (err, userMentions) {
					if (err) {
						debug(chalkError("ERROR createStreamTweet: userMentions: " + err));
						cb(err, null);
					}
					else if (!userMentions) {
						debug(chalkAlert("!userMentions"));
						cb(null, null);
					}
					else {
						debug(chalkAlert("userMentions"));
						cb(null, userMentions);
					}
				});
			}
			else {
  			debug(chalkAlert("userMentionsX"));
				cb(null, null);
			}
    },

    hashtags: function(cb) {

			if (newTweet.entities.hashtags.length === 0) {
				cb(null, null);
			}
			else if (newTweet.entities.hashtags) {

				if (newTweet.entities.hashtags.length === 0) { return(cb(null, null)); }

				async.concat(newTweet.entities.hashtags, function (htObj, cb2) {

					var currentHt = htObj.text.toLowerCase() ;

					var hashtagObj = new Hashtag({ 
						nodeType: "hashtag",
						nodeId : currentHt,
						hashtagId : currentHt,
						text : currentHt,
						lastSeen : Date.now(),
						mentions : 0
					});

					findOneHashtag(hashtagObj, {noInc: newTweet.noInc, io: io}, function(err, updatedHtObj){
						if (err) { console.log(chalkError("ERROR createStreamTweet: hashtags: " + err)); }
						cb2(err, updatedHtObj);
					});	


				}, function (err, hashtags) {
					if (err) {
						debug(chalkError("ERROR createStreamTweet: hashtags: " + err));
						cb(err, null);
					}
					else if (!hashtags) {
						debug(chalkAlert("!hashtags"));
						cb(null, null);
					}
					else {
						debug(chalkAlert("hashtags"));
						cb(null, hashtags);
					}
				});
			}
			else {
				cb(null, null);
			}
    },

    media: function(cb) {

			if (newTweet.entities.media) {

				if (newTweet.entities.media.length === 0) { return(cb(null, null)); }

				async.concat(newTweet.entities.media, function (mediaObj, cb2) {

					// var defaultImageUrl = mediaObj.media_url + ":thumb" ;

					var meObj = new Media({ 
						nodeType: "media",
						nodeId : mediaObj.id_str, 
						mediaId : mediaObj.id_str, 
						url : mediaObj.media_url + ":thumb",
						sourceUrl : tweetObj.url,
						width: parseInt(mediaObj.sizes.large.w),
						height: parseInt(mediaObj.sizes.large.h),
						lastSeen : Date.now(),
						mentions : 0
					});

					// KLUDGE?? why did i need to do this?
					// meObj.mentions = meObj.mentions+1;

					findOneMedia(meObj, {noInc: newTweet.noInc, io: io}, function(err, updatedMeObj){
						if (err) { console.log(chalkError("ERROR createStreamTweet: media: " + err)); }
						cb2(err, updatedMeObj);
					});	

				}, function (err, media) {
					if (err) {
						debug(chalkError("ERROR createStreamTweet: media: " + err));
						cb(err, null);
					}
					else if (!media) {
						debug(chalkAlert("!media"));
						cb(null, null);
					}
					else {
						debug(chalkAlert("media"));
						cb(null, media);
					}
				});
			}
			else {
				cb(null, null);
			}
    },

    urls: function(cb) {
			if (newTweet.entities.urls) {

				if (newTweet.entities.urls.length === 0) { return(cb(null, null)); }

				async.concat(newTweet.entities.urls, function (urlObj, cb2) {

					var urlIdArray = (/\w+$/g).exec(urlObj.url);  // use end of URL as urlId

					// debug("urlIdArray\n" + jsonPrint(urlIdArray));

					if (urlIdArray && (urlIdArray.length > 0)){
						// var urlId = urlIdArray[0];

						// console.log(chalkTwitter("\n URL: urlId: " + urlId);

						urlObj = new Url({ 
							urlId : urlIdArray[0],
							nodeType: "url",
							nodeId : urlIdArray[0],
							url : urlObj.url,
							displayUrl : urlObj.display_url,
							expandedUrl : urlObj.expanded_url,
							lastSeen : Date.now(),
							mentions : 0
						});

						findOneUrl(urlObj, params, function(err, updatedUrlObj){
							if (err) { console.log(chalkError("ERROR createStreamTweet: urls: " + err)); }
							cb2(err, updatedUrlObj);
						});
					}
					else {
						cb2(null, null);
					}
				}, function (err, urls) {
					if (err) {
						debug(chalkError("ERROR createStreamTweet: urls: " + err));
						cb(err, null);
					}
					// else if (typeof urls === "undefined") {
					// 	debug(chalkAlert("urls undefined"));
					// 	cb(null, null);
					// }
					else if (!urls) {
						debug(chalkAlert("!urls"));
						cb(null, null);
					}
					else {
						debug(chalkAlert("urls"));
						cb(null, urls);
					}
				});
			}
			else {
				cb(null, null);
			}
    },

    place: function(cb) {

			// var placeObj ;

			if (newTweet.place) {
				// console.log(chalkTwitter("\n--- PLACE ---\n" + JSON.stringify(newTweet, null, 3) + "\n"));
				debug(chalkTwitter("PLACE | " + newTweet.place.full_name));

				var placeObj = new Place({ 
					nodeType: "place",
					placeId : newTweet.place.id , 
					nodeId : newTweet.place.id , 
					boundingBox: newTweet.place.bounding_box,
					name : newTweet.place.name,
					fullName : newTweet.place.full_name,
					countryCode : newTweet.place.country_code,
					country : newTweet.place.country,
					placeType : newTweet.place.place_type,
					url: newTweet.place.url,
					sourceUrl: tweetObj.url,
					imageUrl: tweetObj.imageUrl,
					lastSeen : Date.now(),
					mentions : 0
				});			

				if (newTweet.place.centroid) {
					placeObj.centroid = newTweet.place.centroid;
				}
				else {
					placeObj.centroid = [];
				}

				findOnePlace(placeObj, {noInc: newTweet.noInc, io: io}, function(err, updatedPlObj){
					if (err) { 
						console.log(chalkError("ERROR createStreamTweet: place: " + err)); 
					}
					cb(err, updatedPlObj);
				});
			}
			else {
				cb(null, null);
			}
    }

	}, function(err, results) {

		if (err) {
			console.log(chalkError("ERROR createStreamTweet" 
				+ "\n" + err
				// + "\nresults\n" + jsonPrint(results)
			));
			callback(err, results);
		}
		else {
			tweetObj.user = results.user;
			tweetObj.userMentions = results.userMentions;
			tweetObj.hashtags = results.hashtags;
			tweetObj.media = results.media;
			tweetObj.urls = results.urls;
			tweetObj.place = results.place;

			findOneTweet(tweetObj, params, function(err, twObj){
				if (err) { 
					console.log(chalkError("ERROR createStreamTweet: tweet: " + err));
				}
				callback(err, twObj);
			});	
		}


	});
};

exports.tweetByExactID = function(id, callback) {
	debug("@@@-> tweetByExactID DB SEACH: " + id);
	Tweet.findOne({
			tweetId: id
		}, 
		function(err, reqTweet) {
			if (err) {
				console.log("***** DB ERROR: tweetByExactID: " + id + "\n" + err);
				callback(err);
			}
			else if (reqTweet) {
				debug("@@@-> tweetByExactID (DB): REQ ID: " + id 
					+ " | FOUND " + reqTweet.tweetId
				);
	
				var textReformatted = reqTweet.text.replace("\n", " ") ;
				textReformatted = textReformatted.replace("\r", " ") ;

				debug("@@@-> TBID"
					+ " | " + reqTweet.tweetId 
					+ " | " + getTimeStamp(reqTweet.createdAt)
					+ " | " + textReformatted.substring(0,20)
					);
				callback(reqTweet) ;
			}
			else {
				debug("@@@... tweetByExactID (DB) NOT FOUND: REQ ID: " + id);
				callback(null) ;
			}
		}
	);
};

exports.tweetByID = function(options, callback) {

	console.log("options\n" + jsonPrint(options));

	var startMoment;
	var endMoment;

	// if (typeof options.limit === "undefined") { options.limit = 100; }
	if (!options.limit) { options.limit = 100; }

	// if (typeof options.startMoment !== "undefined") {
	if (!options.startMoment) {
		startMoment = moment.utc(new Date(options.startMoment));
	}
	else {
		startMoment = moment.utc("2000-01-01T00:00:00+00:00");
	}

	if (options.endMoment) {
		endMoment = moment.utc(options.endMoment);
	}
	else {
		endMoment = moment.utc();
	}

	debug(">S TW DB"
		+ " | " + options.id 
		+ " | LIM " + options.limit
	);

	var query = {};
	query = { 
		tweetId: {"$gt": options.id.toString()},
		createdAt: { "$gte": startMoment, "$lt": endMoment} 
	};

	console.log("query\n" + jsonPrint(query));

	Tweet.find(
		query, 
		function(err, reqTweets) {
			if (err) {
				console.log("***** DB ERROR: tweetByID: " + options.id + "\n" + err);
				callback(err, options.id);
			}
			else if (reqTweets.length > 0) {

				debug("reqTweets length: " + reqTweets.length);

				// console.log("reqTweets" + reqTweets.join("\n"));

				debug("<R TW DB"
					+ " | REQ " + options.id 
					+ " | FOUND " + reqTweets[0].tweetId
					+ " | Ts " + reqTweets.length
				);

				// for (var i=0; i<reqTweets.length; i++){
				reqTweets.forEach(function(tweet){
	
					var textReformatted = tweet.text.replace("\n", " ") ;
					textReformatted = textReformatted.replace("\r", " ") ;

					debug("@@@-> TBID"
						+ " | " + tweet.tweetId 
						+ " | " + getTimeStamp(tweet.createdAt)
						+ " | " + textReformatted.substring(0,20)
						);
				});
				callback(null, reqTweets) ;
			}
			else {
				// debug("\n$$$$$ tweetByID $$$$$\n" + JSON.stringify(tweet, null, 3));
				debug("-R TW DB | NOT FOUND: REQ: " + options.id);
				callback(null, reqTweets) ;
			}
		}
	).limit(options.limit).sort({tweetId: options.sort});
};

// find 1st tweet after or equal to date
exports.tweetByTimeStamp = function(reqDate, lim, callback) {

	var limit = 100;

	if (callback){
		callback = lim;
	}
	else {
		limit = parseInt(lim);
	}

	var reqMoment;


	if (moment.isMoment(reqDate)) {
		reqMoment = moment.utc(reqDate);
	}
	else {
		reqMoment = moment.utc(new Date(parseInt(reqDate)));
	}
	

	if (!reqMoment.isValid()) {
		console.log("***** DB ERROR: tweetByTimeStamp: INVALID REQUEST DATE: " + reqDate);
		return callback("INVALID REQUEST DATE", reqDate);
	}

	console.log("@@@-> tweetByTimeStamp (TBTS): REQ DATETIME" 
		+ " | " + getTimeStamp(reqMoment)
		+ " | LIM: " + limit
	);


	Tweet.find(
		{
			"createdAt": { 
				"$gte": reqMoment
			}
		},
		function(err, reqTweets) {
			if (err) {
				console.log("***** DB ERROR: tweetByTimeStamp: " + reqDate + "\n" + err);
				callback(err, null);
			}
			else if (reqTweets) {

				console.log("@@@-> TBTS"
					+ " | Ts: " + reqTweets.length 
				);

				// for (var i=0; i<reqTweets.length; i++){
				reqTweets.forEach(function(tweet){

					var textReformatted = tweet.text.replace("\n", " ") ;
					textReformatted = textReformatted.replace("\r", " ") ;

					debug("@@@-> TBTS"
						+ " | " + tweet.tweetId 
						+ " | " + getTimeStamp(tweet.createdAt)
						+ " | " + textReformatted.substring(0,20)
					);
				});
				callback(null, reqTweets) ;
			}
			else {
				console.log("@@@-> tweetByTimeStamp: TWEET NOT FOUND: " + reqDate);
				callback(null, null) ;
			}
		}
	).limit(limit).sort({tweetId: 1});
};