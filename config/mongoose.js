var config = require('./config'),
	mongoose = require('mongoose');

// mongoose.Promise = global.Promise;
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

	var wordAssoDb = mongoose.connect(config.wordAssoDb, options, function(error){
		if (error) {
			console.log('CONNECT FAILED: ERROR: MONGOOSE default connection open to ' + config.wordAssoDb
				+ ' ERROR: ' + error);
		}
		else {
			console.log('CONNECT: MONGOOSE default connection open to ' + config.wordAssoDb);
		}
	});

	// CONNECTION EVENTS
	// When successfully connected
	wordAssoDb.connection.on('connected', function () {  
	  console.log('MONGOOSE default connection OPEN to ' + config.wordAssoDb);
	}); 

	wordAssoDb.connection.on('close', function () {  
	  console.log('MONGOOSE default connection CLOSED to ' + config.wordAssoDb);
	}); 

	wordAssoDb.connection.on('error', function (err) {
		console.log("MONGOOSE ERROR\n" + err);
	});

	// When the connection is disconnected
	wordAssoDb.connection.on('disconnected', function () {  
	  console.log('MONGOOSE default connection disconnected');
	});


	// require('../app/models/admin.server.model');  
	require('../app/models/client.server.model');  
	require('../app/models/entity.server.model');  
	// require('../app/models/facebookPost.server.model');
	require('../app/models/group.server.model');  
	require('../app/models/hashtag.server.model');
	// require('../app/models/igMedia.server.model');
	// require('../app/models/igPlace.server.model');
	// require('../app/models/igTag.server.model');
	// require('../app/models/igUser.server.model');
	require('../app/models/media.server.model');
	// require('../app/models/oauth2credential.server.model'); 
	require('../app/models/place.server.model');
	require('../app/models/rssPost.server.model');  
	require('../app/models/session.server.model');  
	require('../app/models/tweet.server.model');  
	require('../app/models/url.server.model');
	require('../app/models/user.server.model');  

	require('../app/models/word.server.model');  
	require('../app/models/phrase.server.model');  

	require('../app/models/youTubeCaption.server.model');  
	require('../app/models/youTubePlaylist.server.model');  
	require('../app/models/youTubeVideo.server.model');  

	require('../app/models/metaSecond.server.model');
	require('../app/models/metaMinute.server.model');
	require('../app/models/metaHour.server.model');
	require('../app/models/metaDay.server.model');
	require('../app/models/metaWeek.server.model');
	require('../app/models/metaMonth.server.model');
	require('../app/models/metaYear.server.model');

	return wordAssoDb;
};