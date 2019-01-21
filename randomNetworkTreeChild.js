/*jslint node: true */
"use strict";

const DEFAULT_INPUT_TYPES = [
  "emoji", 
  "hashtags",  
  "images", 
  "locations", 
  "media", 
  "mentions", 
  "places", 
  "sentiment", 
  "urls", 
  "userMentions", 
  "words"
];

DEFAULT_INPUT_TYPES.sort();

let start = process.hrtime();

let elapsed_time = function(note){
    const precision = 3; // 3 decimal places
    const elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    console.log("RNT | " + process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start = process.hrtime(); // reset the timer
};

const DEFAULT_INPUTS_BINARY_MODE = false;

const MAX_SORT_NETWORKS = 500;
const ONE_SECOND = 1000;
const MAX_Q_SIZE = 2000;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const HashMap = require("hashmap").HashMap;
const networksHashMap = new HashMap();
let rxActivateNetworkQueue = [];
let maxQueueFlag = false;
let maxInputHashMap = {};

let sortedNetworkResults = {};

let loadNetworksBusy = false;
let activateNetworkInterval;
let activateNetworkIntervalBusy = false;

let statsUpdateInterval;

let configuration = {};
configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;

const os = require("os");
const util = require("util");
const moment = require("moment");
const treeify = require("treeify");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();

const fetch = require("isomorphic-fetch");

const Dropbox = require("dropbox").Dropbox;

const async = require("async");
const debug = require("debug")("rnt");
const debugCache = require("debug")("cache");
const arrayNormalize = require("array-normalize");
const deepcopy = require("deep-copy");
const table = require("text-table");

const neataptic = require("neataptic");
// const neataptic = require("./js/neataptic");

let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const chalk = require("chalk");
const chalkAlert = chalk.red;
// const chalkRed = chalk.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.blue;
const chalkMiss = chalk.keyword("orange");


const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
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

  let sign = 1;

  if (duration < 0) {
    sign = -1;
    duration = -duration;
  }

  let seconds = parseInt((duration / 1000) % 60);
  let minutes = parseInt((duration / (1000 * 60)) % 60);
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  let days = parseInt(duration / (1000 * 60 * 60 * 24));
  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  if (sign > 0) return days + ":" + hours + ":" + minutes + ":" + seconds;
  return "- " + days + ":" + hours + ":" + minutes + ":" + seconds;
}

process.title = "node_randomNetworkTree";
console.log("\n\nRNT | =================================");
console.log("RNT | HOST:          " + hostname);
console.log("RNT | PROCESS TITLE: " + process.title);
console.log("RNT | PROCESS ID:    " + process.pid);
console.log("RNT | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("RNT | =================================");

let initializeBusy = false;

let statsObj = {};

statsObj.networksLoaded = false;
statsObj.normalization = {};

statsObj.loadedNetworks = {};

statsObj.allTimeLoadedNetworks = {};

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = false;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.overallMatchRate = 0;
statsObj.bestNetwork.testCycles = 0;
statsObj.bestNetwork.total = 0;
statsObj.bestNetwork.match = 0;
statsObj.bestNetwork.mismatch = 0;
statsObj.bestNetwork.left = 0;
statsObj.bestNetwork.neutral = 0;
statsObj.bestNetwork.right = 0;
statsObj.bestNetwork.positive = 0;
statsObj.bestNetwork.negative = 0;

statsObj.currentBestNetwork = {};
statsObj.currentBestNetwork.networkId = false;
statsObj.currentBestNetwork.successRate = 0;
statsObj.currentBestNetwork.matchRate = 0;
statsObj.currentBestNetwork.overallMatchRate = 0;
statsObj.currentBestNetwork.testCycles = 0;
statsObj.currentBestNetwork.total = 0;
statsObj.currentBestNetwork.match = 0;
statsObj.currentBestNetwork.mismatch = 0;
statsObj.currentBestNetwork.left = 0;
statsObj.currentBestNetwork.neutral = 0;
statsObj.currentBestNetwork.right = 0;
statsObj.currentBestNetwork.positive = 0;
statsObj.currentBestNetwork.negative = 0;

statsObj.categorizeHistory = [];

statsObj.categorize = {};
statsObj.categorize.bestNetwork = {};
statsObj.categorize.startTime = moment().valueOf();
statsObj.categorize.endTime = moment().valueOf();
statsObj.categorize.grandTotal = 0;
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
statsObj.categorize.skipped = 0;

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
    console.log("RNT | = NT STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.gray("RNT | == * == S"
      + " | E: " + statsObj.elapsed
      + " | S: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
    ));
  }
}

function quit(message) {
  let msg = "";
  let exitCode = 0;
  if (message) { 
    msg = message;
    exitCode = 1;
  }
  showStats(false);
  console.log("RNT | " + process.argv[1]
    + " | RANDOM NETWORK TREE: **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
    
  );
  clearInterval(statsUpdateInterval);
  clearInterval(activateNetworkInterval);
  setTimeout(function(){
    process.exit(exitCode);
  }, 3000);
}

function indexOfMax (arr) {

  return new Promise(function(resolve, reject){

    if (arr.length === 0) {
      console.log(chalkAlert("RNT | indexOfMax: 0 LENG ARRAY: -1"));
      return reject(new Error("0 LENG ARRAY"));
    }
    if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
      return resolve(-1);
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

      resolve(maxIndex) ; 

    });

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
      console.log("RNT | sortedObjectValues ERROR | params\n" + jsonPrint(params));
      reject(new Error("ERROR"));
    }

  });
};

let generateNetworkInputBusy = false;


