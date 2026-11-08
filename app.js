const videoInput = document.querySelector('#videoInput');
const sourceVideo = document.querySelector('#sourceVideo');
const canvas = document.querySelector('#reelCanvas');
const ctx = canvas.getContext('2d');
const emptyState = document.querySelector('#emptyState');
const exportButton = document.querySelector('#exportButton');
const exportMessage = document.querySelector('#exportMessage');
const downloadLink = document.querySelector('#downloadLink');
const titleInput = document.querySelector('#titleInput');
const captionInput = document.querySelector('#captionInput');
const startInput = document.querySelector('#startInput');
const endInput = document.querySelector('#endInput');
const trimReadout = document.querySelector('#trimReadout');
const durationLabel = document.querySelector('#durationLabel');
const fileName = document.querySelector('#fileName');
const dropZone = document.querySelector('#dropZone');
const soundButton = document.querySelector('#soundButton');

let videoUrl = null;
let selectedPreset = 'glow';
let recording = false;
let frameRequest = null;
const presets = {
  glow: { filter: 'saturate(1.15) contrast(1.04) sepia(.12)', accent: '#ffc77b', shadow: 'rgba(20,10,5,.75)' },
  clean: { filter: 'saturate(.88) contrast(1.03)', accent: '#ffffff', shadow: 'rgba(0,0,0,.68)' },
  pop: { filter: 'saturate(1.38) contrast(1.12)', accent: '#ff71ae', shadow: 'rgba(27,0,33,.78)' }
};

