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
        if (!formData.lateCloseReason || formData.lateCloseReason.length < 10) {
            alert("Debe justificar el motivo del cierre tardío (mínimo 10 caracteres).");
            return;
        }
        const copy = { ...formData, estado: "CERRADA" as const };
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
            <form onSubmit={handleSaveDraft} id="evolution-form" className="space-y-6">

                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider border-b pb-2">Datos de Sesión</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Fecha y Hora Real de Atención <span className="text-red-500">*</span></label>
                        <input
                            type="datetime-local"
                            value={toDateTimeLocal(formData.fechaHoraAtencion as string)}
                            onChange={handleDateChange}
                            disabled={isClosed}
                            max={toDateTimeLocal(new Date().toISOString())} // Previene fechas del futuro lejano
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-500"
                            required
                        />
                        <p className="text-[10px] text-slate-400 mt-1">
                            El momento bioético en que se brindó el servicio. Cambiarla puede incurrir en cierres tardíos.
                        </p>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Responsable / Interno</label>
                        <input
                            type="text"
                            disabled
                            value={initialData?.autorName || user?.email || "Cargando..."}
                            className="w-full border border-slate-200 bg-slate-100 rounded px-3 py-2 text-slate-500 cursor-not-allowed"
                        />
                    </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider border-b pb-2 pt-4">Evaluación y Objetivos</h3>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dolor Inicio (EVA) <span className="text-red-500">*</span></label>
                        <input
                            type="number" min="0" max="10"
                            name="dolorInicio"
                            value={formData.dolorInicio}
                            onChange={handleChange}
                            disabled={isClosed}
                            placeholder="0-10"
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                        />
                    </div>
                    <div className="md:col-span-9">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Objetivo de la Sesión <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="objetivoSesion"
                            value={formData.objetivoSesion}
                            onChange={handleChange}
                            disabled={isClosed}
                            placeholder="Ej. Disminuir dolor inflamatorio y aumentar ROM."
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                        />
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Intervenciones Aplicadas <span className="text-red-500">*</span></label>
                        <textarea
                            name="intervenciones"
                            value={formData.intervenciones}
                            onChange={handleChange}
                            disabled={isClosed}
                            rows={3}
                            placeholder="Terapias manuales, educación terapéutica, agentes físicos..."
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-slate-50"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Ejercicios Prescritos / Ejecutados</label>
                        <textarea
                            name="ejerciciosPrescritos"
                            value={formData.ejerciciosPrescritos}
                            onChange={handleChange}
                            disabled={isClosed}
                            rows={3}
                            placeholder="Control motor, fuerza isocinética (sets/reps)..."
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 resize-none disabled:bg-slate-50"
                        />
                    </div>
                </div>

                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wider border-b pb-2 pt-4">Cierre y Pronóstico</h3>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                    <div className="md:col-span-3">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Dolor Salida (EVA) <span className="text-red-500">*</span></label>
                        <input
                            type="number" min="0" max="10"
                            name="dolorSalida"
                            value={formData.dolorSalida}
                            onChange={handleChange}
                            disabled={isClosed}
                            placeholder="0-10"
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                        />
                    </div>
                    <div className="md:col-span-9">
                        <label className="block text-sm font-medium text-slate-700 mb-1">Plan para Próxima Sesión u Observaciones <span className="text-red-500">*</span></label>
                        <input
                            type="text"
                            name="planProximaSesion"
                            value={formData.planProximaSesion}
                            onChange={handleChange}
                            disabled={isClosed}
                            placeholder="Progresar cargas excéntricas, reevaluar ROM."
                            className="w-full border border-slate-300 rounded px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-slate-50"
                        />
                    </div>
                </div>

                {isClosed && initialData?.lateCloseReason && (
                    <div className="bg-amber-50 p-4 border border-amber-200 rounded mt-4">
                        <h4 className="text-sm font-bold text-amber-800">Justificación de Cierre Extraordinario</h4>
                        <p className="text-sm text-amber-900 italic mt-1">"{initialData.lateCloseReason}"</p>
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

                    <textarea
                        value={formData.lateCloseReason}
                        onChange={handleChange}
                        name="lateCloseReason"
                        placeholder="Escriba la justificación legal o administrativa de este atraso (ej. Fallo en el sistema, documentación en papel, etc.)"
                        className="w-full p-3 border border-amber-300 rounded focus:ring-2 focus:ring-amber-500 bg-white"
                        rows={3}
                    />

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
