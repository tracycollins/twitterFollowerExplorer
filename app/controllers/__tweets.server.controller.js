/*jslint node: true */
"use strict";

var mangledRegEx = /\u00C3.\u00C2|\u00B5/g;

var enableHashMaps = false ;
var MAX_HASHMAP_COUNT = 1000 ;
var hashtagRxQenabled = false;

var S = require('string');
var chalk = require('chalk');

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTwitter = chalk.blue;
var chalkPlace = chalk.bold.green;

var moment = require('moment');
var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

var Tweet = require('mongoose').model('Tweet');
var Hashtag = require('mongoose').model('Hashtag');
var Media = require('mongoose').model('Media');
var User = require('mongoose').model('User');
var Url = require('mongoose').model('Url');
var Place = require('mongoose').model('Place');

var debug = require('debug')('tweets');

var fs = require('fs');
var http = require('http');
var HashMap = require('hashmap').HashMap;

var Queue = require('queue-fifo');
var hashtagRxQ = new Queue();

var async = require('async');

var DEFAULT_X = 100;
var DEFAULT_Y = 100;

var lastId = '0';

var tweetIdHashMap = new HashMap();
var hashtagHashMap = new HashMap();
var mediaHashMap = new HashMap();
var userHashMap = new HashMap();
var urlHashMap = new HashMap();

var placeHashMap = new HashMap();
var placeHashMapSortedKeyArray = [];

var recentTweetArray = [] ;
var maxRecentTweets = 20 ;

var recentHashtagArray = [] ;
var maxRecentHashtags = 20 ;

var recentPlaceArray = [] ;
var maxRecentPlaces = 20 ;

var recentMediaArray = [];
var maxRecentMedia = 20 ;

var jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
}

function getTimeStamp(inputTime) {
  var currentTimeStamp ;

  if (typeof inputTime === 'undefined') {
    currentTimeStamp = moment();
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime);
  }
  else {
    currentTimeStamp = moment(new Date(inputTime));
  }
  return currentTimeStamp.format(defaultDateTimeFormat);
}

var getErrorMessage = function(err) {
	var message = '';
	if (err.code) {
		switch (err.code) {
			case 11000:
				console.log(getTimeStamp()
					+ " | " + "***** MONGODB DUPLICATE KEY ERROR"
					+ " | " + err
					// + " \n" + jsonPrint(err)
				);
				break;
			case 11001:
				console.log(getTimeStamp() + "\n\n***** MONGODB ERROR: " + err);
				break;
			default:
				message = 'Something went wrong';
		}
	}
	else {
		for (var errName in err.errors) {
			if (err.errors[errName].message)
				message = err.errors[errName].message;
		}
	}

	return message;
};

function findOneUser (user, testMode, io) {

	var inc = 1;
	if (testMode) inc = 0 ;

	var query = { userId: user.userId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						// nodeType: user.nodeType,
						// nodeId: user.nodeId,
						screenName: user.screenName,
						url: user.url,
						profileUrl: user.profileUrl,
						profileImageUrl: user.profileImageUrl,
						status: user.status,
						statusesCount: user.statusesCount,
						followersCount: user.followersCount,
						friendsCount: user.friendsCount,
						lastSeen: Date.now() 
					} 
				};
	var options = { upsert: true, new: true	};

	User.findOneAndUpdate(
		query,
		update,
		options,
		function(err, us) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** USER FINDONE ERROR: " + user.userId + "\n" + err);
				getErrorMessage(err);
				if (err.code == 11000) {
					User.remove({userId: user.userId}, function(err, usDeleted){
						if (err) {
							console.log("REMOVED DUPLICATE USER ERROR " + err + "\n" + user.userId);
						}
						else {
							console.log("REMOVED DUPLICATE USER " + user.userId);
						}
					})
				}
			}
			else {
				debug("> USER UPDATED"
					+ " | ID: " + us.userId 
					+ " | " + us.screenName 
					+ " | TWEETS: " + us.statusesCount 
					+ " | FOLLOWERS: " + us.followersCount 
					+ " | MENTIONS: " + us.mentions 
					+ " | LAST SEEN: " + Date(us.lastSeen) 
					// + " | " + us.profileUrl
					);
				var mentionsString = us.mentions.toString() ;
				us.mentions = mentionsString ;
				if (io) {
					// console.log("IO EMIT USER " + us.nodeId);
					io.of('/admin').emit('node', us);	
					io.of('/client').emit('node', us);	
				}			
			}

		}
	);
}

