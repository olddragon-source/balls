/**
 * Builds dist/ for offline copy (file://, Android): bundled JS + static assets.
 * Day-to-day: edit js/, run `npm start`, reload — no compile needed.
 */
import * as esbuild from 'esbuild';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(root, 'dist');

await fs.rm(dist, { recursive: true, force: true });
await fs.mkdir(dist, { recursive: true });

await esbuild.build({
  absWorkingDir: root,
  entryPoints: ['js/main.js'],
  bundle: true,
  format: 'iife',
  outfile: 'dist/game.bundle.js',
});

const indexSrc = await fs.readFile(path.join(root, 'index.html'), 'utf8');
const indexOut = indexSrc.replace(
  /\n\s*<script type="module" src="js\/main\.js"><\/script>\s*/,
  '\n  <script defer src="game.bundle.js"></script>\n',
);
if (indexOut === indexSrc) {
  throw new Error('compile.mjs: expected <script type="module" src="js/main.js"> in index.html');
}
await fs.writeFile(path.join(dist, 'index.html'), indexOut, 'utf8');

await fs.cp(path.join(root, 'css'), path.join(dist, 'css'), { recursive: true });
await fs.cp(path.join(root, 'balls'), path.join(dist, 'balls'), { recursive: true });

const hi = path.join(root, 'highscore.txt');
try {
  await fs.copyFile(hi, path.join(dist, 'highscore.txt'));
} catch (e) {
  if (/** @type {NodeJS.ErrnoException} */ (e).code !== 'ENOENT') throw e;
}

console.log('Output: dist/ — open dist/index.html locally (file://) or zip dist/ for another device.');
