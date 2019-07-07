/*jslint node: true */

let maxQueueFlag = false;

const MAX_Q_SIZE = 100;
const ONE_SECOND = 1000;
const ONE_MINUTE = 60*ONE_SECOND;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let analyzeLanguageReady = true;
let analyzeLanguageInterval;
let statsUpdateInterval;

// const Language = require("@google-cloud/language").v1beta2;
const Language = require("@google-cloud/language");
const languageClient = new Language.LanguageServiceClient();

const rxLangObjQueue = [];
const rxWordQueue = [];

const configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = Number(ONE_SECOND);
configuration.quotaTimoutDuration = 1*ONE_MINUTE;

const os = require("os");
const util = require("util");
const moment = require("moment");
const treeify = require("treeify");

const fetch = require("isomorphic-fetch"); // or another library of choice.

const Dropbox = require("dropbox").Dropbox;
const NodeCache = require("node-cache");
const debug = require("debug")("la");
const debugLang = require("debug")("lang");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");

let hostname = os.hostname();
hostname = hostname.replace(/\.example\.com/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.at\.net/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const chalk = require("chalk");
const chalkAlert = chalk.red;
// const chalkRed = chalk.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.blue;

const jsonPrint = function (obj){
  if (obj) {
    return treeify.asTree(obj, true, true);
  }
  else {
    return "UNDEFINED";
  }
};

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

process.title = "node_languageAnalyzer";
console.log("\n\nLAC | =================================");
console.log("LAC | HOST:          " + hostname);
console.log("LAC | PROCESS TITLE: " + process.title);
console.log("LAC | PROCESS ID:    " + process.pid);
console.log("LAC | PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("LAC | =================================");


const statsObj = {};

statsObj.hostname = hostname;
statsObj.pid = process.pid;
statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
statsObj.maxHeap = process.memoryUsage().heapUsed/(1024*1024);

statsObj.startTime = moment().valueOf();
statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);

statsObj.queues = {};

statsObj.analyzer = {};
statsObj.analyzer.total = 0;
statsObj.analyzer.analyzed = 0;
statsObj.analyzer.skipped = 0;
statsObj.analyzer.errors = 0;
statsObj.analyzer.quotaFlag = false;

const wordCache = new NodeCache();

function showStats(options){

  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);

  if (options) {
    console.log("LAC | STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.gray("LAC"
      + " | E: " + statsObj.elapsed
      + " | S: " + moment(parseInt(statsObj.startTime)).format(compactDateTimeFormat)
      + " | RXWQ: " + rxWordQueue.length
      + " | RXLQ: " + rxLangObjQueue.length
      + " | WORD $: " + wordCache.getStats().keys
      + " | TOT: " + statsObj.analyzer.total
      + " | ANLs: " + statsObj.analyzer.analyzed
      + " | ERRs: " + statsObj.analyzer.errors
    ));
  }
}

function quit(message) {
  let msg = "";
  if (message) { msg = message; }
  showStats(true);
  console.log("LAC | " + process.argv[1]
    + " | LANG ANAL: **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
    
  );
  clearInterval(statsUpdateInterval);
  clearInterval(analyzeLanguageInterval);
  process.exit();
}

function analyzeLanguage(langObj){

  return new Promise(async function(resolve, reject){

    debug(chalkAlert("analyzeLanguage\n" + jsonPrint(langObj)));

    const document = {
      "content": langObj.text,
      type: "PLAIN_TEXT"
    };

    const results = {};
    results.nodeId = langObj.nodeId;
    results.screenName = langObj.screenName;
    results.text = langObj.text;
    results.sentiment = {};
    results.entities = {};

    let responses;

    try {

      responses = await languageClient.analyzeSentiment({document: document});

      const sentiment = responses[0].documentSentiment;

      results.sentiment.score = sentiment.score;
      results.sentiment.magnitude = sentiment.magnitude;
      results.sentiment.comp = 100*sentiment.score*sentiment.magnitude;

      debug(chalkInfo("LAC"
        + " | NID: " + langObj.nodeId
        + " | @" + langObj.screenName
        + " | M: " + 10*sentiment.magnitude.toFixed(1)
        + " | S: " + 10*sentiment.score.toFixed(1)
        + " | C: " + results.sentiment.comp.toFixed(2)
        // + " | " + langObj.text
      ));

      resolve(results);

    }
    catch(err){
      debug(chalkError("*** LANGUAGE ANALYZER ERROR: " + err));
      reject(err);
    }

  });
}

