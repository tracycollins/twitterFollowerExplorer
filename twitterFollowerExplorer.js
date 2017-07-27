/*jslint node: true */
"use strict";

let currentBestNetwork;

const LANGUAGE_ANALYZE_INTERVAL = 200;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const TWITTER_DEFAULT_USER = "altthreecee00";

const MIN_KEEP_NN_SUCCESS_RATE = 50;

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

const twitterTextParser = require("@threeceelabs/twitter-text-parser");

const Dropbox = require("dropbox");
const os = require("os");
const util = require("util");
const moment = require("moment");
const arrayNormalize = require("array-normalize");

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
configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.forceLanguageAnalysis = false;
configuration.quitOnComplete = false;

const intervalometer = require("intervalometer");
let timerIntervalometer = intervalometer.timerIntervalometer;
let waitLanguageAnalysisReadyInterval;
let langAnalyzerMessageRxQueueInterval;

let network;
const neataptic = require("neataptic");
const cp = require("child_process");
let langAnalyzer;

let histograms = {};
histograms.words = {};
histograms.urls = {};
histograms.hashtags = {};
histograms.mentions = {};
histograms.emoji = {};

// const mentionsRegex = require("mentions-regex");
// const hashtagRegex = require("hashtag-regex");
// const getUrls = require("get-urls");

const Twit = require("twit");

// let cursorUser;

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
const mongoose = require("./config/mongoose");

let statsUpdateInterval;
let langAnalyzerMessageRxQueue = [];

let autoClassifiedUserHashmap = {};
let classifiedUserHashmap = {};
let twitterUserHashMap = {};

const db = mongoose();

const User = require("mongoose").model("User");
const Word = require("mongoose").model("Word");
const NeuralNetwork = require("mongoose").model("NeuralNetwork");

const userServer = require("./app/controllers/user.server.controller");
// const neuralNetworkServer = require("./app/controllers/neuralNetwork.server.controller");

let defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;


let langAnalyzerMessageRxQueueReady = true;

