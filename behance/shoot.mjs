// Screenshots of the site for Behance via Chrome DevTools Protocol (no dependencies).
// Usage: node shoot.mjs [url]   (default http://localhost:5601/index.html)
// Output: behance/shots/desktop-*.png and behance/shots/mobile-*.png
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_ = process.argv[2] || 'http://localhost:5601/index.html';
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 9333;
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'shots');
mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const chrome = spawn(CHROME, [
  '--headless=new', '--disable-gpu', '--hide-scrollbars', '--mute-audio',
  '--autoplay-policy=no-user-gesture-required',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${mkdtempSync(join(tmpdir(), 'shoot-'))}`,
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

async function load({ width, height, scale, mobile }) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  await send('Emulation.setTouchEmulationEnabled', mobile ? { enabled: true, maxTouchPoints: 5 } : { enabled: false });
  if (mobile) {
    await send('Emulation.setUserAgentOverride', {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    });
  }
  await send('Page.enable');
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Page.navigate', { url: URL_ });
  await sleep(3500);
  // Scroll the whole page once, slowly, so every reveal / counter animation fires
  await evaluate(`(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += innerHeight / 3) {
      scrollTo(0, y); await new Promise(r => setTimeout(r, 120));
    }
    scrollTo(0, 0);
  })()`);
  await sleep(2500);
}

async function shoot(name, selector, { hideChrome = true, offset = 0 } = {}) {
  await evaluate(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const el = document.querySelector(${JSON.stringify(selector)});
    scrollTo(0, el.getBoundingClientRect().top + scrollY + ${offset});
  })()`);
  await sleep(1800);
  await evaluate(`document.querySelectorAll('.header, .depth').forEach(e => e.style.visibility = ${hideChrome} ? 'hidden' : '')`);
  const { data } = await send('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(OUT, `${name}.png`), Buffer.from(data, 'base64'));
  await evaluate(`document.querySelectorAll('.header, .depth').forEach(e => e.style.visibility = '')`);
  console.log('saved', name);
}

// Desktop: 1920×1080, one viewport per section
await load({ width: 1920, height: 1080, scale: 1, mobile: false });
await shoot('desktop-01-hero', '#top', { hideChrome: false });
await shoot('desktop-02-numbers', '#numbers', { hideChrome: false, offset: -160 });
await shoot('desktop-03-course', '#course', { hideChrome: false });
await shoot('desktop-04-practices', '#guides', { hideChrome: false });
await shoot('desktop-05-stages', '#geology', { hideChrome: false });
await shoot('desktop-06-groups', '#tour', { hideChrome: false });
await shoot('desktop-07-pricing', '#plans', { hideChrome: false });
await shoot('desktop-08-faq', '#faq', { hideChrome: false });
await shoot('desktop-09-footer', 'footer', { hideChrome: false });

// Mobile: iPhone 14 size, 3x for crisp mockups
await load({ width: 390, height: 844, scale: 3, mobile: true });
await shoot('mobile-01-hero', '#top', { hideChrome: false });
await shoot('mobile-02-course', '#course', { hideChrome: false });
await shoot('mobile-03-stages', '#geology', { hideChrome: false });
await shoot('mobile-04-groups', '#tour', { hideChrome: false });
await shoot('mobile-05-pricing', '#plans', { hideChrome: false });
await shoot('mobile-06-footer', 'footer', { hideChrome: false });

ws.close();
chrome.kill();
