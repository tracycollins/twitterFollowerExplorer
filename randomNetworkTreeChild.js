/*jslint node: true */
"use strict";

let start = process.hrtime();

let elapsed_time = function(note){
    const precision = 3; // 3 decimal places
    const elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start = process.hrtime(); // reset the timer
};

const ONE_SECOND = 1000;
const MAX_Q_SIZE = 500;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const HashMap = require("hashmap").HashMap;
const networksHashMap = new HashMap();
let rxActivateNetworkQueue = [];
let maxQueueFlag = false;
let maxInputHashMap = {};

let activateNetworkInterval;
let activateNetworkIntervalBusy = false;

let statsUpdateInterval;

let configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;

const os = require("os");
const util = require("util");
const moment = require("moment");
require("isomorphic-fetch");
// const Dropbox = require("dropbox").Dropbox;
const Dropbox = require("./js/dropbox").Dropbox;

const async = require("async");
const debug = require("debug")("rnt");
const debugCache = require("debug")("cache");
const arrayNormalize = require("array-normalize");
const deepcopy = require("deep-copy");
const table = require("text-table");

const neataptic = require("neataptic");
// const neataptic = require("./js/neataptic");

let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const chalk = require("chalk");
const chalkAlert = chalk.red;
// const chalkRed = chalk.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.blue;


const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

function getTimeStamp(inputTime) {
  let currentTimeStamp ;

  if (inputTime  === undefined) {
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

function msToTime(duration) {
  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));

  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return days + ":" + hours + ":" + minutes + ":" + seconds;
}

process.title = "node_randomNetworkTree";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

let initializeBusy = false;

let statsObj = {};

statsObj.networksLoaded = false;
statsObj.normalization = {};

statsObj.loadedNetworks = {};

statsObj.allTimeLoadedNetworks = {};
statsObj.allTimeLoadedNetworks.multiNeuralNet = {};
statsObj.allTimeLoadedNetworks.multiNeuralNet.total = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.matchRate = 0.0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.overallMatchRate = 0.0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.successRate = 0.0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.match = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.mismatch = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.matchFlag = false;
statsObj.allTimeLoadedNetworks.multiNeuralNet.left = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.neutral = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.right = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.positive = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.negative = 0;

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = false;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.overallMatchRate = 0;
statsObj.bestNetwork.total = 0;
statsObj.bestNetwork.match = 0;
statsObj.bestNetwork.mismatch = 0;
statsObj.bestNetwork.left = 0;
statsObj.bestNetwork.neutral = 0;
statsObj.bestNetwork.right = 0;
statsObj.bestNetwork.positive = 0;
statsObj.bestNetwork.negative = 0;

statsObj.categorizeHistory = [];

statsObj.categorize = {};
statsObj.categorize.bestNetwork = {};
statsObj.categorize.startTime = moment().valueOf();
statsObj.categorize.endTime = moment().valueOf();
statsObj.categorize.total = 0;
statsObj.categorize.match = 0;
statsObj.categorize.mismatch = 0;
statsObj.categorize.matchRate = 0;
statsObj.categorize.overallMatchRate = 0;
statsObj.categorize.left = 0;
statsObj.categorize.neutral = 0;
statsObj.categorize.right = 0;
statsObj.categorize.positive = 0;
statsObj.categorize.negative = 0;

statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

function showStats(options){
  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);

  if (options) {
    console.log("= NT STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.gray("= NT S"
      + " | E: " + statsObj.elapsed
      + " | S: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
    ));
  }
}

function quit(message) {
  let msg = "";
  if (message) { msg = message; }
  showStats(false);
  console.log(process.argv[1]
    + " | RANDOM NETWORK TREE: **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
    
  );
  clearInterval(statsUpdateInterval);
  clearInterval(activateNetworkInterval);
  process.exit();
}

function indexOfMax (arr, callback) {

  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return callback(-1);
  }
  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    return callback(-1);
  }

  arrayNormalize(arr);

  let max = arr[0];
  let maxIndex = 0;

  async.eachOfSeries(arr, function(val, index, cb){

    if (val > max) {
      maxIndex = index;
      max = val;
    }

    async.setImmediate(function() { cb(); });

  }, function(){

    callback(maxIndex) ; 

  });
}

const sortedObjectValues = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.obj);

    const sortedKeys = keys.sort(function(a,b){
      return params.obj[b][params.sortKey] - params.obj[a][params.sortKey];
    });

    if (keys.length !== undefined) {
      if (sortedKeys !== undefined) { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
      }
      else {
        resolve({sortKey: params.sortKey, sortedKeys: []});
      }

    }
    else {
      console.log("sortedObjectValues ERROR | params\n" + jsonPrint(params));
      reject(new Error("ERROR"));
    }

  });
};

let generateNetworkInputBusy = false;

