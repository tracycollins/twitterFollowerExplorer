/*jslint node: true */
"use strict";

const removeDuplicateFlag = true;

const chalk = require("chalk");
const _ = require("lodash");

// const HashMap = require("hashmap").HashMap;

// const keywordHashMap = new HashMap();

const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkTwitter = chalk.blue;

const moment = require("moment");
const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

const Tweet = require("mongoose").model("Tweet");
const Hashtag = require("mongoose").model("Hashtag");
const Media = require("mongoose").model("Media");
const User = require("mongoose").model("User");
const Url = require("mongoose").model("Url");
const Place = require("mongoose").model("Place");

const debug = require("debug")("wa");
const async = require("async");

const DEFAULT_X = 100;
const DEFAULT_Y = 100;

function jsonPrint (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return ("UNDEFINED");
  }
}

function getTimeStamp(inputTime) {

  let currentTimeStamp ;

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

exports.findOneUser = function  (user, params, callback) {

	debug("findOneUser | " + user.userId);

	const query = { userId: user.userId  };
	const update = { 
		"$inc": { mentions: params.inc }, 
		"$set": { 
			isTwitterUser: user.isTwitterUser,
			threeceeFollowing: user.threeceeFollowing,
			nodeType: "user",
			nodeId: user.nodeId,
			screenName: user.screenName,
			name: user.name,
			url: user.url,
			profileUrl: user.profileUrl,
			profileImageUrl: user.profileImageUrl,
			verified: user.verified,
			keywordsAuto: user.keywordsAuto,
			keywords: user.keywords,
			following: user.following,
			statusesCount: user.statusesCount,
			followersCount: user.followersCount,
			friendsCount: user.friendsCount,
			status: user.status,
			lastSeen: moment().valueOf() 
		}
		// "$max": {
		// 	statusesCount: user.statusesCount,
		// 	followersCount: user.followersCount,
		// 	friendsCount: user.friendsCount
		// }
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
				console.error(chalkError("USER ERROR " + user.userId + "\n" + err));
				if (err.code === 11000) {
					if (removeDuplicateFlag) {
						User.remove({userId: user.userId}, function(err){
							if (err) {
								console.log("REMOVED DUPLICATE USER ERROR " + user.userId + "\n" + err);
								callback(err, user);
							}
							else {
								debug("XXX DUP USER " + user.userId);

								User.findOneAndUpdate(
									query,
									update,
									options,
									function(err, us) {
										if (err) {
											console.log("REMOVED DUPLICATE USER ERROR RETRY" + user.userId + "\n" + err);
											callback(err, user);
										}
										else {
											console.log(chalkTwitter("> US UPDATED"
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
											const mentionsString = us.mentions.toString() ;
											us.mentions = mentionsString ;
											callback(err, us);
										}
									});
							}
						});
					}
					else {
						console.log("!!! DUPLICATE USER ERROR " + user.userId + "\n" + err);
						callback(err, user);
					}
				}
				else {
					console.error(getTimeStamp() + "\n\n***** USER FINDONE ERROR: USER ID: " + user.userId + "\n" + err);
					callback(err, user);
				}
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
				const mentionsString = us.mentions.toString() ;
				us.mentions = mentionsString ;
				callback(err, us);
			}
		}
	);
};

function findOnePlace (place, params, callback) {

	debug("findOnePlace | " + place.placeId);

	const query = { placeId: place.placeId  };
	const update = { 
		"$inc": { mentions: params.inc }, 
		"$set": { 
			nodeType: place.nodeType,
			nodeId: place.nodeId,
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
			lastSeen: moment().valueOf() 
		} 
	};

	const options = { 
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
				if (err.code === 11000) {
					Place.remove({placeId: place.placeId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE PLACE ERROR " + err + "\n" + place.placeId);
							callback(err, place);
						}
						else {
							debug("XXX DUP PLACE " + place.placeId);
							callback(err, place);
						}
					});
				}
				else {
					console.error(getTimeStamp() + "\n\n***** PLACE FINDONE ERROR: PLACE ID: " + place.placeId + "\n" + err);
					callback(err, place);
				}
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

				const mentionsString = pl.mentions.toString() ;
				pl.mentions = mentionsString ;

				// if (params.inc) { recentPlaceArray.push(pl); }
				// if (recentPlaceArray.length > maxRecentPlaces) { recentPlaceArray.shift(); }

				callback(err, pl);
			}

		}
	);
}

