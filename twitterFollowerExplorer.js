 /*jslint node: true */
"use strict";
require("isomorphic-fetch");

let start = process.hrtime();

let elapsed_time = function(note){
    const precision = 3; // 3 decimal places
    const elapsed = process.hrtime(start)[1] / 1000000; // divide by a million to get nano to milli
    console.log(process.hrtime(start)[0] + " s, " + elapsed.toFixed(precision) + " ms - " + note); // print message + time
    start = process.hrtime(); // reset the timer
};

// let maxInputsHashMap = {};

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;


const FSM_TICK_INTERVAL = ONE_SECOND;
const PROCESS_USER_QUEUE_INTERVAL = 1;

// const TEST_MODE_TOTAL_FETCH = 15;  // total twitter user fetch count
const TEST_MODE_TOTAL_FETCH = 100;
const TEST_MODE_FETCH_COUNT = 24;  // per request twitter user fetch count
const TEST_DROPBOX_NN_LOAD = 25;

const TFC_CHILD_PREFIX = "TFC_";
let tfeChildHashMap = {};

const SAVE_CACHE_DEFAULT_TTL = 120; // seconds

const TFE_NUM_RANDOM_NETWORKS = 100;

const IMAGE_QUOTA_TIMEOUT = 60000;

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

const moment = require("moment");
const fs = require("fs");
const debug = require("debug")("tfe");
const NodeCache = require("node-cache");
const os = require("os");
const util = require("util");
const pick = require("object.pick");
const omit = require("object.omit");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");
const async = require("async");
const Stately = require("stately.js");
const padStart = require("lodash.padstart");
const padEnd = require("lodash.padend");

let fsm;

const HashMap = require("hashmap").HashMap;

let bestNetworkHashMap = new HashMap();
let trainingSetHashMap = new HashMap();
let categorizedUserHashMap = new HashMap();

let bestNetworkFolderLoaded = false;

