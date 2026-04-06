const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multiparty = require('multiparty');
const moment = require('moment');
const util = require('../util');

const log = util.logger.baby;

function ensureJson(filePath, initialData = {}) {
  if (!fs.existsSync(filePath)) {
    const dirPath = path.dirname(filePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(initialData, null, 2), 'utf8');
  }
}
// 确保remove目录存在
const ensureRemoveDir = (dirPath) => {
  const removeDir = path.join(dirPath, 'remove');
  if (!fs.existsSync(removeDir)) {
    fs.mkdirSync(removeDir, { recursive: true });
  }
  return removeDir;
};

// 确保remove JSON文件存在
const ensureRemoveJson = (jsonPath) => {
  if (!fs.existsSync(jsonPath)) {
    fs.writeFileSync(jsonPath, JSON.stringify([], null, 2), 'utf8');
  }
  return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
};

ensureJson('./routes/baseinfo.json', []);
ensureJson('./routes/image.json', []);
ensureJson('./routes/image_remove.json', []);
ensureJson('./routes/video.json', []);
ensureJson('./routes/video_remove.json', []);
ensureJson('./routes/record.json', []);
ensureJson('./routes/record_remove.json', []);

function crossDomain(req, res) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

router.get('/baseinfo', function(req, res) {
	crossDomain(req, res);

	let baseinfo = [];
	let success = true;
	try {

	delete require.cache[require.resolve('./baseinfo.json')];
	baseinfo = require('./baseinfo.json');

	} catch (err) {
		success = false
		log.error(err, 'get /baseinfo')
	}

	res.json({
		success,
		data: baseinfo
	});
});
router.options('/baseinfo', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/baseinfo', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./baseinfo.json')];
	const baseinfo = require('./baseinfo.json');
	const data = req.body.data;

	data.createat = moment().format('YYYY-MM-DD HH:mm:ss');
	data.avatar = data.avatar || (baseinfo.length ? baseinfo[0].avatar || '' : '')
	baseinfo.unshift(data);
	fs.writeFileSync('./routes/baseinfo.json', JSON.stringify(baseinfo, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, 'post /baseinfo')
	}

	res.json({
		success,
		message: '更新' + (success ? '成功' : '失败')
	});
});
// 上传头像
router.post('/baseinfo/avatar/upload',  function(req, res) {
	crossDomain(req, res);

	var form = new multiparty.Form({ uploadDir: './upload/avatar' });

  form.parse(req, function(err, fields, files) {
    if (err) {
    	log.error(err, '/upload-avatar file');
      return res.status(500).send('上传失败');
    }

    let success = true;
		try {

    const part = files.avatar[0].path.split('/');
    const filename = part[part.length - 1];

		const avatarUrl = `/avatar/${filename}`;

		delete require.cache[require.resolve('./baseinfo.json')];
		let baseinfo = require('./baseinfo.json');
		const first = baseinfo[0];
		if (first) {
			first.avatar = avatarUrl;
			first.updateat = moment().format('YYYY-MM-DD HH:mm:ss')
			fs.writeFileSync('./routes/baseinfo.json', JSON.stringify(baseinfo, null, 2), 'utf8');
		}

		} catch (err) {
			success = false
			log.error(err, '/upload-avatar')
		}
		
		res.json({
			success,
			message: '上传' + (success ? '成功' : '失败'),
			data: {
				avatarUrl: avatarUrl,
				filename: filename
			}
		});
  });
});


