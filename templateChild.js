 /*jslint node: true */
/*jshint sub:true*/
"use strict";

let fsmEventTimeout;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const FSM_TICK_INTERVAL = ONE_SECOND;

process.env.GOOGLE_APPLICATION_CREDENTIALS = "/Users/tc/Dropbox/Apps/wordAssociation/config/googleCloud/threeceeTwitterStream-cd581ff76075.json";

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

require("isomorphic-fetch");
const cp = require("child_process");
const os = require("os");
const _ = require("lodash");
const moment = require("moment");
const defaults = require("object.defaults");
const pick = require("object.pick");
const callerId = require("caller-id");
const treeify = require("treeify");
const table = require("text-table");
const merge = require("deepmerge");
const randomItem = require("random-item");
const randomFloat = require("random-float");
const randomInt = require("random-int");
const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");
const fs = require("fs");
const JSONParse = require("json-parse-safe");
const debug = require("debug")("tfe");
const NodeCache = require("node-cache");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");
const Stately = require("stately.js");
const omit = require("object.omit");
const HashMap = require("hashmap").HashMap;
const Twit = require("twit");

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

process.on("unhandledRejection", function(err, promise) {
  console.trace("Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  process.exit();
});

const jsonPrint = function (obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

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


let DEFAULT_CONFIGURATION = {};

DEFAULT_CONFIGURATION.childId = process.env.CHILD_ID || "CH_" + process.pid;
DEFAULT_CONFIGURATION.threeceeUser = process.env.THREECEE_USER || "altthreecee00";

DEFAULT_CONFIGURATION.hostname = os.hostname();
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.local/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.home/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.at.net/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.fios-router.home/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/word0-instance-1/g, "google");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/word/g, "google");

DEFAULT_CONFIGURATION.processName = "templateChild";
DEFAULT_CONFIGURATION.processTitle = DEFAULT_CONFIGURATION.childId;
DEFAULT_CONFIGURATION.runId = DEFAULT_CONFIGURATION.hostname + "_" + getTimeStamp() + "_" + process.pid;

DEFAULT_CONFIGURATION.configFolder = "/config";
DEFAULT_CONFIGURATION.defaultConfigFolder = "/config/utility/default";
DEFAULT_CONFIGURATION.defaultConfigFile = "default_" + DEFAULT_CONFIGURATION.processName + "Config.json";
DEFAULT_CONFIGURATION.hostConfigFolder = "/config/utility/" + DEFAULT_CONFIGURATION.hostname;
DEFAULT_CONFIGURATION.hostConfigFile = DEFAULT_CONFIGURATION.hostname + "_" + DEFAULT_CONFIGURATION.processName + "Config.json";
DEFAULT_CONFIGURATION.statsFile = DEFAULT_CONFIGURATION.processName + "Stats.json";


DEFAULT_CONFIGURATION.offlineMode = false;
DEFAULT_CONFIGURATION.quitOnComplete = false;
DEFAULT_CONFIGURATION.testMode = false;

DEFAULT_CONFIGURATION.processPrefix = "TMC";

DEFAULT_CONFIGURATION.childPrefix = "TMC";

DEFAULT_CONFIGURATION.saveFileQueueInterval = ONE_SECOND;
DEFAULT_CONFIGURATION.keepaliveInterval = 10*ONE_SECOND;
DEFAULT_CONFIGURATION.cacheTtl = 60; // seconds
DEFAULT_CONFIGURATION.cacheCheckPeriod = 10; // seconds

DEFAULT_CONFIGURATION.socket = {};
DEFAULT_CONFIGURATION.socket.reconnection = true;
DEFAULT_CONFIGURATION.socket.localTargetServer = "http://127.0.0.1:9997/util";
DEFAULT_CONFIGURATION.socket.remoteTargetServer = "https://word.threeceelabs.com/util";
DEFAULT_CONFIGURATION.socket.targetServer = DEFAULT_CONFIGURATION.socket.localTargetServer

DEFAULT_CONFIGURATION.db = {};
DEFAULT_CONFIGURATION.db.name = DEFAULT_CONFIGURATION.processPrefix + "_" + process.pid;
DEFAULT_CONFIGURATION.db.batchSize = 100;

DEFAULT_CONFIGURATION.socket = {};
DEFAULT_CONFIGURATION.socket.localTargetServer = "http://127.0.0.1:9997/util";
DEFAULT_CONFIGURATION.socket.remoteTargetServer = "https://word.threeceelabs.com/util";
DEFAULT_CONFIGURATION.socket.targetServer = DEFAULT_CONFIGURATION.socket.localTargetServer

DEFAULT_CONFIGURATION.twitter = {};

Object.keys(process.env).forEach(function(key){
  if (key.startsWith("twitter_")) { 
    const k = key.replace("twitter_", "");
    DEFAULT_CONFIGURATION.twitter[k] = process.env[key];
  }
});

DEFAULT_CONFIGURATION.fsm = {};
DEFAULT_CONFIGURATION.fsm.fsmTickInterval = ONE_SECOND;

DEFAULT_CONFIGURATION.randomEvenDelayMin = 10; // seconds
DEFAULT_CONFIGURATION.randomEvenDelayMax = 20; // seconds


DEFAULT_CONFIGURATION.dropbox = {};

Object.keys(process.env).forEach(function(key){
  if (key.startsWith("dropbox_")) { 
    const k = key.replace("dropbox_", "");
    DEFAULT_CONFIGURATION.dropbox[k] = process.env[key];
  }
});

// DEFAULT_CONFIGURATION.dropbox.listFolderLimit = 50;
// DEFAULT_CONFIGURATION.dropbox.timeout = 30 * ONE_SECOND;
// DEFAULT_CONFIGURATION.dropbox.accessToken = process.env.DROPBOX.accessToken;
// DEFAULT_CONFIGURATION.dropbox.appKey = process.env.DROPBOX.appKey ;
// DEFAULT_CONFIGURATION.dropbox.appSecret = process.env.DROPBOX.appSecret;
// DEFAULT_CONFIGURATION.dropbox.maxSaveNormal = 20 * ONE_MEGABYTE;
// DEFAULT_CONFIGURATION.dropbox.configFolder = process.env.DROPBOX.configFolder || DEFAULT_CONFIGURATION.configFolder;
// DEFAULT_CONFIGURATION.dropbox.configFile = process.env.DROPBOX.configFile || DEFAULT_CONFIGURATION.configFile;
// DEFAULT_CONFIGURATION.dropbox.statsFile = process.env.DROPBOX.statsFile || DEFAULT_CONFIGURATION.statsFile;

console.log("TMC | CHILD ENV"
  + " | " + DEFAULT_CONFIGURATION.childId
  + "\n" + jsonPrint(process.env
));


console.log(chalkAlert("DEFAULT_CONFIGURATION.dropbox\n" + jsonPrint(DEFAULT_CONFIGURATION.dropbox)));