let startQuotaTimeOut;

function startQuotaTimeOutTimer(){

  clearTimeout(startQuotaTimeOut);

  startQuotaTimeOut = setTimeout(function(){

    statsObj.analyzer.quotaFlag = false;

    console.log(chalkAlert("LAC | XXX CLEAR QUOTA FLAG"));

  }, configuration.quotaTimoutDuration);
}

function initAnalyzeLanguageInterval(interval){

  clearInterval(initAnalyzeLanguageInterval);

  console.log(chalkConnect("LAC | START LANGUAGE ANALYZER INTERVAL"
    + " | INTERVAL: " + interval + " ms"
  ));

  analyzeLanguageReady = true;

  let messageObj;
  let results;

  analyzeLanguageInterval = setInterval(async function(){ // TX KEEPALIVE

    if ((rxLangObjQueue.length > 0) && analyzeLanguageReady && !statsObj.analyzer.quotaFlag) {

      messageObj = {};
      messageObj.obj = {};
      messageObj.results = {};
      messageObj.stats = {};

      analyzeLanguageReady = false;

      const langObj = rxLangObjQueue.shift();

      if (maxQueueFlag && (rxLangObjQueue.length < MAX_Q_SIZE)) {
        process.send({op: "QUEUE_READY", queue: rxLangObjQueue.length});
        maxQueueFlag = false;
      }
      else if (rxLangObjQueue.length === 0){
        process.send({op: "QUEUE_EMPTY", queue: rxLangObjQueue.length});
        maxQueueFlag = false;
      }

      if (!maxQueueFlag && (rxLangObjQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxLangObjQueue.length});
        maxQueueFlag = true;
      }

      try{

        results = await analyzeLanguage(langObj);

        statsObj.analyzer.total += 1;
        statsObj.analyzer.analyzed += 1;

        debug(chalkLog("LANGUAGE RESULTS\n" + jsonPrint(results)));

        debug(chalkInfo("==> LANG RESULTS [RXLQ: " + rxLangObjQueue.length + "]"
          + " | @" + langObj.screenName
          + " | NID: " + langObj.nodeId
          + " | M " + 10*results.sentiment.magnitude.toFixed(2)
          + " | S " + 10*results.sentiment.score.toFixed(1)
          + " | C " + results.sentiment.comp.toFixed(2)
          // + " | TEXT: " + results.text
        ));

        messageObj.op = "LANG_RESULTS";
        messageObj.obj = langObj;
        messageObj.results = results;
        messageObj.stats = statsObj;

        process.send(messageObj, function(){
          debug(chalkInfo("SENT LANG_RESULTS"));
          analyzeLanguageReady = true;
          if (rxLangObjQueue.length === 0){
            process.send({op: "IDLE", queue: rxLangObjQueue.length});
          }
        });
      }
      catch(err){

        statsObj.analyzer.total += 1;
        statsObj.analyzer.analyzed += 1;
        statsObj.analyzer.errors += 1;

        if (err.code === 3) {
          debug(chalkLog("LAC [RXLQ: " + rxLangObjQueue.length + "]"
            + " | UNSUPPORTED LANG"
            + " | " + langObj.nodeId
            + " | @" + langObj.screenName
            + " | " + err
          ));
          analyzeLanguageReady = true;
          return;
        }
        else if (err.code === 8) {
          console.error(chalkAlert("LAC | *** [RXLQ: " + rxLangObjQueue.length + "]"
            + " | LANGUAGE QUOTA"
            + " | " + langObj.nodeId
            + " | @" + langObj.screenName
            + " | RESOURCE_EXHAUSTED"
          ));
          statsObj.analyzer.quotaFlag = true;
          startQuotaTimeOutTimer();
          rxLangObjQueue.push(langObj);
          analyzeLanguageReady = true;
          return;
        }
        else {
          console.error(chalkError("LAC | *** [RXLQ: " + rxLangObjQueue.length + "]"
            + " | LANGUAGE TEXT ERROR"
            + " | " + langObj.nodeId
            + " | @" + langObj.screenName
            + " | " + err
            + "\nLAC | " + jsonPrint(err)
          ));
          analyzeLanguageReady = true;
          return;
        }

        messageObj.op = "LANG_RESULTS";
        messageObj.obj = langObj;
        messageObj.error = err;
        messageObj.results = results;
        messageObj.stats = statsObj;

        process.send(messageObj, function(){

          debug(chalkInfo("LAC | SENT LANG_RESULTS"));

          analyzeLanguageReady = true;

          if (rxLangObjQueue.length === 0){
            process.send({op: "IDLE", queue: rxLangObjQueue.length});
          }

        });
      }
    }

    else if ((rxWordQueue.length > 0) && analyzeLanguageReady) {

      analyzeLanguageReady = false;

      const rxWordObj = rxWordQueue.shift();

      debug(chalkLog("RXWQ< | " + rxWordObj.wordCacheIndex));

      wordCache.get(rxWordObj.wordCacheIndex, async function(err, wordHit){

        if (err) {

          console.log(chalkInfo("LAC | WORD CACHE ERROR"
            + " | " + rxWordObj.wordCacheIndex
            + "\n" + jsonPrint(err)
          ));
          analyzeLanguageReady = true;

        }
        else if (wordHit) {

          debugLang(chalkLog("LAC | WORD CACHE HIT ... SKIP | " + wordHit.wordCacheIndex));
          statsObj.analyzer.total += 1;
          statsObj.analyzer.skipped += 1;

          analyzeLanguageReady = true;
        }
        else {

          debug(chalkLog("LAC | WORD CACHE MISS | " + rxWordObj.wordCacheIndex));

          let wordObj = {};
          wordObj = rxWordObj;
          wordObj.sentiment = {};

          try {
            results = await analyzeLanguage({text: wordObj.wordCacheIndex});

            statsObj.analyzer.total += 1;
            statsObj.analyzer.analyzed += 1;

            wordObj.sentiment = results.sentiment;

            wordCache.set(wordObj.wordCacheIndex, wordObj);

            debugLang(chalkInfo(
              "LAC | MAG: " + 10*results.sentiment.magnitude.toFixed(1)
              + " | SCORE: " + 10*results.sentiment.score.toFixed(1)
              + " | C: " + results.sentiment.comp.toFixed(2)
              + " | " + results.text
            ));

            analyzeLanguageReady = true;

          }
          catch(e){

            statsObj.analyzer.total += 1;
            statsObj.analyzer.errors += 1;

            wordObj.sentiment = {};
            wordCache.set(wordObj.wordCacheIndex, wordObj);

            console.log(chalkError("LAC | WORD ERROR"
              + " | " + wordObj.wordCacheIndex
              + " | " + e
            ));

            analyzeLanguageReady = true;
          }
        }
      });
    }

  }, interval);
}

