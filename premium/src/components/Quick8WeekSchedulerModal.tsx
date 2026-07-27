"use client";

import { useState } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { sanitizeForFirestoreDeep } from "@/lib/firebase-utils";
import { AgendaService } from "@/services/agenda";
import { Proceso } from "@/types/clinica";
import { useYear } from "@/context/YearContext";
import { Calendar, Clock, Check, X, Sparkles } from "lucide-react";

interface Quick8WeekSchedulerModalProps {
    proceso: Proceso;
    usuariaName: string;
    onClose: () => void;
    onSuccess: () => void;
}

const WEEKDAYS = [
    { key: 'MON', label: 'Lun' },
    { key: 'TUE', label: 'Mar' },
    { key: 'WED', label: 'Mié' },
    { key: 'THU', label: 'Jue' },
    { key: 'FRI', label: 'Vie' },
    { key: 'SAT', label: 'Sáb' },
];

// Opciones de Horas en Formato 24 Horas
const HOURS_24H = [
    "08:00", "08:30", "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", 
    "12:00", "12:30", "13:00", "13:30", "14:00", "14:30", "15:00", "15:30", 
    "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00"
];

export function Quick8WeekSchedulerModal({ proceso, usuariaName, onClose, onSuccess }: Quick8WeekSchedulerModalProps) {
    const { globalActiveYear } = useYear();
    const existingPlan = proceso.attendancePlan as any || {};

    const [selectedDays, setSelectedDays] = useState<string[]>(existingPlan.daysOfWeek || ['MON', 'WED']);
    const [startTime, setStartTime] = useState<string>(existingPlan.defaultStartTime || existingPlan.time || "10:00");
    const [endTime, setEndTime] = useState<string>(existingPlan.defaultEndTime || "11:00");
    const [isGenerating, setIsGenerating] = useState(false);

    const toggleDay = (dayKey: string) => {
        setSelectedDays(prev => 
            prev.includes(dayKey) 
                ? prev.filter(d => d !== dayKey) 
                : [...prev, dayKey]
        );
    };

    const handleGenerate = async () => {
        if (!globalActiveYear || !proceso.id) return;
        if (selectedDays.length === 0) {
            alert("Selecciona al menos 1 día de la semana.");
            return;
        }

        setIsGenerating(true);
        try {
            const updatedPlan: any = {
                status: 'ACTIVO' as const,
                daysOfWeek: selectedDays,
                defaultStartTime: startTime,
                defaultEndTime: endTime,
                time: startTime,
                durationMin: 60,
                assignedInternIds: existingPlan.assignedInternIds || [],
                excludeHolidays: true,
                startDate: new Date().toISOString().split('T')[0]
            };

            // 1. Guardar Plan en Proceso
            const procesoRef = doc(db, "programs", globalActiveYear, "procesos", proceso.id);
            await updateDoc(procesoRef, sanitizeForFirestoreDeep({
                attendancePlan: updatedPlan,
                updatedAt: new Date().toISOString()
            }));

            // 2. Generar 8 Semanas de Citas Futuras
            const fullProceso = { ...proceso, attendancePlan: updatedPlan };
            await AgendaService.ensureSchedule(globalActiveYear, fullProceso as any, 8);

            alert("✅ Agendamiento de 8 semanas generado con éxito.");
            onSuccess();
            onClose();
        } catch (error) {
            console.error("Error generando 8 semanas:", error);
            alert("No se pudo generar el agendamiento. Revisa la consola.");
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 border border-slate-100">
                {/* Header */}
                <div className="bg-slate-900 p-5 text-white flex justify-between items-start">
                    <div>
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-400 block mb-1 flex items-center gap-1">
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Agendamiento Rápido de 8 Semanas</span>
                        </span>
                        <h3 className="font-black text-lg text-white leading-tight">{usuariaName}</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-1 text-slate-400 hover:text-white rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content */}
                <div className="p-5 space-y-5">
                    {/* Selector de Días */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Días de Atención Semanal</span>
                        </label>
                        <div className="grid grid-cols-6 gap-1.5">
                            {WEEKDAYS.map(w => {
                                const isSelected = selectedDays.includes(w.key);
                                return (
                                    <button
                                        key={w.key}
                                        type="button"
                                        onClick={() => toggleDay(w.key)}
                                        className={`py-2 text-xs font-bold rounded-xl transition border ${
                                            isSelected 
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                                        }`}
                                    >
                                        {w.label}
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Selector de Horarios Formato 24 Horas */}
                    <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-indigo-600" />
                            <span>Horario de Atención (Formato 24 Horas)</span>
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hora Inicio</span>
                                <select
                                    value={startTime}
                                    onChange={e => setStartTime(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                                >
                                    {HOURS_24H.map(h => (
                                        <option key={`start_${h}`} value={h}>{h} hrs</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Hora Término</span>
                                <select
                                    value={endTime}
                                    onChange={e => setEndTime(e.target.value)}
                                    className="w-full bg-slate-50 border border-slate-200 text-slate-800 font-bold text-sm rounded-xl px-3 py-2 outline-none focus:border-indigo-500"
                                >
                                    {HOURS_24H.map(h => (
                                        <option key={`end_${h}`} value={h}>{h} hrs</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Explicación de Feriados */}
                    <div className="bg-indigo-50/70 border border-indigo-100 p-3 rounded-2xl text-xs text-indigo-900 font-medium">
                        Se generarán automáticamente las citas de las próximas 8 semanas excluyendo días feriados del calendario oficial.
                    </div>
                </div>

                {/* Footer Actions */}
                <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="px-5 py-2 text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-xl shadow-md transition flex items-center gap-1.5"
                    >
                        {isGenerating ? (
                            <span>Generando Agenda...</span>
                        ) : (
                            <>
                                <Check className="w-4 h-4" />
                                <span>Generar 8 Semanas</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
