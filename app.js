const config = require('./config');
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const log4js = require('log4js');
const util = require('./util');
const app = express();
const Handlebars = require('handlebars');



// define the template engine
app.engine('html', function (filePath, options, callback) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      util.dingding('template.read', { err, filePath });
      return callback(new Error(err));
    }
    const tpl = Handlebars.compile(content + '');
    callback(null, tpl(options));
  });
});

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'html');


['./upload/avatar', './upload/image/remove', './upload/video/remove', './upload/image/thumb'].forEach((item) => {
  const uploadDir = path.join(__dirname, item);
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
});

// uncomment after placing your favicon in /public
//var favicon = require('serve-favicon');
//app.use(favicon(__dirname + '/public/favicon.ico'));
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use('/baby/avatar', express.static(path.join(__dirname, 'upload/avatar')));



app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: false
}));
app.use(cookieParser());





const routes = require('./routes/index');



//page
app.use('/baby', require('./routes/baby'))
app.use('/voa', require('./routes/voa'))
app.use('/', routes);


// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  if (err.status === 404) {
      return ;
  }
  util.dingding('app', { err, params: req.params, query: req.query, body: req.body });
});


module.exports = app;
