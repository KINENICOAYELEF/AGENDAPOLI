import React from "react";
import { EvaluacionInicial } from "@/types/clinica";
import { autoSynthesizeFindings } from "@/lib/auto-engine";

export interface Screen2Props {
    formData: Partial<EvaluacionInicial>;
    updateFormData: (patch: Partial<EvaluacionInicial> | ((prev: Partial<EvaluacionInicial>) => Partial<EvaluacionInicial>)) => void;
    isClosed: boolean;
    onNext?: () => void;
}

export function Screen2_Examen({ formData, updateFormData, isClosed, onNext }: Screen2Props) {
    const exam = (formData.guidedExam as any) || {};

    const handleUpdateExam = (field: string, value: string) => {
        updateFormData((prev) => ({
            guidedExam: { ...prev.guidedExam, [field]: value }
        }));
    };

    const blocks = [
        { id: 'observation', icon: '👀', theme: 'slate', title: 'B. Observación y movimiento inicial', sub: 'Postura, asimetrías, trofismo, marcha, gestos iniciales', placeholder: 'Paciente entra con marcha claudicante, asimetría de hombros...' },
        { id: 'analyticRom', icon: '📐', theme: 'indigo', title: 'C. Rango de movimiento analítico', sub: 'Movilidad activa, pasiva y end-feel', placeholder: 'Flexión activa hombro 120° con dolor, pasiva completa...' },
        { id: 'strengthAndLoad', icon: '🦾', theme: 'emerald', title: 'D. Fuerza y tolerancia a carga', sub: 'Pruebas isométricas, RM, dinamometría o tolerancia a cargar peso', placeholder: 'Fuerza isométrica conservada pero dolorosa (4/5) en abducción...' },
        { id: 'palpation', icon: '🖐️', theme: 'amber', title: 'E. Palpación', sub: 'Temperatura, derrame, puntos gatillo, sensibilidad tisular', placeholder: 'Dolor exquisito a la palpación del epicóndilo lateral, sin aumento de temperatura local...' },
        { id: 'neuroVascular', icon: '⚡', theme: 'rose', title: 'F. Neurológico / vascular / somatosensorial', sub: 'Dermatomas, reflejos, neurodinamia, pulsos, sensibilidad', placeholder: 'Sensibilidad conservada, reflejos osteotendíneos ++/++, pulsos distales presentes y simétricos...' },
        { id: 'motorControl', icon: '🧘', theme: 'teal', title: 'G. Control motor y estabilidad funcional', sub: 'Disociación, estabilizadores, propiocepción', placeholder: 'Pobre control lumbopélvico durante sentadilla profunda, valgo dinámico de rodilla derecha...' },
        { id: 'orthopedicTestsText', icon: '🔨', theme: 'sky', title: 'H. Pruebas ortopédicas', sub: 'Tests especiales y provocativos', placeholder: 'Test de Neer (+), Hawkins-Kennedy (+), Drop Arm (-)...' },
        { id: 'functionalTests', icon: '🏃', theme: 'orange', title: 'I. Pruebas funcionales y reintegro', sub: 'Saltos, agilidad, gestos deportivos específicos', placeholder: 'Y-Balance Test asimetría > 4cm en alcance anterior, dolor en aterrizaje de salto...' },
        { id: 'retest', icon: '🔄', theme: 'fuchsia', title: 'J. Re-test y cierre del examen físico', sub: 'Cambio post intervenciones de prueba (Signo comparable)', placeholder: 'Re-test de dolor a flexión disminuye de 7/10 a 3/10 tras modificación escapular...' },
        { id: 'complementary', icon: '🩻', theme: 'slate', title: 'K. Medidas complementarias (opcional)', sub: 'Imágenes traídas, exámenes de laboratorio o derivaciones', placeholder: 'Resonancia (05/03/2026) muestra tendinopatía supraespinoso sin rotura...' },
    ];

    const getThemeClasses = (theme: string) => {
        const themes: Record<string, { bg: string, text: string, border: string, focus: string }> = {
            slate: { bg: 'bg-slate-50', text: 'text-slate-800', border: 'border-slate-200', focus: 'focus:border-slate-400' },
            indigo: { bg: 'bg-indigo-50/50', text: 'text-indigo-900', border: 'border-indigo-100', focus: 'focus:border-indigo-400' },
            emerald: { bg: 'bg-emerald-50/50', text: 'text-emerald-900', border: 'border-emerald-100', focus: 'focus:border-emerald-400' },
            amber: { bg: 'bg-amber-50/50', text: 'text-amber-900', border: 'border-amber-100', focus: 'focus:border-amber-400' },
            rose: { bg: 'bg-rose-50/50', text: 'text-rose-900', border: 'border-rose-100', focus: 'focus:border-rose-400' },
            teal: { bg: 'bg-teal-50/50', text: 'text-teal-900', border: 'border-teal-100', focus: 'focus:border-teal-400' },
            sky: { bg: 'bg-sky-50/50', text: 'text-sky-900', border: 'border-sky-100', focus: 'focus:border-sky-400' },
            orange: { bg: 'bg-orange-50/50', text: 'text-orange-900', border: 'border-orange-100', focus: 'focus:border-orange-400' },
            fuchsia: { bg: 'bg-fuchsia-100/30', text: 'text-fuchsia-900', border: 'border-fuchsia-200', focus: 'focus:border-fuchsia-400' },
        };
        return themes[theme] || themes.slate;
    };

    return (
        <div className="flex flex-col gap-6 pb-32 pt-2 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* A. ENCABEZADO */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 tracking-tight">Inicio del examen físico</h2>
                    <p className="text-sm text-slate-500 mt-1">Sintetiza la evaluación usando únicamente los apartados clínicos correspondientes a continuación.</p>
                </div>
                <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full font-bold text-xl">
                    🩺
                </div>
            </div>

            {/* B-K BLOQUES CLINICOS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {blocks.map((block) => {
                    const theme = getThemeClasses(block.theme);
                    return (
                        <div key={block.id} className={`bg-white border text-sm ${theme.border} rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md`}>
                            <div className={`${theme.bg} p-4 flex justify-between items-start border-b ${theme.border}`}>
                                <div>
                                    <h3 className={`font-bold ${theme.text} flex items-center gap-2 tracking-wide`}>
                                        <span className="text-lg">{block.icon}</span> {block.title}
                                    </h3>
                                    <p className={`text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest ${theme.text}`}>
                                        {block.sub}
                                    </p>
                                </div>
                                <button className={`text-[10px] w-6 h-6 rounded-full flex items-center justify-center border ${theme.border} bg-white opacity-60 hover:opacity-100 transition-opacity`} title="Ayuda sobre este bloque">
                                    ?
                                </button>
                            </div>
                            <div className="p-4 flex-1 flex flex-col">
                                <textarea
                                    className={`w-full flex-1 bg-slate-50 border border-slate-200 text-slate-700 text-[14px] rounded-xl p-3 sm:p-4 outline-none ${theme.focus} focus:ring-2 focus:ring-opacity-20 focus:bg-white min-h-[120px] shadow-inner transition-all resize-y leading-relaxed disabled:bg-slate-100 disabled:text-slate-800 disabled:cursor-not-allowed`}
                                    placeholder={block.placeholder}
                                    value={exam[block.id] || ''}
                                    onChange={(e) => handleUpdateExam(block.id, e.target.value)}
                                    disabled={isClosed}
                                />
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* BOTÓN FINAL */}
            <div className="flex justify-end pt-6 border-t border-slate-200 mt-4">
                <button
                    onClick={() => {
                        const synthesis = autoSynthesizeFindings(exam, formData.interview);
                        updateFormData((prev) => ({
                            autoSynthesis: { ...prev.autoSynthesis, ...synthesis }
                        }));
                        if (onNext) onNext();
                    }}
                    disabled={isClosed}
                    className="bg-indigo-600 text-white font-bold py-3 px-6 rounded-xl shadow-md shadow-indigo-200 hover:bg-indigo-700 hover:shadow-lg transition-all flex items-center gap-2"
                >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    Sintetizar hallazgos físicos y continuar
                </button>
            </div>
        </div>
    );
}