function findOneMedia (media, params, callback) {

	debug("findOneMedia | " + media.mediaId);

	const query = { mediaId: media.mediaId };
	const update = { 
		"$inc": { mentions: params.inc }, 
		"$set": { 
			nodeType: media.nodeType,
			nodeId: media.nodeId,
			url: media.url, 
			sourceUrl: media.sourceUrl, 
			width: parseInt(media.width), 
			height: parseInt(media.height), 
			lastSeen: moment().valueOf() 
		} 
	};

	const options = { 
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
				if (err.code === 11000) {
					if (removeDuplicateFlag) {
						Media.remove({mediaId: media.mediaId}, function(err){
							if (err) {
								console.log("REMOVED DUPLICATE MEDIA ERROR " + media.mediaId + "\n" + err);
								callback(err, media);
							}
							else {
								debug("XXX DUP MEDIA " + media.mediaId);
								callback(err, media);
							}
						});
					}
					else {
						console.log("!!! DUPLICATE MEDIA ERROR " +media.mediaId + "\n" + err);
						callback(err, media);
					}
				}
				else {
					console.error(getTimeStamp() + "\n\n***** MEDIA FINDONE ERROR: MEDIA ID: " + media.mediaId + "\n" + err);
					callback(err, media);
				}
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

				const mentionsString = me.mentions.toString() ;
				me.mentions = mentionsString ;

				// recentMediaArray.push(me);
				// if (recentMediaArray.length > maxRecentMedia) { recentMediaArray.shift();	}

				callback(err, me);
			}
		}
	);
}

function findOneHashtag (hashtag, params, callback) {

	debug("findOneHashtag | " + hashtag.text);

	const query = { text: hashtag.text.toLowerCase() };
	const update = { 
		"$inc": { mentions: params.inc }, 
		"$set": { 
			nodeType: hashtag.nodeType,
			nodeId: hashtag.nodeId,
			lastSeen: moment().valueOf() 
		} 
	};

	const options = { 
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
				if (err.code === 11000) {
					if (removeDuplicateFlag) {
						Hashtag.remove({text: hashtag.text.toLowerCase()}, function(err){
							if (err) {
								console.log("REMOVED DUPLICATE HASHTAG ERROR " + hashtag.text + "\n" + err);
								callback(err, hashtag);
							}
							else {
								debug("XXX DUP HASHTAG " + hashtag.text.toLowerCase());
								callback(err, hashtag);
							}
						});
					}
					else {
						console.log("!!! DUPLICATE HASHTAG ERROR " + hashtag.text  + "\n" + err);
						callback(err, hashtag);
					}
				}
				else {
					console.error(getTimeStamp() + "\n\n***** HASHTAG FINDONE ERROR: HASHTAG TEXT: " + hashtag.text  + "\n" + err);
					callback(err, hashtag);
				}
			}
			else {
				debug("> HT UPDATED" 
					+ " | " + ht.nodeId 
					+ " | MTNs: " + ht.mentions 
					+ " | Ls: " + moment(new Date(ht.lastSeen)).format(defaultDateTimeFormat)
					+ " | " + ht.text
				);
				const mentionsString = ht.mentions.toString() ;
				ht.mentions = mentionsString ;

				// recentHashtagArray.push(ht);
				// if (recentHashtagArray.length > maxRecentHashtags) { recentHashtagArray.shift(); }
				callback(err, ht);
			}
		}
	);
}

