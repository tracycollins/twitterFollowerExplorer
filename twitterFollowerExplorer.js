  /*jslint node: true */
"use strict";

var TWITTER_DEFAULT_USER = "altthreecee00";

var neuralNetworkInitialized = false;
var nextTwitterUser;
var currentTwitterUser ;
var twitterUsersArray = [];

var ONE_SECOND = 1000 ;
var ONE_MINUTE = ONE_SECOND*60 ;
var ONE_HOUR = ONE_MINUTE*60 ;
var ONE_DAY = ONE_HOUR*24 ;

var TFE_USER_DB_CRAWL = false;

var configuration = {};

configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.userDbCrawl = TFE_USER_DB_CRAWL;
configuration.neuralNetworkFile = "";

var co = require("co");
var once = require("once");

var stdin;

var quitOnComplete = false;
var langAnalyzerIdle = false;
var abortCursor = false;

var MAX_Q = 500;

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
var compactDateTimeFormat = "YYYYMMDD HHmmss ZZ";

var intervalometer = require('intervalometer');
var timerIntervalometer = intervalometer.timerIntervalometer;
var waitLanguageAnalysisReadyInterval;

var network;
var neataptic = require("./js/neataptic/neataptic.js");

var cp = require("child_process");
var langAnalyzer;

var keywordExtractor = require("keyword-extractor");

var Personify = require('personify');
var personifyClient;

var descriptionHistogram = {};

var descriptionWordsArray = [
  "activist",
  "africa",
  "america",
  "asia",
  "ayn",
  "bernie",
  "brexit",
  "brotherhood",
  "business",
  "businessman",
  "christ",
  "christian",
  "christians",
  "christianity",
  "class",
  "clinton",
  "community",
  "columnist",
  "congress",
  "congressional",
  "conservative",
  "conversation",
  "courage",
  "courageous",
  "coward",
  "cowards",
  "dem",
  "demexit",
  "dems",
  "democrat",
  "democrats",
  "district",
  "enemy",
  "establishment",
  "europe",
  "expert",
  "facts",
  "fakenews",
  "family",
  "father",
  "fiscal",
  "fox",
  "freedom",
  "god",
  "government",
  "great",
  "hate",
  "husband",
  "i",
  "immigration",
  "immigrant",
  "israel",
  "israeli",
  "israelis",
  "islam",
  "islamic",
  "justice",
  "labor",
  "leader",
  "leaders",
  "leadership",
  "learn",
  "left",
  "leftist",
  "leftists",
  "liberal",
  "libertarian",
  "life",
  "love",
  "matter",
  "member",
  "middle",
  "military",
  "mission",
  "mother",
  "movement",
  "msm",
  "muslim",
  "news",
  "obama",
  "occupy",
  "organization",
  "palestine",
  "palestinian",
  "palestinians",
  "parent",
  "parenthood",
  "parody",
  "patriot",
  "people",
  "personal",
  "political",
  "politics",
  "power",
  "powerful",
  "president",
  "protect",
  "protects",
  "protecting",
  "protection",
  "proud",
  "proudly",
  "racist",
  "rand",
  "real",
  "rep",
  "represent",
  "representing",
  "repub",
  "republican",
  "republicans",
  "resistance",
  "rights",
  "sanders",
  "sciene",
  "scientist",
  "sercure",
  "sercurity",
  "served",
  "service",
  "serving",
  "sexist",
  "smart",
  "social",
  "socialism",
  "socialist",
  "tax",
  "terror",
  "terrorism",
  "terrorist",
  "terrorists",
  "them",
  "they",
  "think",
  "together",
  "trump",
  "trust",
  "us",
  "wall",
  "we",
  "wife",
  "win",
  "work",
  "working",
  "world",
  "zion",
  "zionism",
  "zionist",
  "zionists"
];

var descriptionMentionsArray = [
  "@barackobama",
  "@berniesanders",
  "@breitbartnews",
  "@cnn",
  "@dnc",
  "@foxnews",
  "@gop",
  "@hillaryclinton",
  "@msnbc",
  "@nytimes",
  "@potus",
  "@realdonaldtrump",
  "@sensanders",
  "@thedemocrats",
  "@washingtonpost",
  "@whitehouse",
  "@whitehouse",
  "@wsj",
];

var descriptionHashtagsArray = [
  "#1",
  "#1a",
  "#2a",
  "#aca",
  "#alllivesmatter",
  "#americafirst",
  "#badhombre",
  "#blacklivesmatter",
  "#bluelivesmatter",
  "#boycotttrump",
  "#breitbart",
  "#breitbartnews",
  "#constitution",
  "#deplorable",
  "#deplorables",
  "#draintheswamp",
  "#fakenews",
  "#fox",
  "#free",
  "#freepalestine",
  "#freedom",
  "#freedoms",
  "#gun",
  "#guns",
  "#gunrights",
  "#hate",
  "#humanitarian",
  "#imwithher",
  "#lgbt",
  "#love",
  "#maga",
  "#makeamericagreatagain",
  "#military",
  "#msm",
  "#nastywoman",
  "#nastywomen",
  "#neverthelessshepersisted",
  "#shepersisted",
  "#nevertrump",
  "#notmypresident",
  "#nra",
  "#obama",
  "#politics",
  "#presidenttrump",
  "#resist",
  "#resistance",
  "#science",
  "#tcot",
  "#trump2020",
  "#trumprussia",
  "#trumptrain",
  "#wethepeople",
];

var descriptionArrays = [];

descriptionArrays.push({type: "mentions", array: descriptionMentionsArray});
descriptionArrays.push({type: "hashtags", array: descriptionHashtagsArray});
descriptionArrays.push({type: "words", array: descriptionWordsArray});

var mentionsRegex = require('mentions-regex');
var hashtagRegex = require('hashtag-regex');

var os = require('os');
var util = require('util');
var moment = require('moment');
// var StateMachine = require('javascript-state-machine');
var Twit = require('twit');
var twit;

var totalFriendsSortedFollowersArray = [];
var totalFriendsSortedFollowingArray = [];

var cursorUser;
var socket;

var async = require('async');
var http = require('http');
var sortOn = require('sort-on');

var chalk = require('chalk');
// var chalkFsm = chalk.bold.black;
var chalkTwitter = chalk.blue;
var chalkTwitterBold = chalk.bold.blue;
var chalkBlk = chalk.black;
var chalkRed = chalk.red;
var chalkRedBold = chalk.bold.red;
var chalkGreen = chalk.green;
var chalkError = chalk.bold.red;
var chalkAlert = chalk.red;
var chalkWarn = chalk.red;
var chalkLog = chalk.black;
var chalkInfo = chalk.gray;
var chalkTestInfo = chalk.bold.red;
var chalkConnect = chalk.bold.green;
var chalkConnectPrimary = chalk.bold.green;
var chalkDisconnect = chalk.yellow;
var chalkPrompt = chalk.green;
var chalkResponse = chalk.green;
var chalkRssBold = chalk.bold.blue;
var chalkRss = chalk.blue;
var chalkDbBold = chalk.bold.black;
var chalkDb = chalk.gray;

var request = require('request');
var fs = require('fs');
var yaml = require('yamljs');

var config = require('./config/config');
var keypress = require('keypress');

var events = require("events");
var EventEmitter = require("events").EventEmitter;
var EventEmitter2 = require('eventemitter2').EventEmitter2;

var debug = require('debug')('rssFeedCrawler');
var debugVerbose = require('debug')('rssFeedCrawler:verbose');

var debugRss = require('debug')('mw');
var debugRssVerbose = require('debug')('mwVerbose');
var debugCache = require('debug')('cache');
var debugQ = require('debug')('queue');
var debugDb = require('debug')('db');

var error = debug('app:error');

var express = require('./config/express');
var mongoose = require('./config/mongoose');

var twitterConfig = {};

var primarySocketKeepaliveInterval;
var statsUpdateInterval;

var followerUpdateQueueInterval;
var followerUpdateQueue = [];

var langAnalyzerMessageRxQueue = [];

var HashMap = require('hashmap');

var autoClassifiedUserHashmap = {};
var classifiedUserHashmap = {};
var topicHashMap = new HashMap();

var groupHashMap = new HashMap();
var serverGroupHashMap = new HashMap(); // server specific keywords
var entityHashMap = new HashMap();
var serverentityHashMap = new HashMap();

var twitterUserHashMap = {};
var initTweetHashMapComplete = false;

var NodeCache = require( "node-cache" );
var trendingCache = new NodeCache( { stdTTL: 300, checkperiod: 10 } );

// ==================================================================
// MONGO DATABASE CONFIG
// ==================================================================

var db = mongoose();

var Group = require('mongoose').model('Group');
var Entity = require('mongoose').model('Entity');
var User = require('mongoose').model('User');
var Word = require('mongoose').model('Word');

var groupServer = require('./app/controllers/group.server.controller');
var entityServer = require('./app/controllers/entity.server.controller');
var userServer = require('./app/controllers/user.server.controller');
var wordServer = require('./app/controllers/word.server.controller');

var hostname = os.hostname();
hostname = hostname.replace(/\.local/g, '');
hostname = hostname.replace(/\.home/g, '');
hostname = hostname.replace(/word0-instance-1/g, 'google');

var neuralNetworkFile = "neuralNetwork_" + hostname + ".json";
var defaultNeuralNetworkFile = "neuralNetwork.json";

configuration.neuralNetworkFile = defaultNeuralNetworkFile;

var checkRateLimitInterval;
var checkRateLimitIntervalTime = 30*ONE_SECOND;
var pollTwitterFriendsIntervalTime = 15*ONE_MINUTE;
var fetchTwitterFriendsIntervalTime = ONE_MINUTE;  // twit.get('friends/list'...) cursor

var langAnalyzerMessageRxQueueInterval;
var langAnalyzerMessageRxQueueReady = true;

function indexOfMax(arr) {
  if (arr.length === 0) {
    return -1;
  }

  var max = arr[0];
  var maxIndex = 0;

  for (var i = 1; i < arr.length; i++) {
    if (arr[i] > max) {
      maxIndex = i;
      max = arr[i];
    }
  }
  return maxIndex;
}

function reset(callback){
  callback();
}

var jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


var USER_ID = 'TFE_' + hostname + '_' + process.pid;
var SCREEN_NAME = 'TFE_' + hostname + '_' + process.pid;

