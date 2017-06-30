  /*jslint node: true */
"use strict";

const TWITTER_DEFAULT_USER = "altthreecee00";

let neuralNetworkInitialized = false;
// let nextTwitterUser;
let currentTwitterUser ;
let twitterUsersArray = [];

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;
const ONE_HOUR = ONE_MINUTE*60 ;
// let ONE_DAY = ONE_HOUR*24 ;

let TFE_USER_DB_CRAWL = true;

const Dropbox = require("dropbox");
const os = require("os");
const util = require("util");
const moment = require("moment");
const arrayUnique = require("array-unique");
var Autolinker = require( "autolinker" );

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

let statsObj = {};
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;

const TFE_RUN_ID = hostname + "_" + process.pid + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat);

statsObj.runId = TFE_RUN_ID;

statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());

let configuration = {};

configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.forceLanguageAnalysis = false;


let stdin;

let quitOnComplete = false;
let langAnalyzerIdle = false;
let abortCursor = false;

// let MAX_Q = 500;

// let defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";

const intervalometer = require("intervalometer");
let timerIntervalometer = intervalometer.timerIntervalometer;
let waitLanguageAnalysisReadyInterval;

let network;
// let neataptic = require("./js/neataptic/neataptic.js");
const neataptic = require("neataptic");
// 
const cp = require("child_process");
let langAnalyzer;

const keywordExtractor = require("keyword-extractor");

let histograms = {};
histograms.words = {};
histograms.urls = {};
histograms.hashtags = {};
histograms.mentions = {};

const mentionsRegex = require("mentions-regex");
const hashtagRegex = require("hashtag-regex");
const getUrls = require("get-urls");

const Regex = require("regex");
const ignoreWordRegex = new Regex(/(#|=|&amp|http)/igm);

const Twit = require("twit");
let twit;

let totalFriendsSortedFollowersArray = [];
let totalFriendsSortedFollowingArray = [];

let cursorUser;
let socket;

const async = require("async");
const sortOn = require("sort-on");

const chalk = require("chalk");
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkRed = chalk.red;
const chalkRedBold = chalk.bold.red;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.black;
const chalkInfo = chalk.gray;
const chalkConnect = chalk.bold.green;
const chalkDisconnect = chalk.yellow;
const chalkRss = chalk.blue;

const fs = require("fs");
const yaml = require("yamljs");

const config = require("./config/config");
const keypress = require("keypress");

const events = require("events");
const EventEmitter = require("events").EventEmitter;
const EventEmitter2 = require("eventemitter2").EventEmitter2;

const debug = require("debug")("tfe");

const express = require("./config/express");
const mongoose = require("./config/mongoose");

let twitterConfig = {};

let primarySocketKeepaliveInterval;
let statsUpdateInterval;

let followerUpdateQueueInterval;
let followerUpdateQueue = [];

let langAnalyzerMessageRxQueue = [];

const HashMap = require("hashmap");

let autoClassifiedUserHashmap = {};
let classifiedUserHashmap = {};
const topicHashMap = new HashMap();

const groupHashMap = new HashMap();
const serverGroupHashMap = new HashMap(); // server specific keywords
const entityHashMap = new HashMap();
const serverentityHashMap = new HashMap();

let twitterUserHashMap = {};
let initTweetHashMapComplete = false;

const NodeCache = require( "node-cache" );
const trendingCache = new NodeCache( { stdTTL: 300, checkperiod: 10 } );

// ==================================================================
// MONGO DATABASE CONFIG
// ==================================================================

const db = mongoose();

const Group = require("mongoose").model("Group");
const Entity = require("mongoose").model("Entity");
const User = require("mongoose").model("User");
const Word = require("mongoose").model("Word");

const groupServer = require("./app/controllers/group.server.controller");
const entityServer = require("./app/controllers/entity.server.controller");
const userServer = require("./app/controllers/user.server.controller");
const wordServer = require("./app/controllers/word.server.controller");

let neuralNetworkFile = "neuralNetwork_" + statsObj.runId + ".json";

let defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;

let inputArrays = [];

let checkRateLimitInterval;
let checkRateLimitIntervalTime = 30*ONE_SECOND;
let pollTwitterFriendsIntervalTime = 15*ONE_MINUTE;
let fetchTwitterFriendsIntervalTime = ONE_MINUTE;  // twit.get("friends/list"...) cursor

let langAnalyzerMessageRxQueueInterval;
let langAnalyzerMessageRxQueueReady = true;

function indexOfMax(arr) {
  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return -1;
  }

  let max = 0;
  let maxIndex = -1;
  let i=1;

  for (i = 1; i < arr.length; i+=1) {
    if (arr[i] > max) {
      maxIndex = i;
      max = arr[i];
    }
  }
  if (i === arr.length) { 
    console.log(chalk.blue("indexOfMax: " + maxIndex + " | " + arr[maxIndex] + " | " + arr));
    return maxIndex; 
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
const targetServer = { name: "targetServer", alias: "t", type: String};

const optionDefinitions = [enableStdin, quitOnError, loadNeuralNetworkID, userDbCrawl, testMode, targetServer];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer == "LOCAL"){
  commandLineConfig.targetServer = "http://localhost:9997/util";
}
if (commandLineConfig.targetServer == "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS" + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");



let languageAnalysisReadyFlag = false;
let languageAnalysisQueueFull = false;
let languageAnalysisQueueEmpty = false;

let dbIncMentions = false;

// process.on("message", function(msg) {
//   if (msg == "shutdown") {
//     console.log("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
//     setTimeout(function() {
//       console.log("**** Finished closing connections ****\n\n ***** RELOADING twitterFollowerExplorer.js NOW *****\n\n");
//       process.exit(0);
//     }, 1500);
//   }
// });
process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
});


process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(updateTrendsInterval);
    clearInterval(keepaliveInterval);
    clearInterval(checkRateLimitInterval);
    clearInterval(statsUpdateInterval);

    clearInterval(waitLanguageAnalysisReadyInterval);
    fetchTwitterFriendsIntervalRunning = false;
    fetchTwitterFriendsIntervalometer.stop();

    setTimeout(function() {
      console.log("QUITTING twitterFollowerExplorer");
      process.exit(0);
    }, 300);

  }
});

process.on( "SIGINT", function() {
  quit("SIGINT");
});

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
});

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20
});

configEvents.on("newListener", function(data){
  console.log("*** NEW CONFIG EVENT LISTENER: " + data);
});

// MONGO DB

let initTwitterUsersComplete = false;

// stats
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
statsObj.users.percentFetched = 0;
statsObj.users.grandTotalFriendsFetched = 0;

statsObj.user = {};
statsObj.user.ninjathreecee = {};
statsObj.user.altthreecee00 = {};
// statsObj.user.twitterRateLimit = 180;
// statsObj.user.twitterRateLimitRemaining = 180;
// statsObj.user.twitterRateLimitRemainingTime = 0;
// statsObj.user.twitterRateLimitRemainingMin = 20;
// statsObj.user.twitterRateLimitException = moment();
// statsObj.user.twitterRateLimitResetAt = moment();
// statsObj.user.twitterRateLimitExceptionFlag = false;

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

const DROPBOX_WA_GROUPS_CONFIG_FILE = process.env.DROPBOX_WA_GROUPS_CONFIG_FILE || "groups.json";
const DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE = process.env.DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE || "entityChannelGroups.json";

let defaultDropboxGroupsConfigFile = DROPBOX_WA_GROUPS_CONFIG_FILE;
let dropboxGroupsConfigFile = hostname +  "_" + DROPBOX_WA_GROUPS_CONFIG_FILE;

let defaultDropboxEntityChannelGroupsConfigFile = DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE;
let dropboxEntityChannelGroupsConfigFile = hostname +  "_" + DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE;

let dropboxConfigFolder = "/config/utility";
let dropboxConfigDefaultFolder = "/config/utility/default";
let dropboxConfigHostFolder = "/config/utility/" + hostname;

let dropboxConfigFile = hostname + "_" + DROPBOX_TFE_CONFIG_FILE;
let statsFolder = "/stats/" + hostname;
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

function quit(){
  console.log( "\n... QUITTING ..." );
  showStats(true);
  process.exit();
}

function mute(){
  if (mutedFlag) {
    mutedFlag = false ;
    console.log( "\n... UNMUTE ..." );
  }
  else {
    mutedFlag = true ;
    console.log( "\n... MUTE ..." );
  }
}

