const MODULE_NAME = "twitterFollowerExplorer";
const MODULE_ID_PREFIX = "TFE";
const CHILD_PREFIX = "tfe_node";

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_FORCE_LANG_ANALYSIS = false;
const DEFAULT_ENABLE_LANG_ANALYSIS = true;

const DEFAULT_FORCE_IMAGE_ANALYSIS = false;
const DEFAULT_ENABLE_IMAGE_ANALYSIS = true;

const DEFAULT_MAX_USER_TWEETIDS = 500;
const DEFAULT_MIN_HISTOGRAM_ITEM_TOTAL = 10;
const DEFAULT_FRIENDS_HISTOGRAM_ITEM_TOTAL = 250;
const DEFAULT_IMAGE_PARSE_RATE_LIMIT_TIMEOUT = ONE_MINUTE;

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

const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

const { print, stringify } = require("q-i");

let DROPBOX_ROOT_FOLDER;

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

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

const DEFAULT_MIN_INTERVAL = 2;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const MAX_SAVE_DROPBOX_NORMAL = 20 * ONE_MEGABYTE;

const TEST_MODE = false; // applies only to parent

const TEST_FETCH_USER_INTERVAL = 15 * ONE_SECOND;
const TEST_MODE_FETCH_ALL_INTERVAL = 2*ONE_MINUTE;

const FETCH_COUNT = 200;

const TEST_TWEET_FETCH_COUNT = 11;

const TEST_MODE_NUM_NN = 10;
const TEST_FETCH_COUNT = 51;
const TEST_TOTAL_FETCH = 147;

const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = true;

const DEFAULT_INIT_MAIN_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;
const FSM_TICK_INTERVAL = ONE_SECOND;
const STATS_UPDATE_INTERVAL = ONE_MINUTE;
const DEFAULT_CHILD_PING_INTERVAL = ONE_MINUTE;

const PROCESS_USER_QUEUE_INTERVAL = 5;
const ACTIVATE_NETWORK_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const USER_DB_UPDATE_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const FETCH_USER_INTERVAL = 5 * ONE_MINUTE;
const DEFAULT_NUM_NN = 50; // TOP 100 NN's are loaded from DB

const RANDOM_NETWORK_TREE_INTERVAL = DEFAULT_MIN_INTERVAL;
const RANDOM_NETWORK_TREE_MSG_Q_INTERVAL = 5; // ms

let waitFileSaveInterval;
let randomNetworkTreeMessageRxQueueInterval;

const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 69;
const DEFAULT_LOCAL_MIN_SUCCESS_RATE = 60;
const DEFAULT_LOCAL_PURGE_MIN_SUCCESS_RATE = 65;


const SAVE_CACHE_DEFAULT_TTL = 60;
const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;

const USER_PROFILE_PROPERTY_ARRAY = [
  "bannerImageUrl",
  "description",
  "location",
  "name",
  "profileUrl",
  "profileImageUrl",
  "screenName",
  "url"
];

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

const inputsIdSet = new Set();
const bestInputsSet = new Set();
const skipLoadNetworkSet = new Set();
const userErrorSet = new Set();

let globalHistograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  globalHistograms[type] = {};
});

const unfollowableUserFile = "unfollowableUser.json";
let unfollowableUserSet = new Set();

const DROPBOX_LIST_FOLDER_LIMIT = 50;

let configuration = {};
configuration.verbose = false;
configuration.languageQuotaTimoutDuration = ONE_MINUTE;
configuration.enableLanguageAnalysis = DEFAULT_ENABLE_LANG_ANALYSIS;
configuration.forceLanguageAnalysis = DEFAULT_FORCE_LANG_ANALYSIS;
configuration.enableImageAnalysis = DEFAULT_ENABLE_IMAGE_ANALYSIS;
configuration.forceImageAnalysis = DEFAULT_FORCE_IMAGE_ANALYSIS;
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

const Language = require("@google-cloud/language");
const languageClient = new Language.LanguageServiceClient();

const path = require("path");
const watch = require("watch");
const randomInt = require("random-int");
const fetch = require("isomorphic-fetch"); // or another library of choice.
const urlParse = require("url-parse");
const moment = require("moment");
const HashMap = require("hashmap").HashMap;
const pick = require("object.pick");
const shell = require("shelljs");
const touch = require("touch");
const kill = require("tree-kill");
const _ = require("lodash");
const treeify = require("treeify");
const objectPath = require("object-path");
const NodeCache = require("node-cache");
const merge = require("deepmerge");
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
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const bestNetworkHashMap = new HashMap();
let maxInputHashMap = {};
let normalization = {};

const categorizedUserIdSet = new Set();

const processUserQueue = [];
let processUserQueueInterval;

let randomNetworkTree;
let randomNetworkTreeMessageRxQueueReadyFlag = true;
let randomNetworkTreeReadyFlag = false;
const randomNetworkTreeMessageRxQueue = [];


const activateNetworkQueue = [];
let activateNetworkQueueInterval;

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
statsObj.remainingTimeMs = 0;
statsObj.status = "START";
statsObj.timeStamp = getTimeStamp();
statsObj.remainingTimeMs = 0;

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

statsObj.imageParser = {};
statsObj.imageParser.rateLimitFlag = false;

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
statsObj.languageQuotaFlag = false;

statsObj.queues = {};
statsObj.queues.randomNetworkTreeActivateQueue = {};
statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
statsObj.queues.randomNetworkTreeActivateQueue.size = 0;

statsObj.queues.langAnalyzerQueue = {};
statsObj.queues.langAnalyzerQueue.busy = false;
statsObj.queues.langAnalyzerQueue.size = false;

statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;

statsObj.queues.activateNetworkQueue = {};
statsObj.queues.activateNetworkQueue.busy = false;
statsObj.queues.activateNetworkQueue.size = 0;

statsObj.queues.processUserQueue = {};
statsObj.queues.processUserQueue.busy = false;
statsObj.queues.processUserQueue.size = 0;

