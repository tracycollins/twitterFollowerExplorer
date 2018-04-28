/*jslint node: true */
"use strict";

let maxQueueFlag = false;

const MAX_Q_SIZE = 100;
const ONE_SECOND = 1000 ;

const defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
const compactDateTimeFormat = "YYYYMMDD_HHmmss";

let analyzeLanguageReady = true;
let analyzeLanguageInterval;
let statsUpdateInterval;

const Language = require("@google-cloud/language");
const languageClient = new Language.LanguageServiceClient();

let rxLangObjQueue = [];
let rxWordQueue = [];

let configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = 1*ONE_SECOND;

const os = require("os");
const util = require("util");
const moment = require("moment");
require("isomorphic-fetch");
// const Dropbox = require('dropbox').Dropbox;
const Dropbox = require("./js/dropbox").Dropbox;
const NodeCache = require("node-cache");
const debug = require("debug")("la");
const debugLang = require("debug")("lang");
const debugCache = require("debug")("cache");
const debugQ = require("debug")("queue");

let hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

const chalk = require("chalk");
const chalkAlert = chalk.red;
const chalkRed = chalk.red;
const chalkError = chalk.bold.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;
const chalkConnect = chalk.blue;

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

process.title = "node_languageAnalyzer";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");


let statsObj = {};

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

const wordCache = new NodeCache();