function printNetworkInput(params){

  return new Promise(function(resolve, reject){

    const inputArray = params.inputsObj.input;
    const nameArray = params.inputsObj.name;
    const columns = params.columns || 100;

    let col = 0;
    let row = 0;

    let hitRowArray = [];

    let inputText = ".";
    let text = "";
    let textRow = "";
    let index = 0;
    let hits = 0;
    let hitRate = 0;
    const inputArraySize = inputArray.length;

    async.eachOfSeries(inputArray, function(input, index, cb){

      if (input) {
        inputText = "X";
        hits += 1;
        hitRate = 100 * hits / inputArraySize;
        hitRowArray.push(nameArray[index]);
      }
      else {
        inputText = ".";
      }

      textRow += inputText;
      col += 1;
      index += 1;

      if ((col === columns) || (index === inputArraySize)){

        text += textRow;
        text += " | " + hitRowArray;
        text += "\n";

        textRow = "";
        col = 0;
        row += 1;
        hitRowArray = [];
      }

      cb();

    }, function(err){
      resolve();
      console.log(chalkLog(
        "______________________________________________________________________________________________________________________________________"
        + "\n" + hits + " / " + inputArraySize + " | HIT RATE: " + hitRate.toFixed(2) + "% | " + params.title
        + "\n" + text
        ));
    });

  });
}

