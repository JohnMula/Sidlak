const $ = (id) => document.getElementById(id);
const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Small things worth remembering between sessions (view, loop, panel width).
// Never the contents of the wall, and auto-advance always starts switched off.
const prefs = {
  get(key, fallback) {
    try {
      const value = localStorage.getItem(`sidlak.${key}`);
      return value === null ? fallback : JSON.parse(value);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(`sidlak.${key}`, JSON.stringify(value)); } catch { /* storage unavailable */ }
  },
};

// ---------- icons ----------

const ICONS = {
  left: '<path d="m15 18-6-6 6-6"/>',
  right: '<path d="m9 18 6-6-6-6"/>',
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  trash: '<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  grip: '<circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/>',
  save: '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>',
  folder: '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5"/><path d="M12 3v12"/>',
  image: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/>',
  eraser: '<path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21"/><path d="M22 21H7"/><path d="m5 11 9 9"/>',
  'screen-off': '<path d="M17 17H4a2 2 0 0 1-2-2V5c0-1.5 1-2 1-2"/><path d="M22 15V5a2 2 0 0 0-2-2H9"/><path d="M8 21h8"/><path d="M12 17v4"/><path d="m2 2 20 20"/>',
  star: '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
  play: '<path d="M6 3l14 9-14 9V3z"/>',
  repeat: '<path d="m17 2 4 4-4 4"/><path d="M3 11v-1a4 4 0 0 1 4-4h14"/><path d="m7 22-4-4 4-4"/><path d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  timer: '<path d="M10 2h4"/><path d="m12 14 3-3"/><circle cx="12" cy="14" r="8"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/>',
  list: '<path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  copy: '<rect x="8" y="8" width="14" height="14" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  film: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 3v18"/><path d="M17 3v18"/><path d="M3 12h18"/><path d="M3 7.5h4"/><path d="M3 16.5h4"/><path d="M17 7.5h4"/><path d="M17 16.5h4"/>',
  'align-center': '<path d="M17 12H7"/><path d="M19 18H5"/><path d="M21 6H3"/>',
  'align-left': '<path d="M15 12H3"/><path d="M17 18H3"/><path d="M21 6H3"/>',
  'lower-third': '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6.5 16h7"/>',
};
const icon = (name) => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
document.querySelectorAll('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));

// ---------- data ----------

let media = []; // { id, name, kind: 'image' | 'video', url }

// Starter slides. You can edit, add and delete them in the app.
let slides = [
  { id: 's1', name: 'Opening', bg: { kind: 'color', color: '#1d2b3a' }, text: 'Welcome', sub: 'to the program', layout: 'center', font: 'serif' },
  { id: 's2', name: 'Contestant', bg: { kind: 'color', color: '#5a1f2b' }, text: 'Contestant No. 1', sub: 'Maria Santos', layout: 'left', font: 'display' },
  { id: 's3', name: 'Intermission', bg: { kind: 'color', color: '#16413f' }, text: 'Intermission', sub: 'We will be right back', layout: 'center', font: 'clean' },
  { id: 's4', name: 'Thank you', bg: { kind: 'color', color: '#e9d8a6' }, text: 'Thank you', sub: 'See you next time', layout: 'center', font: 'serif' },
];
let nextSlideNumber = 5;
let selectedId = 's1'; // slide shown in the inspector
let liveId = null;     // slide currently on the wall (null if the wall was changed by hand)
let cursorId = null;   // last slide sent live; Next and Back carry on from here, even after a media tile or Clear text
let dragId = null;     // slide being dragged in the list

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
let outputOpen = false;

let programName = 'Untitled';
let dirty = false;
const stash = new Map(); // slide id -> the picture it had before switching to a solid colour

// Show settings
let loop = !!prefs.get('loop', false);                              // Next after the last slide goes back to the first
let autoOn = false;                                                 // auto-advance (never remembered, so the wall never starts moving by itself)
let autoSeconds = clamp(Math.round(Number(prefs.get('autoSeconds', 5))) || 5, 1, 600);
let viewMode = prefs.get('view', 'list') === 'grid' ? 'grid' : 'list';
let clickLive = !!prefs.get('clickLive', false);                    // one click on a slide sends it live

const rows = new Map();  // slide id -> { el, stage, name, num, liveTag, nextTag, ... }
const tiles = new Map(); // media id -> tile button

const preview = $('preview');
makeStage(preview);
const nextPreview = $('nextPreview');
makeStage(nextPreview);

let pdfImportReady = false;
import('./pdf-import.js').then(() => {
  pdfImportReady = true;
  $('importSlides').disabled = false;
}).catch((error) => {
  $('importSlides').title = 'PDF import is unavailable';
  alert(`Could not load PDF support: ${error.message}`);
});

const findSlide = (id) => slides.find((s) => s.id === id);
const indexOfId = (id) => slides.findIndex((s) => s.id === id);
const mediaBg = (m) => ({ kind: m.kind, url: m.url });
const slideState = (s) => ({ bg: s.bg, text: s.text || '', sub: s.sub || '', layout: s.layout || 'center', font: s.font || 'display', logoUrl: '', logoVisible: false, blackout: false });
const mediaState = (m) => slideState({ bg: mediaBg(m) });
const isTyping = (el) => !!el && ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName);