function pause(){
  if (pausedFlag) {
    pausedFlag = false ;
    console.log( "\n... RUNNING ..." );
  }
  else {
    pausedFlag = true ;
    console.log( "\n... PAUSED ..." );
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

const sortedObjectValues = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.obj);

    const sortedKeys = keys.sort(function(a,b){
      const objA = params.obj[a];
      const objB = params.obj[b];
      if (params.sortKey) { return objB[params.sortKey] - objA[params.sortKey]; }
      return objB - objA;
    });

    if (keys.length !== undefined) {
      if (params.max) { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
      }
      else { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys});
      }
    }
    else {
      reject(new Error("ERROR"));
    }

  });
};

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

      console.log("\nHIST " + histogramName.toUpperCase() + " | " + keys.length + " ----------");
      sortedKeys.forEach(function(k, i){
        if ((keys.length < 20) || (currentHistogram[k] >= 10) || (i<20)) { console.log(currentHistogram[k] + " | " + k); }
      });

      cb();

    }, function() {
    });



  }
  else {
    if (statsObj.user !== undefined) {
      console.log(chalkLog("- FE S"
        + " | E: " + statsObj.elapsed
        + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
        + " | ACL Us: " + Object.keys(autoClassifiedUserHashmap).length
        + " | CL Us: " + Object.keys(classifiedUserHashmap).length
        + " || " + statsObj.analyzer.analyzed + " ANLs | " + statsObj.analyzer.skipped + " SKPs | " + statsObj.analyzer.total + " TOT"
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

function getTimeNow() {
  const d = new Date();
  return d.getTime();
}

function getTimeStamp(inputTime) {
  let currentTimeStamp ;

  if (typeof inputTime === "undefined") {
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
    .then(function(response){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    })
    .catch(function(error){

      const errorText = (error[error_summary] !== undefined) ? error[error_summary] : jsonPrint(error);
      console.error(chalkError(moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + errorText
        // + " ERROR\n" + jsonPrint(error.error)
      ));
      if (callback !== undefined) { callback(error); }
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

  let fileExists = false;

  dropboxClient.filesListFolder({path: path})
    .then(function(response) {

        async.each(response.entries, function(folderFile, cb) {

          debug("FOUND FILE " + folderFile.name);

          if (folderFile.name == file) {
            debug(chalkRedBold("SOURCE FILE EXISTS: " + file));
            fileExists = true;
          }

          cb();

        }, function(err) {

          if (fileExists) {

            dropboxClient.filesDownload({path: path + "/" + file})
              .then(function(data) {
                console.log(chalkLog(getTimeStamp()
                  + " | LOADING FILE FROM DROPBOX: " + path + "/" + file
                  // + "\n" + jsonPrint(data)
                ));

                const payload = data.fileBinary;
                let fileObj;

                debug(payload);

                if (file.match(/\.json$/gi)) {
                  debug("FOUND JSON FILE: " + file);
                  fileObj = JSON.parse(payload);
                  return(callback(null, fileObj));
                }
                
                if (file.match(/\.yml/gi)) {
                  fileObj = yaml.load(payload);
                  debug(chalkAlert("FOUND YAML FILE: " + file));
                  debug("FOUND YAML FILE\n" + jsonPrint(fileObj));
                  debug("FOUND YAML FILE\n" + jsonPrint(payload));
                  return(callback(null, fileObj));
                }

               })
              .catch(function(error) {
                console.log(chalkAlert("DROPBOX loadFile ERROR: " + file + "\n" + error));
                console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
                console.log(chalkError(jsonPrint(error)));

                if (error.status === 404) {
                  console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND ... SKIPPING ..."));
                  return(callback(null, null));
                }
                if (error.status === 0) {
                  console.error(chalkError("!!! DROPBOX NO RESPONSE ... NO INTERNET CONNECTION? ... SKIPPING ..."));
                  return(callback(null, null));
                }
                return(callback(error, null));
              });
          }
          else {
            console.error(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            console.log(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            // let err = {};
            // err.code = 404;
            // err.status = "FILE DOES NOT EXIST";
            return(callback({code: 404, status: "FILE DOES NOT EXIST"}, null));
          }
        });
    })
    .catch(function(error) {
        console.error(chalkError("*** ERROR LOAD FILE\n" + jsonPrint(error)));
        callback(error, null);
    });
}

const inputArraysFolder = dropboxConfigHostFolder + "/inputArrays";
const inputArraysFile = "inputArrays_" + statsObj.runId + ".json";

const classifiedUsersFolder = dropboxConfigHostFolder + "/classifiedUsers";
const classifiedUsersDefaultFile = "classifiedUsers.json";
const classifiedUsersFile = "classifiedUsers_" + statsObj.runId + ".json";

const autoClassifiedUsersDefaultFile = "autoClassifiedUsers_" + hostname + ".json";
const autoClassifiedUsersFile = "autoClassifiedUsers_" + statsObj.runId + ".json";

const wordHistogramFolder = dropboxConfigHostFolder + "/wordHistogram";
const wordHistogramFile = "wordHistogram_" + statsObj.runId + ".json";

const mentionHistogramFolder = dropboxConfigHostFolder + "/mentionHistogram";
const mentionHistogramFile = "mentionHistogram_" + statsObj.runId + ".json";

const hashtagHistogramFolder = dropboxConfigHostFolder + "/hashtagHistogram";
const hashtagHistogramFile = "hashtagHistogram_" + statsObj.runId + ".json";

const urlHistogramFolder = dropboxConfigHostFolder + "/urlHistogram";
const urlHistogramFile = "urlHistogram_" + statsObj.runId + ".json";

const jsUcfirst = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};

const inputTypes = ["hashtags", "mentions", "urls", "words"];

function initInputArrays(callback){

  console.log(chalkTwitter("INIT INPUT ARRAYS"));

  async.each(inputTypes, function(inputType, cb){

    const inputFile = "defaultInput" + jsUcfirst(inputType) + ".json";

    console.log("INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);

    loadFile(dropboxConfigDefaultFolder, inputFile, function(err, inputArrayObj){
      if (!err) {
        debug(jsonPrint(inputArrayObj));

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays.push(inputArrayObj);

        console.log(chalkAlert("LOADED " + inputType.toUpperCase() + " ARRAY"
          + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
        ));
        cb();
      }
      else {
        console.log(chalkError("ERROR: loadFile: " + dropboxConfigFolder + "/" + file));
        cb(err);
      }
    });
  }, function(err){
    if (err){
      console.log(chalkError("ERR\n" + jsonPrint(err)));
      return(callback(err));
    }
    else {
      console.log(chalkAlert("LOADED INPUT ARRAY FILES"));

      saveFile(inputArraysFolder, inputArraysFile, inputArrays, function(){
        statsObj.inputArraysFile = inputArraysFolder + "/" + inputArraysFile;
        debug("descriptionArrays\n" + jsonPrint(inputArrays));
        return(callback(null));
      });
    }
  });
}

function initStatsUpdate(cnf, callback){

  console.log(chalkAlert("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj);
    showStats();

    saveFile(classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap, function(err){
      if (err){
        console.error(chalkError("SAVE DEFAULT CLASSIFED FILE ERROR"
          + " | " + classifiedUsersDefaultFile
          + " | " + err.error_summary
        ));
      }
      else{
        console.log(chalkLog("SAVED | " + classifiedUsersFolder + "/" + classifiedUsersDefaultFile));
      }
    });

    saveFile(classifiedUsersFolder, classifiedUsersFile, classifiedUserHashmap, function(err){
      if (err){
        console.error(chalkError("SAVE CLASSIFED FILE ERROR"
          + " | " + classifiedUsersFile
          + " | " + err.error_summary
        ));
      }
      else{
        console.log(chalkLog("SAVED | " + classifiedUsersFolder + "/" + classifiedUsersFile));
      }
    });

    saveFile(classifiedUsersFolder, autoClassifiedUsersFile, autoClassifiedUserHashmap, function(err){
      if (err){
        console.error(chalkError("SAVE AUTO CLASSIFED FILE ERROR"
          + " | " + autoClassifiedUsersFile
          + " | " + err.error_summary
        ));
      }
      else{
        console.log(chalkLog("SAVED | " + classifiedUsersFolder + "/" + autoClassifiedUsersFile));
      }
    });


    Object.keys(histograms).forEach(function(histogramName){

      const currentHistogram = histograms[histogramName];

      const keys = Object.keys(currentHistogram);

      const sortedKeys = keys.sort(function(a,b){
        const valA = currentHistogram[a];
        const valB = currentHistogram[b];
        return valB - valA;
      });

      sortedKeys.forEach(function(k){
        if (currentHistogram[k] >= 100) { console.log("H | " + currentHistogram[k] + " | " + k); }
      });

      const currentHistogramFolder = dropboxConfigHostFolder + "/histograms/" + histogramName + "Histogram";
      const currentHistogramFile = histogramName + "Histogram_" + statsObj.runId + ".json";

      saveFile(currentHistogramFolder, currentHistogramFile, currentHistogram, function(err){
        console.log(chalkLog("SAVED | " + currentHistogramFolder + "/" + currentHistogramFile));
      });

    });


    if (quitOnComplete && langAnalyzerIdle && !cnf.testMode && !statsObj.nextCursorValid) {
      console.log(chalkTwitterBold(moment().format(compactDateTimeFormat)
        + " | QUITTING ON COMPLETE"
      ));

      fetchTwitterFriendsIntervalRunning = false;
      fetchTwitterFriendsIntervalometer.stop();

      clearInterval(waitLanguageAnalysisReadyInterval);
      clearInterval(statsUpdateInterval);

      saveFile(classifiedUsersFolder, classifiedUsersDefaultFile, classifiedUserHashmap, function(err){
        setTimeout(function(){
          quit("QUIT ON COMPLETE");
        }, 2000);
      });

    }

  }, cnf.statsUpdateIntervalTime);

  loadFile(statsFolder, statsFile, function(err, loadedStatsObj){
    if (!err) {
      debug(jsonPrint(loadedStatsObj));
      return(callback(null, cnf));
    }
    else {
      return(callback(err, cnf));
    }
  });
}

function initTwitterUsers(cnf, callback){

  if (!configuration.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    if (callback !== undefined) {callback(null, null);}
  }
  else{

    let twitterDefaultUser = cnf.twitterDefaultUser;
    twitterUsersArray = Object.keys(cnf.twitterUsers);

    // if (!currentTwitterUser) { currentTwitterUser = twitterUsersArray[0]; }

    console.log(chalkTwitter("USERS"
      + " | FOUND: " + twitterUsersArray.length
      // + " | DEFAULT: " + twitterDefaultUser
      + "\n" + jsonPrint(cnf)
    ));

    twitterUsersArray.forEach(function(userId){

      userId = userId.toLowerCase();

      let twitterUserObj = {};

      debug("userId: " + userId);
      debug("screenName: " + cnf.twitterUsers[userId]);

      twitterUserObj.isDefault = (twitterDefaultUser === userId) || false;
      twitterUserObj.userId = userId ;
      twitterUserObj.screenName = cnf.twitterUsers[userId] ;

      twitterUserHashMap[userId] = twitterUserObj;

      console.log(chalkRss("ADDED TWITTER USER"
        + " | NAME: " + userId
        + " | FEED ID: " + twitterUserHashMap[userId].userId
        + " | DEFAULT USER: " + twitterUserHashMap[userId].isDefault
      ));

    });

    if (callback !== undefined) {callback(null, twitterUserHashMap);}
  }
}

function socketReconnect(cnf, sckt){
  if (typeof sckt !== "undefined"){
    setTimeout(function(){
      console.log(chalkConnect("==> RECONNECT ATTEMPT | " + cnf.targetServer));
      sckt.connect(cnf.targetServer, { reconnection: false });
    }, 60000);
  }
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
  cnf.targetServer = process.env.TFE_UTIL_TARGET_SERVER || "http://localhost:9997/util" ;

  cnf.enableLanguageAnalysis = process.env.TFE_ENABLE_LANG_ANALYSIS || true ;
  cnf.forceLanguageAnalysis = process.env.TFE_FORCE_LANG_ANALYSIS || false ;

  // if (process.env.TFE_FORCE_LANG_ANALYSIS !== undefined) {
  //   if (process.env.TFE_FORCE_LANG_ANALYSIS === "true") {
  //     configuration.enableLanguageAnalysis = true;
  //   }
  //   else {
  //     configuration.enableLanguageAnalysis = false;
  //   }
  // }
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

      if (loadedConfigObj.TFE_UTIL_TARGET_SERVER !== undefined){
        console.log("LOADED TFE_UTIL_TARGET_SERVER: " + loadedConfigObj.TFE_UTIL_TARGET_SERVER);
        cnf.targetServer = loadedConfigObj.TFE_UTIL_TARGET_SERVER;
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

      if (cnf.enableStdin){

        console.log("STDIN ENABLED");

        stdin = process.stdin;
        if(typeof stdin.setRawMode !== "undefined") {
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
            // case "c":
            //   configuration.cursorUserPause = !configuration.cursorUserPause;
            //   if (configuration.cursorUserPause) {
            //     // cursorUser.pause();
            //   }
            //   else {
            //     // cursorUser.resume();
            //   }
            //   console.log(chalkRedBold("CURSOR USER PAUSE: " + configuration.cursorUserPause));
            // break;
            case "q":
              quit();
            break;
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

      initStatsUpdate(cnf, function(err, cnf2){

        loadFile(cnf2.twitterConfigFolder, cnf2.twitterConfigFile, function(err, tc){
          if (err){
            console.error(chalkError("*** TWITTER YAML CONFIG LOAD ERROR\n" + err));
            quit();
            return;
          }

          cnf2.twitterConfig = {};
          cnf2.twitterConfig = tc;

          console.log(chalkInfo(getTimeStamp() + " | TWITTER CONFIG FILE " 
            + cnf2.twitterConfigFolder
            + cnf2.twitterConfigFile
            // + "\n" + jsonPrint(cnf2.twitterConfig )
          ));

          initInputArrays(function(err){
            return(callback(err, cnf2));
          });

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

      if (cnf.enableStdin){

        console.log("STDIN ENABLED");

        stdin = process.stdin;
        if(typeof stdin.setRawMode !== "undefined") {
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
              quit();
            break;
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

      initStatsUpdate(cnf, function(err, cnf2){
        initInputArrays(function(err){
          return(callback(err, cnf));
        });
      });
     }
  });
}

function loadYamlConfig(yamlFile, callback){
  console.log(chalkInfo("LOADING YAML CONFIG FILE: " + yamlFile));
  fs.exists(yamlFile, function(exists) {
    if (exists) {
      let cnf = yaml.load(yamlFile);
      console.log(chalkInfo("FOUND FILE " + yamlFile));
      callback(null, cnf);
    }
    else {
      const err = "FILE DOES NOT EXIST: " + yamlFile ;
      callback(err, null);
    }
  });
}

function initTwitter(currentTwitterUser, cnf, callback){

  let twitterConfigFile =  currentTwitterUser + ".json";

  loadFile(cnf.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      if (callback !== undefined) {callback(null, "INIT_TWIT_FOR_DM_ERROR");}
    }
    else {
      console.log(chalkTwitter("LOADED TWITTER CONFIG | " + twitterConfigFile + "\n" + jsonPrint(twitterConfig)));

      twit = new Twit({
        consumer_key: twitterConfig.CONSUMER_KEY,
        consumer_secret: twitterConfig.CONSUMER_SECRET,
        access_token: twitterConfig.TOKEN,
        access_token_secret: twitterConfig.TOKEN_SECRET
      });

      twit.get("account/settings", function(err, data, response) {
        if (err){
          console.log("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() + "\n" + jsonPrint(err));
          if (callback !== undefined) {callback(null, "INIT_TWIT_FOR_DM_ERROR");}
        }
        else {
          console.log(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: " + data.screen_name));
          debug(chalkTwitter("TWITTER ACCOUNT SETTINGS\n" + jsonPrint(data)));

          twit.get("users/show", {screen_name: data.screen_name}, function(err, data, response) {
            if (err){
              console.log("!!!!! TWITTER SHOW USER ERROR | @" + data.screen_name + " | " + getTimeStamp() 
                + "\n" + jsonPrint(err));
              if (callback !== undefined) {callback(null, "INIT_TWIT_FOR_DM_ERROR");}
              return;
            }
            // else{

            debug(chalkTwitter("TWITTER USER\n" + jsonPrint(data)));

            statsObj.user[currentTwitterUser] = {};
            statsObj.user[currentTwitterUser] = data;
            statsObj.user[currentTwitterUser].totalFriendsFetched = 0;

            console.log(chalkTwitterBold("TWITTER USER\n==================="
              + "\nID: " + statsObj.user[currentTwitterUser].id_str 
              + "\n" + statsObj.user[currentTwitterUser].name 
              + "\n@" + statsObj.user[currentTwitterUser].screen_name 
              + "\n" + statsObj.user[currentTwitterUser].description 
              + "\n" + statsObj.user[currentTwitterUser].url 
              + "\nTWEETS:    " + statsObj.user[currentTwitterUser].statuses_count 
              + "\nFOLLOWING: " + statsObj.user[currentTwitterUser].friends_count 
              + "\nFOLLOWERS: " + statsObj.user[currentTwitterUser].followers_count 
              // + "\n" + jsonPrint(data)
            ));
            // }
          });

          twit.get("application/rate_limit_status", function(err, data, response) {
            if (err){
              console.log("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() 
                + "\n" + jsonPrint(err));
              if (callback !== undefined) {callback(null, "INIT_TWIT_FOR_DM_ERROR");}
              return;
            }
            // else{
             if (callback !== undefined) {callback(null, "INIT_TWIT_FOR_DM_COMPLETE");}
             // callback(null, "INIT_TWIT_FOR_DM_COMPLETE");
              // configEvents.emit("INIT_TWIT_FOR_DM_COMPLETE");
            // }
          });
        }
      });
    }

  });
}

function sendKeepAlive(userObj){
  if (statsObj.userReadyAck && statsObj.serverConnected){
    debug(chalkLog("TX KEEPALIVE"
      + " | " + moment().format(compactDateTimeFormat)
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    // callback(null, null);
  }
  // else {
  //   callback("ERROR", null);
  // }
}

function initSocket(cnf, callback){

  console.log(chalkLog("INIT SOCKET"
    + " | " + cnf.targetServer
    + " | " + jsonPrint(serverUserObj)
  ));

  socket = require("socket.io-client")(cnf.targetServer, { reconnection: true });

  socket.on("connect", function(){

    statsObj.serverConnected = true ;
    statsObj.socketId = socket.id;

    console.log(chalkConnect( "CONNECTED TO HOST" 
      + " | SERVER: " + cnf.targetServer 
      + " | ID: " + socket.id 
      ));

    console.log(chalkInfo(socket.id 
      + " | TX USER_READY"
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + serverUserObj.userId
      + " | " + serverUserObj.screenName
      + " | " + serverUserObj.type
      + " | " + serverUserObj.mode
      + "\n" + jsonPrint(serverUserObj.tags)
    ));

    socket.emit("USER_READY", serverUserObj); 
  });

  socket.on("reconnect", function(err){
    statsObj.socketId = socket.id;
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = true;
    console.log(chalkConnect(moment().format(compactDateTimeFormat) 
      + " | SOCKET RECONNECT: " + socket.id
    ));
  });

  socket.on("USER_READY_ACK", function(userId) {
    statsObj.userReadyAck = true ;
    console.log(chalkInfo(socket.id 
      + " | RX USER_READY_ACK"
      + " | " + moment().format(compactDateTimeFormat)
    ));

    primarySocketKeepaliveInterval = setInterval(function(){ // TX KEEPALIVE
      sendKeepAlive(serverUserObj);
    }, cnf.keepaliveInterval);

  });

  socket.on("error", function(error){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    socket.disconnect();
    console.error(chalkError(moment().format(compactDateTimeFormat) 
      + " | *** SOCKET ERROR"
      + " | " + socket.id
      + " | " + error
    ));
    // socketReconnect(cnf);
  });

  socket.on("connect_error", function(err){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    console.error(chalkError("*** CONNECT ERROR " 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
      // + "\n" + jsonPrint(err)
    ));
    // reset();
  });

  socket.on("reconnect_error", function(err){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    debug(chalkError("*** RECONNECT ERROR" 
      + " | " + moment().format(compactDateTimeFormat)
      // + "\n" + jsonPrint(err)
    ));
    // socketReconnect(cnf);
  });

  socket.on("SESSION_ABORT", function(sessionId){
    console.log(chalkDisconnect("@@@@@ RX SESSION_ABORT | " + sessionId));
  });

  socket.on("SESSION_EXPIRED", function(sessionId){
    console.log(chalkDisconnect("@@@@@ RX SESSION_EXPIRED | " + sessionId));
    socket.disconnect();
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false;
    // socketReconnect(cnf);
  });

  socket.on("disconnect", function(){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false;
    console.log(chalkConnect(moment().format(compactDateTimeFormat) 
    ));
    // socketReconnect(cnf);
  });

  socket.on("HEARTBEAT", function(heartbeat){
    statsObj.heartbeatsReceived+= 1;
  });

  socket.on("KEEPALIVE_ACK", function(userId) {
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });

  callback(null, null);
}

function checkRateLimit(callback){

  twit.get("application/rate_limit_status", function(err, data, response) {
    if (err){
      console.error("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() + "\n" + JSON.stringify(err, null, 3));
      statsObj.twitterErrors+= 1;
      callback(err, null);
      // return;
    }
    else {
      debug(chalkTwitter("\n-------------------------------------\nTWITTER RATE LIMIT STATUS\n" 
        + JSON.stringify(data, null, 3)
      ));

      statsObj.user[currentTwitterUser].twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      debug(chalkInfo("TWITTER RATE LIMIT STATUS"
        + " | " + getTimeStamp()
        + " | LIMIT " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REMAINING " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | RESET " + getTimeStamp(statsObj.user[currentTwitterUser].twitterRateLimitResetAt)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        // application/rate_limit_status
        // + "\n" + jsonPrint(data)
      ));

      // let remainingTime = 1000*data.resources.application["/application/rate_limit_status"].reset - Date.now();
      // debug(chalkInfo(getTimeStamp() 
      //   + " | TWITTER ACCOUNT RATE: LIMIT: " + data.resources.application["/application/rate_limit_status"].limit
      //   + " | REMAINING: " + data.resources.application["/application/rate_limit_status"].remaining
      //   + " | RESET AT: " + getTimeStamp(1000*data.resources.application["/application/rate_limit_status"].reset)
      //   + " | IN " + msToTime(remainingTime)
      // ));
      callback(null, data.resources.application["/application/rate_limit_status"]);
    }
  });
}

function initCheckRateLimitInterval(interval){

  checkRateLimitInterval = setInterval(function(){

    if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
      && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){

      statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;

      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
        + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
        + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
        + " | NOW: " + moment().format(compactDateTimeFormat)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
      ));

      // fsm.twitterLimitReset();

    }
    else {
      checkRateLimit(function(err, status){
        if (err){
          console.log(chalkError("checkRateLimit ERROR\n" + err));
        }
        else {

          statsObj.user[currentTwitterUser].twitterRateLimit = status.limit;
          statsObj.user[currentTwitterUser].twitterRateLimitRemaining = status.remaining;
          statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

          // console.log(jsonPrint(status));

          if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){
            statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
            statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*status.reset);
            console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
              + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
              + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
              + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
              + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
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
            statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*status.reset);
            debug(chalkInfo("... NO TWITTER RATE LIMIT"
              + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
              + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
              // + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
              + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
            ));
          }
        }
      });

    }

  }, interval);
}

function initLangAnalyzerMessageRxQueueInterval(interval){

  langAnalyzerMessageRxQueueReady = true;

  console.log(chalkInfo("INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));

  let langEntityKeys = [];

  langAnalyzerMessageRxQueueInterval = setInterval(function () {

    if (langAnalyzerMessageRxQueueReady && (langAnalyzerMessageRxQueue.length > 0)) {

      langAnalyzerMessageRxQueueReady = false;

      let m = langAnalyzerMessageRxQueue.shift();

      let params = {
        noInc: true
      };

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
                const kws = updatedUserObj.keywords && (updatedUserObj.keywords !== undefined) ? Object.keys(updatedUserObj.keywords) : [];
                const kwsAuto = updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined) ? Object.keys(updatedUserObj.keywordsAuto) : [];

                console.log(chalkLog("DB UPDATE USER"
                  + " | UID: " + updatedUserObj.userId
                  // + " | NID: " + updatedUserObj.nodeId
                  + " | SN: " + updatedUserObj.screenName
                  + " | N: " + updatedUserObj.name
                  + " | KWs: " + kws
                  + " | KWAuto: " + kwsAuto
                  + " | LAd: " + updatedUserObj.languageAnalyzed
                  + "\nLA Es: " + laEnts
                ));
              }
              langAnalyzerMessageRxQueueReady = true;
            }); 

            break;
          }


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
          }, function(err) {

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
                const kws = updatedUserObj.keywords && (updatedUserObj.keywords !== undefined) ? Object.keys(updatedUserObj.keywords) : [];
                const kwsAuto = updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined) ? Object.keys(updatedUserObj.keywordsAuto) : [];

                console.log(chalkLog("DB UPDATE USER"
                  + " | UID: " + updatedUserObj.userId
                  // + " | NID: " + updatedUserObj.nodeId
                  + " | SN: " + updatedUserObj.screenName
                  + " | N: " + updatedUserObj.name
                  + " | KWs: " + kws
                  + " | KWAuto: " + kwsAuto
                  + " | LAd: " + updatedUserObj.languageAnalyzed
                  + "\nLA Es: " + laEnts
                ));
              }
              langAnalyzerMessageRxQueueReady = true;
            }); 

          });

        break;

        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisQueueEmpty = false;
          languageAnalysisQueueFull = true;
          languageAnalysisReadyFlag = false;
          langAnalyzerMessageRxQueueReady = true;
          if (cursorUser) { cursorUser.pause(); }
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisQueueEmpty = true;
          languageAnalysisQueueFull = false;
          languageAnalysisReadyFlag = true;
          langAnalyzerMessageRxQueueReady = true;
          if (cursorUser) { cursorUser.resume(); }
        break;

        default:
          console.log(chalkError("??? UNKNOWN LANG_ANALIZE OP: " + m.op
          ));
          langAnalyzerMessageRxQueueReady = true;
      }
    }
  }, interval);
}

function initClassifiedUserHashmap(folder, file, callback){

  console.log(chalkAlert("INIT CLASSIFED USERS HASHMAP: " + folder + "/" + file));

  loadFile(folder, file, function(err, classifiedUsersObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkAlert("LOADED CLASSIFED USERS FILE: " + folder + "/" + file));
      console.log(chalkAlert("LOADED " + Object.keys(classifiedUsersObj).length + " CLASSIFED USERS"));
      callback(null, classifiedUsersObj);
    }
  });
}

