var enableHashMaps = 1 ;
var MAX_HASHMAP_COUNT = 1000 ;
var hashtagRxQenabled = false;

var urlRegEx = /\/(\w+$)/gi;

var S = require('string');
var chalk = require('chalk');

var chalkAdmin = chalk.bold.blue;

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkMeta = chalk.blue;
var chalkPlace = chalk.bold.green;

var async = require("async");

var moment = require('moment');

var metaSpanArray = [ "second", "minute", "hour", "day", "week", "month", "year"];

var MetaSecond = require('mongoose').model('MetaSecond');
var MetaMinute = require('mongoose').model('MetaMinute');
var MetaHour = require('mongoose').model('MetaHour');
var MetaDay = require('mongoose').model('MetaDay');
var MetaWeek = require('mongoose').model('MetaWeek');
var MetaMonth = require('mongoose').model('MetaMonth');
var MetaYear = require('mongoose').model('MetaYear');

var Tweet = require('mongoose').model('Tweet');
var Hashtag = require('mongoose').model('Hashtag');
var Media = require('mongoose').model('Media');
var User = require('mongoose').model('User');
var Url = require('mongoose').model('Url');
var Place = require('mongoose').model('Place');

var debug = require('debug')('tweets');

var fs = require('fs');
var http = require('http');
var path = require('path') ;
var HashMap = require('hashmap').HashMap;

var Queue = require('queue-fifo');
var hashtagRxQ = new Queue();

var EventEmitter = require("events").EventEmitter;
var configEvents = new EventEmitter();

var childProcess = require("child_process");
var child_sortHashmapKeys = childProcess.fork("sortHashmapKeys");
var topHashtagsArray = [] ;
var topMediaArray = [];

child_sortHashmapKeys.on('message', function(sObj){
  var sortedObj = JSON.parse(sObj);
  debug(chalkTwitter("child_sortHashmapKeys: TYPE: " + sortedObj.type + " | RCVD " + sortedObj.keys.length + " KEYS"));

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
    case 'META':
      metaHashMapSortedKeyArray = sortedObj.keys ;
      break;
    default:
  }
});


var DEFAULT_X = 100;
var DEFAULT_Y = 100;

var lastId = '0';
var nodeId = -1 ;  // increments before return from function, so 1st returns zero

var compactDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

