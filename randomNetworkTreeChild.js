const MODULE_ID_PREFIX = "RNT";

const DEFAULT_USER_PROFILE_ONLY_FLAG = false;
const ONE_SECOND = Number(1000);
const MAX_Q_SIZE = 100;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const activateNetworkQueue = [];
let maxQueueFlag = false;

let activateNetworkInterval;
let activateNetworkIntervalBusy = false;

let statsUpdateInterval;

const configuration = {};
configuration.userProfileOnlyFlag = DEFAULT_USER_PROFILE_ONLY_FLAG;
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;

const os = require("os");
const util = require("util");
const moment = require("moment");
const debug = require("debug")("rnt");
const debugCache = require("debug")("cache");
const defaults = require("object.defaults");

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools("RNT_NNT");

let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const tcuChildName = "RNT_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;
const msToTime = tcUtils.msToTime;
const getTimeStamp = tcUtils.getTimeStamp;

const chalk = require("chalk");
const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.blue;

const networkDefaults = {};

networkDefaults.rank = Infinity;
networkDefaults.matchRate = 0;
networkDefaults.overallMatchRate = 0;
networkDefaults.successRate = 0;
networkDefaults.testCycles = 0;
networkDefaults.testCycleHistory = [];

networkDefaults.meta = {};

networkDefaults.meta.output = [];
networkDefaults.meta.total = 0;
networkDefaults.meta.match = 0;
networkDefaults.meta.mismatch = 0;

networkDefaults.meta.left = 0;
networkDefaults.meta.neutral = 0;
networkDefaults.meta.right = 0;
networkDefaults.meta.none = 0;
networkDefaults.meta.positive = 0;
networkDefaults.meta.negative = 0;

function printNetworkObj(title, nObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalk.blue;

  const nn = defaults(nObj, networkDefaults);

  console.log(chalkFormat(title
    + " | RK: " + nn.rank.toFixed(0)
    + " | OR: " + nn.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + nn.matchRate.toFixed(2) + "%"
    + " | SR: " + nn.successRate.toFixed(2) + "%"
    + " | CR: " + getTimeStamp(nn.createdAt)
    + " | TC:  " + nn.testCycles
    + " | TH: " + nn.testCycleHistory.length
    + " |  " + nn.inputsId
    + " | " + nn.networkId
  ));

  return;
}