statsObj.queues.userDbUpdateQueue = {};
statsObj.queues.userDbUpdateQueue.busy = false;
statsObj.queues.userDbUpdateQueue.size = 0;

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
statsObj.users.fetchErrors = 0;
statsObj.users.processed = 0;
statsObj.users.totalUsersSkipped = 0;
statsObj.users.percentFetched = 0;
statsObj.users.percentProcessed = 0;
statsObj.users.processRateMS = 0;
statsObj.users.processRateSec = 0;
statsObj.users.mumProcessed = 0;
statsObj.users.numProcessRemaining = 0;

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
// MISC FUNCTIONS (own module?)
//=========================================================================
function jsonPrint(obj) {
  if (obj) {
    // return stringify(obj, { maxItems: Infinity });
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
          // await slackSendWebMessage(hostname + " | TFE | PONG");
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
configuration.imageParserRateTimitTimeout = DEFAULT_IMAGE_PARSE_RATE_LIMIT_TIMEOUT;
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

let imageParserRateTimitTimeout;

function startImageParserRateTimitTimeout(p) {

  const params = p || {};
  const period = params.period || configuration.imageParserRateTimitTimeout;
  const verbose = params.verbose || true;

  clearTimeout(imageParserRateTimitTimeout);

  if (verbose) {
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RATE LIMIT TIMEOUT START | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
  }

  imageParserRateTimitTimeout = setTimeout(function(){
    if (verbose) {
      console.log(chalkLog(MODULE_ID_PREFIX + " | XXX RATE LIMIT TIMEOUT END | NOW: " + getTimeStamp() + " | PERIOD: " + msToTime(period)));
      statsObj.imageParser.rateLimitFlag = false;
    }
  }, period);

}

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
    + " | RANK: " + networkObj.rank
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
      rank: networkObj.rank
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
      returnOriginal: false,
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

function initCategorizedUserIdSet(){

  return new Promise(function(resolve, reject){

    statsObj.status = "INIT CATEGORIZED USER ID SET";

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
    p.toObject = true;

    p.projection = "bannerImageAnalyzed bannerImageUrl category categoryAuto description expandedUrl followersCount following friends friendsCount ignored lang location mentions name nodeId previousBannerImageUrl previousDescription previousExpandedUrl previousLocation previousName previousProfileImageUrl previousProfileUrl previousScreenName previousStatusId previousUrl profileHistograms profileImageAnalyzed profileImageUrl screenName statusesCount statusId threeceeFollowing tweetHistograms tweets url userId";

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
    childParams.command.userArray = [];
    childParams.command.fetchUserTweetsEndFlag = false;

    async.whilst(

      function test(cbTest) { cbTest(null, more); },

      function(cb){

        userServerController.findCategorizedUsersCursor(p, function(err, results){

          if (err) {
            console.log(chalkError(MODULE_ID_PREFIX + " | ERROR: initCategorizedUserIdSet: " + err));
            cb(err);
          }
          else if (
            (!configuration.testMode && results) 
            || (configuration.testMode && (statsObj.users.categorized.total < TEST_TOTAL_FETCH))
            ) 
          {

            more = true;
            statsObj.users.categorized.total += results.count;
            statsObj.users.categorized.manual += results.manual;
            statsObj.users.categorized.auto += results.auto;
            statsObj.users.categorized.matched += results.matched;
            statsObj.users.categorized.mismatched += results.mismatched;

            statsObj.users.categorized.matchRate = 100*(statsObj.users.categorized.matched/statsObj.users.categorized.total);

            childParams.command.userArray = [];

            Object.keys(results.obj).forEach(function(nodeId){
              categorizedUserIdSet.add(nodeId);
              childParams.command.userArray.push(results.obj[nodeId]);
            });

            childSend(childParams).
            then(function(){
              if (configuration.verbose || (statsObj.users.categorized.total % 1000 === 0)) {

                console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
                  + " | UIDs: " + childParams.command.userArray.length
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

        childParams.command.fetchUserTweetsEndFlag = true;
        childParams.command.userArray = [];
        
        childSend(childParams).
        then(function(){
          resolve();
        })
        .catch(function(err){
          reject(err);
        })
      }
    );

  });
}

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
          quit({cause: "MONGO DB ERROR: " + err});
          return reject(err);
        }

        db.on("close", async function(){
          statsObj.status = "MONGO CLOSED";
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED"));
        });

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
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
// STATS
//=========================================================================

function showStats(options) {

  return new Promise(async function(resolve, reject){

    statsObj.elapsed = getElapsedTimeStamp();
    statsObj.timeStamp = getTimeStamp();
    statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
    statsObj.users.mumProcessed = statsObj.users.processed + statsObj.users.fetchErrors;
    statsObj.users.numProcessRemaining = statsObj.users.categorized.total-statsObj.users.mumProcessed;

    statsObj.users.processRateMS = statsObj.elapsedMS/statsObj.users.mumProcessed; // ms/userProcessed
    statsObj.users.processRateSec = statsObj.users.processRateMS/1000;

    statsObj.remainingTimeMs = statsObj.users.processRateMS * statsObj.users.numProcessRemaining;

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
        + " | NOW: " + statsObj.timeStamp
        + " | ELAPSED: " + statsObj.elapsed
        + " || FSM: " + fsm.getMachineState()
        + " || BEST NN: " + statsObj.bestNetwork.networkId
        + " | SR: " + statsObj.bestNetwork.successRate.toFixed(2)
        + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(2)
        + " | OAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(2)
      ));

      console.log(chalkBlue(MODULE_ID_PREFIX + " | STATUS"
        + " | PUQ: " + processUserQueue.length 
        + " | PRCSSD/ERROR/REM/TOT: " + statsObj.users.processed 
        + "/" + statsObj.users.fetchErrors 
        + "/" + statsObj.users.numProcessRemaining 
        + "/" + statsObj.users.categorized.total 
        + " (" + statsObj.users.percentProcessed.toFixed(2) + "%)"
        + " | ETC (" + statsObj.users.processRateSec.toFixed(3) + " SPU): " + msToTime(statsObj.remainingTimeMs) 
        + " / " + moment().add(statsObj.remainingTimeMs).
format(compactDateTimeFormat)
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

const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const childPidFolderLocal = DROPBOX_ROOT_FOLDER + "/config/utility/" + hostname + "/children";

const statsFolder = "/stats/" + hostname;
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";

const globalBestNetworkFolder = "/config/utility/best/neuralNetworks";
const globalBestNetworkArchiveFolder = globalBestNetworkFolder + "/archive";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
const bestNetworkFolder = (hostname === PRIMARY_HOST) ? "/config/utility/best/neuralNetworks" : localBestNetworkFolder;

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
      // debug(chalkInfo("FILE META\n", response));
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

        async.whilst(

          function test(cbTest) { cbTest(null, more); },

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

      if (loadedConfigObj.TFE_IMAGE_PARSE_RATE_LIMIT_TIMEOUT !== undefined) {
        console.log("TFE | LOADED TFE_IMAGE_PARSE_RATE_LIMIT_TIMEOUT: " + loadedConfigObj.TFE_IMAGE_PARSE_RATE_LIMIT_TIMEOUT);
        newConfiguration.imageParserRateTimitTimeout = loadedConfigObj.TFE_IMAGE_PARSE_RATE_LIMIT_TIMEOUT;
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
        console.log(chalkAlert(MODULE_ID_PREFIX + " | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
      }
      
      const hostConfig = await loadConfigFile({folder: dropboxConfigHostFolder, file: dropboxConfigHostFile});

      if (hostConfig) {
        hostConfiguration = hostConfig;
        console.log(chalkAlert(MODULE_ID_PREFIX + " | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
      }

      await loadInputsDropbox({folder: dropboxConfigDefaultFolder, file: defaultInputsConfigFile});
      await loadInputsDropbox({folder: dropboxConfigHostFolder, file: hostInputsConfigFile});
      
      const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
      const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

      configuration = deepcopy(tempConfig);

      configuration.twitterUsers = _.uniq(configuration.twitterUsers);

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

    showStats().
    then(function(){
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
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = { name: "quitOnError", alias: "Q", type: Boolean, defaultValue: true };
const verbose = { name: "verbose", alias: "V", type: Boolean };
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

  randomNetworkTree.send({ op: "VERBOSE", verbose: configuration.verbose});

  const command = {};
  command.op = "VERBOSE";
  command.verbose = configuration.verbose;

  childSendAll({command: command}).
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
        // + " | RESPONSE\n", response
      ));
      debug("dropboxClient filesMoveV2 response\n", response);
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
        ));
        console.log(err);
      }
      return reject(err);
    });

  });
}

function isBestNetwork(p){

  const params = (p !== undefined) ? p : {};

  const minOverallMatchRate = (params.minOverallMatchRate !== undefined) ? params.minOverallMatchRate : configuration.globalMinSuccessRate;
  const minTestCycles = (params.minTestCycles !== undefined) ? params.minTestCycles : configuration.minTestCycles;

  if (params.networkObj.testCycles < minTestCycles){
    debug("minTestCycles: " + params.networkObj.testCycles);
    return true;
  }
  else if (params.networkObj.overallMatchRate && (params.networkObj.overallMatchRate >= minOverallMatchRate)) {
    debug("overallMatchRate: " + params.networkObj.overallMatchRate.toFixed(2));
    return true;
  }
  // else if (params.networkObj.successRate < 100) && (params.networkObj.successRate >= minOverallMatchRate) {
  //   debug("successRate: " + params.networkObj.successRate);
  //   return true;
  // }
  else {
    return false;
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
        { overallMatchRate: { "$gte": configuration.globalMinSuccessRate } },
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

      nnArrayTopOverallMatchRate = await global.globalNeuralNetwork.find(query)
      .lean()
      .sort({"overallMatchRate": -1})
      .limit(limit)
      .exec();

      console.log(chalkBlue("TFE | FOUND " + nnArrayTopOverallMatchRate.length + " BEST NNs (by OAMR) FROM DB ..."));

      console.log(chalkBlue("TFE | LOADING " + randomUntestedLimit + " UNTESTED NNs FROM DB ..."));

      nnArrayRandomUntested = await global.globalNeuralNetwork.find(randomUntestedQuery)
      .lean()
      .sort({"overallMatchRate": -1})
      .limit(randomUntestedLimit)
      .exec();

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
      await loadBestNetworksDatabase();
      resolve();
    }
    catch(err){
      console.log(chalkError("TFE | *** LOAD BEST NETWORKS ERROR: " + err));
      return reject(err);
    }

  });
}

function loadMaxInputDropbox(params) {

  statsObj.status = "LOAD MAX INPUT + NORMALIZATION";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkNetwork("TFE | LOADING DROPBOX MAX INPUT HASHMAP + NORMALIZATION | " + folder + "/" + file));

    try {

      const maxInputHashMapObj = await loadFile({folder: folder, file: file});

      if ((maxInputHashMapObj === undefined) || !maxInputHashMapObj) {
        console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED"));
      }

      maxInputHashMap = {};
      maxInputHashMap = deepcopy(maxInputHashMapObj.maxInputHashMap);

      normalization = {};
      normalization = deepcopy(maxInputHashMapObj.normalization);

      console.log(chalkBlue("TFE | MAX INPUT HASHMAP"
        + " | KEYS (INPUT TYPES)\n" + jsonPrint(Object.keys(maxInputHashMap))
      ));

      console.log(chalkBlue("TFE | NORMALIZATION"
        + "\n" + jsonPrint(normalization)
      ));

      resolve();
    }
    catch(err){
      console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR: " + err));
      return reject(err);
    }

  });
}

const watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
}

function initWatchConfig(params){

  statsObj.status = "INIT WATCH CONFIG";

  return new Promise(async function(resolve){

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT WATCH\n" + jsonPrint(params)));

    const loadConfig = async function(f){

      try{

        console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f));

        if (f.endsWith("twitterFollowerExplorerConfig.json")){

          await loadAllConfigFiles();

          const configArgs = Object.keys(configuration);

          configArgs.forEach(function(arg){
            if (_.isObject(configuration[arg])) {
              console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
            }
            else {
              console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
            }
          });
        }

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD ALL CONFIGS ON CREATE ERROR: " + err));
      }
    }

    watch.createMonitor(path.join(DROPBOX_ROOT_FOLDER, dropboxConfigDefaultFolder), watchOptions, function (monitor) {

      monitor.on("created", loadConfig);

      monitor.on("changed", loadConfig);

      monitor.on("removed", function (f) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
      });
    });

    watch.createMonitor(path.join(DROPBOX_ROOT_FOLDER, dropboxConfigHostFolder), watchOptions, function (monitor) {

      monitor.on("created", loadConfig);

      monitor.on("changed", loadConfig);

      monitor.on("removed", function (f) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
      });
    });

    resolve();

  });
}