var serverUserObj = { 
  name: USER_ID, 
  nodeId: USER_ID, 
  userId: USER_ID, 
  screenName: SCREEN_NAME, 
  type: "UTIL", 
  mode: "MUXSTREAM",
  tags: {}
} ;

serverUserObj.tags.entity = 'muxstream_' + hostname + '_' + process.pid;
serverUserObj.tags.mode = 'muxed';
serverUserObj.tags.channel = 'twitter';


var commandLineArgs = require('command-line-args');

var enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
var quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
var userDbCrawl = { name: "userDbCrawl", alias: "C", type: Boolean, defaultValue: false};
var testMode = { name: "testMode", alias: "T", type: Boolean, defaultValue: false};
var loadNeuralNetworkFilePID = { name: "loadNeuralNetworkFilePID", alias: "N", type: Number };
var targetServer = { name: "targetServer", alias: "t", type: String};

var optionDefinitions = [enableStdin, quitOnError, loadNeuralNetworkFilePID, userDbCrawl, testMode, targetServer];

var commandLineConfig = commandLineArgs(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

if (commandLineConfig.targetServer == 'LOCAL'){
  commandLineConfig.targetServer = 'http://localhost:9997/util';
}
if (commandLineConfig.targetServer == 'REMOTE'){
  commandLineConfig.targetServer = 'http://word.threeceelabs.com/util';
}

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS" + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");



var languageAnalysisReadyFlag = false;
var languageAnalysisQueueFull = false;
var languageAnalysisQueueEmpty = false;

var dbIncMentions = false;

// process.on("message", function(msg) {
//   if (msg == 'shutdown') {
//     console.log('\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n');
//     setTimeout(function() {
//       console.log('**** Finished closing connections ****\n\n ***** RELOADING twitterFollowerExplorer.js NOW *****\n\n');
//       process.exit(0);
//     }, 1500);
//   }
// });
process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
});


process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(updateTrendsInterval);
    clearInterval(keepaliveInterval);
    clearInterval(checkRateLimitInterval);
    clearInterval(statsUpdateInterval);

    clearInterval(waitLanguageAnalysisReadyInterval);
    fetchTwitterFriendsIntervalRunning = false;
    fetchTwitterFriendsIntervalometer.stop();

    setTimeout(function() {
      console.log("QUITTING twitterFollowerExplorer");
      process.exit(0);
    }, 300);

  }
});

process.on( 'SIGINT', function() {
  quit("SIGINT");
});

process.on("exit", function() {
  if (langAnalyzer !== undefined) { langAnalyzer.kill("SIGINT"); }
});

// var fsm = new StateMachine({
//   initial: 'idle',
//   transitions: [
//     { name: 'reset', from: '*', to: 'idle' },
//     { name: 'fetchTwitterFriendsInit', from: ['idle'], to: 'fetchTwitterFriends' },
//     { name: 'fetchTwitterFriendsEnd', from: ['fetchTwitterFriends'], to: 'idle' },
//     { name: 'fetchTwitterFriendsError', from: ['fetchTwitterFriends'], to: 'idle' },
//     { name: 'cursorUserInit', from: ['idle'], to: 'cursorUser' },
//     { name: 'cursorUserError', from: ['cursorUser'], to: 'idle' },
//     { name: 'cursorUserEnd', from: ['cursorUser'], to: 'idle' },
//     { name: 'twitterExceedLimit', from: ['idle', 'fetchTwitterFriends', 'waitLimitReset'], to: 'waitLimitReset' },
//     { name: 'twitterLimitReset',  from: 'waitLimitReset', to: 'fetchTwitterFriends' },
//     { name: 'twitterError', from: ['poll', 'waitLimitReset'], to: 'idle' },
// ]});

// fsm.onenterstate = function(event, from, to){
//   console.log(chalkFsm("### FSM STATE: " + fsm.current));
// };


var configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20
});

configEvents.on('newListener', function(data){
  console.log("*** NEW CONFIG EVENT LISTENER: " + data);
});

// MONGO DB

var initTwitterUsersComplete = false;

// stats
var statsObj = {};
statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.startTime = moment().valueOf();

statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.classification = {};
statsObj.classification.auto = {};
statsObj.classification.manual = {};

statsObj.classification.manual.left = 0;
statsObj.classification.manual.right = 0;
statsObj.classification.manual.positive = 0;
statsObj.classification.manual.negative = 0;
statsObj.classification.manual.neutral = 0;
statsObj.classification.manual.other = 0;

statsObj.classification.auto.left = 0;
statsObj.classification.auto.right = 0;
statsObj.classification.auto.positive = 0;
statsObj.classification.auto.negative = 0;
statsObj.classification.auto.neutral = 0;
statsObj.classification.auto.other = 0;

statsObj.users = {};
statsObj.users.classifiedAuto = 0;
statsObj.users.classified = 0;
statsObj.users.percentFetched
statsObj.users.totalFriendsFetched = 0;

statsObj.user = {};
statsObj.user.ninjathreecee = {};
statsObj.user.altthreecee00 = {};
// statsObj.user.twitterRateLimit = 180;
// statsObj.user.twitterRateLimitRemaining = 180;
// statsObj.user.twitterRateLimitRemainingTime = 0;
// statsObj.user.twitterRateLimitRemainingMin = 20;
// statsObj.user.twitterRateLimitException = moment();
// statsObj.user.twitterRateLimitResetAt = moment();
// statsObj.user.twitterRateLimitExceptionFlag = false;

statsObj.analyzer = {};
statsObj.analyzer.total = 0;
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.errors = 0;

statsObj.totalTwitterFriends = 0;

statsObj.twitterErrors = 0;


// ==================================================================
// DROPBOX
// ==================================================================
var DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
var DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
var DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
var DROPBOX_TFE_CONFIG_FILE = process.env.DROPBOX_TFE_CONFIG_FILE || 'twitterFollowerExplorerConfig.json';
var DROPBOX_TFE_STATS_FILE = process.env.DROPBOX_TFE_STATS_FILE || 'twitterFollowerExplorerStats.json';

var DROPBOX_WA_GROUPS_CONFIG_FILE = process.env.DROPBOX_WA_GROUPS_CONFIG_FILE || 'groups.json';
var DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE = process.env.DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE || 'entityChannelGroups.json';

var defaultDropboxGroupsConfigFile = DROPBOX_WA_GROUPS_CONFIG_FILE;
var dropboxGroupsConfigFile = hostname +  "_" + DROPBOX_WA_GROUPS_CONFIG_FILE;

var defaultDropboxEntityChannelGroupsConfigFile = DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE;
var dropboxEntityChannelGroupsConfigFile = hostname +  "_" + DROPBOX_WA_ENTITY_CHANNEL_GROUPS_CONFIG_FILE;

var dropboxConfigFolder = "/config/utility";
var dropboxConfigDefaultFolder = "/config/utility/default";
var dropboxConfigHostFolder = "/config/utility/" + hostname;


var dropboxConfigFile = hostname + "_" + DROPBOX_TFE_CONFIG_FILE;
var statsFolder = "/stats/" + hostname;
var statsFile = DROPBOX_TFE_STATS_FILE;

console.log("DROPBOX_TFE_CONFIG_FILE: " + DROPBOX_TFE_CONFIG_FILE);
console.log("DROPBOX_TFE_STATS_FILE : " + DROPBOX_TFE_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);


var Dropbox = require("dropbox");
var dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function quit(){
  console.log( "\n... QUITTING ..." );
  showStats(true);
  process.exit();
}

function mute(){
  if (mutedFlag) {
    mutedFlag = false ;
    console.log( "\n... UNMUTE ..." );
  }
  else {
    mutedFlag = true ;
    console.log( "\n... MUTE ..." );
  }
}

function pause(){
  if (pausedFlag) {
    pausedFlag = false ;
    console.log( "\n... RUNNING ..." );
  }
  else {
    pausedFlag = true ;
    console.log( "\n... PAUSED ..." );
  }
}

function msToTime(duration) {
  var seconds = parseInt((duration / 1000) % 60);
  var minutes = parseInt((duration / (1000 * 60)) % 60);
  var hours = parseInt((duration / (1000 * 60 * 60)) % 24);
  var days = parseInt(duration / (1000 * 60 * 60 * 24));

  days = (days < 10) ? "0" + days : days;
  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return days + ":" + hours + ":" + minutes + ":" + seconds;
}

function showStats(options){
  if (langAnalyzer !== undefined) {
    langAnalyzer.send({op: "STATS", options: options});
  }
  if (options) {
    console.log("STATS\n" + jsonPrint(statsObj));

    var keys = Object.keys(descriptionHistogram);

    var sortedKeys = keys.sort(function(a,b){
      var valA = descriptionHistogram[a];
      var valB = descriptionHistogram[b];
      return valB - valA;
    });

    console.log("HIST");
    sortedKeys.forEach(function(k){
      if (descriptionHistogram[k] >= 100) { console.log(descriptionHistogram[k] + " | " + k); }
    });
  }
  else {
    if (statsObj.user !== undefined) {
      console.log(chalkLog("- FE S"
        + " | E: " + statsObj.elapsed
        + " | S: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
        + " | ACL Us: " + Object.keys(autoClassifiedUserHashmap).length
        + " | CL Us: " + Object.keys(classifiedUserHashmap).length
        + " || " + statsObj.analyzer.analyzed + " ANLs | " + statsObj.analyzer.skipped + " SKPs | " + statsObj.analyzer.total + " TOT"
        // + " | " + statsObj.user.name
        // + " | " + statsObj.user.screen_name
        // + " | TWEETS: " + statsObj.user.statuses_count
        // + " | FOLLOWING: " + statsObj.user.friends_count
        // + " | FOLLOWERS: " + statsObj.user.followers_count
        // + " | TWEETS: " + statsObj.user.statuses_count
      ));
    }
    else {
      console.log(chalkLog("- FE S"
        + " | START: " + moment(statsObj.startTime).format(compactDateTimeFormat)
        + " | ELAPSED: " + statsObj.elapsed
      ));
    }
  }
}

function getTimeNow() {
  var d = new Date();
  return d.getTime();
}

