const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('sidlak', {
  getDisplays: () => ipcRenderer.invoke('displays:get'),
  onDisplays: (cb) => ipcRenderer.on('displays', (_e, d) => cb(d)),
  openOutput: (target) => ipcRenderer.send('output:open', target),
  closeOutput: () => ipcRenderer.send('output:close'),
  setState: (patch) => ipcRenderer.send('state:set', patch),
  onState: (cb) => ipcRenderer.on('state', (_e, s) => cb(s)),
  setPreload: (bgs) => ipcRenderer.send('preload:set', bgs),
  onPreload: (cb) => ipcRenderer.on('preload', (_e, b) => cb(b)),
  pickMedia: () => ipcRenderer.invoke('media:pick', 'any'),
  pickLogo: () => ipcRenderer.invoke('media:pick', 'image').then((items) => items[0] || null),
  pickSlides: () => ipcRenderer.invoke('slides:pick'),
  cacheImage: (bytes) => ipcRenderer.invoke('cache:save', bytes),
  saveProgram: (program) => ipcRenderer.invoke('program:save', program),
  loadProgram: () => ipcRenderer.invoke('program:load'),
  setDirty: (dirty) => ipcRenderer.send('program:dirty', !!dirty),
});
