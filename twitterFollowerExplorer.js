/*jslint node: true */
/*jshint esnext: true */


const PRIMARY_HOST = process.env.PRIMARY_HOST || "google";

const os = require("os");
let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const MODULE_NAME = "twitterFollowerExplorer";
const MODULE_ID_PREFIX = "TFE";
const CHILD_PREFIX = "tfe_node";

const DEFAULT_FIND_CAT_USER_CURSOR_LIMIT = 100;
const DEFAULT_CURSOR_BATCH_SIZE = 100;

const DEFAULT_ARCHIVE_NETWORK_ON_INPUT_MISS = true;
const DEFAULT_MIN_TEST_CYCLES = 3;
const DEFAULT_MIN_WORD_LENGTH = 3;
const DEFAULT_RANDOM_UNTESTED_LIMIT = 25;
const DEFAULT_BEST_INCREMENTAL_UPDATE = false;

let saveRawFriendFlag = true;
let neuralNetworkInitialized = false;

const RNT_CHILD_ID = CHILD_PREFIX + "_child_rnt";
const LAC_CHILD_ID = CHILD_PREFIX + "_child_lac";

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_MIN_INTERVAL = 2;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const MAX_SAVE_DROPBOX_NORMAL = 20 * ONE_MEGABYTE;

const TEST_MODE = false; // applies only to parent
// const TEST_DROPBOX_INPUTS_LOAD = 23;
// const TEST_DROPBOX_NN_LOAD = 11;

const TEST_FETCH_USER_INTERVAL = 15 * ONE_SECOND;
const TEST_MODE_FETCH_ALL_INTERVAL = 2*ONE_MINUTE;

const FETCH_COUNT = 200;

const TEST_TWEET_FETCH_COUNT = 11;

const TEST_MODE_NUM_NN = 5;
const TEST_FETCH_COUNT = 17;
const TEST_TOTAL_FETCH = 47;

const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = false;

const DEFAULT_INIT_MAIN_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;
const FSM_TICK_INTERVAL = ONE_SECOND;
const STATS_UPDATE_INTERVAL = ONE_MINUTE;
const DEFAULT_CHILD_PING_INTERVAL = ONE_MINUTE;

const PROCESS_USER_QUEUE_INTERVAL = 5;
// const LANG_ANAL_MSG_Q_INTERVAL = DEFAULT_MIN_INTERVAL;
const ACTIVATE_NETWORK_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const USER_DB_UPDATE_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const FETCH_USER_INTERVAL = 5 * ONE_MINUTE;
const DEFAULT_NUM_NN = 50; // TOP 100 NN's are loaded from DB

const RANDOM_NETWORK_TREE_INTERVAL = DEFAULT_MIN_INTERVAL;
const RANDOM_NETWORK_TREE_MSG_Q_INTERVAL = 5; // ms

let waitFileSaveInterval;
let randomNetworkTreeMessageRxQueueInterval;
// let langAnalyzerMessageRxQueueInterval;

const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 70;
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 30;
const DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE = 50;


const SAVE_CACHE_DEFAULT_TTL = 60;
const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;

const USER_PROFILE_PROPERTY_ARRAY = [
  "bannerImageUrl",
  "description",
  "location",
  "name",
  "profileUrl",
  "screenName",
  "url"
];

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

const inputsIdSet = new Set();
const bestInputsSet = new Set();
const skipLoadNetworkSet = new Set();

let globalHistograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  globalHistograms[type] = {};
});

const unfollowableUserFile = "unfollowableUser.json";
let unfollowableUserSet = new Set();
// const ignoredUserSet = new Set();

const DROPBOX_LIST_FOLDER_LIMIT = 50;

let configuration = {};
configuration.geoCodeEnabled = false;
configuration.bestNetworkIncrementalUpdate = DEFAULT_BEST_INCREMENTAL_UPDATE;
configuration.archiveNetworkOnInputsMiss = DEFAULT_ARCHIVE_NETWORK_ON_INPUT_MISS;
configuration.randomUntestedLimit = DEFAULT_RANDOM_UNTESTED_LIMIT;
configuration.minWordLength = DEFAULT_MIN_WORD_LENGTH;
configuration.minTestCycles = DEFAULT_MIN_TEST_CYCLES;
configuration.testMode = TEST_MODE;
configuration.globalTestMode = GLOBAL_TEST_MODE;
configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.tweetFetchCount = (TEST_MODE) ? TEST_TWEET_FETCH_COUNT : TEST_FETCH_COUNT;
configuration.fetchCount = (TEST_MODE) ? TEST_FETCH_COUNT : FETCH_COUNT;
configuration.totalFetchCount = (TEST_MODE) ? TEST_TOTAL_FETCH : Infinity;
configuration.fetchUserInterval = (TEST_MODE) ? TEST_FETCH_USER_INTERVAL : FETCH_USER_INTERVAL;
configuration.fsmTickInterval = FSM_TICK_INTERVAL;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;
configuration.networkDatabaseLoadLimit = (TEST_MODE) ? TEST_MODE_NUM_NN : DEFAULT_NUM_NN;

//=========================================================================
// HOST
//=========================================================================

const googleMapsClient = require("@google/maps").createClient({
  key: "AIzaSyDBxA6RmuBcyj-t7gfvK61yp8CDNnRLUlc"
});

const fetch = require("isomorphic-fetch"); // or another library of choice.
const urlParse = require("url-parse");
const moment = require("moment");
const HashMap = require("hashmap").HashMap;
const pick = require("object.pick");
const shell = require("shelljs");
const touch = require("touch");
const kill = require("tree-kill");
// const dot = require("dot-object");
const _ = require("lodash");
const treeify = require("treeify");
const objectPath = require("object-path");
const NodeCache = require("node-cache");
const merge = require("deepmerge");
// const table = require("text-table");
const btoa = require("btoa");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const writeJsonFile = require("write-json-file");
const sizeof = require("object-sizeof");
const fs = require("fs");
const jsonParse = require("safe-json-parse");
const debug = require("debug")("TFE");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");

const { WebClient } = require("@slack/client");
const { RTMClient } = require("@slack/client");

const EventEmitter = require("eventemitter3");
const EventEmitter2 = require("eventemitter2").EventEmitter2;

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

class MyEmitter extends EventEmitter {}

const myEmitter = new MyEmitter();

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
// const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;


const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

const twitterUserHashMap = {};
const bestNetworkHashMap = new HashMap();
let maxInputHashMap = {};

const categorizedUserHashmap = new HashMap();
// const inputsHashMap = new HashMap();
// const inputsNetworksHashMap = {};

const processUserQueue = [];
let processUserQueueInterval;

let randomNetworkTree;
let randomNetworkTreeMessageRxQueueReadyFlag = true;
let randomNetworkTreeReadyFlag = false;
let randomNetworkTreeActivateQueueSize = 0;
const randomNetworkTreeMessageRxQueue = [];


const activateNetworkQueue = [];
let activateNetworkQueueInterval;

// let langAnalyzer;
// let langAnalyzerMessageRxQueueReadyFlag = true;
// let languageAnalysisBusyFlag = false;
// const langAnalyzerMessageRxQueue = [];

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
const userDbUpdateQueue = [];

const startTimeMoment = moment();

const statsObj = {};
let statsObjSmall = {};

statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;

statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();
statsObj.status = "START";

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = null;
statsObj.bestNetwork.numInputs = 0;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.overallMatchRate = 0;
statsObj.bestNetwork.testCycles = 0;
statsObj.bestNetwork.testCycleHistory = [];
statsObj.bestNetwork.network = {};
statsObj.bestNetwork.networkType = null;
statsObj.bestNetwork.input = [];
statsObj.bestNetwork.inputsId = null;
statsObj.bestNetwork.output = [];
statsObj.bestNetwork.evolve = {};

statsObj.bestRuntimeNetworkId = false;
statsObj.prevBestNetworkId = false;
statsObj.loadedNetworksFlag = false;
statsObj.bestNetworkId = false;
statsObj.currentBestNetworkId = false;

statsObj.geo = {};
statsObj.geo.hits = 0;
statsObj.geo.misses = 0;
statsObj.geo.total = 0;
statsObj.geo.hitRate = 0;

statsObj.analyzer = {};
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.errors = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.total = 0;
statsObj.authenticated = false;
statsObj.errors = {};
statsObj.errors.imageParse = {};
statsObj.errors.users = {};
statsObj.errors.users.findOne = 0;
statsObj.fetchUsersComplete = false;
statsObj.friends = {};
statsObj.friends.raw = 0;
statsObj.maxChildrenCreated = false; 
statsObj.queues = {};
statsObj.queues.randomNetworkTreeActivateQueue = {};
statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
statsObj.queues.randomNetworkTreeActivateQueue.size = 0;
statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;
statsObj.queues.activateNetworkQueue = {};
statsObj.queues.activateNetworkQueue.busy = false;
statsObj.queues.activateNetworkQueue.size = 0;
statsObj.queues.processUserQueue = {};
statsObj.queues.processUserQueue.busy = false;
statsObj.queues.processUserQueue.size = 0;

statsObj.twitter = {};
statsObj.twitter.errors = 0;
statsObj.twitter.tweetsProcessed = 0;
statsObj.twitter.tweetsHits = 0;
statsObj.twitter.tweetsTotal = 0;

statsObj.user = {};
statsObj.userReadyAck = false;
statsObj.userReadyAckWait = 0;
statsObj.userReadyTransmitted = false;

statsObj.users = {};
statsObj.users.categorized = {};

statsObj.users.categorized.total = 0;
statsObj.users.categorized.manual = 0;
statsObj.users.categorized.auto = 0;
statsObj.users.categorized.matched = 0;
statsObj.users.categorized.mismatched = 0;
statsObj.users.categorized.matchRate = 0;

statsObj.users.total = 0;
statsObj.users.fetched = 0;
statsObj.users.processed = 0;
statsObj.users.totalUsersSkipped = 0;
statsObj.users.percentFetched = 0;
statsObj.users.percentProcessed = 0;

statsObj.users.classified = 0;
statsObj.users.classifiedAuto = 0;

statsObj.users.imageParse = {};
statsObj.users.imageParse.parsed = 0;
statsObj.users.imageParse.skipped = 0;
statsObj.users.notCategorized = 0;
statsObj.users.notFound = 0;
statsObj.users.screenNameUndefined = 0;
statsObj.users.unzipped = 0;
statsObj.users.updatedCategorized = 0;
statsObj.users.zipHashMapHit = 0;

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";
// const defaultNetworkInputsConfigFile = "default_networkInputsConfig.json";
const defaultBestInputsConfigFile = "default_bestInputsConfig.json";
const hostBestInputsConfigFile = hostname + "_bestInputsConfig.json";

let bestNetwork = {};
bestNetwork.networkId = "";
bestNetwork.inputsId = "";
bestNetwork.numInputs = 0;
bestNetwork.createdAt = moment().valueOf();
bestNetwork.isValid = false;
bestNetwork.successRate = 0;
bestNetwork.matchRate = 0;
bestNetwork.overallMatchRate = 0;
bestNetwork.testCycles = 0;
bestNetwork.testCycleHistory = [];

let currentBestNetwork = {};
currentBestNetwork.networkId = "";
currentBestNetwork.inputsId = "";
currentBestNetwork.numInputs = 0;
currentBestNetwork.createdAt = moment().valueOf();
currentBestNetwork.isValid = false;
currentBestNetwork.successRate = 0;
currentBestNetwork.matchRate = 0;
currentBestNetwork.overallMatchRate = 0;
currentBestNetwork.testCycles = 0;
currentBestNetwork.testCycleHistory = [];


//=========================================================================
// TFE SPECIFIC
//=========================================================================
const DEFAULT_CHILD_ID_PREFIX = "tfe_node_child";

if (hostname === "google") {
  configuration.childAppPath = "/home/tc/twitterFollowerExplorer/twitterFollowerExplorerChild.js";
}
else {
  configuration.childAppPath = "/Volumes/RAID1/projects/twitterFollowerExplorer/twitterFollowerExplorerChild.js";
}
configuration.childIdPrefix = DEFAULT_CHILD_ID_PREFIX;

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");

// let childPingAllInterval;

// let allCompleteFlag = false;

//=========================================================================
// SLACK
//=========================================================================

const slackChannel = "tfe";
const channelsHashMap = new HashMap();

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackConversationId = "D65CSAELX"; // wordbot
const slackRtmToken = "xoxb-209434353623-bNIoT4Dxu1vv8JZNgu7CDliy";

let slackRtmClient;
let slackWebClient;

