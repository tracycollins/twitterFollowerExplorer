 /*jslint node: true */
/*jshint sub:true*/
"use strict";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const DEFAULT_THRECEE_AUTO_FOLLOW_USER = "altthreecee00";
const DEFAULT_WORD_MIN_LENGTH = 3;
const DEFAULT_ENABLE_IMAGE_ANALYSIS = false;
const DEFAULT_FORCE_IMAGE_ANALYSIS = false;

const TEST_MODE_FETCH_USER_TIMEOUT = 30*ONE_SECOND;

const DEFAULT_NUM_NN = 100;  // TOP 100 NN's are loaded from DB

const TEST_MODE_NUM_NN = 5;

const TEST_MODE_FETCH_ALL_INTERVAL = 2*ONE_MINUTE;

const TEST_MODE_TOTAL_FETCH = 200;
const TEST_MODE_FETCH_COUNT = 47;  // per request twitter user fetch count

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

const USER_PROFILE_PROPERTY_ARRAY = [
  "bannerImageUrl",
  "description",
  "location",
  "name",
  "profileUrl",
  "screenName",
  "url"
];

let TweetServerController;
let tweetServerController;
let tweetServerControllerReady = false;

let globalHistograms = {};
let statsObj = {};
statsObj.randomNetworkTreeOp = null;
statsObj.randomNetworkTreeActivateQueueSize = 0;
statsObj.histograms = {};
statsObj.friends = {};
statsObj.friends.raw = 0;
let statsObjSmall = {};

let saveRawFriendFlag = true;

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

let tfeChildHashMap = {};

let unfollowableUserFile = "unfollowableUser.json";
let unfollowableUserSet = new Set();
let ignoredUserSet = new Set();

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

let fetchCycleQueueInterval;
let fetchCycleQueue = [];

let UserServerController;
let userServerController;

let userServerControllerReady = false;

const fetch = require("isomorphic-fetch"); // or another library of choice.


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
const objectPath = require("object-path");
const MergeHistograms = require("@threeceelabs/mergehistograms");
const mergeHistograms = new MergeHistograms();
const url = require("url");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const USER_ID = "tfe_" + hostname;
const SCREEN_NAME = "tfe_" + hostname;

let userObj = {
  name: USER_ID,
  nodeId: USER_ID,
  userId: USER_ID,
  utilId: USER_ID, 
  url: "https://www.twitter.com",
  screenName: SCREEN_NAME,
  namespace: "util",
  type: "TFE",
  timeStamp: moment().valueOf(),
  tags: {},
  stats: {}
} ;

const EventEmitter2 = require("eventemitter2").EventEmitter2;

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20
});

configEvents.on("newListener", function configEventsNewListener(data) {
  debug("*** NEW CONFIG EVENT LISTENER: " + data);
});

let prevHostConfigFileModifiedMoment = moment("2010-01-01");
let prevDefaultConfigFileModifiedMoment = moment("2010-01-01");
let prevConfigFileModifiedMoment = moment("2010-01-01");


const DEFAULT_QUIT_ON_COMPLETE = true;

const PROCESS_USER_QUEUE_INTERVAL = 5;
const LANG_ANAL_MSG_Q_INTERVAL = 5;
const ACTIVATE_NETWORK_QUEUE_INTERVAL = 5;
const USER_DB_UPDATE_QUEUE_INTERVAL = 5;

const LANGUAGE_ANALYZE_INTERVAL = 100;
const RANDOM_NETWORK_TREE_INTERVAL = 5;
const DEFAULT_FETCH_ALL_INTERVAL = 120*ONE_MINUTE;
const FSM_TICK_INTERVAL = ONE_SECOND;
const RANDOM_NETWORK_TREE_MSG_Q_INTERVAL = 5; // ms

const TWITTER_DEFAULT_USER = "altthreecee00";
const MAX_SAVE_DROPBOX_NORMAL = 20 * ONE_MEGABYTE;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";
const DROPBOX_LIST_FOLDER_LIMIT = 100;
const TFC_CHILD_PREFIX = "TFC_";
const SAVE_CACHE_DEFAULT_TTL = 120; // seconds
const TFE_NUM_RANDOM_NETWORKS = 100;
const IMAGE_QUOTA_TIMEOUT = 60000;

const DEFAULT_FORCE_INIT_RANDOM_NETWORKS = true;
const DEFAULT_FETCH_USER_TIMEOUT = 5*ONE_MINUTE;
const DEFAULT_FETCH_COUNT = 200;  // per request twitter user fetch count
const DEFAULT_MIN_SUCCESS_RATE = 80;
const DEFAULT_MIN_MATCH_RATE = 80;
const DEFAULT_MIN_INPUTS_GENERATED = 400 ;
const DEFAULT_MAX_INPUTS_GENERATED = 750 ;
const DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN = 5;
const DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN = 0.4;
const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;
const OFFLINE_MODE = false;

const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkBlueBold = chalk.blue.bold;
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
const randomItem = require("random-item");
const async = require("async");
const Stately = require("stately.js");
const omit = require("object.omit");

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");

const HashMap = require("hashmap").HashMap;

const channelsHashMap = new HashMap();

statsObj.pid = process.pid;
statsObj.childrenFetchBusy = false;

statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.elapsed = 0;

statsObj.status = "START";
statsObj.fsmState = "---";
statsObj.newBestNetwork = false;

statsObj.users = {};
statsObj.users.totalFriendsCount = 0;
statsObj.users.totalFriendsFetched = 0;
statsObj.users.totalPercentFetched = 0;
statsObj.users.totalFriendsProcessed = 0;
statsObj.users.totalPercentProcessed = 0;
statsObj.users.grandTotalFriendsFetched = 0;
statsObj.users.grandTotalPercentFetched = 0;
statsObj.users.grandTotalFriendsProcessed = 0;
statsObj.users.grandTotalPercentProcessed = 0;
statsObj.users.classifiedAuto = 0;
statsObj.users.classified = 0;
statsObj.user = {};
statsObj.user.altthreecee00 = {};
statsObj.user.altthreecee00.friendsProcessed = 0;
statsObj.analyzer = {};
statsObj.analyzer.total = 0;
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.errors = 0;
statsObj.twitterErrors = 0;
statsObj.fetchUsersComplete = false;

statsObj.bestNetworks = {};

statsObj.bestNetwork = {};
statsObj.bestNetwork.testCycles = 0;
statsObj.bestNetwork.testCycleHistory = [];
statsObj.bestNetwork.networkId = false;
statsObj.bestNetwork.successRate = 0;
statsObj.bestNetwork.matchRate = 0;
statsObj.bestNetwork.overallMatchRate = 0;
statsObj.bestNetwork.numInputs = 0;
statsObj.bestNetwork.inputsId = "";

statsObj.totalInputs = 0;
statsObj.numNetworksLoaded = 0;
statsObj.numNetworksUpdated = 0;
statsObj.numNetworksSkipped = 0;
// statsObj.histograms = {};
statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};
statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;
statsObj.numLangAnalyzed = 0;
statsObj.categorized = {};
statsObj.categorized.manual = {};
statsObj.categorized.auto = {};
statsObj.categorized.total = 0;
statsObj.categorized.totalManual = 0;
statsObj.categorized.totalAuto = 0;

let statsPickArray = [
  "pid", 
  "startTime", 
  "elapsed", 
  "status", 
  "numChildren", 
  "fsmState",
  "categorized",
  "bestNetwork",
  "users",
  "fetchCycle"
];

let fsm;
let fsmTickInterval;
let fsmPreviousState = "IDLE";

let fetchAllInterval;
let fetchAllIntervalReady = false;

let bestNetworkHashMap = new HashMap();

let maxInputHashMap = {};

let randomNetworkTree;
let randomNetworkTreeMessageRxQueueInterval;
let randomNetworkTreeMessageRxQueueReadyFlag = true;
let randomNetworkTreeReadyFlag = false;
let randomNetworkTreeBusyFlag = false;
let randomNetworkTreeActivateQueueSize = 0;
let randomNetworkTreeMessageRxQueue = [];

let randomNetworksObj = {};


// let enableImageAnalysis = true;

let langAnalyzer;
let langAnalyzerMessageRxQueueInterval;
let langAnalyzerMessageRxQueueReadyFlag = true;
let languageAnalysisBusyFlag = false;
let langAnalyzerMessageRxQueue = [];

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
let userDbUpdateQueue = [];

let quitWaitInterval;
let quitFlag = false;

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

let slackChannel = "tfe";
let slackText = "";

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackConversationId = "D65CSAELX"; // wordbot
const slackRtmToken = "xoxb-209434353623-bNIoT4Dxu1vv8JZNgu7CDliy";
const shackTitleLink = "https://twitter.com/threecee";

const Slack = require("slack-node");
const slack = new Slack(slackOAuthAccessToken);

let slackRtmClient;
let slackWebClient;

let slackMessagePrefix = "#" + slackChannel + ":" + hostname + "_" + process.pid;

