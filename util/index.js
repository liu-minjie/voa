const log4js = require('log4js');
const config = require('../config');

const util = {};
log4js.configure(config.logSettings);
util.logger = {
	voa: log4js.getLogger('voa')
}

util.logger.voa.setLevel(config.logSettings.voaLogLevel);



util.dingding = function (key, err) {
	util.logger.voa.error(err);
};



module.exports = util;
