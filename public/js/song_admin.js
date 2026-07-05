let searchResults = [];
let currentDir = '';
let renamePath = '';
let searchTimer = null;
let isComposing = false;
let audio = null;
let avbridgePlayer = null;
let isPlaying = false;
let currentFilePath = '';
let currentFilename = '';
let avbridgeLoaded = false;
let avbridgeLoading = false;

let lastTapTime = 0;
let lastTapElement = null;
let selectedLinkSource = null;
let scrollPositions = new Map();
let focusedNames = new Map();

const NATIVE_FORMATS = ['mp3', 'aac', 'm4a', 'ogg', 'oga', 'wav', 'flac', 'midi', 'mid'];
const AVPROBE_FORMATS = ['wma', 'wmv', 'flv'];

function handleTap(filePath, filename) {
  const now = Date.now();
  if (now - lastTapTime < 300 && lastTapElement === filePath) {
    if (shouldUseTranscode(filename)) {
      playMusicWithCache(filePath, filename);
    } else {
      playMusic(filePath, filename);
    }
    lastTapTime = 0;
    lastTapElement = null;
  } else {
    lastTapTime = now;
    lastTapElement = filePath;
  }
}

function handleMobileAction(select, filePath, filename) {
  const action = select.value;
  select.value = '';
  if (!action) return;
  switch(action) {
    case 'play':
      playMusic(filePath, filename);
      break;
    case 'link':
      handleLinkClick({ stopPropagation: function(){} }, filePath, filename);
      break;
    case 'linkTo':
      createHardLink(selectedLinkSource.path, filePath, filename);
      break;
    case 'rename':
      showRenameModal(filename, filePath);
      break;
    case 'delete':
      if (confirm('确定要删除 ' + filename + ' 吗？')) {
        deleteFile(filePath);
      }
      break;
  }
}

function handleDirAction(select, filePath, filename, isDirectory) {
  const action = select.value;
  select.value = '';
  if (!action) return;
  switch(action) {
    case 'play':
      playMusic(filePath, filename);
      break;
    case 'copy':
      const nameWithoutExt = filename.replace(/\.[^.]+$/, '');
      navigator.clipboard.writeText(nameWithoutExt).then(() => {
        showToast('已复制文件名');
      }).catch(() => {
        showToast('复制失败');
      });
      break;
    case 'rename':
      showRenameModal(filename, filePath);
      break;
    case 'delete':
      if (confirm('确定要删除' + (isDirectory ? '文件夹' : '文件') + ' ' + filename + ' 吗？')) {
        deleteFile(filePath);
      }
      break;
  }
}

function handleLinkClick(e, filePath, filename) {
  e.stopPropagation();
  if (selectedLinkSource && selectedLinkSource.path === filePath) {
    selectedLinkSource = null;
    searchMusic();
    return;
  }
  selectedLinkSource = { path: filePath, filename: filename };
  searchMusic();
}

async function createHardLink(sourcePath, targetPath, targetFilename) {
  try {
    const res = await fetch('/song/link', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetPath, targetFilename })
    });
    const data = await res.json();
    if (data.success) {
      showToast('硬链接创建成功！');
      selectedLinkSource = null;
      searchMusic();
    } else {
      showToast('创建失败: ' + data.message);
    }
  } catch (err) {
    showToast('创建失败: ' + err.message);
  }
}

function getFileExtension(filename) {
  return filename.split('.').pop().toLowerCase();
}

function shouldUseAvbridge(filename) {
  const ext = getFileExtension(filename);
  return AVPROBE_FORMATS.includes(ext);
}

function shouldUseTranscode(filename) {
  const ext = getFileExtension(filename);
  return ['ape'].includes(ext);
}

