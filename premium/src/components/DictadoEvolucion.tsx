"use client";

import { useRef, useState } from "react";
import { auth } from "@/lib/firebase";

/**
 * DICTADO GUIADO DE LA EVOLUCIÓN
 *
 * Escribir una evolución toma ocho o diez minutos al final de una jornada de
 * seis pacientes. Esa fricción es la causa real de los borradores sin firmar, y
 * perseguir a quien no registra no la resuelve: hay que hacer que registrar
 * cueste menos.
 *
 * Pero decirle a alguien "dicta la evolución" tampoco funciona: es demasiado
 * abierto, no sabe por dónde empezar ni en qué orden, y termina escribiéndola
 * igual. Por eso se pregunta una cosa a la vez.
 *
 * El dictado por pasos tiene además dos ventajas técnicas: cada audio es corto
 * y sobre un solo tema, así que se transcribe mucho mejor; y si un paso sale
 * mal se repite solo ese, sin perder los demás.
 *
 * Nada se escribe en la ficha hasta el final, y la estudiante revisa todo
 * antes: un modelo puede equivocarse en una cifra, y una cifra equivocada en
 * una ficha clínica no es un detalle menor.
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

type PasoDictado = {
  id: string;
  titulo: string;
  ayuda: string;
  ejemplo: string;
  /** El traspaso a colegas no siempre aplica; el resto sí. */
  opcional?: boolean;
};

const PASOS: PasoDictado[] = [
  {
    id: 'estado',
    titulo: '¿Con qué llegó hoy?',
    ayuda: 'Su molestia principal y cuánto dolor tenía al empezar.',
    ejemplo: '"Llegó con dolor de hombro derecho, en 6, le costaba levantar el brazo."',
  },
  {
    id: 'intervenciones',
    titulo: '¿Qué le hiciste tú?',
    ayuda: 'Terapia manual, educación, vendaje, calor o frío. Con su tiempo si lo recuerdas.',
    ejemplo: '"Terapia manual en trapecio unos 10 minutos, y le expliqué cómo hacer las pausas."',
  },
  {
    id: 'ejercicios',
    titulo: '¿Qué ejercicios hizo?',
    ayuda: 'Nombre y dosis: series, repeticiones y carga.',
    ejemplo: '"Elevaciones con banda tres por doce, y sentadilla en silla tres por diez con pesa de 8 kilos."',
  },
  {
    id: 'cierre',
    titulo: '¿Cómo quedó y qué viene?',
    ayuda: 'Dolor al final, cómo toleró, y el plan de la próxima sesión.',
    ejemplo: '"Quedó en 4, toleró bien. La próxima progresamos a carga con mancuerna."',
  },
  {
    id: 'traspaso',
    titulo: '¿Algo para quien la siga?',
    ayuda: 'Implementos, adaptaciones, detalles prácticos. Puedes saltar este paso.',
    ejemplo: '"Necesita los dos ladrillos de espuma en el asiento para la sentadilla."',
    opcional: true,
  },
];

const PROPUESTA_VACIA: DictadoPropuesta = {
  sessionGoal: '', evaStart: '', evaEnd: '',
  interventions: [], exercises: [],
  educationNotes: '', handoffText: '', nextPlan: '', sessionStatus: 'Realizada',
};

type Props = {
  /** Contexto de la sesión anterior, por si dicta "lo mismo de la vez pasada". */
  contexto?: string;
  onAplicar: (propuesta: DictadoPropuesta) => void;
};