DEFAULT_CONFIGURATION.user = {};
DEFAULT_CONFIGURATION.user.userReadyAckTimeout = ONE_MINUTE;
DEFAULT_CONFIGURATION.user.namespace = "util";
DEFAULT_CONFIGURATION.user.type = DEFAULT_CONFIGURATION.processPrefix;
DEFAULT_CONFIGURATION.user.timeStamp = moment().valueOf();
DEFAULT_CONFIGURATION.user.utilId = DEFAULT_CONFIGURATION.user.userId;
DEFAULT_CONFIGURATION.user.userId = DEFAULT_CONFIGURATION.processPrefix + "_" + DEFAULT_CONFIGURATION.hostname;
DEFAULT_CONFIGURATION.user.screenName = DEFAULT_CONFIGURATION.user.userId;
DEFAULT_CONFIGURATION.user.name = DEFAULT_CONFIGURATION.user.userId;
DEFAULT_CONFIGURATION.user.tags = {};
DEFAULT_CONFIGURATION.user.stats = {};

DEFAULT_CONFIGURATION.child = {};
DEFAULT_CONFIGURATION.child.fetchCount = 100;
DEFAULT_CONFIGURATION.child.childId = DEFAULT_CONFIGURATION.processTitle + "_CH00";
DEFAULT_CONFIGURATION.child.reinitOnClose = false;

DEFAULT_CONFIGURATION.slack = {};
DEFAULT_CONFIGURATION.slack.accessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
DEFAULT_CONFIGURATION.slack.channel = "#test";


let configuration = {};
configuration = deepcopy(DEFAULT_CONFIGURATION);

process.title = configuration.processTitle;

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");

let slack = null;
let dropboxClient = null;
let twit = null;

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.set("useFindAndModify", false);

const wordAssoDb = require("@threeceelabs/mongoose-twitter");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");

let NeuralNetwork;
let User;
let Hashtag;

let dbConnectionReadyInterval;

let UserServerController;
let userServerController;

let userServerControllerReady = false;


let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let quitWaitInterval;
let quitFlag = false;



let statsObj = {};
let statsObjSmall = {};

statsObj.pid = process.pid;

statsObj.hostname = configuration.hostname;
statsObj.startTimeMoment = moment();
statsObj.elapsed = 0;

statsObj.status = "START";

statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.userReadyTransmitted = false;
statsObj.userReadyAck = false;
statsObj.heartbeatsReceived = 0;

statsObj.children = {};
statsObj.children.childIndex = 0;

statsObj.db = {};
statsObj.db.connected = false;


statsObj.errors = {};

let statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "serverConnected", 
  "status", 
  "authenticated", 
  "socketError", 
  "userReadyAck", 
  "userReadyAckWait", 
  "userReadyTransmitted",
  "fsmState"
];

let childHashMap = {};

let fsmMain;
let fsmTickInterval;
let fsmPreviousState = "START";
statsObj.fsmState = "START";
statsObj.fsmPreviousState = "START";

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

// const jsonPrint = function (obj) {
//   if (obj) {
//     return treeify.asTree(obj, true, true);
//   }
//   else {
//     return "UNDEFINED";
//   }
// };

function initDropbox(cfg){

  console.log(chalkAlert("initDropbox CONFIG\n" + jsonPrint(cfg)));

  let config = defaults({ offlineMode: false, accessToken: configuration.dropbox.accessToken}, cfg); 

  return new Promise(async function (resolve, reject){

    const Dropbox = require("dropbox").Dropbox;

    let dropboxClient = null;

    try {

      if (config.offlineMode) {
        dropboxClient = {  // offline mode
          filesListFolder: filesListFolderLocal,
          filesUpload: function(){},
          filesDownload: function(){},
          filesGetMetadata: filesGetMetadataLocal,
          filesDelete: function(){}
        };
      }
      else {
        dropboxClient = new Dropbox({ accessToken: config.accessToken });
      }

      statsObj.status = "INIT DROPBOX OK";
    }
    catch (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | ERR INIT DROPBOX: " + err));
      statsObj.status = "INIT DROPBOX ERROR";
      reject(err);
    }

    resolve(dropboxClient);

  });
}

function slackPostMessage(params, callback) {

  if (!slack) {
    console.log(chalkAlert("slackPostMessage | ??? SLACK NOT INITIALIZED"));
    if (callback !== undefined) { return callback(new Error("SLACK NOT INITIALIZED"), null); }
  }

  const channel = params.channel || configuration.slack.channel;
  const text = params.text;

  debug(chalkInfo("SLACK POST: " + text));

  slack.api("chat.postMessage", { text: text, channel: channel }, function(err, response) {
    if (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}

function initSlack(config){

  return new Promise(async function (resolve, reject){

    statsObj.status = "INIT SLACK";

    const Slack = require("slack-node");

    const accessToken = config.accessToken;
    const channel = config.channel;

    let slack = null;

    try {

      slack = new Slack(accessToken);

      slack.api("api.test", { foo: "bar" }, function(err, response){

        if (err){
          reject(err);
        }

        if (configuration.verbose) { console.log(chalkInfo("SLACK TEST RESPONSE\n" + jsonPrint(response))); }

        slack.api("chat.postMessage", {text: "SLACK INIT", channel: channel }, function(err, response){
          if (err) {
            reject(err);
          }

          if (configuration.verbose) {console.log(chalkInfo("SLACK INIT MESSAGE RESPONSE\n" + jsonPrint(response)));}

          resolve(slack);
        });

      });

    }
    catch (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT SLACK: " + err));
      statsObj.status = "INIT SLACK ERROR";
      reject(err);
    }


  });
}


let socket;
let socketKeepAliveInterval;

let saveFileQueueInterval;
let saveFileBusy = false;
let saveFileQueue = [];
let statsUpdateInterval;

async function reset(params) {

  return new Promise(function(resolve, reject){

    setTimeout(function(){ 
      console.log(chalkAlert("TMC | " + configuration.childId + " | RESET"));
      resolve("RESET");
    }, 1000);

  });
}

async function quit(options) {

  clearTimeout(fsmEventTimeout);

  console.log(chalkAlert("TMC | " + configuration.childId + " | QUITTING ..." ));

  let forceQuitFlag = false;

  if (options) { 
    console.log(chalkAlert("TMC | " + configuration.childId + " | QUIT OPTIONS\n" + jsonPrint(options) ));
    forceQuitFlag = options.force || false;
  }

  statsObj.quitFlag = true;

  statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  statsObj.timeStamp = moment().format(compactDateTimeFormat);
  statsObj.status = "QUIT";

  const caller = callerId.getData();

  console.log(chalkAlert("TMC | *** QUIT ***"
    + " | PID: " + process.pid
    + " | CHILD ID: " + configuration.childId
    + "\nCALLER\n" + jsonPrint(caller)
  ));

  await reset("QUIT");


  if (slack) {    
    let slackText = "\n*TMC | QUIT*";
    slackText = slackText + "\nFORCE QUIT:  " + forceQuitFlag;
    slackText = slackText + "\nHOST:        " + configuration.hostname;
    slackText = slackText + "\nTITLE:       " + configuration.processTitle;
    slackText = slackText + "\nNAME:        " + configuration.processName;
    slackText = slackText + "\nSTART:       " + statsObj.startTimeMoment.format(compactDateTimeFormat);
    slackText = slackText + "\nELPSD:       " + msToTime(statsObj.elapsed);

    // console.log(chalkAlert( "TMC | SLACK TEXT: " + slackText));

    slackPostMessage({ text: slackText });
  }

  if (global.dbConnection) {
    global.dbConnection.close(function () {
      console.log(chalkAlert(
        "\n==========================\n"
        + "MONGO DB CONNECTION CLOSED"
        + "\n==========================\n"
      ));

    });
  }

  if (socket) { socket.disconnect(); }

  setTimeout(function(){  process.exit(); }, 1000);
};

let stdin;

let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN


function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    debug("filesListFolderLocal options\n" + jsonPrint(options));

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

    fs.readdir(fullPath, function(err, items){
      if (err) {
        return reject(err);
      }

      let itemArray = [];

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

        const response = {
          cursor: false,
          has_more: false,
          entries: itemArray
        };

        resolve(response);
      });

    });

  });
}

