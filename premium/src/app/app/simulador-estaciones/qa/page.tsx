'use client';

import { useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, CircleAlert, FlaskConical, LoaderCircle, Trash2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { auth } from '@/lib/firebase';
import {
  STATION_KEYS,
  type PublicStationSession,
  type StationKey,
} from '@/lib/simulador-estaciones/types';
import {
  STATION_QA_PREFIX,
  buildQaStationPatch,
  validateQaSession,
} from '@/lib/simulador-estaciones/qaFixture';
import {
  exportarIntentoPDF,
  getIntentosEstudiante,
  type SimuladorIntento,
} from '@/services/simuladorFirebase';

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: string };
type QaVerification = {
  session: PublicStationSession;
  checks: Record<string, boolean | Array<Record<string, unknown>>>;
  attempt: null | {
    id: string;
    countableForMinimum: boolean;
    integrityStatus: string;
    scorecardItems: number;
    elapsedSeconds: number;
  };
};

async function qaRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('La sesión docente expiró.');
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
      Authorization: `Bearer ${token}`,
    },
  });
  const payload = await response.json() as ApiEnvelope<T>;
  if (!response.ok || !payload.ok || !payload.data) throw new Error(payload.error || 'Falló la prueba QA.');
  return payload.data;
}

function flattenChecks(checks: QaVerification['checks']) {
  return Object.entries(checks).flatMap(([key, value]) => {
    if (key === 'stationChecks' && Array.isArray(value)) {
      return value.flatMap((station) => Object.entries(station)
        .filter(([stationKey]) => stationKey !== 'key')
        .map(([stationKey, passed]) => ({
          label: `${String(station.key)} · ${stationKey}`,
          passed: passed === true,
        })));
    }
    return [{ label: key, passed: value === true }];
  });
}

