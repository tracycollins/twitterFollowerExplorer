/*jslint node: true */
"use strict";

var maxQueueFlag = false;

var MAX_Q_SIZE = 100;
var ONE_SECOND = 1000 ;
var ONE_MINUTE = ONE_SECOND*60 ;

var defaultDateTimeFormat = "YYYY-MM-DD HH:mm:ss ZZ";
var compactDateTimeFormat = "YYYYMMDD_HHmmss";

var analyzeLanguageRunning = false;
var analyzeLanguageReady = true;
var analyzeLanguageInterval;
var statsUpdateInterval;

var languageClient = require('@google-cloud/language')();


var EventEmitter2 = require("eventemitter2").EventEmitter2;
var configEvents = new EventEmitter2({
  wildcard: true,
  newListener: true,
  maxListeners: 20,
  verboseMemoryLeak: true
});

var rxLangObjQueue = [];
var rxWordQueue = [];

var ANALYZE_INTERVAL = 100;

var configuration = {};
configuration.verbose = false;
configuration.globalTestMode = false;
configuration.testMode = false; // 
configuration.keepaliveInterval = 30*ONE_SECOND;
configuration.rxQueueInterval = 1*ONE_SECOND;

var S = require("string");
var os = require("os");
var util = require("util");
var moment = require("moment");
var Dropbox = require("dropbox");
var NodeCache = require("node-cache");
var async = require("async");
var debug = require("debug")("la");
var debugLang = require("debug")("lang");
var debugCache = require("debug")("cache");
var debugQ = require("debug")("queue");

