const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { create, act } = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;

// Monta el hook real con React. Solo se sustituyen micrófono, reloj y red:
// no acredita reconocimiento de voz real ni comportamiento clínico del LLM.
async function mount(station = 'ANAMNESIS_PROXIMA', listenOnly = false) {
  const contexts = [], connections = [], spoken = [], timers = new Map();
  let timerId = 0, value, renderer;
  class AudioContext {
    constructor({ sampleRate }) { this.sampleRate = sampleRate; this.state = 'suspended'; this.currentTime = 0; contexts.push(this); }
    async resume() { this.state = 'running'; }
    async close() { this.state = 'closed'; }
    createMediaStreamSource() { return { connect() {}, disconnect() {} }; }
    createScriptProcessor() { this.processor = { connect() {}, disconnect() {} }; return this.processor; }
    createBuffer(_channels, length, rate) { return { duration: length / rate, getChannelData: () => new Float32Array(length) }; }
    createBufferSource() { const source = { connect() {}, start() {}, stop() { source.onended?.(); } }; return source; }
  }
  const track = { readyState: 'live', stop() { this.readyState = 'ended'; } };
  const stream = { active: true, getTracks: () => [track], getAudioTracks: () => [track] };
  class GoogleGenAI {
    live = { connect: async ({ callbacks }) => {
      const sent = [];
      const session = {
        sendRealtimeInput: (input) => sent.push(input),
        sendClientContent() { throw new Error('Método no admitido para conversación 3.1'); },
        close: () => callbacks.onclose({ code: 1000 }),
      };
      connections.push({ callbacks, sent, session });
      callbacks.onopen();
      return session;
    } };
  }
  const source = fs.readFileSync('src/hooks/useResumableGeminiLive.ts', 'utf8');
  const module = { exports: {} };
  const sandbox = {
    module, exports: module.exports,
    require: (id) => id === 'react' ? React : id === '@google/genai' ? { GoogleGenAI } : { auth: { currentUser: { getIdToken: async () => 'test-id' } } },
    AudioContext, navigator: { mediaDevices: { getUserMedia: async () => stream } },
    SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
    speechSynthesis: { speak: (utterance) => spoken.push(utterance), cancel() {} },
    fetch: async () => ({ ok: true, json: async () => ({ ok: true, data: { token: 'fake', model: 'gemini-3.1-flash-live-preview', promptVersion: 'test', openingInstruction: station === 'DEFENSA' ? 'Primera pregunta' : '' } }) }),
    crypto: require('node:crypto').webcrypto, btoa, atob, console, Date,
    setTimeout: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay }); return id; },
    clearTimeout: (id) => timers.delete(id),
    setInterval: (fn, delay) => { const id = ++timerId; timers.set(id, { fn, delay, interval: true }); return id; },
    clearInterval: (id) => timers.delete(id),
  };
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, sandbox);
  function Harness() { value = module.exports.useResumableGeminiLive({ sessionId: 'fixture', station, listenOnly }); return null; }
  await act(async () => { renderer = create(React.createElement(Harness)); });
  return {
    get value() { return value; }, contexts, connections, spoken,
    async action(fn) { await act(async () => { await fn(value); }); },
    async message(message, index = connections.length - 1) { await act(async () => { connections[index].callbacks.onmessage(message); }); },
    async frame() { await act(async () => { contexts[0].processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array([0.4, -0.2]) } }); }); },
    async timer(delay) {
      const entry = [...timers.entries()].find(([, timer]) => timer.delay === delay && !timer.interval);
      assert.ok(entry, `Debe existir reintento de ${delay}ms`);
      timers.delete(entry[0]);
      await act(async () => { entry[1].fn(); await new Promise(setImmediate); });
    },
    async unmount() { await act(async () => renderer.unmount()); },
  };
}

test('no anuncia conexión ni transmite audio hasta setupComplete; control usa realtime', async () => {
  const h = await mount('DEFENSA');
  try {
    await h.action((v) => v.connect());
    assert.equal(h.value.state, 'CONNECTING');
    await h.frame();
    assert.equal(h.connections[0].sent.length, 0);
    await h.message({ setupComplete: {} });
    assert.equal(h.value.state, 'CONNECTED');
    assert.equal(h.connections[0].sent[0].text, 'Primera pregunta');
    await h.frame();
    assert.equal(h.connections[0].sent[1].audio.mimeType, 'audio/pcm;rate=16000');
    await h.action((v) => assert.equal(v.sendText('Cierre'), true));
    assert.equal(h.connections[0].sent.at(-1).text, 'Cierre');
  } finally { await h.unmount(); }
});