function findOnePlace (place, testMode, io) {

	var inc = 1;
	if (testMode) inc = 0 ;

	var query = { placeId: place.placeId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
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
						lastSeen: Date.now() 
					} 
				};
	var options = { upsert: true, new: true	};

	Place.findOneAndUpdate(
		query,
		update,
		options,
		function(err, pl) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** PLACE FINDONE ERROR: " + place.placeId + "\n" + err);
				getErrorMessage(err);
				if (err.code == 11000) {
					Place.remove({placeId: place.placeId}, function(err, plDeleted){
						if (err) {
							console.log("REMOVED DUPLICATE PLACE ERROR " + err + "\n" + place.placeId);
						}
						else {
							console.log("REMOVED DUPLICATE PLACE " + place.placeId);
						}
					})
				}
			}
			else {
				debug("> PLACE UPDATED: "
					+ pl.nodeId 
					+ " | MENTIONS: " + pl.mentions 
					+ " | LAST SEEN: " + Date(pl.lastSeen) 
					+ " | " + pl.placeType
					+ " | " + pl.name
					+ " | " + pl.fullName
					+ " | " + pl.countryCode
					+ " | " + pl.country
					+ "\nSOURCE URL: " + pl.sourceUrl
					+ "\nIMAGE URL:  " + pl.imageUrl
					);

				var mentionsString = pl.mentions.toString() ;
				pl.mentions = mentionsString ;

				if (!testMode) recentPlaceArray.push(pl);
				if (recentPlaceArray.length > maxRecentPlaces) recentPlaceArray.shift() ;	

				if (io) {
					debug("IO EMIT PLACE " + pl.nodeId + " | " + pl.fullName);
					io.of('/admin').emit('node', pl);	
					io.of('/client').emit('node', pl);	
				}			
			}

		}
	);
}

function findOneTweet (tweet, testMode, io) {

	var inc = 1;
	if (testMode) inc = 0 ;

	var query = { tweetId: tweet.tweetId  };

	// console.log("findOneTweet: tweet.user: " + JSON.stringify(tweet.user, null, 3));

	var update = { 
		$inc: { mentions: inc }, 
		$set: { 
			nodeType: tweet.nodeType,
			nodeId: tweet.nodeId,
			testMode: tweet.testMode,
			user: tweet.user, 
			url: tweet.url, 
			imageUrl: tweet.imageUrl,
			profileImageUrl: tweet.profileImageUrl,
			place: tweet.place, 
			createdAt: tweet.createdAt, 
			text: tweet.text,  
			lastSeen: Date.now(), 
			retweeted: tweet.retweeted, 
			retweetedStatus: tweet.retweetedStatus, 
			retweets: tweet.retweets, 
			favorites: tweet.favorites, 
			isRetweet: tweet.isRetweet, 
			retweetedId: tweet.retweetedId,
			hashtags: tweet.hashtags, 
			media: tweet.media, 
			urls: tweet.urls, 
			status: tweet.status 
		} 
	};

	var options = { upsert: true, new: true	};

	Tweet.findOneAndUpdate(
		query,
		update,
		options,
		function(err, tw) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** TWEET FINDONE ERROR: " + tweet.tweetId + "\n" + err);
				getErrorMessage(err);
				console.log(chalkTwitter("tweet: " + JSON.stringify(tweet, null, 3)));
				if (err.code == 11000) {
					Tweet.remove({tweetId: tweet.tweetId}, function(err, twDeleted){
						if (err) {
							console.log("REMOVED DUPLICATE TWEET ERROR " + err + "\n" + tweet.tweetId);
						}
						else {
							console.log("REMOVED DUPLICATE TWEET " + tweet.tweetId);
						}
					});
				}
			}
			else {

				tw.test = "TEST" ;
				tw.x = DEFAULT_X ;
				tw.y = DEFAULT_Y ;

				var textReformatted = tw.text.replace('\n', ' ') ;

				// console.log("tw: " + JSON.stringify(tw, null, 3));

				debug("> TWEET UPDATED [" + tw.tweetId + "]"
					+ " " + tw.createdAt 
					+ "|UID: " + tw.user.userId + " | @" + tw.user.screenName
					+ "|IURL: " + tw.imageUrl 
					+ "|RTs: " + tw.retweets 
					+ "|isRT: " + tw.isRetweet 
					+ "|RTID: " + tw.retweetedId 
					+ "|RTd: " + tw.retweeted 
					+ "|MTNs: " + tw.mentions 
					+ "|FAVs: " + tw.favorites 
					+ "|LAST SEEN: " + Date(tw.lastSeen) 
					+ "\n " + textReformatted
					);

				if (testMode && (tw.mentions == 0)){
					console.log("+ N A TW " + tw.tweetId
						+ " " + getTimeStamp(tw.createdAt) 
						// + " | M: " + tw.mentions 
						// + " | F: " + tw.favorites 
						// + " | U: " + tw.user.userId + " | @" + tw.user.screenName
					);
				}
				else if (testMode && (tw.mentions > 0)){
					console.log("- F A TW " + tw.tweetId
						+ " " + getTimeStamp(tw.createdAt) 
						// + " | M: " + tw.mentions 
						// + " | F: " + tw.favorites 
						// + " | U: " + tw.user.userId + " | @" + tw.user.screenName
					);
				}

				recentTweetArray.push(tw);
				if (recentTweetArray.length > maxRecentTweets) recentTweetArray.shift() ;	

				if (io) {
					// console.log("IO EMIT TWEET " + tw.nodeId);
					io.emit('node', tw);	
					io.of('/admin').emit('node', tw);	
					io.of('/client').emit('node', tw);	
					io.of('/util').emit('node', tw);	
					io.of('/util').in("meta").emit('node', tw);	
				}
			}

		}
	);
}