let maxInputHashMap = {};

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let quitWaitInterval;
let quitFlag = false;

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tfe";
const Slack = require("slack-node");
let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text, callback){

  debug(chalkInfo("SLACK POST: " + text));

  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response){
    if (err){
      console.error(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

// will use histograms to determine neural net inputs
// for emoji, hashtags, mentions, words
const MIN_HISTOGRAM_KEYS = 50;
const MAX_HISTOGRAM_KEYS = 100;


const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";
let bestRuntimeNetworkId = false;
let loadedNetworksFlag = false;
let networksSentFlag = false;
let currentBestNetworkId = false;

let processUserQueue = [];
let processUserQueueInterval;
let processUserQueueReady = true;

let updateNetworkStatsReady = true;

let socket;
let socketKeepAliveInterval;
let saveFileQueueInterval;
let saveFileBusy = false;

let prevBestNetworkId = "";

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");

let User;
let userServer;
let userServerReady = false;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");
const dbConnection = wordAssoDb();

dbConnection.on("error", console.error.bind(console, "connection error:"));

dbConnection.once("open", function() {
  console.log(chalkAlert("TFE | CONNECT: TWEET SERVER MONGOOSE DEFAULT CONNECTION OPEN"));
  User = mongoose.model("User", userModel.UserSchema);
  userServer = require("@threeceelabs/user-server-controller");
  userServerReady = true;
});


const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");

let enableImageAnalysis = true;

let langAnalyzer;
let langAnalyzerMessageRxQueueInterval;
let langAnalyzerMessageRxQueueReadyFlag = true;
let languageAnalysisReadyFlag = false;
let langAnalyzerMessageRxQueue = [];

let randomNetworkTree;
let randomNetworkTreeMessageRxQueueInterval;
let randomNetworkTreeMessageRxQueueReadyFlag = true;
let randomNetworkTreeReadyFlag = false;
let randomNetworkTreeBusyFlag = false;
let randomNetworkTreeActivateQueueSize = 0;
let randomNetworkTreeMessageRxQueue = [];
let randomNetworksObj = {};

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
let userDbUpdateQueue = [];

const cp = require("child_process");

let currentBestNetwork = {};
currentBestNetwork.overallMatchRate = 0;

let previousRandomNetworksHashMap = {};
let availableNeuralNetHashMap = {};

const LANGUAGE_ANALYZE_INTERVAL = 1000;
const RANDOM_NETWORK_TREE_INTERVAL = 1;

const TWITTER_DEFAULT_USER = "altthreecee00";

let saveFileQueue = [];

const inputTypes = ["emoji", "hashtags", "mentions", "urls", "words", "images"];
inputTypes.sort();

let inputArrays = {};

let stdin;
let abortCursor = false;
let categorizedUserHashMapReadyFlag = false;

let neuralNetworkInitialized = false;

let TFE_USER_DB_CRAWL = false;

let configuration = {};

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
configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.enableLanguageAnalysis = true;
configuration.forceLanguageAnalysis = false;
configuration.quitOnComplete = true;

let statsObj = {};
statsObj.childrenFetchBusy = false;
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.fetchCycleStartMoment = moment();
statsObj.fetchCycleEndMoment = moment();
statsObj.fetchCycleElapsed = 0;
statsObj.pid = process.pid;
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.heartbeatsReceived = 0;

statsObj.network = {};
statsObj.network.networkId = "";
statsObj.network.successRate = 0;

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

statsObj.elapsed = 0;

statsObj.bestNetworks = {};
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

Object.keys(statsObj.categorized).forEach(function(cat){
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


// let histograms = {};
// histograms.words = {};
// histograms.urls = {};
// histograms.hashtags = {};
// histograms.mentions = {};
// histograms.emoji = {};
// histograms.images = {};

let statsUpdateInterval;

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

const bestNetworkFolder = "/config/utility/best/neuralNetworks";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";

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
// let fsmPreviousPauseState;


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

  console.log(chalkLog("XXX $ SAVE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + file
  ));

  saveFileQueue.push(fileObj);
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj){
  console.log(chalkAlert("$$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));

  if (file === bestRuntimeNetworkFileName) {

    saveCache.ttl(bestRuntimeNetworkFileName, 30, function( err, changed ){
      if( !err ){
        console.log("SAVE CACHE TTL bestRuntimeNetworkFileName: 30 | CHANGED: " + changed ); // true
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

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

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

function printCat(c){
  if (c === "left") { return "L"; }
  if (c === "neutral") { return "N"; }
  if (c === "right") { return "R"; }
  if (c === "positive") { return "+"; }
  if (c === "negative") { return "-"; }
  if (c === "none") { return "0"; }
  return ".";
}

function resetTwitterUserState(user, callback){

  console.log(chalkTwitterBold("RESET TWITTER STATE"
    + " | @" + user
  ));

  // tfeChildHashMap[user].child.send({op: "INIT"}, function(){

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
  // });
}

function resetAllTwitterUserState(callback){
  async.forEach(Object.keys(twitterUserHashMap), function(user, cb){
    resetTwitterUserState(user, function(){
      cb();
    });
  }, function(){
    callback();
  });
}

function updateBestNetworkStats(networkObj){
  statsObj.bestRuntimeNetworkId = networkObj.networkId;
  statsObj.currentBestNetworkId = networkObj.networkId;

  if (statsObj.network === undefined) { statsObj.network = {}; }

  statsObj.network.networkId = networkObj.networkId;
  statsObj.network.networkType = networkObj.networkType;
  statsObj.network.successRate = networkObj.successRate;
  statsObj.network.input = networkObj.network.input;
  statsObj.network.output = networkObj.network.output;
  statsObj.network.evolve = {};
  if (networkObj.evolve !== undefined) {
    statsObj.network.evolve = networkObj.evolve;
    if (statsObj.network.evolve.options !== undefined) { statsObj.network.evolve.options.networkObj = null; }
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
        // + "\n" + jsonPrint(data)
      ));

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(data);
          callback(null, fileObj);
        }
        catch(e){
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
        catch(e){
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
        console.error(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 409) {
        console.error(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
        return(callback(error, null));
      }
      if (error.status === 0) {
        console.error(chalkError("TFE | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
  }
}

function loadTrainingSetsDropboxFolder(folder, callback){

  console.log(chalkNetwork("TFE | ... LOADING DROPBOX TRAINING SETS FOLDER | " + folder));

  let options = {path: folder};

  dropboxClient.filesListFolder(options)
  .then(function(response){

    debug(chalkLog("TFE | DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | NUM ENTRIES: " + response.entries.length
    ));

    async.eachSeries(response.entries, function(entry, cb){

      console.log(chalkLog("TFE | DROPBOX TRAINING SET FOUND"
        + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
        + " | " + entry.name
      ));

      if (!entry.name.startsWith("globalTrainingSet")){
        console.log("TFE | ... IGNORE DROPBOX TRAINING SETS FOLDER FILE: " + entry.name);
        return(cb());
      }

      if (!entry.name.endsWith(".json")){
        console.log("TFE | ... IGNORE DROPBOX TRAINING SETS FOLDER FILE: " + entry.name);
        return(cb());
      }

      const entryNameArray = entry.name.split(".");
      const trainingSetId = entryNameArray[0].replace("trainingSet_", "");

      if (trainingSetHashMap.has(trainingSetId)){

        let curTrainingSetObj = trainingSetHashMap.get(trainingSetId);
        let oldContentHash = false;

        if ((curTrainingSetObj.entry !== undefined) && (curTrainingSetObj.entry.content_hash !== undefined)){
          oldContentHash = curTrainingSetObj.entry.content_hash;
        }

        if (oldContentHash !== entry.content_hash) {

          console.log(chalkInfo("TFE | DROPBOX TRAINING SET CONTENT CHANGE"
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
            + " | TRAINING SET ID: " + trainingSetId
            + " | " + entry.name
            // + "\nCUR HASH: " + entry.content_hash
            // + "\nOLD HASH: " + oldContentHash
          ));

          loadFile(folder, entry.name, function(err, trainingSetObj){
            if (err) {
              console.log(chalkError("TFE | DROPBOX TRAINING SET LOAD FILE ERROR: " + err));
              cb();
            }
            else if ((trainingSetObj === undefined) || !trainingSetObj) {
              console.log(chalkError("TFE | DROPBOX TRAINING SET LOAD FILE ERROR | JSON UNDEFINED ??? "));
              cb();
            }
            else {

              maxInputHashMap = {};
              maxInputHashMap = deepcopy(trainingSetObj.maxInputHashMap);

              trainingSetHashMap.set(trainingSetObj.trainingSetId, {entry: entry} );

              console.log(chalkInfo("TFE | DROPBOX TRAINING SET"
                + " [" + trainingSetHashMap.count() + "]"
                + " | TRAINING SET SIZE: " + trainingSetObj.trainingSet.meta.setSize
                // + " | " + trainingSetObj.trainingSet.meta.numInputs + " INPUTS"
                + " | " + entry.name
                + " | " + trainingSetObj.trainingSetId
                // + "\n" + jsonPrint(trainingSetObj.entry)
              ));

              cb();
            }

          });
        }
        else{
          console.log(chalkLog("TFE | DROPBOX TRAINING SET CONTENT SAME  "
            + " | " + entry.name
            + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
          ));
          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, trainingSetObj){
          if (err) {
            console.log(chalkError("TFE | DROPBOX TRAINING SET LOAD FILE ERROR: " + err));
            cb();
          }
          else if ((trainingSetObj === undefined) || !trainingSetObj) {
            console.log(chalkError("TFE | DROPBOX TRAINING SET LOAD FILE ERROR | JSON UNDEFINED ??? "));
            cb();
          }
          else {

            maxInputHashMap = {};
            maxInputHashMap = deepcopy(trainingSetObj.maxInputHashMap);
            trainingSetHashMap.set(trainingSetObj.trainingSetId, {entry: entry} );

            console.log(chalkNetwork("TFE | LOADED DROPBOX TRAINING SET"
              + " [" + trainingSetHashMap.count() + "]"
              + " | TRAINING SET SIZE: " + trainingSetObj.trainingSet.meta.setSize
              + " | " + folder + "/" + entry.name
              + " | " + trainingSetObj.trainingSetId
              // + "\n" + jsonPrint(trainingSetObj.entry)
              // + " | META\n" + jsonPrint(trainingSetObj.trainingSet.meta)
            ));

            cb();
          }

        });

      }

    }, function(){
      console.log(chalkNetwork("TFE | =*=*= END LOAD DROPBOX TRAINING SETS"
        + " | " + trainingSetHashMap.count() + " TRAINING SETS IN HASHMAP"
      ));
      if (callback !== undefined) { callback(null); }
    });

  })
  .catch(function(err){
    console.log(chalkError("TFE | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    // quit("DROPBOX FILES LIST FOLDER ERROR");
    if (callback !== undefined) { callback(err); }
  });
}

function updateGlobalHistograms(callback){

  twitterTextParser.getGlobalHistograms(function(hists){

    twitterImageParser.getGlobalHistograms(function(imageHists){

      hists.images = {};
      hists.images = deepcopy(imageHists.images);

      // globalHistograms = {};
      // globalHistograms = deepcopy(hists);

      async.each(Object.keys(hists), function(histogramName, cb) {

        const currentHistogram = hists[histogramName];

        const keys = Object.keys(currentHistogram);
        let valA;
        let valB;

        const sortedKeys = keys.sort(function(a,b){
          if ((currentHistogram[a] !== null) && (typeof currentHistogram[a] === "object")) {
            valA = currentHistogram[a].total;
            valB = currentHistogram[b].total;
            return valB - valA;

          }
          else {
            valA = currentHistogram[a];
            valB = currentHistogram[b];
            return valB - valA;
          }
        });

        debug(chalkInfo("\nHIST " + histogramName.toUpperCase()
          + " | " + keys.length + " ----------"
        ));

        sortedKeys.forEach(function(k, i){
          if ((keys.length < MAX_HISTOGRAM_KEYS) || (currentHistogram[k] >= MIN_HISTOGRAM_KEYS) || (i < MAX_HISTOGRAM_KEYS)) { 

            if (currentHistogram[k] !== null && typeof currentHistogram[k] === "object") {

              statsObj.histograms[histogramName][k] = {};
              statsObj.histograms[histogramName][k] = currentHistogram[k];

              if (i < 10) {
                debug(currentHistogram[k].total
                  + " | L: " + currentHistogram[k].left
                  + " | R: " + currentHistogram[k].right
                  + " | N: " + currentHistogram[k].neutral
                  + " | +: " + currentHistogram[k].positive
                  + " | -: " + currentHistogram[k].negative
                  + " | U: " + currentHistogram[k].uncategorized
                  + " || " + k
                );
              }
            }
            else {

              statsObj.histograms[histogramName][k] = currentHistogram[k];

              debug(currentHistogram[k] + " | " + k);
            }
          }
        });

        cb();

      }, function(){
        if (callback !== undefined) { callback(hists); }
      });

    });

  });
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("======================================"
    + "\n" + title
    + "\nID:         " + nnObj.networkId
    + "\nCREATED:    " + getTimeStamp(nnObj.createdAt)
    + "\nSR:         " + nnObj.successRate.toFixed(2) + "%" 
    + "\nMR:         " + nnObj.matchRate.toFixed(2) + "%" 
    + "\nOAMR:       " + nnObj.overallMatchRate.toFixed(2) + "%" 
    + "\nINPUTS ID:  " + nnObj.inputsId
    + "\nINPUTS:     " + Object.keys(nnObj.inputsObj.inputs)
    + "\nNUM INPUTS: " + nnObj.numInputs
    + "\n======================================\n"
  ));
}

function loadBestNetworkDropboxFolder(folder, callback){

  let options = {path: folder};
  let newBestNetwork = false;
  statsObj.numNetworksLoaded = 0;
  statsObj.numNetworksUpdated = 0;
  statsObj.numNetworksSkipped = 0;

  dropboxClient.filesListFolder(options)
  .then(function(response){

    if (response.entries.length === 0) {
      console.log(chalkLog("TFE | NO DROPBOX NETWORKS FOUND"
        + " | " + options.path
      ));
      if (callback !== undefined) { 
        return callback( null, {best: currentBestNetwork} );
      }
      else {
        return;
      }
    }

    console.log(chalkLog("TFE | DROPBOX NETWORKS"
      + " | " + options.path
      + " | FOUND " + response.entries.length + " FILES"
      // + " | " + jsonPrint(response)
    ));

    async.eachSeries(response.entries, function(entry, cb){

      if (configuration.testMode && ((bestNetworkHashMap.count() >= TEST_DROPBOX_NN_LOAD) || (statsObj.numNetworksLoaded >= TEST_DROPBOX_NN_LOAD))) {
        console.log(chalkLog("TFE | *** TEST MODE *** LOADED DROPBOX NETWORKS"
          + " | TEST_DROPBOX_NN_LOAD: " + TEST_DROPBOX_NN_LOAD
          + " | FOUND " + response.entries.length + " FILES"
          // + " | " + jsonPrint(response)
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

      if (bestNetworkHashMap.has(networkId)){

        const bno = bestNetworkHashMap.get(networkId);

        if (!bno || (bno === undefined)) {
          console.error(chalkError("bestNetworkHashMap ENTRY UNDEFINED??? | " + networkId));
          return(cb());
        }

        if (bno.entry === undefined) {
          console.log(chalkError("bestNetworkHashMap ENTRY PROP UNDEFINED??? | " + networkId + "\n" + jsonPrint(bno)));
          return(cb());
        }

        if (bno.entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("DROPBOX NETWORK CONTENT CHANGE"
            + " | " + getTimeStamp(entry.client_modified)
            + " | " + entry.name
          ));

          loadFile(folder, entry.name, function(err, networkObj){

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


            const hmObj = {
              entry: entry,
              network: networkObj
            };

            bestNetworkHashMap.set(networkObj.networkId, hmObj);

            if (!currentBestNetwork 
              || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)
              || (networkObj.matchRate > currentBestNetwork.matchRate)
            ) {

              currentBestNetwork = deepcopy(networkObj);
              prevBestNetworkId = bestRuntimeNetworkId;
              bestRuntimeNetworkId = networkObj.networkId;
              newBestNetwork = true;

              if (hostname === "google") {

                updateBestNetworkStats(networkObj);

                const fileObj = {
                  networkId: bestRuntimeNetworkId, 
                  successRate: networkObj.successRate, 
                  matchRate:  networkObj.matchRate,
                  overallMatchRate:  networkObj.overallMatchRate
                };

                saveCache.set(bestRuntimeNetworkFileName, {folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj }, function(){});
              }
            }
            async.setImmediate(function() { cb(); });
          });

        }
        else {
          debug(chalkLog("DROPBOX NETWORK CONTENT SAME  "
            + " | " + entry.name
            // + " | " + getTimeStamp(entry.client_modified)
          ));

          async.setImmediate(function() { cb(); });
        }
      }
      else {

        loadFile(folder, entry.name, function(err, networkObj){

          if (err) {
            console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
            return(cb());
          }

          if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
          if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }


          if (
               ((networkObj.successRate >= configuration.minSuccessRate) && (networkObj.overallMatchRate === 0))
            || (networkObj.overallMatchRate >= configuration.minMatchRate)
            || (configuration.testMode && (networkObj.successRate >= 0.5*configuration.minSuccessRate) && (networkObj.overallMatchRate === 0))
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

            bestNetworkHashMap.set(networkObj.networkId, { entry: entry, network: networkObj});

            availableNeuralNetHashMap[networkObj.networkId] = true;

            if (!currentBestNetwork 
              || (networkObj.matchRate > currentBestNetwork.matchRate)
              || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)
            ) {

              currentBestNetwork = deepcopy(networkObj);
              prevBestNetworkId = bestRuntimeNetworkId;
              bestRuntimeNetworkId = networkObj.networkId;
              newBestNetwork = true;

              updateBestNetworkStats(networkObj);

              if (hostname === "google") {

                const fileObj = {
                  networkId: bestRuntimeNetworkId, 
                  successRate: networkObj.successRate, 
                  overallMatchRate:  networkObj.overallMatchRate,
                  matchRate:  networkObj.matchRate
                };

                saveCache.set(bestRuntimeNetworkFileName, {folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj }, function(){});
              }
            }

            async.setImmediate(function() { cb(); });

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
    }, function(){

      if (newBestNetwork) {
        newBestNetwork = false;
        printNetworkObj("BEST NETWORK", currentBestNetwork);
      }

      console.log(chalkAlert("\n===================================\n"
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
  })
  .catch(function(err){

    console.log(chalkError("loadBestNetworkDropboxFolder *** DROPBOX FILES LIST FOLDER ERROR"
      + "\nOPTIONS: " + jsonPrint(options)
      + "\nERROR: " + err 
      + "\nERROR: " + jsonPrint(err)
    ));
    if (callback !== undefined) { callback(err, null); }
  });
}

function initRandomNetworks(params, callback){

  if (loadedNetworksFlag) {
    console.log(chalkAlert("SKIP INIT RANDOM NETWORKS: loadedNetworksFlag: " + loadedNetworksFlag));
    return callback(null, randomNetworksObj);
  }

  async.each(Object.keys(randomNetworksObj), function(nnId, cb){

    previousRandomNetworksHashMap[nnId] = {};
    previousRandomNetworksHashMap[nnId] = statsObj.bestNetworks[nnId] || true;

    delete randomNetworksObj[nnId];

    cb();

  }, function(){
    
    randomNetworksObj = {};

    async.whilst(

      function() {

        // console.log("Object.keys(availableNeuralNetHashMap).length: " + Object.keys(availableNeuralNetHashMap).length);

        return (Object.keys(availableNeuralNetHashMap).length > 0) 
        && (Object.keys(randomNetworksObj).length < params.numRandomNetworks) ;

      },

      function(cb){

        const nnId = randomItem(Object.keys(availableNeuralNetHashMap));

        delete availableNeuralNetHashMap[nnId];

        const nn = bestNetworkHashMap.get(nnId);
        randomNetworksObj[nnId] = {};
        randomNetworksObj[nnId] = nn;

        console.log(chalkBlue("+++ RANDOM NETWORK"
          + " [" + Object.keys(randomNetworksObj).length + "]"
          + " | AVAIL NNs: " + Object.keys(availableNeuralNetHashMap).length
          + " | SR: " + randomNetworksObj[nnId].network.successRate.toFixed(2) + "%"
          + " | MR: " + randomNetworksObj[nnId].network.matchRate.toFixed(2) + "%"
          + " | OAMR: " + randomNetworksObj[nnId].network.overallMatchRate.toFixed(2) + "%"
          + " | " + nnId
        ));

        cb();

    }, function(err){

      loadedNetworksFlag = true;
      callback(err, randomNetworksObj);

    });

  });
}

function loadBestNeuralNetworkFile(callback){

  // if (bestNetworkFolderLoaded){
  //   console.log(chalkLog("DROPBOX NEURAL NETWORKS ALREADY LOADED ... SKIPPING"
  //     + " | FOLDER: " + bestNetworkFolder
  //   ));
  //   return(callback(null, null));
  // }

  console.log(chalkLog("... LOADING DROPBOX NEURAL NETWORKS"
    + " | FOLDER: " + bestNetworkFolder
    + " | TIMEOUT: " + DEFAULT_DROPBOX_TIMEOUT + " MS"
  ));

  loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, results){

    if (err) {
      console.log(chalkError("LOAD DROPBOX NETWORKS ERROR: " + err));
      if (err === "DROPBOX_TIMEOUT") {

      }
      callback(new Error(err), null);
    }
    else if (results.best === undefined) {
      console.log(chalkAlert("??? NO BEST DROPBOX NETWORK ???"));
      callback(null, null);
    }
    else {

      initRandomNetworks({ numRandomNetworks: configuration.numRandomNetworks }, function(err, ranNetObj){

        if (err) {
          console.log(chalkError("initRandomNetworks ERROR: " + err));
        }

        if (loadedNetworksFlag && !networksSentFlag && (randomNetworkTree && (randomNetworkTree !== undefined)) && (Object.keys(ranNetObj).length > 0)) {
          // console.log(chalkBlue("SEND RANDOM NETWORKS | " + Object.keys(ranNetObj).length));

          networksSentFlag = true;

          randomNetworkTree.send({ op: "LOAD_NETWORKS", networksObj: ranNetObj }, function(){
            networksSentFlag = false;
            console.log(chalkBlue("SENT RANDOM NETWORKS | " + Object.keys(ranNetObj).length));
          });
        }
        else {
          const randomNetworkTreeDefined = (randomNetworkTree && (randomNetworkTree !== undefined));
          console.log(chalkAlert("*** RANDOM NETWORKS NOT SENT"
            + " | NNs: " + Object.keys(ranNetObj).length
            + " | randomNetworkTree: " + randomNetworkTreeDefined
            + " | loadedNetworksFlag: " + loadedNetworksFlag
            + " | networksSentFlag: " + networksSentFlag
          ));
        }

        let bnwObj;
        let nnObj;

        if (bestRuntimeNetworkId && bestNetworkHashMap.has(bestRuntimeNetworkId)) {

          if (currentBestNetworkId !== bestRuntimeNetworkId) {

            currentBestNetworkId = bestRuntimeNetworkId;

            nnObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnwObj = deepcopy(nnObj.network);

            bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;
            bnwObj.overallMatchRate = (bnwObj.overallMatchRate !== undefined) ? bnwObj.overallMatchRate : 0;

            updateBestNetworkStats(bnwObj);

             console.log(chalkBlue(">>> NEW BEST RUNTIME NETWORK"
              + " | " + bnwObj.networkId 
              + " | SR: " + bnwObj.successRate.toFixed(2) 
              + " | MR: " + bnwObj.matchRate.toFixed(2) 
              + " | OAMR: " + bnwObj.overallMatchRate.toFixed(2) 
              // + "\n\n"
            ));

            printNetworkObj("LOADED NETWORK", bnwObj);

            Object.keys(bnwObj.inputsObj.inputs).forEach(function(type){
              debug(chalkNetwork("NN INPUTS TYPE" 
                + " | " + type
                + " | INPUTS: " + bnwObj.inputsObj.inputs[type].length
              ));
              inputArrays[type] = bnwObj.inputsObj.inputs[type];
            });
          }
          else {

            nnObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnwObj = deepcopy(nnObj.network);

            bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;
            bnwObj.overallMatchRate = (bnwObj.overallMatchRate !== undefined) ? bnwObj.overallMatchRate : 0;

            console.log(chalkBlue("... UPDATED BEST RUNTIME NETWORK"
              + " | " + bnwObj.networkId 
              + " | SR: " + bnwObj.successRate.toFixed(2) 
              + " | MR: " + bnwObj.matchRate.toFixed(2) 
              + " | OAMR: " + bnwObj.overallMatchRate.toFixed(2) 
              // + "\n\n"
            ));

            nnObj.network = deepcopy(bnwObj);
            bestNetworkHashMap.set(currentBestNetworkId, nnObj);
            printNetworkObj("LOADED NETWORK", bnwObj);
          }

          if (bnwObj.inputsObj.inputs.images === undefined) { bnwObj.inputsObj.inputs.images = ["businesss"]; }

          updateBestNetworkStats(bnwObj);

          bestNetworkFolderLoaded = true;
          callback(null, bnwObj);
        }
        else if (currentBestNetworkId && bestNetworkHashMap.has(currentBestNetworkId)) {

          nnObj = bestNetworkHashMap.get(currentBestNetworkId);
          bnwObj = deepcopy(nnObj.network);

          bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;
          bnwObj.overallMatchRate = (bnwObj.overallMatchRate !== undefined) ? bnwObj.overallMatchRate : 0;

          console.log(chalkBlue("... UPDATED BEST RUNTIME NETWORK"
            + " | " + bnwObj.networkId 
            + " | SR: " + bnwObj.successRate.toFixed(2) 
            + " | MR: " + bnwObj.matchRate.toFixed(2) 
            + " | OAMR: " + bnwObj.overallMatchRate.toFixed(2) 
          ));

          nnObj.network = deepcopy(bnwObj);
          bestNetworkHashMap.set(currentBestNetworkId, nnObj);

          printNetworkObj("LOADED NETWORK", bnwObj);

          bestNetworkFolderLoaded = true;

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
runEnableArgs.categorizedUserHashMapReadyFlag = categorizedUserHashMapReadyFlag;

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
  runEnableArgs.categorizedUserHashMapReadyFlag = categorizedUserHashMapReadyFlag;

  const runEnableKeys = Object.keys(runEnableArgs);

  if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }

  runEnableKeys.forEach(function(key){
    if (displayArgs) { console.log(chalkInfo("runEnable | " + key + ": " + runEnableArgs[key])); }
    if (!runEnableArgs[key]) {
      if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }
      return false;
    }
  });

  if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }

  return true;
}

function updateUserCategoryStats(user, callback){

  return new Promise(function() {

    let catObj = {};
    catObj.manual = false;
    catObj.auto = false;

    async.parallel({

      category: function(cb){
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

      categoryAuto: function(cb){

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
    }, function(){

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

function updateImageHistograms(params, callback){

  if (!params.bannerResults || (params.bannerResults.label.images === undefined)) {
    return callback(null, {});
  }

  let user = params.user;
  let imagesObj = params.bannerResults.label.images;
  let histogramsImages = {};
  const imageLabelArray = Object.keys(imagesObj);

  async.each(imageLabelArray, function(imageLabel, cb){

    if (user.category) {

      if (histogramsImages[imageLabel] === undefined) {
        histogramsImages[imageLabel] = {};
        histogramsImages[imageLabel].total = 0;
        histogramsImages[imageLabel].left = 0;
        histogramsImages[imageLabel].neutral = 0;
        histogramsImages[imageLabel].right = 0;
        histogramsImages[imageLabel].positive = 0;
        histogramsImages[imageLabel].negative = 0;
        histogramsImages[imageLabel].uncategorized = 0;
      }

      histogramsImages[imageLabel].total += 1;
      
      if (user.category) {
        if (user.category === "left") { histogramsImages[imageLabel].left += 1; }
        if (user.category === "neutral") { histogramsImages[imageLabel].neutral += 1; }
        if (user.category === "right") { histogramsImages[imageLabel].right += 1; }
        if (user.category === "positive") { histogramsImages[imageLabel].positive += 1; }
        if (user.category === "negative") { histogramsImages[imageLabel].negative += 1; }
      }
      else {
        histogramsImages[imageLabel].uncategorized += 1;
      }
    }

    async.setImmediate(function() {
      cb();
    });

  }, function(){
    callback(null, histogramsImages);
  });

}

function enableAnalysis(user, languageAnalysis){
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

function activateNetwork(obj){

  if (randomNetworkTreeReadyFlag) {
    randomNetworkTree.send({op: "ACTIVATE", obj: obj});
  }
}

function startImageQuotaTimeout(){
  setTimeout(function(){
    enableImageAnalysis = true;
    console.log(chalkLog("RE-ENABLE IMAGE ANALYSIS"));
  }, IMAGE_QUOTA_TIMEOUT);
}

// {user: user, histograms: histograms, updateCountHistory: updateCountHistory}

function updateHistograms(params, callback) {

  let comboHistogram = {};
  let user = {};
  let histograms = {};

  user = params.user;
  histograms = params.histograms;

  if (!user.histograms || (user.histograms === undefined)) {
    user.histograms = {};
  }

  const inputHistogramTypes = Object.keys(histograms);

  async.each(inputHistogramTypes, function(type, cb0){

    if (user.histograms[type] === undefined) { user.histograms[type] = {}; }

    const inputHistogramTypeItems = Object.keys(histograms[type]);

    async.each(inputHistogramTypeItems, function(item, cb1){

      if (user.histograms[type][item] === undefined) {
        user.histograms[type][item] = histograms[type][item];
      }
      else if (params.accumulateFlag) {
        user.histograms[type][item] += histograms[type][item];
      }

      async.setImmediate(function() {
        cb1();
      });

    }, function (argument) {
      async.setImmediate(function() {
        cb0();
      });
    });

  }, function(err){

    callback(err, user);
    
  });

}

function generateAutoCategory(params, user, callback){

  // elapsed_time("start generateAutoCategory");

  // PARSE USER STATUS + DESC, IF EXIST
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

      if (enableImageAnalysis && user.bannerImageUrl) {

        twitterImageParser.parseImage(
          user.bannerImageUrl, 
          {screenName: user.screenName, category: user.category, updateGlobalHistograms: true}, 
          function(err, results){
            if (err) {
              if (err.code === 8) {
                console.log(chalkAlert("PARSE BANNER IMAGE QUOTA ERROR"
                ));
                enableImageAnalysis = false;
                startImageQuotaTimeout();
              }
              else{
                console.log(chalkError("PARSE BANNER IMAGE ERROR"
                  // + "\nREQ\n" + jsonPrint(results)
                  + "\nERR\n" + jsonPrint(err)
                ));
              }
              cb(null, text, null);
            }
            else {
              debug(chalkAlert("PARSE BANNER IMAGE"
                + " | RESULTS\n" + jsonPrint(results)
              ));
              if (results.text !== undefined) {
                debug(chalkInfo("@" + user.screenName + " | " + results.text));
                text = text + "\n" + results.text;
              }
              cb(null, text, results);
            }
          }
        );
      }
      else {
        async.setImmediate(function() {
          cb(null, text, null);
        });
      }
    }

  ], function (err, text, bannerResults) {

    if (err) {
      console.error(chalkError("*** ERROR generateAutoCategory: " + err));
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

    twitterTextParser.parseText(text, parseTextOptions, function(err, hist){

      if (err) {
        console.log(chalkError("*** TWITTER TEXT PARSER ERROR: " + err));
        callback(new Error(err), null);
      }

      hist.images = {};

      const updateCountHistory = params.updateCountHistory 
      && (user.followersCount !== undefined) 
      && (user.friendsCount !== undefined) 
      && (user.statusesCount !== undefined);

      // elapsed_time("start updateImageHistograms");

      updateImageHistograms({user: user, bannerResults: bannerResults}, function(err, histImages){

        // elapsed_time("end updateImageHistograms");

        if (err) {
          console.log(chalkError("*** ERROR updateImageHistograms: " + err));
          return callback(new Error(err), null);
        }

        hist.images = histImages;

        // userServer.updateHistograms({user: user, histograms: histograms, updateCountHistory: updateCountHistory}, function(err, updatedUser){
        updateHistograms({user: user, histograms: hist, updateCountHistory: updateCountHistory}, function(err, updatedUser){

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
            langAnalyzer.send({op: "LANG_ANALIZE", obj: updatedUser, text: text}, function(){
              statsObj.analyzer.analyzed += 1;
            });
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

          const u = pick(updatedUser, ["nodeId", "screenName", "following", "threeceeFollowing", "category", "categoryAuto", "histograms", "languageAnalysis"]);

          activateNetwork({user: u, normalization: statsObj.normalization});

          callback(null, updatedUser);
        });

      });

    });
  });
}

function quit(cause){

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  quitFlag = true;

  fsm.fsm_reset();

  Object.keys(tfeChildHashMap).forEach(function(user){
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
  slackText = slackText + "\nSTART:       " + statsObj.startTimeMoment.format(compactDateTimeFormat);
  slackText = slackText + "\nELPSD:       " + msToTime(statsObj.elapsed);
  slackText = slackText + "\nFETCH ELPSD: " + msToTime(statsObj.fetchCycleElapsed);
  slackText = slackText + "\nTOT PRCSSD:  " + statsObj.users.totalFriendsProcessed;
  slackText = slackText + "\nGTOT PRCSSD: " + statsObj.users.grandTotalFriendsProcessed;

  console.log("TFE | SLACK TEXT: " + slackText);

  slackPostMessage(slackChannel, slackText);

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy 
      && !randomNetworkTreeBusyFlag
      && randomNetworkTreeReadyFlag
      && (saveFileQueue.length === 0)
      && (langAnalyzerMessageRxQueue.length === 0)
      && (randomNetworkTreeMessageRxQueue.length === 0)
      && (userDbUpdateQueue.length === 0)
      && randomNetworkTreeMessageRxQueueReadyFlag
      && languageAnalysisReadyFlag
      && userDbUpdateQueueReadyFlag
      ){

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

      setTimeout(function(){
        process.exit();      
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
}

function processUser(threeceeUser, userIn, lastTweeId, callback) {

  // elapsed_time("start processUser");

  let updateCountHistory = false;

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

          userServer.convertRawUser({user:userIn, lastTweeId: lastTweeId}, function(err, user){
            if (err) {
              console.log(chalkError("TFE | CONVERT USER ERROR"
                + " | LAST TWEET: " + lastTweeId
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

          if (typeof user.threeceeFollowing === "boolean") {
            console.log(chalkAlert(">>> CONVERT TO STRING | USER @" + user.screenName
              + " | threeceeFollowing TYPE: " + typeof user.threeceeFollowing
              + " | threeceeFollowing: " + user.threeceeFollowing
            ));
            user.threeceeFollowing = new String(threeceeUser);
          }
          else {
            user.threeceeFollowing = threeceeUser;
          }

          user.following = true;

          let catObj = {};

          catObj.manual = user.category || false;
          catObj.auto = user.categoryAuto || false;

          categorizedUserHashMap.set(user.nodeId, catObj);


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
          
          if (user.profileImageUrl !== userIn.profileImageUrl) {
            user.profileImageUrl = userIn.profileImageUrl;
          }
          
          if (user.bannerImageUrl !== userIn.bannerImageUrl) {
            user.bannerImageUrl = userIn.bannerImageUrl;
           }
          
          if (user.description !== userIn.description) {
            user.description = userIn.description;
          }
          
          if ((user.status !== undefined) && (userIn.status !== undefined) && user.status.id_str && userIn.status.id_str && (user.status.id_str !== userIn.status.id_str)) {
            user.status = userIn.status;
          }
          
          if ((userIn.followers_count !== undefined) && (user.followersCount !== userIn.followers_count)){
            user.followersCount = userIn.followers_count;
            updateCountHistory = true;
          }

          if ((userIn.friends_count !== undefined) && (user.friendsCount !== userIn.friends_count)){
            user.friendsCount = userIn.friends_count;
            updateCountHistory = true;
          }

          if ((userIn.statuses_count !== undefined) && (user.statusesCount !== userIn.statuses_count)){
            user.statusesCount = userIn.statuses_count;
            updateCountHistory = true;
          }

          cb(null, user);
        }
      });
    },

    function unfollowFriend(user, cb) {

      if (
           ((threeceeUser === "altthreecee01") && twitterUserHashMap.altthreecee00.friends.includes(user.nodeId))
        
        || ((threeceeUser === "altthreecee02") && twitterUserHashMap.altthreecee00.friends.includes(user.nodeId))
        || ((threeceeUser === "altthreecee02") && twitterUserHashMap.altthreecee01.friends.includes(user.nodeId))

      ) {

        if (twitterUserHashMap.altthreecee00.friends.includes(user.nodeId)) {

          if (twitterUserHashMap.altthreecee01.friends.includes(user.nodeId)) {
            twitterUserHashMap.altthreecee01.friends.splice(twitterUserHashMap.altthreecee01.friends.indexOf(user.nodeId), 1);
          }
          if (twitterUserHashMap.altthreecee02.friends.includes(user.nodeId)) {
            twitterUserHashMap.altthreecee02.friends.splice(twitterUserHashMap.altthreecee02.friends.indexOf(user.nodeId), 1);
          }
          
          user.following = true;
          user.threeceeFollowing = "altthreecee00";
        }

        else if (twitterUserHashMap.altthreecee01.friends.includes(user.nodeId)) {

          if (twitterUserHashMap.altthreecee02.friends.includes(user.nodeId)) {
            twitterUserHashMap.altthreecee02.friends.splice(twitterUserHashMap.altthreecee02.friends.indexOf(user.nodeId), 1);
          }
          
          user.following = true;
          user.threeceeFollowing = "altthreecee01";
        }

        else if (twitterUserHashMap.altthreecee02.friends.includes(user.nodeId)) {

          user.following = true;
          user.threeceeFollowing = "altthreecee02";
        }

        console.log(chalkInfo("XXX UNFOLLOW | altthreecee00 OR altthreecee01 FOLLOWING"
          + " | " + user.nodeId
          + " | " + user.screenName.toLowerCase()
          + " | FLWg: " + user.following
          + " | 3CF: " + user.threeceeFollowing
        ));

        twitterUserHashMap[threeceeUser].twit.post(

          "friendships/destroy", {user_id: user.nodeId}, 

          function destroyFriend(err, data, response){
            if (err) {
              console.error(chalkError("UNFOLLOW ERROR"
                + " | @" + threeceeUser
                + " | " + err
              ));
              cb(null, user);
            }
            else {
              debug("data\n" + jsonPrint(data));
              debug("response\n" + jsonPrint(response));

              console.log(chalkInfo("=X= UNFOLLOW"
                + " | 3C: @" + threeceeUser
                + " | NID: " + user.nodeId
                + " | @" + user.screenName.toLowerCase()
              ));
              const slackText = hostname
                + "\nUNFOLLOW @" + threeceeUser
                + "\n@" + user.screenName.toLowerCase()
                + "\n" + user.nodeId;
              slackPostMessage(slackChannel, slackText);
              cb(null, user);
            }
          }
        );
      }
      else {

        user.following = true;
        user.threeceeFollowing = threeceeUser;

        cb(null, user);
      }
    },

    function updateUserCategory(user, cb) {

      updateUserCategoryStats(user, function(err, u){
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

    function genAutoCat(user, cb){

      if (!neuralNetworkInitialized) { return(cb(null, user)); }

      generateAutoCategory({updateCountHistory: updateCountHistory}, user, function (err, uObj){
        cb(err, uObj);
      });
    }

  ], function (err, user) {

    if (err) {
      console.log(chalkError("PROCESS USER ERROR: " + err));
      callback(new Error(err), null);
    }
    else {

      // elapsed_time("end processUser");

      callback(null, user);
    }
  });
}

const checkChildrenState = function (checkState, callback){

  async.every(Object.keys(tfeChildHashMap), function(user, cb){

    debug("CH ID: " + user + " | " + tfeChildHashMap[user].status);

    const cs = (tfeChildHashMap[user].status === checkState);

    cb(null, cs);

  }, function(err, allCheckState){

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

function childSendAll(op, callback){

  console.log(chalkAlert(">>> CHILD SEND ALL | OP: " + op));

  async.each(Object.keys(tfeChildHashMap), function(user, cb){
    const curChild = tfeChildHashMap[user].child;
    curChild.send({op: op}, function(err){
      if (err) {
        console.log(chalkError("*** CHILD SEND ALL ERROR" 
          + " | @" + user 
          + " | OP: " + op 
          + " | ERR: " + err
        ));
      }
      cb(err);
    });
  }, function(err){
    if (callback !== undefined) { callback(err); }
  });
}

function reporter(event, oldState, newState) {
  // if (newState === "PAUSE_RATE_LIMIT") {
  //   // fsmPreviousPauseState = oldState;
  // }
  fsmPreviousState = oldState;
  console.log(chalkAlert("--------------------------------------------------------\n"
    + "<< FSM >>"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n--------------------------------------------------------"
  ));
}

const processUserQueueEmpty = function(){
  return (processUserQueue.length === 0);
};


let waitFileSaveInterval;

const fsmStates = {
  "RESET":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
    },
    "fsm_resetEnd": "IDLE"
  },
  "IDLE":{
    onEnter: reporter,
    "fsm_init": "INIT"
  },
  "ERROR":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
    },
    "fsm_reset": "RESET"
  },
  "INIT":{
    onEnter: function(event, oldState, newState){

      if (event !== "fsm_tick") { 
        reporter(event, oldState, newState);
        checkChildrenState("INIT", function(err, aci){
          console.log("ALL CHILDREN INIT: " + aci);
          if (!aci && (event !== "fsm_tick")) { childSendAll("INIT"); }
        });
      }

    },
    fsm_tick: function(){
      checkChildrenState("INIT", function(err, aci){
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

    onEnter: function(event, oldState, newState){

      if (event !== "fsm_tick") { 
        reporter(event, oldState, newState); 
        checkChildrenState("READY", function(err, aci){
          console.log("ALL CHILDREN READY: " + aci);
          if (!aci && (event !== "fsm_tick")) { childSendAll("READY"); }
        });
      }


    },
    fsm_tick: function(){
      checkChildrenState("READY", function(err, acr){
        debug("READY TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN READY: " + acr
        );
        if (acr && processUserQueueReady && processUserQueueEmpty()) { fsm.fsm_fetchAllStart(); }
      });
    },

    "fsm_reset": "RESET",
    "fsm_fetchAllStart": "FETCH_ALL"
  },
  "FETCH_ALL":{
    onEnter: function(event, oldState, newState){

      // console.log("FETCH_ALL | onEnter");

      if (event !== "fsm_tick") { 

        reporter(event, oldState, newState);

        console.log("FETCH_ALL | onEnter | " + event);

        loadBestNeuralNetworkFile(function(err, nnObj){
          if (err) {
            console.error(chalkError("*** LOAD BEST NETWORK FILE ERROR: " + err));
          }

          // debug("loadBestNeuralNetworkFile nnObj\n" + jsonPrint(nnObj));

          console.log("FETCH_ALL | loadBestNeuralNetworkFile DONE");

          loadTrainingSetsDropboxFolder(defaultTrainingSetFolder, function(){

            randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap }, function(){
              console.log(chalkBlue("SEND MAX INPUTS HASHMAP"));

              updateGlobalHistograms();

              childSendAll("FETCH_USER_START");
              statsObj.fetchCycleStartMoment = moment();
              statsObj.fetchCycleElapsed = 0;

            });
          });
        });
      }
    },

    fsm_tick: function(){
      statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
      checkChildrenState("FETCH_END", function(err, acfe){
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
    onEnter: function(event, oldState, newState){

      if (event !== "fsm_tick") { 

        reporter(event, oldState, newState);

        statsObj.fetchCycleEndMoment = moment();
        statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);

        console.log(chalkAlert("===================================================="));
        console.log(chalkAlert("================= END FETCH ALL ===================="));
        console.log(chalkAlert("===================================================="));
        console.log(chalkAlert("FETCH CYCLE START:     " + statsObj.fetchCycleStartMoment.format(compactDateTimeFormat)));
        console.log(chalkAlert("FETCH CYCLE END:       " + statsObj.fetchCycleEndMoment.format(compactDateTimeFormat)));
        console.log(chalkAlert("FETCH CYCLE ELAPSED:   " + msToTime(statsObj.fetchCycleElapsed)));
        console.log(chalkAlert("TOTAL USERS FETCHED:   " + statsObj.users.totalFriendsFetched));
        console.log(chalkAlert("TOTAL USERS PROCESSED: " + statsObj.users.totalFriendsProcessed));
        console.log(chalkAlert("===================================================="));

        console.log(chalkAlert("... PAUSING FOR 10 SECONDS FOR RNT STAT UPDATE ..."));

        randomNetworkTree.send({op: "GET_STATS"}); 

        let slackText = "\n*FETCH END*"; 
        slackText = slackText + "\nHOST:  " + hostname;
        slackText = slackText + "\nELPSD: " + msToTime(statsObj.fetchCycleElapsed);
        slackText = slackText + "\nTOT:   " + statsObj.users.totalFriendsProcessed;
        slackText = slackText + "\nGTOT:  " + statsObj.users.grandTotalFriendsProcessed;

        console.log("TFE | SLACK TEXT: " + slackText);

        clearInterval(waitFileSaveInterval);

        slackPostMessage(slackChannel, slackText);

        waitFileSaveInterval = setInterval(function(){

          if (saveFileQueue.length === 0) {

            console.log(chalkAlert("ALL NNs SAVED ..."));

            if (randomNetworkTree ) { randomNetworkTree.send({op: "RESET_STATS"}); }
            childSendAll("RESET_TWITTER_USER_STATE");

            resetAllTwitterUserState(function(){

              statsObj.users.totalFriendsCount = 0;
              statsObj.users.totalFriendsProcessed = 0;
              statsObj.users.totalFriendsFetched = 0;
              statsObj.users.totalPercentProcessed = 0;
              statsObj.users.totalPercentFetched = 0;
              statsObj.users.classifiedAuto = 0;
              statsObj.users.classified = 0;

              clearInterval(waitFileSaveInterval);

              fsm.fsm_init();
            });
          }
          else {
            console.log(chalkAlert("... WAITING FOR NNs TO BE SAVED ..."
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

let fsmTickInterval;

function initFsmTickInterval(interval){

  console.log(chalkInfo("INIT FSM TICK INTERVAL | " + msToTime(interval)));
  
  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function(){

    statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
    fsm.fsm_tick();

  }, FSM_TICK_INTERVAL);
}

reporter("START", "---", fsm.getMachineState());

inputTypes.forEach(function(type){
  statsObj.histograms[type] = {};
});

const USER_ID = "tfe_" + hostname;
const SCREEN_NAME = "tfe_" + hostname;

let userObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  url: "https://www.twitter.com", 
  screenName: SCREEN_NAME, 
  namespace: "util", 
  type: "util", 
  mode: "muxstream",
  timeStamp: moment().valueOf(),
  tags: {},
  stats: {}
} ;

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

if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
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
    // clearInterval(checkRateLimitInterval);
    clearInterval(statsUpdateInterval);

    setTimeout(function() {
      console.log("QUITTING twitterFollowerExplorer");
      process.exit(0);
    }, 300);

  }
});


function showStats(options){
  runEnable();
  if (langAnalyzer !== undefined) {
    langAnalyzer.send({op: "STATS", options: options});
  }
  if (options) {
    updateGlobalHistograms(function(){
      console.log("STATS\n" + jsonPrint(omit(statsObj, ["histograms"])));
    });
  }
  else {

    updateGlobalHistograms();

    console.log(chalkLog("### FEM S"
      + " | N: " + getTimeStamp()
      + " | E: " + statsObj.elapsed
      + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
      + " | PUQ: " + processUserQueue.length
      + " | FSM: " + fsm.getMachineState()
    ));

// RNT READY:
    console.log(chalkLog("... RNT S"
      + " | BUSY: " + randomNetworkTreeBusyFlag
      + " | READY: " + randomNetworkTreeReadyFlag
      + " | RAQ: " + randomNetworkTreeActivateQueueSize
    ));

    Object.keys(tfeChildHashMap).forEach(function(user){
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

  if (OFFLINE_MODE) {
    if (callback !== undefined) { 
      return(callback(null, null));
    }
    return;
  }

  const fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(params.obj, null, 2);
  options.path = fullPath;
  options.mode = params.mode || "overwrite";
  options.autorename = params.autorename || false;


  const dbFileUpload = function () {
    dropboxClient.filesUpload(options)
    .then(function(){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        // const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          // + " | ERROR\n" + jsonPrint(error)
          + " | ERROR: " + error
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
  };

  if (options.mode === "add") {

    dropboxClient.filesListFolder({path: params.folder})
    .then(function(response){

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | " + options.path
        + " | " + jsonPrint(response)
      ));

      let fileExits = false;

      async.eachSeries(response.entries, function(entry, cb){

        console.log(chalkInfo("DROPBOX FILE"
          + " | " + params.folder
          // + " | " + getTimeStamp(entry.client_modified)
          + " | " + entry.name
          // + " | " + entry.content_hash
          // + "\n" + jsonPrint(entry)
        ));

        if (entry.name === params.file) {
          fileExits = true;
        }

        cb();

      }, function(err){
        if (err) {
          console.log(chalkError("*** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    })
    .catch(function(err){
      console.log(chalkError("saveFile *** DROPBOX FILES LIST FOLDER ERROR ", err));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function initProcessUserQueueInterval(interval){

  let mObj = {};
  let tcUser;

  console.log(chalkBlue("TFE | INIT PROCESS USER QUEUE INTERVAL | " + PROCESS_USER_QUEUE_INTERVAL + " MS"));

  clearInterval(processUserQueueInterval);

  processUserQueueInterval = setInterval(function () {


    if (processUserQueueReady && processUserQueue.length > 0) {

      // elapsed_time("start processUserQueue");

      processUserQueueReady = false;

      mObj = processUserQueue.shift();

      tcUser = mObj.threeceeUser;

      processUser(tcUser, mObj.friend, null, function(err, user){
        if (err) {
          console.trace("processUser ERROR");
          processUserQueueReady = true;
          return;
        }

        statsObj.users.grandTotalFriendsProcessed += 1;
        statsObj.users.totalFriendsProcessed += 1;
        statsObj.user[tcUser].totalPercentProcessed = 100*statsObj.users.totalFriendsProcessed/statsObj.users.totalFriendsCount;

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

          console.log(chalkLog("<FRND PRCSSD"
            + " [ Q: " + processUserQueue.length + " ]"
            + " | @" + tcUser
            + " | PRCSSD: " + statsObj.user[tcUser].friendsProcessed + "/" + statsObj.user[tcUser].friendsCount
            + " (" + statsObj.user[tcUser].percentProcessed.toFixed(2) + "%)"
            + " | S: " + statsObj.user[tcUser].friendsProcessStart.format(compactDateTimeFormat)
            + " | E: " + msToTime(statsObj.user[tcUser].friendsProcessElapsed)
            + " | FLWg: " + user.following
            + " | 3CF: " + user.threeceeFollowing
            + " | @" + user.screenName
            + " | Ts: " + user.statusesCount
            + " | FLWRs: " + user.followersCount
            + " | FRNDs: " + user.friendsCount
          ));
        }

        processUserQueueReady = true;
        // elapsed_time("end processUserQueue");

      });

    }

  }, interval);
}

function initSaveFileQueue(cnf){

  console.log(chalkBlue("TFE | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
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

function sendKeepAlive(userObj, callback){
  
  if (statsObj.userAuthenticated && statsObj.serverConnected){
    debug(chalkLog("TX KEEPALIVE"
      + " | " + userObj.userId
      + " | " + moment().format(compactDateTimeFormat)
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    callback(null, null);
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

function initKeepalive(interval){

  clearInterval(socketKeepAliveInterval);

  console.log(chalkConnect("START KEEPALIVE"
    // + " | USER ID: " + userId
    + " | READY ACK: " + statsObj.userAuthenticated
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  socketKeepAliveInterval = setInterval(function(){ // TX KEEPALIVE

    userObj.stats.tweetsPerMinute = statsObj.tweetsPerMinute;
    userObj.stats.tweetsPerSecond = statsObj.tweetsPerSecond;

    sendKeepAlive(userObj, function(err, results){
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      else if (results){
        console.log(chalkConnect("KEEPALIVE"
          + " | " + moment().format(compactDateTimeFormat)
        ));
      }
    });
  }, interval);
}

function reset(cause, callback){

  console.log(chalkAlert("\nRESET | CAUSE: " + cause + "\n"));

  clearInterval(socketKeepAliveInterval);

  if (callback !== undefined) { callback(); } 
}

function initSocket(cnf, callback){

  if (OFFLINE_MODE) {
    console.log(chalkError("*** OFFLINE MODE *** "));
    return(callback(null, null));
  }

  console.log(chalkLog("INIT SOCKET"
    + " | " + cnf.targetServer
    + " | " + jsonPrint(userObj)
  ));

  socket = require("socket.io-client")(cnf.targetServer, { reconnection: true });

  socket.on("connect", function(){

    console.log(chalkConnect("SOCKET CONNECT | " + socket.id + " ... AUTHENTICATE ..."));

    socket.on("unauthorized", function(err){
      console.log(chalkError("*** AUTHENTICATION ERROR: ", err.message));
    });

    socket.emit("authentication", { namespace: "util", userId: userObj.userId, password: "0123456789" });

    socket.on("authenticated", function() {

      console.log("AUTHENTICATED | " + socket.id);

      reset("connect", function(){

        statsObj.socketId = socket.id;

        console.log(chalkConnect( "CONNECTED TO HOST" 
          + " | SERVER: " + cnf.targetServer 
          + " | ID: " + socket.id 
          ));

        // wait for server to init before tx USER_READY

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

          statsObj.serverConnected = true ;
          statsObj.userAuthenticated = true ;

          initKeepalive(cnf.keepaliveInterval);

      });
    });

    socket.on("disconnect", function(reason){
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
      console.log(chalkConnect(moment().format(compactDateTimeFormat)
        + " | SOCKET DISCONNECT: " + socket.id
        + " | REASON: " + reason
      ));
    });
  });

  socket.on("reconnect", function(reason){
    console.error(chalkInfo("RECONNECT" 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + socket.id
      + " | REASON: " + reason
    ));
  });

  socket.on("USER_READY_ACK", function(userId) {

    statsObj.userAuthenticated = true ;

    debug(chalkInfo("RX USER_READY_ACK MESSAGE"
      + " | " + socket.id
      + " | USER ID: " + userId
      + " | " + moment().format(compactDateTimeFormat)
    ));

    if (userId === userObj.tags.entity) {
      initKeepalive(cnf.keepaliveInterval);
    }
  });

  socket.on("error", function(error){
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    socket.disconnect();
    console.error(chalkError(moment().format(compactDateTimeFormat) 
      + " | *** SOCKET ERROR"
      + " | " + socket.id
      + " | " + error
    ));
    reset("error");
  });

  socket.on("connect_error", function(err){
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    console.error(chalkError("*** CONNECT ERROR " 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
      // + "\n" + jsonPrint(err)
    ));
    reset("connect_error");
  });

  socket.on("reconnect_error", function(err){
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    console.error(chalkError("*** RECONNECT ERROR " 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
      // + "\n" + jsonPrint(err)
    ));
    // reset("reconnect_error");
  });

  socket.on("SESSION_ABORT", function(sessionId){
    console.log(chalkAlert("@@@@@ RX SESSION_ABORT | " + sessionId));
    if (sessionId === statsObj.socketId){
      console.error(chalkAlert("***** RX SESSION_ABORT HIT | " + sessionId));
      console.log(chalkAlert("***** RX SESSION_ABORT HIT | " + sessionId));
      socket.disconnect();
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
    }
    reset("SESSION_ABORT");
  });

  socket.on("SESSION_EXPIRED", function(sessionId){
    console.log(chalkAlert("RX SESSION_EXPIRED | " + sessionId));
    if (sessionId === statsObj.socketId){
      console.error(chalkAlert("***** RX SESSION_EXPIRED HIT | " + sessionId));
      console.log(chalkAlert("***** RX SESSION_EXPIRED HIT | " + sessionId));
      socket.disconnect();
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
    }
    reset("SESSION_EXPIRED");
  });

  socket.on("DROPBOX_CHANGE", function(response){
    
    response.entries.forEach(function(entry){

      debug(chalkInfo(">R DROPBOX_CHANGE"
        + " | " + entry[".tag"].toUpperCase()
        + " | " + entry.path_lower
        + " | NAME: " + entry.name
      ));

      const entryNameArray = entry.name.split(".");

      if ((entryNameArray[1] !== "json") || (entry.name === bestRuntimeNetworkFileName)){
        debug(chalkAlert("SKIP: " + entry.path_lower));
        return;
      }

      loadFile(bestNetworkFolder, entry.name, function(err, networkObj){

        if (err) {
          console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR"
            + " | " + bestNetworkFolder + "/" + entry.name
            + " | " + err
          ));
          return;
        }

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

        const hmObj = {
          entry: entry,
          network: networkObj
        };

        bestNetworkHashMap.set(networkObj.networkId, hmObj);

        if (!currentBestNetwork 
          || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)
          || (networkObj.matchRate > currentBestNetwork.matchRate)) {

          currentBestNetwork = deepcopy(networkObj);
          prevBestNetworkId = bestRuntimeNetworkId;
          bestRuntimeNetworkId = networkObj.networkId;

          updateBestNetworkStats(hmObj.network);

          printNetworkObj("BEST NETWORK", currentBestNetwork);

          if (hostname === "google") {

            const fileObj = {
              networkId: bestRuntimeNetworkId, 
              successRate: networkObj.successRate, 
              matchRate:  networkObj.matchRate,
              overallMatchRate:  networkObj.overallMatchRate
            };

            saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj }, function(){});
          }
        }

      });
    });

  });

  socket.on("HEARTBEAT", function(){
    statsObj.heartbeatsReceived += 1;
  });

  socket.on("KEEPALIVE_ACK", function(userId) {
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });

  callback(null, null);
}

function initStatsUpdate(callback){

  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  twitterTextParser.getGlobalHistograms(function(){
    saveFile({folder: statsFolder, file: statsFile, obj: statsObj});
  });


  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    twitterTextParser.getGlobalHistograms(function(){
      saveFileQueue.push({folder: statsFolder, file: statsFile, obj: statsObj});
    });

    showStats();

  }, configuration.statsUpdateIntervalTime);

  callback(null);
}

function initTwitterFollowerChild(twitterConfig, callback){

  const user = twitterConfig.threeceeUser;
  const childId = TFC_CHILD_PREFIX + twitterConfig.threeceeUser;

  console.log(chalkAlert("+++ NEW TFE CHILD | TFC ID: " + childId));

  let childEnv = {};
  childEnv.env = {};
  childEnv.env.TWITTER_CONFIG = {};

  Object.keys(twitterConfig).forEach(function(key){
    childEnv.env[key] = twitterConfig[key];
  });

  childEnv.env.CHILD_ID = childId;
  childEnv.env.THREECEE_USER = twitterConfig.threeceeUser;
  childEnv.env.DEFAULT_FETCH_COUNT = DEFAULT_FETCH_COUNT;

  childEnv.env.TEST_MODE_TOTAL_FETCH = TEST_MODE_TOTAL_FETCH;
  childEnv.env.TEST_MODE_FETCH_COUNT = TEST_MODE_FETCH_COUNT;
  childEnv.env.TEST_MODE = (configuration.testMode) ? 1 : 0;

  console.log(chalkAlert("+++ NEW TFE CHILD | childEnv\n" + jsonPrint(childEnv)));

  const tfeChild = cp.fork(`twitterFollowerExplorerChild.js`, childEnv );

  tfeChildHashMap[user] = {};
  tfeChildHashMap[user].childId = childId;
  tfeChildHashMap[user].threeceeUser = user;
  tfeChildHashMap[user].child = {};
  tfeChildHashMap[user].status = "IDLE";

  tfeChild.on("message", function(m){

    debug(chalkAlert("tfeChild RX"
      + " | " + m.op
    ));

    if (m.error) {
      console.error(chalkError("TFC | tfeChild RX ERROR\n" + jsonPrint(m)));
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
      break;

      case "FRIEND_RAW":
        if (configuration.testMode){
          console.log(chalkInfo("TFC | R> FRIEND"
            + " | 3C: @" + m.threeceeUser
            + " | @" + m.friend.screen_name
          ));
        }
        processUserQueue.push(m);
        // tfeChildHashMap[m.threeceeUser].status = "FRIEND_RAW";
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
      console.error(chalkError("TFC | CHILD " + m.threeceeUser + " | UNKNOWN OP: " + m.op));
    }
  });

  tfeChild.on("error", function(err){
    if (tfeChildHashMap[user]) {
      tfeChildHashMap[user].status = "ERROR";
    }
    console.log(chalkError("*** tfeChildHashMap " + user + " ERROR *** : " + err));
  });

  tfeChild.on("exit", function(err){
    if (tfeChildHashMap[user]) {
      tfeChildHashMap[user].status = "EXIT";
    }
    console.log(chalkError("*** tfeChildHashMap " + user + " EXIT *** : " + err));
  });

  tfeChild.on("close", function(code){
    if (tfeChildHashMap[user]) {
      tfeChildHashMap[user].status = "CLOSE";
    }
    console.log(chalkError("*** tfeChildHashMap " + user + " CLOSE *** : " + code));
  });

  tfeChildHashMap[user].child = tfeChild;

  if (callback !== undefined) { callback(null, user); }
}

function initTwitter(threeceeUser, callback){

  let twitterConfigFile =  threeceeUser + ".json";

  debug(chalkInfo("INIT TWITTER USER @" + threeceeUser + " | " + twitterConfigFile));

  loadFile(configuration.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + configuration.twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      return callback(err);
    }

    twitterConfig.threeceeUser = threeceeUser;

    console.log(chalkTwitter("LOADED TWITTER CONFIG"
      + " | @" + threeceeUser
      + " | CONFIG FILE: " + configuration.twitterConfigFolder + "/" + twitterConfigFile
      + "\n" + jsonPrint(twitterConfig)
    ));

    initTwitterFollowerChild(twitterConfig, function(err0, childId){
      callback(err0, twitterConfig);
    });

  });
}

function initTwitterUsers(callback){

  if (!configuration.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    if (callback !== undefined) {callback(null, null);}
  }
  else {

    console.log(chalkTwitter("TFE | INIT TWITTER USERS"
      + " | FOUND " + configuration.twitterUsers.length + " USERS"
    ));

    async.each(configuration.twitterUsers, function(userScreenName, cb){

      userScreenName = userScreenName.toLowerCase();

      console.log(chalkTwitter("TFE | INIT TWITTER USER @" + userScreenName));

      twitterUserHashMap[userScreenName] = {};
      twitterUserHashMap[userScreenName].threeceeUser = userScreenName;
      twitterUserHashMap[userScreenName].friends = [];

      // resetTwitterUserState(userScreenName);

      initTwitter(userScreenName, function(err, twitObj){
        if (err) {
          console.log(chalkError("INIT TWITTER ERROR: " + err.message));
          if (err.code === 88) {
            return(cb());
          }
          return(cb(err));
        }

        debug("INIT TWITTER twitObj\n" + jsonPrint(twitObj));

        resetTwitterUserState(userScreenName, function(){
          cb();
        });

      });

    }, function(err){

      statsObj.users.totalFriendsCount = 0;
      statsObj.users.totalFriendsFetched = 0;

      configuration.twitterUsers.forEach(function(tUserScreenName){
        statsObj.users.totalFriendsFetched += statsObj.user[tUserScreenName].totalFriendsFetched;
        statsObj.users.totalFriendsCount += statsObj.user[tUserScreenName].friendsCount;
        statsObj.users.totalPercentFetched = 100 * statsObj.users.totalFriendsFetched/statsObj.users.totalFriendsCount;
      });

      statsObj.users.grandTotalFriendsFetched += statsObj.users.totalFriendsFetched;

      console.log(chalkTwitterBold("====================================================================="
        // + "\nALL TWITTER USERS"
        // + " | " + statsObj.users.totalFriendsCount + " GRAND TOTAL FRIENDS"
        // + " | " + statsObj.users.totalFriendsFetched + " GRAND TOTAL FETCHED"
        // + " (" + statsObj.users.totalPercentFetched.toFixed(2) + "%)"
        + "\n====================================================================="
      ));

      if (callback !== undefined) { callback(err); }
    });

  }
}

function initCategorizedUserHashMap(callback){

  console.log(chalkTwitter("INIT CATEGORIZED USER HASHMAPS FROM DB"));

  userServer.findCategorizedUsersCursor({}, function(err, results){
    if (err) {
      console.error(chalkError("ERROR: initCategoryHashmaps: findCategorizedUsersCursor:"
        + " " + err
      ));
      if (callback !== undefined) { callback(err);}
    }
    else {
      console.log(chalkTwitter("LOADED CATEGORIZED USERS FROM DB"
        + " | " + results.count + " CATEGORIZED"
        + " | " + results.manual + " MAN"
        + " | " + results.auto + " AUTO"
        + " | " + results.matchRate.toFixed(2) + "% MR"
      ));

      // categorizedUsersObj[user.nodeId.toString()] = { manual: user.category, auto: user.categoryAuto };
      Object.keys(results.obj).forEach(function(nodeId){
        categorizedUserHashMap.set(nodeId, results.obj[nodeId]);
      });
      categorizedUserHashMapReadyFlag = true;
      if (callback !== undefined) { callback(err);}
    }
  });
}

function initStdIn(){

  console.log("STDIN ENABLED");

  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", function( key ){

    switch (key) {
      case "\u0003":
        process.exit();
      break;
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

function initialize(cnf, callback){

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TFE_PROCESS_NAME || "twitterFollowerExplorer";
  cnf.targetServer = process.env.TFE_UTIL_TARGET_SERVER || "http://127.0.0.1:9997/util" ;

  cnf.histogramParseDominantMin = process.env.TFE_HISTOGRAM_PARSE_DOMINANT_MIN || DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN ;
  cnf.histogramParseTotalMin = process.env.TFE_HISTOGRAM_PARSE_TOTAL_MIN || DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;

  cnf.minSuccessRate = process.env.TFE_MIN_SUCCESS_RATE || DEFAULT_MIN_SUCCESS_RATE ;
  cnf.minMatchRate = process.env.TFE_MIN_MATCH_RATE || DEFAULT_MIN_MATCH_RATE ;
  cnf.numRandomNetworks = process.env.TFE_NUM_RANDOM_NETWORKS || TFE_NUM_RANDOM_NETWORKS ;
  cnf.testMode = (process.env.TFE_TEST_MODE === "true") ? true : cnf.testMode;

  cnf.quitOnError = process.env.TFE_QUIT_ON_ERROR || false ;
  if (process.env.TFE_QUIT_ON_COMPLETE === "false") {
    cnf.quitOnComplete = false;
  }
  if (process.env.TFE_QUIT_ON_COMPLETE === "true") {
    cnf.quitOnComplete = true;
  }
  cnf.enableStdin = process.env.TFE_ENABLE_STDIN || true ;

  if (process.env.TFE_USER_DB_CRAWL && (process.env.TFE_USER_DB_CRAWL === "true")){
    cnf.userDbCrawl = true;
  }

  cnf.enableLanguageAnalysis = process.env.TFE_ENABLE_LANG_ANALYSIS || true ;
  cnf.forceLanguageAnalysis = process.env.TFE_FORCE_LANG_ANALYSIS || false ;

  console.log(chalkAlert("FORCE LANG ANALYSIS: " + cnf.forceLanguageAnalysis));

  cnf.twitterDefaultUser = process.env.TFE_TWITTER_DEFAULT_USER || TWITTER_DEFAULT_USER ;
  cnf.twitterUsers = process.env.TFE_TWITTER_USERS || [ "altthreecee02", "altthreecee01", "altthreecee00" ] ;
  cnf.statsUpdateIntervalTime = process.env.TFE_STATS_UPDATE_INTERVAL || ONE_MINUTE;

  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";
  cnf.twitterConfigFile = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE || cnf.twitterDefaultUser + ".json";

  cnf.neuralNetworkFile = defaultNeuralNetworkFile;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineArgs;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.TFE_UTIL_TARGET_SERVER !== undefined){
        console.log("LOADED TFE_UTIL_TARGET_SERVER: " + loadedConfigObj.TFE_UTIL_TARGET_SERVER);
        cnf.targetServer = loadedConfigObj.TFE_UTIL_TARGET_SERVER;
      }

      if (loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE !== undefined){
        console.log("LOADED TFE_BEST_NN_INCREMENTAL_UPDATE: " + loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE);
        cnf.bestNetworkIncrementalUpdate = loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE;
      }

      if (loadedConfigObj.TFE_TEST_MODE !== undefined){
        console.log("LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE);
        cnf.testMode = loadedConfigObj.TFE_TEST_MODE;
      }

      if (loadedConfigObj.TFE_QUIT_ON_COMPLETE !== undefined){
        console.log("LOADED TFE_QUIT_ON_COMPLETE: " + loadedConfigObj.TFE_QUIT_ON_COMPLETE);
        cnf.quitOnComplete = loadedConfigObj.TFE_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined){
        console.log("LOADED TFE_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN);
        cnf.histogramParseDominantMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
        console.log("LOADED TFE_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN);
        cnf.histogramParseTotalMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.TFE_MIN_SUCCESS_RATE !== undefined){
        console.log("LOADED TFE_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_MIN_SUCCESS_RATE);
        cnf.minSuccessRate = loadedConfigObj.TFE_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_MIN_MATCH_RATE !== undefined){
        console.log("LOADED TFE_MIN_MATCH_RATE: " + loadedConfigObj.TFE_MIN_MATCH_RATE);
        cnf.minMatchRate = loadedConfigObj.TFE_MIN_MATCH_RATE;
      }

      if (loadedConfigObj.TFE_NUM_RANDOM_NETWORKS !== undefined){
        console.log("LOADED TFE_NUM_RANDOM_NETWORKS: " + loadedConfigObj.TFE_NUM_RANDOM_NETWORKS);
        cnf.numRandomNetworks = loadedConfigObj.TFE_NUM_RANDOM_NETWORKS;
      }

      if (loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS !== undefined){
        console.log("LOADED TFE_ENABLE_LANG_ANALYSIS: " + loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS);
        cnf.enableLanguageAnalysis = loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_FORCE_LANG_ANALYSIS !== undefined){
        console.log("LOADED TFE_FORCE_LANG_ANALYSIS: " + loadedConfigObj.TFE_FORCE_LANG_ANALYSIS);
        cnf.forceLanguageAnalysis = loadedConfigObj.TFE_FORCE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_ENABLE_STDIN !== undefined){
        console.log("LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.TFE_ENABLE_STDIN;
      }

      if (loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID  !== undefined){
        console.log("LOADED TFE_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID);
        cnf.loadNeuralNetworkID = loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID;
      }

      if (loadedConfigObj.TFE_USER_DB_CRAWL !== undefined){
        console.log("LOADED TFE_USER_DB_CRAWL: " + loadedConfigObj.TFE_USER_DB_CRAWL);
        cnf.userDbCrawl = loadedConfigObj.TFE_USER_DB_CRAWL;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER !== undefined){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER));
        cnf.twitterConfigFolder = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE !== undefined){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE));
        cnf.twitterConfigFile = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE;
      }

      if (loadedConfigObj.TFE_TWITTER_USERS !== undefined){
        console.log("LOADED TFE_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TFE_TWITTER_USERS));
        cnf.twitterUsers = loadedConfigObj.TFE_TWITTER_USERS;
      }

      if (loadedConfigObj.TFE_TWITTER_DEFAULT_USER !== undefined){
        console.log("LOADED TFE_TWITTER_DEFAULT_USER: " + jsonPrint(loadedConfigObj.TFE_TWITTER_DEFAULT_USER));
        cnf.twitterDefaultUser = loadedConfigObj.TFE_TWITTER_DEFAULT_USER;
      }

      if (loadedConfigObj.TFE_KEEPALIVE_INTERVAL !== undefined) {
        console.log("LOADED TFE_KEEPALIVE_INTERVAL: " + loadedConfigObj.TFE_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.TFE_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){

        loadFile(cnf.twitterConfigFolder, cnf.twitterConfigFile, function(err, tc){
          if (err){
            console.error(chalkError("*** TWITTER YAML CONFIG LOAD ERROR"
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
      console.error("dropboxConfigFile: " + dropboxConfigFile + "\n" + jsonPrint(err));

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){
        return(callback(err, cnf));
      });
     }
  });
}

function saveNetworkHashMap(params, callback){

  const folder = (params.folder === undefined) ? localBestNetworkFolder : params.folder;
  const nnIds = bestNetworkHashMap.keys();

  console.log(chalkNetwork("UPDATING NNs IN FOLDER " + folder));

  async.eachSeries(nnIds, function(nnId, cb) {

    const networkObj = bestNetworkHashMap.get(nnId);

    console.log(chalkNetwork("SAVING NN"
      + " | " + networkObj.network.numInputs + " IN"
      + " | SR: " + networkObj.network.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.network.matchRate.toFixed(2) + "%"
      + " | OAMR: " + networkObj.network.overallMatchRate.toFixed(2) + "%"
      + " | " + networkObj.network.networkId
      + " | " + networkObj.entry.name
    ));

    const file = nnId + ".json";

    if (params.saveImmediate) {
      saveFileQueue.push({folder: folder, file: file, obj: networkObj.network });
    }
    else {
      saveCache.set(file, {folder: folder, file: file, obj: networkObj.network }, function(){});
    }

    cb();

  }, function(err){
    if (callback !== undefined) { callback(err); }
  });
}

function updateNetworkStats(params, callback) {

  updateNetworkStatsReady = false;

  const nnIds = Object.keys(params.networkStatsObj);

  async.eachSeries(nnIds, function(nnId, cb) {

    if (bestNetworkHashMap.has(nnId)) {
      let networkObj = bestNetworkHashMap.get(nnId);
      networkObj.network.matchRate = params.networkStatsObj[nnId].matchRate;
      networkObj.network.overallMatchRate = params.networkStatsObj[nnId].matchRate;
      bestNetworkHashMap.set(nnId, networkObj);
      console.log(chalkNetwork("... UPDATED NN MATCHRATE"
        + " | MR: " + networkObj.network.matchRate.toFixed(2) + "%"
        + " | " + networkObj.network.networkId
      ));
      cb();
    }
    else {
      console.log(chalkAlert("??? NETWORK NOT IN BEST NETWORK HASHMAP ???"
        + " | " + nnId
      ));
      cb();
    }

  }, function(err){

    let folder;

    if (hostname === "google"){
      folder = configuration.testMode ? "/test" : bestNetworkFolder;
    }
    else {
      folder = configuration.testMode ? "/test" : localBestNetworkFolder;
    }

    saveNetworkHashMap({folder: folder, saveImmediate: params.saveImmediate}, function(){
      updateNetworkStatsReady = true;
      if (callback !== undefined) { callback(err); }
    });
  });
}

function initRandomNetworkTreeMessageRxQueueInterval(interval, callback){

  randomNetworkTreeMessageRxQueueReadyFlag = true;

  console.log(chalkInfo("INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

  randomNetworkTreeMessageRxQueueInterval = setInterval(function () {

    if (randomNetworkTreeMessageRxQueueReadyFlag && (randomNetworkTreeMessageRxQueue.length > 0)) {

      randomNetworkTreeMessageRxQueueReadyFlag = false;

      let m = randomNetworkTreeMessageRxQueue.shift();

      let user = {};
      let hmObj = {};
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

          updateNetworkStats({networkStatsObj: m.statsObj.loadedNetworks, saveImmediate: true}, function(){
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            updateNetworkStatsReady = true;
          });

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

            hmObj = bestNetworkHashMap.get(bestRuntimeNetworkId);

            hmObj.network.matchRate = m.bestNetwork.matchRate;
            hmObj.network.overallMatchRate = m.bestNetwork.overallMatchRate;
            hmObj.network.successRate = m.bestNetwork.successRate;

            currentBestNetwork = deepcopy(hmObj.network);
            currentBestNetwork.matchRate = m.bestNetwork.matchRate;
            currentBestNetwork.overallMatchRate = m.bestNetwork.overallMatchRate;
            currentBestNetwork.successRate = m.bestNetwork.successRate;

            updateBestNetworkStats(hmObj.network);

            bestNetworkHashMap.set(bestRuntimeNetworkId, hmObj);

            if ((hostname === "google") && (prevBestNetworkId !== bestRuntimeNetworkId) && configuration.bestNetworkIncrementalUpdate) {

              prevBestNetworkId = bestRuntimeNetworkId;

              console.log(chalkNetwork("... SAVING NEW BEST NETWORK"
                + " | " + currentBestNetwork.networkId 
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

              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: currentBestNetwork }, function(){});
              saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj }, function(){});
            }

            debug(chalkAlert("NETWORK_OUTPUT"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + m.bestNetwork.networkId
              + " | SR: " + currentBestNetwork.successRate.toFixed(1) + "%"
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

            categorizedUserHashMap.set(user.nodeId, {manual: m.category, auto: m.categoryAuto});

            userDbUpdateQueue.push(user);
          }
          else {
            console.log(chalkError("*** ERROR:  NETWORK_OUTPUT | BEST NN NOT IN HASHMAP???"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + bestRuntimeNetworkId
              + " | " + m.bestNetwork.networkId
              + " | SR: " + currentBestNetwork.successRate.toFixed(1) + "%"
              + " | MR: " + m.bestNetwork.matchRate.toFixed(2) + "%"
              + " | OAMR: " + m.bestNetwork.overallMatchRate.toFixed(2) + "%"
              + " | @" + m.user.screenName
              + " | C: " + m.user.category
              + " | CA: " + m.categoryAuto
            ));
          }

          randomNetworkTreeMessageRxQueueReadyFlag = true;
          // randomNetworkTreeReadyFlag = true;
          runEnable();

        break;

        case "BEST_MATCH_RATE":

          console.log(chalkAlert("\n================================================================================================\n"
            + "*** RNT_BEST_MATCH_RATE"
            + " | " + m.networkId
            + " | IN ID: " + m.inputsId
            + " | " + m.numInputs + " IN"
            + " | SR: " + m.successRate.toFixed(2) + "%"
            + " | MR: " + m.matchRate.toFixed(2) + "%"
            + " | OAMR: " + m.overallMatchRate.toFixed(2) + "%"
            + "\n*** PREV: " + m.previousBestNetworkId
            + " | PMR: " + m.previousBestMatchRate.toFixed(2) + "%"
            + "\n================================================================================================\n"
          ));

          if (bestNetworkHashMap.has(m.networkId)) {

            hmObj = bestNetworkHashMap.get(m.networkId);
            hmObj.network.matchRate = m.matchRate;
            hmObj.network.overallMatchRate = m.overallMatchRate;

            currentBestNetwork = deepcopy(hmObj.network);
            currentBestNetwork.matchRate = m.matchRate;
            currentBestNetwork.overallMatchRate = m.overallMatchRate;

            bestNetworkHashMap.set(m.networkId, hmObj);

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

              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: currentBestNetwork }, function(){});
              saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj}, function(){});

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
            prevHmObj.network.matchRate = m.previousBestMatchRate;

            bestNetworkHashMap.set(m.previousBestNetworkId, prevHmObj);

            if (hostname === "google") {

              console.log(chalkBlue("... SAVING PREV BEST NETWORK"
                + " | " + m.previousBestMatchRate.toFixed(2) + "%"
                + " | " + m.previousBestNetworkId + ".json"
              ));

              file = m.previousBestNetworkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: prevHmObj.network }, function(){});
            }
          }

          randomNetworkTreeMessageRxQueueReadyFlag = true;
          // randomNetworkTreeReadyFlag = true;
          runEnable();
        break;

        default:
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          // randomNetworkTreeReadyFlag = true;
          console.error(chalkError("*** UNKNOWN RNT OP | " + m.op));
      }

    }
  }, interval);

  if (callback !== undefined) { callback(); }
}

function initLangAnalyzerMessageRxQueueInterval(interval, callback){

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

            if (m.error.code === 8){ // LANGUAGE QUOTA; will be automatically retried
              console.log(chalkAlert("*** LANG QUOTA ERROR ... RETRY"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function(){
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }
            else if (m.error.code === 3){ // LANGUAGE unsupported
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
              setTimeout(function(){
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }

            userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true }, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
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

              userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj){
                if (err) { 
                  console.log(chalkError("ERROR DB UPDATE USER"
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

            userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
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
          languageAnalysisReadyFlag = false;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisReadyFlag = true;
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

function initUserDbUpdateQueueInterval(interval){

  console.log(chalkBlue("INIT USER DB UPDATE QUEUE INTERVAL: " + interval));

  clearInterval(userDbUpdateQueueInterval);

  userDbUpdateQueueInterval = setInterval(function userDbUpdateQueueInterval(){

    if (userDbUpdateQueueReadyFlag && (userDbUpdateQueue.length > 0)) {

      userDbUpdateQueueReadyFlag = false;

      let user = userDbUpdateQueue.shift();

      userServer.findOneUser(user, {noInc: true, updateCountHistory: true}, function updateUserComplete(err, updatedUserObj){

        userDbUpdateQueueReadyFlag = true;

        if (err){
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

function initRandomNetworkTree(callback){

  console.log(chalkBlue("INIT RANDOM NETWORK TREE CHILD PROCESS"));

  randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`);

  randomNetworkTree.on("message", function(m){

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

  randomNetworkTree.on("error", function(err){
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeActivateQueueSize = 0;
    randomNetworkTree = null;
    console.log(chalkError("*** randomNetworkTree ERROR *** : " + err));
    console.log(chalkError("*** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "RNT", error: err }); }
  });

  randomNetworkTree.on("exit", function(err){
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeActivateQueueSize = 0;
    randomNetworkTree = null;
    console.log(chalkError("*** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "RNT", error: err }); }
  });

  randomNetworkTree.on("close", function(code){
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeActivateQueueSize = 0;
    randomNetworkTree = null;
    console.log(chalkError("*** randomNetworkTree CLOSE *** | " + code));
    if (!quitFlag) { quit({source: "RNT", code: code }); }
  });

  randomNetworkTree.send({ op: "INIT", interval: RANDOM_NETWORK_TREE_INTERVAL }, function(){
    if (callback !== undefined) { callback(); }
  });
}

function initLangAnalyzer(callback){

  console.log(chalkInfo("INIT LANGUAGE ANALYZER CHILD PROCESS"));

  langAnalyzer = cp.fork(`languageAnalyzerChild.js`);

  langAnalyzer.on("message", function(m){
    debug(chalkLog("<== LA RX"
      + " [" + langAnalyzerMessageRxQueue.length + "]"
      + " | " + m.op
    ));
    if (m.op === "LANG_TEST_FAIL") {
      console.log(chalkAlert(getTimeStamp() + " | LANG_TEST_FAIL"));
      if (m.err.code ===  8) {
        console.error(chalkAlert("LANG_TEST_FAIL"
          + " | LANGUAGE QUOTA"
          + " | " + m.err
        ));
        languageAnalysisReadyFlag = true;
        // langAnalyzerIdle = false;
      }
      else {
        console.error(chalkAlert("LANG_TEST_FAIL"
          + " | " + m.err
        ));
        quit("LANG_TEST_FAIL");
      }
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisReadyFlag = true;
      // langAnalyzerIdle = false;
      console.log(chalkTwitter(getTimeStamp() + " | LANG_TEST_PASS | LANG ANAL READY: " + languageAnalysisReadyFlag));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisReadyFlag = false;
      // langAnalyzerIdle = false;
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      // langAnalyzerIdle = true;
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
      languageAnalysisReadyFlag = false;
      // langAnalyzerIdle = false;
      langAnalyzerMessageRxQueue.push(m);
    }
  });

  langAnalyzer.on("error", function(err){
    console.log(chalkError("*** langAnalyzer ERROR ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "LA", error: err }); }
  });

  langAnalyzer.on("exit", function(err){
    console.log(chalkError("*** langAnalyzer EXIT ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "LA", error: err }); }
  });

  langAnalyzer.on("close", function(code){
    console.log(chalkError("*** langAnalyzer CLOSE *** | " + code));
    if (!quitFlag) { quit({source: "LA", code: code }); }
  });

  langAnalyzer.send({ op: "INIT", interval: LANGUAGE_ANALYZE_INTERVAL }, function(){
    if (callback !== undefined) { callback(); }
  });
}


initialize(configuration, function(err, cnf){

  if (err) {
    console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404){
      console.log("err.status: " + err.status);
      quit();
    }
  }

  configuration = deepcopy(cnf);

  console.log(chalkTwitter(configuration.processName 
    + " STARTED " + getTimeStamp() 
    // + "\n" + jsonPrint(cnf)
  ));

  initSaveFileQueue(cnf);

  if (configuration.testMode) {
    configuration.fetchCount = TEST_MODE_FETCH_COUNT;
  }

  if (configuration.loadNeuralNetworkID) {
    configuration.neuralNetworkFile = "neuralNetwork_" + configuration.loadNeuralNetworkID + ".json";
  }
  else {
    configuration.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  console.log(chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

  initProcessUserQueueInterval(PROCESS_USER_QUEUE_INTERVAL);

  initCategorizedUserHashMap();

  initUserDbUpdateQueueInterval(1);
  initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);
  initRandomNetworkTree();

  initLangAnalyzerMessageRxQueueInterval(1);
  initLangAnalyzer();

  neuralNetworkInitialized = true;

  fsm.fsm_resetEnd();

  initTwitterUsers(function initTwitterUsersCallback(e){

    if (e) {
      console.error(chalkError("*** ERROR INIT TWITTER USERS: " + e));
      return quit({source: "TFE", error: e});
    }

    console.log(chalkTwitter("TFE CHILDREN" 
      + " | " + Object.keys(tfeChildHashMap)
    ));

    initSocket(cnf, function(){});

    loadTrainingSetsDropboxFolder(defaultTrainingSetFolder, function(){

      randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap }, function(){
        console.log(chalkBlue("SEND MAX INPUTS HASHMAP"));

        setTimeout(function(){
          fsm.fsm_init();
          initFsmTickInterval(FSM_TICK_INTERVAL);
        }, 3000);
      });

    });

  });
});
