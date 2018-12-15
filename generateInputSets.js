 /*jslint node: true */
"use strict";

const HOST = process.env.PRIMARY_HOST || "local";
const PRIMARY_HOST = process.env.PRIMARY_HOST || "macpro2";

const DEFAULT_INPUTS_FILE_PREFIX = "inputs";

const DEFAULT_INPUT_TYPES = [
  "emoji", 
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

const os = require("os");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.set("useFindAndModify", false);

const wordAssoDb = require("@threeceelabs/mongoose-twitter");

const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const networkInputsModel = require("@threeceelabs/mongoose-twitter/models/networkInputs.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");

let NeuralNetwork;
let NetworkInputs;
let User;

let dbConnectionReady = false;
let dbConnectionReadyInterval;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const MAX_TEST_INPUTS = 1000;

const DEFAULT_DOMINANT_MIN_STEP = 0.0015;
const DEFAULT_TOTAL_MIN_STEP = 0.95;

const DEFAULT_MIN_INPUTS_PER_TYPE_MULTIPLIER = 0.3;
const DEFAULT_DOMINANT_MIN_STEP_MULTIPLIER = 3.0;
const DEFAULT_TOTAL_MIN_STEP_MULTIPLIER = 0.35;

let enableMinNumInputsPerTypeMultiplier = false;

const MAX_NUM_INPUTS_PER_TYPE = process.env.MAX_NUM_INPUTS_PER_TYPE || 350;
const MIN_NUM_INPUTS_PER_TYPE = process.env.MIN_NUM_INPUTS_PER_TYPE || 250;

const INIT_DOM_MIN = 0.99999;
const INIT_TOT_MIN = 50;

const DEFAULT_MIN_DOMINANT_MIN = 0.350;
const DEFAULT_MAX_DOMINANT_MIN = 0.999999;

const DEFAULT_MIN_TOTAL_MIN = 5;
const DEFAULT_MAX_TOTAL_MIN = 1500;

const DEFAULT_MIN_INPUTS_GENERATED = process.env.MIN_INPUTS_GENERATED || 1000 ;
const DEFAULT_MAX_INPUTS_GENERATED = process.env.MAX_INPUTS_GENERATED || 1750 ;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_MAX_ITERATIONS = 50;

const OFFLINE_MODE = false;

const histogramParser = require("@threeceelabs/histogram-parser");
// const histogramParser = require("../histogram-parser");
const util = require("util");
const _ = require("lodash");
const treeify = require("treeify");

const JSONStream = require("JSONStream");
const stream = JSONStream.parse("$*.$*.$*"); //rows, ANYTHING, doc
const es = require("event-stream");
const async = require("async");
const debug = require("debug")("gis");

const deepcopy = require("deep-copy");
const randomFloat = require("random-float");
const randomInt = require("random-int");
const fs = require("fs");
const moment = require("moment");
const table = require("text-table");
const ora = require("ora");

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.green;

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#gis";
const Slack = require("slack-node");

let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text, callback) {
  debug(chalkInfo("SLACK POST: " + text));
  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response) {
    if (err) {
      console.log(chalkError("GIS | *** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}

let saveFileQueue = [];
let saveFileQueueInterval;
let saveFileBusy = false;

let globalInputsObj = {};
globalInputsObj.inputsId = ""; // will be generated after number of inputs determined
globalInputsObj.meta = {};
globalInputsObj.meta.type = {};
globalInputsObj.meta.numInputs = 0;
globalInputsObj.meta.histogramParseTotalMin = INIT_TOT_MIN;
globalInputsObj.meta.histogramParseDominantMin = INIT_DOM_MIN;
globalInputsObj.inputs = {};


let stdin;

const fetch = require("isomorphic-fetch");
const Dropbox = require("dropbox").Dropbox;

function msToTime(duration) {

  let sign = 1;

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

let statsObj = {};
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.heartbeatsReceived = 0;
statsObj.lessThanMin = 0;
statsObj.moreThanMin = 0;

const GIS_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.fetchUsersComplete = false;
statsObj.runId = GIS_RUN_ID;

statsObj.elapsed = 0;

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

DEFAULT_INPUT_TYPES.forEach(function(type){

  statsObj.histograms[type] = {};

});

let configuration = {};

configuration.inputsFilePrefix = DEFAULT_INPUTS_FILE_PREFIX;

configuration.testMode = false;

configuration.maxIterations = DEFAULT_MAX_ITERATIONS;
configuration.minInputsGenerated = DEFAULT_MIN_INPUTS_GENERATED;
configuration.maxInputsGenerated = DEFAULT_MAX_INPUTS_GENERATED;

configuration.minNumInputsPerTypeMultiplier = DEFAULT_MIN_INPUTS_PER_TYPE_MULTIPLIER;
configuration.dominantMinStepMultiplier = DEFAULT_DOMINANT_MIN_STEP_MULTIPLIER;
configuration.totalMinStepMultiplier = DEFAULT_TOTAL_MIN_STEP_MULTIPLIER;

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

let statsUpdateInterval;

const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
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
let commandLineArgs;
let configArgs;


const minInputsGenerated = { name: "minInputsGenerated", type: Number};
const maxInputsGenerated = { name: "maxInputsGenerated", type: Number};

const minDominantMin = { name: "minDominantMin", type: Number};
const maxDominantMin = { name: "maxDominantMin", type: Number};

const minTotalMin = { name: "minTotalMin", type: Number};
const maxTotalMin = { name: "maxTotalMin", type: Number};

const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const targetServer = { name: "targetServer", alias: "t", type: String};
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

console.log(chalkInfo("GIS | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("GIS | COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));


if (commandLineConfig.targetServer === "LOCAL") {
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}

if (commandLineConfig.targetServer === "REMOTE") {
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}


process.title = "node_generateInputSets";
console.log("\n\nGIS | =================================");
console.log("GIS | HOST:          " + hostname);
console.log("GIS | PROCESS TITLE: " + process.title);
console.log("GIS | PROCESS ID:    " + process.pid);
console.log("GIS | RUN ID:        " + statsObj.runId);
console.log("GIS | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("GIS | =================================");

process.on("exit", function() {
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(statsUpdateInterval);

    setTimeout(function() {
      showStats();
      console.log("GIS | QUITTING generateInputSets");
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

let defaultHistogramsFolder;

if (hostname === PRIMARY_HOST){ 
 defaultHistogramsFolder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms";
}
else {
 defaultHistogramsFolder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/histograms";
}

const localInputsFolder = dropboxConfigHostFolder + "/inputs";
const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";

console.log("GIS | DROPBOX_GIS_CONFIG_FILE: " + DROPBOX_GIS_CONFIG_FILE);
console.log("GIS | DROPBOX_GIS_STATS_FILE : " + DROPBOX_GIS_STATS_FILE);
console.log("GIS | statsFolder : " + statsFolder);
console.log("GIS | statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ 
  accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

let resultsArray = [];

function showStats(options){

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  if (options) {
  }
  else {
    console.log(chalkLog("\nGIS | STATS"
      + " | E: " + msToTime(statsObj.elapsed)
      + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
    ));
  }
}

const inputsDefault = function (inputsObj){
  return inputsObj;
};

function printInputsObj(title, inputsObj) {

  inputsObj = inputsDefault(inputsObj);

  console.log(chalkBlue(title
    + " | " + inputsObj.inputsId
    + "\n" + jsonPrint(inputsObj.meta)
  ));
}

const sortedObjectValues = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.obj);

    const sortedKeys = keys.sort(function(a,b){
      return params.obj[b][params.sortKey] - params.obj[a][params.sortKey];
    });

    if (keys.length !== undefined) {
      if (sortedKeys !== undefined) { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
      }
      else {
        resolve({sortKey: params.sortKey, sortedKeys: []});
      }

    }
    else {
      console.log("GIS | sortedObjectValues ERROR | params\n" + jsonPrint(params));
      reject(new Error("ERROR"));
    }

  });
};


function generateInputSets(params) {

  return new Promise(function(resolve, reject){

    let iteration = 0;
    let currentType;

    /*
    pseudo code

    MIN_NUM_INPUTS_PER_TYPE = 150 (6 types * MIN_NUM_INPUTS_PER_TYPE = MAX_INPUTS: 900)
    MAX_NUM_INPUTS_PER_TYPE = 250 (6 types * MAX_NUM_INPUTS_PER_TYPE = MAX_INPUTS: 1500)
    totalMin = 1
    initial dominantMin = 1.0

    for each inputs type
      while (number of inputs of type < MIN_NUM_INPUTS_PER_TYPE)
        dominantMin -= DOM_MIN_STEP
    */

    let totalMin = INIT_TOT_MIN;
    let maxTotalMin = configuration.maxTotalMin;
    let dominantMin = INIT_DOM_MIN;

    let newInputsObj = {};
    newInputsObj.inputsId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
    newInputsObj.meta = {};
    newInputsObj.meta.type = {};
    newInputsObj.meta.numInputs = 0;
    newInputsObj.meta.histogramParseTotalMin = totalMin;
    newInputsObj.meta.histogramParseDominantMin = dominantMin;
    newInputsObj.inputs = {};
    newInputsObj.inputsMinimum = {};

    let inTypes = Object.keys(params.histogramsObj.histograms);
    inTypes.sort();

    const DOM_MIN_STEP = DEFAULT_DOMINANT_MIN_STEP; // 0.1
    const TOT_MIN_STEP = DEFAULT_TOTAL_MIN_STEP; // 0.9;

    let dominantMinStep = DOM_MIN_STEP;
    let totalMinStep = TOT_MIN_STEP;

    let prevTotMinChange = 0;
    let prevDomMinChange = 0;

    let prevDomMin = dominantMin;
    let prevTotalMin = totalMin;
    let prevDomMinStep = dominantMinStep;
    let prevTotalMinStep = totalMinStep;

    let prevInputs = [];
    let prevNumInputs = 0;
    // let inputsHistory = [];

    let overMaxNumInputs = Infinity;
    let underMinNumInputs = 0;
    let lastParams;
    let secondToLastParams;


    function printGisStatus(){
      console.log(chalkBlue(
        "\nGIS | GEN TYPE"
        + " [" + iteration + "]"
        + " " + currentType.toUpperCase()
        + " | " + newInputsObj.meta.type[currentType].numInputs
        + " / " + Object.keys(params.histogramsObj.histograms[currentType]).length + " INPUTS"
        + " | UNDER MIN: " + newInputsObj.meta.type[type].underMinNumInputs
        + " | OVER MAX: " + newInputsObj.meta.type[type].overMaxNumInputs
        + " | PREV NUM INPUTS: " + prevNumInputs
        + " | DOM MIN: " + dominantMin.toFixed(5)
        + " | PREV DOM MIN: " + prevDomMin.toFixed(5)
        + " | PREV DOM MIN STEP: " + prevDomMinStep.toFixed(8)
        + " | TOT MIN: " + parseInt(totalMin)
        + " | PREV TOT MIN: " + parseInt(prevTotalMin)
        + " | PREV TOT MIN STEP: " + prevTotalMinStep.toFixed(5)
      ));
    }

    async.eachSeries(

      inTypes, 

      function(type, cb0){

        currentType = type;

        iteration = 0;

        const spinner = ora("GEN TYPE" + " | " + type.toUpperCase()).start();

        dominantMinStep = DOM_MIN_STEP;

        const totalTypeInputs = Object.keys(params.histogramsObj.histograms[type]).length;

        newInputsObj.meta.type[type] = {};

        // start with zero inputs of type if more than MIN_NUM_INPUTS_PER_TYPE
        newInputsObj.meta.type[type].numInputs = (totalTypeInputs > MIN_NUM_INPUTS_PER_TYPE) ? 0 : totalTypeInputs;
        newInputsObj.meta.type[type].dominantMin = dominantMin;
        newInputsObj.meta.type[type].underMinNumInputs = null;
        newInputsObj.meta.type[type].overMaxNumInputs = null;
        newInputsObj.meta.type[type].currentMaxNumInputs = 0;


        newInputsObj.inputs[type] = Object.keys(params.histogramsObj.histograms[type]).sort();
        newInputsObj.inputsMinimum[type] = [];

        let hpParams = {};
        // hpParams.verbose = true;
        hpParams.histogram = {};
        hpParams.histogram[type] = {};
        hpParams.histogram[type] = params.histogramsObj.histograms[type];

        hpParams.options = {};
        hpParams.options.globalTotalMin = totalMin;
        hpParams.options.globalDominantMin = dominantMin;

        async.whilst(

          function() {

            debug("whilst"
              + " | TYPE: " + type
              + " | MIN_NUM_INPUTS_PER_TYPE: " + MIN_NUM_INPUTS_PER_TYPE
              + " | totalTypeInputs: " + totalTypeInputs
              + " | Object.keys(params.histogramsObj.histograms[type]).length: " + Object.keys(params.histogramsObj.histograms[type]).length
              + " | newInputsObj.meta.type[type].numInputs: " + newInputsObj.meta.type[type].numInputs
            );

            return (
              ((newInputsObj.meta.type[type].numInputs > MAX_NUM_INPUTS_PER_TYPE) 
                || ((newInputsObj.meta.type[type].numInputs < MIN_NUM_INPUTS_PER_TYPE) 
                  && (totalTypeInputs > MIN_NUM_INPUTS_PER_TYPE))
              )

            );
          },

          function(cb1){

            hpParams.options.globalTotalMin = totalMin;
            hpParams.options.globalDominantMin = dominantMin;

            histogramParser.parse(hpParams, function(err, histResults){

              if (err){
                console.log(chalkError("GIS | *** HISTOGRAM PARSE ERROR: " + err));
                return cb1(err);
              }

              iteration += 1;

              newInputsObj.inputs[type] = Object.keys(histResults.entries[type].dominantEntries).sort();
              newInputsObj.meta.type[type].numInputs = newInputsObj.inputs[type].length;
              newInputsObj.meta.type[type].dominantMin = dominantMin;
              newInputsObj.meta.type[type].totalMin = parseInt(totalMin);
              newInputsObj.meta.type[type].totalMinStep = totalMinStep;
              newInputsObj.meta.type[type].dominantMinStep = dominantMinStep;
              newInputsObj.meta.type[type].currentMaxNumInputs = Math.max(newInputsObj.meta.type[type].numInputs, newInputsObj.meta.type[type].currentMaxNumInputs);

              if (newInputsObj.meta.type[type].numInputs < MIN_NUM_INPUTS_PER_TYPE) {
                newInputsObj.inputsMinimum[type] = _.union(newInputsObj.inputsMinimum[type], newInputsObj.inputs[type]);
              }

              // inputsHistory.push(newInputsObj.meta.type[type]);

              spinner.text = "GIS | GEN TYPE"
                + " [" + iteration + "]"
                + " " + type.toUpperCase()
                + " | " + newInputsObj.meta.type[type].numInputs
                + " / " + Object.keys(params.histogramsObj.histograms[type]).length + " INPUTS"
                + " | CUR MAX IN: " + newInputsObj.meta.type[type].currentMaxNumInputs
                + " | UNDER MIN: " + newInputsObj.meta.type[type].underMinNumInputs
                + " | OVER MAX: " + newInputsObj.meta.type[type].overMaxNumInputs
                + " | PREV NUM INPUTS: " + prevNumInputs
                + " | DOM MIN: " + dominantMin.toFixed(5)
                + " | PREV DOM MIN: " + prevDomMin.toFixed(5)
                + " | PREV DOM MIN STEP: " + prevDomMinStep.toFixed(8)
                + " | TOT MIN: " + parseInt(totalMin)
                + " | PREV TOT MIN: " + parseInt(prevTotalMin)
                + " | PREV TOT MIN STEP: " + prevTotalMinStep.toFixed(5);

              if (newInputsObj.meta.type[type].numInputs < MIN_NUM_INPUTS_PER_TYPE) {
                newInputsObj.meta.type[type].underMinNumInputs = newInputsObj.meta.type[type].numInputs;
              }

              if (newInputsObj.meta.type[type].numInputs > MAX_NUM_INPUTS_PER_TYPE) {
                newInputsObj.meta.type[type].overMaxNumInputs = newInputsObj.meta.type[type].numInputs;
              }

              // if (iteration % 100 === 0){
              //   console.log(chalkLog("\n" + spinner.text));
              // }

              if ((newInputsObj.meta.type[type].numInputs > MAX_NUM_INPUTS_PER_TYPE) 
                && (prevNumInputs < MAX_NUM_INPUTS_PER_TYPE)) {

                spinner.info("GIS | GEN TYPE"
                  + " [" + iteration + "]"
                  + " " + type.toUpperCase()
                  + " | " + newInputsObj.meta.type[type].numInputs
                  + " / " + Object.keys(params.histogramsObj.histograms[type]).length + " INPUTS"
                  + " | CUR MAX IN: " + newInputsObj.meta.type[type].currentMaxNumInputs
                  + " | UNDER MIN: " + newInputsObj.meta.type[type].underMinNumInputs
                  + " | OVER MAX: " + newInputsObj.meta.type[type].overMaxNumInputs
                  + " | PREV NUM INPUTS: " + prevNumInputs
                  + " | DOM MIN: " + dominantMin.toFixed(5)
                  + " | PREV DOM MIN: " + prevDomMin.toFixed(5)
                  + " | PREV DOM MIN STEP: " + prevDomMinStep.toFixed(8)
                  + " | TOT MIN: " + parseInt(totalMin)
                  + " | PREV TOT MIN: " + parseInt(prevTotalMin)
                  + " | PREV TOT MIN STEP: " + prevTotalMinStep.toFixed(5)
                );


                if (newInputsObj.meta.type[type].numInputs === 0){
                }
                else {
                  // printGisStatus();
                  return cb1(true);
                }
              }
              else if ((dominantMin - dominantMinStep > configuration.minDominantMin) 
                && (newInputsObj.meta.type[type].numInputs < MIN_NUM_INPUTS_PER_TYPE)) {

                if (enableMinNumInputsPerTypeMultiplier 
                  && (newInputsObj.meta.type[type].numInputs < configuration.minNumInputsPerTypeMultiplier * MIN_NUM_INPUTS_PER_TYPE)) { // 0.1
                  prevDomMin = dominantMin;
                  dominantMin -= (configuration.dominantMinStepMultiplier * dominantMinStep);
                }
                else {
                  prevDomMin = dominantMin;
                  dominantMin -= dominantMinStep;
                }

              }
              else if (dominantMin - dominantMinStep <= configuration.minDominantMin) {

                if (totalMin >= configuration.minTotalMin){

                  prevDomMin = dominantMin;
                  dominantMin = INIT_DOM_MIN;

                  prevTotalMin = totalMin; 

                  if (enableMinNumInputsPerTypeMultiplier 
                    && (newInputsObj.meta.type[type].numInputs < configuration.minNumInputsPerTypeMultiplier * MIN_NUM_INPUTS_PER_TYPE)) {
                    totalMin = Math.min(
                      parseInt(configuration.totalMinStepMultiplier * totalMinStep * totalMin), 
                      parseInt(totalMin-1.0)
                    );
                  }
                  else {
                    totalMin = Math.min(parseInt(totalMinStep * totalMin), parseInt(totalMin-1.0));
                  }
                }
                else {
                  newInputsObj.inputs[type] = newInputsObj.inputsMinimum[type];
                  newInputsObj.meta.type[type].numInputs = newInputsObj.inputs[type].length;

                  console.log(chalkAlert("\nGIS | XXX GIVE UP"
                    + " | " + type.toUpperCase()
                    + " | NUM IN: " + newInputsObj.meta.type[type].numInputs 
                    + " | TOT MIN: " + totalMin 
                    + " | DOM MIN: " + dominantMin.toFixed(5)
                  ));

                  return cb1(true);
                }

              }

              prevNumInputs = newInputsObj.meta.type[type].numInputs;
              prevTotalMinStep = (prevTotalMin === totalMin) ? prevTotalMinStep : totalMin - prevTotalMin; 

              async.setImmediate(function() { cb1(); });

            });
          }, 

          function(err){

            enableMinNumInputsPerTypeMultiplier = false;

            newInputsObj.meta.numInputs += newInputsObj.meta.type[type].numInputs;

            spinner.text = "GIS | +++ END TYPE"
              + " [" + iteration + "]"
              + " " + type.toUpperCase()
              + " | " + newInputsObj.meta.type[type].numInputs
              + " / " + Object.keys(params.histogramsObj.histograms[type]).length + " INPUTS"
              + " | CUR MAX IN: " + newInputsObj.meta.type[type].currentMaxNumInputs
              + " | UNDER MIN: " + newInputsObj.meta.type[type].underMinNumInputs
              + " | OVER MAX: " + newInputsObj.meta.type[type].overMaxNumInputs
              + " | PREV NUM INPUTS: " + prevNumInputs
              + " | DOM MIN: " + dominantMin.toFixed(5)
              + " | PREV DOM MIN: " + prevDomMin.toFixed(5)
              + " | PREV DOM MIN STEP: " + prevDomMinStep.toFixed(8)
              + " | TOT MIN: " + parseInt(totalMin)
              + " | PREV TOT MIN: " + parseInt(prevTotalMin)
              + " | PREV TOT MIN STEP: " + prevTotalMinStep.toFixed(5);

            spinner.succeed();

            totalMin = parseInt(INIT_TOT_MIN);
            prevDomMin = INIT_DOM_MIN;
            dominantMin = INIT_DOM_MIN;
            prevDomMinChange = 0;
            prevTotMinChange = 0;

            if (newInputsObj.meta.type[type].numInputs === 0) {
              // quit("ZERO INPUTS");
              console.log(chalkAlert("GIS | ZERO INPUTS | " + type));
              cb0();
            }
            else{
              cb0();
            }
          }
        );
      },

      function(err){
        if (err) { return reject(err); }
        // showStats();
        resolve(newInputsObj);
      }
    );
  });
}

let quitWaitInterval;
let userReadyInterval;

function quit(cause){

  console.log( "\nGIS | ... QUITTING ..." );

  if (cause) {
    console.log( "GIS | CAUSE: " + cause );
  }

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy 
      && (saveFileQueue.length === 0)
      ){

      statsObj.elapsed = moment().diff(statsObj.startTimeMoment);

      clearInterval(statsUpdateInterval);
      clearInterval(quitWaitInterval);

      console.log(chalkAlert("\nGIS | ALL PROCESSES COMPLETE ... QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));

      // showStats();

      setTimeout(function(){
        process.exit();      
      }, 1000);

    }
    else {
      console.log(chalkInfo("GIS | ... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
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

  if (OFFLINE_MODE) {
    console.log("GIS | OFFLINE_MODE: " + OFFLINE_MODE);
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
      debug(chalkLog("GIS | SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError("GIS | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError("GIS | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError("GIS | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        console.error(chalkError("GIS | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: " + error
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
  };

  if (options.mode === "add") {

    dropboxClient.filesListFolder({path: params.folder})
    .then(function(response){

      debug(chalkLog("GIS | DROPBOX LIST FOLDER"
        + " | " + options.path
        + " | " + jsonPrint(response)
      ));

      let fileExits = false;

      async.eachSeries(response.entries, function(entry, cb){

        debug(chalkInfo("DROPBOX FILE"
          + " | " + params.folder
          + " | " + entry.name
        ));

        if (entry.name === params.file) {
          fileExits = true;
        }

        cb();

      }, function(err){
        if (err) {
          console.log(chalkError("GIS | *** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("GIS | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("GIS | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    })
    .catch(function(err){
      console.log(chalkError("GIS | saveFile *** DROPBOX FILES LIST FOLDER ERROR ", err));
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

function loadFile(params) {

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;
    const streamMode = params.streamMode || false;

    debug(chalkInfo("LOAD FOLDER " + folder));
    debug(chalkInfo("LOAD FILE " + file));
    debug(chalkInfo("FULL folder " + folder + "/" + file));

    let fullPath = folder + "/" + file;

    if (OFFLINE_MODE) {

      if (hostname !== PRIMARY_HOST) {

        fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + folder + "/" + file;
        debug(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));

        const pathExists = fs.existsSync(fullPath);

        if (!pathExists) {
          console.log(chalkAlert("GIS | !!! PATH DOES NOT EXIST ... SKIPPING LOAD: " + fullPath));
          return reject(new Error("PATH DOES NOT EXIST: " + fullPath));
        }

      }
      fs.readFile(fullPath, "utf8", function(err, data) {
        if (err) {
          console.log(chalkError("GIS | LOAD FILE ERROR: " + err));
          return reject(err);
        }
        debug(chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE"
          + " | " + fullPath
        ));

        if (file.match(/\.json$/gi)) {
          try {
            let fileObj = JSON.parse(data);
            resolve(fileObj);
          }
          catch(e){
            console.trace(chalkError("GIS | JSON PARSE ERROR: " + e));
            return reject(e);
          }
        }
        else {
          resolve();
        }
      });
     }
    else if (streamMode) {

      console.log(chalkInfo("GIS | STREAM MODE: FULL PATH " + fullPath));

      const pathExists = fs.existsSync(fullPath);

      if (!pathExists) {
        console.log(chalkAlert("GIS | !!! PATH DOES NOT EXIST ... SKIPPING LOAD: " + fullPath));
        return reject(new Error("PATH DOES NOT EXIST: " + fullPath));
      }

      let fileObj = {};

      let totalInputs = 0;
      let lessThanMin = 0;
      let moreThanMin = 0;

      let totalCategorized = 0;
      let maxTotalCategorized = 0;

      let pipeline = fs.createReadStream(fullPath).pipe(JSONStream.parse("$*.$*.$*"));

      pipeline.on("data", function(obj){

        totalInputs += 1;

        // VALUE
        // ├─ total: 16
        // ├─ left: 2
        // ├─ neutral: 0
        // ├─ right: 3
        // ├─ positive: 0
        // ├─ negative: 0
        // ├─ none: 0
        // └─ uncategorized: 11


        totalCategorized = obj.value.total - obj.value.uncategorized;
        maxTotalCategorized = Math.max(maxTotalCategorized, totalCategorized);

        if (totalCategorized >= configuration.minTotalMin) {

          moreThanMin += 1;

          debug(chalkLog("GIS | +++ INPUT"
            + " [" + moreThanMin + "]"
            + " | " + params.type
            + " | " + obj.key
            + " | TOT CAT: " + totalCategorized 
            + " | MAX TOT CAT: " + maxTotalCategorized 
            // + "\nVALUE\n" + jsonPrint(obj.value)
          ));

          fileObj[obj.key] = obj.value;
        }
        else {
          lessThanMin += 1;
        }

        debug("data: " + jsonPrint(obj));

        if (configuration.verbose && totalInputs % 10000 === 0) {
          console.log(chalkLog("GIS | STREAM INPUTS | " + fullPath + " | INPUTS: " + totalInputs));
        }

        if (configuration.testMode && (totalInputs >= MAX_TEST_INPUTS) && (totalInputs % 100 === 0)) {
          console.log(chalkAlert("GIS | TEST MODE | END READ | TOTAL TEST INPUTS: " + totalInputs + " MAX: " + MAX_TEST_INPUTS));
          pipeline.destroy();
        }
      });

      pipeline.on("header", function(header){
        console.log("GIS | HEADER: " + jsonPrint(header));
      });

      pipeline.on("footer", function(footer){
        console.log("GIS | FOOTER: " + jsonPrint(footer));
      });

      pipeline.on("close", function(){
        if (configuration.verbose) {console.log(chalkInfo("GIS | STREAM CLOSED | INPUTS: " + totalInputs + " | " + fullPath));}
        return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
      });

      pipeline.on("end", function(){
        if (configuration.verbose) {console.log(chalkInfo("GIS | STREAM END | INPUTS: " + totalInputs + " | " + fullPath));}
        return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
      });

      pipeline.on("finish", function(){
        if (configuration.verbose) {console.log(chalkInfo("GIS | STREAM FINISH | INPUTS: " + totalInputs + " | " + fullPath));}
        return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
      });

      pipeline.on("error", function(err){
        console.log(chalkError("GIS | STREAM ERROR | INPUTS: " + totalInputs + " | " + fullPath));
        console.log(chalkError("GIS | *** LOAD FILE ERROR: " + err));
        return reject(err);
      });
    }
    else {
      dropboxClient.filesDownload({path: fullPath})
      .then(function(data) {
        console.log("GIS | " + chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (file.match(/\.json$/gi)) {
          let payload = data.fileBinary;
          debug(payload);

          try {
            let fileObj = JSON.parse(payload);
            return resolve(fileObj);
          }
          catch(e){
            console.trace(chalkError("GIS | JSON PARSE ERROR: " + e));
            return reject(e);
          }
        }
        else {
          resolve();
        }
      })
      .catch(function(error) {

        if (error.response !== undefined) {

          if (error.response.status === 404) {
            console.error(chalkError("GIS | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND" + " ... SKIPPING ..."));
            return reject(error);
          }
          if (error.response.status === 409) {
            console.error(chalkError("GIS | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND" + " ... SKIPPING ..."));
            return reject(error);
          }
          if (error.response.status === 0) {
            console.error(chalkError("GIS | !!! DROPBOX NO RESPONSE"
              + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
            return reject(error);
          }
        }

        console.log(chalkError("GIS | !!! DROPBOX READ " + fullPath + " ERROR"));
        console.log(chalkError("GIS |\n", error));
        console.log(chalkError("GIS | " + jsonPrint(error)));

        return reject(error);

      });
    }

  });
}

function connectDb(){

  return new Promise(function(resolve, reject){

    statsObj.status = "CONNECT DB";

    wordAssoDb.connect("TNN_" + process.pid, function(err, db){
      if (err) {
        console.log(chalkError("*** GIS | MONGO DB CONNECTION ERROR: " + err));
        dbConnectionReady = false;
        return reject(err);
      }

      db.on("error", function(){
        dbConnectionReady = false;
        console.error.bind(console, "*** GIS | MONGO DB CONNECTION ERROR ***\n");
        console.log(chalkError("*** GIS | MONGO DB CONNECTION ERROR ***\n"));
        db.close();
      });

      db.on("disconnected", function(){
        dbConnectionReady = false;
        console.error.bind(console, "*** GIS | MONGO DB DISCONNECTED ***\n");
        console.log(chalkAlert("*** GIS | MONGO DB DISCONNECTED ***\n"));
      });


      console.log(chalkBlue("GIS | MONGOOSE DEFAULT CONNECTION OPEN"));

      dbConnectionReady = true;

      User = mongoose.model("User", userModel.UserSchema);
      NetworkInputs = mongoose.model("NetworkInputs", networkInputsModel.NetworkInputsSchema);

      resolve(db);

    });

  });

}

function initStatsUpdate(callback){

  console.log(chalkTwitter("GIS | INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

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

function initialize(cnf){

  return new Promise(async function(resolve, reject){

    try {

      if (debug.enabled){
        console.log("\nGIS | %%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
      }

      cnf.processName = process.env.GIS_PROCESS_NAME || "generateInputSets";
      cnf.targetServer = process.env.GIS_UTIL_TARGET_SERVER || "http://127.0.0.1:9997/util" ;

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

      cnf.statsUpdateIntervalTime = process.env.GIS_STATS_UPDATE_INTERVAL || 10*ONE_SECOND;

      const loadedConfigObj = await loadFile({folder: dropboxConfigHostFolder, file: dropboxConfigFile});

      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.GIS_INPUTS_FILE_PREFIX !== undefined){
        console.log("GIS | LOADED GIS_INPUTS_FILE_PREFIX: " + loadedConfigObj.GIS_INPUTS_FILE_PREFIX);
        cnf.inputsFilePrefix = loadedConfigObj.GIS_INPUTS_FILE_PREFIX;
      }

      if (loadedConfigObj.GIS_MAX_ITERATIONS !== undefined){
        console.log("GIS | LOADED GIS_MAX_ITERATIONS: " + loadedConfigObj.GIS_MAX_ITERATIONS);
        cnf.maxIterations = loadedConfigObj.GIS_MAX_ITERATIONS;
      }

      if (loadedConfigObj.GIS_MIN_INPUTS_GENERATED !== undefined){
        console.log("GIS | LOADED GIS_MIN_INPUTS_GENERATED: " + loadedConfigObj.GIS_MIN_INPUTS_GENERATED);
        cnf.minInputsGenerated = loadedConfigObj.GIS_MIN_INPUTS_GENERATED;
      }

      if (loadedConfigObj.GIS_MAX_INPUTS_GENERATED !== undefined){
        console.log("GIS | LOADED GIS_MAX_INPUTS_GENERATED: " + loadedConfigObj.GIS_MAX_INPUTS_GENERATED);
        cnf.maxInputsGenerated = loadedConfigObj.GIS_MAX_INPUTS_GENERATED;
      }

      if (loadedConfigObj.GIS_MIN_TOTAL_MIN !== undefined){
        console.log("GIS | LOADED GIS_MIN_TOTAL_MIN: " + loadedConfigObj.GIS_MIN_TOTAL_MIN);
        cnf.minTotalMin = loadedConfigObj.GIS_MIN_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_MAX_TOTAL_MIN !== undefined){
        console.log("GIS | LOADED GIS_MAX_TOTAL_MIN: " + loadedConfigObj.GIS_MAX_TOTAL_MIN);
        cnf.maxTotalMin = loadedConfigObj.GIS_MAX_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_MIN_DOMINANT_MIN !== undefined){
        console.log("LOADED GIS_MIN_DOMINANT_MIN: " + loadedConfigObj.GIS_MIN_DOMINANT_MIN);
        cnf.minDominantMin = loadedConfigObj.GIS_MIN_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_MAX_DOMINANT_MIN !== undefined){
        console.log("GIS | LOADED GIS_MAX_DOMINANT_MIN: " + loadedConfigObj.GIS_MAX_DOMINANT_MIN);
        cnf.maxDominantMin = loadedConfigObj.GIS_MAX_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_TEST_MODE !== undefined){
        console.log("GIS | LOADED GIS_TEST_MODE: " + loadedConfigObj.GIS_TEST_MODE);
        cnf.testMode = loadedConfigObj.GIS_TEST_MODE;
      }

      if (loadedConfigObj.GIS_QUIT_ON_COMPLETE !== undefined){
        console.log("GIS | LOADED GIS_QUIT_ON_COMPLETE: " + loadedConfigObj.GIS_QUIT_ON_COMPLETE);
        cnf.quitOnComplete = loadedConfigObj.GIS_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined){
        console.log("GIS | LOADED GIS_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN);
        cnf.histogramParseDominantMin = loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
        console.log("GIS | LOADED GIS_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN);
        cnf.histogramParseTotalMin = loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_ENABLE_STDIN !== undefined){
        console.log("GIS | LOADED GIS_ENABLE_STDIN: " + loadedConfigObj.GIS_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.GIS_ENABLE_STDIN;
      }

      if (loadedConfigObj.GIS_KEEPALIVE_INTERVAL !== undefined) {
        console.log("GIS | LOADED GIS_KEEPALIVE_INTERVAL: " + loadedConfigObj.GIS_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.GIS_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("GIS | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("GIS | INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(err){
        return resolve(cnf);
      });

    }
    catch(err){

      console.log(chalkAlert("GIS | *** ERROR | DROPBOX CONFIG PATH " + dropboxConfigHostFolder + "/" + dropboxConfigFile + " | ERROR: " + err));

      console.log(chalkAlert("GIS | ??? DROPBOX CONFIG PATH " + dropboxConfigHostFolder + "/" + dropboxConfigFile + " NOT LOADED | USING DEFAULTS"));

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("GIS | --> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("GIS | INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){
        return resolve(cnf);
      });
    }

  });
}

async function main(){

  try {

    const cnf = await initialize(configuration);

    configuration = deepcopy(cnf);

    console.log(chalkTwitter(configuration.processName 
      + " STARTED " + getTimeStamp() 
    ));

    initSaveFileQueue(configuration);

    if (configuration.testMode) {
    }

    try {
      global.dbConnection = await connectDb();
    }
    catch(err){
      dbConnectionReady = false;
      console.log(chalkError("TFE | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit("MONGO DB CONNECT ERROR");
    }


    console.log(chalkTwitter("GIS | " + configuration.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

    // initSocket(configuration);

    console.log("LOAD " + defaultHistogramsFolder);

    async.eachSeries(DEFAULT_INPUT_TYPES, async function(type){

      let genInParams = {};

      genInParams.histogramsObj = {};
      genInParams.histogramsObj.histograms = {};
      genInParams.histogramsObj.maxTotalMin = {};
      genInParams.histogramsObj.histogramParseDominantMin = configuration.histogramParseDominantMin;
      genInParams.histogramsObj.histogramParseTotalMin = configuration.histogramParseTotalMin;

      const folder = defaultHistogramsFolder + "/types/" + type;
      const file = "histograms_" + type + ".json";

      try {

        let results;

        try {
          results = await loadFile({folder: folder, file: file, streamMode: true, type: type});
        }
        catch(err){
          console.log(chalkAlert("GIS | LOAD HISTOGRAM ERROR: " + err));
          return;
        }

        console.log(chalkBlue("\nGIS | +++ LOADED HISTOGRAM | " + type.toUpperCase()
          + "\nGIS | TOTAL ITEMS:          " + results.totalInputs
          + "\nGIS | MAX TOT CAT:          " + results.maxTotalCategorized
          + "\nGIS | MIN TOTAL MIN:        " + configuration.minTotalMin
          + "\nGIS | MORE THAN TOTAL MIN:  " + results.moreThanMin + " (" + (100*results.moreThanMin/results.totalInputs).toFixed(2) + "%)"
          + "\nGIS | LESS THAN TOTAL MIN:  " + results.lessThanMin + " (" + (100*results.lessThanMin/results.totalInputs).toFixed(2) + "%)"
        ));

        genInParams.histogramsObj.histograms[type] = {};
        genInParams.histogramsObj.histograms[type] = results.obj;

        const inputsObj = await generateInputSets(genInParams);

        globalInputsObj.inputs[type] = {};
        globalInputsObj.inputs[type] = inputsObj.inputs[type];
        globalInputsObj.meta.type[type] = {};
        globalInputsObj.meta.type[type] = inputsObj.meta.type[type];
        globalInputsObj.meta.type[type].totalInputs = results.totalInputs;
        globalInputsObj.meta.type[type].lessThanMin = results.lessThanMin;
        globalInputsObj.meta.type[type].moreThanMin = results.moreThanMin;
        globalInputsObj.meta.type[type].totalMin = globalInputsObj.meta.type[type].totalMin || 0;
        return;

      }
      catch(err){
        console.log(chalkError("GIS | LOAD HISTOGRAMS / GENERATE INPUT SETS ERROR: " + err));
        return(err);
      }

    }, function(err){

      if (err) {
        quit(err);
        return;
      }

      let inFolder = (hostname === PRIMARY_HOST) ? defaultInputsFolder : localInputsFolder;

      if (configuration.testMode) { 
        inFolder = inFolder + "_test";
      }

      let tableArray = [];

      tableArray.push([
        "GIS |",
        "TYPE",
        "DOM MIN",
        "TOT MIN",
        "TYPE TOT IN",
        "TYPE IN",
        "TYPE MTM",
        "TYPE LTM",
        "TOT IN"
      ]);

      globalInputsObj.meta.numInputs = 0;

      async.eachSeries(DEFAULT_INPUT_TYPES, function(type, cb){

        if (globalInputsObj.meta.type[type] === undefined) { return cb(); }

        globalInputsObj.meta.numInputs += globalInputsObj.meta.type[type].numInputs;

        tableArray.push([
          "GIS |",
          type.toUpperCase(),
          globalInputsObj.meta.type[type].dominantMin.toFixed(5),
          parseInt(globalInputsObj.meta.type[type].totalMin),
          globalInputsObj.meta.type[type].totalInputs,
          globalInputsObj.meta.type[type].numInputs,
          globalInputsObj.meta.type[type].moreThanMin,
          globalInputsObj.meta.type[type].lessThanMin,
          globalInputsObj.meta.numInputs
        ]);

        cb();

      }, function(err){

        if (err) {
          return quit(err);
        }


        globalInputsObj.inputsId = configuration.inputsFilePrefix + "_" + moment().format(compactDateTimeFormat) + "_" + globalInputsObj.meta.numInputs + "_" + hostname + "_" + process.pid;


        let networkInputsDoc = new NetworkInputs(globalInputsObj);

        networkInputsDoc.save(function(err, savedNetworkInputsDoc){

          if (err) {
            console.log(chalkError("GIS | *** CREATE NETWORK INPUTS DB DOCUMENT: " + err));
          }
          else {
            printInputsObj("GIS | +++ SAVED NETWORK INPUTS DB DOCUMENT", savedNetworkInputsDoc);
            console.log(chalk.blue(
                "\nGIS | ========================================================================================="
              + "\nGIS | INPUTS" 
              + "\nGIS | -----------------------------------------------------------------------------------------\n"
              + table(tableArray, { align: [ "l", "l", "r", "r", "r", "r", "r", "r", "r"] })
              + "\nGIS | =========================================================================================\n"
            ));
          }

          const slackText = table(tableArray, { align: [ "l", "l", "r", "r", "r", "r", "r", "r", "r"] });

          console.log("GIS | SLACK MESSAGE SENT");
          slackPostMessage(slackChannel, slackText);

          const inFile = globalInputsObj.inputsId + ".json";

          console.log(chalkInfo("GIS | ... SAVING INPUTS FILE: " + inFolder + "/" + inFile));

          saveFileQueue.push({folder: inFolder, file: inFile, obj: globalInputsObj});

          quit();

        });

      });  

    });
  }
  catch(err){

    if (err.response && (err.response.status !== 404) && (err.response.status !== 409)){
      console.error(chalkError("GIS | *** INIT ERROR *** QUITING: ERROR: " + jsonPrint(err)));
      quit();
    }
    else {
      console.error(chalkError("GIS | *** INIT ERROR *** ERROR: CONFIG FILE NOT FOUND | ERROR CODE: " + err.status));
    }
  }
}

main();





