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
        <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden relative max-w-2xl mx-auto">
            {/* Header */}
            <div className="bg-amber-500 py-3 px-5 text-white flex justify-between items-center">
                <h3 className="font-bold">
                    {isEditMode ? "Modificar Estado de Proceso" : "Abriendo Nuevo Proceso"}
                </h3>
                <button onClick={onClose} className="text-amber-100 hover:text-white transition">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-5 flex flex-col items-center justify-center">
                <div className="w-full">
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Motivo / Diagnóstico Preliminar <span className="text-red-500">*</span></label>
                    <textarea
                        name="motivoIngresoLibre"
                        value={formData.motivoIngresoLibre}
                        onChange={handleChange}
                        placeholder="Ej. Derivación por esguince tobillo derecho grado II. Limitación funcional al trote..."
                        rows={3}
                        className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none text-sm resize-none"
                        required
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Estado Clínico</label>
                        <select
                            name="estado"
                            value={formData.estado}
                            onChange={handleChange}
                            className={`w-full border rounded-lg px-3 py-2 outline-none text-sm font-medium
                                ${formData.estado === 'ACTIVO' ? 'bg-green-50 text-green-800 border-green-200' : ''}
                                ${formData.estado === 'PAUSADO' ? 'bg-amber-50 text-amber-800 border-amber-200' : ''}
                                ${formData.estado === 'ALTA' ? 'bg-blue-50 text-blue-800 border-blue-200' : ''}
                                ${formData.estado === 'CERRADO_ADMIN' ? 'bg-slate-100 text-slate-800 border-slate-300' : ''}
                            `}
                        >
                            <option value="ACTIVO">Activo (En tratamiento)</option>
                            <option value="PAUSADO">Pausado (Ausencia temporal)</option>
                            <option value="ALTA">Alta Médica (Finalizado)</option>
                            {user?.role === "DOCENTE" && (
                                <option value="CERRADO_ADMIN">Cierre Administrativo (Forzado)</option>
                            )}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Ingreso / Origen</label>
                        <input
                            type="datetime-local"
                            name="fechaInicio"
                            value={formData.fechaInicio as string}
                            onChange={handleChange}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-amber-500 outline-none text-sm font-mono"
                            required
                        />
                    </div>
                </div>

                {/* Si marcan Alta o Bloqueo, pedir o mostrar fecha cierre */}
                {(formData.estado === 'ALTA' || formData.estado === 'CERRADO_ADMIN') && (
                    <div className="w-full p-4 bg-slate-50 border border-slate-200 rounded-lg animate-in fade-in">
                        <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha de Cierre Efectiva</label>
                        <input
                            type="datetime-local"
                            name="fechaAlta"
                            value={formData.fechaAlta as string || ""}
                            onChange={handleChange}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono"
                            required={(formData.estado === 'ALTA' || formData.estado === 'CERRADO_ADMIN')}
                        />
                        <p className="text-xs text-slate-500 mt-1">
                            Al definir esta fecha, el proceso dejará de aceptar Evoluciones nuevas de forma natural.
                        </p>
                    </div>
                )}

                {/* Foot UI */}
                <div className="w-full pt-4 border-t border-slate-100 flex justify-end gap-3 mt-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg font-medium text-slate-600 hover:bg-slate-100 transition"
                    >
                        Cancelar
                    </button>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading && <svg className="animate-spin h-4 w-4 text-white" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>}
                        {isEditMode ? "Actualizar Proceso" : "Crear e Iniciar"}
                    </button>
                </div>
            </form>
        </div>
    );
}
