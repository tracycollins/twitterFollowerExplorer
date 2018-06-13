 /*jslint node: true */
"use strict";
require("isomorphic-fetch");

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

let checkRateLimitInterval;
let checkRateLimitIntervalTime = ONE_MINUTE;

const TEST_MODE_FETCH_COUNT = process.env.TEST_MODE_FETCH_COUNT;
const TEST_MODE_TOTAL_FETCH = process.env.TEST_MODE_TOTAL_FETCH;  // total twitter user fetch count

const chalk = require("chalk");
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const moment = require("moment");

const debug = require("debug")("tfec");
const os = require("os");
const util = require("util");
const Twit = require("twit");
const async = require("async");
const sortOn = require("sort-on");
const Stately = require("stately.js");
const omit = require("object.omit");

let twitClient;
let twitStream;

let fsm;


let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};


let configuration = {};

configuration.childId = process.env.CHILD_ID;
configuration.threeceeUser = process.env.THREECEE_USER;
configuration.twitterConfig = {};
configuration.twitterConfig = process.env.TWITTER_CONFIG;
configuration.testMode = false;
if (process.env.TEST_MODE > 0) {
  configuration.testMode = true;
}

configuration.fetchCount = configuration.testMode ? process.env.TEST_MODE_FETCH_COUNT :  process.env.DEFAULT_FETCH_COUNT;
configuration.fetchUserTimeout = process.env.DEFAULT_FETCH_USER_TIMEOUT || ONE_MINUTE;

console.log(chalkLog("CONFIGURATION\n" + jsonPrint(configuration)));

let statsObj = {};

statsObj.threeceeUser = {};
statsObj.threeceeUser.nextCursorValid = false;
statsObj.threeceeUser.nextCursor = -1;
statsObj.threeceeUser.prevCursorValid = false;
statsObj.threeceeUser.prevCursor = -1;

statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;

const TFE_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.fetchUsersComplete = false;
statsObj.runId = TFE_RUN_ID;

statsObj.elapsed = 0;

let fsmPreviousState = "IDLE";
let fsmPreviousPauseState;


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

function resetTwitterUserState(){

  statsObj.threeceeUser.endFetch = false;
  statsObj.threeceeUser.nextCursor = false;
  statsObj.threeceeUser.nextCursorValid = false;
  statsObj.threeceeUser.totalFriendsFetched = 0;
  statsObj.threeceeUser.twitterRateLimit = 0;
  statsObj.threeceeUser.twitterRateLimitExceptionFlag = false;
  statsObj.threeceeUser.twitterRateLimitRemaining = 0;
  statsObj.threeceeUser.twitterRateLimitRemainingTime = 0;
  statsObj.threeceeUser.twitterRateLimitResetAt = moment();
  statsObj.threeceeUser.friendsCount = 0;
  statsObj.threeceeUser.followersCount = 0;
  statsObj.threeceeUser.statusesCount = 0;
  statsObj.threeceeUser.friendsProcessed = 0;
  statsObj.threeceeUser.percentProcessed = 0;
  statsObj.threeceeUser.friendsProcessStart = moment();
  statsObj.threeceeUser.friendsProcessEnd = moment();
  statsObj.threeceeUser.friendsProcessElapsed = 0;
}

function checkRateLimit(params, callback){

  twitClient.get("application/rate_limit_status", function(err, data, response) {

    debug("application/rate_limit_status response: " + jsonPrint(response));
    
    if (err){
      console.log(chalkError("!!!!! TWITTER ACCOUNT ERROR"
        + " | @" + configuration.threeceeUser
        + " | " + getTimeStamp()
        + " | CODE: " + err.code
        + " | STATUS CODE: " + err.statusCode
        + " | " + err.message
      ));
      statsObj.threeceeUser.twitterErrors+= 1;

      if (callback !== undefined) { callback(err, null); }
    }
    else {

      debug(chalkLog("TWITTER RATE LIMIT STATUS"
        + " | @" + configuration.threeceeUser
        + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
        + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
        + " | RST: " + getTimeStamp(statsObj.threeceeUser.twitterRateLimitResetAt)
        + " | NOW: " + moment().format(compactDateTimeFormat)
        + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
      ));

      if (statsObj.threeceeUser.twitterRateLimitExceptionFlag 
        && statsObj.threeceeUser.twitterRateLimitResetAt.isBefore(moment())){

        statsObj.threeceeUser.twitterRateLimitExceptionFlag = false;

        statsObj.threeceeUser.twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        // statsObj.threeceeUser.twitterRateLimitResetAt = moment(1000*data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());


        console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | LIM " + statsObj.threeceeUser.twitterRateLimit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
          + " | EXP: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
        ));

        fsm.fsm_rateLimitEnd();
      }
      else if (statsObj.threeceeUser.twitterRateLimitExceptionFlag){

        statsObj.threeceeUser.twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        // statsObj.threeceeUser.twitterRateLimitResetAt = moment(1000*data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        console.log(chalkLog("--- TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | LIM " + statsObj.threeceeUser.twitterRateLimit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
          + " | EXP: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
          + " | RST: " + statsObj.threeceeUser.twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
        ));
      }
      else {

        statsObj.threeceeUser.twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        // statsObj.threeceeUser.twitterRateLimitResetAt = moment(1000*data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        debug(chalkInfo("... NO TWITTER RATE LIMIT"
          + " | LIM " + statsObj.threeceeUser.twitterRateLimit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
          + " | RST: " + statsObj.threeceeUser.twitterRateLimitResetAt.format(compactDateTimeFormat)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
        ));
      }

      if (callback !== undefined) { callback(); }
    }
  });
}

