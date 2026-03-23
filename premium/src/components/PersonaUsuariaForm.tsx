import { useState, useEffect } from "react";
import { PersonaUsuaria } from "@/types/personaUsuaria";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useYear } from "@/context/YearContext";
import { ProcesosManager } from "@/components/ProcesosManager";
import { humanize } from "@/utils/humanizer";

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
    const [subView, setSubView] = useState<'main' | 'procesos'>('main');

    // Estado interno del formulario
    const [formData, setFormData] = useState<PersonaUsuaria>({
        identity: {
            fullName: "",
            rut: "",
            fechaNacimiento: "",
            sexoRegistrado: "",
            comuna: "",
            ciudad: "",
            telefono: "",
            correo: "",
            contactoEmergenciaNombre: "",
            contactoEmergenciaRelacion: "",
            observacionesAdministrativas: "",
        },
        socialContext: {
            nivelEducacional: "",
        },
        consent: { accepted: false },
        meta: {},
    });

    useEffect(() => {
        if (initialData) {
            const anyInitial = initialData as any;
            // Migración hidratada al vuelo si faltan datos en identity
            const mergedIdentity = {
                ...formData.identity,
                ...(initialData.identity || {}),
                fullName: initialData.identity?.fullName || anyInitial.nombreCompleto || "",
                rut: initialData.identity?.rut || anyInitial.rut || "",
                telefono: initialData.identity?.telefono || anyInitial.telefono || "",
                correo: initialData.identity?.correo || anyInitial.email || "",
                observacionesAdministrativas: initialData.identity?.observacionesAdministrativas || anyInitial.notasAdministrativas || "",
            };
            setFormData({
                ...initialData,
                identity: mergedIdentity,
                socialContext: initialData.socialContext || { nivelEducacional: "" }
            });
        }
    }, [initialData]);

    const handleIdentityChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, identity: { ...prev.identity, [name]: value } as any }));
    };

    const handleSocialChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, socialContext: { ...prev.socialContext, [name]: value } as any }));
    };

    // Función derivada para calcular edad (visual)
    const calcularEdad = (fechaNac: string) => {
        if (!fechaNac) return "-";
        const [yyyy, mm, dd] = fechaNac.split("-").map(Number);
        const nac = new Date(yyyy, mm - 1, dd);
        const hoy = new Date();
        let edad = hoy.getFullYear() - nac.getFullYear();
        if (hoy.getMonth() < nac.getMonth() || (hoy.getMonth() === nac.getMonth() && hoy.getDate() < nac.getDate())) {
            edad--;
        }
        return isNaN(edad) ? "-" : edad;
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!globalActiveYear) {
            alert("No hay un Año de Programa activo seleccionado.");
            return;
        }

        // Validación FASE 45: Obligatorios Mínimos Troncales
        const { fullName, rut, fechaNacimiento, sexoRegistrado, comuna, telefono, correo } = formData.identity;
        if (!fullName?.trim() || !rut?.trim() || !fechaNacimiento?.trim() || !sexoRegistrado?.trim() || !comuna?.trim()) {
            alert("Nombre Completo, RUT, Fecha de Nacimiento, Sexo Registrado y Comuna son obligatorios.");
            return;
        }
        if (!telefono?.trim() && !correo?.trim()) {
            alert("Debe ingresar al menos un número de teléfono o un correo electrónico.");
            return;
        }

        try {
            setLoading(true);
            const targetId = isEditMode && formData.id ? formData.id : generateId();

            // Auto-calcular edad antes de guardar para fines de queries rápidas si se desea
            const calcEdad = calcularEdad(fechaNacimiento!);
            const finalEdad = typeof calcEdad === 'number' ? calcEdad : undefined;

            const payload: any = {
                ...formData,
                id: targetId,
                identity: {
                    ...formData.identity,
                    edad: finalEdad
                },
                // Mantenemos legacy sync para vistas antiguas que puedan depender de la raíz (opcional)
                nombreCompleto: formData.identity.fullName,
                rut: formData.identity.rut,
                telefono: formData.identity.telefono,
                email: formData.identity.correo,

                // Inyectamos timestamp de creación solo si es un documento nuevo
                ...(!isEditMode && { meta: { createdAt: new Date().toISOString() } })
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
    if (subView === 'procesos' && initialData?.id) {
        return (
            <ProcesosManager
                personaUsuariaId={initialData.id}
                personaUsuariaName={formData.identity.fullName || ""}
                remoteHistorySnapshot={formData.remoteHistory}
                pacienteSnapshot={formData.identity}
                onBack={() => setSubView('main')}
            />
        );
    }

    return (
        <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* --- A) IDENTIFICACIÓN Y DATOS BASE --- */}
                <div className="col-span-1 md:col-span-2 space-y-4">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b pb-2">A) Identificación Base</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nombre Completo <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.identity.fullName || ""}
                                onChange={handleIdentityChange}
                                placeholder="Ej. Ana Pérez Gómez"
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Identificador Público (RUT/DNI) <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                name="rut"
                                value={formData.identity.rut || ""}
                                onChange={handleIdentityChange}
                                placeholder="Ej. 19.123.456-7"
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none font-mono"
                                required
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">F. Nacimiento <span className="text-red-500">*</span></label>
                                <input
                                    type="date"
                                    name="fechaNacimiento"
                                    value={formData.identity.fechaNacimiento || ""}
                                    onChange={handleIdentityChange}
                                    className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Edad Actual</label>
                                <div className="w-full border border-slate-200 bg-slate-100 text-slate-600 rounded px-3 py-2 font-bold text-center cursor-not-allowed">
                                    {calcularEdad(formData.identity.fechaNacimiento || "")} años
                                </div>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Sexo Registrado <span className="text-red-500">*</span></label>
                            <select
                                name="sexoRegistrado"
                                value={formData.identity.sexoRegistrado || ""}
                                onChange={handleIdentityChange}
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                required
                            >
                                <option value="">Seleccione...</option>
                                <option value="Mujer">Mujer</option>
                                <option value="Hombre">Hombre</option>
                                <option value="Intersexual">Intersexual</option>
                                <option value="No especifica">No especifica</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Comuna <span className="text-red-500">*</span></label>
                                <input
                                    type="text"
                                    name="comuna"
                                    value={formData.identity.comuna || ""}
                                    onChange={handleIdentityChange}
                                    placeholder="Ej. Santiago"
                                    className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Ciudad</label>
                                <input
                                    type="text"
                                    name="ciudad"
                                    value={formData.identity.ciudad || ""}
                                    onChange={handleIdentityChange}
                                    placeholder="Opcional"
                                    className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teléfono Móvil</label>
                                <input
                                    type="tel"
                                    name="telefono"
                                    value={formData.identity.telefono || ""}
                                    onChange={handleIdentityChange}
                                    placeholder="+569..."
                                    className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Correo Electrónico</label>
                                <input
                                    type="email"
                                    name="correo"
                                    value={formData.identity.correo || ""}
                                    onChange={handleIdentityChange}
                                    placeholder="@correo.cl"
                                    className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2 grid grid-cols-2 gap-2 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <div>
                                <label className="block text-xs font-bold text-red-800 mb-1">Contacto Emergencia</label>
                                <input
                                    type="text"
                                    name="contactoEmergenciaNombre"
                                    value={formData.identity.contactoEmergenciaNombre || ""}
                                    onChange={handleIdentityChange}
                                    placeholder="Nombre completo"
                                    className="w-full border border-red-200 rounded px-3 py-1.5 outline-none text-sm focus:border-red-400"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-red-800 mb-1">Relación / Vínculo</label>
                                <input
                                    type="text"
                                    name="contactoEmergenciaRelacion"
                                    value={formData.identity.contactoEmergenciaRelacion || ""}
                                    onChange={handleIdentityChange}
                                    placeholder="Padre, Pareja..."
                                    className="w-full border border-red-200 rounded px-3 py-1.5 outline-none text-sm focus:border-red-400"
                                />
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Observaciones Administrativas</label>
                            <input
                                type="text"
                                name="observacionesAdministrativas"
                                value={formData.identity.observacionesAdministrativas || ""}
                                onChange={handleIdentityChange}
                                placeholder="Horarios preferidos, previsión..."
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                {/* --- B) CONTEXTO SOCIAL Y OCUPACIONAL BASE --- */}
                <div className="col-span-1 md:col-span-2 space-y-4 mt-2">
                    <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 border-b pb-2">B) Contexto Social y Ocupacional Base</h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Nivel Educacional</label>
                            <select
                                name="nivelEducacional"
                                value={formData.socialContext?.nivelEducacional || ""}
                                onChange={handleSocialChange}
                                className="w-full border border-slate-300 rounded px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                            >
                                <option value="">Seleccione...</option>
                                <option value="Básica">Básica</option>
                                <option value="Media">Media</option>
                                <option value="Técnico">Técnico</option>
                                <option value="Universitario">Universitario</option>
                                <option value="Postgrado">Postgrado</option>
                                <option value="No especifica">No especifica</option>
                            </select>
                        </div>
                    </div>

                    {/* Mostrar los datos extraídos de la Remota en vista sólo lectura, ya que el origen de la verdad clínica es la Anamnesis Remota */}
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs text-slate-600 italic">
                        Nota: La información detallada sobre actividad deportiva principal, demanda física ocupacional y barreras se aloja dentro del proceso clínico de <strong className="font-semibold text-slate-700">Anamnesis Remota (P1.5)</strong>. A continuación, se muestra el resumen estructurado sincronizado.
                    </div>
                </div>

                {/* --- C) EXPEDIENTE CLÍNICO (RESUMEN BASAL) --- */}
                {isEditMode && formData.remoteHistory ? (
                    <div className="col-span-1 md:col-span-2 space-y-4 mt-2 bg-slate-800 p-4 rounded-xl border border-slate-700 shadow-lg">
                        <h3 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2">
                            <span className="bg-indigo-500 text-white p-1 rounded-md">📇</span> C) Expediente Clínico (Contexto Basal Actualizado)
                        </h3>
                        <div className="text-xs text-slate-300 leading-relaxed max-h-64 overflow-y-auto w-full pr-2 space-y-3 custom-scrollbar">
                            {formData.remoteHistory.p15_context_structured ? (
                                <div className="space-y-4">
                                    {/* 1. Biología y Salud General */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                            <h4 className="font-semibold text-rose-400 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                                                <span>Salud General y Biología</span>
                                                <span className="text-[10px] opacity-70">🏥</span>
                                            </h4>
                                            <div className="space-y-2">
                                                {formData.remoteHistory.p15_context_structured.condiciones_clinicas_relevantes?.length > 0 || (formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes?.comorbilidades_relevantes?.length > 0) ? (
                                                    <div className="flex flex-wrap gap-1">
                                                        {[...(formData.remoteHistory.p15_context_structured.condiciones_clinicas_relevantes || []), ...(formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes?.comorbilidades_relevantes || [])].map((i: string, idx: number) => (
                                                            <span key={idx} className="bg-rose-900/30 text-rose-200 border border-rose-800/50 px-1.5 py-0.5 rounded text-[10px]">{i}</span>
                                                        ))}
                                                    </div>
                                                ) : <p className="text-slate-500 italic">No reporta condiciones relevantes.</p>}

                                                {formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes?.medicacion_relevante?.length > 0 && (
                                                    <p className="text-[10px] border-l-2 border-indigo-500 pl-2 py-0.5"><span className="text-slate-400 font-bold uppercase text-[9px]">💊 Meds:</span> {formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes.medicacion_relevante.join(', ')}</p>
                                                )}
                                                {formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes?.alergias_relevantes?.length > 0 && (
                                                    <p className="text-[10px] border-l-2 border-amber-500 pl-2 py-0.5"><span className="text-slate-400 font-bold uppercase text-[9px]">⚠️ Alergias:</span> {formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes.alergias_relevantes.join(', ')}</p>
                                                )}
                                            </div>
                                        </div>

                                        <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                            <h4 className="font-semibold text-indigo-400 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                                                <span>Antecedentes MSK</span>
                                                <span className="text-[10px] opacity-70">🦴</span>
                                            </h4>
                                            <div className="space-y-2">
                                                {formData.remoteHistory.p15_context_structured.antecedentes_msk?.lesiones_previas?.length > 0 && (
                                                    <div>
                                                        <span className="text-[9px] text-slate-500 font-bold uppercase">Lesiones:</span>
                                                        <ul className="list-disc pl-4 space-y-0.5 text-[10px]">
                                                            {formData.remoteHistory.p15_context_structured.antecedentes_msk.lesiones_previas.map((i: string, idx: number) => <li key={idx}>{i}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {(formData.remoteHistory.p15_context_structured.antecedentes_msk?.cirugias_previas?.length > 0 || formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes?.cirugias_medicas_relevantes?.length > 0) && (
                                                    <div className="text-[10px]">
                                                        <span className="text-slate-400 font-bold uppercase text-[9px]">Cirugías:</span> {[...(formData.remoteHistory.p15_context_structured.antecedentes_msk?.cirugias_previas || []), ...(formData.remoteHistory.p15_context_structured.factores_biologicos_relevantes?.cirugias_medicas_relevantes || [])].join(', ')}
                                                    </div>
                                                )}
                                                {formData.remoteHistory.p15_context_structured.antecedentes_msk?.secuelas_persistentes?.length > 0 && (
                                                    <div className="text-[10px] bg-slate-800/50 p-1.5 rounded border border-slate-700/50">
                                                        <span className="text-amber-400/80 font-bold uppercase text-[9px]">Secuelas:</span> {formData.remoteHistory.p15_context_structured.antecedentes_msk.secuelas_persistentes.join(', ')}
                                                    </div>
                                                )}
                                                <div className="flex flex-wrap gap-2 text-[9px] mt-1 text-slate-400">
                                                    <span>Dom: {formData.remoteHistory.p15_context_structured.antecedentes_msk?.dominancia || '-'}</span>
                                                    {formData.remoteHistory.p15_context_structured.antecedentes_msk?.recurrencias?.length > 0 && <span>· Recurrencias: {formData.remoteHistory.p15_context_structured.antecedentes_msk.recurrencias.join(', ')}</span>}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. Actividad Fisica y Deporte */}
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                        <h4 className="font-semibold text-emerald-400 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                                            <span>Capacidad Física y Deporte Basal</span>
                                            <span className="text-[10px] opacity-70">🏃</span>
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                                            <div className="space-y-1">
                                                <p><span className="text-slate-400 font-bold">Actividad Central:</span> {formData.remoteHistory.p15_context_structured.deporte_actividad_basal?.actividad_deporte_central || '-'}</p>
                                                <p><span className="text-slate-400 font-bold">Nivel:</span> {formData.remoteHistory.p15_context_structured.deporte_actividad_basal?.nivel_practica_actual || '-'} ({formData.remoteHistory.p15_context_structured.deporte_actividad_basal?.frecuencia_semanal || '-'})</p>
                                                {formData.remoteHistory.p15_context_structured.deporte_actividad_basal?.doble_carga_basal && <p className="text-[9px] italic border-l border-emerald-500 pl-2 mt-1">{formData.remoteHistory.p15_context_structured.deporte_actividad_basal.doble_carga_basal}</p>}
                                            </div>
                                            <div className="space-y-1">
                                                {formData.remoteHistory.p15_context_structured.antecedentes_msk?.tratamientos_previos_exitosos?.length > 0 && (
                                                    <p className="text-emerald-300/80"><span className="text-slate-400 font-bold uppercase text-[9px]">Útil antes:</span> {formData.remoteHistory.p15_context_structured.antecedentes_msk.tratamientos_previos_exitosos.join(', ')}</p>
                                                )}
                                                {formData.remoteHistory.p15_context_structured.antecedentes_msk?.tratamientos_mal_tolerados?.length > 0 && (
                                                    <p className="text-rose-300/60"><span className="text-slate-400 font-bold uppercase text-[9px]">Inútil antes:</span> {formData.remoteHistory.p15_context_structured.antecedentes_msk.tratamientos_mal_tolerados.join(', ')}</p>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. Ocupacional y Domiciliario */}
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                        <h4 className="font-semibold text-amber-400 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                                            <span>Contexto Ocupacional y Red de Apoyo</span>
                                            <span className="text-[10px] opacity-70">💼</span>
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                                            <div className="space-y-1">
                                                <p><span className="text-slate-400 font-bold">Rol Principal:</span> {formData.remoteHistory.p15_context_structured.contexto_ocupacional?.ocupacion_principal || '-'}</p>
                                                <p><span className="text-slate-400 font-bold">Demandas:</span> {formData.remoteHistory.p15_context_structured.contexto_ocupacional?.demandas_fisicas_laborales?.join(', ') || '-'}</p>
                                            </div>
                                            <div className="space-y-1">
                                                <p><span className="text-slate-400 font-bold">Vive con:</span> {formData.remoteHistory.p15_context_structured.contexto_domiciliario?.vive_con || '-'} (Red: {formData.remoteHistory.p15_context_structured.contexto_domiciliario?.red_apoyo_tratamiento || 'N/A'})</p>
                                                {formData.remoteHistory.p15_context_structured.contexto_ocupacional?.barreras_logisticas_adherencia?.length > 0 && <p className="text-rose-400/80"><span className="text-slate-400 font-bold uppercase text-[9px]">Barreras:</span> {formData.remoteHistory.p15_context_structured.contexto_ocupacional.barreras_logisticas_adherencia.join(', ')}</p>}
                                            </div>
                                        </div>
                                    </div>

                                    {/* 4. Biopsicosocial y Banderas */}
                                    <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700">
                                        <h4 className="font-semibold text-sky-400 mb-2 border-b border-slate-700 pb-1 flex justify-between">
                                            <span>Perfil Biopsicosocial y Hábitos</span>
                                            <span className="text-[10px] opacity-70">🧘</span>
                                        </h4>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px]">
                                            <div className="space-y-1">
                                                <p><span className="text-slate-400 font-bold">Estrés:</span> {humanize(formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.estres_basal) || '-'} ({humanize(formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.fuente_principal_estres) || 'N/A'})</p>
                                                <p><span className="text-slate-400 font-bold">Sueño:</span> {humanize(formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.calidad_sueno) || '-'} ({formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.horas_promedio_sueno || '-'} hrs, Rep: {formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.sueno_reparador || 'N/A'})</p>
                                                <div className="flex flex-wrap gap-2 text-[9px] mt-1 text-slate-400">
                                                    <span>🚭 Tab: {formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.tabaquismo || '-'}</span>
                                                    <span>🍷 Alc: {formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.alcohol || '-'}</span>
                                                    <span>☕ Caf: {formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.cafeina || '-'}</span>
                                                </div>
                                                {formData.remoteHistory.p15_context_structured.biopsicosocial_habitos?.hobbies_bienestar?.length > 0 && (
                                                    <p className="text-[9px] mt-1 italic text-slate-500">🎨 Hobbies: {formData.remoteHistory.p15_context_structured.biopsicosocial_habitos.hobbies_bienestar.join(', ')}</p>
                                                )}
                                            </div>
                                            {formData.remoteHistory.p15_context_flags && (
                                                <div className="flex flex-wrap gap-1 content-start">
                                                    {formData.remoteHistory.p15_context_flags.factores_personales_positivos?.map((f: string, i: number) => <span key={`fp-${i}`} className="bg-emerald-900/40 text-emerald-300 border border-emerald-800/50 px-1.5 py-0.5 rounded text-[9px]">{humanize(f)}</span>)}
                                                    {formData.remoteHistory.p15_context_flags.factores_personales_negativos?.map((f: string, i: number) => <span key={`fn-${i}`} className="bg-rose-900/40 text-rose-300 border border-rose-800/50 px-1.5 py-0.5 rounded text-[9px]">{humanize(f)}</span>)}
                                                    {formData.remoteHistory.p15_context_flags.barreras_ambientales?.map((f: string, i: number) => <span key={`ba-${i}`} className="bg-amber-900/40 text-amber-300 border border-amber-800/50 px-1.5 py-0.5 rounded text-[9px]">{humanize(f)}</span>)}
                                                </div>
                                            )}
                                        </div>
                                        {formData.remoteHistory.p15_context_structured.notas_basales && (
                                            <div className="mt-3 p-2 bg-slate-800/50 rounded border border-slate-700 text-slate-300 italic text-[10px]">
                                                <span className="font-bold text-slate-500 not-italic uppercase text-[8px] block mb-1">Notas de Expediente:</span>
                                                {formData.remoteHistory.p15_context_structured.notas_basales}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="p-3 bg-slate-900/50 border border-slate-700 rounded-lg whitespace-pre-wrap text-[10px] text-slate-400 italic">
                                    {formData.remoteHistory.basalSynthesis || "Expediente basal extraído de versión antigua."}
                                </div>
                            )}
                        </div>
                    </div>
                ) : isEditMode ? (
                    <div className="col-span-1 md:col-span-2 space-y-4 mt-2 bg-slate-100 p-4 rounded-xl border border-dashed border-slate-300 text-center">
                        <p className="text-sm font-medium text-slate-500 flex items-center justify-center gap-2">
                            <span>📇</span> Sin anamnesis remota (Expediente Clínico) registrada.
                        </p>
                    </div>
                ) : null}
            </div>

            {/* SECCIÓN GESTIÓN DE PROCESOS CLÍNICOS (SOLO VISIBLE EN EDICIÓN/FICHA CLINICA YA CREADA) */}
            {isEditMode && (
                <div className="border border-indigo-100 bg-indigo-50/50 rounded-xl p-5 mt-8 space-y-4">
                    <div className="flex justify-between items-center">
                        <div>
                            <h3 className="text-sm font-bold text-slate-800 tracking-wide flex items-center gap-2">
                                <svg className="w-4 h-4 text-indigo-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
                                Historial y Procesos Clínicos (D)
                            </h3>
                            <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                Gestione los tratamientos, evoluciones y evaluaciones agrupándolos por procesos clínicos.
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-2">
                        {/* ACCESO AL GESTOR DE PROCESOS */}
                        <button
                            type="button"
                            onClick={() => setSubView('procesos')}
                            className="group relative flex items-center justify-between p-5 bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-300 transition-all text-left overflow-hidden"
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-indigo-50/0 via-indigo-50/0 to-indigo-50/50 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                            <div className="relative z-10">
                                <h4 className="text-lg font-bold text-slate-800 group-hover:text-indigo-700 transition-colors">Procesos Clínicos</h4>
                                <p className="text-xs text-slate-500 mt-1 font-medium">Abrir o continuar tratamientos</p>
                            </div>
                            <div className="relative z-10 bg-slate-50 text-slate-400 p-3 rounded-xl group-hover:bg-indigo-600 group-hover:text-white transition-all shadow-sm group-hover:shadow-indigo-200">
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                            </div>
                        </button>
                    </div>
                </div>
            )
            }

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
        </form >
    );
}
