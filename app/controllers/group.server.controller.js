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
var Group = require('mongoose').model('Group');
var debug = require('debug')('group');

exports.findOneGroup = function(Group, incMentions, callback) {

	debug("findOneGroup:" + JSON.stringify(group, null, 2));

	var inc = 0;
	if (incMentions) inc = 1 ;

	var query = { groupId: group.groupId  };
	var update = { 
		$inc: { mentions: inc }, 
		$set: { 
			groupId: group.groupId,
			name: group.name,
			tags: group.tags,
			lastSeen: moment()
		}
	};

	if (group.addEntityArray) {
		console.log(chalkDb("ADD ENTITY ARRAY: " + group.addEntityArray.length));
		update['$addToSet'] = {entities: { $each: group.addEntityArray }};
	}

	var options = { 
		setDefaultsOnInsert: true,
		upsert: true, 
		new: true	
	};

	Group.findOneAndUpdate(
		query,
		update,
		options,
		function(err, grp) {
			if (err) {
				console.error(Date.now() + "\n\n***** GROUP FINDONE ERROR: " + group.group + "\n" + err);
				callback("ERROR " + err, null);
			}
			else {
				console.log(chalkDb("->- DB UPDATE" 
					+ " | " + grp.groupId 
					+ " | ENTITIES: " + Object.keys(grp.entities) 
					+ " | NAME: " + grp.name 
					+ " | MNS: " + grp.mentions 
					+ " | TAGS: " + Object.keys(grp.tags) 
					+ " | CREATED: " + Date(grp.createdAt) 
					+ " | LAST SEEN: " + Date(grp.lastSeen) 
				));

				console.log("> GROUP UPDATED:" + JSON.stringify(grp, null, 2));

				callback(null, grp);

			}
		}
	);
}
