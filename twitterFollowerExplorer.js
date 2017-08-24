/*jslint node: true */
"use strict";

const TEST_MODE_FETCH_COUNT = 47;
const DEFAULT_FETCH_COUNT = 200;

let bestNetworkId = false;


const wordAssoDb = require("@threeceelabs/mongoose-twitter");
const db = wordAssoDb();

const userServer = require("@threeceelabs/user-server-controller");
// const userServer = require("../userServerController");
// const wordServer = require("@threeceelabs/word-server-controller");
const twitterTextParser = require("@threeceelabs/twitter-text-parser");

const User = require("mongoose").model("User");
const Word = require("mongoose").model("Word");

let currentBestNetwork;

const LANGUAGE_ANALYZE_INTERVAL = 1000;
const RANDOM_NETWORK_TREE_INTERVAL = 100;
const NUM_RANDOM_NETWORKS = 11;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const TWITTER_DEFAULT_USER = "altthreecee00";

const inputTypes = ["emoji", "hashtags", "mentions", "urls", "words"];
inputTypes.sort();

let inputArrays = {};

let checkRateLimitInterval;
let checkRateLimitIntervalTime = ONE_MINUTE;
let fetchTwitterFriendsIntervalTime = ONE_MINUTE;

let stdin;
let langAnalyzerIdle = false;
let abortCursor = false;
let nextUser = false;
let classifiedUserHashmapReadyFlag = false;

let neuralNetworkInitialized = false;
let currentTwitterUser ;
let currentTwitterUserIndex = 0;
let twitterUsersArray = [];

let TFE_USER_DB_CRAWL = true;

const Stately = require("stately.js");

const fsmStates = {
  "IDLE":{
    "fetchStart": "FETCH",
    "rateLimitStart": "RATE_LIMIT" 
  },
  "FETCH":{
    "reset": "IDLE",
    "fetchEnd": "IDLE", 
    "fetchUserStart": "FETCH_USER", 
    "rateLimitStart": "PAUSE_FETCH" 
  },
  "PAUSE_FETCH_LIMIT":{
    "reset": "IDLE",
    "rateLimitEnd": "FETCH"
  },
  "FETCH_USER":{
    "reset": "IDLE",
    "fetchEnd": "IDLE",
    "fetchUserEnd": "FETCH",
    "rateLimitStart": "PAUSE_FETCH_USER" 
  },
  "PAUSE_FETCH_USER":{
    "reset": "IDLE",
    "rateLimitEnd": "FETCH_USER",
    "fetchUserEnd": "FETCH",
    "fetchEnd": "IDLE"
  }
};

const fsm = Stately.machine(fsmStates);

fsm.onleaveSTATE = function (event, oldState, newState) {
  console.log("FSM"
    + " | " + event
    + " | " + oldState
    + " -> " + newState
  );
};

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tfe";
const Slack = require("slack-node");

const Dropbox = require("dropbox");
const os = require("os");
const util = require("util");
const moment = require("moment");
const arrayNormalize = require("array-normalize");
const defaults = require("object.defaults/immutable");
const pick = require("object.pick");
const omit = require("object.omit");
const deepcopy = require("deep-copy");

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

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


let statsObj = {};
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;

const TFE_RUN_ID = hostname 
  + "_" + process.pid 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

statsObj.runId = TFE_RUN_ID;

statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());

let configuration = {};
configuration.testMode = false;
configuration.fetchCount = configuration.testMode ? TEST_MODE_FETCH_COUNT :  DEFAULT_FETCH_COUNT;
configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.enableLanguageAnalysis = true;
configuration.forceLanguageAnalysis = false;
configuration.quitOnComplete = false;

const intervalometer = require("intervalometer");
let timerIntervalometer = intervalometer.timerIntervalometer;

let langAnalyzer;
let waitLanguageAnalysisReadyInterval;
let langAnalyzerMessageRxQueueInterval;
let langAnalyzerMessageRxQueueReady = true;
let languageAnalysisReadyFlag = false;
let langAnalyzerMessageRxQueue = [];

// let waitRandomNetworkTreeReadyInterval;
let randomNetworkTree;
let randomNetworkTreeMessageRxQueueInterval;
let randomNetworkTreeMessageRxQueueReady = true;
let randomNetworkTreeReadyFlag = false;
let randomNetworkTreeMessageRxQueue = [];
let randomNetworksObj = {};

let network;
const neataptic = require("neataptic");
const cp = require("child_process");

let histograms = {};
histograms.words = {};
histograms.urls = {};
histograms.hashtags = {};
histograms.mentions = {};
histograms.emoji = {};

const Twit = require("twit");
const async = require("async");
const sortOn = require("sort-on");

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkRed = chalk.red;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const EventEmitter2 = require("eventemitter2").EventEmitter2;

const debug = require("debug")("tfe");

let statsUpdateInterval;

let autoClassifiedUserHashmap = {};
let classifiedUserHashmap = {};
let twitterUserHashMap = {};

const HashMap = require("hashmap").HashMap;

let bestNetworkHashMap = new HashMap();

let defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;

function indexOfMax (arr, callback) {
  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return -1;
  }
  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("indexOfMax: ALL EQUAL: " + arr[0]));
    return -1;
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
    cb();
  }, function(){
    debug(chalk.blue("indexOfMax: " + maxIndex 
      + " | " + arr[maxIndex].toFixed(2)
      + " | " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2)
    ));
    callback(maxIndex) ; 
  });
}

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

const USER_ID = "TFE_" + TFE_RUN_ID;
const SCREEN_NAME = "TFE_" + TFE_RUN_ID;

let serverUserObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  screenName: SCREEN_NAME, 
  type: "UTIL", 
  mode: "MUXSTREAM",
  tags: {}
} ;

serverUserObj.tags.entity = "muxstream_" + TFE_RUN_ID;
serverUserObj.tags.mode = "muxed";
serverUserObj.tags.channel = "twitter";

const cla = require("command-line-args");
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const userDbCrawl = { name: "userDbCrawl", alias: "C", type: Boolean, defaultValue: false};
const testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false};
const loadNeuralNetworkID = { name: "loadNeuralNetworkID", alias: "N", type: Number };

const optionDefinitions = [enableStdin, quitOnError, loadNeuralNetworkID, userDbCrawl, testMode];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

process.title = "twitterFollowerExplorer";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");


let fetchTwitterFriendsIntervalometer;

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(langAnalyzerMessageRxQueueInterval);
    clearInterval(checkRateLimitInterval);
    clearInterval(statsUpdateInterval);

    clearInterval(waitLanguageAnalysisReadyInterval);

    fetchTwitterFriendsIntervalometer.stop();

    setTimeout(function() {
      console.log("QUITTING twitterFollowerExplorer");
      process.exit(0);
    }, 300);

  }
});

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20
});

configEvents.on("newListener", function(data){
  console.log("*** NEW CONFIG EVENT LISTENER: " + data);
});

statsObj.network = {};
statsObj.network.networkId = "";
statsObj.network.successRate = 0;

statsObj.classification = {};
statsObj.classification.auto = {};
statsObj.classification.manual = {};

statsObj.classification.manual.left = 0;
statsObj.classification.manual.right = 0;
statsObj.classification.manual.positive = 0;
statsObj.classification.manual.negative = 0;
statsObj.classification.manual.neutral = 0;
statsObj.classification.manual.other = 0;
statsObj.classification.manual.none = 0;

statsObj.classification.auto.left = 0;
statsObj.classification.auto.right = 0;
statsObj.classification.auto.positive = 0;
statsObj.classification.auto.negative = 0;
statsObj.classification.auto.neutral = 0;
statsObj.classification.auto.other = 0;
statsObj.classification.auto.none = 0;

statsObj.users = {};
statsObj.users.classifiedAuto = 0;
statsObj.users.classified = 0;
// statsObj.users.percentFetched = 0;
statsObj.users.grandTotalFriendsFetched = 0;

statsObj.user = {};
statsObj.user.ninjathreecee = {};
statsObj.user.altthreecee00 = {};

statsObj.analyzer = {};
statsObj.analyzer.total = 0;
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.errors = 0;

statsObj.totalTwitterFriends = 0;

statsObj.twitterErrors = 0;


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

console.log("DROPBOX_TFE_CONFIG_FILE: " + DROPBOX_TFE_CONFIG_FILE);
console.log("DROPBOX_TFE_STATS_FILE : " + DROPBOX_TFE_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

const defaultClassifiedUsersFolder = dropboxConfigDefaultFolder;
const classifiedUsersFolder = dropboxConfigHostFolder + "/classifiedUsers";
const classifiedUsersDefaultFile = "classifiedUsers.json";

function showStats(options){
  if (langAnalyzer !== undefined) {
    langAnalyzer.send({op: "STATS", options: options});
  }
  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));

    async.each(Object.keys(histograms), function(histogramName, cb) {

      const currentHistogram = histograms[histogramName];

      const keys = Object.keys(currentHistogram);

      const sortedKeys = keys.sort(function(a,b){
        const valA = currentHistogram[a];
        const valB = currentHistogram[b];
        return valB - valA;
      });

      console.log(chalkInfo("\nHIST " + histogramName.toUpperCase()
        + " | " + keys.length + " ----------"
      ));
      sortedKeys.forEach(function(k, i){
        if ((keys.length < 20) || (currentHistogram[k] >= 10) || (i<20)) { 
          console.log(currentHistogram[k] + " | " + k);
        }
      });

      cb();

    });
  }
  else {
    if (statsObj.user !== undefined) {
      console.log(chalkLog("- FE S"
        + " | " + currentTwitterUser
        + " | E: " + statsObj.elapsed
        + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
        + " | ACL Us: " + Object.keys(autoClassifiedUserHashmap).length
        + " | CL Us: " + Object.keys(classifiedUserHashmap).length
        + " | NN " + statsObj.network.networkId
        + " - " + statsObj.network.successRate.toFixed(2) + "%"
        + " || " + statsObj.analyzer.analyzed + " ANLs"
        + " | " + statsObj.analyzer.skipped + " SKPs"
        + " | " + statsObj.analyzer.total + " TOT"
      ));
    }
    else {
      console.log(chalkLog("- FE S"
        + " | START: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
        + " | ELAPSED: " + statsObj.elapsed
      ));
    }
  }
}

function quit(){
  console.log( "\n... QUITTING ..." );
  showStats(true);
  process.exit();
}

process.on( "SIGINT", function() {
  quit("SIGINT");
});

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
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

