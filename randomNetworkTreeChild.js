/*jslint node: true */
// "use strict";

const DEFAULT_INPUT_TYPES = [
  "emoji",
  "friends",
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

const DEFAULT_INPUTS_BINARY_MODE = false;
const ONE_SECOND = Number(1000);
const MAX_Q_SIZE = 2000;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const HashMap = require("hashmap").HashMap;
const networksHashMap = new HashMap();
const activateNetworkQueue = [];
let maxQueueFlag = false;

let activateNetworkInterval;
let activateNetworkIntervalBusy = false;

let statsUpdateInterval;

const configuration = {};
configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;

const os = require("os");
const util = require("util");
const moment = require("moment");
const treeify = require("treeify");
const debug = require("debug")("rnt");
const debugCache = require("debug")("cache");
const defaults = require("object.defaults");

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools("RNT_NNT");

let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const tcuChildName = "RNT_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const chalk = require("chalk");
const chalkWarn = chalk.yellow;
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.blue;

const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

function getTimeStamp(inputTime) {
  let currentTimeStamp;

  if (inputTime === undefined) {
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

function msToTime(d) {

  let sign = 1;

  let duration = d;

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
    + " | CR: " + tcUtils.getTimeStamp(nn.createdAt)
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
    messageObj.queue = activateNetworkQueue.length;
    messageObj.user = null;
    messageObj.category = "none";
    messageObj.categoryAuto = "none";

    activateNetworkInterval = setInterval(async function(){ 

      if (statsObj.networksLoaded && (activateNetworkQueue.length > 0) && !activateNetworkIntervalBusy) {

        activateNetworkIntervalBusy = true;

        const activateNetworkObj = activateNetworkQueue.shift();

        messageObj.user = activateNetworkObj.user;
        if (!messageObj.user.friends || (messageObj.user.friends === undefined)){
          messageObj.user.friends = [];
        }

        try {

          const activateNetworkResults = await nnTools.activate({ user: activateNetworkObj.user });

          const currentBestNetworkStats = await nnTools.updateNetworkStats({
            user: activateNetworkObj.user,
            networkOutput: activateNetworkResults.networkOutput, 
            expectedCategory: activateNetworkResults.user.category
          });

          if (statsObj.currentBestNetwork.matchRate < currentBestNetworkStats.matchRate) {
            printNetworkObj("NNT | +++ UPDATE BEST NETWORK | @" + messageObj.user.screenName + " | CM: " + messageObj.user.category, currentBestNetworkStats, chalk.black);
            await nnTools.printNetworkResults();
          }

          statsObj.currentBestNetwork = currentBestNetworkStats;

          if (configuration.testMode || configuration.verbose) {
            console.log("RNT | NN UPDATE STATS | BEST NN"
              + " | " + currentBestNetworkStats.networkId
              + " | " + currentBestNetworkStats.inputsId
              + " | RANK: " + currentBestNetworkStats.rank
              + " | " + currentBestNetworkStats.meta.match + "/" + currentBestNetworkStats.meta.total
              + " | MR: " + currentBestNetworkStats.matchRate.toFixed(2) + "%"
              + " | OUT: " + currentBestNetworkStats.meta.output
              + " | MATCH: " + currentBestNetworkStats.meta.matchFlag
            );
          }

          messageObj.currentBestNetwork = currentBestNetworkStats;
          messageObj.user = activateNetworkResults.user;
          messageObj.category = activateNetworkResults.user.category;
          messageObj.categoryAuto = activateNetworkResults.categoryAuto;

          messageObj.queue = activateNetworkQueue.length;

          process.send(messageObj);

          activateNetworkIntervalBusy = false;
        }
        catch(err){

          console.trace(chalkError("RNT | *** ACTIVATE NETWORK ERROR"
            + " | @" + activateNetworkObj.user.screenName
            + " | ", err
          ));

          activateNetworkIntervalBusy = false;
        }

        if (maxQueueFlag && (activateNetworkQueue.length < MAX_Q_SIZE)) {
          process.send({op: "QUEUE_READY", queue: activateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_READY | " + err));
              quit("SEND QUEUE_READY ERROR");
            }
          });
          maxQueueFlag = false;
        }
        else if (activateNetworkQueue.length === 0){
          process.send({op: "QUEUE_EMPTY", queue: activateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_EMPTY | " + err));
              quit("SEND QUEUE_EMPTY ERROR");
            }
          });
          maxQueueFlag = false;
        }
        else if (!maxQueueFlag && (activateNetworkQueue.length >= MAX_Q_SIZE)) {
          process.send({op: "QUEUE_FULL", queue: activateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_FULL | " + err));
              quit("SEND QUEUE_FULL ERROR");
            }
          });
          maxQueueFlag = true;
        }
        else {
          process.send({op: "QUEUE_STATS", queue: activateNetworkQueue.length}, function(err){
            if (err) { 
              console.trace(chalkError("RNT | SEND ERROR | QUEUE_STATS | " + err));
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

  networksHashMap.clear();
  statsObj.loadedNetworks = {};

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

      process.send({ op: "IDLE", queue: activateNetworkQueue.length }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
      });
    break;

    case "VERBOSE":
      console.log(chalkAlert("RNT | SET VERBOSE: " + m.verbose));
      configuration.verbose = m.verbose;
    break;

    case "LOAD_MAX_INPUTS_HASHMAP":
      // tcUtils.setMaxInputHashMap(m.maxInputHashMap);
      await nnTools.setMaxInputHashMap(m.maxInputHashMap);
      console.log(chalkLog("RNT | LOAD_MAX_INPUTS_HASHMAP"
        + " | " + Object.keys(tcUtils.getMaxInputHashMap())
      ));
    break;

    case "LOAD_NORMALIZATION":
      // tcUtils.setNormalization(m.normalization);
      await nnTools.setNormalization(m.normalization);
      console.log(chalkLog("RNT | LOAD_NORMALIZATION"
        + "\n" + jsonPrint(m.normalization)
        // + "\n" + jsonPrint(tcUtils.getNormalization())
      ));
    break;

    case "GET_BUSY":
      cause = busy();
      if (cause) {
        process.send({ op: "BUSY", cause: cause, queue: activateNetworkQueue.length }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | BUSY | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | BUSY | " + err);
        }
      });
      }
      else {
        process.send({ op: "IDLE", queue: activateNetworkQueue.length }, function(err){
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
        process.send({ op: "BUSY", cause: busy(), queue: activateNetworkQueue.length }, function(err){
        if (err) { 
          console.trace(chalkError("RNT | *** SEND ERROR | BUSY | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | BUSY | " + err);
        }
      });
      }
      else {
        process.send({ op: "IDLE", queue: activateNetworkQueue.length }, function(err){
        if (err) { 
          console.log(chalkError("RNT | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, "RNT | *** SEND ERROR | IDLE | " + err);
        }
      });
      }
    break;

    case "GET_STATS":
      try {
        await nnTools.printNetworkResults({title: "GET STATS"});
        process.send({ op: "STATS", loadedNetworks: statsObj.loadedNetworks, queue: activateNetworkQueue.length }, function(err){
          if (err) { 
            console.log(chalkError("RNT | *** SEND ERROR | GET_STATS | " + err));
            console.error.bind(console, "RNT | *** SEND ERROR | STATS | " + err);
          }
        });
      }
      catch(err){
        console.trace(chalkError("RNT | *** PRINT NETWORK STATS ERROR | " + err));
      }
    break;

    case "RESET_STATS":
      resetStats();
    break;

    case "QUIT":
      process.send({ op: "IDLE", queue: activateNetworkQueue.length }, function(err){
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
        await nnTools.loadNetwork({networkObj: m.networkObj, isBestNetwork: m.isBestNetwork});
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

      if (!m.obj.user.profileHistograms || (m.obj.user.profileHistograms === undefined)) {
        console.log(chalkWarn("RNT | ACTIVATE | UNDEFINED USER PROFILE HISTOGRAMS | @" + m.obj.user.screenName));
        m.obj.user.profileHistograms = {};
      }

      if (!m.obj.user.tweetHistograms || (m.obj.user.tweetHistograms === undefined)) {
        console.log(chalkWarn("RNT | ACTIVATE | UNDEFINED USER TWEET HISTOGRAMS | @" + m.obj.user.screenName));
        m.obj.user.tweetHistograms = {};
      }
      else if (configuration.testMode){
        console.log(chalkLog("RNT | ACTIVATE | USER TWEET HISTOGRAMS | @" + m.obj.user.screenName + " | " + Object.keys(m.obj.user.tweetHistograms)));
      }

      if (!m.obj.user.friends || (m.obj.user.friends === undefined)) {
        console.log(chalkWarn("RNT | ACTIVATE | UNDEFINED USER FRIENDS | @" + m.obj.user.screenName));
        m.obj.user.friends = [];
      }

      activateNetworkQueue.push(m.obj);

      if (configuration.verbose) {
        console.log(chalkInfo("RNT | ### ACTIVATE"
          + " [" + activateNetworkQueue.length + "]"
          + " | " + getTimeStamp()
          + " | " + m.obj.user.nodeId
          + " | @" + m.obj.user.screenName
          + " | C: " + m.obj.user.category
        ));
      }

      process.send({op: "NETWORK_BUSY", queue: activateNetworkQueue.length}, function(err){
        if (err) { 
          console.error.bind(console, "RNT | *** SEND ERROR | NETWORK_BUSY | " + err);
        }
      });

      if (!maxQueueFlag && (activateNetworkQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: activateNetworkQueue.length}, function(err){
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


const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
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

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("RNT | initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    if (busy()) {
      process.send({ op: "BUSY", cause: busy(), queue: activateNetworkQueue.length });
    }
    else {
      process.send({ op: "IDLE", queue: activateNetworkQueue.length });
    }

  }, cnf.statsUpdateIntervalTime);
}

function initialize(cnf, callback){

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
}, Number(ONE_SECOND));
