 /*jslint node: true */
"use strict";
require("isomorphic-fetch");

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

let checkRateLimitInterval;
let checkRateLimitIntervalTime = ONE_MINUTE;

let unfollowQueueInterval;
let unfollowQueueReady = false;
let unfollowQueueIntervalTime = process.env.DEFAULT_UNFOLLOW_QUEUE_INTERVAL || 5*ONE_SECOND;
let unfollowQueue = [];

const TEST_MODE_FETCH_COUNT = process.env.TEST_MODE_FETCH_COUNT;
const TEST_MODE_TOTAL_FETCH = process.env.TEST_MODE_TOTAL_FETCH;  // total twitter user fetch count

const DEFAULT_MIN_FOLLOWERS_COUNT = process.env.DEFAULT_MIN_FOLLOWERS_COUNT || 100;
const DEFAULT_MIN_FRIENDS_COUNT = process.env.DEFAULT_MIN_FRIENDS_COUNT || 10;
const DEFAULT_MIN_STATUSES_COUNT = process.env.DEFAULT_MIN_STATUSES_COUNT || 10;

const moment = require("moment");
const pick = require("object.pick");
const _ = require("lodash");
const debug = require("debug")("tfec");
const os = require("os");
const util = require("util");
const Twit = require("twit");
const async = require("async");
const sortOn = require("sort-on");
const Stately = require("stately.js");
const omit = require("object.omit");
const treeify = require("treeify");
const chalk = require("chalk");

const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkStats = chalk.blue;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

let twitClient;
let twitStream;

let fsm;

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};


let configuration = {};
configuration.verbose = false;
configuration.childId = process.env.CHILD_ID;
configuration.threeceeUser = process.env.THREECEE_USER;
configuration.twitterConfig = {};
configuration.twitterConfig = process.env.TWITTER_CONFIG;

configuration.minFollowersCount = DEFAULT_MIN_FOLLOWERS_COUNT;
configuration.minFriendsCount = DEFAULT_MIN_FRIENDS_COUNT;
configuration.minStatusesCount = DEFAULT_MIN_STATUSES_COUNT;


configuration.testMode = false;
if (process.env.TEST_MODE > 0) {
  configuration.testMode = true;
}

configuration.fetchCount = configuration.testMode ? process.env.TEST_MODE_FETCH_COUNT :  process.env.DEFAULT_FETCH_COUNT;
configuration.fetchUserTimeout = process.env.DEFAULT_FETCH_USER_TIMEOUT || ONE_MINUTE;

console.log(chalkLog("CONFIGURATION\n" + jsonPrint(configuration)));

let threeceeUserDefaults = {};

threeceeUserDefaults.id = 0;
threeceeUserDefaults.name = "---";
threeceeUserDefaults.screenName = configuration.threeceeUser;
threeceeUserDefaults.description = "---";
threeceeUserDefaults.url = "---";
threeceeUserDefaults.friendsCount = 0;
threeceeUserDefaults.followersCount = 0;
threeceeUserDefaults.statusesCount = 0;

threeceeUserDefaults.error = false;

threeceeUserDefaults.count = configuration.fetchCount;
threeceeUserDefaults.endFetch = false;
threeceeUserDefaults.nextCursor = false;
threeceeUserDefaults.nextCursorValid = false;
threeceeUserDefaults.friendsFetched = 0;
threeceeUserDefaults.percentFetched = 0;

threeceeUserDefaults.twitterRateLimit = 0;
threeceeUserDefaults.twitterRateLimitExceptionFlag = false;
threeceeUserDefaults.twitterRateLimitRemaining = 0;
threeceeUserDefaults.twitterRateLimitRemainingTime = 0;
threeceeUserDefaults.twitterRateLimitResetAt = moment();

let statsObj = {};

statsObj.fsmState = "IDLE";
statsObj.fsmPreviousState = "IDLE";
statsObj.fsmPreviousPauseState = "IDLE";

statsObj.threeceeUser = {};
statsObj.threeceeUser.nextCursorValid = false;
statsObj.threeceeUser.nextCursor = -1;
statsObj.threeceeUser.prevCursorValid = false;
statsObj.threeceeUser.prevCursor = -1;
statsObj.threeceeUser.percentFetched = 0;

statsObj.threeceeUser.twitterRateLimit = 0;
statsObj.threeceeUser.twitterRateLimitException = moment();
statsObj.threeceeUser.twitterRateLimitExceptionFlag = false;
statsObj.threeceeUser.twitterRateLimitRemaining = 0;
statsObj.threeceeUser.twitterRateLimitRemainingTime = 0;
statsObj.threeceeUser.twitterRateLimitResetAt = moment();

statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;

const TFE_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.fetchUsersComplete = false;
statsObj.runId = TFE_RUN_ID;

statsObj.elapsed = 0;

statsObj.users = {};
statsObj.users.unfollowed = [];


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
  statsObj.threeceeUser.friendsFetched = 0;
  statsObj.threeceeUser.twitterRateLimit = 0;
  statsObj.threeceeUser.twitterRateLimitException = moment();
  statsObj.threeceeUser.twitterRateLimitExceptionFlag = false;
  statsObj.threeceeUser.twitterRateLimitRemaining = 0;
  statsObj.threeceeUser.twitterRateLimitRemainingTime = 0;
  statsObj.threeceeUser.twitterRateLimitResetAt = moment();
  statsObj.threeceeUser.friendsCount = 0;
  statsObj.threeceeUser.followersCount = 0;
  statsObj.threeceeUser.statusesCount = 0;
}

function checkRateLimit(callback){

  twitClient.get("application/rate_limit_status", function(err, data, response) {
    
    if (err){


      statsObj.threeceeUser.twitterErrors+= 1;

      if (err.code === 89){

        console.log(chalkAlert("*** TWITTER GET RATE LIMIT STATUS ERROR | INVALID OR EXPIRED TOKEN" 
          + " | " + getTimeStamp() 
          + " | @" + configuration.threeceeUser 
        ));

        statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

        statsObj.threeceeUser.err = err;

        fsm.fsm_error();

        process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});

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

      if (callback !== undefined) { callback(err, null); }
    }
    else {

      if (configuration.verbose) {

        console.log(chalkLog("TWITTER RATE LIMIT STATUS"
          + " | @" + configuration.threeceeUser
          + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
          + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
          + " | RST: " + getTimeStamp(statsObj.threeceeUser.twitterRateLimitResetAt)
          + " | NOW: " + moment().format(compactDateTimeFormat)
          + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
        ));

      }

      if (data.resources.users["/users/show/:id"].remaining > 0){

        statsObj.threeceeUser.twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        if (statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

          statsObj.threeceeUser.twitterRateLimitExceptionFlag = false;

          console.log(chalkAlert("XXX RESET TWITTER RATE LIMIT"
            + " | @" + configuration.threeceeUser
            + " | CONTEXT: " + data.rate_limit_context.access_token
            + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
            + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
            + " | EXP: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
            + " | NOW: " + moment().format(compactDateTimeFormat)
          ));

        }

        if (statsObj.fsmState === "PAUSE_RATE_LIMIT"){
          fsm.fsm_rateLimitEnd();
        }

      }
      else if (data.resources.users["/users/show/:id"].remaining === 0){

        if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag) {
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
        }

        if (!statsObj.threeceeUser.twitterRateLimitException) {
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
        }

        statsObj.threeceeUser.twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        if (statsObj.fsmState !== "PAUSE_RATE_LIMIT"){
          console.log(chalkAlert("*** TWITTER SHOW USER ERROR | RATE LIMIT EXCEEDED" 
            + " | @" + configuration.threeceeUser
            + " | CONTEXT: " + data.rate_limit_context.access_token
            + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
            + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
            + " | EXP: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
            + " | NOW: " + moment().format(compactDateTimeFormat)
          ));
          fsm.fsm_rateLimitStart();
        }
        else {
          console.log(chalkLog("--- TWITTER RATE LIMIT"
            + " | @" + configuration.threeceeUser
            + " | CONTEXT: " + data.rate_limit_context.access_token
            + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
            + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
            + " | EXP: " + statsObj.threeceeUser.twitterRateLimitException.format(compactDateTimeFormat)
            + " | RST: " + statsObj.threeceeUser.twitterRateLimitResetAt.format(compactDateTimeFormat)
            + " | NOW: " + moment().format(compactDateTimeFormat)
            + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
          ));
        }
      }
      else if (statsObj.threeceeUser.twitterRateLimitExceptionFlag){

        statsObj.threeceeUser.twitterRateLimit = data.resources.users["/users/show/:id"].limit;
        statsObj.threeceeUser.twitterRateLimitRemaining = data.resources.users["/users/show/:id"].remaining;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        console.log(chalkLog("--- TWITTER RATE LIMIT"
          + " | @" + configuration.threeceeUser
          + " | CONTEXT: " + data.rate_limit_context.access_token
          + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
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
        statsObj.threeceeUser.twitterRateLimitResetAt = moment.unix(data.resources.users["/users/show/:id"].reset);
        statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

        if (configuration.verbose) {
          console.log(chalkInfo("... NO TWITTER RATE LIMIT"
            + " | @" + configuration.threeceeUser
            + " | LIM: " + statsObj.threeceeUser.twitterRateLimit
            + " | REM: " + statsObj.threeceeUser.twitterRateLimitRemaining
            + " | RST: " + getTimeStamp(statsObj.threeceeUser.twitterRateLimitResetAt)
            + " | NOW: " + moment().format(compactDateTimeFormat)
            + " | IN " + msToTime(statsObj.threeceeUser.twitterRateLimitRemainingTime)
          ));
        }
      }

      if (callback !== undefined) { callback(); }
    }
  });
}

