const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const dataPath = config.dataPath;

const musicPath = path.resolve(__dirname, '../../../music');

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
};

router.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '../views/song_admin.html'));
});

router.get('/search', function(req, res) {
  const keyword = req.query.keyword || '';
  const results = [];

  try {
    function searchDir(dir, relativePath) {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const fullPath = path.join(dir, file);
        const relPath = relativePath ? path.join(relativePath, file) : file;
        const stat = fs.statSync(fullPath);

        if (stat.isDirectory()) {
          searchDir(fullPath, relPath);
        } else if (file.toLowerCase().includes(keyword.toLowerCase())) {
          results.push({
            filename: file,
            path: relPath,
            size: stat.size,
            modified: stat.mtime
          });
        }
      }
    }

    if (fs.existsSync(musicPath)) {
      searchDir(musicPath, '');
    }

    res.json({ success: true, data: results });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/list', function(req, res) {
  try {
    const songs = ensureJson('song.json', []);
    res.json({ success: true, data: songs });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/add', function(req, res) {
  try {
    const { filename } = req.body;
    if (!filename) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const songs = ensureJson('song.json', []);
    
    const exists = songs.some(s => s.filename === filename);
    if (exists) {
      return res.json({ success: false, message: '该歌曲已存在' });
    }

    const newSong = {
      id: Date.now(),
      filename,
      addedAt: Date.now()
    };

    songs.unshift(newSong);
    writeFileSync('song.json', songs);

    res.json({ success: true, data: newSong });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/rename', function(req, res) {
  try {
    const { id, newName } = req.body;
    if (!id || !newName) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const songs = ensureJson('song.json', []);
    const index = songs.findIndex(s => s.id === id);
    
    if (index === -1) {
      return res.json({ success: false, message: '歌曲不存在' });
    }

    songs[index].filename = newName;
    writeFileSync('song.json', songs);

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/delete', function(req, res) {
  try {
    const { id } = req.body;
    if (!id) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const songs = ensureJson('song.json', []);
    const newSongs = songs.filter(s => s.id !== id);
    
    if (newSongs.length === songs.length) {
      return res.json({ success: false, message: '歌曲不存在' });
    }

    writeFileSync('song.json', newSongs);

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.get('/dir', function(req, res) {
  const dir = req.query.dir || '';
  const fullPath = path.join(musicPath, dir);
  console.log(fullPath)

  try {
    if (!fs.existsSync(fullPath)) {
      return res.json({ success: false, message: '目录不存在' });
    }

    const stat = fs.statSync(fullPath);
    if (!stat.isDirectory()) {
      return res.json({ success: false, message: '不是目录' });
    }

    const files = fs.readdirSync(fullPath);
    const result = [];

    for (const file of files) {
      if (file.startsWith('.')) continue;
      
      const fileFullPath = path.join(fullPath, file);
      const fileStat = fs.statSync(fileFullPath);
      const relPath = dir ? path.join(dir, file) : file;

      result.push({
        name: file,
        path: relPath,
        isDirectory: fileStat.isDirectory(),
        size: fileStat.size,
        modified: fileStat.mtime
      });
    }

    result.sort((a, b) => {
      if (a.isDirectory !== b.isDirectory) {
        return a.isDirectory ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });

    res.json({ success: true, data: result, currentDir: dir });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/rename-file', function(req, res) {
  try {
    const { path: relPath, newName } = req.body;
    if (!relPath || !newName) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const oldFullPath = path.join(musicPath, relPath);
    const dir = path.dirname(relPath);
    const newFullPath = path.join(musicPath, dir, newName);

    if (!fs.existsSync(oldFullPath)) {
      return res.json({ success: false, message: '文件不存在' });
    }

    if (fs.existsSync(newFullPath)) {
      return res.json({ success: false, message: '目标文件已存在' });
    }

    fs.renameSync(oldFullPath, newFullPath);

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/delete-file', function(req, res) {
  try {
    const { path: relPath } = req.body;
    if (!relPath) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const fullPath = path.join(musicPath, relPath);

    if (!fs.existsSync(fullPath)) {
      return res.json({ success: false, message: '文件不存在' });
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

module.exports = router;