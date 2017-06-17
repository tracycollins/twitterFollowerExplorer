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
var chalkTwitter = chalk.blue;
var chalkPlace = chalk.bold.green;
var chalkDb = chalk.gray;

var moment = require('moment');

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

var Word = require('mongoose').model('Word');
var debug = require('debug')('word');

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

exports.getRandomWord = function(callback){
	var query = { $sample: { size: 1 }};
	Word.aggregate(query, function(err, randomWordArray){
		if (err) {
			console.error(getTimeStamp() + " ***** WORD RANDOM ERROR\n" + err);
			callback(err, 'RANDOM ERROR');
		}
		else {
			debug("RANDOM WORD\n" + JSON.stringify(randomWordArray, null, 3));
			callback(null, randomWordArray[0]);
		}
	});
}

exports.findOneWord = function(word, incMentions, callback) {

	debug("findOneWord:" + JSON.stringify(word, null, 2));

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { nodeId: word.nodeId  };
	var update = { 
			$inc: { mentions: inc }, 
			$set: { 
				nodeId: word.nodeId,
				bhtSearched: word.bhtSearched,
				bhtFound: word.bhtFound,
				tags: word.tags,
				// noun: word.noun,
				// verb: word.verb,
				// adjective: word.adjective,
				// adverb: word.adverb,
				lastSeen: Date.now()
			},
			$max: { noun: word.noun },
			$max: { verb: word.verb },
			$max: { adjective: word.adjective },
			$max: { adverb: word.adverb }
			// $max: { bhtSearched: word.bhtSearched },
			// $max: { bhtFound: word.bhtFound }
		};
	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	Word.findOneAndUpdate(
		query,
		update,
		options,
		function(err, wd) {
			if (err) {
				console.error(getTimeStamp() + " ***** WORD FINDONE ERROR: findOneAndUpdate(1): " + word.nodeId + "\n" + err);
				callback(err, word);
			  // process.exit( );
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + wd.nodeId 
					+ " | MENTIONS: " + wd.mentions 
					+ " | LAST SEEN: " + Date(wd.lastSeen) 
					+ " | BHT SEARCHED: " + wd.bhtSearched 
					+ " | BHT FOUND: " + wd.bhtFound 
				));

				debug("> WORD UPDATED:" + JSON.stringify(wd, null, 2));

				if (
						 ((typeof wd.noun !== 'undefined') && (wd.noun != null))
					|| ((typeof wd.verb !== 'undefined')  && (wd.verb != null))
					|| ((typeof wd.adjective !== 'undefined') && (wd.adjective != null))
					|| ((typeof wd.adverb !== 'undefined')) && (wd.adverb != null)) 
					{

					if (!wd.bhtSearched || !wd.bhtFound) {

						debug(chalkDb("??? BHT DATA NOT NULL | " + wd.nodeId + " ... UPDATING BHT FOUND/SEARCHED"));
						debug("==???==:" + JSON.stringify(wd, null, 2));

						update = { 
										$set: { 
											bhtSearched: true,
											bhtFound: true
										} 
									};

						Word.findOneAndUpdate(
							query,
							update,
							options,
							function(err, wdBhtUpdated) {
								if (err) {
									console.error(getTimeStamp() + " ***** WORD FINDONE ERROR:  findOneAndUpdate(2):" + wd.nodeId + "\n" + err);
									callback(err, word);
								}
								else {
									callback(null, wdBhtUpdated);
									return;
								}
							}
						);
					}
					else {
						callback(null, wd);
						return;
					}
				}
				else {
					callback(null, wd);
				}
			}
		}
	);
}

exports.findOneWordMw = function(word, incMentions, callback) {

	debug("findOneWordMw:" + JSON.stringify(word, null, 2));

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { nodeId: word.nodeId  };
	var update = { 
					$inc: { mentions: inc }, 
					$set: { 
						nodeId: word.nodeId,
						mwEntry: word.mwEntry,
						mwDictSearched: word.mwDictSearched,
						mwThesSearched: word.mwThesSearched,
						mwDictFound: word.mwDictFound,
						mwThesFound: word.mwThesFound,
						lastSeen: moment().valueOf()
					}
				};
	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	Word.findOneAndUpdate(
		query,
		update,
		options,
		function(err, wd) {
			if (err) {
				console.error(getTimeStamp() + " ***** WORD FINDONE ERROR: findOneAndUpdate: " + word.nodeId + "\n" + err);
				callback(err, word);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + wd.nodeId 
					+ " | MENTIONS: " + wd.mentions 
					+ " | LAST SEEN: " + Date(wd.lastSeen) 
					+ " | MWD SEARCHED: " + wd.mwDictSearched 
					+ " | MWD FOUND: " + wd.mwDictFound 
					+ " | MWT SEARCHED: " + wd.mwThesSearched 
					+ " | MWT FOUND: " + wd.mwThesFound 
				));

				debug("> WORD UPDATED:" + JSON.stringify(wd, null, 2));

				callback(null, wd);
			}
		}
	);
}