// Where Next and Back would go, or -1 when there is nowhere to go. With Loop on they wrap round.
function nextIndex() {
  if (!slides.length) return -1;
  const i = indexOfId(cursorId);
  if (i < 0) return 0;
  if (i + 1 < slides.length) return i + 1;
  return loop && slides.length > 1 ? 0 : -1;
}
function prevIndex() {
  if (!slides.length) return -1;
  const i = indexOfId(cursorId);
  if (i > 0) return i - 1;
  return loop && slides.length > 1 ? slides.length - 1 : -1;
}
const upcoming = () => slides[nextIndex()]; // the slide Next would show

function setDirty(value) {
  dirty = value;
  $('dirty').hidden = !dirty;
  window.sidlak.setDirty(dirty);
}

function setProgramName(name) {
  programName = name;
  $('programName').textContent = name;
  document.title = `${name} - Sidlak`;
}

// ---------- sending changes to the wall ----------

function push(patch) {
  state = { ...state, ...patch };
  window.sidlak.setState(patch);
  renderStage(preview, state);
  refreshUI();
}

// Keeps the next and the previous slide ready on the output, so both Next and Back start at once.
function syncPreload() {
  const picks = [nextIndex(), prevIndex()].filter((i) => i >= 0).map((i) => slides[i].bg);
  window.sidlak.setPreload(picks);
}

function scrollToRow(id) {
  const r = rows.get(id);
  if (r) r.el.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduceMotion ? 'auto' : 'smooth' });
}

// opts.keepSelection: leave the inspector alone (used by auto-advance while you are typing).
function showSlide(id, opts = {}) {
  const s = findSlide(id);
  if (!s) return;
  liveId = id;
  cursorId = id;
  if (!opts.keepSelection) selectedId = id;
  push({ ...slideState(s), logoUrl: state.logoUrl, logoVisible: false, blackout: false });
  syncPreload();
  if (!opts.keepSelection) loadEditor();
  scrollToRow(id);
  armAuto();
}

// A picture or video from the library runs on its own. Any title or subtitle left over
// from the last slide is removed, so nothing sits on top of it.
function showMedia(m) {
  liveId = null; // the wall no longer matches a slide
  push({ bg: mediaBg(m), text: '', sub: '', blackout: false });
}

// ---------- run of show ----------

// Thumbnails are only drawn once they are near the visible part of the list, so importing
// a long PDF does not decode every page at once.
const thumbWatcher = 'IntersectionObserver' in window
  ? new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      thumbWatcher.unobserve(entry.target);
      const r = rows.get(entry.target.dataset.id);
      if (!r) continue;
      r.visible = true;
      const s = findSlide(entry.target.dataset.id);
      if (r.stale && s) paintSlide(s);
    }
  }, { root: $('playlist'), rootMargin: '400px 0px' })
  : null;

function paintSlide(s) {
  const r = rows.get(s.id);
  if (!r) return;
  r.name.textContent = s.name;
  r.el.title = s.name;
  if (r.visible) {
    renderStage(r.stage, slideState(s), { instant: true, still: true });
    r.stale = false;
  } else {
    r.stale = true; // drawn when it scrolls into view
  }
  if (s === upcoming()) updateNext(); // only the "Next" preview ever shows this slide
}

function createRow(id) {
  const el = document.createElement('div');
  el.className = 'row';
  el.draggable = true;
  el.tabIndex = 0;
  el.setAttribute('role', 'option');
  el.dataset.id = id;

  const grip = document.createElement('span');
  grip.className = 'grip';
  grip.innerHTML = icon('grip');
  const num = document.createElement('span');
  num.className = 'num';
  const thumb = document.createElement('div');
  thumb.className = 'thumb';
  const stage = document.createElement('div');
  makeStage(stage);
  const liveTag = document.createElement('span');
  liveTag.className = 'tag live';
  liveTag.textContent = 'Live';
  liveTag.hidden = true;
  const nextTag = document.createElement('span');
  nextTag.className = 'tag next';
  nextTag.textContent = 'Next';
  nextTag.hidden = true;
  const add = document.createElement('button');
  add.type = 'button';
  add.className = 'add-media';
  add.title = 'Add an image or video to this slide';
  add.setAttribute('aria-label', 'Add an image or video to this slide');
  add.innerHTML = icon('plus');
  thumb.append(stage, liveTag, nextTag, add);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('span');
  name.className = 'name';
  meta.append(name);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'btn quiet icon go';
  go.title = 'Send live (double-click)';
  go.setAttribute('aria-label', 'Send live');
  go.innerHTML = icon('play');
  el.append(grip, num, thumb, meta, go);

  el.addEventListener('click', () => {
    if (clickLive) showSlide(id);
    else selectSlide(id);
  });
  el.addEventListener('dblclick', () => { if (!clickLive) showSlide(id); });
  go.addEventListener('click', (e) => { e.stopPropagation(); showSlide(id); });
  go.addEventListener('dblclick', (e) => e.stopPropagation());
  add.addEventListener('click', (e) => {
    e.stopPropagation();
    selectSlide(id);
    addMediaToSlide(id);
  });
  add.addEventListener('dblclick', (e) => e.stopPropagation()); // never counts as "send live"

  // drag to reorder
  el.addEventListener('dragstart', (e) => {
    dragId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    dragId = null;
    rows.forEach((r) => r.el.classList.remove('dragging', 'drop-before', 'drop-after'));
  });
  // In the list the drop point is above or below the middle; in the grid it is left or right.
  const after = (e) => {
    const box = el.getBoundingClientRect();
    return viewMode === 'grid' ? e.clientX > box.left + box.width / 2 : e.clientY > box.top + box.height / 2;
  };
  el.addEventListener('dragover', (e) => {
    if (!dragId || dragId === id) return;
    e.preventDefault();
    const a = after(e);
    el.classList.toggle('drop-before', !a);
    el.classList.toggle('drop-after', a);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-before', 'drop-after');
    if (dragId && dragId !== id) moveSlideTo(dragId, id, after(e));
  });

  const r = { el, stage, name, num, liveTag, nextTag, visible: !thumbWatcher, stale: true };
  if (thumbWatcher) thumbWatcher.observe(el);
  return r;
}

