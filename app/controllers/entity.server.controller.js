var S = require('string');
var chalk = require('chalk');
var util = require('util');

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkDb = chalk.gray;

var moment = require('moment');
var Entity = require('mongoose').model('Entity');
var debug = require('debug')('entity');

exports.findOneEntity = function(entity, incMentions, callback) {

	debug("findOneEntity:" + JSON.stringify(entity, null, 2));

	var inc = 0;

	if (incMentions) {
		inc = 1 ;
	}

	var query = { entityId: entity.entityId  };
	var update = { 
		$inc: { mentions: inc }, 
		$max: { sessions: entity.sessions }, 
		$max: { words: entity.words }, 
		$set: { 
			entityId: entity.entityId,
			name: entity.name,
			screenName: entity.screenName,
			// sessions: entity.sessions,
			// words: entity.words,
			tags: entity.tags
		}
	};

	if (incMentions) {
		update['$set'].lastSeen = moment();
	}

	if (entity.addGroupArray) {
		console.log(chalkDb("ADD VIDEO ARRAY: " + entity.addGroupArray.length));
		update['$addToSet'] = {groups: { $each: entity.addGroupArray }};
	}

	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	Entity.findOneAndUpdate(
		query,
		update,
		options,
		function(err, ent) {
			if (err) {
				console.error(Date.now() + "\n\n***** ENTITY FINDONE ERROR: " + entity.entity + "\n" + err);
				callback("ERROR " + err, null);
			}
			else {
				debug(chalkDb("->- DB UPDATE" 
					+ " | " + ent.entityId 
					+ " | NAME: " + ent.name 
					+ " | SNAME: " + ent.screenName 
					+ " | GROUPS: " + Object.keys(ent.groups) 
					+ " | CHAN: " + ent.tags.channel
					+ " | SESSIONS: " + ent.sessions 
					+ " | WORDS: " + ent.words 
					+ " | MNS: " + ent.mentions 
					+ " | CREATED: " + Date(ent.createdAt) 
					+ " | LAST SEEN: " + Date(ent.lastSeen) 
				));

				debug("> ENTITY UPDATED:" + JSON.stringify(ent, null, 2));

				callback(null, ent);

			}
		}
	);
}