function getTimeStamp(inputTime) {
  var currentTimeStamp ;

  if (typeof inputTime === 'undefined') {
    currentTimeStamp = moment().format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(compactDateTimeFormat);
    return currentTimeStamp;
  }
}

function saveFile (path, file, jsonObj, callback){

  var fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  var options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      callback(null, response);
    })
    .catch(function(error){

      var errorText = (error[error_summary] !== undefined) ? error[error_summary] : jsonPrint(error);
      console.error(chalkError(moment().format(compactDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + errorText
        // + " ERROR\n" + jsonPrint(error.error)
      ));
      callback(error, null);
    });
}

function loadFile(path, file, callback) {

  console.log(chalkInfo("LOAD FOLDER " + path));
  console.log(chalkInfo("LOAD FILE " + file));
  console.log(chalkInfo("FULL PATH " + path + "/" + file));

  var fileExists = false;

  dropboxClient.filesListFolder({path: path})
    .then(function(response) {

        async.each(response.entries, function(folderFile, cb) {

          debug("FOUND FILE " + folderFile.name);

          if (folderFile.name == file) {
            debug(chalkRedBold("SOURCE FILE EXISTS: " + file));
            fileExists = true;
          }

          cb();

        }, function(err) {

          if (fileExists) {

            dropboxClient.filesDownload({path: path + "/" + file})
              .then(function(data) {
                console.log(chalkLog(getTimeStamp()
                  + " | LOADING FILE FROM DROPBOX: " + path + "/" + file
                  // + "\n" + jsonPrint(data)
                ));

                var payload = data.fileBinary;

                debug(payload);

                if (file.match(/\.json$/gi)) {
                  debug("FOUND JSON FILE: " + file);
                  var fileObj = JSON.parse(payload);
                  return(callback(null, fileObj));
                }
                else if (file.match(/\.yml/gi)) {
                  var fileObj = yaml.load(payload);
                  debug(chalkAlert("FOUND YAML FILE: " + file));
                  debug("FOUND YAML FILE\n" + jsonPrint(fileObj));
                  debug("FOUND YAML FILE\n" + jsonPrint(payload));
                  return(callback(null, fileObj));
                }

               })
              .catch(function(error) {
                console.log(chalkAlert("DROPBOX loadFile ERROR: " + file + "\n" + error));
                console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
                console.log(chalkError(jsonPrint(error)));

                if (error["status"] === 404) {
                  console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND ... SKIPPING ..."));
                  return(callback(null, null));
                }
                if (error["status"] === 0) {
                  console.error(chalkError("!!! DROPBOX NO RESPONSE ... NO INTERNET CONNECTION? ... SKIPPING ..."));
                  return(callback(null, null));
                }
                return(callback(error, null));
              });
          }
          else {
            console.error(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            console.log(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            var err = {};
            err.code = 404;
            err.status = "FILE DOES NOT EXIST";
            return(callback(err, null));
          }
        });
    })
    .catch(function(error) {
    });
}

var classifiedUsersDefaultFile = "classifiedUsers.json";
var classifiedUsersFile = "classifiedUsers_" + hostname + "_" + process.pid + ".json";
var autoClassifiedUsersDefaultFile = "autoClassifiedUsers_" + hostname + ".json";
var autoClassifiedUsersFile = "autoClassifiedUsers_" + hostname + "_" + process.pid + ".json";
var descriptionHistogramFile = "descriptionHistogram_" + hostname + "_" + process.pid + ".json";

function initStatsUpdate(cnf, callback){

  console.log(chalkAlert("INIT STATS UPDATE INTERVAL | " + cnf.statsUpdateIntervalTime + " MS"));

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj, function(){});
    showStats();

    saveFile(dropboxConfigHostFolder, classifiedUsersFile, classifiedUserHashmap, function(err){
      if (err){
        console.error(chalkError("SAVE CLASSIFED FILE ERROR"
          + " | " + classifiedUsersFile
          + " | " + err.error_summary
        ));
      }
      else{
        console.log(chalkLog("SAVED | " + dropboxConfigDefaultFolder + "/" + classifiedUsersFile));
      }
    });

    saveFile(dropboxConfigHostFolder, autoClassifiedUsersFile, autoClassifiedUserHashmap, function(err){
      if (err){
        console.error(chalkError("SAVE AUTO CLASSIFED FILE ERROR"
          + " | " + autoClassifiedUsersFile
          + " | " + err.error_summary
        ));
      }
      else{
        console.log(chalkLog("SAVED | " + dropboxConfigHostFolder + "/" + autoClassifiedUsersFile));
      }
    });

    var keys = Object.keys(descriptionHistogram);

    var sortedKeys = keys.sort(function(a,b){
      var valA = descriptionHistogram[a];
      var valB = descriptionHistogram[b];
      return valB - valA;
    });

    sortedKeys.forEach(function(k){
      if (descriptionHistogram[k] >= 100) { console.log("H | " + descriptionHistogram[k] + " | " + k); }
    });

    saveFile(dropboxConfigHostFolder, descriptionHistogramFile, sortedKeys, function(err){
      if (err){
        console.error(chalkError("SAVE DESCRIPTION HISTOGRAM FILE ERROR | " + descriptionHistogramFile + " | " + err));
      }
      else{
        console.log(chalkLog("SAVED | " + descriptionHistogramFile));

        if (quitOnComplete && langAnalyzerIdle && !cnf.testMode && !statsObj.nextCursorValid) {
          console.log(chalkTwitterBold(moment().format(compactDateTimeFormat)
            + " | QUITTING ON COMPLETE"
          ));

          saveFile(dropboxConfigHostFolder, classifiedUsersDefaultFile, classifiedUserHashmap, function(err){

            fetchTwitterFriendsIntervalRunning = false;
            clearInterval(waitLanguageAnalysisReadyInterval);
            fetchTwitterFriendsIntervalometer.stop();

            quit("QUIT ON COMPLETE");
          });

        }
      }
    });
  }, cnf.statsUpdateIntervalTime);

  loadFile(statsFolder, statsFile, function(err, loadedStatsObj){
    if (!err) {
      debug(jsonPrint(loadedStatsObj));
      return(callback(null, cnf));
    }
    else {
      return(callback(err, cnf));
    }
  });
}

function initTwitterUsers(cnf, callback){

  if (!configuration.twitterUsers){
    console.log(chalkWarn("??? NO FEEDS"));
    callback(null, null);
  }
  else{

    var twitterDefaultUser = cnf.twitterDefaultUser;
    twitterUsersArray = Object.keys(cnf.twitterUsers);

    // if (!currentTwitterUser) { currentTwitterUser = twitterUsersArray[0]; }

    console.log(chalkRedBold("USERS"
      + " | FOUND: " + twitterUsersArray.length
      // + " | DEFAULT: " + twitterDefaultUser
      + "\n" + jsonPrint(cnf)
    ));

    twitterUsersArray.forEach(function(userId){

      userId = userId.toLowerCase();

      var twitterUserObj = {};

      debug("userId: " + userId);
      debug("screenName: " + cnf.twitterUsers[userId]);

      twitterUserObj.isDefault = (twitterDefaultUser === userId) || false;
      twitterUserObj.userId = userId ;
      twitterUserObj.screenName = cnf.twitterUsers[userId] ;

      twitterUserHashMap[userId] = twitterUserObj;

      console.log(chalkRss("ADDED TWITTER USER"
        + " | NAME: " + userId
        + " | FEED ID: " + twitterUserHashMap[userId].userId
        + " | DEFAULT USER: " + twitterUserHashMap[userId].isDefault
      ));

    });

    callback(null, twitterUserHashMap);
  }
}

function socketReconnect(cnf, sckt){
  if (typeof sckt !== 'undefined'){
    setTimeout(function(){
      console.log(chalkConnect("==> RECONNECT ATTEMPT | " + cnf.targetServer));
      sckt.connect(cnf.targetServer, { reconnection: false });
    }, 60000);
  }
}