function saveFile (params, callback){

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
        if (callback !== undefined) { callback(error.error_summary); }
      }
      else if (error.status === 429){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error.error_summary); }
      }
      else if (error.status === 500){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error.error_summary); }
      }
      else {
        // const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR\n" + jsonPrint(error)
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

      async.each(response.entries, function(entry, cb){

        console.log(chalkInfo("DROPBOX FILE"
          + " | " + params.folder
          + " | " + getTimeStamp(entry.client_modified)
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
      console.log(chalkError("saveFile *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function loadFile(path, file, callback) {

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  dropboxClient.filesDownload({path: fullPath})
    .then(function(data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
      ));

      let payload = data.fileBinary;
      debug(payload);

      if (file.match(/\.json$/gi)) {
        let fileObj = JSON.parse(payload);
        callback(null, fileObj);
      }
      else {
        callback(null, payload);
      }
    })
    .catch(function(error) {
      console.log(chalkError("DROPBOX loadFile ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("!!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError(jsonPrint(error)));

      if (error.status === 404) {
        console.error(chalkError("!!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 0) {
        console.error(chalkError("!!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
}

function saveFileRetry (timeout, path, file, jsonObj, callback){
  setTimeout(function(){
    console.log(chalkError("SAVE RETRY | TIMEOUT: " + timeout + " | " + path + "/" + file));
    saveFile({folder:path, file:file, obj:jsonObj}, function(err){
      if (err) {
        console.log(chalkError("SAVE RETRY ON ERROR: " + path + "/" + file));
        saveFileRetry(timeout, path, file, jsonObj);
      }
    });
  }, timeout);
  if (callback !== undefined) { callback(); }
}

function initStatsUpdate(callback){

  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  saveFile({folder: statsFolder, file: statsFile, obj: statsObj});

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    saveFile({folder:classifiedUsersFolder, file:classifiedUsersDefaultFile, obj:classifiedUserHashmap}, function(err){
      if (err) {
        console.log(chalkError("SAVE RETRY ON ERROR: " + classifiedUsersFolder + "/" + classifiedUsersDefaultFile));
        saveFileRetry(5000, classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap);
      }
      else if (classifiedUserHashmapReadyFlag && (hostname === "google")) { // SAVE DEFAULT CLASSIFIED USERS IF GOOGLE HOST
        saveFile({folder:defaultClassifiedUsersFolder, file:classifiedUsersDefaultFile, obj:classifiedUserHashmap}, function(err){
          if (err) {
            console.log(chalkError("SAVE RETRY ON ERROR: " + classifiedUsersFolder + "/" + classifiedUsersDefaultFile));
            saveFileRetry(5000, defaultClassifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap);
          }
        });
      }
    });

    saveFile({folder: statsFolder, file: statsFile, obj: statsObj});
    showStats();

    if (configuration.quitOnComplete && langAnalyzerIdle && !statsObj.user[currentTwitterUser].nextCursorValid) {
      console.log(chalkTwitterBold(moment().format(compactDateTimeFormat)
        + " | QUITTING ON COMPLETE"
      ));

      fetchTwitterFriendsIntervalometer.stop();

      // clearInterval(waitRandomNetworkTreeReadyInterval);
      clearInterval(waitLanguageAnalysisReadyInterval);
      clearInterval(statsUpdateInterval);

      saveFile({folder:classifiedUsersFolder, file:classifiedUsersDefaultFile, obj:classifiedUserHashmap}, function(err){
        if (err) {
          console.log(chalkError("SAVE RETRY ON ERROR: " + classifiedUsersFolder + "/" + classifiedUsersDefaultFile));
          saveFileRetry(5000, classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap);
          setTimeout(function(){
            quit("QUIT ON COMPLETE");
          }, 10000);
        }
        else {
          setTimeout(function(){
            quit("QUIT ON COMPLETE");
          }, 2000);
        }
       });

    }

  }, configuration.statsUpdateIntervalTime);

  callback(null);
}

function checkRateLimit(callback){

  if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
    && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){

    statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
  // 
    console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
      + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
      + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
      + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
      // + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
      + " | NOW: " + moment().format(compactDateTimeFormat)
      // + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
    ));
  }

  twitterUserHashMap[currentTwitterUser].twit.get(
    "application/rate_limit_status", 
    function(err, data, response) {

    debug("application/rate_limit_status response: " + jsonPrint(response));
    
    if (err){
      console.error("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() + "\n" + JSON.stringify(err, null, 3));
      statsObj.twitterErrors+= 1;

      if (callback !== undefined) { callback(err, null); }
    }
    else {
      debug(chalkTwitter("\n-------------------------------------\nTWITTER RATE LIMIT STATUS\n" 
        + JSON.stringify(data, null, 3)
      ));

      statsObj.user[currentTwitterUser].twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      console.log(chalkInfo("TWITTER RATE LIMIT STATUS"
        + " | " + getTimeStamp()
        + " | LIMIT " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REMAINING " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | RESET " + getTimeStamp(statsObj.user[currentTwitterUser].twitterRateLimitResetAt)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        // application/rate_limit_status
        // + "\n" + jsonPrint(data)
      ));

      if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
        && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){


        fsm.rateLimitEnd();
        statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
      // 
        console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
          // + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          // + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        ));
      }
      else if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag){

        console.log(chalkAlert("*** TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
          + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        ));
      }
      else {
        debug(chalkInfo("... NO TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          // + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
          + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        ));
      }

      if (callback !== undefined) { callback(); }
    }
  });
}

function printTwitterUser(user){
  let threeceeFollowingText = "";
  if (user.threeceeFollowing) {
    threeceeFollowingText = user.threeceeFollowing.screenName;
  }
  console.log(chalkTwitter("TWITTER USER\n==================="
    + "\nID:         " + user.userId 
    + "\nNAME:       " + user.name 
    + "\nSCREENNAME: @" + user.screenName 
    + "\nDESC:       " + user.description 
    + "\nURL:        " + user.url 
    + "\n3CFLW:      " + threeceeFollowingText
    + "\nTWEETS:     " + user.statusesCount 
    + "\nFRIENDS:    " + user.friendsCount 
    + "\nFOLLOWERS:  " + user.followersCount 
  ));
}

function twitterUserUpdate(userScreenName, callback){

  twitterUserHashMap[userScreenName].twit.get("users/show", {screen_name: userScreenName}, function(err, userShowData, response) {
    if (err){
      console.log("!!!!! TWITTER SHOW USER ERROR | @" + userScreenName + " | " + getTimeStamp() 
        + "\n" + jsonPrint(err));
      return(callback(err));
    }

    debug(chalkTwitter("TWITTER USER DATA\n" + jsonPrint(userShowData)));
    debug(chalkTwitter("TWITTER USER RESPONSE\n" + jsonPrint(response)));

    statsObj.user[userScreenName] = {};

    statsObj.user[userScreenName].id = userShowData.id_str;
    statsObj.user[userScreenName].name = userShowData.name;
    statsObj.user[userScreenName].screenName = userShowData.screen_name.toLowerCase();
    statsObj.user[userScreenName].description = userShowData.description;
    statsObj.user[userScreenName].url = userShowData.url;
    statsObj.user[userScreenName].statusesCount = userShowData.statuses_count;
    statsObj.user[userScreenName].friendsCount = userShowData.friends_count;
    statsObj.user[userScreenName].followersCount = userShowData.followers_count;

    statsObj.user[userScreenName].totalFriendsFetched = 0;
    statsObj.user[userScreenName].endFetch = false;
    statsObj.user[userScreenName].count = configuration.fetchCount;
    statsObj.user[userScreenName].nextCursor = false;
    statsObj.user[userScreenName].nextCursorValid = false;
    statsObj.user[userScreenName].twitterRateLimit = 0;
    statsObj.user[userScreenName].twitterRateLimitExceptionFlag = false;
    statsObj.user[userScreenName].twitterRateLimitRemaining = 0;
    statsObj.user[userScreenName].twitterRateLimitResetAt = moment();
    statsObj.user[userScreenName].twitterRateLimitRemainingTime = 0;

    console.log(chalkTwitterBold("TWITTER USER\n========================="
      + "\nID:        " + statsObj.user[userScreenName].id 
      + "\n           " + statsObj.user[userScreenName].name 
      + "\n          @" + statsObj.user[userScreenName].screenName 
      + "\n           " + statsObj.user[userScreenName].description 
      + "\n           " + statsObj.user[userScreenName].url 
      + "\nTWEETS:    " + statsObj.user[userScreenName].statusesCount 
      + "\nFOLLOWING: " + statsObj.user[userScreenName].friendsCount 
      + "\nFOLLOWERS: " + statsObj.user[userScreenName].followersCount 
    ));

    callback(null);
  });
}

function initTwitter(currentTwitterUser, callback){

  console.log(chalkInfo("INIT TWITTER: " + currentTwitterUser));

  let twitterConfigFile =  currentTwitterUser + ".json";

  loadFile(configuration.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + configuration.twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      callback(err);
    }
    else {
      console.log(chalkTwitter("LOADED TWITTER CONFIG"
        + " | " + twitterConfigFile
        // + "\n" + jsonPrint(twitterConfig)
      ));

      const newTwit = new Twit({
        consumer_key: twitterConfig.CONSUMER_KEY,
        consumer_secret: twitterConfig.CONSUMER_SECRET,
        access_token: twitterConfig.TOKEN,
        access_token_secret: twitterConfig.TOKEN_SECRET
      });

      const newTwitStream = newTwit.stream("user", { stringify_friend_ids: true });

      newTwitStream.on("follow", function(followMessage){
        console.log(chalkAlert("USER " + currentTwitterUser + " FOLLOW"
          + " | " +  followMessage.target.id_str
          + " | " +  followMessage.target.screen_name.toLowerCase()
        ));

        User.findOne({userId: followMessage.target.id_str}, function(err, dbUser){

          if (err) {
            console.error(chalkError("INIT TWITTER USER FIND ERROR\n" + jsonPrint(err)));
          }
          else if (dbUser){
            console.log("** DB USER HIT **");

            printTwitterUser(dbUser);

            if (dbUser.threeceeFollowing 
              && (dbUser.threeceeFollowing.screenName !== undefined)
              && dbUser.threeceeFollowing.screenName) {
              if (currentTwitterUser.toLowerCase() !== dbUser.threeceeFollowing.screenName.toLowerCase()){
                console.log(chalkAlert("*** USER ALREADY FOLLOWED"
                  + " | CURRENT USER: " + currentTwitterUser
                  + " | THREECEE FLW: " + dbUser.threeceeFollowing.screenName
                ));
              }
            }
          }

        });
      });

      async.waterfall([

        function initTwit(cb) {

          newTwit.get("account/settings", function(err, accountSettings, response) {
            if (err){
              console.log("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() + "\n" + jsonPrint(err));
              return(cb(err, null));
            }

            debug(chalkTwitter("TWITTER ACCOUNT SETTINGS RESPONSE\n" + jsonPrint(response)));

            const userScreenName = accountSettings.screen_name.toLowerCase();
            twitterUserHashMap[userScreenName].twit = {};
            twitterUserHashMap[userScreenName].twit = newTwit;

            console.log(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: " + userScreenName));
            debug(chalkTwitter("TWITTER ACCOUNT SETTINGS\n" + jsonPrint(accountSettings)));

            twitterUserUpdate(userScreenName, function(err){
             if (err){
                console.log("!!!!! TWITTER SHOW USER ERROR | @" + userScreenName + " | " + getTimeStamp() 
                  + "\n" + jsonPrint(err));
                return(cb(err, null));
              }
              cb(null, { screenName: userScreenName, twit: newTwit});
            });
          });
        },

        function initTwitStream(twitObj, cb){

          twitterUserHashMap[twitObj.screenName].twitStream = {};
          twitterUserHashMap[twitObj.screenName].twitStream = newTwitStream;

          cb(null, {twit: twitObj.twit, twitStream: newTwitStream});
        }

      ], function (err, results) {
        debug("results\n" + results);
        callback(err);
      });

    }

  });
}

function initTwitterUsers(callback){

  if (!configuration.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    if (callback !== undefined) {callback(null, null);}
  }
  else {

    let twitterDefaultUser = configuration.twitterDefaultUser;
    // twitterUsersArray = Object.keys(configuration.twitterUsers);
    // "altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee"
    twitterUsersArray = ["ninjathreecee", "altthreecee00"];

    console.log(chalkTwitter("USERS"
      + " | FOUND: " + twitterUsersArray.length
    ));

    async.each(twitterUsersArray, function(userId, cb){

      userId = userId.toLowerCase();

      let twitterUserObj = {};

      console.log("userId: " + userId);
      console.log("screenName: " + configuration.twitterUsers[userId]);

      twitterUserObj.isDefault = (twitterDefaultUser === userId) || false;
      twitterUserObj.userId = userId ;
      twitterUserObj.screenName = configuration.twitterUsers[userId] ;

      twitterUserHashMap[userId] = {};
      twitterUserHashMap[userId].userInfo = {};
      twitterUserHashMap[userId].friends = {};
      twitterUserHashMap[userId].userInfo = twitterUserObj;


      initTwitter(userId, function(err, twitObj){
        if (err) {
          console.log(chalkError("INIT TWITTER ERROR\n" + jsonPrint(err)));
          return(cb(err));
        }

        debug("INIT TWITTER twitObj\n" + jsonPrint(twitObj));

        console.log(chalkTwitter("ADDED TWITTER USER"
          + " | NAME: " + userId
          + " | FEED ID: " + twitterUserHashMap[userId].userInfo.userId
          + " | DEFAULT USER: " + twitterUserHashMap[userId].userInfo.isDefault
        ));

        cb();

      });

    }, function(err){
      console.log(chalkTwitter("\nADD TWITTER USERS COMPLETE\n"));
      if (callback !== undefined) { callback(err); }
    });

  }
}

function initClassifiedUserHashmap(folder, file, callback){

  console.log(chalkTwitter("INIT CLASSIFED USERS HASHMAP FROM DB"));

  loadFile(folder, file, function(err, dropboxClassifiedUsersObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkTwitter("LOADED CLASSIFED USERS FILE: " + folder + "/" + file));
      console.log(chalkTwitter("DROPBOX DEFAULT | " + Object.keys(dropboxClassifiedUsersObj).length + " CLASSIFED USERS"));

      const params = { auto: false };

      userServer.findClassifiedUsersCursor(params, function(err, results){
        if (err) {
          console.error(chalkError("ERROR: initClassifiedUserHashmap: "));
          callback(err, null);
        }
        else {
            // obj: classifiedUsersObj, 
            // count: classifiedUsersCount, 
            // matchRate: matchRate, 
            // manual: classifiedUsersManualCount, 
            // auto: classifiedUsersAutoCount
          console.log(chalkTwitter("LOADED CLASSIFED USERS FROM DB"
            + " | " + results.count + " CLASSIFED"
            + " | " + results.manual + " MAN"
            + " | " + results.auto + " AUTO"
            + " | " + results.matchRate.toFixed(1) + "% MATCH"
          ));

          const classifiedUsersObj = defaults(dropboxClassifiedUsersObj, results.obj);

          callback(null, classifiedUsersObj);
        }
      });

      // callback(null, classifiedUsersObj);
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
      case "n":
        nextUser = true;
        console.log(chalkAlert("NEXT USER: " + nextUser));
      break;
      case "q":
      case "Q":
        quit();
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

  initClassifiedUserHashmap(defaultClassifiedUsersFolder, classifiedUsersDefaultFile, function(err, classifiedUsersObj){
    if (err) {
      console.error(chalkError("*** ERROR: CLASSIFED USER HASHMAP NOT INITIALIED: ", err));
    }
    else {
      classifiedUserHashmap = classifiedUsersObj;
      console.log(chalkTwitterBold("LOADED " + Object.keys(classifiedUserHashmap).length + " TOTAL CLASSIFED USERS"));
      classifiedUserHashmapReadyFlag = true;
    }
  });

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TFE_PROCESS_NAME || "twitterFollowerExplorer";

  cnf.testMode = (process.env.TFE_TEST_MODE === "true") ? true : cnf.testMode;
  cnf.quitOnError = process.env.TFE_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TFE_ENABLE_STDIN || true ;
  cnf.userDbCrawl = process.env.TFE_USER_DB_CRAWL || TFE_USER_DB_CRAWL ;

  cnf.enableLanguageAnalysis = process.env.TFE_ENABLE_LANG_ANALYSIS || true ;
  cnf.forceLanguageAnalysis = process.env.TFE_FORCE_LANG_ANALYSIS || false ;

  console.log(chalkAlert("FORCE LANG ANALYSIS: " + cnf.forceLanguageAnalysis));


  cnf.twitterDefaultUser = process.env.TFE_TWITTER_DEFAULT_USER || TWITTER_DEFAULT_USER ;
  cnf.twitterUsers = process.env.TFE_TWITTER_USERS || { "altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee" } ;
  cnf.statsUpdateIntervalTime = process.env.TFE_STATS_UPDATE_INTERVAL || ONE_MINUTE;

  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";
  cnf.twitterConfigFile = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE || cnf.twitterDefaultUser + ".json";

  cnf.neuralNetworkFile = defaultNeuralNetworkFile;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineArgs;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.TFE_TEST_MODE !== undefined){
        console.log("LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE);
        cnf.testMode = loadedConfigObj.TFE_TEST_MODE;
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

      console.log(chalkLog("USER\n" + jsonPrint(serverUserObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){

        loadFile(cnf.twitterConfigFolder, cnf.twitterConfigFile, function(err, tc){
          if (err){
            console.error(chalkError("*** TWITTER YAML CONFIG LOAD ERROR\n" + err));
            quit();
            return;
          }

          cnf.twitterConfig = {};
          cnf.twitterConfig = tc;

          console.log(chalkInfo(getTimeStamp() + " | TWITTER CONFIG FILE " 
            + cnf.twitterConfigFolder
            + cnf.twitterConfigFile
          ));

          // initInputArrays(function(err){
            return(callback(err, cnf));
          // });

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

      console.log(chalkLog("USER\n" + jsonPrint(serverUserObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){
        // initInputArrays(function(err){
          return(callback(err, cnf));
        // });
      });
     }
  });
}

function initCheckRateLimitInterval(interval){

  console.log(chalkInfo("INIT CHECK RATE INTERVAL | " + interval));

  checkRateLimitInterval = setInterval(function(){

    if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
      checkRateLimit();
    }

  }, interval);
}

function initRandomNetworkTreeMessageRxQueueInterval(interval, callback){

  randomNetworkTreeMessageRxQueueReady = true;

  console.log(chalkInfo("INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

  randomNetworkTreeMessageRxQueueInterval = setInterval(function () {

    if (randomNetworkTreeMessageRxQueueReady && (randomNetworkTreeMessageRxQueue.length > 0)) {

      randomNetworkTreeMessageRxQueueReady = false;

      let m = randomNetworkTreeMessageRxQueue.shift();

      switch (m.op) {

        case "NETWORK_RESULTS":

          console.log(chalkLog("M<"
            + " [Q: " + randomNetworkTreeMessageRxQueue.length
            + " | OP: " + m.op
            + " | OUTPUT: " + m.networkOutput
          ));

        break;

        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + randomNetworkTreeMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          randomNetworkTreeReadyFlag = false;
          randomNetworkTreeMessageRxQueueReady = true;
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + randomNetworkTreeMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          randomNetworkTreeReadyFlag = true;
          randomNetworkTreeMessageRxQueueReady = true;
        break;

        default:
          console.log(chalkError("??? UNKNOWN RANDOM NETWORK TREE OP: " + m.op));
          randomNetworkTreeMessageRxQueueReady = true;
      }
    }
  }, interval);

  if (callback !== undefined) { callback(); }
}

function initLangAnalyzerMessageRxQueueInterval(interval, callback){

  langAnalyzerMessageRxQueueReady = true;

  console.log(chalkInfo("INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));

  let langEntityKeys = [];

  langAnalyzerMessageRxQueueInterval = setInterval(function () {

    if (langAnalyzerMessageRxQueueReady && (langAnalyzerMessageRxQueue.length > 0)) {

      langAnalyzerMessageRxQueueReady = false;

      let m = langAnalyzerMessageRxQueue.shift();

      // let params = {
      //   noInc: true
      // };

      langEntityKeys.length = 0;

      switch (m.op) {

        case "LANG_RESULTS":

          // languageAnalysisReadyFlag = true;

          if (m.results.entities !== undefined) {
            langEntityKeys = Object.keys(m.results.entities);
          }

          console.log(chalkLog("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length
            + " | STATS: " + m.stats.analyzer.analyzed + " ANLZD"
            + " " + m.stats.analyzer.skipped + " SKP"
            + " " + m.stats.analyzer.total + " TOT ]"
            + " | OP: " + m.op
            + " | UID: " + m.obj.userId
            + " | SN: " + m.obj.screenName
            + " | N: " + m.obj.name
            // + " | KWs: " + Object.keys(m.obj.keywords)
            + " | ENTs: " + langEntityKeys.length
            // + "\nENTITIES\n" + jsonPrint(m.results.entities)
          ));

          m.obj.languageAnalyzed = true;

          if (m.error) {

            // console.error(chalkError("*** LANG ERROR" + jsonPrint(m.error)));

            m.obj.languageAnalysis = {err: m.error};

            // if ((m.error.code === 3) || (m.error.code === 8)){ // LANGUAGE QUOTA; will be automatically retried
            if (m.error.code === 8){ // LANGUAGE QUOTA; will be automatically retried
              console.log(chalkAlert("*** LANG ERROR ... RETRY"
                + " | " + m.obj.userId
                + " | " + m.obj.userId
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function(){
                langAnalyzerMessageRxQueueReady = true;
              }, 1000);

            }
          // else {

            console.log(chalkError("*** LANG ERROR"
              + " | " + m.obj.userId
              + " | @" + m.obj.screenName
              + " | CODE: " + m.error.code
            ));

            // m.obj.languageAnalyzed = true;

            userServer.findOneUser(m.obj, {noInc: true}, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                let laEnts = 0;
                if (updatedUserObj.languageAnalysis.entities !== undefined) {
                  laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                }
                const kws = (updatedUserObj.keywords && (updatedUserObj.keywords !== undefined)) 
                  ? Object.keys(updatedUserObj.keywords) : [];
                const kwsAuto = (updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined)) 
                  ? Object.keys(updatedUserObj.keywordsAuto) : [];

                let threeceeFollowing = false;
                if (updatedUserObj.threeceeFollowing){
                  threeceeFollowing = (updatedUserObj.threeceeFollowing.screenName === undefined) ? false : updatedUserObj.threeceeFollowing.screenName ;
                }

                console.log(chalkLog("USER>DB"
                  + " | " + updatedUserObj.userId
                  // + " | NID: " + updatedUserObj.nodeId
                  + " | @" + updatedUserObj.screenName
                  + " | " + updatedUserObj.name
                  + " | Ts: " + updatedUserObj.statusesCount
                  + " | FLs: " + updatedUserObj.followersCount
                  + " | FRs: " + updatedUserObj.friendsCount
                  + " | 3CF: " + threeceeFollowing
                  + " | KWs: " + kws
                  + " | KWA: " + kwsAuto
                  + " | LA: " + updatedUserObj.languageAnalyzed
                  + "\nLA Es: " + laEnts
                ));
              }
              langAnalyzerMessageRxQueueReady = true;
            }); 
          // }
          }
          else if (langEntityKeys.length > 0) {

            console.log(chalkLog("LANG ENTS: " + langEntityKeys.length));

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

              userServer.findOneUser(m.obj, {noInc: true}, function(err, updatedUserObj){
                if (err) { 
                  console.log(chalkError("ERROR DB UPDATE USER"
                    + "\n" + err
                    + "\n" + jsonPrint(m.obj)
                  ));
                }
                else {
                  let laEnts = 0;
                  if (updatedUserObj.languageAnalysis.entities !== undefined) {
                    laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                  }
                  const kws = (updatedUserObj.keywords && (updatedUserObj.keywords !== undefined)) 
                    ? Object.keys(updatedUserObj.keywords) : [];
                  const kwsAuto = (updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined))
                    ? Object.keys(updatedUserObj.keywordsAuto) : [];

                  let threeceeFollowing = false;
                  if (updatedUserObj.threeceeFollowing){
                    threeceeFollowing = (updatedUserObj.threeceeFollowing.screenName === undefined) ? false : updatedUserObj.threeceeFollowing.screenName ;
                  }

                  console.log(chalkLog("USER>DB"
                    + " | " + updatedUserObj.userId
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | 3CF: " + threeceeFollowing
                    + " | KWs: " + kws
                    + " | KWA: " + kwsAuto
                    + " | LA: " + updatedUserObj.languageAnalyzed
                    + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                    + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                    + "\nLA Es: " + laEnts
                  ));
                }

                langAnalyzerMessageRxQueueReady = true;
              }); 
            });
          }
          else {

            console.log(chalkLog("LANG ENTS: " + langEntityKeys.length));

            m.obj.languageAnalysis = m.results;
            m.obj.languageAnalyzed = true;

            userServer.findOneUser(m.obj, {noInc: true}, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                let laEnts = 0;
                if (updatedUserObj.languageAnalysis.entities !== undefined) {
                  laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                }
                const kws = (updatedUserObj.keywords && (updatedUserObj.keywords !== undefined)) 
                  ? Object.keys(updatedUserObj.keywords) : [];
                const kwsAuto = (updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined))
                  ? Object.keys(updatedUserObj.keywordsAuto) : [];

                let threeceeFollowing = false;
                if (updatedUserObj.threeceeFollowing){
                  threeceeFollowing = (updatedUserObj.threeceeFollowing.screenName === undefined) ? false : updatedUserObj.threeceeFollowing.screenName ;
                }

                console.log(chalkLog("USER>DB"
                  + " | " + updatedUserObj.userId
                  + " | @" + updatedUserObj.screenName
                  + " | " + updatedUserObj.name
                  + " | Ts: " + updatedUserObj.statusesCount
                  + " | FLs: " + updatedUserObj.followersCount
                  + " | FRs: " + updatedUserObj.friendsCount
                  + " | 3CF: " + threeceeFollowing
                  + " | KWs: " + kws
                  + " | KWA: " + kwsAuto
                  + " | LA: " + updatedUserObj.languageAnalyzed
                  + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                  + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                  + "\nLA Es: " + laEnts
                ));
              }
              langAnalyzerMessageRxQueueReady = true;
            }); 
          }
        break;

        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisReadyFlag = false;
          langAnalyzerMessageRxQueueReady = true;
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisReadyFlag = true;
          langAnalyzerMessageRxQueueReady = true;
        break;

        default:
          console.log(chalkError("??? UNKNOWN LANG_ANALIZE OP: " + m.op
          ));
          langAnalyzerMessageRxQueueReady = true;
      }
    }
  }, interval);

  if (callback !== undefined) { callback(); }
}

function getUserKeyword(keywords, callback) {

  let keyword = false;

  const keys = Object.keys(keywords);

  if (keys.length === 0 ) { 
    callback(null, false);
  }

  async.each(keys, function(kw, cb){
    switch (kw) {
      case "left":
      case "right":
      case "neutral":
      case "positive":
      case "negative":
        keyword = kw;
        async.setImmediate(function() {
          cb();
        });
      break;
      default:
        async.setImmediate(function() {
          cb();
        });
    }
  }, function(err){
    callback(err, keyword);
  });

}

function classifyUser(user){

  debug(chalkAlert("classifyUser KWs\n" + jsonPrint(user.get("keywords"))));
  debug(chalkAlert("classifyUser AKWs\n" + jsonPrint(user.get("keywordsAuto"))));

  return new Promise(function(resolve) {

    statsObj.analyzer.total += 1;

    let chalkAutoCurrent = chalkLog;

    let classManualText = " ";
    let classAutoText = " ";

    async.parallel({

      keywords: function(cb){
        if (user.keywords) {

          debug("KWS\n" + jsonPrint(user.get("keywords")));
          
          classifiedUserHashmap[user.userId] = {};
          classifiedUserHashmap[user.userId] = user.keywords;

          statsObj.users.classified = Object.keys(classifiedUserHashmap).length;

          const mkwObj = user.get("keywords");
          getUserKeyword(mkwObj, function(err, mkw){
            switch (mkw) {
              case "right":
                classManualText = "R";
                statsObj.classification.manual.right += 1;
              break;
              case "left":
                classManualText = "L";
                statsObj.classification.manual.left += 1;
              break;
              case "neutral":
                classManualText = "N";
                statsObj.classification.manual.neutral += 1;
              break;
              case "positive":
                classManualText = "+";
                statsObj.classification.manual.positive += 1;
              break;
              case "negative":
                classManualText = "-";
                statsObj.classification.manual.negative += 1;
              break;
              case false:
                classManualText = " ";
                statsObj.classification.manual.none += 1;
              break;
              default:
                classManualText = mkw;
                chalkAutoCurrent = chalk.black;
                statsObj.classification.manual.other += 1;
            }
            cb();
          });

        }
        else {
          cb();
        }
      },

      keywordsAuto: function(cb){

        if (user.keywordsAuto) {

          debug("KWSA\n" + jsonPrint(user.get("keywordsAuto")));

          autoClassifiedUserHashmap[user.userId] = {};
          autoClassifiedUserHashmap[user.userId] = user.keywordsAuto;

          statsObj.users.classifiedAuto = Object.keys(autoClassifiedUserHashmap).length;

          const akwObj = user.get("keywordsAuto");

          getUserKeyword(akwObj, function(err, akw){
            switch (akw) {
              case "right":
                classAutoText = "R";
                chalkAutoCurrent = chalk.yellow;
                statsObj.classification.auto.right += 1;
              break;
              case "left":
                classAutoText = "L";
                chalkAutoCurrent = chalk.blue;
                statsObj.classification.auto.left += 1;
              break;
              case "neutral":
                classAutoText = "N";
                chalkAutoCurrent = chalk.black;
                statsObj.classification.auto.neutral += 1;
              break;
              case "positive":
                classAutoText = "+";
                chalkAutoCurrent = chalk.green;
                statsObj.classification.auto.positive += 1;
              break;
              case "negative":
                classAutoText = "-";
                chalkAutoCurrent = chalk.bold.yellow;
                statsObj.classification.auto.negative += 1;
              break;
              case false:
                classAutoText = " ";
                chalkAutoCurrent = chalk.black;
                statsObj.classification.auto.none += 1;
              break;
              default:
                classAutoText = akw;
                chalkAutoCurrent = chalk.black;
                statsObj.classification.auto.other += 1;
            }
            cb();
          });
        }
        else {
          cb();
        }
      }
    }, function(){

      console.log(chalkAutoCurrent("> USR KWs"
        + " | MKW: " + classManualText
        + " | AKW: " + classAutoText
        + " [ TOT M: " + Object.keys(classifiedUserHashmap).length + "]"
        + " [ TOT A: " + Object.keys(autoClassifiedUserHashmap).length + "]"
        + " | " + user.userId
        + " | " + user.screenName
        + " | " + user.name
        + " | Ts: " + user.statusesCount
        + " | FLWRs: " + user.followersCount
        + " | FRNDs: " + user.friendsCount
        + "\n MKW: [ L: " + statsObj.classification.manual.left
        + " | R: " + statsObj.classification.manual.right
        + " | +: " + statsObj.classification.manual.positive
        + " | -: " + statsObj.classification.manual.negative
        + " | N: " + statsObj.classification.manual.neutral
        + " | O: " + statsObj.classification.manual.other
        + " | X: " + statsObj.classification.manual.none + " ]"
        + "\n AKW: [ L: " + statsObj.classification.auto.left
        + " | R: " + statsObj.classification.auto.right
        + " | +: " + statsObj.classification.auto.positive
        + " | -: " + statsObj.classification.auto.negative
        + " | N: " + statsObj.classification.auto.neutral
        + " | O: " + statsObj.classification.auto.other
        + " | X: " + statsObj.classification.auto.none + " ]"
      ));

      // callback(user);
      resolve(user);
    });

  });
}

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

  debug("\n------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
    }
    else if (i === 2) {
      debug("ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      debug("ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
  });
}

function activateNetwork(obj, callback){

  if (randomNetworkTreeReadyFlag) {
    randomNetworkTree.send({op: "ACTIVATE", obj: obj});
  }
  // else {
  //   try {
  //     let networkOutput = network.activate(nInput);
  //     debug(chalkAlert("activateNetwork networkOutput: " + networkOutput));
  //     callback(null, networkOutput);
  //   }
  //   catch (err) {
  //     console.error(chalkError("activateNetwork ERROR: " + err));
  //     callback(err, null);
  //   }
  // }

}

function enableAnalysis(user){
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
  return false; 
}

function generateAutoKeywords(user, callback){

  let networkInput = [ 0, 0 ];

  if (user.languageAnalysis.sentiment){
    networkInput[0] = user.languageAnalysis.sentiment.magnitude;
    networkInput[1] = user.languageAnalysis.sentiment.score;
  }

  // PARSE USER STATUS + DESC, IF EXIST
  if (user.screenName !== undefined){

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

        // console.log("user.status\n" + jsonPrint(user.status));

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
      }

    ], function (err, text) {

      if (err) {
        console.error(chalkError("*** ERROR generateAutoKeywords: " + err));
        callback(err, null);
      }

      if (!text) { text = " "; }

      twitterTextParser.parseText(text, {updateGlobalHistograms: true}, function(err, hist){

        if (err) {
          console.log(chalkError("*** TWITTER TEXT PARSER ERROR: " + err));
          callback(new Error(err), null);
        }

        userServer.updateHistograms({user: user, histograms: hist}, function(err, updatedUser){

          if (err) {
            console.trace(chalkError("*** UPDATE USER HISTOGRAMS ERROR\n" + jsonPrint(err)));
            console.trace(chalkError("*** UPDATE USER HISTOGRAMS ERROR\nUSER\n" + jsonPrint(user)));
            callback(new Error(err), null);
          }

          updatedUser.inputHits = 0;

          const userHistograms = updatedUser.histograms;

          const score = updatedUser.languageAnalysis.sentiment ? updatedUser.languageAnalysis.sentiment.score : 0;
          const mag = updatedUser.languageAnalysis.sentiment ? updatedUser.languageAnalysis.sentiment.magnitude : 0;

          console.log(chalkInfo("GEN AKWs"
            + " [@" + currentTwitterUser + "]"
            + " | @" + updatedUser.screenName
            + " | " + updatedUser.userId
            + " | Ts: " + updatedUser.statusesCount
            + " | FLWRs: " + updatedUser.followersCount
            + " | FRNDs: " + updatedUser.friendsCount
            + " | LAd: " + updatedUser.languageAnalyzed
            + " | LA: S: " + score.toFixed(2)
            + " M: " + mag.toFixed(2)
            + "\n" + text + "\n"
            // + "\nHISTOGRAMS: " + histogramsText
            // + "\nHISTOGRAMS: " + jsonPrint(userHistograms)
          ));

          async.eachSeries(inputTypes, function(type, cb1){

            debug(chalkInfo("START ARRAY: " + type + " | " + inputArrays[type].length));

            async.eachOfSeries(inputArrays[type], function(element, index, cb2){

              if (userHistograms[type] && userHistograms[type][element]) {
                updatedUser.inputHits += 1;
                debug(chalkTwitter("GAKW"
                  + " | " + updatedUser.inputHits + " HITS"
                  + " | @" + updatedUser.screenName 
                  + " | ARRAY: " + type 
                  + " | " + element 
                  + " | " + userHistograms[type][element]
                ));
                // networkInput.push(1);
                networkInput[index+2] = 1;

                async.setImmediate(function() {
                  cb2();
                });
              }
              else {
                debug(chalkInfo("U MISS" 
                  + " | @" + updatedUser.screenName 
                  + " | " + updatedUser.inputHits 
                  + " | ARRAY: " + type 
                  + " | " + element
                ));
                // networkInput.push(0);
                networkInput[index+2] = 0;
                async.setImmediate(function() {
                  cb2();
                });
              }

            }, function createNetworkInputArrayComplete(){

              debug(chalkTwitter("GAKW INPUT ARRAY COMPLETE"
                + " | " + type 
                + " | " + updatedUser.inputHits + " HITS"
                + " | @" + updatedUser.screenName 
              ));

              debug(chalkTwitter("DONE ARRAY: " + type));
              cb1();

            });
          }, function createNetworkInputComplete(){

            debug(chalkTwitter("PARSE DESC COMPLETE"));

            updatedUser.inputHitRatio = 100*updatedUser.inputHits/networkInput.length;

            console.log(chalkTwitterBold("### GAKW ALL INPUT ARRAYS COMPLETE"
              + " | @" + updatedUser.screenName 
              + " | " + updatedUser.inputHits + " HITS / " + networkInput.length + " INPUTS"
              + " | " + updatedUser.inputHitRatio.toFixed(2) + "% INPUT HIT"
            ));

            if (enableAnalysis(updatedUser)) {
              langAnalyzer.send({op: "LANG_ANALIZE", obj: updatedUser, text: text}, function(){
                statsObj.analyzer.analyzed += 1;
              });
            }
            else {

              console.log(chalkLog("SKIP LANG ANAL"
                + " | " + updatedUser.userId
                + " | @" + updatedUser.screenName
                + " | LAd: " + updatedUser.languageAnalyzed
                + " | LA: S: " + score.toFixed(2)
                + " M: " + mag.toFixed(2)
              ));
            }

            const u = pick(updatedUser, ["userId", "screenName", "keywords", "keywordsAuto"]);

            activateNetwork({user: u, networkInput: networkInput});

            callback(null, updatedUser);

            // activateNetwork(network, networkInput, function(err, networkOutput){

            //   if (err){
            //     console.trace(chalkError("ACTIVATE NETWORK ERROR"
            //       + " | @" + updatedUser.screenName
            //       + "\n" + err
            //     ));
            //     printDatum(updatedUser.screenName, networkInput);
            //     return(callback(err, null));
            //   }

            //   indexOfMax(networkOutput, function maxNetworkOutput(maxOutputIndex){

            //     debug(chalkInfo("MAX INDEX: " + maxOutputIndex));

            //     updatedUser.keywordsAuto = {};

            //     let chalkCurrent = chalkLog;

            //     switch (maxOutputIndex) {
            //       case 0:
            //         // classText = "L";
            //         chalkCurrent = chalk.blue;
            //         updatedUser.keywordsAuto.left = 100;
            //       break;
            //       case 1:
            //         // classText = "N";
            //         chalkCurrent = chalk.black;
            //         updatedUser.keywordsAuto.neutral = 100;
            //       break;
            //       case 2:
            //         // classText = "R";
            //         chalkCurrent = chalk.yellow;
            //         updatedUser.keywordsAuto.right = 100;
            //       break;
            //     }

            //     const title = updatedUser.screenName + " | INPUT HIT: " + updatedUser.inputHitRatio.toFixed(2) + "%";
            //     printDatum(
            //       title, 
            //       networkInput
            //     );

            //     let keywordsText = "";
            //     let keywordsAutoText = "";

            //     if (updatedUser.keywords) {
            //       keywordsText = Object.keys(updatedUser.keywords);
            //     }
            //     if (updatedUser.keywordsAuto) {
            //       keywordsAutoText = Object.keys(updatedUser.keywordsAuto);
            //     }

            //     console.log(chalkCurrent("AUTO KW"
            //       + " | " + updatedUser.userId
            //       + " | @" + updatedUser.screenName
            //       + " | Ts: " + updatedUser.statusesCount
            //       + " | FLWRs: " + updatedUser.followersCount
            //       + " | M: " + networkInput[0].toFixed(2)
            //       + " | S: " + networkInput[1].toFixed(2)
            //       + " | L: " + networkOutput[0].toFixed(0)
            //       + " | N: " + networkOutput[1].toFixed(0)
            //       + " | R: " + networkOutput[2].toFixed(0)
            //       + " | KWs: " + keywordsText
            //       + " | AKWs: " + keywordsAutoText
            //       // + " | KWs: " + Object.keys(updatedUser.keywords)
            //       // + " | AKWs: " + Object.keys(updatedUser.keywordsAuto)
            //       // + "\n"
            //       // + "\n" + jsonPrint(updatedUser.keywordsAuto)
            //     ));

            //     callback(null, updatedUser);
            //   });
            // });
          });

        });

      });

    });
  }
  else {
    // NO USER TEXT TO PARSE

    async.eachSeries(inputTypes, function(type, cb1){

      async.eachSeries(inputArrays[type], function(element, cb2){
        debug("ARRAY: " + type + " | + " + 0);
        networkInput.push(0);
        async.setImmediate(function() {
          cb2();
        });
      }, function(){
        async.setImmediate(function() {
          cb1();
        });
      });


    }, function(){
      debug(chalkTwitter("--- NO USER STATUS NOR DESC"));

      activateNetwork({user: user, networkInput: networkInput});
      
      callback(null, user);

    });
  }
}

function checkUserWordKeys(user, callback){
  Word.findOne({nodeId: user.screenName.toLowerCase()}, function(err, word){

    let kws = {};

    if (err) {
      console.error(chalkError("FIND ONE WORD ERROR: " + err));
      callback(err, user);
    }
    else if (!word) {
      debug(chalkInfo("USER WORD NOT FOUND: " + user.screenName.toLowerCase()));
      callback(null, kws);
    }
    else if (word.keywords === undefined) {
      debug("WORD-USER KWS UNDEFINED"
        + " | " + user.screenName.toLowerCase()
      );
      callback(null, kws);
    }
    else if (!word.keywords || (Object.keys(word.keywords).length === 0)) {
      debug("WORD-USER NO KW KEYS"
        + " | " + user.screenName.toLowerCase()
      );
      callback(null, kws);
    }
    else {
      debug("WORD-USER KEYWORDS"
        + "\n" + jsonPrint(word.keywords)
      );

      async.each(Object.keys(word.keywords), function(kwId, cb){

        if (kwId !== "keywordId") {

          const kwIdLc = kwId.toLowerCase();

          kws[kwIdLc] = word.keywords[kwIdLc];

          debug(chalkTwitter("-- KW"
            + " | " + user.screenName.toLowerCase()
            + " | " + kwIdLc
            + " | " + kws[kwIdLc]
          ));

          // classifiedUserHashmap[user.screenName.toLowerCase()] = kws;
          classifiedUserHashmap[user.userId] = {};
          classifiedUserHashmap[user.userId] = kws;

          async.setImmediate(function() {
            cb();
          });
        }
        else {
          async.setImmediate(function() {
            cb();
          });
        }

      }, function(){

        debug("WORD-USER HIT"
          + " | " + user.screenName.toLowerCase()
          + " | " + Object.keys(kws)
        );

        callback(null, kws);

      });
    }
  });
}


function processUser(userIn, callback) {

  debug(chalkInfo("PROCESS USER\n" + jsonPrint(userIn)));

  async.waterfall(
  [
    function convertUser(cb) {
      userServer.convertRawUser(userIn, function(err, user){
        if (err) {
          cb(err, null);
        }
        else {
          cb(null, user);
        }
      });
    },

    function unfollowFriend(user, cb) {

      if ((currentTwitterUser === "altthreecee00")
        && (twitterUserHashMap.ninjathreecee.friends[user.userId] !== undefined)) {

        console.log(chalkAlert("SKIP | ninjathreecee FOLLOWING"
          + " | " + user.userId
          + " | " + user.screenName.toLowerCase()
        ));

        twitterUserHashMap[currentTwitterUser].twit.post(
          "friendships/destroy", 
          {user_id: user.userId}, 
          function destroyFriend(err, data, response){
            if (err) {
              console.error(chalkError("UNFOLLOW ERROR" + err));
              cb(err, user);
            }
            else {
              debug("data\n" + jsonPrint(data));
              debug("response\n" + jsonPrint(response));

              console.log(chalkAlert("UNFOLLOW altthreecee00"
                + " | " + user.userId
                + " | " + user.screenName.toLowerCase()
              ));
              const slackText = "UNFOLLOW altthreecee00"
                + "\n@" + user.screenName.toLowerCase()
                + "\n" + user.userId;
              slackPostMessage(slackChannel, slackText);
              cb(null, user);
            }
          }
        );
      }
      else {
        cb(null, user);
      }
    },

    function checkKeyWords(user, cb) {
      checkUserWordKeys(user, function(err, kws){
        if (err) {
          console.error(chalkError("CHECK USER KEYWORDS ERROR"
            + " | @" + user.screenName
            + " | " + user.userId
            + " | " + err
          ));
          return(cb(err,user));
        }
        if (Object.keys(kws).length > 0) {
          let kwsa = "";
          if (user.keywordsAuto && (Object.keys(user.keywordsAuto).length > 0)) {
            kwsa = Object.keys(user.keywordsAuto);
          }
          console.log("WORD-USER HIT"
            + " | " + user.userId
            + " | @" + user.screenName.toLowerCase()
            + " | KWs: " + Object.keys(kws)
            + " | KWAs: " + Object.keys(kwsa)
          );
          user.keywords = {};
          user.keywords = kws;
          cb(null, user);
        }
        else {
          cb(null, user);
        }
      });
    },

    function findUserInDb(user, cb) {

      User.find({ userId: user.userId }).limit(1).exec(function(err, uArray) {

        if (err) {
          console.log(chalkError("ERROR DB FIND ONE USER | " + err));
          cb(err, user);
        }
        else if (uArray.length === 0) {
          console.log(chalkInfo("USER DB MISS"
            + " | @" + user.screenName.toLowerCase()
            + " | " + user.userId
          ));
          cb(null, user);
        }
        else {

          let userDb = uArray[0];
          user.createdAt = userDb.createdAt;
          user.languageAnalyzed = userDb.languageAnalyzed;

          if (userDb.languageAnalyzed) { 
            user.languageAnalysis = userDb.languageAnalysis;
          }
          if (userDb.histograms && (Object.keys(userDb.histograms).length > 0)) { 
            user.histograms = userDb.histograms;
          }
          if (userDb.keywords && (Object.keys(userDb.keywords).length > 0)) { 
            user.keywords = userDb.keywords;
          }
          if (userDb.keywordsAuto && (Object.keys(userDb.keywordsAuto).length > 0)) { 
            user.keywordsAuto = userDb.keywordsAuto;
          }

          if ((user.rate === 0) && (userDb.rate > 0)) {
            user.rate = userDb.rate;
          }

          if ((user.mentions === 0) && (userDb.mentions > 0)) {
            user.mentions = userDb.mentions;
          }

          if ((user.followersCount === 0) && (userDb.followersCount > 0)) {
            user.followersCount = userDb.followersCount;
          }

          if ((user.statusesCount === 0) && (userDb.statusesCount > 0)) {
            user.statusesCount = userDb.statusesCount;
          }

          if ((user.friendsCount === 0) && (userDb.friendsCount > 0)) {
            user.friendsCount = userDb.friendsCount;
          }

          console.log(chalkInfo("USER DB HIT "
            + " | @" + user.screenName.toLowerCase()
            + " | " + user.userId
            + " | " + getTimeStamp(user.createdAt)
            + " | LAd: " + user.languageAnalyzed
            + " | KWs: " + Object.keys(user.get("keywords"))
            + " | KWAs: " + Object.keys(user.get("keywordsAuto"))
          ));
          cb(null, user);
        }
      });
    },

    function updateClassifyUser(user, cb) {

      if (user.keywords) {
        debug(chalkInfo("USER KWs\n" + jsonPrint(user.get("keywords"))));
      }

      if (user.keywordsAuto) {
        debug(chalkInfo("USER AKWs\n" + jsonPrint(user.get("keywordsAuto"))));
      }

      if ((user.threeceeFollowing === undefined) || !user.threeceeFollowing) { 
        user.threeceeFollowing = {}; 
      }

      user.threeceeFollowing.screenName = currentTwitterUser;

      classifyUser(user)
      .then(function genClassifiedUserKeyword(u){
        cb(null, u);
      })
      .catch(function classifyUserError(err){
        console.trace(chalkError("ERROR classifyUser | UID: " + user.userId
          + "\n" + err
        ));
        cb(err, user);
      });
    },

    function genKeywords(user, cb){
      if (!neuralNetworkInitialized) { return(cb(null, user)); }
      generateAutoKeywords(user, function (err, uObj){
        cb(err, uObj);
      });
    }

    // function updateUserDb(user, cb){
    //   userServer.findOneUser(user, {noInc: true}, function updateUserComplete(err, updatedUserObj){

    //     if (err){
    //       console.trace(chalkError("ERROR DB UPDATE USER - updateUserDb"
    //         + "\n" + err
    //         + "\n" + jsonPrint(user)
    //       ));
    //       cb(err, user);
    //     }

    //     let keywords = "";
    //     let keywordsAuto = "";

    //     if ((updatedUserObj.keywords !== undefined) && updatedUserObj.keywords) {
    //       keywords = Object.keys(updatedUserObj.keywords);
    //     }

    //     if ((updatedUserObj.keywordsAuto !== undefined) && updatedUserObj.keywordsAuto) {
    //       keywordsAuto = Object.keys(updatedUserObj.keywordsAuto);
    //     }

    //     debug(chalkInfo("US UPD<"
    //       + " | " + updatedUserObj.userId
    //       + " | TW: " + (updatedUserObj.isTwitterUser || "-")
    //       + " | @" + updatedUserObj.screenName
    //       + " | Ts: " + updatedUserObj.statusesCount
    //       + " | FLWRs: " + updatedUserObj.followersCount
    //       + " | FRNDs: " + updatedUserObj.friendsCount
    //       + " | LAd: " + updatedUserObj.languageAnalyzed
    //       + " | KWs: " + keywords
    //       + " | AKWs: " + keywordsAuto
    //     ));

    //     cb(null, updatedUserObj);
    //   });
    // }

  ], function (err, user) {

    if (err) {
      callback(new Error(err), null);
    }
    else {
      callback(null, user);
    }

  });

}

function fetchFriends(params, callback) {

  debug(chalkInfo("FETCH FRIENDS\n" + jsonPrint(params)));

  // return new Promise(function(resolve, reject) {

    if (nextUser) {
      callback(null, []);
    }
    else if (!statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
      && languageAnalysisReadyFlag) {

      twitterUserHashMap[currentTwitterUser].twit.get("friends/list", params, function(err, data, response){

        debug("response\n" + jsonPrint(response));

        if (err) {
          console.log(chalkError(getTimeStamp()
          + " | *** ERROR GET TWITTER FRIENDS: " + err
          ));

          if (err.code === 88){
            statsObj.user[currentTwitterUser].twitterRateLimitException = moment();
            statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = true;
            statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(moment().valueOf() + 60000);
            checkRateLimit();
            fsm.rateLimitStart();
          }
          callback(err, []);
        }
        else {

          statsObj.users.grandTotalFriendsFetched += data.users.length;

          statsObj.user[currentTwitterUser].totalFriendsFetched += data.users.length;
          statsObj.user[currentTwitterUser].nextCursor = data.next_cursor_str;
          statsObj.user[currentTwitterUser].percentFetched = 100*(statsObj.user[currentTwitterUser].totalFriendsFetched/statsObj.user[currentTwitterUser].friendsCount); 

          if (configuration.testMode 
            && (statsObj.user[currentTwitterUser].totalFriendsFetched >= 47)) {
            statsObj.user[currentTwitterUser].nextCursorValid = false;
            statsObj.user[currentTwitterUser].endFetch = true;
            nextUser = true;
            console.log(chalkAlert("TEST MODE END FETCH"
              + " | @" + currentTwitterUser
              + " | TOTAL FRIENDS FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
            ));
          }
          else if (data.next_cursor_str > 0) {
            statsObj.user[currentTwitterUser].nextCursorValid = true;
          }
          else {
            statsObj.user[currentTwitterUser].nextCursorValid = false;
            statsObj.user[currentTwitterUser].endFetch = true;
          }

          console.log(chalkTwitter(getTimeStamp()
            + " | @" + statsObj.user[currentTwitterUser].screenName
            + " | TOTAL FRIENDS: " + statsObj.user[currentTwitterUser].friendsCount
            + " | COUNT: " + configuration.fetchCount
            + " | FETCHED: " + data.users.length
            + " | TOTAL FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
            + " [ " + statsObj.user[currentTwitterUser].percentFetched.toFixed(1) + "% ]"
            + " | GRAND TOTAL FETCHED: " + statsObj.users.grandTotalFriendsFetched
            + " | MORE: " + statsObj.user[currentTwitterUser].nextCursorValid
          ));

          const subFriendsSortedArray = sortOn(data.users, "-followers_count");

          async.eachSeries(subFriendsSortedArray, function (friend, cb){

            console.log(chalkLog("<FRIEND"
              + " | " + friend.id_str
              + " | @" + friend.screen_name
              + " | Ts: " + friend.statuses_count
              + " | FLWRs: " + friend.followers_count
              + " | FRNDs: " + friend.friends_count
            ));

            processUser(friend, function(err, user){
              if (err) {
                console.trace("processUser ERROR");
                return (cb(err));
              }
              debug("PROCESSED USER\n" + jsonPrint(user));
              cb();
            });

          }, function subFriendsProcess(err){
            if (err) {
              console.trace("subFriendsProcess ERROR");
              callback(err, null);
            }
            else {
              callback(null, subFriendsSortedArray);
            }
        });

        }

      });
    }
    else {
      callback(null, []);
    }

  // });
}

function processFriends(callback){

  console.log(chalkAlert("PROCESS TOTAL FRIENDS FETCHED"
    + " | TEST MODE: " + configuration.testMode
    + " | FETCH COUNT: " + configuration.fetchCount
    + " | @" + currentTwitterUser
    + " | " + statsObj.user[currentTwitterUser].totalFriendsFetched
  ));

  if (!statsObj.user[currentTwitterUser].nextCursorValid 
    || nextUser 
    || abortCursor 
    || (configuration.testMode && (statsObj.user[currentTwitterUser].totalFriendsFetched >= 47))
    || (statsObj.user[currentTwitterUser].totalFriendsFetched >= statsObj.user[currentTwitterUser].friendsCount)) {

    console.log(chalkTwitterBold("\n\n===== END FETCH USER @" + currentTwitterUser + " ====="
      + " | " + getTimeStamp()
      + "\n\n"
    ));

    abortCursor = false;

    if (currentTwitterUserIndex < twitterUsersArray.length-1) {

      currentTwitterUserIndex += 1;

      currentTwitterUser = twitterUsersArray[currentTwitterUserIndex];

      console.log(chalkTwitterBold("===== NEW FETCH USER @" 
        + currentTwitterUser + " ====="
        + " | " + getTimeStamp()
      ));

      twitterUserUpdate(currentTwitterUser, function(err){
       if (err){
          console.log("!!!!! TWITTER SHOW USER ERROR | @" + currentTwitterUser + " | " + getTimeStamp() 
            + "\n" + jsonPrint(err));
          // reject(new Error(err));
          callback(new Error(err), null);
        }
        statsObj.user[currentTwitterUser].nextCursor = false;
        statsObj.user[currentTwitterUser].nextCursorValid = false;
        statsObj.user[currentTwitterUser].totalFriendsFetched = 0;
        statsObj.user[currentTwitterUser].twitterRateLimit = 0;
        statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
        statsObj.user[currentTwitterUser].twitterRateLimitRemaining = 0;
        statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = 0;
        statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment();

        // resolve(currentTwitterUser);
        callback(null, currentTwitterUser);
      });

    }
    else if (configuration.quitOnComplete) {
      clearInterval(waitLanguageAnalysisReadyInterval);
      fetchTwitterFriendsIntervalometer.stop();
      // resolve(null);
      callback(null, currentTwitterUser);
   }
    else {
      currentTwitterUserIndex = 0;
      currentTwitterUser = twitterUsersArray[currentTwitterUserIndex];

      statsObj.user[currentTwitterUser].nextCursor = false;
      statsObj.user[currentTwitterUser].nextCursorValid = false;
      statsObj.user[currentTwitterUser].totalFriendsFetched = 0;
      statsObj.user[currentTwitterUser].twitterRateLimit = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment();

      console.log(chalkError("===== NEW FETCH USER @" 
        + currentTwitterUser + " ====="
        + " | " + getTimeStamp()
      ));

      // resolve(currentTwitterUser);
      callback(null, currentTwitterUser);
    }
  }
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("\n==================="
    + "\n" + title
    + "\nID:      " + nnObj.networkId
    + "\nCREATED: " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS: " + nnObj.successRate.toFixed(1) + "%"
    + "\nINPUTS:  " + Object.keys(nnObj.inputs)
    + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\n===================\n"
  ));
}


function loadBestNetworkDropboxFolder(folder, callback){

  let options = {path: folder};
  let newBestNetwork = false;

  dropboxClient.filesListFolder(options).then(function(response){

    debug(chalkLog("DROPBOX LIST FOLDER"
      + " | " + options.path
      + " | " + jsonPrint(response)
    ));

    // response.entries.length = 47;

    async.each(response.entries, function(entry, cb){

      console.log(chalkInfo("DROPBOX NETWORK FOUND"
        + " | " + getTimeStamp(entry.client_modified)
        + " | " + entry.name
        // + " | " + entry.content_hash
        // + "\n" + jsonPrint(entry)
      ));

      if (bestNetworkHashMap.has(entry.name)){

        if (bestNetworkHashMap.get(entry.name).entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("DROPBOX NETWORK CONTENT CHANGE"
            + " | " + getTimeStamp(entry.client_modified)
            + " | " + entry.name
            + "\nCUR HASH: " + entry.content_hash
            + "\nOLD HASH: " + bestNetworkHashMap.get(entry.name).entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, networkObj){

            if (err) {
              console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
              return(cb());
            }

            console.log(chalkInfo("DROPBOX LOAD NETWORK"
              + " | " + networkObj.successRate.toFixed(1) + "%"
              + " | " + getTimeStamp(networkObj.createdAt)
              + " | " + networkObj.networkId
              + " | " + networkObj.networkCreateMode
              + " | IN: " + networkObj.numInputs
              + " | OUT: " + networkObj.numOutputs
            ));

            bestNetworkHashMap.set(entry.name, { entry: entry, network: networkObj});

            if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {
              currentBestNetwork = deepcopy(networkObj);
              newBestNetwork = true;
            }
            cb();

          });
        }
        else {
          debug(chalkLog("DROPBOX NETWORK CONTENT SAME  "
            + " | " + entry.name
            // + " | CUR HASH: " + entry.content_hash
            // + " | OLD HASH: " + bestNetworkHashMap.get(entry.name).content_hash
            + " | " + getTimeStamp(entry.client_modified)
          ));

          cb();
        }
      }
      else {

        loadFile(folder, entry.name, function(err, networkObj){

          if (err) {
            console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
            return(cb());
          }

          console.log(chalkInfo("DROPBOX NETWORK"
            + " | " + networkObj.successRate.toFixed(1) + "%"
            + " | " + getTimeStamp(networkObj.createdAt)
            + " | " + networkObj.networkId
            + " | " + networkObj.networkCreateMode
            + " | IN: " + networkObj.numInputs
            + " | OUT: " + networkObj.numOutputs
          ));

          bestNetworkHashMap.set(entry.name, { entry: entry, network: networkObj});

          // if (Object.keys(randomNetworksObj).length < NUM_RANDOM_NETWORKS) {
          //   randomNetworksObj[networkObj.networkId] = networkObj;
          //   console.log(chalkAlert("+++ RANDOM NETWORK"
          //     + " | " + networkObj.networkId 
          //     + " | " + networkObj.successRate.toFixed(1) + "%"
          //   ));
          // }

          if (!currentBestNetwork || (networkObj.successRate > currentBestNetwork.successRate)) {
            currentBestNetwork = networkObj;
            newBestNetwork = true;

            if (Object.keys(randomNetworksObj).length < NUM_RANDOM_NETWORKS) {
              randomNetworksObj[networkObj.networkId] = {};
              randomNetworksObj[networkObj.networkId] = networkObj;
              console.log(chalkAlert("+++ RANDOM NETWORK"
                + " [" + Object.keys(randomNetworksObj).length + "]"
                + " | " + networkObj.networkId 
                + " | " + networkObj.successRate.toFixed(1) + "%"
              ));
            }

          }
          else if ((Math.random() < 0.333) && (Object.keys(randomNetworksObj).length < NUM_RANDOM_NETWORKS)) {
            randomNetworksObj[networkObj.networkId] = {};
            randomNetworksObj[networkObj.networkId] = networkObj;
            console.log(chalkAlert("+++ RANDOM NETWORK"
              + " [" + Object.keys(randomNetworksObj).length + "]"
              + " | " + networkObj.networkId 
              + " | " + networkObj.successRate.toFixed(1) + "%"
            ));
          }
          setTimeout(function(){
            cb();
          }, 100);


        });
      }
    }, function(){

      let messageText;

      if (newBestNetwork) {

        statsObj.bestNetworkId = currentBestNetwork.networkId;

        printNetworkObj("NEW SEED NETWORK", currentBestNetwork);

        messageText = "\nNN NEW SEED\n" 
          + currentBestNetwork.networkId + "\n"
          + currentBestNetwork.successRate.toFixed(2) + "%\n"
          + currentBestNetwork.networkCreateMode + "\n"
          + getTimeStamp(currentBestNetwork.createdAt) + "\n"
          + jsonPrint(currentBestNetwork.evolve) + "\n";

        debug(chalkAlert("slack messageText: " + messageText));

        slackPostMessage(slackChannel, messageText);
      }

      if (callback !== undefined) { callback( null, {best: currentBestNetwork} ); }
    });

  })
  .catch(function(err){
    console.log(chalkError("loadBestNetworkDropboxFolder *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
    if (callback !== undefined) { callback(err, null); }
  });
}

function loadBestNeuralNetworkFile(callback){

  console.log(chalkNetwork("LOADING DROPBOX NEURAL NETWORK"));

  loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, results){

    if (err) {
      console.log(chalkError("LOAD DROPBOX NETWORKS ERROR: " + err));
      callback(new Error(err), null);
    }
    else if (results.best === undefined) {
      console.log(chalkAlert("??? NO BEST DROPBOX NETWORK ???"));
      callback(null, null);
    }
    else {

      if (randomNetworkTree !== undefined) {
        randomNetworkTree.send({ op: "LOAD_NETWORKS", networksObj: randomNetworksObj }, function(err){
          console.log(chalkAlert("SEND RANDOM NETWORKS | " + Object.keys(randomNetworksObj)));
        });
      }

      let bestNetwork;

      if (bestNetworkId  && bestNetworkHashMap.has(bestNetworkId)) {
        bestNetwork = bestNetworkHashMap.get(bestNetworkId).network;
        console.log(chalkAlert(">>>> NEW BEST NETWORK | " + bestNetwork.networkId + "\n\n"));
      }
      else {
        bestNetwork = results.best;
      }

      printNetworkObj("LOADED NETWORK", bestNetwork);

      Object.keys(bestNetwork.inputs).forEach(function(type){
        console.log(chalkNetwork("NN INPUTS TYPE" 
          + " | " + type
          + " | INPUTS: " + bestNetwork.inputs[type].length
        ));
        inputArrays[type] = bestNetwork.inputs[type];
      });

      network = neataptic.Network.fromJSON(bestNetwork.network);

      statsObj.currentBestNetworkId = bestNetwork.networkId;
      statsObj.network.networkId = bestNetwork.networkId;
      statsObj.network.networkType = bestNetwork.networkType;
      statsObj.network.successRate = bestNetwork.successRate;
      statsObj.network.input = bestNetwork.network.input;
      statsObj.network.output = bestNetwork.network.output;
      statsObj.network.evolve = {};
      statsObj.network.evolve = bestNetwork.evolve;

      callback(null, bestNetwork);

    }
  });

}

