 /*jslint node: true */
/*jshint sub:true*/
"use strict";

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const FSM_TICK_INTERVAL = ONE_SECOND;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

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
const debug = require("debug")("TMP");
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

DEFAULT_CONFIGURATION.hostname = os.hostname();
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.local/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.home/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.at.net/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/.fios-router.home/g, "");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/word0-instance-1/g, "google");
DEFAULT_CONFIGURATION.hostname = DEFAULT_CONFIGURATION.hostname.replace(/word/g, "google");

DEFAULT_CONFIGURATION.processName = "template";
DEFAULT_CONFIGURATION.processTitle = "node_template";
DEFAULT_CONFIGURATION.runId = DEFAULT_CONFIGURATION.hostname + "_" + getTimeStamp() + "_" + process.pid;

DEFAULT_CONFIGURATION.configFolder = "/config";
DEFAULT_CONFIGURATION.defaultConfigFolder = "/config/utility/default";
DEFAULT_CONFIGURATION.defaultConfigFile = "default_" + DEFAULT_CONFIGURATION.processName + "Config.json";
DEFAULT_CONFIGURATION.hostConfigFolder = "/config/utility/" + DEFAULT_CONFIGURATION.hostname;
DEFAULT_CONFIGURATION.hostConfigFile = DEFAULT_CONFIGURATION.hostname + "_" + DEFAULT_CONFIGURATION.processName + "Config.json";
DEFAULT_CONFIGURATION.statsFile = DEFAULT_CONFIGURATION.processName + "Stats.json";

DEFAULT_CONFIGURATION.randomEvenDelayMin = 10; // seconds
DEFAULT_CONFIGURATION.randomEvenDelayMax = 20; // seconds

DEFAULT_CONFIGURATION.offlineMode = false;
DEFAULT_CONFIGURATION.quitOnComplete = false;
DEFAULT_CONFIGURATION.testMode = false;

DEFAULT_CONFIGURATION.processPrefix = "TMP";

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
DEFAULT_CONFIGURATION.twitter.threeceeUser = "altthreecee00";
DEFAULT_CONFIGURATION.twitter.folder = DEFAULT_CONFIGURATION.configFolder + "/twitter";
DEFAULT_CONFIGURATION.twitter.file = DEFAULT_CONFIGURATION.twitter.threeceeUser + ".json";
DEFAULT_CONFIGURATION.twitter.user = "altthreecee00";
DEFAULT_CONFIGURATION.twitter.consumerKey = false;
DEFAULT_CONFIGURATION.twitter.consumerSecret = false;
DEFAULT_CONFIGURATION.twitter.accessToken = false;
DEFAULT_CONFIGURATION.twitter.accessTokenSecret = false;

DEFAULT_CONFIGURATION.fsm = {};
DEFAULT_CONFIGURATION.fsm.fsmTickInterval = ONE_SECOND;

DEFAULT_CONFIGURATION.dropbox = {};
DEFAULT_CONFIGURATION.dropbox.listFolderLimit = 50;
DEFAULT_CONFIGURATION.dropbox.timeout = 30 * ONE_SECOND;
DEFAULT_CONFIGURATION.dropbox.accessToken = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
DEFAULT_CONFIGURATION.dropbox.appKey = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
DEFAULT_CONFIGURATION.dropbox.appSecret = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
DEFAULT_CONFIGURATION.dropbox.maxSaveNormal = 20 * ONE_MEGABYTE;
DEFAULT_CONFIGURATION.dropbox.configFolder = process.env.DROPBOX_CONFIG_FILE || DEFAULT_CONFIGURATION.configFolder;
DEFAULT_CONFIGURATION.dropbox.configFile = process.env.DROPBOX_CONFIG_FILE || DEFAULT_CONFIGURATION.configFile;
DEFAULT_CONFIGURATION.dropbox.statsFile = process.env.DROPBOX_STATS_FILE || DEFAULT_CONFIGURATION.statsFile;

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
DEFAULT_CONFIGURATION.child.sourceFile = "templateChild.js";
DEFAULT_CONFIGURATION.child.db = {};
DEFAULT_CONFIGURATION.child.db = DEFAULT_CONFIGURATION.db;
DEFAULT_CONFIGURATION.child.dropbox = {};
DEFAULT_CONFIGURATION.child.dropbox = DEFAULT_CONFIGURATION.dropbox;
DEFAULT_CONFIGURATION.child.twitter = {};
DEFAULT_CONFIGURATION.child.twitter = DEFAULT_CONFIGURATION.twitter;
DEFAULT_CONFIGURATION.child.fetchCount = 100;
DEFAULT_CONFIGURATION.child.childIdPrefix = DEFAULT_CONFIGURATION.processTitle + "_CH";
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
let child = null;

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

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
statsObj.children.numChildren = 0;

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

const jsonPrint = function (obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

function initDropbox(cfg){

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
        configuration.child.dropbox.accessToken = config.accessToken;
      }

      statsObj.status = "INIT DROPBOX OK";
    }
    catch (err) {
      console.log(chalkError("ERR INIT DROPBOX: " + err));
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
      console.log(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
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

        slack.api("chat.postMessage", {text: "SLACK INIT", channel: channel }, function(err, response){
          if (err) {
            reject(err);
          }
          resolve(slack);
        });

      });

    }
    catch (err) {
      console.log(chalkError("*** ERROR INIT SLACK: " + err));
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
      console.log(chalkAlert(configuration.processPrefix + " | RESET"));
      resolve("RESET");
    }, 1000);

  });
}

