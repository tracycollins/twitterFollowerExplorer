/*jslint node: true */
"use strict";

var enableHashMaps = 1 ;
var MAX_HASHMAP_COUNT = 1000 ;

var S = require('string');
var chalk = require('chalk');

var chalkAdmin = chalk.bold.blue;

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkConnect = chalk.bold.green;
var chalkConnectAdmin = chalk.bold.cyan;
var chalkDisconnect = chalk.blue;
var chalkInstagram = chalk.green;

var IgMedia = require('mongoose').model('IgMedia');
var IgUser = require('mongoose').model('IgUser');
var IgTag = require('mongoose').model('IgTag');
var IgPlace = require('mongoose').model('IgPlace');

var debug = require('debug')('ig');

var HashMap = require('hashmap').HashMap;

var mediaHashMap = new HashMap();
var linkHashMap = new HashMap(); 
var userHashMap = new HashMap();
var urlHashMap = new HashMap();
var placeHashMap = new HashMap();
var nodeHashMap = new HashMap() ;

var placeHashMapSortedKeyArray = [];
var recentPlaceArray = [] ;

var maxRecentPlaces = 20 ;

var EventEmitter = require("events").EventEmitter;
var configEvents = new EventEmitter();


var childProcess = require("child_process");
var child_sortHashmapKeys = childProcess.fork("sortHashmapKeys");
var topHashtagsArray = [] ;
var topMediaArray = [];

child_sortHashmapKeys.on('message', function(sObj){
  var sortedObj = JSON.parse(sObj);
  console.log(chalkInstagram("child_sortHashmapKeys: TYPE: " + sortedObj.type + " | RCVD " + sortedObj.keys.length + " KEYS"));

  switch (sortedObj.type) {
    case 'HASHTAG':
      hashtagHashMapSortedKeyArray = sortedObj.keys ;
      break;
    case 'PLACE':
      placeHashMapSortedKeyArray = sortedObj.keys ;
      break;
    case 'MEDIA':
      mediaHashMapSortedKeyArray = sortedObj.keys ;
      break;
    default:
  }
});

configEvents.on("hashtagHashMapInit_DONE", function(){
  child_sortHashmapKeys.send(JSON.stringify({'type': 'HASHTAG', 'hashmap': hashtagHashMap}));
});

configEvents.on("placeHashMapInit_DONE", function(){
  child_sortHashmapKeys.send(JSON.stringify({'type': 'PLACE', 'hashmap': placeHashMap}));
});

configEvents.on("mediaHashMapInit_DONE", function(){
  child_sortHashmapKeys.send(JSON.stringify({'type': 'MEDIA', 'hashmap': mediaHashMap}));
});

function getTotalInstagrams(callback){
  IgMedia.count({}, function(err, count) {
    if (!err){ 
      debug("TOTAL INSTAGRAM MEDIA: " + count);
      callback(null, count);
    } 
    else {
      console.error(chalkError("\n*** getTotalInstagrams: DB IgMedia.count ERROR *** | " + getTimeStamp() + "\n" + err));
      callback(err, null);
    }
  });
}

function getInstagramSubs(callback){
  instagramClient.subscriptions(function(err, subscriptions, remaining, limit){
    if (err){
      console.error(chalkError("\nERROR getInstagramSubs\n" + err));
      configEvents.emit("INSTAGRAM_ERROR", err) ;
      callback(err, null);
    }
    else {
      console.log(chalkInstagram("#### INSTAGRAM_SUBSCRIPTIONS\n" + subscriptions + "\nEND INSTAGRAM_SUBSCRIPTIONS\n####\n"));
      configEvents.emit("INSTAGRAM_SUBSCRIPTIONS", subscriptions) ;
      configEvents.emit("INSTAGRAM_RATE_LIMIT", limit) ;
      configEvents.emit("INSTAGRAM_RATE_LIMIT_REMAINING", remaining) ;
      callback(null, subscriptions);
    }
  });
}

