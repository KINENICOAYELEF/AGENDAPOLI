import { useState, useEffect } from "react";
import { PersonaUsuaria } from "@/types/personaUsuaria";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useYear } from "@/context/YearContext";
import { EvolucionesManager } from "@/components/EvolucionesManager";

// Simple unificador de ID UUID/Timestamp para nuevas creaciones
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substring(2);

interface UserFormProps {
    initialData: PersonaUsuaria | null;
    onClose: () => void;
    onSaveSuccess: (savedUser: PersonaUsuaria, isNew: boolean) => void;
}

export function PersonaUsuariaForm({ initialData, onClose, onSaveSuccess }: UserFormProps) {
    const { globalActiveYear } = useYear();

    // Si viene `initialData`, significa que estamos en modo EDIT / FICHA CLÍNICA
    const isEditMode = !!initialData;

    const [loading, setLoading] = useState(false);

    // Control de Sub- vistas (Navegación esclava en modal)
    const [subView, setSubView] = useState<'main' | 'evoluciones'>('main');

    // Estado interno del formulario
    const [formData, setFormData] = useState<PersonaUsuaria>({
        nombreCompleto: "",
        rut: "",
        telefono: "",
        email: "",
        notasAdministrativas: "",
    });

    useEffect(() => {
        if (initialData) {
            setFormData(initialData);
        }
    }, [initialData]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!globalActiveYear) {
            alert("No hay un Año de Programa activo seleccionado.");
            return;
        }

        if (formData.nombreCompleto.trim() === "" || formData.rut.trim() === "") {
            alert("El Nombre Completo y el Identificador/RUT son obligatorios.");
            return;
        }

        try {
            setLoading(true);
            const targetId = isEditMode && formData.id ? formData.id : generateId();

            const payload: PersonaUsuaria = {
                ...formData,
                id: targetId,
                // Inyectamos timestamp de creación solo si es un documento nuevo
                ...(!isEditMode && { createdAt: new Date().toISOString() })
            };

            const docRef = doc(db, "programs", globalActiveYear, "usuarias", targetId);

            // Usamos nuestra capa Telemetría para inyectar a Firestore
            await setDocCounted(docRef, payload, { merge: true });

            onSaveSuccess(payload, !isEditMode);
        } catch (error) {
            console.error("Error al guardar Persona Usuaria", error);
            alert("Ha ocurrido un error al conectar con la base de datos.");
        } finally {
            setLoading(false);
        }
    };

    // --- RENDER CONDICIONAL SUB-VISTAS ---
    if (subView === 'evoluciones' && initialData?.id) {
        return (
            <EvolucionesManager
                usuariaId={initialData.id}
                usuariaName={initialData.nombreCompleto}
                onBack={() => setSubView('main')}
            />
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Campos Macro-Administrativos */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b pb-2">Identificación Base</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="nombreCompleto"
                                value={formData.nombreCompleto}
                                onChange={handleChange}
                                placeholder="Ej. Ana Pérez Gómez"
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Identificador Público (RUT / DNI) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="rut"
                                value={formData.rut}
                                onChange={handleChange}
                                placeholder="Ej. 19.123.456-7"
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono Móvil de Contacto</label>
                            <input
                                type="tel"
                                name="telefono"
                                value={formData.telefono}
                                onChange={handleChange}
                                placeholder="+56 9 XXXXXXXX"
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="paciente@correo.cl"
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div className="col-span-1 md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 mb-1">Anotaciones Administrativas</label>
                    <textarea
                        name="notasAdministrativas"
                        value={formData.notasAdministrativas}
                        onChange={handleChange}
                        placeholder="Info de horarios preferidos, acompañantes, o notas de recepción... (NO incluir datos clínicos aquí)"
                        rows={3}
                        className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none"
                    ></textarea>
                </div>
            </div>

            {/* SECCIÓN placeholders de ENLACES CLÍNICOS (SOLO VISIBLE EN EDICIÓN/FICHA CLINICA YA CREADA) */}
            {isEditMode && (
                <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-5 mt-8 space-y-4">
                    <div>
                        <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider">Módulos Clínicos Asociados</h3>
                        <p className="text-xs text-indigo-600">Acceso directo a la ficha y anexos de la persona usuaria en el periodo {globalActiveYear}</p>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        <button type="button" className="flex flex-col items-center justify-center p-3 border border-indigo-200 bg-white rounded-lg shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-not-allowed opacity-80 group">
                            <span className="text-2xl mb-1 group-hover:scale-110 transition">📋</span>
                            <span className="text-sm font-bold text-slate-700 text-center">Casos Abiertos</span>
                            <span className="text-[10px] text-amber-500 font-medium">Próximamente</span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setSubView('evoluciones')}
                            className="flex flex-col items-center justify-center p-3 border-2 border-indigo-400 bg-indigo-50 rounded-lg shadow-md hover:shadow-lg hover:border-indigo-500 transition group"
                        >
                            <span className="text-2xl mb-1 group-hover:scale-110 transition">📝</span>
                            <span className="text-sm font-bold text-indigo-900 text-center">Evoluciones</span>
                            <span className="text-[10px] text-indigo-600 font-bold bg-indigo-200 px-2 py-0.5 rounded-full mt-1">Activo</span>
                        </button>

                        <button type="button" className="flex flex-col items-center justify-center p-3 border border-indigo-200 bg-white rounded-lg shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-not-allowed opacity-80 group">
                            <span className="text-2xl mb-1 group-hover:scale-110 transition">⚕️</span>
                            <span className="text-sm font-bold text-slate-700 text-center">Evaluaciones</span>
                            <span className="text-[10px] text-amber-500 font-medium">Próximamente</span>
                        </button>

                        <button type="button" className="flex flex-col items-center justify-center p-3 border border-indigo-200 bg-white rounded-lg shadow-sm hover:shadow-md hover:border-indigo-400 transition cursor-not-allowed opacity-80 group">
                            <span className="text-2xl mb-1 group-hover:scale-110 transition">📊</span>
                            <span className="text-sm font-bold text-slate-700 text-center">Outcomes</span>
                            <span className="text-[10px] text-amber-500 font-medium">Próximamente</span>
                        </button>
                    </div>
                </div>
            )}

            {/* BOTONES ACCION MANTENEDOR */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={loading}
                    className="px-5 py-2 rounded font-medium text-slate-600 hover:bg-slate-100 transition"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    disabled={loading}
                    className="px-6 py-2 rounded bg-indigo-600 hover:bg-indigo-700 text-white font-bold shadow-sm transition disabled:opacity-50 flex items-center gap-2"
                >
                    {loading && (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    )}
                    {isEditMode ? "Guardar Cambios" : "Crear Persona Usuaria"}
                </button>
            </div>
        </form>
    );
}
