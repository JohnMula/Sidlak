const $ = (id) => document.getElementById(id);

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

const rows = new Map(); // slide id -> { el, stage, name, num }

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
const mediaBg = (m) => ({ kind: m.kind, url: m.url });
const slideState = (s) => ({ bg: s.bg, text: s.text || '', sub: s.sub || '', layout: s.layout || 'center', font: s.font || 'display', logoUrl: '', logoVisible: false, blackout: false });
const mediaState = (m) => slideState({ bg: mediaBg(m) });

function setDirty(value) {
  dirty = value;
  $('dirty').hidden = !dirty;
  window.sidlak.setDirty(dirty);
}

function setProgramName(name) {
  programName = name;
  $('programName').textContent = name;
}

// ---------- sending changes to the wall ----------

function push(patch) {
  state = { ...state, ...patch };
  window.sidlak.setState(patch);
  renderStage(preview, state);
  refreshUI();
}

function showSlide(id) {
  const s = findSlide(id);
  if (!s) return;
  liveId = id;
  selectedId = id;
  push({ ...slideState(s), logoUrl: state.logoUrl, logoVisible: false, blackout: false });
  const next = slides[slides.indexOf(s) + 1];
  window.sidlak.setPreload(next ? [next.bg] : []);
  loadEditor();
}

// ---------- run of show ----------

function paintSlide(s) {
  const r = rows.get(s.id);
  if (!r) return;
  renderStage(r.stage, slideState(s), { instant: true, still: true });
  r.name.textContent = s.name;
  r.el.title = s.name;
  updateNext();
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
  const stage = document.createElement('div');
  makeStage(stage);
  const meta = document.createElement('div');
  meta.className = 'meta';
  const name = document.createElement('span');
  name.className = 'name';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = 'Live';
  badge.hidden = true;
  meta.append(name, badge);
  const go = document.createElement('button');
  go.type = 'button';
  go.className = 'btn quiet icon go';
  go.title = 'Send live (double-click)';
  go.setAttribute('aria-label', 'Send live');
  go.innerHTML = icon('play');
  el.append(grip, num, stage, meta, go);

  el.addEventListener('click', () => selectSlide(id));
  el.addEventListener('dblclick', () => showSlide(id));
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target === el) { e.preventDefault(); showSlide(id); }
  });
  go.addEventListener('click', (e) => { e.stopPropagation(); showSlide(id); });

  // drag to reorder
  el.addEventListener('dragstart', (e) => {
    window._dragId = id;
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', id);
    el.classList.add('dragging');
  });
  el.addEventListener('dragend', () => {
    window._dragId = null;
    rows.forEach((r) => r.el.classList.remove('dragging', 'drop-before', 'drop-after'));
  });
  const after = (e) => {
    const box = el.getBoundingClientRect();
    return e.clientY > box.top + box.height / 2;
  };
  el.addEventListener('dragover', (e) => {
    if (!window._dragId || window._dragId === id) return;
    e.preventDefault();
    const a = after(e);
    el.classList.toggle('drop-before', !a);
    el.classList.toggle('drop-after', a);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-before', 'drop-after'));
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-before', 'drop-after');
    if (window._dragId && window._dragId !== id) moveSlideTo(window._dragId, id, after(e));
  });

  return { el, stage, name, num, badge, go };
}

// Brings the list in line with `slides` without rebuilding rows that already exist.
function syncList() {
  const ids = new Set(slides.map((s) => s.id));
  rows.forEach((r, id) => {
    if (!ids.has(id)) { r.el.remove(); rows.delete(id); }
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
  refreshUI();
}

function resetList() {
  rows.forEach((r) => r.el.remove());
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
  const r = rows.get(s.id);
  if (r) r.el.scrollIntoView({ block: 'nearest' });
  $('edTitle').focus();
  $('edTitle').select();
}
$('newSlide').addEventListener('click', newSlide);

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
        media.push(file);
        addSlide(imageSlideName(file.name), { ...mediaBg(file), fit: 'contain' });
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
      buildMedia();
      loadEditor();
      setDirty(true);
    }
  }
}
$('importSlides').addEventListener('click', importSlides);

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
    stash.clear();
    $('programStatus').textContent = 'Program loaded.';
    resetList();
    syncList();
    buildMedia();
    loadEditor();
    setProgramName('Opened program');
    setDirty(false);
  } catch (error) {
    alert(`Could not open program: ${error.message}`);
  }
});

// ---------- media ----------

function buildMedia() {
  const grid = $('media');
  grid.textContent = '';
  $('mediaEmpty').hidden = media.length > 0;

  media.forEach((m) => {
    const btn = document.createElement('button');
    btn.className = 'tile';
    btn.title = `${m.name}: use as the background`;
    const stage = document.createElement('div');
    makeStage(stage);
    renderStage(stage, mediaState(m), { instant: true, still: true });
    const label = document.createElement('span');
    label.textContent = m.name;
    btn.append(stage, label);
    btn.addEventListener('click', () => {
      liveId = null; // the wall no longer matches a slide
      push({ bg: mediaBg(m), blackout: false });
    });
    grid.append(btn);
  });
}

$('addMedia').addEventListener('click', async () => {
  const items = await window.sidlak.pickMedia();
  if (!items.length) return;
  media = media.concat(items);
  buildMedia();
  const s = findSlide(selectedId);
  if (s) fillBgSelect(s);
  setDirty(true);
});