function loadAvbridge() {
  return new Promise((resolve, reject) => {
    if (avbridgeLoaded) {
      resolve(window.AvbridgeVideoElement);
      return;
    }
    if (avbridgeLoading) {
      const check = setInterval(() => {
        if (avbridgeLoaded) {
          clearInterval(check);
          resolve(window.AvbridgeVideoElement);
        }
      }, 100);
      return;
    }
    avbridgeLoading = true;

    window.AVBRIDGE_LIBAV_BASE = '/public/js/avbridge/vendor/libav';

    const script = document.createElement('script');
    script.type = 'module';
    script.src = '/public/js/avbridge/element-browser.js';
    script.onload = () => {
      const checkElement = () => {
        if (customElements.get('avbridge-video')) {
          avbridgeLoaded = true;
          avbridgeLoading = false;
          resolve(window.AvbridgeVideoElement);
        } else {
          setTimeout(checkElement, 50);
        }
      };
      checkElement();
    };
    script.onerror = () => {
      avbridgeLoading = false;
      reject(new Error('Failed to load avbridge'));
    };
    document.head.appendChild(script);
  });
}

function initPlayer() {
  if (audio) return;
  audio = document.getElementById('audioPlayer');
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('loadedmetadata', updateDuration);
  audio.addEventListener('ended', onAudioEnded);
  audio.addEventListener('error', onAudioError);
}

let isPlayingMusic = false;

async function playMusic(filePath, filename) {
  if (isPlayingMusic && currentFilePath === filePath) {
    togglePlay();
    return;
  }
  
  isPlayingMusic = true;
  closePlayer();
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  currentFilePath = filePath;
  currentFilename = filename;

  document.getElementById('playerTitle').textContent = filename;
  document.getElementById('playerBar').classList.add('active');

  try {
    if (shouldUseAvbridge(filename)) {
      await playWithAvbridge(filePath, filename);
    } else if (shouldUseTranscode(filename)) {
      await playWithTranscode(filePath, filename);
    } else {
      await playWithNativeAudio(filePath, filename);
    }
  } finally {
    isPlayingMusic = false;
  }
}

async function playWithAvbridge(filePath, filename) {
  try {
    console.log('[avbridge] 开始加载, filePath:', filePath);
    await loadAvbridge();
    console.log('[avbridge] avbridge 已加载');

    const audioUrl = `/song/file?path=${encodeURIComponent(filePath)}`;
    console.log('[avbridge] audioUrl:', audioUrl);

    const elementClass = customElements.get('avbridge-video');
    if (!elementClass) {
      throw new Error('avbridge-video 自定义元素未注册');
    }

    avbridgePlayer = new elementClass();
    console.log('[avbridge] 元素已创建');

    avbridgePlayer.src = audioUrl;
    avbridgePlayer.autoplay = true;
    avbridgePlayer.controls = false;

    const container = document.getElementById('playerBar');
    container.appendChild(avbridgePlayer);
    avbridgePlayer.style.display = 'none';

    let avbridgeErrorHandled = false;

    avbridgePlayer.addEventListener('playing', () => {
      console.log('[avbridge] playing event');
      isPlaying = true;
      document.getElementById('playerPlayBtn').textContent = '⏸';
      document.getElementById('playerPlayBtn').classList.add('player-btn-pause');
    });

    avbridgePlayer.addEventListener('pause', () => {
      console.log('[avbridge] pause event');
      isPlaying = false;
      document.getElementById('playerPlayBtn').textContent = '▶';
      document.getElementById('playerPlayBtn').classList.remove('player-btn-pause');
    });

    avbridgePlayer.addEventListener('timeupdate', () => {
      if (avbridgePlayer.duration) {
        const progress = (avbridgePlayer.currentTime / avbridgePlayer.duration) * 100;
        document.getElementById('playerProgress').value = progress;
        document.getElementById('playerCurrentTime').textContent = formatTime(avbridgePlayer.currentTime);
        document.getElementById('playerTotalTime').textContent = formatTime(avbridgePlayer.duration);
      }
    });

    avbridgePlayer.addEventListener('ended', () => {
      console.log('[avbridge] ended event');
      onAudioEnded();
    });

    avbridgePlayer.addEventListener('error', (e) => {
      if (avbridgeErrorHandled) return;
      avbridgeErrorHandled = true;
      console.error('[avbridge] error event:', e);
      showToast('播放错误: avbridge 无法加载文件');
      closePlayer();
    });

    console.log('[avbridge] 调用 play()');
    if (typeof avbridgePlayer.play === 'function') {
      await avbridgePlayer.play();
      console.log('[avbridge] play() 调用完成');
    } else {
      throw new Error('play 方法不可用');
    }
  } catch (err) {
    console.error('[avbridge] playWithAvbridge error:', err);
    showToast('播放失败: ' + err.message);
  }
}