export default function StationSimulatorQaPage() {
  const { user, loading } = useAuth();
  const [running, setRunning] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [session, setSession] = useState<PublicStationSession | null>(null);
  const [verification, setVerification] = useState<QaVerification | null>(null);
  const [qaAttempt, setQaAttempt] = useState<SimuladorIntento | null>(null);
  const [error, setError] = useState('');

  const append = (message: string) => setLogs((current) => [...current, message]);

  const runQa = async () => {
    if (!user?.uid || running) return;
    setRunning(true);
    setError('');
    setLogs([]);
    setVerification(null);
    setQaAttempt(null);
    try {
      append('Creando caso sintético con el generador real…');
      const created = await qaRequest<{ session: PublicStationSession }>('/api/simulador-estaciones/sessions', {
        method: 'POST',
        body: JSON.stringify({
          region: 'RODILLA',
          difficulty: 'AVANZADO',
          startingNotes: `${STATION_QA_PREFIX}${Date.now()} · caso desechable`,
        }),
      });
      let working: PublicStationSession = created.session;
      setSession(working);
      append(`Caso creado: ${String(working.visibleCase?.nombre || working.id)}.`);

      for (const station of STATION_KEYS) {
        append(`Completando ${station} mediante la API real…`);
        const result: { session: PublicStationSession } = await qaRequest<{ session: PublicStationSession }>(`/api/simulador-estaciones/sessions/${working.id}`, {
          method: 'PATCH',
          body: JSON.stringify(buildQaStationPatch(working, station as StationKey)),
        });
        working = result.session;
        setSession(working);

        if (station === 'EXAMEN_FISICO') {
          append('Forzando recuperación desde servidor después de dos reconexiones simuladas…');
          const recovered: { session: PublicStationSession } = await qaRequest<{ session: PublicStationSession }>(`/api/simulador-estaciones/sessions/${working.id}`);
          working = recovered.session;
          setSession(working);
          if (working.stations.EXAMEN_FISICO.reconnectCount !== 2) {
            throw new Error('La recuperación no conservó el contador de reconexiones.');
          }
        }
      }

      append('Solicitando evaluación final mediante la cascada real de modelos…');
      const evaluated = await qaRequest<{ session: PublicStationSession }>(`/api/simulador-estaciones/sessions/${working.id}/evaluate`, {
        method: 'POST',
      });
      working = evaluated.session;
      setSession(working);

      append('Verificando sesión, intento, integridad, trazabilidad y scorecard en Firestore…');
      const verified = await qaRequest<QaVerification>(`/api/simulador-estaciones/qa?sessionId=${encodeURIComponent(working.id)}`);
      setVerification(verified);
      setSession(verified.session);

      append('Consultando el historial del usuario con la misma función de la aplicación…');
      const attempts = await getIntentosEstudiante(user.uid, 50);
      const persistedAttempt = attempts.find((item) => item.id === `stations_${working?.id}`) || null;
      setQaAttempt(persistedAttempt);
      if (!persistedAttempt) throw new Error('El intento existe en servidor, pero no apareció en la consulta del historial.');

      const localChecks = validateQaSession(verified.session);
      if (!Object.values(localChecks).every((value) => Array.isArray(value) || value === true)) {
        throw new Error('Una comprobación local del expediente final no fue satisfactoria.');
      }
      const failed = flattenChecks(verified.checks).filter((item) => !item.passed);
      if (failed.length > 0) throw new Error(`Fallaron ${failed.length} comprobaciones persistidas.`);
      append('PRUEBA COMPLETA: todas las comprobaciones terminaron correctamente.');
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
      append(`ERROR: ${String((caught as Error)?.message || caught)}`);
    } finally {
      setRunning(false);
    }
  };

  const cleanup = async () => {
    if (!session?.id || cleaning) return;
    setCleaning(true);
    setError('');
    try {
      await qaRequest<{ cleaned: boolean }>('/api/simulador-estaciones/qa', {
        method: 'DELETE',
        body: JSON.stringify({
          sessionId: session.id,
          confirmation: 'RUN_ISOLATED_STATION_QA',
        }),
      });
      append('Limpieza confirmada: sesión e intento QA eliminados de Firestore.');
      setSession(null);
      setVerification(null);
      setQaAttempt(null);
    } catch (caught) {
      setError(String((caught as Error)?.message || caught));
    } finally {
      setCleaning(false);
    }
  };

  if (loading || !user) return null;
  if (user.role !== 'DOCENTE') {
    return <main className="p-8 text-center font-bold text-rose-700">Acceso docente requerido.</main>;
  }

  const checks = verification ? flattenChecks(verification.checks) : [];

  return (
    <main className="min-h-screen bg-slate-50 px-3 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-5">
        <header className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.2em] text-cyan-300"><FlaskConical className="h-4 w-4" /> Diagnóstico privado</div>
              <h1 className="mt-3 text-3xl font-black">Prueba E2E acelerada</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">Recorre las siete estaciones con datos sintéticos, usa la evaluación real y verifica todo lo persistido. No aparece en el menú de estudiantes.</p>
            </div>
            <Link href="/app/simulador-estaciones" className="rounded-xl bg-white/10 px-4 py-2 text-sm font-bold hover:bg-white/15">Volver al simulador</Link>
          </div>
        </header>

        <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap gap-3">
            <button onClick={() => void runQa()} disabled={running || Boolean(session)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-50">
              {running ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
              {running ? 'Ejecutando proceso completo…' : 'Ejecutar prueba completa'}
            </button>
            {qaAttempt && <button onClick={() => exportarIntentoPDF(qaAttempt)} className="min-h-12 rounded-xl border border-indigo-200 bg-indigo-50 px-5 py-3 text-sm font-black text-indigo-800">Abrir reporte PDF/impresión</button>}
            {session && <button onClick={() => void cleanup()} disabled={cleaning || running} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-black text-rose-700 disabled:opacity-50"><Trash2 className="h-4 w-4" />{cleaning ? 'Eliminando…' : 'Eliminar datos QA'}</button>}
          </div>
          {error && <div className="mt-4 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800"><CircleAlert className="h-5 w-5 shrink-0" />{error}</div>}
        </section>

        <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-black text-slate-900">Ejecución</h2>
            <div className="mt-4 space-y-2" aria-live="polite">
              {logs.length === 0 ? <p className="text-sm text-slate-500">Aún no se ha ejecutado la prueba.</p> : logs.map((line, index) => <p key={`${index}-${line}`} className="rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-700">{line}</p>)}
            </div>
          </section>

          <section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-black text-slate-900">Comprobaciones persistidas</h2>
              {session?.evaluation && <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-black text-emerald-800">{session.evaluation.totalScore}% · nota {session.evaluation.grade}</span>}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {checks.length === 0 ? <p className="text-sm text-slate-500">Los resultados aparecerán al finalizar.</p> : checks.map((check) => (
                <div key={check.label} className={`flex items-start gap-2 rounded-xl border p-3 text-xs ${check.passed ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                  {check.passed ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <CircleAlert className="h-4 w-4 shrink-0" />}
                  <span className="break-all font-semibold">{check.label}</span>
                </div>
              ))}
            </div>
            {verification?.attempt && <div className="mt-4 rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-200">Intento: {verification.attempt.id}<br />Integridad: {verification.attempt.integrityStatus}<br />Scorecard: {verification.attempt.scorecardItems}/9<br />Tiempo sintético persistido: {verification.attempt.elapsedSeconds}s</div>}
          </section>
        </div>
      </div>
    </main>
  );
}
