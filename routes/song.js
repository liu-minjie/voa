const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const config = require('../config');
const dataPath = config.dataPath;
const ffmpeg = require('fluent-ffmpeg');

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

function saveComposerInfo(songName, genreValue) {
  if (!songName || !genreValue) return;
  
  // 1. 更新 songMeta.json: {歌名: genre字段值}
  const songJsonPath = path.join(dataPath, 'songMeta.json');
  let songData = {};
  if (fs.existsSync(songJsonPath)) {
    try {
      songData = JSON.parse(fs.readFileSync(songJsonPath, 'utf8'));
    } catch (e) {
      // ignore parse error
    }
  }
  songData[songName] = genreValue;
  fs.writeFileSync(songJsonPath, JSON.stringify(songData, null, 2), 'utf8');
  
  // 2. 更新 composer.json: {genre字段值: [歌名1, 歌名2]}
  const composerJsonPath = path.join(dataPath, 'composer.json');
  let composerData = {};
  if (fs.existsSync(composerJsonPath)) {
    try {
      composerData = JSON.parse(fs.readFileSync(composerJsonPath, 'utf8'));
    } catch (e) {
      // ignore parse error
    }
  }
  
  const composers = genreValue.split('-').map(c => c.trim()).filter(c => c);
  composers.forEach(composer => {
    if (!composerData[composer]) {
      composerData[composer] = [];
    }
    if (!composerData[composer].includes(songName)) {
      composerData[composer].push(songName);
    }
  });
  
  fs.writeFileSync(composerJsonPath, JSON.stringify(composerData, null, 2), 'utf8');
}

function updateComposerInfoOnRename(oldName, newName) {
  if (!oldName || !newName || oldName === newName) return;
  
  const songJsonPath = path.join(dataPath, 'songMeta.json');
  let songData = {};
  
  // 1. 读取 songMeta.json
  if (fs.existsSync(songJsonPath)) {
    try {
      songData = JSON.parse(fs.readFileSync(songJsonPath, 'utf8'));
    } catch (e) {
      // ignore parse error
    }
  }
  
  // 2. 获取 genre 值并更新 songMeta.json
  const genreValue = songData[oldName];
  if (genreValue !== undefined) {
    songData[newName] = genreValue;
    delete songData[oldName];
    fs.writeFileSync(songJsonPath, JSON.stringify(songData, null, 2), 'utf8');
    
    // 3. 更新 composer.json 中对应的数组
    const composerJsonPath = path.join(dataPath, 'composer.json');
    if (fs.existsSync(composerJsonPath)) {
      try {
        const composerData = JSON.parse(fs.readFileSync(composerJsonPath, 'utf8'));
        const composers = genreValue.split('-').map(c => c.trim()).filter(c => c);
        
        composers.forEach(composer => {
          const songs = composerData[composer];
          if (songs) {
            const index = songs.indexOf(oldName);
            if (index !== -1) {
              songs[index] = newName;
            }
          }
        });
        
        fs.writeFileSync(composerJsonPath, JSON.stringify(composerData, null, 2), 'utf8');
      } catch (e) {
        // ignore parse error
      }
    }
  }
}

router.get('/', function(req, res) {
  res.sendFile(path.join(__dirname, '../views/song_admin.html'));
});

const crypto = require('crypto');
const transcodeStatus = {};

function getCachePath(filePath) {
  const hash = crypto.createHash('md5').update(filePath).digest('hex');
  return path.join(dataPath, 'cache', 'audio', `${hash}.mp3`);
}

function ensureCacheDir() {
  const cacheDir = path.join(dataPath, 'cache', 'audio');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }
}

function transcodeToCache(inputPath, cachePath, key) {
  transcodeStatus[key] = { status: 'transcoding', progress: 0 };
  ffmpeg(inputPath)
    .audioCodec('libmp3lame')
    .audioBitrate(192)
    .format('mp3')
    .on('progress', (progress) => {
      if (progress.percent) {
        transcodeStatus[key].progress = Math.round(progress.percent);
      }
    })
    .on('error', (err) => {
      console.error('FFmpeg transcode error:', err);
      transcodeStatus[key] = { status: 'error', message: err.message };
    })
    .on('end', () => {
      console.log('Transcode completed:', cachePath);
      transcodeStatus[key] = { status: 'completed', progress: 100 };
    })
    .save(cachePath);
}

