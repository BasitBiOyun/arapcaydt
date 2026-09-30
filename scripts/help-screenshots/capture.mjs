/**
 * Retakes the pictures of the Yardım page (public/help/*.webp) from the real studio with sample data.
 * Nothing is sent anywhere: sign-in and database are replaced (see vite.config.ts), /api calls are answered here.
 *
 *   npm run help:screenshots
 *
 * Needs Playwright with Chromium. If it is not installed in this project, point PLAYWRIGHT_MODULE at an
 * installed copy (e.g. /opt/node22/lib/node_modules/playwright/index.mjs) and CHROMIUM_PATH at the browser.
 * The AI Studio pictures (aistudio-*.webp) are not retaken: they come from real Google screens.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../..');
const out = path.join(root, 'public/help');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

/** A speech-like narration (silence and syllables) so the waveform looks real. */
function wav(seconds) {
  const rate = 16000, n = Math.round(seconds * rate), buf = Buffer.alloc(44 + n * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 2, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 2, 40);
  let seed = 7;
  const noise = () => ((seed = (seed * 16807) % 2147483647) / 2147483647) * 2 - 1;
  for (let i = 0; i < n; i++) {
    const t = i / rate, syllable = Math.max(0, Math.sin(t * 2 * Math.PI * 2.3)) * (0.55 + 0.45 * Math.sin(t * 0.9)), pause = t % 7 > 6.2 ? 0.05 : 1;
    buf.writeInt16LE(Math.round(noise() * 9000 * syllable * pause), 44 + i * 2);
  }
  return buf;
}

const server = await createServer({ configFile: path.join(here, 'vite.config.ts'), logLevel: 'warn' });
await server.listen();
const base = 'http://localhost:5299/';
const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'tr-TR' });
// The first-run tour stays closed; its pictures are these screenshots.
await context.addInitScript(() => { try { localStorage.setItem('studio-guide-seen:teacher-1', 'yes'); } catch {} });
const audio = wav(52.4), image = fs.readFileSync(path.join(root, 'public/landing/soru3.webp'));
await context.route('**/api/**', route => route.fulfill({ json: {} }));
await context.route('**/api/elevenlabs/status', route => route.fulfill({ json: { configured: true, mode: 'live', message: 'Hazır', voiceReady: true, gemini: { configured: true } } }));
await context.route('**/api/gemini/key', route => route.fulfill({ json: { storageReady: true, key: null, today: { tracking: true, tts: { used: 0, exhaustedModels: 0, models: 3 }, transcribe: { used: 0, exhausted: false }, shared: { used: 3, limit: 25, exhausted: false, ttsUsedAll: 14, ttsLimit: 300 }, elevenlabs: { used: 0, limit: 20 } } } }));
await context.route('**/__help-fixtures/**', route => {
  const voice = route.request().url().endsWith('.wav');
  return route.fulfill({ body: voice ? audio : image, contentType: voice ? 'audio/wav' : 'image/webp' });
});
const page = await context.newPage();
const converter = await context.newPage();
page.on('pageerror', e => { if (!/tesseract|importScripts/.test(e.message)) console.warn('  sayfa hatası:', e.message); });

// A fresh load for every picture (a new query string), so nothing left open by the previous one shows.
let loads = 0;
const go = async (hash, wait = 1800) => { await page.goto(`${base}?sahne=${++loads}${hash}`); await page.waitForTimeout(wait); };
const step = async n => { await page.locator('.workflow-nav button').nth(n - 1).click(); await page.waitForTimeout(1300); };

