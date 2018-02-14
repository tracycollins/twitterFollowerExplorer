 /*jslint node: true */
"use strict";

const ONE_SECOND = 1000 ;
const ONE_MINUTE = ONE_SECOND*60 ;

const DEFAULT_DROPBOX_TIMEOUT = 30 * ONE_SECOND;

const moment = require("moment");

const table = require("text-table");
const arrayUnique = require("array-unique");
const fs = require("fs");


require("isomorphic-fetch");
const Dropbox = require("dropbox").Dropbox;
// const Dropbox = require("./js/dropbox").Dropbox;

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

statsObj.runId = "TEST";

statsObj.elapsed = msToTime(moment().valueOf() - statsObj.startTimeMoment.valueOf());

let configuration = {};
configuration.testMode = false;
configuration.keepaliveInterval = 1*ONE_MINUTE+1;
configuration.quitOnComplete = true;

const async = require("async");
const sortOn = require("sort-on");

const chalk = require("chalk");
const chalkNetwork = chalk.blue;
const chalkTwitter = chalk.blue;
const chalkTwitterBold = chalk.bold.blue;
const chalkRed = chalk.red;
const chalkBlue = chalk.blue;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkWarn = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const debug = require("debug")("dbpoll");


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


const cla = require("command-line-args");
const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};

const optionDefinitions = [enableStdin, quitOnError, quitOnComplete, testMode];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));

process.title = "dropboxCursorPollTest";
console.log("\n\n=================================");
console.log("HOST:          " + hostname);
console.log("PROCESS TITLE: " + process.title);
console.log("PROCESS ID:    " + process.pid);
console.log("RUN ID:        " + statsObj.runId);
console.log("PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("=================================");

process.on("exit", function() {
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    setTimeout(function() {
      console.log("QUITTING");
      process.exit(0);
    }, 300);

  }
});


// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_WORD_ASSO_ACCESS_TOKEN = process.env.DROPBOX_WORD_ASSO_ACCESS_TOKEN ;
const DROPBOX_WORD_ASSO_APP_KEY = process.env.DROPBOX_WORD_ASSO_APP_KEY ;
const DROPBOX_WORD_ASSO_APP_SECRET = process.env.DROPBOX_WORD_ASSO_APP_SECRET;
const DROPBOX_TEST_CONFIG_FILE = process.env.DROPBOX_TEST_CONFIG_FILE || "testConfig.json";
const DROPBOX_TEST_STATS_FILE = process.env.DROPBOX_TEST_STATS_FILE || "testStats.json";

let dropboxConfigHostFolder = "/config/utility/" + hostname;
let dropboxConfigDefaultFolder = "/config/utility/default";

let dropboxConfigFile = hostname + "_" + DROPBOX_TEST_CONFIG_FILE;
let statsFolder = "/stats/" + hostname + "/test";
let statsFile = "testStats.json";

console.log("DROPBOX_TEST_CONFIG_FILE: " + DROPBOX_TEST_CONFIG_FILE);
console.log("DROPBOX_TEST_STATS_FILE : " + DROPBOX_TEST_STATS_FILE);
console.log("statsFolder : " + statsFolder);
console.log("statsFile : " + statsFile);

debug("DROPBOX_WORD_ASSO_ACCESS_TOKEN :" + DROPBOX_WORD_ASSO_ACCESS_TOKEN);
debug("DROPBOX_WORD_ASSO_APP_KEY :" + DROPBOX_WORD_ASSO_APP_KEY);
debug("DROPBOX_WORD_ASSO_APP_SECRET :" + DROPBOX_WORD_ASSO_APP_SECRET);

const dropboxClient = new Dropbox({ accessToken: DROPBOX_WORD_ASSO_ACCESS_TOKEN });


function quit(cause){
  console.log( "\n... QUITTING ..." );
  if (cause) {
    console.log( "CAUSE: " + cause );
  }

  process.exit();
}

process.on( "SIGINT", function() {
  quit("SIGINT");
});

