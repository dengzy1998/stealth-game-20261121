// Screenshot harness for SHADOWLINE.
//
// This Chromium build blocks Puppeteer-driven navigations to localhost
// (ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS), so instead of an HTTP
// server the game files are fulfilled from disk through CDP Fetch
// interception under a synthetic https origin. The page that runs is
// byte-for-byte the repo's game/ tree, rendered and staged for real via
// ?shot= scenes (see game/src/shots.js).
//
// Usage: node shoot.mjs [out-dir] [game-dir]  (defaults: ./screenshots ./game)
// Writes 1-heist.jpg (cover), 2-title.jpg, 3-upgrade.jpg, 4-win.jpg and
// a report.json with console errors, page errors and failed requests.
import puppeteer from 'puppeteer-core';
import { mkdirSync, readFileSync, existsSync, writeFileSync, statSync } from 'node:fs';
import { join, normalize, resolve, sep } from 'node:path';

const GAME_DIR = resolve(process.argv[3] || './game');
const OUT = resolve(process.argv[2] || './screenshots');
const ORIGIN = 'https://shadowline.local';
mkdirSync(OUT, { recursive: true });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
};
const SHOTS = [
  { name: '1-heist.jpg', query: '?shot=play&seed=1' },
  { name: '2-title.jpg', query: '?shot=title&seed=1' },
  { name: '3-upgrade.jpg', query: '?shot=upgrade&seed=1' },
  { name: '4-win.jpg', query: '?shot=win&seed=1' },
];
const report = { consoleErrors: [], pageErrors: [], failedRequests: [], missingFiles: [], shots: [] };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: '/opt/meta-chromium/chrome',
  args: [
    '--no-sandbox', '--autoplay-policy=no-user-gesture-required', '--mute-audio', '--window-size=1280,720',
    '--hatch-webgl-allowed-domains-file=/var/lib/hatch-browser/rootfs-base/usr/share/hatch/chromium/webgl-allowed-domains.txt',
    '--hatch-webgl-allowed-domains-sha256=8097045f0459c96c4cdc76e3a1af4e0f43f640b4b59c43d6db35e3641c0264c6',
  ],
});
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 720 });
page.on('console', (msg) => { if (msg.type() === 'error') report.consoleErrors.push(msg.text()); });
page.on('pageerror', (err) => report.pageErrors.push(String(err)));
page.on('requestfailed', (req) => report.failedRequests.push(`${req.url()} :: ${req.failure()?.errorText}`));
page.on('response', (res) => { if (res.status() >= 400 && !res.url().includes('favicon')) report.failedRequests.push(`${res.url()} :: HTTP ${res.status()}`); });

// --- Serve game/ from disk via Fetch interception -------------------------------
const cdp = await page.createCDPSession();
await cdp.send('Fetch.enable', { patterns: [{ urlPattern: `${ORIGIN}/*`, requestStage: 'Request' }] });
cdp.on('Fetch.requestPaused', async (event) => {
  const { requestId, request } = event;
  try {
    const url = new URL(request.url);
    let pathname = decodeURIComponent(url.pathname);
    if (pathname.endsWith('/')) pathname += 'index.html';
    const file = resolve(join(GAME_DIR, normalize(pathname)));
    if (file !== GAME_DIR && !file.startsWith(GAME_DIR + sep)) throw new Error('outside game/');
    if (!existsSync(file)) {
      report.missingFiles.push(request.url);
      await cdp.send('Fetch.fulfillRequest', { requestId, responseCode: 404, responseHeaders: [], body: '' });
      return;
    }
    const body = readFileSync(file);
    const ext = pathname.slice(pathname.lastIndexOf('.'));
    await cdp.send('Fetch.fulfillRequest', {
      requestId,
      responseCode: 200,
      responseHeaders: [{ name: 'Content-Type', value: MIME[ext] || 'application/octet-stream' }],
      body: body.toString('base64'),
    });
  } catch (err) {
    report.failedRequests.push(`${request.url} :: fulfill error ${err.message}`);
    try { await cdp.send('Fetch.failRequest', { requestId, errorReason: 'Failed' }); } catch {}
  }
});

for (const shot of SHOTS) {
  await page.goto(`${ORIGIN}/${shot.query}`, { waitUntil: 'load' });
  try {
    await page.waitForFunction('window.__shotReady === true', { timeout: 15000 });
  } catch {
    report.shots.push({ name: shot.name, ready: false });
    console.log(`SHOT NOT READY: ${shot.name}`);
    continue;
  }
  await sleep(300);
  const path = join(OUT, shot.name);
  await page.screenshot({ path, type: 'jpeg', quality: 82 });
  const bytes = statSync(path).size;
  report.shots.push({ name: shot.name, ready: true, bytes });
  console.log(`${shot.name}: ${bytes} bytes`);
}

writeFileSync(join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();
