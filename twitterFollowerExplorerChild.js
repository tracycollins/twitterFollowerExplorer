 /*jslint node: true */
/*jshint sub:true*/
"use strict";

const TEST_MODE = false; // applies only to parent

const MODULE_NAME = "tfcChild";
const MODULE_ID_PREFIX = "TFC";

const DEFAULT_INPUTS_BINARY_MODE = true;

const DEFAULT_FETCH_COUNT = 200;
const TEST_FETCH_COUNT = 27;
const TEST_TOTAL_FETCH = 747;


const DEFAULT_TWEET_FETCH_COUNT = 50;
const TEST_TWEET_FETCH_COUNT = 3;
const DEFAULT_TWEET_FETCH_EXCLUDE_REPLIES = true;
const DEFAULT_TWEET_FETCH_INCLUDE_RETWEETS = false;


const OFFLINE_MODE = false;
const QUIT_ON_COMPLETE = false;
let quitOnCompleteFlag = false;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const FETCH_USER_INTERVAL = 5 * ONE_MINUTE;
const TEST_FETCH_USER_INTERVAL = 15 * ONE_SECOND;

const KEEPALIVE_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = ONE_SECOND;
const STATS_UPDATE_INTERVAL = 30*ONE_SECOND;

const SAVE_CACHE_DEFAULT_TTL = 60;
const SAVE_FILE_QUEUE_INTERVAL = ONE_SECOND;
const FSM_TICK_INTERVAL = ONE_SECOND;

const DROPBOX_MAX_SAVE_NORMAL = 20 * ONE_MEGABYTE;
const DROPBOX_LIST_FOLDER_LIMIT = 50;
const DROPBOX_TIMEOUT = 30 * ONE_SECOND;

//=========================================================================
// MODULE REQUIRES
//=========================================================================
const os = require("os");
const Twit = require("twit");
const _ = require("lodash");
const moment = require("moment");
const defaults = require("object.defaults");
const pick = require("object.pick");
const treeify = require("treeify");
const objectPath = require("object-path");
const NodeCache = require("node-cache");
const merge = require("deepmerge");
const arrayNormalize = require("array-normalize");

const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

const fs = require("fs");
const JSONParse = require("json-parse-safe");
const debug = require("debug")("tfe");
const util = require("util");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");
const async = require("async");
const omit = require("object.omit");
const HashMap = require("hashmap").HashMap;

const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkGreen = chalk.green;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

//=========================================================================
// HOST
//=========================================================================

let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const MODULE_ID = MODULE_ID_PREFIX + "_" + hostname;

//=========================================================================
// PROCESS EVENT HANDLERS
//=========================================================================

process.title = MODULE_ID.toLowerCase() + "_node_" + process.pid;

process.on("exit", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS EXIT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT EXIT"});
});

process.on("close", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS CLOSE"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT CLOSE"});
});

process.on("disconnect", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS DISCONNECT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  process.exit(1);
});

process.on("SIGHUP", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGHUP"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT SIGHUP"});
});

process.on("SIGINT", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGINT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "PARENT SIGINT"});
});

process.on("unhandledRejection", function(err, promise) {
  console.trace(MODULE_ID_PREFIX + " | *** Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  quit("unhandledRejection");
  process.exit(1);
});

//=========================================================================
// CONFIGURATION
//=========================================================================

let configuration = {};

configuration.threeceeUser = process.env.THREECEE_USER;

configuration.checkRateLimitInterval = 10 * ONE_MINUTE;

configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.testMode = TEST_MODE;
configuration.tweetFetchCount = (TEST_MODE) ? TEST_TWEET_FETCH_COUNT : DEFAULT_TWEET_FETCH_COUNT;
configuration.fetchCount = (TEST_MODE) ? TEST_FETCH_COUNT : DEFAULT_FETCH_COUNT;
configuration.totalFetchCount = (TEST_MODE) ? TEST_TOTAL_FETCH : Infinity;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;
configuration.fsmTickInterval = FSM_TICK_INTERVAL;
configuration.fetchUserInterval = (TEST_MODE) ? TEST_FETCH_USER_INTERVAL : FETCH_USER_INTERVAL;

configuration.slackChannel = {};

configuration.keepaliveInterval = KEEPALIVE_INTERVAL;
configuration.quitOnComplete = QUIT_ON_COMPLETE;

let startTimeMoment = moment();

let statsObj = {};
let statsObjSmall = {};

statsObj.pid = process.pid;
statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();

statsObj.users = {};

statsObj.queues = {};
statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;

statsObj.errors = {};

statsObj.status = "START";

statsObj.threeceeUser = {};
statsObj.threeceeUser.endFetch = false;
statsObj.threeceeUser.nextCursor = false;
statsObj.threeceeUser.nextCursorValid = false;
statsObj.threeceeUser.friendsFetched = 0;

const TWITTER_RATE_LIMIT_RESOURCES = {
  application: ["rate_limit_status"],
  friends: ["ids", "list"],
  statuses: ["user_timeline"],
  users: ["show/:id"]
};


statsObj.threeceeUser.twitterRateLimit = {};
let rateLimitTimeout = {};

Object.keys(TWITTER_RATE_LIMIT_RESOURCES).forEach(function(resource){

  rateLimitTimeout[resource] = {};
  statsObj.threeceeUser.twitterRateLimit[resource] = {};

  TWITTER_RATE_LIMIT_RESOURCES[resource].forEach(function(endPoint){

    rateLimitTimeout[resource][endPoint] = null;

    statsObj.threeceeUser.twitterRateLimit[resource][endPoint] = {};
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit = 0;
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit = 0;
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt = moment();
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag = false;
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining = 0;
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime = 0;
    statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt = moment();
  });

});

statsObj.threeceeUser.friendsCount = 0;
statsObj.threeceeUser.followersCount = 0;
statsObj.threeceeUser.statusesCount = 0;

let statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "error", 
  "elapsedMS", 
  "status"
];