function slackSendMessage(msgObj){

  let message = msgObj;

  if (msgObj.message || msgObj.webOnly) { message = msgObj.message; }

  return new Promise(async function(resolve, reject){

    try {
      await slackSendWebMessage(message);
      if (!msgObj.webOnly && !msgObj.message) { await slackSendRtmMessage(msgObj); }
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function slackSendRtmMessage(msg){

  return new Promise(async function(resolve, reject){

    try {

      // const message = slackMessagePrefix + ":" + msg;

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

let slackDefaultAttachments = [];

let slackDefaultAttachment = {};
slackDefaultAttachment.fallback = "TFE | " + hostname + "_" + process.pid;
slackDefaultAttachment.title = "@threecee";
slackDefaultAttachment.title_link = "http://twitter.com/threecee";
slackDefaultAttachment.text = "TFE";
slackDefaultAttachment.fields = [];
slackDefaultAttachment.fields.push({ title: "PROCESS", value: hostname + "_" + process.pid });

slackDefaultAttachments.push(slackDefaultAttachment);


function slackSendWebMessage(msgObj){

  return new Promise(async function(resolve, reject){

    try {

      const token = msgObj.token || slackOAuthAccessToken;
      const channel = msgObj.channel || configuration.slackChannel.id;
      const title = msgObj.title || null;
      const title_link = msgObj.title_link || null;
      const pretext = msgObj.pretext || hostname + "_" + process.pid;
      const text = msgObj.text || "TFE | " + hostname + "_" + process.pid + " | " + msgObj;
      const attachments = msgObj.attachments || slackDefaultAttachments;

      let message = {
        token: token, 
        channel: channel,
        title: title,
        title_link: title_link,
        pretext: pretext,
        text: text,
        attachments: attachments
      };

      debug(chalkBlueBold("TFE | SLACK WEB | SEND\n" + jsonPrint(message)));
      const sendResponse = await slackWebClient.chat.postMessage(message);

      debug(chalkLog("TFE | SLACK WEB | >T\n" + jsonPrint(sendResponse)));
      console.log(chalkLog("TFE | SLACK WEB | >T | " + sendResponse.message.text));
      resolve(sendResponse);
    }
    catch(err){
      reject(err);
    }

  });
}

function slackSendWebStats(params){

  return new Promise(async function(resolve, reject){

    try {

      const token = params.token || slackOAuthAccessToken;
      const channel = params.channel || slackChannel;
      const title = "TFE | " + hostname +  "_" + process.pid + " | STATS";
      const title_link = params.title_link || shackTitleLink;
      const pretext = params.pretext || "S: " + statsObj.startTimeMoment.format(compactDateTimeFormat) + " | E: " + msToTime(statsObj.elapsed);
      const text = params.text || "TFE | " + hostname + "_" + process.pid;
      const attachments = params.attachments || slackDefaultAttachments;

      let message = {
        token: token, 
        channel: channel,
        title: title,
        title_link: title_link,
        pretext: pretext,
        text: text,
        attachments: attachments
      };

      console.log(chalkBlueBold("TFE | SLACK WEB | SEND\n" + jsonPrint(message)));

      const sendResponse = await slackWebClient.chat.postMessage(message);

      console.log(chalkLog("TFE | SLACK WEB | >T\n" + jsonPrint(sendResponse)));
      resolve(sendResponse);
    }
    catch(err){
      reject(err);
    }

  });
}

function slackMessageHandler(message){
  return new Promise(async function(resolve, reject){

    try {

      console.log(chalkLog("TFE | <RX MESSAGE | " + message.type + " | " + message.text));

      switch (message.text) {
        case "ERROR":
        case "FETCH FRIENDS":
        case "FSM INIT":
        case "INIT LANG ANALYZER":
        case "INIT MAX INPUT HASHMAP":
        case "INIT NNs":
        case "INIT RAN NNs":
        case "INIT RNT CHILD":
        case "INIT TWITTER USERS":
        case "INIT UNFOLLOWABLE":
        case "INIT":
        case "LOAD BEST NN":
        case "LOAD NN":
        case "PONG":
        case "QUIT":
        case "QUITTING":
        case "READY":
        case "RESET":
        case "SLACK QUIT":
        case "SLACK READY":
        case "START":
        case "STATS":
        case "TEXT":
          resolve();
        break;
        case "PING":
          // slackSendMessage("PONG");
          resolve();
        break;
        default:
          // console.log(chalkAlert("TFE | *** UNDEFINED SLACK MESSAGE: " + message.text));
          // reject(new Error("UNDEFINED SLACK MESSAGE TYPE: " + message.text));
          resolve();
      }
    }
    catch(err){
      reject(err);
    }

  });
}

function initSlackWebClient(params){

  return new Promise(async function(resolve, reject){

    try {

      const { WebClient } = require("@slack/client");
      slackWebClient = new WebClient(slackRtmToken);

      const testResponse = await slackWebClient.api.test();
      console.log("TFE | SLACK WEB TEST RESPONSE\n" + jsonPrint(testResponse));

      const botsInfoResponse = await slackWebClient.bots.info();
      console.log("TFE | SLACK WEB BOTS INFO RESPONSE\n" + jsonPrint(botsInfoResponse));

      const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

      conversationsListResponse.channels.forEach(async function(channel){
  
        console.log(chalkLog("TFE | CHANNEL | " + channel.id + " | " + channel.name));

        if (channel.name === slackChannel) {
          configuration.slackChannel = channel;
          const conversationsJoinResponse = await slackWebClient.conversations.join({token: slackOAuthAccessToken, channel: configuration.slackChannel.id });

          slackSendWebMessage("SLACK INIT");

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

function initSlackRtmClient(params){

  return new Promise(async function(resolve, reject){

    try {

      const { RTMClient } = require("@slack/client");
      slackRtmClient = new RTMClient(slackRtmToken);

      const slackInfo = await slackRtmClient.start();

      console.log(chalkLog("TFE | SLACK RTM | INFO\n" + jsonPrint(slackInfo)));

      slackRtmClient.on("slack_event", async function(eventType, event){
        switch (eventType) {
          case "pong":
            debug(chalkLog("TFE | SLACK RTM PONG | " + getTimeStamp() + " | " + event.reply_to));
          break;
          default: console.log(chalkLog("TFE | SLACK RTM EVENT | " + getTimeStamp() + " | "  + eventType + " | " + event.text));
        }
      });


      slackRtmClient.on("message", async function(message){
        if (configuration.verbose)  { console.log(chalkLog("TFE | RTM R<\n" + jsonPrint(message))); }
        console.log(`TFE | SLACK RX< RTM MESSAGE | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

        try {
          await slackMessageHandler(message);
        }
        catch(err){
          console.log(chalkError("TFE | *** SLACK RTM MESSAGE ERROR: " + err));
        }

      });

      slackRtmClient.on("error", async function(err){
        console.log(chalkError("TFE | *** SLACK RTM CLIENT ERROR: " + err));
        statsObj.status = "SLACK RTM ERROR";
        objectPath.set(statsObj, "slack.rtm.error", err); 
        objectPath.set(statsObj, "slack.rtm.connected", false); 
        objectPath.set(statsObj, "slack.rtm.ready", false); 
        console.log(chalkLog("TFE | SLACK STATUS\n" + jsonPrint(statsObj.slack)));
      });

      slackRtmClient.on("disconnected", async function(){
        console.log(chalkAlert("TFE | *** SLACK RTM CLIENT DISCONNECTED"));
        statsObj.status = "SLACK RTM DISCONNECTED";
        objectPath.set(statsObj, "slack.rtm.connected", false); 
        objectPath.set(statsObj, "slack.rtm.ready", false); 
        console.log(chalkLog("TFE | SLACK STATUS\n" + jsonPrint(statsObj.slack)));
      });

      slackRtmClient.on("ready", async function(){

        try {

          statsObj.status = "SLACK RTM READY";

          objectPath.set(statsObj, "slack.rtm.error", false); 
          objectPath.set(statsObj, "slack.rtm.connected", true); 

          const slackRtmReady = objectPath.get(statsObj, "slack.rtm.ready", false); 

          console.log("slackRtmReady: " + slackRtmReady);

          if (slackRtmReady) { return resolve(); } // already sent slack rtm ready

          objectPath.set(statsObj, "slack.rtm.ready", true); 

          await slackSendRtmMessage(hostname + " | TFE | SLACK RTM READY");

          let message = {};
          message.pretext = hostname + "_" + process.pid;
          message.text = hostname + " | TFE | SLACK RTM READY";

          await slackSendWebMessage(message);

          console.log(chalkLog("TFE | SLACK STATUS\n" + jsonPrint(statsObj.slack)));

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

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";
let bestRuntimeNetworkId = false;
let loadedNetworksFlag = false;
let currentBestNetworkId = false;

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

let activateNetworkQueue = [];
let activateNetworkQueueReady = false;
let activateNetworkQueueInterval;

let processUserQueue = [];
let processUserQueueInterval;
let processUserQueueReady = true;

let saveFileQueueInterval;
let saveFileBusy = false;
let saveFileQueue = [];
let statsUpdateInterval;
let prevBestNetworkId = "";

const jsonPrint = function (obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

function genSlackStatus(params) {

  let message = {};
  message.token = slackOAuthAccessToken;
  message.channel = configuration.slackChannel.id,
  message.pretext = hostname + "_" + process.pid,
  message.text = hostname + " | TFE | STATUS | " + statsObj.status;
  message.attachments = [];

  let fieldsArray = [];
  fieldsArray.push({ short: false, title: hostname, value: process.pid });
  fieldsArray.push({ short: false, title: "STATUS", value: statsObj.status });
  fieldsArray.push({ short: false, title: "BEST", value: bestRuntimeNetworkId });
  fieldsArray.push({ short: false, title: "IN", value: currentBestNetwork.numInputs + " | " + currentBestNetwork.inputsId });
  fieldsArray.push({ short: true, title:  "OAMR", value: currentBestNetwork.overallMatchRate.toFixed(2) + "%" });
  fieldsArray.push({ short: true, title:  "MR", value: currentBestNetwork.matchRate.toFixed(2) + "%" });
  fieldsArray.push({ short: true, title:  "SR", value: currentBestNetwork.successRate.toFixed(2) + "%" });
  fieldsArray.push({ short: true, title:  "START", value: statsObj.startTimeMoment.format(compactDateTimeFormat) });
  fieldsArray.push({ short: true, title:  "ELPSD", value: msToTime(statsObj.elapsed) });
  fieldsArray.push({ short: true, title:  "TOT PRCSD", value: statsObj.users.totalFriendsProcessed });
  fieldsArray.push({ short: true, title:  "GTOT PRCSD", value: statsObj.users.grandTotalPercentProcessed });
  fieldsArray.push({ short: true, title:  "TCs", value: currentBestNetwork.testCycles });
  fieldsArray.push({ short: true, title:  "TCH", value: currentBestNetwork.testCycleHistory.length });

  message.attachments.push({text: "STATS", fields: fieldsArray});

  return message;
}

const quit = async function(options) {

  options = options || {};

  statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  statsObj.timeStamp = moment().format(compactDateTimeFormat);
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  const caller = callerId.getData();

  console.log(chalkAlert("TFE | *** QUIT ***"
    + "\n" + jsonPrint(caller)
  ));

  clearInterval(dbConnectionReadyInterval);
  clearInterval(activateNetworkQueueInterval);

  quitFlag = true;

  fsm.fsm_reset();

  Object.keys(tfeChildHashMap).forEach(function(user) {
    tfeChildHashMap[user].child.send({op: "QUIT"});
  });

  if (options && (options.source === "RNT")) {
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
  }

  if (options && (options.source !== "RNT") && (randomNetworkTree && (randomNetworkTree !== undefined))) {
    randomNetworkTree.send({op: "STATS"});
    randomNetworkTree.send({op: "QUIT"});
    randomNetworkTreeBusyFlag = false;
    randomNetworkTreeReadyFlag = true;
  }

  console.log( "\nTFE | ... QUITTING ..." );

  if (options) {
    console.log( "TFE | options: " + jsonPrint(options) );
  }

  let message = genSlackStatus();

  try {
    await slackSendMessage({ webOnly: true, message: message});
  }
  catch(err){
    console.log(chalkError("TFE | *** SLACK QUIT MESSAGE ERROR: " + err));
  }

  quitWaitInterval = setInterval(async function() {

    if (forceQuitFlag 
      || (!saveFileBusy
      && (!randomNetworkTreeBusyFlag || randomNetworkTreeReadyFlag)
      && (saveFileQueue.length === 0)
      && (langAnalyzerMessageRxQueue.length === 0)
      && (randomNetworkTreeMessageRxQueue.length === 0)
      && (userDbUpdateQueue.length === 0)
      && randomNetworkTreeMessageRxQueueReadyFlag
      && !languageAnalysisBusyFlag
      && userDbUpdateQueueReadyFlag)
      ) {

      clearInterval(statsUpdateInterval);
      clearInterval(userDbUpdateQueueInterval);
      clearInterval(quitWaitInterval);

      if (forceQuitFlag) {
        console.log(chalkAlert("TFE | *** FORCE QUIT"
          + " | SAVE FILE BUSY: " + saveFileBusy
          + " | SAVE FILE Q: " + saveFileQueue.length
          + " | RNT BUSY: " + randomNetworkTreeBusyFlag
          + " | RNT READY: " + randomNetworkTreeReadyFlag
          + " | RNT AQ: " + randomNetworkTreeActivateQueueSize
          + " | RNT MQ: " + randomNetworkTreeMessageRxQueue.length
          + " | LA MQ: " + langAnalyzerMessageRxQueue.length
          + " | USR DB UDQ: " + userDbUpdateQueue.length
        ));
      }
      else {
        console.log(chalkBlueBold("\n=======\nTFE | ALL PROCESSES COMPLETE ... QUITTING"
          + " | SAVE FILE BUSY: " + saveFileBusy
          + " | SAVE FILE Q: " + saveFileQueue.length
          + " | RNT BUSY: " + randomNetworkTreeBusyFlag
          + " | RNT READY: " + randomNetworkTreeReadyFlag
          + " | RNT AQ: " + randomNetworkTreeActivateQueueSize
          + " | RNT MQ: " + randomNetworkTreeMessageRxQueue.length
          + " | LA MQ: " + langAnalyzerMessageRxQueue.length
          + " | USR DB UDQ: " + userDbUpdateQueue.length
          + "\n=======\n"
        ));
      }

      await slackSendMessage(hostname + " | TFE | QUIT");

      setTimeout(function() {

        global.dbConnection.close(async function () {
          console.log(chalkBlue(
            "\nTFE | ==========================\n"
            + "TFE | MONGO DB CONNECTION CLOSED"
            + "\nTFE | ==========================\n"
          ));

          process.exit();
        });

      }, 5000);

    }
    else {
      if (options && (options.source !== "RNT") && (randomNetworkTree && (randomNetworkTree !== undefined))) {
        randomNetworkTree.send({op: "STATS"});
        randomNetworkTree.send({op: "QUIT"});
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
      }
      console.log(chalkLog("TFE | ... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
        + " | SAVE FILE BUSY: " + saveFileBusy
        + " | SAVE FILE Q: " + saveFileQueue.length
        + " | RNT BUSY: " + randomNetworkTreeBusyFlag
        + " | RNT READY: " + randomNetworkTreeReadyFlag
        + " | RNT AQ: " + randomNetworkTreeActivateQueueSize
        + " | RNT MQ: " + randomNetworkTreeMessageRxQueue.length
        + " | LA MQ: " + langAnalyzerMessageRxQueue.length
        + " | USR DB UDQ: " + userDbUpdateQueue.length
      ));
    }
  }, 5000);
};


const cp = require("child_process");

let previousRandomNetworksHashMap = {};

let inputsIdSet = new Set();

let stdin;
let abortCursor = false;
let neuralNetworkInitialized = false;
let TFE_USER_DB_CRAWL = false;

let defaultConfiguration = {}; // general configuration for TNN
let hostConfiguration = {}; // host-specific configuration for TNN

let configuration = {};

configuration.testMode = false;
configuration.globalTestMode = false;

configuration.archiveNetworkOnInputsMiss = true;

configuration.slackChannel = {};

configuration.reinitializeChildOnClose = false;
configuration.networkDatabaseLoadLimit = configuration.testMode ? TEST_MODE_NUM_NN : DEFAULT_NUM_NN;

configuration.DROPBOX = {};
configuration.DROPBOX.DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
configuration.DROPBOX.DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
configuration.DROPBOX.DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

configuration.threeceeAutoFollowUser = DEFAULT_THRECEE_AUTO_FOLLOW_USER;

configuration.enableImageAnalysis = DEFAULT_ENABLE_IMAGE_ANALYSIS;
configuration.forceImageAnalysis = DEFAULT_FORCE_IMAGE_ANALYSIS;
configuration.forceInitRandomNetworks = DEFAULT_FORCE_INIT_RANDOM_NETWORKS;
configuration.enableLanguageAnalysis = false;
configuration.forceLanguageAnalysis = false;
configuration.processUserQueueInterval = 20;
configuration.bestNetworkIncrementalUpdate = false;
configuration.twitterUsers = ["altthreecee00", "altthreecee01", "altthreecee02", "altthreecee03", "altthreecee04", "altthreecee05"];
configuration.saveFileQueueInterval = 1000;
configuration.minSuccessRate = DEFAULT_MIN_SUCCESS_RATE;
configuration.minMatchRate = DEFAULT_MIN_MATCH_RATE;
configuration.fetchCount = configuration.testMode ? TEST_MODE_FETCH_COUNT :  DEFAULT_FETCH_COUNT;
configuration.keepaliveInterval = 5*ONE_SECOND;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.quitOnComplete = DEFAULT_QUIT_ON_COMPLETE;

configuration.fetchUserTimeout = configuration.testMode ? TEST_MODE_FETCH_USER_TIMEOUT :  DEFAULT_FETCH_USER_TIMEOUT;


["manual", "auto"].forEach(function(cat) {
  statsObj.categorized[cat].left = 0;
  statsObj.categorized[cat].right = 0;
  statsObj.categorized[cat].neutral = 0;
  statsObj.categorized[cat].positive = 0;
  statsObj.categorized[cat].negative = 0;
  statsObj.categorized[cat].none = 0;
  statsObj.categorized[cat].other = 0;
});


const TFE_RUN_ID = hostname 
+ "_" + statsObj.startTimeMoment.format(compactDateTimeFormat) 
+ "_" + process.pid;

statsObj.runId = TFE_RUN_ID;

let twitterUserHashMap = {};

let defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigDefaultFolder = "/config/utility/default";
const dropboxConfigHostFolder = "/config/utility/" + hostname;

const dropboxConfigDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE;
const dropboxConfigHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_TFE_CONFIG_FILE;

let testDataUserFolder = dropboxConfigHostFolder + "/test/testData/user";

let statsFolder = "/stats/" + hostname + "/followerExplorer";
let statsFile = DROPBOX_TFE_STATS_FILE;

configuration.neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

let localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
let bestNetworkFolder = (hostname === "google") ? "/config/utility/best/neuralNetworks" : localBestNetworkFolder;

const defaultTrainingSetFolder = dropboxConfigDefaultFolder + "/trainingSets";
const defaultMaxInputHashmapFile = "maxInputHashMap.json";

const localHistogramsFolder = dropboxConfigHostFolder + "/histograms";
const defaultHistogramsFolder = dropboxConfigDefaultFolder + "/histograms";

let  defaultInputsConfigFile = "default_networkInputsConfig.json";
let  hostInputsConfigFile =  hostname + "_networkInputsConfig.json";

const Dropbox = require("dropbox").Dropbox;

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


process.on("unhandledRejection", function(err, promise) {
  console.trace("TFE | *** Unhandled rejection (promise: ", promise, ", reason: ", err, ").");
  process.exit();
});


// ==================================================================
// NN CACHE
// ==================================================================
let saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;

if (saveCacheTtl === undefined) { saveCacheTtl = SAVE_CACHE_DEFAULT_TTL; }

console.log("TFE | SAVE CACHE TTL: " + saveCacheTtl + " SECONDS");

let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

console.log("TFE | SAVE CACHE CHECK PERIOD: " + saveCacheCheckPeriod + " SECONDS");

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
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj) {
  debug(chalkLog("TFE | $$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));
  if (file === bestRuntimeNetworkFileName) {
    saveCache.ttl(bestRuntimeNetworkFileName, 30, function( err, changed ) {
      if( !err ) {
        debug("SAVE CACHE TTL bestRuntimeNetworkFileName: 30 | CHANGED: " + changed ); // true
        // ... do something ...
      }
    });
  }
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

const networkDefaults = function (networkObj){

  if (networkObj.testCycles === undefined) { networkObj.testCycles = 0; }
  if (networkObj.testCycleHistory === undefined) { networkObj.testCycleHistory = []; }
  if (networkObj.overallMatchRate === undefined) { networkObj.overallMatchRate = 0; }
  if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }
  if (networkObj.successRate === undefined) { networkObj.successRate = 0; }

  return networkObj;
};

function printNetworkObj(title, networkObj) {
  console.log(chalkNetwork(title
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

function resetTwitterUserState(user) {

  return new Promise(function(resolve, reject){

    statsObj.status = "RESET TWITTER USER | @" + user;

    console.log(chalkTwitterBold("TFE | RESET TWITTER STATE"
      + " | @" + user
    ));

    if (statsObj.user[user] === undefined) {
      statsObj.user[user] = {};
    }

    statsObj.user[user].endFetch = true;
    statsObj.user[user].nextCursor = false;
    statsObj.user[user].nextCursorValid = false;
    statsObj.user[user].totalFriendsFetched = 0;
    statsObj.user[user].twitterRateLimit = 0;
    statsObj.user[user].twitterRateLimitExceptionFlag = false;
    statsObj.user[user].twitterRateLimitRemaining = 0;
    statsObj.user[user].twitterRateLimitRemainingTime = 0;
    statsObj.user[user].twitterRateLimitResetAt = moment();
    statsObj.user[user].friendsProcessed = 0;
    statsObj.user[user].percentProcessed = 0;
    statsObj.user[user].friendsProcessStart = moment();
    statsObj.user[user].friendsProcessEnd = moment();
    statsObj.user[user].friendsProcessElapsed = 0;

    resolve();

  });

}

function resetAllTwitterUserState(callback) {

  return new Promise(function(resolve, reject){

    statsObj.status = "RESET ALL TWITTER USERS";

    async.forEach(Object.keys(twitterUserHashMap), async function(user) {
      try {
        await resetTwitterUserState(user);
        return;
      }
      catch(err){
        return(err);
      }
    }, function(err) {
      if (err) { return reject(err); }
      resolve();
    });

  });
}

function updateBestNetworkStats(networkObj) {

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
}

function loadFile(params) {

  return new Promise(async function(resolve, reject){

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
            return reject(new Error("TFE LOAD FILE PAYLOAD UNDEFINED"));
          }

          const fileObj = JSONParse(payload);

          if (fileObj.value) {
            return resolve(fileObj.value);
          }

          console.log(chalkError("TFE | DROPBOX loadFile ERROR: " + fullPath));
          return reject(fileObj.error);
        }
        else {
          resolve();
        }
      })
      .catch(function(error) {

        console.log(chalkError("TFE | DROPBOX loadFile ERROR: " + fullPath));
        
        if ((error.status === 409) || (error.status === 404)) {
          console.log(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
            + " ... SKIPPING ...")
          );
          return reject(error);
        }
        
        if (error.status === 0) {
          console.log(chalkError("TFE | !!! DROPBOX NO RESPONSE"
            + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
          return reject(error);
        }

        reject(error);

      });
    }
  });
}


const cla = require("command-line-args");
const numRandomNetworks = { name: "numRandomNetworks", alias: "n", type: Number};
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitNow = { name: "quitOnError", alias: "K", type: Boolean, defaultValue: true};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean};
const userDbCrawl = { name: "userDbCrawl", alias: "C", type: Boolean};
const testMode = { name: "testMode", alias: "X", type: Boolean};
const loadNeuralNetworkID = { name: "loadNeuralNetworkID", alias: "N", type: Number };

const optionDefinitions = [
  enableStdin, 
  numRandomNetworks, 
  quitOnError, 
  quitOnComplete, 
  loadNeuralNetworkID, 
  userDbCrawl, 
  testMode
];

const commandLineConfig = cla(optionDefinitions);
console.log(chalkInfo("TFE | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log("TFE | COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

function loadCommandLineArgs(){

  return new Promise(function(resolve, reject){

    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.each(commandLineConfigKeys, function(arg, cb){

      configuration[arg] = commandLineConfig[arg];

      console.log("TFE | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);

      cb();

    }, function(){
      statsObj.commandLineArgsLoaded = true;
      resolve();
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
      console.log(chalkError("TFE | *** DROPBOX getFileMetadata ERROR: " + fullPath));
      console.log(chalkError("TFE | *** ERROR\n" + jsonPrint(err.error)));

      if ((err.status === 404) || (err.status === 409)) {
        console.error(chalkError("TFE | *** DROPBOX READ FILE " + fullPath + " NOT FOUND"));
      }
      if (err.status === 0) {
        console.error(chalkError("TFE | *** DROPBOX NO RESPONSE"));
      }

      reject(err);

    });

  });
}

function listDropboxFolder(params){

  return new Promise(function(resolve, reject){

    try{

      statsObj.status = "LIST DROPBOX FOLDER: " + params.folder;

      console.log(chalkNetwork("TFE | LISTING DROPBOX FOLDER | " + params.folder));

      let results = {};
      results.entries = [];

      let cursor;
      let more = false;

      if (configuration.offlineMode) {
        dropboxClient = dropboxLocalClient;
      }
      else {
        dropboxClient = dropboxRemoteClient;
      }

      dropboxClient.filesListFolder({path: params.folder, limit: DROPBOX_LIST_FOLDER_LIMIT})
      .then(function(response){

        cursor = response.cursor;
        more = response.has_more;
        results.entries = response.entries;

        if (configuration.verbose) {
          console.log(chalkLog("DROPBOX LIST FOLDER"
            + " | FOLDER:" + params.folder
            + " | ENTRIES: " + response.entries.length
            + " | LIMIT: " + params.limit
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
                    + " | LIMIT: " + params.limit
                    + " | MORE: " + more
                  ));
                }

              })
              .catch(function(err){
                console.trace(chalkError("TNN | *** DROPBOX filesListFolderContinue ERROR: ", err));
                return reject(err);
              });

              async.setImmediate(function() { cb(); });

            }, 1000);
          },

          function(err){
            if (err) {
              console.log(chalkError("TNN | DROPBOX LIST FOLDERS: " + err + "\n" + jsonPrint(err)));
              return reject(err);
            }
            resolve(results);
          });
      })
      .catch(function(err){
        console.log(chalkError("TNN | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        return reject(err);
      });

    }
    catch(err){
      console.log(chalkError("TNN | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
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


      const response = await getFileMetadata({folder: params.folder, file: params.file});

      const fileModifiedMoment = moment(new Date(response.client_modified));
      
      if (fileModifiedMoment.isSameOrBefore(prevConfigFileModifiedMoment)){

        console.log(chalkInfo("TFE | CONFIG FILE BEFORE OR EQUAL"
          + " | " + fullPath
          + " | PREV: " + prevConfigFileModifiedMoment.format(compactDateTimeFormat)
          + " | " + fileModifiedMoment.format(compactDateTimeFormat)
        ));
        return resolve();
      }

      console.log(chalkLog("TFE | +++ CONFIG FILE AFTER ... LOADING"
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

      const loadedConfigObj = await loadFile({folder: params.folder, file: params.file});

      if ((loadedConfigObj === undefined) || !loadedConfigObj) {
        console.log(chalkError("TFE | DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("JSON UNDEFINED"));
      }

      console.log(chalkInfo("TFE | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

      let newConfiguration = {};
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

      if (loadedConfigObj.TFE_FETCH_USER_TIMEOUT !== undefined) {
        console.log("TFE | LOADED TFE_FETCH_USER_TIMEOUT: " + loadedConfigObj.TFE_FETCH_USER_TIMEOUT);
        newConfiguration.fetchUserTimeout = loadedConfigObj.TFE_FETCH_USER_TIMEOUT;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined) {
        console.log("TFE | LOADED TFE_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN);
        newConfiguration.histogramParseDominantMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN !== undefined) {
        console.log("TFE | LOADED TFE_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN);
        newConfiguration.histogramParseTotalMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.TFE_MIN_SUCCESS_RATE !== undefined) {
        console.log("TFE | LOADED TFE_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_MIN_SUCCESS_RATE);
        newConfiguration.minSuccessRate = loadedConfigObj.TFE_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_MIN_MATCH_RATE !== undefined) {
        console.log("TFE | LOADED TFE_MIN_MATCH_RATE: " + loadedConfigObj.TFE_MIN_MATCH_RATE);
        newConfiguration.minMatchRate = loadedConfigObj.TFE_MIN_MATCH_RATE;
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

      if (loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID  !== undefined) {
        console.log("TFE | LOADED TFE_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID);
        newConfiguration.loadNeuralNetworkID = loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID;
      }

      if (loadedConfigObj.TFE_USER_DB_CRAWL !== undefined) {
        console.log("TFE | LOADED TFE_USER_DB_CRAWL: " + loadedConfigObj.TFE_USER_DB_CRAWL);
        newConfiguration.userDbCrawl = loadedConfigObj.TFE_USER_DB_CRAWL;
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
      console.error(chalkError("TFE | ERROR LOAD DROPBOX CONFIG: " + fullPath
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
        console.log(chalkLog("TFE | +++ RELOADED DEFAULT CONFIG " + dropboxConfigDefaultFolder + "/" + dropboxConfigDefaultFile));
      }
      
      const hostConfig = await loadConfigFile({folder: dropboxConfigHostFolder, file: dropboxConfigHostFile});

      if (hostConfig) {
        hostConfiguration = hostConfig;
        console.log(chalkLog("TFE | +++ RELOADED HOST CONFIG " + dropboxConfigHostFolder + "/" + dropboxConfigHostFile));
      }
      
      // try{
        await loadInputsDropbox({folder: dropboxConfigDefaultFolder, file: defaultInputsConfigFile});
        await loadInputsDropbox({folder: dropboxConfigHostFolder, file: hostInputsConfigFile});
      // }
      // catch(err){
      // }

      let defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
      let tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

      configuration = tempConfig;
      configuration.twitterUsers = _.uniq(configuration.twitterUsers);  // merge concats arrays!

      resolve();

    }
    catch(err){
      reject(err);
    }
  });
}

function connectDb(){

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "CONNECTING MONGO DB";

      wordAssoDb.connect("TFE_" + process.pid, async function(err, db){

        if (err) {
          console.log(chalkError("TFE | *** MONGO DB CONNECTION ERROR: " + err));
          statsObj.status = "MONGO CONNECTION ERROR";
          slackSendMessage(hostname + " | TFE | " + statsObj.status);
          dbConnectionReady = false;
          quit(statsObj.status);
          return reject(err);
        }

        db.on("error", async function(){
          statsObj.status = "MONGO ERROR";
          console.error.bind(console, "TFE | *** MONGO DB CONNECTION ERROR ***\n");
          console.log(chalkError("TFE | *** MONGO DB CONNECTION ERROR ***\n"));
          slackSendMessage(hostname + " | TFE | " + statsObj.status);
          db.close();
          dbConnectionReady = false;
          quit(statsObj.status);
        });

        db.on("disconnected", async function(){
          statsObj.status = "MONGO DISCONNECTED";
          console.error.bind(console, "TFE | *** MONGO DB DISCONNECTED ***\n");
          slackSendMessage(hostname + " | TFE | " + statsObj.status);
          console.log(chalkAlert("TFE | *** MONGO DB DISCONNECTED ***\n"));
          dbConnectionReady = false;
          quit(statsObj.status);
        });


        global.dbConnection = db;

        console.log(chalk.green("TFE | MONGOOSE DEFAULT CONNECTION OPEN"));


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

        // UserServerController = require("../userServerController/index.js");
        UserServerController = require("@threeceelabs/user-server-controller");
        userServerController = new UserServerController("TFE_USC");

        // TweetServerController = require("../../../../tweetServerController/index.js");
        TweetServerController = require("@threeceelabs/tweet-server-controller");
        tweetServerController = new TweetServerController("TFE_TSC");

        tweetServerController.on("ready", function(err){
          tweetServerControllerReady = true;
          console.log(chalk.green("TFE | TSC READY"));
        });

        tweetServerController.on("error", function(err){
          tweetServerControllerReady = false;
          console.trace(chalkError("TFE | *** TSC ERROR | " + err));
        });

        userServerControllerReady = false;
        userServerController.on("ready", function(appname){

          statsObj.status = "MONGO DB CONNECTED";
          slackSendMessage(hostname + " | TFE | " + statsObj.status);

          userServerControllerReady = true;
          console.log(chalkLog("TFE | USC READY | " + appname));
          dbConnectionReady = true;

          resolve(db);

        });
      });
    }
    catch(err){
      console.log(chalkError("TFE | *** MONGO DB CONNECT ERROR: " + err));
      reject(err);
    }
  });
}

function loadInputsDropbox(params) {

  statsObj.status = "LOAD INPUTS CONFIG";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkNetwork("TFE | ... LOADING DROPBOX INPUTS CONFIG | " + folder + "/" + file));

    let options = {path: folder};

    try {

      const inputsConfigObj = await loadFile({folder: folder, file: file});

      if ((inputsConfigObj === undefined) || !inputsConfigObj) {
        console.log(chalkError("TFE | DROPBOX LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX LOAD INPUTS CONFIG FILE ERROR | JSON UNDEFINED"));
      }

      const tempInputsIdSet = new Set(inputsConfigObj.INPUTS_IDS);

      for (let inputsId of tempInputsIdSet) {
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

function loadMaxInputDropbox(params) {

  statsObj.status = "LOAD MAX INPUT";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkNetwork("TFE | ... LOADING DROPBOX MAX INPUT HASHMAP | " + folder + "/" + file));

    let options = {path: folder};

    try {

      const maxInputHashMapObj = await loadFile({folder: folder, file: file});

      if ((maxInputHashMapObj === undefined) || !maxInputHashMapObj) {
        console.log(chalkError("TFE | DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX MAX INPUT HASHMAP FILE ERROR | JSON UNDEFINED"));
      }

      maxInputHashMap = {};
      maxInputHashMap = deepcopy(maxInputHashMapObj.maxInputHashMap);

      console.log(chalkBlue("TFE | LOADED DROPBOX MAX INPUT HASHMAP"
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

function updateDbNetwork(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "UPDATE DB NETWORKS";

    const networkObj = params.networkObj;
    const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;
    const testHistoryItem = (params.testHistoryItem !== undefined) ? params.testHistoryItem : false;
    const addToTestHistory = (params.addToTestHistory !== undefined) ? params.addToTestHistory : true;
    const verbose = params.verbose || false;

    const query = { networkId: networkObj.networkId };

    let update = {};

    update["$setOnInsert"] = { 
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

    update["$set"] = { 
      matchRate: networkObj.matchRate, 
      overallMatchRate: networkObj.overallMatchRate,
    };

    if (incrementTestCycles) { update["$inc"] = { testCycles: 1 }; }
    
    if (testHistoryItem) { 
      update["$push"] = { testCycleHistory: testHistoryItem };
    }
    else if (addToTestHistory) {
      update["$addToSet"] = { testCycleHistory: { $each: networkObj.testCycleHistory } };
    }

    const options = {
      new: true,
      upsert: true,
      setDefaultsOnInsert: true,
    };

    global.NeuralNetwork.findOneAndUpdate(query, update, options, function(err, nnDbUpdated){

      if (err) {
        console.log(chalkError("TFE| *** updateDbNetwork | NETWORK FIND ONE ERROR: " + err));
        return reject(err);
      }

      if (verbose) { printNetworkObj("TFE | +++ NN DB UPDATED", nnDbUpdated); }

      resolve(nnDbUpdated);

    });

  });

}

// function processBestNetwork(params){

//   return new Promise(async function(resolve, reject){

//     statsObj.status = "PROCESS BEST NN";

//     try {

//       let networkObj = await updateDbNetwork({networkObj: params.networkObj, addToTestHistory: true});

//       let folder = params.folder || bestNetworkFolder;
   
//       bestNetworkHashMap.set(networkObj.networkId, networkObj);

//       saveFileQueue.push({folder: folder, file: entry.name, obj: networkObj });

//       if (!currentBestNetwork.isValid || (networkObj.overallMatchRate > currentBestNetwork.overallMatchRate)) {

//         currentBestNetwork = networkObj;
//         currentBestNetwork.isValid = true;

//         prevBestNetworkId = bestRuntimeNetworkId;
//         bestRuntimeNetworkId = networkObj.networkId;

//         statsObj.newBestNetwork = true;

//         updateBestNetworkStats(networkObj);

//         if (hostname === "google") {

//           const fileObj = {
//             networkId: bestRuntimeNetworkId,
//             successRate: networkObj.successRate,
//             matchRate:  networkObj.matchRate,
//             overallMatchRate:  networkObj.overallMatchRate,
//             testCycles:  networkObj.testCycles,
//             testCycleHistory:  networkObj.testCycleHistory
//           };

//           saveCache.set(
//             bestRuntimeNetworkFileName,
//             {folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj }
//           );
//         }

//         resolve();
//       }
//       else {
//         resolve();
//       }
//     }
//     catch(err){
//       console.log(chalkError("TFE | *** processBestNetwork *** SAVE DB ERROR: " + err));
//       reject(err);
//     }

//   });

// }

function loadBestNetworksDatabase(paramsIn) {
  return new Promise(function(resolve, reject){

  	let params = (paramsIn === undefined) ? {} : paramsIn;

    console.log(chalkLog("TFE | LOAD BEST NETWORKS DATABASE"));

    statsObj.status = "LOAD BEST NNs DATABASE";
    
    statsObj.newBestNetwork = false;
    statsObj.numNetworksLoaded = 0;

    console.log(chalkLog("TFE | LOADING NNs FROM DB ..."));

    const inputsIdArray = [...inputsIdSet];

    if (configuration.verbose) { console.log(chalkLog("inputsIdArray\n" + jsonPrint(inputsIdArray))); }

    let query = {};
    query.inputsId = { "$in": inputsIdArray };

    let limit = params.limit || configuration.networkDatabaseLoadLimit;

    if (configuration.verbose) { console.log(chalkLog("query\n" + jsonPrint(query))); }

    global.NeuralNetwork.find(query).lean().sort({"overallMatchRate": -1}).limit(limit).exec(function(err, nnArray){

      if (err){
        console.log(chalkError("TFE | *** NEURAL NETWORK FIND ERROR: " + err));
        return reject(err);
      }

      if (nnArray === 0){
        console.log(chalkError("TFE | *** NEURAL NETWORKS NOT FOUND IN DB NOR DROPBOX"));
        return reject(new Error("NO NETWORKS FOUND IN DATABASE"));
      }

      console.log(chalkBlue("TFE | FOUND " + nnArray.length + " NNs IN INPUTS IDS ARRAY"));

      currentBestNetwork = nnArray[0];
      currentBestNetwork.isValid = true;

      currentBestNetwork = networkDefaults(currentBestNetwork);
      bestRuntimeNetworkId = currentBestNetwork.networkId;

      bestNetworkHashMap.set(bestRuntimeNetworkId, currentBestNetwork);

      console.log(chalk.bold.blue("TFE | +++ BEST NEURAL NETWORK LOADED FROM DB"
        + " | " + currentBestNetwork.networkId
        + " | INPUTS ID: " + currentBestNetwork.inputsId
        + " | INPUTS: " + currentBestNetwork.numInputs
        + " | SR: " + currentBestNetwork.successRate.toFixed(2) + "%"
        + " | MR: " + currentBestNetwork.matchRate.toFixed(2) + "%"
        + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2) + "%"
        + " | TEST CYCs: " + currentBestNetwork.testCycles
        + " | HISTORY: " + currentBestNetwork.testCycleHistory.length
      ));

      async.eachSeries(nnArray, function(networkObj, cb){

        bestNetworkHashMap.set(networkObj.networkId, networkObj);
        cb();

      }, function(err){
        if (err) {
          return reject(err);
        }
        resolve(currentBestNetwork);
      });
    });
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
          console.log(chalkAlert("TFE | FILE LOAD RETRY"
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
      console.log(chalkAlert("TFE | resolve FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
      return resolve(false);
    }
    console.log(chalkError("TFE | reject FILE LOAD FAILED | RETRY: " + retryNumber + " OF " + maxRetries));
    reject(new Error("FILE LOAD ERROR | RETRIES " + maxRetries));

  });
}

function loadBestNetworksDropbox(params) {

  console.log(chalkLog("TFE | LOAD BEST NETWORKS DROPBOX"));

  statsObj.status = "LOAD BEST NNs DROPBOX";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;

    console.log(chalkNetwork("TFE | LOADING DROPBOX BEST NETWORKS | " + folder));

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

        // if (bestNetworkHashMap.has(networkId)){
        //   console.log(chalkLog("TFE | LOAD BEST NETWORK HASHMAP HIT ... SKIP | " + networkId));
        //   return;
        // }

        try {

          const entryNameArray = entry.name.split(".");
          const networkId = entryNameArray[0];

          const networkObj = await loadFileRetry({folder: folder, file: entry.name});

          if (!networkObj || networkObj=== undefined) {
            return reject(err);
          }

          if (!inputsIdSet.has(networkObj.inputsId)){
            console.log(chalkLog("TFE | LOAD BEST NETWORK HASHMAP INPUTS ID MISS ... SKIP HM ADD"
              + " | IN: " + networkObj.numInputs
              + " | " + networkId 
              + " | INPUTS ID: " + networkObj.inputsId 
            ));

            if (configuration.archiveNetworkOnInputsMiss) {

              const archivePath = folder + "/archive/" + entry.name;

              console.log(chalkLog("TFE | ARCHIVE NETWORK ON INPUTS ID MISS"
                + " | IN: " + networkObj.numInputs
                + " | " + networkId 
                + " | INPUTS ID: " + networkObj.inputsId 
                + "\nTFE | FROM: " + entry.path_display
                + " | TO: " + archivePath
              ));


              dropboxClient.filesMove({ from_path: entry.path_display, to_path: archivePath, autorename: false })
              .then(function(){
                return;
              })
              .catch(function(err){
                console.log(chalkError("TFE | *** DROPBOX FILE MOVE ERROR: " + err));
                return;
              });

            }
          }
          else if (!bestNetworkHashMap.has(networkId)){

            bestNetworkHashMap.set(networkObj.networkId, networkObj);

            console.log(chalkInfo("TFE | +++ DROPBOX NETWORK"
              + " [" + bestNetworkHashMap.size + " NNs IN HM]"
              + " | LAST MOD: " + moment(new Date(entry.client_modified)).format(compactDateTimeFormat)
              + " | " + networkId
              + " | INPUTS ID: " + networkObj.inputsId 
              + " | IN: " + networkObj.numInputs
            ));

          }

          try {
            const updateDbNetworkParams = {
              networkObj: networkObj,
              incrementTestCycles: false,
              addToTestHistory: false,
              verbose: true
            };
            const nnDbUpdated = await updateDbNetwork(updateDbNetworkParams);
          }
          catch(err){
            console.log(chalkError("TFE | *** LOAD DROPBOX NETWORK / NN DB UPDATE ERROR: " + err));
            return(err);
          }

          return;

        }
        catch(err){
          console.log(chalkError("TFE | *** LOAD DROPBOX NETWORK ERROR: " + err));
          return (err);
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

function loadBestNeuralNetworks() {

  statsObj.status = "LOAD BEST NN";

  // slackSendMessage(statsObj.status);

  return new Promise(async function(resolve, reject){

    console.log(chalkLog("TFE | ... LOADING NEURAL NETWORKS"
      + " | FOLDER: " + bestNetworkFolder
      + " | TIMEOUT: " + DEFAULT_DROPBOX_TIMEOUT + " MS"
    ));

    try {
      await loadBestNetworksDropbox({folder: bestNetworkFolder});
      const bestNetworkObj = await loadBestNetworksDatabase();
      printNetworkObj("TFE | LOADED BEST NN", bestNetworkObj);
      resolve();
    }
    catch(err){
      console.log(chalkError("TFE | *** LOAD BEST NETWORKS DATABASE ERROR: " + err));
      return reject(err);
    }

  });
}

const runEnableArgs = {};
runEnableArgs.userServerControllerReady = userServerControllerReady;
runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;

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
  runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;

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

function updateUserCategoryStats(user, callback) {

  statsObj.status = "UPDATE USER CAT STATS";

  // slackSendMessage(statsObj.status);

  return new Promise(function() {

    let catObj = {};

    catObj.manual = false;
    catObj.auto = false;

    async.parallel({
      category: function(cb) {
        if (user.category) {
          switch (user.category) {
            case "right":
              statsObj.categorized.manual.right += 1;
            break;
            case "left":
              statsObj.categorized.manual.left += 1;
            break;
            case "neutral":
              statsObj.categorized.manual.neutral += 1;
            break;
            case "positive":
              statsObj.categorized.manual.positive += 1;
            break;
            case "negative":
              statsObj.categorized.manual.negative += 1;
            break;
            case "none":
              statsObj.categorized.manual.none += 1;
            break;
            default:
              user.category = false;
              statsObj.categorized.manual.other += 1;
          }
          cb();
        }
        else {
          cb();
        }
      },
      categoryAuto: function(cb) {
        if (user.categoryAuto) {
          switch (user.categoryAuto) {
            case "right":
              statsObj.categorized.auto.right += 1;
            break;
            case "left":
              statsObj.categorized.auto.left += 1;
            break;
            case "neutral":
              statsObj.categorized.auto.neutral += 1;
            break;
            case "positive":
              statsObj.categorized.auto.positive += 1;
            break;
            case "negative":
              statsObj.categorized.auto.negative += 1;
            break;
            case "none":
              statsObj.categorized.auto.none += 1;
            break;
            default:
              user.categoryAuto = false;
              statsObj.categorized.auto.other += 1;
          }
          cb();
        }
        else {
          cb();
        }
      }
    }, function() {
      statsObj.categorized.totalManual = 0;
      statsObj.categorized.totalManual += statsObj.categorized.manual.left;
      statsObj.categorized.totalManual += statsObj.categorized.manual.right;
      statsObj.categorized.totalManual += statsObj.categorized.manual.neutral;
      statsObj.categorized.totalManual += statsObj.categorized.manual.positive;
      statsObj.categorized.totalManual += statsObj.categorized.manual.negative;
      statsObj.categorized.totalAuto = 0;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.left;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.right;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.neutral;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.positive;
      statsObj.categorized.totalAuto += statsObj.categorized.auto.negative;
      statsObj.categorized.total = statsObj.categorized.totalManual + statsObj.categorized.totalAuto;
      callback(null, user);
    });
  });
}

function enableAnalysis(user, languageAnalysis) {
  if (!configuration.enableLanguageAnalysis) { return false; }
  if (configuration.forceLanguageAnalysis) {
    debug(chalkAlert("enableAnalysis: configuration.forceLanguageAnalysis: "
      + configuration.forceLanguageAnalysis
    ));
    return true;
  }
  if (!user.languageAnalyzed) {
    debug(chalkAlert("enableAnalysis: user.languageAnalyzed: "
      + user.languageAnalyzed
    ));
    return true;
  }
  if (user.languageAnalysis.error !== undefined) {
    if ((user.languageAnalysis.error.code === 3)
      || (user.languageAnalysis.error.code === 8)) {
      debug(chalkAlert("enableAnalysis: user.languageAnalysis.error: "
        + user.languageAnalysis.error.code
      ));
      return true;
    }
  }
  if (user.languageAnalyzed && (languageAnalysis.magnitude === 0) && (languageAnalysis.score === 0)) {
    debug(chalkAlert("enableAnalysis: user.languageAnalyzed: "
      + user.languageAnalyzed
    ));
    return true;
  }
  return false;
}

function startImageQuotaTimeout() {
  setTimeout(function() {
    enableImageAnalysis = true;
    console.log(chalkLog("TFE | RE-ENABLE IMAGE ANALYSIS"));
  }, IMAGE_QUOTA_TIMEOUT);
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

    updateUserHistograms({user: user})
    .then(function(updatedUser){
      activateNetworkQueue.push({user: updatedUser, normalization: statsObj.normalization});
      callback(null, updatedUser);
    })
    .catch(function(err){
      console.log(chalkError("TFE | *** USER CATEGORIZE ERROR: " + err));
      console.error(err);
      callback(err, user);
    });
}

function checkUserProfileChanged(params) {

  let user = params.user;

  let results = [];

  if (user.name && (user.name !== undefined) && (user.name !== user.previousName)) { results.push("name"); }
  if (user.screenName && (user.screenName !== undefined) && (user.screenName !== user.previousScreenName)) { results.push("screenName"); }
  if (user.description && (user.description !== undefined) && (user.description !== user.previousDescription)) { results.push("description"); }
  if (user.location && (user.location !== undefined) && (user.location !== user.previousLocation)) { results.push("location"); }
  if (user.url && (user.url !== undefined) && (user.url !== user.previousUrl)) { results.push("url"); }
  if (user.expandedUrl && (user.expandedUrl !== undefined) && (user.expandedUrl !== user.previousExpandedUrl)) { results.push("expandedUrl"); }
  if (user.profileUrl && (user.profileUrl !== undefined) && (user.profileUrl !== user.previousProfileUrl)) { results.push("profileUrl"); }
  if (user.bannerImageUrl && (user.bannerImageUrl !== undefined) && (user.bannerImageUrl !== user.previousBannerImageUrl)) { results.push("bannerImageUrl"); }

  if (results.length === 0) { return; }
  return results;    
}

function checkUserStatusChanged(params) {

  let user = params.user;

  let results = [];

  if (user.statusId !== user.previousStatusId) { results.push("statusId"); }
  if (user.quotedStatusId !== user.previousQuotedStatusId) { results.push("quotedStatusId"); }

  if (results.length === 0) { return; }
  return results;    
}

function parseText(params){

  return new Promise(function(resolve, reject) {

    params.updateGlobalHistograms = (params.updateGlobalHistograms !== undefined) ? params.updateGlobalHistograms : false;
    params.category = (params.user && params.user.category) ? params.user.category : "none";
    params.minWordLength = params.minWordLength || DEFAULT_WORD_MIN_LENGTH;

    twitterTextParser.parseText(params)
    .then(function(hist){
      resolve(hist);
    })
    .catch(function(err){
      console.log(chalkError("*** TWITTER TEXT PARSER ERROR: " + err));
      console.error(err);
      reject(err);
    });

  });
}

function parseImage(params){

  return new Promise(function(resolve, reject) {

    params.updateGlobalHistograms = (params.updateGlobalHistograms !== undefined) ? params.updateGlobalHistograms : false;
    params.category = params.user.category || "none";
    params.imageUrl = params.user.bannerImageUrl;
    params.histograms = params.user.histograms;
    params.screenName = params.user.screenName;

    twitterImageParser.parseImage(params)
    .then(function(hist){
      resolve(hist);
    })
    .catch(function(err){
      console.log(chalkError("*** TWITTER IMAGE PARSER ERROR: " + err));
      console.error(err);
      reject(err);
    });

  });
}

function userProfileChangeHistogram(params) {

  let text = "";
  let urlsHistogram = {};
  urlsHistogram.urls = {};
  let profileUrl = false;
  let bannerImageUrl = false;

  let profileHistograms = {};

  return new Promise(function(resolve, reject){

    let user = params.user;
  
    const userProfileChanges = checkUserProfileChanged(params);

    if (!userProfileChanges) {
      return resolve();
    }

    async.each(userProfileChanges, function(userProp, cb){

      const prevUserProp = "previous" + _.upperFirst(userProp);

      user[prevUserProp] = (!user[prevUserProp] || (user[prevUserProp] === undefined)) ? {} : user[prevUserProp];

      switch (userProp) {
        case "name":
        case "location":
        case "description":
          text += user[userProp] + "\n";
        break;
        case "screenName":
          text += "@" + user[userProp] + "\n";
        break;
        case "expandedUrl":
          urlsHistogram.urls[user[userProp]] = (urlsHistogram.urls[user[userProp]] === undefined) ? 1 : urlsHistogram.urls[user[userProp]] + 1;
          console.log(chalkLog("TFE | XPNDED URL CHANGE | " + userProp + ": " + user[userProp] + " = " + urlsHistogram.urls[user[userProp]]));
        break;
        case "url":
          urlsHistogram.urls[user[userProp]] = (urlsHistogram.urls[user[userProp]] === undefined) ? 1 : urlsHistogram.urls[user[userProp]] + 1;
          console.log(chalkLog("TFE | URL CHANGE | " + userProp + ": " + user[userProp] + " = " + urlsHistogram.urls[user[userProp]]));
        break;
        case "profileUrl":
          // profileUrl = user[userProp];
          urlsHistogram.urls[user[userProp]] = (urlsHistogram.urls[user[userProp]] === undefined) ? 1 : urlsHistogram.urls[user[userProp]] + 1;
          console.log(chalkLog("TFE | URL CHANGE | " + userProp + ": " + user[userProp] + " = " + urlsHistogram.urls[user[userProp]]));
        break;
        case "bannerImageUrl":
          bannerImageUrl = user[userProp];
        break;
        default:
          console.log(chalkError("TFE | UNKNOWN USER PROPERTY: " + userProp));
          return cb(new Error("UNKNOWN USER PROPERTY: " + userProp));
      }

      cb();

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
              histograms: user.histograms,
              updateGlobalHistograms: true
            })
            .then(function(imageParseResults){
              console.log(chalkLog("TFE | IMAGE PARSE imageParseResults\n" + jsonPrint(imageParseResults)));
              cb(null, imageParseResults);
            })
            .catch(function(err){
              cb(err, null);
            });

          }
          else {
            cb(null, null);
          }


        }, 

        textHist: function(cb){

          if (text && (text !== undefined)){

            parseText({ category: user.category, text: text, updateGlobalHistograms: true })
            .then(function(textParseResults){

              if (Object.keys(urlsHistogram.urls).length > 0) {

                mergeHistograms.merge({ histogramA: textParseResults, histogramB: urlsHistogram })
                .then(function(textMergeResults){

                  cb(null, textMergeResults);
                })
                .catch(function(err){
                  cb(err, null);
                });

              }
              else {
                cb(null, textParseResults);
              }

            })
            .catch(function(err){
              cb(err, null);
            });
          }
          else {
            console.log(chalkLog("TFE | URLS urlsHistogram\n" + jsonPrint(urlsHistogram)));
            cb(null, urlsHistogram);
          }
        }

      }, function(err, results){

        mergeHistograms.merge({ histogramA: results.textHist, histogramB: results.imageHist})
        .then(function(histogramsMerged){
          resolve(histogramsMerged);
        })
        .catch(function(err){
          console.log(chalkError("TFE | USER PROFILE CHANGE HISTOGRAM ERROR: " + err));
          return reject(err);
        });
      });

    });

  });
}

function userStatusChangeHistogram(params) {

  return new Promise(function(resolve, reject){

    let user = params.user;
  
    const userStatusChangeArray = checkUserStatusChanged(params);

    if (!userStatusChangeArray) {
      return resolve();
    }

    let tweetHistograms = {};
    let text = "";

    async.each(userStatusChangeArray, function(userProp, cb){

      const prevUserProp = "previous" + _.upperFirst(userProp);

      console.log(chalkLog("TFE | +++ USER STATUS CHANGE"
        + " | @" + user.screenName 
        + " | " + userProp 
        + " | " + user[userProp] + " <-- " + user[prevUserProp]
      ));

      let tscParams = {
        globalTestMode: configuration.globalTestMode,
        testMode: configuration.testMode,
        inc: false,
        twitterEvents: configEvents
      };

      if (userProp === "statusId"){
        tscParams.tweetStatus = user.status;
        tscParams.tweetStatus.user = {};
        tscParams.tweetStatus.user = user.toObject();
        tscParams.tweetStatus.user.isNotRaw = true;
      }

      if (userProp === "quotedStatusId"){
        tscParams.tweetStatus = user.quotedStatus;
        tscParams.tweetStatus.user = {};
        tscParams.tweetStatus.user = user.toObject();
        tscParams.tweetStatus.user.isNotRaw = true;
      }

      // console.log("TFE user\n" + jsonPrint(user.toObject()));
      // console.log("TFE tscParams.tweetStatus\n" + jsonPrint(tscParams.tweetStatus));

      tweetServerController.createStreamTweet(tscParams)
      .then(function(tweetObj){

        // console.log(chalkLog("TFE | CREATE STREAM TWEET | " + Object.keys(tweetObj)));

        async.each(DEFAULT_INPUT_TYPES, function(entityType, cb0){

          if (!entityType || entityType === undefined) {
            console.log(chalkAlert("TFE | ??? UNDEFINED TWEET entityType: ", entityType));
            return cb0();
          }

          if (entityType === "user") { return cb0(); }
          if (!tweetObj[entityType] || tweetObj[entityType] === undefined) { return cb0(); }
          if (tweetObj[entityType].length === 0) { return cb0(); }

          async.each(tweetObj[entityType], function(entityObj, cb1){

            if (!entityObj) {
              console.log(chalkInfo("TFE | !!! NULL entity? | ENTITY TYPE: " + entityType + " | entityObj: " + entityObj));
              // console.log(chalkAlert("DBU | !!! NULL entity? | ENTITY TYPE: " + entityType + "\nentityObj\n" + jsonPrint(entityObj)));
              // console.log(chalkAlert("DBU | !!! NULL entity?\n" + jsonPrint(tweetObj)));
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
                entity = (entityObj.expandedUrl && entityObj.expandedUrl !== undefined) ? entityObj.expandedUrl.toLowerCase() : entityObj.nodeId;
              break;
              case "words":
                entity = entityObj.nodeId.toLowerCase();
              break;
              case "places":
                entity = entityObj.nodeId;
              break;
            }

            if (!tweetHistograms[entityType] || (tweetHistograms[entityType] === undefined)){
              tweetHistograms[entityType] = {};
              tweetHistograms[entityType][entity] = 1;
            }

            if (!tweetHistograms[entityType][entity] || (tweetHistograms[entityType][entity] === undefined)){
              tweetHistograms[entityType][entity] = 1;
            }

            // if (configuration.verbose) {
              console.log(chalkLog("TFE | +++ USER HIST"
                + " | " + entityType.toUpperCase()
                + " | " + entity
                + " | " + tweetHistograms[entityType][entity]
              ));
            // }

            cb1();

          }, function(){

            cb0();
          });
        }, function(err0){
          cb();
        });

      })
      .catch(function(err){
        return cb(err);
      });

    }, function(err){

      if (err) {
        console.log(chalkError("TFE | USER STATUS HISTOGRAM ERROR: " + err));
        return reject(err);
      }

      resolve(tweetHistograms);
 
    });

  });
}

function updateUserHistograms(params) {

  return new Promise(function(resolve, reject){
    
    if ((params.user === undefined) || !params.user) {
      console.log(chalkError("TFE | *** updateUserHistograms USER UNDEFINED"));
      const err = new Error("TFE | *** updateUserHistograms USER UNDEFINED");
      console.error(err);
      reject(err);
    }

    userStatusChangeHistogram(params)

      .then(function(tweetHistogramChanges){

        userProfileChangeHistogram(params)
        .then(function(profileHistogramChanges){

          async.parallel({

            profileHist: function(cb){

              if (profileHistogramChanges) {

                mergeHistograms.merge({ histogramA: params.user.profileHistograms, histogramB: profileHistogramChanges })
                .then(function(profileHist){
                  cb(null, profileHist);
                })
                .catch(function(err){
                  console.log(chalkError("TFE | *** MERGE HISTOGRAMS ERROR | PROFILE: " + err));
                  return cb(err, null);
                });

              }
              else {
                cb(null, null);
              }

            },

            tweetHist: function(cb){

              if (tweetHistogramChanges) {

                mergeHistograms.merge({ histogramA: params.user.tweetHistograms, histogramB: tweetHistogramChanges })
                .then(function(tweetHist){
                  cb(null, tweetHist);
                })
                .catch(function(err){
                  console.log(chalkError("TFE | *** MERGE HISTOGRAMS ERROR | TWEET: " + err));
                  return cb(err, null);
                });

              }
              else {
                cb(null, null);
              }
            }

          }, function(err, results){
            if (err) {
              return reject(err);
            }

            params.user.profileHistograms = results.profileHist;
            params.user.tweetHistograms = results.tweetHist;

            updateGlobalHistograms(params)
            .then(function(){
              resolve(params.user);
            })
            .catch(function(err){
              console.log(chalkError("TFE | *** UPDATE USER HISTOGRAM ERROR: " + err));
              return reject(err);
            });

          });

        });

      })
      .catch(function(err){
        console.log(chalkError("TFE | *** UPDATE USER HISTOGRAM ERROR: " + err));
        return reject(err);
      });
  });
}

function processUser(params) {

  return new Promise(function(resolve, reject){

    statsObj.status = "PROCESS USER";

    let userIn = params.user;
    let threeceeUser = params.threeceeUser;

    debug(chalkInfo("PROCESS USER\n" + jsonPrint(userIn)));

    if (userServerController === undefined) {
      console.log(chalkError("TFE | *** processUser userServerController UNDEFINED"));
      return reject(new Error("processUser userServerController UNDEFINED"));
    }

    async.waterfall(
    [
      function findUserInDb(cb) {

        global.User.findOne({ nodeId: userIn.id_str }).exec(function(err, user) {

          if (err) {
            console.log(chalkError("TFE | *** ERROR DB FIND ONE USER | " + err));
            return cb(err, user) ;
          }

          if (!user) {

            userIn.modified = moment();
            userIn.following = true;
            userIn.threeceeFollowing = threeceeUser;

            console.log(chalkLog("TFE | USER DB MISS"
              + " | 3C @" + threeceeUser
              + " | " + userIn.id_str
              + " | @" + userIn.screen_name
            ));

            userServerController.convertRawUser({user:userIn}, function(err, user) {

              if (err) {

                console.log(chalkError("TFE | *** CONVERT USER ERROR"
                  + " | " + err
                ));

                cb(err, null);

              }
              else {

                if ((user.status !== undefined) && user.status) { 
                  user.lastSeen = user.status.created_at;
                  user.updateLastSeen = true;
                }

                cb(null, user);

              }
            });
          }
          else {

            if ((typeof user.threeceeFollowing === "object") || (typeof user.threeceeFollowing === "boolean")) {
              console.log(chalkAlert("TFE | >>> CONVERT TO STRING | USER @" + user.screenName
                + " | threeceeFollowing TYPE: " + typeof user.threeceeFollowing
                + " | threeceeFollowing: " + user.threeceeFollowing
              ));

              let newUser = new global.User(user);

              newUser.threeceeFollowing = threeceeUser;

              user = new global.User(newUser);

              console.log(chalkAlert("TFE | ... CONVERTED STRING | USER @" + user.screenName
                + " | threeceeFollowing TYPE: " + typeof user.threeceeFollowing
                + " | threeceeFollowing: " + user.threeceeFollowing
              ));
            }
            else {
              user.following = true;
              user.threeceeFollowing = threeceeUser;
            }

            // previousScreenName: { type: String, default: "" },
            // previousName: { type: String, default: "" },
            // previousDescription: { type: String, default: "" },
            // previousLocation: { type: String, default: "" },
            // previousUrl: { type: String, default: "" },  
            // previousProfileUrl: { type: String, default: "" },  
            // previousBannerImageUrl: { type: String, default: "" },  // is like previousBannerImageUrl

            if ((user.status !== undefined) && userIn.status) { 
              user.lastSeen = userIn.status.created_at;
              user.updateLastSeen = true;
            }

            let catObj = {};

            catObj.manual = user.category || false;
            catObj.auto = user.categoryAuto || false;

            if (userIn.screen_name && (userIn.screen_name !== undefined) && (user.screenName !== userIn.screen_name)) {
              // user.previousScreenName = user.screenName;
              user.screenName = userIn.screen_name.toLowerCase();
              user.screenNameLower = userIn.screen_name.toLowerCase();
            }

            if (user.name !== userIn.name) {
              // user.previousName = user.name;
              user.name = userIn.name;
            }
            
            if (userIn.description && (userIn.description !== undefined) && (user.description !== userIn.description)) {
              // user.previousDescription = user.description;
              user.description = userIn.description;
            }

            if (userIn.location && (userIn.location !== undefined) && (user.location !== userIn.location)) {
              // user.previousLocation = user.location;
              user.location = userIn.location;
            }

            // "entities": {
            //   "url": {
            //     "urls": [
            //       {
            //         "url": "https://t.co/BNg2SBMRu0",
            //         "expanded_url": "http://www.banquemondiale.org/",
            //         "display_url": "banquemondiale.org",
            //         "indices": [
            //           0,
            //           23
            //         ]
            //       }
            //     ]
            //   },
            //   "description": {
            //     "urls": []
            //   }
            // },

            userIn.url = _.get(userIn, "entities.url.urls[0].expanded_url", userIn.url);

            if (userIn.url && (userIn.url !== undefined) && (user.url !== userIn.url)) {
              user.url = userIn.url;
            }

            if (userIn.profile_url && (userIn.profile_url !== undefined) && (user.profileUrl !== userIn.profile_url)) {
              user.profileUrl = userIn.profile_url;
            }

            if (userIn.profile_banner_url && (userIn.profile_banner_url !== undefined) && (user.bannerImageUrl !== userIn.profile_banner_url)) {
              user.bannerImageAnalyzed = false;
              user.bannerImageUrl = userIn.profile_banner_url;
            }

            if (userIn.profile_image_url && (userIn.profile_image_url !== undefined) && (user.profileImageUrl !== userIn.profile_image_url)) {
              user.profileImageUrl = userIn.profile_image_url;
            }

            if (userIn.status && (userIn.status !== undefined) && (user.statusId !== userIn.status.id_str)) {
              user.statusId = userIn.status.id_str;
              user.status = userIn.status;
            }

            if (userIn.quoted_status_id_str && (userIn.quoted_status_id_str !== undefined) && (user.quotedStatusId !== userIn.quoted_status_id_str)) {
              user.quotedStatusId = userIn.quoted_status_id_str;
              user.quotedStatus = userIn.quoted_status;
            }

            if ((userIn.followers_count !== undefined) && (user.followersCount !== userIn.followers_count)) {
              user.followersCount = userIn.followers_count;
            }
            if ((userIn.friends_count !== undefined) && (user.friendsCount !== userIn.friends_count)) {
              user.friendsCount = userIn.friends_count;
            }
            if ((userIn.statuses_count !== undefined) && (user.statusesCount !== userIn.statuses_count)) {
              user.statusesCount = userIn.statuses_count;
            } 
            cb(null, user);
          }
        });
      },

      function updateFollowing(user, cb) {
        user.following = true;
        user.threeceeFollowing = threeceeUser;
        cb(null, user);
      },

      function genAutoCat(user, cb) {

        if (!neuralNetworkInitialized) { return cb(null, user); }

        generateAutoCategory(user, function (err, uObj) {
          cb(err, uObj);
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

function initChild(params){

  statsObj.status = "INIT CHILD | @" + params.threeceeUser;

  return new Promise(function(resolve, reject){

    const initObj = {
      op: "INIT",
      childId: tfeChildHashMap[params.threeceeUser].childId,
      threeceeUser: tfeChildHashMap[params.threeceeUser].threeceeUser,
      twitterConfig: tfeChildHashMap[params.threeceeUser].twitterConfig,
      fetchUserTimeout: configuration.fetchUserTimeout,
      verbose: configuration.verbose
    };

    tfeChildHashMap[params.threeceeUser].child.send(initObj, function(err) {
      if (err) {
        console.log(chalkError("TFE | *** CHILD SEND INIT ERROR"
          + " | @" + params.threeceeUser
          + " | ERR: " + err
        ));
        return reject(err);
      }
      resolve();
    });

  });
}

function disableChild(params, callback){

  return new Promise(function(resolve, reject){

    const mObj = {
      op: "DISABLE",
      verbose: configuration.verbose
    };

    tfeChildHashMap[params.threeceeUser].child.send(mObj, function(err) {
      if (err) {
        console.log(chalkError("TFE | *** CHILD SEND DISABLE ERROR"
          + " | @" + params.threeceeUser
          + " | ERR: " + err
        ));
        return reject(err);
      }
      resolve();
    });

  });
}

function checkChildrenState (checkState) {

  return new Promise(function(resolve, reject){

    let allCheckState = true;

    Object.keys(tfeChildHashMap).forEach(function(childId){

      const child = tfeChildHashMap[childId];

      if (child === undefined) { 
        console.error("CHILD UNDEFINED");
        return reject(new Error("CHILD UNDEFINED"));
      }

      const cs = ((child.status === "DISABLED") || (child.status === checkState));

      if (!cs && (checkState === "FETCH_END") 
        && ((child.status === "ERROR") || (child.status === "RESET") || (child.status === "IDLE"))){

        child.child.send({op: "FETCH_END", verbose: configuration.verbose}, function(err) {
          if (err) {
            slackSendRtmMessage("TFE | " + hostname + " | ERROR | CHILD SEND FETCH_END");
            console.log(chalkError("TFE | *** CHILD SEND FETCH_END ERROR"
              + " | @" + user
              + " | ERR: " + err
            ));
            return reject(err);
          }
        });
      }

      if (!cs) {
        allCheckState = false;
      } 

      if (configuration.verbose) {
        console.log("checkChildrenState"
          + " | CH ID: " + childId 
          + " | " + child.status 
          + " | CHCK STATE: " + checkState 
          + " | cs: " + cs
          + " | allCheckState: " + allCheckState
        );
      }

    });

    if (configuration.verbose) {
      console.log(chalkLog("TFE | MAIN: " + fsm.getMachineState()
        + " | ALL CHILDREN CHECKSTATE: " + checkState + " | " + allCheckState
      ));
    }

    resolve(allCheckState);

  });
}

function childSendAll(params, callback) {

  console.log(chalkLog("TFE | >>> CHILD SEND ALL | OP: " + params.op));

  async.each(Object.keys(tfeChildHashMap), function(threeceeUser, cb) {

    const curChild = tfeChildHashMap[threeceeUser].child;

    if (params.op === "INIT") {

      if (tfeChildHashMap[threeceeUser].status === "PAUSE_RATE_LIMIT") {
        console.log(chalkLog("TFE | SKIP CHILD INIT"
          + " | " + tfeChildHashMap[threeceeUser].childId
          + " | " + tfeChildHashMap[threeceeUser].status
        ));
        return cb();
      }

      const initObj = {
        op: params.op,
        childId: tfeChildHashMap[threeceeUser].childId,
        threeceeUser: tfeChildHashMap[threeceeUser].threeceeUser,
        twitterConfig: tfeChildHashMap[threeceeUser].twitterConfig,
        verbose: configuration.verbose
      };

      curChild.send(initObj, function(err) {
        if (err) {
          console.log(chalkError("TFE | *** CHILD SEND ALL INIT ERROR"
            + " | @" + threeceeUser
            + " | OP: " + params.op
            + " | ERR: " + err
          ));
        }
        cb(err);
      });

    }
    else {

      curChild.send(params, function(err) {
        if (err) {
          console.log(chalkError("TFE | *** CHILD SEND ALL ERROR"
            + " | @" + threeceeUser
            + " | OP: " + params.op
            + " | ERR: " + err
          ));
        }
        cb(err);
      });
    }

  }, function(err) {
    if (callback !== undefined) { callback(err); }
  });
}

function initRandomNetworks(params){

  statsObj.status = "INIT RAN NNs";

  return new Promise(async function(resolve, reject){

    loadedNetworksFlag = false;

    if (randomNetworkTree && (randomNetworkTree !== undefined)) {

      async.eachSeries(bestNetworkHashMap.values(), function(networkObj, cb){

        randomNetworkTree.send({ op: "LOAD_NETWORK", networkObj: networkObj }, function(err) {

          if (err) { return cb(err); }

          console.log(chalkBlue("TFE | SENT NN > RNT : " + networkObj.networkId));

          cb();

        });

      }, function(err){

        if (err) { 
          loadedNetworksFlag = false;
          reject(err);
        }

        randomNetworkTree.send({ op: "LOAD_NETWORK_DONE" });
        loadedNetworksFlag = true;
        resolve();

      });

    }
    else {
      console.log(chalkError("TFE | *** RNT NOT INITIALIZED *** "));
      reject(new Error("RNT NOT INITIALIZED"));
    }

  });
}

function initMaxInputHashMap(params){

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

function initNetworks(params){

  statsObj.status = "INIT NNs";

  console.log(chalkTwitter("TFE | INIT NETWORKS"));

  return new Promise(async function(resolve, reject){

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

function getGlobalHistograms(params){
  return new Promise(function(resolve, reject){
    twitterTextParser.getGlobalHistograms(function(hist) {
      resolve(hist);
    });
  });
}

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;

  fsmPreviousState = oldState;

  console.log(chalkLog("TFE | --------------------------------------------------------\n"
    + "TFE | << FSM >> MAIN"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\nTFE | --------------------------------------------------------"
  ));
}

const processUserQueueEmpty = function() {
  return (processUserQueue.length === 0);
};

const fetchAllReady = function(){

  if (configuration.verbose) {
    console.log(chalkLog("fetchAllReady"
      + " | fetchAllIntervalReady: " + fetchAllIntervalReady
      + " | loadedNetworksFlag: " + loadedNetworksFlag
      + " | processUserQueueReady: " + processUserQueueReady
      + " | processUserQueueEmpty: " + processUserQueueEmpty()
    ));
  }
  return (fetchAllIntervalReady && loadedNetworksFlag && processUserQueueReady && processUserQueueEmpty() );
};

let waitFileSaveInterval;
let loadMaxInputHasMapBusy = false;

const fsmStates = {

  "RESET":{

    onEnter: function(event, oldState, newState) {

      loadMaxInputHasMapBusy = false;
      reporter(event, oldState, newState);

      statsObj.status = "FSM READY";

      checkChildrenState("RESET").then(function(allChildrenReset){
        console.log(chalkTwitter("TFE | ALL CHILDREN RESET: " + allChildrenReset));
        if (!allChildrenReset && (event !== "fsm_tick")) { childSendAll({op: "RESET"}); }
      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN RESET ERROR: " + err));
        fsm.fsm_error();
      });

    },

    fsm_tick: function() {

      checkChildrenState("RESET").then(function(allChildrenReset){
        console.log("RESET TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN RESET: " + allChildrenReset
        );
        if (allChildrenReset) { fsm.fsm_resetEnd(); }
      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN RESET ERROR: " + err));
        fsm.fsm_error();
      });

    },

    "fsm_resetEnd": "IDLE"
  },

  "IDLE":{
    onEnter: function(event, oldState, newState) {

      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);
      }

      statsObj.status = "FSM IDLE";

      checkChildrenState("IDLE").then(function(allChildrenIdle){
        console.log(chalkTwitter("TFE | ALL CHILDREN IDLE: " + allChildrenIdle));
        if (!allChildrenIdle && (event !== "fsm_tick")) { childSendAll({op: "IDLE"}); }
      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN IDLE ERROR: " + err));
        fsm.fsm_error();
      });

    },

    fsm_tick: function() {

      checkChildrenState("IDLE").then(function(allChildrenIdle){
        debug("INIT TICK | ALL CHILDREN IDLE: " + allChildrenIdle );
        if (allChildrenIdle) { fsm.fsm_init(); }
      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN IDLE ERROR: " + err));
        fsm.fsm_error();
      });

    },

    "fsm_init": "INIT",
    "fsm_error": "ERROR"
  },

  "ERROR":{
    onEnter: function(event, oldState, newState) {
      reporter(event, oldState, newState);

      statsObj.status = "FSM ERROR";

      try { 
        slackSendMessage(hostname + " | TFE | " + statsObj.status);
      }
      catch(err){
        console.log(chalkError("TFE | *** SLACK INIT MESSAGE ERROR: " + err));
      }
      quit("FSM ERROR");
    }
  },

  "INIT":{
    onEnter: async function(event, oldState, newState) {
      if (event !== "fsm_tick") {

        reporter(event, oldState, newState);

        statsObj.status = "FSM INIT";

        let slackText = "\n*INIT*";
        slackText = slackText + " | " + hostname;
        slackText = slackText + "\nSTART: " + statsObj.startTimeMoment.format(compactDateTimeFormat);
        slackText = slackText + " | RUN: " + msToTime(statsObj.elapsed);

        initNetworks()
        .then(function(){

        })
        .catch(function(err){
          console.log(chalkError("TFE | *** ALL CHILDREN INIT ERROR: " + err));
          fsm.fsm_error();
        });

        checkChildrenState("INIT").then(function(allChildrenInit){
          debug("INIT TICK | ALL CHILDREN INIT: " + allChildrenInit );
          if (!allChildrenInit && (event !== "fsm_tick")) { childSendAll({op: "INIT"}); }
        })
        .catch(function(err){
          console.log(chalkError("TFE | *** ALL CHILDREN INIT ERROR: " + err));
          fsm.fsm_error();
        });
      }
    },
    fsm_tick: function() {

      checkChildrenState("INIT").then(function(allChildrenInit){

        debug("READY INIT"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN READY: " + allChildrenInit
        );

        if (!allChildrenInit) { childSendAll({op: "INIT"}); }
        if (allChildrenInit && processUserQueueReady && processUserQueueEmpty()) { fsm.fsm_ready(); }

      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN INIT ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_error": "ERROR",
    "fsm_ready": "READY",
    "fsm_reset": "RESET"
  },

  "READY":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM READY";

        checkChildrenState("READY").then(function(allChildrenReady){
          console.log("TFE | ALL CHILDREN READY: " + allChildrenReady);
          if (!allChildrenReady && (event !== "fsm_tick")) { childSendAll({op: "READY"}); }
        })
        .catch(function(err){
          console.log(chalkError("TFE | *** ALL CHILDREN READY ERROR: " + err));
          fsm.fsm_error();
        });

      }
    },
    fsm_tick: function() {

      checkChildrenState("READY").then(function(allChildrenReady){
        debug("READY TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN READY: " + allChildrenReady
        );
        if (!allChildrenReady) { childSendAll({op: "READY"}); }
        if (allChildrenReady && fetchAllReady()) { fsm.fsm_fetchAllStart(); }
      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN READY ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_fetchAllStart": "FETCH_ALL"
  },

  "FETCH_ALL":{
    onEnter: function(event, oldState, newState) {
      if (event !== "fsm_tick") {
        reporter(event, oldState, newState);

        statsObj.status = "FSM FETCH_ALL";
        slackSendMessage(hostname + " | TFE | " + statsObj.status);

        childSendAll({op: "FETCH_USER_START"});
        console.log("TFE | FETCH_ALL | onEnter | " + event);
      }
    },
    fsm_tick: function() {

      checkChildrenState("FETCH_END").then(function(allChildrenFetchEnd){
        debug("FETCH_END TICK"
          + " | Q READY: " + processUserQueueReady
          + " | Q EMPTY: " + processUserQueueEmpty()
          + " | ALL CHILDREN FETCH_END: " + allChildrenFetchEnd
        );

        statsObj.allChildrenFetchEnd = allChildrenFetchEnd;

        if ((randomNetworkTreeActivateQueueSize === 0)
          && activateNetworkQueueReady
          && (activateNetworkQueue.length === 0)
          && allChildrenFetchEnd 
          && processUserQueueReady 
          && processUserQueueEmpty()
          ) 
        { 
          fsm.fsm_fetchAllEnd(); 
        }

      })
      .catch(function(err){
        console.log(chalkError("TFE | *** ALL CHILDREN FETCH_END ERROR: " + err));
        fsm.fsm_error();
      });

    },
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_fetchAllEnd": "FETCH_END_ALL"
  },

  "FETCH_END_ALL":{

    onEnter: async function(event, oldState, newState) {

      if (event !== "fsm_tick") {

        statsObj.status = "END FETCH ALL";

        slackSendMessage(hostname + " | TFE | " + statsObj.status);

        reporter(event, oldState, newState);

        console.log(chalk.bold.blue("TFE | ===================================================="));
        console.log(chalk.bold.blue("TFE | ================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("TFE | ===================================================="));

        console.log(chalk.bold.blue("TFE | TOTAL USERS FETCHED:   " + statsObj.users.totalFriendsFetched));
        console.log(chalk.bold.blue("TFE | TOTAL USERS PROCESSED: " + statsObj.users.totalFriendsProcessed));

        console.log(chalk.bold.blue("\nTFE | ----------------------------------------------------"
          + "\nTFE | BEST NETWORK: " + statsObj.bestNetwork.networkId
          + "\nTFE |  INPUTS:      " + statsObj.bestNetwork.numInputs + " | " + statsObj.bestNetwork.inputsId
          + "\nTFE |  SR:          " + statsObj.bestNetwork.successRate.toFixed(3) + "%"
          + "\nTFE |  MR:          " + statsObj.bestNetwork.matchRate.toFixed(3) + "%"
          + "\nTFE |  OAMR:        " + statsObj.bestNetwork.overallMatchRate.toFixed(3) + "%"
          + "\nTFE |  TC:          " + statsObj.bestNetwork.testCycles
          + "\nTFE |  TCH:         " + statsObj.bestNetwork.testCycleHistory.length
        ));

        console.log(chalk.bold.blue("TFE | ===================================================="));
        console.log(chalk.bold.blue("TFE | ================= END FETCH ALL ===================="));
        console.log(chalk.bold.blue("TFE | ===================================================="));

        console.log(chalkLog("TFE | ... PAUSING FOR 10 SECONDS FOR RNT STAT UPDATE ..."));

        let histogramsSavedFlag = false;

        console.log(chalkLog("TFE | SAVING HISTOGRAMS | TYPES: " + Object.keys(globalHistograms)));

        async.forEach(DEFAULT_INPUT_TYPES, function(type, cb){

          if (!globalHistograms[type] || (globalHistograms[type] === undefined)){
            globalHistograms[type] = {};
          }

          let histObj = {};

          histObj.histogramsId = hostname + "_" + process.pid + "_" + getTimeStamp() + "_" + type ;
          histObj.meta = {};
          histObj.meta.timeStamp = moment().valueOf();
          histObj.meta.type = type;
          histObj.meta.numEntries = Object.keys(globalHistograms[type]).length;
          histObj.histograms = {};
          histObj.histograms[type] = globalHistograms[type];

          let folder;

          if (configuration.testMode) {
            folder = (hostname === "google") 
            ? defaultHistogramsFolder + "_test/types/" + type 
            : localHistogramsFolder + "_test/types/" + type;
          }
          else {
            folder = (hostname === "google") 
            ? defaultHistogramsFolder + "/types/" + type 
            : localHistogramsFolder + "/types/" + type;
          }

          const file = "histograms_" + type + ".json";
          const sizeInMBs = sizeof(globalHistograms[type])/ONE_MEGABYTE;

          console.log(chalk.bold.blue("TFE | ... SAVING HISTOGRAM"
            + " | TYPE: " + type
            + " | ID: " + histObj.histogramsId
            + " | ENTRIES: " + Object.keys(histObj.histograms[type]).length
            + " | SIZE: " + sizeInMBs.toFixed(3) + " MB"
            + " | PATH: " + folder + "/" + file
          ));

          if ((sizeof(globalHistograms[type]) > MAX_SAVE_DROPBOX_NORMAL) || configuration.testMode) {

            if (configuration.testMode) {
              if (hostname === "google") {
                folder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms_test/types/" + type;
              }
              else {
                folder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/histograms_test/types/" + type;
              }
            }
            else {
              if (hostname === "google") {
                folder = "/home/tc/Dropbox/Apps/wordAssociation/config/utility/default/histograms/types/" + type;
              }
              else {
                folder = "/Users/tc/Dropbox/Apps/wordAssociation/config/utility/" + hostname + "/histograms/types/" + type;
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

        loadedNetworksFlag = false;

        if (randomNetworkTree && (randomNetworkTree !== undefined)) {
          randomNetworkTree.send({op: "GET_STATS"});
        }

        let slackText = "\n*END FETCH ALL*";
        slackText = slackText + " | " + hostname;
        slackText = slackText + "\nSTART: " + statsObj.startTimeMoment.format(compactDateTimeFormat);
        slackText = slackText + " | RUN: " + msToTime(statsObj.elapsed);
        slackText = slackText + "\nTOT: " + statsObj.users.totalFriendsProcessed;
        slackText = slackText + " | GTOT: " + statsObj.users.grandTotalFriendsProcessed;
        slackText = slackText + "\nIN: " + statsObj.bestNetwork.numInputs;
        slackText = slackText + " | INPUTS ID: " + statsObj.bestNetwork.inputsId;
        slackText = slackText + "\nNN: " + statsObj.bestNetwork.networkId;
        slackText = slackText + "\nOAMR: " + statsObj.bestNetwork.overallMatchRate.toFixed(3);
        slackText = slackText + " | MR: " + statsObj.bestNetwork.matchRate.toFixed(3);
        slackText = slackText + " | SR: " + statsObj.bestNetwork.successRate.toFixed(3);
        slackText = slackText + " | TEST CYCs: " + statsObj.bestNetwork.testCycles;
        slackText = slackText + " | TC HISTORY: " + statsObj.bestNetwork.testCycleHistory.length;


        clearInterval(waitFileSaveInterval);

        statsObj.status = "WAIT UPDATE STATS";

        slackSendMessage(hostname + " | TFE | " + statsObj.status);

        waitFileSaveInterval = setInterval(async function() {

          if (saveFileQueue.length === 0) {

            console.log(chalk.bold.blue("TFE | ALL NNs SAVED ..."));

            if (randomNetworkTree && (randomNetworkTree !== undefined)) { 
              randomNetworkTree.send({op: "RESET_STATS"});
            }

            childSendAll({op: "RESET_TWITTER_USER_STATE"});

            try {

              clearInterval(waitFileSaveInterval);

              await resetAllTwitterUserState();
              await resetGlobalHistograms({inputTypes: DEFAULT_INPUT_TYPES});

              statsObj.users.totalFriendsCount = 0;
              statsObj.users.totalFriendsProcessed = 0;
              statsObj.users.totalFriendsFetched = 0;
              statsObj.users.totalPercentProcessed = 0;
              statsObj.users.totalPercentFetched = 0;
              statsObj.users.classifiedAuto = 0;
              statsObj.users.classified = 0;

              maxInputHashMap = {};

              console.log(chalk.bold.blue("TFE | BEST NN: " + statsObj.bestNetwork.networkId));

              let nnObj = bestNetworkHashMap.get(statsObj.bestNetwork.networkId);

              nnObj = networkDefaults(nnObj);

              bestNetworkHashMap.set(statsObj.bestNetwork.networkId, nnObj);

              statsObj.status = "END UPDATE STATS";
              slackSendMessage(hostname + " | TFE | " + statsObj.status);

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
            console.log(chalk.bold.blue("TFE | ... WAITING FOR NNs TO BE SAVED ..."
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

fsm = Stately.machine(fsmStates);


function initFsmTickInterval(interval) {

  console.log(chalkLog("TFE | INIT FSM TICK INTERVAL | " + msToTime(interval)));

  clearInterval(fsmTickInterval);

  fsmTickInterval = setInterval(function() {
    fsm.fsm_tick();
  }, FSM_TICK_INTERVAL);
}

reporter("START", "---", fsm.getMachineState());

process.title = "node_twitterFollowerExplorer";

console.log("\n\nTFE | =================================");
console.log("TFE | HOST:          " + hostname);
console.log("TFE | PROCESS TITLE: " + process.title);
console.log("TFE | PROCESS ID:    " + process.pid);
console.log("TFE | RUN ID:        " + statsObj.runId);
console.log("TFE | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("TFE | =================================");

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
  if (randomNetworkTree && (randomNetworkTree !== undefined)) { randomNetworkTree.kill("SIGINT"); }
});

process.on("message", function(msg) {
  if ((msg === "SIGINT") || (msg === "shutdown")) {
    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");
    clearInterval(langAnalyzerMessageRxQueueInterval);
    clearInterval(randomNetworkTreeMessageRxQueueInterval);
    clearInterval(statsUpdateInterval);
    setTimeout(function() {
      console.log(chalkAlert("TFE | *** QUITTING twitterFollowerExplorer"));
      process.exit(0);
    }, 300);
  }
});

async function showStats(options) {

  runEnable();

  if ((langAnalyzer !== undefined) && langAnalyzer) {
    langAnalyzer.send({op: "STATS", options: options});
  }

  childSendAll({op: "STATS"});

  if (options) {
    console.log("TFE | STATS\n" + jsonPrint(statsObj));
  }
  else {

    // if ((randomNetworkTreeActivateQueueSize === 0)
    //   ) 
    // { 

    console.log(chalkLog("TFE | ### FEM S"
      + " | FSM: " + fsm.getMachineState()
      + " | N: " + getTimeStamp()
      + " | PUQ EMPTY: " + processUserQueueEmpty()
      + " | PUQ RDY: " + processUserQueueReady
      + " | PUQ LNG: " + processUserQueue.length
      + " | ANQ RDY: " + activateNetworkQueueReady
      + " | ANQ LNG: " + activateNetworkQueue.length
      + " | RNT OP: " + statsObj.randomNetworkTreeOp
      + " | RNT RDY: " + randomNetworkTreeReadyFlag
      + " | RNTQ LNG: " + randomNetworkTreeActivateQueueSize
      + " | ALL CH FETCH END: " + statsObj.allChildrenFetchEnd
      + "\nTFE | ### FEM S"
      + " | E: " + msToTime(statsObj.elapsed)
      + " | S: " + getTimeStamp(statsObj.startTimeMoment)
      + " | N: " + getTimeStamp()
      + "\nTFE | ### FEM S"
      + " | BEST NN: " + currentBestNetwork.networkId
    ));

    printNetworkObj("TFE | BEST NETWORK", currentBestNetwork);

    console.log(chalkLog("TFE | ... RNT S"
      + " | BUSY: " + randomNetworkTreeBusyFlag
      + " | READY: " + randomNetworkTreeReadyFlag
      + " | RAQ: " + randomNetworkTreeActivateQueueSize
    ));

    Object.keys(tfeChildHashMap).forEach(function(user) {
      console.log(chalkLog("TFE | ... FEC S"
        + " | CHILD " + user + " | FSM: " + tfeChildHashMap[user].status
      ));
    });

  }
}

process.on( "SIGINT", function() {
  quit({source: "SIGINT"});
});

function saveFile(params, callback){

  let fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  if (params.localFlag) {

    const objSizeMBytes = sizeof(params.obj)/ONE_MEGABYTE;

    showStats();
    console.log(chalkBlue("TFE | ... SAVING DROPBOX LOCALLY"
      + " | " + objSizeMBytes.toFixed(3) + " MB"
      + " | " + fullPath
    ));

    writeJsonFile(fullPath, params.obj, { mode: 0o777 })
    .then(function() {

      console.log(chalkBlue("TFE | SAVED DROPBOX LOCALLY"
        + " | " + objSizeMBytes.toFixed(3) + " MB"
        + " | " + fullPath
      ));
      if (callback !== undefined) { return callback(null); }

    })
    .catch(function(error){
      console.trace(chalkError("TFE | " + moment().format(compactDateTimeFormat) 
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
          console.error(chalkError("TFE | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: 413"
            + " | ERROR: FILE TOO LARGE"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 429){
          console.error(chalkError("TFE | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: TOO MANY WRITES"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else if (error.status === 500){
          console.error(chalkError("TFE | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: DROPBOX SERVER ERROR"
          ));
          if (callback !== undefined) { return callback(error.error_summary); }
        }
        else {
          console.trace(chalkError("TFE | " + moment().format(compactDateTimeFormat) 
            + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
            + " | ERROR: " + error
          ));
          if (callback !== undefined) { return callback(error); }
        }
      });
    };

    if (options.mode === "add") {

      dropboxClient.filesListFolder({path: params.folder, limit: DROPBOX_LIST_FOLDER_LIMIT})
      .then(function(response){

        debug(chalkLog("DROPBOX LIST FOLDER"
          + " | ENTRIES: " + response.entries.length
          + " | MORE: " + response.has_more
          + " | PATH:" + options.path
        ));

        let fileExits = false;

        async.each(response.entries, function(entry, cb){

          console.log(chalkLog("TFE | DROPBOX FILE"
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
            console.log(chalkError("TFE | *** ERROR DROPBOX SAVE FILE: " + err));
            if (callback !== undefined) { 
              return callback(err, null);
            }
            return;
          }
          if (fileExits) {
            console.log(chalkAlert("TFE | ... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
            if (callback !== undefined) { callback(err, null); }
          }
          else {
            console.log(chalkAlert("TFE | ... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
            dbFileUpload();
          }
        });
      })
      .catch(function(err){
        console.log(chalkError("TFE | *** DROPBOX FILES LIST FOLDER ERROR: " + err));
        console.log(chalkError("TFE | *** DROPBOX FILES LIST FOLDER ERROR\n" + jsonPrint(err)));
        if (callback !== undefined) { callback(err, null); }
      });
    }
    else {
      dbFileUpload();
    }
  }
}

function checkUserIgnored(params){

  return new Promise(function(resolve, reject){

    if (!params.nodeId) {
      return reject(new Error("nodeId UNDEFINED"));
    }

    global.User.findOne({nodeId: params.nodeId}, function(err, user){

      if (err) { return reject(err); }

      if (user && user.ignored) {
        return resolve(true);
      }

      resolve(false);

    });

  });
}

// const userProfilePropertiesArray = [
//   "bannerImageUrl",
//   "description",
//   "location",
//   "name",
//   "profileUrl",
//   "screenName",
//   "url"
// ];

function updatePreviousUserProps(params){

  return new Promise(function(resolve, reject){

    if (!params.user) {
      return reject(new Error("user UNDEFINED"));
    }

    async.each(USER_PROFILE_PROPERTY_ARRAY, function(userProp, cb){

      const prevUserProp = "previous" + _.upperFirst(userProp);

      if (params.user[userProp] && (params.user[userProp] !== undefined) && (params.user[prevUserProp] !== params.user[userProp])) {
        console.log(chalkLog("TFE | updatePreviousUserProps"
          + " | " + prevUserProp + ": " + params.user[prevUserProp] 
          + " <- " + userProp + ": " + params.user[userProp]
        ));

        params.user[prevUserProp] = params.user[userProp];

        params.user.markModified(prevUserProp);

      }
      cb();

    }, function(){

      if (params.user.statusId && (params.user.statusId !== undefined) && (params.user.previousStatusId !== params.user.statusId)) {
        params.user.previousStatusId = params.user.statusId;
        params.user.markModified("previousStatusId");
      }

      if (params.user.quotedStatusId && (params.user.quotedStatusId !== undefined) && (params.user.previousQuotedStatusId !== params.user.quotedStatusId)) {
        params.user.previousQuotedStatusId = params.user.quotedStatusId;
        params.user.markModified("quotedStatusId");
      }

      resolve(params.user);
    });

  });
}



function initProcessUserQueueInterval(interval) {

  statsObj.status = "INIT PROCESS USER QUEUE";

  let mObj = {};
  let tcUser;
  let ignoredFlag = false;

  console.log(chalkBlue("TFE | INIT PROCESS USER QUEUE INTERVAL | " + PROCESS_USER_QUEUE_INTERVAL + " MS"));

  clearInterval(processUserQueueInterval);

  processUserQueueInterval = setInterval(async function () {

    if (processUserQueueReady && processUserQueue.length > 0) {

      statsObj.status = "PROCESS USER";

      processUserQueueReady = false;

      mObj = processUserQueue.shift();

      tcUser = mObj.threeceeUser;

      if (ignoredUserSet.has(mObj.friend.id_str)){

        tfeChildHashMap[tcUser].child.send({op: "UNFOLLOW", user: {userId: mObj.friend.id_str} });

        console.log(chalk.bold.black("TFE | UNFOLLOW IGNORED USER"
          + " | ID: " + mObj.friend.id_str
          + " | @" + mObj.friend.screen_name
        ));

        processUserQueueReady = true;
        return;
      }


      if (unfollowableUserSet.has(mObj.friend.id_str)){

        tfeChildHashMap[tcUser].child.send({op: "UNFOLLOW", user: {userId: mObj.friend.id_str} });

        console.log(chalk.bold.black("TFE | UNFOLLOW UNFOLLOWABLE USER"
          + " | ID: " + mObj.friend.id_str
          + " | @" + mObj.friend.screen_name
        ));

        processUserQueueReady = true;
        return;
      }

      
      ignoredFlag = await checkUserIgnored({nodeId: mObj.friend.id_str});

      if (ignoredFlag){

        ignoredUserSet.add(mObj.friend.id_str);

        tfeChildHashMap[tcUser].child.send({op: "UNFOLLOW", user: {userId: mObj.friend.id_str} });

        console.log(chalk.bold.black("TFE | UNFOLLOW IGNORED USER"
          + " | ID: " + mObj.friend.id_str
          + " | @" + mObj.friend.screen_name
        ));

        processUserQueueReady = true;
        return;
      }


      twitterUserHashMap[tcUser].friends.add(mObj.friend.id_str);

      if (saveRawFriendFlag){
        const file = "user_" + mObj.friend.id_str + ".json";
        console.log(chalkLog("TFE | SAVE FRIEND_RAW FILE"
          + " | " + file
        ));
        debug(chalkAlert("TFE | SAVE FRIEND_RAW FILE"
          + " | " + file
          + "\n" + jsonPrint(mObj.friend)
        ));
        statsObj.rawFriend = mObj.friend;
        saveFileQueue.push({folder: testDataUserFolder, file: file, obj: mObj.friend });
        saveRawFriendFlag = false;
      }

      try {

        // processUser(tcUser, mObj.friend, function(err, user) {
        let user = await processUser({threeceeUser: tcUser, user: mObj.friend});

        statsObj.users.grandTotalFriendsProcessed += 1;
        statsObj.users.totalFriendsProcessed += 1;

        statsObj.users.totalPercentProcessed = 100*statsObj.users.totalFriendsProcessed/statsObj.users.totalFriendsCount;

        if (statsObj.user[tcUser] === undefined) {
          statsObj.user[tcUser].friendsCount = 1;
          statsObj.user[tcUser].friendsProcessed = 0;
          statsObj.user[tcUser].percentProcessed = 0;
          statsObj.user[tcUser].friendsProcessStart = moment();
        }

        statsObj.user[tcUser].friendsProcessed += 1;
        statsObj.user[tcUser].percentProcessed = 100*statsObj.user[tcUser].friendsProcessed/statsObj.user[tcUser].friendsCount;

        debug("PROCESSED USER\n" + jsonPrint(user));

        // if (configuration.testMode || (statsObj.user[tcUser].friendsProcessed % 100 === 0)) {
        if (statsObj.user[tcUser].friendsProcessed % 100 === 0) {

          statsObj.user[tcUser].friendsProcessElapsed = moment().diff(statsObj.user[tcUser].friendsProcessStart);

          if (statsObj.user[tcUser].friendsCount < statsObj.user[tcUser].friendsProcessed) {
            statsObj.user[tcUser].friendsCount = statsObj.user[tcUser].friendsProcessed;
          }

          console.log(chalkBlue("TFE | <FRND PRCSSD"
            + " [ Q: " + processUserQueue.length + " ]"
            + " | @" + tcUser
            + " | S: " + statsObj.user[tcUser].friendsProcessStart.format(compactDateTimeFormat)
            + " | E: " + msToTime(statsObj.user[tcUser].friendsProcessElapsed)
            + "\nTFE | <FRND PRCSSD | @" + user.screenName
            + " | NAME: " + user.name
            + " | CR: " + moment(user.createdAt).format(compactDateTimeFormat)
            + " | LS: " + moment(user.lastSeen).format(compactDateTimeFormat)
            + " | FLWg: " + user.following
            + " | 3CF: " + user.threeceeFollowing
            + " | FLWRs: " + user.followersCount
            + " | FRNDs: " + user.friendsCount
            + " | Ts: " + user.statusesCount
            + "\nTFE | <FRND PRCSSD | TOT PRCSSD: " + statsObj.users.totalFriendsProcessed + "/" + statsObj.users.totalFriendsCount
            + " (" + statsObj.users.totalPercentProcessed.toFixed(2) + "%)"
            + " | USR PRCSSD: " + statsObj.user[tcUser].friendsProcessed + "/" + statsObj.user[tcUser].friendsCount
            + " (" + statsObj.user[tcUser].percentProcessed.toFixed(2) + "%)"
          ));

        }

        user.markModified("tweetHistograms");
        user.markModified("profileHistograms");

        user = await updatePreviousUserProps({user: user});

        user.save()
        .then(function() {
          processUserQueueReady = true;
        })
        .catch(function(err) {
          console.log(chalkError("TFE | *** ERROR processUser USER SAVE: @" + user.screenName + " | " + err));
          processUserQueueReady = true;
        });
      }
      catch(err){
        console.log(chalkError("TFE | *** ERROR processUser USER @" + mObj.friend.screen_name + " | " + err));
        processUserQueueReady = true;
      }

    }
  }, interval);
}

function initSaveFileQueue(cnf) {

  console.log(chalkBlue("TFE | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err) {
        if (err) {
          console.log(chalkError("TFE | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("TFE | SAVED FILE [Q: " + saveFileQueue.length + "] " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });

    }
  }, cnf.saveFileQueueInterval);
}

function initStatsUpdate(callback) {

  return new Promise(function(resolve, reject){

    console.log(chalkTwitter("TFE | INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

    statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    // twitterTextParser.getGlobalHistograms(function(hist) {
      saveFile({folder: statsFolder, file: statsFile, obj: statsObj});
    // });

    clearInterval(statsUpdateInterval);

    statsUpdateInterval = setInterval(async function () {

      try {
        await initUnfollowableUserSet();
      }
      catch(err){
        console.log(chalkError("TFE | *** INIT UNFOLLOWABLE USER SET ERROR: " + err));
      }

      statsObj.elapsed = moment().valueOf() - statsObj.startTimeMoment.valueOf();
      statsObj.timeStamp = moment().format(compactDateTimeFormat);

      saveFileQueue.push({folder: statsFolder, file: statsFile, obj: statsObj});

      showStats();
      
    }, configuration.statsUpdateIntervalTime);

    resolve();

  });
}

function initTwitterFollowerChild(twitterConfig) {

  return new Promise(async function(resolve, reject){

    try {

      const user = twitterConfig.threeceeUser;
      const childId = TFC_CHILD_PREFIX + user;
      console.log(chalkLog("TFE | +++ NEW TFE CHILD | TFC ID: " + childId));

      statsObj.status = "INIT CHILD | @" + user ;

      let childEnv = {};
      childEnv.env = {};

      childEnv.env.CHILD_ID = childId;
      childEnv.env.THREECEE_USER = user;

      childEnv.env.DEFAULT_FETCH_COUNT = DEFAULT_FETCH_COUNT;
      childEnv.env.DEFAULT_FETCH_USER_TIMEOUT = DEFAULT_FETCH_USER_TIMEOUT;

      childEnv.env.TEST_MODE_TOTAL_FETCH = TEST_MODE_TOTAL_FETCH;
      childEnv.env.TEST_MODE_FETCH_COUNT = TEST_MODE_FETCH_COUNT;
      childEnv.env.TEST_MODE_FETCH_USER_TIMEOUT = TEST_MODE_FETCH_USER_TIMEOUT;
      childEnv.env.TEST_MODE = (configuration.testMode) ? 1 : 0;

      tfeChildHashMap[user] = {};
      tfeChildHashMap[user].childId = childId;
      tfeChildHashMap[user].threeceeUser = user;
      tfeChildHashMap[user].child = {};
      tfeChildHashMap[user].status = "IDLE";
      tfeChildHashMap[user].statsObj = {};
      tfeChildHashMap[user].twitterConfig = {};
      tfeChildHashMap[user].twitterConfig.consumer_key = twitterConfig.CONSUMER_KEY;
      tfeChildHashMap[user].twitterConfig.consumer_secret = twitterConfig.CONSUMER_SECRET;
      tfeChildHashMap[user].twitterConfig.access_token = twitterConfig.TOKEN;
      tfeChildHashMap[user].twitterConfig.access_token_secret = twitterConfig.TOKEN_SECRET;

      console.log(chalkLog("TFE | +++ NEW TFE CHILD | childEnv\n" + jsonPrint(childEnv)));

      const tfeChild = cp.fork(`twitterFollowerExplorerChild.js`, childEnv );

      tfeChildHashMap[user].child = tfeChild;

      let slackText = "";

      tfeChildHashMap[user].child.on("message", async function(m) {

        debug(chalkAlert("TFE | tfeChild RX"
          + " | " + m.op
        ));

        switch(m.op) {

          case "ERROR":

            console.log(chalkError("TFE | *** CHILD ERROR | " + m.threeceeUser + " | TYPE: " + m.type));
            slackSendRtmMessage("TFE | " + hostname + " | ERROR | CHILD @" + m.threeceeUser + " | TYPE: " + m.type);

            tfeChildHashMap[m.threeceeUser].status = "ERROR";

            if (m.error) { 
              tfeChildHashMap[m.threeceeUser].error = m.error;
              // console.log(chalkError("TFE | *** CHILD ERROR: " + m.error)); 
              console.log(chalkError("TFE | *** CHILD ERROR\n" + jsonPrint(m.error))); 
            }

            if (m.type === "INVALID_TOKEN") {
              await disableChild({threeceeUser: m.threeceeUser});
              tfeChildHashMap[m.threeceeUser].status = "DISABLED";
            }
            else {
              await initChild({threeceeUser: m.threeceeUser});
              await checkChildrenState("INIT");
            }
          break;

          case "INIT":
          case "INIT_COMPLETE":
            console.log(chalkTwitter("TFE | CHILD INIT COMPLETE | " + m.threeceeUser));
            tfeChildHashMap[m.threeceeUser].status = "INIT";
            checkChildrenState(m.op);
          break;
     
          case "IDLE":
            console.log(chalkTwitter("TFE | CHILD IDLE | " + m.threeceeUser));
            tfeChildHashMap[m.threeceeUser].status = "IDLE";
            checkChildrenState(m.op);
          break;

          case "RESET":
            console.log(chalkTwitter("TFE | CHILD RESET | " + m.threeceeUser));
            tfeChildHashMap[m.threeceeUser].status = "RESET";
            checkChildrenState(m.op);
          break;

          case "READY":
            console.log(chalkTwitter("TFE | CHILD READY | " + m.threeceeUser));
            tfeChildHashMap[m.threeceeUser].status = "READY";
            checkChildrenState(m.op);
          break;

          case "FETCH":
            console.log(chalkTwitter("TFE | CHILD FETCH | " + m.threeceeUser));
            tfeChildHashMap[m.threeceeUser].status = "FETCH";
            checkChildrenState(m.op);
          break;

          case "FETCH_END":
            console.log(chalkTwitter("TFE | CHILD FETCH_END | " + m.threeceeUser));
            tfeChildHashMap[m.threeceeUser].status = "FETCH_END";
            checkChildrenState(m.op);
          break;

          case "PAUSE_RATE_LIMIT":
            console.log(chalkTwitter("TFE | CHILD PAUSE_RATE_LIMIT | " + m.threeceeUser + " | REMAIN: " + msToTime(m.remaining)));
            tfeChildHashMap[m.threeceeUser].status = "PAUSE_RATE_LIMIT";
            tfeChildHashMap[m.threeceeUser].twitterRateLimitRemaining = m.remaining;
            tfeChildHashMap[m.threeceeUser].twitterRateLimitResetAt = m.resetAt;
            checkChildrenState(m.op);
          break;

          case "THREECEE_USER":

            console.log(chalkTwitter("TFE | THREECEE_USER"
              + " | @" + m.threeceeUser.screenName
              + " | Ts: " + m.threeceeUser.statusesCount
              + " | FRNDs: " + m.threeceeUser.friendsCount
              + " | FLWRs: " + m.threeceeUser.followersCount
            ));

            if (statsObj.user[m.threeceeUser.screenName.toLowerCase()] === undefined) { 
              statsObj.user[m.threeceeUser.screenName.toLowerCase()] = {};
            }

            statsObj.user[m.threeceeUser.screenName.toLowerCase()].statusesCount = m.threeceeUser.statusesCount;
            statsObj.user[m.threeceeUser.screenName.toLowerCase()].friendsCount = m.threeceeUser.friendsCount;
            statsObj.user[m.threeceeUser.screenName.toLowerCase()].followersCount = m.threeceeUser.followersCount;

            statsObj.users.totalFriendsCount = 0;

            Object.keys(statsObj.user).forEach(function(tcUser) {

              if ((statsObj.user[tcUser] !== undefined) 
                && (statsObj.user[tcUser].friendsCount !== undefined)
                && (tfeChildHashMap[tcUser].status !== "DISABLED")
                && (tfeChildHashMap[tcUser].status !== "ERROR")
                && (tfeChildHashMap[tcUser].status !== "RESET")
              ) { 
                statsObj.users.totalFriendsCount += statsObj.user[tcUser].friendsCount;
              }

            });

          break;

          case "FRIENDS_IDS":
            twitterUserHashMap[m.threeceeUser].friends = new Set(m.friendsIds);
            console.log(chalkTwitter("TFE | FRIENDS_IDS"
              + " | 3C: @" + m.threeceeUser
              + " | " + twitterUserHashMap[m.threeceeUser].friends.size + " FRIENDS"
            ));
          break;

          case "FRIEND_RAW":

            statsObj.friends.raw += 1;

            processUserQueue.push(m);

            if (configuration.verbose || saveRawFriendFlag) {
              console.log(chalkInfo("TFE | TEST DATA: FRIEND_RAW"
                + " [ PUQ: " + processUserQueue.length + " ]"
                + " | 3C @" + m.threeceeUser
                + " | @" + m.friend.screen_name
                + " | FLWRs: " + m.friend.followers_count
                + " | FRNDs: " + m.friend.friends_count
                + " | Ts: " + m.friend.statuses_count
              ));

              if (saveRawFriendFlag){
                const file = "user_" + m.friend.id_str + ".json";
                console.log(chalkLog("TFE | SAVE FRIEND_RAW FILE"
                  + " | " + file
                ));
                debug(chalkAlert("TFE | SAVE FRIEND_RAW FILE"
                  + " | " + file
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

              try { 
                slackSendWebMessage("UNFOLLOW | @" + m.threeceeUser + " | " + m.user.id_str + " | @" + m.user.screen_name);
              }
              catch(err){
                console.log(chalkError("TFE | *** SLACK UNFOLLOW MESSAGE ERROR: " + err));
              }

          break;

          case "STATS":

            m.statsObj.startTimeMoment = getTimeStamp(m.statsObj.startTimeMoment);

            tfeChildHashMap[m.threeceeUser].status = m.statsObj.fsmState;
            tfeChildHashMap[m.threeceeUser].statsObj = m.statsObj;

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

      tfeChildHashMap[user].child.on("error", async function(err) {

        if (tfeChildHashMap[user]) {

          tfeChildHashMap[user].status = "ERROR";

          if (!quitFlag) {

            console.log(chalkError("TFE | *** CHILD ERROR | @" + user + " ERROR *** : " + err));

            slackSendRtmMessage("TFE | " + hostname + " | ERROR | CHILD @" + m.threeceeUser + " | TYPE: " + m.type);

            console.log(chalkAlert("TFE | >>> RE-INIT ON ERROR | @" + user + " ..."));

            try {
              await initTwitter(user);
              console.log(chalkAlert("TFE | +++ RE-INITIALIZED ON ERROR @" + user));
            }
            catch(err) {
              console.log(chalkError("TFE | *** INIT TWITTER ERROR: " + err.message));
              quit("INIT TWITTER ON CHILD ERROR @" + user);
              return;
            }
          }
        }
      });

      tfeChildHashMap[user].child.on("exit", function(err) {
        if (tfeChildHashMap[user]) {
          tfeChildHashMap[user].status = "EXIT";
        }
        console.log(chalkError("TFE | *** tfeChildHashMap " + user + " EXIT *** : " + err));
      });

      tfeChildHashMap[user].child.on("close", async function(code) {
        if (tfeChildHashMap[user]) {
          tfeChildHashMap[user].status = "CLOSE";
     
           if (!quitFlag && configuration.reinitializeChildOnClose) {

            console.log(chalkAlert("TFE | >>> RE-INIT ON CLOSE | @" + user + " ..."));

            try {
              await initTwitter(user);
              console.log(chalkAlert("TFE | +++ RE-INITIALIZED ON CLOSE @" + user));
            }
            catch(err) {
              console.log(chalkError("TFE | *** INIT TWITTER ERROR: " + err.message));
              quit("INIT TWITTER ON CHILD ERROR @" + user);
              return;
            }

          }
        }
        console.log(chalkError("TFE | *** tfeChildHashMap " + user + " CLOSE *** : " + code));
      });

      resolve(tfeChild);
    }
    catch(err){
      reject(err);
    }
  });
}

function initTwitter(threeceeUser) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT TWITTER | @" + threeceeUser;

    let twitterConfigFile =  threeceeUser + ".json";

    debug(chalkInfo("INIT TWITTER USER @" + threeceeUser + " | " + twitterConfigFile));

    try {
      const twitterConfig = await loadFile({folder: configuration.twitterConfigFolder, file: twitterConfigFile});

      twitterConfig.threeceeUser = threeceeUser;

      console.log(chalkTwitter("TFE | LOADED TWITTER CONFIG"
        + " | @" + threeceeUser
        + " | CONFIG FILE: " + configuration.twitterConfigFolder + "/" + twitterConfigFile
        // + "\n" + jsonPrint(twitterConfig)
      ));

      await initTwitterFollowerChild(twitterConfig);
      resolve(twitterConfig);
    }
    catch(err){
      console.log(chalkError("TFE | *** LOADED TWITTER CONFIG ERROR: FILE:  " 
        + configuration.twitterConfigFolder + "/" + twitterConfigFile
      ));
      console.log(chalkError("TFE | *** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      return callback(err);
    }

  });
}

function initTwitterUsers(callback) {

  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "INIT TWITTER USERS";

      if (!configuration.twitterUsers) {
        console.log(chalkAlert("TFE | ??? NO TWITTER USERS ???"));
        return reject(new Error("NO TWITTER USERS"));
      }

      console.log(chalkTwitter("TFE | INIT TWITTER USERS"
        + " | FOUND " + configuration.twitterUsers.length + " USERS"
      ));

      async.each(configuration.twitterUsers, async function(userScreenName) {

        userScreenName = userScreenName.toLowerCase();

        console.log(chalkTwitter("TFE | INIT TWITTER USER @" + userScreenName));

        twitterUserHashMap[userScreenName] = {};
        twitterUserHashMap[userScreenName].threeceeUser = userScreenName;
        twitterUserHashMap[userScreenName].friends = new Set();

        try {
          await initTwitter(userScreenName);
          await resetTwitterUserState(userScreenName);
          return;
        }
        catch(err) {
          console.log(chalkError("TFE | INIT TWITTER ERROR: " + err.message));
          if (err.code === 88) { return;  }
          return err;
        }

      }, function(err) {

        statsObj.users.totalFriendsCount = 0;
        statsObj.users.totalFriendsFetched = 0;

        configuration.twitterUsers.forEach(function(tcUser) {

          statsObj.users.totalFriendsCount = 0;

          if ((statsObj.user[tcUser] !== undefined)
              && (statsObj.user[tcUser].friendsCount !== undefined)
              && (tfeChildHashMap[tcUser].status !== "DISABLED")
              && (tfeChildHashMap[tcUser].status !== "ERROR")
              && (tfeChildHashMap[tcUser].status !== "RESET")
            ) {

            statsObj.users.totalFriendsFetched += statsObj.user[tcUser].totalFriendsFetched;
            statsObj.users.totalFriendsCount += statsObj.user[tcUser].friendsCount;
            statsObj.users.totalPercentFetched = 100 * statsObj.users.totalFriendsFetched/statsObj.users.totalFriendsCount;

          }
        });

        statsObj.users.grandTotalFriendsFetched += statsObj.users.totalFriendsFetched;

        resolve();

      });

    }
    catch(err){
      console.log(chalkTwitter("TFE | *** INIT TWITTER USERS ERROR: " + err));
      reject(err);
    }
  });
}

function toggleVerbose(){

  configuration.verbose = !configuration.verbose;

  console.log(chalkLog("TFE | VERBOSE: " + configuration.verbose));

  childSendAll({op: "VERBOSE", verbose: configuration.verbose});
}

function initStdIn() {
  console.log("TFE | STDIN ENABLED");
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
        console.log(chalkLog("TFE | STDIN | ABORT: " + abortCursor));
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

      case ".":
        try { 
          slackSendMessage("TFE | " + hostname + " | PING");
        }
        catch(err){
          console.log(chalkError("TFE | *** SLACK PING MESSAGE ERROR: " + err));
        }
      break;

      case "V":
        toggleVerbose();
      break;

      case "x":
        saveRawFriendFlag = true;
        console.log(chalkLog("TFE | STDIN | SAVE RAW FRIEND"));
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

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    if (debug.enabled) {
      console.log("\nTFE | %%%%%%%%%%%%%%\nTFE |  DEBUG ENABLED \nTFE | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.TFE_PROCESS_NAME || "twitterFollowerExplorer";
    cnf.forceInitRandomNetworks = process.env.TFE_FORCE_INIT_RANDOM_NETWORKS || DEFAULT_FORCE_INIT_RANDOM_NETWORKS ;
    cnf.minSuccessRate = process.env.TFE_MIN_SUCCESS_RATE || DEFAULT_MIN_SUCCESS_RATE ;
    cnf.minMatchRate = process.env.TFE_MIN_MATCH_RATE || DEFAULT_MIN_MATCH_RATE ;
    cnf.numRandomNetworks = process.env.TFE_NUM_RANDOM_NETWORKS || TFE_NUM_RANDOM_NETWORKS ;
    cnf.testMode = (process.env.TFE_TEST_MODE === "true") ? true : cnf.testMode;

    cnf.networkDatabaseLoadLimit = process.env.TFE_NUM_NN || DEFAULT_NUM_NN;
    if (cnf.testMode) {
      cnf.networkDatabaseLoadLimit = TEST_MODE_NUM_NN;
      console.log(chalkAlert("TFE | TEST MODE | networkDatabaseLoadLimit: " + cnf.networkDatabaseLoadLimit));
    }

    cnf.fetchAllIntervalTime = process.env.TFE_FETCH_ALL_INTERVAL || DEFAULT_FETCH_ALL_INTERVAL;
    if (cnf.testMode) {
      cnf.fetchAllIntervalTime = TEST_MODE_FETCH_ALL_INTERVAL;
      console.log(chalkAlert("TFE | TEST MODE | fetchAllIntervalTime: " + cnf.fetchAllIntervalTime));
    }

    cnf.quitOnError = process.env.TFE_QUIT_ON_ERROR || false ;

    if (process.env.TFE_QUIT_ON_COMPLETE === "false") {
      cnf.quitOnComplete = false;
    }
    else if ((process.env.TFE_QUIT_ON_COMPLETE === true) || (process.env.TFE_QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    cnf.enableStdin = process.env.TFE_ENABLE_STDIN || true ;
    if (process.env.TFE_USER_DB_CRAWL && (process.env.TFE_USER_DB_CRAWL === "true")) {
      cnf.userDbCrawl = true;
    }

    cnf.enableLanguageAnalysis = process.env.TFE_ENABLE_LANG_ANALYSIS || false ;
    cnf.forceLanguageAnalysis = process.env.TFE_FORCE_LANG_ANALYSIS || false ;
    cnf.forceImageAnalysis = process.env.TFE_FORCE_IMAGE_ANALYSIS || false ;
    cnf.enableImageAnalysis = process.env.TFE_ENABLE_IMAGE_ANALYSIS || false ;

    console.log(chalkAlert("TFE | FORCE LANG ANALYSIS: " + cnf.forceLanguageAnalysis));

    cnf.twitterDefaultUser = process.env.TFE_TWITTER_DEFAULT_USER || TWITTER_DEFAULT_USER ;
    cnf.statsUpdateIntervalTime = process.env.TFE_STATS_UPDATE_INTERVAL || ONE_MINUTE;
    cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";
    cnf.twitterConfigFile = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE || cnf.twitterDefaultUser + ".json";
    cnf.neuralNetworkFile = defaultNeuralNetworkFile;

    try {

      await initSlackWebClient();
      await initSlackRtmClient();
      await loadAllConfigFiles();
      await loadCommandLineArgs();


      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log("TFE | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log("TFE | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      statsObj.commandLineArgsLoaded = true;

      if (configuration.enableStdin) {
        initStdIn();
      }

      await initStatsUpdate();
      const tc = await loadFile({folder: configuration.twitterConfigFolder, file: configuration.twitterConfigFile});

      configuration.twitterConfig = {};
      configuration.twitterConfig.consumer_key = tc.consumer_key;
      configuration.twitterConfig.consumer_secret = tc.consumer_secret;
      configuration.twitterConfig.app_only_auth = true;

      console.log("TFE | " + chalkInfo(getTimeStamp() + " | TWITTER CONFIG FILE "
        + configuration.twitterConfigFolder + "/" + configuration.twitterConfigFile
      ));

      resolve(configuration) ;

    }
    catch(err){

      console.log(chalkError("TFE | *** TWITTER CONFIG LOAD ERROR"
        + " | " + configuration.twitterConfigFolder + "/" + configuration.twitterConfigFile
        + "\n" + err
      ));

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

function printTestCycleHistory(nn){
  let tableArray = [];

  tableArray.push([
    "TC",
    "M",
    "MM",
    "TOT",
    "MR(%)",
    "TS"
  ]);

  async.each(nn.testCycleHistory, function(entry, cb1){
    tableArray.push([
      entry.testCycle,
      entry.match,
      entry.mismatch,
      entry.total,
      entry.matchRate.toFixed(2),
      moment(entry.timeStamp).format(compactDateTimeFormat)
    ]);

    async.setImmediate(function() { cb1(); });

  }, function(){

    const t = table(tableArray, { align: ["r", "r", "r", "r", "r", "l"] });

    console.log("TFE | =========================================================================");

    console.log(chalkLog("TFE | TEST CYCLE HISTORY | " + nn.networkId));

    // if (configuration.verbose) { console.log(t); }
    if (true) { console.log(t); }

    console.log("TFE | =========================================================================");
  });
}

function updateNetworkStats(params, callback) {

  statsObj.status = "UPDATE DB NN STATS";

  console.log(chalkTwitter("TFE | UPDATE NETWORK STATS"));

  const updateOverallMatchRate = (params.updateOverallMatchRate !== undefined) ? params.updateOverallMatchRate : false;
  const updateDb = (params.updateDb !== undefined) ? params.updateDb : false;
  const incrementTestCycles = (params.incrementTestCycles !== undefined) ? params.incrementTestCycles : false;

  const nnIds = Object.keys(params.networkStatsObj);

  let newNnDb;
  let nnObj;

  async.eachSeries(nnIds, async function(nnId) {

    if (bestNetworkHashMap.has(nnId)) {

      let networkObj = bestNetworkHashMap.get(nnId);

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
        addToTestHistory: false
      };

      try {
        const nnDbUpdated = await updateDbNetwork(updateDbNetworkParams);
      }
      catch(err){
        console.log(chalkError("TFE | *** NN DB UPDATE ERROR: " + err));
        return(err);
      }

      bestNetworkHashMap.set(nnDbUpdated.networkId, nnDbUpdated);

      printNetworkObj("TFE | UPDATE NN STATS", nnDbUpdated);

      return;

    }
    else {
      console.log(chalkAlert("TFE | ??? NETWORK NOT IN BEST NETWORK HASHMAP ???"
        + " | NNID: " + nnId
      ));
      return;
    }
  }, function(err) {

    saveNetworkHashMap({folder: bestNetworkFolder, saveImmediate: params.saveImmediate, updateDb: params.updateDb}, function() {

      statsObj.status = statsObj.fsmState;

      if (callback !== undefined) { callback(err); }
    });
  });
}

function initActivateNetworkQueueInterval(interval) {

  return new Promise(function(resolve, reject){

    clearInterval(activateNetworkQueueInterval);

    statsObj.status = "INIT RNT ACTIVATE Q INTERVAL";

    let activateNetworkObj = {};

    activateNetworkQueueReady = true;

    console.log(chalkLog("TFE | INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

    activateNetworkQueueInterval = setInterval(function () {

      if (randomNetworkTreeReadyFlag && activateNetworkQueueReady && (activateNetworkQueue.length > 0)) {

        activateNetworkQueueReady = false;

        activateNetworkObj = activateNetworkQueue.shift();

        randomNetworkTree.send({op: "ACTIVATE", obj: activateNetworkObj}, function(){
          activateNetworkQueueReady = true;
        });

      }

    }, interval);

    resolve();

  });
}

function initRandomNetworkTreeMessageRxQueueInterval(interval, callback) {

  statsObj.status = "INIT RNT INTERVAL";

  let activateNetworkObj = {};

  randomNetworkTreeMessageRxQueueReadyFlag = true;

  console.log(chalkLog("TFE | INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

  randomNetworkTreeMessageRxQueueInterval = setInterval(function () {

    if (randomNetworkTreeMessageRxQueueReadyFlag && (randomNetworkTreeMessageRxQueue.length > 0)) {

      randomNetworkTreeMessageRxQueueReadyFlag = false;

      let m = randomNetworkTreeMessageRxQueue.shift();

      let user = {};
      let nnObj = {};
      let prevBestNnObj = {};
      let fileObj = {};
      let file;

      statsObj.randomNetworkTreeOp = m.op;

      switch (m.op) {
        case "IDLE":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          randomNetworkTreeBusyFlag = false;
          runEnable();
          console.log(chalkLog("TFE | ... RNT IDLE ..."));
        break;

        case "STATS":

          console.log(chalkLog("TFE | R< RNT_STATS"
            // + "\n" + jsonPrint(Object.keys(m.statsObj))
          ));

          console.log(chalkBlue("TFE | RNT | UPDATING ALL NNs STATS IN DB..."));

          updateNetworkStats(
            {
              networkStatsObj: m.statsObj.loadedNetworks, 
              saveImmediate: true, 
              updateDb: true, 
              updateOverallMatchRate: true,
              incrementTestCycles: true
            }, 
            function() {
              randomNetworkTreeMessageRxQueueReadyFlag = true;
            }
          );

        break;

        case "NETWORK_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("... RNT NETWORK_READY ..."));
          runEnable();
        break;

        case "NETWORK_BUSY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          randomNetworkTreeBusyFlag = "NETWORK_BUSY";
          debug(chalkInfo("... RNT NETWORK_BUSY ..."));
        break;

        case "QUEUE_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q READY"));

          runEnable();
        break;

        case "QUEUE_EMPTY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
          randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q EMPTY"));
          runEnable();
        break;

        case "QUEUE_FULL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
          randomNetworkTreeReadyFlag = false;
          randomNetworkTreeBusyFlag = "QUEUE_FULL";
          console.log(chalkError("TFE | *** RNT Q FULL"));
        break;

        case "RNT_TEST_PASS":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          console.log(chalkTwitter("TFE | " + getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
          runEnable();
        break;

        case "RNT_TEST_FAIL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          console.log(chalkAlert("TFE | " + getTimeStamp() + " | RNT_TEST_FAIL"));
          quit({source: "RNT", error: "RNT_TEST_FAIL"});
        break;

        case "NETWORK_OUTPUT":

          randomNetworkTreeActivateQueueSize = m.queue;
          statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;

          debug(chalkAlert("RNT NETWORK_OUTPUT\n" + jsonPrint(m.output)));
          debug(chalkAlert("RNT NETWORK_OUTPUT | " + m.bestNetwork.networkId));

          bestRuntimeNetworkId = m.bestNetwork.networkId;

          if (bestNetworkHashMap.has(bestRuntimeNetworkId)) {

            currentBestNetwork = bestNetworkHashMap.get(bestRuntimeNetworkId);

            currentBestNetwork.matchRate = m.bestNetwork.matchRate;
            currentBestNetwork.overallMatchRate = m.bestNetwork.overallMatchRate;
            currentBestNetwork.successRate = m.bestNetwork.successRate;

            updateBestNetworkStats(currentBestNetwork);

            bestNetworkHashMap.set(bestRuntimeNetworkId, currentBestNetwork);

            if ((hostname === "google") 
              && (prevBestNetworkId !== bestRuntimeNetworkId) 
              && configuration.bestNetworkIncrementalUpdate) 
            {

              prevBestNetworkId = bestRuntimeNetworkId;

              console.log(chalkNetwork("TFE | ... SAVING NEW BEST NETWORK"
                + " | " + currentBestNetwork.networkId
                + " | SR: " + currentBestNetwork.successRate.toFixed(2)
                + " | MR: " + currentBestNetwork.matchRate.toFixed(2)
                + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2)
                + " | TEST CYCs: " + currentBestNetwork.testCycles
                + " | TC HISTORY: " + currentBestNetwork.testCycleHistory.length
              ));

              fileObj = {
                networkId: bestRuntimeNetworkId,
                successRate: m.bestNetwork.successRate,
                matchRate:  m.bestNetwork.matchRate,
                overallMatchRate:  m.bestNetwork.overallMatchRate,
                testCycles:  m.bestNetwork.testCycles,
                testCycleHistory:  m.bestNetwork.testCycleHistory,
                updatedAt: moment()
              };

              file = bestRuntimeNetworkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: currentBestNetwork });
              saveCache.set(bestRuntimeNetworkFileName, {folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj });
            }

            // resolve({user: params.user, networkOutput: networkOutput);

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
            // user = deepcopy(m.user);
            user = m.user;
            user.category = m.category;
            user.categoryAuto = m.categoryAuto;
            userDbUpdateQueue.push(user);
          }
          else {
            console.log(chalkError("TFE | *** ERROR:  NETWORK_OUTPUT | BEST NN NOT IN HASHMAP???"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + bestRuntimeNetworkId
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

            if ((hostname === "google") && (prevBestNetworkId !== m.networkId)) {

              prevBestNetworkId = m.networkId;
              console.log(chalkBlue("TFE | ... SAVING NEW BEST NETWORK"
                + " | " + currentBestNetwork.networkId
                + " | MR: " + currentBestNetwork.matchRate.toFixed(2)
                + " | OAMR: " + currentBestNetwork.overallMatchRate.toFixed(2)
                + " | TEST CYCs: " + currentBestNetwork.testCycles
              ));

              fileObj = {
                networkId: currentBestNetwork.networkId,
                successRate: currentBestNetwork.successRate,
                matchRate:  currentBestNetwork.matchRate,
                overallMatchRate:  currentBestNetwork.overallMatchRate,
                testCycles:  currentBestNetwork.testCycles,
                testCycleHistory:  currentBestNetwork.testCycleHistory,
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

            prevBestNnObj = bestNetworkHashMap.get(m.previousBestNetworkId);
            prevBestNnObj.matchRate = m.previousBestMatchRate;

            bestNetworkHashMap.set(m.previousBestNetworkId, prevBestNnObj);

            if (hostname === "google") {

              console.log(chalkBlue("TFE | ... SAVING PREV BEST NETWORK"
                + " | MR: " + m.previousBestMatchRate.toFixed(2) + "%"
                + " | " + m.previousBestNetworkId + ".json"
              ));

              file = m.previousBestNetworkId + ".json";
              saveCache.set(file, {folder: bestNetworkFolder, file: file, obj: prevBestNnObj.networkObj });
            }
          }
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          runEnable();
        break;

        default:
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          console.log(chalkError("TFE | *** UNKNOWN RNT OP | " + m.op));
      }
    }
  }, interval);
  if (callback !== undefined) { callback(); }
}

function initLangAnalyzerMessageRxQueueInterval(interval) {

  statsObj.status = "INIT LANG INTERVAL";

  langAnalyzerMessageRxQueueReadyFlag = true;

  console.log(chalkLog("TFE | INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));

  let langEntityKeys = [];

  langAnalyzerMessageRxQueueInterval = setInterval(function () {
    if (langAnalyzerMessageRxQueueReadyFlag && (langAnalyzerMessageRxQueue.length > 0)) {
      langAnalyzerMessageRxQueueReadyFlag = false;
      let m = langAnalyzerMessageRxQueue.shift();
      langEntityKeys.length = 0;
      switch (m.op) {
        case "LANG_RESULTS":
          statsObj.numLangAnalyzed += 1;
          if (m.results.entities !== undefined) {
            langEntityKeys = Object.keys(m.results.entities);
          }
          debug(chalkLog("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length
            + " | STATS: " + statsObj.analyzer.analyzed + " ANLZD"
            + " " + statsObj.analyzer.skipped + " SKP"
            + " " + statsObj.analyzer.total + " TOT ]"
            + " | OP: " + m.op
            + " | NID: " + m.obj.nodeId
            + " | SN: " + m.obj.screenName
            + " | N: " + m.obj.name
          ));
          m.obj.languageAnalyzed = true;
          if (m.error) {
            m.obj.languageAnalysis = {err: m.error};
            if (m.error.code === 8) { // LANGUAGE QUOTA; will be automatically retried
              console.log(chalkAlert("TFE | *** LANG QUOTA ERROR ... RETRY"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function() {
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }
            else if (m.error.code === 3) { // LANGUAGE unsupported
              console.log(chalkLog("TFE | *** LANG ERROR ... UNSUPPORTED LANG"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
            }
            else {
              console.log(chalkError("TFE | *** LANG ERROR"
                + " | " + m.obj.nodeId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function() {
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }
            userServerController.findOneUser(m.obj, {noInc: true, updateCountHistory: true }, function(err, updatedUserObj) {
              if (err) {
                console.log(chalkError("TFE | ERROR DB UPDATE USER languageAnalysis0"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                if (statsObj.numLangAnalyzed % 50 === 0) {
                  console.log(chalkLog("TFE | UPDATE LANG ERR | USER>DB"
                    + " | " + updatedUserObj.nodeId
                    + " | C: " + updatedUserObj.category
                    + " | CA: " + updatedUserObj.categoryAuto
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | FLWg: " + updatedUserObj.following
                    + " | 3CF: " + updatedUserObj.threeceeFollowing
                    + " | LA: " + updatedUserObj.languageAnalyzed
                  ));
                }
              }
              langAnalyzerMessageRxQueueReadyFlag = true;
            });
          }
          else if (langEntityKeys.length > 0) {
            debug(chalkLog("LANG ENTS: " + langEntityKeys.length));
            async.each(langEntityKeys, function(entityKey, cb) {
              if (!entityKey.includes(".")) {
                async.setImmediate(function() {
                  cb();
                });
              }
              else {
                const newKey = entityKey.replace(/\./g, "");
                const oldValue = m.results.entities[entityKey];
                m.results.entities[newKey] = oldValue;
                delete(m.results.entities[entityKey]);
                debug(chalkAlert("REPLACE KEY"
                  + " | " + entityKey
                  + " | " + newKey
                  + "\nOLD\n" + jsonPrint(oldValue)
                  + "\nENTITIES\n" + jsonPrint(m.results.entities)
                ));
                async.setImmediate(function() {
                  cb();
                });
              }
            }, function() {
              m.obj.languageAnalysis = m.results;
              m.obj.languageAnalyzed = true;
              statsObj.normalization.score.min = Math.min(m.results.sentiment.score, statsObj.normalization.score.min);
              statsObj.normalization.score.max = Math.max(m.results.sentiment.score, statsObj.normalization.score.max);
              statsObj.normalization.magnitude.min = Math.min(m.results.sentiment.magnitude, statsObj.normalization.magnitude.min);
              statsObj.normalization.magnitude.max = Math.max(m.results.sentiment.magnitude, statsObj.normalization.magnitude.max);
              userServerController.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj) {
                if (err) {
                  console.log(chalkError("TFE | *** ERROR DB UPDATE USER languageAnalysis1"
                    + "\n" + err
                    + "\n" + jsonPrint(m.obj)
                  ));
                }
                else {
                  if (statsObj.numLangAnalyzed % 50 === 0) {
                    console.log(chalkLog("TFE | UPDATE LANG ANLZD"
                      + " | LA ENTS: " + langEntityKeys.length
                      + " | USER>DB"
                      + " | C: " + updatedUserObj.category
                      + " | CA: " + updatedUserObj.categoryAuto
                      + " | @" + updatedUserObj.screenName
                      + " | " + updatedUserObj.name
                      + " | Ts: " + updatedUserObj.statusesCount
                      + " | FLs: " + updatedUserObj.followersCount
                      + " | FRs: " + updatedUserObj.friendsCount
                      + " | FLWg: " + updatedUserObj.following
                      + " | 3CF: " + updatedUserObj.threeceeFollowing
                      + " | LA: " + updatedUserObj.languageAnalyzed
                      + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                      + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                    ));
                  }
                }
                langAnalyzerMessageRxQueueReadyFlag = true;
              });
            });
          }
          else {
            debug(chalkLog("LANG ENTS: " + langEntityKeys.length));
            m.obj.languageAnalysis = m.results;
            m.obj.languageAnalyzed = true;
            statsObj.normalization.score.min = Math.min(m.results.sentiment.score, statsObj.normalization.score.min);
            statsObj.normalization.score.max = Math.max(m.results.sentiment.score, statsObj.normalization.score.max);
            statsObj.normalization.magnitude.min = Math.min(m.results.sentiment.magnitude, statsObj.normalization.magnitude.min);
            statsObj.normalization.magnitude.max = Math.max(m.results.sentiment.magnitude, statsObj.normalization.magnitude.max);
            userServerController.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj) {
              if (err) {
                console.log(chalkError("TFE | *** ERROR DB UPDATE USER languageAnalysis2"
                  + "\nTFE | " + err
                  + "\nTFE\n" + jsonPrint(m.obj)
                ));
              }
              else {
                if (statsObj.numLangAnalyzed % 50 === 0) {
                  console.log(chalkLog("TFE | UPDATE LANG ANLZD"
                    + " | LA ENTS: " + langEntityKeys.length
                    + " | USER>DB"
                    + " | C: " + updatedUserObj.category
                    + " | CA: " + updatedUserObj.categoryAuto
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | FLWg: " + updatedUserObj.following
                    + " | 3CF: " + updatedUserObj.threeceeFollowing
                    + " | LA: " + updatedUserObj.languageAnalyzed
                    + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                    + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                  ));
                }
              }
              langAnalyzerMessageRxQueueReadyFlag = true;
            });
          }
        break;
        case "QUEUE_FULL":
          console.log(chalkError("TFE | M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisBusyFlag = true;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;
        case "QUEUE_READY":
          console.log(chalkError("TFE | M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisBusyFlag = false;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;
        default:
          console.log(chalkError("TFE | *** UNKNOWN LANG_ANALIZE OP: " + m.op));
          langAnalyzerMessageRxQueueReadyFlag = true;
      }
    }
  }, interval);
}

function initUserDbUpdateQueueInterval(interval) {

  statsObj.status = "INIT USER DB UPDATE INTERVAL";

  console.log(chalkBlue("TFE | INIT USER DB UPDATE QUEUE INTERVAL: " + interval));

  clearInterval(userDbUpdateQueueInterval);

  userDbUpdateQueueInterval = setInterval(function userDbUpdateQueueInterval() {
    if (userDbUpdateQueueReadyFlag && (userDbUpdateQueue.length > 0)) {
      userDbUpdateQueueReadyFlag = false;
      let user = userDbUpdateQueue.shift();
      userServerController.findOneUser(user, {noInc: true, updateCountHistory: true}, function updateUserComplete(err, updatedUserObj) {
        userDbUpdateQueueReadyFlag = true;
        if (err) {
          console.log(chalkError("TFE | *** ERROR DB UPDATE USER - updateUserDb"
            + "\n" + err
            // + "\n" + jsonPrint(user)
          ));
          return;
        }
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
      });
    }
  }, interval);
}

function initRandomNetworkTreeChild() {

  statsObj.status = "INIT RNT CHILD";

  return new Promise(function(resolve, reject){

    if (randomNetworkTree === undefined) {

      console.log(chalkBlue("TFE | INIT RANDOM NETWORK TREE CHILD PROCESS"));

      randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`);

      randomNetworkTree.on("message", function(m) {
        switch (m.op) {
          case "IDLE":
            randomNetworkTreeBusyFlag = false;
            randomNetworkTreeReadyFlag = true;
            debug(chalkAlert("TFE | <== RNT RX"
              + " [" + randomNetworkTreeMessageRxQueue.length + "]"
              + " | " + m.op
            ));
          break;
          case "BUSY":
            randomNetworkTreeReadyFlag = false;
            randomNetworkTreeBusyFlag = m.cause;
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
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
        randomNetworkTreeActivateQueueSize = 0;
        statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
        randomNetworkTree = null;
        statsObj.status = "ERROR RNT";
        slackSendMessage(hostname + " | TFE | " + statsObj.status);
        console.log(chalkError("TFE | *** randomNetworkTree ERROR *** : " + err));
        console.log(chalkError("TFE | *** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
        if (!quitFlag) { quit({source: "RNT", error: err }); }
      });

      randomNetworkTree.on("exit", function(err) {
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
        randomNetworkTreeActivateQueueSize = 0;
        statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
        randomNetworkTree = null;
        console.log(chalkError("TFE | *** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
        if (!quitFlag) { quit({source: "RNT", error: err }); }
      });

      randomNetworkTree.on("close", function(code) {
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
        randomNetworkTreeActivateQueueSize = 0;
        statsObj.randomNetworkTreeActivateQueueSize = randomNetworkTreeActivateQueueSize;
        randomNetworkTree = null;
        console.log(chalkError("TFE | *** randomNetworkTree CLOSE *** | " + code));
        if (!quitFlag) { quit({source: "RNT", code: code }); }
      });

      randomNetworkTree.send({ op: "INIT", interval: RANDOM_NETWORK_TREE_INTERVAL }, function(err) {

        if (err) {
          console.log(chalkError("TFE | *** RNT SEND INIT ERROR: " + err));
          return reject(err);
        }

        console.log(chalkLog("TFE | RNT CHILD INITIALIZED"));

        resolve();
      });
    }
    else {
      randomNetworkTree.send({ op: "INIT", interval: RANDOM_NETWORK_TREE_INTERVAL }, function(err) {

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

function initLangAnalyzer(callback) {

  statsObj.status = "INIT LANG ANALYZER";


  console.log(chalkLog("TFE | INIT LANGUAGE ANALYZER CHILD PROCESS"));

  langAnalyzer = cp.fork(`languageAnalyzerChild.js`);

  langAnalyzer.on("message", function(m) {
    debug(chalkLog("TFE | <== LA RX"
      + " [" + langAnalyzerMessageRxQueue.length + "]"
      + " | " + m.op
    ));
    if (m.op === "LANG_TEST_FAIL") {
      console.log(chalkAlert(getTimeStamp() + " | LANG_TEST_FAIL"));
      if (m.err.code ===  8) {
        console.log(chalkError("TFE | *** LANG_TEST_FAIL"
          + " | LANGUAGE QUOTA"
          + " | " + m.err
        ));
        languageAnalysisBusyFlag = false;
      }
      else if (m.err.code ===  7) {
        console.log(chalkError("TFE | *** LANG_TEST_FAIL"
          + " | PERMISSION DENIED"
          + "\n" + m.err.details
        ));
        languageAnalysisBusyFlag = false;
      }
      else {
        console.log(chalkError("TFE | *** LANG_TEST_FAIL"
          + "\n" + m.err
        ));
        languageAnalysisBusyFlag = false;
        if (configuration.quitOnError) { quit("LANG_TEST_FAIL"); }
      }
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisBusyFlag = false;
      console.log(chalkTwitter("TFE | " + getTimeStamp() + " | LANG_TEST_PASS | LANG ANAL BUSY: " + languageAnalysisBusyFlag));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisBusyFlag = true;
      console.log(chalkError("TFE | *** LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisBusyFlag = false;
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      languageAnalysisBusyFlag = false;
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisBusyFlag = false;
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
      languageAnalysisBusyFlag = true;
      langAnalyzerMessageRxQueue.push(m);
    }
  });
  langAnalyzer.on("error", function(err) {
    console.log(chalkError("TFE | *** langAnalyzer ERROR ***\n" + jsonPrint(err)));
    statsObj.status = "ERROR LA";
    slackSendMessage(hostname + " | TFE | " + statsObj.status);
    if (!quitFlag) { quit({source: "LA", error: err }); }
  });
  langAnalyzer.on("exit", function(err) {
    console.log(chalkError("TFE | *** langAnalyzer EXIT ***\n" + jsonPrint(err)));
    if (!quitFlag) { quit({source: "LA", error: err }); }
  });
  langAnalyzer.on("close", function(code) {
    console.log(chalkError("TFE | *** langAnalyzer CLOSE *** | " + code));
    if (!quitFlag) { quit({source: "LA", code: code }); }
  });
  langAnalyzer.send({ op: "INIT", interval: LANGUAGE_ANALYZE_INTERVAL }, function() {
    if (callback !== undefined) { callback(); }
  });
}

setTimeout(async function(){

  try {

    let cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    console.log("TFE | " + chalkTwitter(configuration.processName + " STARTED " + getTimeStamp() ));

    statsObj.status = "START";

    slackSendMessage(hostname + " | TFE | " + statsObj.status);

    initSaveFileQueue(cnf);

    if (configuration.testMode) {
      configuration.fetchCount = TEST_MODE_FETCH_COUNT;
      configuration.networkDatabaseLoadLimit = TEST_MODE_NUM_NN;
      bestNetworkFolder = "/config/utility/" + hostname + "/test/neuralNetworks/best";
      localBestNetworkFolder = "/config/utility/" + hostname + "/test/neuralNetworks/local";
      configuration.fetchAllIntervalTime = TEST_MODE_FETCH_ALL_INTERVAL;

      console.log(chalkAlert("TFE | TEST MODE | GLOBAL BEST NETWORK FOLDER: " + bestNetworkFolder));
      console.log(chalkAlert("TFE | TEST MODE | LOCAL BEST NETWORK FOLDER:  " + localBestNetworkFolder));
      console.log(chalkAlert("TFE | TEST MODE | fetchAllIntervalTime: " + configuration.fetchAllIntervalTime));
    }
    if (configuration.loadNeuralNetworkID) {
      configuration.neuralNetworkFile = "neuralNetwork_" + configuration.loadNeuralNetworkID + ".json";
    }
    else {
      configuration.neuralNetworkFile = defaultNeuralNetworkFile;
    }

    console.log("TFE | " + chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(configuration)));

    try {
      await connectDb();
    }
    catch(err){
      dbConnectionReady = false;
      console.log(chalkError("TFE | *** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit("MONGO DB CONNECT ERROR");
    }

    dbConnectionReadyInterval = setInterval(async function() {

      if (dbConnectionReady) {

        clearInterval(dbConnectionReadyInterval);

        initProcessUserQueueInterval(PROCESS_USER_QUEUE_INTERVAL);
        initUserDbUpdateQueueInterval(USER_DB_UPDATE_QUEUE_INTERVAL);
        initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);
        initLangAnalyzerMessageRxQueueInterval(LANG_ANAL_MSG_Q_INTERVAL);

        initLangAnalyzer();
        await initUnfollowableUserSet();
        await initTwitterUsers();
        initFsmTickInterval(FSM_TICK_INTERVAL);
        await initActivateNetworkQueueInterval(ACTIVATE_NETWORK_QUEUE_INTERVAL);
        initRandomNetworkTreeChild();

        neuralNetworkInitialized = true;
        fsm.fsm_resetEnd();
        fsm.fsm_init();
        fetchAllIntervalReady = true;
        
      }
      else {
        console.log(chalkLog("TFE | ... WAIT DB CONNECTED ..."));
      }
    }, 1000);

  }
  catch(err){
    console.log(chalkError("*TFE | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      console.log("TFE | err.status: " + err.status);
      quit();
    }
  }
}, 1000);


