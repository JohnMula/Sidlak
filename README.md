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
- **Running a picture or video:** click a media tile to put it on the wall by itself. Any title or subtitle is removed while it shows, and Next and Back carry on from the last slide you sent.
- **Pictures and videos on a slide:** hover a slide and click the + on its thumbnail, or select it and click the + beside Background. Pick a file and it becomes that slide's picture. A slide shows the title and subtitle you typed on top of its picture or video, so leave both empty to show the picture or video on its own.
- **Crossfade:** backgrounds fade into each other, and text fades out and back in.
- **Buttons:** Blackout (or B), Clear text, Logo. The first Logo click asks for an image. "Set logo" changes it. The logo hides the text while it is showing.
- **Keys:** Space, Right, Down and Page Down go to the next slide; Left, Up and Page Up go back; Home and End jump to the first and last slide; B toggles blackout; C clears the text; L toggles Loop; A toggles Auto. Holding a key down does not skip through the show. Ctrl+S saves, Ctrl+O opens, Ctrl+N adds a slide, Ctrl+D duplicates the selected slide. The next and previous slides are preloaded on the output.
- **Loop:** the Loop button (or L). When on, Next after the last slide goes back to the first, and Back from the first slide goes to the last. When off, Next and Back stop at the ends. The setting is remembered.
- **Auto:** the Auto button (or A) with a seconds box beside it. Moves to the next slide by itself after that many seconds, with a thin progress bar under the monitor. It counts only while one of your slides is on the wall (not while blacked out, or while a media tile or cleared text is showing), stops at the last slide unless Loop is on, and restarts whenever you send a slide yourself. It always starts switched off.
- **Views:** switch the run of show between list and grid with the two buttons at its top; drag the edge of the panel to make it wider (double-click the edge to reset). The lightning button turns on "click to go live", so one click sends a slide to the wall instead of just selecting it. The slide that is live is red, the one Next will show is marked NEXT, and the list scrolls to follow the show.
- **Unsaved changes:** the header shows when the program has changes, and closing the app asks first.

## Files

- `main.js` - windows, displays, file picking, and checks on what the wall may show
- `preload.js` - the safe bridge between the windows and `main.js`
- `control.html` / `control.css` / `control.js` - the run of show, thumbnails, live preview, and controls
- `pdf-import.js` - PDF page rendering
- `output.html` / `output.js` - what the audience sees
- `fonts/` - bundled woff2 files (Inter, Anton, Playfair Display; SIL Open Font License, licences included)
- `stage.css` / `render.js` - the stage (backgrounds, text, logo, blackout), shared by the output, preview and thumbnails

## Windows installer

    npm i -D electron-builder
    npm run dist

The installer appears in `dist/`. Windows SmartScreen will warn about an unsigned app.
