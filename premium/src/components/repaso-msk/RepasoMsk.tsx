'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, BookOpen, Check, CheckCircle2, ChevronRight, Clock3, History, LockKeyhole, Pause, Play, RotateCcw, ShieldCheck, Target, X } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { QUESTION_MS, summarise } from '@/lib/repaso-msk/types';
import type { AttemptSummary, AttemptView, BankAvailability, OptionId, QuizAction } from '@/lib/repaso-msk/types';
import { catalog, type BankVersion } from '@/lib/repaso-msk/catalog';
import styles from './repaso.module.css';

type Pending = QuizAction & { requestId: string };
type Draft = { revision: number; remainingMs: number; selected: OptionId | null; pending: Pending | null };
const zones = ['Hombro', 'Codo', 'Muñeca y mano', 'Cervical', 'Columna torácica y lumbar', 'Cadera e ingle', 'Rodilla', 'Tobillo y pie'];
const date = (value: string) => new Date(value).toLocaleString('es-CL', { dateStyle: 'medium', timeStyle: 'short' });

async function api<T>(path = '', body?: unknown): Promise<T> {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión terminó. Vuelve a iniciar sesión; el borrador permanece en este dispositivo.');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`/api/repaso-msk${path}`, { method: body ? 'POST' : 'GET', signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined, cache: 'no-store' });
    const result = await res.json();
    if (!res.ok) throw new Error(typeof result.error === 'string' ? result.error : result.error?.message || 'No se pudo guardar. Intenta nuevamente.');
    return result;
  } finally { clearTimeout(timeout); }
}

