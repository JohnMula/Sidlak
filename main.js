const { app, BrowserWindow, screen, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { pathToFileURL, fileURLToPath } = require('url');
const { spawn } = require('child_process');

// ffmpeg is only used to convert files the app cannot play itself (iPhone HEVC .mov, .avi, .wmv, TIFF...).
// If it is missing, everything else still works.
let ffmpegPath = null;
try {
  ffmpegPath = require('ffmpeg-static');
  // Inside the packaged app the binary lives next to app.asar, not inside it.
  if (ffmpegPath) ffmpegPath = ffmpegPath.replace(/app\.asar(?![.\w])/, 'app.asar.unpacked');
} catch (_) { /* not installed */ }

let controlWin = null;
let outputWin = null;
let outputTarget = null; // display id (string) or 'test'

// What the output screen is showing right now.
let state = {
  bg: { kind: 'color', color: '#100e1a' },
  text: '',
  sub: '',
  layout: 'center',
  font: 'display',
  logoUrl: '',
  logoVisible: false,
  blackout: false,
};

const LAYOUTS = ['center', 'left', 'lower'];
const FONTS = ['display', 'serif', 'clean'];
let programDirty = false;
let forceClose = false;

// Pictures: the first group is shown as it is; the rest are test-loaded first and converted if that fails.
const CORE_IMAGE_EXT = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'];
const IMAGE_EXT = [...CORE_IMAGE_EXT, 'jfif', 'pjpeg', 'pjp', 'apng', 'avif', 'bmp', 'dib', 'ico', 'tif', 'tiff'];
// Videos: anything here is test-played first; if the app cannot play it (a codec or container
// it does not know, such as HEVC or AVI), it is converted to H.264 MP4.
const VIDEO_EXT = [
  'mp4', 'm4v', 'mov', 'qt', 'webm', 'mkv', 'ogv', '3gp', '3g2',
  'avi', 'wmv', 'asf', 'flv', 'f4v', 'mpg', 'mpeg', 'mpe', 'm2v', 'ts', 'mts', 'm2ts', 'vob', 'divx',
];
const PDF_EXT = ['pdf'];
const HEIC_EXT = ['heic', 'heif'];

// Only files the operator picked through the dialog may be shown.
const allowedUrls = new Set();
const mediaLibrary = [];
let mediaCounter = 0;

const webPreferences = {
  preload: path.join(__dirname, 'preload.js'),
  contextIsolation: true,
  nodeIntegration: false,
  autoplayPolicy: 'no-user-gesture-required',
};

// ---------- displays ----------

function displayList() {
  const primaryId = screen.getPrimaryDisplay().id;
  return screen.getAllDisplays().map((d, i) => ({
    id: String(d.id),
    primary: d.id === primaryId,
    label: `Display ${i + 1} (${d.bounds.width}x${d.bounds.height})${d.id === primaryId ? ' - main' : ''}`,
  }));
}

function sendDisplays() {
  if (controlWin && !controlWin.isDestroyed()) {
    controlWin.webContents.send('displays', { list: displayList(), outputOpen: !!outputWin });
  }
}

function closeOutput() {
  if (outputWin) {
    const w = outputWin;
    outputWin = null;
    outputTarget = null;
    if (!w.isDestroyed()) w.destroy();
  }
  sendDisplays();
}

function openOutput(target) {
  if (outputWin) {
    const old = outputWin;
    outputWin = null;
    if (!old.isDestroyed()) old.destroy();
  }

  const display = screen.getAllDisplays().find((d) => String(d.id) === String(target));
  // The output keeps playing video even when it is covered by other windows.
  const outPrefs = { ...webPreferences, backgroundThrottling: false };
  let w;

  if (display) {
    w = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      show: false,
      backgroundColor: '#000000',
      webPreferences: outPrefs,
    });
    w.once('ready-to-show', () => {
      w.show();
      w.setFullScreen(true);
    });
  } else {
    w = new BrowserWindow({
      width: 960,
      height: 540,
      title: 'Sidlak output (test)',
      backgroundColor: '#000000',
      autoHideMenuBar: true,
      webPreferences: outPrefs,
    });
  }

  outputWin = w;
  outputTarget = display ? String(display.id) : 'test';

  w.loadFile('output.html');
  w.webContents.on('did-finish-load', () => {
    if (!w.isDestroyed()) w.webContents.send('state', state);
  });
  w.on('closed', () => {
    if (outputWin === w) {
      outputWin = null;
      outputTarget = null;
      sendDisplays();
    }
  });

  sendDisplays();
}