const clock = seconds => {
  if (!Number.isFinite(seconds)) return '00:00';
  const whole = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(whole / 60)).padStart(2, '0')}:${String(whole % 60).padStart(2, '0')}`;
};
const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

function drawFrame() {
  if (sourceVideo.readyState >= 2 && sourceVideo.videoWidth) {
    const width = canvas.width;
    const height = canvas.height;
    const scale = Math.max(width / sourceVideo.videoWidth, height / sourceVideo.videoHeight);
    const drawWidth = sourceVideo.videoWidth * scale;
    const drawHeight = sourceVideo.videoHeight * scale;
    const preset = presets[selectedPreset];
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.filter = preset.filter;
    ctx.drawImage(sourceVideo, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight);
    ctx.restore();

    const title = titleInput.value.trim();
    const caption = captionInput.value.trim();
    const bottom = height * .15;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = preset.shadow;
    ctx.shadowBlur = 20;
    ctx.fillStyle = preset.accent;
    ctx.font = '700 58px Arial, sans-serif';
    const maxTextWidth = width * .84;
    const lines = wrapText(title, maxTextWidth, ctx);
    lines.slice(0, 3).forEach((line, index) => ctx.fillText(line, width / 2, height - bottom - (lines.length - index - 1) * 70));
    if (caption) {
      ctx.shadowBlur = 14;
      ctx.fillStyle = '#ffffff';
      ctx.font = '500 31px Arial, sans-serif';
      ctx.fillText(caption.slice(0, 54), width / 2, height - bottom + 52, maxTextWidth);
    }
    ctx.shadowBlur = 0;
  }
  frameRequest = requestAnimationFrame(drawFrame);
}

function wrapText(text, maxWidth, context) {
  if (!text) return [];
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  return lines;
}

function updateTrim() {
  const duration = Number.isFinite(sourceVideo.duration) ? sourceVideo.duration : 0;
  const start = clamp(Number(startInput.value) || 0, 0, Math.max(0, duration));
  const end = clamp(Number(endInput.value) || duration, 0, duration);
  trimReadout.textContent = `${clock(start)} — ${clock(Math.max(start, end))}`;
  if (duration) {
    startInput.max = duration;
    endInput.max = duration;
  }
}

function loadVideo(file) {
  if (!file || !file.type.startsWith('video/')) {
    exportMessage.textContent = 'Please choose a video file.';
    return;
  }
  if (videoUrl) URL.revokeObjectURL(videoUrl);
  videoUrl = URL.createObjectURL(file);
  sourceVideo.src = videoUrl;
  sourceVideo.muted = false;
  sourceVideo.load();
  fileName.textContent = file.name;
  document.querySelector('#previewLabel').textContent = 'PREVIEW · ' + file.name.toUpperCase().slice(0, 25);
  emptyState.hidden = true;
  downloadLink.hidden = true;
  exportButton.disabled = true;
  exportMessage.textContent = 'Loading video…';
}

videoInput.addEventListener('change', event => loadVideo(event.target.files[0]));
sourceVideo.addEventListener('loadedmetadata', () => {
  const duration = sourceVideo.duration;
  endInput.value = Number.isFinite(duration) ? duration.toFixed(1) : 0;
  startInput.value = '0';
  durationLabel.textContent = clock(duration);
  updateTrim();
  exportButton.disabled = false;
  exportMessage.textContent = 'Choose a look, then export when you’re happy.';
  sourceVideo.currentTime = 0;
  if (!frameRequest) drawFrame();
});
sourceVideo.addEventListener('timeupdate', () => {
  if (recording && sourceVideo.currentTime >= Number(endInput.value)) sourceVideo.pause();
});
sourceVideo.addEventListener('ended', () => {
  if (recording) stopExport();
});
sourceVideo.addEventListener('error', () => {
  exportMessage.textContent = 'This video could not be opened. Try an MP4 or WebM file.';
});

for (const input of [startInput, endInput]) input.addEventListener('change', () => {
  const duration = sourceVideo.duration || 0;
  const start = clamp(Number(startInput.value) || 0, 0, duration);
  const end = clamp(Number(endInput.value) || duration, 0, duration);
  startInput.value = start.toFixed(1);
  endInput.value = Math.max(start + .1, end).toFixed(1);
  updateTrim();
  if (!recording) sourceVideo.currentTime = start;
});

document.querySelectorAll('.preset-card').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.preset-card').forEach(card => card.classList.remove('selected'));
  button.classList.add('selected');
  selectedPreset = button.dataset.preset;
}));
for (const input of [titleInput, captionInput]) input.addEventListener('input', () => {});
soundButton.addEventListener('click', () => {
  sourceVideo.muted = !sourceVideo.muted;
  soundButton.textContent = sourceVideo.muted ? '♩̸' : '♪';
  soundButton.setAttribute('aria-label', sourceVideo.muted ? 'Turn preview sound on' : 'Mute preview sound');
});

dropZone.addEventListener('dragover', event => { event.preventDefault(); dropZone.classList.add('dragging'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragging'));
dropZone.addEventListener('drop', event => {
  event.preventDefault();
  dropZone.classList.remove('dragging');
  loadVideo(event.dataTransfer.files[0]);
});

async function startExport() {
  if (!sourceVideo.src || recording) return;
  if (!HTMLCanvasElement.prototype.captureStream || !window.MediaRecorder) {
    exportMessage.textContent = 'Video export needs a recent Chrome or Edge browser.';
    return;
  }
  const start = clamp(Number(startInput.value) || 0, 0, sourceVideo.duration);
  const end = clamp(Number(endInput.value) || sourceVideo.duration, start + .1, sourceVideo.duration);
  const canvasStream = canvas.captureStream(30);
  const tracks = [...canvasStream.getVideoTracks()];
  const capture = sourceVideo.captureStream?.() || sourceVideo.mozCaptureStream?.();
  if (capture) tracks.push(...capture.getAudioTracks());
  const stream = new MediaStream(tracks);
  const mimeType = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find(type => MediaRecorder.isTypeSupported(type));
  let recorder;
  try { recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined); }
  catch { exportMessage.textContent = 'This browser could not start the video export.'; return; }
  const chunks = [];
  recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
  recorder.onerror = () => { recording = false; exportButton.disabled = false; exportMessage.textContent = 'Export failed. Try a shorter clip or another browser.'; };
  recorder.onstop = () => {
    const blob = new Blob(chunks, { type: recorder.mimeType || 'video/webm' });
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = 'reelstudio-edit.webm';
    downloadLink.hidden = false;
    exportMessage.textContent = 'Your edited video is ready. Review it before sharing.';
    exportButton.disabled = false;
    exportButton.innerHTML = '<span>✦</span> Export again';
    recording = false;
    tracks.forEach(track => track.stop());
  };
  recording = true;
  exportButton.disabled = true;
  downloadLink.hidden = true;
  exportMessage.textContent = 'Recording your edit… Keep this tab open.';
  exportButton.innerHTML = '<span>●</span> Exporting…';
  sourceVideo.muted = false;
  sourceVideo.currentTime = start;
  await new Promise(resolve => {
    if (Math.abs(sourceVideo.currentTime - start) < .05) resolve();
    else sourceVideo.addEventListener('seeked', resolve, { once: true });
  });
  recorder.start(250);
  await sourceVideo.play();
  const checkEnd = () => {
    if (recording && sourceVideo.currentTime >= end) stopExport();
    else if (recording) requestAnimationFrame(checkEnd);
  };
  checkEnd();
}

function stopExport() {
  sourceVideo.pause();
  if (recording) {
    const recorder = window.activeRecorder;
    if (recorder?.state === 'recording') recorder.stop();
  }
}

// Keep a reference to the recorder so the end-time handler can stop it.
const originalStartExport = startExport;
startExport = async function () {
  const originalRecorder = window.MediaRecorder;
  const originalConstructor = originalRecorder;
  // The recorder is retained by the wrapped constructor for stopExport.
  const recorderProxy = new Proxy(originalConstructor, {
    construct(target, args) {
      const instance = Reflect.construct(target, args);
      window.activeRecorder = instance;
      return instance;
    }
  });
  window.MediaRecorder = recorderProxy;
  try { await originalStartExport(); }
  finally { window.MediaRecorder = originalRecorder; }
};
exportButton.addEventListener('click', startExport);
window.addEventListener('beforeunload', () => { if (videoUrl) URL.revokeObjectURL(videoUrl); });