function slackSendRtmMessage(msg){

  return new Promise(async function(resolve, reject){

    try {
      console.log(chalkBlueBold("TFE | SLACK RTM | SEND: " + msg));
      const sendResponse = await slackRtmClient.sendMessage(msg, slackConversationId);

      console.log(chalkLog("TFE | SLACK RTM | >T\n" + jsonPrint(sendResponse)));
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

      console.log(chalkBlueBold("TFE | SLACK WEB | SEND\n" + jsonPrint(message)));
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

      console.log(chalkInfo("TFE | MESSAGE | " + message.type + " | " + message.text));

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
          await slackSendWebMessage(hostname + " | TFE | PONG");
          resolve();
        break;
        case "NONE":
          resolve();
        break;
        default:
          console.log(chalkAlert("TFE | *** UNDEFINED SLACK MESSAGE: " + message.text));
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
        console.log("TFE | SLACK WEB TEST RESPONSE\n" + jsonPrint(testResponse));
      }

      const botsInfoResponse = await slackWebClient.bots.info();
      console.log("TFE | SLACK WEB BOTS INFO RESPONSE\n" + jsonPrint(botsInfoResponse));

      const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

      conversationsListResponse.channels.forEach(async function(channel){
  
        console.log(chalkLog("TFE | CHANNEL | " + channel.id + " | " + channel.name));

        if (channel.name === slackChannel) {
          configuration.slackChannel = channel;
          // const conversationsJoinResponse = await slackWebClient.conversations.join({token: slackOAuthAccessToken, channel: configuration.slackChannel.id });

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
            console.log("TFE | SLACK WEB CHAT POST MESSAGE RESPONSE\n" + jsonPrint(chatPostMessageResponse));
          }

        }

        channelsHashMap.set(channel.id, channel);

      });

      resolve();

    }
    catch(err){
      console.log(chalkError("TFE | *** INIT SLACK WEB CLIENT ERROR: " + err));
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
        console.log(chalkInfo("TFE | SLACK RTM | INFO\n" + jsonPrint(slackInfo)));
      }

      slackRtmClient.on("slack_event", async function(eventType, event){
        switch (eventType) {
          case "pong":
            debug(chalkLog("TFE | SLACK RTM PONG | " + getTimeStamp() + " | " + event.reply_to));
          break;
          default: debug(chalkInfo("TFE | SLACK RTM EVENT | " + getTimeStamp() + " | " + eventType + "\n" + jsonPrint(event)));
        }
      });


      slackRtmClient.on("message", async function(message){
        if (configuration.verbose) { console.log(chalkLog("TFE | RTM R<\n" + jsonPrint(message))); }
        debug(`TFE | SLACK RTM MESSAGE | R< | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

        try {
          await slackMessageHandler(message);
        }
        catch(err){
          console.log(chalkError("TFE | *** SLACK RTM MESSAGE ERROR: " + err));
        }

      });

      slackRtmClient.on("ready", async function(){
        try {
          if (configuration.verbose) { slackSendRtmMessage(hostname + " | TFE | SLACK RTM READY"); }
          resolve();
        }
        catch(err){
          reject(err);
        }
      });


    }
    catch(err){
      console.log(chalkError("TFE | *** INIT SLACK RTM CLIENT | " + err));
      reject(err);
    }

  });
}

configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.processName = process.env.TFE_PROCESS_NAME || "tfe_node";
configuration.childPingAllInterval = DEFAULT_CHILD_PING_INTERVAL;
configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;
configuration.interruptFlag = false;

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;

if (process.env.TFE_QUIT_ON_COMPLETE !== undefined) {

  console.log(MODULE_ID_PREFIX + " | ENV TFE_QUIT_ON_COMPLETE: " + process.env.TFE_QUIT_ON_COMPLETE);

  if (!process.env.TFE_QUIT_ON_COMPLETE || (process.env.TFE_QUIT_ON_COMPLETE === false) || (process.env.TFE_QUIT_ON_COMPLETE === "false")) {
    configuration.quitOnComplete = false;
  }
  else {
    configuration.quitOnComplete = true;
  }
}

configuration.globalMinSuccessRate = (process.env.TFE_GLOBAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TFE_GLOBAL_MIN_SUCCESS_RATE 
  : DEFAULT_GLOBAL_MIN_SUCCESS_RATE;
configuration.localMinSuccessRate = (process.env.TFE_LOCAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TFE_LOCAL_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_MIN_SUCCESS_RATE;

// delete local nn's at start that are below  
configuration.localPurgeMinSuccessRate = (process.env.TFE_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TFE_LOCAL_PURGE_MIN_SUCCESS_RATE 
  : DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
configuration.DROPBOX.DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";


const statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed",
  "bestRuntimeNetworkId",
  "users",
  "status",
  "errors",
  "authenticated", 
  "numChildren", 
  "userReadyAck", 
  "userReadyAckWait", 
  "userReadyTransmitted",
  "queues"
];

statsObjSmall = pick(statsObj, statsPickArray);


// function dropboxListFolders(params){

//   return new Promise(function(resolve, reject){

//     if (configuration.offlineMode) {
//       dropboxClient = dropboxLocalClient;
//     }
//     else {
//       dropboxClient = dropboxRemoteClient;
//     }

//     console.log(chalkNetwork(MODULE_ID_PREFIX + " | GETTING DROPBOX FOLDERS ENTRIES ..."
//       + " | " + params.folders.length + " FOLDERS"
//       + "\n" + jsonPrint(params.folders)
//     ));

//     let totalEntries = [];
//     const promiseArray = [];

//     params.folders.forEach(function(folder){

//       const listDropboxFolderParams = {
//         folder: folder,
//         limit: DROPBOX_LIST_FOLDER_LIMIT
//       };

//       const p = listDropboxFolder(listDropboxFolderParams);
//       promiseArray.push(p);

//     });

//     Promise.all(promiseArray).
//     then(function(results){
//       results.forEach(function(folderListing){
//         console.log(chalkLog(MODULE_ID_PREFIX + " | RESULTS | ENTRIES: " + folderListing.entries.length));
//         totalEntries = _.concat(totalEntries, folderListing.entries);
//       });
//       resolve(totalEntries);
//     }).
//     catch(function(err){
//       reject(err);
//     });

//   });
// }

// function dropboxFileDelete(params){

//   return new Promise(function(resolve, reject){

//     if (!params || !params.folder || !params.file) {
//       return reject(new Error("params undefined"));
//     }

//     const path = params.folder + "/" + params.file;

//     dropboxClient.filesDelete({path: path}).
//     then(function(response){
//       console.log(chalkError(MODULE_ID_PREFIX + " | XXX DROPBOX FILE DELETE"
//         + " | " + path
//       ));
//       debug("dropboxClient filesDelete response\n" + jsonPrint(response));
//       return resolve();
//     }).
//     catch(function(err){
//       if (err.status === 409) {
//         console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX FILE DELETE"
//           + " | STATUS: " + err.status
//           + " | PATH: " + path
//           + " | DOES NOT EXIST"
//         ));
//       }
//       else if (err.status === 429) {
//         console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
//           + " | STATUS: " + err.status
//           + " | PATH: " + path
//           + " | TOO MANY REQUESTS"
//         ));
//       }
//       else {
//         console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
//           + " | STATUS: " + err.status
//           + " | PATH: " + path
//           + " | SUMMARY: " + err.response.statusText
//           + "\n" + jsonPrint(err)
//         ));
//       }
//       return reject(err);
//     });

//   });
// }

function loadInputsDropbox(params) {

  statsObj.status = "LOAD INPUTS CONFIG";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkNetwork("TFE | LOADING DROPBOX INPUTS CONFIG | " + folder + "/" + file + " ..."));

    try {

      const inputsConfigObj = await loadFile({folder: folder, file: file});

      if ((inputsConfigObj === undefined) || !inputsConfigObj) {
        console.log(chalkError("TFE | DROPBOX LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED"));
      }

      const tempInputsIdSet = new Set(inputsConfigObj.INPUTS_IDS);

      for (const inputsId of tempInputsIdSet) {
        inputsIdSet.add(inputsId);
      }

      console.log(chalkBlue("TFE | LOADED DROPBOX INPUTS CONFIG"
        + "\nTFE | CURRENT FILE INPUTS IDS SET: " + tempInputsIdSet.size + " INPUTS IDS"
        + "\n" + jsonPrint([...tempInputsIdSet])
        + "\nTFE | FINAL INPUTS IDS SET: " + inputsIdSet.size + " INPUTS IDS"
        + "\n" + jsonPrint([...inputsIdSet])
      ));


      resolve();
    }
    catch(err){
      if ((err.status === 409) || (err.status === 404)) {
        console.log(chalkError("TFE | DROPBOX LOAD INPUTS CONFIG FILE NOT FOUND"));
        return resolve();
      }
      console.log(chalkError("TFE | DROPBOX LOAD INPUTS CONFIG FILE ERROR: ", err));
      return reject(err);
    }
  });
}

// function dropboxLoadInputsFolder(params){

//   return new Promise(async function(resolve, reject){

//     statsObj.status = "LOAD INPUTS";

//     const folder = params.folder || defaultInputsFolder;

//     console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING DROPBOX INPUTS FOLDER | " + folder + " ..."));

//     const listDropboxFolderParams = {
//       folder: params.folder,
//       limit: DROPBOX_LIST_FOLDER_LIMIT
//     };

//     let skippedInputsFiles = 0;
//     let dropboxFolderResults;

//     try{
//       dropboxFolderResults = await listDropboxFolder(listDropboxFolderParams);
//     }
//     catch(err){
//       console.log(chalkError(MODULE_ID_PREFIX + " | ERROR LOADING DROPBOX INPUTS FOLDER | " + listDropboxFolderParams.folder + " | " + err));
//       return reject(err);
//     }

//     console.log(chalkBlue(MODULE_ID_PREFIX + " | DROPBOX LIST INPUTS FOLDER"
//       + " | ENTRIES: " + dropboxFolderResults.entries.length
//       + " | PATH:" + listDropboxFolderParams.folder
//     ));

//     async.eachSeries(dropboxFolderResults.entries, async function(entry){

//       debug(chalkInfo("entry: " + entry));

//       const entryNameArray = entry.name.split(".");
//       const entryInputsId = entryNameArray[0];

//       let inputsObj;

//       debug(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS FILE FOUND"
//         + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//         + " | INPUTS ID: " + entryInputsId
//         + " | " + entry.name
//       ));

//       if (configuration.testMode && (inputsHashMap.size >= TEST_DROPBOX_INPUTS_LOAD)){
//         if (configuration.verbose) {
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | TEST MODE SKIP LOAD INPUTS SET | " + entryInputsId));
//         }
//         skippedInputsFiles += 1;
//         return;
//       }
      
//       if (skipLoadInputsSet.has(entryInputsId)){
//         if (configuration.verbose) {
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | INPUTS IN SKIP LOAD INPUTS SET ... SKIPPING LOAD OF " + entryInputsId));
//         }
//         skippedInputsFiles += 1;
//         return;
//       }
      
//       if (!configuration.loadAllInputs && !configuration.inputsIdArray.includes(entryInputsId)){

//         if (configuration.verbose){
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
//             + " | " + entryInputsId
//             + " | " + defaultInputsArchiveFolder + "/" + entry.name
//           ));
//         }

//         skipLoadInputsSet.add(entryInputsId);
//         skippedInputsFiles += 1;

//         return;
//       }
      
//       if (inputsHashMap.has(entryInputsId)){

//         const curInputsObj = inputsHashMap.get(entryInputsId);

//         if ((curInputsObj.entry.content_hash !== entry.content_hash) && (curInputsObj.entry.path_display === entry.path_display)) {

//           console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS CONTENT CHANGE"
//             + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//             + " | " + entry.name
//             // + "\nCUR HASH: " + entry.content_hash
//             // + "\nOLD HASH: " + curInputsObj.entry.content_hash
//           ));

//           try {
//             inputsObj = await loadFileRetry({folder: folder, file: entry.name});
//           }
//           catch(err) {
//             console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
//             return;
//           }

//           if ((inputsObj === undefined) || !inputsObj) {
//             console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
//             return;
//           }

//           console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX INPUTS"
//             + " | " + entry.name
//             + " | " + inputsObj.inputsId
//           ));

//           if (inputsObj.meta === undefined) {
//             inputsObj.meta = {};
//             inputsObj.meta.numInputs = 0;
//             Object.keys(inputsObj.inputs).forEach(function(inputType){
//               inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
//             });
//           }

//           inputsHashMap.set(inputsObj.inputsId, {entry: entry, inputsObj: inputsObj} );

//           if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
//             inputsNetworksHashMap[inputsObj.inputsId] = new Set();
//           }

//           return;
//         }
        
//         if ((curInputsObj.entry.content_hash !== entry.content_hash) && (curInputsObj.entry.path_display !== entry.path_display)) {

//           console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX INPUTS CONTENT DIFF IN DIFF FOLDERS"
//             + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//           ));

//             // LOAD FROM BEST FOLDER AND SAVE LOCALLY
//           try {
//             inputsObj = await loadFileRetry({folder: folder, file: entry.name});
//           }
//           catch(err) {
//             console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
//             return;
//           }

//           if (err) {
//             console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
//             return;
//           }
//           else if ((inputsObj === undefined) || !inputsObj) {
//             console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
//             return;
//           }
//           else {

//             if (inputsObj.meta === undefined) {
//               inputsObj.meta = {};
//               inputsObj.meta.numInputs = 0;
//               Object.keys(inputsObj.inputs).forEach(function(inputType){
//                 inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
//               });
//             }

//             inputsHashMap.set(inputsObj.inputsId, {entry: entry, inputsObj: inputsObj} );

//             if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
//               inputsNetworksHashMap[inputsObj.inputsId] = new Set();
//             }

//             const inputTypes = Object.keys(inputsObj.inputs);

//             console.log(MODULE_ID_PREFIX + " | +++ INPUTS [" + inputsHashMap.count() + " INs IN HM] | " + inputsObj.meta.numInputs + " INPUTS | " + inputsObj.inputsId);

//             return;

//           }
//         }

//         debug(chalkLog(MODULE_ID_PREFIX + " | DROPBOX INPUTS CONTENT SAME  "
//           + " | " + entry.name
//           + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//         ));

//         return;
//       }


//       try {
//         inputsObj = await loadFileRetry({folder: folder, file: entry.name});
//       }
//       catch(err) {
//         console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
//         return;
//       }

//       if ((inputsObj === undefined) || !inputsObj) {
//         console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
//         return;
//       }

//       if (inputsObj.meta === undefined) {
//         inputsObj.meta = {};
//         inputsObj.meta.numInputs = 0;
//         Object.keys(inputsObj.inputs).forEach(function(inputType){
//           inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
//         });
//       }

//       inputsHashMap.set(inputsObj.inputsId, {entry: entry, inputsObj: inputsObj} );

//       if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
//         inputsNetworksHashMap[inputsObj.inputsId] = new Set();
//       }

//       const inputTypes = Object.keys(inputsObj.inputs);

//       console.log(MODULE_ID_PREFIX + " | +++ INPUTS [" + inputsHashMap.size + " IN HM] | " + inputsObj.meta.numInputs + " INPUTS | " + inputsObj.inputsId);

//       return;

//     }, function(err){

//       if (skippedInputsFiles > 0) {
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | SKIPPED LOAD OF " + skippedInputsFiles + " INPUTS FILES | " + folder));
//       }

//       if (configuration.verbose) {
//         printInputsHashMap();
//       }

//       resolve();
//     });

//   });
// }

// function dropboxLoadBestNetworkFolders(params){

//   return new Promise(async function(resolve, reject){

//     if (configuration.offlineMode) {
//       dropboxClient = dropboxLocalClient;
//     }
//     else {
//       dropboxClient = dropboxRemoteClient;
//     }

//     let numNetworksLoaded = 0;
//     let dropboxFoldersEntries;

//     console.log(chalkNetwork(MODULE_ID_PREFIX + " | LOADING DROPBOX NETWORK FOLDERS"
//       + " | " + params.folders.length + " FOLDERS"
//       + "\n" + jsonPrint(params.folders)
//     ));

//     try {
//       dropboxFoldersEntries = await listDropboxFolders(params);
//     }
//     catch(err){
//       return reject(err);
//     }

//     if (configuration.testMode) {
//       dropboxFoldersEntries = _.shuffle(dropboxFoldersEntries);
//     }

//     async.eachSeries(dropboxFoldersEntries, async function(entry){

//       if (configuration.testMode && (numNetworksLoaded >= TEST_DROPBOX_NN_LOAD)) {
//         // console.log(chalkInfo(MODULE_ID_PREFIX + " | !!! TEST MODE | LOADED " + numNetworksLoaded + " NNs"));
//         return "TEST_MODE";
//       }

//       debug("entry\n" + jsonPrint(entry));

//       if (entry.name === bestRuntimeNetworkFileName) {
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | SKIPPING LOAD OF " + entry.name));
//         return;
//       }

//       if (!entry.name.endsWith(".json")) {
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | SKIPPING LOAD OF " + entry.name));
//         return;
//       }

//       const folder = path.dirname(entry.path_display);

//       const entryNameArray = entry.name.split(".");
//       const networkId = entryNameArray[0];

//       if (configuration.verbose) {
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK FOUND"
//           + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//           + " | " + networkId
//           + " | FOLDER: " + folder
//           + " | " + entry.name
//         ));
//       }

//       if (skipLoadNetworkSet.has(networkId)){
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | DROPBOX NETWORK IN SKIP SET | SKIPPING ..."
//           + " | " + networkId
//           + " | FOLDER: " + folder
//           + " | " + entry.name
//         ));
//         return;
//       }

//       let networkObj;

//       try {

//         const networkHashResult = await checkNetworkHash({entry: entry});

//         if (networkHashResult === "same"){ // no change
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | NN NO CHANGE"
//             + " | " + networkId
//             + " | FOLDER: " + folder
//             + " | " + entry.name
//           ));
//           return;
//         }

//         networkObj = await loadFileRetry({path: entry.path_lower});

//         networkObj = await validateNetwork({networkId: networkId, networkObj: networkObj});

//         // invalid networkObj
//         if (!networkObj) {  
//           await purgeNetwork(networkId);
//           return;
//         }

//         // load only networks using specific inputIds; maybe delete if not in set
//         if (!configuration.inputsIdArray.includes(networkObj.inputsId)) {
//           if (configuration.deleteNotInInputsIdArray){
//             console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX NN INPUTS NOT IN INPUTS ID ARRAY ... DELETING"
//               + " | NUM INPUTS: " + networkObj.numInputs
//               + " | INPUTS ID: " + networkObj.inputsId
//               + " | " + entry.path_display
//             ));
//             return;
//             await dropboxFileDelete({folder: localBestNetworkFolder, file: entry.name});
//           }

//           console.log(chalkInfo(MODULE_ID_PREFIX + " | --- NN INPUTS NOT IN INPUTS ID ARRAY ... SKIPPING"
//             + " | NUM INPUTS: " + networkObj.numInputs
//             + " | INPUTS ID: " + networkObj.inputsId
//             + " | " + entry.path_display
//           ));

//           skipLoadNetworkSet.add(networkObj.networkId);
//           throw err;
//           return;
//         }

//         //========================
//         // SAVE LOCAL NETWORK TO GLOBAL
//         //========================

//         if (!networkHashMap.has(networkObj.networkId) 
//           && ((networkObj.successRate >= configuration.globalMinSuccessRate) 
//           || (networkObj.overallMatchRate >= configuration.globalMinSuccessRate))) {

//           networkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

//           printNetworkObj(MODULE_ID_PREFIX + " | SAVE LOCAL NETWORK TO GLOBAL", networkObj, chalkGreen);

//           saveFileQueue.push({localFlag: false, folder: globalBestNetworkFolder, file: entry.name, obj: networkObj});
//         }

//         //========================
//         // NETWORK MISMATCH GLOBAL/LOCAL
//         //========================

//         if (networkHashResult === "mismatch"){
//           console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX GLOBAL/LOCAL NETWORK MISMATCH ... DELETING"
//             + " | INPUTS: " + networkObj.numInputs
//             + " | INPUTS ID: " + networkObj.inputsId
//             + " | " + entry.path_display
//           ));
//           await dropboxFileDelete({folder: localBestNetworkFolder, file: entry.name});
//           return;
//         }

//         //========================
//         // NETWORK PASS SUCCESS or MATCH MIN
//         //========================

//         const passed = networkPass({folder: folder, purgeMin: params.purgeMin, networkObj: networkObj});

//         if (passed) {

//           numNetworksLoaded += 1;

//           networkHashMap.set(networkObj.networkId, { entry: entry, networkObj: networkObj});

//           printNetworkObj(MODULE_ID_PREFIX + " | +++ NN HASH MAP [" + numNetworksLoaded + " LOADED / " + networkHashMap.size + " IN HM]", networkObj);

//           if (!currentBestNetwork || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {
//             currentBestNetwork = networkObj;
//             printNetworkObj(MODULE_ID_PREFIX + " | *** NEW BEST NN", networkObj, chalkGreen);
//           }

//           //========================
//           // UPDATE INPUTS HASHMAP
//           //========================

//           let inObj = {};

//           if (inputsHashMap.has(networkObj.inputsId)) {
//             inObj = inputsHashMap.get(networkObj.inputsId);
//             inObj.inputsObj = networkObj.inputsObj;
//             inObj.entry.content_hash = false;
//             inObj.entry.client_modified = moment();
//           }
//           else {
//             inObj.inputsObj = {};
//             inObj.inputsObj = networkObj.inputsObj;
//             inObj.entry = {};
//             inObj.entry.name = networkObj.inputsId + ".json";
//             inObj.entry.content_hash = false;
//             inObj.entry.client_modified = moment();
//           }

//           inputsHashMap.set(networkObj.inputsId, inObj);

//           if (inputsNetworksHashMap[networkObj.inputsId] === undefined) {
//             inputsNetworksHashMap[networkObj.inputsId] = new Set();
//           }

//           inputsNetworksHashMap[networkObj.inputsId].add(networkObj.networkId);

//           //========================
//           // UPDATE DB
//           //========================
//           let nnDb;

//           try {
//             nnDb = await updateDbNetwork({networkObj: networkObj, verbose: configuration.testMode});
//           }
//           catch(err){
//             console.log(chalkError("*** ERROR: DB NN FIND ONE ERROR | "+ networkObj.networkId + " | " + err));
//             return err;
//           }

//           if (nnDb) {

//             if (!currentBestNetwork || (nnDb.overallMatchRate > currentBestNetwork.overallMatchRate)) {
//               currentBestNetwork = nnDb;
//               printNetworkObj(MODULE_ID_PREFIX + " | *** NEW BEST NN (DB)", nnDb, chalkGreen);
//             }

//             networkHashMap.set(nnDb.networkId, { entry: entry, networkObj: nnDb});
//           }
//           return;
//         }

//         //========================
//         // PURGE FAILING NETWORKS
//         //========================

//         if (((hostname === PRIMARY_HOST) && (folder === globalBestNetworkFolder))
//           || ((hostname !== PRIMARY_HOST) && (folder === localBestNetworkFolder)) ) {

//           printNetworkObj(MODULE_ID_PREFIX + " | DELETING NN", networkObj);

//           await purgeNetwork(networkObj.networkId);
//           await purgeInputs(networkObj.inputsId);
//           await dropboxFileDelete({folder: folder, file: entry.name});
//           return;
//         }

//         printNetworkObj(MODULE_ID_PREFIX + " | --- NN HASH MAP [" + numNetworksLoaded + " LOADED / " + networkHashMap.size + " IN HM]", nnDb);

//         return;
//       }
//       catch(err){
//         return err;
//       }

//     }, function(err){
//       if (err) { 
//         if (err == "TEST_MODE") {
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | !!! TEST MODE | LOADED " + numNetworksLoaded + " NNs"));
//           return resolve(numNetworksLoaded);
//         }
//         console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR LOAD DROPBOX FOLDERS: " + err)); 
//         return reject(err);
//       }
//       resolve(numNetworksLoaded);
//     });

//   });
// }

const networkDefaults = function (networkObj){

  if (networkObj.betterChild === undefined) { networkObj.betterChild = false; }
  if (networkObj.testCycles === undefined) { networkObj.testCycles = 0; }
  if (networkObj.testCycleHistory === undefined) { networkObj.testCycleHistory = []; }
  if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
  if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
  if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

  return networkObj;
};

function printNetworkObj(title, nObj, format) {

  const chalkFormat = (format !== undefined) ? format : chalkNetwork;

  const networkObj = networkDefaults(nObj);

  console.log(chalkFormat(title
    + " | ARCHIVED: " + networkObj.archived
    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
    + " | CR: " + getTimeStamp(networkObj.createdAt)
    + " | TC:  " + networkObj.testCycles
    + " | TCH: " + networkObj.testCycleHistory.length
    + " | INPUTS: " + networkObj.numInputs
    + " | IN ID:  " + networkObj.inputsId
    + " | " + networkObj.networkId
  ));
}

// function indexOfMax (arr, callback) {

//   if (arr.length === 0) {
//     console.log(chalkAlert(MODULE_ID_PREFIX + " | indexOfMax: 0 LENG ARRAY: -1"));
//     return callback(-2, arr); 
//   }

//   if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
//     debug(chalkInfo(MODULE_ID_PREFIX + " | indexOfMax: ALL EQUAL"));
//     debug(chalkInfo(MODULE_ID_PREFIX + " | ARR" 
//       + " | " + arr[0].toFixed(2) 
//       + " - " + arr[1].toFixed(2) 
//       + " - " + arr[2].toFixed(2)
//     ));
//     if (arr[0] === 0) { return callback(-4, arr); }
//     return callback(4, [1,1,1]); 
//   }

//   debug(MODULE_ID_PREFIX + " | B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
//   arrayNormalize(arr);
//   debug(MODULE_ID_PREFIX + " | AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

//   if (((arr[0] === 1) && (arr[1] === 1)) 
//     || ((arr[0] === 1) && (arr[2] === 1))
//     || ((arr[1] === 1) && (arr[2] === 1))){

//     debug(chalkAlert(MODULE_ID_PREFIX + " | indexOfMax: MULTIPLE SET"));

//     debug(chalkAlert(MODULE_ID_PREFIX + " | ARR" 
//       + " | " + arr[0].toFixed(2) 
//       + " - " + arr[1].toFixed(2) 
//       + " - " + arr[2].toFixed(2)
//     ));

//     async.eachOf(arr, function(val, index, cb0){
//       if (val < 1) {
//         arr[index] = 0;
//       }
//       cb0(); 
//     }, function(){
//       callback(3, arr); 
//     });

//   }
//   else {

//     let max = 0;
//     let maxIndex = -1;

//     async.eachOfSeries(arr, function(val, index, cb1){
//       if (val > max) {
//         maxIndex = index;
//         max = val;
//       }
//       cb1(); 
//     }, function(){

//       async.eachOf(arr, function(val, index, cb2){
//         if (val < 1) {
//           arr[index] = 0;
//         }
//         cb2(); 
//       }, function(){
//         callback(maxIndex, arr); 
//       });

//     });

//   }
// }

// const sortedObjectValues = function(params) {

//   return new Promise(function(resolve, reject) {

//     const keys = Object.keys(params.obj);

//     const sortedKeys = keys.sort(function(a,b){
//       const objA = params.obj[a];
//       const objB = params.obj[b];
//       return objB[params.sortKey] - objA[params.sortKey];
//     });

//     if (keys.length !== undefined) {
//       if (sortedKeys !== undefined) { 
//         resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
//       }
//       else {
//         resolve({sortKey: params.sortKey, sortedKeys: []});
//       }

//     }
//     else {
//       console.error("sortedObjectValues ERROR | params\n" + jsonPrint(params));
//       reject(new Error("sortedObjectValues ERROR | keys.length UNDEFINED"));
//     }

//   });
// };

// function sortedHashmap(params) {

//   return new Promise(function(resolve, reject) {

//     const keys = params.hashmap.keys();

//     const sortedKeys = keys.sort(function(a,b){
//       const objA = params.hashmap.get(a);
//       const objB = params.hashmap.get(b);
//       const objAvalue = dot.pick(params.sortKey, params.hashmap.get(a));
//       const objBvalue = dot.pick(params.sortKey, params.hashmap.get(b));
//       return objBvalue - objAvalue;
//     });

//     if (keys !== undefined) {
//       if (sortedKeys !== undefined) { 
//         resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
//       }
//       else {
//         console.log(chalkAlert("sortedHashmap NO SORTED KEYS? | SORT KEY: " + params.sortKey + " | KEYS: " + keys.length + " | SORTED KEYS: " + sortedKeys.length));
//         resolve({sortKey: params.sortKey, sortedKeys: []});
//       }

//     }
//     else {
//       console.error("sortedHashmap ERROR | params\n" + jsonPrint(params));
//       reject(new Error("sortedHashmap ERROR | keys UNDEFINED"));
//     }

//   });
// }

// function printInputsHashMap(){

//   const tableArray = [];

//   tableArray.push([
//     MODULE_ID_PREFIX + " | INPUTS ID",
//     "INPTS"
//   ]);

//   async.each(inputsHashMap.keys(), function(inputsId, cb){

//     const inputsObj = inputsHashMap.get(inputsId).inputsObj;

//     tableArray.push([
//       MODULE_ID_PREFIX + " | " + inputsId,
//       inputsObj.meta.numInputs
//     ]);

//     async.setImmediate(function() { cb(); });

//   }, function(){

//     const t = table(tableArray, { align: ["l", "r"] });

//     console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ============================================================================================================================================"));
//     console.log(chalkBlueBold(MODULE_ID_PREFIX + " | INPUTS HASHMAP"));
//     console.log(chalkInfo(t));
//     console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ============================================================================================================================================"));

//   });
// }

// function purgeNetwork(networkId){

//   return new Promise(function(resolve, reject){

//     try {
//       console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX PURGE NETWORK: " + networkId));

//       networkHashMap.delete(networkId);

//       betterChildSeedNetworkIdSet.delete(networkId);

//       skipLoadNetworkSet.add(networkId);

//       if (resultsHashmap[networkId] !== undefined) { 
//         resultsHashmap[networkId].status = "PURGED";
//       }
//       resolve();
//     }
//     catch(err){
//       return reject(err);
//     }

//   });
// }

// function purgeInputs(inputsId){

//   return new Promise(function(resolve, reject){

//     try {
//       if (!configuration.inputsIdArray.includes(inputsId)){
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX PURGE INPUTS: " + inputsId));
//         inputsHashMap.delete(inputsId);
//         skipLoadInputsSet.add(inputsId);
//       }
//       else {
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | ** NO XXX PURGE INPUTS ... IN CONFIGURATION INPUTS ID ARRAY" 
//           + " | INPUTS ID: " + inputsId
//         ));

//         if (configuration.verbose) {
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | CONFIGURATION INPUTS ID ARRAY\n" + jsonPrint(configuration.inputsIdArray) ));
//         }
//       }
//       resolve();
//     }
//     catch(err){
//       return reject(err);
//     }

//   });

// }

// const userWatchPropertyArray = [
//   "bannerImageUrl",
//   "category", 
//   "description",
//   "expandedUrl",
//   "followersCount", 
//   "following", 
//   "friendsCount", 
//   "isTopTerm",
//   "lastTweetId",
//   "location",
//   "profileUrl",
//   "quotedStatusId",
//   "statusesCount",
//   "statusId",
//   "threeceeFollowing",
//   "url",
//   "verified"
// ];

function updateDbNetwork(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "UPDATE DB NETWORKS";

    const networkObj = params.networkObj;
    const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;
    const testHistoryItem = (params.testHistoryItem !== undefined) ? params.testHistoryItem : false;
    const addToTestHistory = (params.addToTestHistory !== undefined) ? params.addToTestHistory : true;
    const verbose = params.verbose || false;

    if (verbose) { printNetworkObj(MODULE_ID_PREFIX + " | >>> NN DB UPDATE ", params.networkObj, chalkInfo); }

    const query = { networkId: networkObj.networkId };

    const update = {};

    update.$setOnInsert = { 
      seedNetworkId: networkObj.seedNetworkId,
      seedNetworkRes: networkObj.seedNetworkRes,
      network: networkObj.network,
      successRate: networkObj.successRate, 
      numInputs: networkObj.numInputs,
      numOutputs: networkObj.numOutputs,
      inputsId: networkObj.inputsId,
      inputsObj: networkObj.inputsObj,
      outputs: networkObj.outputs,
      evolve: networkObj.evolve,
      test: networkObj.test
    };

    update.$set = { 
      archived: networkObj.archived,
      matchRate: networkObj.matchRate, 
      overallMatchRate: networkObj.overallMatchRate,
    };

    if (incrementTestCycles) { update.$inc = { testCycles: 1 }; }
    
    if (testHistoryItem) { 
      update.$push = { testCycleHistory: testHistoryItem };
    }
    else if (addToTestHistory) {
      update.$addToSet = { testCycleHistory: { $each: networkObj.testCycleHistory } };
    }

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    global.globalNeuralNetwork.findOneAndUpdate(query, update, options, function(err, nnDbUpdated){

      if (err) {
        console.log(chalkError("*** updateDbNetwork | NETWORK FIND ONE ERROR: " + err));
        return reject(err);
      }

      if (verbose) { printNetworkObj(MODULE_ID_PREFIX + " | +++ NN DB UPDATED", nnDbUpdated, chalkGreen); }

      resolve(nnDbUpdated);
    });

  });
}

// function validateNetwork(params){

//   return new Promise(function(resolve, reject){

//     if (!params || params === undefined || params.networkObj === undefined || params.networkId === undefined) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | validateNetwork *** PARAMS UNDEFINED ??? "));
//       return reject(new Error("params undefined"));
//     }

//     const networkObj = params.networkObj;

//     if (networkObj.networkId !== params.networkId) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK ID MISMATCH"
//         + " | " + networkObj.networkId 
//         + " | " + params.networkId
//       ));
//       return resolve();
//     }

//     if (networkObj.numInputs === undefined) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK NETWORK numInputs UNDEFINED"
//         + " | " + networkObj.networkId
//       ));
//       return resolve();
//     }

//     if (networkObj.inputsId === undefined) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK INPUTS ID UNDEFINED"
//         + " | " + networkObj.networkId));
//       return resolve();
//     }

//     const nnObj = networkDefaults(networkObj);

//     resolve(nnObj);

//   });
// }

// function checkNetworkHash(params){

//   return new Promise(function(resolve, reject){

//     if (!params || params === undefined || params.entry === undefined) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | checkNetworkHash *** PARAMS UNDEFINED ??? "));
//       return reject(new Error("params undefined"));
//     }

//     const entry = params.entry;

//     debug("entry\n" + jsonPrint(entry));

//     if (entry.name === bestRuntimeNetworkFileName) {
//       console.log(chalkInfo(MODULE_ID_PREFIX + " | SKIPPING LOAD OF " + entry.name));
//       return;
//     }

//     if (!entry.name.endsWith(".json")) {
//       console.log(chalkInfo(MODULE_ID_PREFIX + " | SKIPPING LOAD OF " + entry.name));
//       return;
//     }

//     const entryNameArray = entry.name.split(".");
//     const networkId = entryNameArray[0];

//     if (!networkHashMap.has(networkId)){
//       // console.log(chalkInfo(MODULE_ID_PREFIX + " | NOT IN HASH " + entry.name));
//       return resolve("miss");
//     }

//     const networkObj = bestNetworkHashMap.get(networkId);
//     let oldContentHash = false;

//     if ((networkObj.entry.path_display === entry.path_display) 
//       && (networkObj.entry !== undefined) && (networkObj.entry.content_hash !== undefined)){
//       oldContentHash = networkObj.entry.content_hash;
//     }

//     if (oldContentHash && (oldContentHash !== entry.content_hash) 
//       && (networkObj.entry.path_display === entry.path_display)) {

//       console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX NETWORK CONTENT CHANGE"
//         + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//         + " | " + entry.path_display
//       ));

//       return resolve("stale");

//     }
    
//     if (oldContentHash && (oldContentHash !== entry.content_hash) 
//       && (networkObj.entry.path_display !== entry.path_display)) {

//       console.log(chalkNetwork(MODULE_ID_PREFIX + " | DROPBOX NETWORK CONTENT DIFF IN DIFF params.folders"
//         + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//       ));

//       return resolve("mismatch");

//     }

//     console.log(chalkLog(MODULE_ID_PREFIX + " | DROPBOX NETWORK CONTENT SAME  "
//       + " | " + entry.name
//       + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
//     ));

//     resolve("same");

//   });
// }

// function networkPass(params) {
//   const pass = ((params.folder === "/config/utility/best/neuralNetworks") && (params.networkObj.successRate > configuration.globalMinSuccessRate))
//   || ((params.folder === "/config/utility/best/neuralNetworks") && (params.networkObj.matchRate > configuration.globalMinSuccessRate))
//   || (params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.successRate > configuration.localPurgeMinSuccessRate))
//   || (params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.matchRate > configuration.localPurgeMinSuccessRate))
//   || (!params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.successRate > configuration.localMinSuccessRate))
//   || (!params.purgeMin && (params.folder !== "/config/utility/best/neuralNetworks") && (params.networkObj.matchRate > configuration.localMinSuccessRate));

//   return pass;
// }

// let sizeInterval;

// function fileSize(params){

//   return new Promise(async function(resolve, reject){

//     clearInterval(sizeInterval);

//     const interval = params.interval || ONE_MINUTE;

//     console.log(chalkLog(MODULE_ID_PREFIX + " | WAIT FILE SIZE: " + params.path + " | EXPECTED SIZE: " + params.size));

//     let stats;
//     let size;
//     let prevSize;

//     try {
//       stats = fs.statSync(params.path);
//       size = stats.size;
//       prevSize = stats.size;

//       if (params.size && (size === params.size)) {
//         console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE EXPECTED | " + getTimeStamp()
//           + " | CUR: " + size
//           + " | EXPECTED: " + params.size
//         ));
//         return resolve();
//       }
//     }
//     catch(err){
//       return reject(err);
//     }


//     sizeInterval = setInterval(async function(){

//       console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE | " + getTimeStamp()
//         + " | CUR: " + size
//         + " | PREV: " + prevSize
//         + " | EXPECTED: " + params.size
//       ));

//       fs.stat(params.path, function(err, stats){

//         if (err) {
//           return reject(err);
//         }

//         prevSize = size;
//         size = stats.size;

//         if ((size > 0) && ((params.size && (size === params.size)) || (size === prevSize))) {

//           clearInterval(sizeInterval);

//           console.log(chalkInfo(MODULE_ID_PREFIX + " | FILE SIZE STABLE | " + getTimeStamp()
//             + " | CUR: " + size
//             + " | PREV: " + prevSize
//             + " | EXPECTED: " + params.size
//           ));

//           resolve();
//         }

//       });

//     }, interval);

//   });
// }

// function loadUsersArchive(params){

//   return new Promise(async function(resolve, reject){

//     console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING USERS ARCHIVE | " + getTimeStamp() + " | " + params.path));

//     try {
//       await fileSize(params);
//       const unzipSuccess = await unzipUsersToArray(params);
//       await updateTrainingSet();
//       resolve();
//     }
//     catch(err){
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD USERS ARCHIVE ERROR | " + getTimeStamp() + " | " + err));
//       reject(err);
//     }

//   });
// }

// function loadInputsDropboxFile(params){
//   return new Promise(async function(resolve, reject){

//     let inputsObj;

//     try {
//       inputsObj = await loadFileRetry({folder: params.folder, file: params.file});
//     }
//     catch(err) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR: " + err));
//       return reject(err);
//     }

//     if ((inputsObj === undefined) || !inputsObj) {
//       console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX INPUTS LOAD FILE ERROR | JSON UNDEFINED ??? "));
//       return reject(new Error("JSON UNDEFINED"));
//     }

//     if (inputsObj.meta === undefined) {
//       inputsObj.meta = {};
//       inputsObj.meta.numInputs = 0;
//       Object.keys(inputsObj.inputs).forEach(function(inputType){
//         inputsObj.meta.numInputs += inputsObj.inputs[inputType].length;
//       });
//     }

//     if (inputsHashMap.has(inputsObj.inputsId) && (params.entry === undefined)){
//       params.entry = inputsHashMap.get(inputsObj.inputsId).entry;
//     }

//     inputsHashMap.set(inputsObj.inputsId, {entry: params.entry, inputsObj: inputsObj} );

//     if (inputsNetworksHashMap[inputsObj.inputsId] === undefined) {
//       inputsNetworksHashMap[inputsObj.inputsId] = new Set();
//     }

//     console.log(MODULE_ID_PREFIX + " | +++ INPUTS [" + inputsHashMap.size + " IN HM] | " + inputsObj.meta.numInputs + " INPUTS | " + inputsObj.inputsId);

//     resolve(inputsObj);

//   });
// }

// function loadNetworkInputsConfig(){

//   return new Promise(async function(resolve, reject){

//     statsObj.status = "LOAD NETWORK INPUTS CONFIG";

//     console.log(chalkLog(MODULE_ID_PREFIX
//       + " | LOAD NETWORK INPUTS CONFIG FILE: " + dropboxConfigDefaultFolder + "/" + defaultNetworkInputsConfigFile
//     ));

//     let networkInputsObj;

//     try{
//       networkInputsObj = await loadFileRetry({folder: dropboxConfigDefaultFolder, file: defaultNetworkInputsConfigFile});

//       configuration.inputsIdArray = networkInputsObj.INPUTS_IDS;

//       console.log(chalkNetwork(MODULE_ID_PREFIX + " | LOADED NETWORK INPUTS ARRAY\n" + jsonPrint(configuration.inputsIdArray)));
//       statsObj.networkInputsSetReady = true;
//       resolve();
//     }
//     catch(err){
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** NETWORK INPUTS CONFIG FILE LOAD ERROR: " + err));
//       statsObj.networkInputsSetReady = false;
//       return reject(err);
//     }

//   });
// }

// const watchOptions = {
//   ignoreDotFiles: true,
//   ignoreUnreadableDir: true,
//   ignoreNotPermitted: true,
// }

// function initWatchAllConfigFolders(params){
//   return new Promise(async function(resolve, reject){

//     params = params || {};

//     console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH ALL CONFIG FILES\n" + jsonPrint(params)));

//     try{

//       await loadAllConfigFiles();
//       await loadNetworkInputsConfig();
//       await loadCommandLineArgs();

//       const options = {
//         ignoreDotFiles: true,
//         ignoreUnreadableDir: true,
//         ignoreNotPermitted: true,
//       }

//       watch.createMonitor(DROPBOX_ROOT_FOLDER + defaultInputsFolder, options, function (monitorInputs) {

//         console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH INPUTS CONFIG FOLDER: " + DROPBOX_ROOT_FOLDER + defaultInputsFolder));

//         monitorInputs.on("created", async function(f, stat){
//           const fileNameArray = f.split("/");
//           const file = fileNameArray[fileNameArray.length-1];
//           if (file.startsWith("inputs_")) {
//             console.log(chalkBlue(MODULE_ID_PREFIX + " | +++ INPUTS FILE CREATED: " + f));
//             await loadInputsDropboxFile({folder: defaultInputsFolder, file: file});
//           }

//         });

//         monitorInputs.on("changed", async function(f, stat){
//           const fileNameArray = f.split("/");
//           const file = fileNameArray[fileNameArray.length-1];
//           if (file.startsWith("inputs_")) {
//             console.log(chalkBlue(MODULE_ID_PREFIX + " | -/- INPUTS FILE CHANGED: " + f));
//             await loadInputsDropboxFile({folder: defaultInputsFolder, file: file});
//           }
//         });

//         monitorInputs.on("removed", function (f, stat) {
//           const fileNameArray = f.split("/");
//           const inputsId = fileNameArray[fileNameArray.length-1].replace(".json", "");
//           console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX INPUTS FILE DELETED | " + getTimeStamp() 
//             + " | " + inputsId 
//             + "\n" + f
//           ));
//           inputsHashMap.delete(inputsId);
//         });
//       });

//       watch.createMonitor(DROPBOX_ROOT_FOLDER + dropboxConfigDefaultFolder, options, function (monitorDefaultConfig) {

//         console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH DEFAULT CONFIG FOLDER: " + DROPBOX_ROOT_FOLDER + dropboxConfigDefaultFolder));

//         monitorDefaultConfig.on("created", async function(f, stat){
//           if (f.endsWith(dropboxConfigDefaultFile)){
//             await loadAllConfigFiles();
//             await loadCommandLineArgs();
//           }

//           if (f.endsWith(defaultNetworkInputsConfigFile)){
//             await loadNetworkInputsConfig();
//           }

//         });

//         monitorDefaultConfig.on("changed", async function(f, stat){
//           if (f.endsWith(dropboxConfigDefaultFile)){
//             await loadAllConfigFiles();
//             await loadCommandLineArgs();
//           }

//           if (f.endsWith(defaultNetworkInputsConfigFile)){
//             await loadNetworkInputsConfig();
//           }

//         });

//         monitorDefaultConfig.on("removed", function (f, stat) {
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
//         });
//       });

//       watch.createMonitor(DROPBOX_ROOT_FOLDER + dropboxConfigHostFolder, options, function (monitorHostConfig) {

//         console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT WATCH HOSE CONFIG FOLDER: " + DROPBOX_ROOT_FOLDER + dropboxConfigHostFolder));

//         monitorHostConfig.on("created", async function(f, stat){
//           if (f.endsWith(dropboxConfigHostFile)){
//             await loadAllConfigFiles();
//             await loadCommandLineArgs();
//           }
//         });

//         monitorHostConfig.on("changed", async function(f, stat){
//           if (f.endsWith(dropboxConfigHostFile)){
//             await loadAllConfigFiles();
//             await loadCommandLineArgs();
//           }
//         });

//         monitorHostConfig.on("removed", function (f, stat) {
//           console.log(chalkInfo(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
//         });
//       });

//       resolve();
//     }
//     catch(err){
//       console.log(chalkError(MODULE_ID_PREFIX
//         + " | *** INIT LOAD ALL CONFIG INTERVAL ERROR: " + err
//       ));
//       return reject(err);
//     }
//   });
// }

function initCategorizedUserHashmap(){

  return new Promise(function(resolve, reject){

    statsObj.status = "INIT CATEGORIZED USER HASHMAP";

    const p = {};
    p.query = {};
    p.query.$and = [
      { category: { "$in": ["left", "right", "neutral"] } },
      { following: true },
      { ignored: false }
    ];

    p.skip = 0;
    p.limit = DEFAULT_FIND_CAT_USER_CURSOR_LIMIT;
    p.batchSize = DEFAULT_CURSOR_BATCH_SIZE;
    // p.projection = "userId nodeId screenName name lang description location tweets category categoryAuto mentions friendsCount followersCount statusesCount ignored profileHistograms tweetHistograms following threeceeFollowing";

    let more = true;
    statsObj.users.categorized.total = 0;
    statsObj.users.categorized.manual = 0;
    statsObj.users.categorized.auto = 0;
    statsObj.users.categorized.matched = 0;
    statsObj.users.categorized.mismatched = 0;
    statsObj.users.categorized.matchRate = 0;

    const childParams = {};
    childParams.command = {};
    childParams.command.childId = "tfe_node_child_altthreecee00"
    childParams.command.op = "FETCH_USER_TWEETS";
    childParams.command.userIdArray = [];

    async.whilst(

      function() {
        return more;
      },

      function(cb){

        userServerController.findCategorizedUsersCursor(p, function(err, results){

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | ERROR: initCategorizedUserHashmap: " + err));
            cb(err);
          }
          else if ((!configuration.testMode && results) || (configuration.testMode && (statsObj.users.categorized.total < TEST_TOTAL_FETCH)) ) {

            more = true;
            statsObj.users.categorized.total += results.count;
            statsObj.users.categorized.manual += results.manual;
            statsObj.users.categorized.auto += results.auto;
            statsObj.users.categorized.matched += results.matched;
            statsObj.users.categorized.mismatched += results.mismatched;

            statsObj.users.categorized.matchRate = 100*(statsObj.users.categorized.matched/statsObj.users.categorized.total);

            childParams.command.userIdArray = [];

            Object.keys(results.obj).forEach(function(nodeId){
              categorizedUserHashmap.set(nodeId, results.obj[nodeId]);
              childParams.command.userIdArray.push(nodeId);
            });

            childSend(childParams).
            then(function(){
              if (configuration.verbose || (statsObj.users.categorized.total % 1000 === 0)) {

                console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
                  + " | UIDs: " + childParams.command.userIdArray.length
                  + " | TOT CAT: " + statsObj.users.categorized.total
                  + " | LIMIT: " + p.limit
                  + " | SKIP: " + p.skip
                  + " | " + statsObj.users.categorized.manual + " MAN"
                  + " | " + statsObj.users.categorized.auto + " AUTO"
                  + " | " + statsObj.users.categorized.matched + " MATCHED"
                  + " / " + statsObj.users.categorized.mismatched + " MISMATCHED"
                  + " | " + statsObj.users.categorized.matchRate.toFixed(2) + "% MATCHRATE"
                ));
              }

              p.skip += results.count;
              cb();

            }).
            catch(function(e){
              console.log(chalkError(MODULE_ID_PREFIX + " | ERROR: childSend FETCH_USER_TWEETS ERROR: " + e));
              return cb(err);
            });
          }
          else {

            more = false;

            console.log(chalkBlueBold(MODULE_ID_PREFIX + " | +++ LOADED CATEGORIZED USERS FROM DB"
              + " | TOT CAT: " + statsObj.users.categorized.total
              + " | " + statsObj.users.categorized.manual + " MAN"
              + " | " + statsObj.users.categorized.auto + " AUTO"
              + " | " + statsObj.users.categorized.matched + " MATCHED"
              + " / " + statsObj.users.categorized.mismatched + " MISMATCHED"
              + " | " + statsObj.users.categorized.matchRate.toFixed(2) + "% MATCHRATE"
            ));

            cb();
          }

        });
      },

      function(err){
        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | INIT CATEGORIZED USER HASHMAP ERROR: " + err + "\n" + jsonPrint(err)));
          return reject(err);
        }
        resolve();
      }
    );

  });
}

// function allComplete(){

//   getChildProcesses(function(err, childArray){

//     if (Object.keys(childHashMap).length !== 0 ) { 
//       allCompleteFlag = false;
//       console.log(chalkBlue(MODULE_ID_PREFIX + " | allComplete: " + allCompleteFlag + " | NN CHILDREN IN HM: " + jsonPrint(Object.keys(childHashMap))));
//       return;
//     }

//     if (childArray.length === 0 ) { 
//       allCompleteFlag = true;
//       console.log(chalkBlue(MODULE_ID_PREFIX + " | allComplete | NO NN CHILDREN PROCESSES"));
//       return;
//     }

//     const index = 0;

//     async.each(Object.keys(childHashMap), function(childId, cb){

//       if (configuration.verbose) {
//         console.log(chalkLog(MODULE_ID_PREFIX + " | allComplete"
//           + " | NNC " + childId 
//           + " STATUS: " + childHashMap[childId].status
//         ));
//       }

//       if (childHashMap[childId].status === "RUNNING"){
//         allCompleteFlag = false;
//         return cb("RUNNING");
//       }
//       cb();

//     }, function(running){
//       if (!running) { allCompleteFlag = true; }
//       return;
//     });

//   });
// }

// function printchildHashMap(){

//   const childIdArray = Object.keys(childHashMap).sort();

//   let chalkValue = chalkLog;

//   async.eachSeries(childIdArray, function(childId, cb){

//     switch (childHashMap[childId].status) {
//       case "IDLE":
//         chalkValue = chalk.blue;
//       break;
//       case "NEW":
//         chalkValue = chalk.bold.green;
//       break;
//       case "TEST PASS":
//       case "PASS LOCAL":
//       case "RUNNING":
//         chalkValue = chalk.green;
//       break;
//       case "PASS GLOBAL":
//         chalkValue = chalk.bold.green;
//       break;
//       case "INIT":
//       case "COMPLETE":
//       case "EXIT":
//         chalkValue = chalk.blue;
//       break;
//       case "ERROR":
//         chalkValue = chalkError;
//       break;
//       case "ZOMBIE":
//       case "CLOSE":
//       case "DEAD":
//         chalkValue = chalkAlert;
//       break;
//       default:
//         console.log(chalkWarn("??? UNKNOWN CHILD STATUS: " + childHashMap[childId].status));
//         chalkValue = chalkInfo;
//     }

//     console.log(chalkValue(MODULE_ID_PREFIX + " | CHILD HM"
//       + " | CHILD ID: " + childId
//       + " | PID: " + childHashMap[childId].pid
//       + " | STATUS: " + childHashMap[childId].status
//     ));

//     cb();

//   }, function(){

//   });
// }

//=========================================================================
//=========================================================================
//const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

process.title = MODULE_ID.toLowerCase() + "_" + process.pid;

process.on("exit", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS EXIT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
});

process.on("close", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS CLOSE"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
});

process.on("SIGHUP", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGHUP"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "SIGINT"});
});

process.on( "SIGINT", function(code, signal) {
  console.log(chalkAlert(MODULE_ID_PREFIX
    + " | PROCESS SIGINT"
    + " | " + getTimeStamp()
    + " | " + `CODE: ${code}`
    + " | " + `SIGNAL: ${signal}`
  ));
  quit({cause: "SIGINT"});
});

process.on("unhandledRejection", function(err, promise) {
  console.trace(MODULE_ID_PREFIX + " | *** Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  quit("unhandledRejection");
  process.exit(1);
});

//=========================================================================
// CONFIGURATION
//=========================================================================

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");

let defaultConfiguration = {}; // general configuration for TFE
let hostConfiguration = {}; // host-specific configuration for TFE

configuration.slackChannel = {};

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

    if (debug.enabled) {
      console.log("\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n");
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

//=========================================================================
// MONGO DB
//=========================================================================

global.globalDbConnection = false;
const mongoose = require("mongoose");
mongoose.set("useFindAndModify", false);

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

global.globalWordAssoDb = require("@threeceelabs/mongoose-twitter");

const UserServerController = require("@threeceelabs/user-server-controller");
let userServerController;
let userServerControllerReady = false;

const TweetServerController = require("@threeceelabs/tweet-server-controller");
let tweetServerController;
let tweetServerControllerReady = false;

function connectDb(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      global.globalWordAssoDb.connect(MODULE_ID + "_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          // dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
          db.close();
          // dbConnectionReady = false;
          quit({cause: "MONGO DB ERROR: " + err});
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
          // dbConnectionReady = false;
          quit({cause: "MONGO DB DISCONNECTED"});
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

        const tscChildName = MODULE_ID_PREFIX + "_TSC";
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

        const dbConnectionReadyInterval = setInterval(function(){

          if (userServerControllerReady && tweetServerControllerReady) {

            console.log(chalkGreen(MODULE_ID_PREFIX + " | MONGO DB READY"));

            // dbConnectionReady = true;
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

// function delay(params) {

//   params = params || {};

//   const period = params.period || 10*ONE_SECOND;
//   const verbose = params.verbose || false;

//   return new Promise(function(resolve, reject){

//     if (verbose) {
//       console.log(chalkLog(MODULE_ID_PREFIX + " | +++ DELAY START | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
//     }

//     setTimeout(function(){
//       if (verbose) {
//         console.log(chalkLog(MODULE_ID_PREFIX + " | XXX DELAY END | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
//       }
//       resolve();
//     }, period);
//   });

// }

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

// function getElapsed(){
//   statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
//   return statsObj.elapsedMS;
// }

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

// function toMegabytes(sizeInBytes) {
//   return sizeInBytes/ONE_MEGABYTE;
// }

// function printCat(c){
//   if (c === "left") { return "L"; }
//   if (c === "neutral") { return "N"; }
//   if (c === "right") { return "R"; }
//   if (c === "positive") { return "+"; }
//   if (c === "negative") { return "-"; }
//   if (c === "none") { return "0"; }
//   return ".";
// }

//=========================================================================
// STATS
//=========================================================================

function showStats(options) {

  return new Promise(async function(resolve, reject){

    statsObj.elapsed = getElapsedTimeStamp();

    try{
      await childStatsAll();
    }
    catch(err){
      return reject(err);
    }

    statsObjSmall = pick(statsObj, statsPickArray);

    if (options) {
      console.log(MODULE_ID_PREFIX + " | STATS\n" + jsonPrint(statsObjSmall));
      resolve();
    }
    else {

      Object.keys(childHashMap).forEach(function(childId) {

        console.log(chalkBlue(MODULE_ID_PREFIX + " | STATUS CHILD"
          + " | CHILD ID: " + childId + " | CH FSM: " + childHashMap[childId].status
        ));

        objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
      });

      console.log(chalkBlue(MODULE_ID_PREFIX + " | STATUS"
        + " | START: " + statsObj.startTime
        + " | NOW: " + getTimeStamp()
        + " | ELAPSED: " + statsObj.elapsed
        + " || FSM: " + fsm.getMachineState()
        + " || BEST NN: " + statsObj.bestNetwork.networkId
        + " | SR: " + statsObj.bestNetwork.successRate.toFixed(2)
        + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2)
        + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2)
      ));

      console.log(chalkBlue(MODULE_ID_PREFIX + " | STATUS"
        + " | PUQ: " + processUserQueue.length 
        + " | TOT CAT: " + statsObj.users.categorized.total
        + " | PROCESSED: " + statsObj.users.processed + " / " + statsObj.users.categorized.total 
        + " (" + statsObj.users.percentProcessed.toFixed(2) + "%)"
        + " | " + statsObj.users.categorized.manual + " MAN"
        + " | " + statsObj.users.categorized.auto + " AUTO"
        + " | " + statsObj.users.categorized.matched + " MATCH"
        + " / " + statsObj.users.categorized.mismatched + " MISMATCH"
        + " | " + statsObj.users.categorized.matchRate.toFixed(2) + "%"
      ));

      resolve();
    }

  });
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

// ==================================================================
// DROPBOX
// ==================================================================
const Dropbox = require("dropbox").Dropbox;

const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;
const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

// const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const childPidFolderLocal = DROPBOX_ROOT_FOLDER + "/config/utility/" + hostname + "/children";

const statsFolder = "/stats/" + hostname;
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

// const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";
// const defaultInputsArchiveFolder = dropboxConfigDefaultFolder + "/inputsArchive";

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
// const localTrainingSetFolder = dropboxConfigHostFolder + "/trainingSets";

// const defaultTrainingSetUserArchive = defaultTrainingSetFolder + "/users/users.zip";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const globalBestNetworkArchiveFolder = globalBestNetworkFolder + "/archive";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
const bestNetworkFolder = (hostname === PRIMARY_HOST) ? "/config/utility/best/neuralNetworks" : localBestNetworkFolder;

// const globalCategorizedUsersFolder = dropboxConfigDefaultFolder + "/categorizedUsers";
// const categorizedUsersFile = "categorizedUsers_manual.json";

configuration.neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

const defaultMaxInputHashmapFile = "maxInputHashMap.json";

const localHistogramsFolder = dropboxConfigHostFolder + "/histograms";
const defaultHistogramsFolder = dropboxConfigDefaultFolder + "/histograms";

const defaultInputsConfigFile = "default_networkInputsConfig.json";
const hostInputsConfigFile = hostname + "_networkInputsConfig.json";

const testDataUserFolder = dropboxConfigHostFolder + "/test/testData/user";

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

function loadFileRetry(params){

  return new Promise(async function(resolve, reject){

    const resolveOnNotFound = params.resolveOnNotFound || false;
    const maxRetries = params.maxRetries || 5;
    let retryNumber;
    let backOffTime = params.initialBackOffTime || ONE_SECOND;
    const path = params.path || params.folder + "/" + params.file;

    for (retryNumber = 0;retryNumber < maxRetries;retryNumber++) {
      try {
        
        const fileObj = await loadFile(params);

        if (retryNumber > 0) { 
          console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD RETRY"
            + " | " + path
            + " | BACKOFF: " + msToTime(backOffTime)
            + " | " + retryNumber + " OF " + maxRetries
          )); 
        }

        return resolve(fileObj);
        break;
      } 
      catch(err) {
        backOffTime *= 1.5;
        setTimeout(function(){
          console.log(chalkAlert(MODULE_ID_PREFIX + " | FILE LOAD ERROR ... RETRY"
            + " | " + path
            + " | BACKOFF: " + msToTime(backOffTime)
            + " | " + retryNumber + " OF " + maxRetries
            + " | ERROR: " + err
          )); 
        }, backOffTime);
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

function listDropboxFolder(params){

  return new Promise(function(resolve, reject){

    try{

      statsObj.status = "LIST DROPBOX FOLDER: " + params.folder;

      console.log(chalkInfo(MODULE_ID_PREFIX + " | LISTING DROPBOX FOLDER | " + params.folder));

      const results = {};
      results.entries = [];

      let cursor;
      let more = false;
      const limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;

      if (configuration.offlineMode) {
        dropboxClient = dropboxLocalClient;
      }
      else {
        dropboxClient = dropboxRemoteClient;
      }

      dropboxClient.filesListFolder({path: params.folder, limit: limit}).
      then(function(response){

        cursor = response.cursor;
        more = response.has_more;
        results.entries = response.entries;

        // console.log(chalkLog(MODULE_ID_PREFIX
        //   + " | DROPBOX LIST FOLDER"
        //   + " | FOLDER:" + params.folder
        //   + " | ENTRIES: " + response.entries.length
        //   + " | LIMIT: " + limit
        //   + " | MORE: " + more
        // ));

        async.whilst(

          function() {
            return more;
          },

          function(cb){

            setTimeout(function(){

              dropboxClient.filesListFolderContinue({cursor: cursor}).
              then(function(responseCont){

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

              }).
              catch(function(err){
                console.trace(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX filesListFolderContinue ERROR: ", err));
                return reject(err);
              });

              async.setImmediate(function() { cb(); });

            }, 1000);
          },

          function(err){
            if (err) {
              console.log(chalkError(MODULE_ID_PREFIX + " | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
              return reject(err);
            }

            console.log(chalkLog(MODULE_ID_PREFIX
              + " | DROPBOX LIST FOLDER"
              + " | FOLDER:" + params.folder
              + " | ENTRIES: " + results.entries.length
            ));

            resolve(results);
          });
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        return reject(err);
      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
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
      newConfiguration.evolve = {};

      if (loadedConfigObj.TFE_TEST_MODE !== undefined) {
        console.log("TFE | LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE);
        if ((loadedConfigObj.TFE_TEST_MODE === true) || (loadedConfigObj.TFE_TEST_MODE === "true")) {
          newConfiguration.testMode = true;
        }
        if ((loadedConfigObj.TFE_TEST_MODE === false) || (loadedConfigObj.TFE_TEST_MODE === "false")) {
          newConfiguration.testMode = false;
        }
      }

      if (loadedConfigObj.TFE_THRECEE_AUTO_FOLLOW_USER !== undefined) {
        console.log("TFE | LOADED TFE_THRECEE_AUTO_FOLLOW_USER: " + loadedConfigObj.TFE_THRECEE_AUTO_FOLLOW_USER);
        newConfiguration.threeceeAutoFollowUser = loadedConfigObj.TFE_THRECEE_AUTO_FOLLOW_USER;
      }

      if (loadedConfigObj.TFE_FORCE_INIT_RANDOM_NETWORKS !== undefined) {
        console.log("TFE | LOADED TFE_FORCE_INIT_RANDOM_NETWORKS: " + loadedConfigObj.TFE_FORCE_INIT_RANDOM_NETWORKS);
        newConfiguration.forceInitRandomNetworks = loadedConfigObj.TFE_FORCE_INIT_RANDOM_NETWORKS;
      }

      if (loadedConfigObj.TFE_NUM_NN !== undefined) {
        console.log("TFE | LOADED TFE_NUM_NN: " + loadedConfigObj.TFE_NUM_NN);
        newConfiguration.networkDatabaseLoadLimit = loadedConfigObj.TFE_NUM_NN;
      }

      if (loadedConfigObj.TFE_MIN_TEST_CYCLES !== undefined) {
        console.log("TFE | LOADED TFE_MIN_TEST_CYCLES: " + loadedConfigObj.TFE_MIN_TEST_CYCLES);
        newConfiguration.minTestCycles = loadedConfigObj.TFE_MIN_TEST_CYCLES;
      }

      if (newConfiguration.testMode) {
        newConfiguration.networkDatabaseLoadLimit = TEST_MODE_NUM_NN;
        console.log(chalkLog("TFE | TEST MODE | networkDatabaseLoadLimit: " + newConfiguration.networkDatabaseLoadLimit));
      }


      if (loadedConfigObj.TFE_FETCH_ALL_INTERVAL !== undefined) {
        console.log("TFE | LOADED TFE_FETCH_ALL_INTERVAL: " + loadedConfigObj.TFE_FETCH_ALL_INTERVAL);
        newConfiguration.fetchAllIntervalTime = loadedConfigObj.TFE_FETCH_ALL_INTERVAL; 
      }

      if (newConfiguration.testMode) {
        newConfiguration.fetchAllIntervalTime = TEST_MODE_FETCH_ALL_INTERVAL;
        console.log(chalkLog("TFE | TEST MODE | fetchAllIntervalTime: " + newConfiguration.fetchAllIntervalTime));
      }

      if (loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE !== undefined) {
        console.log("TFE | LOADED TFE_BEST_NN_INCREMENTAL_UPDATE: " + loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE);
        newConfiguration.bestNetworkIncrementalUpdate = loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE;
      }

      if (loadedConfigObj.TFE_QUIT_ON_COMPLETE !== undefined) {
        console.log("TFE | LOADED TFE_QUIT_ON_COMPLETE: " + loadedConfigObj.TFE_QUIT_ON_COMPLETE);
        if ((loadedConfigObj.TFE_QUIT_ON_COMPLETE === true) || (loadedConfigObj.TFE_QUIT_ON_COMPLETE === "true")) {
          newConfiguration.quitOnComplete = true;
        }
        if ((loadedConfigObj.TFE_QUIT_ON_COMPLETE === false) || (loadedConfigObj.TFE_QUIT_ON_COMPLETE === "false")) {
          newConfiguration.quitOnComplete = false;
        }
      }

      if (loadedConfigObj.TFE_VERBOSE !== undefined) {
        console.log("TFE | LOADED TFE_VERBOSE: " + loadedConfigObj.TFE_VERBOSE);
        if ((loadedConfigObj.TFE_VERBOSE === true) || (loadedConfigObj.TFE_VERBOSE === "true")) {
          newConfiguration.verbose = true;
        }
        if ((loadedConfigObj.TFE_VERBOSE === false) || (loadedConfigObj.TFE_VERBOSE === "false")) {
          newConfiguration.verbose = false;
        }
      }

      if (loadedConfigObj.TFE_FETCH_USER_INTERVAL !== undefined) {
        console.log("TFE | LOADED TFE_FETCH_USER_INTERVAL: " + loadedConfigObj.TFE_FETCH_USER_INTERVAL);
        newConfiguration.fetchUserInterval = loadedConfigObj.TFE_FETCH_USER_INTERVAL;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined) {
        console.log("TFE | LOADED TFE_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN);
        newConfiguration.histogramParseDominantMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN !== undefined) {
        console.log("TFE | LOADED TFE_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN);
        newConfiguration.histogramParseTotalMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.TFE_LOCAL_MIN_SUCCESS_RATE !== undefined) {
        console.log("TFE | LOADED TFE_LOCAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_LOCAL_MIN_SUCCESS_RATE);
        newConfiguration.localMinSuccessRate = loadedConfigObj.TFE_LOCAL_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE !== undefined) {
        console.log("TFE | LOADED TFE_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE);
        newConfiguration.globalMinSuccessRate = loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_LOCAL_PURGE_MIN_SUCCESS_RATE !== undefined) {
        console.log("TFE | LOADED TFE_LOCAL_PURGE_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_LOCAL_PURGE_MIN_SUCCESS_RATE);
        newConfiguration.localPurgeMinSuccessRate = loadedConfigObj.TFE_LOCAL_PURGE_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_NUM_RANDOM_NETWORKS !== undefined) {
        console.log("TFE | LOADED TFE_NUM_RANDOM_NETWORKS: " + loadedConfigObj.TFE_NUM_RANDOM_NETWORKS);
        newConfiguration.numRandomNetworks = loadedConfigObj.TFE_NUM_RANDOM_NETWORKS;
      }

      if (loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS !== undefined) {
        console.log("TFE | LOADED TFE_ENABLE_LANG_ANALYSIS: " + loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS);
        newConfiguration.enableLanguageAnalysis = loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_FORCE_LANG_ANALYSIS !== undefined) {
        console.log("TFE | LOADED TFE_FORCE_LANG_ANALYSIS: " + loadedConfigObj.TFE_FORCE_LANG_ANALYSIS);
        newConfiguration.forceLanguageAnalysis = loadedConfigObj.TFE_FORCE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_ENABLE_IMAGE_ANALYSIS !== undefined) {
        console.log("TFE | LOADED TFE_ENABLE_IMAGE_ANALYSIS: " + loadedConfigObj.TFE_ENABLE_IMAGE_ANALYSIS);
        newConfiguration.enableImageAnalysis = loadedConfigObj.TFE_ENABLE_IMAGE_ANALYSIS;
      }

      if (loadedConfigObj.TFE_FORCE_IMAGE_ANALYSIS !== undefined) {
        console.log("TFE | LOADED TFE_FORCE_IMAGE_ANALYSIS: " + loadedConfigObj.TFE_FORCE_IMAGE_ANALYSIS);
        newConfiguration.forceImageAnalysis = loadedConfigObj.TFE_FORCE_IMAGE_ANALYSIS;
      }

      if (loadedConfigObj.TFE_ENABLE_STDIN !== undefined) {
        console.log("TFE | LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_ENABLE_STDIN);
        newConfiguration.enableStdin = loadedConfigObj.TFE_ENABLE_STDIN;
      }

      if (loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID !== undefined) {
        console.log("TFE | LOADED TFE_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID);
        newConfiguration.loadNeuralNetworkID = loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER !== undefined) {
        console.log("TFE | LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER: "
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER));
        newConfiguration.twitterConfigFolder = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE !== undefined) {
        console.log("TFE | LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE: "
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE));
        newConfiguration.twitterConfigFile = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE;
      }

      if (loadedConfigObj.TFE_TWITTER_USERS !== undefined) {
        console.log("TFE | LOADED TFE_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TFE_TWITTER_USERS));
        newConfiguration.twitterUsers = loadedConfigObj.TFE_TWITTER_USERS;
      }

      if (loadedConfigObj.TFE_TWITTER_DEFAULT_USER !== undefined) {
        console.log("TFE | LOADED TFE_TWITTER_DEFAULT_USER: " + jsonPrint(loadedConfigObj.TFE_TWITTER_DEFAULT_USER));
        newConfiguration.twitterDefaultUser = loadedConfigObj.TFE_TWITTER_DEFAULT_USER;
      }

      if (loadedConfigObj.TFE_KEEPALIVE_INTERVAL !== undefined) {
        console.log("TFE | LOADED TFE_KEEPALIVE_INTERVAL: " + loadedConfigObj.TFE_KEEPALIVE_INTERVAL);
        newConfiguration.keepaliveInterval = loadedConfigObj.TFE_KEEPALIVE_INTERVAL;
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

      await loadInputsDropbox({folder: dropboxConfigDefaultFolder, file: defaultInputsConfigFile});
      await loadInputsDropbox({folder: dropboxConfigHostFolder, file: hostInputsConfigFile});
      
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


//=========================================================================
// FILE SAVE
//=========================================================================
let saveFileQueueInterval;
const saveFileQueue = [];
let statsUpdateInterval;

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

  const fullPath = params.folder + "/" + params.file;
  const limit = params.limit || DROPBOX_LIST_FOLDER_LIMIT;
  const localFlag = params.localFlag || false;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  const options = {};

  if (localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats().then(function(){

    }).
    catch(function(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
      if (callback !== undefined) { return callback(err); }
    });

    console.log(chalkBlue(MODULE_ID_PREFIX + " | SAVING DROPBOX LOCALLY"
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
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error); }
        }
        else if (error.status === 429){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error); }
        }
        else if (error.status === 500){
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error); }
        }
        else {
          console.log(chalkError(MODULE_ID_PREFIX + " | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + "\n" + MODULE_ID_PREFIX + " | ERROR:        " + error
            + "\n" + MODULE_ID_PREFIX + " | ERROR CODE:   " + error.code
            + "\n" + MODULE_ID_PREFIX + " | ERROR STATUS: " + error.status
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
            console.log(chalkAlert(MODULE_ID_PREFIX + " | DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert(MODULE_ID_PREFIX + " | DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
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
          console.log(chalkLog(
            MODULE_ID_PREFIX 
            + " | SAVED FILE"
            + " [Q: " + saveFileQueue.length + "] " 
            + " [$: " + saveCache.getStats().keys + "] " 
            + saveFileObj.folder + "/" + saveFileObj.file
          ));
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
        console.log(chalkInfo(MODULE_ID_PREFIX + " | CLEAR INTERVAL | " + intervalHandle));
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

let quitWaitInterval;
let quitFlag = false;

function readyToQuit() {
  const flag = ((saveCache.getStats().keys === 0) && (saveFileQueue.length === 0));
  return flag;
}

async function quit(opts) {

  if (quitFlag) {
    console.log(chalkInfo(MODULE_ID_PREFIX + " | ALREADY IN QUIT"));
    if (opts) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | REDUNDANT QUIT INFO\n" + jsonPrint(opts) ));
    }
    return;
  }

  quitFlag = true;

  const options = opts || false;

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  let slackText = "QUIT";
  if (options) {
    slackText += " | " + options.cause;
  }

  slackSendWebMessage({channel: slackChannel, text: slackText});

  fsm.fsm_quit();

  try{
    await childQuitAll();
    await showStats(true);
  }
  catch(err){
    console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
  }


  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  clearInterval(quitWaitInterval);

  intervalsSet.add("quitWaitInterval");

  quitWaitInterval = setInterval(async function() {

    if (readyToQuit()) {

      await clearAllIntervals();

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
          + " | SAVE CACHE KEYS: " + saveCache.getStats().keys
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }
      else {
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE | QUITTING"
          + " | SAVE CACHE KEYS: " + saveCache.getStats().keys
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }

      const command = 'pkill ' + configuration.childIdPrefix + '*';

      shell.exec(command, function(code, stdout, stderr){

        console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL CHILD"
          + "\nCOMMAND: " + command
          + "\nCODE:    " + code
          + "\nSTDOUT:  " + stdout
          + "\nSTDERR:  " + stderr
        ));

        shell.cd(childPidFolderLocal);
        shell.rm(configuration.childIdPrefix + "*");
      });

      if (!global.globalDbConnection) {
        process.exit();
      }
      else {
        setTimeout(function() {

          global.globalDbConnection.close(async function () {
            console.log(chalkBlue(
                MODULE_ID_PREFIX + " | ==========================\n"
              + MODULE_ID_PREFIX + " | MONGO DB CONNECTION CLOSED\n"
              + MODULE_ID_PREFIX + " | ==========================\n"
            ));

            process.exit();
          });

        }, 1000);
      }

    }

  }, QUIT_WAIT_INTERVAL);
}

//=========================================================================
// STDIN
//=========================================================================
let stdin;
let abortCursor = false;

const cla = require("command-line-args");

const help = { name: "help", alias: "h", type: Boolean};

const enableStdin = { name: "enableStdin", alias: "S", type: Boolean, defaultValue: true };
// const quitNow = { name: "quitNow", alias: "K", type: Boolean};
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = { name: "quitOnError", alias: "Q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "v", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean};

const maxNumberChildren = { name: "maxNumberChildren", alias: "N", type: Number};
const useLocalTrainingSets = { name: "useLocalTrainingSets", alias: "L", type: Boolean};
const loadAllInputs = { name: "loadAllInputs", type: Boolean};
const loadTrainingSetFromFile = { name: "loadTrainingSetFromFile", alias: "t", type: Boolean};
const inputsId = { name: "inputsId", alias: "i", type: String};
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String};
const networkCreateMode = { name: "networkCreateMode", alias: "n", type: String, defaultValue: "evolve" };
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number};
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number};
// const targetServer = { name: "targetServer", type: String };

const optionDefinitions = [
  maxNumberChildren,
  useLocalTrainingSets,
  loadAllInputs,
  loadTrainingSetFromFile,
  inputsId,
  trainingSetFile,
  networkCreateMode,
  hiddenLayerSize,
  seedNetworkId,
  useBestNetwork, 
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  verbose, 
  evolveIterations, 
  testMode,
  help
];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo(MODULE_ID_PREFIX + " | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

// if (commandLineConfig.targetServer === "LOCAL"){
//   commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
// }
// if (commandLineConfig.targetServer === "REMOTE"){
//   commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
// }

if (Object.keys(commandLineConfig).includes("help")) {
  console.log(MODULE_ID_PREFIX + " |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit("help");
}

statsObj.commandLineConfig = commandLineConfig;


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

function toggleVerbose(){

  configuration.verbose = !configuration.verbose;

  console.log(chalkLog(MODULE_ID_PREFIX + " | VERBOSE: " + configuration.verbose));

  childSendAll({op: "VERBOSE", verbose: configuration.verbose}).
  then(function(){

  }).
  catch(function(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR VERBOSE: " + err));
  });
}

function initStdIn() {
  console.log(MODULE_ID_PREFIX + " | STDIN ENABLED");
  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", async function( key ) {
    switch (key) {
      // case "\u0003":
      //   process.exit();
      // break;
      case "a":
        abortCursor = true;
        console.log(chalkLog(MODULE_ID_PREFIX + " | STDIN | ABORT: " + abortCursor));
      break;

      case "K":
        quit({force: true});
      break;

      case "q":
        quit({source: "STDIN"});
      break;
      case "Q":
        process.exit();
      break;

      case "S":
      case "s":
        try {
          await showStats((key === "S"));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
        }
      break;

      case "V":
        toggleVerbose();
      break;

      // case "x":
      //   quitOnCompleteFlag = true;
      //   console.log(chalkLog(MODULE_ID_PREFIX + " | STDIN | QUIT ON COMPLETE FLAG SET"));
      // break;

      default:
        console.log(chalkInfo(
          "\nTFE | " + "q/Q: quit"
          + "\nTFE | " + "s: showStats"
          + "\nTFE | " + "S: showStats verbose"
          + "\nTFE | " + "V: toggle verbose"
        ));
    }
  });
}

//=========================================================================
// FSM
//=========================================================================
const Stately = require("stately.js");

let fsmTickInterval;
let fsmPreviousState = "RESET";
const createChildrenInProgress = false;
let killAllInProgress = false;

//=========================================================================
// TWITTER
//=========================================================================
function initTwitterConfig(params) {

  return new Promise(async function(resolve, reject){


    statsObj.status = "INIT TWITTER | @" + params.threeceeUser;

    const twitterConfigFile = params.threeceeUser + ".json";

    debug(chalkInfo("INIT TWITTER USER @" + params.threeceeUser + " | " + twitterConfigFile));

    try {
      const twitterConfig = await loadFile({folder: configuration.twitterConfigFolder, file: twitterConfigFile});

      twitterConfig.threeceeUser = params.threeceeUser;

      console.log(chalkTwitter("TFE | LOADED TWITTER CONFIG"
        + " | @" + params.threeceeUser
        + " | CONFIG FILE: " + configuration.twitterConfigFolder + "/" + twitterConfigFile
      ));

      resolve(twitterConfig);
    }
    catch(err){
      console.log(chalkError("TFE | *** LOADED TWITTER CONFIG ERROR: FILE:  " 
        + configuration.twitterConfigFolder + "/" + twitterConfigFile
      ));
      console.log(chalkError("TFE | *** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      return reject(err);
    }

  });
}

function dropboxFileMove(params){

  return new Promise(function(resolve, reject){

    if (!params || !params.srcFolder || !params.srcFile || !params.dstFolder || !params.dstFile) {
      return reject(new Error("params undefined"));
    }

    const srcPath = params.srcFolder + "/" + params.srcFile;
    const dstPath = params.dstFolder + "/" + params.dstFile;

    dropboxClient.filesMoveV2({from_path: srcPath, to_path: dstPath, autorename: true, allow_ownership_transfer: true, allow_shared_folder: true}).
    then(function(response){
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | ->- DROPBOX FILE MOVE"
        + " | " + srcPath
        + " > " + dstPath
        // + " | RESPONSE\n" + jsonPrint(response)
      ));
      debug("dropboxClient filesMoveV2 response\n" + jsonPrint(response));
      return resolve();
    }).
    catch(function(err){
      if (err.status === 409) {
        if (params.noErrorNotFound){
          console.log(chalkInfo(MODULE_ID_PREFIX + " | ... DROPBOX FILE MOVE"
            + " | STATUS: " + err.status
            + " | " + srcPath
            + " | DOES NOT EXIST"
            + " | SUMMARY: " + err.response.statusText
          ));
          return resolve();
        }
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR DROPBOX FILE MOVE"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | DOES NOT EXIST"
        ));
      }
      else if (err.status === 429) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | TOO MANY REQUESTS"
        ));
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR: XXX NN"
          + " | STATUS: " + err.status
          + " | " + srcPath
          + " > " + dstPath
          + " | SUMMARY: " + err.response.statusText
          + "\n" + jsonPrint(err)
        ));
      }
      return reject(err);
    });

  });
}

function isBestNetwork(p){

  const params = p || {};

  let pass = false;

  const minOverallMatchRate = params.minOverallMatchRate || configuration.globalMinSuccessRate;
  const minTestCycles = params.minTestCycles || configuration.minTestCycles;

  if (params.networkObj.testCycles < minTestCycles){
    debug("minTestCycles: " + params.networkObj.testCycles);
    return true;
  }
  else if (minTestCycles) {
    pass = (params.networkObj.testCycles >= minTestCycles) && (params.networkObj.overallMatchRate >= minOverallMatchRate);
    debug("minTestCycles: " + params.networkObj.testCycles + " | pass: " + pass);
    return pass;
  }
  else if (params.networkObj.overallMatchRate) {
    pass = (params.networkObj.overallMatchRate < 100) && (params.networkObj.overallMatchRate >= minOverallMatchRate);
    debug("overallMatchRate: " + params.networkObj.overallMatchRate + " | pass: " + pass);
    return pass;
  }
  else {
    pass = (params.networkObj.successRate < 100) && (params.networkObj.successRate >= minOverallMatchRate);
    debug("successRate: " + params.networkObj.successRate + " | pass: " + pass);
    return pass;
  }
}

function loadBestNetworksDropbox(params) {

  console.log(chalkLog("TFE | LOAD BEST NETWORKS DROPBOX"));

  statsObj.status = "LOAD BEST NNs DROPBOX";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;

    console.log(chalkInfo("TFE | LOADING DROPBOX BEST NETWORKS | " + folder));

    try {

      const results = await listDropboxFolder({folder: folder});

      if ((results === undefined) || !results) {
        console.log(chalkError("TFE | DROPBOX LIST FOLDER ERROR | RESULT UNDEFINED ??? "));
        return reject(new Error("DROPBOX LOAD LIST FOLDER ERROR | RESULT UNDEFINED"));
      }

      let resultsArray = [];

      if (configuration.testMode) {
        resultsArray = _.sampleSize(results.entries, TEST_MODE_NUM_NN);
      }
      else {
        resultsArray = results.entries;
      }

      async.eachSeries(resultsArray, async function(entry){

        if (!entry.name.endsWith(".json") || entry.name.startsWith("bestRuntimeNetwork")) {
          return;
        }

        let entryNameArray;
        let networkId;
        let networkObj;

        try {
          entryNameArray = entry.name.split(".");
          networkId = entryNameArray[0];
          networkObj = await loadFileRetry({folder: folder, file: entry.name});
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX
            + " | *** LOAD DROPBOX NETWORK ERROR"
            + " | " + folder + "/" + entry.name
            + " | ... SKIPPING: " + err
          ));
          return;
        }

        if (!networkObj || networkObj=== undefined) {
          return reject(new Error("NO BEST NETWORK FOUND ?"));
        }

        if (!inputsIdSet.has(networkObj.inputsId)){
          console.log(chalkLog("TFE | LOAD BEST NETWORK HASHMAP INPUTS ID MISS ... SKIP HM ADD"
            + " | IN: " + networkObj.numInputs
            + " | " + networkId 
            + " | INPUTS ID: " + networkObj.inputsId 
          ));

          if (configuration.archiveNetworkOnInputsMiss && !networkObj.archived) {

            console.log(chalkLog("TFE | ARCHIVE NN ON INPUTS ID MISS"
              + " | IN: " + networkObj.numInputs
              + " | " + networkId 
              + " | INPUTS ID: " + networkObj.inputsId 
              + "\nTFE | FROM: " + folder + "/" + entry.name
              + " | TO: " + globalBestNetworkArchiveFolder
            ));

            try{
              await dropboxFileMove({
                noErrorNotFound: true,
                srcFolder: folder, 
                srcFile: entry.name, 
                dstFolder: globalBestNetworkArchiveFolder, 
                dstFile: entry.name
              });

              const updateDbNetworkParams = {};

              updateDbNetworkParams.networkObj = networkObj;
              updateDbNetworkParams.incrementTestCycles = false;
              updateDbNetworkParams.addToTestHistory = false;
              updateDbNetworkParams.verbose = configuration.testMode;

              updateDbNetworkParams.networkObj.archived = true;

              await updateDbNetwork(updateDbNetworkParams);

              return;
            }
            catch(err){
              // console.log(chalkError("TFE | *** DROPBOX FILE MOVE ERROR", jsonPrint(err)));
              jsonParse(err, function(err, errObj){
                if (err) {
                  console.log(chalkError(getTimeStamp()
                    + " | *** MOVE FILE FROM DROPBOX ERROR PARSE"
                    + " | " + err
                  ));
                }
                else {
                  console.log(chalkError("TFE | *** DROPBOX FILE MOVE ERROR", jsonPrint(errObj)));
                }
                return;
              });
            }
          }
        }
        else if (isBestNetwork({networkObj: networkObj}) && !bestNetworkHashMap.has(networkId)){

          bestNetworkHashMap.set(networkObj.networkId, networkObj);

          printNetworkObj(
            MODULE_ID_PREFIX 
              + " | +++ DROPBOX NN"
              + " [" + bestNetworkHashMap.size + " HM]"
              + " [" + skipLoadNetworkSet.size + " SKIPPED]",
            networkObj,
            chalkGreen
          );
        }
        else if (!isBestNetwork({networkObj: networkObj})) {

          skipLoadNetworkSet.add(networkObj.networkId);

          printNetworkObj(
            MODULE_ID_PREFIX 
              + " | ... DROPBOX NN"
              + " [" + bestNetworkHashMap.size + " HM]"
              + " [" + skipLoadNetworkSet.size + " SKIPPED]",
            networkObj,
            chalk.gray
          );
        }

        try {

          const updateDbNetworkParams = {};

          updateDbNetworkParams.networkObj = networkObj;
          updateDbNetworkParams.incrementTestCycles = false;
          updateDbNetworkParams.addToTestHistory = false;
          updateDbNetworkParams.verbose = configuration.testMode;

          if (skipLoadNetworkSet.has(networkObj.networkId) && !networkObj.archived) {


            console.log(chalk.black.bold(
              MODULE_ID_PREFIX 
                + " | vvv ARCHIVE NN"
                + " | " + folder + "/" + entry.name
                + " > " + globalBestNetworkArchiveFolder
            ));

            await dropboxFileMove({
              noErrorNotFound: true,
              srcFolder: folder, 
              srcFile: entry.name, 
              dstFolder: globalBestNetworkArchiveFolder, 
              dstFile: entry.name
            });

            updateDbNetworkParams.networkObj.archived = true;

            await updateDbNetwork(updateDbNetworkParams);

            return;
          }
          else {
            if (networkObj.archived) {

              if (networkObj.overallMatchRate >= configuration.globalMinSuccessRate) {

                printNetworkObj(
                  MODULE_ID_PREFIX + " | ??? NN ARCHIVED BUT GLOBAL SUCCESS | SKIP DELETE", 
                  networkObj
                );


                return;

              }
              else {
                console.log(chalkLog(MODULE_ID_PREFIX + " | ... NN ALREADY ARCHIVED | " + networkObj.networkId));

                await updateDbNetwork(updateDbNetworkParams);
                
                const deletePath = folder + "/" + entry.name;

                console.log(chalkLog(MODULE_ID_PREFIX + " | ... NN ALREADY ARCHIVED | DELETING: " + deletePath));

                dropboxClient.filesDelete({path: deletePath}).
                then(function(){
                  console.log(chalkAlert(MODULE_ID_PREFIX + " | ... NN ALREADY ARCHIVED | DELETED: " + deletePath));
                  return;
                }).
                catch(function(err){
                  console.log(chalkError("TFE | *** LOAD DROPBOX NETWORK / NN DELETE ERROR: " + err));
                  return(err);
                });
              }

            }
            else {
              return;
            }
          }
        }
        catch(err){
          console.log(chalkError("TFE | *** LOAD DROPBOX NETWORK / NN DB UPDATE ERROR: " + err));
          return(err);
        }

 
      }, function(err){
        if (err) { return reject(err); }
        resolve();
      });

    }
    catch(err){
      console.log(chalkError("TFE | DROPBOX LOAD BEST NETWORKS ERROR: ", err));
      return reject(err);
    }
  });
}

function loadBestNetworksDatabase(paramsIn) {

  return new Promise(async function(resolve, reject){

    const params = (paramsIn === undefined) ? {} : paramsIn;

    console.log(chalkLog("TFE | LOAD BEST NETWORKS DATABASE"));

    statsObj.status = "LOAD BEST NNs DATABASE";
    
    statsObj.newBestNetwork = false;
    statsObj.numNetworksLoaded = 0;

    const inputsIdArray = [...inputsIdSet];

    if (configuration.verbose) { console.log(chalkLog("inputsIdArray\n" + jsonPrint(inputsIdArray))); }

    let query = {};
    query.inputsId = { "$in": inputsIdArray };

    if (configuration.minTestCycles) {
      query = {};
      query.$and = [
        { inputsId: { "$in": inputsIdArray } },
        { successRate: { "$gte": configuration.globalMinSuccessRate } },
        { testCycles: { "$gte": configuration.minTestCycles } }
      ];
    }

    const randomUntestedQuery = {};
    randomUntestedQuery.$and = [
      { inputsId: { "$in": inputsIdArray } },
      { successRate: { "$gte": configuration.globalMinSuccessRate } },
      { testCycles: { "$lt": configuration.minTestCycles } }
    ];
 
    let limit = params.limit || configuration.networkDatabaseLoadLimit;
    const randomUntestedLimit = params.randomUntestedLimit || configuration.randomUntestedLimit;

    if (configuration.testMode) {
      limit = TEST_MODE_NUM_NN;
    }

    if (configuration.verbose) { console.log(chalkLog("query\n" + jsonPrint(query))); }

    let nnArrayTopOverallMatchRate = [];
    let nnArrayRandomUntested = [];
    let nnArray = [];

    try {
      console.log(chalkBlue("TFE | LOADING " + limit + " BEST NNs (by OAMR) FROM DB ..."));
      nnArrayTopOverallMatchRate = await global.globalNeuralNetwork.find(query).lean().
sort({"overallMatchRate": -1}).
limit(limit).
exec();
      console.log(chalkBlue("TFE | FOUND " + nnArrayTopOverallMatchRate.length + " BEST NNs (by OAMR) FROM DB ..."));

      console.log(chalkBlue("TFE | LOADING " + randomUntestedLimit + " UNTESTED NNs FROM DB ..."));
      nnArrayRandomUntested = await global.globalNeuralNetwork.find(randomUntestedQuery).lean().
sort({"overallMatchRate": -1}).
limit(randomUntestedLimit).
exec();
      console.log(chalkBlue("TFE | FOUND " + nnArrayRandomUntested.length + " UNTESTED NNs FROM DB ..."));

      nnArray = _.concat(nnArrayTopOverallMatchRate, nnArrayRandomUntested);
    }
    catch(err){
      console.log(chalkError("TFE | *** NEURAL NETWORK FIND ERROR: " + err));
      return reject(err);
    }

    if (nnArray.length === 0){
      console.log(chalkAlert("TFE | ??? NO NEURAL NETWORKS NOT FOUND IN DATABASE"));
      return resolve();
    }

    console.log(chalkBlueBold("TFE | LOADING " + nnArray.length + " NNs FROM DB ..."));

    bestNetwork = nnArray[0];
    bestNetwork.isValid = true;
    bestNetwork = networkDefaults(bestNetwork );

    currentBestNetwork = nnArray[0];
    currentBestNetwork.isValid = true;
    currentBestNetwork = networkDefaults(currentBestNetwork);

    statsObj.bestRuntimeNetworkId = bestNetwork.networkId;

    bestNetworkHashMap.set(statsObj.bestRuntimeNetworkId, bestNetwork);

    console.log(chalk.bold.blue("TFE | +++ BEST DB NN"
      + " | " + bestNetwork.networkId
      + " | INPUTS ID: " + bestNetwork.inputsId
      + " | INPUTS: " + bestNetwork.numInputs
      + " | SR: " + bestNetwork.successRate.toFixed(2) + "%"
      + " | MR: " + bestNetwork.matchRate.toFixed(2) + "%"
      + " | OAMR: " + bestNetwork.overallMatchRate.toFixed(2) + "%"
      + " | TCs: " + bestNetwork.testCycles
      + " | TCH: " + bestNetwork.testCycleHistory.length
    ));

    async.eachSeries(nnArray, function(networkObj, cb){

      bestNetworkHashMap.set(networkObj.networkId, networkObj);
      cb();

    }, function(err){
      if (err) {
        return reject(err);
      }
      resolve(bestNetwork);
    });

  });
}

function loadBestNeuralNetworks() {

  return new Promise(async function(resolve, reject){

    statsObj.status = "LOAD BEST NN";

    console.log(chalkLog("TFE | LOADING NEURAL NETWORKS"
      + " | FOLDER: " + bestNetworkFolder
      + " | TIMEOUT: " + DEFAULT_DROPBOX_TIMEOUT + " MS"
    ));

    try {
      await loadBestNetworksDropbox({folder: bestNetworkFolder});
      const bestNetworkObj = await loadBestNetworksDatabase();

      // if (bestNetworkObj) { 
      //   printNetworkObj(
      //     "TFE | LOADED BEST NN FROM DB | MIN TEST CYCLES: " + configuration.minTestCycles, 
      //     bestNetworkObj
      //   ); 
      // }

      resolve();
    }
    catch(err){
      console.log(chalkError("TFE | *** LOAD BEST NETWORKS ERROR: " + err));
      return reject(err);
    }

  });
}

function loadMaxInputDropbox(params) {

  statsObj.status = "LOAD MAX INPUT";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkNetwork("TFE | LOADING DROPBOX MAX INPUT HASHMAP | " + folder + "/" + file));

    try {

      const maxInputHashMapObj = await loadFile({folder: folder, file: file});

      if ((maxInputHashMapObj === undefined) || !maxInputHashMapObj) {
        console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED"));
      }

      maxInputHashMap = {};
      maxInputHashMap = deepcopy(maxInputHashMapObj.maxInputHashMap);

      console.log(chalkBlue("TFE | LOADED DROPBOX MAX INPUT HASHMAP"
        + " | KEYS (INPUT TYPES): " + Object.keys(maxInputHashMap)
      ));

      resolve();
    }
    catch(err){
      console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR: " + err));
      return reject(err);
    }


  });
}

function updateGlobalHistograms(params) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "UPDATE GLOBAL HISTOGRAMS";

    let mergedHistograms = {};

    try {
      mergedHistograms = await mergeHistograms.merge({ histogramA: params.user.profileHistograms, histogramB: params.user.tweetHistograms });
    }
    catch(err){
      console.log(chalkError("TFE | *** UPDATE GLOBAL HISTOGRAMS ERROR: " + err));
      return reject(err);
    }

    // async.each(Object.keys(mergedHistograms), function(type, cb0) {
    async.each(DEFAULT_INPUT_TYPES, function(inputType, cb0) {

      if (!mergedHistograms[inputType] || (mergedHistograms[inputType] === undefined)){
        return cb0();
      }

      if (globalHistograms[inputType] === undefined) { globalHistograms[inputType] = {}; }

      async.each(Object.keys(mergedHistograms[inputType]), function(item, cb1) {

        if (globalHistograms[inputType][item] === undefined) {
          globalHistograms[inputType][item] = {};
          globalHistograms[inputType][item].total = 0;
          globalHistograms[inputType][item].left = 0;
          globalHistograms[inputType][item].neutral = 0;
          globalHistograms[inputType][item].right = 0;
          globalHistograms[inputType][item].positive = 0;
          globalHistograms[inputType][item].negative = 0;
          globalHistograms[inputType][item].none = 0;
          globalHistograms[inputType][item].uncategorized = 0;
        }

        globalHistograms[inputType][item].total += 1;

        if (params.user.category) {
          if (params.user.category === "left") { globalHistograms[inputType][item].left += 1; }
          if (params.user.category === "neutral") { globalHistograms[inputType][item].neutral += 1; }
          if (params.user.category === "right") { globalHistograms[inputType][item].right += 1; }
          if (params.user.category === "positive") { globalHistograms[inputType][item].positive += 1; }
          if (params.user.category === "negative") { globalHistograms[inputType][item].negative += 1; }
          if (params.user.category === "none") { globalHistograms[inputType][item].none += 1; }
        }
        else {
          globalHistograms[inputType][item].uncategorized += 1;
        }

        cb1();

      }, function(err) {

        if (err) { return reject(err); }

        cb0();

      });

    }, function(err) {

      if (err) { return reject(err); }

      resolve();

    });

  });
}

function initRandomNetworks(){

  statsObj.status = "INIT RAN NNs";

  return new Promise(async function(resolve, reject){

    statsObj.loadedNetworksFlag = false;

    if (randomNetworkTree && (randomNetworkTree !== undefined)) {

      let isBestNetwork = false;

      async.eachSeries(bestNetworkHashMap.values(), function(networkObj, cb){

        if (networkObj.networkId === bestNetwork.networkId) {
          console.log(chalkGreen("TFE | LOAD_NETWORK BEST: " + networkObj.networkId));
          isBestNetwork = true;
        }
        else {
          isBestNetwork = false;
        }

        randomNetworkTree.send({ op: "LOAD_NETWORK", networkObj: networkObj, isBestNetwork: isBestNetwork }, function(err) {

          if (err) { return cb(err); }

          console.log(chalkBlue("TFE | SENT NN > RNT : " + networkObj.networkId));

          cb();

        });

      }, function(err){

        if (err) { 
          statsObj.loadedNetworksFlag = false;
          reject(err);
        }

        randomNetworkTree.send({ op: "LOAD_NETWORK_DONE" });
        statsObj.loadedNetworksFlag = true;
        resolve();

      });

    }
    else {
      console.log(chalkError("TFE | *** RNT NOT INITIALIZED *** "));
      reject(new Error("RNT NOT INITIALIZED"));
    }

  });
}

function initMaxInputHashMap(){

  statsObj.status = "INIT MAX INPUT HASHMAP";

  return new Promise(async function(resolve, reject){

    if (randomNetworkTree && (randomNetworkTree !== undefined)) {

      randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap }, function(err) {
        if (err) { return reject(err); }
        console.log(chalkBlue("TFE | SENT MAX INPUTS HASHMAP > RNT"));
        resolve();
      });
    }
    else {
      console.log(chalkError("TFE | *** RNT NOT INITIALIZED *** "));
      reject(new Error("RNT NOT INITIALIZED"));
    }

  });
}

function initNetworks(){

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT NNs";

    console.log(chalkTwitter("TFE | INIT NETWORKS"));

    try {
      await loadBestNeuralNetworks();
      await loadMaxInputDropbox({folder: defaultTrainingSetFolder, file: defaultMaxInputHashmapFile});
      await initRandomNetworks();
      await initMaxInputHashMap();
      resolve();
    }
    catch(err){
      console.trace(chalkError("TFE | *** INIT NETWORKS ERROR: " + err));
      reject(err);
    }

  });
}

function saveNetworkHashMap(params, callback) {

  statsObj.status = "SAVE NN HASHMAP TO DROPBOX";

  const folder = (params.folder === undefined) ? bestNetworkFolder : params.folder;

  const nnIds = bestNetworkHashMap.keys();

  console.log(chalkNetwork("TFE | UPDATING NNs IN FOLDER " + folder));

  async.eachSeries(nnIds, function(nnId, cb0) {

    const networkObj = bestNetworkHashMap.get(nnId);

    printNetworkObj("TFE | SAVING NN", networkObj);

    statsObj.status = "SAVE NN HASHMAP | SAVE Q: " + saveFileQueue.length;

    const file = nnId + ".json";

    if (params.saveImmediate) {
      saveFileQueue.push({folder: folder, file: file, obj: networkObj });
      debug(chalkNetwork("SAVING NN (Q)"
        + " | " + networkObj.networkId
      ));
      cb0();
    }
    else {
      saveCache.set(file, {folder: folder, file: file, obj: networkObj });
      debug(chalkNetwork("SAVING NN ($)"
        + " | " + networkObj.networkId
      ));
      cb0();
    }

  }, function(err) {
    if (callback !== undefined) { callback(err); }
  });
}

// function printTestCycleHistory(nn){
//   const tableArray = [];

//   tableArray.push([
//     "TC",
//     "M",
//     "MM",
//     "TOT",
//     "MR(%)",
//     "TS"
//   ]);

//   async.each(nn.testCycleHistory, function(entry, cb1){
//     tableArray.push([
//       entry.testCycle,
//       entry.match,
//       entry.mismatch,
//       entry.total,
//       entry.matchRate.toFixed(2),
//       moment(entry.timeStamp).format(compactDateTimeFormat)
//     ]);

//     async.setImmediate(function() { cb1(); });

//   }, function(){

//     const t = table(tableArray, { align: ["r", "r", "r", "r", "r", "l"] });

//     console.log("TFE | =========================================================================");

//     console.log(chalkLog("TFE | TEST CYCLE HISTORY | " + nn.networkId));

//     // if (configuration.verbose) { console.log(t); }
//     if (true) { console.log(t); }

//     console.log("TFE | =========================================================================");
//   });
// }

function updateNetworkStats(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "UPDATE DB NN STATS";

    const updateOverallMatchRate = (params.updateOverallMatchRate !== undefined) ? params.updateOverallMatchRate : false;
    const saveImmediate = (params.saveImmediate !== undefined) ? params.saveImmediate : false;
    const updateDb = (params.updateDb !== undefined) ? params.updateDb : false;
    const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;
    const addToTestHistory = (params.addToTestHistory !== undefined) ? params.addToTestHistory : false;

    const nnIds = Object.keys(params.networkStatsObj);

    console.log(chalkTwitter("TFE | UPDATE NETWORK STATS"
      + " | " + nnIds.length + " | NETWORKS"
      + " | UPDATE OAMR: " + updateOverallMatchRate
      + " | UPDATE DB: " + updateDb
      + " | INC TEST CYCs: " + incrementTestCycles
      + " | ADD TEST HISTORY: " + addToTestHistory
    ));

    async.eachSeries(nnIds, async function(nnId) {

      if (bestNetworkHashMap.has(nnId)) {

        const networkObj = bestNetworkHashMap.get(nnId);

        networkObj.incrementTestCycles = incrementTestCycles;
        networkObj.matchRate = params.networkStatsObj[nnId].matchRate;
        networkObj.overallMatchRate = (updateOverallMatchRate) ? params.networkStatsObj[nnId].matchRate : params.networkStatsObj[nnId].overallMatchRate;

        const testHistoryItem = {
          testCycle: networkObj.testCycles,
          match: params.networkStatsObj[nnId].match,
          mismatch: params.networkStatsObj[nnId].mismatch,
          total: params.networkStatsObj[nnId].total,
          matchRate: params.networkStatsObj[nnId].matchRate,
          timeStampString: moment().format(compactDateTimeFormat),
          timeStamp: moment()
        };

        const updateDbNetworkParams = {
          networkObj: networkObj,
          incrementTestCycles: incrementTestCycles,
          testHistoryItem: testHistoryItem,
          addToTestHistory: addToTestHistory,
          verbose: configuration.testMode
        };

        let nnDbUpdated;

        try {
          nnDbUpdated = await updateDbNetwork(updateDbNetworkParams);
        }
        catch(err){
          console.log(chalkError("TFE | *** NN DB UPDATE ERROR: " + err));
          return(err);
        }

        bestNetworkHashMap.set(nnDbUpdated.networkId, nnDbUpdated);
        return;

      }
      else {
        console.log(chalkAlert("TFE | ??? NETWORK NOT IN BEST NETWORK HASHMAP ???"
          + " | NNID: " + nnId
        ));
        return;
      }
    }, async function(err) {

      if (err) {
        console.log(chalkError("TFE | *** UPDATE NETWORK STATS ERROR: " + err));
        return reject(err);
      }

      const bestInputsConfigObj = {};

      try{

        const query = {};

        const inputsIdArray = [...inputsIdSet];

        query.$and = [
          { inputsId: { "$in": inputsIdArray } },
          { testCycles: { "$gte": configuration.minTestCycles } }
        ]

        let chalkVal = chalkLog;

        const networkObjArray = await global.globalNeuralNetwork.
          find(query).
          lean().
          sort({"overallMatchRate": -1}).
          limit(100).
          select({ overallMatchRate: 1, successRate: 1, networkId: 1, inputsId: 1 }).
          exec();

        networkObjArray.forEach(function(networkObj){
          if (networkObj.inputsId && (networkObj.inputsId !== undefined)) {

            chalkVal = (bestInputsSet.has(networkObj.inputsId)) ? chalkLog : chalkGreen;

            bestInputsSet.add(networkObj.inputsId);

            console.log(chalkVal("TFE | +++ BEST INPUTS SET"
              + " [" + bestInputsSet.size + "]"
              + " | INPUTS ID: " + networkObj.inputsId
              + " | NID: " + networkObj.networkId
              + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
              + " | SR: " + networkObj.successRate.toFixed(2) + "%"
            ));
          }
        });

        console.log(chalkInfo("TFE | BEST INPUTS SET: " + bestInputsSet.size + "\n" + jsonPrint([...bestInputsSet])));

        bestInputsConfigObj.INPUTS_IDS = [];
        bestInputsConfigObj.INPUTS_IDS = [...bestInputsSet];


        let folder = dropboxConfigDefaultFolder;
        let file = defaultBestInputsConfigFile;

        if (hostname !== "google") {
          folder = dropboxConfigHostFolder;
          file = hostBestInputsConfigFile;
        }

        saveFileQueue.push({folder: folder, file: file, obj: bestInputsConfigObj});

        saveNetworkHashMap({folder: bestNetworkFolder, saveImmediate: saveImmediate, updateDb: updateDb}, function() {
          statsObj.status = statsObj.fsmState;
          resolve();
        });

      }
      catch(e){
        console.log(chalkError("TFE | *** BEST INPUTS ERROR: " + e));
        reject(e);
      }

    });

  });
}

function initActivateNetworkQueueInterval(interval) {

  return new Promise(function(resolve){

    clearInterval(activateNetworkQueueInterval);

    statsObj.status = "INIT RNT ACTIVATE Q INTERVAL";

    let activateNetworkObj = {};

    statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;
    statsObj.queues.activateNetworkQueue.busy = false;

    console.log(chalkLog("TFE | INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

    activateNetworkQueueInterval = setInterval(function () {

      if (randomNetworkTreeReadyFlag && !statsObj.queues.activateNetworkQueue.busy && (statsObj.queues.activateNetworkQueue.size > 0)) {

        statsObj.queues.activateNetworkQueue.busy = true;

        activateNetworkObj = activateNetworkQueue.shift();

        statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

        randomNetworkTree.send({op: "ACTIVATE", obj: activateNetworkObj}, function(){
          statsObj.queues.activateNetworkQueue.busy = false;
        });


      }

    }, interval);

    resolve();

  });
}

const runEnableArgs = {};
runEnableArgs.userServerControllerReady = userServerControllerReady;
runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
// runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;

function runEnable(displayArgs) {
  if (randomNetworkTree && (randomNetworkTree !== undefined)) {
    randomNetworkTree.send({op: "GET_BUSY"});
  }
  else {
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeMessageRxQueueReadyFlag = true;
  }
  runEnableArgs.userServerControllerReady = userServerControllerReady;
  runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
  runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
  runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
  // runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;

  const runEnableKeys = Object.keys(runEnableArgs);
  if (displayArgs) { console.log(chalkInfo("TFE | ------ runEnable ------")); }
  runEnableKeys.forEach(function(key) {
    if (displayArgs) { console.log(chalkInfo("TFE | runEnable | " + key + ": " + runEnableArgs[key])); }
    if (!runEnableArgs[key]) {
      if (displayArgs) { console.log(chalkInfo("TFE | ------ runEnable ------")); }
      return false;
    }
  });
  if (displayArgs) { console.log(chalkInfo("TFE | ------ runEnable ------")); }
  return true;
}

function updateBestNetworkStats(params) {

  return new Promise(function(resolve){

    const networkObj = params.networkObj;

    statsObj.status = "UPDATE BEST NN STATS";

    if (statsObj.bestNetwork === undefined) { statsObj.bestNetwork = {}; }

    statsObj.bestRuntimeNetworkId = networkObj.networkId;
    statsObj.currentBestNetworkId = networkObj.networkId;

    statsObj.bestNetwork.networkId = networkObj.networkId;
    statsObj.bestNetwork.network = networkObj.network;
    statsObj.bestNetwork.networkType = networkObj.networkType;
    statsObj.bestNetwork.successRate = networkObj.successRate || 0;
    statsObj.bestNetwork.matchRate = networkObj.matchRate || 0;
    statsObj.bestNetwork.overallMatchRate = networkObj.overallMatchRate || 0;
    statsObj.bestNetwork.testCycles = networkObj.testCycles || 0;
    statsObj.bestNetwork.testCycleHistory = networkObj.testCycleHistory || [];
    statsObj.bestNetwork.input = networkObj.network.input;
    statsObj.bestNetwork.numInputs = networkObj.numInputs;
    statsObj.bestNetwork.inputsId = networkObj.inputsId;
    statsObj.bestNetwork.output = networkObj.network.output;
    statsObj.bestNetwork.evolve = {};

    if (networkObj.evolve !== undefined) {
      statsObj.bestNetwork.evolve = networkObj.evolve;
      if (statsObj.bestNetwork.evolve.options !== undefined) { 
        statsObj.bestNetwork.evolve.options.networkObj = null;
      }
    }

    resolve(statsObj.bestNetwork);

  });
}

function saveBestNetworkFileCache(params) {
  return new Promise(function(resolve){
    console.log(chalkNetwork("TFE | SAVING NEW BEST NETWORK"
      + " | " + params.network.networkId
      + " | SR: " + params.network.successRate.toFixed(2)
      + " | MR: " + params.network.matchRate.toFixed(2)
      + " | OAMR: " + params.network.overallMatchRate.toFixed(2)
      + " | TEST CYCs: " + params.network.testCycles
      + " | TC HISTORY: " + params.network.testCycleHistory.length
    ));

    const fileObj = {
      networkId: params.network.networkId,
      successRate: params.network.successRate,
      matchRate: params.network.matchRate,
      overallMatchRate: params.network.overallMatchRate,
      testCycles: params.network.testCycles,
      testCycleHistory: params.network.testCycleHistory,
      updatedAt: getTimeStamp()
    };

    const file = statsObj.bestRuntimeNetworkId + ".json";

    saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: params.network });
    saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj });

    resolve();

  });
}

function initRandomNetworkTreeMessageRxQueueInterval(interval, callback) {

  statsObj.status = "INIT RNT INTERVAL";

  clearInterval(randomNetworkTreeMessageRxQueueInterval);

  randomNetworkTreeMessageRxQueueReadyFlag = true;

  console.log(chalkLog("TFE | INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

  randomNetworkTreeMessageRxQueueInterval = setInterval(async function () {

    if (randomNetworkTreeMessageRxQueueReadyFlag && (randomNetworkTreeMessageRxQueue.length > 0)) {

      randomNetworkTreeMessageRxQueueReadyFlag = false;

      const m = randomNetworkTreeMessageRxQueue.shift();

      let user = {};
      let prevBesTFEObj = {};
      let fileObj = {};
      let file;

      statsObj.randomNetworkTreeOp = m.op;

      switch (m.op) {
        case "IDLE":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          runEnable();
          console.log(chalkLog("TFE | RNT IDLE "));
        break;

        case "STATS":

          console.log(chalkLog("TFE | R< RNT_STATS"
            // + "\n" + jsonPrint(Object.keys(m.statsObj))
          ));

          console.log(chalkBlue("TFE | RNT | UPDATING ALL NNs STATS IN DB ..."));

          try {
            await updateNetworkStats({
                networkStatsObj: m.statsObj.loadedNetworks, 
                saveImmediate: true, 
                updateDb: true, 
                updateOverallMatchRate: true,
                incrementTestCycles: true,
                addToTestHistory: true
              });

            currentBestNetwork = bestNetworkHashMap.get(statsObj.currentBestNetworkId);

            if ((hostname === PRIMARY_HOST) || configuration.testMode) {

              const fileObj = {
                networkId: currentBestNetwork.networkId,
                successRate: currentBestNetwork.successRate,
                matchRate: currentBestNetwork.matchRate,
                overallMatchRate: currentBestNetwork.overallMatchRate,
                testCycles: currentBestNetwork.testCycles,
                testCycleHistory: currentBestNetwork.testCycleHistory,
                twitterStats: statsObj.twitter,
                updatedAt: moment()
              };

              const folder = (configuration.testMode) ? bestNetworkFolder + "/test" : bestNetworkFolder;
              const file = currentBestNetwork.networkId + ".json";

              console.log(chalkBlue("TFE | SAVING BEST NETWORK"
                + " | " + currentBestNetwork.networkId
                + " | MR: " + currentBestNetwork.matchRate.toFixed(2)
                + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2)
                + " | TEST CYCs: " + currentBestNetwork.testCycles
                + " | " + folder + "/" + file
              ));

              saveCache.set(file, {folder: folder, file: file, obj: currentBestNetwork });
              saveCache.set(bestRuntimeNetworkFileName, {folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj});
            }

            randomNetworkTreeMessageRxQueueReadyFlag = true;
            // statsObj.queues.randomNetworkTreeActivateQueue.busy = false;

            myEmitter.emit("allNetworksUpdated");

          }
          catch(err){
            console.log(chalkError("TFE | *** UPDATE NETWORK STATS ERROR: " + err));
          }

        break;

        case "NETWORK_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          debug(chalkInfo("RNT NETWORK_READY ..."));
          runEnable();
        break;

        case "NETWORK_BUSY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = true;
          debug(chalkInfo("RNT NETWORK_BUSY ..."));
        break;

        case "QUEUE_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q READY"));

          runEnable();
        break;

        case "QUEUE_EMPTY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q EMPTY"));
          runEnable();
        break;

        case "QUEUE_FULL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = "QUEUE_FULL";
          randomNetworkTreeReadyFlag = false;
          console.log(chalkError("TFE | *** RNT Q FULL"));
        break;

        case "RNT_TEST_PASS":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          console.log(chalkTwitter("TFE | " + getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
          runEnable();
        break;

        case "RNT_TEST_FAIL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          console.log(chalkAlert("TFE | " + getTimeStamp() + " | RNT_TEST_FAIL"));
          quit({source: "RNT", error: "RNT_TEST_FAIL"});
        break;

        case "NETWORK_OUTPUT":

          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;

          debug(chalkAlert("RNT NETWORK_OUTPUT\n" + jsonPrint(m.output)));
          debug(chalkAlert("RNT NETWORK_OUTPUT | " + m.bestNetwork.networkId));

          statsObj.bestRuntimeNetworkId = m.bestNetwork.networkId;
          statsObj.currentBestNetworkId = m.currentBestNetwork.networkId

          if (bestNetworkHashMap.has(statsObj.currentBestNetworkId)) {

            currentBestNetwork = bestNetworkHashMap.get(statsObj.currentBestNetworkId);

            currentBestNetwork.matchRate = m.currentBestNetwork.matchRate;
            currentBestNetwork.overallMatchRate = m.currentBestNetwork.overallMatchRate;
            currentBestNetwork.successRate = m.currentBestNetwork.successRate;

            try{
              await updateBestNetworkStats({networkObj: currentBestNetwork});
            }
            catch(err){
              console.log(chalkError(MODULE_ID_PREFIX
                + " | *** ERROR update best network stats: " + err
              ));
            }

            bestNetworkHashMap.set(statsObj.currentBestNetworkId, currentBestNetwork);

            if ((hostname === PRIMARY_HOST) 
              && (statsObj.prevBestNetworkId !== statsObj.currentBestNetworkId) 
              && configuration.bestNetworkIncrementalUpdate) 
            {
              statsObj.prevBestNetworkId = statsObj.currentBestNetworkId;
              saveBestNetworkFileCache({network: m.currentBestNetwork});
            }

           debug(chalkAlert("NETWORK_OUTPUT"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + m.bestNetwork.networkId
              + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
              + " | MR: " + m.bestNetwork.matchRate.toFixed(2) + "%"
              + " | OAMR: " + m.bestNetwork.overallMatchRate.toFixed(2) + "%"
              + " | @" + m.user.screenName
              + " | C: " + m.user.category
              + " | CA: " + m.categoryAuto
            ));

            user = {};
            user = m.user;
            user.category = m.category;
            user.categoryAuto = m.categoryAuto;
            userDbUpdateQueue.push(user);
          }
          else {
            console.log(chalkError("TFE | *** ERROR:  NETWORK_OUTPUT | BEST NN NOT IN HASHMAP???"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + statsObj.bestRuntimeNetworkId
              + " | " + m.bestNetwork.networkId
              + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
              + " | MR: " + m.bestNetwork.matchRate.toFixed(2) + "%"
              + " | OAMR: " + m.bestNetwork.overallMatchRate.toFixed(2) + "%"
              + " | TC: " + m.bestNetwork.testCycles
              + " | TCH: " + m.bestNetwork.testCycleHistory.length
              + " | @" + m.user.screenName
              + " | C: " + m.user.category
              + " | CA: " + m.categoryAuto
            ));
          }
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          // statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          runEnable();
        break;

        case "BEST_MATCH_RATE":

          debug(chalkAlert("\n================================================================================================\n"
            + "*** RNT_BEST_MATCH_RATE"
            + " | " + m.networkId
            + " | IN ID: " + m.inputsId
            + " | " + m.numInputs + " IN"
            + "\n*** SR: " + m.successRate.toFixed(2) + "%"
            + " | MR: " + m.matchRate.toFixed(2) + "%"
            + " | OAMR: " + m.overallMatchRate.toFixed(2) + "%"
            + "\n*** PREV: " + m.previousBestNetworkId
            + " | PMR: " + m.previousBestMatchRate.toFixed(2) + "%"
            + "\n================================================================================================\n"
          ));

          if (bestNetworkHashMap.has(m.networkId)) {

            currentBestNetwork = bestNetworkHashMap.get(m.networkId);

            currentBestNetwork.matchRate = m.matchRate;
            currentBestNetwork.overallMatchRate = m.overallMatchRate;

            bestNetworkHashMap.set(m.networkId, currentBestNetwork);

            if ((hostname === PRIMARY_HOST)
              && configuration.bestNetworkIncrementalUpdate
              && (statsObj.prevBestNetworkId !== m.networkId)) {

              statsObj.prevBestNetworkId = m.networkId;

              console.log(chalkBlue("TFE | SAVING NEW BEST NETWORK"
                + " | " + currentBestNetwork.networkId
                + " | MR: " + currentBestNetwork.matchRate.toFixed(2)
                + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2)
                + " | TEST CYCs: " + currentBestNetwork.testCycles
              ));

              fileObj = {
                networkId: currentBestNetwork.networkId,
                successRate: currentBestNetwork.successRate,
                matchRate: currentBestNetwork.matchRate,
                overallMatchRate: currentBestNetwork.overallMatchRate,
                testCycles: currentBestNetwork.testCycles,
                testCycleHistory: currentBestNetwork.testCycleHistory,
                twitterStats: statsObj.twitter,
                updatedAt: moment()
              };

              file = currentBestNetwork.networkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: currentBestNetwork });
              saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj});
            }
          }
          else {
            console.log("TFE | " + chalkError(getTimeStamp() + "??? | RNT_BEST_MATCH_RATE | NETWORK NOT IN BEST NETWORK HASHMAP?"
              + " | " + m.networkId
              + " | MR: " + m.matchRate.toFixed(2)
              + " | OAMR: " + m.overallMatchRate.toFixed(2)
              + " | TC: " + m.testCycles
              + " | TCH: " + m.testCycleHistory.length
            ));
          }
          if (m.previousBestNetworkId && bestNetworkHashMap.has(m.previousBestNetworkId)) {

            prevBesTFEObj = bestNetworkHashMap.get(m.previousBestNetworkId);
            prevBesTFEObj.matchRate = m.previousBestMatchRate;

            bestNetworkHashMap.set(m.previousBestNetworkId, prevBesTFEObj);

            if (hostname === PRIMARY_HOST) {

              console.log(chalkBlue("TFE | SAVING PREV BEST NETWORK"
                + " | MR: " + m.previousBestMatchRate.toFixed(2) + "%"
                + " | " + m.previousBestNetworkId + ".json"
              ));

              file = m.previousBestNetworkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: prevBesTFEObj });
            }
          }
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          runEnable();
        break;

        default:
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
          console.log(chalkError("TFE | *** UNKNOWN RNT OP | " + m.op));
      }
    }
  }, interval);

  if (callback !== undefined) { callback(); }
}

// function initLangAnalyzerMessageRxQueueInterval(interval) {

//   statsObj.status = "INIT LANG INTERVAL";

//   langAnalyzerMessageRxQueueReadyFlag = true;

//   console.log(chalkLog("TFE | INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));

//   let langEntityKeys = [];

//   langAnalyzerMessageRxQueueInterval = setInterval(function () {
//     if (langAnalyzerMessageRxQueueReadyFlag && (langAnalyzerMessageRxQueue.length > 0)) {
//       langAnalyzerMessageRxQueueReadyFlag = false;
//       const m = langAnalyzerMessageRxQueue.shift();
//       langEntityKeys.length = 0;
//       switch (m.op) {
//         case "LANG_RESULTS":
//           statsObj.numLangAnalyzed += 1;
//           if (m.results.entities !== undefined) {
//             langEntityKeys = Object.keys(m.results.entities);
//           }
//           debug(chalkLog("M<"
//             + " [Q: " + langAnalyzerMessageRxQueue.length
//             + " | STATS: " + statsObj.analyzer.analyzed + " ANLZD"
//             + " " + statsObj.analyzer.skipped + " SKP"
//             + " " + statsObj.analyzer.total + " TOT ]"
//             + " | OP: " + m.op
//             + " | NID: " + m.obj.nodeId
//             + " | SN: " + m.obj.screenName
//             + " | N: " + m.obj.name
//           ));
//           m.obj.languageAnalyzed = true;
//           if (m.error) {
//             m.obj.languageAnalysis = {err: m.error};
//             if (m.error.code === 8) { // LANGUAGE QUOTA; will be automatically retried
//               console.log(chalkAlert("TFE | *** LANG QUOTA ERROR ... RETRY"
//                 + " | " + m.obj.nodeId
//                 + " | " + m.obj.screenName
//                 + " | CODE: " + m.error.code
//               ));
//               m.obj.languageAnalyzed = false;
//               setTimeout(function() {
//                 langAnalyzerMessageRxQueueReadyFlag = true;
//               }, 1000);
//             }
//             else if (m.error.code === 3) { // LANGUAGE unsupported
//               console.log(chalkLog("TFE | *** LANG ERROR ... UNSUPPORTED LANG"
//                 + " | " + m.obj.nodeId
//                 + " | " + m.obj.screenName
//                 + " | CODE: " + m.error.code
//               ));
//             }
//             else {
//               console.log(chalkError("TFE | *** LANG ERROR"
//                 + " | " + m.obj.nodeId
//                 + " | " + m.obj.screenName
//                 + " | CODE: " + m.error.code
//               ));
//               m.obj.languageAnalyzed = false;
//               setTimeout(function() {
//                 langAnalyzerMessageRxQueueReadyFlag = true;
//               }, 1000);
//             }
//             userServerController.findOneUser(m.obj, {noInc: true, updateCountHistory: true }, function(err, updatedUserObj) {
//               if (err) {
//                 console.log(chalkError("TFE | ERROR DB UPDATE USER languageAnalysis0"
//                   + "\n" + err
//                   + "\n" + jsonPrint(m.obj)
//                 ));
//               }
//               else {
//                 if (statsObj.numLangAnalyzed % 50 === 0) {
//                   console.log(chalkLog("TFE | UPDATE LANG ERR | USER>DB"
//                     + " | " + updatedUserObj.nodeId
//                     + " | C: " + updatedUserObj.category
//                     + " | CA: " + updatedUserObj.categoryAuto
//                     + " | @" + updatedUserObj.screenName
//                     + " | " + updatedUserObj.name
//                     + " | Ts: " + updatedUserObj.statusesCount
//                     + " | FLs: " + updatedUserObj.followersCount
//                     + " | FRs: " + updatedUserObj.friendsCount
//                     + " | FLWg: " + updatedUserObj.following
//                     + " | 3CF: " + updatedUserObj.threeceeFollowing
//                     + " | LA: " + updatedUserObj.languageAnalyzed
//                   ));
//                 }
//               }
//               langAnalyzerMessageRxQueueReadyFlag = true;
//             });
//           }
//           else if (langEntityKeys.length > 0) {
//             debug(chalkLog("LANG ENTS: " + langEntityKeys.length));
//             async.each(langEntityKeys, function(entityKey, cb) {
//               if (!entityKey.includes(".")) {
//                 async.setImmediate(function() {
//                   cb();
//                 });
//               }
//               else {
//                 const newKey = entityKey.replace(/\./g, "");
//                 const oldValue = m.results.entities[entityKey];
//                 m.results.entities[newKey] = oldValue;
//                 delete (m.results.entities[entityKey]);
//                 debug(chalkAlert("REPLACE KEY"
//                   + " | " + entityKey
//                   + " | " + newKey
//                   + "\nOLD\n" + jsonPrint(oldValue)
//                   + "\nENTITIES\n" + jsonPrint(m.results.entities)
//                 ));
//                 async.setImmediate(function() {
//                   cb();
//                 });
//               }
//             }, function() {
//               m.obj.languageAnalysis = m.results;
//               m.obj.languageAnalyzed = true;
//               statsObj.normalization.score.min = Math.min(m.results.sentiment.score, statsObj.normalization.score.min);
//               statsObj.normalization.score.max = Math.max(m.results.sentiment.score, statsObj.normalization.score.max);
//               statsObj.normalization.magnitude.min = Math.min(m.results.sentiment.magnitude, statsObj.normalization.magnitude.min);
//               statsObj.normalization.magnitude.max = Math.max(m.results.sentiment.magnitude, statsObj.normalization.magnitude.max);
//               userServerController.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj) {
//                 if (err) {
//                   console.log(chalkError("TFE | *** ERROR DB UPDATE USER languageAnalysis1"
//                     + "\n" + err
//                     + "\n" + jsonPrint(m.obj)
//                   ));
//                 }
//                 else {
//                   if (statsObj.numLangAnalyzed % 50 === 0) {
//                     console.log(chalkLog("TFE | UPDATE LANG ANLZD"
//                       + " | LA ENTS: " + langEntityKeys.length
//                       + " | USER>DB"
//                       + " | C: " + updatedUserObj.category
//                       + " | CA: " + updatedUserObj.categoryAuto
//                       + " | @" + updatedUserObj.screenName
//                       + " | " + updatedUserObj.name
//                       + " | Ts: " + updatedUserObj.statusesCount
//                       + " | FLs: " + updatedUserObj.followersCount
//                       + " | FRs: " + updatedUserObj.friendsCount
//                       + " | FLWg: " + updatedUserObj.following
//                       + " | 3CF: " + updatedUserObj.threeceeFollowing
//                       + " | LA: " + updatedUserObj.languageAnalyzed
//                       + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
//                       + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
//                     ));
//                   }
//                 }
//                 langAnalyzerMessageRxQueueReadyFlag = true;
//               });
//             });
//           }
//           else {
//             debug(chalkLog("LANG ENTS: " + langEntityKeys.length));
//             m.obj.languageAnalysis = m.results;
//             m.obj.languageAnalyzed = true;
//             statsObj.normalization.score.min = Math.min(m.results.sentiment.score, statsObj.normalization.score.min);
//             statsObj.normalization.score.max = Math.max(m.results.sentiment.score, statsObj.normalization.score.max);
//             statsObj.normalization.magnitude.min = Math.min(m.results.sentiment.magnitude, statsObj.normalization.magnitude.min);
//             statsObj.normalization.magnitude.max = Math.max(m.results.sentiment.magnitude, statsObj.normalization.magnitude.max);
//             userServerController.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj) {
//               if (err) {
//                 console.log(chalkError("TFE | *** ERROR DB UPDATE USER languageAnalysis2"
//                   + "\nTFE | " + err
//                   + "\nTFE\n" + jsonPrint(m.obj)
//                 ));
//               }
//               else {
//                 if (statsObj.numLangAnalyzed % 50 === 0) {
//                   console.log(chalkLog("TFE | UPDATE LANG ANLZD"
//                     + " | LA ENTS: " + langEntityKeys.length
//                     + " | USER>DB"
//                     + " | C: " + updatedUserObj.category
//                     + " | CA: " + updatedUserObj.categoryAuto
//                     + " | @" + updatedUserObj.screenName
//                     + " | " + updatedUserObj.name
//                     + " | Ts: " + updatedUserObj.statusesCount
//                     + " | FLs: " + updatedUserObj.followersCount
//                     + " | FRs: " + updatedUserObj.friendsCount
//                     + " | FLWg: " + updatedUserObj.following
//                     + " | 3CF: " + updatedUserObj.threeceeFollowing
//                     + " | LA: " + updatedUserObj.languageAnalyzed
//                     + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
//                     + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
//                   ));
//                 }
//               }
//               langAnalyzerMessageRxQueueReadyFlag = true;
//             });
//           }
//         break;
//         case "QUEUE_FULL":
//           console.log(chalkError("TFE | M<"
//             + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
//             + " | OP: " + m.op
//           ));
//           languageAnalysisBusyFlag = true;
//           langAnalyzerMessageRxQueueReadyFlag = true;
//         break;
//         case "QUEUE_READY":
//           console.log(chalkError("TFE | M<"
//             + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
//             + " | OP: " + m.op
//           ));
//           languageAnalysisBusyFlag = false;
//           langAnalyzerMessageRxQueueReadyFlag = true;
//         break;
//         default:
//           console.log(chalkError("TFE | *** UNKNOWN LANG_ANALIZE OP: " + m.op));
//           langAnalyzerMessageRxQueueReadyFlag = true;
//       }
//     }
//   }, interval);
// }

function initUserDbUpdateQueueInterval(interval) {

  statsObj.status = "INIT USER DB UPDATE INTERVAL";

  console.log(chalkBlue("TFE | INIT USER DB UPDATE QUEUE INTERVAL: " + interval));

  clearInterval(userDbUpdateQueueInterval);

  userDbUpdateQueueInterval = setInterval(async function() {

    if (userDbUpdateQueueReadyFlag && (userDbUpdateQueue.length > 0)) {

      userDbUpdateQueueReadyFlag = false;

      const user = userDbUpdateQueue.shift();

      try {
        
        const updatedUserObj = await userServerController.findOneUserV2({
          user: user, 
          mergeHistograms: false, 
          noInc: true, 
          updateCountHistory: true
        });

        debug(chalkInfo("TFE | US UPD<"
          + " | " + updatedUserObj.nodeId
          + " | TW: " + updatedUserObj.isTwitterUser
          + " | C: " + updatedUserObj.category
          + " | CA: " + updatedUserObj.categoryAuto
          + " | @" + updatedUserObj.screenName
          + " | Ts: " + updatedUserObj.statusesCount
          + " | FLWRs: " + updatedUserObj.followersCount
          + " | FRNDs: " + updatedUserObj.friendsCount
          + " | LAd: " + updatedUserObj.languageAnalyzed
        ));

      }
      catch(err){
        console.log(chalkError("TFE | *** ERROR DB UPDATE USER - updateUserDb"
          + "\n" + err
        ));
      }

      userDbUpdateQueueReadyFlag = true;
            
    }
  }, interval);
}

function initRandomNetworkTreeChild() {

  statsObj.status = "INIT RNT CHILD";

  return new Promise(function(resolve, reject){

    const rntInitParams = { 
      op: "INIT", 
      childId: RNT_CHILD_ID, 
      interval: RANDOM_NETWORK_TREE_INTERVAL, 
      testMode: configuration.testMode, 
      verbose: configuration.verbose 
    };


    if (randomNetworkTree === undefined) {

      console.log(chalkBlue("TFE | INIT RANDOM NETWORK TREE CHILD PROCESS"));

      randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`);

      randomNetworkTree.on("message", function(m) {
        switch (m.op) {
          case "IDLE":
            randomNetworkTreeReadyFlag = true;
            debug(chalkAlert("TFE | <== RNT RX"
              + " [" + randomNetworkTreeMessageRxQueue.length + "]"
              + " | " + m.op
            ));
          break;
          case "BUSY":
            randomNetworkTreeReadyFlag = false;
            debug(chalkAlert("TFE | <== RNT RX BUSY"
              + " [" + randomNetworkTreeMessageRxQueue.length + "]"
              + " | " + m.op
              + " | " + m.cause
            ));
          break;
          default:
            randomNetworkTreeMessageRxQueue.push(m);
            debug(chalkAlert("TFE | <== RNT RX"
              + " [" + randomNetworkTreeMessageRxQueue.length + "]"
              + " | " + m.op
            ));
        }
      });

      randomNetworkTree.on("error", function(err) {
        randomNetworkTreeReadyFlag = true;
        randomNetworkTreeActivateQueueSize = 0;
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
        randomNetworkTree = null;
        statsObj.status = "ERROR RNT";
        console.log(chalkError("TFE | *** randomNetworkTree ERROR *** : " + err));
        console.log(chalkError("TFE | *** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
        if (!quitFlag) { quit({source: "RNT", error: err }); }
      });

      randomNetworkTree.on("exit", function(err) {
        randomNetworkTreeReadyFlag = true;
        randomNetworkTreeActivateQueueSize = 0;
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
        randomNetworkTree = null;
        console.log(chalkError("TFE | *** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
        if (!quitFlag) { quit({source: "RNT", error: err }); }
      });

      randomNetworkTree.on("close", function(code) {
        randomNetworkTreeReadyFlag = true;
        randomNetworkTreeActivateQueueSize = 0;
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
        randomNetworkTree = null;
        console.log(chalkError("TFE | *** randomNetworkTree CLOSE *** | " + code));
        if (!quitFlag) { quit({source: "RNT", code: code }); }
      });

      randomNetworkTree.send(rntInitParams, function(err) {
        if (err) {
          console.log(chalkError("TFE | *** RNT SEND INIT ERROR: " + err));
          return reject(err);
        }
        console.log(chalkLog("TFE | RNT CHILD INITIALIZED"));
        resolve();
      });
    }
    else {
      randomNetworkTree.send(rntInitParams, function(err) {

        if (err) {
          console.log(chalkError("TFE | *** RNT SEND INIT ERROR: " + err));
          return reject(err);
        }
        console.log(chalkLog("TFE | RNT CHILD INITIALIZED"));
        resolve();
      });
    }

  });
}

// function initLangAnalyzer(callback) {

//   statsObj.status = "INIT LANG ANALYZER";

//   console.log(chalkLog("TFE | INIT LANGUAGE ANALYZER CHILD PROCESS"));

//   langAnalyzer = cp.fork(`languageAnalyzerChild.js`);

//   langAnalyzer.on("message", function(m) {
//     debug(chalkLog("TFE | <== LA RX"
//       + " [" + langAnalyzerMessageRxQueue.length + "]"
//       + " | " + m.op
//     ));
//     if (m.op === "LANG_TEST_FAIL") {
//       console.log(chalkAlert(getTimeStamp() + " | LANG_TEST_FAIL"));
//       if (m.err.code === 8) {
//         console.log(chalkError("TFE | *** LANG_TEST_FAIL"
//           + " | LANGUAGE QUOTA"
//           + " | " + m.err
//         ));
//         languageAnalysisBusyFlag = false;
//       }
//       else if (m.err.code === 7) {
//         console.log(chalkError("TFE | *** LANG_TEST_FAIL"
//           + " | PERMISSION DENIED"
//           + "\n" + m.err.details
//         ));
//         languageAnalysisBusyFlag = false;
//       }
//       else {
//         console.log(chalkError("TFE | *** LANG_TEST_FAIL"
//           + "\n" + m.err
//         ));
//         languageAnalysisBusyFlag = false;
//         if (configuration.quitOnError) { quit("LANG_TEST_FAIL"); }
//       }
//     }
//     else if (m.op === "LANG_TEST_PASS") {
//       languageAnalysisBusyFlag = false;
//       console.log(chalkTwitter("TFE | " + getTimeStamp() + " | LANG_TEST_PASS | LANG ANAL BUSY: " + languageAnalysisBusyFlag));
//     }
//     else if (m.op === "QUEUE_FULL") {
//       languageAnalysisBusyFlag = true;
//       console.log(chalkError("TFE | *** LANG Q FULL"));
//     }
//     else if (m.op === "QUEUE_EMPTY") {
//       languageAnalysisBusyFlag = false;
//       debug(chalkInfo("LANG Q EMPTY"));
//     }
//     else if (m.op === "IDLE") {
//       languageAnalysisBusyFlag = false;
//       debug(chalkInfo("LANG ANAL IDLE"));
//     }
//     else if (m.op === "QUEUE_READY") {
//       languageAnalysisBusyFlag = false;
//       debug(chalkInfo("LANG Q READY"));
//     }
//     else {
//       debug(chalkInfo("LANG Q PUSH"));
//       languageAnalysisBusyFlag = true;
//       langAnalyzerMessageRxQueue.push(m);
//     }
//   });
//   langAnalyzer.on("error", function(err) {
//     console.log(chalkError("TFE | *** langAnalyzer ERROR ***\n" + jsonPrint(err)));
//     statsObj.status = "ERROR LA";
//     if (!quitFlag) { quit({source: "LA", error: err }); }
//   });
//   langAnalyzer.on("exit", function(err) {
//     console.log(chalkError("TFE | *** langAnalyzer EXIT ***\n" + jsonPrint(err)));
//     if (!quitFlag) { quit({source: "LA", error: err }); }
//   });
//   langAnalyzer.on("close", function(code) {
//     console.log(chalkError("TFE | *** langAnalyzer CLOSE *** | " + code));
//     if (!quitFlag) { quit({source: "LA", code: code }); }
//   });

//   console.log(chalkLog("TFE | LAC CHILD CREATED"));

//   if (callback !== undefined) { callback(); }
// }

function parseText(params){

  return new Promise(async function(resolve, reject) {

    params.updateGlobalHistograms = (params.updateGlobalHistograms !== undefined) ? params.updateGlobalHistograms : false;
    params.category = (params.category !== undefined) ? params.category : "none";
    params.minWordLength = params.minWordLength || configuration.minWordLength;

    try {
      const hist = await twitterTextParser.parseText(params);
      // console.log("parseText\n" + jsonPrint(hist));
      resolve(hist);
    }
    catch(err){
      console.log(chalkError("*** TWITTER TEXT PARSER ERROR: " + err));
      console.error(err);
      reject(err);
    }

  });
}

function parseImage(params){

  return new Promise(function(resolve, reject) {

    params.updateGlobalHistograms = (params.updateGlobalHistograms !== undefined) ? params.updateGlobalHistograms : false;
    params.category = params.user.category || "none";
    params.imageUrl = params.user.bannerImageUrl;
    params.histograms = params.user.histograms;
    params.screenName = params.user.screenName;

    twitterImageParser.parseImage(params).
    then(function(hist){
      resolve(hist);
    }).
    catch(function(err){
      console.log(chalkError("*** TWITTER IMAGE PARSER ERROR: " + err));
      console.error(err);
      reject(err);
    });

  });
}

function geoCode(params) {

  return new Promise(function(resolve, reject){

    const components = {};
    let placeId = false;
    let geoValid = false;
    let formattedAddress;

    googleMapsClient.geocode({ address: params.address }, function(err, response) {
      if (err) {
        console.log(chalkError("TCS | *** GEOCODE ERROR: " + err));
        return reject(err);
      }
      if (response.json.results.length > 0) {

        geoValid = true;
        placeId = response.json.results[0].place_id;
        formattedAddress = response.json.results[0].formatted_address;

        debug(chalkLog("TCS | GEOCODE"
          + " | " + params.address
          + " | PLACE ID: " + placeId
          + " | FORMATTED: " + response.json.results[0].formatted_address
          // + "\n" + jsonPrint(response.json)
        ));

        async.each(response.json.results[0].address_components, function(addressComponent, cb0){

          // console.log(chalkLog("TCS | GEOCODE | addressComponent"
          //  + "\n" + jsonPrint(addressComponent)
          // ));

          if (!addressComponent.types || addressComponent.types === undefined || addressComponent.types.length === 0){
            async.setImmediate(function() { return cb0(); });
          }

          async.eachOf(addressComponent.types, function(addressComponentType, index, cb1){
            switch(addressComponentType){
              case "country":
              case "locality":
              case "sublocality":
              case "sublocality_level_1":
              case "administrative_area_level_1":
              case "administrative_area_level_2":
              case "administrative_area_level_3":
                components[addressComponentType] = addressComponent.long_name;

                debug(chalkInfo("TCS | GEOCODE | +++ ADDRESS COMPONENT"
                  + " | " + params.address
                  + " | FORMATTED: " + response.json.results[0].formatted_address
                  + " | TYPE: " + addressComponentType
                  + " | " + components[addressComponentType]
                ));

              break;
              default:
            }
            cb1();
          }, function(){
            async.setImmediate(function() { cb0(); });
          });

        }, function(err){
          if (err) {

            console.log(chalkError("TCS | *** GEOCODE ERROR: " + err));
            return reject(err);
          }

          debug(chalkLog("TCS | GEOCODE"
            + " | " + params.address
            + " | PLACE ID: " + placeId
            + " | FORMATTED: " + response.json.results[0].formatted_address
            // + "\n" + jsonPrint(response.json)
          ));

          resolve({ 
            geoValid: geoValid,
            placeId: placeId, 
            formattedAddress: formattedAddress, 
            components: components, 
            raw: response.json 
          });
        });
      }
      else {
        resolve({ 
          geoValid: geoValid,
          placeId: placeId, 
          formattedAddress: formattedAddress, 
          components: components, 
          raw: response.json 
        });
      }

      // console.log(chalkAlert("TCS | GEOCODE | PLACE: " + placeId));
      // resolve({ placeId: placeId, components: components, raw: response.json });
    });

  });
}

function mergeHistogramsArray(params) {
  return new Promise(function(resolve, reject){

    let resultHistogram = {};

    async.eachSeries(params.histogramArray, async function(histogram){
      
      try {
        resultHistogram = await mergeHistograms.merge({ histogramA: resultHistogram, histogramB: histogram });
        return;
      }
      catch(err){
        return err;
      }

    }, function(err){
      if (err) {
        return reject(err);
      }
      resolve(resultHistogram);
    })
  });
}

function checkUserIgnored(params){

  return new Promise(function(resolve, reject){

    if (!params.nodeId) {
      return reject(new Error("nodeId UNDEFINED"));
    }

    global.globalUser.findOne({nodeId: params.nodeId}, function(err, user){

      if (err) { return reject(err); }

      if (user && user.ignored) {
        return resolve(true);
      }

      resolve(false);

    });

  });
}

function checkPropertyChange(user, prop){
  const prevProp = "previous" + _.upperFirst(prop);
  if (user[prop] && (user[prop] !== undefined) && (user[prevProp] !== user[prop])) { return true; }
  return false;
}

function allHistogramsZeroKeys(histogram){

  return new Promise(function(resolve){

    Object.keys(histogram).forEach(function(histogramType){
      if (Object.keys(histogram[histogramType]).length > 0) { return resolve(false); }
    });

    resolve(true);

  });
}

function checkUserProfileChanged(params) {

  return new Promise(async function(resolve, reject){

    const user = params.user;

    let allHistogramsZero = false;

    try{
      allHistogramsZero = await allHistogramsZeroKeys(user.profileHistograms);
    }
    catch(err){
      console.log(chalkError("TFE | *** ALL HISTOGRAMS ZERO ERROR: " + err));
      return reject(err);
    }

    if (!user.profileHistograms 
      || (user.profileHistograms === undefined) 
      || (user.profileHistograms === {})
      || (Object.keys(user.profileHistograms).length === 0)
      || allHistogramsZero
    ){

      console.log(chalkInfo(
        "TFE | USER PROFILE HISTOGRAMS UNDEFINED" 
        + " | RST PREV PROP VALUES" 
        + " | @" + user.screenName 
        + "\nTFE | PROFILE HISTOGRAMS\n" + jsonPrint(user.profileHistograms) 
      ));

      user.previousBannerImageUrl = null;
      user.previousDescription = null;
      user.previousExpandedUrl = null;
      user.previousLocation = null;
      user.previousName = null;
      user.previousProfileUrl = null;
      user.previousScreenName = null;
      user.previousUrl = null;
    }

    const results = [];

    if (checkPropertyChange(user, "bannerImageUrl")) { results.push("bannerImageUrl"); }
    if (checkPropertyChange(user, "description")) { results.push("description"); }
    if (checkPropertyChange(user, "expandedUrl")) { results.push("expandedUrl"); }
    if (checkPropertyChange(user, "location")) { results.push("location"); }
    if (checkPropertyChange(user, "name")) { results.push("name"); }
    if (checkPropertyChange(user, "profileUrl")) { results.push("profileUrl"); }
    if (checkPropertyChange(user, "screenName")) { results.push("screenName"); }
    if (checkPropertyChange(user, "url")) { results.push("url"); }

    if (results.length === 0) { return resolve(); }
    resolve(results);    
  });
}

// function checkUserStatusChanged(params) {

//   return new Promise(async function(resolve, reject){

//     let user = params.user;

//     let allHistogramsZero = false;

//     try{
//       allHistogramsZero = await allHistogramsZeroKeys(user.tweetHistograms);
//     }
//     catch(err){
//       console.log(chalkError("TFE | *** ALL HISTOGRAMS ZERO ERROR: " + err));
//       return reject(err);
//     }

//     if (!user.tweetHistograms 
//       || (user.tweetHistograms === undefined) 
//       || (user.tweetHistograms === {})
//       || (Object.keys(user.tweetHistograms).length === 0)
//       || allHistogramsZero
//     ){

//       console.log(chalkLog(
//         "TFE | USER TWEET HISTOGRAMS UNDEFINED" 
//         + " | RST PREV PROP VALUES" 
//         + " | @" + user.screenName 
//       ));

//       user.previousStatusId = null;
//       user.previousQuotedStatusId = null;
//     }

//     let results = [];

//     if (checkPropertyChange(user, "statusId")) { results.push("statusId"); }
//     if (checkPropertyChange(user, "quotedStatusId")) { results.push("quotedStatusId"); }

//     if (results.length === 0) { return resolve(); }
//     resolve(results);    

//   });
// }

function processTweetObj(params){

  return new Promise(async function(resolve, reject){

    const tweetObj = params.tweetObj;
    const histograms = params.histograms;

    async.eachSeries(DEFAULT_INPUT_TYPES, function(entityType, cb0){

      if (!entityType || entityType === undefined) {
        console.log(chalkAlert("TFE | ??? UNDEFINED TWEET entityType: ", entityType));
        return cb0();
      }

      if (entityType === "user") { return cb0(); }
      if (!tweetObj[entityType] || tweetObj[entityType] === undefined) { return cb0(); }
      if (tweetObj[entityType].length === 0) { return cb0(); }

      async.eachSeries(tweetObj[entityType], function(entityObj, cb1){

        if (!entityObj) {
          debug(chalkInfo("TFE | !!! NULL entity? | ENTITY TYPE: " + entityType + " | entityObj: " + entityObj));
          return cb1();
        }

        let entity;

        switch (entityType) {
          case "hashtags":
            entity = "#" + entityObj.nodeId.toLowerCase();
          break;
          case "mentions":
          case "userMentions":
            entity = "@" + entityObj.screenName.toLowerCase();
          break;
          case "locations":
            entity = entityObj.nodeId;
          break;
          case "images":
          case "media":
            entity = entityObj.nodeId;
          break;
          case "emoji":
            entity = entityObj.nodeId;
          break;
          case "urls":
            if (entityObj.nodeId.includes(".")) { 
              entity = btoa(entityObj.nodeId);
            }
            else{
              entity = entityObj.nodeId;
            }
          break;
          case "words":
            entity = entityObj.nodeId.toLowerCase();
            entity = entity.replace(/\./gi, "_")
          break;
          case "places":
            entity = entityObj.nodeId;
          break;
          default:
            console.log(chalkError("TFE | *** UNKNOWN ENTITY TYPE: " + entityType));
            return reject(new Error("UNKNOWN ENTITY TYPE: " + entityType));
        }

        if (!histograms[entityType] || (histograms[entityType] === undefined)){
          histograms[entityType] = {};
          histograms[entityType][entity] = 1;
        }

        if (!histograms[entityType][entity] || (histograms[entityType][entity] === undefined)){
          histograms[entityType][entity] = 1;
        }

        async.setImmediate(function() { cb1(); });

      }, function(){

        async.setImmediate(function() { cb0(); });

      });
    }, function(err){

      if (err) {
        return reject(err);
      }

      resolve(histograms);

    });

  });
}

function userProfileChangeHistogram(params) {

  return new Promise(async function(resolve, reject){

    let userProfileChanges = false;

    try {
      userProfileChanges = await checkUserProfileChanged(params);
    }
    catch(err){
      return reject(err);
    }

    if (!userProfileChanges) {
      return resolve();
    }

    const user = params.user;

    let text = "";
    const urlsHistogram = {};
    urlsHistogram.urls = {};
    const bannerImageUrl = false;

    const locationsHistogram = {};
    locationsHistogram.locations = {};

    async.each(userProfileChanges, async function(userProp){

      const userPropValue = user[userProp].toLowerCase();

      const prevUserProp = "previous" + _.upperFirst(userProp);

      let domain;
      let domainNodeId;
      let nodeId;

      user[prevUserProp] = (!user[prevUserProp] || (user[prevUserProp] === undefined)) ? null : user[prevUserProp];

      switch (userProp) {

        case "location":

          text += userPropValue + "\n";

          const lastSeen = Date.now();

          let name = userPropValue.trim().toLowerCase();
          name = name.replace(/\./gi, "");

          nodeId = btoa(name);

          locationsHistogram.locations[nodeId] = (locationsHistogram.locations[nodeId] === undefined) ? 1 : locationsHistogram.locations[nodeId] + 1;

          try {

            let locationDoc = await Location.findOne({nodeId: nodeId});

            if (!locationDoc) {

              debug(chalkInfo("TFE | --- LOC DB MISS"
                + " | NID: " + nodeId
                + " | N: " + name + " / " + userPropValue
              ));

              locationDoc = new Location({
                nodeId: nodeId,
                name: name,
                nameRaw: userPropValue,
                geoSearch: false,
                geoValid: false,
                lastSeen: lastSeen,
                mentions: 0
              });

              let geoCodeResults;

              if (configuration.geoCodeEnabled) {
                geoCodeResults = await geoCode({address: name});
                locationDoc.geoSearch = true;
              }

              if (geoCodeResults && geoCodeResults.placeId) {

                locationDoc.geoValid = true;
                locationDoc.geo = geoCodeResults;
                locationDoc.placeId = geoCodeResults.placeId;
                locationDoc.formattedAddress = geoCodeResults.formattedAddress;

                await locationDoc.save();

                statsObj.geo.hits += 1;
                statsObj.geo.total += 1;
                statsObj.geo.hitRate = 100*(statsObj.geo.hits/statsObj.geo.total);

                debug(chalk.blue("TFE | +++ LOC GEO HIT "
                  + " | GEO: " + locationDoc.geoValid
                  + "  H " + statsObj.geo.hits
                  + "  M " + statsObj.geo.misses
                  + "  T " + statsObj.geo.total
                  + " HR: " + statsObj.geo.hitRate.toFixed(2)
                  + " | PID: " + locationDoc.placeId 
                  + " | NID: " + locationDoc.nodeId
                  + " | N: " + locationDoc.name + " / " + locationDoc.nameRaw
                  + " | A: " + locationDoc.formattedAddress
                ));

                user.geoValid = geoCodeResults.geoValid;
                user.geo = geoCodeResults;

                locationsHistogram.locations[geoCodeResults.placeId] = (locationsHistogram.locations[geoCodeResults.placeId] === undefined) 
                  ? 1 
                  : locationsHistogram.locations[geoCodeResults.placeId] + 1;


                user[prevUserProp] = user[userProp];

              } else {

                await locationDoc.save();

                statsObj.geo.misses += 1;
                statsObj.geo.total += 1;
                statsObj.geo.hitRate = 100*(statsObj.geo.hits/statsObj.geo.total);

                debug(chalkLog("TFE | --- LOC GEO MISS"
                  + " | GEO: " + locationDoc.geoValid
                  + "  H " + statsObj.geo.hits
                  + "  M " + statsObj.geo.misses
                  + "  T " + statsObj.geo.total
                  + " HR: " + statsObj.geo.hitRate.toFixed(2)
                  + " | NID: " + locationDoc.nodeId
                  + " | N: " + locationDoc.name + " / " + locationDoc.nameRaw
                ));

                user[prevUserProp] = user[userProp];
              }

            }
            else {

              locationDoc.mentions += 1;
              locationDoc.lastSeen = lastSeen;


              debug(chalk.green("TFE | +++ LOC DB HIT "
                + " | GEO: " + locationDoc.geoValid
                + "  H " + statsObj.geo.hits
                + "  M " + statsObj.geo.misses
                + "  T " + statsObj.geo.total
                + " HR: " + statsObj.geo.hitRate.toFixed(2)
                + " | PID: " + locationDoc.placeId 
                + " | NID: " + locationDoc.nodeId
                + " | N: " + locationDoc.name + " / " + locationDoc.nameRaw
                + " | A: " + locationDoc.formattedAddress
              ));

              if (locationDoc.geoValid) {
                if (configuration.geoCodeEnabled 
                  && (!locationDoc.geoSearch || !locationDoc.geo || locationDoc.geo === undefined)) {
                  locationDoc.geo = await geoCode({address: locationDoc.name});
                }
                user.geoValid = true;
                user.geo = locationDoc.geo;
              }

              await locationDoc.save();

              const key = (locationDoc.placeId && locationDoc.placeId !== undefined) ? locationDoc.placeId : locationDoc.nodeId;

              locationsHistogram.locations[key] = (locationsHistogram.locations[key] === undefined) ? 1 : locationsHistogram.locations[key] + 1;

              user[prevUserProp] = user[userProp];
            }
          }
          catch(err){
            console.log(chalkError("TCS | *** GEOCODE ERROR", err));
          }
        break;

        case "name":
        case "description":
          text += userPropValue + "\n";
          user[prevUserProp] = user[userProp];
        break;

        case "screenName":
          text += "@" + userPropValue + "\n";
          user[prevUserProp] = user[userProp];
        break;

        case "url":
        case "profileUrl":
        case "expandedUrl":
        case "bannerImageUrl":

          domain = urlParse(userPropValue.toLowerCase()).hostname;
          nodeId = btoa(userPropValue.toLowerCase());

          if (domain) { 
            domainNodeId = btoa(domain);
            urlsHistogram.urls[domainNodeId] = (urlsHistogram.urls[domainNodeId] === undefined) ? 1 : urlsHistogram.urls[domainNodeId] + 1; 
          }
          urlsHistogram.urls[nodeId] = (urlsHistogram.urls[nodeId] === undefined) ? 1 : urlsHistogram.urls[nodeId] + 1;
          user[prevUserProp] = user[userProp];
        break;

        default:
          console.log(chalkError("TFE | UNKNOWN USER PROPERTY: " + userProp));
          return (new Error("UNKNOWN USER PROPERTY: " + userProp));
      }
      return;

    }, function(err){

      if (err) {
        console.log(chalkError("TFE | USER PROFILE HISTOGRAM ERROR: " + err));
        return reject(err);
      }

      async.parallel({

        imageHist: function(cb) {

          if (configuration.enableImageAnalysis && bannerImageUrl){

            parseImage({
              screenName: user.screenName, 
              category: user.category, 
              imageUrl: bannerImageUrl, 
              histograms: user.profileHistograms,
              updateGlobalHistograms: true
            }).
            then(function(imageParseResults){
              cb(null, imageParseResults);
            }).
            catch(function(err){
              console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
              cb(err, null);
            });

          }
          else {
            cb(null, null);
          }
        }, 

        textHist: function(cb){

          if (text && (text !== undefined)){

            parseText({ category: user.category, text: text, updateGlobalHistograms: true }).
            then(function(textParseResults){

              cb(null, textParseResults);

            }).
            catch(function(err){
              if (err) {
                console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
              }
              cb(err, null);
            });
          }
          else {
            cb(null, null);
          }
        }

      }, function(err, results){

        if (err) {
          console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
          return reject(err);
        }

        mergeHistogramsArray( {histogramArray: [results.textHist, results.imageHist, urlsHistogram, locationsHistogram]} ).
        then(function(histogramsMerged){
          resolve(histogramsMerged);
        }).
        catch(function(err){
          console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
          return reject(err);
        });
      });
    });

  });
}

function updateUserHistograms(params) {

  return new Promise(async function(resolve, reject){
    
    if ((params.user === undefined) || !params.user) {
      console.log(chalkError("TFE | *** updateUserHistograms USER UNDEFINED"));
      const err = new Error("TFE | *** updateUserHistograms USER UNDEFINED");
      console.error(err);
      return reject(err);
    }

    const user = params.user;

    user.profileHistograms = user.profileHistograms || {};
    user.tweetHistograms = user.tweetHistograms || {};

    try {

      const profileHistogramChanges = await userProfileChangeHistogram({user: user});

      if (profileHistogramChanges) {
        user.profileHistograms = await mergeHistograms.merge({ histogramA: user.profileHistograms, histogramB: profileHistogramChanges });
      }

      user.lastHistogramTweetId = user.statusId;
      user.lastHistogramQuoteId = user.quotedStatusId;

      const updatedUser = await userServerController.findOneUserV2({user: user, mergeHistograms: false, noInc: true});

      await updateGlobalHistograms(params);
      resolve(updatedUser);

    }
    catch(err){
      console.log(chalkError("TFE | *** updateUserHistograms ERROR: " + err));
      return reject(err);
    }

  });
}

function generateAutoCategory(user, callback) {

    statsObj.status = "GEN AUTO CAT";

    // need separate user histograms for:

    // 1) USER PROFILE PROPERTIES: 
    //    screenName, userName, description, location, bannerImage, followers?, friends?

    // 2) USER TWEET PROPERTIES:
    //    hashtags, userMentions, urls, places, media, etc.

    // only update histograms on changes.  accumulate histograms

    // console.log(chalkLog("TFE | generateAutoCategory user\n" + jsonPrint(user.toObject())));

    updateUserHistograms({user: user}).
    then(function(updatedUser){
      activateNetworkQueue.push({user: updatedUser, normalization: statsObj.normalization});
      statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;
      callback(null, updatedUser);
    }).
    catch(function(err){
      console.log(chalkError("TFE | *** USER CATEGORIZE ERROR: " + err));
      callback(err, user);
    });
}

function updateUserTweets(params){

  return new Promise(function(resolve, reject){

    if (params.tweets.length === 0) { return resolve(params.user); }

    const user = params.user;
    if (user.tweetHistograms === undefined) { user.tweetHistograms = {}; }
    if (user.tweets === undefined) { 
      user.tweets = {};
      user.tweets.maxId = "0";
      user.tweets.sinceId = "0";
      user.tweets.tweetIds = [];
    }

    user.tweets.maxId = user.tweets.maxId || "0";
    user.tweets.sinceId = user.tweets.sinceId || "0";
    user.tweets.tweetIds = user.tweets.tweetIds || [];

    if (user.tweetHistograms === undefined) { user.tweetHistograms = {}; }

    const tscParams = {};

    tscParams.globalTestMode = configuration.globalTestMode;
    tscParams.testMode = configuration.testMode;
    tscParams.inc = false;
    tscParams.twitterEvents = configEvents;
    tscParams.tweetStatus = {};

    let tweetsProcessed = 0;

    async.eachSeries(params.tweets, async function(tweet){

      tscParams.tweetStatus = tweet;
      tscParams.tweetStatus.user = {};
      tscParams.tweetStatus.user = user;
      tscParams.tweetStatus.user.isNotRaw = true;

      if (tweet.id_str > user.tweets.maxId) {
        user.tweets.maxId = tweet.id_str;
      }

      if (tweet.id_str > user.tweets.sinceId) {
        user.tweets.sinceId = tweet.id_str;
      }

      if (!user.tweets.tweetIds.includes(tweet.id_str)) { 

        try {

          const tweetObj = await tweetServerController.createStreamTweet(tscParams);

          user.tweetHistograms = await processTweetObj({tweetObj: tweetObj, histograms: user.tweetHistograms});
          user.tweets.tweetIds.push(tweet.id_str); 

          tweetsProcessed += 1;
          statsObj.twitter.tweetsProcessed += 1;
          statsObj.twitter.tweetsTotal += 1;

          if (configuration.verbose) {
            console.log(chalkTwitter("TFE | +++ PROCESSED TWEET"
              + " [ H/P/T " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + "]"
              + " | TW: " + tweet.id_str
              + " | SINCE: " + user.tweets.sinceId
              + " | TWs: " + user.tweets.tweetIds.length
              + " | @" + user.screenName
            ));
          }

          return;
        }
        catch(err){
          console.log(chalkError("TFE | updateUserTweets ERROR: " + err));
          return err;
        }
      }
      else {

        statsObj.twitter.tweetsHits += 1;
        statsObj.twitter.tweetsTotal += 1;

        if (configuration.verbose) {
          console.log(chalkInfo("TFE | ... TWEET ALREADY PROCESSED"
            + " [ H/P/T " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + "]"
            + " | TW: " + tweet.id_str
            + " | TWs: " + user.tweets.tweetIds.length
            + " | @" + user.screenName
          ));
        }

        return;
      }

    }, function(err){
      if (err) {
        console.log(chalkError("TFE | updateUserTweets ERROR: " + err));
        return reject(err);
      }

      if (configuration.verbose || (tweetsProcessed > 0)) {
        console.log(chalkLog("TFE | +++ TWEETS"
          + " | NEW: " + tweetsProcessed
          + " [ PRCSSD/HITS/TOT " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + " ]"
          + " | SINCE: " + user.tweets.sinceId
          + " | Ts: " + user.tweets.tweetIds.length
          + " | @" + user.screenName
        ));
      }

      resolve(user);
    });

  });
}

function processUser(params) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "PROCESS USER";

    const userIn = params.user;
    // const threeceeUser = params.threeceeUser || "altthreecee00";

    debug(chalkInfo("PROCESS USER\n" + jsonPrint(userIn)));

    if (userServerController === undefined) {
      console.log(chalkError("TFE | *** processUser userServerController UNDEFINED"));
      return reject(new Error("processUser userServerController UNDEFINED"));
    }

    let user;

    try {
      user = await updateUserTweets({user: userIn, tweets: userIn.latestTweets});
    }
    catch(err) {
      console.log(chalkError("TFE | *** processUser updateUserTweets ERROR: " + err));
      return reject(err);
    }

    async.waterfall(
    [
      function(cb) {

        const catObj = {};
        catObj.manual = user.category || false;
        catObj.auto = user.categoryAuto || false;

        if (userIn.screenName && (userIn.screenName !== undefined) && (user.screenName !== userIn.screenName)) {
          user.screenName = userIn.screenName.toLowerCase();
          user.screenNameLower = userIn.screenName.toLowerCase();
        }

        if (userIn.name && (user.name !== userIn.name)) {
          user.name = userIn.name;
        }
        
        if (userIn.description && (userIn.description !== undefined) && (user.description !== userIn.description)) {
          user.description = userIn.description;
        }

        if (userIn.location && (userIn.location !== undefined) && (user.location !== userIn.location)) {
          user.location = userIn.location;
        }

        // userIn.url = _.get(userIn, "entities.url.urls[0].expanded_url", userIn.url);

        if (userIn.url && (userIn.url !== undefined) && (user.url !== userIn.url)) {
          user.url = userIn.url;
        }

        if (userIn.profileUrl && (userIn.profileUrl !== undefined) && (user.profileUrl !== userIn.profileUrl)) {
          user.profileUrl = userIn.profileUrl;
        }

        if (userIn.bannerImageUrl && (userIn.bannerImageUrl !== undefined) && (user.bannerImageUrl !== userIn.bannerImageUrl)) {
          user.bannerImageAnalyzed = false;
          user.bannerImageUrl = userIn.bannerImageUrl;
        }

        if (userIn.profileImageUrl && (userIn.profileImageUrl !== undefined) && (user.profileImageUrl !== userIn.profileImageUrl)) {
          user.profileImageUrl = userIn.profileImageUrl;
        }

        if (userIn.status && (userIn.status !== undefined)) {

          user.status = userIn.status;

          if (user.statusId !== userIn.statusId) {
            user.lastSeen = userIn.lastSeen;
            user.updateLastSeen = true;
          }
        }

        if (userIn.quotedStatusId && (userIn.quotedStatusId !== undefined) && (user.quotedStatusId !== userIn.quotedStatusId)) {
          user.quotedStatusId = userIn.quotedStatusId;
          user.quotedStatus = userIn.quotedStatus;
        }

        if ((userIn.followersCount !== undefined) && (user.followersCount !== userIn.followersCount)) {
          user.followersCount = userIn.followersCount;
        }
        if ((userIn.friendsCount !== undefined) && (user.friendsCount !== userIn.friendsCount)) {
          user.friendsCount = userIn.friendsCount;
        }
        if ((userIn.statusesCount !== undefined) && (user.statusesCount !== userIn.statusesCount)) {
          user.statusesCount = userIn.statusesCount;
        } 

        cb(null, user);
      },

      function(user, cb) {
        user.following = true;
        cb(null, user);
      },

      function(user, cb) {

        if (!neuralNetworkInitialized) { 
          return cb(null, user);
        }

        if (!user.category || user.category === undefined || user.category === null) { 
          return cb(null, user);
        }

        generateAutoCategory(user, function (err, uObj) {
          if (err){
            return cb(err, null);
          }
          cb(null, uObj);
        });
      }
    ], function (err, user) {
      if (err) {
        console.log(chalkError("TFE | *** PROCESS USER ERROR: " + err));
        return reject(err);
      }
      resolve(user);
    });

  });
}

