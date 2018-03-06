 /*jslint node: true */
"use strict";

const DEFAULT_MIN_INPUTS_GENERATED = 500 ;
const DEFAULT_MAX_INPUTS_GENERATED = 1000 ;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN = 5;
const DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN = 0.4;

const MAX_ITERATIONS_INPUTS_GENERATE = 50;

const MIN_TOTAL_MIN = 3;
const MAX_TOTAL_MIN = 5;

const MIN_DOMINANT_MIN = 0.4;
const MAX_DOMINANT_MIN = 0.9;

const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;
const OFFLINE_MODE = false;
const ONLINE_MODE = false;

const histogramParser = require("@threeceelabs/histogram-parser");

const moment = require("moment");

const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkBlackBold = chalk.bold.black;
const chalkTwitterBold = chalk.bold.blue;
const chalkRed = chalk.red;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

let saveFileQueue = [];
let saveFileQueueInterval;
let saveFileBusy = false;

let socket;
let socketKeepAliveInterval;

const inputTypes = ["emoji", "hashtags", "mentions", "urls", "words", "images"];
inputTypes.sort();

let stdin;

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#gis";
const Slack = require("slack-node");

require("isomorphic-fetch");
// const Dropbox = require("dropbox").Dropbox;
const Dropbox = require("./js/dropbox").Dropbox;

const os = require("os");
const util = require("util");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");
const randomFloat = require('random-float');
const randomInt = require('random-int');
const arrayNormalize = require("array-normalize");
const table = require("text-table");
const fs = require("fs");
const HashMap = require("hashmap").HashMap;

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
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.heartbeatsReceived = 0;

const GIS_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.fetchUsersComplete = false;
statsObj.runId = GIS_RUN_ID;

statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());

statsObj.bestNetworks = {};
statsObj.totalInputs = 0;

statsObj.histograms = {};

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;

statsObj.numLangAnalyzed = 0;

inputTypes.forEach(function(type){

  statsObj.histograms[type] = {};

});

let configuration = {};

configuration.minInputsGenerated = DEFAULT_MIN_INPUTS_GENERATED;
configuration.maxInputsGenerated = DEFAULT_MAX_INPUTS_GENERATED;

configuration.histogramParseTotalMin = DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;
configuration.histogramParseDominantMin = DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN;

configuration.saveFileQueueInterval = 1000;
configuration.testMode = false;
configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.quitOnComplete = true;


let histograms = {};
histograms.words = {};
histograms.urls = {};
histograms.hashtags = {};
histograms.mentions = {};
histograms.emoji = {};
histograms.images = {};

const async = require("async");
const sortOn = require("sort-on");

const debug = require("debug")("gis");

let statsUpdateInterval;


function indexOfMax (arr, callback) {
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

const USER_ID = "gis_" + hostname;
const SCREEN_NAME = "gis_" + hostname;

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
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const targetServer = { name: "targetServer", alias: "t", type: String};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};

const optionDefinitions = [enableStdin, quitOnComplete, quitOnError, targetServer, testMode];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

process.title = "node_generateInputSets";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(statsUpdateInterval);

    setTimeout(function() {
      console.log("QUITTING generateInputSets");
      process.exit(0);
    }, 300);

  }
});

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
const DROPBOX_GIS_CONFIG_FILE = process.env.DROPBOX_GIS_CONFIG_FILE || "generateInputSetsConfig.json";
const DROPBOX_GIS_STATS_FILE = process.env.DROPBOX_GIS_STATS_FILE || "generateInputSetsStats.json";

let dropboxConfigHostFolder = "/config/utility/" + hostname;
let dropboxConfigDefaultFolder = "/config/utility/default";

let dropboxConfigFile = hostname + "_" + DROPBOX_GIS_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/generateInputSets";
let statsFile = DROPBOX_GIS_STATS_FILE;

const defaultHistogramsFolder = "/config/utility/default/histograms";
const localHistogramsFolder = "/config/utility/" + hostname + "/histograms";

const localInputsFolder = dropboxConfigHostFolder + "/inputs";
const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";