// ---------- state ----------

function cleanBg(b) {
  if (!b || typeof b !== 'object') return null;
  if (b.kind === 'color' && typeof b.color === 'string' && /^#[0-9a-f]{6}$/i.test(b.color)) {
    return { kind: 'color', color: b.color };
  }
  if ((b.kind === 'image' || b.kind === 'video') && typeof b.url === 'string'
    && (allowedUrls.has(b.url) || (b.kind === 'image' && isImageDataUrl(b.url)))) {
    const out = { kind: b.kind, url: b.url };
    if (b.kind === 'image' && typeof b.thumb === 'string' && allowedUrls.has(b.thumb)) out.thumb = b.thumb;
    if (b.fit === 'contain') out.fit = 'contain';
    return out;
  }
  return null;
}

function isImageDataUrl(url) {
  return typeof url === 'string'
    && url.length <= 40_000_000
    && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(url);
}

function sanitize(p) {
  const out = {};
  if (!p || typeof p !== 'object') return out;
  const bg = cleanBg(p.bg);
  if (bg) out.bg = bg;
  if (typeof p.text === 'string') out.text = p.text.slice(0, 200);
  if (typeof p.sub === 'string') out.sub = p.sub.slice(0, 200);
  if (LAYOUTS.includes(p.layout)) out.layout = p.layout;
  if (FONTS.includes(p.font)) out.font = p.font;
  if (typeof p.logoUrl === 'string' && (p.logoUrl === '' || allowedUrls.has(p.logoUrl) || isImageDataUrl(p.logoUrl))) {
    out.logoUrl = p.logoUrl;
  }
  if (typeof p.logoVisible === 'boolean') out.logoVisible = p.logoVisible;
  if (typeof p.blackout === 'boolean') out.blackout = p.blackout;
  return out;
}

// ---------- media ----------

// What kind of file is this? The extension decides; a file with an unknown or missing
// extension is identified from its first bytes instead. Returns 'image', 'video', 'pdf',
// 'heic' (known, but cannot be shown) or null.
function sniffKind(filePath) {
  let head = Buffer.alloc(32);
  try {
    const fd = fs.openSync(filePath, 'r');
    try { fs.readSync(fd, head, 0, 32, 0); } finally { fs.closeSync(fd); }
  } catch (_) { return null; }
  const at = (i, text) => head.toString('latin1', i, i + text.length) === text;
  const hex = (...bytes) => bytes.every((b, i) => head[i] === b);

  if (hex(0xff, 0xd8, 0xff) || hex(0x89, 0x50, 0x4e, 0x47) || at(0, 'GIF8')) return 'image';
  if (at(0, 'RIFF') && at(8, 'WEBP')) return 'image';
  if (at(0, 'RIFF') && at(8, 'AVI ')) return 'video';
  if (hex(0x49, 0x49, 0x2a, 0x00) || hex(0x4d, 0x4d, 0x00, 0x2a)) return 'image'; // TIFF
  if (at(0, '%PDF')) return 'pdf';
  if (at(4, 'ftyp')) {
    const brand = head.toString('latin1', 8, 12);
    if (brand === 'avif' || brand === 'avis') return 'image';
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return 'heic';
    return 'video'; // mp4, mov, m4v, 3gp...
  }
  if (hex(0x1a, 0x45, 0xdf, 0xa3)) return 'video'; // webm, mkv
  if (at(0, 'FLV')) return 'video';
  if (hex(0x30, 0x26, 0xb2, 0x75, 0x8e, 0x66, 0xcf, 0x11)) return 'video'; // wmv, asf
  if (hex(0x00, 0x00, 0x01, 0xba) || hex(0x00, 0x00, 0x01, 0xb3)) return 'video'; // mpeg
  return null;
}

function classify(filePath) {
  const ext = path.extname(filePath).slice(1).toLowerCase();
  if (IMAGE_EXT.includes(ext)) return 'image';
  if (VIDEO_EXT.includes(ext)) return 'video';
  if (PDF_EXT.includes(ext)) return 'pdf';
  if (HEIC_EXT.includes(ext)) return 'heic';
  return sniffKind(filePath);
}