function findOneMedia (media, testMode, io) {

	var inc = 1;
	if (testMode) inc = 0 ;

	var query = { mediaId: media.mediaId };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
							nodeType: media.nodeType,
							nodeId: media.nodeId,
							url: media.url, 
							sourceUrl: media.sourceUrl, 
							// filePath: media.filePath, 
							width: parseInt(media.width), 
							height: parseInt(media.height), 
							lastSeen: Date.now() 
						} 
					};
	var options = { upsert: true, new: true	};

	Media.findOneAndUpdate(
		query,
		update,
		options,
		function(err, me) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** MEDIA FINDONE ERROR: " + media.mediaId + "\n" + err);
				getErrorMessage(err);
				if (err.code == 11000) {
					Media.remove({mediaId: media.mediaId}, function(err, meDeleted){
						if (err) {
							console.log("REMOVED DUPLICATE MEDIA ERROR " + err + "\n" + media.mediaId);
						}
						else {
							console.log("REMOVED DUPLICATE MEDIA " + media.mediaId);
						}
					})
				}
			}
			else {
				debug("> MEDIA UPDATED [" + me.mediaId + "]" 
					+ " MTNs: " + me.mentions 
					+ " LAST SEEN: " + Date(me.lastSeen)
					+ " SRC URL: " + me.sourceUrl
					+ " " + me.width + " x " + me.height 
					+ " " + me.url 
					// + "\n      " + me.filePath
					);
				// if (typeof me.width != 'number') {
				// 	console.log(chalkTwitter("*** WIDTH IS TYPE " + typeof me.width));
				// }
				var mentionsString = me.mentions.toString() ;
				me.mentions = mentionsString ;

				recentMediaArray.push(me);
				if (recentMediaArray.length > maxRecentMedia) recentMediaArray.shift();	

				if (io) {
					// console.log("IO EMIT MEDIA " + me.nodeId);
					io.of('/admin').emit('node', me);	
					io.of('/client').emit('node', me);	
				}		
			}
		}
	);
}

function findOneHashtag (hashtag, testMode, io) {

	var inc = 1;
	if (testMode) inc = 0 ;

	var query = { text: hashtag.text.toLowerCase() };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						nodeType: hashtag.nodeType,
						nodeId: hashtag.nodeId,
						lastSeen: Date.now() 
					} 
				};
	var options = { upsert: true, new: true	};

	Hashtag.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ht) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** HASHTAG FINDONE ERROR: " + hashtag.text + "\n" + err);
				getErrorMessage(err);
				if (err.code == 11000) {
					Hashtag.remove({text: hashtag.text.toLowerCase()}, function(err, htDeleted){
						if (err) {
							console.log("REMOVED DUPLICATE HASHTAG ERROR " + err + "\n" + hashtag.text.toLowerCase());
						}
						else {
							console.log("REMOVED DUPLICATE HASHTAG " + hashtag.text.toLowerCase());
						}
					})
				}
			}
			else {
				debug("> HASHTAG UPDATED" 
					+ "|" + ht.nodeId 
					+ "|MTNs: " + ht.mentions 
					+ "|LAST SEEN: " + Date(ht.lastSeen) 
					+ "|" + ht.text
					);
				var mentionsString = ht.mentions.toString() ;
				ht.mentions = mentionsString ;
				if (enableHashMaps && (hashtagHashMap.count() < MAX_HASHMAP_COUNT)) {
					hashtagHashMap.set(ht.text.toLowerCase(), ht);
				}

				recentHashtagArray.push(ht);
				if (recentHashtagArray.length > maxRecentHashtags) recentHashtagArray.shift();	
				if (io) {
					io.of('/admin').emit('node', ht);	
					io.of('/client').emit('node', ht);	
				}		
			}
		}
	);
}

function findOneUrl (url, testMode, io) {

	var inc = 1;
	if (testMode) inc = 0 ;

	var query = { urlId: url.urlId };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						nodeType: url.nodeType,
						// urlId: url.urlId,
						nodeId: url.nodeId,
						url: url.url,
						displayUrl: url.displayUrl,
						expandedUrl: url.expandedUrl,
						lastSeen: Date.now() 
					} 
				};
	var options = { upsert: true, new: true	};

	Url.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ur) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** URL FINDONE ERROR: " + url.urlId + "\n" + err);
				getErrorMessage(err);
				if (err.code == 11000) {
					Url.remove({urlId: url.urlId}, function(err, urDeleted){
						if (err) {
							console.log("REMOVED DUPLICATE URL ERROR " + err + "\n" + url.urlId);
						}
						else {
							console.log("REMOVED DUPLICATE URL " + url.urlId);
						}
					})
				}
			}
			else {
				debug("> URL UPDATED" 
					+ " | " + ur.urlId 
					+ " | " + ur.nodeId 
					+ " | " + ur.url 
					+ " | " + ur.displayUrl 
					+ " | " + ur.expandedUrl 
					+ " | MTNS: " + ur.mentions 
					+ " | LAST SEEN: " + Date(ur.lastSeen) 
					);
				var mentionsString = ur.mentions.toString() ;
				ur.mentions = mentionsString ;

				if (io) {
					// console.log("IO EMIT URL " + ur.nodeId);
					io.of('/admin').emit('node', ur);	
					io.of('/client').emit('node', ur);
				}		
			}
		}
	);
}

