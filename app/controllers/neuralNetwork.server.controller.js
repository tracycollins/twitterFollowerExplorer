/*jslint node: true */
"use strict";

const chalk = require("chalk");

const chalkAlert = chalk.red;
const chalkInfo = chalk.yellow;
const chalkTest = chalk.bold.yellow;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.bold.yellow;
const chalkLog = chalk.gray;
const chalkDb = chalk.gray;

const moment = require("moment");
const NeuralNetwork = require("mongoose").model("NeuralNetwork");
const debug = require("debug")("nn");
const columnify = require("columnify");

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


exports.findOneNetwork = function (network, params, callback) {

	if (network.networkCreateMode === undefined) {
		network.networkCreateMode = "UNKNOWN";
	}

	const evolveCols = columnify(network.evolve, {  showHeaders: false, minWidth: 8, maxWidth: 16});
	const trainCols = columnify(network.train, {  showHeaders: false, minWidth: 8, maxWidth: 16});
	const testCols = columnify(network.test, {  showHeaders: false, minWidth: 8, maxWidth: 16});

	// console.log("> NW UPDATE"
	// 	+ " | " + network.networkId + " | " + network.networkCreateMode.toUpperCase()
	// 	+ "\nSUCCESS: " + network.successRate
	// 	+ "\nCREATED: " + moment(new Date(network.createdAt)).format(compactDateTimeFormat) 
	// 	+ "\nTYPE: " + network.networkType
	// 	+ "\nIN: " + network.network.input
	// 	+ "\nOUT: " + network.network.output
	// 	+ "\nEVOLVE\n" + evolveCols
	// 	+ "\nTRAIN\n" + trainCols
	// 	+ "\nTEST\n" + testCols
	// 	// + "\nNETWORK: " + jsonPrint(network.network) 
	// );

	// console.log("> NW UPDATED"
	// 	+ " | " + nw.networkId 
	// 	+ " | CREATED: " + moment(new Date(nw.createdAt)).format(compactDateTimeFormat) 
	// 	+ " | CREATE:  " + nw.networkCreateMode.toUpperCase()
	// 	+ " | SUCCESS: " + nw.successRate
	// 	+ " | IN:      " + nw.numInputs
	// 	+ " | OUT:     " + nw.numOutputs
	// 	// + "\nEVOLVE:  " + jsonPrint(nw.evolve) 
	// 	// + "\nTRAIN:   " + jsonPrint(nw.train)
	// 	// + "\nTEST:    " + jsonPrint(nw.test)
	// );

	const query = { networkId: network.networkId  };
	const update = { 
		"$set": { 
			networkType: network.networkType,
			networkCreateMode: network.networkCreateMode,
			network: network.network,
			createdAt: network.createdAt,
			numInputs: network.network.input,
			numOutputs: network.network.output,
			inputs: network.inputs,
			outputs: network.outputs,
			evolve: network.evolve,
			train: network.train,
			test: network.test,
			successRate: network.successRate
		}
	};

	const options = { 
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
					+ " | CREATED: " + moment(new Date(nw.createdAt)).format(compactDateTimeFormat) 
					+ " | CREATE:  " + nw.networkCreateMode.toUpperCase()
					+ " | SUCCESS: " + nw.successRate
					+ " | IN:      " + nw.numInputs
					+ " | OUT:     " + nw.numOutputs
					// + "\nEVOLVE:  " + jsonPrint(nw.evolve) 
					// + "\nTRAIN:   " + jsonPrint(nw.train)
					// + "\nTEST:    " + jsonPrint(nw.test)
				);
				callback(err, nw);
			}
		}
	);
};