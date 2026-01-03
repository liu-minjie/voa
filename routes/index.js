const config = require('../config');
const express = require('express');
const router = express.Router();
const request = require('request');
const fs = require('fs');
const path = require('path');
const util = require('../util');
const videoJson = require('./video.json');
const { exec } = require('child_process');

/* GET home page. */
router.get('/', function(req, res, next) {
	const list = fs.readdirSync('./media');
	res.render('list', {
		list: JSON.stringify(list.filter((it) => {
			return it.match(/^\d+$/) || it === 'o'
		}))
	});
});



router.get('/voa/:month', function(req, res, next) {
	const list = fs.readdirSync('./media/' + req.params.month);
	res.render('month', {
		month: req.params.month,
		list: JSON.stringify(list.filter((it) => {
			return it[0] !== '.'
		}))
	});
});


router.get('/voa/:month/:name', function(req, res, next) {
	try {
		const lrc = fs.readFileSync(`./media/${req.params.month}/${req.params.name}/${req.params.name}.lrc`, { encoding: 'utf8'});
		const txt = fs.readFileSync(`./media/${req.params.month}/${req.params.name}/${req.params.name}.txt`, { encoding: 'utf8'});
		res.render('index', {
			
			data: JSON.stringify({
				month: req.params.month,
				name: req.params.name,
				lrc,
				txt
			})
		});
	} catch (err) {
		res.render('error', {
			message: err.message,
			error: err
		})
	}
});

router.get('/friend/:season/:name', function(req, res, next) {
	try {
		const lrc = fs.readFileSync(`./media/${req.params.season}/${req.params.name}/${req.params.name}.lrc`, { encoding: 'utf8'});
		res.render('index', {
			
			data: JSON.stringify({
				month: req.params.season,
				name:  req.params.name,
				lrc,
				txt: ''
			})
		});
	} catch (err) {
		res.render('error', {
			message: err.message,
			error: err
		})
	}
});

router.get('/media/:month/:name', function(req, res, next) {
	const name = req.params.name.trim().replace(/\.mp3$/, '')
	res.sendFile(path.join(__dirname, `../media/${req.params.month}/${name}/${name}.mp3`), {}, (err) => {
		err && console.log(err.message);
	});
});



router.get('/o/:name', function(req, res, next) {
	try {
		const lrc = fs.readFileSync(`./media/o/${req.params.name}/${req.params.name}.lrc`, { encoding: 'utf8'});
		res.render('index', {
			
			data: JSON.stringify({
				month: 'o',
				name:  req.params.name,
				lrc,
				txt: ''
			})
		});
	} catch (err) {
		res.render('error', {
			message: err.message,
			error: err
		})
	}
});



router.get('/lrc', function(req, res, next) {
	const list = fs.readdirSync('./video');
	res.render('lrc', {
		list: JSON.stringify(list.filter((it) => {
			return it.match(/mp4$/) && !videoJson[it];
		}))
	});
});




router.get('/videos/:name', function(req, res, next) {
  res.sendFile(path.join(__dirname,`../video/${req.params.name}`), (err) => {
  	if (err) {
        if (err.code === 'ECONNRESET' || err.code === 'EPIPE') {
            return;
        }
        
        if (!res.headersSent) {
            return next(err);
        }
    } else {
        console.log(`[Success] 视频传输完成: ${req.params.name}`);
    }
  });
});




router.post('/extract', (req, res) => {
	const { videoName, y_start, y_end, x_start, x_end } = req.body;
	const cmd = `docker exec srt_worker_final python3 /app/extract_srt.py "/app/video/${videoName}" ${y_start} ${y_end} ${x_start} ${x_end}`;
	
	exec(cmd, (error, stdout, stderr) => {
		if (error) return res.status(500).json({ error: error.message });
		videoJson[videoName] = 1;
		fs.writeFileSync('./video.json', JSON.stringify(videoJson, null, 2), 'utf8');

		const oldMp3 = `./video/mp3/${videoName.replace('mp4', 'mp3')}`
		if (fs.existsSync(oldMp3)) {
			const dir = videoName.replace('.mp4', '');
			fs.rename(oldMp3, `./media/o/${dir}/${dir}.mp3`, (err) => {
				if (err) {
					return res.status(500).json({ error: err.message });
				}
				videoJson[videoName] = 2;
				fs.writeFileSync('./video.json', JSON.stringify(videoJson, null, 2), 'utf8');
				res.json({ success: true });
			});
		} else {
			const dir = videoName.replace('.mp4', '');
			const src = path.join(__dirname, `../video/${videoName}`);
			const dst = path.join(__dirname, `../media/o/${dir}/${dir}.mp3`);
			const cmd = `ffmpeg -i "${src}" -q:a 0 -map a "${dst}"`
			exec(cmd, (error, stdout, stderr) => {
				if (error) return res.status(500).json({ error: error.message });
				videoJson[videoName] = 2;
				fs.writeFileSync('./video.json', JSON.stringify(videoJson, null, 2), 'utf8');
				res.json({ success: true });
			})
		}
	});
});

router.post('/videos/rename', (req, res) => {
	const { videoName, newName } = req.body;
	let msg = '';
	try {
		fs.renameSync(`./video/${videoName}`, `./video/${newName}.mp4`);
	} catch(err) {
		console.log(err);
		msg = err.message;
	}
	res.json({ success: !msg, message: msg });
});

module.exports = router;
