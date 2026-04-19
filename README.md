# balls game js
npm test

Development (no compile)
index.html again uses type="module" and js/main.js.
Run npm start, change files under js/, refresh the browser — edits apply immediately.
When you need a portable / offline build
Run npm run compile.
It writes dist/: bundled game.bundle.js, index.html (with that bundle), css/, balls/, and highscore.txt if it exists.
Zip dist/ for another PC or Android, or open dist/index.html from disk for file://.