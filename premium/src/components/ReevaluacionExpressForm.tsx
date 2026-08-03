"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import type { Evaluacion, Proceso } from "@/types/clinica";
import type { Evolucion } from "@/types/clinica";
import { resolveClinicalTasksAfterEvaluation } from "@/lib/studentClinicalTasksClient";
import { invalidateClinicalObjectiveCache } from "@/lib/clinicalObjectiveCache";

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
const physicalExamTemplate = `■ SÍNTOMA BASE PREVIO
[Síntoma actual, ubicación, intensidad, fatiga, confianza e irritabilidad antes de evaluar]

■ OBSERVACIÓN GENERAL
[Marcha, protección, edema, cambios visibles, cicatrices, atrofia y conducta frente al movimiento]

■ TAREA FUNCIONAL PRINCIPAL
[Tarea relevante para la persona: condiciones, calidad, síntomas, confianza y limitación]

■ MOVIMIENTO ACTIVO / PASIVO
[Movimiento, rango o medida, lado, dolor, calidad, sensación terminal y comparación]

■ FUERZA / CAPACIDAD
[Gesto o grupo muscular, método, carga, repeticiones o valor, dolor, fatiga y comparación]

■ CONTROL MOTOR / EQUILIBRIO / MARCHA SI APLICA
[Prueba usada, resultado observable y relación con la función]

■ SCREENING NEUROLÓGICO / NEURODINAMIA SI APLICA
[Sensibilidad, miotomas, reflejos, prueba y respuesta]

■ TESTS ORTOPÉDICOS / CLUSTERS SI APLICA
[Solo pruebas justificadas por hipótesis; resultado y efecto sobre la decisión]

■ MEDIDA O SIGNO COMPARABLE
[Repetir en condiciones similares: resultado previo, actual y magnitud del cambio]

■ RESPUESTA A LA EVALUACIÓN O CARGA
[Respuesta durante, después y tiempo de recuperación]

■ HALLAZGOS PRINCIPALES
[Qué cambió, qué se mantiene, qué hipótesis apoyan o debilitan los datos y qué falta verificar]`;
const stepItems = [
  { id: 1, short: "Entrevista", requirement: "interview" },
  { id: 2, short: "Examen", requirement: "exam" },
  { id: 3, short: "Decisión", requirement: "reasoning" },
] as const;

