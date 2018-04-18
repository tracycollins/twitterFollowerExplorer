 /*jslint node: true */
"use strict";
require("isomorphic-fetch");

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_FETCH_COUNT = 200;  // per request twitter user fetch count

const TEST_MODE_TOTAL_FETCH = 40;  // total twitter user fetch count
const TEST_MODE_FETCH_COUNT = 15;  // per request twitter user fetch count

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
const deepcopy = require("deep-copy");
const Twit = require("twit");
const async = require("async");
const sortOn = require("sort-on");
const Stately = require("stately.js");
const omit = require("object.omit");

let twitClient;
let twitStream;

let fsm;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let quitWaitInterval;
let quitFlag = false;

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");


let checkRateLimitInterval;
let checkRateLimitIntervalTime = 30*ONE_SECOND;
let nextUser = false;


let configuration = {};

configuration.childId = process.env.CHILD_ID;
configuration.threeceeUser = process.env.THREECEE_USER;
configuration.twitterConfig = {};
configuration.twitterConfig = process.env.TWITTER_CONFIG;
configuration.testMode = false;
configuration.fetchCount = process.env.TEST_MODE ? process.env.TEST_MODE_FETCH_COUNT :  process.env.DEFAULT_FETCH_COUNT;

let statsObj = {};

statsObj.threeceeUser = {};
statsObj.threeceeUser.twitterRateLimit

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

const jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
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

