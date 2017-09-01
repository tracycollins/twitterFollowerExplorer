/*jslint node: true */
"use strict";

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
const Dropbox = require("dropbox");
const async = require("async");
const debug = require("debug")("rnt");
const debugCache = require("debug")("cache");
const arrayNormalize = require("array-normalize");
const deepcopy = require("deep-copy");
const table = require("text-table");

const neataptic = require("neataptic");

let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkRed = chalk.red;
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

process.title = "randomNetworkTree";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");


let statsObj = {};

statsObj.loadedNetworks = {};
statsObj.loadedNetworks.multiNeuralNet = {};
statsObj.loadedNetworks.multiNeuralNet.total = 0;
statsObj.loadedNetworks.multiNeuralNet.matchRate = 0.0;
statsObj.loadedNetworks.multiNeuralNet.match = 0;
statsObj.loadedNetworks.multiNeuralNet.mismatch = 0;
statsObj.loadedNetworks.multiNeuralNet.matchFlag = false;

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = "";
statsObj.bestNetwork.successRate = 0;

statsObj.categorize = {};
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
  showStats(true);
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

function activateNetwork(nnInput, callback){

  let networkOutput = {};

  async.eachSeries(networksHashMap.keys(), function(nnId, cb){

    const networkObj = networksHashMap.get(nnId);

    networkOutput[nnId] = [];

    const out = networkObj.network.activate(nnInput);

    let output = deepcopy(out);

    if (output.length !== 3) {
      console.error(chalkError("*** ZERO LENGTH NETWORK OUTPUT | " + nnId ));
      quit(" ZERO LENGTH NETWORK OUTPUT");
      output = [0,0,0];
    }

    indexOfMax(output, function maxNetworkOutput(maxOutputIndex){

      // console.log(chalkInfo("MAX INDEX"
      //   + " | OUT: " + output
      //   + " | MAX INDEX: " + maxOutputIndex
      //   + " | " + nnId
      // ));

      switch (maxOutputIndex) {
        case 0:
          networkOutput[nnId] = [1,0,0];
          // cb();
        break;
        case 1:
          networkOutput[nnId] = [0,1,0];
          // cb();
        break;
        case 2:
          networkOutput[nnId] = [0,0,1];
          // cb();
        break;
        default:
          networkOutput[nnId] = [0,0,0];
          // cb();
      }

      async.setImmediate(function() {
        cb();
      });

    });


  }, function(err){
    callback(err, networkOutput);
  });
}

const sum = (r, a) => r.map((b, i) => a[i] + b);