function filesGetMetadataLocal(options){

  return new Promise(function(resolve, reject) {

    console.log("filesGetMetadataLocal options\n" + jsonPrint(options));

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

    fs.stat(fullPath, function(err, stats){

      if (err) {
        return reject(err);
      }
      const response = { client_modified: stats.mtimeMs };
      
      resolve(response);

    });
  });
}

function loadFile(path, file, callback) {

  return new Promise(function(resolve, reject){

    // console.log(chalkInfo("TMC | " + configuration.childId + " | LOAD FOLDER " + path));
    // console.log(chalkInfo("TMC | LOAD FILE " + file));
    console.log(chalkInfo("TMC | " + configuration.childId + " | FULL PATH " + path + "/" + file));

    let fullPath = path + "/" + file;

    if (configuration.offlineMode) {

      if ((configuration.hostname === "macpro2") || (configuration.hostname === "mbp2")) {
        fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
        debug(chalkInfo("DEFAULT_OFFLINE_MODE: FULL PATH " + fullPath));
      }

      console.log(chalkLog("TMC | " + configuration.childId + " | " + getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE"
        + " | " + fullPath
      ));

      fs.readFile(fullPath, "utf8", function(err, data){

        if (file.match(/\.json$/gi)) {

          const fileObj = JSONParse(data);

          if (fileObj.value) {
            resolve(fileObj.value);
          }
          else {
            reject(fileObj.error);
          }
        }

      });

    }
    else {

      dropboxClient.filesDownload({path: fullPath})
        .then(function(data){
          console.log("TMC | " + configuration.childId + " | " + chalkLog(getTimeStamp()
            + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
          ));

          if (file.match(/\.json$/gi)) {

            let payload = data.fileBinary;

            if (!payload || (payload === undefined)) {
              console.log(chalkError("TMC | " + configuration.childId + " | ERROR JSON PARSE"));
              return reject(new Error("TMC | " + configuration.childId + " | LOAD FILE PAYLOAD UNDEFINED"));
            }

            try {

              const fileObj = JSONParse(payload);

              if (fileObj.value) {
                resolve(fileObj.value);
              }
              else {
                console.log(chalkError("TMC | " + configuration.childId + " | ERROR JSON PARSE"));
                reject(fileObj.error);
              }

            }
            catch (err){
              console.log(chalkError("TMC | " + configuration.childId + " | ERROR JSON PARSE"));
              reject(fileObj.error);
            }

          }
          else {
            resolve(null);
          }
        })
        .catch(function(err){
          reject(err);
        });

    }

  });
}

function getFileMetadata(folder, file) {

  return new Promise(async function(resolve, reject){

    const fullPath = folder + "/" + file;
    debug(chalkInfo("FOLDER " + folder));
    debug(chalkInfo("FILE " + file));
    console.log(chalkInfo("TMC | " + configuration.childId + " | getFileMetadata FULL PATH: " + fullPath));

    try {

      const response = await dropboxClient.filesGetMetadata({path: fullPath});

      resolve(response);

    } 
    catch (err) {

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError("TMC | " + configuration.childId + " | *** DROPBOX GET FILE METADATA | " + fullPath + " NOT FOUND"));
      }
      if (err.status === 0) {
        console.error(chalkError("TMC | " + configuration.childId + " | *** DROPBOX GET FILE METADATA | NO RESPONSE"));
      }

      reject(err);
    }

  });
}

function loadConfigFile(folder, file) {

  return new Promise(async function(resolve, reject){

    try{

      if (file === configuration.defaultConfigFile) {
        prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
      }
      else {
        prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
      }

      if (configuration.offlineMode) {
        resolve({});
      }
      else {

        const fullPath = folder + "/" + file;

        const fileMetadata = await getFileMetadata(folder, file);

        const fileModifiedMoment = moment(new Date(fileMetadata.client_modified));
        let prevConfigFileModifiedMoment = moment("2010-01-01");

        if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

          console.log(chalkInfo("TMC | " + configuration.childId + " | CONFIG FILE BEFORE OR EQUAL"
            + " | " + fullPath
            + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
            + " | " + fileModifiedMoment.format(compactDateTimeFormat)
          ));

          resolve({});
        }
        else {

          console.log(chalkInfo("TMC | " + configuration.childId + " | +++ CONFIG FILE AFTER ... LOADING"
            + " | " + fullPath
            + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
            + " | " + fileModifiedMoment.format(compactDateTimeFormat)
          ));

          prevConfigFileModifiedMoment = moment(fileModifiedMoment);

          if (file === configuration.defaultConfigFile) {
            prevDefaultConfigFileModifiedMoment = moment(fileModifiedMoment);
          }
          else {
            prevHostConfigFileModifiedMoment = moment(fileModifiedMoment);
          }

          try {

            const loadedConfigObj = await loadFile(folder, file);

            console.log(chalkInfo("TMC | " + configuration.childId + " | LOADED CONFIG FILE: " + file + "\n" + jsonPrint(loadedConfigObj)));

            let newConfiguration = {};
            newConfiguration.socket = {};

            if (loadedConfigObj.UTIL_TARGET_SERVER !== undefined) {
              console.log("TMC | " + configuration.childId + " | LOADED _UTIL_TARGET_SERVER: " + loadedConfigObj.UTIL_TARGET_SERVER);
              newConfiguration.socket.targetServer = loadedConfigObj.UTIL_TARGET_SERVER;
            }

            if (newConfiguration.testMode) {
              newConfiguration.fetchAllIntervalTime = TEST_MODE_FETCH_ALL_INTERVAL;
              console.log(chalkAlert("TMC | " + configuration.childId + " | TEST MODE | fetchAllIntervalTime: " + newConfiguration.fetchAllIntervalTime));
            }

            if (loadedConfigObj.TEST_MODE !== undefined) {
              console.log("TMC | " + configuration.childId + " | LOADED TEST_MODE: " + loadedConfigObj.TEST_MODE);
              newConfiguration.testMode = loadedConfigObj.TEST_MODE;
            }

            if (loadedConfigObj.QUIT_ON_COMPLETE !== undefined) {
              console.log("TMC | LOADED QUIT_ON_COMPLETE: " + loadedConfigObj.QUIT_ON_COMPLETE);
              if ((loadedConfigObj.QUIT_ON_COMPLETE === true) || (loadedConfigObj.QUIT_ON_COMPLETE === "true")) {
                newConfiguration.quitOnComplete = true;
              }
              if ((loadedConfigObj.QUIT_ON_COMPLETE === false) || (loadedConfigObj.QUIT_ON_COMPLETE === "false")) {
                newConfiguration.quitOnComplete = false;
              }
            }

            if (loadedConfigObj.VERBOSE !== undefined) {
              console.log("TMC | " + configuration.childId + " | LOADED VERBOSE: " + loadedConfigObj.VERBOSE);
              if ((loadedConfigObj.VERBOSE === true) || (loadedConfigObj.VERBOSE === "true")) {
                newConfiguration.verbose = true;
              }
              if ((loadedConfigObj.VERBOSE === false) || (loadedConfigObj.VERBOSE === "false")) {
                newConfiguration.verbose = false;
              }
            }

            if (loadedConfigObj.KEEPALIVE_INTERVAL !== undefined) {
              console.log("TMC | " + configuration.childId + " | LOADED KEEPALIVE_INTERVAL: " + loadedConfigObj.KEEPALIVE_INTERVAL);
              newConfiguration.keepaliveInterval = loadedConfigObj.KEEPALIVE_INTERVAL;
            }

            if (loadedConfigObj.TWITTER_USER !== undefined) {
              console.log("TMC | " + configuration.childId + " | LOADED TWITTER_USER: " + loadedConfigObj.TWITTER_USER);
              newConfiguration.twitter.user = loadedConfigObj.TWITTER_USER;
            }

            resolve(newConfiguration);
          }
          catch (err) {
            console.log(chalkError("TMC | " + configuration.childId + " | *** LOAD FILE ERROR\n" + jsonPrint(err.error)));
            reject(err);
          }

        }
      }
    }
    catch (err) {
      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError("TMC | " + configuration.childId + " | *** DROPBOX LOAD CONFIG FILE | FILE NOT FOUND"));
      }
      else if (err.status === 0) {
        console.error(chalkError("TMC | " + configuration.childId + " | *** DROPBOX LOAD CONFIG FILE | NO RESPONSE"));
      }
      else {
        console.log(chalkError("TMC | " + configuration.childId + " | *** LOAD CONFIG FILE ERROR: " + err.error.error_summary));
      }
      reject(err);
    }
  });
}

