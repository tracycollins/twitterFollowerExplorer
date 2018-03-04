/*jslint node: true */
"use strict";

// let enableLog = true;

// const bestNetworkFolder = "/config/utility/best/neuralNetworks";
// const bestNetworkFile = "bestNetworkId";

const ONE_SECOND = 1000;
const MAX_Q_SIZE = 500;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const HashMap = require("hashmap").HashMap;
const networksHashMap = new HashMap();
let rxActivateNetworkQueue = [];
let maxQueueFlag = false;

let activateNetworkInterval;
let activateNetworkReady = false;

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

// const neataptic = require("neataptic");
const neataptic = require("./js/neataptic");

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

statsObj.allTimeLoadedNetworks = {};
statsObj.allTimeLoadedNetworks.multiNeuralNet = {};
statsObj.allTimeLoadedNetworks.multiNeuralNet.total = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.matchRate = 0.0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.successRate = 0.0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.match = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.mismatch = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.matchFlag = false;
statsObj.allTimeLoadedNetworks.multiNeuralNet.left = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.neutral = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.right = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.positive = 0;
statsObj.allTimeLoadedNetworks.multiNeuralNet.negative = 0;

statsObj.loadedNetworks = {};
statsObj.loadedNetworks.multiNeuralNet = {};
statsObj.loadedNetworks.multiNeuralNet.total = 0;
statsObj.loadedNetworks.multiNeuralNet.matchRate = 0.0;
statsObj.loadedNetworks.multiNeuralNet.successRate = 0.0;
statsObj.loadedNetworks.multiNeuralNet.match = 0;
statsObj.loadedNetworks.multiNeuralNet.mismatch = 0;
statsObj.loadedNetworks.multiNeuralNet.matchFlag = false;
statsObj.loadedNetworks.multiNeuralNet.left = 0;
statsObj.loadedNetworks.multiNeuralNet.neutral = 0;
statsObj.loadedNetworks.multiNeuralNet.right = 0;
statsObj.loadedNetworks.multiNeuralNet.positive = 0;
statsObj.loadedNetworks.multiNeuralNet.negative = 0;

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = false;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.total = 0;
statsObj.bestNetwork.match = 0;
statsObj.bestNetwork.mismatch = 0;
statsObj.bestNetwork.matchRate = 0;
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

function indexOfMax (arrIn, callback) {

  let arr = deepcopy(arrIn);

  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return callback(-1);
  }
  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("indexOfMax: ALL EQUAL: " + arr[0]));
    return callback(-1);
  }

  debug("B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  let max = arr[0];
  let maxIndex = 0;

  async.eachOfSeries(arr, function(val, index, cb){

    if (val > max) {
      maxIndex = index;
      max = val;
    }

    async.setImmediate(function() { cb(); });

  }, function(){

    debug(chalk.blue("indexOfMax: " + maxIndex 
      + " | " + arr[maxIndex].toFixed(2)
      + " | " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2)
    ));

    if (callback) {
      callback(maxIndex) ; 
    }
    else {
      return maxIndex;
    }

  });
}

const sortedObjectValues = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.obj);

    const sortedKeys = keys.sort(function(a,b){
      const objA = params.obj[a];
      const objB = params.obj[b];
      return objB[params.sortKey] - objA[params.sortKey];
    });

    if (keys.length !== undefined) {
      resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
    }
    else {
      console.error("sortedObjectValues ERROR | params\n" + jsonPrint(params));
      reject(new Error("ERROR"));
    }

  });
};