function quit(cause){

  fsm.fsm_reset();

  console.log( "\n" + configuration.childId + " | ... QUITTING ..." );

  if (cause) {
    console.log( "CAUSE: " + jsonPrint(cause) );
  }

  setTimeout(function(){
    process.exit();      
  }, 1000);
}

function twitterUserUpdate(params, callback){

  debug("TWITTER USER UPDATE | params " + jsonPrint(params));

  twitClient.get("users/show", {screen_name: configuration.threeceeUser}, function(err, userShowData, response) {
  
    if (err){
      console.log("!!!!! TWITTER SHOW USER ERROR | @" + configuration.threeceeUser + " | " + getTimeStamp() 
        + "\n" + jsonPrint(err));
      return(callback(err));
    }

    debug(chalkTwitter("TWITTER USER DATA\n" + jsonPrint(userShowData)));
    debug(chalkTwitter("TWITTER USER RESPONSE\n" + jsonPrint(response)));

    statsObj.threeceeUser.id = userShowData.id_str;
    statsObj.threeceeUser.name = (userShowData.name !== undefined) ? userShowData.name : "";
    statsObj.threeceeUser.screenName = (userShowData.screen_name !== undefined) ? userShowData.screen_name.toLowerCase() : "";
    statsObj.threeceeUser.description = userShowData.description;
    statsObj.threeceeUser.url = userShowData.url;
    statsObj.threeceeUser.statusesCount = userShowData.statuses_count;
    statsObj.threeceeUser.friendsCount = userShowData.friends_count;
    statsObj.threeceeUser.followersCount = userShowData.followers_count;
    statsObj.threeceeUser.count = configuration.fetchCount;


    process.send({op:"THREECEE_USER", threeceeUser: omit(statsObj.threeceeUser, ["friends"])});

    twitClient.get("friends/ids", {screen_name: configuration.threeceeUser}, function(err, userFriendsIds, response) {

      if (err){

        console.log(chalkError("*** TWITTER USER FRIENDS IDS ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        if (err.code === 88){
          console.log(chalkAlert("*** TWITTER USER UPDATE ERROR | RATE LIMIT EXCEEDED" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));
          statsObj.threeceeUser.twitterRateLimitException = moment();
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);
          checkRateLimit({user: configuration.threeceeUser});
          fsm.fsm_rateLimitStart();
        }

        callback(err);

      }
      else {

        process.send({op:"FRIENDS_IDS", threeceeUser: configuration.threeceeUser, friendsIds: userFriendsIds.ids});

        // statsObj.threeceeUser.friends = userFriendsIds.ids;
        statsObj.threeceeUser.nextCursorValid = statsObj.threeceeUser.nextCursorValid || false;
        statsObj.threeceeUser.nextCursor = statsObj.threeceeUser.nextCursor || -1;
        statsObj.threeceeUser.prevCursorValid = statsObj.threeceeUser.prevCursorValid || false;
        statsObj.threeceeUser.prevCursor = statsObj.threeceeUser.prevCursor || -1;

        console.log(chalkLog("friends/ids"
          + " | @" + configuration.threeceeUser 
          + " | IDs: " + userFriendsIds.ids.length
          + " | PREV CURSOR: " + userFriendsIds.previous_cursor_str
          + " | NEXT CURSOR: " + userFriendsIds.next_cursor_str
        ));

        console.log(chalkTwitterBold("====================================================================="
          + "\nTWITTER USER"
          + " | @" + statsObj.threeceeUser.screenName 
          + " | " + statsObj.threeceeUser.name 
          + "\nNEXT CURSOR VALID: " + statsObj.threeceeUser.nextCursorValid 
          + " | NEXT CURSOR: " + statsObj.threeceeUser.nextCursor 
          + "\nTs: " + statsObj.threeceeUser.statusesCount 
          + " | FLWRs: " + statsObj.threeceeUser.followersCount
          + " | FRNDS: " + statsObj.threeceeUser.friendsCount 
          + " | FRNDS IDs: " + userFriendsIds.ids.length 
          + "\n====================================================================="
        ));

        callback(null);
      }


    });
  });
}