let fetchTwitterFriendsIntervalRunning = false;
let fetchTwitterFriendsIntervalometer;

statsObj.nextCursorValid = false;
let totalFriendsArray = [];
let nextCursor = false;
let count = 200;
let twitPromise;

function fetchTwitterFriends(cnf, callback){

  console.log(chalkAlert(moment().format(compactDateTimeFormat)
    + " | GET TWITTER FRIENDS"
    + " | READY: " + languageAnalysisReadyFlag
  ));

  let params = {};

  if (!statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag && languageAnalysisReadyFlag) {

    params.count = 200;

    if (statsObj.nextCursorValid) { params.cursor = parseInt(nextCursor); }

    twitPromise = twit.get("friends/list", params, function(err, data, response){

      if (err) {
        console.log(chalkError(getTimeStamp()
          + " | *** ERROR GET TWITTER FRIENDS: " + err
        ));

        if (err.code == 88){
          statsObj.user[currentTwitterUser].twitterRateLimitException = moment();
          statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = true;

          // fsm.twitterExceedLimit();
        }
        else {
          clearInterval(waitLanguageAnalysisReadyInterval);
          fetchTwitterFriendsIntervalometer.stop();
          fetchTwitterFriendsIntervalRunning = false;

          // fsm.twitterError();
        }
        return(callback(err, null));
      }

      if (data.next_cursor_str > 0) {
        statsObj.nextCursorValid = true;
      }
      else {
        statsObj.nextCursorValid = false;
      }

      nextCursor = data.next_cursor_str;
      statsObj.users.grandTotalFriendsFetched += data.users.length;
      statsObj.user[currentTwitterUser].totalFriendsFetched += data.users.length;
      statsObj.user[currentTwitterUser].percentFetched = 100*(statsObj.user[currentTwitterUser].totalFriendsFetched/statsObj.user[currentTwitterUser].friends_count); 

      console.log(chalkRed("@" + statsObj.user[currentTwitterUser].screen_name
        + " | TOTAL FRIENDS: " + statsObj.user[currentTwitterUser].friends_count
        + " | COUNT: " + count
        + " | FETCHED: " + data.users.length
        + " | TOTAL FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
        + " | GRAND TOTAL FETCHED: " + statsObj.users.grandTotalFriendsFetched
        + " [ " + statsObj.users.percentFetched.toFixed(1) + "% ]"
        + " | MORE: " + statsObj.nextCursorValid
      ));

      const subFriendsSortedArray = sortOn(data.users, "-followers_count");

      subFriendsSortedArray.forEach(function(friend){

        totalFriendsArray.push(friend);

        console.log(chalkTwitter("FRND"
          + "[" + totalFriendsArray.length + "]"
          + " | FLWRs: " + friend.followers_count
          // + " " + friend.id_str
          + " | " + friend.screen_name
          + " | " + friend.name
          + " | FLWING: " + friend.friends_count
          + " | Ts: " + friend.statuses_count
          // + "\n---: " + jsonPrint(friend)
        ));

        Word.findOne({nodeId: friend.screen_name.toLowerCase()}, function(err, word){

          let kws = {};

          if (!err && (word)) {

            debug(chalkAlert("WORD-USER HIT"
              + " | " + word.nodeId
              // + "\n" + jsonPrintword)
            ));


            if (word.keywords !== undefined) {
              if (word.keywords && (word.keywords[word.nodeId] !== undefined)) {
                 Object.keys(word.keywords[word.nodeId]).forEach(function(kwId){
                  if (kwId !== "keywordId") {
                    kws[kwId] = word.keywords[word.nodeId][kwId];
                    console.log(chalkAlert("-- KW"
                      + " | " + kwId
                      + " | " + kws[kwId]
                    ));
                  }
                });
              }
            }
          }

          let userObj = new User();

          userObj.isTwitterUser = true;

          userObj.threeceeFollowing = {};
          userObj.threeceeFollowing.userId = statsObj.user[currentTwitterUser].id_str;
          userObj.threeceeFollowing.screenName = statsObj.user[currentTwitterUser].screen_name;

          userObj.nodeId = friend.id_str;
          userObj.userId = friend.id_str;
          userObj.screenName = friend.screen_name.toLowerCase();
          userObj.name = friend.name;
          userObj.groupId = userObj.userId;
          userObj.url = friend.url;
          userObj.statusesCount = friend.statuses_count;
          userObj.friendsCount = friend.friends_count;
          userObj.followersCount = friend.followers_count;
          userObj.verified = friend.verified;
          userObj.description = friend.description;
          userObj.entities = friend.entities;
          userObj.tags.user = friend.screen_name.toLowerCase();
          userObj.tags.channel = "twitter";
          userObj.tags.twitter = {};
          userObj.tags.twitter.tweets = friend.statuses_count;
          userObj.tags.twitter.friends = friend.friends_count;
          userObj.tags.twitter.followers = friend.followers_count;
          userObj.tags.group = "";
          userObj.keywords = kws;
          userObj.status = friend.status;

          if (classifiedUserHashmap[userObj.userId] !== undefined){
            userObj.keywords = classifiedUserHashmap[userObj.userId];
            console.log(chalkTwitter("USER CLASSIFED"
              + " | " + userObj.userId
              + " | @" + userObj.screenName
              + " | " + userObj.name
              + " | " + Object.keys(userObj.keywords)
            ));
          }

          userServer.findOneUser(userObj, {noInc: true}, function(err, updatedUserObj){

            console.log(chalkInfo("<DB USER"
              + " | " + updatedUserObj.userId
              + " | " + updatedUserObj.screenName
              + "\nKWs: " + jsonPrint(updatedUserObj.keywords)
              // + " | LA: " + jsonPrint(updatedUserObj.languageAnalysis)
            ));

            processUser(configuration, updatedUserObj, function(err, user){

              if (neuralNetworkInitialized) {

                generateAutoKeywords(user, function(err, uObj){

                    userServer.findOneUser(uObj, {noInc: true}, function(err, updatedUserObj){
                      if (err) { 
                        console.log(chalkError("ERROR DB UPDATE USER - generateAutoKeywords"
                          + "\n" + err
                          + "\n" + jsonPrint(uObj)
                        ));
                      }
                      else {
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
                      }
                    });

                    // let keywords = user.keywords ? Object.keys(updatedUserObj.keywords) : "";
                });
              }

            });

          });
        });
      });

      if (!statsObj.nextCursorValid 
        || abortCursor 
        || (cnf.testMode && (statsObj.user[currentTwitterUser].totalFriendsFetched >= 147))
        // || (statsObj.users.totalFriendsFetched >= statsObj.user[currentTwitterUser].friends_count)) {
        || (statsObj.user[currentTwitterUser].totalFriendsFetched >= statsObj.user[currentTwitterUser].friends_count)) {


        console.log(chalkError("===== END TWITTER USER @" + currentTwitterUser + " ====="
          + " | " + getTimeStamp()
        ));


        totalFriendsSortedFollowersArray = sortOn(totalFriendsArray, "-followers_count");
        totalFriendsSortedFollowingArray = sortOn(totalFriendsArray, "-friends_count");

        console.log(chalkTwitter("TOTAL FRIENDS"
          + " [" + totalFriendsArray.length + "]"
        ));

        let index = 1;
        totalFriendsSortedFollowersArray.forEach(function(friend){
          debug(chalkTwitter("FRIEND"
            + " [" + index + "/" + totalFriendsArray.length + "]"
            + " | FLWRs: " + friend.followers_count
            + " | " + friend.id_str
            + " | " + friend.name
            + " | " + friend.screen_name
            + " | FLWING: " + friend.friends_count
            + " | Ts: " + friend.statuses_count
          ));
          index+= 1;
        });

        console.log(chalkTwitterBold("TOTAL FRIENDS - FOLLOWING"
          + " [" + totalFriendsArray.length + "]"
        ));

        index = 1;
        totalFriendsSortedFollowingArray.forEach(function(friend){
          debug(chalkTwitter("FRIEND"
            + " [" + index + "/" + totalFriendsArray.length + "]"
            + " | FLWING: " + friend.friends_count
            + " | " + friend.name
            + " | " + friend.screen_name
            + " | FLWRs: " + friend.followers_count
            + " | Ts: " + friend.statuses_count
          ));
          index+= 1;
        });

        let totalFriends = totalFriendsArray.length;
        totalFriendsArray = [];

        if (twitterUsersArray.length > 0) {

          if (currentTwitterUser == twitterUsersArray[0]) { twitterUsersArray.shift(); }
          currentTwitterUser = twitterUsersArray.shift();

          console.log(chalkError("===== NEW TWITTER USER @" + currentTwitterUser + " ====="
            + " | " + getTimeStamp()
          ));
          statsObj.nextCursorValid = false;
          nextCursor = false;
          initTwitter(currentTwitterUser, cnf);
        }
        else {
          // fsm.fetchTwitterFriendsEnd();
          abortCursor = false;
          clearInterval(waitLanguageAnalysisReadyInterval);
          fetchTwitterFriendsIntervalRunning = false;
          fetchTwitterFriendsIntervalometer.stop();

          setTimeout(function(){
            quit();
          }, 5000);
        }



        return callback(err, totalFriends);
      }
    });
  }
}

