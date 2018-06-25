 /*jslint node: true */
"use strict";
require("isomorphic-fetch");

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const LANGUAGE_ANALYZE_INTERVAL = 100;
const RANDOM_NETWORK_TREE_INTERVAL = 1;
const TWITTER_DEFAULT_USER = "altthreecee00";

const MAX_SAVE_DROPBOX_NORMAL = 20 * ONE_MEGABYTE;

const os = require("os");
const moment = require("moment");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const USER_ID = "tfe_" + hostname;
const SCREEN_NAME = "tfe_" + hostname;

let userObj = {
  name: USER_ID,
  nodeId: USER_ID,
  userId: USER_ID,
  url: "https://www.twitter.com",
  screenName: SCREEN_NAME,
  namespace: "util",
  type: "TFE",
  mode: "muxstream",
  timeStamp: moment().valueOf(),
  tags: {},
  stats: {}
} ;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";
const DROPBOX_LIST_FOLDER_LIMIT = 50;
// const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

const DEFAULT_FETCH_ALL_INTERVAL = 120*ONE_MINUTE;

const FSM_TICK_INTERVAL = ONE_SECOND;
const PROCESS_USER_QUEUE_INTERVAL = 1;

const TEST_MODE_TOTAL_FETCH = 20;
const TEST_MODE_FETCH_COUNT = 10;  // per request twitter user fetch count
const TEST_DROPBOX_NN_LOAD = 25;
const TFC_CHILD_PREFIX = "TFC_";
const SAVE_CACHE_DEFAULT_TTL = 120; // seconds
const TFE_NUM_RANDOM_NETWORKS = 100;
const IMAGE_QUOTA_TIMEOUT = 60000;
const DEFAULT_FORCE_IMAGE_ANALYSIS = true;
const DEFAULT_FORCE_INIT_RANDOM_NETWORKS = true;
const DEFAULT_FETCH_COUNT = 200;  // per request twitter user fetch count
const DEFAULT_MIN_SUCCESS_RATE = 75;
const DEFAULT_MIN_MATCH_RATE = 80;
const DEFAULT_MIN_INPUTS_GENERATED = 400 ;
const DEFAULT_MAX_INPUTS_GENERATED = 750 ;
const DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN = 5;
const DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN = 0.4;
const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;
const OFFLINE_MODE = false;
const RANDOM_NETWORK_TREE_MSG_Q_INTERVAL = 1; // ms
const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

const fs = require("fs");
const debug = require("debug")("tfe");
const NodeCache = require("node-cache");
const util = require("util");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");
const async = require("async");
const Stately = require("stately.js");

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");
// const twitterImageParser = require("../twitter-image-parser");

const HashMap = require("hashmap").HashMap;

let statsObj = {};
statsObj.fetchCycle = 0;
statsObj.newBestNetwork = false;
statsObj.fetchAllIntervalStartMoment = moment();

let tfeChildHashMap = {};
let fsm;
let fsmTickInterval;
let fetchAllInterval;
let fetchAllIntervalReady = false;

let bestNetworkHashMap = new HashMap();
// let trainingSetHashMap = new HashMap();

let maxInputHashMap = {};

let randomNetworkTree;
let randomNetworkTreeMessageRxQueueInterval;
let randomNetworkTreeMessageRxQueueReadyFlag = true;
let randomNetworkTreeReadyFlag = false;
let randomNetworkTreeBusyFlag = false;
let randomNetworkTreeActivateQueueSize = 0;
let randomNetworkTreeMessageRxQueue = [];

let randomNetworksObj = {};

let dbConnection;
let dbConnectionReadyInterval;
let dbConnectionReady = false;

let enableImageAnalysis = true;

let langAnalyzer;
let langAnalyzerMessageRxQueueInterval;
let langAnalyzerMessageRxQueueReadyFlag = true;
let languageAnalysisBusyFlag = false;
let langAnalyzerMessageRxQueue = [];

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
let userDbUpdateQueue = [];

let quitWaitInterval;
let quitFlag = false;

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

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tfe";
const Slack = require("slack-node");

let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text, callback) {
  debug(chalkInfo("SLACK POST: " + text));
  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response) {
    if (err) {
      console.log(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}
// will use histograms to determine neural net inputs
// for emoji, hashtags, mentions, words

let globalHistograms = {};

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";
let bestRuntimeNetworkId = false;
let loadedNetworksFlag = false;
let networksSentFlag = false;
let currentBestNetworkId = false;

let currentBestNetwork = {};
currentBestNetwork.successRate = 0;
currentBestNetwork.matchRate = 0;
currentBestNetwork.overallMatchRate = 0;

let processUserQueue = [];
let processUserQueueInterval;
let processUserQueueReady = true;

let socket;
let socketKeepAliveInterval;

let saveFileQueueInterval;
let saveFileBusy = false;
let saveFileQueue = [];
let statsUpdateInterval;
let prevBestNetworkId = "";

const jsonPrint = function (obj) {
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

const quit = function(cause) {

  clearInterval(dbConnectionReadyInterval);

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  quitFlag = true;

  fsm.fsm_reset();

  Object.keys(tfeChildHashMap).forEach(function(user) {
    tfeChildHashMap[user].child.send({op: "QUIT"});
  });

  if (cause && (cause.source === "RNT")) {
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
  }

  if (cause && (cause.source !== "RNT") && (randomNetworkTree && (randomNetworkTree !== undefined))) {
    randomNetworkTree.send({op: "STATS"});
    randomNetworkTree.send({op: "QUIT"});
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
  }

  console.log( "\nTFE | ... QUITTING ..." );

  if (cause) {
    console.log( "CAUSE: " + jsonPrint(cause) );
  }

  let slackText = "\n*QUIT*";
  slackText = slackText + "\nHOST:        " + hostname;
  slackText = slackText + "\nBEST:        " + bestRuntimeNetworkId;
  slackText = slackText + "\nOAMR:        " + currentBestNetwork.overallMatchRate.toFixed(2) + "%";
  slackText = slackText + "\nMR:          " + currentBestNetwork.matchRate.toFixed(2) + "%";
  slackText = slackText + "\nSR:          " + currentBestNetwork.successRate.toFixed(2) + "%";
  slackText = slackText + "\nSTART:       " + statsObj.startTimeMoment.format(compactDateTimeFormat);
  slackText = slackText + "\nELPSD:       " + msToTime(statsObj.elapsed);
  slackText = slackText + "\nFETCH CYCLES: " + statsObj.fetchCycle;
  slackText = slackText + "\nFETCH ELPSD: " + msToTime(statsObj.fetchCycleElapsed);
  slackText = slackText + "\nTOT PRCSSD:  " + statsObj.users.totalFriendsProcessed;
  slackText = slackText + "\nGTOT PRCSSD: " + statsObj.users.grandTotalFriendsProcessed;

  console.log("TFE | SLACK TEXT: " + slackText);

  slackPostMessage(slackChannel, slackText);

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy
      && (!randomNetworkTreeBusyFlag || randomNetworkTreeReadyFlag)
      && (saveFileQueue.length === 0)
      && (langAnalyzerMessageRxQueue.length === 0)
      && (randomNetworkTreeMessageRxQueue.length === 0)
      && (userDbUpdateQueue.length === 0)
      && randomNetworkTreeMessageRxQueueReadyFlag
      && !languageAnalysisBusyFlag
      && userDbUpdateQueueReadyFlag
      ) {

      clearInterval(statsUpdateInterval);
      clearInterval(userDbUpdateQueueInterval);
      clearInterval(quitWaitInterval);

      console.log(chalkAlert("ALL PROCESSES COMPLETE ... QUITTING"
        + " | SAVE FILE BUSY: " + saveFileBusy
        + " | SAVE FILE Q: " + saveFileQueue.length
        + " | RNT BUSY: " + randomNetworkTreeBusyFlag
        + " | RNT READY: " + randomNetworkTreeReadyFlag
        + " | RNT AQ: " + randomNetworkTreeActivateQueueSize
        + " | RNT MQ: " + randomNetworkTreeMessageRxQueue.length
        + " | LA MQ: " + langAnalyzerMessageRxQueue.length
        + " | USR DB UDQ: " + userDbUpdateQueue.length
      ));

        setTimeout(function() {

          dbConnection.close(function () {
            console.log(chalkAlert("\n==========================\nMONGO DB CONNECTION CLOSED\n==========================\n"));
            process.exit();
          });

        }, 5000);


    }
    else {
      if (cause && (cause.source !== "RNT") && (randomNetworkTree && (randomNetworkTree !== undefined))) {
        randomNetworkTree.send({op: "STATS"});
        randomNetworkTree.send({op: "QUIT"});
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
      }
      console.log(chalkAlert("... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
        + " | SAVE FILE BUSY: " + saveFileBusy
        + " | SAVE FILE Q: " + saveFileQueue.length
        + " | RNT BUSY: " + randomNetworkTreeBusyFlag
        + " | RNT READY: " + randomNetworkTreeReadyFlag
        + " | RNT AQ: " + randomNetworkTreeActivateQueueSize
        + " | RNT MQ: " + randomNetworkTreeMessageRxQueue.length
        + " | LA MQ: " + langAnalyzerMessageRxQueue.length
        + " | USR DB UDQ: " + userDbUpdateQueue.length
      ));
    }
  }, 1000);
};

const mongoose = require("mongoose");

const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");

let NeuralNetwork;
let User;

let userServer;
let userServerReady = false;


const wordAssoDb = require("@threeceelabs/mongoose-twitter");

wordAssoDb.connect(process.title, function(err, dbCon) {
  if (err) {
    console.log(chalkError("*** TFE | MONGO DB CONNECTION ERROR: " + err));
    quit("MONGO DB CONNECTION ERROR");
  }
  else {

    dbConnection = dbCon;

    dbConnectionReady = true;

    dbConnection.on("error", function(){
      console.error.bind(console, "*** TFE | MONGO DB CONNECTION ERROR ***\n");
      console.log(chalkError("*** TFE | MONGO DB CONNECTION ERROR ***\n"));
      dbConnectionReady = false;
    });

    dbConnection.on("disconnected", function(){
      console.error.bind(console, "*** TFE | MONGO DB CONNECTION DISCONNECTED ***\n");
      console.log(chalkAlert("*** TFE | MONGO DB CONNECTION DISCONNECTED ***\n"));
      dbConnectionReady = false;
    });

    console.log(chalkLog("TFE | MONGOOSE DEFAULT CONNECTION OPEN"));

    NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
    User = mongoose.model("User", userModel.UserSchema);

    userServer = require("@threeceelabs/user-server-controller");

    userServerReady = true;
  }
});

const cp = require("child_process");

let previousRandomNetworksHashMap = {};
let availableNeuralNetHashMap = {};

const inputTypes = ["emoji", "hashtags", "images", "mentions", "urls", "words"];

inputTypes.sort();

let inputArrays = {};
let stdin;
let abortCursor = false;
// let categorizedUserHashMapReadyFlag = false;
let neuralNetworkInitialized = false;
let TFE_USER_DB_CRAWL = false;

let configuration = {};
configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
configuration.DROPBOX.DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

configuration.forceImageAnalysis = DEFAULT_FORCE_IMAGE_ANALYSIS;
configuration.forceInitRandomNetworks = DEFAULT_FORCE_INIT_RANDOM_NETWORKS;
configuration.enableLanguageAnalysis = false;
configuration.forceLanguageAnalysis = false;
configuration.processUserQueueInterval = 20;
configuration.bestNetworkIncrementalUpdate = false;
configuration.twitterUsers = ["altthreecee02", "altthreecee01", "altthreecee00"];
configuration.minInputsGenerated = DEFAULT_MIN_INPUTS_GENERATED;
configuration.maxInputsGenerated = DEFAULT_MAX_INPUTS_GENERATED;
configuration.histogramParseTotalMin = DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;
configuration.histogramParseDominantMin = DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN;
configuration.saveFileQueueInterval = 1000;
configuration.testMode = false;
configuration.minSuccessRate = DEFAULT_MIN_SUCCESS_RATE;
configuration.minMatchRate = DEFAULT_MIN_MATCH_RATE;
configuration.fetchCount = configuration.testMode ? TEST_MODE_FETCH_COUNT :  DEFAULT_FETCH_COUNT;
configuration.keepaliveInterval = 5*ONE_SECOND;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.quitOnComplete = false;
statsObj.childrenFetchBusy = false;

statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.elapsed = 0;
statsObj.fetchCycleStartMoment = moment();
statsObj.fetchCycleEndMoment = moment();
statsObj.fetchCycleElapsed = 0;
statsObj.pid = process.pid;
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.userReadyTransmitted = false;
statsObj.userReadyAck = false;
statsObj.heartbeatsReceived = 0;
statsObj.users = {};
statsObj.users.totalFriendsCount = 0;
statsObj.users.totalFriendsFetched = 0;
statsObj.users.totalPercentFetched = 0;
statsObj.users.totalFriendsProcessed = 0;
statsObj.users.totalPercentProcessed = 0;
statsObj.users.grandTotalFriendsFetched = 0;
statsObj.users.grandTotalPercentFetched = 0;
statsObj.users.grandTotalFriendsProcessed = 0;
statsObj.users.grandTotalPercentProcessed = 0;
statsObj.users.classifiedAuto = 0;
statsObj.users.classified = 0;
statsObj.user = {};
statsObj.user.altthreecee00 = {};
statsObj.user.altthreecee01 = {};
statsObj.user.altthreecee02 = {};
statsObj.user.altthreecee00.friendsProcessed = 0;
statsObj.user.altthreecee00.percentProcessed = 0;
statsObj.user.altthreecee01.friendsProcessed = 0;
statsObj.user.altthreecee01.percentProcessed = 0;
statsObj.user.altthreecee02.friendsProcessed = 0;
statsObj.user.altthreecee02.percentProcessed = 0;
statsObj.analyzer = {};
statsObj.analyzer.total = 0;
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.errors = 0;
statsObj.twitterErrors = 0;
statsObj.fetchUsersComplete = false;

statsObj.bestNetworks = {};

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = false;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.overallMatchRate = 0;
statsObj.bestNetwork.numInputs = 0;
statsObj.bestNetwork.inputsId = "";

statsObj.totalInputs = 0;
statsObj.numNetworksLoaded = 0;
statsObj.numNetworksUpdated = 0;
statsObj.numNetworksSkipped = 0;
statsObj.histograms = {};
statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};
statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;
statsObj.numLangAnalyzed = 0;
statsObj.categorized = {};
statsObj.categorized.manual = {};
statsObj.categorized.auto = {};
Object.keys(statsObj.categorized).forEach(function(cat) {
  statsObj.categorized[cat].left = 0;
  statsObj.categorized[cat].right = 0;
  statsObj.categorized[cat].neutral = 0;
  statsObj.categorized[cat].positive = 0;
  statsObj.categorized[cat].negative = 0;
  statsObj.categorized[cat].none = 0;
  statsObj.categorized[cat].other = 0;
});
statsObj.categorized.total = 0;
statsObj.categorized.totalManual = 0;
statsObj.categorized.totalAuto = 0;

const TFE_RUN_ID = hostname 
+ "_" + statsObj.startTimeMoment.format(compactDateTimeFormat) 
+ "_" + process.pid;

statsObj.runId = TFE_RUN_ID;

let twitterUserHashMap = {};

let defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
const DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

let dropboxConfigHostFolder = "/config/utility/" + hostname;
let dropboxConfigDefaultFolder = "/config/utility/default";
let dropboxConfigFile = hostname + "_" + DROPBOX_TFE_CONFIG_FILE;

let statsFolder = "/stats/" + hostname + "/followerExplorer";
let statsFile = DROPBOX_TFE_STATS_FILE;

configuration.neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

let localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
let bestNetworkFolder = (hostname === "google") ? "/config/utility/best/neuralNetworks" : localBestNetworkFolder;

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const defaultMaxInputHashmapFile = "maxInputHashMap.json";

const localHistogramsFolder = dropboxConfigHostFolder + "/histograms";
const defaultHistogramsFolder = dropboxConfigDefaultFolder + "/histograms";

console.log("DROPBOX_TFE_CONFIG_FILE: " + DROPBOX_TFE_CONFIG_FILE);
console.log("DROPBOX_TFE_STATS_FILE : " + DROPBOX_TFE_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const Dropbox = require("./js/dropbox").Dropbox;
const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

let fsmPreviousState = "IDLE";

// ==================================================================
// NN CACHE
// ==================================================================
let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if (saveCacheTtl === undefined) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }

console.log("SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

console.log("SAVE CACHE CHECK PERIOD: " + saveCacheCheckPeriod + " SECONDS");

const saveCache = new NodeCache({
  stdTTL: saveCacheTtl,
  checkperiod: saveCacheCheckPeriod
});

function saveCacheExpired(file, fileObj) {
  debug(chalkLog("XXX $ SAVE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + file
  ));
  saveFileQueue.push(fileObj);
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj) {
  debug(chalkLog("TFE | $$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));
  if (file === bestRuntimeNetworkFileName) {
    saveCache.ttl(bestRuntimeNetworkFileName, 30, function( err, changed ) {
      if( !err ) {
        debug("SAVE CACHE TTL bestRuntimeNetworkFileName: 30 | CHANGED: " + changed ); // true
        // ... do something ...
      }
    });
  }
});

function getTimeStamp(inputTime) {
  let currentTimeStamp ;
  if (inputTime === undefined) {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isDate(new Date(inputTime))) {
    currentTimeStamp = moment(new Date(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function resetTwitterUserState(user, callback) {
  console.log(chalkTwitterBold("RESET TWITTER STATE"
    + " | @" + user
  ));
  if (statsObj.user[user] === undefined) {
    statsObj.user[user] = {};
  }
  statsObj.user[user].endFetch = true;
  statsObj.user[user].nextCursor = false;
  statsObj.user[user].nextCursorValid = false;
  statsObj.user[user].totalFriendsFetched = 0;
  statsObj.user[user].twitterRateLimit = 0;
  statsObj.user[user].twitterRateLimitExceptionFlag = false;
  statsObj.user[user].twitterRateLimitRemaining = 0;
  statsObj.user[user].twitterRateLimitRemainingTime = 0;
  statsObj.user[user].twitterRateLimitResetAt = moment();
  statsObj.user[user].friendsProcessed = 0;
  statsObj.user[user].percentProcessed = 0;
  statsObj.user[user].friendsProcessStart = moment();
  statsObj.user[user].friendsProcessEnd = moment();
  statsObj.user[user].friendsProcessElapsed = 0;
  if (callback !== undefined) { callback(); }
}

function resetAllTwitterUserState(callback) {
  async.forEach(Object.keys(twitterUserHashMap), function(user, cb) {
    resetTwitterUserState(user, function() {
      cb();
    });
  }, function() {
    callback();
  });
}

function updateBestNetworkStats(networkObj) {

  if (statsObj.bestNetwork === undefined) { statsObj.bestNetwork = {}; }

  statsObj.bestRuntimeNetworkId = networkObj.networkId;
  statsObj.currentBestNetworkId = networkObj.networkId;


  statsObj.bestNetwork.networkId = networkObj.networkId;
  statsObj.bestNetwork.network = networkObj.network;
  statsObj.bestNetwork.networkType = networkObj.networkType;
  statsObj.bestNetwork.successRate = networkObj.successRate;
  statsObj.bestNetwork.matchRate = networkObj.matchRate;
  statsObj.bestNetwork.overallMatchRate = networkObj.overallMatchRate;
  statsObj.bestNetwork.input = networkObj.network.input;
  statsObj.bestNetwork.numInputs = networkObj.numInputs;
  statsObj.bestNetwork.inputsId = networkObj.inputsId;
  statsObj.bestNetwork.output = networkObj.network.output;
  statsObj.bestNetwork.evolve = {};

  if (networkObj.evolve !== undefined) {
    statsObj.bestNetwork.evolve = networkObj.evolve;
    if (statsObj.bestNetwork.evolve.options !== undefined) { 
      statsObj.bestNetwork.evolve.options.networkObj = null;
    }
  }
}

function loadFile(path, file, callback) {
  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));
  let fullPath = path + "/" + file;
  if (OFFLINE_MODE) {
    if (hostname === "mbp2") {
      fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
      debug(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
    }
    fs.readFile(fullPath, "utf8", function(err, data) {
      if (err) {
        console.log(chalkError("fs readFile ERROR: " + err));
      }
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE"
        + " | " + fullPath
      ));
      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(data);
          callback(null, fileObj);
        }
        catch(e) {
          console.trace(chalkError("TFE | JSON PARSE ERROR: " + e));
          callback("JSON PARSE ERROR", null);
        }
      }
      else {
        callback(null, null);
      }
    });
   }
  else {
    dropboxClient.filesDownload({path: fullPath})
    .then(function(data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
      ));
      if (file.match(/\.json$/gi)) {
        let payload = data.fileBinary;
        debug(payload);
        try {
          let fileObj = JSON.parse(payload);
          callback(null, fileObj);
        }
        catch(e) {
          console.trace(chalkError("TFE | JSON PARSE ERROR | PATH: " + fullPath));
          console.trace(chalkError("TFE | JSON PARSE ERROR: " + fullPath + " | " + jsonPrint(e)));
          console.trace(chalkError("TFE | JSON PARSE ERROR: " + e));
          callback("JSON PARSE ERROR", null);
        }
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {
      console.log(chalkError("TFE | DROPBOX loadFile ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("TFE | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("TFE | " + jsonPrint(error.error)));
      if (error.status === 404) {
        console.log(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        callback(null, null);
      }
      else if (error.status === 409) {
        console.log(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
        callback(error, null);
      }
      else if (error.status === 0) {
        console.log(chalkError("TFE | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        callback(null, null);
      }
      else {
        callback(error, null);
      }
    });
  }
}

function loadMaxInputDropbox(folder, file, callback) {

  console.log(chalkNetwork("TFE | ... LOADING DROPBOX MAX INPUT HASHMAP | " + folder + "/" + file));

  let options = {path: folder};

  loadFile(folder, file, function(err, maxInputHashMapObj) {
    if (err) {
      console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR: " + err));
      if (callback !== undefined) { callback(err); }
    }
    else if ((maxInputHashMapObj === undefined) || !maxInputHashMapObj) {
      console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED ??? "));
      if (callback !== undefined) { callback(null); }
    }
    else {

      maxInputHashMap = {};
      maxInputHashMap = deepcopy(maxInputHashMapObj.maxInputHashMap);

      console.log(chalkInfo("TFE | LOADED DROPBOX MAX INPUT HASHMAP"
      ));

      if (callback !== undefined) { callback(null); }
    }
  });

}

function updateGlobalHistograms(params, callback) {

  // params.user

  async.each(Object.keys(params.user.histograms), function(type, cb0) {

    if (globalHistograms[type] === undefined) { globalHistograms[type] = {}; }

    async.each(Object.keys(params.user.histograms[type]), function(item, cb1) {

      if (globalHistograms[type][item] === undefined) {
        globalHistograms[type][item] = {};
        globalHistograms[type][item].total = 0;
        globalHistograms[type][item].left = 0;
        globalHistograms[type][item].neutral = 0;
        globalHistograms[type][item].right = 0;
        globalHistograms[type][item].positive = 0;
        globalHistograms[type][item].negative = 0;
        globalHistograms[type][item].uncategorized = 0;
      }

      globalHistograms[type][item].total += 1;

      if (params.user.category) {
        if (params.user.category === "left") { globalHistograms[type][item].left += 1; }
        if (params.user.category === "neutral") { globalHistograms[type][item].neutral += 1; }
        if (params.user.category === "right") { globalHistograms[type][item].right += 1; }
        if (params.user.category === "positive") { globalHistograms[type][item].positive += 1; }
        if (params.user.category === "negative") { globalHistograms[type][item].negative += 1; }
      }
      else {
        globalHistograms[type][item].uncategorized += 1;
      }

      cb1();

    }, function() {

      cb0();

    });

  }, function() {

    if (callback !== undefined) { callback(); }

  });
}

function printNetworkObj(title, networkObj) {
  console.log(chalkNetwork("======================================"
    + "\n" + title
    + "\nID:         " + networkObj.networkId
    + "\nCREATED:    " + getTimeStamp(networkObj.createdAt)
    + "\nSR:         " + networkObj.successRate.toFixed(2) + "%"
    + "\nMR:         " + networkObj.matchRate.toFixed(2) + "%"
    + "\nOAMR:       " + networkObj.overallMatchRate.toFixed(2) + "%"
    + "\nINPUTS ID:  " + networkObj.inputsId
    + "\nINPUTS:     " + Object.keys(networkObj.inputsObj.inputs)
    + "\nNUM INPUTS: " + networkObj.numInputs
    + "\n======================================\n"
  ));
}

function processBestNetwork(params, callback){

  let networkObj = params.networkObj;
  let folder = params.folder;
  let entry = {};

  if (params.entry === undefined) {
    entry.name = networkObj.networkId + ".json";
    entry.content_hash = false;
    entry.client_modified = moment().valueOf();
  }
  else {
    entry = params.entry;
  }

  const bnhmObj = {
    entry: entry,
    networkObj: networkObj
  };

  bestNetworkHashMap.set(networkObj.networkId, bnhmObj);
  saveFileQueue.push({folder: folder, file: entry.name, obj: networkObj });
  availableNeuralNetHashMap[networkObj.networkId] = true;

  if (
      !currentBestNetwork
      || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)
    ) 
  {
    currentBestNetwork = deepcopy(networkObj);

    prevBestNetworkId = bestRuntimeNetworkId;
    bestRuntimeNetworkId = networkObj.networkId;

    statsObj.newBestNetwork = true;

    if (hostname === "google") {

      updateBestNetworkStats(networkObj);

      const fileObj = {
        networkId: bestRuntimeNetworkId,
        successRate: networkObj.successRate,
        matchRate:  networkObj.matchRate,
        overallMatchRate:  networkObj.overallMatchRate
      };

      saveCache.set(
        bestRuntimeNetworkFileName,
        {folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj }
      );
    }

    if (callback !== undefined) { callback(null, null); }
  }
  else {
    if (callback !== undefined) { callback(null, null); }
  }
}

function loadBestNetworkDropboxFolder(folder, callback) {

  let options = {path: folder};
  
  statsObj.newBestNetwork = false;

  statsObj.numNetworksLoaded = 0;
  statsObj.numNetworksUpdated = 0;
  statsObj.numNetworksSkipped = 0;

  dropboxClient.filesListFolder(options)
  .then(function(response) {

    if (response.entries.length === 0) {

      console.log(chalkLog("TFE | NO DROPBOX NETWORKS FOUND" + " | " + options.path ));
      console.log(chalkLog("TFE | ... LOADING NNs FROM DB ..."));

      NeuralNetwork.find({}).sort({"overallMatchRate": -1}).limit(10).exec(function(err, nnArray){
        if (err){
          console.log(chalkError("*** NEURAL NETWORK FIND ERROR: " + err));
          if (callback !== undefined) {
            return callback( null, {best: currentBestNetwork} );
          }
          else {
            return;
          }
        }

        if (nnArray === 0){
          console.log(chalkError("*** NEURAL NETWORKS NOT FOUND IN DB NOR DROPBOX"));
          if (callback !== undefined) {
            return callback( null, {best: currentBestNetwork} );
          }
          return;
        }

        currentBestNetwork = deepcopy(nnArray[0]);

        if (currentBestNetwork.successRate === undefined) { currentBestNetwork.successRate = 0; }
        if (currentBestNetwork.matchRate === undefined) { currentBestNetwork.matchRate = 0; }
        if (currentBestNetwork.overallMatchRate === undefined) { currentBestNetwork.overallMatchRate = 0; }

        console.log(chalk.bold.blue("+++ BEST NEURAL NETWORK LOADED FROM DB"
          + " | " + currentBestNetwork.networkId
          + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
          + " | MR: " + currentBestNetwork.matchRate.toFixed(2) + "%"
          + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2) + "%"
        ));

        async.eachSeries(nnArray, function(networkObj, cb){

          processBestNetwork({networkObj: networkObj, folder: folder}, function(err, results){
            if (err) {
              console.log(chalkError("*** PROCESS BEST NETWORK ERROR: " + err));
              return cb(err);
            }

            cb();
          });
        }, function(err){
          if (callback !== undefined) { 
            callback( null, {best: currentBestNetwork} ); 
          }
          else {
            return;
          }
        });
      });
    }
    else {
      statsObj.numNetworksLoaded = 0;

      console.log(chalkLog("TFE | DROPBOX NETWORKS"
        + " | " + options.path
        + " | FOUND " + response.entries.length + " FILES"
      ));

      async.eachSeries(response.entries, function(entry, cb) {

        if (configuration.testMode && (statsObj.numNetworksLoaded >= TEST_DROPBOX_NN_LOAD)) {

          console.log(chalkLog("TFE | *** TEST MODE *** LOADED DROPBOX NETWORKS"
            + " | TEST_DROPBOX_NN_LOAD: " + TEST_DROPBOX_NN_LOAD
            + " | FOUND " + response.entries.length + " FILES"
          ));

          return(cb("TEST_MODE LOAD DONE"));
        }

        debug(chalkLog("DROPBOX NETWORK FOUND"
          + " | " + options.path
          + " | " + entry.name
        ));

        if (entry.name === bestRuntimeNetworkFileName) {
          return(cb());
        }

        const networkId = entry.name.replace(".json", "");

        if (bestNetworkHashMap.has(networkId)) {

          const bnhmObj = bestNetworkHashMap.get(networkId);

          if (!bnhmObj || (bnhmObj === undefined)) {
            console.log(chalkError("bestNetworkHashMap ENTRY UNDEFINED??? | " + networkId));
            return(cb());
          }

          if (bnhmObj.entry === undefined) {
            console.log(chalkError("bestNetworkHashMap ENTRY PROP UNDEFINED???"
              + " | " + networkId + "\n" + jsonPrint(bnhmObj)));
            return(cb());
          }

          if (bnhmObj.entry.content_hash !== entry.content_hash) {

            console.log(chalkInfo("DROPBOX NETWORK CONTENT CHANGE"
              + " | " + getTimeStamp(entry.client_modified)
              + " | " + entry.name
            ));

            loadFile(folder, entry.name, function(err, networkObj) {

              if (err) {
                console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
                return(cb());
              }

              if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
              if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }

              statsObj.numNetworksUpdated += 1;

              console.log(chalkInfo("+0+ UPDATED NN"
                + " [ UPDATED: " + statsObj.numNetworksUpdated
                + " | LOADED: " + statsObj.numNetworksLoaded
                + " | SKIPPED: " + statsObj.numNetworksSkipped + " ]"
                + " SR: " + networkObj.successRate.toFixed(2) + "%"
                + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                + " | CR: " + getTimeStamp(networkObj.createdAt)
                + " | IN: " + networkObj.numInputs
                + " | " + networkObj.networkId
              ));

              processBestNetwork({networkObj: networkObj, entry: entry, folder: folder}, function(err, results){
                if (err) {
                  console.log(chalkError("*** PROCESS BEST NETWORK ERROR: " + err));
                  return cb(err);
                }

                cb();
              });
            });
          }
          else {
            debug(chalkLog("DROPBOX NETWORK CONTENT SAME  "
              + " | " + entry.name
            ));
            async.setImmediate(function() { cb(); });
          }
        }
        else {
          loadFile(folder, entry.name, function(err, networkObj) {
            if (err) {
              console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
              return(cb());
            }

            if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
            if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }

            if (
              (networkObj.overallMatchRate === 0)
              || (networkObj.overallMatchRate >= configuration.minMatchRate)
              || (networkObj.successRate >= configuration.minSuccessRate)
              || (configuration.testMode 
                && (networkObj.successRate >= 0.5*configuration.minSuccessRate) 
                && (networkObj.overallMatchRate === 0))
              || (configuration.testMode && (networkObj.overallMatchRate >= 0.5*configuration.minMatchRate))
            ) {

              statsObj.numNetworksLoaded += 1;

              console.log(chalkBlue("+++ LOADED NN"
                + " [ UPDATED: " + statsObj.numNetworksUpdated
                + " | LOADED: " + statsObj.numNetworksLoaded
                + " | SKIPPED: " + statsObj.numNetworksSkipped + " ]"
                + " SR: " + networkObj.successRate.toFixed(2) + "%"
                + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                + " | CR: " + getTimeStamp(networkObj.createdAt)
                + " | IN: " + networkObj.numInputs
                + " | " + networkObj.networkId
              ));

              processBestNetwork({networkObj: networkObj, entry: entry, folder: folder}, function(err, results){
                if (err) {
                  console.log(chalkError("*** PROCESS BEST NETWORK ERROR: " + err));
                  return cb(err);
                }

                cb();
              });

            }
            else {
              statsObj.numNetworksSkipped += 1;
              console.log(chalkInfo("--- SKIP LOAD NN "
                + " [ UPDATED: " + statsObj.numNetworksUpdated
                + " | LOADED: " + statsObj.numNetworksLoaded
                + " | SKIPPED: " + statsObj.numNetworksSkipped + " ]"
                + " SR: " + networkObj.successRate.toFixed(2) + "%"
                + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
                + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
                + " | CR: " + getTimeStamp(networkObj.createdAt)
                + " | IN: " + networkObj.numInputs
                + " | " + networkObj.networkId
              ));
              async.setImmediate(function() { cb(); });
            }
          });
        }

      }, function() {
        if (statsObj.newBestNetwork) {

          statsObj.newBestNetwork = false;
          printNetworkObj("BEST NETWORK", currentBestNetwork);

        }
        console.log(chalkLog("\n===================================\n"
          + "LOADED DROPBOX NETWORKS"
          + "\nFOLDER:        " + options.path
          + "\nFILES FOUND:   " + response.entries.length + " FILES"
          + "\nNN DOWNLOADED: " + statsObj.numNetworksLoaded
          + "\nNN UPDATED:    " + statsObj.numNetworksUpdated
          + "\nNN SKIPPED:    " + statsObj.numNetworksSkipped
          + "\nNN IN HASHMAP: " + bestNetworkHashMap.size
          + "\nNN AVAIL:      " + Object.keys(availableNeuralNetHashMap).length
          + "\n===================================\n"
        ));
        if (callback !== undefined) { callback( null, {best: currentBestNetwork} ); }
      });
    }

  })
  .catch(function(err) {
    console.log(chalkError("loadBestNetworkDropboxFolder *** DROPBOX FILES LIST FOLDER ERROR"
      + "\nOPTIONS: " + jsonPrint(options)
      + "\nERROR: " + err
      + "\nERROR: " + jsonPrint(err)
    ));
    if (callback !== undefined) { callback(err, null); }
  });
}

function initRandomNetworks(params, callback) {

  if (loadedNetworksFlag && !configuration.forceInitRandomNetworks) {
    console.log(chalkLog("SKIP INIT RANDOM NETWORKS: loadedNetworksFlag: " + loadedNetworksFlag));
    return callback(null, randomNetworksObj);
  }

  async.each(Object.keys(randomNetworksObj), function(nnId, cb) {

    // looks like i was trying to insure that all nns in bestNetwork folder would
    // eventually be used is there are more than the max i want to test at a time.

    // but need to add newly evolved nns...

    previousRandomNetworksHashMap[nnId] = {};
    previousRandomNetworksHashMap[nnId] = statsObj.bestNetworks[nnId] || true;

    delete randomNetworksObj[nnId];

    cb();

  }, function() {

    randomNetworksObj = {};

    async.whilst(

      function() {
        return ((Object.keys(availableNeuralNetHashMap).length > 0) 
          && (Object.keys(randomNetworksObj).length < params.numRandomNetworks));
      },

      function(cb) {

        const nnId = randomItem(Object.keys(availableNeuralNetHashMap));

        delete availableNeuralNetHashMap[nnId];

        const networkObj = bestNetworkHashMap.get(nnId).networkObj;

        randomNetworksObj[nnId] = {};
        randomNetworksObj[nnId] = networkObj;

        console.log(chalkBlue("+++ RANDOM NETWORK"
          + " [" + Object.keys(randomNetworksObj).length + "]"
          + " | AVAIL NNs: " + Object.keys(availableNeuralNetHashMap).length
          + " | SR: " + randomNetworksObj[nnId].successRate.toFixed(2) + "%"
          + " | MR: " + randomNetworksObj[nnId].matchRate.toFixed(2) + "%"
          + " | OAMR: " + randomNetworksObj[nnId].overallMatchRate.toFixed(2) + "%"
          + " | " + nnId
        ));

        cb();

    }, function(err) {
      loadedNetworksFlag = true;
      callback(err, randomNetworksObj);
    });
  });
}

function loadBestNeuralNetworkFile(callback) {

  console.log(chalkLog("... LOADING DROPBOX NEURAL NETWORKS"
    + " | FOLDER: " + bestNetworkFolder
    + " | TIMEOUT: " + DEFAULT_DROPBOX_TIMEOUT + " MS"
  ));

  loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, results) {
    if (err) {
      console.log(chalkError("LOAD DROPBOX NETWORKS ERROR: " + err));
      callback(new Error(err), null);
    }
    else if (results.best === undefined) {
      console.log(chalkAlert("??? NO BEST DROPBOX NETWORK ???"));
      callback(null, null);
    }
    else {

      initRandomNetworks({ numRandomNetworks: configuration.numRandomNetworks }, function(err, networksObj) {

        if (err) {
          console.log(chalkError("initRandomNetworks ERROR: " + err));
          return callback(err, null);
        }

        if (loadedNetworksFlag
          && (!networksSentFlag || configuration.forceInitRandomNetworks)
          && (randomNetworkTree && (randomNetworkTree !== undefined))
          && (Object.keys(networksObj).length > 0))
        {
          if (randomNetworkTree && (randomNetworkTree !== undefined)) {

            networksSentFlag = true;

            randomNetworkTree.send({ op: "LOAD_NETWORKS", networksObj: networksObj }, function() {
              networksSentFlag = false;
              console.log(chalkBlue("SENT RANDOM NETWORKS | " + Object.keys(networksObj).length));
            });
          }
        }
        else {
          const randomNetworkTreeDefined = (randomNetworkTree && (randomNetworkTree !== undefined));
          console.log(chalkAlert("*** RANDOM NETWORKS NOT SENT"
            + " | NNs: " + Object.keys(networksObj).length
            + " | randomNetworkTree: " + randomNetworkTreeDefined
            + " | loadedNetworksFlag: " + loadedNetworksFlag
            + " | networksSentFlag: " + networksSentFlag
          ));
        }

        let bnwObj;
        let bnhmObj;

        if (bestRuntimeNetworkId && bestNetworkHashMap.has(bestRuntimeNetworkId)) {

          if (currentBestNetworkId !== bestRuntimeNetworkId) {

            currentBestNetworkId = bestRuntimeNetworkId;

            bnhmObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnwObj = deepcopy(bnhmObj.networkObj);
            bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;
            bnwObj.overallMatchRate = (bnwObj.overallMatchRate !== undefined) ? bnwObj.overallMatchRate : 0;

            updateBestNetworkStats(bnwObj);

             console.log(chalkBlue(">>> NEW BEST RUNTIME NETWORK"
              + " | " + bnwObj.networkId
              + " | SR: " + bnwObj.successRate.toFixed(2)
              + " | MR: " + bnwObj.matchRate.toFixed(2)
              + " | OAMR: " + bnwObj.overallMatchRate.toFixed(2)
            ));

            printNetworkObj("LOADED NETWORK", bnwObj);

            Object.keys(bnwObj.inputsObj.inputs).forEach(function(type) {
              debug(chalkNetwork("NN INPUTS TYPE"
                + " | " + type
                + " | INPUTS: " + bnwObj.inputsObj.inputs[type].length
              ));
              inputArrays[type] = bnwObj.inputsObj.inputs[type];
            });

          }
          else {

            bnhmObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnwObj = deepcopy(bnhmObj.network);
            bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;
            bnwObj.overallMatchRate = (bnwObj.overallMatchRate !== undefined) ? bnwObj.overallMatchRate : 0;

            console.log(chalkBlue("... UPDATED BEST RUNTIME NETWORK"
              + " | " + bnwObj.networkId
              + " | SR: " + bnwObj.successRate.toFixed(2)
              + " | MR: " + bnwObj.matchRate.toFixed(2)
              + " | OAMR: " + bnwObj.overallMatchRate.toFixed(2)
              // + "\n\n"
            ));

            bnhmObj.networkObj = deepcopy(bnwObj);

            bestNetworkHashMap.set(currentBestNetworkId, bnhmObj);

            printNetworkObj("LOADED NETWORK", bnwObj);
          }

          updateBestNetworkStats(bnwObj);

          callback(null, bnwObj);
        }
        else if (currentBestNetworkId && bestNetworkHashMap.has(currentBestNetworkId)) {

          bnhmObj = bestNetworkHashMap.get(currentBestNetworkId);

          bnwObj = deepcopy(bnhmObj.networkObj);
          bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;
          bnwObj.overallMatchRate = (bnwObj.overallMatchRate !== undefined) ? bnwObj.overallMatchRate : 0;

          console.log(chalkBlue("... UPDATED BEST RUNTIME NETWORK"
            + " | " + bnwObj.networkId
            + " | SR: " + bnwObj.successRate.toFixed(2)
            + " | MR: " + bnwObj.matchRate.toFixed(2)
            + " | OAMR: " + bnwObj.overallMatchRate.toFixed(2)
          ));

          bnhmObj.networkObj = deepcopy(bnwObj);

          bestNetworkHashMap.set(currentBestNetworkId, bnhmObj);

          printNetworkObj("LOADED NETWORK", bnwObj);

          // bestNetworkFolderLoaded = true;
          callback(null, bnwObj);
        }
        else {
          console.log(chalkAlert("??? NO BEST RUNTIME NETWORK | loadBestNeuralNetworkFile"
          ));
          callback(null, null);
        }
      });
    }
  });
}

