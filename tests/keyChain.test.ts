import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Runs the real handlers against an in-memory Supabase + Google stand-in
 * (global fetch), so the key order, daily skips and caps are checked without
 * any paid or external request.
 */
const SUPABASE = 'https://db.example.test';
const TEACHER_KEY = 'AIza' + 'T'.repeat(35);
const STUDIO_KEY = 'AIza' + 'S'.repeat(35);
Object.assign(process.env, {
  SUPABASE_URL: SUPABASE, SUPABASE_ANON_KEY: 'anon', SUPABASE_SERVICE_ROLE_KEY: 'service',
  GEMINI_API_KEY: STUDIO_KEY, ELEVENLABS_API_KEY: 'eleven-test', GEMINI_KEY_ENCRYPTION_SECRET: 'chain-test-secret-0123456789',
});

type Row = Record<string, any>;
interface World {
  role: string;
  activity: Row[];
  keys: Row[];
  google: Array<{ key: string; what: string }>;
  eleven: number;
  /** narrationSource.audioUrl as stored in the (teacher-editable) project JSON. */
  audioUrl?: unknown;
  downloads: string[];
  uploads: Array<{ path: string; type: string; bytes: number }>;
  /** Stored file contents by path (downloads of other paths return 64 zero bytes). */
  files: Record<string, Buffer>;
  /** project_asset_objects() rows and replace_project_audio() calls. */
  objects: Row[];
  replaced: Row[];
  removed: string[];
  /** Rows for the admin storage query (projects selected with asset field aliases). */
  assetRows?: Row[];
  /** Google answer per key and model ("transcribe" for Transcribe). */
  answer(key: string, model: string): { status: number; body?: any };
}

function install(world: World) {
  const json = (body: any, status = 200, headers: Record<string, string> = {}) =>
    new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } });
  globalThis.fetch = (async (input: any, init: any = {}) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    const method = (init.method || 'GET').toUpperCase();
    const headers = new Headers(init.headers);
    const single = (headers.get('accept') || '').includes('vnd.pgrst.object');
    const rows = (list: Row[]) => single ? (list[0] ? json(list[0]) : json({ message: 'none' }, 406)) : json(list);
    if (url.origin === SUPABASE) {
      const path = url.pathname;
      if (path === '/auth/v1/user') return json({ id: 't1', email: 't@x', email_confirmed_at: '2026-01-01T00:00:00Z', aud: 'authenticated' });
      if (path === '/rest/v1/profiles') return rows([{ role: world.role, status: 'approved' }]);
      if (path === '/rest/v1/projects' && (url.searchParams.get('select') || '').includes('nsAudio')) return rows(world.assetRows || []);
      if (path === '/rest/v1/projects') return rows([{ id: 'p1', owner_id: 't1', data: {
        solutionText: 'Doğru cevap C.', narrationSource: { type: 'gemini', mimeType: 'audio/wav', audioUrl: world.audioUrl ?? { assetPath: 't1/p1/a.wav' } } } }]);
      if (path === '/rest/v1/activity') {
        if (method === 'POST') { world.activity.push(...JSON.parse(init.body)); return json(null, 201); }
        return rows(world.activity);
      }
      if (path === '/rest/v1/teacher_gemini_keys') {
        if (method === 'POST') { const r = JSON.parse(init.body); world.keys = [r]; return json(null, 201); }
        if (method === 'PATCH') { Object.assign(world.keys[0] || {}, JSON.parse(init.body)); return new Response(null, { status: 204 }); }
        if (method === 'DELETE') { world.keys = []; return new Response(null, { status: 204 }); }
        return rows(world.keys);
      }
      if (path === '/rest/v1/rpc/project_asset_objects') return rows(world.objects);
      if (path === '/rest/v1/rpc/replace_project_audio') { const args = JSON.parse(init.body); world.replaced.push(args); return json(true); }
      if (path.startsWith('/storage/v1/object/sign/')) return json({ signedURL: '/object/sign/x?token=1' });
      if (path.startsWith('/storage/v1/object/')) {
        const name = decodeURIComponent(path.replace(/^\/storage\/v1\/object\/(authenticated\/)?project-assets\/?/, ''));
        if (method === 'GET') { world.downloads.push(name); return new Response(world.files[name] ?? new Uint8Array(64)); }
        if (method === 'DELETE') { const names: string[] = JSON.parse(init.body).prefixes; world.removed.push(...names); return json(names.map(n => ({ name: n }))); }
        const body = init.body instanceof Uint8Array || Buffer.isBuffer(init.body) ? init.body.length : (init.body?.size ?? 0);
        world.uploads.push({ path: name, type: headers.get('content-type') || (init.body?.type ?? ''), bytes: body });
        return json({ Key: 'x' });
      }
      throw new Error(`unexpected Supabase call ${method} ${path}`);
    }
    if (url.hostname === 'generativelanguage.googleapis.com') {
      const key = headers.get('x-goog-api-key') || '';
      if (url.pathname === '/v1beta/models') { world.google.push({ key, what: 'list' }); return key === TEACHER_KEY ? json({ models: [] }) : json({ error: { message: 'API key not valid' } }, 400); }
      if (url.pathname.startsWith('/upload/')) return json({}, 200, { 'x-goog-upload-url': 'https://generativelanguage.googleapis.com/upload-session' });
      if (url.pathname === '/upload-session') return json({ file: { uri: 'files/abc', name: 'files/abc', mimeType: 'audio/wav' } });
      if (method === 'DELETE') return json({});
      const model = url.pathname === '/v1beta/interactions' ? 'transcribe' : decodeURIComponent(url.pathname.split('/models/')[1].split(':')[0]);
      world.google.push({ key, what: model });
      const { status, body } = world.answer(key, model);
      if (status !== 200) return json(body || { error: { message: 'err' } }, status);
      if (model === 'transcribe') return json({ steps: [{ content: [{ annotations: [{ type: 'word_info', text: 'Doğru', start_offset: '0.1s', end_offset: '0.4s' }] }] }] });
      return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: 'audio/L16;rate=24000', data: Buffer.alloc(4800).toString('base64') } }] } }] });
    }
    if (url.hostname === 'evil.example.test') throw new Error('the server must never fetch a URL taken from project data');
    if (url.hostname === 'api.elevenlabs.io') { world.eleven++; return json({ words: [{ text: 'Doğru', start: 0.1, end: 0.4 }] }); }
    throw new Error(`unexpected call ${url}`);
  }) as typeof fetch;
}