function initFetchTwitterFriendsInterval(interval){

  console.log(chalkAlert("INIT GET TWITTER FRIENDS"
    + " | INTERVAL: " + interval + " MS"
    + " | RUN AT: " + moment().add(interval, "ms").format(compactDateTimeFormat)
  ));

  if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
    return (callback("RATE LIMIT EXCEPTION", null));
  }

  fetchTwitterFriendsIntervalRunning = true;

  fetchTwitterFriendsIntervalometer = timerIntervalometer(function(){
    fetchTwitterFriends(configuration, function(){
      debug("fetchTwitterFriends done");
    });
  }, interval);


  waitLanguageAnalysisReadyInterval = setInterval(function(){
    if (languageAnalysisReadyFlag){
      clearInterval(waitLanguageAnalysisReadyInterval);
      fetchTwitterFriendsIntervalometer.start();
    }
  }, 100);

  // KLUDGE TO FORCE IMMEDIATE GET TWITTER FRIENDS
  // fetchTwitterFriends(function(){
  //   fetchTwitterFriendsIntervalometer.start();
  // });
}

const wordExtractionOptions = {
  language:"english",
  remove_digits: true,
  return_changed_case: true,
  remove_duplicates: true
};

var parser = new Autolinker( {
  email: false,
  urls: true,
  hashtag: "twitter",
  mention: "twitter"
} );


