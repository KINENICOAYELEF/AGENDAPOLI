'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowRight,
  Check,
  ClipboardCheck,
  Copy,
  FileText,
  Link2,
  LogOut,
  Plus,
  Search,
  ShieldCheck,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import { EvaluationWizard } from '@/components/adulto-mayor/EvaluationWizard';
import { OlderAdultEvaluation, OlderAdultParticipant, PublicPortalPayload } from '@/lib/adultoMayor/types';

type PortalState = PublicPortalPayload | null;

const personDefaults = {
  fullName: '', rut: '', birthDate: '', sex: 'NO_ESPECIFICA', nationality: '', phone: '',
  emergencyContact: '', educationLevel: '', occupation: '', address: '', commune: '',
  supportNetwork: '', readingAbility: 'SI', writingAbility: 'SI',
};

async function portalPost(body: any) {
  const response = await fetch('/api/adulto-mayor/portal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) {
    const error: any = new Error(payload.error || 'No se pudo completar la solicitud.');
    error.code = payload.code;
    error.existingParticipantId = payload.existingParticipantId;
    throw error;
  }
  return payload.data;
}

export default function OlderAdultPublicEvaluationPage() {
  const [loading, setLoading] = useState(true);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [portal, setPortal] = useState<PortalState>(null);
  const [fatalError, setFatalError] = useState('');
  const [formError, setFormError] = useState('');
  const [registering, setRegistering] = useState(false);
  const [registration, setRegistration] = useState({ fullName: '', email: '', university: '' });
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [newPerson, setNewPerson] = useState({ ...personDefaults });
  const [creating, setCreating] = useState(false);
  const [selected, setSelected] = useState<OlderAdultEvaluation | null>(null);
  const [copied, setCopied] = useState(false);

  const loadPortal = async () => {
    const response = await fetch('/api/adulto-mayor/portal', { cache: 'no-store' });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo abrir el portal.');
    if (payload.data.needsRegistration) {
      setNeedsRegistration(true);
      setPortal(null);
    } else {
      setPortal(payload.data);
      setNeedsRegistration(false);
    }
  };

  useEffect(() => {
    let active = true;
    const boot = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams(window.location.search);
        const access = params.get('acceso');
        const portalToken = params.get('portal');
        if (access) await portalPost({ action: 'recoverEvaluator', token: access });
        else if (portalToken) await portalPost({ action: 'exchangePortal', portalToken });
        if (access || portalToken) window.history.replaceState({}, '', '/evaluacion-adulto-mayor');
        await loadPortal();
      } catch (error: any) {
        const rawMessage = String(error?.message || '');
        const friendlyMessage = /Unauthorized|Evaluator session|portal|token/i.test(rawMessage)
          ? 'Abre el enlace general o tu enlace personal compartido por el equipo del taller.'
          : rawMessage || 'Este enlace no está disponible temporalmente.';
        if (active) setFatalError(friendlyMessage);
      } finally {
        if (active) setLoading(false);
      }
    };
    void boot();
    return () => { active = false; };
  }, []);

  const filteredParticipants = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    if (!portal) return [];
    if (!query) return portal.participants;
    return portal.participants.filter(person => [person.fullName, person.commune, person.age].join(' ').toLocaleLowerCase('es').includes(query));
  }, [portal, search]);

  const register = async (event: React.FormEvent) => {
    event.preventDefault();
    setRegistering(true);
    setFormError('');
    try {
      await portalPost({ action: 'registerEvaluator', ...registration });
      await loadPortal();
    } catch (error: any) {
      setFormError(error?.message || 'No se pudo crear el acceso.');
    } finally {
      setRegistering(false);
    }
  };

  const startEvaluation = async (participantId: string) => {
    setFormError('');
    try {
      const data = await portalPost({ action: 'startEvaluation', participantId });
      setSelected(data.evaluation);
      setPortal(current => current ? {
        ...current,
        evaluations: [data.evaluation, ...current.evaluations.filter(item => item.id !== data.evaluation.id)],
      } : current);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      setFormError(error?.message || 'No se pudo iniciar la evaluación.');
    }
  };

  const createPerson = async (event: React.FormEvent) => {
    event.preventDefault();
    setCreating(true);
    setFormError('');
    try {
      const data = await portalPost({ action: 'createParticipant', participant: newPerson });
      setPortal(current => current ? {
        ...current,
        participants: [...current.participants, data.participant].sort((a, b) => a.fullName.localeCompare(b.fullName, 'es')),
      } : current);
      setShowCreate(false);
      setNewPerson({ ...personDefaults });
      await startEvaluation(data.participant.id);
    } catch (error: any) {
      setFormError(error?.message || 'No se pudo crear la persona.');
    } finally {
      setCreating(false);
    }
  };

  const onEvaluationUpdated = (evaluation: OlderAdultEvaluation) => {
    setSelected(evaluation);
    setPortal(current => current ? {
      ...current,
      evaluations: [evaluation, ...current.evaluations.filter(item => item.id !== evaluation.id)],
    } : current);
  };

  const logout = async () => {
    await portalPost({ action: 'logoutEvaluator' }).catch(() => undefined);
    setPortal(null);
    setNeedsRegistration(true);
    setSelected(null);
  };

  const copyAccess = async () => {
    if (!portal?.recoveryUrl) return;
    await navigator.clipboard.writeText(portal.recoveryUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const previousEvaluation = selected && portal
    ? portal.evaluations
        .filter(item => item.participantId === selected.participantId && item.id !== selected.id && item.status === 'SUBMITTED')
        .sort((a, b) => (b.submittedAt || b.updatedAt).localeCompare(a.submittedAt || a.updatedAt))[0]
    : undefined;

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-teal-950 text-white"><div className="text-center"><Activity className="mx-auto h-10 w-10 animate-pulse text-teal-300" /><p className="mt-3 text-sm font-bold text-teal-100">Preparando la evaluación…</p></div></div>;
  }

  if (fatalError) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-100 p-5">
        <section className="max-w-md rounded-[28px] border border-slate-200 bg-white p-7 text-center shadow-xl">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50 text-rose-600"><ShieldCheck className="h-7 w-7" /></div>
          <h1 className="mt-5 text-xl font-black text-slate-900">Acceso no disponible</h1>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{fatalError}</p>
          <p className="mt-4 text-xs text-slate-400">Vuelve a abrir el enlace compartido por el equipo del Taller de Adulto Mayor.</p>
        </section>
      </main>
    );
  }

  if (needsRegistration) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#ccfbf1,transparent_35%),linear-gradient(135deg,#f8fafc,#ecfdf5)] px-4 py-8 sm:py-14">
        <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_.95fr]">
          <section className="rounded-[32px] bg-teal-950 p-7 text-white shadow-2xl sm:p-10">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300"><ClipboardCheck className="h-7 w-7" /></div>
            <p className="mt-8 text-xs font-black uppercase tracking-[.2em] text-teal-300">Polideportivo · Taller AM</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Evaluación funcional del adulto mayor</h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-teal-100">Realiza una evaluación completa de una sola persona, guarda el borrador por pasos y conserva acceso a tus propios informes.</p>
            <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {['Sin contraseña', 'Guardado por pasos', 'Informe exportable'].map(label => <div key={label} className="rounded-2xl bg-white/8 px-4 py-3 text-sm font-bold text-teal-50"><Check className="mb-2 h-4 w-4 text-teal-300" />{label}</div>)}
            </div>
          </section>
          <form onSubmit={register} className="rounded-[32px] border border-white bg-white/90 p-6 shadow-xl backdrop-blur sm:p-9">
            <h2 className="text-2xl font-black text-slate-900">Identifícate una sola vez</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500">Esto permite reconocer qué evaluaciones realizaste. No crea una cuenta clínica ni requiere contraseña.</p>
            {formError && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{formError}</p>}
            <div className="mt-6 space-y-4">
              <label className="block"><span className="mb-1.5 block text-sm font-black text-slate-700">Nombre completo</span><input required value={registration.fullName} onChange={event => setRegistration(current => ({ ...current, fullName: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-black text-slate-700">Correo</span><input required type="email" value={registration.email} onChange={event => setRegistration(current => ({ ...current, email: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
              <label className="block"><span className="mb-1.5 block text-sm font-black text-slate-700">Universidad o institución</span><input value={registration.university} onChange={event => setRegistration(current => ({ ...current, university: event.target.value }))} className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-teal-500 focus:ring-4 focus:ring-teal-100" /></label>
            </div>
            <button disabled={registering} className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-teal-700/20 transition hover:bg-teal-800 disabled:opacity-50">{registering ? 'Preparando acceso…' : 'Entrar a evaluar'}<ArrowRight className="h-4 w-4" /></button>
          </form>
        </div>
      </main>
    );
  }

  if (!portal) return null;

  if (selected) {
    return <main className="min-h-screen bg-slate-100 px-3 py-4 sm:px-6 sm:py-8"><EvaluationWizard evaluation={selected} previous={previousEvaluation} onUpdated={onEvaluationUpdated} onClose={() => setSelected(null)} /></main>;
  }

  const drafts = portal.evaluations.filter(item => item.status === 'DRAFT');
  const submitted = portal.evaluations.filter(item => item.status === 'SUBMITTED');

  return (
    <main className="min-h-screen bg-slate-100 pb-16">
      <header className="bg-teal-950 px-4 py-5 text-white shadow-lg sm:px-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-400/15 text-teal-300"><Activity className="h-6 w-6" /></div><div><p className="text-[10px] font-black uppercase tracking-[.2em] text-teal-300">Taller de Adulto Mayor</p><h1 className="text-xl font-black">Hola, {portal.evaluator.fullName.split(' ')[0]}</h1></div></div>
          <button type="button" onClick={logout} className="inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold text-teal-100 hover:bg-white/20"><LogOut className="h-4 w-4" /> Cambiar evaluador</button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <section className="rounded-3xl border border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="flex gap-3"><Link2 className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" /><div><h2 className="text-sm font-black text-teal-950">Guarda tu acceso personal</h2><p className="mt-0.5 text-xs leading-relaxed text-teal-800">Te permitirá volver en cuatro días o desde otro dispositivo y abrir tus evaluaciones.</p></div></div>
          <button type="button" onClick={copyAccess} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-black text-white sm:mt-0 sm:w-auto">{copied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar mi acceso</>}</button>
        </section>

        {formError && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">{formError}</div>}

        {drafts.length > 0 && (
          <section><div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-black text-slate-900">Continuar borradores</h2><span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-800">{drafts.length}</span></div><div className="grid gap-3 sm:grid-cols-2">{drafts.map(item => <button key={item.id} type="button" onClick={() => setSelected(item)} className="flex items-center justify-between rounded-2xl border border-amber-200 bg-white p-4 text-left shadow-sm transition hover:border-amber-400"><div><strong className="block text-sm text-slate-900">{item.participantSnapshot.fullName}</strong><span className="mt-1 block text-xs text-slate-500">Paso {item.step} de 5 · guardado {new Date(item.updatedAt).toLocaleDateString('es-CL')}</span></div><ArrowRight className="h-5 w-5 text-amber-600" /></button>)}</div></section>
        )}

        <section className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">¿A quién evaluarás?</h2><p className="mt-1 text-sm text-slate-500">Busca a la persona. Créala solo si no aparece en la lista.</p></div><button type="button" onClick={() => { setFormError(''); setShowCreate(true); }} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-black text-white"><Plus className="h-4 w-4" /> Crear adulto mayor</button></div>
          <div className="relative mt-5"><Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" /><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Buscar por nombre, edad o comuna…" className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-12 pr-4 text-base outline-none focus:border-teal-500 focus:bg-white focus:ring-4 focus:ring-teal-100" /></div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {filteredParticipants.map(person => (
              <button key={person.id} type="button" onClick={() => startEvaluation(person.id)} className="group flex items-center gap-3 rounded-2xl border border-slate-200 p-3 text-left transition hover:border-teal-400 hover:bg-teal-50">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 group-hover:bg-teal-100 group-hover:text-teal-700"><UserRound className="h-5 w-5" /></div>
                <div className="min-w-0 flex-1"><strong className="block truncate text-sm text-slate-900">{person.fullName}</strong><span className="block truncate text-xs text-slate-500">{person.age != null ? `${person.age} años` : 'Edad no registrada'}{person.commune ? ` · ${person.commune}` : ''}</span></div><ArrowRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-teal-600" />
              </button>
            ))}
          </div>
          {filteredParticipants.length === 0 && <div className="py-10 text-center"><UsersRound className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-2 text-sm font-bold text-slate-500">No encontramos coincidencias.</p><button type="button" onClick={() => setShowCreate(true)} className="mt-3 text-sm font-black text-teal-700">Crear esta persona</button></div>}
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between"><div><h2 className="text-lg font-black text-slate-900">Mis evaluaciones entregadas</h2><p className="text-xs text-slate-500">Puedes abrirlas y exportar el informe.</p></div><span className="rounded-full bg-teal-100 px-3 py-1 text-xs font-black text-teal-800">{submitted.length}</span></div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {submitted.map(item => <button key={item.id} type="button" onClick={() => setSelected(item)} className="rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"><div className="flex items-start justify-between gap-3"><FileText className="h-5 w-5 text-teal-700" /><span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">ENTREGADA</span></div><strong className="mt-3 block text-sm text-slate-900">{item.participantSnapshot.fullName}</strong><span className="mt-1 block text-xs text-slate-500">{new Date(item.submittedAt || item.updatedAt).toLocaleDateString('es-CL')} · SPPB {item.results.sppbTotal}/12</span></button>)}
            {submitted.length === 0 && <p className="col-span-full rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Las evaluaciones que entregues aparecerán aquí.</p>}
          </div>
        </section>
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/60 p-0 backdrop-blur-sm sm:items-center sm:p-5">
          <form onSubmit={createPerson} className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl sm:rounded-[28px] sm:p-7">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">Crear adulto mayor</h2><p className="mt-1 text-sm text-slate-500">Primero comprueba que no aparezca con otro nombre.</p></div><button type="button" onClick={() => setShowCreate(false)} className="rounded-xl bg-slate-100 p-2 text-slate-500"><X className="h-5 w-5" /></button></div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="sm:col-span-2"><span className="mb-1 block text-sm font-black text-slate-700">Nombre completo *</span><input required value={newPerson.fullName} onChange={event => setNewPerson(current => ({ ...current, fullName: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">RUT</span><input value={newPerson.rut} onChange={event => setNewPerson(current => ({ ...current, rut: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Fecha de nacimiento</span><input type="date" value={newPerson.birthDate} onChange={event => setNewPerson(current => ({ ...current, birthDate: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Sexo para referencias</span><select value={newPerson.sex} onChange={event => setNewPerson(current => ({ ...current, sex: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500"><option value="NO_ESPECIFICA">No especifica</option><option value="MUJER">Mujer</option><option value="HOMBRE">Hombre</option></select></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Comuna</span><input value={newPerson.commune} onChange={event => setNewPerson(current => ({ ...current, commune: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Teléfono</span><input value={newPerson.phone} onChange={event => setNewPerson(current => ({ ...current, phone: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Contacto de emergencia</span><input value={newPerson.emergencyContact} onChange={event => setNewPerson(current => ({ ...current, emergencyContact: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Nivel educacional</span><input value={newPerson.educationLevel} onChange={event => setNewPerson(current => ({ ...current, educationLevel: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label><span className="mb-1 block text-sm font-black text-slate-700">Ocupación</span><input value={newPerson.occupation} onChange={event => setNewPerson(current => ({ ...current, occupation: event.target.value }))} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
              <label className="sm:col-span-2"><span className="mb-1 block text-sm font-black text-slate-700">Con quién vive / red de apoyo</span><textarea value={newPerson.supportNetwork} onChange={event => setNewPerson(current => ({ ...current, supportNetwork: event.target.value }))} rows={2} className="w-full rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-teal-500" /></label>
            </div>
            {formError && <p className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-sm font-bold text-rose-700">{formError}</p>}
            <button disabled={creating} className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-teal-700 px-5 py-3.5 text-sm font-black text-white disabled:opacity-50">{creating ? 'Creando…' : 'Crear y comenzar evaluación'}<ArrowRight className="h-4 w-4" /></button>
          </form>
        </div>
      )}
    </main>
  );
}