function findOneUrl (url, params, callback) {

	debug("findOneUrl | " + url.urlId);

	const query = { urlId: url.urlId };
	const update = { 
		"$inc": { mentions: params.inc }, 
		"$set": { 
			nodeType: url.nodeType,
			nodeId: url.nodeId,
			url: url.url,
			displayUrl: url.displayUrl,
			expandedUrl: url.expandedUrl,
			lastSeen: moment().valueOf() 
		} 
	};

	const options = { 
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
				if (err.code === 11000) {
					Url.remove({urlId: url.urlId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE URL ERROR " + err + "\n" + url.urlId);
						}
						else {
							debug("XXX DUP URL " + url.urlId);
						}
						callback(err, url);
					});
				}
				else {
					console.error(getTimeStamp() + "\n\n***** URL FINDONE ERROR: URL ID: " + url.urlId + "\n" + err);
					callback(err, url);
				}
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
				const mentionsString = ur.mentions.toString() ;
				ur.mentions = mentionsString ;
				callback(err, ur);
			}
		}
	);
}

function findOneTweet (tweet, params, callback) {

	debug("findOneUrl | " + tweet.tweetId);

	const query = { tweetId: tweet.tweetId  };
	const update = { 
		"$inc": { mentions: params.inc }, 
		"$set": { 
			nodeType: tweet.nodeType,
			nodeId: tweet.nodeId,
			user: tweet.user, 
			url: tweet.url, 
			imageUrl: tweet.imageUrl,
			place: tweet.place, 
			createdAt: tweet.createdAt, 
			lang: tweet.lang,  
			text: tweet.text,
			extendedText: tweet.extendText,
			lastSeen: moment().valueOf(), 
			retweeted: tweet.retweeted, 
			retweetedStatus: tweet.retweetedStatus, 
			retweets: tweet.retweets, 
			favorites: tweet.favorites, 
			isRetweet: tweet.isRetweet, 
			retweetedId: tweet.retweetedId,
			userMentions: tweet.userMentions, 
			hashtags: tweet.hashtags, 
			media: tweet.media, 
			urls: tweet.urls, 
			status: tweet.status 
		}
	};

	if (!_.isEmpty(tweet.addHashMap)) {
		// const addToSet = "$addToSet";
		update.addToSet = {};

		Object.keys(tweet.addHashMap).forEach(function(prop){

			const addArray = [];

			Object.keys(tweet.addHashMap[prop]).forEach(function(id){
				const obj = {};
				obj[id] = tweet.addHashMap[prop][id];

				debug(chalkError(
					prop 
					+ " | ID: " + id 
					+ " | obj[id]: " + obj[id] 
					+ "\nobj\n" + jsonPrint(obj) 
				));
	      
	      const newTranslationObj = {};
	      newTranslationObj[id] = tweet.addHashMap[prop][id];

				addArray.push(newTranslationObj);
				update.addToSet[prop] = { "$each": addArray};
				delete tweet.addHashMap[prop][id];
			});
		});
	}

	const options = { 
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
				debug(chalkTwitter("tweet: " + JSON.stringify(tweet, null, 3)));
				if (err.code === 11000) {
					Tweet.remove({tweetId: tweet.tweetId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE TWEET ERROR " + err + "\n" + tweet.tweetId);
						}
						else {
							debug("XXX DUP TWEET " + tweet.tweetId);
						}
						callback(err, tweet);
					});
				}
				else {
					console.error(getTimeStamp() + "\n\n***** TWEET FINDONE ERROR: TWEET ID: " + tweet.tweetId + "\n" + err);
					callback(err, tweet);
				}
			}
			else {

				tw.test = "TEST" ;
				tw.x = DEFAULT_X ;
				tw.y = DEFAULT_Y ;

				const textReformatted = tw.extendedText ? tw.extendedText.replace("\n", " ") : tw.text.replace("\n", " ") ;

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

				if (!params.inc && (tw.mentions === 0)){
					debug("+ N A TW " + tw.tweetId
						+ " " + getTimeStamp(tw.createdAt) 
						// + " | M: " + tw.mentions 
						// + " | F: " + tw.favorites 
						// + " | U: " + tw.user.userId 
						// + " | @" + tw.user.screenName
					);
				}
				else if (!params.inc && (tw.mentions > 0)){
					debug("- F A TW " + tw.tweetId
						+ " " + getTimeStamp(tw.createdAt) 
						// + " | M: " + tw.mentions 
						// + " | F: " + tw.favorites 
						// + " | U: " + tw.user.userId 
						+ " | @" + tw.user.screenName
					);
				}

				// recentTweetArray.push(tw);
				// if (recentTweetArray.length > maxRecentTweets) { recentTweetArray.shift(); }
				callback(err, tw);

			}

		}
	);
}

