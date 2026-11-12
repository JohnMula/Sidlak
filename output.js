const out = document.getElementById('out');
makeStage(out);

window.sidlak.onState((s) => renderStage(out, s));

// Keep the next slide's background decoded so the crossfade starts at once.
let warm = [];
window.sidlak.onPreload((bgs) => {
  warm = bgs.map((bg) => {
    if (bg.kind === 'image') {
      const img = new Image();
      img.src = bg.url;
      img.decode().catch(() => {});
      return img;
    }
    if (bg.kind === 'video') {
      const v = document.createElement('video');
      v.preload = 'auto';
      v.muted = true;
      v.src = bg.url;
      return v;
    }
    return null;
  }).filter(Boolean);
});

// Escape closes the output window.
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') window.sidlak.closeOutput();
});
