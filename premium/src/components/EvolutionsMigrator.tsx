"use client";

import { useState } from "react";
import { collection, getDocs, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useYear } from "@/context/YearContext";

export function EvolutionsMigrator() {
    const { availableYears } = useYear();
    const [targetYear, setTargetYear] = useState<string>("");
    const [isMigrating, setIsMigrating] = useState(false);
    const [report, setReport] = useState<{ scanned: number, migrated: number, errors: number } | null>(null);

    const handleMigrate = async () => {
        if (!targetYear) return;

        const confirm = window.confirm(`⚠️ MIGRADOR HISTÓRICO ⚠️\n\nEstás a punto de leer TODOS los documentos de la colección antigua 'episodios' del universo ${targetYear} y copiarlos a la nueva colección oficial 'evoluciones'.\n\n¿Estás seguro de que deseas gastar estas lecturas/escrituras para normalizar la base de datos de este año?`);

        if (!confirm) return;

        setIsMigrating(true);
        setReport(null);

        let scannedCount = 0;
        let successCount = 0;
        let errorsCount = 0;

        try {
            // Utilizamos la referencia original directa a la BD para la lectura masiva
            // ya que setDocCounted sí está instrumentado en la escritura final.
            const oldEpiRef = collection(db, "programs", targetYear, "episodios");
            const snapshot = await getDocs(oldEpiRef);

            scannedCount = snapshot.size;

            if (scannedCount === 0) {
                alert(`No se encontraron registros en la colección antigua 'episodios' de ${targetYear}. No hay nada que migrar.`);
                setIsMigrating(false);
                return;
            }

            // Recorrer el array histórico y crear clones en la nueva colección
            const docsList = snapshot.docs;

            // Limitado intencionalmente a sequential puro para no ahogar la capa de red con miles de writes simultáneos
            for (const document of docsList) {
                try {
                    const data = document.data();
                    const newId = document.id;

                    // Instanciar la nueva referencia bajo la colección corregida
                    const newEvolRef = doc(db, "programs", targetYear, "evoluciones", newId);

                    // Inyectar marcas clínicas solicitadas por el maestro
                    const payload = {
                        ...data,
                        _migratedFromLegacy: true,
                        _sourcePath: "episodios"
                    };

                    await setDocCounted(newEvolRef, payload, { merge: true });
                    successCount++;
                } catch (err) {
                    console.error("Error migrando docto", document.id, err);
                    errorsCount++;
                }
            }

            setReport({
                scanned: scannedCount,
                migrated: successCount,
                errors: errorsCount
            });

        } catch (error) {
            console.error("Error letal leyendo colección antigua", error);
            alert("Acceso denegado o error conectando al Year seleccionado.");
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
            <div className="bg-rose-100 px-6 py-4 flex justify-between items-center border-b border-rose-200">
                <div>
                    <h3 className="text-lg font-bold text-rose-900">Normalización Clínica ("Episodios" a "Evoluciones")</h3>
                    <p className="text-rose-700 text-sm">Ejecutor de Migración de diccionarios (Fase 1.0). Transfiere historial read-only al path oficial.</p>
                </div>
            </div>

            <div className="p-6">
                <div className="flex gap-4 items-end mb-4">
                    <div className="flex-1">
                        <label className="block text-sm font-semibold text-slate-700 mb-2">Año a Normalizar</label>
                        <select
                            value={targetYear}
                            onChange={(e) => setTargetYear(e.target.value)}
                            className="w-full border border-slate-300 rounded-lg px-3 py-2 bg-white focus:ring-2 focus:ring-rose-500 font-medium text-slate-700"
                        >
                            <option value="" disabled>-- Selecciona un periodo --</option>
                            {availableYears.map(yr => (
                                <option key={yr} value={yr}>Sistema Histórico {yr}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        onClick={handleMigrate}
                        disabled={!targetYear || isMigrating}
                        className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-6 py-2 rounded-lg shadow-sm disabled:opacity-50 transition"
                    >
                        {isMigrating ? "Migrando..." : "Normalizar Entorno"}
                    </button>
                </div>

                {report && (
                    <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500 mt-4">
                        <h4 className="text-green-800 font-bold mb-2">✅ Migración del Universo {targetYear} Terminada</h4>
                        <ul className="text-sm text-green-700 space-y-1">
                            <li>🔍 Se escanearon: <b>{report.scanned}</b> documentos en <code>/episodios</code></li>
                            <li>📦 Se transcribieron: <b>{report.migrated}</b> documentos hacia <code>/evoluciones</code></li>
                            {report.errors > 0 && (
                                <li className="text-red-600 font-bold mt-2">❌ Fallaron {report.errors} escrituras.</li>
                            )}
                        </ul>
                    </div>
                )}
            </div>
        </div>
    );
}
