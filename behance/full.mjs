// Full-page screenshots for Behance: scrolls one viewport at a time (so every reveal
// animation and the "page comes alive" colour fire as for a real visitor) and stitches the frames.
// Usage: node full.mjs [url]   (default http://localhost:5601/index.html)
// Output: behance/full-desktop.png, behance/full-mobile.png
import { spawn } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = process.argv[2] || 'http://localhost:5601/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9334;
const OUT = dirname(fileURLToPath(import.meta.url));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'full-'))}`,
  'about:blank',
], { stdio: 'ignore' });

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try {
    const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    target = list.find((t) => t.type === 'page');
  } catch {}
}
if (!target) throw new Error('Chrome did not start');

const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (e) => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) => new Promise((resolve, reject) => {
  const n = ++id;
  pending.set(n, { resolve, reject });
  ws.send(JSON.stringify({ id: n, method, params }));
});
const evaluate = async (expr) =>
  (await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })).result.value;

async function fullPage(name, { width, height, scale, mobile }) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  await send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  await send('Emulation.setUserAgentOverride', {
    userAgent: mobile
      ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
      : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  });
  await send('Page.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: URL_ });
  await sleep(3500);

  // Header lives at the top of the page only, sticky column and gauge would repeat in every frame
  await evaluate(`(() => {
    const s = document.createElement('style');
    s.textContent = '.header{position:absolute!important}.depth{display:none!important}.geology__intro{position:static!important}html{scroll-behavior:auto!important}';
    document.head.appendChild(s);
  })()`);
  // Run every counter / reveal once, then force all reveal items visible: an item cut by
  // the bottom edge of a frame would otherwise still be hidden when that frame is taken
  await evaluate(`(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 3) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
    }
    document.querySelectorAll('.sr').forEach(el => el.classList.add('is-in', 'is-done'));
    scrollTo(0, 0);
  })()`);
  await sleep(2500);

  const frames = [];
  const total = await evaluate('document.documentElement.scrollHeight');
  for (let y = 0; ; y += height) {
    const actual = await evaluate(`(scrollTo(0, ${y}), scrollY)`);
    await sleep(1600);
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    frames.push({ y: actual, data });
    if (actual + height >= total) break;
  }

  // Stitch frames on a canvas inside the same browser
  const png = await evaluate(`(async () => {
    const frames = ${JSON.stringify(frames)};
    const c = document.createElement('canvas');
    c.width = ${width * scale};
    c.height = ${total * scale};
    const ctx = c.getContext('2d');
    for (const f of frames) {
      const img = new Image();
      img.src = 'data:image/png;base64,' + f.data;
      await img.decode();
      ctx.drawImage(img, 0, f.y * ${scale});
    }
    return c.toDataURL('image/png').split(',')[1];
  })()`);
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(png, 'base64'));
  console.log('saved', name, `${width * scale}x${total * scale}`, `${frames.length} frames`);
}

await fullPage('full-desktop', { width: 1440, height: 900, scale: 1, mobile: false });
await fullPage('full-mobile', { width: 390, height: 844, scale: 2, mobile: true });

ws.close();
chrome.kill();
