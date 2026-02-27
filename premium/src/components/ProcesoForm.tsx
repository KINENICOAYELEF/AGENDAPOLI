import { useState, useEffect } from "react";
import { Proceso } from "@/types/clinica";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import { ProcesosService } from "@/services/procesos";

// Helper generador de UUID local
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

interface ProcesoFormProps {
    personaUsuariaId: string;
    initialData: Proceso | null;
    onClose: () => void;
    onSaveSuccess: (saved: Proceso, isNew: boolean) => void;
}

export function ProcesoForm({ personaUsuariaId, initialData, onClose, onSaveSuccess }: ProcesoFormProps) {
    const { globalActiveYear } = useYear();
    const { user } = useAuth();

    const isEditMode = !!initialData;
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState<Partial<Proceso>>({
        estado: 'ACTIVO',
        fechaInicio: new Date().toISOString().slice(0, 16), // YYYY-MM-DDThh:mm
        motivoIngresoLibre: "",
        fechaAlta: null
    });

    useEffect(() => {
        if (initialData) {
            setFormData({
                ...initialData,
                // Si la fecha y hora está en full ISO, recortamos para el input datetime-local
                fechaInicio: initialData.fechaInicio ? new Date(initialData.fechaInicio).toISOString().slice(0, 16) : '',
                fechaAlta: initialData.fechaAlta ? new Date(initialData.fechaAlta).toISOString().slice(0, 16) : ''
            });
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!globalActiveYear || !user) {
            alert("Error de sesión o entorno. Refresca la página.");
            return;
        }

        if (!formData.motivoIngresoLibre || formData.motivoIngresoLibre.trim() === "") {
            alert("El Motivo de Ingreso es obligatorio para justificar el proceso.");
            return;
        }

        try {
            setLoading(true);

            // Validar coherencia de fechas si es alta
            if (formData.estado === 'ALTA' && !formData.fechaAlta) {
                // Autocompletar con AHORA si dictan alta sin fecha
                formData.fechaAlta = new Date().toISOString();
            }
            if (formData.estado !== 'ALTA' && formData.estado !== 'CERRADO_ADMIN') {
                formData.fechaAlta = null; // Limpiar si lo devuelven a activo
            }

            const targetId = isEditMode && initialData?.id ? initialData.id : generateId();

            const payload: Proceso = {
                id: targetId,
                personaUsuariaId,
                estado: formData.estado as Proceso['estado'],
                fechaInicio: new Date(formData.fechaInicio as string).toISOString(),
                motivoIngresoLibre: formData.motivoIngresoLibre as string,
                fechaAlta: formData.fechaAlta ? new Date(formData.fechaAlta as string).toISOString() : null,

                // Tracing
                createdByUid: isEditMode ? (initialData!.createdByUid) : user.uid,
                createdByName: isEditMode ? (initialData!.createdByName) : (user.email || 'Desconocido'),
                createdAt: isEditMode ? initialData!.createdAt : new Date().toISOString(),
                updatedAt: new Date().toISOString()
            };

            await ProcesosService.save(globalActiveYear, payload);
            onSaveSuccess(payload, !isEditMode);

        } catch (error) {
            console.error("Error guardando proceso", error);
            alert("Error al conectar con la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.08)] border border-slate-100 overflow-hidden relative max-w-2xl mx-auto">
            {/* Header */}
            <div className="bg-slate-50/80 backdrop-blur-sm border-b border-slate-100 py-4 px-6 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                    {isEditMode ? (
                        <>
                            <svg className="w-5 h-5 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            Detalles del Proceso
                        </>
                    ) : (
                        <>
                            <div className="bg-indigo-100 text-indigo-600 p-1.5 rounded-lg flex items-center justify-center">
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" /></svg>
                            </div>
                            Apertura de Proceso
                        </>
                    )}
                </h3>
                <button onClick={onClose} className="text-slate-400 hover:text-slate-600 hover:bg-slate-100 p-2 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-6 flex flex-col">
                <div className="w-full">
                    <label className="block text-sm font-bold text-slate-700 mb-1.5">Diagnóstico o Motivo Principal <span className="text-rose-500">*</span></label>
                    <textarea
                        name="motivoIngresoLibre"
                        value={formData.motivoIngresoLibre}
                        onChange={handleChange}
                        placeholder="Ej. Derivación por esguince tobillo derecho..."
                        rows={3}
                        className="w-full border border-slate-200 rounded-xl px-4 py-3 bg-slate-50/50 focus:bg-white focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none text-sm resize-none"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Estado actual</label>
                        <div className="relative">
                            <select
                                name="estado"
                                value={formData.estado}
                                onChange={handleChange}
                                className={`w-full appearance-none border rounded-xl px-4 py-3 outline-none text-sm font-semibold cursor-pointer transition-all
                                    ${formData.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200 focus:ring-emerald-100 focus:border-emerald-400' : ''}
                                    ${formData.estado === 'PAUSADO' ? 'bg-amber-50 text-amber-700 border-amber-200 focus:ring-amber-100 focus:border-amber-400' : ''}
                                    ${formData.estado === 'ALTA' ? 'bg-sky-50 text-sky-700 border-sky-200 focus:ring-sky-100 focus:border-sky-400' : ''}
                                    ${formData.estado === 'CERRADO_ADMIN' ? 'bg-slate-100 text-slate-600 border-slate-300' : ''}
                                `}
                            >
                                <option value="ACTIVO">Activo (En tratamiento)</option>
                                <option value="PAUSADO">Pausado (Ausencia temporal)</option>
                                <option value="ALTA">Alta Médica (Finalizado)</option>
                                {user?.role === "DOCENTE" && (
                                    <option value="CERRADO_ADMIN">Cierre Admin Forzado</option>
                                )}
                            </select>
                            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-slate-500">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                            </div>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1.5">Fecha de Apertura</label>
                        <input
                            type="datetime-local"
                            name="fechaInicio"
                            value={formData.fechaInicio as string}
                            onChange={handleChange}
                            className="w-full border border-slate-200 bg-slate-50/50 focus:bg-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-indigo-100 focus:border-indigo-400 transition-all outline-none text-sm font-medium"
                            required
                        />
                    </div>
                </div>

                {/* Si marcan Alta o Bloqueo, pedir o mostrar fecha cierre */}
                {(formData.estado === 'ALTA' || formData.estado === 'CERRADO_ADMIN') && (
                    <div className="w-full p-5 bg-sky-50/50 border border-sky-100 rounded-xl animate-in fade-in slide-in-from-top-2">
                        <label className="block text-sm font-bold text-sky-900 mb-1.5">Fecha Efectiva de Cierre</label>
                        <input
                            type="datetime-local"
                            name="fechaAlta"
                            value={formData.fechaAlta as string || ""}
                            onChange={handleChange}
                            className="w-full border border-sky-200 bg-white rounded-xl px-4 py-3 focus:ring-2 focus:ring-sky-100 focus:border-sky-400 transition-all outline-none text-sm font-medium"
                            required={(formData.estado === 'ALTA' || formData.estado === 'CERRADO_ADMIN')}
                        />
                        <p className="text-xs text-sky-600 mt-2 flex items-center gap-1.5 font-medium">
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                            Al confirmar, el proceso se sella y finaliza.
                        </p>
                    </div>
                )}

                {/* Foot UI */}
                <div className="w-full pt-6 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-5 py-2.5 rounded-xl font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm shadow-indigo-200 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isEditMode ? "Guardar Cambios" : "Iniciar Tratamiento"}
                    </button>
                </div>
            </form>
        </div>
    );
}