function resetTwitterUserState(){

  statsObj.threeceeUser.endFetch = true;
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
          + " | " + err.message
        ));

        callback(err);

      }
      else {

        statsObj.threeceeUser.friends = userFriendsIds.ids;

        console.log(chalkAlert("friends/ids"
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

        statsObj.threeceeUser.twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
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

        statsObj.threeceeUser.twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        console.log(chalkAlert("*** TWITTER RATE LIMIT"
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

        statsObj.threeceeUser.twitterRateLimit = data.resources.application["/application/rate_limit_status"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.application["/application/rate_limit_status"].remaining;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment(1000*data.resources.application["/application/rate_limit_status"].reset);
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

  quitFlag = true;

  fsm.fsm_reset();

  console.log( "\n" + configuration.childId + " | ... QUITTING ..." );

  if (cause) {
    console.log( "CAUSE: " + jsonPrint(cause) );
  }

  setTimeout(function(){
    process.exit();      
  }, 1000);
}

function fetchFriends(params, callback) {

  debug(chalkInfo("FETCH FRIENDS\n" + jsonPrint(params)));

  const threeceeUser = configuration.threeceeUser;

  if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

    twitClient.get("friends/list", params, function(err, data, response){

      if (err) {
        console.log(chalkError(getTimeStamp()
          + " | @" + threeceeUser
          + " | *** ERROR GET TWITTER FRIENDS: " + err
        ));

        if (err.code === 88){
          statsObj.threeceeUser.twitterRateLimitException = moment();
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);
          checkRateLimit({user: threeceeUser});
          fsmPreviousState = (fsm.getMachineState() !== "PAUSE_RATE_LIMIT") ? fsm.getMachineState() : fsmPreviousState;
          fsm.fsm_rateLimitStart();
        }
        callback(err, []);
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

          process.send({op:"FRIEND_RAW", threeceeUser: configuration.threeceeUser, childId: configuration.childId, friend: friend}, function(){
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

      statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

      console.log(chalkAlert("SKIP FETCH FRIENDS *** TWITTER RATE LIMIT"
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
      + " | NEXT USER: " + nextUser
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
  console.log(chalkAlert("--------------------------------------------------------\n"
    + "<< FSM >>"
    + " @" + configuration.threeceeUser
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
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      fsm.fsm_resetEnd();
      return this.RESET;
    },
    "fsm_resetEnd": "IDLE"
  },
  "ERROR":{
    onEnter: reporter,
    "fsm_reset": "RESET"
  },
  "INIT":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      fsm.fsm_initComplete();
      return this.INIT;
    },
    "fsm_initComplete": "READY",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_reset": "RESET"
  },
  "READY":{
    onEnter: reporter,
    "fsm_reset": "RESET",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT",
    "fsm_fetchUserStart": "FETCH_USER_START"
  },
  "FETCH_USER_START":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      fsm.fsm_fetchUser();
      return this.FETCH_USER_START;
    },
    "fsm_reset": "RESET",
    "fsm_fetchUser": "FETCH_USER",
    "fsm_fetchUserStart": "FETCH_USER_START",
    "fsm_fetchUserEnd": "READY",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT"
  },
  "FETCH_USER":{
    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      fetchFriends(configuration.threeceeUser, function(err, results){
        if (err) {
          console.log(chalkError("fetchFriends ERROR: " + err));
        }
        else {
          if (statsObj.threeceeUser.nextCursorValid && !statsObj.threeceeUser.endFetch) {
            // console.log(chalkError("fetchFriends continue... @" + configuration.threeceeUser));
            setTimeout(function(){
              fsm.fsm_fetchUserContinue();
            }, 100);
          }
        }
      });
      return this.FETCH_USER;
    },
    "fsm_reset": "RESET",
    "fsm_fetchUserContinue": "FETCH_USER",
    "fsm_fetchUserEnd": "READY",
    "fsm_rateLimitStart": "PAUSE_RATE_LIMIT"
  },
  "PAUSE_FETCH_USER":{
    onEnter: reporter,
    "fsm_reset": "RESET",
    "fsm_rateLimitEnd": "FETCH_USER",
    "fsm_fetchUserEnd": "READY"
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
    "fsm_fetchUserEnd": "READY"
  }
};

fsm = Stately.machine(fsmStates);

process.title = "node_twitterFollowerExplorerChild";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("CHILD ID:      " + configuration.childId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    clearInterval(checkRateLimitInterval);

    setTimeout(function() {
      console.log("QUITTING node_twitterFollowerExplorerChild");
      process.exit(0);
    }, 300);

  }
});


function showStats(options){

  console.log(chalkLog("--- STATS --------------------------------------\n"
    + "CUR USR: @" + configuration.threeceeUser()
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

process.on( "SIGINT", function() {
  quit({source: "SIGINT"});
});

function reset(cause, callback){

  console.log(chalkAlert("\nRESET | CAUSE: " + cause + "\n"));

  if (callback !== undefined) { callback(); } 
}

function initTwitter(twitterConfig, callback){


  twitClient = new Twit({
    consumer_key: process.env.CONSUMER_KEY,
    consumer_secret: process.env.CONSUMER_SECRET,
    access_token: process.env.TOKEN,
    access_token_secret: process.env.TOKEN_SECRET
  });

  twitStream = twitClient.stream("user", { stringify_friend_ids: true });
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
          console.log(chalkError("*** TWITTER USER UPDATE ERROR | RATE LIMIT EXCEEDED" 
            + " | " + getTimeStamp() 
            + " | @" + userScreenName 
            // + "\n" + jsonPrint(err)
          ));

          statsObj.threeceeUser.twitterRateLimitException = moment();
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);

          fsmPreviousState = (fsm.getMachineState() !== "PAUSE_RATE_LIMIT") ? fsm.getMachineState() : fsmPreviousState;
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

      callback(err);

    });
  });
}

function initialize(callback){

  fsm.fsm_reset();
  resetTwitterUserState();

  callback();
}

function initCheckRateLimitInterval(interval){

  console.log(chalkInfo("INIT CHECK RATE INTERVAL | " + interval));

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

    case "INIT":

      console.log(chalkInfo("TFC | TFE CHILD INIT"
        + " | CHILD ID: " + configuration.childId
        + " | 3C: @" + configuration.threeceeUser
      ));


      initTwitter(m.config, function initTwitterUsersCallback(e){

        initCheckRateLimitInterval(ONE_MINUTE);

        twitterUserUpdate({}, function(){
          fsm.fsm_initStart();
        });

      });

    break;

    case "FETCH_USER_START":
      fsm.fsm_fetchUserStart();
    break;

    case "QUIT":
      fsm.fsm_reset();
      quit("PARENT");
    break;

    case "RESET":
      fsm.fsm_reset();
    break;

    case "STATS":
      showStats();
      process.send({op:"STATS", childId: configuration.childId, statsObj: statsObj});
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

  console.log(chalkTwitter("INITIALIZE " + configuration.childId 
  ));
});