function generateNetworkInputIndexed(params){

  return new Promise(function(resolve, reject){

    generateNetworkInputBusy = true;

    const inputTypes = Object.keys(params.inputsObj.inputs).sort();
    let networkInput = [];
    let networkInputName = [];

    let indexOffset = 0;

    async.eachSeries(inputTypes, function(inputType, cb0){

      debug("RNT | GENERATE NET INPUT | TYPE: " + inputType);

      const histogramObj = params.histograms[inputType];
      const networkInputTypeNames = params.inputsObj.inputs[inputType];

      async.eachOf(networkInputTypeNames, function(inputName, index, cb1){

        if (histogramObj && (histogramObj[inputName] !== undefined)) {

          networkInputName[indexOffset + index] = inputName;

          if (configuration.inputsBinaryMode) {
            networkInput[indexOffset + index] = 1;
            return cb1();
          }

          let inputValue = 0;

          if (maxInputHashMap[inputType] === undefined) {

            maxInputHashMap[inputType] = {};
            maxInputHashMap[inputType][inputName] = histogramObj[inputName];

            networkInput[indexOffset + index] = 1;

            console.log(chalkLog("RNT | MAX INPUT TYPE UNDEFINED"
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

            // generate maxInputHashMap on the fly if needed
            // should backfill previous input values when new max is found

            if (maxInputHashMap[inputType][inputName] === undefined) {

              maxInputHashMap[inputType][inputName] = histogramObj[inputName];

              console.log(chalkLog("RNT | MAX INPUT NAME UNDEFINED"
                + " | IN ID: " + params.inputsObj.inputsId
                + " | IN LENGTH: " + networkInput.length
                + " | @" + params.userScreenName
                + " | TYPE: " + inputType
                + " | " + inputName
                + " | " + histogramObj[inputName]
              ));
            }
            else if (histogramObj[inputName] > maxInputHashMap[inputType][inputName]) {

              const previousMaxInput = maxInputHashMap[inputType][inputName]; 

              maxInputHashMap[inputType][inputName] = histogramObj[inputName];

              console.log(chalkLog("RNT | MAX INPUT VALUE UPDATED"
                + " | IN ID: " + params.inputsObj.inputsId
                + " | CURR IN INDEX: " + networkInput.length + "/" + params.inputsObj.meta.numInputs
                + " | @" + params.userScreenName
                + " | TYPE: " + inputType
                + " | " + inputName
                + " | PREV MAX: " + previousMaxInput
                + " | CURR MAX: " + maxInputHashMap[inputType][inputName]
              ));
            }

            // let inputValue = 0;

            networkInput[indexOffset + index] = (maxInputHashMap[inputType][inputName] > 0) 
              ? histogramObj[inputName]/maxInputHashMap[inputType][inputName] 
              : 1;

            // networkInput[indexOffset + index] = inputValue;

            async.setImmediate(function() {
              cb1();
            });
          }
        }
        else {

          networkInputName[indexOffset + index] = false;
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

      if (err) { return reject(err); }
      generateNetworkInputBusy = false;
      resolve({ name: networkInputName, input: networkInput });
    });

  });
}

let activateNetworkBusy = false;

function activateNetwork(params){

  return new Promise(async function(resolve, reject){

    activateNetworkBusy = true;

    let networkOutput = {};

    try {
      let userHistograms = await mergeHistograms.merge({ histogramA: params.user.profileHistograms, histogramB: params.user.tweetHistograms });

      let languageAnalysis = params.user.languageAnalysis;

      async.each(networksHashMap.keys(), async function(nnId){

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
          console.log(chalkError("RNT | UNDEFINED NETWORK INPUTS OBJ | NETWORK OBJ KEYS: " + Object.keys(networkObj)));
          return ("UNDEFINED NETWORK INPUTS OBJ");
        }

        const generateNetworkInputIndexedParams = {
          networkId: networkObj.networkId,
          userScreenName: params.user.screenName,
          histograms: userHistograms,
          languageAnalysis: languageAnalysis,
          inputsObj: networkObj.inputsObj
        };

        try {

          const networkInputObj = await generateNetworkInputIndexed(generateNetworkInputIndexedParams);

          const output = networkObj.network.activate(networkInputObj.input);

          if (output.length !== 3) {
            console.log(chalkError("RNT | *** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
            activateNetworkBusy = false;
            return("ZERO LENGTH NETWORK OUTPUT");
          }

          const maxOutputIndex = await indexOfMax(output);

          let categoryAuto;

          switch (maxOutputIndex) {
            case 0:
              categoryAuto = "left";
              networkOutput[nnId].output = [1,0,0];
              networkOutput[nnId].left += 1;
            break;
            case 1:
              categoryAuto = "neutral";
              networkOutput[nnId].output = [0,1,0];
              networkOutput[nnId].neutral += 1;
            break;
            case 2:
              categoryAuto = "right";
              networkOutput[nnId].output = [0,0,1];
              networkOutput[nnId].right += 1;
            break;
            default:
              categoryAuto = "none";
              networkOutput[nnId].output = [0,0,0];
              networkOutput[nnId].none += 1;
          }

          const match = (categoryAuto === params.user.category) ? "MATCH" : "MISS";

          if (configuration.verbose) {
            printNetworkInput({
              title: networkObj.networkId
              + " | @" + params.user.screenName 
              + " | C: " + params.user.category 
              + " | A: " + categoryAuto
              + " | MATCH: " + match
              + "\n" + jsonPrint(userHistograms),
              inputsObj: networkInputObj
            });
          }

          return;

        }
        catch(err){
          console.log(chalkError("RNT | *** ERROR ACTIVATE NETWORK: " + err));
          activateNetworkBusy = false;
          return reject(err);
        }
      }, function(err){

        if (err) {
          console.log(chalkError("RNT | *** ACTIVATE NETWORK ERROR: " + err));
          return reject(err);
        }

        activateNetworkBusy = false;

        resolve({
          user: params.user,
          networkOutput: networkOutput
        });
        
      });

    }
    catch(err){

      activateNetworkBusy = false;

      console.log(chalkError("RNT | *** ACTIVATE NETWORK ERROR: " + err));
      reject(err);
    }

  });
}

function printNetworkResults(params){

  let statsTextArray = [];

  return new Promise(function(resolve, reject){

    async.eachOf(sortedNetworkResults.sortedKeys, function genStatsTextArray(nnId, index, cb0){

      statsTextArray[index] = statsTextObj[nnId];

      async.setImmediate(function() { cb0(); });

    }, function(){

      statsTextArray.unshift([
        "RNT | NNID",
        "INPUTSID",
        "INPUTS",
        "OAMR",
        "SR",
        "ATOT",
        "AM",
        "AMM",
        "AMR",
        "TCs",
        "TCH",
        "MFLAG",
        "OUTPUT",
        "TOT",
        " M",
        " MM",
        " MR"
      ]);

      console.log(chalk.blue(
          "\nRNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
        + "\nRNT | " + params.title 
        + "\nRNT | -------------------------------------------------------------------------------------------------------------------------------------------------\n"
        + table(statsTextArray, { align: [ "l", "l", "r", "r", "r", "r", "r", "r", "r", "r", "r", "l", "r", "r", "r", "r", "r"] })
        + "\nRNT | -------------------------------------------------------------------------------------------------------------------------------------------------"
      ));

      resolve();

    });

  });

}

const sum = (r, a) => r.map((b, i) => a[i] + b);

let previousBestNetworkId = false;
let previousBestNetworkMatchRate = 0;

let generateNetworksOutputBusy = false;

let arrayOfArrays = [];

let currentBestNetworkOutput = [0,0,0];
let bestNetworkOutput = [0,0,0];

let statsTextObj = {};
let nnIdArray = [];

function generateNetworksOutput(params){

  return new Promise(function(resolve, reject){

    let networkOutput = params.networkOutput;
    let expectedOutput = params.expectedOutput;
    let title = params.title;

    generateNetworksOutputBusy = true;

    arrayOfArrays.length = 0;
    bestNetworkOutput = [0,0,0];
    currentBestNetworkOutput = [0,0,0];
    statsTextObj = {};

    nnIdArray = Object.keys(networkOutput);

    async.eachOf(nnIdArray, function(nnId, index, cb){

      arrayOfArrays[index] = networkOutput[nnId].output;

      const nnOutput = networkOutput[nnId].output;
      let nn = networksHashMap.get(nnId);

      if (!nn || nn === undefined) {
        quit();
      }

      if (statsObj.loadedNetworks[nnId] === undefined) {
        console.log(chalkAlert("INIT statsObj.loadNetworks " + nnId));
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
        console.log(chalkAlert("INIT statsObj.allTimeLoadedNetworks " + nnId));
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
        nn.total = statsObj.loadedNetworks[nnId].total;

        if ((nnOutput[0] === expectedOutput[0])
          && (nnOutput[1] === expectedOutput[1])
          && (nnOutput[2] === expectedOutput[2])){

          statsObj.loadedNetworks[nnId].match += 1;
          statsObj.loadedNetworks[nnId].matchFlag = true;
          statsObj.allTimeLoadedNetworks[nnId].match += 1;
          nn.match = statsObj.loadedNetworks[nnId].match;

        }
        else {
          statsObj.loadedNetworks[nnId].mismatch += 1;
          statsObj.allTimeLoadedNetworks[nnId].mismatch += 1;
          statsObj.loadedNetworks[nnId].matchFlag = false;
        }

        statsObj.loadedNetworks[nnId].matchRate = 100.0 * statsObj.loadedNetworks[nnId].match / statsObj.loadedNetworks[nnId].total;
        statsObj.allTimeLoadedNetworks[nnId].matchRate = 100.0 * statsObj.allTimeLoadedNetworks[nnId].match / statsObj.allTimeLoadedNetworks[nnId].total;

        nn.matchRate = statsObj.loadedNetworks[nnId].matchRate;
        
      }
      else {
        statsObj.loadedNetworks[nnId].matchFlag = "---";
      }

      networksHashMap.set(nnId, nn);

      statsTextObj[nnId] = {};
      statsTextObj[nnId] = [
        "RNT | " + nnId,
        statsObj.allTimeLoadedNetworks[nnId].inputsId,
        statsObj.allTimeLoadedNetworks[nnId].numInputs,
        statsObj.allTimeLoadedNetworks[nnId].overallMatchRate.toFixed(2),
        statsObj.allTimeLoadedNetworks[nnId].successRate.toFixed(2),
        statsObj.allTimeLoadedNetworks[nnId].total,
        statsObj.allTimeLoadedNetworks[nnId].match,
        statsObj.allTimeLoadedNetworks[nnId].mismatch,
        statsObj.allTimeLoadedNetworks[nnId].matchRate.toFixed(2),
        statsObj.allTimeLoadedNetworks[nnId].testCycles,
        statsObj.allTimeLoadedNetworks[nnId].testCycleHistory.length,
        statsObj.loadedNetworks[nnId].matchFlag,
        nnOutput,
        statsObj.loadedNetworks[nnId].total,
        statsObj.loadedNetworks[nnId].match,
        statsObj.loadedNetworks[nnId].mismatch,
        statsObj.loadedNetworks[nnId].matchRate.toFixed(2)
      ];

      cb();

    }, async function generateNetworksOutputAsyncCallback(){

      try {

        sortedNetworkResults = await sortedObjectValues({ sortKey: "matchRate", obj: statsObj.loadedNetworks, max: MAX_SORT_NETWORKS});

        if (!sortedNetworkResults) { 
          generateNetworksOutputBusy = false;
          console.log(chalkAlert("RNT | *** ERROR NO sortedNetworkResults??"));
          return reject(new Error("NO RESULTS"));
        }

        let currentBestNetworkId = sortedNetworkResults.sortedKeys[0];
        
        statsObj.currentBestNetwork = {};
        statsObj.currentBestNetwork = statsObj.loadedNetworks[currentBestNetworkId];
        statsObj.currentBestNetwork.matchRate = (statsObj.currentBestNetwork.matchRate === undefined) ? 0 : statsObj.currentBestNetwork.matchRate;
        statsObj.currentBestNetwork.overallMatchRate = (statsObj.currentBestNetwork.overallMatchRate === undefined) ? 0 : statsObj.currentBestNetwork.overallMatchRate;
        statsObj.currentBestNetwork.testCycles = (statsObj.currentBestNetwork.testCycles === undefined) ? 0 : statsObj.currentBestNetwork.testCycles;

        debug(chalkLog("CURRENT BEST NETWORK"
          + " | " + statsObj.currentBestNetwork.networkId
          + " | SR: " + statsObj.currentBestNetwork.successRate.toFixed(2) + "%"
          + " | MR: " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
          + " | OAMR: " + statsObj.currentBestNetwork.overallMatchRate.toFixed(2) + "%"
          + " | TOT: " + statsObj.currentBestNetwork.total
          + " | MATCH: " + statsObj.currentBestNetwork.match
        ));

        currentBestNetworkOutput = statsObj.currentBestNetwork.output;
        bestNetworkOutput = statsObj.loadedNetworks[statsObj.bestNetwork.networkId].output;

        if (statsObj.categorize.grandTotal % 100 === 0) {
          await printNetworkResults({title: title});
        }

        if (previousBestNetworkId !== currentBestNetworkId) {

          console.log(chalk.bold.blue("\nRNT | ==================================================================\n"
            + "RNT | *** NEW CURRENT BEST NETWORK ***"
            + "\nRNT | NETWORK ID:   " + statsObj.currentBestNetwork.networkId
            + "\nRNT | INPUTS ID:    " + statsObj.currentBestNetwork.inputsId
            + "\nRNT | INPUTS:       " + statsObj.currentBestNetwork.numInputs
            + "\nRNT | SR:           " + statsObj.currentBestNetwork.successRate.toFixed(2) + "%"
            + "\nRNT | MR:           " + statsObj.currentBestNetwork.matchRate.toFixed(2) + "%"
            + "\nRNT | OAMR:         " + statsObj.currentBestNetwork.overallMatchRate.toFixed(2) + "%"
            + "\nRNT | TCs:          " + statsObj.currentBestNetwork.testCycles
            + "\nRNT | TCH:          " + statsObj.currentBestNetwork.testCycleHistory.length
            + "\nRNT | PREV BEST:    " + previousBestNetworkMatchRate.toFixed(2) + "%" + " | ID: " + previousBestNetworkId
            + "\nRNT | ==================================================================\n"
          ));

          await printNetworkResults({title: title});

          if (previousBestNetworkId) {
            previousBestNetworkMatchRate = statsObj.loadedNetworks[previousBestNetworkId].matchRate;
          }

          process.send({
            op: "BEST_MATCH_RATE", 
            networkId: currentBestNetworkId, 
            matchRate: statsObj.currentBestNetwork.matchRate,
            overallMatchRate: statsObj.currentBestNetwork.overallMatchRate,
            successRate: statsObj.currentBestNetwork.successRate, 
            inputsId: statsObj.currentBestNetwork.inputsId,
            numInputs: statsObj.currentBestNetwork.numInputs,
            previousBestNetworkId: previousBestNetworkId,
            previousBestMatchRate: previousBestNetworkMatchRate
          });

          previousBestNetworkId = currentBestNetworkId;
        }

        let results = {};

        results.bestNetwork = {};
        results.currentBestNetwork = {};

        results.bestNetworkId = statsObj.bestNetwork.networkId;
        results.currentBestNetworkId = statsObj.currentBestNetwork.networkId;


        let maxOutputIndex = await indexOfMax(currentBestNetworkOutput);

        switch (maxOutputIndex) {
          case 0:
            if (params.enableLog) { console.log(chalk.blue("RNT | NAKW | L | " + currentBestNetworkOutput + " | " + maxOutputIndex)); }
            results.currentBestNetwork.left = 100;
            results.currentBestNetwork.categoryAuto = "left";
          break;
          case 1:
            if (params.enableLog) { console.log(chalk.black("RNT | NAKW | N | " + currentBestNetworkOutput + " | " + maxOutputIndex)); }
            results.currentBestNetwork.neutral = 100;
            results.currentBestNetwork.categoryAuto = "neutral";
          break;
          case 2:
            if (params.enableLog) { console.log(chalk.red("RNT | NAKW | R | " + currentBestNetworkOutput + " | " + maxOutputIndex)); }
            results.currentBestNetwork.right = 100;
            results.currentBestNetwork.categoryAuto = "right";
          break;
          default:
            if (params.enableLog) { console.log(chalk.gray("RNT | NAKW | 0 | " + currentBestNetworkOutput + " | " + maxOutputIndex)); }
            results.currentBestNetwork.none = 100;
            results.currentBestNetwork.categoryAuto = "none";
        }

        maxOutputIndex = await indexOfMax(bestNetworkOutput);

        switch (maxOutputIndex) {
          case 0:
            if (params.enableLog) { console.log(chalk.blue("RNT | NAKW | L | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.left = 100;
            results.bestNetwork.categoryAuto = "left";
          break;
          case 1:
            if (params.enableLog) { console.log(chalk.black("RNT | NAKW | N | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.neutral = 100;
            results.bestNetwork.categoryAuto = "neutral";
          break;
          case 2:
            if (params.enableLog) { console.log(chalk.red("RNT | NAKW | R | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.right = 100;
            results.bestNetwork.categoryAuto = "right";
          break;
          default:
            if (params.enableLog) { console.log(chalk.gray("RNT | NAKW | 0 | " + bestNetworkOutput + " | " + maxOutputIndex)); }
            results.bestNetwork.none = 100;
            results.bestNetwork.categoryAuto = "none";
        }

        generateNetworksOutputBusy = false;

        resolve(results);
      }
      catch(err){
        console.trace(chalkError("RNT | *** generateNetworksOutput ERROR: " + err));
        generateNetworksOutputBusy = false;
        reject(err);
      };

    });

  });
}

function categoryToString(c) {

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
    case false:
      cs = "false";
    break;
    case undefined:
      cs = "undefined";
    break;
    case null:
      cs = "null";
    break;
    default:
      cs = "?";
  }

  return cs;
}

function printActivateResult(prefix, nn, category, categoryAuto, screenName){
  console.log(chalkInfo(prefix
    + " | OAMR: " + nn.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + nn.matchRate.toFixed(2) + "%"
    + " | SR: " + nn.successRate.toFixed(2) + "%"
    + " | " + nn.match + " / " + nn.total + " [ " + statsObj.categorize.skipped + " SKP | " + statsObj.categorize.grandTotal + " GTOT ]"
    + " | TC: " + nn.testCycles
    + " | TCH: " + nn.testCycleHistory.length
    + " | " + nn.networkId
    + " | " + nn.numInputs + " IN"
    + " | C: " + categoryToString(category)
    + " | CA: " + categoryToString(categoryAuto)
    + " | @" + screenName
  ));
}

function initActivateNetworkInterval(interval){

  return new Promise(function(resolve, reject){

    clearInterval(activateNetworkInterval);

    console.log(chalkConnect("RNT | START NETWORK ACTIVATE INTERVAL"
      + " | INTERVAL: " + interval + " ms"
    ));

    activateNetworkIntervalBusy = false;

    let messageObj = {};
    messageObj.op = "NETWORK_OUTPUT";
    messageObj.queue = rxActivateNetworkQueue.length;
    messageObj.user;
    messageObj.bestNetwork;
    messageObj.currentBestNetwork;
    messageObj.category = "none";
    messageObj.categoryAuto = "none";
    messageObj.output;

    let generateNetworksOutputParams = {};

    activateNetworkInterval = setInterval(async function(){ 

      if (statsObj.networksLoaded && (rxActivateNetworkQueue.length > 0) && !activateNetworkIntervalBusy) {

        activateNetworkIntervalBusy = true;

        const activateNetworkObj = rxActivateNetworkQueue.shift();

        messageObj.user = activateNetworkObj.user;

        // console.log("activateNetworkObj.user keys: " + Object.keys(activateNetworkObj.user));

        statsObj.normalization = activateNetworkObj.normalization;

        if (maxQueueFlag && (rxActivateNetworkQueue.length < MAX_Q_SIZE)) {
          process.send({op: "QUEUE_READY", queue: rxActivateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_READY | " + err));
              quit("SEND QUEUE_READY ERROR");
            }
          });
          maxQueueFlag = false;
        }
        else if (rxActivateNetworkQueue.length === 0){
          process.send({op: "QUEUE_EMPTY", queue: rxActivateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_EMPTY | " + err));
              quit("SEND QUEUE_EMPTY ERROR");
            }
          });
          maxQueueFlag = false;
        }

        if (!maxQueueFlag && (rxActivateNetworkQueue.length >= MAX_Q_SIZE)) {
          process.send({op: "QUEUE_FULL", queue: rxActivateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_FULL | " + err));
              quit("SEND QUEUE_FULL ERROR");
            }
          });
          maxQueueFlag = true;
        }

        try {

          const activateNetworkResults = await activateNetwork({ user: activateNetworkObj.user });

          let title = "@" + activateNetworkResults.user.screenName;

          let category = activateNetworkResults.user.category;
          let expectedOutput;
          let enableLog = false;

          if (category == "left") {
            expectedOutput = [1,0,0];
            title = title + " | MKW: LEFT";
          }
          else if (category == "neutral") {
            expectedOutput = [0,1,0];
            title = title + " | MKW: NEUTRAL";
          }
          else if (category == "right") {
            expectedOutput = [0,0,1];
            title = title + " | MKW: RIGHT";
          }
          else {
            category = false;
            expectedOutput = [0,0,0];
            title = title + " | MKW: ---";
            enableLog = false;
          }

          generateNetworksOutputParams = {
            enableLog: enableLog,
            title: title,
            networkOutput: activateNetworkResults.networkOutput,
            expectedOutput: expectedOutput
          }

          const generateNetworksOutputObj = await generateNetworksOutput(generateNetworksOutputParams);

          if (Object.keys(generateNetworksOutputObj.bestNetwork).length > 0){

            statsObj.categorize.grandTotal += 1;

            if (category) {

              statsObj.categorize[generateNetworksOutputObj.bestNetwork.categoryAuto] += 1;

              if ((category === "left") || (category === "neutral")|| (category === "right")) {

                statsObj.categorize.total += 1;

                if (category === generateNetworksOutputObj.bestNetwork.categoryAuto) {

                  statsObj.categorize.match += 1;
                  statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;

                  if (configuration.verbose || configuration.testMode || (statsObj.categorize.grandTotal % 100 === 0)) {
                    printActivateResult(

                      "RNT | ✔✔✔ MATCH ", 
                      statsObj.bestNetwork, 
                      category, 
                      generateNetworksOutputObj.bestNetwork.categoryAuto, 
                      activateNetworkObj.user.screenName
                    );
                  }

                }
                else {

                  statsObj.categorize.mismatch += 1;
                  statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;

                  if (configuration.verbose || configuration.testMode  || (statsObj.categorize.grandTotal % 100 === 0)) {
                    printActivateResult(
                      "RNT | ---  miss ", 
                      statsObj.bestNetwork, 
                      category, 
                      generateNetworksOutputObj.bestNetwork.categoryAuto, 
                      activateNetworkObj.user.screenName
                    );
                  }

                }
              }
              else {
                statsObj.categorize.skipped += 1;

                if (configuration.verbose || configuration.testMode  || (statsObj.categorize.grandTotal % 100 === 0)) {
                  printActivateResult(
                    "RNT |      skip ", 
                    statsObj.bestNetwork, 
                    category, 
                    generateNetworksOutputObj.bestNetwork.categoryAuto, 
                    activateNetworkObj.user.screenName
                  );
                }
              }
            }
            else {
              statsObj.categorize.skipped += 1;

              if (configuration.verbose || configuration.testMode  || (statsObj.categorize.grandTotal % 100 === 0)) {
                printActivateResult(
                  "RNT |      skip ", 
                  statsObj.bestNetwork, 
                  category, 
                  generateNetworksOutputObj.bestNetwork.categoryAuto, 
                  activateNetworkObj.user.screenName
                );
              }
            }
          }

          messageObj.queue = rxActivateNetworkQueue.length;
          messageObj.user = activateNetworkResults.user;
          messageObj.bestNetwork = statsObj.bestNetwork;
          messageObj.currentBestNetwork = statsObj.currentBestNetwork;
          messageObj.category = category;
          messageObj.categoryAuto = generateNetworksOutputObj.bestNetwork.categoryAuto;
          messageObj.output = activateNetworkResults;

          process.send(messageObj, function(){
            activateNetworkIntervalBusy = false;
          });

        }
        catch(err){

          console.trace(chalkError("RNT | *** ACTIVATE NETWORK ERROR"
            + " | @" + activateNetworkObj.user.screenName
            + " | " + err
          ));

          activateNetworkIntervalBusy = false;

        }

      }

    }, interval);

  });
}

function getInputNames(nodes, callback){

  let inputNames = [];

  async.eachSeries(nodes, function(node, cb){
    if (node.type === "input") {
      if (node.name === undefined) {
        console.log(chalkError("RNT | *** NODE NAME UNDEFINED"));
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

function loadNetwork(params){

  return new Promise(function(resolve, reject){

    let networkObj = params.networkObj;

    if (!networkObj || networkObj === undefined || networkObj.network === undefined) {
      console.log(chalkError("RNT | *** LOAD NETWORK UNDEFINED: " + networkObj));
      return reject(new Error("LOAD NETWORK UNDEFINED"));
    }

    let network = neataptic.Network.fromJSON(networkObj.network);

    networkObj.network = {};
    networkObj.network = network;

    networkObj.testCycles = (networkObj.testCycles !== undefined) ? networkObj.testCycles : 0 ;
    networkObj.testCycleHistory = (networkObj.testCycleHistory !== undefined) ? networkObj.testCycleHistory : [] ;
    networkObj.successRate = (networkObj.successRate !== undefined) ? networkObj.successRate : 0 ;
    networkObj.matchRate = (networkObj.matchRate !== undefined) ? networkObj.matchRate : 0 ;
    networkObj.overallMatchRate = (networkObj.overallMatchRate !== undefined) ? networkObj.overallMatchRate : 0 ;

    networksHashMap.set(networkObj.networkId, networkObj);

    if (params.isBestNetwork) {

      console.log(chalk.green("RNT | LOAD BEST NETWORK: " + networkObj.networkId));

      statsObj.bestNetwork = {};
      statsObj.bestNetwork.networkId = networkObj.networkId;
      statsObj.bestNetwork.inputsId = networkObj.inputsId;
      statsObj.bestNetwork.numInputs = networkObj.numInputs;
      statsObj.bestNetwork.output = [];
      statsObj.bestNetwork.successRate = networkObj.successRate;
      statsObj.bestNetwork.matchRate = networkObj.matchRate;
      statsObj.bestNetwork.overallMatchRate = networkObj.overallMatchRate;
      statsObj.bestNetwork.testCycles = networkObj.testCycles;
      statsObj.bestNetwork.testCycleHistory = [];
      statsObj.bestNetwork.testCycleHistory = networkObj.testCycleHistory;
      statsObj.bestNetwork.total = 0;
      statsObj.bestNetwork.match = 0;
      statsObj.bestNetwork.mismatch = 0;
      statsObj.bestNetwork.matchFlag = false;
      statsObj.bestNetwork.left = 0;
      statsObj.bestNetwork.neutral = 0;
      statsObj.bestNetwork.right = 0;
      statsObj.bestNetwork.positive = 0;
      statsObj.bestNetwork.negative = 0;
    }

    if (statsObj.loadedNetworks[networkObj.networkId] === undefined) {
      statsObj.loadedNetworks[networkObj.networkId] = {};
      statsObj.loadedNetworks[networkObj.networkId].networkId = networkObj.networkId;
      statsObj.loadedNetworks[networkObj.networkId].inputsId = networkObj.inputsId;
      statsObj.loadedNetworks[networkObj.networkId].numInputs = networkObj.numInputs;
      statsObj.loadedNetworks[networkObj.networkId].output = [];
      statsObj.loadedNetworks[networkObj.networkId].successRate = networkObj.successRate;
      statsObj.loadedNetworks[networkObj.networkId].matchRate = networkObj.matchRate;
      statsObj.loadedNetworks[networkObj.networkId].overallMatchRate = networkObj.overallMatchRate;
      statsObj.loadedNetworks[networkObj.networkId].testCycles = networkObj.testCycles;
      statsObj.loadedNetworks[networkObj.networkId].testCycleHistory = [];
      statsObj.loadedNetworks[networkObj.networkId].testCycleHistory = networkObj.testCycleHistory;
      statsObj.loadedNetworks[networkObj.networkId].total = 0;
      statsObj.loadedNetworks[networkObj.networkId].match = 0;
      statsObj.loadedNetworks[networkObj.networkId].mismatch = 0;
      statsObj.loadedNetworks[networkObj.networkId].matchFlag = false;
      statsObj.loadedNetworks[networkObj.networkId].left = 0;
      statsObj.loadedNetworks[networkObj.networkId].neutral = 0;
      statsObj.loadedNetworks[networkObj.networkId].right = 0;
      statsObj.loadedNetworks[networkObj.networkId].positive = 0;
      statsObj.loadedNetworks[networkObj.networkId].negative = 0;
    }

    statsObj.loadedNetworks[networkObj.networkId].overallMatchRate = networkObj.overallMatchRate;
    statsObj.loadedNetworks[networkObj.networkId].testCycles = networkObj.testCycles;
    statsObj.loadedNetworks[networkObj.networkId].testCycleHistory = networkObj.testCycleHistory;

    if (statsObj.allTimeLoadedNetworks[networkObj.networkId] === undefined) {
      statsObj.allTimeLoadedNetworks[networkObj.networkId] = {};
      statsObj.allTimeLoadedNetworks[networkObj.networkId].networkId = networkObj.networkId;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].inputsId = networkObj.inputsId;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].numInputs = networkObj.numInputs;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].output = [];
      statsObj.allTimeLoadedNetworks[networkObj.networkId].successRate = networkObj.successRate;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].matchRate = networkObj.matchRate;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].overallMatchRate = networkObj.overallMatchRate;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].testCycles = networkObj.testCycles;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].testCycleHistory = [];
      statsObj.allTimeLoadedNetworks[networkObj.networkId].testCycleHistory = networkObj.testCycleHistory;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].total = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].match = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].mismatch = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].matchFlag = false;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].left = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].neutral = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].right = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].positive = 0;
      statsObj.allTimeLoadedNetworks[networkObj.networkId].negative = 0;
    }

    statsObj.allTimeLoadedNetworks[networkObj.networkId].overallMatchRate = networkObj.overallMatchRate;
    statsObj.allTimeLoadedNetworks[networkObj.networkId].testCycles = networkObj.testCycles;
    statsObj.allTimeLoadedNetworks[networkObj.networkId].testCycleHistory = networkObj.testCycleHistory;

    console.log(chalkLog("RNT | LOAD NETWORK"
      + " | [ " + networksHashMap.size + " NNs IN HM ]"
      + " | SR: " + networkObj.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
      + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
      + " | TC: " + networkObj.testCycles
      + " | TCH: " + networkObj.testCycleHistory.length
      + " | " + networkObj.networkId
    ));

    resolve();

  });
}

function printCategorizeHistory(){
  console.log(chalkInfo("RNT | CATGORIZE HISTORY ==========================================="));
  statsObj.categorizeHistory.forEach(function(catStats){
    console.log(chalkInfo("RNT | CATGORIZE HISTORY"
      + " | S: " + moment(catStats.startTime).format(compactDateTimeFormat)
      + " E: " + moment(catStats.endTime).format(compactDateTimeFormat)
      + " R: " + msToTime(catStats.endTime - catStats.startTime)
      + "\nRNT | BEST: " + catStats.bestNetwork.networkId
      + " - " + catStats.bestNetwork.successRate.toFixed(2) + "% SR"
      + " - MR: " + catStats.bestNetwork.matchRate.toFixed(2) + "% MR"
      + " - OAMR:" + catStats.bestNetwork.overallMatchRate.toFixed(2) + "% MR"
      + "\nRNT | MR: " + catStats.matchRate.toFixed(2) + "%"
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

  networksHashMap.clear();

  maxInputHashMap = {};

  statsObj.loadedNetworks = {};
  statsObj.allTimeLoadedNetworks = {};

  statsObj.categorize.endTime = moment().valueOf();
  statsObj.categorize.bestNetwork = statsObj.bestNetwork;
  statsObj.categorizeHistory.push(statsObj.categorize);

  printCategorizeHistory();

  console.log(chalkAlert("RNT | *** RESET_STATS ***"));

  statsObj.categorize = {};
  statsObj.categorize.startTime = moment().valueOf();
  statsObj.categorize.grandTotal = 0;
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
  statsObj.categorize.skipped = 0;

  if (callback) { callback(); }
}

process.on("SIGHUP", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** SIGHUP ***"));
  quit("SIGHUP");
});

process.on("SIGINT", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** SIGINT ***"));
  quit("SIGINT");
});

process.on("disconnect", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** DISCONNECT ***"));
  quit("DISCONNECT");
});

process.on("message", async function(m) {

  debug(chalkAlert("RNT RX MESSAGE"
    + " | OP: " + m.op
    + " | KEYS: " + Object.keys(m)
  ));

  let cause;

  switch (m.op) {

    case "INIT":

      configuration.verbose = m.verbose || configuration.verbose;
      configuration.testMode = m.testMode || configuration.testMode;

      console.log(chalkLog("RNT | INIT | INTERVAL: " + m.interval + "\n" + jsonPrint(configuration)));

      await initActivateNetworkInterval(m.interval);

      process.send({ op: "IDLE" }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
      });
    break;

    case "LOAD_MAX_INPUTS_HASHMAP":
      maxInputHashMap = {};
      maxInputHashMap = m.maxInputHashMap;
      console.log(chalkLog("RNT | LOAD_MAX_INPUTS_HASHMAP"
        + " | " + Object.keys(maxInputHashMap)
      ));
    break;

    case "GET_BUSY":
      cause = busy();
      if (cause) {
        process.send({ op: "BUSY", cause: cause }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | BUSY | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | BUSY | " + err);
        }
      });
      }
      else {
        process.send({ op: "IDLE" }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
      });
      }
    break;

    case "STATS":
      showStats(m.options);
      if (busy()) {
        process.send({ op: "BUSY", cause: busy() }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | BUSY | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | BUSY | " + err);
        }
      });
      }
      else {
        process.send({ op: "IDLE" }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
      });
      }
    break;

    case "GET_STATS":
      process.send({ op: "STATS", statsObj: statsObj }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | GET_STATS | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | STATS | " + err);
        }
      });
    break;

    case "RESET_STATS":
      resetStats();
    break;

    case "QUIT":
      process.send({ op: "IDLE" }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
          quit("STATS PROCESS SEND ERRROR");
        }
      });
      quit("QUIT OP");
    break;

    case "LOAD_NETWORK":

      try {
        await loadNetwork({networkObj: m.networkObj, isBestNetwork: m.isBestNetwork});
      }
      catch(err){
        console.trace(chalkError("RNT | *** LOAD NETWORK ERROR | " + err));
        quit("LOAD NETWORK ERROR");
      }
    break;

    case "LOAD_NETWORK_DONE":
      console.log(chalkLog("RNT | LOAD_NETWORK_DONE"));
      statsObj.networksLoaded = true;
    break;
    
    case "ACTIVATE":

      rxActivateNetworkQueue.push(m.obj);

      if (configuration.verbose) {
        console.log(chalkInfo("### ACTIVATE"
          + " [" + rxActivateNetworkQueue.length + "]"
          + " | " + getTimeStamp()
          + " | " + m.obj.user.nodeId
          + " | @" + m.obj.user.screenName
          + " | C: " + m.obj.user.category
        ));
      }

      process.send({op: "NETWORK_BUSY"}, function(err){
        if (err) { 
          console.error.bind(console, "RNT | *** SEND ERROR | NETWORK_BUSY | " + err);
        }
      });

      if (!maxQueueFlag && (rxActivateNetworkQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { 
            console.error.bind(console, "RNT | *** SEND ERROR | QUEUE_FULL | " + err);
          }
        });
        maxQueueFlag = true;
      }
    break;
    
    default:
      console.log(chalkError("RNT | *** UNKNOWN OP ERROR"
        + " | " + m.op
        + "\n" + jsonPrint(m)
      ));
      console.error.bind(console, "RNT | *** UNKNOWN OP ERROR | " + m.op + "\n" + jsonPrint(m));
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