// ---------- slide inspector ----------

const isLibraryMedia = (bg) => bg.kind !== 'color' && media.some((m) => m.url === bg.url);

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
  if (own) add('current', 'This slide\u2019s picture');
  else if (s.bg.kind === 'color' && stash.has(s.id)) add('current', 'This slide\u2019s picture');

  if (s.bg.kind === 'color') sel.value = 'color';
  else if (inLibrary) sel.value = media.find((m) => m.url === s.bg.url).id;
  else sel.value = 'current';

  $('edColor').hidden = sel.value !== 'color';
  if (s.bg.kind === 'color') $('edColor').value = s.bg.color;
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
      if (s.bg.kind !== 'color' && !isLibraryMedia(s.bg)) stash.set(s.id, s.bg); // so it can be switched back
      s.bg = { kind: 'color', color: $('edColor').value };
    } else if (value === 'current') {
      const saved = stash.get(s.id);
      if (saved) s.bg = saved;
    } else {
      const m = media.find((x) => x.id === value);
      if (m) s.bg = mediaBg(m);
    }
  });
  fillBgSelect(findSlide(selectedId));
});

$('edColor').addEventListener('input', (e) => edit((s) => (s.bg = { kind: 'color', color: e.target.value })));

$('edFit').addEventListener('change', (e) => edit((s) => {
  if (s.bg.kind !== 'image') return;
  s.bg = { ...s.bg };
  if (e.target.value === 'contain') s.bg.fit = 'contain';
  else delete s.bg.fit;
}));

$('edSend').addEventListener('click', () => showSlide(selectedId));

$('edDelete').addEventListener('click', () => {
  const s = findSlide(selectedId);
  if (!s || !confirm(`Delete \u201C${s.name}\u201D?`)) return;
  const index = slides.indexOf(s);
  slides = slides.filter((x) => x.id !== s.id);
  stash.delete(s.id);
  if (liveId === s.id) liveId = null;
  selectedId = slides.length ? slides[Math.min(index, slides.length - 1)].id : null;
  syncList();
  loadEditor();
  setDirty(true);
});

// ---------- wall controls ----------

const toggleBlackout = () => push({ blackout: !state.blackout });
$('blackout').addEventListener('click', toggleBlackout);

$('clearText').addEventListener('click', () => {
  liveId = null;
  push({ text: '', sub: '' });
});

async function chooseLogo() {
  const item = await window.sidlak.pickLogo();
  if (item) push({ logoUrl: item.url, logoVisible: true });
}
$('logo').addEventListener('click', () => {
  if (!state.logoUrl) chooseLogo();
  else push({ logoVisible: !state.logoVisible });
});
$('setLogo').addEventListener('click', chooseLogo);

function step(offset) {
  const index = slides.findIndex((s) => s.id === liveId);
  const target = offset > 0 ? slides[index + 1] : slides[Math.max(index - 1, 0)];
  if (target) showSlide(target.id);
}
$('next').addEventListener('click', () => step(1));
$('prev').addEventListener('click', () => step(-1));

function updateNext() {
  const index = slides.findIndex((s) => s.id === liveId);
  const next = slides[index + 1];
  if (next) {
    renderStage(nextPreview, slideState(next), { instant: true, still: true });
    $('nextName').textContent = `Next: ${next.name}`;
  } else {
    renderStage(nextPreview, { bg: { kind: 'color', color: '#000000' }, text: '', sub: '' }, { instant: true, still: true });
    $('nextName').textContent = slides.length ? 'End of show' : 'No slides';
  }
}

function refreshUI() {
  rows.forEach((r, id) => {
    const live = id === liveId && !state.blackout;
    r.el.classList.toggle('live', live);
    r.badge.hidden = !live;
    r.el.classList.toggle('selected', id === selectedId);
    r.el.setAttribute('aria-selected', String(id === selectedId));
  });

  const liveSlide = findSlide(liveId);
  $('monitor').classList.toggle('on', outputOpen && !state.blackout);
  $('liveName').textContent = state.blackout ? 'Blacked out' : liveSlide ? `Live: ${liveSlide.name}` : 'On the wall';
  updateNext();

  const b = $('blackout');
  b.setAttribute('aria-pressed', String(state.blackout));
  $('blackoutLabel').textContent = state.blackout ? 'Restore' : 'Blackout';

  const l = $('logo');
  const logoOn = state.logoVisible && !!state.logoUrl;
  l.setAttribute('aria-pressed', String(logoOn));
  $('logoLabel').textContent = logoOn ? 'Hide logo' : 'Logo';
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
  if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
  if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    e.preventDefault();
    nudgeSelected(e.key === 'ArrowUp' ? -1 : 1);
    return;
  }
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === 'ArrowRight' || e.key === 'ArrowDown' || e.key === ' ') {
    e.preventDefault();
    step(1);
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault();
    step(-1);
  } else if (e.key === 'b' || e.key === 'B') {
    toggleBlackout();
  }
});
document.addEventListener('keyup', (e) => {
  // Stops Space from clicking whichever button has focus.
  if (e.key === ' ' && !['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) e.preventDefault();
});

// ---------- start up ----------

window.sidlak.onDisplays(renderDisplays);
window.sidlak.getDisplays().then((d) => {
  state = { ...state, ...d.state };
  media = d.media || [];
  renderStage(preview, state);
  renderDisplays(d);
  syncList();
  buildMedia();
  loadEditor();
});