function initialize(cnf, callback){

  initClassifiedUserHashmap(dropboxConfigDefaultFolder, classifiedUsersDefaultFile, function(err, classifiedUsersObj){
    classifiedUserHashmap = classifiedUsersObj;
  });

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TFE_PROCESS_NAME || 'twitterFollowerExplorer';
  cnf.quitOnError = process.env.TFE_QUIT_ON_ERROR || false ;
  cnf.enableStdin = process.env.TFE_ENABLE_STDIN || true ;
  cnf.userDbCrawl = process.env.TFE_USER_DB_CRAWL || TFE_USER_DB_CRAWL ;
  cnf.targetServer = process.env.TFE_UTIL_TARGET_SERVER || 'http://localhost:9997/util' ;

  cnf.twitterDefaultUser = process.env.TFE_TWITTER_DEFAULT_USER || TWITTER_DEFAULT_USER ;
  cnf.twitterUsers = process.env.TFE_TWITTER_USERS || { "altthreecee00": "altthreecee00", "ninjathreecee": "ninjathreecee" } ;
  cnf.statsUpdateIntervalTime = process.env.TFE_STATS_UPDATE_INTERVAL || ONE_MINUTE;

  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";
  cnf.twitterConfigFile = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE || cnf.twitterDefaultUser + ".json";

  cnf.neuralNetworkFile = defaultNeuralNetworkFile;

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){
    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (typeof loadedConfigObj.TFE_UTIL_TARGET_SERVER !== 'undefined'){
        console.log("LOADED TFE_UTIL_TARGET_SERVER: " + loadedConfigObj.TFE_UTIL_TARGET_SERVER);
        cnf.targetServer = loadedConfigObj.TFE_UTIL_TARGET_SERVER;
      }

      if (typeof loadedConfigObj.TFE_ENABLE_STDIN !== 'undefined'){
        console.log("LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.TFE_ENABLE_STDIN;
      }

      if (loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID  !== undefined){
        console.log("LOADED TFE_NEURAL_NETWORK_FILE_PID: " + loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID);
        cnf.loadNeuralNetworkFilePID = loadedConfigObj.TFE_NEURAL_NETWORK_FILE_PID;
      }

      if (typeof loadedConfigObj.TFE_USER_DB_CRAWL !== 'undefined'){
        console.log("LOADED TFE_ENABLE_STDIN: " + loadedConfigObj.TFE_USER_DB_CRAWL);
        cnf.userDbCrawl = loadedConfigObj.TFE_USER_DB_CRAWL;
      }

      if (typeof loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER !== 'undefined'){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER));
        cnf.twitterConfigFolder = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER;
      }

      if (typeof loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE !== 'undefined'){
        console.log("LOADED DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE: " 
          + jsonPrint(loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE));
        cnf.twitterConfigFile = loadedConfigObj.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FILE;
      }

      if (typeof loadedConfigObj.TFE_TWITTER_USERS !== 'undefined'){
        console.log("LOADED TFE_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TFE_TWITTER_USERS));
        cnf.twitterUsers = loadedConfigObj.TFE_TWITTER_USERS;
      }

      if (typeof loadedConfigObj.TFE_TWITTER_DEFAULT_USER !== 'undefined'){
        console.log("LOADED TFE_TWITTER_DEFAULT_USER: " + jsonPrint(loadedConfigObj.TFE_TWITTER_DEFAULT_USER));
        cnf.twitterDefaultUser = loadedConfigObj.TFE_TWITTER_DEFAULT_USER;
      }

      if (typeof loadedConfigObj.TFE_KEEPALIVE_INTERVAL !== 'undefined') {
        console.log("LOADED TFE_KEEPALIVE_INTERVAL: " + loadedConfigObj.TFE_KEEPALIVE_INTERVAL);
        cnf.keepaliveInterval = loadedConfigObj.TFE_KEEPALIVE_INTERVAL;
      }

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      var commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(serverUserObj)));

      var configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){

        console.log("STDIN ENABLED");

        stdin = process.stdin;
        if(typeof stdin.setRawMode !== 'undefined') {
          stdin.setRawMode( true );
        }
        stdin.resume();
        stdin.setEncoding( 'utf8' );
        stdin.on( 'data', function( key ){

          switch (key) {
            case '\u0003':
              process.exit();
            break;
            case 'a':
              abortCursor = true;
              console.log(chalkAlert("ABORT: " + abortCursor));
            break;
            // case "c":
            //   configuration.cursorUserPause = !configuration.cursorUserPause;
            //   if (configuration.cursorUserPause) {
            //     // cursorUser.pause();
            //   }
            //   else {
            //     // cursorUser.resume();
            //   }
            //   console.log(chalkRedBold("CURSOR USER PAUSE: " + configuration.cursorUserPause));
            // break;
            case 'q':
              quit();
            break;
            case 'Q':
              quit();
            break;
            case 's':
              showStats();
            break;
            case 'S':
              showStats(true);
            break;
            default:
              console.log(
                "\n" + "q/Q: quit"
                + "\n" + "s: showStats"
                + "\n" + "S: showStats verbose"
                );
            break;
          }
        });
      }

      initStatsUpdate(cnf, function(err, cnf2){

        loadFile(cnf2.twitterConfigFolder, cnf2.twitterConfigFile, function(err, tc){
          if (err){
            console.error(chalkError("*** TWITTER YAML CONFIG LOAD ERROR\n" + err));
            quit();
            return;
          }

          cnf2.twitterConfig = {};
          cnf2.twitterConfig = tc;

          console.log(chalkInfo(getTimeStamp() + ' | TWITTER CONFIG FILE ' 
            + cnf2.twitterConfigFolder
            + cnf2.twitterConfigFile
            // + '\n' + jsonPrint(cnf2.twitterConfig )
          ));

          return(callback(err, cnf2));
        });
      });
    }
    else {
      console.error("dropboxConfigFile: " + dropboxConfigFile + "\n" + jsonPrint(err));

      // OVERIDE CONFIG WITH COMMAND LINE ARGS

      var commandLineArgs = Object.keys(commandLineConfig);

      commandLineArgs.forEach(function(arg){
        cnf[arg] = commandLineConfig[arg];
        console.log("--> COMMAND LINE CONFIG | " + arg + ": " + cnf[arg]);
      });

      console.log(chalkLog("USER\n" + jsonPrint(serverUserObj)));

      var configArgs = Object.keys(cnf);
      configArgs.forEach(function(arg){
        console.log("FINAL CONFIG | " + arg + ": " + cnf[arg]);
      });

      if (cnf.enableStdin){

        console.log("STDIN ENABLED");

        stdin = process.stdin;
        if(typeof stdin.setRawMode !== 'undefined') {
          stdin.setRawMode( true );
        }
        stdin.resume();
        stdin.setEncoding( 'utf8' );
        stdin.on( 'data', function( key ){

          switch (key) {
            case '\u0003':
              process.exit();
            break;
            case 'a':
              abortCursor = true;
              console.log(chalkAlert("ABORT: " + abortCursor));
            break;
            // case "c":
            //   configuration.cursorUserPause = !configuration.cursorUserPause;
            //   if (configuration.cursorUserPause) {
            //     cursorUser.pause();
            //   }
            //   else {
            //     cursorUser.resume();
            //   }
            //   console.log(chalkRedBold("CURSOR USER PAUSE: " + configuration.cursorUserPause));
            // break;
            case 'q':
              quit();
            break;
            case 'Q':
              quit();
            break;
            case 's':
              showStats();
            break;
            case 'S':
              showStats(true);
            break;
            default:
              console.log(
                "\n" + "q/Q: quit"
                + "\n" + "s: showStats"
                + "\n" + "S: showStats verbose"
                );
            break;
          }
        });
      }

      initStatsUpdate(cnf, function(err, cnf2){
        return(callback(err, cnf));
      });
     }
  });
}

function loadYamlConfig(yamlFile, callback){
  console.log(chalkInfo("LOADING YAML CONFIG FILE: " + yamlFile));
  fs.exists(yamlFile, function(exists) {
    if (exists) {
      var cnf = yaml.load(yamlFile);
      console.log(chalkInfo("FOUND FILE " + yamlFile));
      callback(null, cnf);
    }
    else {
      var err = "FILE DOES NOT EXIST: " + yamlFile ;
      callback(err, null);
    }
  });
}

function initTwitter(currentTwitterUser, cnf, callback){

  var twitterConfigFile =  currentTwitterUser + ".json";

  loadFile(cnf.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      callback(null, "INIT_TWIT_FOR_DM_ERROR");
    }
    else {
      console.log(chalkTwitter("LOADED TWITTER CONFIG | " + twitterConfigFile + "\n" + jsonPrint(twitterConfig)));

      twit = new Twit({
        consumer_key: twitterConfig.CONSUMER_KEY,
        consumer_secret: twitterConfig.CONSUMER_SECRET,
        access_token: twitterConfig.TOKEN,
        access_token_secret: twitterConfig.TOKEN_SECRET
      });

      twit.get('account/settings', function(err, data, response) {
        if (err){
          console.log('!!!!! TWITTER ACCOUNT ERROR | ' + getTimeStamp() + '\n' + jsonPrint(err));
          callback(null, "INIT_TWIT_FOR_DM_ERROR");
        }
        else {
          console.log(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: " + data.screen_name));
          debug(chalkTwitter('TWITTER ACCOUNT SETTINGS\n' + jsonPrint(data)));

          twit.get('users/show', {screen_name: data.screen_name}, function(err, data, response) {
            if (err){
              console.log('!!!!! TWITTER SHOW USER ERROR | @' + data.screen_name + ' | ' + getTimeStamp() 
                + '\n' + jsonPrint(err));
              return(callback(null, "INIT_TWIT_FOR_DM_ERROR"));
            }
            else{

              debug(chalkTwitter('TWITTER USER\n' + jsonPrint(data)));

              statsObj.user[currentTwitterUser] = {};
              statsObj.user[currentTwitterUser] = data;

              console.log(chalkTwitterBold("TWITTER USER\n==================="
                + "\nID: " + statsObj.user[currentTwitterUser].id_str 
                + "\n" + statsObj.user[currentTwitterUser].name 
                + "\n@" + statsObj.user[currentTwitterUser].screen_name 
                + "\n" + statsObj.user[currentTwitterUser].description 
                + "\n" + statsObj.user[currentTwitterUser].url 
                + "\nTWEETS:    " + statsObj.user[currentTwitterUser].statuses_count 
                + "\nFOLLOWING: " + statsObj.user[currentTwitterUser].friends_count 
                + "\nFOLLOWERS: " + statsObj.user[currentTwitterUser].followers_count 
                // + "\n" + jsonPrint(data)
              ));
            }
          });

          twit.get('application/rate_limit_status', function(err, data, response) {
            if (err){
              console.log('!!!!! TWITTER ACCOUNT ERROR | ' + getTimeStamp() 
                + '\n' + jsonPrint(err));
              return(callback(null, "INIT_TWIT_FOR_DM_ERROR"));
            }
            else{
              callback(null, "INIT_TWIT_FOR_DM_COMPLETE");
              // configEvents.emit("INIT_TWIT_FOR_DM_COMPLETE");
            }
          });
        }
      });
    }

  });
}

function sendKeepAlive(userObj, callback){
  if (statsObj.userReadyAck && statsObj.serverConnected){
    debug(chalkLog("TX KEEPALIVE"
      + " | " + moment().format(compactDateTimeFormat)
    ));
    socket.emit("SESSION_KEEPALIVE", userObj);
    callback(null, null);
  }
  else {
    callback("ERROR", null);
  }
}