function fetchFriends(params, callback) {

  if (configuration.testMode) { console.log(chalkInfo("FETCH FRIENDS params\n" + jsonPrint(params))); }

  const threeceeUser = configuration.threeceeUser;

  if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

    twitClient.get("friends/list", params, function(err, data, response){

      if (err) {
        if (err.code === 88){
          console.log(chalkAlert("*** TWITTER USER UPDATE ERROR | RATE LIMIT EXCEEDED" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));
          statsObj.threeceeUser.twitterRateLimitException = moment();
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);
          checkRateLimit({user: threeceeUser});

          fsm.fsm_rateLimitStart();

          callback(err, []);
        }
        else {

          console.log(chalkError(getTimeStamp()
            + " | @" + threeceeUser
            + " | *** ERROR GET TWITTER FRIENDS: " + err
            + " | ERR CODE: " + err.code
            + " | RESPONSE: " + jsonPrint(response)
          ));

          fsm.fsm_error();

          callback(err, null);
        }
      }
      else {

        statsObj.threeceeUser.totalFriendsFetched += data.users.length;
        statsObj.threeceeUser.totalPercentFetched = 100*(statsObj.threeceeUser.totalFriendsFetched/statsObj.threeceeUser.friendsCount); 
        statsObj.threeceeUser.nextCursor = data.next_cursor_str;
        statsObj.threeceeUser.percentFetched = 100*(statsObj.threeceeUser.totalFriendsFetched/statsObj.threeceeUser.friendsCount); 

        if (configuration.testMode 
          && (statsObj.threeceeUser.totalFriendsFetched >= TEST_MODE_TOTAL_FETCH)) {

          statsObj.threeceeUser.nextCursorValid = false;
          statsObj.threeceeUser.endFetch = true;

          console.log(chalkAlert("\n=====================================\n"
            + "*** TEST MODE END FETCH ***"
            + "\n@" + configuration.threeceeUser
            + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
            + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
            + "\nTOTAL FRIENDS FETCHED: " + statsObj.threeceeUser.totalFriendsFetched
            + "\n=====================================\n"
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

        console.log(chalkTwitter("===========================================================\n"
          + "---- END FETCH ----"
          + " | " + getTimeStamp()
          + " | @" + statsObj.threeceeUser.screenName
          + "\nFRIENDS:      " + statsObj.threeceeUser.friendsCount
          + "\nTOT FETCHED:  " + statsObj.threeceeUser.totalFriendsFetched
          + " (" + statsObj.threeceeUser.percentFetched.toFixed(1) + "%)"
          + "\nCOUNT:        " + configuration.fetchCount
          + "\nFETCHED:      " + data.users.length
          + "\nEND FETCH:    " + statsObj.threeceeUser.endFetch
          + "\nMORE:         " + statsObj.threeceeUser.nextCursorValid
          + "\n==========================================================="
        ));

        const subFriendsSortedArray = sortOn(data.users, "-followers_count");

        async.eachSeries(subFriendsSortedArray, function (friend, cb){

          friend.following = true;
          friend.threeceeFollowing = threeceeUser;

          process.send({op:"FRIEND_RAW", follow:false, threeceeUser: configuration.threeceeUser, childId: configuration.childId, friend: friend}, function(){
            cb();
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

    if (statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

      fsm.fsm_rateLimitStart();

      statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

      console.log(chalkAlert("SKIP FETCH FRIENDS --- TWITTER RATE LIMIT"
        + " | LIM " + statsObj.threeceeUser.twitterRateLimit
        + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
        + " | EXP @: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
        + " | RST @: " + statsObj.threeceeUser.twitterRateLimitResetAt.format(compactDateTimeFormat)
        + " | NOW: " + moment().format(compactDateTimeFormat)
        + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
      ));
    }

    console.log(chalkLog("fetchFriends"
      + " | CURRENT: @" + threeceeUser 
      + " | RATE LIMIT: " + statsObj.threeceeUser.twitterRateLimitExceptionFlag
    ));

    callback(null, []);
  }
}

function getPreviousPauseState() {
  return fsmPreviousPauseState;
}

function reporter(event, oldState, newState) {
  if (newState === "PAUSE_RATE_LIMIT") {
    fsmPreviousPauseState = oldState;
  }
  fsmPreviousState = oldState;
  console.log(chalkLog("--------------------------------------------------------\n"
    + "<< FSM >>"
    + " @" + configuration.threeceeUser
    + " | " + event
    + " | " + fsmPreviousState
    + " -> " + newState
    + "\n--------------------------------------------------------"
  ));
}

const fsmStates = {
  "RESET":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      resetTwitterUserState();
      process.send({op:"RESET", threeceeUser: configuration.threeceeUser});
      return this.RESET;
    },
    "fsm_reset": "RESET",
    "fsm_init": "INIT",
    "fsm_error": "ERROR"
  },
  "INIT":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"INIT", threeceeUser: configuration.threeceeUser});
      return this.INIT;
    },
    "fsm_ready": "READY",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR"
  },
  "IDLE":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"IDLE", threeceeUser: configuration.threeceeUser});
      return this.IDLE;
    },
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR"
  },
  "READY":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"READY", threeceeUser: configuration.threeceeUser});
      return this.READY;
    },
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR",
    "fsm_fetchUserStart": "FETCH_USER_START"
  },
  "FETCH_USER_START":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      fsm.fsm_fetchUser();
      process.send({op:"FETCH", threeceeUser: configuration.threeceeUser});
      return this.FETCH_USER_START;
    },
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR",
    "fsm_fetchUser": "FETCH_USER",
    "fsm_fetchUserStart": "FETCH_USER_START",
    "fsm_fetchUserEnd": "FETCH_END"
  },
  "FETCH_USER":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"FETCH", threeceeUser: configuration.threeceeUser});
      let params = {};
      params.count = statsObj.threeceeUser.count;
      params.screen_name = configuration.threeceeUser;
      params.cursor = (statsObj.threeceeUser.nextCursorValid) ? statsObj.threeceeUser.nextCursor : -1;

      fetchFriends(params, function(err, results){
        if (err) {
          console.log(chalkError("fetchFriends ERROR: " + err));

        }
        else {
          if (statsObj.threeceeUser.nextCursorValid && !statsObj.threeceeUser.endFetch) {
            setTimeout(function(){
              fsm.fsm_fetchUserContinue();
            }, configuration.fetchUserTimeout);
          }
          if (!statsObj.threeceeUser.nextCursorValid && statsObj.threeceeUser.endFetch) {
            fsm.fsm_fetchUserEnd();
          }
        }
      });
      return this.FETCH_USER;
    },
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_fetchUserContinue": "FETCH_USER",
    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_rateLimitStart": function(){
      fsmPreviousState = "FETCH_USER";
      return this.PAUSE_RATE_LIMIT;
    }
  },
  "FETCH_END":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"FETCH_END", threeceeUser: configuration.threeceeUser});
      console.log("FETCH_END | PREV STATE: " + oldState);
    },
    // "fsm_rateLimitEnd": "INIT",
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  },
  "PAUSE_FETCH_USER":{
    onEnter: reporter,
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_fetchUserEnd": "FETCH_END"
  },
  "PAUSE_RATE_LIMIT":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"PAUSE_RATE_LIMIT", threeceeUser: configuration.threeceeUser});
      console.log("PAUSE_RATE_LIMIT | PREV STATE: " + oldState);
    },
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_rateLimitEnd": function(){
      return getPreviousPauseState();
    },
    "fsm_fetchUserEnd": "FETCH_END"
  },
  "ERROR":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"ERROR", threeceeUser: configuration.threeceeUser});
      return this.ERROR;
    },
    "fsm_init": "INIT",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"
  }
};