async function playWithTranscode(filePath, filename) {
  if (!audio) initPlayer();

  const audioUrl = `/song/file?path=${encodeURIComponent(filePath)}&transcode=1`;
  audio.src = audioUrl;

  audio.play().then(() => {
    isPlaying = true;
    document.getElementById('playerPlayBtn').textContent = '⏸';
    document.getElementById('playerPlayBtn').classList.add('player-btn-pause');
  }).catch(err => {
    showToast('播放失败: ' + err.message);
  });
}

async function waitForTranscode(filePath, filename) {
  document.getElementById('playerTitle').textContent = filename + ' (转码中...)';
  document.getElementById('playerBar').classList.add('active');

  while (true) {
    try {
      const res = await fetch(`/song/transcode-status?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();

      if (data.hasCache) {
        return true;
      }

      if (data.data.status === 'error') {
        throw new Error(data.data.message || '转码失败');
      }

      if (data.data.status === 'transcoding') {
        document.getElementById('playerTitle').textContent = filename + ` (转码中 ${data.data.progress}%)`;
      }

      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      throw err;
    }
  }
}

async function playMusicWithCache(filePath, filename) {
  if (isPlayingMusic && currentFilePath === filePath) {
    togglePlay();
    return;
  }
  
  isPlayingMusic = true;
  closePlayer();
  
  await new Promise(resolve => setTimeout(resolve, 50));
  
  currentFilePath = filePath;
  currentFilename = filename;

  document.getElementById('playerTitle').textContent = filename;
  document.getElementById('playerBar').classList.add('active');

  if (!audio) initPlayer();

  try {
    const audioUrl = `/song/file-cache?path=${encodeURIComponent(filePath)}`;
    const res = await fetch(audioUrl);

    if (res.status === 202) {
      const data = await res.json();
      await waitForTranscode(filePath, filename);

      const cacheUrl = `/song/file-cache?path=${encodeURIComponent(filePath)}`;
      audio.src = cacheUrl;
      await audio.play();
      isPlaying = true;
      document.getElementById('playerTitle').textContent = filename;
      document.getElementById('playerPlayBtn').textContent = '⏸';
      document.getElementById('playerPlayBtn').classList.add('player-btn-pause');
    } else if (res.ok) {
      audio.src = audioUrl;
      await audio.play();
      isPlaying = true;
      document.getElementById('playerPlayBtn').textContent = '⏸';
      document.getElementById('playerPlayBtn').classList.add('player-btn-pause');
    } else {
      throw new Error('加载失败');
    }
  } catch (err) {
    showToast('播放失败: ' + err.message);
    closePlayer();
  } finally {
    isPlayingMusic = false;
  }
}

async function playWithNativeAudio(filePath, filename) {
  if (!audio) initPlayer();

  const audioUrl = `/song/file?path=${encodeURIComponent(filePath)}`;
  audio.src = audioUrl;

  audio.play().then(() => {
    isPlaying = true;
    document.getElementById('playerPlayBtn').textContent = '⏸';
    document.getElementById('playerPlayBtn').classList.add('player-btn-pause');
  }).catch(err => {
    showToast('播放失败: ' + err.message);
  });
}

function togglePlay() {
  if (avbridgePlayer) {
    if (isPlaying) {
      avbridgePlayer.pause();
    } else {
      avbridgePlayer.play();
    }
    return;
  }

  if (!audio) return;

  if (isPlaying) {
    audio.pause();
    isPlaying = false;
    document.getElementById('playerPlayBtn').textContent = '▶';
    document.getElementById('playerPlayBtn').classList.remove('player-btn-pause');
  } else {
    audio.play().then(() => {
      isPlaying = true;
      document.getElementById('playerPlayBtn').textContent = '⏸';
      document.getElementById('playerPlayBtn').classList.add('player-btn-pause');
    }).catch(err => {
      showToast('播放失败: ' + err.message);
    });
  }
}

function seekTo() {
  const progress = document.getElementById('playerProgress').value;

  if (avbridgePlayer && avbridgePlayer.duration) {
    const time = (progress / 100) * avbridgePlayer.duration;
    avbridgePlayer.currentTime = time;
    return;
  }

  if (!audio || !audio.duration) return;

  const time = (progress / 100) * audio.duration;
  audio.currentTime = time;
}

function updateProgress() {
  if (!audio || !audio.duration) return;

  const progress = (audio.currentTime / audio.duration) * 100;
  document.getElementById('playerProgress').value = progress;
  document.getElementById('playerCurrentTime').textContent = formatTime(audio.currentTime);
}

function updateDuration() {
  if (audio && audio.duration) {
    document.getElementById('playerTotalTime').textContent = formatTime(audio.duration);
  }
}

function onAudioEnded() {
  isPlaying = false;
  document.getElementById('playerPlayBtn').textContent = '▶';
  document.getElementById('playerPlayBtn').classList.remove('player-btn-pause');
  document.getElementById('playerProgress').value = 0;
}

let errorHandled = false;

function onAudioError(e) {
  if (errorHandled) return;
  errorHandled = true;
  console.log('播放错误: 无法加载音频文件');
  closePlayer();
}

function closePlayer() {
  if (avbridgePlayer) {
    avbridgePlayer.pause();
    avbridgePlayer.remove();
    avbridgePlayer = null;
  }

  if (audio) {
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
  }

  isPlaying = false;
  errorHandled = false;
  currentFilePath = '';
  currentFilename = '';
  document.getElementById('playerBar').classList.remove('active');
  document.getElementById('playerPlayBtn').textContent = '▶';
  document.getElementById('playerPlayBtn').classList.remove('player-btn-pause');
  document.getElementById('playerProgress').value = 0;
  document.getElementById('playerCurrentTime').textContent = '00:00';
  document.getElementById('playerTotalTime').textContent = '00:00';
}

function formatTime(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function showToast(message, duration = 2000) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.className = 'toast';
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.animation = 'toastFadeIn 0.3s ease forwards';
  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s ease forwards';
    setTimeout(() => toast.style.opacity = '0', 300);
  }, duration);
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('searchClear').classList.remove('show');
  document.getElementById('searchResult').innerHTML = '<div class="empty">输入关键词搜索音乐文件</div>';
  searchResults = [];
  input.focus();
}

function handleSearchInput(e) {
  const clearBtn = document.getElementById('searchClear');
  if (e.target.value) {
    clearBtn.classList.add('show');
  } else {
    clearBtn.classList.remove('show');
  }
  if (isComposing) return;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchMusic();
  }, 800);
}

function handleSearchEnd() {
  isComposing = false;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    searchMusic();
  }, 300);
}

async function searchMusic() {
  const keyword = document.getElementById('searchInput').value.trim();
  const resultDiv = document.getElementById('searchResult');

  if (!keyword) {
    resultDiv.innerHTML = '<div class="empty">输入关键词搜索音乐文件</div>';
    searchResults = [];
    return;
  }

  resultDiv.innerHTML = '<div class="loading">搜索中...</div>';

  try {
    const res = await fetch(`/song/search?keyword=${encodeURIComponent(keyword)}`);
    const data = await res.json();

    if (data.success) {
      searchResults = data.data;
      if (data.data.length === 0) {
        resultDiv.innerHTML = '<div class="empty">没有找到匹配的文件</div>';
      } else {
        const isMobile = window.innerWidth < 768;
        resultDiv.innerHTML = data.data.map(item => `
          <div class="list-item">
            <div class="item-info" onclick="playMusic('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.filename)}')">
              <div class="name" ${item.size < 1048576 ? 'style="color:#e53935;"' : ''}>${escapeHtml(item.filename)} <span style="font-size:11px;color:#999;font-weight:normal;">(${formatFileSize(item.size)})</span></div>
              <div class="path" style="word-break:break-all;white-space:normal;font-size:11px;color:#888;">${escapeHtml(item.path)}</div>
            </div>
            <div class="custom-select" onclick="event.stopPropagation()">
              <select onchange="handleMobileAction(this, '${escapeHtml(item.path)}', '${escapeHtml(item.filename)}')">
                <option value="">操作</option>
                <option value="play">播放</option>
                <option value="link">${selectedLinkSource && selectedLinkSource.path === item.path ? '取消链接' : '链接'}</option>
                ${selectedLinkSource && selectedLinkSource.path !== item.path ? `<option value="linkTo">目标</option>` : ''}
                <option value="rename">重命名</option>
                <option value="delete">删除</option>
              </select>
            </div>
          </div>
        `).join('');
      }
    } else {
      resultDiv.innerHTML = '<div class="empty">搜索失败: ' + data.message + '</div>';
    }
  } catch (err) {
    resultDiv.innerHTML = '<div class="empty">搜索失败: ' + err.message + '</div>';
  }
}

async function addToSongList(filename) {
  try {
    const res = await fetch('/song/add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename })
    });
    const data = await res.json();
    if (data.success) {
      showToast('添加成功！');
    } else {
      showToast('添加失败: ' + data.message);
    }
  } catch (err) {
    showToast('添加失败: ' + err.message);
  }
}

function addSong() {
  const filename = document.getElementById('searchInput').value.trim();
  if (!filename) {
    showToast('请输入文件名');
    return;
  }
  addToSongList(filename);
}

async function loadDir(dir = '') {
  const listDiv = document.getElementById('dirList');
  const navDiv = document.getElementById('dirNav');
  
  scrollPositions.set(currentDir, listDiv.scrollTop);

  listDiv.innerHTML = '<div class="loading">加载中...</div>';

  try {
    const res = await fetch(`/song/dir?dir=${encodeURIComponent(dir)}`);
    const data = await res.json();

    if (data.success) {
      currentDir = data.currentDir;
      navDiv.innerHTML = buildDirNav(data.currentDir);

      if (data.data.length === 0) {
        listDiv.innerHTML = '<div class="empty">目录为空</div>';
      } else {
        listDiv.innerHTML = data.data.map(item => `
          <div class="dir-item ${item.isDirectory ? 'folder' : 'file'}" data-name="${escapeHtmlAttr(item.name)}" onclick="${item.isDirectory ? `loadDir('${escapeHtml(item.path)}')` : `handleTap('${escapeHtml(item.path)}', '${escapeHtml(item.name)}')`}">
            <div class="item-info" ${!item.isDirectory ? `onclick="event.stopPropagation(); playMusic('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.name)}')"` : ''}>
              <div class="name" ${!item.isDirectory && item.size < 1048576 ? 'style="color:#e53935;"' : ''}>${escapeHtml(item.name)} ${!item.isDirectory ? `<span style="font-size:11px;color:#999;font-weight:normal;">(${formatFileSize(item.size)})</span>` : ''}</div>
              <div class="path">${escapeHtml(item.path)}</div>
            </div>
            <div class="custom-select" onclick="event.stopPropagation()">
              <select onchange="handleDirAction(this, '${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.name)}', ${item.isDirectory})">
                <option value="">操作</option>
                ${!item.isDirectory ? `<option value="play">播放</option>` : ''}
                <option value="copy">复制文件名</option>
                <option value="rename">重命名</option>
                <option value="delete">删除</option>
              </select>
            </div>
          </div>
        `).join('');
      }
      
      setTimeout(() => {
        const focusedName = focusedNames.get(currentDir);
        if (focusedName) {
          const targetItem = listDiv.querySelector(`[data-name="${escapeHtmlAttr(focusedName)}"]`);
          if (targetItem) {
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
            focusedNames.delete(currentDir);
            return;
          }
        }
        listDiv.scrollTop = scrollPositions.get(currentDir) || 0;
      }, 10);
    } else {
      listDiv.innerHTML = '<div class="empty">加载失败: ' + data.message + '</div>';
    }
  } catch (err) {
    listDiv.innerHTML = '<div class="empty">加载失败: ' + err.message + '</div>';
  }
}

function buildDirNav(dir) {
  if (!dir) {
    return '<a href="#" onclick="loadDir(\'\'); return false;">/</a>';
  }
  const parts = dir.split('/');
  let current = '';
  let html = '<a href="#" onclick="loadDir(\'\'); return false;">/</a>';
  for (const part of parts) {
    if (!part) continue;
    current = current ? current + '/' + part : part;
    html += ' / <a href="#" onclick="loadDir(\'' + escapeHtml(current) + '\'); return false;">' + escapeHtml(part) + '</a>';
  }
  return html;
}

async function deleteFile(filePath) {
  try {
    const res = await fetch('/song/delete-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: filePath })
    });
    const data = await res.json();
    if (data.success) {
      loadDir(currentDir);
      searchMusic();
    } else {
      showToast('删除失败: ' + data.message);
    }
  } catch (err) {
    showToast('删除失败: ' + err.message);
  }
}

function showRenameModal(currentName, filePath) {
  renamePath = filePath;
  document.getElementById('modalTitle').innerText = '重命名文件';
  const input = document.getElementById('newNameInput');
  input.value = currentName;
  input.focus();
  input.select();
  document.getElementById('renameModal').classList.add('active');
}

function closeModal() {
  document.getElementById('renameModal').classList.remove('active');
  document.getElementById('newNameInput').value = '';
  renamePath = '';
}

async function confirmRename() {
  const newName = document.getElementById('newNameInput').value.trim();
  if (!newName) {
    showToast('请输入新名称');
    return;
  }
  try {
    const res = await fetch('/song/rename-file', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: renamePath, newName })
    });
    const data = await res.json();
    if (data.success) {
      closeModal();
      focusedNames.set(currentDir, newName);
      loadDir(currentDir);
      searchMusic();
    } else {
      showToast('重命名失败: ' + data.message);
    }
  } catch (err) {
    showToast('重命名失败: ' + err.message);
  }
}

function showNewFolderModal() {
  const input = document.getElementById('newFolderNameInput');
  input.value = '';
  input.focus();
  document.getElementById('newFolderModal').classList.add('active');
}

function closeNewFolderModal() {
  document.getElementById('newFolderModal').classList.remove('active');
  document.getElementById('newFolderNameInput').value = '';
}

async function createNewFolder() {
  const name = document.getElementById('newFolderNameInput').value.trim();
  if (!name) {
    showToast('请输入文件夹名称');
    return;
  }
  try {
    const res = await fetch('/song/mkdir', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dir: currentDir, name })
    });
    const data = await res.json();
    if (data.success) {
      closeNewFolderModal();
      loadDir(currentDir);
    } else {
      showToast('创建失败: ' + data.message);
    }
  } catch (err) {
    showToast('创建失败: ' + err.message);
  }
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function escapeHtmlAttr(str) {
  return escapeHtml(escapeJsString(str));
}

let symlinkSelectedDir = null;
let symlinkExpandedDirs = new Set();

async function showSymlinkModal() {
  if (!currentDir) {
    showToast('请先进入一个文件夹');
    return;
  }
  symlinkSelectedDir = null;
  symlinkExpandedDirs = new Set();
  document.getElementById('symlinkSelected').textContent = '未选择';
  document.getElementById('symlinkModal').classList.add('active');
  await loadSymlinkDirTree('');
}

function closeSymlinkModal() {
  document.getElementById('symlinkModal').classList.remove('active');
}

async function loadSymlinkDirTree(dir) {
  const treeDiv = document.getElementById('symlinkDirTree');
  try {
    const res = await fetch('/song/dir?dir=' + encodeURIComponent(dir));
    const data = await res.json();
    if (!data.success) return;

    const folders = data.data.filter(item => item.isDirectory);
    let html = '';

    if (!dir) {
      html += `<div style="padding:6px;cursor:pointer;color:#2196F3;font-weight:500;" onclick="selectSymlinkDir('')">📁 music (根目录)</div>`;
    }

    const depth = dir ? dir.split('/').length : 0;
    const indent = '  '.repeat(depth + 1);

    for (const folder of folders) {
      const isExpanded = symlinkExpandedDirs.has(folder.path);
      html += `<div style="padding:4px 6px;">`;
      html += `<span style="cursor:pointer;color:#666;margin-right:4px;" onclick="toggleSymlinkDir('${escapeHtmlAttr(folder.path)}')">${isExpanded ? '▼' : '▶'}</span>`;
      html += `<span style="cursor:pointer;" onclick="selectSymlinkDir('${escapeHtmlAttr(folder.path)}')">📁 ${escapeHtml(folder.name)}</span>`;
      html += `</div>`;

      if (isExpanded) {
        html += `<div id="symlink-sub-${escapeHtml(folder.path)}">`;
        html += await loadSubDirs(folder.path);
        html += `</div>`;
      }
    }

    treeDiv.innerHTML = html;
  } catch (err) {
    showToast('加载目录失败: ' + err.message);
  }
}

async function loadSubDirs(dir) {
  try {
    const res = await fetch('/song/dir?dir=' + encodeURIComponent(dir));
    const data = await res.json();
    if (!data.success) return '';

    const folders = data.data.filter(item => item.isDirectory);
    let html = '';
    const depth = dir.split('/').length;
    const indent = '  '.repeat(depth + 1);

    for (const folder of folders) {
      const isExpanded = symlinkExpandedDirs.has(folder.path);
      html += `<div style="padding:4px 6px 4px ${20 + depth * 16}px;">`;
      html += `<span style="cursor:pointer;color:#666;margin-right:4px;" onclick="toggleSymlinkDir('${escapeHtmlAttr(folder.path)}')">${isExpanded ? '▼' : '▶'}</span>`;
      html += `<span style="cursor:pointer;" onclick="selectSymlinkDir('${escapeHtmlAttr(folder.path)}')">📁 ${escapeHtml(folder.name)}</span>`;
      html += `</div>`;

      if (isExpanded) {
        html += await loadSubDirs(folder.path);
      }
    }
    return html;
  } catch (err) {
    return '';
  }
}

async function toggleSymlinkDir(dir) {
  if (symlinkExpandedDirs.has(dir)) {
    symlinkExpandedDirs.delete(dir);
  } else {
    symlinkExpandedDirs.add(dir);
  }
  await loadSymlinkDirTree('');
}

function selectSymlinkDir(dir) {
  symlinkSelectedDir = dir;
  const display = dir || 'music (根目录)';
  document.getElementById('symlinkSelected').textContent = '已选择: ' + display;
}

async function createSymlink() {
  if (symlinkSelectedDir === null) {
    showToast('请选择目标文件夹');
    return;
  }
  if (symlinkSelectedDir === currentDir) {
    showToast('不能选择当前目录');
    return;
  }
  try {
    const res = await fetch('/song/symlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: currentDir, target: symlinkSelectedDir })
    });
    const data = await res.json();
    if (data.success) {
      closeSymlinkModal();
      showToast('软链接创建成功');
    } else {
      showToast('创建失败: ' + data.message);
    }
  } catch (err) {
    showToast('创建失败: ' + err.message);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPlayer();
  loadDir();
});