const MODULE_NAME = "unionBestInputSets";
const MODULE_ID_PREFIX = "UBI";

const ONE_SECOND = 1000;
const ONE_MINUTE = ONE_SECOND*60;

const ONE_KILOBYTE = 1024;
const ONE_MEGABYTE = 1024 * ONE_KILOBYTE;

const GLOBAL_TEST_MODE = false; // applies to parent and all children
const STATS_UPDATE_INTERVAL = ONE_MINUTE;

const DEFAULT_INPUTS_FILE_PREFIX = "inputs";
const SAVE_FILE_QUEUE_INTERVAL = 5*ONE_SECOND;
const QUIT_WAIT_INTERVAL = 5*ONE_SECOND;

let configuration = {};

configuration.inputsFilePrefix = DEFAULT_INPUTS_FILE_PREFIX;

configuration.testMode = GLOBAL_TEST_MODE;
configuration.statsUpdateIntervalTime = STATS_UPDATE_INTERVAL;

configuration.saveFileQueueInterval = SAVE_FILE_QUEUE_INTERVAL;
configuration.keepaliveInterval = Number(ONE_MINUTE)+1;
configuration.quitOnComplete = true;

const os = require("os");

let hostname = os.hostname();
hostname = hostname.replace(/.local/g, "");
hostname = hostname.replace(/.home/g, "");
hostname = hostname.replace(/.at.net/g, "");
hostname = hostname.replace(/.fios-router.home/g, "");
hostname = hostname.replace(/word0-instance-1/g, "google");
hostname = hostname.replace(/word-1/g, "google");
hostname = hostname.replace(/word/g, "google");

const MODULE_ID = MODULE_ID_PREFIX + "_node_" + hostname;

let DROPBOX_ROOT_FOLDER;

const defaultUnionInputsConfigFile = "default_unionInputsConfig.json";
const defaultBestInputsConfigFile = "default_bestInputsConfig.json";

if (hostname === "google") {
  DROPBOX_ROOT_FOLDER = "/home/tc/Dropbox/Apps/wordAssociation";
}
else {
  DROPBOX_ROOT_FOLDER = "/Users/tc/Dropbox/Apps/wordAssociation";
}

const moment = require("moment");

let defaultConfiguration = {}; // general configuration for UBI
let hostConfiguration = {}; // host-specific configuration for UBI

const DEFAULT_INPUT_TYPES = [
  "emoji", 
  "friends", 
  "hashtags",  
  "images", 
  "locations", 
  "media", 
  "mentions", 
  "places", 
  "sentiment", 
  "urls", 
  "userMentions", 
  "words"
];

DEFAULT_INPUT_TYPES.sort();

const tcuChildName = MODULE_ID_PREFIX + "_TCU";
const ThreeceeUtilities = require("@threeceelabs/threecee-utilities");
const tcUtils = new ThreeceeUtilities(tcuChildName);
const jsonPrint = tcUtils.jsonPrint;
const msToTime = tcUtils.msToTime;
const getTimeStamp = tcUtils.getTimeStamp;

global.dbConnection = false;
const mongoose = require("mongoose");
mongoose.Promise = global.Promise;
mongoose.set("useFindAndModify", false);

global.wordAssoDb = require("@threeceelabs/mongoose-twitter");
let dbConnection;

const compactDateTimeFormat = "YYYYMMDD_HHmmss";

const merge = require("deepmerge");
const util = require("util");
const _ = require("lodash");
const async = require("async");
const debug = require("debug")("ubi");
const NodeCache = require("node-cache");
const deepcopy = require("deep-copy");
const path = require("path");

const chalk = require("chalk");
const chalkBlue = chalk.blue;
const chalkBlueBold = chalk.bold.blue;
const chalkGreen = chalk.green;
const chalkError = chalk.bold.red;
const chalkAlert = chalk.red;
const chalkLog = chalk.gray;
const chalkInfo = chalk.black;

const watch = require("watch");

const watchOptions = {
  ignoreDotFiles: true,
  ignoreUnreadableDir: true,
  ignoreNotPermitted: true,
}

async function initWatchConfig(){

  statsObj.status = "INIT WATCH CONFIG";

  console.log(chalkLog(MODULE_ID_PREFIX + " | ... INIT WATCH"));

  const loadConfig = async function(f){

    try{

      console.log(chalkInfo(MODULE_ID_PREFIX + " | +++ FILE CREATED or CHANGED | " + getTimeStamp() + " | " + f));

      if (f.endsWith("unionBestInputSetsConfig.json")){

        await loadAllConfigFiles();

        const configArgs = Object.keys(configuration);

        for (const arg of configArgs){
          if (_.isObject(configuration[arg])) {
            console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
          }
          else {
            console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
          }
        }
      }

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** LOAD ALL CONFIGS ON CREATE ERROR: " + err));
    }
  }

  watch.createMonitor(configDefaultFolder, watchOptions, function (monitor) {

    monitor.on("created", loadConfig);

    monitor.on("changed", loadConfig);

    monitor.on("removed", function (f) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });
  });

  watch.createMonitor(configHostFolder, watchOptions, function (monitor) {

    monitor.on("created", loadConfig);

    monitor.on("changed", loadConfig);

    monitor.on("removed", function (f) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | XXX FILE DELETED | " + getTimeStamp() + " | " + f));
    });
  });

  return;
}

