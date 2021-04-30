import dotenv from "dotenv";
const envConfig = dotenv.config({ path: process.env.WORD_ENV_VARS_FILE });

if (envConfig.error) {
  throw envConfig.error;
}

console.log("TFE | +++ ENV CONFIG LOADED");

console.log(`SLACK_BOT_TOKEN: ${process.env.SLACK_BOT_TOKEN}`);

const MODULE_NAME = "twitterFollowerExplorer";
const PF = "TFE";

const DEFAULT_PRIMARY_HOST = "google";
const DEFAULT_DATABASE_HOST = "mms3";

const bestNetworkIdArrayFile = "bestNetworkIdArray.json";
let bestNetworkObj = {};
const bestNetworksByTechnology = {};

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND * 60;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_MIN_INTERVAL = 2;
const DEFAULT_INIT_MAIN_INTERVAL = ONE_MINUTE;
const QUIT_WAIT_INTERVAL = 5 * ONE_SECOND;
const FSM_TICK_INTERVAL = ONE_SECOND;
const STATS_UPDATE_INTERVAL = 10 * ONE_MINUTE;

const DEFAULT_CURSOR_BATCH_SIZE = 100;
const TEST_FETCH_USER_INTERVAL = DEFAULT_MIN_INTERVAL;
const DEFAULT_CURSOR_PARALLEL = 16;
const DEFAULT_USER_CURSOR_BATCH_SIZE = 32;
const DEFAULT_USER_CURSOR_LIMIT = 100;
const DEFAULT_PARSE_IMAGE_REQUEST_TIMEOUT = ONE_SECOND;
const DEFAULT_BACKPRESSURE_PERIOD = 5; // ms
const DEFAULT_PURGE_MIN_SUCCESS_RATE = 50;

const DEFAULT_PROCESS_USER_MAX_PARALLEL = 16;
const DEFAULT_USER_DB_UPDATE_MAX_PARALLEL = 16;
const DEFAULT_MAX_USER_DB_UPDATE_QUEUE = 100;
const DEFAULT_SAVE_FILE_QUEUE_INTERVAL = 100;

const TEST_MODE = false; // applies only to parent
const TEST_FETCH_TWEETS_MODE = false; // applies only to parent

const DEFAULT_ENABLE_FETCH_TWEETS = false;
const DEFAULT_UPDATE_GLOBAL_HISTOGRAMS = false; // will be performed another module
const DEFAULT_NN_NUMBER_LIMIT = 10;
const DEFAULT_NN_DB_LOAD_PER_INPUTS = 2;
const DEFAULT_RANDOM_UNTESTED_NN_PER_INPUTS = 2;

const DEFAULT_ARCHIVE_NETWORK_ON_INPUT_MISS = true;
const DEFAULT_MIN_TEST_CYCLES = 10;
const DEFAULT_MIN_WORD_LENGTH = 3;
const DEFAULT_BEST_INCREMENTAL_UPDATE = false;

const DEFAULT_FETCH_USER_INTERVAL = DEFAULT_MIN_INTERVAL;
const DEFAULT_PROCESS_USER_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const DEFAULT_ACTIVATE_NETWORK_QUEUE_INTERVAL = DEFAULT_MIN_INTERVAL;
const DEFAULT_USER_DB_UPDATE_QUEUE_INTERVAL = 10 * DEFAULT_MIN_INTERVAL;

const DEFAULT_GLOBAL_MIN_SUCCESS_RATE = 85;
const DEFAULT_BARE_MIN_SUCCESS_RATE = 75;
const TEST_GLOBAL_MIN_SUCCESS_RATE_MULTIPLIER = 0.95;

const TEST_TWEET_FETCH_COUNT = 11;
const TWEET_FETCH_COUNT = 100;

const TEST_MODE_NUM_NN = 3;
const TEST_TOTAL_FETCH = 200;

const GLOBAL_TEST_MODE = false; // applies to parent and all children
const QUIT_ON_COMPLETE = true;

const MIN_TWEET_ID = "1000000";

const DEFAULT_ENABLE_GEOCODE = true;

const DEFAULT_ENABLE_LANG_ANALYSIS = true;

const DEFAULT_MAX_USER_TWEETIDS = 100;

import fs from "fs-extra";
import path from "path";
import watch from "watch";
import defaults from "object.defaults";
import moment from "moment";
import HashMap from "hashmap";
import pick from "object.pick";
import _ from "lodash";
import NodeCache from "node-cache";
import merge from "deepmerge";
import btoa from "btoa";
import empty from "is-empty";

import { promisify } from "util";
const renameFileAsync = promisify(fs.rename);
const unlinkFileAsync = promisify(fs.unlink);

import debug from "debug";
import util from "util";
import deepcopy from "deep-copy";
import async from "async";

// import EventEmitter2 from "eventemitter2";
import EventEmitter from "eventemitter3";

const configEvents = new EventEmitter({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true,
});

import chalk from "chalk";
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

import os from "os";
let hostname = os.hostname();

// GOOGLE CLOUD SHELL hostname is like: "cs-6000-devshell-vm-b4617f5d-3d18-4f0a-9418-5116e89b96e1"

if (hostname.startsWith("cs-")) {
  hostname = "googleCloudSh";
} else {
  hostname = hostname.replace(/\.example\.com/g, "");
  hostname = hostname.replace(/\.local/g, "");
  hostname = hostname.replace(/\.home/g, "");
  hostname = hostname.replace(/\.at\.net/g, "");
  hostname = hostname.replace(/\.fios-router\.home/g, "");
  hostname = hostname.replace(/word0-instance-1/g, "google");
  hostname = hostname.replace(/word-1/g, "google");
  hostname = hostname.replace(/word/g, "google");
}

let configuration = {};

configuration.offlineMode = false;
configuration.verbose = false;

configuration.primaryHost = process.env.PRIMARY_HOST || DEFAULT_PRIMARY_HOST;
configuration.databaseHost = process.env.DATABASE_HOST || DEFAULT_DATABASE_HOST;

configuration.isPrimaryHost = configuration.primaryHost === hostname;
configuration.isDatabaseHost = configuration.databaseHost === hostname;

const HOST = configuration.isDatabaseHost ? "default" : "local";
configuration.parseImageRequestTimeout = DEFAULT_PARSE_IMAGE_REQUEST_TIMEOUT;
configuration.limitTestMode = 1047;
configuration.cursorParallel = DEFAULT_CURSOR_PARALLEL;
configuration.userCursorBatchSize = DEFAULT_USER_CURSOR_BATCH_SIZE;
configuration.userCursorLimit = DEFAULT_USER_CURSOR_LIMIT;

configuration.backPressurePeriod = DEFAULT_BACKPRESSURE_PERIOD;
configuration.maxUserDbUpdateQueue = DEFAULT_MAX_USER_DB_UPDATE_QUEUE;
configuration.userProcessMaxParallel = DEFAULT_PROCESS_USER_MAX_PARALLEL;
configuration.userDbUpdateMaxParallel = DEFAULT_USER_DB_UPDATE_MAX_PARALLEL;
configuration.enableFetchTweets = DEFAULT_ENABLE_FETCH_TWEETS;

configuration.fetchUserInterval = DEFAULT_FETCH_USER_INTERVAL;
configuration.saveFileQueueInterval = DEFAULT_SAVE_FILE_QUEUE_INTERVAL;
configuration.updateGlobalHistograms = DEFAULT_UPDATE_GLOBAL_HISTOGRAMS;
configuration.processUserQueueInterval = DEFAULT_PROCESS_USER_QUEUE_INTERVAL;
configuration.activateNetworkQueueInterval = DEFAULT_ACTIVATE_NETWORK_QUEUE_INTERVAL;
configuration.userDbUpdateQueueInterval = DEFAULT_USER_DB_UPDATE_QUEUE_INTERVAL;

configuration.networkNumberLimit = DEFAULT_NN_NUMBER_LIMIT;
configuration.networkDatabaseLoadPerInputsLimit = DEFAULT_NN_DB_LOAD_PER_INPUTS;
configuration.randomUntestedPerInputsLimit = DEFAULT_RANDOM_UNTESTED_NN_PER_INPUTS;

configuration.enableLanguageAnalysis = DEFAULT_ENABLE_LANG_ANALYSIS;
configuration.enableGeoCode = DEFAULT_ENABLE_GEOCODE;

configuration.bestNetworkIncrementalUpdate = DEFAULT_BEST_INCREMENTAL_UPDATE;
configuration.archiveNetworkOnInputsMiss = DEFAULT_ARCHIVE_NETWORK_ON_INPUT_MISS;
configuration.minWordLength = DEFAULT_MIN_WORD_LENGTH;
configuration.minTestCycles = DEFAULT_MIN_TEST_CYCLES;
configuration.testMode = TEST_MODE;
configuration.testFetchTweetsMode = TEST_FETCH_TWEETS_MODE;
configuration.globalTestMode = GLOBAL_TEST_MODE;
configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.tweetFetchCount = TEST_MODE
  ? TEST_TWEET_FETCH_COUNT
  : TWEET_FETCH_COUNT;
configuration.totalFetchCount = TEST_MODE ? TEST_TOTAL_FETCH : Infinity;
configuration.fsmTickInterval = FSM_TICK_INTERVAL;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

const MODULE_ID = PF + "_node_" + hostname;

let mongooseDb;
import mgt from "@threeceelabs/mongoose-twitter";
global.wordAssoDb = mgt;
global.dbConnection = false;

const mguAppName = "MGU_" + MODULE_ID;
import { MongooseUtilities } from "@threeceelabs/mongoose-utilities";
const mgUtils = new MongooseUtilities(mguAppName);

mgUtils.on("ready", async () => {
  console.log(`${PF} | +++ MONGOOSE UTILS READY: ${mguAppName}`);
});

const tcuAppName = PF + "_TCU";
import { ThreeceeUtilities } from "@threeceelabs/threeceeutilities";
const tcUtils = new ThreeceeUtilities(tcuAppName);

tcUtils.on("ready", async () => {
  console.log(`${PF} | +++ THREECEE UTILS READY: ${tcuAppName}`);
});

const jsonPrint = tcUtils.jsonPrint;
const msToTime = tcUtils.msToTime;
const getTimeStamp = tcUtils.getTimeStamp;
const formatBoolean = tcUtils.formatBoolean;
const formatCategory = tcUtils.formatCategory;

import { NeuralNetworkTools } from "@threeceelabs/neural-network-tools";
const nnTools = new NeuralNetworkTools(PF + "_NNT");
nnTools.enableTensorflow();

import { UserServerController } from "@threeceelabs/user-server-controller";
const userServerController = new UserServerController(PF + "_USC");
let userServerControllerReady = false;

userServerController.on("error", function (err) {
  userServerControllerReady = false;
  console.log(chalkError(PF + " | *** USC ERROR | " + err));
});

userServerController.on("ready", function (appname) {
  userServerControllerReady = true;
  console.log(chalk.green(PF + " | USC READY | " + appname));
});

import { TweetServerController } from "@threeceelabs/tweet-server-controller";
const tweetServerController = new TweetServerController(PF + "_TSC");

tweetServerController.on("error", function (err) {
  console.log(chalkError(PF + " | *** TSC ERROR | " + err));
});

tweetServerController.on("ready", function (appname) {
  console.log(chalk.green(PF + " | TSC READY | " + appname));
});

let DROPBOX_ROOT_FOLDER;
let DEFAULT_SSH_PRIVATEKEY;

if (hostname.startsWith("google")) {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
  DEFAULT_SSH_PRIVATEKEY = "/home/tc/.ssh/google_compute_engine";
} else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
  DEFAULT_SSH_PRIVATEKEY = "/Users/tc/.ssh/google_compute_engine";
}

let waitFileSaveInterval;

const SAVE_CACHE_DEFAULT_TTL = 60;

const USER_PROFILE_PROPERTY_ARRAY = [
  "bannerImageUrl",
  "description",
  "location",
  "name",
  "profileUrl",
  "profileImageUrl",
  "screenName",
  "url",
];

// const DEFAULT_INPUT_TYPES = [
//   "emoji",
//   "friends",
//   "hashtags",
//   "images",
//   "locations",
//   "media",
//   "mentions",
//   "ngrams",
//   "places",
//   "sentiment",
//   "urls",
//   "userMentions",
//   "words"
// ];

// DEFAULT_INPUT_TYPES.sort();

const inputsIdSet = new Set();
const bestInputsSet = new Set();
const skipLoadNetworkSet = new Set();
const userTweetFetchSet = new Set();

//=========================================================================
// HOST
//=========================================================================

const bestNetworkHashMap = new HashMap();

const processUserQueue = [];
let processUserQueueInterval;

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

statsObj.networks = {};

statsObj.bestNetwork = {};
statsObj.bestNetwork.networkId = false;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.overallMatchRate = 0;
statsObj.bestNetwork.runtimeMatchRate = 0;
statsObj.bestNetwork.testCycles = 0;
statsObj.bestNetwork.testCycleHistory = [];
statsObj.bestNetwork.total = 0;
statsObj.bestNetwork.match = 0;
statsObj.bestNetwork.mismatch = 0;
statsObj.bestNetwork.left = 0;
statsObj.bestNetwork.neutral = 0;
statsObj.bestNetwork.right = 0;
statsObj.bestNetwork.positive = 0;
statsObj.bestNetwork.negative = 0;

statsObj.currentBestNetwork = {};
statsObj.currentBestNetwork.networkId = false;
statsObj.currentBestNetwork.successRate = 0;
statsObj.currentBestNetwork.matchRate = 0;
statsObj.currentBestNetwork.overallMatchRate = 0;
statsObj.currentBestNetwork.runtimeMatchRate = 0;
statsObj.currentBestNetwork.testCycles = 0;
statsObj.currentBestNetwork.total = 0;
statsObj.currentBestNetwork.match = 0;
statsObj.currentBestNetwork.mismatch = 0;
statsObj.currentBestNetwork.left = 0;
statsObj.currentBestNetwork.neutral = 0;
statsObj.currentBestNetwork.right = 0;
statsObj.currentBestNetwork.positive = 0;
statsObj.currentBestNetwork.negative = 0;

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

statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.busy = false;
statsObj.queues.saveFileQueue.size = 0;

statsObj.queues.activateNetworkQueue = {};
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

statsObj.userReadyAck = false;
statsObj.userReadyAckWait = 0;
statsObj.userReadyTransmitted = false;

statsObj.fetchUserEndFlag = false;

statsObj.users = {};

statsObj.users.notCategorized = 0;
statsObj.users.notFound = 0;
statsObj.users.screenNameUndefined = 0;

statsObj.users.processed = {};
statsObj.users.processed.grandTotal = 0;
statsObj.users.processed.total = 0;
statsObj.users.processed.percent = 0;
statsObj.users.processed.empty = 0;
statsObj.users.processed.errors = 0;
statsObj.users.processed.elapsed = 0;
statsObj.users.processed.rate = 0;
statsObj.users.processed.remain = 0;
statsObj.users.processed.remainMS = 0;
statsObj.users.processed.startMoment = 0;
statsObj.users.processed.endMoment = moment();

statsObj.users.categorized = {};
statsObj.users.categorized.total = 0;
statsObj.users.categorized.manual = 0;
statsObj.users.categorized.auto = 0;
statsObj.users.categorized.matched = 0;
statsObj.users.categorized.mismatched = 0;
statsObj.users.categorized.matchRate = 0;

statsObj.users.fetchErrors = 0;
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
bestNetwork.runtimeMatchRate = 0;
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
currentBestNetwork.runtimeMatchRate = 0;
currentBestNetwork.testCycles = 0;
currentBestNetwork.testCycleHistory = [];

//=========================================================================
// MISC FUNCTIONS (own module?)
//=========================================================================

function getElapsedTimeStamp() {
  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();
  statsObj.processUserElapsedMS =
    moment().valueOf() - processUserStartTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

//=========================================================================
// SLACK
//=========================================================================
import { WebClient } from "@slack/web-api";

console.log("process.env.SLACK_BOT_TOKEN: ", process.env.SLACK_BOT_TOKEN);
const slackBotToken = process.env.SLACK_BOT_TOKEN;

const slackWebClient = new WebClient(slackBotToken);

const slackChannel = "tfe";
const channelsHashMap = new HashMap();

async function slackSendWebMessage(msgObj) {
  try {
    const channel = msgObj.channel || configuration.slackChannel.id;
    const text = msgObj.text || msgObj;

    await slackWebClient.chat.postMessage({
      text: text,
      channel: channel,
    });
  } catch (err) {
    console.log(chalkAlert(PF + " | *** slackSendWebMessage ERROR: " + err));
    throw err;
  }
}

async function initSlackWebClient() {
  try {
    console.log(chalkLog(MODULE_ID + " | INIT SLACK WEB CLIENT"));

    const authTestResponse = await slackWebClient.auth.test();

    console.log({ authTestResponse });

    const conversationsListResponse = await slackWebClient.conversations.list();

    conversationsListResponse.channels.forEach(async function (channel) {
      debug(
        chalkLog("TNN | SLACK CHANNEL | " + channel.id + " | " + channel.name)
      );

      if (channel.name === slackChannel) {
        configuration.slackChannel = channel;

        const message = {
          channel: configuration.slackChannel.id,
          text: "OP",
        };

        message.attachments = [];
        message.attachments.push({
          text: "INIT",
          fields: [
            { title: "SRC", value: hostname + "_" + process.pid },
            { title: "MOD", value: MODULE_NAME },
            { title: "DST", value: "ALL" },
          ],
        });

        await slackWebClient.chat.postMessage(message);
      }

      channelsHashMap.set(channel.id, channel);
    });

    return;
  } catch (err) {
    console.log(chalkError("TNN | *** INIT SLACK WEB CLIENT ERROR: " + err));
    throw err;
  }
}

configuration.quitOnComplete = QUIT_ON_COMPLETE;
configuration.processName = process.env.TFE_PROCESS_NAME || "tfe_node";
configuration.interruptFlag = false;

configuration.initMainIntervalTime = DEFAULT_INIT_MAIN_INTERVAL;

if (process.env.TFE_QUIT_ON_COMPLETE !== undefined) {
  console.log(
    PF + " | ENV TFE_QUIT_ON_COMPLETE: " + process.env.TFE_QUIT_ON_COMPLETE
  );

  if (
    !process.env.TFE_QUIT_ON_COMPLETE ||
    process.env.TFE_QUIT_ON_COMPLETE == false ||
    process.env.TFE_QUIT_ON_COMPLETE == "false"
  ) {
    configuration.quitOnComplete = false;
  } else {
    configuration.quitOnComplete = true;
  }
}

configuration.globalMinSuccessRate =
  process.env.TFE_GLOBAL_MIN_SUCCESS_RATE !== undefined
    ? process.env.TFE_GLOBAL_MIN_SUCCESS_RATE
    : DEFAULT_GLOBAL_MIN_SUCCESS_RATE;

configuration.bareMinSuccessRate =
  process.env.TFE_BARE_MIN_SUCCESS_RATE !== undefined
    ? process.env.TFE_BARE_MIN_SUCCESS_RATE
    : DEFAULT_BARE_MIN_SUCCESS_RATE;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE =
  process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
configuration.DROPBOX.DROPBOX_TFE_STATS_FILE =
  process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

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
  // "randomNetworkTree",
  "queues",
];