function toItem(filePath, kind) {
  const url = pathToFileURL(filePath).href;
  allowedUrls.add(url);
  const ext = path.extname(filePath).slice(1).toLowerCase();
  return {
    id: 'm' + ++mediaCounter,
    name: path.basename(filePath),
    kind,
    url,
    // The control window test-loads these and asks for a conversion if they do not work.
    probe: kind === 'video' || !CORE_IMAGE_EXT.includes(ext),
  };
}

// Sorts picked files into usable items and ones that were skipped (with the reason),
// and tells the operator about the skipped ones so nothing disappears silently.
async function collect(filePaths, accepts) {
  const items = [];
  const skipped = [];
  for (const filePath of filePaths) {
    const kind = classify(filePath);
    const name = path.basename(filePath);
    if (kind === 'heic') {
      skipped.push(`${name} - HEIC/HEIF photos cannot be shown. Export or share the photo as JPEG first.`);
    } else if (!kind || !accepts.includes(kind)) {
      const word = (k) => (k === 'pdf' ? 'PDF' : k);
      const want = accepts.map(word).join(' or ');
      skipped.push(`${name} - ${kind ? `this is a ${word(kind)} file, but only ${want} files can be added here` : `not an ${want} file`}.`);
    } else {
      items.push({ file: filePath, kind });
    }
  }
  if (skipped.length) {
    await dialog.showMessageBox(controlWin, {
      type: 'warning',
      title: 'Some files were skipped',
      message: skipped.length === 1 ? 'One file could not be added.' : `${skipped.length} files could not be added.`,
      detail: skipped.join('\n'),
    });
  }
  return items;
}

const mediaFilters = (mode) => {
  const images = { name: 'Images', extensions: IMAGE_EXT };
  const videos = { name: 'Videos', extensions: VIDEO_EXT };
  const all = { name: 'All files', extensions: ['*'] };
  if (mode === 'image') return [images, all];
  return [{ name: 'Images and videos', extensions: [...IMAGE_EXT, ...VIDEO_EXT] }, images, videos, all];
};

// mode: 'any' (several images or videos), 'one' (a single image or video, for a slide),
// 'image' (a single image, for the logo; not added to the library).
ipcMain.handle('media:pick', async (_e, mode) => {
  const imagesOnly = mode === 'image';
  const result = await dialog.showOpenDialog(controlWin, {
    properties: imagesOnly || mode === 'one' ? ['openFile'] : ['openFile', 'multiSelections'],
    filters: mediaFilters(mode),
  });
  if (result.canceled) return [];
  const picked = await collect(result.filePaths, imagesOnly ? ['image'] : ['image', 'video']);
  const items = picked.map(({ file, kind }) => toItem(file, kind));
  if (!imagesOnly) mediaLibrary.push(...items);
  return items;
});

ipcMain.handle('slides:pick', async () => {
  const result = await dialog.showOpenDialog(controlWin, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images and PDFs', extensions: [...IMAGE_EXT, ...PDF_EXT] },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (result.canceled) return [];

  const picked = await collect(result.filePaths, ['image', 'pdf']);
  for (const { file, kind } of picked) {
    if (kind === 'pdf' && fs.statSync(file).size > 100 * 1024 * 1024) {
      throw new Error(`${path.basename(file)} is larger than the 100 MB PDF import limit.`);
    }
  }

  const items = picked.map(({ file, kind }) => {
    if (kind === 'pdf') {
      return { kind: 'pdf', name: path.basename(file), data: fs.readFileSync(file).toString('base64') };
    }
    return toItem(file, 'image');
  });
  mediaLibrary.push(...items.filter((item) => item.kind === 'image'));
  return items;
});

// ---------- conversion ----------
// Files the app cannot play or show are converted once into the cache folder:
// videos become H.264 MP4 (silent, at most 1920x1080), pictures become JPEG.
// Programs copy what they use when saved, so the cache can be emptied on start.

const convertDir = () => path.join(app.getPath('userData'), 'converted');
const converted = new Map(); // original url -> converted url
let convertQueue = Promise.resolve();

function runFfmpeg(args, onPercent) {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, ['-nostdin', '-hide_banner', '-y', ...args], { windowsHide: true });
    let duration = 0;
    let log = '';
    const seconds = (m) => Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    child.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      log = (log + text).slice(-4000);
      if (!duration) {
        const d = /Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/.exec(text);
        if (d) duration = seconds(d);
      }
      const t = [...text.matchAll(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/g)].pop();
      if (t && duration) onPercent(Math.min(99, Math.round((seconds(t) / duration) * 100)));
    });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) return resolve();
      if (signal) {
        return reject(new Error(`The converter crashed while reading this file (${signal}). Convert it to MP4 with another tool such as HandBrake or VLC, then add that.`));
      }
      const lines = log.trim().split(/\r?\n/).filter(Boolean);
      reject(new Error(lines.slice(-2).join(' ') || `ffmpeg stopped with code ${code}`));
    });
  });
}