fsm = Stately.machine(fsmStates);
resetTwitterUserState();

process.title = "node_twitterFollowerExplorerChild";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("CHILD ID:      " + configuration.childId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
  console.log(chalkAlert("TFC | " + configuration.threeceeUser + " | *** EXIT ***"));
  quit({source: "EXIT"});
});

function showStats(options){

  console.log(chalkLog("--- STATS --------------------------------------\n"
    + "CUR USR: @" + configuration.threeceeUser
    + "\nSTART:   " + statsObj.startTimeMoment.format(compactDateTimeFormat)
    + "\nELAPSED: " + statsObj.elapsed
    + "\nFSM:     " + fsm.getMachineState()
    + "\nU PRCSD: " + statsObj.threeceeUser.friendsProcessed + " / " + statsObj.threeceeUser.friendsCount
    + " (" + statsObj.threeceeUser.percentProcessed.toFixed(2) + "%)"
    + "\nT FTCHD: " + statsObj.threeceeUser.totalFriendsFetched + " / " + statsObj.threeceeUser.totalTwitterFriends
    + " (" + statsObj.threeceeUser.totalPercentFetched.toFixed(2) + "%)"
    + "\n------------------------------------------------\n"
  ));
}

process.on( "SIGHUP", function() {
  console.log(chalkAlert("TFC | " + configuration.threeceeUser + " | *** SIGHUP ***"));
  quit({source: "SIGHUP"});
});