const dailyQuota = { status: 429, body: { error: { message: 'Quota exceeded', details: [{ violations: [{ quotaId: 'GenerateRequestsPerDayPerProjectPerModel-FreeTier' }] }] } } };
const ok = { status: 200 };

async function call(handler: (req: any, res: any) => Promise<any>, method: string, body: any = {}) {
  let status = 0, payload: any;
  const res = { status(c: number) { status = c; return this; }, json(p: any) { payload = p; return this; }, setHeader() {} };
  await handler({ method, headers: { authorization: 'Bearer token' }, body }, res);
  return { status, payload };
}

async function freshWorld(over: Partial<World> = {}): Promise<World> {
  const { encryptKey } = await import('../server/quota');
  const world: World = { role: 'teacher', activity: [], google: [], eleven: 0, downloads: [], uploads: [], files: {}, objects: [], replaced: [], removed: [],
    keys: [{ owner_id: 't1', ciphertext: encryptKey(TEACHER_KEY), last4: 'TTTT', status: 'active', updated_at: '2026-09-27T10:00:00Z' }],
    answer: () => ok, ...over };
  install(world);
  return world;
}
const today = (row: Row) => ({ created_at: new Date().toISOString(), ...row });

test('narration uses the teacher key first and skips its exhausted models afterwards', async () => {
  const { default: generate } = await import('../api/gemini/generate');
  const world = await freshWorld({ answer: key => key === TEACHER_KEY ? dailyQuota : ok });
  const first = await call(generate, 'POST', { projectId: 'p1', text: 'Doğru cevap C.' });
  assert.equal(first.status, 200);
  assert.equal(first.payload.keySource, 'system');
  const { GEMINI_TTS_MODELS } = await import('../server/quota');
  assert.deepEqual(world.google.map(g => g.key === TEACHER_KEY ? 'teacher' : 'studio'), [...GEMINI_TTS_MODELS.map(() => 'teacher'), 'studio']);
  assert.deepEqual(world.google.slice(0, GEMINI_TTS_MODELS.length).map(g => g.what), [...GEMINI_TTS_MODELS], 'strict quality order');
  assert.equal(world.activity.filter(a => a.key_source === 'teacher' && / · 429 · daily$/.test(a.detail)).length, GEMINI_TTS_MODELS.length);
  assert.equal(world.activity.filter(a => a.key_source === 'system' && a.state === 'succeeded').length, 1);

  // Same day: the teacher's exhausted models are not called again.
  world.google = [];
  world.activity = world.activity.map(today);
  const second = await call(generate, 'POST', { projectId: 'p1', text: 'Doğru cevap C.' });
  assert.equal(second.payload.keySource, 'system');
  assert.deepEqual(world.google.map(g => g.key), [STUDIO_KEY]);
  assert.ok(!JSON.stringify(second.payload).includes(TEACHER_KEY) && !JSON.stringify(second.payload).includes(STUDIO_KEY));
});

