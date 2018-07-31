 /*jslint node: true */
"use strict";
require("isomorphic-fetch");

const DEFAULT_FETCH_COUNT = 200;  // per request twitter user fetch count

const TEST_MODE_TOTAL_FETCH = 40;  // total twitter user fetch count
const TEST_MODE_FETCH_COUNT = 15;  // per request twitter user fetch count

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const DEFAULT_CURSOR_BATCH_SIZE = 100;

const DEFAULT_TWITTER_USERS = [
  "altthreecee02",
  "altthreecee03"
];

let defaultSourceTwitterScreenName = "altthreecee02";
let defaultDestinationTwitterScreenName = "altthreecee03";

let cloneTwitterFriendsBusy = false;
let cloneTwitterFriendsInterval;


const OFFLINE_MODE = false;

const chalk = require("chalk");
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkUser = chalk.blue;

const os = require("os");
const moment = require("moment");
const fs = require("fs");
const deepcopy = require("deep-copy");
const debug = require("debug")("tfe");
const util = require("util");
const Twit = require("twit");
const async = require("async");
const treeify = require("treeify");

let quitWaitInterval;

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackChannel = "#tfe";
const Slack = require("slack-node");
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

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

let saveFileQueueInterval;
let saveFileBusy = false;

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;

const wordAssoDb = require("@threeceelabs/mongoose-twitter");

const neuralNetworkModel = require("@threeceelabs/mongoose-twitter/models/neuralNetwork.server.model");
const userModel = require("@threeceelabs/mongoose-twitter/models/user.server.model");

let NeuralNetwork;
let User;

let dbConnectionReady = false;
let dbConnectionReadyInterval;

let UserServerController;
let userServerController;

let userServerControllerReady = false;

require("isomorphic-fetch");

let saveFileQueue = [];

let checkRateLimitInterval;
let checkRateLimitIntervalTime = ONE_MINUTE;

let stdin;
let abortCursor = false;
let nextUser = false;

let currentTwitterUser ;
let currentTwitterUserIndex = 0;

let configuration = {};

configuration.cloneTwitterFriendsIntervalTime = 10*ONE_SECOND;
configuration.twitterUsers = [];

configuration.saveFileQueueInterval = 1000;
configuration.testMode = false;
configuration.fetchCount = configuration.testMode ? TEST_MODE_FETCH_COUNT :  DEFAULT_FETCH_COUNT;
configuration.quitOnComplete = true;

let statsObj = {};
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.heartbeatsReceived = 0;
statsObj.user = {};
statsObj.totalTwitterFriends = 0;
statsObj.twitterErrors = 0;
statsObj.users = {};
statsObj.users.totalTwitterFriends = 0;
statsObj.users.grandTotalFriendsFetched = 0;
statsObj.users.totalFriendsFetched = 0;
statsObj.users.totalPercentFetched = 0;
statsObj.userQueryCursor = "INIT";

const TCF_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.fetchUsersComplete = false;
statsObj.runId = TCF_RUN_ID;
statsObj.elapsed = 0;

let statsUpdateInterval;

let twitterUserHashMap = {};


// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TCF_CONFIG_FILE = process.env.DROPBOX_TCF_CONFIG_FILE || "twitterCloneFriendsConfig.json";
const DROPBOX_TCF_STATS_FILE = process.env.DROPBOX_TCF_STATS_FILE || "twitterCloneFriendsStats.json";

let dropboxConfigHostFolder = "/config/utility/" + hostname;
// let dropboxConfigDefaultFolder = "/config/utility/default";

let dropboxConfigFile = hostname + "_" + DROPBOX_TCF_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/cloneFriends";
let statsFile = DROPBOX_TCF_STATS_FILE;

