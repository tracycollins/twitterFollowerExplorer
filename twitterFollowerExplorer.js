const MODULE_NAME = "twitterFollowerExplorer";
const MODULE_ID_PREFIX = "TFE";
const CHILD_PREFIX = "tfe_node";

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const TEST_MODE = false; // applies only to parent
const TEST_FETCH_TWEETS_MODE = false; // applies only to parent

const DEFAULT_NN_DB_LOAD_PER_INPUTS = 3;
const DEFAULT_RANDOM_UNTESTED_NN_PER_INPUTS = 3;

const FETCH_COUNT = 200;

const TEST_TWEET_FETCH_COUNT = 11;

const TEST_MODE_NUM_NN = 5;
const TEST_FETCH_COUNT = 100;
const TEST_TOTAL_FETCH = 500;

const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = true;

const MIN_TWEET_ID = "1000000";

const DEFAULT_ENABLE_GEOCODE = true;
const DEFAULT_FORCE_GEOCODE = false;

const DEFAULT_FORCE_LANG_ANALYSIS = false;
const DEFAULT_ENABLE_LANG_ANALYSIS = true;
const DEFAULT_LANG_QUOTA_TIMEOUT_DURATION = 15*ONE_MINUTE;

const DEFAULT_FORCE_IMAGE_ANALYSIS = false;
const DEFAULT_ENABLE_IMAGE_ANALYSIS = true;

const DEFAULT_MAX_USER_TWEETIDS = 500;
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

const tcuChildName = MODULE_ID_PREFIX + "_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

let DROPBOX_ROOT_FOLDER;

if (hostname == "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const DEFAULT_FIND_CAT_USER_CURSOR_LIMIT = 100;
const TEST_FIND_CAT_USER_CURSOR_LIMIT = 10;
const DEFAULT_CURSOR_BATCH_SIZE = 100;
const TEST_CURSOR_BATCH_SIZE = 5;

const DEFAULT_ARCHIVE_NETWORK_ON_INPUT_MISS = true;
const DEFAULT_MIN_TEST_CYCLES = 10;
const DEFAULT_MIN_WORD_LENGTH = 3;
const DEFAULT_BEST_INCREMENTAL_UPDATE = false;

const RNT_CHILD_ID = CHILD_PREFIX + "_child_rnt";

const DEFAULT_MIN_INTERVAL = 1;
const DEFAULT_INIT_MAIN_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;
const FSM_TICK_INTERVAL = ONE_SECOND;
const STATS_UPDATE_INTERVAL = ONE_MINUTE;
const PROCESS_USER_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const ACTIVATE_NETWORK_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const USER_DB_UPDATE_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;

const DEFAULT_NUM_NN = 20; // TOP n NNs of each inputsId are loaded from DB
const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 80;

const RANDOM_NETWORK_TREE_INTERVAL = DEFAULT_MIN_INTERVAL;
const RANDOM_NETWORK_TREE_MSG_Q_INTERVAL = DEFAULT_MIN_INTERVAL; // ms

let waitFileSaveInterval;
let randomNetworkTreeMessageRxQueueInterval;

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
const userTweetFetchSet = new Set();

const globalHistograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  globalHistograms[type] = {};
});

let configuration = {};
configuration.offlineMode = false;
configuration.verbose = false;
configuration.networkDatabaseLoadPerInputsLimit = DEFAULT_NN_DB_LOAD_PER_INPUTS;
configuration.randomUntestedPerInputsLimit = DEFAULT_RANDOM_UNTESTED_NN_PER_INPUTS;
configuration.languageQuotaTimoutDuration = DEFAULT_LANG_QUOTA_TIMEOUT_DURATION;

configuration.enableLanguageAnalysis = DEFAULT_ENABLE_LANG_ANALYSIS;
configuration.forceLanguageAnalysis = DEFAULT_FORCE_LANG_ANALYSIS;

configuration.enableImageAnalysis = DEFAULT_ENABLE_IMAGE_ANALYSIS;
configuration.forceImageAnalysis = DEFAULT_FORCE_IMAGE_ANALYSIS;

configuration.enableGeoCode = DEFAULT_ENABLE_GEOCODE;
configuration.forceGeoCode = DEFAULT_FORCE_GEOCODE;

configuration.bestNetworkIncrementalUpdate = DEFAULT_BEST_INCREMENTAL_UPDATE;
configuration.archiveNetworkOnInputsMiss = DEFAULT_ARCHIVE_NETWORK_ON_INPUT_MISS;
configuration.minWordLength = DEFAULT_MIN_WORD_LENGTH;
configuration.minTestCycles = DEFAULT_MIN_TEST_CYCLES;
configuration.testMode = TEST_MODE;
configuration.testFetchTweetsMode = TEST_FETCH_TWEETS_MODE;
configuration.globalTestMode = GLOBAL_TEST_MODE;
configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.tweetFetchCount = (TEST_MODE) ? TEST_TWEET_FETCH_COUNT : TEST_FETCH_COUNT;
configuration.fetchCount = (TEST_MODE) ? TEST_FETCH_COUNT : FETCH_COUNT;
configuration.totalFetchCount = (TEST_MODE) ? TEST_TOTAL_FETCH : Infinity;
configuration.fsmTickInterval = FSM_TICK_INTERVAL;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;
configuration.networkDatabaseLoadLimit = (TEST_MODE) ? TEST_MODE_NUM_NN : DEFAULT_NUM_NN;

//=========================================================================
// HOST
//=========================================================================

const path = require("path");
const watch = require("watch");
const defaults = require("object.defaults");
const moment = require("moment");
const HashMap = require("hashmap").HashMap;
const pick = require("object.pick");
const _ = require("lodash");
const treeify = require("treeify");
const NodeCache = require("node-cache");
const merge = require("deepmerge");
const btoa = require("btoa");

const fs = require("fs");
const { promisify } = require("util");
const renameFileAsync = promisify(fs.rename);
const unlinkFileAsync = promisify(fs.unlink);

const debug = require("debug")("TFE");
const util = require("util");
const deepcopy = require("deep-copy");
const async = require("async");

const { WebClient } = require("@slack/client");
const { RTMClient } = require("@slack/client");

const EventEmitter2 = require("eventemitter2").EventEmitter2;

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
const chalkTwitter = chalk.blue;
const chalkBlue = chalk.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.yellow;
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
let processUserStartTimeMoment = moment();

const statsObj = {};
let statsObjSmall = {};

statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;

statsObj.runId = MODULE_ID.toLowerCase() + "_" + getTimeStamp();

statsObj.processedStartFlag = false;

statsObj.hostname = hostname;
statsObj.startTime = getTimeStamp();
statsObj.elapsedMS = 0;
statsObj.processUserElapsedMS = 0;
statsObj.elapsed = getElapsedTimeStamp();
statsObj.remainingTimeMs = 0;
statsObj.status = "START";
statsObj.timeStamp = getTimeStamp();

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

statsObj.randomNetworkTree = {};
statsObj.randomNetworkTree.memoryUsage = {};
statsObj.randomNetworkTree.memoryUsage.heap = 0;
statsObj.randomNetworkTree.memoryUsage.maxHeap = 0;

statsObj.geo = {};
statsObj.geo.hits = 0;
statsObj.geo.misses = 0;
statsObj.geo.total = 0;
statsObj.geo.hitRate = 0;

statsObj.imageParser = {};
statsObj.imageParser.parsed = 0;
statsObj.imageParser.errors = 0;
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

statsObj.queues.fetchUserQueue = {};
statsObj.queues.fetchUserQueue.busy = false;
statsObj.queues.fetchUserQueue.size = 0;

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

statsObj.fetchUserEndFlag = false;

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
statsObj.users.dbUpdated = 0;
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
  statsObj.processUserElapsedMS = moment().valueOf() - processUserStartTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

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

  return slackRtmClient.sendMessage(msg, slackConversationId);
}

function slackSendWebMessage(msgObj){


  return new Promise(function(resolve, reject){

    try {

      if (configuration.offlineMode) {
        resolve();
      }

      if (slackWebClient === undefined) {
        return reject(new Error("SLACK NOT INITIALIZED"));
      }

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

      console.log(chalkBlueBold("TFE | >>> SLACK WEB | SEND | " + message.text));
      slackWebClient.chat.postMessage(message);
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function slackMessageHandler(message){

  return new Promise(function(resolve, reject){

    try {

      console.log(chalkInfo("TFE | MESSAGE | " + message.type + " | " + message.text));

      if (message.type != "message") {
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
          resolve();
        break;
        case "NONE":
          resolve();
        break;
        default:
          console.log(chalkAlert("TFE | *** UNDEFINED SLACK MESSAGE: " + message.text));
          resolve({text: "UNDEFINED SLACK MESSAGE", message: message});
      }
    }
    catch(err){
      reject(err);
    }

  });
}

async function initSlackWebClient(){

  // return new Promise(function(resolve, reject){

    try {

      slackWebClient = new WebClient(slackRtmToken);

      const testResponse = await slackWebClient.api.test();
      if (configuration.verbose) {
        console.log("TFE | SLACK WEB TEST RESPONSE\n" + jsonPrint(testResponse));
      }

      const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

      conversationsListResponse.channels.forEach(async function(channel){
  
        debug(chalkLog("TFE | CHANNEL | " + channel.id + " | " + channel.name));

        if (channel.name == slackChannel) {
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

      console.log("TFE | SLACK WEB BOTS INITIALIZED");
      return;

    }
    catch(err){
      console.log(chalkError("TFE | *** INIT SLACK WEB CLIENT ERROR: " + err));
      throw err;
    }

  // });
}

async function initSlackRtmClient(){

  // return new Promise(async function(resolve, reject){

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
        if (configuration.verbose) { await slackSendRtmMessage(hostname + " | TFE | SLACK RTM READY"); }
      });


    }
    catch(err){
      console.log(chalkError("TFE | *** INIT SLACK RTM CLIENT | " + err));
      throw err;
    }

  // });
}

configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.processName = process.env.TFE_PROCESS_NAME || "tfe_node";
configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;
configuration.imageParserRateTimitTimeout = DEFAULT_IMAGE_PARSE_RATE_LIMIT_TIMEOUT;
configuration.interruptFlag = false;

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;

if (process.env.TFE_QUIT_ON_COMPLETE !== undefined) {

  console.log(MODULE_ID_PREFIX + " | ENV TFE_QUIT_ON_COMPLETE: " + process.env.TFE_QUIT_ON_COMPLETE);

  if (!process.env.TFE_QUIT_ON_COMPLETE || (process.env.TFE_QUIT_ON_COMPLETE == false) || (process.env.TFE_QUIT_ON_COMPLETE == "false")) {
    configuration.quitOnComplete = false;
  }
  else {
    configuration.quitOnComplete = true;
  }
}

configuration.globalMinSuccessRate = (process.env.TFE_GLOBAL_MIN_SUCCESS_RATE !== undefined) 
  ? process.env.TFE_GLOBAL_MIN_SUCCESS_RATE 
  : DEFAULT_GLOBAL_MIN_SUCCESS_RATE;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
configuration.DROPBOX.DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

const statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed",
  "bestRuntimeNetworkId",
  "currentBestNetworkId",
  "users",
  "status",
  "errors",
  "authenticated", 
  "numChildren", 
  "userReadyAck", 
  "userReadyAckWait", 
  "userReadyTransmitted",
  "randomNetworkTree",
  "queues"
];

statsObjSmall = pick(statsObj, statsPickArray);

async function loadInputs(params) {

  statsObj.status = "LOAD INPUTS CONFIG";

  const folder = params.folder;
  const file = params.file;

  console.log(chalkNetwork("TFE | LOADING INPUTS CONFIG | " + folder + "/" + file + " ..."));

  try {

    const inputsConfigObj = await tcUtils.loadFile({folder: folder, file: file, noErrorNotFound: params.noErrorNotFound});

    if (!inputsConfigObj) {
      if (params.noErrorNotFound) {
        console.log(chalkAlert("TFE | !!! LOAD INPUTS CONFIG FILE ERROR | FILE NOT FOUND "));
        return;
      }
      console.log(chalkError("TFE | LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED ??? "));
      throw new Error("LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED");
    }

    const tempInputsIdSet = new Set(inputsConfigObj.INPUTS_IDS);

    for (const inputsId of tempInputsIdSet) {
      inputsIdSet.add(inputsId);
    }

    console.log(chalkBlue("TFE | LOADED INPUTS CONFIG"
      + "\nTFE | CURRENT FILE INPUTS IDS SET: " + tempInputsIdSet.size + " INPUTS IDS"
      + "\n" + jsonPrint([...tempInputsIdSet])
      + "\nTFE | FINAL INPUTS IDS SET: " + inputsIdSet.size + " INPUTS IDS"
      + "\n" + jsonPrint([...inputsIdSet])
    ));

    return;
  }
  catch(err){
    if ((err.status == 409) || (err.status == 404)) {
      console.log(chalkError("TFE | LOAD INPUTS CONFIG FILE NOT FOUND"));
      return;
    }
    console.log(chalkError("TFE | LOAD INPUTS CONFIG FILE ERROR: ", err));
    throw err;
  }
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
    + " | RNK: " + networkObj.rank
    + " | ARCHVD: " + networkObj.archived
    + " | TECH: " + networkObj.networkTechnology
    + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
    + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
    + " | SR: " + networkObj.successRate.toFixed(2) + "%"
    // + " | CR: " + getTimeStamp(networkObj.createdAt)
    + " | TC: " + networkObj.testCycles
    + " | TCH: " + networkObj.testCycleHistory.length
    + " | INs: " + networkObj.numInputs
    + " | IN: " + networkObj.inputsId
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
        console.log(chalkError("*** updateDbNetwork | NN FIND ONE ERROR: " + err));
        return reject(err);
      }

      if (verbose) { printNetworkObj(MODULE_ID_PREFIX + " | +++ NN DB UPDATED", nnDbUpdated, chalkGreen); }

      resolve(nnDbUpdated);
    });

  });
}