// Brings the list in line with `slides` without rebuilding rows that already exist.
function syncList() {
  const ids = new Set(slides.map((s) => s.id));
  rows.forEach((r, id) => {
    if (!ids.has(id)) {
      if (thumbWatcher) thumbWatcher.unobserve(r.el);
      r.el.remove();
      rows.delete(id);
    }
  });
  const list = $('playlist');
  slides.forEach((s, i) => {
    let r = rows.get(s.id);
    const isNew = !r;
    if (isNew) { r = createRow(s.id); rows.set(s.id, r); }
    r.num.textContent = i + 1;
    if (list.children[i] !== r.el) list.insertBefore(r.el, list.children[i] || null);
    if (isNew) paintSlide(s);
  });
  $('playlistEmpty').hidden = slides.length > 0;
  $('count').textContent = slides.length;
  syncPreload();
  refreshUI();
}

function resetList() {
  rows.forEach((r) => {
    if (thumbWatcher) thumbWatcher.unobserve(r.el);
    r.el.remove();
  });
  rows.clear();
}

function selectSlide(id) {
  selectedId = id;
  loadEditor();
  refreshUI();
}

function moveSlideTo(id, targetId, placeAfter) {
  const from = slides.findIndex((s) => s.id === id);
  if (from < 0) return;
  const [item] = slides.splice(from, 1);
  const to = slides.findIndex((s) => s.id === targetId);
  slides.splice(placeAfter ? to + 1 : to, 0, item);
  syncList();
  setDirty(true);
}

function nudgeSelected(offset) {
  const index = slides.findIndex((s) => s.id === selectedId);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= slides.length) return;
  [slides[index], slides[target]] = [slides[target], slides[index]];
  syncList();
  setDirty(true);
  const r = rows.get(selectedId);
  if (r) r.el.focus();
}

function newSlide() {
  const s = {
    id: 's' + nextSlideNumber,
    name: 'Slide ' + nextSlideNumber,
    bg: { kind: 'color', color: '#1d2b3a' },
    text: 'New slide',
    sub: '',
    layout: 'center',
    font: 'display',
  };
  nextSlideNumber += 1;
  slides.push(s);
  selectedId = s.id;
  syncList();
  loadEditor();
  setDirty(true);
  scrollToRow(s.id);
  $('edTitle').focus();
  $('edTitle').select();
}
$('newSlide').addEventListener('click', newSlide);

function duplicateSlide(id) {
  const s = findSlide(id);
  if (!s) return;
  const copy = JSON.parse(JSON.stringify(s));
  copy.id = 's' + nextSlideNumber;
  nextSlideNumber += 1;
  copy.name = `${s.name} copy`.slice(0, 60);
  slides.splice(indexOfId(id) + 1, 0, copy);
  if (stash.has(id)) stash.set(copy.id, stash.get(id));
  selectedId = copy.id;
  syncList();
  loadEditor();
  setDirty(true);
  scrollToRow(copy.id);
}
$('edDuplicate').addEventListener('click', () => duplicateSlide(selectedId));

function addSlide(name, bg) {
  const number = nextSlideNumber++;
  const slide = { id: 's' + number, name: name.slice(0, 60), bg, text: '', sub: '', layout: 'center', font: 'display' };
  slides.push(slide);
  selectedId = slide.id;
  return slide;
}

function imageSlideName(name) {
  return name.replace(/\.[^.]+$/, '').slice(0, 60) || name.slice(0, 60);
}

