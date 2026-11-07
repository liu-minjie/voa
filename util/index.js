const log4js = require('log4js');
const path = require('path');
const https = require('https');
const config = require('../config');
const ChatBot = require('dingtalk-robot-sender');
const robot = new ChatBot(require(path.join(config.dataPath, 'voa/dingding.json')));



const util = {};
log4js.configure(config.logSettings);
util.logger = {
	voa: log4js.getLogger('voa'),
	baby: {
		error: (err, loc) => {
			const msg = `loc: ${loc || ''}, code: ${err.code}, msg: ${err.message}`;
			log4js.getLogger('baby').error(msg);	
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
  const msg = `loc: ${loc || ''}, code: ${err.code}, msg: ${err.message}`;
	oldBabyError(msg);
	const textContent = {
		"msgtype": "text",
		"text": {
			"content": `监控: ${msg}`
		}
	}
	robot.send(textContent)
	.then(() => {})
	.catch((err) => {
	});
}

log4js.getLogger('voa').setLevel(config.logSettings.voaLogLevel);
log4js.getLogger('baby').setLevel(config.logSettings.babyLogLevel);





util.dingding = function (data) {
	const textContent = {
		"msgtype": "text",
		"text": {
			"content": `监控数据: ${JSON.stringify(data)}`
		}
	}
	robot.send(textContent)
	.then(() => {})
	.catch((err) => {});
};




// 你的钉钉机器人 Webhook 地址
const dataPath = config.dataPath;

const localConfig = require(path.join(dataPath, 'config.json'));

// Node 16 没有全局 fetch（Node 18 才有），用内置 https 模块发 POST JSON
function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const payload = Buffer.from(body);
    const req = https.request({
      hostname: parsed.hostname,
      port: parsed.port || 443,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': payload.length
      },
      // 服务器是自签名证书，跳过证书校验（与 App 端 trustAllCertificates 行为一致）
      rejectUnauthorized: false
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function ding(msg) {

  const messageBody = {
    "msgtype": "text",
    "text": {
      "content": 'growth: ' + msg
    }
  };

  try {
    const response = await postJson(localConfig.dingUrl, JSON.stringify(messageBody));
    let data;
    try {
      data = JSON.parse(response);
    } catch (e) {
      // 响应不是 JSON 时原样记录
      data = response;
    }
    console.log('发送结果：', data);
  } catch (error) {
    console.error('网络请求失败：', error);
  }
}
util.ding = ding

module.exports = util;