let generateNetworkInputBusy = false;
function generateNetworkInput(params, callback){

  generateNetworkInputBusy = true;

  const inputTypes = Object.keys(params.inputsObj.inputs).sort();
  let networkInput = [];
  let inputHits = [];

  async.eachSeries(inputTypes, function(inputType, cb0){

    debug("RNT | GENERATE NET INPUT | TYPE: " + inputType);

    const histogramObj = params.histograms[inputType];
    const networkInputTypeNames = params.inputsObj.inputs[inputType];

    async.eachSeries(networkInputTypeNames, function(inputName, cb1){

      const inputValue = histogramObj[inputName];

      if (inputValue !== undefined) {
        networkInput.push(inputValue);
        inputHits.push({type: inputType, inputName: inputName, inputValue: inputValue});
        debug(chalkLog("RNT | GENERATE NET INPUT"
          + " | IN LENGTH: " + networkInput.length
          + " | IN HITS: " + inputHits.length
          + " | @" + params.userScreenName
          + " | TYPE: " + inputType
          + " | " + inputName
          + " | " + inputValue
        ));
        async.setImmediate(function() { 
          cb1(); 
        });
      }
      else {
        networkInput.push(0);
        debug(chalkLog("RNT | GENERATE NET INPUT"
          + " | TYPE: " + inputType
          + " | " + inputName
          + " | 0"
        ));
        async.setImmediate(function() { 
          cb1(); 
        });
      }

    }, function(err){

      async.setImmediate(function() { 
        cb0(); 
      });

    });

  }, function(err){
    generateNetworkInputBusy = false;
    console.log("USER @" + params.userScreenName
      + " | inputsId: " + params.inputsObj.inputsId
      + " | inputHits\n" + jsonPrint(inputHits)
    );
    callback(err, networkInput);
  });
}