router.get('/image/item/:name', function(req, res, next) {
	const name = req.params.name
  const thumb = req.query.thumb || '';
  const thumbName = path.parse(name).name + '.webp';
  let filePath = path.join(__dirname, thumb ? `../upload/image/thumb/${thumbName}` : `../upload/image/${name}`);
  
  // 检查文件是否存在
  if (thumb && !fs.existsSync(filePath)) {
    // 如果请求缩略图但缩略图不存在，使用原图
    filePath = path.join(__dirname, `../upload/image/${name}`);
  }
  
  // 再次检查文件是否存在
  if (!fs.existsSync(filePath)) {
    // 如果文件不存在，返回 404 状态码
    res.status(404).send('File not found');
    return;
  }
  
  res.sendFile(filePath, {
    maxAge: '3650d',
    immutable: true
  }, (err) => {
		if (err) {
      if (err.code !== 'ENOENT') {
        log.error(err, '/image/item/:name');
      } else if (!res.headersSent) {
        res.status(404).send('File not found');
        return;
      } 
      
      // 如果响应还未发送，返回 500 错误
      if (!res.headersSent) {
        res.status(500).send('Internal server error');
      }
		}
	});
});
router.get('/image/list', function(req, res) {
	crossDomain(req, res);
	let image = [];
	let success = true;
	try {

	delete require.cache[require.resolve('./image.json')];
	image = require('./image.json');

	} catch (err) {
		success = false
		log.error(err, '/image/list')
	}

	res.json({
	  success,
		data: image
	});
});
router.options('/image/upload',  function(req, res) {
	crossDomain(req, res);
	res.json({
		success: true
	});
});
router.post('/image/upload',  function(req, res) {
	crossDomain(req, res);


	const form = new multiparty.Form({ uploadDir: './upload/image' });

  form.parse(req, function(err, fields, files) {
    if (err) {
    	log.error(err, '/upload-image file');
      return res.status(500).send('上传失败');
    }

    let filename = '';
    let success = true;
		try {


    const part = files.image[0].path.split('/');
    filename = part[part.length - 1];

    const type = fields.type ? fields.type[0] : '';

    if (files.thumb) {
      const thumbDir = './upload/image/thumb';
      if (!fs.existsSync(thumbDir)) {
        fs.mkdirSync(thumbDir, { recursive: true });
      }
      const thumbPath = files.thumb[0].path;
      const thumbName = path.parse(filename).name + '.webp';
      const targetThumbPath = path.join(thumbDir, thumbName);
      fs.renameSync(thumbPath, targetThumbPath);
    }

    // 只有相册图片才保存到image.json
    if (type === 'gallery') {
      delete require.cache[require.resolve('./image.json')];
      const image = require('./image.json');
      image.unshift({
        id: Date.now(),
        originalName: files.image[0].originalFilename || filename,
        name: filename,
        tag:  fields.tag[0] || '',
        createat: fields.createat ? fields.createat[0] : moment().format('YYYY-MM-DD HH:mm:ss')
      });

      fs.writeFileSync('./routes/image.json', JSON.stringify(image, null, 2), 'utf8');
    }

    } catch (err) {
			success = false
			log.error(err, '/upload-image')
		}

		res.json({
			success,
			message: '上传' + (success ? '成功' : '失败'),
			data: {
				filename: filename
			}
		});
  });
});
// 删除照片
router.options('/image/delete', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/image/delete', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./image.json')];
	const images = require('./image.json');
	const photoId = req.body.id;

	// 找到要删除的照片
	const photoIndex = images.findIndex(image => image.id == photoId);
	if (photoIndex === -1) {
		return res.json({
			success: false,
			message: '照片不存在'
		});
	}

	// 获取要删除的照片信息
	const photoToDelete = images[photoIndex];
	
	// 移动照片文件到remove目录
	if (photoToDelete.name) {
		const photoPath = path.join(__dirname, `../upload/image/${photoToDelete.name}`);
		if (fs.existsSync(photoPath)) {
			try {
				const removeDir = ensureRemoveDir(path.join(__dirname, '../upload/image'));
				const targetPath = path.join(removeDir, photoToDelete.name);
				fs.renameSync(photoPath, targetPath);
			} catch (err) {
				log.error(err, '/image/delete renameSync')
			}
		}
	}

	// 移动照片记录到image_remove.json
	const imageRemoveJsonPath = path.join(__dirname, './image_remove.json');
	const imageRemoveData = ensureRemoveJson(imageRemoveJsonPath);
	imageRemoveData.unshift(photoToDelete);
	fs.writeFileSync(imageRemoveJsonPath, JSON.stringify(imageRemoveData, null, 2), 'utf8');

	// 从数组中删除照片
	images.splice(photoIndex, 1);
	fs.writeFileSync('./routes/image.json', JSON.stringify(images, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/image/delete')
	}

	res.json({
		success,
		message: '删除'  + (success ? '成功' : '失败')
	});
});
// 更新图片
router.options('/image/update', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/image/update', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./image.json')];
	const images = require('./image.json');
	const data = req.body;
	const imageId = data.id;

	// 找到要更新的图片
	const imageIndex = images.findIndex(image => image.id == imageId);
	if (imageIndex === -1) {
		return res.json({
			success: false,
			message: '图片不存在'
		});
	}

	// 获取旧记录
	const oldImage = images[imageIndex];
	
	// 更新图片信息
	images[imageIndex] = {
		...oldImage,
		tag: data.tag || oldImage.tag || '',
		updateat: moment().format('YYYY-MM-DD HH:mm:ss')
	};

	fs.writeFileSync('./routes/image.json', JSON.stringify(images, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/image/update')
	}

	res.json({
		success,
		message: '更新' + (success ? '成功' : '失败')
	});
});





