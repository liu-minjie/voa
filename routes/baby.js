const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const multiparty = require('multiparty');
const moment = require('moment');
const util = require('../util');
const ffmpeg = require('fluent-ffmpeg');
const config = require('../config');
const dataPath = config.dataPath;
const { Writable } = require('stream');
const Busboy = require('busboy');

const log = util.logger.baby;

function ensureJson(filePath, initialData = {}) {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(dataPath, path.basename(filePath));
  if (!fs.existsSync(absolutePath)) {
    const dirPath = path.dirname(absolutePath);
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }

    fs.writeFileSync(absolutePath, JSON.stringify(initialData, null, 2), 'utf8');
  } else {
    delete require.cache[require.resolve(absolutePath)];
  }
  return require(absolutePath);
}
const writeFileSync = (filePath, data) => {
  const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(dataPath, path.basename(filePath));
  fs.writeFileSync(absolutePath, JSON.stringify(data, null, 2), 'utf8');
}

const ensureDir = (dirPath, folder) => {
  const dir = folder ? path.join(dirPath, folder) : dirPath;
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// 检查视频是否需要修复 moov 位置（MP4 视频且 moov 在最后）
function checkAndFixMoov(videoPath) {
  return new Promise((resolve) => {
    // 先检查文件是否是 MP4 格式（检查文件魔数）
    console.log('videoPath', videoPath)
    const buffer = Buffer.alloc(8);
    try {
      const fd = fs.openSync(videoPath, 'r');
      fs.readSync(fd, buffer, 0, 8, 0);
      fs.closeSync(fd);
    } catch (err) {
      console.log('读取文件失败:', err.message);
      return resolve(false);
    }

    // MP4/MOV 文件魔数：第 5-8 字节是 'ftyp'（前 4 字节是 atom 大小）
    // 正确的 MP4 结构：[4字节: atom大小][4字节: 'ftyp']...
    const atomSize = buffer.readUInt32BE(0);
    const magic = buffer.toString('ascii', 4, 8);
    console.log('atomSize:', atomSize);
    console.log('magic (ascii):', JSON.stringify(magic));
    console.log('buffer hex:', buffer.toString('hex'));
    if (magic !== 'ftyp') {
      console.log('不是 MP4/MOV 文件，跳过 moov 修复');
      return resolve(false);
    }

    // 检查 moov 位置（解析 MP4 atom 结构）
    // MP4 结构：[4字节: atom大小][4字节: atom类型][atom内容]
    // moov atom 应该在文件开头附近（通常在 ftyp 之后）
    const headerBuffer = Buffer.alloc(4096);
    try {
      const fd = fs.openSync(videoPath, 'r');
      fs.readSync(fd, headerBuffer, 0, 4096, 0);
      fs.closeSync(fd);
    } catch (err) {
      console.log('读取文件头部失败:', err.message);
      return resolve(false);
    }

    // 解析 atoms，检查 moov 是否在文件开头附近
    let offset = 0;
    let foundMoov = false;
    let foundMdat = false;
    
    while (offset < headerBuffer.length - 8) {
      const size = headerBuffer.readUInt32BE(offset);
      const type = headerBuffer.toString('ascii', offset + 4, offset + 8);
      
      console.log(`发现 atom: ${type}，大小: ${size}，位置: ${offset}`);
      
      if (type === 'moov') {
        foundMoov = true;
        console.log(`moov atom 位置: ${offset}`);
        // moov 如果在前 1KB 内，认为是在开头
        if (offset < 1024) {
          console.log('moov 已在文件开头，无需处理');
          return resolve(false);
        }
        break;
      }
      
      if (type === 'mdat') {
        foundMdat = true;
        console.log('mdat 在 moov 之前，说明 moov 在文件末尾');
        break;
      }
      
      // 如果 size 是 0 或无效，停止解析
      if (size < 8) break;
      
      offset += size;
    }
    
    // 如果没有找到 moov，或者 mdat 在前面，说明 moov 在末尾
    if (!foundMoov || foundMdat) {
      console.log('检测到 moov 在文件末尾，开始修复...');
    } else {
      console.log('moov 已在文件开头，无需处理');
      return resolve(false);
    }

    // 执行 faststart 处理，将 moov 移到文件开头
    const tempPath = videoPath + '.temp';
    
    ffmpeg(videoPath)
      .outputOptions([
        '-movflags +faststart',
        '-c:v copy',
        '-c:a copy'
      ])
      .output(tempPath)
      .on('end', () => {
        try {
          // 替换原文件
          fs.unlinkSync(videoPath);
          fs.renameSync(tempPath, videoPath);
          console.log('moov 修复完成');
          resolve(true);
        } catch (e) {
          console.log('moov 修复失败:', e.message);
          // 清理临时文件
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
          resolve(false);
        }
      })
      .on('error', (err) => {
        console.log('moov 修复失败:', err.message);
        // 清理临时文件
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
        resolve(false);
      })
      .run();
  });
}


ensureJson('./baseinfo.json', []);
ensureJson('./image.json', []);
ensureJson('./image_remove.json', []);
ensureJson('./video.json', []);
ensureJson('./video_remove.json', []);
ensureJson('./record.json', []);
ensureJson('./record_remove.json', []);
ensureJson('./daily_log.json', []);
ensureJson('./daily_log_remove.json', []);

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

	delete require.cache[require.resolve(path.join(dataPath, 'baseinfo.json'))];
	baseinfo = require(path.join(dataPath, 'baseinfo.json'));

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

	delete require.cache[require.resolve(path.join(dataPath, 'baseinfo.json'))];
	const baseinfo = require(path.join(dataPath, 'baseinfo.json'));
	const data = req.body.data;

	data.createat = moment().format('YYYY-MM-DD HH:mm:ss');
	data.avatar = data.avatar || (baseinfo.length ? baseinfo[0].avatar || '' : '')
	baseinfo.unshift(data);
	writeFileSync('./baseinfo.json', baseinfo);

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

	var form = new multiparty.Form({ uploadDir: path.join(dataPath, 'upload/avatar') });

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

		delete require.cache[require.resolve(path.join(dataPath, 'baseinfo.json'))];
		let baseinfo = require(path.join(dataPath, 'baseinfo.json'));
		const first = baseinfo[0];
		if (first) {
			first.avatar = avatarUrl;
			first.updateat = moment().format('YYYY-MM-DD HH:mm:ss')
			writeFileSync('./baseinfo.json', baseinfo);
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
  const type = req.query.type || 'image';
  const thumbName = path.parse(name).name + '.webp';
  let filePath = path.join(dataPath, thumb ? `upload/image/thumb/${thumbName}` : `upload/image/${name}`);
  
  if (thumb && !fs.existsSync(filePath)) {
    if (type === 'image') {
      filePath = path.join(dataPath, `upload/image/${name}`);
    }
  }
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('File not found');
  }
  
  res.sendFile(filePath, {
    maxAge: '3650d',
    immutable: true
  }, (err) => {
    err && log.error(err, 'generate video thumbnail');
    if (!res.headersSent) {
      res.status(404).send('File not found');
    }
  });
});
// 获取图片列表（后台管理用）
router.get('/image/admin/list', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let data = [];
  let total = 0;
  
  try {
    const type = req.query.type || 'gallery'; // gallery, record, dailylog
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    
    let allImages = [];
    
    if (type === 'gallery') {
      // 相册图片
      delete require.cache[require.resolve(path.join(dataPath, 'image.json'))];
      const images = require(path.join(dataPath, 'image.json'));
      allImages = images.map(img => ({
        id: img.id,
        name: img.name,
        originalName: img.originalName || img.name,
        url: img.name,
        createat: img.createat,
        source: 'gallery',
        sourceId: img.id
      }));
    } else if (type === 'record') {
      // 记录中的图片
      delete require.cache[require.resolve(path.join(dataPath, 'record.json'))];
      const records = require(path.join(dataPath, 'record.json'));
      records.forEach(record => {
        if (record.items) {
          record.items.forEach((item, itemIndex) => {
            if (item.images) {
              item.images.forEach((img, imgIndex) => {
                allImages.push({
                  id: `${record.id}-${itemIndex}-${imgIndex}`,
                  name: img.url,
                  originalName: img.url,
                  url: img.url,
                  createat: record.createat,
                  source: 'record',
                  sourceId: record.id,
                  itemIndex: itemIndex,
                  imgIndex: imgIndex
                });
              });
            }
          });
        }
      });
    } else if (type === 'dailylog') {
      // 日常日志中的图片
      delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
      const logs = require(path.join(dataPath, 'daily_log.json'));
      logs.forEach(log => {
        if (log.images) {
          log.images.forEach((img, imgIndex) => {
            allImages.push({
              id: `${log.id}-${imgIndex}`,
              name: img.url,
              originalName: img.url,
              url: img.url,
              createat: log.createat,
              source: 'dailylog',
              sourceId: log.id,
              imgIndex: imgIndex
            });
          });
        }
      });
    }
    
    // 按创建时间倒序
    allImages.sort((a, b) => new Date(b.createat) - new Date(a.createat));
    
    total = allImages.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    data = allImages.slice(startIndex, endIndex);
    
    // 添加文件大小信息
    data = data.map(img => {
      let size = 0;
      const filePath = path.join(dataPath, `upload/image/${img.url}`);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        size = stats.size;
      }
      return { ...img, size };
    });
  } catch (err) {
    success = false;
    log.error(err, '/image/admin/list');
  }
  
  res.json({ success, data, total });
});

