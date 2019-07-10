 /*jslint node: true */
/*jshint sub:true*/


const TEST_MODE = false; // applies only to parent

const MODULE_NAME = "tfcChild";
const MODULE_ID_PREFIX = "TFC";

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

const DEFAULT_INPUTS_BINARY_MODE = true;
const DEFAULT_FETCH_COUNT = 200;
const TEST_FETCH_COUNT = 27;
const TEST_TOTAL_FETCH = 747;

const DEFAUT_TWITTER_FETCH_TWEETS_INTERVAL = ONE_SECOND;
const DEFAULT_TWEET_FETCH_COUNT = 50;
const TEST_TWEET_FETCH_COUNT = 3;
const DEFAULT_TWEET_FETCH_EXCLUDE_REPLIES = true;
const DEFAULT_TWEET_FETCH_INCLUDE_RETWEETS = false;

const QUIT_ON_COMPLETE = false;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const FETCH_USER_INTERVAL = 5 * ONE_MINUTE;
const TEST_FETCH_USER_INTERVAL = 15 * ONE_SECOND;

const KEEPALIVE_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = ONE_SECOND;

const SAVE_CACHE_DEFAULT_TTL = 60;
const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;
const FSM_TICK_INTERVAL = ONE_SECOND;

const DROPBOX_LIST_FOLDER_LIMIT = 50;

//=========================================================================
// MODULE REQUIRES
//=========================================================================
const os = require("os");
const Twit = require("twit");
const _ = require("lodash");
const moment = require("moment");
const pick = require("object.pick");
const treeify = require("treeify");
const objectPath = require("object-path");
const NodeCache = require("node-cache");
const merge = require("deepmerge");

const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");

const fs = require("fs");
const debug = require("debug")("tfe");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");
const omit = require("object.omit");

const chalk = require("chalk");
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkGreen = chalk.green;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
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

const EventEmitter = require("eventemitter3");

class ChildEvents extends EventEmitter {}

const childEvents = new ChildEvents();


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

configuration.verbose =false;
configuration.threeceeUser = process.env.THREECEE_USER;
configuration.inputsBinaryMode = DEFAULT_INPUTS_BINARY_MODE;
configuration.testMode = TEST_MODE;
configuration.tweetFetchCount = (TEST_MODE) ? TEST_TWEET_FETCH_COUNT : DEFAULT_TWEET_FETCH_COUNT;
configuration.fetchCount = (TEST_MODE) ? TEST_FETCH_COUNT : DEFAULT_FETCH_COUNT;
configuration.totalFetchCount = (TEST_MODE) ? TEST_TOTAL_FETCH : Infinity;
configuration.fsmTickInterval = FSM_TICK_INTERVAL;
configuration.fetchUserInterval = (TEST_MODE) ? TEST_FETCH_USER_INTERVAL : FETCH_USER_INTERVAL;

configuration.slackChannel = {};

configuration.keepaliveInterval = KEEPALIVE_INTERVAL;
configuration.quitOnComplete = QUIT_ON_COMPLETE;

const startTimeMoment = moment();

const statsObj = {};
let statsObjSmall = {};

statsObj.pid = process.pid;
statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();

statsObj.users = {};

statsObj.tweets = {};
statsObj.tweets.fetched = 0;

statsObj.fetchUserTweetsEndFlag = false;

statsObj.queues = {};
statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;

statsObj.queues.fetchUserFriendsIdsQueue = {};
statsObj.queues.fetchUserFriendsIdsQueue.busy = false;
statsObj.queues.fetchUserFriendsIdsQueue.size = 0;

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

