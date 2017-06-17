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

var FacebookPost = require('mongoose').model('FacebookPost');
var debug = require('debug')('facebookPost');

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

exports.findOneFacebookPost = function(post, incMentions, callback) {

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { nodeId: post.nodeId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						nodeId: post.nodeId,
						feedName: post.feedName,
						title: post.title,
						createdAt: post.createdAt,
						link: post.link,
						description: post.description,
						summary: post.summary,
						author: post.author,
						tags: post.tags,
						meta: post.meta,
						post: post.post,
						lastSeen: moment().valueOf()
					}
				};

	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	FacebookPost.findOneAndUpdate(
		query,
		update,
		options,
		function(err, pst) {
			if (err) {
				console.error(chalkError(getTimeStamp() 
					+ " ***** POST FINDONE ERROR: findOneAndUpdate: " 
					+ post.nodeId + "\n" + err));
				callback(err, null);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + pst.nodeId 
					+ " | FEED NAME: " + pst.feedName 
					+ " | MENTIONS: " + pst.mentions 
					+ " | LAST SEEN: " + Date(pst.lastSeen) 
				));

				debug("> POST UPDATED:" + JSON.stringify(pst, null, 2));

				callback(null, pst);
			}
		}
	);
}
