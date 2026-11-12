# Sidlak

A control window for you, and an output window for the LED wall or projector.

## Run it

1. Install Node.js (LTS) from https://nodejs.org
2. Open a terminal in this folder and run:

       npm install
       npm start

The dependencies are listed in `package.json`, so future installs only need `npm install`.

## Using it

- **Output display:** pick a screen and click Open output. With one screen, use "Test window on this screen". Press Esc in the output to close it.
- **Media:** click "Add images or videos". Images: png, jpg, webp, gif. Videos: mp4, webm, m4v (H.264 mp4 is the safest). Videos loop silently.
- **Run of show:** one list on the left. Click a slide to select and edit it (nothing changes on the wall). Double-click, press Enter, or use the play button to send it live. Drag rows to reorder, or press Alt+Up / Alt+Down.
- **Slide panel (right):** name, title, subtitle, text layout (centre, left, lower third), font (Anton, Playfair Display, Inter), background and picture fit. Long text shrinks automatically to fit.
- **Import slides:** click "Import images or PDF" to add image files as slides or turn each page of a PDF into its own slide. PDFs up to 100 MB and 100 pages are supported. Each page is saved as an image in the app's cache folder and shown from there, with a small thumbnail for the list. Imported pictures show whole (letterboxed) rather than cropped.
- **Programs:** use Save and Open in the run-of-show panel. A saved `.sidlak` file has a matching `.sidlak.assets` folder beside it; keep both together when moving or backing up a program.
- **Background only:** click a media tile to change just the background. The text stays.
- **Crossfade:** backgrounds fade into each other, and text fades out and back in.
- **Buttons:** Blackout (or B), Clear text, Logo. The first Logo click asks for an image. "Set logo" changes it. The logo hides the text while it is showing.
- **Keys:** Space, Right and Down go to the next slide; Left and Up go back; B toggles blackout. The next slide is preloaded on the output.
- **Unsaved changes:** the header shows when the program has changes, and closing the app asks first.

## Files

- `main.js` - windows, displays, file picking, and checks on what the wall may show
- `preload.js` - the safe bridge between the windows and `main.js`
- `control.html` / `control.js` - the run of show, thumbnails, live preview, and controls
- `pdf-import.js` - PDF page rendering
- `output.html` / `output.js` - what the audience sees
- `fonts/` - bundled woff2 files (Inter, Anton, Playfair Display; SIL Open Font License, licences included)
- `stage.css` / `render.js` - the stage (backgrounds, text, logo, blackout), shared by the output, preview and thumbnails

## Windows installer

    npm i -D electron-builder
    npm run dist

The installer appears in `dist/`. Windows SmartScreen will warn about an unsigned app.