async function showStats(options) {

  statsObj.elapsed = getElapsedTimeStamp();

  statsObjSmall = pick(statsObj, statsPickArray);

  if (options) {
    console.log(MODULE_ID_PREFIX + " | STATS\n" + jsonPrint(statsObjSmall));
  }
  else if (fsm.getMachineState() === "PAUSE_RATE_LIMIT"){

    checkRateLimit({})
    .then(function(){

      debug(chalkLog(MODULE_ID_PREFIX
        + " | TWITTER RATE LIMIT"
        + " | @" + configuration.threeceeUser
        + " | FSM: " + fsm.getMachineState()
        + " | START: " + statsObj.startTime
        + " | ELAPSED: " + statsObj.elapsed
      ));

      Object.keys(TWITTER_RATE_LIMIT_RESOURCES).forEach(function(resource){
        TWITTER_RATE_LIMIT_RESOURCES[resource].forEach(function(endPoint) {
          if (statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag || configuration.verbose) {
            console.log(chalkLog(MODULE_ID_PREFIX
              + " | TWITTER RATE LIMIT"
              + " | @" + configuration.threeceeUser
              + " | FLAG | " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag
              + " | RESOURCE | " + resource
              + " | END POINT | " + endPoint
              + " | FSM: " + fsm.getMachineState()
              + " | START: " + statsObj.startTime
              + " | ELAPSED: " + statsObj.elapsed
              + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
              + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
            ));
          }
        });
      });

    });

  }
  else {
    console.log(chalkLog(MODULE_ID_PREFIX
      + " | STATUS"
      + " | @" + configuration.threeceeUser
      + " | FSM: " + fsm.getMachineState()
      + " | START: " + statsObj.startTime
      + " | NOW: " + getTimeStamp()
      + " | ELAPSED: " + statsObj.elapsed
    ));
  }
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    if (debug.enabled) {
      console.log("\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false ;

    if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    try {

      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      resolve(configuration) ;

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

function init(params){
  return new Promise(async function(resolve, reject){
    statsObj.status = "INIT";
    resolve();
  });
}

//=========================================================================
// MONGO DB
//=========================================================================

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");

global.Emoji;
global.Hashtag;
global.Location;
global.Media;
global.NetworkInputs;
global.NeuralNetwork;
global.Place;
global.Tweet;
global.Url;
global.User;
global.Word;

let dbConnectionReady = false;
let dbConnectionReadyInterval;

let UserServerController;
let userServerController;
let userServerControllerReady = false;

let TweetServerController;
let tweetServerController;
let tweetServerControllerReady = false;

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
let userDbUpdateQueue = [];

function connectDb(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      wordAssoDb.connect(MODULE_ID + "_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
          dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR");
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
          db.close();
          dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED");
          // slackSendMessage(hostname + " | TFE | " + statsObj.status);
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
          dbConnectionReady = false;
          quit({cause: "MONGO DB DISCONNECTED"});
        });


        global.dbConnection = db;

        console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

        const emojiModel = require("@threeceelabs/mongoose-twitter/models/emoji.server.model");
        const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");
        const locationModel = require("@threeceelabs/mongoose-twitter/models/location.server.model");
        const mediaModel = require("@threeceelabs/mongoose-twitter/models/media.server.model");
        const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
        const placeModel = require("@threeceelabs/mongoose-twitter/models/place.server.model");
        const tweetModel = require("@threeceelabs/mongoose-twitter/models/tweet.server.model");
        const urlModel = require("@threeceelabs/mongoose-twitter/models/url.server.model");
        const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
        const wordModel = require("@threeceelabs/mongoose-twitter/models/word.server.model");

        global.Emoji = global.dbConnection.model("Emoji", emojiModel.EmojiSchema);
        global.Hashtag = global.dbConnection.model("Hashtag", hashtagModel.HashtagSchema);
        global.Location = global.dbConnection.model("Location", locationModel.LocationSchema);
        global.Media = global.dbConnection.model("Media", mediaModel.MediaSchema);
        global.NeuralNetwork = global.dbConnection.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
        global.Place = global.dbConnection.model("Place", placeModel.PlaceSchema);
        global.Tweet = global.dbConnection.model("Tweet", tweetModel.TweetSchema);
        global.Url = global.dbConnection.model("Url", urlModel.UrlSchema);
        global.User = global.dbConnection.model("User", userModel.UserSchema);
        global.Word = global.dbConnection.model("Word", wordModel.WordSchema);

        const uscChildName = MODULE_ID_PREFIX + "_USC";
        UserServerController = require("@threeceelabs/user-server-controller");
        userServerController = new UserServerController(uscChildName);

        const tscChildName = MODULE_ID_PREFIX + "_TSC";
        TweetServerController = require("@threeceelabs/tweet-server-controller");
        tweetServerController = new TweetServerController(tscChildName);

        tweetServerController.on("ready", function(appname){
          tweetServerControllerReady = true;
          console.log(chalk.green(MODULE_ID_PREFIX + " | " + tscChildName + " READY | " + appname));
        });

        tweetServerController.on("error", function(err){
          tweetServerControllerReady = false;
          console.trace(chalkError(MODULE_ID_PREFIX + " | *** " + tscChildName + " ERROR | " + err));
        });

        userServerController.on("ready", function(appname){
          userServerControllerReady = true;
          console.log(chalkLog(MODULE_ID_PREFIX + " | " + uscChildName + " READY | " + appname));
        });


        let dbConnectionReadyInterval;

        dbConnectionReadyInterval = setInterval(function(){

          if (userServerControllerReady && tweetServerControllerReady) {

            console.log(chalkGreen(MODULE_ID_PREFIX + " | MONGO DB READY"));

            dbConnectionReady = true;
            clearInterval(dbConnectionReadyInterval);
            statsObj.status = "MONGO DB CONNECTED";
            resolve(db);
          }

        }, 1000);

      });
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
      reject(err);
    }
  });
}
//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================
function jsonPrint(obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
}

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

function delay(params) {

  params = params || {};

  let period = params.period || 10*ONE_SECOND;
  let verbose = params.verbose || false;

  return new Promise(function(resolve, reject){

    if (verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX 
        + " | @" + configuration.threeceeUser
        + " | +++ DELAY START | NOW: " + getTimeStamp() 
        + " | PERIOD: " + msToTime(period)
      ));
    }

    setTimeout(function(){
      if (verbose) {
        console.log(chalkLog(MODULE_ID_PREFIX 
          + " | @" + configuration.threeceeUser
          + " | --- DELAY END | NOW: " + getTimeStamp() 
          + " | PERIOD: " + msToTime(period)
        ));
      }
      resolve();
    }, period);
  });

}

function getElapsed(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return statsObj.elapsedMS;
}

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}
//=========================================================================
// STATS
//=========================================================================


// ==================================================================
// DROPBOX
// ==================================================================
const fetch = require("isomorphic-fetch"); // or another library of choice.
const Dropbox = require("dropbox").Dropbox;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

let statsFolder = "/stats/" + hostname;
let statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

let dropboxRemoteClient = new Dropbox({ 
  accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

let dropboxLocalClient = {  // offline mode
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


function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

    fs.readdir(fullPath, function(err, items){
      if (err) {
        reject(err);
      }
      else {

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
        }
    });
  });
}