router.get('/transcode-status', function(req, res) {
  const filePath = req.query.path;  
  if (!filePath) {
    return res.status(400).json({ success: false, message: '缺少路径参数' });
  }

  const key = crypto.createHash('md5').update(filePath).digest('hex');
  const status = transcodeStatus[key];
  
  res.json({
    success: true,
    data: status || { status: 'unknown' },
    hasCache: fs.existsSync(getCachePath(filePath))
  });
});

router.get('/file-cache', function(req, res) {
  const filePath = req.query.path;
  
  if (!filePath) {
    return res.status(400).json({ success: false, message: '缺少路径参数' });
  }

  const fullPath = path.join(musicPath, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }

  const resolvedPath = path.resolve(fullPath);
  if (!resolvedPath.startsWith(musicPath)) {
    return res.status(403).json({ success: false, message: '非法路径' });
  }

  const cachePath = getCachePath(filePath);
  const key = crypto.createHash('md5').update(filePath).digest('hex');
  ensureCacheDir();

  if (!fs.existsSync(cachePath)) {
    if (transcodeStatus[key] && transcodeStatus[key].status === 'transcoding') {
      return res.status(202).json({ success: false, message: '转码中，请等待', status: 'transcoding', progress: transcodeStatus[key].progress });
    }

    transcodeToCache(resolvedPath, cachePath, key);
    return res.status(202).json({ success: false, message: '开始转码', status: 'starting', progress: 0 });
  }

  res.setHeader('Content-Type', 'audio/mpeg');
  res.sendFile(cachePath);
});