function updatePreviousUserProps(params){

  return new Promise(function(resolve, reject){

    if (!params.user) {
      return reject(new Error("user UNDEFINED"));
    }

    const user = params.user;

    async.each(USER_PROFILE_PROPERTY_ARRAY, function(userProp, cb){

      const prevUserProp = "previous" + _.upperFirst(userProp);

      if (user[userProp] && (user[userProp] !== undefined) && (user[prevUserProp] !== user[userProp])) {
        debug(chalkLog("TFE | updatePreviousUserProps"
          + " | " + prevUserProp + ": " + user[prevUserProp] 
          + " <- " + userProp + ": " + user[userProp]
        ));

        user[prevUserProp] = user[userProp];

        // user.markModified(prevUserProp);

      }
      cb();

    }, function(){

      if (user.statusId && (user.statusId !== undefined) && (user.previousStatusId !== user.statusId)) {
        user.previousStatusId = user.statusId;
        // user.markModified("previousStatusId");
      }

      if (user.quotedStatusId && (user.quotedStatusId !== undefined) && (user.previousQuotedStatusId !== user.quotedStatusId)) {
        user.previousQuotedStatusId = user.quotedStatusId;
        // user.markModified("quotedStatusId");
        // user.markModified("quotedStatusId");
      }

      resolve(user);
    });

  });
}