statsObjSmall = pick(statsObj, statsPickArray);

async function loadInputs(params) {
  statsObj.status = "LOAD INPUTS CONFIG";

  const folder = params.folder;
  const file = params.file;

  console.log(
    chalkNetwork(
      "TFE | LOADING INPUTS CONFIG | " + folder + "/" + file + " ..."
    )
  );

  try {
    const inputsConfigObj = await tcUtils.loadFile({
      folder: folder,
      file: file,
      noErrorNotFound: params.noErrorNotFound,
    });

    if (!inputsConfigObj) {
      if (params.noErrorNotFound) {
        console.log(
          chalkAlert(
            "TFE | !!! LOAD INPUTS CONFIG FILE ERROR | FILE NOT FOUND "
          )
        );
        return;
      }
      console.log(
        chalkError("TFE | LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED ??? ")
      );
      throw new Error("LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED");
    }

    const tempInputsIdSet = new Set(inputsConfigObj.INPUTS_IDS);

    for (const inputsId of tempInputsIdSet) {
      inputsIdSet.add(inputsId);
    }

    console.log(
      chalkBlue(
        "TFE | LOADED INPUTS CONFIG" +
          "\nTFE | CURRENT FILE INPUTS IDS SET: " +
          tempInputsIdSet.size +
          " INPUTS IDS" +
          "\n" +
          jsonPrint([...tempInputsIdSet]) +
          "\nTFE | FINAL INPUTS IDS SET: " +
          inputsIdSet.size +
          " INPUTS IDS" +
          "\n" +
          jsonPrint([...inputsIdSet])
      )
    );

    return;
  } catch (err) {
    if (err.status == 409 || err.status == 404) {
      console.log(chalkError("TFE | LOAD INPUTS CONFIG FILE NOT FOUND"));
      return;
    }
    console.log(chalkError("TFE | LOAD INPUTS CONFIG FILE ERROR: ", err));
    throw err;
  }
}

const networkDefaults = function (networkObj) {
  if (networkObj.betterChild === undefined) {
    networkObj.betterChild = false;
  }
  if (networkObj.testCycles === undefined) {
    networkObj.testCycles = 0;
  }
  if (networkObj.testCycleHistory === undefined) {
    networkObj.testCycleHistory = [];
  }
  if (networkObj.overallMatchRate === undefined) {
    networkObj.overallMatchRate = 0;
  }
  if (networkObj.runtimeMatchRate === undefined) {
    networkObj.runtimeMatchRate = 0;
  }
  if (networkObj.matchRate === undefined) {
    networkObj.matchRate = 0;
  }
  if (networkObj.successRate === undefined) {
    networkObj.successRate = 0;
  }

  return networkObj;
};

async function updateDbNetwork(params) {
  try {
    statsObj.status = "UPDATE DB NETWORKS";

    const networkObj = params.networkObj;
    const incrementTestCycles =
      params.incrementTestCycles !== undefined
        ? params.incrementTestCycles
        : false;
    const testHistoryItem =
      params.testHistoryItem !== undefined ? params.testHistoryItem : false;
    const addToTestHistory =
      params.addToTestHistory !== undefined ? params.addToTestHistory : true;
    const verbose = params.verbose || false;

    const query = { networkId: networkObj.networkId };

    const update = {};

    update.$setOnInsert = {
      networkTechnology: networkObj.networkTechnology,
      networkJson: networkObj.networkJson,
      binaryMode: networkObj.binaryMode,
      betterChild: networkObj.betterChild,
      seedNetworkId: networkObj.seedNetworkId,
      seedNetworkRes: networkObj.seedNetworkRes,
      networkCreateMode: networkObj.networkCreateMode,
      successRate: networkObj.successRate,
      numInputs: networkObj.numInputs,
      hiddenLayerSize: networkObj.hiddenLayerSize,
      numOutputs: networkObj.numOutputs,
      inputsId: networkObj.inputsId,
      inputsObj: networkObj.inputsObj,
      outputs: networkObj.outputs,
      evolve: networkObj.evolve,
      train: networkObj.train,
      test: networkObj.test,
    };

    update.$set = {
      archived: networkObj.archived,
      matchRate: networkObj.matchRate,
      overallMatchRate: networkObj.overallMatchRate,
      runtimeMatchRate: networkObj.runtimeMatchRate,
      previousRank: networkObj.previousRank,
      rank: networkObj.rank,
      // meta: networkObj.meta
    };

    if (incrementTestCycles) {
      update.$inc = { testCycles: 1 };
    }

    if (testHistoryItem) {
      update.$push = { testCycleHistory: testHistoryItem };
    } else if (addToTestHistory) {
      update.$addToSet = {
        testCycleHistory: { $each: networkObj.testCycleHistory },
      };
    }

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    const nnDbUpdated = await global.wordAssoDb.NeuralNetwork.findOneAndUpdate(
      query,
      update,
      options
    );

    if (verbose) {
      nnTools.printNetworkObj(
        PF + " | +++ NN DB UPDATED",
        nnDbUpdated,
        chalkGreen
      );
    }

    return nnDbUpdated;
  } catch (err) {
    console.log(chalkError(`${PF} | *** updateDbNetwork ERROR: ${err}`));
    throw err;
  }
}

let waitInterval;

function wait(params) {
  return new Promise(function (resolve) {
    if (userDbUpdateQueue <= configuration.maxUserDbUpdateQueue) {
      return resolve(true);
    }

    if (params.message && params.verbose) {
      console.log(
        chalkLog(
          PF + " | " + params.message + " | PERIOD: " + params.period + " MS"
        )
      );
    }

    const start = moment().valueOf();

    intervalsSet.add("waitInterval");

    waitInterval = setInterval(function () {
      if (userDbUpdateQueue < configuration.maxUserDbUpdateQueue) {
        const deltaMS = moment().valueOf() - start;

        clearInterval(waitInterval);

        if (params.verbose) {
          console.log(
            chalkLog(
              PF +
                " | XXX WAIT END BACK PRESSURE" +
                " | UDBUQ: " +
                userDbUpdateQueue.length +
                " | PERIOD: " +
                params.period +
                " MS" +
                " | TOTAL WAIT: " +
                deltaMS +
                " MS"
            )
          );
        }

        return resolve(true);
      }
    }, params.period);
  });
}

async function cursorDataHandler(user) {
  try {
    if (!user) {
      return;
    }

    processUserQueue.push(user);

    // const queueOverShoot = processUserQueue - configuration.maxProcessUserQueue;
    const queueOverShoot =
      userDbUpdateQueue.length - configuration.maxUserDbUpdateQueue;

    if (queueOverShoot > 0) {
      const period = queueOverShoot * configuration.backPressurePeriod;

      await wait({
        // message: "BK PRSSR | PUQ: " + processUserQueue,
        message: "BK PRSSR | PUQ: " + userDbUpdateQueue.length,
        period: period,
        verbose: true,
      });
    }

    return;
  } catch (err) {
    console.log(chalkError(PF + " | *** cursorDataHandler ERROR: " + err));
  }
}

process.title = MODULE_ID.toLowerCase() + "_" + process.pid;

process.on("exit", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS EXIT" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
});

process.on("close", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS CLOSE" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
});

process.on("SIGHUP", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS SIGHUP" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  quit({ cause: "SIGINT" });
});

process.on("SIGINT", function (code, signal) {
  console.log(
    chalkAlert(
      PF +
        " | PROCESS SIGINT" +
        " | " +
        getTimeStamp() +
        " | " +
        `CODE: ${code}` +
        " | " +
        `SIGNAL: ${signal}`
    )
  );
  quit({ cause: "SIGINT" });
});

process.on("unhandledRejection", function (err, promise) {
  console.trace(
    PF + " | *** Unhandled rejection (promise: ",
    promise,
    ", reason: ",
    err,
    ")."
  );
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

  console.log(chalkBlue(PF + " | INIT CONFIG"));

  if (debug.enabled) {
    console.log(
      "\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n"
    );
  }

  cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
  cnf.testMode = process.env.TEST_MODE == "true" ? true : cnf.testMode;
  cnf.quitOnError = process.env.QUIT_ON_ERROR || false;
  cnf.enableStdin = process.env.ENABLE_STDIN || true;

  if (process.env.QUIT_ON_COMPLETE == "false") {
    cnf.quitOnComplete = false;
  } else if (
    process.env.QUIT_ON_COMPLETE == true ||
    process.env.QUIT_ON_COMPLETE == "true"
  ) {
    cnf.quitOnComplete = true;
  }

  try {
    await loadAllConfigFiles();
    await loadCommandLineArgs();

    const configArgs = Object.keys(configuration);

    for (const arg of configArgs) {
      if (arg === "ssh") {
        console.log(
          PF + " | _FINAL CONFIG | " + arg + " | " + DEFAULT_SSH_PRIVATEKEY
        );
      } else if (_.isObject(configuration[arg])) {
        console.log(
          PF +
            " | _FINAL CONFIG | " +
            arg +
            "\n" +
            jsonPrint(configuration[arg])
        );
      } else {
        console.log(
          PF + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]
        );
      }
    }

    statsObj.commandLineArgsLoaded = true;

    if (configuration.enableStdin) {
      initStdIn();
    }

    await initStatsUpdate();

    return configuration;
  } catch (err) {
    console.log(chalkError(PF + " | *** CONFIG LOAD ERROR: " + err));
    throw err;
  }
}

//=========================================================================
// MONGO DB
//=========================================================================

async function showStats(options) {
  statsObj.queues.saveFileQueue.size = tcUtils.getSaveFileQueue();

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();

  statsObj.elapsedMS = moment().valueOf() - startTimeMoment.valueOf();

  statsObj.users.processed.elapsed =
    moment().valueOf() - statsObj.users.processed.startMoment.valueOf(); // mseconds
  statsObj.users.processed.rate =
    statsObj.users.processed.total > 0
      ? statsObj.users.processed.elapsed / statsObj.users.processed.total
      : 0; // msecs/usersArchived
  statsObj.users.processed.remain =
    statsObj.users.processed.grandTotal -
    (statsObj.users.processed.total + statsObj.users.processed.errors);
  statsObj.users.processed.remainMS =
    statsObj.users.processed.remain * statsObj.users.processed.rate; // mseconds
  statsObj.users.processed.endMoment = moment();
  statsObj.users.processed.endMoment.add(
    statsObj.users.processed.remainMS,
    "ms"
  );
  statsObj.users.processed.percent =
    (100 * statsObj.users.processed.total) /
    statsObj.users.processed.grandTotal;

  statsObjSmall = pick(statsObj, statsPickArray);

  if (options) {
    console.log(PF + " | STATS\n" + jsonPrint(statsObjSmall));
    return;
  } else {
    console.log(
      chalkBlue(
        PF +
          " | STATUS" +
          " | START: " +
          statsObj.startTime +
          " | NOW: " +
          statsObj.timeStamp +
          " | ELAPSED: " +
          statsObj.elapsed +
          " || FSM: " +
          fsm.getMachineState() +
          " || BEST NN: " +
          statsObj.bestNetwork.networkId +
          " | SR: " +
          statsObj.bestNetwork.successRate.toFixed(2) +
          " | MR: " +
          statsObj.bestNetwork.matchRate.toFixed(2) +
          " | OAMR: " +
          statsObj.bestNetwork.overallMatchRate.toFixed(2) +
          " | RMR: " +
          statsObj.bestNetwork.runtimeMatchRate.toFixed(2)
      )
    );

    console.log(
      chalkBlue(
        PF +
          " | STATUS" +
          " | PUQ: " +
          processUserQueue.length +
          " | UDUQ: " +
          userDbUpdateQueue.length +
          " | DATUM $: K: " +
          nnTools.datumCacheGetStats().keys +
          " | HR: " +
          nnTools.datumCacheGetStats().hitRate.toFixed(3) +
          "%" +
          " | PRCSSD/ERR/REM/TOT: " +
          statsObj.users.processed.total +
          "/" +
          statsObj.users.processed.errors +
          "/" +
          statsObj.users.processed.remain +
          "/" +
          statsObj.users.processed.grandTotal +
          " (" +
          statsObj.users.processed.percent.toFixed(2) +
          "%)" +
          " | ETC (" +
          (statsObj.users.processed.rate / 1000).toFixed(3) +
          " SPU): " +
          msToTime(statsObj.users.processed.remainMS) +
          " / " +
          moment()
            .add(statsObj.users.processed.remainMS)
            .format(compactDateTimeFormat) +
          " | " +
          statsObj.users.categorized.manual +
          " MAN" +
          " | " +
          statsObj.users.categorized.auto +
          " AUTO" +
          " | " +
          statsObj.users.categorized.matched +
          " MATCH" +
          " / " +
          statsObj.users.categorized.mismatched +
          " MISMATCH" +
          " | " +
          statsObj.users.categorized.matchRate.toFixed(2) +
          "%"
      )
    );

    return;
  }
}

function initStatsUpdate() {
  return new Promise(function (resolve) {
    console.log(
      chalkLog(
        PF +
          " | INIT STATS UPDATE INTERVAL | " +
          msToTime(configuration.statsUpdateIntervalTime)
      )
    );

    statsObj.elapsed = getElapsedTimeStamp();
    statsObj.timeStamp = getTimeStamp();

    intervalsSet.add("statsUpdateInterval");

    clearInterval(statsUpdateInterval);

    statsUpdateInterval = setInterval(async function () {
      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue({
        folder: statsFolder,
        file: statsFile,
        obj: statsObj,
      });

      try {
        await showStats();
      } catch (err) {
        console.log(chalkError(PF + " | *** SHOW STATS ERROR: " + err));
      }
    }, configuration.statsUpdateIntervalTime);

    resolve();
  });
}

// ==================================================================
// DROPBOX
// ==================================================================

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_CONFIG_FILE =
  process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE =
  process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const configDefaultFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/default"
);
const configHostFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility",
  hostname
);

const configDefaultFile =
  "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const configHostFile =
  hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

configuration.local = {};
configuration.local.userDataFolder = path.join(
  configHostFolder,
  "trainingSets/users/data"
);

configuration.default = {};
configuration.default.userDataFolder = path.join(
  configDefaultFolder,
  "trainingSets/users/data"
);

configuration.userDataFolder = configuration[HOST].userDataFolder;
configuration.trainingSetsFolder = path.join(
  configDefaultFolder,
  "trainingSets"
);

const statsFolder = path.join(DROPBOX_ROOT_FOLDER, "stats", hostname);
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const globalBestNetworkFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "/config/utility/best/neuralNetworks"
);
const globalBestNetworkArchiveFolder = globalBestNetworkFolder + "/archive";
const bestNetworkFolder = path.join(
  DROPBOX_ROOT_FOLDER,
  "config/utility/best/neuralNetworks"
);

configuration.neuralNetworkFolder = configDefaultFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

const defaultInputsConfigFile = "default_networkInputsConfig.json";
const hostInputsConfigFile = hostname + "_networkInputsConfig.json";

