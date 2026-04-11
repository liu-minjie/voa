// TODO: generate config json via process.env.NODE_ENV

const path = require('path');
const fs = require('fs');

// Initialize logger
const logDir = path.resolve(__dirname, '../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

module.exports = {
  port: 3330,
  homePage: '',
  logSettings: {
    appenders: [{
      type: 'console'
    }, {
      type: 'file',
      filename: logDir + '/voa.log',
      category: 'voa'
    }, {
      type: 'file',
      filename: logDir + '/baby.log',
      category: 'baby'
    }],
    babyLogLevel: 'WARN',
    voaLogLevel: 'WARN',
    replaceConsole: true
  },
  dataPath: path.resolve(__dirname, '../../data')
};
