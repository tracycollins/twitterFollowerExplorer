 /*jslint node: true */

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const GLOBAL_TEST_MODE = false; // applies to parent and all children
const STATS_UPDATE_INTERVAL = ONE_MINUTE;

const DEFAULT_INPUTS_FILE_PREFIX = "inputs";
const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;

let configuration = {};

configuration.inputsFilePrefix = DEFAULT_INPUTS_FILE_PREFIX;

configuration.testMode = GLOBAL_TEST_MODE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

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

const defaultUnionInputsConfigFile = "default_unionInputsConfig.json";
const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";
const defaultBestInputsConfigFile = "default_bestInputsConfig.json";
const hostBestInputsConfigFile = hostname + "_bestInputsConfig.json";

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

let defaultConfiguration = {}; // general configuration for UBI
let hostConfiguration = {}; // host-specific configuration for UBI

const MODULE_NAME = "unionBestInputSets";
const MODULE_ID_PREFIX = "UBI";
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

const OFFLINE_MODE = false;

const merge = require("deepmerge");
const util = require("util");
const _ = require("lodash");
const treeify = require("treeify");

const JSONStream = require("JSONStream");
const jsonParse = require("safe-json-parse");
const async = require("async");
const debug = require("debug")("ubi");

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

const slackChannel = "ubi";
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
      console.log(chalkBlue("UBI | SLACK RTM | SEND: " + msg));
      const sendResponse = await slackRtmClient.sendMessage(msg, slackConversationId);

      console.log(chalkLog("UBI | SLACK RTM | >T\n" + jsonPrint(sendResponse)));
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

      console.log(chalkBlue("UBI | SLACK WEB | SEND\n" + jsonPrint(message)));
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

      console.log(chalkInfo("UBI | MESSAGE | " + message.type + " | " + message.text));

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
          await slackSendWebMessage(hostname + " | UBI | PONG");
          resolve();
        break;
        case "NONE":
          resolve();
        break;
        default:
          console.log(chalkAlert("UBI | *** UNDEFINED SLACK MESSAGE: " + message.text));
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
        console.log("UBI | SLACK WEB TEST RESPONSE\n" + jsonPrint(testResponse));
      }

      const botsInfoResponse = await slackWebClient.bots.info();
      debug("UBI | SLACK WEB BOTS INFO RESPONSE\n" + jsonPrint(botsInfoResponse));

      const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

      conversationsListResponse.channels.forEach(async function(channel){
  
        debug(chalkLog("UBI | CHANNEL | " + channel.id + " | " + channel.name));

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
            console.log("UBI | SLACK WEB CHAT POST MESSAGE RESPONSE\n" + jsonPrint(chatPostMessageResponse));
          }

        }

        channelsHashMap.set(channel.id, channel);

      });

      resolve();

    }
    catch(err){
      console.log(chalkError("UBI | *** INIT SLACK WEB CLIENT ERROR: " + err));
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
        console.log(chalkInfo("UBI | SLACK RTM | INFO\n" + jsonPrint(slackInfo)));
      }

      slackRtmClient.on("slack_event", async function(eventType, event){
        switch (eventType) {
          case "pong":
            debug(chalkLog("UBI | SLACK RTM PONG | " + getTimeStamp() + " | " + event.reply_to));
          break;
          default: debug(chalkInfo("UBI | SLACK RTM EVENT | " + getTimeStamp() + " | " + eventType + "\n" + jsonPrint(event)));
        }
      });


      slackRtmClient.on("message", async function(message){
        if (configuration.verbose) { console.log(chalkLog("UBI | RTM R<\n" + jsonPrint(message))); }
        debug(`UBI | SLACK RTM MESSAGE | R< | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

        try {
          await slackMessageHandler(message);
        }
        catch(err){
          console.log(chalkError("UBI | *** SLACK RTM MESSAGE ERROR: " + err));
        }

      });

      slackRtmClient.on("ready", async function(){
        try {
          if (configuration.verbose) { slackSendRtmMessage(hostname + " | UBI | SLACK RTM READY"); }
          resolve();
        }
        catch(err){
          reject(err);
        }
      });


    }
    catch(err){
      console.log(chalkError("UBI | *** INIT SLACK RTM CLIENT | " + err));
      reject(err);
    }

  });
}

const saveFileQueue = [];
let saveFileQueueInterval;
let saveFileBusy = false;

const newInputsObj = {};
newInputsObj.inputsId = ""; // will be generated after number of inputs determined
newInputsObj.meta = {};
newInputsObj.meta.type = {};
newInputsObj.meta.parents = [];
newInputsObj.meta.numInputs = 0;
newInputsObj.inputs = {};

let stdin;

const inputsIdSet = new Set();

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
statsObj.queues = {};
statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.size = 0;

const UBI_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.runId = UBI_RUN_ID;

statsObj.elapsed = 0;

const histograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
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

const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};

const optionDefinitions = [
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  testMode
];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("UBI | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("UBI | COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));


process.title = "node_generateInputSets";
console.log("\n\nUBI | =================================");
console.log("UBI | HOST:          " + hostname);
console.log("UBI | PROCESS TITLE: " + process.title);
console.log("UBI | PROCESS ID:    " + process.pid);
console.log("UBI | RUN ID:        " + statsObj.runId);
console.log("UBI | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("UBI | =================================");

process.on("exit", function() {
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(statsUpdateInterval);

    setTimeout(function() {
      showStats();
      console.log("UBI | QUITTING generateInputSets");
      process.exit(0);
    }, 300);

  }
});

function showStats(){

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  console.log(chalkLog("\nUBI | STATS"
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


function unionInputSets(params) {

  return new Promise(function(resolve, reject){

    console.log(chalkLog("UBI | UNION INPUT SETS\n" + jsonPrint(params)));

    const newInputsObj = {};

    newInputsObj.meta = {};
    newInputsObj.meta.parents = [];
    newInputsObj.meta.type = {};
    newInputsObj.meta.numInputs = 0;
    newInputsObj.inputs = {};
    newInputsObj.inputsMinimum = {};

    async.eachSeries(params.parents, async function(inputsId){

      console.log(chalkLog("UBI | UNION INPUT SET PARENT: " + inputsId));

      let inputsObj = {};

      try{

        inputsObj = await NetworkInputs.findOne({inputsId: inputsId}).lean(true).exec();
        
        if (inputsObj) {
          console.log(chalkLog("UBI | UNION INPUT SET FOUND\n" + jsonPrint(inputsObj.meta)));
        }
        else{
          console.log(chalkAlert("UBI | UNION INPUT SET NOT FOUND: " + inputsId));
          return(new Error("INPUT NOT FOUND: " + inputsId));
        }
      }
      catch(err){
        console.log(chalkError("UBI | UNION INPUT SETS ERROR: " + err));
        return err;
      }

      newInputsObj.meta.parents.push(inputsObj.inputsId);

      async.each(Object.keys(inputsObj.inputs), async function(type){

        newInputsObj.inputs[type] = _.union(newInputsObj.inputs[type], inputsObj.inputs[type]).sort();

        if (newInputsObj.meta.type[type] === undefined) { newInputsObj.meta.type[type] = {}; }
        newInputsObj.meta.type[type].numInputs = newInputsObj.inputs[type].length;

        console.log(chalkLog("UBI | UNION INPUT SETS"
          + " | TYPE: " + type
          + " | PARENT " + inputsObj.inputs[type].length
          + " | CHILD " + newInputsObj.inputs[type].length
        ));

        if (newInputsObj.inputsMinimum[type] === undefined) { newInputsObj.inputsMinimum[type] = []; }
        newInputsObj.inputsMinimum[type] = [];

        return;

      }, function(err1){

        if (err1) { return err1; }

        return;

      });

    }, function(err0){

      if (err0) { return reject(err0); }

      Object.keys(newInputsObj.meta.type).forEach(function(type){
        newInputsObj.meta.numInputs += newInputsObj.meta.type[type].numInputs;
      });

      newInputsObj.inputsId = configuration.inputsFilePrefix 
        + "_" + moment().format(compactDateTimeFormat) 
        + "_" + newInputsObj.meta.numInputs 
        + "_" + hostname 
        + "_" + process.pid
        + "_" + "union";

      console.log(chalkBlue("UBI | NEW INPUT SETS"
        + " | " + newInputsObj.inputsId
        + " | " + newInputsObj.meta.numInputs + " INPUTS"
        + "\n" + jsonPrint(newInputsObj.meta)
      ));


      const networkInputsDoc = new NetworkInputs(newInputsObj);

      networkInputsDoc.save(async function(err, savedNetworkInputsDoc){

        if (err) {
          console.log(chalkError("UBI | *** CREATE NETWORK INPUTS DB DOCUMENT: " + err));
        }
        else {
          printInputsObj("UBI | +++ SAVED NETWORK INPUTS DB DOCUMENT", savedNetworkInputsDoc);
        }

        const inFile = newInputsObj.inputsId + ".json";
        // let inFolder = (hostname === PRIMARY_HOST) ? defaultInputsFolder : localInputsFolder;
        let inFolder = defaultInputsFolder;

        console.log(chalkInfo("UBI | ... SAVING INPUTS FILE: " + inFolder + "/" + inFile));

        saveFileQueue.push({folder: inFolder, file: inFile, obj: newInputsObj});

        // console.log(chalkInfo("UBI | ... UPDATING INPUTS CONFIG FILE: " + dropboxConfigDefaultFolder + "/" + defaultNetworkInputsConfigFile));


        // networkInputsConfigObj.INPUTS_IDS.push(newInputsObj.inputsId);
        // networkInputsConfigObj.INPUTS_IDS = _.uniq(networkInputsConfigObj.INPUTS_IDS);

        // saveFileQueue.push({folder: dropboxConfigDefaultFolder, file: defaultNetworkInputsConfigFile, obj: networkInputsConfigObj});

        resolve(newInputsObj);

      });


    });

  });
}

let quitWaitInterval;

function quit(cause){

  console.log( "\nUBI | ... QUITTING ..." );

  if (cause) {
    console.log( "UBI | CAUSE: " + cause );
  }

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy 
      && (saveFileQueue.length === 0)
      ){

      statsObj.elapsed = moment().diff(statsObj.startTimeMoment);

      clearInterval(statsUpdateInterval);
      clearInterval(quitWaitInterval);

      console.log(chalkAlert("\nUBI | ALL PROCESSES COMPLETE ... QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));

      // showStats();

      setTimeout(function(){
        process.exit();      
      }, 1000);

    }
    else {
      console.log(chalkInfo("UBI | ... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));
    }

  }, 5000);
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
    console.log("UBI | OFFLINE_MODE: " + OFFLINE_MODE);
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
      debug(chalkLog("UBI | SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    }).
    catch(function(error){
      if (error.status === 413){
        console.error(chalkError("UBI | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError("UBI | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError("UBI | " + moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        console.error(chalkError("UBI | " + moment().format(compactDateTimeFormat) 
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

      debug(chalkLog("UBI | DROPBOX LIST FOLDER"
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
          console.log(chalkError("UBI | *** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("UBI | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("UBI | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    }).
    catch(function(err){
      console.log(chalkError("UBI | saveFile *** DROPBOX FILES LIST FOLDER ERROR ", err));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function initSaveFileQueue(cnf){

  console.log(chalkBlue("UBI | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
        if (err) {
          console.log(chalkError("UBI | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("UBI | SAVED FILE | " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });
    }

  }, cnf.saveFileQueueInterval);
}

// function loadFile(params) {

//   return new Promise(async function(resolve, reject){

//     const folder = params.folder;
//     const file = params.file;
//     const streamMode = params.streamMode || false;

//     debug(chalkInfo("LOAD FOLDER " + folder));
//     debug(chalkInfo("LOAD FILE " + file));
//     debug(chalkInfo("FULL folder " + folder + "/" + file));

//     let fullPath = folder + "/" + file;

//     if (OFFLINE_MODE) {

//       if (hostname !== PRIMARY_HOST) {

//         fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + folder + "/" + file;
//         debug(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));

//         const pathExists = fs.existsSync(fullPath);

//         if (!pathExists) {
//           console.log(chalkAlert("UBI | !!! PATH DOES NOT EXIST ... SKIPPING LOAD: " + fullPath));
//           return reject(new Error("PATH DOES NOT EXIST: " + fullPath));
//         }

//       }
//       fs.readFile(fullPath, "utf8", function(err, data) {
//         if (err) {
//           console.log(chalkError("UBI | LOAD FILE ERROR: " + err));
//           return reject(err);
//         }
//         debug(chalkLog(getTimeStamp()
//           + " | LOADING FILE FROM DROPBOX FILE"
//           + " | " + fullPath
//         ));

//         if (file.match(/\.json$/gi)) {
//           try {
//             const fileObj = JSON.parse(data);
//             resolve(fileObj);
//           }
//           catch(e){
//             console.trace(chalkError("UBI | JSON PARSE ERROR: " + e));
//             return reject(e);
//           }
//         }
//         else {
//           resolve();
//         }
//       });
//      }
//     else if (streamMode) {

//       console.log(chalkInfo("UBI | STREAM MODE: FULL PATH " + fullPath));

//       const pathExists = fs.existsSync(fullPath);

//       if (!pathExists) {
//         console.log(chalkAlert("UBI | !!! PATH DOES NOT EXIST ... SKIPPING LOAD: " + fullPath));
//         return reject(new Error("PATH DOES NOT EXIST: " + fullPath));
//       }

//       const fileObj = {};

//       let totalInputs = 0;
//       let lessThanMin = 0;
//       let moreThanMin = 0;

//       let totalCategorized = 0;
//       let maxTotalCategorized = 0;

//       const pipeline = fs.createReadStream(fullPath).pipe(JSONStream.parse("$*.$*.$*"));

//       pipeline.on("data", function(obj){

//         totalInputs += 1;

//         totalCategorized = obj.value.total - obj.value.uncategorized;
//         maxTotalCategorized = Math.max(maxTotalCategorized, totalCategorized);

//         if (totalCategorized >= configuration.minTotalMin) {

//           moreThanMin += 1;

//           debug(chalkLog("UBI | +++ INPUT"
//             + " [" + moreThanMin + "]"
//             + " | " + params.type
//             + " | " + obj.key
//             + " | TOT CAT: " + totalCategorized 
//             + " | MAX TOT CAT: " + maxTotalCategorized 
//             // + "\nVALUE\n" + jsonPrint(obj.value)
//           ));

//           fileObj[obj.key] = obj.value;
//         }
//         else {
//           lessThanMin += 1;
//         }

//         debug("data: " + jsonPrint(obj));

//         if (configuration.verbose && totalInputs % 10000 === 0) {
//           console.log(chalkLog("UBI | STREAM BEST INPUTS | " + fullPath + " | BEST INPUTS: " + totalInputs));
//         }

//       });

//       pipeline.on("header", function(header){
//         console.log("UBI | HEADER: " + jsonPrint(header));
//       });

//       pipeline.on("footer", function(footer){
//         console.log("UBI | FOOTER: " + jsonPrint(footer));
//       });

//       pipeline.on("close", function(){
//         if (configuration.verbose) { console.log(chalkInfo("UBI | STREAM CLOSED | BEST INPUTS: " + totalInputs + " | " + fullPath)); }
//         return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
//       });

//       pipeline.on("end", function(){
//         if (configuration.verbose) { console.log(chalkInfo("UBI | STREAM END | BEST INPUTS: " + totalInputs + " | " + fullPath)); }
//         return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
//       });

//       pipeline.on("finish", function(){
//         if (configuration.verbose) { console.log(chalkInfo("UBI | STREAM FINISH | BEST INPUTS: " + totalInputs + " | " + fullPath)); }
//         return resolve({ obj: fileObj, maxTotalCategorized: maxTotalCategorized, totalInputs: totalInputs, lessThanMin: lessThanMin, moreThanMin: moreThanMin });
//       });

//       pipeline.on("error", function(err){
//         console.log(chalkError("UBI | STREAM ERROR | BEST INPUTS: " + totalInputs + " | " + fullPath));
//         console.log(chalkError("UBI | *** LOAD FILE ERROR: " + err));
//         return reject(err);
//       });
//     }
//     else {
//       dropboxClient.filesDownload({path: fullPath}).
//       then(function(data) {
//         console.log("UBI | " + chalkLog(getTimeStamp()
//           + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
//         ));

//         if (file.match(/\.json$/gi)) {
//           const payload = data.fileBinary;
//           debug(payload);

//           try {
//             const fileObj = JSON.parse(payload);
//             return resolve(fileObj);
//           }
//           catch(e){
//             console.trace(chalkError("UBI | JSON PARSE ERROR: " + e));
//             return reject(e);
//           }
//         }
//         else {
//           resolve();
//         }
//       }).
//       catch(function(error) {

//         if (error.response !== undefined) {

//           if (error.response.status === 404) {
//             console.error(chalkError("UBI | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND" + " ... SKIPPING ..."));
//             return reject(error);
//           }
//           if (error.response.status === 409) {
//             console.error(chalkError("UBI | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND" + " ... SKIPPING ..."));
//             return reject(error);
//           }
//           if (error.response.status === 0) {
//             console.error(chalkError("UBI | !!! DROPBOX NO RESPONSE"
//               + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
//             return reject(error);
//           }
//         }

//         console.log(chalkError("UBI | !!! DROPBOX READ " + fullPath + " ERROR"));
//         console.log(chalkError("UBI |\n", error));
//         console.log(chalkError("UBI | " + jsonPrint(error)));

//         return reject(error);

//       });
//     }

//   });
// }
function loadFile(params) {

  return new Promise(async function(resolve, reject){

    const noErrorNotFound = params.noErrorNotFound || false;

    let fullPath = params.path || params.folder + "/" + params.file;

    debug(chalkInfo("LOAD PATH " + params.path));
    debug(chalkInfo("LOAD FOLDER " + params.folder));
    debug(chalkInfo("LOAD FILE " + params.file));
    debug(chalkInfo("FULL PATH " + fullPath));


    if (configuration.offlineMode || params.loadLocalFile) {

      fullPath = DROPBOX_ROOT_FOLDER + fullPath;

      fs.readFile(fullPath, "utf8", function(err, data) {

        if (err) {
          console.log(chalkError("fs readFile ERROR: " + err));
          return reject(err);
        }

        console.log(chalkInfo(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX"
          + " | " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          jsonParse(data, function(err, fileObj){
            if (err) {
              console.log(chalkError(getTimeStamp()
                + " | *** LOAD FILE FROM DROPBOX ERROR"
                + " | " + fullPath
                + " | " + err
              ));

              return reject(err);
            }

            const fileObjSizeMbytes = sizeof(fileObj)/ONE_MEGABYTE;

            console.log(chalkInfo(getTimeStamp()
              + " | LOADED FILE FROM DROPBOX"
              + " | " + fileObjSizeMbytes.toFixed(2) + " MB"
              + " | " + fullPath
            ));

            return resolve(fileObj);

          });
        }

        console.log(chalkError(getTimeStamp()
          + " | SKIP LOAD FILE FROM DROPBOX"
          + " | " + fullPath
        ));
        resolve();

      });

     }
    else {

      dropboxClient.filesDownload({path: fullPath}).
      then(function(data) {

        debug(chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (fullPath.match(/\.json$/gi)) {

          const payload = data.fileBinary;

          if (!payload || (payload === undefined)) {
            return reject(new Error(MODULE_ID_PREFIX + " LOAD FILE PAYLOAD UNDEFINED"));
          }

          jsonParse(payload, function(err, fileObj){
            if (err) {
              console.log(chalkError(getTimeStamp()
                + " | *** LOAD FILE FROM DROPBOX ERROR"
                + " | " + fullPath
                + " | " + err
              ));

              return reject(err);
            }

            return resolve(fileObj);

          });

        }
        else {
          resolve();
        }
      }).
      catch(function(err) {

        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX loadFile ERROR: " + fullPath));
        
        if ((err.status === 409) || (err.status === 404)) {
          if (noErrorNotFound) {
            if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND")); }
            return resolve(new Error("NOT FOUND"));
          }
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND ... SKIPPING ..."));
          return resolve(err);
        }
        
        if (err.status === 0) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX NO RESPONSE"
            + " | NO INTERNET CONNECTION? SKIPPING ..."));
          return resolve(new Error("NO INTERNET"));
        }

        reject(err);

      });
    }
  });
}

function connectDb(){

  return new Promise(function(resolve, reject){

    statsObj.status = "CONNECT DB";

    wordAssoDb.connect("UBI_" + process.pid, function(err, db){
      if (err) {
        console.log(chalkError("*** UBI | MONGO DB CONNECTION ERROR: " + err));
        return reject(err);
      }

      db.on("error", function(){
        console.error.bind(console, "*** UBI | MONGO DB CONNECTION ERROR ***\n");
        console.log(chalkError("*** UBI | MONGO DB CONNECTION ERROR ***\n"));
        db.close();
      });

      db.on("disconnected", function(){
        console.error.bind(console, "*** UBI | MONGO DB DISCONNECTED ***\n");
        console.log(chalkAlert("*** UBI | MONGO DB DISCONNECTED ***\n"));
      });


      console.log(chalkBlue("UBI | MONGOOSE DEFAULT CONNECTION OPEN"));

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
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX getFileMetadata ERROR: " + fullPath));

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

      if (loadedConfigObj.UBI_INPUTS_FILE_PREFIX !== undefined){
        console.log("UBI | LOADED UBI_INPUTS_FILE_PREFIX: " + loadedConfigObj.UBI_INPUTS_FILE_PREFIX);
        newConfiguration.inputsFilePrefix = loadedConfigObj.UBI_INPUTS_FILE_PREFIX;
      }

      if (loadedConfigObj.UBI_TEST_MODE !== undefined){
        console.log("UBI | LOADED UBI_TEST_MODE: " + loadedConfigObj.UBI_TEST_MODE);
        newConfiguration.testMode = loadedConfigObj.UBI_TEST_MODE;
      }

      if (loadedConfigObj.UBI_QUIT_ON_COMPLETE !== undefined){
        console.log("UBI | LOADED UBI_QUIT_ON_COMPLETE: " + loadedConfigObj.UBI_QUIT_ON_COMPLETE);
        newConfiguration.quitOnComplete = loadedConfigObj.UBI_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.UBI_ENABLE_STDIN !== undefined){
        console.log("UBI | LOADED UBI_ENABLE_STDIN: " + loadedConfigObj.UBI_ENABLE_STDIN);
        newConfiguration.enableStdin = loadedConfigObj.UBI_ENABLE_STDIN;
      }

      if (loadedConfigObj.UBI_KEEPALIVE_INTERVAL !== undefined) {
        console.log("UBI | LOADED UBI_KEEPALIVE_INTERVAL: " + loadedConfigObj.UBI_KEEPALIVE_INTERVAL);
        newConfiguration.keepaliveInterval = loadedConfigObj.UBI_KEEPALIVE_INTERVAL;
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

function loadInputsDropbox(params) {

  statsObj.status = "LOAD BEST BEST INPUTS CONFIG";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkLog("UBI | LOADING DROPBOX BEST INPUTS CONFIG | " + folder + "/" + file + " ..."));

    try {

      const inputsConfigObj = await loadFile({folder: folder, file: file});

      if ((inputsConfigObj === undefined) || !inputsConfigObj) {
        console.log(chalkError("UBI | DROPBOX LOAD BEST INPUTS CONFIG FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX LOAD BEST INPUTS CONFIG FILE ERROR | JSON UNDEFINED"));
      }

      const tempInputsIdSet = new Set(inputsConfigObj.INPUTS_IDS);

      for (const inputsId of tempInputsIdSet) {
        inputsIdSet.add(inputsId);
      }

      console.log(chalkBlue("UBI | LOADED DROPBOX BEST INPUTS CONFIG"
        + "\nTFE | CURRENT FILE BEST INPUTS IDS SET: " + tempInputsIdSet.size + " BEST INPUTS IDS"
        + "\n" + jsonPrint([...tempInputsIdSet])
        + "\nTFE | FINAL BEST INPUTS IDS SET: " + inputsIdSet.size + " BEST INPUTS IDS"
        + "\n" + jsonPrint([...inputsIdSet])
      ));

      resolve();
    }
    catch(err){
      if ((err.status === 409) || (err.status === 404)) {
        console.log(chalkError("UBI | DROPBOX LOAD BEST INPUTS CONFIG FILE NOT FOUND"));
        return resolve();
      }
      console.log(chalkError("UBI | DROPBOX LOAD BEST INPUTS CONFIG FILE ERROR: ", err));
      return reject(err);
    }
  });
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

    if (debug.enabled) {
      console.log("\nUBI | %%%%%%%%%%%%%%\nUBI |  DEBUG ENABLED \nUBI | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;
    cnf.enableStdin = process.env.ENABLE_STDIN || true;

    if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    try {

      await loadAllConfigFiles();
      await loadCommandLineArgs();
      await loadInputsDropbox({folder: dropboxConfigDefaultFolder, file: defaultBestInputsConfigFile});

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

function pairwise(list) {
  // return new Promise(async function(resolve, reject){
    if (list.length < 2) { return []; }
    let first = list[0];
    let rest  = list.slice(1);
    let pairs = rest.map(function (x) { return [first, x]; });
    return pairs.concat(pairwise(rest));
  // });
}

function runMain(){
  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "RUN MAIN";

      let networkInputsConfigObj = await loadFile({folder: dropboxConfigDefaultFolder, file: defaultBestInputsConfigFile, noErrorNotFound: true });

      const parentPairs = pairwise([...inputsIdSet]);
      console.log("PARENT PAIRS\n" + jsonPrint(parentPairs));

      async.eachSeries(parentPairs, async function(parentPair){
        const newInputsObj = await unionInputSets({parents: parentPair});
        networkInputsConfigObj.INPUTS_IDS.push(newInputsObj.inputsId);
        networkInputsConfigObj.INPUTS_IDS = _.uniq(networkInputsConfigObj.INPUTS_IDS);
        return;
      }, function(err){
        console.log("INPUTS_IDS\n" + jsonPrint(networkInputsConfigObj.INPUTS_IDS));
        saveFileQueue.push({folder: dropboxConfigDefaultFolder, file: defaultUnionInputsConfigFile, obj: networkInputsConfigObj});
        resolve();
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
      quit({cause: "DONE"});

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MAIN ERROR ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MAIN ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