async function convertMedia(sender, url, kind) {
  if (typeof url !== 'string' || !url.startsWith('file:') || !allowedUrls.has(url) || !['image', 'video'].includes(kind)) {
    throw new Error('That file is not available to convert.');
  }
  const known = converted.get(url);
  if (known && fs.existsSync(fileURLToPath(known))) return { url: known };

  if (!ffmpegPath || !fs.existsSync(ffmpegPath)) {
    throw new Error(kind === 'video'
      ? 'This video format cannot be played directly, and the converter (ffmpeg) is not installed. Run "npm install" again, or convert the video to MP4 (H.264) first.'
      : 'This picture format cannot be shown directly, and the converter (ffmpeg) is not installed. Run "npm install" again, or save the picture as JPEG or PNG first.');
  }

  const source = fileURLToPath(url);
  await fs.promises.mkdir(convertDir(), { recursive: true });
  const out = path.join(convertDir(), `${crypto.createHash('sha256').update(url).digest('hex').slice(0, 20)}${kind === 'video' ? '.mp4' : '.jpg'}`);

  const args = kind === 'video'
    ? ['-i', source, '-map', '0:v:0', '-an', '-sn', '-dn',
      '-vf', "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p",
      '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-movflags', '+faststart', out]
    : ['-i', source, '-frames:v', '1',
      '-vf', "scale=w='min(3840,iw)':h='min(2160,ih)':force_original_aspect_ratio=decrease",
      '-pix_fmt', 'yuvj420p', '-q:v', '2', out];

  let last = -1;
  await runFfmpeg(args, (percent) => {
    if (percent === last || sender.isDestroyed()) return;
    last = percent;
    sender.send('media:progress', { url, percent });
  });

  const outUrl = pathToFileURL(out).href;
  allowedUrls.add(outUrl);
  converted.set(url, outUrl);
  // Keep the library the control window gets after a reload in step with what it now holds.
  for (const item of mediaLibrary) if (item.url === url) { item.url = outUrl; item.probe = false; }
  return { url: outUrl };
}

// One at a time: a conversion uses a lot of CPU.
ipcMain.handle('media:convert', (e, url, kind) => {
  const run = () => convertMedia(e.sender, url, kind);
  const job = convertQueue.then(run, run);
  convertQueue = job.catch(() => {});
  return job;
});

