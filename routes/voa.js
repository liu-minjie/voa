const config = require('../config');
const express = require('express');
const router = express.Router();
const request = require('request');
const fs = require('fs');
const path = require('path');
const util = require('../util');
const videoJson = require('./english.json');
const { exec } = require('child_process');

const log = util.logger.voa;

/* GET home page. */
router.get('/', function(req, res, next) {
	let list = [];
	try {
		list = fs.readdirSync('./media');
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
    list = fs.readdirSync('./media/' + req.params.month);
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
		lrc = fs.readFileSync(`./media/${req.params.month}/${req.params.name}/${req.params.name}.lrc`, { encoding: 'utf8'});
		txt = req.params.month === 'o' ? '' : fs.readFileSync(`./media/${req.params.month}/${req.params.name}/${req.params.name}.txt`, { encoding: 'utf8'});
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
		lrc = fs.readFileSync(`./media/movie/${req.params.movie}/${req.params.season}/${req.params.name}/${req.params.name}.lrc`, { encoding: 'utf8'});
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
    const month = req.params.month + '';
    const part = month.split('_')
    const name = req.params.name.trim().replace(/\.mp3$/, '');
    let file = `../media/${req.params.month}/${name}/${name}.mp3`;
    if (part.length == 2) {
      file = `../media/move/${part[0]}/${part[1]}/${name}/${name}.mp3`;
    }
    res.sendFile(path.join(__dirname, file), {
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
    list = fs.readdirSync('./video');
    list = JSON.stringify(list.filter((it) => {
      return it.match(/mp4$/) && !videoJson[it];
    }))
  } catch(err) {
    log.error(err, '/lrc');
  }
	res.render('lrc', { list });
});

router.get('/lrc/videos/:name', function(req, res, next) {
  res.sendFile(path.join(__dirname,`../video/${req.params.name}`), (err) => {
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
	const cmd = `docker exec srt_worker_final python3 /app/extract_srt.py "/app/video/${videoName}" ${y_start} ${y_end} ${x_start} ${x_end}`;
	
	exec(cmd, (error, stdout, stderr) => {
		if (error) {
      log.eror(err, '/lrc/extract docker cmd')
      return res.status(500).json({ error: error.message });
    } 
		videoJson[videoName] = 1;
    try {
      fs.writeFileSync('./routes/english.json', JSON.stringify(videoJson, null, 2), 'utf8');
    } catch (err) {
      log.error(err, '/lrc/extract write json');
      return res.status(500).json({ error: err.message });
    }
		

		const oldMp3 = `./video/mp3/${videoName.replace('mp4', 'mp3')}`
		if (fs.existsSync(oldMp3)) {
			const dir = videoName.replace('.mp4', '');
			fs.rename(oldMp3, `./media/o/${dir}/${dir}.mp3`, (err) => {
				if (err) {
          log.eror(err, '/lrc/extract rename')
					return res.status(500).json({ error: err.message });
				}
				videoJson[videoName] = 2;
				fs.writeFileSync('./routes/english.json', JSON.stringify(videoJson, null, 2), 'utf8');
				res.json({ success: true });
			});
		} else {
			const dir = videoName.replace('.mp4', '');
			const src = path.join(__dirname, `../video/${videoName}`);
			const dst = path.join(__dirname, `../media/movie/o/s1/${dir}/${dir}.mp3`);
			const cmd = `ffmpeg -i "${src}" -q:a 0 -map a "${dst}"`
			exec(cmd, (error, stdout, stderr) => {
				if (error) {
          log.eror(err, '/lrc/extract ffmpeg cmd')
          return res.status(500).json({ error: error.message });
        } 
				videoJson[videoName] = 2;
				fs.writeFileSync('./routes/english.json', JSON.stringify(videoJson, null, 2), 'utf8');
				res.json({ success: true });
			})
		}
	});
});

router.post('/lrc/videos/rename', (req, res) => {
	const { videoName, newName } = req.body;
	let msg = '';
	try {
		fs.renameSync(`./video/${videoName}`, `./video/${newName}.mp4`);
	} catch(err) {
		log.error(err, '/lrc/videos/rename');
		msg = err.message;
	}
	res.json({ success: !msg, message: msg });
});

module.exports = router;