process.title = "node_randomNetworkTree";
console.log("\n\nRNT | =================================");
console.log("RNT | HOST:          " + hostname);
console.log("RNT | PROCESS TITLE: " + process.title);
console.log("RNT | PROCESS ID:    " + process.pid);
console.log("RNT | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("RNT | =================================");

let initializeBusy = false;

const statsObj = {};

statsObj.networksLoaded = false;
statsObj.loadedNetworks = {};

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
statsObj.memoryUsage = {};
statsObj.memoryUsage.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.memoryUsage.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

//=========================================================================
// MONGO DB
//=========================================================================

async function connectDb(){

  try {

    statsObj.status = "CONNECTING MONGO DB";

    console.log(chalkLog(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

    const db = await global.wordAssoDb.connect(MODULE_ID_PREFIX + "_" + process.pid);

    db.on("error", async function(err){
      statsObj.status = "MONGO ERROR";
      statsObj.dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
      db.close();
      quit({cause: "MONGO DB ERROR: " + err});
    });

    db.on("close", async function(err){
      statsObj.status = "MONGO CLOSED";
      statsObj.dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED"));
      quit({cause: "MONGO DB CLOSED: " + err});
    });

    db.on("disconnected", async function(){
      statsObj.status = "MONGO DISCONNECTED";
      statsObj.dbConnectionReady = false;
      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
      quit({cause: "MONGO DB DISCONNECTED"});
    });

    console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

    statsObj.dbConnectionReady = true;

    return db;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

function updateMemoryStats(){
  statsObj.memoryUsage.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.memoryUsage.maxHeap = Math.max(statsObj.memoryUsage.maxHeap, statsObj.memoryUsage.heap);
}

function showStats(options){

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
  updateMemoryStats();

  if (options) {
    console.log("RNT | = NT STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.gray("RNT | == * == S"
      + " | E: " + statsObj.elapsed
      + " | S: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | ANQ: " + activateNetworkQueue.length
      + " | HEAP: " + statsObj.memoryUsage.heap.toFixed(3) + " MB"
      + " | MAX HEAP: " + statsObj.memoryUsage.maxHeap.toFixed(3) + " MB"
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

const generateNetworksOutputBusy = false;

function initActivateNetworkInterval(interval){

  return new Promise(function(resolve){

    clearInterval(activateNetworkInterval);

    console.log(chalkConnect("RNT | START NETWORK ACTIVATE INTERVAL"
      + " | INTERVAL: " + interval + " ms"
    ));

    activateNetworkIntervalBusy = false;

    const messageObj = {};
    messageObj.op = "NETWORK_OUTPUT";
    messageObj.rxMessageQueue = rxMessageQueue.length;
    messageObj.activateNetworkQueue = activateNetworkQueue.length;
    messageObj.user = null;
    messageObj.category = "none";
    messageObj.categoryAuto = "none";
    messageObj.memoryUsage = {};

    let activateNetworkObj = {};
    let activateNetworkResults = {};
    let currentBestNetwork = {};

    activateNetworkInterval = setInterval(async function(){ 

      if (statsObj.networksLoaded && (activateNetworkQueue.length > 0) && !activateNetworkIntervalBusy) {

        activateNetworkIntervalBusy = true;

        activateNetworkObj = activateNetworkQueue.shift();

        messageObj.user = activateNetworkObj.user;
        
        if (!messageObj.user.friends || (messageObj.user.friends === undefined)){
          console.log(chalkLog("RNT | !!! NO USER FRIENDS | @" + messageObj.user.screenName));
          messageObj.user.friends = [];
        }

        try {

          activateNetworkResults = await nnTools.activate({ 
            user: activateNetworkObj.user,
            convertDatumFlag: true
          });

          currentBestNetwork = await nnTools.updateNetworkStats({
            sortBy: "matchRate",
            user: activateNetworkObj.user,
            networkOutput: activateNetworkResults.networkOutput, 
            expectedCategory: activateNetworkResults.user.category
          });

          if (statsObj.currentBestNetwork.rank < currentBestNetwork.rank){
            printNetworkObj("RNT | +++ UPDATE BEST NETWORK"
              + " [ ANQ: " + activateNetworkQueue.length + "]"
              + " | @" + messageObj.user.screenName 
              + " | CM: " + messageObj.user.category, currentBestNetwork, chalk.black
            );
            await nnTools.printNetworkResults();
          }
          else if ((configuration.testMode && (currentBestNetwork.meta.total % 10 === 0)) || (currentBestNetwork.meta.total % 100 === 0)) {
            printNetworkObj("RNT | NETWORK STATS"
              + " [ ANQ: " + activateNetworkQueue.length + "]"
              + " | @" + messageObj.user.screenName 
              + " | CM: " + messageObj.user.category, currentBestNetwork, chalk.black
            );
            await nnTools.printNetworkResults();
          }

          if (configuration.verbose
            || (statsObj.currentBestNetwork.rank < currentBestNetwork.rank)
          ) {
            console.log("RNT | BEST NN"
              + " [ ANQ: " + activateNetworkQueue.length + "]"
              + " | RANK: " + currentBestNetwork.rank
              + " | MR: " + currentBestNetwork.matchRate.toFixed(2) + "%"
              + " | " + currentBestNetwork.meta.match + "/" + currentBestNetwork.meta.total
              + " | MATCH: " + currentBestNetwork.meta.matchFlag
              + " | " + currentBestNetwork.networkId
              + " | IN: " + currentBestNetwork.inputsId
              + " | OUT: " + currentBestNetwork.meta.output
            );
          }

          statsObj.currentBestNetwork = currentBestNetwork;

          messageObj.currentBestNetwork = currentBestNetwork;
          messageObj.user = activateNetworkResults.user;
          messageObj.category = activateNetworkResults.user.category;
          messageObj.categoryAuto = currentBestNetwork.meta.categoryAuto;

          messageObj.rxMessageQueue = rxMessageQueue.length;
          messageObj.activateNetworkQueue = activateNetworkQueue.length;

          updateMemoryStats();

          messageObj.memoryUsage = statsObj.memoryUsage;

          process.send(messageObj, function(err){
            if (err) { 
              console.trace(chalkError("RNT | *** SEND ERROR | NETWORK_OUTPUT | " + err));
              quit("SEND NETWORK_OUTPUT ERROR");
            }
            activateNetworkIntervalBusy = false;
          });

        }
        catch(err){

          console.log(chalkError("RNT | *** ACTIVATE NETWORK ERROR"
            + " | @" + activateNetworkObj.user.screenName
            + " | " + err
          ));

          process.send({
            op: "ERROR", 
            errorType: "ACTIVATE_ERROR", 
            error: err, 
            rxMessageQueue: rxMessageQueue.length,
            activateNetworkQueue: activateNetworkQueue.length
          }, function(err){

            activateNetworkIntervalBusy = false;
            if (err) { 
              console.trace(chalkError("RNT | *** SEND ERROR | ERROR | " + err));
              quit("SEND ERROR ERROR");
            }
          });

        }

        if (maxQueueFlag && (activateNetworkQueue.length < MAX_Q_SIZE)) {
          process.send({op: "QUEUE_READY", 
            rxMessageQueue: rxMessageQueue.length,
            activateNetworkQueue: activateNetworkQueue.length
          }, function(err){
            if (err) { 
              console.trace(chalkError("RNT | *** SEND ERROR | QUEUE_READY | " + err));
              quit("SEND QUEUE_READY ERROR");
            }
          });
          maxQueueFlag = false;
        }
        else if (activateNetworkQueue.length === 0 && rxMessageQueue.length === 0){
          process.send({
            op: "QUEUE_EMPTY", 
            rxMessageQueue: rxMessageQueue.length,
            activateNetworkQueue: activateNetworkQueue.length
          }, function(err){
            if (err) { 
              console.trace(chalkError("RNT | *** SEND ERROR | QUEUE_EMPTY | " + err));
              quit("SEND QUEUE_EMPTY ERROR");
            }
          });
          maxQueueFlag = false;
        }
        else if (!maxQueueFlag && (activateNetworkQueue.length >= MAX_Q_SIZE)) {
          process.send({
            op: "QUEUE_FULL", 
            rxMessageQueue: rxMessageQueue.length,
            activateNetworkQueue: activateNetworkQueue.length
          }, function(err){
            if (err) { 
              console.trace(chalkError("RNT | *** SEND ERROR | QUEUE_FULL | " + err));
              quit("SEND QUEUE_FULL ERROR");
            }
          });
          maxQueueFlag = true;
        }
        else {
          process.send({
            op: "QUEUE_STATS", 
            rxMessageQueue: rxMessageQueue.length,
            activateNetworkQueue: activateNetworkQueue.length
          }, function(err){
            if (err) { 
              console.trace(chalkError("RNT | *** SEND ERROR | QUEUE_STATS | " + err));
              quit("SEND QUEUE_STATS ERROR");
            }
          });
        }

      }
    }, interval);

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
      + " - OMR:" + catStats.bestNetwork.overallMatchRate.toFixed(2) + "% MR"
      + "\nRNT | MR: " + catStats.matchRate.toFixed(2) + "%"
      + " | OMR: " + catStats.overallMatchRate.toFixed(2) + "%"
      + " | TOT: " + catStats.total
      + " | MATCH: " + catStats.match
      + " | L: " + catStats.left
      + " | N: " + catStats.neutral
      + " | R: " + catStats.right
    ));
  });
}

function busy(){
  if (initializeBusy) { return "initializeBusy"; }
  if (generateNetworksOutputBusy) { return "generateNetworksOutputBusy"; }
  if (activateNetworkIntervalBusy) { return "activateNetworkIntervalBusy"; }
  if (activateNetworkQueue.length > MAX_Q_SIZE) { return "activateNetworkQueue"; }

  return false;
}

function resetStats(callback){

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

async function processRxMessage(m){

  try{

    debug(chalkAlert("RNT RX MESSAGE"
      + " | OP: " + m.op
      + " | KEYS: " + Object.keys(m)
    ));

    switch (m.op) {
      
      case "ACTIVATE":

        if (!m.obj.user.profileHistograms || (m.obj.user.profileHistograms === undefined)) {
          console.log(chalkWarn("RNT | ACTIVATE | UNDEFINED USER PROFILE HISTOGRAMS | @" + m.obj.user.screenName));
          m.obj.user.profileHistograms = {};
        }

        if (!m.obj.user.tweetHistograms || (m.obj.user.tweetHistograms === undefined)) {
          console.log(chalkWarn("RNT | ACTIVATE | UNDEFINED USER TWEET HISTOGRAMS | @" + m.obj.user.screenName));
          m.obj.user.tweetHistograms = {};
        }

        if (!m.obj.user.friends || (m.obj.user.friends === undefined)) {
          console.log(chalkWarn("RNT | ACTIVATE | UNDEFINED USER FRIENDS | @" + m.obj.user.screenName));
          m.obj.user.friends = [];
        }

        activateNetworkQueue.push(m.obj);

        if (configuration.verbose) {
          console.log(chalkInfo("RNT | >>> ACTIVATE Q"
            + " [" + activateNetworkQueue.length + "]"
            + " | " + getTimeStamp()
            + " | " + m.obj.user.nodeId
            + " | @" + m.obj.user.screenName
            + " | C: " + m.obj.user.category
          ));
        }

        updateMemoryStats();

        process.send({op: "NETWORK_BUSY", 
          rxMessageQueue: rxMessageQueue.length, 
          activateNetworkQueue: activateNetworkQueue.length, 
          memoryUsage: statsObj.memoryUsage
        }, function(err){
          if (err) { 
            console.error.bind(console, "RNT | *** SEND ERROR | NETWORK_BUSY | " + err);
          }
        });

        if (!maxQueueFlag && (activateNetworkQueue.length >= MAX_Q_SIZE)) {
          process.send({
            op: "QUEUE_FULL", 
            rxMessageQueue: rxMessageQueue.length, 
            activateNetworkQueue: activateNetworkQueue.length, 
            memoryUsage: statsObj.memoryUsage
          }, function(err){
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

    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | processRxMessage ERROR: " + err));
    throw err;
  }
}

const rxMessageQueue = [];
let rxMessageQueueReady = true;

setInterval(async function(){

  if (rxMessageQueueReady && rxMessageQueue.length > 0){

    try{
      rxMessageQueueReady = false;

      const message = rxMessageQueue.shift();

      await processRxMessage(message);
      rxMessageQueueReady = true;
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | rxMessageQueue ERROR: " + err));
    }

  }

}, 100);

process.on("message", async function(m) {

  let cause;

  switch (m.op) {

    case "QUEUES":
      process.send({
        op: "QUEUES",
        activateNetworkQueue: activateNetworkQueue.length,
        rxMessageQueue: rxMessageQueue.length
      });
    break;

    case "INIT":

      configuration.verbose = m.verbose || configuration.verbose;
      configuration.testMode = m.testMode || configuration.testMode;
      configuration.userProfileOnlyFlag = m.userProfileOnlyFlag || configuration.userProfileOnlyFlag;

      console.log(chalkLog("RNT | INIT | INTERVAL: " + m.interval + "\n" + jsonPrint(configuration)));

      await initActivateNetworkInterval(m.interval);

      process.send({ op: "IDLE", 
        rxMessageQueue: rxMessageQueue.length,
        activateNetworkQueue: activateNetworkQueue.length,
        memoryUsage: statsObj.memoryUsage 
      }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
        return;
      });
    break;

    case "VERBOSE":
      console.log(chalkAlert("RNT | SET VERBOSE: " + m.verbose));
      configuration.verbose = m.verbose;
    break;

    case "SET_USER_PROFILE_ONLY_FLAG":
      await nnTools.setUserProfileOnlyFlag(m.userProfileOnlyFlag);
      configuration.userProfileOnlyFlag = m.userProfileOnlyFlag;
      console.log(chalkLog("RNT | SET_USER_PROFILE_ONLY_FLAG"
        + " | " + m.userProfileOnlyFlag
      ));
    break;
    
    case "LOAD_MAX_INPUTS_HASHMAP":
      await nnTools.setMaxInputHashMap(m.maxInputHashMap);
      console.log(chalkLog("RNT | LOAD_MAX_INPUTS_HASHMAP"
        + " | " + Object.keys(tcUtils.getMaxInputHashMap())
      ));
    break;

    case "LOAD_NORMALIZATION":
      await nnTools.setNormalization(m.normalization);
      console.log(chalkLog("RNT | LOAD_NORMALIZATION"
        + "\n" + jsonPrint(m.normalization)
      ));
    break;

    case "GET_BUSY":

      updateMemoryStats();

      cause = busy();
      if (cause) {
        process.send({ 
          op: "BUSY", 
          cause: cause, 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          memoryUsage: statsObj.memoryUsage 
        }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | BUSY | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | BUSY | " + err);
        }
      });
      }
      else {
        process.send({ 
          op: "IDLE", 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          memoryUsage: statsObj.memoryUsage 
        }, function(err){
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
        process.send({ 
          op: "BUSY", 
          cause: busy(), 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          memoryUsage: statsObj.memoryUsage 
        }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | BUSY | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | BUSY | " + err);
        }
      });
      }
      else {
        process.send({ 
          op: "IDLE", 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          memoryUsage: statsObj.memoryUsage
        }, function(err){
        if (err) { 
          console.log(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
      });
      }
    break;

    case "GET_STATS":
      try {
        updateMemoryStats();
        await nnTools.printNetworkResults({title: "GET STATS"});
        const stats = await nnTools.getNetworkStats();
        process.send({ 
          op: "GET_STATS_RESULTS", 
          networks: stats.networks, 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          memoryUsage: statsObj.memoryUsage 
        }, function(err){
          if (err) { 
            console.log(chalkError("RNT | *** SEND ERROR | GET_STATS | " + err));
            console.error.bind(console, "RNT | *** SEND ERROR | STATS | " + err);
          }
        });
      }
      catch(err){
        console.log(chalkError("RNT | *** PRINT NETWORK STATS ERROR | " + err));
      }
    break;

    case "RESET_STATS":
      resetStats();
    break;

    case "QUIT":
      updateMemoryStats();
      process.send({ 
        op: "IDLE", 
        rxMessageQueue: rxMessageQueue.length,
        activateNetworkQueue: activateNetworkQueue.length,
        memoryUsage: statsObj.memoryUsage 
      }, function(err){
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
        nnTools.printNetworkObj("RNT | ... LOADING NETWORK | " + m.networkObj.networkId, m.networkObj, chalkLog);
        await nnTools.loadNetwork({networkObj: m.networkObj, isBestNetwork: m.isBestNetwork});

        process.send({
          op: "LOAD_NETWORK_OK", 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          networkId: m.networkObj.networkId
        }, function(err){
          if (err) { 
            console.error.bind(console, "RNT | *** SEND ERROR | LOAD_NETWORK_OK | " + err);
          }
        });

      }
      catch(err){
        console.log(chalkError("RNT | *** LOAD NETWORK ERROR"
          + " | TECH: " + m.networkObj.networkTechnology
          + " | NN ID: " + m.networkObj.networkId
          + " | INPUTS ID: " + m.networkObj.inputsId
          + " | " + err
        ));
        await nnTools.deleteNetwork({networkId: m.networkObj.networkId});

        process.send({
          op: "LOAD_NETWORK_ERROR", 
          rxMessageQueue: rxMessageQueue.length,
          activateNetworkQueue: activateNetworkQueue.length,
          networkId: m.networkObj.networkId
        }, function(err){
          if (err) { 
            console.error.bind(console, "RNT | *** SEND ERROR | LOAD_NETWORK_ERROR | " + err);
          }
        });

      }
    break;

    case "LOAD_NETWORK_DONE":
      console.log(chalkLog("RNT | LOAD_NETWORK_DONE"));
      statsObj.networksLoaded = true;
      await nnTools.printNetworkResults();
    break;
    
    case "ACTIVATE":
      rxMessageQueue.push(m);
    break;
    
    default:
      console.log(chalkError("RNT | *** UNKNOWN OP ERROR"
        + " | " + m.op
        + "\n" + jsonPrint(m)
      ));
      console.error.bind(console, "RNT | *** UNKNOWN OP ERROR | " + m.op + "\n" + jsonPrint(m));
  }

});

const DROPBOX_RNT_CONFIG_FILE = process.env.DROPBOX_RNT_CONFIG_FILE || "randomNetworkTreeConfig.json";
const DROPBOX_RNT_STATS_FILE = process.env.DROPBOX_RNT_STATS_FILE || "randomNetworkTreeStats.json";

const statsFolder = "/stats/" + hostname;
const statsFile = DROPBOX_RNT_STATS_FILE;

console.log("RNT | DROPBOX_RNT_CONFIG_FILE: " + DROPBOX_RNT_CONFIG_FILE);
console.log("RNT | DROPBOX_RNT_STATS_FILE : " + DROPBOX_RNT_STATS_FILE);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("RNT | initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    updateMemoryStats();

    if (busy()) {
      process.send({ 
        op: "BUSY", 
        cause: busy(), 
        rxMessageQueue: rxMessageQueue.length, 
        activateNetworkQueue: activateNetworkQueue.length, 
        memoryUsage: statsObj.memoryUsage 
      });
    }
    else {
      process.send({ 
        op: "IDLE", 
        rxMessageQueue: rxMessageQueue.length, 
        activateNetworkQueue: activateNetworkQueue.length, 
        memoryUsage: statsObj.memoryUsage 
      });
    }

  }, cnf.statsUpdateIntervalTime);
}

async function initialize(cnf){

  initializeBusy = true;

  if (debug.enabled || debugCache.enabled){
    console.log("\nRNT | %%%%%%%%%%%%%%\nRNT |  DEBUG ENABLED \nRNT | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.RNT_PROCESS_NAME || "randomNetworkTree";
  cnf.verbose = process.env.RNT_VERBOSE_MODE || configuration.verbose;
  cnf.globalTestMode = process.env.RNT_GLOBAL_TEST_MODE || false;
  cnf.testMode = process.env.RNT_TEST_MODE || configuration.testMode;
  cnf.quitOnError = process.env.RNT_QUIT_ON_ERROR || false;

  cnf.statsUpdateIntervalTime = process.env.RNT_STATS_UPDATE_INTERVAL || 1000;

  console.log("RNT | CONFIG\n" + jsonPrint(cnf));

  await connectDb();
  return cnf;
}

setTimeout(async function(){

  let cnf;
  
  try{
    cnf = await initialize(configuration);
  }
  catch(err){
    if (err && (err.status !== 404)) {
      console.log(chalkError("RNT | *** INIT ERROR\n" + jsonPrint(err)));
      console.error.bind(console, "RNT | *** INIT ERROR: " + err);
      quit(err);
    }
    console.log(chalkError(MODULE_ID_PREFIX + " | " + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(cnf)));
  }

  initializeBusy = false;

  console.log(chalkInfo(MODULE_ID_PREFIX + " | " + cnf.processName + " STARTED " + getTimeStamp() + "\n" + jsonPrint(cnf)));
  initStatsUpdate(cnf);

}, Number(ONE_SECOND));