function quit(c){

  const cause = c || "NONE";

  fsm.fsm_reset();

  console.log(chalkAlert("TFC | QUIT"
    + " | " + configuration.childId
    + " | CAUSE: " + cause
  ));

  setTimeout(function(){
    process.exit();      
  }, 1000);
}

function twitterUsersShow(callback){

  twitClient.get("users/show", {screen_name: configuration.threeceeUser}, function(err, userShowData, response) {

    // console.log("users/show\n", response);

    if (err){

      console.log(chalkError("*** TWITTER SHOW USER ERROR"
        + " | @" + configuration.threeceeUser 
        + " | " + getTimeStamp() 
        + " | ERR CODE: " + err.code
        + " | " + err.message
      ));

      if (err.code === 88){

        console.log(chalkAlert("*** TWITTER SHOW USER ERROR | RATE LIMIT EXCEEDED" 
          + " | " + getTimeStamp() 
          + " | @" + configuration.threeceeUser 
        ));


        statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

        statsObj.threeceeUser.twitterRateLimitException = moment();
        statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);

        fsm.fsm_rateLimitStart();

        process.send({op:"THREECEE_USER", threeceeUser: omit(statsObj.threeceeUser, ["friends"])});

      }
      if (err.code === 89){

        console.log(chalkAlert("*** TWITTER SHOW USER ERROR | INVALID OR EXPIRED TOKEN" 
          + " | " + getTimeStamp() 
          + " | @" + configuration.threeceeUser 
        ));


        statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

        statsObj.threeceeUser.err = err;

        fsm.fsm_error();

        process.send({op:"ERROR", type: "INVALID_TOKEN", threeceeUser: configuration.threeceeUser, error: err});

      }

      return callback(err);

    }

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

    callback();

  });
}

