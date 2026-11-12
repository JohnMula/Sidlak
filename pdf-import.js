import * as pdfjsLib from './node_modules/pdfjs-dist/build/pdf.mjs';

const base = new URL('./node_modules/pdfjs-dist/', import.meta.url).href;
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('build/pdf.worker.mjs', base).href;

const toJpeg = (canvas, quality) => new Promise((resolve, reject) => {
  canvas.toBlob(async (blob) => {
    if (!blob) return reject(new Error('Could not encode a PDF page.'));
    resolve(new Uint8Array(await blob.arrayBuffer()));
  }, 'image/jpeg', quality);
});

// Renders each page to a file in the app cache (full size for the wall, 320px for
// thumbnails). Returns [{ url, thumb }]. Nothing big is kept in memory or sent over IPC again.
window.sidlakImportPdfPages = async (pdf, onProgress) => {
  const binary = atob(pdf.data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);

  const loadingTask = pdfjsLib.getDocument({
    data: bytes,
    wasmUrl: new URL('wasm/', base).href,
    cMapUrl: new URL('cmaps/', base).href,
    cMapPacked: true,
    standardFontDataUrl: new URL('standard_fonts/', base).href,
  });
  const pdfDocument = await loadingTask.promise;
  const pages = [];
  try {
    if (pdfDocument.numPages > 100) throw new Error('PDFs with more than 100 pages are not supported.');
    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
      if (onProgress) onProgress(pageNumber, pdfDocument.numPages);
      const page = await pdfDocument.getPage(pageNumber);
      const natural = page.getViewport({ scale: 1 });
      // Fit inside 1920x1080, never more than 4x.
      const scale = Math.min(4, 1920 / natural.width, 1080 / natural.height);
      const viewport = page.getViewport({ scale });
      const canvas = window.document.createElement('canvas');
      canvas.width = Math.ceil(viewport.width);
      canvas.height = Math.ceil(viewport.height);
      const context = canvas.getContext('2d');
      if (!context) throw new Error('Could not render a PDF page.');
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: context, viewport }).promise;

      const small = window.document.createElement('canvas');
      const ratio = Math.min(1, 320 / canvas.width);
      small.width = Math.max(1, Math.round(canvas.width * ratio));
      small.height = Math.max(1, Math.round(canvas.height * ratio));
      small.getContext('2d').drawImage(canvas, 0, 0, small.width, small.height);

      const url = await window.sidlak.cacheImage(await toJpeg(canvas, 0.88));
      const thumb = await window.sidlak.cacheImage(await toJpeg(small, 0.8));
      pages.push({ url, thumb });
      canvas.width = canvas.height = small.width = small.height = 0; // release the pixels
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return pages;
};
