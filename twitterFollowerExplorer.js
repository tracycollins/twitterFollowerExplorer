 /*jslint node: true */
"use strict";

const DEFAULT_MIN_INPUTS_GENERATED = 400 ;
const DEFAULT_MAX_INPUTS_GENERATED = 750 ;

const MIN_TOTAL_MIN = 10;
const MAX_TOTAL_MIN = 100;

const MIN_DOMINANT_MIN = 0.3;
const MAX_DOMINANT_MIN = 1.0;

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN = 5;
const DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN = 0.4;

const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;
const OFFLINE_MODE = false;
const ONLINE_MODE = false;

const RANDOM_NETWORK_TREE_MSG_Q_INTERVAL = 20; // ms

const TEST_TWITTER_FETCH_FRIENDS_INTERVAL = 10000;

const TEST_DROPBOX_NN_LOAD = 20;

const DEFAULT_MIN_SUCCESS_RATE = 80;
const TFE_NUM_RANDOM_NETWORKS = 100;

// will use histograms to determine neural net inputs
// for emoji, hashtags, mentions, words
const MIN_HISTOGRAM_KEYS = 50;
const MAX_HISTOGRAM_KEYS = 100;

const TEST_MODE_TOTAL_FETCH = 20;  // total twitter user fetch count
const DEFAULT_FETCH_COUNT = 200;  // per request twitter user fetch count
const TEST_MODE_FETCH_COUNT = 10;  // per request twitter user fetch count

const bestRuntimeNetworkFileName = "bestRuntimeNetwork.json";
let bestRuntimeNetworkId = false;
let loadedNetworksFlag = false;
let networksSentFlag = false;
let currentBestNetworkId = false;

const histogramParser = require("@threeceelabs/histogram-parser");

const randomFloat = require("random-float");
const randomInt = require("random-int");
const moment = require("moment");

const table = require("text-table");
const arrayUnique = require("array-unique");
const fs = require("fs");

let socket;
let socketKeepAliveInterval;
let saveFileQueueInterval;
let saveFileBusy = false;

let prevBestNetworkId = "";

const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const chalk = require("chalk");
const chalkConnect = chalk.green;
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkBlackBold = chalk.bold.black;
const chalkTwitterBold = chalk.bold.blue;
const chalkRed = chalk.red;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const hashtagModel = require("@threeceelabs/mongoose-twitter/models/hashtag.server.model");
const mediaModel = require("@threeceelabs/mongoose-twitter/models/media.server.model");
const placeModel = require("@threeceelabs/mongoose-twitter/models/place.server.model");
const tweetModel = require("@threeceelabs/mongoose-twitter/models/tweet.server.model");
const urlModel = require("@threeceelabs/mongoose-twitter/models/url.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");
const wordModel = require("@threeceelabs/mongoose-twitter/models/word.server.model");

let Hashtag;
let Media;
let Place;
let Tweet;
let Url;
let User;
let Word;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");
const dbConnection = wordAssoDb();

dbConnection.on("error", console.error.bind(console, "connection error:"));
dbConnection.once("open", function() {
  console.log("CONNECT: TWEET SERVER MONGOOSE default connection open");
  Hashtag = mongoose.model("Hashtag", hashtagModel.HashtagSchema);
  Media = mongoose.model("Media", mediaModel.MediaSchema);
  Place = mongoose.model("Place", placeModel.PlaceSchema);
  Tweet = mongoose.model("Tweet", tweetModel.TweetSchema);
  Url = mongoose.model("Url", urlModel.UrlSchema);
  User = mongoose.model("User", userModel.UserSchema);
  Word = mongoose.model("Word", wordModel.WordSchema);
});

const hashtagServer = require("@threeceelabs/hashtag-server-controller");
const mediaServer = require("@threeceelabs/media-server-controller");
const placeServer = require("@threeceelabs/place-server-controller");
const urlServer = require("@threeceelabs/url-server-controller");
const userServer = require("@threeceelabs/user-server-controller");
const wordServer = require("@threeceelabs/word-server-controller");

const twitterTextParser = require("@threeceelabs/twitter-text-parser");
const twitterImageParser = require("@threeceelabs/twitter-image-parser");

let globalHistograms = {};

let currentBestNetwork;
let previousRandomNetworksHashMap = {};
let availableNeuralNetHashMap = {};


const LANGUAGE_ANALYZE_INTERVAL = 1000;
const RANDOM_NETWORK_TREE_INTERVAL = 50;


const TWITTER_DEFAULT_USER = "altthreecee00";

let saveFileQueue = [];

const keywordCategories = ["left", "right", "neutral", "positive", "negative", "uncategorized"];

const inputTypes = ["emoji", "hashtags", "mentions", "urls", "words", "images"];
inputTypes.sort();

let inputArrays = {};

let checkRateLimitInterval;
let checkRateLimitIntervalTime = ONE_MINUTE;

const DEFAULT_TWITTER_FETCH_FRIENDS_INTERVAL = 2 * ONE_MINUTE;
let fetchTwitterFriendsIntervalTime = DEFAULT_TWITTER_FETCH_FRIENDS_INTERVAL;

let stdin;
let langAnalyzerIdle = false;
let abortCursor = false;
let nextUser = false;
let classifiedUserHashmapReadyFlag = false;

let updateNetworkFetchFriendsReadyFlag = true;

let neuralNetworkInitialized = false;
let currentTwitterUser ;
let currentTwitterUserIndex = 0;

let TFE_USER_DB_CRAWL = false;

const Stately = require("stately.js");

let fsmPreviousState = "IDLE";
let fsmPreviousPauseState;

function getPreviousPauseState() {
  return fsmPreviousPauseState;
}

function reporter(event, oldState, newState) {
  if (newState === "PAUSE_RATE_LIMIT") {
    fsmPreviousPauseState = oldState;
  }
  fsmPreviousState = oldState;
  console.log(chalkAlert("--------------------------------------------------------\n"
    + "<< FSM >>"
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n--------------------------------------------------------"
  ));
}

const fsmStates = {
  "IDLE":{
    onEnter: reporter,
    "fsm_initStart": "INIT"
  },
  "RESET":{
    onEnter: reporter,
    "fsm_resetEnd": "IDLE"
  },
  "ERROR":{
    onEnter: reporter,
    "fsm_reset": "RESET"
  },
  "INIT":{
    onEnter: reporter,
    "fsm_initComplete": "READY",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_reset": "RESET"
  },
  "READY":{
    onEnter: reporter,
    "fsm_reset": "RESET",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchAllStart": "FETCH_ALL"
  },
  "FETCH_ALL":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      if (event === "fsm_fetchUserEnd") {
        console.log("FETCH_ALL"
         + " | " + event
         + " | currentTwitterUser: @" + currentTwitterUser
        );

        updateGlobalHistograms();

        initNextTwitterUser(function(err, nextTwitterUser){
          fsm.fsm_fetchUserStart();
        });
      }
    },
    "fsm_reset": "RESET",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchAllEnd": "READY", 
    "fsm_fetchUserStart": "FETCH_USER"
  },
  "FETCH_USER":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      updateNetworkFetchFriends(function(err, results){});
      return this.FETCH_USER;
    },
    "fsm_reset": "RESET",
    "fsm_fetchUserContinue": "FETCH_USER",
    "fsm_fetchUserEnd": "FETCH_ALL",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT"
  },
  "PAUSE_FETCH_USER":{
    onEnter: reporter,
    "fsm_reset": "RESET",
    "fsm_rateLimitEnd": "FETCH_USER",
    "fsm_fetchUserEnd": "FETCH_ALL"
  },
  "PAUSE_RATE_LIMIT":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      console.log("PAUSE_RATE_LIMIT | PREV STATE: " + oldState);
    },
    "fsm_reset": "RESET",
    "fsm_rateLimitEnd": function(){
      return getPreviousPauseState();
    },
    "fsm_fetchUserEnd": "FETCH_ALL"
  }
};

const fsm = Stately.machine(fsmStates);


const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tfe";
const Slack = require("slack-node");

require("isomorphic-fetch");
// const Dropbox = require("dropbox").Dropbox;
const Dropbox = require("./js/dropbox").Dropbox;

const os = require("os");
const util = require("util");
const arrayNormalize = require("array-normalize");
const defaults = require("object.defaults/immutable");
const pick = require("object.pick");
const omit = require("object.omit");
const deepcopy = require("deep-copy");
const randomItem = require("random-item");

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

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

const jsUcfirst = function(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
};


let statsObj = {};
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.heartbeatsReceived = 0;

const TFE_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.fetchUsersComplete = false;
statsObj.runId = TFE_RUN_ID;

statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());

statsObj.bestNetworks = {};
statsObj.totalInputs = 0;

statsObj.numNetworksLoaded = 0;
statsObj.numNetworksUpdated = 0;

statsObj.histograms = {};

statsObj.normalization = {};
statsObj.normalization.score = {};
statsObj.normalization.magnitude = {};

statsObj.normalization.score.min = 1.0;
statsObj.normalization.score.max = -1.0;
statsObj.normalization.magnitude.min = 0;
statsObj.normalization.magnitude.max = -Infinity;

statsObj.numLangAnalyzed = 0;

inputTypes.forEach(function(type){

  statsObj.histograms[type] = {};

});

let configuration = {};

configuration.twitterUsers = ["altthreecee00", "altthreecee02", "ninjathreecee"];

configuration.minInputsGenerated = DEFAULT_MIN_INPUTS_GENERATED;
configuration.maxInputsGenerated = DEFAULT_MAX_INPUTS_GENERATED;

configuration.histogramParseTotalMin = DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;
configuration.histogramParseDominantMin = DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN;

configuration.saveFileQueueInterval = 1000;
configuration.testMode = false;
configuration.minSuccessRate = DEFAULT_MIN_SUCCESS_RATE;
configuration.fetchCount = configuration.testMode ? TEST_MODE_FETCH_COUNT :  DEFAULT_FETCH_COUNT;
configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.enableLanguageAnalysis = true;
configuration.forceLanguageAnalysis = false;
configuration.quitOnComplete = true;

const intervalometer = require("intervalometer");
let timerIntervalometer = intervalometer.timerIntervalometer;

let langAnalyzer;
let waitLanguageAnalysisReadyInterval;
let langAnalyzerMessageRxQueueInterval;
let langAnalyzerMessageRxQueueReadyFlag = true;
let languageAnalysisReadyFlag = false;
let langAnalyzerMessageRxQueue = [];

let randomNetworkTree;
let randomNetworkTreeMessageRxQueueInterval;
let randomNetworkTreeMessageRxQueueReadyFlag = true;
let randomNetworkTreeReadyFlag = false;
let randomNetworkTreeBusyFlag = false;
let randomNetworkTreeMessageRxQueue = [];
let randomNetworksObj = {};

let userDbUpdateQueueInterval;
let userDbUpdateQueueReadyFlag = true;
let userDbUpdateQueue = [];

let network;
// const neataptic = require("neataptic");
const neataptic = require("./js/neataptic");
const cp = require("child_process");

let histograms = {};
histograms.words = {};
histograms.urls = {};
histograms.hashtags = {};
histograms.mentions = {};
histograms.emoji = {};
histograms.images = {};

const Twit = require("twit");
const async = require("async");
const sortOn = require("sort-on");

const EventEmitter2 = require("eventemitter2").EventEmitter2;

const debug = require("debug")("tfe");

let statsUpdateInterval;

let autoClassifiedUserHashmap = {};
let classifiedUserHashmap = {};
let twitterUserHashMap = {};

const HashMap = require("hashmap").HashMap;

let bestNetworkHashMap = new HashMap();

let defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;

let processFriendsReady = true;

const runEnableArgs = {};
runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;
runEnableArgs.classifiedUserHashmapReadyFlag = classifiedUserHashmapReadyFlag;

function runEnable(displayArgs) {

  if (randomNetworkTree !== undefined) { 
    randomNetworkTree.send({op: "GET_BUSY"});
  }
  else {
    randomNetworkTreeReadyFlag = true;
    randomNetworkTreeMessageRxQueueReadyFlag = true;
  }

  // runEnableArgs.processFriendsReady = processFriendsReady;
  runEnableArgs.randomNetworkTreeReadyFlag = randomNetworkTreeReadyFlag;
  runEnableArgs.userDbUpdateQueueReadyFlag = userDbUpdateQueueReadyFlag;
  runEnableArgs.randomNetworkTreeMessageRxQueueReadyFlag = randomNetworkTreeMessageRxQueueReadyFlag;
  runEnableArgs.langAnalyzerMessageRxQueueReadyFlag = langAnalyzerMessageRxQueueReadyFlag;
  runEnableArgs.classifiedUserHashmapReadyFlag = classifiedUserHashmapReadyFlag;

  const runEnableKeys = Object.keys(runEnableArgs);

  if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }

  runEnableKeys.forEach(function(key){
    if (displayArgs) { console.log(chalkInfo("runEnable | " + key + ": " + runEnableArgs[key])); }
    if (!runEnableArgs[key]) {
      if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }
      return false;
    }
  });

  if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }

  return true;
}

function indexOfMax (arr, callback) {
  if (arr.length === 0) {
    console.log(chalkAlert("indexOfMax: 0 LENG ARRAY: -1"));
    return callback(-1);
  }
  if ((arr[0] === arr[1]) && (arr[1] === arr[2])){
    debug(chalkAlert("indexOfMax: ALL EQUAL: " + arr[0]));
    return callback(-1);
  }

  debug("B4 ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));
  arrayNormalize(arr);
  debug("AF ARR: " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2));

  let max = arr[0];
  let maxIndex = 0;

  async.eachOfSeries(arr, function(val, index, cb){
    if (val > max) {
      maxIndex = index;
      max = val;
    }
    async.setImmediate(function() { cb(); });
  }, function(){
    debug(chalk.blue("indexOfMax: " + maxIndex 
      + " | " + arr[maxIndex].toFixed(2)
      + " | " + arr[0].toFixed(2) + " - " + arr[1].toFixed(2) + " - " + arr[2].toFixed(2)
    ));
    callback(maxIndex) ; 
  });
}

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

const USER_ID = "tfe_" + hostname;
const SCREEN_NAME = "tfe_" + hostname;

let userObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  url: "https://www.twitter.com", 
  screenName: SCREEN_NAME, 
  namespace: "util", 
  type: "util", 
  mode: "muxstream",
  timeStamp: moment().valueOf(),
  tags: {},
  stats: {}
} ;

const cla = require("command-line-args");
const numRandomNetworks = { name: "numRandomNetworks", alias: "n", type: Number};
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const userDbCrawl = { name: "userDbCrawl", alias: "C", type: Boolean};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};
const loadNeuralNetworkID = { name: "loadNeuralNetworkID", alias: "N", type: Number };
const targetServer = { name: "targetServer", alias: "t", type: String};

const optionDefinitions = [enableStdin, targetServer, quitOnError, quitOnComplete, loadNeuralNetworkID, userDbCrawl, testMode];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer === "LOCAL"){
  commandLineConfig.targetServer = "http://127.0.0.1:9997/util";
}
if (commandLineConfig.targetServer === "REMOTE"){
  commandLineConfig.targetServer = "http://word.threeceelabs.com/util";
}

process.title = "node_twitterFollowerExplorer";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");


let fetchTwitterFriendsIntervalometer;

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
  if (randomNetworkTree !== undefined) { randomNetworkTree.kill("SIGINT"); }
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(langAnalyzerMessageRxQueueInterval);
    clearInterval(randomNetworkTreeMessageRxQueueInterval);
    clearInterval(checkRateLimitInterval);
    clearInterval(statsUpdateInterval);

    clearInterval(waitLanguageAnalysisReadyInterval);

    fetchTwitterFriendsIntervalometer.stop();

    setTimeout(function() {
      console.log("QUITTING twitterFollowerExplorer");
      process.exit(0);
    }, 300);

  }
});

const configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20
});

configEvents.on("newListener", function(data){
  console.log("*** NEW CONFIG EVENT LISTENER: " + data);
});

statsObj.network = {};
statsObj.network.networkId = "";
statsObj.network.successRate = 0;

statsObj.classification = {};
statsObj.classification.auto = {};
statsObj.classification.manual = {};

statsObj.classification.manual.left = 0;
statsObj.classification.manual.right = 0;
statsObj.classification.manual.positive = 0;
statsObj.classification.manual.negative = 0;
statsObj.classification.manual.neutral = 0;
statsObj.classification.manual.other = 0;
statsObj.classification.manual.none = 0;

statsObj.classification.auto.left = 0;
statsObj.classification.auto.right = 0;
statsObj.classification.auto.positive = 0;
statsObj.classification.auto.negative = 0;
statsObj.classification.auto.neutral = 0;
statsObj.classification.auto.other = 0;
statsObj.classification.auto.none = 0;

statsObj.users = {};
statsObj.users.classifiedAuto = 0;
statsObj.users.classified = 0;
statsObj.users.grandTotalFriendsFetched = 0;

statsObj.user = {};
statsObj.user.ninjathreecee = {};
statsObj.user.altthreecee00 = {};

statsObj.user.ninjathreecee.friendsProcessed = 0;
statsObj.user.ninjathreecee.percentProcessed = 0;
statsObj.user.altthreecee00.friendsProcessed = 0;
statsObj.user.altthreecee00.percentProcessed = 0;

statsObj.analyzer = {};
statsObj.analyzer.total = 0;
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.errors = 0;

statsObj.totalTwitterFriends = 0;

statsObj.twitterErrors = 0;


let slack = new Slack(slackOAuthAccessToken);
function slackPostMessage(channel, text, callback){

  debug(chalkInfo("SLACK POST: " + text));

  slack.api("chat.postMessage", {
    text: text,
    channel: channel
  }, function(err, response){
    if (err){
      console.error(chalkError("*** SLACK POST MESSAGE ERROR\n" + err));
    }
    else {
      debug(response);
    }
    if (callback !== undefined) { callback(err, response); }
  });
}

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || "twitterFollowerExplorerConfig.json";
const DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || "twitterFollowerExplorerStats.json";

let dropboxConfigHostFolder = "/config/utility/" + hostname;
let dropboxConfigDefaultFolder = "/config/utility/default";

let dropboxConfigFile = hostname + "_" + DROPBOX_TFE_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/followerExplorer";
let statsFile = DROPBOX_TFE_STATS_FILE;

configuration.neuralNetworkFolder = dropboxConfigHostFolder + "/neuralNetworks";
configuration.neuralNetworkFile = "";

const bestNetworkFolder = "/config/utility/best/neuralNetworks";
const localBestNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/best";
const localNetworkFolder = "/config/utility/" + hostname + "/neuralNetworks/local";

const defaultHistogramsFolder = "/config/utility/default/histograms";
const localHistogramsFolder = "/config/utility/" + hostname + "/histograms";

const localInputsFolder = dropboxConfigHostFolder + "/inputs";
const defaultInputsFolder = dropboxConfigDefaultFolder + "/inputs";

