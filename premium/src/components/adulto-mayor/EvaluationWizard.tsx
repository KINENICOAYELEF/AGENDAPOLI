'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Minus,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  ShieldCheck,
  X,
} from 'lucide-react';
import { OlderAdultEvaluation, OlderAdultEvaluationData } from '@/lib/adultoMayor/types';
import { calculateOlderAdultResults, evaluationCompleteness } from '@/lib/adultoMayor/calculations';
import { auth } from '@/lib/firebase';
import { EvaluationReport } from './EvaluationReport';

const steps = [
  { number: 1, short: 'Contexto', title: 'Contexto y objetivos' },
  { number: 2, short: 'Cribados', title: 'Seguridad y autonomía' },
  { number: 3, short: 'Fuerza', title: 'Movilidad y prensión' },
  { number: 4, short: 'Función', title: 'Pruebas funcionales' },
  { number: 5, short: 'Resultado', title: 'Revisión y entrega' },
];

type Props = {
  evaluation: OlderAdultEvaluation;
  previous?: OlderAdultEvaluation;
  onUpdated: (evaluation: OlderAdultEvaluation) => void;
  onClose: () => void;
  scope?: 'PORTAL' | 'STAFF';
};

function ChoiceChips<T extends string>({ value, options, onChange, columns = 2 }: {
  value: T;
  options: Array<{ value: T; label: string; description?: string }>;
  onChange: (value: T) => void;
  columns?: 2 | 3 | 4;
}) {
  const grid = columns === 4 ? 'sm:grid-cols-4' : columns === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2';
  return (
    <div className={`grid grid-cols-2 gap-2 ${grid}`}>
      {options.map(option => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`min-h-12 rounded-xl border px-3 py-2 text-left transition ${value === option.value
            ? 'border-teal-600 bg-teal-600 text-white shadow-sm'
            : 'border-slate-200 bg-white text-slate-700 hover:border-teal-300 hover:bg-teal-50'}`}
        >
          <span className="block text-sm font-black">{option.label}</span>
          {option.description && <span className={`mt-0.5 block text-[10px] ${value === option.value ? 'text-teal-100' : 'text-slate-400'}`}>{option.description}</span>}
        </button>
      ))}
    </div>
  );
}

function ToggleCard({ checked, onChange, title, description }: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  title: string;
  description?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`flex w-full items-start gap-3 rounded-2xl border p-3 text-left transition ${checked
        ? 'border-teal-500 bg-teal-50'
        : 'border-slate-200 bg-white hover:border-slate-300'}`}
    >
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border ${checked ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-300 bg-white'}`}>
        {checked && <Check className="h-4 w-4" />}
      </span>
      <span>
        <strong className="block text-sm text-slate-900">{title}</strong>
        {description && <span className="mt-0.5 block text-xs leading-relaxed text-slate-500">{description}</span>}
      </span>
    </button>
  );
}

function Field({ label, help, children }: { label: string; help?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-black text-slate-800">{label}</span>
      {help && <span className="mb-2 block text-xs leading-relaxed text-slate-500">{help}</span>}
      {children}
    </label>
  );
}

function TextArea({ value, onChange, placeholder, rows = 3 }: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={event => onChange(event.target.value)}
      placeholder={placeholder}
      rows={rows}
      className="w-full resize-y rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-4 focus:ring-teal-100"
    />
  );
}