console.log("DROPBOX_GIS_CONFIG_FILE: " + DROPBOX_GIS_CONFIG_FILE);
console.log("DROPBOX_GIS_STATS_FILE : " + DROPBOX_GIS_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function showStats(options){
  if (options) {
  }
  else {
    console.log(chalkLog("- FE S"
      + " | E: " + statsObj.elapsed
      + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
    ));
  }
}

function reset(cause, callback){

  console.log(chalkAlert("\nRESET | CAUSE: " + cause + "\n"));

  clearInterval(socketKeepAliveInterval);

  if (callback !== undefined) { callback(); } 
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

    socket.on("disconnect", function(){
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
      console.log(chalkConnect(moment().format(compactDateTimeFormat)
        + " | SOCKET DISCONNECT: " + socket.id
      ));
      // reset("disconnect");
    });
  });

  socket.on("reconnect", function(){
    console.error(chalkInfo("RECONNECT" 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + socket.id
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
      console.log(chalkInfo(">R DROPBOX_CHANGE"
        + " | " + entry[".tag"].toUpperCase()
        + " | " + entry.path_lower
        // + " | NAME: " + entry.name
      ));
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

function generateInputSets(params, callback) {

  let iterations = 0;

  let totalMin = randomInt(MIN_TOTAL_MIN, MAX_TOTAL_MIN);
  let dominantMin = randomFloat(MIN_DOMINANT_MIN, MAX_DOMINANT_MIN);

  let newInputsObj = {};
  newInputsObj.inputsId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
  newInputsObj.meta = {};
  newInputsObj.meta.histogramsId = params.histogramsObj.histogramsId;
  newInputsObj.meta.numInputs = 0;
  newInputsObj.meta.histogramParseTotalMin = totalMin;
  newInputsObj.meta.histogramParseDominantMin = dominantMin;
  newInputsObj.inputs = {};

  async.whilst(

    function() {
      return ((iterations <= MAX_ITERATIONS_INPUTS_GENERATE) 
            && ((newInputsObj.meta.numInputs < configuration.minInputsGenerated) 
           || (newInputsObj.meta.numInputs > configuration.maxInputsGenerated))) ;
    },

    function(cb0){

      iterations += 1;
      totalMin = randomInt(MIN_TOTAL_MIN, MAX_TOTAL_MIN);
      dominantMin = randomFloat(MIN_DOMINANT_MIN, MAX_DOMINANT_MIN);

      console.log(chalkInfo("... GENERATING INPUT SETS"
        + " | ITERATION: " + iterations
        + " | HIST ID: " + params.histogramsObj.histogramsId
        + " | TOT MIN: " + totalMin
        + " | DOM MIN: " + dominantMin.toFixed(3)
      ));

      const hpParams = {};
      hpParams.histogram = params.histogramsObj.histograms;
      hpParams.options = {};
      hpParams.options.totalMin = totalMin;
      hpParams.options.dominantMin = dominantMin;

      histogramParser.parse(hpParams, function(err, histResults){

        if (err){
          console.log(chalkError("HISTOGRAM PARSE ERROR: " + err));
          return cb0(err);
        }

        debug(chalkNetwork("HISTOGRAMS RESULTS\n" + jsonPrint(histResults)));

        let inTypyes = Object.keys(histResults.entries);
        inTypyes.push("sentiment");
        inTypyes.sort();

        newInputsObj.meta.numInputs = 0;

        async.eachSeries(inTypyes, function(type, cb1){

          newInputsObj.inputs[type] = [];

          if (type === "sentiment") {
            newInputsObj.inputs[type] = ["magnitude", "score"];
            newInputsObj.meta.numInputs += newInputsObj.inputs[type].length;
            debug(chalkLog("... PARSE | " + type + ": " + newInputsObj.inputs[type].length));

            cb1();
          }
          else {
            newInputsObj.inputs[type] = Object.keys(histResults.entries[type].dominantEntries).sort();
            newInputsObj.meta.numInputs += newInputsObj.inputs[type].length;

            debug(chalkLog("... PARSE | " + type + ": " + newInputsObj.inputs[type].length));

            cb1();
          }

        }, function(){

          newInputsObj.meta.histogramParseTotalMin = totalMin;
          newInputsObj.meta.histogramParseDominantMin = dominantMin;

          debug(chalkNetwork("NEW INPUTS\n" + jsonPrint(newInputsObj)));

          console.log(chalkAlert(">>> HISTOGRAMS PARSED"
            + " | PARSE TOT MIN: " + totalMin
            + " | PARSE DOM MIN: " + dominantMin.toFixed(3)
            + " | NUM INPUTS: " + newInputsObj.meta.numInputs
          ));

          cb0();

        });

      });

  }, function(err){

    console.log(chalkAlert("\n================================================================================\n"
      + "INPUT SET COMPLETE"
      + " | ITERATION: " + iterations
      + " | ID: " + newInputsObj.inputsId
      + " | PARSE TOT MIN: " + totalMin
      + " | PARSE DOM MIN: " + dominantMin.toFixed(3)
      + " | NUM INPUTS: " + newInputsObj.meta.numInputs
      + "\n================================================================================\n"
    ));

    if (iterations >= MAX_ITERATIONS_INPUTS_GENERATE) {
      callback("MAX ITERATIONS: " + iterations, null);
    }
    else {
      callback(err, newInputsObj);
    }
  });
}

let quitWaitInterval;

function quit(cause){

  console.log( "\n... QUITTING ..." );

  if (cause) {
    console.log( "CAUSE: " + cause );
  }

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy 
      && (saveFileQueue.length === 0)
      ){

      clearInterval(statsUpdateInterval);
      clearInterval(quitWaitInterval);

      console.log(chalkAlert("ALL PROCESSES COMPLETE ... QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));

      setTimeout(function(){
        process.exit();      
      }, 1000);
    }
    else {
      console.log(chalkAlert("... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));
    }

  }, 1000);
}

process.on( "SIGINT", function() {
  quit("SIGINT");
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

function initSaveFileQueue(cnf){

  console.log(chalkBlue("GIS | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
        if (err) {
          console.log(chalkError("GIS | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("GIS | SAVED FILE | " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });
    }

  }, cnf.saveFileQueueInterval);
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
          console.trace(chalkError("GIS | JSON PARSE ERROR: " + e));
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
          console.trace(chalkError("GIS | JSON PARSE ERROR: " + jsonPrint(e)));
          console.trace(chalkError("GIS | JSON PARSE ERROR: " + e));
          callback("JSON PARSE ERROR", null);
        }
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {

      if (error.response.status === 404) {
        console.error(chalkError("GIS | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND" + " ... SKIPPING ..."));
        return(callback(error, null));
      }
      if (error.response.status === 409) {
        console.error(chalkError("GIS | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND" + " ... SKIPPING ..."));
        return(callback(error, null));
      }
      if (error.response.status === 0) {
        console.error(chalkError("GIS | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(error, null));
      }

      console.log(chalkError("GIS | DROPBOX LOAD FILE ERROR: " + fullPath + " | " + error.response.statusText));
      console.log(chalkError("GIS | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("GIS | " + jsonPrint(error)));

      callback(error, null);

    });
  }
}

function initStatsUpdate(callback){

  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    showStats();

  }, configuration.statsUpdateIntervalTime);

  callback(null);
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

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.GIS_PROCESS_NAME || "generateInputSets";
  cnf.targetServer = process.env.GIS_UTIL_TARGET_SERVER || "http://127.0.0.1:9997/util" ;

  cnf.histogramParseDominantMin = process.env.GIS_HISTOGRAM_PARSE_DOMINANT_MIN || DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN ;
  cnf.histogramParseTotalMin = process.env.GIS_HISTOGRAM_PARSE_TOTAL_MIN || DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;

  cnf.testMode = (process.env.GIS_TEST_MODE === "true") ? true : cnf.testMode;

  cnf.quitOnError = process.env.GIS_QUIT_ON_ERROR || false ;
  if (process.env.GIS_QUIT_ON_COMPLETE === "false") {
    cnf.quitOnComplete = false;
  }
  if (process.env.GIS_QUIT_ON_COMPLETE === "true") {
    cnf.quitOnComplete = true;
  }
  cnf.enableStdin = process.env.GIS_ENABLE_STDIN || true ;

  cnf.statsUpdateIntervalTime = process.env.GIS_STATS_UPDATE_INTERVAL || ONE_MINUTE;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineArgs;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.GIS_UTIL_TARGET_SERVER !== undefined){
        console.log("LOADED GIS_UTIL_TARGET_SERVER: " + loadedConfigObj.GIS_UTIL_TARGET_SERVER);
        cnf.targetServer = loadedConfigObj.GIS_UTIL_TARGET_SERVER;
      }

      if (loadedConfigObj.GIS_TEST_MODE !== undefined){
        console.log("LOADED GIS_TEST_MODE: " + loadedConfigObj.GIS_TEST_MODE);
        cnf.testMode = loadedConfigObj.GIS_TEST_MODE;
      }

      if (loadedConfigObj.GIS_QUIT_ON_COMPLETE !== undefined){
        console.log("LOADED GIS_QUIT_ON_COMPLETE: " + loadedConfigObj.GIS_QUIT_ON_COMPLETE);
        cnf.quitOnComplete = loadedConfigObj.GIS_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined){
        console.log("LOADED GIS_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN);
        cnf.histogramParseDominantMin = loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
        console.log("LOADED GIS_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN);
        cnf.histogramParseTotalMin = loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_ENABLE_STDIN !== undefined){
        console.log("LOADED GIS_ENABLE_STDIN: " + loadedConfigObj.GIS_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.GIS_ENABLE_STDIN;
      }

      if (loadedConfigObj.GIS_KEEPALIVE_INTERVAL !== undefined) {
        console.log("LOADED GIS_KEEPALIVE_INTERVAL: " + loadedConfigObj.GIS_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.GIS_KEEPALIVE_INTERVAL;
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
        return(callback(err, cnf));
      });
    }
    else {
      console.error(chalkError("*** DROPBOX CONFIG FILE " + dropboxConfigFile + " NOT LOADED *** | USING DEFAULTS"));

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
      reject(new Error("ERROR"));
    }

  });
};

function printHistogram(title, hist){
  let tableArray = [];

  const sortedLabels = Object.keys(hist).sort(function(a,b){
    return hist[b] - hist[a];
  });

  async.eachSeries(sortedLabels, function(label, cb){
    tableArray.push([hist[label], label]);
    cb();
  }, function(){
    console.log(chalkInfo(
        "\n--------------------------------------------------------------"
      + "\n" + title + " | " + sortedLabels.length + " ENTRIES"  
      + "\n--------------------------------------------------------------\n"
      + table(tableArray, { align: [ "r", "l"] })
      + "\n--------------------------------------------------------------\n"
    ));
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

initialize(configuration, function(err, cnf){

  if (err) {
    if ((err.response.status !== 404) && (err.response.status !== 409)){
      console.error(chalkError("***** INIT ERROR *** QUITING: ERROR: " + jsonPrint(err)));
      quit();
    }
    else {
      console.error(chalkError("***** INIT ERROR *** ERROR: CONFIG FILE NOT FOUND | ERROR CODE: " + err.status));
    }
  }

  configuration = deepcopy(cnf);

  console.log(chalkTwitter(configuration.processName 
    + " STARTED " + getTimeStamp() 
  ));

  initSaveFileQueue(cnf);

  if (configuration.testMode) {
  }

  console.log(chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

  // console.log("LOAD " + localHistogramsFolder + "/histograms.json");
  console.log("LOAD " + defaultHistogramsFolder + "/histograms.json");

  loadFile(defaultHistogramsFolder, "histograms.json", function(err, histogramsObj){
    if (err) {
      console.log(chalkError("LOAD histograms.json ERROR\n" + jsonPrint(err)));
    }
    else {
      console.log(chalkAlert("histogramsObj: " + histogramsObj.histogramsId));

      const genInParams = {
        histogramsObj: { 
          histogramsId: histogramsObj.histogramsId, 
          histograms: histogramsObj.histograms
        },
        histogramParseDominantMin: configuration.histogramParseDominantMin,
        histogramParseTotalMin: configuration.histogramParseTotalMin
      };

      let inFolder = (hostname === "google") ? defaultInputsFolder : localInputsFolder;

      if (configuration.testMode) { 
        inFolder = inFolder + "_test";
      }

      generateInputSets(genInParams, function(err, inputsObj){
        if (err) {
          console.log(chalkError("generateInputSets ERROR: " + err));
        }
        else {
          const inFile = inputsObj.inputsId + ".json"; 
          console.log(chalkAlert("... SAVING INPUTS FILE: " + inFolder + "/" + inFile));
          saveFileQueue.push({folder: inFolder, file: inFile, obj: inputsObj});
        }
        quit();
      });
    }

  });

});
