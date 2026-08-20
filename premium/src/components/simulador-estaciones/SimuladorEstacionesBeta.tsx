'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpenCheck,
  Check,
  ChevronRight,
  CirclePause,
  Clock3,
  LoaderCircle,
  Mic,
  MicOff,
  Play,
  Plus,
  Radio,
  RefreshCcw,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { useResumableGeminiLive } from '@/hooks/useResumableGeminiLive';
import {
  REGION_OPTIONS,
  STATION_DEFINITIONS,
  STATION_KEYS,
  TOTAL_EXAM_SECONDS,
  createEmptyPlanningDraft,
  type PlanningDraft,
  type PublicStationSession,
  type TranscriptTurn,
  type VoiceStationKey,
} from '@/lib/simulador-estaciones/types';

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string };

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión expiró. Vuelve a iniciar sesión.');
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error || 'No se pudo completar la operación.');
  return payload.data;
}

function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function readLocalBackup<T>(key: string): T | null {
  if (typeof window === 'undefined') return null;
  try {
    return JSON.parse(localStorage.getItem(key) || 'null') as T | null;
  } catch {
    return null;
  }
}

function regionLabel(value: string) {
  return REGION_OPTIONS.find((option) => option.value === value)?.label || value;
}

export function SimuladorEstacionesBeta() {
  const [sessions, setSessions] = useState<PublicStationSession[]>([]);
  const [activeSession, setActiveSession] = useState<PublicStationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [globalError, setGlobalError] = useState('');

  const loadSessions = useCallback(async () => {
    setGlobalError('');
    try {
      const result = await apiRequest<{ sessions: PublicStationSession[] }>('/api/simulador-estaciones/sessions');
      setSessions(result.sessions);
      setActiveSession((current) => current
        ? result.sessions.find((session) => session.id === current.id) || current
        : null);
    } catch (error) {
      setGlobalError(String((error as Error)?.message || error));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadSessions(); }, [loadSessions]);

  const createSession = async (input: { region: string; difficulty: string; startingNotes: string }) => {
    setCreating(true);
    setGlobalError('');
    try {
      const result = await apiRequest<{ session: PublicStationSession }>('/api/simulador-estaciones/sessions', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      setSessions((current) => [result.session, ...current]);
      setActiveSession(result.session);
    } catch (error) {
      setGlobalError(String((error as Error)?.message || error));
    } finally {
      setCreating(false);
    }
  };

  if (activeSession) {
    return (
      <SessionShell
        session={activeSession}
        onBack={() => { setActiveSession(null); void loadSessions(); }}
        onSessionChange={(session) => {
          setActiveSession(session);
          setSessions((current) => [session, ...current.filter((item) => item.id !== session.id)]);
        }}
      />
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="overflow-hidden rounded-[28px] bg-slate-950 text-white shadow-xl shadow-slate-900/10">
          <div className="grid gap-6 px-5 py-7 sm:px-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-extrabold uppercase tracking-[0.18em] text-cyan-300">
                <ShieldCheck className="h-4 w-4" /> Beta privada docente
              </div>
              <h1 className="max-w-3xl text-3xl font-black tracking-tight sm:text-4xl">Simulador clínico por estaciones de voz</h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300 sm:text-base">
                Un caso musculoesquelético completo en siete etapas, con continuidad, defensa y retroalimentación trazable.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-2 rounded-2xl bg-white/5 p-3 text-center ring-1 ring-white/10">
              <div className="px-3 py-2"><strong className="block text-2xl">{TOTAL_EXAM_SECONDS / 60}</strong><span className="text-xs text-slate-400">minutos</span></div>
              <div className="border-l border-white/10 px-3 py-2"><strong className="block text-2xl">7</strong><span className="text-xs text-slate-400">etapas</span></div>
            </div>
          </div>
        </header>

        {globalError && (
          <div className="flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div className="flex-1"><strong>No se pudo completar la acción.</strong><p className="mt-1">{globalError}</p></div>
            <button onClick={() => void loadSessions()} className="font-bold underline">Reintentar</button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <NewSessionCard creating={creating} onCreate={createSession} />
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <div><p className="text-xs font-black uppercase tracking-widest text-slate-400">Recuperación</p><h2 className="mt-1 text-xl font-black text-slate-900">Sesiones guardadas</h2></div>
              <button onClick={() => void loadSessions()} className="rounded-xl border border-slate-200 p-2.5 text-slate-600 hover:bg-slate-50" aria-label="Actualizar"><RefreshCcw className="h-4 w-4" /></button>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? <LoadingLine label="Buscando sesiones..." /> : sessions.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-6 text-center text-sm text-slate-500">Todavía no hay sesiones beta.</div>
              ) : sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => setActiveSession(session)}
                  className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-indigo-300 hover:bg-indigo-50/30"
                >
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${session.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700'}`}>
                    {session.status === 'COMPLETED' ? <Check className="h-5 w-5" /> : <RotateCcw className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold text-slate-900">{regionLabel(session.region)} · {String(session.visibleCase?.nombre || 'Caso preparado')}</p>
                    <p className="mt-1 text-xs text-slate-500">{session.status === 'COMPLETED' ? `Resultado ${session.evaluation?.totalScore ?? '—'}%` : `Continuar en ${STATION_DEFINITIONS[session.currentStationIndex]?.shortTitle}`}</p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300" />
                </button>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function NewSessionCard({ creating, onCreate }: {
  creating: boolean;
  onCreate: (input: { region: string; difficulty: string; startingNotes: string }) => void;
}) {
  const [region, setRegion] = useState('RODILLA');
  const [difficulty, setDifficulty] = useState('AVANZADO');
  const [startingNotes, setStartingNotes] = useState('');
  return (
    <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <p className="text-xs font-black uppercase tracking-widest text-indigo-500">Nuevo caso</p>
      <h2 className="mt-1 text-2xl font-black text-slate-900">Elige la región</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">La condición y sus variables se generan al azar. El caso queda fijo desde ese momento.</p>
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {REGION_OPTIONS.map((option) => (
          <button key={option.value} onClick={() => setRegion(option.value)} className={`rounded-xl border px-3 py-3 text-sm font-bold transition ${region === option.value ? 'border-indigo-600 bg-indigo-600 text-white shadow-md shadow-indigo-200' : 'border-slate-200 bg-white text-slate-700 hover:border-indigo-300'}`}>{option.label}</button>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1.5">
        {['INTERMEDIO', 'AVANZADO'].map((level) => <button key={level} onClick={() => setDifficulty(level)} className={`rounded-xl px-3 py-2.5 text-xs font-black ${difficulty === level ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>{level === 'INTERMEDIO' ? 'Intermedio' : 'Avanzado'}</button>)}
      </div>
      <label className="mt-5 block text-sm font-extrabold text-slate-700">Preferencia opcional</label>
      <textarea value={startingNotes} onChange={(event) => setStartingNotes(event.target.value.slice(0, 600))} rows={3} placeholder="Ej.: persona mayor, cuadro persistente, retorno deportivo..." className="mt-2 w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50" />
      <button disabled={creating} onClick={() => onCreate({ region, difficulty, startingNotes })} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-4 text-sm font-black text-white transition hover:bg-indigo-700 disabled:cursor-wait disabled:opacity-60">
        {creating ? <><LoaderCircle className="h-5 w-5 animate-spin" /> Preparando un caso único...</> : <><Plus className="h-5 w-5" /> Crear simulación</>}
      </button>
    </section>
  );
}

function SessionShell({ session, onBack, onSessionChange }: {
  session: PublicStationSession;
  onBack: () => void;
  onSessionChange: (session: PublicStationSession) => void;
}) {
  const currentDefinition = STATION_DEFINITIONS[session.currentStationIndex];
  const allStationsComplete = STATION_KEYS.every((key) => session.stations[key]?.status === 'COMPLETED');
  return (
    <main className="min-h-screen bg-slate-50 pb-10">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-3 sm:px-6">
          <button onClick={onBack} className="rounded-xl border border-slate-200 p-2.5 text-slate-600"><ArrowLeft className="h-5 w-5" /></button>
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-black text-slate-900">{regionLabel(session.region)} · {String(session.visibleCase?.nombre || 'Caso clínico')}</p><p className="text-xs text-slate-500">Beta docente · guardado continuo</p></div>
          <div className="hidden items-center gap-2 rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-extrabold text-emerald-700 sm:flex"><Save className="h-3.5 w-3.5" /> Recuperable</div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-5 px-3 py-5 sm:px-6">
        <StationStepper session={session} />
        {session.status === 'COMPLETED' && session.evaluation ? (
          <ResultsView session={session} />
        ) : allStationsComplete ? (
          <EvaluationPending session={session} onSessionChange={onSessionChange} />
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
            <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-4 py-5 sm:px-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div><p className="text-xs font-black uppercase tracking-widest text-indigo-500">Etapa {session.currentStationIndex + 1} de 7</p><h1 className="mt-1 text-2xl font-black text-slate-950">{currentDefinition.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{currentDefinition.description}</p></div>
                  <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-700">{currentDefinition.durationSeconds / 60} min</span>
                </div>
              </div>
              {currentDefinition.kind === 'WRITTEN' ? (
                <WrittenWorkspace key={session.currentStation} session={session} onSessionChange={onSessionChange} />
              ) : (
                <VoiceWorkspace key={session.currentStation} session={session} station={session.currentStation as VoiceStationKey} onSessionChange={onSessionChange} />
              )}
            </section>
            <CaseSidebar session={session} />
          </div>
        )}
      </div>
    </main>
  );
}

function EvaluationPending({ session, onSessionChange }: { session: PublicStationSession; onSessionChange: (session: PublicStationSession) => void }) {
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const launchedRef = useRef(false);

  const evaluate = useCallback(async () => {
    if (working) return;
    setWorking(true);
    setError('');
    try {
      const result = await apiRequest<{ session: PublicStationSession }>(`/api/simulador-estaciones/sessions/${session.id}/evaluate`, { method: 'POST' });
      onSessionChange(result.session);
    } catch (reason) {
      setError(String((reason as Error)?.message || reason));
    } finally {
      setWorking(false);
    }
  }, [onSessionChange, session.id, working]);

  useEffect(() => {
    if (launchedRef.current) return;
    launchedRef.current = true;
    void evaluate();
  }, [evaluate]);

  return (
    <section className="mx-auto max-w-2xl rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-10">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-700">
        {working ? <LoaderCircle className="h-8 w-8 animate-spin" /> : error ? <AlertTriangle className="h-8 w-8" /> : <Sparkles className="h-8 w-8" />}
      </div>
      <h1 className="mt-5 text-2xl font-black text-slate-950">{working ? 'Analizando el examen completo' : error ? 'La sesión está guardada' : 'Examen registrado'}</h1>
      <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-slate-600">{working ? 'Se están contrastando las siete etapas, el escrito y la defensa. Esto ocurre después de los 60 minutos y no modifica tus respuestas.' : error || 'Preparando resultados.'}</p>
      {error && <button onClick={() => void evaluate()} className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-sm font-black text-white"><RefreshCcw className="h-4 w-4" /> Reintentar evaluación</button>}
    </section>
  );
}

function StationStepper({ session }: { session: PublicStationSession }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <div className="flex min-w-[760px] gap-1">
        {STATION_DEFINITIONS.map((station, index) => {
          const done = session.stations[station.key]?.status === 'COMPLETED';
          const active = index === session.currentStationIndex && session.status !== 'COMPLETED';
          return <div key={station.key} className={`flex flex-1 items-center gap-2 rounded-xl px-3 py-2.5 ${active ? 'bg-indigo-600 text-white' : done ? 'bg-emerald-50 text-emerald-800' : 'text-slate-400'}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-black ${active ? 'bg-white/20' : done ? 'bg-emerald-200' : 'bg-slate-100'}`}>{done ? <Check className="h-3.5 w-3.5" /> : index + 1}</span><span className="truncate text-xs font-extrabold">{station.shortTitle}</span></div>;
        })}
      </div>
    </div>
  );
}

function CaseSidebar({ session }: { session: PublicStationSession }) {
  const visible = session.visibleCase as Record<string, string>;
  return (
    <aside className="space-y-4">
      <div className="rounded-[24px] bg-slate-950 p-5 text-white shadow-lg">
        <p className="text-xs font-black uppercase tracking-widest text-cyan-300">Ficha disponible</p>
        <h2 className="mt-3 text-2xl font-black">{visible.nombre || 'Caso simulado'}</h2>
        <p className="mt-1 text-sm text-slate-300">{visible.edad} · {visible.ocupacion}</p>
        <dl className="mt-5 space-y-4 text-sm">
          <div><dt className="text-xs font-bold uppercase text-slate-500">Motivo de consulta</dt><dd className="mt-1 leading-6 text-slate-100">{visible.motivo_consulta}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-slate-500">Derivación</dt><dd className="mt-1 leading-6 text-slate-100">{visible.derivacion}</dd></div>
          <div><dt className="text-xs font-bold uppercase text-slate-500">Evolución</dt><dd className="mt-1 leading-6 text-slate-100">{visible.tiempo_evolucion}</dd></div>
        </dl>
      </div>
      <div className="rounded-[24px] border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> El caso no cambia</strong><p className="mt-2">Cerrar la pestaña, cambiar de dispositivo o reconectar la voz no genera un paciente nuevo.</p></div>
    </aside>
  );
}

function VoiceWorkspace({ session, station, onSessionChange }: {
  session: PublicStationSession;
  station: VoiceStationKey;
  onSessionChange: (session: PublicStationSession) => void;
}) {
  const progress = session.stations[station];
  const backup = useMemo(() => readLocalBackup<{ remaining?: number; elapsed?: number; transcript?: TranscriptTurn[] }>(`station-beta:${session.id}:${station}`), [session.id, station]);
  const restoredTranscript = backup?.transcript && backup.transcript.length >= (progress.transcript?.length || 0) ? backup.transcript : progress.transcript;
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.min(STATION_DEFINITIONS[session.currentStationIndex].durationSeconds, Number(backup?.remaining ?? progress.remainingSeconds))));
  const [elapsed, setElapsed] = useState(() => Math.max(progress.elapsedSeconds, Number(backup?.elapsed || 0)));
  const [closing, setClosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localError, setLocalError] = useState('');
  const resumeHandleRef = useRef('');
  const transcriptRef = useRef<TranscriptTurn[]>(restoredTranscript || []);
  const remainingRef = useRef(progress.remainingSeconds);
  const elapsedRef = useRef(progress.elapsedSeconds);
  const reconnectCountRef = useRef(progress.reconnectCount || 0);
  const saveInFlightRef = useRef(false);

  const patch = useCallback(async (action: 'START' | 'CHECKPOINT' | 'PAUSE' | 'COMPLETE_STATION', extra: Record<string, unknown> = {}) => {
    if (saveInFlightRef.current && action === 'CHECKPOINT') return null;
    saveInFlightRef.current = true;
    try {
      const result = await apiRequest<{ session: PublicStationSession }>(`/api/simulador-estaciones/sessions/${session.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          action,
          station,
          remainingSeconds: remainingRef.current,
          elapsedSeconds: elapsedRef.current,
          transcript: transcriptRef.current,
          semanticSummary: transcriptRef.current.map((turn) => `${turn.role}: ${turn.text}`).join('\n').slice(-12000),
          reconnectCount: reconnectCountRef.current,
          ...(resumeHandleRef.current ? { resumeHandle: resumeHandleRef.current } : {}),
          ...extra,
        }),
      });
      return result.session;
    } finally {
      saveInFlightRef.current = false;
    }
  }, [session.id, station]);

  const live = useResumableGeminiLive({
    sessionId: session.id,
    station,
    initialTranscript: restoredTranscript,
    onResumeHandle: (handle) => { resumeHandleRef.current = handle; },
    onReconnectCount: (count) => { reconnectCountRef.current = (progress.reconnectCount || 0) + count; },
  });
  const sendControlText = live.sendText;
  transcriptRef.current = live.transcript;
  remainingRef.current = remaining;
  elapsedRef.current = elapsed;

  useEffect(() => {
    const key = `station-beta:${session.id}:${station}`;
    localStorage.setItem(key, JSON.stringify({ remaining, elapsed, transcript: live.transcript, savedAt: Date.now() }));
  }, [elapsed, live.transcript, remaining, session.id, station]);

  useEffect(() => {
    if (live.state !== 'CONNECTED' || closing) return;
    const interval = setInterval(() => {
      setRemaining((value) => {
        const next = Math.max(0, value - 1);
        remainingRef.current = next;
        return next;
      });
      setElapsed((value) => {
        const next = value + 1;
        elapsedRef.current = next;
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [closing, live.state]);

  useEffect(() => {
    if (remaining !== 0 || closing) return;
    setClosing(true);
    sendControlText('[CONTROL DEL EXAMEN] El tiempo terminó. Realiza ahora el único cierre de confirmación semántica de datos críticos. No permitas agregar contenido nuevo ni entregues feedback.');
  }, [closing, remaining, sendControlText]);

  useEffect(() => {
    if (live.state !== 'CONNECTED') return;
    const interval = setInterval(() => { void patch('CHECKPOINT'); }, 10000);
    return () => clearInterval(interval);
  }, [live.state, patch]);

  const start = async () => {
    setLocalError('');
    try {
      await patch('START');
      await live.connect();
    } catch (error) {
      setLocalError(String((error as Error)?.message || error));
    }
  };

  const askToClose = () => {
    setClosing(true);
    live.sendText('[CONTROL DEL EXAMEN] El estudiante solicita cerrar la estación. Haz el único resumen de 3 a 6 datos críticos entendidos. Solo acepta correcciones de escucha; no aceptes contenido clínico nuevo ni entregues feedback.');
  };

  const finish = async () => {
    setSaving(true);
    setLocalError('');
    try {
      live.disconnect(true);
      const updated = await patch('COMPLETE_STATION');
      if (updated) onSessionChange(updated);
    } catch (error) {
      setLocalError(String((error as Error)?.message || error));
    } finally {
      setSaving(false);
    }
  };

  const connected = live.state === 'CONNECTED';
  const reconnecting = live.state === 'RECONNECTING' || live.state === 'CONNECTING';

  return (
    <div className="p-4 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className={`rounded-2xl border p-4 ${connected ? 'border-emerald-200 bg-emerald-50' : reconnecting ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'}`}>
          <div className="flex items-center gap-3">
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${connected ? 'bg-emerald-600 text-white' : 'bg-white text-slate-600'}`}>{connected ? <Radio className="h-5 w-5 animate-pulse" /> : reconnecting ? <LoaderCircle className="h-5 w-5 animate-spin" /> : <Mic className="h-5 w-5" />}</span>
            <div><p className="font-black text-slate-900">{connected ? 'Estación en curso' : reconnecting ? 'Reconectando sin descontar tiempo' : live.state === 'ERROR' ? 'La voz necesita reintento' : 'Lista para comenzar'}</p><p className="mt-0.5 text-xs text-slate-500">{connected ? (live.isSpeaking ? 'La voz está respondiendo' : 'Micrófono escuchando') : 'El cronómetro comienza al conectar'}</p></div>
          </div>
        </div>
        <div className={`rounded-2xl px-6 py-4 text-center ${remaining <= 60 ? 'bg-rose-600 text-white' : 'bg-slate-950 text-white'}`}><Clock3 className="mx-auto mb-1 h-4 w-4 opacity-70" /><span className="font-mono text-3xl font-black tabular-nums">{formatTime(remaining)}</span></div>
      </div>

      {(localError || live.error) && <div className="mt-4 flex items-start gap-2 rounded-xl bg-rose-50 p-3 text-sm text-rose-800"><WifiOff className="mt-0.5 h-4 w-4 shrink-0" />{localError || live.error}</div>}

      <div className="mt-5 flex flex-wrap gap-2">
        {!connected && !reconnecting && !closing && <button onClick={() => void start()} className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3.5 text-sm font-black text-white sm:flex-none"><Play className="h-4 w-4" /> {progress.elapsedSeconds > 0 ? 'Reanudar estación' : 'Comenzar estación'}</button>}
        {live.state === 'ERROR' && <button onClick={() => void live.retry()} className="flex items-center gap-2 rounded-2xl bg-amber-500 px-5 py-3.5 text-sm font-black text-white"><RefreshCcw className="h-4 w-4" /> Reintentar voz</button>}
        {connected && <button onClick={live.toggleMic} className="flex items-center gap-2 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700">{live.isMicOpen ? <Mic className="h-4 w-4" /> : <MicOff className="h-4 w-4" />}{live.isMicOpen ? 'Silenciar' : 'Activar'}</button>}
        {connected && !closing && <button onClick={askToClose} className="ml-auto flex items-center gap-2 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-black text-slate-800"><CirclePause className="h-4 w-4" /> Terminar etapa</button>}
      </div>

      {connected && <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, live.volume * 900)}%` }} /></div>}

      {closing && (
        <div className="mt-5 rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
          <p className="font-black text-indigo-950">Cierre de escucha</p>
          <p className="mt-1 text-sm leading-6 text-indigo-800">La voz resumirá únicamente lo que entendió. Corrige solo un error de escucha y luego cierra la etapa.</p>
          <button disabled={saving} onClick={() => void finish()} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-700 px-4 py-3 text-sm font-black text-white disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Confirmar y pasar a la siguiente</button>
        </div>
      )}

      <TranscriptView transcript={live.transcript} />
    </div>
  );
}

function TranscriptView({ transcript }: { transcript: TranscriptTurn[] }) {
  return (
    <div className="mt-6 border-t border-slate-100 pt-5">
      <div className="flex items-center justify-between"><h3 className="text-sm font-black text-slate-900">Registro recuperable</h3><span className="text-xs text-slate-400">{transcript.length} turnos</span></div>
      <div className="mt-3 max-h-80 space-y-2 overflow-y-auto rounded-2xl bg-slate-50 p-3">
        {transcript.length === 0 ? <p className="py-8 text-center text-sm text-slate-400">La transcripción aparecerá aquí al comenzar.</p> : transcript.map((turn) => <div key={turn.id} className={`rounded-xl p-3 text-sm leading-6 ${turn.role === 'STUDENT' ? 'ml-4 bg-indigo-600 text-white' : 'mr-4 border border-slate-200 bg-white text-slate-700'}`}><span className={`mb-1 block text-[10px] font-black uppercase tracking-widest ${turn.role === 'STUDENT' ? 'text-indigo-200' : 'text-slate-400'}`}>{turn.role === 'STUDENT' ? 'Estudiante' : turn.role === 'PATIENT' ? 'Paciente' : 'Comisión'}</span>{turn.text}</div>)}
      </div>
    </div>
  );
}

const PLANNING_FIELDS: Array<{ key: keyof PlanningDraft; label: string; guide: string; rows: number }> = [
  { key: 'diagnosticoKinesiologico', label: 'Diagnóstico kinesiológico', guide: 'Integra condición de salud, deficiencias, actividad, participación y factores contextuales relevantes.', rows: 4 },
  { key: 'problemaPrincipal', label: 'Problema principal', guide: 'Prioriza el problema modificable que organiza tus decisiones.', rows: 3 },
  { key: 'objetivoGeneral', label: 'Objetivo general', guide: 'Expresa el cambio funcional global esperado.', rows: 3 },
  { key: 'objetivosEspecificos', label: 'Objetivos específicos', guide: 'Resultados intermedios medibles y conectados con el problema.', rows: 5 },
  { key: 'objetivosOperacionales', label: 'Objetivos operacionales e intervenciones', guide: 'Incluye ejercicio, educación u otras intervenciones pertinentes con dosis completa.', rows: 6 },
  { key: 'planTratamiento', label: 'Plan de tratamiento', guide: 'Sesiones, frecuencia, duración, fases, progresión y duración total.', rows: 6 },
  { key: 'reevaluacion', label: 'Reevaluación', guide: 'Cuándo, con qué medidas y qué decisión tomarías según la respuesta.', rows: 4 },
  { key: 'pronostico', label: 'Pronóstico', guide: 'Plazo razonado y factores favorables o desfavorables.', rows: 4 },
];

function WrittenWorkspace({ session, onSessionChange }: { session: PublicStationSession; onSessionChange: (session: PublicStationSession) => void }) {
  const progress = session.stations.PLANIFICACION_ESCRITA;
  const backup = useMemo(() => readLocalBackup<{ draft?: PlanningDraft; remaining?: number; elapsed?: number }>(`station-beta:${session.id}:PLANIFICACION_ESCRITA`), [session.id]);
  const [draft, setDraft] = useState<PlanningDraft>(backup?.draft || session.planningDraft || createEmptyPlanningDraft());
  const [remaining, setRemaining] = useState(() => Math.max(0, Math.min(10 * 60, Number(backup?.remaining ?? progress.remainingSeconds))));
  const [elapsed, setElapsed] = useState(() => Math.max(progress.elapsedSeconds, Number(backup?.elapsed || 0)));
  const [running, setRunning] = useState(progress.status === 'IN_PROGRESS');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const draftRef = useRef(draft);
  const remainingRef = useRef(remaining);
  const elapsedRef = useRef(elapsed);

  const patch = useCallback(async (action: 'START' | 'CHECKPOINT' | 'COMPLETE_STATION') => {
    const result = await apiRequest<{ session: PublicStationSession }>(`/api/simulador-estaciones/sessions/${session.id}`, { method: 'PATCH', body: JSON.stringify({ action, station: 'PLANIFICACION_ESCRITA', remainingSeconds: remainingRef.current, elapsedSeconds: elapsedRef.current, planningDraft: draftRef.current }) });
    return result.session;
  }, [session.id]);

  draftRef.current = draft;
  remainingRef.current = remaining;
  elapsedRef.current = elapsed;

  useEffect(() => {
    localStorage.setItem(`station-beta:${session.id}:PLANIFICACION_ESCRITA`, JSON.stringify({ draft, remaining, elapsed, savedAt: Date.now() }));
  }, [draft, elapsed, remaining, session.id]);
  useEffect(() => {
    if (!running || remaining <= 0) return;
    const timer = setInterval(() => {
      setRemaining((value) => { const next = Math.max(0, value - 1); remainingRef.current = next; return next; });
      setElapsed((value) => { const next = value + 1; elapsedRef.current = next; return next; });
    }, 1000);
    return () => clearInterval(timer);
  }, [remaining, running]);
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => { void patch('CHECKPOINT').catch(() => undefined); }, 10000);
    return () => clearInterval(timer);
  }, [patch, running]);

  const start = async () => { setRunning(true); try { await patch('START'); } catch (reason) { setError(String((reason as Error)?.message || reason)); } };
  const finish = async () => {
    setSaving(true); setError('');
    try { setRunning(false); onSessionChange(await patch('COMPLETE_STATION')); }
    catch (reason) { setError(String((reason as Error)?.message || reason)); }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-950 p-4 text-white"><div><p className="text-sm font-black">Tu escrito será visible en la presentación</p><p className="mt-1 text-xs text-slate-400">No se corrige ni completa durante esta etapa.</p></div><span className={`font-mono text-3xl font-black ${remaining <= 60 ? 'text-rose-300' : ''}`}>{formatTime(remaining)}</span></div>
      {!running && progress.status === 'NOT_STARTED' && <button onClick={() => void start()} className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-4 text-sm font-black text-white"><Play className="h-4 w-4" /> Comenzar los 10 minutos</button>}
      {error && <div className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-800">{error}</div>}
      <div className="mt-5 space-y-5">
        {PLANNING_FIELDS.map((field) => <label key={field.key} className="block"><span className="font-black text-slate-900">{field.label}</span><span className="mt-1 block text-xs leading-5 text-slate-500">{field.guide}</span><textarea disabled={!running && progress.status === 'NOT_STARTED'} rows={field.rows} value={draft[field.key]} onChange={(event) => setDraft((current) => ({ ...current, [field.key]: event.target.value }))} className="mt-2 w-full resize-y rounded-2xl border border-slate-200 px-4 py-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:ring-4 focus:ring-indigo-50 disabled:bg-slate-50" /></label>)}
      </div>
      {running && <button disabled={saving} onClick={() => void finish()} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-5 py-4 text-sm font-black text-white disabled:opacity-60">{saving ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} Guardar y pasar a la presentación</button>}
    </div>
  );
}

function ResultsView({ session }: { session: PublicStationSession }) {
  const evaluation = session.evaluation!;
  const scoreEntries = Object.entries(evaluation.stationScores);
  const labels: Record<string, string> = { anamnesisProxima: 'Anamnesis próxima', anamnesisRemota: 'Anamnesis remota', examenFisico: 'Evaluación física', intervenciones: 'Intervenciones', planificacionEscrita: 'Planificación escrita', presentacionFormal: 'Presentación', defensa: 'Defensa', seguridadProfesional: 'Seguridad', coherenciaLongitudinal: 'Coherencia clínica' };
  return (
    <div className="space-y-5">
      <section className="grid gap-5 overflow-hidden rounded-[28px] bg-slate-950 p-6 text-white shadow-xl sm:p-8 lg:grid-cols-[auto_1fr] lg:items-center">
        <div className="flex h-40 w-40 flex-col items-center justify-center rounded-full border-[10px] border-indigo-500 bg-white/5"><strong className="text-4xl font-black">{evaluation.totalScore}%</strong><span className="mt-1 text-sm text-slate-300">Nota {evaluation.grade}</span></div>
        <div><p className="text-xs font-black uppercase tracking-widest text-cyan-300">Evaluación final trazable</p><h1 className="mt-2 text-3xl font-black">{evaluation.outcome.replaceAll('_', ' ')}</h1><p className="mt-3 max-w-3xl leading-7 text-slate-300">{evaluation.feedbackSummary}</p></div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{scoreEntries.map(([key, value]) => <article key={key} className="rounded-2xl border border-slate-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-black text-slate-900">{labels[key] || key}</h2><span className="rounded-lg bg-slate-100 px-2 py-1 text-xs font-black">{value.score}%</span></div><p className="mt-3 text-sm leading-6 text-slate-600">{value.comment}</p><div className="mt-3 space-y-2">{value.evidence.slice(0, 2).map((item, index) => <p key={index} className="rounded-xl bg-slate-50 p-2.5 text-xs leading-5 text-slate-600"><strong>{item.station}:</strong> {item.evidence}</p>)}</div></article>)}</section>
      <section className="grid gap-5 lg:grid-cols-2"><FeedbackList title="Fortalezas" icon={<Check className="h-5 w-5" />} items={evaluation.strengths} tone="emerald" /><FeedbackList title="Prioridades" icon={<BookOpenCheck className="h-5 w-5" />} items={evaluation.priorities} tone="amber" /></section>
      {evaluation.criticalSafetyErrors.length > 0 && <FeedbackList title="Errores críticos de seguridad" icon={<AlertTriangle className="h-5 w-5" />} items={evaluation.criticalSafetyErrors.map((item) => `${item.station}: ${item.error} — ${item.evidence}`)} tone="rose" />}
      <section className="rounded-[24px] border border-slate-200 bg-white p-6"><h2 className="flex items-center gap-2 text-xl font-black text-slate-950"><Sparkles className="h-5 w-5 text-indigo-500" /> Coherencia del razonamiento</h2><p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600">{evaluation.coherenceAnalysis}</p><h3 className="mt-6 font-black text-slate-900">Próxima práctica recomendada</h3><p className="mt-2 text-sm leading-6 text-slate-600">{evaluation.nextPractice}</p></section>
    </div>
  );
}

function FeedbackList({ title, icon, items, tone }: { title: string; icon: React.ReactNode; items: string[]; tone: 'emerald' | 'amber' | 'rose' }) {
  const colors = { emerald: 'border-emerald-200 bg-emerald-50 text-emerald-950', amber: 'border-amber-200 bg-amber-50 text-amber-950', rose: 'border-rose-200 bg-rose-50 text-rose-950' };
  return <section className={`rounded-[24px] border p-5 ${colors[tone]}`}><h2 className="flex items-center gap-2 text-lg font-black">{icon}{title}</h2><ul className="mt-4 space-y-3">{items.map((item, index) => <li key={index} className="flex gap-3 text-sm leading-6"><span className="font-black">{index + 1}.</span><span>{item}</span></li>)}</ul></section>;
}

function LoadingLine({ label }: { label: string }) {
  return <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-6 text-sm text-slate-500"><LoaderCircle className="h-4 w-4 animate-spin" />{label}</div>;
}