function NumberInput({ value, onChange, unit, min = 0, max = 999, step = 0.1, disabled = false }: {
  value: number | null;
  onChange: (value: number | null) => void;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        value={value ?? ''}
        disabled={disabled}
        min={min}
        max={max}
        step={step}
        onChange={event => onChange(event.target.value === '' ? null : Number(event.target.value))}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 pr-14 text-base font-bold text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-100 disabled:bg-slate-100 disabled:text-slate-400"
      />
      {unit && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-black text-slate-400">{unit}</span>}
    </div>
  );
}

function StopwatchInput({ value, onChange, maxSeconds = 180, disabled = false }: {
  value: number | null;
  onChange: (value: number | null) => void;
  maxSeconds?: number;
  disabled?: boolean;
}) {
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(0);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      const seconds = (performance.now() - startedAt.current) / 1000;
      setElapsed(seconds);
      if (seconds >= maxSeconds) {
        setRunning(false);
        onChange(Math.round(maxSeconds * 100) / 100);
      }
    }, 40);
    return () => window.clearInterval(interval);
  }, [running, maxSeconds, onChange]);

  const start = () => {
    setElapsed(0);
    startedAt.current = performance.now();
    setRunning(true);
  };
  const stop = () => {
    const final = Math.round(((performance.now() - startedAt.current) / 1000) * 100) / 100;
    setRunning(false);
    setElapsed(final);
    onChange(final);
  };
  return (
    <div className="grid grid-cols-[1fr_auto] gap-2">
      <NumberInput value={running ? Math.round(elapsed * 100) / 100 : value} onChange={onChange} unit="seg" max={maxSeconds} disabled={disabled || running} />
      <button
        type="button"
        disabled={disabled}
        onClick={running ? stop : start}
        className={`flex min-w-24 items-center justify-center gap-2 rounded-xl px-3 text-sm font-black text-white transition disabled:bg-slate-300 ${running ? 'bg-rose-600 hover:bg-rose-700' : 'bg-slate-900 hover:bg-slate-800'}`}
      >
        {running ? <><Pause className="h-4 w-4" /> Detener</> : <><Play className="h-4 w-4" /> Iniciar</>}
      </button>
    </div>
  );
}