function generateObjFromArray(params){

  return new Promise(async function(resolve, reject){

    const keys = params.keys || [];
    const value = params.value || 0;
    const result = {};

    async.each(keys, function(key, cb){
      result[key.toString()] = value;
      cb();
    }, function(err){
      if (err) {
        return reject(err);
      }
      resolve(result);
    });

  });
}

function pruneGlobalHistograms(p) {

  return new Promise(async function(resolve, reject){

    const params = p || {};

    statsObj.status = "PRUNE GLOBAL HISTOGRAMS";

    let inputTypeMin = params.defaultInputTypeMin || DEFAULT_MIN_HISTOGRAM_ITEM_TOTAL;

    async.eachSeries(DEFAULT_INPUT_TYPES, function(inputType, cb0) {

      if (!globalHistograms[inputType] || (globalHistograms[inputType] === undefined)){
        return cb0();
      }

      const initialNumberOfItems = Object.keys(globalHistograms[inputType]).length;

      let prunedItems = 0;

      switch (inputType) {
        case "friends":
          inputTypeMin = DEFAULT_FRIENDS_HISTOGRAM_ITEM_TOTAL;
        break;
        default:
          inputTypeMin = DEFAULT_MIN_HISTOGRAM_ITEM_TOTAL;
      }

      async.each(Object.keys(globalHistograms[inputType]), function(item, cb1) {

        if (globalHistograms[inputType][item].total < inputTypeMin) {

          prunedItems += 1;

          if (configuration.verbose) {
            debug(chalkLog(MODULE_ID_PREFIX
              + " | HISTOGRAM ITEM LESS THAN MIN (" + inputTypeMin + ") ... DELETING"
              + " | " + inputType.toUpperCase()
              + " | TOTAL: " + globalHistograms[inputType][item].total
              + " | " + item
            ));
          }

          delete globalHistograms[inputType][item];
        }

        cb1();

      }, function(err) {

        if (err) { return reject(err); }

        const percent = 100 * prunedItems/initialNumberOfItems;

        console.log(chalkAlert(MODULE_ID_PREFIX
          + " | " + inputType.toUpperCase()
          + " | " + inputTypeMin + " MIN"
          + " | PRUNED " + prunedItems
          + "/" + initialNumberOfItems + " ITEMS (" + percent.toFixed(2) + "%)"
        ));

        cb0();

      });

    }, function(err) {

      if (err) { return reject(err); }

      resolve();

    });

  });
}