console.log("DROPBOX_TCF_CONFIG_FILE: " + DROPBOX_TCF_CONFIG_FILE);
console.log("DROPBOX_TCF_STATS_FILE : " + DROPBOX_TCF_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const Dropbox = require("./js/dropbox").Dropbox;

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

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

// const jsonPrint = function (obj){
//   if (obj) {
//     return JSON.stringify(obj, null, 2);
//   }
//   else {
//     return "UNDEFINED";
//   }
// };


const jsonPrint = function (obj) {
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};



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

function quit(cause){

  console.log( "\nTCF | ... QUITTING ..." );

  if (cause) {
    console.log( "CAUSE: " + jsonPrint(cause) );
  }

  clearInterval(cloneTwitterFriendsInterval);

  quitWaitInterval = setInterval(function () {

    if (!saveFileBusy 
      && (saveFileQueue.length === 0)
      ){

      clearInterval(statsUpdateInterval);
      clearInterval(checkRateLimitInterval);
      clearInterval(quitWaitInterval);
      clearInterval(cloneTwitterFriendsInterval);

      console.log(chalkAlert("ALL PROCESSES COMPLETE ... QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));

      setTimeout(function(){
        process.exit();      
      }, 5000);
    }
    else {      
      console.log(chalkAlert("... WAITING FOR ALL PROCESSES COMPLETE BEFORE QUITTING"
       + " | SAVE FILE BUSY: " + saveFileBusy
       + " | SAVE FILE Q: " + saveFileQueue.length
      ));
    }

  }, 1000);
}

const USER_ID = "tcf_" + hostname;
const SCREEN_NAME = "tcf_" + hostname;

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

const Stately = require("stately.js");
let fsm;
let fsmPreviousState = "IDLE";
let fsmPreviousPauseState;

function twitterUserUpdate(userScreenName, callback){

  twitterUserHashMap[userScreenName].twit.get("users/show", {screen_name: userScreenName}, function(err, userShowData, response) {
  
    if (err){
      console.log("!!!!! TWITTER SHOW USER ERROR | @" + userScreenName + " | " + getTimeStamp() 
        + "\n" + jsonPrint(err));
      return(callback(err));
    }

    // debug(chalkTwitter("TWITTER USER DATA\n" + jsonPrint(userShowData)));
    // debug(chalkTwitter("TWITTER USER RESPONSE\n" + jsonPrint(response)));

    // statsObj.user[userScreenName] = {};

    statsObj.user[userScreenName].id = userShowData.id_str;
    statsObj.user[userScreenName].name = userShowData.name;
    statsObj.user[userScreenName].screenName = userShowData.screen_name.toLowerCase();
    statsObj.user[userScreenName].description = userShowData.description;
    statsObj.user[userScreenName].url = userShowData.url;
    statsObj.user[userScreenName].statusesCount = userShowData.statuses_count;
    statsObj.user[userScreenName].friendsCount = userShowData.friends_count;
    statsObj.user[userScreenName].followersCount = userShowData.followers_count;

    // statsObj.user[userScreenName].totalFriendsFetched = 0;
    // statsObj.user[userScreenName].endFetch = false;
    // statsObj.user[userScreenName].count = configuration.fetchCount;
    // statsObj.user[userScreenName].friendsProcessed = 0;
    // statsObj.user[userScreenName].percentProcessed = 0;
    // statsObj.user[userScreenName].nextCursor = -1;
    // statsObj.user[userScreenName].nextCursorValid = false;
    // statsObj.user[userScreenName].twitterRateLimit = 0;
    // statsObj.user[userScreenName].twitterRateLimitExceptionFlag = false;
    // statsObj.user[userScreenName].twitterRateLimitRemaining = 0;
    // statsObj.user[userScreenName].twitterRateLimitResetAt = moment();
    // statsObj.user[userScreenName].twitterRateLimitRemainingTime = 0;
    // statsObj.user[userScreenName].friendsProcessStart = moment();
    // statsObj.user[userScreenName].friendsProcessEnd = moment();
    // statsObj.user[userScreenName].friendsProcessElapsed = 0;

    console.log(chalkTwitterBold("====================================================================="
      + "\nTWITTER USER"
      + " | @" + statsObj.user[userScreenName].screenName 
      + " | " + statsObj.user[userScreenName].name 
      + " | Ts: " + statsObj.user[userScreenName].statusesCount 
      + " | FRNDS: " + statsObj.user[userScreenName].friendsCount 
      + " | FLWRs: " + statsObj.user[userScreenName].followersCount
      + "\n====================================================================="
    ));

    callback(null);
  });
}

// function checkRateLimit(params, callback){

//   const screenName = params.screenName;

//   if (twitterUserHashMap[params.screenName] === undefined) {
//     if (callback !== undefined) { 
//       return(callback(null, null));
//     }
//     else {
//     return;
//     }
//   }

//   twitterUserHashMap[screenName].twit.get(
//     "application/rate_limit_status", 
//     function(err, data, response) {

//     debug("application/rate_limit_status response: " + jsonPrint(response));
    
//     if (err){
//       console.log(chalkError("!!!!! TWITTER ACCOUNT ERROR"
//         + " | @" + screenName
//         + " | " + getTimeStamp()
//         + " | CODE: " + err.code
//         + " | STATUS CODE: " + err.statusCode
//         + " | " + err.message
//         // + "\n" + jsonPrint(err)
//       ));
//       statsObj.twitterErrors+= 1;

//       if (callback !== undefined) { callback(err, null); }
//     }
//     else {
//       debug(chalkTwitter("\n-------------------------------------\nTWITTER RATE LIMIT STATUS\n" 
//         + JSON.stringify(data, null, 3)
//       ));

//       if (statsObj.user[screenName].twitterRateLimitExceptionFlag 
//         && statsObj.user[screenName].twitterRateLimitResetAt.isBefore(moment())){


//         fsm.fsm_rateLimitEnd();
//         statsObj.user[screenName].twitterRateLimitExceptionFlag = false;
//       // 
//         console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
//           + " | @" + screenName
//           + " | LIM " + statsObj.user[screenName].twitterRateLimit
//           + " | REM: " + statsObj.user[screenName].twitterRateLimitRemaining
//           + " | EXP @: " + statsObj.user[screenName].twitterRateLimitException.format(compactDateTimeFormat)
//           + " | NOW: " + moment().format(compactDateTimeFormat)
//         ));
//       }

//       statsObj.user[screenName].twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
//       statsObj.user[screenName].twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
//       statsObj.user[screenName].twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
//       statsObj.user[screenName].twitterRateLimitRemainingTime = statsObj.user[screenName].twitterRateLimitResetAt.diff(moment());

//       console.log(chalkLog("TWITTER RATE LIMIT STATUS"
//         + " | @" + screenName
//         + " | " + getTimeStamp()
//         + " | LIMIT " + statsObj.user[screenName].twitterRateLimit
//         + " | REMAINING " + statsObj.user[screenName].twitterRateLimitRemaining
//         + " | RESET " + getTimeStamp(statsObj.user[screenName].twitterRateLimitResetAt)
//         + " | IN " + msToTime(statsObj.user[screenName].twitterRateLimitRemainingTime)
//       ));

//       if (statsObj.user[screenName].twitterRateLimitExceptionFlag 
//         && statsObj.user[screenName].twitterRateLimitResetAt.isBefore(moment())){

//         statsObj.user[screenName].twitterRateLimitExceptionFlag = false;

//         console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
//           + " | @" + screenName
//           + " | LIM " + statsObj.user[screenName].twitterRateLimit
//           + " | REM: " + statsObj.user[screenName].twitterRateLimitRemaining
//           + " | EXP @: " + statsObj.user[screenName].twitterRateLimitException.format(compactDateTimeFormat)
//           + " | NOW: " + moment().format(compactDateTimeFormat)
//         ));

//         fsm.fsm_rateLimitEnd();
//       }
//       else if (statsObj.user[screenName].twitterRateLimitExceptionFlag){

//         console.log(chalkAlert("*** TWITTER RATE LIMIT"
//           + " | @" + screenName
//           + " | LIM " + statsObj.user[screenName].twitterRateLimit
//           + " | REM: " + statsObj.user[screenName].twitterRateLimitRemaining
//           + " | EXP @: " + statsObj.user[screenName].twitterRateLimitException.format(compactDateTimeFormat)
//           + " | RST @: " + statsObj.user[screenName].twitterRateLimitResetAt.format(compactDateTimeFormat)
//           + " | NOW: " + moment().format(compactDateTimeFormat)
//           + " | IN " + msToTime(statsObj.user[screenName].twitterRateLimitRemainingTime)
//         ));
//         fsmPreviousState = fsm.getMachineState();
//         fsm.fsm_rateLimitStart();
//       }
//       else {
//         debug(chalkInfo("... NO TWITTER RATE LIMIT"
//           + " | @" + screenName
//           + " | LIM " + statsObj.user[screenName].twitterRateLimit
//           + " | REM: " + statsObj.user[screenName].twitterRateLimitRemaining
//           + " | RST @: " + statsObj.user[screenName].twitterRateLimitResetAt.format(compactDateTimeFormat)
//           + " | NOW: " + moment().format(compactDateTimeFormat)
//           + " | IN " + msToTime(statsObj.user[screenName].twitterRateLimitRemainingTime)
//         ));
//         fsm.fsm_rateLimitEnd();
//       }

//       if (callback !== undefined) { callback(); }
//     }
//   });
// }

function printUserObj(title, user) {

  console.log(chalkUser(title
    + " | UID: " + user.userId
    + " | @" + user.screenName
    + " | N: " + user.name 
    + " | FLWRs: " + user.followersCount
    + " | FRNDs: " + user.friendsCount
    + " | Ts: " + user.statusesCount
    + " | Ms:  " + user.mentions
    + " | LS: " + getTimeStamp(user.lastSeen)
    + " | FLWg: " + user.following 
    + " | 3C: @" + user.threeceeFollowing 
    + " | CAT MAN: " + user.category
    + " | CAT AUTO: " + user.categoryAuto
  ));
}


function updateDbUser(params, callback) {

  const userObj = params.userObj;
  const following = params.following;
  const verbose = params.verbose || false;

  const query = { nodeId: userObj.nodeId };

  let update = {};

  update["$set"] = { 
    threeceeFollowing: params.threeceeUser, 
    following: following,
  };

  const options = {
    new: true,
    upsert: true,
    setDefaultsOnInsert: true,
  };

  User.findOneAndUpdate(query, update, options, function(err, userDbUpdated){

    if (err) {
      console.log(chalkError("*** updateDbUser | USER FIND ONE ERROR: " + err));
      return callback(err, null);
    }

    callback(null, userDbUpdated);

  });
}




let sourceUserFriendsQueue = [];

function initUserQueryCursor(params, callback){

  statsObj.userQueryCursor = "INIT";
  statsObj.numSourceUsers = 0;

  let query = { "threeceeFollowing": params.threeceeUser, "following": true };
  const batchSizeParam = (params.batchSize !== undefined) ? params.batchSize : DEFAULT_CURSOR_BATCH_SIZE;

  User.countDocuments(query, function (err, count) {
    console.log(chalkAlert("SOURCE USERS TO CLONE: " + count));
  });

  const cursor = User.find(query).cursor({ batchSize: batchSizeParam });

  cursor.on("data", function(user) {

    statsObj.userQueryCursor = "DATA";

    sourceUserFriendsQueue.push(user);

    statsObj.numSourceUsers += 1;

    if (statsObj.numSourceUsers % 100 === 0){
      console.log(chalkInfo("U"
        + " [ SRC Q: " + sourceUserFriendsQueue.length
        + " | SRC FTCHD: " + statsObj.numSourceUsers + "]"
        + " | @" + user.screenName
        + " | " + user.nodeId
      ));
    }

  });

  cursor.on("end", function() {
    statsObj.userQueryCursor = "END";
    callback(null);
  });

  cursor.on("error", function(err) {
    console.error(chalkError("*** ERROR initUserQueryCursor: " + err));
    statsObj.userQueryCursor = "END";
    callback(err);
  });

  cursor.on("close", function() {
    statsObj.userQueryCursor = "END";
    callback(null);
  });
}

function cloneTwitterFriends(params){

  if (cloneTwitterFriendsBusy) {
    console.log(chalkAlert("CLONE TWITTER FRIENDS BUSY"));
    return;
  }

  console.log(chalkAlert("cloneTwitterFriends params\n" + jsonPrint(params)));

  clearInterval(cloneTwitterFriendsInterval);

  const sourceScreenName = params.source;
  const destinationScreenName = params.destination;

  const sourceTwitter = twitterUserHashMap[sourceScreenName];
  const destinationTwitter = twitterUserHashMap[destinationScreenName];

  if (statsObj.user[sourceScreenName] === undefined) { 
    statsObj.user[sourceScreenName] = {};
    statsObj.user[sourceScreenName].totalFriendsFetched = 0;
    statsObj.user[sourceScreenName].totalPercentFetched = 0;
    // statsObj.user[sourceScreenName].nextCursor = -1;
  }

  initUserQueryCursor({threeceeUser: sourceScreenName}, function(err){
    if (!err) {

    }
  });

  let friend  ;

  cloneTwitterFriendsInterval = setInterval(function(){

    if (!cloneTwitterFriendsBusy && (sourceUserFriendsQueue.length > 0)) {

      cloneTwitterFriendsBusy = true;

      friend = sourceUserFriendsQueue.shift();

      statsObj.users.grandTotalFriendsFetched += 1;

      statsObj.user[sourceScreenName].totalFriendsFetched += 1;
      statsObj.user[sourceScreenName].totalPercentFetched = 100*(statsObj.user[sourceScreenName].totalFriendsFetched/statsObj.user[sourceScreenName].friendsCount); 
      statsObj.user[sourceScreenName].percentFetched = 100*(statsObj.user[sourceScreenName].totalFriendsFetched/statsObj.user[sourceScreenName].friendsCount); 

      if (configuration.testMode 
        && (statsObj.user[sourceScreenName].totalFriendsFetched >= TEST_MODE_TOTAL_FETCH)) {

        statsObj.user[sourceScreenName].endFetch = true;

        console.log(chalkAlert("\n=====================================\n"
          + "*** TEST MODE END FETCH ***"
          + "\nSOURCE:      @" + sourceScreenName
          + "\nDESTINATION: @" + destinationScreenName
          + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
          + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
          + "\nTOTAL FRIENDS FETCHED: " + statsObj.user[sourceScreenName].totalFriendsFetched
          + "\n=====================================\n"
        ));

      }
      else if ((statsObj.userQueryCursor === "END") && (sourceUserFriendsQueue.length === 0)) {
        statsObj.user[sourceScreenName].endFetch = true;
      }
      else {
        statsObj.user[sourceScreenName].endFetch = false;
      }

      statsObj.user[sourceScreenName].friendsProcessed += 1;
      statsObj.user[sourceScreenName].percentProcessed = 100*statsObj.user[sourceScreenName].friendsProcessed/statsObj.user[sourceScreenName].friendsCount;

      console.log(chalkInfo("@" + sourceScreenName
        + " | " + statsObj.user[sourceScreenName].friendsProcessed + " / " + statsObj.user[sourceScreenName].friendsCount
        + " (" + statsObj.user[sourceScreenName].percentProcessed.toFixed(1) + "%)"
        + " | FRIEND ID: " + friend.userId
        + " | @" + friend.screenName
      ));

      destinationTwitter.twit.post("friendships/create", {user_id: friend.userId}, function(err, data, response){
        if (err) {


          if (err.code === 158) {
            console.log(chalkError("ERROR: FOLLOW SELF"
              + " | @" + destinationScreenName
              + " | " + friend.userId
              + " | @" + friend.screenName
            ));

            cloneTwitterFriendsBusy = false;

          }

          if (err.code === 108) {
            console.log(chalkError("ERROR: USER NOT FOUND"
              + " | @" + destinationScreenName
              + " | " + friend.userId
              + " | @" + friend.screenName
            ));


            updateDbUser({ userObj: friend, threeceeUser: false, following: false }, function(err, udpateUser){

              if (err) {

              }
              else {

                printUserObj("--- UNFOLLOW", udpateUser);
                
              }

              setTimeout(function(){
                cloneTwitterFriendsBusy = false;
              }, 5000);

            });

          }

          if (err.code === 161) {
            console.log(chalkError("ERROR: FOLLOW FRIEND LIMIT | *** QUITTING ***"
              + " | @" + destinationScreenName
              + " | " + friend.userId
              + " | @" + friend.screenName
              // + " | " + jsonPrint(err)
            ));

            setTimeout(function(){
              quit("TWITTER FOLLOW LIMIT | @" + destinationScreenName );
            }, 5000);
          }

          if ((err.code !== 158) && (err.code !== 108) && (err.code !== 161)) {
            console.log(chalkError("ERROR: FOLLOW FRIEND"
              + " | @" + destinationScreenName
              + " | " + friend.userId
              + " | @" + friend.screenName
              // + " | " + jsonPrint(err)
            ));

            cloneTwitterFriendsBusy = false;

          }
        }
        else {

          updateDbUser({ userObj: friend, threeceeUser: destinationScreenName, following: true  }, function(err, udpateUser){

            if (err) {

            }
            else {

              printUserObj("+++ FOLLOW", udpateUser);
              
            }

            setTimeout(function(){
              cloneTwitterFriendsBusy = false;
            }, 1000);

          });

        }
      });

    }
  }, params.interval);
}

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
    "fsm_cloneStart": "CLONE_START"
  },
  "CLONE_START":{
    onEnter: function(event, oldState, newState){

      reporter(event, oldState, newState);

      console.log(chalkAlert("CLONE_START"
        + " | " + event
        + " | SRC: @" + defaultSourceTwitterScreenName
        + " > DEST: @" + defaultDestinationTwitterScreenName
      ));

      let params = {};
      params.interval = configuration.cloneTwitterFriendsIntervalTime;
      params.source = defaultSourceTwitterScreenName;
      params.destination = defaultDestinationTwitterScreenName;
      params.count = DEFAULT_FETCH_COUNT;

      // if (statsObj.user[defaultSourceTwitterScreenName].nextCursorValid) {
      //   params.cursor = parseInt(statsObj.user[defaultSourceTwitterScreenName].nextCursor);
      //   statsObj.user[defaultSourceTwitterScreenName].cursor = parseInt(statsObj.user[defaultSourceTwitterScreenName].nextCursor);
      // }
      // else {
      //   statsObj.user[defaultSourceTwitterScreenName].cursor = null;
      // }

      cloneTwitterFriends(params);

    },
    "fsm_reset": "RESET",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_cloneEnd": "READY"
  },
  "PAUSE_CLONE":{
    onEnter: reporter,
    "fsm_reset": "RESET",
    "fsm_rateLimitEnd": "FETCH_USER",
    "fsm_cloneEnd": "READY"
  },
  "PAUSE_RATE_LIMIT":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      clearInterval(cloneTwitterFriendsInterval);
      console.log("PAUSE_RATE_LIMIT | PREV STATE: " + oldState);
    },
    "fsm_reset": "RESET",
    "fsm_rateLimitEnd": function(){
      return getPreviousPauseState();
    },
    "fsm_cloneEnd": "READY"
  }
};