function generateNetworkInputIndexed(params, callback){

  generateNetworkInputBusy = true;

  const inputTypes = Object.keys(params.inputsObj.inputs).sort();
  let networkInput = [];

  let indexOffset = 0;

  async.eachSeries(inputTypes, function(inputType, cb0){

    debug("RNT | GENERATE NET INPUT | TYPE: " + inputType);

    const histogramObj = params.histograms[inputType];
    const networkInputTypeNames = params.inputsObj.inputs[inputType];

    async.eachOf(networkInputTypeNames, function(inputName, index, cb1){

      if (histogramObj && (histogramObj[inputName] !== undefined)) {

        if ((params.maxInputHashMap === undefined) 
          || (params.maxInputHashMap[inputType] === undefined)) {

          // console.log(chalkAlert("??? UNDEFINED??? params.maxInputHashMap." + inputType + " | " + inputName
          //   + "\n" + Object.keys(params.maxInputHashMap)
          // ));

          networkInput[indexOffset + index] = 1;

          console.log(chalkLog("RNT | ??? UNDEFINED MAX INPUT"
            + " | IN ID: " + params.inputsObj.inputsId
            + " | IN LENGTH: " + networkInput.length
            + " | @" + params.userScreenName
            + " | TYPE: " + inputType
            + " | " + inputName
            + " | " + histogramObj[inputName]
          ));

          async.setImmediate(function() { 
            cb1(); 
          });

        }
        else {

          const inputValue = (params.maxInputHashMap[inputType][inputName] > 0) 
            ? histogramObj[inputName]/params.maxInputHashMap[inputType][inputName] 
            : 1;

          networkInput[indexOffset + index] = inputValue;

          async.setImmediate(function() {
            cb1();
          });
        }
      }
      else {

        networkInput[indexOffset + index] = 0;
 
        async.setImmediate(function() { 
          cb1(); 
        });
      }

    }, function(err){

      async.setImmediate(function() { 
        indexOffset += networkInputTypeNames.length;
        cb0(); 
      });

    });

  }, function(err){

    generateNetworkInputBusy = false;

    // elapsed_time("end generateNetworkInputIndexed");

    callback(err, networkInput);
  });
}

let activateNetworkBusy = false;

