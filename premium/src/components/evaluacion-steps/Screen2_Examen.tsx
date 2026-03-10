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

    const v4 = formData.interview?.v4;
    const focoPrincipal = v4?.focos?.find(f => f.esPrincipal) || v4?.focos?.[0];
    const lado = focoPrincipal?.lado || "No definido";
    const queja = v4?.experienciaPersona?.prioridadPrincipal || "No definida";
    const irritabilidad = focoPrincipal?.irritabilidadAuto?.nivel || "No definido";
    const alertasActivas = [
        v4?.seguridad?.fiebre_sistemico_cancerPrevio && "Fiebre/Sistémico/Cáncer",
        v4?.seguridad?.bajaPeso_noIntencionada && "Baja de peso",
        v4?.seguridad?.dolorNocturno_inexplicable_noMecanico && "Dolor nocturno no mecánico",
        v4?.seguridad?.trauma_altaEnergia_caidaImportante && "Trauma alta energía",
        v4?.seguridad?.neuroGraveProgresivo_esfinteres_sillaMontar && "Neuro grave/Esfínteres",
        v4?.seguridad?.sospechaFractura_incapacidadCarga && "Sospecha fractura/Incapacidad carga"
    ].filter(Boolean).join(", ");
    const alertas = alertasActivas || "Ninguna alerta roja detectada";

    const handleUpdateExam = (field: string, value: string) => {
        updateFormData((prev) => ({
            guidedExam: { ...prev.guidedExam, [field]: value }
        }));
    };

    const blocks = [
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
            {/* A. ENCABEZADO Y CONTEXTO HEREDADO */}
            <div className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-slate-200 flex flex-col gap-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-black text-slate-800 tracking-tight">A. Inicio del examen físico</h2>
                            <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100 transition-colors" title="Usa esta franja para definir qué vas a re-evaluar al final del examen. No diagnostica. Solo orienta el examen físico de hoy.">
                                ?
                            </button>
                        </div>
                        <p className="text-sm text-slate-500 mt-1">Contexto clínico heredado desde la Anamnesis (P1).</p>
                    </div>
                    <div className="shrink-0 flex items-center justify-center w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full font-bold text-xl">
                        🩺
                    </div>
                </div>

                {/* Info heredada de P1 (Sólo Lectura) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Foco Principal</p>
                        <p className="text-sm font-medium text-slate-700">{focoPrincipal ? `Foco ${v4?.focos?.indexOf(focoPrincipal)! + 1}` : 'No definido'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Lado</p>
                        <p className="text-sm font-medium text-slate-700">{lado}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Irritabilidad</p>
                        <p className="text-sm font-medium text-slate-700 flex items-center gap-2">
                            {irritabilidad === "Alta" && <span className="w-2 h-2 rounded-full bg-red-500"></span>}
                            {irritabilidad === "Media" && <span className="w-2 h-2 rounded-full bg-yellow-500"></span>}
                            {irritabilidad === "Baja" && <span className="w-2 h-2 rounded-full bg-emerald-500"></span>}
                            {irritabilidad}
                        </p>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Queja Prioritaria</p>
                        <p className="text-sm font-medium text-slate-700">{queja}</p>
                    </div>
                    <div className="sm:col-span-2 md:col-span-3">
                        <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Alertas Clínicas (Red Flags)</p>
                        <p className={`text-sm font-medium ${alertasActivas ? 'text-red-600' : 'text-slate-600'}`}>{alertas}</p>
                    </div>
                </div>

                {/* Inputs de Configuración de Examen */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Modalidad de examen hoy
                        </label>
                        <select
                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            value={exam.examModality || ''}
                            onChange={(e) => handleUpdateExam('examModality', e.target.value)}
                            disabled={isClosed}
                        >
                            <option value="">Selecciona modalidad...</option>
                            <option value="Completo">Completo</option>
                            <option value="Modificado por dolor/irritabilidad">Modificado por dolor/irritabilidad</option>
                            <option value="Muy acotado por seguridad/tolerancia">Muy acotado por seguridad/tolerancia</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                            Tarea o gesto índice para re-test
                        </label>
                        <input
                            type="text"
                            className="w-full bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-400/20 disabled:bg-slate-100 disabled:cursor-not-allowed"
                            placeholder="Ej. sentadilla, levantar brazo, cambio de dirección..."
                            value={exam.retestGesture || ''}
                            onChange={(e) => handleUpdateExam('retestGesture', e.target.value)}
                            disabled={isClosed}
                        />
                    </div>
                </div>
            </div>

            {/* B. BLOQUE ESTRUCTURADO OBSERVACIÓN Y MOVIMIENTO INICIAL */}
            <div className="bg-white border text-sm border-slate-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-slate-50 p-4 flex justify-between items-start border-b border-slate-200">
                    <div>
                        <h3 className="font-bold text-slate-800 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">👀</span> B. Observación y movimiento inicial
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-slate-600">
                            Evaluación observacional estructurada
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-slate-300 bg-white text-slate-600 opacity-60 hover:opacity-100 transition-opacity" title="Abre el examen mirando al paciente en general.&#13;&#10;Registra solo lo que aporta al caso clínicamente.&#13;&#10;Usa textos breves, evita sobreescribir.">
                        ?
                    </button>
                </div>

                <div className="p-5 flex-1 flex flex-col gap-5 bg-white">
                    {irritabilidad === "Alta" && (
                        <div className="bg-red-50 border border-red-100 text-red-800 text-xs p-3 rounded-lg flex items-center gap-2 font-medium">
                            <span className="text-lg">⚠️</span> Prefiere observación, movimiento dosificado y evita sobreprovocar al inicio debido a irritabilidad alta heredada.
                        </div>
                    )}

                    <div className="grid grid-cols-1 bg-slate-50/50 p-4 rounded-xl border border-slate-100 gap-4">
                        {/* 1. Observación general */}
                        <div className="flex flex-col md:flex-row gap-4 items-start">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">1. Observación general</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Estado general, trofismo, asimetrías evidentes.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: Hallazgos que apoyen la hipótesis.</p>
                            </div>
                            <textarea
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20 min-h-[60px] resize-y"
                                placeholder="Ej. Atrofia evidente vasto medial derecho..."
                                value={exam.observationGeneral || ''}
                                onChange={(e) => handleUpdateExam('observationGeneral', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>

                        {/* 2. Postura */}
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">2. Postura / alineación</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Posición estática si aporta al problema.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: "Sin hallazgos" o asimetrías clave.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Hombro adelantado y levemente elevado..."
                                value={exam.postureAlignment || ''}
                                onChange={(e) => handleUpdateExam('postureAlignment', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>

                        {/* 3. Marcha genérica */}
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">3. Marcha o gesto habitual</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Cojera, fases de marcha o patrón base.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: Desviaciones compensatorias.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Marcha antálgica con acortamiento fase de apoyo..."
                                value={exam.gaitBasicGesture || ''}
                                onChange={(e) => handleUpdateExam('gaitBasicGesture', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>

                        {/* 4 y 5. Movimiento Activo Inicial */}
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">4. Mov. activo inicial</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Primer movimiento exploratorio libre del paciente.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: Grado visual y calidad.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Logra elevar brazo activo solo hasta 90°..."
                                value={exam.initialActiveMovement || ''}
                                onChange={(e) => handleUpdateExam('initialActiveMovement', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>
                        <div className="flex flex-col md:flex-row gap-4 items-start pt-4 border-t border-slate-100">
                            <div className="md:w-1/3">
                                <label className="block text-xs font-bold text-slate-600 uppercase tracking-wider mb-1">5. Conducta del síntoma</label>
                                <p className="text-[11px] text-slate-500">¿Qué mirar? Qué le pasa al dolor durante el gesto inicial.</p>
                                <p className="text-[11px] text-slate-500 italic">Qué registrar: "Duele al final", "Arco doloroso", etc.</p>
                            </div>
                            <input
                                type="text"
                                className="w-full md:w-2/3 bg-white border border-slate-200 text-slate-700 text-sm rounded-xl p-3 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-400/20"
                                placeholder="Ej. Pinchazo agudo al llegar a los 90° (Arco doloroso)..."
                                value={exam.symptomBehaviorMovement || ''}
                                onChange={(e) => handleUpdateExam('symptomBehaviorMovement', e.target.value)}
                                disabled={isClosed}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* C. RANGO DE MOVIMIENTO ANALÍTICO */}
            <div className="bg-white border text-sm border-indigo-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-indigo-50/50 p-4 flex justify-between items-start border-b border-indigo-200">
                    <div>
                        <h3 className="font-bold text-indigo-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">📐</span> C. Rango de movimiento analítico
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-indigo-900">
                            Movilidad activa, pasiva y end-feel
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-indigo-200 bg-white text-indigo-500 opacity-60 hover:opacity-100 transition-opacity" title="📝 Partir por exploración activa.\n👉 Pasar a pasiva si aporta o hay déficit activo.\n📐 Usar goniómetro solo si el número es relevante (ej. post-op).\n🆚 Comparar lado sano y anotar calidad del movimiento (temblor, trinquete, vacilación).">
                        ?
                    </button>
                </div>

                <div className="p-0 overflow-x-auto bg-slate-50/30">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-indigo-50/40 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 w-40 max-w-[12rem]">Articulación / Lado</th>
                                <th className="p-3 w-40 max-w-[12rem]">Movimiento</th>
                                <th className="p-3 text-center w-28">¿Activo?</th>
                                <th className="p-3 w-48">Resultado ACT</th>
                                <th className="p-3 text-center w-28">¿Pasivo?</th>
                                <th className="p-3 w-48">Resultado PAS / Tope</th>
                                <th className="p-3 w-40">EVA / Ángulo</th>
                                <th className="p-3">Calidad / Hallazgo</th>
                                <th className="p-3 w-16 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!exam.romAnaliticoConfig?.filas || exam.romAnaliticoConfig.filas.length === 0) && (
                                <tr>
                                    <td colSpan={9} className="p-8 text-center text-slate-400 italic font-medium text-sm">
                                        No hay movimientos ingresados. Presiona "+ Añadir Movimiento" para comenzar.
                                    </td>
                                </tr>
                            )}
                            {(exam.romAnaliticoConfig?.filas || []).map((fila: any, i: number) => {
                                // Lógica de Orientación Clínica Inteligente
                                let orientacionClinica = "";
                                if (fila.evalAct && fila.evalPas) {
                                    const actInt = fila.resAct === 'Completo doloroso' || fila.resAct === 'Incompleto doloroso' ? 'dolor' : (fila.resAct === 'Incompleto no doloroso' ? 'deficit' : 'ok');
                                    const actNum = fila.resAct?.includes('Incompleto') ? 0 : 1;
                                    const pasNum = fila.resPas?.includes('Incompleto') ? 0 : 1;

                                    if (actNum === 0 && pasNum === 1) { // Activo incompleto, Pasivo completo
                                        orientacionClinica = "Orientación: podría haber influencia de dolor, inhibición o componente contráctil. Interpretar con fuerza y control motor.";
                                    } else if (actNum === 0 && pasNum === 0) { // Ambos incompletos
                                        orientacionClinica = "Orientación: la limitación compartida sugiere revisar movilidad articular/tejidos no contráctiles dentro del cuadro completo.";
                                    } else if (actNum === 1 && fila.resPas === 'Completo doloroso') { // Activo y pasivo completos, pero pasivo duele
                                        orientacionClinica = "Orientación: revisar irritabilidad, sobrepresión o sensibilidad mecánica.";
                                    } else if (fila.resAct === 'Completo doloroso' || fila.resAct === 'Incompleto doloroso') {
                                        // Doloroso pero llegó, ya no evalúa rango funcional puro que es difuso en estos strings pero aplica la logica de dolor de movimiento
                                        orientacionClinica = "Orientación: registrar dolor de movimiento, no asumir déficit biológico de movilidad por sí solo.";
                                    }
                                }

                                const handleFilaChange = (campo: string, valor: any) => {
                                    const nuevasFilas = [...exam.romAnaliticoConfig.filas];
                                    nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };

                                    // Limpiezas automáticas si se desactiva
                                    if (campo === 'evalAct' && !valor) nuevasFilas[i].resAct = '';
                                    if (campo === 'evalPas' && !valor) {
                                        nuevasFilas[i].resPas = '';
                                        nuevasFilas[i].topeFinal = '';
                                    }
                                    if (campo === 'usaGoniometro' && !valor) nuevasFilas[i].grados = '';

                                    handleUpdateExam('romAnaliticoConfig', { ...exam.romAnaliticoConfig, filas: nuevasFilas });
                                };

                                return (
                                    <React.Fragment key={fila.id}>
                                        <tr className="bg-white hover:bg-slate-50/50 transition-colors group">
                                            <td className="p-3 align-top">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                    placeholder="Ej. Hombro"
                                                    value={fila.region}
                                                    onChange={(e) => handleFilaChange('region', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    value={fila.lado}
                                                    onChange={(e) => handleFilaChange('lado', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    <option value="Derecho">Derecho</option>
                                                    <option value="Izquierdo">Izquierdo</option>
                                                    <option value="Bilateral">Bilateral</option>
                                                    <option value="Axial">Axial</option>
                                                </select>
                                            </td>
                                            <td className="p-3 align-top">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="Ej. Flexión"
                                                    value={fila.movimiento}
                                                    onChange={(e) => handleFilaChange('movimiento', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                            </td>
                                            <td className="p-3 align-top text-center">
                                                <label className="relative inline-flex items-center cursor-pointer mt-2">
                                                    <input type="checkbox" className="sr-only peer" checked={fila.evalAct} onChange={(e) => handleFilaChange('evalAct', e.target.checked)} disabled={isClosed} />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-500"></div>
                                                </label>
                                            </td>
                                            <td className="p-3 align-top">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                                    value={fila.resAct}
                                                    onChange={(e) => handleFilaChange('resAct', e.target.value)}
                                                    disabled={isClosed || !fila.evalAct}
                                                >
                                                    <option value="">-- Resultado Activo --</option>
                                                    <option value="Completo no doloroso">Completo no doloroso</option>
                                                    <option value="Completo doloroso">Completo doloroso</option>
                                                    <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                    <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                </select>
                                            </td>
                                            <td className="p-3 align-top text-center border-l border-slate-100">
                                                <label className="relative inline-flex items-center cursor-pointer mt-2">
                                                    <input type="checkbox" className="sr-only peer" checked={fila.evalPas} onChange={(e) => handleFilaChange('evalPas', e.target.checked)} disabled={isClosed} />
                                                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-400"></div>
                                                </label>
                                            </td>
                                            <td className="p-3 align-top">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50 mb-2"
                                                    value={fila.resPas}
                                                    onChange={(e) => handleFilaChange('resPas', e.target.value)}
                                                    disabled={isClosed || !fila.evalPas}
                                                >
                                                    <option value="">-- Resultado Pasivo --</option>
                                                    <option value="Completo no doloroso">Completo no doloroso</option>
                                                    <option value="Completo doloroso">Completo doloroso</option>
                                                    <option value="Incompleto no doloroso">Incompleto no doloroso</option>
                                                    <option value="Incompleto doloroso">Incompleto doloroso</option>
                                                </select>
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 disabled:opacity-50"
                                                    value={fila.topeFinal}
                                                    onChange={(e) => handleFilaChange('topeFinal', e.target.value)}
                                                    disabled={isClosed || !fila.evalPas}
                                                >
                                                    <option value="">-- Tope Final --</option>
                                                    <option value="No evaluado">No evaluado</option>
                                                    <option value="Blando">Blando (Aproximación tej.)</option>
                                                    <option value="Firme">Firme (Cápsula/Lig.)</option>
                                                    <option value="Duro">Duro (Hueso-Hueso)</option>
                                                    <option value="Vacío">Vacío (Dolor excesivo)</option>
                                                    <option value="Espástico">Espástico (Resorte)</option>
                                                </select>
                                            </td>
                                            <td className="p-3 align-top">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <span className="text-[10px] uppercase font-bold text-slate-400">EVA</span>
                                                    <input
                                                        type="number"
                                                        min="0" max="10"
                                                        className="w-16 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                        placeholder="0-10"
                                                        value={fila.eva}
                                                        onChange={(e) => handleFilaChange('eva', e.target.value)}
                                                        disabled={isClosed}
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" className="rounded text-indigo-500 w-3 h-3 border-slate-300" checked={fila.usaGoniometro} onChange={(e) => handleFilaChange('usaGoniometro', e.target.checked)} disabled={isClosed} />
                                                        <span className="text-[10px] uppercase font-bold text-slate-400">Gon.</span>
                                                    </label>
                                                    {fila.usaGoniometro && (
                                                        <input
                                                            type="text"
                                                            className="w-16 text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                            placeholder="Grados°"
                                                            value={fila.grados}
                                                            onChange={(e) => handleFilaChange('grados', e.target.value)}
                                                            disabled={isClosed}
                                                        />
                                                    )}
                                                </div>
                                            </td>
                                            <td className="p-3 align-top">
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 mb-2"
                                                    placeholder="Calidad/Compensación (ej. temblor)"
                                                    value={fila.calidad}
                                                    onChange={(e) => handleFilaChange('calidad', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                                <input
                                                    type="text"
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                                                    placeholder="Hallazgo breve"
                                                    value={fila.hallazgo}
                                                    onChange={(e) => handleFilaChange('hallazgo', e.target.value)}
                                                    disabled={isClosed}
                                                />
                                            </td>
                                            <td className="p-3 align-top text-center border-l border-slate-100">
                                                <button
                                                    onClick={() => {
                                                        const nuevasFilas = exam.romAnaliticoConfig.filas.filter((_: any, idx: number) => idx !== i);
                                                        handleUpdateExam('romAnaliticoConfig', { ...exam.romAnaliticoConfig, filas: nuevasFilas });
                                                    }}
                                                    disabled={isClosed}
                                                    className="w-8 h-8 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 mt-2 mx-auto disabled:opacity-0"
                                                    title="Eliminar fila"
                                                >
                                                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                                </button>
                                            </td>
                                        </tr>
                                        {orientacionClinica && (
                                            <tr className="bg-indigo-50/20 border-b border-indigo-100">
                                                <td colSpan={9} className="p-3">
                                                    <div className="flex gap-2 items-start text-xs text-indigo-800 font-medium">
                                                        <span className="text-sm mt-[-2px]">💡</span>
                                                        <p>{orientacionClinica}</p>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <button
                        onClick={() => {
                            const configBase = exam.romAnaliticoConfig || { filas: [], configTejidos: { mostrar: false, filas: [] } };
                            const nuevaFila = {
                                id: Date.now().toString(), region: '', lado: 'Derecho', movimiento: '',
                                evalAct: true, evalPas: false, resAct: '', resPas: '', topeFinal: '',
                                eva: '', usaGoniometro: false, grados: '', calidad: '', hallazgo: ''
                            };
                            handleUpdateExam('romAnaliticoConfig', { ...configBase, filas: [...configBase.filas, nuevaFila] });
                        }}
                        disabled={isClosed}
                        className="text-sm font-bold text-indigo-600 bg-white border border-indigo-200 px-4 py-2 rounded-xl shadow-sm hover:bg-indigo-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <span>+</span> Añadir Movimiento
                    </button>

                    {!exam.romAnaliticoConfig?.configTejidos?.mostrar && (
                        <button
                            onClick={() => {
                                const configBase = exam.romAnaliticoConfig || { filas: [] };
                                handleUpdateExam('romAnaliticoConfig', {
                                    ...configBase,
                                    configTejidos: { mostrar: true, filas: [] }
                                });
                            }}
                            disabled={isClosed}
                            className="text-xs font-semibold text-slate-500 hover:text-indigo-600 transition-colors underline underline-offset-2"
                        >
                            + Añadir análisis específico de tejido (Opcional)
                        </button>
                    )}
                </div>

                {/* Submódulo opcional de Tejidos */}
                {exam.romAnaliticoConfig?.configTejidos?.mostrar && (
                    <div className="border-t-2 border-dashed border-indigo-100 bg-indigo-50/20 p-4 animate-in fade-in duration-300">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="text-sm font-bold text-indigo-900 flex items-center gap-2">
                                🧬 Movilidad / longitud de tejidos (Submódulo)
                            </h4>
                            <button
                                onClick={() => {
                                    const configBase = exam.romAnaliticoConfig || { filas: [] };
                                    handleUpdateExam('romAnaliticoConfig', {
                                        ...configBase,
                                        configTejidos: { mostrar: false, filas: [] }
                                    });
                                }}
                                disabled={isClosed}
                                className="text-[10px] text-red-500 uppercase font-bold tracking-widest hover:bg-red-50 px-2 py-1 rounded"
                            >
                                Quitar módulo
                            </button>
                        </div>

                        <div className="overflow-x-auto rounded-xl border border-indigo-100 bg-white shadow-sm">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-indigo-50 text-[10px] uppercase text-indigo-500 font-bold">
                                        <th className="p-3">Tejido / Músculo / Cadena</th>
                                        <th className="p-3">Lado</th>
                                        <th className="p-3">Prueba Usada</th>
                                        <th className="p-3">Resultado</th>
                                        <th className="p-3">Comentario Breve</th>
                                        <th className="p-3 w-12"></th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-indigo-50">
                                    {(exam.romAnaliticoConfig.configTejidos.filas || []).map((tejido: any, i: number) => {
                                        const handleTejidoChange = (campo: string, valor: string) => {
                                            const nuevasFilas = [...exam.romAnaliticoConfig.configTejidos.filas];
                                            nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };
                                            handleUpdateExam('romAnaliticoConfig', {
                                                ...exam.romAnaliticoConfig,
                                                configTejidos: { ...exam.romAnaliticoConfig.configTejidos, filas: nuevasFilas }
                                            });
                                        };
                                        return (
                                            <tr key={tejido.id} className="hover:bg-slate-50 group">
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Isquiosurales" value={tejido.nombre} onChange={(e) => handleTejidoChange('nombre', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" value={tejido.lado} onChange={(e) => handleTejidoChange('lado', e.target.value)} disabled={isClosed}>
                                                        <option value="Derecho">Derecho</option>
                                                        <option value="Izquierdo">Izquierdo</option>
                                                        <option value="Bilateral">Bilateral</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Elevación pierna recta (SLR)" value={tejido.prueba} onChange={(e) => handleTejidoChange('prueba', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2">
                                                    <select className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" value={tejido.resultado} onChange={(e) => handleTejidoChange('resultado', e.target.value)} disabled={isClosed}>
                                                        <option value="">-- Seleccionar --</option>
                                                        <option value="Normal">Normal</option>
                                                        <option value="Acortado">Acortado / Restringido</option>
                                                        <option value="Hiperlaxo">Hiperlaxo / Excesivo</option>
                                                        <option value="Doloroso sin restricción">Doloroso (sin restricción térmica)</option>
                                                    </select>
                                                </td>
                                                <td className="p-2">
                                                    <input type="text" className="w-full text-xs p-2 border border-slate-200 rounded outline-none focus:border-indigo-400" placeholder="Ej. Dolor ciático a 40°..." value={tejido.comentario} onChange={(e) => handleTejidoChange('comentario', e.target.value)} disabled={isClosed} />
                                                </td>
                                                <td className="p-2 text-center">
                                                    <button onClick={() => {
                                                        const nuevasFilas = exam.romAnaliticoConfig.configTejidos.filas.filter((_: any, idx: number) => idx !== i);
                                                        handleUpdateExam('romAnaliticoConfig', {
                                                            ...exam.romAnaliticoConfig,
                                                            configTejidos: { ...exam.romAnaliticoConfig.configTejidos, filas: nuevasFilas }
                                                        });
                                                    }} disabled={isClosed} className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Borrar">
                                                        ✖
                                                    </button>
                                                </td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                            <div className="p-3 bg-slate-50 border-t border-indigo-50">
                                <button
                                    onClick={() => {
                                        const configBase = exam.romAnaliticoConfig;
                                        const nuevaFila = { id: Date.now().toString(), nombre: '', lado: 'Derecho', prueba: '', resultado: '', comentario: '' };
                                        handleUpdateExam('romAnaliticoConfig', {
                                            ...configBase,
                                            configTejidos: { ...configBase.configTejidos, filas: [...configBase.configTejidos.filas, nuevaFila] }
                                        });
                                    }}
                                    disabled={isClosed}
                                    className="text-xs font-bold text-indigo-500 hover:text-indigo-700 flex items-center gap-1"
                                >
                                    + Añadir tejido
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {/* D. FUERZA Y TOLERANCIA A CARGA */}
            <div className="bg-white border text-sm border-emerald-200 rounded-2xl shadow-sm overflow-hidden flex flex-col transition-shadow hover:shadow-md">
                <div className="bg-emerald-50/50 p-4 flex justify-between items-start border-b border-emerald-200">
                    <div>
                        <h3 className="font-bold text-emerald-900 flex items-center gap-2 tracking-wide">
                            <span className="text-lg">🦾</span> D. Fuerza y tolerancia a carga
                        </h3>
                        <p className="text-[11px] font-medium opacity-80 mt-1 uppercase tracking-widest text-emerald-900">
                            Pruebas manuales, isometría, dinamometría o tests funcionales
                        </p>
                    </div>
                    <button className="text-[10px] w-6 h-6 rounded-full flex items-center justify-center border border-emerald-200 bg-white text-emerald-600 opacity-60 hover:opacity-100 transition-opacity" title="📝 Fuerza no es solo MMT (1-5). Selecciona el tipo de evaluación adecuado según los recursos disponibles (ej. dinamómetro), la irritabilidad del paciente y el objetivo clínico de la fase actual.">
                        ?
                    </button>
                </div>

                {irritabilidad === "Alta" && (
                    <div className="bg-red-50 border-b border-red-100 p-3 text-red-700 text-xs font-medium flex items-center gap-2">
                        <span className="text-sm">⚠️</span>
                        <span>Orientación: Prioriza carga dosificada y evita máximos si no son necesarios debido a la irritabilidad actual.</span>
                    </div>
                )}

                <div className="p-0 overflow-x-auto bg-slate-50/30">
                    <table className="w-full text-left border-collapse min-w-[1000px]">
                        <thead>
                            <tr className="bg-emerald-50/40 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                                <th className="p-3 w-40">Región / Patrón</th>
                                <th className="p-3 w-28">Lado</th>
                                <th className="p-3 w-40">Tipo Evaluación</th>
                                <th className="p-3 min-w-[200px]">Resultado Principal</th>
                                <th className="p-3 w-32">Dolor (Durante/Post)</th>
                                <th className="p-3 w-36">Calidad / Comparación</th>
                                <th className="p-3 w-40">Obs. Breve</th>
                                <th className="p-3 w-12 text-center"></th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {(!exam.fuerzaCargaConfig?.filas || exam.fuerzaCargaConfig.filas.length === 0) && (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic font-medium text-sm border-b border-transparent">
                                        No hay pruebas de fuerza ingresadas. Presiona "+ Añadir Prueba" para comenzar.
                                    </td>
                                </tr>
                            )}
                            {(exam.fuerzaCargaConfig?.filas || []).map((fila: any, i: number) => {
                                const handleFilaChange = (campo: string, valor: any) => {
                                    const nuevasFilas = [...exam.fuerzaCargaConfig.filas];

                                    // Limpieza condicional
                                    if (campo === 'tipoEvaluacion' && fila.tipoEvaluacion !== valor) {
                                        nuevasFilas[i].resultado = '';
                                        nuevasFilas[i].dinamometriaValor = '';
                                        nuevasFilas[i].dinamometriaUnidad = 'Kg';
                                        nuevasFilas[i].isometriaSegundos = '';
                                        nuevasFilas[i].repeticionesN = '';
                                        nuevasFilas[i].repeticionesCorte = '';
                                        nuevasFilas[i].testFuncionalNombre = '';
                                    }

                                    nuevasFilas[i] = { ...nuevasFilas[i], [campo]: valor };
                                    handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevasFilas });
                                };

                                return (
                                    <tr key={fila.id} className="bg-white hover:bg-emerald-50/30 transition-colors group">
                                        <td className="p-3 align-top">
                                            <input
                                                type="text"
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                placeholder="Ej. Cuádriceps / Push up"
                                                value={fila.region}
                                                onChange={(e) => handleFilaChange('region', e.target.value)}
                                                disabled={isClosed}
                                            />
                                        </td>
                                        <td className="p-3 align-top">
                                            <select
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                value={fila.lado}
                                                onChange={(e) => handleFilaChange('lado', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="Derecho">Derecho</option>
                                                <option value="Izquierdo">Izquierdo</option>
                                                <option value="Bilateral">Bilateral</option>
                                                <option value="Axial">Axial</option>
                                            </select>
                                        </td>
                                        <td className="p-3 align-top">
                                            <select
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400 font-medium text-emerald-700"
                                                value={fila.tipoEvaluacion}
                                                onChange={(e) => handleFilaChange('tipoEvaluacion', e.target.value)}
                                                disabled={isClosed}
                                            >
                                                <option value="">-- Seleccionar --</option>
                                                <option value="Manual">Manual (MMT)</option>
                                                <option value="Dinamometría">Dinamometría</option>
                                                <option value="Isometría mantenida">Isometría mantenida</option>
                                                <option value="Repeticiones submáximas">Reps submáximas</option>
                                                <option value="Test funcional de carga">Test Func. Carga</option>
                                            </select>
                                        </td>
                                        <td className="p-3 align-top bg-slate-50/50 border-x border-slate-100">
                                            {/* Renders Condicionales para Resultado */}
                                            {!fila.tipoEvaluacion && (
                                                <span className="text-xs text-slate-400 italic">Selecciona un tipo.</span>
                                            )}
                                            {fila.tipoEvaluacion === 'Manual' && (
                                                <select
                                                    className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-400"
                                                    value={fila.resultado}
                                                    onChange={(e) => handleFilaChange('resultado', e.target.value)}
                                                    disabled={isClosed}
                                                >
                                                    <option value="">-- Escala MRC --</option>
                                                    <option value="5 Normal">5 - Normal (Vence resistencia máxima)</option>
                                                    <option value="4 Buena">4 - Buena (Vence resistencia moderada)</option>
                                                    <option value="3 Regular">3 - Regular (Vence gravedad)</option>
                                                    <option value="2 Deficiente">2 - Deficiente (Movimiento en plano sin gravedad)</option>
                                                    <option value="1 Vestigio">1 - Vestigio (Contracción palpable sin movimiento)</option>
                                                    <option value="0 Nula">0 - Nula (Sin contracción)</option>
                                                </select>
                                            )}
                                            {fila.tipoEvaluacion === 'Dinamometría' && (
                                                <div className="flex gap-2">
                                                    <input
                                                        type="number" step="0.1" placeholder="Valor"
                                                        className="w-20 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.dinamometriaValor || ''} onChange={(e) => handleFilaChange('dinamometriaValor', e.target.value)} disabled={isClosed}
                                                    />
                                                    <select
                                                        className="w-16 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.dinamometriaUnidad || 'Kg'} onChange={(e) => handleFilaChange('dinamometriaUnidad', e.target.value)} disabled={isClosed}
                                                    >
                                                        <option value="Kg">Kg</option>
                                                        <option value="N">N</option>
                                                        <option value="Lbs">Lbs</option>
                                                    </select>
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Isometría mantenida' && (
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number" placeholder="Tiempo"
                                                        className="w-20 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.isometriaSegundos || ''} onChange={(e) => handleFilaChange('isometriaSegundos', e.target.value)} disabled={isClosed}
                                                    />
                                                    <span className="text-xs text-slate-500 font-medium">segundos</span>
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Repeticiones submáximas' && (
                                                <div className="flex flex-col gap-2">
                                                    <div className="flex items-center gap-2">
                                                        <input
                                                            type="number" placeholder="Cant."
                                                            className="w-16 text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                            value={fila.repeticionesN || ''} onChange={(e) => handleFilaChange('repeticionesN', e.target.value)} disabled={isClosed}
                                                        />
                                                        <span className="text-xs text-slate-500">reps max</span>
                                                    </div>
                                                    <input
                                                        type="text" placeholder="Ej. Corte por pérdida técnica..."
                                                        className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.repeticionesCorte || ''} onChange={(e) => handleFilaChange('repeticionesCorte', e.target.value)} disabled={isClosed}
                                                    />
                                                </div>
                                            )}
                                            {fila.tipoEvaluacion === 'Test funcional de carga' && (
                                                <div className="flex flex-col gap-2">
                                                    <input
                                                        type="text" placeholder="Nombre Test (ej. Heel raise)"
                                                        className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400 font-medium"
                                                        value={fila.testFuncionalNombre || ''} onChange={(e) => handleFilaChange('testFuncionalNombre', e.target.value)} disabled={isClosed}
                                                    />
                                                    <input
                                                        type="text" placeholder="Resultado / Criterio obs."
                                                        className="w-full text-xs bg-white border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:border-emerald-400"
                                                        value={fila.resultado || ''} onChange={(e) => handleFilaChange('resultado', e.target.value)} disabled={isClosed}
                                                    />
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.dolorDurante} onChange={(e) => handleFilaChange('dolorDurante', e.target.value)} disabled={isClosed}
                                                    title="Dolor durante la prueba"
                                                >
                                                    <option value="">-- Durante --</option>
                                                    <option value="No">No duele</option>
                                                    <option value="Leve">S/S Leve</option>
                                                    <option value="Moderado">S/S Moderado</option>
                                                    <option value="Alto">S/S Alto</option>
                                                </select>
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.dolorPosterior} onChange={(e) => handleFilaChange('dolorPosterior', e.target.value)} disabled={isClosed}
                                                    title="Dolor posterior a la prueba"
                                                >
                                                    <option value="">-- Posterior --</option>
                                                    <option value="No">No repercute</option>
                                                    <option value="Sí breve">Repercusión Breve</option>
                                                    <option value="Sí persistente">Repercusión Persistente</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <div className="flex flex-col gap-2">
                                                <select
                                                    className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.calidadEsfuerzo} onChange={(e) => handleFilaChange('calidadEsfuerzo', e.target.value)} disabled={isClosed}
                                                    title="Calidad del esfuerzo"
                                                >
                                                    <option value="">-- Calidad --</option>
                                                    <option value="Buena">Buena contracción</option>
                                                    <option value="Compensa">Patrón Compensatorio</option>
                                                    <option value="Inhibido por dolor">Inhibición por Dolor</option>
                                                    <option value="Duda / inconsistente">Dudosa / Inconsistente</option>
                                                </select>
                                                <select
                                                    className="w-full text-[11px] bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400"
                                                    value={fila.comparacion} onChange={(e) => handleFilaChange('comparacion', e.target.value)} disabled={isClosed}
                                                    title="Comparación contralateral"
                                                >
                                                    <option value="">-- Vs Contralateral --</option>
                                                    <option value="Similar">Similar (±10%)</option>
                                                    <option value="Menor">Menor (10-30% déficit)</option>
                                                    <option value="Mucho menor">Mucho menor (&gt;30%)</option>
                                                    <option value="No comparable">Lado sano afectado / NA</option>
                                                </select>
                                            </div>
                                        </td>
                                        <td className="p-3 align-top">
                                            <textarea
                                                className="w-full text-xs bg-slate-50 border border-slate-200 text-slate-700 rounded-lg p-2 outline-none focus:bg-white focus:border-emerald-400 min-h-[65px] resize-y"
                                                placeholder="Observación breve..."
                                                value={fila.observacion}
                                                onChange={(e) => handleFilaChange('observacion', e.target.value)}
                                                disabled={isClosed}
                                            />
                                        </td>
                                        <td className="p-3 align-top text-center border-l border-slate-100">
                                            <button
                                                onClick={() => {
                                                    const nuevasFilas = exam.fuerzaCargaConfig.filas.filter((_: any, idx: number) => idx !== i);
                                                    handleUpdateExam('fuerzaCargaConfig', { ...exam.fuerzaCargaConfig, filas: nuevasFilas });
                                                }}
                                                disabled={isClosed}
                                                className="w-7 h-7 rounded-full bg-red-50 text-red-500 hover:bg-red-100 hover:text-red-700 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 mt-5 mx-auto disabled:opacity-0"
                                                title="Eliminar prueba"
                                            >
                                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-slate-50 p-4 border-t border-slate-200">
                    <button
                        onClick={() => {
                            const configBase = exam.fuerzaCargaConfig || { filas: [] };
                            const nuevaFila = {
                                id: Date.now().toString(), region: '', lado: 'Derecho', tipoEvaluacion: '',
                                dolorDurante: '', dolorPosterior: '', calidadEsfuerzo: '', comparacion: '', observacion: ''
                            };
                            handleUpdateExam('fuerzaCargaConfig', { ...configBase, filas: [...configBase.filas, nuevaFila] });
                        }}
                        disabled={isClosed}
                        className="text-sm font-bold text-emerald-600 bg-white border border-emerald-200 px-4 py-2 rounded-xl shadow-sm hover:bg-emerald-50 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        <span>+</span> Añadir Prueba de Fuerza/Carga
                    </button>
                </div>
            </div>

            {/* E-K BLOQUES CLINICOS RESTANTES*/}
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