const runEnableArgs = {};
runEnableArgs.userServerReady = userServerReady;
runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;
// runEnableArgs.categorizedUserHashMapReadyFlag = categorizedUserHashMapReadyFlag;

function runEnable(displayArgs) {
  if (randomNetworkTree && (randomNetworkTree !== undefined)) {
    randomNetworkTree.send({op: "GET_BUSY"});
  }
  else {
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeMessageRxQueueReadyFlag = true;
  }
  runEnableArgs.userServerReady = userServerReady;
  runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
  runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
  runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
  runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;
  // runEnableArgs.categorizedUserHashMapReadyFlag = categorizedUserHashMapReadyFlag;
  const runEnableKeys = Object.keys(runEnableArgs);
  if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }
  runEnableKeys.forEach(function(key) {
    if (displayArgs) { console.log(chalkInfo("runEnable | " + key + ": " + runEnableArgs[key])); }
    if (!runEnableArgs[key]) {
      if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }
      return false;
    }
  });
  if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }
  return true;
}

function updateUserCategoryStats(user, callback) {

  return new Promise(function() {

    let catObj = {};

    catObj.manual = false;
    catObj.auto = false;

    async.parallel({
      category: function(cb) {
        if (user.category) {
          switch (user.category) {
            case "right":
              statsObj.categorized.manual.right += 1;
            break;
            case "left":
              statsObj.categorized.manual.left += 1;
            break;
            case "neutral":
              statsObj.categorized.manual.neutral += 1;
            break;
            case "positive":
              statsObj.categorized.manual.positive += 1;
            break;
            case "negative":
              statsObj.categorized.manual.negative += 1;
            break;
            case "none":
              statsObj.categorized.manual.none += 1;
            break;
            default:
              user.category = false;
              statsObj.categorized.manual.other += 1;
          }
          cb();
        }
        else {
          cb();
        }
      },
      categoryAuto: function(cb) {
        if (user.categoryAuto) {
          switch (user.categoryAuto) {
            case "right":
              statsObj.categorized.auto.right += 1;
            break;
            case "left":
              statsObj.categorized.auto.left += 1;
            break;
            case "neutral":
              statsObj.categorized.auto.neutral += 1;
            break;
            case "positive":
              statsObj.categorized.auto.positive += 1;
            break;
            case "negative":
              statsObj.categorized.auto.negative += 1;
            break;
            case "none":
              statsObj.categorized.auto.none += 1;
            break;
            default:
              user.categoryAuto = false;
              statsObj.categorized.auto.other += 1;
          }
          cb();
        }
        else {
          cb();
        }
      }
    }, function() {
      statsObj.categorized.totalManual = 0;
      statsObj.categorized.totalManual += statsObj.categorized.manual.left;
      statsObj.categorized.totalManual += statsObj.categorized.manual.right;
      statsObj.categorized.totalManual += statsObj.categorized.manual.neutral;
      statsObj.categorized.totalManual += statsObj.categorized.manual.positive;
      statsObj.categorized.totalManual += statsObj.categorized.manual.negative;
      statsObj.categorized.totalAuto = 0;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.left;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.right;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.neutral;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.positive;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.negative;
      statsObj.categorized.total = statsObj.categorized.totalManual + statsObj.categorized.totalAuto;
      callback(null, user);
    });
  });
}

function enableAnalysis(user, languageAnalysis) {
  if (!configuration.enableLanguageAnalysis) { return false; }
  if (configuration.forceLanguageAnalysis) {
    debug(chalkAlert("enableAnalysis: configuration.forceLanguageAnalysis: "
      + configuration.forceLanguageAnalysis
    ));
    return true;
  }
  if (!user.languageAnalyzed) {
    debug(chalkAlert("enableAnalysis: user.languageAnalyzed: "
      + user.languageAnalyzed
    ));
    return true;
  }
  if (user.languageAnalysis.error !== undefined) {
    if ((user.languageAnalysis.error.code === 3)
      || (user.languageAnalysis.error.code === 8)) {
      debug(chalkAlert("enableAnalysis: user.languageAnalysis.error: "
        + user.languageAnalysis.error.code
      ));
      return true;
    }
  }
  if (user.languageAnalyzed && (languageAnalysis.magnitude === 0) && (languageAnalysis.score === 0)) {
    debug(chalkAlert("enableAnalysis: user.languageAnalyzed: "
      + user.languageAnalyzed
    ));
    return true;
  }
  return false;
}

function activateNetwork(obj) {
  if ((randomNetworkTree !== undefined) && randomNetworkTree && randomNetworkTreeReadyFlag) {
    randomNetworkTree.send({op: "ACTIVATE", obj: obj});
  }
}

function startImageQuotaTimeout() {
  setTimeout(function() {
    enableImageAnalysis = true;
    console.log(chalkLog("RE-ENABLE IMAGE ANALYSIS"));
  }, IMAGE_QUOTA_TIMEOUT);
}

function updateHistograms(params, callback) {

  let user = {};
  let histogramsIn = {};

  user = params.user;
  histogramsIn = params.histograms;

  if (!user.histograms || (user.histograms === undefined)) {
    user.histograms = {};
  }
  
  // const inputHistogramTypes = Object.keys(histogramsIn);

  async.each(inputTypes, function(type, cb0) {

    if (user.histograms[type] === undefined) { user.histograms[type] = {}; }
    if (histogramsIn[type] === undefined) { histogramsIn[type] = {}; }

    const inputHistogramTypeItems = Object.keys(histogramsIn[type]);

    async.each(inputHistogramTypeItems, function(item, cb1) {

      if (user.histograms[type][item] === undefined) {
        user.histograms[type][item] = histogramsIn[type][item];
      }
      else if (params.accumulateFlag) {
        user.histograms[type][item] += histogramsIn[type][item];
      }

      debug("user histograms"
        + " | @" + user.screenName
        + " | " + type
        + " | " + item
        + " | USER VAL: " + user.histograms[type][item]
        + " | UPDATE VAL: " + histogramsIn[type][item]
      );

      async.setImmediate(function() {
        cb1();
      });

    }, function (argument) {

      async.setImmediate(function() {
        cb0();
      });

    });
  }, function(err) {

    updateGlobalHistograms({user: user}, function(){
      callback(err, user);
    });

  });
}

