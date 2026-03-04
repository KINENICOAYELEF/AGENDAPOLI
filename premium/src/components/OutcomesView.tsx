import React, { useState, useEffect } from 'react';
import { Outcome, Proceso } from '@/types/clinica';
import { OutcomesService } from '@/services/outcomes';
import { useYear } from '@/context/YearContext';
import { ChartBarIcon, TableCellsIcon } from '@heroicons/react/24/outline';

interface OutcomesViewProps {
    proceso: Proceso;
}

export function OutcomesView({ proceso }: OutcomesViewProps) {
    const { globalActiveYear } = useYear();
    const [outcomes, setOutcomes] = useState<Outcome[]>([]);
    const [loading, setLoading] = useState(true);
    const [alerts, setAlerts] = useState<{ type: 'warning' | 'info', message: string }[]>([]);

    const loadOutcomes = async () => {
        if (!globalActiveYear || !proceso.id) return;
        setLoading(true);
        try {
            const data = await OutcomesService.getByProceso(globalActiveYear, proceso.id);
            setOutcomes(data);
        } catch (error) {
            console.error("Error loading outcomes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadOutcomes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [globalActiveYear, proceso.id]);

    useEffect(() => {
        if (outcomes.length === 0) return;

        const newAlerts: { type: 'warning' | 'info', message: string }[] = [];
        const psfsOutcomes = outcomes.filter(o => o.type === 'PSFS');

        if (psfsOutcomes.length > 0) {
            // Temporalidad
            const lastPsfs = psfsOutcomes[psfsOutcomes.length - 1];
            const daysSinceLast = Math.floor((new Date().getTime() - new Date(lastPsfs.capturedAt).getTime()) / (1000 * 3600 * 24));

            if (daysSinceLast > 21) {
                newAlerts.push({
                    type: 'warning',
                    message: `Sugerencia de Retest: Han pasado ${daysSinceLast} días desde la última medición del PSFS. Considere reevaluar funcionalmente.`
                });
            }

            // Estancamiento
            if (psfsOutcomes.length >= 2) {
                const getAvg = (out: any) => {
                    const arr = out.values?.items || out.values?.scores || [];
                    if (!arr.length) return 0;
                    return arr.reduce((acc: number, item: any) => acc + Number(item.score), 0) / arr.length;
                };

                const preLastAvg = getAvg(psfsOutcomes[psfsOutcomes.length - 2]);
                const lastAvg = getAvg(lastPsfs);

                if (preLastAvg > 0 && lastAvg > 0 && (lastAvg - preLastAvg) <= 0.5) {
                    newAlerts.push({
                        type: 'info',
                        message: `Alerta Pasiva: El PSFS no presenta progresión significativa (Avg previo: ${preLastAvg.toFixed(1)}, Nuevo: ${lastAvg.toFixed(1)}). Revise hipótesis clínica u objetivos.`
                    });
                }
            }
        }

        setAlerts(newAlerts);
    }, [outcomes]);

    if (loading) {
        return <div className="py-12 flex justify-center animate-pulse"><div className="w-8 h-8 rounded-full bg-slate-200"></div></div>;
    }

    if (outcomes.length === 0) {
        return (
            <div className="text-center py-12 text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                Aún no hay Outcomes registrados en este proceso.
            </div>
        );
    }

    return (
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-6">
            <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ChartBarIcon className="w-4 h-4 text-indigo-500" />
                Historial de Outcomes (SANE, GROC, PSFS)
            </h4>

            {alerts.length > 0 && (
                <div className="space-y-2 mb-4">
                    {alerts.map((al, idx) => (
                        <div key={idx} className={`flex items-start gap-3 p-3 rounded-xl border ${al.type === 'warning' ? 'bg-amber-50 border-amber-200 text-amber-800' : 'bg-indigo-50 border-indigo-200 text-indigo-800'} text-xs font-medium`}>
                            <div className="mt-0.5">
                                {al.type === 'warning' ? '⏱️' : '💡'}
                            </div>
                            <span>{al.message}</span>
                        </div>
                    ))}
                </div>
            )}

            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-slate-600">
                    <thead className="bg-slate-50 text-slate-500 font-bold uppercase tracking-wider">
                        <tr>
                            <th className="px-4 py-3 rounded-tl-lg">Fecha</th>
                            <th className="px-4 py-3">Contexto</th>
                            <th className="px-4 py-3">Tipo</th>
                            <th className="px-4 py-3 rounded-tr-lg">Valor(es)</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {outcomes.map(out => (
                            <tr key={out.id} className="hover:bg-slate-50/50">
                                <td className="px-4 py-3 whitespace-nowrap font-medium text-slate-800">
                                    {new Date(out.capturedAt).toLocaleDateString()}
                                </td>
                                <td className="px-4 py-3">
                                    <span className="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] font-bold">
                                        {out.context}
                                    </span>
                                </td>
                                <td className="px-4 py-3 font-bold text-slate-700">
                                    {out.type}
                                </td>
                                <td className="px-4 py-3">
                                    {out.type === 'PSFS' ? (
                                        <div className="space-y-1">
                                            {(out.values?.items || out.values?.scores || []).map((s: any, idx: number) => (
                                                <div key={idx} className="flex justify-between gap-4 border-b border-slate-100 pb-1 last:border-0 last:pb-0">
                                                    <span className="truncate max-w-[200px]" title={s.activity}>{s.activity}</span>
                                                    <span className="font-bold">{s.score}/10</span>
                                                </div>
                                            ))}
                                            <div className="font-black text-indigo-600 border-t border-slate-200 pt-1 mt-1 flex justify-between">
                                                <span>Promedio:</span>
                                                <span>
                                                    {((out.values?.items || out.values?.scores || []).reduce((acc: number, item: any) => acc + Number(item.score), 0) / (out.values?.items || out.values?.scores || []).length).toFixed(1)}/10
                                                </span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="font-bold text-slate-800">
                                            {out.type === 'SANE' ? `${out.values?.score}%` :
                                                out.type === 'GROC' ? out.values?.score :
                                                    JSON.stringify(out.values)}
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* Gráficos de Tendencia - Placeholder o Implementación Básica en Siguiente Iteración */}
            <div className="mt-8 border-t border-slate-100 pt-6">
                <h5 className="font-bold text-slate-800 text-xs flex items-center gap-2 mb-4">
                    <TableCellsIcon className="w-4 h-4 text-emerald-500" />
                    Gráficos de Tendencia
                </h5>
                <div className="bg-slate-50 rounded-xl p-8 text-center text-slate-400 font-medium text-xs border border-dashed border-slate-200">
                    Módulo de Generación de Gráficos (Próximamente con Recharts o similar)
                </div>
            </div>
        </div>
    );
}
