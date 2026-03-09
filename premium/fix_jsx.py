import re

with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'r') as f:
    content = f.read()

# Fix Contexto Deportivo y Laboral closing div
bad_end = """                    )}

                </div>
            </details >"""

good_end = """                    )}

                </div>
                </div>
            </details >"""

content = content.replace(bad_end, good_end)

# Fix the end of file extra </div>
bad_eof = """        </div >
        </div >
    );
}"""

good_eof = """        </div >
    );
}"""

content = content.replace(bad_eof, good_eof)

# Change Notas Rapidas to be inside the Foco section or somewhere else. 
# Prompt: "Cualquier bloque adicional (p. ej. Control de Focos, Notas Rápidas, Automatización P2, Triage) NO debe aparecer como sección numerada. Reubícalos como sub-bloques dentro de una sección existente o dentro del Cierre (Sección 13) como paneles AUTO."
# Let's change Notas Rapidas from <details ...> to a simple <div ...> and remove the badge '11'
notas_target = """                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[11]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(11); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">11</span>
                            <h3 className="font-bold text-slate-800 text-sm">Notas Rápidas <span className="text-indigo-400 font-normal">({activeFoco?.region || 'Sin región'})</span></h3>
                        </div>
                        <svg className={`w-5 h-5 text-slate-400 transition-transform ${activeAccordions[11] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </summary>"""

notas_repl = """                {/* --- MÓDULO: NOTAS RÁPIDAS --- */}
                <div className="group bg-white border border-slate-200 rounded-xl shadow-sm mb-4">
                    <div className="flex items-center justify-between p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-xl">📝</span>
                            <h3 className="font-bold text-slate-800 text-sm">Notas Rápidas <span className="text-indigo-400 font-normal">({activeFoco?.region || 'Sin región'})</span></h3>
                        </div>
                    </div>"""

content = content.replace(notas_target, notas_repl)

# Have to replace the matching </details> of Notas Rapidas to </div>
notas_end_target = """                            />
                        </div>
                    </div>
                </details >

                {/* --- 12. BPS & FACTORES PSICOSOCIALES --- */}"""

notas_end_repl = """                            />
                        </div>
                    </div>
                </div>

                {/* --- 11. BPS & FACTORES PSICOSOCIALES --- */}"""
                
content = content.replace(notas_end_target, notas_end_repl)

# Now BPS: Change from 12 to 11
bps_target = """                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[12]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(12); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">12</span>"""

bps_repl = """                < details className="group bg-white border border-slate-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[11]} >
                    <summary
                        className="flex items-center justify-between p-4 cursor-pointer select-none"
                        onClick={(e) => { e.preventDefault(); toggleAccordion(11); }}
                    >
                        <div className="flex items-center gap-3">
                            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 text-slate-500 font-bold text-xs border border-slate-200">11</span>"""

content = content.replace(bps_target, bps_repl)

# Automatizacion P2 -> Unnumbered, inside Cierre or before it. Prompt says "dentro del Cierre (Sección 13) como paneles AUTO."
# Let's change Automatizacion (15), Triage (16), and Cierre (17) into a single accordion (13).

p2_target = """            {/* --- 15. AUTOMATIZACIÓN HACIA P2 --- */}
            < details className="group bg-indigo-50/50 border border-indigo-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[15]} >
                <summary
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                    onClick={(e) => { e.preventDefault(); toggleAccordion(15); }}
                >
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 font-bold text-xs border border-indigo-200">15</span>
                        <h3 className="font-bold text-indigo-900 text-sm">Automatización hacia Examen Físico (P2)</h3>
                    </div>
                    <svg className={`w-5 h-5 text-indigo-400 transition-transform ${activeAccordions[15] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>"""

p2_repl = """            {/* --- 13. CIERRE, TRIAGE Y PASE A P2 --- */}
            <details className="group bg-blue-50 border border-blue-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[13] || true}>
                <summary
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                    onClick={(e) => { e.preventDefault(); toggleAccordion(13); }}
                >
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md">13</span>
                        <h3 className="font-bold text-blue-900 text-sm">Resumen Clínico y Cierre</h3>
                    </div>
                    <svg className={`w-5 h-5 text-blue-400 transition-transform ${activeAccordions[13] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-4 pb-4 px-10 border-t border-blue-100 pt-5 space-y-4 bg-white rounded-b-xl">
                
                {/* --- PANEL AUTO: AUTOMATIZACIÓN HACIA P2 --- */}
                <div className="bg-indigo-50/50 border border-indigo-200 rounded-xl shadow-sm mt-4">
                    <div className="p-4 border-b border-indigo-100 flex items-center gap-2">
                        <span className="text-xl">🤖</span>
                        <h3 className="font-bold text-indigo-900 text-sm">Automatización hacia Examen Físico (P2)</h3>
                    </div>"""

content = content.replace(p2_target, p2_repl)

# Triage target:
triage_target = """            </details >

            {/* --- 16. CIERRE Y DECISIÓN DE INGRESO --- */}
            < details className="group bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[16] || true} >
                <summary
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                    onClick={(e) => { e.preventDefault(); toggleAccordion(16); }}
                >
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-emerald-600 text-white font-bold text-xs shadow-md"><svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg></span>
                        <h3 className="font-bold text-emerald-900 text-sm">Resumen de Decisión Inmediata (Triage)</h3>
                    </div>
                    <svg className={`w-5 h-5 text-emerald-400 transition-transform ${activeAccordions[16] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-4 pb-4 px-10 border-t border-emerald-100 pt-5 space-y-5 bg-white rounded-b-xl">"""

triage_repl = """            </div>

            {/* --- PANEL AUTO: TRIAGE --- */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl shadow-sm mt-4">
                <div className="p-4 border-b border-emerald-100 flex items-center gap-2">
                    <span className="text-xl">🩺</span>
                    <h3 className="font-bold text-emerald-900 text-sm">Resumen de Decisión Inmediata (Triage)</h3>
                </div>
                <div className="p-4 space-y-5 bg-white rounded-b-xl">"""

content = content.replace(triage_target, triage_repl)

# Cierre target:
cierre_target = """            </details >

            {/* --- 17. CIERRE Y RESUMEN FINAL --- */}
            <details className="group bg-blue-50 border border-blue-200 rounded-xl shadow-sm [&_summary::-webkit-details-marker]:hidden" open={activeAccordions[17] || true}>
                <summary
                    className="flex items-center justify-between p-4 cursor-pointer select-none"
                    onClick={(e) => { e.preventDefault(); toggleAccordion(17); }}
                >
                    <div className="flex items-center gap-3">
                        <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white font-bold text-xs shadow-md">17</span>
                        <h3 className="font-bold text-blue-900 text-sm">Resumen Clínico y Cierre</h3>
                    </div>
                    <svg className={`w-5 h-5 text-blue-400 transition-transform ${activeAccordions[17] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </summary>
                <div className="px-4 pb-4 px-10 border-t border-blue-100 pt-5 space-y-4 bg-white rounded-b-xl">"""

cierre_repl = """            </div>

            {/* --- PANEL: RESUMEN FINAL --- */}
            <div className="mt-6 border-t border-blue-100 pt-5 space-y-4">"""

content = content.replace(cierre_target, cierre_repl)

# One more fix: we removed two </details> but need to make sure the final </details> is there. We already have a </details> for 17, which is now the closure for 13.
# Wait, let's write to file.
with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'w') as f:
    f.write(content)