process.on( "SIGHUP", function() {
  console.log(chalkAlert("LAC | *** SIGHUP ***"));
  quit("SIGHUP");
});

process.on( "SIGINT", function() {
  console.log(chalkAlert("LAC | *** SIGINT ***"));
  quit("SIGINT");
});

process.on("disconnect", function() {
  console.log(chalkAlert("LAC | *** DISCONNECT ***"));
  quit("DISCONNECT");
});

const testText = "This is a test of this universe!";
const testDocument = {
  "content": testText,
  type: "PLAIN_TEXT"
};


process.on("message", async function(m) {

  debug(chalkAlert("LANG ANAL RX MESSAGE"
    + " | OP: " + m.op
    + "\n" + jsonPrint(m)
  ));

  let responses;

  switch (m.op) {

    case "INIT":

      console.log(chalkInfo("LAC | INIT"
        + " | INTERVAL: " + m.interval
      ));

      initAnalyzeLanguageInterval(m.interval);

      try{
        responses = await languageClient.analyzeSentiment({document: testDocument});
        const response = responses[0];
        console.log(chalkInfo("LAC | =========================\nLAC\n" + jsonPrint(response)));
        process.send({op: "LANG_TEST_PASS", results: response});
        process.send({op: "QUEUE_READY", queue: rxLangObjQueue.length});
      }
      catch(err){
        console.error(chalkError("LAC | *** LANGUAGE TEST ERROR: " + err));
        process.send({op: "LANG_TEST_FAIL", err: err});
        process.send({op: "QUEUE_READY", queue: rxLangObjQueue.length});
      }
    break;

    case "STATS":
      showStats(m.options);
    break;

    case "ANALYZE":

      rxLangObjQueue.push(m);

      debug(chalkInfo("LAC | R> LANG_ANALIZE"
        + " [RLQ: " + rxLangObjQueue.length + "]"
        + " | " + m.text
      ));

      if (!maxQueueFlag && (rxLangObjQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxLangObjQueue.length});
        maxQueueFlag = true;
      }

    break;

    default:
      console.log(chalkError("LAC | *** UNKNOWN OP ERROR"
        + " | " + m.op
        + "\nLAC\n" + jsonPrint(m)
      ));
  }
});