const statsPickArray = [
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

    checkRateLimit({}).
    then(function(){

      debug(chalkLog(MODULE_ID_PREFIX
        + " | RATE LIMIT"
        + " | @" + configuration.threeceeUser
        + " | FSM: " + fsm.getMachineState()
        + " | START: " + statsObj.startTime
        + " | ELAPSED: " + statsObj.elapsed
      ));

      Object.keys(TWITTER_RATE_LIMIT_RESOURCES).forEach(function(resource){
        TWITTER_RATE_LIMIT_RESOURCES[resource].forEach(function(endPoint) {
          if (statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag || configuration.verbose) {
            console.log(chalkInfo(MODULE_ID_PREFIX
              + " | -X- RATE LIMIT"
              + " | @" + configuration.threeceeUser
              + " | RLE: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag
              + " | RSRC: " + resource
              + " | END: " + endPoint
              + " | FSM: " + fsm.getMachineState()
              + " | LIM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].limit
              + " | REM: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remaining
              + " | STRT: " + statsObj.startTime
              + " | ELPSD: " + statsObj.elapsed
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | RST: " + statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt.format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime)
            ));
          }
        });
      });
    }).
    catch(function(err){
      console.log(chalkError(MODULE_ID_PREFIX
        + " | CHECK RATE LIMIT ERROR: " + err
      ));
    });

  }
  else {
    console.log(chalkLog(MODULE_ID_PREFIX
      + " | STATUS"
      + " | @" + configuration.threeceeUser
      + " | FSM: " + fsm.getMachineState()
      + " | FUTQ: " + fetchUserTweetsQueue.length      
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
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;

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
      
      resolve(configuration);

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

//=========================================================================
// MONGO DB
//=========================================================================

global.globalDbConnection = false;
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

global.globalWordAssoDb = require("@threeceelabs/mongoose-twitter");

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

let dbConnectionReadyInterval;

const UserServerController = require("@threeceelabs/user-server-controller");
let userServerController;
let userServerControllerReady = false;

function connectDb(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      global.globalWordAssoDb.connect(MODULE_ID + "_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("close", async function(){
          statsObj.status = "MONGO CLOSED";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED");
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED"));
        });

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR");
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.error.bind(console, MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED");
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
        });


        global.globalDbConnection = db;

        console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

        global.globalEmoji = global.globalDbConnection.model("Emoji", emojiModel.EmojiSchema);
        global.globalHashtag = global.globalDbConnection.model("Hashtag", hashtagModel.HashtagSchema);
        global.globalLocation = global.globalDbConnection.model("Location", locationModel.LocationSchema);
        global.globalMedia = global.globalDbConnection.model("Media", mediaModel.MediaSchema);
        global.globalNeuralNetwork = global.globalDbConnection.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);
        global.globalPlace = global.globalDbConnection.model("Place", placeModel.PlaceSchema);
        global.globalTweet = global.globalDbConnection.model("Tweet", tweetModel.TweetSchema);
        global.globalUrl = global.globalDbConnection.model("Url", urlModel.UrlSchema);
        global.globalUser = global.globalDbConnection.model("User", userModel.UserSchema);
        global.globalWord = global.globalDbConnection.model("Word", wordModel.WordSchema);

        const uscChildName = MODULE_ID_PREFIX + "_USC";
        userServerController = new UserServerController(uscChildName);

        userServerController.on("ready", function(appname){
          userServerControllerReady = true;
          console.log(chalkLog(MODULE_ID_PREFIX + " | " + uscChildName + " READY | " + appname));
        });

        dbConnectionReadyInterval = setInterval(function(){

          if (userServerControllerReady) {

            console.log(chalkGreen(MODULE_ID_PREFIX + " | MONGO DB READY"));

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

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const dropboxRemoteClient = new Dropbox({ 
  accessToken: configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

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


function filesListFolderLocal(options){
  return new Promise(function(resolve, reject) {

    const fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + options.path;

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
            console.log(chalkError("TFC | *** FILE LIST FOLDER ERROR: " + err));
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

//=========================================================================
// FILE SAVE
//=========================================================================
let saveFileQueueInterval;
const saveFileQueue = [];

configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;

let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;
let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheTtl === undefined) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }
if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

console.log(MODULE_ID_PREFIX + " | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");
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

  const fullPath = params.folder + "/" + params.file;
  const limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  const options = {};

  if (params.localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats();
    console.log(chalkBlue(MODULE_ID_PREFIX + " | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 }).
    then(function() {

      console.log(chalkBlue(MODULE_ID_PREFIX + " | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    }).
    catch(function(error){
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

      dropboxClient.filesUpload(options).
      then(function(){
        debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
        if (callback !== undefined) { return callback(null); }
      }).
      catch(function(error){
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

      dropboxClient.filesListFolder({path: params.folder, limit: limit}).
      then(function(response){

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
      }).
      catch(function(err){
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

function clearAllIntervals(){
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

function readyToQuit() {
  const flag = true; // replace with function returns true when ready to quit
  return flag;
}

async function quit(opts) {

  const options = opts || {};

  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  fsm.fsm_exit();

  showStats(true);

  process.send({op: "QUIT", childId: configuration.childId, threeceeUser: configuration.threeceeUser, data: statsObj});

  intervalsSet.add("quitWaitInterval");

  const quitWaitInterval = setInterval(async function() {

    if (readyToQuit()) {

      clearInterval(quitWaitInterval);
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
}

function delayEvent(p) {

  const params = p || {};
  const delayEventName = params.delayEventName;
  const period = params.period || 10*ONE_SECOND;
  const verbose = params.verbose || false;

  if (verbose) {
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ DELAY START | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
  }

  const delayTimout = setTimeout(function(){

    if (verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | XXX DELAY END | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
    }

    childEvents.emit(delayEventName); 

  }, period);

  return(delayTimout);

}

//=========================================================================
// TWITTER
//=========================================================================
let twitClient;

const threeceeUserDefaults = {};

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
      ));

      return resolve();
    }

    twitClient.get("account/settings", async function(err, accountSettings, response) {

      if (configuration.verbose) {
        debug("TFC | TWITTER ACCOUNT SETTINGS response\n", response);
      }

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

          process.send({op: "ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
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
      catch(e){
        e.user = userScreenName;

        if (e.code === 88) {
          return resolve(err);
        }

        console.log(chalkError("TFC | *** TWITTER USER UPDATE ERROR" 
          + " | " + getTimeStamp() 
          + " | @" + userScreenName 
          + "\n" + jsonPrint(e)
        ));

        fsm.fsm_error();

        return reject(e);
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

    const fetchUserTweetsParams = {};

    fetchUserTweetsParams.user_id = params.user.userId;
    fetchUserTweetsParams.trim_user = false;

    if (params.excludeUser) { fetchUserTweetsParams.trim_user = true; } 
    if (params.user.maxId) { fetchUserTweetsParams.max_id = params.user.maxId; } 
    if (params.user.sinceId) { fetchUserTweetsParams.since_id = params.user.sinceId; } 

    if (!params.user.tweetHistograms || (params.user.tweetHistograms === undefined)|| (params.user.tweetHistograms === {})){
      console.log(chalk.yellow("TFC | fetchUserTweets | tweetHistograms UNDEFINED | RESET MAX/SINCE IDs | @" + params.user));
      fetchUserTweetsParams.max_id = null;
      fetchUserTweetsParams.since_id = null;
    }

    fetchUserTweetsParams.count = params.tweetFetchCount || configuration.tweetFetchCount;
    fetchUserTweetsParams.exclude_replies = params.excludeReplies || DEFAULT_TWEET_FETCH_EXCLUDE_REPLIES;
    fetchUserTweetsParams.include_rts = params.includeRetweets || DEFAULT_TWEET_FETCH_INCLUDE_RETWEETS;

    twitClient.get("statuses/user_timeline", fetchUserTweetsParams, function(err, userTweetsArray, response) {

      if (configuration.verbose) {
        debug("TFC | TWITTER USER TIMELINE response\n", response);
      }

      if (err){

        if (err.code === 88){
          statsObj.threeceeUser.twitterRateLimit.statuses.user_timeline.exceptionAt = moment();
          statsObj.threeceeUser.twitterRateLimit.statuses.user_timeline.exceptionFlag = true;

          console.log(chalkAlert("TFC | *** TWITTER FETCH USER TWEETS ERROR | RATE LIMIT" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));

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

          process.send({op: "ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);
        }

        if (err.code === 34){
          console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS ERROR | USER NOT FOUND"
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
            + " | UID: " + params.user.userId
            + " | @" + params.user.screenName
          ));
          process.send({op: "ERROR", type: "USER_NOT_FOUND", userId: params.user.userId, threeceeUser: configuration.threeceeUser, error: err});
          return reject(err);
        }
        
        if (err.code === 136){
          console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS ERROR | USER BLOCKED"
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
            + " | UID: " + params.user.userId
            + " | @" + params.user.screenName
          ));
          process.send({op: "ERROR", type: "USER_BLOCKED", userId: params.user.userId, threeceeUser: configuration.threeceeUser, error: err});
          return reject(err);
        }
        
        if (err.statusCode === 401){
          console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS ERROR | NOT AUTHORIZED"
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
            + " | UID: " + params.user.userId
            + " | @" + params.user.screenName
          ));
          process.send({op: "ERROR", type: "USER_NOT_AUTHORIZED", userId: params.user.userId, threeceeUser: configuration.threeceeUser, error: err});
          return reject(err);
        }
        
        console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS ERROR"
          + " | " + getTimeStamp() 
          + " | 3C @" + configuration.threeceeUser 
          + " | UID: " + params.user.userId
          + " | @" + params.user.screenName
          + " | ERR CODE: " + err.code
          + " | " + err.message
          + "\n" + jsonPrint(err)
          + "\fetchUserTweetsParams\n" + jsonPrint(fetchUserTweetsParams)
        ));

        return reject(err);
      }

      resolve(userTweetsArray);

    });

  });
}

function twitterUsersShow(){

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

      if (configuration.verbose) {
        debug("TFC | TWITTER USER SHOW response\n", response);
      }

      if (err){

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

          process.send({op: "ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

          return reject(err);

        }

        console.log(chalkError("TFC | *** TWITTER SHOW USER ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
          // + "\nRESPONSE\n", response
        ));

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

      process.send({op: "THREECEE_USER", childId: configuration.childId, threeceeUser: omit(statsObj.threeceeUser, ["friends"])});

      resolve();

    });

  });
}

function twitterUserUpdate(){

  return new Promise(async function(resolve, reject){

    if (statsObj.threeceeUser.twitterRateLimit.users.exceptionFlag || statsObj.threeceeUser.twitterRateLimit.friends.exceptionFlag) {
      console.log(chalkAlert("TFC | twitterUserUpdate | SKIPPING ... RATE LIMIT | @" + configuration.threeceeUser));
      return resolve();
    }

    try {
      await twitterUsersShow();
      // await fetch3cUserFriendsIds();
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

  return new Promise(async function(resolve){

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

        console.log(chalkInfo("TFC | XXX RESET RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | RSRC: " + resource
          + " | END: " + endPoint
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
        console.log(chalkAlert("TFC | *** SHOW USER ERROR | RATE LIMIT EXCEEDED" 
          + " | @" + configuration.threeceeUser
          + " | RSRC: " + resource
          + " | END: " + endPoint
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
        console.log(chalkLog("TFC | --- RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | RSRC: " + resource
          + " | END: " + endPoint
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

      console.log(chalkLog("TFC | --- RATE LIMIT"
        + " | @" + configuration.threeceeUser
        + " | RSRC: " + resource
        + " | END: " + endPoint
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
        console.log(chalkInfo("TFC | ... NO RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | RSRC: " + resource
          + " | END: " + endPoint
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

function checkRateLimit(){

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

    const results = {};
    results.flags = {};
    results.anyRateLimitFlag = false;

    twitClient.get("application/rate_limit_status", function(err, data, response) {

      if (configuration.verbose) {
        debug("TFC | TWITTER RATE LIMIT STATUS response\n", response);
      }

      if (err && (err.code !== 88)){

        statsObj.threeceeUser.twitterErrors+= 1;

        if (err.code === 89){

          console.log(chalkAlert("TFC | *** TWITTER GET RATE LIMIT STATUS ERROR | INVALID OR EXPIRED TOKEN" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));

          statsObj.threeceeUser.err = err;

          process.send({op: "ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});
          fsm.fsm_error();

        }

        process.send({op: "ERROR", type: "RATE_LIMIT_STATUS", threeceeUser: configuration.threeceeUser, error: err});
        return reject(err);
      }
      else if (err && (err.code === 88)) {

        results.anyRateLimitFlag = true;        

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

          if (flag) { 
            results.anyRateLimitFlag = true;
            objectPath.set(results, "flags." + resource + "." + endPoint, flag);
          }

        });
      });

      resolve(results);
    });

  });
}

let fetchUserTweetsQueueInterval;
intervalsSet.add("fetchUserTweetsQueueInterval");

let fetchUserTweetsQueueReady = true;
const fetchUserTweetsQueue = [];

function initFetchUserTweets(p) {

  return new Promise(async function(resolve, reject){

    clearInterval(fetchUserTweetsQueueInterval);
    fetchUserTweetsQueueReady = true;

    const params = p || {};
    params.interval = params.interval || DEFAUT_TWITTER_FETCH_TWEETS_INTERVAL;

    if (!twitClient || (twitClient === undefined)) {
      console.log(chalkAlert("TFC | FETCH USER TWEETS | TWIT CLIENT UNDEFINED | @" + configuration.threeceeUser));
      return reject(new Error("FETCH USER TWEETS | TWIT CLIENT UNDEFINED"));
    }

    console.log(chalkInfo("TFC | FETCH USER TWEETS"
      + " | RATE LIMIT FLAG: " + statsObj.threeceeUser.twitterRateLimitExceptionFlag
      + "\nPARAMS\n" + jsonPrint(params)
    ));

    let latestTweets = [];

    fetchUserTweetsQueueInterval = setInterval(async function(){

      if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag 
        && fetchUserTweetsQueueReady 
        && (fetchUserTweetsQueue.length === 0)
        && statsObj.fetchUserTweetsEndFlag
      ) {

        console.log(chalkBlueBold("TFC | ==========================="));
        console.log(chalkBlueBold("TFC | XXX FETCHED USER TWEETS END"));
        console.log(chalkBlueBold("TFC | ==========================="));
        
        fetchUserTweetsQueueReady = false;
        fsm.fsm_fetchUserEnd();
      }
      else if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag && fetchUserTweetsQueueReady && (fetchUserTweetsQueue.length > 0)) {

        fetchUserTweetsQueueReady = false;

        const user = fetchUserTweetsQueue.shift();

        try {

          latestTweets = await fetchUserTweets({ user: user, excludeUser: false });

          if (latestTweets.length > 0) {

            statsObj.tweets.fetched += latestTweets.length;

            if (statsObj.tweets.fetched % 100 === 0) {

              console.log(chalkLog("TFC | +++ FETCHED USER TWEETS" 
                + " [ " + latestTweets.length + " LATEST / " + statsObj.tweets.fetched + " TOT FETCHED ]"
                + " | " + user.userId
                + " | @" + user.screenName
                + " | SINCE: " + user.tweets.sinceId
              ));
            }

          }

          process.send(
            {
              op: "USER_TWEETS",
              nodeId: user.nodeId,
              latestTweets: latestTweets
            }, 

            function(){ 
              fetchUserTweetsQueueReady = true; 
            }
          );

        }
        catch(err){

          if (err.code === 88) { // requeue on rate limit

            statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;

            fetchUserTweetsQueue.push(user);

            console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS | RATE LIMIT"
              + " | @" + configuration.threeceeUser 
              + " | " + getTimeStamp() 
              + " | UID: " + user.userId
              + " | ERR CODE: " + err.code
              + " | " + err.message
            ));
          }
          else if (err.code === 130) { // twitter over capacity

            fetchUserTweetsQueue.push(user);

            console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS | OVER CAPACITY"
              + " | @" + configuration.threeceeUser 
              + " | " + getTimeStamp() 
              + " | UID: " + user.userId
              + " | ERR CODE: " + err.code
              + " | " + err.message
            ));
          }
          else {
            console.log(chalkError("TFC | *** TWITTER FETCH USER TWEETS ERROR"
              + " | @" + configuration.threeceeUser 
              + " | " + getTimeStamp() 
              + " | UID: " + user.userId
              + " | ERR CODE: " + err.code
              + " | " + err.message
            ));
          }

          fetchUserTweetsQueueReady = true; 
        }
      }

    }, params.interval);

    resolve();
  });
}


//=========================================================================
// FSM
//=========================================================================
const Stately = require("stately.js");

let fsmTickInterval;
intervalsSet.add("fsmTickInterval");

statsObj.fsmState = "NEW";
statsObj.fsmPreviousState = "NEW";

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;
  statsObj.fsmPreviousState = oldState;
  statsObj.fsmPreviousPauseState = (newState === "PAUSE_RATE_LIMIT") ? oldState : "FETCH";

  process.send({
    op: newState, 
    threeceeUser: configuration.threeceeUser
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

  "RESET": {

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

  "INIT": {

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

  "IDLE": {

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

  "READY": {

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

  "FETCH_START": {

    onEnter: async function(event, oldState, newState){

      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        try{
          await initFetchUserTweets();
          // await initfetchUserFriendsIds();
          fsm.fsm_fetchUser();
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** INIT FETCH USER TWEETS ERROR: " + err 
          ));
          fsm.fsm_error();
        }

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

  "FETCH": {

    onEnter: async function(event, oldState, newState){

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
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

  "FETCH_END": {

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

  "PAUSE_RATE_LIMIT": {

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {

        statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
        reporter(event, oldState, newState);

        checkRateLimit().
        then(function(results){

          if (results.anyRateLimitFlag) {

            const resources = Object.keys(results.flags);
            const resource = resources[0];
            const endPoints = results.flags.resource;
            const endPoint = endPoints[0];

            const timeout = Math.max(statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime, ONE_MINUTE);

            process.send({op: "PAUSE_RATE_LIMIT", 
              threeceeUser: configuration.threeceeUser,
              exceptionAt: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionAt.valueOf(),
              remainingTime: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].remainingTime,
              exceptionFlag: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].exceptionFlag,
              resetAt: statsObj.threeceeUser.twitterRateLimit[resource][endPoint].resetAt
            });


            if ((resource === "friends") && (endPoint === "ids")) {

              console.log(chalkAlert(MODULE_ID_PREFIX
                + " | >>> SET RATE LIMIT TIMEOUT FRIENDS_IDS"
                + " | " + msToTime(timeout)
                + " | @" + configuration.threeceeUser
              ));

              // const delayEventName = params.delayEventName;
              // const period = params.period || 10*ONE_SECOND;
              // const verbose = params.verbose || false;
              childEvents.once("fetchUserFriendsIdsRateLimitExpired", function(){

                statsObj.threeceeUser.twitterRateLimit.friends.ids.exceptionFlag = false;

                console.log(chalkGreen(MODULE_ID_PREFIX
                  + " | XXX RATE LIMIT END FRIENDS_IDS"
                ));

              });

              delayEvent({delayEventName: "fetchUserFriendsIdsRateLimitExpired", period: timeout, verbose: true});

            }
            else {

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

          }
        }).
        catch(function(err){
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

  "DISABLED": {

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

  "EXIT": {

    onEnter: function(event, oldState, newState){
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }
    },

    "fsm_reset": "RESET"
  },

  "ERROR": {

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

const fsm = Stately.machine(fsmStates);

function fsmStart(p) {

  return new Promise(function(resolve){

    const params = p || {};
    const interval = params.fsmTickInterval || configuration.fsmTickInterval;

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
  + MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
  + "\n=======================================================================\n"
));

process.on("message", async function(m) {

  if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | CHILD RX MESSAGE | OP: " + m.op)); }

  switch (m.op) {

    case "shutdown":
    case "SIGINT":
      await clearAllIntervals();
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

    case "FETCH_USER_TWEETS":
      m.userArray.forEach(function(user){
        if (m.priority) {
          fetchUserTweetsQueue.unshift(user);
        }
        else {
          fetchUserTweetsQueue.push(user);
        }
      });

      if (m.fetchUserTweetsEndFlag) {
        statsObj.fetchUserTweetsEndFlag = m.fetchUserTweetsEndFlag;
      }

      console.log(chalkBlue(MODULE_ID_PREFIX
        + " | FETCH_USER_TWEETS"
        + " | END FLAG: " + m.fetchUserTweetsEndFlag
        + " | USER ARRAY: " + m.userArray.length
        + " | FUTQ: " + fetchUserTweetsQueue.length
      ));
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
    break;

    case "UNFOLLOW":
    break;

    case "QUIT":
      console.log(chalkError("TFC | *** TFE CHILD QUIT ON PARENT MESSAGE"
        + " | CHILD ID: " + m.childId
        + " | 3C: @" + m.threeceeUser
      ));
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
      process.send({op: "STATS", threeceeUser: configuration.threeceeUser, statsObj: statsObj});
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

    const cnf = await initConfig(configuration);
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
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MONGO DB CONNECT ERROR"});
    }

    try {
      await fsmStart();
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** FSM START ERROR: " + err + " | QUITTING ***"));
      quit({cause: "FSM START ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