fsm = Stately.machine(fsmStates);


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
      if (err) {
        console.log(chalkError("fs readFile ERROR: " + err));
      }
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
          console.trace(chalkError("TCF | JSON PARSE ERROR: " + e));
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
          console.trace(chalkError("TCF | JSON PARSE ERROR: " + jsonPrint(e)));
          console.trace(chalkError("TCF | JSON PARSE ERROR: " + e));
          callback("JSON PARSE ERROR", null);
        }
      }
      else {
        callback(null, null);
      }
    })
    .catch(function(error) {
      console.log(chalkError("TCF | DROPBOX LOAD FILE ERROR"
        + " | " + fullPath
        + " | ERROR STATUS: " + error.response.status
      ));
      // console.log(chalkError("TCF | !!! DROPBOX READ " + fullPath + " ERROR"));
      // console.log(chalkError("TCF | " + jsonPrint(error.error)));

      if (error.response.status === 404) {
        console.error(chalkError("TCF | !!! DROPBOX READ FILE " + fullPath + " NOT FOUND"
          + " ... SKIPPING ...")
        );
        return(callback(null, null));
      }
      if (error.response.status === 409) {
        console.log(chalkError("TCF | DROPBOX LOAD FILE NOT FOUND"
          + " | " + fullPath
          // + " | ERROR STATUS: " + error.response.status
        ));
        return(callback(error, null));
      }
      if (error.response.status === 0) {
        console.error(chalkError("TCF | !!! DROPBOX NO RESPONSE"
          + " ... NO INTERNET CONNECTION? ... SKIPPING ..."));
        return(callback(null, null));
      }
      callback(error, null);
    });
  }
}


