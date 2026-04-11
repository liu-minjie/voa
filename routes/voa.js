const config = require('../config');
const express = require('express');
const router = express.Router();
const request = require('request');
const fs = require('fs');
const path = require('path');
const util = require('../util');
const dataPath = config.dataPath;
const videoJson = require(path.join(dataPath, 'voa/english.json'));
const { exec } = require('child_process');

const log = util.logger.voa;

/* GET home page. */
router.get('/', function(req, res, next) {
	let list = [];
	try {
		list = fs.readdirSync(path.join(dataPath, 'voa/media'));
		list = JSON.stringify(list.filter((it) => {
			return it.match(/^\d+$/);
		}))
	} catch (err) {
		log.error(err, '/voa/');
	}
	res.render('voa_list', { list });
});

router.get('/month/:month', function(req, res, next) {
  let list = [];
  try {
    const month = path.basename(req.params.month);
    list = fs.readdirSync(path.join(dataPath, 'voa/media', month));
    list = JSON.stringify(list.filter((it) => {
      return it[0] !== '.'
    }))
  }  catch (err) {
    log.error(err, '/month/:month');
  }
	res.render('voa_month', {
		month: req.params.month,
		list 
	});
});

router.get('/month/:month/:name', function(req, res, next) {
  let lrc = '';
  let txt = '';
  let data = '';
	try {
    const month = path.basename(req.params.month);
    const name = path.basename(req.params.name);
		lrc = fs.readFileSync(path.join(dataPath, 'voa/media', month, name, `${name}.lrc`), { encoding: 'utf8'});
		txt = month === 'o' ? '' : fs.readFileSync(path.join(dataPath, 'voa/media', month, name, `${name}.txt`), { encoding: 'utf8'});
	  data = JSON.stringify({
      month: req.params.month,
      name: req.params.name,
      lrc,
      txt
    })
  } catch (err) {
    log.error(err, '/month/:month/:name');
		res.render('error', {
			message: err.message,
			error: err
		});
    return
	}
  res.render('voa_player', { data });
});

router.get('/movie/:movie/:season/:name', function(req, res, next) {
  let lrc = '';
  let data = ''
	try {
    const movie = path.basename(req.params.movie);
    const season = path.basename(req.params.season);
    const name = path.basename(req.params.name);
		lrc = fs.readFileSync(path.join(dataPath, 'voa/media/movie', movie, season, name, `${name}.lrc`), { encoding: 'utf8'});
	  data =  JSON.stringify({
      month: `${req.params.movie}_${req.params.season}`,
      name:  req.params.name,
      lrc,
      txt: ''
    })
  } catch (err) {
    log.error(err, '/movie/:movie/:season/:name');
		res.render('error', {
			message: err.message,
			error: err
		})
    return
	}

  res.render('voa_player', { data });
});

router.get('/media/:month/:name', function(req, res, next) {
  try {
    const month = path.basename(req.params.month + '');
    const part = month.split('_')
    const name = path.basename(req.params.name.trim().replace(/\.mp3$/, ''));
    let file = path.join(dataPath, 'voa/media', month, name, `${name}.mp3`);
    if (part.length == 2) {
      const movie = path.basename(part[0]);
      const season = path.basename(part[1]);
      file = path.join(dataPath, 'voa/media/move', movie, season, name, `${name}.mp3`);
    }
    res.sendFile(file, {
      maxAge: '365d',
      immutable: true
    }, (err) => {
      if (err) {
        log.error(err, '/media/:month/:name sendfile');
      }
      if (!res.headersSent) {
        return next(err);
      }
    });
  } catch(err) {
    log.error(err, '/media/:month/:name');
    res.json({ succes: false })
  }
});

router.get('/lrc', function(req, res, next) {
  let list = [];
  try {
    list = fs.readdirSync(path.join(dataPath, 'voa/video'));
    list = JSON.stringify(list.filter((it) => {
      return it.match(/mp4$/) && !videoJson[it];
    }));
  } catch(err) {
    log.error(err, '/lrc');
  }
	res.render('voa_lrc', { list });
});

router.get('/lrc/videos/:name', function(req, res, next) {
  const name = path.basename(req.params.name);
  res.sendFile(path.join(dataPath, 'voa/video', name), (err) => {
  	if (err) {
      log.error(err, '/lrc/videos/:name');
      
      if (!res.headersSent) {
        return next(err);
      }
    }
  });
});




router.post('/lrc/extract', (req, res) => {
	const { videoName, y_start, y_end, x_start, x_end } = req.body;
	const safeVideoName = path.basename(videoName);
	const cmd = `docker exec srt_worker_final python3 /app/extract_srt.py "/app/video/${safeVideoName}" ${y_start} ${y_end} ${x_start} ${x_end}`;
	
	exec(cmd, (error, stdout, stderr) => {
		if (error) {
      log.eror(err, '/lrc/extract docker cmd')
      return res.status(500).json({ error: error.message });
    } 
		videoJson[safeVideoName] = 1;
    try {
      fs.writeFileSync(path.join(dataPath, 'voa/english.json'), JSON.stringify(videoJson, null, 2), 'utf8');
    } catch (err) {
      log.error(err, '/lrc/extract write json');
      return res.status(500).json({ error: err.message });
    }
		

		const oldMp3 = path.join(dataPath, 'voa/video/mp3', safeVideoName.replace('mp4', 'mp3'))
		if (fs.existsSync(oldMp3)) {
			const dir = safeVideoName.replace('.mp4', '');
			fs.rename(oldMp3, path.join(dataPath, 'voa/media/o', dir, `${dir}.mp3`), (err) => {
				if (err) {
          log.eror(err, '/lrc/extract rename')
					return res.status(500).json({ error: err.message });
				}
				videoJson[safeVideoName] = 2;
				fs.writeFileSync(path.join(dataPath, 'voa/english.json'), JSON.stringify(videoJson, null, 2), 'utf8');
				res.json({ success: true });
			});
		} else {
			const dir = safeVideoName.replace('.mp4', '');
			const src = path.join(dataPath, 'voa/video', safeVideoName);
			const dst = path.join(dataPath, 'voa/media/movie/o/s1', dir, `${dir}.mp3`);
			const cmd = `ffmpeg -i "${src}" -q:a 0 -map a "${dst}"`
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
          log.eror(err, '/lrc/extract ffmpeg cmd')
          return res.status(500).json({ error: error.message });
        } 
				videoJson[safeVideoName] = 2;
				fs.writeFileSync(path.join(dataPath, 'voa/english.json'), JSON.stringify(videoJson, null, 2), 'utf8');
				res.json({ success: true });
			})
		}
	});
});

router.post('/lrc/videos/rename', (req, res) => {
	const { videoName, newName } = req.body;
	const safeVideoName = path.basename(videoName);
	const safeNewName = path.basename(newName);
	let msg = '';
	try {
		fs.renameSync(path.join(dataPath, 'voa/video', safeVideoName), path.join(dataPath, 'voa/video', `${safeNewName}.mp4`));
	} catch(err) {
		log.error(err, '/lrc/videos/rename');
		msg = err.message;
	}
	res.json({ success: !msg, message: msg });
});

module.exports = router;