function loadAllConfigFiles(){

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD CONFIG";

    console.log(chalkInfo("TMC | " + configuration.childId + " | LOAD ALL DEFAULT " + configuration.defaultConfigFolder + "/" + configuration.defaultConfigFile));

    async.parallel({

      loadedDefaultConfig: function(cb){

        loadConfigFile(configuration.defaultConfigFolder, configuration.defaultConfigFile)
          .then(function(defaultConfig){
            defaultConfiguration = defaultConfig;
            cb();
          })
          .catch(function(err){
            console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR LOAD DEFAULT CONFIG: " + err.error.error_summary));
            cb();
          });

      },

      loadedHostConfig: function(cb){

        loadConfigFile(configuration.hostConfigFolder, configuration.hostConfigFile)
          .then(function(hostConfig){
            hostConfiguration = hostConfig;
            cb();
          })
          .catch(function(err){
            console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR LOAD HOST CONFIG: " + err.error.error_summary));
            cb();
          });

      },

    },
    function(err, results){
      if (err) {
        console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR LOAD ALL CONFIGS\n" + jsonPrint(err)));
        return reject(err);
      }

      const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
      const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

      configuration = tempConfig;

      resolve(configuration);
    });   

  });
}

function closeTwitterConnection(){

  return new Promise(async function (resolve, reject){

    statsObj.status = "CLOSE TWITTER CONNECTION";

    resolve();

  });
}

function closeDbConnection(){

  return new Promise(async function (resolve, reject){

    statsObj.status = "CLOSE DB CONNECTION";

    if (global.dbConnection) {

      global.dbConnection.close(function () {

        statsObj.db.connected = false;

        console.log(chalkAlert(
          "\nTMC ==========================\n"
          + "TMC | " + configuration.childId + " MONGO DB CONNECTION CLOSED"
          + "\nTMC ==========================\n"
        ));

        resolve();

      });
    }
    else {
      resolve();
    }

  });
}

function closeSocketConnection(){

  return new Promise(async function (resolve, reject){

    statsObj.status = "CLOSE SOCKET CONNECTION";

    clearInterval(socketKeepAliveInterval);

    if (socket) {
      socket.disconnect();
    }

    resolve();

  });
}

function closeSlackConnection(){

  return new Promise(async function (resolve, reject){

    statsObj.status = "CLOSE SLACK CONNECTION";

    if (slack) {
      // slack.close();
    }

    resolve();

  });
}

function resetConfiguration(){

  return new Promise(async function (resolve, reject){

    statsObj.status = "RESET CONFIGURATION";

    configuration = deepcopy(DEFAULT_CONFIGURATION);

    resolve();

  });
}

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog("TMC | --------------------------------------------------------\n"
    + "TMC | << FSM CHILD >>"
    + " | " + configuration.childId
    + " | " + getTimeStamp()
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\nTMC | --------------------------------------------------------"
  ));
}

function fsmEvent(event, delay){

  if (delay === "random") { delay = randomInt(configuration.randomEvenDelayMin, configuration.randomEvenDelayMax); }

  // console.log(chalkLog("TMC | >Q FSM EVENT " + event 
  //   + " | DELAY: " + delay + " SECS"
  //   + " | NOW " + getTimeStamp() 
  //   + " | FIRES AT " + moment().add(delay, "s").format(compactDateTimeFormat)
  // ));

  fsmEventTimeout = setTimeout(function(){

    console.log(chalkLog("TMC"
      + " | CHILD ID: " + configuration.childId 
      + " | -> FSM EVENT " + event 
      + " | DELAY: " + delay + " SECS"
    ));

    fsmMain[event]();

  }, delay*1000);
}

function fsmEventOR(eventArray, delay){
  const event = randomItem(eventArray);
  fsmEvent(event, delay);
}

// create db connection
// create socket connection
// create dropbox connection
// load default config
// load host config
// init params
// create children
// init children
// config children
// load childParams > children
// run children
// handle children events ("complete", "error")
// analyze children results
// save results
// ? if quitOnComplete OR loopEnd >
//  - shutdown children
//  - save results, status
//  - shutdown main db/socket/dropbox/etc connections
//  - exit
// ? if loop > GOTO 'init children'
//  

