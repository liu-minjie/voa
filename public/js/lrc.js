const dialog = new mdc.dialog.MDCDialog(document.querySelector('#roi-dialog'));
const video = document.getElementById('roi-video');
const canvas = document.getElementById('roi-canvas');
const ctx = canvas.getContext('2d');

let currentVideo = "";
let roiData = null;
let isDrawing = false;
let startX, startY;
let rawStartX, rawStartY;
let currentVideoDom;

// 打开浮层并自动带入视频
function openRoiDialog(fileName, dom) {
  currentVideo = fileName;
  currentVideoDom = dom;
  document.getElementById('current-video-title').innerText = fileName;

  

  roiData = null; // 清空坐标数据
  document.getElementById('coords-display').innerText = "请使用鼠标在视频上划定字幕范围 (空格暂停/播放)";

  // 清空 Canvas 上的蓝色虚线框
  if (ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  // 这里的路径应指向你的 Node 服务静态资源目录
  video.src = `/lrc/videos/${fileName}`; 
  dialog.open();
  
  video.onloadedmetadata = () => {
      canvas.width = video.clientWidth;
      canvas.height = video.clientHeight;
  };
}

function closeRoiDialog() {
  dialog.close();
  video.pause();
}

// 播放功能
function playVideo(fileName) {
  window.open(`/lrc/videos/${fileName}`, '_blank');
}

async function  renameVideo(fileName, dom) {
  currentVideoDom = dom;
  var name = window.prompt();
  const payload = {
    videoName: fileName,
    newName: name
  };

  const response = await fetch('/lrc/videos/rename', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (response.ok && currentVideoDom) {
    const txt = currentVideoDom.closest('.list-item').querySelector('.video-name');
    if (txt) {
      txt.textContent = name;
    }
  }
}

function getActualVideoRect() {
  const rect = video.getBoundingClientRect();
  const videoRatio = video.videoWidth / video.videoHeight;
  const elementRatio = rect.width / rect.height;

  let actualWidth, actualHeight, offsetX = 0, offsetY = 0;

  // 计算视频在 video 标签内部实际画面的宽度和高度（剔除黑边）
  if (elementRatio > videoRatio) {
    actualHeight = rect.height;
    actualWidth = actualHeight * videoRatio;
    offsetX = (rect.width - actualWidth) / 2;
  } else {
    actualWidth = rect.width;
    actualHeight = actualWidth / videoRatio;
    offsetY = (rect.height - actualHeight) / 2;
  }
  return { actualWidth, actualHeight, offsetX, offsetY, rect };
}


// 框选逻辑
video.addEventListener('mousedown', e => {
  const info = getActualVideoRect();

  // 1. 计算鼠标相对于“视频画面”左上角的偏移（减去黑边）
  const mouseX = e.clientX - info.rect.left - info.offsetX;
  const mouseY = e.clientY - info.rect.top - info.offsetY;

  // 2. 映射到视频原始像素 (例如 720x1280)
  rawStartX = (mouseX / info.actualWidth) * video.videoWidth;
  rawStartY = (mouseY / info.actualHeight) * video.videoHeight;

  // 3. 记录用于 Canvas 绘图的起始点（相对于 canvas 标签）
  startX = e.clientX - info.rect.left;
  startY = e.clientY - info.rect.top;

  isDrawing = true;
});

video.addEventListener('mousemove', e => {
  if (!isDrawing) return;
  const info = getActualVideoRect();
  const currentDrawX = e.clientX - info.rect.left;
  const currentDrawY = e.clientY - info.rect.top;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = '#6200ee';
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 5]); // 虚线

  // 绘图
  ctx.strokeRect(startX, startY, currentDrawX - startX, currentDrawY - startY);
});

video.addEventListener('mouseup', e => {
  if (!isDrawing) return;
  isDrawing = false;

  const info = getActualVideoRect();
  const mouseX = e.clientX - info.rect.left - info.offsetX;
  const mouseY = e.clientY - info.rect.top - info.offsetY;

  // 映射当前终点到原始像素
  const rawEndX = (mouseX / info.actualWidth) * video.videoWidth;
  const rawEndY = (mouseY / info.actualHeight) * video.videoHeight;

  // 限制在视频像素范围内 (0 到 width/height)，解决拉到最右边不到头或超过的问题
  roiData = {
    y_start: Math.round(Math.max(0, Math.min(rawStartY, rawEndY))),
    y_end: Math.round(Math.min(video.videoHeight, Math.max(rawStartY, rawEndY))),
    x_start: Math.round(Math.max(0, Math.min(rawStartX, rawEndX))),
    x_end: Math.round(Math.min(video.videoWidth, Math.max(rawStartX, rawEndX)))
  };

  document.getElementById('coords-display').innerText = 
      `已选像素坐标：X(${roiData.x_start}-${roiData.x_end}), Y(${roiData.y_start}-${roiData.y_end})`;
});





// 键盘控制
window.onkeydown = (e) => {
  if (e.code === 'Space' && dialog.isOpen) {
    e.preventDefault();
    video.paused ? video.play() : video.pause();
  }
};

// 提交到 Node 接口
async function submitExtract(btn) {
  if (!roiData) return alert("请先标记区域");
  btn.disabled = true;
  const payload = {
    videoName: currentVideo,
    ...roiData
  };

  const response = await fetch('/lrc/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  btn.disabled = false;

  if (response.ok) {
    closeRoiDialog();
    currentVideoDom && currentVideoDom.closest('.list-item').remove();
  }
}