export function DictadoEvolucion({ contexto, onAplicar }: Props) {
  const [abierto, setAbierto] = useState(false);
  const [indice, setIndice] = useState(0);
  const [grabando, setGrabando] = useState(false);
  const [procesando, setProcesando] = useState(false);
  const [revisando, setRevisando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const [acumulado, setAcumulado] = useState<DictadoPropuesta>(PROPUESTA_VACIA);
  const [transcripciones, setTranscripciones] = useState<Record<string, string>>({});

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const paso = PASOS[indice];
  const esUltimo = indice === PASOS.length - 1;

  const reiniciar = () => {
    setAbierto(false);
    setIndice(0);
    setAcumulado(PROPUESTA_VACIA);
    setTranscripciones({});
    setRevisando(false);
    setError(null);
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
      setGrabando(true);
      setSegundos(0);
      timerRef.current = setInterval(() => setSegundos(previo => previo + 1), 1000);
    } catch (permisoError) {
      console.error('No se pudo acceder al micrófono', permisoError);
      setError('No pude acceder al micrófono. Revisa los permisos del navegador.');
    }
  };

  const detener = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    recorderRef.current?.stop();
    setGrabando(false);
    setProcesando(true);
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
        body: JSON.stringify({ audioBase64: base64, mimeType: blob.type, contexto, paso: paso.id }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || 'No se pudo procesar.');

      // Cada paso aporta lo suyo sin borrar lo que dictó en los anteriores.
      const nuevo = payload.propuesta as DictadoPropuesta;
      setAcumulado(previo => ({
        sessionGoal: nuevo.sessionGoal || previo.sessionGoal,
        evaStart: nuevo.evaStart || previo.evaStart,
        evaEnd: nuevo.evaEnd || previo.evaEnd,
        interventions: [...previo.interventions, ...nuevo.interventions],
        exercises: [...previo.exercises, ...nuevo.exercises],
        educationNotes: [previo.educationNotes, nuevo.educationNotes].filter(Boolean).join(' '),
        handoffText: [previo.handoffText, nuevo.handoffText].filter(Boolean).join(' '),
        nextPlan: nuevo.nextPlan || previo.nextPlan,
        sessionStatus: nuevo.sessionStatus !== 'Realizada' ? nuevo.sessionStatus : previo.sessionStatus,
      }));
      setTranscripciones(previo => ({ ...previo, [paso.id]: payload.transcripcion || '' }));
      setProcesando(false);

      if (esUltimo) setRevisando(true);
      else setIndice(previo => previo + 1);
    } catch (procesarError: any) {
      console.error('Error procesando el dictado', procesarError);
      setError(procesarError?.message || 'No se pudo procesar. Puedes repetir este paso; lo anterior no se perdió.');
      setProcesando(false);
    }
  };

  const aplicar = () => {
    onAplicar(acumulado);
    reiniciar();
  };

  const minutos = `${Math.floor(segundos / 60)}:${String(segundos % 60).padStart(2, '0')}`;

  // ── Botón de entrada ──────────────────────────────────────────────────────
  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-3 text-sm font-black text-indigo-800 transition hover:border-indigo-500 hover:bg-indigo-50"
      >
        🎙 Dictar esta evolución
        <span className="text-[11px] font-semibold text-indigo-500">— te voy preguntando</span>
      </button>
    );
  }

  // ── Revisión final ────────────────────────────────────────────────────────
  if (revisando) {
    const vacio = (value: string) => !value?.trim();
    return (
      <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-indigo-50/40 p-4">
        <h3 className="text-sm font-black text-indigo-900">Esto entendí. Revísalo antes de aplicarlo.</h3>
        <p className="mt-1 text-[11px] text-indigo-700">
          Todavía no se ha escrito nada en la ficha. Al aplicar podrás seguir editando cada campo,
          y firmar la evolución cuando estés conforme.
        </p>

        <dl className="mt-3 space-y-2 text-xs">
          <Campo label="Molestia o meta de hoy" valor={acumulado.sessionGoal} vacio={vacio(acumulado.sessionGoal)} />
          <Campo label="Dolor al inicio" valor={acumulado.evaStart} vacio={vacio(acumulado.evaStart)} />
          <Campo label="Dolor al final" valor={acumulado.evaEnd} vacio={vacio(acumulado.evaEnd)} />
          {acumulado.interventions.length > 0 && (
            <Campo
              label="Intervenciones"
              valor={acumulado.interventions.map(item =>
                `${item.subType} (${item.category})${item.dose ? ` · ${item.dose}` : ''}`).join(' · ')}
              vacio={false}
            />
          )}
          {acumulado.exercises.length > 0 && (
            <Campo
              label="Ejercicios"
              valor={acumulado.exercises.map(item => {
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
          <Campo label="Educación" valor={acumulado.educationNotes} vacio={vacio(acumulado.educationNotes)} />
          <Campo label="Traspaso a colegas" valor={acumulado.handoffText} vacio={vacio(acumulado.handoffText)} />
          <Campo label="Plan próxima sesión" valor={acumulado.nextPlan} vacio={vacio(acumulado.nextPlan)} />
        </dl>

        <details className="mt-3">
          <summary className="cursor-pointer text-[11px] font-bold text-indigo-700">Ver todo lo que dijiste</summary>
          <div className="mt-1 space-y-1.5">
            {PASOS.map(item => transcripciones[item.id] ? (
              <p key={item.id} className="rounded-xl bg-white p-2 text-[11px] text-slate-600">
                <span className="font-bold text-slate-400">{item.titulo}</span><br />
                <span className="italic">{transcripciones[item.id]}</span>
              </p>
            ) : null)}
          </div>
        </details>

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
            onClick={() => { setRevisando(false); setIndice(0); }}
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50"
          >
            Volver a dictar
          </button>
          <button
            type="button"
            onClick={reiniciar}
            className="rounded-xl px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            Descartar
          </button>
        </div>
      </div>
    );
  }

  // ── Paso a paso ───────────────────────────────────────────────────────────
  return (
    <div className="mb-4 rounded-2xl border-2 border-indigo-300 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-black uppercase tracking-widest text-indigo-500">
          Paso {indice + 1} de {PASOS.length}
        </span>
        <button type="button" onClick={reiniciar} className="text-[11px] font-bold text-slate-400 hover:text-slate-700">
          Cancelar
        </button>
      </div>

      {/* Progreso: saber cuánto falta reduce la sensación de trámite. */}
      <div className="mt-2 flex gap-1">
        {PASOS.map((item, position) => (
          <span
            key={item.id}
            className={`h-1 flex-1 rounded-full ${position < indice ? 'bg-indigo-500' : position === indice ? 'bg-indigo-300' : 'bg-slate-200'}`}
          />
        ))}
      </div>

      <h3 className="mt-3 text-base font-black text-slate-900">{paso.titulo}</h3>
      <p className="mt-1 text-xs text-slate-600">{paso.ayuda}</p>
      <p className="mt-2 rounded-xl bg-slate-50 p-2 text-[11px] italic text-slate-500">
        Por ejemplo: {paso.ejemplo}
      </p>

      {error && (
        <p className="mt-2 rounded-xl bg-rose-50 px-3 py-2 text-[11px] font-semibold text-rose-700">{error}</p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {!grabando && !procesando && (
          <button
            type="button"
            onClick={empezar}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white hover:bg-indigo-700"
          >
            🎙 Hablar
          </button>
        )}

        {grabando && (
          <button
            type="button"
            onClick={detener}
            className="flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-black text-white hover:bg-rose-700"
          >
            <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-white" />
            Listo · {minutos}
          </button>
        )}

        {procesando && (
          <span className="text-sm font-bold text-indigo-700">Anotando lo que dijiste…</span>
        )}

        {!grabando && !procesando && (
          <button
            type="button"
            onClick={() => (esUltimo ? setRevisando(true) : setIndice(previo => previo + 1))}
            className="rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 hover:bg-slate-100"
          >
            {paso.opcional ? 'No aplica, terminar' : 'Saltar este paso'}
          </button>
        )}

        {indice > 0 && !grabando && !procesando && (
          <button
            type="button"
            onClick={() => setIndice(previo => previo - 1)}
            className="rounded-xl px-3 py-2.5 text-xs font-bold text-slate-400 hover:bg-slate-100"
          >
            Volver
          </button>
        )}
      </div>

      {transcripciones[paso.id] && !grabando && !procesando && (
        <p className="mt-3 rounded-xl bg-emerald-50 p-2 text-[11px] text-emerald-900">
          <span className="font-bold">Anotado:</span> {transcripciones[paso.id]}
        </p>
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