function addInstagramUserSub(instagramClient, igUserId, instagramCallbackUrl, callback){

	console.log("instagramCallbackUrl: " + instagramCallbackUrl);

	var instagramReady = false;
	var instagramError = false;

  instagramClient.add_user_subscription(instagramCallbackUrl, function(err, result, remaining, limit) {

    if (err){
      console.error(chalkError("!!! INSTAGRAM USER SUBSCRIPTION ERROR " 
        + getTimeStamp() 
        + " USER: " + igUserId 
        + " [ LIMIT: " + limit + " | REMAINING: " + remaining + " ] "
        + "\nRESULT\n" 
        + JSON.stringify(result, null, 3) 
        + "\nERROR\n" 
        + JSON.stringify(err, null, 3) 
        + "\n"
      ));

      if (err.error_type == 'OAuthRateLimitException') {
        instagramRateLimitException = Date.now() ;
        instagramRateLimitRemaining = 0 ;
        configEvents.emit("INSTAGRAM_RATE_LIMIT_ERROR", err) ;
        instagramError = true ;
        instagramReady = false ;
        callback(err, igUserId);
      }
      else if (err.error_type == 'APISubscriptionError') {
        instagramClient.add_user_subscription(igUserId, instagramCallbackUrl, function(err, result, remaining, limit) {
          if (err){
            console.error(chalkError("!!! ** RETRY ** | INSTAGRAM USER SUBSCRIPTION ERROR: " + igUserId));
            instagramError = true ;
            instagramReady = false ;
            configEvents.emit("INSTAGRAM_ERROR", igUserId) ;
            if (err.error_type !== 'OAuthRateLimitException') {
              err.retry();
            }
            callback(err, igUserId);
          }
          else {
            console.log(chalkInstagram("** RETRY ** | +++ INSTAGRAM ADD USER SUBSCRIPTION"));
            configEvents.emit("INSTAGRAM_ERROR", igUserId) ;
            callback(null, result.object_id);
          }
        });
      }
      else {
        callback(err, igUserId);
      }
    }
    else {
      instagramRateLimitException = 0;
      instagramRateLimitRemaining = remaining ;

      console.log(chalkInstagram("+++ INSTAGRAM ADD USER SUBSCRIPTION [ LIMIT: " + limit 
        + " | REMAINING: " + remaining + " ]: " 
        + result.object_id
        ));
      configEvents.emit("INSTAGRAM_TAG_SUB", result.object_id) ;
      configEvents.emit("INSTAGRAM_RATE_LIMIT_REMAINING", remaining) ;

      callback(null, result.object_id);
    }

  });
}


function getTimeStamp(inputTime) {
	
	var currentDate ;
	var currentTime ;

  var options = {
    weekday: "long", year: "numeric", month: "short",
    day: "numeric", hour: "2-digit", hour12: false,  minute: "2-digit"
  };

  if (typeof inputTime === 'undefined') {
    currentDate = new Date().toDateString("en-US", options);
    currentTime = new Date().toTimeString('en-US', options);
  }
  else {
  	var d = new Date(inputTime);
    currentDate = new Date(d).toDateString("en-US", options);
    currentTime = new Date(d).toTimeString('en-US', options);
  }
  return currentDate + " - " + currentTime;
}

