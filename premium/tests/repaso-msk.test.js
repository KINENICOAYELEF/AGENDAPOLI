const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const bank = require('../src/lib/repaso-msk/knee-bank.json');
const hipBank = require('../src/lib/repaso-msk/hip-bank.json');
function load(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText,
    { module, exports: module.exports, require: id => dependencies[id], Set, Error, Math, Number });
  return module.exports;
}
const types = load('src/lib/repaso-msk/types.ts');
const { advanceAttempt } = load('src/lib/repaso-msk/engine.ts', { './types': types });
const jsonBanks = Object.fromEntries(['knee-bank', 'hip-bank', 'knee-additional', 'hip-additional', 'shoulder-bank', 'revisions'].map(name => [`./${name}.json`, require(`../src/lib/repaso-msk/${name}.json`)]));
const { attemptView, bankQuestions } = load('src/lib/repaso-msk/server.ts', { ...jsonBanks, '@/lib/server/firebaseAdmin': {} });
const selection = load('src/lib/repaso-msk/selection.ts', { './types': types });
const catalog = load('src/lib/repaso-msk/catalog.ts');
const bankState = load('src/lib/repaso-msk/bank-state.ts');
test('dos tests de 35 no comparten familias; sólo el tercero requiere repetición explícita', () => {
  for (const version of ['knee-v1', 'hip-v1', 'shoulder-v1']) {
    const questions = bankQuestions(version);
    for (let seed = 1; seed <= 20; seed++) {
      let n = seed; const random = max => { n = (n * 1664525 + 1013904223) >>> 0; return n % max; };
      const first = selection.selectQuestions(questions, [], false, random);
      const used = first.questions.map(selection.family);
      const second = selection.selectQuestions(questions, used, false, random);
      assert.equal(first.questions.length, 35); assert.equal(second.questions.length, 35);
      assert.equal(new Set([...used, ...second.questions.map(selection.family)]).size, 70);
      assert.equal(first.repeated, false); assert.equal(second.repeated, false);
      assert.ok(new Set(first.questions.map(q => q.condition)).size >= 7);
      const all = questions.map(selection.family);
      assert.throws(() => selection.selectQuestions(questions, all, false, random), /BANK_USED/);
      assert.equal(selection.selectQuestions(questions, all, true, random).repeatedCount, 35);
      const mixed = selection.selectQuestions(questions, all.slice(0, 60), true, random);
      assert.equal(mixed.repeatedCount, 25);
      assert.ok(all.slice(60).every(id => mixed.questions.some(q => selection.family(q) === id)));
    }
  }
});
test('revisiones mantienen historial original y no se presentan como nuevas familias', () => {
  const original = hipBank.find(q => q.id === 'hip-v1-12');
  const active = bankQuestions('hip-v1').find(q => q.familyId === original.id);
  assert.ok(active); assert.notEqual(active.stem, original.stem);
  const oldView = attemptView({ questionIds: [original.id], status: 'completed', answers: [] });
  assert.equal(oldView.review[0].stem, original.stem);
  const legacySeen = bankState.seenFamilies({ banks: { 'hip-v1': { used: true } } }, 'hip-v1');
  const fresh = selection.selectQuestions(bankQuestions('hip-v1'), legacySeen, false, () => 0);
  assert.equal(fresh.questions.length, 35);
  assert.ok(fresh.questions.every(q => !legacySeen.includes(selection.family(q))));
  assert.ok(fresh.questions.every(q => Number(q.id.slice(-2)) >= 36));
});
const make = () => ({ id: 'test', version: 'knee-v1', questionIds: bank.map(q => q.id), answers: [], revision: 0,
  status: 'active', remainingMs: 60000, selected: null, createdAt: '2026-09-14', updatedAt: '2026-09-14', repeated: false });
const answer = (a, values = {}) => ({ type: 'answer', revision: a.revision, index: a.answers.length,
  option: bank[a.answers.length].correct, reason: 'answer', elapsedMs: 14000, ...values });