//=========================================================================
// SLACK
//=========================================================================

const slackChannel = "ubi";
const HashMap = require("hashmap").HashMap;
const channelsHashMap = new HashMap();

const slackOAuthAccessToken = "xoxp-3708084981-3708084993-206468961315-ec62db5792cd55071a51c544acf0da55";
const slackConversationId = "D65CSAELX"; // wordbot
const slackRtmToken = "xoxb-209434353623-bNIoT4Dxu1vv8JZNgu7CDliy";

let slackRtmClient;
let slackWebClient;
const { WebClient } = require("@slack/client");
const { RTMClient } = require("@slack/client");

function slackSendRtmMessage(msg){

  return new Promise(async function(resolve, reject){

    try {
      console.log(chalkBlue("UBI | SLACK RTM | SEND: " + msg));
      const sendResponse = await slackRtmClient.sendMessage(msg, slackConversationId);

      console.log(chalkLog("UBI | SLACK RTM | >T\n" + jsonPrint(sendResponse)));
      resolve(sendResponse);
    }
    catch(err){
      reject(err);
    }

  });
}

function slackSendWebMessage(msgObj){

  return new Promise(async function(resolve, reject){

    try {

      const token = msgObj.token || slackOAuthAccessToken;
      const channel = msgObj.channel || configuration.slackChannel.id;
      const text = msgObj.text || msgObj;

      const message = {
        token: token, 
        channel: channel,
        text: text
      };

      if (msgObj.attachments !== undefined) {
        message.attachments = msgObj.attachments;
      }

      console.log(chalkBlue("UBI | SLACK WEB | SEND\n" + jsonPrint(message)));
      slackWebClient.chat.postMessage(message);
      resolve();
    }
    catch(err){
      reject(err);
    }

  });
}

function slackMessageHandler(message){
  return new Promise(async function(resolve, reject){

    try {

      console.log(chalkInfo("UBI | MESSAGE | " + message.type + " | " + message.text));

      if (message.type !== "message") {
        console.log(chalkAlert("Unhandled MESSAGE TYPE: " + message.type));
        return resolve();
      }

      const text = message.text.trim();
      const textArray = text.split("|");

      // console.log(chalkAlert("textArray: " + textArray));

      const sourceMessage = (textArray[2]) ? textArray[2].trim() : "NONE";

      switch (sourceMessage) {
        case "END FETCH ALL":
        case "ERROR":
        case "FETCH FRIENDS":
        case "FSM INIT":
        case "FSM FETCH_ALL":
        case "GEN AUTO CAT":
        case "INIT CHILD":
        case "INIT LANG ANALYZER":
        case "INIT MAX INPUT HASHMAP":
        case "INIT NNs":
        case "INIT RAN NNs":
        case "INIT RNT CHILD":
        case "INIT TWITTER USERS":
        case "INIT TWITTER":
        case "INIT UNFOLLOWABLE USER SET":
        case "INIT UNFOLLOWABLE":
        case "INIT":
        case "LOAD BEST NN":
        case "LOAD NN":
        case "MONGO DB CONNECTED":
        case "PONG":
        case "QUIT":
        case "QUITTING":
        case "READY":
        case "RESET":
        case "SAV NN HASHMAP":
        case "SLACK QUIT":
        case "SLACK READY":
        case "SLACK RTM READY":
        case "START":
        case "STATS":
        case "TEXT":
        case "UPDATE HISTOGRAMS":
        case "UPDATE NN STATS":
        case "WAIT UPDATE STATS":
        case "END UPDATE STATS":
        case "UPDATE USER CAT STATS":
          resolve();
        break;
        case "STATSUS":
          console.log(chalkInfo(message.text));
          resolve();
        break;
        case "PING":
          await slackSendWebMessage(hostname + " | UBI | PONG");
          resolve();
        break;
        case "NONE":
          resolve();
        break;
        default:
          console.log(chalkAlert("UBI | *** UNDEFINED SLACK MESSAGE: " + message.text));
          // reject(new Error("UNDEFINED SLACK MESSAGE TYPE: " + message.text));
          resolve({text: "UNDEFINED SLACK MESSAGE", message: message});
      }
    }
    catch(err){
      reject(err);
    }

  });
}

