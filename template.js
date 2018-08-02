 /*jslint node: true */
/*jshint sub:true*/
"use strict";

const DEFAULT_PROCESS_NAME = "template";

process.title = "node_template";

const DEFAULT_TEST_MODE = false;
const DEFAULT_LOCAL_TARGET_SERVER = "http://127.0.0.1:9997/util";
const DEFAULT_PROCESS_PREFIX = "TMP";
const DEFAULT_CHILD_PREFIX = "TMC";
const cp = require("child_process");

const DEFAULT_THREECEE_TWITTER_USER = "altthreecee00";
const DEFAULT_CONFIG_FILE = DEFAULT_PROCESS_NAME + "Config.json";
const DEFAULT_STATS_FILE = DEFAULT_PROCESS_NAME + "Stats.json";

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");
const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");

let NeuralNetwork;
let User;

let dbConnectionReady = false;
let dbConnectionReadyInterval;

let UserServerController;
let userServerController;

let userServerControllerReady = false;

require("isomorphic-fetch");

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_FSM_TICK_INTERVAL = ONE_SECOND;
const DEFAULT_SAVE_FILE_INTERVAL = ONE_SECOND;
const DEFAULT_KEEPALIVE_INTERVAL = 10*ONE_SECOND;

const DEFAULT_CACHE_TTL = 60; // seconds
const DEFAULT_CACHE_CHECK_PERIOD = 10; // seconds

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const MAX_SAVE_DROPBOX_NORMAL = 20 * ONE_MEGABYTE;

const USER_READY_ACK_TIMEOUT = ONE_MINUTE;

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


let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const USER_ID = DEFAULT_PROCESS_PREFIX + "_" + hostname;
const SCREEN_NAME = DEFAULT_PROCESS_PREFIX + "_" + hostname;

let userObj = {
  name: USER_ID,
  nodeId: USER_ID,
  userId: USER_ID,
  utilId: USER_ID, 
  url: "https://www.twitter.com",
  screenName: SCREEN_NAME,
  namespace: "util",
  type: DEFAULT_PROCESS_PREFIX,
  timeStamp: moment().valueOf(),
  tags: {},
  stats: {}
} ;

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

const DEFAULT_QUIT_ON_COMPLETE = false;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";
const DROPBOX_LIST_FOLDER_LIMIT = 50;
const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;
const DEFAULT_OFFLINE_MODE = false;

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

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");


let statsObj = {};
let statsObjSmall = {};

statsObj.pid = process.pid;

statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.elapsed = 0;

statsObj.status = "START";
statsObj.fsmState = "---";

statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.userReadyTransmitted = false;
statsObj.userReadyAck = false;
statsObj.heartbeatsReceived = 0;

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

let quitWaitInterval;
let quitFlag = false;

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