async function importSlides() {
  if (!pdfImportReady) return;
  let changed = false;
  const status = $('programStatus');
  try {
    const files = await window.sidlak.pickSlides();
    if (!files.length) return;
    for (const file of files) {
      if (file.kind === 'image') {
        const [item] = addToLibrary([file]);
        addSlide(imageSlideName(item.name), { ...mediaBg(item), fit: 'contain' });
        changed = true;
      } else {
        const pages = await window.sidlakImportPdfPages(file, (n, total) => {
          status.textContent = `Importing ${file.name}: page ${n} of ${total}`;
        });
        pages.forEach(({ url, thumb }, index) => {
          addSlide(`${imageSlideName(file.name)} - ${index + 1}`, { kind: 'image', url, thumb, fit: 'contain' });
        });
        status.textContent = `Imported ${pages.length} page${pages.length === 1 ? '' : 's'} from ${file.name}`;
        changed = true;
      }
    }
  } catch (error) {
    alert(`Could not import slides: ${error.message}`);
  } finally {
    if (changed) {
      syncList();
      syncMedia();
      loadEditor();
      setDirty(true);
    }
  }
}
$('importSlides').addEventListener('click', importSlides);

// ---------- list view, click behaviour, panel width ----------

function setView(mode, save = true) {
  viewMode = mode;
  if (save) prefs.set('view', mode);
  $('playlist').classList.toggle('grid', mode === 'grid');
  $('viewList').setAttribute('aria-pressed', String(mode === 'list'));
  $('viewGrid').setAttribute('aria-pressed', String(mode === 'grid'));
  if (selectedId) requestAnimationFrame(() => scrollToRow(selectedId));
}
$('viewList').addEventListener('click', () => setView('list'));
$('viewGrid').addEventListener('click', () => setView('grid'));

function setClickLive(on, save = true) {
  clickLive = on;
  if (save) prefs.set('clickLive', on);
  const b = $('clickLive');
  b.setAttribute('aria-pressed', String(on));
  b.title = on
    ? 'Click to go live: on. One click sends a slide to the wall. Click to turn off.'
    : 'Click to go live: off. Turn on to send a slide to the wall with one click.';
}
$('clickLive').addEventListener('click', () => setClickLive(!clickLive));

const LEFT_DEFAULT = 320;
function setLeftWidth(px, save = false) {
  const w = Math.round(clamp(px, 240, 560));
  $('main').style.setProperty('--left-w', `${w}px`);
  if (save) prefs.set('leftWidth', w);
  return w;
}
{
  const splitter = $('splitter');
  let startX = 0;
  let startW = 0;
  let lastW = LEFT_DEFAULT;
  let resizing = false;
  // Widening the panel slides slide rows under the pointer; without this the browser
  // would start dragging a row (to reorder it) in the middle of resizing.
  document.addEventListener('dragstart', (e) => { if (resizing) e.preventDefault(); }, true);
  splitter.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    splitter.setPointerCapture(e.pointerId);
    resizing = true;
    document.body.classList.add('resizing');
    splitter.classList.add('drag');
    startX = e.clientX;
    startW = document.querySelector('.list').getBoundingClientRect().width;
    lastW = startW;
  });
  splitter.addEventListener('pointermove', (e) => {
    if (resizing) lastW = setLeftWidth(startW + e.clientX - startX);
  });
  const end = (e) => {
    if (!resizing) return;
    resizing = false;
    if (splitter.hasPointerCapture(e.pointerId)) splitter.releasePointerCapture(e.pointerId);
    document.body.classList.remove('resizing');
    splitter.classList.remove('drag');
    setLeftWidth(lastW, true); // the last width we showed, whatever way the drag ended
  };
  splitter.addEventListener('pointerup', end);
  splitter.addEventListener('pointercancel', end);
  splitter.addEventListener('dblclick', () => setLeftWidth(LEFT_DEFAULT, true));
  splitter.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    e.stopPropagation();
    const current = document.querySelector('.list').getBoundingClientRect().width;
    setLeftWidth(current + (e.key === 'ArrowRight' ? 16 : -16), true);
  });
}

// ---------- programs ----------

const programData = () => ({ slides, media, nextSlideNumber });

$('saveProgram').addEventListener('click', async () => {
  try {
    const result = await window.sidlak.saveProgram(programData());
    if (result.canceled) return;
    $('programStatus').textContent = `Saved ${result.filePath}`;
    setProgramName(result.filePath.split(/[\\/]/).pop().replace(/\.sidlak$/i, ''));
    setDirty(false);
  } catch (error) {
    alert(`Could not save program: ${error.message}`);
  }
});

$('loadProgram').addEventListener('click', async () => {
  if (dirty && !confirm('Open another program? Changes to this one are not saved.')) return;
  try {
    const program = await window.sidlak.loadProgram();
    if (!program) return;
    slides = program.slides;
    media = program.media;
    nextSlideNumber = Math.max(
      program.nextSlideNumber,
      slides.reduce((max, slide) => {
        const match = /^s(\d+)$/.exec(slide.id);
        return match ? Math.max(max, Number(match[1]) + 1) : max;
      }, 1),
    );
    selectedId = slides.length ? slides[0].id : null;
    liveId = null;
    cursorId = null;
    stash.clear();
    $('programStatus').textContent = 'Program loaded.';
    resetList();
    resetMedia();
    syncList();
    syncMedia();
    loadEditor();
    setProgramName('Opened program');
    setDirty(false);
  } catch (error) {
    alert(`Could not open program: ${error.message}`);
  }
});

