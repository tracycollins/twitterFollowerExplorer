process.title = "node_processUserChild";
const MODULE_ID_PREFIX = "PUC";

const DEFAULT_MAX_USER_TWEETIDS = 100;
const MIN_TWEET_ID = "1000000";

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

const configuration = {};

configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 

const debug = require("debug")(MODULE_ID_PREFIX);
const os = require("os");
const _ = require("lodash");
const async = require("async");
const defaults = require("object.defaults");

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkError = chalk.bold.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const userTweetFetchSet = new Set();

const tcuChildName = MODULE_ID_PREFIX + "_TCU";

const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);

const jsonPrint = tcUtils.jsonPrint;
// const msToTime = tcUtils.msToTime;
// const getTimeStamp = tcUtils.getTimeStamp;
// const formatBoolean = tcUtils.formatBoolean;
// const formatCategory = tcUtils.formatCategory;

const UserServerController = require("@threeceelabs/user-server-controller");
const userServerController = new UserServerController(MODULE_ID_PREFIX + "_USC");
// let userServerControllerReady = false;

userServerController.on("error", function(err){
  // userServerControllerReady = false;
  console.log(chalkError(MODULE_ID_PREFIX + " | *** USC ERROR | " + err));
});

userServerController.on("ready", function(appname){
  // userServerControllerReady = true;
  console.log(chalk.green(MODULE_ID_PREFIX + " | USC READY | " + appname));
});

const TweetServerController = require("@threeceelabs/tweet-server-controller");
const tweetServerController = new TweetServerController(MODULE_ID_PREFIX + "_TSC");

tweetServerController.on("error", function(err){
  console.log(chalkError(MODULE_ID_PREFIX + " | *** TSC ERROR | " + err));
});

tweetServerController.on("ready", function(appname){
  console.log(chalk.green(MODULE_ID_PREFIX + " | TSC READY | " + appname));
});

const NeuralNetworkTools = require("@threeceelabs/neural-network-tools");
const nnTools = new NeuralNetworkTools(MODULE_ID_PREFIX + "_NNT");

const statsObj = {};

statsObj.pid = process.pid;
statsObj.cpus = os.cpus().length;

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
statsObj.users.categorized = {};

statsObj.users.categorized.total = 0;
statsObj.users.categorized.manual = 0;
statsObj.users.categorized.auto = 0;
statsObj.users.categorized.matched = 0;
statsObj.users.categorized.mismatched = 0;
statsObj.users.categorized.matchRate = 0;

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

console.log(MODULE_ID_PREFIX + " | =================================");
console.log(MODULE_ID_PREFIX + " | PROCESS TITLE: " + process.title);
console.log(MODULE_ID_PREFIX + " | PROCESS ID:    " + process.pid);
console.log(MODULE_ID_PREFIX + " | =================================");

function quit(message) {
  let msg = "";
  let exitCode = 0;
  if (message) { 
    msg = message;
    exitCode = 1;
  }
  console.log(MODULE_ID_PREFIX + " | " + process.argv[1]
    + " | PROCESS USER CHILD: **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
  );

  setTimeout(function(){
    process.exit(exitCode);
  }, 3000);
}

process.on("SIGHUP", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** SIGHUP ***"));
  quit("SIGHUP");
});

process.on("SIGINT", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** SIGINT ***"));
  quit("SIGINT");
});

