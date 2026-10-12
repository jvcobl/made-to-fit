// Bundle the game with Three.js into one self-contained HTML file.
// node build.mjs            -> dist/who-bends.html (a full page, for local tests; the file name stays for the test scripts)
// node build.mjs artifact   -> dist/who-bends-artifact.html (no document tags; the Artifact host adds them)
// node build.mjs site       -> dist/site/ (the GitHub Pages site: the full page plus a link preview, icons and .nojekyll)
import { build } from 'esbuild';
import fs from 'fs';
const mode = process.argv[2] || 'page';
const artifact = mode === 'artifact';
const site = mode === 'site';

// The public address of the GitHub Pages site. Link previews need absolute URLs.
const SITE_URL = 'https://jvcobl.github.io/made-to-fit/';
const DESC = 'A free 3D browser game about who should change, the person or the place. Fix a small town built around a “Standard Resident” nobody matches, while the game shows you its own reward hooks.';
const attr = (s) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, outfile: 'dist/game.js', target: 'es2020', legalComments: 'none', logLevel: 'warning' });
const js = fs.readFileSync('dist/game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">';
const body = '<div id="loading" role="status">Larkspur is waking up…</div>\n<div id="ui" role="main"></div>\n<script>' + js + '</script>';
const meta = !site ? '' : [
  '<meta name="description" content="' + attr(DESC) + '">',
  '<link rel="canonical" href="' + SITE_URL + '">',
  '<meta name="theme-color" content="#15131c">',
  '<link rel="icon" href="favicon-32.png" type="image/png" sizes="32x32">',
  '<link rel="icon" href="favicon.svg" type="image/svg+xml">',
  '<link rel="apple-touch-icon" href="apple-touch-icon.png">',
  '<meta property="og:type" content="website">',
  '<meta property="og:title" content="Made to Fit">',
  '<meta property="og:description" content="' + attr(DESC) + '">',
  '<meta property="og:url" content="' + SITE_URL + '">',
  '<meta property="og:image" content="' + SITE_URL + 'og-image.jpg">',
  '<meta property="og:image:width" content="1200">',
  '<meta property="og:image:height" content="630">',
  '<meta property="og:image:alt" content="The title Made to Fit over a small 3D town with a market square, a town hall and autumn trees">',
  '<meta name="twitter:card" content="summary_large_image">',
].join('\n') + '\n';
const html = artifact
  ? '<title>Made to Fit</title>\n' + fonts + '\n<style>' + css + '</style>\n' + body + '\n'
  : '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>Made to Fit</title>\n' + meta + fonts + '\n<style>' + css + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
if (site) {
  fs.mkdirSync('dist/site', { recursive: true });
  fs.writeFileSync('dist/site/index.html', html);
  for (const f of ['og-image.jpg', 'favicon.svg', 'favicon-32.png', 'apple-touch-icon.png']) fs.copyFileSync('site/' + f, 'dist/site/' + f);
  fs.writeFileSync('dist/site/.nojekyll', '');
  console.log('built dist/site/ (index.html ' + Math.round(html.length / 1024) + ' KB, preview image, icons)');
} else {
  const out = artifact ? 'dist/who-bends-artifact.html' : 'dist/who-bends.html';
  fs.writeFileSync(out, html);
  console.log('built', out, Math.round(html.length / 1024) + ' KB');
}