// ---------- media ----------

// Adds picked files to the library and returns the library entries. A file that is
// already there is not added a second time.
function addToLibrary(items) {
  return items.map((item) => {
    const existing = media.find((m) => m.url === item.url);
    if (existing) return existing;
    media.push(item);
    return item;
  });
}

function createTile(m) {
  const btn = document.createElement('button');
  btn.className = 'tile';
  btn.dataset.url = m.url;
  btn.title = `${m.name}: show on the wall`;
  const frame = document.createElement('div');
  frame.className = 'frame';
  const stage = document.createElement('div');
  makeStage(stage);
  renderStage(stage, mediaState(m), { instant: true, still: true });
  const play = document.createElement('span');
  play.className = 'play';
  play.innerHTML = icon('play');
  frame.append(stage, play);
  if (m.kind === 'video') {
    const kind = document.createElement('span');
    kind.className = 'kind';
    kind.title = 'Looping video';
    kind.innerHTML = icon('film');
    frame.append(kind);
  }
  const label = document.createElement('span');
  label.className = 'label';
  label.textContent = m.name;
  btn.append(frame, label);
  btn.addEventListener('click', () => showMedia(m));
  return btn;
}

// Brings the grid in line with `media` without rebuilding tiles that already exist,
// so adding one file does not reload every thumbnail.
function syncMedia() {
  const ids = new Set(media.map((m) => m.id));
  tiles.forEach((el, id) => {
    if (!ids.has(id)) { el.remove(); tiles.delete(id); }
  });
  const grid = $('media');
  media.forEach((m, i) => {
    let el = tiles.get(m.id);
    if (!el) { el = createTile(m); tiles.set(m.id, el); }
    if (grid.children[i] !== el) grid.insertBefore(el, grid.children[i] || null);
  });
  $('mediaEmpty').hidden = media.length > 0;
  refreshUI();
}

function resetMedia() {
  tiles.forEach((el) => el.remove());
  tiles.clear();
}

$('addMedia').addEventListener('click', async () => {
  const items = await window.sidlak.pickMedia();
  if (!items.length) return;
  const before = media.length;
  addToLibrary(items);
  if (media.length === before) return; // all of them were already there
  syncMedia();
  const s = findSlide(selectedId);
  if (s) fillBgSelect(s);
  setDirty(true);
});

// ---------- slide inspector ----------

const isLibraryMedia = (bg) => bg.kind !== 'color' && media.some((m) => m.url === bg.url);

// Changes a slide's background. A picture that only this slide has (an imported page or
// picture) is kept aside first, so it can always be switched back to.
function setSlideBg(s, bg) {
  if (s.bg.kind !== 'color' && !isLibraryMedia(s.bg)) stash.set(s.id, s.bg);
  s.bg = bg;
}

// The + buttons: pick one image or video and use it as this slide's picture.
async function addMediaToSlide(id) {
  let picked;
  try {
    picked = await window.sidlak.pickSlideMedia();
  } catch (error) {
    alert(`Could not add that file: ${error.message}`);
    return;
  }
  const s = findSlide(id);
  if (!picked || !s) return;

  const [item] = addToLibrary([picked]);
  setSlideBg(s, mediaBg(item));
  selectedId = id;
  syncMedia();
  paintSlide(s);
  loadEditor();
  setDirty(true);

  // Text on a slide stays on top of its picture or video, so say how to get it on its own.
  const note = s.text || s.sub ? ` Its title and subtitle show on top. Clear them to show just the ${item.kind}.` : '';
  $('programStatus').textContent = `Added “${item.name}” to “${s.name}”.${note}`;
}
$('edAddMedia').addEventListener('click', () => addMediaToSlide(selectedId));

// Ready-made background colours, so the common ones are one click.
const SWATCHES = ['#1d2b3a', '#5a1f2b', '#16413f', '#3b2a5e', '#7a3b12', '#0b0b0f', '#e9d8a6', '#ffffff'];
{
  const holder = $('edColorRow');
  const custom = $('edColor');
  SWATCHES.forEach((color) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'swatch';
    b.dataset.color = color;
    b.style.background = color;
    b.title = color;
    b.setAttribute('aria-label', `Background ${color}`);
    holder.insertBefore(b, custom);
  });
  holder.addEventListener('click', (e) => {
    const b = e.target.closest('.swatch');
    if (!b) return;
    custom.value = b.dataset.color;
    edit((s) => (s.bg = { kind: 'color', color: b.dataset.color }));
    markSwatch(b.dataset.color);
  });
}
function markSwatch(color) {
  document.querySelectorAll('#edColorRow .swatch').forEach((b) => b.classList.toggle('on', b.dataset.color === (color || '').toLowerCase()));
}

