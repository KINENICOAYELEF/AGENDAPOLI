"use client";

import { useRef, useState } from "react";
import { auth } from "@/lib/firebase";

/**
 * DICTADO DE LA EVOLUCIÓN, CON GUION EN PANTALLA
 *
 * Escribir una evolución toma ocho o diez minutos al final de una jornada de
 * seis pacientes. Esa fricción es la causa real de los borradores sin firmar:
 * no es desidia, es que cuesta y se posterga hasta que se olvida.
 *
 * Pero decir solamente "dicta la evolución" tampoco sirve: es demasiado abierto
 * y no se sabe por dónde empezar. Por eso la pantalla va mostrando qué contar,
 * como un apuntador.
 *
 * La grabación es UNA sola y continua. Cortarla en cinco audios costaría cinco
 * llamadas al modelo por evolución —unas 210 al día para siete internas, sobre
 * un modelo que rinde 200— y obligaría a parar y arrancar cinco veces por
 * paciente. Con un audio continuo es una llamada, y se habla seguido.
 *
 * El audio no se guarda en ninguna parte: va del navegador al modelo y se
 * descarta. Solo queda el texto, y solo hasta que ella lo aplica a la ficha.
 */

export type DictadoPropuesta = {
  sessionGoal: string;
  evaStart: string;
  evaEnd: string;
  interventions: Array<{ category: string; subType: string; dose: string; notes: string }>;
  exercises: Array<{ name: string; sets: string; repsOrTime: string; loadKg: string; rest: string; notes: string }>;
  educationNotes: string;
  handoffText: string;
  nextPlan: string;
  sessionStatus: string;
};

/** Lo que la pantalla le va pidiendo contar, sin cortar la grabación. */
const GUION = [
  {
    titulo: 'Cuéntame con qué llegó hoy',
    ayuda: 'Su molestia y cuánto dolor tenía al empezar.',
    ejemplo: 'Llegó con dolor de hombro derecho, en 6, le costaba levantar el brazo…',
  },
  {
    titulo: 'Ahora, qué le hiciste tú',
    ayuda: 'Terapia manual, educación, vendaje, calor o frío.',
    ejemplo: 'Le hice terapia manual en trapecio unos 10 minutos, y le expliqué las pausas…',
  },
  {
    titulo: 'Qué ejercicios hizo',
    ayuda: 'Nombre y dosis: series, repeticiones y carga.',
    ejemplo: 'Elevaciones con banda tres por doce, sentadilla en silla tres por diez con 8 kilos…',
  },
  {
    titulo: 'Cómo quedó y qué viene',
    ayuda: 'Dolor al final, cómo toleró, y el plan de la próxima.',
    ejemplo: 'Quedó en 4, toleró bien. La próxima progresamos a mancuerna…',
  },
  {
    titulo: '¿Algo para quien la siga?',
    ayuda: 'Implementos, adaptaciones, detalles prácticos. Si no aplica, termina aquí.',
    ejemplo: 'Necesita los dos ladrillos de espuma en el asiento…',
  },
];

type Props = {
  /** Contexto de la sesión anterior, por si dicta "lo mismo de la vez pasada". */
  contexto?: string;
  onAplicar: (propuesta: DictadoPropuesta) => void;
};

