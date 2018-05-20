 /*jslint node: true */
"use strict";

const DEFAULT_MIN_INPUTS_GENERATED = 1000 ;
const DEFAULT_MAX_INPUTS_GENERATED = 1200 ;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_MAX_ITERATIONS = 50;

const DEFAULT_MIN_TOTAL_MIN = 10;
const DEFAULT_MAX_TOTAL_MIN = 20;

const DEFAULT_MIN_DOMINANT_MIN = 0.5;
const DEFAULT_MAX_DOMINANT_MIN = 0.75;

const OFFLINE_MODE = false;

// const histogramParser = require("@threeceelabs/histogram-parser");
const histogramParser = require("../histogram-parser");

const os = require("os");
const util = require("util");
const deepcopy = require("deep-copy");
const randomFloat = require("random-float");
const randomInt = require("random-int");
const fs = require("fs");
const moment = require("moment");

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

let saveFileQueue = [];
let saveFileQueueInterval;
let saveFileBusy = false;

const inputTypes = ["emoji", "hashtags", "mentions", "urls", "words", "images", "sentiment"];
inputTypes.sort();

let stdin;

require("isomorphic-fetch");
// const Dropbox = require("dropbox").Dropbox;
const Dropbox = require("./js/dropbox").Dropbox;

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

configuration.maxIterations = DEFAULT_MAX_ITERATIONS;
configuration.minInputsGenerated = DEFAULT_MIN_INPUTS_GENERATED;
configuration.maxInputsGenerated = DEFAULT_MAX_INPUTS_GENERATED;

configuration.minDominantMin = DEFAULT_MIN_DOMINANT_MIN;
configuration.maxDominantMin = DEFAULT_MAX_DOMINANT_MIN;

configuration.minTotalMin = DEFAULT_MIN_TOTAL_MIN;
configuration.maxTotalMin = DEFAULT_MAX_TOTAL_MIN;

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

const debug = require("debug")("gis");

let statsUpdateInterval;

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

const minInputsGenerated = { name: "minInputsGenerated", type: Number};
const maxInputsGenerated = { name: "maxInputsGenerated", type: Number};

const minDominantMin = { name: "minDominantMin", type: Number};
const maxDominantMin = { name: "maxDominantMin", type: Number};

const minTotalMin = { name: "minTotalMin", type: Number};
const maxTotalMin = { name: "maxTotalMin", type: Number};

const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};

const optionDefinitions = [
  minInputsGenerated,
  maxInputsGenerated,
  minTotalMin, 
  maxTotalMin, 
  minDominantMin, 
  maxDominantMin, 
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  testMode
];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

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
// const localHistogramsFolder = "/config/utility/" + hostname + "/histograms";

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

