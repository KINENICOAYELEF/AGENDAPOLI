import { useState, useEffect } from "react";
import { Evolucion } from "@/types/clinica";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useYear } from "@/context/YearContext";
import { useAuth } from "@/context/AuthContext";

const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

// Calcula la diferencia en horas
const getDifferenceInHours = (date1Str: string, date2Str: string) => {
    const d1 = new Date(date1Str).getTime();
    const d2 = new Date(date2Str).getTime();
    return Math.abs(d2 - d1) / (1000 * 60 * 60);
};

// Formatea ISO string a Date-Time Local HTML compatible
const toDateTimeLocal = (isoString?: string) => {
    if (!isoString) return "";
    try {
        const d = new Date(isoString);
        // Ajuste zona horaria local para formato YYYY-MM-DDTHH:mm
        return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    } catch {
        return "";
    }
};

interface EvolucionFormProps {
    usuariaId: string;
    initialData: Evolucion | null;
    onClose: () => void;
    onSaveSuccess: (evolucion: Evolucion, isNew: boolean) => void;
}

export function EvolucionForm({ usuariaId, initialData, onClose, onSaveSuccess }: EvolucionFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    // Si viene `initialData`, significa que estamos en modo EDIT.
    const isEditMode = !!initialData;
    const isClosed = initialData?.estado === "CERRADA"; // Inmutable si está cerrada

    const [loading, setLoading] = useState(false);

    // Estado interno del formulario (Copia Inicial)
    const [formData, setFormData] = useState<Partial<Evolucion>>({
        usuariaId,
        fechaHoraAtencion: new Date().toISOString(),
        dolorInicio: "",
        objetivoSesion: "",
        intervenciones: "",
        ejerciciosPrescritos: "",
        dolorSalida: "",
        planProximaSesion: "",
        estado: "BORRADOR",
        lateCloseReason: ""
    });

    // Control para la regla de las 36 Horas
    const [requiresLateReason, setRequiresLateReason] = useState(false);
    // Para poder cancelar el intento de cierre y pedir texto:
    const [isAttemptingClose, setIsAttemptingClose] = useState(false);

    // Dropdown + Texto para justificación
    const [lateCategory, setLateCategory] = useState("");
    const [lateText, setLateText] = useState("");

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (!val) return;
        setFormData(prev => ({ ...prev, fechaHoraAtencion: new Date(val).toISOString() }));
    };

    // Método universal de Guardado para Borrador o Cierre
    const executeSave = async (finalData: Partial<Evolucion>, willClose: boolean) => {
        if (!globalActiveYear || !user) {
            alert("No hay un Año de Programa activo seleccionado o sesión inválida.");
            return;
        }

        try {
            setLoading(true);
            const targetId = isEditMode && initialData?.id ? initialData.id : generateId();

            const payload: Evolucion = {
                // Forzamos la estructura garantizando que cumpla el contrato
                id: targetId,
                usuariaId,
                casoId: finalData.casoId || null,
                sesionId: finalData.sesionId || null,
                fechaHoraAtencion: finalData.fechaHoraAtencion!,

                // Autor (Firebase Auth injection segura)
                autorUid: initialData?.autorUid || user.uid,
                autorName: initialData?.autorName || user.email || "Clínico Anónimo",

                // Data
                dolorInicio: finalData.dolorInicio ?? "",
                objetivoSesion: finalData.objetivoSesion || "",
                intervenciones: finalData.intervenciones || "",
                ejerciciosPrescritos: finalData.ejerciciosPrescritos || "",
                dolorSalida: finalData.dolorSalida ?? "",
                planProximaSesion: finalData.planProximaSesion || "",

                // Legal
                estado: finalData.estado as 'BORRADOR' | 'CERRADA',
                lateCloseReason: finalData.lateCloseReason || "",

                // Meta
                createdAt: initialData?.createdAt || new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                closedAt: willClose ? new Date().toISOString() : undefined,
                _migratedFromLegacy: initialData?._migratedFromLegacy,
                _sourcePath: initialData?._sourcePath
            };

            const docRef = doc(db, "programs", globalActiveYear, "evoluciones", targetId);

            await setDocCounted(docRef, payload, { merge: true });
            onSaveSuccess(payload, !isEditMode);

        } catch (error) {
            console.error("Error al guardar Evolución", error);
            alert("Ha ocurrido un error al conectar con la base de datos.");
        } finally {
            setLoading(false);
            setIsAttemptingClose(false);
        }
    };

    // Handler para apretar "Guardar Borrador"
    const handleSaveDraft = (e: React.FormEvent) => {
        e.preventDefault();
        const copy = { ...formData, estado: "BORRADOR" as const };
        executeSave(copy, false);
    };

    // Handler para apretar "Cerrar Evolución"
    const handleAttemptClose = () => {
        if (isClosed) return;

        // Validación 1: Campos mínimos
        if (!formData.dolorInicio || !formData.objetivoSesion || !formData.intervenciones || !formData.dolorSalida || !formData.planProximaSesion) {
            alert("Para CERRAR la evolución debe completar los campos clínicos mínimos (EVAs, Objetivos, Intervenciones y Plan).");
            return;
        }

        // Validación 2: Regla Estricta 36 Horas
        const hoursPassed = getDifferenceInHours(formData.fechaHoraAtencion!, new Date().toISOString());

        if (hoursPassed > 36) {
            setRequiresLateReason(true);
            setIsAttemptingClose(true);
            return; // Cortamos flujo si falta el motivo
        }

        // Si es menor a 36h, cerramos felizmente
        const copy = { ...formData, estado: "CERRADA" as const };
        executeSave(copy, true);
    };

    // Cuando superó 36hrs y ahora escribe la justificación para confirmar el cierre final
    const confirmLateClose = (e: React.FormEvent) => {
        e.preventDefault();
        if (!lateCategory) {
            alert("Debe seleccionar una Categoría de Motivo para el cierre tardío.");
            return;
        }
        if (lateText.trim().length < 5) {
            alert("Debe agregar un detalle específico del motivo (mínimo 5 caracteres).");
            return;
        }
        const finalReason = `[${lateCategory}] ${lateText}`;
        const copy = { ...formData, estado: "CERRADA" as const, lateCloseReason: finalReason };
        executeSave(copy, true);
    };

    return (
        <div className="space-y-6">

            {/* Cabecera Estado */}
            <div className={`p-4 rounded-lg flex justify-between items-center ${isClosed ? 'bg-red-50 border border-red-200' : 'bg-blue-50 border border-blue-200'}`}>
                <div>
                    <h3 className="font-bold uppercase tracking-wider text-xs mb-1 opacity-70">Estado del Registro</h3>
                    <div className="font-medium">
                        {isClosed ? (
                            <span className="text-red-700">🔒 Evolución Cerrada e Inmutable</span>
                        ) : (
                            <span className="text-blue-700">📝 En Borrador (Editable)</span>
                        )}
                    </div>
                </div>
                {!isEditMode && <span className="text-xs bg-white/50 px-2 py-1 rounded text-slate-500 font-mono">ID: Autogenerado</span>}
                {isEditMode && <span className="text-xs bg-white/50 px-2 py-1 rounded text-slate-500 font-mono">ID: {initialData?.id}</span>}
            </div>

            {/* FORMULARIO CLINICO */}
            <form onSubmit={handleSaveDraft} id="evolution-form" className="space-y-8">

                {/* 1. Métrica Base */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 transition-all hover:border-slate-300">
                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                        Datos Administrativos de Sesión
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Fecha y Hora Real de Atención <span className="text-rose-500">*</span></label>
                            <input
                                type="datetime-local"
                                value={toDateTimeLocal(formData.fechaHoraAtencion as string)}
                                onChange={handleDateChange}
                                disabled={isClosed}
                                max={toDateTimeLocal(new Date().toISOString())}
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-slate-50 disabled:text-slate-500 transition-all font-medium text-slate-700 shadow-sm"
                                required
                            />
                            <p className="text-[10px] text-slate-400 mt-1.5 font-medium">Momento bioético del servicio. Un atraso al registrar mayor a 36hrs exigirá justificación de auditoría.</p>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Clínico Responsable</label>
                            <input
                                type="text"
                                disabled
                                value={initialData?.autorName || user?.email || "Cargando..."}
                                className="w-full border border-slate-200 bg-slate-50 rounded-xl px-4 py-2.5 text-sm text-slate-500 cursor-not-allowed font-medium shadow-inner"
                            />
                        </div>
                    </div>
                </div>

                {/* 2. Subjetivo y Objetivos */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 transition-all hover:border-slate-300">
                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
                        Evaluación y Planificación (S.O.A.P)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Dolor Inicio (EVA) <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="number" min="0" max="10"
                                    name="dolorInicio"
                                    value={formData.dolorInicio}
                                    onChange={handleChange}
                                    disabled={isClosed}
                                    placeholder="0-10"
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 transition-all font-bold text-slate-800 shadow-sm"
                                />
                                <span className="absolute right-4 top-2.5 text-slate-400 font-bold text-sm pointer-events-none">/ 10</span>
                            </div>
                        </div>
                        <div className="md:col-span-9">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Objetivo Específico de la Sesión <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                name="objetivoSesion"
                                value={formData.objetivoSesion}
                                onChange={handleChange}
                                disabled={isClosed}
                                placeholder="Ej: Disminuir dolor peripatelar y reactivación de cuádriceps post-operatorio."
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 disabled:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {/* 3. CORE: Tratamientos y Ejercicios */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Terapias Pasivas */}
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs lg:col-span-4 flex flex-col transition-all hover:border-slate-300">
                        <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2 mb-4">
                            <svg className="w-4 h-4 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11" /></svg>
                            Intervenciones / Agentes
                        </h3>
                        <textarea
                            name="intervenciones"
                            value={formData.intervenciones}
                            onChange={handleChange}
                            disabled={isClosed}
                            placeholder="Manejo de tejidos blandos, TENS, educación de dolor..."
                            className="flex-1 w-full border border-slate-300 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 resize-none disabled:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm min-h-[160px]"
                        />
                    </div>

                    {/* Prescripción Ejercicio PREMIUM */}
                    <div className="bg-gradient-to-br from-indigo-50 via-blue-50/50 to-white p-6 rounded-2xl border-2 border-indigo-100 shadow-sm lg:col-span-8 flex flex-col relative overflow-hidden group hover:border-indigo-300 transition-all">
                        {/* Motif bg */}
                        <div className="absolute -right-10 -top-10 w-40 h-40 bg-indigo-500/5 rounded-full blur-3xl group-hover:bg-indigo-500/10 transition-colors pointer-events-none"></div>

                        <div className="flex justify-between items-start mb-4 relative z-10 border-b border-indigo-200/60 pb-3">
                            <div>
                                <h3 className="text-[11px] font-black text-indigo-800 uppercase tracking-widest flex items-center gap-2">
                                    <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 24 24"><path d="M20.57 14.86L22 13.43L20.57 12L17 15.57L8.43 7L12 3.43L10.57 2L9.14 3.43L7.71 2L5.57 4.14L4.14 2.71L2.71 4.14L4.14 5.57L2 7.71L3.43 9.14L2 10.57L3.43 12L7 8.43L15.57 17L12 20.57L13.43 22L14.86 20.57L16.29 22L18.43 19.86L19.86 21.29L21.29 19.86L19.86 18.43L22 16.29L20.57 14.86Z" /></svg>
                                    Prescripción de Ejercicio Clínico
                                </h3>
                                <p className="text-[10px] text-indigo-600/80 font-bold mt-1 max-w-sm">Módulo central para analítica de datos futura. Es vital estructurar Carga, Series y Repeticiones.</p>
                            </div>
                            <span className="bg-indigo-100 text-indigo-700 text-[9px] font-black px-2 py-1 rounded uppercase tracking-wider">Prioridad Analítica</span>
                        </div>

                        <textarea
                            name="ejerciciosPrescritos"
                            value={formData.ejerciciosPrescritos}
                            onChange={handleChange}
                            disabled={isClosed}
                            placeholder="Ejemplo de estructura recomendada:&#10;&#10;1. Sentadilla Búlgara | 3 x 12 | Mancuernas 10kg | RIR 2&#10;2. Puente Glúteo Unipedal | 4 x 15 | Bande Elástica Fuerte&#10;3. Control Motor Lumbo-pélvico | 3 x 1 min | Fitball"
                            className="flex-1 w-full bg-white/80 border border-indigo-200/80 backdrop-blur-sm rounded-xl px-5 py-4 text-sm outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-y disabled:bg-slate-50 transition-all font-medium text-slate-800 shadow-inner min-h-[160px] relative z-10 placeholder:text-indigo-300/80 placeholder:font-normal leading-relaxed"
                        />
                    </div>
                </div>

                {/* 4. Cierre y Pronostico */}
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs space-y-4 transition-all hover:border-slate-300">
                    <h3 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-3 flex items-center gap-2">
                        <svg className="w-4 h-4 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
                        Resultados y Pronóstico
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                        <div className="md:col-span-3">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Dolor Salida (EVA) <span className="text-rose-500">*</span></label>
                            <div className="relative">
                                <input
                                    type="number" min="0" max="10"
                                    name="dolorSalida"
                                    value={formData.dolorSalida}
                                    onChange={handleChange}
                                    disabled={isClosed}
                                    placeholder="0-10"
                                    className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-50 transition-all font-bold text-slate-800 shadow-sm"
                                />
                                <span className="absolute right-4 top-2.5 text-slate-400 font-bold text-sm pointer-events-none">/ 10</span>
                            </div>
                        </div>
                        <div className="md:col-span-9">
                            <label className="block text-xs font-bold text-slate-700 mb-1.5 uppercase tracking-wide">Hito Logrado y Tarea Próxima Sesión <span className="text-rose-500">*</span></label>
                            <input
                                type="text"
                                name="planProximaSesion"
                                value={formData.planProximaSesion}
                                onChange={handleChange}
                                disabled={isClosed}
                                placeholder="Ej: Disminuyó el dolor un 40%. Próxima sesión progresar cargas excéntricas."
                                className="w-full border border-slate-300 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-rose-500 focus:border-rose-500 disabled:bg-slate-50 transition-all font-medium text-slate-700 shadow-sm"
                            />
                        </div>
                    </div>
                </div>

                {isClosed && initialData?.lateCloseReason && (
                    <div className="bg-amber-50 p-5 border border-amber-200 rounded-xl mt-4 flex items-start gap-4 shadow-sm">
                        <div className="bg-amber-100 p-2 rounded-full mt-1">
                            <svg className="w-5 h-5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                        </div>
                        <div>
                            <h4 className="text-sm font-extrabold text-amber-900 border-b border-amber-200/50 pb-1 mb-2">Justificación de Auditoría por Cierre Extraordinario (&gt;36 hrs)</h4>
                            <p className="text-sm text-amber-800 font-medium italic bg-amber-100/50 p-3 rounded-lg border border-amber-200/50">"{initialData.lateCloseReason}"</p>
                        </div>
                    </div>
                )}
            </form>

            <hr className="border-slate-200 my-6" />

            {/* SECCIÓN ACCIONES LEGALES Y 36 HORAS */}
            {isAttemptingClose && requiresLateReason ? (
                // PANTALLA TRAMPA 36 HORAS
                <div className="bg-amber-100 p-6 rounded-xl border border-amber-300 space-y-4 shadow-sm animate-in fade-in slide-in-from-bottom-2">
                    <div className="flex items-start gap-3">
                        <div className="text-amber-600 mt-1">
                            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                        </div>
                        <div>
                            <h4 className="font-bold text-amber-900 border-b border-amber-200 pb-1 inline-block">Cierre Extemporáneo Detectado</h4>
                            <p className="text-sm text-amber-800 mt-2">
                                Han transcurrido <b>más de 36 horas</b> desde la fecha médica indicada de la sesión.
                                Por protocolo bioético, para cerrar permanentemente esta evolución debe justificar el motivo del atraso al completar el legajo. Éste no podrá modificarse luego de firmarlo.
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <select
                            value={lateCategory}
                            onChange={(e) => setLateCategory(e.target.value)}
                            className="w-full p-3 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 bg-white font-medium text-amber-900"
                        >
                            <option value="" disabled>Seleccione el motivo médico/administrativo...</option>
                            <option value="Corte de Energía/Internet">Corte de Energía / Sin Internet en Clínica</option>
                            <option value="Traspaso desde Papel">Traspaso de registro físico (Papel) al sistema</option>
                            <option value="Emergencia Clínica">Emergencia Clínica / Paciente Descompensado</option>
                            <option value="Error de Sistema">Fallo temporal de la plataforma o dispositivo</option>
                            <option value="Olvido/Omisión Administrativa">Olvido u Omisión Administrativa</option>
                            <option value="Otro">Otro motivo (Especificar debajo)</option>
                        </select>

                        <textarea
                            value={lateText}
                            onChange={(e) => setLateText(e.target.value)}
                            placeholder="Detalle obligatoriamente la justificación del cierre extemporáneo..."
                            className="w-full p-3 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 bg-white"
                            rows={2}
                        />
                    </div>

                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsAttemptingClose(false)}
                            className="bg-white px-4 py-2 font-medium text-slate-600 hover:bg-slate-50 rounded border border-slate-200 transition"
                        >
                            Quiero dejar el registro abierto en Borrador
                        </button>
                        <button
                            type="button"
                            onClick={confirmLateClose}
                            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded shadow-sm transition"
                        >
                            Firmar Justificativo y Cerrar Evolución
                        </button>
                    </div>
                </div>

            ) : (
                // BARRA BOTONES HABITUAL (Solo visuales si no está CERRADA)
                <div className="flex justify-between items-center">
                    <div>
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-5 py-2 rounded font-medium text-slate-600 hover:bg-slate-100 transition"
                        >
                            Volver Atrás
                        </button>
                    </div>

                    {!isClosed && (
                        <div className="flex gap-2">
                            <button
                                type="submit"
                                form="evolution-form" // Triggers onSaveDraft
                                disabled={loading}
                                className="px-5 py-2 rounded border border-slate-300 font-medium text-slate-700 bg-white hover:bg-slate-50 transition flex items-center gap-2 shadow-sm"
                            >
                                {loading && <span className="animate-spin text-slate-400">↻</span>}
                                Guardar Borrador
                            </button>
                            <button
                                type="button"
                                onClick={handleAttemptClose}
                                disabled={loading}
                                className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition"
                            >
                                Validar y Cierre Total
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