test('captura durante respuesta; pausa explícita y reactivación no pierden el stream', async () => {
  const h = await mount();
  try {
    await h.action((v) => v.connect());
    await h.message({ setupComplete: {} });
    await h.message({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'AAAAAA==' } }] }, outputTranscription: { text: 'Hola.' } } });
    assert.equal(h.value.isSpeaking, true);
    await h.frame();
    assert.ok(h.connections[0].sent.at(-1).audio);
    await h.action((v) => v.toggleMic());
    const count = h.connections[0].sent.length;
    await h.frame();
    assert.equal(h.connections[0].sent.length, count);
    assert.equal(h.connections[0].sent.at(-1).audioStreamEnd, true);
    await h.action((v) => v.toggleMic());
    await h.frame();
    assert.equal(h.connections[0].sent.length, count + 1);
    await h.message({ serverContent: { interrupted: true } });
    assert.equal(h.value.isSpeaking, false);
  } finally { await h.unmount(); }
});

test('React diferido conserva límites de turnos del mismo hablante y ambos textos por evento', async () => {
  const h = await mount();
  try {
    await h.action((v) => v.connect());
    await h.message({ setupComplete: {} });
    await h.action(() => {
      const emit = h.connections[0].callbacks.onmessage;
      emit({ serverContent: { inputTranscription: { text: 'Primera.' }, turnComplete: true } });
      emit({ serverContent: { inputTranscription: { text: 'Segunda' } } });
      emit({ serverContent: { inputTranscription: { text: ' pregunta.' }, outputTranscription: { text: 'Respuesta.' }, turnComplete: true } });
    });
    assert.deepEqual(Array.from(h.value.transcript, (t) => t.text), ['Primera.', 'Segunda pregunta.', 'Respuesta.']);
    assert.equal(h.value.completedTurns, 2);
  } finally { await h.unmount(); }
});

test('reconexión ignora eventos del socket anterior y conserva conversación', async () => {
  const h = await mount();
  try {
    await h.action((v) => v.connect());
    await h.message({ setupComplete: {} });
    await h.message({ serverContent: { inputTranscription: { text: 'Me escucha' }, turnComplete: true } });
    await h.action((v) => v.retry());
    await h.message({ setupComplete: {} });
    await h.action(() => h.connections[0].callbacks.onclose({ code: 1006 }));
    assert.equal(h.value.state, 'CONNECTED');
    await h.frame();
    assert.ok(h.connections[1].sent.at(-1).audio);
    assert.equal(h.value.transcript[0].text, 'Me escucha');
  } finally { await h.unmount(); }
});

test('conexiones que caen al abrir no reinician infinitamente los reintentos', async () => {
  const h = await mount();
  try {
    await h.action((v) => v.connect());
    for (const delay of [500, 1000, 2000, 4000, 8000]) {
      await h.message({ setupComplete: {} });
      await h.action(() => h.connections.at(-1).callbacks.onclose({ code: 1006 }));
      await h.timer(delay);
    }
    await h.message({ setupComplete: {} });
    await h.action(() => h.connections.at(-1).callbacks.onclose({ code: 1006 }));
    assert.equal(h.value.state, 'ERROR');
    assert.equal(h.connections.length, 6);
  } finally { await h.unmount(); }
});

test('presentación escucha y transcribe al alumno sin interrumpir con audio del modelo', async () => {
  const h = await mount('PRESENTACION_FORMAL', true);
  try {
    await h.action((v) => v.connect());
    await h.message({ setupComplete: {} });
    await h.message({ serverContent: { inputTranscription: { text: 'Diagnóstico kinesiológico del usuario...' }, outputTranscription: { text: 'Una interrupción no solicitada' }, modelTurn: { parts: [{ inlineData: { data: 'AAAAAA==' } }] }, turnComplete: true } });
    assert.equal(h.value.isSpeaking, false);
    assert.equal(h.value.transcript.length, 1);
    assert.equal(h.value.transcript[0].role, 'STUDENT');
  } finally { await h.unmount(); }
});

test('si Gemini devuelve solo texto, la voz de respaldo lee exactamente esa respuesta', async () => {
  const h = await mount();
  try {
    await h.action((v) => v.connect());
    await h.message({ setupComplete: {} });
    await h.message({ serverContent: { outputTranscription: { text: 'Me duele la rodilla derecha.' }, turnComplete: true } });
    await h.timer(700);
    assert.equal(h.spoken.length, 1);
    assert.equal(h.spoken[0].text, h.value.transcript[0].text);
    assert.equal(h.value.usingFallbackVoice, true);
  } finally { await h.unmount(); }
});