test('a working teacher key serves the narration itself', async () => {
  const { default: generate } = await import('../api/gemini/generate');
  const world = await freshWorld();
  const r = await call(generate, 'POST', { projectId: 'p1', text: 'Doğru cevap C.' });
  assert.equal(r.payload.keySource, 'teacher');
  assert.deepEqual(world.google.map(g => g.key), [TEACHER_KEY]);
});

test('a rejected teacher key is marked invalid and the studio key takes over', async () => {
  const { default: generate } = await import('../api/gemini/generate');
  const world = await freshWorld({ answer: key => key === TEACHER_KEY ? { status: 400, body: { error: { message: 'API key not valid. Please pass a valid API key.', details: [{ reason: 'API_KEY_INVALID' }] } } } : ok });
  const r = await call(generate, 'POST', { projectId: 'p1', text: 'Doğru cevap C.' });
  assert.equal(r.payload.keySource, 'system');
  assert.equal(world.google.filter(g => g.key === TEACHER_KEY).length, 1, 'no further models are tried with a bad key');
  assert.equal(world.keys[0].status, 'invalid');
});

test('timestamps: teacher Transcribe → studio Transcribe → per-teacher cap', async () => {
  const { default: align } = await import('../api/gemini/align-project');
  const world = await freshWorld({ answer: key => key === TEACHER_KEY ? dailyQuota : ok });
  const r = await call(align, 'POST', { projectId: 'p1' });
  assert.equal(r.status, 200);
  assert.equal(r.payload.keySource, 'system');
  assert.deepEqual(world.activity.map(a => [a.key_source, a.detail]), [
    ['teacher', 'gemini-3.5-transcribe · 429 · daily'], ['system', 'gemini-3.5-transcribe · 200']]);

  // Teacher's own Transcribe is skipped for the rest of the day; 24 more studio requests fill the cap of 25.
  world.activity = world.activity.map(today);
  for (let i = 0; i < 24; i++) world.activity.push(today({ owner_id: 't1', kind: 'gemini_transcribe', state: 'succeeded', detail: 'gemini-3.5-transcribe · 200', key_source: 'system' }));
  world.google = [];
  const capped = await call(align, 'POST', { projectId: 'p1' });
  assert.equal(capped.status, 429);
  assert.equal(capped.payload.code, 'TRANSCRIBE_LIMIT');
  assert.equal(world.google.length, 0, 'no Google request once both lanes are used up');

  // Admins are not capped by the per-teacher limit.
  world.role = 'admin';
  const admin = await call(align, 'POST', { projectId: 'p1' });
  assert.equal(admin.status, 200);
  assert.deepEqual(world.google.map(g => g.key), [STUDIO_KEY]);
});

test('ElevenLabs Forced Alignment stops at the per-teacher daily cap', async () => {
  const { default: alignProject } = await import('../api/elevenlabs/align-project');
  const world = await freshWorld();
  for (let i = 0; i < 19; i++) world.activity.push(today({ owner_id: 't1', kind: 'elevenlabs_align', state: 'succeeded', detail: 'forced-alignment · 200' }));
  assert.equal((await call(alignProject, 'POST', { projectId: 'p1' })).status, 200);
  world.activity = world.activity.map(today);
  const capped = await call(alignProject, 'POST', { projectId: 'p1' });
  assert.equal(capped.status, 429);
  assert.equal(capped.payload.code, 'DAILY_LIMIT');
  assert.equal(world.eleven, 1);
});

test('saving a key verifies it with Google, stores it encrypted and never returns it', async () => {
  const { default: key } = await import('../api/gemini/key');
  const world = await freshWorld({ keys: [] });
  const bad = await call(key, 'POST', { apiKey: 'not-a-key' });
  assert.equal(bad.payload.code, 'INVALID_KEY_FORMAT');
  assert.equal(world.google.length, 0);
  const rejected = await call(key, 'POST', { apiKey: STUDIO_KEY.replace('S', 'X') });
  assert.equal(rejected.payload.code, 'KEY_REJECTED');
  const saved = await call(key, 'POST', { apiKey: ` "${TEACHER_KEY}" ` });
  assert.equal(saved.status, 200);
  assert.equal(world.keys[0].last4, 'TTTT');
  assert.ok(!world.keys[0].ciphertext.includes(TEACHER_KEY));
  assert.ok(!JSON.stringify(saved.payload).includes(TEACHER_KEY));
  assert.deepEqual(saved.payload.today.shared, { used: 0, limit: 25, exhausted: false });
  const removed = await call(key, 'DELETE');
  assert.equal(removed.payload.key, null);
});