var getErrorMessage = function(err) {
	var message = '';
	if (err.code) {
		switch (err.code) {
			case 11000:
				console.error(getTimeStamp() + "\n\n***** MONGODB ERROR " + err);
				break;
			case 11001:
				console.error(getTimeStamp() + "\n\n***** MONGODB ERROR " + err);
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

function getSortedKeys(hmap) {
  var keys = []; 
  hmap.forEach(function(value, key){
    keys.push(key);
  });
  return keys.sort(function(a,b){return hmap.get(b).mentions-hmap.get(a).mentions});
}


function findOneUser (user, io) {

	var query = { userId: user.userId  };
	var update = { 
					$inc: { mentions: 1 }, 
					$set: { 
						nodeId: user.nodeId,
						nodeType: user.nodeType,
						username: user.username,
						profileImageUrl: user.profileImageUrl,
						lastSeen: Date.now() 
					} 
				};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	IgUser.findOneAndUpdate(
		query,
		update,
		options,
		function(err, us) {
			if (err) {
				console.error(getTimeStamp() + "\n\n***** USER FINDONE ERROR " + user.userId + "\n" + err);
				getErrorMessage(err);
			}
			else {
				debug(chalkInstagram("IG USR " + us.userId
					+ " " + us.username
					+ " FN " + us.fullname
					+ " MN " + us.mentions 
					));
				var mentionsString = us.mentions.toString() ;
				us.mentions = mentionsString ;

				if (io) {
					debug("IO EMIT IG USER " + us.userId + " | " + us.username);
					io.emit('node', us);	
				}			
			}
		}
	);
}

function findOnePlace (place, testMode, io) {

	var query = { placeId: place.placeId  };
	var update = { 
					$inc: { mentions: 1 }, 
					$set: { 
						nodeType: place.nodeType,
						nodeId: place.nodeId,
						name: place.name,
						latitude: place.latitude,
						longitude: place.longitude,
						sourceUrl: place.sourceUrl,
						imageUrl: place.imageUrl,
						lastSeen: Date.now() 
					} 
				};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	IgPlace.findOneAndUpdate(
		query,
		update,
		options,
		function(err, pl) {
			if (err) {
				console.error(getTimeStamp() + "\n\n***** IG PLACE FINDONE ERROR " + place.placeId + "\n" + err);
				getErrorMessage(err);
				// return user;
			}
			else {
				debug(chalkInstagram("IG PLACE " + pl.placeId
					+ "  " + pl.name
					+ " LT " + pl.latitude
					+ " LN " + pl.longitude
					+ " MN " + pl.mentions 
					+ "  " + pl.sourceUrl 
					+ "  " + pl.imageUrl 
					));

				if (!testMode) recentPlaceArray.push(pl);
				if (recentPlaceArray.length > maxRecentPlaces) { recentPlaceArray.shift()};	

				if (io) {
					debug("IO EMIT IG PLACE " + pl.placeId + " | " + pl.name);
					io.emit('node', pl);	
				}			
			}
		}
	);
}

function findOneMedia (media, io) {

	var query = { mediaId: media.mediaId };
	var update = { 
					$inc: { mentions: 1 }, 
					$set: { 
							nodeId: media.nodeId,
							nodeType: media.nodeType,
							mediaType: media.mediaType,
							user: media.user,
							url: media.url,
							tags: media.tags,
							createdAt: media.createdAt,
							lastSeen: Date.now(),
							likes: media.likes,
							imageUrl: media.imageUrl,
							width: parseInt(media.width), 
							height: parseInt(media.height),
							location: media.location
						} 
					};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	IgMedia.findOneAndUpdate(
		query,
		update,
		options,
		function(err, me) {
			if (err) {
				console.error(getTimeStamp() + "\n\n***** INSTAGRAM MEDIA FINDONE ERROR " + media.mediaId + "\n" + err);
				getErrorMessage(err);
			}
			else {
				debug(chalkInstagram("IG MED " + me.mediaId 
					+ " US " + me.user.username
					// + " TG " + me.tags
					+ " LK " + me.likes
					+ " MN " + me.mentions 
					+ " CR " + me.createdAt
					// + " " + me.url 
					// + " " + me.imageUrl 
					));

				if (me.location){
					debug(chalkInstagram("LOC " + me.location.id 
						+ " " + me.location.name 
						+ " LT " + me.location.latitude 
						+ " LN " + me.location.longitude
					));
				}

				if (typeof me.width != 'Number') {
					debug(chalkInstagram("*** WIDTH IS TYPE " + typeof me.width));
				}

				var mentionsString = me.mentions.toString() ;
				me.mentions = mentionsString ;

				if (io) {
					debug("IO EMIT IG MEDIA " + me.mediaId + " | MTNs " + me.mentions + " | LIKES " + me.likes + " | " + me.url + " | " + me.imageUrl);
					io.emit('node', me);	
				}			
			}
		}
	);
}

exports.findOneTag = function(tag, io, callback) {

	var query = { igTagId: tag.igTagId.toLowerCase() };
	var update = { 
					$inc: { mentions: 1 }, 
					$max: { minTagId: tag.minTagId, mediaCount: tag.mediaCount }, 
					$set: { 
						nodeType: tag.nodeType,
						nodeId: tag.nodeId,
						text: tag.text.toLowerCase(),
						lastSeen: Date.now() 
					} 
				};
	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	IgTag.findOneAndUpdate(
		query,
		update,
		options,
		function(err, igt) {
			if (err) {
				console.error(getTimeStamp() + "\n\n***** INSTAGRAM TAG FINDONE ERROR " + tag.text + "\n" + err);
				getErrorMessage(err);
				callback(err, tag);
			}
			else {
				debug(chalkInstagram("IG TAG " + igt.igTagId 
					+ " MC " + igt.mediaCount 
					+ " MN " + igt.mentions 
					+ " TI " + igt.minTagId
					));
				var mentionsString = igt.mentions.toString() ;
				igt.mentions = mentionsString ;

				if (io) {
					debug("IO EMIT IG TAG\n" + JSON.stringify(igt, null, 3));
					io.emit('node', igt);	
				}			

				callback(null, igt);
			}
		}
	);
}

exports.placeHashMapInit = function(callback){
	debug(chalkInstagram("placeHashMapInit: INITIALIZING IG PLACE HASHMAP FROM DB ..."));
	IgPlace.find({}, function(err, docs) {
	    if (!err){ 
				console.log(chalkInfo(getTimeStamp() + " | ADDING " + docs.length + " IG PLACES TO HASHMAP..."));
				// for (var i=0; i < docs.length; i++){
				for (var i=docs.length-1; i >= 0; i--){
					placeHashMap.set(docs[i].nodeId, docs[i]);
					debug("PLACE " + docs[i].nodeId + " | " + docs[i].name);
					if ((i > 0) && (i%5000 == 0)){
						console.log(chalkInstagram("... ADDED " + i + " IG PLACES TO HASHMAP..."));
					}
					if (i == 0){
						console.log(chalkInstagram("IG PLACE INIT COMPLETE | ADDED " + docs.length + " PLACES TO HASHMAP..."));
						configEvents.emit('placeHashMapInit_DONE');
						callback(null, docs.length) ;
				  }
				}

	    } 
	    else {
				console.error(getTimeStamp() + "\n\n***** IG placeHashMapInit: *** DB Place.find ERROR ***\n" + err);
				callback(err, null) ;
	    }
	});
}

exports.sendStats = function(io, socketId, nodeType, maxStats){
	console.log(chalkInstagram("IG sendStats: socketId " + socketId + " | TYPE " + nodeType + " | maxStats " + maxStats));

	var statsType = '';
	var allSortedArray = [];

	switch (nodeType) {
		case 'instagram' :
			statsType = 'STATS_INSTAGRAM';
			nodeHashMap = igIdHashMap ;
			allSortedArray = igIdHashMapSortedKeyArray ;
		break;
		case 'ig_hashtag' :
			statsType = 'STATS_IG_HASHTAG';
			nodeHashMap = hashtagHashMap ;
			allSortedArray = hashtagHashMapSortedKeyArray ;
		break;
		case 'ig_place' :
			statsType = 'STATS_IG_PLACE';
			nodeHashMap = placeHashMap ;
			allSortedArray = placeHashMapSortedKeyArray ;
		break;
		case 'ig_media' :
			statsType = 'STATS_IG_MEDIA';
			nodeHashMap = mediaHashMap ;
			allSortedArray = mediaHashMapSortedKeyArray ;
		break;
		default:
	}

		console.log(chalkInstagram("SORTED IG " + nodeType + " HASHMAP " + allSortedArray.length + " KEYS"));

	  var maxStatsObject = {};

	  for (var i=0; i<maxStats; i++){
	  	maxStatsObject[allSortedArray[i]] = nodeHashMap.get(allSortedArray[i]);
	  }

		io.to(socketId).emit(statsType, JSON.stringify(maxStatsObject));
		console.log(chalkInstagram("SENT " + maxStats + " " + nodeType.toUpperCase() + " STATS"));

		switch (nodeType) {
			case 'instagram' :
				io.to(socketId).emit('RECENT_STATS_INSTAGRAM', JSON.stringify(recentTweetArray));
				console.log(chalkInstagram("SENT " + recentTweetArray.length + " RECENT_STATS_INSTAGRAM"));
			break;
			case 'ig_hashtag' :
				io.to(socketId).emit('RECENT_STATS_IG_HASHTAG', JSON.stringify(recentHashtagArray));
				console.log(chalkInstagram("SENT " + recentHashtagArray.length + " RECENT_STATS_IG_HASHTAG"));
			break;
			case 'ig_place' :
				io.to(socketId).emit('RECENT_STATS_IG_PLACE', JSON.stringify(recentPlaceArray));
				console.log(chalkInstagram("SENT " + recentPlaceArray.length + " RECENT_STATS_IG_PLACE"));
			break;
			case 'ig_media' :
				io.to(socketId).emit('RECENT_STATS_IG_MEDIA', JSON.stringify(recentMediaArray));
				console.log(chalkInstagram("SENT " + recentMediaArray.length + " RECENT_STATS_IG_MEDIA"));
			break;
			default:
		}
	// });
}

exports.createStreamMedia = function(newIgMedia, io, searchTermHashMap, possibleSearchTermHashMap, searchTermBlacklistHashMap, configEvents) {	

	var mediaObj ;
	var userObj ;
	var placeObj ;
	var mediaObjPrevSeen ;

	if (newIgMedia.testMode) {
		console.log(chalkInstagram("\n@@@TEST MEDIA\n"));
	}

	if (enableHashMaps && mediaHashMap.has(newIgMedia.id)) {
		mediaObj = mediaHashMap.get(newIgMedia.id) ;
		mediaObjPrevSeen = mediaObj.lastSeen ;
		mediaObj.lastSeen = Date.now();
		mediaObj.mentions++ ;
	}
	else {
		mediaObj = new IgMedia({ 
							mediaId : newIgMedia.id, 
							nodeId : newIgMedia.id, 
							nodeType: 'ig_media',
							mediaType: newIgMedia.mediaType,
							user: newIgMedia.user,
							usersInPhoto: newIgMedia.users_in_photo,
							url: newIgMedia.link,
							tags: newIgMedia.tags,
							lastSeen : Date.now(),
							likes : newIgMedia.likes.count,
							createdAt : newIgMedia.created_time,
							imageUrl : newIgMedia.images.standard_resolution.url,
							width: parseInt(newIgMedia.images.standard_resolution.width),
							height: parseInt(newIgMedia.images.standard_resolution.height),
							location: newIgMedia.location
						});

		if (enableHashMaps && (mediaHashMap.count() < MAX_HASHMAP_COUNT)) {
			mediaHashMap.set(mediaObj.mediaId, mediaObj);			
		}
	}

	userObj = new IgUser({
		nodeType: 'ig_user',
		userId: newIgMedia.user.id,
		nodeId: newIgMedia.user.id,
		username: newIgMedia.user.username,
		fullname: newIgMedia.user.full_name,
		profileImageUrl: newIgMedia.user.profile_picture,
		lastSeen : Date.now()
	});

	findOneUser(userObj, io);

	if (newIgMedia.location){
		placeObj = new IgPlace({
			nodeType: 'ig_place',
			placeId: newIgMedia.location.id,
			nodeId: newIgMedia.location.id,
			name: newIgMedia.location.name,
			sourceUrl: newIgMedia.link,
			imageUrl: newIgMedia.images.standard_resolution.url,
			latitude: newIgMedia.location.latitude,
			longitude: newIgMedia.location.longitude,
			lastSeen : Date.now()
		});

		findOnePlace(placeObj, newIgMedia.testMode, io);
	}


	var numTags = newIgMedia.tags.length;

	var mediaIdParts = newIgMedia.id.split("_");  // mediaId is NNNNNNNNNN_UUUUUUU where UUUUUUU = user id

	for (var i = 0; i < numTags; i++) {
		var tagObj = new IgTag({
			igTagId: newIgMedia.tags[i].toLowerCase(),
			nodeId: newIgMedia.tags[i].toLowerCase(),
			nodeType: 'ig_tag',
			mediaCount: 0,
			text: newIgMedia.tags[i].toLowerCase(),
			minTagId : mediaIdParts[0],
			lastSeen : Date.now()
		});

		var currentHt = newIgMedia.tags[i].toLowerCase() ;

		if (S(currentHt).isAlphaNumeric() 
			&& (S(currentHt).endsWith('matter') 
			|| S(currentHt).endsWith('matters')
			|| S(currentHt).endsWith('mattered')
			|| S(currentHt).endsWith('mattering'))
			){

			debug("\n=== MATTER HASHTAG MATCH " + currentHt);
			// configEvents.emit('MATTER_HASHTAG', currentHt);

			if (typeof searchTermHashMap === 'undefined'){
				console.log(chalkAlert("searchTermHashMap UNDEFINED ... SKIPPING POSSIBLE SEARCH TERM CHECK"));
			}
			else if (
				!searchTermHashMap.has(currentHt) 
				&& !possibleSearchTermHashMap.has(currentHt)
				&& !searchTermBlacklistHashMap.has(currentHt)
				){
				var searchTermObj = {
					source: 'INSTAGRAM',
					url: mediaObj.url,
					hashtag: currentHt
				};

				debug(chalkAlert("??? POSSIBLE NEW SEARCH TERM HASHTAG " + currentHt));
				configEvents.emit('POSSIBLE_SEARCH_TERM', JSON.stringify(searchTermObj));
			}
			else{
				debug(chalkInfo("... MATTER HASHTAG MATCH KNOWN " + currentHt));
			}

		}

		exports.findOneTag(tagObj, io, function(err, igt){
			if (err){
				console.error("!!! ERROR: findOneTag " + err);
			}
			else{
				debug("findOneTag " + JSON.stringify(igt, null, 3));
			}
		});
	}

	findOneMedia(mediaObj, io);	
};