const fsmStates = {

  "START":{

    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }
    },

    fsm_tick: function() {
    },

    "fsm_reset": "RESET",
    "fsm_save": "SAVE",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_pause": "PAUSE",
    "fsm_init": "INIT",
    "fsm_idle": "IDLE"
  },

  "RESET":{

    onEnter: async function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 

        await closeTwitterConnection();
        await closeDbConnection();
        await closeSocketConnection();
        await closeSlackConnection();
        await resetConfiguration();

        fsmEventOR(["fsm_exit", "fsm_idle"], "random");
      }

    },

    fsm_tick: function() {
    },

    "fsm_exit": "EXIT",
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_pause": "PAUSE",
    "fsm_idle": "IDLE"
  },

  "IDLE":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        fsmEventOR(["fsm_exit", "fsm_init"], "random");
      }
    },

    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_init": "INIT",
    "fsm_error": "ERROR"
  },

  "ERROR":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        fsmEventOR(["fsm_exit", "fsm_reset"], "random");
      }
    },
    "fsm_exit": "EXIT",
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_reset": "RESET"
  },

  "INIT":{
    onEnter: async function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 

        global.dbConnection = await initDb(configuration.db);
        socket = await initSocket(configuration.socket);
        slack = await initSlack(configuration.slack);
        twit = await initTwitter(configuration.twitter);

        fsmEventOR(["fsm_error", "fsm_exit", "fsm_ready"], "random");
      }
    },
    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_idle": "IDLE",
    "fsm_error": "ERROR",
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_save": "SAVE",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 
        fsmEventOR(["fsm_exit", "fsm_run"], "random");
      }
    },
    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_run": "RUN",
    "fsm_idle": "IDLE",
    "fsm_init": "INIT",
    "fsm_pause": "PAUSE",
    "fsm_run": "RUN_COMPLETE",
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_save": "SAVE",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "RUN":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 
        fsmEventOR(["fsm_exit", "fsm_pause", "fsm_error", "fsm_run_complete"], "random");
      }
    },
    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_idle": "IDLE",
    "fsm_init": "INIT",
    "fsm_pause": "PAUSE",
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_save": "SAVE",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "PAUSE":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 
        fsmEventOR(["fsm_exit", "fsm_run", "fsm_error", "fsm_run_complete"], "random");
      }
    },
    fsm_tick: function() {
    },
    "fsm_exit": "EXIT",
    "fsm_idle": "IDLE",
    "fsm_init": "INIT",
    "fsm_run": "RUN",
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_save": "SAVE",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "RUN_COMPLETE":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 
        fsmEventOR(["fsm_exit", "fsm_save"], "random");
      }
    },
    fsm_tick: function() {
    },
    "fsm_idle": "IDLE",
    "fsm_init": "INIT",
    "fsm_pause": "PAUSE",
    "fsm_run": "RUN",
    "fsm_save": "SAVE",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "SAVE":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 
        fsmEventOR([ "fsm_exit", "fsm_init", "fsm_run", "fsm_pause", "fsm_error", "fsm_run_complete"], "random");
      }
    },
    fsm_tick: function() {
    },
    "fsm_idle": "IDLE",
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_pause": "PAUSE",
    "fsm_init": "INIT",
    "fsm_ready": "READY",
    "fsm_run": "RUN",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "EXIT":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 
        quit();
      }
    },
    fsm_tick: function() {
    }
  },

};

fsmMain = Stately.machine(fsmStates);