function updateNetworkFetchFriends(){

  console.log(chalkAlert("updateNetworkFetchFriends | @" + currentTwitterUser));

  loadBestNeuralNetworkFile(function(err, nnObj){

    if (err) {
      console.error(chalkError("*** LOAD BEST NETWORK FILE ERROR: " + err));
      return;
    }

    debug("updateNetworkFetchFriends: nnObj: " + nnObj.networkId);

    let params = {};
    params.count = statsObj.user[currentTwitterUser].count;

    if (statsObj.user[currentTwitterUser].nextCursorValid) {
      params.cursor = parseInt(statsObj.user[currentTwitterUser].nextCursor);
      statsObj.user[currentTwitterUser].cursor = parseInt(statsObj.user[currentTwitterUser].nextCursor);
    }
    else {
      statsObj.user[currentTwitterUser].cursor = null;
    }

    debug("params\n" + jsonPrint(params));

    if (languageAnalysisReadyFlag) {

      // fetchFriends(params).then(function(subFriendsSortedArray){

      fetchFriends(params, function(err, subFriendsSortedArray){
        if (err) {
          console.log(chalkError("FETCH FRIENDS ERROR: " + err));
        }
        else {

          console.log(chalkInfo("FETCH FRIENDS: " + subFriendsSortedArray.length));

          if (nextUser || statsObj.user[currentTwitterUser].endFetch) {

            nextUser = false;

            processFriends(function(err, newCurrentUser){
              if (err) {
                console.log(chalkError("PROCESS FRIENDS ERROR: " + err));
              }
              else if (newCurrentUser) {
                statsObj.user[currentTwitterUser].endFetch = false;
                debug(chalkInfo("+++ NEW CURRENT USER: " + newCurrentUser));
              }
              else {
                debug(chalkInfo("--- NO NEW CURRENT USER"));
              }
            });

          }
        }
      });
    }
    else {
      console.log(chalkLog("languageAnalysisReadyFlag: " + languageAnalysisReadyFlag));
    }
  });
}

