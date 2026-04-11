const log4js = require('log4js');
const config = require('../config');
const ChatBot = require('dingtalk-robot-sender');
const robot = new ChatBot(require('./dingding.json'));



const util = {};
log4js.configure(config.logSettings);
util.logger = {
	voa: log4js.getLogger('voa'),
	baby: {
		error: (err, loc) => {
			const msg = `loc: ${loc || ''}, code: ${err.code}, msg: ${err.message}`;
			log4js.getLogger('baby').error(msg);
			const textContent = {
				"msgtype": "text",
				"text": {
					"content": `监控: ${msg}`
				}
			}
			robot.send(textContent)
			.then((res) => {})
			.catch((err) => {
			});
		}
	}
}


const oldVoaError = log4js.getLogger('voa').error.bind(log4js.getLogger('voa'));
util.logger.voa.error = (err, loc) => {
	if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECONNABORT' || err.syscall === 'write') {
     return;
  }
	oldVoaError(`loc: ${loc || ''}, code: ${err.code}, msg: ${err.message}`)
}

const oldBabyError = log4js.getLogger('baby').error.bind(log4js.getLogger('baby'));
util.logger.baby.error = (err, loc) => {
	if (err.code === 'ECONNRESET' || err.code === 'EPIPE' || err.code === 'ECONNABORT' || err.syscall === 'write') {
     return;
  }
	oldBabyError(`loc: ${loc || ''}, code: ${err.code}, msg: ${err.message}`)
}

log4js.getLogger('voa').setLevel(config.logSettings.voaLogLevel);
log4js.getLogger('baby').setLevel(config.logSettings.babyLogLevel);





util.dingding = function (key, err) {
	util.logger.voa.error(err);
};




module.exports = util;