async function quit(options) {

  console.log(chalkAlert( configuration.processPrefix + " | QUITTING ..." ));

  let forceQuitFlag = false;

  if (options) { 
    console.log(chalkAlert("TMP | QUIT OPTIONS\n" + jsonPrint(options) ));
    forceQuitFlag = options.force || false;
  }

  statsObj.quitFlag = true;

  statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  statsObj.timeStamp = moment().format(compactDateTimeFormat);
  statsObj.status = "QUIT";

  const caller = callerId.getData();

  console.log(chalkAlert("TMP | *** QUIT ***\n" + jsonPrint(caller) ));

  await reset("QUIT");


  if (slack) {    
    let slackText = "\n*QUIT*";
    slackText = slackText + "\nFORCE QUIT:  " + forceQuitFlag;
    slackText = slackText + "\nHOST:        " + configuration.hostname;
    slackText = slackText + "\nTITLE:       " + configuration.processTitle;
    slackText = slackText + "\nNAME:        " + configuration.processName;
    slackText = slackText + "\nSTART:       " + statsObj.startTimeMoment.format(compactDateTimeFormat);
    slackText = slackText + "\nELPSD:       " + msToTime(statsObj.elapsed);

    console.log(chalkAlert( configuration.processPrefix + " | SLACK TEXT: " + slackText));

    slackPostMessage({ text: slackText });
  }

  if (global.dbConnection) {
    global.dbConnection.close(function () {
      console.log(chalkAlert(
        "\nTMP ==========================\n"
        + "TMP MONGO DB CONNECTION CLOSED"
        + "\nTMP ==========================\n"
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

    console.log(chalkInfo("LOAD FOLDER " + path));
    console.log(chalkInfo("LOAD FILE " + file));
    console.log(chalkInfo("FULL PATH " + path + "/" + file));

    let fullPath = path + "/" + file;

    if (configuration.offlineMode) {

      if ((configuration.hostname === "macpro2") || (configuration.hostname === "mbp2")) {
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
  commandLineConfig.targetServer = configuration.socket.localTargetServer;
}

if (commandLineConfig.targetServer === "REMOTE") {
  commandLineConfig.targetServer = configuration.socket.remoteTargetServer;
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

function getFileMetadata(folder, file) {

  return new Promise(async function(resolve, reject){

    const fullPath = folder + "/" + file;
    debug(chalkInfo("FOLDER " + folder));
    debug(chalkInfo("FILE " + file));
    // console.log(chalkInfo("getFileMetadata FULL PATH: " + fullPath));

    try {

      const response = await dropboxClient.filesGetMetadata({path: fullPath});

      debug(chalkInfo("FILE META\n" + jsonPrint(response)));

      resolve(response);

    } 
    catch (err) {

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError("*** DROPBOX GET FILE METADATA | " + fullPath + " NOT FOUND"));
      }
      if (err.status === 0) {
        console.error(chalkError("*** DROPBOX GET FILE METADATA | NO RESPONSE"));
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
        resolve(null);
      }
      else {

        const fullPath = folder + "/" + file;

        const fileMetadata = await getFileMetadata(folder, file);

        const fileModifiedMoment = moment(new Date(fileMetadata.client_modified));
      
        if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

          console.log(chalkInfo("TMP | CONFIG FILE BEFORE OR EQUAL"
            + " | " + fullPath
            + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
            + " | " + fileModifiedMoment.format(compactDateTimeFormat)
          ));

          resolve(null);
        }
        else {

          console.log(chalkLog("TMP | +++ CONFIG FILE AFTER ... LOADING"
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

            console.log(chalkInfo("TMP | LOADED CONFIG FILE: " + file + "\n" + jsonPrint(loadedConfigObj)));

            let newConfiguration = {};
            newConfiguration.socket = {};

            if (loadedConfigObj.UTIL_TARGET_SERVER !== undefined) {
              console.log("LOADED _UTIL_TARGET_SERVER: " + loadedConfigObj.UTIL_TARGET_SERVER);
              newConfiguration.socket.targetServer = loadedConfigObj.UTIL_TARGET_SERVER;
            }

            if (newConfiguration.testMode) {
              newConfiguration.fetchAllIntervalTime = TEST_MODE_FETCH_ALL_INTERVAL;
              console.log(chalkAlert("TMP | TEST MODE | fetchAllIntervalTime: " + newConfiguration.fetchAllIntervalTime));
            }

            if (loadedConfigObj.TEST_MODE !== undefined) {
              console.log("TMP | LOADED TEST_MODE: " + loadedConfigObj.TEST_MODE);
              newConfiguration.testMode = loadedConfigObj.TEST_MODE;
            }

            if (loadedConfigObj.QUIT_ON_COMPLETE !== undefined) {
              console.log("TMP | LOADED QUIT_ON_COMPLETE: " + loadedConfigObj.QUIT_ON_COMPLETE);
              if ((loadedConfigObj.QUIT_ON_COMPLETE === true) || (loadedConfigObj.QUIT_ON_COMPLETE === "true")) {
                newConfiguration.quitOnComplete = true;
              }
              if ((loadedConfigObj.QUIT_ON_COMPLETE === false) || (loadedConfigObj.QUIT_ON_COMPLETE === "false")) {
                newConfiguration.quitOnComplete = false;
              }
            }

            if (loadedConfigObj.VERBOSE !== undefined) {
              console.log("TMP | LOADED VERBOSE: " + loadedConfigObj.VERBOSE);
              if ((loadedConfigObj.VERBOSE === true) || (loadedConfigObj.VERBOSE === "true")) {
                newConfiguration.verbose = true;
              }
              if ((loadedConfigObj.VERBOSE === false) || (loadedConfigObj.VERBOSE === "false")) {
                newConfiguration.verbose = false;
              }
            }

            if (loadedConfigObj.KEEPALIVE_INTERVAL !== undefined) {
              console.log("TMP | LOADED KEEPALIVE_INTERVAL: " + loadedConfigObj.KEEPALIVE_INTERVAL);
              newConfiguration.keepaliveInterval = loadedConfigObj.KEEPALIVE_INTERVAL;
            }

            if (loadedConfigObj.TWITTER_USER !== undefined) {
              console.log("TMP | LOADED TWITTER_USER: " + loadedConfigObj.TWITTER_USER);
              newConfiguration.twitter.user = loadedConfigObj.TWITTER_USER;
            }

            resolve(newConfiguration);

          }

          catch (err) {
            console.log(chalkError("TMP | *** LOAD FILE ERR: " + err));
            return reject(err);
          }

        }
      }
    }
    catch (err) {
      console.log(chalkError("TMP | *** LOAD CONFIG FILE ERROR", err));
      reject(err);
    }
  });
}

function loadAllConfigFiles(){

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD CONFIG";

    console.log(chalkInfo("TMP | LOAD ALL DEFAULT " + configuration.defaultConfigFolder + "/" + configuration.defaultConfigFile));


    async.parallel({

      loadedDefaultConfig: function(cb){

        loadConfigFile(configuration.defaultConfigFolder, configuration.defaultConfigFile)
          .then(function(defaultConfig){
            defaultConfiguration = defaultConfig;
          })
          .catch(function(err){
            return cb();
          });

        cb();

      },

      loadedHostConfig: function(cb){

        loadConfigFile(configuration.hostConfigFolder, configuration.hostConfigFile)
          .then(function(hostConfig){
            hostConfiguration = hostConfig;
          })
          .catch(function(err){
            return cb();
          });

        cb();

      },

    },
    function(err, results){
      if (err) {
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
          "\nTMP | ==========================\n"
          + "TMP | MONGO DB CONNECTION CLOSED"
          + "\nTMP | ==========================\n"
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

  console.log(chalkBlue("TMP | --------------------------------------------------------\n"
    + "TMP | << FSM MAIN >>"
    + " | " + getTimeStamp()
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\nTMP | --------------------------------------------------------"
  ));
}

function fsmEvent(event, delay){

  if (delay === "random") { delay = randomInt(configuration.randomEvenDelayMin,configuration.randomEvenDelayMax); }

  // console.log(chalkLog("TMP | >Q FSM EVENT " + event 
  //   + " | DELAY: " + delay + " SECS"
  //   + " | NOW " + getTimeStamp() 
  //   + " | FIRES AT " + moment().add(delay, "s").format(compactDateTimeFormat)
  // ));

  setTimeout(function(){

    console.log(chalkLog("TMP | -> FSM EVENT " + event + " | DELAY: " + delay + " SECS"));

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

        fsmEvent("fsm_idle", "random");
      }
    },

    fsm_tick: function() {
    },

    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_pause": "PAUSE",
    "fsm_idle": "IDLE"
  },

  "IDLE":{
    onEnter: function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        fsmEvent("fsm_init", "random");
      }
    },

    fsm_tick: function() {
    },
    "fsm_init": "INIT",
    "fsm_error": "ERROR"
  },

  "ERROR":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        fsmEvent("fsm_reset", "random");
      }
    },
    "fsm_run_complete": "RUN_COMPLETE",
    "fsm_reset": "RESET"
  },

  "INIT":{
    onEnter: async function(event, oldState, newState) { 
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState); 

        try {

          global.dbConnection = await initDb(configuration.db);
          socket = await initSocket(configuration.socket);
          slack = await initSlack(configuration.slack);
          twit = await initTwitter(configuration.twitter);


          if (Object.keys(childHashMap).length < 10) {

            configuration.child.childId = configuration.child.childIdPrefix + statsObj.children.childIndex;
            configuration.child.db = configuration.db;
            configuration.child.dropbox = configuration.dropbox;
            configuration.child.twitter = configuration.twitter;

            console.log("TMP | INIT configuration.child\n" + jsonPrint(configuration.child));

            child = await initChild(configuration.child);

            statsObj.children.childIndex += 1;
          }

          fsmEvent("fsm_ready", "random");
        }
        catch(err){
          console.log(chalkError("TMP | *** ERROR\n" + jsonPrint(err)));
          fsmEvent("fsm_error", 1);
        }
      }

    },
    fsm_tick: function() {
    },
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
        fsmEvent("fsm_run", "random");
      }
    },
    fsm_tick: function() {
    },
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
        fsmEventOR(["fsm_pause", "fsm_error", "fsm_run_complete"], "random");
      }
    },
    fsm_tick: function() {
    },
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
        fsmEventOR(["fsm_run", "fsm_error", "fsm_run_complete"], "random");
      }
    },
    fsm_tick: function() {
    },
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
        fsmEvent("fsm_save", "random");
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
        fsmEventOR(["fsm_init", "fsm_run", "fsm_pause", "fsm_error", "fsm_run_complete"], "random");
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

  console.log(chalkInfo("TMP | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    statsObj.fetchCycleElapsed = moment().diff(statsObj.fetchCycleStartMoment);
    fsmMain.fsm_tick();
  }, interval);

}

