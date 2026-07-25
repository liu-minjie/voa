let currentDir = '';
let currentDirAudioFiles = [];
let scrollPositions = new Map();
let focusedNames = new Map();


const NATIVE_FORMATS = ['mp3', 'aac', 'm4a', 'ogg', 'oga', 'wav', 'flac', 'midi', 'mid'];
const AVPROBE_FORMATS = ['wma', 'wmv', 'flv'];
function getMimeType(ext) {
  const mimeTypes = {
    'mp3': 'audio/mpeg',
    'ogg': 'audio/ogg',
    'oga': 'audio/ogg',
    'wav': 'audio/wav',
    'm4a': 'audio/mp4',
    'aac': 'audio/aac',
    'webm': 'audio/webm',
    'flac': 'audio/flac'
  };
  return mimeTypes[ext] || '';
}
function isBrowserSupported(filename) {
 const ext = getFileExtension(filename);
  const mimeType = getMimeType(ext);
  if (!mimeType) return false;
  const audio = document.createElement('audio');
  return audio.canPlayType(mimeType) !== '';
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
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function escapeJsString(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function escapeHtmlAttr(str) {
  return escapeHtml(escapeJsString(str));
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
function formatTime(seconds) {
  if (!seconds || seconds < 0) return '00:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}



class MusicPlayer {
  constructor(options) {
    this.options = {
      container: null,
      removeMusicPrefix: false,
      onIndexChange: null,
      showCloseBtn: false,
      isFixed: false,
      ...options
    };

    this.audio = null;
    this.avbridgePlayer = null;
    this.isPlaying = false;
    this.isPlayingMusic = false;
    this.currentFilePath = '';
    this.currentFilename = '';
    this.playlist = [];
    this.currentIndex = 0;
    this.loopMode = 'sequence';

    this.playEndTimer = null;
    this.playCheckInterval = null;
    this.playCheckStartTime = 0;

    this.el = {
      bar: null,
      info: null,
      title: null,
      closeBtn: null,
      bottom: null,
      controls: null,
      playBtn: null,
      prevBtn: null,
      nextBtn: null,
      loopBtn: null,
      progress: null,
      progressEl: null,
      currentTime: null,
      totalTime: null
    };

    this.render();
  }

  render() {
    const container = this.options.container;
    if (!container) return;

    const barClass = this.options.isFixed ? 'player-bar player-bar-fixed' : 'player-bar';
    container.innerHTML = `
      <div class="${barClass}">
        <div class="player-info">
          <div class="player-title">未播放</div>
          <div class="player-controls-right">
            <button class="player-btn player-prev-btn">
              <svg viewBox="0 0 24 24" style="width: 18px;fill: var(--main-color);">
                <rect x="4" y="4" width="3" height="16" rx="1" />
                <polygon points="20,4 9,12 20,20" />
              </svg>
            </button>
            <button class="player-btn player-next-btn">
              <svg viewBox="0 0 24 24" style="width: 18px;fill: var(--main-color);">
                <polygon points="4,4 15,12 4,20" />
                <rect x="17" y="4" width="3" height="16" rx="1" />
              </svg>
              
            </button>
            <button class="player-btn player-loop-btn loop-list">
              <svg class="loop-list-svg" viewBox="0 0 24 24" style="fill: var(--main-color);width: 18px;">
                <path d="M19 7H6.83l2.59-2.59L8 3l-5 5 5 5 1.41-1.41L6.83 9H19c1.1 0 2 .9 2 2v3h2v-3c0-2.21-1.79-4-4-4zM5 17h12.17l-2.59 2.59L16 21l5-5-5-5-1.41 1.41L16.17 15H5c-1.1 0-2-.9-2-2v-3H1v3c0 2.21 1.79 4 4 4z"></path>
              </svg>
              <svg class="loop-one-svg" viewBox="0 0 24 24" style="width: 18px;fill: var(--main-color);">
                <g transform="translate(0, -2)">
                  <path d="M19 7H6.83l2.59-2.59L8 3l-5 5 5 5 1.41-1.41L6.83 9H19c1.1 0 2 .9 2 2v3h2v-3c0-2.21-1.79-4-4-4z"></path>
                  <path d="M11 10h1.5v5H14v1.5h-3z"></path>
                </g>
                <g transform="translate(0, 2)">
                  <path d="M5 17h12.17l-2.59 2.59L16 21l5-5-5-5-1.41 1.41L16.17 15H5c-1.1 0-2-.9-2-2v-3H1v3c0 2.21 1.79 4 4 4z"></path>
                </g>
              </svg>
              <svg class="loop-shuffle-svg" viewBox="0 0 24 24" style="width: 20px;">
                <path d="M4.5 8.2h3.2c3.8 0 5 7.6 8.7 7.6h1.1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M16.1 13.4 19.4 15.8 16.1 18.2Z" fill="currentColor"/>
                <path d="M4.5 15.8h3.2c1.4 0 2.4-1 3.3-2.3" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M13 10.5c1-1.3 2-2.3 3.5-2.3h1" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
                <path d="M16.1 5.8 19.4 8.2 16.1 10.6Z" fill="currentColor"/>
              </svg>
            </button>
          </div>
          ${this.options.showCloseBtn ? '<span class="circle-close">×</span>' : ''}
        </div>
        <div class="player-bottom">
          <div class="player-controls">
            <button class="player-btn">▶</button>
          </div>
          <div class="player-progress">
            <span class="player-time">00:00</span>
            <input type="range" min="0" max="100" value="0">
            <span class="player-time">00:00</span>
          </div>
        </div>
      </div>
    `;

    this.el.bar = container.querySelector('.player-bar');
    this.el.info = container.querySelector('.player-info');
    this.el.title = container.querySelector('.player-title');
    this.el.closeBtn = container.querySelector('.circle-close');
    this.el.bottom = container.querySelector('.player-bottom');
    this.el.controls = container.querySelector('.player-controls');
    this.el.playBtn = container.querySelector('.player-controls .player-btn');
    this.el.prevBtn = container.querySelector('.player-prev-btn');
    this.el.nextBtn = container.querySelector('.player-next-btn');
    this.el.loopBtn = container.querySelector('.player-loop-btn');
    this.el.progress = container.querySelector('.player-progress');
    this.el.progressEl = container.querySelector('input[type="range"]');
    this.el.currentTime = container.querySelectorAll('.player-time')[0];
    this.el.totalTime = container.querySelectorAll('.player-time')[1];

    this.el.playBtn.addEventListener('click', () => this.togglePlay());
    this.el.progressEl.addEventListener('input', () => this.seekTo());
    
    if (this.el.closeBtn) {
      this.el.closeBtn.addEventListener('click', () => this.close());
    }
    if (this.el.prevBtn) {
      this.el.prevBtn.addEventListener('click', () => this.prev());
    }
    if (this.el.nextBtn) {
      this.el.nextBtn.addEventListener('click', () => this.next());
    }
    if (this.el.loopBtn) {
      this.el.loopBtn.addEventListener('click', () => this.toggleLoop());
    }

    this.updateLoopBtn();
  }

  initAudio() {
    if (this.audio) return;
    this.audio = document.createElement('audio');
    this.audio.addEventListener('timeupdate', () => this.updateProgress());
    this.audio.addEventListener('loadedmetadata', () => this.updateDuration());
    this.audio.addEventListener('ended', () => this.onAudioEnded());
    this.audio.addEventListener('error', () => this.onAudioError());
  }

  setPlaylist(playlist) {
    this.playlist = JSON.parse(JSON.stringify(playlist));
    this.currentIndex = 0;
  }

  setLoopMode(mode) {
    this.loopMode = mode;
  }

  async play(filePath, filename, from) {
    this.clearPlayTimers();

    if (this.currentFilePath === filePath) {
      this.togglePlay();
      return;
    }

    this.close();

    this.isPlayingMusic = true;

    let cleanFilePath = filePath;
    if (this.options.removeMusicPrefix) {
      const part = filePath.replace(/^music\//, '').split('/music/')
      cleanFilePath = part.length > 1 ?  part[1] : part[0];
    }

    this.currentFilePath = cleanFilePath;
    this.currentFilename = filename;

    if (this.options.onIndexChange) {
      this.options.onIndexChange(this.currentIndex);
    }

    this.updateTitle(filename);
    this.showPlayer();

    this.initAudio();

    try {
      if (shouldUseAvbridge(filename)) {
        await this.playWithAvbridge(cleanFilePath, filename);
      } else if (shouldUseTranscode(filename)) {
        if (from === 'select') {
          await this.playMusicWithCache(cleanFilePath, filename);
        } else {
          await this.playWithTranscode(cleanFilePath, filename);
        }
      } else if (isBrowserSupported(filename)) {
        await this.playWithNativeAudio(cleanFilePath, filename);
      } else {
        console.error(filename, '不支持播放的格式');
        this.onAudioEnded();
      }
    } finally {
      this.isPlayingMusic = false;
    }
  }

  async playWithAvbridge(filePath, filename) {
    await loadAvbridge();
    const audioUrl = `/song/file?path=${encodeURIComponent(filePath)}`;
    const elementClass = customElements.get('avbridge-video');
    if (!elementClass) {
      throw new Error('avbridge-video 自定义元素未注册');
    }

    this.avbridgePlayer = new elementClass();
    this.avbridgePlayer.src = audioUrl;
    this.avbridgePlayer.autoplay = true;
    this.avbridgePlayer.controls = false;

    if (this.el.bar) {
      this.el.bar.appendChild(this.avbridgePlayer);
    }
    this.avbridgePlayer.style.display = 'none';

    let avbridgeErrorHandled = false;

    this.avbridgePlayer.addEventListener('playing', () => {
      this.isPlaying = true;
      this.updatePlayBtn(true);
    });

    this.avbridgePlayer.addEventListener('pause', () => {
      this.isPlaying = false;
      this.updatePlayBtn(false);
    });

    this.avbridgePlayer.addEventListener('timeupdate', () => {
      if (this.avbridgePlayer.duration) {
        const progress = (this.avbridgePlayer.currentTime / this.avbridgePlayer.duration) * 100;
        if (this.el.progressEl) this.el.progressEl.value = progress;
        if (this.el.currentTime) this.el.currentTime.textContent = formatTime(this.avbridgePlayer.currentTime);
        if (this.el.totalTime) this.el.totalTime.textContent = formatTime(this.avbridgePlayer.duration);
      }
    });

    this.avbridgePlayer.addEventListener('ended', () => {
      this.onAudioEnded();
    });

    this.avbridgePlayer.addEventListener('error', (e) => {
      if (avbridgeErrorHandled) return;
      avbridgeErrorHandled = true;
      console.error('[avbridge] error event:', e);
      showToast('播放错误: avbridge 无法加载文件');
      this.close();
    });

    if (typeof this.avbridgePlayer.play === 'function') {
      await this.avbridgePlayer.play();
      this.startPlayEndCheck();
    } else {
      throw new Error('play 方法不可用');
    }
  }

  async playWithTranscode(filePath, filename) {
    const audioUrl = `/song/file?path=${encodeURIComponent(filePath)}&transcode=1`;
    this.audio.src = audioUrl;
    await this.audio.play();
    this.isPlaying = true;
    this.updatePlayBtn(true);
  }

  async playWithNativeAudio(filePath, filename) {
    const audioUrl = `/song/file?path=${encodeURIComponent(filePath)}`;
    this.audio.src = audioUrl;
    await this.audio.play();
    this.isPlaying = true;
    this.updatePlayBtn(true);
  }

  async playMusicWithCache(filePath, filename) {
    const audioUrl = `/song/file-cache?path=${encodeURIComponent(filePath)}`;
    const res = await fetch(audioUrl);

    if (res.status === 202) {
      await this.waitForTranscode(filePath, filename);
      const cacheUrl = `/song/file-cache?path=${encodeURIComponent(filePath)}`;
      this.audio.src = cacheUrl;
      await this.audio.play();
      this.isPlaying = true;
      this.updateTitle(filename);
      this.updatePlayBtn(true);
      this.startPlayEndCheck();
    } else if (res.ok) {
      this.audio.src = audioUrl;
      await this.audio.play();
      this.isPlaying = true;
      this.updateTitle(filename);
      this.updatePlayBtn(true);
      this.startPlayEndCheck();
    } else {
      throw new Error('加载失败');
    }
  }

  async waitForTranscode(filePath, filename) {
    this.updateTitle(filename + ' (转码中...)');
    this.showPlayer();

    while (true) {
      const res = await fetch(`/song/transcode-status?path=${encodeURIComponent(filePath)}`);
      const data = await res.json();

      if (data.hasCache) return true;
      if (data.data.status === 'error') {
        throw new Error(data.data.message || '转码失败');
      }
      if (data.data.status === 'transcoding') {
        this.updateTitle(filename + ` (转码中 ${data.data.progress}%)`);
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  togglePlay() {
    if (!this.audio && !this.avbridgePlayer) {
      if (this.playlist.length > 0) {
        const song = this.playlist[this.currentIndex];
        if (song) {
          this.play(song.path, song.name || song.title);
        }
      }
      return;
    }

    if (this.isPlaying) {
      if (this.avbridgePlayer) {
        try {
          if (typeof this.avbridgePlayer.stop === 'function') {
            this.avbridgePlayer.stop();
          }
        } catch (e) {
          console.warn('[avbridge] stop error:', e);
        }
        try {
          this.avbridgePlayer.pause();
        } catch (e) {
          console.warn('[avbridge] pause error:', e);
        }
      } else {
        this.audio.pause();
      }
      this.isPlaying = false;
      this.updatePlayBtn(false);
      if (!isBrowserSupported(this.currentFilename)) {
        this.clearPlayTimers();
      }
    } else {
      if (this.avbridgePlayer) {
        try {
          this.avbridgePlayer.play().then(() => {
            this.isPlaying = true;
            this.updatePlayBtn(true);
            if (!isBrowserSupported(this.currentFilename)) {
              this.startPlayEndCheck();
            }
          }).catch(err => {
            showToast('播放失败: ' + err.message);
          });
        } catch (err) {
          showToast('播放失败: ' + err.message);
        }
      } else {
        this.audio.play().then(() => {
          this.isPlaying = true;
          this.updatePlayBtn(true);
          if (!isBrowserSupported(this.currentFilename)) {
            this.startPlayEndCheck();
          }
        }).catch(err => {
          showToast('播放失败: ' + err.message);
        });
      }
    }
  }

  seekTo() {
    if (!this.el.progressEl) return;
    const progress = parseFloat(this.el.progressEl.value);
    if (isNaN(progress)) return;

    if (this.avbridgePlayer && this.avbridgePlayer.duration && isFinite(this.avbridgePlayer.duration)) {
      const time = (progress / 100) * this.avbridgePlayer.duration;
      if (isFinite(time)) {
        this.avbridgePlayer.currentTime = time;
      }
    } else if (this.audio && this.audio.duration && isFinite(this.audio.duration)) {
      const time = (progress / 100) * this.audio.duration;
      if (isFinite(time)) {
        this.audio.currentTime = time;
      }
    }
  }

  updateProgress() {
    if (this.avbridgePlayer && this.avbridgePlayer.duration) {
      const progress = (this.avbridgePlayer.currentTime / this.avbridgePlayer.duration) * 100;
      if (this.el.progressEl) this.el.progressEl.value = progress;
      if (this.el.currentTime) this.el.currentTime.textContent = formatTime(this.avbridgePlayer.currentTime);
    } else if (this.audio && this.audio.duration) {
      const progress = (this.audio.currentTime / this.audio.duration) * 100;
      if (this.el.progressEl) this.el.progressEl.value = progress;
      if (this.el.currentTime) this.el.currentTime.textContent = formatTime(this.audio.currentTime);
    }
  }

  updateDuration() {
    if (this.avbridgePlayer && this.avbridgePlayer.duration) {
      if (this.el.totalTime) this.el.totalTime.textContent = formatTime(this.avbridgePlayer.duration);
    } else if (this.audio && this.audio.duration) {
      if (this.el.totalTime) this.el.totalTime.textContent = formatTime(this.audio.duration);
    }
  }

  updateTitle(title) {
    if (this.el.title) this.el.title.textContent = title;
  }
  updatePlayIcon(isPlaying) {
    this.el.playBtn.innerHTML = isPlaying ? `<svg viewBox="0 0 24 24" style="width: 18px;fill: white;">
        <rect x="5" y="4" width="4.5" height="16" rx="2"></rect>
        <rect x="14.5" y="4" width="4.5" height="16" rx="2"></rect>
      </svg>` : '▶';
  }
  updatePlayBtn(isPlaying) {
    if (!this.el.playBtn) return;
    this.updatePlayIcon(isPlaying);
    if (isPlaying) {
      this.el.playBtn.classList.add('player-btn-pause');
    } else {
      this.el.playBtn.classList.remove('player-btn-pause');
    }
  }

  showPlayer() {
    if (this.el.bar) this.el.bar.classList.add('active');
    const container = document.querySelector('.container');
    if (container) container.classList.add('has-player');
  }

  hidePlayer() {
    if (this.el.bar) this.el.bar.classList.remove('active');
    const container = document.querySelector('.container');
    if (container) container.classList.remove('has-player');
  }

  close() {
    this.clearPlayTimers();

    if (this.audio) {
      this.audio.pause();
      this.audio.removeAttribute('src');
      this.audio.load();
    }

    if (this.avbridgePlayer) {
      try {
        if (typeof this.avbridgePlayer.stop === 'function') {
          this.avbridgePlayer.stop();
        }
      } catch (e) {
        console.warn('[avbridge] stop error:', e);
      }
      try {
        this.avbridgePlayer.pause();
      } catch (e) {
        console.warn('[avbridge] pause error:', e);
      }
      try {
        this.avbridgePlayer.remove();
      } catch (e) {
        console.warn('[avbridge] remove error:', e);
      }
      this.avbridgePlayer = null;
    }

    this.isPlaying = false;
    this.currentFilePath = '';
    this.currentFilename = '';

    this.hidePlayer();
    this.updatePlayBtn(false);

    if (this.el.progressEl) this.el.progressEl.value = 0;
    if (this.el.currentTime) this.el.currentTime.textContent = '00:00';
    if (this.el.totalTime) this.el.totalTime.textContent = '00:00';
  }

  onAudioEnded() {
    this.clearPlayTimers();
    this.isPlaying = false;
    this.updatePlayBtn(false);

    if (this.el.progressEl) this.el.progressEl.value = 0;

    if (this.playlist.length === 0) return;

    if (this.loopMode === 'single') {
      this.replayCurrent();
    } else if (this.loopMode === 'shuffle') {
      const randomIndex = Math.floor(Math.random() * this.playlist.length);
      const randomSong = this.playlist[randomIndex];
      if (randomSong) {
        this.play(randomSong.path, randomSong.name || randomSong.title);
      }
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
      const nextSong = this.playlist[this.currentIndex];
      if (nextSong) {
        this.play(nextSong.path, nextSong.name || nextSong.title);
      }
    }
  }

  onAudioError() {
    showToast('播放错误: 无法加载音频文件');
    this.close();
    this.onAudioEnded();
  }

  replayCurrent() {
    if (this.avbridgePlayer) {
      try {
        this.avbridgePlayer.currentTime = 0;
        this.avbridgePlayer.play().then(() => {
          this.isPlaying = true;
          this.updatePlayBtn(true);
        });
      } catch (err) {
        console.warn('[avbridge] replay error:', err);
      }
    } else if (this.audio) {
      this.audio.currentTime = 0;
      this.audio.play().then(() => {
        this.isPlaying = true;
        this.updatePlayBtn(true);
      });
    }
    if (this.el.progressEl) this.el.progressEl.value = 0;
    if (this.el.currentTime) this.el.currentTime.textContent = '00:00';
  }

  prev() {
    if (this.playlist.length === 0) return;

    if (this.loopMode === 'single') {
      this.replayCurrent();
    } else if (this.loopMode === 'shuffle') {
      const randomIndex = Math.floor(Math.random() * this.playlist.length);
      const randomSong = this.playlist[randomIndex];
      if (randomSong) {
        this.currentIndex = randomIndex;
        this.play(randomSong.path, randomSong.name || randomSong.title);
      }
    } else {
      this.currentIndex = (this.currentIndex - 1 + this.playlist.length) % this.playlist.length;
      const song = this.playlist[this.currentIndex];
      if (song) {
        this.play(song.path, song.name || song.title);
      }
    }
  }

  next() {
    if (this.playlist.length === 0) return;

    if (this.loopMode === 'single') {
      this.replayCurrent();
    } else if (this.loopMode === 'shuffle') {
      const randomIndex = Math.floor(Math.random() * this.playlist.length);
      const randomSong = this.playlist[randomIndex];
      if (randomSong) {
        this.currentIndex = randomIndex;
        this.play(randomSong.path, randomSong.name || randomSong.title);
      }
    } else {
      this.currentIndex = (this.currentIndex + 1) % this.playlist.length;
      const song = this.playlist[this.currentIndex];
      if (song) {
        this.play(song.path, song.name || song.title);
      }
    }
  }

  toggleLoop() {
    this.loopMode = this.loopMode === 'sequence' ? 'single' : 
      this.loopMode === 'single' ?  'shuffle' : 'sequence';
    this.updateLoopBtn();
  }

  updateLoopBtn() {
    const btn = this.el.loopBtn
    if (btn) {
      btn.classList.remove('loop-list');
      btn.classList.remove('loop-one');
      btn.classList.remove('loop-shuffle');
      if (this.loopMode === 'sequence') {
        btn.classList.add('loop-list');
      } else if (this.loopMode === 'single') {
        btn.classList.add('loop-one');
      } else if (this.loopMode === 'shuffle') {
        btn.classList.add('loop-shuffle');
      }
    }
  }

  clearPlayTimers() {
    if (this.playEndTimer) {
      clearTimeout(this.playEndTimer);
      this.playEndTimer = null;
    }
    if (this.playCheckInterval) {
      clearInterval(this.playCheckInterval);
      this.playCheckInterval = null;
    }
  }

  parseTime(timeStr) {
    const parts = timeStr.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }

  startPlayEndCheck() {
    this.clearPlayTimers();
    this.playCheckStartTime = Date.now();

    this.playCheckInterval = setInterval(() => {
      if (!this.isPlaying) return;

      if (!this.el.currentTime) return;

      const currentSeconds = this.parseTime(this.el.currentTime.textContent);

      if (currentSeconds > 0) {
        const totalSeconds = this.el.totalTime ? this.parseTime(this.el.totalTime.textContent) : 0;

        if (totalSeconds > 0) {
          clearInterval(this.playCheckInterval);
          this.playCheckInterval = null;

          this.playCheckInterval = setInterval(() => {
            if (!this.isPlaying) return;

            if (!this.el.currentTime) return;
            const nowCurrent = this.parseTime(this.el.currentTime.textContent);

            if (nowCurrent >= totalSeconds) {
              this.clearPlayTimers();
              this.onAudioEnded();
            }
          }, 5000);
        } else {
          if (currentSeconds > 299) {
            clearInterval(this.playCheckInterval);
            this.playCheckInterval = null;
          }
          this.playEndTimer = setTimeout(() => {
            clearInterval(this.playCheckInterval);
            this.playCheckInterval = null;
            if (this.isPlaying) {
              this.onAudioEnded();
            }
          }, 5 * 60 * 1000);
        }
      } else {
        const elapsed = Date.now() - this.playCheckStartTime;
        if (elapsed >= 60 * 1000) {
          this.clearPlayTimers();
          if (this.isPlaying) {
            this.onAudioEnded();
          }
        }
      }
    }, 1000);
  }
}

let avbridgeLoading = false;
function loadAvbridge() {
  return new Promise((resolve, reject) => {
    if (window.AvbridgeVideoElement) {
      resolve(window.AvbridgeVideoElement);
      return;
    }
    if (avbridgeLoading) {
      const check = setInterval(() => {
        if (window.AvbridgeVideoElement) {
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

const dirPlayerContainer = document.createElement('div');
dirPlayerContainer.id = 'playerBar';
document.body.appendChild(dirPlayerContainer);
let dirPlayer = new MusicPlayer({
  container: dirPlayerContainer,
  showCloseBtn: true,
  isFixed: true
});
async function playMusic(filePath, filename, from) {
  dirPlayer.setPlaylist(currentDirAudioFiles);
  const index = currentDirAudioFiles.findIndex(item => item.path === filePath);
  if (index >= 0) {
    dirPlayer.currentIndex = index;
  }
  await dirPlayer.play(filePath, filename, from);
}
function togglePlay() {
  dirPlayer.togglePlay();
}
function seekTo() {
  dirPlayer.seekTo();
}
function closePlayer() {
  dirPlayer.close();
}






let searchResults = [];
let selectedLinkSource = null;
let searchTimer = null;
let isComposing = false;
function handleSearchSelectAction(select, filePath, filename) {
  const action = select.value;
  select.value = '';
  if (!action) return;
  switch(action) {
    case 'play':
      playMusic(filePath, filename, 'select');
      break;
    case 'move':
      showMoveModal(filePath);
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
function handleHardLinkClick(filePath, filename) {
  if (selectedLinkSource && selectedLinkSource.path === filePath) {//点了相同的文件就取消选择
    selectedLinkSource = null;
    updateHardLinkUI();
    return;
  }
  selectedLinkSource = { path: filePath, filename: filename };
  updateHardLinkUI();
}
function updateHardLinkUI() {
  document.querySelectorAll('.action-link').forEach(btn => {
    const path = btn.dataset.path;
    if (selectedLinkSource) {
      if (selectedLinkSource.path === path) {
        btn.classList.remove('hidden');
        btn.classList.add('selected');
        btn.textContent = '取消';
      } else {
        btn.classList.add('hidden');
      }
    } else {
      btn.classList.remove('hidden', 'selected');
      btn.textContent = '链';
    }
  });
  document.querySelectorAll('.action-target').forEach(btn => {
    const path = btn.dataset.path;
    if (selectedLinkSource && selectedLinkSource.path !== path) {
      btn.classList.remove('hidden');
    } else {
      btn.classList.add('hidden');
    }
  });
}
async function createHardLink(sourcePath, targetPath, targetFilename) {
  try {
    const res = await fetch('/song/hardlink', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourcePath, targetPath, targetFilename })
    });
    const data = await res.json();
    if (data.success) {
      showToast('硬链接创建成功！');
      selectedLinkSource = null;
      updateHardLinkUI();
    } else {
      showToast('创建失败: ' + data.message);
    }
  } catch (err) {
    showToast('创建失败: ' + err.message);
  }
}
function renderEmptySearch() {
  return `
    <div class="empty-actions">
      <button class="btn btn-primary" onclick="window.location.href='/todo'">Todo</button>
    </div>
  `;
}
function clearSearch() {
  const input = document.getElementById('searchInput');
  input.value = '';
  document.getElementById('searchClear').classList.remove('show');
  document.getElementById('searchResult').innerHTML = renderEmptySearch();
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
    resultDiv.innerHTML = renderEmptySearch();
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
        resultDiv.innerHTML = data.data.map(item => `
          <div class="list-item">
            <div class="item-info" onclick="playMusic('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.filename)}')">
              <div class="name" ${item.size < 1048576 ? 'style="color:#e53935;"' : ''}>${escapeHtml(item.filename)} <span style="font-size:11px;color:#999;font-weight:normal;">(${formatFileSize(item.size)})</span></div>
              <div class="path" style="word-break:break-all;white-space:normal;font-size:11px;color:#888;">${escapeHtml(item.path)}</div>
            </div>
            <div class="list-actions" onclick="event.stopPropagation()">
              <button class="action-btn action-link" data-path="${escapeHtml(item.path)}" data-filename="${escapeHtml(item.filename)}" onclick="handleHardLinkClick('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.filename)}')">链</button>
              <button class="action-btn action-target hidden" data-path="${escapeHtml(item.path)}" data-filename="${escapeHtml(item.filename)}" onclick="createHardLink('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.filename)}')">到</button>
              <div class="custom-select">
                <select onchange="handleSearchSelectAction(this, '${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.filename)}')">
                  <option value="">操作</option>
                  <option value="play">播放</option>
                  <option value="move">移动</option>
                  <option value="rename">重命名</option>
                  <option value="delete">删除</option>
                </select>
              </div>
              <div class="desktop-actions">
                <button class="btn btn-sm btn-play" onclick="playMusic('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.filename)}', 'select')">播放</button>
                <button class="btn btn-sm btn-info" onclick="showMoveModal('${escapeHtmlAttr(item.path)}')">移动</button>
                <button class="btn btn-sm btn-warning" onclick="showRenameModal('${escapeHtmlAttr(item.filename)}', '${escapeHtmlAttr(item.path)}')">重命名</button>
                <button class="btn btn-sm btn-danger" onclick="if(confirm('确定要删除 ${escapeHtmlAttr(item.filename)} 吗？')) deleteFile('${escapeHtmlAttr(item.path)}')">删除</button>
              </div>
            </div>
          </div>
        `).join('');
        updateHardLinkUI();
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
    showPlaylistModal();
    return;
  }
  addToSongList(filename);
}






let playlistSongs = [];
let playlistCurrentIndex = 0;
//let playlistLoopMode = 'sequence';
let playlistPlayer = null;
async function showPlaylistModal() {
  const modal = document.getElementById('playlistModal');
  const listDiv = document.getElementById('playlistList');
  listDiv.innerHTML = '<div class="loading">加载中...</div>';
  modal.classList.add('active');

  const playlistContainer = document.getElementById('playlistPlayerContainer');
  if (!playlistPlayer && playlistContainer) {
    playlistPlayer = new MusicPlayer({
      container: playlistContainer,
      removeMusicPrefix: true,
      onIndexChange: (index) => {
        playlistCurrentIndex = index;
        renderPlaylist();
      }
    });
  }

  try {
    const res = await fetch('/song/playlist');
    const data = await res.json();
    if (data.success) {
      playlistSongs = data.data;
      playlistCurrentIndex = 0;
      renderPlaylist();
    } else {
      listDiv.innerHTML = '<div class="empty">播放列表文件不存在</div>';
    }
  } catch (err) {
    listDiv.innerHTML = '<div class="empty">加载播放列表失败</div>';
  }
}
function closePlaylistModal() {
  document.getElementById('playlistModal').classList.remove('active');
  if (playlistPlayer) {
    playlistPlayer.close();
  }
}
function renderPlaylist() {
  const listDiv = document.getElementById('playlistList');
  listDiv.innerHTML = playlistSongs.map((song, index) => `
    <div class="playlist-item ${index === playlistCurrentIndex ? 'active' : ''}" onclick="playPlaylistSong(${index})">
      <div class="playlist-index">${index + 1}</div>
      <div class="playlist-info">
        <div class="playlist-title">${escapeHtml(song.title)}</div>
        <div class="playlist-path">${escapeHtml(song.path)}</div>
      </div>
    </div>
  `).join('');
  updatePlaylistPlayer();
}
function playPlaylistSong(index) {
  if (index < 0 || index >= playlistSongs.length) return;
  playlistCurrentIndex = index;
  playlistPlayer.setPlaylist(playlistSongs);
  playlistPlayer.currentIndex = index;
  //playlistPlayer.setLoopMode(playlistLoopMode);
  const song = playlistSongs[index];
  playlistPlayer.play(song.path, song.title);
  renderPlaylist();
}
function playlistSeekTo() {
  playlistPlayer.seekTo();
}
function playlistPrev() {
  if (!playlistPlayer) return;
  playlistPlayer.prev();
}
function playlistNext() {
  if (!playlistPlayer) return;
  playlistPlayer.next();
}
function playlistTogglePlay() {
  if (!playlistPlayer) return;
  if (!playlistPlayer.audio && playlistSongs.length > 0) {
    playPlaylistSong(0);
  } else {
    playlistPlayer.togglePlay();
  }
}
function playlistToggleLoop() {
  if (!playlistPlayer) return;
  playlistPlayer.toggleLoop();
}
function updatePlaylistPlayer() {
  if (playlistSongs.length === 0) return;
  const song = playlistSongs[playlistCurrentIndex];
  if (playlistPlayer) {
    playlistPlayer.setPlaylist(playlistSongs);
    playlistPlayer.currentIndex = playlistCurrentIndex;
    playlistPlayer.updateTitle(song.title);
    //playlistPlayer.setLoopMode(playlistLoopMode);
  }
}





function handleDirSelectAction(select, filePath, filename, isDirectory) {
  const action = select.value;
  select.value = '';
  if (!action) return;
  switch(action) {
    case 'play':
      playMusic(filePath, filename, 'select');
      break;
    case 'move':
      showMoveModal(filePath);
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

      currentDirAudioFiles = data.data.filter(item => !item.isDirectory);

      if (data.data.length === 0) {
        listDiv.innerHTML = '<div class="empty">目录为空</div>';
      } else {
        listDiv.innerHTML = data.data.map(item => `
          <div class="dir-item ${item.isDirectory ? 'folder' : 'file'}" data-name="${escapeHtmlAttr(item.name)}" onclick="${item.isDirectory ? `loadDir('${escapeHtmlAttr(item.path)}')` : ``}">
            ${isBatchSelectMode ? `<input type="checkbox" ${selectedMoveFiles.has(item.path) ? 'checked' : ''} onclick="event.stopPropagation(); toggleFileSelect('${escapeHtmlAttr(item.path)}')" style="margin-right:8px;transform:scale(1.2);">` : ''}
            <div class="item-info" ${!item.isDirectory ? `onclick="event.stopPropagation(); playMusic('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.name)}')"` : ''}>
              <div class="name" ${!item.isDirectory && item.size < 1048576 ? 'style="color:#e53935;"' : ''}>${escapeHtml(item.name)} ${!item.isDirectory ? `<span style="font-size:11px;color:#999;font-weight:normal;">(${formatFileSize(item.size)})</span>` : ''}${item.isDirectory && item.linkedIn && item.linkedIn.length > 0 ? `<span class="linked-tag">${escapeHtml(item.linkedIn.join(', '))}</span>` : ''}${item.isDirectory && item.isPure ? `<span class="pure-tag">pure</span>` : ''}</div>
              <div class="path">${escapeHtml(item.path)}</div>
            </div>
            <div class="custom-select" onclick="event.stopPropagation()">
              <select onchange="handleDirSelectAction(this, '${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.name)}', ${item.isDirectory})">
                <option value="">操作</option>
                ${!item.isDirectory ? `<option value="play">播放</option>` : ''}
                <option value="move">移动</option>
                <option value="copy">复制文件名</option>
                <option value="rename">重命名</option>
                <option value="delete">删除</option>
              </select>
            </div>
            <div class="desktop-actions" onclick="event.stopPropagation()">
              ${!item.isDirectory ? `<button class="btn btn-sm btn-play" onclick="playMusic('${escapeHtmlAttr(item.path)}', '${escapeHtmlAttr(item.name)}', 'select')">播放</button>` : ''}
              <button class="btn btn-sm btn-info" onclick="showMoveModal('${escapeHtmlAttr(item.path)}')">移动</button>
              <button class="btn btn-sm" onclick="navigator.clipboard.writeText('${escapeHtmlAttr(item.name).replace(/\.[^.]+$/, '')}').then(()=>showToast('已复制文件名')).catch(()=>showToast('复制失败'))">复制</button>
              <button class="btn btn-sm btn-warning" onclick="showRenameModal('${escapeHtmlAttr(item.name)}', '${escapeHtmlAttr(item.path)}')">重命名</button>
              <button class="btn btn-sm btn-danger" onclick="if(confirm('确定要删除${item.isDirectory ? '文件夹' : '文件'} ${escapeHtmlAttr(item.name)}吗？')) deleteFile('${escapeHtmlAttr(item.path)}')">删除</button>
            </div>
          </div>
        `).join('');
      }
      
      setTimeout(() => {
        const focusedName = focusedNames.get(currentDir);
        if (focusedName) {
          const targetItem = listDiv.querySelector(`[data-name="${escapeHtmlAttr(focusedName)}"]`);
          if (targetItem) {
            targetItem.scrollIntoView({ behavior: 'smooth', block: 'start' });
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
    html += ' / <a href="#" onclick="loadDir(\'' + escapeHtmlAttr(current) + '\'); return false;">' + escapeHtml(part) + '</a>';
  }
  return html;
}






let renamePath = '';
function showRenameModal(currentName, filePath) {
  renamePath = filePath;
  document.getElementById('modalTitle').innerText = '重命名文件';
  const input = document.getElementById('newNameInput');
  input.value = currentName;
  input.focus();
  input.select();
  document.getElementById('renameModal').classList.add('active');
}
function closeRenameModal() {
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
      closeRenameModal();
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
function handleFileUpload(input) {
  const files = input.files;
  if (!files || files.length === 0) return;

  if (!currentDir) {
    showToast('请先进入一个文件夹');
    input.value = '';
    return;
  }

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('files', files[i]);
  }
  formData.append('dir', currentDir);

  fetch('/song/upload', {
    method: 'POST',
    body: formData
  }).then(res => res.json()).then(data => {
    showToast(data.message);
    if (data.success) {
      loadDir(currentDir);
    }
  }).catch(err => {
    showToast('上传失败: ' + err.message);
  }).finally(() => {
    input.value = '';
  });
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









// 通用目录树选择器：渲染 / 展开收起 / 选中，展开状态由 DOM 驱动（无需外部集合）
// 内部渲染完整的 modal 结构，支持参数化标题、描述、按钮文字和回调
class DirTreePicker {
  constructor() {
    this.modalId = 'dirPickerModal';
    this.treeId = 'dirPickerTree';
    this.selectedId = 'dirPickerSelected';
    this.titleId = 'dirPickerTitle';
    this.descId = 'dirPickerDesc';
    this.confirmBtnId = 'dirPickerConfirm';
    this.cancelBtnId = 'dirPickerCancel';
    this.selectedDir = null;
    this.defaultExpand = null;
    this.scrollInto = false;
    this.onConfirm = null;
    this.onCancel = null;
    this.renderModalIfNeeded();
  }

  renderModalIfNeeded() {
    if (document.getElementById(this.modalId)) return;
    const modalHtml = `
      <div class="modal" id="${this.modalId}">
        <div class="modal-content">
          <h3 id="${this.titleId}">选择目标文件夹</h3>
          <p style="font-size:12px;color:#666;margin-bottom:10px;" id="${this.descId}">请选择目标文件夹</p>
          <div style="border: 1px solid #ddd; border-radius: 6px; padding: 8px;" id="${this.treeId}"></div>
          <div style="margin-top:8px;font-size:12px;color:#888;" id="${this.selectedId}">未选择</div>
          <div class="modal-actions">
            <button class="btn btn-cancel" id="${this.cancelBtnId}">取消</button>
            <button class="btn btn-primary" id="${this.confirmBtnId}">确定</button>
          </div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
    document.getElementById(this.cancelBtnId).addEventListener('click', () => this.close());
    document.getElementById(this.confirmBtnId).addEventListener('click', () => this.confirm());
  }

  async open({ title, description, onConfirm, onCancel, defaultExpand, scrollInto }) {
    this.selectedDir = null;
    this.onConfirm = onConfirm || null;
    this.onCancel = onCancel || null;
    this.defaultExpand = defaultExpand || null;
    this.scrollInto = !!scrollInto;

    document.getElementById(this.titleId).textContent = title || '选择目标文件夹';
    document.getElementById(this.descId).textContent = description || '请选择目标文件夹';
    document.getElementById(this.selectedId).textContent = '未选择';
    document.getElementById(this.modalId).classList.add('active');

    await this.render('');
    if (this.defaultExpand) {
      await this.expand(this.defaultExpand);
      if (this.scrollInto) {
        const toggle = this.findToggle(this.defaultExpand);
        if (toggle) toggle.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }

  close() {
    document.getElementById(this.modalId).classList.remove('active');
    if (this.onCancel) this.onCancel();
  }

  async confirm() {
    if (this.onConfirm) await this.onConfirm(this.selectedDir);
  }

  async render(dir) {
    const treeDiv = document.getElementById(this.treeId);
    if (!treeDiv) return;
    try {
      let html = '';
      if (!dir) {
        html += `<div class="dt-item" data-dir="" style="padding:6px;cursor:pointer;" onclick="dirPicker.select('')"><span class="dt-name">📁 music (根目录)</span></div>`;
      }
      html += await this.buildChildrenHtml(dir);
      treeDiv.innerHTML = html;
    } catch (err) {
      showToast('加载目录失败: ' + err.message);
    }
  }

  async buildChildrenHtml(dir) {
    const res = await fetch('/song/dir?dir=' + encodeURIComponent(dir));
    const data = await res.json();
    if (!data.success) return '';
    const folders = data.data.filter(item => item.isDirectory);
    const depth = dir ? dir.split('/').length : 0;
    const leftPad = dir ? (20 + depth * 16) : 6;
    let html = '';
    for (const folder of folders) {
      const attrPath = escapeHtmlAttr(folder.path);
      const dataPath = escapeHtml(folder.path);
      html += `<div class="dt-item" data-dir="${dataPath}" style="padding:4px 6px 4px ${leftPad}px;cursor:pointer;" onclick="dirPicker.select('${attrPath}')">`;
      html += `<span class="dt-toggle" data-dir="${dataPath}" style="cursor:pointer;color:#666;margin-right:4px;" onclick="event.stopPropagation();dirPicker.toggle('${attrPath}')">▶</span>`;
      html += `<span class="dt-name">📁 ${escapeHtml(folder.name)}</span>`;
      html += `</div>`;
      html += `<div class="dt-sub" data-dir="${dataPath}" style="display:none;"></div>`;
    }
    return html;
  }

  findToggle(dir) {
    const els = document.querySelectorAll('#' + this.treeId + ' .dt-toggle');
    for (const el of els) {
      if (el.dataset.dir === dir) return el;
    }
    return null;
  }

  findSubtree(dir) {
    const els = document.querySelectorAll('#' + this.treeId + ' .dt-sub');
    for (const el of els) {
      if (el.dataset.dir === dir) return el;
    }
    return null;
  }

  async expand(dir) {
    try {
      const toggleEl = this.findToggle(dir);
      const subEl = this.findSubtree(dir);
      if (toggleEl) toggleEl.textContent = '▼';
      if (subEl) {
        if (!subEl.dataset.loaded) {
          subEl.innerHTML = await this.buildChildrenHtml(dir);
          subEl.dataset.loaded = '1';
        }
        subEl.style.display = 'block';
      }
    } catch (err) {
    }
  }

  async toggle(dir) {
    const toggleEl = this.findToggle(dir);
    const isExpanded = toggleEl && toggleEl.textContent === '▼';
    if (isExpanded) {
      if (toggleEl) toggleEl.textContent = '▶';
      const subEl = this.findSubtree(dir);
      if (subEl) subEl.style.display = 'none';
    } else {
      await this.expand(dir);
    }
  }

  select(dir) {
    this.selectedDir = dir;
    const el = document.getElementById(this.selectedId);
    if (el) el.textContent = '已选择: ' + (dir || 'music (根目录)');

    document.querySelectorAll('#' + this.treeId + ' .dt-item').forEach(item => {
      item.classList.remove('selected');
    });
    const selectedItem = document.querySelector('#' + this.treeId + ' .dt-item[data-dir="' + escapeHtml(dir) + '"]');
    if (selectedItem) {
      selectedItem.classList.add('selected');
    }
  }
}

const dirPicker = new DirTreePicker();

async function showSymlinkModal() {
  if (!currentDir) {
    showToast('请先进入一个文件夹');
    return;
  }
  await dirPicker.open({
    title: '选择目标文件夹',
    description: '将在所选文件夹下创建指向当前目录的软链接',
    defaultExpand: 'country',
    scrollInto: true,
    onConfirm: async (targetDir) => {
      if (targetDir === null) {
        showToast('请选择目标文件夹');
        return;
      }
      if (targetDir === currentDir) {
        showToast('不能选择当前目录');
        return;
      }
      try {
        const res = await fetch('/song/symlink', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: currentDir, target: targetDir })
        });
        const data = await res.json();
        if (data.success) {
          dirPicker.close();
          showToast('软链接创建成功');
        } else {
          showToast('创建失败: ' + data.message);
        }
      } catch (err) {
        showToast('创建失败: ' + err.message);
      }
    }
  });
}


function showMoveModal(moveSourcePath) {
  dirPicker.open({
    title: '选择目标文件夹',
    description: '将文件移动到所选文件夹',
    onConfirm: async (targetDir) => {
      if (!moveSourcePath) {
        showToast('请选择要移动的文件');
        return;
      }
      if (targetDir === null) {
        showToast('请选择目标文件夹');
        return;
      }
      try {
        const res = await fetch('/song/move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: moveSourcePath, target: targetDir })
        });
        const data = await res.json();
        if (data.success) {
          dirPicker.close();
          showToast('移动成功');
          loadDir(currentDir);
        } else {
          showToast('移动失败: ' + data.message);
        }
      } catch (err) {
        showToast('移动失败: ' + err.message);
      }
    }
  });
}


let isBatchSelectMode = false;
let selectedMoveFiles = new Set();
function toggleBatchSelect() {
  if (isBatchSelectMode) {
    if (selectedMoveFiles.size > 0) {
      startBatchMove();
      return;
    }
    cancelBatchSelect();
    return;
  }
  isBatchSelectMode = true;
  selectedMoveFiles.clear();
  document.getElementById('batchMoveBtn').textContent = '✓';
  document.getElementById('batchCancelBtn').style.display = 'block';
  loadDir(currentDir);
}
function cancelBatchSelect() {
  isBatchSelectMode = false;
  selectedMoveFiles.clear();
  document.getElementById('batchMoveBtn').textContent = '→';
  document.getElementById('batchCancelBtn').style.display = 'none';
  loadDir(currentDir);
}
function toggleFileSelect(filePath) {
  if (!isBatchSelectMode) return;
  if (selectedMoveFiles.has(filePath)) {
    selectedMoveFiles.delete(filePath);
  } else {
    selectedMoveFiles.add(filePath);
  }
}
function startBatchMove() {
  dirPicker.open({
    title: '选择目标文件夹',
    description: '将选中的文件批量移动到所选文件夹',
    onConfirm: async (targetDir) => {
      if (selectedMoveFiles.size === 0) {
        showToast('请选择要移动的文件');
        return;
      }
      if (targetDir === null) {
        showToast('请选择目标文件夹');
        return;
      }
      try {
        const res = await fetch('/song/batch-move', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sources: Array.from(selectedMoveFiles), target: targetDir })
        });
        const data = await res.json();
        if (data.success) {
          dirPicker.close();
          cancelBatchSelect();
          showToast('批量移动成功');
        } else {
          showToast('移动失败: ' + data.message);
        }
      } catch (err) {
        showToast('移动失败: ' + err.message);
      }
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  loadDir();
  document.getElementById('searchResult').innerHTML = renderEmptySearch();
});