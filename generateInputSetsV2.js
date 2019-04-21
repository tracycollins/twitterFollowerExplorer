 /*jslint node: true */

 const DEFAULT_VERBOSE_MODE = true;

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;


const GLOBAL_TEST_MODE = false; // applies to parent and all children
const STATS_UPDATE_INTERVAL = ONE_MINUTE;

const DEFAULT_INPUTS_FILE_PREFIX = "inputs";

const DEFAULT_MIN_TOTAL_MIN = 5;
const DEFAULT_MAX_TOTAL_MIN = 1500;

const DEFAULT_MIN_INPUTS_GENERATED = 1500;
const DEFAULT_MAX_INPUTS_GENERATED = 2000;
const DEFAULT_MAX_NUM_INPUTS_PER_TYPE = 400;
const DEFAULT_MIN_NUM_INPUTS_PER_TYPE = 200;

const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;

let configuration = {};

configuration.verbose = DEFAULT_VERBOSE_MODE;

configuration.inputsFilePrefix = DEFAULT_INPUTS_FILE_PREFIX;

configuration.testMode = GLOBAL_TEST_MODE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

configuration.minInputsGenerated = DEFAULT_MIN_INPUTS_GENERATED;
configuration.maxInputsGenerated = DEFAULT_MAX_INPUTS_GENERATED;
configuration.minNumInputsPerType = DEFAULT_MIN_NUM_INPUTS_PER_TYPE;
configuration.maxNumInputsPerType = DEFAULT_MAX_NUM_INPUTS_PER_TYPE;

configuration.minTotalMin = DEFAULT_MIN_TOTAL_MIN;
configuration.maxTotalMin = DEFAULT_MAX_TOTAL_MIN;

configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;
configuration.keepaliveInterval = Number(ONE_MINUTE)+1;
configuration.quitOnComplete = true;


const os = require("os");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

let DROPBOX_ROOT_FOLDER;

const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const moment = require("moment");

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let defaultConfiguration = {}; // general configuration for TFE
let hostConfiguration = {}; // host-specific configuration for TFE

const MODULE_NAME = "generateInputSets";
const MODULE_ID_PREFIX = "GIS";
const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";


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

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.set("useFindAndModify", false);

const wordAssoDb = require("@threeceelabs/mongoose-twitter");

const networkInputsModel = require("@threeceelabs/mongoose-twitter/models/networkInputs.server.model");
let NetworkInputs;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const MAX_TEST_INPUTS = 10000


const INIT_DOM_MIN = 0.999999;
const INIT_TOT_MIN = 100;


const OFFLINE_MODE = false;

const merge = require("deepmerge");
const util = require("util");
const _ = require("lodash");
const treeify = require("treeify");
const dot = require("dot-object");

const JSONStream = require("JSONStream");
const async = require("async");
const debug = require("debug")("gis");

const deepcopy = require("deep-copy");
const fs = require("fs");
const table = require("text-table");

const chalk = require("chalk");
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

//=========================================================================
// SLACK
//=========================================================================

const slackChannel = "gis";
const HashMap = require("hashmap").HashMap;
const channelsHashMap = new HashMap();

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackConversationId = "D65CSAELX"; // wordbot
const slackRtmToken = "xoxb-209434353623-bNIoT4Dxu1vv8JZNgu7CDliy";

let slackRtmClient;
let slackWebClient;
const { WebClient } = require("@slack/client");
const { RTMClient } = require("@slack/client");

function slackSendRtmMessage(msg){

  return new Promise(async function(resolve, reject){

    try {
      console.log(chalkBlue("GIS | SLACK RTM | SEND: " + msg));
      const sendResponse = await slackRtmClient.sendMessage(msg, slackConversationId);

      console.log(chalkLog("GIS | SLACK RTM | >T\n" + jsonPrint(sendResponse)));
      resolve(sendResponse);
    }
    catch(err){
      reject(err);
    }

  });
}