export default function RepasoMsk({ uid, request = api }: { uid: string; request?: typeof api }) {
  const [history, setHistory] = useState<AttemptSummary[]>([]);
  const [banks, setBanks] = useState<BankAvailability[]>([]);
  const [version, setVersion] = useState<BankVersion>('knee-v1');
  const [view, setView] = useState<AttemptView | null>(null);
  const [tab, setTab] = useState<'study' | 'history'>('study');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageWarning, setStorageWarning] = useState(false);
  const [startModal, setStartModal] = useState(false);
  const [repeat, setRepeat] = useState(false);
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(QUESTION_MS);
  const [selected, setSelected] = useState<OptionId | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [reviewFilter, setReviewFilter] = useState('all');
  const viewRef = useRef(view); viewRef.current = view;
  const remainRef = useRef(remaining); remainRef.current = remaining;
  const selectedRef = useRef(selected); selectedRef.current = selected;
  const pendingRef = useRef(pending); pendingRef.current = pending;
  const saving = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const closeRef = useRef<(reason: 'answer' | 'skip' | 'timeout') => void>(() => {});
  const key = useCallback((id: string) => `msk-quiz:${uid}:${id}`, [uid]);
  const persist = useCallback((a: AttemptView, ms: number, option: OptionId | null, action: Pending | null) => {
    try { localStorage.setItem(key(a.attempt.id), JSON.stringify({ revision: a.attempt.revision, remainingMs: ms, selected: option, pending: action } satisfies Draft)); }
    catch { setStorageWarning(true); }
  }, [key]);
  const applyView = useCallback((next: AttemptView, restore = false) => {
    let draft: Draft | null = null;
    if (restore) {
      try { draft = JSON.parse(localStorage.getItem(key(next.attempt.id)) || 'null'); } catch { setStorageWarning(true); }
    }
    if (draft?.revision !== next.attempt.revision || !Number.isFinite(draft?.remainingMs)) draft = null;
    const ms = Math.max(0, Math.min(next.attempt.remainingMs, draft?.remainingMs ?? next.attempt.remainingMs));
    const option = draft?.selected ?? next.attempt.selected;
    viewRef.current = next; remainRef.current = ms; selectedRef.current = option; pendingRef.current = draft?.pending ?? null;
    setView(next); setVersion(next.attempt.version); setRemaining(ms); setSelected(option); setPending(draft?.pending ?? null);
    setRunning(false);
    if (next.attempt.status === 'completed') {
      try { localStorage.removeItem(key(next.attempt.id)); } catch { /* Server copy is already complete. */ }
    } else persist(next, ms, option, draft?.pending ?? null);
    window.history.replaceState(null, '', `${window.location.pathname}?intento=${next.attempt.id}`);
  }, [key, persist]);

  const loadHome = useCallback(async () => {
    setLoading(true); setError('');
    try { const result = await request<{ history: AttemptSummary[]; banks: BankAvailability[] }>(); setHistory(result.history); setBanks(result.banks ?? []); setRepeat(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo cargar el historial.'); }
    finally { setLoading(false); }
  }, [request]);
  const openAttempt = useCallback(async (id: string) => {
    setLoading(true); setError('');
    try { applyView(await request<AttemptView>(`/${id}`), true); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo abrir el intento.'); }
    finally { setLoading(false); }
  }, [applyView, request]);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('intento');
    if (id) void openAttempt(id); else void loadHome();
  }, [openAttempt, loadHome]);

  const sync = useCallback(async (action: Pending, resumeAfter = false) => {
    const current = viewRef.current;
    if (!current || saving.current) return;
    saving.current = true; setBusy(true); setRunning(false); setError('');
    pendingRef.current = action; setPending(action);
    persist(current, remainRef.current, selectedRef.current, action);
    try {
      const next = await request<AttemptView>(`/${current.attempt.id}`, action);
      applyView(next);
      if (resumeAfter && next.attempt.status === 'active') setRunning(true);
      requestAnimationFrame(() => { heading.current?.focus({ preventScroll: true }); heading.current?.scrollIntoView({ block: 'start', behavior: 'smooth' }); });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'No se pudo sincronizar. Tu respuesta sigue pendiente en este dispositivo.');
    } finally { saving.current = false; setBusy(false); }
  }, [applyView, persist, request]);

  const answer = useCallback((reason: 'answer' | 'skip' | 'timeout') => {
    const current = viewRef.current;
    if (!current || saving.current || pendingRef.current || current.attempt.status !== 'active') return;
    const option = reason === 'skip' ? null : selectedRef.current;
    if (reason === 'answer' && !option) return;
    void sync({ type: 'answer', revision: current.attempt.revision, index: current.attempt.answers.length,
      requestId: crypto.randomUUID(), option, reason, elapsedMs: reason === 'timeout' ? QUESTION_MS : Math.round(QUESTION_MS - remainRef.current) }, true);
  }, [sync]);
  closeRef.current = answer;

  useEffect(() => {
    if (!running || busy || !view || view.attempt.status !== 'active') return;
    const deadline = Date.now() + remainRef.current;
    const tick = () => {
      const ms = Math.max(0, deadline - Date.now());
      remainRef.current = ms; setRemaining(ms);
      persist(view, ms, selectedRef.current, pendingRef.current);
      if (ms === 0) closeRef.current('timeout');
    };
    tick();
    const interval = setInterval(tick, 200);
    const hide = () => {
      if (document.hidden) {
        const ms = Math.max(0, deadline - Date.now());
        remainRef.current = ms; setRemaining(ms); setRunning(false);
        persist(view, ms, selectedRef.current, pendingRef.current);
      }
    };
    const unload = () => persist(view, Math.max(0, deadline - Date.now()), selectedRef.current, pendingRef.current);
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', unload);
    return () => { clearInterval(interval); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', unload); };
  }, [running, busy, view, persist]);

  const pause = () => {
    if (!view || saving.current || pending) return;
    void sync({ type: 'checkpoint', revision: view.attempt.revision, index: view.attempt.answers.length,
      requestId: crypto.randomUUID(), remainingMs: Math.round(remainRef.current), selected: selectedRef.current });
  };
  const home = () => {
    setRunning(false); setView(null); viewRef.current = null; setReviewFilter('all');
    window.history.replaceState(null, '', window.location.pathname); void loadHome();
  };
  const create = async () => {
    setBusy(true); setError('');
    try { const next = await request<AttemptView>('', { replay: repeat, version }); applyView(next, true); setStartModal(false); }
    catch (e) { setError(e instanceof Error ? e.message : 'No se pudo iniciar.'); }
    finally { setBusy(false); }
  };
  const selectedBank = catalog[version];
  const active = history.find(a => a.status === 'active' && (a.version ?? 'knee-v1') === version);
  const availability = banks.find(b => b.version === version);
  const needsRepeat = !availability || availability.unseen < 35;
  const a = view?.attempt;
  const attemptTitle = catalog[a?.version ?? version].title;
  const index = a?.answers.length ?? 0;
  const question = view?.questions[index];
  const showResults = a?.status === 'completed';

  return <div className={styles.root}>
    <header className={styles.pageHead}>
      <div><p className={styles.eyebrow}>FORMACIÓN · MSK Y DEPORTIVA</p><h1>Repaso clínico</h1><p>Conocer las bases. Interpretar los hallazgos. Tomar una decisión.</p></div>
      <span className={styles.private}><ShieldCheck size={16} /> Espacio personal · Beta</span>
    </header>
    {error && <div role="alert" className={styles.error}><strong>No se completó la operación</strong><p>{error}</p>
      {pending && <button onClick={() => void sync(pending, pending.type === 'answer')} disabled={busy}>Reintentar guardado</button>}
      {!pending && <button onClick={() => a ? void openAttempt(a.id) : void loadHome()}>Volver a cargar</button>}
    </div>}
    {storageWarning && <p role="alert" className={styles.notice}>Este navegador no permite respaldo local. Guarda y pausa antes de salir; las respuestas confirmadas sí se conservan en el servidor.</p>}
    {loading ? <div className={styles.loading} role="status">Cargando tu espacio de repaso…</div> : !view ? <>
      <nav className={styles.tabs} aria-label="Secciones de repaso">
        <button aria-current={tab === 'study' ? 'page' : undefined} onClick={() => setTab('study')}><BookOpen size={18} /> Estudiar</button>
        <button aria-current={tab === 'history' ? 'page' : undefined} onClick={() => setTab('history')}><History size={18} /> Mi historial</button>
      </nav>
      {tab === 'study' ? <>
        <section className={styles.hero}>
          <div><span className={styles.heroTag}>BANCO · {selectedBank.title.toUpperCase()}</span><h2>De las bases<br />a la decisión clínica.</h2>
            <p>Tests de 35 preguntas de un banco de {availability?.total ?? '…'}. Cuadros frecuentes, mecanismos, evaluación e intervención. Sin respuestas escritas.</p>
            <div className={styles.heroFacts}><span><Clock3 size={17} /> 60 s por pregunta</span><span><Target size={17} /> {availability?.unseen ?? '…'} preguntas sin usar</span></div>
            <button className={styles.heroButton} disabled={!!error} onClick={() => active ? void openAttempt(active.id) : setStartModal(true)}>
              {active ? 'Continuar mi intento' : needsRepeat ? 'Ensayo con repetición' : 'Nuevo test de 35'} <ArrowRight size={18} />
            </button>
            {active && <small>{active.answered} de {active.total} respuestas guardadas</small>}
          </div>
          <div className={styles.heroPanel}><span>EL RECORRIDO</span><ol>
            <li><b>01</b><div><strong>Conocimientos esenciales</strong><p>Definiciones, anatomía y fisiopatología.</p></div></li>
            <li><b>02</b><div><strong>Razonamiento clínico</strong><p>Casos, hallazgos y diagnósticos diferenciales.</p></div></li>
            <li><b>03</b><div><strong>Decisiones fundamentadas</strong><p>Objetivos, dosis y seguridad.</p></div></li>
          </ol></div>
        </section>
        <section className={styles.section}><div className={styles.sectionHeading}><div><h2>Explorar por zona</h2><p>Rodilla (105), Cadera e ingle (70) y Hombro (70). Cada test selecciona 35 preguntas y conserva su propio intento.</p></div><span>03 / 08</span></div>
          <div className={styles.zones}>{zones.map((zone, i) => {
            const entry = (Object.entries(catalog) as [BankVersion, typeof catalog[BankVersion]][]).find(([, value]) => value.zone === zone);
            const zoneBank = entry ? banks.find(b => b.version === entry[0]) : undefined;
            const countLabel = zoneBank ? `${zoneBank.total} preguntas` : entry ? (entry[0] === 'knee-v1' ? '105 preguntas' : '70 preguntas') : 'En preparación';
            return entry ? <button key={zone} aria-pressed={version === entry[0]} className={styles.readyZone} onClick={() => { setVersion(entry[0]); setRepeat(false); }}><span>0{i + 1}</span><strong>{zone}</strong><small>{version === entry[0] ? `Seleccionado · ${countLabel}` : `Elegir · ${countLabel}`} <ChevronRight size={14} /></small></button> : <div key={zone} className={styles.zone}><span>0{i + 1}</span><strong>{zone}</strong><small><LockKeyhole size={13} /> En preparación</small></div>;
          })}</div>
        </section>
        <section className={styles.syllabus} id="bank-syllabus"><div><p className={styles.eyebrow}>CONTENIDO DEL BANCO</p><h2>{selectedBank.title}, sin saltarse las bases</h2><p>Todos los cuadros se mezclan en este ensayo. La selección por condición estará disponible cuando existan suficientes variantes.</p><button className={styles.primary} disabled={!!error} onClick={() => active ? void openAttempt(active.id) : setStartModal(true)}>{active ? 'Continuar' : 'Comenzar'} {selectedBank.title}<ArrowRight size={18} /></button></div>
          <ul>{selectedBank.conditions.map(c => <li key={c}><Check size={16} />{c}</li>)}</ul>
        </section>
        <div className={styles.notice}><ShieldCheck size={18} /><p>Tu historial es personal. Este banco es una muestra editorial: los resultados orientan la revisión, no certifican competencia clínica.</p></div>
      </> : <section className={styles.section}><h2>Mis intentos</h2><p className={styles.muted}>Últimos 40 intentos. Las respuestas y explicaciones se consultan al terminar.</p>
        {!history.length ? <div className={styles.empty}><History size={30} /><h3>Todavía no hay intentos</h3><p>Tu primer cuestionario quedará aquí, incluso si lo pausas.</p><button className={styles.primary} onClick={() => setTab('study')}>Explorar bancos</button></div> : <div className={styles.historyList}>{history.map(h => <button key={h.id} onClick={() => void openAttempt(h.id)}><div><strong>{catalog[h.version ?? 'knee-v1'].title} · {h.status === 'active' ? 'En curso' : 'Finalizado'}</strong><span>{date(h.createdAt)} {h.repeated ? '· Ensayo repetido' : ''}</span></div><b>{h.status === 'completed' ? `${h.correct}/${h.total} aciertos` : `${h.answered}/${h.total}`}</b><ChevronRight size={20} /></button>)}</div>}
      </section>}
    </> : showResults ? <>
      <button className={styles.back} onClick={home}><ArrowLeft size={17} /> Volver a mi espacio</button>
      <section className={styles.resultsHead}><CheckCircle2 size={32} /><p className={styles.eyebrow}>INTENTO FINALIZADO · {attemptTitle.toUpperCase()}</p><h2>Ahora, entender cada respuesta.</h2><p>{date(a!.createdAt)}{a!.repeated ? ' · Ensayo docente repetido: no mide retención nueva.' : ''}</p>
        <div className={styles.metrics}>
          <div><strong>{a!.answers.filter(x => x.correct).length}<small> / 35</small></strong><span>Aciertos</span></div>
          <div><strong>{a!.answers.filter(x => x.option && !x.correct).length}</strong><span>Incorrectas</span></div>
          <div><strong>{a!.answers.filter(x => x.reason === 'skip').length}</strong><span>Omitidas</span></div>
          <div><strong>{a!.answers.filter(x => x.reason === 'timeout' && !x.option).length}</strong><span>Sin respuesta a tiempo</span></div>
        </div><small>Las respuestas elegidas al límite de tiempo se corrigen normalmente. No hay bonificación por velocidad.</small>
      </section>
      <section className={styles.section}><h2>Qué conviene repasar</h2><p className={styles.muted}>Aciertos sobre preguntas presentadas por área; no es una nota de dominio.</p><div className={styles.domainGrid}>{summarise(a!, view.questions).map(d => <div key={d.domain}><div><strong>{d.domain}</strong><span>{d.correct}/{d.total}</span></div><progress value={d.correct} max={d.total || 1} /><small>{d.total < 3 ? 'Pocas preguntas para concluir' : d.correct < d.total ? 'Revisar conceptos y explicaciones' : 'Comprobar luego con casos nuevos'}</small></div>)}</div></section>
      <section className={styles.section}><h2>Por cuadro clínico</h2><p className={styles.muted}>Primero aparecen los cuadros con menor proporción de aciertos en este intento. Las omisiones también se incluyen; no equivalen necesariamente a desconocimiento.</p><div className={styles.domainGrid}>{summarise(a!, view.questions, 'condition').sort((x, y) => x.correct / (x.total || 1) - y.correct / (y.total || 1)).map(d => <div key={d.domain}><div><strong>{d.domain}</strong><span>{d.correct}/{d.total}</span></div><progress value={d.correct} max={d.total || 1} /><small>{d.total - d.correct} para revisar · {d.skipped + d.timedOut} sin responder{d.total < 3 ? ' · Muestra pequeña' : ''}</small></div>)}</div></section>
      <section className={styles.section}><div className={styles.sectionHeading}><h2>Respuestas y fundamentos</h2><label className={styles.filter}>Mostrar<select value={reviewFilter} onChange={e => setReviewFilter(e.target.value)}><option value="all">Todas las preguntas</option><option value="review">Incorrectas y sin respuesta</option></select></label></div>
        <div className={styles.reviewList}>{view.review?.map((q, i) => {
          const ans = a!.answers[i]; if (reviewFilter === 'review' && ans.correct) return null;
          return <details key={q.id}><summary><span className={ans.correct ? styles.rightDot : styles.wrongDot}>{ans.correct ? <Check size={17} /> : <RotateCcw size={15} />}</span><div><strong>{i + 1}. {q.condition}</strong><small>{q.domain} · {ans.reason === 'skip' ? 'Omitida' : !ans.option ? 'Tiempo agotado' : ans.correct ? 'Correcta' : 'Incorrecta'} · {Math.round(ans.elapsedMs / 1000)} s</small></div><ChevronRight size={18} /></summary>
            <div className={styles.reviewBody}><p className={styles.stem}>{q.stem}</p><ul>{q.options.map(o => <li key={o.id} className={o.id === q.correct ? styles.correctOption : ''}><b>{o.id}</b><span>{o.text} {o.id === ans.option ? <em>Tu respuesta</em> : null}{o.id === q.correct ? <em>Respuesta correcta</em> : null}</span></li>)}</ul><h4>Fundamento</h4><p>{q.explanation}</p><div className={styles.sources}>{q.sources.map(s => <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.title} ↗</a>)}</div><small>Objetivo: {q.objective} · Ítem: {q.id}</small></div>
          </details>;
        })}</div>
      </section>
    </> : question ? <>
      <div className={styles.quizTop}><span>{attemptTitle.toUpperCase()} · CUESTIONARIO MIXTO</span><span>{index + 1} de {view.questions.length}</span></div>
      <progress className={styles.totalProgress} value={index} max={view.questions.length} aria-label="Preguntas respondidas" />
      <section className={styles.quizCard}>
        <div className={styles.questionHeader}><span>Pregunta {String(index + 1).padStart(2, '0')}</span><div className={remaining <= 10000 ? styles.timerUrgent : styles.timer} role="timer" aria-label={`${Math.ceil(remaining / 1000)} segundos restantes`}><Clock3 size={19} />{String(Math.floor(Math.ceil(remaining / 1000) / 60)).padStart(2, '0')}:{String(Math.ceil(remaining / 1000) % 60).padStart(2, '0')}</div></div>
        {!running && !busy ? <div className={styles.pausePanel}><Pause size={26} /><h2>{index === 0 && remaining === QUESTION_MS ? 'Todo listo para comenzar' : 'Intento en pausa'}</h2><p>El enunciado aparece cuando activas el minuto. Tienes {Math.ceil(remaining / 1000)} segundos disponibles en esta pregunta.</p>
          <button className={styles.primary} disabled={!!pending} onClick={() => setRunning(true)}><Play size={17} /> {remaining === 0 ? 'Continuar al siguiente ítem' : 'Comenzar / continuar'}</button>
          {!pending && <button className={styles.secondary} onClick={home}>Volver a mi espacio</button>}
        </div> : busy ? <div className={styles.pausePanel} role="status"><CheckCircle2 size={28} /><h2>Guardando tu respuesta…</h2><p>El reloj está detenido mientras sincronizamos.</p></div> : <>
          <h2 ref={heading} tabIndex={-1} className={styles.stem}>{question.stem}</h2>
          <fieldset className={styles.options}><legend className={styles.srOnly}>Selecciona una respuesta</legend>{question.options.map(o => <label key={o.id} className={selected === o.id ? styles.selectedOption : styles.option}><input type="radio" name={question.id} value={o.id} checked={selected === o.id} onChange={() => { const choice = o.id as OptionId; selectedRef.current = choice; setSelected(choice); persist(view, remainRef.current, choice, null); }} /><span className={styles.letter}>{o.id}</span><span>{o.text}</span>{selected === o.id && <CheckCircle2 size={20} className={styles.optionCheck} />}</label>)}</fieldset>
          <div className={styles.quizActions}><button className={styles.primary} disabled={!selected} onClick={() => answer('answer')}>Confirmar y siguiente <ArrowRight size={18} /></button><button className={styles.secondary} onClick={() => answer('skip')}>No lo sé / pasar</button></div>
          <p className={styles.microcopy}>A 00:00 se envía tu selección. Sin selección, se registra tiempo agotado.</p>
        </>}
      </section>
      <div className={styles.quizBottom}><span><ShieldCheck size={15} />{pending ? 'Guardado pendiente · no cierres esta pestaña' : 'Respuestas confirmadas guardadas en Firebase'}</span>{running && <button onClick={pause}><Pause size={16} /> Guardar y pausar</button>}</div>
      <p className={styles.microcopy}>Beta formativa · Al terminar podrás consultar todas las respuestas y sus fundamentos. No se muestra el diagnóstico del ítem durante la prueba.</p>
    </> : null}
    {startModal && <div className={styles.modalShade} onKeyDown={e => {
      if (e.key === 'Escape' && !busy) setStartModal(false);
      if (e.key === 'Tab') {
        const nodes = e.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
        const first = nodes[0], last = nodes[nodes.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    }}><section role="dialog" aria-modal="true" aria-labelledby="quiz-start-title" className={styles.modal}>
      <button autoFocus className={styles.close} aria-label="Cerrar instrucciones" disabled={busy} onClick={() => setStartModal(false)}><X size={22} /></button><p className={styles.eyebrow}>ANTES DE EMPEZAR</p><h2 id="quiz-start-title">{selectedBank.title} · 35 preguntas</h2><p>Un minuto por pregunta, sin tiempo mínimo. Calcula hasta 35 minutos para responder y tiempo adicional para revisar.</p>
      <ul><li>Selecciona y confirma para avanzar antes.</li><li>Al terminar el minuto se envía la opción seleccionada, o queda sin respuesta.</li><li>Puedes guardar y pausar. No se reinicia el minuto al volver.</li><li>Las explicaciones se consultan al finalizar.</li></ul>
      <p>{availability?.unseen ?? 0} preguntas sin usar de {availability?.total ?? 0}. Al crear el intento se reservan sus 35 preguntas, aunque lo pauses. No se vuelven a incluir en otro test nuevo.</p>
      {needsRepeat && <label className={styles.repeat}><input type="checkbox" checked={repeat} onChange={e => setRepeat(e.target.checked)} /> Autorizo completar el test con preguntas ya usadas. Se incluyen primero las inéditas disponibles. Es un ensayo docente, no una medición nueva de aprendizaje.</label>}
      {error && <p role="alert" className={styles.error}>{error}</p>}
      <button className={styles.primary} disabled={busy || !availability || (needsRepeat && !repeat)} onClick={() => void create()}>{busy ? 'Preparando intento…' : 'Crear mi intento'}<ArrowRight size={18} /></button>
    </section></div>}
  </div>;
}