/** Red frames (and numbers) drawn over parts of the screen for one picture. */
async function mark(targets) {
  const rects = [];
  for (const [i, target] of targets.entries()) {
    const box = await (typeof target === 'string' ? page.locator(target).first() : target).boundingBox().catch(() => null);
    if (box) rects.push({ ...box, n: targets.length > 1 ? i + 1 : 0 });
    else console.warn('  işaretlenecek yer bulunamadı:', String(target));
  }
  await page.evaluate(rects => {
    for (const r of rects) {
      const frame = document.createElement('div');
      frame.className = 'help-shot-mark';
      Object.assign(frame.style, { position: 'fixed', left: `${r.x - 6}px`, top: `${r.y - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px`,
        border: '4px solid #E11D48', borderRadius: '12px', boxShadow: '0 0 0 5px rgba(225,29,72,.18)', zIndex: 2147483647, pointerEvents: 'none' });
      if (r.n) {
        const badge = document.createElement('span');
        badge.textContent = String(r.n);
        Object.assign(badge.style, { position: 'absolute', left: '-18px', top: '-18px', width: '30px', height: '30px', borderRadius: '50%', background: '#E11D48', color: 'white',
          font: '700 16px/30px system-ui, sans-serif', textAlign: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.3)' });
        frame.appendChild(badge);
      }
      document.body.appendChild(frame);
    }
  }, rects);
}

async function save(name, clipTarget) {
  let clip;
  if (clipTarget) {
    const box = await (typeof clipTarget === 'string' ? page.locator(clipTarget).first() : clipTarget).boundingBox();
    const pad = 16;
    clip = { x: Math.max(0, box.x - pad), y: Math.max(0, box.y - pad), width: box.width + pad * 2, height: box.height + pad * 2 };
  }
  const png = await page.screenshot(clip ? { clip } : {});
  await page.evaluate(() => document.querySelectorAll('.help-shot-mark').forEach(el => el.remove()));
  const webp = await converter.evaluate(async data => {
    const img = new Image(); img.src = data; await img.decode();
    const canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height;
    canvas.getContext('2d').drawImage(img, 0, 0);
    return canvas.toDataURL('image/webp', 0.82);
  }, `data:image/png;base64,${png.toString('base64')}`);
  const bytes = Buffer.from(webp.split(',')[1], 'base64');
  fs.writeFileSync(path.join(out, `${name}.webp`), bytes);
  console.log(`  ${name}.webp  ${Math.round(bytes.length / 1024)} KB`);
}

const card = heading => page.getByText(heading, { exact: true }).first().locator('xpath=ancestor::*[self::section or self::form][1]');
const scenes = {
  async panel() {
    await go('#/');
    await mark(['aside button:has-text("Yeni soru")', 'nav button:has-text("Sorularım")', 'nav button:has-text("Toplu Üretim")', 'nav button:has-text("Ayarlar")', 'nav button:has-text("Yardım ve rehber")']);
  },
  async 'yeni-soru'() { await go('#/'); await mark(['aside >> button:has-text("Yeni soru")']); },
  async 'soru-tipi'() {
    await go('#/');
    await page.locator('aside >> button:has-text("Yeni soru")').click(); await page.waitForTimeout(700);
    const dialog = page.getByText('Yeni Soru Projesi', { exact: true }).locator('xpath=ancestor::div[contains(@class,"rounded")][1]'); await dialog.getByText('Deneme', { exact: true }).first().click(); await page.waitForTimeout(300);
    await mark([dialog.getByText('Deneme', { exact: true }).first().locator('xpath=ancestor::button[1]'), 'button:has-text("Projeyi Başlat")']);
  },
  async adimlar() { await go('#/soru/ornek-3', 2500); await step(1); await mark(['.workflow-nav']); },
  async 'gorsel-yukle'() { await go('#/soru/ornek-7', 2500); await mark([page.getByText('Soru görselini sürükleyin veya tıklayın').locator('xpath=ancestor::*[self::label or self::div][2]')]); },
  async 'cozum-metni'() {
    await go('#/soru/ornek-4', 2500); await step(2);
    await mark(['.editor-panel select:visible', '.editor-panel textarea']);
  },
  async 'ses-olustur'() { await go('#/soru/ornek-8', 2500); await step(3); await mark(['button:has-text("Seslendirme Oluştur")', 'label:has-text("MP3 Yükle")']); },
  async 'ses-onay'() { await go('#/soru/ornek-5', 2500); await step(3); await mark([page.getByText('Eğitmen Sesi').first().locator('xpath=ancestor::div[2]'), 'button:has-text("Bu Sesi Kullan")']); },
  async 'sesi-duzelt'() {
    await go('#/soru/ornek-4', 2500); await step(3);
    await page.getByText('Sesi düzelt').first().click(); await page.waitForTimeout(300);
    await page.locator('.revoice-sentences button').nth(3).click(); await page.waitForTimeout(300);
    const panel = page.locator('.revoice-sentences').locator('xpath=..');
    await panel.evaluate(el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(300);
    await mark([page.locator('.revoice-sentences button').nth(3), page.getByRole('button', { name: 'Seçili yeri yeniden seslendir' })]);
    return panel;
  },
  async isaretler() {
    await go('#/soru/ornek-3', 3000); await step(4);
    await mark(['[role=toolbar][aria-label="İşaret araçları"]', '.editor-panel >> text=İşaretleri tek tek kontrol et']);
  },
  async 'isaret-secili'() {
    await go('#/soru/ornek-3', 3000); await step(4);
    await page.locator('[aria-label="A şıkkı kutusu"]').first().click();
    await page.waitForTimeout(700);
    await mark([page.locator('.moveable-control-box').first(), '[role=toolbar][aria-label="İşaret araçları"]']);
  },
  async 'zaman-seridi'() {
    await go('#/soru/ornek-3', 3000); await step(4);
    await mark([page.getByText('Zaman şeridi', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]')]);
  },
  async 'kutu-duzenle'() {
    await go('#/soru/ornek-3', 3000); await step(4);
    await page.getByRole('button', { name: 'Görseldeki kutuları düzenle' }).click(); await page.waitForTimeout(900);
    const stage = page.getByRole('group', { name: 'Bölge çizim alanı' });
    await stage.scrollIntoViewIfNeeded();
    await page.locator('[title="Seçmek için tıklayın"]').filter({ hasText: 'D Seçeneği' }).first().click(); await page.waitForTimeout(600);
    await stage.evaluate(el => el.scrollIntoView({ block: 'center' })); await page.waitForTimeout(400);
    await mark([page.locator('[title^="Taşımak için"]').first()]);
  },
  async 'video-indir'() { await go('#/soru/ornek-3', 3000); await step(5); await mark(['button:has-text("MP4 İndir")', page.getByText('Yayına hazır').first().locator('xpath=..')]); },
  async 'soru-listesi'() { await go('#/sorular'); await mark(['.library-search', '.filter-row', page.getByRole('button', { name: /Devam et/ }).first()]); },
  async 'toplu-secim'() {
    await go('#/sorular');
    await page.locator('.question-check input').nth(0).check(); await page.locator('.question-check input').nth(1).check(); await page.waitForTimeout(300);
    await page.locator('.bulk-bar').scrollIntoViewIfNeeded();
    await mark(['.question-check', '.bulk-bar']);
  },
  async koleksiyon() {
    await go('#/sorular');
    await page.locator('.question-check input').nth(0).check(); await page.locator('.question-check input').nth(1).check();
    await page.getByRole('button', { name: /Koleksiyona taşı/ }).click(); await page.waitForTimeout(500);
    await mark(['[role=dialog] form']);
  },
  async 'cop-kutusu'() { await go('#/sorular'); await page.getByRole('tab', { name: /Çöp kutusu/ }).click(); await page.waitForTimeout(500); await mark(['[role=tab]:has-text("Çöp kutusu")', 'button:has-text("Geri al")']); },
  async yedekleme() { await go('#/ayarlar'); const c = card('Yedekleme'); await c.scrollIntoViewIfNeeded(); await mark(['button:has-text("Tüm sorularımı yedekle")', 'button:has-text("Yedekten geri yükle")']); return c; },
  async 'toplu-uretim'() { await go('#/toplu'); },
  async 'anahtar-kaydet'() {
    await go('#/ayarlar');
    const c = page.getByText('Google anahtarım', { exact: true }).first().locator('xpath=ancestor::div[contains(@class,"rounded")][1]');
    await c.scrollIntoViewIfNeeded();
    await mark(['#teacher-google-key', c.getByRole('button', { name: /Kaydet/ })]);
    return c;
  },
  async 'yazi-boyutu'() { await go('#/ayarlar'); const c = card('Yazı boyutu'); await c.scrollIntoViewIfNeeded(); await mark(['[role=radiogroup][aria-label="Yazı boyutu"]']); return c; },
  async varsayilanlar() { await go('#/ayarlar'); const c = card('Yeni soru varsayılanları'); await c.scrollIntoViewIfNeeded(); return c; },
  async 'sorun-bildir'() { await go('#/'); await page.locator('nav button:has-text("Sorun bildir")').click(); await page.waitForTimeout(600); await mark(['form[role=dialog]']); },
  async yardim() { await go('#/yardim/google-anahtari', 2500); await mark(['nav button:has-text("Yardım ve rehber")', '.help-menu ul']); },
};

const only = process.argv.slice(2);
fs.mkdirSync(out, { recursive: true });
console.log('Yardım görselleri çekiliyor…');
for (const [name, scene] of Object.entries(scenes)) {
  if (only.length && !only.includes(name)) continue;
  try {
    const clip = await scene();
    await save(name, clip);
  } catch (e) {
    console.error(`  ${name}: ${e.message.split('\n').slice(0, 6).join(' / ')}`);
    process.exitCode = 1;
    if (process.env.HELP_DEBUG) await page.screenshot({ path: path.join(process.env.HELP_DEBUG, `${name}-hata.png`) });
  }
}
await browser.close();
await server.close();