function initSocket(cnf, callback){

  console.log(chalkLog("INIT SOCKET"
    + " | " + cnf.targetServer
    + " | " + jsonPrint(serverUserObj)
  ));

  socket = require('socket.io-client')(cnf.targetServer, { reconnection: true });

  socket.on('connect', function(){

    statsObj.serverConnected = true ;
    statsObj.socketId = socket.id;

    console.log(chalkConnect( "CONNECTED TO HOST" 
      + " | SERVER: " + cnf.targetServer 
      + " | ID: " + socket.id 
      ));

    console.log(chalkInfo(socket.id 
      + " | TX USER_READY"
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + serverUserObj.userId
      + " | " + serverUserObj.screenName
      + " | " + serverUserObj.type
      + " | " + serverUserObj.mode
      + "\n" + jsonPrint(serverUserObj.tags)
    ));

    socket.emit("USER_READY", serverUserObj); 
  });

  socket.on("reconnect", function(err){
    statsObj.socketId = socket.id;
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = true;
    console.log(chalkConnect(moment().format(compactDateTimeFormat) 
      + " | SOCKET RECONNECT: " + socket.id
    ));
  });

  socket.on('USER_READY_ACK', function(userId) {
    statsObj.userReadyAck = true ;
    console.log(chalkInfo(socket.id 
      + " | RX USER_READY_ACK"
      + " | " + moment().format(compactDateTimeFormat)
    ));

    primarySocketKeepaliveInterval = setInterval(function(){ // TX KEEPALIVE
      sendKeepAlive(serverUserObj, function(){});
    }, cnf.keepaliveInterval);

  });

  socket.on("error", function(error){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    socket.disconnect();
    console.error(chalkError(moment().format(compactDateTimeFormat) 
      + " | *** SOCKET ERROR"
      + " | " + socket.id
      + " | " + error
    ));
    // socketReconnect(cnf);
  });

  socket.on('connect_error', function(err){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    console.error(chalkError("*** CONNECT ERROR " 
      + " | " + moment().format(compactDateTimeFormat)
      + " | " + err.type
      + " | " + err.description
      // + "\n" + jsonPrint(err)
    ));
    reset(function(){
      // initGlobalTransmitWordQueue(50);
    });
  });

  socket.on('reconnect_error', function(err){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false ;
    debug(chalkError("*** RECONNECT ERROR" 
      + " | " + moment().format(compactDateTimeFormat)
      // + "\n" + jsonPrint(err)
    ));
    // socketReconnect(cnf);
  });

  socket.on('SESSION_ABORT', function(sessionId){
    console.log(chalkDisconnect("@@@@@ RX SESSION_ABORT | " + sessionId));
  });

  socket.on('SESSION_EXPIRED', function(sessionId){
    console.log(chalkDisconnect("@@@@@ RX SESSION_EXPIRED | " + sessionId));
    socket.disconnect();
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false;
    // socketReconnect(cnf);
  });

  socket.on("disconnect", function(){
    statsObj.userReadyAck = false ;
    statsObj.serverConnected = false;
    console.log(chalkConnect(moment().format(compactDateTimeFormat) 
    ));
    // socketReconnect(cnf);
  });

  socket.on('HEARTBEAT', function(heartbeat){
    statsObj.heartbeatsReceived++;
  });

  socket.on('KEEPALIVE_ACK', function(userId) {
    debug(chalkLog("RX KEEPALIVE_ACK | " + userId));
  });

  callback(null, null);
}

function checkRateLimit(callback){

  twit.get('application/rate_limit_status', function(err, data, response) {
    if (err){
      console.error('!!!!! TWITTER ACCOUNT ERROR | ' + getTimeStamp() + '\n' + JSON.stringify(err, null, 3));
      statsObj.twitterErrors++;
      callback(err, null);
      // return;
    }
    else {
      debug(chalkTwitter('\n-------------------------------------\nTWITTER RATE LIMIT STATUS\n' 
        + JSON.stringify(data, null, 3)
      ));

      statsObj.user[currentTwitterUser].twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      debug(chalkInfo("TWITTER RATE LIMIT STATUS"
        + " | " + getTimeStamp()
        + " | LIMIT " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REMAINING " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | RESET " + getTimeStamp(statsObj.user[currentTwitterUser].twitterRateLimitResetAt)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
        // application/rate_limit_status
        // + "\n" + jsonPrint(data)
      ));

      var remainingTime = 1000*data.resources.application["/application/rate_limit_status"].reset - Date.now();
      // debug(chalkInfo(getTimeStamp() 
      //   + " | TWITTER ACCOUNT RATE: LIMIT: " + data.resources.application["/application/rate_limit_status"].limit
      //   + " | REMAINING: " + data.resources.application["/application/rate_limit_status"].remaining
      //   + " | RESET AT: " + getTimeStamp(1000*data.resources.application["/application/rate_limit_status"].reset)
      //   + " | IN " + msToTime(remainingTime)
      // ));
      callback(null, data.resources.application["/application/rate_limit_status"]);
    }
  });
}

function initCheckRateLimitInterval(interval){

  checkRateLimitInterval = setInterval(function(){

    if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag 
      && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){

      statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;

      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

      console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
        + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
        + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
        + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
        + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
        + " | NOW: " + moment().format(compactDateTimeFormat)
        + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
      ));

      // fsm.twitterLimitReset();

    }
    else {
      checkRateLimit(function(err, status){
        if (err){
          console.log(chalkError("checkRateLimit ERROR\n" + err));
        }
        else {

          statsObj.user[currentTwitterUser].twitterRateLimit = status.limit;
          statsObj.user[currentTwitterUser].twitterRateLimitRemaining = status.remaining;
          statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = statsObj.user[currentTwitterUser].twitterRateLimitResetAt.diff(moment());

          // console.log(jsonPrint(status));

          if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag && statsObj.user[currentTwitterUser].twitterRateLimitResetAt.isBefore(moment())){
            statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
            statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*status.reset);
            console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
              + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
              + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
              + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
              + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
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
          }
          else {
            statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment(1000*status.reset);
            debug(chalkInfo("... NO TWITTER RATE LIMIT"
              + " | LIM " + statsObj.user[currentTwitterUser].twitterRateLimit
              + " | REM: " + statsObj.user[currentTwitterUser].twitterRateLimitRemaining
              // + " | EXP @: " + statsObj.user[currentTwitterUser].twitterRateLimitException.format(compactDateTimeFormat)
              + " | RST @: " + statsObj.user[currentTwitterUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
              + " | NOW: " + moment().format(compactDateTimeFormat)
              + " | IN " + msToTime(statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime)
            ));
          }
        }
      });

    }

  }, interval);
}

function initLangAnalyzerMessageRxQueueInterval(interval){

  langAnalyzerMessageRxQueueReady = true;

  console.log(chalkInfo("INIT LANG ANALIZER QUEUE INTERVAL: " + interval + " ms"));

  langAnalyzerMessageRxQueueInterval = setInterval(function () {

    if (langAnalyzerMessageRxQueueReady && (langAnalyzerMessageRxQueue.length > 0)) {

      langAnalyzerMessageRxQueueReady = false;

      var m = langAnalyzerMessageRxQueue.shift();

      var params = {
        noInc: true
      };

      switch (m.op) {
        case "LANG_RESULTS":

          console.log(chalkLog("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
            + " | UID: " + m.obj.userId
            + " | SN: " + m.obj.screenName
            + " | N: " + m.obj.name
            // + " | ENTs: " + Object.keys(m.results.entities).length
            // + "\nENTITIES\n" + jsonPrint(m.results.entities)
          ));

          if (m.error) {
            // console.error(chalkError("*** LANG ERROR"
            //   + "\n" + jsonPrint(m.error)
            // ));
            langAnalyzerMessageRxQueueReady = true;
            break;
          }

          var langEntityKeys = [];

          if (m.results.entities !== undefined) {
            langEntityKeys = Object.keys(m.results.entities);
          }
          else {

          }

          async.each(langEntityKeys, function(entityKey, cb) {
            if (!entityKey.includes(".")) { 
              cb(); 
            }
            else {
              var newKey = entityKey.replace(/\./g, "");
              var oldValue = m.results.entities[entityKey];

              m.results.entities[newKey] = oldValue;
              delete(m.results.entities[entityKey]);

              debug(chalkAlert("REPLACE KEY"
                + " | " + entityKey
                + " | " + newKey
                + "\nOLD\n" + jsonPrint(oldValue)
                + "\nENTITIES\n" + jsonPrint(m.results.entities)
              ));

              cb();
            }
          }, function(err) {

            m.obj.languageAnalysis = m.results;

            userServer.findOneUser(m.obj, params, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER"
                  + "\n" + err
                  + "\n" + jsonPrint(m.obj)
                ));
              }
              else {
                var laEnts = 0;
                if (updatedUserObj.languageAnalysis.entities !== undefined) {
                  laEnts = Object.keys(updatedUserObj.languageAnalysis.entities);
                }
                var kws = updatedUserObj.keywords && (updatedUserObj.keywords !== undefined) ? Object.keys(updatedUserObj.keywords) : [];
                var kwsAuto = updatedUserObj.keywordsAuto && (updatedUserObj.keywordsAuto !== undefined) ? Object.keys(updatedUserObj.keywordsAuto) : [];

                console.log(chalkLog("DB UPDATE USER"
                  + " | UID: " + updatedUserObj.userId
                  + " | NID: " + updatedUserObj.nodeId
                  + " | SN: " + updatedUserObj.screenName
                  + " | N: " + updatedUserObj.name
                  + " | KWs: " + kws
                  + " | KWAuto: " + kwsAuto
                  + "\nLA Es: " + laEnts
                ));
              }
              langAnalyzerMessageRxQueueReady = true;
            }); 
          });

        break;

        case "QUEUE_FULL":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisQueueEmpty = false;
          languageAnalysisQueueFull = true;
          languageAnalysisReadyFlag = false;
          langAnalyzerMessageRxQueueReady = true;
          if (cursorUser) { cursorUser.pause(); }
        break;

        case "QUEUE_READY":
          console.log(chalkError("M<"
            + " [Q: " + langAnalyzerMessageRxQueue.length + "]"
            + " | OP: " + m.op
          ));
          languageAnalysisQueueEmpty = true;
          languageAnalysisQueueFull = false;
          languageAnalysisReadyFlag = true;
          langAnalyzerMessageRxQueueReady = true;
          if (cursorUser) { cursorUser.resume(); }
        break;

        default:
          console.log(chalkError("??? UNKNOWN LANG_ANALIZE OP: " + m.op
          ));
          langAnalyzerMessageRxQueueReady = true;
      }
    }
  }, interval);
}

function initClassifiedUserHashmap(folder, file, callback){

  loadFile(folder, file, function(err, classifiedUsersObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + folder + "/" + file));
      console.log(chalkError("ERROR: loadFile: " + folder + "/" + file));
      callback(err, file);
    }
    else {
      console.log(chalkAlert("LOADED CLASSIFED USERS FILE: " + folder + "/" + file));
      console.log(chalkAlert("LOADED " + Object.keys(classifiedUsersObj).length + " CLASSIFED USERS"));
      callback(null, classifiedUsersObj);
    }
  });
}

var fetchTwitterFriendsIntervalRunning = false;
var fetchTwitterFriendsIntervalometer;