exports.createStreamTweet = function(params, callback) {	

	let newTweet = params.tweetStatus;

	if ((newTweet.user === undefined) || !newTweet.user){
		console.log(chalkError("createStreamTweet: TWEET USER UNDEFINED " + newTweet.id_str));
		return(callback("USER UNDEFINED", newTweet));
	}

	const userProfileImageUrl = newTweet.user.profile_image_url.replace(/_normal/i, "");

	if (newTweet.truncated && newTweet.extended_tweet) {
		debug(chalkTwitter("newTweet extendedText: " + newTweet.extended_tweet.full_text));
	}

	debug(chalkTwitter("newTweet.testMode: " + newTweet.testMode));
	debug(chalkTwitter("newTweet.addHashMap: " + jsonPrint(newTweet.addHashMap)));
	console.log(chalkTwitter("tweets.server.createStreamTweet newTweet\n" + jsonPrint(newTweet)));

	let tweetObj = new Tweet({ 
		nodeType: "tweet",
		inc: newTweet.inc,
		nodeId : newTweet.id_str,
		tweetId : newTweet.id_str,
		url: "http://twitter.com/" + newTweet.user.screen_name + "/status/" + newTweet.id_str,
		imageUrl: userProfileImageUrl,
		createdAt : newTweet.created_at, 
		lastSeen : moment().valueOf(),
		retweeted : newTweet.retweeted, 
		retweets : newTweet.retweet_count, 
		favorites : newTweet.favorite_count, 
		text : newTweet.text,
		status : newTweet
	});

	if (newTweet.addHashMap) { 
		debug(chalkTwitter("TRUE: newTweet.addHashMap: " + jsonPrint(newTweet.addHashMap)));
		tweetObj.addHashMap = newTweet.addHashMap;
	}
	if (newTweet.truncated && newTweet.extended_tweet) {
		debug(chalkTwitter("TRUE: newTweet.truncated && newTweet.extended_tweet: " + newTweet.extended_tweet.full_text));
		tweetObj.extendedText = newTweet.extended_tweet.full_text;
	}

	if (newTweet.retweeted_status) {
		debug(chalkTwitter("TRUE: newTweet.retweeted_status: " + newTweet.retweeted_status.id_str));
		tweetObj.isRetweet = true;
		tweetObj.retweetedId = newTweet.retweeted_status.id_str;
		tweetObj.retweetedStatus = newTweet.retweeted_status;
	}

	async.parallel({

    user: function(cb) {

    	debug(chalkAlert("ASYNC PARALLEL USER"));

			const userObj = new User({ 
				isTwitterUser: true,
				nodeType: "user",
				nodeId : newTweet.user.id_str, 
				userId : newTweet.user.id_str, 
				name : newTweet.user.name,
				screenName : newTweet.user.screen_name,
				url: newTweet.user.url,
				profileUrl: "http://twitter.com/" + newTweet.user.screen_name,
				profileImageUrl: userProfileImageUrl,
				verified: newTweet.user.verified,
				following: newTweet.user.following,
				description: newTweet.user.description,
				createdAt : newTweet.created_at, 
				lastSeen : moment().valueOf(),
				statusesCount : newTweet.user.statuses_count,
				friendsCount : newTweet.user.friends_count,
				followersCount : newTweet.user.followers_count,
				mentions : 0
			});

			exports.findOneUser(userObj, {inc: newTweet.inc}, function(err, updatedUserObj){

	    	debug(chalkAlert("ASYNC PARALLEL USER CALLBACK"));

				if (err) { 
					if (err.code !== 11000) {
						console.log(chalkError("ERROR createStreamTweet: user: " + err));
					}
					cb(err, userObj);
				}
				else {
					cb(null, updatedUserObj);
				}
			});	
    },

    userMentions: function(cb) {

    	debug(chalkAlert("ASYNC PARALLEL USER MENTIONS"));

			if ((newTweet.entities.user_mentions) && (newTweet.entities.user_mentions.length > 0)) { 
				async.concat(newTweet.entities.user_mentions, function (umObj, cb2) {
					const userMentionObj = new User({ 
						isTwitterUser: true,
						nodeType: "user",
						nodeId : umObj.id_str, 
						userId : umObj.id_str, 
						name : umObj.name,
						screenName : umObj.screen_name,
						profileUrl: "http://twitter.com/" + umObj.screen_name,
						profileImageUrl: "http://twitter.com/" + umObj.screen_name + "/profile_image?size=normal",
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
						exports.findOneUser(userMentionObj, {inc: newTweet.inc}, function(err, updatedUserMentionObj){
							if (err) { 
								if (err.code !== 11000) {
									console.log(chalkError("ERROR createStreamTweet: userMentions: " + err));
								}
								cb2(err, userMentionObj);
							}
							else {
								cb2(null, updatedUserMentionObj);
							}
						});							
					}
				}, function (err, userMentions) {
		    	debug(chalkAlert("ASYNC PARALLEL USER MENTIONS CALLBACK"));
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
	    	debug(chalkAlert("ASYNC PARALLEL USER MENTIONS CALLBACK"));
				cb(null, null);
			}
    },

    hashtags: function(cb) {

    	debug(chalkAlert("ASYNC PARALLEL HASHTAGS"));

			if ((newTweet.entities.hashtags) && (newTweet.entities.hashtags.length > 0)) {
				async.concat(newTweet.entities.hashtags, function (htObj, cb2) {

					const currentHt = htObj.text.toLowerCase() ;

					const hashtagObj = new Hashtag({ 
						nodeType: "hashtag",
						nodeId : currentHt,
						hashtagId : currentHt,
						text : currentHt,
						lastSeen : moment().valueOf(),
						mentions : 0
					});

					findOneHashtag(hashtagObj, {inc: newTweet.inc}, function(err, updatedHtObj){
						if (err) { 
							if (err.code !== 11000) {
								console.log(chalkError("ERROR createStreamTweet: hashtags: " + err));
							}
							cb2(err, hashtagObj);
						}
						else{
							cb2(null, updatedHtObj);
						}
					});	
				}, function (err, hashtags) {
		    	debug(chalkAlert("ASYNC PARALLEL HASHTAGS CALLBACK"));
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
	    	debug(chalkAlert("ASYNC PARALLEL HASHTAGS CALLBACK"));
				cb(null, null);
			}
    },

    media: function(cb) {

    	debug(chalkAlert("ASYNC PARALLEL MEDIA"));

			if ((newTweet.entities.media) && (newTweet.entities.media.length > 0)) {
				async.concat(newTweet.entities.media, function (mediaObj, cb2) {

					// const largeImageUrl = meObj.media_url + ":large";  // xlink:xref does like these urls ????
					const defaultImageUrl = mediaObj.media_url + ":thumb" ;

					const meObj = new Media({ 
						nodeType: "media",
						nodeId : mediaObj.id_str, 
						mediaId : mediaObj.id_str, 
						url : defaultImageUrl,
						sourceUrl : tweetObj.url,
						width: parseInt(mediaObj.sizes.large.w),
						height: parseInt(mediaObj.sizes.large.h),
						lastSeen : moment().valueOf(),
						mentions : 0
					});

					meObj.mentions = meObj.mentions+1;

					findOneMedia(meObj, {inc: newTweet.inc}, function(err, updatedMeObj){
						if (err) { 
							if (err.code !== 11000) {
								console.log(chalkError("ERROR createStreamTweet: media: " + err));
							}
							cb2(err, meObj);
						}
						else {
							cb2(null, updatedMeObj);
						}
					});	
				}, function (err, media) {
		    	debug(chalkAlert("ASYNC PARALLEL MEDIA CALLBACK"));
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
	    	debug(chalkAlert("ASYNC PARALLEL MEDIA CALLBACK"));
				cb(null, null);
			}
    },

    urls: function(cb) {

    	debug(chalkAlert("ASYNC PARALLEL URLS"));

			if ((newTweet.entities.urls) && (newTweet.entities.urls.length > 0)) { 
				async.concat(newTweet.entities.urls, function (uObj, cb2) {

					const urlIdArray = (/\w+$/g).exec(uObj.url);  // use end of URL as urlId

					if (urlIdArray && (urlIdArray.length > 0)) {

						const urlId = urlIdArray[0];

						const urlObj = new Url({ 
							urlId : urlId,
							nodeType: "url",
							nodeId : urlId,
							url : uObj.url,
							displayUrl : uObj.display_url,
							expandedUrl : uObj.expanded_url,
							lastSeen : moment().valueOf(),
							mentions : 0
						});

						findOneUrl(urlObj, params, function(err, updatedUrlObj){
							if (err) { 
								if (err.code !== 11000) {
									console.log(chalkError("ERROR createStreamTweet: urls: " + err));
								}
								cb2(err, urlObj);
							}
							else{
								cb2(null, updatedUrlObj);
							}
						});
					}
					else {
						cb2(null, null);
					}
				}, function (err, urls) {
		    	debug(chalkAlert("ASYNC PARALLEL URLS CALLBACK"));
					if (err) {
						debug(chalkError("ERROR createStreamTweet: urls: " + err));
						cb(err, null);
					}
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
	    	debug(chalkAlert("ASYNC PARALLEL URLS CALLBACK"));
				cb(null, null);
			}
    },

    place: function(cb) {
    	debug(chalkAlert("ASYNC PARALLEL PLACE"));

			if (newTweet.place) {
				// console.log(chalkTwitter("\n--- PLACE ---\n" + JSON.stringify(newTweet, null, 3) + "\n"));
				debug(chalkTwitter("PLACE | " + newTweet.place.full_name));

				let placeObj = new Place({ 
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
					lastSeen : moment().valueOf(),
					mentions : 0
				});			

				if (newTweet.place.centroid) {
					placeObj.centroid = newTweet.place.centroid;
				}
				else {
					placeObj.centroid = [];
				}

				findOnePlace(placeObj, {inc: newTweet.inc}, function(err, updatedPlObj){
		    	debug(chalkAlert("ASYNC PARALLEL PLACE CALLBACK"));
					if (err) { 
						if (err.code !== 11000) {
							console.log(chalkError("ERROR createStreamTweet: place: " + err));
						}
						cb(err, placeObj);
					}
					else{
						cb(null, updatedPlObj);
					}
				});
			}
			else {
	    	debug(chalkAlert("ASYNC PARALLEL PLACE CALLBACK"));
				cb(null, null);
			}
    }

	}, function(err, results) {

		if (err) {
			console.log(chalkError("ERROR createStreamTweet" 
				+ "\n" + err
				// + "\nresults\n" + jsonPrint(results)
			));
		}

		debug(chalkError("MID TWEET PARSE"));

		tweetObj.user = results.user;
		tweetObj.userMentions = results.userMentions || [];
		tweetObj.hashtags = results.hashtags || [];
		tweetObj.media = results.media || [];
		tweetObj.urls = results.urls || [];
		tweetObj.place = results.place;

		findOneTweet(tweetObj, params, function(err, twObj){
			if (err) { 
				if (err.code !== 11000) {
					console.log(chalkError("ERROR createStreamTweet: tweet: " + err));
				}
			}
			callback(err, twObj);
		});	
	});
};