function generateAutoCategory(user, callback) {
  async.waterfall([
    function userScreenName(cb) {
      if (user.screenName !== undefined) {
        async.setImmediate(function() {
          cb(null, "@" + user.screenName.toLowerCase());
        });
      }
      else {
        async.setImmediate(function() {
          cb(null, null);
        });
      }
    },
    function userName(text, cb) {
      if (user.name !== undefined) {
        if (text) {
          async.setImmediate(function() {
            cb(null, text + " | " + user.name);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.name);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },
    function userStatusText(text, cb) {
      if ((user.status !== undefined)
        && user.status
        && user.status.text) {
        if (text) {
          async.setImmediate(function() {
            cb(null, text + "\n" + user.status.text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.status.text);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },
    function userRetweetText(text, cb) {
      if ((user.retweeted_status !== undefined)
        && user.retweeted_status
        && user.retweeted_status.text) {
        console.log(chalkTwitter("RT\n" + jsonPrint(user.retweeted_status.text)));
        if (text) {
          async.setImmediate(function() {
            cb(null, text + "\n" + user.retweeted_status.text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.retweeted_status.text);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },
    function userDescriptionText(text, cb) {
      if ((user.description !== undefined) && user.description) {
        if (text) {
          async.setImmediate(function() {
            cb(null, text + "\n" + user.description);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.description);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },
    function userBannerImage(text, cb) {

      if (!user.histograms || (user.histograms === undefined)) { 
        user.markModified("histograms");
        user.histograms = {}; 
        user.histograms.images = {}; 
      }
      else if (user.histograms.images === undefined) { 
        user.histograms.images = {}; 
      }

      if (
        (enableImageAnalysis && !user.bannerImageAnalyzed && user.bannerImageUrl)
        || (enableImageAnalysis && user.bannerImageUrl && (user.bannerImageAnalyzed !== user.bannerImageUrl))
        || (configuration.forceImageAnalysis && user.bannerImageUrl)
      ) {

        twitterImageParser.parseImage(
          user.bannerImageUrl,
          {screenName: user.screenName, category: user.category, updateGlobalHistograms: true},
          function(err, results) {
            if (err) {
              if (err.code === 8) {
                console.log(chalkAlert("PARSE BANNER IMAGE QUOTA ERROR"
                ));
                enableImageAnalysis = false;
                startImageQuotaTimeout();
              }
              else if (err.code === 7) {
                console.log(chalkAlert("PARSE BANNER IMAGE CLOUD VISION API ERROR"
                ));
                enableImageAnalysis = false;
                startImageQuotaTimeout();
              }
              else{
                console.log(chalkError("PARSE BANNER IMAGE ERROR"
                  // + "\nREQ\n" + jsonPrint(results)
                  + " | ERR: " + err
                  + "\nERR\n" + jsonPrint(err)
                ));
              }
              cb(null, text);
            }
            else {

              if (user.bannerImageAnalyzed 
                && user.bannerImageUrl 
                && (user.bannerImageAnalyzed !== user.bannerImageUrl)) {
                console.log(chalk.bold.blue("^^^ BANNER IMAGE UPDATED "
                  + " | @" + user.screenName
                  + "\nTFE | bannerImageAnalyzed: " + user.bannerImageAnalyzed
                  + "\nTFE | bannerImageUrl: " + user.bannerImageUrl
                  + "\nTFE | RESULTS: " + Object.keys(results.images)
                ));
              }
              else {
                console.log(chalk.bold.blue("TFE | +++ BANNER IMAGE ANALYZED"
                  + " | @" + user.screenName
                  + "\nTFE | bannerImageAnalyzed: " + user.bannerImageAnalyzed
                  + "\nTFE | bannerImageUrl: " + user.bannerImageUrl
                  + "\nTFE | RESULTS: " + Object.keys(results.images)
                ));
              }

              user.bannerImageAnalyzed = user.bannerImageUrl;
              user.markModified("bannerImageAnalyzed");

              if (Object.keys(results.images).length > 0) {

                async.each(Object.keys(results.images), function(item, cb0){

                  if (user.histograms.images[item] === undefined) { 
                    user.histograms.images[item] = results.images[item];
                    console.log(chalk.bold.blue("+++ USER IMAGE HISTOGRAM ADD"
                      + " | @" + user.screenName
                      + " | " + item + ": " + results.images[item]
                    ));
                  }
                  else {
                    console.log(chalk.bold.blue("... USER IMAGE HISTOGRAM HIT"
                      + " | @" + user.screenName
                      + " | " + item
                      + " | IN HISTOGRAM: " + user.histograms.images[item]
                      + " | IN BANNER: " + item + ": " + results.images[item]
                    ));
                  }

                  cb0();

                }, function(){

                  cb(null, text);

                });
              }
              else {
                cb(null, text);
              }

            }
          }
        );
      }
      else {
        async.setImmediate(function() {
          cb(null, text);
        });
      }
    }
  ], function (err, text, bannerResults) {
    if (err) {
      console.log(chalkError("*** ERROR generateAutoCategory: " + err));
      callback(err, null);
    }

    if (!text) { text = " "; }

    let parseTextOptions = {};
    parseTextOptions.updateGlobalHistograms = true;

    if (user.category) {
      parseTextOptions.category = user.category;
    }
    else {
      parseTextOptions.category = false;
    }

    twitterTextParser.parseText(text, parseTextOptions, function(err, hist) {

      if (err) {
        console.log(chalkError("*** TWITTER TEXT PARSER ERROR: " + err));
        callback(new Error(err), null);
      }

      updateHistograms({user: user, histograms: hist}, function(err, updatedUser) {

        if (err) {
          console.trace(chalkError("*** UPDATE USER HISTOGRAMS ERROR\n" + jsonPrint(err)));
          console.trace(chalkError("*** UPDATE USER HISTOGRAMS ERROR\nUSER\n" + jsonPrint(user)));
          callback(new Error(err), null);
        }

        updatedUser.inputHits = 0;

        const score = updatedUser.languageAnalysis.sentiment ? updatedUser.languageAnalysis.sentiment.score : 0;
        const mag = updatedUser.languageAnalysis.sentiment ? updatedUser.languageAnalysis.sentiment.magnitude : 0;

        statsObj.normalization.score.min = Math.min(score, statsObj.normalization.score.min);
        statsObj.normalization.score.max = Math.max(score, statsObj.normalization.score.max);
        statsObj.normalization.magnitude.min = Math.min(mag, statsObj.normalization.magnitude.min);
        statsObj.normalization.magnitude.max = Math.max(mag, statsObj.normalization.magnitude.max);
        statsObj.analyzer.total += 1;

        if (enableAnalysis(updatedUser, {magnitude: mag, score: score})) {
          debug(chalkLog(">>>> LANG ANALYZE"
            + " [ ANLd: " + statsObj.analyzer.analyzed
            + " [ SKPd: " + statsObj.analyzer.skipped
            + " | " + updatedUser.nodeId
            + " | @" + updatedUser.screenName
            + " | LAd: " + updatedUser.languageAnalyzed
            + " | LA: S: " + score.toFixed(2)
            + " M: " + mag.toFixed(2)
          ));

          if ((langAnalyzer !== undefined) && langAnalyzer) {
            langAnalyzer.send({op: "LANG_ANALIZE", obj: updatedUser, text: text}, function() {
              statsObj.analyzer.analyzed += 1;
            });
          }
        }
        else {
          statsObj.analyzer.skipped += 1;
          debug(chalkLog("SKIP LANG ANALYZE"
            + " [ ANLd: " + statsObj.analyzer.analyzed
            + " [ SKPd: " + statsObj.analyzer.skipped
            + " | " + updatedUser.nodeId
            + " | @" + updatedUser.screenName
            + " | LAd: " + updatedUser.languageAnalyzed
            + " | LA: S: " + score.toFixed(2)
            + " M: " + mag.toFixed(2)
          ));
        }
        activateNetwork({user: updatedUser, normalization: statsObj.normalization});
        callback(null, updatedUser);
      });

      // });
    });
  });
}

function processUser(threeceeUser, userIn, callback) {

  debug(chalkInfo("PROCESS USER\n" + jsonPrint(userIn)));

  if (userServer === undefined) {
    console.log(chalkError("processUser userServer UNDEFINED"));
    quit("processUser userServer UNDEFINED");
  }

  async.waterfall(
  [
    function findUserInDb(cb) {
      User.findOne({ nodeId: userIn.id_str }).exec(function(err, user) {
        if (err) {
          console.log(chalkError("ERROR DB FIND ONE USER | " + err));
          return(cb(err, user));
        }
        if (!user) {

          userIn.modified = moment();
          userIn.following = true;
          userIn.threeceeFollowing = threeceeUser;

          console.log(chalkInfo("USER DB MISS"
            + " | 3C @" + threeceeUser
            + " | " + userIn.id_str
            + " | @" + userIn.screen_name
          ));

          userServer.convertRawUser({user:userIn}, function(err, user) {
            if (err) {
              console.log(chalkError("TFE | CONVERT USER ERROR"
                + " | " + err
              ));
              cb(err, null);
            }
            else {
              cb(null, user);
            }
          });

        }
        else {

          if ((typeof user.threeceeFollowing === "object") || (typeof user.threeceeFollowing === "boolean")) {
            console.log(chalkAlert(">>> CONVERT TO STRING | USER @" + user.screenName
              + " | threeceeFollowing TYPE: " + typeof user.threeceeFollowing
              + " | threeceeFollowing: " + user.threeceeFollowing
            ));

            let newUser = new User(user);

            newUser.threeceeFollowing = threeceeUser;

            user = new User(newUser);

            console.log(chalkAlert("... CONVERTED STRING | USER @" + user.screenName
              + " | threeceeFollowing TYPE: " + typeof user.threeceeFollowing
              + " | threeceeFollowing: " + user.threeceeFollowing
            ));
          }
          else {
            user.following = true;
            user.threeceeFollowing = threeceeUser;
          }

          if ((user.status !== undefined) && user.status) { user.lastSeen = user.status.created_at; }

          let catObj = {};

          catObj.manual = user.category || false;
          catObj.auto = user.categoryAuto || false;

          // categorizedUserHashMap.set(user.nodeId, catObj);

          if (user.name !== userIn.name) {
            user.name = userIn.name;
          }
          if (user.screenName !== userIn.screen_name) {
            user.screenName = userIn.screen_name;
            user.screenNameLower = userIn.screen_name.toLowerCase();
          }
          if (user.url !== userIn.url) {
            user.url = userIn.url;
          }
          if (user.profileImageUrl !== userIn.profile_image_url) {
            user.profileImageUrl = userIn.profile_image_url;
          }
          if (user.bannerImageUrl !== userIn.profile_banner_url) {
            user.bannerImageAnalyzed = false;
            user.bannerImageUrl = userIn.profile_banner_url;
           }
          if (user.description !== userIn.description) {
            user.description = userIn.description;
          }
          if (
            (user.status !== undefined) 
            && (userIn.status !== undefined) 
            && user.status.id_str 
            && userIn.status.id_str 
            && (user.status.id_str !== userIn.status.id_str)) {
            user.status = userIn.status;
          }
          if ((userIn.followers_count !== undefined) && (user.followersCount !== userIn.followers_count)) {
            user.followersCount = userIn.followers_count;
          }
          if ((userIn.friends_count !== undefined) && (user.friendsCount !== userIn.friends_count)) {
            user.friendsCount = userIn.friends_count;
          }
          if ((userIn.statuses_count !== undefined) && (user.statusesCount !== userIn.statuses_count)) {
            user.statusesCount = userIn.statuses_count;
          }
          cb(null, user);
        }
      });
    },
    function unfollowFriend(user, cb) {
      if (
           ((threeceeUser === "altthreecee01") && twitterUserHashMap.altthreecee00.friends.has(user.nodeId))
        || ((threeceeUser === "altthreecee02") && twitterUserHashMap.altthreecee00.friends.has(user.nodeId))
        || ((threeceeUser === "altthreecee02") && twitterUserHashMap.altthreecee01.friends.has(user.nodeId))
      ) {
        let unfollowTarget;
        if (twitterUserHashMap.altthreecee00.friends.has(user.nodeId)) {
          if (twitterUserHashMap.altthreecee01.friends.has(user.nodeId)) {
            twitterUserHashMap.altthreecee01.friends.delete(user.nodeId);
            unfollowTarget = "altthreecee01";
          }
          if (twitterUserHashMap.altthreecee02.friends.has(user.nodeId)) {
            twitterUserHashMap.altthreecee02.friends.delete(user.nodeId);
            unfollowTarget = "altthreecee02";
          }
          user.following = true;
          user.threeceeFollowing = "altthreecee00";
        }
        else if (twitterUserHashMap.altthreecee01.friends.has(user.nodeId)) {
          if (twitterUserHashMap.altthreecee02.friends.has(user.nodeId)) {
            twitterUserHashMap.altthreecee02.friends.delete(user.nodeId);
            unfollowTarget = "altthreecee02";
          }
          user.following = true;
          user.threeceeFollowing = "altthreecee01";
        }
        console.log(chalkInfo("XXX UNFOLLOW | altthreecee00 OR altthreecee01 FOLLOWING"
          + " | " + user.nodeId
          + " | " + user.screenName.toLowerCase()
          + " | FLWg: " + user.following
          + " | 3CF: " + user.threeceeFollowing
        ));
        tfeChildHashMap[unfollowTarget].child.send({op: "UNFOLLOW", userId: user.nodeId, screenName: user.screenName});
        cb(null, user);
      }
      else {
        user.following = true;
        user.threeceeFollowing = threeceeUser;
        cb(null, user);
      }
    },
    function updateUserCategory(user, cb) {
      updateUserCategoryStats(user, function(err, u) {
        if (err) {
          console.trace(chalkError("ERROR classifyUser | NID: " + user.nodeId
            + "\n" + err
          ));
          cb(err, user);
        }
        else {
          cb(null, u);
        }
      });
    },
    function genAutoCat(user, cb) {
      if (!neuralNetworkInitialized) { return(cb(null, user)); }
      generateAutoCategory(user, function (err, uObj) {
        cb(err, uObj);
      });
    }
  ], function (err, user) {
    if (err) {
      console.log(chalkError("PROCESS USER ERROR: " + err));
      callback(new Error(err), null);
    }
    else {
      callback(null, user);
    }
  });
}

const checkChildrenState = function (checkState, callback) {
  async.every(Object.keys(tfeChildHashMap), function(user, cb) {
    debug("CH ID: " + user + " | " + tfeChildHashMap[user].status);
    const cs = (tfeChildHashMap[user].status === checkState);
    cb(null, cs);
  }, function(err, allCheckState) {
    if (err) {
      console.log(chalkError("*** ERROR: checkChildrenState: " + err));
      if (callback !== undefined) { return callback(err, allCheckState); }
      // return(callback(err, allCheckState));
    }
    debug(chalkAlert("MAIN: " + fsm.getMachineState()
      + " | ALL CHILDREN: CHECKSTATE: " + checkState + " | " + allCheckState
    ));
    if (callback !== undefined) { return callback(null, allCheckState); }
    // return allCheckState;
  });
};

function childSendAll(op, callback) {
  console.log(chalkAlert(">>> CHILD SEND ALL | OP: " + op));
  async.each(Object.keys(tfeChildHashMap), function(threeceeUser, cb) {
    const curChild = tfeChildHashMap[threeceeUser].child;
    if (op === "INIT") {
      const initObj = {
        op: op,
        childId: tfeChildHashMap[threeceeUser].childId,
        threeceeUser: tfeChildHashMap[threeceeUser].threeceeUser,
        twitterConfig: tfeChildHashMap[threeceeUser].twitterConfig
      };
      curChild.send(initObj, function(err) {
        if (err) {
          console.log(chalkError("*** CHILD SEND ALL INIT ERROR"
            + " | @" + threeceeUser
            + " | OP: " + op
            + " | ERR: " + err
          ));
        }
        cb(err);
      });
    }
    else {
      curChild.send({op: op}, function(err) {
        if (err) {
          console.log(chalkError("*** CHILD SEND ALL ERROR"
            + " | @" + threeceeUser
            + " | OP: " + op
            + " | ERR: " + err
          ));
        }
        cb(err);
      });
    }
  }, function(err) {
    if (callback !== undefined) { callback(err); }
  });
}

function reporter(event, oldState, newState) {
  fsmPreviousState = oldState;
  console.log(chalkLog("--------------------------------------------------------\n"
    + "<< FSM >>"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n--------------------------------------------------------"
  ));
}

const processUserQueueEmpty = function() {
  return (processUserQueue.length === 0);
};

let waitFileSaveInterval;

const fsmStates = {
  "RESET":{
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);
    },
    "fsm_resetEnd": "IDLE"
  },
  "IDLE":{
    onEnter: reporter,
    "fsm_init": "INIT"
  },
  "ERROR":{
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);
    },
    "fsm_reset": "RESET"
  },
  "INIT":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        checkChildrenState("INIT", function(err, aci) {
          console.log("ALL CHILDREN INIT: " + aci);
          if (!aci && (event !== "fsm_tick")) { childSendAll("INIT"); }
        });
      }
    },
    fsm_tick: function() {
      checkChildrenState("INIT", function(err, aci) {
        debug("INIT TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN INIT: " + aci
        );
        if (aci && processUserQueueReady && processUserQueueEmpty()) { fsm.fsm_ready(); }
      });
    },
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },
  "READY":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        checkChildrenState("READY", function(err, aci) {
          console.log("ALL CHILDREN READY: " + aci);
          if (!aci && (event !== "fsm_tick")) { childSendAll("READY"); }
        });
      }
    },
    fsm_tick: function() {

      checkChildrenState("READY", function(err, acr) {

        debug("READY TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN READY: " + acr
        );

        if (fetchAllIntervalReady && acr && processUserQueueReady && processUserQueueEmpty()) {
          fetchAllIntervalReady = false;
          fsm.fsm_fetchAllStart();
        }

      });
    },
    "fsm_reset": "RESET",
    "fsm_fetchAllStart": "FETCH_ALL"
  },
  "FETCH_ALL":{
    onEnter: function(event, oldState, newState) {
      // console.log("FETCH_ALL | onEnter");
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        console.log("FETCH_ALL | onEnter | " + event);

        loadBestNeuralNetworkFile(function(err, networkObj) {
          if (err) {
            console.log(chalkError("*** LOAD BEST NETWORK FILE ERROR: " + err));
          }
          // debug("loadBestNeuralNetworkFile networkObj\n" + jsonPrint(networkObj));
          console.log("FETCH_ALL | loadBestNeuralNetworkFile DONE");

          loadMaxInputDropbox(defaultTrainingSetFolder, defaultMaxInputHashmapFile, function() {

            if (randomNetworkTree && (randomNetworkTree !== undefined)) {

              randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap }, function() {
                console.log(chalkBlue("SEND MAX INPUTS HASHMAP"));
                childSendAll("FETCH_USER_START");
                statsObj.fetchCycleStartMoment = moment();
                statsObj.fetchCycleElapsed = 0;
              });

            }
          });
        });
      }
    },
    fsm_tick: function() {
      statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
      checkChildrenState("FETCH_END", function(err, acfe) {
        debug("FETCH_END TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN FETCH_END: " + acfe
        );
        if (acfe && processUserQueueReady && processUserQueueEmpty()) { fsm.fsm_fetchAllEnd(); }
      });
    },
    "fsm_reset": "RESET",
    "fsm_fetchAllEnd": "FETCH_END_ALL"
  },
  "FETCH_END_ALL":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.fetchCycle += 1;
        statsObj.fetchCycleEndMoment = moment();
        statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);

        console.log(chalk.bold.blue("===================================================="));
        console.log(chalk.bold.blue("================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("===================================================="));
        console.log(chalk.bold.blue("FETCH CYCLE:           " + statsObj.fetchCycle));
        console.log(chalk.bold.blue("FETCH CYCLE START:     " + statsObj.fetchCycleStartMoment.format(compactDateTimeFormat)));
        console.log(chalk.bold.blue("FETCH CYCLE END:       " + statsObj.fetchCycleEndMoment.format(compactDateTimeFormat)));
        console.log(chalk.bold.blue("FETCH CYCLE ELAPSED:   " + msToTime(statsObj.fetchCycleElapsed)));
        console.log(chalk.bold.blue("TOTAL USERS FETCHED:   " + statsObj.users.totalFriendsFetched));
        console.log(chalk.bold.blue("TOTAL USERS PROCESSED: " + statsObj.users.totalFriendsProcessed));
        console.log(chalk.bold.blue("BEST NETWORK------------          " 
          + "\n         " + statsObj.bestNetwork.networkId
          + "\n INPUTS: " + statsObj.bestNetwork.numInputs + " | " + statsObj.bestNetwork.inputsId
          + "\n SR:     " + statsObj.bestNetwork.successRate.toFixed(3) + "%"
          + "\n MR:     " + statsObj.bestNetwork.matchRate.toFixed(3) + "%"
          + "\n OAMR:   " + statsObj.bestNetwork.overallMatchRate.toFixed(3) + "%"
        ));
        console.log(chalk.bold.blue("===================================================="));
        console.log(chalk.bold.blue("================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("===================================================="));

        console.log(chalkInfo("... PAUSING FOR 10 SECONDS FOR RNT STAT UPDATE ..."));

        let histogramsSavedFlag = false;

        async.forEach(Object.keys(globalHistograms), function(t, cb){

          const type = t.toLowerCase();

          let histObj = {};

          histObj.histogramsId = hostname + "_" + process.pid + "_" + getTimeStamp() + "_" + type ;
          histObj.meta = {};
          histObj.meta.timeStamp = moment().valueOf();
          histObj.meta.type = type;
          histObj.meta.numEntries = Object.keys(globalHistograms[type]).length;
          histObj.histograms = {};
          histObj.histograms[type] = globalHistograms[type];

          let folder;

          if (configuration.testMode) {
            folder = (hostname === "google") 
            ? defaultHistogramsFolder + "_test/types/" + type 
            : localHistogramsFolder + "_test/types/" + type;
          }
          else {
            folder = (hostname === "google") 
            ? defaultHistogramsFolder + "/types/" + type 
            : localHistogramsFolder + "/types/" + type;
          }

          const file = "histograms_" + type + ".json";
          const sizeInMBs = sizeof(globalHistograms[type])/ONE_MEGABYTE;

          console.log(chalk.bold.blue("... SAVING HISTOGRAM"
            + " | TYPE: " + type
            + " | ID: " + histObj.histogramsId
            + " | ENTRIES: " + Object.keys(histObj.histograms[type]).length
            + " | SIZE: " + sizeInMBs.toFixed(3) + " MB"
            + " | PATH: " + folder + "/" + file
          ));

          if ((sizeof(globalHistograms[type]) > MAX_SAVE_DROPBOX_NORMAL) || configuration.testMode) {

            if (configuration.testMode) {
              if (hostname === "google") {
                folder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms_test/types/" + type;
              }
              else {
                folder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/histograms_test/types/" + type;
              }
            }
            else {
              if (hostname === "google") {
                folder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms/types/" + type;
              }
              else {
                folder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/histograms/types/" + type;
              }
            }

            saveFileQueue.push({folder: folder, file: file, obj: histObj, localFlag: true });

          }
          else {
            saveFileQueue.push({folder: folder, file: file, obj: histObj });
          }

          cb();

        }, function(){
          histogramsSavedFlag = true;
        });

        loadedNetworksFlag = false;

        if (randomNetworkTree && (randomNetworkTree !== undefined)) { randomNetworkTree.send({op: "GET_STATS"}); }

        let slackText = "\n*END FETCH ALL*";
        slackText = slackText + " | " + hostname;
        slackText = slackText + "\nSTART: " + statsObj.startTimeMoment.format(compactDateTimeFormat);
        slackText = slackText + " | RUN: " + msToTime(statsObj.elapsed);
        slackText = slackText + "\nCYC: " + statsObj.fetchCycle;
        slackText = slackText + " | ELPSD: " + msToTime(statsObj.fetchCycleElapsed);
        slackText = slackText + "\nTOT: " + statsObj.users.totalFriendsProcessed;
        slackText = slackText + " | GTOT: " + statsObj.users.grandTotalFriendsProcessed;
        slackText = slackText + "\nIN: " + statsObj.bestNetwork.numInputs;
        slackText = slackText + " | INPUTS ID: " + statsObj.bestNetwork.inputsId;
        slackText = slackText + "\nNN: " + statsObj.bestNetwork.networkId;
        slackText = slackText + "\nOAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(3);
        slackText = slackText + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(3);
        slackText = slackText + " | SR: " + statsObj.bestNetwork.successRate.toFixed(3);

        clearInterval(waitFileSaveInterval);
        slackPostMessage(slackChannel, slackText);

        waitFileSaveInterval = setInterval(function() {

          if (saveFileQueue.length === 0) {

            console.log(chalk.bold.blue("ALL NNs SAVED ..."));

            if (randomNetworkTree && (randomNetworkTree !== undefined)) { 
              randomNetworkTree.send({op: "RESET_STATS"});
            }

            childSendAll("RESET_TWITTER_USER_STATE");

            resetAllTwitterUserState(function() {

              statsObj.users.totalFriendsCount = 0;
              statsObj.users.totalFriendsProcessed = 0;
              statsObj.users.totalFriendsFetched = 0;
              statsObj.users.totalPercentProcessed = 0;
              statsObj.users.totalPercentFetched = 0;
              statsObj.users.classifiedAuto = 0;
              statsObj.users.classified = 0;

              clearInterval(waitFileSaveInterval);

              globalHistograms = {};
              availableNeuralNetHashMap = {};
              maxInputHashMap = {};

              const bnwObj = bestNetworkHashMap.get(statsObj.bestNetwork.networkId);
              
              bestNetworkHashMap.clear();
              bestNetworkHashMap.set(statsObj.bestNetwork.networkId, bnwObj);

              if (configuration.quitOnComplete) {
                quit({source: "QUIT_ON_COMPLETE"});
              }
              else {
                fsm.fsm_init();
              }

            });
          }
          else {
            console.log(chalk.bold.blue("... WAITING FOR NNs TO BE SAVED ..."
              + " | HISTOGRAMS SAVED: " + histogramsSavedFlag
              + " | SAVE Q: " + saveFileQueue.length
            ));
          }
        }, 5000);

      }
    },
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_ready": "READY"
  }
};

fsm = Stately.machine(fsmStates);

function initFetchAllInterval(interval) {

  fetchAllIntervalReady = true;

  console.log(chalkInfo("INIT FETCH ALL INTERVAL | " + msToTime(interval)));

  clearInterval(fetchAllInterval);

  fetchAllInterval = setInterval(function() {

    console.log(chalkInfo("FETCH ALL READY | " + getTimeStamp()));
    fetchAllIntervalReady = true;
    statsObj.fetchAllIntervalStartMoment = moment();

  }, interval);
}

function initFsmTickInterval(interval) {
  console.log(chalkInfo("INIT FSM TICK INTERVAL | " + msToTime(interval)));
  clearInterval(fsmTickInterval);
  fsmTickInterval = setInterval(function() {
    statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

reporter("START", "---", fsm.getMachineState());

inputTypes.forEach(function(type) {
  statsObj.histograms[type] = {};
});

const cla = require("command-line-args");
const numRandomNetworks = { name: "numRandomNetworks", alias: "n", type: Number};
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const userDbCrawl = { name: "userDbCrawl", alias: "C", type: Boolean};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};
const loadNeuralNetworkID = { name: "loadNeuralNetworkID", alias: "N", type: Number };
const targetServer = { name: "targetServer", alias: "t", type: String};
const optionDefinitions = [enableStdin, numRandomNetworks, targetServer, quitOnError, quitOnComplete, loadNeuralNetworkID, userDbCrawl, testMode];
const commandLineConfig = cla(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer === "LOCAL") {
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}

if (commandLineConfig.targetServer === "REMOTE") {
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

process.title = "node_twitterFollowerExplorer";

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
  if (randomNetworkTree && (randomNetworkTree !== undefined)) { randomNetworkTree.kill("SIGINT"); }
});

process.on("message", function(msg) {
  if ((msg === "SIGINT") || (msg === "shutdown")) {
    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    clearInterval(langAnalyzerMessageRxQueueInterval);
    clearInterval(randomNetworkTreeMessageRxQueueInterval);
    clearInterval(statsUpdateInterval);
    setTimeout(function() {
      console.log("QUITTING twitterFollowerExplorer");
      process.exit(0);
    }, 300);
  }
});

function showStats(options) {

  runEnable();

  if ((langAnalyzer !== undefined) && langAnalyzer) {
    langAnalyzer.send({op: "STATS", options: options});
  }

  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));
  }
  else {

    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;

    statsObj.fetchAllIntervalTimeElapsed = moment().diff(statsObj.fetchAllIntervalStartMoment);
    statsObj.fetchAllIntervalRemain = configuration.fetchAllIntervalTime - statsObj.fetchAllIntervalTimeElapsed;
    statsObj.fetchAllIntervalNext = moment(statsObj.fetchAllIntervalStartMoment);
    statsObj.fetchAllIntervalNext.add(configuration.fetchAllIntervalTime, "ms");

    console.log(chalkLog("### FEM S"
      + " | N: " + getTimeStamp()
      + " | SERVER CONNECTED: " + statsObj.serverConnected
      + " | AUTHENTICATED: " + statsObj.userAuthenticated
      + " | READY TXD: " + statsObj.userReadyTransmitted
      + " | READY ACK: " + statsObj.userReadyAck
      + " | E: " + statsObj.elapsed
      + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
      + " | PUQ: " + processUserQueue.length
      + " | FSM: " + fsm.getMachineState()
      + "\nFETCH_ALL START:    " + statsObj.fetchAllIntervalStartMoment.format(compactDateTimeFormat)
      + "\nFETCH_ALL INTERVAL: " + msToTime(configuration.fetchAllIntervalTime)
      + "\nFETCH_ALL NEXT:     " + statsObj.fetchAllIntervalNext.format(compactDateTimeFormat)
      + "\nFETCH_ALL ELAPSED:  " + msToTime(statsObj.fetchAllIntervalTimeElapsed)
      + "\nFETCH_ALL REMAIN:   " + msToTime(statsObj.fetchAllIntervalRemain)
      + "\nFETCH_ALL CYCLES:   " + statsObj.fetchCycle
    ));

    console.log(chalkLog("... RNT S"
      + " | BUSY: " + randomNetworkTreeBusyFlag
      + " | READY: " + randomNetworkTreeReadyFlag
      + " | RAQ: " + randomNetworkTreeActivateQueueSize
    ));

    Object.keys(tfeChildHashMap).forEach(function(user) {
      console.log(chalkLog("... FEC S"
        + " | CHILD " + user + " | FSM: " + tfeChildHashMap[user].status
      ));
    });

  }
}

