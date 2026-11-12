// Shared by the output window, the live preview and every thumbnail.
//
// A state looks like:
//   { bg: { kind: 'color', color: '#2a1458' }
//         or { kind: 'image' | 'video', url, thumb?, fit?: 'cover' | 'contain' },
//     text, sub, layout: 'center' | 'left' | 'lower', font: 'display' | 'serif' | 'clean',
//     logoUrl, logoVisible, blackout }

(function () {
  function brightness(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255;
    const g = (n >> 8) & 255;
    const b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  }

  // Load the bundled faces up front so the first slide never waits on a font.
  if (document.fonts && document.fonts.load) {
    ['400 1em "Anton"', '700 1em "Playfair Display"', '500 1em "Inter"', '800 1em "Inter"']
      .forEach((f) => document.fonts.load(f).catch(() => {}));
  }

  // Empty a background layer and stop any video inside it.
  function clearLayer(layer) {
    layer.querySelectorAll('video').forEach((v) => {
      v.pause();
      v.removeAttribute('src');
      v.load();
    });
    layer.textContent = '';
    layer.style.background = '';
  }

  // Put a background into a layer. Resolves when it is ready to be shown.
  function fillLayer(layer, bg, still) {
    clearLayer(layer);

    if (bg.kind === 'color') {
      layer.style.background = bg.color;
      return Promise.resolve();
    }

    if (bg.kind === 'image') {
      const img = new Image();
      img.className = 'media' + (bg.fit === 'contain' ? ' contain' : '');
      img.alt = '';
      // Thumbnails use the small copy when there is one.
      img.src = still && bg.thumb ? bg.thumb : bg.url;
      if (bg.fit === 'contain') layer.style.background = '#000';
      // A missing file shows a dark red layer instead of nothing.
      img.addEventListener('error', () => { layer.style.background = '#3a1416'; img.remove(); }, { once: true });
      layer.append(img);
      return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
    }

    const v = document.createElement('video');
    v.className = 'media';
    v.muted = true;
    v.setAttribute('muted', '');
    v.playsInline = true;

    if (still) {
      // Thumbnail: just show a frame, do not play.
      v.preload = 'metadata';
      v.src = bg.url + '#t=0.1';
      layer.append(v);
      return Promise.resolve();
    }

    v.loop = true;
    v.autoplay = true;
    v.src = bg.url;
    v.addEventListener('error', () => { layer.style.background = '#3a1416'; }, { once: true });
    layer.append(v);
    const started = v.play && v.play();
    if (started && started.catch) started.catch(() => {});

    return new Promise((resolve) => {
      v.addEventListener('loadeddata', resolve, { once: true });
      v.addEventListener('error', resolve, { once: true });
      setTimeout(resolve, 4000); // never wait forever
    });
  }

  function setBackground(root, bg, opts) {
    const key = bg.kind + '|' + (bg.color || bg.url) + '|' + (bg.fit || '');
    if (root._bgKey === key) return;
    root._bgKey = key;

    const layers = root.querySelectorAll('.bg');

    // If a fade is still running, finish it right now.
    if (root._finish) root._finish();
    const token = (root._bgToken = (root._bgToken || 0) + 1);

    // First background, or no animation wanted: swap in place.
    if (root._front < 0 || opts.instant) {
      const i = root._front < 0 ? 0 : root._front;
      clearLayer(layers[i ^ 1]);
      layers[i ^ 1].classList.remove('on');
      fillLayer(layers[i], bg, opts.still);
      layers[i].classList.add('on');
      layers[i].style.zIndex = 2;
      root._front = i;
      return;
    }

    // Crossfade: load into the hidden layer, then fade it in over the old one.
    const front = layers[root._front];
    const next = layers[root._front ^ 1];

    fillLayer(next, bg, false).then(() => {
      if (token !== root._bgToken) return; // a newer change replaced this one
      next.style.zIndex = 2;
      front.style.zIndex = 1;
      next.classList.add('on');

      const finish = () => {
        clearTimeout(timer);
        front.classList.remove('on');
        clearLayer(front);
        root._front ^= 1;
        root._finish = null;
      };
      const timer = setTimeout(finish, 900);
      root._finish = finish;
    });
  }

  // Shrink long text until it fits. Sizes are in cqw, so the result is the same
  // at every box size and only needs to run when the text or style changes.
  function fit(root) {
    const stage = root.querySelector('.stage');
    const txt = root.querySelector('.txt');
    const h = root.clientHeight;
    if (!h || !root.clientWidth) return;
    const maxH = h * (stage.classList.contains('l-lower') ? 0.3 : 0.78);
    let k = 1;
    stage.style.setProperty('--k', '1');
    for (let i = 0; i < 16 && k > 0.3 && txt.getBoundingClientRect().height > maxH; i += 1) {
      k *= 0.92;
      stage.style.setProperty('--k', k.toFixed(3));
    }
  }

  function setOption(el, prefix, value) {
    [...el.classList].filter((c) => c.startsWith(prefix)).forEach((c) => el.classList.remove(c));
    el.classList.add(prefix + value);
  }

  // Fill an empty element with the stage markup.
  window.makeStage = function (root) {
    root.classList.add('stage-root');
    root.innerHTML =
      '<div class="bgwrap"><div class="bg"></div><div class="bg"></div></div>' +
      '<div class="scrim"></div>' +
      '<div class="stage l-center f-display"><div class="txt"><h1 class="title"></h1><p class="sub"></p></div></div>' +
      '<img class="logo" alt="">' +
      '<div class="black"></div>';
    root._front = -1; // no background yet
  };

  // Show a state on a stage. opts: { instant, still } for thumbnails.
  window.renderStage = function (root, s, opts) {
    opts = opts || {};
    const stage = root.querySelector('.stage');
    const title = root.querySelector('.title');
    const sub = root.querySelector('.sub');
    const logo = root.querySelector('.logo');
    const black = root.querySelector('.black');
    const scrim = root.querySelector('.scrim');
    const layout = s.layout || 'center';
    const font = s.font || 'display';

    root._latest = s;
    root.classList.toggle('instant', !!opts.instant);

    // background (with crossfade)
    setBackground(root, s.bg, opts);

    // text colour: dark text on light colours, white on media and in the lower third
    const light = s.bg.kind === 'color' && layout !== 'lower' && brightness(s.bg.color) > 0.6;
    stage.style.color = light ? '#14121f' : '#ffffff';
    stage.style.textShadow = s.bg.kind === 'color' || layout === 'lower' ? 'none' : '0 0.2cqw 1.2cqw rgba(0, 0, 0, 0.45)';

    // logo (hides the text while it is showing)
    const logoUrl = s.logoUrl || '';
    if (logo.dataset.url !== logoUrl) {
      logo.dataset.url = logoUrl;
      if (logoUrl) logo.src = logoUrl;
      else logo.removeAttribute('src');
    }
    const showLogo = !!(s.logoVisible && logoUrl);
    logo.classList.toggle('show', showLogo);
    stage.classList.toggle('off', showLogo);

    // scrim: only on photos and video that carry text
    const hasText = !!(s.text || s.sub);
    scrim.classList.toggle('lower', layout === 'lower');
    scrim.classList.toggle('show', s.bg.kind !== 'color' && s.bg.fit !== 'contain' && hasText && !showLogo);

    // blackout
    black.style.opacity = s.blackout ? '1' : '0';

    // text (fades out, swaps, fades in)
    const key = [s.text, s.sub, layout, font].join('\u0000');
    if (root.dataset.key === key) return;
    const first = root.dataset.key === undefined;
    root.dataset.key = key;

    const apply = () => {
      const c = root._latest;
      setOption(stage, 'l-', c.layout || 'center');
      setOption(stage, 'f-', c.font || 'display');
      title.textContent = c.text;
      sub.textContent = c.sub;
      fit(root);
      if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => fit(root));
      stage.classList.remove('swap');
    };

    if (first || opts.instant) {
      apply();
      return;
    }
    stage.classList.add('swap');
    setTimeout(apply, 220);
  };
})();