// 检查图片缩略图是否存在
router.get('/image/check-thumbnail', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let exists = false;

  try {
    const filename = req.query.filename;

    if (!filename) {
      return res.json({ success: false, message: '缺少文件名' });
    }

    const thumbDir = path.join(dataPath, 'upload/image/thumb');
    const thumbName = path.parse(filename).name + '.webp';
    const thumbPath = path.join(thumbDir, thumbName);

    exists = fs.existsSync(thumbPath);
  } catch (err) {
    success = false;
    log.error(err, '/image/check-thumbnail');
  }

  res.json({ success, exists });
});

// 上传图片缩略图（前端生成后上传）
router.post('/image/upload-thumbnail', function(req, res) {
  crossDomain(req, res);

  const busboy = Busboy({
    headers: req.headers,
    limits: {
      fileSize: 2 * 1024 * 1024 // 缩略图限制 2MB
    }
  });

  let thumbFilePath = null;
  let filename = null;

  busboy.on('file', function(fieldname, stream, info) {
    if (fieldname === 'thumb') {
      const thumbDir = ensureDir(path.join(dataPath, 'upload/image'), 'thumb');
      const thumbName = path.parse(info.filename).name + '.webp';
      thumbFilePath = path.join(thumbDir, thumbName);

      // 如果缩略图已存在，先删除
      if (fs.existsSync(thumbFilePath)) {
        fs.unlinkSync(thumbFilePath);
      }

      const writeStream = fs.createWriteStream(thumbFilePath);
      stream.pipe(writeStream);
    }
  });

  busboy.on('field', function(fieldname, val) {
    if (fieldname === 'filename') {
      filename = val;
    }
  });

  busboy.on('finish', function() {
    if (thumbFilePath) {
      res.json({ success: true, message: '缩略图上传成功' });
    } else {
      res.json({ success: false, message: '未收到缩略图文件' });
    }
  });

  busboy.on('error', function(err) {
    log.error(err, '/image/upload-thumbnail');
    res.json({ success: false, message: '上传失败：' + err.message });
  });

  req.pipe(busboy);
});