statsObj.nextCursorValid = false;
var totalFriendsArray = [];
var nextCursor = false;
var count = 200;
var twitPromise;

function fetchTwitterFriends(cnf, callback){

  console.log(chalkAlert(moment().format(compactDateTimeFormat)
    + " | GET TWITTER FRIENDS"
    + " | READY: " + languageAnalysisReadyFlag
  ));

  if (!statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag && languageAnalysisReadyFlag) {

    var params = {};
    params.count = 200;

    if (statsObj.nextCursorValid) { params.cursor = parseInt(nextCursor); }

    twitPromise = twit.get('friends/list', params, function(err, data, response){

      if (err) {
        console.log(chalkError(getTimeStamp()
          + " | *** ERROR GET TWITTER FRIENDS: " + err
        ));

        if (err.code == 88){
          statsObj.user[currentTwitterUser].twitterRateLimitException = moment();
          statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = true;

          // fsm.twitterExceedLimit();
        }
        else {
          clearInterval(waitLanguageAnalysisReadyInterval);
          fetchTwitterFriendsIntervalometer.stop();
          fetchTwitterFriendsIntervalRunning = false;

          // fsm.twitterError();
        }
        return(callback(err, null));
      }

      if (data.next_cursor_str > 0) {
        statsObj.nextCursorValid = true;
      }
      else {
        statsObj.nextCursorValid = false;
      }

      nextCursor = data.next_cursor_str;
      statsObj.users.totalFriendsFetched += data.users.length;
      statsObj.users.percentFetched = 100*(statsObj.users.totalFriendsFetched/statsObj.user[currentTwitterUser].friends_count); 

      console.log(chalkRed("@" + statsObj.user[currentTwitterUser].screen_name
        + " | TOTAL FRIENDS: " + statsObj.user[currentTwitterUser].friends_count
        + " | COUNT: " + count
        + " | FETCHED: " + data.users.length
        + " | TOTAL FETCHED: " + statsObj.users.totalFriendsFetched
        + " [ " + statsObj.users.percentFetched.toFixed(1) + "% ]"
        + " | MORE: " + statsObj.nextCursorValid
      ));

      var subFriendsSortedArray = sortOn(data.users, '-followers_count');

      subFriendsSortedArray.forEach(function(friend){

        totalFriendsArray.push(friend);

        debug(chalkTwitter("FRND"
          + "[" + totalFriendsArray.length + "]"
          + " | FLWRs: " + friend.followers_count
          // + " " + friend.id_str
          + " | " + friend.screen_name
          + " | " + friend.name
          + " | FLWING: " + friend.friends_count
          + " | Ts: " + friend.statuses_count
          // + "\n---DESC: " + friend.description
        ));

        Word.findOne({nodeId: friend.screen_name.toLowerCase()}, function(err, word){

          var kws = {};

          if (!err && (word)) {

            debug(chalkAlert("WORD-USER HIT"
              + " | " + word.nodeId
              // + "\n" + jsonPrintword)
            ));


            if (word.keywords !== undefined) {
              if (word.keywords && (word.keywords[word.nodeId] !== undefined)) {
                 Object.keys(word.keywords[word.nodeId]).forEach(function(kwId){
                  if (kwId !== "keywordId") {
                    kws[kwId] = word.keywords[word.nodeId][kwId];
                    console.log(chalkAlert("-- KW"
                      + " | " + kwId
                      + " | " + kws[kwId]
                    ));
                  }
                });
              }
            }
          }

          var userObj = new User();

          userObj.isTwitterUser = true;
          userObj.threeceeFollowing = { 
            userId: statsObj.user[currentTwitterUser].id_str, 
            screenName: statsObj.user[currentTwitterUser].screen_name, 
          };
          userObj.nodeId = friend.id_str;
          userObj.userId = friend.id_str;
          userObj.screenName = friend.screen_name.toLowerCase();
          userObj.name = friend.name;
          userObj.groupId = userObj.userId;
          userObj.url = friend.url;
          userObj.statusesCount = friend.statuses_count;
          userObj.friendsCount = friend.friends_count;
          userObj.followersCount = friend.followers_count;
          userObj.verified = friend.verified;
          userObj.description = friend.description;
          userObj.entities = friend.entities;
          userObj.tags.user = friend.screen_name.toLowerCase();
          userObj.tags.channel = 'twitter';
          userObj.tags.twitter = {};
          userObj.tags.twitter.tweets = friend.statuses_count;
          userObj.tags.twitter.friends = friend.friends_count;
          userObj.tags.twitter.followers = friend.followers_count;
          userObj.tags.group = '';
          userObj.keywords = kws;

          if (classifiedUserHashmap[userObj.userId] !== undefined){
            userObj.keywords = classifiedUserHashmap[userObj.userId];
            console.log(chalkTwitter("USER CLASSIFED"
              + " | " + userObj.userId
              + " | @" + userObj.screenName
              + " | " + userObj.name
              + " | " + Object.keys(userObj.keywords)
            ));
          }

          var userFindParams = {
            noInc: true
          };

          userServer.findOneUser(userObj, userFindParams, function(err, updatedUserObj){

            debug(chalkInfo("<DB USER"
              + " | " + updatedUserObj.userId
              + " | " + updatedUserObj.screenName
              + " | LA: " + jsonPrint(updatedUserObj.languageAnalysis)
            ));

            processUser(updatedUserObj, function(err, user){

              if (neuralNetworkInitialized) {

                generateAutoKeywords(user, function(err, uObj){

                    var params = {
                      noInc: true
                    };

                    userServer.findOneUser(uObj, params, function(err, updatedUserObj){
                      if (err) { 
                        console.log(chalkError("ERROR DB UPDATE USER - generateAutoKeywords"
                          + "\n" + err
                          + "\n" + jsonPrint(uObj)
                        ));
                      }
                      else {
                        var keywords = user.keywords ? Object.keys(updatedUserObj.keywords) : "";
                        var keywordsAuto = user.keywordsAuto ? Object.keys(updatedUserObj.keywordsAuto) : "";

                        console.log(chalkInfo("US UPD<"
                          + " | " + updatedUserObj.userId
                          + " | TW: " + (updatedUserObj.isTwitterUser || "-")
                          + " | @" + updatedUserObj.screenName
                          // + " | LA " + Object.keys(updatedUserObj.languageAnalysis)
                          + " | KWs " + keywords
                          + " | AKWs " + keywordsAuto
                        ));
                      }
                    });

                    // var keywords = user.keywords ? Object.keys(updatedUserObj.keywords) : "";
                });
              }

            });

          });
        });
      });

      if (!statsObj.nextCursorValid 
        || abortCursor 
        || (cnf.testMode && (statsObj.users.totalFriendsFetched >= 147))
        || (statsObj.users.totalFriendsFetched >= statsObj.user[currentTwitterUser].friends_count)) {


        console.log(chalkError("===== END TWITTER USER @" + currentTwitterUser + " ====="
          + " | " + getTimeStamp()
        ));


        totalFriendsSortedFollowersArray = sortOn(totalFriendsArray, '-followers_count');
        totalFriendsSortedFollowingArray = sortOn(totalFriendsArray, '-friends_count');

        console.log(chalkTwitter("TOTAL FRIENDS"
          + " [" + totalFriendsArray.length + "]"
        ));

        var index = 1;
        totalFriendsSortedFollowersArray.forEach(function(friend){
          debug(chalkTwitter("FRIEND"
            + " [" + index + "/" + totalFriendsArray.length + "]"
            + " | FLWRs: " + friend.followers_count
            + " | " + friend.id_str
            + " | " + friend.name
            + " | " + friend.screen_name
            + " | FLWING: " + friend.friends_count
            + " | Ts: " + friend.statuses_count
          ));
          index++;
        });

        console.log(chalkTwitterBold("TOTAL FRIENDS - FOLLOWING"
          + " [" + totalFriendsArray.length + "]"
        ));

        index = 1;
        totalFriendsSortedFollowingArray.forEach(function(friend){
          debug(chalkTwitter("FRIEND"
            + " [" + index + "/" + totalFriendsArray.length + "]"
            + " | FLWING: " + friend.friends_count
            + " | " + friend.name
            + " | " + friend.screen_name
            + " | FLWRs: " + friend.followers_count
            + " | Ts: " + friend.statuses_count
          ));
          index++;
        });

        var totalFriends = totalFriendsArray.length;
        totalFriendsArray = [];

        if (twitterUsersArray.length > 0) {

          if (currentTwitterUser == twitterUsersArray[0]) { twitterUsersArray.shift(); }
          currentTwitterUser = twitterUsersArray.shift();

          console.log(chalkError("===== NEW TWITTER USER @" + currentTwitterUser + " ====="
            + " | " + getTimeStamp()
          ));
          statsObj.nextCursorValid = false;
          nextCursor = false;
          initTwitter(currentTwitterUser, cnf, function(err, response){
          });
        }
        else {
          // fsm.fetchTwitterFriendsEnd();
          abortCursor = false;
          clearInterval(waitLanguageAnalysisReadyInterval);
          fetchTwitterFriendsIntervalRunning = false;
          fetchTwitterFriendsIntervalometer.stop();

          setTimeout(function(){
            quit();
          }, 5000);
        }



        return callback(err, totalFriends);
      }
    });
  }
}

function initFetchTwitterFriendsInterval(interval){

  console.log(chalkAlert("INIT GET TWITTER FRIENDS"
    + " | INTERVAL: " + interval + " MS"
    + " | RUN AT: " + moment().add(interval, 'ms').format(compactDateTimeFormat)
  ));

  if (statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag) {
    return (callback("RATE LIMIT EXCEPTION", null));
  }

  fetchTwitterFriendsIntervalRunning = true;

  fetchTwitterFriendsIntervalometer = timerIntervalometer(function(){
    fetchTwitterFriends(configuration, function(){});
  }, interval);


  waitLanguageAnalysisReadyInterval = setInterval(function(){
    if (languageAnalysisReadyFlag){
      clearInterval(waitLanguageAnalysisReadyInterval);
      fetchTwitterFriendsIntervalometer.start();
    }
  }, 100);

  // KLUDGE TO FORCE IMMEDIATE GET TWITTER FRIENDS
  // fetchTwitterFriends(function(){
  //   fetchTwitterFriendsIntervalometer.start();
  // });
}

