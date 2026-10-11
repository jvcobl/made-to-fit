// Bundle the game with Three.js into one self-contained HTML file.
// node build.mjs            -> dist/who-bends.html (a full page, for local tests; the file name stays for the test scripts)
// node build.mjs artifact   -> dist/who-bends-artifact.html (no document tags; the Artifact host adds them)
import { build } from 'esbuild';
import fs from 'fs';
const artifact = process.argv[2] === 'artifact';
await build({ entryPoints: ['src/main.js'], bundle: true, format: 'iife', minify: true, outfile: 'dist/game.js', target: 'es2020', legalComments: 'none', logLevel: 'warning' });
const js = fs.readFileSync('dist/game.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const css = fs.readFileSync('src/style.css', 'utf8');
const fonts = '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fredoka:wght@400;500;600;700&display=swap" rel="stylesheet">';
const body = '<div id="loading" role="status">Larkspur is waking up…</div>\n<div id="ui" role="main"></div>\n<script>' + js + '</script>';
const html = artifact
  ? '<title>Made to Fit</title>\n' + fonts + '\n<style>' + css + '</style>\n' + body + '\n'
  : '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n<title>Made to Fit</title>\n' + fonts + '\n<style>' + css + '</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const out = artifact ? 'dist/who-bends-artifact.html' : 'dist/who-bends.html';
fs.writeFileSync(out, html);
console.log('built', out, Math.round(html.length / 1024) + ' KB');