var getErrorMessage = function(err) {
	var message = '';
	if (err.code) {
		switch (err.code) {
			case 11000:
				console.log(getTimeStamp() + "\n\n***** MONGODB ERROR: DUPLICATE KEY" + err);
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

exports.nodesSortedByKey = function(req, callback) {

	var request = {};

	request.socketId = req.socketId;
	request.nodeType = 'HASHTAG';
	request.sortKey = 'mentions';
	request.order = -1;  // 1 = ascending, -1 = descending
	request.limit = 50;

	if (typeof req.nodeType !== 'undefined'){
		request.nodeType = req.nodeType;
	}
	if (typeof req.sortKey !== 'undefined'){
		request.sortKey = req.sortKey;
	}
	if (typeof req.limit !== 'undefined'){
		request.limit = req.limit;
	}
	if (typeof req.order !== 'undefined'){
		request.order = req.order;
	}

	var sortParams = {};
	sortParams[request.sortKey] = request.order; 

	debug("@@@-> nodesSortedByKey (NSBK): REQ"
		+ " | nodeType: " + request.nodeType 
		+ " | sortKey: " + request.sortKey 
		+ " | limit: " + request.limit 
		+ " | order: " + request.order 
		+ "\nrequest\n" + jsonPrint(request) 
		+ "\nsortParams\n" + jsonPrint(sortParams)
	);

  switch (request.nodeType) {

    case 'TWEET' :
			Tweet.find({},
				function(err, results) {
					if (err) {
						console.log("***** DB ERROR: nodesSortedByKey" + "\n" + jsonPrint(request) + "\n" + err);
						return next(err);
					}
					else if (results) {
						for (var i=0; i<results.length; i++){
			
							var textReformatted = results[i].text.replace('\n', ' ') ;
							textReformatted = textReformatted.replace('\r', ' ') ;

							debug("@@@-> NSBK"
								+ " | SK " + request.sortKey
								+ " | ORD " + request.order 
								+ " | " + results[i].tweetId 
								+ " | " + moment.utc(new Date(results[i].createdAt)).format(compactDateTimeFormat)
								+ " | " + textReformatted.substring(0,20)
								);
						}
						callback(results) ;
					}
					else {
						debug("@@@-> nodesSortedByKey NOT FOUND\n" + jsonPrint(req));
						callback(null) ;
					}
				}
			).limit(request.limit).sort(sortParams);
    break;

    case 'HASHTAG' :
			Hashtag.find({},
				function(err, results) {
					if (err) {
						console.log("***** DB ERROR: nodesSortedByKey" + "\n" + jsonPrint(request) + "\n" + err);
						return callback(err, null);
					}
					else if (results) {
						for (var i=0; i<results.length; i++){
			
							debug("@@@-> NSBK"
								+ " | SK " + request.sortKey
								+ " | ORD " + request.order 
								+ " | M " + results[i].mentions 
								+ " | " + results[i].text 
								+ " | LS " + moment.utc(parseInt(results[i].lastSeen)).format(compactDateTimeFormat)
								// + " | " + jsonPrint(results[i]) 
								);
						}

						var reply = {};
						reply.results = results;
						reply.request = request;
						callback(null, reply) ;
						
					}
					else {
						debug("@@@-> nodesSortedByKey NOT FOUND" + "\n" + jsonPrint(request));
						callback(null, null) ;
					}
				}
			).limit(request.limit).sort(sortParams);
    break;

    case 'MEDIA' :
			Media.find({},
				function(err, results) {
					if (err) {
						console.log("***** DB ERROR: nodesSortedByKey" + "\n" + jsonPrint(request) + "\n" + err);
						return callback(err, null);
					}
					else if (results) {

						for (var i=0; i<results.length; i++){
			
							debug("@@@-> NSBK"
								+ " | " + results[i].mediaId 
								+ " | M " + results[i].mentions 
								+ " | LS " + moment.utc(parseInt(results[i].lastSeen)).format(compactDateTimeFormat)
								);
						}

						var reply = {};
						reply.results = results;
						reply.request = request;
						callback(null, reply) ;

					}
					else {
						debug("@@@-> nodesSortedByKey NOT FOUND" + "\n" + jsonPrint(request));
						callback(null, null) ;
					}
				}
			).limit(request.limit).sort(sortParams);
    break;

    case 'USER' :
			User.find({},
				function(err, results) {
					if (err) {
						console.log("***** DB ERROR: nodesSortedByKey" + "\n" + jsonPrint(request) + "\n" + err);
						return next(err);
					}
					else if (results) {
						for (var i=0; i<results.length; i++){
			
							debug("@@@-> NSBK"
								+ " | " + results[i].userId 
								+ " | M " + results[i].mentions 
								+ " | LS " + moment.utc(parseInt(results[i].lastSeen)).format(compactDateTimeFormat)
								);
						}
						callback(results) ;
					}
					else {
						debug("@@@-> nodesSortedByKey NOT FOUND" + "\n" + jsonPrint(request));
						callback(null) ;
					}
				}
			).limit(request.limit).sort(sortParams);
    break;

    case 'PLACE' :
			Place.find({},
				function(err, results) {
					if (err) {
						console.log("***** DB ERROR: nodesSortedByKey" + "\n" + jsonPrint(request) + "\n" + err);
						return next(err);
					}
					else if (results) {
						for (var i=0; i<results.length; i++){
			
							debug("@@@-> NSBK"
								+ " | " + results[i].placeId 
								+ " | M " + results[i].mentions 
								+ " | LS " + moment.utc(parseInt(results[i].lastSeen)).format(compactDateTimeFormat)
								);
						}
						callback(results) ;
					}
					else {
						debug("@@@-> nodesSortedByKey NOT FOUND" + "\n" + jsonPrint(request));
						callback(null) ;
					}
				}
			).limit(request.limit).sort(sortParams);
    break;

    default:
      var err = "UNKNOWN NODE TYPE: " + nodeType;
      console.log(chalkError("\n*** getTotalNodeType: DB Media.count ERROR *** | " 
        + getTimeStamp() 
        + "\n" + err));
      callback(err, null);
    break;
  }
};

var MetaSpan;

exports.metaByDateRange = function(req, callback) {

	debug(chalkAlert("metaByDateRange >S MT DB"
		+ " | " + req.metaId 
		+ " | " + req.metaSpan 
		+ " | " + getTimeStamp(req.metaId) 
		+ " | " + getTimeStamp(req.startMoment) 
		+ " | " + getTimeStamp(req.endMoment) 
		+ " | LIM: " + req.limit
		// + "\n" + jsonPrint(req)
	));

	var query = {};

	query = {
			metaId: {
				$gte: req.startTimeStamp.toString(),
				$lte: req.endTimeStamp.toString()
			}
		}

	var projection = req.projection;

	if (!req.limit) req.limit = 100;
	if (!req.sort) req.sort = { metaId: 1 };

	switch (req.metaSpan){
		case 'second':
			MetaSpan = MetaSecond;
		break;

		case 'minute':
			MetaSpan = MetaMinute;
		break;

		case 'hour':
			MetaSpan = MetaHour;
		break;

		case 'day':
			MetaSpan = MetaDay;
		break;

		case 'week':
			MetaSpan = MetaWeek;
		break;

		case 'month':
			MetaSpan = MetaMonth;
		break;

		case 'year':
			MetaSpan = MetaYear;
		break;

		default:
			console.log(chalkError("UNKNOWN SPAN: " + req.metaSpan));
			quit();
		break;
	}


	MetaSpan.find(

		query,
		projection,

		function(err, reqMetas) {
			if (err) {
				console.log("***** DB ERROR: metaByID: " + jsonPrint(req) + "\n" + err);
				return callback(err, req);
			}
			else if (reqMetas.length > 0) {
				
				var response = {};
				response.metas = [];
				response.metas = reqMetas;
				response.req = {};
				response.req = req;
				return callback(null, response);
			}
			else {
				debug("@@@... metaByID (DB) NOT FOUND"
					+ " | " + req.metaId
					+ " | " + getTimeStamp(req.metaId)
					+ " | SPAN: " + req.metaSpan
				);
				return callback(null, null);
			}
		}
	).limit(req.limit).sort(req.sort);
};

exports.metaByID = function(req, callback) {

	debug(chalkAlert("metaByID >S MT DB"
		+ " | " + req.metaId 
		+ " | " + req.metaSpan 
		+ " | " + getTimeStamp(req.metaId) 
		+ " | LIM: " + req.limit
	));

	if (!req.metaId) {
		console.log("req\n" + jsonPrint(req));
		return(callback("UNDEFINED META ID", null));
	}

	var query = {};

	query.metaId = {	$gte: req.metaId.toString()	};

	if (req.projection) query.projection = req.projection;
	
	switch (req.metaSpan){
		case 'second':
			MetaSpan = MetaSecond;
		break;

		case 'minute':
			MetaSpan = MetaMinute;
		break;

		case 'hour':
			MetaSpan = MetaHour;
		break;

		case 'day':
			MetaSpan = MetaDay;
		break;

		case 'week':
			MetaSpan = MetaWeek;
		break;

		case 'month':
			MetaSpan = MetaMonth;
		break;

		case 'year':
			MetaSpan = MetaYear;
		break;

		case 'LEGACY':
			MetaSpan = Meta;
		break;

		default:
			console.log(chalkError("UNKNOWN SPAN: " + req.metaSpan));
			quit();
		break;
	}


	MetaSpan.find(

		query, 
		
		function(err, reqMetas) {
			if (err) {
				console.log("***** DB ERROR: metaByID: " + jsonPrint(req) + "\n" + err);
				return callback(err, req);
			}
			else if (reqMetas.length > 0) {
				
				var response = {};
				response.metas = [];
				response.metas = reqMetas;
				response.req = {};
				response.req = req;
				return callback(null, response);
			}
			else {
				// debug("\n$$$$$ metaByID $$$$$\n" + JSON.stringify(meta, null, 3));
				debug("@@@... metaByID (DB) NOT FOUND"
					+ " | " + req.metaId
					+ " | " + getTimeStamp(req.metaId)
					+ " | SPAN: " + req.metaSpan
				);
				var response = {};
				response.metas = [];
				response.metas = reqMetas;
				response.req = {};
				response.req = req;
				return callback(null, response);
			}
		}
	).limit(req.limit).sort({metaId: 1});
};

exports.getTotalMeta = function(callback) {

	// console.log(chalkAlert("findOneMeta meta\n" + jsonPrint(meta)));
	var results = {};
	results.totalMeta = 0;

  async.each(metaSpanArray, function (metaSpan, cb) {

		var MetaSpan;

		switch (metaSpan){

			case 'second':
				MetaSpan = MetaSecond;
			break;

			case 'minute':
				MetaSpan = MetaMinute;
			break;

			case 'hour':
				MetaSpan = MetaHour;
			break;

			case 'day':
				MetaSpan = MetaDay;
			break;

			case 'week':
				MetaSpan = MetaWeek;
			break;

			case 'month':
				MetaSpan = MetaMonth;
			break;

			case 'year':
				MetaSpan = MetaYear;
			break;

			default:
			break;
		}

	  MetaSpan.count({}, function (err, count) {
	    if (!err) { 
	    	results[metaSpan] = {};
	    	results[metaSpan].count = count;
	    	results.totalMeta += count;
	      console.log(chalkInfo("TOTAL META " + metaSpan + " | " + results[metaSpan].count));
		    return(cb());
	    } 
	    else {
	      console.log(chalkError("\n*** getTotalMeta: DB " + metaSpan + " ERROR *** | " + getTimeStamp() + "\n" + err));
	      return(cb(err));
	    }
	  });

  }, function(err){
  	debug("META TOTALS\n" + jsonPrint(results));
  	console.log(chalkInfo("META GRAND TOTAL: " + results.totalMeta));
    return(callback(err, results));
  });
}

exports.findOneMeta = function(meta, testMode, callback) {

	// console.log(chalkAlert("findOneMeta meta\n" + jsonPrint(meta)));

	var numberOfTweets = Object.keys(meta.addHashmap.tweets).length;

	var MetaSpan;

	switch (meta.metaSpan){

		case 'second':
			MetaSpan = MetaSecond;
		break;

		case 'minute':
			MetaSpan = MetaMinute;
		break;

		case 'hour':
			MetaSpan = MetaHour;
		break;

		case 'day':
			MetaSpan = MetaDay;
		break;

		case 'week':
			MetaSpan = MetaWeek;
		break;

		case 'month':
			MetaSpan = MetaMonth;
		break;

		case 'year':
			MetaSpan = MetaYear;
		break;

		default:
		break;
	}

	var query = { metaId: meta.metaId.toString()  };
	var update = { 
					$set: { 
						nodeId: meta.nodeId,
						nodeType: meta.nodeType,
						metaSource: meta.metaSource,
						metaType: meta.metaType,
						metaSpan: meta.metaSpan,
						metaTimestamp: meta.metaTimestamp
					},
					$max: {
						tweetsPerMetaSpan: meta.tweetsPerMetaSpan
					},
					$addToSet: {}
				};

	for (var prop in meta.addHashmap) {

		var addArray = [];

		for (var id in meta.addHashmap[prop]) {
			var obj = {}
			obj[id] = meta.addHashmap[prop][id];

			if (prop == 'urls') {

				debug(chalkError(
					prop 
					+ " | ID: " + id 
					+ " | obj[id]: " + obj[id] 
					// + " | obj\n" + jsonPrint(obj) 
				));

        var urlShortId = urlRegEx.exec(id);
        var urlId;

        if (urlShortId){
          urlId = urlShortId[1].toString();
          console.log(chalkAlert("--- URL SHORTENED"
            + " | ORIG url: " + id
            + " | urlShortId: " + urlShortId
            + " | NEW url: " + urlId
          ));
          
	        var newUrlObj = {};
	        newUrlObj[urlId] = meta.addHashmap[prop][id];

					addArray.push(newUrlObj);
					update['$addToSet'][prop] = { '$each': addArray};
					delete meta.addHashmap[prop][id];
        }
        else {
          urlId = id;
	        var newUrlObj = {};
	        newUrlObj[urlId] = meta.addHashmap[prop][id];

					addArray.push(newUrlObj);
					update['$addToSet'][prop] = { '$each': addArray};
					delete meta.addHashmap[prop][id];
        }
			}
			else {
				addArray.push(obj);
				update['$addToSet'][prop] = { '$each': addArray};
			}

		}
	}

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	MetaSpan.findOneAndUpdate(
		query,
		update,
		options,
		function(err, mt) {
			if (err) {
				console.log(getTimeStamp() 
					+ "\n\n***** META FINDONE ERROR" 
					+ " | " + meta.metaId + " | " + getTimeStamp(meta.metaId)
					+ "\n" + err
				);
				// getErrorMessage(err);
				callback(err, meta);
			}
			else {

				mt.tweetsPerMetaSpan = mt.tweets.length;

				debug(chalkAlert("MT > DB"
					+ " | " + mt.metaId 
					+ " | " + mt.metaSpan 
					+ " | " + getTimeStamp(mt.metaId) 
					+ " | TPMS: " + mt.tweetsPerMetaSpan
					+ " | T: " + mt.tweets.length 
					+ " | RT: " + mt.retweets.length 
					+ " | USR: " + mt.users.length 
					+ " | H: " + mt.hashtags.length 
					+ " | M: " + mt.media.length 
					+ " | P: " + mt.places.length 
					+ " | URL: " + mt.urls.length 
				));

				callback(null, mt);
			}
		}
	);
}

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
  var options = {
    // weekday: "long", year: "numeric", month: "short",
    weekday: "none", year: "numeric", month: "numeric",
    day: "numeric", hour: "2-digit", hour12: false,  minute: "2-digit"
  };

  // if (typeof inputTime !== 'undefined') {
  // 	console.log("typeof inputTime " + typeof inputTime + "\n" + jsonPrint(inputTime));
  // }

  if (typeof inputTime === 'undefined') {
    currentTimeStamp = moment.utc();
    // currentDate = new Date().toDateString("en-US", options);
    // currentTime = new Date().toTimeString('en-US', options);
  }
  else if (moment.isMoment(inputTime)) {
    // console.log("getTimeStamp: inputTime: " + inputTime + " | NOW: " + Date.now());
    currentTimeStamp = moment.utc(inputTime);
    // currentDate = new Date().toDateString("en-US", options);
    // currentTime = new Date().toTimeString('en-US', options);
  }
  else if (typeof inputTime === 'object') {
    currentTimeStamp = moment.utc(inputTime);
    // currentDate = new Date().toDateString("en-US", options);
    // currentTime = new Date().toTimeString('en-US', options);
  }
  else {
    currentTimeStamp = moment.utc(parseInt(inputTime));
    // var d = new Date(inputTime);
    // currentDate = new Date(d).toDateString("en-US", options);
    // currentTime = new Date(d).toTimeString('en-US', options);
  }
  return currentTimeStamp.format("YYYY-MM-DD HH:mm:ss ZZ");
}