console.log("DROPBOX_TFE_CONFIG_FILE: " + DROPBOX_TFE_CONFIG_FILE);
console.log("DROPBOX_TFE_STATS_FILE : " + DROPBOX_TFE_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

const defaultClassifiedUsersFolder = dropboxConfigDefaultFolder;
const classifiedUsersFolder = dropboxConfigHostFolder + "/classifiedUsers";
const classifiedUsersDefaultFile = "classifiedUsers.json";

function updateGlobalHistograms(callback){

  twitterTextParser.getGlobalHistograms(function(hists){

    twitterImageParser.getGlobalHistograms(function(imageHists){

      hists.images = {};
      hists.images = deepcopy(imageHists.images);

      globalHistograms = {};
      globalHistograms = deepcopy(hists);

      async.each(Object.keys(hists), function(histogramName, cb) {

        const currentHistogram = hists[histogramName];

        const keys = Object.keys(currentHistogram);
        let valA;
        let valB;

        const sortedKeys = keys.sort(function(a,b){
          if (currentHistogram[a] !== null && typeof currentHistogram[a] === "object") {
            valA = currentHistogram[a].total;
            valB = currentHistogram[b].total;
            return valB - valA;

          }
          else {
            valA = currentHistogram[a];
            valB = currentHistogram[b];
            return valB - valA;
          }
        });

        debug(chalkInfo("\nHIST " + histogramName.toUpperCase()
          + " | " + keys.length + " ----------"
        ));

        sortedKeys.forEach(function(k, i){
          if ((keys.length < MAX_HISTOGRAM_KEYS) || (currentHistogram[k] >= MIN_HISTOGRAM_KEYS) || (i < MAX_HISTOGRAM_KEYS)) { 

            if (currentHistogram[k] !== null && typeof currentHistogram[k] === "object") {

              statsObj.histograms[histogramName][k] = {};
              statsObj.histograms[histogramName][k] = currentHistogram[k];

              if (i < 10) {
                debug(currentHistogram[k].total
                  + " | L: " + currentHistogram[k].left
                  + " | R: " + currentHistogram[k].right
                  + " | N: " + currentHistogram[k].neutral
                  + " | +: " + currentHistogram[k].positive
                  + " | -: " + currentHistogram[k].negative
                  + " | U: " + currentHistogram[k].uncategorized
                  + " || " + k
                );
              }
            }
            else {

              statsObj.histograms[histogramName][k] = currentHistogram[k];

              debug(currentHistogram[k] + " | " + k);
            }
          }
        });

        cb();

      }, function(){
        if (callback !== undefined) { callback(histograms); }
      });

    });

  });
}

function showStats(options){
  runEnable();
  if (langAnalyzer !== undefined) {
    langAnalyzer.send({op: "STATS", options: options});
  }
  if (options) {
    updateGlobalHistograms(function(){
      console.log("STATS\n" + jsonPrint(omit(statsObj, ["histograms"])));
    });
  }
  else {

    updateGlobalHistograms();

    if (statsObj.user[currentTwitterUser] !== undefined) {

      statsObj.user[currentTwitterUser].percentProcessed = 100*statsObj.user[currentTwitterUser].friendsProcessed/statsObj.user[currentTwitterUser].friendsCount;
      statsObj.user[currentTwitterUser].friendsProcessElapsed = moment().diff(statsObj.user[currentTwitterUser].friendsProcessStart);

      console.log(chalkLog("- FE S"
        + " | " + currentTwitterUser
        + " | E: " + statsObj.elapsed
        + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
        + " | FSM: " + fsm.getMachineState()
        + " | FRNDs PRCSSD: " + statsObj.user[currentTwitterUser].friendsProcessed + "/" + statsObj.user[currentTwitterUser].friendsCount
        + " (" + statsObj.user[currentTwitterUser].percentProcessed.toFixed(2) + "%)"
        + " | ACL Us: " + Object.keys(autoClassifiedUserHashmap).length
        + " | CL Us: " + Object.keys(classifiedUserHashmap).length
        + " | NN " + statsObj.network.networkId
        // + " - " + statsObj.network.successRate.toFixed(2) + "%"
        + " || " + statsObj.analyzer.analyzed + " ANLs"
        + " | " + statsObj.analyzer.skipped + " SKPs"
        + " | " + statsObj.analyzer.total + " TOT"
      ));
    }
    else {
      console.log(chalkLog("- FE S"
        + " | E: " + statsObj.elapsed
        + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
        + " | FSM: " + fsm.getMachineState()
      ));
    }
  }
}

function saveHistograms(callback){

  const hId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
  const hFile = "histograms_" + hId + ".json"; 
  const inFile = hId + ".json"; 

  let histObj = {};
  histObj.histogramsId = hId;
  histObj.histograms = {};
  histObj.histograms = statsObj.histograms;

  let folder = (hostname === "google") ? defaultHistogramsFolder : localHistogramsFolder;

  saveFileQueue.push({folder: folder, file: hFile, obj: histObj});

  const genInParams = {
    histogramsObj: { 
      histogramsId: hId, 
      histograms: globalHistograms
    },
    histogramParseDominantMin: configuration.histogramParseDominantMin,
    histogramParseTotalMin: configuration.histogramParseTotalMin
  };

  let inFolder = (hostname === "google") ? defaultInputsFolder : localInputsFolder;

  if (configuration.testMode) { 
    inFolder = inFolder + "_test";
  }

  generateInputSets(genInParams, function(err, inputsObj){
    if (err) {
      console.log(chalkError("ERROR | NOT SAVING INPUTS FILE: " + inFolder + "/" + inFile));
      // saveFileQueue.push({folder: inFolder, file: inFile, obj: inputsObj});
    }
    else {
      console.log(chalkAlert("... SAVING INPUTS FILE: " + inFolder + "/" + inFile));
      saveFileQueue.push({folder: inFolder, file: inFile, obj: inputsObj});
    }
    if (callback !== undefined) { callback(null, hId); }
  });

}

let quitWaitInterval;

function quit(cause){

  fsm.fsm_reset();

  if (randomNetworkTree !== undefined) { randomNetworkTree.send({op: "STATS"}); }

  // saveHistograms();

  console.log( "\n... QUITTING ..." );

  if (cause) {
    console.log( "CAUSE: " + cause );
  }

  if (fetchTwitterFriendsIntervalometer !== undefined) { fetchTwitterFriendsIntervalometer.stop(); }

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy 
      && !randomNetworkTreeBusyFlag
      && (saveFileQueue.length === 0)
      && (langAnalyzerMessageRxQueue.length === 0)
      && (randomNetworkTreeMessageRxQueue.length === 0)
      && (userDbUpdateQueue.length === 0)
      && randomNetworkTreeMessageRxQueueReadyFlag
      && randomNetworkTreeReadyFlag
      && languageAnalysisReadyFlag
      && userDbUpdateQueueReadyFlag
      ){

      clearInterval(waitLanguageAnalysisReadyInterval);
      clearInterval(statsUpdateInterval);
      clearInterval(checkRateLimitInterval);
      clearInterval(userDbUpdateQueueInterval);
      clearInterval(quitWaitInterval);

      console.log(chalkAlert("ALL PROCESSES COMPLETE ... QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
       + " | RNT BUSY: " + randomNetworkTreeBusyFlag
       + " | RNT READY: " + randomNetworkTreeReadyFlag
       + " | RNT Q: " + randomNetworkTreeMessageRxQueue.length
       + " | LA Q: " + langAnalyzerMessageRxQueue.length
       + " | USR DB Q: " + userDbUpdateQueue.length
      ));

      setTimeout(function(){
        process.exit();      
      }, 5000);
    }
    else {
      if (randomNetworkTree !== undefined) { randomNetworkTree.send({op: "STATS"}); }
      console.log(chalkAlert("... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
       + " | RNT BUSY: " + randomNetworkTreeBusyFlag
       + " | RNT READY: " + randomNetworkTreeReadyFlag
       + " | RNT Q: " + randomNetworkTreeMessageRxQueue.length
       + " | LA Q: " + langAnalyzerMessageRxQueue.length
       + " | USR DB Q: " + userDbUpdateQueue.length
      ));
    }

  }, 1000);
}