function printNetworksOutput(title, networkOutputObj, expectedOutput, callback){

  let text = "";
  let arrayOfArrays = [];
  // let matchFlag = false;
  let bestNetworkOutput = [0,0,0];
  let statsTextArray = [];

  async.eachSeries(Object.keys(networkOutputObj), function(nnId, cb){

    arrayOfArrays.push(networkOutputObj[nnId]);

    const nnOutput = networkOutputObj[nnId];

    if (statsObj.loadedNetworks[nnId] === undefined) {
      statsObj.loadedNetworks[nnId] = {};
      statsObj.loadedNetworks[nnId].total = 0;
      statsObj.loadedNetworks[nnId].matchRate = 0.0;
      statsObj.loadedNetworks[nnId].match = 0;
      statsObj.loadedNetworks[nnId].mismatch = 0;
      statsObj.loadedNetworks[nnId].matchFlag = false;
    }

    if (expectedOutput) {

      statsObj.loadedNetworks[nnId].total += 1;

      if ((nnOutput[0] === expectedOutput[0])
        && (nnOutput[1] === expectedOutput[1])
        && (nnOutput[2] === expectedOutput[2])){

        statsObj.loadedNetworks[nnId].match += 1;
        statsObj.loadedNetworks[nnId].matchFlag = true;

      }
      else {
        statsObj.loadedNetworks[nnId].mismatch += 1;
        statsObj.loadedNetworks[nnId].matchFlag = false;
      }

      statsObj.loadedNetworks[nnId].matchRate = 100.0 * statsObj.loadedNetworks[nnId].match / statsObj.loadedNetworks[nnId].total;
    }
    else {
      statsObj.loadedNetworks[nnId].matchFlag = "---";
    }

    if (statsObj.loadedNetworks[nnId].matchRate > statsObj.bestNetwork.successRate) {
      statsObj.bestNetwork.networkId = nnId;
      statsObj.bestNetwork.successRate = statsObj.loadedNetworks[nnId].matchRate;
      console.log(chalkAlert("RNT"
        + " | " + nnId
        + " | NEW BEST MAX " + statsObj.bestNetwork.successRate.toFixed(1) + "%"
      ));
    }

    if (statsObj.bestNetwork.networkId === nnId) {
      bestNetworkOutput = nnOutput;
      statsObj.bestNetwork.successRate = statsObj.loadedNetworks[nnId].matchRate;
      console.log(chalkAlert("RNT"
        + " | " + nnId
        + " | SET BEST OUT [" + bestNetworkOutput + "]"
        + " | RATE: " + statsObj.bestNetwork.successRate.toFixed(1) + "%"
      ));
    }

    statsTextArray.push([
      nnId,
      "---",
      // networksHashMap.get(nnId).network.successRate.toFixed(1),
      statsObj.loadedNetworks[nnId].matchFlag,
      nnOutput,
      statsObj.loadedNetworks[nnId].matchRate.toFixed(1),
      statsObj.loadedNetworks[nnId].total,
      statsObj.loadedNetworks[nnId].match,
      statsObj.loadedNetworks[nnId].mismatch
    ]);

    // async.setImmediate(function() {
      cb();
    // });

  }, function(){

    const sumArray = arrayOfArrays.reduce(sum);
    let sumArrayNorm = deepcopy(sumArray);
    arrayNormalize(sumArrayNorm);

    indexOfMax(sumArrayNorm, function maxNetworkOutput(maxIndex){

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
    });

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
      "MULTI NN",
      "---",
      statsObj.loadedNetworks.multiNeuralNet.matchFlag,
      sumArrayNorm,
      statsObj.loadedNetworks.multiNeuralNet.matchRate.toFixed(1),
      statsObj.loadedNetworks.multiNeuralNet.total,
      statsObj.loadedNetworks.multiNeuralNet.match,
      statsObj.loadedNetworks.multiNeuralNet.mismatch
    ]);

    console.log(
        "\n--------------------------------------------------------------"
      + "\n" + title 
      + "\n--------------------------------------------------------------\n"
      + table(statsTextArray, { align: [ "l", "r", "l", "l", ".", "r", "r", "r"] })
      + "\n--------------------------------------------------------------\n"
    );

    indexOfMax(sumArray, function(maxOutputIndex){

      switch (maxOutputIndex) {
        case 0:
          console.log(chalkLog("XNKW | L | " + sumArray + " | " + maxOutputIndex));
        break;
        case 1:
          console.log(chalkLog("XNKW | N | " + sumArray + " | " + maxOutputIndex));
        break;
        case 2:
          console.log(chalkLog("XNKW | R | " + sumArray + " | " + maxOutputIndex));
        break;
        default:
          console.log(chalkLog("XNKW | 0 | " + sumArray + " | " + maxOutputIndex));
      }
    });

    indexOfMax(bestNetworkOutput, function(maxOutputIndex){

      switch (maxOutputIndex) {
        case 0:
          debug(chalk.blue("NAKW | L | " + bestNetworkOutput + " | " + maxOutputIndex));
          callback({left: 100});
        break;
        case 1:
          debug(chalk.black("NAKW | N | " + bestNetworkOutput + " | " + maxOutputIndex));
          callback({neutral: 100});
        break;
        case 2:
          debug(chalk.red("NAKW | R | " + bestNetworkOutput + " | " + maxOutputIndex));
          callback({right: 100});
        break;
        default:
          debug(chalk.gray("NAKW | 0 | " + bestNetworkOutput + " | " + maxOutputIndex));
          callback({});
      }
    });


  });

}

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

  console.log("\n------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
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

  // let messageObj;
  // messageObj.obj = {};
  // messageObj.results = {};
  // messageObj.stats = {};

  activateNetworkInterval = setInterval(function(){ 

    if ((rxActivateNetworkQueue.length > 0) && activateNetworkReady) {

      // let messageObj = {};
      // messageObj.obj = {};
      // messageObj.results = {};
      // messageObj.stats = {};

      activateNetworkReady = false;

      const obj = rxActivateNetworkQueue.shift();

      if (maxQueueFlag && (rxActivateNetworkQueue.length < MAX_Q_SIZE)) {
        process.send({op: "QUEUE_READY", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("ERRROR"); }
        });
        maxQueueFlag = false;
      }
      else if (rxActivateNetworkQueue.length === 0){
        process.send({op: "QUEUE_EMPTY", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("ERRROR"); }
        });
        maxQueueFlag = false;
      }

      if (!maxQueueFlag && (rxActivateNetworkQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxActivateNetworkQueue.length}, function(err){
          if (err) { quit("ERRROR"); }
        });
        maxQueueFlag = true;
      }

      activateNetwork(obj.networkInput, function(err, networkOutputObj){

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

          if (Object.keys(obj.user.keywords).length > 0) {
            kw = Object.keys(obj.user.keywords)[0];

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
                expectedOutput = false;
                title = title + " | MKW: ---";
             }
          }

          printDatum(title, obj.networkInput);

          printNetworksOutput(title, networkOutputObj, expectedOutput, function(keywordsAuto){

            if (Object.keys(keywordsAuto).length > 0){

              nkwa = Object.keys(keywordsAuto)[0];

              if (kw) {

                statsObj.categorize[nkwa] += 1;

                if ((kw === "left") || (kw === "neutral")|| (kw === "right")) {

                  statsObj.categorize.total += 1;

                  if (kw === nkwa) {
                    statsObj.categorize.match += 1;
                    statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;
                    console.log(chalk.green("+++ AUTO KEYWORD MATCH"
                      + " | MATCH RATE: " + statsObj.categorize.matchRate.toFixed(1) + "%"
                      + " | TOTAL: " + statsObj.categorize.total
                      + " | MATCH: " + statsObj.categorize.match
                      + " | MISMATCH: " + statsObj.categorize.mismatch
                      + " | L: " + statsObj.categorize.left
                      + " | N: " + statsObj.categorize.neutral
                      + " | R: " + statsObj.categorize.right
                      + " | @" + obj.user.screenName
                      + " | KWs: " + kw
                      + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                      + " | NEW KWAs: " + nkwa
                    ));
                  }
                  else {
                    statsObj.categorize.mismatch += 1;
                    statsObj.categorize.matchRate = 100.0 * statsObj.categorize.match / statsObj.categorize.total;
                    console.log(chalk.red("--- AUTO KEYWORD MISS "
                      + " | MATCH RATE: " + statsObj.categorize.matchRate.toFixed(1) + "%"
                      + " | TOTAL: " + statsObj.categorize.total
                      + " | MATCH: " + statsObj.categorize.match
                      + " | MISMATCH: " + statsObj.categorize.mismatch
                      + " | L: " + statsObj.categorize.left
                      + " | N: " + statsObj.categorize.neutral
                      + " | R: " + statsObj.categorize.right
                      + " | @" + obj.user.screenName
                      + " | KWs: " + kw
                      + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                      + " | NEW KWAs: " + nkwa
                    ));
                  }
                }
                else {
                  debug(chalkLog("NETWORK OUT"
                    + " | MATCH RATE: " + statsObj.categorize.matchRate.toFixed(1) + "%"
                    + " | TOTAL: " + statsObj.categorize.total
                    + " | MATCH: " + statsObj.categorize.match
                    + " | MISMATCH: " + statsObj.categorize.mismatch
                    + " | L: " + statsObj.categorize.left
                    + " | N: " + statsObj.categorize.neutral
                    + " | R: " + statsObj.categorize.right
                    + " | @" + obj.user.screenName
                    + " | KWs: " + kw
                    + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                    + " | NEW KWAs: " + nkwa
                  ));
                }
              }
              else {
                debug(chalkLog("NETWORK OUT"
                  + " | MATCH RATE: " + statsObj.categorize.matchRate.toFixed(1) + "%"
                  + " | TOTAL: " + statsObj.categorize.total
                  + " | MATCH: " + statsObj.categorize.match
                  + " | MISMATCH: " + statsObj.categorize.mismatch
                  + " | L: " + statsObj.categorize.left
                  + " | N: " + statsObj.categorize.neutral
                  + " | R: " + statsObj.categorize.right
                  + " | @" + obj.user.screenName
                  + " | KWs: ---" 
                  + " | KWAs: " + Object.keys(obj.user.keywordsAuto)
                  + " | NEW KWAs: " + nkwa
                ));
              }
            }

            let messageObj = {};
            messageObj.op = "NETWORK_OUTPUT";
            messageObj.user = {};
            messageObj.user = obj.user;
            messageObj.bestNetwork = {};
            messageObj.bestNetwork.networkId = statsObj.bestNetwork.networkId;
            messageObj.bestNetwork.successRate = statsObj.bestNetwork.successRate;
            messageObj.keywordsAuto = {};
            messageObj.keywordsAuto = keywordsAuto;
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


function printNetworkObj(title, nnObj){
  console.log(chalkLog("\n==================="
    + "\n" + title
    + "\nID:      " + nnObj.networkId
    + "\nCREATED: " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS: " + nnObj.successRate.toFixed(1) + "%"
    + "\nINPUTS:  " + Object.keys(nnObj.inputs)
    + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\n===================\n"
  ));
}

function loadNetworks(networksObj, callback){

  async.each(Object.keys(networksObj), function(nnId, cb){

    // printNetworkObj("RNT | LOAD NETWORK", networksObj[nnId].network);
    console.log(chalkLog("RNT | LOAD NETWORK | " + nnId
     // + "\nNET keys: " + Object.keys(networksObj[nnId].network)
    ));

    const network = neataptic.Network.fromJSON(networksObj[nnId].network.network);

    networksHashMap.set(nnId, {network: network, successRate: networksObj[nnId].network.successRate} );
    // networks[nnId] = deepcopy(network);

    if (statsObj.loadedNetworks[nnId] === undefined) {
      statsObj.loadedNetworks[nnId] = {};
      statsObj.loadedNetworks[nnId].total = 0;
      statsObj.loadedNetworks[nnId].matchRate = 0.0;
      statsObj.loadedNetworks[nnId].match = 0;
      statsObj.loadedNetworks[nnId].mismatch = 0;
      statsObj.loadedNetworks[nnId].matchFlag = false;
    }

    cb();

  }, function(err){

    if (callback) { callback(err); }

  });

}



process.on("SIGHUP", function() {
  quit("SIGHUP");
});

process.on("SIGINT", function() {
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
    break;

    case "STATS":
      showStats(m.options);
    break;

    case "LOAD_NETWORKS":
      console.log(chalkAlert("LOAD_NETWORKS"
        + " | " + Object.keys(m.networksObj).length
      ));
      loadNetworks(m.networksObj, function(){
        process.send({op: "NETWORK_READY"}, function(err){
          if (err) { quit("ERRROR"); }
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
        + " | " + m.obj.networkInput.length + " INPUTS"
      ));

      process.send({op: "NETWORK_BUSY"}, function(err){
        if (err) { quit("ERRROR"); }
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
      const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + errorText
      ));
      if (callback !== undefined) { callback(error, fullPath); }
    });
}

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj);

  }, cnf.statsUpdateIntervalTime);
}



function initialize(cnf, callback){

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
    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      quit();
    }
    console.log(chalkInfo(cnf.processName + " STARTED " + getTimeStamp() + "\n"));
    initStatsUpdate(cnf);
  });
}, 1 * ONE_SECOND);