function indexOfMax (arr, callback) {
  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return -1;
  }
  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    console.log(chalkAlert("indexOfMax: ALL EQUAL: " + arr[0]));
    return -1;
  }

  console.log("B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  console.log("AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  let max = arr[0];
  let maxIndex = 0;

  async.eachOfSeries(arr, function(val, index, cb){
    if (val > max) {
      maxIndex = index;
      max = val;
    }
    cb();
  }, function(){
    console.log(chalk.blue("indexOfMax: " + maxIndex 
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

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS" + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");


let fetchTwitterFriendsIntervalometer;
let languageAnalysisReadyFlag = false;

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

statsObj.classification = {};
statsObj.classification.auto = {};
statsObj.classification.manual = {};

statsObj.classification.manual.left = 0;
statsObj.classification.manual.right = 0;
statsObj.classification.manual.positive = 0;
statsObj.classification.manual.negative = 0;
statsObj.classification.manual.neutral = 0;
statsObj.classification.manual.other = 0;

statsObj.classification.auto.left = 0;
statsObj.classification.auto.right = 0;
statsObj.classification.auto.positive = 0;
statsObj.classification.auto.negative = 0;
statsObj.classification.auto.neutral = 0;
statsObj.classification.auto.other = 0;

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


// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
const DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

// let dropboxConfigFolder = "/config/utility";
// let dropboxConfigDefaultFolder = "/config/utility/default";
let dropboxConfigHostFolder = "/config/utility/" + hostname;

let dropboxConfigFile = hostname + "_" + DROPBOX_TFE_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/followerExplorer";
let statsFile = DROPBOX_TFE_STATS_FILE;

configuration.neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

console.log("DROPBOX_TFE_CONFIG_FILE: " + DROPBOX_TFE_CONFIG_FILE);
console.log("DROPBOX_TFE_STATS_FILE : " + DROPBOX_TFE_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

// const inputArraysFolder = dropboxConfigHostFolder + "/inputArrays";
// const inputArraysFile = "inputArrays_" + statsObj.runId + ".json";

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
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

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
    .then(function(){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    })
    .catch(function(error){
      if (error.status === 429){
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
      console.log(chalkError("DROPBOX loadFile ERROR: " + file + "\n" + error));
      console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
      console.log(chalkError(jsonPrint(error)));

      if (error.status === 404) {
        console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND"
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

// const jsUcfirst = function(string) {
//   return string.charAt(0).toUpperCase() + string.slice(1);
// };


function saveFileRetry (timeout, path, file, jsonObj, callback){
  setTimeout(function(){
    console.log(chalkError("SAVE RETRY | TIMEOUT: " + timeout + " | " + path + "/" + file));
    saveFile(path, file, jsonObj, function(err){
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

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    saveFile(classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap, function(err){
      if (err) {
        console.log(chalkError("SAVE RETRY ON ERROR: " + classifiedUsersFolder + "/" + classifiedUsersDefaultFile));
        saveFileRetry(5000, classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap);
      }
    });

    saveFile(statsFolder, statsFile, statsObj);
    showStats();

    if (configuration.quitOnComplete && langAnalyzerIdle && !statsObj.user[currentTwitterUser].nextCursorValid) {
      console.log(chalkTwitterBold(moment().format(compactDateTimeFormat)
        + " | QUITTING ON COMPLETE"
      ));

      fetchTwitterFriendsIntervalometer.stop();

      clearInterval(waitLanguageAnalysisReadyInterval);
      clearInterval(statsUpdateInterval);

      saveFile(classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap, function(){
        setTimeout(function(){
          quit("QUIT ON COMPLETE");
        }, 2000);
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

    debug(chalkTwitter("TWITTER USER\n" + jsonPrint(userShowData)));

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
    statsObj.user[userScreenName].count = 200;
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

  console.log(chalkAlert("INIT TWITTER: " + currentTwitterUser));

  let twitterConfigFile =  currentTwitterUser + ".json";

  loadFile(configuration.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + configuration.twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      callback(err, null);
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
        callback(err, results);
      });

    }

  });
}

function initTwitterUsers(callback){

  if (!configuration.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    if (callback !== undefined) {callback(null, null);}
  }
  else{

    let twitterDefaultUser = configuration.twitterDefaultUser;
    twitterUsersArray = Object.keys(configuration.twitterUsers);

    console.log(chalkTwitter("USERS"
      + " | FOUND: " + twitterUsersArray.length
    ));

    // twitterUsersArray.forEach(function(userId){
    async.each(twitterUsersArray, function(userId, cb){

      userId = userId.toLowerCase();

      let twitterUserObj = {};
      // twitterUserObj.friends = {};

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

  console.log(chalkTwitter("INIT CLASSIFED USERS HASHMAP: " + folder + "/" + file));

  loadFile(folder, file, function(err, classifiedUsersObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkTwitter("LOADED CLASSIFED USERS FILE: " + folder + "/" + file));
      console.log(chalkTwitter("LOADED " + Object.keys(classifiedUsersObj).length + " CLASSIFED USERS"));
      callback(null, classifiedUsersObj);
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

  initClassifiedUserHashmap(classifiedUsersFolder, classifiedUsersDefaultFile, function(err, classifiedUsersObj){
    if (!err) {
      classifiedUserHashmap = classifiedUsersObj;
    }
  });

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TFE_PROCESS_NAME || "twitterFollowerExplorer";
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
        console.log("LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_USER_DB_CRAWL);
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
        console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
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
        console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
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

      langEntityKeys = [];

      switch (m.op) {
        case "LANG_RESULTS":

          console.log(chalkLog("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
            + " | UID: " + m.obj.userId
            + " | SN: " + m.obj.screenName
            + " | N: " + m.obj.name
            // + " | KWs: " + Object.keys(m.obj.keywords)
            // + " | ENTs: " + Object.keys(m.results.entities).length
            // + "\nENTITIES\n" + jsonPrint(m.results.entities)
          ));

          if (m.obj.keywords) {
            console.log(chalkAlert("KWs\n" + jsonPrint(m.obj.keywords)));
          }

          if (m.error) {
            // console.error(chalkError("*** LANG ERROR"
            //   + "\n" + jsonPrint(m.error)
            // ));

            m.obj.languageAnalysis = {err: m.error};

            if (m.error.code === 8){ // LANGUAGE QUOTA
              m.obj.languageAnalyzed = false;
              break;
            }
            else {
              m.obj.languageAnalyzed = true;
            }

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


                console.log(chalkLog("DB UPDATE USER"
                  + " | UID: " + updatedUserObj.userId
                  // + " | NID: " + updatedUserObj.nodeId
                  + " | SN: " + updatedUserObj.screenName
                  + " | N: " + updatedUserObj.name
                  + " | 3CFLW: " + threeceeFollowing
                  + " | KWs: " + kws
                  + " | KWAuto: " + kwsAuto
                  + " | LAd: " + updatedUserObj.languageAnalyzed
                  + "\nLA Es: " + laEnts
                ));
              }
              langAnalyzerMessageRxQueueReady = true;
            }); 

            // break;
          }
          else{

            if (m.results.entities !== undefined) {
              langEntityKeys = Object.keys(m.results.entities);
            }

            async.each(langEntityKeys, function(entityKey, cb) {
              if (!entityKey.includes(".")) { 
                cb(); 
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

                cb();
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

                  console.log(chalkLog("DB UPDATE USER"
                    + " | UID: " + updatedUserObj.userId
                    // + " | NID: " + updatedUserObj.nodeId
                    + " | SN: " + updatedUserObj.screenName
                    + " | N: " + updatedUserObj.name
                    + " | 3CFLW: " + threeceeFollowing
                    + " | KWs: " + kws
                    + " | KWAuto: " + kwsAuto
                    + " | LAd: " + updatedUserObj.languageAnalyzed
                    + "\nLA Es: " + laEnts
                  ));
                }

                langAnalyzerMessageRxQueueReady = true;
              }); 

            });

          }

        break;

        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          // languageAnalysisQueueEmpty = false;
          // languageAnalysisQueueFull = true;
          languageAnalysisReadyFlag = false;
          langAnalyzerMessageRxQueueReady = true;
          // if (cursorUser) { cursorUser.pause(); }
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          // languageAnalysisQueueEmpty = true;
          // languageAnalysisQueueFull = false;
          languageAnalysisReadyFlag = true;
          langAnalyzerMessageRxQueueReady = true;
          // if (cursorUser) { cursorUser.resume(); }
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



function updateClassifiedUsers(user, callback){

  statsObj.analyzer.total += 1;

  async.parallel({

    keywords: function(cb){
      if ((user.keywords !== undefined) 
        && user.keywords
        && (Object.keys(user.keywords).length > 0)) {

        debug("KWS\n" + jsonPrint(user.keywords));
        
        classifiedUserHashmap[user.userId] = user.keywords;
        statsObj.users.classified = Object.keys(classifiedUserHashmap).length;

        let chalkCurrent = chalkLog;
        let classText;

        switch (Object.keys(user.keywords)[0]) {
          case "right":
            classText = "R";
            chalkCurrent = chalk.red;
            statsObj.classification.manual.right += 1;
          break;
          case "left":
            classText = "L";
            chalkCurrent = chalk.blue;
            statsObj.classification.manual.left += 1;
          break;
          case "neutral":
            classText = "N";
            chalkCurrent = chalk.black;
            statsObj.classification.manual.neutral += 1;
          break;
          case "positive":
            classText = "+";
            chalkCurrent = chalk.green;
            statsObj.classification.manual.positive += 1;
          break;
          case "negative":
            classText = "-";
            chalkCurrent = chalk.bold.red;
            statsObj.classification.manual.negative += 1;
          break;
          default:
            classText = Object.keys(user.keywords)[0];
            chalkCurrent = chalk.black;
            statsObj.classification.manual.other += 1;
        }

        console.log(chalkCurrent("MCL USR   "
          + " | " + classText
          + " [" + Object.keys(classifiedUserHashmap).length + "]"
          + " [ L: " + statsObj.classification.manual.left
          + " | R: " + statsObj.classification.manual.right
          + " | +: " + statsObj.classification.manual.positive
          + " | -: " + statsObj.classification.manual.negative
          + " | N: " + statsObj.classification.manual.neutral
          + " | O: " + statsObj.classification.manual.other + " ]"
          + " | " + user.userId
          + " | " + user.screenName
          + " | " + user.name
        ));

        cb();
      }
      else {
        cb();
      }
    },

    keywordsAuto: function(cb){
      if ((user.keywordsAuto !== undefined)
        && user.keywordsAuto
        && (Object.keys(user.keywordsAuto).length > 0)) {

        debug("KWSA\n" + jsonPrint(user.keywordsAuto));

        autoClassifiedUserHashmap[user.userId] = user.keywordsAuto;
        statsObj.users.classifiedAuto = Object.keys(autoClassifiedUserHashmap).length;

        let chalkCurrent = chalkLog;
        let classText;

        switch (Object.keys(user.keywordsAuto)[0]) {
          case "right":
            classText = "R";
            chalkCurrent = chalk.red;
            statsObj.classification.auto.right += 1;
          break;
          case "left":
            classText = "L";
            chalkCurrent = chalk.blue;
            statsObj.classification.auto.left += 1;
          break;
          case "neutral":
            classText = "N";
            chalkCurrent = chalk.black;
            statsObj.classification.auto.neutral += 1;
          break;
          case "positive":
            classText = "+";
            chalkCurrent = chalk.green;
            statsObj.classification.auto.positive += 1;
          break;
          case "negative":
            classText = "-";
            chalkCurrent = chalk.bold.red;
            statsObj.classification.auto.negative += 1;
          break;
          default:
            classText = Object.keys(user.keywordsAuto)[0];
            chalkCurrent = chalk.black;
            statsObj.classification.auto.other += 1;
        }

        console.log(chalkCurrent("ACL USR   "
          + " | " + classText
          + " [" + Object.keys(autoClassifiedUserHashmap).length + "]"
          + " [ L: " + statsObj.classification.auto.left
          + " | R: " + statsObj.classification.auto.right
          + " | +: " + statsObj.classification.auto.positive
          + " | -: " + statsObj.classification.auto.negative
          + " | N: " + statsObj.classification.auto.neutral
          + " | O: " + statsObj.classification.auto.other + " ]"
          + " | " + user.userId
          + " | " + user.screenName
          + " | " + user.name
        ));

        cb();
      }
      else {
        cb();
      }
    }

  }, function(){
    callback(user);
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

function activateNetwork(network, nInput){

  return new Promise(function(resolve) {

    let networkOutput = network.activate(nInput);

    resolve(networkOutput);

  });
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
          cb(null, "@" + user.screenName);
        }
        else {
          cb(null, null);
        }
      },
      function userName(text, cb) {
        if (user.name !== undefined) {
          if (text) {
            cb(null, text + " | " + user.name);
          }
          else {
            cb(null, user.name);
          }
        }
        else {
          if (text) {
            cb(null, text);
          }
          else {
            cb(null, null);
          }
        }
      },
      function userStatusText(text, cb) {

        // console.log("user.status\n" + jsonPrint(user.status));

        if ((user.status !== undefined) 
          && user.status
          && user.status.text) {
          if (text) {
            cb(null, text + "\n" + user.status.text);
          }
          else {
            cb(null, user.status.text);
          }
        }
        else {
          if (text) {
            cb(null, text);
          }
          else {
            cb(null, null);
          }
        }
      },
      function userRetweetText(text, cb) {
        if ((user.retweeted_status !== undefined) 
          && user.retweeted_status
          && user.retweeted_status.text) {

          console.log(chalkTwitter("RT\n" + jsonPrint(user.retweeted_status.text)));

          if (text) {
            cb(null, text + "\n" + user.retweeted_status.text);
          }
          else {
            cb(null, user.retweeted_status.text);
          }
        }
        else {
          if (text) {
            cb(null, text);
          }
          else {
            cb(null, null);
          }
        }
      },
      function userDescriptionText(text, cb) {
        if ((user.description !== undefined) && user.description) {
          if (text) {
            cb(null, text + "\n" + user.description);
          }
          else {
            cb(null, user.description);
          }
        }
        else {
          if (text) {
            cb(null, text);
          }
          else {
            cb(null, null);
          }
        }
      }
    ], function (error, text) {

      if (!text) { text = " "; }

      twitterTextParser.parseText(text, {updateGlobalHistograms: true}, function(err, hist){

        userServer.updateHistograms({userId: user.userId, histograms: hist}, function(err, updateduser){

          updateduser.inputHits = 0;

          const userHistograms = updateduser.histograms;

          console.log(chalkAlert("----------------"
            + "\nGEN AUTO KEYWORDS | USER DESC/STATUS"
            + " | @" + updateduser.screenName
            + "\n" + text + "\n"
            + "\nHISTOGRAMS: " + jsonPrint(userHistograms)
          ));

          async.eachSeries(inputTypes, function(type, cb1){

            debug(chalkAlert("START ARRAY: " + type + " | " + inputArrays[type].length));

            async.eachSeries(inputArrays[type], function(element, cb2){

              if (userHistograms[type] && userHistograms[type][element]) {
                updateduser.inputHits += 1;
                console.log(chalkTwitter("GAKW"
                  + " | " + updateduser.inputHits + " HITS"
                  + " | @" + updateduser.screenName 
                  + " | ARRAY: " + type 
                  + " | " + element 
                  + " | " + userHistograms[type][element]
                ));
                networkInput.push(1);
                cb2();
              }
              else {
                debug(chalkInfo("U MISS" 
                  + " | @" + updateduser.screenName 
                  + " | " + updateduser.inputHits 
                  + " | ARRAY: " + type 
                  + " | " + element
                ));
                networkInput.push(0);
                cb2();
              }

            }, function(){

              debug(chalkTwitter("DONE ARRAY: " + type));
              cb1();

            });

          }, function(){

            debug(chalkTwitter("PARSE DESC COMPLETE"));

            langAnalyzer.send({op: "LANG_ANALIZE", obj: updateduser, text: text}, function(){
              statsObj.analyzer.analyzed += 1;
              // callback(null, updateduser);
            });

            activateNetwork(network, networkInput)
            .then(function(networkOutput){
              indexOfMax(networkOutput, function(maxOutputIndex){

                console.log(chalkAlert("MAX INDEX: " + maxOutputIndex));

                updateduser.keywordsAuto = {};

                switch (maxOutputIndex) {
                  case 0:
                    updateduser.keywordsAuto.left = 100;
                  break;
                  case 1:
                    updateduser.keywordsAuto.neutral = 100;
                  break;
                  case 2:
                    updateduser.keywordsAuto.right = 100;
                  break;
                  default:
                    updateduser.keywordsAuto = {};
                }

                printDatum(updateduser.screenName, networkInput);

                console.log(chalkRed("AUTO KW"
                  + " | " + updateduser.screenName
                  + " | MAG: " + networkInput[0].toFixed(6)
                  + " | SCORE: " + networkInput[1].toFixed(6)
                  + " | L: " + networkOutput[0].toFixed(3)
                  + " | N: " + networkOutput[1].toFixed(3)
                  + " | R: " + networkOutput[2].toFixed(3)
                  + " | KWs: " + Object.keys(updateduser.keywords)
                  + " | AKWs: " + Object.keys(updateduser.keywordsAuto)
                  // + "\n" + jsonPrint(updateduser.keywordsAuto)
                ));

                callback(err, updateduser);

              });
            })
            .catch(function(err){
              console.log(chalkError("ACTIVATE NETWORK ERROR: " + err));
              callback(err, updateduser);
            });

          });

        });

      });

    });
  }
  else {
    // NO USER TEXT TO PARSE

    async.eachSeries(inputTypes, function(type, cb1){

      inputArrays[type].forEach(function(){
        debug("ARRAY: " + type + " | + " + 0);
        networkInput.push(0);
      });

      cb1();
    }, function(){
      debug(chalkTwitter("--- NO USER STATUS NOR DESC"));

      activateNetwork(network, networkInput)
      .then(function(networkOutput){
        indexOfMax(networkOutput, function(maxOutputIndex){

          console.log(chalkAlert("MAX INDEX: " + maxOutputIndex));

          user.keywordsAuto = {};

          switch (maxOutputIndex) {
            case 0:
              user.keywordsAuto.left = 100;
            break;
            case 1:
              user.keywordsAuto.neutral = 100;
            break;
            case 2:
              user.keywordsAuto.right = 100;
            break;
            default:
              user.keywordsAuto = {};
          }

          printDatum(user.screenName, networkInput);

          console.log(chalkRed("AUTO KW"
            + " | " + user.screenName
            + " | MAG: " + networkInput[0].toFixed(6)
            + " | SCORE: " + networkInput[1].toFixed(6)
            + " | L: " + networkOutput[0].toFixed(3)
            + " | N: " + networkOutput[1].toFixed(3)
            + " | R: " + networkOutput[2].toFixed(3)
            + " | KWs: " + Object.keys(user.keywords)
            + " | AKWs: " + Object.keys(user.keywordsAuto)
            // + "\n" + jsonPrint(user.keywordsAuto)
          ));

          callback(null, user);

        });
      })
      .catch(function(err){
        console.log(chalkError("ACTIVATE NETWORK ERROR: " + err));
        callback(err, user);
      });

      // activateNetwork(network, networkInput, function(err, networkOutput){
      //   if (err) {
      //     console.error(chalkError("ACTIVATE NETWORK ERROR: " + err));
      //   }

      //   indexOfMax(networkOutput, function(maxOutputIndex){

      //     console.log(chalkAlert("MAX INDEX: " + maxOutputIndex));

      //     user.keywordsAuto = {};

      //     switch (maxOutputIndex) {
      //       case 0:
      //         user.keywordsAuto.left = 100;
      //       break;
      //       case 1:
      //         user.keywordsAuto.neutral = 100;
      //       break;
      //       case 2:
      //         user.keywordsAuto.right = 100;
      //       break;
      //       default:
      //         user.keywordsAuto = {};
      //     }

      //     printDatum(user.screenName, networkInput);

      //     console.log(chalkRed("AUTO KW"
      //       + " | " + user.screenName
      //       + " | MAG: " + networkInput[0].toFixed(6)
      //       + " | SCORE: " + networkInput[1].toFixed(6)
      //       + " | L: " + networkOutput[0].toFixed(3)
      //       + " | N: " + networkOutput[1].toFixed(3)
      //       + " | R: " + networkOutput[2].toFixed(3)
      //       + " | KWs: " + Object.keys(user.keywords)
      //       + " | AKWs: " + Object.keys(user.keywordsAuto)
      //       // + "\n" + jsonPrint(user.keywordsAuto)
      //     ));

      //     callback(err, user);
      //   });
      // });

    });
  }
}

function checkFriendWordKeys(friend, callback){

  // let wordUserHit = false;

  Word.findOne({nodeId: friend.screen_name.toLowerCase()}, function(err, word){

    let kws = {};

    if (err) {
      console.error(chalkError("FIND ONE WORD ERROR: " + err));
      return(callback(err, kws));
    }

    if (!word) {
      console.log(chalkInfo("FRIEND WORD NOT FOUND: " + friend.screen_name.toLowerCase()));
      return(callback(null, kws));
    }

    // wordUserHit = true;

    if (word.keywords === undefined) {
      debug("WORD-USER HIT"
        + " | " + friend.screen_name.toLowerCase()
      );
      return(callback(null,kws));
    }

    // if (!word.keywords || (word.keywords[word.nodeId] === undefined)) {
    if (!word.keywords || (Object.keys(word.keywords).length === 0)) {
      debug("WORD-USER HIT"
        + " | " + friend.screen_name.toLowerCase()
      );
      return(callback(null,kws));
    }

    debug("WORD-USER KEYWORDS"
      + "\n" + jsonPrint(word.keywords)
    );

    // async.each(Object.keys(word.keywords[word.nodeId]), function(kwId, cb){
    async.each(Object.keys(word.keywords), function(kwId, cb){

      if (kwId !== "keywordId") {

        kws[kwId] = word.keywords[kwId];

        debug(chalkTwitter("-- KW"
          + " | " + friend.screen_name.toLowerCase()
          + " | " + kwId
          + " | " + kws[kwId]
        ));

        classifiedUserHashmap[friend.screen_name.toLowerCase()] = kws;
      }
      cb();

    }, function(err){
      debug("WORD-USER HIT"
        + " | " + friend.screen_name.toLowerCase()
        + " | " + Object.keys(kws)
      );
      callback(err, kws);
    });

  });
}

let count = 200;

function fetchFriends(params) {

  debug(chalkInfo("FETCH FRIENDS\n" + jsonPrint(params)));

  return new Promise(function(resolve, reject) {

    if (nextUser) {
      resolve([]);
    }
    else if (!statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
      && languageAnalysisReadyFlag) {

      twitterUserHashMap[currentTwitterUser].twit.get(
        "friends/list", 
        params, 
        function(err, data, response){

        if (err) {
          // console.error(chalkInfo("ERROR " + err));
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
          // else {
          //   clearInterval(waitLanguageAnalysisReadyInterval);
          //   fetchTwitterFriendsIntervalometer.stop();
          // }

          reject(new Error(err));
        }
        else {

          if (data.next_cursor_str > 0) {
            statsObj.user[currentTwitterUser].nextCursorValid = true;
          }
          else {
            statsObj.user[currentTwitterUser].nextCursorValid = false;
            statsObj.user[currentTwitterUser].endFetch = true;
          }

          statsObj.users.grandTotalFriendsFetched += data.users.length;

          statsObj.user[currentTwitterUser].nextCursor = data.next_cursor_str;
          statsObj.user[currentTwitterUser].totalFriendsFetched += data.users.length;
          statsObj.user[currentTwitterUser].percentFetched = 100*(statsObj.user[currentTwitterUser].totalFriendsFetched/statsObj.user[currentTwitterUser].friendsCount); 

          console.log(chalkTwitter(getTimeStamp()
            + " | @" + statsObj.user[currentTwitterUser].screenName
            + " | TOTAL FRIENDS: " + statsObj.user[currentTwitterUser].friendsCount
            + " | COUNT: " + count
            + " | FETCHED: " + data.users.length
            + " | TOTAL FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
            + " [ " + statsObj.user[currentTwitterUser].percentFetched.toFixed(1) + "% ]"
            + " | GRAND TOTAL FETCHED: " + statsObj.users.grandTotalFriendsFetched
            + " | MORE: " + statsObj.user[currentTwitterUser].nextCursorValid
          ));

          const subFriendsSortedArray = sortOn(data.users, "-followers_count");

          async.each(data.users, function(friend, cb){

            if ((currentTwitterUser === "altthreecee00")
              && (twitterUserHashMap.ninjathreecee.friends[friend.id_str] !== undefined)) {

              console.log(chalkAlert("SKIP | ninjathreecee FOLLOWING"
                + " | " + friend.screen_name.toLowerCase()
                + " | " + friend.id_str
              ));

              twitterUserHashMap[currentTwitterUser].twit.post(

                "friendships/destroy", 

                {user_id: friend.id_str}, 

                function(err, data, response){
                  if (err) {
                    console.error(chalkError("UNFOLLOW ERROR" + err));
                  }
                  else {
                    console.log(chalkAlert("UNFOLLOW altthreecee00"
                      + " | " + friend.screen_name.toLowerCase()
                      + " | " + friend.id_str
                    ));
                  }
                  cb();
                }
              );
            }
            else {

              twitterUserHashMap[currentTwitterUser].friends[friend.id_str] = friend;

              checkFriendWordKeys(friend, function(err, kws){
                if (err) {
                  console.log(chalkError("ERROR checkFriendWordKeys | " + err));
                  return(cb(err));
                }
                if (Object.keys(kws).length > 0) {
                  console.log("WORD-USER HIT"
                    + " | " + friend.screen_name.toLowerCase()
                    + " | " + Object.keys(kws)
                  );
                }

                if (neuralNetworkInitialized) {

                  debug(chalkError("NET INITIALIZED"));

                  User.findOne({userId: friend.id_str}, function(err, user){

                    if (err) {
                      console.log(chalkError("ERROR DB FIND ONE USER | " + err));
                      cb(err);
                    }
                    else if (!user) {
                      console.log(chalkError("DB USER NOT FOUND | " + friend.id_str));
                      cb();
                    }
                    else {
                      updateClassifiedUsers(user, function(udatedUser){

                        generateAutoKeywords(udatedUser, function(err, uObj){

                          if (err) {
                            console.log(chalkError("ERROR generateAutoKeywords | UID: " + udatedUser.userId
                              + "\n" + err
                            ));
                            return(cb(err));
                          }

                          userServer.findOneUser(uObj, {noInc: true}, function(err, updatedUserObj){

                            if (err) { 
                              console.log(chalkError("ERROR DB UPDATE USER - generateAutoKeywords"
                                + "\n" + err
                                + "\n" + jsonPrint(uObj)
                              ));
                              return(cb(err));
                            }

                            const keywords = user.keywords ? Object.keys(updatedUserObj.keywords) : "";
                            const keywordsAuto = user.keywordsAuto ? Object.keys(updatedUserObj.keywordsAuto) : "";

                            console.log(chalkInfo("US UPD<"
                              + " | " + updatedUserObj.userId
                              + " | TW: " + (updatedUserObj.isTwitterUser || "-")
                              + " | @" + updatedUserObj.screenName
                              // + " | LA " + Object.keys(updatedUserObj.languageAnalysis)
                              + " | KWs " + keywords
                              + " | AKWs " + keywordsAuto
                            ));

                            cb();
                          });
                        });
                      });
                    }

                  });
                }
                else {
                  cb();
                }
              });
            }

          }, function(){
            resolve(subFriendsSortedArray);
          });
        }
      });
    }
    else {
      resolve([]);
    }

  });
}

function processFriends(){

  console.log(chalkInfo("PROCESS TOTAL FRIENDS FETCHED"
    + " | @" + currentTwitterUser
    + " | " + statsObj.user[currentTwitterUser].totalFriendsFetched
  ));

  return new Promise(function(resolve, reject) {

    if (!statsObj.user[currentTwitterUser].nextCursorValid 
      || nextUser 
      || abortCursor 
      || (configuration.testMode && (statsObj.user[currentTwitterUser].totalFriendsFetched >= 147))
      || (statsObj.user[currentTwitterUser].totalFriendsFetched >= statsObj.user[currentTwitterUser].friendsCount)) {

      console.log(chalkTwitterBold("===== END FETCH USER @" + currentTwitterUser + " ====="
        + " | " + getTimeStamp()
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
            reject(new Error(err));
          }
          statsObj.user[currentTwitterUser].nextCursor = false;
          statsObj.user[currentTwitterUser].nextCursorValid = false;
          statsObj.user[currentTwitterUser].totalFriendsFetched = 0;
          statsObj.user[currentTwitterUser].twitterRateLimit = 0;
          statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
          statsObj.user[currentTwitterUser].twitterRateLimitRemaining = 0;
          statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = 0;
          statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment();

          resolve(currentTwitterUser);
        });

      }
      else if (configuration.quitOnComplete) {
        clearInterval(waitLanguageAnalysisReadyInterval);
        fetchTwitterFriendsIntervalometer.stop();
        resolve(null);
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

        count = 200;

        console.log(chalkError("===== NEW FETCH USER @" 
          + currentTwitterUser + " ====="
          + " | " + getTimeStamp()
        ));

        resolve(currentTwitterUser);
      }

    }

  });
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("\n==================="
    + "\n" + title
    + "\nID:      " + nnObj.networkId
    + "\nCREATED: " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS: " + nnObj.successRate.toFixed(2) + "%"
    + "\nINPUTS:  " + Object.keys(nnObj.inputs)
    + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\n===================\n"
  ));
}


function loadBestNeuralNetworkFile(callback){

  console.log(chalkNetwork("LOADING NEURAL NETWORK FROM DB"));

  let maxSuccessRate = 0;
  let nnCurrent = {};

  NeuralNetwork.find({}, function(err, nnArray){
    if (err) {
      console.log(chalkError("NEUAL NETWORK FIND ERR\n" + err));
      callback(err);
    }
    else if (nnArray.length === 0){
      console.log("NO NETWORKS FOUND");
      callback(err);
    }
    else{
      console.log(nnArray.length + " NETWORKS FOUND");

      async.eachSeries(nnArray, function(nn, cb){

        debug(chalkInfo("NN"
          + " | ID: " + nn.networkId
          + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
        ));

        if (nn.successRate > maxSuccessRate) {

           console.log(chalkNetwork("NEW MAX NN"
            + " | ID: " + nn.networkId
            + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
          ));

          maxSuccessRate = nn.successRate;
          nnCurrent = nn;
          nnCurrent.inputs = nn.inputs;

          cb();

        }
        else if (nn.successRate < MIN_KEEP_NN_SUCCESS_RATE){
          NeuralNetwork.remove({networkId: nn.networkId}, function(err){
            if (err){
              console.log(chalkAlert("NN REMOVE ERROR | ID: " + nn.networkId + "\n" + err));
            }
            else {
              console.log(chalkAlert("NN DELETED"
                + " | MIN: " + MIN_KEEP_NN_SUCCESS_RATE + "%"
                + " | ID: " + nn.networkId
                + " | SUCCESS: " + nn.successRate.toFixed(2) + "%"
              ));
            }
            cb();
          });
        }
        else {
          cb();
        }

      }, function(err){

        if (err) {
          console.log(chalkError("*** loadBestNeuralNetworkFile ERROR\n" + err));
          return(callback(err, null));
        }

        printNetworkObj("LOADING NEURAL NETWORK", nnCurrent);

        if (currentBestNetwork) {

          if (currentBestNetwork.networkId !== nnCurrent.networkId) {

            printNetworkObj("NEW BEST NETWORK", nnCurrent);

            currentBestNetwork = nnCurrent;

            Object.keys(nnCurrent.inputs).forEach(function(type){
              console.log(chalkNetwork("NN INPUTS TYPE" 
                + " | " + type
                + " | INPUTS: " + nnCurrent.inputs[type].length
              ));
              inputArrays[type] = nnCurrent.inputs[type];
            });

            network = neataptic.Network.fromJSON(nnCurrent.network);

            statsObj.currentBestNetworkId = nnCurrent.networkId;
            statsObj.network.networkId = nnCurrent.networkId;
            statsObj.network.networkType = nnCurrent.networkType;
            statsObj.network.successRate = nnCurrent.successRate;
            statsObj.network.input = nnCurrent.network.input;
            statsObj.network.output = nnCurrent.network.output;
            statsObj.network.evolve = {};
            statsObj.network.evolve = nnCurrent.evolve;

            callback(null, nnCurrent);

          }
          else {
            console.log("--- " + nnCurrent.networkId + " | " + nnCurrent.successRate.toFixed(2));

            callback(null, null);
          }
        }
        else {

          currentBestNetwork = nnCurrent;

          printNetworkObj("LOADED BEST NETWORK", nnCurrent);

          Object.keys(nnCurrent.inputs).forEach(function(type){
            console.log(chalkNetwork("NN INPUTS TYPE" 
              + " | " + type
              + " | INPUTS: " + nnCurrent.inputs[type].length
            ));
            inputArrays[type] = nnCurrent.inputs[type];
          });

          network = neataptic.Network.fromJSON(nnCurrent.network);

          statsObj.currentBestNetworkId = nnCurrent.networkId;
          statsObj.network.networkId = nnCurrent.networkId;
          statsObj.network.networkType = nnCurrent.networkType;
          statsObj.network.successRate = nnCurrent.successRate;
          statsObj.network.input = nnCurrent.network.input;
          statsObj.network.output = nnCurrent.network.output;
          statsObj.network.evolve = {};
          statsObj.network.evolve = nnCurrent.evolve;

          callback(null, nnCurrent);

        }
      });
    }
  });
}

function initFetchTwitterFriendsInterval(interval){

  console.log(chalkAlert("INIT GET TWITTER FRIENDS"
    + " | INTERVAL: " + interval + " MS"
    + " | RUN AT: " + moment().add(interval, "ms").format(compactDateTimeFormat)
  ));

  if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
    console.error(chalkAlert("RATE LIMIT EXCEPTION"));
    return;
  }

  statsObj.user[currentTwitterUser].count = 200;
  debug("statsObj.user[currentTwitterUser]\n" + jsonPrint(statsObj.user[currentTwitterUser]));

  fetchTwitterFriendsIntervalometer = timerIntervalometer(function(){

    loadBestNeuralNetworkFile(function(err, nnObj){

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

        fetchFriends(params)
        .then(function(data){
          if (nextUser || statsObj.user[currentTwitterUser].endFetch) {
            nextUser = false;
            processFriends()
            .then(function(newCurrentUser){
              if (newCurrentUser) {
                statsObj.user[currentTwitterUser].endFetch = false;
                debug(chalkInfo("+++ NEW CURRENT USER: " + newCurrentUser));
              }
              else {
                debug(chalkInfo("--- NO NEW CURRENT USER"));
              }
            })
            .catch(function(err){
              console.log(chalkError("PROCESS FRIENDS ERROR: " + err));
            });
          }
        })
        .catch(function(err){
          console.log(chalkError("FETCH FRIENDS ERROR: " + err));
        });
      }

    });
    
  }, interval);

  waitLanguageAnalysisReadyInterval = setInterval(function(){
    if (languageAnalysisReadyFlag){
      clearInterval(waitLanguageAnalysisReadyInterval);
      fetchTwitterFriendsIntervalometer.start();
    }
  }, 100);
}



function initLangAnalyzer(callback){
  console.log(chalkInfo("INIT LANGUAGE ANALYZER CHILD PROCESS"));

  langAnalyzer = cp.fork(`languageAnalyzerChild.js`);

  langAnalyzer.on("message", function(m){
    debug(chalkLog("langAnalyzer RX"
      + " [" + langAnalyzerMessageRxQueue.length + "]"
      + " | " + m.op
      // + " | " + m.obj.userId
      // + " | " + m.obj.screenName
      // + " | " + m.obj.name
      // + "\n" + jsonPrint(m)
    ));
    if (m.op === "LANG_TEST_FAIL") {
      languageAnalysisReadyFlag = false;
      langAnalyzerIdle = false;
      console.log(chalkAlert(getTimeStamp() + " | LANG_TEST_FAIL"));
      quit("LANG_TEST_FAIL");
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisReadyFlag = true;
      langAnalyzerIdle = false;
      console.log(chalkTwitter(getTimeStamp() + " | LANG_TEST_PASS"));
    }
    else if (m.op === "QUEUE_FULL") {
      langAnalyzerIdle = false;
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      langAnalyzerIdle = true;
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisReadyFlag = false;
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
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

  debug(chalkTwitter(cnf.processName 
    // + " STARTED " + getTimeStamp() 
    + "CONFIGURATION\n" + jsonPrint(cnf)
  ));

  if (cnf.loadNeuralNetworkID) {
    cnf.neuralNetworkFile = "neuralNetwork_" + cnf.loadNeuralNetworkID + ".json";
  }
  else {
    cnf.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  loadBestNeuralNetworkFile(function(err, nnObj){
    if (err) { 
      neuralNetworkInitialized = false;
      console.error("LOAD NETWORK ERROR\n" + jsonPrint(err));
    }
    else {
      neuralNetworkInitialized = true;
    }

    initTwitterUsers(function(err){

      if (currentTwitterUser === undefined) { 
        currentTwitterUser = twitterUsersArray[currentTwitterUserIndex];
      }

      console.log(chalkTwitter("CURRENT TWITTER USER: " + currentTwitterUser));

      checkRateLimit();

      initCheckRateLimitInterval(checkRateLimitIntervalTime);
      initLangAnalyzerMessageRxQueueInterval(100);
      initLangAnalyzer();
      
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