router.get('/video/item/:name', function(req, res, next) {
	const name = req.params.name
	res.sendFile(path.join(__dirname, `../upload/video/${name}`), {
    maxAge: '3650d',
    immutable: true
  }, (err) => {
		if (err) {
      if (err.code !== 'ENOENT') {
        log.error(err, '/video/item/:name');
      } else if (!res.headersSent) {
        res.status(404).send('File not found');
        return;
      } 
		}
    
    if (!res.headersSent) {
      return next(err);
    }
	});
});
router.get('/video/list', function(req, res) {
	crossDomain(req, res);
	let video = [];
	let success = true;
	try {

	delete require.cache[require.resolve('./video.json')];
	video = require('./video.json');

	} catch (err) {
		success = false
		log.error(err, '/video/list')
	}

	res.json({
		success,
		data: video
	});
});
router.options('/video/upload',  function(req, res) {
	crossDomain(req, res);
	res.json({
		success: true
	});
});
router.post('/video/upload',  function(req, res) {
	crossDomain(req, res);


	const form = new multiparty.Form({ uploadDir: './upload/video' });

  form.parse(req, function(err, fields, files) {
    if (err) {
    	log.error(err, '/upload-video file');
      return res.status(500).send('上传失败');
    }

    let filename = '';

    let success = true;
		try {

    const part = files.video[0].path.split('/');
    filename = part[part.length - 1];

    delete require.cache[require.resolve('./video.json')];
		const video = require('./video.json');

		video.unshift({
			id: Date.now(),
			originalName: files.video[0].originalFilename || filename,
      name: filename,
			tag:  fields.tag[0] || '',
			createat: fields.createat ? fields.createat[0] : moment().format('YYYY-MM-DD HH:mm:ss')
		});

		fs.writeFileSync('./routes/video.json', JSON.stringify(video, null, 2), 'utf8');

		} catch (err) {
			success = false
			log.error(err, '/upload-video')
		}
		
		res.json({
			success,
			message: '上传' + (success ? '成功' : '失败'),
			data: {
				filename: filename
			}
		});
  });
});
// 删除视频
router.options('/video/delete', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/video/delete', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./video.json')];
	const videos = require('./video.json');
	const videoId = req.body.id;

	// 找到要删除的视频
	const videoIndex = videos.findIndex(video => video.id == videoId);
	if (videoIndex === -1) {
		return res.json({
			success: false,
			message: '视频不存在'
		});
	}

	// 获取要删除的视频信息
	const videoToDelete = videos[videoIndex];
	
	// 移动视频文件到remove目录
	if (videoToDelete.name) {
		const videoPath = path.join(__dirname, `../upload/video/${videoToDelete.name}`);
		if (fs.existsSync(videoPath)) {
			try {
				const removeDir = ensureRemoveDir(path.join(__dirname, '../upload/video'));
				const targetPath = path.join(removeDir, videoToDelete.name);
				fs.renameSync(videoPath, targetPath);
			} catch (err) {
				log.error(err, '/video/delete renameSync')
			}
		}
	}

	// 移动视频记录到video_remove.json
	const videoRemoveJsonPath = path.join(__dirname, './video_remove.json');
	const videoRemoveData = ensureRemoveJson(videoRemoveJsonPath);
	videoRemoveData.unshift(videoToDelete);
	fs.writeFileSync(videoRemoveJsonPath, JSON.stringify(videoRemoveData, null, 2), 'utf8');

	// 从数组中删除视频
	videos.splice(videoIndex, 1);
	fs.writeFileSync('./routes/video.json', JSON.stringify(videos, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/video/delete')
	}

	res.json({
		success,
		message: '删除' + (success ? '成功' : '失败')
	});
});
// 更新视频
router.options('/video/update', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/video/update', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./video.json')];
	const videos = require('./video.json');
	const data = req.body;
	const videoId = data.id;

	// 找到要更新的视频
	const videoIndex = videos.findIndex(video => video.id == videoId);
	if (videoIndex === -1) {
		return res.json({
			success: false,
			message: '视频不存在'
		});
	}

	// 获取旧记录
	const oldVideo = videos[videoIndex];
	
	// 更新视频信息
	videos[videoIndex] = {
		...oldVideo,
		tag: data.tag || oldVideo.tag || '',
		updateat: moment().format('YYYY-MM-DD HH:mm:ss')
	};

	fs.writeFileSync('./routes/video.json', JSON.stringify(videos, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/video/update')
	}

	res.json({
		success,
		message:  '更新' + (success ? '成功' : '失败')
	});
});