function initSlackWebClient(){

  return new Promise(async function(resolve, reject){

    try {

      // const { WebClient } = require("@slack/client");
      slackWebClient = new WebClient(slackRtmToken);

      const testResponse = await slackWebClient.api.test();
      if (configuration.verbose) {
        console.log("UBI | SLACK WEB TEST RESPONSE\n" + jsonPrint(testResponse));
      }

      const botsInfoResponse = await slackWebClient.bots.info();
      debug("UBI | SLACK WEB BOTS INFO RESPONSE\n" + jsonPrint(botsInfoResponse));

      const conversationsListResponse = await slackWebClient.conversations.list({token: slackOAuthAccessToken});

      conversationsListResponse.channels.forEach(async function(channel){
  
        debug(chalkLog("UBI | CHANNEL | " + channel.id + " | " + channel.name));

        if (channel.name === slackChannel) {
          configuration.slackChannel = channel;

          const message = {
            token: slackOAuthAccessToken, 
            channel: configuration.slackChannel.id,
            text: "OP"
          };

          message.attachments = [];
          message.attachments.push({
            text: "INIT", 
            fields: [ 
              { title: "SRC", value: hostname + "_" + process.pid }, 
              { title: "MOD", value: MODULE_NAME }, 
              { title: "DST", value: "ALL" } 
            ]
          });

          const chatPostMessageResponse = await slackWebClient.chat.postMessage(message);
          if (configuration.verbose) {
            console.log("UBI | SLACK WEB CHAT POST MESSAGE RESPONSE\n" + jsonPrint(chatPostMessageResponse));
          }

        }

        channelsHashMap.set(channel.id, channel);

      });

      resolve();

    }
    catch(err){
      console.log(chalkError("UBI | *** INIT SLACK WEB CLIENT ERROR: " + err));
      reject(err);
    }

  });
}

function initSlackRtmClient(){

  return new Promise(async function(resolve, reject){

    try {

      slackRtmClient = new RTMClient(slackRtmToken);

      const slackInfo = await slackRtmClient.start();

      if (configuration.verbose) {
        console.log(chalkInfo("UBI | SLACK RTM | INFO\n" + jsonPrint(slackInfo)));
      }

      slackRtmClient.on("slack_event", async function(eventType, event){
        switch (eventType) {
          case "pong":
            debug(chalkLog("UBI | SLACK RTM PONG | " + getTimeStamp() + " | " + event.reply_to));
          break;
          default: debug(chalkInfo("UBI | SLACK RTM EVENT | " + getTimeStamp() + " | " + eventType + "\n" + jsonPrint(event)));
        }
      });


      slackRtmClient.on("message", async function(message){
        if (configuration.verbose) { console.log(chalkLog("UBI | RTM R<\n" + jsonPrint(message))); }
        debug(`UBI | SLACK RTM MESSAGE | R< | CH: ${message.channel} | USER: ${message.user} | ${message.text}`);

        try {
          await slackMessageHandler(message);
        }
        catch(err){
          console.log(chalkError("UBI | *** SLACK RTM MESSAGE ERROR: " + err));
        }

      });

      slackRtmClient.on("ready", async function(){
        try {
          if (configuration.verbose) { slackSendRtmMessage(hostname + " | UBI | SLACK RTM READY"); }
          resolve();
        }
        catch(err){
          reject(err);
        }
      });


    }
    catch(err){
      console.log(chalkError("UBI | *** INIT SLACK RTM CLIENT | " + err));
      reject(err);
    }

  });
}

const saveFileQueue = [];
let saveFileQueueInterval;

const newInputsObj = {};
newInputsObj.inputsId = ""; // will be generated after number of inputs determined
newInputsObj.meta = {};
newInputsObj.meta.type = {};
newInputsObj.meta.parents = [];
newInputsObj.meta.numInputs = 0;
newInputsObj.inputs = {};

let stdin;

const inputsIdSet = new Set();

// ==================================================================
// DROPBOX
// ==================================================================
const DROPBOX_MAX_FILE_UPLOAD = 140 * ONE_MEGABYTE; // bytes

configuration.dropboxMaxFileUpload = DROPBOX_MAX_FILE_UPLOAD;

configuration.DROPBOX = {};

configuration.DROPBOX.DROPBOX_CONFIG_FILE = process.env.DROPBOX_CONFIG_FILE || MODULE_NAME + "Config.json";
configuration.DROPBOX.DROPBOX_STATS_FILE = process.env.DROPBOX_STATS_FILE || MODULE_NAME + "Stats.json";

const configDefaultFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility/default");
const configHostFolder = path.join(DROPBOX_ROOT_FOLDER, "config/utility",hostname);

const configDefaultFile = "default_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;
const configHostFile = hostname + "_" + configuration.DROPBOX.DROPBOX_CONFIG_FILE;

const defaultInputsFolder = path.join(configDefaultFolder, "inputs");

const statsFolder = path.join(DROPBOX_ROOT_FOLDER, "stats",hostname);
const statsFile = configuration.DROPBOX.DROPBOX_STATS_FILE;

const statsObj = {};
statsObj.hostname = hostname;
statsObj.startTimeMoment = moment();
statsObj.pid = process.pid;
statsObj.userAuthenticated = false;
statsObj.serverConnected = false;
statsObj.heartbeatsReceived = 0;
statsObj.queues = {};
statsObj.queues.saveFileQueue = {};
statsObj.queues.saveFileQueue.size = 0;

const UBI_RUN_ID = hostname 
  + "_" + statsObj.startTimeMoment.format(compactDateTimeFormat)
  + "_" + process.pid;

statsObj.runId = UBI_RUN_ID;

statsObj.elapsed = 0;

const histograms = {};

DEFAULT_INPUT_TYPES.forEach(function(type){
  histograms[type] = {};
});

let statsUpdateInterval;

const cla = require("command-line-args");

