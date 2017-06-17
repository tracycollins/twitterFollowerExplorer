var S = require('string');
var chalk = require('chalk');
var util = require('util');

var chalkAdmin = chalk.bold.blue;

var chalkAlert = chalk.red;
var chalkBht = chalk.gray;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkConnect = chalk.bold.green;
var chalkConnectAdmin = chalk.bold.cyan;
var chalkDisconnect = chalk.blue;
var chalkTwitter = chalk.blue;
var chalkPlace = chalk.bold.green;
var chalkDb = chalk.gray;

var moment = require('moment');
var Phrase = require('mongoose').model('Phrase');
var debug = require('debug')('phrase');

var jsonPrint = function (obj) {
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  return "UNDEFINED";
};

exports.findOnePhrase = function(phrase, incMentions, callback) {

	// console.log("findOnePhrase:" + jsonPrint(phrase));

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { phraseId: phrase.phraseId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						phraseId: phrase.phraseId,
						userId: phrase.userId,
						sessionId: phrase.sessionId,
						text: phrase.text,
						length: phrase.length,
						url: phrase.url,
						links: phrase.links,
						lastSeen: moment().valueOf()
					}
				};
	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	Phrase.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ph) {
			if (err) {
				console.error(Date.now() + "\n\n***** PHRASE FINDONE ERROR: \n" + jsonPrint(phrase) + "\n" + err);
				callback("ERROR " + err, null);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + ph.phraseId 
					+ " | Ms: " + ph.mentions 
					+ " | LAST SEEN: " + Date(ph.lastSeen) 
				));

				debug("> PHRASE UPDATED:" + JSON.stringify(ph, null, 2));

				callback(null, ph);
			}
		}
	);
}

exports.phraseByExactID = function(phraseId, callback) {
	Phrase.findOne({
			phraseId: phraseId
		}, 
		function(err, reqPhrase) {
			if (err) {
				console.log("***** DB ERROR: phraseByExactID: " + phraseId + "\n" + err);
				return callback(err, null);
			}
			else if (reqPhrase) {
				debug("@@@-> phraseByExactID (DB): REQ ID: " + phraseId 
					+ " | FOUND " + reqPhrase.phraseId
				);
	
				debug("@@@-> PBID"
					+ " | " + reqPhrase.phraseId 
					+ " | CR: " + Date(reqPhrase.createdAt) 
					+ " | " + reqPhrase.text
					);
				callback(null, reqPhrase) ;
			}
			else {
				debug("@@@... phraseByExactID (DB) NOT FOUND: REQ ID: " + phraseId);
				callback(null, null) ;
			}
		}
	);
};

