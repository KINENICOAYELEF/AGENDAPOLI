import React, { useEffect, useMemo } from "react";
import { Evaluacion, EvaluacionReevaluacion, Proceso } from "@/types/clinica";

export interface Screen5Props {
    formData: Partial<EvaluacionReevaluacion>;
    updateFormData: (patch: Partial<EvaluacionReevaluacion>) => void;
    procesoContext?: Proceso;
    baselineEvaluation?: Evaluacion | null;
    isClosed: boolean;
    onCreateNewInitial?: () => void;
}

function firstText(...values: unknown[]) {
    const value = values.find(item => typeof item === "string" && item.trim());
    return typeof value === "string" ? value : "";
}

export function Screen5_Reevaluacion({ formData, updateFormData, procesoContext, baselineEvaluation, isClosed, onCreateNewInitial }: Screen5Props) {
    const reevaluation: any = formData.reevaluation || {};
    const retest: any = reevaluation.retest || {};
    const baseline: any = baselineEvaluation || {};
    const snapshot: any = procesoContext?.caseSnapshot || {};
    const baselineSummary = firstText(snapshot.diagnosticoNarrativo, snapshot.summary, procesoContext?.diagnosisVigente, baseline.p4_plan_structured?.diagnostico_kinesiologico_narrativo, baseline.geminiDiagnostic?.narrativeDiagnosis, baseline.clinicalSynthesis);
    const comparable = snapshot.baselineComparable || baseline.guidedExam?.comparableRetest?.[0] || baseline.comparableSign;
    const comparableLabel = typeof comparable === "string" ? comparable : firstText(comparable?.name, comparable?.evaluacion, comparable?.conditions);
    const baselinePsfs: any[] = snapshot.psfsLast || snapshot.psfsBaseline || baseline.interview?.v4?.psfsGlobal || baseline.interview?.psfs || [];
    const baselineDate = baselineEvaluation?.sessionAt ? new Date(baselineEvaluation.sessionAt).toLocaleDateString("es-CL") : "Fecha no disponible";
    const hasBaseline = Boolean(baselineEvaluation?.id || baselineSummary || comparableLabel || baselinePsfs.length);

    const patchReevaluation = (patch: Record<string, unknown>) => updateFormData({ reevaluation: { ...reevaluation, ...patch } } as any);
    const patchRetest = (patch: Record<string, unknown>) => patchReevaluation({ retest: { ...retest, ...patch } });

    useEffect(() => {
        if (isClosed || retest.psfsScores?.length || baselinePsfs.length === 0) return;
        patchRetest({ psfsScores: baselinePsfs.map((item: any) => ({ activity: item.activity || item.actividad || item.name || "Actividad funcional", baselineScore: item.score ?? item.puntaje ?? null, score: "" })) });
        // Solo inicializa las etiquetas basales una vez; el estudiante registra los valores actuales.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isClosed]);

    const completed = useMemo(() => [retest.patientReport, retest.comparableSignResult || retest.keyMeasures, reevaluation.progressSummary, reevaluation.planModifications].filter(value => typeof value === "string" && value.trim()).length, [retest, reevaluation]);

    if (!hasBaseline) return <div className="mx-auto max-w-4xl pb-32 pt-4"><div className="rounded-3xl border border-amber-200 bg-amber-50 p-6"><p className="text-xs font-black uppercase tracking-wider text-amber-700">Sin línea basal recuperable</p><h2 className="mt-2 text-2xl font-black text-slate-900">Primero corresponde una evaluación inicial</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">Una reevaluación necesita datos previos comparables. No se inventará una comparación ni se completará con IA.</p>{!isClosed && <button type="button" onClick={onCreateNewInitial} className="mt-5 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-bold text-white">Guardar borrador y crear evaluación inicial</button>}</div></div>;

    return <div className="mx-auto max-w-4xl space-y-6 pb-32 pt-2">
        <header className="rounded-3xl bg-gradient-to-br from-indigo-950 via-indigo-900 to-violet-900 p-6 text-white shadow-lg"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-indigo-200">Reevaluación clínica</p><h2 className="mt-2 text-2xl font-black">Comparar, interpretar y decidir</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">La plataforma muestra la línea basal. El estudiante obtiene los datos actuales y justifica cualquier cambio del plan.</p></div><div className="rounded-2xl bg-white/10 px-4 py-3 text-center"><div className="text-2xl font-black">{completed}/4</div><div className="text-[10px] font-bold uppercase text-indigo-200">hitos esenciales</div></div></div></header>

        <Section number="1" title="Línea basal recuperada" subtitle="Qué se está comparando">
            <div className="flex justify-end"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">{baselineDate}</span></div>
            <div className="mt-3 grid gap-3 md:grid-cols-2"><BaselineCard label="Síntesis clínica previa" value={baselineSummary || "Sin síntesis narrativa; usa los hallazgos medidos."} /><BaselineCard label="Signo comparable previo" value={comparableLabel || "No se dejó un signo comparable explícito."} /></div>
            {baselinePsfs.length > 0 && <p className="mt-3 text-xs text-slate-500">Se precargaron {baselinePsfs.length} actividad(es); las puntuaciones actuales deben volver a medirse.</p>}
        </Section>

        <Section number="2" title="Situación actual" subtitle="Confirmar que corresponde comparar">
            <div className="grid gap-3 md:grid-cols-2"><Choice label="¿Es la misma condición principal?" value={reevaluation.isSameProblem !== false} onChange={value => patchReevaluation({ isSameProblem: value })} disabled={isClosed} /><Choice label="¿Aparecieron nuevos signos de alerta?" value={Boolean(reevaluation.newRedFlags)} onChange={value => patchReevaluation({ newRedFlags: value })} disabled={isClosed} danger /></div>
            {(reevaluation.isSameProblem === false || reevaluation.newRedFlags) && <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><strong>Detén la comparación automática.</strong> Documenta el cambio y considera evaluación inicial o derivación.</div>}
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Qué cambió desde la última evaluación" placeholder="Síntomas, función, carga, contexto o eventos nuevos." value={retest.patientReport || ""} onChange={value => patchRetest({ patientReport: value })} disabled={isClosed} /><Field label="Factores que podrían explicar el cambio" placeholder="Adherencia, actividad, sueño, carga, medicación…" value={retest.contextChanges || ""} onChange={value => patchRetest({ contextChanges: value })} disabled={isClosed} /></div>
        </Section>

        <Section number="3" title="Retest actual" subtitle="Medir solo lo necesario para decidir">
            <div className="grid gap-4 sm:grid-cols-3"><NumberField label="Dolor actual" value={retest.evaCurrent || ""} onChange={value => patchRetest({ evaCurrent: value })} disabled={isClosed} /><NumberField label="Peor dolor 24 h" value={retest.evaWorst24h || ""} onChange={value => patchRetest({ evaWorst24h: value })} disabled={isClosed} /><label className="text-xs font-bold text-slate-700">Respuesta posterior a carga<select value={retest.afterEffect || ""} onChange={event => patchRetest({ afterEffect: event.target.value })} disabled={isClosed} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm"><option value="">Seleccionar</option><option value="Nunca">Sin aumento relevante</option><option value="A veces">Aumento breve/tolerable</option><option value="Siempre">Aumento persistente</option></select></label></div>
            <div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="Resultado del signo comparable" placeholder="Misma tarea/test, condiciones y resultado actual." value={retest.comparableSignResult || ""} onChange={value => patchRetest({ comparableSignResult: value })} disabled={isClosed} /><Field label="Otras medidas relevantes" placeholder="ROM, fuerza, marcha, tolerancia o desempeño ligado a objetivos." value={retest.keyMeasures || ""} onChange={value => patchRetest({ keyMeasures: value })} disabled={isClosed} /></div>
            {(retest.psfsScores || []).length > 0 && <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-sm font-bold text-amber-950">Actividades funcionales</p><div className="mt-3 space-y-2">{retest.psfsScores.map((item: any, index: number) => <div key={`${item.activity}-${index}`} className="grid grid-cols-[1fr_auto_auto] items-center gap-2 rounded-lg bg-white p-2"><span className="text-xs font-semibold text-slate-700">{item.activity}</span><span className="text-[10px] text-slate-500">Antes: {item.baselineScore ?? "—"}</span><input aria-label={`Puntuación actual ${item.activity}`} type="number" min="0" max="10" value={item.score} onChange={event => { const items = [...retest.psfsScores]; items[index] = { ...items[index], score: event.target.value }; patchRetest({ psfsScores: items }); }} disabled={isClosed} className="w-16 rounded-lg border border-amber-200 p-2 text-center text-sm font-bold" /></div>)}</div></div>}
        </Section>

        <Section number="4" title="Interpretar y decidir" subtitle="La conclusión debe quedar justificada">
            <div className="grid gap-4 md:grid-cols-2"><Select label="Dirección clínica global" value={retest.clinicalDirection || ""} onChange={value => patchRetest({ clinicalDirection: value })} disabled={isClosed} options={[['','Seleccionar después de comparar'],['MEJORANDO','Mejorando'],['ESTABLE','Sin cambio relevante'],['EMPEORANDO','Empeorando'],['INCIERTO','Información insuficiente']]} /><Select label="Decisión sobre el plan" value={retest.planDecision || ""} onChange={value => patchRetest({ planDecision: value })} disabled={isClosed} options={[['','Seleccionar y justificar'],['PROGRESS','Progresar'],['MAINTAIN','Mantener'],['MODIFY','Modificar'],['REGRESS','Reducir/regresar carga'],['REFER','Consultar o derivar']]} /><Field label="Síntesis comparativa" placeholder="Qué mejoró, empeoró o permaneció estable y con qué datos." value={reevaluation.progressSummary || ""} onChange={value => patchReevaluation({ progressSummary: value })} disabled={isClosed} /><Field label="Plan y justificación" placeholder="Qué mantienes o modificas, por qué y cómo lo monitorizarás." value={reevaluation.planModifications || ""} onChange={value => patchReevaluation({ planModifications: value })} disabled={isClosed} /><div className="md:col-span-2"><Field label="Próximo criterio de reevaluación" placeholder="Qué variable volverás a medir, en qué condiciones y qué cambio esperas." value={retest.nextReevaluationCriteria || ""} onChange={value => patchRetest({ nextReevaluationCriteria: value })} disabled={isClosed} /></div></div>
        </Section>
    </div>;
}

function Section({ number, title, subtitle, children }: { number: string; title: string; subtitle: string; children: React.ReactNode }) { return <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-black uppercase tracking-wider text-indigo-600">{number}. {title}</p><h3 className="mt-1 text-lg font-bold text-slate-900">{subtitle}</h3><div className="mt-4">{children}</div></section>; }
function BaselineCard({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4"><p className="text-[10px] font-black uppercase text-indigo-600">{label}</p><p className="mt-2 text-sm leading-6 text-slate-800">{value}</p></div>; }
function Choice({ label, value, onChange, disabled, danger = false }: { label: string; value: boolean; onChange: (value: boolean) => void; disabled: boolean; danger?: boolean }) { return <div className={`rounded-xl border p-4 ${danger ? "border-rose-100 bg-rose-50" : "border-slate-200 bg-slate-50"}`}><p className="text-sm font-bold text-slate-800">{label}</p><div className="mt-3 flex gap-2"><button type="button" onClick={() => onChange(true)} disabled={disabled} className={`rounded-lg px-4 py-2 text-xs font-bold ${value ? danger ? "bg-rose-600 text-white" : "bg-indigo-600 text-white" : "bg-white text-slate-600"}`}>Sí</button><button type="button" onClick={() => onChange(false)} disabled={disabled} className={`rounded-lg px-4 py-2 text-xs font-bold ${!value ? "bg-slate-700 text-white" : "bg-white text-slate-600"}`}>No</button></div></div>; }
function Field({ label, placeholder, value, onChange, disabled }: { label: string; placeholder: string; value: string; onChange: (value: string) => void; disabled: boolean }) { return <label className="block text-xs font-bold text-slate-700">{label}<textarea rows={4} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm leading-6 outline-none focus:border-indigo-400 focus:bg-white" placeholder={placeholder} value={value} onChange={event => onChange(event.target.value)} disabled={disabled} /></label>; }
function NumberField({ label, value, onChange, disabled }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean }) { return <label className="text-xs font-bold text-slate-700">{label} (0–10)<input type="number" min="0" max="10" value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-bold" /></label>; }
function Select({ label, value, onChange, disabled, options }: { label: string; value: string; onChange: (value: string) => void; disabled: boolean; options: string[][] }) { return <label className="text-xs font-bold text-slate-700">{label}<select value={value} onChange={event => onChange(event.target.value)} disabled={disabled} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">{options.map(([optionValue, text]) => <option key={optionValue} value={optionValue}>{text}</option>)}</select></label>; }