function updateGlobalHistograms(params) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "UPDATE GLOBAL HISTOGRAMS";

    let mergedHistograms = {};

    try {
      mergedHistograms = await mergeHistograms.merge({ histogramA: params.user.profileHistograms, histogramB: params.user.tweetHistograms });
      mergedHistograms.friends = await generateObjFromArray({ keys: params.user.friends, value: 1 }); // [ 1,2,3... ] => { 1:1, 2:1, 3:1, ... }
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
          globalHistograms[inputType][item].leftRatio = 0;
          globalHistograms[inputType][item].neutral = 0;
          globalHistograms[inputType][item].neutralRatio = 0;
          globalHistograms[inputType][item].right = 0;
          globalHistograms[inputType][item].rightRatio = 0;
          globalHistograms[inputType][item].positive = 0;
          globalHistograms[inputType][item].positiveRatio = 0;
          globalHistograms[inputType][item].negative = 0;
          globalHistograms[inputType][item].negativeRatio = 0;
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

        globalHistograms[inputType][item].leftRatio = globalHistograms[inputType][item].left/globalHistograms[inputType][item].total;
        globalHistograms[inputType][item].neutralRatio = globalHistograms[inputType][item].neutral/globalHistograms[inputType][item].total;
        globalHistograms[inputType][item].rightRatio = globalHistograms[inputType][item].right/globalHistograms[inputType][item].total;
        globalHistograms[inputType][item].positiveRatio = globalHistograms[inputType][item].positive/globalHistograms[inputType][item].total;
        globalHistograms[inputType][item].negativeRatio = globalHistograms[inputType][item].negative/globalHistograms[inputType][item].total;

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

    console.log(chalkGreen("TFE | INIT RANDOM NETWORKS"));

    statsObj.loadedNetworksFlag = false;

    if (randomNetworkTree && (randomNetworkTree !== undefined)) {

      let isBestNetworkFlag = false;

      async.eachSeries(bestNetworkHashMap.values(), function(networkObj, cb){

        if (networkObj.networkId === bestNetwork.networkId) {
          console.log(chalkGreen("TFE | LOAD_NETWORK BEST: " + networkObj.networkId));
          isBestNetworkFlag = true;
        }
        else {
          isBestNetworkFlag = false;
        }

        randomNetworkTree.send({ op: "LOAD_NETWORK", networkObj: networkObj, isBestNetwork: isBestNetworkFlag }, function(err) {

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

      try{
        await randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap });
        console.log(chalkBlue("TFE | SENT MAX INPUTS HASHMAP > RNT"));

        await randomNetworkTree.send({ op: "LOAD_NORMALIZATION", normalization: normalization });
        console.log(chalkBlue("TFE | SENT NORMALIZATION > RNT"));

        resolve();
      }
      catch(err){
        reject(err);
      }

      // randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap }, function(err) {
      //   if (err) { return reject(err); }
      //   console.log(chalkBlue("TFE | SENT MAX INPUTS HASHMAP > RNT"));
      //   resolve();
      // });
      
      // randomNetworkTree.send({ op: "LOAD_NORMALIZATION", normalization: normalization }, function(err) {
      //   if (err) { return reject(err); }
      //   console.log(chalkBlue("TFE | SENT NORMALIZATION > RNT"));
      //   resolve();
      // });
      
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
        networkObj.rank = params.networkStatsObj[nnId].rank;
        networkObj.matchRate = params.networkStatsObj[nnId].matchRate;
        networkObj.overallMatchRate = (updateOverallMatchRate) ? params.networkStatsObj[nnId].matchRate : params.networkStatsObj[nnId].overallMatchRate;

        const testHistoryItem = {
          testCycle: networkObj.testCycles,
          match: params.networkStatsObj[nnId].match,
          mismatch: params.networkStatsObj[nnId].mismatch,
          total: params.networkStatsObj[nnId].total,
          matchRate: params.networkStatsObj[nnId].matchRate,
          rank: params.networkStatsObj[nnId].rank,
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
      rank: params.network.rank,
      updatedAt: getTimeStamp()
    };

    const file = statsObj.bestRuntimeNetworkId + ".json";

    saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: params.network });
    saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj });

    resolve();

  });
}