var wordExtractionOptions = {
  language:"english",
  remove_digits: true,
  return_changed_case: true,
  remove_duplicates: true
};

function parseDescription(description){
  var mRegEx = mentionsRegex();
  var hRegEx = hashtagRegex();
  var mentionArray = mRegEx.exec(description);
  var hashtagArray = hRegEx.exec(description);
  var wordArray = keywordExtractor.extract(description, wordExtractionOptions);
 
  if (wordArray) {
    wordArray.forEach(function(word){
      word = word.toLowerCase();
      descriptionHistogram[word] = (descriptionHistogram[word] === undefined) ? 1 : descriptionHistogram[word]+1;
      debug(chalkAlert("->- DESC Ws"
        + " | " + descriptionHistogram[word]
        + " | " + word
      ));
    });
  }

  if (mentionArray) {
    mentionArray.forEach(function(userId){
      if (!userId.match("@")) {
        userId = "@" + userId.toLowerCase();
        descriptionHistogram[userId] = (descriptionHistogram[userId] === undefined) ? 1 : descriptionHistogram[userId]+1;
        debug(chalkAlert("->- DESC Ms"
          + " | " + descriptionHistogram[userId]
          + " | " + userId
        ));
      }
    });
  }

  if (hashtagArray) {
    hashtagArray.forEach(function(hashtag){
      // if (!userId.match("@")) {
        hashtag = hashtag.toLowerCase();
        descriptionHistogram[hashtag] = (descriptionHistogram[hashtag] === undefined) ? 1 : descriptionHistogram[hashtag]+1;
        debug(chalkAlert("->- DESC Hs"
          + " | " + descriptionHistogram[hashtag]
          + " | " + hashtag
        ));
      // }
    });
  }
}

function generateAutoKeywords(user, callback){

  var networkInput = [ 0, 0 ];

  if (user.languageAnalysis.sentiment){
    networkInput[0] = user.languageAnalysis.sentiment.magnitude;
    networkInput[1] = user.languageAnalysis.sentiment.score;
  }

  if (user.description){

    parseDescription(user.description, function(err, histogram){

      debug("user.description\n" + jsonPrint(user.description));

      async.eachSeries(descriptionArrays, function(descArray, cb1){

        var type = descArray.type;

        debug(chalkAlert("START ARRAY: " + type + " | " + descArray.array.length));

        async.eachSeries(descArray.array, function(element, cb2){
          if (histogram[element]) {
            // console.log("ARRAY: " + descArray.type + " | + " + element);
            networkInput.push(1);
            cb2();
          }
          else {
            // console.log("ARRAY: " + descArray.type + " | - " + element);
            networkInput.push(0);
            cb2();
          }
        }, function(err){
          debug(chalkAlert("DONE ARRAY: " + type));
          cb1();
        });

      }, function(err){
        debug(chalkAlert("PARSE DESC COMPLETE"));
      });

    });
  }
  else {
    descriptionWordsArray.forEach(function(word){
      networkInput.push(0);
    });
    descriptionMentionsArray.forEach(function(word){
      networkInput.push(0);
    });
    descriptionHashtagsArray.forEach(function(word){
      networkInput.push(0);
    });
  }

  var networkOutput = network.activate(networkInput); // 0.0275

  var maxOutputIndex = indexOfMax(networkOutput);

  var keywords = user.keywords ? Object.keys(user.keywords) : "";
  var keywordsAuto;
  var currentChalk;

  switch (maxOutputIndex) {
    case 0:
      user.keywordsAuto = { "left": 100 };
      keywordsAuto = "left";
      currentChalk = chalk.blue;
      if (keywords[0] === "left") { currentChalk = chalk.bold.blue;}
    break;
    case 1:
      user.keywordsAuto = { "neutral": 100 };
      keywordsAuto = "neutral";
      currentChalk = chalk.black;
      if (keywords[0] === "neutral") { currentChalk = chalk.bold.black;}
    break;
    case 2:
      user.keywordsAuto = { "right": 100 };
      keywordsAuto = "right";
      currentChalk = chalk.yellow;
      if (keywords[0] === "neutral") { currentChalk = chalk.bold.yellow;}
    break;
    default:
      user.keywordsAuto = null;
      currentChalk = chalk.gray;
      keywordsAuto = "";
  }

  var magnitudeText;
  var scoreText;

  if (user.languageAnalysis.sentiment){
    magnitudeText = user.languageAnalysis.sentiment.magnitude.toFixed(3);
    scoreText = user.languageAnalysis.sentiment.score.toFixed(3);
  }
  else {
    magnitudeText = "UNDEFINED";
    scoreText  = "UNDEFINED";
  }

  console.log(currentChalk("AUTO KW"
    + " | " + user.screenName
    + " | MAG: " + magnitudeText
    + " | SCORE: " + scoreText
    + " | L: " + networkOutput[0].toFixed(3)
    + " | N: " + networkOutput[1].toFixed(3)
    + " | R: " + networkOutput[2].toFixed(3)
    + " | KWs: " + keywords
    + " | AKWs: " + keywordsAuto
  ));

  callback(null, user);
}

function processUser(user, callback){

  statsObj.analyzer.total += 1;

  if (user.keywords && (Object.keys(user.keywords).length > 0)) {

    debug("KWS\n" + jsonPrint(user.keywords));
    
    classifiedUserHashmap[user.userId] = user.keywords;
    statsObj.users.classified = Object.keys(classifiedUserHashmap).length;

    var chalkCurrent = chalkLog;

    var classText;

    switch (Object.keys(user.keywords)[0]) {
      case "right":
        classText = "R";
        chalkCurrent = chalk.red;
        statsObj.classification.manual.right += 1;
      break;
      case "left":
        classText = "L";
        chalkCurrent = chalk.blue;
        statsObj.classification.manual.left += 1;
      break;
      case "neutral":
        classText = "N";
        chalkCurrent = chalk.black;
        statsObj.classification.manual.neutral += 1;
      break;
      case "positive":
        classText = "+";
        chalkCurrent = chalk.green;
        statsObj.classification.manual.positive += 1;
      break;
      case "negative":
        classText = "-";
        chalkCurrent = chalk.bold.red;
        statsObj.classification.manual.negative += 1;
      break;
      default:
        classText = Object.keys(user.keywords)[0];
        chalkCurrent = chalk.black;
        statsObj.classification.manual.other += 1;
    }

    console.log(chalkCurrent("MCL USR   "
      + " [" + Object.keys(classifiedUserHashmap).length + "]"
      + " [ L: " + statsObj.classification.manual.left
      + " | R: " + statsObj.classification.manual.right
      + " | +: " + statsObj.classification.manual.positive
      + " | -: " + statsObj.classification.manual.negative
      + " | N: " + statsObj.classification.manual.neutral
      + " | O: " + statsObj.classification.manual.other + " ]"
      + " | " + classText
      + " | " + user.userId
      + " | " + user.screenName
      + " | " + user.name
    ));
  }

  if (user.keywordsAuto && (Object.keys(user.keywordsAuto).length > 0)) {

    debug("KWSA\n" + jsonPrint(user.keywordsAuto));

    autoClassifiedUserHashmap[user.userId] = user.keywordsAuto;
    statsObj.users.classifiedAuto = Object.keys(autoClassifiedUserHashmap).length;

    var chalkCurrent = chalkLog;

    var classText;

    switch (Object.keys(user.keywordsAuto)[0]) {
      case "right":
        classText = "R";
        chalkCurrent = chalk.red;
        statsObj.classification.auto.right += 1;
      break;
      case "left":
        classText = "L";
        chalkCurrent = chalk.blue;
        statsObj.classification.auto.left += 1;
      break;
      case "neutral":
        classText = "N";
        chalkCurrent = chalk.black;
        statsObj.classification.auto.neutral += 1;
      break;
      case "positive":
        classText = "+";
        chalkCurrent = chalk.green;
        statsObj.classification.auto.positive += 1;
      break;
      case "negative":
        classText = "-";
        chalkCurrent = chalk.bold.red;
        statsObj.classification.auto.negative += 1;
      break;
      default:
        classText = Object.keys(user.keywordsAuto)[0];
        chalkCurrent = chalk.black;
        statsObj.classification.auto.other += 1;
    }

    console.log(chalkCurrent("== AUTO =="
      + " [" + Object.keys(autoClassifiedUserHashmap).length + "]"
      + " [ L: " + statsObj.classification.auto.left
      + " | R: " + statsObj.classification.auto.right
      + " | +: " + statsObj.classification.auto.positive
      + " | -: " + statsObj.classification.auto.negative
      + " | N: " + statsObj.classification.auto.neutral
      + " | O: " + statsObj.classification.auto.other + " ]"
      + " | " + classText
      + " | " + user.userId
      + " | " + user.screenName
      + " | " + user.name
    ));
  }

  if (Object.keys(user.languageAnalysis).length > 0) {

    var sentiment;

    if ((user.languageAnalysis !== undefined)
      && (user.languageAnalysis.sentiment !== undefined)) {
      sentiment = "M: " + (10*user.languageAnalysis.sentiment.magnitude).toFixed(2)
        + " S: " + (10*user.languageAnalysis.sentiment.score).toFixed(2);
    }
    else {
      sentiment = Object.keys(user.languageAnalysis);
    }

    var kws = user.keywords || {};

    var langAnalyzerText = user.screenName + " | " + user.name + " | " + user.description;

    parseDescription(user.description);

    var threeceeFollowing = (user.threeceeFollowing !== undefined) && user.threeceeFollowing && (Object.keys(user.threeceeFollowing).length > 0) ? user.threeceeFollowing.screenName : "-";

    statsObj.analyzer.skipped += 1;

    debug(chalkInfo("* LA HIT ... SKIP"
      + " [" + statsObj.analyzer.analyzed + " ANLs | " + statsObj.analyzer.skipped + " SKPs | " + statsObj.analyzer.total + " TOT]"
      + " | 3C FLW: " + threeceeFollowing
      + " | Ks: " + Object.keys(kws)
      + " | LA: " + sentiment
      + " | " + user.userId
      + " | " + user.screenName
    ));

    callback(null, user);
  }
  else {

    parseDescription(user.description);

    var langAnalyzerText = user.screenName + " | " + user.name + " | " + user.description;

    langAnalyzerText = langAnalyzerText.replace(/@/g, "");

    // REMOVE URLS FROM DESCRIPTION. MONGO DB HATES URLs as object keys on writes
    if (user.entities && user.entities.description && (user.entities.description.urls.length > 0)) {
      debug(chalkAlert("USER ENTITIES DESC URLS: " + jsonPrint(user.entities.description.urls)));
      user.entities.description.urls.forEach(function(urlObj){
        console.log(chalkAlert("langAnalyzerText: " + langAnalyzerText
          + " | " + urlObj.url
        ));
        var regex = new RegExp(urlObj.url);
        langAnalyzerText = langAnalyzerText.replace(regex, "");
      });
    }
    
    debug(chalkAlert("FINAL langAnalyzerText: " + langAnalyzerText));

    langAnalyzer.send({op: "LANG_ANALIZE", obj: user, text: langAnalyzerText}, function(){
      statsObj.analyzer.analyzed += 1;
      callback(null, user);
    });
  }
}

