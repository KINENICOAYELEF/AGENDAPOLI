"use client";

import { useState } from "react";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useYear } from "@/context/YearContext";

// Interfaces estimadas del legacy temporal.
/* eslint-disable @typescript-eslint/no-explicit-any */
type LegacyJSON = {
    usuarios?: Record<string, any>; // usuarias antiguas
    evoluciones?: Record<string, any>; // episodios / atenciones
    [key: string]: any;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

export function LegacyImporter() {
    const { availableYears } = useYear();
    const [targetYear, setTargetYear] = useState<string>("");
    const [fileData, setFileData] = useState<LegacyJSON | null>(null);
    const [fileName, setFileName] = useState<string>("");

    const [status, setStatus] = useState<"IDLE" | "PARSED" | "IMPORTING" | "DONE" | "ERROR">("IDLE");
    const [report, setReport] = useState({
        totalUsersDetected: 0,
        totalEvolDetected: 0,
        importedUsers: 0,
        importedEvolutions: 0,
        errors: 0
    });

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setFileName(file.name);
        const reader = new FileReader();

        reader.onload = (event) => {
            try {
                const json = JSON.parse(event.target?.result as string) as LegacyJSON;

                // Intento de auto-detectar estructura 
                // Asume raíz: { "usuarios": {...}, "evoluciones": {...} } o similar
                // Acomodar a la jerarquía exportada clásica
                let rawUsers = {};
                let rawEvol = {};

                if (json.usuarios) rawUsers = json.usuarios;
                else if (json.users) rawUsers = json.users;

                if (json.evoluciones) rawEvol = json.evoluciones;
                else if (json.evaluaciones) rawEvol = json.evaluaciones;

                setFileData({ usuarios: rawUsers, evoluciones: rawEvol });
                setReport({
                    ...report,
                    totalUsersDetected: Object.keys(rawUsers).length,
                    totalEvolDetected: Object.keys(rawEvol).length
                });
                setStatus("PARSED");

            } catch (err) {
                console.error("No se pudo parsear el JSON", err);
                setStatus("ERROR");
                alert("El archivo subido no es un JSON válido.");
            }
        };

        reader.readAsText(file);
    };

    const handleImport = async () => {
        if (!targetYear) {
            alert("Debes seleccionar un 'Año Destino' seguro para inyectar este backup.");
            return;
        }

        if (!fileData) return;

        const confirm = window.confirm(`Vas a importar data legacy en el universo ${targetYear}.\n\nRevisa el contador:\n- Usuarias Totales: ${report.totalUsersDetected}\n- Episodios Totales: ${report.totalEvolDetected}\n\nEsto consumirá tus cuotas de Firebase. ¿Ejecutar inyección FULL?`);

        if (!confirm) return;

        setStatus("IMPORTING");

        let usersSuccess = 0;
        let evolSuccess = 0;
        let errorsCount = 0;

        try {
            // 1. IMPORTAR USERS
            const usersEntries = Object.entries(fileData.usuarios || {});

            for (const [uid, uData] of usersEntries) {
                try {
                    const docRef = doc(db, "programs", targetYear, "usuarias", uid);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const safeData: any = typeof uData === "object" ? uData : { legacyValue: uData };

                    // Añadimos marca biológica temporal del import
                    safeData._migratedFromLegacy = true;

                    await setDocCounted(docRef, safeData, { merge: true });
                    usersSuccess++;
                } catch (e) {
                    console.error("Error importando usuaria", uid, e);
                    errorsCount++;
                }
            }

            // 2. IMPORTAR EVOLUCIONES
            const evolEntries = Object.entries(fileData.evoluciones || {});

            for (const [eid, eData] of evolEntries) {
                try {
                    const docRef = doc(db, "programs", targetYear, "evoluciones", eid);
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const safeEvol: any = typeof eData === "object" ? eData : { legacyValue: eData };

                    safeEvol._migratedFromLegacy = true;
                    safeEvol._sourcePath = "json_import";

                    await setDocCounted(docRef, safeEvol, { merge: true });
                    evolSuccess++;
                } catch (e) {
                    console.error("Error importando evolucion", eid, e);
                    errorsCount++;
                }
            }

            setReport(prev => ({
                ...prev,
                importedUsers: usersSuccess,
                importedEvolutions: evolSuccess,
                errors: errorsCount
            }));

            setStatus("DONE");

        } catch (error) {
            console.error("Fallo general de importación", error);
            setStatus("ERROR");
        }
    };

    const resetImporter = () => {
        setStatus("IDLE");
        setFileData(null);
        setFileName("");
        setTargetYear("");
        setReport({ totalUsersDetected: 0, totalEvolDetected: 0, importedUsers: 0, importedEvolutions: 0, errors: 0 });
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden mt-8">
            <div className="bg-amber-100 px-6 py-4 flex justify-between items-center border-b border-amber-200">
                <div>
                    <h3 className="text-lg font-bold text-amber-900">Importador de Legacy JSON (Backup -&gt; Premium)</h3>
                    <p className="text-amber-700 text-sm">Rescatar historial de Realtime Database / Firestore Exported hacia un Año Cuarentena.</p>
                </div>
            </div>

            <div className="p-6 space-y-6">

                {status === "IDLE" && (
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center hover:bg-gray-50 transition">
                        <input
                            type="file"
                            accept=".json"
                            id="legacy-upload"
                            onChange={handleFileUpload}
                            className="hidden"
                        />
                        <label htmlFor="legacy-upload" className="cursor-pointer flex flex-col items-center">
                            <svg className="w-10 h-10 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                            <span className="text-blue-600 font-semibold hover:underline">Selecciona tu archivo JSON de Backup</span>
                            <span className="text-gray-500 text-sm mt-1">El archivo nunca sale de tu navegador hasta que confirmes la inyección.</span>
                        </label>
                    </div>
                )}

                {(status === "PARSED" || status === "IMPORTING" || status === "DONE") && (
                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-5">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h4 className="font-bold text-slate-800 break-all text-sm">Archivo: {fileName}</h4>
                                <div className="text-slate-500 text-xs mt-1 space-y-1">
                                    <p>✅ {report.totalUsersDetected} Usuarias detectadas.</p>
                                    <p>✅ {report.totalEvolDetected} Episodios detectados.</p>
                                </div>
                            </div>
                            {status === "PARSED" && (
                                <button onClick={resetImporter} className="text-slate-400 hover:text-red-500 text-xs font-semibold">Cancelar Archivo</button>
                            )}
                        </div>

                        {status === "PARSED" && (
                            <div className="mt-4 pt-4 border-t border-slate-200">
                                <label className="block text-sm font-semibold text-slate-700 mb-2">Paso 2: ¿En qué universo (año) inyectamos este backup?</label>
                                <div className="flex gap-3">
                                    <select
                                        value={targetYear}
                                        onChange={(e) => setTargetYear(e.target.value)}
                                        className="flex-1 border border-slate-300 rounded px-3 py-2 bg-white focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="" disabled>-- Selecciona el Año Destino --</option>
                                        {availableYears.map(yr => (
                                            <option key={yr} value={yr}>Año {yr}</option>
                                        ))}
                                    </select>
                                    <button
                                        onClick={handleImport}
                                        disabled={!targetYear}
                                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-6 py-2 rounded shadow-sm disabled:opacity-50 transition"
                                    >
                                        Ejecutar Inyección Segura
                                    </button>
                                </div>
                            </div>
                        )}

                        {status === "IMPORTING" && (
                            <div className="mt-4 pt-4 border-t border-slate-200 text-center py-4">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto mb-2"></div>
                                <p className="text-amber-800 font-semibold animate-pulse">Inyectando datos a la Nube... Revisa tu panel flotante (Telemetría)</p>
                            </div>
                        )}

                        {status === "DONE" && (
                            <div className="mt-4 pt-4 border-t border-slate-200 bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                                <h4 className="text-green-800 font-bold mb-2">¡Inyección Completada en el Año {targetYear}!</h4>
                                <ul className="text-sm text-green-700 space-y-1">
                                    <li>📦 {report.importedUsers} de {report.totalUsersDetected} Usuarias guardadas en <code>programs/{targetYear}/usuarias</code></li>
                                    <li>📄 {report.importedEvolutions} de {report.totalEvolDetected} Evoluciones guardadas en <code>programs/{targetYear}/evoluciones</code></li>
                                    {report.errors > 0 && (
                                        <li className="text-red-600 font-bold mt-2">❌ Se encontraron {report.errors} errores de formato y se omitieron.</li>
                                    )}
                                </ul>
                                <button onClick={resetImporter} className="mt-3 px-4 py-1.5 bg-green-200 hover:bg-green-300 text-green-800 rounded font-semibold text-xs border border-green-300 transition">
                                    Finalizar y Limpiar
                                </button>
                            </div>
                        )}

                    </div>
                )}
            </div>
        </div>
    );
}