const enableStdin = { name: "enableStdin", alias: "i", type: Boolean, defaultValue: true};
const quitOnComplete = { name: "quitOnComplete", alias: "Q", type: Boolean, defaultValue: false};
const quitOnError = { name: "quitOnError", alias: "q", type: Boolean, defaultValue: true};
const testMode = { name: "testMode", alias: "X", type: Boolean, defaultValue: false};

const optionDefinitions = [
  enableStdin, 
  quitOnComplete, 
  quitOnError, 
  testMode
];

const commandLineConfig = cla(optionDefinitions);

console.log(chalkInfo("UBI | COMMAND LINE CONFIG\n" + jsonPrint(commandLineConfig)));

console.log("UBI | COMMAND LINE OPTIONS\n" + jsonPrint(commandLineConfig));


process.title = "node_generateInputSets";
console.log("\n\nUBI | =================================");
console.log("UBI | HOST:          " + hostname);
console.log("UBI | PROCESS TITLE: " + process.title);
console.log("UBI | PROCESS ID:    " + process.pid);
console.log("UBI | RUN ID:        " + statsObj.runId);
console.log("UBI | PROCESS ARGS   " + util.inspect(process.argv, {showHidden: false, depth: 1}));
console.log("UBI | =================================");

process.on("exit", function() {
});

process.on("message", function(msg) {

  if ((msg === "SIGINT") || (msg === "shutdown")) {

    debug("\n\n!!!!! RECEIVED PM2 SHUTDOWN !!!!!\n\n***** Closing all connections *****\n\n");

    clearInterval(statsUpdateInterval);

    setTimeout(function() {
      showStats();
      console.log("UBI | QUITTING generateInputSets");
      process.exit(0);
    }, 300);

  }
});

function showStats(){

  statsObj.elapsed = moment().diff(statsObj.startTimeMoment);
  statsObj.timeStamp = moment().format(compactDateTimeFormat);

  console.log(chalkLog("\nUBI | STATS"
    + " | E: " + msToTime(statsObj.elapsed)
    + " | S: " + statsObj.startTimeMoment.format(compactDateTimeFormat)
  ));
}

const inputsDefault = function (inputsObj){
  return inputsObj;
};

function printInputsObj(title, iObj) {

  const inputsObj = inputsDefault(iObj);

  console.log(chalkBlue(title
    + " | " + inputsObj.inputsId
    + "\n" + jsonPrint(inputsObj.meta)
  ));
}

let netInputsIndex = 0;

async function unionInputSets(params) {

  console.log(chalkLog("UBI | UNION INPUT SET PAIR\n" + jsonPrint(params)));

  const newInputsObj = {};

  newInputsObj.meta = {};
  newInputsObj.meta.parents = [];
  newInputsObj.meta.type = {};
  newInputsObj.meta.numInputs = 0;
  newInputsObj.inputs = {};
  newInputsObj.inputsMinimum = {};

  for(const inputsId of params.parents) {

    console.log(chalkInfo("UBI | UNION INPUT SET PAIR PARENT: " + inputsId));

    let inputsObj = {};

    try{

      inputsObj = await global.wordAssoDb.NetworkInputs.findOne({inputsId: inputsId}).lean(true).exec();
      
      if (inputsObj) {
        console.log(chalkLog("UBI | UNION INPUT SET FOUND | " + inputsObj.inputsId));
      }
      else{
        console.log(chalkAlert("UBI | UNION INPUT SET NOT FOUND: " + inputsId));
        return(new Error("INPUT NOT FOUND: " + inputsId));
      }

      newInputsObj.meta.parents.push(inputsObj.inputsId);

      for (const type of Object.keys(inputsObj.inputs)){

        newInputsObj.inputs[type] = _.union(newInputsObj.inputs[type], inputsObj.inputs[type]).sort();

        if (newInputsObj.meta.type[type] === undefined) { newInputsObj.meta.type[type] = {}; }
        newInputsObj.meta.type[type].numInputs = newInputsObj.inputs[type].length;

        console.log(chalkLog("UBI | UNION INPUT SETS"
          + " | TYPE: " + type
          + " | PARENT " + inputsObj.inputs[type].length
          + " | CHILD " + newInputsObj.inputs[type].length
        ));

        if (newInputsObj.inputsMinimum[type] === undefined) { newInputsObj.inputsMinimum[type] = []; }
        newInputsObj.inputsMinimum[type] = [];

      }
    }
    catch(err){
      console.log(chalkError("UBI | UNION INPUT SETS ERROR: " + err));
      throw err;
    }

  }

  if (newInputsObj.meta.type === undefined) { throw new Error("newInputsObj.meta.type UNDEFINED | " + newInputsObj.inputsId); }

  for (const type in newInputsObj.meta.type){
    newInputsObj.meta.numInputs += newInputsObj.meta.type[type].numInputs;
  }

  newInputsObj.inputsId = configuration.inputsFilePrefix 
    + "_" + getTimeStamp() 
    + "_" + newInputsObj.meta.numInputs 
    + "_" + hostname 
    + "_" + process.pid
    + "_" + netInputsIndex
    + "_" + "union";

  netInputsIndex++;
  
  console.log(chalkBlue("UBI | NEW INPUT SETS"
    + " | " + newInputsObj.inputsId
    + " | " + newInputsObj.meta.numInputs + " INPUTS"
    // + "\n" + jsonPrint(newInputsObj.meta)
  ));

  const networkInputsDoc = new global.wordAssoDb.NetworkInputs(newInputsObj);

  try{
    const savedNetworkInputsDoc = await networkInputsDoc.save();

    printInputsObj("UBI | +++ SAVED NETWORK INPUTS DB DOCUMENT", savedNetworkInputsDoc);

    console.log(chalkInfo("UBI | ... SAVING INPUTS FILE: " + defaultInputsFolder + "/" + newInputsObj.inputsId + ".json"));

    saveFileQueue.push({folder: defaultInputsFolder, file: newInputsObj.inputsId + ".json", obj: newInputsObj});
    return newInputsObj;
  }
  catch(err){
    console.log(chalkError("UBI | *** CREATE NETWORK INPUTS DB DOCUMENT: " + err));
    throw err;
  }

}