// 提交记录
router.options('/record/add', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/record/add', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./record.json')];
	const records = require('./record.json');
	const data = req.body;

	data.id = Date.now();
	data.createat = moment().format('YYYY-MM-DD HH:mm:ss');
	records.unshift(data);
	fs.writeFileSync('./routes/record.json', JSON.stringify(records, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/add-record')
	}

	res.json({
		success,
		message:  '保存' + (success ? '成功' : '失败')
	});
});
// 获取记录列表
router.get('/record/list', function(req, res) {
	crossDomain(req, res);
	let success = true;
	let records = [];

	try {

	delete require.cache[require.resolve('./record.json')];
	records = require('./record.json');

	} catch (err) {
		success = false
		log.error(err, '/record/list')
	}

	res.json({
		success,
		data: records
	});
});
// 更新记录
router.options('/record/update', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/record/update', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {


	delete require.cache[require.resolve('./record.json')];
	const records = require('./record.json');
	const data = req.body;
	const recordId = data.id;

	// 找到要更新的记录
	const recordIndex = records.findIndex(record => record.id == recordId);
	if (recordIndex === -1) {
		return res.json({
			success: false,
			message: '记录不存在'
		});
	}

	// 获取旧记录
	const oldRecord = records[recordIndex];
	
	// 对比并删除被移除的图片
	if (oldRecord.items) {
		oldRecord.items.forEach(oldItem => {
			if (oldItem.images) {
				oldItem.images.forEach(oldImg => {
					// 检查图片是否在新记录中存在
					let isImageStillExists = false;
					if (data.items) {
						data.items.forEach(newItem => {
							if (newItem.images) {
								newItem.images.forEach(newImg => {
									if (newImg.url === oldImg.url) {
										isImageStillExists = true;
									}
								});
							}
						});
					}
					// 如果图片不存在于新记录中，删除文件
					if (!isImageStillExists) {
						const imagePath = path.join(__dirname, `../upload/image/${oldImg.url}`);
						if (fs.existsSync(imagePath)) {
							try {
								fs.unlinkSync(imagePath);
							} catch (err) {
								log.error(err, '/update-record unlinkSync')
							}
						}
					}
				});
			}
		});
	}

	// 更新记录
	data.updateat = moment().format('YYYY-MM-DD HH:mm:ss');
	data.createat = oldRecord.createat || data.createat || ''
	records[recordIndex] = data;
	fs.writeFileSync('./routes/record.json', JSON.stringify(records, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/update-record')
	}

	res.json({
		success,
		message: '更新' + (success ? '成功' : '失败')
	});
});
// 删除记录
router.options('/record/delete', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/record/delete', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {

	delete require.cache[require.resolve('./record.json')];
	const records = require('./record.json');
	const recordId = req.body.id;

	// 找到要删除的记录
	const recordIndex = records.findIndex(record => record.id == recordId);
	if (recordIndex === -1) {
		return res.json({
			success: false,
			message: '记录不存在'
		});
	}

	// 获取要删除的记录
	const recordToDelete = records[recordIndex];
	
	// 删除关联的图片文件
	if (recordToDelete.items) {
		recordToDelete.items.forEach(item => {
			if (item.images) {
				item.images.forEach(img => {
					const imagePath = path.join(__dirname, `../upload/image/${img.url}`);
					if (fs.existsSync(imagePath)) {
						try {
							const removeDir = ensureRemoveDir(path.join(__dirname, '../upload/image'));
							const targetPath = path.join(removeDir, img.url);
							fs.renameSync(imagePath, targetPath);
						} catch (err) {
							log.error(err, '/record/delete renameSync')
						}
					}
				});
			}
		});
	}

	const recordRemoveJsonPath = path.join(__dirname, './record_remove.json');
	const recordRemoveData = ensureRemoveJson(recordRemoveJsonPath);
	recordRemoveData.unshift(recordToDelete);
	fs.writeFileSync(recordRemoveJsonPath, JSON.stringify(recordRemoveData, null, 2), 'utf8');



	// 从数组中删除记录
	records.splice(recordIndex, 1);
	fs.writeFileSync('./routes/record.json', JSON.stringify(records, null, 2), 'utf8');

	} catch (err) {
		success = false
		log.error(err, '/record/delete')
	}

	res.json({
		success,
		message: '删除' + (success ? '成功' : '失败')
	});
});

















module.exports = router;