function cleanProgram(payload) {
  if (!payload || !Array.isArray(payload.slides) || !Array.isArray(payload.media)) {
    throw new Error('This program file is missing its slides or media list.');
  }
  if (payload.slides.length > 5000 || payload.media.length > 5000) {
    throw new Error('This program contains too many slides or media items.');
  }

  const slideIds = new Set();
  const slides = payload.slides.map((slide) => {
    if (!slide || typeof slide.id !== 'string' || typeof slide.name !== 'string') {
      throw new Error('This program contains an invalid slide.');
    }
    if (slideIds.has(slide.id)) throw new Error('This program contains duplicate slide IDs.');
    slideIds.add(slide.id);
    const bg = cleanBg(slide.bg);
    if (!bg) throw new Error(`The background for "${slide.name}" is unavailable or invalid.`);
    return {
      id: slide.id.slice(0, 100),
      name: slide.name.slice(0, 120),
      bg,
      text: typeof slide.text === 'string' ? slide.text.slice(0, 200) : '',
      sub: typeof slide.sub === 'string' ? slide.sub.slice(0, 200) : '',
      layout: LAYOUTS.includes(slide.layout) ? slide.layout : 'center',
      font: FONTS.includes(slide.font) ? slide.font : 'display',
    };
  });

  const mediaIds = new Set();
  const media = payload.media.map((item) => {
    if (!item || typeof item.id !== 'string' || typeof item.name !== 'string'
      || !['image', 'video'].includes(item.kind) || typeof item.url !== 'string'
      || (!allowedUrls.has(item.url) && !(item.kind === 'image' && isImageDataUrl(item.url)))) {
      throw new Error('This program contains an invalid media item.');
    }
    if (mediaIds.has(item.id)) throw new Error('This program contains duplicate media IDs.');
    mediaIds.add(item.id);
    return { id: item.id.slice(0, 100), name: item.name.slice(0, 260), kind: item.kind, url: item.url };
  });

  const maxSlideNumber = slides.reduce((max, slide) => {
    const match = /^s(\d+)$/.exec(slide.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const nextSlideNumber = Math.max(
    Number.isSafeInteger(payload.nextSlideNumber) && payload.nextSlideNumber > 0
      ? payload.nextSlideNumber
      : slides.length + 1,
    maxSlideNumber + 1,
  );
  return { slides, media, nextSlideNumber };
}

async function saveProgram(payload) {
  const program = cleanProgram(payload);
  const result = await dialog.showSaveDialog(controlWin, {
    title: 'Save Sidlak program',
    defaultPath: 'Untitled.sidlak',
    filters: [{ name: 'Sidlak program', extensions: ['sidlak'] }],
  });
  if (result.canceled || !result.filePath) return { canceled: true };

  const filePath = path.extname(result.filePath) ? result.filePath : `${result.filePath}.sidlak`;
  const assetsName = `${path.basename(filePath)}.assets`;
  const assetsPath = path.join(path.dirname(filePath), assetsName);
  await fs.promises.mkdir(assetsPath, { recursive: true });
  const assetsByUrl = new Map();

  const saveAsset = async (url) => {
    if (!url) return '';
    if (assetsByUrl.has(url)) return assetsByUrl.get(url);
    if (isImageDataUrl(url)) {
      const match = /^data:image\/(png|jpeg|webp);base64,/.exec(url);
      const ext = match[1] === 'jpeg' ? '.jpg' : `.${match[1]}`;
      const data = Buffer.from(url.slice(match[0].length), 'base64');
      const assetName = `${crypto.createHash('sha256').update(url).digest('hex').slice(0, 20)}${ext}`;
      await fs.promises.writeFile(path.join(assetsPath, assetName), data);
      const relative = `${assetsName}/${assetName}`;
      assetsByUrl.set(url, relative);
      return relative;
    }
    if (!allowedUrls.has(url) || !url.startsWith('file:')) {
      throw new Error('A program asset is not an approved local file.');
    }
    const sourcePath = fileURLToPath(url);
    const ext = path.extname(sourcePath);
    const assetName = `${crypto.createHash('sha256').update(url).digest('hex').slice(0, 20)}${ext}`;
    await fs.promises.copyFile(sourcePath, path.join(assetsPath, assetName));
    const relative = `${assetsName}/${assetName}`;
    assetsByUrl.set(url, relative);
    return relative;
  };

  const savedProgram = JSON.parse(JSON.stringify(program));
  for (const item of savedProgram.media) item.url = await saveAsset(item.url);
  for (const slide of savedProgram.slides) {
    if (slide.bg.kind !== 'color') {
      slide.bg.url = await saveAsset(slide.bg.url);
      if (slide.bg.thumb) slide.bg.thumb = await saveAsset(slide.bg.thumb);
    }
  }
  await fs.promises.writeFile(filePath, JSON.stringify({ version: 1, ...savedProgram }, null, 2), 'utf8');
  return { canceled: false, filePath };
}

async function loadProgram() {
  const result = await dialog.showOpenDialog(controlWin, {
    title: 'Open Sidlak program',
    properties: ['openFile'],
    filters: [{ name: 'Sidlak program', extensions: ['sidlak'] }],
  });
  if (result.canceled || !result.filePaths.length) return null;

  const filePath = result.filePaths[0];
  const document = JSON.parse(await fs.promises.readFile(filePath, 'utf8'));
  if (!document || document.version !== 1 || !Array.isArray(document.slides) || !Array.isArray(document.media)) {
    throw new Error('This Sidlak program version is not supported.');
  }

  const programDir = path.dirname(filePath);
  const loadAsset = (relative) => {
    if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) {
      throw new Error('This program contains an invalid asset path.');
    }
    const assetPath = path.resolve(programDir, relative);
    const relativeToProgram = path.relative(programDir, assetPath);
    if (relativeToProgram.startsWith(`..${path.sep}`) || relativeToProgram === '..' || path.isAbsolute(relativeToProgram)) {
      throw new Error('This program contains an invalid asset path.');
    }
    if (!fs.existsSync(assetPath) || !fs.statSync(assetPath).isFile()) {
      throw new Error(`A program asset is missing: ${relative}`);
    }
    const url = pathToFileURL(assetPath).href;
    allowedUrls.add(url);
    return url;
  };

  for (const item of document.media || []) item.url = loadAsset(item.url);
  for (const slide of document.slides || []) {
    if (slide.bg && slide.bg.kind !== 'color') {
      slide.bg.url = loadAsset(slide.bg.url);
      if (slide.bg.thumb) slide.bg.thumb = loadAsset(slide.bg.thumb);
    }
  }

  const program = cleanProgram(document);
  mediaLibrary.splice(0, mediaLibrary.length, ...program.media);
  mediaCounter = program.media.reduce((max, item) => {
    const match = /^m(\d+)$/.exec(item.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, mediaCounter);
  return program;
}

// PDF pages are written to a cache folder and shown by file URL, so the page data
// never travels over IPC again and the output loads them like any other image.
const cacheDir = () => path.join(app.getPath('userData'), 'page-cache');

ipcMain.handle('cache:save', async (_e, data) => {
  const bytes = Buffer.from(data);
  if (bytes.length < 4 || bytes.length > 30 * 1024 * 1024 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw new Error('That is not a valid page image.');
  }
  await fs.promises.mkdir(cacheDir(), { recursive: true });
  const file = path.join(cacheDir(), `${crypto.randomUUID()}.jpg`);
  await fs.promises.writeFile(file, bytes);
  const url = pathToFileURL(file).href;
  allowedUrls.add(url);
  return url;
});

ipcMain.on('program:dirty', (_e, dirty) => { programDirty = !!dirty; });

ipcMain.on('preload:set', (_e, bgs) => {
  const safe = (Array.isArray(bgs) ? bgs : []).map(cleanBg).filter(Boolean).slice(0, 2);
  if (outputWin && !outputWin.isDestroyed()) outputWin.webContents.send('preload', safe);
});

ipcMain.handle('program:save', (_e, payload) => saveProgram(payload));
ipcMain.handle('program:load', () => loadProgram());

// ---------- windows ----------

function createControl() {
  controlWin = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 640,
    title: 'Sidlak',
    backgroundColor: '#111113',
    autoHideMenuBar: true,
    // Auto-advance runs on a timer here, so it must keep ticking even if this window is minimised.
    webPreferences: { ...webPreferences, backgroundThrottling: false },
  });
  controlWin.loadFile('control.html');
  controlWin.on('close', (e) => {
    if (!programDirty || forceClose) return;
    const choice = dialog.showMessageBoxSync(controlWin, {
      type: 'question',
      buttons: ['Keep editing', 'Close without saving'],
      defaultId: 0,
      cancelId: 0,
      title: 'Unsaved changes',
      message: 'This program has changes that are not saved.',
    });
    if (choice === 0) e.preventDefault();
    else forceClose = true;
  });
  controlWin.on('closed', () => {
    controlWin = null;
    closeOutput();
    app.quit();
  });
}

ipcMain.handle('displays:get', () => ({
  list: displayList(),
  outputOpen: !!outputWin,
  state,
  media: mediaLibrary,
}));

ipcMain.on('output:open', (_e, target) => openOutput(target));
ipcMain.on('output:close', () => closeOutput());

ipcMain.on('state:set', (_e, patch) => {
  state = { ...state, ...sanitize(patch) };
  if (outputWin && !outputWin.isDestroyed()) outputWin.webContents.send('state', state);
});

app.whenReady().then(() => {
  // Saved programs keep their own copies, so the caches can start empty.
  fs.rmSync(cacheDir(), { recursive: true, force: true });
  fs.rmSync(convertDir(), { recursive: true, force: true });
  createControl();

  const refresh = () => {
    if (outputWin && outputTarget !== 'test') {
      const stillThere = screen.getAllDisplays().some((d) => String(d.id) === outputTarget);
      if (!stillThere) return closeOutput();
    }
    sendDisplays();
  };
  screen.on('display-added', refresh);
  screen.on('display-removed', refresh);
  screen.on('display-metrics-changed', refresh);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createControl();
  });
});

app.on('window-all-closed', () => app.quit());