function initFetchTwitterFriendsInterval(interval){

  console.log(chalkInfo("INIT GET TWITTER FRIENDS"
    + " | INTERVAL: " + interval + " MS"
    + " | RUN AT: " + moment().add(interval, "ms").format(compactDateTimeFormat)
  ));

  if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
    console.error(chalkAlert("RATE LIMIT EXCEPTION"));
    return;
  }

  statsObj.user[currentTwitterUser].count = configuration.fetchCount;
  debug("statsObj.user[currentTwitterUser]\n" + jsonPrint(statsObj.user[currentTwitterUser]));


  fetchTwitterFriendsIntervalometer = timerIntervalometer(function(){
    if (languageAnalysisReadyFlag && classifiedUserHashmapReadyFlag){
      updateNetworkFetchFriends();
    }
  }, interval);

  waitLanguageAnalysisReadyInterval = setInterval(function(){
    if (languageAnalysisReadyFlag && classifiedUserHashmapReadyFlag){
      clearInterval(waitLanguageAnalysisReadyInterval);
      // updateNetworkFetchFriends();
      fetchTwitterFriendsIntervalometer.start();
    }
  }, 100);
}


function initRandomNetworkTree(callback){

  console.log(chalkAlert("INIT RANDOM NETWORK TREE CHILD PROCESS"));


  randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`);

  randomNetworkTree.on("message", function(m){

    debug(chalkAlert("<== RNT RX"
      + " [" + randomNetworkTreeMessageRxQueue.length + "]"
      + " | " + m.op
    ));

    switch (m.op) {
      case "IDLE":
        randomNetworkTreeReadyFlag = true;
        debug(chalkInfo("... RNT IDLE ..."));
      break;
      case "NETWORK_READY":
        randomNetworkTreeReadyFlag = true;
        debug(chalkInfo("... RNT NETWORK_READY ..."));
      break;
      case "QUEUE_READY":
        randomNetworkTreeReadyFlag = true;
        debug(chalkInfo("RNT Q READY"));
      break;
      case "QUEUE_EMPTY":
        randomNetworkTreeReadyFlag = true;
        debug(chalkInfo("RNT Q EMPTY"));
      break;
      case "QUEUE_FULL":
        randomNetworkTreeReadyFlag = false;
        console.log(chalkError("!!! RNT Q FULL"));
      break;
      case "RNT_TEST_PASS":
        randomNetworkTreeReadyFlag = true;
        console.log(chalkTwitter(getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
      break;
      case "RNT_TEST_FAIL":
        console.log(chalkAlert(getTimeStamp() + " | RNT_TEST_FAIL"));
        quit("RNT_TEST_FAIL");
      break;
      case "NETWORK_OUTPUT":

        debug(chalkAlert("RNT NETWORK_OUTPUT\n" + jsonPrint(m.output)));

        console.log(chalkAlert("RNT NETWORK_OUTPUT | " + m.bestNetwork.networkId));

        bestNetworkId = m.bestNetwork.networkId;

        if (bestNetworkHashMap.has(bestNetworkId)) {

          currentBestNetwork = bestNetworkHashMap.get(bestNetworkId).network;

          console.log(chalkAlert("NETWORK_OUTPUT"
            + " | " + moment().format(compactDateTimeFormat)
            + " | " + m.bestNetwork.networkId
            + " | " + m.bestNetwork.successRate.toFixed(1) + "%"
            + " | " + currentBestNetwork.successRate.toFixed(1) + "%"
          ));
          
        }

        // if (m.bestNetwork.networkId !== previousBestNetworkId) {
        //   console.log(chalkAlert("NETWORK_OUTPUT   NETWORK"
        //     + " | " + moment().format(compactDateTimeFormat)
        //     + " | " + m.bestNetwork.networkId
        //     + " | " + m.bestNetwork.successRate + "%"
        //   ));
        //   previousBestNetworkId = m.bestNetwork.networkId;
        // }
      break;
      default:
        console.error(chalkError("*** UNKNOWN RNT OP | " + m.op));
    }

  });

  randomNetworkTree.on("error", function(err){
    console.log(chalkError("*** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
    quit(err);
  });

  randomNetworkTree.on("exit", function(err){
    console.log(chalkError("*** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
    quit(err);
  });

  randomNetworkTree.on("close", function(code){
    console.log(chalkError("*** randomNetworkTree CLOSE *** | " + code));
    quit(code);
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
        langAnalyzerIdle = false;
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
      langAnalyzerIdle = false;
      console.log(chalkTwitter(getTimeStamp() + " | LANG_TEST_PASS | LANG ANAL READY: " + languageAnalysisReadyFlag));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisReadyFlag = false;
      langAnalyzerIdle = false;
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      langAnalyzerIdle = true;
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
      langAnalyzerIdle = false;
      langAnalyzerMessageRxQueue.push(m);
    }
  });

  langAnalyzer.on("error", function(err){
    console.log(chalkError("*** langAnalyzer ERROR ***\n" + jsonPrint(err)));
    quit(err);
  });

  langAnalyzer.on("exit", function(err){
    console.log(chalkError("*** langAnalyzer EXIT ***\n" + jsonPrint(err)));
    quit(err);
  });

  langAnalyzer.on("close", function(code){
    console.log(chalkError("*** langAnalyzer CLOSE *** | " + code));
    quit(code);
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

  console.log(chalkTwitter(cnf.processName 
    + " STARTED " + getTimeStamp() 
    // + "\n" + jsonPrint(cnf)
  ));

  if (cnf.testMode) {
    cnf.fetchCount = TEST_MODE_FETCH_COUNT;
  }

  if (cnf.loadNeuralNetworkID) {
    cnf.neuralNetworkFile = "neuralNetwork_" + cnf.loadNeuralNetworkID + ".json";
  }
  else {
    cnf.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  console.log(chalkTwitter(cnf.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

  initRandomNetworkTreeMessageRxQueueInterval(100);
  initRandomNetworkTree();

  initLangAnalyzerMessageRxQueueInterval(100);
  initLangAnalyzer();

  loadBestNeuralNetworkFile(function(err, nnObj){

    if (err) {
      neuralNetworkInitialized = false;
      console.log(chalkError("*** LOAD BEST NETWORK ERROR\n" + jsonPrint(err)));
      console.error("*** LOAD BEST NETWORK ERROR\n" + jsonPrint(err));
    }

    debug("nnObj: " + nnObj.networkId);

    neuralNetworkInitialized = true;

    initTwitterUsers(function(e){

      if (e) {
        console.error(chalkError("*** ERROR INIT TWITTER USERS: " + e));
        return quit(e);
      }

      if (currentTwitterUser === undefined) { 
        currentTwitterUser = twitterUsersArray[currentTwitterUserIndex];
      }

      console.log(chalkTwitter("CURRENT TWITTER USER: " + currentTwitterUser));

      // initRandomNetworkTreeMessageRxQueueInterval(100);
      // initRandomNetworkTree();

      checkRateLimit();
      initCheckRateLimitInterval(checkRateLimitIntervalTime);
      // initLangAnalyzerMessageRxQueueInterval(100);
      // initLangAnalyzer();
      
      if (cnf.userDbCrawl) { 
        console.log(chalkTwitter("\n\n*** CRAWLING USER DB ***\n\n"));
      }
      else {
        console.log(chalkTwitter("\n\n*** GET TWITTER FRIENDS *** | @" + statsObj.user[currentTwitterUser].screenName + "\n\n"));
        debug(chalkTwitter("\n\n*** GET TWITTER FRIENDS *** | @" + jsonPrint(statsObj.user[currentTwitterUser]) + "\n\n"));
        initFetchTwitterFriendsInterval(fetchTwitterFriendsIntervalTime);
        fsm.fetchStart();
      }
    });
  });
});