function convertUserHistograms(params) {

  return new Promise(function(resolve, reject){

    const userNodeIdArray = Object.keys(params.usersHashMap);
    const userArray =[];
    const verbose = params.verbose || configuration.verbose;

    async.eachSeries(userNodeIdArray, function(nodeId, cb){

      const user = params.usersHashMap[nodeId];
      categorizedUserIdSet.add(nodeId);

      tcUtils.convertHistogramToBinary({histogram: user.tweetHistograms, verbose: verbose})
      .then(function(convertedTweetHistograms){

        debug(chalkError(MODULE_ID_PREFIX + " | convertedTweetHistograms\n" + jsonPrint(convertedTweetHistograms)));

        user.tweetHistograms = convertedTweetHistograms;
        user.profileHistograms = user.profileHistograms || {};

        tcUtils.convertHistogramToBinary({histogram: user.profileHistograms, verbose: verbose})
        .then(function(convertedProfileHistograms){

          debug(chalkError(MODULE_ID_PREFIX + " | convertedProfileHistograms\n" + jsonPrint(convertedProfileHistograms)));

          user.profileHistograms = convertedProfileHistograms;
          userArray.push(user);

          cb();

        })
        .catch(function(e){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** convertUserHistograms user.profileHistograms ERROR: " + e));
          console.log(chalkError("user\n" + jsonPrint(user)));
          return cb(e);
        });

      })
      .catch(function(e){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** convertUserHistograms user.tweetHistograms ERROR: " + e));
        return cb(e);
      });


    }, function(err){
      if (err) { 
        return reject(err);
      }
      resolve(userArray);
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

    p.lean = false;
    p.skip = 0;
    p.limit = (configuration.testMode) ? TEST_FIND_CAT_USER_CURSOR_LIMIT : DEFAULT_FIND_CAT_USER_CURSOR_LIMIT;
    p.batchSize = (configuration.testMode) ? TEST_CURSOR_BATCH_SIZE : DEFAULT_CURSOR_BATCH_SIZE;
    p.toObject = true;

    let more = true;
    statsObj.users.categorized.total = 0;
    statsObj.users.categorized.manual = 0;
    statsObj.users.categorized.auto = 0;
    statsObj.users.categorized.matched = 0;
    statsObj.users.categorized.mismatched = 0;
    statsObj.users.categorized.matchRate = 0;

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

            convertUserHistograms({usersHashMap: results.obj}).
            then(function(usersArray){

              for(const user of usersArray){

                processUserQueue.push(user);

                // if (configuration.testMode || configuration.verbose || (statsObj.users.categorized.total % 1000 == 0)) {

                //   console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
                //     + " | UIDs: " + usersArray.length
                //     + " | PUQ: " + processUserQueue.length
                //     + " | TOT CAT: " + statsObj.users.categorized.total
                //     + " | LIMIT: " + p.limit
                //     + " | SKIP: " + p.skip
                //     + " | " + statsObj.users.categorized.manual + " MAN"
                //     + " | " + statsObj.users.categorized.auto + " AUTO"
                //     + " | " + statsObj.users.categorized.matched + " MATCHED"
                //     + " / " + statsObj.users.categorized.mismatched + " MISMATCHED"
                //     + " | " + statsObj.users.categorized.matchRate.toFixed(2) + "% MATCHRATE"
                //   ));
                // }

              }

              if (configuration.testMode || configuration.verbose || (statsObj.users.categorized.total % 1000 == 0)) {

                console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
                  + " | UIDs: " + usersArray.length
                  + " | PUQ: " + processUserQueue.length
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

              // childParams.command.userArray = usersArray;

              // childSend(childParams).
              // then(function(){
              //   if (configuration.testMode || configuration.verbose || (statsObj.users.categorized.total % 1000 == 0)) {

              //     console.log(chalkLog(MODULE_ID_PREFIX + " | LOADING CATEGORIZED USERS FROM DB"
              //       + " | UIDs: " + childParams.command.userArray.length
              //       + " | TOT CAT: " + statsObj.users.categorized.total
              //       + " | LIMIT: " + p.limit
              //       + " | SKIP: " + p.skip
              //       + " | " + statsObj.users.categorized.manual + " MAN"
              //       + " | " + statsObj.users.categorized.auto + " AUTO"
              //       + " | " + statsObj.users.categorized.matched + " MATCHED"
              //       + " / " + statsObj.users.categorized.mismatched + " MISMATCHED"
              //       + " | " + statsObj.users.categorized.matchRate.toFixed(2) + "% MATCHRATE"
              //     ));
              //   }
              //
              //   p.skip += results.count;
              //   cb();
              // }).
              // catch(function(e){
              //   console.log(chalkError(MODULE_ID_PREFIX + " | ERROR: childSend FETCH_USER_TWEETS ERROR: " + e));
              //   return cb(err);
              // });

            }).
            catch(function(err){
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

        statsObj.fetchUserEndFlag = true;

        console.log(chalkBlueBold("TFE | ### END initCategorizedUserIdSet"
          + " | TOT CAT: " + statsObj.users.categorized.total
        ));

        resolve();
      }
    );

  });
}

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

let defaultConfiguration = {}; // general configuration for TFE
let hostConfiguration = {}; // host-specific configuration for TFE

configuration.slackChannel = {};

async function initConfig(cnf) {

  statsObj.status = "INIT CONFIG";

  console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

  if (debug.enabled) {
    console.log("\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
  cnf.testMode = (process.env.TEST_MODE == "true") ? true : cnf.testMode;
  cnf.quitOnError = process.env.QUIT_ON_ERROR || false;
  cnf.enableStdin = process.env.ENABLE_STDIN || true;

  if (process.env.QUIT_ON_COMPLETE == "false") { cnf.quitOnComplete = false; }
  else if ((process.env.QUIT_ON_COMPLETE == true) || (process.env.QUIT_ON_COMPLETE == "true")) {
    cnf.quitOnComplete = true;
  }

  try {

    await loadAllConfigFiles();
    await loadCommandLineArgs();

    const configArgs = Object.keys(configuration);

    for (const arg of configArgs){
      if (_.isObject(configuration[arg])) {
        console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
      }
      else {
        console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
      }
    }
    
    statsObj.commandLineArgsLoaded = true;

    if (configuration.enableStdin) { initStdIn(); }

    await initStatsUpdate();

    return configuration;

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
    throw err;
  }
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

  return new Promise(function(resolve, reject){

    try {

      console.log(chalkInfo(MODULE_ID_PREFIX + " | ... CONNECTING MONGO DB ..."));

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

        console.log(chalk.green(MODULE_ID_PREFIX + " | +++ MONGOOSE DEFAULT CONNECTION OPEN"));

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

            clearInterval(dbConnectionReadyInterval);
            statsObj.status = "MONGO DB CONNECTED";
            resolve(db);
          }

        }, 1000);
      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
      throw err;
    }
  });
}

async function showStats(options) {

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();

  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  statsObj.processUserElapsedMS = moment().valueOf() - processUserStartTimeMoment.valueOf();

  statsObj.users.mumProcessed = statsObj.users.processed + statsObj.users.fetchErrors;
  statsObj.users.numProcessRemaining = statsObj.users.categorized.total-statsObj.users.mumProcessed;

  statsObj.users.processRateMS = statsObj.processUserElapsedMS/statsObj.users.mumProcessed; // ms/userProcessed
  statsObj.users.processRateSec = statsObj.users.processRateMS/1000;

  statsObj.remainingTimeMs = statsObj.users.processRateMS * statsObj.users.numProcessRemaining;

  // await childStatsAll();

  statsObjSmall = pick(statsObj, statsPickArray);

  if (options) {
    console.log(MODULE_ID_PREFIX + " | STATS\n" + jsonPrint(statsObjSmall));
    return;
  }
  else {

    // for (const childId of Object.keys(childHashMap)) {

    //   console.log(chalkBlue(MODULE_ID_PREFIX + " | STATUS CHILD"
    //     + " | CHILD ID: " + childId + " | CH FSM: " + childHashMap[childId].status
    //   ));

    //   objectPath.set(statsObj, ["children", childId, "status"], childHashMap[childId].status);
    // }

    console.log(chalkBlue(MODULE_ID_PREFIX + " | RNT STATUS"
      + " | MRXQ: " + randomNetworkTreeMessageRxQueue.length
      + " | ANQ: " + statsObj.queues.activateNetworkQueue.size
      + " | HEAP: " + statsObj.randomNetworkTree.memoryUsage.heap.toFixed(3)
      + " | MAX HEAP: " + statsObj.randomNetworkTree.memoryUsage.maxHeap.toFixed(3)
    ));

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
      + " | UDUQ: " + userDbUpdateQueue.length 
      + " | PRCSSD/ERROR/REM/TOT: " + statsObj.users.processed 
      + "/" + statsObj.users.fetchErrors 
      + "/" + statsObj.users.numProcessRemaining 
      + "/" + statsObj.users.categorized.total 
      + " (" + statsObj.users.percentProcessed.toFixed(2) + "%)"
      + " | ETC (" + statsObj.users.processRateSec.toFixed(3) + " SPU): " + msToTime(statsObj.remainingTimeMs) 
      + " / " + moment().add(statsObj.remainingTimeMs).format(compactDateTimeFormat)
      + " | " + statsObj.users.categorized.manual + " MAN"
      + " | " + statsObj.users.categorized.auto + " AUTO"
      + " | " + statsObj.users.categorized.matched + " MATCH"
      + " / " + statsObj.users.categorized.mismatched + " MISMATCH"
      + " | " + statsObj.users.categorized.matchRate.toFixed(2) + "%"
    ));

    return;
  }
}