function twitterUserUpdate(params, callback){

  twitterUsersShow(function(err){

    if (err){

      console.log(chalkError("*** TWITTER SHOW USER ERROR"
        + " | @" + configuration.threeceeUser 
        + " | " + getTimeStamp() 
        + " | ERR CODE: " + err.code
        + " | " + err.message
      ));

      return callback(err);

    }

    twitClient.get("friends/ids", {screen_name: configuration.threeceeUser}, function(err, userFriendsIds, response) {

      if (err){

        console.log(chalkError("*** TWITTER USER FRIENDS IDS ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        return callback(err);

      }

      process.send({op:"FRIENDS_IDS", threeceeUser: configuration.threeceeUser, friendsIds: userFriendsIds.ids});

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

    });

  });

}

let friendMinProps = {
  followers_count: configuration.minFollowersCount,
  friends_count: configuration.minFriendsCount,
  statuses_count: configuration.minStatusesCount
};

function checkFriendMinimumProperties(friend, callback){

  const unfollowFlag = (
    (friend.followers_count < configuration.minFollowersCount)
    || (friend.statuses_count < configuration.minStatusesCount)
  );

  debug(chalkAlert("checkFriendMinimumProperties"
    + " | UNFOLLOW: " + unfollowFlag
    + " | @" + friend.screen_name
    + " | FLWRs: " + friend.followers_count
    + " | MIN FLWRs: " + configuration.minFollowersCount
    // + " | FRNDs: " + friend.friends_count
    // + " | MIN FRNDs: " + configuration.minFriendsCount
    + " | Ts: " + friend.statuses_count
    + " | MIN Ts: " + configuration.minStatusesCount
  ));

  callback(null, unfollowFlag);
}

function fetchFriends(params, callback) {

  if (configuration.testMode) { console.log(chalkInfo("FETCH FRIENDS params\n" + jsonPrint(params))); }

  const threeceeUser = configuration.threeceeUser;

  if (!statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

    twitClient.get("friends/list", params, function(err, data, response){

      if (err){

        console.log(chalkError("*** TWITTER FRIENDS LIST ERROR"
          + " | @" + configuration.threeceeUser 
          + " | " + getTimeStamp() 
          + " | ERR CODE: " + err.code
          + " | " + err.message
        ));

        if (err.code === 88){

          console.log(chalkAlert("*** TWITTER FRIENDS LIST ERROR | RATE LIMIT EXCEEDED" 
            + " | " + getTimeStamp() 
            + " | @" + configuration.threeceeUser 
          ));


          statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

          statsObj.threeceeUser.twitterRateLimitException = moment();
          statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
          statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);

          fsm.fsm_rateLimitStart();

          process.send({op:"THREECEE_USER", threeceeUser: omit(statsObj.threeceeUser, ["friends"])});

          return callback(err, []);

        }

        fsm.fsm_error();

        return callback(err, null);
      }

      statsObj.threeceeUser.friendsFetched += data.users.length;
      statsObj.threeceeUser.nextCursor = data.next_cursor_str;
      statsObj.threeceeUser.percentFetched = 100*(statsObj.threeceeUser.friendsFetched/statsObj.threeceeUser.friendsCount); 

      if (configuration.testMode 
        && (statsObj.threeceeUser.friendsFetched >= TEST_MODE_TOTAL_FETCH)) {

        statsObj.threeceeUser.nextCursorValid = false;
        statsObj.threeceeUser.endFetch = true;

        console.log(chalkAlert("\n=====================================\n"
          + "*** TEST MODE END FETCH ***"
          + "\n@" + configuration.threeceeUser
          + "\nTEST_MODE_FETCH_COUNT: " + TEST_MODE_FETCH_COUNT
          + "\nTEST_MODE_TOTAL_FETCH: " + TEST_MODE_TOTAL_FETCH
          + "\nFRIENDS FETCHED: " + statsObj.threeceeUser.friendsFetched
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
        + "\nFRIENDS:       " + statsObj.threeceeUser.friendsCount
        + "\nFRNDs FETCHED: " + statsObj.threeceeUser.friendsFetched
        + " (" + statsObj.threeceeUser.percentFetched.toFixed(1) + "%)"
        + "\nCOUNT:         " + configuration.fetchCount
        + "\nFETCHED:       " + data.users.length
        + "\nEND FETCH:     " + statsObj.threeceeUser.endFetch
        + "\nMORE:          " + statsObj.threeceeUser.nextCursorValid
        + "\n==========================================================="
      ));

      const subFriendsSortedArray = sortOn(data.users, "-followers_count");

      async.eachSeries(subFriendsSortedArray, function (friend, cb){

        checkFriendMinimumProperties(friend, function(err, unfollowFlag){

          if (err) {
            console.log(chalkError("TFC CHECK FRIEND ERROR | " + err));
            return cb();
          }

          if (unfollowFlag) {

            unfollowQueue.push(friend);

            console.log(chalkError("TFC CHECK FRIEND | XXX UNFOLLOW"
              + " [ UFQ: " + unfollowQueue.length + "]"
              + " | UNFOLLOW: " + unfollowFlag
              + " | ID: " + friend.id_str
              + " | @" + friend.screen_name
              + " | FLWRs: " + friend.followers_count
              + " | FRNDs: " + friend.friends_count
              + " | Ts: " + friend.statuses_count
            ));

            return cb();
          }

          friend.following = true;
          friend.threeceeFollowing = threeceeUser;

          debug(chalkError("TFC CHECK FRIEND | --- UNFOLLOW"
            + " [ UFQ: " + unfollowQueue.length + "]"
            + " | UNFOLLOW: " + unfollowFlag
            + " | ID: " + friend.id_str
            + " | @" + friend.screen_name
            + " | FLWRs: " + friend.followers_count
            + " | FRNDs: " + friend.friends_count
            + " | Ts: " + friend.statuses_count
          ));

          process.send(
            {
              op: "FRIEND_RAW", 
              follow: false, 
              threeceeUser: configuration.threeceeUser, 
              childId: configuration.childId, 
              friend: friend
            }, 

            function(){ cb(); }
          );

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

    });
  }
  else {

    if (statsObj.threeceeUser.twitterRateLimitExceptionFlag) {

      statsObj.threeceeUser.twitterRateLimitRemainingTime = statsObj.threeceeUser.twitterRateLimitResetAt.diff(moment());

      console.log(chalkAlert("SKIP FETCH FRIENDS --- TWITTER RATE LIMIT"
        + " | @" + threeceeUser
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
  return statsObj.fsmPreviousPauseState;
}

function reporter(event, oldState, newState) {

  statsObj.fsmState = newState;
  statsObj.fsmStateTimeStamp = getTimeStamp();
  statsObj.fsmPreviousState = oldState;

  // fsmPreviousState = oldState;

  console.log(chalkStats("--------------------------------------------------------\n"
    + "<< FSM >>"
    + " | @" + configuration.threeceeUser
    + " | " + statsObj.fsmStateTimeStamp
    + " | " + event
    + " | " + statsObj.fsmPreviousState + " -> " + newState
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

    "fsm_rateLimitStart": function(){
      statsObj.fsmPreviousPauseState = "RESET";
      return this.PAUSE_RATE_LIMIT;
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_disable": "DISABLE",
    "fsm_reset": "RESET",
    "fsm_init": "INIT",
    "fsm_ready": "INIT",
    "fsm_error": "ERROR"

  },

  "INIT":{

    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"INIT", threeceeUser: configuration.threeceeUser});
      return this.INIT;
    },

    "fsm_rateLimitStart": function(){
      statsObj.fsmPreviousPauseState = "INIT";
      return this.PAUSE_RATE_LIMIT;
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_ready": "READY",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLE",
    "fsm_error": "ERROR"

  },

  "IDLE":{

    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"IDLE", threeceeUser: configuration.threeceeUser});
      return this.IDLE;
    },

    "fsm_rateLimitStart": function(){
      statsObj.fsmPreviousPauseState = "IDLE";
      return this.PAUSE_RATE_LIMIT;
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLE",
    "fsm_error": "ERROR"
  },

  "READY":{

    onEnter: function(event, oldState, newState){

      if (statsObj.threeceeUser.friendsCount === 0){
        twitterUsersShow(function(){});
      }

      reporter(event, oldState, newState);
      process.send({op:"READY", threeceeUser: configuration.threeceeUser});
      return this.READY;
    },

    "fsm_rateLimitStart": function(){
      statsObj.fsmPreviousPauseState = "READY";
      return this.PAUSE_RATE_LIMIT;
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLE",
    "fsm_error": "ERROR",
    "fsm_fetchUserStart": "FETCH_USER_START"

  },

  "FETCH_USER_START":{

    onEnter: function(event, oldState, newState){

      if (statsObj.threeceeUser.friendsCount === 0){
        twitterUsersShow(function(){});
      }

      reporter(event, oldState, newState);
      fsm.fsm_fetchUser();
      process.send({op:"FETCH", threeceeUser: configuration.threeceeUser});
      return this.FETCH_USER_START;
    },

    "fsm_init": "INIT",
    "fsm_reset": "RESET",
    "fsm_error": "ERROR",
    "fsm_disable": "DISABLE",
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

      if (statsObj.threeceeUser.friendsCount === 0){
        twitterUsersShow(function(){});
      }

      fetchFriends(params, function(err, results){
        if (err) {
          console.log(chalkError("fetchFriends ERROR: " + err));

          if (err.code === 88){
            process.send({op:"PAUSE_RATE_LIMIT", threeceeUser: configuration.threeceeUser, state: "PAUSE_RATE_LIMIT", params: params, error: err });
          }
          else {
            process.send({op:"ERROR", type: "UNKNOWN", threeceeUser: configuration.threeceeUser, state: "FETCH_USER", params: params, error: err });
          }

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
    "fsm_disable": "DISABLE",
    "fsm_fetchUserContinue": "FETCH_USER",
    "fsm_fetchUserEnd": "FETCH_END",

    "fsm_rateLimitStart": function(){
      statsObj.fsmPreviousPauseState = "FETCH_USER";
      return this.PAUSE_RATE_LIMIT;
    }

  },

  "FETCH_END":{

    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"FETCH_END", threeceeUser: configuration.threeceeUser});
      console.log("FETCH_END | PREV STATE: " + oldState);
    },

    "fsm_rateLimitStart": function(){
      statsObj.fsmPreviousPauseState = "FETCH_END";
      return this.PAUSE_RATE_LIMIT;
    },

    "fsm_fetchUserEnd": "FETCH_END",
    "fsm_init": "INIT",
    "fsm_disable": "DISABLE",
    "fsm_error": "ERROR",
    "fsm_reset": "RESET"

  },

  "PAUSE_RATE_LIMIT":{

    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      process.send({op:"PAUSE_RATE_LIMIT", threeceeUser: configuration.threeceeUser});
    },

    "fsm_error": "ERROR",
    "fsm_reset": "RESET",
    "fsm_disable": "DISABLE",

    "fsm_rateLimitEnd": function(){
      return statsObj.fsmPreviousPauseState;
    },

    "fsm_fetchUserEnd": "FETCH_END"

  },

  "DISABLE":{

    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      return this.ERROR;
    },

    "fsm_init": "INIT",
    "fsm_reset": "RESET"

  },

  "ERROR":{

    onEnter: function(event, oldState, newState){
      reporter(event, oldState, newState);
      return this.ERROR;
    },

    "fsm_disable": "DISABLE",
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

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);

  statsObj.threeceeUser.percentFetched = (statsObj.threeceeUser.friendsCount > 0) ? 100*(statsObj.threeceeUser.friendsFetched/statsObj.threeceeUser.friendsCount) : 0;

  console.log(chalkLog("--- STATS --------------------------------------\n"
    + "CUR USR: @" + configuration.threeceeUser
    + "\nSTART:   " + statsObj.startTimeMoment.format(compactDateTimeFormat)
    + "\nELAPSED: " + msToTime(statsObj.elapsed)
    + "\nFSM:     " + fsm.getMachineState()
    + "\nT FTCHD: " + statsObj.threeceeUser.friendsFetched + " / " + statsObj.threeceeUser.friendsCount
    + " (" + statsObj.threeceeUser.percentFetched.toFixed(2) + "%)"
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

    twitStream.on("error", function(err){

      console.log(chalkError("TFC | *** ERROR USER @" + configuration.threeceeUser
        + " | " +  jsonPrint(err)
      ));

      fsm.fsm_error();

      process.send({op:"ERROR", type: "UNKNOWN", threeceeUser: configuration.threeceeUser, state: "INIT", error: err });

      // quit("TWITTER STREAM ERROR | " + err);

    });

    twitStream.on("follow", function(followMessage){

      console.log(chalkInfo("TFC | +++ USER @" + configuration.threeceeUser + " FOLLOW"
        + " | " +  followMessage.target.id_str
        + " | @" +  followMessage.target.screen_name.toLowerCase()
      ));

      followMessage.target.following = true;
      followMessage.target.threeceeFollowing = configuration.threeceeUser;

      const friendRawObj = {
        op:"FRIEND_RAW", 
        follow: true, 
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

      console.log(chalkError("*** TWITTER ACCOUNT SETTINGS ERROR"
        + " | @" + configuration.threeceeUser 
        + " | " + getTimeStamp() 
        + " | ERR CODE: " + err.code
        + " | " + err.message
      ));

      if (err.code === 88){

        console.log(chalkAlert("*** TWITTER ACCOUNT SETTINGS ERROR | RATE LIMIT EXCEEDED" 
          + " | " + getTimeStamp() 
          + " | @" + configuration.threeceeUser 
        ));


        statsObj.threeceeUser = Object.assign({}, threeceeUserDefaults, statsObj.threeceeUser);  

        statsObj.threeceeUser.twitterRateLimitException = moment();
        statsObj.threeceeUser.twitterRateLimitExceptionFlag = true;
        statsObj.threeceeUser.twitterRateLimitResetAt = moment(moment().valueOf() + 60000);

        fsm.fsm_rateLimitStart();

        process.send({op:"THREECEE_USER", threeceeUser: omit(statsObj.threeceeUser, ["friends"])});

        return callback(err, null);

      }

      fsm.fsm_error();

      return callback(err, null);
    }

    const userScreenName = accountSettings.screen_name.toLowerCase();

    debug(chalkInfo(getTimeStamp() + " | TWITTER ACCOUNT: @" + userScreenName));

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

          return callback(null, null);
        }

        console.log(chalkError("*** TWITTER USER UPDATE ERROR" 
          + " | " + getTimeStamp() 
          + " | @" + userScreenName 
          + "\n" + jsonPrint(err)
        ));

        return callback(err, null) ;
      }

      callback(null, null);

    });
  });
}

function initialize(callback){
  initUnfollowQueueInterval(1000);
  fsm.fsm_reset();
  callback();
}

function unfollowFriend(params, callback){

  if (!twitClient) {
    console.log(chalkAlert("TFC | UNFOLLOW FRIEND | TWIT CLIENT UNDEFINED | SKIPPING"
      + " | UID: " + params.user.userId
      + " | @" + params.user.screenName
    ));
    return callback(null, null);
  }

  let unfollowFriendParams = {};

  if (params.user.user_id !== undefined) { 
    unfollowFriendParams.user_id = params.user.user_id;
  }
  else if (params.user.userId !== undefined) { 
    unfollowFriendParams.user_id = params.user.userId;
  }

  if (params.user.screen_name !== undefined) { 
    unfollowFriendParams.screen_name = params.user.screen_name;
  }
  else if (params.user.screenName !== undefined) { 
    unfollowFriendParams.screen_name = params.user.screenName;
  }

  if ((unfollowFriendParams.user_id === undefined)
    && (unfollowFriendParams.screen_name === undefined)
  ){

    console.log(chalkAlert("TFC | UNFOLLOW FRIEND"
      + "\nINVALID PARAMS"
      + "\n" + jsonPrint(params)
    ));
    quit("UNFOLLOW FRIEND | INVALID PARAMS");
    return callback(null, null);
  }

  twitClient.post(

    "friendships/destroy", unfollowFriendParams, 

    function destroyFriend(err, data, response){  // if success, data = user

      if (err) {

        console.log(chalkError("TFC | *** UNFOLLOW FRIEND ERROR"
          + " | ERROR: " + err
          + "\nPARAMS\n" + jsonPrint(unfollowFriendParams)
        ));

        return callback(err, unfollowFriendParams);

      }

      if (_.isObject(response) 
        && (response.statusCode !== undefined) 
        && (response.statusCode !== 200)) 
      {

        console.log(chalkError("TFC | *** UNFOLLOW FAIL"
          + " | 3C: @" + configuration.threeceeUser
          + " | RESPONSE CODE: " + response.statusCode
          + "\nPARAMS\n" + jsonPrint(unfollowFriendParams)
          + "\nRESPONSE\n" + jsonPrint(response)
        ));

        return callback(err, response);
      }

      if (data.following) {

        console.log(chalkAlert("TFC | XXX UNFOLLOW"
          + " | 3C: @" + configuration.threeceeUser
          + " | UID: " + data.id_str
          + " | @" + data.screen_name
          + " | FLWRs: " + data.followers_count
          + " | FRNDs: " + data.friends_count
          + " | Ts: " + data.statuses_count
          + " | FOLLOWING: " + data.following
          // + " | RESPONSE CODE: " + response.statusCode
          // + "\nPARAMS\n" + jsonPrint(unfollowFriendParams)
          // + "\nDATA\n" + jsonPrint(data)
        ));

        const userSmall = pick(
          data, 
          [ "id_str", "screen_name", "followers_count", "friends_count", "statuses_count"]
        );

        statsObj.users.unfollowed.push(userSmall);

        process.send(
          {
            op:"UNFOLLOWED", 
            threeceeUser: configuration.threeceeUser, 
            user: data
          }
        );

        return callback(null, data);

      }

      console.log(chalkInfo("TFC | miss UNFOLLOW"
        + " | 3C: @" + configuration.threeceeUser
        + " | UID: " + unfollowFriendParams.user_id
        + " | @" + unfollowFriendParams.screen_name
      ));

      callback(null, null);

    }
  );
}

function initUnfollowQueueInterval(interval){

  clearInterval(unfollowQueueInterval);

  unfollowQueueReady = true;

  console.log(chalkInfo("TFC"
    + " | CH @" + configuration.threeceeUser
    + " | INIT UNFOLLOW QUEUE INTERVAL | " + interval
  ));

  unfollowQueueInterval = setInterval(function(){

    debug(chalkInfo("UNFOLLOW QUEUE INTERVAL"
      + " | INTERVAL: " + msToTime(interval)
      + " | @" + configuration.threeceeUser
    ));

    if (unfollowQueueReady && (unfollowQueue.length > 0)) {

      unfollowQueueReady = false;

      const friend = unfollowQueue.shift();

      unfollowFriend({ user: friend }, function(err, results){  // if no error, results = unfollowed user

        unfollowQueueReady = true;

        if (err) {

          console.log(chalkError("*** UNFOLLOW ERROR"
            + " [ UFQ: " + unfollowQueue.length + "]"
            + " | 3C: @" + configuration.threeceeUser
            + " | NID: " + friend.user_id
            + " | @" + friend.screen_name
          ));


          if (err.code === 34){

            console.log(chalkError("=X= UNFOLLOW ERROR | NON-EXISTENT USER"
              + " | 3C: @" + configuration.threeceeUser
              + " | @" + friend.screen_name
            ));

            return;
          }

          process.send(
            {
              op:"ERROR",
              type: "UNKNOWN", 
              threeceeUser: configuration.threeceeUser, 
              state: "UNFOLLOW_ERROR", 
              params: {screen_name: friend.screen_name}, 
              error: err
            }
          );

          return;
        }

        if (!results) {

          console.log(chalkAlert("TFC | ... UNFOLLOW MISS"
            + " [ UFQ: " + unfollowQueue.length + "]"
            + " | 3C: @" + configuration.threeceeUser
            + " | UID: " + friend.user_id
            + " | @" + friend.screen_name
          ));

          return;
        }

        console.log(chalkAlert("TFC | XXX UNFOLLOW"
          + " [ UFQ: " + unfollowQueue.length + "]"
          + " | 3C: @" + configuration.threeceeUser
          + " | " + results.user_id
          + " | @" + results.screen_name
          + " | FLWRs: " + results.followers_count
          + " | FRNDs: " + results.friends_count
          + " | Ts: " + results.statuses_count
        ));

      });


    }

  }, interval);
}

function initCheckRateLimitInterval(interval){

  clearInterval(checkRateLimitInterval);

  debug(chalkInfo("TFC"
    + " | CH @" + configuration.threeceeUser
    + " | INIT CHECK RATE INTERVAL | " + interval
  ));

  checkRateLimitInterval = setInterval(function(){

    statsObj.elapsed = moment().diff(statsObj.startTimeMoment);

    debug(chalkInfo("CHECK RATE INTERVAL"
      + " | INTERVAL: " + msToTime(interval)
      + " | CURRENT USER: @" + configuration.threeceeUser
      + " | EXCEPTION: " + statsObj.threeceeUser.twitterRateLimitExceptionFlag
    ));

    if (statsObj.fsmState !== "ERROR") { checkRateLimit(); }

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
        // + " | TWITTER CONFIG\n" + jsonPrint(m.twitterConfig)
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

    case "FETCH_END":
      fsm.fsm_fetchUserEnd();
    break;

    case "FETCH_USER_START":
      fsm.fsm_fetchUserStart();
    break;

    case "FOLLOW":

      if (twitClient) {

        twitClient.post(

          "friendships/create", {screen_name: m.user.screenName}, 

          function createFriend(err, data, response){
            if (err) {
              console.log(chalkError("TFC | FOLLOW ERROR"
                + " | @" + configuration.threeceeUser
                + " | " + err
              ));

              process.send({op:"ERROR", type: "UNKNOWN", threeceeUser: configuration.threeceeUser, state: "FOLLOW", params: {screen_name: m.user.screenName}, error: err });
            }
            else {
              // debug("data\n" + jsonPrint(data));
              // debug("response\n" + jsonPrint(response));

              console.log(chalkInfo("TFC | +++ FOLLOW"
                + " | 3C: @" + configuration.threeceeUser
                + " | NID: " + m.user.userId
                + " | @" + m.user.screenName.toLowerCase()
              ));
            }
          }
        );
      }
    break;

    case "UNFOLLOW":

      // console.log("UNFOLLOW MESSAGE\n" + jsonPrint(m.user));

      unfollowFriend({ user: m.user }, function(err, results){

        if (err) {

          if (err.code === 34){
            console.log(chalkError("=X= UNFOLLOW ERROR | NON-EXISTENT USER"
              + " | 3C: @" + configuration.threeceeUser
              + "\n" + jsonPrint(m.user)
            ));
            return;
          }

          console.log(chalkError("=X= UNFOLLOW ERROR"
            + " | 3C: @" + configuration.threeceeUser
            + "\n" + jsonPrint(m.user)
          ));

          process.send(
            {
              op:"ERROR",
              type: "UNKNOWN", 
              threeceeUser: configuration.threeceeUser, 
              state: "UNFOLLOW_ERR", 
              params: { user: m.user }, 
              error: err
            }
          );

          return;
        }

        if (!results) {

          debug(chalkInfo("TFC | UNFOLLOW MISS"
            + " | 3C: @" + configuration.threeceeUser
            + "\n" + jsonPrint(m.user)
          ));

          return;
        }

        console.log(chalkInfo("TFC | XXX UNFOLLOW"
          + " | 3C: @" + configuration.threeceeUser
          + " | " + results.id_str
          + " | @" + results.screen_name
          + " | FLWRs: " + results.followers_count
          + " | FRNDs: " + results.friends_count
          + " | Ts: " + results.statuses_count
        ));

      });

    break;

    case "QUIT":
      fsm.fsm_reset();
      quit("PARENT");
    break;

    case "DISABLE":
      fsm.fsm_disable();
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

    case "VERBOSE":
      console.log(chalkAlert("TFC @" + configuration.threeceeUser + " | SET VERBOSE: " + m.verbose));
      configuration.verbose = m.verbose;
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