router.get('/file', function(req, res) {
  const filePath = req.query.path;
  const transcode = req.query.transcode === '1';
  
  
  if (!filePath) {
    return res.status(400).json({ success: false, message: '缺少路径参数' });
  }

  const fullPath = path.join(musicPath, filePath);
  
  if (!fs.existsSync(fullPath)) {
    return res.status(404).json({ success: false, message: '文件不存在' });
  }

  const resolvedPath = path.resolve(fullPath);
  
  if (!resolvedPath.startsWith(musicPath)) {
    return res.status(403).json({ success: false, message: '非法路径' });
  }

  const ext = path.extname(filePath).toLowerCase();
  const needTranscode = transcode || ['.ape'].includes(ext);

  if (needTranscode) {
    res.setHeader('Content-Type', 'audio/mpeg');
    
    const ffmpegCommand = ffmpeg(resolvedPath)
      .audioCodec('libmp3lame')
      .audioBitrate(192)
      .format('mp3')
      .on('start', (commandLine) => {
      })
      .on('progress', (progress) => {
      })
      .on('error', (err) => {
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: '转码失败' });
        }
      })
      .on('end', () => {
      });
    
    ffmpegCommand.pipe(res);
  } else {
    res.sendFile(resolvedPath);
  }
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
        const stat = fs.lstatSync(fullPath);

        if (stat.isDirectory()) {
          if (!stat.isSymbolicLink()) {
            searchDir(fullPath, relPath);
          }
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

    const countryPath = path.join(musicPath, 'country');
    const countryExists = fs.existsSync(countryPath) && fs.statSync(countryPath).isDirectory();
    const lightPath = path.join(musicPath, 'Light');
    const lightExists = fs.existsSync(lightPath) && fs.statSync(lightPath).isDirectory();

    // 读取 song.json 获取作曲人信息
    const songJsonPath = path.join(dataPath, 'songMeta.json');
    let composerMap = {};
    if (fs.existsSync(songJsonPath)) {
      try {
        composerMap = JSON.parse(fs.readFileSync(songJsonPath, 'utf8'));
      } catch (e) {
        composerMap = {};
      }
    }

    for (const file of files) {
      if (file.startsWith('.')) continue;
      
      const fileFullPath = path.join(fullPath, file);
      const fileStat = fs.lstatSync(fileFullPath);
      const relPath = dir ? path.join(dir, file) : file;

      let linkedIn = [];
      let isPure = false;
      if (fileStat.isDirectory() && !fileStat.isSymbolicLink()) {
        const realFullPath = fs.realpathSync(fileFullPath);
        if (countryExists) {
          const countrySymlinks = findSymlinksTo(realFullPath, countryPath);
          linkedIn = countrySymlinks.map(lp => path.basename(path.dirname(lp)));
        }
        if (lightExists) {
          const lightSymlinks = findSymlinksTo(realFullPath, lightPath);
          isPure = lightSymlinks.length > 0;
        }
      }

      // 获取文件的作曲人信息
      let composer = '';
      if (fileStat.isFile()) {
        const songName = path.basename(file, path.extname(file));
        composer = composerMap[songName] || '';
      }

      result.push({
        name: file,
        path: relPath,
        isDirectory: fileStat.isDirectory(),
        isSymbolicLink: fileStat.isSymbolicLink(),
        size: fileStat.size,
        modified: fileStat.mtime,
        linkedIn: linkedIn,
        isPure: isPure,
        composer: composer
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

function findSymlinksTo(targetPath, searchDir) {
  const symlinks = [];
  try {
    const items = fs.readdirSync(searchDir, { withFileTypes: true });
    for (const item of items) {
      const itemPath = path.join(searchDir, item.name);
      if (item.isSymbolicLink()) {
        const linkTarget = fs.readlinkSync(itemPath);
        const resolvedTarget = path.isAbsolute(linkTarget) ? linkTarget : path.join(path.dirname(itemPath), linkTarget);
        if (resolvedTarget === targetPath || path.resolve(resolvedTarget) === path.resolve(targetPath)) {
          symlinks.push(itemPath);
        }
      } else if (item.isDirectory()) {
        symlinks.push(...findSymlinksTo(targetPath, itemPath));
      }
    }
  } catch (err) {
  }
  return symlinks;
}

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

    const stat = fs.lstatSync(oldFullPath);
    const symlinks = [];
    if (stat.isDirectory()) {
      symlinks.push(...findSymlinksTo(oldFullPath, musicPath));
    }

    for (const linkPath of symlinks) {
      fs.unlinkSync(linkPath);
    }

    fs.renameSync(oldFullPath, newFullPath);

    for (const linkPath of symlinks) {
      const linkDir = path.dirname(linkPath);
      const newLinkPath = path.join(linkDir, newName);
      const newLinkTarget = path.relative(linkDir, newFullPath);
      fs.symlinkSync(newLinkTarget, newLinkPath);
    }

    // 更新 song.json 和 composer.json 中的歌名
    if (stat.isFile()) {
      const oldSongName = path.basename(relPath, path.extname(relPath));
      const newSongName = path.basename(newName, path.extname(newName));
      updateComposerInfoOnRename(oldSongName, newSongName);
    }

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

    const stat = fs.lstatSync(fullPath);
    if (stat.isSymbolicLink()) {
      fs.unlinkSync(fullPath);
    } else if (stat.isDirectory()) {
      const symlinks = findSymlinksTo(fullPath, musicPath);
      for (const linkPath of symlinks) {
        fs.unlinkSync(linkPath);
      }
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/mkdir', function(req, res) {
  try {
    const { dir, name } = req.body;
    if (!name) {
      return res.json({ success: false, message: '缺少目录名参数' });
    }

    const parentPath = dir ? path.join(musicPath, dir) : musicPath;
    const newDirPath = path.join(parentPath, name);

    if (fs.existsSync(newDirPath)) {
      return res.json({ success: false, message: '目录已存在' });
    }

    fs.mkdirSync(newDirPath, { recursive: true });

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/symlink', function(req, res) {
  try {
    const { source, target } = req.body;
    if (!source || !target) {
      return res.json({ success: false, message: '缺少源目录或目标目录参数' });
    }

    // source 和 target 都是相对 music 的路径
    // ln -s A B/A：在 target 下创建指向 source 的软链接，链接名为 source 的 basename
    const sourcePath = path.join(musicPath, source);
    const targetDir = path.join(musicPath, target);
    const linkName = path.basename(sourcePath);
    const linkPath = path.join(targetDir, linkName);

    // 安全检查：防止越界
    if (!path.resolve(sourcePath).startsWith(musicPath) || !path.resolve(targetDir).startsWith(musicPath)) {
      return res.json({ success: false, message: '非法路径' });
    }

    if (!fs.existsSync(sourcePath)) {
      return res.json({ success: false, message: '源目录不存在' });
    }
    if (!fs.existsSync(targetDir)) {
      return res.json({ success: false, message: '目标目录不存在' });
    }
    if (fs.existsSync(linkPath)) {
      return res.json({ success: false, message: '软链接已存在' });
    }

    // 使用绝对路径创建软链接，避免相对路径引用混乱
    fs.symlinkSync(path.resolve(sourcePath), linkPath, 'dir');
    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

router.post('/hardlink', function(req, res) {
  try {
    const { sourcePath, targetPath, targetFilename } = req.body;
    
    if (!sourcePath || !targetPath || !targetFilename) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const sourceFullPath = path.join(musicPath, sourcePath);
    const targetFullPath = path.join(musicPath, targetPath);
    const sourceDir = path.dirname(sourceFullPath);
    const newLinkPath = path.join(sourceDir, targetFilename);

    if (!fs.existsSync(sourceFullPath)) {
      return res.json({ success: false, message: '源文件不存在' });
    }

    if (!fs.existsSync(targetFullPath)) {
      return res.json({ success: false, message: '目标文件不存在' });
    }

    fs.unlinkSync(sourceFullPath);
    fs.linkSync(targetFullPath, newLinkPath);

    res.json({ success: true });
  } catch (err) {
    res.json({ success: false, message: err.message });
  }
});

const multiparty = require('multiparty');

router.post('/upload', function(req, res) {
  const form = new multiparty.Form();
  
  form.parse(req, function(err, fields, files) {
    if (err) {
      return res.json({ success: false, message: '上传失败: ' + err.message });
    }
    
    const targetDir = fields.dir ? fields.dir[0] : '';
    const uploadFiles = files.files || [];
    
    if (uploadFiles.length === 0) {
      return res.json({ success: false, message: '请选择要上传的文件' });
    }
    
    const targetPath = path.join(musicPath, targetDir);
    
    if (!fs.existsSync(targetPath)) {
      return res.json({ success: false, message: '目标目录不存在' });
    }
    
    const uploaded = [];
    const failed = [];
    
    for (const file of uploadFiles) {
      const filename = file.originalFilename;
      const tempPath = file.path;
      const destPath = path.join(targetPath, filename);
      
      try {
        fs.copyFileSync(tempPath, destPath);
        fs.unlinkSync(tempPath);
        uploaded.push(filename);
      } catch (copyErr) {
        failed.push(filename);
      }
    }
    
    res.json({
      success: true,
      message: `成功上传 ${uploaded.length} 个文件${failed.length > 0 ? `，失败 ${failed.length} 个` : ''}`,
      uploaded,
      failed
    });
  });
});

router.post('/move', function(req, res) {
  try {
    const { source, target } = req.body;
    const sourcePath = path.join(musicPath, source);
    const targetDir = path.join(musicPath, target);
    const filename = path.basename(sourcePath);
    const targetPath = path.join(targetDir, filename);

    if (!fs.existsSync(sourcePath)) {
      return res.json({ success: false, message: '源文件/目录不存在' });
    }

    if (!fs.existsSync(targetDir)) {
      return res.json({ success: false, message: '目标目录不存在' });
    }

    if (fs.existsSync(targetPath)) {
      return res.json({ success: false, message: '目标位置已存在同名文件/目录' });
    }

    const stat = fs.lstatSync(sourcePath);
    const symlinks = [];
    if (stat.isDirectory()) {
      symlinks.push(...findSymlinksTo(sourcePath, musicPath));
    }

    for (const linkPath of symlinks) {
      fs.unlinkSync(linkPath);
    }

    fs.renameSync(sourcePath, targetPath);

    for (const linkPath of symlinks) {
      const linkDir = path.dirname(linkPath);
      const newLinkTarget = path.relative(linkDir, targetPath);
      fs.symlinkSync(newLinkTarget, linkPath);
    }

    res.json({ success: true, message: '移动成功' });
  } catch (err) {
    res.json({ success: false, message: '移动失败: ' + err.message });
  }
});

router.post('/batch-move', function(req, res) {
  try {
    const { sources, target } = req.body;
    const targetDir = path.join(musicPath, target);

    if (!Array.isArray(sources) || sources.length === 0) {
      return res.json({ success: false, message: '请选择要移动的文件' });
    }

    if (!fs.existsSync(targetDir)) {
      return res.json({ success: false, message: '目标目录不存在' });
    }

    const moved = [];
    const failed = [];

    for (const source of sources) {
      const sourcePath = path.join(musicPath, source);
      const filename = path.basename(sourcePath);
      const targetPath = path.join(targetDir, filename);

      if (!fs.existsSync(sourcePath)) {
        failed.push(filename);
        continue;
      }

      if (fs.existsSync(targetPath)) {
        failed.push(filename);
        continue;
      }

      try {
        const stat = fs.lstatSync(sourcePath);
        const symlinks = [];
        if (stat.isDirectory()) {
          symlinks.push(...findSymlinksTo(sourcePath, musicPath));
        }

        for (const linkPath of symlinks) {
          fs.unlinkSync(linkPath);
        }

        fs.renameSync(sourcePath, targetPath);

        for (const linkPath of symlinks) {
          const linkDir = path.dirname(linkPath);
          const newLinkTarget = path.relative(linkDir, targetPath);
          fs.symlinkSync(newLinkTarget, linkPath);
        }

        moved.push(filename);
      } catch (err) {
        failed.push(filename);
      }
    }

    res.json({
      success: moved.length > 0,
      message: `成功移动 ${moved.length} 个文件${failed.length > 0 ? `，失败 ${failed.length} 个` : ''}`,
      moved,
      failed
    });
  } catch (err) {
    res.json({ success: false, message: '批量移动失败: ' + err.message });
  }
});

router.get('/playlist', function(req, res) {
  try {
    const playlistPath = path.join(musicPath, 'help/play.lst');
    if (!fs.existsSync(playlistPath)) {
      return res.json({ success: false, message: '播放列表文件不存在' });
    }

    const content = fs.readFileSync(playlistPath, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    // 读取 songMeta.json 获取作曲人信息
    const songJsonPath = path.join(dataPath, 'songMeta.json');
    let composerMap = {};
    if (fs.existsSync(songJsonPath)) {
      try {
        composerMap = JSON.parse(fs.readFileSync(songJsonPath, 'utf8'));
      } catch (e) {
        composerMap = {};
      }
    }

    const songs = lines.map((line, index) => {
      const parts = line.split('|');
      const filePath = parts[0] || '';
      const songName = path.basename(filePath, path.extname(filePath));
      
      

      return {
        index: index + 1,
        path: filePath,
        title: parts[1] || path.basename(filePath),
        composer: composerMap[songName] || ''
      };
    });

    res.json({ success: true, data: songs });
  } catch (err) {
    res.json({ success: false, message: '读取播放列表失败: ' + err.message });
  }
});

const mm = require('music-metadata');
const ID3 = require('node-id3');

function encodeSize(size) {
  return [
    (size >> 21) & 0x7F,
    (size >> 14) & 0x7F,
    (size >> 7) & 0x7F,
    size & 0x7F
  ];
}

function decodeSize(bytes) {
  return ((bytes[0] & 0x7F) << 21) | ((bytes[1] & 0x7F) << 14) | 
         ((bytes[2] & 0x7F) << 7) | (bytes[3] & 0x7F);
}

function buildTXXXFrame(description, value, useSyncsafe = false) {
  const descBuf = Buffer.from(description, 'utf8');
  const valBuf = Buffer.from(value, 'utf8');
  const contentLen = 1 + descBuf.length + 1 + valBuf.length;
  
  const frame = Buffer.alloc(10 + contentLen);
  frame.write('TXXX', 0, 'ascii');
  
  if (useSyncsafe) {
    const sizeBytes = encodeSize(contentLen);
    frame[4] = sizeBytes[0];
    frame[5] = sizeBytes[1];
    frame[6] = sizeBytes[2];
    frame[7] = sizeBytes[3];
  } else {
    frame.writeUInt32BE(contentLen, 4);
  }
  
  frame[8] = 0;
  frame[9] = 0;
  
  let offset = 10;
  frame[offset++] = 0x03;
  descBuf.copy(frame, offset);
  offset += descBuf.length;
  frame[offset++] = 0x00;
  valBuf.copy(frame, offset);
  
  return frame;
}

function readTXXXFrames(id3v2Buffer) {
  const frames = [];
  
  if (id3v2Buffer.length < 10 || id3v2Buffer.toString('ascii', 0, 3) !== 'ID3') {
    return frames;
  }
  
  const version = id3v2Buffer[3];
  const tagSize = decodeSize([id3v2Buffer[6], id3v2Buffer[7], id3v2Buffer[8], id3v2Buffer[9]]);
  
  let offset = 10;
  const endOffset = offset + tagSize;
  
  while (offset < endOffset) {
    if (offset + 10 > id3v2Buffer.length) break;
    
    const frameId = id3v2Buffer.toString('ascii', offset, offset + 4);
    
    if (frameId === '\x00\x00\x00\x00') break;
    
    let frameSize;
    if (version >= 4) {
      frameSize = decodeSize([id3v2Buffer[offset + 4], id3v2Buffer[offset + 5], id3v2Buffer[offset + 6], id3v2Buffer[offset + 7]]);
    } else {
      frameSize = id3v2Buffer.readUInt32BE(offset + 4);
    }
    
    offset += 10;
    
    if (frameId === 'TXXX') {
      const encoding = id3v2Buffer[offset];
      offset++;
      
      let descStart = offset;
      while (offset < id3v2Buffer.length && id3v2Buffer[offset] !== 0x00) offset++;
      const description = id3v2Buffer.toString('utf8', descStart, offset);
      offset++;
      
      const valueStart = offset;
      const valueLen = frameSize - (offset - descStart);
      const value = id3v2Buffer.toString('utf8', valueStart, valueStart + valueLen);
      frames.push({ description, value });
      
      offset = valueStart + valueLen;
    } else {
      offset += frameSize;
    }
  }
  
  return frames;
}

function readCustomInfoFromMP3(filePath) {
  try {
    const buffer = fs.readFileSync(filePath);
    
    let id3Size = 0;
    let id3v2 = null;
    
    if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
      id3Size = decodeSize([buffer[6], buffer[7], buffer[8], buffer[9]]);
      id3v2 = buffer.slice(0, 10 + id3Size);
    }
    
    if (!id3v2) return [];
    
    const txxxFrames = readTXXXFrames(id3v2);
    const customInfoFrame = txxxFrames.find(f => f.description === 'customInfo');
    
    if (customInfoFrame) {
      return JSON.parse(customInfoFrame.value);
    }
    
    return [];
  } catch (e) {
    return [];
  }
}

function writeCustomInfoToMP3(filePath, customInfo, newTags = {}) {
  const buffer = fs.readFileSync(filePath);
  
  let existingId3Size = 0;
  let audioStart = 0;
  let id3Version = 3;
  
  if (buffer.length >= 10 && buffer.toString('ascii', 0, 3) === 'ID3') {
    id3Version = buffer[3];
    existingId3Size = decodeSize([buffer[6], buffer[7], buffer[8], buffer[9]]);
    audioStart = 10 + existingId3Size;
  }
  
  const id3Tag = ID3.read(buffer);
  
  const standardTags = {};
  if (newTags.title !== undefined) standardTags.title = newTags.title || undefined;
  else if (id3Tag.title) standardTags.title = id3Tag.title;
  if (newTags.artist !== undefined) standardTags.artist = newTags.artist || undefined;
  else if (id3Tag.artist) standardTags.artist = id3Tag.artist;
  if (newTags.album !== undefined) standardTags.album = newTags.album || undefined;
  else if (id3Tag.album) standardTags.album = id3Tag.album;
  if (newTags.genre !== undefined) standardTags.genre = newTags.genre || undefined;
  else if (id3Tag.genre) standardTags.genre = id3Tag.genre;
  if (newTags.year !== undefined) standardTags.year = newTags.year || undefined;
  else if (id3Tag.year) standardTags.year = id3Tag.year;
  if (newTags.trackNumber !== undefined) standardTags.trackNumber = newTags.trackNumber || undefined;
  else if (id3Tag.trackNumber) standardTags.trackNumber = id3Tag.trackNumber;
  if (newTags.partOfSet !== undefined) standardTags.partOfSet = newTags.partOfSet || undefined;
  else if (id3Tag.partOfSet) standardTags.partOfSet = id3Tag.partOfSet;
  
  const originalAudio = buffer.slice(audioStart);
  const resultBuffer = ID3.write(standardTags, originalAudio);
  
  let newId3Tag;
  let newId3Size;
  
  if (resultBuffer.length >= 10 && resultBuffer.toString('ascii', 0, 3) === 'ID3') {
    newId3Size = decodeSize([resultBuffer[6], resultBuffer[7], resultBuffer[8], resultBuffer[9]]);
    newId3Tag = resultBuffer.slice(0, 10 + newId3Size);
    id3Version = resultBuffer[3];
  } else {
    newId3Tag = resultBuffer;
    newId3Size = resultBuffer.length;
  }
  
  const useSyncsafe = id3Version >= 4;
  const txxxFrame = buildTXXXFrame('customInfo', JSON.stringify(customInfo), useSyncsafe);
  const newTagContent = Buffer.concat([newId3Tag.slice(10), txxxFrame]);
  
  const finalTagSize = newTagContent.length;
  const finalHeader = Buffer.alloc(10);
  finalHeader.write('ID3', 0, 'ascii');
  finalHeader[3] = id3Version;
  finalHeader[4] = 0;
  finalHeader[5] = 0;
  const sizeBytes = encodeSize(finalTagSize);
  finalHeader[6] = sizeBytes[0];
  finalHeader[7] = sizeBytes[1];
  finalHeader[8] = sizeBytes[2];
  finalHeader[9] = sizeBytes[3];
  
  const finalId3 = Buffer.concat([finalHeader, newTagContent]);
  const audioData = buffer.slice(audioStart);
  
  fs.writeFileSync(filePath, Buffer.concat([finalId3, audioData]));
}

router.get('/metadata', async function(req, res) {
  try {
    const { filePath } = req.query;
    if (!filePath) {
      return res.json({ success: false, message: '缺少文件路径' });
    }

    const fullPath = path.join(musicPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.json({ success: false, message: '文件不存在' });
    }

    const stat = fs.statSync(fullPath);
    const fileBuffer = fs.readFileSync(fullPath);
    
    let id3Tags = {};
    try {
      id3Tags = ID3.read(fileBuffer) || {};
    } catch (e) {
      // Ignore ID3 read errors
    }
    
    let formatInfo = { duration: 0, bitrate: 0, sampleRate: 0, channels: 0 };
    try {
      const metadata = await mm.parseFile(fullPath);
      formatInfo = {
        duration: metadata.format?.duration || 0,
        bitrate: metadata.format?.bitrate || 0,
        sampleRate: metadata.format?.sampleRate || 0,
        channels: metadata.format?.channels || 0,
      };
    } catch (e) {
      // Ignore format read errors
    }
    
    const customInfo = readCustomInfoFromMP3(fullPath);
    
    const result = {
      title: id3Tags.title || '',
      artist: id3Tags.artist || '',
      album: id3Tags.album || '',
      genre: id3Tags.genre || '',
      year: id3Tags.year || '',
      track: id3Tags.trackNumber || '',
      disc: id3Tags.partOfSet || '',
      duration: formatInfo.duration,
      bitrate: formatInfo.bitrate,
      sampleRate: formatInfo.sampleRate,
      channels: formatInfo.channels,
      fileSize: stat.size,
      customInfo
    };

    res.json({ success: true, data: result });
  } catch (err) {
    res.json({ success: false, message: '读取元信息失败: ' + err.message });
  }
});

router.post('/metadata', async function(req, res) {
  try {
    const { filePath, metadata } = req.body;
    if (!filePath || !metadata) {
      return res.json({ success: false, message: '缺少参数' });
    }

    const fullPath = path.join(musicPath, filePath);
    if (!fs.existsSync(fullPath)) {
      return res.json({ success: false, message: '文件不存在' });
    }

    const tags = {};
    if (metadata.title !== undefined) tags.title = metadata.title;
    if (metadata.artist !== undefined) tags.artist = metadata.artist;
    if (metadata.album !== undefined) tags.album = metadata.album;
    if (metadata.genre !== undefined) tags.genre = metadata.genre;
    if (metadata.year !== undefined) tags.year = metadata.year;
    if (metadata.track !== undefined) tags.trackNumber = metadata.track;
    if (metadata.disc !== undefined) tags.partOfSet = metadata.disc;

    if (metadata.customInfo && Array.isArray(metadata.customInfo)) {
      writeCustomInfoToMP3(fullPath, metadata.customInfo, tags);
    } else {
      const fileBuffer = fs.readFileSync(fullPath);
      const newBuffer = ID3.write(tags, fileBuffer);
      fs.writeFileSync(fullPath, newBuffer);
    }

    // 如果 genre 有值，保存作曲人信息到 song.json 和 composer.json
    if (metadata.genre && metadata.genre.trim()) {
      const songName = path.basename(filePath, path.extname(filePath));
      saveComposerInfo(songName, metadata.genre.trim());
    }

    res.json({ success: true, message: '保存成功' });
  } catch (err) {
    console.error('Save metadata error:', err);
    res.json({ success: false, message: '保存元信息失败: ' + err.message });
  }
});

module.exports = router;