function Sts30Counter({ value, onChange, disabled }: { value: number | null; onChange: (value: number | null) => void; disabled: boolean }) {
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(30);
  const [count, setCount] = useState(value || 0);
  const countRef = useRef(value || 0);
  const onChangeRef = useRef(onChange);
  useEffect(() => { onChangeRef.current = onChange; }, [onChange]);
  useEffect(() => { const next = value || 0; setCount(next); countRef.current = next; }, [value]);
  useEffect(() => {
    if (!running) return;
    const interval = window.setInterval(() => {
      setRemaining(current => {
        if (current <= 1) {
          window.clearInterval(interval);
          setRunning(false);
          onChangeRef.current(countRef.current);
          return 0;
        }
        return current - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [running]);

  const start = () => {
    setCount(0);
    countRef.current = 0;
    onChange(0);
    setRemaining(30);
    setRunning(true);
  };
  const increment = () => {
    setCount(current => {
      const next = Math.min(80, current + 1);
      countRef.current = next;
      onChange(next);
      return next;
    });
  };
  return (
    <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-xs font-black uppercase tracking-wider text-indigo-500">Tiempo</span>
          <p className="font-mono text-3xl font-black text-indigo-950">00:{String(remaining).padStart(2, '0')}</p>
        </div>
        <div className="text-right">
          <span className="text-xs font-black uppercase tracking-wider text-indigo-500">Repeticiones</span>
          <p className="text-4xl font-black text-indigo-950">{count}</p>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-[auto_1fr] gap-2">
        <button type="button" onClick={start} disabled={disabled || running} className="flex items-center justify-center gap-2 rounded-xl border border-indigo-200 bg-white px-4 text-sm font-black text-indigo-800 disabled:opacity-40">
          <RotateCcw className="h-4 w-4" /> {value == null ? 'Iniciar' : 'Repetir'}
        </button>
        <button type="button" onClick={increment} disabled={disabled || !running} className="flex min-h-16 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 text-lg font-black text-white shadow-lg shadow-indigo-600/20 disabled:bg-indigo-200">
          <Plus className="h-6 w-6" /> Repetición completa
        </button>
      </div>
      {!running && (
        <div className="mt-2 flex items-center justify-end gap-2">
          <button type="button" onClick={() => { const next = Math.max(0, count - 1); countRef.current = next; setCount(next); onChange(next); }} className="rounded-lg border border-indigo-200 bg-white p-2 text-indigo-800"><Minus className="h-4 w-4" /></button>
          <button type="button" onClick={() => { const next = Math.min(80, count + 1); countRef.current = next; setCount(next); onChange(next); }} className="rounded-lg border border-indigo-200 bg-white p-2 text-indigo-800"><Plus className="h-4 w-4" /></button>
        </div>
      )}
    </div>
  );
}

export function EvaluationWizard({ evaluation, previous, onUpdated, onClose, scope = 'PORTAL' }: Props) {
  const [data, setData] = useState<OlderAdultEvaluationData>(evaluation.data);
  const [step, setStep] = useState(evaluation.step || 1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setData(evaluation.data);
    setStep(evaluation.step || 1);
  }, [evaluation.id]);

  const update = (mutator: (draft: OlderAdultEvaluationData) => void) => {
    setData(current => {
      const draft = structuredClone(current);
      mutator(draft);
      return draft;
    });
  };
  const liveResults = useMemo(
    () => calculateOlderAdultResults({ age: evaluation.participantSnapshot.age, sex: evaluation.participantSnapshot.sex }, data),
    [data, evaluation.participantSnapshot.age, evaluation.participantSnapshot.sex],
  );
  const completeness = useMemo(() => evaluationCompleteness(data), [data]);

  const save = async (targetStep = step, submit = false) => {
    setSaving(true);
    setError('');
    try {
      const token = scope === 'STAFF' ? await auth.currentUser?.getIdToken() : '';
      const response = await fetch(scope === 'STAFF' ? '/api/adulto-mayor/staff' : '/api/adulto-mayor/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          action: scope === 'STAFF'
            ? (submit ? 'submitStaffEvaluation' : 'saveStaffEvaluation')
            : (submit ? 'submitEvaluation' : 'saveEvaluation'),
          evaluationId: evaluation.id,
          data,
          step: targetStep,
        }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo guardar.');
      onUpdated(payload.data.evaluation);
      setStep(targetStep);
      window.setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 30);
      return true;
    } catch (saveError: any) {
      setError(saveError?.message || 'No se pudo guardar.');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveAndClose = async () => {
    if (await save(step)) onClose();
  };

  if (evaluation.status === 'SUBMITTED') {
    return (
      <div className="mx-auto max-w-6xl">
        <button type="button" onClick={onClose} className="am-no-print mb-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">
          <ArrowLeft className="h-4 w-4" /> Volver a mis evaluaciones
        </button>
        <EvaluationReport evaluation={evaluation} previous={previous} mode={scope === 'PORTAL' ? 'RAW' : 'INTERPRETED'} />
      </div>
    );
  }

  const goalOptions = ['Equilibrio', 'Fuerza', 'Movilidad', 'Resistencia', 'Autonomía', 'Confianza para moverse'];

  return (
    <div ref={topRef} className="mx-auto max-w-5xl pb-28">
      <header className="rounded-[28px] bg-slate-950 px-4 py-5 text-white shadow-xl sm:px-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <button type="button" onClick={saveAndClose} disabled={saving} className="mb-3 inline-flex items-center gap-1 text-xs font-bold text-teal-300 hover:text-white disabled:opacity-40"><ArrowLeft className="h-4 w-4" /> Salir y guardar</button>
            <p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-300">Evaluación funcional integral</p>
            <h1 className="mt-1 text-xl font-black sm:text-2xl">{evaluation.participantSnapshot.fullName}</h1>
            <p className="mt-1 text-xs text-slate-400">Borrador con guardado por pasos · Evaluador/a: {evaluation.evaluatorName}</p>
          </div>
          <button type="button" onClick={saveAndClose} disabled={saving} aria-label="Guardar y cerrar" className="rounded-xl bg-white/10 p-2 text-slate-300 hover:bg-white/20 hover:text-white disabled:opacity-40"><X className="h-5 w-5" /></button>
        </div>
        <div className="mt-5 flex gap-1.5">
          {steps.map(item => (
            <button
              key={item.number}
              type="button"
              onClick={() => save(item.number)}
              className={`h-2 flex-1 rounded-full transition ${item.number <= step ? 'bg-teal-400' : 'bg-slate-700'}`}
              aria-label={`Ir a ${item.title}`}
            />
          ))}
        </div>
        <div className="mt-2 flex items-center justify-between text-[11px]">
          <span className="font-black text-white">Paso {step} de 5 · {steps[step - 1].title}</span>
          <span className="text-slate-400">{steps[step - 1].short}</span>
        </div>
      </header>

      {error && <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{error}</div>}

      <main className="mt-4 rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-7">
        {step === 1 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-black text-slate-900">Lo necesario para comprender a la persona</h2>
              <p className="mt-1 text-sm text-slate-500">Registra información útil para la seguridad y los objetivos del taller. No es necesario repetir una ficha médica completa.</p>
            </div>
            <ToggleCard
              checked={data.participantContext.consentConfirmed}
              onChange={value => update(draft => { draft.participantContext.consentConfirmed = value; })}
              title="La persona acepta que se registre esta evaluación"
              description="Confirma verbalmente antes de comenzar."
            />
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label="Enfermedades crónicas relevantes"><TextArea value={data.participantContext.chronicConditions} onChange={value => update(draft => { draft.participantContext.chronicConditions = value; })} placeholder="Ej.: hipertensión, diabetes, artrosis…" /></Field>
              <Field label="¿Se encuentran controladas?"><ChoiceChips value={data.participantContext.chronicConditionsControlled} onChange={value => update(draft => { draft.participantContext.chronicConditionsControlled = value; })} options={[{ value: 'SI', label: 'Sí' }, { value: 'NO', label: 'No' }, { value: 'NO_SABE', label: 'No sabe' }]} columns={3} /></Field>
              <Field label="Medicamentos relevantes"><TextArea value={data.participantContext.medications} onChange={value => update(draft => { draft.participantContext.medications = value; })} placeholder="Nombre o tipo, si lo conoce" /></Field>
              <Field label="Lesiones, cirugías u hospitalizaciones"><TextArea value={[data.participantContext.injuries, data.participantContext.surgeries, data.participantContext.hospitalizationsLastYear].filter(Boolean).join('\n')} onChange={value => update(draft => { draft.participantContext.injuries = value; draft.participantContext.surgeries = ''; draft.participantContext.hospitalizationsLastYear = ''; })} placeholder="Solo lo relevante para la evaluación" /></Field>
              <Field label="Ayudas técnicas o discapacidad"><TextArea value={[data.participantContext.assistiveDevices, data.participantContext.disability].filter(Boolean).join('\n')} onChange={value => update(draft => { draft.participantContext.assistiveDevices = value; draft.participantContext.disability = ''; })} placeholder="Bastón, andador, audífono, adaptación…" /></Field>
              <Field label="Actividad física habitual"><TextArea value={data.participantContext.physicalActivity} onChange={value => update(draft => { draft.participantContext.physicalActivity = value; })} placeholder="Qué hace, frecuencia y duración aproximada" /></Field>
              <Field label="Hábitos nutricionales relevantes"><TextArea value={data.participantContext.nutritionalHabits} onChange={value => update(draft => { draft.participantContext.nutritionalHabits = value; })} placeholder="Pérdida de apetito, comidas, proteína, hidratación…" /></Field>
              <Field label="Música que le gusta"><TextArea value={data.participantContext.preferredMusic} onChange={value => update(draft => { draft.participantContext.preferredMusic = value; })} placeholder="Útil para personalizar los talleres" rows={2} /></Field>
            </div>
            <Field label="¿Qué espera mejorar con el taller?" help="Puedes elegir más de una opción.">
              <div className="flex flex-wrap gap-2">
                {goalOptions.map(goal => {
                  const selected = data.participantContext.goals.includes(goal);
                  return <button key={goal} type="button" onClick={() => update(draft => { draft.participantContext.goals = selected ? draft.participantContext.goals.filter(item => item !== goal) : [...draft.participantContext.goals, goal]; })} className={`rounded-full border px-4 py-2 text-sm font-bold transition ${selected ? 'border-teal-600 bg-teal-600 text-white' : 'border-slate-200 bg-white text-slate-600 hover:border-teal-300'}`}>{goal}</button>;
                })}
              </div>
            </Field>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-7">
            <div><h2 className="text-xl font-black text-slate-900">Cribados breves y comprensibles</h2><p className="mt-1 text-sm text-slate-500">Son señales para orientar una revisión; no entregan diagnósticos.</p></div>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">Lectura y escritura</h3>
              <p className="mt-1 text-xs text-slate-500">Se registra para adaptar indicaciones y materiales, no como puntaje cognitivo.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="¿Puede leer indicaciones simples?"><ChoiceChips value={data.readingAbility} onChange={value => update(draft => { draft.readingAbility = value; })} options={[{ value: 'SI', label: 'Sí' }, { value: 'CON_DIFICULTAD', label: 'Con dificultad' }, { value: 'NO', label: 'No' }]} columns={3} /></Field>
                <Field label="¿Puede escribir datos simples?"><ChoiceChips value={data.writingAbility} onChange={value => update(draft => { draft.writingAbility = value; })} options={[{ value: 'SI', label: 'Sí' }, { value: 'CON_DIFICULTAD', label: 'Con dificultad' }, { value: 'NO', label: 'No' }]} columns={3} /></Field>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">Caídas</h3>
              <div className="mt-4 space-y-3">
                <Field label="Caídas durante los últimos 12 meses"><ChoiceChips value={data.falls.fallsLastYear} onChange={value => update(draft => { draft.falls.fallsLastYear = value; })} options={[{ value: 'NINGUNA', label: 'Ninguna' }, { value: 'UNA', label: 'Una' }, { value: 'DOS_O_MAS', label: 'Dos o más' }]} columns={3} /></Field>
                <div className="grid gap-2 sm:grid-cols-3">
                  <ToggleCard checked={data.falls.fallWithInjury} onChange={value => update(draft => { draft.falls.fallWithInjury = value; })} title="Alguna produjo lesión" />
                  <ToggleCard checked={data.falls.feelsUnsteady} onChange={value => update(draft => { draft.falls.feelsUnsteady = value; })} title="Se siente inestable" />
                  <ToggleCard checked={data.falls.worriesAboutFalling} onChange={value => update(draft => { draft.falls.worriesAboutFalling = value; })} title="Le preocupa caerse" />
                </div>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">FRAIL</h3>
              <p className="mt-1 text-xs text-slate-500">Marca únicamente cuando la respuesta sea afirmativa.</p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                <ToggleCard checked={data.frail.fatigue} onChange={value => update(draft => { draft.frail.fatigue = value; })} title="Fatiga frecuente" />
                <ToggleCard checked={data.frail.resistanceDifficulty} onChange={value => update(draft => { draft.frail.resistanceDifficulty = value; })} title="Dificultad para subir un piso" />
                <ToggleCard checked={data.frail.ambulationDifficulty} onChange={value => update(draft => { draft.frail.ambulationDifficulty = value; })} title="Dificultad para caminar una cuadra" />
                <ToggleCard checked={data.frail.fiveOrMoreIllnesses} onChange={value => update(draft => { draft.frail.fiveOrMoreIllnesses = value; })} title="Cinco o más enfermedades" />
                <ToggleCard checked={data.frail.weightLoss} onChange={value => update(draft => { draft.frail.weightLoss = value; })} title="Pérdida de peso involuntaria" />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">Cognición breve</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Di tres palabras simples, comprueba orientación y pide recordarlas después de una breve distracción.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <ToggleCard checked={data.cognition.memoryConcern} onChange={value => update(draft => { draft.cognition.memoryConcern = value; })} title="La persona o familia refiere problemas de memoria" />
                <Field label="Orientación en fecha"><ChoiceChips value={data.cognition.orientedInDate == null ? '' : data.cognition.orientedInDate ? 'SI' : 'NO'} onChange={value => update(draft => { draft.cognition.orientedInDate = value === 'SI'; })} options={[{ value: 'SI', label: 'Correcta' }, { value: 'NO', label: 'Incorrecta' }]} /></Field>
                <Field label="Orientación en lugar"><ChoiceChips value={data.cognition.orientedInPlace == null ? '' : data.cognition.orientedInPlace ? 'SI' : 'NO'} onChange={value => update(draft => { draft.cognition.orientedInPlace = value === 'SI'; })} options={[{ value: 'SI', label: 'Correcta' }, { value: 'NO', label: 'Incorrecta' }]} /></Field>
                <Field label="Palabras recordadas"><ChoiceChips value={String(data.cognition.recalledWords ?? '')} onChange={value => update(draft => { draft.cognition.recalledWords = Number(value); })} options={['0', '1', '2', '3'].map(value => ({ value, label: value }))} columns={4} /></Field>
              </div>
            </section>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-7">
            <div><h2 className="text-xl font-black text-slate-900">Movilidad funcional y prensión</h2><p className="mt-1 text-sm text-slate-500">Un cribado rápido de miembro superior y tres intentos de prensión por lado.</p></div>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">Movilidad de miembro superior</h3>
              <p className="mt-1 text-xs text-slate-500">Clasifica el movimiento observado. Usa las notas si mediste grados o necesitas precisar.</p>
              <div className="mt-4 space-y-4">
                {([
                  ['shoulderFlexion', 'Flexión de hombro'], ['shoulderAbduction', 'Abducción de hombro'],
                  ['shoulderExternalRotation', 'Rotación externa de hombro'], ['elbowFlexionExtension', 'Flexión y extensión de codo'],
                  ['forearmPronationSupination', 'Pronación y supinación'], ['wristFlexionExtension', 'Flexión y extensión de muñeca'],
                ] as const).map(([key, label]) => (
                  <Field key={key} label={label}>
                    <ChoiceChips value={data.upperLimbMobility[key]} onChange={value => update(draft => { draft.upperLimbMobility[key] = value; })} options={[
                      { value: 'SIN_LIMITACION', label: 'Sin limitación' }, { value: 'LIMITADO', label: 'Limitado' },
                      { value: 'DOLOROSO', label: 'Doloroso' }, { value: 'NO_EVALUADO', label: 'No evaluado' },
                    ]} columns={4} />
                  </Field>
                ))}
                <Field label="Notas de movilidad"><TextArea value={data.upperLimbMobility.notes} onChange={value => update(draft => { draft.upperLimbMobility.notes = value; })} placeholder="Grados, lado, compensaciones o motivo de no evaluación" /></Field>
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div><h3 className="font-black text-slate-900">Prensión manual</h3><p className="mt-1 text-xs text-slate-500">Registra kilogramos. La aplicación utilizará el mejor intento válido.</p></div>
                <div className="min-w-48"><ChoiceChips value={data.tests.grip.dominantHand} onChange={value => update(draft => { draft.tests.grip.dominantHand = value; })} options={[{ value: 'DERECHA', label: 'Diestra' }, { value: 'IZQUIERDA', label: 'Zurda' }, { value: 'AMBIDIESTRA', label: 'Ambidiestra' }]} columns={3} /></div>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2">
                {(['right', 'left'] as const).map(side => (
                  <div key={side} className="rounded-2xl bg-slate-50 p-4">
                    <h4 className="text-sm font-black text-slate-800">Mano {side === 'right' ? 'derecha' : 'izquierda'}</h4>
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {data.tests.grip[side].map((value, index) => (
                        <Field key={index} label={`Intento ${index + 1}`}><NumberInput value={value} onChange={next => update(draft => { draft.tests.grip[side][index] = next; })} unit="kg" max={100} /></Field>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 rounded-xl bg-teal-50 px-4 py-3 text-sm text-teal-900">
                Mejor registro actual: <strong>{liveResults.gripBest ?? '—'} kg</strong>. {liveResults.lowGripStrength == null ? 'Falta edad/sexo o medición para clasificar.' : liveResults.lowGripStrength ? 'Señal de fuerza reducida.' : 'Sin señal de fuerza reducida.'}
              </div>
            </section>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-7">
            <div><h2 className="text-xl font-black text-slate-900">Pruebas funcionales</h2><p className="mt-1 text-sm text-slate-500">Los cronómetros escriben el resultado directamente. También puedes ingresarlo manualmente.</p></div>
            <section className="grid gap-4 rounded-2xl border border-slate-200 p-4 sm:grid-cols-3 sm:p-5">
              <Field label="Talla"><NumberInput value={data.tests.heightCm} onChange={value => update(draft => { draft.tests.heightCm = value; })} unit="cm" min={100} max={230} step={0.1} /></Field>
              <Field label="Peso"><NumberInput value={data.tests.weightKg} onChange={value => update(draft => { draft.tests.weightKg = value; })} unit="kg" min={25} max={250} step={0.1} /></Field>
              <Field label="Altura de la silla" help="Mide desde el piso al asiento."><NumberInput value={data.tests.chairHeightCm} onChange={value => update(draft => { draft.tests.chairHeightCm = value; })} unit="cm" min={30} max={65} step={0.1} /></Field>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">SPPB · Equilibrio</h3>
              <p className="mt-1 text-xs text-slate-500">Registra hasta 10 segundos por posición. Detén si requiere apoyo.</p>
              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <Field label="Pies juntos"><StopwatchInput value={data.tests.sppb.balance.feetTogetherSeconds} onChange={value => update(draft => { draft.tests.sppb.balance.feetTogetherSeconds = value; })} maxSeconds={10} disabled={data.tests.sppb.balance.unable} /></Field>
                <Field label="Semitándem"><StopwatchInput value={data.tests.sppb.balance.semiTandemSeconds} onChange={value => update(draft => { draft.tests.sppb.balance.semiTandemSeconds = value; })} maxSeconds={10} disabled={data.tests.sppb.balance.unable} /></Field>
                <Field label="Tándem"><StopwatchInput value={data.tests.sppb.balance.tandemSeconds} onChange={value => update(draft => { draft.tests.sppb.balance.tandemSeconds = value; })} maxSeconds={10} disabled={data.tests.sppb.balance.unable} /></Field>
              </div>
              <div className="mt-3"><ToggleCard checked={data.tests.sppb.balance.unable} onChange={value => update(draft => { draft.tests.sppb.balance.unable = value; })} title="No pudo iniciar la prueba de equilibrio con seguridad" /></div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">SPPB · Marcha habitual de 4 metros</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <Field label="Intento 1"><StopwatchInput value={data.tests.sppb.gait4m.attempt1Seconds} onChange={value => update(draft => { draft.tests.sppb.gait4m.attempt1Seconds = value; })} disabled={data.tests.sppb.gait4m.unable} /></Field>
                <Field label="Intento 2"><StopwatchInput value={data.tests.sppb.gait4m.attempt2Seconds} onChange={value => update(draft => { draft.tests.sppb.gait4m.attempt2Seconds = value; })} disabled={data.tests.sppb.gait4m.unable} /></Field>
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <input value={data.tests.sppb.gait4m.assistiveDevice || ''} onChange={event => update(draft => { draft.tests.sppb.gait4m.assistiveDevice = event.target.value; })} placeholder="Ayuda técnica utilizada, si corresponde" className="rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500" />
                <ToggleCard checked={data.tests.sppb.gait4m.unable} onChange={value => update(draft => { draft.tests.sppb.gait4m.unable = value; })} title="No pudo realizarla" />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">SPPB · Levantarse cinco veces</h3>
              <p className="mt-1 text-xs text-slate-500">Brazos cruzados, ponerse completamente de pie y volver a sentarse cinco veces lo más rápido posible.</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Tiempo total"><StopwatchInput value={data.tests.sppb.chair5.seconds} onChange={value => update(draft => { draft.tests.sppb.chair5.seconds = value; })} disabled={data.tests.sppb.chair5.unableWithoutArms} /></Field>
                <ToggleCard checked={data.tests.sppb.chair5.unableWithoutArms} onChange={value => update(draft => { draft.tests.sppb.chair5.unableWithoutArms = value; })} title="No pudo completarla sin usar los brazos" />
              </div>
            </section>
            <section className="rounded-2xl border border-slate-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">Timed Up and Go</h3>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <Field label="Tiempo"><StopwatchInput value={data.tests.tugSeconds} onChange={value => update(draft => { draft.tests.tugSeconds = value; })} disabled={data.tests.tugUnable} /></Field>
                <ToggleCard checked={data.tests.tugUnable} onChange={value => update(draft => { draft.tests.tugUnable = value; })} title="No pudo realizarlo con seguridad" />
              </div>
              <input value={data.tests.tugAssistiveDevice || ''} onChange={event => update(draft => { draft.tests.tugAssistiveDevice = event.target.value; })} placeholder="Ayuda técnica utilizada, si corresponde" className="mt-3 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-teal-500" />
            </section>
            <section className="rounded-2xl border border-indigo-200 p-4 sm:p-5">
              <h3 className="font-black text-slate-900">STS30 · Levantarse durante 30 segundos</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">Cuenta repeticiones completas. La potencia se estimará solo si se respetó el protocolo y están registrados talla, peso y altura de silla.</p>
              <div className="mt-4"><Sts30Counter value={data.tests.sts30Repetitions} onChange={value => update(draft => { draft.tests.sts30Repetitions = value; })} disabled={data.tests.sts30UsedArms} /></div>
              <div className="mt-3"><ToggleCard checked={data.tests.sts30UsedArms} onChange={value => update(draft => { draft.tests.sts30UsedArms = value; })} title="Usó los brazos o el protocolo fue modificado" description="El resultado se conserva, pero no se compara con referencias ni se estima potencia." /></div>
              {data.tests.sts30UsedArms && <div className="mt-3"><Field label="Motivo de modificación"><TextArea value={data.tests.testModifiedReason || ''} onChange={value => update(draft => { draft.tests.testModifiedReason = value; })} placeholder="Ej.: necesitó apoyo de brazos por seguridad" rows={2} /></Field></div>}
            </section>
          </div>
        )}

        {step === 5 && (
          <div className="space-y-6">
            <div><h2 className="text-xl font-black text-slate-900">Revisa antes de entregar</h2><p className="mt-1 text-sm text-slate-500">{scope === 'PORTAL' ? 'Comprueba que los valores, ayudas técnicas y pruebas modificadas estén correctamente registrados.' : 'Las categorías son cribados y resultados funcionales. Comprueba especialmente cifras, ayudas y pruebas modificadas.'}</p></div>
            {!completeness.complete && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <strong className="block">Aún faltan datos necesarios</strong>
                <p className="mt-1">{completeness.missing.join(', ')}.</p>
              </div>
            )}
            <EvaluationReport evaluation={{ ...evaluation, data, results: liveResults }} previous={previous} mode={scope === 'PORTAL' ? 'RAW' : 'INTERPRETED'} />
            {scope === 'STAFF' && <Field label="Observaciones finales del evaluador" help="Describe calidad de ejecución, síntomas, apoyos o hechos que ayuden a interpretar los resultados."><TextArea value={data.clinicalObservations} onChange={value => update(draft => { draft.clinicalObservations = value; })} rows={4} /></Field>}
            <div className="rounded-2xl border border-teal-200 bg-teal-50 p-4">
              <div className="flex gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" />
                <div><strong className="text-sm text-teal-950">Al entregar quedará en modo lectura</strong><p className="mt-1 text-xs leading-relaxed text-teal-800">Podrás volver a verla y exportarla. Si una cifra necesita corregirse después, el equipo del taller conservará la trazabilidad del cambio.</p></div>
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 py-3 shadow-[0_-12px_30px_rgba(15,23,42,.08)] backdrop-blur md:left-auto">
        <div className="mx-auto flex max-w-5xl items-center gap-2">
          {step > 1 && <button type="button" disabled={saving} onClick={() => save(step - 1)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"><ArrowLeft className="h-4 w-4" /><span className="hidden sm:inline">Anterior</span></button>}
          <button type="button" disabled={saving} onClick={() => save(step)} className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 disabled:opacity-50"><Save className="h-4 w-4" /><span className="hidden sm:inline">Guardar</span></button>
          {step < 5 ? (
            <button type="button" disabled={saving} onClick={() => save(step + 1)} className="ml-auto inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-black text-white shadow-lg shadow-teal-700/20 disabled:opacity-50 sm:flex-none">{saving ? 'Guardando…' : 'Guardar y continuar'}<ArrowRight className="h-4 w-4" /></button>
          ) : (
            <button type="button" disabled={saving || !completeness.complete} onClick={() => save(5, true)} className="ml-auto inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20 disabled:bg-slate-300 sm:flex-none">{saving ? 'Entregando…' : 'Entregar evaluación'}<CheckCircle2 className="h-4 w-4" /></button>
          )}
        </div>
      </footer>
    </div>
  );
}