const cla = require("command-line-args");
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};

const optionDefinitions = [enableStdin, quitOnError, quitOnComplete, testMode];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));
console.log(chalkInfo("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig)));

process.title = "node_twitterCloneFriends";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
  clearInterval(cloneTwitterFriendsInterval);
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(checkRateLimitInterval);
    clearInterval(statsUpdateInterval);

    setTimeout(function() {
      console.log("QUITTING twitterClonefriEnds");
      process.exit(0);
    }, 300);

  }
});

// const runEnableArgs = {};
// runEnableArgs.userServerReady = userServerReady;

// function runEnable(displayArgs) {

//   runEnableArgs.userServerReady = userServerReady;

//   const runEnableKeys = Object.keys(runEnableArgs);

//   if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }

//   runEnableKeys.forEach(function(key){
//     if (displayArgs) { console.log(chalkInfo("runEnable | " + key + ": " + runEnableArgs[key])); }
//     if (!runEnableArgs[key]) {
//       if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }
//       return false;
//     }
//   });

//   if (displayArgs) { console.log(chalkInfo("------ runEnable ------")); }

//   return true;
// }

function showStats(options){
  // runEnable();
  if (options) {
  }
  else {

    if (statsObj.user[defaultSourceTwitterScreenName] !== undefined) {

      statsObj.user[defaultSourceTwitterScreenName].percentProcessed = 100*statsObj.user[defaultSourceTwitterScreenName].friendsProcessed/statsObj.user[defaultSourceTwitterScreenName].friendsCount;
      statsObj.user[defaultSourceTwitterScreenName].friendsProcessElapsed = moment().diff(statsObj.user[defaultSourceTwitterScreenName].friendsProcessStart);

      statsObj.users.totalTwitterFriends = 0;
      statsObj.users.totalFriendsFetched = 0;

      configuration.twitterUsers.forEach(function(tUserScreenName){
        if (statsObj.user[tUserScreenName] !== undefined) {
          statsObj.users.totalFriendsFetched += statsObj.user[tUserScreenName].totalFriendsFetched;
          statsObj.users.totalTwitterFriends += statsObj.user[tUserScreenName].friendsCount;
        }
        statsObj.users.totalPercentFetched = 100 * statsObj.users.totalFriendsFetched/statsObj.users.totalTwitterFriends;
      });

      console.log(chalkLog("--- STATS --------------------------------------\n"
        + "SRC USR:   @" + defaultSourceTwitterScreenName
        + "\nDST USR:   @" + defaultDestinationTwitterScreenName
        + "\nSTART:   " + statsObj.startTimeMoment.format(compactDateTimeFormat)
        + "\nELAPSED: " + statsObj.elapsed
        + "\nFSM:     " + fsm.getMachineState()
        + "\nU PRCSD: " + statsObj.user[defaultSourceTwitterScreenName].friendsProcessed + " / " + statsObj.user[defaultSourceTwitterScreenName].friendsCount
        + " (" + statsObj.user[defaultSourceTwitterScreenName].percentProcessed.toFixed(2) + "%)"
        + "\n------------------------------------------------\n"
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

process.on( "SIGINT", function() {
  clearInterval(cloneTwitterFriendsInterval);
  fsm.fsm_reset();
  quit({source: "SIGINT"});
});

function connectDb(callback){

  statsObj.status = "CONNECT DB";

  wordAssoDb.connect("TCF_" + process.pid, function(err, db){
    if (err) {
      console.log(chalkError("*** TCF | MONGO DB CONNECTION ERROR: " + err));
      callback(err, null);
      dbConnectionReady = false;
    }
    else {

      db.on("error", function(){
        console.error.bind(console, "*** TCF | MONGO DB CONNECTION ERROR ***\n");
        console.log(chalkError("*** TCF | MONGO DB CONNECTION ERROR ***\n"));
        db.close();
        dbConnectionReady = false;
      });

      db.on("disconnected", function(){
        console.error.bind(console, "*** TCF | MONGO DB DISCONNECTED ***\n");
        console.log(chalkAlert("*** TCF | MONGO DB DISCONNECTED ***\n"));
        dbConnectionReady = false;
      });


      console.log(chalk.green("TCF | MONGOOSE DEFAULT CONNECTION OPEN"));

      dbConnectionReady = true;

      User = mongoose.model("User", userModel.UserSchema);
      NeuralNetwork = mongoose.model("NeuralNetwork", neuralNetworkModel.NeuralNetworkSchema);

      callback(null, db);
    }
  });
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

  console.log(chalkBlue("TCF | INIT DROPBOX SAVE FILE INTERVAL | " + cnf.saveFileQueueInterval + " MS"));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(function () {

    if (!saveFileBusy && saveFileQueue.length > 0) {

      saveFileBusy = true;

      const saveFileObj = saveFileQueue.shift();

      saveFile(saveFileObj, function(err){
        if (err) {
          console.log(chalkError("TCF | *** SAVE FILE ERROR ... RETRY | " + saveFileObj.folder + "/" + saveFileObj.file));
          saveFileQueue.push(saveFileObj);
        }
        else {
          console.log(chalkLog("TCF | SAVED FILE | " + saveFileObj.folder + "/" + saveFileObj.file));
        }
        saveFileBusy = false;
      });
    }

  }, cnf.saveFileQueueInterval);
}

function reset(cause, callback){
  clearInterval(cloneTwitterFriendsInterval);

  console.log(chalkAlert("\nRESET | CAUSE: " + cause + "\n"));

  if (callback !== undefined) { callback(); } 
}

function initStatsUpdate(callback){

  console.log(chalkTwitter("INIT STATS UPDATE INTERVAL | " + configuration.statsUpdateIntervalTime + " MS"));

  clearInterval(statsUpdateInterval);

  statsUpdateInterval = setInterval(function () {

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());
    statsObj.timeStamp = moment().format(compactDateTimeFormat);

    showStats();

  }, configuration.statsUpdateIntervalTime);

  callback(null);
}

function initTwitter(currentTwitterUser, callback){

  let twitterConfigFile =  currentTwitterUser + ".json";

  debug(chalkInfo("INIT TWITTER USER @" + currentTwitterUser + " | " + twitterConfigFile));

  loadFile(configuration.twitterConfigFolder, twitterConfigFile, function(err, twitterConfig){

    if (err) {
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: FILE:  " + configuration.twitterConfigFolder + "/" + twitterConfigFile));
      console.log(chalkError("*** LOADED TWITTER CONFIG ERROR: ERROR: " + err));
      callback(err);
    }
    else {
      console.log(chalkTwitter("LOADED TWITTER CONFIG"
        + " | @" + currentTwitterUser
        + " | CONFIG FILE: " + configuration.twitterConfigFolder + "/" + twitterConfigFile
      ));

      let newTwit;

      if (currentTwitterUser === defaultSourceTwitterScreenName){

        console.log(chalkTwitter("INIT SOURCE TWITTER"
          + " | @" + currentTwitterUser
          // + " | CONFIG FILE: " + configuration.twitterConfigFolder + "/" + twitterConfigFile
        ));

        newTwit = new Twit({
          consumer_key: twitterConfig.CONSUMER_KEY,
          consumer_secret: twitterConfig.CONSUMER_SECRET,
          app_only_auth: true
          // access_token: twitterConfig.TOKEN,
          // access_token_secret: twitterConfig.TOKEN_SECRET
        });
      }
      else {
        newTwit = new Twit({
          consumer_key: twitterConfig.CONSUMER_KEY,
          consumer_secret: twitterConfig.CONSUMER_SECRET,
          access_token: twitterConfig.TOKEN,
          access_token_secret: twitterConfig.TOKEN_SECRET
        });
      }


      twitterUserHashMap[currentTwitterUser].twit = {};
      twitterUserHashMap[currentTwitterUser].twit = newTwit;

      statsObj.user[currentTwitterUser] = {};

      statsObj.user[currentTwitterUser].id = "";
      statsObj.user[currentTwitterUser].name = "";
      statsObj.user[currentTwitterUser].screenName = currentTwitterUser;
      statsObj.user[currentTwitterUser].description = "";
      statsObj.user[currentTwitterUser].url = "";
      statsObj.user[currentTwitterUser].statusesCount = 0;
      statsObj.user[currentTwitterUser].friendsCount = 0;
      statsObj.user[currentTwitterUser].followersCount = 0;

      statsObj.user[currentTwitterUser].totalFriendsFetched = 0;
      statsObj.user[currentTwitterUser].endFetch = false;
      statsObj.user[currentTwitterUser].count = configuration.fetchCount;
      statsObj.user[currentTwitterUser].friendsProcessed = 0;
      statsObj.user[currentTwitterUser].percentProcessed = 0;
      statsObj.user[currentTwitterUser].nextCursor = -1;
      statsObj.user[currentTwitterUser].nextCursorValid = false;
      statsObj.user[currentTwitterUser].twitterRateLimit = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitExceptionFlag = false;
      statsObj.user[currentTwitterUser].twitterRateLimitRemaining = 0;
      statsObj.user[currentTwitterUser].twitterRateLimitResetAt = moment();
      statsObj.user[currentTwitterUser].twitterRateLimitRemainingTime = 0;
      statsObj.user[currentTwitterUser].friendsProcessStart = moment();
      statsObj.user[currentTwitterUser].friendsProcessEnd = moment();
      statsObj.user[currentTwitterUser].friendsProcessElapsed = 0;

      debug(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: @" + currentTwitterUser));


      twitterUserUpdate(currentTwitterUser, function(err){
       if (err){
          console.log("!!!!! TWITTER SHOW USER ERROR | @" + currentTwitterUser + " | " + getTimeStamp() 
            + "\n" + jsonPrint(err));
          return(callback(err));
        }
        callback(null);
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

    console.log(chalkTwitter("TCF | INIT TWITTER USERS"
      + " | FOUND " + configuration.twitterUsers.length + " USERS"
    ));

    async.each(configuration.twitterUsers, function(userScreenName, cb){

      userScreenName = userScreenName.toLowerCase();

      console.log(chalkTwitter("TCF | INIT TWITTER USER @" + userScreenName));

      twitterUserHashMap[userScreenName] = {};
      twitterUserHashMap[userScreenName].screenName = userScreenName;
      twitterUserHashMap[userScreenName].friends = {};

      initTwitter(userScreenName, function(err, twitObj){
        if (err) {
          console.log(chalkError("INIT TWITTER ERROR"
            + " | @" + userScreenName
            + " | ERROR: " + err.message
          ));
          return(cb(err));
        }

        debug("INIT TWITTER twitObj\n" + jsonPrint(twitObj));

        cb();

      });

    }, function(err){

      if (err) {
        if (callback !== undefined) { return(callback(err)); }
      }

      statsObj.users.totalTwitterFriends = 0;
      statsObj.users.totalFriendsFetched = 0;

      configuration.twitterUsers.forEach(function(tUserScreenName){
        statsObj.users.totalFriendsFetched += statsObj.user[tUserScreenName].totalFriendsFetched;
        statsObj.users.totalTwitterFriends += statsObj.user[tUserScreenName].friendsCount;
        statsObj.users.totalPercentFetched = 100 * statsObj.users.totalFriendsFetched/statsObj.users.totalTwitterFriends;
      });

      console.log(chalkTwitterBold("====================================================================="
        + "\nALL TWITTER USERS"
        + " | " + statsObj.users.totalTwitterFriends + " GRAND TOTAL FRIENDS"
        + " | " + statsObj.users.totalFriendsFetched + " GRAND TOTAL FETCHED"
        + " (" + statsObj.users.totalPercentFetched.toFixed(2) + "%)"
        + "\n====================================================================="
      ));

      if (callback !== undefined) { callback(err); }
    });

  }
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
        fsm.fsm_reset();
        quit({source: "STDIN"});
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

  fsm.fsm_initStart();

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.TCF_PROCESS_NAME || "twitterClonefriEnds";
  cnf.testMode = (process.env.TCF_TEST_MODE === "true") ? true : cnf.testMode;

  cnf.quitOnError = process.env.TCF_QUIT_ON_ERROR || false ;
  if (process.env.TCF_QUIT_ON_COMPLETE === "false") {
    cnf.quitOnComplete = false;
  }
  if (process.env.TCF_QUIT_ON_COMPLETE === "true") {
    cnf.quitOnComplete = true;
  }

  cnf.enableStdin = process.env.TCF_ENABLE_STDIN || true ;

  cnf.twitterUsers = process.env.TCF_TWITTER_USERS || DEFAULT_TWITTER_USERS ;
  cnf.statsUpdateIntervalTime = process.env.TCF_STATS_UPDATE_INTERVAL || ONE_MINUTE;

  cnf.twitterConfigFolder = process.env.DROPBOX_WORD_ASSO_DEFAULT_TWITTER_CONFIG_FOLDER || "/config/twitter";

  loadFile(dropboxConfigHostFolder, dropboxConfigFile, function(err, loadedConfigObj){

    let commandLineArgs;
    let configArgs;

    if (!err) {
      console.log(dropboxConfigFile + "\n" + jsonPrint(loadedConfigObj));

      if (loadedConfigObj.TCF_TEST_MODE !== undefined){
        console.log("LOADED TCF_TEST_MODE: " + loadedConfigObj.TCF_TEST_MODE);
        cnf.testMode = loadedConfigObj.TCF_TEST_MODE;
      }

      if (loadedConfigObj.TCF_QUIT_ON_COMPLETE !== undefined){
        console.log("LOADED TCF_QUIT_ON_COMPLETE: " + loadedConfigObj.TCF_QUIT_ON_COMPLETE);
        cnf.quitOnComplete = loadedConfigObj.TCF_QUIT_ON_COMPLETE;
      }

      if (loadedConfigObj.TCF_ENABLE_STDIN !== undefined){
        console.log("LOADED TCF_ENABLE_STDIN: " + loadedConfigObj.TCF_ENABLE_STDIN);
        cnf.enableStdin = loadedConfigObj.TCF_ENABLE_STDIN;
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

      if (loadedConfigObj.TCF_TWITTER_USERS !== undefined){
        console.log("LOADED TCF_TWITTER_USERS: " + jsonPrint(loadedConfigObj.TCF_TWITTER_USERS));
        cnf.twitterUsers = loadedConfigObj.TCF_TWITTER_USERS;
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
            console.error(chalkError("*** TWITTER CONFIG FILE LOAD ERROR\n" + err));
            fsm.fsm_reset();
            quit({source: "CONFIG", error: err});
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
      console.log(chalkAlert("!!! TWITTER CONFIG FILE NOT FOUND ... USING DEFAULTS" 
        + " | " + cnf.twitterConfigFolder + "/" + cnf.twitterConfigFile
      ));

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

function checkRateLimit(params){

  console.log(chalkAlert("checkRateLimit\n" + jsonPrint(params)));

  const threeceeUser = params.threeceeUser;

  // let params = {};
  // params.interval = configuration.cloneTwitterFriendsIntervalTime;
  // params.source = defaultSourceTwitterScreenName;
  // params.destination = defaultDestinationTwitterScreenName;
  // params.count = DEFAULT_FETCH_COUNT;

  //   twitterUserHashMap[threeceeUser].twit = {};
  //   twitterUserHashMap[threeceeUser].twit = newTwit;

  twitterUserHashMap[threeceeUser].twit.get("application/rate_limit_status", function(err, data, response) {
    
    if (err){

      statsObj.user[threeceeUser].twitterErrors+= 1;

      if (err.code === 89){

        console.log(chalkAlert("*** TWITTER GET RATE LIMIT STATUS ERROR | INVALID OR EXPIRED TOKEN" 
          + " | " + getTimeStamp() 
          + " | @" + configuration.threeceeUser 
        ));

        statsObj.user[threeceeUser].err = err;

        fsm.fsm_error();

      }
      else {
        console.log(chalkError("!!!!! TWITTER ACCOUNT ERROR | APPLICATION RATE LIMIT STATUS"
          + " | @" + configuration.threeceeUser
          + " | " + getTimeStamp()
          + " | CODE: " + err.code
          + " | STATUS CODE: " + err.statusCode
          + " | " + err.message
        ));
      }

      // if (callback !== undefined) { callback(err, null); }
    }
    else {

      if (configuration.verbose) {

        console.log(chalkLog("TWITTER RATE LIMIT STATUS"
          + " | @" + configuration.threeceeUser
          + " | LIM: " + statsObj.user[threeceeUser].twitterRateLimit
          + " | REM: " + statsObj.user[threeceeUser].twitterRateLimitRemaining
          + " | RST: " + getTimeStamp(statsObj.user[threeceeUser].twitterRateLimitResetAt)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.user[threeceeUser].twitterRateLimitRemainingTime)
        ));

      }

      if (data.resources.users["/users/show/:id"].remaining > 0){

        statsObj.user[threeceeUser].twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.user[threeceeUser].twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.user[threeceeUser].twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.user[threeceeUser].twitterRateLimitRemainingTime = statsObj.user[threeceeUser].twitterRateLimitResetAt.diff(moment());

        if (statsObj.user[threeceeUser].twitterRateLimitExceptionFlag) {

          statsObj.user[threeceeUser].twitterRateLimitExceptionFlag = false;

          console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
            + " | @" + configuration.threeceeUser
            + " | CONTEXT: " + data.rate_limit_context.access_token
            + " | LIM: " + statsObj.user[threeceeUser].twitterRateLimit
            + " | REM: " + statsObj.user[threeceeUser].twitterRateLimitRemaining
            + " | EXP: " + statsObj.user[threeceeUser].twitterRateLimitException.format(compactDateTimeFormat)
            + " | NOW: " + moment().format(compactDateTimeFormat)
          ));

        }

        if (statsObj.fsmState === "PAUSE_RATE_LIMIT"){
          fsm.fsm_rateLimitEnd();
        }

      }
      else if (data.resources.users["/users/show/:id"].remaining === 0){

        if (!statsObj.user[threeceeUser].twitterRateLimitExceptionFlag) {
          statsObj.user[threeceeUser].twitterRateLimitExceptionFlag = true;
        }

        if (!statsObj.user[threeceeUser].twitterRateLimitException) {
          statsObj.user[threeceeUser].twitterRateLimitExceptionFlag = true;
        }

        statsObj.user[threeceeUser].twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.user[threeceeUser].twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.user[threeceeUser].twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.user[threeceeUser].twitterRateLimitRemainingTime = statsObj.user[threeceeUser].twitterRateLimitResetAt.diff(moment());

        if (statsObj.fsmState !== "PAUSE_RATE_LIMIT"){
          console.log(chalkAlert("*** TWITTER SHOW USER ERROR | RATE LIMIT EXCEEDED" 
            + " | @" + configuration.threeceeUser
            + " | CONTEXT: " + data.rate_limit_context.access_token
            + " | LIM: " + statsObj.user[threeceeUser].twitterRateLimit
            + " | REM: " + statsObj.user[threeceeUser].twitterRateLimitRemaining
            + " | EXP: " + statsObj.user[threeceeUser].twitterRateLimitException.format(compactDateTimeFormat)
            + " | NOW: " + moment().format(compactDateTimeFormat)
          ));
          fsm.fsm_rateLimitStart();
        }
        else {
          console.log(chalkLog("--- TWITTER RATE LIMIT"
            + " | @" + configuration.threeceeUser
            + " | CONTEXT: " + data.rate_limit_context.access_token
            + " | LIM: " + statsObj.user[threeceeUser].twitterRateLimit
            + " | REM: " + statsObj.user[threeceeUser].twitterRateLimitRemaining
            + " | EXP: " + statsObj.user[threeceeUser].twitterRateLimitException.format(compactDateTimeFormat)
            + " | RST: " + statsObj.user[threeceeUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
            + " | NOW: " + moment().format(compactDateTimeFormat)
            + " | IN " + msToTime(statsObj.user[threeceeUser].twitterRateLimitRemainingTime)
          ));
        }
      }
      else if (statsObj.user[threeceeUser].twitterRateLimitExceptionFlag){

        statsObj.user[threeceeUser].twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.user[threeceeUser].twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.user[threeceeUser].twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.user[threeceeUser].twitterRateLimitRemainingTime = statsObj.user[threeceeUser].twitterRateLimitResetAt.diff(moment());

        console.log(chalkLog("--- TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | CONTEXT: " + data.rate_limit_context.access_token
          + " | LIM: " + statsObj.user[threeceeUser].twitterRateLimit
          + " | REM: " + statsObj.user[threeceeUser].twitterRateLimitRemaining
          + " | EXP: " + statsObj.user[threeceeUser].twitterRateLimitException.format(compactDateTimeFormat)
          + " | RST: " + statsObj.user[threeceeUser].twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.user[threeceeUser].twitterRateLimitRemainingTime)
        ));
      }
      else {

        statsObj.user[threeceeUser].twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.user[threeceeUser].twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.user[threeceeUser].twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.user[threeceeUser].twitterRateLimitRemainingTime = statsObj.user[threeceeUser].twitterRateLimitResetAt.diff(moment());

        if (configuration.verbose) {
          console.log(chalkInfo("... NO TWITTER RATE LIMIT"
            + " | @" + configuration.threeceeUser
            + " | LIM: " + statsObj.user[threeceeUser].twitterRateLimit
            + " | REM: " + statsObj.user[threeceeUser].twitterRateLimitRemaining
            + " | RST: " + getTimeStamp(statsObj.user[threeceeUser].twitterRateLimitResetAt)
            + " | NOW: " + moment().format(compactDateTimeFormat)
            + " | IN " + msToTime(statsObj.user[threeceeUser].twitterRateLimitRemainingTime)
          ));
        }
      }

      // if (callback !== undefined) { callback(); }
    }
  });
}

function initCheckRateLimitInterval(interval){

  clearInterval(checkRateLimitInterval);

  debug(chalkInfo("TFC"
    + " | INIT CHECK RATE INTERVAL | " + interval
  ));

  checkRateLimitInterval = setInterval(function(){

    statsObj.elapsed = moment().diff(statsObj.startTimeMoment);

    debug(chalkInfo("CHECK RATE INTERVAL"
      + " | INTERVAL: " + msToTime(interval)
      + " | SRC EXCEPTION: " + statsObj.user[defaultSourceTwitterScreenName].twitterRateLimitExceptionFlag
      + " | DST EXCEPTION: " + statsObj.user[defaultDestinationTwitterScreenName].twitterRateLimitExceptionFlag
    ));

    if (statsObj.user[defaultSourceTwitterScreenName].twitterRateLimitExceptionFlag) { 
      checkRateLimit({threeceeUser: defaultSourceTwitterScreenName});
    }

    if (statsObj.user[defaultDestinationTwitterScreenName].twitterRateLimitExceptionFlag) { 
      checkRateLimit({threeceeUser: defaultDestinationTwitterScreenName});
    }

  }, interval);
}

initialize(configuration, function(err, cnf){

  if (err) {
    if ((err.status === 404) || (err.status === 409)) {
      console.log(chalkAlert("CONF FILE NOT FOUND ... USING DEFAUTS"));
    }
    else {
      console.error(chalkError("***** INIT ERROR *****"));
      console.log("err.status: " + err.status);
      fsm.fsm_reset();
      quit();
      return;
    }
  }
  else {
    configuration = deepcopy(cnf);
  }

  console.log(chalkTwitter(configuration.processName 
    + " STARTED " + getTimeStamp() 
  ));

  fsm.fsm_initComplete();

  initSaveFileQueue(cnf);

  if (configuration.testMode) {
    configuration.fetchCount = TEST_MODE_FETCH_COUNT;
  }

  console.log(chalkTwitter(configuration.processName + " CONFIGURATION\n" + jsonPrint(cnf)));

  connectDb(function(err, db){

    if (err) {
      dbConnectionReady = false;
      console.log(chalkError("*** MONGO DB CONNECT ERROR: " + err + " | QUITTING ***"));
      quit("MONGO DB CONNECT ERROR");
    }

    global.dbConnection = db;

    UserServerController = require("@threeceelabs/user-server-controller");
    userServerController = new UserServerController("TFE_USC");

    userServerControllerReady = false;

    userServerController.on("ready", function(appname){
      userServerControllerReady = true;
      console.log(chalkAlert("USC READY | " + appname));
    });

    User = mongoose.model("User", userModel.UserSchema);

    dbConnectionReady = true;

  });

  dbConnectionReadyInterval = setInterval(function() {

    if (dbConnectionReady) {

      clearInterval(dbConnectionReadyInterval);

      initTwitterUsers(function initTwitterUsersCallback(e){

        if (e) {
          console.error(chalkError("*** ERROR INIT TWITTER USERS: " + e));
          fsm.fsm_reset();
          return quit({source: "TCF", error: e});
        }

        console.log(chalkTwitter("SRC  TWITTER USER: @" + defaultSourceTwitterScreenName));
        console.log(chalkTwitter("DEST TWITTER USER: @" + defaultDestinationTwitterScreenName));

        initCheckRateLimitInterval(checkRateLimitIntervalTime);

        fsm.fsm_cloneStart();

        debug(chalkTwitter("\n\n*** GET TWITTER FRIENDS ***"
          + " | @" + jsonPrint(statsObj.user[defaultSourceTwitterScreenName]) + "\n\n"
        ));

      });

    }
    else {
      console.log(chalkAlert("... WAIT DB CONNECTED ..."));
    }
  }, 1000);

});
