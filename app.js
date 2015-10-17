var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
//var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var config = require('./config');
var app = express();
require('./logging')(app);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
app.locals.pretty = true;

// uncomment after placing your favicon in /public
app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
//app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(
  path.join(__dirname, 'public'),
  {
    redirect: false
  }
));

config.url_path = config.url_path || '/foo'

/* GET home page. */
app.get(config.url_path, function(req, res, next) {
  if (req.path == config.url_path) {
    res.render('index', { title: 'jub.dj' }, function(err, html) {
      if (err) {
        console.error(err.message);
        next.send(html);
      } else {
        res.send(html);
      }
    });
  }
});
app.get('/', function(req, res, next) {
  res.render('moved', function(err, html) {
    if (err) {
      console.error(err.message);
      next.send(html);
    } else {
      res.send(html);
    }
  });
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.auth = require('./auth')(config);
app.models = require('./models')(config, app.auth);
app.db = require('./db')(config, app.models);
app.gapi = require('./gapi')(config); // doesn't need to be an app member
app.bot = require('./bot')(config, app.gapi);
app.chat = require('./chat')(config, app.bot);
app.jub = require('./jub_dj')(config, app.gapi, app.chat);
app.config = config;

// Note: in ./bin/www -> socket-routing.js, the jub receives a callback
// that allows it to *initiate* messages over the sockets


/* scratch */
var token = app.auth.gen_token(function(token) {
  console.log("generated token:", token);
  console.log("encoded token:", app.auth.encode_token(token));
  app.db.store_auth('123456abcdef', token, 1);
});
/* scratch over */



module.exports = app;