//=========================================================================
// INTERVALS
//=========================================================================
const intervalsSet = new Set();

function clearAllIntervals(){
  return new Promise(function(resolve, reject){
    try {
      for (const intervalHandle of intervalsSet){
        console.log(chalkInfo(MODULE_ID_PREFIX + " | CLEAR INTERVAL | " + intervalHandle));
        clearInterval(intervalHandle);
      }
      resolve();
    }
    catch(err){
      reject(err);
    }
  });
}

let quitWaitInterval;
let quitFlag = false;

function readyToQuit() {
  const flag = ((saveCache.getStats().keys == 0) && (saveFileQueue.length == 0));
  return flag;
}

async function quit(opts) {

  if (quitFlag) {
    console.log(chalkInfo(MODULE_ID_PREFIX + " | ALREADY IN QUIT"));
    if (opts) {
      console.log(chalkInfo(MODULE_ID_PREFIX + " | REDUNDANT QUIT INFO\n" + jsonPrint(opts) ));
    }
    return;
  }

  quitFlag = true;

  const options = opts || false;

  statsObj.elapsed = getElapsedTimeStamp();
  statsObj.timeStamp = getTimeStamp();
  statsObj.status = "QUIT";

  const forceQuitFlag = options.force || false;

  let slackText = "QUIT";
  if (options) {
    slackText += " | " + options.cause;
  }

  try{
    if (!configuration.offlineMode) { await slackSendWebMessage({channel: slackChannel, text: slackText}); }
    // await childQuitAll();
    await showStats(true);
  }
  catch(err){
    console.log(MODULE_ID_PREFIX + " | *** QUIT ERROR: " + err);
  }


  if (options) {
    console.log(MODULE_ID_PREFIX + " | QUIT INFO\n" + jsonPrint(options) );
  }

  clearInterval(quitWaitInterval);

  await clearAllIntervals();

  // intervalsSet.add("quitWaitInterval");

  quitWaitInterval = setInterval(async function() {

    if (readyToQuit()) {

      clearInterval(quitWaitInterval);

      if (forceQuitFlag) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | *** FORCE QUIT"
          + " | SAVE CACHE KEYS: " + saveCache.getStats().keys
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }
      else {
        console.log(chalkGreen(MODULE_ID_PREFIX + " | ALL PROCESSES COMPLETE | QUITTING"
          + " | SAVE CACHE KEYS: " + saveCache.getStats().keys
          + " | SAVE FILE BUSY: " + statsObj.queues.saveFileQueue.busy
          + " | SAVE FILE Q: " + statsObj.queues.saveFileQueue.size
        ));
      }

      if (!dbConnection) {
        process.exit();
      }
      else {
        setTimeout(function() {

          dbConnection.close(async function () {
            console.log(chalkBlue(
                MODULE_ID_PREFIX + " | ==========================\n"
              + MODULE_ID_PREFIX + " | MONGO DB CONNECTION CLOSED\n"
              + MODULE_ID_PREFIX + " | ==========================\n"
            ));

            process.exit();
          });

        }, 1000);
      }

    }

  }, QUIT_WAIT_INTERVAL);
}

process.on( "SIGINT", function() {
  quit("SIGINT");
});

const saveCacheTtl = process.env.SAVE_CACHE_DEFAULT_TTL;
let saveCacheCheckPeriod = process.env.SAVE_CACHE_CHECK_PERIOD;

if (saveCacheCheckPeriod === undefined) { saveCacheCheckPeriod = 10; }

const saveCache = new NodeCache({
  stdTTL: saveCacheTtl,
  checkperiod: saveCacheCheckPeriod
});

function saveCacheExpired(file, fileObj) {
  debug(chalkLog("XXX $ SAVE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + file
  ));
  saveFileQueue.push(fileObj);
  statsObj.queues.saveFileQueue.size = saveFileQueue.length;
}

saveCache.on("expired", saveCacheExpired);

saveCache.on("set", function(file, fileObj) {
  debug(chalkLog(MODULE_ID_PREFIX + " | $$$ SAVE CACHE"
    + " [" + saveCache.getStats().keys + "]"
    + " | " + fileObj.folder + "/" + file
  ));
});