test('banco íntegro: 35 preguntas originales identificables, claves y feedback', () => {
  assert.equal(bank.length, 35); assert.equal(new Set(bank.map(q => q.id)).size, 35);
  for (const q of bank) { assert.equal(q.options.length, 4); assert.ok(q.options.some(o => o.id === q.correct)); assert.ok(q.explanation.length > 30); assert.ok(q.objective); }
});
test('completar 35 conserva todos los resultados y cierra el intento', () => {
  let a = make(); for (let i = 0; i < 35; i++) a = advanceAttempt(a, answer(a), bank, 'now');
  assert.equal(a.answers.length, 35); assert.equal(a.status, 'completed'); assert.ok(a.answers.every(a => a.correct));
});
test('tiempo agotado sin elección se distingue de una elección enviada al límite', () => {
  let a = make(); a = advanceAttempt(a, answer(a, { reason: 'timeout', elapsedMs: 60000, option: null }), bank, 'now');
  assert.equal(a.answers[0].option, null); assert.equal(a.answers[0].reason, 'timeout');
  a = advanceAttempt(a, answer(a, { reason: 'timeout', elapsedMs: 60000 }), bank, 'now');
  assert.equal(a.answers[1].correct, true);
});
test('pasar no registra selección ni cuenta como respuesta correcta', () => {
  const a = advanceAttempt(make(), answer(make(), { reason: 'skip', option: null }), bank, 'now');
  assert.equal(a.answers[0].reason, 'skip'); assert.equal(a.answers[0].correct, false);
  assert.throws(() => advanceAttempt(make(), answer(make(), { reason: 'skip' }), bank, 'now'), /INVALID/);
});
test('pausar nunca recupera tiempo consumido', () => {
  let a = advanceAttempt(make(), { type: 'checkpoint', revision: 0, index: 0, remainingMs: 20000, selected: 'B' }, bank, 'now');
  a = advanceAttempt(a, { type: 'checkpoint', revision: 1, index: 0, remainingMs: 50000, selected: 'B' }, bank, 'now');
  assert.equal(a.remainingMs, 20000); assert.equal(a.answers.length, 0);
});
test('doble envío y pestañas desfasadas no avanzan dos veces', () => {
  const old = make(), action = answer(old); const a = advanceAttempt(old, action, bank, 'now');
  assert.throws(() => advanceAttempt(a, action, bank, 'now'), /CONFLICT/);
  assert.throws(() => advanceAttempt(old, { ...action, index: 2 }, bank, 'now'), /CONFLICT/);
});
test('rechaza cronómetros fuera de rango y timeout prematuro', () => {
  for (const values of [{ elapsedMs: -1 }, { elapsedMs: 60001 }, { reason: 'timeout', elapsedMs: 40000 }, { option: 'Z' }]) {
    assert.throws(() => advanceAttempt(make(), answer(make(), values), bank, 'now'), /INVALID/);
  }
});
test('no entrega claves ni feedback durante el intento', () => {
  const active = advanceAttempt(make(), answer(make()), bank, 'now');
  const data = attemptView(active);
  assert.equal(data.review, undefined); assert.equal(data.questions[0].correct, undefined);
  assert.equal(data.questions[0].explanation, undefined); assert.equal(data.attempt.answers[0].correct, false);
  assert.equal(attemptView({ ...active, status: 'completed' }).review.length, 35);
});
test('resumen informa denominadores y separa omisiones', () => {
  const a = advanceAttempt(make(), answer(make(), { option: null, reason: 'skip' }), bank, 'now');
  const result = types.summarise(a, bank).find(d => d.domain === bank[0].domain);
  assert.equal(result.total, 1); assert.equal(result.correct, 0); assert.equal(result.skipped, 1);
  const condition = types.summarise(a, bank, 'condition').find(d => d.domain === bank[0].condition);
  assert.equal(condition.total, 1); assert.equal(condition.skipped, 1);
});

test('API bloquea anónimos e internos antes de leer el banco o Firestore', async () => {
  for (const role of ['anonymous', 'INTERNO']) {
    const dependencies = {
      'next/server': require('next/server'), zod: require('zod'), 'node:crypto': require('node:crypto'),
      '@/lib/server/firebaseAdmin': { requireTeacher: async () => { throw new Error(role === 'anonymous' ? 'Unauthorized' : 'Forbidden'); } },
      '@/lib/server/apiResponse': { getRequestId: () => 'test', handleApiError: e => ({ status: e.message === 'Unauthorized' ? 401 : 403 }) },
      '@/lib/repaso-msk/server': { attemptsRef: () => { throw new Error('Unexpected DB access'); }, bank, attemptView },
      '@/lib/repaso-msk/catalog': catalog, '@/lib/repaso-msk/bank-state': bankState,
      '@/lib/repaso-msk/engine': { advanceAttempt },
    };
    const list = load('src/app/api/repaso-msk/route.ts', dependencies);
    const detail = load('src/app/api/repaso-msk/[attemptId]/route.ts', dependencies);
    const req = { headers: new Headers(), json: async () => ({}) };
    for (const route of [list, detail]) for (const method of ['GET', 'POST']) {
      assert.equal((await route[method](req, { params: Promise.resolve({ attemptId: 'not-used' }) })).status, role === 'anonymous' ? 401 : 403);
    }
  }
});