wordCache.on("set", function(word, wordObj) {
  debug(chalkLog("WORD CACHE SET"
    + " | " + word 
    + " | " + wordObj.raw
  ));
});

wordCache.on("expired", function(word, wordObj) {

  if (wordObj !== undefined) {
    debug("... CACHE WORD EXPIRED"
      + " | " + word
      + " | LS: " + moment(parseInt(wordObj.lastSeen)).format(compactDateTimeFormat)
      + " | " + msToTime(moment().valueOf() - wordObj.lastSeen) 
      + " | M: " + wordObj.mentions 
      + " | K: " + wordCache.getStats().keys 
      + " | H: " + wordCache.getStats().hits 
      + " | M: " + wordCache.getStats().misses);
  } else {
    debug(chalkError("??? UNDEFINED wordObj on wordCache expired ???"));
  }
});

const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN;
const DROPBOX_LA_CONFIG_FILE = process.env.DROPBOX_LA_CONFIG_FILE || "languageAnalyzerConfig.json";
const DROPBOX_LA_STATS_FILE = process.env.DROPBOX_LA_STATS_FILE || "languageAnalyzerStats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigFile = hostname + "_" + DROPBOX_LA_CONFIG_FILE;
const statsFolder = "/stats/" + hostname;
const statsFile = DROPBOX_LA_STATS_FILE;

console.log("LAC | DROPBOX_LA_CONFIG_FILE: " + DROPBOX_LA_CONFIG_FILE);
console.log("LAC | DROPBOX_LA_STATS_FILE : " + DROPBOX_LA_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

const dropboxClient = new Dropbox({ 
  accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN,
  fetch: fetch
});

function getTimeStamp(inputTime) {
  let currentTimeStamp;

  if (inputTime === undefined) {
    currentTimeStamp = moment().format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else if (moment.isMoment(inputTime)) {
    currentTimeStamp = moment(inputTime).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
  else {
    currentTimeStamp = moment(parseInt(inputTime)).format(defaultDateTimeFormat);
    return currentTimeStamp;
  }
}

function saveFile (path, file, jsonObj, callback){

  const fullPath = path + "/" + file;

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + fullPath));

  const options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options).
    then(function(response){
      debug(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null, response); }
    }).
    catch(function(error){
      if (error.status === 413){
        console.error(chalkError("LAC | *** " + moment().format(compactDateTimeFormat) 
          + " | ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError("LAC | *** " + moment().format(compactDateTimeFormat) 
          + " | ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError("LAC | *** " + moment().format(compactDateTimeFormat) 
          + " | ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        console.error(chalkError("LAC | *** " + moment().format(compactDateTimeFormat) 
          + " | ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: " + error
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
}

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("LAC | initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  statsUpdateInterval = setInterval(function () {

    if (analyzeLanguageReady && (rxLangObjQueue.length === 0)) {
      process.send({op: "IDLE", queue: rxLangObjQueue.length});
    }

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj);

  }, cnf.statsUpdateIntervalTime);
}

function initialize(cnf, callback){

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\nLAC | %%%%%%%%%%%%%%\nLAC | DEBUG ENABLED \nLAC | %%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.LA_PROCESS_NAME || "languageAnalyzer";

  cnf.verbose = process.env.LA_VERBOSE_MODE || false;
  cnf.globalTestMode = process.env.LA_GLOBAL_TEST_MODE || false;
  cnf.testMode = process.env.LA_TEST_MODE || false;
  cnf.quitOnError = process.env.LA_QUIT_ON_ERROR || false;
  cnf.targetServer = process.env.LA_UTIL_TARGET_SERVER || "http://localhost:9997/util";

  cnf.statsUpdateIntervalTime = process.env.LA_STATS_UPDATE_INTERVAL || 120000;

  debug("LAC CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

setTimeout(function(){

  initialize(configuration, function(err, cnf){
    if (err && (err.status !== 404)) {
      console.error(chalkError("LAC | *** INIT ERROR\n" + jsonPrint(err)));
      quit("INIT ERROR");
    }
    console.log(chalkInfo("LAC | " + cnf.processName + " STARTED " + getTimeStamp() + "\n"));
    initStatsUpdate(cnf);
  });
}, Number(ONE_SECOND));