process.on( "SIGINT", function() {
  console.log(chalkAlert("TFC | " + configuration.threeceeUser + " | *** SIGINT ***"));
  quit({source: "SIGINT"});
});

process.on("disconnect", function() {
  console.log(chalkAlert("TFC | " + configuration.threeceeUser + " | *** DISCONNECT ***"));
  quit("DISCONNECT");
});


function initTwitter(twitterConfig, callback){

  if (!twitClient || (twitClient === undefined)){

    twitClient = new Twit(twitterConfig);

    twitStream = twitClient.stream("user", { stringify_friend_ids: true });

    twitStream.on("follow", function(followMessage){

      console.log(chalkInfo("TFC | +++ USER @" + configuration.threeceeUser + " FOLLOW"
        + " | " +  followMessage.target.id_str
        + " | @" +  followMessage.target.screen_name.toLowerCase()
      ));

      followMessage.target.following = true;
      followMessage.target.threeceeFollowing = configuration.threeceeUser;

      const friendRawObj = {
        op:"FRIEND_RAW", 
        follow:true, 
        threeceeUser: configuration.threeceeUser,
        childId: configuration.childId, 
        friend: followMessage.target
      };

      process.send(friendRawObj, function(){});

    });

  }
  else {

    console.log(chalkLog("TFC | TWITTER ALREADY INITIALIZED" 
      + " | " + getTimeStamp() 
      + " | @" + configuration.threeceeUser 
      + "\ntwitterConfig\n" + jsonPrint(twitterConfig)
    ));

  }

  twitClient.get("account/settings", function(err, accountSettings, response) {
    if (err){

      err.user = configuration.threeceeUser;

      console.log(chalkError("!!!!! TWITTER ACCOUNT ERROR"
        + " | @" + configuration.threeceeUser
        + " | " + getTimeStamp()
        + " | CODE: " + err.code
        + " | STATUS CODE: " + err.statusCode
        + " | " + err.message
        // + "\n" + jsonPrint(err)
      ));
      statsObj.threeceeUser.twitterErrors+= 1;
      return(callback(err, null));
    }

    debug(chalkTwitter("TWITTER ACCOUNT SETTINGS RESPONSE\n" + jsonPrint(response)));

    const userScreenName = accountSettings.screen_name.toLowerCase();

    debug(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: @" + userScreenName));

    debug(chalkTwitter("TWITTER ACCOUNT SETTINGS\n" + jsonPrint(accountSettings)));

    twitterUserUpdate({userScreenName: userScreenName}, function(err){
      if (err){

        err.user = userScreenName;

        if (err.code === 88) {
          console.log(chalkAlert("*** TWITTER USER UPDATE ERROR | RATE LIMIT EXCEEDED" 
            + " | " + getTimeStamp() 
            + " | @" + userScreenName 
          ));

          statsObj.threeceeUser.twitterRateLimitException = moment();
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);
          fsm.fsm_rateLimitStart();
        }
        else {
          console.log(chalkError("*** TWITTER USER UPDATE ERROR" 
            + " | " + getTimeStamp() 
            + " | @" + userScreenName 
            + "\n" + jsonPrint(err)
          ));
        }
        return(callback(err, null));
      }

      callback(null, null);

    });
  });
}

function initialize(callback){
  fsm.fsm_reset();
  callback();
}