function fillBgSelect(s) {
  const sel = $('edBg');
  sel.textContent = '';
  const add = (value, text) => {
    const o = document.createElement('option');
    o.value = value;
    o.textContent = text;
    sel.append(o);
  };
  add('color', 'Solid colour');
  media.forEach((m) => add(m.id, (m.kind === 'video' ? 'Video: ' : 'Image: ') + m.name));

  const inLibrary = isLibraryMedia(s.bg);
  const own = s.bg.kind !== 'color' && !inLibrary; // imported page or picture
  if (own || stash.has(s.id)) add('current', 'This slide’s picture');

  if (s.bg.kind === 'color') sel.value = 'color';
  else if (inLibrary) sel.value = media.find((m) => m.url === s.bg.url).id;
  else sel.value = 'current';

  $('edColorRow').hidden = sel.value !== 'color';
  if (s.bg.kind === 'color') {
    $('edColor').value = s.bg.color;
    markSwatch(s.bg.color);
  }
  $('edFitRow').hidden = s.bg.kind !== 'image';
  $('edFit').value = s.bg.fit === 'contain' ? 'contain' : 'cover';
}

function syncLayoutButtons(s) {
  document.querySelectorAll('#edLayout button').forEach((b) => {
    b.classList.toggle('on', b.dataset.layout === (s.layout || 'center'));
  });
}

function loadEditor() {
  const s = findSlide(selectedId);
  $('editor').hidden = !s;
  $('noEditor').hidden = !!s;
  if (!s) return;
  $('edNumber').textContent = `${indexOfId(s.id) + 1} of ${slides.length}`;
  $('edName').value = s.name;
  $('edTitle').value = s.text;
  $('edSub').value = s.sub;
  $('edFont').value = s.font || 'display';
  syncLayoutButtons(s);
  fillBgSelect(s);
  refreshUI();
}

function edit(fn) {
  const s = findSlide(selectedId);
  if (!s) return;
  fn(s);
  paintSlide(s);
  setDirty(true);
}

$('edName').addEventListener('input', (e) => edit((s) => (s.name = e.target.value)));
$('edTitle').addEventListener('input', (e) => edit((s) => (s.text = e.target.value)));
$('edSub').addEventListener('input', (e) => edit((s) => (s.sub = e.target.value)));
$('edFont').addEventListener('change', (e) => edit((s) => (s.font = e.target.value)));

$('edLayout').addEventListener('click', (e) => {
  const b = e.target.closest('button[data-layout]');
  if (!b) return;
  edit((s) => (s.layout = b.dataset.layout));
  syncLayoutButtons(findSlide(selectedId));
});

$('edBg').addEventListener('change', (e) => {
  const value = e.target.value;
  edit((s) => {
    if (value === 'color') {
      setSlideBg(s, { kind: 'color', color: $('edColor').value });
    } else if (value === 'current') {
      const saved = stash.get(s.id);
      if (saved) s.bg = saved;
    } else {
      const m = media.find((x) => x.id === value);
      if (m) setSlideBg(s, mediaBg(m));
    }
  });
  fillBgSelect(findSlide(selectedId));
});

$('edColor').addEventListener('input', (e) => {
  edit((s) => (s.bg = { kind: 'color', color: e.target.value }));
  markSwatch(e.target.value);
});

$('edFit').addEventListener('change', (e) => edit((s) => {
  if (s.bg.kind !== 'image') return;
  s.bg = { ...s.bg };
  if (e.target.value === 'contain') s.bg.fit = 'contain';
  else delete s.bg.fit;
}));

// After choosing from a dropdown, give the keyboard back to the show so Space and the arrows work again.
['edFont', 'edBg', 'edFit', 'display'].forEach((id) => $(id).addEventListener('change', (e) => e.target.blur()));
['edName', 'edTitle', 'edSub', 'autoSecs'].forEach((id) => $(id).addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === 'Escape') e.target.blur();
}));

$('edSend').addEventListener('click', () => showSlide(selectedId));

$('edDelete').addEventListener('click', () => {
  const s = findSlide(selectedId);
  if (!s || !confirm(`Delete “${s.name}”?`)) return;
  const index = slides.indexOf(s);
  slides = slides.filter((x) => x.id !== s.id);
  stash.delete(s.id);
  if (liveId === s.id) liveId = null;
  if (cursorId === s.id) cursorId = index > 0 ? slides[index - 1].id : null; // Next then shows what took its place
  selectedId = slides.length ? slides[Math.min(index, slides.length - 1)].id : null;
  syncList();
  loadEditor();
  setDirty(true);
});

// ---------- wall controls ----------

const toggleBlackout = () => push({ blackout: !state.blackout });
$('blackout').addEventListener('click', toggleBlackout);

const clearText = () => {
  liveId = null;
  push({ text: '', sub: '' });
};
$('clearText').addEventListener('click', clearText);

async function chooseLogo() {
  const item = await window.sidlak.pickLogo();
  if (item) push({ logoUrl: item.url, logoVisible: true });
}
$('logo').addEventListener('click', () => {
  if (!state.logoUrl) chooseLogo();
  else push({ logoVisible: !state.logoVisible });
});
$('setLogo').addEventListener('click', chooseLogo);

// ---------- moving through the show ----------

function step(offset) {
  const i = offset > 0 ? nextIndex() : prevIndex();
  if (i >= 0) showSlide(slides[i].id);
}
function goTo(index) {
  if (slides[index]) showSlide(slides[index].id);
}
$('next').addEventListener('click', () => step(1));
$('prev').addEventListener('click', () => step(-1));