function initProcessUserQueueInterval(interval) {

  statsObj.status = "INIT PROCESS USER QUEUE";

  let mObj = {};
  // let childId;
  const tcUser = "altthreecee00";
  // const ignoredFlag = false;

  console.log(chalkBlue("TFE | INIT PROCESS USER QUEUE INTERVAL | " + PROCESS_USER_QUEUE_INTERVAL + " MS"));

  clearInterval(processUserQueueInterval);

  processUserQueueInterval = setInterval(async function () {

    if (!statsObj.queues.processUserQueue.busy && statsObj.queues.processUserQueue.size > 0) {

      statsObj.status = "PROCESS USER";

      statsObj.queues.processUserQueue.busy = true;

      mObj = processUserQueue.shift(); // .latestTweets[], .userId

      statsObj.queues.processUserQueue.size = processUserQueue.length;

      try {

        if (!categorizedUserHashmap.has(mObj.userId)){
          console.log(chalkAlert("TFE | !!! USER ID NOT IN CATEGORIZED HASHMAP: " + mObj.userId));
          statsObj.users.totalUsersSkipped += 1;
          statsObj.queues.processUserQueue.busy = false;
          return;
        }

        const u = categorizedUserHashmap.get(mObj.userId);

        u.latestTweets = u.latestTweets || [];
        u.latestTweets = _.union(u.latestTweets, mObj.latestTweets);

        const user = await processUser({user: u});

        if (configuration.verbose) {
          console.log(chalkAlert("TFE | PROCESSED USER"
            + " | UID: " + user.userId
            + " | @" + user.screenName
            + " | LTs: " + u.latestTweets.length
            // + " | Ts: " + user.tweets.length
          ));
        }

        statsObj.users.processed += 1;
        statsObj.users.percentProcessed = 100*statsObj.users.processed/statsObj.users.categorized.total;

        debug("PROCESSED USER\n" + jsonPrint(user));

        if (statsObj.users.processed % 100 === 0) {
          showStats();
        }

        const userUpdated = await updatePreviousUserProps({user: user});

        await userServerController.findOneUserV2({user: userUpdated, mergeHistograms: false, noInc: true});

        statsObj.queues.processUserQueue.busy = false;
      }
      catch(err){
        console.log(chalkError("TFE | *** ERROR processUser"
          + " | USER ID: " + mObj.userId
          + " | " + err
        ));
        statsObj.queues.processUserQueue.busy = false;
      }

    }
  }, interval);
}