function initSaveFileQueue(cnf) {

  console.log(chalkLog(MODULE_ID_PREFIX + " | INIT SAVE FILE INTERVAL | " + msToTime(cnf.saveFileQueueInterval)));

  clearInterval(saveFileQueueInterval);

  saveFileQueueInterval = setInterval(async function () {

    if (!statsObj.queues.saveFileQueue.busy && saveFileQueue.length > 0) {

      statsObj.queues.saveFileQueue.busy = true;

      const saveFileObj = saveFileQueue.shift();
      saveFileObj.verbose = true;

      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try{
        await tcUtils.saveFile(saveFileObj);
        console.log(chalkLog(
          MODULE_ID_PREFIX 
          + " | SAVED FILE"
          + " [Q: " + saveFileQueue.length + "] " 
          + " [$: " + saveCache.getStats().keys + "] " 
          + saveFileObj.folder + "/" + saveFileObj.file
        ));
        statsObj.queues.saveFileQueue.busy = false;
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX 
          + " | *** SAVE FILE ERROR ... RETRY"
          + " | ERROR: " + err
          + " | " + saveFileObj.folder + "/" + saveFileObj.file
        ));
        saveFileQueue.push(saveFileObj);
        statsObj.queues.saveFileQueue.size = saveFileQueue.length;
        statsObj.queues.saveFileQueue.busy = false;
      }

    }
  }, cnf.saveFileQueueInterval);
}

async function connectDb(){

  try {

    statsObj.status = "CONNECTING MONGO DB";

    console.log(chalkBlueBold(MODULE_ID_PREFIX + " | CONNECT MONGO DB ..."));

    const db = await global.wordAssoDb.connect(MODULE_ID_PREFIX + "_" + process.pid);

    db.on("error", async function(err){
      statsObj.status = "MONGO ERROR";
      statsObj.dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION ERROR"));
      db.close();
      quit({cause: "MONGO DB ERROR: " + err});
    });

    db.on("close", async function(err){
      statsObj.status = "MONGO CLOSED";
      statsObj.dbConnectionReady = false;
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECTION CLOSED"));
      quit({cause: "MONGO DB CLOSED: " + err});
    });

    db.on("disconnected", async function(){
      statsObj.status = "MONGO DISCONNECTED";
      statsObj.dbConnectionReady = false;
      console.log(chalkAlert(MODULE_ID_PREFIX + " | *** MONGO DB DISCONNECTED"));
      quit({cause: "MONGO DB DISCONNECTED"});
    });

    console.log(chalk.green(MODULE_ID_PREFIX + " | MONGOOSE DEFAULT CONNECTION OPEN"));

    statsObj.dbConnectionReady = true;

    return db;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | *** MONGO DB CONNECT ERROR: " + err));
    throw err;
  }
}

function getElapsedTimeStamp(){
  statsObj.elapsedMS = moment().valueOf() - statsObj.startTimeMoment.valueOf();
  return msToTime(statsObj.elapsedMS);
}

function initStatsUpdate() {

  return new Promise(function(resolve){

    console.log(chalkLog(MODULE_ID_PREFIX + " | INIT STATS UPDATE INTERVAL | " + msToTime(configuration.statsUpdateIntervalTime)));

    statsObj.elapsed = getElapsedTimeStamp();
    statsObj.timeStamp = getTimeStamp();

    clearInterval(statsUpdateInterval);

    statsUpdateInterval = setInterval(async function () {

      statsObj.elapsed = getElapsedTimeStamp();
      statsObj.timeStamp = getTimeStamp();

      saveFileQueue.push({folder: statsFolder, file: statsFile, obj: statsObj});
      statsObj.queues.saveFileQueue.size = saveFileQueue.length;

      try{
        await showStats();
      }
      catch(err){
        console.log(chalkError(MODULE_ID_PREFIX + " | *** SHOW STATS ERROR: " + err));
      }
      
    }, configuration.statsUpdateIntervalTime);

    resolve();

  });
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

function loadCommandLineArgs(){

  return new Promise(function(resolve){

    statsObj.status = "LOAD COMMAND LINE ARGS";

    const commandLineConfigKeys = Object.keys(commandLineConfig);

    async.each(commandLineConfigKeys, function(arg, cb){

      if (arg === "evolveIterations"){
        configuration.evolve.iterations = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration.evolve.iterations);
      }
      else {
        configuration[arg] = commandLineConfig[arg];
        console.log(MODULE_ID_PREFIX + " | --> COMMAND LINE CONFIG | " + arg + ": " + configuration[arg]);
      }

      cb();

    }, function(){
      statsObj.commandLineArgsLoaded = true;
      resolve();
    });

  });
}

