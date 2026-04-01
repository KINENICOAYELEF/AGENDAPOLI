"use client";

import { useState, useMemo } from "react";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { es } from "date-fns/locale";
import { Cita } from "@/types/clinica";
import Link from "next/link";

interface AgendaGridViewProps {
    citas: (Cita & { internName?: string })[];
    loading: boolean;
}

// Horarios desde las 10:00 hasta las 16:00 (7 horas)
const HOURS = Array.from({ length: 7 }, (_, i) => i + 10); // 10:00 - 16:00

const STATUS_STYLES: Record<string, { bg: string; border: string; text: string; dot: string }> = {
    SCHEDULED: { bg: "bg-indigo-50", border: "border-indigo-200", text: "text-indigo-800", dot: "bg-amber-400" },
    COMPLETED: { bg: "bg-emerald-50", border: "border-emerald-200", text: "text-emerald-800", dot: "bg-emerald-400" },
    NO_SHOW: { bg: "bg-rose-50", border: "border-rose-200", text: "text-rose-700", dot: "bg-rose-400" },
    CANCELLED: { bg: "bg-slate-100", border: "border-slate-300", text: "text-slate-500", dot: "bg-slate-400" },
    SUSPENDED: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", dot: "bg-amber-400" },
};

const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: "Esperando",
    COMPLETED: "Atendido",
    NO_SHOW: "No asistió",
    CANCELLED: "Anulada",
    SUSPENDED: "Suspendida",
};

