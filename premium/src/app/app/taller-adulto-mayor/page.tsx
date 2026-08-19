'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity, Check, ClipboardCheck, Copy, FileText,
  Link2, LoaderCircle, Mic2, Pencil, Plus, RefreshCw, RotateCcw, Search,
  ShieldCheck, UserRound, UsersRound, X,
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import {
  ExternalEvaluator, OlderAdultEvaluation, OlderAdultParticipant, WorkshopAttendance, WorkshopEvolution,
} from '@/lib/adultoMayor/types';
import { EvaluationWizard } from '@/components/adulto-mayor/EvaluationWizard';
import { WorkshopEvolutionRecorder } from '@/components/adulto-mayor/WorkshopEvolutionRecorder';

type Tab = 'HOY' | 'PERSONAS' | 'EVALUACIONES' | 'REGISTRO' | 'ACCESOS';
type Reassessment = {
  participantId: string;
  participantName: string;
  lastEvaluationAt: string | null;
  daysSince: number | null;
  status: 'SIN_EVALUACION' | 'PROXIMA' | 'VENCIDA' | 'AL_DIA';
};
type EvaluatorRow = Omit<ExternalEvaluator, 'tokenHash'> & { evaluationCount: number };
type DashboardData = {
  participants: OlderAdultParticipant[];
  evaluations: OlderAdultEvaluation[];
  attendance: WorkshopAttendance[];
  workshopEvolutions: WorkshopEvolution[];
  evaluators: EvaluatorRow[];
  reassessment: Reassessment[];
  portalUrl: string;
  schedule: { days: string[]; startTime: string; endTime: string };
};

const chileDate = () => new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit',
}).format(new Date());

const shortDate = (value?: string | null) => value
  ? new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'America/Santiago' }).format(new Date(value.length === 10 ? `${value}T12:00:00` : value))
  : 'Sin registro';

const emptyParticipant = (): Partial<OlderAdultParticipant> => ({
  fullName: '', rut: '', birthDate: '', sex: 'NO_ESPECIFICA', nationality: '', phone: '',
  emergencyContact: '', educationLevel: '', occupation: '', address: '', commune: '', supportNetwork: '',
  readingAbility: 'SI', writingAbility: 'SI', active: true,
});

async function staffRequest(body?: unknown) {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/adulto-mayor/staff', {
    method: body ? 'POST' : 'GET',
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), Authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo completar la acción.');
  return payload.data;
}

