var config = require('./config'),
  mongoose = require('mongoose');

mongoose.Promise = global.Promise;

module.exports = function() {

  var options = {
    server: {
      auto_reconnect: true,
      poolSize: 5,
      reconnectTries: 14000,
      socketOptions: {
        // reconnectTries: 14000,
        keepAlive: 1000,
        socketTimeoutMS: 180000,
        connectTimeoutMS: 180000
      }
    },
    db: {
      numberOfRetries: 1000,
      retryMiliSeconds: 1000
    }
  };

  var wordAssoDb = mongoose.connect(config.wordAssoDb, options, function(error) {
    if (error) {
      console.log('CONNECT FAILED: ERROR: MONGOOSE default connection open to ' + config.wordAssoDb + ' ERROR: ' + error);
    } else {
      console.log('CONNECT: MONGOOSE default connection open to ' + config.wordAssoDb);
    }
  });

  // CONNECTION EVENTS
  // When successfully connected
  wordAssoDb.connection.on('connected', function() {
    console.log('MONGOOSE default connection OPEN to ' + config.wordAssoDb);
  });

  wordAssoDb.connection.on('close', function() {
    console.log('MONGOOSE default connection CLOSED to ' + config.wordAssoDb);
  });

  wordAssoDb.connection.on('error', function(err) {
    console.log("MONGOOSE ERROR\n" + err);
  });

  // When the connection is disconnected
  wordAssoDb.connection.on('disconnected', function() {
    console.log('MONGOOSE default connection disconnected');
  });

  require('../app/models/hashtag.server.model');
  require('../app/models/media.server.model');
  require('../app/models/place.server.model');
  require('../app/models/tweet.server.model');
  require('../app/models/url.server.model');
  require('../app/models/user.server.model');
  require('../app/models/word.server.model');

  return wordAssoDb;
};