export function DictadoEvolucion({ contexto, onAplicar }: Props) {
  const [estado, setEstado] = useState<'inactivo' | 'grabando' | 'procesando' | 'revision'>('inactivo');
  const [indice, setIndice] = useState(0);
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [propuesta, setPropuesta] = useState<DictadoPropuesta | null>(null);
  const [transcripcion, setTranscripcion] = useState('');

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const paso = GUION[indice];
  const esUltimo = indice === GUION.length - 1;

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
        // El micrófono se libera siempre, aunque el envío falle después.
        stream.getTracks().forEach(track => track.stop());
        await procesar(new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' }));
      };

      recorder.start();
      recorderRef.current = recorder;
      setEstado('grabando');
      setIndice(0);
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(previo => previo + 1), 1000);
    } catch (permisoError) {
      console.error('No se pudo acceder al micrófono', permisoError);
      setError('No pude acceder al micrófono. Revisa los permisos del navegador.');
    }
  };

  const terminar = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    setEstado('procesando');
  };

  const cancelar = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    // Se descartan los fragmentos antes de detener para no procesar nada.
    chunksRef.current = [];
    recorderRef.current?.stop();
    setEstado('inactivo');
    setIndice(0);
  };

  const procesar = async (blob: Blob) => {
    if (blob.size === 0) { setEstado('inactivo'); return; }
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
      setError(procesarError?.message || 'No se pudo procesar. Puedes volver a dictarla o escribirla a mano.');
      setEstado('inactivo');
    }
  };

  const aplicar = () => {
    if (!propuesta) return;
    onAplicar(propuesta);
    setEstado('inactivo');
    setPropuesta(null);
    setTranscripcion('');
    setIndice(0);
  };

  const reloj = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

  // ── Revisión: nada llega a la ficha antes de esto ─────────────────────────
  if (estado === 'revision' && propuesta) {
    const vacio = (value: string) => !value?.trim();
    return (
      <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-indigo-50/40 p-4">
        <h3 className="text-sm font-black text-indigo-900">Esto entendí. Revísalo antes de aplicarlo.</h3>
        <p className="mt-1 text-[11px] text-indigo-700">
          Todavía no se ha escrito nada en la ficha. Al aplicar podrás editar cada campo y firmar cuando estés conforme.
        </p>

        <dl className="mt-3 space-y-2 text-xs">
          <Campo label="Molestia o meta de hoy" valor={propuesta.sessionGoal} vacio={vacio(propuesta.sessionGoal)} />
          <Campo label="Dolor al inicio" valor={propuesta.evaStart} vacio={vacio(propuesta.evaStart)} />
          <Campo label="Dolor al final" valor={propuesta.evaEnd} vacio={vacio(propuesta.evaEnd)} />
          {propuesta.interventions.length > 0 && (
            <Campo
              label="Intervenciones"
              valor={propuesta.interventions.map(item =>
                `${item.subType} (${item.category})${item.dose ? ` · ${item.dose}` : ''}`).join(' · ')}
              vacio={false}
            />
          )}
          {propuesta.exercises.length > 0 && (
            <Campo
              label="Ejercicios"
              valor={propuesta.exercises.map(item => {
                const dosis = [
                  item.sets && `${item.sets} series`,
                  item.repsOrTime,
                  item.loadKg && `${item.loadKg} kg`,
                ].filter(Boolean).join(' × ');
                return `${item.name}${dosis ? ` (${dosis})` : ''}`;
              }).join(' · ')}
              vacio={false}
            />
          )}
          <Campo label="Educación" valor={propuesta.educationNotes} vacio={vacio(propuesta.educationNotes)} />
          <Campo label="Traspaso a colegas" valor={propuesta.handoffText} vacio={vacio(propuesta.handoffText)} />
          <Campo label="Plan próxima sesión" valor={propuesta.nextPlan} vacio={vacio(propuesta.nextPlan)} />
          {propuesta.sessionStatus && propuesta.sessionStatus !== 'Realizada' && (
            <Campo label="Estado de la sesión" valor={propuesta.sessionStatus} vacio={false} />
          )}
        </dl>

        {transcripcion && (
          // Permite comprobar si una cifra se entendió mal, que es el riesgo real.
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
            onClick={() => { setPropuesta(null); setEstado('inactivo'); }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Descartar y dictar de nuevo
          </button>
        </div>
      </div>
    );
  }

  // ── Grabando: la pantalla es el apuntador ────────────────────────────────
  if (estado === 'grabando') {
    return (
      <div className="mb-4 rounded-2xl border-2 border-rose-300 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-xs font-black text-rose-700">
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-rose-600" />
            Grabando · {reloj}
          </span>
          <button type="button" onClick={cancelar} className="text-[11px] font-bold text-slate-400 hover:text-slate-700">
            Cancelar
          </button>
        </div>

        <div className="mt-2 flex gap-1">
          {GUION.map((_, position) => (
            <span
              key={position}
              className={`h-1 flex-1 rounded-full ${position <= indice ? 'bg-rose-500' : 'bg-slate-200'}`}
            />
          ))}
        </div>

        <h3 className="mt-4 text-lg font-black text-slate-900">{paso.titulo}</h3>
        <p className="mt-1 text-sm text-slate-600">{paso.ayuda}</p>
        <p className="mt-3 rounded-xl bg-slate-50 p-3 text-sm italic text-slate-500">&ldquo;{paso.ejemplo}&rdquo;</p>

        <p className="mt-3 text-[11px] font-semibold text-rose-600">
          No pares de hablar: la grabación sigue corriendo entre pregunta y pregunta.
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          {!esUltimo ? (
            <button
              type="button"
              onClick={() => setIndice(previo => previo + 1)}
              className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800"
            >
              Siguiente →
            </button>
          ) : null}
          <button
            type="button"
            onClick={terminar}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-black text-white hover:bg-emerald-700"
          >
            Terminar dictado
          </button>
        </div>
      </div>
    );
  }

  // ── Procesando ───────────────────────────────────────────────────────────
  if (estado === 'procesando') {
    return (
      <div className="mb-4 rounded-2xl border-2 border-indigo-200 bg-indigo-50/50 px-4 py-3 text-sm font-bold text-indigo-800">
        Ordenando lo que dijiste…
      </div>
    );
  }

  // ── Entrada ──────────────────────────────────────────────────────────────
  return (
    <div className="mb-4">
      {error && (
        <p className="mb-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</p>
      )}
      <button
        type="button"
        onClick={empezar}
        className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 text-sm font-black text-indigo-800 transition hover:border-indigo-500 hover:bg-indigo-50"
      >
        🎙 Dictar esta evolución
        <span className="text-[11px] font-semibold text-indigo-500">— te voy guiando en pantalla</span>
      </button>
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