function ParticipantDialog({ initial, onClose, onSaved }: {
  initial?: OlderAdultParticipant;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<Partial<OlderAdultParticipant>>(() => initial || emptyParticipant());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const update = (key: keyof OlderAdultParticipant, value: unknown) => setForm(current => ({ ...current, [key]: value }));
  const save = async () => {
    setSaving(true); setError('');
    try {
      await staffRequest({ action: 'saveParticipant', participant: form });
      onSaved();
    } catch (reason: any) {
      setError(reason?.message || 'No se pudo guardar.');
    } finally { setSaving(false); }
  };
  const fields: Array<[keyof OlderAdultParticipant, string, string]> = [
    ['fullName', 'Nombre completo *', 'text'], ['rut', 'RUT', 'text'], ['birthDate', 'Fecha de nacimiento', 'date'],
    ['phone', 'Teléfono', 'tel'], ['commune', 'Comuna', 'text'], ['nationality', 'Nacionalidad', 'text'],
    ['educationLevel', 'Escolaridad', 'text'], ['occupation', 'Ocupación', 'text'],
    ['emergencyContact', 'Contacto de emergencia', 'text'], ['address', 'Dirección', 'text'],
  ];
  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-slate-950/55 p-0 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true">
      <div className="max-h-[94dvh] w-full max-w-3xl overflow-auto rounded-t-[30px] bg-white shadow-2xl sm:rounded-[30px]">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/95 px-5 py-4 backdrop-blur">
          <div><p className="text-[10px] font-black uppercase tracking-[.18em] text-emerald-600">Ficha del taller</p><h2 className="text-xl font-black text-slate-950">{initial ? 'Editar persona' : 'Nueva persona mayor'}</h2></div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="rounded-full bg-slate-100 p-2.5 text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          {fields.map(([key, label, type]) => <label key={key} className={key === 'address' ? 'sm:col-span-2' : ''}><span className="mb-1.5 block text-xs font-black text-slate-600">{label}</span><input type={type} value={String(form[key] || '')} onChange={event => update(key, event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100" /></label>)}
          <label><span className="mb-1.5 block text-xs font-black text-slate-600">Sexo registrado</span><select value={form.sex || 'NO_ESPECIFICA'} onChange={event => update('sex', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="MUJER">Mujer</option><option value="HOMBRE">Hombre</option><option value="NO_ESPECIFICA">No especifica</option></select></label>
          <label><span className="mb-1.5 block text-xs font-black text-slate-600">¿Lee?</span><select value={form.readingAbility || 'SI'} onChange={event => update('readingAbility', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="SI">Sí</option><option value="CON_DIFICULTAD">Con dificultad</option><option value="NO">No</option></select></label>
          <label><span className="mb-1.5 block text-xs font-black text-slate-600">¿Escribe?</span><select value={form.writingAbility || 'SI'} onChange={event => update('writingAbility', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3"><option value="SI">Sí</option><option value="CON_DIFICULTAD">Con dificultad</option><option value="NO">No</option></select></label>
          <label className="sm:col-span-2"><span className="mb-1.5 block text-xs font-black text-slate-600">Red de apoyo</span><textarea rows={3} value={form.supportNetwork || ''} onChange={event => update('supportNetwork', event.target.value)} className="w-full rounded-2xl border border-slate-200 px-4 py-3" /></label>
          {error && <p className="sm:col-span-2 rounded-2xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p>}
        </div>
        <div className="sticky bottom-0 flex gap-3 border-t border-slate-100 bg-white px-5 py-4"><button type="button" onClick={onClose} className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 font-black text-slate-600">Cancelar</button><button type="button" onClick={save} disabled={saving || !form.fullName} className="flex-[1.6] rounded-2xl bg-emerald-600 px-4 py-3 font-black text-white shadow-lg shadow-emerald-600/20 disabled:opacity-40">{saving ? 'Guardando…' : 'Guardar persona'}</button></div>
      </div>
    </div>
  );
}

export default function TallerAdultoMayorPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [tab, setTab] = useState<Tab>('HOY');
  const [attendanceDate, setAttendanceDate] = useState(chileDate());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState<OlderAdultParticipant | 'NEW' | null>(null);
  const [selectedEvaluation, setSelectedEvaluation] = useState<OlderAdultEvaluation | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setError('');
    try { setData(await staffRequest()); }
    catch (reason: any) { setError(reason?.message || 'No se pudo cargar el taller.'); }
    finally { if (!quiet) setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const attendanceMap = useMemo(() => new Map((data?.attendance || []).filter(item => item.date === attendanceDate).map(item => [item.participantId, item.status])), [data, attendanceDate]);
  const presentCount = [...attendanceMap.values()].filter(status => status === 'PRESENTE').length;
  const visibleParticipants = useMemo(() => (data?.participants || []).filter(person => `${person.fullName} ${person.rut || ''}`.toLowerCase().includes(query.toLowerCase())), [data, query]);
  const due = (data?.reassessment || []).filter(item => item.status === 'VENCIDA' || item.status === 'SIN_EVALUACION');
  const previousEvaluation = useMemo(() => selectedEvaluation
    ? (data?.evaluations || [])
        .filter(item => item.participantId === selectedEvaluation.participantId && item.id !== selectedEvaluation.id && item.status === 'SUBMITTED')
        .sort((a, b) => (b.submittedAt || b.updatedAt).localeCompare(a.submittedAt || a.updatedAt))[0]
    : undefined, [data, selectedEvaluation]);

  const act = async (body: unknown, success?: string) => {
    setError(''); setMessage('');
    try { const result = await staffRequest(body); if (success) setMessage(success); await load(true); return result; }
    catch (reason: any) { setError(reason?.message || 'No se pudo completar.'); throw reason; }
  };
  const setAttendance = async (participantId: string, status: 'PRESENTE' | 'AUSENTE') => {
    setBusyId(participantId);
    setError('');
    try {
      const result = await staffRequest({ action: 'setAttendance', date: attendanceDate, participantId, status });
      setData(current => current ? {
        ...current,
        attendance: [
          result.attendance,
          ...current.attendance.filter(item => item.id !== result.attendance.id),
        ],
      } : current);
    } catch (reason: any) {
      setError(reason?.message || 'No se pudo guardar la asistencia.');
    }
    finally { setBusyId(''); }
  };
  const copy = async (value: string, label: string) => { await navigator.clipboard.writeText(value); setMessage(`${label} copiado.`); };
  const startEvaluation = async (participantId: string) => {
    setBusyId(`eval-${participantId}`); setError('');
    try {
      const result = await staffRequest({ action: 'startStaffEvaluation', participantId });
      setData(current => current ? { ...current, evaluations: [result.evaluation, ...current.evaluations.filter(item => item.id !== result.evaluation.id)] } : current);
      setSelectedEvaluation(result.evaluation);
    } catch (reason: any) { setError(reason?.message || 'No se pudo iniciar la evaluación.'); }
    finally { setBusyId(''); }
  };
  const openEvaluation = (evaluation: OlderAdultEvaluation) => {
    if (evaluation.status === 'DRAFT' && evaluation.evaluatorId !== auth.currentUser?.uid) {
      setError(`El borrador de ${evaluation.participantSnapshot.fullName} pertenece a ${evaluation.evaluatorName}.`);
      return;
    }
    setSelectedEvaluation(evaluation);
  };

  if (selectedEvaluation) return <EvaluationWizard scope="STAFF" evaluation={selectedEvaluation} previous={previousEvaluation} onUpdated={evaluation => { setSelectedEvaluation(evaluation); setData(current => current ? { ...current, evaluations: [evaluation, ...current.evaluations.filter(item => item.id !== evaluation.id)] } : current); }} onClose={() => { setSelectedEvaluation(null); void load(true); }} />;
  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><div className="text-center"><LoaderCircle className="mx-auto h-10 w-10 animate-spin text-emerald-600" /><p className="mt-3 text-sm font-bold text-slate-500">Preparando el taller…</p></div></div>;

  const tabs: Array<[Tab, string, React.ReactNode]> = [
    ['HOY', 'Asistencia', <ClipboardCheck key="a" className="h-4 w-4" />], ['PERSONAS', 'Personas', <UsersRound key="p" className="h-4 w-4" />],
    ['EVALUACIONES', 'Evaluaciones', <Activity key="e" className="h-4 w-4" />], ['REGISTRO', 'Registrar taller', <Mic2 key="r" className="h-4 w-4" />],
    ['ACCESOS', 'Accesos externos', <Link2 key="l" className="h-4 w-4" />],
  ];

  return (
    <div className="mx-auto max-w-7xl pb-20">
      <section className="relative overflow-hidden rounded-[30px] bg-[linear-gradient(125deg,#052e2b_0%,#065f55_55%,#0f766e_100%)] px-5 py-6 text-white shadow-xl shadow-teal-950/10 sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-teal-300/15 blur-2xl" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div><div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-black uppercase tracking-[.18em]"><Activity className="h-3.5 w-3.5" /> Polideportivo</div><h1 className="max-w-2xl text-3xl font-black tracking-tight sm:text-4xl">Taller de Adulto Mayor</h1><p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-teal-50/80">Asistencia, evaluaciones funcionales, seguimiento y registro de sesiones.</p></div>
          <div className="grid grid-cols-3 gap-2"><div className="rounded-2xl bg-white/10 p-3 text-center"><strong className="block text-2xl font-black">{data?.participants.length || 0}</strong><span className="text-[10px] font-bold text-teal-100">Personas</span></div><div className="rounded-2xl bg-white/10 p-3 text-center"><strong className="block text-2xl font-black">{presentCount}</strong><span className="text-[10px] font-bold text-teal-100">Presentes</span></div><div className="rounded-2xl bg-white/10 p-3 text-center"><strong className="block text-2xl font-black">{due.length}</strong><span className="text-[10px] font-bold text-teal-100">A revisar</span></div></div>
        </div>
      </section>

      <nav className="sticky top-0 z-30 -mx-4 mt-4 overflow-x-auto border-y border-slate-200 bg-slate-100/90 px-4 py-2 backdrop-blur sm:mx-0 sm:rounded-2xl sm:border sm:bg-white sm:p-2" aria-label="Secciones del taller"><div className="flex min-w-max gap-1">{tabs.map(([value, label, icon]) => <button key={value} type="button" onClick={() => setTab(value)} className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-black transition ${tab === value ? 'bg-slate-950 text-white shadow-md' : 'text-slate-500 hover:bg-slate-100'}`}>{icon}{label}</button>)}</div></nav>

      {(error || message) && <div className={`mt-4 rounded-2xl border p-4 text-sm font-bold ${error ? 'border-rose-200 bg-rose-50 text-rose-700' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{error || message}</div>}

      {tab === 'HOY' && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-col gap-3 border-b border-slate-100 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-[10px] font-black uppercase tracking-[.16em] text-emerald-600">Martes y jueves · 14:30–15:45</p><h2 className="text-2xl font-black text-slate-950">Asistencia del taller</h2></div><input type="date" value={attendanceDate} onChange={event => setAttendanceDate(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-2.5 font-bold" /></header>
          <div className="divide-y divide-slate-100">{data?.participants.map(person => { const status = attendanceMap.get(person.id); return <div key={person.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 flex-1 items-center gap-3"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${status === 'PRESENTE' ? 'bg-emerald-100 text-emerald-700' : status === 'AUSENTE' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500'}`}>{status === 'PRESENTE' ? <Check className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}</div><div className="min-w-0"><p className="truncate font-black text-slate-900">{person.fullName}</p><p className="text-xs font-medium text-slate-500">{person.age ? `${person.age} años` : 'Edad no registrada'} · {status ? (status === 'PRESENTE' ? 'Presente' : 'Ausente') : 'Sin marcar'}</p></div></div><div className="grid grid-cols-2 gap-2"><button type="button" disabled={busyId === person.id} onClick={() => setAttendance(person.id, 'PRESENTE')} className={`rounded-xl px-4 py-2.5 text-sm font-black ${status === 'PRESENTE' ? 'bg-emerald-600 text-white' : 'border border-emerald-200 bg-emerald-50 text-emerald-700'}`}>Presente</button><button type="button" disabled={busyId === person.id} onClick={() => setAttendance(person.id, 'AUSENTE')} className={`rounded-xl px-4 py-2.5 text-sm font-black ${status === 'AUSENTE' ? 'bg-rose-600 text-white' : 'border border-rose-200 bg-rose-50 text-rose-700'}`}>Ausente</button></div></div>; })}{!data?.participants.length && <p className="p-8 text-center text-sm font-bold text-slate-500">Agrega personas para comenzar a marcar asistencia.</p>}</div>
        </section>
        <aside className="space-y-5"><div className="rounded-[26px] border border-amber-200 bg-amber-50 p-5"><div className="flex items-start gap-3"><RefreshCw className="mt-1 h-5 w-5 shrink-0 text-amber-700" /><div><h3 className="font-black text-amber-950">Reevaluaciones pendientes</h3><p className="mt-1 text-xs leading-relaxed text-amber-800">La ventana sugerida es cada 4–6 semanas. Aquí aparecen quienes no tienen evaluación o superaron 6 semanas.</p></div></div><div className="mt-4 space-y-2">{due.slice(0, 8).map(item => <button type="button" key={item.participantId} disabled={busyId === `eval-${item.participantId}`} onClick={() => startEvaluation(item.participantId)} className="w-full rounded-2xl bg-white p-3 text-left shadow-sm disabled:opacity-50"><p className="text-sm font-black text-slate-900">{item.participantName}</p><p className="text-xs font-bold text-amber-700">{item.status === 'SIN_EVALUACION' ? 'Iniciar evaluación' : `${item.daysSince} días · iniciar reevaluación`}</p></button>)}{!due.length && <p className="rounded-2xl bg-white p-3 text-sm font-bold text-emerald-700">Todo al día.</p>}</div></div><button type="button" onClick={() => setTab('REGISTRO')} className="flex w-full items-center justify-between rounded-[24px] bg-slate-950 p-5 text-left text-white shadow-lg"><div><p className="text-xs font-bold text-teal-300">Al terminar la sesión</p><p className="mt-1 text-lg font-black">Dictar evolución grupal</p></div><Mic2 className="h-7 w-7" /></button></aside>
      </div>}

      {tab === 'PERSONAS' && <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="text-2xl font-black text-slate-950">Personas del taller</h2><p className="text-sm text-slate-500">Una ficha simple, independiente del expediente clínico habitual.</p></div><button type="button" onClick={() => setEditing('NEW')} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white"><Plus className="h-4 w-4" /> Agregar persona</button></div><div className="relative mt-5"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar por nombre o RUT" className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4" /></div><div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{visibleParticipants.map(person => <article key={person.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-black text-slate-900">{person.fullName}</p><p className="mt-1 text-xs font-medium text-slate-500">{person.rut || 'Sin RUT'} · {person.age ? `${person.age} años` : 'Edad no registrada'}</p></div><button type="button" onClick={() => setEditing(person)} aria-label={`Editar ${person.fullName}`} className="rounded-xl bg-slate-100 p-2 text-slate-600"><Pencil className="h-4 w-4" /></button></div><div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-black uppercase"><span className="rounded-full bg-sky-50 px-2.5 py-1 text-sky-700">Lee: {person.readingAbility === 'SI' ? 'sí' : person.readingAbility === 'NO' ? 'no' : 'con dificultad'}</span><span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">Escribe: {person.writingAbility === 'SI' ? 'sí' : person.writingAbility === 'NO' ? 'no' : 'con dificultad'}</span></div><button type="button" onClick={() => startEvaluation(person.id)} disabled={busyId === `eval-${person.id}`} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-xs font-black text-teal-800 disabled:opacity-40"><Activity className="h-4 w-4" /> Evaluar o reevaluar</button></article>)}</div></section>}

      {tab === 'EVALUACIONES' && <section className="mt-5 rounded-[26px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><h2 className="text-2xl font-black text-slate-950">Evaluaciones funcionales</h2><p className="text-sm text-slate-500">Resultados, perfil funcional y seguimiento a 4–6 semanas.</p></div><div className="flex gap-2"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar persona" className="rounded-xl border border-slate-200 py-2.5 pl-10 pr-3" /></div><button type="button" onClick={() => setTab('PERSONAS')} className="rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-black text-white">Nueva</button></div></div><div className="mt-5 space-y-3">{(data?.evaluations || []).filter(item => item.participantSnapshot.fullName.toLowerCase().includes(query.toLowerCase())).map(item => <button type="button" key={item.id} onClick={() => openEvaluation(item)} className="flex w-full flex-col gap-3 rounded-2xl border border-slate-200 p-4 text-left transition hover:border-emerald-300 hover:shadow-md sm:flex-row sm:items-center"><div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${item.status === 'SUBMITTED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}><FileText className="h-5 w-5" /></div><div className="min-w-0 flex-1"><p className="font-black text-slate-900">{item.participantSnapshot.fullName}</p><p className="text-xs font-medium text-slate-500">{item.evaluatorName} · {shortDate(item.submittedAt || item.updatedAt)}</p></div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${item.status === 'SUBMITTED' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{item.status === 'SUBMITTED' ? 'Finalizada' : `Borrador · paso ${item.step}`}</span>{item.status === 'SUBMITTED' && <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-700">SPPB {item.results.sppbTotal}/12</span>}</div></button>)}{!data?.evaluations.length && <p className="py-10 text-center text-sm font-bold text-slate-500">Aún no hay evaluaciones.</p>}</div></section>}

      {tab === 'REGISTRO' && <div className="mt-5 space-y-5"><WorkshopEvolutionRecorder attendanceCount={presentCount} onSaved={() => { setMessage('Evolución grupal guardada.'); void load(true); }} /><section className="rounded-[26px] border border-slate-200 bg-white p-5"><h2 className="text-xl font-black text-slate-950">Historial del taller</h2><div className="mt-4 space-y-3">{data?.workshopEvolutions.map(item => <article key={item.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-black text-slate-900">{shortDate(item.date)} · {item.attendanceCount} presentes</p><span className="text-xs font-bold text-slate-500">{item.startTime}–{item.endTime}</span></div><p className="mt-2 text-sm font-bold text-slate-700">{item.summary}</p><p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-slate-500">{item.activities}</p></article>)}{!data?.workshopEvolutions.length && <p className="text-sm font-bold text-slate-500">Todavía no hay sesiones registradas.</p>}</div></section></div>}

      {tab === 'ACCESOS' && <div className="mt-5 grid gap-5 lg:grid-cols-[1fr_1.3fr]"><section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700"><Link2 className="h-6 w-6" /></div><h2 className="mt-4 text-xl font-black text-slate-950">Enlace general para evaluar</h2><p className="mt-2 text-sm leading-relaxed text-slate-500">Compártelo con los alumnos. Cada uno se identifica una vez, elige a la persona y completa su evaluación. No necesitas crear cuentas ni asignaciones.</p><div className="mt-4 break-all rounded-2xl bg-slate-50 p-3 font-mono text-xs text-slate-600">{data?.portalUrl}</div><button type="button" onClick={() => copy(data?.portalUrl || '', 'Enlace general')} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-black text-white"><Copy className="h-4 w-4" /> Copiar enlace</button><button type="button" onClick={async () => { if (!confirm('¿Cambiar el enlace general? El enlace antiguo dejará de abrir nuevos accesos.')) return; const result = await act({ action: 'rotatePortal' }, 'Enlace general renovado.'); if (result?.portalUrl) setData(current => current ? { ...current, portalUrl: result.portalUrl } : current); }} className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-black text-slate-600"><RotateCcw className="h-4 w-4" /> Renovar enlace general</button></section><section className="rounded-[26px] border border-slate-200 bg-white p-5 shadow-sm"><div className="flex items-center gap-3"><ShieldCheck className="h-6 w-6 text-emerald-600" /><div><h2 className="text-xl font-black text-slate-950">Alumnos evaluadores</h2><p className="text-sm text-slate-500">Solo pueden ver y exportar las evaluaciones que realizaron.</p></div></div><div className="mt-4 space-y-3">{data?.evaluators.map(person => <article key={person.id} className="rounded-2xl border border-slate-200 p-4"><div className="flex flex-col gap-3 sm:flex-row sm:items-center"><div className="min-w-0 flex-1"><p className="font-black text-slate-900">{person.fullName}</p><p className="truncate text-xs font-medium text-slate-500">{person.email} · {person.university || 'Sin universidad'} · {person.evaluationCount} evaluación(es)</p></div><div className="flex gap-2"><button type="button" onClick={async () => { const result = await act({ action: 'renewEvaluatorAccess', evaluatorId: person.id }, 'Acceso personal renovado.'); await copy(result.recoveryUrl, 'Enlace personal'); }} className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700">Copiar acceso</button><button type="button" onClick={() => act({ action: 'setEvaluatorActive', evaluatorId: person.id, active: !person.active }, person.active ? 'Acceso pausado.' : 'Acceso reactivado.')} className={`rounded-xl px-3 py-2 text-xs font-black ${person.active ? 'bg-rose-50 text-rose-700' : 'bg-emerald-50 text-emerald-700'}`}>{person.active ? 'Pausar' : 'Reactivar'}</button></div></div></article>)}</div></section></div>}

      {editing && <ParticipantDialog initial={editing === 'NEW' ? undefined : editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); setMessage('Persona guardada.'); void load(true); }} />}
    </div>
  );
}