function initUnfollowableUserSet(){

  return new Promise(async function(resolve, reject){

    try {

      const unfollowableUserSetObj = await loadFile({folder: dropboxConfigDefaultFolder, file: unfollowableUserFile});

      if (unfollowableUserSetObj) {

        unfollowableUserSet = new Set(unfollowableUserSetObj.userIds);

        console.log(chalk.bold.black("TFE | INIT UNFOLLOWABLE USERS | " + unfollowableUserSet.size + " USERS"));

        resolve(unfollowableUserSet);
      }
    }
    catch(err){
      if (err.code === "ENOTFOUND") {
        console.log(chalkError("TFE | *** LOAD UNFOLLOWABLE USERS ERROR: FILE NOT FOUND:  " 
          + dropboxConfigDefaultFolder + "/" + unfollowableUserFile
        ));
      }
      else {
        console.log(chalkError("TFE | *** LOAD UNFOLLOWABLE USERS ERROR: " + err));
      }

      reject(err);
    }

  });
}

// function resetAllTwitterUserState() {

//   return new Promise(function(resolve, reject){

//     statsObj.status = "RESET ALL TWITTER USERS";

//     async.forEach(Object.keys(twitterUserHashMap), async function(user) {
//       try {
//         await resetTwitterUserState(user);
//         return;
//       }
//       catch(err){
//         return(err);
//       }
//     }, function(err) {
//       if (err) { return reject(err); }
//       resolve();
//     });