process.on( "SIGINT", function() {
  quit("SIGINT");
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

function saveFile (params, callback){

  if (OFFLINE_MODE) {
    if (callback !== undefined) { 
      return(callback(null, null));
    }
    return;
  }

  const fullPath = params.folder + "/" + params.file;

  debug(chalkInfo("LOAD FOLDER " + params.folder));
  debug(chalkInfo("LOAD FILE " + params.file));
  debug(chalkInfo("FULL PATH " + fullPath));

  let options = {};

  options.contents = JSON.stringify(params.obj, null, 2);
  options.path = fullPath;
  options.mode = params.mode || "overwrite";
  options.autorename = params.autorename || false;


  const dbFileUpload = function () {
    dropboxClient.filesUpload(options)
    .then(function(){
      debug(chalkLog("SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        // const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          // + " | ERROR\n" + jsonPrint(error)
          + " | ERROR: " + error
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
  };

  if (options.mode === "add") {

    dropboxClient.filesListFolder({path: params.folder})
    .then(function(response){

      debug(chalkLog("DROPBOX LIST FOLDER"
        + " | " + options.path
        + " | " + jsonPrint(response)
      ));

      let fileExits = false;

      async.eachSeries(response.entries, function(entry, cb){

        console.log(chalkInfo("DROPBOX FILE"
          + " | " + params.folder
          // + " | " + getTimeStamp(entry.client_modified)
          + " | " + entry.name
          // + " | " + entry.content_hash
          // + "\n" + jsonPrint(entry)
        ));

        if (entry.name === params.file) {
          fileExits = true;
        }

        cb();

      }, function(err){
        if (err) {
          console.log(chalkError("*** ERROR DROPBOX SAVE FILE: " + err));
          if (callback !== undefined) { 
            return(callback(err, null));
          }
          return;
        }
        if (fileExits) {
          console.log(chalkAlert("... DROPBOX FILE EXISTS ... SKIP SAVE | " + fullPath));
          if (callback !== undefined) { callback(err, null); }
        }
        else {
          console.log(chalkAlert("... DROPBOX DOES NOT FILE EXIST ... SAVING | " + fullPath));
          dbFileUpload();
        }
      });
    })
    .catch(function(err){
      console.log(chalkError("saveFile *** DROPBOX FILES LIST FOLDER ERROR ", err));
      if (callback !== undefined) { callback(err, null); }
    });
  }
  else {
    dbFileUpload();
  }
}

function initSaveFileQueue(cnf){

  console.log(chalkBlue("TFE | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
        if (err) {
          console.log(chalkError("TFE | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("TFE | SAVED FILE | " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });
    }

  }, cnf.saveFileQueueInterval);
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  let fullPath = path + "/" + file;

  if (OFFLINE_MODE) {
    if (hostname === "mbp2") {
      fullPath = "/Users/tc/Dropbox/Apps/wordAssociation" + path + "/" + file;
      debug(chalkInfo("OFFLINE_MODE: FULL PATH " + fullPath));
    }
    fs.readFile(fullPath, "utf8", function(err, data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE"
        + " | " + fullPath
        // + "\n" + jsonPrint(data)
      ));

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(data);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("TFE | JSON PARSE ERROR: " + e));
          callback("JSON PARSE ERROR", null);
        }
      }
      else {
        callback(null, null);
      }
    });
   }
  else {
    dropboxClient.filesDownload({path: fullPath})
    .then(function(data) {
      debug(chalkLog(getTimeStamp()
        + " | LOADING FILE FROM DROPBOX FILE: " + fullPath
      ));

      if (file.match(/\.json$/gi)) {
        let payload = data.fileBinary;
        debug(payload);

        try {
          let fileObj = JSON.parse(payload);
          callback(null, fileObj);
        }
        catch(e){
          console.trace(chalkError("TFE | JSON PARSE ERROR: " + jsonPrint(e)));
          console.trace(chalkError("TFE | JSON PARSE ERROR: " + e));
          callback("JSON PARSE ERROR", null);
        }
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {
      console.log(chalkError("TFE | DROPBOX loadFile ERROR: " + fullPath + "\n" + error));
      console.log(chalkError("TFE | !!! DROPBOX READ " + fullPath + " ERROR"));
      console.log(chalkError("TFE | " + jsonPrint(error.error)));

      if (error.status === 404) {
        console.error(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.status === 409) {
        console.error(chalkError("TFE | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"));
        return(callback(error, null));
      }
      if (error.status === 0) {
        console.error(chalkError("TFE | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
  }
}

function sendKeepAlive(userObj, callback){
  
  if (statsObj.userAuthenticated && statsObj.serverConnected){
    debug(chalkLog("TX KEEPALIVE"
      + " | " + userObj.userId
      + " | " + moment().format(compactDateTimeFormat)
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    callback(null, null);
  }
  else {
    console.log(chalkError("!!!! CANNOT TX KEEPALIVE"
      + " | " + userObj.userId
      + " | CONNECTED: " + statsObj.serverConnected
      + " | READY ACK: " + statsObj.userAuthenticated
      + " | " + moment().format(compactDateTimeFormat)
    ));
    callback("ERROR", null);
  }
}

function initKeepalive(interval){

  clearInterval(socketKeepAliveInterval);

  console.log(chalkConnect("START KEEPALIVE"
    // + " | USER ID: " + userId
    + " | READY ACK: " + statsObj.userAuthenticated
    + " | SERVER CONNECTED: " + statsObj.serverConnected
    + " | INTERVAL: " + interval + " ms"
  ));

  socketKeepAliveInterval = setInterval(function(){ // TX KEEPALIVE

    userObj.stats.tweetsPerMinute = statsObj.tweetsPerMinute;
    userObj.stats.tweetsPerSecond = statsObj.tweetsPerSecond;

    sendKeepAlive(userObj, function(err, results){
      if (err) {
        console.log(chalkError("KEEPALIVE ERROR: " + err));
      }
      else if (results){
        console.log(chalkConnect("KEEPALIVE"
          + " | " + moment().format(compactDateTimeFormat)
        ));
      }
    });
  }, interval);
}

function reset(cause, callback){

  console.log(chalkAlert("\nRESET | CAUSE: " + cause + "\n"));

  clearInterval(socketKeepAliveInterval);

  if (callback !== undefined) { callback(); } 
}

function initSocket(cnf, callback){

  if (OFFLINE_MODE) {
    console.log(chalkError("*** OFFLINE MODE *** "));
    return(callback(null, null));
  }

  console.log(chalkLog("INIT SOCKET"
    + " | " + cnf.targetServer
    + " | " + jsonPrint(userObj)
  ));

  socket = require("socket.io-client")(cnf.targetServer, { reconnection: true });

  socket.on("connect", function(){

    console.log(chalkConnect("SOCKET CONNECT | " + socket.id + " ... AUTHENTICATE ..."));

    socket.on("unauthorized", function(err){
      console.log(chalkError("*** AUTHENTICATION ERROR: ", err.message));
    });

    socket.emit("authentication", { namespace: "util", userId: userObj.userId, password: "0123456789" });

    socket.on("authenticated", function() {

      console.log("AUTHENTICATED | " + socket.id);

      reset("connect", function(){

        statsObj.socketId = socket.id;

        console.log(chalkConnect( "CONNECTED TO HOST" 
          + " | SERVER: " + cnf.targetServer 
          + " | ID: " + socket.id 
          ));

        // wait for server to init before tx USER_READY

          userObj.timeStamp = moment().valueOf();

          console.log(chalkInfo(socket.id 
            + " | TX USER_READY"
            + " | " + moment().format(compactDateTimeFormat)
            + " | " + userObj.userId
            + " | " + userObj.url
            + " | " + userObj.screenName
            + " | " + userObj.type
            + " | " + userObj.mode
            + "\nTAGS\n" + jsonPrint(userObj.tags)
          ));

          statsObj.serverConnected = true ;
          statsObj.userAuthenticated = true ;

          // if (userId === userObj.tags.entity) {
            initKeepalive(cnf.keepaliveInterval);
          // }

          // initTwitterStreamQueueInterval(10);
          // sendUserReady(userObj);
          // socket.emit("USER_READY", userObj); 
          
        // }, 1*ONE_SECOND);
      });

    });

    socket.on("disconnect", function(){
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
      console.log(chalkConnect(moment().format(compactDateTimeFormat)
        + " | SOCKET DISCONNECT: " + socket.id
      ));
      // reset("disconnect");
    });
  });

  socket.on("reconnect", function(){
    console.error(chalkInfo("RECONNECT" 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + socket.id
    ));
  });

  socket.on("USER_READY_ACK", function(userId) {

    statsObj.userAuthenticated = true ;

    debug(chalkInfo("RX USER_READY_ACK MESSAGE"
      + " | " + socket.id
      + " | USER ID: " + userId
      + " | " + moment().format(compactDateTimeFormat)
    ));

    if (userId === userObj.tags.entity) {
      initKeepalive(cnf.keepaliveInterval);
    }
  });

  socket.on("error", function(error){
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    socket.disconnect();
    console.error(chalkError(moment().format(compactDateTimeFormat) 
      + " | *** SOCKET ERROR"
      + " | " + socket.id
      + " | " + error
    ));
    reset("error");
  });

  socket.on("connect_error", function(err){
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    console.error(chalkError("*** CONNECT ERROR " 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
      // + "\n" + jsonPrint(err)
    ));
    reset("connect_error");
  });

  socket.on("reconnect_error", function(err){
    statsObj.userAuthenticated = false ;
    statsObj.serverConnected = false ;
    console.error(chalkError("*** RECONNECT ERROR " 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
      // + "\n" + jsonPrint(err)
    ));
    // reset("reconnect_error");
  });

  socket.on("SESSION_ABORT", function(sessionId){
    console.log(chalkAlert("@@@@@ RX SESSION_ABORT | " + sessionId));
    if (sessionId === statsObj.socketId){
      console.error(chalkAlert("***** RX SESSION_ABORT HIT | " + sessionId));
      console.log(chalkAlert("***** RX SESSION_ABORT HIT | " + sessionId));
      socket.disconnect();
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
    }
    reset("SESSION_ABORT");
  });

  socket.on("SESSION_EXPIRED", function(sessionId){
    console.log(chalkAlert("RX SESSION_EXPIRED | " + sessionId));
    if (sessionId === statsObj.socketId){
      console.error(chalkAlert("***** RX SESSION_EXPIRED HIT | " + sessionId));
      console.log(chalkAlert("***** RX SESSION_EXPIRED HIT | " + sessionId));
      socket.disconnect();
      statsObj.userAuthenticated = false ;
      statsObj.serverConnected = false;
    }
    reset("SESSION_EXPIRED");
  });

  socket.on("DROPBOX_CHANGE", function(response){
    
    response.entries.forEach(function(entry){
      debug(chalkInfo(">R DROPBOX_CHANGE"
        + " | " + entry[".tag"].toUpperCase()
        + " | " + entry.path_lower
        // + " | NAME: " + entry.name
      ));
    });

  });

  socket.on("HEARTBEAT", function(){
    statsObj.heartbeatsReceived += 1;
  });

  socket.on("KEEPALIVE_ACK", function(userId) {
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });

  callback(null, null);
}

function initStatsUpdate(callback){

  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  twitterTextParser.getGlobalHistograms(function(){
    saveFile({folder: statsFolder, file: statsFile, obj: statsObj});
  });


  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    saveFileQueue.push({folder:classifiedUsersFolder, file:classifiedUsersDefaultFile, obj:classifiedUserHashmap});

    if (classifiedUserHashmapReadyFlag && (hostname === "google")) {
      saveFileQueue.push({folder:defaultClassifiedUsersFolder, file:classifiedUsersDefaultFile, obj:classifiedUserHashmap});
    }

    twitterTextParser.getGlobalHistograms(function(){
      saveFileQueue.push({folder: statsFolder, file: statsFile, obj: statsObj});
    });

    showStats();

  }, configuration.statsUpdateIntervalTime);

  callback(null);
}

function checkRateLimit(callback){

  twitterUserHashMap[currentTwitterUser].twit.get(
    "application/rate_limit_status", 
    function(err, data, response) {

    debug("application/rate_limit_status response: " + jsonPrint(response));
    
    if (err){
      console.error("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() + "\n" + JSON.stringify(err, null, 3));
      statsObj.twitterErrors+= 1;

      if (callback !== undefined) { callback(err, null); }
    }
    else {
      debug(chalkTwitter("\n-------------------------------------\nTWITTER RATE LIMIT STATUS\n" 
        + JSON.stringify(data, null, 3)
      ));

      if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
        && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){


        fsm.fsm_rateLimitEnd();
        statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
      // 
        console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
        ));
      }

      statsObj.user[currentTwitterUser].twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      console.log(chalkLog("TWITTER RATE LIMIT STATUS"
        + " | " + getTimeStamp()
        + " | LIMIT " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REMAINING " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | RESET " + getTimeStamp(statsObj.user[currentTwitterUser].twitterRateLimitResetAt)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
      ));

      if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
        && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){


        fsm.fsm_rateLimitEnd();
        statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
      // 
        console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
        ));
      }
      else if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag){

        console.log(chalkAlert("*** TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
          + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        ));
        fsmPreviousState = fsm.getMachineState();
        fsm.fsm_rateLimitStart();
      }
      else {
        debug(chalkInfo("... NO TWITTER RATE LIMIT"
          + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
          + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
          + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        ));
        fsm.fsm_rateLimitEnd();
      }

      if (callback !== undefined) { callback(); }
    }
  });
}

function printTwitterUser(user){

  let threeceeFollowingText = "";

  if (user.threeceeFollowing) {
    threeceeFollowingText = user.threeceeFollowing.screenName;
  }

  console.log(chalkTwitter("\n=================================================="
    + "\nTWITTER USER"
    + " | @" + user.screenName 
    + " | " + user.name 
    + " | Ts:    " + user.statusesCount 
    + " | FRNDS: " + user.friendsCount 
    + " | FLWRs: " + user.followersCount 
    + "\n=================================================="
  ));
}

function twitterUserUpdate(userScreenName, callback){

  twitterUserHashMap[userScreenName].twit.get("users/show", {screen_name: userScreenName}, function(err, userShowData, response) {
  
    if (err){
      console.log("!!!!! TWITTER SHOW USER ERROR | @" + userScreenName + " | " + getTimeStamp() 
        + "\n" + jsonPrint(err));
      return(callback(err));
    }

    debug(chalkTwitter("TWITTER USER DATA\n" + jsonPrint(userShowData)));
    debug(chalkTwitter("TWITTER USER RESPONSE\n" + jsonPrint(response)));

    statsObj.user[userScreenName] = {};

    statsObj.user[userScreenName].id = userShowData.id_str;
    statsObj.user[userScreenName].name = userShowData.name;
    statsObj.user[userScreenName].screenName = userShowData.screen_name.toLowerCase();
    statsObj.user[userScreenName].description = userShowData.description;
    statsObj.user[userScreenName].url = userShowData.url;
    statsObj.user[userScreenName].statusesCount = userShowData.statuses_count;
    statsObj.user[userScreenName].friendsCount = userShowData.friends_count;
    statsObj.user[userScreenName].followersCount = userShowData.followers_count;

    statsObj.user[userScreenName].totalFriendsFetched = 0;
    statsObj.user[userScreenName].endFetch = false;
    statsObj.user[userScreenName].count = configuration.fetchCount;
    statsObj.user[userScreenName].friendsProcessed = 0;
    statsObj.user[userScreenName].percentProcessed = 0;
    statsObj.user[userScreenName].nextCursor = false;
    statsObj.user[userScreenName].nextCursorValid = false;
    statsObj.user[userScreenName].twitterRateLimit = 0;
    statsObj.user[userScreenName].twitterRateLimitExceptionFlag = false;
    statsObj.user[userScreenName].twitterRateLimitRemaining = 0;
    statsObj.user[userScreenName].twitterRateLimitResetAt = moment();
    statsObj.user[userScreenName].twitterRateLimitRemainingTime = 0;
    statsObj.user[userScreenName].friendsProcessStart = moment();
    statsObj.user[userScreenName].friendsProcessEnd = moment();
    statsObj.user[userScreenName].friendsProcessElapsed = 0;

    console.log(chalkTwitterBold("\n=================================================="
      + "\nTWITTER USER"
      + " | @" + statsObj.user[userScreenName].screenName 
      + " | " + statsObj.user[userScreenName].name 
      + " | Ts:    " + statsObj.user[userScreenName].statusesCount 
      + " | FRNDS: " + statsObj.user[userScreenName].friendsCount 
      + " | FLWRs: " + statsObj.user[userScreenName].followersCount
      + "\n=================================================="
    ));

    callback(null);
  });
}

function checkUserWordKeys(user, callback){

  Word.findOne({nodeId: user.screenName.toLowerCase()}, function(err, word){

    let kws = {};

    if (err) {
      console.error(chalkError("FIND ONE WORD ERROR: " + err));
      callback(err, user);
    }
    else if (!word) {
      debug(chalkInfo("USER WORD NOT FOUND: " + user.screenName.toLowerCase()));
      callback(null, kws);
    }
    else if (word.keywords === undefined) {
      console.log("WORD-USER KWS UNDEFINED"
        + " | @" + user.screenName.toLowerCase()
      );
      callback(null, kws);
    }
    else if (!word.keywords || (Object.keys(word.keywords).length === 0)) {
      debug("WORD-USER NO KW KEYS"
        + " | @" + user.screenName.toLowerCase()
      );
      callback(null, kws);
    }
    else {
      debug("WORD-USER KEYWORDS"
        + "\n" + jsonPrint(word.keywords)
      );

      async.each(Object.keys(word.keywords), function(kwId, cb){

        if (kwId !== "keywordId") {

          const kwIdLc = kwId.toLowerCase();

          kws[kwIdLc] = word.keywords[kwIdLc];

          debug(chalkTwitter("-- KW"
            + " | @" + user.screenName.toLowerCase()
            + " | " + kwIdLc
            + " | " + kws[kwIdLc]
          ));

          classifiedUserHashmap[user.userId] = {};
          classifiedUserHashmap[user.userId] = kws;

          async.setImmediate(function() {
            cb();
          });
        }
        else {
          async.setImmediate(function() {
            cb();
          });
        }

      }, function(){

        debug("WORD-USER HIT"
          + " | " + user.userId
          + " | @" + user.screenName.toLowerCase()
          + " | KWs: " + Object.keys(kws)
        );

        callback(null, kws);

      });
    }
  });
}

function getUserKeyword(keywords, callback) {

  let keyword = "none";

  const keys = Object.keys(keywords);

  if (keys.length === 0 ) { 
    callback(null, false);
  }

  async.each(keys, function(kw, cb){
    switch (kw) {
      case "left":
      case "right":
      case "neutral":
      case "positive":
      case "negative":
        keyword = kw;
        async.setImmediate(function() {
          cb();
        });
      break;
      default:
        async.setImmediate(function() {
          cb();
        });
    }
  }, function(err){
    callback(err, keyword);
  });
}

function classifyUser(user, callback){

  debug(chalkAlert("classifyUser KWs\n" + jsonPrint(user.get("keywords"))));
  debug(chalkAlert("classifyUser AKWs\n" + jsonPrint(user.get("keywordsAuto"))));

  return new Promise(function(resolve) {

    let chalkAutoCurrent = chalkLog;

    let classManualText = " ";
    let classAutoText = " ";

    async.parallel({

      keywords: function(cb){
        if (user.keywords) {

          debug("KWS\n" + jsonPrint(user.get("keywords")));
          
          classifiedUserHashmap[user.userId] = {};
          classifiedUserHashmap[user.userId] = user.keywords;

          statsObj.users.classified = Object.keys(classifiedUserHashmap).length;

          const mkwObj = user.get("keywords");

          getUserKeyword(mkwObj, function(err, mkw){
            switch (mkw) {
              case "right":
                classManualText = "R";
                statsObj.classification.manual.right += 1;
              break;
              case "left":
                classManualText = "L";
                statsObj.classification.manual.left += 1;
              break;
              case "neutral":
                classManualText = "N";
                statsObj.classification.manual.neutral += 1;
              break;
              case "positive":
                classManualText = "+";
                statsObj.classification.manual.positive += 1;
              break;
              case "negative":
                classManualText = "-";
                statsObj.classification.manual.negative += 1;
              break;
              case "none":
                classManualText = "0";
                statsObj.classification.manual.none += 1;
              break;
              default:
                classManualText = mkw;
                chalkAutoCurrent = chalk.black;
                statsObj.classification.manual.other += 1;
            }
            cb();
          });

        }
        else {
          cb();
        }
      },

      keywordsAuto: function(cb){

        if (user.keywordsAuto) {

          debug("KWSA\n" + jsonPrint(user.get("keywordsAuto")));

          autoClassifiedUserHashmap[user.userId] = {};
          autoClassifiedUserHashmap[user.userId] = user.keywordsAuto;

          statsObj.users.classifiedAuto = Object.keys(autoClassifiedUserHashmap).length;

          const akwObj = user.get("keywordsAuto");

          getUserKeyword(akwObj, function(err, akw){
            switch (akw) {
              case "right":
                classAutoText = "R";
                chalkAutoCurrent = chalk.yellow;
                statsObj.classification.auto.right += 1;
              break;
              case "left":
                classAutoText = "L";
                chalkAutoCurrent = chalk.blue;
                statsObj.classification.auto.left += 1;
              break;
              case "neutral":
                classAutoText = "N";
                chalkAutoCurrent = chalk.black;
                statsObj.classification.auto.neutral += 1;
              break;
              case "positive":
                classAutoText = "+";
                chalkAutoCurrent = chalk.green;
                statsObj.classification.auto.positive += 1;
              break;
              case "negative":
                classAutoText = "-";
                chalkAutoCurrent = chalk.bold.yellow;
                statsObj.classification.auto.negative += 1;
              break;
              case "none":
                classAutoText = "0";
                chalkAutoCurrent = chalk.black;
                statsObj.classification.auto.none += 1;
              break;
              default:
                classAutoText = akw;
                chalkAutoCurrent = chalk.bold.black;
                statsObj.classification.auto.other += 1;
            }
            cb();
          });
        }
        else {
          cb();
        }
      }
    }, function(){

      debug(chalkAutoCurrent(">USR KWs"
        + " | MKW: " + classManualText
        + " | AKW: " + classAutoText
        + " [ TOT M: " + Object.keys(classifiedUserHashmap).length + "]"
        + " [ TOT A: " + Object.keys(autoClassifiedUserHashmap).length + "]"
        + " | " + user.userId
        + " | @" + user.screenName
        + " | " + user.name
        + " | Ts: " + user.statusesCount
        + " | FLWRs: " + user.followersCount
        + " | FRNDs: " + user.friendsCount
        + " | 3CF: " + user.threeceeFollowing.screenName
        + "\n MKW: [ L: " + statsObj.classification.manual.left
        + " | R: " + statsObj.classification.manual.right
        + " | +: " + statsObj.classification.manual.positive
        + " | -: " + statsObj.classification.manual.negative
        + " | N: " + statsObj.classification.manual.neutral
        + " | O: " + statsObj.classification.manual.other
        + " | X: " + statsObj.classification.manual.none + " ]"
        + "\n AKW: [ L: " + statsObj.classification.auto.left
        + " | R: " + statsObj.classification.auto.right
        + " | +: " + statsObj.classification.auto.positive
        + " | -: " + statsObj.classification.auto.negative
        + " | N: " + statsObj.classification.auto.neutral
        + " | O: " + statsObj.classification.auto.other
        + " | X: " + statsObj.classification.auto.none + " ]"
      ));

      callback(null, user);
    });

  });
}

function updateImageHistograms(params){

  let user = params.user;
  let imagesObj = params.histogram;

  Object.keys(imagesObj).forEach(function(imageLabel){

    if (user.keywords && Object.keys(user.keywords).length > 0) {
      if (histograms.images[imageLabel] === undefined) {
        histograms.images[imageLabel] = {};
        histograms.images[imageLabel].total = 0;
        histograms.images[imageLabel].left = 0;
        histograms.images[imageLabel].neutral = 0;
        histograms.images[imageLabel].right = 0;
        histograms.images[imageLabel].positive = 0;
        histograms.images[imageLabel].negative = 0;
        histograms.images[imageLabel].uncategorized = 0;
      }

      histograms.images[imageLabel].total += 1;
      
      if (user.keywords) {
        if (user.keywords.left !== undefined) { histograms.images[imageLabel].left += 1; }
        if (user.keywords.neutral !== undefined) { histograms.images[imageLabel].neutral += 1; }
        if (user.keywords.right !== undefined) { histograms.images[imageLabel].right += 1; }
        if (user.keywords.positive !== undefined) { histograms.images[imageLabel].positive += 1; }
        if (user.keywords.negative !== undefined) { histograms.images[imageLabel].negative += 1; }
      }
      else {
        histograms.images[imageLabel].uncategorized += 1;
      }
 
    }

  });
}

function enableAnalysis(user, languageAnalysis){
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

function activateNetwork(obj){

  if (randomNetworkTreeReadyFlag) {
    randomNetworkTree.send({op: "ACTIVATE", obj: obj});
  }
}

function generateAutoKeywords(params, user, callback){

  // PARSE USER STATUS + DESC, IF EXIST
  async.waterfall([

    function userScreenName(cb) {
      if (user.screenName !== undefined) {
        async.setImmediate(function() {
          cb(null, "@" + user.screenName.toLowerCase());
        });
      }
      else {
        async.setImmediate(function() {
          cb(null, null);
        });
      }
    },

    function userName(text, cb) {
      if (user.name !== undefined) {
        if (text) {
          async.setImmediate(function() {
            cb(null, text + " | " + user.name);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.name);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },

    function userStatusText(text, cb) {

      if ((user.status !== undefined) 
        && user.status
        && user.status.text) {
        if (text) {
          async.setImmediate(function() {
            cb(null, text + "\n" + user.status.text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.status.text);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },

    function userRetweetText(text, cb) {
      if ((user.retweeted_status !== undefined) 
        && user.retweeted_status
        && user.retweeted_status.text) {

        console.log(chalkTwitter("RT\n" + jsonPrint(user.retweeted_status.text)));

        if (text) {
          async.setImmediate(function() {
            cb(null, text + "\n" + user.retweeted_status.text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.retweeted_status.text);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },

    function userDescriptionText(text, cb) {
      if ((user.description !== undefined) && user.description) {
        if (text) {
          async.setImmediate(function() {
            cb(null, text + "\n" + user.description);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, user.description);
          });
        }
      }
      else {
        if (text) {
          async.setImmediate(function() {
            cb(null, text);
          });
        }
        else {
          async.setImmediate(function() {
            cb(null, null);
          });
        }
      }
    },

    function userBannerImage(text, cb) {
      if (user.bannerImageUrl) {
        twitterImageParser.parseImage(user.bannerImageUrl, { screenName: user.screenName, keywords: user.keywords, updateGlobalHistograms: true}, function(err, results){
          if (err) {
            console.log(chalkError("PARSE BANNER IMAGE ERROR"
              // + "\nREQ\n" + jsonPrint(results)
              // + "\nERR\n" + jsonPrint(err)
            ));
            cb(null, text, null);
          }
          else {
            debug(chalkAlert("PARSE BANNER IMAGE"
              + " | RESULTS\n" + jsonPrint(results)
            ));
            if (results.text !== undefined) {
              debug(chalkInfo("@" + user.screenName + " | " + results.text));
              text = text + "\n" + results.text;
            }
            cb(null, text, results);
          }
        });
      }
      else {
        async.setImmediate(function() {
          cb(null, text, null);
        });
      }
    }

  ], function (err, text, bannerResults) {

    if (err) {
      console.error(chalkError("*** ERROR generateAutoKeywords: " + err));
      callback(err, null);
    }

    if (!text) { text = " "; }

    let parseTextOptions = {};
    parseTextOptions.updateGlobalHistograms = true;

    if (user.keywords && (user.keywords !== undefined)) {
      parseTextOptions.keywords = {};
      parseTextOptions.keywords = user.keywords;
    }
    else {
      parseTextOptions.keywords = false;
    }

    twitterTextParser.parseText(text, parseTextOptions, function(err, hist){

      if (err) {
        console.log(chalkError("*** TWITTER TEXT PARSER ERROR: " + err));
        callback(new Error(err), null);
      }

      hist.images = {};

      if (bannerResults && bannerResults.label && bannerResults.label.images) {
        hist.images = deepcopy(bannerResults.label.images);
        updateImageHistograms({user: user, histogram: bannerResults.label.images});
      }

      const updateCountHistory = params.updateCountHistory 
      && (user.followersCount !== undefined) 
      && (user.friendsCount !== undefined) 
      && (user.statusesCount !== undefined);

      // console.log("generateAutoKeywords | updateCountHistory: " + updateCountHistory
      //   + " | params.updateCountHistory " + params.updateCountHistory
      //   + " | user.followersCount " + user.followersCount
      //   + " | user.friendsCount " + user.friendsCount
      //   + " | user.statusesCount " + user.statusesCount
      // );

      userServer.updateHistograms({user: user, histograms: hist, updateCountHistory: updateCountHistory}, function(err, updatedUser){

        if (err) {
          console.trace(chalkError("*** UPDATE USER HISTOGRAMS ERROR\n" + jsonPrint(err)));
          console.trace(chalkError("*** UPDATE USER HISTOGRAMS ERROR\nUSER\n" + jsonPrint(user)));
          callback(new Error(err), null);
        }

        updatedUser.inputHits = 0;

        const userHistograms = updatedUser.histograms;

        const score = updatedUser.languageAnalysis.sentiment ? updatedUser.languageAnalysis.sentiment.score : 0;
        const mag = updatedUser.languageAnalysis.sentiment ? updatedUser.languageAnalysis.sentiment.magnitude : 0;

        statsObj.normalization.score.min = Math.min(score, statsObj.normalization.score.min);
        statsObj.normalization.score.max = Math.max(score, statsObj.normalization.score.max);

        statsObj.normalization.magnitude.min = Math.min(mag, statsObj.normalization.magnitude.min);
        statsObj.normalization.magnitude.max = Math.max(mag, statsObj.normalization.magnitude.max);


        debug(chalkInfo("GEN AKWs"
          + " [@" + currentTwitterUser + "]"
          + " | @" + updatedUser.screenName
          + " | " + updatedUser.userId
          + " | Ts: " + updatedUser.statusesCount
          + " | FLWRs: " + updatedUser.followersCount
          + " | FRNDs: " + updatedUser.friendsCount
          + " | LAd: " + updatedUser.languageAnalyzed
          + " | LA: S: " + score.toFixed(2)
          + " M: " + mag.toFixed(2)
        ));

        statsObj.analyzer.total += 1;

        if (enableAnalysis(updatedUser, {magnitude: mag, score: score})) {
          debug(chalkLog(">>>> LANG ANALYZE"
            + " [ ANLd: " + statsObj.analyzer.analyzed
            + " [ SKPd: " + statsObj.analyzer.skipped
            + " | " + updatedUser.userId
            + " | @" + updatedUser.screenName
            + " | LAd: " + updatedUser.languageAnalyzed
            + " | LA: S: " + score.toFixed(2)
            + " M: " + mag.toFixed(2)
          ));
          langAnalyzer.send({op: "LANG_ANALIZE", obj: updatedUser, text: text}, function(){
            statsObj.analyzer.analyzed += 1;
          });
        }
        else {

          statsObj.analyzer.skipped += 1;

          debug(chalkLog("SKIP LANG ANALYZE"
            + " [ ANLd: " + statsObj.analyzer.analyzed
            + " [ SKPd: " + statsObj.analyzer.skipped
            + " | " + updatedUser.userId
            + " | @" + updatedUser.screenName
            + " | LAd: " + updatedUser.languageAnalyzed
            + " | LA: S: " + score.toFixed(2)
            + " M: " + mag.toFixed(2)
          ));
        }

        const u = pick(updatedUser, ["userId", "screenName", "keywords", "keywordsAuto", "histograms", "languageAnalysis"]);

        activateNetwork({user: u, normalization: statsObj.normalization});

        callback(null, updatedUser);

      });

    });

  });
}

function processUser(params, userIn, lastTweeId, callback) {

  let updateCountHistory = false;

  debug(chalkInfo("PROCESS USER\n" + jsonPrint(userIn)));

  async.waterfall(
  [
    function convertUser(cb) {
      userServer.convertRawUser(userIn, lastTweeId, function(err, user){
        if (err) {
          cb(err, null);
        }
        else {
          cb(null, user);
        }
      });
    },

    function unfollowFriend(user, cb) {

      if ((currentTwitterUser === "altthreecee00")
        && (twitterUserHashMap.ninjathreecee.friends[user.userId] !== undefined)) {

        console.log(chalkInfo("SKIP | ninjathreecee FOLLOWING"
          + " | " + user.userId
          + " | " + user.screenName.toLowerCase()
        ));

        twitterUserHashMap[currentTwitterUser].twit.post(
          "friendships/destroy", 
          {user_id: user.userId}, 
          function destroyFriend(err, data, response){
            if (err) {
              console.error(chalkError("UNFOLLOW ERROR" + err));
              cb(err, user);
            }
            else {
              debug("data\n" + jsonPrint(data));
              debug("response\n" + jsonPrint(response));

              console.log(chalkInfo("UNFOLLOW altthreecee00"
                + " | " + user.userId
                + " | " + user.screenName.toLowerCase()
              ));
              const slackText = "UNFOLLOW altthreecee00"
                + "\n@" + user.screenName.toLowerCase()
                + "\n" + user.userId;
              slackPostMessage(slackChannel, slackText);
              cb(null, user);
            }
          }
        );
      }
      else {
        cb(null, user);
      }
    },

    function checkKeyWords(user, cb) {
      checkUserWordKeys(user, function(err, kws){
        if (err) {
          console.error(chalkError("CHECK USER KEYWORDS ERROR"
            + " | @" + user.screenName
            + " | " + user.userId
            + " | " + err
          ));
          return(cb(err,user));
        }
        if (Object.keys(kws).length > 0) {
          let kwsa = "";
          if (user.keywordsAuto && (Object.keys(user.keywordsAuto).length > 0)) {
            kwsa = Object.keys(user.keywordsAuto);
          }
          debug("WORD-USER HIT"
            + " | " + user.userId
            + " | @" + user.screenName.toLowerCase()
            + " | KWs: " + Object.keys(kws)
            + " | KWAs: " + Object.keys(kwsa)
          );
          user.keywords = {};
          user.keywords = kws;
          cb(null, user);
        }
        else {
          cb(null, user);
        }
      });
    },

    function findUserInDb(user, cb) {

      User.find({ userId: user.userId }).limit(1).exec(function(err, uArray) {

        if (err) {
          console.log(chalkError("ERROR DB FIND ONE USER | " + err));
          cb(err, user);
        }
        else if (uArray.length === 0) {
          console.log(chalkInfo("USER DB MISS"
            + " | @" + user.screenName.toLowerCase()
            + " | " + user.userId
          ));
          cb(null, user);
        }
        else {

          let userDb = uArray[0];
          
          user.createdAt = userDb.createdAt;
          user.languageAnalyzed = userDb.languageAnalyzed;

          if (userDb.languageAnalyzed) { 
            user.languageAnalysis = userDb.languageAnalysis;
          }
          if (userDb.histograms && (Object.keys(userDb.histograms).length > 0)) { 
            user.histograms = userDb.histograms;
          }
          if (userDb.keywords && (Object.keys(userDb.keywords).length > 0)) { 
            user.keywords = userDb.keywords;
          }
          if (userDb.keywordsAuto && (Object.keys(userDb.keywordsAuto).length > 0)) { 
            user.keywordsAuto = userDb.keywordsAuto;
          }

          if ((user.rate === 0) && (userDb.rate > 0)) {
            user.rate = userDb.rate;
          }

          if ((user.mentions === 0) && (userDb.mentions > 0)) {
            user.mentions = userDb.mentions;
          }

          if (user.followersCount && (user.followersCount !== userDb.followersCount)
            || (user.friendsCount !== userDb.friendsCount)
            || (user.statusesCount !== userDb.statusesCount)) {
            updateCountHistory = true;
          }

          if ((user.followersCount === 0) && (userDb.followersCount > 0)) {
            user.followersCount = userDb.followersCount;
          }

          if ((user.statusesCount === 0) && (userDb.statusesCount > 0)) {
            user.statusesCount = userDb.statusesCount;
          }

          if ((user.friendsCount === 0) && (userDb.friendsCount > 0)) {
            user.friendsCount = userDb.friendsCount;
          }

          debug(chalkInfo("USER DB HIT "
            + " | @" + user.screenName.toLowerCase()
            + " | " + user.userId
            + " | " + getTimeStamp(user.createdAt)
            + " | LAd: " + user.languageAnalyzed
            + " | KWs: " + Object.keys(user.get("keywords"))
            + " | KWAs: " + Object.keys(user.get("keywordsAuto"))
          ));
          cb(null, user);
        }
      });
    },

    function updateClassifyUser(user, cb) {

      if (user.keywords) {
        debug(chalkInfo("USER KWs\n" + jsonPrint(user.get("keywords"))));
      }

      if (user.keywordsAuto) {
        debug(chalkInfo("USER AKWs\n" + jsonPrint(user.get("keywordsAuto"))));
      }

      classifyUser(user, function genClassifiedUserKeyword(err, u){
        if (err) {
          console.trace(chalkError("ERROR classifyUser | UID: " + user.userId
            + "\n" + err
          ));
          cb(err, user);
        }
        else {
          debug(chalkInfo("CLU U"
            + " | @" + u.screenName.toLowerCase()
            + " | " + u.userId
            + " | " + getTimeStamp(u.createdAt)
            + " | KWs: " + Object.keys(u.get("keywords"))
            + " | KWAs: " + Object.keys(u.get("keywordsAuto"))
          ));
          cb(null, u);
        }

      });
    },

    function genKeywords(user, cb){

      if (!neuralNetworkInitialized) { return(cb(null, user)); }

      // console.log("genKeywords | updateCountHistory: " + updateCountHistory);

      generateAutoKeywords({updateCountHistory: updateCountHistory}, user, function (err, uObj){
        cb(err, uObj);
      });

    }

  ], function (err, user) {

    if (err) {
      callback(new Error(err), null);
    }
    else {
      callback(null, user);
    }

  });
}

function initTwitter(currentTwitterUser, callback){

  console.log(chalkInfo("INIT TWITTER: " + currentTwitterUser));

  let twitterConfigFile =  currentTwitterUser + ".json";

  loadFile(configuration.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + configuration.twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      callback(err);
    }
    else {
      console.log(chalkTwitter("LOADED TWITTER CONFIG"
        + " | " + twitterConfigFile
        // + "\n" + jsonPrint(twitterConfig)
      ));

      const newTwit = new Twit({
        consumer_key: twitterConfig.CONSUMER_KEY,
        consumer_secret: twitterConfig.CONSUMER_SECRET,
        access_token: twitterConfig.TOKEN,
        access_token_secret: twitterConfig.TOKEN_SECRET
      });

      const newTwitStream = newTwit.stream("user", { stringify_friend_ids: true });

      newTwitStream.on("follow", function(followMessage){

        console.log(chalkInfo("USER " + currentTwitterUser + " FOLLOW"
          + " | " +  followMessage.target.id_str
          + " | " +  followMessage.target.screen_name.toLowerCase()
        ));

        followMessage.target.threeceeFollowing = {};
        followMessage.target.threeceeFollowing.screenName = currentTwitterUser;

        processUser({}, followMessage.target, null, function(err, user){
          if (err) {
            console.trace("processUser ERROR");
          }
          console.log("NEW FOLLOW | PROCESSED USER | " + currentTwitterUser + "\n" + jsonPrint(user));
        });
      });

      async.waterfall([

        function initTwit(cb) {

          newTwit.get("account/settings", function(err, accountSettings, response) {
            if (err){
              console.log("!!!!! TWITTER ACCOUNT ERROR | " + getTimeStamp() + "\n" + jsonPrint(err));
              return(cb(err, null));
            }

            debug(chalkTwitter("TWITTER ACCOUNT SETTINGS RESPONSE\n" + jsonPrint(response)));

            const userScreenName = accountSettings.screen_name.toLowerCase();

            twitterUserHashMap[userScreenName].twit = {};
            twitterUserHashMap[userScreenName].twit = newTwit;

            console.log(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: " + userScreenName));
            debug(chalkTwitter("TWITTER ACCOUNT SETTINGS\n" + jsonPrint(accountSettings)));

            twitterUserUpdate(userScreenName, function(err){
             if (err){
                console.log("!!!!! TWITTER SHOW USER ERROR | @" + userScreenName + " | " + getTimeStamp() 
                  + "\n" + jsonPrint(err));
                return(cb(err, null));
              }
              cb(null, { screenName: userScreenName, twit: newTwit});
            });
          });
        },

        function initTwitStream(twitObj, cb){

          twitterUserHashMap[twitObj.screenName].twitStream = {};
          twitterUserHashMap[twitObj.screenName].twitStream = newTwitStream;

          cb(null, {twit: twitObj.twit, twitStream: newTwitStream});
        }

      ], function (err, results) {
        debug("results\n" + results);
        callback(err);
      });

    }

  });
}

function initTwitterUsers(callback){

  if (!configuration.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    if (callback !== undefined) {callback(null, null);}
  }
  else {

    let twitterDefaultUser = configuration.twitterDefaultUser;

    console.log(chalkTwitter("USERS"
      + " | FOUND: " + configuration.twitterUsers.length
    ));

    async.each(configuration.twitterUsers, function(userId, cb){

      userId = userId.toLowerCase();

      let twitterUserObj = {};

      console.log("userId: " + userId);
      console.log("screenName: " + configuration.twitterUsers[userId]);

      twitterUserObj.isDefault = (twitterDefaultUser === userId) || false;
      twitterUserObj.userId = userId ;
      twitterUserObj.screenName = configuration.twitterUsers[userId] ;

      twitterUserHashMap[userId] = {};
      twitterUserHashMap[userId].userInfo = {};
      twitterUserHashMap[userId].friends = {};
      twitterUserHashMap[userId].userInfo = twitterUserObj;


      initTwitter(userId, function(err, twitObj){
        if (err) {
          console.log(chalkError("INIT TWITTER ERROR\n" + jsonPrint(err)));
          return(cb(err));
        }

        debug("INIT TWITTER twitObj\n" + jsonPrint(twitObj));

        console.log(chalkTwitter("ADDED TWITTER USER"
          + " | NAME: " + userId
          + " | FEED ID: " + twitterUserHashMap[userId].userInfo.userId
          + " | DEFAULT USER: " + twitterUserHashMap[userId].userInfo.isDefault
        ));

        cb();

      });

    }, function(err){
      console.log(chalkTwitter("\nADD TWITTER USERS COMPLETE\n"));
      if (callback !== undefined) { callback(err); }
    });

  }
}

function initClassifiedUserHashmap(folder, file, callback){

  console.log(chalkTwitter("INIT CLASSIFED USERS HASHMAP FROM DB"));

  loadFile(folder, file, function(err, dropboxClassifiedUsersObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkTwitter("LOADED CLASSIFED USERS FILE: " + folder + "/" + file));
      console.log(chalkTwitter("DROPBOX DEFAULT | " + Object.keys(dropboxClassifiedUsersObj).length + " CLASSIFED USERS"));

      const params = { auto: false };

      userServer.findClassifiedUsersCursor(params, function(err, results){
        if (err) {
          console.error(chalkError("ERROR: initClassifiedUserHashmap: "));
          callback(err, null);
        }
        else {
          console.log(chalkTwitter("LOADED CLASSIFED USERS FROM DB"
            + " | " + results.count + " CLASSIFED"
            + " | " + results.manual + " MAN"
            + " | " + results.auto + " AUTO"
            + " | " + results.matchRate.toFixed(1) + "% MATCH"
          ));

          const classifiedUsersObj = defaults(dropboxClassifiedUsersObj, results.obj);

          callback(null, classifiedUsersObj);
        }
      });

    }
  });
}

function initStdIn(){

  console.log("STDIN ENABLED");

  stdin = process.stdin;
  if(stdin.setRawMode !== undefined) {
    stdin.setRawMode( true );
  }
  stdin.resume();
  stdin.setEncoding( "utf8" );
  stdin.on( "data", function( key ){

    switch (key) {
      case "\u0003":
        process.exit();
      break;
      case "a":
        abortCursor = true;
        console.log(chalkAlert("ABORT: " + abortCursor));
      break;
      case "n":
        nextUser = true;
        console.log(chalkAlert("NEXT USER: " + nextUser));
      break;
      case "q":
      case "Q":
        quit();
      break;
      case "s":
        showStats();
      break;
      case "S":
        showStats(true);
      break;
      default:
        console.log(
          "\n" + "q/Q: quit"
          + "\n" + "s: showStats"
          + "\n" + "S: showStats verbose"
          );
    }
  });
}

function initialize(cnf, callback){

  fsm.fsm_reset();
  fsm.fsm_initStart();

  initClassifiedUserHashmap(defaultClassifiedUsersFolder, classifiedUsersDefaultFile, function(err, classifiedUsersObj){
    if (err) {
      console.error(chalkError("*** ERROR: CLASSIFED USER HASHMAP NOT INITIALIZED: ", err));
    }
    else {
      classifiedUserHashmap = classifiedUsersObj;
      console.log(chalkTwitterBold("LOADED " + Object.keys(classifiedUserHashmap).length + " TOTAL CLASSIFED USERS"));
      classifiedUserHashmapReadyFlag = true;
      runEnable();
    }
  });

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TFE_PROCESS_NAME || "twitterFollowerExplorer";
  cnf.targetServer = process.env.TFE_UTIL_TARGET_SERVER || "http://127.0.0.1:9997/util" ;

  cnf.histogramParseDominantMin = process.env.TFE_HISTOGRAM_PARSE_DOMINANT_MIN || DEFAULT_HISTOGRAM_PARSE_DOMINANT_MIN ;
  cnf.histogramParseTotalMin = process.env.TFE_HISTOGRAM_PARSE_TOTAL_MIN || DEFAULT_HISTOGRAM_PARSE_TOTAL_MIN;

  cnf.minSuccessRate = process.env.TFE_MIN_SUCCESS_RATE || DEFAULT_MIN_SUCCESS_RATE ;
  cnf.numRandomNetworks = process.env.TFE_NUM_RANDOM_NETWORKS || TFE_NUM_RANDOM_NETWORKS ;
  cnf.testMode = (process.env.TFE_TEST_MODE === "true") ? true : cnf.testMode;

  cnf.quitOnError = process.env.TFE_QUIT_ON_ERROR || false ;
  if (process.env.TFE_QUIT_ON_COMPLETE === "false") {
    cnf.quitOnComplete = false;
  }
  if (process.env.TFE_QUIT_ON_COMPLETE === "true") {
    cnf.quitOnComplete = true;
  }
  cnf.enableStdin = process.env.TFE_ENABLE_STDIN || true ;

  if (process.env.TFE_USER_DB_CRAWL && (process.env.TFE_USER_DB_CRAWL === "true")){
    cnf.userDbCrawl = true;
  }

  cnf.enableLanguageAnalysis = process.env.TFE_ENABLE_LANG_ANALYSIS || true ;
  cnf.forceLanguageAnalysis = process.env.TFE_FORCE_LANG_ANALYSIS || false ;

  console.log(chalkAlert("FORCE LANG ANALYSIS: " + cnf.forceLanguageAnalysis));


  cnf.twitterDefaultUser = process.env.TFE_TWITTER_DEFAULT_USER || TWITTER_DEFAULT_USER ;
  cnf.twitterUsers = process.env.TFE_TWITTER_USERS || [ "altthreecee00", "atlthreecee02", "ninjathreecee" ] ;
  cnf.statsUpdateIntervalTime = process.env.TFE_STATS_UPDATE_INTERVAL || ONE_MINUTE;

  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";
  cnf.twitterConfigFile = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE || cnf.twitterDefaultUser + ".json";

  cnf.neuralNetworkFile = defaultNeuralNetworkFile;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineArgs;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.TFE_UTIL_TARGET_SERVER !== undefined){
        console.log("LOADED TFE_UTIL_TARGET_SERVER: " + loadedConfigObj.TFE_UTIL_TARGET_SERVER);
        cnf.targetServer = loadedConfigObj.TFE_UTIL_TARGET_SERVER;
      }

      if (loadedConfigObj.TFE_TEST_MODE !== undefined){
        console.log("LOADED TFE_TEST_MODE: " + loadedConfigObj.TFE_TEST_MODE);
        cnf.testMode = loadedConfigObj.TFE_TEST_MODE;
      }

      if (loadedConfigObj.TFE_QUIT_ON_COMPLETE !== undefined){
        console.log("LOADED TFE_QUIT_ON_COMPLETE: " + loadedConfigObj.TFE_QUIT_ON_COMPLETE);
        cnf.quitOnComplete = loadedConfigObj.TFE_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN !== undefined){
        console.log("LOADED TFE_HISTOGRAM_PARSE_DOMINANT_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN);
        cnf.histogramParseDominantMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_DOMINANT_MIN;
      }

      if (loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN !== undefined){
        console.log("LOADED TFE_HISTOGRAM_PARSE_TOTAL_MIN: " + loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN);
        cnf.histogramParseTotalMin = loadedConfigObj.TFE_HISTOGRAM_PARSE_TOTAL_MIN;
      }

      if (loadedConfigObj.TFE_MIN_SUCCESS_RATE !== undefined){
        console.log("LOADED TFE_MIN_SUCCESS_RATE: " + loadedConfigObj.TFE_MIN_SUCCESS_RATE);
        cnf.minSuccessRate = loadedConfigObj.TFE_MIN_SUCCESS_RATE;
      }

      if (loadedConfigObj.TFE_NUM_RANDOM_NETWORKS !== undefined){
        console.log("LOADED TFE_NUM_RANDOM_NETWORKS: " + loadedConfigObj.TFE_NUM_RANDOM_NETWORKS);
        cnf.numRandomNetworks = loadedConfigObj.TFE_NUM_RANDOM_NETWORKS;
      }

      if (loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS !== undefined){
        console.log("LOADED TFE_ENABLE_LANG_ANALYSIS: " + loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS);
        cnf.enableLanguageAnalysis = loadedConfigObj.TFE_ENABLE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_FORCE_LANG_ANALYSIS !== undefined){
        console.log("LOADED TFE_FORCE_LANG_ANALYSIS: " + loadedConfigObj.TFE_FORCE_LANG_ANALYSIS);
        cnf.forceLanguageAnalysis = loadedConfigObj.TFE_FORCE_LANG_ANALYSIS;
      }

      if (loadedConfigObj.TFE_ENABLE_STDIN !== undefined){
        console.log("LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.TFE_ENABLE_STDIN;
      }

      if (loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID  !== undefined){
        console.log("LOADED TFE_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID);
        cnf.loadNeuralNetworkID = loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID;
      }

      if (loadedConfigObj.TFE_USER_DB_CRAWL !== undefined){
        console.log("LOADED TFE_USER_DB_CRAWL: " + loadedConfigObj.TFE_USER_DB_CRAWL);
        cnf.userDbCrawl = loadedConfigObj.TFE_USER_DB_CRAWL;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER !== undefined){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER));
        cnf.twitterConfigFolder = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER;
      }

      if (loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE !== undefined){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE));
        cnf.twitterConfigFile = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE;
      }

      if (loadedConfigObj.TFE_TWITTER_USERS !== undefined){
        console.log("LOADED TFE_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TFE_TWITTER_USERS));
        cnf.twitterUsers = loadedConfigObj.TFE_TWITTER_USERS;
      }

      if (loadedConfigObj.TFE_TWITTER_DEFAULT_USER !== undefined){
        console.log("LOADED TFE_TWITTER_DEFAULT_USER: " + jsonPrint(loadedConfigObj.TFE_TWITTER_DEFAULT_USER));
        cnf.twitterDefaultUser = loadedConfigObj.TFE_TWITTER_DEFAULT_USER;
      }

      if (loadedConfigObj.TFE_KEEPALIVE_INTERVAL !== undefined) {
        console.log("LOADED TFE_KEEPALIVE_INTERVAL: " + loadedConfigObj.TFE_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.TFE_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){

        loadFile(cnf.twitterConfigFolder, cnf.twitterConfigFile, function(err, tc){
          if (err){
            console.error(chalkError("*** TWITTER YAML CONFIG LOAD ERROR\n" + err));
            quit();
            return;
          }

          cnf.twitterConfig = {};
          cnf.twitterConfig = tc;

          console.log(chalkInfo(getTimeStamp() + " | TWITTER CONFIG FILE " 
            + cnf.twitterConfigFolder
            + cnf.twitterConfigFile
          ));

          return(callback(err, cnf));

        });
      });
    }
    else {
      console.error("dropboxConfigFile: " + dropboxConfigFile + "\n" + jsonPrint(err));

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(userObj)));

      configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("INITIALIZE FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){ initStdIn(); }

      initStatsUpdate(function(){
        return(callback(err, cnf));
      });
     }
  });
}

function initCheckRateLimitInterval(interval){

  console.log(chalkInfo("INIT CHECK RATE INTERVAL | " + interval));

  checkRateLimitInterval = setInterval(function(){

    if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
      checkRateLimit();
    }

  }, interval);
}

function saveNetworkHashMap(params, callback){

  const folder = (params.folder === undefined) ? localBestNetworkFolder : params.folder;
  const nnIds = bestNetworkHashMap.keys();

  console.log(chalkNetwork("UPDATING NNs IN FOLDER " + folder));

  async.eachSeries(nnIds, function(nnId, cb) {

    const networkObj = bestNetworkHashMap.get(nnId);

    console.log(chalkNetwork("SAVING NN"
      + " | " + networkObj.network.networkId
      + " | " + networkObj.network.numInputs + " IN"
      + " | SR: " + networkObj.network.successRate.toFixed(2) + "%"
      + " | MR: " + networkObj.network.matchRate.toFixed(2) + "%"
      + " | " + networkObj.entry.name
    ));

    const file = nnId + ".json";

    saveFileQueue.push({folder: folder, file: file, obj: networkObj.network });

    cb();

  }, function(err){

    if (callback !== undefined) { callback(); }

  });
}

function updateNetworkStats(networkStatsObj, callback) {
  const nnIds = Object.keys(networkStatsObj);

  async.eachSeries(nnIds, function(nnId, cb) {

    if (bestNetworkHashMap.has(nnId)) {
      let networkObj = bestNetworkHashMap.get(nnId);
      networkObj.network.matchRate = networkStatsObj[nnId].matchRate;
      bestNetworkHashMap.set(nnId, networkObj);
      console.log(chalkNetwork("... UPDATED NETWORK MATCHRATE"
        + " | " + networkObj.network.matchRate.toFixed(2)
        + " | " + networkObj.network.networkId
      ));
      cb();
    }
    else {
      console.log(chalkAlert("??? NETWORK NOT IN BEST NETWORK HASHMAP ???"
        + " | " + nnId
      ));
      cb();
    }

  }, function(err){

    let folder;

    if (hostname === "google"){
      folder = configuration.testMode ? "/test" : bestNetworkFolder;
    }
    else {
      folder = configuration.testMode ? "/test" : localBestNetworkFolder;
    }

    saveNetworkHashMap({folder: folder}, function(){
      if (callback !== undefined) { callback(); }
    });
  });
}

function initRandomNetworkTreeMessageRxQueueInterval(interval, callback){

  randomNetworkTreeMessageRxQueueReadyFlag = true;

  console.log(chalkInfo("INIT RANDOM NETWORK TREE QUEUE INTERVAL: " + interval + " ms"));

  randomNetworkTreeMessageRxQueueInterval = setInterval(function () {

    if (randomNetworkTreeMessageRxQueueReadyFlag && (randomNetworkTreeMessageRxQueue.length > 0)) {

      randomNetworkTreeMessageRxQueueReadyFlag = false;

      let m = randomNetworkTreeMessageRxQueue.shift();

      let user = {};
      let entry = {};
      let hmObj = {};
      let prevHmObj = {};
      let fileObj = {};
      let file;

      switch (m.op) {

        case "IDLE":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          randomNetworkTreeBusyFlag = false;
          runEnable();
          console.log(chalkInfo("... RNT IDLE ..."));
        break;

        case "STATS":
          console.log(chalkInfo(getTimeStamp() + " | RNT_STATS"
            + "\n" + jsonPrint(Object.keys(m.statsObj))
          ));

          updateNetworkStats(m.statsObj.loadedNetworks, function(){
            randomNetworkTreeMessageRxQueueReadyFlag = true;
            randomNetworkTreeReadyFlag = true;
          });

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
          randomNetworkTreeBusyFlag = true;
          debug(chalkInfo("... RNT NETWORK_BUSY ..."));
        break;

        case "QUEUE_READY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          // randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q READY"));
          runEnable();
        break;

        case "QUEUE_EMPTY":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          // randomNetworkTreeReadyFlag = true;
          debug(chalkInfo("RNT Q EMPTY"));
          runEnable();
        break;

        case "QUEUE_FULL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = false;
          randomNetworkTreeBusyFlag = true;
          console.log(chalkError("!!! RNT Q FULL"));
        break;

        case "RNT_TEST_PASS":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          console.log(chalkTwitter(getTimeStamp() + " | RNT_TEST_PASS | RNT READY: " + randomNetworkTreeReadyFlag));
          runEnable();
        break;

        case "RNT_TEST_FAIL":
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          console.log(chalkAlert(getTimeStamp() + " | RNT_TEST_FAIL"));
          quit("RNT_TEST_FAIL");
        break;

        case "NETWORK_OUTPUT":

          debug(chalkAlert("RNT NETWORK_OUTPUT\n" + jsonPrint(m.output)));

          debug(chalkAlert("RNT NETWORK_OUTPUT | " + m.bestNetwork.networkId));

          bestRuntimeNetworkId = m.bestNetwork.networkId;

          if (bestNetworkHashMap.has(bestRuntimeNetworkId)) {

            hmObj = bestNetworkHashMap.get(bestRuntimeNetworkId);

            hmObj.network.matchRate = m.bestNetwork.matchRate;
            hmObj.network.successRate = m.bestNetwork.successRate;

            currentBestNetwork = deepcopy(hmObj.network);
            currentBestNetwork.matchRate = m.bestNetwork.matchRate;
            currentBestNetwork.successRate = m.bestNetwork.successRate;

            bestNetworkHashMap.set(bestRuntimeNetworkId, hmObj);

            if ((hostname === "google") && (prevBestNetworkId !== bestRuntimeNetworkId)) {

              prevBestNetworkId = bestRuntimeNetworkId;

              console.log(chalkNetwork("... SAVING NEW BEST NETWORK | " + currentBestNetwork.networkId + " | " + currentBestNetwork.matchRate.toFixed(2)));

              fileObj = {
                networkId: bestRuntimeNetworkId, 
                successRate: m.bestNetwork.successRate, 
                matchRate:  m.bestNetwork.matchRate,
                updatedAt: moment()
              };

              file = bestRuntimeNetworkId + ".json";

              saveFileQueue.push({folder: bestNetworkFolder, file: file, obj: currentBestNetwork });
              saveFileQueue.push({folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj });
            }


            debug(chalkAlert("NETWORK_OUTPUT"
              + " | " + moment().format(compactDateTimeFormat)
              + " | " + m.bestNetwork.networkId
              + " | RATE: " + currentBestNetwork.successRate.toFixed(1) + "%"
              + " | RT RATE: " + m.bestNetwork.matchRate.toFixed(1) + "%"
              // + " | TR RATE: " + currentBestNetwork.successRate.toFixed(1) + "%"
              + " | @" + m.user.screenName
              + " | KWs: " + Object.keys( m.user.keywords)
              + " | KWAs: " + Object.keys( m.user.keywordsAuto)
              + " | NKWAs: " + Object.keys( m.keywordsAuto)
              // + jsonPrint(currentBestNetwork)
            ));

            user = {};
            user = deepcopy(m.user);
            user.keywordsAuto = {};
            user.keywordsAuto = m.keywordsAuto;

            userDbUpdateQueue.push(user);

          }

          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          runEnable();
        break;

        case "BEST_MATCH_RATE":
          console.log(chalkAlert("*** RNT_BEST_MATCH_RATE"
            + " | " + m.networkId
            + " | IN ID: " + m.inputsId
            + " | " + m.numInputs + " IN"
            + " | SR: " + m.successRate.toFixed(2) + "%"
            + " | MR: " + m.matchRate.toFixed(2) + "%"
            + "\n*** PREV: " + m.previousBestNetworkId
            + " | PMR: " + m.previousBestMatchRate.toFixed(2) + "%"
          ));

          if (bestNetworkHashMap.has(m.networkId)) {

            hmObj = bestNetworkHashMap.get(m.networkId);
            hmObj.network.matchRate = m.matchRate;

            currentBestNetwork = deepcopy(hmObj.network);
            currentBestNetwork.matchRate = m.matchRate;

            bestNetworkHashMap.set(m.networkId, hmObj);

            if ((hostname === "google") && (prevBestNetworkId !== m.networkId)) {

              prevBestNetworkId = m.networkId;

              console.log(chalkBlue("... SAVING NEW BEST NETWORK | " + currentBestNetwork.networkId + " | " + currentBestNetwork.matchRate.toFixed(2)));

              fileObj = {
                networkId: currentBestNetwork.networkId, 
                successRate: currentBestNetwork.successRate, 
                matchRate:  currentBestNetwork.matchRate
              };

              file = currentBestNetwork.networkId + ".json";

              saveFileQueue.push({folder: bestNetworkFolder, file: file, obj: currentBestNetwork });
              saveFileQueue.push({folder: bestNetworkFolder, file: bestRuntimeNetworkFileName, obj: fileObj });
            }
          }
          else {
            console.log(chalkError(getTimeStamp() + "??? | RNT_BEST_MATCH_RATE | NETWORK NOT IN BEST NETWORK HASHMAP?"
              + " | " + m.networkId
              + " | " + m.matchRate.toFixed(2)
            ));
          }

          if (m.previousBestNetworkId && bestNetworkHashMap.has(m.previousBestNetworkId)) {

            prevHmObj = bestNetworkHashMap.get(m.previousBestNetworkId);
            prevHmObj.network.matchRate = m.previousBestMatchRate;

            bestNetworkHashMap.set(m.previousBestNetworkId, prevHmObj);

            if (hostname === "google") {

              console.log(chalkBlue("... PREV BEST NETWORK | " + m.previousBestNetworkId + " | " + m.previousBestMatchRate.toFixed(2)));

              saveFileQueue.push({folder: bestNetworkFolder, file: m.previousBestNetworkId + ".json", obj: prevHmObj.network });
            }
          }

          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          runEnable();
        break;

        default:
          randomNetworkTreeMessageRxQueueReadyFlag = true;
          randomNetworkTreeReadyFlag = true;
          console.error(chalkError("*** UNKNOWN RNT OP | " + m.op));
      }

    }
  }, interval);

  if (callback !== undefined) { callback(); }
}

function initLangAnalyzerMessageRxQueueInterval(interval, callback){

  langAnalyzerMessageRxQueueReadyFlag = true;

  console.log(chalkInfo("INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));

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
            + " | UID: " + m.obj.userId
            + " | SN: " + m.obj.screenName
            + " | N: " + m.obj.name
          ));

          m.obj.languageAnalyzed = true;

          if (m.error) {

            m.obj.languageAnalysis = {err: m.error};

            if (m.error.code === 8){ // LANGUAGE QUOTA; will be automatically retried
              console.log(chalkAlert("*** LANG QUOTA ERROR ... RETRY"
                + " | " + m.obj.userId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function(){
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }
            else if (m.error.code === 3){ // LANGUAGE unsupported
              console.log(chalkLog("... LANG ERROR ... UNSUPPORTED LANG"
                + " | " + m.obj.userId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
            }
            else {
              console.log(chalkError("*** LANG ERROR"
                + " | " + m.obj.userId
                + " | " + m.obj.screenName
                + " | CODE: " + m.error.code
              ));
              m.obj.languageAnalyzed = false;
              setTimeout(function(){
                langAnalyzerMessageRxQueueReadyFlag = true;
              }, 1000);
            }

            // console.log("LANG_RESULTS ERR | updateCountHistory: " + true);

            userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true }, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                let laEnts = 0;
                if (updatedUserObj.languageAnalysis.entities !== undefined) {
                  laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                }
                const kws = (updatedUserObj.keywords && (updatedUserObj.keywords !== undefined)) 
                  ? Object.keys(updatedUserObj.keywords) : [];
                const kwsAuto = (updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined)) 
                  ? Object.keys(updatedUserObj.keywordsAuto) : [];

                let threeceeFollowing = false;

                if (updatedUserObj.threeceeFollowing){
                  threeceeFollowing = (updatedUserObj.threeceeFollowing.screenName === undefined) ? false : updatedUserObj.threeceeFollowing.screenName ;
                }

                if (statsObj.numLangAnalyzed % 50 === 0) {
                  console.log(chalkLog("UPDATE LANG ERR | USER>DB"
                    + " | " + updatedUserObj.userId
                    // + " | NID: " + updatedUserObj.nodeId
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | 3CF: " + threeceeFollowing
                    + " | KWs: " + kws
                    + " | KWA: " + kwsAuto
                    + " | LA: " + updatedUserObj.languageAnalyzed
                    // + "\nLA Es: " + laEnts
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

              // console.log("LANG_RESULTS ENTS | updateCountHistory: " + true);

              userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj){
                if (err) { 
                  console.log(chalkError("ERROR DB UPDATE USER"
                    + "\n" + err
                    + "\n" + jsonPrint(m.obj)
                  ));
                }
                else {
                  let laEnts = 0;
                  if (updatedUserObj.languageAnalysis.entities !== undefined) {
                    laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                  }
                  const kws = (updatedUserObj.keywords && (updatedUserObj.keywords !== undefined)) 
                    ? Object.keys(updatedUserObj.keywords) : [];
                  const kwsAuto = (updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined))
                    ? Object.keys(updatedUserObj.keywordsAuto) : [];

                  let threeceeFollowing = false;

                  if (updatedUserObj.threeceeFollowing){
                    threeceeFollowing = (updatedUserObj.threeceeFollowing.screenName === undefined) ? false : updatedUserObj.threeceeFollowing.screenName ;
                  }

                  if (statsObj.numLangAnalyzed % 50 === 0) {
                    console.log(chalkLog("UPDATE LANG ANLZD"
                      + " | LA ENTS: " + langEntityKeys.length
                      + " | USER>DB"
                      + " | " + updatedUserObj.userId
                      + " | @" + updatedUserObj.screenName
                      + " | " + updatedUserObj.name
                      + " | Ts: " + updatedUserObj.statusesCount
                      + " | FLs: " + updatedUserObj.followersCount
                      + " | FRs: " + updatedUserObj.friendsCount
                      + " | 3CF: " + threeceeFollowing
                      + " | KWs: " + kws
                      + " | KWA: " + kwsAuto
                      + " | LA: " + updatedUserObj.languageAnalyzed
                      + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                      + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                      // + "\nLA Es: " + laEnts
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

            // console.log("LANG_RESULTS NO ENTS | updateCountHistory: " + true);

            userServer.findOneUser(m.obj, {noInc: true, updateCountHistory: true}, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                let laEnts = 0;
                if (updatedUserObj.languageAnalysis.entities !== undefined) {
                  laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                }
                const kws = (updatedUserObj.keywords && (updatedUserObj.keywords !== undefined)) 
                  ? Object.keys(updatedUserObj.keywords) : [];
                const kwsAuto = (updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined))
                  ? Object.keys(updatedUserObj.keywordsAuto) : [];

                let threeceeFollowing = false;
                
                if (updatedUserObj.threeceeFollowing){
                  threeceeFollowing = (updatedUserObj.threeceeFollowing.screenName === undefined) ? false : updatedUserObj.threeceeFollowing.screenName ;
                }

                if (statsObj.numLangAnalyzed % 50 === 0) {
                  console.log(chalkLog("UPDATE LANG ANLZD"
                    + " | LA ENTS: " + langEntityKeys.length
                    + " | USER>DB"
                    + " | " + updatedUserObj.userId
                    + " | @" + updatedUserObj.screenName
                    + " | " + updatedUserObj.name
                    + " | Ts: " + updatedUserObj.statusesCount
                    + " | FLs: " + updatedUserObj.followersCount
                    + " | FRs: " + updatedUserObj.friendsCount
                    + " | 3CF: " + threeceeFollowing
                    + " | KWs: " + kws
                    + " | KWA: " + kwsAuto
                    + " | LA: " + updatedUserObj.languageAnalyzed
                    + " S: " + updatedUserObj.languageAnalysis.sentiment.score.toFixed(2)
                    + " M: " + updatedUserObj.languageAnalysis.sentiment.magnitude.toFixed(2)
                    // + "\nLA Es: " + laEnts
                  ));
                }

              }
              langAnalyzerMessageRxQueueReadyFlag = true;
            }); 
          }
        break;

        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisReadyFlag = false;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisReadyFlag = true;
          langAnalyzerMessageRxQueueReadyFlag = true;
        break;

        default:
          console.log(chalkError("??? UNKNOWN LANG_ANALIZE OP: " + m.op
          ));
          langAnalyzerMessageRxQueueReadyFlag = true;
      }
    }
  }, interval);

  if (callback !== undefined) { callback(); }
}

const sortedObjectValues = function(params) {

  return new Promise(function(resolve, reject) {

    const keys = Object.keys(params.obj);

    const sortedKeys = keys.sort(function(a,b){
      const objA = params.obj[a];
      const objB = params.obj[b];
      return objB[params.sortKey] - objA[params.sortKey];
    });

    if (keys.length !== undefined) {
      resolve({sortKey: params.sortKey, sortedKeys: sortedKeys.slice(0,params.max)});
    }
    else {
      reject(new Error("ERROR"));
    }

  });
};

function printHistogram(title, hist){
  let tableArray = [];

  const sortedLabels = Object.keys(hist).sort(function(a,b){
    return hist[b] - hist[a];
  });

  async.eachSeries(sortedLabels, function(label, cb){
    tableArray.push([hist[label], label]);
    cb();
  }, function(){
    console.log(chalkInfo(
        "\n--------------------------------------------------------------"
      + "\n" + title + " | " + sortedLabels.length + " ENTRIES"  
      + "\n--------------------------------------------------------------\n"
      + table(tableArray, { align: [ "r", "l"] })
      + "\n--------------------------------------------------------------\n"
    ));
  });
}

function printDatum(title, input){

  let row = "";
  let col = 0;
  let rowNum = 0;
  const COLS = 50;

  debug("\n------------- " + title + " -------------");

  input.forEach(function(bit, i){
    if (i === 0) {
      row = row + bit.toFixed(10) + " | " ;
    }
    else if (i === 1) {
      row = row + bit.toFixed(10);
    }
    else if (i === 2) {
      debug("ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
    else if (col < COLS){
      row = row + (bit ? "X" : ".");
      col += 1;
    }
    else {
      debug("ROW " + rowNum + " | " + row);
      row = bit ? "X" : ".";
      col = 1;
      rowNum += 1;
    }
  });
}

function fetchFriends(params, callback) {

  debug(chalkInfo("FETCH FRIENDS\n" + jsonPrint(params)));

  if (nextUser) {
    console.log(chalkLog("fetchFriends"
      + " | CURRENT: @" + currentTwitterUser 
      + " | NEXT USER: " + nextUser
    ));
    callback(null, []);
  }
  else if (
    !statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag
    // && randomNetworkTreeReadyFlag
    // && languageAnalysisReadyFlag
    && runEnable()
    ) {

    twitterUserHashMap[currentTwitterUser].twit.get("friends/list", params, function(err, data, response){

      debug("response\n" + jsonPrint(response));

      if (err) {
        console.log(chalkError(getTimeStamp()
          + " | @" + currentTwitterUser
          + " | *** ERROR GET TWITTER FRIENDS: " + err
        ));

        if (err.code === 88){
          statsObj.user[currentTwitterUser].twitterRateLimitException = moment();
          statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = true;
          statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(moment().valueOf() + 60000);
          checkRateLimit();
          fsmPreviousState = fsm.getMachineState();
          fsm.fsm_rateLimitStart();
        }
        callback(err, []);
      }
      else {

        statsObj.users.grandTotalFriendsFetched += data.users.length;

        statsObj.user[currentTwitterUser].totalFriendsFetched += data.users.length;
        statsObj.user[currentTwitterUser].nextCursor = data.next_cursor_str;
        statsObj.user[currentTwitterUser].percentFetched = 100*(statsObj.user[currentTwitterUser].totalFriendsFetched/statsObj.user[currentTwitterUser].friendsCount); 

        if (configuration.testMode 
          && (statsObj.user[currentTwitterUser].totalFriendsFetched >= TEST_MODE_TOTAL_FETCH)) {

          statsObj.user[currentTwitterUser].nextCursorValid = false;
          statsObj.user[currentTwitterUser].endFetch = true;

          // nextUser = true;

          console.log(chalkAlert("\n=====================================\n"
            + " *** TEST MODE END FETCH"
            + "\n@" + currentTwitterUser + " | USER " + (currentTwitterUserIndex+1) + " OF " + configuration.twitterUsers.length
            + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
            + " | TEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
            + " | TOTAL FRIENDS FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
            + "\n=====================================\n"
          ));

        }
        else if (data.next_cursor_str > 0) {

          statsObj.user[currentTwitterUser].nextCursorValid = true;
          statsObj.user[currentTwitterUser].endFetch = false;

        }
        else {

          statsObj.user[currentTwitterUser].nextCursorValid = false;
          statsObj.user[currentTwitterUser].endFetch = true;
        }

        console.log(chalkTwitter("END FETCH ==========================================================================\n"
          + getTimeStamp()
          + " | @" + statsObj.user[currentTwitterUser].screenName
          + " | TOTAL FRIENDS: " + statsObj.user[currentTwitterUser].friendsCount
          + " | TOTAL FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
          + " [ " + statsObj.user[currentTwitterUser].percentFetched.toFixed(1) + "% ]"
          + " | COUNT: " + configuration.fetchCount
          + " | FETCHED: " + data.users.length
          + " | GRAND TOTAL FETCHED: " + statsObj.users.grandTotalFriendsFetched
          + " | END FETCH: " + statsObj.user[currentTwitterUser].endFetch
          + " | MORE: " + statsObj.user[currentTwitterUser].nextCursorValid
          + "\n===================================================================================="
        ));

        const subFriendsSortedArray = sortOn(data.users, "-followers_count");

        async.eachSeries(subFriendsSortedArray, function (friend, cb){

          friend.threeceeFollowing = {};
          friend.threeceeFollowing.screenName = currentTwitterUser;

          processUser({}, friend, null, function(err, user){
            if (err) {
              console.trace("processUser ERROR");
              return (cb(err));
            }
            statsObj.user[currentTwitterUser].friendsProcessed += 1;

            statsObj.user[currentTwitterUser].percentProcessed = 100*statsObj.user[currentTwitterUser].friendsProcessed/statsObj.user[currentTwitterUser].friendsCount;

            debug("PROCESSED USER\n" + jsonPrint(user));

            if (configuration.testMode || (statsObj.user[currentTwitterUser].friendsProcessed % 50 === 0)) {

              statsObj.user[currentTwitterUser].friendsProcessElapsed = moment().diff(statsObj.user[currentTwitterUser].friendsProcessStart);

              console.log(chalkLog("<FRND PRCSSD"
                + " [ @" + currentTwitterUser + " ]"
                + " | PRCSSD: " + statsObj.user[currentTwitterUser].friendsProcessed + "/" + statsObj.user[currentTwitterUser].friendsCount
                + " (" + statsObj.user[currentTwitterUser].percentProcessed.toFixed(2) + "%)"
                + " | S: " + statsObj.user[currentTwitterUser].friendsProcessStart.format(compactDateTimeFormat)
                + " | E: " + msToTime(statsObj.user[currentTwitterUser].friendsProcessElapsed)
                // + " | " + friend.id_str
                + " | @" + friend.screen_name
                // + " | 3CF: " + friend.threeceeFollowing.screenName
                + " | Ts: " + friend.statuses_count
                + " | FLWRs: " + friend.followers_count
                + " | FRNDs: " + friend.friends_count
              ));
            }

            async.setImmediate(function() { cb(); });

          });

        }, function subFriendsProcess(err){
          if (err) {
            console.trace("subFriendsProcess ERROR");
            callback(err, null);
          }
          else {
            callback(null, subFriendsSortedArray);
          }
        });

      }

    });
  }
  else {

    if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {

      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      console.log(chalkAlert("SKIP FETCH FRIENDS *** TWITTER RATE LIMIT"
        + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
        + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
        + " | NOW: " + moment().format(compactDateTimeFormat)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
      ));
    }

    console.log(chalkLog("fetchFriends"
      + " | CURRENT: @" + currentTwitterUser 
      + " | NEXT USER: " + nextUser
      + " | RATE LIMIT: " + statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag
      + " | randomNetworkTreeReadyFlag: " + randomNetworkTreeReadyFlag
      + " | languageAnalysisReadyFlag: " + languageAnalysisReadyFlag
      + " | runEnable: " + runEnable()
    ));

    callback(null, []);
  }
}

function initNextTwitterUser(callback){

  statsObj.user[currentTwitterUser].friendsProcessEnd = moment();
  statsObj.user[currentTwitterUser].friendsProcessElapsed = moment().diff(statsObj.user[currentTwitterUser].friendsProcessStart);

  console.log(chalkBlue("INIT NEXT TWITTER USER"
    // + " | CURRENT USER: @" + currentTwitterUser
    // + " | USER " + (currentTwitterUserIndex+1) + " OF " + configuration.twitterUsers.length
    // + " | FRIENDS: " + statsObj.user[currentTwitterUser].friendsCount
    // + " | TEST MODE: " + configuration.testMode
    // + " | FETCH COUNT: " + configuration.fetchCount
    // + " | TOTAL FETCHED: " + statsObj.user[currentTwitterUser].totalFriendsFetched
    // + " | ABORT CURSOR: " + abortCursor
    // + " | NEXT CURSOR: " + statsObj.user[currentTwitterUser].nextCursorValid
    // + " | TEST MODE: " + configuration.testMode
    + " | TEST MODE: " + configuration.testMode
    + "\nCURRENT USER:  @" + currentTwitterUser
    + "\nFRIENDS:       " + statsObj.user[currentTwitterUser].friendsCount
    + "\nTOTAL FETCHED  " + statsObj.user[currentTwitterUser].totalFriendsFetched
    + "\nEND FETCH:     " + statsObj.user[currentTwitterUser].endFetch
    + "\nSTART:         " + statsObj.user[currentTwitterUser].friendsProcessStart.format(compactDateTimeFormat)
    + "\nEND:           " + statsObj.user[currentTwitterUser].friendsProcessEnd.format(compactDateTimeFormat)
    + "\nELPSD:         " + msToTime(statsObj.user[currentTwitterUser].friendsProcessElapsed)
    + "\nNEXT USER:    " + nextUser
    + "\nABORT CURSOR: " + abortCursor
    + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
    + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
  ));

  if (currentTwitterUserIndex < configuration.twitterUsers.length-1) {

    currentTwitterUserIndex += 1;

    currentTwitterUser = configuration.twitterUsers[currentTwitterUserIndex];

    console.log(chalkTwitterBold("===== NEW FETCH USER"
      + " @" + currentTwitterUser + " ====="
      + " | USER " + (currentTwitterUserIndex+1) + " OF " + configuration.twitterUsers.length
      + " | " + getTimeStamp()
    ));

    twitterUserUpdate(currentTwitterUser, function(err){
      if (err){
        console.log("!!!!! TWITTER SHOW USER ERROR"
          + " | @" + currentTwitterUser 
          + " | " + getTimeStamp() 
          + "\n" + jsonPrint(err));
        callback(new Error(err), null);
      }
      statsObj.user[currentTwitterUser].nextCursor = false;
      statsObj.user[currentTwitterUser].nextCursorValid = false;
      statsObj.user[currentTwitterUser].totalFriendsFetched = 0;
      statsObj.user[currentTwitterUser].twitterRateLimit = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment();
      statsObj.user[currentTwitterUser].friendsProcessed = 0;
      statsObj.user[currentTwitterUser].percentProcessed = 0;
      statsObj.user[currentTwitterUser].friendsProcessStart = moment();
      statsObj.user[currentTwitterUser].friendsProcessEnd = moment();
      statsObj.user[currentTwitterUser].friendsProcessElapsed = 0;

      callback(null, currentTwitterUser);
    });
  }
  else {

    updateGlobalHistograms(function(){

      saveHistograms(function() {

        let waitTimeoutReady = true;
        let waitTimeout;

        randomNetworkTree.send({ op: "GET_STATS"}, function(err){

          async.until(

            function() {

              return (
                !randomNetworkTreeBusyFlag
                && (randomNetworkTreeMessageRxQueue.length === 0)
                && randomNetworkTreeMessageRxQueueReadyFlag
                && randomNetworkTreeReadyFlag
              );

            },

            function(cb){

              if (waitTimeoutReady) {

                waitTimeoutReady = false;

                clearTimeout(waitTimeout);

                waitTimeout = setTimeout(function(){
                  console.log(chalkBlue("... WAIT RANDOM_NETWORK_TREE IDLE..."
                    + " | " + getTimeStamp()
                    + " | randomNetworkTreeBusyFlag: " + randomNetworkTreeBusyFlag 
                    + " | randomNetworkTreeMessageRxQueueReadyFlag: " + randomNetworkTreeMessageRxQueueReadyFlag 
                    + " | randomNetworkTreeReadyFlag: " + randomNetworkTreeReadyFlag 
                    + " | randomNetworkTreeMessageRxQueue: " + randomNetworkTreeMessageRxQueue.length 
                  ));

                  waitTimeoutReady = true;

                  cb();
                }, 1000);

              }
              else {
                cb();
              }


          }, function(err){

            randomNetworkTree.send({ op: "RESET_STATS"}, function(err){

              currentTwitterUserIndex = 0;
              currentTwitterUser = configuration.twitterUsers[currentTwitterUserIndex];

              statsObj.user[currentTwitterUser].nextCursor = false;
              statsObj.user[currentTwitterUser].nextCursorValid = false;
              statsObj.user[currentTwitterUser].totalFriendsFetched = 0;
              statsObj.user[currentTwitterUser].twitterRateLimit = 0;
              statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
              statsObj.user[currentTwitterUser].twitterRateLimitRemaining = 0;
              statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = 0;
              statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment();
              statsObj.user[currentTwitterUser].friendsProcessed = 0;
              statsObj.user[currentTwitterUser].percentProcessed = 0;
              statsObj.user[currentTwitterUser].friendsProcessStart = moment();
              statsObj.user[currentTwitterUser].friendsProcessEnd = moment();
              statsObj.user[currentTwitterUser].friendsProcessElapsed = 0;

              console.log(chalkTwitterBold("\n=========================\n"
                + "=========================\n"
                + "=========================\n"
                + "*** RESTART FETCH USERS ***"
                + " | ===== NEW FETCH USER @" 
                + currentTwitterUser + " ====="
                + " | " + getTimeStamp()
                + "\n=========================\n"
                + "=========================\n"
                + "=========================\n"
              ));

              processFriendsReady = true;

              callback(null, currentTwitterUser);

            });

          });
        });
      });

    });

  }
}

function printNetworkObj(title, nnObj){
  console.log(chalkNetwork("======================================"
    + "\n" + title
    + "\nID:         " + nnObj.networkId
    + "\nCREATED:    " + getTimeStamp(nnObj.createdAt)
    + "\nSUCCESS:    " + nnObj.successRate.toFixed(2) + "%" 
    + "\nMATCH:      " + nnObj.matchRate.toFixed(2) + "%" 
    + "\nINPUTS ID:  " + nnObj.inputsId
    + "\nINPUTS:     " + Object.keys(nnObj.inputsObj.inputs)
    + "\nNUM INPUTS: " + nnObj.numInputs
    // + "\nEVOLVE\n" + jsonPrint(nnObj.evolve)
    + "\n======================================\n"
  ));
}

function initRandomNetworks(params, callback){

  if (loadedNetworksFlag) {
    console.log(chalkAlert("SKIP INIT RANDOM NETWORKS: loadedNetworksFlag: " + loadedNetworksFlag));
    return callback(null, randomNetworksObj);
  }

  async.each(Object.keys(randomNetworksObj), function(nnId, cb){

    previousRandomNetworksHashMap[nnId] = {};
    previousRandomNetworksHashMap[nnId] = statsObj.bestNetworks[nnId] || true;

    delete randomNetworksObj[nnId];

    cb();

  }, function(err){
    
    randomNetworksObj = {};

    async.whilst(

      function() {

        // console.log("Object.keys(availableNeuralNetHashMap).length: " + Object.keys(availableNeuralNetHashMap).length);

        return (Object.keys(availableNeuralNetHashMap).length > 0) 
        && (Object.keys(randomNetworksObj).length < params.numRandomNetworks) ;

      },

      function(cb){

        const nnId = randomItem(Object.keys(availableNeuralNetHashMap));

        delete availableNeuralNetHashMap[nnId];

        const nn = bestNetworkHashMap.get(nnId);
        randomNetworksObj[nnId] = {};
        randomNetworksObj[nnId] = nn;

        console.log(chalkBlue("+++ RANDOM NETWORK"
          + " [" + Object.keys(randomNetworksObj).length + "]"
          + " | AVAIL NNs: " + Object.keys(availableNeuralNetHashMap).length
          + " | SR: " + randomNetworksObj[nnId].network.successRate.toFixed(2) + "%"
          + " | MR: " + randomNetworksObj[nnId].network.matchRate.toFixed(2) + "%"
          + " | " + nnId
        ));

        cb();

    }, function(err){

      loadedNetworksFlag = true;
      callback(err, randomNetworksObj);

    });

  });
}

function loadBestNetworkDropboxFolder(folder, callback){

  let options = {path: folder};
  let newBestNetwork = false;
  statsObj.numNetworksLoaded = 0;
  statsObj.numNetworksUpdated = 0;

  dropboxClient.filesListFolder(options)
  .then(function(response){

    // clearTimeout(loadDropboxFolderTimeout);

    if (response.entries.length === 0) {
      console.log(chalkLog("TFE | NO DROPBOX NETWORKS FOUND"
        + " | " + options.path
      ));
      if (callback !== undefined) { 
        return callback( null, {best: currentBestNetwork} );
      }
      else {
        return;
      }
    }

    console.log(chalkLog("TFE | DROPBOX NETWORKS"
      + " | " + options.path
      + " | FOUND " + response.entries.length + " FILES"
      // + " | " + jsonPrint(response)
    ));

    if (configuration.testMode) {
      response.entries.length = Math.min(response.entries.length, TEST_DROPBOX_NN_LOAD);
    }

    async.eachSeries(response.entries, function(entry, cb){

      debug(chalkLog("DROPBOX NETWORK FOUND"
        + " | " + options.path
        + " | " + entry.name
      ));

      if (entry.name === bestRuntimeNetworkFileName) {
        return(cb());
      }

      const networkId = entry.name.replace(".json", "");

      if (bestNetworkHashMap.has(networkId)){

        const bno = bestNetworkHashMap.get(networkId);

        if (!bno || (bno === undefined)) {
          console.error(chalkError("bestNetworkHashMap ENTRY UNDEFINED??? | " + networkId));
          // quit("bestNetworkHashMap ENTRY UNDEFINED");
          return(cb());
        }

        if (bno.entry === undefined) {
          console.log(chalkError("bestNetworkHashMap ENTRY PROP UNDEFINED??? | " + networkId + "\n" + jsonPrint(bno)));
          // quit("bestNetworkHashMap ENTRY PROP UNDEFINED");
          return(cb());
        }

        if (bno.entry.content_hash !== entry.content_hash) {

          console.log(chalkInfo("DROPBOX NETWORK CONTENT CHANGE"
            + " | " + getTimeStamp(entry.client_modified)
            + " | " + entry.name
            // + "\nCUR HASH: " + entry.content_hash
            // + "\nOLD HASH: " + bno.entry.content_hash
          ));

          loadFile(folder, entry.name, function(err, networkObj){

            if (err) {
              console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
              return(cb());
            }

            if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }

            statsObj.numNetworksUpdated += 1;

            console.log(chalkInfo("+0+ LOADED UPDATED DROPBOX NETWORK"
              + " [ UPDATED: " + statsObj.numNetworksUpdated + " | LOADED: " + statsObj.numNetworksLoaded + "]" 
              + " SR: " + networkObj.successRate.toFixed(2) + "%"
              + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
              + " | " + getTimeStamp(networkObj.createdAt)
              + " | " + networkObj.networkId
              + " | " + networkObj.networkCreateMode
              + " | IN: " + networkObj.numInputs
              + " | OUT: " + networkObj.numOutputs
            ));


            const hmObj = {
              entry: entry,
              network: networkObj
            };

            bestNetworkHashMap.set(networkObj.networkId, hmObj);

            if (!currentBestNetwork || (networkObj.matchRate > currentBestNetwork.matchRate)) {
              // currentBestNetwork = {};
              currentBestNetwork = deepcopy(networkObj);
              prevBestNetworkId = bestRuntimeNetworkId;
              bestRuntimeNetworkId = networkObj.networkId;
              newBestNetwork = true;
              if (hostname === "google") {

                const fileObj = {
                  networkId: bestRuntimeNetworkId, 
                  successRate: networkObj.successRate, 
                  matchRate:  networkObj.matchRate
                };

                saveFileQueue.push({folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj });
              }
            }
            async.setImmediate(function() { cb(); });

          });
        }
        else {
          debug(chalkLog("DROPBOX NETWORK CONTENT SAME  "
            + " | " + entry.name
            // + " | " + getTimeStamp(entry.client_modified)
          ));

          async.setImmediate(function() { cb(); });
        }
      }
      else {

        loadFile(folder, entry.name, function(err, networkObj){

          if (err) {
            console.log(chalkError("DROPBOX NETWORK LOAD FILE ERROR: " + err));
            return(cb());
          }

          if ((networkObj.successRate >= configuration.minSuccessRate) || (networkObj.matchRate >= configuration.minSuccessRate)) {

            if (networkObj.matchRate === undefined) { networkObj.matchRate = 0; }

            statsObj.numNetworksLoaded += 1;

            console.log(chalkBlue("+++ LOADED NEW DROPBOX NETWORK"
              + " [ UPDATED: " + statsObj.numNetworksUpdated + " | LOADED: " + statsObj.numNetworksLoaded + "]" 
              + " SR: " + networkObj.successRate.toFixed(2) + "%"
              + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
              + " | " + networkObj.networkCreateMode
              + " | IN: " + networkObj.numInputs
              + " | OUT: " + networkObj.numOutputs
              + " | " + getTimeStamp(networkObj.createdAt)
              + " | " + networkObj.networkId
            ));


            bestNetworkHashMap.set(networkObj.networkId, { entry: entry, network: networkObj});

            availableNeuralNetHashMap[networkObj.networkId] = true;

            if (!currentBestNetwork || (networkObj.matchRate > currentBestNetwork.matchRate)) {
              currentBestNetwork = deepcopy(networkObj);
              prevBestNetworkId = bestRuntimeNetworkId;
              bestRuntimeNetworkId = networkObj.networkId;
              newBestNetwork = true;

              if (hostname === "google") {

                const fileObj = {
                  networkId: bestRuntimeNetworkId, 
                  successRate: networkObj.successRate, 
                  matchRate:  networkObj.matchRate
                };

                saveFileQueue.push({folder: folder, file: bestRuntimeNetworkFileName, obj: fileObj });
              }
            }

            async.setImmediate(function() { cb(); });

          }
          else {
            console.log(chalkInfo("--- DROPBOX NETWORK ... SKIPPING"
              + " [ UPDATED: " + statsObj.numNetworksUpdated + " | LOADED: " + statsObj.numNetworksLoaded + "]" 
              + " SR: " + networkObj.successRate.toFixed(2) + "%"
              + " | MR: " + networkObj.matchRate.toFixed(2) + "%"
              + " | " + getTimeStamp(networkObj.createdAt)
              + " | " + networkObj.networkId
              + " | " + networkObj.networkCreateMode
              + " | IN: " + networkObj.numInputs
              + " | OUT: " + networkObj.numOutputs
            ));
            async.setImmediate(function() { cb(); });
          }

        });
      }
    }, function(){

      let messageText;

      if (newBestNetwork) {
        newBestNetwork = false;
        // statsObj.bestRuntimeNetworkId = currentBestNetwork.networkId;
        printNetworkObj("BEST NETWORK", currentBestNetwork);
      }

      console.log(chalkAlert("\n===================================\n"
        + "LOADED DROPBOX NETWORKS"
        + "\nFOLDER:        " + options.path
        + "\nFILES FOUND:   " + response.entries.length + " FILES"
        + "\nNN DOWNLOADED: " + statsObj.numNetworksLoaded
        + "\nNN UPDATED:    " + statsObj.numNetworksUpdated
        + "\nNN IN HASHMAP: " + bestNetworkHashMap.size
        + "\nNN AVAIL:      " + Object.keys(availableNeuralNetHashMap).length
        + "\n===================================\n"
      ));

      if (callback !== undefined) { callback( null, {best: currentBestNetwork} ); }
    });
  })
  .catch(function(err){

    // clearTimeout(loadDropboxFolderTimeout);

    console.log(chalkError("loadBestNetworkDropboxFolder *** DROPBOX FILES LIST FOLDER ERROR"
      + "\nOPTIONS: " + jsonPrint(options)
      + "\nERROR: " + err 
      + "\nERROR: " + jsonPrint(err)
    ));
    if (callback !== undefined) { callback(err, null); }
  });
}

function loadBestNeuralNetworkFile(callback){

  console.log(chalkLog("... LOADING DROPBOX NEURAL NETWORKS"
    + " | FOLDER: " + bestNetworkFolder
    + " | TIMEOUT: " + DEFAULT_DROPBOX_TIMEOUT + " MS"
  ));

  loadBestNetworkDropboxFolder(bestNetworkFolder, function(err, results){

    if (err) {
      console.log(chalkError("LOAD DROPBOX NETWORKS ERROR: " + err));
      if (err === "DROPBOX_TIMEOUT") {

      }
      callback(new Error(err), null);
    }
    else if (results.best === undefined) {
      console.log(chalkAlert("??? NO BEST DROPBOX NETWORK ???"));
      callback(null, null);
    }
    else {

      initRandomNetworks({ numRandomNetworks: configuration.numRandomNetworks }, function(err, ranNetObj){

        if (loadedNetworksFlag && !networksSentFlag && (randomNetworkTree !== undefined) && (Object.keys(ranNetObj).length > 0)) {
          console.log(chalkBlue("SEND RANDOM NETWORKS | " + Object.keys(ranNetObj).length));

          networksSentFlag = true;

          randomNetworkTree.send({ op: "LOAD_NETWORKS", networksObj: ranNetObj }, function(err){
            networksSentFlag = false;
            console.log(chalkBlue("SEND RANDOM NETWORKS | " + Object.keys(ranNetObj).length));
          });
        }
        else {
          const randomNetworkTreeDefined = (randomNetworkTree !== undefined);
          console.log(chalkAlert("*** RANDOM NETWORKS NOT SENT"
            + " | NNs: " + Object.keys(ranNetObj).length
            + " | randomNetworkTree: " + randomNetworkTreeDefined
            + " | loadedNetworksFlag: " + loadedNetworksFlag
            + " | networksSentFlag: " + networksSentFlag
          ));
        }

        let bnwObj;
        let nnObj;

        if (bestRuntimeNetworkId && bestNetworkHashMap.has(bestRuntimeNetworkId)) {

          if (currentBestNetworkId !== bestRuntimeNetworkId) {

            currentBestNetworkId = bestRuntimeNetworkId;

            nnObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnwObj = deepcopy(nnObj.network);

            bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;

            console.log(chalkBlue(">>> NEW BEST RUNTIME NETWORK"
              + " | " + bnwObj.networkId 
              + " | SUCCESS: " + bnwObj.successRate.toFixed(2) 
              + " | MATCH: " + bnwObj.matchRate.toFixed(2) 
              // + "\n\n"
            ));

            printNetworkObj("LOADED NETWORK", bnwObj);

            Object.keys(bnwObj.inputsObj.inputs).forEach(function(type){
              debug(chalkNetwork("NN INPUTS TYPE" 
                + " | " + type
                + " | INPUTS: " + bnwObj.inputsObj.inputs[type].length
              ));
              inputArrays[type] = bnwObj.inputsObj.inputs[type];
            });

          }
          else {

            nnObj = bestNetworkHashMap.get(bestRuntimeNetworkId);
            bnwObj = deepcopy(nnObj.network);

            bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;

            console.log(chalkBlue("... UPDATED BEST RUNTIME NETWORK"
              + " | " + bnwObj.networkId 
              + " | SUCCESS: " + bnwObj.successRate.toFixed(2) 
              + " | MATCH: " + bnwObj.matchRate.toFixed(2) 
              // + "\n\n"
            ));

            nnObj.network = deepcopy(bnwObj);
            bestNetworkHashMap.set(currentBestNetworkId, nnObj);
            printNetworkObj("LOADED NETWORK", bnwObj);

          }

          if (bnwObj.inputsObj.inputs.images === undefined) { bnwObj.inputsObj.inputs.images = ["businesss"]; }

          statsObj.bestRuntimeNetworkId = bestRuntimeNetworkId;
          statsObj.currentBestNetworkId = bnwObj.networkId;
          statsObj.network.networkId = bnwObj.networkId;
          statsObj.network.networkType = bnwObj.networkType;
          statsObj.network.successRate = bnwObj.successRate;
          statsObj.network.input = bnwObj.network.input;
          statsObj.network.output = bnwObj.network.output;
          statsObj.network.evolve = {};
          statsObj.network.evolve = bnwObj.evolve;
          statsObj.network.evolve.options.networkObj = null;

          callback(null, bnwObj);
        }
        else if (currentBestNetworkId && bestNetworkHashMap.has(currentBestNetworkId)) {

          nnObj = bestNetworkHashMap.get(currentBestNetworkId);
          bnwObj = deepcopy(nnObj.network);

          bnwObj.matchRate = (bnwObj.matchRate !== undefined) ? bnwObj.matchRate : 0;

          console.log(chalkBlue("... UPDATED BEST RUNTIME NETWORK"
            + " | " + bnwObj.networkId 
            + " | SUCCESS: " + bnwObj.successRate.toFixed(2) 
            + " | MATCH: " + bnwObj.matchRate.toFixed(2) 
            // + "\n\n"
          ));

          nnObj.network = deepcopy(bnwObj);
          bestNetworkHashMap.set(currentBestNetworkId, nnObj);

          printNetworkObj("LOADED NETWORK", bnwObj);
          callback(null, bnwObj);
        }

      });

    }
  });
}

function updateNetworkFetchFriends(callback){

  updateNetworkFetchFriendsReadyFlag = false;

  console.log(chalkBlue("UPDATE NETWORK + FETCH FRIENDS | @" + currentTwitterUser));

  loadBestNeuralNetworkFile(function(err, nnObj){

    if (err) {
      console.error(chalkError("*** LOAD BEST NETWORK FILE ERROR: " + err));
      updateNetworkFetchFriendsReadyFlag = true;
      return callback(err);
    }

    let params = {};
    params.count = statsObj.user[currentTwitterUser].count;

    if (statsObj.user[currentTwitterUser].nextCursorValid) {
      params.cursor = parseInt(statsObj.user[currentTwitterUser].nextCursor);
      statsObj.user[currentTwitterUser].cursor = parseInt(statsObj.user[currentTwitterUser].nextCursor);
    }
    else {
      statsObj.user[currentTwitterUser].cursor = null;
    }

    debug("updateNetworkFetchFriends fetchFriends params\n" + jsonPrint(params));

    if (runEnable()) {

      fetchFriends(params, function(err, subFriendsSortedArray){
        if (err) {
          console.log(chalkError("FETCH FRIENDS ERROR: " + err));
          updateNetworkFetchFriendsReadyFlag = true;
          callback(err, {endFetch: statsObj.user[currentTwitterUser].endFetch, nextUser: nextUser});
        }
        else {

          // console.log(chalkInfo("FETCH FRIENDS" 
          //   + " | @" + currentTwitterUser
          //   + " | TOTAL FETCHED " + statsObj.user[currentTwitterUser].totalFriendsFetched
          //   + " | FETCHED " + subFriendsSortedArray.length
          //   + " | END FETCH: " + statsObj.user[currentTwitterUser].endFetch
          //   + " | NEXT USER: " + nextUser
          //   + " | ABORT CURSOR: " + abortCursor
          // ));

          if (nextUser 
            || abortCursor 
            || (configuration.testMode && (statsObj.user[currentTwitterUser].totalFriendsFetched >= TEST_MODE_TOTAL_FETCH) && !statsObj.user[currentTwitterUser].nextCursorValid)
            || ((statsObj.user[currentTwitterUser].totalFriendsFetched >= statsObj.user[currentTwitterUser].friendsCount) && !statsObj.user[currentTwitterUser].nextCursorValid)
            ) {

            statsObj.user[currentTwitterUser].friendsProcessEnd = moment();
            statsObj.user[currentTwitterUser].friendsProcessElapsed = moment().diff(statsObj.user[currentTwitterUser].friendsProcessStart);

            console.log(chalkInfo(">>> | FETCH USER END" 
              + " | TEST MODE: " + configuration.testMode
              + "\n@" + currentTwitterUser
              + "\nTOTAL FETCHED " + statsObj.user[currentTwitterUser].totalFriendsFetched
              + "\nFETCHED       " + subFriendsSortedArray.length
              + "\nEND FETCH:    " + statsObj.user[currentTwitterUser].endFetch
              + "\nSTART:        " + statsObj.user[currentTwitterUser].friendsProcessStart.format(compactDateTimeFormat)
              + "\nEND:          " + statsObj.user[currentTwitterUser].friendsProcessEnd.format(compactDateTimeFormat)
              + "\nELPSD:        " + msToTime(statsObj.user[currentTwitterUser].friendsProcessElapsed)
              + "\nNEXT USER:    " + nextUser
              + "\nABORT CURSOR: " + abortCursor
              + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
              + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
            ));

            if (nextUser) { nextUser = false; }

            statsObj.user[currentTwitterUser].endFetch = true;
            fsm.fsm_fetchUserEnd();
          }
          else {

            statsObj.user[currentTwitterUser].friendsProcessElapsed = moment().diff(statsObj.user[currentTwitterUser].friendsProcessStart);

            console.log(chalkInfo("... | FETCH USER CONTINUE" 
              + " | TEST MODE: " + configuration.testMode
              + "\n@" + currentTwitterUser
              + "\nTOTAL FETCHED " + statsObj.user[currentTwitterUser].totalFriendsFetched
              + "\nFETCHED       " + subFriendsSortedArray.length
              + "\nEND FETCH:    " + statsObj.user[currentTwitterUser].endFetch
              + "\nSTART:        " + statsObj.user[currentTwitterUser].friendsProcessStart.format(compactDateTimeFormat)
              + "\nEND:          " + statsObj.user[currentTwitterUser].friendsProcessEnd.format(compactDateTimeFormat)
              + "\nELPSD:        " + msToTime(statsObj.user[currentTwitterUser].friendsProcessElapsed)
              + "\nNEXT USER:    " + nextUser
              + "\nABORT CURSOR: " + abortCursor
              + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
              + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
            ));

            fsm.fsm_fetchUserContinue();
          }
          updateNetworkFetchFriendsReadyFlag = true;
          callback(null, {endFetch: statsObj.user[currentTwitterUser].endFetch, nextUser: nextUser});
        }

      });
    }
    else {
      console.log(chalkLog("updateNetworkFetchFriends RUN ENABLED: " + runEnable()));
      console.log(chalkInfo("ooo | FETCH USER WAIT" 
        + " | TEST MODE: " + configuration.testMode
        + "\n@" + currentTwitterUser
        + "\nTOTAL FETCHED " + statsObj.user[currentTwitterUser].totalFriendsFetched
        + "\nEND FETCH:    " + statsObj.user[currentTwitterUser].endFetch
        + "\nSTART:        " + statsObj.user[currentTwitterUser].friendsProcessStart.format(compactDateTimeFormat)
        + "\nEND:          " + statsObj.user[currentTwitterUser].friendsProcessEnd.format(compactDateTimeFormat)
        + "\nELPSD:        " + msToTime(statsObj.user[currentTwitterUser].friendsProcessElapsed)
        + "\nNEXT USER:    " + nextUser
        + "\nABORT CURSOR: " + abortCursor
        + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
        + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
      ));
      updateNetworkFetchFriendsReadyFlag = true;
      callback(null, {endFetch: statsObj.user[currentTwitterUser].endFetch, nextUser: nextUser});
    }
  });
}

// function initFetchTwitterFriendsInterval(interval){


//   console.log(chalkBlue("\n\nINIT GET TWITTER FRIENDS"
//     + " | INTERVAL: " + msToTime(interval)
//     + " | RUN AT: " + moment().add(interval, "ms").format(compactDateTimeFormat)
//     + "\n\n"
//   ));

//   if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
//     console.error(chalkAlert("RATE LIMIT EXCEPTION"));
//     return;
//   }

//   statsObj.user[currentTwitterUser].count = configuration.fetchCount;
//   debug("statsObj.user[currentTwitterUser]\n" + jsonPrint(statsObj.user[currentTwitterUser]));

//   fetchTwitterFriendsIntervalometer = timerIntervalometer(function fetchTwitterFriendsIntervalFunc(){

//     if (runEnable()){
//       updateNetworkFetchFriends(function(err, results){});
//     }
//     else {
//       console.log(chalkAlert("fetchTwitterFriendsIntervalometer NOT READY"
//         + " | languageAnalysisReadyFlag: " + languageAnalysisReadyFlag
//         + " | classifiedUserHashmapReadyFlag: " + classifiedUserHashmapReadyFlag
//       ));
//       showStats();
//     }
//   }, interval);

//   fetchTwitterFriendsIntervalometer.start();
// }

function initUserDbUpdateQueueInterval(interval){

  console.log(chalkBlue("INIT USER DB UPDATE QUEUE INTERVAL: " + interval));

  clearInterval(userDbUpdateQueueInterval);

  userDbUpdateQueueInterval = setInterval(function userDbUpdateQueueInterval(){

    if (userDbUpdateQueueReadyFlag && (userDbUpdateQueue.length > 0)) {

      userDbUpdateQueueReadyFlag = false;

      let user = userDbUpdateQueue.shift();

      // console.log("userDbUpdateQueue | updateCountHistory: " + true);

      userServer.findOneUser(user, {noInc: true, updateCountHistory: true}, function updateUserComplete(err, updatedUserObj){

        userDbUpdateQueueReadyFlag = true;

        if (err){
          console.trace(chalkError("ERROR DB UPDATE USER - updateUserDb"
            + "\n" + err
            + "\n" + jsonPrint(user)
          ));
          return;
        }

        let keywords = "";
        let keywordsAuto = "";

        if ((updatedUserObj.keywords !== undefined) && updatedUserObj.keywords) {
          keywords = Object.keys(updatedUserObj.keywords);
        }

        if ((updatedUserObj.keywordsAuto !== undefined) && updatedUserObj.keywordsAuto) {
          keywordsAuto = Object.keys(updatedUserObj.keywordsAuto);
        }

        debug(chalkInfo("US UPD<"
          + " | " + updatedUserObj.userId
          + " | TW: " + updatedUserObj.isTwitterUser
          + " | @" + updatedUserObj.screenName
          + " | Ts: " + updatedUserObj.statusesCount
          + " | FLWRs: " + updatedUserObj.followersCount
          + " | FRNDs: " + updatedUserObj.friendsCount
          + " | LAd: " + updatedUserObj.languageAnalyzed
          + " | KWs: " + keywords
          + " | AKWs: " + keywordsAuto
        ));

      });
    }
  }, interval);
}

function initInputArrays(cnf, callback){

  console.log(chalkInfo("TFE | INIT INPUT ARRAYS"));
  debug(chalkInfo("TFE | INIT INPUT ARRAYS cnf\nTFE | " + jsonPrint(cnf)));

  let folder = dropboxConfigDefaultFolder;
  let inputFilePrefix = "defaultInput";

  statsObj.totalInputs = 0;  // LANG ANALYSIS INPUT

  async.eachSeries(inputTypes, function(inputType, cb){

    const inputFile = inputFilePrefix + jsUcfirst(inputType) + ".json";

    console.log("TFE | INIT " + inputType.toUpperCase() + " INPUT ARRAY: " + inputFile);

    loadFile(folder, inputFile, function(err, inputArrayObj){
      if (!err) {
        debug(jsonPrint(inputArrayObj));

        arrayUnique(inputArrayObj[inputType]);

        inputArrayObj[inputType].sort();

        inputArrays[inputType] = {};
        inputArrays[inputType] = inputArrayObj[inputType];

        statsObj.totalInputs += inputArrayObj[inputType].length;

        console.log(chalkInfo("TFE"
          + " | TOTAL INPUTS: " + statsObj.totalInputs
          + " | LOADED " + inputType.toUpperCase() + " ARRAY"
          + " | " + inputArrayObj[inputType].length + " " + inputType.toUpperCase()
        ));
        cb();
      }
      else {
        console.log(chalkError("TFE | ERROR: loadFile: " + folder + "/" + inputFile));
        cb(err);
      }
    });

  }, function(err){
    if (err){
      console.log(chalkError("TFE | ERR\nTFE | " + jsonPrint(err)));
      callback(err);
    }
    else {
      statsObj.totalInputs += 2; // LANG ANALYSIS INPUTS
      console.log(chalkInfo("TFE | LOADED INPUT ARRAY FILES | TOTAL INPUTS: " + statsObj.totalInputs));
      callback();
    }
  });
}

function initRandomNetworkTree(callback){

  console.log(chalkBlue("INIT RANDOM NETWORK TREE CHILD PROCESS"));


  randomNetworkTree = cp.fork(`randomNetworkTreeChild.js`);

  randomNetworkTree.on("message", function(m){

    switch (m.op) {
      case "IDLE":
        randomNetworkTreeBusyFlag = false;
        randomNetworkTreeReadyFlag = true;
        debug(chalkAlert("<== RNT RX"
          + " [" + randomNetworkTreeMessageRxQueue.length + "]"
          + " | " + m.op
        ));
      break;
      case "BUSY":
        randomNetworkTreeReadyFlag = false;
        randomNetworkTreeBusyFlag = true;
        debug(chalkAlert("<== RNT RX"
          + " [" + randomNetworkTreeMessageRxQueue.length + "]"
          + " | " + m.op
        ));
      break;
      default:

        randomNetworkTreeMessageRxQueue.push(m);

        debug(chalkAlert("<== RNT RX"
          + " [" + randomNetworkTreeMessageRxQueue.length + "]"
          + " | " + m.op
        ));
    }

  });

  randomNetworkTree.on("error", function(err){
    randomNetworkTreeBusyFlag = false;
    console.log(chalkError("*** randomNetworkTree ERROR ***\n" + jsonPrint(err)));
    quit(err);
  });

  randomNetworkTree.on("exit", function(err){
    randomNetworkTreeBusyFlag = false;
    console.log(chalkError("*** randomNetworkTree EXIT ***\n" + jsonPrint(err)));
    quit(err);
  });

  randomNetworkTree.on("close", function(code){
    randomNetworkTreeBusyFlag = false;
    console.log(chalkError("*** randomNetworkTree CLOSE *** | " + code));
    quit(code);
  });

  randomNetworkTree.send({ op: "INIT", interval: RANDOM_NETWORK_TREE_INTERVAL }, function(){
    if (callback !== undefined) { callback(); }
  });
}

function initLangAnalyzer(callback){

  console.log(chalkInfo("INIT LANGUAGE ANALYZER CHILD PROCESS"));

  langAnalyzer = cp.fork(`languageAnalyzerChild.js`);

  langAnalyzer.on("message", function(m){
    debug(chalkLog("<== LA RX"
      + " [" + langAnalyzerMessageRxQueue.length + "]"
      + " | " + m.op
    ));
    if (m.op === "LANG_TEST_FAIL") {
      console.log(chalkAlert(getTimeStamp() + " | LANG_TEST_FAIL"));
      if (m.err.code ===  8) {
        console.error(chalkAlert("LANG_TEST_FAIL"
          + " | LANGUAGE QUOTA"
          + " | " + m.err
        ));
        languageAnalysisReadyFlag = true;
        langAnalyzerIdle = false;
      }
      else {
        console.error(chalkAlert("LANG_TEST_FAIL"
          + " | " + m.err
        ));
        quit("LANG_TEST_FAIL");
      }
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisReadyFlag = true;
      langAnalyzerIdle = false;
      console.log(chalkTwitter(getTimeStamp() + " | LANG_TEST_PASS | LANG ANAL READY: " + languageAnalysisReadyFlag));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisReadyFlag = false;
      langAnalyzerIdle = false;
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      langAnalyzerIdle = true;
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisReadyFlag = true;
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
      languageAnalysisReadyFlag = false;
      langAnalyzerIdle = false;
      langAnalyzerMessageRxQueue.push(m);
    }
  });

  langAnalyzer.on("error", function(err){
    console.log(chalkError("*** langAnalyzer ERROR ***\n" + jsonPrint(err)));
    quit(err);
  });

  langAnalyzer.on("exit", function(err){
    console.log(chalkError("*** langAnalyzer EXIT ***\n" + jsonPrint(err)));
    quit(err);
  });

  langAnalyzer.on("close", function(code){
    console.log(chalkError("*** langAnalyzer CLOSE *** | " + code));
    quit(code);
  });

  langAnalyzer.send({ op: "INIT", interval: LANGUAGE_ANALYZE_INTERVAL }, function(){
    if (callback !== undefined) { callback(); }
  });
}

function generateInputSets(params, callback) {

  console.log(chalkInfo("TFE | GENERATING INPUT SETS"
    + " | HIST ID: " + params.histogramsObj.histogramsId
    + " | TOT MIN: " + params.histogramParseTotalMin
    + " | DOM MIN: " + params.histogramParseDominantMin.toFixed(2)
    // + jsonPrint(params)
  ));

  let totalMin = randomInt(MIN_TOTAL_MIN, MAX_TOTAL_MIN);
  let dominantMin = randomFloat(MIN_DOMINANT_MIN, MAX_DOMINANT_MIN);

  let newInputsObj = {};
  newInputsObj.inputsId = params.histogramsObj.histogramsId;
  newInputsObj.meta = {};
  newInputsObj.meta.numInputs = 0;
  newInputsObj.meta.histogramParseTotalMin = totalMin;
  newInputsObj.meta.histogramParseDominantMin = dominantMin;
  newInputsObj.inputs = {};

  async.whilst(

    function() {

      if (configuration.testMode) {
        return ((newInputsObj.meta.numInputs < 10) || (newInputsObj.meta.numInputs > 100)) ;
      }
      return ((newInputsObj.meta.numInputs < configuration.minInputsGenerated) || (newInputsObj.meta.numInputs > configuration.maxInputsGenerated)) ;

    },

    function(cb0){

      totalMin = randomInt(MIN_TOTAL_MIN, MAX_TOTAL_MIN);
      dominantMin = randomFloat(MIN_DOMINANT_MIN, MAX_DOMINANT_MIN);

      if (configuration.testMode) {
        totalMin = randomInt(1, MAX_TOTAL_MIN);
        dominantMin = randomFloat(0.1, MAX_DOMINANT_MIN);
      }

      console.log(chalkInfo("... GENERATING INPUT SETS"
        + " | HIST ID: " + params.histogramsObj.histogramsId
        + " | TOT MIN: " + totalMin
        + " | DOM MIN: " + dominantMin.toFixed(3)
        // + jsonPrint(params)
      ));

      // if (newInputsObj.meta.numInputs < configuration.minInputsGenerated) {
      //   console.log(chalkAlert("NUM INPUTS < configuration.minInputsGenerated: " + newInputsObj.meta.numInputs));
      //   if (totalMin > 4) {
      //     totalMin -= 1;
      //     console.log(chalkAlert("ADJUST totalMin: " + totalMin));
      //   }
      //   else if (dominantMin > 0.35) {
      //     dominantMin -= 0.025;
      //     console.log(chalkAlert("ADJUST dominantMin: " + dominantMin.toFixed(3)));
      //   }
      //   else {
      //     console.log(chalkError("*** ERROR generateInputSets: FAIL TO ADJUST"
      //       + " | TOT MIN: " + totalMin
      //       + " | DOM MIN: " + dominantMin.toFixed(3)
      //     ));
      //     return cb0("ERROR generateInputSets: FAIL TO ADJUST");
      //   }
      // }

      // if (newInputsObj.meta.numInputs > configuration.maxInputsGenerated) {
      //   console.log(chalkAlert("NUM INPUTS > configuration.maxInputsGenerated: " + newInputsObj.meta.numInputs));
      //   if (totalMin < 100) {
      //     totalMin += 1;
      //     console.log(chalkAlert("ADJUST totalMin: " + totalMin));
      //   }
      //   else if (dominantMin < 1.0) {
      //     dominantMin += 0.025;
      //     console.log(chalkAlert("ADJUST dominantMin: " + dominantMin.toFixed(3)));
      //   }
      //   else {
      //     console.log(chalkError("*** ERROR generateInputSets: FAIL TO ADJUST"
      //       + " | TOT MIN: " + totalMin
      //       + " | DOM MIN: " + dominantMin.toFixed(3)
      //     ));
      //     return cb0("ERROR generateInputSets: FAIL TO ADJUST");
      //   }
      // }

      const hpParams = {};
      hpParams.histogram = params.histogramsObj.histograms;
      hpParams.options = {};
      hpParams.options.totalMin = totalMin;
      hpParams.options.dominantMin = dominantMin;

      histogramParser.parse(hpParams, function(err, histResults){

        if (err){
          console.log(chalkError("HISTOGRAM PARSE ERROR: " + err));
          return cb0(err);
        }

        debug(chalkNetwork("HISTOGRAMS RESULTS\n" + jsonPrint(histResults)));

        const inTypyes = Object.keys(histResults.entries);

        newInputsObj.meta.numInputs = 0;

        async.eachSeries(inTypyes, function(type, cb1){

          newInputsObj.inputs[type] = [];
          newInputsObj.inputs[type] = Object.keys(histResults.entries[type].dominantEntries).sort();
          newInputsObj.meta.numInputs +=newInputsObj.inputs[type].length;

          console.log(chalkAlert("HISTOGRAM PARSE | INPUTS | " + type + ": " + newInputsObj.inputs[type].length));

          cb1();

        }, function(){

          newInputsObj.meta.histogramParseTotalMin = totalMin;
          newInputsObj.meta.histogramParseDominantMin = dominantMin;

          debug(chalkNetwork("NEW INPUTS\n" + jsonPrint(newInputsObj)));

          console.log(chalkAlert("HISTOGRAMS PARSED"
            + " | PARSE TOT MIN: " + totalMin
            + " | PARSE DOM MIN: " + dominantMin.toFixed(3)
            + " | NUM INPUTS: " + newInputsObj.meta.numInputs
          ));

          cb0();

        });

      });

  }, function(err){
    callback(err, newInputsObj);
  });

}

initialize(configuration, function(err, cnf){

  if (err) {
    console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404){
      console.log("err.status: " + err.status);
      quit();
    }
  }

  configuration = deepcopy(cnf);

  console.log(chalkTwitter(configuration.processName 
    + " STARTED " + getTimeStamp() 
    // + "\n" + jsonPrint(cnf)
  ));

  initSaveFileQueue(cnf);

  if (configuration.testMode) {
    configuration.fetchCount = TEST_MODE_FETCH_COUNT;
  }

  if (configuration.loadNeuralNetworkID) {
    configuration.neuralNetworkFile = "neuralNetwork_" + configuration.loadNeuralNetworkID + ".json";
  }
  else {
    configuration.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  console.log(chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

  // initInputArrays(cnf, function(err){

    // if (err) {
    //   console.error(chalkError("*** INIT INPUT ARRAYS ERROR\n" + jsonPrint(err)));
    // }

    initUserDbUpdateQueueInterval(100);
    initRandomNetworkTreeMessageRxQueueInterval(RANDOM_NETWORK_TREE_MSG_Q_INTERVAL);
    initRandomNetworkTree();

    initLangAnalyzerMessageRxQueueInterval(100);
    initLangAnalyzer();

    neuralNetworkInitialized = true;

    initTwitterUsers(function initTwitterUsersCallback(e){

      if (e) {
        console.error(chalkError("*** ERROR INIT TWITTER USERS: " + e));
        return quit(e);
      }

      if (currentTwitterUser === undefined) { 
        currentTwitterUser = configuration.twitterUsers[currentTwitterUserIndex];
      }

      console.log(chalkTwitter("CURRENT TWITTER USER: " + currentTwitterUser));

      checkRateLimit();
      initCheckRateLimitInterval(checkRateLimitIntervalTime);
      initSocket(cnf, function(err, result){});

      if (configuration.userDbCrawl) { 
        console.log(chalkTwitter("\n\n*** CRAWLING USER DB ***\n\n"));
      }
      else {
        console.log(chalkTwitter("... GET TWITTER FRIENDS"
          + " [ USER INDEX: " + currentTwitterUserIndex + "]"
          + " | @" + statsObj.user[currentTwitterUser].screenName
        ));
        debug(chalkTwitter("\n\n*** GET TWITTER FRIENDS *** | @" + jsonPrint(statsObj.user[currentTwitterUser]) + "\n\n"));

        if (configuration.testMode) {

          fetchTwitterFriendsIntervalTime = TEST_TWITTER_FETCH_FRIENDS_INTERVAL;

          setTimeout(function() {

            console.log("LOAD " + localHistogramsFolder + "/histograms.json");

            loadFile(localHistogramsFolder, "histograms.json", function(err, histogramsObj){
              if (err) {
                console.log(chalkError("LOAD histograms.json ERROR\n" + jsonPrint(err)));
              }
              else {
                console.log(chalkAlert("histogramsObj: " + histogramsObj.histogramsId));

                let inFolder = (hostname === "google") ? defaultInputsFolder : localInputsFolder;

                if (configuration.testMode) { 
                  inFolder = inFolder + "_test";
                }

                const hId = hostname + "_" + process.pid + "_" + moment().format(compactDateTimeFormat);
                const inFile = hId + ".json"; 

                const genInParams = {
                  histogramsObj: { 
                    histogramsId: hId, 
                    histograms: histogramsObj.histograms
                  },
                  histogramParseDominantMin: configuration.histogramParseDominantMin,
                  histogramParseTotalMin: configuration.histogramParseTotalMin
                };

                generateInputSets(genInParams, function(err, inputsObj){
                  if (err) {
                    console.log(chalkError("ERROR | NOT SAVING INPUTS FILE: " + inFolder + "/" + inFile));
                    // saveFileQueue.push({folder: inFolder, file: inFile, obj: inputsObj});
                  }
                  else {
                    console.log(chalkAlert("... SAVING INPUTS FILE: " + inFolder + "/" + inFile));
                    saveFileQueue.push({folder: inFolder, file: inFile, obj: inputsObj});
                  }
                });
              }

            });

          }, 1000);

        }
        fsm.fsm_initComplete();
        fsm.fsm_fetchAllStart();
        fsm.fsm_fetchUserStart();

      }
    });
    // });

  // });
});