const jsonPrint = function (obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#" + DEFAULT_PROCESS_PREFIX.toLowerCase();
const Slack = require("slack-node");

let slack = new Slack(slackOAuthAccessToken);

function slackPostMessage(channel, text) {

  debug(chalkInfo("SLACK POST: " + text));

  return new Promise(function(resolve, reject){

    slack.api("chat.postMessage", { text: text, channel: channel }, function(err, response) {

      if (err) {
        console.log(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
        return reject(err);
      }

      debug(response);
      resolve(response);

    });

  });
}


let socket;
let socketKeepAliveInterval;

let saveFileQueueInterval;
let saveFileBusy = false;
let saveFileQueue = [];
let statsUpdateInterval;

async function reset(params) {

  console.log(chalkAlert(DEFAULT_PROCESS_PREFIX + " | RESET"));

  return new Promise(function(resolve, reject){

    setTimeout(function(){ 
      console.log(chalkAlert(DEFAULT_PROCESS_PREFIX + " | RESET"));
      resolve("RESET");
    }, 1000);

  });

}

async function quit(options) {

  console.log(chalkAlert( DEFAULT_PROCESS_PREFIX + " | QUITTING ..." ));

  let forceQuitFlag = false;

  if (options) { 
    console.log(chalkAlert("OPTIONS\n" + jsonPrint(options) ));
    forceQuitFlag = options.force || false;
  }

  statsObj.quitFlag = true;

  statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  statsObj.timeStamp = moment().format(compactDateTimeFormat);
  statsObj.status = "QUIT";

  const caller = callerId.getData();

  console.log(chalkAlert("*** QUIT ***\n" + jsonPrint(caller) ));

  await reset("QUIT");

  let slackText = "\n*QUIT*";
  slackText = slackText + "\nFORCE QUIT:  " + forceQuitFlag;
  slackText = slackText + "\nHOST:        " + hostname;
  slackText = slackText + "\nSTART:       " + statsObj.startTimeMoment.format(compactDateTimeFormat);
  slackText = slackText + "\nELPSD:       " + msToTime(statsObj.elapsed);

  console.log(chalkAlert( DEFAULT_PROCESS_PREFIX + " | SLACK TEXT: " + slackText));

  await slackPostMessage(slackChannel, slackText);

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

let configuration = {};

configuration.reinitializeChildOnClose = false;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || DEFAULT_CONFIG_FILE;
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || DEFAULT_STATS_FILE;

configuration.saveFileQueueInterval = DEFAULT_SAVE_FILE_INTERVAL;
configuration.testMode = DEFAULT_TEST_MODE;
configuration.keepaliveInterval = DEFAULT_KEEPALIVE_INTERVAL;
configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;


const RUN_ID = hostname 
+ "_" + statsObj.startTimeMoment.format(compactDateTimeFormat) 
+ "_" + process.pid;

statsObj.runId = RUN_ID;

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || DEFAULT_STATS_FILE;

const DROPBOX_CONFIG_FOLDER = "/config/utility";
const dropboxConfigFolder = DROPBOX_CONFIG_FOLDER;

const DROPBOX_CONFIG_DEFAULT_FOLDER = "/config/utility/default";
const dropboxConfigDefaultFolder = DROPBOX_CONFIG_DEFAULT_FOLDER;

const DROPBOX_CONFIG_HOST_FOLDER = "/config/utility/" + hostname;
const dropboxConfigHostFolder = DROPBOX_CONFIG_HOST_FOLDER;

const DROPBOX_CONFIG_DEFAULT_FILE = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigDefaultFile = DROPBOX_CONFIG_DEFAULT_FILE

const DROPBOX_CONFIG_HOST_FILE = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = DROPBOX_CONFIG_HOST_FILE;


let statsFolder = "/stats";
let statsFile = DROPBOX_STATS_FILE;

const Dropbox = require("dropbox").Dropbox;

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

let dropboxRemoteClient = new Dropbox({ accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN });
let dropboxLocalClient = {  // offline mode
  filesListFolder: filesListFolderLocal,
  filesUpload: function(){},
  filesDownload: function(){},
  filesGetMetadata: filesGetMetadataLocal,
  filesDelete: function(){}
};

let fsmPreviousState = "IDLE";

process.on("unhandledRejection", function(err, promise) {
  console.trace("Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  process.exit();
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

function loadFile(path, file, callback) {

  return new Promise(function(resolve, reject){

    console.log(chalkInfo("LOAD FOLDER " + path));
    console.log(chalkInfo("LOAD FILE " + file));
    console.log(chalkInfo("FULL PATH " + path + "/" + file));

    let fullPath = path + "/" + file;

    if (DEFAULT_OFFLINE_MODE) {

      if ((hostname === "macpro2") || (hostname === "mbp2")) {
        fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
        debug(chalkInfo("DEFAULT_OFFLINE_MODE: FULL PATH " + fullPath));
      }

      console.log(chalkLog(getTimeStamp()
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
          console.log(chalkLog(getTimeStamp()
            + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
          ));

          if (file.match(/\.json$/gi)) {

            let payload = data.fileBinary;

            if (!payload || (payload === undefined)) {
              console.log(chalkError("ERROR JSON PARSE"));
              return reject(new Error(" LOAD FILE PAYLOAD UNDEFINED"));
            }

            const fileObj = JSONParse(payload);

            if (fileObj.value) {
              resolve(fileObj.value);
            }
            else {
              console.log(chalkError("ERROR JSON PARSE"));
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

const cla = require("command-line-args");
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitNow = { name: "quitNow", alias: "K", type: Boolean};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};
const targetServer = { name: "targetServer", alias: "t", type: String};

const optionDefinitions = [
  enableStdin, 
  quitNow, 
  quitOnError, 
  quitOnComplete, 
  testMode,
  targetServer
];

const commandLineConfig = cla(optionDefinitions);
console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer === "LOCAL") {
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}

if (commandLineConfig.targetServer === "REMOTE") {
  commandLineConfig.targetServer = "https://word.threeceelabs.com/util";
}


function loadCommandLineArgs(){

  return new Promise(function(resolve, reject){

    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.each(commandLineConfigKeys, function(arg, cb){

      configuration[arg] = commandLineConfig[arg];

      console.log(" | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);

      cb();

    }, function(){

      statsObj.commandLineArgsLoaded = true;

      resolve(commandLineConfig);

    });

  });
}

let dropboxClient;

if (configuration.offlineMode) {
  dropboxClient = dropboxLocalClient;
}
else {
  dropboxClient = dropboxRemoteClient;
}

function getFileMetadata(path, file) {

  return new Promise(async function(resolve, reject){

    const fullPath = path + "/" + file;
    debug(chalkInfo("FOLDER " + path));
    debug(chalkInfo("FILE " + file));
    debug(chalkInfo("getFileMetadata FULL PATH: " + fullPath));

    if (configuration.offlineMode) {
      dropboxClient = dropboxLocalClient;
    }
    else {
      dropboxClient = dropboxRemoteClient;
    }

    try {

      const response = await dropboxClient.filesGetMetadata({path: fullPath});
      debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      return resolve(response);

    } 
    catch (err) {

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError(" | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
      }
      if (err.status === 0) {
        console.error(chalkError(" | !!! DROPBOX NO RESPONSE"));
      }

      return reject(err);
    }


  });

}

function loadConfigFile(folder, file) {

  return new Promise(async function(resolve, reject){

    if (file === dropboxConfigDefaultFile) {
      prevConfigFileModifiedMoment = moment(prevDefaultConfigFileModifiedMoment);
    }
    else {
      prevConfigFileModifiedMoment = moment(prevHostConfigFileModifiedMoment);
    }

    if (configuration.offlineMode) {
      resolve(null);
    }
    else {

      const fullPath = folder + "/" + file;

      const fileMetadata = await getFileMetadata(folder, file);

      const fileModifiedMoment = moment(new Date(fileMetadata.client_modified));
    
      if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

        console.log(chalkInfo(" | CONFIG FILE BEFORE OR EQUAL"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));

        resolve(null);
      }
      else {

        console.log(chalkAlert(" | +++ CONFIG FILE AFTER ... LOADING"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));

        prevConfigFileModifiedMoment = moment(fileModifiedMoment);

        if (file === dropboxConfigDefaultFile) {
          prevDefaultConfigFileModifiedMoment = moment(fileModifiedMoment);
        }
        else {
          prevHostConfigFileModifiedMoment = moment(fileModifiedMoment);
        }

        try {

          const loadedConfigObj = await loadFile(folder, file);

          console.log(chalkInfo(" | LOADED CONFIG FILE: " + file + "\n" + jsonPrint(loadedConfigObj)));

          let newConfiguration = {};

          if (loadedConfigObj._UTIL_TARGET_SERVER !== undefined) {
            console.log("LOADED _UTIL_TARGET_SERVER: " + loadedConfigObj._UTIL_TARGET_SERVER);
            newConfiguration.targetServer = loadedConfigObj._UTIL_TARGET_SERVER;
          }

          if (newConfiguration.testMode) {
            newConfiguration.fetchAllIntervalTime = TEST_MODE_FETCH_ALL_INTERVAL;
            console.log(chalkAlert("TEST MODE | fetchAllIntervalTime: " + newConfiguration.fetchAllIntervalTime));
          }

          if (loadedConfigObj._TEST_MODE !== undefined) {
            console.log("LOADED _TEST_MODE: " + loadedConfigObj._TEST_MODE);
            newConfiguration.testMode = loadedConfigObj._TEST_MODE;
          }

          if (loadedConfigObj._QUIT_ON_COMPLETE !== undefined) {
            console.log("LOADED _QUIT_ON_COMPLETE: " + loadedConfigObj._QUIT_ON_COMPLETE);
            if ((loadedConfigObj._QUIT_ON_COMPLETE === true) || (loadedConfigObj._QUIT_ON_COMPLETE === "true")) {
              newConfiguration.quitOnComplete = true;
            }
            if ((loadedConfigObj._QUIT_ON_COMPLETE === false) || (loadedConfigObj._QUIT_ON_COMPLETE === "false")) {
              newConfiguration.quitOnComplete = false;
            }
          }

          if (loadedConfigObj._VERBOSE !== undefined) {
            console.log("LOADED _VERBOSE: " + loadedConfigObj._VERBOSE);
            if ((loadedConfigObj._VERBOSE === true) || (loadedConfigObj._VERBOSE === "true")) {
              newConfiguration.verbose = true;
            }
            if ((loadedConfigObj._VERBOSE === false) || (loadedConfigObj._VERBOSE === "false")) {
              newConfiguration.verbose = false;
            }
          }

          if (loadedConfigObj._KEEPALIVE_INTERVAL !== undefined) {
            console.log("LOADED _KEEPALIVE_INTERVAL: " + loadedConfigObj._KEEPALIVE_INTERVAL);
            newConfiguration.keepaliveInterval = loadedConfigObj._KEEPALIVE_INTERVAL;
          }

          resolve(newConfiguration);

        }

        catch (err) {
          console.log(chalkError("*** LOAD FILE ERR: " + err));
          return reject(err);
        }

      }

    }
  });
}

function loadAllConfigFiles(){

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD CONFIG";

    const defaultConfig = await loadConfigFile(dropboxConfigDefaultFolder, dropboxConfigDefaultFile);
    if (defaultConfig) {
      console.log(chalkAlert(" | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
    }

    defaultConfiguration = defaultConfig;


    const hostConfig = await loadConfigFile(dropboxConfigHostFolder, dropboxConfigHostFile);
    if (hostConfig) {
      console.log(chalkAlert(" | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
    }

    hostConfiguration = hostConfig;

    const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
    const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

    configuration = tempConfig;

    resolve(configuration);

  });
}

function connectDb(){

  return new Promise(async function(resolve, reject){

    statsObj.status = "CONNECT DB";

    wordAssoDb.connect(DEFAULT_PROCESS_PREFIX + "_" + process.pid, function(err, db){

      if (err) {
        console.log(chalkError("***  | MONGO DB CONNECTION ERROR: " + err));
        dbConnectionReady = false;
        return reject(err);
      }

      db.on("error", function(){
        console.error.bind(console, DEFAULT_PROCESS_PREFIX + " | *** MONGO DB CONNECTION ERROR ***\n");
        console.log(chalkError(DEFAULT_PROCESS_PREFIX + " | *** MONGO DB CONNECTION ERROR ***\n"));
        db.close();
        dbConnectionReady = false;
      });

      db.on("disconnected", function(){
        console.error.bind(console, DEFAULT_PROCESS_PREFIX + " | *** MONGO DB DISCONNECTED ***\n");
        console.log(chalkError(DEFAULT_PROCESS_PREFIX + " | *** MONGO DISCONNECTED ***\n"));
        dbConnectionReady = false;
      });

      console.log(chalk.green(DEFAULT_PROCESS_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

      dbConnectionReady = true;

      resolve(db);

    });

  });
}

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog("--------------------------------------------------------\n"
    + "<< FSM MAIN >>"
    + " | " + getTimeStamp()
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n--------------------------------------------------------"
  ));
}


function fsmEvent(event, delay){

  if (delay === "random") { delay = randomInt(0,15)}

  console.log(chalkAlert(">Q FSM EVENT " + event 
    + " | DELAY: " + delay + " SECS"
    + " | NOW " + getTimeStamp() 
    + " | FIRES AT " + moment().add(delay, "s").format(compactDateTimeFormat)
  ));

  setTimeout(function(){

    console.log(chalkAlert("-> FSM EVENT " + event + " | DELAY: " + delay + " SECS"));

    fsmMain[event]();

  }, delay*1000);

}

const fsmStates = {

  "RESET":{

    onEnter: function(event, oldState, newState) { 
      reporter(event, oldState, newState); 
      // fsmEvent("fsm_idle", "random");
    },

    fsm_tick: function() {
    },

    "fsm_init": "INIT",
    "fsm_idle": "IDLE"
  },

  "IDLE":{
    onEnter: function(event, oldState, newState) { 
      reporter(event, oldState, newState);
      fsmEvent("fsm_init", "random");
    },

    fsm_tick: function() {
    },
    "fsm_init": "INIT",
    "fsm_error": "ERROR"
  },

  "ERROR":{
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);
      fsmEvent("fsm_reset", "random");
    },
    "fsm_reset": "RESET"
  },

  "INIT":{
    onEnter: function(event, oldState, newState) { 
      reporter(event, oldState, newState); 
      fsmEvent("fsm_ready", "random");
    },
    fsm_tick: function() {
    },
    "fsm_idle": "IDLE",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY":{
    onEnter: function(event, oldState, newState) { 
      reporter(event, oldState, newState); 
      fsmEvent("fsm_idle", "random");
    },
    fsm_tick: function() {
    },
    "fsm_idle": "IDLE",
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

};

fsmMain = Stately.machine(fsmStates);

function initFsmTickInterval(interval) {
  console.log(chalkInfo("INIT FSM TICK INTERVAL | " + msToTime(interval)));
  clearInterval(fsmTickInterval);
  fsmTickInterval = setInterval(function() {
    statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
    fsmMain.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

reporter("START", "---", fsmMain.getMachineState());

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
    clearInterval(statsUpdateInterval);
    setTimeout(function() {
      console.log(chalkAlert("QUITTING"));
      quit("SHUTDOWN");
    }, 1000);
  }
});

function showStats(options) {

  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));
  }
  else {

    console.log(chalkLog(DEFAULT_PROCESS_PREFIX
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

function saveFile (params, callback){

  let fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (params.localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats();
    console.log(chalkBlue(" | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 })
    .then(function() {

      console.log(chalkBlue(" | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(err){
      console.trace(chalkError(" | " + moment().format(compactDateTimeFormat) 
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
        debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
        if (callback !== undefined) { return callback(null); }
      })
      .catch(function(err){
        if (err.status === 413){
          console.error(chalkError(" | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else if (err.status === 429){
          console.error(chalkError(" | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else if (err.status === 500){
          console.error(chalkError(" | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else {
          console.trace(chalkError(" | " + moment().format(compactDateTimeFormat) 
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

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          // + " | CURSOR (trunc): " + response.cursor.substr(-10)
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkInfo(" | DROPBOX FILE"
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
            console.log(chalkAlert(" | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert(" | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError(" | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError(" | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initSaveFileQueue() {

  console.log(chalkBlue(DEFAULT_PROCESS_PREFIX + " | INIT DROPBOX SAVE FILE INTERVAL | " + configuration.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError(" | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog(" | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
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
    userObj.timeStamp = moment().valueOf();
    userObj.stats.elapsed = statsObj.elapsed;

    statsObjSmall = pick(statsObj, statsPickArray);

    if (configuration.verbose) {
      debug(chalkInfo("TX KEEPALIVE"
        + " | " + userObj.userId
        + " | " + moment().format(compactDateTimeFormat)
      ));
    }

    socket.emit(
      "SESSION_KEEPALIVE", 
      {
        user: userObj, 
        stats: statsObjSmall,
        status: statsObj.status
      }
    );

    callback(null);
  }
  else {
    console.log(chalkError("!!!! CANNOT TX KEEPALIVE"
      + " | " + userObj.userId
      + " | CONNECTED: " + statsObj.serverConnected
      + " | READY ACK: " + statsObj.userAuthenticated
      + " | " + moment().format(compactDateTimeFormat)
    ));
    callback("ERROR");
  }
}

function initKeepalive(interval) {

  clearInterval(socketKeepAliveInterval);

  console.log(chalkConnect("START KEEPALIVE"
    + " | " + getTimeStamp()
    + " | READY ACK: " + statsObj.userAuthenticated
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  sendKeepAlive(function(err) {
    if (err) {
      console.log(chalkError("KEEPALIVE ERROR: " + err));
    }
    else if (configuration.verbose) {
      console.log(chalkLog("T> KEEPALIVE | " + moment().format(compactDateTimeFormat)));
    }
  });

  socketKeepAliveInterval = setInterval(function() { // TX KEEPALIVE

    // updateStatsObjSmall();

    sendKeepAlive(function(err) {
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      else if (configuration.verbose) {
        console.log(chalkLog("T> KEEPALIVE | " + moment().format(compactDateTimeFormat)));
      }
    });

  }, interval);
}

let userReadyInterval;

function initUserReadyInterval(interval) {

  console.log(chalkInfo("INIT USER READY INTERVAL"));

  clearInterval(userReadyInterval);

  userReadyInterval = setInterval(function() {

    if (statsObj.serverConnected && !statsObj.userReadyTransmitted && !statsObj.userReadyAck) {

      statsObj.userReadyTransmitted = moment().valueOf();
      userObj.timeStamp = moment().valueOf();

      socket.emit("USER_READY", {userId: userObj.userId, timeStamp: moment().valueOf()});
    }
    else if (statsObj.userReadyTransmitted && !statsObj.userReadyAck) {

      statsObj.userReadyTransmittedElapsed = moment().valueOf() - statsObj.userReadyTransmitted;

      if (statsObj.userReadyTransmittedElapsed > USER_READY_ACK_TIMEOUT) {

        console.log(chalkAlert("USER_READY_ACK_TIMEOUT | RETRANSMIT USER_READY"
          + " | NOW: " + moment().format(compactDateTimeFormat) 
          + " | TXD: " + moment(statsObj.userReadyTransmitted).format(compactDateTimeFormat) 
          + " | AGO: " + msToTime(moment().valueOf() - statsObj.userReadyTransmitted)
          + " | TIMEOUT: " + msToTime(USER_READY_ACK_TIMEOUT)
        ));

        statsObj.userReadyTransmitted = moment().valueOf();
        userObj.timeStamp = moment().valueOf();

        socket.emit("USER_READY", {userId: userObj.userId, timeStamp: moment().valueOf()});
      }
      else {
        console.log(chalkAlert("WAITING FOR USER_READY_ACK ..."
          + " | NOW: " + moment().format(compactDateTimeFormat) 
          + " | TXD: " + moment(statsObj.userReadyTransmitted).format(compactDateTimeFormat) 
          + " | AGO: " + msToTime(moment().valueOf() - statsObj.userReadyTransmitted)
          + " | TIMEOUT: " + msToTime(USER_READY_ACK_TIMEOUT)
        ));
      }

    }
  }, interval);
}

async function initSocket() {

  if (DEFAULT_OFFLINE_MODE) {
    console.log(chalkError("*** OFFLINE MODE *** "));
    return reject("OFFLINE MODE")
  }

  console.log(chalkLog("INIT SOCKET"
    + " | " + configuration.targetServer
    + "\nUSER\n" + jsonPrint(userObj)
  ));

  socket = require("socket.io-client")(configuration.targetServer, { reconnection: true });

  socket.on("connect", function() {

    statsObj.socketId = socket.id ;
    statsObj.serverConnected = true ;

    console.log(chalkConnect("SOCKET CONNECT | " + socket.id + " ... AUTHENTICATE ..."));

    socket.emit("authentication", { namespace: "util", userId: userObj.userId, password: "0123456789" });
  });

  socket.on("unauthorized", function(err) {
    console.log(chalkError("*** AUTHENTICATION ERROR: ", err.message));
    statsObj.userAuthenticated = false ;
  });

  socket.on("authenticated", function() {

    statsObj.serverConnected = true ;

    console.log("AUTHENTICATED | " + socket.id);

    statsObj.socketId = socket.id;

    console.log(chalkConnect( "CONNECTED TO HOST"
      + " | SERVER: " + configuration.targetServer
      + " | ID: " + socket.id
    ));

    userObj.timeStamp = moment().valueOf();

    console.log(chalkInfo(socket.id
      + " | TX USER_READY"
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + userObj.userId
      + " | " + userObj.url
      + " | " + userObj.screenName
      + " | " + userObj.type
      // + " | " + userObj.mode
      + "\nTAGS\n" + jsonPrint(userObj.tags)
    ));

    statsObj.userAuthenticated = true ;

    initKeepalive(configuration.keepaliveInterval);

    initUserReadyInterval(5000);
  });

  socket.on("disconnect", function(reason) {

    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false;
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;

    console.log(chalkAlert(moment().format(compactDateTimeFormat)
      + " | SOCKET DISCONNECT: " + statsObj.socketId
      + " | REASON: " + reason
    ));
  });

  socket.on("reconnect", function(reason) {

    statsObj.serverConnected = true;

    console.log(chalkInfo("RECONNECT"
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + socket.id
      + " | REASON: " + reason
    ));
  });

  socket.on("USER_READY_ACK", function(userObj) {

    statsObj.userReadyAck = true ;
    statsObj.serverConnected = true;

    console.log(chalkBlue("RX USER_READY_ACK MESSAGE"
      + " | " + socket.id
      + " | USER ID: " + userObj.userId
      + " | " + moment().format(compactDateTimeFormat)
    ));
  });

  socket.on("error", function(err) {
    console.log(chalkError(moment().format(compactDateTimeFormat)
      + " | *** SOCKET ERROR"
      + " | " + socket.id
      + " | " + err
    ));
  });

  socket.on("connect_error", function(err) {

    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;

    console.log(chalkError("*** CONNECT ERROR "
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
    ));
  });

  socket.on("reconnect_error", function(err) {

    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    statsObj.userReadyTransmitted = false;
    statsObj.userReadyAck = false ;

    console.log(chalkError("*** RECONNECT ERROR "
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
    ));
  });

  socket.on("HEARTBEAT", function() {
    statsObj.serverConnected = true;
    statsObj.heartbeatsReceived += 1;
    if (configuration.verbose) { console.log(chalkLog("R< HEARTBEAT [" + statsObj.heartbeatsReceived + "]")); }
  });

  // socket.on("KEEPALIVE_ACK", function(userId) {
  //   statsObj.serverConnected = true;
  //   if (configuration.verbose) { console.log(chalkLog("RX KEEPALIVE_ACK | " + userId)); }
  // });

}

function initStatsUpdate(callback) {

  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

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

  console.log(chalkAlert("VERBOSE: " + configuration.verbose));

}

function initStdIn() {
  console.log("STDIN ENABLED");
  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", function( key ) {
    switch (key) {
      case "a":
        abortCursor = true;
        console.log(chalkAlert("ABORT: " + abortCursor));
      break;

      case "K":
        quit({force: true});
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

      case "v":
        toggleVerbose();
      break;

      default:
        console.log(chalkInfo(
          "\n" + "q/Q: quit"
          + "\n" + "s: showStats"
          + "\n" + "S: showStats verbose"
          + "\n" + "v: toggle verbose"
        ));
    }
  });
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INITIALIZE";

    if (debug.enabled) {
      console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env._PROCESS_NAME || DEFAULT_PROCESS_NAME;
    cnf.targetServer = process.env._UTIL_TARGET_SERVER || DEFAULT_LOCAL_TARGET_SERVER;
    cnf.testMode = (process.env._TEST_MODE === "true") ? true : cnf.testMode;


    if (cnf.testMode) {
      console.log(chalkAlert("TEST MODE"));
    }

    cnf.quitOnError = process.env._QUIT_ON_ERROR || false ;

    if (process.env._QUIT_ON_COMPLETE === "false") {
      cnf.quitOnComplete = false;
    }
    else if ((process.env._QUIT_ON_COMPLETE === true) || (process.env._QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    cnf.enableStdin = process.env._ENABLE_STDIN || true ;

    cnf.statsUpdateIntervalTime = process.env._STATS_UPDATE_INTERVAL || ONE_MINUTE;

    let allConfigLoaded = await loadAllConfigFiles();
    let commandLineConfigLoaded = await loadCommandLineArgs();

    statsObj.commandLineArgsLoaded = true;

    if (configuration.enableStdin) { initStdIn(); }

    initStatsUpdate();

    resolve(configuration);
  });

}

function startFsmMain(){
  console.log(chalkBlue("+++ START FSM MAIN | " + getTimeStamp()));
  fsmMain.fsm_init();
}

initConfig(configuration)
  .then(async function(cnf){
    configuration = deepcopy(cnf);

    console.log(chalkTwitter(configuration.processName
      + " STARTED " + getTimeStamp()
    ));


    initSaveFileQueue();

    initSocket();

    console.log(chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(configuration)));

    dbConnectionReadyInterval = setInterval(function() {

      if (dbConnectionReady) {
        clearInterval(dbConnectionReadyInterval);
      }
      else {
        console.log(chalkAlert("... WAIT DB CONNECTED ..."));
      }
    }, 1000);


    let dbConnection;

    try {

      global.dbConnection = await connectDb();

      UserServerController = require("@threeceelabs/user-server-controller");
      userServerController = new UserServerController(DEFAULT_PROCESS_PREFIX + "_USC");

      userServerControllerReady = false;

      userServerController.on("ready", function(appname){
        userServerControllerReady = true;
        console.log(chalkAlert("USC READY | " + appname));
      });

      NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
      User = mongoose.model("User", userModel.UserSchema);

      dbConnectionReady = true;

      startFsmMain();

    } 
    catch (err) {

      dbConnectionReady = false;
      console.log(chalkError("*** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit("MONGO DB CONNECT ERROR");

    }

  })
  .catch(function(err){
    console.log(chalkError("***** INIT CONFIG ERROR ***** ", err));
    quit();
  });