function parseText(text, options, callback){

  const parseResults = parser.parse( text );

  console.log(chalk.blue("\ntext\n" + text));
  // console.log(chalk.blue("parseResults\n" + jsonPrint(parseResults) + "\n"));

  let urlArray = [];
  let mentionArray = [];
  let hashtagArray = [];

  async.each(parseResults, function(matchObj, cb){
    const type = matchObj.getType();
    debug("type: " + type);
    switch (type) {
      case "url":
        console.log(chalkInfo("URL: " + matchObj.getMatchedText().toLowerCase()));
        urlArray.push(matchObj.getMatchedText().toLowerCase());
        cb();
      break;
      case "mention":
        mentionArray.push(matchObj.getMatchedText().toLowerCase());
        console.log(chalkInfo(mentionArray.length + " | MEN: " + matchObj.getMatchedText().toLowerCase()));
        cb();
      break;
      case "hashtag":
        hashtagArray.push(matchObj.getMatchedText().toLowerCase());
        console.log(chalkInfo(hashtagArray.length + " | HTG: " + matchObj.getMatchedText().toLowerCase()));
        cb();
      break;
      default:
        console.error(chalkError("UNKNOWN PARSE TYPE: " + type));
        cb();
    }
   }, function(err){
    // const mentionArray = mentionsRegex().exec(text);
    // const hashtagArray = hashtagRegex().exec(text);
    // const urlArray = Array.from(getUrls(text));
    const wordArray = keywordExtractor.extract(text, wordExtractionOptions);

    const userHistograms = {};
    userHistograms.words = {};
    userHistograms.urls = {};
    userHistograms.hashtags = {};
    userHistograms.mentions = {};

    async.parallel({
      mentions: function(cb){
        if (mentionArray) {
          // mentionArray.forEach(function(userId){
          async.each(mentionArray, function(userId, cb2){
            if (!userId.match("@")) {
              userId = "@" + userId.toLowerCase();
              if (options.updateGlobalHistograms) {
                histograms.mentions[userId] = (histograms.mentions[userId] === undefined) ? 1 : histograms.mentions[userId]+1;
              }
              userHistograms.mentions[userId] = (userHistograms.mentions[userId] === undefined) ? 1 : userHistograms.mentions[userId]+1;
              debug(chalkAlert("->- DESC Ms"
                + " | " + userHistograms.mentions[userId]
                + " | " + userId
              ));
              cb2();
            }
          }, function(err){
            cb(null, userHistograms.mentions);
          });

          // });
        }
        else {
          cb(null, userHistograms.mentions);
        }
      },
      hashtags: function(cb){
        if (hashtagArray) {
          hashtagArray.forEach(function(hashtag){
            hashtag = hashtag.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.hashtags[hashtag] = (histograms.hashtags[hashtag] === undefined) ? 1 : histograms.hashtags[hashtag]+1;
            }
            userHistograms.hashtags[hashtag] = (userHistograms.hashtags[hashtag] === undefined) ? 1 : userHistograms.hashtags[hashtag]+1;
            debug(chalkAlert("->- DESC Hs"
              + " | " + userHistograms.hashtags[hashtag]
              + " | " + hashtag
            ));
          });
          cb(null, userHistograms.hashtags);
        }
        else {
          cb(null, userHistograms.hashtags);
        }
      },
      words: function(cb){
        if (wordArray) {
          wordArray.forEach(function(w){
            let word = w.toLowerCase();
            word = word.replace(/'s/gi, "");
            const m = mentionsRegex().exec(word);
            const h = hashtagRegex().exec(word);
            // const rgx = ignoreWordRegex.test(word);
            const u = (Array.from(getUrls(text)).length > 0) ? Array.from(getUrls(text)) : null;
            if (m || h || u 
              || (word === "/") 
              || word.includes("--") 
              || word.includes("|") 
              || word.includes("#") 
              || word.includes("w/") 
              || word.includes("≠") 
              || word.includes("http") 
              || word.includes("+")) {
              // if (rgx) { console.log(chalkAlert("-- REGEX SKIP WORD"
              //   + " | M: " + m
              //   + " | H: " + h
              //   + " | U: " + u
              //   + " | RGX: " + rgx
              //   + " | " + word
              // )) };
              debug(chalkAlert("-- SKIP WORD"
                + " | M: " + m
                + " | H: " + h
                + " | U: " + u
                // + " | RGX: " + rgx
                + " | " + word
              ));
            }
            else {
              if (options.updateGlobalHistograms) {
                histograms.words[word] = (histograms.words[word] === undefined) ? 1 : histograms.words[word]+1;
              }
              userHistograms.words[word] = (userHistograms.words[word] === undefined) ? 1 : userHistograms.words[word]+1;
              debug(chalkAlert("->- DESC Ws"
                + " | " + userHistograms.words[word]
                + " | " + word
              ));
            }
          });

          cb(null, userHistograms.words);
        }
        else {
          cb(null, userHistograms.words);
        }
      },
      urls: function(cb){
        if (urlArray) {
          urlArray.forEach(function(url){
            url = url.toLowerCase();
            if (options.updateGlobalHistograms) {
              histograms.urls[url] = (histograms.urls[url] === undefined) ? 1 : histograms.urls[url]+1;
            }
            userHistograms.urls[url] = (userHistograms.urls[url] === undefined) ? 1 : userHistograms.urls[url]+1;
            debug(chalkAlert("->- DESC Us"
              + " | " + userHistograms.urls[url]
              + " | " + url
            ));
          });
          cb(null, userHistograms.urls);
        }
        else {
          cb(null, userHistograms.urls);
        }
      }
    }, function(err, results){
      let text = "HISTOGRAMS";
      // console.log("PARSE TEXT RESULTS");
      Object.keys(results).forEach(function(key){
        if (results[key]) {
          text = text + " | " + key.toUpperCase() + ": " + Object.keys(results[key]).length;
        }
      });
      console.log(chalkLog(text));
      callback(err, results);
    });

  });
}

