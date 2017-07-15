var S = require("string");
var chalk = require("chalk");
var util = require("util");

var chalkAlert = chalk.red;
var chalkInfo = chalk.yellow;
var chalkTest = chalk.bold.yellow;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.bold.yellow;
var chalkLog = chalk.gray;
var chalkDb = chalk.gray;

var moment = require("moment");
var NeuralNetwork = require("mongoose").model("NeuralNetwork");
var debug = require("debug")("nn");

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
var compactDateTimeFormat = "YYYYMMDD_HHmmss";

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


exports.findOneNetwork = function (network, params, callback) {

	console.log("> NW UPDATE"
		+ " | " + network.networkId 
		+ "\nSUCCESS: " + network.successRate
		+ "\nTYPE: " + network.networkType
		+ "\nIN: " + network.inputs.length
		+ "\nOUT: " + network.outputs.length
		+ "\nEVOLVE: " + jsonPrint(network.evolve) 
		+ "\nTRAIN: " + jsonPrint(network.train)
		+ "\nTEST: " + jsonPrint(network.test)
		+ "\nCREATED: " + moment(new Date(network.createdAt)).format(compactDateTimeFormat) 
	);

	var query = { networkId: network.networkId  };
	var update = { 
		"$set": { 
			networkType: network.networkType,
			network: network.network,
			createdAt: network.createdAt,
			inputs: network.inputs,
			outputs: network.outputs,
			evolve: network.evolve,
			train: network.train,
			test: network.test,
			successRate: network.successRate
		}
	};

	var options = { 
		upsert: true, 
		setDefaultsOnInsert: true,
		new: true
	};

	NeuralNetwork.findOneAndUpdate(
		query,
		update,
		options,
		function(err, nw) {
			if (err) {
				console.log(moment().format(compactDateTimeFormat) + "\n\n***** NETWORK FINDONE ERROR: NETWORK ID: " + network.networkId + "\n" + err);
				if (err.code === 11000) {
					network.remove({networkId: network.networkId}, function(err){
						if (err) {
							console.log("REMOVED DUPLICATE NETWORK ERROR " + err + "\n" + network.networkId);
						}
						else {
							console.log("REMOVED DUPLICATE NETWORK " + network.networkId);
						}
					});
				}
				callback(err, network);
			}
			else {
				console.log("> NW UPDATED"
					+ " | " + nw.networkId 
					+ "\nSUCCESS: " + nw.successRate
					+ "\nTYPE: " + nw.networkType
					+ "\nIN: " + nw.inputs.length
					+ "\nOUT: " + nw.outputs.length
					+ "\nEVOLVE: " + jsonPrint(nw.evolve) 
					+ "\nTRAIN: " + jsonPrint(nw.train)
					+ "\nTEST: " + jsonPrint(nw.test)
					+ "\nCREATED: " + moment(new Date(nw.createdAt)).format(compactDateTimeFormat) 
				);
				callback(err, nw);
			}
		}
	);
}