function initStatsUpdate() {

  return new Promise(function(resolve){

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT STATS UPDATE INTERVAL | " + msToTime(configuration.statsUpdateIntervalTime)));

    statsObj.elapsed = getElapsedTimeStamp();
    statsObj.timeStamp = getTimeStamp();

    clearInterval(statsUpdateInterval);

    statsUpdateInterval = setInterval(async function () {

      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      saveFileQueue.push({folder: statsFolder, file: statsFile, obj: statsObj});
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

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility", hostname);

const configDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const configHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const statsFolder = path.join(DROPBOX_ROOT_FOLDER, "stats", hostname);
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const defaultTrainingSetFolder = configDefaultFolder + "/trainingSets";

const globalBestNetworkFolder = path.join(DROPBOX_ROOT_FOLDER, "/config/utility/best/neuralNetworks");
const globalBestNetworkArchiveFolder = globalBestNetworkFolder + "/archive";
const bestNetworkFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/best/neuralNetworks");

configuration.neuralNetworkFolder = configDefaultFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

const defaultMaxInputHashmapFile = "maxInputHashMap.json";

const defaultInputsConfigFile = "default_networkInputsConfig.json";
const hostInputsConfigFile = hostname + "_networkInputsConfig.json";

function filesListFolder(params){
  return new Promise(function(resolve, reject) {

    fs.readdir(params.folder, function(err, items){
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
              path_display: path.join(params.folder, item)
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

async function loadConfigFile(params) {

  const fullPath = path.join(params.folder, params.file);

  try {

    if (configuration.offlineMode) {
      await loadCommandLineArgs();
      return;
    }

    const newConfiguration = {};
    newConfiguration.evolve = {};

    const loadedConfigObj = await tcUtils.loadFile({folder: params.folder, file: params.file, noErrorNotFound: params.noErrorNotFound });

    if (loadedConfigObj === undefined) {
      if (params.noErrorNotFound) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ... SKIP LOAD CONFIG FILE: " + params.folder + "/" + params.file));
        return newConfiguration;
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
        throw new Error("JSON UNDEFINED");
      }
    }

    if (loadedConfigObj instanceof Error) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD FILE ERROR: " + loadedConfigObj));
    }

    console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

    if (loadedConfigObj.TFE_TEST_MODE !== undefined) {
      console.log("TFE | LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE);
      if ((loadedConfigObj.TFE_TEST_MODE == true) || (loadedConfigObj.TFE_TEST_MODE == "true")) {
        newConfiguration.testMode = true;
      }
      if ((loadedConfigObj.TFE_TEST_MODE == false) || (loadedConfigObj.TFE_TEST_MODE == "false")) {
        newConfiguration.testMode = false;
      }
    }

    if (loadedConfigObj.TFE_NN_DB_LOAD_PER_INPUTS !== undefined) {
      console.log("TFE | LOADED TFE_NN_DB_LOAD_PER_INPUTS: " + loadedConfigObj.TFE_NN_DB_LOAD_PER_INPUTS);
      newConfiguration.networkDatabaseLoadPerInputsLimit = loadedConfigObj.TFE_NN_DB_LOAD_PER_INPUTS;
    }

    if (loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS !== undefined) {
      console.log("TFE | LOADED TFE_RANDOM_UNTESTED_NN_PER_INPUTS: " + loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS);
      newConfiguration.randomUntestedPerInputsLimit = loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS;
    }

    if (loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS !== undefined) {
      console.log("TFE | LOADED TFE_RANDOM_UNTESTED_NN_PER_INPUTS: " + loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS);
      newConfiguration.threeceeAutoFollowUser = loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS;
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

    if (loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE !== undefined) {
      console.log("TFE | LOADED TFE_BEST_NN_INCREMENTAL_UPDATE: " + loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE);
      newConfiguration.bestNetworkIncrementalUpdate = loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE;
    }

    if (loadedConfigObj.TFE_QUIT_ON_COMPLETE !== undefined) {
      console.log("TFE | LOADED TFE_QUIT_ON_COMPLETE: " + loadedConfigObj.TFE_QUIT_ON_COMPLETE);
      if ((loadedConfigObj.TFE_QUIT_ON_COMPLETE == true) || (loadedConfigObj.TFE_QUIT_ON_COMPLETE == "true")) {
        newConfiguration.quitOnComplete = true;
      }
      if ((loadedConfigObj.TFE_QUIT_ON_COMPLETE == false) || (loadedConfigObj.TFE_QUIT_ON_COMPLETE == "false")) {
        newConfiguration.quitOnComplete = false;
      }
    }

    if (loadedConfigObj.TFE_VERBOSE !== undefined) {
      console.log("TFE | LOADED TFE_VERBOSE: " + loadedConfigObj.TFE_VERBOSE);
      if ((loadedConfigObj.TFE_VERBOSE == true) || (loadedConfigObj.TFE_VERBOSE == "true")) {
        newConfiguration.verbose = true;
      }
      if ((loadedConfigObj.TFE_VERBOSE == false) || (loadedConfigObj.TFE_VERBOSE == "false")) {
        newConfiguration.verbose = false;
      }
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

    if (loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE !== undefined) {
      console.log("TFE | LOADED TFE_GLOBAL_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE);
      newConfiguration.globalMinSuccessRate = loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TFE_NUM_RANDOM_NETWORKS !== undefined) {
      console.log("TFE | LOADED TFE_NUM_RANDOM_NETWORKS: " + loadedConfigObj.TFE_NUM_RANDOM_NETWORKS);
      newConfiguration.numRandomNetworks = loadedConfigObj.TFE_NUM_RANDOM_NETWORKS;
    }

    if (loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS !== undefined) {
      console.log("TFE | LOADED TFE_ENABLE_LANG_ANALYSIS: " + loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS);
      newConfiguration.enableLanguageAnalysis = loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS;
    }

    if (loadedConfigObj.TFE_LANG_QUOTA_TIMEOUT_DURATION !== undefined) {
      console.log("TFE | LOADED TFE_LANG_QUOTA_TIMEOUT_DURATION: " + loadedConfigObj.TFE_LANG_QUOTA_TIMEOUT_DURATION);
      newConfiguration.languageQuotaTimoutDuration = loadedConfigObj.TFE_LANG_QUOTA_TIMEOUT_DURATION;
    }

    if (loadedConfigObj.TFE_FORCE_LANG_ANALYSIS !== undefined) {
      console.log("TFE | LOADED TFE_FORCE_LANG_ANALYSIS: " + loadedConfigObj.TFE_FORCE_LANG_ANALYSIS);
      newConfiguration.forceLanguageAnalysis = loadedConfigObj.TFE_FORCE_LANG_ANALYSIS;
    }

    if (loadedConfigObj.TFE_ENABLE_GEOCODE !== undefined) {
      console.log("TFE | LOADED TFE_ENABLE_GEOCODE: " + loadedConfigObj.TFE_ENABLE_GEOCODE);
      newConfiguration.enableGeoCode = loadedConfigObj.TFE_ENABLE_GEOCODE;
    }

    if (loadedConfigObj.TFE_FORCE_GEOCODE !== undefined) {
      console.log("TFE | LOADED TFE_FORCE_GEOCODE: " + loadedConfigObj.TFE_FORCE_GEOCODE);
      newConfiguration.forceGeoCode = loadedConfigObj.TFE_FORCE_GEOCODE;
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

    return newConfiguration;
  }
  catch(err){
    console.error(chalkError(MODULE_ID_PREFIX + " | ERROR LOAD CONFIG: " + fullPath
      + "\n" + jsonPrint(err)
    ));
    throw err;
  }
}

async function loadAllConfigFiles(){

  statsObj.status = "LOAD CONFIG";

  const defaultConfig = await loadConfigFile({folder: configDefaultFolder, file: configDefaultFile});

  if (defaultConfig) {
    defaultConfiguration = defaultConfig;
    console.log(chalkInfo(MODULE_ID_PREFIX + " | <<< LOADED DEFAULT CONFIG " + configDefaultFolder + "/" + configDefaultFile));
  }
  
  const hostConfig = await loadConfigFile({folder: configHostFolder, file: configHostFile, noErrorNotFound: true});

  if (hostConfig) {
    hostConfiguration = hostConfig;
    console.log(chalkInfo(MODULE_ID_PREFIX + " | <<< LOADED HOST CONFIG " + configHostFolder + "/" + configHostFile));
  }

  await loadInputs({folder: configDefaultFolder, file: defaultInputsConfigFile, noErrorNotFound: false});
  await loadInputs({folder: configHostFolder, file: hostInputsConfigFile, noErrorNotFound: true});
  
  const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
  const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

  configuration = deepcopy(tempConfig);

  configuration.twitterUsers = _.uniq(configuration.twitterUsers);

  return;
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

function initSaveFileQueue(cnf) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT SAVE FILE INTERVAL | " + msToTime(cnf.saveFileQueueInterval)));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(async function () {

    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {

      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();
      saveFileObj.verbose = true;

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try{
        await tcUtils.saveFile(saveFileObj);
        console.log(chalkLog(
          MODULE_ID_PREFIX 
          + " | SAVED FILE"
          + " [Q: " + saveFileQueue.length + "] " 
          + " [$: " + saveCache.getStats().keys + "] " 
          + saveFileObj.folder + "/" + saveFileObj.file
        ));
        statsObj.queues.saveFileQueue.busy = false;
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX 
          + " | *** SAVE FILE ERROR ... RETRY"
          + " | ERROR: " + err
          + " | " + saveFileObj.folder + "/" + saveFileObj.file
        ));
        saveFileQueue.push(saveFileObj);
        statsObj.queues.saveFileQueue.size = saveFileQueue.length;
        statsObj.queues.saveFileQueue.busy = false;
      }

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
      for (const intervalHandle of intervalsSet){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | CLEAR INTERVAL | " + intervalHandle));
        clearInterval(intervalHandle);
      }
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
  const flag = ((saveCache.getStats().keys == 0) && (saveFileQueue.length == 0));
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


  fsm.fsm_quit();

  try{
    if (!configuration.offlineMode) { await slackSendWebMessage({channel: slackChannel, text: slackText}); }
    // await childQuitAll();
    await showStats(true);
  }
  catch(err){
    console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
  }


  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  clearInterval(quitWaitInterval);

  await clearAllIntervals();

  // intervalsSet.add("quitWaitInterval");

  quitWaitInterval = setInterval(async function() {

    if (readyToQuit()) {

      clearInterval(quitWaitInterval);

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
          + " | SAVE CACHE KEYS: " + saveCache.getStats().keys
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }
      else {
        console.log(chalkGreen(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE | QUITTING"
          + " | SAVE CACHE KEYS: " + saveCache.getStats().keys
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }

      // const command = 'pkill ' + configuration.childIdPrefix + '*';

      // shell.exec(command, function(code, stdout, stderr){

      //   console.log(chalkAlert(MODULE_ID_PREFIX + " | KILL ALL CHILD"
      //     + "\nCOMMAND: " + command
      //     + "\nCODE:    " + code
      //     + "\nSTDOUT:  " + stdout
      //     + "\nSTDERR:  " + stderr
      //   ));

      //   shell.cd(childPidFolderLocal);
      //   shell.rm(configuration.childIdPrefix + "*");
      // });

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
const offlineMode = { name: "offlineMode", alias: "O", type: Boolean};

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
  // maxNumberChildren,
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
  offlineMode,
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

      if (arg == "evolveIterations"){
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

  // const command = {};
  // command.op = "VERBOSE";
  // command.verbose = configuration.verbose;

  // childSendAll({command: command}).
  // then(function(){

  // }).
  // catch(function(err){
  //   console.log(chalkError(MODULE_ID_PREFIX + " | *** ERROR VERBOSE: " + err));
  // });
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
          await showStats((key == "S"));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
        }
      break;

      case "V":
        toggleVerbose();
      break;

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
  else {
    return false;
  }
}

async function loadNetworkFile(params){

  const folder = params.folder;
  const entry = params.entry;

  const networkObj = await tcUtils.loadFileRetry({folder: folder, file: entry.name});

  if (!networkObj || networkObj=== undefined) {
    console.log(chalkError("NO BEST NN FOUND? | " + folder + "/" + entry.name));
    return;
  }

  if (!inputsIdSet.has(networkObj.inputsId)){
    console.log(chalkLog("TFE | LOAD BEST NN HM INPUTS ID MISS ... SKIP HM ADD"
      + " | IN: " + networkObj.numInputs
      + " | " + networkObj.networkId 
      + " | INPUTS ID: " + networkObj.inputsId 
    ));

    if (configuration.archiveNetworkOnInputsMiss && !networkObj.archived) {

      console.log(chalkLog("TFE | ARCHIVE NN ON INPUTS ID MISS"
        + " | IN: " + networkObj.numInputs
        + " | " + networkObj.networkId 
        + " | INPUTS ID: " + networkObj.inputsId 
        + "\nTFE | FROM: " + folder + "/" + entry.name
        + " | TO: " + globalBestNetworkArchiveFolder
      ));

      try{

        await renameFileAsync(path.join(folder, entry.name), path.join(globalBestNetworkArchiveFolder, entry.name));

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
        console.log(chalkError(MODULE_ID_PREFIX + " | *** RENAME ERROR: " + err
          + " | " + path.join(folder, entry.name)
        ));
      }
    }
  }
  else if (isBestNetwork({networkObj: networkObj}) && !bestNetworkHashMap.has(networkObj.networkId)){

    bestNetworkHashMap.set(networkObj.networkId, networkObj);

    printNetworkObj(
      MODULE_ID_PREFIX 
        + " | +++ NN"
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
        + " | ... NN"
        + " [" + bestNetworkHashMap.size + " HM]"
        + " [" + skipLoadNetworkSet.size + " SKIPPED]",
      networkObj,
      chalk.gray
    );
  }

  const updateDbNetworkParams = {};

  updateDbNetworkParams.networkObj = networkObj;
  updateDbNetworkParams.incrementTestCycles = false;
  updateDbNetworkParams.addToTestHistory = false;
  updateDbNetworkParams.verbose = configuration.verbose;

  if (skipLoadNetworkSet.has(networkObj.networkId) && !networkObj.archived) {

    console.log(chalk.black.bold(
      MODULE_ID_PREFIX 
        + " | vvv ARCHIVE NN"
        + " | " + folder + "/" + entry.name
        + " > " + globalBestNetworkArchiveFolder
    ));

    await renameFileAsync(path.join(folder, entry.name), path.join(globalBestNetworkArchiveFolder, entry.name));

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

        await unlinkFileAsync(deletePath);
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ... NN ALREADY ARCHIVED | DELETED: " + deletePath));
        return;

      }
    }
  }
}

async function loadBestNetworksFolder(params) {

  console.log(chalkLog("TFE | LOAD BEST NETWORKS FOLDER"));

  statsObj.status = "LOAD BEST NNs FOLDER";

  const folder = params.folder;

  console.log(chalkInfo("TFE | LOADING FOLDER BEST NETWORKS | " + folder));

  const results = await filesListFolder({folder: folder});

  if ((results === undefined) || !results) {
    console.log(chalkError("TFE | FOLDER LIST FOLDER ERROR | RESULT UNDEFINED ??? "));
    throw new Error("FOLDER LOAD LIST FOLDER ERROR | RESULT UNDEFINED");
  }

  let resultsArray = [];

  if (configuration.testMode) {
    resultsArray = _.sampleSize(results.entries, TEST_MODE_NUM_NN);
  }
  else {
    resultsArray = results.entries;
  }

  console.log(chalkInfo("TFE | ENTRIES: " + resultsArray.length));

  const loadNetworkFilePromiseArray = [];

  for (const entry of resultsArray){
    if (!entry.name.endsWith(".json") || entry.name.startsWith("bestRuntimeNetwork")) {
      console.log(chalkWarn("TFE | ... SKIP LOAD FOLDER BEST NETWORKS | " + folder + "/" + entry.name));
    }
    else{
      loadNetworkFilePromiseArray.push(loadNetworkFile({folder: folder, entry: entry}));
    }
  }

  await Promise.all(loadNetworkFilePromiseArray)
  .then(function(){
    console.log(chalkGreen("TFE | +++ LOAD FOLDER BEST NETWORKS COMPLETE | " + folder));
    return;
  });
}

async function loadBestNetworksDatabase(p) {

  const params = p || {};

  const minTestCycles = (params.minTestCycles !== undefined) ? params.minTestCycles : configuration.minTestCycles;
  const globalMinSuccessRate = params.globalMinSuccessRate || configuration.globalMinSuccessRate;
  const randomUntestedPerInputsLimit = params.randomUntestedPerInputsLimit || configuration.randomUntestedPerInputsLimit;
  const networkDatabaseLoadPerInputsLimit = params.networkDatabaseLoadPerInputsLimit || configuration.networkDatabaseLoadPerInputsLimit;

  console.log(chalkBlue("TFE | ... LOADING BEST NETWORKS DATABASE"
    + " | GLOBAL MIN SUCCESS RATE: " + globalMinSuccessRate.toFixed(2) + "%"
    + " | MIN TEST CYCs: " + minTestCycles
    + " | PER INPUTS LIMIT: " + networkDatabaseLoadPerInputsLimit
    + " | PER RANDOM UNTESTED LIMIT: " + randomUntestedPerInputsLimit
  ));

  statsObj.status = "LOAD BEST NNs DATABASE";
  
  statsObj.newBestNetwork = false;
  statsObj.numNetworksLoaded = 0;

  const inputsIdArray = [...inputsIdSet];

  if (configuration.verbose) { console.log(chalkLog("inputsIdArray\n" + jsonPrint(inputsIdArray))); }

  let nnArray = [];

  for (const inputsId of inputsIdArray) {

    console.log(chalkLog(MODULE_ID_PREFIX
      + " | ... LOADING NN FROM DB | INPUTS ID: " + inputsId
    ));

    let query = {};
    query.inputsId = inputsId;

    if (minTestCycles) {
      query = {};
      query.$and = [
        { inputsId: inputsId },
        { overallMatchRate: { "$gte": globalMinSuccessRate } },
        { testCycles: { "$gte": minTestCycles } }
      ];
    }

    const randomUntestedQuery = {};
    randomUntestedQuery.$and = [
      { inputsId: inputsId },
      { successRate: { "$gte": globalMinSuccessRate } },
      { testCycles: { "$lt": minTestCycles } }
    ];

    if (configuration.verbose) { console.log(chalkLog("query\n" + jsonPrint(query))); }

    let nnArrayTopOverallMatchRate = [];
    let nnArrayRandomUntested = [];

    console.log(chalkBlue("TFE | ... LOADING " + networkDatabaseLoadPerInputsLimit + " BEST NNs PER INPUTS ID (by OAMR) FROM DB ..."));

    nnArrayTopOverallMatchRate = await global.globalNeuralNetwork.find(query)
    .lean()
    .sort({"overallMatchRate": -1})
    .limit(networkDatabaseLoadPerInputsLimit)
    .exec();

    console.log(chalkBlue("TFE | FOUND " + nnArrayTopOverallMatchRate.length + " BEST NNs PER INPUTS ID (by OAMR) FROM DB ..."));

    console.log(chalkBlue("TFE | LOADING " + randomUntestedPerInputsLimit + " UNTESTED NNs FROM DB ..."));

    nnArrayRandomUntested = await global.globalNeuralNetwork.find(randomUntestedQuery)
    .lean()
    .sort({"overallMatchRate": -1})
    .limit(randomUntestedPerInputsLimit)
    .exec();

    console.log(chalkBlue("TFE | FOUND " + nnArrayRandomUntested.length + " UNTESTED NNs FROM DB ..."));

    nnArray = _.concat(nnArray, nnArrayTopOverallMatchRate, nnArrayRandomUntested);
  }

  if (nnArray.length == 0){
    console.log(chalkAlert("TFE | ??? NO NEURAL NETWORKS NOT FOUND IN DATABASE"
      // + "\nQUERY\n" + jsonPrint(query)
      // + "\nRANDOM QUERY\n" + jsonPrint(randomUntestedQuery)
    ));

    console.log(chalkAlert("TFE | RETRY NEURAL NN DB SEARCH"
      // + "\nQUERY\n" + jsonPrint(query)
      // + "\nRANDOM QUERY\n" + jsonPrint(randomUntestedQuery)
    ));
    return false;
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
    + " | INPUT ID: " + bestNetwork.inputsId
    + " | INs: " + bestNetwork.numInputs
    + " | SR: " + bestNetwork.successRate.toFixed(2) + "%"
    + " | MR: " + bestNetwork.matchRate.toFixed(2) + "%"
    + " | OAMR: " + bestNetwork.overallMatchRate.toFixed(2) + "%"
    + " | TCs: " + bestNetwork.testCycles
    + " | TCH: " + bestNetwork.testCycleHistory.length
  ));

  async.eachSeries(nnArray, function(networkObj, cb){

    bestNetworkHashMap.set(networkObj.networkId, networkObj);

    console.log(chalkInfo("TFE | ADD NN --> HM"
      + " | " + networkObj.networkId
      + " | INPUT ID: " + networkObj.inputsId
      + " | INs: " + networkObj.numInputs
      + " | SR: " + networkObj.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
      + " | OAMR: " + networkObj.overallMatchRate.toFixed(2) + "%"
      + " | TCs: " + networkObj.testCycles
      + " | TCH: " + networkObj.testCycleHistory.length
    ));

    cb();

  }, function(err){
    if (err) {
      throw err;
    }

    console.log(chalk.bold.blue("TFE | NN HASHMAP: " + bestNetworkHashMap.size));
 
    return bestNetwork;
  });
}

async function loadBestNeuralNetworks() {

  statsObj.status = "LOAD BEST NN";

  console.log(chalkLog("TFE | LOADING NEURAL NETWORKS"
    + " | FOLDER: " + bestNetworkFolder
  ));

  try {
    await loadBestNetworksFolder({folder: bestNetworkFolder});
    await loadBestNetworksDatabase();
    return;
  }
  catch(err){
    console.log(chalkError("TFE | *** LOAD BEST NETWORKS ERROR: " + err));
    throw err;
  }
}

async function loadMaxInput(params) {

  statsObj.status = "LOAD MAX INPUT + NORMALIZATION";

  const folder = params.folder;
  const file = params.file;

  console.log(chalkNetwork("TFE | LOADING DROPBOX MAX INPUT HASHMAP + NORMALIZATION | " + folder + "/" + file));

  try {

    const maxInputHashMapObj = await tcUtils.loadFile({folder: folder, file: file, loadLocalFile: true});

    if ((maxInputHashMapObj === undefined) || !maxInputHashMapObj) {
      console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED ??? "));
      return new Error("DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED");
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

    return;
  }
  catch(err){
    console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR: " + err));
    throw err;
  }
}

const watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
}

async function initWatchConfig(){

  statsObj.status = "INIT WATCH CONFIG";

  console.log(chalkLog(MODULE_ID_PREFIX + " | ... INIT WATCH"));

  const loadConfig = async function(f){

    try{

      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f));

      if (f.endsWith("twitterFollowerExplorerConfig.json")){

        await loadAllConfigFiles();

        const configArgs = Object.keys(configuration);

        for (const arg of configArgs){
          if (_.isObject(configuration[arg])) {
            console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
          }
          else {
            console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
          }
        }
      }

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD ALL CONFIGS ON CREATE ERROR: " + err));
    }
  }

  watch.createMonitor(configDefaultFolder, watchOptions, function (monitor) {

    monitor.on("created", loadConfig);

    monitor.on("changed", loadConfig);

    monitor.on("removed", function (f) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });
  });

  watch.createMonitor(configHostFolder, watchOptions, function (monitor) {

    monitor.on("created", loadConfig);

    monitor.on("changed", loadConfig);

    monitor.on("removed", function (f) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });
  });

  return;
}

function initRandomNetworks(){

  statsObj.status = "INIT RAN NNs";

  return new Promise(function(resolve, reject){

    console.log(chalkGreen("TFE | INIT RANDOM NETWORKS"));

    statsObj.loadedNetworksFlag = false;

    if (randomNetworkTree && (randomNetworkTree !== undefined)) {

      let isBestNetworkFlag = false;

      async.eachSeries(bestNetworkHashMap.values(), function(networkObj, cb){

        if (networkObj.networkId == bestNetwork.networkId) {
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
          console.log(chalkError("TFE | *** SEND NN > RNT ERROR: " + err));
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

async function initMaxInputHashMap(){

  statsObj.status = "INIT MAX INPUT HASHMAP";

  if (randomNetworkTree && (randomNetworkTree !== undefined)) {

    try{
      await randomNetworkTree.send({ op: "LOAD_MAX_INPUTS_HASHMAP", maxInputHashMap: maxInputHashMap });
      console.log(chalkBlue("TFE | SENT MAX INPUTS HASHMAP > RNT"));

      await randomNetworkTree.send({ op: "LOAD_NORMALIZATION", normalization: normalization });
      console.log(chalkBlue("TFE | SENT NORMALIZATION > RNT"));

      return;
    }
    catch(err){
      console.log(chalkError("TFE | INIT MAX INPUT HASHMAP ERROR: " + err));
      throw err;
    }
   
  }
  else {
    console.log(chalkError("TFE | *** INIT MAX INPUT HASHMAP ERROR: RNT NOT INITIALIZED *** "));
    return new Error("RNT NOT INITIALIZED");
  }
}

async function initNetworks(){

  statsObj.status = "INIT NNs";

  console.log(chalkTwitter("TFE | INIT NETWORKS"));

  await Promise.all([
    loadBestNeuralNetworks(),
    loadMaxInput({folder: defaultTrainingSetFolder, file: defaultMaxInputHashmapFile})
  ])
  .then(async function(){

    console.log(chalkAlert("TFE | +++ NETWORKS INITIALIZED"));

    await initMaxInputHashMap();
    console.log(chalkGreen("TFE | +++ LOAD BEST NETWORKS COMPLETE"));
    return;
  });
}

function saveNetworkHashMap(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "SAVE NN HASHMAP";

    const folder = (params.folder === undefined) ? bestNetworkFolder : params.folder;

    const nnIds = bestNetworkHashMap.keys();

    console.log(chalkNetwork("TFE | UPDATING NNs IN FOLDER " + folder));

    async.eachSeries(nnIds, function(nnId, cb) {

      const networkObj = bestNetworkHashMap.get(nnId);

      printNetworkObj("TFE | SAVING NN", networkObj);

      statsObj.status = "SAVE NN HASHMAP | SAVE Q: " + saveFileQueue.length;

      const file = nnId + ".json";

      if (params.saveImmediate) {
        saveFileQueue.push({folder: folder, file: file, obj: networkObj});
        debug(chalkNetwork("SAVING NN (Q)"
          + " | " + networkObj.networkId
        ));
        cb();
      }
      else {
        saveCache.set(file, {folder: folder, file: file, obj: networkObj});
        debug(chalkNetwork("SAVING NN ($)"
          + " | " + networkObj.networkId
        ));
        cb();
      }

    }, function(err) {
      if (err) { return reject(err); }
      console.log(chalkBlueBold(MODULE_ID_PREFIX + " | +++ saveNetworkHashMap COMPLETE"));
      resolve();
    });

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
    const minTestCycles = params.minTestCycles || configuration.minTestCycles;

    const nnIds = Object.keys(params.networkStatsObj);

    console.log(chalkTwitter("TFE | UPDATE NN STATS"
      + " | " + nnIds.length + " | NETWORKS"
      + " | UPDATE OAMR: " + updateOverallMatchRate
      + " | UPDATE DB: " + updateDb
      + " | INC TEST CYCs: " + incrementTestCycles
      + " | ADD TEST HISTORY: " + addToTestHistory
    ));

    async.eachSeries(nnIds, function(nnId, cb) {

      if (bestNetworkHashMap.has(nnId)) {

        const networkObj = bestNetworkHashMap.get(nnId);

        networkObj.incrementTestCycles = incrementTestCycles;
        networkObj.rank = params.networkStatsObj[nnId].rank;
        networkObj.matchRate = params.networkStatsObj[nnId].matchRate;
        networkObj.overallMatchRate = (updateOverallMatchRate) ? params.networkStatsObj[nnId].matchRate : params.networkStatsObj[nnId].overallMatchRate;

        const testHistoryItem = {
          testCycle: networkObj.testCycles,
          match: params.networkStatsObj[nnId].meta.match,
          mismatch: params.networkStatsObj[nnId].meta.mismatch,
          total: params.networkStatsObj[nnId].meta.total,
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

        updateDbNetwork(updateDbNetworkParams)
        .then(function(nnDbUpdated){
          bestNetworkHashMap.set(nnDbUpdated.networkId, nnDbUpdated);
          cb();
        })
        .catch(function(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** updateDbNetwork ERROR: " + err));
          return cb(err);
        });

      }
      else {
        console.log(chalkAlert("TFE | ??? NN NOT IN BEST NN HASHMAP ???"
          + " | NNID: " + nnId
        ));
        cb();
      }
    }, async function(err) {

      if (err) {
        console.log(chalkError("TFE | *** UPDATE NN STATS ERROR: " + err));
        return reject(err);
      }

      const bestInputsConfigObj = {};

      try{

        const query = {};

        const inputsIdArray = [...inputsIdSet];

        query.$and = [
          { inputsId: { "$in": inputsIdArray } },
          { testCycles: { "$gte": minTestCycles } }
        ]

        let chalkVal = chalkLog;

        const networkObjArray = await global.globalNeuralNetwork.
          find(query).
          lean().
          sort({"overallMatchRate": -1}).
          limit(50).
          select({ overallMatchRate: 1, successRate: 1, networkId: 1, inputsId: 1 }).
          exec();

        for (const networkObj of networkObjArray){
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
        }

        console.log(chalkInfo("TFE | BEST INPUTS SET: " + bestInputsSet.size + "\n" + jsonPrint([...bestInputsSet])));

        bestInputsConfigObj.INPUTS_IDS = [];
        bestInputsConfigObj.INPUTS_IDS = [...bestInputsSet];


        let folder = configDefaultFolder;
        let file = defaultBestInputsConfigFile;

        if (hostname != "google") {
          folder = configHostFolder;
          file = hostBestInputsConfigFile;
        }

        saveFileQueue.push({folder: folder, file: file, obj: bestInputsConfigObj});

        await saveNetworkHashMap({folder: bestNetworkFolder, saveImmediate: saveImmediate, updateDb: updateDb});
        console.log(chalkBlueBold(MODULE_ID_PREFIX + " | +++ updateNetworkStats COMPLETE"));
        resolve();

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
    statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;
    statsObj.queues.activateNetworkQueue.busy = false;

    console.log(chalkLog("TFE | INIT RANDOM NN TREE QUEUE INTERVAL: " + interval + " ms"));

    activateNetworkQueueInterval = setInterval(function () {

      if (randomNetworkTreeReadyFlag && !statsObj.queues.activateNetworkQueue.busy && (activateNetworkQueue.length > 0)) {

        statsObj.queues.activateNetworkQueue.busy = true;

        const activateNetworkObj = activateNetworkQueue.shift();

        statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

        if (!activateNetworkObj.user.profileHistograms || (activateNetworkObj.user.profileHistograms === undefined)) {
          console.log(chalkWarn("TFE | ACTIVATE | !!! UNDEFINED USER PROFILE HISTOGRAMS | @" + activateNetworkObj.user.screenName));
          activateNetworkObj.user.profileHistograms = {};
        }

        if (!activateNetworkObj.user.tweetHistograms || (activateNetworkObj.user.tweetHistograms === undefined)) {
          console.log(chalkWarn("TFE | ACTIVATE | !!! UNDEFINED USER TWEET HISTOGRAMS | @" + activateNetworkObj.user.screenName));
          activateNetworkObj.user.tweetHistograms = {};
        }

        if (!activateNetworkObj.user.friends || (activateNetworkObj.user.friends === undefined)) {
          console.log(chalkWarn("TFE | ACTIVATE | !!! UNDEFINED USER FRIENDS | @" + activateNetworkObj.user.screenName));
          activateNetworkObj.user.friends = [];
        }

        const mObj = {op: "ACTIVATE", obj: activateNetworkObj};

        randomNetworkTree.send(mObj, function(){
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

  return new Promise(function(resolve){

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

    for (const key of runEnableKeys){
      if (displayArgs) { console.log(chalkInfo("TFE | runEnable | " + key + ": " + runEnableArgs[key])); }
      if (!runEnableArgs[key]) {
        if (displayArgs) { console.log(chalkInfo("TFE | ------ runEnable ------")); }
        resolve(false);
      }
    }

    if (displayArgs) { console.log(chalkInfo("TFE | ------ runEnable ------")); }
    resolve(true);

  });
}

function updateBestNetworkStats(params) {

  return new Promise(function(resolve){

    const networkObj = params.networkObj;

    statsObj.status = "UPDATE BEST NN STATS";

    if (statsObj.bestNetwork === undefined) { statsObj.bestNetwork = {}; }

    statsObj.bestRuntimeNetworkId = networkObj.networkId;
    statsObj.currentBestNetworkId = networkObj.networkId;

    statsObj.bestNetwork.networkId = networkObj.networkId;
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
    console.log(chalkNetwork("TFE | SAVING NEW BEST NN"
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

async function processRandomNetworkTreeMessage(params){

  const m = params.message;

  let user = {};
  let prevBesTFEObj = {};
  let fileObj = {};
  let file;

  statsObj.randomNetworkTreeOp = m.op;

  switch (m.op) {
    case "IDLE":
      randomNetworkTreeReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      await runEnable();
      console.log(chalkLog("TFE | RNT IDLE "));
      return;

    case "ERROR":
      if (m.errorType == "ACTIVATE_ERROR") {
        console.log(chalkAlert("TFE | RNT | *** ACTIVATE_ERROR: " + m.error));
        return;     
      }
      console.log(chalkError("TFE | RNT | *** ERROR: " + m.error));
      quit();
    break;

    case "STATS":

      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;

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

        if (!bestNetworkHashMap.has(statsObj.currentBestNetworkId)){
          console.log(chalkAlert(MODULE_ID_PREFIX + " | *** NN NOT IN BEST NETWORK HASHMAP: " + statsObj.currentBestNetworkId));
          return;
        }

        currentBestNetwork = bestNetworkHashMap.get(statsObj.currentBestNetworkId);

        if ((hostname == PRIMARY_HOST) || configuration.testMode) {

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

          console.log(chalkBlue("TFE | SAVING BEST NN"
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

        tcUtils.emitter.emit("allNetworksUpdated");
        return;

      }
      catch(err){
        console.log(chalkError("TFE | *** UPDATE NN STATS ERROR: " + err));
        randomNetworkTreeMessageRxQueueReadyFlag = true;
        throw err;
      }

    case "NETWORK_READY":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      randomNetworkTreeReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      debug(chalkInfo("RNT NETWORK_READY ..."));
      await runEnable();
      return;

    case "NETWORK_BUSY":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      randomNetworkTreeReadyFlag = false;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = true;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      debug(chalkInfo("RNT NETWORK_BUSY ..."));
      return;

    case "QUEUE_STATS":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      return;

    case "QUEUE_READY":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      randomNetworkTreeReadyFlag = true;
      debug(chalkInfo("RNT Q READY"));
      await runEnable();
      return;

    case "QUEUE_EMPTY":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      randomNetworkTreeReadyFlag = true;
      debug(chalkInfo("RNT Q EMPTY"));
      await runEnable();
      return;

    case "QUEUE_FULL":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = "QUEUE_FULL";
      randomNetworkTreeReadyFlag = false;
      console.log(chalkError("TFE | *** RNT Q FULL"));
      return;

    case "RNT_TEST_PASS":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      randomNetworkTreeReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      console.log(chalkTwitter("TFE | " + getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
      await runEnable();
      return;

    case "RNT_TEST_FAIL":
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      randomNetworkTreeReadyFlag = false;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;
      console.log(chalkAlert("TFE | " + getTimeStamp() + " | RNT_TEST_FAIL"));
      quit({source: "RNT", error: "RNT_TEST_FAIL"});
      return;

    case "NETWORK_OUTPUT":

      try{
        statsObj.queues.randomNetworkTreeActivateQueue.size = m.queue;

        statsObj.randomNetworkTree.memoryUsage = m.memoryUsage;

        debug(chalkAlert("RNT NETWORK_OUTPUT\n" + jsonPrint(m.output)));
        debug(chalkAlert("RNT NETWORK_OUTPUT | " + m.currentBestNetwork.networkId));

        if (m.currentBestNetwork === undefined 
          || !m.currentBestNetwork 
          || !m.currentBestNetwork.networkId 
          || m.currentBestNetwork === undefined
        ) {
          console.log(chalkError("TFE | *** NETWORK_OUTPUT BEST NN NOT DEFINED\n" + jsonPrint(m.currentBestNetwork)));
          return;
        }

        statsObj.currentBestNetworkId = m.currentBestNetwork.networkId;

        if (bestNetworkHashMap.has(statsObj.currentBestNetworkId)) {

          currentBestNetwork = bestNetworkHashMap.get(statsObj.currentBestNetworkId);

          if ((m.currentBestNetwork.matchRate > currentBestNetwork.matchRate) 
            && (currentBestNetwork.networkId != m.currentBestNetwork.networkId)){
            printNetworkObj(MODULE_ID_PREFIX + " | +++ NEW CURRENT BEST NN", currentBestNetwork, chalkGreen);
          }

          currentBestNetwork.matchRate = m.currentBestNetwork.matchRate;
          currentBestNetwork.overallMatchRate = m.currentBestNetwork.overallMatchRate;
          currentBestNetwork.successRate = m.currentBestNetwork.successRate;

          await updateBestNetworkStats({networkObj: currentBestNetwork});
        
          bestNetworkHashMap.set(statsObj.currentBestNetworkId, currentBestNetwork);

          if ((hostname == PRIMARY_HOST) 
            && (statsObj.prevBestNetworkId != statsObj.currentBestNetworkId) 
            && configuration.bestNetworkIncrementalUpdate) 
          {
            statsObj.prevBestNetworkId = statsObj.currentBestNetworkId;
            saveBestNetworkFileCache({network: m.currentBestNetwork});
          }

          debug(chalkAlert("NETWORK_OUTPUT"
            + " | " + moment().format(compactDateTimeFormat)
            + " | " + m.currentBestNetwork.networkId
            + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
            + " | MR: " + m.currentBestNetwork.matchRate.toFixed(2) + "%"
            + " | OAMR: " + m.currentBestNetwork.overallMatchRate.toFixed(2) + "%"
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
            + " | BEST RT NN ID: " + statsObj.currentBestNetworkId
            + " | BEST NN ID: " + m.currentBestNetwork.networkId
            + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
            + " | MR: " + m.currentBestNetwork.matchRate.toFixed(2) + "%"
            + " | OAMR: " + m.currentBestNetwork.overallMatchRate.toFixed(2) + "%"
            + " | TC: " + m.currentBestNetwork.testCycles
            // + " | TCH: " + m.currentBestNetwork.testCycleHistory.length
            + " | @" + m.user.screenName
            + " | C: " + m.user.category
            + " | CA: " + m.categoryAuto
          ));
        }

        statsObj.users.processed += 1;
        statsObj.users.percentProcessed = 100*(statsObj.users.processed+statsObj.users.fetchErrors)/statsObj.users.categorized.total;

        if (statsObj.users.processed % 100 == 0) { showStats(); }

        randomNetworkTreeMessageRxQueueReadyFlag = true;
        statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
        await runEnable();
        return;
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX
          + " | *** ERROR update best network stats: " + err
        ));
        throw err;
      }

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

        if ((hostname == PRIMARY_HOST)
          && configuration.bestNetworkIncrementalUpdate
          && (statsObj.prevBestNetworkId != m.networkId)) {

          statsObj.prevBestNetworkId = m.networkId;

          console.log(chalkBlue("TFE | SAVING NEW BEST NN"
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
        console.log("TFE | " + chalkError(getTimeStamp() + "??? | RNT_BEST_MATCH_RATE | NN NOT IN BEST NN HASHMAP?"
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

        if (hostname == PRIMARY_HOST) {

          console.log(chalkBlue("TFE | SAVING PREV BEST NN"
            + " | MR: " + m.previousBestMatchRate.toFixed(2) + "%"
            + " | " + m.previousBestNetworkId + ".json"
          ));

          file = m.previousBestNetworkId + ".json";
          saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: prevBesTFEObj });
        }
      }

      randomNetworkTreeMessageRxQueueReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      await runEnable();
      return;

    default:
      randomNetworkTreeMessageRxQueueReadyFlag = true;
      statsObj.queues.randomNetworkTreeActivateQueue.busy = false;
      console.log(chalkError("TFE | *** UNKNOWN RNT OP | " + m.op));
      return;
  }
}

function initRandomNetworkTreeMessageRxQueueInterval(interval) {

  return new Promise(function(resolve){

    statsObj.status = "INIT RNT INTERVAL";

    clearInterval(randomNetworkTreeMessageRxQueueInterval);

    randomNetworkTreeMessageRxQueueReadyFlag = true;

    console.log(chalkLog("TFE | INIT RANDOM NN TREE QUEUE INTERVAL: " + interval + " ms"));

    randomNetworkTreeMessageRxQueueInterval = setInterval(async function () {

      if (randomNetworkTreeMessageRxQueueReadyFlag && (randomNetworkTreeMessageRxQueue.length > 0)) {

        randomNetworkTreeMessageRxQueueReadyFlag = false;

        const m = randomNetworkTreeMessageRxQueue.shift();

        await processRandomNetworkTreeMessage({message: m});

        randomNetworkTreeMessageRxQueueReadyFlag = true;
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

    intervalsSet.add("userDbUpdateQueueInterval");

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

          statsObj.users.dbUpdated += 1;

          if (configuration.verbose || configuration.testMode || (statsObj.users.dbUpdated % 100 == 0)){
            console.log(chalkInfo("TFE | USER UPDATE"
              + " [UDUQ: " + userDbUpdateQueue.length + "]"
              + " [" + statsObj.users.dbUpdated + " UPDATED]"
              + " | " + updatedUserObj.nodeId
              + " | LANG ANZD: " + updatedUserObj.languageAnalyzed
              + " | C: " + updatedUserObj.category
              + " | CA: " + updatedUserObj.categoryAuto
              + " | @" + updatedUserObj.screenName
              + " | Ts: " + updatedUserObj.statusesCount
              + " | FLWRs: " + updatedUserObj.followersCount
              + " | FRNDs: " + updatedUserObj.friendsCount
            ));
          }

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

      randomNetworkTreeReadyFlag = false;

      console.log(chalkBlue("TFE | INIT RANDOM NN TREE CHILD PROCESS"));

      randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`, { execArgv: ['--max-old-space-size=32768'] });

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

function processTweetObj(params){

  return new Promise(function(resolve, reject){

    const tweetObj = params.tweetObj;
    const histograms = params.histograms || {};

    async.eachSeries(DEFAULT_INPUT_TYPES, function(entityType, cb0){

      if (!entityType || entityType === undefined) {
        console.log(chalkAlert("TFE | ??? UNDEFINED TWEET entityType: ", entityType));
        return cb0();
      }

      if (entityType == "user") { return cb0(); }
      if (!tweetObj[entityType] || tweetObj[entityType] === undefined) { return cb0(); }
      if (tweetObj[entityType].length == 0) { return cb0(); }

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
            return cb1(new Error("UNKNOWN ENTITY TYPE: " + entityType));
        }

        if (!histograms[entityType] || (histograms[entityType] === undefined)){
          histograms[entityType] = {};
          histograms[entityType][entity] = 1;
        }
        else if (!histograms[entityType][entity] || (histograms[entityType][entity] === undefined)){
          histograms[entityType][entity] = 1;
        }
        else{
          histograms[entityType][entity] += 1;
        }

        async.setImmediate(function() { cb1(); });

      }, function(e){

        if (e){
          console.log(chalkError("TFE | *** processTweetObj ERROR: " + e));
          return cb0(e);
        }

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

async function generateAutoCategory(params) {

  statsObj.status = "GEN AUTO CAT";

  try{

    const user = await tcUtils.updateUserHistograms({user: params.user});

    activateNetworkQueue.push({user: user});

    statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

    return user;

  }
  catch(err){
    console.log(chalkError("TFE | *** generateAutoCategory ERROR: " + err));
    throw err;
  }
}

const userTweetsDefault = {
  sinceId: MIN_TWEET_ID,
  tweetIds: []
}

function histogramIncomplete(histogram){

  return new Promise(function(resolve){

    if (!histogram) { return resolve(true); }
    if (histogram === undefined) { return resolve(true); }
    if (histogram == {}) { return resolve(true); }

    async.each(Object.values(histogram), function(value, cb){

      if (value == {}) { return cb(); }
      if ((value !== undefined) && (Object.keys(value).length > 0)) { return cb("valid"); }

      cb();

    }, function(valid){

      if (valid) { return resolve(false); }
      return resolve(true);
    });

  });
}

function processUserTweetArray(params){

  return new Promise(function(resolve, reject){

    const tscParams = params.tscParams;
    const user = params.user;
    const tweets = params.tweets;
    const forceFetch = params.forceFetch;

    async.eachSeries(tweets, async function(tweet){

      tscParams.tweetStatus = tweet;
      tscParams.tweetStatus.user = {};
      tscParams.tweetStatus.user = user;
      tscParams.tweetStatus.user.isNotRaw = true;

      // if (tweet.id_str.toString() > user.tweets.maxId.toString()) {
      //   user.tweets.maxId = tweet.id_str.toString();
      // }

      if (tweet.id_str.toString() > user.tweets.sinceId.toString()) {
        user.tweets.sinceId = tweet.id_str.toString();
      }

      if (forceFetch || !user.tweets.tweetIds.includes(tweet.id_str.toString())) { 

        try {

          const tweetObj = await tweetServerController.createStreamTweet(tscParams);

          if (!user.tweetHistograms || (user.tweetHistograms === undefined)) { user.tweetHistograms = {}; }

          user.tweetHistograms = await processTweetObj({tweetObj: tweetObj, histograms: user.tweetHistograms});
          user.tweets.tweetIds = _.union(user.tweets.tweetIds, [tweet.id_str]); 

          statsObj.twitter.tweetsProcessed += 1;
          statsObj.twitter.tweetsTotal += 1;

          if (forceFetch || configuration.testMode || configuration.verbose || (statsObj.twitter.tweetsTotal % 100 == 0)) {
            console.log(chalkInfo("TFE | +++ PROCESSED TWEET"
              + " | FORCE: " + forceFetch
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

        if (configuration.testMode || configuration.verbose) {
          console.log(chalkLog("TFE | ... TWEET ALREADY PROCESSED"
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

      if (forceFetch || configuration.testMode || configuration.verbose) {
        console.log(chalkLog("TFE | +++ Ts"
          + " | FORCE: " + forceFetch
          + " [ P/H/T " + statsObj.twitter.tweetsProcessed + "/" + statsObj.twitter.tweetsHits + "/" + statsObj.twitter.tweetsTotal + "]"
          + " | Ts: " + user.tweets.tweetIds.length
          + " | @" + user.screenName
        ));
      }
      resolve(user);
    });

  });
}

async function processUserTweets(params){

  let user = {};
  user = params.user;

  const tweets = params.tweets;

  const tscParams = {};

  tscParams.globalTestMode = configuration.globalTestMode;
  tscParams.testMode = configuration.testMode;
  tscParams.inc = false;
  tscParams.twitterEvents = configEvents;
  tscParams.tweetStatus = {};

  let tweetHistogramsEmpty = false;

  try{
    tweetHistogramsEmpty = await tcUtils.emptyHistogram(user.tweetHistograms);

    const processedUser = await processUserTweetArray({user: user, forceFetch: tweetHistogramsEmpty, tweets: tweets, tscParams: tscParams});

    if (tweetHistogramsEmpty) {
      console.log(chalkLog("TFE | >>> processUserTweetArray USER"
        + " | " + printUser({user: processedUser})
      ));
      debug(chalkLog("TFE | >>> processUserTweetArray USER TWEETS"
        + " | SINCE: " + processedUser.tweets.sinceId
        + " | TWEETS: " + processedUser.tweets.tweetIds.length
      ));
      debug(chalkLog("TFE | >>> processUserTweetArray USER TWEET HISTOGRAMS"
        + "\n" + jsonPrint(processedUser.tweetHistograms)
      ));
      debug(chalkLog("TFE | >>> processUserTweetArray USER PROFILE HISTOGRAMS"
        + "\n" + jsonPrint(processedUser.profileHistograms)
      ));
    }

    return processedUser;
  }
  catch(err){
    console.log(chalkError("TFE | *** processUserTweetArray ERROR: " + err));
    throw err;
  }
}

async function updateUserTweets(params){

  const user = params.user;

  const histogramIncompleteFlag = await histogramIncomplete(user.tweetHistograms);

  if (configuration.testFetchTweetsMode 
    || (!userTweetFetchSet.has(user.nodeId) && (histogramIncompleteFlag || user.priorityFlag))) { 

    userTweetFetchSet.add(user.nodeId);

    if (configuration.testFetchTweetsMode) {
      console.log(chalkAlert("TFE | updateUserTweets | !!! TEST MODE FETCH TWEETS"
        + " | @" + user.screenName
      ));
    }
    else{
      console.log(chalkInfo("TFE | updateUserTweets | >>> PRIORITY FETCH TWEETS"
        + " | @" + user.screenName
      ));
    }

    user.tweetHistograms = {};
    const latestTweets = await tcUtils.fetchUserTweets({user: user, force: true});
    if (latestTweets) { user.latestTweets = latestTweets; }
    // userTweetFetchSet.delete(user.nodeId);
  }

  if (user.latestTweets.length == 0) { 
    delete user.latestTweets;
    return user;
  }

  const latestTweets = user.latestTweets;
  
  delete user.latestTweets;

  defaults(user.tweets, userTweetsDefault);

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

  const processedUser = await processUserTweets({tweets: latestTweets, user: user});

  return processedUser;
}

async function processUser(params) {

  statsObj.status = "PROCESS USER";

  debug(chalkInfo("PROCESS USER\n" + jsonPrint(params.user)));

  if (userServerController === undefined) {
    console.log(chalkError("TFE | *** processUser userServerController UNDEFINED"));
    throw new Error("processUser userServerController UNDEFINED");
  }

  const user = params.user;
  user.following = true;

  try {

    const updatedTweetsUser = await updateUserTweets({user: user});
    const autoCategoryUser = await generateAutoCategory({user: updatedTweetsUser});
    const prevPropsUser = await updatePreviousUserProps({user: autoCategoryUser});

    prevPropsUser.markModified("tweetHistograms");
    prevPropsUser.markModified("profileHistograms");
    prevPropsUser.markModified("tweets");
    prevPropsUser.markModified("latestTweets");

    const savedUser = await prevPropsUser.save();

    if (configuration.verbose){
      console.log(chalkLog("TFE | >>> SAVED USER"
        + " | " + printUser({user: savedUser})
      ));
      console.log(chalkLog("TFE | >>> SAVED USER TWEETS"
        + " | SINCE: " + savedUser.tweets.sinceId
        + " | TWEETS: " + savedUser.tweets.tweetIds.length
      ));
      console.log(chalkLog("TFE | >>> SAVED USER TWEET HISTOGRAMS"
        + "\n" + jsonPrint(savedUser.tweetHistograms)
      ));
      console.log(chalkLog("TFE | >>> SAVED USER PROFILE HISTOGRAMS"
        + "\n" + jsonPrint(savedUser.profileHistograms)
      ));
    }

    userTweetFetchSet.delete(savedUser.nodeId);
    return savedUser;

  }
  catch(err) {

    if ((err.code === 34) || (err.statusCode === 404)){

      console.log(chalkError("TFE | *** processUser ERROR"
        + " | NID: " + user.nodeId
        + " | @" + user.screenName
        + " | ERR CODE: " + err.code
        + " | ERR STATUS CODE: " + err.statusCode
        + " | USER_NOT_FOUND ... DELETING ..."
      ));

      userTweetFetchSet.delete(user.nodeId);
      await global.globalUser.deleteOne({ "nodeId": user.nodeId });

      return;
    }

    console.log(chalkError("TFE | *** processUser ERROR"
      + " | NID: " + user.nodeId
      + " | @" + user.screenName
      + " | ERR CODE: " + err.code
      + " | ERR STATUS CODE: " + err.statusCode
      + " | " + err
    ));

    userTweetFetchSet.delete(user.nodeId);
    throw err;

  }
}

function updatePreviousUserProps(params){

  return new Promise(function(resolve, reject){

    if (!params.user) {
      return reject(new Error("user UNDEFINED"));
    }

    const user = params.user;

    async.each(USER_PROFILE_PROPERTY_ARRAY, function(userProp, cb){

      const prevUserProp = "previous" + _.upperFirst(userProp);

      if (user[userProp] && (user[userProp] !== undefined) && (user[prevUserProp] != user[userProp])) {
        debug(chalkLog("TFE | updatePreviousUserProps"
          + " | " + prevUserProp + ": " + user[prevUserProp] 
          + " <- " + userProp + ": " + user[userProp]
        ));

        user[prevUserProp] = user[userProp];

      }
      cb();

    }, function(){

      if (user.statusId && (user.statusId !== undefined) && (user.previousStatusId != user.statusId)) {
        user.previousStatusId = user.statusId;
      }

      if (user.quotedStatusId && (user.quotedStatusId !== undefined) && (user.previousQuotedStatusId != user.quotedStatusId)) {
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
    + " | LC " + user.location
    + " | C M " + user.category + " A " + user.categoryAuto;

    return text;
  }
}

async function allQueuesEmpty(){

  if (statsObj.queues.fetchUserQueue.busy) { return false; }
  if (statsObj.queues.fetchUserQueue.size > 0) { return false; }

  if (statsObj.queues.processUserQueue.busy) { return false; }
  if (statsObj.queues.processUserQueue.size > 0) { return false; }

  if (statsObj.queues.randomNetworkTreeActivateQueue.busy) { return false; }
  if (statsObj.queues.randomNetworkTreeActivateQueue.size > 0) { return false; }

  if (statsObj.queues.activateNetworkQueue.busy) { return false; }
  if (statsObj.queues.activateNetworkQueue.size > 0) { return false; }

  if (statsObj.queues.userDbUpdateQueue.busy) { return false; }
  if (userDbUpdateQueue.length > 0) { return false; }

  return true;
}

async function initProcessUserQueueInterval(interval) {

  statsObj.status = "INIT PROCESS USER QUEUE";

  let mObj = {};

  console.log(chalkBlue("TFE | INIT PROCESS USER QUEUE INTERVAL | " + PROCESS_USER_QUEUE_INTERVAL + " MS"));

  statsObj.processedStartFlag = false;
  clearInterval(processUserQueueInterval);

  intervalsSet.add("processUserQueueInterval");

  processUserStartTimeMoment = moment();

  processUserQueueInterval = setInterval(async function () {

    const allEmpty = await allQueuesEmpty();

    if (statsObj.fetchUserEndFlag && statsObj.processedStartFlag && allEmpty){

      console.log(chalkBlue(
          "\n=============================="
        + "\nTFE | --- ALL QUEUES EMPTY ---"
        + "\n==============================\n"
      ));

      fsm.fsm_fetchAllEnd(); 

      clearInterval(processUserQueueInterval);
    }
    else if (!statsObj.queues.processUserQueue.busy && processUserQueue.length > 0) {

      statsObj.status = "PROCESS USER";

      statsObj.queues.processUserQueue.busy = true;

      mObj = processUserQueue.shift(); // .latestTweets[], .userId

      statsObj.queues.processUserQueue.size = processUserQueue.length;

      if (!statsObj.processedStartFlag) {
        statsObj.processedStartFlag = true;
        showStats();
      }
      
      try {

        if (!categorizedUserIdSet.has(mObj.nodeId)){
          console.log(chalkAlert("TFE | !!! NODE ID NOT IN CATEGORIZED SET: " + mObj.nodeId));
          statsObj.users.totalUsersSkipped += 1;
          statsObj.queues.processUserQueue.busy = false;
          return;
        }

        const u = await global.globalUser.findOne({nodeId: mObj.nodeId}).exec();

        if (!u) {
          console.log(chalkAlert("TFE | ??? USER NOT FOUND IN DB"
            + " | NID: " + mObj.nodeId
            + " | @" + mObj.screenName
          ));
          statsObj.users.totalUsersSkipped += 1;
          statsObj.queues.processUserQueue.busy = false;
          return;
        }

        const user = await tcUtils.encodeHistogramUrls({user: u});
        user.priorityFlag = mObj.priorityFlag;

        if (!user.latestTweets || (user.latestTweets === undefined)) { 
          user.latestTweets = [];
        }
        if (!user.tweetHistograms || (user.tweetHistograms === undefined)) { 
          user.tweetHistograms = {}; 
        }
        if (!user.profileHistograms || (user.profileHistograms === undefined)) { 
          user.profileHistograms = {}; 
        }

        if (user.profileHistograms.sentiment && (user.profileHistograms.sentiment !== undefined)) {

          if (user.profileHistograms.sentiment.magnitude !== undefined){
            if (user.profileHistograms.sentiment.magnitude < 0){
              console.log(chalkAlert("TFE | !!! NORMALIZATION MAG LESS THAN 0 | CLAMPED: " + user.profileHistograms.sentiment.magnitude));
              user.profileHistograms.sentiment.magnitude = 0;
            }
          }

          if (user.profileHistograms.sentiment.score !== undefined){
            if (user.profileHistograms.sentiment.score < -1.0){
              console.log(chalkAlert("TFE | !!! NORMALIZATION SCORE LESS THAN -1.0 | CLAMPED: " + user.profileHistograms.sentiment.score));
              user.profileHistograms.sentiment.score = -1.0;
            }

            if (user.profileHistograms.sentiment.score > 1.0){
              console.log(chalkAlert("TFE | !!! NORMALIZATION SCORE GREATER THAN 1.0 | CLAMPED: " + user.profileHistograms.sentiment.score));
              user.profileHistograms.sentiment.score = 1.0;
            }
          }
        }

        if (configuration.verbose){
          console.log(chalkLog("TFE | FOUND USER DB"
            + " | " + printUser({user: user})
          ));
        }

        if ((mObj.op == "USER_TWEETS") 
          && (mObj.latestTweets.length > 0) 
          && (mObj.latestTweets[0].user.id_str == mObj.nodeId))
        {
          // update user props
          const convertedRawUser = await userServerController.convertRawUserPromise({user: mObj.latestTweets[0].user});

          user.bannerImageUrl = convertedRawUser.bannerImageUrl;
          user.createdAt = convertedRawUser.createdAt;
          user.description = convertedRawUser.description;
          user.expandedUrl = convertedRawUser.expandedUrl;
          user.followersCount = convertedRawUser.followersCount;
          user.friendsCount = convertedRawUser.friendsCount;
          user.lang = convertedRawUser.lang;
          user.location = convertedRawUser.location;
          user.name = convertedRawUser.name;
          user.profileImageUrl = convertedRawUser.profileImageUrl;
          user.profileUrl = convertedRawUser.profileUrl;
          user.quotedStatusId = convertedRawUser.quotedStatusId;
          user.screenName = convertedRawUser.screenName;
          user.status = convertedRawUser.status;
          user.statusesCount = convertedRawUser.statusesCount;
          user.statusId = convertedRawUser.statusId;
          user.url = convertedRawUser.url;

          user.lastSeen = mObj.latestTweets[0].created_at;
        }

        defaults(user.tweets, userTweetsDefault);

        if (!mObj.latestTweets || (mObj.latestTweets === undefined)) { mObj.latestTweets = []; }

        user.latestTweets = _.union(user.latestTweets, mObj.latestTweets);

        const processedUser = await processUser({user: user});

        debug("PROCESSED USER\n" + jsonPrint(processedUser));

        if (configuration.verbose) {
          console.log(chalkAlert("TFE | PROCESSED USER"
            + " | UID: " + processedUser.userId
            + " | @" + processedUser.screenName
            + " | Ts SINCE: " + processedUser.tweets.sinceId
            + " Ts: " + processedUser.tweets.tweetIds.length
          ));
        }

        statsObj.queues.processUserQueue.busy = false;
      }
      catch(err){
        console.log(chalkError("TFE | *** ERROR processUser"
          + " | USER ID: " + mObj.userId
          + " | " + err
        ));
        console.log(err);
        statsObj.queues.processUserQueue.busy = false;
      }

    }
  }, interval);

  return;
}

statsObj.fsmState = "RESET";

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog(MODULE_ID_PREFIX + " | --------------------------------------------------------\n"
    + MODULE_ID_PREFIX + " | << FSM >> MAIN"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n" + MODULE_ID_PREFIX + " | --------------------------------------------------------"
  ));
}

const fsmStates = {

  "RESET": {

    onEnter: async function(event, oldState, newState) {

      if (event != "fsm_tick") {

        console.log(chalkTwitter(MODULE_ID_PREFIX + " | FSM RESET"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM RESET";

        try{
          await showStats(true);
        }
        catch(err){
          console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
        }
      }

    },

    fsm_tick: function() {

      fsm.fsm_resetEnd();
    },

    "fsm_resetEnd": "IDLE"
  },

  "ERROR": {

    onEnter: async function(event, oldState, newState) {

      if (event != "fsm_tick") {

        console.log(chalkError(MODULE_ID_PREFIX + " | *** FSM ERROR"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM ERROR";

        quit({cause: "FSM ERROR"});
      }
    },
  },

  "IDLE": {
    onEnter: function(event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM IDLE";
      }

    },

    fsm_tick: function() {
      fsm.fsm_init();
    },

    "fsm_init": "INIT",
    "fsm_quit": "QUIT",
    "fsm_error": "ERROR"
  },

  "INIT": {
    onEnter: async function(event, oldState, newState) {
      if (event != "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        try {
          console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT"));
          await initNetworks();
          await initRandomNetworks();
          fsm.fsm_ready(); 
          console.log(chalkBlue(MODULE_ID_PREFIX + " | CREATED ALL CHILDREN: " + Object.keys(childHashMap).length));
        }
        catch(err){
          console.log(chalkError(MODULE_ID_PREFIX + " | *** CREATE ALL CHILDREN ERROR: " + err));
          fsm.fsm_error();
        }

      }
    },

    fsm_tick: function() {
    },

    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY": {
    onEnter: function(event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM READY";
      }
    },
    fsm_tick: function() {
      fsm.fsm_fetchAll();
    },
    "fsm_fetchAll": "FETCH_ALL",
    "fsm_quit": "QUIT",
    "fsm_exit": "EXIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },

  "FETCH_ALL": {
    onEnter: async function(event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM FETCH_ALL";

        try{
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
    },
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_fetchAllEnd": "FETCH_END_ALL"
  },

  "FETCH_END_ALL": {

    onEnter: async function(event, oldState, newState) {

      if (event != "fsm_tick") {

        statsObj.status = "END FETCH ALL";

        reporter(event, oldState, newState);

        console.log(chalk.bold.blue("TFE | ===================================================="));
        console.log(chalk.bold.blue("TFE | ================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("TFE | ===================================================="));

        console.log(chalk.bold.blue("TFE | TOTAL USERS PROCESSED:    " + statsObj.users.processed));
        console.log(chalk.bold.blue("TFE | TOTAL USERS FETCH ERRORS: " + statsObj.users.fetchErrors));

        console.log(chalk.bold.blue("\nTFE | ----------------------------------------------------"
          + "\nTFE | BEST NN: " + statsObj.bestNetwork.networkId
          + "\nTFE |  INPUTS: " + statsObj.bestNetwork.numInputs + " | " + statsObj.bestNetwork.inputsId
          + "\nTFE |  SR:     " + statsObj.bestNetwork.successRate.toFixed(3) + "%"
          + "\nTFE |  MR:     " + statsObj.bestNetwork.matchRate.toFixed(3) + "%"
          + "\nTFE |  OAMR:   " + statsObj.bestNetwork.overallMatchRate.toFixed(3) + "%"
          + "\nTFE |  TC:     " + statsObj.bestNetwork.testCycles
          + "\nTFE |  TCH:    " + statsObj.bestNetwork.testCycleHistory.length
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
            console.log(chalkLog(MODULE_ID_PREFIX + " | ... WAIT EVENT: allNetworksUpdated"));
            await tcUtils.waitEvent({ event: "allNetworksUpdated"});
          }
          catch(err){
            console.log(chalkError("TFE | *** WAIT EVENT ERROR: " + err));
          }
        }

        // let histogramsSavedFlag = false;

        // try{

        //   let rootFolder;

        //   if (configuration.testMode) {
        //     rootFolder = (hostname == PRIMARY_HOST) 
        //     ? defaultHistogramsFolder + "_test/types/" 
        //     : localHistogramsFolder + "_test/types/";
        //   }
        //   else {
        //     rootFolder = (hostname == PRIMARY_HOST) 
        //     ? defaultHistogramsFolder + "/types/" 
        //     : localHistogramsFolder + "/types/";
        //   }

        //   console.log(chalkInfo("TFE | ... SAVING HISTOGRAMS | TYPES: " + Object.keys(globalHistograms)));

        //   await tcUtils.saveGlobalHistograms({rootFolder: rootFolder});

        //   histogramsSavedFlag = true;
        // }
        // catch(err){
        //   console.log(chalkError("TFE | *** PRUNE GLOBAL HISTOGRAMS ERROR: " + err));
        // }

        statsObj.loadedNetworksFlag = false;

        if (slackWebClient !== undefined){

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

          try{
            if (!configuration.offlineMode) { await slackSendWebMessage({channel: slackChannel, text: slackText}); }
          }
          catch(err){
            console.log(chalkError("TFE | *** SLACK SEND ERROR: " + err));
          }
        }

        clearInterval(waitFileSaveInterval);

        statsObj.status = "WAIT UPDATE STATS";

        waitFileSaveInterval = setInterval(async function() {

          if (saveFileQueue.length == 0) {

            console.log(chalk.bold.blue("TFE | ALL NNs SAVED ..."));

            if (randomNetworkTree && (randomNetworkTree !== undefined)) { 
              randomNetworkTree.send({op: "RESET_STATS"});
            }

            // childSendAll({op: "RESET_TWITTER_USER_STATE"});

            try {

              clearInterval(waitFileSaveInterval);

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
              // + " | HISTOGRAMS SAVED: " + histogramsSavedFlag
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

    if (!configuration.offlineMode){
      initSlackRtmClient();
      await initSlackWebClient();
      const twitterParams = await tcUtils.initTwitterConfig();
      tcUtils.setEnableLanguageAnalysis(configuration.enableLanguageAnalysis);
      tcUtils.setEnableImageAnalysis(configuration.enableImageAnalysis);
      tcUtils.setEnableGeoCode(configuration.enableGeoCode);
      await tcUtils.initTwitter({twitterConfig: twitterParams});
      await tcUtils.getTwitterAccountSettings();
    }

    initSaveFileQueue(configuration);

    if (configuration.testMode) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
    }

    console.log(chalkBlueBold(
        "\n" + MODULE_ID_PREFIX + " | --------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\n" + MODULE_ID_PREFIX + " | --------------------------------------------------------"
    ));

    await tcUtils.initSaveFileQueue();
    await connectDb();
    await fsmStart();
    await initUserDbUpdateQueueInterval(USER_DB_UPDATE_QUEUE_INTERVAL);

    await initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);
    await initActivateNetworkQueueInterval(ACTIVATE_NETWORK_QUEUE_INTERVAL);
    await initRandomNetworkTreeChild();

    await initWatchConfig();
    await initProcessUserQueueInterval(PROCESS_USER_QUEUE_INTERVAL);

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code != 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