function filesListFolder(params) {
  return new Promise(function (resolve, reject) {
    fs.readdir(params.folder, function (err, items) {
      if (err) {
        reject(err);
      } else {
        const itemArray = [];

        async.eachSeries(
          items,
          function (item, cb) {
            itemArray.push({
              name: item,
              client_modified: false,
              content_hash: false,
              path_display: path.join(params.folder, item),
            });
            cb();
          },
          function (err) {
            if (err) {
              return reject(err);
            }
            const response = {
              cursor: false,
              has_more: false,
              entries: itemArray,
            };

            resolve(response);
          }
        );
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

    const loadedConfigObj = await tcUtils.loadFile({
      folder: params.folder,
      file: params.file,
      noErrorNotFound: params.noErrorNotFound,
    });

    if (loadedConfigObj === undefined) {
      if (params.noErrorNotFound) {
        console.log(
          chalkAlert(
            PF +
              " | ... SKIP LOAD CONFIG FILE: " +
              params.folder +
              "/" +
              params.file
          )
        );
        return newConfiguration;
      } else {
        console.log(
          chalkError(PF + " | *** CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? ")
        );
        throw new Error("JSON UNDEFINED");
      }
    }

    if (loadedConfigObj instanceof Error) {
      console.log(
        chalkError(PF + " | *** CONFIG LOAD FILE ERROR: " + loadedConfigObj)
      );
    }

    console.log(
      chalkInfo(
        PF +
          " | LOADED CONFIG FILE: " +
          params.file +
          "\n" +
          jsonPrint(loadedConfigObj)
      )
    );

    if (loadedConfigObj.TFE_TEST_MODE !== undefined) {
      console.log(
        "TFE | LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE
      );
      if (
        loadedConfigObj.TFE_TEST_MODE == true ||
        loadedConfigObj.TFE_TEST_MODE == "true"
      ) {
        newConfiguration.testMode = true;
      }
      if (
        loadedConfigObj.TFE_TEST_MODE == false ||
        loadedConfigObj.TFE_TEST_MODE == "false"
      ) {
        newConfiguration.testMode = false;
      }
    }

    if (loadedConfigObj.TFE_BACKPRESSURE_PERIOD !== undefined) {
      console.log(
        "TFE | LOADED TFE_BACKPRESSURE_PERIOD: " +
          loadedConfigObj.TFE_BACKPRESSURE_PERIOD
      );
      newConfiguration.backPressurePeriod =
        loadedConfigObj.TFE_BACKPRESSURE_PERIOD;
    }

    if (loadedConfigObj.TFE_CURSOR_PARALLEL !== undefined) {
      console.log(
        "TFE | LOADED TFE_CURSOR_PARALLEL: " +
          loadedConfigObj.TFE_CURSOR_PARALLEL
      );
      newConfiguration.cursorParallel = loadedConfigObj.TFE_CURSOR_PARALLEL;
    }

    if (loadedConfigObj.TFE_PARSE_IMAGE_REQUEST_TIMEOUT !== undefined) {
      console.log(
        "TFE | LOADED TFE_PARSE_IMAGE_REQUEST_TIMEOUT: " +
          loadedConfigObj.TFE_PARSE_IMAGE_REQUEST_TIMEOUT
      );
      newConfiguration.parseImageRequestTimeout =
        loadedConfigObj.TFE_PARSE_IMAGE_REQUEST_TIMEOUT;
    }

    if (loadedConfigObj.TFE_USER_CURSOR_BATCH_SIZE !== undefined) {
      console.log(
        "TFE | LOADED TFE_USER_CURSOR_BATCH_SIZE: " +
          loadedConfigObj.TFE_USER_CURSOR_BATCH_SIZE
      );
      newConfiguration.userCursorBatchSize =
        loadedConfigObj.TFE_USER_CURSOR_BATCH_SIZE;
    }

    if (loadedConfigObj.TFE_USER_CURSOR_LIMIT !== undefined) {
      console.log(
        "TFE | LOADED TFE_USER_CURSOR_LIMIT: " +
          loadedConfigObj.TFE_USER_CURSOR_LIMIT
      );
      newConfiguration.userCursorLimit = loadedConfigObj.TFE_USER_CURSOR_LIMIT;
    }

    if (loadedConfigObj.TFE_MAX_USER_DB_UPDATE_QUEUE !== undefined) {
      console.log(
        "TFE | LOADED TFE_MAX_USER_DB_UPDATE_QUEUE: " +
          loadedConfigObj.TFE_MAX_USER_DB_UPDATE_QUEUE
      );
      newConfiguration.maxUserDbUpdateQueue =
        loadedConfigObj.TFE_MAX_USER_DB_UPDATE_QUEUE;
    }

    if (loadedConfigObj.TFE_PROCESS_USER_MAX_PARALLEL !== undefined) {
      console.log(
        "TFE | LOADED TFE_PROCESS_USER_MAX_PARALLEL: " +
          loadedConfigObj.TFE_PROCESS_USER_MAX_PARALLEL
      );
      newConfiguration.userProcessMaxParallel =
        loadedConfigObj.TFE_PROCESS_USER_MAX_PARALLEL;
    }

    if (loadedConfigObj.TFE_USER_DB_UPDATE_MAX_PARALLEL !== undefined) {
      console.log(
        "TFE | LOADED TFE_USER_DB_UPDATE_MAX_PARALLEL: " +
          loadedConfigObj.TFE_USER_DB_UPDATE_MAX_PARALLEL
      );
      newConfiguration.userDbUpdateMaxParallel =
        loadedConfigObj.TFE_USER_DB_UPDATE_MAX_PARALLEL;
    }

    if (loadedConfigObj.TFE_ENABLE_FETCH_TWEETS !== undefined) {
      console.log(
        "TFE | LOADED TFE_ENABLE_FETCH_TWEETS: " +
          loadedConfigObj.TFE_ENABLE_FETCH_TWEETS
      );
      if (
        loadedConfigObj.TFE_ENABLE_FETCH_TWEETS == true ||
        loadedConfigObj.TFE_ENABLE_FETCH_TWEETS == "true"
      ) {
        newConfiguration.enableFetchTweets = true;
      }
      if (
        loadedConfigObj.TFE_ENABLE_FETCH_TWEETS == false ||
        loadedConfigObj.TFE_ENABLE_FETCH_TWEETS == "false"
      ) {
        newConfiguration.enableFetchTweets = false;
      }
    }

    if (loadedConfigObj.TFE_UPDATE_GLOBAL_HISTOGRAMS !== undefined) {
      console.log(
        "TFE | LOADED TFE_UPDATE_GLOBAL_HISTOGRAMS: " +
          loadedConfigObj.TFE_UPDATE_GLOBAL_HISTOGRAMS
      );
      if (
        loadedConfigObj.TFE_UPDATE_GLOBAL_HISTOGRAMS == true ||
        loadedConfigObj.TFE_UPDATE_GLOBAL_HISTOGRAMS == "true"
      ) {
        newConfiguration.updateGlobalHistograms = true;
      }
      if (
        loadedConfigObj.TFE_UPDATE_GLOBAL_HISTOGRAMS == false ||
        loadedConfigObj.TFE_UPDATE_GLOBAL_HISTOGRAMS == "false"
      ) {
        newConfiguration.updateGlobalHistograms = false;
      }
    }

    if (loadedConfigObj.TFE_SAVE_FILE_QUEUE_INTERVAL !== undefined) {
      console.log(
        "TFE | LOADED TFE_SAVE_FILE_QUEUE_INTERVAL: " +
          loadedConfigObj.TFE_SAVE_FILE_QUEUE_INTERVAL
      );
      newConfiguration.saveFileQueueInterval =
        loadedConfigObj.TFE_SAVE_FILE_QUEUE_INTERVAL;
    }

    if (loadedConfigObj.TFE_PROCESS_USER_QUEUE_INTERVAL !== undefined) {
      console.log(
        "TFE | LOADED TFE_PROCESS_USER_QUEUE_INTERVAL: " +
          loadedConfigObj.TFE_PROCESS_USER_QUEUE_INTERVAL
      );
      newConfiguration.processUserQueueInterval =
        loadedConfigObj.TFE_PROCESS_USER_QUEUE_INTERVAL;
    }

    if (loadedConfigObj.TFE_ACTIVATE_NETWORK_QUEUE_INTERVAL !== undefined) {
      console.log(
        "TFE | LOADED TFE_ACTIVATE_NETWORK_QUEUE_INTERVAL: " +
          loadedConfigObj.TFE_ACTIVATE_NETWORK_QUEUE_INTERVAL
      );
      newConfiguration.activateNetworkQueueInterval =
        loadedConfigObj.TFE_ACTIVATE_NETWORK_QUEUE_INTERVAL;
    }

    if (loadedConfigObj.TFE_USER_DB_UPDATE_QUEUE_INTERVAL !== undefined) {
      console.log(
        "TFE | LOADED TFE_USER_DB_UPDATE_QUEUE_INTERVAL: " +
          loadedConfigObj.TFE_USER_DB_UPDATE_QUEUE_INTERVAL
      );
      newConfiguration.userDbUpdateQueueInterval =
        loadedConfigObj.TFE_USER_DB_UPDATE_QUEUE_INTERVAL;
    }

    if (loadedConfigObj.TFE_NN_DB_LOAD_PER_INPUTS !== undefined) {
      console.log(
        "TFE | LOADED TFE_NN_DB_LOAD_PER_INPUTS: " +
          loadedConfigObj.TFE_NN_DB_LOAD_PER_INPUTS
      );
      newConfiguration.networkDatabaseLoadPerInputsLimit =
        loadedConfigObj.TFE_NN_DB_LOAD_PER_INPUTS;
    }

    if (loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS !== undefined) {
      console.log(
        "TFE | LOADED TFE_RANDOM_UNTESTED_NN_PER_INPUTS: " +
          loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS
      );
      newConfiguration.randomUntestedPerInputsLimit =
        loadedConfigObj.TFE_RANDOM_UNTESTED_NN_PER_INPUTS;
    }

    if (loadedConfigObj.TFE_NN_NUMBER_LIMIT !== undefined) {
      console.log(
        "TFE | LOADED TFE_NN_NUMBER_LIMIT: " +
          loadedConfigObj.TFE_NN_NUMBER_LIMIT
      );
      newConfiguration.networkNumberLimit = loadedConfigObj.TFE_NN_NUMBER_LIMIT;
    }

    if (loadedConfigObj.TFE_MIN_TEST_CYCLES !== undefined) {
      console.log(
        "TFE | LOADED TFE_MIN_TEST_CYCLES: " +
          loadedConfigObj.TFE_MIN_TEST_CYCLES
      );
      newConfiguration.minTestCycles = loadedConfigObj.TFE_MIN_TEST_CYCLES;
    }

    if (loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE !== undefined) {
      console.log(
        "TFE | LOADED TFE_BEST_NN_INCREMENTAL_UPDATE: " +
          loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE
      );
      if (
        loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE == true ||
        loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE == "true"
      ) {
        newConfiguration.bestNetworkIncrementalUpdate = true;
      }
      if (
        loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE == false ||
        loadedConfigObj.TFE_BEST_NN_INCREMENTAL_UPDATE == "false"
      ) {
        newConfiguration.bestNetworkIncrementalUpdate = false;
      }
    }

    if (loadedConfigObj.TFE_QUIT_ON_COMPLETE !== undefined) {
      console.log(
        "TFE | LOADED TFE_QUIT_ON_COMPLETE: " +
          loadedConfigObj.TFE_QUIT_ON_COMPLETE
      );
      if (
        loadedConfigObj.TFE_QUIT_ON_COMPLETE == true ||
        loadedConfigObj.TFE_QUIT_ON_COMPLETE == "true"
      ) {
        newConfiguration.quitOnComplete = true;
      }
      if (
        loadedConfigObj.TFE_QUIT_ON_COMPLETE == false ||
        loadedConfigObj.TFE_QUIT_ON_COMPLETE == "false"
      ) {
        newConfiguration.quitOnComplete = false;
      }
    }

    if (loadedConfigObj.TFE_VERBOSE !== undefined) {
      console.log("TFE | LOADED TFE_VERBOSE: " + loadedConfigObj.TFE_VERBOSE);
      if (
        loadedConfigObj.TFE_VERBOSE == true ||
        loadedConfigObj.TFE_VERBOSE == "true"
      ) {
        newConfiguration.verbose = true;
      }
      if (
        loadedConfigObj.TFE_VERBOSE == false ||
        loadedConfigObj.TFE_VERBOSE == "false"
      ) {
        newConfiguration.verbose = false;
      }
    }

    if (loadedConfigObj.TFE_BARE_MIN_SUCCESS_RATE !== undefined) {
      console.log(
        "TFE | LOADED TFE_BARE_MIN_SUCCESS_RATE: " +
          loadedConfigObj.TFE_BARE_MIN_SUCCESS_RATE
      );
      newConfiguration.bareMinSuccessRate =
        loadedConfigObj.TFE_BARE_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE !== undefined) {
      console.log(
        "TFE | LOADED TFE_GLOBAL_MIN_SUCCESS_RATE: " +
          loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE
      );
      newConfiguration.globalMinSuccessRate =
        loadedConfigObj.TFE_GLOBAL_MIN_SUCCESS_RATE;
    }

    if (loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS !== undefined) {
      console.log(
        "TFE | LOADED TFE_ENABLE_LANG_ANALYSIS: " +
          loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS
      );
      newConfiguration.enableLanguageAnalysis =
        loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS;
    }

    if (loadedConfigObj.TFE_ENABLE_GEOCODE !== undefined) {
      console.log(
        "TFE | LOADED TFE_ENABLE_GEOCODE: " + loadedConfigObj.TFE_ENABLE_GEOCODE
      );
      newConfiguration.enableGeoCode = loadedConfigObj.TFE_ENABLE_GEOCODE;
    }

    if (loadedConfigObj.TFE_ENABLE_IMAGE_ANALYSIS !== undefined) {
      console.log(
        "TFE | LOADED TFE_ENABLE_IMAGE_ANALYSIS: " +
          loadedConfigObj.TFE_ENABLE_IMAGE_ANALYSIS
      );
      newConfiguration.enableImageAnalysis =
        loadedConfigObj.TFE_ENABLE_IMAGE_ANALYSIS;
    }

    if (loadedConfigObj.TFE_ENABLE_STDIN !== undefined) {
      console.log(
        "TFE | LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_ENABLE_STDIN
      );
      newConfiguration.enableStdin = loadedConfigObj.TFE_ENABLE_STDIN;
    }

    return newConfiguration;
  } catch (err) {
    console.error(
      chalkError(
        PF + " | ERROR LOAD CONFIG: " + fullPath + "\n" + jsonPrint(err)
      )
    );
    throw err;
  }
}

async function loadAllConfigFiles() {
  statsObj.status = "LOAD CONFIG";

  const defaultConfig = await loadConfigFile({
    folder: configDefaultFolder,
    file: configDefaultFile,
    noErrorNotFound: true,
  });

  if (defaultConfig) {
    defaultConfiguration = defaultConfig;
    console.log(
      chalkInfo(
        PF +
          " | <<< LOADED DEFAULT CONFIG " +
          configDefaultFolder +
          "/" +
          configDefaultFile
      )
    );
  }

  const hostConfig = await loadConfigFile({
    folder: configHostFolder,
    file: configHostFile,
    noErrorNotFound: true,
  });

  if (hostConfig) {
    hostConfiguration = hostConfig;
    console.log(
      chalkInfo(
        PF +
          " | <<< LOADED HOST CONFIG " +
          configHostFolder +
          "/" +
          configHostFile
      )
    );
  }

  await loadInputs({
    folder: configDefaultFolder,
    file: defaultInputsConfigFile,
    noErrorNotFound: false,
  });
  await loadInputs({
    folder: configHostFolder,
    file: hostInputsConfigFile,
    noErrorNotFound: true,
  });

  const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
  const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

  configuration = deepcopy(tempConfig);

  return;
}

//=========================================================================
// FILE SAVE
//=========================================================================
let statsUpdateInterval;

let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if (saveCacheTtl === undefined) {
  saveCacheTtl = SAVE_CACHE_DEFAULT_TTL;
}

console.log(PF + " | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) {
  saveCacheCheckPeriod = 10;
}

console.log(
  PF + " | SAVE CACHE CHECK PERIOD: " + saveCacheCheckPeriod + " SECONDS"
);

const saveCache = new NodeCache({
  stdTTL: saveCacheTtl,
  checkperiod: saveCacheCheckPeriod,
});

function saveCacheExpired(file, fileObj) {
  debug(
    chalkLog(
      "XXX $ SAVE" + " [" + saveCache.getStats().keys + "]" + " | " + file
    )
  );
  statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue(fileObj);
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function (file, fileObj) {
  debug(
    chalkLog(
      PF +
        " | $$$ SAVE CACHE" +
        " [" +
        saveCache.getStats().keys +
        "]" +
        " | " +
        fileObj.folder +
        "/" +
        file
    )
  );
});

//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals() {
  return new Promise(function (resolve, reject) {
    try {
      for (const intervalHandle of intervalsSet) {
        console.log(chalkInfo(PF + " | CLEAR INTERVAL | " + intervalHandle));
        clearInterval(intervalHandle);
      }
      resolve();
    } catch (err) {
      reject(err);
    }
  });
}

//=========================================================================
// QUIT + EXIT
//=========================================================================

let quitWaitInterval;
let quitFlag = false;

const readyToQuit = function () {
  const saveCacheKeys = saveCache.getStats().keys;
  statsObj.queues.saveFileQueue.size = tcUtils.getSaveFileQueue();
  const flag = saveCacheKeys === 0 && statsObj.queues.saveFileQueue.size === 0;
  return flag;
};

async function quit(opts) {
  if (quitFlag) {
    console.log(chalkInfo(PF + " | ALREADY IN QUIT"));
    if (opts) {
      console.log(chalkInfo(PF + " | REDUNDANT QUIT INFO\n" + jsonPrint(opts)));
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

  try {
    if (!configuration.offlineMode) {
      await slackSendWebMessage({ channel: slackChannel, text: slackText });
    }
    // await childQuitAll();
    await showStats(true);
  } catch (err) {
    console.log(PF + " | *** QUIT ERROR: " + err);
  }

  if (options) {
    console.log(PF + " | QUIT INFO\n" + jsonPrint(options));
  }

  clearInterval(quitWaitInterval);

  await clearAllIntervals();

  quitWaitInterval = setInterval(async function () {
    if (readyToQuit()) {
      await tcUtils.stopSaveFileQueue();

      clearInterval(quitWaitInterval);

      if (forceQuitFlag) {
        console.log(
          chalkAlert(
            PF +
              " | *** FORCE QUIT" +
              " | SAVE CACHE KEYS: " +
              saveCache.getStats().keys +
              " | SAVE FILE BUSY: " +
              statsObj.queues.saveFileQueue.busy +
              " | SAVE FILE Q: " +
              statsObj.queues.saveFileQueue.size
          )
        );
      } else {
        console.log(
          chalkGreen(
            PF +
              " | ALL PROCESSES COMPLETE | QUITTING" +
              " | SAVE CACHE KEYS: " +
              saveCache.getStats().keys +
              " | SAVE FILE BUSY: " +
              statsObj.queues.saveFileQueue.busy +
              " | SAVE FILE Q: " +
              statsObj.queues.saveFileQueue.size
          )
        );
      }

      if (!mongooseDb) {
        process.exit();
      } else {
        setTimeout(function () {
          mongooseDb.close(async function () {
            console.log(
              chalkBlue(
                PF +
                  " | ==========================\n" +
                  PF +
                  " | MONGO DB CONNECTION CLOSED\n" +
                  PF +
                  " | ==========================\n"
              )
            );

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

import cla from "command-line-args";

const help = { name: "help", alias: "h", type: Boolean };

const enableStdin = {
  name: "enableStdin",
  alias: "S",
  type: Boolean,
  defaultValue: true,
};
const quitOnComplete = { name: "quitOnComplete", alias: "q", type: Boolean };
const quitOnError = {
  name: "quitOnError",
  alias: "Q",
  type: Boolean,
  defaultValue: true,
};
const verbose = { name: "verbose", alias: "V", type: Boolean };
const testMode = { name: "testMode", alias: "X", type: Boolean };
const offlineMode = { name: "offlineMode", alias: "O", type: Boolean };

const useLocalTrainingSets = {
  name: "useLocalTrainingSets",
  alias: "L",
  type: Boolean,
};
const loadAllInputs = { name: "loadAllInputs", type: Boolean };
const loadTrainingSetFromFile = {
  name: "loadTrainingSetFromFile",
  alias: "t",
  type: Boolean,
};
const inputsId = { name: "inputsId", alias: "i", type: String };
const trainingSetFile = { name: "trainingSetFile", alias: "T", type: String };
const networkCreateMode = {
  name: "networkCreateMode",
  alias: "n",
  type: String,
  defaultValue: "evolve",
};
const hiddenLayerSize = { name: "hiddenLayerSize", alias: "H", type: Number };
const seedNetworkId = { name: "seedNetworkId", alias: "s", type: String };
const useBestNetwork = { name: "useBestNetwork", alias: "b", type: Boolean };
const evolveIterations = { name: "evolveIterations", alias: "I", type: Number };

const optionDefinitions = [
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
  help,
];

const commandLineConfig = cla(optionDefinitions);

console.log(
  chalkInfo(PF + " | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig))
);

if (Object.keys(commandLineConfig).includes("help")) {
  console.log(PF + " |optionDefinitions\n" + jsonPrint(optionDefinitions));
  quit("help");
}

statsObj.commandLineConfig = commandLineConfig;

function loadCommandLineArgs() {
  return new Promise(function (resolve) {
    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.eachSeries(
      commandLineConfigKeys,
      function (arg, cb) {
        if (arg == "evolveIterations") {
          configuration.evolve.iterations = commandLineConfig[arg];
          console.log(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration.evolve.iterations
          );
        } else {
          configuration[arg] = commandLineConfig[arg];
          console.log(
            PF +
              " | --> COMMAND LINE CONFIG | " +
              arg +
              ": " +
              configuration[arg]
          );
        }

        cb();
      },
      function () {
        statsObj.commandLineArgsLoaded = true;
        resolve();
      }
    );
  });
}

function toggleVerbose() {
  configuration.verbose = !configuration.verbose;
  console.log(chalkLog(PF + " | VERBOSE: " + configuration.verbose));
}

function initStdIn() {
  console.log(PF + " | STDIN ENABLED");
  stdin = process.stdin;
  if (stdin.setRawMode !== undefined) {
    stdin.setRawMode(true);
  }
  stdin.resume();
  stdin.setEncoding("utf8");
  stdin.on("data", async function (key) {
    switch (key) {
      // case "\u0003":
      //   process.exit();
      // break;
      case "a":
        abortCursor = true;
        console.log(chalkLog(PF + " | STDIN | ABORT: " + abortCursor));
        break;

      case "K":
        quit({ force: true });
        break;

      case "q":
        quit({ source: "STDIN" });
        break;
      case "Q":
        process.exit();
        break;

      case "S":
      case "s":
        try {
          await showStats(key == "S");
        } catch (err) {
          console.log(chalkError(PF + " | *** SHOW STATS ERROR: " + err));
        }
        break;

      case "V":
        toggleVerbose();
        break;

      default:
        console.log(
          chalkInfo(
            "\nTFE | " +
              "q/Q: quit" +
              "\nTFE | " +
              "s: showStats" +
              "\nTFE | " +
              "S: showStats verbose" +
              "\nTFE | " +
              "V: toggle verbose"
          )
        );
    }
  });
}

//=========================================================================
// FSM
//=========================================================================
import Stately from "stately.js";

let fsmTickInterval;
let fsmPreviousState = "RESET";

function isBestNetwork(p) {
  const params = p !== undefined ? p : {};

  const minOverallMatchRate =
    params.minOverallMatchRate !== undefined
      ? params.minOverallMatchRate
      : configuration.globalMinSuccessRate;
  const bareMinSuccessRate =
    params.bareMinSuccessRate !== undefined
      ? params.bareMinSuccessRate
      : configuration.bareMinSuccessRate;
  const minTestCycles =
    params.minTestCycles !== undefined
      ? params.minTestCycles
      : configuration.minTestCycles;

  if (params.networkObj.testCycles <= minTestCycles) {
    debug("minTestCycles: " + params.networkObj.testCycles);

    // delete if *really* bad nn
    if (
      params.networkObj.testCycles > 0 &&
      params.networkObj.overallMatchRate > 0 &&
      params.networkObj.overallMatchRate < bareMinSuccessRate
    ) {
      debug(
        "less than bareMinSuccessRate: " + params.networkObj.overallMatchRate
      );
      return false;
    }

    return true;
  } else if (
    params.networkObj.overallMatchRate &&
    params.networkObj.overallMatchRate >= minOverallMatchRate
  ) {
    debug("overallMatchRate: " + params.networkObj.overallMatchRate.toFixed(2));
    return true;
  } else {
    return false;
  }
}

async function fixIncorrectNetworkMetaData(params) {
  try {
    let incorrectUpdateFlag = false;

    if (params.networkObj.runtimeMatchRate === undefined) {
      params.networkObj.runtimeMatchRate = 0;
    }

    if (
      params.networkObj.evolve &&
      params.networkObj.evolve.options.networkTechnology &&
      params.networkObj.evolve.options.networkTechnology !==
        params.networkObj.networkTechnology
    ) {
      console.log(
        chalkAlert(
          PF +
            " | !!! INCORRECT NETWORK TECH | CHANGE " +
            params.networkObj.networkTechnology +
            " -> " +
            params.networkObj.evolve.options.networkTechnology +
            " | " +
            params.networkObj.networkId
        )
      );
      params.networkObj.networkTechnology =
        params.networkObj.evolve.options.networkTechnology;
      incorrectUpdateFlag = "networkTechnology";
    }

    if (
      params.networkObj.evolve &&
      params.networkObj.evolve.options.binaryMode !== undefined &&
      params.networkObj.evolve.options.binaryMode !==
        params.networkObj.binaryMode
    ) {
      console.log(
        chalkAlert(
          PF +
            " | !!! INCORRECT BINARY MODE | CHANGE " +
            params.networkObj.binaryMode +
            " -> " +
            params.networkObj.evolve.options.binaryMode +
            " | " +
            params.networkObj.networkId
        )
      );
      params.networkObj.binaryMode =
        params.networkObj.evolve.options.binaryMode;
      incorrectUpdateFlag = "binaryMode";
    }

    if (incorrectUpdateFlag) {
      console.log(
        chalkLog(
          PF +
            " | ... SAVING UPDATED INCORRECT NN META DATA" +
            " | INCORRECT FLAG: " +
            incorrectUpdateFlag +
            " | " +
            params.networkObj.networkId
        )
      );
      if (!params.updateDatabaseOnly) {
        await tcUtils.saveFile({
          folder: params.folder,
          file: params.file,
          obj: params.networkObj,
        });
      }
    }

    return params.networkObj;
  } catch (err) {
    console.log(
      chalkAlert(PF + " | *** fixIncorrectNetworkMetaData ERROR | " + err)
    );
    throw err;
  }
}

async function loadNetworkFile(params) {
  const folder = params.folder;
  const entry = params.entry;
  const networkTechnology = params.networkTechnology;

  let nnObj = await tcUtils.loadFileRetry({ folder: folder, file: entry.name });

  if (!nnObj || nnObj === undefined) {
    console.log(
      chalkError(PF + " | ??? NN NOT FOUND? | " + folder + "/" + entry.name)
    );
    return;
  }

  if (
    networkTechnology &&
    networkTechnology !== undefined &&
    nnObj.networkTechnology !== networkTechnology
  ) {
    console.log(
      chalkAlert(
        PF +
          " | ... SKIP | NN TECH: " +
          nnObj.networkTechnology +
          " | TECH FILTER: " +
          networkTechnology +
          " | " +
          folder +
          "/" +
          entry.name
      )
    );
    return;
  }

  if (
    nnObj.testCycleHistory &&
    nnObj.testCycleHistory !== undefined &&
    nnObj.testCycleHistory.length > 0
  ) {
    nnObj.previousRank =
      nnObj.testCycleHistory[nnObj.testCycleHistory.length - 1].rank;

    console.log(
      chalkLog(
        PF +
          " | TECH: " +
          nnObj.networkTechnology +
          " | PREV RANK: " +
          nnObj.previousRank +
          " | RANK: " +
          nnObj.rank +
          " | " +
          nnObj.networkId
      )
    );
  }

  try {
    if (nnObj.meta === undefined) {
      nnObj.meta = {};
    }
    nnObj.meta.total = 0;
    nnObj.meta.match = 0;
    nnObj.meta.mismatch = 0;

    nnObj = await fixIncorrectNetworkMetaData({
      networkObj: nnObj,
      folder: folder,
      file: entry.name,
    });
    const networkObj = await nnTools.convertNetwork({ networkObj: nnObj });

    if (!inputsIdSet.has(networkObj.inputsId)) {
      console.log(
        chalkLog(
          "TFE | LOAD BEST NN HM INPUTS ID MISS ... SKIP HM ADD" +
            " | IN: " +
            networkObj.numInputs +
            " | " +
            networkObj.networkId +
            " | INPUTS ID: " +
            networkObj.inputsId
        )
      );

      if (configuration.archiveNetworkOnInputsMiss && !networkObj.archived) {
        console.log(
          chalkLog(
            "TFE | ARCHIVE NN ON INPUTS ID MISS" +
              " | IN: " +
              networkObj.numInputs +
              " | " +
              networkObj.networkId +
              " | INPUTS ID: " +
              networkObj.inputsId +
              "\nTFE | FROM: " +
              folder +
              "/" +
              entry.name +
              " | TO: " +
              globalBestNetworkArchiveFolder
          )
        );

        try {
          await renameFileAsync(
            path.join(folder, entry.name),
            path.join(globalBestNetworkArchiveFolder, entry.name)
          );

          const updateDbNetworkParams = {};
          updateDbNetworkParams.networkObj = networkObj;
          updateDbNetworkParams.incrementTestCycles = false;
          updateDbNetworkParams.addToTestHistory = false;
          updateDbNetworkParams.verbose = true;
          updateDbNetworkParams.networkObj.archived = true;

          await updateDbNetwork(updateDbNetworkParams);
          return;
        } catch (err) {
          console.log(
            chalkError(
              PF +
                " | *** RENAME ERROR: " +
                err +
                " | " +
                path.join(folder, entry.name)
            )
          );
        }
      }
    } else if (
      isBestNetwork({ networkObj: networkObj }) &&
      !bestNetworkHashMap.has(networkObj.networkId)
    ) {
      bestNetworkHashMap.set(networkObj.networkId, networkObj);

      nnTools.printNetworkObj(
        PF +
          " | +++ NN" +
          " [" +
          bestNetworkHashMap.size +
          " HM]" +
          " [" +
          skipLoadNetworkSet.size +
          " SKP]",
        networkObj,
        chalkGreen
      );
    } else if (!isBestNetwork({ networkObj: networkObj })) {
      skipLoadNetworkSet.add(networkObj.networkId);

      nnTools.printNetworkObj(
        PF + " | XXX DELETE DB NN",
        networkObj,
        chalk.red
      );

      await global.wordAssoDb.NeuralNetwork.deleteOne({
        networkId: networkObj.networkId,
      });
    }

    const updateDbNetworkParams = {};

    updateDbNetworkParams.networkObj = networkObj;
    updateDbNetworkParams.incrementTestCycles = false;
    updateDbNetworkParams.addToTestHistory = false;
    updateDbNetworkParams.verbose = true;

    if (skipLoadNetworkSet.has(networkObj.networkId) && !networkObj.archived) {
      console.log(
        chalk.black.bold(
          PF +
            " | vvv ARCHIVE NN" +
            " | " +
            folder +
            "/" +
            entry.name +
            " > " +
            globalBestNetworkArchiveFolder
        )
      );

      await renameFileAsync(
        path.join(folder, entry.name),
        path.join(globalBestNetworkArchiveFolder, entry.name)
      );

      return;
    } else {
      if (networkObj.archived) {
        if (networkObj.overallMatchRate >= configuration.globalMinSuccessRate) {
          nnTools.printNetworkObj(
            PF + " | ??? NN ARCHIVED BUT GLOBAL SUCCESS | SKIP DELETE",
            networkObj
          );
          return;
        } else {
          console.log(
            chalkLog(
              PF + " | ... NN ALREADY ARCHIVED | " + networkObj.networkId
            )
          );

          await updateDbNetwork(updateDbNetworkParams);

          const deletePath = folder + "/" + entry.name;

          console.log(
            chalkLog(
              PF + " | ... NN ALREADY ARCHIVED | DELETING: " + deletePath
            )
          );

          await unlinkFileAsync(deletePath);
          console.log(
            chalkAlert(
              PF + " | ... NN ALREADY ARCHIVED | DELETED: " + deletePath
            )
          );
          return;
        }
      }
    }
  } catch (err) {
    console.log(
      chalkAlert(
        PF +
          " | *** loadNetworkFile ERROR ... SKIP LOAD | " +
          nnObj.networkId +
          " | " +
          err
      )
    );
    return;
  }
}

async function loadBestNetworksFolder(params) {
  console.log(chalkLog("TFE | LOAD BEST NETWORKS FOLDER"));

  statsObj.status = "LOAD BEST NNs FOLDER";

  const folder = params.folder;
  const networkTechnology = params.networkTechnology || false;

  console.log(
    chalkInfo(
      "TFE | LOADING FOLDER BEST NETWORKS | " +
        folder +
        "\n" +
        jsonPrint(params)
    )
  );

  const results = await filesListFolder({ folder: folder });

  if (results === undefined || !results) {
    console.log(
      chalkError("TFE | FOLDER LIST FOLDER ERROR | RESULT UNDEFINED ??? ")
    );
    throw new Error("FOLDER LOAD LIST FOLDER ERROR | RESULT UNDEFINED");
  }

  let resultsArray = [];

  if (configuration.testMode) {
    resultsArray = _.sampleSize(results.entries, TEST_MODE_NUM_NN);
  } else {
    resultsArray = results.entries;
  }

  console.log(chalkInfo("TFE | ENTRIES: " + resultsArray.length));

  const loadNetworkFilePromiseArray = [];

  for (const entry of resultsArray) {
    if (
      !entry.name.endsWith(".json") ||
      entry.name.startsWith("bestRuntimeNetwork")
    ) {
      console.log(
        chalkWarn(
          "TFE | ... SKIP LOAD FOLDER BEST NETWORKS | " +
            folder +
            "/" +
            entry.name
        )
      );
    } else {
      loadNetworkFilePromiseArray.push(
        loadNetworkFile({
          folder: folder,
          entry: entry,
          networkTechnology: networkTechnology,
        })
      );
    }
  }

  await Promise.all(loadNetworkFilePromiseArray)
    .then(function () {
      console.log(
        chalkGreen("TFE | +++ LOAD FOLDER BEST NETWORKS COMPLETE | " + folder)
      );
      return;
    })
    .catch(function (err) {
      console.log(
        chalkError("TFE | *** LOAD FOLDER BEST NETWORKS ERROR: " + err)
      );
      throw err;
    });
}

async function loadNetworksOfInputs(params) {
  let nnArray = [];

  console.log(
    chalkLog(PF + " | ... LOADING | TECH FILTER: " + params.networkTechnology)
  );
  console.log(
    chalkLog(
      PF +
        " | ... LOADING " +
        params.networkDatabaseLoadPerInputsLimit +
        " BEST NNs PER INPUTS ID (by OAMR) FROM DB ..."
    )
  );
  console.log(
    chalkLog(
      PF +
        " | ... LOADING " +
        params.randomUntestedPerInputsLimit +
        " UNTESTED NNs FROM DB ..."
    )
  );

  const minSuccessRate = configuration.testMode
    ? TEST_GLOBAL_MIN_SUCCESS_RATE_MULTIPLIER * params.globalMinSuccessRate
    : params.globalMinSuccessRate;

  for (const inputsId of params.inputsIdArray) {
    console.log(
      chalkLog(PF + " | ... LOADING NN FROM DB | INPUTS ID: " + inputsId)
    );

    let query = {};

    query.inputsId = inputsId;

    if (params.networkTechnology) {
      query.networkTechnology = params.networkTechnology;
    }

    if (params.minTestCycles) {
      query = {};

      query.$and = [
        { inputsId: inputsId },
        { overallMatchRate: { $gte: minSuccessRate } },
      ];

      if (params.networkTechnology) {
        query.$and.push({ networkTechnology: params.networkTechnology });
      }
    }

    const randomUntestedQuery = {};

    randomUntestedQuery.$and = [
      { inputsId: inputsId },
      { successRate: { $gte: minSuccessRate } },
      { testCycles: { $lte: params.minTestCycles } },
    ];

    if (params.networkTechnology) {
      randomUntestedQuery.$and.push({
        networkTechnology: params.networkTechnology,
      });
    }

    if (configuration.verbose) {
      console.log(chalkBlueBold("query\n" + jsonPrint(query)));
      console.log(
        chalkBlueBold("randomUntestedQuery\n" + jsonPrint(randomUntestedQuery))
      );
    }

    let nnArrayTopOverallMatchRate = [];
    let nnArrayRandomUntested = [];

    nnArrayTopOverallMatchRate = await global.wordAssoDb.NeuralNetwork.find(
      query
    )
      .lean()
      .sort({ overallMatchRate: -1 })
      .limit(params.networkDatabaseLoadPerInputsLimit);

    if (nnArrayTopOverallMatchRate.length > 0) {
      console.log(
        chalkBlue(
          "TFE | FOUND " +
            nnArrayTopOverallMatchRate.length +
            " BEST NNs PER INPUTS ID (by OAMR) FROM DB ..."
        )
      );
    }

    nnArrayRandomUntested = await global.wordAssoDb.NeuralNetwork.find(
      randomUntestedQuery
    )
      .lean()
      .sort({ overallMatchRate: -1 })
      .limit(params.randomUntestedPerInputsLimit);

    if (nnArrayRandomUntested.length > 0) {
      console.log(
        chalkBlue(
          "TFE | FOUND " +
            nnArrayRandomUntested.length +
            " UNTESTED NNs FROM DB ..."
        )
      );
    }

    nnArray = _.concat(
      nnArray,
      nnArrayTopOverallMatchRate,
      nnArrayRandomUntested
    );
  }

  return nnArray;
}

async function purgeNetworksDb(p) {
  const params = p || {};
  const minSuccessRate =
    params.minSuccessRate || DEFAULT_PURGE_MIN_SUCCESS_RATE;

  let results = await global.wordAssoDb.NeuralNetwork.deleteMany({
    successRate: { $lt: minSuccessRate },
  });
  console.log(
    chalkAlert(
      `${PF} | !!! PURGE NETWORKS DB | NNs DELETED FROM DB (SUCCESS LT ${minSuccessRate}): ${results.deletedCount}`
    )
  );

  const query = {};

  query.$and = [
    { testCycles: { $gte: params.minTestCycles } },
    { overallMatchRate: { $lt: params.minOverallMatchRate } },
  ];

  console.log(
    chalkAlert(PF + " | !!! PURGE NETWORKS DB\nQUERY\n" + jsonPrint(query))
  );

  results = await global.wordAssoDb.NeuralNetwork.deleteMany(query);

  console.log(
    chalkAlert(
      PF +
        " | !!! PURGE NETWORKS DB | NNs DELETED FROM DB: " +
        results.deletedCount
    )
  );

  return results.deletedCount;
}

async function loadBestNetworksDatabase(p) {
  const params = p || {};

  await purgeNetworksDb({
    minOverallMatchRate: configuration.bareMinSuccessRate,
    minTestCycles: 1,
  });

  const networkTechnology =
    params.networkTechnology !== undefined ? params.networkTechnology : false;
  const minTestCycles =
    params.minTestCycles !== undefined
      ? params.minTestCycles
      : configuration.minTestCycles;
  const globalMinSuccessRate =
    params.globalMinSuccessRate !== undefined
      ? params.globalMinSuccessRate
      : configuration.globalMinSuccessRate;
  const randomUntestedPerInputsLimit =
    params.randomUntestedPerInputsLimit !== undefined
      ? params.randomUntestedPerInputsLimit
      : configuration.randomUntestedPerInputsLimit;
  const networkDatabaseLoadPerInputsLimit =
    params.networkDatabaseLoadPerInputsLimit !== undefined
      ? params.networkDatabaseLoadPerInputsLimit
      : configuration.networkDatabaseLoadPerInputsLimit;

  console.log(
    chalkBlue(
      "TFE | ... LOADING BEST NETWORKS DATABASE" +
        " | FILTER TECH: " +
        networkTechnology +
        " | GLOBAL MIN SUCCESS RATE: " +
        globalMinSuccessRate.toFixed(2) +
        "%" +
        " | MIN TEST CYCs: " +
        minTestCycles +
        " | PER INPUTS LIMIT: " +
        networkDatabaseLoadPerInputsLimit +
        " | PER RANDOM UNTESTED LIMIT: " +
        randomUntestedPerInputsLimit
    )
  );

  statsObj.status = "LOAD BEST NNs DATABASE";

  statsObj.newBestNetwork = false;
  statsObj.numNetworksLoaded = 0;

  const inputsIdArray = [...inputsIdSet];

  if (configuration.verbose) {
    console.log(chalkLog("inputsIdArray\n" + jsonPrint(inputsIdArray)));
  }

  let nnArray = [];

  nnArray = await loadNetworksOfInputs({
    networkTechnology: networkTechnology,
    inputsIdArray: inputsIdArray,
    globalMinSuccessRate: globalMinSuccessRate,
    networkDatabaseLoadPerInputsLimit: networkDatabaseLoadPerInputsLimit,
    randomUntestedPerInputsLimit: randomUntestedPerInputsLimit,
    minTestCycles: minTestCycles,
  });

  if (nnArray.length == 0) {
    console.log(
      chalkAlert("TFE | ??? NO NEURAL NETWORKS NOT FOUND IN DATABASE")
    );

    console.log(chalkAlert("TFE | RETRY NEURAL NN DB SEARCH"));
    return false;
  }

  console.log(
    chalkBlueBold("TFE | LOADING " + nnArray.length + " NNs FROM DB ...")
  );

  let networkObj;

  for (const tech of ["brain", "carrot", "neataptic", "tensorflow"]) {
    bestNetworksByTechnology[tech] = {};
    bestNetworksByTechnology[tech].successRate = 0;
    bestNetworksByTechnology[tech].networkId = false;
  }

  for (const nnDoc of nnArray) {
    try {
      if (
        nnDoc.testCycleHistory &&
        nnDoc.testCycleHistory !== undefined &&
        nnDoc.testCycleHistory.length > 0
      ) {
        nnDoc.previousRank =
          nnDoc.testCycleHistory[nnDoc.testCycleHistory.length - 1].rank;

        console.log(
          chalkLog(
            PF +
              " | loadBestNetworksDatabase" +
              " | PREV RANK " +
              nnDoc.previousRank +
              " | RANK " +
              nnDoc.rank +
              " | " +
              nnDoc.networkId
          )
        );
      }

      console.log(
        chalkInfo(PF + " | loadBestNetworksDatabase" + " | " + nnDoc.networkId)
      );

      const nnObj = await fixIncorrectNetworkMetaData({
        networkObj: nnDoc,
        updateDatabaseOnly: true,
      });
      networkObj = await nnTools.convertNetwork({ networkObj: nnObj });

      if (!networkObj || networkObj == undefined) {
        console.log(
          chalkError(
            PF +
              " | *** NETWORK CONVERT UNDEFINED ... SKIPPING: " +
              nnObj.networkId
          )
        );
      } else {
        if (networkObj.overallMatchRate > bestNetwork.overallMatchRate) {
          bestNetwork = networkObj;
          bestNetwork.isValid = true;
          bestNetwork = networkDefaults(bestNetwork);

          currentBestNetwork = bestNetwork;

          statsObj.bestRuntimeNetworkId = bestNetwork.networkId;

          bestNetworkHashMap.set(statsObj.bestRuntimeNetworkId, bestNetwork);

          console.log(
            chalk.bold.blue(
              "TFE | +++ BEST DB NN" +
                " | " +
                bestNetwork.networkId +
                " | RANK: " +
                bestNetwork.rank +
                " | PREV RANK: " +
                bestNetwork.previousRank +
                " | INPUT ID: " +
                bestNetwork.inputsId +
                " | INs: " +
                bestNetwork.numInputs +
                " | SR: " +
                bestNetwork.successRate.toFixed(2) +
                "%" +
                " | MR: " +
                bestNetwork.matchRate.toFixed(2) +
                "%" +
                " | OAMR: " +
                bestNetwork.overallMatchRate.toFixed(2) +
                "%" +
                " | RMR: " +
                bestNetwork.runtimeMatchRate.toFixed(2) +
                "%" +
                " | TCs: " +
                bestNetwork.testCycles +
                " | TCH: " +
                bestNetwork.testCycleHistory.length
            )
          );
        }

        bestNetworkHashMap.set(networkObj.networkId, networkObj);

        if (
          bestNetworksByTechnology[networkObj.networkTechnology].successRate <
          networkObj.successRate
        ) {
          bestNetworksByTechnology[networkObj.networkTechnology] = {
            networkId: networkObj.networkId,
            successRate: networkObj.successRate,
          };
          console.log(
            chalkBlue(
              `${PF} | +++ NEW BEST NN BY TECH | ${
                networkObj.networkTechnology
              } | ${networkObj.successRate.toFixed(2)} | ${
                networkObj.networkId
              }`
            )
          );
        }

        console.log(
          chalkInfo(
            "TFE | ADD NN --> HM" +
              " | " +
              networkObj.networkId +
              " | RANK: " +
              networkObj.rank +
              " | PREV RANK: " +
              networkObj.previousRank +
              " | INPUT ID: " +
              networkObj.inputsId +
              " | INs: " +
              networkObj.numInputs +
              " | SR: " +
              networkObj.successRate.toFixed(2) +
              "%" +
              " | MR: " +
              networkObj.matchRate.toFixed(2) +
              "%" +
              " | OAMR: " +
              networkObj.overallMatchRate.toFixed(2) +
              "%" +
              " | RMR: " +
              networkObj.runtimeMatchRate.toFixed(2) +
              "%" +
              " | TCs: " +
              networkObj.testCycles +
              " | TCH: " +
              networkObj.testCycleHistory.length
          )
        );
      }
    } catch (e) {
      console.trace(e);
      console.log(
        chalkError(
          PF +
            " | *** LOAD DB NETWORK CONVERT ERROR ... SKIPPING: " +
            nnDoc.networkId
        )
      );
      bestNetworkHashMap.delete(nnDoc.networkId);
      continue;
    }
  }

  console.log(chalkBlueBold(PF + " | loadBestNetworksDatabase COMPLETE"));
  return bestNetwork;
}

async function loadBestNeuralNetworks() {
  statsObj.status = "LOAD BEST NN";

  console.log(
    chalkLog(
      "TFE | LOADING NEURAL NETWORKS" + " | FOLDER: " + bestNetworkFolder
    )
  );

  try {
    await loadBestNetworksFolder({ folder: bestNetworkFolder });
    await loadBestNetworksDatabase();
    await loadBestRuntimeNetwork();
    return;
  } catch (err) {
    console.trace(chalkError("TFE | *** LOAD BEST NETWORKS ERROR: " + err));
    throw err;
  }
}

const watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
};

async function initWatchConfig() {
  statsObj.status = "INIT WATCH CONFIG";

  console.log(chalkLog(PF + " | ... INIT WATCH"));

  const loadConfig = async function (f) {
    try {
      debug(
        chalkInfo(
          PF + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f
        )
      );

      if (f.endsWith("twitterFollowerExplorerConfig.json")) {
        await loadAllConfigFiles();

        const configArgs = Object.keys(configuration);

        for (const arg of configArgs) {
          if (arg === "privateKey") {
            console.log(
              PF + " | _FINAL CONFIG | " + arg + " | " + DEFAULT_SSH_PRIVATEKEY
            );
          } else if (_.isObject(configuration[arg])) {
            console.log(
              PF +
                " | _FINAL CONFIG | " +
                arg +
                "\n" +
                jsonPrint(configuration[arg])
            );
          } else {
            console.log(
              PF + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]
            );
          }
        }
      }
    } catch (err) {
      console.log(
        chalkError(PF + " | *** LOAD ALL CONFIGS ON CREATE ERROR: " + err)
      );
    }
  };

  watch.createMonitor(configDefaultFolder, watchOptions, function (monitor) {
    monitor.on("created", loadConfig);
    monitor.on("changed", loadConfig);
    monitor.on("removed", function (f) {
      debug(
        chalkAlert(PF + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f)
      );
    });
  });

  watch.createMonitor(configHostFolder, watchOptions, function (monitor) {
    monitor.on("created", loadConfig);
    monitor.on("changed", loadConfig);
    monitor.on("removed", function (f) {
      debug(
        chalkAlert(PF + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f)
      );
    });
  });

  return;
}

let loadNetworkInterval;

function initActivateNetworks() {
  return new Promise(function (resolve, reject) {
    statsObj.status = "INIT ACTIVATE NNs";

    console.log(chalkGreen(PF + " | INIT ACTIVATE NETWORKS"));

    statsObj.loadedNetworksFlag = false;

    const networkIdArray = bestNetworkHashMap.keys();

    let loadNetworkReady = true;

    console.log(
      chalkGreen(
        "TFE | initActivateNetworks | " + networkIdArray.length + " NETWORKS"
      )
    );

    if (networkIdArray.length === 0) {
      statsObj.loadedNetworksFlag = true;
      console.error(chalkError(PF + " | ??? NO LOADED NNs ???"));
      return reject(new Error("NO NNs LOADED"));
    }

    intervalsSet.add("loadNetworkInterval");

    loadNetworkInterval = setInterval(async function () {
      if (networkIdArray.length > 0 && loadNetworkReady) {
        try {
          loadNetworkReady = false;

          let isBestNetworkFlag = false;

          const nnId = networkIdArray.shift();
          const networkObj = bestNetworkHashMap.get(nnId);

          if (networkObj.networkId === bestNetwork.networkId) {
            console.log(
              chalkGreen(
                "TFE | ... LOADING NETWORK | BEST: " + networkObj.networkId
              )
            );
            isBestNetworkFlag = true;
          }

          nnTools.printNetworkObj(PF + " | LOADING NN ", networkObj, chalkLog);

          await nnTools.loadNetwork({
            networkObj: networkObj,
            isBestNetwork: isBestNetworkFlag,
          });

          console.log(chalkBlue(PF + " | LOADED NN " + networkObj.networkId));

          if (networkIdArray.length === 0) {
            clearInterval(loadNetworkInterval);
            statsObj.loadedNetworksFlag = true;
            console.log(chalkBlue(PF + " | LOADED NNs COMPLETE"));
            return resolve();
          }

          loadNetworkReady = true;
        } catch (err) {
          console.log(chalkError(PF + " | *** waitEvent ERROR: ", err));
          if (networkIdArray.length === 0) {
            clearInterval(loadNetworkInterval);
            statsObj.loadedNetworksFlag = true;
            console.log(chalkBlue(PF + " | LOADED NNs COMPLETE"));
            return resolve();
          }
          loadNetworkReady = true;
        }
      }
    }, 1000);
  });
}

const bestNetworkPickArray = [
  "networkId",
  "successRate",
  "matchRate",
  "overallMatchRate",
  "runtimeMatchRate",
  "testCycles",
  "testCycleHistory",
  "rank",
];

async function loadBestRuntimeNetwork() {
  statsObj.status = "INIT BEST RUNTIME NETWORK";

  console.log(chalkTwitter("TFE | INIT BEST RUNTIME NETWORK"));

  // const bestNetworkObj = {
  //   networkId: params.network.networkId,
  //   successRate: params.network.successRate,
  //   matchRate: params.network.matchRate,
  //   overallMatchRate: params.network.overallMatchRate,
  //   runtimeMatchRate: params.network.runtimeMatchRate,
  //   testCycles: params.network.testCycles,
  //   testCycleHistory: params.network.testCycleHistory,
  //   rank: params.network.rank,
  //   updatedAt: getTimeStamp()
  // };

  try {
    bestNetworkObj = await tcUtils.loadFile({
      folder: bestNetworkFolder,
      file: bestRuntimeNetworkFileName,
      // noErrorNotFound: true,
      verbose: true,
    });

    debug(PF + "| bestNetworkObj\n" + jsonPrint(bestNetworkObj));

    const bestNetworkDoc = await global.wordAssoDb.NeuralNetwork.findOne({
      networkId: bestNetworkObj.networkId,
    }).lean();

    if (!bestNetworkDoc) {
      console.log(
        chalkAlert(
          PF +
            " | loadBestRuntimeNetwork" +
            " | !!! BEST RUNTIME NETWORK NOT FOUND IN DB" +
            " | " +
            bestNetworkObj.networkId
        )
      );

      return;
    }

    console.log(
      chalkBlue(
        PF +
          " | loadBestRuntimeNetwork" +
          " | BEST RUNTIME NETWORK FOUND IN DB" +
          " | " +
          bestNetworkDoc.networkId
      )
    );

    bestNetworkObj = pick(bestNetworkDoc, bestNetworkPickArray);

    bestNetworkHashMap.set(bestNetworkDoc.networkId, bestNetworkDoc);

    return;
  } catch (err) {
    console.log(
      chalkAlert(
        PF +
          " | loadBestRuntimeNetwork" +
          " | !!! COULD NOT LOAD BEST RUNTIME NETWORK FILE" +
          " | " +
          bestNetworkFolder +
          "/" +
          bestRuntimeNetworkFileName
      )
    );

    return;
  }
}

async function initNetworks(params) {
  statsObj.status = "INIT NNs";

  console.log(chalkTwitter("TFE | INIT NETWORKS"));

  await loadBestNeuralNetworks(params);

  const networkNumberLimit = configuration.testMode
    ? TEST_MODE_NUM_NN
    : configuration.networkNumberLimit || 50;

  if (bestNetworkHashMap.size > networkNumberLimit) {
    console.log(
      chalkAlert(
        "TFE | +++ NETWORKS NUMBER > LIMIT | REMOVING RANDOM NETWORK" +
          " | LIMIT: " +
          networkNumberLimit +
          " | " +
          bestNetworkHashMap.size +
          " NETWORKS"
      )
    );

    let nnIds = _.shuffle(bestNetworkHashMap.keys());

    let testCycleLimit = 0;
    let minNetworkSuccessRate = Infinity;
    let purgeMinSuccessRate = -Infinity;

    while (bestNetworkHashMap.size > networkNumberLimit && nnIds.length > 0) {
      const nnId = nnIds.shift();

      const nnObj = bestNetworkHashMap.get(nnId);

      if (nnObj === undefined) {
        console.log("!!! UNDEFINED NN OBJ | NNID: ", nnId);
        continue;
      }

      if (nnObj.testCycles === undefined) {
        console.log(nnObj);
      }

      nnObj.testCycles = nnObj.testCycles || 0;

      minNetworkSuccessRate = Math.min(
        nnObj.successRate,
        minNetworkSuccessRate
      );

      if (
        nnId !== bestNetworkObj.networkId &&
        bestNetworksByTechnology[nnObj.networkTechnology] &&
        bestNetworksByTechnology[nnObj.networkTechnology].networkId !== nnId &&
        (nnObj.successRate <= purgeMinSuccessRate ||
          nnObj.testCycles > testCycleLimit)
      ) {
        bestNetworkHashMap.delete(nnId);
        console.log(
          chalkInfo(
            "TFE | REMOVED NN" +
              " [ NNIDs: " +
              nnIds.length +
              "]" +
              " | TEST CYC LIMIT: " +
              testCycleLimit +
              " | BEST NNID: " +
              bestNetworkObj.networkId +
              " | PURGE MIN: " +
              purgeMinSuccessRate.toFixed(3) +
              " | NNID: " +
              nnObj.networkId +
              " | TCs: " +
              nnObj.testCycles +
              " | SR: " +
              nnObj.successRate.toFixed(3) +
              " | LIMIT: " +
              networkNumberLimit +
              " | " +
              bestNetworkHashMap.size +
              " NETWORKS"
          )
        );
      } else {
        console.log(
          chalkLog(
            "TFE | ... SKIP NN" +
              " [ NNIDs: " +
              nnIds.length +
              "]" +
              " | TEST CYC LIMIT: " +
              testCycleLimit +
              " | BEST NNID: " +
              bestNetworkObj.networkId +
              " | TECH: " +
              nnObj.networkTechnology +
              " | NNID: " +
              nnId +
              " | TCs: " +
              nnObj.testCycles +
              " | SR: " +
              nnObj.successRate.toFixed(3) +
              " | LIMIT: " +
              networkNumberLimit +
              " | " +
              bestNetworkHashMap.size +
              " NETWORKS"
          )
        );
      }

      // console.log({bestNetworksByTechnology})

      if (nnIds.length === 0 && bestNetworkHashMap.size > networkNumberLimit) {
        console.log(
          chalkAlert(
            "TFE | END NN IDS BUT GT NN NUM LIMIT" +
              " [ NNIDs: " +
              nnIds.length +
              "]" +
              " | TEST CYC LIMIT: " +
              testCycleLimit +
              " | PURGE MIN: " +
              purgeMinSuccessRate.toFixed(3) +
              " | NN NUM LIMIT: " +
              networkNumberLimit +
              " | " +
              bestNetworkHashMap.size +
              " NETWORKS"
          )
        );

        if (testCycleLimit < 20) {
          testCycleLimit += 1;
          purgeMinSuccessRate = minNetworkSuccessRate + 1;
        } else {
          purgeMinSuccessRate += 0.5;
        }

        minNetworkSuccessRate = Infinity;
        nnIds = _.shuffle(bestNetworkHashMap.keys());

        console.log(
          chalkAlert(
            "TFE | *** WHILE LOOP RESET" +
              " [ NNIDs: " +
              nnIds.length +
              "]" +
              " | TEST CYC LIMIT: " +
              testCycleLimit +
              " | PURGE MIN: " +
              purgeMinSuccessRate.toFixed(3) +
              " | NN NUM LIMIT: " +
              networkNumberLimit +
              " | " +
              bestNetworkHashMap.size +
              " NETWORKS"
          )
        );
      }
    }

    console.log(chalkAlert("END WHILE"));
  }

  await initActivateNetworks();

  console.log(
    chalkAlert(
      "TFE | +++ NETWORKS INITIALIZED | " +
        bestNetworkHashMap.size +
        " NETWORKS"
    )
  );

  if (bestNetworkHashMap.size === 0) {
    console.log(chalkError(PF + " | *** NO NETWORKS LOADED"));
    quit({ source: "TFE", error: "NO_NETWORKS" });
    return;
  }

  return;
}

function saveNetworkHashMap(params) {
  return new Promise(function (resolve, reject) {
    statsObj.status = "SAVE NN HASHMAP";

    const nnIds = bestNetworkHashMap.keys();

    const configFolder = configuration.isDatabaseHost
      ? configDefaultFolder
      : configHostFolder;

    statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue({
      folder: configFolder,
      file: bestNetworkIdArrayFile,
      obj: nnIds,
    });

    const folder =
      params.folder === undefined ? bestNetworkFolder : params.folder;

    console.log(chalkNetwork("TFE | UPDATING NNs IN FOLDER " + folder));

    async.eachSeries(
      nnIds,
      function (nnId, cb) {
        const networkObj = bestNetworkHashMap.get(nnId);

        nnTools.printNetworkObj("TFE | ... SAVING NN", networkObj);

        const file = nnId + ".json";

        statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue({
          folder: folder,
          file: file,
          obj: networkObj,
          verbose: true,
        });

        statsObj.status =
          "SAVE NN HASHMAP | SAVE Q: " + statsObj.queues.saveFileQueue.size;

        debug(chalkNetwork("SAVING NN (Q)" + " | " + networkObj.networkId));

        cb();
      },
      function (err) {
        if (err) {
          return reject(err);
        }

        console.log(chalkBlueBold(PF + " | +++ saveNetworkHashMap COMPLETE"));
        resolve();
      }
    );
  });
}

function updateNetworkStats(params) {
  return new Promise(function (resolve, reject) {
    statsObj.status = "UPDATE DB NN STATS";

    const updateOverallMatchRate =
      params.updateOverallMatchRate !== undefined
        ? params.updateOverallMatchRate
        : false;
    const updateRuntimeMatchRate =
      params.updateRuntimeMatchRate !== undefined
        ? params.updateRuntimeMatchRate
        : false;
    const saveImmediate =
      params.saveImmediate !== undefined ? params.saveImmediate : false;
    const updateDb = params.updateDb !== undefined ? params.updateDb : false;
    const incrementTestCycles =
      params.incrementTestCycles !== undefined
        ? params.incrementTestCycles
        : false;
    const addToTestHistory =
      params.addToTestHistory !== undefined ? params.addToTestHistory : false;

    const nnIds = Object.keys(params.networks);

    console.log(
      chalkTwitter(
        "TFE | UPDATE NN STATS" +
          " | " +
          nnIds.length +
          " | NETWORKS" +
          " | UPDATE OAMR: " +
          updateOverallMatchRate +
          " | UPDATE RMR: " +
          updateRuntimeMatchRate +
          " | UPDATE DB: " +
          updateDb +
          " | INC TEST CYCs: " +
          incrementTestCycles +
          " | ADD TEST HISTORY: " +
          addToTestHistory
      )
    );

    async.eachSeries(
      nnIds,
      function (nnId, cb) {
        if (bestNetworkHashMap.has(nnId)) {
          const networkObj = bestNetworkHashMap.get(nnId);

          networkObj.incrementTestCycles = incrementTestCycles;
          networkObj.rank = params.networks[nnId].rank;
          networkObj.matchRate = params.networks[nnId].matchRate;
          networkObj.overallMatchRate = updateOverallMatchRate
            ? params.networks[nnId].matchRate
            : params.networks[nnId].overallMatchRate;
          networkObj.runtimeMatchRate = updateRuntimeMatchRate
            ? params.networks[nnId].matchRate
            : params.networks[nnId].runtimeMatchRate;

          const testHistoryItem = {
            testCycle: networkObj.testCycles,
            match: params.networks[nnId].meta.match,
            mismatch: params.networks[nnId].meta.mismatch,
            total: params.networks[nnId].meta.total,
            matchRate: params.networks[nnId].matchRate,
            rank: params.networks[nnId].rank,
            timeStampString: moment().format(compactDateTimeFormat),
            timeStamp: moment(),
          };

          const updateDbNetworkParams = {
            networkObj: networkObj,
            incrementTestCycles: incrementTestCycles,
            testHistoryItem: testHistoryItem,
            addToTestHistory: addToTestHistory,
            verbose: true,
          };

          updateDbNetwork(updateDbNetworkParams)
            .then(function (nnDoc) {
              const nnDbUpdated = nnDoc.toObject();
              bestNetworkHashMap.set(nnDbUpdated.networkId, nnDbUpdated);
              cb();
            })
            .catch(function (err) {
              console.log(
                chalkError(PF + " | *** updateDbNetwork ERROR: " + err)
              );
              return cb(err);
            });
        } else {
          console.log(
            chalkAlert(
              "TFE | ??? NN NOT IN BEST NN HASHMAP ???" + " | NNID: " + nnId
            )
          );
          return cb(new Error("NN NOT IN BEST NN HASHMAP"));
        }
      },
      async function (err) {
        if (err) {
          console.log(chalkError(PF + " | *** UPDATE NN STATS ERROR: " + err));
          return reject(err);
        }

        const bestInputsConfigObj = {};

        try {
          const query = {};

          const inputsIdArray = [...inputsIdSet];

          query.$and = [
            { inputsId: { $in: inputsIdArray } },
            { testCycles: { $gt: 0 } },
          ];

          let chalkVal = chalkLog;

          const networkObjArray = await global.wordAssoDb.NeuralNetwork.find(
            query
          )
            .lean()
            .sort({ overallMatchRate: -1 })
            .limit(50)
            .select({
              overallMatchRate: 1,
              runtimeMatchRate: 1,
              successRate: 1,
              networkId: 1,
              inputsId: 1,
            });

          for (const networkObj of networkObjArray) {
            if (networkObj.runtimeMatchRate === undefined) {
              networkObj.runtimeMatchRate = 0;
            }

            if (networkObj.inputsId && networkObj.inputsId !== undefined) {
              chalkVal = bestInputsSet.has(networkObj.inputsId)
                ? chalkLog
                : chalkGreen;

              bestInputsSet.add(networkObj.inputsId);

              console.log(
                chalkVal(
                  "TFE | +++ BEST INPUTS SET" +
                    " [" +
                    bestInputsSet.size +
                    "]" +
                    " | INPUTS ID: " +
                    networkObj.inputsId +
                    " | SR: " +
                    networkObj.successRate.toFixed(2) +
                    "%" +
                    " | OAMR: " +
                    networkObj.overallMatchRate.toFixed(2) +
                    "%" +
                    " | RMR: " +
                    networkObj.runtimeMatchRate.toFixed(2) +
                    "%" +
                    " | NID: " +
                    networkObj.networkId
                )
              );
            }
          }

          console.log(
            chalkInfo(
              "TFE | BEST INPUTS SET: " +
                bestInputsSet.size +
                "\n" +
                jsonPrint([...bestInputsSet])
            )
          );

          bestInputsConfigObj.INPUTS_IDS = [];
          bestInputsConfigObj.INPUTS_IDS = [...bestInputsSet];

          let folder = configDefaultFolder;
          let file = defaultBestInputsConfigFile;

          if (hostname != "google") {
            folder = configHostFolder;
            file = hostBestInputsConfigFile;
          }

          statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue({
            folder: folder,
            file: file,
            obj: bestInputsConfigObj,
          });

          await saveNetworkHashMap({
            folder: bestNetworkFolder,
            saveImmediate: saveImmediate,
            updateDb: updateDb,
          });
          console.log(chalkBlueBold(PF + " | +++ updateNetworkStats COMPLETE"));
          resolve();
        } catch (e) {
          console.log(chalkError(PF + " | *** BEST INPUTS ERROR: " + e));
          reject(e);
        }
      }
    );
  });
}

let activateNetworkIntervalBusy = false;

function initActivateNetworkQueueInterval(p) {
  return new Promise(function (resolve) {
    const params = p || {};

    const interval =
      params.interval || configuration.activateNetworkQueueInterval;

    clearInterval(activateNetworkQueueInterval);

    statsObj.status = "INIT ACTIVATE Q INTERVAL";
    statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

    console.log(
      chalkLog(PF + " | INIT ACTIVATE NN QUEUE INTERVAL: " + interval + " ms")
    );

    let activateNetworkResults = {};
    let cbnn = {};

    intervalsSet.add("activateNetworkQueueInterval");

    activateNetworkIntervalBusy = false;

    activateNetworkQueueInterval = setInterval(async function () {
      if (!activateNetworkIntervalBusy && activateNetworkQueue.length > 0) {
        activateNetworkIntervalBusy = true;

        const anObj = activateNetworkQueue.shift();

        statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

        if (
          !anObj.user.profileHistograms ||
          anObj.user.profileHistograms === undefined
        ) {
          debug(
            chalkWarn(
              "TFE | ACTIVATE | !!! UNDEFINED USER PROFILE HISTOGRAMS | @" +
                anObj.user.screenName
            )
          );
          anObj.user.profileHistograms = {};
        }

        if (
          !anObj.user.tweetHistograms ||
          anObj.user.tweetHistograms === undefined
        ) {
          debug(
            chalkWarn(
              "TFE | ACTIVATE | !!! UNDEFINED USER TWEET HISTOGRAMS | @" +
                anObj.user.screenName
            )
          );
          anObj.user.tweetHistograms = {};
        }

        if (!anObj.user.friends || anObj.user.friends === undefined) {
          debug(
            chalkWarn(
              "TFE | ACTIVATE | !!! UNDEFINED USER FRIENDS | @" +
                anObj.user.screenName
            )
          );
          anObj.user.friends = [];
        }

        try {
          activateNetworkResults = await nnTools.activate({
            user: anObj.user,
            useDatumCacheFlag: true,
            convertDatumFlag: true,
          });

          cbnn = await nnTools.updateNetworkStats({
            sortBy: "matchRate",
            user: anObj.user,
            networkOutput: activateNetworkResults.networkOutput,
            expectedCategory: activateNetworkResults.user.category,
          });

          if (
            cbnn === undefined ||
            !cbnn ||
            !cbnn.networkId ||
            cbnn === undefined
          ) {
            console.log(
              chalkError("TFE | *** BEST NN NOT DEFINED\n" + jsonPrint(cbnn))
            );
            return;
          }

          statsObj.currentBestNetworkId = cbnn.networkId;

          if (bestNetworkHashMap.has(statsObj.currentBestNetworkId)) {
            currentBestNetwork = bestNetworkHashMap.get(
              statsObj.currentBestNetworkId
            );

            if (
              cbnn.matchRate > currentBestNetwork.matchRate &&
              cbnn.networkId != currentBestNetwork.networkId
            ) {
              nnTools.printNetworkObj(
                PF + " | +++ NEW CURRENT BEST NN",
                cbnn,
                chalkGreen
              );
            }

            currentBestNetwork.matchRate = cbnn.matchRate;
            currentBestNetwork.overallMatchRate = cbnn.overallMatchRate;
            currentBestNetwork.runtimeMatchRate = cbnn.runtimeMatchRate;
            currentBestNetwork.successRate = cbnn.successRate;

            await updateBestNetworkStats({ networkObj: currentBestNetwork });

            bestNetworkHashMap.set(
              statsObj.currentBestNetworkId,
              currentBestNetwork
            );

            if (
              configuration.isDatabaseHost &&
              statsObj.prevBestNetworkId != statsObj.currentBestNetworkId &&
              configuration.bestNetworkIncrementalUpdate
            ) {
              statsObj.prevBestNetworkId = statsObj.currentBestNetworkId;
              await saveBestNetworkFileCache({
                networkObj: currentBestNetwork,
              });
            }

            let user = {};
            user = anObj.user;
            user.category = activateNetworkResults.user.category;
            user.categoryAuto = currentBestNetwork.meta.categoryAuto;
            user.categorizeNetwork = currentBestNetwork.networkId;
            userDbUpdateQueue.push(user);
            statsObj.queues.userDbUpdateQueue.size = userDbUpdateQueue.length;
          } else {
            console.log(
              chalkError(
                PF +
                  " | *** ERROR:  NETWORK_OUTPUT | BEST NN NOT IN HASHMAP???" +
                  " | " +
                  moment().format(compactDateTimeFormat) +
                  " | BEST RT NN ID: " +
                  statsObj.currentBestNetworkId +
                  " | BEST NN ID: " +
                  currentBestNetwork.networkId +
                  " | SR: " +
                  currentBestNetwork.successRate.toFixed(2) +
                  "%" +
                  " | MR: " +
                  currentBestNetwork.matchRate.toFixed(2) +
                  "%" +
                  " | OAMR: " +
                  currentBestNetwork.overallMatchRate.toFixed(2) +
                  "%" +
                  " | RMR: " +
                  currentBestNetwork.runtimeMatchRate.toFixed(2) +
                  "%" +
                  " | TC: " +
                  currentBestNetwork.testCycles +
                  " | @" +
                  anObj.user.screenName +
                  " | C: " +
                  anObj.user.category +
                  " | CA: " +
                  currentBestNetwork.meta.categoryAuto
              )
            );
          }

          statsObj.users.processed.total += 1;
          statsObj.users.processed.elapsed =
            moment().valueOf() - statsObj.users.processed.startMoment.valueOf(); // mseconds
          statsObj.users.processed.rate =
            statsObj.users.processed.total > 0
              ? statsObj.users.processed.elapsed /
                statsObj.users.processed.total
              : 0; // msecs/usersArchived
          statsObj.users.processed.remain =
            statsObj.users.processed.grandTotal -
            (statsObj.users.processed.total + statsObj.users.processed.errors);
          statsObj.users.processed.remainMS =
            statsObj.users.processed.remain * statsObj.users.processed.rate; // mseconds
          statsObj.users.processed.endMoment = moment();
          statsObj.users.processed.endMoment.add(
            statsObj.users.processed.remainMS,
            "ms"
          );
          statsObj.users.processed.percent =
            (100 * statsObj.users.processed.total) /
            statsObj.users.processed.grandTotal;

          if (statsObj.users.processed.total % 100 == 0) {
            showStats();
          }

          if (statsObj.currentBestNetwork.rank < currentBestNetwork.rank) {
            nnTools.printNetworkObj(
              PF +
                " | +++ UPD BEST NN" +
                " [ANQ " +
                activateNetworkQueue.length +
                "]" +
                " | @" +
                anObj.user.screenName +
                " | CM: " +
                anObj.user.category,
              currentBestNetwork,
              chalk.black
            );
            await nnTools.printNetworkResults();
          } else if (
            (configuration.testMode &&
              currentBestNetwork.meta.total % 10 === 0) ||
            currentBestNetwork.meta.total % 100 === 0
          ) {
            await nnTools.printNetworkResults();
          }

          statsObj.currentBestNetwork = currentBestNetwork;
          activateNetworkIntervalBusy = false;
        } catch (err) {
          console.log(
            chalkError(
              PF +
                " | *** ACTIVATE NETWORK ERROR" +
                " | @" +
                anObj.user.screenName +
                " | " +
                err
            )
          );

          activateNetworkIntervalBusy = false;
        }
      }
    }, interval);

    resolve();
  });
}

const runEnableArgs = {};
runEnableArgs.userServerControllerReady = userServerControllerReady;
runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;

function updateBestNetworkStats(params) {
  return new Promise(function (resolve) {
    const networkObj = params.networkObj;

    statsObj.status = "UPDATE BEST NN STATS";

    if (statsObj.bestNetwork === undefined) {
      statsObj.bestNetwork = {};
    }

    statsObj.bestRuntimeNetworkId = networkObj.networkId;
    statsObj.currentBestNetworkId = networkObj.networkId;

    statsObj.bestNetwork.networkId = networkObj.networkId;
    statsObj.bestNetwork.networkType = networkObj.networkType;
    statsObj.bestNetwork.successRate = networkObj.successRate || 0;
    statsObj.bestNetwork.matchRate = networkObj.matchRate || 0;
    statsObj.bestNetwork.overallMatchRate = networkObj.overallMatchRate || 0;
    statsObj.bestNetwork.runtimeMatchRate = networkObj.runtimeMatchRate || 0;
    statsObj.bestNetwork.testCycles = networkObj.testCycles || 0;
    statsObj.bestNetwork.testCycleHistory = networkObj.testCycleHistory || [];
    statsObj.bestNetwork.input = networkObj.networkJson.input;
    statsObj.bestNetwork.numInputs = networkObj.numInputs;
    statsObj.bestNetwork.inputsId = networkObj.inputsId;
    statsObj.bestNetwork.output = networkObj.networkJson.output;
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

async function saveBestNetworkFileCache(params) {
  try {
    if (params.networkObj.previousRank === Infinity) {
      params.networkObj.previousRank = 1000;
    }

    console.log(
      chalkNetwork(
        PF +
          " | SAVING NEW BEST NN" +
          " | SR: " +
          params.networkObj.successRate.toFixed(2) +
          " | MR: " +
          params.networkObj.matchRate.toFixed(2) +
          " | OAMR: " +
          params.networkObj.overallMatchRate.toFixed(2) +
          " | RMR: " +
          params.networkObj.runtimeMatchRate.toFixed(2) +
          " | RK: " +
          params.networkObj.rank +
          " | PRV RK: " +
          params.networkObj.previousRank +
          " | TC HIST: " +
          params.networkObj.testCycleHistory.length +
          " | " +
          params.networkObj.networkId
      )
    );

    const obj = {};

    obj.folder = bestNetworkFolder;
    obj.file = statsObj.bestRuntimeNetworkId + ".json";
    obj.obj = {
      networkId: params.networkObj.networkId,
      successRate: params.networkObj.successRate,
      matchRate: params.networkObj.matchRate,
      overallMatchRate: params.networkObj.overallMatchRate,
      runtimeMatchRate: params.networkObj.runtimeMatchRate,
      testCycles: params.networkObj.testCycles,
      testCycleHistory: params.networkObj.testCycleHistory,
      rank: params.networkObj.rank,
      previousRank: params.networkObj.previousRank,
      updatedAt: getTimeStamp(),
    };

    saveCache.set(obj.file, obj);

    obj.file = bestRuntimeNetworkFileName;
    obj.obj = Object.assign({}, params.networkObj);
    delete obj.obj.network;

    saveCache.set(obj.file, obj);

    return;
  } catch (err) {
    console.trace(chalkError(`${PF}  | *** SAVING NEW BEST NN ERROR: ${err}`));
    throw err;
  }
}

function initUserDbUpdateQueueInterval2(p) {
  return new Promise(function (resolve) {
    const params = p || {};
    const maxBulkUpdateArray = params.maxBulkUpdateArray || 10;
    const interval = params.interval || configuration.userDbUpdateQueueInterval;

    statsObj.status = "INIT USER DB UPDATE INTERVAL";

    console.log(
      chalkBlue(
        PF +
          " | INIT USER DB UPDATE QUEUE" +
          " | MAX BULK ARRAY: " +
          maxBulkUpdateArray +
          " | INTERVAL: " +
          interval +
          " MS"
      )
    );

    clearInterval(userDbUpdateQueueInterval);

    intervalsSet.add("userDbUpdateQueueInterval");

    statsObj.queues.userDbUpdateQueue.busy = false;
    userDbUpdateQueueReadyFlag = true;

    let userObj = {};

    userDbUpdateQueueInterval = setInterval(async function () {
      if (userDbUpdateQueueReadyFlag && userDbUpdateQueue.length > 0) {
        userDbUpdateQueueReadyFlag = false;
        statsObj.queues.userDbUpdateQueue.busy = true;

        const userObjArrayLength = userDbUpdateQueue.length;

        const bulkUpdateArray = [];
        for (let count = userObjArrayLength; count > 0; count--) {
          const userObj = userDbUpdateQueue.shift();
          if (!userObj.end) {
            bulkUpdateArray.push({
              updateOne: {
                filter: { nodeId: userObj.nodeId },
                update: userObj,
              },
            });
          }
        }

        await global.wordAssoDb.User.bulkWrite(bulkUpdateArray);
        // console.log(
        //   `${PF} | BULK UPDATE | STATUS: ${result.ok}` +
        //     ` | userDbUpdateQueue: ${userDbUpdateQueue.length}` +
        //     ` | bulkUpdateArray: ${bulkUpdateArray.length}` +
        //     ` | modifiedCount: ${result.modifiedCount}`
        // );

        //   userObj = userDbUpdateQueue.shift();

        //   if (!userObj.end) {
        //     await global.wordAssoDb.User.updateOne(
        //       { nodeId: userObj.nodeId },
        //       userObj
        //     );
        //     // await userServerController.findOneUserV2({
        //     //   user: userObj,
        //     //   mergeHistograms: false,
        //     //   noInc: true,
        //     //   updateCountHistory: true,
        //     // });
        //   }

        statsObj.queues.userDbUpdateQueue.size = userDbUpdateQueue.length;
        userDbUpdateQueueReadyFlag = true;
        statsObj.queues.userDbUpdateQueue.busy = false;
      }
    }, interval);

    resolve();
  });
}

async function generateAutoCategory(params) {
  statsObj.status = "GEN AUTO CAT";

  try {
    // only updates profileHistograms

    const user = await tcUtils.updateUserHistograms({
      user: params.user,
      updateGlobalHistograms: configuration.updateGlobalHistograms,
    });

    if (
      empty(user.profileHistograms) &&
      !empty(params.user.profileHistograms)
    ) {
      console.log(
        chalkAlert(
          `${PF} | !!! updateUserHistograms profileHistograms | @${user.screenName}`
        )
      );
    }

    if (user.toObject !== undefined) {
      const userObject = user.toObject();
      activateNetworkQueue.push({ user: userObject });
    } else {
      activateNetworkQueue.push({ user: user });
    }

    statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;

    return user;
  } catch (err) {
    console.log(chalkError("TFE | *** generateAutoCategory ERROR: " + err));
    throw err;
  }
}

const userTweetsDefault = {
  sinceId: MIN_TWEET_ID,
  tweetIds: [],
};

function histogramIncomplete(histogram) {
  return new Promise(function (resolve) {
    if (!histogram) {
      return resolve(true);
    }
    if (histogram === undefined) {
      return resolve(true);
    }
    if (histogram == {}) {
      return resolve(true);
    }

    async.eachSeries(
      Object.values(histogram),
      function (value, cb) {
        if (value == {}) {
          return cb();
        }
        if (value !== undefined && Object.keys(value).length > 0) {
          return cb("valid");
        }

        cb();
      },
      function (valid) {
        if (valid) {
          return resolve(false);
        }
        return resolve(true);
      }
    );
  });
}

function processUserTweetArray(params) {
  return new Promise(function (resolve, reject) {
    const tscParams = params.tscParams;
    const user = params.user;
    const tweets = params.tweets;
    const forceFetch = params.forceFetch;

    async.eachSeries(
      tweets,
      async function (tweet) {
        tscParams.tweetStatus = tweet;
        tscParams.tweetStatus.user = {};
        tscParams.tweetStatus.user = user;
        tscParams.tweetStatus.user.isNotRaw = true;

        if (tweet.id_str.toString() > user.tweets.sinceId.toString()) {
          user.tweets.sinceId = tweet.id_str.toString();
        }

        if (
          forceFetch ||
          !user.tweets.tweetIds.includes(tweet.id_str.toString())
        ) {
          try {
            const tweetObj = await tweetServerController.createStreamTweetAsync(
              tscParams
            );

            if (!user.tweetHistograms || user.tweetHistograms === undefined) {
              user.tweetHistograms = {};
            }

            user.tweetHistograms = await tcUtils.processTweetObj({
              tweetObj: tweetObj,
              histograms: user.tweetHistograms,
            });
            user.tweets.tweetIds = _.union(user.tweets.tweetIds, [
              tweet.id_str,
            ]);

            statsObj.twitter.tweetsProcessed += 1;
            statsObj.twitter.tweetsTotal += 1;

            if (configuration.testMode || configuration.verbose) {
              console.log(
                chalkInfo(
                  "TFE | +++ PROCESSED TWEET" +
                    " | FORCE: " +
                    forceFetch +
                    " [ P/H/T " +
                    statsObj.twitter.tweetsProcessed +
                    "/" +
                    statsObj.twitter.tweetsHits +
                    "/" +
                    statsObj.twitter.tweetsTotal +
                    "]" +
                    " | TW: " +
                    tweet.id_str +
                    " | SINCE: " +
                    user.tweets.sinceId +
                    " | TWs: " +
                    user.tweets.tweetIds.length +
                    " | @" +
                    user.screenName
                )
              );
            }

            return;
          } catch (err) {
            console.log(chalkError("TFE | updateUserTweets ERROR: " + err));
            return err;
          }
        } else {
          statsObj.twitter.tweetsHits += 1;
          statsObj.twitter.tweetsTotal += 1;

          if (configuration.testMode || configuration.verbose) {
            console.log(
              chalkLog(
                "TFE | ... TWEET ALREADY PROCESSED" +
                  " [ P/H/T " +
                  statsObj.twitter.tweetsProcessed +
                  "/" +
                  statsObj.twitter.tweetsHits +
                  "/" +
                  statsObj.twitter.tweetsTotal +
                  "]" +
                  " | TW: " +
                  tweet.id_str +
                  " | TWs: " +
                  user.tweets.tweetIds.length +
                  " | @" +
                  user.screenName
              )
            );
          }

          return;
        }
      },
      function (err) {
        if (err) {
          console.log(chalkError("TFE | updateUserTweets ERROR: " + err));
          return reject(err);
        }

        if (forceFetch || configuration.testMode || configuration.verbose) {
          console.log(
            chalkLog(
              "TFE | +++ Ts" +
                " | FORCE: " +
                forceFetch +
                " [ P/H/T " +
                statsObj.twitter.tweetsProcessed +
                "/" +
                statsObj.twitter.tweetsHits +
                "/" +
                statsObj.twitter.tweetsTotal +
                "]" +
                " | Ts: " +
                user.tweets.tweetIds.length +
                " | @" +
                user.screenName
            )
          );
        }
        resolve(user);
      }
    );
  });
}

async function processUserTweets(params) {
  let user = {};
  user = params.user;

  const enableFetchTweets =
    params.enableFetchTweets || configuration.enableFetchTweets;
  const tweets = params.tweets;

  const tscParams = {};

  tscParams.globalTestMode = configuration.globalTestMode;
  tscParams.testMode = configuration.testMode;
  tscParams.inc = false;
  tscParams.twitterEvents = configEvents;
  tscParams.tweetStatus = {};

  let tweetHistogramsEmpty = false;

  try {
    tweetHistogramsEmpty = await tcUtils.emptyHistogram(user.tweetHistograms);

    const forceFetch = enableFetchTweets && tweetHistogramsEmpty;

    const processedUser = await processUserTweetArray({
      user: user,
      forceFetch: forceFetch,
      tweets: tweets,
      tscParams: tscParams,
    });

    if (tweetHistogramsEmpty) {
      // printUserObj(PF + " | >>> processUserTweetArray USER", processedUser);

      debug(
        chalkLog(
          "TFE | >>> processUserTweetArray USER TWEETS" +
            " | SINCE: " +
            processedUser.tweets.sinceId +
            " | TWEETS: " +
            processedUser.tweets.tweetIds.length
        )
      );

      debug(
        chalkLog(
          "TFE | >>> processUserTweetArray USER TWEET HISTOGRAMS" +
            "\n" +
            jsonPrint(processedUser.tweetHistograms)
        )
      );

      debug(
        chalkLog(
          "TFE | >>> processUserTweetArray USER PROFILE HISTOGRAMS" +
            "\n" +
            jsonPrint(processedUser.profileHistograms)
        )
      );
    }

    return processedUser;
  } catch (err) {
    console.log(chalkError("TFE | *** processUserTweetArray ERROR: " + err));
    throw err;
  }
}

async function updateUserTweets(params) {
  const user = params.user;

  const histogramIncompleteFlag = await histogramIncomplete(
    user.tweetHistograms
  );

  if (
    configuration.testFetchTweetsMode ||
    (!userTweetFetchSet.has(user.nodeId) &&
      (histogramIncompleteFlag || user.priorityFlag))
  ) {
    userTweetFetchSet.add(user.nodeId);

    if (configuration.testFetchTweetsMode) {
      console.log(
        chalkAlert(
          "TFE | updateUserTweets | !!! TEST MODE FETCH TWEETS" +
            " | @" +
            user.screenName
        )
      );
    } else {
      debug(
        chalkInfo(
          "TFE | updateUserTweets | >>> PRIORITY FETCH TWEETS" +
            " | @" +
            user.screenName
        )
      );
    }

    user.tweetHistograms = {};
    const latestTweets = await tcUtils.fetchUserTweets({
      user: user,
      force: true,
    });
    if (latestTweets) {
      user.latestTweets = latestTweets;
    }
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

    debug(
      chalkLog(
        "TFE | ---  TWEETS > MAX TWEETIDS" +
          " | " +
          user.nodeId +
          " | @" +
          user.screenName +
          " | " +
          length +
          " TWEETS" +
          " | REMOVE: " +
          removeNumber
      )
    );

    user.tweets.tweetIds.splice(0, removeNumber);
  }

  const processedUser = await processUserTweets({
    tweets: latestTweets,
    user: user,
  });

  return processedUser;
}

async function updateUser(params) {
  const enableFetchTweets =
    params.enableFetchTweets || configuration.enableFetchTweets;

  statsObj.status = "PROCESS USER";

  debug(chalkInfo("PROCESS USER\n" + jsonPrint(params.user)));

  if (userServerController === undefined) {
    console.log(
      chalkError("TFE | *** processUser userServerController UNDEFINED")
    );
    throw new Error("processUser userServerController UNDEFINED");
  }

  const user = params.user;
  user.following = true;

  try {
    let updatedTweetsUser = user;

    if (enableFetchTweets) {
      updatedTweetsUser = await updateUserTweets({ user: user });
    }
    const autoCategoryUser = await generateAutoCategory({
      user: updatedTweetsUser,
    });
    const prevPropsUser = await updatePreviousUserProps({
      user: autoCategoryUser,
    });

    // prevPropsUser.markModified("friends");
    // prevPropsUser.markModified("tweetHistograms");
    // prevPropsUser.markModified("profileHistograms");
    // prevPropsUser.markModified("tweets");
    // prevPropsUser.markModified("latestTweets");

    const savedUser = await prevPropsUser.save();

    if (
      empty(savedUser.profileHistograms) &&
      empty(savedUser.tweetHistograms) &&
      empty(savedUser.friends)
    ) {
      printUserObj(`${PF} | !!! EMPTY USER`, savedUser);
    }

    if (configuration.verbose) {
      printUserObj(PF + " | >>> SAVED USER", savedUser);

      console.log(
        chalkLog(
          "TFE | >>> SAVED USER TWEETS" +
            " | SINCE: " +
            savedUser.tweets.sinceId +
            " | TWEETS: " +
            savedUser.tweets.tweetIds.length
        )
      );

      console.log(
        chalkLog(
          "TFE | >>> SAVED USER TWEET HISTOGRAMS" +
            "\n" +
            jsonPrint(savedUser.tweetHistograms)
        )
      );

      console.log(
        chalkLog(
          "TFE | >>> SAVED USER PROFILE HISTOGRAMS" +
            "\n" +
            jsonPrint(savedUser.profileHistograms)
        )
      );
    }

    userTweetFetchSet.delete(savedUser.nodeId);
    return savedUser;
  } catch (err) {
    if (err.code === 34 || err.statusCode === 401 || err.statusCode === 404) {
      console.log(
        chalkError(
          "TFE | *** processUser ERROR" +
            " | NID: " +
            user.nodeId +
            " | @" +
            user.screenName +
            " | ERR CODE: " +
            err.code +
            " | ERR STATUS CODE: " +
            err.statusCode +
            " | USER_NOT_FOUND or UNAUTHORIZED ... DELETING ..."
        )
      );

      userTweetFetchSet.delete(user.nodeId);
      await global.wordAssoDb.User.deleteOne({ nodeId: user.nodeId });

      return;
    }

    console.log(
      chalkError(
        "TFE | *** processUser ERROR" +
          " | NID: " +
          user.nodeId +
          " | @" +
          user.screenName +
          " | ERR CODE: " +
          err.code +
          " | ERR STATUS CODE: " +
          err.statusCode +
          " | " +
          err
      )
    );

    userTweetFetchSet.delete(user.nodeId);
    throw err;
  }
}

function updatePreviousUserProps(params) {
  return new Promise(function (resolve, reject) {
    if (!params.user) {
      return reject(new Error("user UNDEFINED"));
    }

    const user = params.user;

    async.eachSeries(
      USER_PROFILE_PROPERTY_ARRAY,
      function (userProp, cb) {
        const prevUserProp = "previous" + _.upperFirst(userProp);

        if (
          user[userProp] &&
          user[userProp] !== undefined &&
          user[prevUserProp] != user[userProp]
        ) {
          debug(
            chalkLog(
              "TFE | updatePreviousUserProps" +
                " | " +
                prevUserProp +
                ": " +
                user[prevUserProp] +
                " <- " +
                userProp +
                ": " +
                user[userProp]
            )
          );

          user[prevUserProp] = user[userProp];
        }
        cb();
      },
      function () {
        if (
          user.statusId &&
          user.statusId !== undefined &&
          user.previousStatusId != user.statusId
        ) {
          user.previousStatusId = user.statusId;
        }

        if (
          user.quotedStatusId &&
          user.quotedStatusId !== undefined &&
          user.previousQuotedStatusId != user.quotedStatusId
        ) {
          user.previousQuotedStatusId = user.quotedStatusId;
        }

        resolve(user);
      }
    );
  });
}

const userDefaults = function (user) {
  user.rate = user.rate || 0;
  return user;
};

function printUserObj(title, u, chalkFormat) {
  const chlk = chalkFormat || chalkInfo;

  const user = userDefaults(u);

  console.log(
    chlk(
      title +
        " | " +
        user.nodeId +
        " @" +
        user.screenName +
        " N: " +
        user.name +
        " FC: " +
        user.followersCount +
        " FD: " +
        user.friendsCount +
        " T: " +
        user.statusesCount +
        " M: " +
        user.mentions +
        " R: " +
        user.rate.toFixed(2) +
        " FW: " +
        formatBoolean(user.following) +
        " LS: " +
        getTimeStamp(user.lastSeen) +
        " CN: " +
        user.categorizeNetwork +
        " V: " +
        formatBoolean(user.categoryVerified) +
        " M: " +
        formatCategory(user.category) +
        " A: " +
        formatCategory(user.categoryAuto)
    )
  );
}

async function allQueuesEmpty() {
  if (statsObj.queues.fetchUserQueue.busy) {
    return false;
  }
  if (statsObj.queues.fetchUserQueue.size > 0) {
    return false;
  }

  if (statsObj.queues.processUserQueue.busy) {
    return false;
  }
  if (statsObj.queues.processUserQueue.size > 0) {
    return false;
  }

  // if (statsObj.queues.randomNetworkTreeActivateQueue.busy) { return false; }
  // if (statsObj.queues.randomNetworkTreeActivateQueue.size > 0) { return false; }
  // if (statsObj.queues.randomNetworkTreeRxMessageQueue.size > 0) { return false; }

  if (activateNetworkIntervalBusy) {
    return false;
  }
  if (statsObj.queues.activateNetworkQueue.size > 0) {
    return false;
  }

  if (statsObj.queues.userDbUpdateQueue.busy) {
    return false;
  }
  if (userDbUpdateQueue.length > 0) {
    return false;
  }

  return true;
}

async function processUser(userIn) {
  try {
    const user = await tcUtils.encodeHistogramUrls({ user: userIn });

    user.priorityFlag = userIn.priorityFlag;

    if (!user.latestTweets || user.latestTweets === undefined) {
      user.latestTweets = [];
    }
    if (!user.tweetHistograms || user.tweetHistograms === undefined) {
      user.tweetHistograms = {};
    }
    if (!user.profileHistograms || user.profileHistograms === undefined) {
      user.profileHistograms = {};
      // force image analysis if no profile histograms
      user.profileImageAnalyzed = "";
      user.bannerImageAnalyzed = "";
    }

    user.profileImageUrl =
      typeof user.profileImageUrl === "string"
        ? user.profileImageUrl.trim()
        : "";
    user.profileImageAnalyzed =
      typeof user.profileImageAnalyzed === "string"
        ? user.profileImageAnalyzed.trim()
        : "";

    user.bannerImageUrl =
      typeof user.bannerImageUrl === "string" ? user.bannerImageUrl.trim() : "";
    user.bannerImageAnalyzed =
      typeof user.bannerImageAnalyzed === "string"
        ? user.bannerImageAnalyzed.trim()
        : "";

    if (
      user.profileHistograms.images &&
      user.profileHistograms.images !== undefined
    ) {
      for (const imageEntity of Object.keys(user.profileHistograms.images)) {
        if (imageEntity.includes(".")) {
          // mongoDb hates '.' in object property
          const imageEntityEncoded = btoa(imageEntity);
          user.profileHistograms.images[imageEntityEncoded] =
            user.profileHistograms.images[imageEntity];
          delete user.profileHistograms.images[imageEntity];
          console.log(
            chalkAlert(
              PF +
                " | !!! ILLEGAL PROFILE IMAGE KEY" +
                " | NID: " +
                user.nodeId +
                " | @" +
                user.screenName +
                " | CONVERT " +
                imageEntity +
                " --> " +
                imageEntityEncoded
            )
          );
        }
      }
    }

    if (
      user.profileHistograms.sentiment &&
      user.profileHistograms.sentiment !== undefined
    ) {
      if (user.profileHistograms.sentiment.magnitude !== undefined) {
        if (user.profileHistograms.sentiment.magnitude < 0) {
          console.log(
            chalkAlert(
              "TFE | !!! NORMALIZATION MAG LESS THAN 0 | CLAMPED: " +
                user.profileHistograms.sentiment.magnitude
            )
          );
          user.profileHistograms.sentiment.magnitude = 0;
        }
      }

      if (user.profileHistograms.sentiment.score !== undefined) {
        if (user.profileHistograms.sentiment.score < -1.0) {
          console.log(
            chalkAlert(
              "TFE | !!! NORMALIZATION SCORE LESS THAN -1.0 | CLAMPED: " +
                user.profileHistograms.sentiment.score
            )
          );
          user.profileHistograms.sentiment.score = -1.0;
        }

        if (user.profileHistograms.sentiment.score > 1.0) {
          console.log(
            chalkAlert(
              "TFE | !!! NORMALIZATION SCORE GREATER THAN 1.0 | CLAMPED: " +
                user.profileHistograms.sentiment.score
            )
          );
          user.profileHistograms.sentiment.score = 1.0;
        }
      }
    }

    if (configuration.verbose) {
      printUserObj(PF + " | FOUND USER DB", user);
    }

    if (
      userIn.op == "USER_TWEETS" &&
      userIn.latestTweets.length > 0 &&
      userIn.latestTweets[0].user.id_str == userIn.nodeId
    ) {
      // update user props
      const convertedRawUser = await userServerController.convertRawUserPromise(
        { user: userIn.latestTweets[0].user }
      );

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

      user.lastSeen = userIn.latestTweets[0].created_at;
    }

    defaults(user.tweets, userTweetsDefault);

    if (!userIn.latestTweets || userIn.latestTweets === undefined) {
      userIn.latestTweets = [];
    }

    user.latestTweets = [...user.latestTweets, ...userIn.latestTweets];

    await updateUser({ user: user });

    statsObj.queues.processUserQueue.busy = false;
  } catch (err) {
    console.log(
      chalkError(
        "TFE | *** ERROR processUser" +
          " | USER ID: " +
          userIn.userId +
          " | " +
          err
      )
    );
    console.log(err);
    statsObj.queues.processUserQueue.busy = false;
  }
}

async function initProcessUserQueueInterval(p) {
  const params = p || {};

  const maxParallel =
    params.maxParallel || configuration.userProcessMaxParallel;
  const interval = params.interval || configuration.processUserQueueInterval;

  const processWorkerQueue = async.queue(processUser, maxParallel);

  let allEmpty;
  let more = false;
  let userObj = {};
  const processUserArray = [];

  statsObj.status = "INIT PROCESS USER QUEUE";

  console.log(
    chalkBlue(
      PF +
        " | INIT PROCESS USER QUEUE" +
        " | MAX PARALLEL: " +
        maxParallel +
        " | INTERVAL: " +
        interval +
        " MS"
    )
  );

  statsObj.processedStartFlag = false;
  clearInterval(processUserQueueInterval);

  intervalsSet.add("processUserQueueInterval");

  processUserStartTimeMoment = moment();

  processUserQueueInterval = setInterval(async function () {
    allEmpty = await allQueuesEmpty();

    if (statsObj.fetchUserEndFlag && statsObj.processedStartFlag && allEmpty) {
      console.log(
        chalkBlue(
          "\n==============================" +
            "\nTFE | --- ALL QUEUES EMPTY ---" +
            "\n==============================\n"
        )
      );

      fsm.fsm_fetchAllEnd();

      clearInterval(processUserQueueInterval);
    } else if (
      !statsObj.queues.processUserQueue.busy &&
      processUserQueue.length > 0
    ) {
      try {
        statsObj.status = "PROCESS USER";

        statsObj.queues.processUserQueue.busy = true;

        if (!statsObj.processedStartFlag) {
          statsObj.processedStartFlag = true;
          showStats();
        }

        more = processUserQueue.length > 0;
        processUserArray.length = 0;

        while (more) {
          statsObj.queues.processUserQueue.size = processUserQueue.length;

          if (
            processUserQueue.length > 0 &&
            processUserArray.length < maxParallel
          ) {
            userObj = processUserQueue.shift();

            if (!userObj.end) {
              processUserArray.push(userObj);
            }

            if (userObj.end) {
              console.log(chalkAlert(`${PF} | END`));
              more = false;
            }

            if (processUserQueue.length === 0) {
              more = false;
            }
            if (processUserArray.length >= maxParallel) {
              more = false;
            }
          }
        }

        if (processUserArray.length > 0) {
          processWorkerQueue.push(processUserArray);
          await processWorkerQueue.drain();
          processUserArray.length = 0;
        }

        statsObj.queues.processUserQueue.size = processUserQueue.length;
        statsObj.queues.processUserQueue.busy = false;
      } catch (err) {
        console.log(chalkError("TFE | *** ERROR processUser" + " | " + err));
        console.log(err);
        statsObj.queues.processUserQueue.busy = false;
      }
    }
  }, interval);

  return;
}

statsObj.fsmState = "RESET";

const handleMongooseEvent = (eventObj) => {
  console.log({ eventObj });

  switch (eventObj.event) {
    case "end":
    case "close":
      console.log(`${PF} | CURSOR EVENT: ${eventObj.event.toUpperCase()}`);
      break;

    case "error":
      console.error(`${PF} | CURSOR ERROR: ${eventObj.err}`);
      break;

    default:
      console.error(`*** UNKNOWN EVENT: ${eventObj.event}`);
  }
  return;
};

let fetchUserInterval;

async function initFetchUsers(p) {
  clearInterval(fetchUserInterval);

  const params = p || {};
  const testMode = params.testMode || configuration.testMode;
  const userCursorBatchSize =
    params.userCursorBatchSize || configuration.userCursorBatchSize;

  let query = {};

  if (params.query) {
    query = params.query;
  } else {
    query.categorized = true;
    query.ignored = false;
  }

  console.log(chalkInfo(`${PF} | FETCH USERS | COUNT USERS TO FETCH ...`));
  statsObj.users.categorized.total = await global.wordAssoDb.User.countDocuments(
    { category: { $in: ["left", "right", "neutral"] }, ignored: false }
  );
  statsObj.users.processed.grandTotal = testMode
    ? Math.min(TEST_TOTAL_FETCH, statsObj.users.categorized.total)
    : statsObj.users.categorized.total;

  statsObj.users.processed.startMoment = moment();

  const interval = testMode
    ? TEST_FETCH_USER_INTERVAL
    : params.interval || configuration.fetchUserInterval;

  console.log(
    chalkInfo(
      `${PF} | FETCH USERS | TOTAL USERS TO FETCH: ${statsObj.users.processed.grandTotal}`
    )
  );
  console.log(chalkInfo(`${PF} | FETCH USERS | INTERVAL: ${interval}`));
  console.log(
    chalkInfo(`${PF} | FETCH USERS | BATCH SIZE: ${userCursorBatchSize}`)
  );
  console.log(chalkInfo(`${PF} | FETCH USERS | QUERY\n`, jsonPrint(query)));

  const cursor = await mgUtils.initCursor({
    query: query,
    cursorBatchSize: userCursorBatchSize,
    cursorLimit: statsObj.users.processed.grandTotal,
    cursorLean: false,
  });

  cursor.on("error", async (err) =>
    handleMongooseEvent({ event: "error", err: err })
  );
  cursor.on("end", async () => handleMongooseEvent({ event: "end" }));
  cursor.on("close", async () => handleMongooseEvent({ event: "close" }));

  await tcUtils.setParseImageRequestTimeout(
    configuration.parseImageRequestTimeout
  );

  let fetchUserReady = true;

  statsObj.users.fetched = 0;
  statsObj.users.skipped = 0;

  intervalsSet.add("fetchUserInterval");

  fetchUserInterval = setInterval(async () => {
    if (fetchUserReady) {
      try {
        fetchUserReady = false;

        const user = await cursor.next();

        if (!user) {
          clearInterval(fetchUserInterval);
          fsm.fsm_fetchUserEnd();
          return;
        }

        await cursorDataHandler(user);
        fetchUserReady = true;
      } catch (err) {
        console.error(`${PF} | *** ERROR: ${err}`);
        fetchUserReady = true;
      }
    }
  }, interval);

  return;
}

function reporter(event, oldState, newState) {
  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(
    chalkLog(
      PF +
        " | --------------------------------------------------------\n" +
        PF +
        " | << FSM >> MAIN" +
        " | " +
        event +
        " | " +
        fsmPreviousState +
        " -> " +
        newState +
        "\n" +
        PF +
        " | --------------------------------------------------------"
    )
  );
}

const fsmStates = {
  RESET: {
    onEnter: async function (event, oldState, newState) {
      if (event != "fsm_tick") {
        console.log(chalkTwitter(PF + " | FSM RESET"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM RESET";

        try {
          await showStats(true);
        } catch (err) {
          console.log(PF + " | *** QUIT ERROR: " + err);
        }
      }
    },

    fsm_tick: function () {
      fsm.fsm_resetEnd();
    },

    fsm_resetEnd: "IDLE",
  },

  ERROR: {
    onEnter: async function (event, oldState, newState) {
      if (event != "fsm_tick") {
        console.log(chalkError(PF + " | *** FSM ERROR"));

        reporter(event, oldState, newState);
        statsObj.status = "FSM ERROR";

        quit({ cause: "FSM ERROR" });
      }
    },
  },

  IDLE: {
    onEnter: function (event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM IDLE";
      }
    },

    fsm_tick: function () {
      fsm.fsm_init();
    },

    fsm_init: "INIT",
    fsm_quit: "QUIT",
    fsm_error: "ERROR",
  },

  INIT: {
    onEnter: async function (event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        try {
          console.log(chalkBlue(PF + " | INIT"));
          fsm.fsm_ready();
          // console.log(chalkBlue(PF + " | CREATED ALL CHILDREN: " + Object.keys(childHashMap).length));
        } catch (err) {
          console.log(
            chalkError(PF + " | *** CREATE ALL CHILDREN ERROR: " + err)
          );
          fsm.fsm_error();
        }
      }
    },

    fsm_tick: function () {},

    fsm_quit: "QUIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_ready: "READY",
    fsm_reset: "RESET",
  },

  READY: {
    onEnter: function (event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);
        statsObj.status = "FSM READY";
      }
    },
    fsm_tick: function () {
      fsm.fsm_fetchAll();
    },
    fsm_fetchAll: "FETCH_ALL",
    fsm_quit: "QUIT",
    fsm_exit: "EXIT",
    fsm_error: "ERROR",
    fsm_reset: "RESET",
  },

  FETCH_ALL: {
    onEnter: async function (event, oldState, newState) {
      if (event != "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM FETCH_ALL";

        try {
          await initFetchUsers();
          console.log(chalkLog(`${PF} | FETCH_ALL | ${event}`));
        } catch (err) {
          console.log(chalkError(`${PF} | *** FETCH_ALL ERROR ${err}`));
          fsm.fsm_error();
        }
      }
    },

    fsm_tick: function () {
      statsObj.queues.processUserQueue.size = processUserQueue.length;
      statsObj.queues.activateNetworkQueue.size = activateNetworkQueue.length;
    },
    fsm_error: "ERROR",
    fsm_reset: "RESET",
    fsm_fetchUserEnd: "FETCH_END_ALL",
  },

  FETCH_END_ALL: {
    onEnter: async function (event, oldState, newState) {
      if (event != "fsm_tick") {
        statsObj.status = "END FETCH ALL";

        reporter(event, oldState, newState);

        console.log(
          chalk.bold.blue(
            "TFE | ===================================================="
          )
        );
        console.log(
          chalk.bold.blue(
            "TFE | ================= END FETCH ALL ===================="
          )
        );
        console.log(
          chalk.bold.blue(
            "TFE | ===================================================="
          )
        );

        console.log(
          chalk.bold.blue(
            "TFE | TOTAL USERS PROCESSED:    " + statsObj.users.processed.total
          )
        );
        console.log(
          chalk.bold.blue(
            "TFE | TOTAL USERS FETCH ERRORS: " + statsObj.users.fetchErrors
          )
        );

        console.log(
          chalk.bold.blue(
            "\nTFE | ----------------------------------------------------" +
              "\nTFE | BEST NN: " +
              statsObj.bestNetwork.networkId +
              "\nTFE |  INPUTS: " +
              statsObj.bestNetwork.numInputs +
              " | " +
              statsObj.bestNetwork.inputsId +
              "\nTFE |  SR:     " +
              statsObj.bestNetwork.successRate.toFixed(3) +
              "%" +
              "\nTFE |  MR:     " +
              statsObj.bestNetwork.matchRate.toFixed(3) +
              "%" +
              "\nTFE |  OAMR:   " +
              statsObj.bestNetwork.overallMatchRate.toFixed(3) +
              "%" +
              "\nTFE |  RMR:   " +
              statsObj.bestNetwork.runtimeMatchRate.toFixed(3) +
              "%" +
              "\nTFE |  TC:     " +
              statsObj.bestNetwork.testCycles +
              "\nTFE |  TCH:    " +
              statsObj.bestNetwork.testCycleHistory.length +
              "\nTFE | TWITTER STATS\n" +
              jsonPrint(statsObj.twitter)
          )
        );

        console.log(
          chalk.bold.blue(
            "TFE | ===================================================="
          )
        );
        console.log(
          chalk.bold.blue(
            "TFE | ================= END FETCH ALL ===================="
          )
        );
        console.log(
          chalk.bold.blue(
            "TFE | ===================================================="
          )
        );

        console.log(chalkLog(PF + " | Q STATS\n" + jsonPrint(statsObj.queues)));

        const networkStats = await nnTools.getNetworkStats();

        await updateNetworkStats({
          networks: networkStats.networks,
          saveImmediate: true,
          updateDb: true,
          updateOverallMatchRate: true,
          incrementTestCycles: true,
          addToTestHistory: true,
        });

        if (!bestNetworkHashMap.has(statsObj.currentBestNetworkId)) {
          console.log(
            chalkAlert(
              PF +
                " | *** NN NOT IN BEST NETWORK HASHMAP: " +
                statsObj.currentBestNetworkId
            )
          );
          return;
        }

        currentBestNetwork = bestNetworkHashMap.get(
          statsObj.currentBestNetworkId
        );

        if (configuration.isDatabaseHost || configuration.testMode) {
          const fileObj = {
            networkId: currentBestNetwork.networkId,
            successRate: currentBestNetwork.successRate,
            matchRate: currentBestNetwork.matchRate,
            overallMatchRate: currentBestNetwork.overallMatchRate,
            runtimeMatchRate: currentBestNetwork.runtimeMatchRate,
            testCycles: currentBestNetwork.testCycles,
            testCycleHistory: currentBestNetwork.testCycleHistory,
            rank: currentBestNetwork.rank,
            twitterStats: statsObj.twitter,
            updatedAt: moment(),
          };

          // const folder = (configuration.testMode) ? bestNetworkFolder + "/test" : bestNetworkFolder;
          const folder = bestNetworkFolder;
          const file = currentBestNetwork.networkId + ".json";

          console.log(
            chalkBlue(
              PF +
                " | SAVING BEST NN" +
                " | " +
                currentBestNetwork.networkId +
                " | MR: " +
                currentBestNetwork.matchRate.toFixed(2) +
                " | OAMR: " +
                currentBestNetwork.overallMatchRate.toFixed(2) +
                " | RMR: " +
                currentBestNetwork.runtimeMatchRate.toFixed(2) +
                " | TEST CYCs: " +
                currentBestNetwork.testCycles +
                " | " +
                folder +
                "/" +
                file
            )
          );

          statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue({
            folder: folder,
            file: file,
            obj: currentBestNetwork,
          });

          statsObj.queues.saveFileQueue.size = tcUtils.saveFileQueue({
            folder: folder,
            file: bestRuntimeNetworkFileName,
            obj: fileObj,
          });
        }

        statsObj.loadedNetworksFlag = false;

        if (slackWebClient !== undefined) {
          let slackText = "\n*END FETCH ALL*";
          slackText = slackText + " | " + hostname;
          slackText = slackText + "\nSTART: " + statsObj.startTime;
          slackText = slackText + " | RUN: " + statsObj.elapsed;
          slackText = slackText + " | TOT NNs: " + bestNetworkHashMap.size;
          slackText = slackText + " | BEST INPUTS SET: : " + bestInputsSet.size;
          slackText =
            slackText +
            "\nTOT: " +
            statsObj.users.processed.total +
            " | ERR: " +
            statsObj.users.fetchErrors;
          slackText =
            slackText +
            " (" +
            statsObj.users.processed.percent.toFixed(2) +
            "%)";
          slackText = slackText + "\nIN: " + statsObj.bestNetwork.numInputs;
          slackText =
            slackText + " | INPUTS ID: " + statsObj.bestNetwork.inputsId;
          slackText = slackText + "\nNN: " + statsObj.bestNetwork.networkId;
          slackText =
            slackText +
            "\nOAMR: " +
            statsObj.bestNetwork.overallMatchRate.toFixed(3);
          slackText =
            slackText +
            "\nRMR: " +
            statsObj.bestNetwork.runtimeMatchRate.toFixed(3);
          slackText =
            slackText + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(3);
          slackText =
            slackText + " | SR: " + statsObj.bestNetwork.successRate.toFixed(3);
          slackText =
            slackText + " | TEST CYCs: " + statsObj.bestNetwork.testCycles;
          slackText =
            slackText +
            " | TC HISTORY: " +
            statsObj.bestNetwork.testCycleHistory.length;

          try {
            if (!configuration.offlineMode) {
              await slackSendWebMessage({
                channel: slackChannel,
                text: slackText,
              });
            }
          } catch (err) {
            console.log(chalkError("TFE | *** SLACK SEND ERROR: " + err));
          }
        }

        clearInterval(waitFileSaveInterval);

        statsObj.status = "WAIT UPDATE STATS";

        intervalsSet.add("waitFileSaveInterval");

        waitFileSaveInterval = setInterval(async function () {
          statsObj.queues.saveFileQueue.size = tcUtils.getSaveFileQueue();

          if (statsObj.queues.saveFileQueue.size == 0) {
            console.log(chalk.bold.blue("TFE | ALL NNs SAVED ..."));

            try {
              clearInterval(waitFileSaveInterval);

              console.log(
                chalk.bold.blue(
                  "TFE | BEST NN: " + statsObj.bestNetwork.networkId
                )
              );

              let nnObj = bestNetworkHashMap.get(
                statsObj.bestNetwork.networkId
              );

              nnObj = networkDefaults(nnObj);

              bestNetworkHashMap.set(statsObj.bestNetwork.networkId, nnObj);

              statsObj.status = "END UPDATE STATS";

              if (configuration.quitOnComplete) {
                quit({ source: "QUIT_ON_COMPLETE" });
              } else {
                fsm.fsm_init();
              }
            } catch (err) {
              console.log(
                chalkError("TFE | *** RESET ALL TWITTER USERS: " + err)
              );
              quit({ source: "RESET ALL TWITTER USERS ERROR" });
            }
          } else {
            console.log(
              chalk.bold.blue(
                "TFE | WAITING FOR NNs TO BE SAVED ..." +
                  " | SAVE Q: " +
                  statsObj.queues.saveFileQueue.size
              )
            );
          }
        }, 30 * ONE_SECOND);
      }
    },
    fsm_init: "INIT",
    fsm_reset: "RESET",
    fsm_error: "ERROR",
    fsm_ready: "READY",
  },
};

const fsm = Stately.machine(fsmStates);

function fsmStart(p) {
  const params = p || {};

  const interval = params.fsmTickInterval || configuration.fsmTickInterval;

  return new Promise(function (resolve) {
    console.log(
      chalkLog(PF + " | FSM START | TICK INTERVAL | " + msToTime(interval))
    );

    intervalsSet.add("fsmTickInterval");

    clearInterval(fsmTickInterval);

    fsmTickInterval = setInterval(function () {
      fsm.fsm_tick();
    }, interval);

    resolve();
  });
}

console.log(PF + " | =================================");
console.log(PF + " | HOST:          " + hostname);
console.log(PF + " | PRIMARY_HOST:  " + configuration.primaryHost);
console.log(PF + " | DATABASE_HOST: " + configuration.databaseHost);
console.log(PF + " | PROCESS TITLE: " + process.title);
console.log(PF + " | PROCESS ID:    " + process.pid);
console.log(PF + " | RUN ID:        " + statsObj.runId);
console.log(
  PF +
    " | PROCESS ARGS   " +
    util.inspect(process.argv, { showHidden: false, depth: 1 })
);
console.log(PF + " | =================================");

console.log(
  chalkBlueBold(
    "\n=======================================================================\n" +
      PF +
      " | " +
      MODULE_ID +
      " STARTED | " +
      getTimeStamp() +
      "\n=======================================================================\n"
  )
);

async function initNormalization() {
  console.log(
    chalkLog(
      PF +
        " | loadTrainingSet | LOAD NORMALIZATION" +
        " | " +
        configuration.trainingSetsFolder +
        "/normalization.json"
    )
  );

  const filePath = path.join(
    configuration.trainingSetsFolder,
    "normalization.json"
  );

  const normalization = await fs.readJson(filePath);

  if (normalization) {
    console.log(
      chalk.black.bold(PF + " | loadTrainingSet | SET NORMALIZATION ...")
    );
    await nnTools.setNormalization(normalization);
  } else {
    console.log(
      chalkAlert(
        PF +
          " | loadTrainingSet | !!! NORMALIZATION NOT LOADED" +
          " | " +
          configuration.trainingSetsFolder +
          "/normalization.json"
      )
    );
  }

  return;
}
setTimeout(async function () {
  try {
    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    initSlackWebClient();

    const twitterParams = await tcUtils.initTwitterConfig();
    tcUtils.setEnableLanguageAnalysis(configuration.enableLanguageAnalysis);
    tcUtils.setEnableImageAnalysis(configuration.enableImageAnalysis);
    tcUtils.setEnableGeoCode(configuration.enableGeoCode);
    await tcUtils.initTwitter({ twitterConfig: twitterParams });
    await tcUtils.getTwitterAccountSettings();

    await tcUtils.initSaveFileQueue({
      interval: configuration.saveFileQueueInterval,
    });

    if (configuration.testMode) {
      console.log(chalkAlert(PF + " | TEST MODE"));
    }

    console.log(
      chalkBlueBold(
        "\n" +
          PF +
          " | --------------------------------------------------------" +
          "\n" +
          PF +
          " | " +
          configuration.processName +
          "\n" +
          PF +
          " | --------------------------------------------------------"
      )
    );

    mongooseDb = await mgUtils.connectDb();

    await initNormalization();
    await initUserDbUpdateQueueInterval2({
      interval: configuration.userDbUpdateQueueInterval,
    });
    await initWatchConfig();
    await initProcessUserQueueInterval({
      interval: configuration.processUserQueueInterval,
    });
    await initNetworks();
    await fsmStart();
    await initActivateNetworkQueueInterval({
      interval: configuration.activateNetworkQueueInterval,
    });
  } catch (err) {
    console.log(
      chalkError(PF + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err))
    );
    console.trace(err);
    if (err.code != 404) {
      quit({ cause: new Error("INIT CONFIG ERROR") });
    }
  }
}, 1000);
