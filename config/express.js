var config = require('./config'),
	express = require('express'),
	bodyParser = require('body-parser'),
	session = require('express-session');

module.exports = function() {
	var app = express();

	app.use(bodyParser.urlencoded({
		extended: true
	}));

	app.use(bodyParser.json());

	require('../app/routes/word.server.routes.js')(app);
	require('../app/routes/post.server.routes.js')(app);
	require('../app/routes/youTube.server.routes.js')(app);
	require('../app/routes/instagram.server.routes.js')(app);
	require('../app/routes/phrase.server.routes.js')(app);

	return app;
};