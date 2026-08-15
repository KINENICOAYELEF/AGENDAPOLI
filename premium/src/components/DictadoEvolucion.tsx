"use client";

import { useRef, useState } from "react";
import { auth } from "@/lib/firebase";

/**
 * DICTADO DE LA EVOLUCIÓN
 *
 * Escribir una evolución toma ocho o diez minutos al final de una jornada de
 * seis pacientes. Esa fricción es la causa real de los borradores sin firmar,
 * y perseguir a quien no registra no la resuelve: hay que hacer que registrar
 * cueste menos.
 *
 * Dictarla toma menos de un minuto y se puede hacer justo después de la
 * sesión, que es cuando se acuerda de todo.
 *
 * Nada se escribe en la ficha sin que ella lo revise: un modelo puede
 * equivocarse en una cifra, y una cifra equivocada en una ficha clínica no es
 * un detalle menor.
 */

export type DictadoPropuesta = {
  sessionGoal: string;
  evaStart: string;
  evaEnd: string;
  interventions: Array<{ category: string; detail: string }>;
  exercises: Array<{ name: string; dose: string }>;
  educationNotes: string;
  responseTolerance: string;
  nextPlan: string;
};

type Props = {
  /** Contexto de la sesión anterior, por si dicta "lo mismo de la vez pasada". */
  contexto?: string;
  onAplicar: (propuesta: DictadoPropuesta) => void;
};

export function DictadoEvolucion({ contexto, onAplicar }: Props) {
  const [estado, setEstado] = useState<'inactivo' | 'grabando' | 'procesando' | 'revision'>('inactivo');
  const [propuesta, setPropuesta] = useState<DictadoPropuesta | null>(null);
  const [transcripcion, setTranscripcion] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const detenerCronometro = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
  };

  const empezar = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        // El micrófono se libera siempre, aunque el envío falle.
        stream.getTracks().forEach(track => track.stop());
        await procesar(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      };

      recorder.start();
      recorderRef.current = recorder;
      setEstado('grabando');
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(previo => previo + 1), 1000);
    } catch (permisoError) {
      console.error('No se pudo acceder al micrófono', permisoError);
      setError('No pude acceder al micrófono. Revisa los permisos del navegador.');
    }
  };

  const detener = () => {
    detenerCronometro();
    recorderRef.current?.stop();
    setEstado('procesando');
  };

  const procesar = async (blob: Blob) => {
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(String(reader.result).split(',')[1] || '');
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const token = await auth.currentUser?.getIdToken();
      const response = await fetch('/api/evolucion/dictado', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ audioBase64: base64, mimeType: blob.type, contexto }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'No se pudo procesar el dictado.');

      setPropuesta(payload.propuesta);
      setTranscripcion(payload.transcripcion || '');
      setEstado('revision');
    } catch (procesarError: any) {
      console.error('Error procesando el dictado', procesarError);
      setError(procesarError?.message || 'No se pudo procesar el dictado. Tu sesión no se perdió: puedes reintentar o escribirla.');
      setEstado('inactivo');
    }
  };

  const aplicar = () => {
    if (!propuesta) return;
    onAplicar(propuesta);
    setEstado('inactivo');
    setPropuesta(null);
    setTranscripcion('');
  };

  const minutos = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

  if (estado === 'revision' && propuesta) {
    const vacio = (value: string) => !value?.trim();
    return (
      <div className="mb-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/40 p-4">
        <h3 className="text-sm font-black text-indigo-900">Esto entendí. Revísalo antes de aplicarlo.</h3>
        <p className="mt-1 text-[11px] text-indigo-700">
          Nada se ha escrito todavía en la ficha. Al aplicar podrás seguir editando cada campo.
        </p>

        <dl className="mt-3 space-y-2 text-xs">
          <Campo label="Molestia o meta de hoy" valor={propuesta.sessionGoal} vacio={vacio(propuesta.sessionGoal)} />
          <Campo label="Dolor al inicio" valor={propuesta.evaStart} vacio={vacio(propuesta.evaStart)} />
          <Campo label="Dolor al final" valor={propuesta.evaEnd} vacio={vacio(propuesta.evaEnd)} />
          {propuesta.interventions.length > 0 && (
            <Campo label="Intervenciones" valor={propuesta.interventions.map(item => item.detail || item.category).join(' · ')} vacio={false} />
          )}
          {propuesta.exercises.length > 0 && (
            <Campo
              label="Ejercicios"
              valor={propuesta.exercises.map(item => `${item.name}${item.dose ? ` (${item.dose})` : ''}`).join(' · ')}
              vacio={false}
            />
          )}
          <Campo label="Educación" valor={propuesta.educationNotes} vacio={vacio(propuesta.educationNotes)} />
          <Campo label="Tolerancia" valor={propuesta.responseTolerance} vacio={vacio(propuesta.responseTolerance)} />
          <Campo label="Plan próxima sesión" valor={propuesta.nextPlan} vacio={vacio(propuesta.nextPlan)} />
        </dl>

        {transcripcion && (
          <details className="mt-3">
            <summary className="cursor-pointer text-[11px] font-bold text-indigo-700">Ver lo que dijiste</summary>
            <p className="mt-1 rounded-xl bg-white p-2 text-[11px] italic text-slate-600">{transcripcion}</p>
          </details>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={aplicar}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black text-white hover:bg-indigo-700"
          >
            Aplicar a la ficha
          </button>
          <button
            type="button"
            onClick={() => { setEstado('inactivo'); setPropuesta(null); }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Descartar y dictar de nuevo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-4">
      {error && (
        <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</p>
      )}

      {estado === 'inactivo' && (
        <button
          type="button"
          onClick={empezar}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 text-sm font-black text-indigo-800 transition hover:border-indigo-500 hover:bg-indigo-50"
        >
          🎙 Dictar esta evolución
          <span className="text-[11px] font-semibold text-indigo-500">— más rápido que escribirla</span>
        </button>
      )}

      {estado === 'grabando' && (
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-rose-300 bg-rose-50 px-4 py-3">
          <span className="flex items-center gap-2 text-sm font-black text-rose-800">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
            Grabando · {minutos}
          </span>
          <button
            type="button"
            onClick={detener}
            className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-black text-white hover:bg-rose-700"
          >
            Listo
          </button>
        </div>
      )}

      {estado === 'procesando' && (
        <div className="rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm font-bold text-indigo-800">
          Ordenando lo que dijiste…
        </div>
      )}
    </div>
  );
}

function Campo({ label, valor, vacio }: { label: string; valor: string; vacio: boolean }) {
  return (
    <div className="flex gap-2">
      <dt className="w-40 shrink-0 font-bold text-slate-500">{label}</dt>
      <dd className={vacio ? 'italic text-slate-400' : 'text-slate-800'}>
        {vacio ? 'no lo mencionaste' : valor}
      </dd>
    </div>
  );
}