reporter("TMP | START", "---", fsmMain.getMachineState());

console.log("\n\nTMP =================================");
console.log("TMP | HOST:          " + configuration.hostname);
console.log("TMP | PROCESS TITLE: " + configuration.processTitle);
console.log("TMP | PROCESS ID:    " + process.pid);
console.log("TMP | RUN ID:        " + configuration.runId);
console.log("TMP | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("TMP =================================");

process.on("exit", function() {
});

process.on("message", function(msg) {
  if ((msg === "SIGINT") || (msg === "shutdown")) {
    clearInterval(statsUpdateInterval);
    setTimeout(function() {
      console.log(chalkAlert("TMP | QUITTING"));
      quit("SHUTDOWN");
    }, 1000);
  }
});

function showStats(options) {

  statsObj.children.numChildren = Object.keys(childHashMap).length;

  if (options) {
    console.log("TMP | STATS\n" + jsonPrint(statsObj));
  }
  else {

    console.log(chalkLog("TMP"
      + " | FSM: " + fsmMain.getMachineState()
      + " | " + statsObj.children.numChildren + " CHILDREN"
      + " | SERVER CONNECTED: " + statsObj.serverConnected
      + " | AUTHENTICATED: " + statsObj.userAuthenticated
      + " | READY TXD: " + statsObj.userReadyTransmitted
      + " | READY ACK: " + statsObj.userReadyAck
      + " | N: " + getTimeStamp()
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
    console.log(chalkBlue("TMP | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 })
    .then(function() {

      console.log(chalkBlue("TMP | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(err){
      console.trace(chalkError("TMP | " + moment().format(compactDateTimeFormat) 
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
          console.error(chalkError("TMP | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(err); }
        }
        else if (err.status === 429){
          console.error(chalkError("TMP | " + moment().format(compactDateTimeFormat) 
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
          console.trace(chalkError("TMP | " + moment().format(compactDateTimeFormat) 
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

        debug(chalkLog("TMP | DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          // + " | CURSOR (trunc): " + response.cursor.substr(-10)
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkInfo("TMP | DROPBOX FILE"
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
            console.log(chalkError("TMP | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert("TMP | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert("TMP | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError("TMP | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError("TMP | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initSaveFileQueue() {

  console.log(chalkBlue("TMP | INIT DROPBOX SAVE FILE INTERVAL | " + configuration.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError("TMP | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("TMP | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
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
      debug(chalkInfo("TMP | TX KEEPALIVE"
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
    console.log(chalkError("TMP | !!!! CANNOT TX KEEPALIVE"
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

  console.log(chalkConnect("TMP | START KEEPALIVE"
    + " | " + getTimeStamp()
    + " | READY ACK: " + statsObj.userAuthenticated
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  sendKeepAlive(function(err) {
    if (err) {
      console.log(chalkError("TMP | KEEPALIVE ERROR: " + err));
    }
    else if (configuration.verbose) {
      console.log(chalkLog("TMP | T> KEEPALIVE | " + moment().format(compactDateTimeFormat)));
    }
  });

  socketKeepAliveInterval = setInterval(function() { // TX KEEPALIVE

    // updateStatsObjSmall();

    sendKeepAlive(function(err) {
      if (err) {
        console.log(chalkError("TMP | KEEPALIVE ERROR: " + err));
      }
      else if (configuration.verbose) {
        console.log(chalkLog("TMP | T> KEEPALIVE | " + moment().format(compactDateTimeFormat)));
      }
    });

  }, interval);
}

let userReadyInterval;

function initUserReadyInterval(interval) {

  console.log(chalkInfo("TMP | INIT USER READY INTERVAL"));

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

        console.log(chalkAlert("TMP | USER_READY_ACK_TIMEOUT | RETRANSMIT USER_READY"
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
        console.log(chalkAlert("TMP | WAITING FOR USER_READY_ACK ..."
          + " | NOW: " + moment().format(compactDateTimeFormat) 
          + " | TXD: " + moment(statsObj.userReadyTransmitted).format(compactDateTimeFormat) 
          + " | AGO: " + msToTime(moment().valueOf() - statsObj.userReadyTransmitted)
          + " | TIMEOUT: " + msToTime(USER_READY_ACK_TIMEOUT)
        ));
      }

    }
  }, interval);
}

function initChild(config) {

  console.log(chalkAlert("initChild CONFIG\n" + jsonPrint(config)));

  return new Promise(async function (resolve, reject){

    if (config.sourceFile === undefined) {
      console.log(chalkError("TMP | *** INIT CHILD ERROR | SOURCE FILE USER"));
      return reject(new Error("TMP | SOURCE FILE UNDEFINED"));
    }

    if (childHashMap[config.childId]) {
      console.log(chalkAlert("TMP | *** INIT CHILD ERROR | CHILD EXISTS ... SENDING INIT ..."));

      const initObj = {
        op: "INIT",
        childId: config.childId,
        threeceeUser: config.threeceeUser,
        twitterConfig: config.twitter
      };

      childHashMap[config.childId].child.send(initObj, function(err) {
        if (err) {
          console.log(chalkError("TMP | *** CHILD SEND INIT ERROR"
            + " | CHILD ID: " + config.childId
            + " | @" + config.threeceeUser
            + " | ERR: " + err
          ));
          return reject(childHashMap[config.childId].child);
        }
        return resolve(childHashMap[config.childId].child);
      });
    }

    const user = config.threeceeUser || "altthreecee00";
    const fetchCount = config.fetchCount || configuration.child.fetchCount || 100;

    const childId = config.childId;

    console.log(chalkLog("TMP | +++ NEW CHILD | ID: " + childId));

    statsObj.status = "INIT CHILD | " + childId ;

    let childEnv = {};
    childEnv.env = {};
    childEnv.env.CHILD_ID = childId;
    childEnv.env.THREECEE_USER = user;
    childEnv.env.DEFAULT_FETCH_COUNT = fetchCount;
    childEnv.env.TEST_MODE_TOTAL_FETCH = 20;
    childEnv.env.TEST_MODE_FETCH_COUNT = 10;
    childEnv.env.TEST_MODE = (config.testMode) ? 1 : 0;

    Object.keys(config.twitter).forEach(function(key){
      childEnv.env["twitter_" + key] = config.twitter[key];
    });

    Object.keys(config.dropbox).forEach(function(key){
      childEnv.env["dropbox_" + key] = config.dropbox[key];
    });

    childEnv.env.TWITTER = {};
    childEnv.env.TWITTER = config.twitter;

    childEnv.env.DROPBOX = {};
    childEnv.env.DROPBOX = config.dropbox;

    childHashMap[childId] = {};
    childHashMap[childId].childId = childId;
    childHashMap[childId].threeceeUser = user;
    childHashMap[childId].child = {};
    childHashMap[childId].status = "IDLE";
    childHashMap[childId].statsObj = {};

    if (config.twitter !== undefined) {

      childHashMap[childId].twitter = {};
      childHashMap[childId].twitter = config.twitter;

    }

    try {

      const tmpChild = cp.fork(config.sourceFile, [], childEnv );

      childHashMap[childId].child = tmpChild;

      let slackText = "";

      childHashMap[childId].child.on("message", function(m) {

        debug(chalkAlert("TMP | R< tmpChild | " + m.childId + " | " + m.op));

        switch(m.op) {

          case "ERROR":

            console.log(chalkError("TMP | CHILD ERROR | " + m.childId + " | TYPE: " + m.type));

            if (m.error) { 
              console.log(chalkError("TMP | CHILD ERROR\n" + jsonPrint(m.error))); 
            }

            childHashMap[m.childId].status = "ERROR";

            if (m.type === "INVALID_TOKEN") {
              disableChild({childId: m.childId}, function(err){
                childHashMap[m.childId].status = "DISABLED";
              });
            }
            else {
              // initChild({childId: m.childId}, function(err){
              //   checkChildrenState(m.op);
              // });
            }
          break;

          case "INIT":
          case "INIT_COMPLETE":
            console.log(chalkTwitter("R< TMP | CHILD INIT COMPLETE | " + m.childId));
            childHashMap[m.childId].status = "INIT";
            checkChildrenState(m.op);
          break;
     
          case "IDLE":
            console.log(chalkTwitter("R< TMP | CHILD IDLE | " + m.childId));
            childHashMap[m.childId].status = "IDLE";
            checkChildrenState(m.op);
          break;

          case "RESET":
            console.log(chalkTwitter("R< TMP | CHILD RESET | " + m.childId));
            childHashMap[m.childId].status = "RESET";
            checkChildrenState(m.op);
          break;

          case "READY":
            console.log(chalkTwitter("R< TMP | CHILD READY | " + m.childId));
            childHashMap[m.childId].status = "READY";
            checkChildrenState(m.op);
          break;

          case "FETCH":
            console.log(chalkTwitter("R< TMP | CHILD FETCH | " + m.childId));
            childHashMap[m.childId].status = "FETCH";
            checkChildrenState(m.op);
          break;

          case "FETCH_END":
            console.log(chalkTwitter("R< TMP | CHILD FETCH_END | " + m.childId));
            childHashMap[m.childId].status = "FETCH_END";
            checkChildrenState(m.op);
          break;

          case "PAUSE_RATE_LIMIT":
            console.log(chalkTwitter("R< TMP | CHILD PAUSE_RATE_LIMIT | " + m.childId));
            childHashMap[m.childId].status = "PAUSE_RATE_LIMIT";
            checkChildrenState(m.op);
          break;

          case "THREECEE_USER":

            console.log(chalkTwitter("R< TMP | THREECEE_USER"
              + " | @" + m.childId.screenName
              + " | Ts: " + m.childId.statusesCount
              + " | FRNDs: " + m.childId.friendsCount
              + " | FLWRs: " + m.childId.followersCount
            ));

            statsObj.user[m.threeceeUser].statusesCount = m.childId.statusesCount;
            statsObj.user[m.threeceeUser].friendsCount = m.childId.friendsCount;
            statsObj.user[m.threeceeUser].followersCount = m.childId.followersCount;

            statsObj.users.totalFriendsCount = 0;

            Object.keys(statsObj.user).forEach(function(tcUser) {

              if ((statsObj.user[tcUser] !== undefined) 
                && (statsObj.user[tcUser].friendsCount !== undefined)
                && (childHashMap[tcUser].status !== "DISABLED")
                && (childHashMap[tcUser].status !== "ERROR")
                && (childHashMap[tcUser].status !== "RESET")
              ) { 
                statsObj.users.totalFriendsCount += statsObj.user[tcUser].friendsCount;
              }

            });

          break;

          case "FRIENDS_IDS":
            twitterUserHashMap[m.childId].friends = new Set(m.friendsIds);
            console.log(chalkTwitter("R< TMP | FRIENDS_IDS"
              + " | 3C: @" + m.childId
              + " | " + twitterUserHashMap[m.childId].friends.size + " FRIENDS"
            ));
          break;

          case "FRIEND_RAW":
            if (configuration.testMode) {
              console.log(chalkInfo("R< TMP | FRIEND"
                + " | FOLLOW: " + m.follow
                + " | 3C: @" + m.childId
                + " | @" + m.friend.screen_name
              ));
            }

            processUserQueue.unshift(m);

            if (m.follow) {
              slackText = "\n*FOLLOW | 3C @" + m.childId + " > <http://twitter.com/" + m.friend.screen_name 
              + "|" + " @" + m.friend.screen_name + ">*";
              console.log("TMP | SLACK TEXT: " + slackText);
              slackPostMessage(slackChannel, slackText);
            }

          break;

          case "UNFOLLOWED":

            console.log(chalkInfo("R< TMP | CHILD UNFOLLOWED"
              + " | " + m.childId
              + " | UID: " + m.user.id_str
              + " | @" + m.user.screen_name
              + " | FLWRs: " + m.user.followers_count
              + " | FRNDs: " + m.user.friends_count
              + " | Ts: " + m.user.statuses_count
            ));

            slackText = "\n*UNFOLLOW | 3C @" + m.childId + " > <http://twitter.com/" + m.user.screen_name 
            + "|" + " @" + m.user.screen_name + ">*";
            console.log("TMP | SLACK TEXT: " + slackText);
            slackPostMessage(slackChannel, slackText);

          break;

          case "STATS":

            m.statsObj.startTimeMoment = getTimeStamp(m.statsObj.startTimeMoment);
            m.statsObj.fetchAllIntervalStartMoment = getTimeStamp(m.statsObj.fetchAllIntervalStartMoment);

            childHashMap[m.childId].status = m.statsObj.fsmState;
            childHashMap[m.childId].statsObj = m.statsObj;

            if (configuration.verbose) {
              console.log(chalkInfo("R< TMP | CHILD STATS"
                + " | " + m.childId
                + " | " + getTimeStamp() + " ___________________________\n"
                + jsonPrint(m.statsObj, "TMP | STATS ")
                + "\nTMP | CHILD STATS___________________________"
              ));
            }

          break;

          default:
            console.log(chalkError("R< TMP | CHILD " + m.childId + " | UNKNOWN OP: " + m.op));
            reject(new Error("UNKNOWN OP" + m.op + " | CH ID: " + m.childId));
        }
      });

      childHashMap[childId].child.on("error", function(err) {

        if (childHashMap[childId]) {

          console.log(chalkError("*** CHILD ERROR | @" + user + " ERROR *** : " + err));

          childHashMap[childId].status = "ERROR";

          if (!quitFlag) {

            console.log(chalkAlert(">>> RE-INIT ON ERROR | @" + user + " ..."));

            initTwitter(user, function(err, twitObj) {
              if (err) {
                console.log(chalkError("INIT TWITTER ERROR: " + err.message));
                quit("INIT TWITTER ON CHILD ERROR @" + user);
                return;
              }

              console.log(chalkAlert("+++ RE-INITIALIZED ON ERROR @" + user));

            });
          }
        }
      });

      childHashMap[childId].child.on("exit", function(err) {
        if (childHashMap[childId]) {
          childHashMap[childId].status = "EXIT";
        }
        console.log(chalkError("*** childHashMap " + childId + " EXIT *** : " + err));
      });

      childHashMap[childId].child.on("close", function(code) {
        if (childHashMap[childId]) {
          childHashMap[childId].status = "CLOSE";
     
           if (!quitFlag && configuration.reinitializeChildOnClose) {

            console.log(chalkAlert(">>> RE-INIT ON CLOSE | @" + user + " ..."));

            initTwitter(user, function(err, twitObj) {
              if (err) {
                console.log(chalkError("INIT TWITTER ERROR: " + err.message));
                quit("INIT TWITTER ON CHILD ERROR @" + user);
                return;
              }

              console.log(chalkAlert("+++ RE-INITIALIZED ON CLOSE @" + user));

            });
          }
        }
        console.log(chalkError("*** childHashMap " + childId + " CLOSE *** : " + code));
      });

       if (configuration.verbose) { console.log(chalkBlue("+++ NEW CHILD\nchildEnv\n" + jsonPrint(childEnv))); }

      resolve(childHashMap[childId].child);

    }
    catch (err) {
      console.log(chalkError("*** ERROR INIT CHILD: " + err));
      statsObj.db.err = err;
      statsObj.status = "INIT CHILD ERROR";
      reject(err);
    }

  });
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
          console.log(chalkError("***  | MONGO DB CONNECTION ERROR | " + name + " | " + err));
          statsObj.db.connected = false;
          return reject(err);
        }

        db.on("error", function(){
          console.log(chalkError(name + " | *** MONGO DB CONNECTION ERROR ***\n"));
          db.close();
          statsObj.db.connected = false;
        });

        db.on("disconnected", function(){
          console.log(chalkAlert("TMP | " + name + " | *** MONGO DISCONNECTED ***\n"));
          statsObj.db.connected = false;
        });

        console.log(chalk.green("TMP | " + name + " | MONGOOSE DEFAULT CONNECTION OPEN"));

        User = mongoose.model("User", userModel.UserSchema);
        Hashtag = mongoose.model("Hashtag", hashtagModel.HashtagSchema);
        NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);

        async.parallel({
          countUsers: function(cb){
            User.countDocuments({}, function (err, count) {
              if (err) {
                console.log(chalkError("TMP | " + "*** ERROR INIT DB | COUNT USERS: " + err));
                return cb(err);
              }
              console.log(chalkLog("TMP | " + count + " USERS"));
              cb();
            });
          },
          countHashtags: function(cb){
            Hashtag.countDocuments({}, function (err, count) {
              if (err) {
                console.log(chalkError("*** ERROR INIT DB | COUNT HASHTAGS: " + err));
                return cb(err);
              }
              console.log(chalkLog("TMP | " + count + " HASHTAGS"));
              cb();
            });
          },
          countNeuralNetworks: function(cb){
            NeuralNetwork.countDocuments({}, function (err, count) {
              if (err) {
                console.log(chalkError("*** ERROR INIT DB | COUNT NEURAL NETWORKS: " + err));
                return cb(err);
              }
              console.log(chalkLog("TMP | " + count + " NEURAL NETWORKS"));
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
      console.log(chalkError("*** ERROR INIT DB: " + err));
      statsObj.db.err = err;
      statsObj.status = "INIT DB ERROR";
      reject(err);
    }


  });
}

function initSocket(config){

  const user = config.user || configuration.user;
  const targetServer = config.targetServer || configuration.socket.targetServer;
  const reconnection = config.reconnection || configuration.socket.reconnection;

  return new Promise(async function (resolve, reject){

    statsObj.status = "INIT SOCKET";

    if (configuration.offlineMode) {
      console.log(chalkError("TMP | *** INIT SOCKET | OFFLINE MODE *** "));
      return reject(new Error("OFFLINE MODE"));
    }

    if (socket && socket.id) {
      console.log(chalkAlert("TMP | !!! INIT SOCKET | DISCONNECT EXISTING SOCKET CONNECTION | " + socket.id));
      socket.disconnect();
      socket = null;
    }

    let s = null;

    try {

      console.log(chalkLog("TMP | INIT SOCKET"
        + " | " + targetServer
        + " | USER: " + user.userId
        + " | RECONNECTION: " + reconnection
      ));

      s = require("socket.io-client")(targetServer, { reconnection: reconnection });

      s.on("connect", function() {

        statsObj.socketId = s.id ;
        statsObj.serverConnected = true ;

        console.log(chalkConnect("TMP | SOCKET CONNECT | " + s.id + " ... AUTHENTICATE ..."));

        s.emit("authentication", { namespace: "util", userId: user.userId, password: "0123456789" });
      });

      s.on("unauthorized", function(err) {
        console.log(chalkError("TMP | *** AUTHENTICATION ERROR: ", err.message));
        statsObj.userAuthenticated = false ;
      });

      s.on("authenticated", function() {

        statsObj.serverConnected = true ;

        console.log("TMP | SOCKET AUTHENTICATED | " + s.id);

        statsObj.socketId = socket.id;

        console.log(chalkConnect("TMP | SOCKET CONNECTED TO SERVER"
          + " | SERVER: " + configuration.socket.targetServer
          + " | ID: " + s.id
        ));

        user.timeStamp = moment().valueOf();

        console.log(chalkInfo("TMP | T> USER_READY"
          + " | " + s.id
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + user.userId
          + " | " + user.url
          + " | " + user.screenName
          + " | " + user.type
          // + " | " + user.mode
          // + "\nTAGS\n" + jsonPrint(user.tags)
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

        console.log(chalkAlert("TMP | " + moment().format(compactDateTimeFormat)
          + " | SOCKET DISCONNECT: " + statsObj.socketId
          + " | REASON: " + reason
        ));
      });

      s.on("reconnect", function(reason) {

        statsObj.serverConnected = true;

        console.log(chalkInfo("TMP | SOCKET RECONNECT"
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + s.id
          + " | REASON: " + reason
        ));
      });

      s.on("USER_READY_ACK", function(user) {

        statsObj.userReadyAck = true ;
        statsObj.serverConnected = true;

        console.log(chalkBlue("TMP | R< USER_READY_ACK MESSAGE"
          + " | " + s.id
          + " | USER ID: " + user.userId
          + " | " + moment().format(compactDateTimeFormat)
        ));
      });

      s.on("error", function(err) {
        console.log(chalkError("TMP | " + moment().format(compactDateTimeFormat)
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

        console.log(chalkError("TMP | *** SOCKET CONNECT ERROR "
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

        console.log(chalkError("TMP | *** SOCKET RECONNECT ERROR "
          + " | " + moment().format(compactDateTimeFormat)
          + " | " + err.type
          + " | " + err.description
        ));
      });

      s.on("HEARTBEAT", function() {
        statsObj.serverConnected = true;
        statsObj.heartbeatsReceived += 1;
        if (configuration.verbose) { console.log(chalkLog("TMP | R< HEARTBEAT [" + statsObj.heartbeatsReceived + "]")); }
      });

      resolve(s);

    }
    catch (err) {
      console.log(chalkError("TMP | *** ERROR INIT SOCKET: " + err));
      statsObj.status = "INIT SOCKET ERROR";
      reject(err);
    }


  });
}

function initTwitter(config){

  // console.log("initTwitter config\n" + jsonPrint(config));

  const user = config.user || configuration.twitter.user;
  const folder = config.folder || configuration.twitter.folder;
  const file = config.file || configuration.twitter.file;

  return new Promise(async function (resolve, reject){

    statsObj.status = "INIT TWITTER";

    if (configuration.offlineMode) {
      console.log(chalkError("*** INIT TWITTER | OFFLINE MODE *** "));
      return reject(new Error("OFFLINE MODE"));
    }

    if (twit && config.reinit) {
      console.log(chalkAlert("TMP | !!! INIT TWITTER | DISCONNECT EXISTING TWITTER CONNECTION"));
      // twit.disconnect();
      twit = null;
    }
    else if (twit) {
      return resolve(twit);
    }

    let t = null;

    try {

      const loadedConfig = await loadFile(folder, file);

      // console.log("initTwitter loadedConfig\n" + jsonPrint(loadedConfig));

      console.log(chalkLog("TMP | INIT TWITTER"));

      configuration.twitter.consumerKey = loadedConfig.consumer_key;
      configuration.twitter.consumerSecret = loadedConfig.consumer_secret;
      configuration.twitter.accessToken = loadedConfig.access_token;
      configuration.twitter.accessTokenSecret = loadedConfig.access_token_secret;

      // if (configuration.child.twitter === undefined) { configuration.child.twitter = {}; }
      configuration.child.twitter = configuration.twitter;

      // console.log("initTwitter configuration.child.twitter\n" + jsonPrint(configuration.child.twitter));

      t = new Twit({
        consumer_key: loadedConfig.consumer_key,
        consumer_secret: loadedConfig.consumer_secret,
        access_token: loadedConfig.access_token,
        access_token_secret: loadedConfig.access_token_secret
      });

      t.get("account/verify_credentials", { skip_status: true })
        .catch(function (err) {
          console.log(chalkError("TMP | INIT TWITTER ERROR", err.stack));
          reject(err);
        })
        .then(function (result) {
          // `result` is an Object with keys "data" and "resp".
          // `data` and `resp` are the same objects as the ones passed
          // to the callback.
          // See https://github.com/ttezel/twit#tgetpath-params-callback
          // for details.
       
          // console.log(chalkLog("TMP | INIT TWITTER RESULTS\n" + jsonPrint(result.data)));
          resolve(t);
        });
    }
    catch (err) {
      console.log(chalkError("TMP | *** ERROR INIT TWITTER: " + err));
      statsObj.status = "INIT TWITTER ERROR";
      reject(err);
    }


  });
}

function initStatsUpdate(callback) {

  console.log(chalkTwitter("TMP | INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

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

  console.log(chalkAlert("TMP | VERBOSE: " + configuration.verbose));
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
        console.log(chalkAlert("TMP | ABORT: " + abortCursor));
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

    try {

      statsObj.status = "INITIALIZE";

      if (debug.enabled) {
        console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
      }

      cnf.processName = process.env.PROCESS_NAME || DEFAULT_CONFIGURATION.processName;
      cnf.targetServer = process.env.UTIL_TARGET_SERVER || DEFAULT_CONFIGURATION.targetServer;
      cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;


      if (cnf.testMode) {
        console.log(chalkAlert("TMP | TEST MODE"));
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
      let commandLineConfigLoaded = await loadCommandLineArgs();

      statsObj.commandLineArgsLoaded = true;

      if (configuration.enableStdin) { initStdIn(); }

      configuration.child.db = configuration.db;
      configuration.child.dropbox = configuration.dropbox;
      configuration.child.twitter = configuration.twitter;

      // console.log("initConfig configuration.child.twitter\n" + jsonPrint(configuration.child.twitter));

      resolve(configuration);

    }
    catch (err) {
      console.log(chalkError("TMP | *** ERROR INIT CONFIG: " + err));
      statsObj.status = "INIT CONFIG ERROR";
      reject(err);
    }
  });
}

function startFsmMain(){
  initFsmTickInterval(FSM_TICK_INTERVAL)
  console.log(chalkBlue("TMP | +++ START FSM MAIN | " + getTimeStamp()));
  fsmEvent("fsm_reset", "random");
}

initConfig(configuration)
  .then(async function(cnf){
    configuration = deepcopy(cnf);

    console.log(chalkTwitter(configuration.processName
      + " STARTED " + getTimeStamp()
    ));

    startFsmMain();

  })
  .catch(function(err){
    console.log(chalkError("TMP | ***** INIT CONFIG ERROR ***** ", err));
    quit();
  });