//   });
// }

function resetGlobalHistograms(params){

  return new Promise(function(resolve, reject){

    if (!params.inputTypes) {
      return reject(new Error("inputTypes UNDEFINED"));
    }

    globalHistograms = {};
    statsObj.histograms = {};

    params.inputTypes.forEach(function(type){

      globalHistograms[type] = {};
      statsObj.histograms[type] = {};

    });

    resolve();

  });
}

statsObj.fsmState = "RESET";

const fetchAllReady = function(){

  statsObj.queues.processUserQueue.size = processUserQueue.length;

  if (configuration.verbose) {
    console.log(chalkLog("fetchAllReady"
      + " | loadedNetworksFlag: " + statsObj.loadedNetworksFlag
      + " | statsObj.queues.processUserQueue.busy: " + statsObj.queues.processUserQueue.busy
      + " | statsObj.queues.processUserQueue.size: " + statsObj.queues.processUserQueue.size
    ));
  }
  return (statsObj.loadedNetworksFlag && !statsObj.queues.processUserQueue.busy && (statsObj.queues.processUserQueue.size === 0) );
};

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------\n"
    + MODULE_ID_PREFIX + " | << FSM >> MAIN"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\nTFE | --------------------------------------------------------"
  ));
}

function waitEvent(params) {
  return new Promise(function(resolve){

    console.log(chalkInfo("TFE | ... WAIT EVENT: " + params.event));

    myEmitter.on(params.event, function(){
      console.log(chalkInfo("TFE | !!! WAIT EVENT FIRED: " + params.event));
      resolve();
    });

  });
}