function initRandomNetworkTreeMessageRxQueueInterval(interval) {

  return new Promise(function(resolve){

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
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            runEnable();
            console.log(chalkLog("TFE | RNT IDLE "));
          break;

          case "STATS":

            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;

            console.log(chalkLog("TFE | R< RNT_STATS"
              // + "\n" + jsonPrint(Object.keys(m.statsObj))
            ));

            console.log(chalkBlue("TFE | RNT | UPDATING ALL NNs STATS IN DB ..."));

            try {
              await updateNetworkStats({
                networkStatsObj: m.loadedNetworks, 
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
                  rank: currentBestNetwork.rank,
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
              statsObj.queues.randomNetworkTreeActivateQueue.busy = false;

              myEmitter.emit("allNetworksUpdated");

            }
            catch(err){
              console.log(chalkError("TFE | *** UPDATE NETWORK STATS ERROR: " + err));
              randomNetworkTreeMessageRxQueueReadyFlag = true;
            }
          break;

          case "NETWORK_READY":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            randomNetworkTreeReadyFlag = true;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            debug(chalkInfo("RNT NETWORK_READY ..."));
            runEnable();
          break;

          case "NETWORK_BUSY":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            randomNetworkTreeReadyFlag = false;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = true;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            debug(chalkInfo("RNT NETWORK_BUSY ..."));
          break;

          case "QUEUE_STATS":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
          break;

          case "QUEUE_READY":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
            randomNetworkTreeReadyFlag = true;
            debug(chalkInfo("RNT Q READY"));

            runEnable();
          break;

          case "QUEUE_EMPTY":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
            randomNetworkTreeReadyFlag = true;
            debug(chalkInfo("RNT Q EMPTY"));
            runEnable();
          break;

          case "QUEUE_FULL":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = "QUEUE_FULL";
            randomNetworkTreeReadyFlag = false;
            console.log(chalkError("TFE | *** RNT Q FULL"));
          break;

          case "RNT_TEST_PASS":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            randomNetworkTreeReadyFlag = true;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            console.log(chalkTwitter("TFE | " + getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
            runEnable();
          break;

          case "RNT_TEST_FAIL":
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            randomNetworkTreeReadyFlag = false;
            statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
            console.log(chalkAlert("TFE | " + getTimeStamp() + " | RNT_TEST_FAIL"));
            quit({source: "RNT", error: "RNT_TEST_FAIL"});
          break;

          case "NETWORK_OUTPUT":

            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;

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
              statsObj.queues.userDbUpdateQueue.length = userDbUpdateQueue.length;
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
            statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
            runEnable();
          break;

          case "BEST_MATCH_RATE":

            statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;

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
                  rank: currentBestNetwork.rank,
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

    resolve();

  });
}

function initUserDbUpdateQueueInterval(interval) {

  return new Promise(function(resolve){

    statsObj.status = "INIT USER DB UPDATE INTERVAL";

    console.log(chalkBlue("TFE | INIT USER DB UPDATE QUEUE INTERVAL: " + interval + " MS"));

    clearInterval(userDbUpdateQueueInterval);

    statsObj.queues.userDbUpdateQueue.busy = false;
    userDbUpdateQueueReadyFlag = true;

    userDbUpdateQueueInterval = setInterval(async function() {

      if (userDbUpdateQueueReadyFlag && (userDbUpdateQueue.length > 0)) {

        userDbUpdateQueueReadyFlag = false;

        const user = userDbUpdateQueue.shift();

        statsObj.queues.userDbUpdateQueue.busy = true;
        statsObj.queues.userDbUpdateQueue.length = userDbUpdateQueue.length;

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
          ));

        }
        catch(err){
          console.log(chalkError("TFE | *** ERROR DB UPDATE USER - updateUserDb"
            + "\n" + err
          ));
        }

        userDbUpdateQueueReadyFlag = true;
        statsObj.queues.userDbUpdateQueue.busy = false;
      }
    }, interval);

    resolve();

  });
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
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        statsObj.queues.randomNetworkTreeActivateQueue.size = 0;
        randomNetworkTree = null;
        statsObj.status = "ERROR RNT";
        console.log(chalkError("TFE | *** randomNetworkTree ERROR *** : " + err));
        console.log(chalkError("TFE | *** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
        if (!quitFlag) { quit({source: "RNT", error: err }); }
      });

      randomNetworkTree.on("exit", function(err) {
        randomNetworkTreeReadyFlag = true;
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        statsObj.queues.randomNetworkTreeActivateQueue.size = 0;
        randomNetworkTree = null;
        console.log(chalkError("TFE | *** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
        if (!quitFlag) { quit({source: "RNT", error: err }); }
      });

      randomNetworkTree.on("close", function(code) {
        randomNetworkTreeReadyFlag = true;
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        statsObj.queues.randomNetworkTreeActivateQueue.size = 0;
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

function parseText(params){

  return new Promise(async function(resolve, reject) {

    params.updateGlobalHistograms = (params.updateGlobalHistograms !== undefined) ? params.updateGlobalHistograms : false;
    params.category = (params.category !== undefined) ? params.category : "none";
    params.minWordLength = params.minWordLength || configuration.minWordLength;

    try {
      const hist = await twitterTextParser.parseText(params);
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
    params.category = params.category || "none";

    twitterImageParser.parseImage(params).
    then(function(hist){
      console.log(chalkLog("TFE | +++ IMAGE PARSE" 
        + " | CAT: " + params.category
        + " | @" + params.screenName
        + " | " + params.imageUrl
        + "\n" + jsonPrint(hist)
      ));
      resolve(hist);
    }).
    catch(function(err){

      if (err.code === 8){
        console.log(chalkError("TFE | *** IMAGE PARSER | RATE LIMIT: " + err));
        statsObj.imageParser.rateLimitFlag = true;

        startImageParserRateTimitTimeout(configuration.imageParserRateTimitTimeout);

        return resolve();
      }
      console.log(chalkError("TFE | *** IMAGE PARSER ERROR: " + err));
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
        // + "\nTFE | PROFILE HISTOGRAMS\n" + jsonPrint(user.profileHistograms) 
      ));

      user.previousBannerImageUrl = null;
      user.previousProfileImageUrl = null;

      user.previousDescription = null;
      user.previousExpandedUrl = null;
      user.previousLocation = null;
      user.previousName = null;
      user.previousProfileUrl = null;
      user.previousScreenName = null;
      user.previousUrl = null;
    }

    const results = [];

    if (!user.bannerImageAnalyzed || checkPropertyChange(user, "bannerImageUrl")) { results.push("bannerImageUrl"); }
    if (!user.profileImageAnalyzed || checkPropertyChange(user, "profileImageUrl")) { results.push("profileImageUrl"); }

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
          case "images":
          case "media":
          case "emoji":
          case "places":
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

function analyzeLanguage(params){

  return new Promise(async function(resolve, reject){

    debug(chalkAlert("analyzeLanguage\n" + jsonPrint(params)));

    const document = {
      "content": params.text,
      type: "PLAIN_TEXT"
    };

    const results = {};
    results.sentiment = {};

    let responses;

    try {

      responses = await languageClient.analyzeSentiment({document: document});

      const sentiment = responses[0].documentSentiment;

      results.sentiment.score = sentiment.score;
      results.sentiment.magnitude = sentiment.magnitude;
      results.sentiment.comp = 100*sentiment.score*sentiment.magnitude;

      console.log(chalkInfo("TFE | LANG SENTIMENT"
        + " | M: " + results.sentiment.magnitude.toFixed(5)
        + " | S: " + results.sentiment.score.toFixed(5)
        + " | C: " + results.sentiment.comp.toFixed(5)
        + " | @" + params.screenName
      ));

      statsObj.analyzer.analyzed += 1;
      statsObj.analyzer.total += 1;

      resolve(results);

    }
    catch(err){
      console.log(chalkError("*** LANGUAGE ANALYZER ERROR", err));
      statsObj.analyzer.errors += 1;
      statsObj.analyzer.total += 1;
      reject(err);
    }

  });
}

let startQuotaTimeOut;

function startQuotaTimeOutTimer(p){

  const params = p || {};

  params.duration = params.duration || configuration.languageQuotaTimoutDuration;

  clearTimeout(startQuotaTimeOut);

  console.log(chalkAlert("TFE | *** START LANG QUOTA TIMEOUT"
    + " | " + getTimeStamp()
    + " | DURATION: " + msToTime(configuration.languageQuotaTimoutDuration)
  ));

  startQuotaTimeOut = setTimeout(function(){

    statsObj.languageQuotaFlag = false;

    console.log(chalkAlert("TFE | *** END LANG QUOTA TIMEOUT"
      + " | " + getTimeStamp()
      + " | DURATION: " + msToTime(configuration.languageQuotaTimoutDuration)
    ));

  }, params.duration);
}


function userProfileChangeHistogram(params) {

  return new Promise(async function(resolve, reject){

    let userProfileChanges = false;
    let bannerImageAnalyzedFlag = false;
    let languageAnalyzedFlag = false;
    let profileImageAnalyzedFlag = false;

    try {
      userProfileChanges = await checkUserProfileChanged(params);
    }
    catch(err){
      return reject(err);
    }

    const user = params.user;

    let sentimentHistogram = {};
    sentimentHistogram.sentiment = {};

    if (!userProfileChanges) {

      if (configuration.enableLanguageAnalysis
        && !statsObj.languageQuotaFlag
        && (!user.profileHistograms.sentiment 
          || (user.profileHistograms.sentiment === undefined)
          || (Object.keys(user.profileHistograms.sentiment).length === 0)
          )
      ) {

        const profileText = user.name + "\n@" + user.screenName + "\n" + user.location + "\n" + user.description;

        try{
          userProfileChanges = [];
          userProfileChanges.push("sentiment");
          sentimentHistogram = await analyzeLanguage({screenName: user.screenName, text: profileText});
          languageAnalyzedFlag = true;
          statsObj.languageQuotaFlag = false;
        }
        catch(err){
          if (err.code === 3) {
            console.log(chalkAlert("TFE | UNSUPPORTED LANG"
              + " | NID: " + user.nodeId
              + " | @" + user.screenName
              + " | " + err
            ));
          }
          else if (err.code === 8) {
            console.error(chalkAlert("TFE"
              + " | " + getTimeStamp()
              + " | LANGUAGE QUOTA"
              + " | RESOURCE_EXHAUSTED"
              + " | NID: " + user.nodeId
              + " | @" + user.screenName
            ));
            statsObj.languageQuotaFlag = moment().valueOf();
            startQuotaTimeOutTimer();
          }
          else {
            console.error(chalkError("TFE | *** LANGUAGE TEXT ERROR"
              + " | " + err
              + "\n" + jsonPrint(err)
            ));
          }
        }
      }

    }


    let text = "";
    const urlsHistogram = {};
    urlsHistogram.urls = {};

    const locationsHistogram = {};
    locationsHistogram.locations = {};

    async.each(userProfileChanges, async function(userProp){

      let userPropValue = false;

      if (user[userProp] && (user[userProp] !== undefined)) {
        userPropValue = user[userProp].toLowerCase();
      }

      const prevUserProp = "previous" + _.upperFirst(userProp);

      let domain;
      let domainNodeId;
      let nodeId;
      let lastSeen;
      let name;

      user[prevUserProp] = (user[prevUserProp] === undefined) ? null : user[prevUserProp];

      if (!userPropValue) {
        if (configuration.verbose) {
          console.log(chalkLog(MODULE_ID_PREFIX
            + " | ??? userProfileChangeHistogram USER PROP VALUE FALSE"
            + " | @" + user.screenName
            + " | PROP: " + userProp
            + " | VALUE: " + userPropValue
          ));
        }
        user[prevUserProp] = user[userProp];
        return;
      }

      switch (userProp) {

        case "sentiment":
        break;

        case "location":

          text += userPropValue + "\n";

          lastSeen = Date.now();

          name = userPropValue.trim().toLowerCase();
          name = name.replace(/\./gi, "");

          nodeId = btoa(name);

          locationsHistogram.locations[nodeId] = (locationsHistogram.locations[nodeId] === undefined) ? 1 : locationsHistogram.locations[nodeId] + 1;

          try {

            let locationDoc = await global.globalLocation.findOne({nodeId: nodeId});

            if (!locationDoc) {

              debug(chalkInfo("TFE | --- LOC DB MISS"
                + " | NID: " + nodeId
                + " | N: " + name + " / " + userPropValue
              ));

              locationDoc = new global.globalLocation({
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
        case "profileImageUrl":

          domain = urlParse(userPropValue.toLowerCase()).hostname;
          nodeId = btoa(userPropValue.toLowerCase());

          if (userPropValue && domain) { 
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
        console.trace(chalkError("TFE | USER PROFILE HISTOGRAM ERROR: " + err));
        return reject(err);
      }

      async.parallel({

        bannerImageHist: function(cb) {

          if(statsObj.imageParser.rateLimitFlag){
            console.log(chalk.yellow("TFE | VISION RATE LIMITED | @" + user.screenName));
            return cb(null);
          }

          if (
              (configuration.enableImageAnalysis && user.bannerImageUrl && (user.bannerImageUrl !== undefined) && (user.bannerImageUrl !== user.bannerImageAnalyzed)
            || (configuration.forceImageAnalysis && user.bannerImageUrl && (user.bannerImageUrl !== undefined))
            )
          ){

            parseImage({
              screenName: user.screenName, 
              category: user.category, 
              imageUrl: user.bannerImageUrl, 
              histograms: user.profileHistograms,
              updateGlobalHistograms: true
            }).
            then(function(imageParseResults){
              if (imageParseResults) { 
                bannerImageAnalyzedFlag = true;
                cb(null, imageParseResults);
              }
              else{
                cb(null, {});
              }
            }).
            catch(function(err){
              console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
              cb(err, null);
            });

          }
          else {
            cb(null, {});
          }
        }, 

        profileImageHist: function(cb) {

          if(statsObj.imageParser.rateLimitFlag){
            console.log(chalk.yellow("TFE | VISION RATE LIMITED | @" + user.screenName));
            return cb(null);
          }

          if (
              (configuration.enableImageAnalysis && user.profileImageUrl && (user.profileImageUrl !== undefined) && (user.profileImageUrl !== user.profileImageAnalyzed)
            || (configuration.forceImageAnalysis && user.profileImageUrl && (user.profileImageUrl !== undefined))
            )
          ){

            parseImage({
              screenName: user.screenName, 
              category: user.category, 
              imageUrl: user.profileImageUrl, 
              histograms: user.profileHistograms,
              updateGlobalHistograms: true
            }).
            then(function(imageParseResults){
              if (imageParseResults) { 
                profileImageAnalyzedFlag = true;
                cb(null, imageParseResults);
              }
              else{
                cb(null, {});
              }
            }).
            catch(function(err){
              console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
              cb(err, null);
            });

          }
          else {
            cb(null, {});
          }
        }, 

        textHist: function(cb){

          if (text && (text !== undefined)){

            if (configuration.enableLanguageAnalysis && !statsObj.languageQuotaFlag) {

              analyzeLanguage({screenName: user.screenName, text: text})
              .then(function(sentHist){
                sentimentHistogram = sentHist;
                languageAnalyzedFlag = true;
                statsObj.languageQuotaFlag = false;
              })
              .catch(function(e){
                if (e.code === 3) {
                  console.log(chalkLog("TFE | UNSUPPORTED LANG"
                    + " | " + e
                  ));
                }
                else if (e.code === 8) {
                  console.error(chalkAlert("TFE"
                    + " | LANGUAGE QUOTA"
                    + " | RESOURCE_EXHAUSTED"
                  ));
                  statsObj.languageQuotaFlag = moment().valueOf();
                  startQuotaTimeOutTimer();
                }
                else {
                  console.error(chalkError("TFE | *** LANGUAGE TEXT ERROR"
                    + " | " + e
                    + "\n" + jsonPrint(e)
                  ));
                }
              });

            }

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
            cb(null, {});
          }
        }

      }, function(err, results){

        if (err) {
          console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
          return reject(err);
        }

        mergeHistogramsArray( {
          histogramArray: [
            results.textHist, 
            results.bannerImageHist, 
            results.profileImageHist, 
            urlsHistogram,
            locationsHistogram,
            sentimentHistogram
          ]
        } ).
        then(function(histogramsMerged){
          resolve({ 
            userProfileChanges: userProfileChanges, 
            histograms: histogramsMerged, 
            languageAnalyzedFlag: languageAnalyzedFlag, 
            bannerImageAnalyzedFlag: bannerImageAnalyzedFlag, 
            profileImageAnalyzedFlag: profileImageAnalyzedFlag
          });
        }).
        catch(function(err){
          console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
          return reject(err);
        });
      });
    });

  });
}

function updateUserHistograms(p) {

  return new Promise(async function(resolve, reject){

    let params = {};
    params = p;
    
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

      const results = await userProfileChangeHistogram({user: user});

      if (results && (results.userProfileChanges || results.languageAnalyzedFlag)) {
        user.profileHistograms = await mergeHistograms.merge({ histogramA: user.profileHistograms, histogramB: results.histograms });
      }

      if (results && results.bannerImageAnalyzedFlag) {
        user.bannerImageAnalyzed = user.bannerImageUrl;
      }

      if (results && results.profileImageAnalyzedFlag) {
        user.profileImageAnalyzed = user.profileImageUrl;
      }

      user.lastHistogramTweetId = user.statusId;
      user.lastHistogramQuoteId = user.quotedStatusId;

      const updatedUser = await userServerController.findOneUserV2({user: user, mergeHistograms: false, noInc: true});

      params.user = updatedUser.toObject();

      if (!params.user.friends || (params.user.friends === undefined)){ 
        params.user.friends = [];
      }

      if (configuration.testMode && params.user.friends.length === 0) {

        params.user.friends = Array.from({ length: randomInt(1,47) }, () => (Math.floor(Math.random() * 123456789).toString()));

        console.log(chalkLog("TFE | TEST MODE | ADD RANDOM FRNDs IDs"
          + " | " + params.user.userId
          + " | @" + params.user.screenName
          + " | " + params.user.friends.length + "FRNDs"
          // + "\n" + params.user.friends
        ));
      }

      await updateGlobalHistograms(params);

      resolve(params.user);

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
      activateNetworkQueue.push({user: updatedUser});
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

    if (params.user.latestTweets.length === 0) { return resolve(params.user); }

    let user = {};
    const latestTweets = params.user.latestTweets;
    
    user = params.user;
    delete user.latestTweets;

    if (user.tweetHistograms === undefined) { 
      user.tweetHistograms = {};
    }

    if (!user.tweets || user.tweets === undefined || user.tweets === {}) { 
      console.log(chalkAlert("TFE | updateUserTweets | *** USER TWEETS UNDEFINED\n", jsonPrint(user.tweets)));
      user.tweets = {};
      user.tweets.maxId = "0";
      user.tweets.sinceId = "0";
      user.tweets.tweetIds = [];
    }

    user.tweets.maxId = user.tweets.maxId || "0";
    user.tweets.sinceId = user.tweets.sinceId || "0";
    user.tweets.tweetIds = user.tweets.tweetIds || [];


    const tscParams = {};

    tscParams.globalTestMode = configuration.globalTestMode;
    tscParams.testMode = configuration.testMode;
    tscParams.inc = false;
    tscParams.twitterEvents = configEvents;
    tscParams.tweetStatus = {};

    if (user.tweets.tweetIds.length > DEFAULT_MAX_USER_TWEETIDS) {

      const length = user.tweets.tweetIds.length;
      const removeNumber = length - DEFAULT_MAX_USER_TWEETIDS;

      debug(chalkLog("TFE | ---  TWEETS > MAX TWEETIDS"
        + " | " + user.nodeId
        + " | @" + user.screenName
        + " | " + length + " TWEETS"
        + " | REMOVE: " + removeNumber
      ));

      user.tweets.tweetIds.splice(0,removeNumber);
    }

    async.eachSeries(latestTweets, async function(tweet){

      tscParams.tweetStatus = tweet;
      tscParams.tweetStatus.user = {};
      tscParams.tweetStatus.user = user;
      tscParams.tweetStatus.user.isNotRaw = true;

      if (tweet.id_str.toString() > user.tweets.maxId.toString()) {
        user.tweets.maxId = tweet.id_str.toString();
      }

      if (tweet.id_str.toString() > user.tweets.sinceId.toString()) {
        user.tweets.sinceId = tweet.id_str.toString();
      }

      if (!user.tweets.tweetIds.includes(tweet.id_str.toString())) { 

        try {

          const tweetObj = await tweetServerController.createStreamTweet(tscParams);

          user.tweetHistograms = await processTweetObj({tweetObj: tweetObj, histograms: user.tweetHistograms});
          user.tweets.tweetIds.push(tweet.id_str.toString()); 

          statsObj.twitter.tweetsProcessed += 1;
          statsObj.twitter.tweetsTotal += 1;

          if (configuration.verbose || (statsObj.twitter.tweetsTotal % 100 === 0)) {
            console.log(chalkTwitter("TFE | +++ PROCESSED TWEET"
              + " [ P/H/T " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + "]"
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
            + " [ P/H/T " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + "]"
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

      if (configuration.verbose) {
        console.log(chalkLog("TFE | +++ Ts"
          + " [ P/H/T " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + "]"
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

    debug(chalkInfo("PROCESS USER\n" + jsonPrint(userIn)));

    if (userServerController === undefined) {
      console.log(chalkError("TFE | *** processUser userServerController UNDEFINED"));
      return reject(new Error("processUser userServerController UNDEFINED"));
    }

    let user;

    try {
      user = await updateUserTweets({user: userIn});
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
          user.profileImageAnalyzed = false;
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

        if (!user.tweets || (user.tweets === undefined) || (user.tweets === {})){
          console.log(chalkAlert("TFE | *** USER TWEETS UNDEFINED | @" + user.screenName));
          user.tweets = {};
          user.tweets.sinceId = "0";
          user.tweets.maxId = "0";
          user.tweets.tweetIds = [];
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

      }
      cb();

    }, function(){

      if (user.statusId && (user.statusId !== undefined) && (user.previousStatusId !== user.statusId)) {
        user.previousStatusId = user.statusId;
      }

      if (user.quotedStatusId && (user.quotedStatusId !== undefined) && (user.previousQuotedStatusId !== user.quotedStatusId)) {
        user.previousQuotedStatusId = user.quotedStatusId;
      }

      resolve(user);
    });

  });
}


function printUser(params) {
  let text;
  const user = params.user;

  if (params.verbose) {
    return jsonPrint(params.user);
  } 
  else {
    text = user.userId
    + " | @" + user.screenName
    + " | " + user.name 
    + " | LG " + user.lang
    + " | FW " + user.followersCount
    + " | FD " + user.friendsCount
    + " | T " + user.statusesCount
    + " | M  " + user.mentions
    + " | LS " + getTimeStamp(user.lastSeen)
    + " | FWG " + user.following 
    + " | 3C " + user.threeceeFollowing 
    + " | LC " + user.location
    + " | C M " + user.category + " A " + user.categoryAuto;
    return text;
  }
}

function initProcessUserQueueInterval(interval) {

  return new Promise(async function(resolve){

    statsObj.status = "INIT PROCESS USER QUEUE";

    let mObj = {};
    let user;
    let processedUser;
    let userUpdated;

    console.log(chalkBlue("TFE | INIT PROCESS USER QUEUE INTERVAL | " + PROCESS_USER_QUEUE_INTERVAL + " MS"));

    clearInterval(processUserQueueInterval);

    processUserQueueInterval = setInterval(async function () {

      if (!statsObj.queues.processUserQueue.busy && statsObj.queues.processUserQueue.size > 0) {

        statsObj.status = "PROCESS USER";

        statsObj.queues.processUserQueue.busy = true;

        mObj = processUserQueue.shift(); // .latestTweets[], .userId

        statsObj.queues.processUserQueue.size = processUserQueue.length;

        try {

          if (!categorizedUserIdSet.has(mObj.userId)){
            console.log(chalkAlert("TFE | !!! USER ID NOT IN CATEGORIZED SET: " + mObj.userId));
            statsObj.users.totalUsersSkipped += 1;
            statsObj.queues.processUserQueue.busy = false;
            return;
          }

          user = await global.globalUser.findOne({nodeId: mObj.userId});

          if (!user) {
            console.log(chalkAlert("TFE | ??? USER NOT FOUND IN DB"
              + " | UID: " + mObj.userId
              + " | @" + mObj.screenName
            ));
            statsObj.users.totalUsersSkipped += 1;
            statsObj.queues.processUserQueue.busy = false;
            return;
          }

          if (configuration.verbose){
            console.log(chalkLog("TFE | FOUND USER DB"
              + " | " + printUser({user: user})
            ));
          }

          if (!user.latestTweets || (user.latestTweets === undefined)) { user.latestTweets = []; }
          if (!mObj.latestTweets || (mObj.latestTweets === undefined)) { mObj.latestTweets = []; }

          user.latestTweets = _.union(user.latestTweets, mObj.latestTweets);

          if (!user.tweets || (user.tweets === undefined) || (user.tweets === {})){
            user.tweets = {};
            user.tweets.sinceId = "0";
            user.tweets.maxId = "0";
            user.tweets.tweetIds = [];
          }

          processedUser = await processUser({user: user});

          if (!processedUser.tweets || (processedUser.tweets === undefined) || (processedUser.tweets === {})){
            processedUser.tweets = {};
            processedUser.tweets.sinceId = "0";
            processedUser.tweets.maxId = "0";
            processedUser.tweets.tweetIds = [];
          }

          if (configuration.verbose) {
            console.log(chalkAlert("TFE | PROCESSED USER"
              + " | UID: " + processedUser.userId
              + " | @" + processedUser.screenName
              + " | Ts SINCE: " + processedUser.tweets.sinceId
              + " MAX: " + processedUser.tweets.maxId
              + " Ts: " + processedUser.tweets.tweetIds.length
              // + "\ntweets\n" + jsonPrint(user.tweets)
            ));
          }

          statsObj.users.processed += 1;
          statsObj.users.percentProcessed = 100*(statsObj.users.processed+statsObj.users.fetchErrors)/statsObj.users.categorized.total;

          debug("PROCESSED USER\n" + jsonPrint(processedUser));

          if (statsObj.users.processed % 100 === 0) {
            showStats();
          }

          userUpdated = await updatePreviousUserProps({user: processedUser});

          if (configuration.verbose){
            console.log(chalkLog("TFE | UPDATED PREV PROPS USER"
              + " | " + printUser({user: userUpdated})
            ));
          }

          userUpdated = await userServerController.findOneUserV2({user: userUpdated, mergeHistograms: false, noInc: true});

          if (configuration.verbose){
            console.log(chalkLog("TFE | UPDATED USER DB"
              + " | " + printUser({user: userUpdated})
            ));
          }

          statsObj.queues.processUserQueue.busy = false;
        }
        catch(err){
          console.trace(chalkError("TFE | *** ERROR processUser"
            + " | USER ID: " + mObj.userId
            + " | ", err
          ));
          console.log(err);
          statsObj.queues.processUserQueue.busy = false;
        }

      }
    }, interval);

    resolve();

  });
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
          childSendAll({op: "FETCH_START"});
          await initCategorizedUserIdSet();
          console.log("TFE | FETCH_ALL | onEnter | " + event);
        }
        catch(err){
          console.log(chalkError("TFE | *** ALL CHILDREN FETCH_ALL ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },
    fsm_tick: function() {

      statsObj.queues.processUserQueue.size = processUserQueue.length;
      statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

      childCheckState({
        checkState: "FETCH_END", 
        noChildrenTrue: false, 
        exceptionStates: ["ERROR"]
      }).
      then(function(allChildrenFetchEnd){
        debug("FETCH_END TICK"
          + " | Q BUSY: " + statsObj.queues.processUserQueue.busy
          + " | Q SIZE: " + statsObj.queues.processUserQueue.size
          + " | ALL CHILDREN FETCH_END: " + allChildrenFetchEnd
        );

        statsObj.allChildrenFetchEnd = allChildrenFetchEnd;

        if (allChildrenFetchEnd
          && !statsObj.queues.processUserQueue.busy
          && (statsObj.queues.processUserQueue.size === 0)
          ) 
        { 
          console.log(chalkAlert("FSM | allChildrenFetchEnd | STATS QUEUES\n" + jsonPrint(statsObj.queues)));
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

        console.log(chalk.bold.blue("TFE | TOTAL USERS PROCESSED:    " + statsObj.users.processed));
        console.log(chalk.bold.blue("TFE | TOTAL USERS FETCH ERRORS: " + statsObj.users.fetchErrors));

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

        console.log(chalkLog("TFE | Q STATS\n" + jsonPrint(statsObj.queues)));

        if (randomNetworkTree && (randomNetworkTree !== undefined)) {
          randomNetworkTree.send({op: "GET_STATS"});
          console.log(chalkLog("TFE | PAUSING FOR RNT GET_STATS RESPONSE ..."));
          try{
            await waitEvent({ event: "allNetworksUpdated"});
          }
          catch(err){
            console.log(chalkError("TFE | *** WAIT EVENT ERROR: " + err));
          }
        }

        try{
          await pruneGlobalHistograms();
        }
        catch(err){
          console.log(chalkError("TFE | *** PRUNE GLOBAL HISTOGRAMS ERROR: " + err));
        }

        let histogramsSavedFlag = false;

        console.log(chalkInfo("TFE | SAVING HISTOGRAMS | TYPES: " + Object.keys(globalHistograms)));

        async.eachSeries(DEFAULT_INPUT_TYPES, function(type, cb){

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
            + " | ENTRIES: " + histObj.meta.numEntries
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
        slackText = slackText + "\nTOT: " + statsObj.users.processed + " | ERR: " + statsObj.users.fetchErrors;
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

              await resetGlobalHistograms({inputTypes: DEFAULT_INPUT_TYPES});

              statsObj.users.total = 0;
              statsObj.users.processed = 0;
              statsObj.users.fetchErrors = 0;
              userErrorSet.clear();
              statsObj.users.percentProcessed = 0;
              statsObj.users.fetched = 0;
              statsObj.users.percentFetched = 0;
              statsObj.users.classified = 0;
              statsObj.users.classifiedAuto = 0;

              maxInputHashMap = {};
              normalization = {};

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
    createParams.config.verbose = configuration.verbose;
    createParams.config.testMode = configuration.testMode;
    createParams.config.tweetFetchCount = (configuration.testMode) ? TEST_TWEET_FETCH_COUNT : configuration.tweetFetchCount;
    createParams.config.fetchCount = (configuration.testMode) ? TEST_FETCH_COUNT : configuration.fetchCount;
    createParams.config.totalFetchCount = (configuration.testMode) ? TEST_TOTAL_FETCH : configuration.totalFetchCount;
    createParams.config.fetchUserInterval = (configuration.testMode) ? TEST_FETCH_USER_INTERVAL : configuration.fetchUserInterval;

    createParams.config.twitterConfig = {};

    createParams.config = merge(createParams.config, params.config);

    console.log(chalkLog("TFE | CHILD CREATE ALL: " + configuration.twitterUsers));

    async.each(configuration.twitterUsers, async function(threeceeUser){

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

              userErrorSet.add(m.userId);

              statsObj.users.fetchErrors = userErrorSet.size;

              categorizedUserIdSet.delete(m.userId);

              global.globalUser.deleteOne({nodeId: m.userId}, function(err){
                if (err) {
                  console.log(chalkError("TFE | *** DELETE USER ERROR: " + err));
                }
                else {
                  console.log(chalkAlert("TFE | XXX DELETED USER | " + m.userId));
                }
              });

              break;
            }
            else if (m.type === "USER_BLOCKED") {

              console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | USER BLOCKED " + m.userId));

              userErrorSet.add(m.userId);

              statsObj.users.fetchErrors = userErrorSet.size;

              categorizedUserIdSet.delete(m.userId);

              global.globalUser.deleteOne({nodeId: m.userId}, function(err){
                if (err) {
                  console.log(chalkError("TFE | *** DELETE USER ERROR: " + err));
                }
                else {
                  console.log(chalkAlert("TFE | XXX DELETED USER | " + m.userId));
                }
              });

              break;
            }
            else if (m.type === "USER_NOT_FOUND") {

              console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | USER NOT FOUND " + m.userId));

              userErrorSet.add(m.userId);

              statsObj.users.fetchErrors = userErrorSet.size;

              categorizedUserIdSet.delete(m.userId);

              global.globalUser.deleteOne({nodeId: m.userId}, function(err){
                if (err) {
                  console.log(chalkError("TFE | *** DELETE USER ERROR: " + err));
                }
                else {
                  console.log(chalkAlert("TFE | XXX DELETED USER | " + m.userId));
                }
              });

              break;
            }
            else {

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
            }

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

          case "USER_FRIENDS":

            if (categorizedUserIdSet.has(m.userId)){

              processUserQueue.push(m);
              statsObj.queues.processUserQueue.size = processUserQueue.length;

              if (configuration.verbose){
                console.log(chalkTwitter("TFE | USER_FRIENDS"
                  + " [ PUQ: " + statsObj.queues.processUserQueue.size + "]"
                  + " | UID: " + m.userId
                  + " | FRNDs: " + m.friends.length
                ));
              }
            }

          break;

          case "USER_TWEETS":

            if (categorizedUserIdSet.has(m.userId)){

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
                // slackSendWebMessage("FOLLOW | @" + m.threeceeUser + " | " + m.userId + " | @" + m.screenName);
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

      // if (configuration.verbose) {
      //   console.log("childCheckState"
      //     + " | CH ID: " + childId 
      //     + " | " + child.status 
      //     + " | CHCK STATE: " + checkState 
      //     + " | cs: " + cs
      //     + " | allCheckState: " + allCheckState
      //   );
      // }

    });

    // if (configuration.verbose) {
    //   console.log(chalkLog(MODULE_ID_PREFIX + " | MAIN: " + fsm.getMachineState()
    //     + " | ALL CHILDREN CHECKSTATE: " + checkState + " | " + allCheckState
    //   ));
    // }

    resolve(allCheckState);

  });
}

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

        await initProcessUserQueueInterval(PROCESS_USER_QUEUE_INTERVAL);
        await initUserDbUpdateQueueInterval(USER_DB_UPDATE_QUEUE_INTERVAL);
        await initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);

        await initUnfollowableUserSet();
        await initActivateNetworkQueueInterval(ACTIVATE_NETWORK_QUEUE_INTERVAL);

        await initRandomNetworkTreeChild();

        neuralNetworkInitialized = true;

        await initWatchConfig();
        await fsmStart();

      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** FSM START ERROR: " + err + " | QUITTING ***"));
        quit({cause: "FSM START ERROR"});
      }

    }
    catch(err){
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


