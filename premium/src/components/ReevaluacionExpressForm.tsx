"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import type { Evaluacion, Proceso } from "@/types/clinica";

type Objective = { id: string; text: string; status: "ACTIVO" | "LOGRADO" | "MODIFICADO" | "NUEVO" };
type ReassessmentData = {
  interview: { change: string; symptomBehavior: string; functionParticipation: string; adherenceContext: string; patientPriority: string; newRedFlags: boolean; redFlagDetail: string };
  exam: { selectedDomains: string[]; comparableResult: string; objectiveFindings: string; testInterpretation: string; loadResponse: string; psfsScores: Array<{ activity: string; baselineScore: string | number | null; score: string }> };
  reasoning: { hypothesis: string; coherence: string; direction: string; decision: string; plan: string; dosage: string; nextReassessment: string; objectives: Objective[] };
};

const emptyData: ReassessmentData = {
  interview: { change: "", symptomBehavior: "", functionParticipation: "", adherenceContext: "", patientPriority: "", newRedFlags: false, redFlagDetail: "" },
  exam: { selectedDomains: [], comparableResult: "", objectiveFindings: "", testInterpretation: "", loadResponse: "", psfsScores: [] },
  reasoning: { hypothesis: "", coherence: "", direction: "", decision: "", plan: "", dosage: "", nextReassessment: "", objectives: [] },
};