function generateInputSets(params, callback) {

  let iterations = 0;

  let totalMin = randomInt(configuration.minTotalMin, configuration.maxTotalMin);
  let dominantMin = randomFloat(configuration.minDominantMin, configuration.maxDominantMin);

  let newInputsObj = {};
  newInputsObj.inputsId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
  newInputsObj.meta = {};
  newInputsObj.meta.type = {};
  newInputsObj.meta.histogramsId = params.histogramsObj.histogramsId;
  newInputsObj.meta.numInputs = 0;
  newInputsObj.meta.histogramParseTotalMin = totalMin;
  newInputsObj.meta.histogramParseDominantMin = dominantMin;
  newInputsObj.inputs = {};

  async.whilst(

    function() {
      return ((iterations <= configuration.maxIterations) 
            && ((newInputsObj.meta.numInputs < configuration.minInputsGenerated) 
           || (newInputsObj.meta.numInputs > configuration.maxInputsGenerated))) ;
    },

    function(cb0){

      iterations += 1;
      totalMin = randomInt(configuration.minTotalMin, configuration.maxTotalMin);
      dominantMin = randomFloat(configuration.minDominantMin, configuration.maxDominantMin);

      let hpParams = {};
      hpParams.histogram = {};
      hpParams.histogram = params.histogramsObj.histograms;

      hpParams.options = {};
      hpParams.options.totalMin = {};
      hpParams.options.dominantMin = {};
      hpParams.options.totalMin.images = 1;
      hpParams.options.dominantMin.images = 0.5;

      hpParams.options.globalTotalMin = totalMin;
      hpParams.options.globalDominantMin = dominantMin;

      console.log(chalkInfo("... GENERATING INPUT SETS"
        + " | ITERATION: " + iterations
        + " | HIST ID: " + params.histogramsObj.histogramsId
        + " | TOT MIN: " + totalMin
        + " | DOM MIN: " + dominantMin.toFixed(3)
        // + "\nhpParams\n" + jsonPrint(hpParams.options)
      ));


      histogramParser.parse(hpParams, function(err, histResults){

        if (err){
          console.log(chalkError("HISTOGRAM PARSE ERROR: " + err));
          return cb0(err);
        }

        // console.log(chalkNetwork("HISTOGRAMS RESULTS\n" + jsonPrint(histResults)));

        let inTypyes = Object.keys(histResults.entries);
        // inTypyes.push("sentiment");
        inTypyes.sort();

        newInputsObj.meta.numInputs = 0;

        async.eachSeries(inTypyes, function(type, cb1){

          newInputsObj.inputs[type] = [];

          if (type === "sentiment") {
            newInputsObj.inputs[type] = ["magnitude", "score"];
            newInputsObj.meta.numInputs += newInputsObj.inputs[type].length;
            newInputsObj.meta.type[type] = newInputsObj.inputs[type].length;
            debug(chalkLog("... PARSE | " + type + ": " + newInputsObj.inputs[type].length));

            cb1();
          }
          else {
            newInputsObj.inputs[type] = Object.keys(histResults.entries[type].dominantEntries).sort();
            newInputsObj.meta.numInputs += newInputsObj.inputs[type].length;
            newInputsObj.meta.type[type] = newInputsObj.inputs[type].length;
            debug(chalkLog("... PARSE | " + type + ": " + newInputsObj.inputs[type].length));

            cb1();
          }

        }, function(){

          newInputsObj.meta.histogramParseTotalMin = totalMin;
          newInputsObj.meta.histogramParseDominantMin = dominantMin;

          debug(chalkNetwork("NEW INPUTS\n" + jsonPrint(newInputsObj)));

          console.log(chalkLog("--- HISTOGRAMS PARSED ------------"
            + "\nNUM IN:  " + newInputsObj.meta.numInputs
            + "\nTOT MIN: " + totalMin
            + "\nDOM MIN: " + dominantMin.toFixed(3)
            + "\n----------------------------------"
          ));

          Object.keys(newInputsObj.inputs).forEach(function(type){
            console.log(chalkLog(type.toUpperCase() + ": " + newInputsObj.meta.type[type]
            ));
          });

          cb0();

        });

      });

  }, function(err){

    console.log(chalkAlert("\n===========================================\n"
      + "INPUT SET COMPLETE"
      + "\nITERATION: " + iterations
      + "\nID:        " + newInputsObj.inputsId
      + "\nTOT MIN:   " + totalMin
      + "\nDOM MIN:   " + dominantMin.toFixed(3)
      + "\nINPUTS:    " + newInputsObj.meta.numInputs
      + "\n===========================================\n"
    ));

    if (iterations >= configuration.maxIterations) {
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
      console.log(chalkInfo("... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
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

function saveFile(params, callback){

  // console.log("saveFile: params\n" + jsonPrint(params));

  if (OFFLINE_MODE) {
    console.log("OFFLINE_MODE: " + OFFLINE_MODE);
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

        debug(chalkInfo("DROPBOX FILE"
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
      if (err) {
        console.log(chalkError("LOAD FILE ERROR: " + err));
        return (callback(err, null));
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
      console.log(chalkLog(getTimeStamp()
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
          // console.trace(chalkError("GIS | JSON PARSE ERROR: " + jsonPrint(e)));
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

  cnf.minDominantMin = process.env.GIS_MIN_DOMINANT_MIN || DEFAULT_MIN_DOMINANT_MIN ;
  cnf.maxDominantMin = process.env.GIS_MAX_DOMINANT_MIN || DEFAULT_MAX_DOMINANT_MIN ;

  cnf.minTotalMin = process.env.GIS_MIN_TOTAL_MIN || DEFAULT_MIN_TOTAL_MIN ;
  cnf.maxTotalMin = process.env.GIS_MAX_TOTAL_MIN || DEFAULT_MAX_TOTAL_MIN ;

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

      if (loadedConfigObj.GIS_MAX_ITERATIONS !== undefined){
        console.log("LOADED GIS_MAX_ITERATIONS: " + loadedConfigObj.GIS_MAX_ITERATIONS);
        cnf.maxIterations = loadedConfigObj.GIS_MAX_ITERATIONS;
      }

      if (loadedConfigObj.GIS_MIN_INPUTS_GENERATED !== undefined){
        console.log("LOADED GIS_MIN_INPUTS_GENERATED: " + loadedConfigObj.GIS_MIN_INPUTS_GENERATED);
        cnf.minInputsGenerated = loadedConfigObj.GIS_MIN_INPUTS_GENERATED;
      }

      if (loadedConfigObj.GIS_MAX_INPUTS_GENERATED !== undefined){
        console.log("LOADED GIS_MAX_INPUTS_GENERATED: " + loadedConfigObj.GIS_MAX_INPUTS_GENERATED);
        cnf.maxInputsGenerated = loadedConfigObj.GIS_MAX_INPUTS_GENERATED;
      }

      if (loadedConfigObj.GIS_MIN_TOTAL_MIN !== undefined){
        console.log("LOADED GIS_MIN_TOTAL_MIN: " + loadedConfigObj.GIS_MIN_TOTAL_MIN);
        cnf.minTotalMin = loadedConfigObj.GIS_MIN_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_MAX_TOTAL_MIN !== undefined){
        console.log("LOADED GIS_MAX_TOTAL_MIN: " + loadedConfigObj.GIS_MAX_TOTAL_MIN);
        cnf.maxTotalMin = loadedConfigObj.GIS_MAX_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_MIN_DOMINANT_MIN !== undefined){
        console.log("LOADED GIS_MIN_DOMINANT_MIN: " + loadedConfigObj.GIS_MIN_DOMINANT_MIN);
        cnf.minDominantMin = loadedConfigObj.GIS_MIN_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_MAX_DOMINANT_MIN !== undefined){
        console.log("LOADED GIS_MAX_DOMINANT_MIN: " + loadedConfigObj.GIS_MAX_DOMINANT_MIN);
        cnf.maxDominantMin = loadedConfigObj.GIS_MAX_DOMINANT_MIN;
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
      console.log(chalkInfo("histogramsObj: " + histogramsObj.histogramsId));

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
          quit();
        }
        else {
          const inFile = inputsObj.inputsId + ".json"; 
          console.log(chalkInfo("... SAVING INPUTS FILE: " + inFolder + "/" + inFile));
          saveFileQueue.push({folder: inFolder, file: inFile, obj: inputsObj});
          quit();
        }
      });
    }

  });

});