function printDatum(input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

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

function generateAutoKeywords(user, callback){

  let networkInput = [ 0, 0 ];

  if (user.languageAnalysis.sentiment){
    networkInput[0] = user.languageAnalysis.sentiment.magnitude;
    networkInput[1] = user.languageAnalysis.sentiment.score;
  }

  // if (user.status || user.retweeted_status || user.description){

  //   let text = user.name + " " + user.screenName;

  //   if (user.status) {
  //     text = text + " " + user.status.text;
  //   }
    
  //   if (user.retweeted_status) {
  //     text = text + " " + user.retweeted_status.text;
  //   }

  //   if (user.description) {
  //     text = text + " " + user.description;
  //   }

  if ((user.status !== undefined) 
    || (user.retweeted_status !== undefined) 
    || (user.description !== undefined)){

    async.waterfall([
      function userStatusText(cb) {

        if ((user.status !== undefined) && user.status) {

          // if (user.status.truncated) {
          //   console.log(chalkAlert("TRUNCATED\n" + jsonPrint(user.status)));
          // }
          cb(null, user.status.text);
        }
        else {
          cb(null, null);
        }
      },
      function userRetweetText(text, cb) {
        if ((user.retweeted_status !== undefined) && user.retweeted_status) {

          console.log(chalkAlert("RT\n" + jsonPrint(user.retweeted_status.text)));

          quit();

          if (text) {
            cb(null, text + " " + user.retweeted_status.text);
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
            cb(null, text + " " + user.description);
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

      parseText(text, {updateGlobalHistograms: false}, function(err, histogram){

        user.inputHits = 0;

        console.log(chalkError("GEN AUTO KEYWORDS | USER DESC/STATUS"
          + " | @" + user.screenName
          + "\n" + jsonPrint(text)
        ));

        async.eachSeries(inputArrays, function(inputArray, cb1){

          const type = Object.keys(inputArray)[0];

          debug(chalkAlert("START ARRAY: " + type + " | " + inputArray[type].length));

          async.eachSeries(inputArray[type], function(element, cb2){
            if (histogram[type][element]) {
              user.inputHits += 1;
              console.log(chalkAlert("GAKW | U HITS"
                + " | @" + user.screenName 
                + " | " + user.inputHits 
                + " | ARRAY: " + type 
                + " | " + element 
                + " | " + histogram[type][element]
              ));
              networkInput.push(1);
              cb2();
            }
            else {
              debug(chalkInfo("U HITS" 
                + " | @" + user.screenName 
                + " | " + user.inputHits 
                + " | ARRAY: " + type 
                + " | " + element
              ));
              networkInput.push(0);
              cb2();
            }
          }, function(err){
            debug(chalkAlert("DONE ARRAY: " + type));
            cb1();
          });

        }, function(err){
          debug(chalkAlert("PARSE DESC COMPLETE"));
        });
      });

    });
  }
  else {
    async.eachSeries(inputArrays, function(inputArray, cb1){
      const type = Object.keys(inputArray)[0];
      inputArray[type].forEach(function(){
        debug("ARRAY: " + type + " | + " + 0);
        networkInput.push(0);
      });
    });
  }

  printDatum(networkInput);

  let networkOutput = network.activate(networkInput);

  let maxOutputIndex = indexOfMax(networkOutput);

  let keywords = user.keywords ? Object.keys(user.keywords) : "";
  let keywordsAuto = {};
  let currentChalk;

  switch (maxOutputIndex) {
    case 0:
      user.keywordsAuto = { "left": 100 };
      keywordsAuto = {"left": 100};
      currentChalk = chalk.blue;
      if (keywords[0] === "left") { currentChalk = chalk.bold.blue;}
    break;
    case 1:
      user.keywordsAuto = { "neutral": 100 };
      keywordsAuto = {"neutral": 100};
      currentChalk = chalk.black;
      if (keywords[0] === "neutral") { currentChalk = chalk.bold.black;}
    break;
    case 2:
      user.keywordsAuto = { "right": 100 };
      keywordsAuto = {"right": 100};
      currentChalk = chalk.yellow;
      if (keywords[0] === "neutral") { currentChalk = chalk.bold.yellow;}
    break;
    default:
      user.keywordsAuto = null;
      currentChalk = chalk.gray;
      keywordsAuto = "";
  }

  let magnitudeText;
  let scoreText;

  if (user.languageAnalysis.sentiment){
    magnitudeText = user.languageAnalysis.sentiment.magnitude.toFixed(3);
    scoreText = user.languageAnalysis.sentiment.score.toFixed(3);
  }
  else {
    magnitudeText = "UNDEFINED";
    scoreText  = "UNDEFINED";
  }

  console.log(currentChalk("AUTO KW"
    + " | " + user.screenName
    + " | MAG: " + networkInput[0].toFixed(6)
    + " | SCORE: " + networkInput[1].toFixed(6)
    + " | L: " + networkOutput[0].toFixed(3)
    + " | N: " + networkOutput[1].toFixed(3)
    + " | R: " + networkOutput[2].toFixed(3)
    + " | KWs: " + Object.keys(keywords)
    + " | AKWs: " + Object.keys(keywordsAuto)
  ));

  callback(null, user);
}

function parseUserEntities(user){
  // ??? KLUDGE: make into function
  // REMOVE URLS FROM DESCRIPTION. MONGO DB HATES URLs as object keys on writes
  if (user.entities && user.entities.description && (user.entities.description.urls.length > 0)) {
    debug(chalkAlert("USER ENTITIES DESC URLS: " + jsonPrint(user.entities.description.urls)));

    user.entities.description.urls.forEach(function(urlObj){
      console.log(chalkAlert("USER ENTITIES DESC URL"
        + " | " + urlObj.url
      ));
      const regex = new RegExp(urlObj.url);
      histograms.urls[urlObj.url] = (histograms.urls[urlObj.url] === undefined) ? 1 : histograms.urls[urlObj.url]+1;
    });
  }
  
  if (user.entities && user.entities.url && (user.entities.url.urls.length > 0)) {
    debug(chalkAlert("USER ENTITIES URL URLS: " + jsonPrint(user.entities.url.urls)));
    user.entities.url.urls.forEach(function(urlObj){
      console.log(chalkAlert("USER ENTITIES URL"
        + " | " + urlObj.url
      ));
      histograms.urls[urlObj.url] = (histograms.urls[urlObj.url] === undefined) ? 1 : histograms.urls[urlObj.url]+1;
    });
  }

  if (user.status && user.status.entities) {
    if (user.status.entities.hashtags.length > 0) {
      user.status.entities.hashtags.forEach(function(h){
        const ht = "#" + h.text.toLowerCase();
        console.log(chalkAlert("USER STATUS ENTITIES HASHTAG"
          + " | " + ht
        ));
        histograms.hashtags[ht] = (histograms.hashtags[ht] === undefined) ? 1 : histograms.hashtags[ht]+1;
      });
    }
    if (user.status.entities.urls.length > 0) {
      debug(chalkAlert("USER ENTITIES URL URLS: " + jsonPrint(user.status.entities.urls)));
      user.status.entities.urls.forEach(function(urlObj){
        console.log(chalkAlert("USER ENTITIES URL"
          + " | " + urlObj.url
        ));
        histograms.urls[urlObj.url] = (histograms.urls[urlObj.url] === undefined) ? 1 : histograms.urls[urlObj.url]+1;
      });
    }
    if (user.status.entities.user_mentions.length > 0) {
      debug(chalkAlert("USER ENTITIES USER MENTIONS: " + jsonPrint(user.status.entities.user_mentions)));
      user.status.entities.user_mentions.forEach(function(userObj){
        const screenName = "@" + userObj.screen_name.toLowerCase();
        console.log(chalkAlert("USER ENTITIES USER MENTION"
          + " | " + screenName
          + " | " + userObj.name
        ));
        histograms.mentions[screenName] = (histograms.mentions[screenName] === undefined) ? 1 : histograms.mentions[screenName]+1;
      });
    }
  }
}

function processUser(cnf, user, callback){

  statsObj.analyzer.total += 1;

  let chalkCurrent;
  let classText;
  let langAnalyzerText;

  if (user.keywords && (Object.keys(user.keywords).length > 0)) {

    debug("KWS\n" + jsonPrint(user.keywords));
    
    classifiedUserHashmap[user.userId] = user.keywords;
    statsObj.users.classified = Object.keys(classifiedUserHashmap).length;

    chalkCurrent = chalkLog;

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
      + " [" + Object.keys(classifiedUserHashmap).length + "]"
      + " [ L: " + statsObj.classification.manual.left
      + " | R: " + statsObj.classification.manual.right
      + " | +: " + statsObj.classification.manual.positive
      + " | -: " + statsObj.classification.manual.negative
      + " | N: " + statsObj.classification.manual.neutral
      + " | O: " + statsObj.classification.manual.other + " ]"
      + " | " + classText
      + " | " + user.userId
      + " | " + user.screenName
      + " | " + user.name
    ));
  }

  if (user.keywordsAuto && (Object.keys(user.keywordsAuto).length > 0)) {

    debug("KWSA\n" + jsonPrint(user.keywordsAuto));

    autoClassifiedUserHashmap[user.userId] = user.keywordsAuto;
    statsObj.users.classifiedAuto = Object.keys(autoClassifiedUserHashmap).length;

    chalkCurrent = chalkLog;

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

    console.log(chalkCurrent("== AUTO =="
      + " [" + Object.keys(autoClassifiedUserHashmap).length + "]"
      + " [ L: " + statsObj.classification.auto.left
      + " | R: " + statsObj.classification.auto.right
      + " | +: " + statsObj.classification.auto.positive
      + " | -: " + statsObj.classification.auto.negative
      + " | N: " + statsObj.classification.auto.neutral
      + " | O: " + statsObj.classification.auto.other + " ]"
      + " | " + classText
      + " | " + user.userId
      + " | " + user.screenName
      + " | " + user.name
    ));
  }

  // console.log("user.status.text" + user.status.text);
  // quit();

  if ((!user.languageAnalyzed && cnf.enableLanguageAnalysis) 
    || cnf.forceLanguageAnalysis) {

    let text = user.name + " " + user.screenName;

    if (user.status) {
      text = text + " " + user.status.text;
    }
    
    if (user.retweeted_status) {
      text = text + " " + user.retweeted_status.text;
    }

    if (user.description) {
      text = text + " " + user.description;
    }


    parseText(text, {updateGlobalHistograms: true}, function(err, histogram){

      if (err) {
        console.error("*** PARSE TEXT ERROR\n" + err);
      }

      console.log(chalkLog("user.description + status histogram\n" + jsonPrint(histogram)));
      debug("user.description + status\n" + jsonPrint(text));

      async.eachSeries(inputArrays, function(inputArray, cb1){

        const type = Object.keys(inputArray)[0];

        let inputHitsSum = 0;

        debug(chalkAlert("START ARRAY: " + type + " | " + inputArray[type].length));

        async.eachSeries(inputArray[type], function(element, cb2){
          if (histogram[type][element]) {
            trainingSetDatum.inputHits += 1;
            console.log(chalkTwitter("+++ DATUM BIT: " + type
              + " | INPUT HITS: " + trainingSetDatum.inputHits 
              + " | " + element 
              + " | " + histogram[type][element]
            ));
            trainingSetDatum.input.push(1);
            cb2();
          }
          else {
            debug(chalkInfo("--- DATUM BIT: " + type
              + " | " + element 
              + " | " + histogram[type][element]
            ));
            trainingSetDatum.input.push(0);
            cb2();
          }
        }, function(err){
         if (err) {
            console.error("*** PARSE TEXT ERROR\n" + err);
          }
          debug(chalkAlert("DONE ARRAY: " + type));
          cb1();
        });

      }, function(err){
       if (err) {
          console.error("*** PARSE TEXT ERROR\n" + err);
        }
        debug(chalkAlert("PARSE DESC COMPLETE"));
      });

      langAnalyzerText = langAnalyzerText.replace(/@/g, "");

      // REMOVE URLS FROM DESCRIPTION. MONGO DB HATES URLs as object keys on writes
      if (user.entities && user.entities.description && (user.entities.description.urls.length > 0)) {
        debug(chalkAlert("USER ENTITIES DESC URLS: " + jsonPrint(user.entities.description.urls)));

        user.entities.description.urls.forEach(function(urlObj){
          console.log(chalkAlert("USER ENTITIES DESC URL"
            + " | " + urlObj.url
          ));
          const regex = new RegExp(urlObj.url);
          histograms.urls[urlObj.url] = (histograms.urls[urlObj.url] === undefined) ? 1 : histograms.urls[urlObj.url]+1;
          langAnalyzerText = langAnalyzerText.replace(regex, "");
        });
      }
      
      if (user.entities && user.entities.url && (user.entities.url.urls.length > 0)) {
        debug(chalkAlert("USER ENTITIES URL URLS: " + jsonPrint(user.entities.url.urls)));
        user.entities.url.urls.forEach(function(urlObj){
          console.log(chalkAlert("USER ENTITIES URL"
            + " | " + urlObj.url
          ));
          histograms.urls[urlObj.url] = (histograms.urls[urlObj.url] === undefined) ? 1 : histograms.urls[urlObj.url]+1;
        });
      }

      if (user.status && user.status.entities) {
        if (user.status.entities.hashtags.length > 0) {
          user.status.entities.hashtags.forEach(function(h){
            const ht = "#" + h.text.toLowerCase();
            console.log(chalkAlert("USER STATUS ENTITIES HASHTAG"
              + " | " + ht
            ));
            histograms.hashtags[ht] = (histograms.hashtags[ht] === undefined) ? 1 : histograms.hashtags[ht]+1;
          });
        }
        if (user.status.entities.urls.length > 0) {
          debug(chalkAlert("USER ENTITIES URL URLS: " + jsonPrint(user.status.entities.urls)));
          user.status.entities.urls.forEach(function(urlObj){
            console.log(chalkAlert("USER ENTITIES URL"
              + " | " + urlObj.url
            ));
            histograms.urls[urlObj.url] = (histograms.urls[urlObj.url] === undefined) ? 1 : histograms.urls[urlObj.url]+1;
          });
        }
        if (user.status.entities.user_mentions.length > 0) {
          debug(chalkAlert("USER ENTITIES USER MENTIONS: " + jsonPrint(user.status.entities.user_mentions)));
          user.status.entities.user_mentions.forEach(function(userObj){
            const screenName = "@" + userObj.screen_name.toLowerCase();
            console.log(chalkAlert("USER ENTITIES USER MENTION"
              + " | " + screenName
              + " | " + userObj.name
            ));
            histograms.mentions[screenName] = (histograms.mentions[screenName] === undefined) ? 1 : histograms.mentions[screenName]+1;
          });
        }
      }

      debug(chalkAlert("FINAL langAnalyzerText: " + langAnalyzerText));

      langAnalyzer.send({op: "LANG_ANALIZE", obj: user, text: langAnalyzerText}, function(){
        statsObj.analyzer.analyzed += 1;
        callback(null, user);
      });

    });
  }

  else {

    let sentiment;

    if ((user.languageAnalysis !== undefined)
      && (user.languageAnalysis.sentiment !== undefined)) {

      const mag = 10*user.languageAnalysis.sentiment.magnitude;
      const score = 10*user.languageAnalysis.sentiment.score ;

      sentiment = "M: " + mag.toFixed(2) + " S: " + score.toFixed(2);
    }
    else {
      sentiment = Object.keys(user.languageAnalysis);
    }

    const kws = user.keywords && (user.keywords !== undefined) ? Object.keys(user.keywords) : [];
    const kwsAuto = user.keywordsAuto && (user.keywordsAuto !== undefined) ? Object.keys(user.keywordsAuto) : [];

    let text = user.name + " " + user.screenName;

    if (user.status) {
      text = text + " " + user.status.text;
    }
    
    if (user.retweeted_status) {
      text = text + " " + user.retweeted_status.text;
    }

    if (user.description) {
      text = text + " " + user.description;
    }


    parseText(text, {updateGlobalHistograms: true}, function(){});

    parseUserEntities(user);

    const threeceeFollowing = ((user.threeceeFollowing !== undefined) && user.threeceeFollowing && (Object.keys(user.threeceeFollowing).length > 0)) ? user.threeceeFollowing.screenName : "-";

    statsObj.analyzer.skipped += 1;

    console.log(chalkInfo("LA HIT"
      + " [" + statsObj.analyzer.analyzed + " ANLs | " + statsObj.analyzer.skipped + " SKPs | " + statsObj.analyzer.total + " TOT]"
      + " | 3C FLW: " + threeceeFollowing
      + " | Ks: " + kws
      + " | KAs: " + kwsAuto
      + " | LA: " + sentiment
      + " | @" + user.screenName
      + " | " + user.name
      // + " | LAd: " + user.languageAnalyzed
    ));

    callback(null, user);
  }
}

let currentUserId = 1;
let totalUsers = 0;
let userIndex = 0;
User.count({}, function(err, count) {
  totalUsers = count;
});

function initCursorUser(interval){

  console.log(chalkRed("INIT USER SEARCH"));

  cursorUser = User.find({}).where("userId").gte(currentUserId).cursor();

  cursorUser.on("data", function(us){

    if (Object.keys(us.languageAnalysis).length == 0) {
      debug(chalkInfo("NO LANG ... SKIP | " + us.screenName));
      return;
    }

    processUser(configuration, us, function(err, user){

      userIndex += 1;

      if (userIndex % 1 === 0) {
        debug(chalkTwitter("US<"
          + " [" + userIndex + "/" + totalUsers + "]"
          + " | " + user.userId
          + " | TW: " + (user.isTwitterUser || "-")
          + " | @" + user.screenName
          + " | LA " + Object.keys(us.languageAnalysis)
        ));
      }

      if (Object.keys(us.languageAnalysis)[0] == "error") {
        return;
      }

      if (neuralNetworkInitialized) {
        generateAutoKeywords(user, function(err, uObj){
          userServer.findOneUser(uObj, {noInc: true}, function(err, updatedUserObj){
            if (err) { 
              console.log(chalkError("ERROR DB UPDATE USER - generateAutoKeywords"
                + "\n" + err
                + "\n" + jsonPrint(uObj)
              ));
            }
            else {
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
            }
          });
        });
      }
    });
  });

  cursorUser.on("error", function(err){
    console.log(chalkError("*** CURSOR USER ERROR"
      + " | " + err
    ));
  });

  cursorUser.on("end", function(){
    console.log(chalkTwitter("=== CURSOR USER END"));
  });

  cursorUser.pause();
}

function loadNeuralNetworkFile(cnf, callback){

  console.log(chalkAlert("LOADING NEURAL NETWORK FILE" 
    + " | " + cnf.neuralNetworkFile
    + "\n" + jsonPrint(cnf)
  ));

  loadFile(cnf.neuralNetworkFolder, cnf.neuralNetworkFile, function(err, loadedNetworkObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + cnf.neuralNetworkFolder + "/" + cnf.neuralNetworkFile));
      console.log(chalkError("ERROR: loadFile: " + cnf.neuralNetworkFolder + "/" + cnf.neuralNetworkFile));
      callback(err, cnf.neuralNetworkFile);
    }
    else {
      console.log(chalkAlert("LOADED NETWORK FILE: " + cnf.neuralNetworkFolder + "/" + cnf.neuralNetworkFile));

      Object.keys(loadedNetworkObj).forEach(function(key){
        console.log(chalkAlert("NETWORK OBJ KEY: " + key));
      });

      if (loadedNetworkObj.normalization) {
        cnf.normalization = loadedNetworkObj.normalization;
        console.log(chalkAlert("LOADED NORMALIZATION\n" + jsonPrint(cnf.normalization)));
      }
      else {
        console.log(chalkError("??? NORMALIZATION NOT FOUND ??? | " + cnf.neuralNetworkFile));
      }
      network = neataptic.Network.fromJSON(loadedNetworkObj.network);
      callback(null, { network: network, normalization: cnf.normalization });
    }
  });
}