function filesGetMetadataLocal(options){

  return new Promise(function(resolve, reject) {

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

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

function loadFile(params) {

  return new Promise(async function(resolve, reject){

    let noErrorNotFound = params.noErrorNotFound || false;

    let fullPath = params.folder + "/" + params.file

    debug(chalkInfo("LOAD FOLDER " + params.folder));
    debug(chalkInfo("LOAD FILE " + params.file));
    debug(chalkInfo("FULL PATH " + fullPath));


    if (configuration.offlineMode || params.loadLocalFile) {

      if (hostname === "google") {
        fullPath = "/home/tc/Dropbox/Apps/wordAssociation/" + fullPath;
        console.log(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
      }

      if ((hostname === "mbp3") || (hostname === "mbp2")) {
        fullPath = "/Users/tc/Dropbox/Apps/wordAssociation/" + fullPath;
        console.log(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
      }

      fs.readFile(fullPath, "utf8", function(err, data) {

        if (err) {
          console.log(chalkError("fs readFile ERROR: " + err));
          return reject(err);
        }

        console.log(chalkInfo(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX"
          + " | " + fullPath
        ));

        if (params.file.match(/\.json$/gi)) {

          const fileObj = JSONParse(data);

          if (fileObj.value) {

            const fileObjSizeMbytes = sizeof(fileObj)/ONE_MEGABYTE;

            console.log(chalkInfo(getTimeStamp()
              + " | LOADED FILE FROM DROPBOX"
              + " | " + fileObjSizeMbytes.toFixed(2) + " MB"
              + " | " + fullPath
            ));

            return resolve(fileObj.value);
          }

          console.log(chalkError(getTimeStamp()
            + " | *** LOAD FILE FROM DROPBOX ERROR"
            + " | " + fullPath
            + " | " + fileObj.error
          ));

          return reject(fileObj.error);

        }

        console.log(chalkError(getTimeStamp()
          + " | ... SKIP LOAD FILE FROM DROPBOX"
          + " | " + fullPath
        ));
        resolve();

      });

     }
    else {

      dropboxClient.filesDownload({path: fullPath})
      .then(function(data) {

        debug(chalkLog(getTimeStamp()
          + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
        ));

        if (params.file.match(/\.json$/gi)) {

          let payload = data.fileBinary;

          if (!payload || (payload === undefined)) {
            return reject(new Error(MODULE_ID_PREFIX + " LOAD FILE PAYLOAD UNDEFINED"));
          }

          const fileObj = JSONParse(payload);

          if (fileObj.value) {
            return resolve(fileObj.value);
          }

          console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX loadFile ERROR: " + fullPath));
          return reject(fileObj.error);
        }
        else {
          resolve();
        }
      })
      .catch(function(err) {

        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX loadFile ERROR: " + fullPath));
        
        if ((err.status === 409) || (err.status === 404)) {
          if (noErrorNotFound) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND"));
            return resolve(new Error("NOT FOUND"));
          }
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** DROPBOX READ FILE " + fullPath + " NOT FOUND ... SKIPPING ..."));
          return resolve(err);
        }
        
        if (err.status === 0) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX NO RESPONSE"
            + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
          return resolve(new Error("NO INTERNET"));
        }

        reject(error);

      });
    }
  });
}

function loadFileRetry(params){

  return new Promise(async function(resolve, reject){

    let resolveOnNotFound = params.resolveOnNotFound || false;
    let maxRetries = params.maxRetries || 5;
    let retryNumber;

    for (retryNumber = 0; retryNumber < maxRetries; retryNumber++) {
      try {
        
        if (retryNumber > 0) { 
          console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD RETRY"
            + " | " + folder + "/" + file
            + " | " + retryNumber + " OF " + maxRetries
          )); 
        }

        const fileObj = await loadFile(params);
        return resolve(fileObj);
        break;
      } 
      catch(err) {
      }
    }

    if (resolveOnNotFound) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | resolve FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
      return resolve(false);
    }
    console.log(chalkError(MODULE_ID_PREFIX + " | reject FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
    reject(new Error("FILE LOAD ERROR | RETRIES " + maxRetries));

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

    dropboxClient.filesGetMetadata({path: fullPath})
    .then(function(response) {
      debug(chalkInfo("FILE META\n" + jsonPrint(response)));
      resolve(response);
    })
    .catch(function(err) {
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

function listDropboxFolder(params){

  return new Promise(function(resolve, reject){

    try{

      statsObj.status = "LIST DROPBOX FOLDER: " + params.folder;

      console.log(chalkNetwork(MODULE_ID_PREFIX + " | LISTING DROPBOX FOLDER | " + params.folder));

      let results = {};
      results.entries = [];

      let cursor;
      let more = false;
      let limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;

      if (configuration.offlineMode) {
        dropboxClient = dropboxLocalClient;
      }
      else {
        dropboxClient = dropboxRemoteClient;
      }

      dropboxClient.filesListFolder({path: params.folder, limit: limit})
      .then(function(response){

        cursor = response.cursor;
        more = response.has_more;
        results.entries = response.entries;

        if (configuration.verbose) {
          console.log(chalkLog("DROPBOX LIST FOLDER"
            + " | FOLDER:" + params.folder
            + " | ENTRIES: " + response.entries.length
            + " | LIMIT: " + limit
            + " | MORE: " + more
          ));
        }

        async.whilst(

          function() {
            return more;
          },

          function(cb){

            setTimeout(function(){

              dropboxClient.filesListFolderContinue({cursor: cursor})
              .then(function(responseCont){

                cursor = responseCont.cursor;
                more = responseCont.has_more;
                results.entries = results.entries.concat(responseCont.entries);

                if (configuration.verbose) {
                  console.log(chalkLog("DROPBOX LIST FOLDER CONT"
                    + " | PATH:" + params.folder
                    + " | ENTRIES: " + responseCont.entries.length + "/" + results.entries.length
                    + " | LIMIT: " + limit
                    + " | MORE: " + more
                  ));
                }

              })
              .catch(function(err){
                console.trace(chalkError("TXX | *** DROPBOX filesListFolderContinue ERROR: ", err));
                return reject(err);
              });

              async.setImmediate(function() { cb(); });

            }, 1000);
          },

          function(err){
            if (err) {
              console.log(chalkError("TXX | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
              return reject(err);
            }
            resolve(results);
          });
      })
      .catch(function(err){
        console.log(chalkError("TXX | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        return reject(err);
      });

    }
    catch(err){
      console.log(chalkError("TXX | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
      return reject(err);
    }

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

      let newConfiguration = {};
      newConfiguration.evolve = {};

      if (loadedConfigObj.TEST_MODE !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED TEST_MODE: " + loadedConfigObj.TEST_MODE);
        if ((loadedConfigObj.TEST_MODE === true) || (loadedConfigObj.TEST_MODE === "true")) {
          newConfiguration.testMode = true;
        }
        if ((loadedConfigObj.TEST_MODE === false) || (loadedConfigObj.TEST_MODE === "false")) {
          newConfiguration.testMode = false;
        }
      }

      if (loadedConfigObj.QUIT_ON_COMPLETE !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED QUIT_ON_COMPLETE: " + loadedConfigObj.QUIT_ON_COMPLETE);
        if ((loadedConfigObj.QUIT_ON_COMPLETE === true) || (loadedConfigObj.QUIT_ON_COMPLETE === "true")) {
          newConfiguration.quitOnComplete = true;
        }
        if ((loadedConfigObj.QUIT_ON_COMPLETE === false) || (loadedConfigObj.QUIT_ON_COMPLETE === "false")) {
          newConfiguration.quitOnComplete = false;
        }
      }

      if (loadedConfigObj.VERBOSE !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED VERBOSE: " + loadedConfigObj.VERBOSE);
        if ((loadedConfigObj.VERBOSE === true) || (loadedConfigObj.VERBOSE === "true")) {
          newConfiguration.verbose = true;
        }
        if ((loadedConfigObj.VERBOSE === false) || (loadedConfigObj.VERBOSE === "false")) {
          newConfiguration.verbose = false;
        }
      }

      if (loadedConfigObj.KEEPALIVE_INTERVAL !== undefined) {
        console.log(MODULE_ID_PREFIX + " | LOADED KEEPALIVE_INTERVAL: " + loadedConfigObj.KEEPALIVE_INTERVAL);
        newConfiguration.keepaliveInterval = loadedConfigObj.KEEPALIVE_INTERVAL;
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
      
      let defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
      let tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

      configuration = tempConfig;

      resolve();

    }
    catch(err){
      reject(err);
    }
  });
}


//=========================================================================
// FILE SAVE
//=========================================================================
let saveFileQueueInterval;
let saveFileQueue = [];
let statsUpdateInterval;

configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;


let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if (saveCacheTtl === undefined) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE CHECK PERIOD: " + saveCacheCheckPeriod + " SECONDS");

const saveCache = new NodeCache({
  stdTTL: saveCacheTtl,
  checkperiod: saveCacheCheckPeriod
});

function saveCacheExpired(file, fileObj) {
  debug(chalkLog("XXX $ SAVE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + file
  ));
  saveFileQueue.push(fileObj);
  statsObj.queues.saveFileQueue.size = saveFileQueue.length;
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj) {
  debug(chalkLog(MODULE_ID_PREFIX + " | $$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));
});

function saveFile(params, callback){

  let fullPath = params.folder + "/" + params.file;
  let limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (params.localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats();
    console.log(chalkBlue(MODULE_ID_PREFIX + " | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 })
    .then(function() {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(error){
      console.trace(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX LOCAL JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + error
        + " | ERROR\n" + jsonPrint(error)
      ));
      if (callback !== undefined) { return callback(error); }
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
      .catch(function(error){
        if (error.status === 413){
          console.error(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.error(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.error(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.trace(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + error
          ));
          if (callback !== undefined) { return callback(error); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: limit})
      .then(function(response){

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkLog(MODULE_ID_PREFIX + " | DROPBOX FILE"
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
            console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function initSaveFileQueue(cnf) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT DROPBOX SAVE FILE INTERVAL | " + msToTime(cnf.saveFileQueueInterval)));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {

      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
          statsObj.queues.saveFileQueue.size = saveFileQueue.length;
        }
        else {
          console.log(chalkLog(MODULE_ID_PREFIX + " | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        statsObj.queues.saveFileQueue.busy = false;
      });

    }
  }, cnf.saveFileQueueInterval);
}


//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals(params){
  return new Promise(function(resolve, reject){
    try {
      [...intervalsSet].forEach(function(intervalHandle){
        clearInterval(intervalHandle);
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================
const DEFAULT_QUIT_ON_COMPLETE = true;

let quitWaitInterval;
let quitFlag = false;

function readyToQuit(params) {
  let flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {

  let options = opts || {};

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  quitFlag = true;

  fsm.fsm_exit();

  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  showStats(true);

  process.send({op:"QUIT", childId: configuration.childId, threeceeUser: configuration.threeceeUser, data: statsObj});

  quitWaitInterval = setInterval(async function() {

    if (readyToQuit()) {

      await clearAllIntervals();

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE ... QUITTING"
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }

      process.exit();
 
    }

  }, QUIT_WAIT_INTERVAL);
};

//=========================================================================
// TWITTER
//=========================================================================
let twitClient;

let threeceeUserDefaults = {};

threeceeUserDefaults.id = 0;
threeceeUserDefaults.name = "---";
threeceeUserDefaults.screenName = configuration.threeceeUser;
threeceeUserDefaults.description = "---";
threeceeUserDefaults.url = "---";
threeceeUserDefaults.friendsCount = 0;
threeceeUserDefaults.followersCount = 0;
threeceeUserDefaults.statusesCount = 0;

threeceeUserDefaults.error = false;

threeceeUserDefaults.tweetFetchCount = configuration.tweetFetchCount;
threeceeUserDefaults.fetchCount = configuration.fetchCount;
threeceeUserDefaults.endFetch = false;
threeceeUserDefaults.nextCursor = false;
threeceeUserDefaults.nextCursorValid = false;
threeceeUserDefaults.friendsFetched = 0;
threeceeUserDefaults.percentFetched = 0;

threeceeUserDefaults.twitterRateLimit = {};

Object.keys(TWITTER_RATE_LIMIT_RESOURCES).forEach(function(resource){

  threeceeUserDefaults.twitterRateLimit[resource] = {};

  TWITTER_RATE_LIMIT_RESOURCES[resource].forEach(function(endPoint) {
    threeceeUserDefaults.twitterRateLimit[resource][endPoint] = {};
    threeceeUserDefaults.twitterRateLimit[resource][endPoint].limit = 0;
    threeceeUserDefaults.twitterRateLimit[resource][endPoint].exceptionAt = moment();
    threeceeUserDefaults.twitterRateLimit[resource][endPoint].exceptionFlag = false;
    threeceeUserDefaults.twitterRateLimit[resource][endPoint].remaining = 0;
    threeceeUserDefaults.twitterRateLimit[resource][endPoint].remainingTime = 0;
    threeceeUserDefaults.twitterRateLimit[resource][endPoint].resetAt = moment();
  });
});

function initTwitter(twitterConfig){

  return new Promise(function(resolve, reject){

    if (!twitClient || (twitClient === undefined)){

      console.log(chalkTwitter("TFC | INITIALIZING TWITTER" 
        + " | " + getTimeStamp() 
        + " | @" + configuration.threeceeUser 
        + "\ntwitterConfig\n" + jsonPrint(twitterConfig)
      ));

      twitClient = new Twit(twitterConfig);

    }
    else {

      console.log(chalkLog("TFC | TWITTER ALREADY INITIALIZED" 
        + " | " + getTimeStamp() 
        + " | @" + configuration.threeceeUser 
        // + "\ntwitterConfig\n" + jsonPrint(twitterConfig)
      ));

      return resolve();
    }

    twitClient.get("account/settings", async function(err, accountSettings, response) {

      if (err){

        if (err.code === 88){

          statsObj.threeceeUser.twitterRateLimit.account.settings.exceptionAt = moment();
          statsObj.threeceeUser.twitterRateLimit.account.settings.exceptionFlag = true;

          fsm.fsm_rateLimitStart();
          return resolve(err);
        }
        else if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER ACCOUNT SETTINGS ERROR | INVALID OR EXPIRED TOKEN" 
            + " | @" + configuration.threeceeUser 
            + " | " + getTimeStamp() 
            + " | ERR CODE: " + err.code
          ));

          statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  
          statsObj.threeceeUser.err = err;

          process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);
        }

        else {

          console.log(chalkError("TFC | *** TWITTER ACCOUNT SETTINGS ERROR"
            + " | @" + configuration.threeceeUser 
            + " | " + getTimeStamp() 
            + " | ERR CODE: " + err.code
            + " | " + err.message
          ));

          fsm.fsm_error();

          return reject(err);

        }
      }

      const userScreenName = accountSettings.screen_name.toLowerCase();

      debug(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: @" + userScreenName));

      try {
        await twitterUserUpdate();
        resolve();
      }
      catch(err){
        err.user = userScreenName;

        if (err.code === 88) {
          return resolve(err);
        }

        console.log(chalkError("TFC | *** TWITTER USER UPDATE ERROR" 
          + " | " + getTimeStamp() 
          + " | @" + userScreenName 
          + "\n" + jsonPrint(err)
        ));

        fsm.fsm_error();

        return reject(err);
      }

    });

  });
}

function resetTwitterUserState(){

  statsObj.threeceeUser.endFetch = false;
  statsObj.threeceeUser.nextCursor = false;
  statsObj.threeceeUser.nextCursorValid = false;
  statsObj.threeceeUser.friendsFetched = 0;
  statsObj.threeceeUser.friendsCount = 0;
  statsObj.threeceeUser.followersCount = 0;
  statsObj.threeceeUser.statusesCount = 0;


  Object.keys(TWITTER_RATE_LIMIT_RESOURCES).forEach(function(resource){

    rateLimitTimeout[resource] = {};

    statsObj.threeceeUser.twitterRateLimit[resource] = {};

    TWITTER_RATE_LIMIT_RESOURCES[resource].forEach(function(endPoint) {

      rateLimitTimeout[resource][endPoint] = {};

      statsObj.threeceeUser.twitterRateLimit[resource][endPoint] = {};
      statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit = 0;
      statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt = moment();
      statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag = false;
      statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining = 0;
      statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime = 0;
      statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt = moment();
    });
  });

}

function fetchUserTweets(params){

  return new Promise(async function(resolve, reject){

    if (!twitClient || (twitClient === undefined)) {
      console.log(chalkAlert("TFC | fetchUserTweets | twitClient UNDEFINED | @" + configuration.threeceeUser));
      return reject(new Error("twitClient UNDEFINED"));
    }

    if (statsObj.threeceeUser.twitterRateLimit.statuses.exceptionFlag) {
      console.log(chalkAlert("TFC | fetchUserTweets | SKIPPING ... RATE LIMIT | RESOURCE: STATUSES | @" + configuration.threeceeUser));
      return resolve([]);
    }

    let fetchUserTweetsParams = {};

    fetchUserTweetsParams.user_id = params.userId;

    if (params.trimUser) { fetchUserTweetsParams.trim_user = params.trimId; } 
    if (params.maxId) { fetchUserTweetsParams.max_id = params.maxId; } 
    if (params.sinceId) { fetchUserTweetsParams.since_id = params.sinceId; } 

    fetchUserTweetsParams.count = params.tweetFetchCount || configuration.tweetFetchCount;
    fetchUserTweetsParams.exclude_replies = params.excludeReplies || DEFAULT_TWEET_FETCH_EXCLUDE_REPLIES;
    fetchUserTweetsParams.include_rts = params.includeRetweets || DEFAULT_TWEET_FETCH_INCLUDE_RETWEETS;


    twitClient.get("statuses/user_timeline", fetchUserTweetsParams, function(err, userTweetsArray, response) {

      if (err){

        console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS ERROR"
          + " | @" + configuration.threeceeUser 
          + " | FETCH USER ID: " + params.userId
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        if (err.code === 88){
          statsObj.threeceeUser.twitterRateLimit.statuses.user_timeline.exceptionAt = moment();
          statsObj.threeceeUser.twitterRateLimit.statuses.user_timeline.exceptionFlag = true;
          fsm.fsm_rateLimitStart();
          return reject(err);
        }

        if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER FETCH USER TWEETS ERROR | INVALID OR EXPIRED TOKEN" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));


          statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

          statsObj.threeceeUser.err = err;

          process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);

        }
        
        return reject(err);

      }

      if (configuration.verbose) {
        console.log(chalkInfo("TFC | +++ FETCHED USER TWEETS" 
          + " [" + userTweetsArray.length + "]"
          + " | @" + configuration.threeceeUser 
          + " | UID " + params.userId
        ));
      }


      resolve(userTweetsArray);

    });

  });
}

function fetchUserFriendsIds(params){

  return new Promise(async function(resolve, reject){

    if (!twitClient || (twitClient === undefined)) {
      console.log(chalkAlert("TFC | fetchUserFriendsIds | twitClient UNDEFINED | @" + configuration.threeceeUser));
      return reject(new Error("twitClient UNDEFINED"));
    }

    if (statsObj.threeceeUser.twitterRateLimit.friends.ids.exceptionFlag) {
      console.log(chalkAlert("TFC | fetchUserFriendsIds | SKIPPING ... RATE LIMIT | @" + configuration.threeceeUser));
      return resolve(null);
    }

    twitClient.get("friends/ids", {screen_name: configuration.threeceeUser}, function(err, userFriendsIds, response) {

      if (err){
        console.log(chalkError("TFC | *** TWITTER USER FRIENDS IDS ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        if (err.code === 88) {
          statsObj.threeceeUser.twitterRateLimit.friends.ids.exceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimit.friends.ids.exceptionAt = moment();
          fsm.fsm_rateLimitStart();
          return resolve();
        }

        if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER USER FRIENDS IDS ERROR | INVALID OR EXPIRED TOKEN" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));

          statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  
          statsObj.threeceeUser.err = err;

          process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);

        }

        return reject(err);
      }

      process.send({op:"FRIENDS_IDS", threeceeUser: configuration.threeceeUser, friendsIds: userFriendsIds.ids});

      statsObj.threeceeUser.nextCursorValid = statsObj.threeceeUser.nextCursorValid || false;
      statsObj.threeceeUser.nextCursor = statsObj.threeceeUser.nextCursor || -1;
      statsObj.threeceeUser.prevCursorValid = statsObj.threeceeUser.prevCursorValid || false;
      statsObj.threeceeUser.prevCursor = statsObj.threeceeUser.prevCursor || -1;

      console.log(chalkLog("TFC | friends/ids"
        + " | @" + configuration.threeceeUser 
        + " | IDs: " + userFriendsIds.ids.length
        + " | PREV CURSOR: " + userFriendsIds.previous_cursor_str
        + " | NEXT CURSOR: " + userFriendsIds.next_cursor_str
      ));

      console.log(chalkTwitterBold("TFC | ====================================================================="
        + "\nTFC | TWITTER USER"
        + " | @" + statsObj.threeceeUser.screenName 
        + " | " + statsObj.threeceeUser.name 
        + "\nTFC | NEXT CURSOR VALID: " + statsObj.threeceeUser.nextCursorValid 
        + " | NEXT CURSOR: " + statsObj.threeceeUser.nextCursor 
        + "\nTFC | Ts: " + statsObj.threeceeUser.statusesCount 
        + " | FLWRs: " + statsObj.threeceeUser.followersCount
        + " | FRNDS: " + statsObj.threeceeUser.friendsCount 
        + " | FRNDS IDs: " + userFriendsIds.ids.length 
        + "\nTFC | ====================================================================="
      ));

      resolve();

    });

  });
}


function twitterUsersShow(params){

  return new Promise(async function(resolve, reject){

    if (!twitClient || (twitClient === undefined)) {
      console.log(chalkAlert("TFC | twitterUsersShow | twitClient UNDEFINED | @" + configuration.threeceeUser));
      return reject(new Error("twitClient UNDEFINED"));
    }

    if (statsObj.threeceeUser.twitterRateLimit.users.exceptionFlag) {
      console.log(chalkAlert("TFC | twitterUsersShow | SKIPPING ... RATE LIMIT | @" + configuration.threeceeUser));
      return resolve(null);
    }

    twitClient.get("users/show", {screen_name: configuration.threeceeUser}, function(err, userShowData, response) {

      if (err){

        console.log(chalkError("TFC | *** TWITTER SHOW USER ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        if (err.code === 88){
          statsObj.threeceeUser.twitterRateLimit.users.show.exceptionAt = moment();
          statsObj.threeceeUser.twitterRateLimit.users.show.exceptionFlag = true;
          fsm.fsm_rateLimitStart();
          return reject(err);
        }

        if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER SHOW USER ERROR | INVALID OR EXPIRED TOKEN" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));


          statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

          statsObj.threeceeUser.err = err;

          process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);

        }
        
        return reject(err);
      }

      statsObj.threeceeUser.id = userShowData.id_str;
      statsObj.threeceeUser.name = (userShowData.name !== undefined) ? userShowData.name : "";
      statsObj.threeceeUser.screenName = (userShowData.screen_name !== undefined) ? userShowData.screen_name.toLowerCase() : "";
      statsObj.threeceeUser.description = userShowData.description;
      statsObj.threeceeUser.url = userShowData.url;
      statsObj.threeceeUser.statusesCount = userShowData.statuses_count;
      statsObj.threeceeUser.friendsCount = userShowData.friends_count;
      statsObj.threeceeUser.followersCount = userShowData.followers_count;
      statsObj.threeceeUser.fetchCount = configuration.fetchCount;
      statsObj.threeceeUser.tweetFetchCount = configuration.tweetFetchCount;

      process.send({op:"THREECEE_USER", childId: configuration.childId, threeceeUser: omit(statsObj.threeceeUser, ["friends"])});

      resolve();

    });

  });
}

function twitterUserUpdate(params){

  return new Promise(async function(resolve, reject){

    if (statsObj.threeceeUser.twitterRateLimit.users.exceptionFlag || statsObj.threeceeUser.twitterRateLimit.friends.exceptionFlag) {
      console.log(chalkAlert("TFC | twitterUserUpdate | SKIPPING ... RATE LIMIT | @" + configuration.threeceeUser));
      return resolve();
    }

    try {
      await twitterUsersShow();
      await fetchUserFriendsIds();
      resolve();
    }
    catch(err){
      console.log(chalkError("TFC | *** TWITTER SHOW USER ERROR"
        + " | @" + configuration.threeceeUser 
        + " | " + getTimeStamp() 
        + " | ERR CODE: " + err.code
        + " | " + err.message
      ));

      if (err.code === 88) {
        return resolve();
      }
      return reject(err);
    }

  });
}

function checkEndPointRateLimit(params){

  return new Promise(async function(resolve, reject){

    const resource = params.resource;
    const endPoint = params.endPoint;
    const dataResources = params.dataResources;
    const key = "/" + resource + "/" + endPoint;

    if (moment().isAfter(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt) 
      || (statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit === statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining))
    {

      clearTimeout(rateLimitTimeout[resource][endPoint]);

      if (statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag) {

        statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag = false;

        console.log(chalkInfo("TFC | XXX RESET TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | RESOURCE: " + resource
          + " | END POINT: " + endPoint
          + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
          + " | EXP: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.format(compactDateTimeFormat)
          + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
        ));

        fsm.fsm_rateLimitEnd();

      }
    }
    else if (dataResources[resource][key].remaining === 0){

      if (!statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag) {
        statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag = true;
      }

      if (statsObj.fsmState !== "PAUSE_RATE_LIMIT"){
        console.log(chalkAlert("TFC | *** TWITTER SHOW USER ERROR | RATE LIMIT EXCEEDED" 
          + " | @" + configuration.threeceeUser
          + " | RESOURCE: " + resource
          + " | END POINT: " + endPoint
          + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
          + " | EXP: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.format(compactDateTimeFormat)
          + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
        ));
        fsm.fsm_rateLimitStart();
      }
      else {
        console.log(chalkLog("TFC | --- TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | RESOURCE: " + resource
          + " | END POINT: " + endPoint
          + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
          + " | EXP: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.format(compactDateTimeFormat)
          + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
        ));
      }
    }
    else if (statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag){

      console.log(chalkLog("TFC | --- TWITTER RATE LIMIT"
        + " | @" + configuration.threeceeUser
        + " | RESOURCE: " + resource
        + " | END POINT: " + endPoint
        + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
        + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
        + " | EXP: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.format(compactDateTimeFormat)
        + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
        + " | NOW: " + moment().format(compactDateTimeFormat)
        + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
      ));
    }
    else {
      if (configuration.verbose) {
        console.log(chalkInfo("TFC | ... NO TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | RESOURCE: " + resource
          + " | END POINT: " + endPoint
          + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
          + " | EXP: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.format(compactDateTimeFormat)
          + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
        ));
      }
    }

    resolve(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag);

  });
}

function checkRateLimit(params){

  return new Promise(async function(resolve, reject){

    if (!twitClient || (twitClient === undefined)) {
      console.log(chalkError("TFC | *** CHECK RATE LIMIT | TWIT CLIENT UNDEFINED"
        + " | @" + configuration.threeceeUser
      ));
      return reject(new Error("TWIT CLIENT UNDEFINED"));
    }

    // "application",
    // "followers",
    // "friends",
    // "friendships",
    // "statuses",
    // "users"

    let results = {};
    results.flags = {};
    results.anyRateLimitFlag = false;

    twitClient.get("application/rate_limit_status", function(err, data, response) {
      
      if (err && (err.code !== 88)){

        statsObj.threeceeUser.twitterErrors+= 1;

        if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER GET RATE LIMIT STATUS ERROR | INVALID OR EXPIRED TOKEN" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));

          statsObj.threeceeUser.err = err;

          process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

        }

        process.send({op:"ERROR", type: "RATE_LIMIT_STATUS", threeceeUser: configuration.threeceeUser, error: err});
        return reject(err);
      }
      else if (err && (err.code === 88)) {

        statsObj.threeceeUser.twitterRateLimit.application.rate_limit_status.exceptionAt = moment();
        statsObj.threeceeUser.twitterRateLimit.application.rate_limit_status.exceptionFlag = true;

        console.log(chalkError("TFC | *** TWITTER ACCOUNT ERROR | APPLICATION RATE LIMIT STATUS"
          + " | @" + configuration.threeceeUser
          + " | " + getTimeStamp()
          + " | CODE: " + err.code
          + " | STATUS CODE: " + err.statusCode
          + " | " + err.message
        ));
      }

      Object.keys(TWITTER_RATE_LIMIT_RESOURCES).forEach(function(resource){

        Object.keys(statsObj.threeceeUser.twitterRateLimit[resource]).forEach(async function(endPoint){

          const key = data.resources[resource]["/" + resource + "/" + endPoint];

          statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit = key.limit;
          statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining = key.remaining;
          statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt = moment.unix(key.reset);
          statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime = moment.unix(key.reset).diff(moment());

          if (configuration.verbose) {

            console.log(chalkLog("TFC | TWITTER RATE LIMIT STATUS"
              + " | @" + configuration.threeceeUser
              + " | RESOURCE: " + resource
              + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
              + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
              + " | EXP: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.format(compactDateTimeFormat)
              + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
            ));
          }

          const flag = await checkEndPointRateLimit({resource: resource, endPoint: endPoint, dataResources: data.resources});

          if (flag) { objectPath.set(results, "flags." + resource + "." + endPoint, flag); }

        });
      });

      resolve(results);
    });

  });
}

let checkRateLimitInterval;

function getTwitterFriendsList(params){

  return new Promise(function(resolve, reject){

    params.count = params.count || params.fetchCount;

    twitClient.get("friends/list", params, function(err, data, response){

      if (err){

        console.log(chalkError("TFC | *** TWITTER GET FRIENDS LIST ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        if (err.code === 88){
          statsObj.threeceeUser.twitterRateLimit.friends.list.exceptionAt = moment();
          statsObj.threeceeUser.twitterRateLimit.friends.list.exceptionFlag = true;
          fsm.fsm_rateLimitStart();
          return reject(err);
        }

        if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER GET FRIENDS LIST ERROR | INVALID OR EXPIRED TOKEN" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));

          statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  
          statsObj.threeceeUser.err = err;

          process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);
        }
        
        process.send({op:"ERROR", threeceeUser: configuration.threeceeUser, error: err});
        return reject(err);
      }

      resolve(data);
    });

  });
}

function checkFriendMinimumProperties(params){

  return new Promise(function(resolve, reject){

    const unfollowFlag = (
      (params.friend.followers_count < configuration.minFollowersCount)
      || (params.friend.statuses_count < configuration.minStatusesCount)
    );

    debug(chalkAlert("checkFriendMinimumProperties"
      + " | UNFOLLOW: " + unfollowFlag
      + " | @" + params.friend.screen_name
      + " | FLWRs: " + params.friend.followers_count
      + " | MIN FLWRs: " + configuration.minFollowersCount
      // + " | FRNDs: " + params.friend.friends_count
      // + " | MIN FRNDs: " + configuration.minFriendsCount
      + " | Ts: " + params.friend.statuses_count
      + " | MIN Ts: " + configuration.minStatusesCount
    ));

    resolve(unfollowFlag);

  });
}


let unfollowQueueInterval;
let unfollowQueueReady = false;
let unfollowQueueIntervalTime = process.env.DEFAULT_UNFOLLOW_QUEUE_INTERVAL || 5*ONE_SECOND;
let unfollowQueue = [];

// function unfollowFriend(params, callback){

//   if (!twitClient || twitClient === undefined) {
//     console.log(chalkAlert("TFC | UNFOLLOW FRIEND | TWIT CLIENT UNDEFINED"
//       + " |  @" + configuration.threeceeUser
//       + " | UID: " + params.user.userId
//       + " | @" + params.user.screenName
//     ));
//     return callback(new Error("TWIT CLIENT UNDEFINED"), null);
//   }

//   let unfollowFriendParams = {};

//   if (params.user.user_id !== undefined) { 
//     unfollowFriendParams.user_id = params.user.user_id;
//   }
//   else if (params.user.userId !== undefined) { 
//     unfollowFriendParams.user_id = params.user.userId;
//   }

//   if (params.user.screen_name !== undefined) { 
//     unfollowFriendParams.screen_name = params.user.screen_name;
//   }
//   else if (params.user.screenName !== undefined) { 
//     unfollowFriendParams.screen_name = params.user.screenName;
//   }

//   if ((unfollowFriendParams.user_id === undefined)
//     && (unfollowFriendParams.screen_name === undefined)
//   ){

//     console.log(chalkAlert("TFC | UNFOLLOW FRIEND"
//       + "\nINVALID PARAMS"
//       + "\n" + jsonPrint(params)
//     ));
//     quit("UNFOLLOW FRIEND | INVALID PARAMS");
//     return callback(null, null);
//   }

//   twitClient.post(

//     "friendships/destroy", unfollowFriendParams, 

//     function destroyFriend(err, data, response){  // if success, data = user

//       if (err) {

//         console.log(chalkError("TFC | *** UNFOLLOW FRIEND ERROR"
//           + " | ERROR: " + err
//           + "\nPARAMS\n" + jsonPrint(unfollowFriendParams)
//         ));

//         return callback(err, unfollowFriendParams);
//       }

//       if (_.isObject(response) 
//         && (response.statusCode !== undefined) 
//         && (response.statusCode !== 200)) {

//         console.log(chalkError("TFC | *** UNFOLLOW FAIL"
//           + " | 3C: @" + configuration.threeceeUser
//           + " | RESPONSE CODE: " + response.statusCode
//           + "\nTFC | PARAMS\n" + jsonPrint(unfollowFriendParams)
//           + "\nTFC | RESPONSE\n" + jsonPrint(response)
//         ));

//         return callback(err, response);
//       }

//       if (data.following) {

//         console.log(chalkAlert("TFC | XXX UNFOLLOW"
//           + " | 3C: @" + configuration.threeceeUser
//           + " | UID: " + data.id_str
//           + " | @" + data.screen_name
//           + " | FLWRs: " + data.followers_count
//           + " | FRNDs: " + data.friends_count
//           + " | Ts: " + data.statuses_count
//           + " | FOLLOWING: " + data.following
//           // + " | RESPONSE CODE: " + response.statusCode
//           // + "\nPARAMS\n" + jsonPrint(unfollowFriendParams)
//           // + "\nDATA\n" + jsonPrint(data)
//         ));

//         process.send(
//           {
//             op:"UNFOLLOWED", 
//             threeceeUser: configuration.threeceeUser, 
//             user: data
//           }
//         );

//         return callback(null, data);
//       }

//       debug(chalkInfo("TFC | miss UNFOLLOW"
//         + " | 3C: @" + configuration.threeceeUser
//         + " | UID: " + unfollowFriendParams.user_id
//       ));

//       callback(null, null);

//     }
//   );
// }

function fetchFriends(params) {

  return new Promise(async function(resolve, reject){

    if (!twitClient || (twitClient === undefined)) {
      console.log(chalkAlert("TFC | FETCH FRIENDS | TWIT CLIENT UNDEFINED | @" + configuration.threeceeUser));
      return reject(new Error("FETCH FRIENDS | TWIT CLIENT UNDEFINED"));
    }

    if (configuration.testMode) { console.log(chalkInfo("TFC | FETCH FRIENDS params\n" + jsonPrint(params))); }

    const threeceeUser = configuration.threeceeUser;

    if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

      try {

        let data = await getTwitterFriendsList(params);

        statsObj.threeceeUser.friendsFetched += data.users.length;
        statsObj.threeceeUser.nextCursor = data.next_cursor_str;
        statsObj.threeceeUser.percentFetched = 100*(statsObj.threeceeUser.friendsFetched/statsObj.threeceeUser.friendsCount); 

        if (configuration.testMode 
          && (statsObj.threeceeUser.friendsFetched >= configuration.totalFetchCount)) {

          statsObj.threeceeUser.nextCursorValid = false;
          statsObj.threeceeUser.endFetch = true;

          console.log(chalkInfo("\nTFC | =====================================\n"
            + "*** TEST MODE END FETCH ***"
            + "\nTFC | @" + configuration.threeceeUser
            + "\nTFC | TEST_FETCH_COUNT: " + TEST_FETCH_COUNT
            + "\nTFC | TEST_TOTAL_FETCH: " + TEST_TOTAL_FETCH
            + "\nTFC | FRIENDS FETCHED: " + statsObj.threeceeUser.friendsFetched
            + "\nTFC | =====================================\n"
          ));
        }
        else if (data.next_cursor_str > 0) {
          statsObj.threeceeUser.nextCursorValid = true;
          statsObj.threeceeUser.endFetch = false;
        }
        else {
          statsObj.threeceeUser.nextCursorValid = false;
          statsObj.threeceeUser.endFetch = true;
        }

        console.log(chalkTwitter("TFC | ==========================================================="
          + "\nTFC | END FETCH"
          + " | " + getTimeStamp()
          + " | @" + statsObj.threeceeUser.screenName
          + "\nTFC | FRIENDS:       " + statsObj.threeceeUser.friendsCount
          + "\nTFC | FRNDs FETCHED: " + statsObj.threeceeUser.friendsFetched
          + " (" + statsObj.threeceeUser.percentFetched.toFixed(1) + "%)"
          + "\nTFC | COUNT:         " + configuration.fetchCount
          + "\nTFC | FETCHED:       " + data.users.length
          + "\nTFC | END FETCH:     " + statsObj.threeceeUser.endFetch
          + "\nTFC | MORE:          " + statsObj.threeceeUser.nextCursorValid
          + "\nTFC | ==========================================================="
        ));

        async.eachSeries(data.users, async function (friend){

          try {

            const unfollowFlag = await checkFriendMinimumProperties({friend: friend});

            if (unfollowFlag) {

              unfollowQueue.push(friend);

              console.log(chalkError("TFC | CHECK FRIEND | XXX UNFOLLOW"
                + " [ UFQ: " + unfollowQueue.length + "]"
                + " | UNFOLLOW: " + unfollowFlag
                + " | ID: " + friend.id_str
                + " | @" + friend.screen_name
                + " | FLWRs: " + friend.followers_count
                + " | FRNDs: " + friend.friends_count
                + " | Ts: " + friend.statuses_count
              ));

              return;
            }

            friend.following = true;
            friend.threeceeFollowing = threeceeUser;

            debug(chalkError("TFC CHECK FRIEND | --- UNFOLLOW"
              + " [ UFQ: " + unfollowQueue.length + "]"
              + " | UNFOLLOW: " + unfollowFlag
              + " | ID: " + friend.id_str
              + " | @" + friend.screen_name
              + " | FLWRs: " + friend.followers_count
              + " | FRNDs: " + friend.friends_count
              + " | Ts: " + friend.statuses_count
            ));


            if (!statsObj.threeceeUser.twitterRateLimit.statuses.user_timeline.exceptionFlag) {
              friend.latestTweets = await fetchUserTweets({ userId: friend.id_str });
            }
            else {
              friend.latestTweets = [];
            }

            if (configuration.verbose && (friend.latestTweets.length > 0)) {
              console.log(chalkInfo("TFC | +++ FETCHED USER TWEETS" 
                + " [" + friend.latestTweets.length + "]"
                + " | @" + configuration.threeceeUser 
                + " | UID " + friend.id_str
              ));
            }

            process.send(
              {
                op: "FRIEND_RAW", 
                follow: false, 
                threeceeUser: configuration.threeceeUser, 
                childId: configuration.childId, 
                friend: friend
              }, 

              function(){ return; }
            );
          }
          catch(err){
            console.log(chalkError("TFC | @" + configuration.threeceeUser + " | *** CHECK FRIEND ERROR | " + err));
            return ;
          }

        }, function subFriendsProcess(err){
          if (err) {
            console.trace("TFC | *** subFriendsProcess ERROR");
            return reject(err);
          }
          resolve();
        });
      }
      catch(err){
        console.log(chalkError("TFC | *** TWITTER FRIENDS LIST ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        return reject(err);
      }
    }
    else {

      if (statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        console.log(chalkAlert("TFC | SKIP FETCH FRIENDS --- TWITTER RATE LIMIT"
          + " | @" + threeceeUser
          + " | LIM " + statsObj.threeceeUser.twitterRateLimit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
          + " | EXP @: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
          + " | RST @: " + statsObj.threeceeUser.twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
        ));
      }

      console.log(chalkLog("TFC | fetchFriends"
        + " | CURRENT: @" + threeceeUser 
        + " | RATE LIMIT: " + statsObj.threeceeUser.twitterRateLimitExceptionFlag
      ));

      resolve([]);
    }

  });
}


//=========================================================================
// FSM
//=========================================================================
const Stately = require("stately.js");

let fsm;
let fsmTickInterval;

statsObj.fsmState = "NEW";
statsObj.fsmPreviousState = "NEW";

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;
  statsObj.fsmPreviousState = oldState;
  statsObj.fsmPreviousPauseState = (newState === "PAUSE_RATE_LIMIT") ? oldState : "FETCH";

  process.send({
    op: newState, 
    threeceeUser: configuration.threeceeUser
    // remaining: statsObj.threeceeUser.twitterRateLimitRemainingTime
  });

  console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------\n"
    + MODULE_ID_PREFIX + " | << FSM >> CHILD " + configuration.childId
    + " | " + event
    + " | " + statsObj.fsmPreviousState
    + " -> " + newState
    + "\n" + MODULE_ID_PREFIX + " | --------------------------------------------------------"
  ));
}

const fsmStates = {

  "RESET":{

    onEnter: function(event, oldState, newState){
     if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        resetTwitterUserState();
      }
    },

    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_disable": "DISABLED",
    "fsm_exit": "EXIT",
    "fsm_reset": "RESET",
    "fsm_init": "INIT",
    "fsm_idle": "IDLE",
    "fsm_ready": "INIT",
    "fsm_error": "ERROR"
  },

  "INIT":{

    onEnter: async function(event, oldState, newState){

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        try{
          await twitterUserUpdate();
          fsm.fsm_ready();
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | @" + configuration.threeceeUser + " | *** INIT ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },

    fsm_tick: function() {
    },


    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_ready": "READY",
    "fsm_idle": "IDLE",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLED",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR"
  },

  "IDLE":{

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }
    },

    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLED",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR"
  },

  "READY":{

    onEnter: async function(event, oldState, newState){

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        if (statsObj.threeceeUser.friendsCount === 0){
          try {
            await twitterUsersShow();
          }
          catch(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** TWITTER USERS SHOW ERROR: " + err));
          }
        }

      }
    },


    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_idle": "IDLE",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLED",
    "fsm_error": "ERROR",
    "fsm_exit": "EXIT",
    "fsm_fetchUserStart": "FETCH_START"
  },

  "FETCH_START":{

    onEnter: function(event, oldState, newState){

      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        if (statsObj.threeceeUser.friendsCount === 0){
          twitterUsersShow(function(){});
        }

        fsm.fsm_fetchUser();
      }
    },


    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_init": "INIT",
    "fsm_idle": "IDLE",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR",
    "fsm_disable": "DISABLED",
    "fsm_fetchUser": "FETCH",
    "fsm_fetchUserStart": "FETCH_START",
    "fsm_exit": "EXIT",
    "fsm_fetchUserEnd": "FETCH_END"
  },

  "FETCH":{

    onEnter: async function(event, oldState, newState){

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        let params = {};

        params.fetchCount = configuration.fetchCount;
        params.totalFetchCount = configuration.totalFetchCount;
        params.screen_name = configuration.threeceeUser;
        params.cursor = (statsObj.threeceeUser.nextCursorValid) ? statsObj.threeceeUser.nextCursor : -1;

        if (statsObj.threeceeUser.friendsCount === 0){
          twitterUsersShow(function(){});
        }

        try{

          await fetchFriends(params);

          if (statsObj.threeceeUser.nextCursorValid && !statsObj.threeceeUser.endFetch) {
            await delay({period: configuration.fetchUserInterval, verbose: configuration.verbose});
            fsm.fsm_fetchUserContinue();
          }

          if (!statsObj.threeceeUser.nextCursorValid && statsObj.threeceeUser.endFetch) {
            fsm.fsm_fetchUserEnd();
          }
          
        }
        catch(err){
          console.log(chalkError("TFC | *** fetchFriends ERROR: " + err));

          if (err.code === 88){

            fsm.fsm_rateLimitStart();
          }
          else {
            process.send({op:"ERROR", type: "FETCH FRIENDS", threeceeUser: configuration.threeceeUser, state: "FETCH", params: params, error: err });
          }
        }
      }

    },

    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLED",
    "fsm_fetchUserContinue": "FETCH",
    "fsm_exit": "EXIT",
    "fsm_fetchUserEnd": "FETCH_END"

   },

  "FETCH_END":{

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
        console.log("TFC | FETCH_END | PREV STATE: " + oldState);
      }
    },

    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_idle": "IDLE",
    "fsm_disable": "DISABLED",
    "fsm_error": "ERROR",
    "fsm_exit": "EXIT",
    "fsm_reset": "RESET"
  },

  "PAUSE_RATE_LIMIT":{

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {

        statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
        reporter(event, oldState, newState);

        checkRateLimit()
        .then(function(results){

          if (results.anyRateLimitFlag) {

            const resources = Object.keys(results.flags);
            const resource = resources[0];
            const endPoints = results.flags.resource;
            const endPoint = endPoints[0];

            const timeout = Math.max(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime, ONE_MINUTE);

            process.send({op:"PAUSE_RATE_LIMIT", 
              threeceeUser: configuration.threeceeUser,
              exceptionAt: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.valueOf(),
              remainingTime: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime,
              exceptionFlag: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag,
              resetAt: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt
            });

            console.log(chalkAlert(MODULE_ID_PREFIX
              + " | >>> SET RATE LIMIT TIMEOUT"
              + " | " + msToTime(timeout)
              + " | @" + configuration.threeceeUser
            ));

            rateLimitTimeout = setTimeout(function(){

              console.log(chalkAlert(MODULE_ID_PREFIX
                + " | --- RATE LIMIT TIMEOUT END"
                + " | @" + configuration.threeceeUser
              ));

              fsm.fsm_rateLimitEnd();

            }, timeout);
          }

        })
        .catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX
            + " | PAUSE RATE LIMIT ERROR: " + err
          ));
        });

      }
    },


    fsm_tick: function() {
    },

    "fsm_rateLimitEnd": function(){

      console.log(chalkGreen(MODULE_ID_PREFIX
        + " | XXX RATE LIMIT END"
        + " | @" + configuration.threeceeUser
        + " | PREV FSM STATE: " + statsObj.fsmPreviousPauseState
      ));

      statsObj.threeceeUser.twitterRateLimitExceptionFlag = false;

      return statsObj.fsmPreviousPauseState;
    },

    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_exit": "EXIT",
    "fsm_disable": "DISABLED"
  },

  "DISABLED":{

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_idle": "IDLE",
    "fsm_exit": "EXIT",
    "fsm_reset": "RESET"
  },

  "EXIT":{

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }
    },

    "fsm_reset": "RESET"
  },

  "ERROR":{

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_disable": "DISABLED",
    "fsm_idle": "IDLE",
    "fsm_exit": "EXIT",
    "fsm_reset": "RESET"
  }
};

fsm = Stately.machine(fsmStates);

function fsmStart(params) {

  params = params || {};

  let interval = params.fsmTickInterval || configuration.fsmTickInterval;

  return new Promise(function(resolve, reject){

    console.log(chalkLog(MODULE_ID_PREFIX + " | FSM START | TICK INTERVAL | " + msToTime(interval)));

    clearInterval(fsmTickInterval);

    fsmTickInterval = setInterval(function() {

      fsm.fsm_tick();

    }, interval);

    resolve();

  });
}

reporter("START", "---", fsm.getMachineState());

console.log(MODULE_ID_PREFIX + " | =================================");
console.log(MODULE_ID_PREFIX + " | PROCESS TITLE: " + process.title);
console.log(MODULE_ID_PREFIX + " | HOST:          " + hostname);
console.log(MODULE_ID_PREFIX + " | PROCESS ID:    " + process.pid);
console.log(MODULE_ID_PREFIX + " | RUN ID:        " + statsObj.runId);
console.log(MODULE_ID_PREFIX + " | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log(MODULE_ID_PREFIX + " | =================================");

console.log(chalkBlueBold(
    "\n=======================================================================\n"
  +    MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
  + "\n=======================================================================\n"
));

process.on("message", async function(m) {

  if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD RX MESSAGE | OP: " + m.op)); }

  switch (m.op) {

    case "shutdown":
    case "SIGINT":
      clearInterval(checkRateLimitInterval);
      setTimeout(function() {
        console.log("TFC | QUITTING TFC CHILD | @" + configuration.threeceeUser);
        process.exit(0);
      }, 500);
    break;

    case "INIT":

      configuration = merge(configuration, m.config);
      configuration.childId = m.childId;
      threeceeUserDefaults.screenName = m.threeceeUser;

      console.log(chalkBlue("TFC | TFE CHILD INIT"
        + " | CHILD ID: " + m.childId
        + " | 3C: @" + m.threeceeUser
      ));

      try {
        await initTwitter(m.config.twitterConfig);
      }
      catch(err){
       console.log(chalkError("TFC | *** INIT TWITTER ERROR: " + err
        ));
      }

      fsm.fsm_init();

    break;

    case "IDLE":
      fsm.fsm_idle();
    break;

    case "READY":
      fsm.fsm_ready();
    break;

    case "FETCH_END":
      fsm.fsm_fetchUserEnd();
    break;

    case "FETCH_START":
      fsm.fsm_fetchUserStart();
    break;

    case "FOLLOW":

      // if (twitClient && (twitClient !== undefined)) {

      //   twitClient.post(

      //     "friendships/create", {screen_name: m.user.screenName}, 

      //     function createFriend(err, data, response){
      //       if (err) {
      //         console.log(chalkError("TFC | FOLLOW ERROR"
      //           + " | @" + configuration.threeceeUser
      //           + " | " + err
      //         ));

      //         if (err.code === 89){

      //           console.log(chalkAlert("TFC | *** TWITTER FOLLOW ERROR | INVALID OR EXPIRED TOKEN" 
      //             + " | " + getTimeStamp() 
      //             + " | @" + configuration.threeceeUser 
      //           ));

      //           statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  
      //           statsObj.threeceeUser.err = err;

      //           process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
      //           fsm.fsm_error();

      //           return reject(err);
      //         }


      //         process.send({op:"ERROR", type: "TWITTER FOLLOW", threeceeUser: configuration.threeceeUser, state: "FOLLOW", params: {screen_name: m.user.screenName}, error: err });
      //       }
      //       else {

      //         console.log(chalkInfo("TFC | +++ FOLLOW"
      //           + " | 3C: @" + configuration.threeceeUser
      //           + " | NID: " + m.user.userId
      //           + " | @" + m.user.screenName.toLowerCase()
      //         ));
      //       }
      //     }
      //   );
      // }
    break;

    case "UNFOLLOW":

      // unfollowFriend({ user: m.user }, function(err, results){

      //   if (err) {

      //     if (err.code === 34){
      //       console.log(chalkError("TFC | *** =X= UNFOLLOW ERROR | NON-EXISTENT USER"
      //         + " | 3C: @" + configuration.threeceeUser
      //         + "\nTFC | " + jsonPrint(m.user)
      //       ));
      //       return;
      //     }

      //     if (err.code === 89){

      //       console.log(chalkAlert("TFC | *** TWITTER UNFOLLOW ERROR | INVALID OR EXPIRED TOKEN" 
      //         + " | " + getTimeStamp() 
      //         + " | @" + configuration.threeceeUser 
      //       ));

      //       statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  
      //       statsObj.threeceeUser.err = err;

      //       process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
      //       fsm.fsm_error();

      //       return;
      //     }

      //     console.log(chalkError("TFC | *** =X= UNFOLLOW ERROR"
      //       + " | 3C: @" + configuration.threeceeUser
      //       + "\nTFC | " + jsonPrint(m.user)
      //     ));

      //     process.send(
      //       {
      //         op:"ERROR",
      //         type: "TWITTER UNFOLLOW", 
      //         threeceeUser: configuration.threeceeUser, 
      //         state: "UNFOLLOW_ERR", 
      //         params: { user: m.user }, 
      //         error: err
      //       }
      //     );

      //     return;
      //   }

      //   if (!results) {

      //     debug(chalkInfo("TFC | UNFOLLOW MISS"
      //       + " | 3C: @" + configuration.threeceeUser
      //       + "\n" + jsonPrint(m.user)
      //     ));

      //     return;
      //   }

      //   console.log(chalkInfo("TFC | XXX UNFOLLOW"
      //     + " | 3C: @" + configuration.threeceeUser
      //     + " | " + results.id_str
      //     + " | @" + results.screen_name
      //     + " | FLWRs: " + results.followers_count
      //     + " | FRNDs: " + results.friends_count
      //     + " | Ts: " + results.statuses_count
      //   ));

      // });
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
      console.log("TFC | @" + configuration.threeceeUser + " | RESET_TWITTER_USER_STATE" );
      resetTwitterUserState();
    break;    

    case "STATS":
      showStats();
      process.send({op:"STATS", threeceeUser: configuration.threeceeUser, statsObj: statsObj});
    break;

    case "VERBOSE":
      console.log(chalkAlert("TFC | @" + configuration.threeceeUser + " | SET VERBOSE: " + m.verbose));
      configuration.verbose = m.verbose;
    break;

    default:
      console.log(chalkError("TFC | *** UNKNOWN OP ERROR"
        + " | " + m.op
      ));
  }
});
setTimeout(async function(){

  try {

    let cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    // slackSendMessage(hostname + " | TFE | " + statsObj.status);

    initSaveFileQueue(configuration);

    if (configuration.testMode) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
    }

    console.log(chalkBlueBold(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\nCONFIGURATION\n" + jsonPrint(configuration)
      + "--------------------------------------------------------"
    ));


    try {
      await connectDb();
    }
    catch(err){
      dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit({cause:"MONGO DB CONNECT ERROR"});
    }

    try {
      await fsmStart();
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** FSM START ERROR: " + err + " | QUITTING ***"));
      quit({cause:"FSM START ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