export function ReevaluacionExpressForm({ usuariaId, proceso, baselineEvaluation, recentEvolutions = [], initialData, initialStep, onStepChange, onClose, onSaveSuccess }: { usuariaId: string; proceso: Proceso; baselineEvaluation: Evaluacion | null; recentEvolutions?: Evolucion[]; initialData?: Evaluacion | null; initialStep?: string; onStepChange?: (step: 1 | 2 | 3) => void; onClose: () => void; onSaveSuccess: (evaluation: Evaluacion, isNew: boolean) => void }) {
  const { globalActiveYear } = useYear();
  const { user } = useAuth();
  const existing: any = initialData;
  const baseline: any = baselineEvaluation || {};
  const express = baseline.expressDraft || {};
  const snapshot: any = proceso.caseSnapshot || {};
  const parsedInitialStep = Number(initialStep);
  const [step, setStep] = useState<1 | 2 | 3>(parsedInitialStep === 2 || parsedInitialStep === 3 ? parsedInitialStep : 1);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [recordId] = useState(existing?.id || generateId());
  const [startedAt] = useState(existing?.sessionAt || new Date().toISOString());
  const [data, setData] = useState<ReassessmentData>(() => existing?.reevaluationExpress || emptyData);

  useEffect(() => {
    const requestedStep = Number(initialStep);
    if (requestedStep === 1 || requestedStep === 2 || requestedStep === 3) setStep(requestedStep);
  }, [initialStep]);

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
  const goToStep = (nextStep: 1 | 2 | 3) => { setStep(nextStep); onStepChange?.(nextStep); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const requirements = useMemo(() => ({
    interview: Boolean(data.interview.change.trim() && data.interview.functionParticipation.trim() && data.interview.patientPriority.trim()),
    exam: Boolean((data.exam.comparableResult.trim() || data.exam.objectiveFindings.trim()) && data.exam.testInterpretation.trim()),
    reasoning: Boolean(data.reasoning.hypothesis.trim() && data.reasoning.direction && data.reasoning.decision && data.reasoning.plan.trim() && data.reasoning.nextReassessment.trim()),
  }), [data]);
  const completed = Object.values(requirements).filter(Boolean).length;
  const continuityDigest = useMemo(() => recentEvolutions
    .filter(evolution => evolution.status === "CLOSED")
    .sort((a, b) => new Date(b.sessionAt || 0).getTime() - new Date(a.sessionAt || 0).getTime())
    .slice(0, 5)
    .map(evolution => ({
      id: evolution.id,
      date: evolution.sessionAt,
      goal: evolution.sessionGoal || (evolution as any).objetivoSesion || "Sin objetivo de sesión documentado",
      response: evolution.nextPlan || (evolution as any).planProximaSesion || "Sin plan siguiente documentado",
      objectives: evolution.selectedObjectivesSnapshot || [],
    })), [recentEvolutions]);

  const save = async (close = false) => {
    if (!globalActiveYear || !user || !proceso.id) return;
    if (close && !Object.values(requirements).every(Boolean)) { window.alert("Completa los tres bloques esenciales antes de cerrar la reevaluación."); return; }
    setSaving("saving");
    try {
      const now = new Date().toISOString();
      const finalObjectives = data.reasoning.objectives
        .map(objective => ({ ...objective, text: objective.text.trim() }))
        .filter(objective => objective.text.length > 0);
      const payload: any = {
        ...(existing || {}), id: recordId, usuariaId, procesoId: proceso.id, type: "REEVALUATION", status: close ? "CLOSED" : "DRAFT", sessionAt: startedAt,
        clinicianResponsible: user.email || "", reevaluationExpress: data,
        reevaluation: { indexEvaluationId: baselineEvaluation?.id || existing?.reevaluation?.indexEvaluationId, isSameProblem: !data.interview.newRedFlags, newRedFlags: data.interview.newRedFlags, progressSummary: `${data.interview.change}\n${data.reasoning.coherence}`.trim(), planModifications: `${data.reasoning.plan}\nDosificación: ${data.reasoning.dosage}`.trim(), updatedObjectives: finalObjectives.map(objective => ({ id: objective.id, texto: objective.text, status: objective.status.toLowerCase() })), retest: { patientReport: data.interview.change, comparableSignResult: data.exam.comparableResult, keyMeasures: data.exam.objectiveFindings, clinicalDirection: data.reasoning.direction, planDecision: data.reasoning.decision, nextReevaluationCriteria: data.reasoning.nextReassessment, psfsScores: data.exam.psfsScores } },
        audit: {
          ...(existing?.audit || {}),
          createdBy: existing?.audit?.createdBy || user.uid,
          createdAt: existing?.audit?.createdAt || startedAt,
          ...(close ? { closedBy: user.uid, closedAt: now } : {}),
        },
        updatedAt: now,
      };
      await setDoc(doc(db, "programs", globalActiveYear, "evaluaciones", recordId), sanitizeForFirestoreDeep(payload), { merge: true });
      if (close) {
        const versionId = `reeval_${Date.now().toString(36)}`;
        const activeObjectives = finalObjectives.filter(objective => objective.status !== "LOGRADO").map(objective => ({ id: objective.id, label: objective.text, status: "activo" }));
        await setDoc(doc(db, "programs", globalActiveYear, "procesos", proceso.id), sanitizeForFirestoreDeep({
          caseSnapshot: { ...snapshot, lastUpdated: now, lastProgressSummary: data.reasoning.coherence, lastRetest: data.exam.comparableResult || data.exam.objectiveFindings, psfsLast: data.exam.psfsScores },
          activeEvaluationId: recordId,
          activeEvaluationIndexId: recordId,
          activeObjectiveSetVersionId: versionId,
          activeObjectiveSet: { versionId, updatedAt: now, objectives: activeObjectives }, updatedAt: now,
        }), { merge: true });
        invalidateClinicalObjectiveCache(globalActiveYear, proceso.id);
        window.dispatchEvent(new CustomEvent('clinical-objectives-updated', { detail: { year: globalActiveYear, processId: proceso.id } }));
        try {
          await resolveClinicalTasksAfterEvaluation({ year: globalActiveYear, patientId: usuariaId, processId: proceso.id, recordId, recordType: 'REEVALUATION' });
        } catch (taskError) {
          console.warn("La reevaluación cerró, pero la tarea se conciliará en el próximo censo", taskError);
        }
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

  return <div className="min-h-screen bg-slate-50 pb-40 sm:pb-32">
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-3 py-3 backdrop-blur sm:px-6"><div className="mx-auto flex max-w-5xl items-center gap-3"><button onClick={onClose} aria-label="Volver al expediente" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-xl text-slate-700 hover:bg-slate-100">←</button><div className="min-w-0 flex-1"><h1 className="truncate text-base font-black text-slate-900 sm:text-lg">Reevaluación Express</h1><p className="text-xs text-slate-500">Paso {step} de 3 · {stepItems[step - 1].short}</p></div><p className="text-xs font-bold text-slate-500" aria-label={`${completed} de 3 secciones completas`}>{completed}/3 completas</p></div><div className="mx-auto mt-3 h-1.5 max-w-5xl overflow-hidden rounded-full bg-slate-200"><div className="h-full bg-indigo-600 transition-all" style={{ width: `${(step / 3) * 100}%` }} /></div></header>
    <main className="mx-auto max-w-5xl space-y-4 p-3 sm:space-y-5 sm:p-6">
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">Línea basal</p><p className="mt-1 line-clamp-2 text-sm font-semibold text-slate-800">{baselineSummary}</p><details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer font-bold">Ver evaluación física previa</summary><p className="mt-2 whitespace-pre-wrap leading-5">{baselineExam}</p></details></div>
      <details className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
        <summary className="cursor-pointer text-sm font-black text-emerald-950">Síntesis de continuidad · últimas {continuityDigest.length} sesiones cerradas</summary>
        <p className="mt-1 text-xs text-emerald-800">Resume lo documentado; no propone respuestas ni sustituye tu entrevista y examen actual.</p>
        {continuityDigest.length === 0 ? <p className="mt-3 text-xs text-slate-600">No hay evoluciones cerradas para sintetizar.</p> : <div className="mt-3 space-y-2">{continuityDigest.map(item => <div key={item.id} className="rounded-xl border border-emerald-100 bg-white p-3 text-xs text-slate-700"><p className="font-black text-slate-900">{item.date ? new Date(item.date).toLocaleDateString("es-CL") : "Fecha no disponible"}</p><p className="mt-1"><strong>Objetivo:</strong> {item.goal}</p><p className="mt-1"><strong>Plan siguiente:</strong> {item.response}</p>{item.objectives.length > 0 && <p className="mt-1"><strong>Objetivos vinculados:</strong> {item.objectives.map((objective: any) => objective.label).filter(Boolean).join(" · ")}</p>}</div>)}</div>}
      </details>
      <ol className="grid grid-cols-3 border-y border-slate-200 py-3" aria-label="Progreso de la reevaluación">{stepItems.map(item => <li key={item.id} className={`flex items-center justify-center gap-1.5 border-r border-slate-200 px-1 text-center text-[11px] font-bold last:border-r-0 sm:text-xs ${step === item.id ? "text-indigo-700" : "text-slate-400"}`} aria-current={step === item.id ? "step" : undefined}><span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] ${requirements[item.requirement] ? "bg-emerald-600 text-white" : step === item.id ? "bg-indigo-600 text-white" : "bg-slate-200 text-slate-500"}`}>{requirements[item.requirement] ? "✓" : item.id}</span><span className="hidden min-[380px]:inline">{item.short}</span></li>)}</ol>

      {step === 1 && <Card eyebrow="Entrevista focalizada" title="Solo lo que puede cambiar decisiones">
        <p className="mb-4 text-xs leading-5 text-slate-500">Cada término clínico incluye una guía práctica. No copies la evaluación inicial: registra el estado actual.</p>
        <div className="grid gap-4 md:grid-cols-2"><Area label="Evolución clínica (cambio percibido) *" hint="Resume qué mejoró, empeoró o fluctuó desde la última evaluación y desde cuándo." placeholder="Ej.: tolera más marcha, pero aumentó el dolor nocturno desde…" value={data.interview.change} onChange={value => patch("interview", { change: value })} /><Area label="Función y participación actual *" hint="Registra actividades recuperadas, todavía limitadas o evitadas; no solo síntomas." placeholder="Ej.: volvió a…, aún evita…, necesita ayuda para…" value={data.interview.functionParticipation} onChange={value => patch("interview", { functionParticipation: value })} /><Area label="Comportamiento e irritabilidad" hint="Qué carga provoca el problema, cuánto tarda en aparecer y cuánto demora en volver a su estado habitual." placeholder="Actividad/carga → respuesta → tiempo de recuperación." value={data.interview.symptomBehavior} onChange={value => patch("interview", { symptomBehavior: value })} /><Area label="Adherencia y factores contextuales" hint="Distingue la respuesta al plan de cambios de actividad, sueño, trabajo, medicación o barreras." placeholder="Dosis realizada, facilitadores, barreras y cambios de carga." value={data.interview.adherenceContext} onChange={value => patch("interview", { adherenceContext: value })} /><div className="md:col-span-2"><Area label="Prioridad actual de la persona *" hint="Pregunta qué resultado sería importante para ella ahora; puede haber cambiado desde el ingreso." placeholder="¿Qué quiere recuperar o tolerar mejor en esta etapa?" value={data.interview.patientPriority} onChange={value => patch("interview", { patientPriority: value })} /></div></div>
        <label className="mt-4 flex items-center gap-3 rounded-xl border border-rose-100 bg-rose-50 p-4 text-sm font-bold text-rose-900"><input type="checkbox" checked={data.interview.newRedFlags} onChange={event => patch("interview", { newRedFlags: event.target.checked })} /> Aparecieron signos de alerta o un cambio clínico importante</label>{data.interview.newRedFlags && <div className="mt-3"><Area label="Describe y señala la conducta adoptada" placeholder="Hallazgo, verificación y derivación/consulta si corresponde." value={data.interview.redFlagDetail} onChange={value => patch("interview", { redFlagDetail: value })} /></div>}
      </Card>}

      {step === 2 && <Card eyebrow="Evaluación física focalizada" title="Seleccionar, medir e interpretar">
        <div className="flex flex-col gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-black text-emerald-950">Mismo formato de la evaluación inicial</p><p className="mt-1 text-xs leading-5 text-emerald-800">Registra solamente lo pertinente al estado actual, la irritabilidad, los objetivos y las hipótesis.</p></div><button type="button" onClick={() => patch("exam", { objectiveFindings: data.exam.objectiveFindings.trim() ? `${data.exam.objectiveFindings}\n\n${physicalExamTemplate}` : physicalExamTemplate })} className="min-h-11 shrink-0 rounded-xl border border-emerald-300 bg-white px-4 text-sm font-bold text-emerald-800">Agregar plantilla</button></div>
        <div className="mt-4"><Area rows={12} label="Evaluación física *" hint="Usa mediciones, unidades y condiciones cuando correspondan. No es necesario completar apartados que no aportan a este caso." placeholder="Registra libremente los hallazgos o agrega la plantilla oficial…" value={data.exam.objectiveFindings} onChange={value => patch("exam", { objectiveFindings: value })} /></div>
        <div className="mt-4 grid gap-4 md:grid-cols-2"><Area label="Medida o signo comparable" hint="Si existe una medida previa, repítela en condiciones similares e indica el cambio. Si no existe, registra qué dejarás como nueva referencia." placeholder="Antes…, ahora…, mismas condiciones…" value={data.exam.comparableResult} onChange={value => patch("exam", { comparableResult: value })} /><Area label="Interpretación clínica de los hallazgos *" hint="No repitas resultados: explica qué hipótesis apoyan, cuál debilitan o qué aún no permiten concluir." placeholder="Estos resultados aumentan/disminuyen el peso de… porque…" value={data.exam.testInterpretation} onChange={value => patch("exam", { testInterpretation: value })} /><div className="md:col-span-2"><Area label="Respuesta al examen o a la carga" hint="Describe tolerancia, síntomas y recuperación solo si modifica la dosis o la seguridad." placeholder="Respuesta durante, después y tiempo de recuperación." value={data.exam.loadResponse} onChange={value => patch("exam", { loadResponse: value })} /></div></div>
      </Card>}

      {step === 3 && <Card eyebrow="Integración clínica" title="Conectar entrevista, examen y plan">
        <div className="grid gap-4 md:grid-cols-2"><Area label="Problema kinésico e hipótesis principal actual *" hint="Define el problema modificable que mejor explica las limitaciones actuales; no repitas solo el diagnóstico médico." placeholder="Actualmente predomina… asociado a… y limita…" value={data.reasoning.hypothesis} onChange={value => patch("reasoning", { hypothesis: value })} /><Area label="Concordancia y diagnósticos diferenciales" hint="Conecta entrevista y examen: qué datos aumentan o disminuyen el peso de cada hipótesis." placeholder="Le da más peso a…; debilita…; aún debo considerar…" value={data.reasoning.coherence} onChange={value => patch("reasoning", { coherence: value })} /><SelectField label="Dirección clínica *" hint="Según los datos comparables: ¿mejora, está estable, empeora o todavía falta información?" value={data.reasoning.direction} onChange={value => patch("reasoning", { direction: value })} options={[['','Seleccionar'],['MEJORANDO','Mejorando'],['ESTABLE','Estable/meseta'],['EMPEORANDO','Empeorando'],['INCIERTO','Información insuficiente']]} /><SelectField label="Decisión sobre el plan *" hint="La elección debe concordar con respuesta, irritabilidad, objetivos y riesgos." value={data.reasoning.decision} onChange={value => patch("reasoning", { decision: value })} options={[['','Seleccionar'],['PROGRESS','Progresar'],['MAINTAIN','Mantener'],['MODIFY','Modificar'],['REGRESS','Reducir carga'],['REFER','Consultar/derivar']]} /><Area label="Plan ajustado *" hint="Prioriza qué intervención mantienes, retiras o incorporas y vincúlala con el objetivo actual." placeholder="Desde hoy mantengo/modifico… porque…" value={data.reasoning.plan} onChange={value => patch("reasoning", { plan: value })} /><Area label="Dosificación y criterio de progresión" hint="Indica cantidad, intensidad o esfuerzo, frecuencia, descanso y qué respuesta permitirá progresar o reducir." placeholder="Dosis inicial + respuesta esperada + regla para progresar/regresar." value={data.reasoning.dosage} onChange={value => patch("reasoning", { dosage: value })} /><div className="md:col-span-2"><Area label="Próxima reevaluación *" hint="Deja definido qué repetirás, en qué condiciones y qué cambio considerarás relevante." placeholder="Volveré a medir… en… sesiones; consideraré relevante…" value={data.reasoning.nextReassessment} onChange={value => patch("reasoning", { nextReassessment: value })} /></div></div>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4"><div className="flex items-center justify-between gap-3"><p className="text-sm font-black text-slate-900">Objetivos</p><button type="button" onClick={() => patch("reasoning", { objectives: [...data.reasoning.objectives, { id: generateId(), text: "", status: "NUEVO" }] })} className="min-h-11 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">Agregar objetivo</button></div><p className="mt-2 text-xs leading-5 text-slate-500">Revísalos completos: mantén, modifica o marca como logrado cada uno. Los objetivos activos reemplazarán la lista usada en las próximas evoluciones.</p><div className="mt-3 space-y-3">{data.reasoning.objectives.map((objective,index) => <div key={objective.id} className="grid gap-2 rounded-xl border border-slate-200 bg-white p-3 sm:grid-cols-[1fr_180px]"><textarea rows={3} value={objective.text} onChange={event => { const values=[...data.reasoning.objectives]; values[index]={...objective,text:event.target.value}; patch("reasoning",{objectives:values}); }} placeholder="Objetivo observable y medible" className="min-h-24 resize-y rounded-lg border border-slate-200 p-3 text-base leading-6 sm:text-sm" /><select aria-label={`Estado del objetivo ${index + 1}`} value={objective.status} onChange={event => { const values=[...data.reasoning.objectives]; values[index]={...objective,status:event.target.value as Objective['status']}; patch("reasoning",{objectives:values}); }} className="min-h-12 rounded-lg border border-slate-200 p-3 text-base font-bold sm:self-start sm:text-sm"><option value="ACTIVO">Mantener</option><option value="LOGRADO">Logrado</option><option value="MODIFICADO">Modificar</option><option value="NUEVO">Nuevo</option></select></div>)}</div></div>
      </Card>}

    </main>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 px-3 pt-2 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur sm:px-6"><div className="mx-auto max-w-5xl"><div className="mb-2 flex items-center justify-between text-[11px] font-semibold"><span className={saving === "error" ? "text-rose-600" : "text-slate-500"}>{saving === "saving" ? "Guardando…" : saving === "saved" ? "Cambios guardados" : saving === "error" ? "No se pudo guardar" : "Autoguardado activo"}</span><button type="button" onClick={() => save(false)} className="min-h-8 px-2 font-bold text-indigo-700 underline decoration-indigo-200 underline-offset-4">Guardar ahora</button></div><div className="grid grid-cols-[minmax(96px,0.45fr)_1fr] gap-2"><button type="button" onClick={() => step === 1 ? onClose() : goToStep((step - 1) as 1 | 2 | 3)} className="min-h-12 rounded-xl border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700">{step === 1 ? "Salir" : "Anterior"}</button>{step < 3 ? <button type="button" onClick={() => goToStep((step + 1) as 1 | 2 | 3)} className="min-h-12 rounded-xl bg-indigo-600 px-4 text-sm font-black text-white shadow-sm">Continuar a {step === 1 ? "Examen" : "Decisión"}</button> : <button type="button" onClick={() => save(true)} className="min-h-12 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white shadow-sm">Finalizar y cerrar</button>}</div></div></div>
  </div>;
}

function Card({ eyebrow, title, children }: { eyebrow: string; title: string; children: ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6"><p className="text-[10px] font-black uppercase tracking-wider text-indigo-600">{eyebrow}</p><h2 className="mt-1 text-lg font-black leading-tight text-slate-900 sm:text-xl">{title}</h2><div className="mt-4 sm:mt-5">{children}</div></section>; }
function Area({ label, hint, placeholder, value, onChange, rows = 3 }: { label: string; hint?: string; placeholder: string; value: string; onChange: (value: string) => void; rows?: number }) { return <label className="block text-xs font-black text-slate-700">{label}{hint && <span className="mt-1 block font-medium leading-4 text-slate-500">{hint}</span>}<textarea rows={rows} value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="mt-1.5 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-base leading-6 outline-none focus:border-indigo-400 focus:bg-white sm:text-sm sm:leading-5" /></label>; }
function SelectField({ label, hint, value, onChange, options }: { label: string; hint?: string; value: string; onChange: (value: string) => void; options: string[][] }) { return <label className="block text-xs font-black text-slate-700">{label}{hint && <span className="mt-1 block font-medium leading-4 text-slate-500">{hint}</span>}<select value={value} onChange={event => onChange(event.target.value)} className="mt-1.5 min-h-12 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-base sm:text-sm">{options.map(([optionValue,text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>; }
