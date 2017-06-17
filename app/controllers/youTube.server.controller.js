var S = require('string');
var chalk = require('chalk');

var chalkAdmin = chalk.bold.blue;

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkDisconnect = chalk.blue;
var chalkDb = chalk.gray;

var moment = require('moment');

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

var YouTubePlaylist = require('mongoose').model('YouTubePlaylist');
var YouTubeVideo = require('mongoose').model('YouTubeVideo');
var YouTubeCaption = require('mongoose').model('YouTubeCaption');

var debug = require('debug')('YouTubeVideo');

function getTimeStamp(inputTime) {
  var currentTimeStamp ;

  if (typeof inputTime === 'undefined') {
    currentTimeStamp = moment().format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
}

exports.findOneYoutubeVideo = function(video, incMentions, callback) {

	// console.log("findOneRssVideo:" + video.nodeId);

	if (typeof video.createdAt !== 'number') {
		console.warn(chalkWarn("VIDEO CREATED AT NOT A NUMBER: " + video.createdAt
		 + " CONVERTING TO INT"));
		video.createdAt = parseInt(video.createdAt);
		// return(callback("CREATED AT NOT A NUMBER", video));
	}

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { nodeId: video.nodeId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						nodeId: video.nodeId,
						url: video.url,
						channelId: video.channelId,
						channelTitle: video.channelTitle,
						playlistId: video.playlistId,
						title: video.title,
						creator: video.creator,
						description: video.description,
						createdAt: video.createdAt,
						lastSeen: moment().valueOf(),
						// info: video.info,
						// contentDetails: video.contentDetails,
						captions: video.captions
					}
				};

	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	YouTubeVideo.findOneAndUpdate(
		query,
		update,
		options,
		function(err, vdo) {
			if (err) {
				console.error(getTimeStamp() + " ***** VIDEO FINDONE ERROR: findOneAndUpdate: " + video.nodeId + "\n" + err);
				callback(err, null);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + vdo.nodeId 
					+ " | TITLE: " + vdo.title 
					+ " | MENTIONS: " + vdo.mentions 
					+ " | CREATED: " + moment(vdo.createdAt).format(defaultDateTimeFormat)
					+ " | LAST SEEN: " + moment(vdo.lastSeen).format(defaultDateTimeFormat)
				));

				debug("> VIDEO UPDATED:" + JSON.stringify(vdo, null, 2));

				callback(null, vdo);
			}
		}
	);
}

exports.findOneYoutubePlaylist = function(playlist, callback) {

	var query = { nodeId: playlist.nodeId  };
	var update = { 
					$set: { 
						nodeId: playlist.nodeId,
						name: playlist.name,
						channelTitle: playlist.channelTitle,
						latestVideoId: playlist.latestVideoId,
						latestVideoTitle: playlist.latestVideoTitle,
						latestVideoDate: playlist.latestVideoDate,
						numberOfVideosServer: playlist.numberOfVideosServer,
						numberOfVideosDb: playlist.numberOfVideosDb,
						prevPageToken: playlist.prevPageToken,
						nextPageToken: playlist.nextPageToken
					}
					// $addToSet: {
					// 	videosInDb: { $each: playlist.addVideoIdArray }
					// }
				};

	if (playlist.addVideoIdArray) {
		console.log(chalkDb("ADD VIDEO ARRAY: " + playlist.addVideoIdArray.length));
		update['$addToSet'] = {videosInDb: { $each: playlist.addVideoIdArray }};
	}

	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	YouTubePlaylist.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ply) {
			if (err) {
				console.error(chalkError(getTimeStamp() 
					+ " *** PLAYLIST FINDONE ERROR: findOneAndUpdate: " 
					+ playlist.nodeId 
					+ "\n" + err
				));
				callback(err, null);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ "\n" + ply.nodeId 
					+ "\nNAME: " + ply.name 
					+ "\nCHAN: " + ply.channelTitle 
					+ "\nID: " + ply.nodeId 
					+ "\nLATEST ID: " + ply.latestVideoId
					+ "\nDATE: " + Date(ply.latestVideoDate) 
					+ "\nTITLE: " + ply.latestVideoTitle 
					+ "\nSRVR VIDS: " + ply.numberOfVideosServer 
					+ "\nDB VIDS: " + ply.numberOfVideosDb
					+ "\nDB VIDS IDs: " + Object.keys(ply.videosInDb).length
					+ "\nPREV PG: " + ply.prevPageToken 
					+ "\nNEXT PG: " + ply.nextPageToken 
				));

				debug("> playlist UPDATED:" + JSON.stringify(ply, null, 2));

				callback(null, ply);
			}
		}
	);
}

exports.findOneYoutubeCaption = function(caption, incMentions, callback) {

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { nodeId: caption.nodeId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						nodeId: caption.nodeId,
						channelId: caption.channelId,
						channelTitle: caption.channelTitle,
						title: caption.title,
						videoId: caption.videoId,
						tags: caption.tags,
						data: caption.data,
						createdAt: caption.createdAt,
						lastSeen: moment().valueOf()
					}
				};

	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	YouTubeCaption.findOneAndUpdate(
		query,
		update,
		options,
		function(err, cap) {
			if (err) {
				console.error(getTimeStamp() + " ***** CAPTION FINDONE ERROR: findOneAndUpdate: " 
					+ caption.nodeId + "\n" + err
					+ JSON.stringify(caption, null, 2)
					);
				callback(err, null);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + cap.nodeId 
					+ " | TITLE: " + cap.title 
					+ " | MENTIONS: " + cap.mentions 
					+ " | CREATED: " + Date(cap.createdAt) 
					+ " | LAST SEEN: " + Date(cap.lastSeen) 
				));

				debug("> CAPTION UPDATED:" + JSON.stringify(cap, null, 2));

				callback(null, cap);
			}
		}
	);
}