function slackSendWebMessage(msgObj){

  return new Promise(async function(resolve, reject){

    try {

      const token = msgObj.token || slackOAuthAccessToken;
      const channel = msgObj.channel || configuration.slackChannel.id;
      const text = msgObj.text || msgObj;

      const message = {
        token: token, 
        channel: channel,
        text: text
      };

      if (msgObj.attachments !== undefined) {
        message.attachments = msgObj.attachments;
      }

      console.log(chalkBlue("GIS | SLACK WEB | SEND\n" + jsonPrint(message)));
      slackWebClient.chat.postMessage(message);
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function slackMessageHandler(message){
  return new Promise(async function(resolve, reject){

    try {

      console.log(chalkInfo("GIS | MESSAGE | " + message.type + " | " + message.text));

      if (message.type !== "message") {
        console.log(chalkAlert("Unhandled MESSAGE TYPE: " + message.type));
        return resolve();
      }

      const text = message.text.trim();
      const textArray = text.split("|");

      // console.log(chalkAlert("textArray: " + textArray));

      const sourceMessage = (textArray[2]) ? textArray[2].trim() : "NONE";

      switch (sourceMessage) {
        case "END FETCH ALL":
        case "ERROR":
        case "FETCH FRIENDS":
        case "FSM INIT":
        case "FSM FETCH_ALL":
        case "GEN AUTO CAT":
        case "INIT CHILD":
        case "INIT LANG ANALYZER":
        case "INIT MAX INPUT HASHMAP":
        case "INIT NNs":
        case "INIT RAN NNs":
        case "INIT RNT CHILD":
        case "INIT TWITTER USERS":
        case "INIT TWITTER":
        case "INIT UNFOLLOWABLE USER SET":
        case "INIT UNFOLLOWABLE":
        case "INIT":
        case "LOAD BEST NN":
        case "LOAD NN":
        case "MONGO DB CONNECTED":
        case "PONG":
        case "QUIT":
        case "QUITTING":
        case "READY":
        case "RESET":
        case "SAV NN HASHMAP":
        case "SLACK QUIT":
        case "SLACK READY":
        case "SLACK RTM READY":
        case "START":
        case "STATS":
        case "TEXT":
        case "UPDATE HISTOGRAMS":
        case "UPDATE NN STATS":
        case "WAIT UPDATE STATS":
        case "END UPDATE STATS":
        case "UPDATE USER CAT STATS":
          resolve();
        break;
        case "STATSUS":
          console.log(chalkInfo(message.text));
          resolve();
        break;
        case "PING":
          await slackSendWebMessage(hostname + " | GIS | PONG");
          resolve();
        break;
        case "NONE":
          resolve();
        break;
        default:
          console.log(chalkAlert("GIS | *** UNDEFINED SLACK MESSAGE: " + message.text));
          // reject(new Error("UNDEFINED SLACK MESSAGE TYPE: " + message.text));
          resolve({text: "UNDEFINED SLACK MESSAGE", message: message});
      }
    }
    catch(err){
      reject(err);
    }

  });
}

function initSlackWebClient(){

  return new Promise(async function(resolve, reject){

    try {

      // const { WebClient } = require("@slack/client");
      slackWebClient = new WebClient(slackRtmToken);

      const testResponse = await slackWebClient.api.test();
      if (configuration.verbose) {
        console.log("GIS | SLACK WEB TEST RESPONSE\n" + jsonPrint(testResponse));
      }

      const botsInfoResponse = await slackWebClient.bots.info();
      console.log("GIS | SLACK WEB BOTS INFO RESPONSE\n" + jsonPrint(botsInfoResponse));

      const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

      conversationsListResponse.channels.forEach(async function(channel){
  
        console.log(chalkLog("GIS | CHANNEL | " + channel.id + " | " + channel.name));

        if (channel.name === slackChannel) {
          configuration.slackChannel = channel;

          const message = {
            token: slackOAuthAccessToken, 
            channel: configuration.slackChannel.id,
            text: "OP"
          };

          message.attachments = [];
          message.attachments.push({
            text: "INIT", 
            fields: [ 
              { title: "SRC", value: hostname + "_" + process.pid }, 
              { title: "MOD", value: MODULE_NAME }, 
              { title: "DST", value: "ALL" } 
            ]
          });

          const chatPostMessageResponse = await slackWebClient.chat.postMessage(message);
          if (configuration.verbose) {
            console.log("GIS | SLACK WEB CHAT POST MESSAGE RESPONSE\n" + jsonPrint(chatPostMessageResponse));
          }

        }

        channelsHashMap.set(channel.id, channel);

      });

      resolve();

    }
    catch(err){
      console.log(chalkError("GIS | *** INIT SLACK WEB CLIENT ERROR: " + err));
      reject(err);
    }

  });
}

function initSlackRtmClient(){

  return new Promise(async function(resolve, reject){

    try {

      slackRtmClient = new RTMClient(slackRtmToken);

      const slackInfo = await slackRtmClient.start();

      if (configuration.verbose) {
        console.log(chalkInfo("GIS | SLACK RTM | INFO\n" + jsonPrint(slackInfo)));
      }

      slackRtmClient.on("slack_event", async function(eventType, event){
        switch (eventType) {
          case "pong":
            debug(chalkLog("GIS | SLACK RTM PONG | " + getTimeStamp() + " | " + event.reply_to));
          break;
          default: debug(chalkInfo("GIS | SLACK RTM EVENT | " + getTimeStamp() + " | " + eventType + "\n" + jsonPrint(event)));
        }
      });


      slackRtmClient.on("message", async function(message){
        if (configuration.verbose) { console.log(chalkLog("GIS | RTM R<\n" + jsonPrint(message))); }
        debug(`GIS | SLACK RTM MESSAGE | R< | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

        try {
          await slackMessageHandler(message);
        }
        catch(err){
          console.log(chalkError("GIS | *** SLACK RTM MESSAGE ERROR: " + err));
        }

      });

      slackRtmClient.on("ready", async function(){
        try {
          if (configuration.verbose) { slackSendRtmMessage(hostname + " | GIS | SLACK RTM READY"); }
          resolve();
        }
        catch(err){
          reject(err);
        }
      });


    }
    catch(err){
      console.log(chalkError("GIS | *** INIT SLACK RTM CLIENT | " + err));
      reject(err);
    }

  });
}


const saveFileQueue = [];
let saveFileQueueInterval;
let saveFileBusy = false;

const globalInputsObj = {};
globalInputsObj.inputsId = ""; // will be generated after number of inputs determined
globalInputsObj.meta = {};
globalInputsObj.meta.type = {};
globalInputsObj.meta.numInputs = 0;
globalInputsObj.meta.histogramParseTotalMin = INIT_TOT_MIN;
globalInputsObj.meta.histogramParseDominantMin = INIT_DOM_MIN;
globalInputsObj.inputs = {};


let stdin;

const fetch = require("isomorphic-fetch");

function msToTime(d) {

  let duration = d;

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

// ==================================================================
// DROPBOX
// ==================================================================
const Dropbox = require("dropbox").Dropbox;

const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";
const localInputsFolder = dropboxConfigHostFolder + "/inputs";

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

let defaultHistogramsFolder;

if (hostname === PRIMARY_HOST && hostname === "google"){ 
 defaultHistogramsFolder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms";
}
else if (hostname !== PRIMARY_HOST && hostname === "google"){ 
 defaultHistogramsFolder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/google/histograms";
}
else if (hostname === PRIMARY_HOST && hostname !== "google"){ 
 defaultHistogramsFolder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms";
}
else {
 defaultHistogramsFolder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/histograms";
}

const statsFolder = "/stats/" + hostname;
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;


const dropboxRemoteClient = new Dropbox({ 
  accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    const fullPath = DROPBOX_ROOT_FOLDER + options.path;

    fs.readdir(fullPath, function(err, items){
      if (err) {
        reject(err);
      }
      else {

        const itemArray = [];

        async.each(items, function(item, cb){

          itemArray.push(
            {
              name: item, 
              client_modified: false,
              content_hash: false,
              path_display: fullPath + "/" + item
            }
          );
          cb();

        }, function(err){

          if (err) {
            return reject(err);
          }
          const response = {
            cursor: false,
            has_more: false,
            entries: itemArray
          };

          resolve(response);
        });
        }
    });
  });
}

function filesGetMetadataLocal(options){

  return new Promise(function(resolve, reject) {

    const fullPath = DROPBOX_ROOT_FOLDER + options.path;

    fs.stat(fullPath, function(err, stats){
      if (err) {
        reject(err);
      }
      else {
        const response = {
          client_modified: stats.mtimeMs
        };
        
        resolve(response);
      }
    });
  });
}

const dropboxLocalClient = { // offline mode
  filesListFolder: filesListFolderLocal,
  filesUpload: function(){},
  filesDownload: function(){},
  filesGetMetadata: filesGetMetadataLocal,
  filesDelete: function(){}
};

let dropboxClient;

if (configuration.offlineMode) {
  dropboxClient = dropboxLocalClient;
}
else {
  dropboxClient = dropboxRemoteClient;
}


const statsObj = {};
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
statsObj.queues = {};
statsObj.queues.saveFileQueue = 0;

const histograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  statsObj.histograms[type] = {};
  histograms[type] = {};
});

let statsUpdateInterval;

const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

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

console.log(chalkInfo("GIS | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("GIS | COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));


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

function showStats(){

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  console.log(chalkLog("\nGIS | STATS"
    + " | E: " + msToTime(statsObj.elapsed)
    + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
  ));
}

const inputsDefault = function (inputsObj){
  return inputsObj;
};

function printInputsObj(title, iObj) {

  const inputsObj = inputsDefault(iObj);

  console.log(chalkBlue(title
    + " | " + inputsObj.inputsId
    + "\n" + jsonPrint(inputsObj.meta)
  ));
}

function sortedHashmap(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.hashmap);

    const sortedKeys = keys.sort(function(a,b){
      // const objA = params.hashmap.get(a);
      // const objB = params.hashmap.get(b);
      const objAvalue = dot.pick(params.sortKey, params.hashmap[a]);
      const objBvalue = dot.pick(params.sortKey, params.hashmap[b]);
      return objBvalue - objAvalue;
    });

    if (keys !== undefined) {
      if (sortedKeys !== undefined) { 
        resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
      }
      else {
        console.log(chalkAlert("sortedHashmap NO SORTED KEYS? | SORT KEY: " + params.sortKey 
          + " | KEYS: " + keys.length 
          + " | SORTED KEYS: " + sortedKeys.length
        ));
        resolve({sortKey: params.sortKey, sortedKeys: []});
      }

    }
    else {
      console.error("sortedHashmap ERROR | params\n" + jsonPrint(params));
      reject(new Error("sortedHashmap ERROR | keys UNDEFINED"));
    }

  });
}

function generateInputSets(params) {

  return new Promise(function(resolve, reject){

    const newInputsObj = {};
    newInputsObj.inputsId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
    newInputsObj.meta = {};
    newInputsObj.meta.type = {};
    newInputsObj.meta.numInputs = 0;
    newInputsObj.inputs = {};
    newInputsObj.inputsMinimum = {};

    const inTypes = Object.keys(params.histogramsObj.histograms);
    inTypes.sort();

    async.eachSeries(inTypes, async function(type){

      const typeInputs = Object.keys(params.histogramsObj.histograms[type]);
      const totalTypeInputs = Object.keys(params.histogramsObj.histograms[type]).length;

      console.log("TYPE | " + type.toUpperCase() + " | " + totalTypeInputs);

      newInputsObj.meta.type[type] = {};

      // start with zero inputs of type if more than configuration.minNumInputsPerType
      newInputsObj.meta.type[type].numInputs = (totalTypeInputs > configuration.minNumInputsPerType) ? 0 : totalTypeInputs;
      newInputsObj.meta.type[type].underMinNumInputs = null;
      newInputsObj.meta.type[type].overMaxNumInputs = null;
      newInputsObj.meta.type[type].currentMaxNumInputs = 0;

      newInputsObj.inputs[type] = [];
      newInputsObj.inputsMinimum[type] = [];

      if (totalTypeInputs === 0) {
        return;
      }

      let results = {};

      try {
        results = await sortedHashmap({ sortKey: "total", hashmap: params.histogramsObj.histograms[type], max: configuration.minNumInputsPerType});
        newInputsObj.inputs[type] = results.sortedKeys.sort();
        newInputsObj.meta.type[type].numInputs = newInputsObj.inputs[type].length;
        console.log(chalkBlue("GIS | " + type.toUpperCase() + " | " + newInputsObj.meta.type[type].numInputs + " INPUTS"));
        return;
      }
      catch(err){
        console.log(chalkError("GIS | *** SORTED HASHMAP ERROR:", err));
        return err;
      }


    }, function(err){
      if (err) { 
        console.log("GIS | ERROR:", err);
        return reject(err); 
      }
      resolve(newInputsObj);
    });

  });
}

let quitWaitInterval;

function quit(cause){

  console.log( "\nGIS | ... QUITTING ..." );

  if (cause) {
    console.log( "GIS | CAUSE: " + cause );
  }

  quitWaitInterval = setInterval(function () {

    if (cause === "Q"){
      statsObj.elapsed = moment().diff(statsObj.startTimeMoment);

      clearInterval(statsUpdateInterval);
      clearInterval(quitWaitInterval);

      console.log(chalkAlert("\nGIS | FORCE QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));

      setTimeout(function(){
        process.exit();      
      }, 1000);
    }
    else if (!saveFileBusy 
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
  let currentTimeStamp;

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

  const options = {};

  options.contents = JSON.stringify(params.obj, null, 2);
  options.path = fullPath;
  options.mode = params.mode || "overwrite";
  options.autorename = params.autorename || false;


  const dbFileUpload = function () {
    dropboxClient.filesUpload(options).
    then(function(){
      debug(chalkLog("GIS | SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    }).
    catch(function(error){
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

    dropboxClient.filesListFolder({path: params.folder}).
    then(function(response){

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
    }).
    catch(function(err){
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
            const fileObj = JSON.parse(data);
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

      const fileObj = {};

      let totalInputs = 0;
      let lessThanMin = 0;
      let moreThanMin = 0;

      let totalCategorized = 0;
      let maxTotalCategorized = 0;

      const pipeline = fs.createReadStream(fullPath).pipe(JSONStream.parse("$*.$*.$*"));

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

        if (configuration.verbose && totalInputs % 50000 === 0) {
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
        if (configuration.verbose) { console.log(chalkInfo("GIS | STREAM CLOSED | INPUTS: " + totalInputs + " | " + fullPath)); }
        return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
      });

      pipeline.on("end", function(){
        if (configuration.verbose) { console.log(chalkInfo("GIS | STREAM END | INPUTS: " + totalInputs + " | " + fullPath)); }
        return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
      });

      pipeline.on("finish", function(){
        if (configuration.verbose) { console.log(chalkInfo("GIS | STREAM FINISH | INPUTS: " + totalInputs + " | " + fullPath)); }
        return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
      });

      pipeline.on("error", function(err){
        console.log(chalkError("GIS | STREAM ERROR | INPUTS: " + totalInputs + " | " + fullPath));
        console.log(chalkError("GIS | *** LOAD FILE ERROR: " + err));
        return reject(err);
      });
    }
    else {
      dropboxClient.filesDownload({path: fullPath}).
      then(function(data) {
        console.log("GIS | " + chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (file.match(/\.json$/gi)) {
          const payload = data.fileBinary;
          debug(payload);

          try {
            const fileObj = JSON.parse(payload);
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
      }).
      catch(function(error) {

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

    wordAssoDb.connect("GIS_" + process.pid, function(err, db){
      if (err) {
        console.log(chalkError("*** GIS | MONGO DB CONNECTION ERROR: " + err));
        return reject(err);
      }

      db.on("error", function(){
        console.error.bind(console, "*** GIS | MONGO DB CONNECTION ERROR ***\n");
        console.log(chalkError("*** GIS | MONGO DB CONNECTION ERROR ***\n"));
        db.close();
      });

      db.on("disconnected", function(){
        console.error.bind(console, "*** GIS | MONGO DB DISCONNECTED ***\n");
        console.log(chalkAlert("*** GIS | MONGO DB DISCONNECTED ***\n"));
      });


      console.log(chalkBlue("GIS | MONGOOSE DEFAULT CONNECTION OPEN"));

      NetworkInputs = mongoose.model("NetworkInputs", networkInputsModel.NetworkInputsSchema);

      resolve(db);

    });

  });
}

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function initStatsUpdate() {

  return new Promise(function(resolve){

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT STATS UPDATE INTERVAL | " + msToTime(configuration.statsUpdateIntervalTime)));


    statsObj.elapsed = getElapsedTimeStamp();
    statsObj.timeStamp = getTimeStamp();

    saveFile({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});

    clearInterval(statsUpdateInterval);

    statsUpdateInterval = setInterval(async function () {

      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      saveFileQueue.push({localFlag: false, folder: statsFolder, file: statsFile, obj: statsObj});
      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try{
        await showStats();
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
      }
      
    }, configuration.statsUpdateIntervalTime);

    resolve();

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
      case "q":
      case "Q":
        quit(key);
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

function loadCommandLineArgs(){

  return new Promise(function(resolve){

    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.each(commandLineConfigKeys, function(arg, cb){

      if (arg === "evolveIterations"){
        configuration.evolve.iterations = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }
      else {
        configuration[arg] = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
      }

      cb();

    }, function(){
      statsObj.commandLineArgsLoaded = true;
      resolve();
    });

  });
}

function getFileMetadata(params) {

  return new Promise(function(resolve, reject){

    const fullPath = params.folder + "/" + params.file;
    debug(chalkInfo("FOLDER " + params.folder));
    debug(chalkInfo("FILE " + params.file));
    debug(chalkInfo("getFileMetadata FULL PATH: " + fullPath));

    if (configuration.offlineMode) {
      dropboxClient = dropboxLocalClient;
    }
    else {
      dropboxClient = dropboxRemoteClient;
    }

    dropboxClient.filesGetMetadata({path: fullPath}).
    then(function(response) {
      // debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      resolve(response);
    }).
    catch(function(err) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata ERROR" 
        + " | " + " ERROR STATUS: " + err.status
        + " | " + fullPath
      ));

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND"));
      }
      if (err.status === 0) {
        console.error(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX NO RESPONSE"));
      }

      reject(err);

    });

  });
}

function loadConfigFile(params) {

  return new Promise(async function(resolve, reject){

    const fullPath = params.folder + "/" + params.file;

    try {

      if (params.file === dropboxConfigDefaultFile) {
        prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
      }
      else {
        prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
      }

      if (configuration.offlineMode) {
        await loadCommandLineArgs();
        return resolve();
      }

      try {

        const response = await getFileMetadata({folder: params.folder, file: params.file});

        const fileModifiedMoment = moment(new Date(response.client_modified));
        
        if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

          console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIG FILE BEFORE OR EQUAL"
            + " | " + fullPath
            + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
            + " | " + fileModifiedMoment.format(compactDateTimeFormat)
          ));
          return resolve();
        }

        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ CONFIG FILE AFTER ... LOADING"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));

        prevConfigFileModifiedMoment = moment(fileModifiedMoment);

        if (params.file === dropboxConfigDefaultFile) {
          prevDefaultConfigFileModifiedMoment = moment(fileModifiedMoment);
        }
        else {
          prevHostConfigFileModifiedMoment = moment(fileModifiedMoment);
        }

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE getFileMetadata ERROR: " + err));
        return reject(err);
      }


      const loadedConfigObj = await loadFile({folder: params.folder, file: params.file, noErrorNotFound: true });

      if (loadedConfigObj === undefined) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("JSON UNDEFINED"));
      }

      if (loadedConfigObj instanceof Error) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR: " + loadedConfigObj));
      }

      console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

      const newConfiguration = {};

      if (loadedConfigObj.GIS_MAX_NUM_INPUTS_PER_TYPE !== undefined){
        console.log("GIS | LOADED GIS_MAX_NUM_INPUTS_PER_TYPE: " + loadedConfigObj.GIS_MAX_NUM_INPUTS_PER_TYPE);
        newConfiguration.maxNumInputsPerType = loadedConfigObj.GIS_MAX_NUM_INPUTS_PER_TYPE;
      }

      if (loadedConfigObj.GIS_MIN_NUM_INPUTS_PER_TYPE !== undefined){
        console.log("GIS | LOADED GIS_MIN_NUM_INPUTS_PER_TYPE: " + loadedConfigObj.GIS_MIN_NUM_INPUTS_PER_TYPE);
        newConfiguration.minNumInputsPerType = loadedConfigObj.GIS_MIN_NUM_INPUTS_PER_TYPE;
      }

      if (loadedConfigObj.GIS_INPUTS_FILE_PREFIX !== undefined){
        console.log("GIS | LOADED GIS_INPUTS_FILE_PREFIX: " + loadedConfigObj.GIS_INPUTS_FILE_PREFIX);
        newConfiguration.inputsFilePrefix = loadedConfigObj.GIS_INPUTS_FILE_PREFIX;
      }

      if (loadedConfigObj.GIS_MAX_ITERATIONS !== undefined){
        console.log("GIS | LOADED GIS_MAX_ITERATIONS: " + loadedConfigObj.GIS_MAX_ITERATIONS);
        newConfiguration.maxIterations = loadedConfigObj.GIS_MAX_ITERATIONS;
      }

      if (loadedConfigObj.GIS_MIN_INPUTS_GENERATED !== undefined){
        console.log("GIS | LOADED GIS_MIN_INPUTS_GENERATED: " + loadedConfigObj.GIS_MIN_INPUTS_GENERATED);
        newConfiguration.minInputsGenerated = loadedConfigObj.GIS_MIN_INPUTS_GENERATED;
      }

      if (loadedConfigObj.GIS_MAX_INPUTS_GENERATED !== undefined){
        console.log("GIS | LOADED GIS_MAX_INPUTS_GENERATED: " + loadedConfigObj.GIS_MAX_INPUTS_GENERATED);
        newConfiguration.maxInputsGenerated = loadedConfigObj.GIS_MAX_INPUTS_GENERATED;
      }

      if (loadedConfigObj.GIS_MIN_TOTAL_MIN !== undefined){
        console.log("GIS | LOADED GIS_MIN_TOTAL_MIN: " + loadedConfigObj.GIS_MIN_TOTAL_MIN);
        newConfiguration.minTotalMin = loadedConfigObj.GIS_MIN_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_MAX_TOTAL_MIN !== undefined){
        console.log("GIS | LOADED GIS_MAX_TOTAL_MIN: " + loadedConfigObj.GIS_MAX_TOTAL_MIN);
        newConfiguration.maxTotalMin = loadedConfigObj.GIS_MAX_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_MIN_DOMINANT_MIN !== undefined){
        console.log("LOADED GIS_MIN_DOMINANT_MIN: " + loadedConfigObj.GIS_MIN_DOMINANT_MIN);
        newConfiguration.minDominantMin = loadedConfigObj.GIS_MIN_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_MAX_DOMINANT_MIN !== undefined){
        console.log("GIS | LOADED GIS_MAX_DOMINANT_MIN: " + loadedConfigObj.GIS_MAX_DOMINANT_MIN);
        newConfiguration.maxDominantMin = loadedConfigObj.GIS_MAX_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_TEST_MODE !== undefined){
        console.log("GIS | LOADED GIS_TEST_MODE: " + loadedConfigObj.GIS_TEST_MODE);
        newConfiguration.testMode = loadedConfigObj.GIS_TEST_MODE;
      }

      if (loadedConfigObj.GIS_QUIT_ON_COMPLETE !== undefined){
        console.log("GIS | LOADED GIS_QUIT_ON_COMPLETE: " + loadedConfigObj.GIS_QUIT_ON_COMPLETE);
        newConfiguration.quitOnComplete = loadedConfigObj.GIS_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined){
        console.log("GIS | LOADED GIS_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN);
        newConfiguration.histogramParseDominantMin = loadedConfigObj.GIS_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
        console.log("GIS | LOADED GIS_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN);
        newConfiguration.histogramParseTotalMin = loadedConfigObj.GIS_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.GIS_ENABLE_STDIN !== undefined){
        console.log("GIS | LOADED GIS_ENABLE_STDIN: " + loadedConfigObj.GIS_ENABLE_STDIN);
        newConfiguration.enableStdin = loadedConfigObj.GIS_ENABLE_STDIN;
      }

      if (loadedConfigObj.GIS_KEEPALIVE_INTERVAL !== undefined) {
        console.log("GIS | LOADED GIS_KEEPALIVE_INTERVAL: " + loadedConfigObj.GIS_KEEPALIVE_INTERVAL);
        newConfiguration.keepaliveInterval = loadedConfigObj.GIS_KEEPALIVE_INTERVAL;
      }

      resolve(newConfiguration);
    }
    catch(err){
      console.error(chalkError(MODULE_ID_PREFIX + " | ERROR LOAD DROPBOX CONFIG: " + fullPath
        + "\n" + jsonPrint(err)
      ));
      reject(err);
    }

  });
}

function loadAllConfigFiles(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "LOAD CONFIG";

      const defaultConfig = await loadConfigFile({folder: dropboxConfigDefaultFolder, file: dropboxConfigDefaultFile});

      if (defaultConfig) {
        defaultConfiguration = defaultConfig;
        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
      }
      
      const hostConfig = await loadConfigFile({folder: dropboxConfigHostFolder, file: dropboxConfigHostFile});

      if (hostConfig) {
        hostConfiguration = hostConfig;
        console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
      }
      
      const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
      const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

      configuration = deepcopy(tempConfig);

      resolve();

    }
    catch(err){
      reject(err);
    }
  });
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

    if (debug.enabled) {
      console.log("\nGIS | %%%%%%%%%%%%%%\nGIS |  DEBUG ENABLED \nGIS | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.fOnError = process.env.QUIT_ON_ERROR || false;
    cnf.enableStdin = process.env.ENABLE_STDIN || true;

    if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    try {

      await loadAllConfigFiles();
      await loadCommandLineArgs();

      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      statsObj.commandLineArgsLoaded = true;

      if (configuration.enableStdin) { initStdIn(); }

      await initStatsUpdate();

      resolve(configuration);

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

function runMain(){
  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "RUN MAIN";

      async.eachSeries(DEFAULT_INPUT_TYPES, async function(type){

        const genInParams = {};

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
          inFolder += "_test";
        }

        const tableArray = [];

        tableArray.push([
          "GIS |",
          "TYPE",
          "TYPE TOT IN",
          "TYPE IN",
          "TOT IN"
        ]);

        globalInputsObj.meta.numInputs = 0;

        async.eachSeries(DEFAULT_INPUT_TYPES, function(type, cb){

          if (globalInputsObj.meta.type[type] === undefined) { return cb(); }

          globalInputsObj.meta.numInputs += globalInputsObj.meta.type[type].numInputs;

          tableArray.push([
            "GIS |",
            type.toUpperCase(),
            globalInputsObj.meta.type[type].totalInputs,
            globalInputsObj.meta.type[type].numInputs,
            globalInputsObj.meta.numInputs
          ]);

          cb();

        }, function(err){

          if (err) {
            return quit(err);
          }


          globalInputsObj.inputsId = configuration.inputsFilePrefix 
            + "_" + moment().format(compactDateTimeFormat) 
            + "_" + globalInputsObj.meta.numInputs 
            + "_" + hostname 
            + "_" + process.pid;


          const networkInputsDoc = new NetworkInputs(globalInputsObj);

          networkInputsDoc.save(async function(err, savedNetworkInputsDoc){

            if (err) {
              console.log(chalkError("GIS | *** CREATE NETWORK INPUTS DB DOCUMENT: " + err));
            }
            else {
              printInputsObj("GIS | +++ SAVED NETWORK INPUTS DB DOCUMENT", savedNetworkInputsDoc);
              console.log(chalk.blue(
                  "\nGIS | ========================================================================================="
                + "\nGIS | INPUTS" 
                + "\nGIS | -----------------------------------------------------------------------------------------\n"
                + table(tableArray, { align: ["l", "l", "r", "r", "r"] })
                + "\nGIS | =========================================================================================\n"
              ));
            }

            // const slackText = table(tableArray, { align: ["l", "l", "r", "r", "r", "r", "r", "r", "r"] });

            // console.log("GIS | SLACK MESSAGE SENT");

            const inFile = globalInputsObj.inputsId + ".json";

            console.log(chalkInfo("GIS | ... SAVING INPUTS FILE: " + inFolder + "/" + inFile));

            saveFileQueue.push({folder: inFolder, file: inFile, obj: globalInputsObj});

            console.log(chalkInfo("GIS | ... UPDATING INPUTS CONFIG FILE: " + dropboxConfigDefaultFolder + "/" + defaultNetworkInputsConfigFile));

            const networkInputsConfigObj = await loadFile({folder: dropboxConfigDefaultFolder, file: defaultNetworkInputsConfigFile, noErrorNotFound: true });

            networkInputsConfigObj.INPUTS_IDS.push(globalInputsObj.inputsId);
            networkInputsConfigObj.INPUTS_IDS = _.uniq(networkInputsConfigObj.INPUTS_IDS);

            saveFileQueue.push({folder: dropboxConfigDefaultFolder, file: defaultNetworkInputsConfigFile, obj: networkInputsConfigObj});

            quit();

          });

        });  

      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** RUN MAIN ERROR: " + err ));
      reject(err);
    }
  });
}

setTimeout(async function(){

  try {

    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    initSlackRtmClient();
    initSlackWebClient();

    initSaveFileQueue(configuration);

    if (configuration.testMode) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
    }

    console.log(chalkBlue(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\nCONFIGURATION\n" + jsonPrint(configuration)
      + "--------------------------------------------------------"
    ));

    try {

      await connectDb();
      await runMain();

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MAIN ERROR ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MAIN ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n", err));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