function initCheckRateLimitInterval(interval){

  clearInterval(checkRateLimitInterval);

  debug(chalkInfo("TFC"
    + " | CH @" + configuration.threeceeUser
    + " | INIT CHECK RATE INTERVAL | " + interval
  ));

  checkRateLimitInterval = setInterval(function(){

    debug(chalkInfo("CHECK RATE INTERVAL"
      + " | INTERVAL: " + msToTime(interval)
      + " | CURRENT USER: @" + configuration.threeceeUser
      + " | EXCEPTION: " + statsObj.threeceeUser.twitterRateLimitExceptionFlag
    ));

    if (statsObj.threeceeUser.twitterRateLimitExceptionFlag) {
      checkRateLimit(function(){});
    }

  }, interval);
}

process.on("message", function(m) {

  debug(chalkAlert("TFE CHILD RX MESSAGE"
    + " | OP: " + m.op
  ));

  switch (m.op) {

    case "shutdown":
    case "SIGINT":
      clearInterval(checkRateLimitInterval);
      setTimeout(function() {
        console.log("QUITTING TFC CHILD | @" + configuration.threeceeUser);
        process.exit(0);
      }, 500);
    break;

    case "INIT":

      console.log(chalkInfo("TFC | TFE CHILD INIT"
        + " | CHILD ID: " + m.childId
        + " | 3C: @" + m.threeceeUser
        + " | TWITTER CONFIG\n" + jsonPrint(m.twitterConfig)
      ));

      configuration.childId = m.childId;
      configuration.threeceeUser = m.threeceeUser;
      configuration.twitterConfig = {};
      configuration.twitterConfig = m.twitterConfig;

      initTwitter(m.twitterConfig, function initTwitterUsersCallback(e){

        initCheckRateLimitInterval(checkRateLimitIntervalTime);

        twitterUserUpdate({}, function(){
          fsm.fsm_init();
        });

      });
    break;

    case "READY":
      fsm.fsm_ready();
    break;

    case "FETCH_USER_START":
      fsm.fsm_fetchUserStart();
    break;

    case "FOLLOW":

      twitClient.post(

        "friendships/create", {screen_name: m.user.screenName}, 

        function createFriend(err, data, response){
          if (err) {
            console.log(chalkError("TFC | FOLLOW ERROR"
              + " | @" + configuration.threeceeUser
              + " | " + err
            ));
          }
          else {
            debug("data\n" + jsonPrint(data));
            debug("response\n" + jsonPrint(response));

            console.log(chalkInfo("TFC | +++ FOLLOW"
              + " | 3C: @" + configuration.threeceeUser
              + " | NID: " + m.user.userId
              + " | @" + m.user.screenName.toLowerCase()
            ));
          }
        }
      );
    break;

    case "UNFOLLOW":

      twitClient.post(

        "friendships/destroy", {user_id: m.userId}, 

        function destroyFriend(err, data, response){
          if (err) {
            console.log(chalkError("UNFOLLOW ERROR"
              + " | @" + configuration.threeceeUser
              + " | " + err
            ));
          }
          else {
            debug("data\n" + jsonPrint(data));
            debug("response\n" + jsonPrint(response));

            console.log(chalkInfo("=X= UNFOLLOW"
              + " | 3C: @" + configuration.threeceeUser
              + " | NID: " + m.userId
              + " | @" + m.screenName.toLowerCase()
            ));
          }
        }
      );
    break;

    case "QUIT":
      fsm.fsm_reset();
      quit("PARENT");
    break;

    case "RESET":
      fsm.fsm_reset();
    break;

    case "RESET_TWITTER_USER_STATE":
      console.log("TFC @" + configuration.threeceeUser + " | RESET_TWITTER_USER_STATE" );
      resetTwitterUserState();
    break;    

    case "STATS":
      showStats();
      process.send({op:"STATS", threeceeUser: configuration.threeceeUser, statsObj: statsObj});
    break;

    default:
      console.log(chalkError("TFC | UNKNOWN OP ERROR"
        + " | " + m.op
      ));
  }
});

initialize(function(err){

  if (err) {
    console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404){
      console.log("err.status: " + err.status);
      quit();
    }
  }

  console.log(chalkTwitter(configuration.childId 
    + " STARTED " + getTimeStamp() 
  ));

  if (configuration.testMode) {
    configuration.fetchCount = TEST_MODE_FETCH_COUNT;
  }

  console.log(chalkTwitter("INITIALIZE " + configuration.childId ));
});