exports.sendTweet = function(tId, testEvents) {

	debug(chalkTwitter("sendTweet: tId: " + tId));

	var query = {} ;

	if (tId == 0) {
		query = { 
			nodeType: 'tweet'
		};
	}
	else {
		query = { 
			nodeType: 'tweet',
			tweetId: {$gt: tId}
		};
	}

	var results = Tweet.findOne(
		query,
		function(err, tw) {
			if (err) {
				console.log(getTimeStamp() + "\n\n***** !!! TWEET FINDONE ERROR: \n" + err);
				getErrorMessage(err);
				return 0;
			}
			else if (tw) {

				tw.nodeId = tw.tweetId;
				tw.lastSeen = Date.now();

				var screenName = '';

				if (typeof tw.user !== 'undefined'){
					if (typeof tw.user.screenName !== 'undefined'){
						screenName = tw.user.screenName;
					}
				}

				console.log(chalkTwitter(">>> sendTweet " + tw.tweetId
					+ " " + tw.createdAt 
					+ " @" + screenName
					+ " RT " + tw.retweets 
					+ " MN " + tw.mentions 
					+ " FV " + tw.favorites 
					+ " HT " + tw.hashtags.length 
				));

				if (tw.place){
					debug(chalkPlace("\n--- PLACE ---\n" + JSON.stringify(tw.place, null, 3) + "\n"));
				}

				testEvents.emit('node', tw);				
				return tw;	
			}	
			else {
				console.log(chalkTwitter("... NO TWEET FOUND FOR ID: " + tId));

			}		
		})

	return results	;
};

exports.renderTweet = function(req, res) {
	Tweet.findOne({}, function(err, tweet) {
	res.render('tweet', {
			title: 'STREAM TWEET',
			tweetId: tweet.tweetId,
			text: tweet.text
		});
	});
};

function acceptableHashtag(ht, mHashMap){
	var acceptable = !ht.match(mangledRegEx);

	if (!acceptable) {
    mHashMap.set(ht, 1);
		console.log(chalkAlert("NOT acceptable: " + acceptable + " | " + ht));
  }
  else{
		debug("acceptable: " + acceptable + " | " + ht);
  }
	return acceptable;
}

function isPossibleHashtag(ht){
	return ( S(ht).endsWith('matter') ||  S(ht).endsWith('matters') ||  S(ht).endsWith('mattered') || S(ht).endsWith('mattering') );
}