var currentUserId = 1;
var totalUsers = 0;
var userIndex = 0;
User.count({}, function(err, count) {
  totalUsers = count;
});

function initCursorUser(interval){

  console.log(chalkRed("INIT USER SEARCH"));

  cursorUser = User.find({}).where("userId").gte(currentUserId).cursor();

  cursorUser.on("data", function(us){

    if (Object.keys(us.languageAnalysis).length == 0) {
      debug(chalkInfo("NO LANG ... SKIP | " + us.screenName));
      return;
    }

    processUser(us, function(err, user){

      userIndex += 1;

      if (userIndex % 1 === 0) {

        debug(chalkTwitter("US<"
          + " [" + userIndex + "/" + totalUsers + "]"
          + " | " + user.userId
          + " | TW: " + (user.isTwitterUser || "-")
          + " | @" + user.screenName
          + " | LA " + Object.keys(us.languageAnalysis)
        ));
      }

      if (Object.keys(us.languageAnalysis)[0] == "error") {
        return;
      }

      if (neuralNetworkInitialized) {

        generateAutoKeywords(user, function(err, uObj){

            var params = {
              noInc: true
            };

            userServer.findOneUser(uObj, params, function(err, updatedUserObj){
              if (err) { 
                console.log(chalkError("ERROR DB UPDATE USER - generateAutoKeywords"
                  + "\n" + err
                  + "\n" + jsonPrint(uObj)
                ));
              }
              else {
                var keywords = user.keywords ? Object.keys(updatedUserObj.keywords) : "";
                var keywordsAuto = user.keywordsAuto ? Object.keys(updatedUserObj.keywordsAuto) : "";

                console.log(chalkInfo("US UPD<"
                  + " | " + updatedUserObj.userId
                  + " | TW: " + (updatedUserObj.isTwitterUser || "-")
                  + " | @" + updatedUserObj.screenName
                  // + " | LA " + Object.keys(updatedUserObj.languageAnalysis)
                  + " | KWs " + keywords
                  + " | AKWs " + keywordsAuto
                ));
              }
            });

            // var keywords = user.keywords ? Object.keys(updatedUserObj.keywords) : "";
        });
      }
    });
  });

  cursorUser.on("error", function(err){
    // fsm.cursorUserError();
    console.log(chalkError("*** CURSOR USER ERROR"
      + " | " + err
    ));
  });

  cursorUser.on("end", function(){
    // fsm.endCursorUser();
    console.log(chalkTwitter("=== CURSOR USER END"
    ));
  });

  cursorUser.pause();
};

function loadNeuralNetworkFile(cnf, callback){

  console.log(chalkAlert("LOADING NEURAL NETWORK FILE" 
    + " | " + cnf.neuralNetworkFile
    + "\n" + jsonPrint(cnf)
  ));

  loadFile(dropboxConfigDefaultFolder, cnf.neuralNetworkFile, function(err, loadedNetworkObj){
    if (err) {
      console.error(chalkError("ERROR: loadFile: " + dropboxConfigDefaultFolder + "/" + cnf.neuralNetworkFile));
      console.log(chalkError("ERROR: loadFile: " + dropboxConfigDefaultFolder + "/" + cnf.neuralNetworkFile));
      callback(err, cnf.neuralNetworkFile);
    }
    else {
      console.log(chalkAlert("LOADED NETWORK FILE: " + dropboxConfigDefaultFolder + "/" + cnf.neuralNetworkFile));
      if (loadedNetworkObj.normalization) {
        cnf.normalization = loadedNetworkObj.normalization;
        console.log(chalkAlert("LOADED NORMALIZATION\n" + jsonPrint(cnf.normalization)));
      }
      else {
        console.log(chalkError("??? NORMALIZATION NOT FOUND ??? | " + cnf.neuralNetworkFile));
      }
      network = neataptic.Network.fromJSON(loadedNetworkObj.network);
      callback(null, { network: network, normalization: cnf.normalization });
    }
  });
}

function initLangAnalyzer(callback){
  console.log(chalkAlert("INIT LANGUAGE ANALYZER CHILD PROCESS"));

  langAnalyzer = cp.fork(`languageAnalyzerChild.js`);

  langAnalyzer.on("message", function(m){
    console.log(chalkLog("langAnalyzer RX"
      + " [" + langAnalyzerMessageRxQueue.length + "]"
      + " | " + m.op
      // + " | " + m.obj.userId
      // + " | " + m.obj.screenName
      // + " | " + m.obj.name
      // + "\n" + jsonPrint(m)
    ));
    if (m.op === "LANG_TEST_FAIL") {
      languageAnalysisReadyFlag = false;
      langAnalyzerIdle = false;
      // if (cursorUser) { cursorUser.pause(); }
      console.log(chalkAlert("LANG_TEST_FAIL"));
      quit("LANG_TEST_FAIL");
    }
    else if (m.op === "LANG_TEST_PASS") {
      languageAnalysisReadyFlag = true;
      langAnalyzerIdle = false;
      // if (cursorUser) { cursorUser.pause(); }
      console.log(chalkAlert("LANG_TEST_PASS"));
    }
    else if (m.op === "QUEUE_FULL") {
      languageAnalysisQueueEmpty = false;
      languageAnalysisQueueFull = true;
      langAnalyzerIdle = false;
      if (cursorUser !== undefined) { cursorUser.pause(); }
      console.log(chalkError("!!! LANG Q FULL"));
    }
    else if (m.op === "QUEUE_EMPTY") {
      languageAnalysisQueueEmpty = true;
      languageAnalysisQueueFull = false;
      if (cursorUser !== undefined) { cursorUser.resume(); }
      debug(chalkInfo("LANG Q EMPTY"));
    }
    else if (m.op === "IDLE") {
      langAnalyzerIdle = true;
      languageAnalysisQueueEmpty = true;
      languageAnalysisQueueFull = false;
      languageAnalysisReadyFlag = true;
      if (cursorUser !== undefined) { cursorUser.resume(); }
      debug(chalkInfo("... LANG ANAL IDLE ..."));
    }
    else if (m.op === "QUEUE_READY") {
      languageAnalysisReadyFlag = false;
      languageAnalysisQueueFull = false;
      if (cursorUser !== undefined) { cursorUser.resume(); }
      debug(chalkInfo("LANG Q READY"));
    }
    else {
      debug(chalkInfo("LANG Q PUSH"));
      langAnalyzerIdle = false;
      langAnalyzerMessageRxQueue.push(m);
    }
  });

  langAnalyzer.send({
    op: "INIT",
    interval: 50
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

  if (callback !== undefined) { callback(); }
}

initialize(configuration, function(err, cnf){

  if (err) {
    console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
    if (err.code != 404){
      console.log("err.status: " + err.status);
      quit();
    }
  }

  console.log(chalkAlert(cnf.processName 
    + " STARTED " + getTimeStamp() 
    + "\n" + jsonPrint(cnf)
  ));

  if (cnf.loadNeuralNetworkFilePID) {
    cnf.neuralNetworkFile = "neuralNetwork_" + hostname + "_" + cnf.loadNeuralNetworkFilePID + ".json";
  }
  else {
    cnf.neuralNetworkFile = defaultNeuralNetworkFile;
  }

  loadNeuralNetworkFile(cnf, function(err, network){
    if (!err) { 
      neuralNetworkInitialized = true;
    }
  });

  loadFile(dropboxConfigDefaultFolder, classifiedUsersDefaultFile, function(err, loadedClassifiedUsersObj){
    if (err) {
      console.log(chalkError("*** LOAD CLASSIFED USER FILE ERROR"
        + " | " + err
        + "\n" + jsonPrint(err)
      ));
    }
    else {
      console.log(chalkLog("LOADED DEFAULT CLASSIFED USER FILE"
        + " | " + classifiedUsersDefaultFile
        + " | " + Object.keys(loadedClassifiedUsersObj).length + " USERS"
        // + "\n" + jsonPrint(loadedClassifiedUsersObj)
      ));
    }
  });

  initTwitterUsers(cnf, function(err, tuhm){
    if (err){ }

    if (!currentTwitterUser) { currentTwitterUser = twitterUsersArray.shift(); }

    console.log(chalkTwitter("CURRENT TWITTER USER: " + currentTwitterUser));

    initTwitter(currentTwitterUser, cnf, function(err, response){

      if (err) {
        quit();
      }

      checkRateLimit(function(err, status){

        initCheckRateLimitInterval(checkRateLimitIntervalTime);
        initLangAnalyzerMessageRxQueueInterval(100);
        initLangAnalyzer();

        var twitterUserIds = Object.keys(twitterUserHashMap);
        
        initTwitterUsersComplete = true;
        initTweetHashMapComplete = true;

        if (cnf.userDbCrawl) { 
          console.log(chalkAlert("\n\n*** CRAWLING USER DB ***\n\n"));
          initCursorUser(5000);
          // fsm.cursorUserInit();
        }
        else {
          console.log(chalkAlert("\n\n*** GET TWITTER FRIENDS *** | @" + statsObj.user[currentTwitterUser].screen_name + "\n\n"));
          initFetchTwitterFriendsInterval(fetchTwitterFriendsIntervalTime);
          // fsm.fetchTwitterFriendsInit();
        }

      });
    });

  });
});




