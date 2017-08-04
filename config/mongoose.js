var config = require('./config'),
  mongoose = require('mongoose');

mongoose.Promise = global.Promise;

module.exports = function() {

  var options = { 
    useMongoClient: true,
    poolSize: 20,
    promiseLibrary: global.Promise
  };

  // var wordAssoDb = mongoose.connect(config.wordAssoDb, options, function(error) {
  //   if (error) {
  //     console.log('CONNECT FAILED: ERROR: MONGOOSE default connection open to ' + config.wordAssoDb + ' ERROR: ' + error);
  //   } else {
  //     console.log('CONNECT: MONGOOSE default connection open to ' + config.wordAssoDb);
  //   }
  // });

  var wordAssoDb = mongoose.connect(config.wordAssoDb, options)
    .then(function(){
      console.log('CONNECT: MONGOOSE default connection open to ' + config.wordAssoDb);
    })
    .catch(function(err){
      console.log('CONNECT FAILED: ERROR: MONGOOSE default connection open to ' + config.wordAssoDb);
    });


  require('../app/models/neuralNetwork.server.model');
  require('../app/models/hashtag.server.model');
  require('../app/models/media.server.model');
  require('../app/models/place.server.model');
  require('../app/models/tweet.server.model');
  require('../app/models/url.server.model');
  require('../app/models/user.server.model');
  require('../app/models/word.server.model');

  return wordAssoDb;
};