// Loop: after the last slide, Next goes back to the first, and Back from the first goes to the last.
function setLoop(on) {
  loop = on;
  prefs.set('loop', on);
  syncPreload();
  refreshUI();
}
$('loop').addEventListener('click', () => setLoop(!loop));

// Auto-advance: moves on by itself after `autoSeconds`. It only counts down while one of your
// slides is on the wall (not while blacked out or while a media tile is running), and it stops
// at the last slide unless Loop is on. Any slide you send yourself restarts the countdown.
let autoTimer = 0;
let lastAutoKey = '';
const autoKey = () => [autoOn, liveId, state.blackout, autoSeconds, nextIndex()].join('|');
const editingInspector = () => {
  const a = document.activeElement;
  return !!a && a !== document.body && $('editor').contains(a);
};

function armAuto() {
  clearTimeout(autoTimer);
  autoTimer = 0;
  lastAutoKey = autoKey();
  const bar = $('autoBar');
  bar.classList.remove('run');
  if (!autoOn || !findSlide(liveId) || state.blackout || nextIndex() < 0) return;
  bar.style.setProperty('--dur', `${autoSeconds}s`);
  void bar.offsetWidth; // restart the progress animation
  bar.classList.add('run');
  autoTimer = setTimeout(autoTick, autoSeconds * 1000);
}

function autoTick() {
  autoTimer = 0;
  const i = nextIndex();
  if (!autoOn || i < 0) return;
  // If you are typing in the inspector, the wall moves on but the inspector stays on your slide.
  showSlide(slides[i].id, { keepSelection: editingInspector() });
}

function setAuto(on) {
  autoOn = on;
  armAuto();
  refreshUI();
}
$('auto').addEventListener('click', () => setAuto(!autoOn));
$('autoSecs').addEventListener('change', (e) => {
  autoSeconds = clamp(Math.round(Number(e.target.value)) || 5, 1, 600);
  e.target.value = autoSeconds;
  prefs.set('autoSeconds', autoSeconds);
  armAuto();
});

function updateNext() {
  const i = nextIndex();
  if (i >= 0) {
    const next = slides[i];
    renderStage(nextPreview, slideState(next), { instant: true, still: true });
    $('nextName').textContent = i <= indexOfId(cursorId) ? `${next.name} (back to start)` : next.name;
  } else {
    renderStage(nextPreview, { bg: { kind: 'color', color: '#000000' }, text: '', sub: '' }, { instant: true, still: true });
    $('nextName').textContent = slides.length ? 'End of show' : 'No slides';
  }
}

// ---------- keeping the screen in step ----------

// Many actions change several things at once, so the screen is brought up to date once per frame.
let refreshQueued = false;
function refreshUI() {
  if (refreshQueued) return;
  refreshQueued = true;
  requestAnimationFrame(refreshNow);
}

function refreshNow() {
  refreshQueued = false;
  const nextI = nextIndex();
  const prevI = prevIndex();
  const nextId = nextI >= 0 ? slides[nextI].id : null;

  rows.forEach((r, id) => {
    const live = id === liveId && !state.blackout;
    const selected = id === selectedId;
    const upNext = id === nextId && !live;
    if (r.live !== live) {
      r.live = live;
      r.el.classList.toggle('live', live);
      r.liveTag.hidden = !live;
    }
    if (r.selected !== selected) {
      r.selected = selected;
      r.el.classList.toggle('selected', selected);
      r.el.setAttribute('aria-selected', String(selected));
    }
    if (r.upNext !== upNext) {
      r.upNext = upNext;
      r.nextTag.hidden = !upNext;
    }
  });

  // monitor
  const liveSlide = findSlide(liveId);
  $('monitor').classList.toggle('on', outputOpen && !state.blackout);
  $('liveTag').textContent = outputOpen ? 'Live' : 'Preview';
  $('liveName').textContent = state.blackout ? 'Blacked out' : liveSlide ? liveSlide.name : 'On the wall';
  $('position').textContent = liveSlide
    ? `Slide ${indexOfId(liveId) + 1} of ${slides.length}`
    : `${slides.length} slide${slides.length === 1 ? '' : 's'}`;
  updateNext();

  // Back / Next are only available when there is somewhere to go
  $('prev').disabled = prevI < 0;
  $('next').disabled = nextI < 0;

  // loop + auto
  $('loop').setAttribute('aria-pressed', String(loop));
  $('auto').setAttribute('aria-pressed', String(autoOn));
  let note = '';
  if (autoOn) {
    if (!liveSlide) note = state.blackout || cursorId ? 'Auto paused' : 'Auto: waiting for a slide';
    else if (state.blackout) note = 'Auto paused';
    else if (nextI < 0) note = 'Auto: end of show';
    else note = `Auto: every ${autoSeconds}s`;
  }
  $('autoNote').textContent = note;
  $('autoBar').classList.toggle('armed', autoOn);
  $('autoSecs').value = document.activeElement === $('autoSecs') ? $('autoSecs').value : autoSeconds;
  if (autoKey() !== lastAutoKey) armAuto();

  // wall buttons
  const b = $('blackout');
  b.setAttribute('aria-pressed', String(state.blackout));
  $('blackoutLabel').textContent = state.blackout ? 'Restore' : 'Blackout';

  const l = $('logo');
  const logoOn = state.logoVisible && !!state.logoUrl;
  l.setAttribute('aria-pressed', String(logoOn));
  $('logoLabel').textContent = logoOn ? 'Hide logo' : 'Logo';

  // the media tile that is on the wall on its own
  const wallUrl = !state.blackout && !state.text && !state.sub && state.bg.kind !== 'color' ? state.bg.url : '';
  tiles.forEach((el) => el.classList.toggle('live', !!wallUrl && el.dataset.url === wallUrl));
}