process.on("disconnect", function() {
  console.log(chalkAlert("RNT | " + configuration.processName + " | *** DISCONNECT ***"));
  quit("DISCONNECT");
});

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

      if (tweet.id_str.toString() > user.tweets.sinceId.toString()) {
        user.tweets.sinceId = tweet.id_str.toString();
      }

      if (forceFetch || !user.tweets.tweetIds.includes(tweet.id_str.toString())) { 

        try {

          const tweetObj = await tweetServerController.createStreamTweetAsync(tscParams);

          if (!user.tweetHistograms || (user.tweetHistograms === undefined)) { user.tweetHistograms = {}; }

          user.tweetHistograms = await tcUtils.processTweetObj({tweetObj: tweetObj, histograms: user.tweetHistograms});
          user.tweets.tweetIds = _.union(user.tweets.tweetIds, [tweet.id_str]); 

          statsObj.twitter.tweetsProcessed += 1;
          statsObj.twitter.tweetsTotal += 1;

          if (configuration.testMode || configuration.verbose) {
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

  const enableFetchTweets = params.enableFetchTweets || configuration.enableFetchTweets;
  const tweets = params.tweets;

  const tscParams = {};

  tscParams.globalTestMode = configuration.globalTestMode;
  tscParams.testMode = configuration.testMode;
  tscParams.inc = false;
  // tscParams.twitterEvents = configEvents;
  tscParams.tweetStatus = {};

  let tweetHistogramsEmpty = false;

  try{
    
    tweetHistogramsEmpty = await tcUtils.emptyHistogram(user.tweetHistograms);

    const forceFetch = enableFetchTweets && tweetHistogramsEmpty;

    const processedUser = await processUserTweetArray({
      user: user, 
      forceFetch: forceFetch, 
      tweets: tweets, 
      tscParams: tscParams
    });

    if (tweetHistogramsEmpty) {

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


function histogramIncomplete(histogram){

  return new Promise(function(resolve){

    if (!histogram) { return resolve(true); }
    if (histogram === undefined) { return resolve(true); }
    if (histogram == {}) { return resolve(true); }

    async.eachSeries(Object.values(histogram), function(value, cb){

      if (value == {}) { return cb(); }
      if ((value !== undefined) && (Object.keys(value).length > 0)) { return cb("valid"); }

      cb();

    }, function(valid){

      if (valid) { return resolve(false); }
      return resolve(true);
    });

  });
}

const userTweetsDefault = {
  sinceId: MIN_TWEET_ID,
  tweetIds: []
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
      debug(chalkInfo("TFE | updateUserTweets | >>> PRIORITY FETCH TWEETS"
        + " | @" + user.screenName
      ));
    }

    user.tweetHistograms = {};
    const latestTweets = await tcUtils.fetchUserTweets({user: user, force: true});
    if (latestTweets) { user.latestTweets = latestTweets; }
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

function updatePreviousUserProps(params){

  return new Promise(function(resolve, reject){

    if (!params.user) {
      return reject(new Error("user UNDEFINED"));
    }

    const user = params.user;

    async.eachSeries(USER_PROFILE_PROPERTY_ARRAY, function(userProp, cb){

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

async function updateUser(params) {

  const enableFetchTweets = params.enableFetchTweets || configuration.enableFetchTweets;

  statsObj.status = "PROCESS USER";

  debug(chalkInfo("PROCESS USER\n" + jsonPrint(params.user)));

  if (userServerController === undefined) {
    console.log(chalkError("TFE | *** processUser userServerController UNDEFINED"));
    throw new Error("processUser userServerController UNDEFINED");
  }

  const user = params.user;
  user.following = true;

  try {

    let updatedTweetsUser = user;

    if (enableFetchTweets){
      updatedTweetsUser = await updateUserTweets({user: user});
    }
    
    const updatedHistogramUser = await tcUtils.updateUserHistograms({
      user: updatedTweetsUser,
      updateGlobalHistograms: configuration.updateGlobalHistograms
    });

    const activateNetworkResults = await nnTools.activate({ 
      user: updatedHistogramUser,
      convertDatumFlag: true
    });

    const prevPropsUser = await updatePreviousUserProps({user: updatedHistogramUser});

    process.send({op: "RESULTS", user: prevPropsUser, data: activateNetworkResults}, function(err){
      if (err) { 
        console.trace(chalkError("RNT | *** SEND ERROR | NETWORK_OUTPUT | " + err));
        quit("SEND NETWORK_OUTPUT ERROR");
      }
    });

  }
  catch(err) {

    if ((err.code === 34) || (err.statusCode === 401) || (err.statusCode === 404)){

      console.log(chalkError("TFE | *** processUser ERROR"
        + " | NID: " + user.nodeId
        + " | @" + user.screenName
        + " | ERR CODE: " + err.code
        + " | ERR STATUS CODE: " + err.statusCode
        + " | USER_NOT_FOUND or UNAUTHORIZED ... DELETING ..."
      ));

      userTweetFetchSet.delete(user.nodeId);
      await global.wordAssoDb.User.deleteOne({ "nodeId": user.nodeId });

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

async function processUser(userIn){

  try {

    const user = await tcUtils.encodeHistogramUrls({user: userIn});

    user.priorityFlag = userIn.priorityFlag;

    if (!user.latestTweets || (user.latestTweets === undefined)) { 
      user.latestTweets = [];
    }
    if (!user.tweetHistograms || (user.tweetHistograms === undefined)) { 
      user.tweetHistograms = {}; 
    }
    if (!user.profileHistograms || (user.profileHistograms === undefined)) { 
      user.profileHistograms = {}; 
    }

    if (user.profileHistograms.images && (user.profileHistograms.images !== undefined)) {

      for(const imageEntity of Object.keys(user.profileHistograms.images)){

        if (imageEntity.includes(".")) { // mongoDb hates '.' in object property
          const imageEntityEncoded = btoa(imageEntity);
          user.profileHistograms.images[imageEntityEncoded] = user.profileHistograms.images[imageEntity];
          delete user.profileHistograms.images[imageEntity];
          console.log(chalkAlert(MODULE_ID_PREFIX
            + " | !!! ILLEGAL PROFILE IMAGE KEY"
            + " | NID: " + user.nodeId
            + " | @" + user.screenName
            + " | CONVERT " + imageEntity + " --> " + imageEntityEncoded
          ));
        }
      }
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
      tcUtils.userText(MODULE_ID_PREFIX + " | FOUND USER DB", user);
    }

    if ((userIn.op == "USER_TWEETS") 
      && (userIn.latestTweets.length > 0) 
      && (userIn.latestTweets[0].user.id_str == userIn.nodeId))
    {
      // update user props
      const convertedRawUser = await userServerController.convertRawUserPromise({
        user: userIn.latestTweets[0].user
      });

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

    if (!userIn.latestTweets || (userIn.latestTweets === undefined)) { userIn.latestTweets = []; }

    user.latestTweets = [...user.latestTweets, ...userIn.latestTweets];

    await updateUser({user: user});

    statsObj.queues.processUserQueue.busy = false;
  }
  catch(err){
    console.log(chalkError("TFE | *** ERROR processUser"
      + " | USER ID: " + userIn.userId
      + " | " + err
    ));
    console.log(err);
    statsObj.queues.processUserQueue.busy = false;
  }
}

async function processRxMessage(m){

  try{

    debug(chalkAlert("RNT RX MESSAGE"
      + " | OP: " + m.op
      + " | KEYS: " + Object.keys(m)
    ));

    switch (m.op) {
      
      case "PROCESS":

      break;
      
      default:
        console.log(chalkError(MODULE_ID_PREFIX + " | *** UNKNOWN OP ERROR"
          + " | " + m.op
          + "\n" + jsonPrint(m)
        ));
        console.error.bind(console, MODULE_ID_PREFIX + " | *** UNKNOWN OP ERROR | " + m.op + "\n" + jsonPrint(m));
    }

    return;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | processRxMessage ERROR: " + err));
    throw err;
  }
}

const rxMessageQueue = [];
let rxMessageQueueReady = true;

setInterval(async function(){

  if (rxMessageQueueReady && rxMessageQueue.length > 0){

    try{
      rxMessageQueueReady = false;

      const message = rxMessageQueue.shift();

      await processRxMessage(message);
      rxMessageQueueReady = true;
    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | rxMessageQueue ERROR: " + err));
    }

  }

}, 100);

process.on("message", async function(m) {

  switch (m.op) {

    case "PROCESS":
      if (m.verbose){
        console.log(chalkLog(MODULE_ID_PREFIX + " | --> PROCESS"
          + " | " + m.user.nodeId 
          + " | @" + m.user.screenName 
        ));
      }
      await processUser(m);
    break;

    case "INIT":

      configuration.verbose = m.verbose || configuration.verbose;
      configuration.testMode = m.testMode || configuration.testMode;
      configuration.userProfileOnlyFlag = m.userProfileOnlyFlag || configuration.userProfileOnlyFlag;

      console.log(chalkLog(MODULE_ID_PREFIX + " | INIT | INTERVAL: " + m.interval + "\n" + jsonPrint(configuration)));

      process.send({ op: "IDLE"}, function(err){
        if (err) { 
          console.trace(chalkError(MODULE_ID_PREFIX + " | *** SEND ERROR | IDLE | " + err));
          console.error.bind(console, MODULE_ID_PREFIX + " | *** SEND ERROR | IDLE | " + err);
        }
        return;
      });

    break;

    default:
      console.log(chalkError("RNT | *** UNKNOWN OP ERROR"
        + " | " + m.op
        + "\n" + jsonPrint(m)
      ));
      console.error.bind(console, "RNT | *** UNKNOWN OP ERROR | " + m.op + "\n" + jsonPrint(m));
  }
});