const fsmStates = {

  "RESET": {

    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        console.log(chalkTwitter(MODULE_ID_PREFIX + " | FSM RESET"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM RESET";

        try{
          await childQuitAll();
          await childKillAll();
          await showStats(true);
        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
        }
      }

    },

    fsm_tick: function() {

      if (getChildProcesses() > 0) {

        if (!killAllInProgress) {

          killAllInProgress = true;

          childKillAll().
            then(function(){
              killAllInProgress = false;
            }).
            catch(function(err){
              killAllInProgress = false;
              console.log(chalkError(MODULE_ID_PREFIX + " | KILL ALL CHILD ERROR: " + err));
            });
        }
      }
      else {
        childCheckState({checkState: "RESET", noChildrenTrue: true}).then(function(allChildrenReset){
          console.log(chalkTwitter(MODULE_ID_PREFIX + " | ALL CHILDREN RESET: " + allChildrenReset));
          if (!killAllInProgress && allChildrenReset) { fsm.fsm_resetEnd(); }
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN RESET ERROR: " + err));
          fsm.fsm_error();
        });
      }
    },

    "fsm_resetEnd": "IDLE"
  },

  "IDLE": {
    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM IDLE";

        childCheckState({checkState: "IDLE", noChildrenTrue: true}).then(function(allChildrenIdle){
          console.log(chalkTwitter(MODULE_ID_PREFIX + " | ALL CHILDREN IDLE: " + allChildrenIdle));
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN IDLE ERROR: " + err));
          fsm.fsm_error();
        });
      }

    },

    fsm_tick: function() {

      childCheckState({checkState: "IDLE", noChildrenTrue: true}).then(function(allChildrenIdle){
        debug("INIT TICK | ALL CHILDREN IDLE: " + allChildrenIdle );
        if (allChildrenIdle) { fsm.fsm_init(); }
      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN IDLE ERROR: " + err));
        fsm.fsm_error();
      });

    },

    "fsm_init": "INIT",
    "fsm_quit": "QUIT",
    "fsm_error": "ERROR"
  },

  "INIT": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        try {
          await initNetworks();
          await childCreateAll();
          console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATED ALL CHILDREN: " + Object.keys(childHashMap).length));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** CREATE ALL CHILDREN ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },
    fsm_tick: function() {

      childCheckState({
        checkState: "READY", 
        noChildrenTrue: false, 
        exceptionStates: ["PAUSE_RATE_LIMIT", "ERROR"]
      }).then(function(allChildrenReady){

        debug("READY INIT"
          + " | ALL CHILDREN READY: " + allChildrenReady
        );

        if (allChildrenReady && !createChildrenInProgress) { fsm.fsm_ready(); }

      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY": {
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM READY";

        childCheckState({
          checkState: "READY", 
          noChildrenTrue: false, 
          exceptionStates: ["PAUSE_RATE_LIMIT", "ERROR"]
        }).then(function(allChildrenReady){
          console.log(MODULE_ID_PREFIX + " | ALL CHILDREN READY: " + allChildrenReady);
        }).
        catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
          fsm.fsm_error();
        });

      }
    },
    fsm_tick: function() {

      childCheckState({
        checkState: "READY", 
        noChildrenTrue: false, 
        exceptionStates: ["ERROR"]
      }).then(function(allChildrenReady){

        debug("READY TICK"
          + " | Q BUSY: " + statsObj.queues.processUserQueue.busy
          + " | Q SIZE: " + statsObj.queues.processUserQueue.size
          + " | ALL CHILDREN READY: " + allChildrenReady
        );
        if (!allChildrenReady) { childSendAll({op: "READY"}); }
        if (allChildrenReady && fetchAllReady()) { fsm.fsm_fetchAll(); }

      }).
      catch(function(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_fetchAll": "FETCH_ALL",
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "FETCH_ALL": {
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM FETCH_ALL";

        try{
          await initCategorizedUserHashmap();
          childSendAll({op: "FETCH_START"});
          console.log("TFE | FETCH_ALL | onEnter | " + event);
        }
        catch(err){
          console.log(chalkError("TFE | *** ALL CHILDREN FETCH_ALL ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },
    fsm_tick: function() {

      childCheckState({
        checkState: "FETCH_END", 
        noChildrenTrue: false, 
        exceptionStates: ["ERROR"]
      }).then(function(allChildrenFetchEnd){
        debug("FETCH_END TICK"
          + " | Q BUSY: " + statsObj.queues.processUserQueue.busy
          + " | Q SIZE: " + statsObj.queues.processUserQueue.size
          + " | ALL CHILDREN FETCH_END: " + allChildrenFetchEnd
        );

        statsObj.allChildrenFetchEnd = allChildrenFetchEnd;

        if (
          !statsObj.queues.randomNetworkTreeActivateQueue.busy
          && (statsObj.queues.randomNetworkTreeActivateQueue.size === 0)
          && !statsObj.queues.activateNetworkQueue.busy
          && (statsObj.queues.activateNetworkQueue.size === 0)
          && allChildrenFetchEnd 
          && !statsObj.queues.processUserQueue.busy
          && (statsObj.queues.processUserQueue.size === 0)
          ) 
        { 
          fsm.fsm_fetchAllEnd(); 
        }

      }).
      catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN FETCH_END ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_fetchAllEnd": "FETCH_END_ALL"
  },

  "FETCH_END_ALL": {

    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        statsObj.status = "END FETCH ALL";

        reporter(event, oldState, newState);

        console.log(chalk.bold.blue("TFE | ===================================================="));
        console.log(chalk.bold.blue("TFE | ================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("TFE | ===================================================="));

        console.log(chalk.bold.blue("TFE | TOTAL USERS PROCESSED: " + statsObj.users.processed));

        console.log(chalk.bold.blue("\nTFE | ----------------------------------------------------"
          + "\nTFE | BEST NETWORK: " + statsObj.bestNetwork.networkId
          + "\nTFE |  INPUTS:      " + statsObj.bestNetwork.numInputs + " | " + statsObj.bestNetwork.inputsId
          + "\nTFE |  SR:          " + statsObj.bestNetwork.successRate.toFixed(3) + "%"
          + "\nTFE |  MR:          " + statsObj.bestNetwork.matchRate.toFixed(3) + "%"
          + "\nTFE |  OAMR:        " + statsObj.bestNetwork.overallMatchRate.toFixed(3) + "%"
          + "\nTFE |  TC:          " + statsObj.bestNetwork.testCycles
          + "\nTFE |  TCH:         " + statsObj.bestNetwork.testCycleHistory.length
          + "\nTFE | TWITTER STATS\n" + jsonPrint(statsObj.twitter)
        ));

        console.log(chalk.bold.blue("TFE | ===================================================="));
        console.log(chalk.bold.blue("TFE | ================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("TFE | ===================================================="));

        if (randomNetworkTree && (randomNetworkTree !== undefined)) {
          randomNetworkTree.send({op: "GET_STATS"});
          console.log(chalkLog("TFE | PAUSING FOR RNT GET_STATS RESPONSE ..."));
          await waitEvent({ event: "allNetworksUpdated"});
        }

        let histogramsSavedFlag = false;

        console.log(chalkInfo("TFE | SAVING HISTOGRAMS | TYPES: " + Object.keys(globalHistograms)));

        async.forEach(DEFAULT_INPUT_TYPES, function(type, cb){

          if (!globalHistograms[type] || (globalHistograms[type] === undefined)){
            globalHistograms[type] = {};
          }

          const histObj = {};

          histObj.histogramsId = hostname + "_" + process.pid + "_" + getTimeStamp() + "_" + type;
          histObj.meta = {};
          histObj.meta.timeStamp = moment().valueOf();
          histObj.meta.type = type;
          histObj.meta.numEntries = Object.keys(globalHistograms[type]).length;
          histObj.histograms = {};
          histObj.histograms[type] = globalHistograms[type];

          let folder;

          if (configuration.testMode) {
            folder = (hostname === PRIMARY_HOST) 
            ? defaultHistogramsFolder + "_test/types/" + type 
            : localHistogramsFolder + "_test/types/" + type;
          }
          else {
            folder = (hostname === PRIMARY_HOST) 
            ? defaultHistogramsFolder + "/types/" + type 
            : localHistogramsFolder + "/types/" + type;
          }

          const file = "histograms_" + type + ".json";
          const sizeInMBs = sizeof(globalHistograms[type])/ONE_MEGABYTE;

          console.log(chalk.bold.blue("TFE | SAVING HISTOGRAM"
            + " | TYPE: " + type
            + " | ID: " + histObj.histogramsId
            + " | ENTRIES: " + Object.keys(histObj.histograms[type]).length
            + " | SIZE: " + sizeInMBs.toFixed(3) + " MB"
            + " | PATH: " + folder + "/" + file
          ));

          if ((sizeof(globalHistograms[type]) > MAX_SAVE_DROPBOX_NORMAL) || configuration.testMode) {

            if (configuration.testMode) {
              if (hostname === PRIMARY_HOST && hostname === "google") {
                folder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms_test/types/" + type;
              }
              else if (hostname === PRIMARY_HOST) {
                folder = DROPBOX_ROOT_FOLDER + "/config/utility/default/histograms_test/types/" + type;
              }
              else {
                folder = DROPBOX_ROOT_FOLDER + "/config/utility/" + hostname + "/histograms_test/types/" + type;
              }
            }
            else {
              if (hostname === PRIMARY_HOST && hostname === "google") {
                folder = DROPBOX_ROOT_FOLDER + "/config/utility/default/histograms/types/" + type;
              }
              else if (hostname === PRIMARY_HOST) {
                folder = DROPBOX_ROOT_FOLDER + "/config/utility/default/histograms/types/" + type;
              }
              else {
                folder = DROPBOX_ROOT_FOLDER + "/config/utility/" + hostname + "/histograms/types/" + type;
              }
            }

            saveFileQueue.push({folder: folder, file: file, obj: histObj, localFlag: true });

          }
          else {
            saveFileQueue.push({folder: folder, file: file, obj: histObj });
          }

          cb();
        }, function(){
          histogramsSavedFlag = true;
        });

        statsObj.loadedNetworksFlag = false;

        let slackText = "\n*END FETCH ALL*";
        slackText = slackText + " | " + hostname;
        slackText = slackText + "\nSTART: " + statsObj.startTime;
        slackText = slackText + " | RUN: " + statsObj.elapsed;
        slackText = slackText + "\nTOT: " + statsObj.users.processed;
        slackText = slackText + " (" + statsObj.users.percentProcessed.toFixed(2) + "%)"
        slackText = slackText + "\nIN: " + statsObj.bestNetwork.numInputs;
        slackText = slackText + " | INPUTS ID: " + statsObj.bestNetwork.inputsId;
        slackText = slackText + "\nNN: " + statsObj.bestNetwork.networkId;
        slackText = slackText + "\nOAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(3);
        slackText = slackText + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(3);
        slackText = slackText + " | SR: " + statsObj.bestNetwork.successRate.toFixed(3);
        slackText = slackText + " | TEST CYCs: " + statsObj.bestNetwork.testCycles;
        slackText = slackText + " | TC HISTORY: " + statsObj.bestNetwork.testCycleHistory.length;

        slackSendWebMessage({channel: slackChannel, text: slackText});

        clearInterval(waitFileSaveInterval);

        statsObj.status = "WAIT UPDATE STATS";

        waitFileSaveInterval = setInterval(async function() {

          if (saveFileQueue.length === 0) {

            console.log(chalk.bold.blue("TFE | ALL NNs SAVED ..."));

            if (randomNetworkTree && (randomNetworkTree !== undefined)) { 
              randomNetworkTree.send({op: "RESET_STATS"});
            }

            childSendAll({op: "RESET_TWITTER_USER_STATE"});

            try {

              clearInterval(waitFileSaveInterval);

              // await resetAllTwitterUserState();
              await resetGlobalHistograms({inputTypes: DEFAULT_INPUT_TYPES});

              statsObj.users.total = 0;
              statsObj.users.processed = 0;
              statsObj.users.percentProcessed = 0;
              statsObj.users.fetched = 0;
              statsObj.users.percentFetched = 0;
              statsObj.users.classified = 0;
              statsObj.users.classifiedAuto = 0;

              maxInputHashMap = {};

              console.log(chalk.bold.blue("TFE | BEST NN: " + statsObj.bestNetwork.networkId));

              let nnObj = bestNetworkHashMap.get(statsObj.bestNetwork.networkId);

              nnObj = networkDefaults(nnObj);

              bestNetworkHashMap.set(statsObj.bestNetwork.networkId, nnObj);

              statsObj.status = "END UPDATE STATS";

              if (configuration.quitOnComplete) {
                quit({source: "QUIT_ON_COMPLETE"});
              }
              else {
                fsm.fsm_init();
              }
            }
            catch(err){
              console.log(chalkError("TFE | *** RESET ALL TWITTER USERS: " + err));
              quit({source: "RESET ALL TWITTER USERS ERROR"});
            }

          }
          else {
            console.log(chalk.bold.blue("TFE | WAITING FOR NNs TO BE SAVED ..."
              + " | HISTOGRAMS SAVED: " + histogramsSavedFlag
              + " | SAVE Q: " + saveFileQueue.length
            ));
          }
        }, 30*ONE_SECOND);

      }
    },
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR",
    "fsm_ready": "READY"
  }
};

const fsm = Stately.machine(fsmStates);

function fsmStart(p) {

  const params = p || {};

  const interval = params.fsmTickInterval || configuration.fsmTickInterval;

  return new Promise(function(resolve){

    console.log(chalkLog(MODULE_ID_PREFIX + " | FSM START | TICK INTERVAL | " + msToTime(interval)));

    clearInterval(fsmTickInterval);

    fsmTickInterval = setInterval(function() {

      fsm.fsm_tick();

    }, interval);

    resolve();

  });
}

//=========================================================================
// CHILD PROCESS
//=========================================================================
configuration.reinitializeChildOnClose = false;

const cp = require("child_process");
const childHashMap = {};

function touchChildPidFile(params){

  return new Promise(function(resolve, reject){

    try{

      const childPidFile = params.childId + "=" + params.pid;

      const folder = params.folder || childPidFolderLocal;

      shell.mkdir("-p", folder);

      const path = folder + "/" + childPidFile;

      touch.sync(path, { force: true });

      console.log(chalkBlue(MODULE_ID_PREFIX + " | TOUCH CHILD PID FILE: " + path));
      resolve(path);
    }
    catch(err){
      return reject(err);
    }

  });
}

function getChildProcesses(){

  return new Promise(function(resolve, reject){

    const childPidArray = [];

    // DEFAULT_CHILD_ID_PREFIX_XXX=[pid] 

    shell.mkdir("-p", childPidFolderLocal);

    console.log("SHELL: cd " + childPidFolderLocal);
    shell.cd(childPidFolderLocal);

    const childPidFileNameArray = shell.ls(configuration.childIdPrefix + "*");

    async.eachSeries(childPidFileNameArray, function (childPidFileName, cb) {

      console.log("SHELL: childPidFileName: " + childPidFileName);

      // wa_node_child_dbu=46633
      const childPidStringArray = childPidFileName.split("=");

      const childId = childPidStringArray[0];
      const childPid = parseInt(childPidStringArray[1]);

      console.log("SHELL: CHILD ID: " + childId + " | PID: " + childPid);

      if (childHashMap[childId]) {
        debug("CHILD HM HIT"
          + " | ID: " + childId 
          + " | SHELL PID: " + childPid 
          + " | HM PID: " + childHashMap[childId].pid 
          + " | STATUS: " + childHashMap[childId].status
        );
      }
      else {
        console.log("CHILD HM MISS | ID: " + childId + " | PID: " + childPid + " | STATUS: UNKNOWN");
      }

      if ((childHashMap[childId] !== undefined) && (childHashMap[childId].pid === childPid)) {
        // cool kid
        childPidArray.push({ pid: childPid, childId: childId});

        console.log(chalkInfo(MODULE_ID_PREFIX + " | FOUND CHILD"
          + " [ " + childPidArray.length + " CHILDREN ]"
          + " | ID: " + childId
          + " | PID: " + childPid
          + " | FILE: " + childPidFileName
        ));

        cb();

      }
      else {

        console.log("SHELL: CHILD NOT IN HASH | ID: " + childId + " | PID: " + childPid);

        if (childHashMap[childId] === undefined) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD NOT IN HM"
            + " | " + childId
          ));
        }

        if (childHashMap[childId] && childHashMap[childId].pid === undefined) {
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD PID HM MISMATCH"
            + " | " + childId
            + " | HM PID: " + childHashMap[childId].pid
            + " | PID: " + childPid
          ));
        }

        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD ZOMBIE"
          + " | " + childId
          + " | TERMINATING ..."
          // + "\nchildHashMap[childId]" + jsonPrint(childHashMap[childId])
        ));

        kill(childPid, function(err){

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | *** KILL ZOMBIE ERROR: ", err));
            return cb(err);
          }

          shell.cd(childPidFolderLocal);
          shell.rm(childId + "*");

          delete childHashMap[childId];

          console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD ZOMBIE"
            + " [ " + childPidArray.length + " CHILDREN ]"
            + " | ID: " + childId
            + " | PID: " + childPid
          ));

          cb();

        });

      }

    }, function(err){
      if (err) {
        return reject(err);
      }

      resolve(childPidArray);

    });

  });
}

