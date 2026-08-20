'use client';

import { useRef, useState } from 'react';
import { Mic, Pause, Save, Sparkles, Trash2 } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { WorkshopEvolution } from '@/lib/adultoMayor/types';

const localDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const empty = (attendanceCount = 0) => ({
  date: localDate(), startTime: '14:30', endTime: '15:45', summary: '', activities: '', dosage: '',
  adaptations: '', groupResponse: '', incidents: '', nextPlan: '', transcription: '', attendanceCount,
});

const transcriptionFields = [
  'summary', 'activities', 'dosage', 'adaptations', 'groupResponse', 'incidents', 'nextPlan', 'transcription',
] as const;

type EvolutionDraft = ReturnType<typeof empty>;
type TranscriptionProposal = Partial<Pick<EvolutionDraft, typeof transcriptionFields[number]>>;

const fieldLabels: Record<typeof transcriptionFields[number], string> = {
  summary: 'Resumen breve',
  activities: 'Actividades realizadas',
  dosage: 'Dosis e intensidad',
  adaptations: 'Adaptaciones',
  groupResponse: 'Respuesta del grupo',
  incidents: 'Síntomas o incidentes',
  nextPlan: 'Próxima sesión',
  transcription: 'Transcripción original',
};

export function WorkshopEvolutionRecorder({ attendanceCount, onSaved }: {
  attendanceCount: number;
  onSaved: (evolution: WorkshopEvolution) => void;
}) {
  const [draft, setDraft] = useState(() => empty(attendanceCount));
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState('');
  const [proposal, setProposal] = useState<TranscriptionProposal | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const update = (key: keyof typeof draft, value: string | number) => setDraft(current => ({ ...current, [key]: value }));

  const begin = async () => {
    setError('');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = event => { if (event.data.size > 0) chunksRef.current.push(event.data); };
      recorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (blob.size > 0) await transcribe(blob);
      };
      recorder.start();
      recorderRef.current = recorder;
      setSeconds(0);
      setRecording(true);
      timerRef.current = setInterval(() => setSeconds(value => value + 1), 1000);
    } catch {
      setError('No pude acceder al micrófono. Revisa el permiso del navegador.');
    }
  };

  const stop = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    setRecording(false);
    setProcessing(true);
    recorderRef.current?.stop();
  };

  const transcribe = async (blob: Blob) => {
    try {
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/adulto-mayor/staff/transcribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audioBase64, mimeType: blob.type }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo ordenar el audio.');
      const safeProposal = Object.fromEntries(
        transcriptionFields
          .filter(key => typeof payload.data?.[key] === 'string')
          .map(key => [key, String(payload.data[key]).trim()]),
      ) as TranscriptionProposal;
      setProposal(safeProposal);
    } catch (transcriptionError: any) {
      setError(transcriptionError?.message || 'No se pudo procesar el audio. Puedes completar el registro manualmente.');
    } finally {
      setProcessing(false);
    }
  };

  const applyProposal = (replaceExisting: boolean) => {
    if (!proposal) return;
    setDraft(current => {
      const next = { ...current };
      transcriptionFields.forEach(key => {
        const suggested = proposal[key]?.trim();
        if (!suggested) return;
        if (replaceExisting || !String(current[key] || '').trim()) next[key] = suggested;
      });
      return { ...next, attendanceCount };
    });
    setProposal(null);
  };

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/adulto-mayor/staff', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ action: 'saveWorkshopEvolution', evolution: { ...draft, attendanceCount } }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar.');
      onSaved(payload.data.evolution);
      setDraft(empty(attendanceCount));
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <header className="bg-slate-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-300">Evolución grupal</p><h2 className="mt-1 text-xl font-black">Registra el taller en menos de un minuto</h2></div>
          {!recording ? (
            <button type="button" onClick={begin} disabled={processing} className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white shadow-lg shadow-rose-950/30 disabled:opacity-40"><Mic className="h-4 w-4" /> Dictar taller</button>
          ) : (
            <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-rose-700"><Pause className="h-4 w-4" /> Terminar · {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</button>
          )}
        </div>
      </header>
      <div className="p-4 sm:p-6">
        {recording && <div className="mb-5 rounded-2xl border border-rose-200 bg-rose-50 p-4"><p className="flex items-center gap-2 text-sm font-black text-rose-800"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" /> Grabando continuamente</p><p className="mt-2 text-xs leading-relaxed text-rose-700">Cuenta: qué hicieron, dosis o tiempos, adaptaciones, respuesta general, incidentes y qué proponen para la próxima sesión.</p></div>}
        {processing && <div className="mb-5 flex items-center gap-3 rounded-2xl bg-indigo-50 p-4 text-sm font-black text-indigo-800"><Sparkles className="h-5 w-5 animate-pulse" /> Ordenando el dictado para que lo revises…</div>}
        {proposal && (
          <div className="mb-5 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-indigo-700" />
              <div>
                <h3 className="text-sm font-black text-indigo-950">Dictado listo para revisar</h3>
                <p className="mt-1 text-xs leading-relaxed text-indigo-800">Nada se ha cambiado todavía. Puedes completar solo los campos vacíos o reemplazar el contenido actual de forma explícita.</p>
              </div>
            </div>
            <div className="mt-4 max-h-64 space-y-2 overflow-auto rounded-xl bg-white/80 p-3">
              {transcriptionFields.filter(key => key !== 'transcription' && proposal[key]).map(key => (
                <div key={key} className="border-b border-indigo-100 pb-2 last:border-0 last:pb-0">
                  <p className="text-[10px] font-black uppercase tracking-wide text-indigo-500">{fieldLabels[key]}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-700">{proposal[key]}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto_auto]">
              <button type="button" onClick={() => applyProposal(false)} className="rounded-xl bg-indigo-700 px-4 py-2.5 text-sm font-black text-white">Completar campos vacíos</button>
              <button type="button" onClick={() => applyProposal(true)} className="rounded-xl border border-indigo-300 bg-white px-4 py-2.5 text-sm font-black text-indigo-800">Reemplazar contenido</button>
              <button type="button" onClick={() => setProposal(null)} className="rounded-xl px-4 py-2.5 text-sm font-black text-slate-500">Descartar</button>
            </div>
          </div>
        )}
        {error && <div className="mb-5 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</div>}
        <div className="grid gap-4 sm:grid-cols-4">
          <label><span className="mb-1 block text-xs font-black text-slate-500">Fecha</span><input type="date" value={draft.date} onChange={event => update('date', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-xs font-black text-slate-500">Inicio</span><input type="time" value={draft.startTime} onChange={event => update('startTime', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-xs font-black text-slate-500">Término</span><input type="time" value={draft.endTime} onChange={event => update('endTime', event.target.value)} className="w-full rounded-xl border border-slate-200 px-3 py-2.5" /></label>
          <label><span className="mb-1 block text-xs font-black text-slate-500">Presentes</span><input readOnly value={attendanceCount} className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 font-black" /></label>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {([
            ['summary', 'Resumen breve', 'Objetivo o foco principal de la sesión'],
            ['activities', 'Actividades realizadas', 'Ejercicios, juegos o circuitos'],
            ['dosage', 'Dosis e intensidad', 'Series, repeticiones, tiempos, pausas o esfuerzo'],
            ['adaptations', 'Adaptaciones', 'Apoyos, variantes o progresiones utilizadas'],
            ['groupResponse', 'Respuesta del grupo', 'Tolerancia, participación y desempeño general'],
            ['incidents', 'Síntomas o incidentes', 'Deja vacío si no hubo'],
            ['nextPlan', 'Próxima sesión', 'Qué mantener, progresar o revisar'],
          ] as const).map(([key, label, placeholder]) => (
            <label key={key} className={key === 'summary' || key === 'activities' ? 'sm:col-span-2' : ''}><span className="mb-1 block text-sm font-black text-slate-800">{label}</span><textarea value={draft[key]} onChange={event => update(key, event.target.value)} placeholder={placeholder} rows={key === 'activities' ? 4 : 3} className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => { setDraft(empty(attendanceCount)); setProposal(null); }} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-black text-slate-600"><Trash2 className="h-4 w-4" /> Limpiar</button>
          <button type="button" onClick={save} disabled={saving || processing || recording} className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40"><Save className="h-4 w-4" /> {saving ? 'Guardando…' : 'Guardar evolución grupal'}</button>
        </div>
      </div>
    </section>
  );
}