const generateId = () => `reeval_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const domains = ["Función/tarea", "Movilidad", "Fuerza/capacidad", "Control motor", "Neurológico", "Marcha/equilibrio", "Carga deportiva/laboral", "Otro"];

export function ReevaluacionExpressForm({ usuariaId, proceso, baselineEvaluation, initialData, onClose, onSaveSuccess }: { usuariaId: string; proceso: Proceso; baselineEvaluation: Evaluacion | null; initialData?: Evaluacion | null; onClose: () => void; onSaveSuccess: (evaluation: Evaluacion, isNew: boolean) => void }) {
  const { globalActiveYear } = useYear();
  const { user } = useAuth();
  const existing: any = initialData;
  const baseline: any = baselineEvaluation || {};
  const express = baseline.expressDraft || {};
  const snapshot: any = proceso.caseSnapshot || {};
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [recordId] = useState(existing?.id || generateId());
  const [data, setData] = useState<ReassessmentData>(() => existing?.reevaluationExpress || emptyData);

  const baselineSummary = snapshot.summary || snapshot.diagnosticoNarrativo || proceso.diagnosisVigente || express.p4_plan?.diagnostico_narrativo || "Sin síntesis narrativa previa";
  const baselineExam = express.evaluacionFisica || "La evaluación previa no dejó un resumen físico en formato Express.";
  const baselineObjectives: Objective[] = (proceso.activeObjectiveSet?.objectives || express.p4_plan?.objetivos_smart || []).map((objective: any) => ({ id: objective.id || generateId(), text: objective.label || objective.texto || objective.text || "Objetivo sin descripción", status: "ACTIVO" }));
  const baselinePsfs: any[] = snapshot.psfsLast || snapshot.psfsBaseline || baseline.interview?.v4?.psfsGlobal || [];
  const hasBaseline = Boolean(baselineEvaluation?.id || existing?.id);

  useEffect(() => {
    if (existing?.id) return;
    setData(current => ({ ...current, exam: { ...current.exam, psfsScores: current.exam.psfsScores.length ? current.exam.psfsScores : baselinePsfs.map((item: any) => ({ activity: item.activity || item.actividad || "Actividad funcional", baselineScore: item.score ?? item.puntaje ?? null, score: "" })) }, reasoning: { ...current.reasoning, objectives: current.reasoning.objectives.length ? current.reasoning.objectives : baselineObjectives } }));
    // La precarga ocurre una vez: solo trae etiquetas y objetivos, nunca respuestas actuales.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const patch = <K extends keyof ReassessmentData>(section: K, values: Partial<ReassessmentData[K]>) => setData(current => ({ ...current, [section]: { ...current[section], ...values } }));
  const requirements = useMemo(() => ({
    interview: Boolean(data.interview.change.trim() && data.interview.functionParticipation.trim() && data.interview.patientPriority.trim()),
    exam: Boolean(data.exam.selectedDomains.length && (data.exam.comparableResult.trim() || data.exam.objectiveFindings.trim()) && data.exam.testInterpretation.trim()),
    reasoning: Boolean(data.reasoning.hypothesis.trim() && data.reasoning.direction && data.reasoning.decision && data.reasoning.plan.trim() && data.reasoning.nextReassessment.trim()),
  }), [data]);
  const completed = Object.values(requirements).filter(Boolean).length;

  const save = async (close = false) => {
    if (!globalActiveYear || !user || !proceso.id) return;
    if (close && !Object.values(requirements).every(Boolean)) { window.alert("Completa los tres bloques esenciales antes de cerrar la reevaluación."); return; }
    setSaving("saving");
    try {
      const now = new Date().toISOString();
      const payload: any = {
        ...(existing || {}), id: recordId, usuariaId, procesoId: proceso.id, type: "REEVALUATION", status: close ? "CLOSED" : "DRAFT", sessionAt: existing?.sessionAt || now,
        clinicianResponsible: user.email || "", reevaluationExpress: data,
        reevaluation: { indexEvaluationId: baselineEvaluation?.id || existing?.reevaluation?.indexEvaluationId, isSameProblem: !data.interview.newRedFlags, newRedFlags: data.interview.newRedFlags, progressSummary: `${data.interview.change}\n${data.reasoning.coherence}`.trim(), planModifications: `${data.reasoning.plan}\nDosificación: ${data.reasoning.dosage}`.trim(), updatedObjectives: data.reasoning.objectives.map(objective => ({ id: objective.id, texto: objective.text, status: objective.status.toLowerCase() })), retest: { patientReport: data.interview.change, comparableSignResult: data.exam.comparableResult, keyMeasures: data.exam.objectiveFindings, clinicalDirection: data.reasoning.direction, planDecision: data.reasoning.decision, nextReevaluationCriteria: data.reasoning.nextReassessment, psfsScores: data.exam.psfsScores } },
        audit: existing?.audit || { createdBy: user.uid, createdAt: now }, updatedAt: now,
      };
      await setDoc(doc(db, "programs", globalActiveYear, "evaluaciones", recordId), sanitizeForFirestoreDeep(payload), { merge: true });
      if (close) {
        const activeObjectives = data.reasoning.objectives.filter(objective => objective.status !== "LOGRADO").map(objective => ({ id: objective.id, label: objective.text, status: "activo" }));
        await setDoc(doc(db, "programs", globalActiveYear, "procesos", proceso.id), sanitizeForFirestoreDeep({
          caseSnapshot: { ...snapshot, lastUpdated: now, lastProgressSummary: data.reasoning.coherence, lastRetest: data.exam.comparableResult || data.exam.objectiveFindings, psfsLast: data.exam.psfsScores },
          activeObjectiveSet: { versionId: `reeval_${Date.now().toString(36)}`, updatedAt: now, objectives: activeObjectives }, updatedAt: now,
        }), { merge: true });
        onSaveSuccess(payload as Evaluacion, !existing?.id);
      }
      setSaving("saved");
      window.setTimeout(() => setSaving("idle"), 1800);
    } catch (error) { console.error("Error guardando reevaluación Express", error); setSaving("error"); }
  };

  useEffect(() => {
    if (!data.interview.change && !data.exam.objectiveFindings && !data.reasoning.plan) return;
    const timer = window.setTimeout(() => save(false), 5000);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!hasBaseline) return <div className="mx-auto max-w-3xl p-6"><div className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><p className="text-xs font-black uppercase text-amber-700">No existe evaluación inicial</p><h2 className="mt-2 text-2xl font-black text-slate-900">Primero crea la evaluación inicial Express</h2><p className="mt-2 text-sm text-slate-700">La reevaluación necesita una línea basal real. No se generará contenido ficticio.</p><button onClick={onClose} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Volver al timeline</button></div></div>;

  return <div className="min-h-screen bg-slate-50 pb-28">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between gap-3"><button onClick={onClose} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100">←</button><div className="min-w-0 flex-1"><h1 className="truncate font-black text-slate-900">Reevaluación Express</h1><p className="text-xs text-slate-500">Objetivo: 8–12 minutos · trabajo del estudiante</p></div><span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black text-indigo-700">{completed}/3</span></div></header>
    <main className="mx-auto max-w-5xl space-y-5 p-4 sm:p-6">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Línea basal</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{baselineSummary}</p><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-bold">Ver evaluación física previa</summary><p className="mt-2 whitespace-pre-wrap leading-5">{baselineExam}</p></details></div>
      <nav className="grid grid-cols-3 gap-2">{([[1,"1. Entrevista"],[2,"2. Examen"],[3,"3. Decisión"]] as const).map(([id,label]) => <button key={id} onClick={() => setStep(id)} className={`rounded-xl px-2 py-3 text-xs font-black ${step === id ? "bg-indigo-600 text-white shadow" : "border border-slate-200 bg-white text-slate-600"}`}>{label}{requirements[id === 1 ? "interview" : id === 2 ? "exam" : "reasoning"] ? " ✓" : ""}</button>)}</nav>

      {step === 1 && <Card eyebrow="Entrevista focalizada" title="Solo lo que puede cambiar decisiones">
        <div className="grid gap-4 md:grid-cols-2"><Area label="Evolución desde la evaluación anterior *" placeholder="¿Qué mejoró, empeoró o fluctuó? ¿Desde cuándo?" value={data.interview.change} onChange={value => patch("interview", { change: value })} /><Area label="Función y participación actual *" placeholder="Actividades recuperadas, limitadas o evitadas." value={data.interview.functionParticipation} onChange={value => patch("interview", { functionParticipation: value })} /><Area label="Comportamiento e irritabilidad" placeholder="24 h, respuesta a carga, latencia y recuperación." value={data.interview.symptomBehavior} onChange={value => patch("interview", { symptomBehavior: value })} /><Area label="Adherencia y contexto" placeholder="Dosis realizada, barreras, facilitadores o cambios de carga." value={data.interview.adherenceContext} onChange={value => patch("interview", { adherenceContext: value })} /><div className="md:col-span-2"><Area label="Prioridad actual de la persona *" placeholder="¿Qué quiere lograr ahora y qué considera importante?" value={data.interview.patientPriority} onChange={value => patch("interview", { patientPriority: value })} /></div></div>
        <label className="mt-4 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-900"><input type="checkbox" checked={data.interview.newRedFlags} onChange={event => patch("interview", { newRedFlags: event.target.checked })} /> Aparecieron signos de alerta o un cambio clínico importante</label>{data.interview.newRedFlags && <div className="mt-3"><Area label="Describe y señala la conducta adoptada" placeholder="Hallazgo, verificación y derivación/consulta si corresponde." value={data.interview.redFlagDetail} onChange={value => patch("interview", { redFlagDetail: value })} /></div>}
      </Card>}

      {step === 2 && <Card eyebrow="Evaluación física focalizada" title="Seleccionar, medir e interpretar">
        <p className="text-xs text-slate-500">Elige solo los dominios que responden a la entrevista y a los objetivos.</p><div className="mt-3 flex flex-wrap gap-2">{domains.map(domain => <button key={domain} type="button" onClick={() => patch("exam", { selectedDomains: data.exam.selectedDomains.includes(domain) ? data.exam.selectedDomains.filter(item => item !== domain) : [...data.exam.selectedDomains, domain] })} className={`rounded-full border px-3 py-2 text-xs font-bold ${data.exam.selectedDomains.includes(domain) ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-200 bg-white text-slate-600"}`}>{domain}</button>)}</div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><Area label="Retest del signo/tarea comparable" placeholder="Mismas condiciones, resultado actual y diferencia respecto al basal." value={data.exam.comparableResult} onChange={value => patch("exam", { comparableResult: value })} /><Area label="Otros hallazgos objetivos relevantes" placeholder="Medida, unidad/condición y resultado. Evita listar pruebas sin propósito." value={data.exam.objectiveFindings} onChange={value => patch("exam", { objectiveFindings: value })} /><Area label="Interpretación de los hallazgos *" placeholder="Qué apoyan, debilitan o no permiten concluir." value={data.exam.testInterpretation} onChange={value => patch("exam", { testInterpretation: value })} /><Area label="Respuesta al examen o a la carga" placeholder="Síntomas, tolerancia, compensaciones y recuperación." value={data.exam.loadResponse} onChange={value => patch("exam", { loadResponse: value })} /></div>
        {data.exam.psfsScores.length > 0 && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-black text-amber-950">Actividades funcionales precargadas</p>{data.exam.psfsScores.map((item,index) => <div key={`${item.activity}-${index}`} className="mt-2 grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-white p-2"><span className="text-xs font-semibold">{item.activity}</span><span className="text-[10px] text-slate-500">Antes {item.baselineScore ?? "—"}</span><input aria-label={`Puntuación actual ${item.activity}`} type="number" min="0" max="10" value={item.score} onChange={event => { const values=[...data.exam.psfsScores]; values[index]={...values[index],score:event.target.value}; patch("exam",{psfsScores:values}); }} className="w-16 rounded-lg border p-2 text-center text-sm font-bold" /></div>)}</div>}
      </Card>}

      {step === 3 && <Card eyebrow="Integración clínica" title="Conectar entrevista, examen y plan">
        <div className="grid gap-4 md:grid-cols-2"><Area label="Hipótesis/disfunción principal actual *" placeholder="Formúlala con precisión kinésica." value={data.reasoning.hypothesis} onChange={value => patch("reasoning", { hypothesis: value })} /><Area label="Concordancia y diferenciales" placeholder="Qué datos le dan o quitan peso y qué alternativa sigue relevante." value={data.reasoning.coherence} onChange={value => patch("reasoning", { coherence: value })} /><SelectField label="Dirección clínica *" value={data.reasoning.direction} onChange={value => patch("reasoning", { direction: value })} options={[['','Seleccionar'],['MEJORANDO','Mejorando'],['ESTABLE','Estable/meseta'],['EMPEORANDO','Empeorando'],['INCIERTO','Información insuficiente']]} /><SelectField label="Decisión del plan *" value={data.reasoning.decision} onChange={value => patch("reasoning", { decision: value })} options={[['','Seleccionar'],['PROGRESS','Progresar'],['MAINTAIN','Mantener'],['MODIFY','Modificar'],['REGRESS','Reducir carga'],['REFER','Consultar/derivar']]} /><Area label="Plan ajustado *" placeholder="Intervenciones prioritarias y qué cambia desde hoy." value={data.reasoning.plan} onChange={value => patch("reasoning", { plan: value })} /><Area label="Dosificación y criterio de progresión" placeholder="Dosis inicial, respuesta esperada y regla para progresar/regresar." value={data.reasoning.dosage} onChange={value => patch("reasoning", { dosage: value })} /><div className="md:col-span-2"><Area label="Próxima reevaluación *" placeholder="Qué medirás, en qué condición y qué cambio considerarás relevante." value={data.reasoning.nextReassessment} onChange={value => patch("reasoning", { nextReassessment: value })} /></div></div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between"><p className="text-sm font-black text-slate-900">Objetivos</p><button type="button" onClick={() => patch("reasoning", { objectives: [...data.reasoning.objectives, { id: generateId(), text: "", status: "NUEVO" }] })} className="rounded-lg bg-indigo-600 px-3 py-2 text-xs font-bold text-white">+ Nuevo objetivo</button></div><div className="mt-3 space-y-2">{data.reasoning.objectives.map((objective,index) => <div key={objective.id} className="grid gap-2 rounded-xl bg-white p-3 sm:grid-cols-[1fr_auto]"><input value={objective.text} onChange={event => { const values=[...data.reasoning.objectives]; values[index]={...objective,text:event.target.value}; patch("reasoning",{objectives:values}); }} placeholder="Objetivo observable y medible" className="rounded-lg border border-slate-200 p-2 text-sm" /><select value={objective.status} onChange={event => { const values=[...data.reasoning.objectives]; values[index]={...objective,status:event.target.value as Objective['status']}; patch("reasoning",{objectives:values}); }} className="rounded-lg border border-slate-200 p-2 text-xs font-bold"><option value="ACTIVO">Mantener</option><option value="LOGRADO">Logrado</option><option value="MODIFICADO">Modificar</option><option value="NUEVO">Nuevo</option></select></div>)}</div></div>
      </Card>}

      <div className="flex items-center justify-between gap-3"><button type="button" onClick={() => step === 1 ? onClose() : setStep((step - 1) as 1 | 2 | 3)} className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600">{step === 1 ? "Salir" : "Anterior"}</button>{step < 3 ? <button type="button" onClick={() => setStep((step + 1) as 1 | 2 | 3)} className="rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Continuar</button> : <button type="button" onClick={() => save(true)} className="rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white">Cerrar reevaluación</button>}</div>
    </main>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 p-3 backdrop-blur"><div className="mx-auto flex max-w-5xl items-center justify-between"><span className="text-xs font-semibold text-slate-500">{saving === "saving" ? "Guardando…" : saving === "saved" ? "Borrador guardado" : saving === "error" ? "Error al guardar" : "Autoguardado activo"}</span><button onClick={() => save(false)} className="rounded-xl border border-indigo-200 px-4 py-2 text-xs font-bold text-indigo-700">Guardar borrador</button></div></div>
  </div>;
}

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{eyebrow}</p><h2 className="mt-1 text-xl font-black text-slate-900">{title}</h2><div className="mt-5">{children}</div></section>; }
function Area({ label, placeholder, value, onChange }: { label: string; placeholder: string; value: string; onChange: (value: string) => void }) { return <label className="block text-xs font-black text-slate-700">{label}<textarea rows={3} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-5 outline-none focus:border-indigo-400 focus:bg-white" /></label>; }
function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="block text-xs font-black text-slate-700">{label}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">{options.map(([optionValue,text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>; }