async function loadConfigFile(params) {

  let fullPath;

  try {

    fullPath = path.join(params.folder, params.file);

    if (configuration.offlineMode) {
      await loadCommandLineArgs();
      return;
    }

    const newConfiguration = {};
    newConfiguration.evolve = {};

    const loadedConfigObj = await tcUtils.loadFile({folder: params.folder, file: params.file, noErrorNotFound: params.noErrorNotFound });

    if (loadedConfigObj === undefined) {
      if (params.noErrorNotFound) {
        console.log(chalkAlert(MODULE_ID_PREFIX + " | ... SKIP LOAD CONFIG FILE: " + params.folder + "/" + params.file));
        return newConfiguration;
      }
      else {
        console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR | JSON UNDEFINED ??? "));
        throw new Error("JSON UNDEFINED");
      }
    }

    if (loadedConfigObj instanceof Error) {
      console.log(chalkError(MODULE_ID_PREFIX + " | *** DROPBOX CONFIG LOAD FILE ERROR: " + loadedConfigObj));
    }

    console.log(chalkInfo(MODULE_ID_PREFIX + " | LOADED CONFIG FILE: " + params.file + "\n" + jsonPrint(loadedConfigObj)));

    if (loadedConfigObj.UBI_INPUTS_FILE_PREFIX !== undefined){
      console.log("UBI | LOADED UBI_INPUTS_FILE_PREFIX: " + loadedConfigObj.UBI_INPUTS_FILE_PREFIX);
      newConfiguration.inputsFilePrefix = loadedConfigObj.UBI_INPUTS_FILE_PREFIX;
    }

    if (loadedConfigObj.UBI_TEST_MODE !== undefined){
      console.log("UBI | LOADED UBI_TEST_MODE: " + loadedConfigObj.UBI_TEST_MODE);
      newConfiguration.testMode = loadedConfigObj.UBI_TEST_MODE;
    }

    if (loadedConfigObj.UBI_QUIT_ON_COMPLETE !== undefined){
      console.log("UBI | LOADED UBI_QUIT_ON_COMPLETE: " + loadedConfigObj.UBI_QUIT_ON_COMPLETE);
      newConfiguration.quitOnComplete = loadedConfigObj.UBI_QUIT_ON_COMPLETE;
    }

    if (loadedConfigObj.UBI_ENABLE_STDIN !== undefined){
      console.log("UBI | LOADED UBI_ENABLE_STDIN: " + loadedConfigObj.UBI_ENABLE_STDIN);
      newConfiguration.enableStdin = loadedConfigObj.UBI_ENABLE_STDIN;
    }

    if (loadedConfigObj.UBI_KEEPALIVE_INTERVAL !== undefined) {
      console.log("UBI | LOADED UBI_KEEPALIVE_INTERVAL: " + loadedConfigObj.UBI_KEEPALIVE_INTERVAL);
      newConfiguration.keepaliveInterval = loadedConfigObj.UBI_KEEPALIVE_INTERVAL;
    }


    return newConfiguration;
  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | ERROR LOAD DROPBOX CONFIG: " + fullPath
      + "\n" + jsonPrint(err)
    ));
    throw err;
  }
}

async function loadAllConfigFiles(){

  statsObj.status = "LOAD CONFIG";

  const defaultConfig = await loadConfigFile({folder: configDefaultFolder, file: configDefaultFile, noErrorNotFound: true});

  if (defaultConfig) {
    defaultConfiguration = defaultConfig;
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED DEFAULT CONFIG " + configDefaultFolder + "/" + configDefaultFile));
  }
  
  const hostConfig = await loadConfigFile({folder: configHostFolder, file: configHostFile, noErrorNotFound: true});

  if (hostConfig) {
    hostConfiguration = hostConfig;
    console.log(chalkLog(MODULE_ID_PREFIX + " | +++ RELOADED HOST CONFIG " + configHostFolder + "/" + configHostFile));
  }
  
  const defaultAndHostConfig = merge(defaultConfiguration, hostConfiguration); // host settings override defaults
  const tempConfig = merge(configuration, defaultAndHostConfig); // any new settings override existing config

  configuration = tempConfig;

  return;
}

function loadInputsDropbox(params) {

  statsObj.status = "LOAD BEST BEST INPUTS CONFIG";

  return new Promise(async function(resolve, reject){

    const folder = params.folder;
    const file = params.file;

    console.log(chalkLog("UBI | LOADING DROPBOX BEST INPUTS CONFIG | " + folder + "/" + file + " ..."));

    try {

      const inputsConfigObj = await tcUtils.loadFile({folder: folder, file: file});

      if ((inputsConfigObj === undefined) || !inputsConfigObj) {
        console.log(chalkError("UBI | DROPBOX LOAD BEST INPUTS CONFIG FILE ERROR | JSON UNDEFINED ??? "));
        return reject(new Error("DROPBOX LOAD BEST INPUTS CONFIG FILE ERROR | JSON UNDEFINED"));
      }

      const tempInputsIdSet = new Set(inputsConfigObj.INPUTS_IDS);

      for (const inputsId of tempInputsIdSet) {
        inputsIdSet.add(inputsId);
      }

      console.log(chalkBlue("UBI | LOADED DROPBOX BEST INPUTS CONFIG"
        + "\nTFE | CURRENT FILE BEST INPUTS IDS SET: " + tempInputsIdSet.size + " BEST INPUTS IDS"
        + "\n" + jsonPrint([...tempInputsIdSet])
        + "\nTFE | FINAL BEST INPUTS IDS SET: " + inputsIdSet.size + " BEST INPUTS IDS"
        + "\n" + jsonPrint([...inputsIdSet])
      ));

      resolve();
    }
    catch(err){
      if ((err.status === 409) || (err.status === 404)) {
        console.log(chalkError("UBI | DROPBOX LOAD BEST INPUTS CONFIG FILE NOT FOUND"));
        return resolve();
      }
      console.log(chalkError("UBI | DROPBOX LOAD BEST INPUTS CONFIG FILE ERROR: ", err));
      return reject(err);
    }
  });
}