router.get('/image/list', function(req, res) {
	crossDomain(req, res);
	let image = [];
	let success = true;
	try {

	delete require.cache[require.resolve(path.join(dataPath, 'image.json'))];
	image = require(path.join(dataPath, 'image.json'));

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


	const form = new multiparty.Form({ uploadDir: path.join(dataPath, 'upload/image') });

  form.parse(req, function(err, fields, files) {
    if (err) {
    	log.error(err, '/upload-image file');
      return res.status(500).send('上传失败');
    }

    let filename = '';
    let thumbFilename = '';
    let success = true;
		try {

    const part = files.image[0].path.split('/');
    filename = part[part.length - 1];

    const type = fields.type ? fields.type[0] : '';

    if (files.thumb) {
      const thumbDir = ensureDir(path.join(dataPath, 'upload/image'), 'thumb');
      
      const thumbPath = files.thumb[0].path;
      const thumbName = path.parse(filename).name + '.webp';
      const targetThumbPath = path.join(thumbDir, thumbName);
	  thumbFilename = thumbName;
      
      fs.renameSync(thumbPath, targetThumbPath);
    }

    // 只有相册图片才保存到image.json
    if (type === 'gallery') {
      delete require.cache[require.resolve(path.join(dataPath, 'image.json'))];
      const image = require(path.join(dataPath, 'image.json'));
      image.unshift({
        id: Date.now(),
        originalName: files.image[0].originalFilename || filename,
        name: filename,
        tag:  fields.tag[0] || '',
        createat: fields.createat ? fields.createat[0] : moment().format('YYYY-MM-DD HH:mm:ss')
      });

      writeFileSync('./image.json', image);
    }

    } catch (err) {
			success = false
			log.error(err, '/upload-image')
		}

		res.json({
			success,
			message: '上传' + (success ? '成功' : '失败'),
			data: {
				filename: filename,
				thumb: thumbFilename
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

	delete require.cache[require.resolve(path.join(dataPath, 'image.json'))];
	const images = require(path.join(dataPath, 'image.json'));
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
		const photoPath = path.join(dataPath, `upload/image/${photoToDelete.name}`);
		if (fs.existsSync(photoPath)) {
			try {
				const removeDir = ensureDir(path.join(dataPath, 'upload/image'), 'remove');
				const targetPath = path.join(removeDir, photoToDelete.name);
				fs.renameSync(photoPath, targetPath);
			} catch (err) {
				log.error(err, '/image/delete renameSync')
			}
		}
	}

	// 移动照片记录到image_remove.json
	const imageRemoveData = ensureJson('./image_remove.json', []);
	imageRemoveData.unshift(photoToDelete);
	writeFileSync('./image_remove.json', imageRemoveData);

	// 从数组中删除照片
	images.splice(photoIndex, 1);
	writeFileSync('./image.json', images);

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
		
	delete require.cache[require.resolve(path.join(dataPath, 'image.json'))];
	const images = require(path.join(dataPath, 'image.json'));
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

	writeFileSync('./image.json', images);

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
	res.sendFile(path.join(dataPath, `upload/video/${name}`), {
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

	delete require.cache[require.resolve(path.join(dataPath, 'video.json'))];
	video = require(path.join(dataPath, 'video.json'));

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
router.post('/video/upload', function(req, res) {
	crossDomain(req, res);

	const busboy = Busboy({
		headers: req.headers,
		limits: {
			fileSize: 500 * 1024 * 1024
		}
	});

	const fields = {};
	let fileWriteStream = null;
	let filename = '';
	let tempFilePath = '';
	let thumbFilePath = '';
	let metadataStr = '';
	let fieldCount = 0;

	// 处理普通字段
	busboy.on('field', (fieldname, value) => {
		fieldCount++;
		fields[fieldname] = value;
		if (fieldname === 'metadata') {
			metadataStr = value;
		}
	});

	// 处理文件字段
	busboy.on('file', (fieldname, stream, info) => {
		
		if (fieldname === 'video' || fieldname === 'file') {
			filename = info.filename || `video_${Date.now()}.mp4`;
			
			// 确保上传目录存在
			const uploadDir = path.join(dataPath, 'upload/video');
			if (!fs.existsSync(uploadDir)) {
				fs.mkdirSync(uploadDir, { recursive: true });
			}

			tempFilePath = path.join(uploadDir, filename);
			
			// 直接写入目标文件（流式）
			fileWriteStream = fs.createWriteStream(tempFilePath);
			
			stream.on('limit', () => {
				log.error(new Error('File size exceeds limit'), '/upload-video file limit');
				fileWriteStream.destroy();
				res.status(500).send('文件过大');
			});

			stream.pipe(fileWriteStream);
		} else if (fieldname === 'thumb') {
			console.log(111, info);
			// 处理缩略图文件
			const thumbName = info.filename || `thumb_${Date.now()}.webp`;
			
			// 确保缩略图目录存在
			const thumbDir = ensureDir(path.join(dataPath, 'upload/image'), 'thumb');
			
			thumbFilePath = path.join(thumbDir, thumbName);
			
			// 直接写入目标文件（流式）
			const thumbWriteStream = fs.createWriteStream(thumbFilePath);
			
			stream.on('limit', () => {
				log.error(new Error('Thumbnail size exceeds limit'), '/upload-video thumb limit');
				thumbWriteStream.destroy();
				res.status(500).send('缩略图过大');
			});

			stream.pipe(thumbWriteStream);
		}
	});

	// 所有文件和字段处理完成
	busboy.on('finish', () => {
		processUploadComplete();
	});

	// 所有字段处理完成
	busboy.on('fieldsLimit', () => {
		log.error(new Error('Fields limit exceeded'), '/upload-video fields limit');
	});

	// 处理上传完成
	function processUploadComplete() {
		if (!tempFilePath || !fs.existsSync(tempFilePath)) {
			log.error(new Error('File not created'), '/upload-video file not created');
			return res.status(500).json({ success: false, message: '上传失败：文件未创建' });
		}
		try {
			// 处理元数据
			let tag = '';
			let createat = moment().format('YYYY-MM-DD HH:mm:ss');

			if (metadataStr) {
				try {
					const metadata = JSON.parse(metadataStr);
					tag = metadata.tag || '';
					createat = metadata.createat || createat;
				} catch (err) {
					log.error(err, '/upload-video metadata parse');
				}
			} else if (fields.tag) {
				// 兼容旧格式
				tag = fields.tag || '';
				createat = fields.createat || createat;
			}

			// 生成缩略图（异步，不阻塞响应）
			if (!thumbFilePath) {
				const thumbDir = ensureDir(path.join(dataPath, 'upload/image'), 'thumb');
				const thumbName = path.parse(filename).name + '.webp';
				const thumbPath = path.join(thumbDir, thumbName);

				ffmpeg(tempFilePath)
					.screenshots({
						count: 1,
						folder: thumbDir,
						filename: thumbName,
						size: '320x?',
						timemarks: ['0.5']
					})
					.on('end', () => {})
					.on('error', (err) => {
						log.error(err, '/upload-video screenshot');
					});
			}

			// 保存视频信息到 video.json
			delete require.cache[require.resolve(path.join(dataPath, 'video.json'))];
			const video = require(path.join(dataPath, 'video.json'));

			video.unshift({
				id: Date.now(),
				originalName: filename,
				name: filename,
				tag: tag,
				createat: createat
			});

			writeFileSync('./video.json', video);


			res.json({
				success: true,
				message: '上传成功',
				data: {
					filename: filename
				}
			});
		} catch (err) {
			log.error(err, '/upload-video process');
			res.status(500).json({ success: false, message: '上传失败：' + err.message });
		}
	}

	busboy.on('error', (err) => {
		log.error(err, '/upload-video busboy error');
		if (fileWriteStream) {
			fileWriteStream.destroy();
		}
		if (!res.headersSent) {
			res.status(500).json({ success: false, message: '上传失败：' + err.message });
		}
	});

	req.pipe(busboy);
});

// 获取视频文件列表
router.get('/video/files', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let data = [];
  let total = 0;
  
  try {
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.pageSize) || 20;
    const uploadDir = path.join(dataPath, 'upload/video');
    
    delete require.cache[require.resolve(path.join(dataPath, 'video.json'))];
    const videos = require(path.join(dataPath, 'video.json'));
    
    total = videos.length;
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    
    data = videos.slice(startIndex, endIndex).map(video => {
      let size = 0;
      let mtime = null;
      
      const filePath = path.join(uploadDir, video.name);
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        size = stats.size;
        mtime = stats.mtime;
      }
      
      return {
        id: video.id,
        name: video.name,
        originalName: video.originalName || video.name,
        tag: video.tag || '',
        createat: video.createat,
        updateat: video.updateat || null,
        size: size,
        mtime: mtime,
        compressed: video.compressed || false
      };
    });
  } catch (err) {
    success = false;
    log.error(err, '/video/files');
  }
  
  res.json({ success, data, total });
});

// 获取视频缩略图
router.get('/video/thumb/:filename', function(req, res) {
  const filename = req.params.filename;
  const thumbDir = path.join(dataPath, 'upload/image/thumb');
  const thumbPath = path.join(thumbDir, filename.replace(/\.[^.]+$/, '.webp'));
  
  if (fs.existsSync(thumbPath)) {
    res.sendFile(thumbPath);
  } else {
    res.status(404).send('缩略图不存在');
  }
});

// 播放视频页面
router.get('/video/play/:filename', function(req, res) {
  const filename = req.params.filename;
  const videoPath = path.join(dataPath, 'upload/video', filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('视频不存在');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>播放视频</title>
      <style>
        * { margin: 0; padding: 0; }
        body { background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        video { max-width: 100%; max-height: 100vh; }
      </style>
    </head>
    <body>
      <video src="/baby/video/file/${filename}" controls autoplay></video>
    </body>
    </html>
  `);
});

// 视频文件流
router.get('/video/file/:filename', function(req, res) {
  const filename = req.params.filename;
  const videoPath = path.join(dataPath, 'upload/video', filename);
  
  if (!fs.existsSync(videoPath)) {
    return res.status(404).send('视频不存在');
  }
  
  const stat = fs.statSync(videoPath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = (end - start) + 1;
    const file = fs.createReadStream(videoPath, { start, end });
    
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    });
    
    file.pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    });
    fs.createReadStream(videoPath).pipe(res);
  }
});

// 压缩视频
router.post('/video/compress', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let message = '';
  let originalSize = 0;
  let compressedSize = 0;
  
  try {
    const { filename, width, height, videoBitrate, preset, removeAudio } = req.body;
    
    if (!filename) {
      return res.json({ success: false, message: '缺少文件名' });
    }
    
    const inputPath = path.join(dataPath, 'upload/video', filename);
    const outputFilename = filename.replace(/\.[^.]+$/, '_compressed.mp4');
    const outputPath = path.join(dataPath, 'upload/video', outputFilename);
    
    if (!fs.existsSync(inputPath)) {
      return res.json({ success: false, message: '视频文件不存在' });
    }
    
    originalSize = fs.statSync(inputPath).size;
    
    // 构建 ffmpeg 命令
    const command = ffmpeg(inputPath)
      .outputOptions([
        `-vf scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2`,
        `-b:v ${videoBitrate}`,
        `-preset ${preset || 'medium'}`,
        '-c:v libx264',
        '-movflags +faststart'
      ]);
    
    if (removeAudio) {
      command.noAudio();
    } else {
      command.audioCodec('aac').audioBitrate('128k');
    }
    
    command
      .on('end', () => {
        try {
          compressedSize = fs.statSync(outputPath).size;
          
          // 如果压缩后更小，则替换原文件
          if (compressedSize < originalSize) {
            const backupPath = path.join(dataPath, 'upload/video', filename.replace(/\.[^.]+$/, '_backup.mp4'));
            fs.renameSync(inputPath, backupPath);
            fs.renameSync(outputPath, inputPath);
            fs.unlinkSync(backupPath);
            
            // 更新 video.json，标记为已压缩
            delete require.cache[require.resolve(path.join(dataPath, 'video.json'))];
            let videos = require(path.join(dataPath, 'video.json'));
            
            const videoIndex = videos.findIndex(v => v.name === filename);
            if (videoIndex !== -1) {
              videos[videoIndex] = {
                ...videos[videoIndex],
                compressed: true,
                updateat: moment().format('YYYY-MM-DD HH:mm:ss')
              };
              writeFileSync('./video.json', videos);
            }
          } else {
            // 压缩后更大，删除压缩文件
            fs.unlinkSync(outputPath);
          }
          
          res.json({
            success: true,
            message: '压缩完成',
            originalSize,
            compressedSize: compressedSize < originalSize ? compressedSize : originalSize,
            savedSize: compressedSize < originalSize ? originalSize - compressedSize : 0
          });
        } catch (err) {
          log.error(err, '/video/compress end');
          res.json({ success: false, message: '保存压缩结果失败' });
        }
      })
      .on('error', (err) => {
        log.error(err, '/video/compress');
        res.json({ success: false, message: '压缩失败：' + err.message });
      })
      .save(outputPath);
      
  } catch (err) {
    success = false;
    message = err.message;
    log.error(err, '/video/compress');
    res.json({ success: false, message });
  }
});

// 生成视频缩略图
router.post('/video/thumbnail', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let message = '';
  
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.json({ success: false, message: '缺少文件名' });
    }
    
    const videoPath = path.join(dataPath, 'upload/video', filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.json({ success: false, message: '视频文件不存在' });
    }
    
    const thumbDir = ensureDir(path.join(dataPath, 'upload/image'), 'thumb');
    const thumbName = path.parse(filename).name + '.webp';
    const thumbPath = path.join(thumbDir, thumbName);
    
    // 如果缩略图已存在，先删除
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    
    // 使用 ffmpeg 生成缩略图
    ffmpeg(videoPath)
      .screenshots({
        count: 1,
        folder: thumbDir,
        filename: thumbName,
        size: '320x?',
        timemarks: ['0.5']
      })
      .on('end', () => {
        res.json({ success: true, message: '缩略图生成成功' });
      })
      .on('error', (err) => {
        log.error(err, '/video/thumbnail');
        res.json({ success: false, message: '缩略图生成失败：' + err.message });
      });
  } catch (err) {
    success = false;
    message = err.message;
    log.error(err, '/video/thumbnail');
    res.json({ success: false, message });
  }
});

// 删除视频
router.post('/video/delete', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let message = '';
  
  try {
    const { filename, id } = req.body;
    
    if (!filename) {
      return res.json({ success: false, message: '缺少文件名' });
    }
    
    const videoPath = path.join(dataPath, 'upload/video', filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.json({ success: false, message: '视频文件不存在' });
    }
    
    fs.unlinkSync(videoPath);
    
    // 同时删除对应的缩略图（如果有的话）
    const thumbDir = path.join(dataPath, 'upload/image/thumb');
    const thumbPath = path.join(thumbDir, filename.replace(/\.[^.]+$/, '.webp'));
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }
    
    // 从 video.json 中删除记录
    delete require.cache[require.resolve(path.join(dataPath, 'video.json'))];
    let videos = require(path.join(dataPath, 'video.json'));
    
    // 可以通过 id 或 filename 来删除
    if (id) {
      videos = videos.filter(v => v.id != id);
    } else {
      videos = videos.filter(v => v.name !== filename);
    }
    
    writeFileSync('./video.json', videos);
    
    res.json({ success: true, message: '删除成功' });
  } catch (err) {
    success = false;
    message = err.message;
    log.error(err, '/video/delete');
    res.json({ success: false, message });
  }
});

// 修复视频 moov 位置
router.post('/video/fix-moov', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let message = '';
  
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.json({ success: false, message: '缺少文件名' });
    }
    
    const videoPath = path.join(dataPath, 'upload/video', filename);
    
    if (!fs.existsSync(videoPath)) {
      return res.json({ success: false, message: '视频文件不存在' });
    }
    
    // 使用 checkAndFixMoov 函数处理
    checkAndFixMoov(videoPath).then(fixed => {
      if (fixed) {
        res.json({ success: true, message: 'moov 修复成功' });
      } else {
        res.json({ success: true, message: 'moov 无需修复或修复失败' });
      }
    });
  } catch (err) {
    success = false;
    message = err.message;
    log.error(err, '/video/fix-moov');
    res.json({ success: false, message });
  }
});

// 获取视频管理页面
router.get('/video/admin', function(req, res) {
  res.sendFile(path.join(__dirname, '../views/video_admin.html'));
});

// 获取图片管理页面
router.get('/image/admin', function(req, res) {
  res.sendFile(path.join(__dirname, '../views/image_admin.html'));
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

	delete require.cache[require.resolve(path.join(dataPath, 'video.json'))];
	const videos = require(path.join(dataPath, 'video.json'));
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

	writeFileSync('./video.json', videos);

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

	delete require.cache[require.resolve(path.join(dataPath, 'record.json'))];
	const records = require(path.join(dataPath, 'record.json'));
	const data = req.body;

	data.id = Date.now();
	data.createat = moment().format('YYYY-MM-DD HH:mm:ss');
	records.unshift(data);
	writeFileSync('./record.json', records);

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

	delete require.cache[require.resolve(path.join(dataPath, 'record.json'))];
	records = require(path.join(dataPath, 'record.json'));

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


	delete require.cache[require.resolve(path.join(dataPath, 'record.json'))];
	const records = require(path.join(dataPath, 'record.json'));
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
						const imagePath = path.join(dataPath, `upload/image/${oldImg.url}`);
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
	writeFileSync('./record.json', records);

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

	delete require.cache[require.resolve(path.join(dataPath, 'record.json'))];
	const records = require(path.join(dataPath, 'record.json'));
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
						const imagePath = path.join(dataPath, `upload/image/${img.url}`);
						if (fs.existsSync(imagePath)) {
							try {
								const removeDir = ensureDir(path.join(dataPath, 'upload/image'), 'remove');
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

	const recordRemoveData = ensureJson('./record_remove.json', []);
	recordRemoveData.unshift(recordToDelete);
	writeFileSync('./record_remove.json', recordRemoveData);



	// 从数组中删除记录
	records.splice(recordIndex, 1);
	writeFileSync('./record.json', records);

	} catch (err) {
		success = false
		log.error(err, '/record/delete')
	}

	res.json({
		success,
		message: '删除' + (success ? '成功' : '失败')
	});
});









router.options('/log', function(req, res) {
	crossDomain(req, res);
  res.json({
		success: true
	});
});
router.post('/log', function(req, res) {
	crossDomain(req, res);
	let success = true;
	try {
		util.dingding(req.body);
	} catch (err) {
		success = false
		log.error(err, '/log')
	}
	res.json({
		success,
		message: '发送' + (success ? '成功' : '失败')
	});
});
// 检查更新接口
router.options('/checkUpdate', function(req, res) {
  crossDomain(req, res);
  res.json({
		success: true
	});
});
router.get('/checkUpdate', function(req, res) {
	crossDomain(req, res);
	let success = true;
	let updateData = {
		versionCode: 1,
		versionName: '1.0.1',
		updateLog: '1. 初始版本\n2. 基础功能完善',
		downloadUrl: '/public/baby/growth.apk',
		forceUpdate: false
	};
	try {
		const updateJsonPath = path.join(dataPath, 'update.json');
		if (fs.existsSync(updateJsonPath)) {
			delete require.cache[require.resolve(updateJsonPath)];
			updateData = require(updateJsonPath);
		}
	} catch (err) {
		success = false;
		log.error(err, '/checkUpdate');
	}
	res.json({
		success,
		data: updateData
	});
});








// ==================== 日常记录 API ====================

// 添加记录
router.options('/dailylog/add', function(req, res) {
  crossDomain(req, res);
  res.json({ success: true });
});
router.post('/dailylog/add', function(req, res) {
  crossDomain(req, res);
  let success = true;
  try {
    delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
    const logs = require(path.join(dataPath, 'daily_log.json'));
    const data = req.body;
    
    data.id = Date.now();
    data.createat = data.createat || moment().format('YYYY-MM-DD HH:mm:ss');
    logs.unshift(data);
    writeFileSync('./daily_log.json', logs);
  } catch (err) {
    success = false;
    log.error(err, '/dailylog/add');
  }
  res.json({ success, message: '保存' + (success ? '成功' : '失败') });
});

// 获取记录列表
router.get('/dailylog/list', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let logs = [];
  try {
    delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
    logs = require(path.join(dataPath, 'daily_log.json'));
    
    // 按时间倒序排列
    logs.sort((a, b) => new Date(b.createat) - new Date(a.createat));
    
    // 日期筛选
    if (req.query.startDate && req.query.endDate) {
      const startDate = req.query.startDate;
      const endDate = req.query.endDate;
      logs = logs.filter(log => {
        const logDate = moment(log.createat).format('YYYY-MM-DD');
        return logDate >= startDate && logDate <= endDate;
      });
    }
    
    const page = parseInt(req.query.page);
    const pageSize = parseInt(req.query.pageSize);
    
    if (page && pageSize) {
      // 分页模式
      const start = (page - 1) * pageSize;
      const end = start + pageSize;
      
      const pagedLogs = logs.slice(start, end);
      const hasMore = end < logs.length;
      
      res.json({ 
        success, 
        data: pagedLogs, 
        hasMore,
        total: logs.length,
        page,
        pageSize
      });
    } else {
      // 全量模式
      res.json({ 
        success, 
        data: logs, 
        hasMore: false,
        total: logs.length
      });
    }
  } catch (err) {
    success = false;
    log.error(err, '/dailylog/list');
      res.json({ success, data: [] });
  }
});

// 获取睡觉状态
router.get('/dailylog/sleep/status', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let sleeping = false;
  let lastSleep = null;
  try {
    delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
    const logs = require(path.join(dataPath, 'daily_log.json'));
    
    // 找到最新的睡觉记录
    const sleepLogs = logs.filter(log => log.type === 'sleep');
    if (sleepLogs.length > 0) {
      sleepLogs.sort((a, b) => new Date(b.createat) - new Date(a.createat));
      const latestSleep = sleepLogs[0];
      lastSleep = latestSleep;
      // 如果最新的睡觉记录有"开始睡觉"但没有"结束"，则表示正在睡觉
      sleeping = !latestSleep.endat;
    }
  } catch (err) {
    success = false;
    log.error(err, '/dailylog/sleep/status');
  }
  res.json({ success, sleeping, lastSleep });
});

// 更新记录
router.options('/dailylog/update', function(req, res) {
  crossDomain(req, res);
  res.json({ success: true });
});
router.post('/dailylog/update', function(req, res) {
  crossDomain(req, res);
  let success = true;
  try {
    delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
    const logs = require(path.join(dataPath, 'daily_log.json'));
    const data = req.body;
    const logId = data.id;
    
    const logIndex = logs.findIndex(log => log.id == logId);
    if (logIndex === -1) {
      return res.json({ success: false, message: '记录不存在' });
    }
    
    const oldLog = logs[logIndex];
    
    // 对比并删除被移除的图片
    if (oldLog.images) {
      oldLog.images.forEach(oldImg => {
        let isImageStillExists = false;
        if (data.images) {
          data.images.forEach(newImg => {
            if (newImg.url === oldImg.url) {
              isImageStillExists = true;
            }
          });
        }
        if (!isImageStillExists) {
          const imagePath = path.join(dataPath, `upload/image/${oldImg.url}`);
          if (fs.existsSync(imagePath)) {
            try {
              const removeDir = ensureDir(path.join(dataPath, 'upload/image'), 'remove');
              const targetPath = path.join(removeDir, oldImg.url);
              fs.renameSync(imagePath, targetPath);
            } catch (err) {
              log.error(err, '/dailylog/update renameSync');
            }
          }
        }
      });
    }

	if (!data.endat && req.query.action === 'end') {
		data.endat = moment().format('YYYY-MM-DD HH:mm:ss');
	}
    
    data.updateat = moment().format('YYYY-MM-DD HH:mm:ss');
    data.createat = data.createat || logs[logIndex].createat;
    logs[logIndex] = data;
    writeFileSync('./daily_log.json', logs);
  } catch (err) {
    success = false;
    log.error(err, '/dailylog/update');
  }
  res.json({ success, message: '更新' + (success ? '成功' : '失败') });
});

// 删除记录
router.options('/dailylog/delete', function(req, res) {
  crossDomain(req, res);
  res.json({ success: true });
});
router.post('/dailylog/delete', function(req, res) {
  crossDomain(req, res);
  let success = true;
  try {
    delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
    const logs = require(path.join(dataPath, 'daily_log.json'));
    const logId = req.body.id;
    
    const logIndex = logs.findIndex(log => log.id == logId);
    if (logIndex === -1) {
      return res.json({ success: false, message: '记录不存在' });
    }
    
    const logToDelete = logs[logIndex];
    
    // 删除关联的图片文件
    if (logToDelete.images) {
      logToDelete.images.forEach(img => {
        const imagePath = path.join(dataPath, `upload/image/${img.url}`);
        if (fs.existsSync(imagePath)) {
          try {
            const removeDir = ensureDir(path.join(dataPath, 'upload/image'), 'remove');
            const targetPath = path.join(removeDir, img.url);
            fs.renameSync(imagePath, targetPath);
          } catch (err) {
            log.error(err, '/dailylog/delete renameSync');
          }
        }
      });
    }
    
    const logRemoveData = ensureJson('./daily_log_remove.json', []);
    logRemoveData.unshift(logToDelete);
    writeFileSync('./daily_log_remove.json', logRemoveData);
    
    logs.splice(logIndex, 1);
    writeFileSync('./daily_log.json', logs);
  } catch (err) {
    success = false;
    log.error(err, '/dailylog/delete');
  }
  res.json({ success, message: '删除' + (success ? '成功' : '失败') });
});

// 获取统计数据
router.get('/dailylog/stats', function(req, res) {
  crossDomain(req, res);
  let success = true;
  let stats = {};
  try {
    delete require.cache[require.resolve(path.join(dataPath, 'daily_log.json'))];
    const logs = require(path.join(dataPath, 'daily_log.json'));

    let startDate, endDate, days;

    if (req.query.startDate && req.query.endDate) {
      startDate = moment(req.query.startDate);
      endDate = moment(req.query.endDate);
      days = endDate.diff(startDate, 'days') + 1;
    } else {
      days = parseInt(req.query.days) || 7;
      endDate = moment();
      startDate = moment().subtract(days - 1, 'days');
    }

    const dailyData = {};
    for (let i = 0; i < days; i++) {
      const dateStr = moment(startDate).add(i, 'days').format('YYYY-MM-DD');
      dailyData[dateStr] = { milk: 0, poop: 0, pee: 0 };
    }

    logs.forEach(log => {
      const logDate = moment(log.createat).format('YYYY-MM-DD');
      if (dailyData[logDate]) {
        if (log.type === 'milk') {
          dailyData[logDate].milk += parseInt(log.amount) || 0;
        } else if (log.type === 'poop') {
          dailyData[logDate].poop++;
        } else if (log.type === 'pee') {
          dailyData[logDate].pee++;
        }
      }
    });

    const labels = Object.keys(dailyData).sort();
    stats = {
      labels,
      milk: labels.map(d => dailyData[d].milk),
      poop: labels.map(d => dailyData[d].poop),
      pee: labels.map(d => dailyData[d].pee)
    };
  } catch (err) {
    success = false;
    log.error(err, '/dailylog/stats');
  }
  res.json({ success, data: stats });
});



module.exports = router;