// ---------- output display picker ----------

const sel = $('display');

function renderDisplays(d) {
  outputOpen = d.outputOpen;
  const previous = sel.value;
  sel.textContent = '';

  d.list.forEach((x) => {
    const o = document.createElement('option');
    o.value = x.id;
    o.textContent = x.label;
    sel.append(o);
  });
  const test = document.createElement('option');
  test.value = 'test';
  test.textContent = 'Test window on this screen';
  sel.append(test);

  if ([...sel.options].some((o) => o.value === previous)) {
    sel.value = previous;
  } else {
    const second = d.list.find((x) => !x.primary);
    sel.value = second ? second.id : 'test';
  }

  $('toggleOutput').textContent = outputOpen ? 'Close output' : 'Open output';
  $('toggleOutput').classList.toggle('open', outputOpen);
  $('toggleOutput').classList.toggle('primary', !outputOpen);
  $('status').textContent = outputOpen ? 'Output is live' : 'Output closed';
  $('status').classList.toggle('live', outputOpen);
  refreshUI();
}

$('toggleOutput').addEventListener('click', () => {
  if (outputOpen) window.sidlak.closeOutput();
  else window.sidlak.openOutput(sel.value);
});

// Move the output to another screen while it is open.
sel.addEventListener('change', () => {
  if (outputOpen) window.sidlak.openOutput(sel.value);
});

// ---------- keyboard ----------

// After a mouse click, hand focus back so Space can never press a button by accident.
document.addEventListener('click', (e) => {
  const button = e.target.closest('button');
  if (button && e.detail > 0 && !button.closest('.seg')) button.blur();
});

document.addEventListener('keydown', (e) => {
  // Ctrl/Cmd shortcuts work everywhere, even while typing.
  if ((e.ctrlKey || e.metaKey) && !e.altKey && !e.shiftKey) {
    const key = e.key.toLowerCase();
    if (key === 's') { e.preventDefault(); $('saveProgram').click(); return; }
    if (key === 'o') { e.preventDefault(); $('loadProgram').click(); return; }
    if (key === 'n') { e.preventDefault(); newSlide(); return; }
    if (key === 'd' && !isTyping(e.target)) { e.preventDefault(); duplicateSlide(selectedId); return; }
    return;
  }

  if (isTyping(e.target)) return;
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    nudgeSelected(e.key === 'ArrowUp' ? -1 : 1);
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  const key = e.key;
  const navKeys = [' ', 'ArrowRight', 'ArrowDown', 'PageDown', 'ArrowLeft', 'ArrowUp', 'PageUp', 'Home', 'End'];
  const isLetter = ['b', 'l', 'a', 'c'].includes(key.toLowerCase());
  const isEnter = key === 'Enter' && !e.target.closest('button, select, a');
  if (!navKeys.includes(key) && !isLetter && !isEnter) return;

  e.preventDefault();
  // Holding a key down must never fly through the show.
  if (e.repeat) return;

  if (key === ' ' || key === 'ArrowRight' || key === 'ArrowDown' || key === 'PageDown') step(1);
  else if (key === 'ArrowLeft' || key === 'ArrowUp' || key === 'PageUp') step(-1);
  else if (key === 'Home') goTo(0);
  else if (key === 'End') goTo(slides.length - 1);
  else if (isEnter) {
    const row = e.target.closest('.row');
    showSlide(row ? row.dataset.id : selectedId);
  } else {
    const k = key.toLowerCase();
    if (k === 'b') toggleBlackout();
    else if (k === 'l') setLoop(!loop);
    else if (k === 'a') setAuto(!autoOn);
    else if (k === 'c') clearText();
  }
});
document.addEventListener('keyup', (e) => {
  // Stops Space from clicking whichever button has focus.
  if (e.key === ' ' && !isTyping(e.target)) e.preventDefault();
});

// ---------- start up ----------

setView(viewMode, false);
setClickLive(clickLive, false);
setLeftWidth(Number(prefs.get('leftWidth', LEFT_DEFAULT)) || LEFT_DEFAULT);
$('autoSecs').value = autoSeconds;

window.sidlak.onDisplays(renderDisplays);
window.sidlak.getDisplays().then((d) => {
  state = { ...state, ...d.state };
  media = d.media || [];
  renderStage(preview, state);
  renderDisplays(d);
  syncList();
  syncMedia();
  loadEditor();
});