function activateNetwork2(user, callback){

  // elapsed_time("start activateNetwork2()");

  activateNetworkBusy = true;
  let networkOutput = {};
  let userHistograms = {};
  let languageAnalysis = {};

  userHistograms = user.histograms;
  languageAnalysis = user.languageAnalysis;

  async.each(networksHashMap.keys(), function(nnId, cb){

    const networkObj = networksHashMap.get(nnId);

    networkOutput[nnId] = {};
    networkOutput[nnId].output = [];
    networkOutput[nnId].left = statsObj.loadedNetworks[nnId].left;
    networkOutput[nnId].neutral = statsObj.loadedNetworks[nnId].neutral;
    networkOutput[nnId].right = statsObj.loadedNetworks[nnId].right;
    networkOutput[nnId].none = statsObj.loadedNetworks[nnId].none;
    networkOutput[nnId].positive = statsObj.loadedNetworks[nnId].positive;
    networkOutput[nnId].negative = statsObj.loadedNetworks[nnId].negative;

    if (networkObj.inputsObj.inputs === undefined) {
      console.log(chalkError("UNDEFINED NETWORK INPUTS OBJ | NETWORK OBJ KEYS: " + Object.keys(networkObj)));
    }

    const params = {
      networkId: networkObj.networkId,
      userScreenName: user.screenName,
      histograms: userHistograms,
      languageAnalysis: languageAnalysis,
      inputsObj: networkObj.inputsObj,
      maxInputHashMap: maxInputHashMap
    };

    generateNetworkInputIndexed(params, function(err, networkInput){

      const output = networkObj.network.activate(networkInput);

      if (output.length !== 3) {
        console.log(chalkError("*** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
        // quit("ZERO LENGTH NETWORK OUTPUT");
        return(cb("ZERO LENGTH NETWORK OUTPUT", networkOutput));
      }

      indexOfMax(output, function maxNetworkOutput(maxOutputIndex){

        switch (maxOutputIndex) {
          case 0:
            networkOutput[nnId].output = [1,0,0];
            networkOutput[nnId].left += 1;
          break;
          case 1:
            networkOutput[nnId].output = [0,1,0];
            networkOutput[nnId].neutral += 1;
          break;
          case 2:
            networkOutput[nnId].output = [0,0,1];
            networkOutput[nnId].right += 1;
          break;
          default:
            networkOutput[nnId].output = [0,0,0];
            networkOutput[nnId].none += 1;
        }

        async.setImmediate(function() {
          cb();
        });

      });
    });

  }, function(err){
    activateNetworkBusy = false;
    callback(err, networkOutput);
  });
}


const sum = (r, a) => r.map((b, i) => a[i] + b);

let previousBestNetworkId = false;
let previousBestNetworkMatchRate = 0;

let generateNetworksOutputBusy = false;

let arrayOfArrays = [];
let bestNetworkOutput = [0,0,0];
let statsTextArray = [];
let statsTextObj = {};
let nnIdArray = [];

function generateNetworksOutput(enableLog, title, networkOutputObj, expectedOutput, callback){

  generateNetworksOutputBusy = true;

  arrayOfArrays.length = 0;
  bestNetworkOutput = [0,0,0];
  statsTextArray.length = 0;
  statsTextObj = {};

  nnIdArray = Object.keys(networkOutputObj);

  async.eachOf(nnIdArray, function(nnId, index, cb){

    arrayOfArrays[index] = networkOutputObj[nnId].output;

    const nnOutput = networkOutputObj[nnId].output;
    const nn = networksHashMap.get(nnId);

    if (statsObj.loadedNetworks[nnId] === undefined) {
      debug(chalkAlert("INIT statsObj.loadNetworks " + nnId));
      statsObj.loadedNetworks[nnId] = {};
      statsObj.loadedNetworks[nnId].networkId = nnId;
      statsObj.loadedNetworks[nnId].inputsId = nn.inputsId;
      statsObj.loadedNetworks[nnId].numInputs = nn.numInputs;
      statsObj.loadedNetworks[nnId].output = [];
      statsObj.loadedNetworks[nnId].successRate = nn.successRate;
      statsObj.loadedNetworks[nnId].matchRate = nn.matchRate;
      statsObj.loadedNetworks[nnId].overallMatchRate = nn.overallMatchRate;
      statsObj.loadedNetworks[nnId].total = 0;
      statsObj.loadedNetworks[nnId].match = 0;
      statsObj.loadedNetworks[nnId].mismatch = 0;
      statsObj.loadedNetworks[nnId].matchFlag = false;
      statsObj.loadedNetworks[nnId].left = 0;
      statsObj.loadedNetworks[nnId].neutral = 0;
      statsObj.loadedNetworks[nnId].right = 0;
      statsObj.loadedNetworks[nnId].positive = 0;
      statsObj.loadedNetworks[nnId].negative = 0;
    }

    if (statsObj.allTimeLoadedNetworks[nnId] === undefined) {
      debug(chalkAlert("INIT statsObj.allTimeLoadedNetworks " + nnId));
      statsObj.allTimeLoadedNetworks[nnId] = {};
      statsObj.allTimeLoadedNetworks[nnId].networkId = nnId;
      statsObj.allTimeLoadedNetworks[nnId].inputsId = nn.inputsId;
      statsObj.allTimeLoadedNetworks[nnId].numInputs = nn.numInputs;
      statsObj.allTimeLoadedNetworks[nnId].output = [];
      statsObj.allTimeLoadedNetworks[nnId].successRate = nn.successRate;
      statsObj.allTimeLoadedNetworks[nnId].matchRate = nn.matchRate;
      statsObj.allTimeLoadedNetworks[nnId].overallMatchRate = nn.overallMatchRate;
      statsObj.allTimeLoadedNetworks[nnId].total = 0;
      statsObj.allTimeLoadedNetworks[nnId].match = 0;
      statsObj.allTimeLoadedNetworks[nnId].mismatch = 0;
      statsObj.allTimeLoadedNetworks[nnId].matchFlag = false;
      statsObj.allTimeLoadedNetworks[nnId].left = 0;
      statsObj.allTimeLoadedNetworks[nnId].neutral = 0;
      statsObj.allTimeLoadedNetworks[nnId].right = 0;
      statsObj.allTimeLoadedNetworks[nnId].positive = 0;
      statsObj.allTimeLoadedNetworks[nnId].negative = 0;
    }

    statsObj.loadedNetworks[nnId].output = nnOutput;

    if (expectedOutput[0] === 1 || expectedOutput[1] === 1 || expectedOutput[2] === 1) {

      statsObj.loadedNetworks[nnId].total += 1;
      statsObj.allTimeLoadedNetworks[nnId].total += 1;

      if ((nnOutput[0] === expectedOutput[0])
        && (nnOutput[1] === expectedOutput[1])
        && (nnOutput[2] === expectedOutput[2])){

        statsObj.loadedNetworks[nnId].match += 1;
        statsObj.loadedNetworks[nnId].matchFlag = true;
        statsObj.allTimeLoadedNetworks[nnId].match += 1;

      }
      else {
        statsObj.loadedNetworks[nnId].mismatch += 1;
        statsObj.allTimeLoadedNetworks[nnId].mismatch += 1;
        statsObj.loadedNetworks[nnId].matchFlag = false;
      }

      statsObj.loadedNetworks[nnId].matchRate = 100.0 * statsObj.loadedNetworks[nnId].match / statsObj.loadedNetworks[nnId].total;
      statsObj.allTimeLoadedNetworks[nnId].matchRate = 100.0 * statsObj.allTimeLoadedNetworks[nnId].match / statsObj.allTimeLoadedNetworks[nnId].total;
    }
    else {
      statsObj.loadedNetworks[nnId].matchFlag = "---";
    }

    statsTextObj[nnId] = {};
    statsTextObj[nnId] = [
      nnId,
      statsObj.allTimeLoadedNetworks[nnId].successRate.toFixed(2),
      statsObj.allTimeLoadedNetworks[nnId].total,
      statsObj.allTimeLoadedNetworks[nnId].match,
      statsObj.allTimeLoadedNetworks[nnId].mismatch,
      statsObj.allTimeLoadedNetworks[nnId].matchRate.toFixed(2),
      statsObj.loadedNetworks[nnId].matchFlag,
      nnOutput,
      statsObj.loadedNetworks[nnId].total,
      statsObj.loadedNetworks[nnId].match,
      statsObj.loadedNetworks[nnId].mismatch,
      statsObj.loadedNetworks[nnId].matchRate.toFixed(2)
    ];

    cb();

  }, function generateNetworksOutputAsyncCallback(){

    sortedObjectValues({ sortKey: "matchRate", obj: statsObj.loadedNetworks, max: 250})
    .then(function(sortedNetworkResults){

      let currentBestNetworkId = sortedNetworkResults.sortedKeys[0];

      // if (bnId === "multiNeuralNet") { bnId = sortedNetworkResults.sortedKeys[1]; }
      
      statsObj.bestNetwork = {};
      statsObj.bestNetwork = statsObj.loadedNetworks[currentBestNetworkId];

      debug(chalkAlert("sortedNetworkResults.sortedKeys\n" + jsonPrint(sortedNetworkResults.sortedKeys)));

      statsObj.bestNetwork.matchRate = (statsObj.bestNetwork.matchRate === undefined) ? 0 : statsObj.bestNetwork.matchRate;
      statsObj.bestNetwork.overallMatchRate = (statsObj.bestNetwork.overallMatchRate === undefined) ? 0 : statsObj.bestNetwork.overallMatchRate;

      debug(chalkLog("BEST NETWORK"
        + " | " + statsObj.bestNetwork.networkId
        + " | SR: " + statsObj.bestNetwork.successRate.toFixed(2) + "%"
        + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
        + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2) + "%"
        + " | TOT: " + statsObj.bestNetwork.total
        + " | MATCH: " + statsObj.bestNetwork.match
      ));

      bestNetworkOutput = statsObj.bestNetwork.output;

        // async.eachOf(sortedNetworkResults.sortedKeys, function genStatsTextArray(nnId, index, cb0){

        //   statsTextArray[index] = statsTextObj[nnId];

        //   async.setImmediate(function() { cb0(); });

        // }, function(){

        //   statsTextArray.length = Math.min(10, statsTextArray.length);
        //   statsTextArray.unshift([
        //     "NNID",
        //     "SR",
        //     "ATOT",
        //     "AM",
        //     "AMM",
        //     "AMR",
        //     "MFLAG",
        //     "OUTPUT",
        //     "TOT",
        //     " M",
        //     " MM",
        //     " MR"
        //   ]);

        //   console.log(chalk.blue(
        //       "\n-------------------------------------------------------------------------------"
        //     + "\n" + title 
        //     + "\n-------------------------------------------------------------------------------\n"
        //     + table(statsTextArray, { align: [ "l", "r", "r", "r", "r", "r", "l", "r", "r", "r", "r", "r"] })
        //     + "\n-------------------------------------------------------------------------------"
        //   ));

        // });

      if (previousBestNetworkId !== currentBestNetworkId) {

        console.log(chalkAlert("\n==================================================================\n"
          + "*** NEW BEST NETWORK ***"
          + "\nNETWORK ID:   " + statsObj.bestNetwork.networkId
          + "\nINPUTS ID:    " + statsObj.bestNetwork.inputsId
          + "\nINPUTS:       " + statsObj.bestNetwork.numInputs
          + "\nSR:           " + statsObj.bestNetwork.successRate.toFixed(2) + "%"
          + "\nMR:           " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
          + "\nOAMR:         " + statsObj.bestNetwork.overallMatchRate.toFixed(2) + "%"
          + "\nPREV BEST:    " + previousBestNetworkMatchRate.toFixed(2) + "%" + " | ID: " + previousBestNetworkId
          + "\n==================================================================\n"
        ));

        async.eachOf(sortedNetworkResults.sortedKeys, function genStatsTextArray(nnId, index, cb0){

          statsTextArray[index] = statsTextObj[nnId];

          async.setImmediate(function() { cb0(); });

        }, function(){

          statsTextArray.length = Math.min(10, statsTextArray.length);
          statsTextArray.unshift([
            "NNID",
            "SR",
            "ATOT",
            "AM",
            "AMM",
            "AMR",
            "MFLAG",
            "OUTPUT",
            "TOT",
            " M",
            " MM",
            " MR"
          ]);

          console.log(chalk.blue(
              "\n-------------------------------------------------------------------------------"
            + "\n" + title 
            + "\n-------------------------------------------------------------------------------\n"
            + table(statsTextArray, { align: [ "l", "r", "r", "r", "r", "r", "l", "r", "r", "r", "r", "r"] })
            + "\n-------------------------------------------------------------------------------"
          ));

        });

        if (previousBestNetworkId) {
          previousBestNetworkMatchRate = statsObj.loadedNetworks[previousBestNetworkId].matchRate;
        }

        process.send({
          op: "BEST_MATCH_RATE", 
          networkId: currentBestNetworkId, 
          matchRate: statsObj.bestNetwork.matchRate,
          overallMatchRate: statsObj.bestNetwork.overallMatchRate,
          successRate: statsObj.bestNetwork.successRate, 
          inputsId: statsObj.bestNetwork.inputsId,
          numInputs: statsObj.bestNetwork.numInputs,
          previousBestNetworkId: previousBestNetworkId,
          previousBestMatchRate: previousBestNetworkMatchRate
        });

        previousBestNetworkId = currentBestNetworkId;
      }

      let results = {};
      results.bestNetwork = {};
      results.bestNetworkId = statsObj.bestNetwork.networkId;

      indexOfMax(bestNetworkOutput, function bestNetworkOutputIndexOfMax(maxOutputIndex){

        switch (maxOutputIndex) {
          case 0:
            if (enableLog) { console.log(chalk.blue("NAKW | L | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.left = 100;
            results.categoryAuto = "left";
          break;
          case 1:
            if (enableLog) { console.log(chalk.black("NAKW | N | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.neutral = 100;
            results.categoryAuto = "neutral";
          break;
          case 2:
            if (enableLog) { console.log(chalk.red("NAKW | R | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.right = 100;
            results.categoryAuto = "right";
          break;
          default:
            if (enableLog) { console.log(chalk.gray("NAKW | 0 | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.none = 100;
            results.categoryAuto = "none";
        }

        generateNetworksOutputBusy = false;

        // elapsed_time("end generateNetworksOutputAsyncCallback()");

        callback(null, results);
      });

    })
    .catch(function(err){
      console.trace(chalkError("SORTER ERROR: " + err));
      generateNetworksOutputBusy = false;
      quit(err);
      callback(err, {});
    });


  });
}

function categoryToString(c) {

  if (c === undefined) {
    return "";
  }

  let cs = "";

  switch (c) {
    case "left":
      cs = "L";
    break;
    case "neutral":
      cs = "N";
    break;
    case "right":
      cs = "R";
    break;
    case "positive":
      cs = "+";
    break;
    case "negative":
      cs = "-";
    break;
    case "none":
      cs = "0";
    break;
  }

  return cs;
}

function initActivateNetworkInterval(interval){

  clearInterval(activateNetworkInterval);

  console.log(chalkConnect("START NETWORK ACTIVATE INTERVAL"
    + " | INTERVAL: " + interval + " ms"
  ));

  activateNetworkIntervalBusy = false;

  activateNetworkInterval = setInterval(function(){ 

    if (statsObj.networksLoaded && (rxActivateNetworkQueue.length > 0) && !activateNetworkIntervalBusy) {

      activateNetworkIntervalBusy = true;

      const obj = rxActivateNetworkQueue.shift();

      statsObj.normalization = obj.normalization;

      if (maxQueueFlag && (rxActivateNetworkQueue.length < MAX_Q_SIZE)) {
        process.send({op: "QUEUE_READY", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_READY ERROR"); }
        });
        maxQueueFlag = false;
      }
      else if (rxActivateNetworkQueue.length === 0){
        process.send({op: "QUEUE_EMPTY", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_EMPTY ERROR"); }
        });
        maxQueueFlag = false;
      }

      if (!maxQueueFlag && (rxActivateNetworkQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_FULL ERROR"); }
        });
        maxQueueFlag = true;
      }

      activateNetwork2(obj.user, function(err, networkOutputObj){

        if (err){
          console.log(chalkError("ACTIVATE NETWORK ERROR"
            + " | @" + obj.user.screenName
            + " | " + obj.networkInput.length + " INPUTS"
            + " | " + err
          ));
          activateNetworkIntervalBusy = false;
        }
        else {

          const category = obj.user.category;

          let expectedOutput = false;
          let title = "@" + obj.user.screenName;
          let enableLog = false;

          if (category) {

            switch (category) {
              case "left":
                expectedOutput = [1,0,0];
                title = title + " | MKW: LEFT";
              break;
              case "neutral":
                expectedOutput = [0,1,0];
                title = title + " | MKW: NEUTRAL";
              break;
              case "right":
                expectedOutput = [0,0,1];
                title = title + " | MKW: RIGHT";
              break;
              default:
                expectedOutput = [0,0,0];
                title = title + " | MKW: ---";
                enableLog = false;
             }
          }

          generateNetworksOutput(enableLog, title, networkOutputObj, expectedOutput, function(err, results){

            if (Object.keys(results.bestNetwork).length > 0){

              if (category) {

                statsObj.categorize[results.categoryAuto] += 1;

                if ((category === "left") || (category === "neutral")|| (category === "right")) {

                  statsObj.categorize.total += 1;

                  if (category === results.categoryAuto) {

                    statsObj.categorize.match += 1;
                    statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;

                    console.log(chalk.blue("+++ MATCH"
                      + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                      + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2) + "%"
                      + " | " + statsObj.bestNetwork.match + " / " + statsObj.bestNetwork.total
                      + " | " + statsObj.bestNetwork.networkId
                      + " | " + statsObj.bestNetwork.numInputs + " IN"
                      + " | C: " + categoryToString(category)
                      + " | CA: " + categoryToString(results.categoryAuto)
                      + " | @" + obj.user.screenName
                    ));

                  }
                  else {

                    statsObj.categorize.mismatch += 1;
                    statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;

                    console.log(chalk.black("000 MISS "
                      + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                      + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2) + "%"
                      + " | " + statsObj.bestNetwork.match + " / " + statsObj.bestNetwork.total
                      + " | " + statsObj.bestNetwork.networkId
                      + " | " + statsObj.bestNetwork.numInputs + " IN"
                      + " | C: " + categoryToString(category)
                      + " | CA: " + categoryToString(results.categoryAuto)
                      + " | @" + obj.user.screenName
                    ));

                  }
                }
                else {

                  console.log(chalk.gray("___ignore"
                    + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                    + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2) + "%"
                    + " | " + statsObj.bestNetwork.match + " / " + statsObj.bestNetwork.total
                    + " | " + statsObj.bestNetwork.networkId
                    + " | " + statsObj.bestNetwork.numInputs + " IN"
                    + " | C: " + categoryToString(category)
                    + " | CA: " + categoryToString(results.categoryAuto)
                    + " | @" + obj.user.screenName
                  ));

                }
              }
              else {
                console.log(chalk.gray("--- uncat"
                  + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                  + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2) + "%"
                  + " | " + statsObj.bestNetwork.match + " / " + statsObj.bestNetwork.total
                  + " | " + statsObj.bestNetwork.networkId
                  + " | " + statsObj.bestNetwork.numInputs + " IN"
                  + " | C: " + categoryToString(category)
                  + " | CA: " + categoryToString(results.categoryAuto)
                  + " | @" + obj.user.screenName
                ));
              }
            }

            let messageObj = {};
            messageObj.op = "NETWORK_OUTPUT";
            messageObj.queue = rxActivateNetworkQueue.length;
            messageObj.user = {};
            messageObj.user = obj.user;
            messageObj.bestNetwork = {};
            messageObj.bestNetwork = statsObj.bestNetwork;
            messageObj.category = obj.user.category;
            messageObj.categoryAuto = results.categoryAuto;
            messageObj.output = {};
            messageObj.output = networkOutputObj;

            process.send(messageObj, function(){
              activateNetworkIntervalBusy = false;
            });

          });

        }
      });
    }

  }, interval);
}

function getInputNames(nodes, callback){

  let inputNames = [];

  async.eachSeries(nodes, function(node, cb){
    if (node.type === "input") {
      if (node.name === undefined) {
        console.log(chalkError("NODE NAME UNDEFINED"));
        return cb("NODE NAME UNDEFINED");
      }
      inputNames.push(node.name);
      async.setImmediate(function() { cb(); });
    }
    else {
      async.setImmediate(function() { cb(); });
    }
  }, function(err){
    callback(err, inputNames);
  });
}

let loadNetworksBusy = false;

function loadNetworks(networksObj, callback){

  loadNetworksBusy = true;

  debug("networksObj\n" + Object.keys(networksObj));

  const nnIds = Object.keys(networksObj);

  async.eachSeries(nnIds, function(nnId, cb){

    let networkObj = deepcopy(networksObj[nnId].network);

    networkObj.overallMatchRate = networkObj.overallMatchRate || networkObj.matchRate;

    const network = neataptic.Network.fromJSON(networkObj.network);

    networkObj.network = {};
    networkObj.network = network;

    networkObj.matchRate = networkObj.matchRate || 0 ;
    networkObj.overallMatchRate = networkObj.overallMatchRate || 0 ;

    networksHashMap.set(nnId, networkObj);

    if (statsObj.loadedNetworks[nnId] === undefined) {
      statsObj.loadedNetworks[nnId] = {};
      statsObj.loadedNetworks[nnId].networkId = nnId;
      statsObj.loadedNetworks[nnId].inputsId = networkObj.inputsId;
      statsObj.loadedNetworks[nnId].numInputs = networkObj.numInputs;
      statsObj.loadedNetworks[nnId].output = [];
      statsObj.loadedNetworks[nnId].successRate = networkObj.successRate;
      statsObj.loadedNetworks[nnId].matchRate = networkObj.matchRate;
      statsObj.loadedNetworks[nnId].overallMatchRate = networkObj.overallMatchRate;
      statsObj.loadedNetworks[nnId].total = 0;
      statsObj.loadedNetworks[nnId].match = 0;
      statsObj.loadedNetworks[nnId].mismatch = 0;
      statsObj.loadedNetworks[nnId].matchFlag = false;
      statsObj.loadedNetworks[nnId].left = 0;
      statsObj.loadedNetworks[nnId].neutral = 0;
      statsObj.loadedNetworks[nnId].right = 0;
      statsObj.loadedNetworks[nnId].positive = 0;
      statsObj.loadedNetworks[nnId].negative = 0;
    }

    if (statsObj.allTimeLoadedNetworks[nnId] === undefined) {
      statsObj.allTimeLoadedNetworks[nnId] = {};
      statsObj.allTimeLoadedNetworks[nnId].networkId = nnId;
      statsObj.allTimeLoadedNetworks[nnId].inputsId = networkObj.inputsId;
      statsObj.allTimeLoadedNetworks[nnId].numInputs = networkObj.numInputs;
      statsObj.allTimeLoadedNetworks[nnId].output = [];
      statsObj.allTimeLoadedNetworks[nnId].successRate = networkObj.successRate;
      statsObj.allTimeLoadedNetworks[nnId].matchRate = networkObj.matchRate;
      statsObj.allTimeLoadedNetworks[nnId].overallMatchRate = networkObj.overallMatchRate;
      statsObj.allTimeLoadedNetworks[nnId].total = 0;
      statsObj.allTimeLoadedNetworks[nnId].match = 0;
      statsObj.allTimeLoadedNetworks[nnId].mismatch = 0;
      statsObj.allTimeLoadedNetworks[nnId].matchFlag = false;
      statsObj.allTimeLoadedNetworks[nnId].left = 0;
      statsObj.allTimeLoadedNetworks[nnId].neutral = 0;
      statsObj.allTimeLoadedNetworks[nnId].right = 0;
      statsObj.allTimeLoadedNetworks[nnId].positive = 0;
      statsObj.allTimeLoadedNetworks[nnId].negative = 0;
    }

    console.log(chalkLog("RNT | LOAD NETWORK"
      + " | [ " + networksHashMap.size + " NNs IN HM ]"
      + " | SR: " + networkObj.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
      + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
      + " | " + nnId
    ));


    cb();

  }, function(err){

    loadNetworksBusy = false;

    if (callback) { callback(err); }

  });
}

function printCategorizeHistory(){
  console.log(chalkAlert("RNT CATGORIZE HISTORY ==========================================="));
  statsObj.categorizeHistory.forEach(function(catStats){
    console.log(chalkAlert("RNT CATGORIZE HISTORY"
      + " | S: " + moment(catStats.startTime).format(compactDateTimeFormat)
      + " E: " + moment(catStats.endTime).format(compactDateTimeFormat)
      + " R: " + msToTime(catStats.endTime - catStats.startTime)
      + "\nBEST: " + catStats.bestNetwork.networkId
      + " - " + catStats.bestNetwork.successRate.toFixed(2) + "% SR"
      + " - MR: " + catStats.bestNetwork.matchRate.toFixed(2) + "% MR"
      + " - OAMR:" + catStats.bestNetwork.overallMatchRate.toFixed(2) + "% MR"
      + "\nMR: " + catStats.matchRate.toFixed(2) + "%"
      + " | OAMR: " + catStats.overallMatchRate.toFixed(2) + "%"
      + " | TOT: " + catStats.total
      + " | MATCH: " + catStats.match
      + " | L: " + catStats.left
      + " | N: " + catStats.neutral
      + " | R: " + catStats.right
    ));
  });
}

function busy(){
  if (loadNetworksBusy) { return "loadNetworksBusy"; }
  if (initializeBusy) { return "initializeBusy"; }
  if (generateNetworksOutputBusy) { return "generateNetworksOutputBusy"; }
  if (activateNetworkBusy) { return "activateNetworkBusy"; }
  if (activateNetworkIntervalBusy) { return "activateNetworkIntervalBusy"; }
  if (generateNetworkInputBusy) { return "generateNetworkInputBusy"; }
  if (rxActivateNetworkQueue.length > MAX_Q_SIZE) { return "rxActivateNetworkQueue"; }

  return false;
}

function resetStats(callback){

  statsObj.categorize.endTime = moment().valueOf();
  statsObj.categorize.bestNetwork = statsObj.bestNetwork;
  statsObj.categorizeHistory.push(statsObj.categorize);

  printCategorizeHistory();

  console.log(chalkAlert("RNT | *** RESET_STATS ***"
  ));

  statsObj.categorize = {};
  statsObj.categorize.startTime = moment().valueOf();
  statsObj.categorize.total = 0;
  statsObj.categorize.match = 0;
  statsObj.categorize.mismatch = 0;
  statsObj.categorize.matchRate = 0;
  statsObj.categorize.overallMatchRate = 0;
  statsObj.categorize.left = 0;
  statsObj.categorize.neutral = 0;
  statsObj.categorize.right = 0;
  statsObj.categorize.positive = 0;
  statsObj.categorize.negative = 0;

  async.each(networksHashMap.keys(), function(nnId, cb){

    console.log(chalkLog("RNT | RESET NETWORK STATS"
      + " | " + nnId
    ));

    const networkObj = networksHashMap.get(nnId);

    networkObj.matchRate = 0 ;

    networksHashMap.set(nnId, networkObj);

    statsObj.loadedNetworks[nnId] = {};
    statsObj.loadedNetworks[nnId].networkId = nnId;
    statsObj.loadedNetworks[nnId].inputsId = networkObj.inputsId;
    statsObj.loadedNetworks[nnId].numInputs = networkObj.numInputs;
    statsObj.loadedNetworks[nnId].total = 0;
    statsObj.loadedNetworks[nnId].successRate = networkObj.successRate;
    statsObj.loadedNetworks[nnId].overallMatchRate = networkObj.overallMatchRate;
    statsObj.loadedNetworks[nnId].matchRate = 0;
    statsObj.loadedNetworks[nnId].match = 0;
    statsObj.loadedNetworks[nnId].mismatch = 0;
    statsObj.loadedNetworks[nnId].matchFlag = false;
    statsObj.loadedNetworks[nnId].left = 0;
    statsObj.loadedNetworks[nnId].right = 0;
    statsObj.loadedNetworks[nnId].neutral = 0;
    statsObj.loadedNetworks[nnId].positive = 0;
    statsObj.loadedNetworks[nnId].negative = 0;

    async.setImmediate(function() { cb(); });

  }, function(err){
    if (callback) { callback(err); }
  });
}

process.on("SIGHUP", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** SIGHUP ***"));
  quit("SIGHUP");
});

process.on("SIGINT", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** SIGINT ***"));
  quit("SIGINT");
});

process.on("message", function(m) {

  debug(chalkAlert("RNT RX MESSAGE"
    + " | OP: " + m.op
    + " | KEYS: " + Object.keys(m)
  ));

  let cause;

  switch (m.op) {

    case "INIT":
      console.log(chalkAlert("RNT INIT"
        + " | INTERVAL: " + m.interval
      ));
      initActivateNetworkInterval(m.interval);
      process.send({ op: "IDLE" });
    break;

    case "LOAD_MAX_INPUTS_HASHMAP":
      maxInputHashMap = {};
      maxInputHashMap = deepcopy(m.maxInputHashMap);
      console.log(chalkAlert("RNT LOAD_MAX_INPUTS_HASHMAP"
        + " | " + Object.keys(maxInputHashMap)
      ));
    break;

    case "GET_BUSY":
      cause = busy();
      if (cause) {
        process.send({ op: "BUSY", cause: cause });
      }
      else {
        process.send({ op: "IDLE" });
      }
    break;

    case "STATS":
      showStats(m.options);
      if (busy()) {
        process.send({ op: "BUSY", cause: busy() });
      }
      else {
        process.send({ op: "IDLE" });
      }
    break;

    case "GET_STATS":
      process.send({ op: "STATS", statsObj: statsObj }, function(err){
        if (err) { quit("STATS PROCESS SEND ERRROR"); }
      });
    break;

    case "RESET_STATS":
      resetStats();
    break;

    case "QUIT":
      process.send({ op: "IDLE" });
      quit("QUIT OP");
    break;

    case "LOAD_NETWORKS":
      console.log(chalkAlert("RNT | LOAD_NETWORKS"
        + " | " + Object.keys(m.networksObj).length + " NNs"
      ));
      loadNetworks(m.networksObj, function(){
        statsObj.networksLoaded = true;
        process.send({op: "NETWORK_READY"}, function(err){
          if (err) { quit("NETWORK_READY PROCESS SEND ERRROR"); }
        });
      });
    break;
    
    case "ACTIVATE":

      rxActivateNetworkQueue.push(m.obj);

      debug(chalkInfo("### ACTIVATE"
        + " [" + rxActivateNetworkQueue.length + "]"
        + " | " + getTimeStamp()
        + " | " + m.obj.user.nodeId
        + " | @" + m.obj.user.screenName
        + " | C: " + m.obj.user.category
      ));

      process.send({op: "NETWORK_BUSY"}, function(err){
        if (err) { quit("NETWORK_BUSY PROCESS SEND ERRROR"); }
      });

      if (!maxQueueFlag && (rxActivateNetworkQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_FULL ERROR"); }
        });
        maxQueueFlag = true;
      }

    break;
    
    default:
      console.log(chalkError("RANDOM NETWORK TREE | UNKNOWN OP ERROR"
        + " | " + m.op
        + "\n" + jsonPrint(m)
      ));
  }
});


const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_RNT_CONFIG_FILE = process.env.DROPBOX_RNT_CONFIG_FILE || "randomNetworkTreeConfig.json";
const DROPBOX_RNT_STATS_FILE = process.env.DROPBOX_RNT_STATS_FILE || "randomNetworkTreeStats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigFile = hostname + "_" + DROPBOX_RNT_CONFIG_FILE;
const statsFolder = "/stats/" + hostname;
const statsFile = DROPBOX_RNT_STATS_FILE;

console.log("DROPBOX_RNT_CONFIG_FILE: " + DROPBOX_RNT_CONFIG_FILE);
console.log("DROPBOX_RNT_STATS_FILE : " + DROPBOX_RNT_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function saveFile (path, file, jsonObj, callback){

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null, response); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.log(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.log(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.log(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        // const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
        console.log(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          // + " | ERROR\n" + jsonPrint(error)
          + " | ERROR: " + error
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
}

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    // saveFile(statsFolder, statsFile, statsObj);

    if (busy()) {
      process.send({ op: "BUSY", cause: busy() });
    }
    else {
      process.send({ op: "IDLE" });
    }

  }, cnf.statsUpdateIntervalTime);
}

function initialize(cnf, callback){

  initializeBusy = true;

  if (debug.enabled || debugCache.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.RNT_PROCESS_NAME || "randomNetworkTree";

  cnf.verbose = process.env.RNT_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.RNT_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.RNT_TEST_MODE || false ;
  cnf.quitOnError = process.env.RNT_QUIT_ON_ERROR || false ;

  cnf.statsUpdateIntervalTime = process.env.RNT_STATS_UPDATE_INTERVAL || 1000;

  debug("CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    initializeBusy = false;

    if (err && (err.status !== 404)) {
      console.log(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      quit(err);
    }
    console.log(chalkInfo(cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(cnf)));
    initStatsUpdate(cnf);
  });
}, 1 * ONE_SECOND);