test('alignment only reads audio from the teacher’s own storage folder', async () => {
  const { default: gemini } = await import('../api/gemini/align-project');
  const { default: eleven } = await import('../api/elevenlabs/align-project');
  for (const audioUrl of [
    { assetPath: 'someone-else/p9/secret.wav' },
    { assetPath: 't1/../someone-else/secret.wav' },
    { assetPath: 't1' },
    'https://evil.example.test/a.wav',
    `${SUPABASE.replace('https://', 'http://')}/storage/v1/object/sign/project-assets/t1/p1/a.wav?token=x`,
    `${SUPABASE}/storage/v1/object/sign/project-assets/someone-else/p1/a.wav?token=x`,
  ]) {
    for (const handler of [gemini, eleven]) {
      const world = await freshWorld({ audioUrl });
      const r = await call(handler, 'POST', { projectId: 'p1' });
      assert.equal(r.status, 400, JSON.stringify(audioUrl));
      assert.deepEqual(world.downloads, []);
      assert.equal(world.google.length + world.eleven, 0);
    }
  }
  // A signed link to the teacher's own file (older projects) still works.
  const world = await freshWorld({ audioUrl: `${SUPABASE}/storage/v1/object/sign/project-assets/t1/p1/a.wav?token=x` });
  assert.equal((await call(gemini, 'POST', { projectId: 'p1' })).status, 200);
  assert.deepEqual(world.downloads, ['t1/p1/a.wav']);
});

function wavFile(seconds: number, rate = 24000): Buffer {
  const samples = Buffer.alloc(Math.round(seconds * rate) * 2);
  for (let i = Math.round(0.2 * rate); i < samples.length / 2; i++) samples.writeInt16LE(Math.round(8000 * Math.sin(i / 6)), i * 2);
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + samples.length, 4); h.write('WAVE', 8); h.write('fmt ', 12); h.writeUInt32LE(16, 16);
  h.writeUInt16LE(1, 20); h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28); h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(samples.length, 40);
  return Buffer.concat([h, samples]);
}

test('new narrations are stored as MP3', async () => {
  const { default: generate } = await import('../api/gemini/generate');
  const world = await freshWorld();
  const r = await call(generate, 'POST', { projectId: 'p1', text: 'Doğru cevap C.' });
  assert.equal(r.status, 200);
  assert.equal(r.payload.mimeType, 'audio/mpeg');
  assert.equal(world.uploads.length, 1);
  assert.match(world.uploads[0].path, /^t1\/p1\/gemini-[0-9a-f]{20}\.mp3$/);
  assert.equal(r.payload.assetPath, world.uploads[0].path);
});

test('admin storage: convert WAV narrations to MP3, then remove the unused WAV files', async () => {
  const { default: storage } = await import('../api/admin/storage');
  const old = new Date(Date.now() - 86400_000).toISOString();
  const world = await freshWorld({ role: 'admin',
    files: { 't1/p1/a.wav': wavFile(3) },
    objects: [{ name: 't1/p1/a.wav', bytes: 144_044, mimetype: 'audio/wav', created_at: old }, { name: 't1/p1/img', bytes: 90_000, mimetype: 'image/png', created_at: old }],
    assetRows: [{ id: 'p1', owner_id: 't1', image: { assetPath: 't1/p1/img' }, nsAudio: { assetPath: 't1/p1/a.wav' }, anAudio: { assetPath: 't1/p1/a.wav' } }] });

  const before = await call(storage, 'GET');
  assert.equal(before.payload.convertible, 1);
  assert.deepEqual(before.payload.byKind.wav, { count: 1, bytes: 144_044 });

  const converted = await call(storage, 'POST', { action: 'convert' });
  assert.deepEqual(converted.payload, { converted: 1, failures: [], remaining: 0 });
  assert.deepEqual(world.uploads.map(u => u.path), ['t1/p1/a.mp3']);
  assert.deepEqual(world.replaced, [{ target_project: 'p1', old_path: 't1/p1/a.wav', new_path: 't1/p1/a.mp3', new_mime: 'audio/mpeg' }]);
  assert.ok(world.uploads[0].bytes > 0 && world.uploads[0].bytes < 144_044 / 4, `mp3 ${world.uploads[0].bytes} bytes`);

  // Before the project points at the MP3 nothing is removed; afterwards only the WAV goes.
  world.objects.push({ name: 't1/p1/a.mp3', bytes: world.uploads[0].bytes, mimetype: 'audio/mpeg', created_at: new Date().toISOString() });
  assert.equal((await call(storage, 'POST', { action: 'sweep', scope: 'wav' })).payload.removed, 0);
  world.assetRows = [{ id: 'p1', owner_id: 't1', image: { assetPath: 't1/p1/img' }, nsAudio: { assetPath: 't1/p1/a.mp3' }, anAudio: { assetPath: 't1/p1/a.mp3' } }];
  const swept = await call(storage, 'POST', { action: 'sweep', scope: 'wav' });
  assert.deepEqual(world.removed, ['t1/p1/a.wav']);
  assert.equal(swept.payload.bytes, 144_044);

  world.role = 'teacher';
  assert.equal((await call(storage, 'GET')).status, 403);
});