export function AgendaGridView({ citas, loading }: AgendaGridViewProps) {
    const [weekOffset, setWeekOffset] = useState(0);

    // Semana actual + offset
    const weekStart = useMemo(() => {
        const base = startOfWeek(new Date(), { weekStartsOn: 1 }); // Lunes
        return addDays(base, weekOffset * 7);
    }, [weekOffset]);

    // Días de la semana (Lunes a Viernes = 5 columnas)
    const weekDays = useMemo(() =>
        Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
        [weekStart]
    );

    // Agrupar citas por día y hora
    const citasByDayHour = useMemo(() => {
        const map: Record<string, (Cita & { internName?: string })[]> = {};
        citas.forEach(cita => {
            const key = `${cita.date}_${cita.startTime?.split(":")[0]}`;
            if (!map[key]) map[key] = [];
            map[key].push(cita);
        });
        return map;
    }, [citas]);

    const weekLabel = useMemo(() => {
        const end = addDays(weekStart, 4); // Viernes
        const startStr = format(weekStart, "d MMM", { locale: es });
        const endStr = format(end, "d MMM yyyy", { locale: es });
        return `${startStr} — ${endStr}`;
    }, [weekStart]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <div className="flex items-center gap-3 text-slate-500 animate-pulse">
                    <svg className="animate-spin h-5 w-5 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                    <span className="font-medium">Cargando grilla semanal...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            {/* Header con navegación de semana */}
            <div className="bg-gradient-to-r from-slate-50 to-indigo-50/30 border-b border-slate-200 px-4 sm:px-6 py-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setWeekOffset(prev => prev - 1)}
                            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                            title="Semana anterior"
                        >
                            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button
                            onClick={() => setWeekOffset(0)}
                            className={`px-4 py-2 rounded-xl text-sm font-bold transition-all shadow-sm border ${weekOffset === 0 ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'}`}
                        >
                            Hoy
                        </button>
                        <button
                            onClick={() => setWeekOffset(prev => prev + 1)}
                            className="p-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all shadow-sm"
                            title="Semana siguiente"
                        >
                            <svg className="w-4 h-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                        </button>
                    </div>
                    <h3 className="text-sm sm:text-base font-bold text-slate-700 tracking-tight">{weekLabel}</h3>
                </div>
            </div>

            {/* Grid */}
            <div className="overflow-x-auto w-full">
                <div className="min-w-[800px] w-full">
                    {/* Encabezados de días */}
                    <div className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))] border-b border-slate-200 bg-white sticky top-0 z-10">
                        <div className="p-2 border-r border-slate-100"></div>
                        {weekDays.map((day, i) => {
                            const isCurrentDay = isToday(day);
                            return (
                                <div
                                    key={i}
                                    className={`p-3 text-center border-r border-slate-100 last:border-r-0 transition-colors ${isCurrentDay ? 'bg-indigo-50/80' : ''}`}
                                >
                                    <div className={`text-[10px] uppercase font-bold tracking-widest ${isCurrentDay ? 'text-indigo-600' : 'text-slate-400'}`}>
                                        {format(day, "EEE", { locale: es })}
                                    </div>
                                    <div className={`text-lg font-black mt-0.5 ${isCurrentDay ? 'text-indigo-700 bg-indigo-600 text-white w-8 h-8 rounded-full flex items-center justify-center mx-auto' : 'text-slate-700'}`}>
                                        {format(day, "d")}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Filas de horas */}
                    <div className="relative">
                        {HOURS.map(hour => (
                            <div key={hour} className="grid grid-cols-[60px_repeat(5,minmax(0,1fr))] border-b border-slate-100 min-h-[72px]">
                                {/* Etiqueta de hora */}
                                <div className="p-2 border-r border-slate-100 flex items-start justify-end">
                                    <span className="text-[11px] font-bold text-slate-400 -mt-1">{`${hour.toString().padStart(2, '0')}:00`}</span>
                                </div>
                                {/* Celdas por día */}
                                {weekDays.map((day, dayIdx) => {
                                    const dateStr = format(day, "yyyy-MM-dd");
                                    const hourStr = hour.toString().padStart(2, '0');
                                    const key = `${dateStr}_${hourStr}`;
                                    const cellCitas = citasByDayHour[key] || [];
                                    const isCurrentDay = isToday(day);

                                    return (
                                        <div
                                            key={dayIdx}
                                            className={`border-r border-slate-100 last:border-r-0 p-1 relative ${isCurrentDay ? 'bg-indigo-50/20' : ''} ${cellCitas.length === 0 ? 'hover:bg-slate-50/50' : ''}`}
                                        >
                                            {cellCitas.map(cita => {
                                                const style = STATUS_STYLES[cita.status] || STATUS_STYLES.SCHEDULED;
                                                return (
                                                    <Link
                                                        key={cita.id}
                                                        href={`/app/usuarios?openFicha=${cita.usuariaId}`}
                                                        className={`block rounded-lg px-2 py-1.5 mb-1 ${style.bg} ${style.border} border ${style.text} hover:shadow-md transition-all cursor-pointer group`}
                                                    >
                                                        <div className="flex items-center gap-1.5">
                                                            <div className={`w-2 h-2 rounded-full ${style.dot} shrink-0`}></div>
                                                            <span className="text-[11px] font-black truncate leading-tight">
                                                                {cita.usuariaName || `ID: ${cita.usuariaId.slice(0, 6)}`}
                                                            </span>
                                                        </div>
                                                        <div className="flex flex-col gap-[2px] mt-1 pl-3.5">
                                                            <span className="text-[9px] font-semibold opacity-70 leading-none">
                                                                {cita.startTime} — {cita.endTime}
                                                            </span>
                                                            {cita.internName && (
                                                                <span className="text-[9px] font-medium opacity-90 leading-none text-indigo-700 bg-indigo-100/50 w-fit px-1 py-[1px] rounded">
                                                                    🎓 {cita.internName}
                                                                </span>
                                                            )}
                                                            {cita.shortReason && (
                                                                <span className="text-[9px] opacity-60 truncate italic leading-none mt-[2px]">
                                                                    {cita.shortReason}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </Link>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* Footer con leyenda */}
            <div className="border-t border-slate-200 bg-slate-50/80 px-4 py-3 flex flex-wrap items-center gap-4">
                {Object.entries(STATUS_LABELS).map(([status, label]) => {
                    const style = STATUS_STYLES[status];
                    if (!style) return null;
                    const count = citas.filter(c => c.status === status).length;
                    if (count === 0) return null;
                    return (
                        <div key={status} className="flex items-center gap-1.5 text-xs text-slate-500">
                            <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`}></div>
                            <span className="font-semibold">{label}</span>
                            <span className="text-slate-400">({count})</span>
                        </div>
                    );
                })}
                <div className="ml-auto text-xs text-slate-400 font-medium">
                    {citas.length} citas en total
                </div>
            </div>
        </div>
    );
}