console.log("RNT | DROPBOX_RNT_CONFIG_FILE: " + DROPBOX_RNT_CONFIG_FILE);
console.log("RNT | DROPBOX_RNT_STATS_FILE : " + DROPBOX_RNT_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ 
  accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

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
        console.log(chalkError("RNT | " + moment().format(compactDateTimeFormat) 
          + " | *** ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.log(chalkError("RNT | " + moment().format(compactDateTimeFormat) 
          + " | *** ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.log(chalkError("RNT | " + moment().format(compactDateTimeFormat) 
          + " | *** ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        console.log(chalkError("RNT | " + moment().format(compactDateTimeFormat) 
          + " | *** ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: " + error
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
}

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("RNT | initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

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
    console.log("\nRNT | %%%%%%%%%%%%%%\nRNT |  DEBUG ENABLED \nRNT | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.RNT_PROCESS_NAME || "randomNetworkTree";

  cnf.verbose = process.env.RNT_VERBOSE_MODE || configuration.verbose ;
  cnf.globalTestMode = process.env.RNT_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.RNT_TEST_MODE || configuration.testMode ;
  cnf.quitOnError = process.env.RNT_QUIT_ON_ERROR || false ;

  cnf.statsUpdateIntervalTime = process.env.RNT_STATS_UPDATE_INTERVAL || 1000;

  console.log("RNT | CONFIG\n" + jsonPrint(cnf));

  callback(null, cnf);
}

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    initializeBusy = false;

    if (err && (err.status !== 404)) {
      console.log(chalkError("RNT | *** INIT ERROR\n" + jsonPrint(err)));
      console.error.bind(console, "RNT | *** INIT ERROR: " + err);
      quit(err);
    }
    console.log(chalkInfo("RNT | " + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(cnf)));
    initStatsUpdate(cnf);
  });
}, 1 * ONE_SECOND);