function initLangAnalyzer(callback){
  console.log(chalkAlert("INIT LANGUAGE ANALYZER CHILD PROCESS"));

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
      // if (cursorUser) { cursorUser.pause(); }
      console.log(chalkAlert("LANG_TEST_FAIL"));
      quit("LANG_TEST_FAIL");
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisReadyFlag = true;
      langAnalyzerIdle = false;
      // if (cursorUser) { cursorUser.pause(); }
      console.log(chalkAlert("LANG_TEST_PASS"));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisQueueEmpty = false;
      languageAnalysisQueueFull = true;
      langAnalyzerIdle = false;
      if (cursorUser !== undefined) { cursorUser.pause(); }
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisQueueEmpty = true;
      languageAnalysisQueueFull = false;
      if (cursorUser !== undefined) { cursorUser.resume(); }
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      langAnalyzerIdle = true;
      languageAnalysisQueueEmpty = true;
      languageAnalysisQueueFull = false;
      languageAnalysisReadyFlag = true;
      if (cursorUser !== undefined) { cursorUser.resume(); }
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisReadyFlag = false;
      languageAnalysisQueueFull = false;
      if (cursorUser !== undefined) { cursorUser.resume(); }
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
      langAnalyzerIdle = false;
      langAnalyzerMessageRxQueue.push(m);
    }
  });

  langAnalyzer.send({
    op: "INIT",
    interval: 50
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

  if (callback !== undefined) { callback(); }
}

initialize(configuration, function(err, cnf){

  if (err) {
    console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
    if (err.code != 404){
      console.log("err.status: " + err.status);
      quit();
    }
  }

  console.log(chalkAlert(cnf.processName 
    + " STARTED " + getTimeStamp() 
    + "\n" + jsonPrint(cnf)
  ));

  if (cnf.loadNeuralNetworkID) {
    cnf.neuralNetworkFile = "neuralNetwork_" + cnf.loadNeuralNetworkID + ".json";
  }
  else {
    cnf.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  loadNeuralNetworkFile(cnf, function(err, network){
    if (!err) { 
      neuralNetworkInitialized = true;
    }
  });

  initTwitterUsers(cnf, function(err, tuhm){
    if (err){ }

    if (!currentTwitterUser) { currentTwitterUser = twitterUsersArray.shift(); }

    console.log(chalkTwitter("CURRENT TWITTER USER: " + currentTwitterUser));

    initTwitter(currentTwitterUser, cnf, function(err, response){

      if (err) {
        quit();
      }

      checkRateLimit(function(err, status){

        initCheckRateLimitInterval(checkRateLimitIntervalTime);
        initLangAnalyzerMessageRxQueueInterval(100);
        initLangAnalyzer();
        
        initTwitterUsersComplete = true;
        initTweetHashMapComplete = true;

        if (cnf.userDbCrawl) { 
          console.log(chalkAlert("\n\n*** CRAWLING USER DB ***\n\n"));
          initCursorUser(5000);
        }
        else {
          console.log(chalkAlert("\n\n*** GET TWITTER FRIENDS *** | @" + statsObj.user[currentTwitterUser].screen_name + "\n\n"));
          initFetchTwitterFriendsInterval(fetchTwitterFriendsIntervalTime);
        }

      });
    });

  });
});
