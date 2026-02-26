"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePathname } from "next/navigation";
import { TelemetryEvent } from "@/services/firestore";

interface LogEntry extends TelemetryEvent {
    id: number;
    time: string;
}

export function DebugOverlay() {
    const { user } = useAuth();
    const pathname = usePathname();
    const [queries, setQueries] = useState(0);
    const [reads, setReads] = useState(0);
    const [writes, setWrites] = useState(0);
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isOpen, setIsOpen] = useState(true);

    useEffect(() => {
        const handleTelemetry = (e: Event) => {
            const customEvent = e as CustomEvent<TelemetryEvent>;
            const data = customEvent.detail;

            setQueries((prev) => prev + (data.queries || 0));
            setReads((prev) => prev + data.estimatedReads);
            setWrites((prev) => prev + data.estimatedWrites);

            setLogs((prev) => {
                const newLog = {
                    ...data,
                    id: Date.now() + Math.random(),
                    time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
                };
                return [newLog, ...prev].slice(0, 10); // Guardamos solo los ultimos 10
            });
        };

        if (typeof window !== "undefined") {
            window.addEventListener("FIREBASE_TELEMETRY", handleTelemetry);
        }

        return () => {
            if (typeof window !== "undefined") {
                window.removeEventListener("FIREBASE_TELEMETRY", handleTelemetry);
            }
        };
    }, []);

    const handleReset = () => {
        setQueries(0);
        setReads(0);
        setWrites(0);
        setLogs([]);
    };

    // 1. CONDICIÓN MAESTRA: Si no es DOCENTE, este componente desaparece de la app sin generar rastro.
    if (user?.role !== "DOCENTE") return null;

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="fixed bottom-4 right-4 bg-slate-900 text-green-400 font-mono text-xs px-3 py-2 rounded-lg shadow-lg border border-slate-700 z-50 hover:bg-slate-800"
            >
                [{queries}Q|{reads}R|{writes}W] TELEMETRY
            </button>
        )
    }

    return (
        <div className="fixed bottom-4 right-4 w-80 bg-slate-900 border border-slate-700 shadow-2xl rounded-xl overflow-hidden z-50 flex flex-col font-mono text-xs max-h-96">
            {/* Header */}
            <div className="bg-slate-800 p-3 flex justify-between items-center border-b border-slate-700">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    <h3 className="text-slate-200 font-bold uppercase tracking-wider">DevTools Spark</h3>
                </div>
                <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-white transition">
                    —
                </button>
            </div>

            {/* Stats */}
            <div className="p-3 grid grid-cols-3 gap-2 border-b border-slate-700">
                <div className="bg-slate-950 rounded p-2 text-center">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">Queries</div>
                    <div className={`text-lg font-bold ${queries > 0 ? "text-yellow-400" : "text-slate-300"}`}>{queries}</div>
                </div>
                <div className="bg-slate-950 rounded p-2 text-center">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">Docs Read</div>
                    <div className={`text-lg font-bold ${reads > 0 ? "text-blue-400" : "text-slate-300"}`}>{reads}</div>
                </div>
                <div className="bg-slate-950 rounded p-2 text-center">
                    <div className="text-slate-500 text-[9px] uppercase mb-1">Writes</div>
                    <div className={`text-lg font-bold ${writes > 0 ? "text-purple-400" : "text-slate-300"}`}>{writes}</div>
                </div>
            </div>

            {/* Path & Controls */}
            <div className="p-3 bg-slate-800 flex justify-between items-center text-slate-300 border-b border-slate-700">
                <div className="truncate text-[10px] font-sans opacity-70" title={pathname}>
                    {pathname}
                </div>
                <button
                    onClick={handleReset}
                    className="px-2 py-1 bg-slate-700 hover:bg-slate-600 rounded text-[10px] text-white transition"
                >
                    RESET
                </button>
            </div>

            {/* Event Log */}
            <div className="overflow-y-auto flex-1 p-2 space-y-1 max-h-48">
                {logs.length === 0 ? (
                    <div className="text-center text-slate-600 py-4 italic">No db events recorded yet.</div>
                ) : (
                    logs.map((log) => (
                        <div key={log.id} className="flex gap-2 items-start py-1 border-b border-slate-800/50">
                            <span className="text-slate-500 min-w-[50px]">{log.time}</span>
                            <span className={log.operation === 'GET' ? 'text-blue-400' : 'text-purple-400'}>
                                [{log.operation}]
                            </span>
                            <span className="text-slate-400 break-all">{log.path.replace("programs", "p.")}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