function initConfig(cnf) {

  return new Promise(async function(resolve, reject){

    statsObj.status = "INIT CONFIG";

    console.log(chalkBlue(MODULE_ID_PREFIX + " | INIT CONFIG"));

    if (debug.enabled) {
      console.log("\nUBI | %%%%%%%%%%%%%%\nUBI |  DEBUG ENABLED \nUBI | %%%%%%%%%%%%%%\n");
    }

    cnf.processName = process.env.PROCESS_NAME || MODULE_ID;
    cnf.testMode = (process.env.TEST_MODE === "true") ? true : cnf.testMode;
    cnf.quitOnError = process.env.QUIT_ON_ERROR || false;
    cnf.enableStdin = process.env.ENABLE_STDIN || true;

    if (process.env.QUIT_ON_COMPLETE === "false") { cnf.quitOnComplete = false; }
    else if ((process.env.QUIT_ON_COMPLETE === true) || (process.env.QUIT_ON_COMPLETE === "true")) {
      cnf.quitOnComplete = true;
    }

    try {

      await loadAllConfigFiles();
      await loadCommandLineArgs();
      await loadInputsDropbox({folder: configDefaultFolder, file: defaultBestInputsConfigFile});

      const configArgs = Object.keys(configuration);

      configArgs.forEach(function(arg){
        if (_.isObject(configuration[arg])) {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + "\n" + jsonPrint(configuration[arg]));
        }
        else {
          console.log(MODULE_ID_PREFIX + " | _FINAL CONFIG | " + arg + ": " + configuration[arg]);
        }
      });
      
      statsObj.commandLineArgsLoaded = true;

      if (configuration.enableStdin) { initStdIn(); }

      await initStatsUpdate();

      resolve(configuration);

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** CONFIG LOAD ERROR: " + err ));
      reject(err);
    }

  });
}

function pairwise(list) {
  // return new Promise(async function(resolve, reject){
    if (list.length < 2) { return []; }
    const first = list[0];
    const rest = list.slice(1);
    const pairs = rest.map(function (x) { return [first, x]; });
    return pairs.concat(pairwise(rest));
  // });
}

function runMain(){
  return new Promise(async function(resolve, reject){

    try {

      statsObj.status = "RUN MAIN";

      const networkInputsConfigObj = await tcUtils.loadFile({folder: configDefaultFolder, file: defaultBestInputsConfigFile, noErrorNotFound: true });

      const parentPairs = pairwise([...inputsIdSet]);
      console.log("PARENT PAIRS\n" + jsonPrint(parentPairs));

      async.eachSeries(parentPairs, async function(parentPair){
        const newInputsObj = await unionInputSets({parents: parentPair});
        networkInputsConfigObj.INPUTS_IDS.push(newInputsObj.inputsId);
        networkInputsConfigObj.INPUTS_IDS = _.uniq(networkInputsConfigObj.INPUTS_IDS);
        return;
      }, function(err){
        if (err) { throw err; }
        console.log("INPUTS_IDS\n" + jsonPrint(networkInputsConfigObj.INPUTS_IDS));
        saveFileQueue.push({folder: configDefaultFolder, file: defaultUnionInputsConfigFile, obj: networkInputsConfigObj});
        resolve();
      });

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** RUN MAIN ERROR: " + err ));
      reject(err);
    }
  });
}

setTimeout(async function(){

  try {

    const cnf = await initConfig(configuration);
    configuration = deepcopy(cnf);

    statsObj.status = "START";

    initSlackRtmClient();
    initSlackWebClient();

    initSaveFileQueue(configuration);

    if (configuration.testMode) {
      console.log(chalkAlert(MODULE_ID_PREFIX + " | TEST MODE"));
    }

    console.log(chalkBlue(
        "\n--------------------------------------------------------"
      + "\n" + MODULE_ID_PREFIX + " | " + configuration.processName 
      + "\nCONFIGURATION\n" + jsonPrint(configuration)
      + "--------------------------------------------------------"
    ));

    try {

      await connectDb();
      await initWatchConfig();
      await runMain();
      quit({cause: "DONE"});

    }
    catch(err){
      console.log(chalkError(MODULE_ID_PREFIX + " | *** MAIN ERROR ERROR: " + err + " | QUITTING ***"));
      quit({cause: "MAIN ERROR"});
    }

  }
  catch(err){
    console.log(chalkError(MODULE_ID_PREFIX + " | **** INIT CONFIG ERROR *****\n" + jsonPrint(err)));
    if (err.code !== 404) {
      quit({cause: new Error("INIT CONFIG ERROR")});
    }
  }
}, 1000);
