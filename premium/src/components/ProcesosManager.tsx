import { useState, useEffect } from "react";
import { Proceso } from "@/types/clinica";
import { ProcesosService } from "@/services/procesos";
import { useYear } from "@/context/YearContext";
import { ProcesoForm } from "@/components/ProcesoForm";
import { EvolucionesManager } from "@/components/EvolucionesManager";

interface ProcesosManagerProps {
    personaUsuariaId: string;
    personaUsuariaName: string;
    onBack: () => void;
}

export function ProcesosManager({ personaUsuariaId, personaUsuariaName, onBack }: ProcesosManagerProps) {
    const { globalActiveYear } = useYear();

    // router interno de este panel
    const [view, setView] = useState<'lista' | 'formulario' | 'evoluciones'>('lista');

    // items
    const [procesos, setProcesos] = useState<Proceso[]>([]);
    const [selectedProceso, setSelectedProceso] = useState<Proceso | null>(null);
    const [loading, setLoading] = useState(true);

    const loadProcesos = async () => {
        if (!globalActiveYear || !personaUsuariaId) return;
        try {
            setLoading(true);
            const data = await ProcesosService.getByPersona(globalActiveYear, personaUsuariaId);
            setProcesos(data);
        } catch (error: any) {
            console.error("Error cargando procesos:", error);
            if (error.message && error.message.includes("indexes?create_composite")) {
                alert("Advertencia: Se requiere crear un ínidice compuesto en Firebase para ordenar los procesos.");
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProcesos();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, personaUsuariaId]);

    const handleFormSaved = (saved: Proceso, isNew: boolean) => {
        if (isNew) {
            setProcesos(prev => [saved, ...prev].sort((a, b) => new Date(b.fechaInicio).getTime() - new Date(a.fechaInicio).getTime()));
        } else {
            setProcesos(prev => prev.map(p => p.id === saved.id ? saved : p));
        }
        setView('lista');
    };

    // VISTAS HIJAS
    if (view === 'formulario') {
        return (
            <div className="animate-in fade-in slide-in-from-right-4">
                <ProcesoForm
                    personaUsuariaId={personaUsuariaId}
                    initialData={selectedProceso}
                    onClose={() => setView('lista')}
                    onSaveSuccess={handleFormSaved}
                />
            </div>
        );
    }

    if (view === 'evoluciones' && selectedProceso) {
        return (
            <div className="animate-in fade-in slide-in-from-right-4">
                {/* 
                  En la Fase 2.1 el EvolucionesManager todavía usa usuariaId,
                  pero conceptualmente las evoluciones pronto pertenecerán al Proceso.
                  Por ahora lo montamos pasándole la info de la paciente para no romper retrocompatibilidad,
                  y en las siguientes fases le pasaremos el procesoId.
                */}
                <div className="mb-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
                    <p className="text-xs text-amber-800 font-medium">⚠️ Estás gestionando Evoluciones bajo el contexto del Proceso seleccionado.</p>
                </div>
                <EvolucionesManager
                    usuariaId={personaUsuariaId}
                    usuariaName={personaUsuariaName}
                    onBack={() => setView('lista')}
                />
            </div>
        );
    }

    // LISTA PRINCIPAL
    // Separamos el Activo del resto para destacarlo
    const procesosActivos = procesos.filter(p => p.estado === 'ACTIVO');
    const procesosInactivos = procesos.filter(p => p.estado !== 'ACTIVO');

    return (
        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
            {/* Header / Toolbar */}
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                <div>
                    <button onClick={onBack} className="text-sm font-semibold text-slate-500 hover:text-indigo-600 transition mb-1 flex items-center gap-1">
                        <span>← Volver a Ficha Base</span>
                    </button>
                    <h3 className="text-xl font-bold text-slate-800">Caja de Procesos</h3>
                    <p className="text-sm text-slate-500">Paciente: <span className="font-semibold">{personaUsuariaName}</span></p>
                </div>
                <button
                    onClick={() => { setSelectedProceso(null); setView('formulario'); }}
                    className="bg-amber-500 hover:bg-amber-600 text-white font-medium px-4 py-2 rounded-lg shadow-sm transition text-sm flex items-center gap-2"
                >
                    + Abrir Nuevo Proceso
                </button>
            </div>

            {loading ? (
                <div className="p-12 text-center text-slate-400 font-medium animate-pulse">
                    Consultando procesos activos e históricos...
                </div>
            ) : procesos.length === 0 ? (
                <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-500 font-medium">
                    Esta persona usuaria no tiene procesos (atenciones) registradas en este año. <br />
                    <span className="text-sm font-normal text-slate-400 mt-2 block">Haz clic en "Abrir Nuevo Proceso" para iniciar su tratamiento.</span>
                </div>
            ) : (
                <div className="grid gap-4">
                    {/* PROCESOS ACTIVOS PRIMERO */}
                    {procesosActivos.map(proc => (
                        <div key={proc.id} className="bg-white border-2 border-green-400 rounded-xl overflow-hidden shadow-sm relative group transition hover:shadow-md">
                            <div className="absolute top-0 right-0 bg-green-500 text-white text-[10px] font-bold px-3 py-1 rounded-bl-lg uppercase tracking-wider">
                                Atencion Activa
                            </div>
                            <div className="p-5">
                                <div className="pr-24">
                                    <h4 className="text-lg font-bold text-slate-800 line-clamp-2 leading-tight mb-2">
                                        {proc.motivoIngresoLibre}
                                    </h4>
                                    <p className="text-sm text-slate-600 mb-4">
                                        Iniciado el: <span className="font-semibold">{new Date(proc.fechaInicio).toLocaleDateString()}</span>
                                    </p>
                                </div>
                                <div className="flex gap-2 border-t border-slate-100 pt-4 mt-2">
                                    <button
                                        onClick={() => { setSelectedProceso(proc); setView('evoluciones'); }}
                                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-sm font-bold px-4 py-2 rounded transition flex-1 sm:flex-none text-center"
                                    >
                                        Ir a Evoluciones →
                                    </button>
                                    <button
                                        onClick={() => { setSelectedProceso(proc); setView('formulario'); }}
                                        className="bg-slate-50 hover:bg-slate-100 text-slate-600 text-sm font-semibold px-4 py-2 rounded transition border border-slate-200"
                                    >
                                        Modificar Estado
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* PROCESOS HISTÓRICOS (ALTA, PAUSA, CERRADO) */}
                    {procesosInactivos.length > 0 && (
                        <>
                            <h4 className="font-bold text-slate-400 text-sm uppercase tracking-wider mt-4 px-2">Histórico del Periodo</h4>
                            {procesosInactivos.map(proc => (
                                <div key={proc.id} className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden opacity-80 hover:opacity-100 transition">
                                    <div className="flex items-center justify-between bg-slate-100/50 px-4 py-2 border-b border-slate-200">
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider 
                                            ${proc.estado === 'ALTA' ? 'bg-blue-100 text-blue-800' : ''}
                                            ${proc.estado === 'PAUSADO' ? 'bg-amber-100 text-amber-800' : ''}
                                            ${proc.estado === 'CERRADO_ADMIN' ? 'bg-slate-200 text-slate-700' : ''}
                                         `}>
                                            {proc.estado.replace('_', ' ')}
                                        </span>
                                        <span className="text-xs text-slate-500 font-mono">
                                            Inicio: {new Date(proc.fechaInicio).toLocaleDateString()}
                                            {proc.fechaAlta && ` - Cierre: ${new Date(proc.fechaAlta).toLocaleDateString()}`}
                                        </span>
                                    </div>
                                    <div className="p-4 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-slate-700 line-clamp-2">{proc.motivoIngresoLibre}</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => { setSelectedProceso(proc); setView('evoluciones'); }}
                                                className="text-xs bg-white hover:bg-slate-100 text-slate-600 font-semibold px-3 py-1.5 border border-slate-300 rounded shadow-sm transition"
                                            >
                                                Ver Evoluciones
                                            </button>
                                            <button
                                                onClick={() => { setSelectedProceso(proc); setView('formulario'); }}
                                                className="text-xs bg-white hover:bg-amber-50 text-amber-600 font-semibold px-3 py-1.5 border border-amber-200 rounded shadow-sm transition"
                                            >
                                                Ver Detalles
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