process.on("exit", function() {
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

let saveFileQueueInterval;
let saveFileBusy = false;

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

      let payload = data.fileBinary;
      debug(payload);

      if (file.match(/\.json$/gi)) {
        try {
          let fileObj = JSON.parse(payload);
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
      case "q":
      case "Q":
        quit();
      break;
      default:
        console.log(
          "\n" + "q/Q: quit"
          );
    }
  });
}

function initialize(cnf, callback){

  if (debug.enabled){
    console.log("\n%%%%%%%%%%%%%%\n DEBUG ENABLED \n%%%%%%%%%%%%%%\n");
  }

  cnf.processName = "dropboxCursorPollTest";

  callback(null, cnf);

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


function dropboxLongpoll(last_cursor, callback) {
  dropboxClient.filesListFolderLongpoll({cursor: last_cursor, timeout: 30})
    .then((result) => {
      // console.log(chalkAlert("dropboxLongpoll FOLDER: " + lastCursorTruncated + "\n" + jsonPrint(result)));
      callback(null, result);
    })
    .catch((err) => {
      console.log(err);
      callback(err, null);
    });
}

function dropboxFolderGetLastestCursor(folder, callback) {

  let lastCursorTruncated = "";

  debug(chalkLog("dropboxFolderGetLastestCursor FOLDER: " + folder));

    let optionsGetLatestCursor = {
      path: folder,
      recursive: true,
      include_media_info: false,
      include_deleted: true,
      include_has_explicit_shared_members: false
    };

    dropboxClient.filesListFolderGetLatestCursor(optionsGetLatestCursor)
    .then((last_cursor) => {

      lastCursorTruncated = last_cursor.cursor.substring(0,20);

      debug(chalkLog("lastCursorTruncated: " + lastCursorTruncated));

      dropboxLongpoll(last_cursor.cursor, function(err, results){

        debug(chalkInfo("dropboxLongpoll CURSOR: " + lastCursorTruncated + "| CHANGES: " + results.changes));

        if (results.changes) {

          dropboxClient.filesListFolderContinue({ cursor: last_cursor.cursor})
          .then(function(response){
            debug(chalkLog("filesListFolderContinue: " + jsonPrint(response)));
            if (response.entries.length > 0) {
              console.log(chalkAlert(">>> DROPBOX CHANGE"
                + " | " + getTimeStamp()
                + " | FOLDER: " + folder
              ));
              response.entries.forEach(function(entry){
                console.log(chalkAlert("ENTRY"
                  + " | TYPE: " + entry[".tag"]
                  + " | PATH: " + entry.path_lower
                  + " | NAME: " + entry.name
                ));
              });
            }
            callback(null, response);
          })
          .catch(function(err){
            console.log(chalkError("dropboxFolderGetLastestCursor filesListFolder *** DROPBOX FILES LIST FOLDER ERROR"
              + "\nERROR: " + err 
              + "\nERROR: " + jsonPrint(err)
            ));
            callback(err, last_cursor.cursor);
          });
        }
        else {
          console.log(chalkLog("... FOLDER NO CHANGE | " + folder));
          callback(null, null);
        }
      });

    })
    .catch((err) => {
      console.log(err);
      callback(err, folder);
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

  let dropboxFolderGetLastestCursorInterval;
  let dropboxFolderGetLastestCursorReady = true;

  dropboxFolderGetLastestCursorInterval = setInterval(function(){
    console.log(chalkInfo(getTimeStamp() + " | INTERVAL | READY: " + dropboxFolderGetLastestCursorReady));
    if (dropboxFolderGetLastestCursorReady) {
      dropboxFolderGetLastestCursorReady = false;
      dropboxFolderGetLastestCursor("/config/test", function(err){
        dropboxFolderGetLastestCursorReady = true;
      });
    }
  }, 1000);

  console.log(chalkTwitter(cnf.processName 
    + " STARTED " + getTimeStamp() 
    // + "\n" + jsonPrint(cnf)
  ));

});