process.on( "SIGINT", function() {
  quit({source: "SIGINT"});
});

function saveFile (params, callback){

  let fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (params.localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats();
    console.log(chalkAlert("NNT | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj)
    .then(function() {

      console.log(chalkAlert("NNT | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(error){
      console.trace(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX LOCAL JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + error
        + " | ERROR\n" + jsonPrint(error)
      ));
      if (callback !== undefined) { return callback(error); }
    });
  }
  else {

    options.contents = JSON.stringify(params.obj, null, 2);
    options.autorename = params.autorename || false;
    options.mode = params.mode || "overwrite";
    options.path = fullPath;

    const dbFileUpload = function () {

      dropboxClient.filesUpload(options)
      .then(function(){
        debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
        if (callback !== undefined) { return callback(null); }
      })
      .catch(function(error){
        if (error.status === 413){
          console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.error(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.trace(chalkError("NNT | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + error
            + " | ERROR\n" + jsonPrint(error)
          ));
          if (callback !== undefined) { return callback(error); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: DROPBOX_LIST_FOLDER_LIMIT})
      .then(function(response){

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          // + " | CURSOR (trunc): " + response.cursor.substr(-10)
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkInfo("NNT | DROPBOX FILE"
            + " | " + params.folder
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | " + entry.name
          ));

          if (entry.name === params.file) {
            fileExits = true;
          }

          cb();

        }, function(err){
          if (err) {
            console.log(chalkError("NNT | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return(callback(err, null));
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert("NNT | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert("NNT | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError("NNT | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initProcessUserQueueInterval(interval) {

  let mObj = {};
  let tcUser;

  console.log(chalkBlue("TFE | INIT PROCESS USER QUEUE INTERVAL | " + PROCESS_USER_QUEUE_INTERVAL + " MS"));

  clearInterval(processUserQueueInterval);

  processUserQueueInterval = setInterval(function () {

    if (processUserQueueReady && processUserQueue.length > 0) {

      processUserQueueReady = false;
      mObj = processUserQueue.shift();
      tcUser = mObj.threeceeUser;
      twitterUserHashMap[tcUser].friends.add(mObj.friend.id_str);

      processUser(tcUser, mObj.friend, function(err, user) {

        if (err) {
          console.trace("processUser ERROR");
          processUserQueueReady = true;
          return;
        }

        statsObj.users.grandTotalFriendsProcessed += 1;
        statsObj.users.totalFriendsProcessed += 1;
        statsObj.users.totalPercentProcessed = 100*statsObj.users.totalFriendsProcessed/statsObj.users.totalFriendsCount;

        if (statsObj.user[tcUser] === undefined) {
          statsObj.user[tcUser].friendsCount = 1;
          statsObj.user[tcUser].friendsProcessed = 0;
          statsObj.user[tcUser].percentProcessed = 0;
        }

        statsObj.user[tcUser].friendsProcessed += 1;
        statsObj.user[tcUser].percentProcessed = 100*statsObj.user[tcUser].friendsProcessed/statsObj.user[tcUser].friendsCount;

        debug("PROCESSED USER\n" + jsonPrint(user));

        if (configuration.testMode || (statsObj.user[tcUser].friendsProcessed % 50 === 0)) {

          statsObj.user[tcUser].friendsProcessElapsed = moment().diff(statsObj.user[tcUser].friendsProcessStart);

          console.log(chalkBlue("<FRND PRCSSD"
            + " [ Q: " + processUserQueue.length + " ]"
            + " | @" + tcUser
            + " | S: " + statsObj.user[tcUser].friendsProcessStart.format(compactDateTimeFormat)
            + " | E: " + msToTime(statsObj.user[tcUser].friendsProcessElapsed)
            + "\n<FRND PRCSSD | @" + user.screenName
            + " | NAME: " + user.name
            + " | CR: " + moment(user.createdAt).format(compactDateTimeFormat)
            + " | LS: " + moment(user.lastSeen).format(compactDateTimeFormat)
            + " | FLWg: " + user.following
            + " | 3CF: " + user.threeceeFollowing
            + " | FLWRs: " + user.followersCount
            + " | FRNDs: " + user.friendsCount
            + " | Ts: " + user.statusesCount
            + "\n<FRND PRCSSD | TOT PRCSSD: " + statsObj.users.totalFriendsProcessed + "/" + statsObj.users.totalFriendsCount
            + " (" + statsObj.users.totalPercentProcessed.toFixed(2) + "%)"
            + " | USR PRCSSD: " + statsObj.user[tcUser].friendsProcessed + "/" + statsObj.user[tcUser].friendsCount
            + " (" + statsObj.user[tcUser].percentProcessed.toFixed(2) + "%)"
          ));

        }

        user.save()
        .then(function(updatedUser) {
          processUserQueueReady = true;
        })
        .catch(function(err) {
          console.log(chalkError("*** ERROR processUser USER SAVE: @" + user.screenName + " | " + err));
          processUserQueueReady = true;
        });
      });
    }
  }, interval);
}

function initSaveFileQueue(cnf) {
  console.log(chalkBlue("TFE | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));
  clearInterval(saveFileQueueInterval);
  saveFileQueueInterval = setInterval(function () {
    if (!saveFileBusy && saveFileQueue.length > 0) {
      saveFileBusy = true;
      const saveFileObj = saveFileQueue.shift();
      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError("TFE | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("TFE | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });
    }
  }, cnf.saveFileQueueInterval);
}

function sendKeepAlive(userObj, callback) {
  if (statsObj.userAuthenticated && statsObj.serverConnected) {
    debug(chalkAlert("TX KEEPALIVE"
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + userObj.userId
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    callback(null, userObj);
  }
  else {
    console.log(chalkError("!!!! CANNOT TX KEEPALIVE"
      + " | " + userObj.userId
      + " | CONNECTED: " + statsObj.serverConnected
      + " | READY ACK: " + statsObj.userAuthenticated
      + " | " + moment().format(compactDateTimeFormat)
    ));
    callback("ERROR", null);
  }
}

function initKeepalive(interval) {

  clearInterval(socketKeepAliveInterval);

  console.log(chalkConnect("START KEEPALIVE"
    + " | " + getTimeStamp()
    + " | READY ACK: " + statsObj.userAuthenticated
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  userObj.stats = statsObj;

  sendKeepAlive(userObj, function(err, results) {
    if (err) {
      console.log(chalkError("KEEPALIVE ERROR: " + err));
    }
    else if (results) {
      debug(chalkConnect("KEEPALIVE"
        + " | " + moment().format(compactDateTimeFormat)
      ));
    }
  });

  socketKeepAliveInterval = setInterval(function() { // TX KEEPALIVE

    userObj.stats = statsObj;

    sendKeepAlive(userObj, function(err, results) {
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      else if (results) {
        debug(chalkConnect("KEEPALIVE"
          + " | " + moment().format(compactDateTimeFormat)
        ));
      }
    });

  }, interval);
}

let userReadyInterval;

function initUserReadyInterval(interval) {

  console.log(chalkInfo("INIT USER READY INTERVAL"));

  clearInterval(userReadyInterval);

  userReadyInterval = setInterval(function() {

    if (statsObj.serverConnected && !statsObj.userReadyTransmitted && !statsObj.userReadyAck) {

      statsObj.userReadyTransmitted = true;
      userObj.timeStamp = moment().valueOf();

      socket.emit("USER_READY", {userId: userObj.userId, timeStamp: moment().valueOf()});
    }
    else if (statsObj.userReadyTransmitted && !statsObj.userReadyAck) {
      statsObj.userReadyAckWait += 1;
      console.log(chalkAlert("... WAITING FOR USER_READY_ACK ..."));
    }
  }, interval);
}

function initSocket(cnf) {
  if (OFFLINE_MODE) {
    console.log(chalkError("*** OFFLINE MODE *** "));
    return;
  }

  console.log(chalkLog("INIT SOCKET"
    + " | " + cnf.targetServer
    + " | " + jsonPrint(userObj)
  ));

  socket = require("socket.io-client")(cnf.targetServer, { reconnection: true });

  socket.on("connect", function() {

    statsObj.serverConnected = true ;

    console.log(chalkConnect("SOCKET CONNECT | " + socket.id + " ... AUTHENTICATE ..."));

    socket.on("unauthorized", function(err) {
      console.log(chalkError("*** AUTHENTICATION ERROR: ", err.message));
      statsObj.userAuthenticated = false ;
    });

    socket.emit("authentication", { namespace: "util", userId: userObj.userId, password: "0123456789" });

    socket.on("authenticated", function() {

      statsObj.serverConnected = true ;

      console.log("AUTHENTICATED | " + socket.id);

      statsObj.socketId = socket.id;

      console.log(chalkConnect( "CONNECTED TO HOST"
        + " | SERVER: " + cnf.targetServer
        + " | ID: " + socket.id
      ));

      userObj.timeStamp = moment().valueOf();

      console.log(chalkInfo(socket.id
        + " | TX USER_READY"
        + " | " + moment().format(compactDateTimeFormat)
        + " | " + userObj.userId
        + " | " + userObj.url
        + " | " + userObj.screenName
        + " | " + userObj.type
        + " | " + userObj.mode
        + "\nTAGS\n" + jsonPrint(userObj.tags)
      ));

      statsObj.userAuthenticated = true ;

      initKeepalive(cnf.keepaliveInterval);

      initUserReadyInterval(5000);
    });

    socket.on("disconnect", function(reason) {

      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
      statsObj.userReadyTransmitted = false;
      statsObj.userReadyAck = false ;

      console.log(chalkConnect(moment().format(compactDateTimeFormat)
        + " | SOCKET DISCONNECT: " + socket.id
        + " | REASON: " + reason
      ));
    });

  });

  socket.on("reconnect", function(reason) {

    statsObj.serverConnected = true;

    console.log(chalkInfo("RECONNECT"
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + socket.id
      + " | REASON: " + reason
    ));
  });

  socket.on("USER_READY_ACK", function(userObj) {

    statsObj.userReadyAck = true ;
    statsObj.serverConnected = true;

    console.log(chalkInfo("RX USER_READY_ACK MESSAGE"
      + " | " + socket.id
      + " | USER ID: " + userObj.userId
      + " | " + moment().format(compactDateTimeFormat)
    ));
  });

  socket.on("FOLLOW", function(u) {

    statsObj.serverConnected = true;

    console.log(chalkInfo("TFE | >RX CONTROL PANEL FOLLOW"
      + " | " + socket.id
      + " | UID: " + u.userId
      + " | @" + u.screenName
      + " | " + moment().format(compactDateTimeFormat)
    ));

    tfeChildHashMap.altthreecee02.child.send({op: "FOLLOW", user:u});

  });  

  socket.on("UNFOLLOW", function(u) {

    statsObj.serverConnected = true;

    console.log(chalkInfo("TFE | >RX CONTROL PANEL UNFOLLOW"
      + " | " + socket.id
      + " | UID: " + u.userId
      + " | @" + u.screenName
      + " | " + moment().format(compactDateTimeFormat)
    ));

    tfeChildHashMap.altthreecee02.child.send({op: "UNFOLLOW", user:u});

  });  

  socket.on("error", function(error) {
    console.log(chalkError(moment().format(compactDateTimeFormat)
      + " | *** SOCKET ERROR"
      + " | " + socket.id
      + " | " + error
    ));
  });

  socket.on("connect_error", function(err) {
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;
    console.log(chalkError("*** CONNECT ERROR "
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
    ));
  });

  socket.on("reconnect_error", function(err) {

    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;

    console.log(chalkError("*** RECONNECT ERROR "
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
    ));
  });

  socket.on("SESSION_ABORT", function(sessionId) {
    console.log(chalkAlert("@@@@@ RX SESSION_ABORT | " + sessionId));
    if (sessionId === statsObj.socketId) {
      console.log(chalkAlert("***** RX SESSION_ABORT HIT | " + sessionId));
      socket.disconnect();
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
    }
  });

  socket.on("SESSION_EXPIRED", function(sessionId) {
    console.log(chalkAlert("RX SESSION_EXPIRED | " + sessionId));
    if (sessionId === statsObj.socketId) {
      console.log(chalkAlert("***** RX SESSION_EXPIRED HIT | " + sessionId));
      socket.disconnect();
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
    }
  });

  socket.on("DROPBOX_CHANGE", function(response) {
    response.entries.forEach(function(entry) {
      debug(chalkInfo(">R DROPBOX_CHANGE"
        + " | " + entry[".tag"].toUpperCase()
        + " | " + entry.path_lower
        + " | NAME: " + entry.name
      ));
      const entryNameArray = entry.name.split(".");
      if ((entryNameArray[1] !== "json") || (entry.name === bestRuntimeNetworkFileName)) {
        debug(chalkAlert("SKIP: " + entry.path_lower));
        return;
      }
      loadFile(bestNetworkFolder, entry.name, function(err, networkObj) {
        if (err) {
          console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR"
            + " | " + bestNetworkFolder + "/" + entry.name
            + " | " + err
          ));
          return;
        }

        if (networkObj.successRate === undefined) { networkObj.successRate = 0; }
        if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
        if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
        if (networkObj.numInputs === undefined) { networkObj.numInputs = networkObj.network.input; }

        console.log(chalkInfo("+0+ UPDATED NN"
          + " SR: " + networkObj.successRate.toFixed(2) + "%"
          + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
          + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
          + " | CR: " + getTimeStamp(networkObj.createdAt)
          + " | IN: " + networkObj.numInputs
          + " | " + networkObj.networkId
        ));

        const bnhmObj = {
          entry: entry,
          networkObj: networkObj
        };

        bestNetworkHashMap.set(networkObj.networkId, bnhmObj);

        if (!currentBestNetwork
          || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {

          currentBestNetwork = deepcopy(networkObj);
          prevBestNetworkId = bestRuntimeNetworkId;
          bestRuntimeNetworkId = networkObj.networkId;

          updateBestNetworkStats(bnhmObj.networkObj);

          printNetworkObj("BEST NETWORK", currentBestNetwork);

          if (hostname === "google") {
            const fileObj = {
              networkId: bestRuntimeNetworkId,
              successRate: networkObj.successRate,
              matchRate:  networkObj.matchRate,
              overallMatchRate:  networkObj.overallMatchRate
            };
            saveCache.set(
              bestRuntimeNetworkFileName,
              { folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj }
            );
          }
        }
      });
    });
  });

  socket.on("HEARTBEAT", function() {
    statsObj.serverConnected = true;
    statsObj.heartbeatsReceived += 1;
  });

  socket.on("KEEPALIVE_ACK", function(userId) {
    statsObj.serverConnected = true;
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });
}

function initStatsUpdate(callback) {
  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));
  twitterTextParser.getGlobalHistograms(function(hist) {
    saveFile({folder: statsFolder, file: statsFile, obj: statsObj});
  });
  clearInterval(statsUpdateInterval);
  statsUpdateInterval = setInterval(function () {
    statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
    statsObj.timeStamp = moment().format(compactDateTimeFormat);
    twitterTextParser.getGlobalHistograms(function(hist) {
      saveFileQueue.push({folder: statsFolder, file: statsFile, obj: statsObj});
    });
    showStats();
  }, configuration.statsUpdateIntervalTime);
  callback(null);
}

function initTwitterFollowerChild(twitterConfig, callback) {

  const user = twitterConfig.threeceeUser;
  const childId = TFC_CHILD_PREFIX + twitterConfig.threeceeUser;
  console.log(chalkLog("+++ NEW TFE CHILD | TFC ID: " + childId));

  let childEnv = {};
  childEnv.env = {};
  childEnv.env.CHILD_ID = childId;
  childEnv.env.THREECEE_USER = twitterConfig.threeceeUser;
  childEnv.env.DEFAULT_FETCH_COUNT = DEFAULT_FETCH_COUNT;
  childEnv.env.TEST_MODE_TOTAL_FETCH = TEST_MODE_TOTAL_FETCH;
  childEnv.env.TEST_MODE_FETCH_COUNT = TEST_MODE_FETCH_COUNT;
  childEnv.env.TEST_MODE = (configuration.testMode) ? 1 : 0;
  tfeChildHashMap[user] = {};
  tfeChildHashMap[user].childId = childId;
  tfeChildHashMap[user].threeceeUser = user;
  tfeChildHashMap[user].child = {};
  tfeChildHashMap[user].status = "IDLE";
  tfeChildHashMap[user].twitterConfig = {};
  tfeChildHashMap[user].twitterConfig.consumer_key = twitterConfig.CONSUMER_KEY;
  tfeChildHashMap[user].twitterConfig.consumer_secret = twitterConfig.CONSUMER_SECRET;
  tfeChildHashMap[user].twitterConfig.access_token = twitterConfig.TOKEN;
  tfeChildHashMap[user].twitterConfig.access_token_secret = twitterConfig.TOKEN_SECRET;

  console.log(chalkLog("+++ NEW TFE CHILD | childEnv\n" + jsonPrint(childEnv)));
  console.log(chalkLog("+++ NEW TFE CHILD | twitterConfig\n" + jsonPrint(tfeChildHashMap[user].twitterConfig)));
  const tfeChild = cp.fork(`twitterFollowerExplorerChild.js`, childEnv );

  let slackText = "";

  tfeChild.on("message", function(m) {
    debug(chalkAlert("tfeChild RX"
      + " | " + m.op
    ));
    if (m.error) {
      console.log(chalkError("TFC | tfeChild RX ERROR\n" + jsonPrint(m)));
      if (callback !== undefined) {
        return(callback(m.error, null));
      }
      return;
    }
    switch(m.op) {
      case "INIT":
      case "INIT_COMPLETE":
        console.log(chalkInfo("TFC | CHILD INIT COMPLETE | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "INIT";
        checkChildrenState(m.op);
      break;
      case "IDLE":
        console.log(chalkInfo("TFC | CHILD IDLE | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "IDLE";
        checkChildrenState(m.op);
      break;
      case "RESET":
        console.log(chalkInfo("TFC | CHILD RESET | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "RESET";
        checkChildrenState(m.op);
      break;
      case "READY":
        console.log(chalkInfo("TFC | CHILD READY | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "READY";
        checkChildrenState(m.op);
      break;
      case "FETCH":
        console.log(chalkInfo("TFC | CHILD FETCH | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "FETCH";
        checkChildrenState(m.op);
      break;
      case "FETCH_END":
        console.log(chalkInfo("TFC | CHILD FETCH_END | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "FETCH_END";
        checkChildrenState(m.op);
      break;
      case "PAUSE_RATE_LIMIT":
        console.log(chalkInfo("TFC | CHILD PAUSE_RATE_LIMIT | " + m.threeceeUser));
        tfeChildHashMap[m.threeceeUser].status = "PAUSE_RATE_LIMIT";
        checkChildrenState(m.op);
      break;
      case "THREECEE_USER":
        console.log(chalkInfo("TFC | R> THREECEE_USER"
          + " | @" + m.threeceeUser.screenName
          + " | Ts: " + m.threeceeUser.statusesCount
          + " | FRNDs: " + m.threeceeUser.friendsCount
          + " | FLWRs: " + m.threeceeUser.followersCount
        ));
        statsObj.user[m.threeceeUser.screenName.toLowerCase()].statusesCount = m.threeceeUser.statusesCount;
        statsObj.user[m.threeceeUser.screenName.toLowerCase()].friendsCount = m.threeceeUser.friendsCount;
        statsObj.user[m.threeceeUser.screenName.toLowerCase()].followersCount = m.threeceeUser.followersCount;
        statsObj.users.totalFriendsCount = 0;
        Object.keys(statsObj.user).forEach(function(tcUser) {
          statsObj.users.totalFriendsCount += statsObj.user[tcUser].friendsCount;
        });
      break;
      case "FRIENDS_IDS":
        twitterUserHashMap[m.threeceeUser].friends = new Set(m.friendsIds);
        console.log(chalkInfo("TFC | R> FRIENDS_IDS"
          + " | 3C: @" + m.threeceeUser
          + " | " + twitterUserHashMap[m.threeceeUser].friends.size + " FRIENDS"
        ));
      break;
      case "FRIEND_RAW":
        if (configuration.testMode) {
          console.log(chalkInfo("TFC | R> FRIEND"
            + " | FOLLOW: " + m.follow
            + " | 3C: @" + m.threeceeUser
            + " | @" + m.friend.screen_name
          ));
        }
        processUserQueue.unshift(m);
        if (m.follow) {
          slackText = "\n*FOLLOW | 3C @" + m.threeceeUser + " > <http://twitter.com/" + m.friend.screen_name 
          + "|" + " @" + m.friend.screen_name + ">*";
          console.log("TFE | SLACK TEXT: " + slackText);
          slackPostMessage(slackChannel, slackText);
        }
      break;
      case "STATS":
        console.log("TFC | CHILD STATS | "
          + " | " + m.threeceeUser
          + getTimeStamp() + " ___________________________\n"
          + jsonPrint(statsObj, "TFC | STATS "
        ));
        console.log("TFC | CHILD STATS___________________________\n");
      break;
      default:
      console.log(chalkError("TFC | CHILD " + m.threeceeUser + " | UNKNOWN OP: " + m.op));
    }
  });
  tfeChild.on("error", function(err) {
    if (tfeChildHashMap[user]) {
      tfeChildHashMap[user].status = "ERROR";
    }
    console.log(chalkError("*** tfeChildHashMap " + user + " ERROR *** : " + err));
  });
  tfeChild.on("exit", function(err) {
    if (tfeChildHashMap[user]) {
      tfeChildHashMap[user].status = "EXIT";
    }
    console.log(chalkError("*** tfeChildHashMap " + user + " EXIT *** : " + err));
  });
  tfeChild.on("close", function(code) {
    if (tfeChildHashMap[user]) {
      tfeChildHashMap[user].status = "CLOSE";
    }
    console.log(chalkError("*** tfeChildHashMap " + user + " CLOSE *** : " + code));
  });
  tfeChildHashMap[user].child = tfeChild;
  if (callback !== undefined) { callback(null, user); }
}

function initTwitter(threeceeUser, callback) {
  let twitterConfigFile =  threeceeUser + ".json";
  debug(chalkInfo("INIT TWITTER USER @" + threeceeUser + " | " + twitterConfigFile));
  loadFile(configuration.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig) {
    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " 
        + configuration.twitterConfigFolder + "/" + twitterConfigFile
      ));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      return callback(err);
    }
    twitterConfig.threeceeUser = threeceeUser;
    console.log(chalkTwitter("LOADED TWITTER CONFIG"
      + " | @" + threeceeUser
      + " | CONFIG FILE: " + configuration.twitterConfigFolder + "/" + twitterConfigFile
      + "\n" + jsonPrint(twitterConfig)
    ));
    initTwitterFollowerChild(twitterConfig, function(err0, childId) {
      callback(err0, twitterConfig);
    });
  });
}

function initTwitterUsers(callback) {
  if (!configuration.twitterUsers) {
    console.log(chalkWarn("??? NO FEEDS"));
    if (callback !== undefined) {callback(null, null);}
  }
  else {
    console.log(chalkTwitter("TFE | INIT TWITTER USERS"
      + " | FOUND " + configuration.twitterUsers.length + " USERS"
    ));
    async.each(configuration.twitterUsers, function(userScreenName, cb) {
      userScreenName = userScreenName.toLowerCase();
      console.log(chalkTwitter("TFE | INIT TWITTER USER @" + userScreenName));
      twitterUserHashMap[userScreenName] = {};
      twitterUserHashMap[userScreenName].threeceeUser = userScreenName;
      twitterUserHashMap[userScreenName].friends = new Set();
      initTwitter(userScreenName, function(err, twitObj) {
        if (err) {
          console.log(chalkError("INIT TWITTER ERROR: " + err.message));
          if (err.code === 88) {
            return(cb());
          }
          return(cb(err));
        }
        debug("INIT TWITTER twitObj\n" + jsonPrint(twitObj));
        resetTwitterUserState(userScreenName, function() {
          cb();
        });
      });
    }, function(err) {
      statsObj.users.totalFriendsCount = 0;
      statsObj.users.totalFriendsFetched = 0;
      configuration.twitterUsers.forEach(function(tUserScreenName) {
        statsObj.users.totalFriendsFetched += statsObj.user[tUserScreenName].totalFriendsFetched;
        statsObj.users.totalFriendsCount += statsObj.user[tUserScreenName].friendsCount;
        statsObj.users.totalPercentFetched = 100 * statsObj.users.totalFriendsFetched/statsObj.users.totalFriendsCount;
      });
      statsObj.users.grandTotalFriendsFetched += statsObj.users.totalFriendsFetched;
      console.log(chalkTwitterBold("====================================================================="
        + "\n====================================================================="
      ));
      if (callback !== undefined) { callback(err); }
    });
  }
}

function initStdIn() {
  console.log("STDIN ENABLED");
  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", function( key ) {
    switch (key) {
      // case "\u0003":
      //   process.exit();
      // break;
      case "a":
        abortCursor = true;
        console.log(chalkAlert("ABORT: " + abortCursor));
      break;
      case "q":
      case "Q":
        quit({source: "STDIN"});
      break;
      case "s":
        showStats();
      break;
      case "S":
        showStats(true);
      break;
      default:
        console.log(
          "\n" + "q/Q: quit"
          + "\n" + "s: showStats"
          + "\n" + "S: showStats verbose"
          );
    }
  });
}

function initialize(cnf, callback) {
  if (debug.enabled) {
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TFE_PROCESS_NAME || "twitterFollowerExplorer";
  cnf.targetServer = process.env.TFE_UTIL_TARGET_SERVER || "http://127.0.0.1:9997/util" ;
  cnf.forceInitRandomNetworks = process.env.TFE_FORCE_INIT_RANDOM_NETWORKS || DEFAULT_FORCE_INIT_RANDOM_NETWORKS ;
  cnf.histogramParseDominantMin = process.env.TFE_HISTOGRAM_PARSE_DOMINANT_MIN || DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN ;
  cnf.histogramParseTotalMin = process.env.TFE_HISTOGRAM_PARSE_TOTAL_MIN || DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;
  cnf.minSuccessRate = process.env.TFE_MIN_SUCCESS_RATE || DEFAULT_MIN_SUCCESS_RATE ;
  cnf.minMatchRate = process.env.TFE_MIN_MATCH_RATE || DEFAULT_MIN_MATCH_RATE ;
  cnf.numRandomNetworks = process.env.TFE_NUM_RANDOM_NETWORKS || TFE_NUM_RANDOM_NETWORKS ;
  cnf.testMode = (process.env.TFE_TEST_MODE === "true") ? true : cnf.testMode;

  cnf.fetchAllIntervalTime = process.env.TFE_FETCH_ALL_INTERVAL || DEFAULT_FETCH_ALL_INTERVAL;

  cnf.quitOnError = process.env.TFE_QUIT_ON_ERROR || false ;

  if (process.env.TFE_QUIT_ON_COMPLETE === "false") {
    cnf.quitOnComplete = false;
  }
  else if ((process.env.TFE_QUIT_ON_COMPLETE === true) || (process.env.TFE_QUIT_ON_COMPLETE === "true")) {
    cnf.quitOnComplete = true;
  }

  cnf.enableStdin = process.env.TFE_ENABLE_STDIN || true ;
  if (process.env.TFE_USER_DB_CRAWL && (process.env.TFE_USER_DB_CRAWL === "true")) {
    cnf.userDbCrawl = true;
  }

  cnf.enableLanguageAnalysis = process.env.TFE_ENABLE_LANG_ANALYSIS || false ;
  cnf.forceLanguageAnalysis = process.env.TFE_FORCE_LANG_ANALYSIS || false ;
  cnf.forceImageAnalysis = process.env.TFE_FORCE_IMAGE_ANALYSIS || false ;

  console.log(chalkAlert("FORCE LANG ANALYSIS: " + cnf.forceLanguageAnalysis));

  cnf.twitterDefaultUser = process.env.TFE_TWITTER_DEFAULT_USER || TWITTER_DEFAULT_USER ;
  cnf.twitterUsers = process.env.TFE_TWITTER_USERS || [ "altthreecee02", "altthreecee01", "altthreecee00" ] ;
  cnf.statsUpdateIntervalTime = process.env.TFE_STATS_UPDATE_INTERVAL || ONE_MINUTE;
  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";
  cnf.twitterConfigFile = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE || cnf.twitterDefaultUser + ".json";
  cnf.neuralNetworkFile = defaultNeuralNetworkFile;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj) {

    let commandLineArgs;
    let configArgs;

    if (!err) {

      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.TFE_UTIL_TARGET_SERVER !== undefined) {
        console.log("LOADED TFE_UTIL_TARGET_SERVER: " + loadedConfigObj.TFE_UTIL_TARGET_SERVER);
        cnf.targetServer = loadedConfigObj.TFE_UTIL_TARGET_SERVER;
      }

      if (loadedConfigObj.TFE_FORCE_INIT_RANDOM_NETWORKS !== undefined) {
        console.log("LOADED TFE_FORCE_INIT_RANDOM_NETWORKS: " + loadedConfigObj.TFE_FORCE_INIT_RANDOM_NETWORKS);
        cnf.forceInitRandomNetworks = loadedConfigObj.TFE_FORCE_INIT_RANDOM_NETWORKS;
      }

      if (loadedConfigObj.TFE_FETCH_ALL_INTERVAL !== undefined) {
        console.log("LOADED TFE_FETCH_ALL_INTERVAL: " + loadedConfigObj.TFE_FETCH_ALL_INTERVAL);
        cnf.fetchAllIntervalTime = loadedConfigObj.TFE_FETCH_ALL_INTERVAL;
      }

      if (loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE !== undefined) {
        console.log("LOADED TFE_BEST_NN_INCREMENTAL_UPDATE: " + loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE);
        cnf.bestNetworkIncrementalUpdate = loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE;
      }

      if (loadedConfigObj.TFE_TEST_MODE !== undefined) {
        console.log("LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE);
        cnf.testMode = loadedConfigObj.TFE_TEST_MODE;
      }

      if (loadedConfigObj.TFE_QUIT_ON_COMPLETE !== undefined) {
        console.log("LOADED TFE_QUIT_ON_COMPLETE: " + loadedConfigObj.TFE_QUIT_ON_COMPLETE);
        if ((loadedConfigObj.TFE_QUIT_ON_COMPLETE === true) || (loadedConfigObj.TFE_QUIT_ON_COMPLETE === "true")) {
          cnf.quitOnComplete = true;
        }
        if ((loadedConfigObj.TFE_QUIT_ON_COMPLETE === false) || (loadedConfigObj.TFE_QUIT_ON_COMPLETE === "false")) {
          cnf.quitOnComplete = false;
        }
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined) {
        console.log("LOADED TFE_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN);
        cnf.histogramParseDominantMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN !== undefined) {
        console.log("LOADED TFE_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN);
        cnf.histogramParseTotalMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.TFE_MIN_SUCCESS_RATE !== undefined) {
        console.log("LOADED TFE_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_MIN_SUCCESS_RATE);
        cnf.minSuccessRate = loadedConfigObj.TFE_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_MIN_MATCH_RATE !== undefined) {
        console.log("LOADED TFE_MIN_MATCH_RATE: " + loadedConfigObj.TFE_MIN_MATCH_RATE);
        cnf.minMatchRate = loadedConfigObj.TFE_MIN_MATCH_RATE;
      }

      if (loadedConfigObj.TFE_NUM_RANDOM_NETWORKS !== undefined) {
        console.log("LOADED TFE_NUM_RANDOM_NETWORKS: " + loadedConfigObj.TFE_NUM_RANDOM_NETWORKS);
        cnf.numRandomNetworks = loadedConfigObj.TFE_NUM_RANDOM_NETWORKS;
      }

      if (loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS !== undefined) {
        console.log("LOADED TFE_ENABLE_LANG_ANALYSIS: " + loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS);
        cnf.enableLanguageAnalysis = loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_FORCE_LANG_ANALYSIS !== undefined) {
        console.log("LOADED TFE_FORCE_LANG_ANALYSIS: " + loadedConfigObj.TFE_FORCE_LANG_ANALYSIS);
        cnf.forceLanguageAnalysis = loadedConfigObj.TFE_FORCE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_FORCE_IMAGE_ANALYSIS !== undefined) {
        console.log("LOADED TFE_FORCE_IMAGE_ANALYSIS: " + loadedConfigObj.TFE_FORCE_IMAGE_ANALYSIS);
        cnf.forceImageAnalysis = loadedConfigObj.TFE_FORCE_IMAGE_ANALYSIS;
      }

      if (loadedConfigObj.TFE_ENABLE_STDIN !== undefined) {
        console.log("LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.TFE_ENABLE_STDIN;
      }

      if (loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID  !== undefined) {
        console.log("LOADED TFE_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID);
        cnf.loadNeuralNetworkID = loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID;
      }

      if (loadedConfigObj.TFE_USER_DB_CRAWL !== undefined) {
        console.log("LOADED TFE_USER_DB_CRAWL: " + loadedConfigObj.TFE_USER_DB_CRAWL);
        cnf.userDbCrawl = loadedConfigObj.TFE_USER_DB_CRAWL;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER !== undefined) {
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER: "
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER));
        cnf.twitterConfigFolder = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE !== undefined) {
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE: "
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE));
        cnf.twitterConfigFile = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE;
      }

      if (loadedConfigObj.TFE_TWITTER_USERS !== undefined) {
        console.log("LOADED TFE_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TFE_TWITTER_USERS));
        cnf.twitterUsers = loadedConfigObj.TFE_TWITTER_USERS;
      }

      if (loadedConfigObj.TFE_TWITTER_DEFAULT_USER !== undefined) {
        console.log("LOADED TFE_TWITTER_DEFAULT_USER: " + jsonPrint(loadedConfigObj.TFE_TWITTER_DEFAULT_USER));
        cnf.twitterDefaultUser = loadedConfigObj.TFE_TWITTER_DEFAULT_USER;
      }

      if (loadedConfigObj.TFE_KEEPALIVE_INTERVAL !== undefined) {
        console.log("LOADED TFE_KEEPALIVE_INTERVAL: " + loadedConfigObj.TFE_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.TFE_KEEPALIVE_INTERVAL;
      }
      // OVERIDE CONFIG WITH COMMAND LINE ARGS
      commandLineArgs = Object.keys(commandLineConfig);
      commandLineArgs.forEach(function(arg) {
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });
      console.log(chalkLog("USER\n" + jsonPrint(userObj)));
      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg) {
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });
      if (cnf.enableStdin) { initStdIn(); }
      initStatsUpdate(function() {
        loadFile(cnf.twitterConfigFolder, cnf.twitterConfigFile, function(err, tc) {
          if (err) {
            console.log(chalkError("*** TWITTER YAML CONFIG LOAD ERROR"
              + " | " + cnf.twitterConfigFolder + "/" + cnf.twitterConfigFile
              + "\n" + err
            ));
            quit({source: "CONFIG", error: err});
            return;
          }
          cnf.twitterConfig = {};
          cnf.twitterConfig = tc;
          console.log(chalkInfo(getTimeStamp() + " | TWITTER CONFIG FILE "
            + cnf.twitterConfigFolder
            + cnf.twitterConfigFile
          ));
          return(callback(err, cnf));
        });
      });
    }
    else {
      console.log("dropboxConfigFile: " + dropboxConfigFile + "\n" + jsonPrint(err));
      // OVERIDE CONFIG WITH COMMAND LINE ARGS
      commandLineArgs = Object.keys(commandLineConfig);
      commandLineArgs.forEach(function(arg) {
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });
      console.log(chalkLog("USER\n" + jsonPrint(userObj)));
      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg) {
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });
      if (cnf.enableStdin) { initStdIn(); }
      initStatsUpdate(function() {
        return(callback(err, cnf));
      });
     }
  });
}

function saveNetworkHashMap(params, callback) {

  const folder = (params.folder === undefined) ? bestNetworkFolder : params.folder;

  const nnIds = bestNetworkHashMap.keys();

  console.log(chalkNetwork("UPDATING NNs IN FOLDER " + folder));

  async.eachSeries(nnIds, function(nnId, cb0) {

    const networkObj = bestNetworkHashMap.get(nnId).networkObj;

    console.log(chalkNetwork("SAVING NN"
      + " | " + networkObj.numInputs + " IN"
      + " | SR: " + networkObj.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
      + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
      + " | " + networkObj.networkId
      + " | DST: " + folder + "/" + networkObj.networkId + ".json"
    ));

    const file = nnId + ".json";

    if (params.saveImmediate) {
      saveFileQueue.push({folder: folder, file: file, obj: networkObj });
      console.log(chalkNetwork("SAVING NN (Q)"
        + " | " + networkObj.networkId
      ));
      cb0();
    }
    else {
      saveCache.set(file, {folder: folder, file: file, obj: networkObj });
      console.log(chalkNetwork("SAVING NN ($)"
        + " | " + networkObj.networkId
      ));
      cb0();
    }

    // async.whilst(

    //   function() {
    //     return (
    //       (params.saveImmediate && (saveFileQueue.length < 10)) 
    //       || (!params.saveImmediate && (saveCache.getStats().keys < 10))
    //     );
    //   },

    //   function(cb1) {

    //     const file = nnId + ".json";

    //     setTimeout(function(){

    //       if (params.saveImmediate) {
    //         saveFileQueue.push({folder: folder, file: file, obj: networkObj });
    //         console.log(chalkNetwork("SAVING NN (Q)"
    //           + " | " + networkObj.networkId
    //         ));
    //         cb1();
    //       }
    //       else {
    //         saveCache.set(file, {folder: folder, file: file, obj: networkObj });
    //         console.log(chalkNetwork("SAVING NN ($)"
    //           + " | " + networkObj.networkId
    //         ));
    //         cb1();
    //       }

    //     }, 1000);

    // }, function(err) {
    //   cb0();
    // });


  }, function(err) {
    if (callback !== undefined) { callback(err); }
  });
}

function updateNetworkStats(params, callback) {

  // updateNetworkStatsReady = false;

  const updateOverallMatchRate = 
    (params.updateOverallMatchRate !== undefined) ? params.updateOverallMatchRate : false;

  const updateDb = (params.updateDb !== undefined) ? params.updateDb : false;

  const nnIds = Object.keys(params.networkStatsObj);

  async.eachSeries(nnIds, function(nnId, cb) {

    if (bestNetworkHashMap.has(nnId)) {

      const bnhmObj = bestNetworkHashMap.get(nnId);

      bnhmObj.networkObj.matchRate = params.networkStatsObj[nnId].matchRate;
      bnhmObj.networkObj.overallMatchRate = (updateOverallMatchRate) ? params.networkStatsObj[nnId].matchRate 
      : params.networkStatsObj[nnId].overallMatchRate;

      bestNetworkHashMap.set(nnId, bnhmObj);

      // const newNeuralNetwork = new NeuralNetwork(bnhmObj.networkObj)
      // .save()
      // .catch(function(err){
      //   console.log(chalkError("NNT | *** ERROR SAVE NN TO DB" 
      //     + " | NID: " + bnhmObj.networkObj.networkId
      //     + " | " + err.message
      //   ));
      // });

      NeuralNetwork.findOne({ networkId: bnhmObj.networkObj.networkId }, function(err, nnDb){
        if (err) {
          console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR"
            + " | " + bnhmObj.networkObj.networkId 
            + " | " + err
          ));
        }
        else if (nnDb) {
          nnDb.matchRate = bnhmObj.networkObj.matchRate;
          nnDb.overallMatchRate = bnhmObj.networkObj.overallMatchRate;
          nnDb.markModified("overallMatchRate");
          nnDb.save()
          .catch(function(err){
            console.log(chalkError("NNT | *** ERROR SAVE NN TO DB" 
              + " | NID: " + nnDb.networkId
              + " | " + err.message
            ));
          });
        }
        else {
          let newNnDb = new NeuralNetwork(bnhmObj.networkObj);
          newNnDb.markModified("overallMatchRate");
          newNnDb.save()
          .catch(function(err){
            console.log(chalkError("NNT | *** ERROR SAVE NN TO DB" 
              + " | NID: " + bnhmObj.networkObj.networkId
              + " | " + err.message
            ));
          });
        }
      });

      console.log(chalkNetwork("... UPDATED NN MATCHRATE + OVERALL MATCHRATE"
        + " | OAMR: " + bnhmObj.networkObj.overallMatchRate.toFixed(2) + "%"
        + " | MR: " + bnhmObj.networkObj.matchRate.toFixed(2) + "%"
        + " | SR: " + bnhmObj.networkObj.successRate.toFixed(2) + "%"
        + " | " + bnhmObj.networkObj.networkId
      ));

      cb();
    }
    else {
      console.log(chalkAlert("??? NETWORK NOT IN BEST NETWORK HASHMAP ???"
        + " | " + nnId
      ));
      cb();
    }
  }, function(err) {

    saveNetworkHashMap({folder: bestNetworkFolder, saveImmediate: params.saveImmediate, updateDb: params.updateDb}, function() {

      // updateNetworkStatsReady = true;

      if (callback !== undefined) { callback(err); }
    });
  });
}

function initRandomNetworkTreeMessageRxQueueInterval(interval, callback) {
  randomNetworkTreeMessageRxQueueReadyFlag = true;
  console.log(chalkInfo("INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));
  randomNetworkTreeMessageRxQueueInterval = setInterval(function () {
    if (randomNetworkTreeMessageRxQueueReadyFlag && (randomNetworkTreeMessageRxQueue.length > 0)) {
      randomNetworkTreeMessageRxQueueReadyFlag = false;
      let m = randomNetworkTreeMessageRxQueue.shift();
      let user = {};
      let bnhmObj = {};
      let prevHmObj = {};
      let fileObj = {};
      let file;
      switch (m.op) {
        case "IDLE":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          randomNetworkTreeBusyFlag = false;
          runEnable();
          console.log(chalkInfo("... RNT IDLE ..."));
        break;
        case "STATS":
          console.log(chalkInfo(getTimeStamp() + " | RNT_STATS"
            + "\n" + jsonPrint(Object.keys(m.statsObj))
          ));
          updateNetworkStats(
            {
              networkStatsObj: m.statsObj.loadedNetworks, 
              saveImmediate: true, 
              updateDb: true, 
              updateOverallMatchRate: true
            }, 
            function() {
              randomNetworkTreeMessageRxQueueReadyFlag = true;
            }
          );
        break;
        case "NETWORK_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("... RNT NETWORK_READY ..."));
          runEnable();
        break;
        case "NETWORK_BUSY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          randomNetworkTreeBusyFlag = "NETWORK_BUSY";
          debug(chalkInfo("... RNT NETWORK_BUSY ..."));
        break;
        case "QUEUE_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q READY"));
          runEnable();
        break;
        case "QUEUE_EMPTY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q EMPTY"));
          runEnable();
        break;
        case "QUEUE_FULL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          randomNetworkTreeReadyFlag = false;
          randomNetworkTreeBusyFlag = "QUEUE_FULL";
          console.log(chalkError("!!! RNT Q FULL"));
        break;
        case "RNT_TEST_PASS":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          console.log(chalkTwitter(getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
          runEnable();
        break;
        case "RNT_TEST_FAIL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          console.log(chalkAlert(getTimeStamp() + " | RNT_TEST_FAIL"));
          quit({source: "RNT", error: "RNT_TEST_FAIL"});
        break;
        case "NETWORK_OUTPUT":

          randomNetworkTreeActivateQueueSize = m.queue;

          debug(chalkAlert("RNT NETWORK_OUTPUT\n" + jsonPrint(m.output)));
          debug(chalkAlert("RNT NETWORK_OUTPUT | " + m.bestNetwork.networkId));

          bestRuntimeNetworkId = m.bestNetwork.networkId;

          if (bestNetworkHashMap.has(bestRuntimeNetworkId)) {

            bnhmObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnhmObj.networkObj.matchRate = m.bestNetwork.matchRate;
            bnhmObj.networkObj.overallMatchRate = m.bestNetwork.overallMatchRate;
            bnhmObj.networkObj.successRate = m.bestNetwork.successRate;

            currentBestNetwork = deepcopy(bnhmObj.networkObj);
            currentBestNetwork.matchRate = m.bestNetwork.matchRate;
            currentBestNetwork.overallMatchRate = m.bestNetwork.overallMatchRate;
            currentBestNetwork.successRate = m.bestNetwork.successRate;

            updateBestNetworkStats(bnhmObj.networkObj);

            bestNetworkHashMap.set(bestRuntimeNetworkId, bnhmObj);

            if ((hostname === "google") 
              && (prevBestNetworkId !== bestRuntimeNetworkId) 
              && configuration.bestNetworkIncrementalUpdate) 
            {

              prevBestNetworkId = bestRuntimeNetworkId;

              console.log(chalkNetwork("... SAVING NEW BEST NETWORK"
                + " | " + currentBestNetwork.networkId
                + " | SR: " + currentBestNetwork.successRate.toFixed(2)
                + " | MR: " + currentBestNetwork.matchRate.toFixed(2)
                + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2)
              ));

              fileObj = {
                networkId: bestRuntimeNetworkId,
                successRate: m.bestNetwork.successRate,
                matchRate:  m.bestNetwork.matchRate,
                overallMatchRate:  m.bestNetwork.overallMatchRate,
                updatedAt: moment()
              };

              file = bestRuntimeNetworkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: currentBestNetwork });
              saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj });
            }

            debug(chalkAlert("NETWORK_OUTPUT"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + m.bestNetwork.networkId
              + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
              + " | MR: " + m.bestNetwork.matchRate.toFixed(2) + "%"
              + " | OAMR: " + m.bestNetwork.overallMatchRate.toFixed(2) + "%"
              + " | @" + m.user.screenName
              + " | C: " + m.user.category
              + " | CA: " + m.categoryAuto
            ));

            user = {};
            user = deepcopy(m.user);
            user.category = m.category;
            user.categoryAuto = m.categoryAuto;
            userDbUpdateQueue.push(user);
          }
          else {
            console.log(chalkError("*** ERROR:  NETWORK_OUTPUT | BEST NN NOT IN HASHMAP???"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + bestRuntimeNetworkId
              + " | " + m.bestNetwork.networkId
              + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
              + " | MR: " + m.bestNetwork.matchRate.toFixed(2) + "%"
              + " | OAMR: " + m.bestNetwork.overallMatchRate.toFixed(2) + "%"
              + " | @" + m.user.screenName
              + " | C: " + m.user.category
              + " | CA: " + m.categoryAuto
            ));
          }
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          runEnable();
        break;
        case "BEST_MATCH_RATE":
          debug(chalkAlert("\n================================================================================================\n"
            + "*** RNT_BEST_MATCH_RATE"
            + " | " + m.networkId
            + " | IN ID: " + m.inputsId
            + " | " + m.numInputs + " IN"
            + "\n*** SR: " + m.successRate.toFixed(2) + "%"
            + " | MR: " + m.matchRate.toFixed(2) + "%"
            + " | OAMR: " + m.overallMatchRate.toFixed(2) + "%"
            + "\n*** PREV: " + m.previousBestNetworkId
            + " | PMR: " + m.previousBestMatchRate.toFixed(2) + "%"
            + "\n================================================================================================\n"
          ));
          if (bestNetworkHashMap.has(m.networkId)) {

            bnhmObj = bestNetworkHashMap.get(m.networkId);
            bnhmObj.networkObj.matchRate = m.matchRate;
            bnhmObj.networkObj.overallMatchRate = m.overallMatchRate;

            currentBestNetwork = deepcopy(bnhmObj.networkObj);
            currentBestNetwork.matchRate = m.matchRate;
            currentBestNetwork.overallMatchRate = m.overallMatchRate;

            bestNetworkHashMap.set(m.networkId, bnhmObj);

            if ((hostname === "google") && (prevBestNetworkId !== m.networkId)) {

              prevBestNetworkId = m.networkId;
              console.log(chalkBlue("... SAVING NEW BEST NETWORK"
                + " | " + currentBestNetwork.networkId
                + " | MR: " + currentBestNetwork.matchRate.toFixed(2)
                + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2)
              ));

              fileObj = {
                networkId: currentBestNetwork.networkId,
                successRate: currentBestNetwork.successRate,
                matchRate:  currentBestNetwork.matchRate,
                overallMatchRate:  currentBestNetwork.overallMatchRate
              };

              file = currentBestNetwork.networkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: currentBestNetwork });
              saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj});
            }
          }
          else {
            console.log(chalkError(getTimeStamp() + "??? | RNT_BEST_MATCH_RATE | NETWORK NOT IN BEST NETWORK HASHMAP?"
              + " | " + m.networkId
              + " | MR: " + m.matchRate.toFixed(2)
              + " | OAMR: " + m.overallMatchRate.toFixed(2)
            ));
          }
          if (m.previousBestNetworkId && bestNetworkHashMap.has(m.previousBestNetworkId)) {

            prevHmObj = bestNetworkHashMap.get(m.previousBestNetworkId);
            prevHmObj.networkObj.matchRate = m.previousBestMatchRate;

            bestNetworkHashMap.set(m.previousBestNetworkId, prevHmObj);

            if (hostname === "google") {

              console.log(chalkBlue("... SAVING PREV BEST NETWORK"
                + " | MR: " + m.previousBestMatchRate.toFixed(2) + "%"
                + " | " + m.previousBestNetworkId + ".json"
              ));

              file = m.previousBestNetworkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: prevHmObj.networkObj });
            }
          }
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          runEnable();
        break;
        default:
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          console.log(chalkError("*** UNKNOWN RNT OP | " + m.op));
      }
    }
  }, interval);
  if (callback !== undefined) { callback(); }
}

function initLangAnalyzerMessageRxQueueInterval(interval, callback) {
  langAnalyzerMessageRxQueueReadyFlag = true;
  console.log(chalkInfo("INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));
  let langEntityKeys = [];
  langAnalyzerMessageRxQueueInterval = setInterval(function () {
    if (langAnalyzerMessageRxQueueReadyFlag && (langAnalyzerMessageRxQueue.length > 0)) {
      langAnalyzerMessageRxQueueReadyFlag = false;
      let m = langAnalyzerMessageRxQueue.shift();
      langEntityKeys.length = 0;
      switch (m.op) {
        case "LANG_RESULTS":
          statsObj.numLangAnalyzed += 1;
          if (m.results.entities !== undefined) {
            langEntityKeys = Object.keys(m.results.entities);
          }
          debug(chalkLog("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length
            + " | STATS: " + statsObj.analyzer.analyzed + " ANLZD"
            + " " + statsObj.analyzer.skipped + " SKP"
            + " " + statsObj.analyzer.total + " TOT ]"
            + " | OP: " + m.op
            + " | NID: " + m.obj.nodeId
            + " | SN: " + m.obj.screenName
            + " | N: " + m.obj.name
          ));
          m.obj.languageAnalyzed = true;
          if (m.error) {
            m.obj.languageAnalysis = {err: m.error};
            if (m.error.code === 8) { // LANGUAGE QUOTA; will be automatically retried
              console.log(chalkAlert("*** LANG QUOTA ERROR ... RETRY"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function() {
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }
            else if (m.error.code === 3) { // LANGUAGE unsupported
              console.log(chalkLog("... LANG ERROR ... UNSUPPORTED LANG"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
            }
            else {
              console.log(chalkError("*** LANG ERROR"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function() {
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }
            userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true }, function(err, updatedUserObj) {
              if (err) {
                console.log(chalkError("ERROR DB UPDATE USER languageAnalysis0"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                if (statsObj.numLangAnalyzed % 50 === 0) {
                  console.log(chalkLog("UPDATE LANG ERR | USER>DB"
                    + " | " + updatedUserObj.nodeId
                    + " | C: " + updatedUserObj.category
                    + " | CA: " + updatedUserObj.categoryAuto
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | FLWg: " + updatedUserObj.following
                    + " | 3CF: " + updatedUserObj.threeceeFollowing
                    + " | LA: " + updatedUserObj.languageAnalyzed
                  ));
                }
              }
              langAnalyzerMessageRxQueueReadyFlag = true;
            });
          }
          else if (langEntityKeys.length > 0) {
            debug(chalkLog("LANG ENTS: " + langEntityKeys.length));
            async.each(langEntityKeys, function(entityKey, cb) {
              if (!entityKey.includes(".")) {
                async.setImmediate(function() {
                  cb();
                });
              }
              else {
                const newKey = entityKey.replace(/\./g, "");
                const oldValue = m.results.entities[entityKey];
                m.results.entities[newKey] = oldValue;
                delete(m.results.entities[entityKey]);
                debug(chalkAlert("REPLACE KEY"
                  + " | " + entityKey
                  + " | " + newKey
                  + "\nOLD\n" + jsonPrint(oldValue)
                  + "\nENTITIES\n" + jsonPrint(m.results.entities)
                ));
                async.setImmediate(function() {
                  cb();
                });
              }
            }, function() {
              m.obj.languageAnalysis = m.results;
              m.obj.languageAnalyzed = true;
              statsObj.normalization.score.min = Math.min(m.results.sentiment.score, statsObj.normalization.score.min);
              statsObj.normalization.score.max = Math.max(m.results.sentiment.score, statsObj.normalization.score.max);
              statsObj.normalization.magnitude.min = Math.min(m.results.sentiment.magnitude, statsObj.normalization.magnitude.min);
              statsObj.normalization.magnitude.max = Math.max(m.results.sentiment.magnitude, statsObj.normalization.magnitude.max);
              userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj) {
                if (err) {
                  console.log(chalkError("ERROR DB UPDATE USER languageAnalysis1"
                    + "\n" + err
                    + "\n" + jsonPrint(m.obj)
                  ));
                }
                else {
                  if (statsObj.numLangAnalyzed % 50 === 0) {
                    console.log(chalkLog("UPDATE LANG ANLZD"
                      + " | LA ENTS: " + langEntityKeys.length
                      + " | USER>DB"
                      + " | C: " + updatedUserObj.category
                      + " | CA: " + updatedUserObj.categoryAuto
                      + " | @" + updatedUserObj.screenName
                      + " | " + updatedUserObj.name
                      + " | Ts: " + updatedUserObj.statusesCount
                      + " | FLs: " + updatedUserObj.followersCount
                      + " | FRs: " + updatedUserObj.friendsCount
                      + " | FLWg: " + updatedUserObj.following
                      + " | 3CF: " + updatedUserObj.threeceeFollowing
                      + " | LA: " + updatedUserObj.languageAnalyzed
                      + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                      + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                    ));
                  }
                }
                langAnalyzerMessageRxQueueReadyFlag = true;
              });
            });
          }
          else {
            debug(chalkLog("LANG ENTS: " + langEntityKeys.length));
            m.obj.languageAnalysis = m.results;
            m.obj.languageAnalyzed = true;
            statsObj.normalization.score.min = Math.min(m.results.sentiment.score, statsObj.normalization.score.min);
            statsObj.normalization.score.max = Math.max(m.results.sentiment.score, statsObj.normalization.score.max);
            statsObj.normalization.magnitude.min = Math.min(m.results.sentiment.magnitude, statsObj.normalization.magnitude.min);
            statsObj.normalization.magnitude.max = Math.max(m.results.sentiment.magnitude, statsObj.normalization.magnitude.max);
            userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj) {
              if (err) {
                console.log(chalkError("ERROR DB UPDATE USER languageAnalysis2"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                if (statsObj.numLangAnalyzed % 50 === 0) {
                  console.log(chalkLog("UPDATE LANG ANLZD"
                    + " | LA ENTS: " + langEntityKeys.length
                    + " | USER>DB"
                    + " | C: " + updatedUserObj.category
                    + " | CA: " + updatedUserObj.categoryAuto
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | FLWg: " + updatedUserObj.following
                    + " | 3CF: " + updatedUserObj.threeceeFollowing
                    + " | LA: " + updatedUserObj.languageAnalyzed
                    + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                    + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                  ));
                }
              }
              langAnalyzerMessageRxQueueReadyFlag = true;
            });
          }
        break;
        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisBusyFlag = true;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;
        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisBusyFlag = false;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;
        default:
          console.log(chalkError("??? UNKNOWN LANG_ANALIZE OP: " + m.op
          ));
          langAnalyzerMessageRxQueueReadyFlag = true;
      }
    }
  }, interval);
  if (callback !== undefined) { callback(); }
}

function initUserDbUpdateQueueInterval(interval) {
  console.log(chalkBlue("INIT USER DB UPDATE QUEUE INTERVAL: " + interval));
  clearInterval(userDbUpdateQueueInterval);
  userDbUpdateQueueInterval = setInterval(function userDbUpdateQueueInterval() {
    if (userDbUpdateQueueReadyFlag && (userDbUpdateQueue.length > 0)) {
      userDbUpdateQueueReadyFlag = false;
      let user = userDbUpdateQueue.shift();
      userServer.findOneUser(user, {noInc: true, updateCountHistory: true}, function updateUserComplete(err, updatedUserObj) {
        userDbUpdateQueueReadyFlag = true;
        if (err) {
          console.trace(chalkError("ERROR DB UPDATE USER - updateUserDb"
            + "\n" + err
            + "\n" + jsonPrint(user)
          ));
          return;
        }
        debug(chalkInfo("US UPD<"
          + " | " + updatedUserObj.nodeId
          + " | TW: " + updatedUserObj.isTwitterUser
          + " | C: " + updatedUserObj.category
          + " | CA: " + updatedUserObj.categoryAuto
          + " | @" + updatedUserObj.screenName
          + " | Ts: " + updatedUserObj.statusesCount
          + " | FLWRs: " + updatedUserObj.followersCount
          + " | FRNDs: " + updatedUserObj.friendsCount
          + " | LAd: " + updatedUserObj.languageAnalyzed
        ));
      });
    }
  }, interval);
}

function initRandomNetworkTree(callback) {
  console.log(chalkBlue("INIT RANDOM NETWORK TREE CHILD PROCESS"));
  randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`);
  randomNetworkTree.on("message", function(m) {
    switch (m.op) {
      case "IDLE":
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
        debug(chalkAlert("<== RNT RX"
          + " [" + randomNetworkTreeMessageRxQueue.length + "]"
          + " | " + m.op
        ));
      break;
      case "BUSY":
        randomNetworkTreeReadyFlag = false;
        randomNetworkTreeBusyFlag = m.cause;
        debug(chalkAlert("<== RNT RX BUSY"
          + " [" + randomNetworkTreeMessageRxQueue.length + "]"
          + " | " + m.op
          + " | " + m.cause
        ));
      break;
      default:
        randomNetworkTreeMessageRxQueue.push(m);
        debug(chalkAlert("<== RNT RX"
          + " [" + randomNetworkTreeMessageRxQueue.length + "]"
          + " | " + m.op
        ));
    }
  });
  randomNetworkTree.on("error", function(err) {
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeActivateQueueSize = 0;
    randomNetworkTree = null;
    console.log(chalkError("*** randomNetworkTree ERROR *** : " + err));
    console.log(chalkError("*** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "RNT", error: err }); }
  });

  randomNetworkTree.on("exit", function(err) {
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeActivateQueueSize = 0;
    randomNetworkTree = null;
    console.log(chalkError("*** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "RNT", error: err }); }
  });

  randomNetworkTree.on("close", function(code) {
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeActivateQueueSize = 0;
    randomNetworkTree = null;
    console.log(chalkError("*** randomNetworkTree CLOSE *** | " + code));
    if (!quitFlag) { quit({source: "RNT", code: code }); }
  });

  randomNetworkTree.send({ op: "INIT", interval: RANDOM_NETWORK_TREE_INTERVAL }, function() {
    if (callback !== undefined) { callback(); }
  });
}

function initLangAnalyzer(callback) {
  console.log(chalkInfo("INIT LANGUAGE ANALYZER CHILD PROCESS"));
  langAnalyzer = cp.fork(`languageAnalyzerChild.js`);
  langAnalyzer.on("message", function(m) {
    debug(chalkLog("<== LA RX"
      + " [" + langAnalyzerMessageRxQueue.length + "]"
      + " | " + m.op
    ));
    if (m.op === "LANG_TEST_FAIL") {
      console.log(chalkAlert(getTimeStamp() + " | LANG_TEST_FAIL"));
      if (m.err.code ===  8) {
        console.log(chalkAlert("LANG_TEST_FAIL"
          + " | LANGUAGE QUOTA"
          + " | " + m.err
        ));
        languageAnalysisBusyFlag = false;
      }
      else if (m.err.code ===  7) {
        console.log(chalkAlert("LANG_TEST_FAIL"
          + " | PERMISSION DENIED"
          + "\n" + m.err.details
        ));
        languageAnalysisBusyFlag = false;
      }
      else {
        console.log(chalkAlert("LANG_TEST_FAIL"
          + "\n" + m.err
        ));
        languageAnalysisBusyFlag = false;
        if (configuration.quitOnError) { quit("LANG_TEST_FAIL"); }
      }
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisBusyFlag = false;
      console.log(chalkTwitter(getTimeStamp() + " | LANG_TEST_PASS | LANG ANAL BUSY: " + languageAnalysisBusyFlag));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisBusyFlag = true;
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisBusyFlag = false;
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      languageAnalysisBusyFlag = false;
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisBusyFlag = false;
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
      languageAnalysisBusyFlag = true;
      langAnalyzerMessageRxQueue.push(m);
    }
  });
  langAnalyzer.on("error", function(err) {
    console.log(chalkError("*** langAnalyzer ERROR ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "LA", error: err }); }
  });
  langAnalyzer.on("exit", function(err) {
    console.log(chalkError("*** langAnalyzer EXIT ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "LA", error: err }); }
  });
  langAnalyzer.on("close", function(code) {
    console.log(chalkError("*** langAnalyzer CLOSE *** | " + code));
    if (!quitFlag) { quit({source: "LA", code: code }); }
  });
  langAnalyzer.send({ op: "INIT", interval: LANGUAGE_ANALYZE_INTERVAL }, function() {
    if (callback !== undefined) { callback(); }
  });
}

initialize(configuration, function(err, cnf) {
  if (err) {
    console.log(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      console.log("err.status: " + err.status);
      quit();
    }
  }

  configuration = deepcopy(cnf);

  console.log(chalkTwitter(configuration.processName
    + " STARTED " + getTimeStamp()
  ));

  initSaveFileQueue(cnf);

  if (configuration.testMode) {
    configuration.fetchCount = TEST_MODE_FETCH_COUNT;
    bestNetworkFolder = "/config/utility/" + hostname + "/test/neuralNetworks/best";
    localBestNetworkFolder = "/config/utility/" + hostname + "/test/neuralNetworks/local";
    console.log(chalkLog("GLOBAL BEST NETWORK FOLDER: " + bestNetworkFolder));
    console.log(chalkLog("LOCAL BEST NETWORK FOLDER:  " + localBestNetworkFolder));
  }
  if (configuration.loadNeuralNetworkID) {
    configuration.neuralNetworkFile = "neuralNetwork_" + configuration.loadNeuralNetworkID + ".json";
  }
  else {
    configuration.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  console.log(chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

  dbConnectionReadyInterval = setInterval(function() {

    if (dbConnectionReady) {
      clearInterval(dbConnectionReadyInterval);
      initProcessUserQueueInterval(PROCESS_USER_QUEUE_INTERVAL);
      // initCategorizedUserHashMap();
      initUserDbUpdateQueueInterval(1);
      initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);
      initRandomNetworkTree();
      initLangAnalyzerMessageRxQueueInterval(1);
      initLangAnalyzer();
      neuralNetworkInitialized = true;
      fsm.fsm_resetEnd();

      initTwitterUsers(function initTwitterUsersCallback(e) {
        if (e) {
          console.log(chalkError("*** ERROR INIT TWITTER USERS: " + e));
          return quit({source: "TFE", error: e});
        }

        console.log(chalkTwitter("TFE CHILDREN"
          + " | " + Object.keys(tfeChildHashMap)
        ));

        initSocket(cnf);

        loadMaxInputDropbox(defaultTrainingSetFolder, defaultMaxInputHashmapFile, function(err) {

          if (err) {
            console.log("LOAD MAX INPUTS HASHMAP FILE ERROR: " + err);
            quit("LOAD MAX INPUTS HASHMAP FILE ERROR");
            return;
          }

          if (randomNetworkTree && (randomNetworkTree !== undefined)) {

            randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap }, function() {
              console.log(chalkBlue("SEND MAX INPUTS HASHMAP"));

              initFetchAllInterval(configuration.fetchAllIntervalTime);

              setTimeout(function() {
                fsm.fsm_init();
                initFsmTickInterval(FSM_TICK_INTERVAL);
              }, 3000);
            });
          }

        });

      });
    }
    else {
      console.log(chalkAlert("... WAIT DB CONNECTED ..."));
    }
  }, 1000);
});