function initFsmTickInterval(interval) {
  console.log(chalkInfo("TMC | INIT FSM TICK INTERVAL | " + msToTime(interval)));
  clearInterval(fsmTickInterval);
  fsmTickInterval = setInterval(function() {
    statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
    fsmMain.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

reporter("START", "---", fsmMain.getMachineState());

console.log("\n\n=================================");
console.log("HOST:          " + configuration.hostname);
console.log("CHILD ID:      " + configuration.childId);
console.log("PROCESS TITLE: " + configuration.processTitle);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + configuration.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
});

process.on("message", function(msg) {
  if ((msg === "SIGINT") || (msg === "shutdown")) {
    clearInterval(statsUpdateInterval);
    setTimeout(function() {
      console.log(chalkAlert("TMC | " + configuration.childId + " | QUITTING"));
      quit("SHUTDOWN");
    }, 1000);
  }
});

function showStats(options) {

  if (options) {
    console.log("TMC | STATS\n" + jsonPrint(statsObj));
  }
  else {

    console.log("TMC | " + configuration.childId + " | " + chalkLog(configuration.processPrefix
      + " | FSM: " + fsmMain.getMachineState()
      + " | N: " + getTimeStamp()
      + " | SERVER CONNECTED: " + statsObj.serverConnected
      + " | AUTHENTICATED: " + statsObj.userAuthenticated
      + " | READY TXD: " + statsObj.userReadyTransmitted
      + " | READY ACK: " + statsObj.userReadyAck
      + " | E: " + msToTime(statsObj.elapsed)
      + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
    ));

  }
}

process.on( "SIGINT", function() {
  quit({source: "SIGINT"});
});

process.on("exit", function() {
  console.log(chalkAlert("TMC | " + configuration.childId + " | *** EXIT ***"));
  quit({source: "EXIT"});
});

process.on( "SIGHUP", function() {
  console.log(chalkAlert("TMC | " + configuration.childId + " | *** SIGHUP ***"));
  quit({source: "SIGHUP"});
});

process.on( "SIGINT", function() {
  console.log(chalkAlert("TMC | " + configuration.childId + " | *** SIGINT ***"));
  quit({source: "SIGINT"});
});

process.on("disconnect", function() {
  console.log(chalkAlert("TMC | " + configuration.childId + " | *** DISCONNECT ***"));
  quit("DISCONNECT");
});

process.on("message", async function(m) {

  debug(chalkAlert("TMC CHILD RX MESSAGE"
    + " | OP: " + m.op
  ));

  switch (m.op) {

    case "shutdown":
    case "SIGINT":
      clearInterval(checkRateLimitInterval);
      setTimeout(function() {
        console.log("TMC QUITTING | @" + configuration.childId);
        process.exit(0);
      }, 500);
    break;

    case "INIT":

      console.log(chalkInfo("TMC | TMP CHILD INIT"
        + " | CHILD ID: " + m.childId
        + " | 3C: @" + m.threeceeUser
        // + " | TWITTER CONFIG\n" + jsonPrint(m.twitterConfig)
      ));

      configuration.childId = m.childId;
      configuration.threeceeUser = m.threeceeUser;
      configuration.twitter = {};
      configuration.twitter = m.twitterConfig;

      try {
        twit = await initTwitter(m.twitter);
        initCheckRateLimitInterval(checkRateLimitIntervalTime);
        twitterUserUpdate({}, function(){
          fsm.fsm_init();
        });
      }
      catch (err){
        console.log(chalkError("*** INIT TWITTER ERROR | : " + err));
      }

      // initTwitter(m.twitter, function initTwitterUsersCallback(e){
      //   initCheckRateLimitInterval(checkRateLimitIntervalTime);

      //   twitterUserUpdate({}, function(){
      //     fsm.fsm_init();
      //   });

      // });

    break;

    case "READY":
      fsm.fsm_ready();
    break;

    case "FETCH_END":
      fsm.fsm_fetchUserEnd();
    break;

    case "FETCH_USER_START":
      fsm.fsm_fetchUserStart();
    break;

    case "FOLLOW":

      if (twitClient) {

        twitClient.post(

          "friendships/create", {screen_name: m.user.screenName}, 

          function createFriend(err, data, response){
            if (err) {
              console.log(chalkError("TMC | FOLLOW ERROR"
                + " | @" + configuration.threeceeUser
                + " | " + err
              ));

              process.send({op:"ERROR", type: "UNKNOWN", threeceeUser: configuration.threeceeUser, state: "FOLLOW", params: {screen_name: m.user.screenName}, error: err });
            }
            else {
              // debug("data\n" + jsonPrint(data));
              // debug("response\n" + jsonPrint(response));

              console.log(chalkInfo("TMC | +++ FOLLOW"
                + " | 3C: @" + configuration.threeceeUser
                + " | NID: " + m.user.userId
                + " | @" + m.user.screenName.toLowerCase()
              ));
            }
          }
        );
      }
    break;

    case "UNFOLLOW":

      // console.log("UNFOLLOW MESSAGE\n" + jsonPrint(m.user));

      unfollowFriend({ user: m.user }, function(err, results){

        if (err) {

          if (err.code === 34){
            console.log(chalkError("=X= UNFOLLOW ERROR | NON-EXISTENT USER"
              + " | " + configuration.childId
              + " | 3C: @" + configuration.threeceeUser
              + "\n" + jsonPrint(m.user)
            ));
            return;
          }

          console.log(chalkError("=X= UNFOLLOW ERROR"
            + " | " + configuration.childId
            + " | 3C: @" + configuration.threeceeUser
            + "\n" + jsonPrint(m.user)
          ));

          process.send(
            {
              op:"ERROR",
              type: "UNKNOWN", 
              threeceeUser: configuration.threeceeUser, 
              state: "UNFOLLOW_ERR", 
              params: { user: m.user }, 
              error: err
            }
          );

          return;
        }

        if (!results) {

          debug(chalkInfo("TMC | UNFOLLOW MISS"
            + " | " + configuration.childId
            + " | 3C: @" + configuration.threeceeUser
            + "\n" + jsonPrint(m.user)
          ));

          return;
        }

        console.log(chalkInfo("TMC | XXX UNFOLLOW"
          + " | " + configuration.childId
          + " | 3C: @" + configuration.threeceeUser
          + " | " + results.id_str
          + " | @" + results.screen_name
          + " | FLWRs: " + results.followers_count
          + " | FRNDs: " + results.friends_count
          + " | Ts: " + results.statuses_count
        ));

      });

    break;

    case "QUIT":
      fsm.fsm_reset();
      quit("PARENT");
    break;

    case "DISABLE":
      fsm.fsm_disable();
    break;

    case "RESET":
      fsm.fsm_reset();
    break;

    case "RESET_TWITTER_USER_STATE":
      console.log("TMC | " + configuration.childId 
        + " | @" + configuration.threeceeUser 
        + " | RESET_TWITTER_USER_STATE"
      );
      resetTwitterUserState();
    break;    

    case "STATS":
      showStats();
      process.send({
        op:"STATS", 
        childId: configuration.childId, 
        threeceeUser: configuration.threeceeUser, 
        statsObj: statsObj
      });
    break;

    case "VERBOSE":
      console.log(chalkInfo("TMC @" + configuration.childId + " | SET VERBOSE: " + m.verbose));
      configuration.verbose = m.verbose;
    break;

    default:
      console.log(chalkError("TMC | " + configuration.childId 
        + " | UNKNOWN OP ERROR"
        + " | " + m.op
      ));
  }
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
    console.log(chalkBlue("TMC | " + configuration.childId 
      + " | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 })
    .then(function() {

      console.log(chalkBlue("TMC | " + configuration.childId 
        + " | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(err){
      console.trace(chalkError("TMC | " + configuration.childId 
        + " | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX LOCAL JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + err
        + " | ERROR\n" + jsonPrint(err)
      ));
      if (callback !== undefined) { return callback(err); }
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
        debug(chalkLog("TMC | " + configuration.childId 
          + " | SAVED DROPBOX JSON | " + options.path
        ));
        if (callback !== undefined) { return callback(null); }
      })
      .catch(function(err){
        if (err.status === 413){
          console.error(chalkError("TMC | " + configuration.childId 
            + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else if (err.status === 429){
          console.error(chalkError("TMC | " + configuration.childId
            + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else if (err.status === 500){
          console.error(chalkError("TMC | " + configuration.childId
            + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else {
          console.trace(chalkError("TMC | " + configuration.childId 
            + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + err
          ));
          if (callback !== undefined) { return callback(err); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: DROPBOX_LIST_FOLDER_LIMIT})
      .then(function(response){

        debug(chalkLog("TMC | " + configuration.childId 
          + " | DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          // + " | CURSOR (trunc): " + response.cursor.substr(-10)
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkInfo("TMC | " + configuration.childId 
            + " | DROPBOX FILE"
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
            console.log(chalkError(" | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert("TMC | " + configuration.childId 
              + " | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert("TMC | " + configuration.childId 
              + " | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError("TMC | " + configuration.childId + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError("TMC | " + configuration.childId + " | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initSaveFileQueue() {

  console.log(chalkBlue("TMC | " + configuration.childId 
    + " | INIT DROPBOX SAVE FILE INTERVAL | " + configuration.saveFileQueueInterval + " MS"
  ));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError("TMC | " + configuration.childId 
            + " | *** SAVE FILE ERROR ... RETRY"
            + " | " + saveFileObj.folder + "/" + saveFileObj.file
          ));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("TMC | " + configuration.childId 
            + " | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file
          ));
        }
        saveFileBusy = false;
      });

    }
  }, configuration.saveFileQueueInterval);
}

function sendKeepAlive(callback) {

  if (statsObj.userAuthenticated && statsObj.serverConnected) {

    statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
    statsObj.timeStamp = moment().format(compactDateTimeFormat);
    configuration.user.timeStamp = moment().valueOf();
    configuration.user.stats.elapsed = statsObj.elapsed;

    statsObjSmall = pick(statsObj, statsPickArray);

    if (configuration.verbose) {
      debug(chalkInfo("TMC | " + configuration.childId + " | TX KEEPALIVE"
        + " | " + configuration.user.userId
        + " | " + moment().format(compactDateTimeFormat)
      ));
    }

    socket.emit(
      "SESSION_KEEPALIVE", 
      {
        user: configuration.user, 
        stats: statsObjSmall,
        status: statsObj.status
      }
    );

    callback(null);
  }
  else {
    console.log(chalkError("TMC | " + configuration.childId + " | !!!! CANNOT TX KEEPALIVE"
      + " | " + configuration.user.userId
      + " | CONNECTED: " + statsObj.serverConnected
      + " | READY ACK: " + statsObj.userAuthenticated
      + " | " + moment().format(compactDateTimeFormat)
    ));
    callback("ERROR");
  }
}

function initKeepalive(interval) {

  clearInterval(socketKeepAliveInterval);

  console.log(chalkConnect("TMC | " + configuration.childId + " | START KEEPALIVE"
    + " | " + getTimeStamp()
    + " | READY ACK: " + statsObj.userAuthenticated
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  sendKeepAlive(function(err) {
    if (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | KEEPALIVE ERROR: " + err));
    }
    else if (configuration.verbose) {
      console.log(chalkLog("TMC | " + configuration.childId + " | T> KEEPALIVE | " + moment().format(compactDateTimeFormat)));
    }
  });

  socketKeepAliveInterval = setInterval(function() { // TX KEEPALIVE

    // updateStatsObjSmall();

    sendKeepAlive(function(err) {
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      else if (configuration.verbose) {
        console.log(chalkLog("TMC | " + configuration.childId + " | T> KEEPALIVE | " + moment().format(compactDateTimeFormat)));
      }
    });

  }, interval);
}

let userReadyInterval;

function initUserReadyInterval(interval) {

  console.log(chalkInfo("TMC | " + configuration.childId + " | INIT USER READY INTERVAL"));

  clearInterval(userReadyInterval);

  userReadyInterval = setInterval(function() {

    if (statsObj.serverConnected && !statsObj.userReadyTransmitted && !statsObj.userReadyAck) {

      statsObj.userReadyTransmitted = moment().valueOf();
      configuration.user.timeStamp = moment().valueOf();

      socket.emit("USER_READY", {userId: configuration.user.userId, timeStamp: moment().valueOf()});
    }
    else if (statsObj.userReadyTransmitted && !statsObj.userReadyAck) {

      statsObj.userReadyTransmittedElapsed = moment().valueOf() - statsObj.userReadyTransmitted;

      if (statsObj.userReadyTransmittedElapsed > USER_READY_ACK_TIMEOUT) {

        console.log(chalkAlert("TMC | " + configuration.childId
          + " | USER_READY_ACK_TIMEOUT | RETRANSMIT USER_READY"
          + " | NOW: " + moment().format(compactDateTimeFormat) 
          + " | TXD: " + moment(statsObj.userReadyTransmitted).format(compactDateTimeFormat) 
          + " | AGO: " + msToTime(moment().valueOf() - statsObj.userReadyTransmitted)
          + " | TIMEOUT: " + msToTime(USER_READY_ACK_TIMEOUT)
        ));

        statsObj.userReadyTransmitted = moment().valueOf();
        configuration.user.timeStamp = moment().valueOf();

        socket.emit("USER_READY", {userId: configuration.user.userId, timeStamp: moment().valueOf()});
      }
      else {
        console.log(chalkAlert("TMC | " + configuration.childId 
          + " | WAITING FOR USER_READY_ACK ..."
          + " | NOW: " + moment().format(compactDateTimeFormat) 
          + " | TXD: " + moment(statsObj.userReadyTransmitted).format(compactDateTimeFormat) 
          + " | AGO: " + msToTime(moment().valueOf() - statsObj.userReadyTransmitted)
          + " | TIMEOUT: " + msToTime(USER_READY_ACK_TIMEOUT)
        ));
      }

    }
  }, interval);
}


function initDb(config){

  let name = config.name || configuration.db.name;
  name = name + "_" + getTimeStamp();

  const batchSize = config.batchSize || configuration.db.batchSize;

  return new Promise(async function (resolve, reject){

    statsObj.status = "INIT MONGO DB | " + name;

    try {

      wordAssoDb.connect(name, function(err, db){

        if (err) {
          console.log(chalkError("TMC | " + configuration.childId + " | *** MONGO DB CONNECTION ERROR | " + name + " | " + err));
          statsObj.db.connected = false;
          return reject(err);
        }

        db.on("error", function(){
          console.log(chalkError("TMC | " + configuration.childId + " | " + name + " | *** MONGO DB CONNECTION ERROR ***\n"));
          db.close();
          statsObj.db.connected = false;
        });

        db.on("disconnected", function(){
          console.log(chalkAlert("TMC | " + configuration.childId + " | " + name + " | *** MONGO DISCONNECTED ***\n"));
          statsObj.db.connected = false;
        });

        console.log(chalk.green("TMC | " + configuration.childId + " | " + name + " | MONGOOSE DEFAULT CONNECTION OPEN"));

        User = mongoose.model("User", userModel.UserSchema);
        Hashtag = mongoose.model("Hashtag", hashtagModel.HashtagSchema);
        NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);

        async.parallel({
          countUsers: function(cb){
            User.countDocuments({}, function (err, count) {
              if (err) {
                console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT DB | COUNT USERS: " + err));
                return cb(err);
              }
              console.log(chalkInfo("TMC | " + configuration.childId + " | " + count + " USERS"));
              cb();
            });
          },
          countHashtags: function(cb){
            Hashtag.countDocuments({}, function (err, count) {
              if (err) {
                console.log(chalkError("*** ERROR INIT DB | COUNT HASHTAGS: " + err));
                return cb(err);
              }
              console.log(chalkInfo("TMC | " + configuration.childId + " | " + count + " HASHTAGS"));
              cb();
            });
          },
          countNeuralNetworks: function(cb){
            NeuralNetwork.countDocuments({}, function (err, count) {
              if (err) {
                console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT DB | COUNT NEURAL NETWORKS: " + err));
                return cb(err);
              }
              console.log(chalkInfo("TMC | " + configuration.childId + " | " + count + " NEURAL NETWORKS"));
              cb();
            });
          },
        },
        function(err, results){
          if (err) {
            statsObj.db.err = err;
            return reject(err);
          }

          statsObj.db.connected = true;

          resolve(db);
        });   

      });

    }
    catch (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT DB: " + err));
      statsObj.db.err = err;
      statsObj.status = "INIT DB ERROR";
      reject(err);
    }


  });
}

function initSocket(config){

  const user = config.user || configuration.user;
  const targetServer = config.targetServer || configuration.socket.targetServer;
  const reconnection = config.reconnection || configuration.socket.reconnection || false ;

  return new Promise(async function (resolve, reject){

    statsObj.status = "INIT SOCKET";

    if (configuration.offlineMode) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** INIT SOCKET | OFFLINE MODE *** "));
      return reject(new Error("TMC | OFFLINE MODE"));
    }

    if (socket && socket.id) {
      console.log(chalkAlert("TMC | " + configuration.childId + " | !!! INIT SOCKET | DISCONNECT EXISTING SOCKET CONNECTION | " + socket.id));
      socket.disconnect();
      socket = null;
    }

    let s = null;

    try {

      console.log(chalkLog("TMC | " + configuration.childId + " | INIT SOCKET"
        + " | " + targetServer
        + " | USER: " + user.userId
        + " | RECONNECTION: " + reconnection
        // + "\nUSER\n" + jsonPrint(user)
      ));

      s = require("socket.io-client")(targetServer, { reconnection: reconnection });

      s.on("connect", function() {

        statsObj.socketId = s.id ;
        statsObj.serverConnected = true ;

        console.log(chalkConnect("TMC | " + configuration.childId + " | SOCKET CONNECT | " + s.id + " ... AUTHENTICATE ..."));

        s.emit("authentication", { namespace: "util", userId: user.userId, password: "0123456789" });
      });

      s.on("unauthorized", function(err) {
        console.log(chalkError("TMC | *** AUTHENTICATION ERROR: ", err.message));
        statsObj.userAuthenticated = false ;
      });

      s.on("authenticated", function() {

        statsObj.serverConnected = true ;

        console.log("TMC | " + configuration.childId + " | SOCKET AUTHENTICATED | " + s.id);

        statsObj.socketId = socket.id;

        console.log(chalkConnect("TMC | " + configuration.childId + " | SOCKET CONNECTED TO SERVER"
          + " | SERVER: " + configuration.socket.targetServer
          + " | ID: " + s.id
        ));

        user.timeStamp = moment().valueOf();

        console.log(chalkInfo("TMC | " + configuration.childId + " | T> USER_READY"
          + " | " + s.id
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + user.userId
          + " | " + user.url
          + " | " + user.screenName
          + " | " + user.type
          // + " | " + user.mode
          + "\nTAGS\n" + jsonPrint(user.tags)
        ));

        statsObj.userAuthenticated = true ;

        initKeepalive(configuration.keepaliveInterval);

        initUserReadyInterval(5000);
      });

      s.on("disconnect", function(reason) {

        statsObj.userAuthenticated = false ;
        statsObj.serverConnected = false;
        statsObj.userReadyTransmitted = false;
        statsObj.userReadyAck = false ;

        console.log(chalkAlert("TMC | " + moment().format(compactDateTimeFormat)
          + " | SOCKET DISCONNECT: " + statsObj.socketId
          + " | REASON: " + reason
        ));
      });

      s.on("reconnect", function(reason) {

        statsObj.serverConnected = true;

        console.log(chalkInfo("TMC | " + configuration.childId + " | SOCKET RECONNECT"
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + s.id
          + " | REASON: " + reason
        ));
      });

      s.on("USER_READY_ACK", function(user) {

        statsObj.userReadyAck = true ;
        statsObj.serverConnected = true;

        console.log(chalkBlue("TMC | " + configuration.childId + " | R< USER_READY_ACK MESSAGE"
          + " | " + s.id
          + " | USER ID: " + user.userId
          + " | " + moment().format(compactDateTimeFormat)
        ));
      });

      s.on("error", function(err) {
        console.log(chalkError("TMC | " + configuration.childId + " | " + moment().format(compactDateTimeFormat)
          + " | *** SOCKET ERROR"
          + " | " + s.id
          + " | " + err
        ));
      });

      s.on("connect_error", function(err) {

        statsObj.userAuthenticated = false ;
        statsObj.serverConnected = false ;
        statsObj.userReadyTransmitted = false;
        statsObj.userReadyAck = false ;

        console.log(chalkError("TMC | " + configuration.childId + " | *** SOCKET CONNECT ERROR "
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + err.type
          + " | " + err.description
        ));
      });

      s.on("reconnect_error", function(err) {

        statsObj.userAuthenticated = false ;
        statsObj.serverConnected = false ;
        statsObj.userReadyTransmitted = false;
        statsObj.userReadyAck = false ;

        console.log(chalkError("TMC | " + configuration.childId + " | *** SOCKET RECONNECT ERROR "
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + err.type
          + " | " + err.description
        ));
      });

      s.on("HEARTBEAT", function() {
        statsObj.serverConnected = true;
        statsObj.heartbeatsReceived += 1;
        if (configuration.verbose) { console.log(chalkLog("TMC | " + configuration.childId + " | R< HEARTBEAT [" + statsObj.heartbeatsReceived + "]")); }
      });

      resolve(s);

    }
    catch (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT SOCKET: " + err));
      statsObj.status = "INIT SOCKET ERROR";
      reject(err);
    }


  });
}

function initTwitter(twitterConfig){

  const user = twitterConfig.threeceeUser || configuration.twitter.user;

  return new Promise(async function (resolve, reject){

    statsObj.status = "INIT TWITTER";

    if (configuration.offlineMode) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** INIT TWITTER | OFFLINE MODE *** "));
      return reject(new Error("OFFLINE MODE"));
    }

    if (twit && twitterConfig.reinit) {
      console.log(chalkAlert("TMC | " + configuration.childId + " | !!! INIT TWITTER | DISCONNECT EXISTING TWITTER CONNECTION"));
      // twit.disconnect();
      twit = null;
    }
    else if (twit) {
      return resolve(twit);
    }

    let t = null;

    try {

      console.log(chalkLog("TMC | " + configuration.childId + " | INIT TWITTER"));

      t = new Twit({
        consumer_key: twitterConfig.consumerKey,
        consumer_secret: twitterConfig.consumerSecret,
        access_token: twitterConfig.accessToken,
        access_token_secret: twitterConfig.accessTokenSecret
      });

      t.get("account/verify_credentials", { skip_status: true })
        .catch(function (err) {
          console.log(chalkError("TMC | " + configuration.childId + " | INIT TWITTER ERROR", err.stack));
          reject(err);
        })
        .then(function (result) {
          // console.log(chalkLog("TMC | INIT TWITTER RESULTS\n" + jsonPrint(result.data)));
          resolve(t);
        });
    }
    catch (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT TWITTER: " + err));
      statsObj.status = "INIT TWITTER ERROR";
      reject(err);
    }


  });
}

function initStatsUpdate(callback) {

  console.log(chalkTwitter("TMC | " + configuration.childId + " | INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  twitterTextParser.getGlobalHistograms(function(hist) {
    saveFile({folder: statsFolder, file: statsFile, obj: statsObj});
  });

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    showStats();
    
  }, configuration.statsUpdateIntervalTime);

  if (callback !== undefined) { callback(null); }
}

function toggleVerbose(){

  configuration.verbose = !configuration.verbose;

  console.log(chalkAlert("TMC | " + configuration.childId + " | VERBOSE: " + configuration.verbose));
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    try {

      console.log(chalkInfo("TMC | " + configuration.childId + " | INITIALIZING..."));
      if (cnf.verbose) { console.log(chalkInfo("TMC | CONFIGURATION\n" + jsonPrint(cnf) ));}

      statsObj.status = "INITIALIZE";

      if (debug.enabled) {
        console.log("\nTMC | %%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
      }

      cnf.processName = process.env.PROCESS_NAME || DEFAULT_CONFIGURATION.processName;
      cnf.targetServer = process.env.UTIL_TARGET_SERVER || DEFAULT_CONFIGURATION.targetServer;
      cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;

      if (cnf.testMode) {
        console.log(chalkAlert("TMC | " + configuration.childId + " | TEST MODE"));
      }

      cnf.quitOnError = process.env.QUIT_ON_ERROR || false ;

      if (process.env.QUIT_ON_COMPLETE === "false") {
        cnf.quitOnComplete = false;
      }
      else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
        cnf.quitOnComplete = true;
      }

      cnf.enableStdin = process.env.ENABLE_STDIN || true ;

      cnf.statsUpdateIntervalTime = process.env.STATS_UPDATE_INTERVAL || ONE_MINUTE;

      dropboxClient = await initDropbox(cnf.dropbox);
      let allConfigLoaded = await loadAllConfigFiles();

      resolve(configuration);

    }
    catch (err) {
      console.log(chalkError("TMC | " + configuration.childId + " | *** ERROR INIT CONFIG: " + err));
      statsObj.status = "INIT CONFIG ERROR";
      reject(err);
    }
  });
}

function startFsmMain(){
  initFsmTickInterval(FSM_TICK_INTERVAL)
  console.log(chalkInfo("TMC | +++ START FSM MAIN | " + configuration.childId + " | " + getTimeStamp()));
  fsmEvent("fsm_reset", "random");
}

initConfig(configuration)
  .then(async function(cnf){
    configuration = deepcopy(cnf);

    console.log(chalkTwitter("TMC | " + configuration.childId
      + " STARTED " + getTimeStamp()
    ));

    startFsmMain();

  })
  .catch(function(err){
    console.log(chalkError("TMC | " + configuration.childId + " | ***** INIT CONFIG ERROR ***** ", err));
    quit();
  });