// function findChildByPid(pid, callback){

//   let foundChildId = false;

//   async.each(Object.keys(childHashMap), function(nnChildId, cb){

//     if (pid && (childHashMap[nnChildId].pid === pid)){

//       foundChildId = nnChildId;

//       cb(foundChildId);

//     }
//     else {
//       cb();
//     }

//   }, function(result){
//     callback(null, foundChildId);
//   });
// }

function childKill(params){

  return new Promise(function(resolve, reject){

    let pid;

    if ((params.pid === undefined) && childHashMap[params.childId] === undefined) {
      return reject(new Error("CHILD ID NOT FOUND: " + params.childId));
    }

    if (params.pid) {
      pid = params.pid;
    }
    else if (params.childId && childHashMap[params.childId] !== undefined) {
      pid = childHashMap[params.childId].pid;
    }


    kill(pid, function(err){

      if (err) { return reject(err); }
      resolve(params);

    });

  });
}

function childKillAll(){

  console.log("KILL ALL");

  return new Promise(async function(resolve, reject){

    try {

      const childPidArray = await getChildProcesses({searchTerm: configuration.childIdPrefix});

      console.log(chalkAlert("getChildProcesses childPidArray\n" + jsonPrint(childPidArray)));
      if (childPidArray && (childPidArray.length > 0)) {

        async.eachSeries(childPidArray, function(childObj, cb){

          childKill({pid: childObj.pid}).
          then(function(){
            console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL | KILLED | PID: " + childObj.pid + " | CH ID: " + childObj.childId));
            cb();
          }).
          catch(function(err){
            console.log(chalkError(MODULE_ID_PREFIX + " | *** KILL CHILD ERROR"
              + " | PID: " + childObj.pid
              + " | ERROR: " + err
            ));
            return cb(err);
          });

        }, function(err){

          if (err){
            return reject(err);
          }

          resolve(childPidArray);

        });
      }
      else {

        console.log(chalkBlue(MODULE_ID_PREFIX + " | KILL ALL | NO CHILDREN"));
        resolve(childPidArray);
      }
    }
    catch(err){
      reject(err);
    }


  });
}

// function maxChildren(){
//   return getNumberOfChildren() >= configuration.maxNumberChildren;
// }

// function getNumberOfChildren(){
//   return Object.keys(childHashMap).length;
// }

function childCreateAll(p){

  return new Promise(async function(resolve, reject){

    const params = p || {};
    params.config = params.config || {};

    const createParams = {};

    createParams.args = [];
    createParams.options = {};
    createParams.options.cwd = "/Volumes/RAID1/projects/twitterFollowerExplorer";
    createParams.options.env = {};
    createParams.options.env = configuration.DROPBOX;
    createParams.options.env.NODE_ENV = "production";


    createParams.verbose = params.verbose || configuration.verbose;

    createParams.appPath = params.appPath || configuration.childAppPath;

    createParams.config = {};
    createParams.config.testMode = configuration.testMode;
    createParams.config.tweetFetchCount = (configuration.testMode) ? TEST_TWEET_FETCH_COUNT : configuration.tweetFetchCount;
    createParams.config.fetchCount = (configuration.testMode) ? TEST_FETCH_COUNT : configuration.fetchCount;
    createParams.config.totalFetchCount = (configuration.testMode) ? TEST_TOTAL_FETCH : configuration.totalFetchCount;
    createParams.config.fetchUserInterval = (configuration.testMode) ? TEST_FETCH_USER_INTERVAL : configuration.fetchUserInterval;

    createParams.config.twitterConfig = {};

    createParams.config = merge(createParams.config, params.config);

    async.eachSeries(configuration.twitterUsers, async function(threeceeUser){

      try{

        const childId = configuration.childIdPrefix + "_" + threeceeUser.toLowerCase();

        createParams.childId = childId;
        createParams.config.threeceeUser = threeceeUser;
        createParams.config.twitterConfig = await initTwitterConfig({threeceeUser: threeceeUser});
        createParams.options.env.CHILD_ID = childId;
        createParams.options.env.THREECEE_USER = threeceeUser;

        if (configuration.verbose) { console.log("createParams\n" + jsonPrint(createParams)); }

        await childCreate(createParams);
        return;

      }
      catch(err){
        return err;
      }
    },

    function(err){
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR CREATE ALL CHILDREN: " + err));
        return reject(err);
      }
      resolve();
    });


  });
}

function childStatsAll(p){

  return new Promise(async function(resolve, reject){

    const params = p || {};

    const now = params.now || false;

    const defaultCommand = {};
    defaultCommand.op = "STATS";
    defaultCommand.now = now;

    const command = params.command || defaultCommand;

    try {
      await childSendAll({command: command});
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function childQuitAll(p){

  return new Promise(async function(resolve, reject){

    const params = p || {};

    const now = params.now || false;

    const defaultCommand = {};
    defaultCommand.op = "QUIT";
    defaultCommand.now = now;

    const command = params.command || defaultCommand;

    try {
      await childSendAll({command: command});
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function childSend(p){

  return new Promise(function(resolve, reject){

    const params = p || {};
    const childId = params.command.childId;
    const command = params.command;

    statsObj.status = "SEND CHILD | CH ID: " + childId + " | " + command.op;

    if (configuration.verbose) { console.log(chalkLog(MODULE_ID_PREFIX + " | " + statsObj.status)); }

    if (childHashMap[childId] === undefined || !childHashMap[childId].child || !childHashMap[childId].child.connected) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX CHILD SEND ABORTED | CHILD NOT CONNECTED OR UNDEFINED | " + childId));
    // if (childHashMap[childId] === undefined || childHashMap[childId].child === undefined) {
      return reject(new Error("CHILD NOT CONNECTED OR UNDEFINED: " + childId));
    }

    childHashMap[childId].child.send(command, function(err) {
      if (err) {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND INIT ERROR"
          + " | OP: " + command.op
          + " | ERR: " + err
        ));
        return reject(err);
      }
      resolve();
    });

  });
}

function childSendAll(p){

  return new Promise(function(resolve, reject){

    const params = p || {};
    let op = "PING";

    if (params.command) {
      op = params.command.op;
    }
    else if (params.op) {
      op = params.op;
    }

    const now = params.now || true;

    const defaultCommand = {};
    defaultCommand.op = op;
    defaultCommand.now = now;
    defaultCommand.pingId = getTimeStamp();

    const command = params.command || defaultCommand;

    try {
      Object.keys(childHashMap).forEach(async function(childId) {
        if (childHashMap[childId] !== undefined) {
          command.childId = childId;
          await childSend({command: command});
        }
      });
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

function childInit(p){

  return new Promise(async function(resolve, reject){

    const params = p || {};
    const childId = params.childId;
    const threeceeUser = params.threeceeUser;
    const config = params.config || {};
    const verbose = params.verbose || false;

    statsObj.status = "INIT CHILD | CH ID: " + childId + " | " + threeceeUser;

    const command = {
      op: "INIT",
      childId: childId,
      threeceeUser: threeceeUser,
      verbose: verbose,
      config: config
    };

    try {
      const response = await childSend({childId: childId, command: command});
      resolve(response);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND INIT ERROR"
        + " | ERR: " + err
        + "\nCOMMAND\n" + jsonPrint(command)
      ));
      return reject(err);
    }

  });
}

function childCreate(p){

  return new Promise(async function(resolve, reject){

    const params = p || {};
    const args = params.args || [];

    const childId = params.childId;
    const appPath = params.appPath;
    const env = params.env;
    const config = params.config || {};

    let child = {};
    const options = {};

    if (statsObj.user[config.threeceeUser] === undefined) {
      statsObj.user[config.threeceeUser] = {};
      statsObj.user[config.threeceeUser].friendsCount = 1;
      statsObj.user[config.threeceeUser].friendsProcessed = 0;
      statsObj.user[config.threeceeUser].percentProcessed = 0;
      statsObj.user[config.threeceeUser].friendsProcessStart = moment();
    }

    if (hostname === "google") {
      options.cwd = params.cwd || "/home/tc/twitterFollowerExplorer";
    }
    else {
      options.cwd = params.cwd || "/Volumes/RAID1/projects/twitterFollowerExplorer";
    }

    statsObj.status = "CHILD CREATE | CH ID: " + childId + " | APP: " + appPath;

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CREATE CHILD | " + childId));

    try {

      if (env) {
        options.env = env;
      }
      else {
        options.env = {};
        options.env = configuration.DROPBOX;
        options.env.DROPBOX_STATS_FILE = statsObj.runId + "_" + childId + ".json";
        options.env.CHILD_ID = childId;
        options.env.NODE_ENV = "production";
      }

      childHashMap[childId] = {};
      childHashMap[childId].status = "NEW";
      childHashMap[childId].messageQueue = [];

      console.log("CHILD FORK: appPath: " + appPath);
      console.log("CHILD FORK: args: " + args);
      console.log("CHILD FORK: options\n" + jsonPrint(options));

      child = cp.fork(appPath, args, options);

      childHashMap[childId].pid = child.pid;

      child.on("message", async function(m){
        switch(m.op) {

          case "QUIT":

            console.log(chalkError("TFE | *** CHILD QUIT | " + m.threeceeUser + " | CAUSE: " + m.cause));

            if (childHashMap[childId]) { 
              childHashMap[childId].status = "QUIT"; 

              if (m.error) { 
                childHashMap[childId].error = m.error;
                console.log(chalkError("TFE | *** CHILD ERROR\n" + jsonPrint(m.error))); 
              }
            }
          break;

          case "EXIT":

            console.log(chalkError("TFE | *** CHILD EXIT | " + m.threeceeUser + " | CAUSE: " + m.cause));

            childHashMap[childId].status = "EXIT";

            if (m.error) { 
              childHashMap[childId].error = m.error;
              console.log(chalkError("TFE | *** CHILD ERROR\n" + jsonPrint(m.error))); 
            }
          break;

          case "ERROR":

            if (m.type === "USER_NOT_AUTHORIZED") {
              console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | USER NOT AUTHORIZED " + m.userId));
              categorizedUserHashmap.delete(m.userId);
              break;
            }

            if (m.type === "USER_BLOCKED") {
              console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | USER BLOCKED " + m.userId));
              categorizedUserHashmap.delete(m.userId);
              break;
            }

            if (m.type === "USER_NOT_FOUND") {
              console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | USER NOT FOUND " + m.userId));
              categorizedUserHashmap.delete(m.userId);
              break;
            }

            console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | TYPE: " + m.type));
            childHashMap[childId].status = "ERROR";

            if (m.error) { 
              childHashMap[childId].error = m.error;
              console.log(chalkError("TFE | *** CHILD ERROR\n" + jsonPrint(m.error))); 
            }

            if (m.type === "INVALID_TOKEN") {
              childHashMap[childId].status = "DISABLED";
            }

            await childInit({childId: childId, threeceeUser: m.threeceeUser, config: childHashMap[childId].config});
          break;

          case "INIT":
          case "INIT_COMPLETE":
          case "IDLE":
          case "RESET":
          case "READY":
          case "FETCH_START":
          case "FETCH":
          case "FETCH_END":
            console.log(chalkTwitter("TFE | CHILD | OP: " + m.op + " | 3C @" + m.threeceeUser));
            childHashMap[childId].status = m.op;
          break;

          case "PAUSE_RATE_LIMIT":
            console.log(chalkTwitter("TFE | CHILD PAUSE_RATE_LIMIT"
              + " | " + m.threeceeUser 
              + " | REMAIN raw: " + m.remainingTime
              + " | REMAIN: " + msToTime(parseInt(m.remainingTime))
            ));
            childHashMap[childId].status = "PAUSE_RATE_LIMIT";
            // childHashMap[childId].twitterRateLimitRemaining = m.remainingTime;
            // childHashMap[childId].twitterRateLimitResetAt = m.resetAt;
          break;

          case "THREECEE_USER":

            console.log(chalkTwitter("TFE | THREECEE_USER"
              + " | @" + m.threeceeUser.screenName
              + " | Ts: " + m.threeceeUser.statusesCount
              + " | FRNDs: " + m.threeceeUser.friendsCount
              + " | FLWRs: " + m.threeceeUser.followersCount
            ));

            if (statsObj.user[m.threeceeUser.screenName] === undefined) { 
              statsObj.user[m.threeceeUser.screenName] = {};
              statsObj.user[m.threeceeUser.screenName].friendsProcessStart = moment();
            }

            statsObj.user[m.threeceeUser.screenName].statusesCount = m.threeceeUser.statusesCount;
            statsObj.user[m.threeceeUser.screenName].friendsCount = m.threeceeUser.friendsCount;
            statsObj.user[m.threeceeUser.screenName].followersCount = m.threeceeUser.followersCount;

            statsObj.users.total = 0;

            Object.keys(statsObj.user).forEach(function(tcUser) {

              if ((statsObj.user[tcUser] !== undefined) 
                && (statsObj.user[tcUser].friendsCount !== undefined)
                && (childHashMap[m.childId].status !== "DISABLED")
                && (childHashMap[m.childId].status !== "ERROR")
                && (childHashMap[m.childId].status !== "RESET")
              ) { 
                statsObj.users.total += statsObj.user[tcUser].friendsCount;
              }

            });
          break;

          case "FRIENDS_IDS":
            if (twitterUserHashMap[m.threeceeUser] === undefined) { twitterUserHashMap[m.threeceeUser] = {}; }
            twitterUserHashMap[m.threeceeUser].friends = new Set(m.friendsIds);
            console.log(chalkTwitter("TFE | FRIENDS_IDS"
              + " | 3C: @" + m.threeceeUser
              + " | " + twitterUserHashMap[m.threeceeUser].friends.size + " FRIENDS"
            ));
          break;

          case "USER_TWEETS":

            if (categorizedUserHashmap.has(m.userId)){

              processUserQueue.push(m);
              statsObj.queues.processUserQueue.size = processUserQueue.length;

              if (configuration.verbose){
                console.log(chalkTwitter("TFE | USER_TWEETS"
                  + " [ PUQ: " + statsObj.queues.processUserQueue.size + "]"
                  + " | UID: " + m.userId
                  + " | LTs: " + m.latestTweets.length
                ));
              }
            }

          break;

          case "FRIEND_RAW":

            processUserQueue.push(m);

            statsObj.queues.processUserQueue.size = processUserQueue.length;

            if (configuration.verbose || saveRawFriendFlag) {
              console.log(chalkInfo("TFE | TEST DATA: FRIEND_RAW"
                + " [ PUQ: " + processUserQueue.length + " ]"
                + " | 3C @" + m.threeceeUser
                + " | @" + m.friend.screen_name
                + " | FLWRs: " + m.friend.followers_count
                + " | FRNDs: " + m.friend.friends_count
                + " | Ts: " + m.friend.statuses_count
                + " | LATESTs: " + m.friend.latestTweets.length
              ));

              if (saveRawFriendFlag){
                const file = "user_" + m.friend.id_str + ".json";
                console.log(chalkLog("TFE | SAVE FRIEND_RAW FILE"
                  + " | " + testDataUserFolder + "/" + file
                ));
                debug(chalkAlert("TFE | SAVE FRIEND_RAW FILE"
                  + " | " + testDataUserFolder + "/" + file
                  + "\n" + jsonPrint(m.friend)
                ));
                statsObj.rawFriend = m.friend;
                saveFileQueue.push({folder: testDataUserFolder, file: file, obj: m.friend });
                saveRawFriendFlag = false;
              }
            }

            if (m.follow) {
              try { 
                slackSendWebMessage("FOLLOW | @" + m.threeceeUser + " | " + m.userId + " | @" + m.screenName);
              }
              catch(err){
                console.log(chalkError("TFE | *** SLACK FOLLOW MESSAGE ERROR: " + err));
              }
            }
          break;

          case "UNFOLLOWED":

            console.log(chalkLog("TFE | CHILD UNFOLLOWED"
              + " | " + m.threeceeUser
              + " | UID: " + m.user.id_str
              + " | @" + m.user.screen_name
              + " | FLWRs: " + m.user.followers_count
              + " | FRNDs: " + m.user.friends_count
              + " | Ts: " + m.user.statuses_count
            ));
          break;

          case "STATS":

            m.statsObj.startTimeMoment = getTimeStamp(m.statsObj.startTimeMoment);

            childHashMap[childId].status = m.statsObj.fsmState;
            childHashMap[childId].statsObj = m.statsObj;

            if (configuration.verbose) {
              console.log(chalkLog("TFE | CHILD STATS"
                + " | " + m.threeceeUser
                + " | " + getTimeStamp() + " ___________________________\n"
                + jsonPrint(m.statsObj, "TFC | STATS ")
                + "\nTFC | CHILD STATS___________________________"
              ));
            }
          break;

          default:
            console.log(chalkError("TFE | CHILD " + m.threeceeUser + " | UNKNOWN OP: " + m.op));
            quit("UNKNOWN OP" + m.op);
        }
      });

      childHashMap[childId].child = child;
      childHashMap[childId].config = {};
      childHashMap[childId].config = config;

      const initResponse = await childInit({ childId: childId, threeceeUser: config.threeceeUser, config: config });

      const childPidFile = await touchChildPidFile({ childId: childId, pid: child.pid });

      childHashMap[childId].childPidFile = childPidFile;

      child.on("close", function(){
        console.log(chalkAlert(MODULE_ID_PREFIX + " | CHILD CLOSED | " + childId));
        shell.cd(childPidFolderLocal);
        shell.rm(childPidFile);
        delete childHashMap[childId];
      });

      child.on("exit", function(code, signal){
        console.log(chalkAlert(MODULE_ID_PREFIX 
          + " | CHILD EXITED | " + childId 
          + " | CODE: " + code 
          + " | SIGNAL: " + signal
        ));
        shell.cd(childPidFolderLocal);
        shell.rm(childPidFile);
        delete childHashMap[childId];
      });

      if (quitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX
          + " | KILL CHILD IN CREATE ON QUIT FLAG"
          + " | " + getTimeStamp()
          + " | " + childId
        ));
        child.kill();
      }

      resolve(initResponse);
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD INIT ERROR"
        + " | ERR: " + err
        + "\nCONFIG\n" + jsonPrint(config)
        + "\nENV\n" + jsonPrint(options.env)
      ));
      return reject(err);
    }

  });
}

// function childDisable(p){

//   return new Promise(async function(resolve, reject){

//     const params = p || {};

//     const childId = params.childId;
//     const config = params.config || {};
//     const verbose = params.verbose || false;

//     statsObj.status = "CHILD DISABLE | CH ID: " + childId;

//     const command = {
//       op: "DISABLE",
//       verbose: verbose,
//       config: config
//     };

//     try {
//       const response = await childSend({childId: childId, command: command});
//       resolve(response);
//     }
//     catch(err){
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND DISABLE ERROR"
//         + " | ERR: " + err
//         + "\nCOMMAND\n" + jsonPrint(command)
//       ));
//       return reject(err);
//     }

//   });
// }

// function childPing(p){

//   return new Promise(async function(resolve, reject){

//     const params = p || {};

//     const childId = params.childId;
//     const config = params.config || {};
//     const verbose = params.verbose || false;

//     statsObj.status = "CHILD PING | CH ID: " + childId;


//     const command = {
//       op: "PING",
//       verbose: verbose,
//       pingId: getTimeStamp(),
//       config: config
//     };

//     try {
//       const response = await childSend({childId: childId, command: command});
//       resolve(response);
//     }
//     catch(err){
//       console.log(chalkError(MODULE_ID_PREFIX + " | *** CHILD SEND " + op + " ERROR"
//         + " | ERR: " + err
//         + "\nCOMMAND\n" + jsonPrint(command)
//       ));
//       return reject(err);
//     }

//   });
// }

function childCheckState (params) {

  const checkState = params.checkState;
  const noChildrenTrue = params.noChildrenTrue || false;
  const exceptionStates = params.exceptionStates || [];

  return new Promise(function(resolve, reject){

    if (Object.keys(childHashMap).length === 0) {
      resolve(noChildrenTrue);
    }

    let allCheckState = true;

    Object.keys(childHashMap).forEach(function(childId){

      const child = childHashMap[childId];

      if (child === undefined) { 
        console.error("CHILD UNDEFINED");
        return reject(new Error("CHILD UNDEFINED"));
      }

      if ((child === RNT_CHILD_ID) || (child === LAC_CHILD_ID)) { 
        return;
      }

      const cs = ((child.status === "DISABLED") || (child.status === checkState) || exceptionStates.includes(child.status));

      if (!cs) {
        allCheckState = false;
      } 

      if (configuration.verbose) {
        console.log("childCheckState"
          + " | CH ID: " + childId 
          + " | " + child.status 
          + " | CHCK STATE: " + checkState 
          + " | cs: " + cs
          + " | allCheckState: " + allCheckState
        );
      }

    });

    if (configuration.verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | MAIN: " + fsm.getMachineState()
        + " | ALL CHILDREN CHECKSTATE: " + checkState + " | " + allCheckState
      ));
    }

    resolve(allCheckState);

  });
}

// function childPingAll(params){

//   return new Promise(async function(resolve, reject){

//     params = params || {};

//     const now = params.now || false;

//     const defaultCommand = {};
//     defaultCommand.op = "PING";
//     defaultCommand.now = now;
//     defaultCommand.pingId = getTimeStamp();

//     const command = params.command || defaultCommand;

//     try {
//       await childSendAll({command: command});
//       resolve();
//     }
//     catch(err){
//       reject(err);
//     }

//   });
// }

// function initChildPingAllInterval(params){

//   return new Promise(function(resolve, reject){

//     const interval = (params) ? params.interval : configuration.childPingAllInterval;
//     statsObj.status = "INIT CHILD PING ALL INTERVAL";

//     clearInterval(childPingAllInterval);

//     childPingAllInterval = setInterval(async function(){

//       try{
//         await childPingAll();
//       }
//       catch(err){
//         console.log(chalkAlert(MODULE_ID_PREFIX + " | *** CHILD PING ALL ERROR: " + err));
//       }

//     }, interval);

//     intervalsSet.add("childPingAllInterval");

//     resolve();

//   });
// }

console.log(MODULE_ID_PREFIX + " | =================================");
console.log(MODULE_ID_PREFIX + " | HOST:          " + hostname);
console.log(MODULE_ID_PREFIX + " | PROCESS TITLE: " + process.title);
console.log(MODULE_ID_PREFIX + " | PROCESS ID:    " + process.pid);
console.log(MODULE_ID_PREFIX + " | RUN ID:        " + statsObj.runId);
console.log(MODULE_ID_PREFIX + " | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log(MODULE_ID_PREFIX + " | =================================");

console.log(chalkBlueBold(
    "\n=======================================================================\n"
  + MODULE_ID_PREFIX + " | " + MODULE_ID + " STARTED | " + getTimeStamp()
  + "\n=======================================================================\n"
));

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

    console.log(chalkBlueBold(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\nCONFIGURATION\n" + jsonPrint(configuration)
      + "--------------------------------------------------------"
    ));

    try {

      await connectDb();

      try {
        // await initCategorizedUserHashmap();
        initProcessUserQueueInterval(PROCESS_USER_QUEUE_INTERVAL);
        initUserDbUpdateQueueInterval(USER_DB_UPDATE_QUEUE_INTERVAL);
        initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);
        // initLangAnalyzerMessageRxQueueInterval(LANG_ANAL_MSG_Q_INTERVAL);

        // initLangAnalyzer();
        await initUnfollowableUserSet();
        await initActivateNetworkQueueInterval(ACTIVATE_NETWORK_QUEUE_INTERVAL);
        initRandomNetworkTreeChild();
        neuralNetworkInitialized = true;

        await fsmStart();

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** FSM START ERROR: " + err + " | QUITTING ***"));
        quit({cause: "FSM START ERROR"});
      }

    }
    catch(err){
      // dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MONGO DB CONNECT ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);