test('un control sin respuesta reconecta y reintenta una vez, sin bucle de órdenes', async () => {
  const h = await mount();
  try {
    await h.action((v) => v.connect());
    await h.message({ setupComplete: {} });
    await h.action((v) => v.sendText('Cerrar esta etapa'));
    await h.timer(12000);
    await h.timer(500);
    await h.message({ setupComplete: {} });
    assert.equal(h.connections[1].sent.filter((p) => p.text === 'Cerrar esta etapa').length, 1);
    await h.timer(12000);
    assert.equal(h.connections.length, 2);
    assert.ok(h.value.error.includes('no respondió'));
  } finally { await h.unmount(); }
});

function loadTs(file, dependencies = {}) {
  const module = { exports: {} };
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, {
    module, exports: module.exports, require: (name) => dependencies[name] || require(name),
  });
  return module.exports;
}

test('proyección de ingreso no filtra diagnóstico automático ni hallazgos; admite solo el manual', () => {
  const types = loadTs('src/lib/simulador-estaciones/types.ts');
  const { projectStationIntake } = loadTs('src/lib/simulador-estaciones/intake.ts', { './types': types });
  const privateCase = { nombre: 'Fixture', edad: '42', motivo_consulta: 'Diagnóstico automático secreto', derivacion: 'Hallazgo privado', resumen_ingreso: 'Hipótesis secreta', rubrica: 'Respuesta ideal' };
  const publicCase = projectStationIntake('RODILLA', privateCase);
  assert.equal(publicCase.nombre, 'Fixture');
  assert.ok(publicCase.resumen_ingreso.includes('rodilla'));
  assert.equal(publicCase.diagnostico_aportado, '');
  assert.ok(!JSON.stringify(publicCase).includes('secreto'));
  assert.equal(projectStationIntake('RODILLA', privateCase, ' Diagnóstico escrito a mano ').diagnostico_aportado, 'Diagnóstico escrito a mano');
});

test('las siete estaciones conservan 60 minutos y separan el escrito de la voz', () => {
  const types = loadTs('src/lib/simulador-estaciones/types.ts');
  assert.equal(types.STATION_DEFINITIONS.length, 7);
  assert.equal(types.STATION_DEFINITIONS.reduce((sum, s) => sum + s.durationSeconds, 0), 3600);
  assert.equal(types.STATION_DEFINITIONS.filter((s) => s.kind === 'WRITTEN').length, 1);
  assert.equal(types.STATION_DEFINITIONS.find((s) => s.kind === 'WRITTEN').key, 'PLANIFICACION_ESCRITA');
});

test('prompt de entrevista reutiliza el OSCE, conserva registro literal y no recibe rúbrica', () => {
  const patient = loadTs('src/utils/patientPrompts.ts');
  const { buildLiveStationPrompt } = loadTs('src/lib/simulador-estaciones/prompts.ts', { '@/utils/patientPrompts': patient });
  const caseData = { ficha_visible: { nombre: 'Paciente de prueba', edad: '42', motivo_consulta: 'Molestias', ocupacion: 'Docente', deporte_actividad: 'Camina', tiempo_evolucion: 'Dos meses' }, perfil_secreto: { historia_completa: 'Historia fija' }, hallazgos_todos_modulos: { prueba: 'Resultado reservado' }, rubrica_ideal: { diagnostico_ideal_resumido: 'DIAGNOSTICO_SECRETO' } };
  const prompt = buildLiveStationPrompt({ station: 'ANAMNESIS_REMOTA', caseData, priorProgress: { ANAMNESIS_PROXIMA: { semanticSummary: 'Resumen', transcript: [{ role: 'STUDENT', text: 'Pregunta literal preservada' }] } } });
  assert.ok(prompt.includes('IDENTIDAD NATURAL'));
  assert.ok(prompt.includes('La historia ya está definida'));
  assert.ok(prompt.includes('Pregunta literal preservada'));
  assert.ok(!prompt.includes('DIAGNOSTICO_SECRETO'));
  assert.ok(!prompt.includes('Resultado reservado'));
  const defense = buildLiveStationPrompt({ station: 'DEFENSA', caseData, priorProgress: {} });
  assert.ok(defense.includes('Realiza preguntas una a una'));
  assert.ok(defense.includes('DIAGNOSTICO_SECRETO'));
});