let activateNetworkBusy = false;
function activateNetwork2(user, callback){

  activateNetworkBusy = true;
  let networkOutput = {};
  let userHistograms = {};
  let languageAnalysis = {};

  userHistograms = deepcopy(user.histograms);
  languageAnalysis = deepcopy(user.languageAnalysis);

  async.eachSeries(networksHashMap.keys(), function(nnId, cb){

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
      userScreenName: user.screenName,
      histograms: userHistograms,
      languageAnalysis: languageAnalysis,
      inputsObj: networkObj.inputsObj
    };

    generateNetworkInput(params, function(err, networkInput){

      const out = networkObj.network.activate(networkInput);

      let output = deepcopy(out);

      if (output.length !== 3) {
        console.error(chalkError("*** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
        quit(" ZERO LENGTH NETWORK OUTPUT");
        output = [0,0,0];
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

function generateNetworksOutput(enableLog, title, networkOutputObj, expectedOutput, callback){

  generateNetworksOutputBusy = true;

  let arrayOfArrays = [];
  let bestNetworkOutput = [0,0,0];
  let multiNeuralNetOutput = [0,0,0];
  let statsTextArray = [];

  statsTextArray.push([
    "NNID",
    "SR",
    "ATOT",
    "AM",
    "AMM",
    "AMR",
    // "SR",
    "MFLAG",
    "OUTPUT",
    "TOT",
    " M",
    " MM",
    " MR"
  ]);

  async.each(Object.keys(networkOutputObj), function(nnId, cb){

    arrayOfArrays.push(networkOutputObj[nnId].output);

    const nnOutput = networkOutputObj[nnId].output;
    const nn = networksHashMap.get(nnId);

    if (statsObj.loadedNetworks[nnId] === undefined) {
      console.log(chalkAlert("INIT statsObj.loadNetworks " + nnId));
      statsObj.loadedNetworks[nnId] = {};
      statsObj.loadedNetworks[nnId].networkId = nnId;
      statsObj.loadedNetworks[nnId].inputsId = nn.inputsId;
      statsObj.loadedNetworks[nnId].numInputs = nn.numInputs;
      statsObj.loadedNetworks[nnId].output = [];
      statsObj.loadedNetworks[nnId].successRate = nn.successRate;
      statsObj.loadedNetworks[nnId].total = 0;
      statsObj.loadedNetworks[nnId].matchRate = 0.0;
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
      console.log(chalkAlert("INIT statsObj.allTimeLoadedNetworks " + nnId));
      statsObj.allTimeLoadedNetworks[nnId] = {};
      statsObj.allTimeLoadedNetworks[nnId].networkId = nnId;
      statsObj.allTimeLoadedNetworks[nnId].inputsId = nn.inputsId;
      statsObj.allTimeLoadedNetworks[nnId].numInputs = nn.numInputs;
      statsObj.allTimeLoadedNetworks[nnId].output = [];
      statsObj.allTimeLoadedNetworks[nnId].successRate = nn.successRate;
      statsObj.allTimeLoadedNetworks[nnId].total = 0;
      statsObj.allTimeLoadedNetworks[nnId].matchRate = 0.0;
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
      // statsObj.allTimeLoadedNetworks[nnId].matchFlag = "---";
    }

    statsTextArray.push([
      nnId,
      statsObj.allTimeLoadedNetworks[nnId].successRate.toFixed(2),
      statsObj.allTimeLoadedNetworks[nnId].total,
      statsObj.allTimeLoadedNetworks[nnId].match,
      statsObj.allTimeLoadedNetworks[nnId].mismatch,
      statsObj.allTimeLoadedNetworks[nnId].matchRate.toFixed(2),
      // statsObj.loadedNetworks[nnId].successRate.toFixed(2),
      statsObj.loadedNetworks[nnId].matchFlag,
      nnOutput,
      statsObj.loadedNetworks[nnId].total,
      statsObj.loadedNetworks[nnId].match,
      statsObj.loadedNetworks[nnId].mismatch,
      statsObj.loadedNetworks[nnId].matchRate.toFixed(2)
    ]);

    // async.setImmediate(function() {
      cb();
    // });

  }, function generateNetworksOutputAsyncCallback(){

    sortedObjectValues({ sortKey: "matchRate", obj: statsObj.loadedNetworks, max: 100})
    .then(function(sortedNetworkResults){

      debugger;

      let bnId = sortedNetworkResults.sortedKeys[0];

      if (bnId === "multiNeuralNet") { bnId = sortedNetworkResults.sortedKeys[1]; }
      
      statsObj.bestNetwork = deepcopy(statsObj.loadedNetworks[bnId]);

      debug(chalkAlert("sortedNetworkResults.sortedKeys\n" + jsonPrint(sortedNetworkResults.sortedKeys)));

      statsObj.bestNetwork.matchRate = (statsObj.bestNetwork.matchRate === undefined) ? 0 : statsObj.bestNetwork.matchRate;


      debug(chalkLog("BEST NETWORK"
        + " | " + statsObj.bestNetwork.networkId
        + " | SR: " + statsObj.bestNetwork.successRate.toFixed(2) + "%"
        + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
        + " | TOT: " + statsObj.bestNetwork.total
        + " | MATCH: " + statsObj.bestNetwork.match
      ));

      bestNetworkOutput = statsObj.bestNetwork.output;

      if ((statsObj.bestNetwork.networkId !== undefined) && (previousBestNetworkId !== statsObj.bestNetwork.networkId)) {

        console.log(chalkAlert("RNT | *** NEW BEST NETWORK"
          + " | " + statsObj.bestNetwork.networkId
          + " | " + statsObj.bestNetwork.numInputs + " IN"
          + " | IN ID: " + statsObj.bestNetwork.inputsId
          + " | SR: " + statsObj.bestNetwork.successRate.toFixed(2) + "%"
          + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
          + "\nRNT | PREV: " + previousBestNetworkId
          + " | PMR: " + previousBestNetworkMatchRate.toFixed(2) + "%"
        ));

        console.log(chalk.blue(
            "\n-------------------------------------------------------------------------------"
          + "\n" + title 
          + "\n-------------------------------------------------------------------------------\n"
          + table(statsTextArray, { align: [ "l", "r", "r", "r", "r", "r", "l", "r", "r", "r", "r", "r"] })
          + "\n-------------------------------------------------------------------------------"
        ));

        if (previousBestNetworkId) {
          previousBestNetworkMatchRate = statsObj.loadedNetworks[previousBestNetworkId].matchRate;
        }

        process.send({
          op: "BEST_MATCH_RATE", 
          networkId: statsObj.bestNetwork.networkId, 
          matchRate: statsObj.bestNetwork.matchRate,
          successRate: statsObj.bestNetwork.successRate, 
          inputsId: statsObj.bestNetwork.inputsId,
          numInputs: statsObj.bestNetwork.numInputs,
          previousBestNetworkId: previousBestNetworkId,
          previousBestMatchRate: previousBestNetworkMatchRate
        });

        previousBestNetworkId = statsObj.bestNetwork.networkId;
      }

      // Calculate MULTI network output, use for "Concensus" score

      const sumArray = arrayOfArrays.reduce(sum);
      let saNorm = deepcopy(sumArray);
      arrayNormalize(saNorm);

      let sumArrayNorm;

      indexOfMax(saNorm, function maxNetworkOutput(maxIndex){

        debug(chalkInfo("MAX INDEX: " + maxIndex));

        switch (maxIndex) {
          case 0:
            sumArrayNorm = [1,0,0];
          break;
          case 1:
            sumArrayNorm = [0,1,0];
          break;
          case 2:
            sumArrayNorm = [0,0,1];
          break;
          default:
            sumArrayNorm = [0,0,0];
        }

        if (expectedOutput) {

          statsObj.loadedNetworks.multiNeuralNet.total += 1;

          if ((sumArrayNorm[0] === expectedOutput[0])
            && (sumArrayNorm[1] === expectedOutput[1])
            && (sumArrayNorm[2] === expectedOutput[2])){

            statsObj.loadedNetworks.multiNeuralNet.match += 1;
            statsObj.loadedNetworks.multiNeuralNet.matchFlag = true;

          }
          else {
            statsObj.loadedNetworks.multiNeuralNet.mismatch += 1;
            statsObj.loadedNetworks.multiNeuralNet.matchFlag = false;
          }

          statsObj.loadedNetworks.multiNeuralNet.matchRate = 100.0 * statsObj.loadedNetworks.multiNeuralNet.match / statsObj.loadedNetworks.multiNeuralNet.total;
        }
        else {
          statsObj.loadedNetworks.multiNeuralNet.matchFlag = "---";
        }

        statsTextArray.push([
          "MULTI",
          "---",
          statsObj.allTimeLoadedNetworks.multiNeuralNet.total,
          statsObj.allTimeLoadedNetworks.multiNeuralNet.match,
          statsObj.allTimeLoadedNetworks.multiNeuralNet.mismatch,
          statsObj.allTimeLoadedNetworks.multiNeuralNet.matchRate.toFixed(2),
          // "---",
          statsObj.loadedNetworks.multiNeuralNet.matchFlag,
          sumArrayNorm,
          statsObj.loadedNetworks.multiNeuralNet.total,
          statsObj.loadedNetworks.multiNeuralNet.match,
          statsObj.loadedNetworks.multiNeuralNet.mismatch,
          statsObj.loadedNetworks.multiNeuralNet.matchRate.toFixed(2)
        ]);

        if (enableLog) {
          console.log(chalk.blue(
              "\n-------------------------------------------------------------------------------"
            + "\n" + title 
            + "\n-------------------------------------------------------------------------------\n"
            + table(statsTextArray, { align: [ "l", "r", "r", "r", "r", "r", "l", "r", "r", "r", "r", "r"] })
            + "\n-------------------------------------------------------------------------------"
          ));
        }
      });

      let results = {};
      results.bestNetwork = {};
      results.multiNetwork = {};
      results.bestNetworkId = statsObj.bestNetwork.networkId;
      results.multiNetworkIds = [];
      results.multiNetworkIds = sortedNetworkResults.sortedKeys;

      indexOfMax(sumArray, function sumArrayIndexOfMax (maxMultiOutputIndex){

        results.multiNetwork = {left: sumArray[0], neutral: sumArray[1], right: sumArray[2]};

        switch (maxMultiOutputIndex) {
          case 0:
            if (enableLog) { console.log(chalk.blue("XAKW | L | " + sumArray + " | " + maxMultiOutputIndex)); }
          break;
          case 1:
            if (enableLog) { console.log(chalk.blue("XAKW | N | " + sumArray + " | " + maxMultiOutputIndex)); }
          break;
          case 2:
            if (enableLog) { console.log(chalk.blue("XAKW | R | " + sumArray + " | " + maxMultiOutputIndex)); }
          break;
          default:
            if (enableLog) { console.log(chalk.blue("XAKW | 0 | " + sumArray + " | " + maxMultiOutputIndex)); }
        }

        indexOfMax(bestNetworkOutput, function bestNetworkOutputIndexOfMax(maxOutputIndex){

          switch (maxOutputIndex) {
            case 0:
              if (enableLog) { console.log(chalk.blue("NAKW | L | " + bestNetworkOutput + " | " + maxOutputIndex)); }
              results.bestNetwork.left = 100;
              results.keyword = "left";
            break;
            case 1:
              if (enableLog) { console.log(chalk.black("NAKW | N | " + bestNetworkOutput + " | " + maxOutputIndex)); }
              results.bestNetwork.neutral = 100;
              results.keyword = "neutral";
            break;
            case 2:
              if (enableLog) { console.log(chalk.red("NAKW | R | " + bestNetworkOutput + " | " + maxOutputIndex)); }
              results.bestNetwork.right = 100;
              results.keyword = "right";
            break;
            default:
              if (enableLog) { console.log(chalk.gray("NAKW | 0 | " + bestNetworkOutput + " | " + maxOutputIndex)); }
              results.bestNetwork.none = 100;
              results.keyword = "none";
          }
          generateNetworksOutputBusy = false;
          callback(null, results);
        });

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

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 100;

  console.log("\n------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(3) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(3);
    }
    else if (i === 2) {
      console.log("ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      console.log("ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
  });
}

function initActivateNetworkInterval(interval){

  clearInterval(activateNetworkInterval);

  console.log(chalkConnect("START NETWORK ACTIVATE INTERVAL"
    + " | INTERVAL: " + interval + " ms"
  ));

  activateNetworkReady = true;

  activateNetworkInterval = setInterval(function(){ 

    if (statsObj.networksLoaded && (rxActivateNetworkQueue.length > 0) && activateNetworkReady) {

      activateNetworkReady = false;

      const obj = rxActivateNetworkQueue.shift();

      statsObj.normalization = obj.normalization;

      if (maxQueueFlag && (rxActivateNetworkQueue.length < MAX_Q_SIZE)) {
        process.send({op: "QUEUE_READY", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_READY ERRROR"); }
        });
        maxQueueFlag = false;
      }
      else if (rxActivateNetworkQueue.length === 0){
        process.send({op: "QUEUE_EMPTY", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_EMPTY ERRROR"); }
        });
        maxQueueFlag = false;
      }

      if (!maxQueueFlag && (rxActivateNetworkQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("SEND QUEUE_FULL ERRROR"); }
        });
        maxQueueFlag = true;
      }

      activateNetwork2(obj.user, function(err, networkOutputObj){

        if (err){
          console.error(chalkError("ACTIVATE NETWORK ERROR"
            + " | @" + obj.user.screenName
            + " | " + obj.networkInput.length + " INPUTS"
            + " | " + err
          ));
          activateNetworkReady = true;
        }
        else {

          let kw = false;
          let nkwa = false;
          let expectedOutput = false;
          let title = "@" + obj.user.screenName;
          let enableLog = false;


          if (Object.keys(obj.user.keywords).length > 0) {
            kw = Object.keys(obj.user.keywords)[0];

            // enableLog = true;

            switch (kw) {
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

              // nkwa = Object.keys(results.bestNetwork)[0];
              nkwa = results.keyword;

              if (kw) {

                statsObj.categorize[nkwa] += 1;

                if ((kw === "left") || (kw === "neutral")|| (kw === "right")) {

                  statsObj.categorize.total += 1;

                  if (kw === nkwa) {

                    statsObj.categorize.match += 1;
                    statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;

                    console.log(chalk.blue("+++ AUTO KEYWORD MATCH"
                      + " | " + statsObj.bestNetwork.networkId
                      + " | " + statsObj.bestNetwork.numInputs + " IN"
                      + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                      + " | TOT: " + statsObj.bestNetwork.total
                      + " | MATCH: " + statsObj.bestNetwork.match
                      // + " | L: " + statsObj.bestNetwork.left
                      // + " | N: " + statsObj.bestNetwork.neutral
                      // + " | R: " + statsObj.bestNetwork.right
                      + " | @" + obj.user.screenName
                      + " | KWs: " + kw
                      + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                      + " | NKWAs: " + nkwa
                    ));

                  }
                  else {

                    statsObj.categorize.mismatch += 1;
                    statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;

                    console.log(chalk.gray("000 auto keyword miss "
                      + " | " + statsObj.bestNetwork.networkId
                      + " | " + statsObj.bestNetwork.numInputs + " IN"
                      + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                      + " | TOT: " + statsObj.bestNetwork.total
                      + " | MATCH: " + statsObj.bestNetwork.match
                      // + " | L: " + statsObj.bestNetwork.left
                      // + " | N: " + statsObj.bestNetwork.neutral
                      // + " | R: " + statsObj.bestNetwork.right
                      + " | @" + obj.user.screenName
                      + " | KWs: " + kw
                      + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                      + " | NKWAs: " + nkwa
                    ));
                  }
                }
                else {
                  debug(chalkLog("NETWORK OUT"
                      + " | RATE: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                      + " | TOT: " + statsObj.bestNetwork.total
                      + " | MATCH: " + statsObj.bestNetwork.match
                      + " | L: " + statsObj.bestNetwork.left
                      + " | N: " + statsObj.bestNetwork.neutral
                      + " | R: " + statsObj.bestNetwork.right
                      + " | @" + obj.user.screenName
                      + " | KWs: " + kw
                      + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                      + " | NKWAs: " + nkwa
                  ));
                }
              }
              else {
                debug(chalkLog("NETWORK OUT"
                  + " | RATE: " + statsObj.bestNetwork.matchRate.toFixed(2) + "%"
                  + " | TOT: " + statsObj.bestNetwork.total
                  + " | MATCH: " + statsObj.bestNetwork.match
                  + " | L: " + statsObj.bestNetwork.left
                  + " | N: " + statsObj.bestNetwork.neutral
                  + " | R: " + statsObj.bestNetwork.right
                  + " | @" + obj.user.screenName
                  + " | KWs: " + kw
                  + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                  + " | NKWAs: " + nkwa
                ));
              }
            }

            let messageObj = {};
            messageObj.op = "NETWORK_OUTPUT";
            messageObj.user = {};
            messageObj.user = obj.user;
            messageObj.bestNetwork = {};
            messageObj.bestNetwork = statsObj.bestNetwork;
            messageObj.keywordsAuto = {};
            messageObj.keywordsAuto = results.bestNetwork;
            messageObj.output = {};
            messageObj.output = networkOutputObj;

            process.send(messageObj);

            activateNetworkReady = true;

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
      // console.log("input node\n" + jsonPrint(node));
      if (node.name === undefined) {
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

  // console.log("networksObj\n" + jsonPrint(networksObj));
  debug("networksObj\n" + Object.keys(networksObj));

  const nnIds = Object.keys(networksObj);

  async.eachSeries(nnIds, function(nnId, cb){

    let networkObj = deepcopy(networksObj[nnId].network);

    console.log(chalkLog("RNT | LOAD NETWORK"
      + " | SR: " + networkObj.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
      + " | " + nnId
    ));

    const network = neataptic.Network.fromJSON(networkObj.network);

    networkObj.network = {};
    networkObj.network = network;

    getInputNames(network.nodes, function(err, inputNames){

      if (err) {
        return cb(err);
      }

      networkObj.matchRate = networkObj.matchRate || 0 ;

      networksHashMap.set(nnId, networkObj);

      // if (statsObj.loadedNetworks[nnId] === undefined) {
      //   statsObj.loadedNetworks[nnId] = {};
      //   statsObj.loadedNetworks[nnId].networkId = nnId;
      //   statsObj.loadedNetworks[nnId].numInputs = networkObj.numInputs;
      //   statsObj.loadedNetworks[nnId].inputsId = networkObj.inputsId;
      //   statsObj.loadedNetworks[nnId].successRate = networkObj.successRate;
      //   statsObj.loadedNetworks[nnId].matchRate = networkObj.matchRate;
      //   statsObj.loadedNetworks[nnId].total = 0;
      //   statsObj.loadedNetworks[nnId].match = 0;
      //   statsObj.loadedNetworks[nnId].mismatch = 0;
      //   statsObj.loadedNetworks[nnId].matchFlag = false;
      //   statsObj.loadedNetworks[nnId].left = 0;
      //   statsObj.loadedNetworks[nnId].right = 0;
      //   statsObj.loadedNetworks[nnId].neutral = 0;
      //   statsObj.loadedNetworks[nnId].positive = 0;
      //   statsObj.loadedNetworks[nnId].negative = 0;
      // }

      if (statsObj.loadedNetworks[nnId] === undefined) {
        console.log(chalkAlert("INIT statsObj.loadNetworks " + nnId));
        statsObj.loadedNetworks[nnId] = {};
        statsObj.loadedNetworks[nnId].networkId = nnId;
        statsObj.loadedNetworks[nnId].inputsId = networkObj.inputsId;
        statsObj.loadedNetworks[nnId].numInputs = networkObj.numInputs;
        statsObj.loadedNetworks[nnId].output = [];
        statsObj.loadedNetworks[nnId].successRate = networkObj.successRate;
        statsObj.loadedNetworks[nnId].matchRate = networkObj.matchRate;
        statsObj.loadedNetworks[nnId].total = 0;
        statsObj.loadedNetworks[nnId].matchRate = 0.0;
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
        console.log(chalkAlert("INIT statsObj.allTimeLoadedNetworks " + nnId));
        statsObj.allTimeLoadedNetworks[nnId] = {};
        statsObj.allTimeLoadedNetworks[nnId].networkId = nnId;
        statsObj.allTimeLoadedNetworks[nnId].inputsId = networkObj.inputsId;
        statsObj.allTimeLoadedNetworks[nnId].numInputs = networkObj.numInputs;
        statsObj.allTimeLoadedNetworks[nnId].output = [];
        statsObj.allTimeLoadedNetworks[nnId].successRate = networkObj.successRate;
        statsObj.allTimeLoadedNetworks[nnId].matchRate = networkObj.matchRate;
        statsObj.allTimeLoadedNetworks[nnId].total = 0;
        statsObj.allTimeLoadedNetworks[nnId].matchRate = 0.0;
        statsObj.allTimeLoadedNetworks[nnId].match = 0;
        statsObj.allTimeLoadedNetworks[nnId].mismatch = 0;
        statsObj.allTimeLoadedNetworks[nnId].matchFlag = false;
        statsObj.allTimeLoadedNetworks[nnId].left = 0;
        statsObj.allTimeLoadedNetworks[nnId].neutral = 0;
        statsObj.allTimeLoadedNetworks[nnId].right = 0;
        statsObj.allTimeLoadedNetworks[nnId].positive = 0;
        statsObj.allTimeLoadedNetworks[nnId].negative = 0;
      }

      cb();

    });

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
      + " | BEST: " + catStats.bestNetwork.networkId
      + " - " + catStats.bestNetwork.successRate.toFixed(2) + "% SR"
      + " - " + catStats.bestNetwork.matchRate.toFixed(2) + "% MR"
      + " | MR: " + catStats.matchRate.toFixed(2) + "%"
      + " | TOT: " + catStats.total
      + " | MATCH: " + catStats.match
      + " | L: " + catStats.left
      + " | N: " + catStats.neutral
      + " | R: " + catStats.right
    ));
  });
}

function busy(){
  if (loadNetworksBusy) { return true; }
  if (initializeBusy) { return true; }
  if (generateNetworksOutputBusy) { return true; }
  if (activateNetworkBusy) { return true; }
  if (generateNetworkInputBusy) { return true; }
  if (rxActivateNetworkQueue.length > 0) { return true; }

  return false;
}

function resetStats(callback){

  statsObj.categorize.endTime = moment().valueOf();
  statsObj.categorize.bestNetwork = statsObj.bestNetwork;
  statsObj.categorizeHistory.push(statsObj.categorize);

  printCategorizeHistory();

  console.log(chalkAlert("RNT | *** RESET_STATS ***"
    // + " | CAT LENGTH: " + statsObj.categorizeHistory.length
    // + " | S: " + moment(statsObj.categorize.startTime).format(compactDateTimeFormat)
    // + " E: " + moment(catStats.endTime).format(compactDateTimeFormat)
    // + " R: " + msToTime(statsObj.categorize.endTime - statsObj.categorize.startTime)
  ));

  statsObj.categorize = {};
  statsObj.categorize.startTime = moment().valueOf();
  statsObj.categorize.total = 0;
  statsObj.categorize.match = 0;
  statsObj.categorize.mismatch = 0;
  statsObj.categorize.matchRate = 0;
  statsObj.categorize.left = 0;
  statsObj.categorize.neutral = 0;
  statsObj.categorize.right = 0;
  statsObj.categorize.positive = 0;
  statsObj.categorize.negative = 0;

  statsObj.loadedNetworks.multiNeuralNet.networkId = "multiNeuralNet";
  statsObj.loadedNetworks.multiNeuralNet.successRate = 0;
  statsObj.loadedNetworks.multiNeuralNet.matchRate = 0;
  statsObj.loadedNetworks.multiNeuralNet.total = 0;
  statsObj.loadedNetworks.multiNeuralNet.match = 0;
  statsObj.loadedNetworks.multiNeuralNet.mismatch = 0;
  statsObj.loadedNetworks.multiNeuralNet.matchFlag = false;
  statsObj.loadedNetworks.multiNeuralNet.left = 0;
  statsObj.loadedNetworks.multiNeuralNet.right = 0;
  statsObj.loadedNetworks.multiNeuralNet.neutral = 0;
  statsObj.loadedNetworks.multiNeuralNet.positive = 0;
  statsObj.loadedNetworks.multiNeuralNet.negative = 0;

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
    // cb();

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
    // + "\n" + jsonPrint(m)
  ));

  switch (m.op) {

    case "INIT":
      console.log(chalkAlert("RNT INIT"
        + " | INTERVAL: " + m.interval
      ));
      initActivateNetworkInterval(m.interval);
      process.send({ op: "IDLE" });
    break;

    case "GET_BUSY":
      if (busy()) {
        process.send({ op: "BUSY" });
      }
      else {
        process.send({ op: "IDLE" });
      }
    break;

    case "STATS":
      showStats(m.options);
      if (busy()) {
        process.send({ op: "BUSY" });
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

    case "LOAD_NETWORKS":
      console.log(chalkAlert("LOAD_NETWORKS"
        + " | " + Object.keys(m.networksObj).length
        // + "\n" + jsonPrint(m.networksObj)
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

      debug(chalkInfo("ACTIVATE"
        + " [" + rxActivateNetworkQueue.length + "]"
        + " | " + m.obj.user.userId
        + " | @" + m.obj.user.screenName
        + " | KWs" + Object.keys(m.obj.user.keywords)
        // + " | " + m.obj.networkInput.length + " INPUTS"
      ));

      process.send({op: "NETWORK_BUSY"}, function(err){
        if (err) { quit("NETWORK_BUSY PROCESS SEND ERRROR"); }
      });

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
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | RNT | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        // const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
        console.error(chalkError(moment().format(compactDateTimeFormat) 
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

    saveFile(statsFolder, statsFile, statsObj);

    if (busy()) {
      process.send({ op: "BUSY" });
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

  cnf.statsUpdateIntervalTime = process.env.RNT_STATS_UPDATE_INTERVAL || 60000;

  debug("CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    initializeBusy = false;

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      quit(err);
    }
    console.log(chalkInfo(cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(cnf)));
    initStatsUpdate(cnf);
  });
}, 1 * ONE_SECOND);