var hostname = os.hostname();
hostname = hostname.replace(/\.home/g, "");
hostname = hostname.replace(/\.local/g, "");
hostname = hostname.replace(/\.fios-router\.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");

var chalk = require("chalk");
var chalkAlert = chalk.red;
var chalkRed = chalk.red;
var chalkRedBold = chalk.bold.red;
var chalkError = chalk.bold.red;
var chalkWarn = chalk.red;
var chalkLog = chalk.gray;
var chalkInfo = chalk.black;
var chalkInfoBold = chalk.bold.black;
var chalkConnect = chalk.blue;
var chalkDisconnect = chalk.yellow;


var resetInProgressFlag = false;

function reset(cause, callback){

  if (!resetInProgressFlag) {

    var c = cause;
    resetInProgressFlag = true;

    setTimeout(function(){
      resetInProgressFlag = false;
      console.log(chalkError(moment().format(compactDateTimeFormat) + " | RESET: " + c));
      if (callback) { callback(); }
    }, 1*ONE_SECOND);

  }
}

var jsonPrint = function (obj){
  if (obj) {
    return JSON.stringify(obj, null, 2);
  }
  else {
    return "UNDEFINED";
  }
};

console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS ID:    " + process.pid);
console.log("PROCESS ARGS:  " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

function quit(message) {
  var msg = '';
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

var testDocument = languageClient.document("This is a test of this universe!");

// testDocument.annotate(function(err, annotations) {
//   if (err) {
//     console.error(chalkError("LANG TEST ERROR: " + err));
//     // console.error(chalkError("LANG TEST ERROR\n" + jsonPrint(err)));
//     process.send({op: "LANG_TEST_FAIL"});
//   }
//   else {
//     debug("LANG TEST PASS");
//     process.send({op: "LANG_TEST_PASS"});
//   }
// });


process.on('SIGHUP', function() {
  quit('SIGHUP');
});

process.on('SIGINT', function() {
  quit('SIGINT');
});


process.on('message', function(m) {

  debug(chalkAlert("LANG ANAL RX MESSAGE"
    + " | OP: " + m.op
    + "\n" + jsonPrint(m)
  ));

  // if ((m === "SIGINT") || (m === "SIGHUP")) {

  //   clearInterval(statsUpdateInterval);
  //   clearInterval(analyzeLanguageInterval);
  // }

  switch (m.op) {

    case "INIT":
      console.log(chalkInfo("LANG ANAL INIT"
        + " | INTERVAL: " + m.interval
      ));
      initAnalyzeLanguageInterval(m.interval);

      testDocument.annotate(function(err, annotations) {
        if (err) {
          console.error(chalkError("LANG TEST ERROR: " + err));
          // console.error(chalkError("LANG TEST ERROR\n" + jsonPrint(err)));
          process.send({op: "LANG_TEST_FAIL"});
        }
        else {
          debug("LANG TEST PASS");
          process.send({op: "LANG_TEST_PASS"});
        }

        process.send({op: "QUEUE_READY", queue: rxLangObjQueue.length});

      });

    break;

    case "STATS":
      // console.log(chalkInfo("LANG ANAL STATS"
        // + " | OPTIONS: " + jsonPrint(m.options)
      // ));
      showStats(m.options);
    break;

    case "LANG_ANALIZE":
      rxLangObjQueue.push(m);
      console.log(chalkInfo("LANG_ANALIZE"
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


var wordCache = new NodeCache();


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

var statsObj = {};

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

// ==================================================================
// GOOGLE TRANSLATE
// ==================================================================
// var GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || "AIzaSyAo5FYOZGoZqPNEhGQdf_wofZrC_DHbOyc";
// var googleTranslate = require("google-translate")(GOOGLE_API_KEY);

// googleTranslate.translate("My name is Brandon", "es", function(err, translation) {
//   console.log(translation.translatedText);
//   // =>  Mi nombre es Brandon
// });

// ==================================================================
// DROPBOX
// ==================================================================

var DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR;

if (process.env.DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR !== undefined) {
  DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR = process.env.DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR + "/usa" ;
}
else {
  DROPBOX_DEFAULT_SEARCH_TERM_FILES_DIR = "/config/searchTerms/usa" ;
}

var DROPBOX_DEFAULT_SEARCH_TERMS_FILE = "defaultSearchTerms.txt";

var DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
var DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
var DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
var DROPBOX_LA_CONFIG_FILE = process.env.DROPBOX_LA_CONFIG_FILE || "languageAnalyzerConfig.json";
var DROPBOX_LA_STATS_FILE = process.env.DROPBOX_LA_STATS_FILE || "languageAnalyzerStats.json";

var dropboxConfigFolder = "/config/utility";
var dropboxConfigFile = hostname + "_" + DROPBOX_LA_CONFIG_FILE;
var statsFolder = "/stats/" + hostname;
var statsFile = DROPBOX_LA_STATS_FILE;

console.log("DROPBOX_LA_CONFIG_FILE: " + DROPBOX_LA_CONFIG_FILE);
console.log("DROPBOX_LA_STATS_FILE : " + DROPBOX_LA_STATS_FILE);

debug("dropboxConfigFolder : " + dropboxConfigFolder);
debug("dropboxConfigFile : " + dropboxConfigFile);

debug("statsFolder : " + statsFolder);
debug("statsFile : " + statsFile);

console.log("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
console.log("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
console.log("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

var dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });

function getTimeStamp(inputTime) {
  var currentTimeStamp ;

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
      console.error(chalkError(moment().format(defaultDateTimeFormat) 
        + " | !!! ERROR DROBOX JSON WRITE | FILE: " + fullPath 
        + " | ERROR: " + errorText
        // + "\nERROR: " + error.error
      ));
      callback(errorText, null);
    });
}

function loadFile(path, file, callback) {

  debug(chalkInfo("LOAD FOLDER " + path));
  debug(chalkInfo("LOAD FILE " + file));
  debug(chalkInfo("FULL PATH " + path + "/" + file));

  var fileExists = false;

  dropboxClient.filesListFolder({path: path})
    .then(function(response) {

        async.each(response.entries, function(folderFile, cb) {

          debug("FOUND FILE " + folderFile.name);

          if (folderFile.name === file) {
            debug(chalkRedBold("SOURCE FILE EXISTS: " + path + "/" + file));
            fileExists = true;
          }

          cb();

        }, function(err) {

          if (err) {
            console.log(chalkError("ERR\n" + jsonPrint(err)));
            return(callback(err, null));
          }

          if (fileExists) {

            dropboxClient.filesDownload({path: path + "/" + file})
              .then(function(data) {
                console.log(chalkLog(getTimeStamp()
                  + " | LOADING FILE FROM DROPBOX: " + path + "/" + file
                ));

                var payload = data.fileBinary;
                debug(payload);

                if (file.match(/\.json$/gi)) {
                  var fileObj = JSON.parse(payload);
                  return(callback(null, fileObj));
                }
                else {
                  return(callback(null, payload));
                }

              })
              .catch(function(error) {
                console.log(chalkAlert("DROPBOX loadFile ERROR: " + file + "\n" + error));
                console.log(chalkError("!!! DROPBOX READ " + file + " ERROR"));
                console.log(chalkError(jsonPrint(error)));

                if (error.status === 404) {
                  console.error(chalkError("!!! DROPBOX READ FILE " + file + " NOT FOUND ... SKIPPING ..."));
                  return(callback(null, null));
                }
                if (error.status === 0) {
                  console.error(chalkError("!!! DROPBOX NO RESPONSE ... NO INTERNET CONNECTION? ... SKIPPING ..."));
                  return(callback(null, null));
                }
                return(callback(error, null));
              });
          }
          else {
            console.log(chalkError("*** FILE DOES NOT EXIST: " + path + "/" + file));
            return(callback({status: 404}, null));
          }
        });
    })
    .catch(function(err) {
      console.log(chalkError("*** ERROR DROPBOX LOAD FILE\n" + err));
      callback(err, null);
    });
}

function initStatsUpdate(cnf, callback){

  clearInterval(statsUpdateInterval);

  console.log(chalkInfo("initStatsUpdate | INTERVAL: " + cnf.statsUpdateIntervalTime));

  statsUpdateInterval = setInterval(function () {

    if (analyzeLanguageReady && (rxLangObjQueue.length == 0)) {
      process.send({op: "IDLE", queue: rxLangObjQueue.length});
    }

    statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTime);
    statsObj.timeStamp = moment().format(defaultDateTimeFormat);

    saveFile(statsFolder, statsFile, statsObj, function(){
      // showStats();
    });

  }, cnf.statsUpdateIntervalTime);

  return(callback(null, cnf));

}

function initialize(cnf, callback){

  if (debug.enabled || debugCache.enabled || debugQ.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = process.env.LA_PROCESS_NAME || "languageAnalyzer";

  cnf.verbose = process.env.LA_VERBOSE_MODE || false ;
  cnf.globalTestMode = process.env.LA_GLOBAL_TEST_MODE || false ;
  cnf.testMode = process.env.LA_TEST_MODE || false ;
  cnf.quitOnError = process.env.LA_QUIT_ON_ERROR || false ;
  cnf.targetServer = process.env.LA_UTIL_TARGET_SERVER || "http://localhost:9997/util" ;

  cnf.statsUpdateIntervalTime = process.env.LA_STATS_UPDATE_INTERVAL || 60000;

  debug("CONFIG\n" + jsonPrint(cnf));

  debug(chalkWarn("dropboxConfigFolder: " + dropboxConfigFolder));
  debug(chalkWarn("dropboxConfigFile  : " + dropboxConfigFile));

  callback(null, cnf);
}

function initAnalyzeLanguageInterval(interval){

  clearInterval(initAnalyzeLanguageInterval);

  console.log(chalkConnect("START LANGUAGE ANALYZER INTERVAL"
    + " | INTERVAL: " + interval + " ms"
  ));

  analyzeLanguageRunning = true;
  analyzeLanguageReady = true;

  analyzeLanguageInterval = setInterval(function(){ // TX KEEPALIVE

    if ((rxLangObjQueue.length > 0) && analyzeLanguageReady) {

      analyzeLanguageReady = false;

      var langObj = rxLangObjQueue.shift();

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
          statsObj.analyzer.total++;
          statsObj.analyzer.analyzed++;
          statsObj.analyzer.errors++;
          if (err.code === 3) {
            console.log(chalkAlert("[RXLQ: " + rxLangObjQueue.length + "]"
              + " | UNSUPPORTED LANG"
              + " | " + err
            ));
          }
          else if (err.code === 8) {
            console.error(chalkAlert("[RXLQ: " + rxLangObjQueue.length + "]"
              + " | LANGUAGE QUOTA"
              + " | " + err
              // + "\n" + jsonPrint(err)
            ));
          }
          else {
            console.error(chalkError("[RXLQ: " + rxLangObjQueue.length + "]"
              + " | LANGUAGE TEXT ERROR"
              + " | " + err
              + "\n" + jsonPrint(err)
            ));
          }

          let messageObj = {};
          messageObj.op = "LANG_RESULTS";
          messageObj.obj = {};
          messageObj.obj = langObj.obj;
          messageObj.error = err;
          messageObj.results = {};
          messageObj.results = results;

          process.send(messageObj, function(){
            debug(chalkInfo("SENT LANG_RESULTS"));
            analyzeLanguageReady = true;
            if (rxLangObjQueue.length === 0){
              process.send({op: "IDLE", queue: rxLangObjQueue.length});
            }
          });

        }
        else {

          statsObj.analyzer.total++;
          statsObj.analyzer.analyzed++;

          debug(chalkLog("LANGUAGE RESULTS\n" + jsonPrint(results)));

          console.log(chalkInfo("\nLANG RESULTS\n[RXLQ: " + rxLangObjQueue.length + "]"
            // + " | MAG: " + 10*results.sentiment.magnitude.toFixed(1)
            + " | M: " + 10*results.sentiment.magnitude.toFixed(2)
            + " | S: " + 10*results.sentiment.score.toFixed(1)
            + " | C: " + results.sentiment.comp.toFixed(2)
            + "\nTEXT: " + results.text + "\n"
            // + "\n" + jsonPrint(langObj.obj)
          ));

          let messageObj = {};
          messageObj.op = "LANG_RESULTS";
          messageObj.obj = {};
          messageObj.obj = langObj.obj;
          messageObj.results = {};
          messageObj.results = results;

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

      var rxWordObj = rxWordQueue.shift();

      debug(chalkLog("RXWQ< | " + rxWordObj.wordCacheIndex));

      wordCache.get(rxWordObj.wordCacheIndex, function(err, wordObj){
        if (err) {
          console.log(chalkInfo("WORD CACHE ERROR"
            + " | " + wordObj.wordCacheIndex
            + "\n" + jsonPrint(err)
          ));
          analyzeLanguageReady = true;
        }
        else if (wordObj) {
          console.log(chalkLog("WORD CACHE HIT ... SKIP | " + wordObj.wordCacheIndex));
          analyzeLanguageReady = true;
          statsObj.analyzer.total++;
          statsObj.analyzer.skipped++;
        }
        else {
          debug(chalkLog("WORD CACHE MISS | " + rxWordObj.wordCacheIndex));

          var wordObj = {};
          wordObj = rxWordObj;
          wordObj.sentiment = {};

          analyzeLanguage({text: wordObj.wordCacheIndex}, function(err, results){

            analyzeLanguageReady = true;
            if (err){
              statsObj.analyzer.total++;
              statsObj.analyzer.errors++;
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
              statsObj.analyzer.total++;
              statsObj.analyzer.analyzed++;
              wordObj.sentiment = results.sentiment;
              wordCache.set(wordObj.wordCacheIndex, wordObj);
              // console.log(chalkLog("LANGUAGE RESULTS\n" + jsonPrint(results)));
              console.log(chalkInfo(
                "MAG: " + 10*results.sentiment.magnitude.toFixed(1)
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

function analyzeLanguage(langObj, callback){

  debug(chalkAlert("analyzeLanguage\n" + jsonPrint(langObj)));

  var document = languageClient.document(langObj.text);
  var comp;

  var results = {};
  results.text = langObj.text;
  results.sentiment = {};
  results.entities = {};

  document.annotate(function(err, annotations) {
    if (err) {
      debug(chalkRed("LANGUAGE ERROR: " + err));
      if (callback !== undefined) { callback(err, results); }
    }
    else {

      results.sentiment.score = annotations.sentiment.score;
      results.sentiment.magnitude = annotations.sentiment.magnitude;
      results.sentiment.comp = 100*annotations.sentiment.score*annotations.sentiment.magnitude;

      debug(chalkRed(
        "M: " + 10*annotations.sentiment.magnitude.toFixed(1)
        + " | S: " + 10*annotations.sentiment.score.toFixed(1)
        + " | C: " + results.sentiment.comp.toFixed(2)
        + " | KWs: " + jsonPrint(results.keywords)
        + " | " + langObj.text
      ));
      
      async.each(annotations.entities, function(entity, cb){

        async.each(entity.mentions, function(mention, cb2){

          debugLang(chalkRed("ENTITY"
            + " | TYPE: " + entity.type + " - " + mention.type
            + " | SAL: " + entity.salience.toFixed(1)
            + " | " + entity.name
          ));

          if (mention.type === "PROPER") {
            if (entity.metadata.wikipedia_url !== undefined) {
              console.log(chalkInfo("ENTITY"
                + " | " + entity.type + " - " + mention.type
                + " | SAL: " + entity.salience.toFixed(1)
                + " | WIKI: " + entity.metadata.wikipedia_url
                + " | " + entity.name
              ));
            }
            else {
              console.log(chalkLog("ENTITY"
                + " | " + entity.type + " - " + mention.type
                + " | SAL: " + entity.salience.toFixed(1)
                + " | " + entity.name
              ));
            }
          }

          results.entities[entity.name.toLowerCase()] = entity;

          cb2();

        }, function(err){
          cb();
        });

      }, function(err){
        if (callback !== undefined) { callback(null, results); }
      });
    }
  });
}

configEvents.on("newListener", function(data){
  console.log(chalkInfo("*** NEW CONFIG EVENT LISTENER: " + data));
});

configEvents.on("removeListener", function(data){
  console.log(chalkInfo("*** REMOVED CONFIG EVENT LISTENER: " + data));
});


var initCompleteInterval;

setTimeout(function(){

  initialize(configuration, function(err, cnf){

    if (err && (err.status !== 404)) {
      console.error(chalkError("***** INIT ERROR *****\n" + jsonPrint(err)));
      // if (err.status !== 404){
      //   console.log("err.status: " + err.status);
        quit();
      // }
    }

    console.log(chalkAlert(cnf.processName + " STARTED " + getTimeStamp() + "\n"));

    initStatsUpdate(cnf, function(){
    });
  });
}, 1 * ONE_SECOND);