test('tres zonas tienen 70 ítems activos, cuatro alternativas y fundamentos', () => {
  assert.equal(new Set([...bank, ...hipBank].map(q => q.id)).size, 70);
  for (const version of ['knee-v1', 'hip-v1', 'shoulder-v1']) {
    const questions = bankQuestions(version); assert.equal(questions.length, 70);
    for (const q of questions) {
      assert.ok(q.id.startsWith(version)); assert.equal(q.options.length, 4);
      assert.equal(new Set(q.options.map(o => o.text)).size, 4);
      assert.ok(q.options.some(o => o.id === q.correct)); assert.ok(q.explanation.length > 30);
      assert.ok(q.sources.every(s => s.url.startsWith('https://')));
    }
  }
  for (const key of ['A', 'B', 'C', 'D']) assert.ok(hipBank.filter(q => q.correct === key).length >= 8);
  assert.ok(hipBank.filter(q => q.domain === 'Fundamentos').length >= 5);
});
test('intentos antiguos de rodilla no bloquean cadera ni se pierden', () => {
  const legacy = { activeId: 'old-knee', usedBank: true };
  assert.equal(bankState.readBankState(legacy, 'knee-v1').activeId, 'old-knee');
  assert.equal(bankState.readBankState(legacy, 'hip-v1').used, false);
  const updated = { ...legacy, banks: { 'hip-v1': { activeId: 'new-hip', used: true } } };
  assert.equal(bankState.readBankState(updated, 'knee-v1').activeId, 'old-knee');
  assert.equal(bankState.readBankState(updated, 'hip-v1').activeId, 'new-hip');
});
test('cadera completa, oculta claves y conserva revisión sin mezclarse con rodilla', () => {
  let a = { ...make(), version: 'hip-v1', questionIds: hipBank.map(q => q.id) };
  assert.equal(attemptView(a).questions[0].correct, undefined);
  for (let i = 0; i < 35; i++) a = advanceAttempt(a, { type: 'answer', revision: a.revision, index: i, option: hipBank[i].correct, reason: 'answer', elapsedMs: 5000 }, [...bank, ...hipBank], 'now');
  assert.equal(a.status, 'completed'); assert.equal(a.answers.filter(x => x.correct).length, 35);
  assert.ok(attemptView(a).review.every(q => q.id.startsWith('hip-v1-')));
  assert.ok(attemptView(make()).questions.every(q => q.id.startsWith('knee-v1-')));
});

test('API crea cada banco una vez, retoma el correcto y exige permiso para repetir', async () => {
  const documents = new Map([['marker', { activeId: 'legacy', usedBank: true }], ['legacy', { ...make(), id: 'legacy' }]]);
  let writes = 0;
  const ref = { parent: { id: 'marker' }, doc: id => ({ id }), firestore: { runTransaction: async fn => fn({
    get: async ref => ({ exists: documents.has(ref.id), data: () => documents.get(ref.id) }),
    create: (ref, value) => { assert.equal(documents.has(ref.id), false); documents.set(ref.id, value); writes++; },
    set: (ref, value, options) => { assert.equal(options.merge, true); const prior = documents.get(ref.id); documents.set(ref.id, { ...prior, banks: { ...prior?.banks, ...value.banks } }); },
  }) } };
  const route = load('src/app/api/repaso-msk/route.ts', {
    'next/server': require('next/server'), 'node:crypto': require('node:crypto'),
    '@/lib/server/firebaseAdmin': { requireTeacher: async () => ({ uid: 'teacher' }) },
    '@/lib/server/apiResponse': { getRequestId: () => 'test', handleApiError: () => ({ status: 500 }) },
    '@/lib/repaso-msk/server': { attemptsRef: () => ref, bankQuestions, attemptView },
    '@/lib/repaso-msk/catalog': catalog, '@/lib/repaso-msk/bank-state': bankState,
    '@/lib/repaso-msk/selection': selection,
  });
  const post = body => route.POST({ headers: new Headers(), json: async () => body });
  assert.equal((await post({ version: 'unknown' })).status, 400);
  assert.equal((await post(null)).status, 400);
  const knee = await (await post({ version: 'knee-v1' })).json(); assert.equal(knee.attempt.id, 'legacy');
  const hip = await (await post({ version: 'hip-v1' })).json(); assert.equal(hip.attempt.version, 'hip-v1');
  assert.equal(hip.questions.length, 35); assert.ok(hip.questions.every(q => q.id.startsWith('hip-v1')));
  const again = await (await post({ version: 'hip-v1' })).json(); assert.equal(again.attempt.id, hip.attempt.id); assert.equal(writes, 1);
  assert.equal(documents.get('marker').activeId, 'legacy');
  documents.set(hip.attempt.id, { ...hip.attempt, status: 'completed' });
  const second = await (await post({ version: 'hip-v1' })).json();
  assert.equal(second.attempt.repeated, false);
  assert.equal(second.questions.filter(q => hip.questions.some(old => old.id === q.id)).length, 0);
  assert.equal(documents.get('marker').banks['hip-v1'].seenFamilies.length, 70);
  documents.set(second.attempt.id, { ...second.attempt, status: 'completed' });
  assert.equal((await post({ version: 'hip-v1' })).status, 409);
  const replay = await (await post({ version: 'hip-v1', replay: true })).json();
  assert.equal(replay.attempt.repeated, true); assert.notEqual(replay.attempt.id, hip.attempt.id);
});