function showStats(options){
  statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
  statsObj.heap = process.memoryUsage().heapUsed/(1024*1024);
  statsObj.maxHeap = Math.max(statsObj.maxHeap, statsObj.heap);

  if (options) {
    console.log("= LA STATS\n" + jsonPrint(statsObj));
  }
  else {
    console.log(chalk.gray("= LA S"
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
  console.log(process.argv[1]
    + " | LANG ANAL: **** QUITTING"
    + " | CAUSE: " + msg
    + " | PID: " + process.pid
    
  );
  clearInterval(statsUpdateInterval);
  clearInterval(analyzeLanguageInterval);
  process.exit();
}

function analyzeLanguage(langObj, callback){

  debug(chalkAlert("analyzeLanguage\n" + jsonPrint(langObj)));

  const document = {
    "content": langObj.text,
    type: "PLAIN_TEXT"
  };

  let results = {};
  results.text = langObj.text;
  results.sentiment = {};
  results.entities = {};

  languageClient.analyzeSentiment({document: document}).then(function(responses) {

    const sentiment = responses[0].documentSentiment;

    results.sentiment.score = sentiment.score;
    results.sentiment.magnitude = sentiment.magnitude;
    results.sentiment.comp = 100*sentiment.score*sentiment.magnitude;

    debug(chalkRed(
      "M: " + 10*sentiment.magnitude.toFixed(1)
      + " | S: " + 10*sentiment.score.toFixed(1)
      + " | C: " + results.sentiment.comp.toFixed(2)
      + " | KWs: " + jsonPrint(results.keywords)
      + " | " + langObj.text
    ));

    if (callback !== undefined) { callback(null, results); }
  })
  .catch(function(err) {
    debug(chalkError("*** LANGUAGE ANALYZER ERROR: " + err));
    debug(chalkError("*** LANGUAGE ANALYZER ERROR: " + err));
    if (callback !== undefined) { callback(err, results); }
  });
}

function initAnalyzeLanguageInterval(interval){

  clearInterval(initAnalyzeLanguageInterval);

  console.log(chalkConnect("START LANGUAGE ANALYZER INTERVAL"
    + " | INTERVAL: " + interval + " ms"
  ));

  analyzeLanguageReady = true;

  let messageObj;

  analyzeLanguageInterval = setInterval(function(){ // TX KEEPALIVE

    if ((rxLangObjQueue.length > 0) && analyzeLanguageReady) {

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

      analyzeLanguage(langObj, function(err, results){

        if (err){
          statsObj.analyzer.total += 1;
          statsObj.analyzer.analyzed += 1;
          statsObj.analyzer.errors += 1;

          if (err.code === 3) {
            debug(chalkLog("LAC [RXLQ: " + rxLangObjQueue.length + "]"
              + " | UNSUPPORTED LANG"
              + " | " + langObj.obj.nodeId
              + " | @" + langObj.obj.screenName
              + " | " + err
              // + "\nERROR" + jsonPrint(err)
              // + "\nRESULTS" + jsonPrint(results)
            ));
          }
          else if (err.code === 8) {
            console.error(chalkAlert("LAC [RXLQ: " + rxLangObjQueue.length + "]"
              + " | LANGUAGE QUOTA"
              + " | " + langObj.obj.nodeId
              + " | @" + langObj.obj.screenName
              + " | RESOURCE_EXHAUSTED"
              // + "\n" + jsonPrint(err)
            ));
            rxLangObjQueue.push(langObj);
          }
          else {
            console.error(chalkError("LAC [RXLQ: " + rxLangObjQueue.length + "]"
              + " | LANGUAGE TEXT ERROR"
              + " | " + langObj.obj.nodeId
              + " | @" + langObj.obj.screenName
              + " | " + err
              + "\n" + jsonPrint(err)
            ));
          }

          messageObj.op = "LANG_RESULTS";
          messageObj.obj = langObj.obj;
          messageObj.error = err;
          messageObj.results = results;
          messageObj.stats = statsObj;

          process.send(messageObj, function(){
            debug(chalkInfo("LAC SENT LANG_RESULTS"));
            analyzeLanguageReady = true;
            if (rxLangObjQueue.length === 0){
              process.send({op: "IDLE", queue: rxLangObjQueue.length});
            }
          });

        }
        else {

          statsObj.analyzer.total += 1;
          statsObj.analyzer.analyzed += 1;

          debug(chalkLog("LANGUAGE RESULTS\n" + jsonPrint(results)));

          debug(chalkInfo("==> LANG RESULTS [RXLQ: " + rxLangObjQueue.length + "]"
            + " | @" + langObj.obj.screenName
            + " | NID: " + langObj.obj.nodeId
            + " | M " + 10*results.sentiment.magnitude.toFixed(2)
            + " | S " + 10*results.sentiment.score.toFixed(1)
            + " | C " + results.sentiment.comp.toFixed(2)
            // + " | TEXT: " + results.text
          ));

          messageObj.op = "LANG_RESULTS";
          messageObj.obj = langObj.obj;
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
      });
    }
    else if ((rxWordQueue.length > 0) && analyzeLanguageReady) {

      analyzeLanguageReady = false;

      const rxWordObj = rxWordQueue.shift();

      debug(chalkLog("RXWQ< | " + rxWordObj.wordCacheIndex));

      wordCache.get(rxWordObj.wordCacheIndex, function(err, wordHit){
        if (err) {
          console.log(chalkInfo("LAC WORD CACHE ERROR"
            + " | " + rxWordObj.wordCacheIndex
            + "\n" + jsonPrint(err)
          ));
          analyzeLanguageReady = true;
        }
        else if (wordHit) {
          debugLang(chalkLog("LAC WORD CACHE HIT ... SKIP | " + wordHit.wordCacheIndex));
          analyzeLanguageReady = true;
          statsObj.analyzer.total += 1;
          statsObj.analyzer.skipped += 1;
        }
        else {
          debug(chalkLog("LAC WORD CACHE MISS | " + rxWordObj.wordCacheIndex));

          let wordObj = {};
          wordObj = rxWordObj;
          wordObj.sentiment = {};

          analyzeLanguage({text: wordObj.wordCacheIndex}, function(err, results){

            analyzeLanguageReady = true;
            if (err){
              statsObj.analyzer.total += 1;
              statsObj.analyzer.errors += 1;
              wordObj.sentiment = {};
              wordCache.set(wordObj.wordCacheIndex, wordObj);
              console.log(chalkError("LANGUAGE WORD ERROR"
                + " | " + wordObj.wordCacheIndex
                + " | " + err
                // + "\n" + jsonPrint(wordObj)
                // + "\n" + jsonPrint(err)
              ));
            }
            else {
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
            }
          });
        }
      });
    }

  }, interval);
}

process.on("SIGHUP", function() {
  quit("SIGHUP");
});

process.on("SIGINT", function() {
  quit("SIGINT");
});


const testText = "This is a test of this universe!";
const testDocument = {
  "content": testText,
  type: "PLAIN_TEXT"
};


process.on("message", function(m) {

  debug(chalkAlert("LANG ANAL RX MESSAGE"
    + " | OP: " + m.op
    + "\n" + jsonPrint(m)
  ));

  switch (m.op) {

    case "INIT":
      console.log(chalkInfo("LANG ANAL INIT"
        + " | INTERVAL: " + m.interval
      ));

      initAnalyzeLanguageInterval(m.interval);

      languageClient.analyzeSentiment({document: testDocument}).then(function(responses) {
          const response = responses[0];
          console.log(chalkInfo("=========================\nLANGUAGE TEST\n" + jsonPrint(response)));
          process.send({op: "LANG_TEST_PASS", results: response});
          process.send({op: "QUEUE_READY", queue: rxLangObjQueue.length});
      })
      .catch(function(err) {
          console.error(chalkError("*** LANGUAGE TEST ERROR: " + err));
          process.send({op: "LANG_TEST_FAIL", err: err});
          process.send({op: "QUEUE_READY", queue: rxLangObjQueue.length});
      });

    break;

    case "STATS":
      showStats(m.options);
    break;

    case "LANG_ANALIZE":
      rxLangObjQueue.push(m);
      debugLang(chalkInfo("LANG_ANALIZE"
        + " [" + rxLangObjQueue.length + "]"
        + " | " + m.text
      ));
      if (!maxQueueFlag && (rxLangObjQueue.length >= MAX_Q_SIZE)) {
        process.send({op: "QUEUE_FULL", queue: rxLangObjQueue.length});
        maxQueueFlag = true;
      }
    break;
    default:
      console.log(chalkError("LANG ANALIZE UNKNOWN OP ERROR"
        + " | " + m.op
        + "\n" + jsonPrint(m)
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

const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_LA_CONFIG_FILE = process.env.DROPBOX_LA_CONFIG_FILE || "languageAnalyzerConfig.json";
const DROPBOX_LA_STATS_FILE = process.env.DROPBOX_LA_STATS_FILE || "languageAnalyzerStats.json";

const dropboxConfigFolder = "/config/utility";
const dropboxConfigFile = hostname + "_" + DROPBOX_LA_CONFIG_FILE;
const statsFolder = "/stats/" + hostname;
const statsFile = DROPBOX_LA_STATS_FILE;

console.log("DROPBOX_LA_CONFIG_FILE: " + DROPBOX_LA_CONFIG_FILE);
console.log("DROPBOX_LA_STATS_FILE : " + DROPBOX_LA_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function getTimeStamp(inputTime) {
  let currentTimeStamp ;

  if (inputTime  === undefined) {
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

  let options = {};

  options.contents = JSON.stringify(jsonObj, null, 2);
  options.path = fullPath;
  options.mode = "overwrite";
  options.autorename = false;

  dropboxClient.filesUpload(options)
    .then(function(response){
      debug(chalkLog("... SAVED DROPBOX JSON | " + options.path));
      if (callback !== undefined) { callback(null, response); }
    })
    .catch(function(error){
      if (error.status === 413){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | LAC | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: 413"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 429){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | LAC | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: TOO MANY WRITES"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else if (error.status === 500){
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | LAC | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          + " | ERROR: DROPBOX SERVER ERROR"
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
      else {
        // const errorText = (error.error_summary !== undefined) ? error.error_summary : jsonPrint(error);
        console.error(chalkError(moment().format(compactDateTimeFormat) 
          + " | LAC | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
          // + " | ERROR\n" + jsonPrint(error)
          + " | ERROR: " + error
          // + " ERROR\n" + jsonPrint(error.error)
        ));
        if (callback !== undefined) { callback(error); }
      }
    });
}

function initStatsUpdate(cnf){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("LAC initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

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
    console.log("\nLAC %%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.LA_PROCESS_NAME || "languageAnalyzer";

  cnf.verbose = process.env.LA_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.LA_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.LA_TEST_MODE || false ;
  cnf.quitOnError = process.env.LA_QUIT_ON_ERROR || false ;
  cnf.targetServer = process.env.LA_UTIL_TARGET_SERVER || "http://localhost:9997/util" ;

  cnf.statsUpdateIntervalTime = process.env.LA_STATS_UPDATE_INTERVAL || 120000;

  debug("LAC CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

setTimeout(function(){

  initialize(configuration, function(err, cnf){
    if (err && (err.status !== 404)) {
      console.error(chalkError("LAC ***** INIT ERROR *****\n" + jsonPrint(err)));
      quit();
    }
    console.log(chalkInfo(cnf.processName + " STARTED " + getTimeStamp() + "\n"));
    initStatsUpdate(cnf);
  });
}, 1 * ONE_SECOND);


