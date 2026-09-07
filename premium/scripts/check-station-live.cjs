// Opt-in: usa Gemini real y audio sintético. No escribe en Firebase ni crea notas.
// node scripts/check-station-live.cjs /ruta/pregunta.pcm
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const { GoogleGenAI, Modality, StartSensitivity, EndSensitivity } = require('@google/genai');

function load(relative, dependencies = {}) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(relative, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require: (name) => dependencies[name] });
  return module.exports;
}
const patient = load('src/utils/patientPrompts.ts');
const { buildLiveStationPrompt } = load('src/lib/simulador-estaciones/prompts.ts', { '@/utils/patientPrompts': patient });
const { buildStationClosingInstruction } = load('src/lib/simulador-estaciones/closing.ts');
const caseData = {
  ficha_visible: { nombre: 'Elena Prueba', edad: '42 años', sexo: 'Mujer', ocupacion: 'Profesora', deporte_actividad: 'Caminatas', resumen_ingreso: 'Consulta por dolor en rodilla derecha.', motivo_consulta: 'Dolor en rodilla derecha al bajar escaleras', derivacion: 'Sin diagnóstico previo', tiempo_evolucion: 'Dos meses' },
  perfil_secreto: { historia_completa: 'Dolor en rodilla derecha hace dos meses, comenzó gradualmente sin caída. Duele al bajar escaleras y mejora al descansar. Intensidad máxima 5 de 10. Vive con su pareja y trabaja como profesora. No conoce diagnóstico médico. No toma medicamentos. No antecedentes de cirugía ni enfermedades conocidas.', personalidad: 'Cooperadora y tranquila, responde en primera persona, no actúa como profesional.', datos_ocultos: [], antecedentes_relevantes: ['Sin cirugías'], medicamentos: [], bps_oculto: { sueno: 'Duerme bien', estres: 'Moderado', miedos: 'Le preocupa no poder caminar', expectativa_real: 'Caminar sin molestias' } },
  hallazgos_todos_modulos: { rango_movimiento_analitico: 'Flexión activa derecha 125 grados; izquierda 135 grados. Extensión completa bilateral.', observacion_movimiento_inicial: 'Camina sin ayudas.' },
  rubrica_ideal: { diagnostico_ideal_resumido: 'Reservado para la evaluación final.' },
};
async function main() {
  const station = process.argv[3] || 'ANAMNESIS_PROXIMA';
  process.loadEnvFile('.env.local');
  if (!process.env.GEMINI_API_KEY) throw new Error('Falta GEMINI_API_KEY');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY, httpOptions: { apiVersion: 'v1alpha' } });
  let session, readyResolve, responseResolve, input = '', output = '', audioBytes = 0;
  const transcript = [];
  const ready = new Promise((resolve) => { readyResolve = resolve; });
  let next = new Promise((resolve) => { responseResolve = resolve; });
  const timeout = (p, ms) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Sin respuesta tras ${ms / 1000}s`)), ms);
    p.then((r) => { clearTimeout(timer); resolve(r); }, (e) => { clearTimeout(timer); reject(e); });
  });
  const config = {
    temperature: 0.35,
    responseModalities: [Modality.AUDIO], inputAudioTranscription: {}, outputAudioTranscription: {},
    systemInstruction: buildLiveStationPrompt({ station, caseData, priorProgress: {} }),
    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Aoede' } } },
    realtimeInputConfig: { automaticActivityDetection: { disabled: false, startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH, endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH, prefixPaddingMs: 100, silenceDurationMs: 650 } },
  };
  try {
    // Mismo mecanismo de producción: token efímero con configuración bloqueada.
    const model = 'gemini-3.1-flash-live-preview';
    const token = await ai.authTokens.create({ config: { uses: 1, expireTime: new Date(Date.now() + 20 * 60000).toISOString(), newSessionExpireTime: new Date(Date.now() + 5 * 60000).toISOString(), liveConnectConstraints: { model, config }, lockAdditionalFields: [] } });
    const liveClient = new GoogleGenAI({ apiKey: token.name, httpOptions: { apiVersion: 'v1alpha' } });
    session = await liveClient.live.connect({ model, callbacks: {
      onmessage(message) {
        if (message.setupComplete) readyResolve();
        const c = message.serverContent;
        if (c?.inputTranscription?.text) input += c.inputTranscription.text;
        if (c?.outputTranscription?.text) output += c.outputTranscription.text;
        for (const part of c?.modelTurn?.parts || []) if (part.inlineData?.data) audioBytes += Buffer.from(part.inlineData.data, 'base64').length;
        if (c?.turnComplete) responseResolve();
      },
      onerror: () => console.error('Error de conexión Live (sin datos sensibles).'),
    } });
    await timeout(ready, 12000);
    const pcm = fs.readFileSync(process.argv[2]);
    for (let offset = 0; offset < pcm.length; offset += 3200) {
      session.sendRealtimeInput({ audio: { data: pcm.subarray(offset, offset + 3200).toString('base64'), mimeType: 'audio/pcm;rate=16000' } });
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    session.sendRealtimeInput({ audioStreamEnd: true });
    await timeout(next, 30000);
    console.log(JSON.stringify({ prueba: 'entrada de audio sintético', input, output, audioBytes }));
    transcript.push({ role: 'STUDENT', text: input }, { role: 'PATIENT', text: output });
    if (!input.trim() || !output.trim() || !audioBytes) throw new Error('La prueba no tuvo transcripción de entrada, respuesta y audio.');
    for (const action of ['question', 'close']) {
      const followUp = { ANAMNESIS_PROXIMA: '¿Desde cuándo le duele y cómo comenzó?', ANAMNESIS_REMOTA: '¿Con quién vive?', EXAMEN_FISICO: 'Comparo ahora la extensión activa de ambas rodillas. ¿Qué resultado observo?', INTERVENCIONES: 'Como progresión aumentaría de dos a tres series si tolera la dosis previa sin empeorar al día siguiente.', PRESENTACION_FORMAL: 'He terminado mi presentación.', DEFENSA: 'Elija una pregunta concreta sobre el caso para que pueda defender mi razonamiento.' };
      const text = action === 'question' ? followUp[station] : buildStationClosingInstruction(transcript);
      input = ''; output = ''; audioBytes = 0;
      next = new Promise((resolve) => { responseResolve = resolve; });
      session.sendRealtimeInput({ text });
      await timeout(next, 30000);
      console.log(JSON.stringify({ prueba: 'continuación/control realtime', output, audioBytes }));
      if (action === 'question') transcript.push({ role: 'STUDENT', text }, { role: 'PATIENT', text: output });
      if (!output.trim() || !audioBytes) throw new Error('Respuesta de control incompleta.');
    }
  } finally { session?.close(); }
}
main().catch((e) => { console.error(String(e.message).replace(/AIza[\w-]+/g, '[REDACTED]')); process.exitCode = 1; });