exports.createStreamTweet = function(params, callback) {	

	var newTweet = params.tweetStatus;
	var io = params.io;
	var searchTermHashMapDisabled = params.searchTermHashMapDisabled;
	var searchTermHashMap = params.searchTermHashMap;
	var mangledSearchTermHashMap = params.mangledSearchTermHashMap;
	var possibleSearchTermHashMap = params.possibleSearchTermHashMap;
	var blacklistSearchTermHashMap = params.blacklistSearchTermHashMap;
	var configEvents = params.configEvents;

	var tweetObj ;
	var profileImageUrl = newTweet.user.profile_image_url;

	if (enableHashMaps && tweetIdHashMap.has(newTweet.id_str)) {
		tweetObj = tweetIdHashMap.get(newTweet.id_str) ;
		tweetObj.testMode = newTweet.testMode ;
		tweetObj.nodeType = 'tweet';  //  if reading stale db data, from before this was implemented
		tweetObj.url = "http://twitter.com/" + newTweet.user.screen_name + "/status/" + newTweet.id_str;
		tweetObj.profileImageUrl = profileImageUrl;
		tweetObj.lastSeen = Date.now();
		tweetObj.mentions++ ;
		tweetObj.retweets = newTweet.retweet_count ;
		tweetObj.favorites = newTweet.favorite_count ;
	}
	else {
		tweetObj = new Tweet({ 
			nodeType: 'tweet',
			testMode: newTweet.testMode,
			nodeId : newTweet.id_str, 
			tweetId : newTweet.id_str, 
			url: "http://twitter.com/" + newTweet.user.screen_name + "/status/" + newTweet.id_str,
			profileImageUrl: profileImageUrl,
			createdAt : newTweet.created_at, 
			lastSeen : Date.now(),
			retweeted : newTweet.retweeted, 
			retweets : newTweet.retweet_count, 
			favorites : newTweet.favorite_count, 
			text : newTweet.text,
			status : newTweet
		});

		if (newTweet.retweeted_status) {
			tweetObj.isRetweet = true;
			tweetObj.retweetedId = newTweet.retweeted_status.id_str;
			tweetObj.retweetedStatus = newTweet.retweeted_status;
		}

		if (enableHashMaps && (tweetIdHashMap.count() < MAX_HASHMAP_COUNT)) {
			tweetIdHashMap.set(tweetObj.tweetId, tweetObj);			
		}
	}

	var userObj ;

	if (enableHashMaps && userHashMap.has(newTweet.user.id_str)) {

		userObj = userHashMap.get(newTweet.user.id_str) ;
		userObj.nodeType = 'user';  //  if reading stale db data, from before this was implemented
		userObj.nodeId = newTweet.user.id_str;  //  if reading stale db data, from before this was implemented
		userObj.userId = newTweet.user.id_str;  //  if reading stale db data, from before this was implemented
		userObj.screenName = newTweet.user.screen_name;  //  if reading stale db data, from before this was implemented
		userObj.url = newTweet.user.url;  
		userObj.profileUrl = "http://twitter.com/" + newTweet.user.screen_name;  
		userObj.profileImageUrl = profileImageUrl;  
		userObj.verified = newTweet.user.verified;  
		userObj.description = newTweet.user.description;  
		userObj.lastSeen = Date.now();
		userObj.mentions++ ;
		userObj.statusesCount = newTweet.user.statuses_count;
		userObj.friendsCount = newTweet.user.friends_count;
		userObj.followersCount = newTweet.user.followers_count;

		findOneUser(userObj, newTweet.testMode, io);	
		tweetObj.user = userObj ;
	}
	else {

		userObj = new User({ 
							userId : newTweet.user.id_str , 
							screenName : newTweet.user.screen_name,
							url: newTweet.user.url,
							profileUrl: "http://twitter.com/" + newTweet.user.screen_name,
							profileImageUrl: profileImageUrl,
							verified: newTweet.user.verified,
							description: newTweet.user.description,
							createdAt : newTweet.created_at, 
							lastSeen : Date.now(),
							statusesCount : newTweet.user.statuses_count,
							friendsCount : newTweet.user.friends_count,
							followersCount : newTweet.user.followers_count,
							mentions : 0
						});

		findOneUser(userObj, newTweet.testMode, io);	
		tweetObj.user = userObj ;

		if (enableHashMaps && (userHashMap.count() < MAX_HASHMAP_COUNT)) {
			userHashMap.set(userObj.nodeId, userObj);	
		}		
	}
	
	// URLs

	var numUrls = newTweet.entities.urls.length;
	var urlId ;
	var urlObj ;

	for (var i = 0; i < numUrls; i++) {

		debug("newTweet.entities.urls[i]: " + jsonPrint(newTweet.entities.urls[i]));
		debug("newTweet.entities.urls[i].url: " + newTweet.entities.urls[i].url);

		var urlIdArray = (/\w+$/g).exec(newTweet.entities.urls[i].url);  // use end of URL as urlId

		debug("urlIdArray\n" + jsonPrint(urlIdArray));

		if (urlIdArray){
			urlId = urlIdArray[0];

			// console.log(chalkTwitter("\n URL: urlId: " + urlId);

			if (enableHashMaps && urlHashMap.has(urlId)) {
				urlObj = urlHashMap.get(urlId) ;
				urlObj.urlId = urlId;  //  if reading stale db data, from before this was implemented
				urlObj.nodeId = urlId;  //  if reading stale db data, from before this was implemented
				urlObj.nodeType = 'url';  //  if reading stale db data, from before this was implemented
				urlObj.lastSeen = Date.now();
			}
			else {

				urlObj = new Url({ 
										urlId : urlId,
										nodeType: 'url',
										nodeId : urlId,
										url : newTweet.entities.urls[i].url,
										displayUrl : newTweet.entities.urls[i].display_url,
										expandedUrl : newTweet.entities.urls[i].expanded_url,
										lastSeen : Date.now(),
										mentions : 0
									});

				if (enableHashMaps && (urlHashMap.count() < MAX_HASHMAP_COUNT)) {
					urlHashMap.set(urlId, urlObj);	
				}		
			}

			findOneUrl(urlObj, newTweet.testMode, io);	
			tweetObj.urls[i] = urlObj ;
		}
	}

	// HASHTAGS

	var numHashtags = newTweet.entities.hashtags.length;
	var hashtagObj ;

	for (var i = 0; i < numHashtags; i++) {

		var currentHt = newTweet.entities.hashtags[i].text.toLowerCase() ;

		if (hashtagRxQenabled){
			hashtagRxQ.enqueue({hashtag: newTweet.entities.hashtags[i].text.toLowerCase(), second: Date.now()});
			debug(chalkTwitter(Date.now() + " | hashtagRxQ [" + hashtagRxQ.size() + "]: " + newTweet.entities.hashtags[i].text.toLowerCase()));
		}
		else {
			debug(chalkTwitter(Date.now() + " | " + newTweet.entities.hashtags[i].text.toLowerCase()));
		}

		if (!searchTermHashMapDisabled && acceptableHashtag(currentHt, mangledSearchTermHashMap)){

			if (!searchTermHashMap.has(currentHt) 
				&& !mangledSearchTermHashMap.has(currentHt)
				&& !blacklistSearchTermHashMap.has(currentHt)
				&& !possibleSearchTermHashMap.has(currentHt)
				&& isPossibleHashtag(currentHt)
				){
				var searchTermObj = {
					source: 'TWITTER',
					url: tweetObj.url,
					hashtag: currentHt
				};

				console.log(chalkAlert("??? POSSIBLE NEW SEARCH TERM HASHTAG: " + currentHt));
				configEvents.emit('POSSIBLE_SEARCH_TERM', JSON.stringify(searchTermObj));
			}
			else{
				debug(chalkInfo("... MATTER HASHTAG MATCH KNOWN: " + currentHt));
			}
		}

		if (enableHashMaps && hashtagHashMap.has(currentHt)) {
			hashtagObj = hashtagHashMap.get(currentHt) ;
			hashtagObj.nodeType = 'hashtag';  //  if reading stale db data, from before this was implemented
			hashtagObj.lastSeen = Date.now();
		}
		else {
			hashtagObj = new Hashtag({ 
									nodeType: 'hashtag',
									nodeId : currentHt,
									hashtagId : currentHt,
									text : currentHt,
									lastSeen : Date.now(),
									mentions : 0
								});

			if (enableHashMaps && (hashtagHashMap.count() < MAX_HASHMAP_COUNT)) {
				hashtagHashMap.set(hashtagObj.text.toLowerCase(), hashtagObj);	
			}		
		}

		findOneHashtag(hashtagObj, newTweet.testMode, io);	
		tweetObj.hashtags[i] = hashtagObj ;
	}

	// MEDIA

	var meObj ;

	if (newTweet.entities.media) {
		var numMedia = newTweet.entities.media.length;

		if (numMedia > 1) {
			debug("numMedia: " + numMedia);
		}
		
		for (var i = 0; i < numMedia; i++) {

			if (enableHashMaps && mediaHashMap.has(newTweet.entities.media[i].id_str)) {
				meObj = mediaHashMap.get(newTweet.entities.media[i].id_str) ;
				meObj.nodeType = 'media';  //  if reading stale db data, from before this was implemented
				meObj.lastSeen = Date.now();
			}
			else {

				// var largeImageUrl = newTweet.entities.media[i].media_url + ':large';  // xlink:xref does like these urls ????
				var defaultImageUrl = newTweet.entities.media[i].media_url ;
	
				meObj = new Media({ 
								nodeType: 'media',
								nodeId : newTweet.entities.media[i].id_str, 
								mediaId : newTweet.entities.media[i].id_str, 
								url : defaultImageUrl,
								sourceUrl : tweetObj.url,
								width: parseInt(newTweet.entities.media[i].sizes.large.w),
								height: parseInt(newTweet.entities.media[i].sizes.large.h),
								lastSeen : Date.now(),
								mentions : 0
							});

				if (enableHashMaps && (mediaHashMap.count() < MAX_HASHMAP_COUNT)) {
					mediaHashMap.set(meObj.mediaId, meObj);		
				}	
			}

			findOneMedia(meObj, newTweet.testMode, io);
			meObj.mentions = meObj.mentions+1;
			tweetObj.media[i] = meObj ;
			// tweetObj.media.push(meObj) ;
			tweetObj.imageUrl = newTweet.entities.media[0].media_url ;
		}
	}
	else {
		tweetObj.media = [];
	}


	// PLACE

	var placeObj ;
	tweetObj.place = placeObj ;

	if (newTweet.place) {

		// console.log(chalkTwitter("\n--- PLACE ---\n" + JSON.stringify(newTweet, null, 3) + "\n"));
		debug(chalkTwitter("PLACE | " + newTweet.place.full_name));

		if (enableHashMaps && placeHashMap.has(newTweet.place.id)) {
			placeObj = placeHashMap.get(newTweet.place.id) ;
			placeObj.nodeType = 'place';  
			placeObj.placeId = newTweet.place.id;  
			placeObj.nodeId = newTweet.place.id;  
			if (newTweet.place.centroid) {
				placeObj.centroid = newTweet.place.centroid;
			}
			else {
				placeObj.centroid = [];
			}
			placeObj.boundingBox = newTweet.place.bounding_box;
			placeObj.name = newTweet.place.name;
			placeObj.fullName = newTweet.place.full_name;
			placeObj.countryCode = newTweet.place.country_code;
			placeObj.country = newTweet.place.country;
			placeObj.placeType = newTweet.place.place_type;
			placeObj.url = newTweet.place.url;
			placeObj.sourceUrl = tweetObj.url; // this is overwritten by the lastest tweet's url
			placeObj.imageUrl = tweetObj.imageUrl;
			placeObj.lastSeen = Date.now();
			placeObj.mentions++;
		}
		else {
			placeObj = new Place({ 
				nodeType: 'place',
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
		}

		if (enableHashMaps && (placeHashMap.count() < MAX_HASHMAP_COUNT)) {
			placeHashMap.set(placeObj.placeId, placeObj);	
		}		

		findOnePlace(placeObj, newTweet.testMode, io);	
		tweetObj.place = placeObj ;
	}

	findOneTweet(tweetObj, newTweet.testMode, io);	
	// CHECK IF TWEET IS RETWEET

	if (newTweet.retweeted_status) {

		var sourceTweetObj;

		profileImageUrl = newTweet.retweeted_status.user.profile_image_url.replace(/_normal/i, '');

		debug(chalkTwitter("    SRC: " + newTweet.retweeted_status.id_str + " @" + newTweet.retweeted_status.user.screen_name));

		if (enableHashMaps && tweetIdHashMap.has(newTweet.retweeted_status.id_str)) {
			sourceTweetObj = tweetIdHashMap.get(newTweet.retweeted_status.id_str) ;
			sourceTweetObj.nodeType = 'tweet';  //  if reading stale db data, from before this was implemented
			sourceTweetObj.testMode = newTweet.testMode;
			sourceTweetObj.text = newTweet.retweeted_status.text;  //  get original text
			sourceTweetObj.retweets = newTweet.retweeted_status.retweet_count;  //  if reading stale db data, from before this was implemented
			sourceTweetObj.lastSeen = Date.now();

			if (enableHashMaps && userHashMap.has(newTweet.retweeted_status.user.id_str)){
				sourceTweetObj.user = userHashMap.get(newTweet.retweeted_status.user.id_str) ;
			}
			else {
				sourceTweetObj.user = {
					userId: newTweet.retweeted_status.user.id_str,
					nodeId: newTweet.retweeted_status.user.id_str,
					nodeType: "user",
					screenName: newTweet.retweeted_status.user.screen_name,
					url: newTweet.retweeted_status.user.url,
					profileUrl: "http://twitter.com/" + newTweet.retweeted_status.user.screen_name,
					profileImageUrl: profileImageUrl,
					verified: newTweet.retweeted_status.user.verified,
					createdAt: newTweet.retweeted_status.user.created_at,
					description: newTweet.retweeted_status.user.description,
					lastSeen: Date.now(),
					statusesCount: newTweet.retweeted_status.user.statuses_count,
					followersCount: newTweet.retweeted_status.user.followers_count,
					friendsCount: newTweet.retweeted_status.user.friends_count,
					mentions: 0
				}

				if (enableHashMaps && (userHashMap.count() < MAX_HASHMAP_COUNT)) {
					userHashMap.set(sourceTweetObj.user.nodeId, sourceTweetObj.user);
				}
			}

			findOneUser(sourceTweetObj.user, newTweet.testMode, io);	
			findOneTweet(sourceTweetObj, newTweet.testMode, io);	
		}
		else {
			sourceTweetObj = new Tweet({ 
								type: 'tweet',
								testMode: newTweet.testMode, 
								nodeId : newTweet.retweeted_status.id_str, 
								tweetId : newTweet.retweeted_status.id_str, 
								url: "http://twitter.com/" + newTweet.retweeted_status.user.screen_name + "/status/" + newTweet.retweeted_status.id_str,
								createdAt : newTweet.retweeted_status.created_at, 
								lastSeen : Date.now(),
								retweets : newTweet.retweeted_status.retweet_count, 
								favorites : newTweet.retweeted_status.favorite_count,
								text : newTweet.retweeted_status.text,
								status : newTweet.retweeted_status
							});

			if (enableHashMaps && userHashMap.has(newTweet.retweeted_status.user.id_str)){
				sourceTweetObj.user = userHashMap.get(newTweet.retweeted_status.user.id_str) ;
			}
			else {
				sourceTweetObj.user = {
					userId: newTweet.retweeted_status.user.id_str,
					nodeId: newTweet.retweeted_status.user.id_str,
					nodeType: "user",
					screenName: newTweet.retweeted_status.user.screen_name,
					url: newTweet.retweeted_status.user.url,
					profileUrl: "http://twitter.com/" + newTweet.retweeted_status.user.screen_name,
					profileImageUrl: profileImageUrl,
					verified: newTweet.retweeted_status.user.verified,
					createdAt: newTweet.retweeted_status.user.created_at,
					description: newTweet.retweeted_status.user.description,
					lastSeen: Date.now(),
					statusesCount: newTweet.retweeted_status.user.statuses_count,
					followersCount: newTweet.retweeted_status.user.followers_count,
					friendsCount: newTweet.retweeted_status.user.friends_count,
					mentions: 0
				}

				if (enableHashMaps && (userHashMap.count() < MAX_HASHMAP_COUNT)) {
					userHashMap.set(sourceTweetObj.user.nodeId, sourceTweetObj.user);
				}
			}

			for (var i = 0; i < tweetObj.urls.length; i++) {
				sourceTweetObj.urls[i] = tweetObj.urls[i];
			}
			
			for (var i = 0; i < tweetObj.hashtags.length; i++) {
				sourceTweetObj.hashtags[i] = tweetObj.hashtags[i];
			}
			
			for (var i = 0; i < tweetObj.media.length; i++) {
				sourceTweetObj.media[i] = tweetObj.media[i];
			}
			
			if (enableHashMaps && (tweetIdHashMap.count() < MAX_HASHMAP_COUNT)) {
				tweetIdHashMap.set(sourceTweetObj.tweetId, tweetObj);		
			}
				
			findOneUser(sourceTweetObj.user, newTweet.testMode, io);	
			findOneTweet(sourceTweetObj, newTweet.testMode, io);	
		}
	}

	if (typeof callback !== 'undefined'){
		callback(null, tweetObj);
	}
};

exports.tweetByExactID = function(id, callback) {
	if (tweetIdHashMap.has(id)){
		var tweet = tweetIdHashMap.get(id);
		debug("@@@-> tweetByExactID (HashMap): REQ ID: " + id + " | RES ID:" + tweet.tweetId + " | TEXT: " + tweet.text);
		callback(tweet);
	}			
	else {
		debug("@@@-> tweetByExactID NOT IN HASHMAP ... DB SEACH: REQ ID: " + id);
		Tweet.findOne({
				tweetId: id
			}, 
			function(err, reqTweet) {
				if (err) {
					console.log("***** DB ERROR: tweetByExactID: " + id + "\n" + err);
					return callback(err);
				}
				else if (reqTweet) {
					debug("@@@-> tweetByExactID (DB): REQ ID: " + id 
						+ " | FOUND " + reqTweet.tweetId
					);
		
					var textReformatted = reqTweet.text.replace('\n', ' ') ;
					textReformatted = textReformatted.replace('\r', ' ') ;

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
	}
};

exports.tweetByID = function(options, callback) {

		console.log("options\n" + jsonPrint(options));

	var startMoment;
	var endMoment;

	if (typeof options.limit === 'undefined') options.limit = 100;

	if (typeof options.startMoment !== 'undefined') {
		startMoment = moment.utc(new Date(options.startMoment));
	}
	else {
		startMoment = moment.utc("2000-01-01T00:00:00+00:00")
	}

	if (typeof options.endMoment !== 'undefined') {
		endMoment = moment.utc(options.endMoment);
	}
	else {
		endMoment = moment.utc();
	}

	if (tweetIdHashMap.has(options.id)){

		var tweet = tweetIdHashMap.get(options.id);

		debug("<R TW DB"
			+ " | ID:" + tweet.tweetId 
			+ " | " + getTimeStamp(tweet.createdAt)
			+ " | TEXT: " + tweet.text
			);

		// callback function expects an array of tweets, so create a one-element array

		if (moment(new Date(tweet.createdAt)).isBefore(endMoment)) {
			callback(null, [tweet]);
		}
		else{
			callback(null, null);
		}
	}			
	else {

		// debug("@@@-> tweetByID NOT IN HASHMAP ... DB SEACH: REQ ID: " + id + " | LIMIT: " + limit);

		debug(">S TW DB"
			+ " | " + options.id 
			+ " | LIM " + options.limit
		);

		var query = {};
		query = { 
			tweetId: {$gt: options.id.toString()},
			createdAt: { $gte: startMoment, $lt: endMoment} 
		};

		console.log("query\n" + jsonPrint(query));

		Tweet.find(
			query, 
			function(err, reqTweets) {
				if (err) {
					console.log("***** DB ERROR: tweetByID: " + options.id + "\n" + err);
					return callback(err, options.id);
				}
				else if (reqTweets.length > 0) {

					debug("reqTweets length: " + reqTweets.length);

					// console.log("reqTweets" + reqTweets.join("\n"));

					debug("<R TW DB"
						+ " | REQ " + options.id 
						+ " | FOUND " + reqTweets[0].tweetId
						+ " | Ts " + reqTweets.length
					);

					for (var i=0; i<reqTweets.length; i++){
		
						var textReformatted = reqTweets[i].text.replace('\n', ' ') ;
						textReformatted = textReformatted.replace('\r', ' ') ;

						debug("@@@-> TBID"
							+ " | " + reqTweets[i].tweetId 
							+ " | " + getTimeStamp(reqTweets[i].createdAt)
							+ " | " + textReformatted.substring(0,20)
							);
					}
					callback(null, reqTweets) ;
				}
				else {
					// debug("\n$$$$$ tweetByID $$$$$\n" + JSON.stringify(tweet, null, 3));
					debug("-R TW DB | NOT FOUND: REQ: " + options.id);
					callback(null, reqTweets) ;
				}
			}
		).limit(options.limit).sort({tweetId: options.sort});
	}
};

// find 1st tweet after or equal to date
exports.tweetByTimeStamp = function(reqDate, lim, callback) {

	var limit = 100;

	if (typeof callback === 'undefined'){
		callback = lim;
	}
	else {
		limit = parseInt(lim);
	}

	var reqMoment;


	if (moment.isMoment(reqDate)) {
		reqMoment = moment(reqDate);
	}
	else {
		reqMoment = moment(new Date(parseInt(reqDate)));
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
				$gte: reqMoment
			}
		},
		function(err, reqTweets) {
			if (err) {
				console.log("***** DB ERROR: tweetByTimeStamp: " + reqDate + "\n" + err);
				return callback(err, null);
			}
			else if (reqTweets) {

				console.log("@@@-> TBTS"
					+ " | Ts: " + reqTweets.length 
				);

				for (var i=0; i<reqTweets.length; i++){
	
					var textReformatted = reqTweets[i].text.replace('\n', ' ') ;
					textReformatted = textReformatted.replace('\r', ' ') ;

					debug("@@@-> TBTS"
						+ " | " + reqTweets[i].tweetId 
						+ " | " + getTimeStamp(reqTweets[i].createdAt)
						+ " | " + textReformatted.substring(0,20)
					);
				}
				callback(null, reqTweets) ;
			}
			else {
				console.log("@@@-> tweetByTimeStamp: TWEET NOT FOUND: " + reqDate);
				callback(null, null) ;
			}
		}
	).limit(limit).sort({tweetId: 1});
};

exports.update = function(req, res, next) {
	Tweet.findByIdAndUpdate(req.tweet.id, req.body, function(err, tweet) {
		if (err) {
			return next(err);
		}
		else {
			res.json(tweet);
		}
	});
};

exports.delete = function(req, res, next) {
	req.tweet.remove(function(err) {
		if (err) {
			return next(err);
		}
		else {
			res.json(req.tweet);
		}
	})
};

exports.getHashMap = function(type, callback){
	switch (type) {
		case 'HASHTAG' :
			callback(hashtagHashMap);
		break;
		case 'USER' :
			callback(userHashMap);
		break;
		case 'URL' :
			callback(urlHashMap);
		break;
		case 'MEDIA' :
			callback(mediaHashMap);
		break;
		case 'PLACE' :
			callback(placeHashMap);
		break;
		default:
			callback(null);
		break;
	}
};


exports.getHashMapCounts = function(){
	var hashMapCountObj = {
		'HASHTAG' : hashtagHashMap.count(),
		'USER' : userHashMap.count(),
		'URL' : urlHashMap.count(),
		'MEDIA' : mediaHashMap.count(),
		'PLACE' : placeHashMap.count()
	}
	return hashMapCountObj;
};


