'use strict';
// Usage: node scripts/install-home.js [--check]
// Adds the "Home" screen to public/pages/{student,tutor,advisor,director}.html:
//   - sidebar link <a href="#home"> as the FIRST option of the menu
//   - <section id="home"> with #home-root (topbar copied from the first section)
//   - home.css / home.js includes
// Home is the landing screen, so the previous "active" menu option is cleared:
// the shell marks the first link as active on load.
// Idempotent: a page that already has #home-root is left untouched. A .bak copy is written the first time.
const fs = require('fs');
const path = require('path');

const PAGES_DIR = path.join(__dirname, '..', 'public', 'pages');
const PANELS = ['student', 'tutor', 'advisor', 'director'];
const checkOnly = process.argv.includes('--check');

const NAV_LINK = '<a class="app-nav-link" href="#home"><i class="fa-solid fa-house" aria-hidden="true"></i><span>Home</span></a>';

function install(html) {
  if (html.includes('id="home-root"')) return { html, status: 'already installed' };

  const navOpen = html.match(/<nav class="app-navigation"[^>]*>/);
  const navBlock = html.match(/<nav class="app-navigation"[^>]*>[\s\S]*?<\/nav>/);
  const firstSection = html.match(/<section class="app-content"/);
  const topbar = html.match(/<header class="app-topbar">[\s\S]*?<\/header>/);
  const cssAnchor = html.match(/<link rel="stylesheet" href="\.\.\/css\/shell\.css">/);
  if (!navOpen || !navBlock || !firstSection || !topbar || !cssAnchor || !html.includes('</body>')) {
    return { html, status: 'SKIPPED: unexpected page structure' };
  }

  const eol = html.includes('\r\n') ? '\r\n' : '\n';
  const indent = '\t\t\t\t\t';
  const homeTopbar = topbar[0].replace(/id="([^"]+)"/g, (_m, id) => `id="${id}Home"`);
  const section = [
    '<!-- HOME -->',
    '\t\t<section class="app-content" id="home" style="display: none;">',
    `\t\t\t${homeTopbar}`,
    '\t\t\t<div class="practice-content-wrapper">',
    '\t\t\t\t<div id="home-root" class="hm" aria-live="polite"></div>',
    '\t\t\t</div>',
    '\t\t</section>',
    '',
    '\t\t'
  ].join(eol);

  // 1) Home first in the menu; the old default option stops being active.
  let out = html.replace(navBlock[0], (block) => {
    const cleaned = block
      .replace(/class="app-nav-link app-nav-link--active"/g, 'class="app-nav-link"')
      .replace(/ aria-current="page"/g, '');
    return cleaned.replace(navOpen[0], `${navOpen[0]}${eol}${indent}${NAV_LINK}`);
  });

  // 2) Home section first, so it is the first screen of the panel.
  out = out.replace('<section class="app-content"', section + '<section class="app-content"');

  // 3) Styles and script (the script must run after shell.js and the panel scripts).
  out = out.replace(cssAnchor[0], `${cssAnchor[0]}${eol}\t<link rel="stylesheet" href="../css/home.css">`);
  out = out.replace('</body>', `\t<script src="../js/pages/home.js"></script>${eol}</body>`);
  return { html: out, status: 'installed' };
}

for (const panel of PANELS) {
  const file = path.join(PAGES_DIR, `${panel}.html`);
  if (!fs.existsSync(file)) { console.log(`${panel}.html: not found, skipped`); continue; }
  const { html, status } = install(fs.readFileSync(file, 'utf8'));
  if (status === 'installed' && !checkOnly) {
    if (!fs.existsSync(`${file}.bak`)) fs.copyFileSync(file, `${file}.bak`);
    fs.writeFileSync(file, html);
  }
  console.log(`${panel}.html: ${checkOnly && status === 'installed' ? 'would be installed' : status}`);
}
