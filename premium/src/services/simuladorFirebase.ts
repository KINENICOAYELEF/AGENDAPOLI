import { db } from '@/lib/firebase';
import { collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, Timestamp, deleteDoc } from 'firebase/firestore';

// ─── Types ───
export interface SimuladorIntento {
    id?: string;
    userId: string;
    userEmail: string;
    userName: string;
    // Case info
    area: string;
    dificultad: string;
    practiceMode: string;
    pacienteNombre: string;
    motivoConsulta: string;
    // Scores
    puntajeGlobal: number;
    notaChilena: number;
    nivel: string;
    puntajeComision: number;
    notaComision: number;
    // Scorecard detail
    scorecard: Record<string, { puntaje: number; comentario: string }>;
    // Time
    tiempoSegundos: number;
    // Timestamp
    fecha: Timestamp;
    // Optional: full data for docente review
    resumenTrabajo?: string;
    // Full details for PDF export
    erroresCriticos?: any[];
    aciertosDestacados?: any[];
    areasMejora?: string[];
    perlaDocente?: string;
    commissionAnswers?: string[];
    preguntasComision?: any[];
    fullSessionData?: any;
}

export interface SimuladorTareaConfig {
    activa: boolean;
    frecuenciaDias: number; // 2, 3, 5, 7
    modoMinimo: string;     // 'completo' | 'cualquiera'
    mensaje?: string;
    actualizadoPor?: string;
    actualizadoEn?: Timestamp;
}

export interface CumplimientoResult {
    cumple: boolean;
    ultimoIntento: Date | null;
    diasDesdeUltimo: number;
    diasRestantes: number;
    creditosExtraAcumulados: number; // Simulations done "in advance" acting as credits
    descripcion: string;
}

export interface DefensaVozIntento {
    id?: string;
    userId: string;
    userEmail: string;
    userName: string;
    pacienteNombre: string;
    motivoConsulta: string;
    area: string;
    dificultad: string;
    // Construcción del Estudiante
    construccion: any; 
    // Transcripción de la conversación (opcional pero recomendada)
    transcripcion?: string;
    // Resultados de Evaluación
    puntajeGlobal: number;
    notaChilena: number;
    feedbackFinal: string;
    aciertos: string[];
    errores: string[];
    temasAEstudiar: string[];
    rubricaDetallada: any;
    // Caso clínico completo (para revisión docente)
    casoClinico?: {
        fichaVisible: any;
        perfilSecreto: any;
        hallazgos: any;
    };
    // Tiempo
    tiempoSegundos: number;
    fecha: Timestamp;
}

const COLLECTION = 'simulador_intentos';
const COLLECTION_VOZ = 'defensas_voz_intentos';
const CONFIG_DOC = 'simulador_config';
const CONFIG_COLLECTION = 'settings';

// ─── Save attempt ───
export async function guardarIntento(intento: Omit<SimuladorIntento, 'id' | 'fecha'>) {
    const ref = doc(collection(db, COLLECTION));
    await setDoc(ref, {
        ...intento,
        fecha: Timestamp.now(),
    });
    return ref.id;
}

export async function saveVoiceDefense(data: Omit<DefensaVozIntento, 'fecha'>): Promise<string> {
    try {
        const id = crypto.randomUUID();
        const ref = doc(collection(db, COLLECTION_VOZ), id);
        
        const payload: DefensaVozIntento = {
            ...data,
            id,
            fecha: Timestamp.now(),
        };

        await setDoc(ref, payload);
        return id;
    } catch (error) {
        console.error("Error guardando la defensa de voz:", error);
        throw error;
    }
}

export async function getVoiceDefenses(userId?: string): Promise<DefensaVozIntento[]> {
    try {
        const colRef = collection(db, COLLECTION_VOZ);
        let q;
        if (userId) {
            q = query(colRef, where('userId', '==', userId), orderBy('fecha', 'desc'));
        } else {
            // If no user ID provided, get all (e.g. for admin/docente)
            q = query(colRef, orderBy('fecha', 'desc'));
        }
        
        const snapshot = await getDocs(q);
        return snapshot.docs.map(d => d.data() as DefensaVozIntento);
    } catch (error) {
        console.error("Error obteniendo defensas de voz:", error);
        return [];
    }
}

// ─── Get attempts for a student ───
export async function getIntentosEstudiante(userId: string, maxResults = 20) {
    const q = query(
        collection(db, COLLECTION),
        where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    const results = snap.docs.map(d => ({ id: d.id, ...d.data() } as SimuladorIntento));
    results.sort((a, b) => {
        const timeA = a.fecha?.toDate?.()?.getTime() || 0;
        const timeB = b.fecha?.toDate?.()?.getTime() || 0;
        return timeB - timeA;
    });
    return results.slice(0, maxResults);
}

// ─── Get all attempts (docente view) ───
export async function getIntentosDocente(maxResults = 100) {
    const q = query(
        collection(db, COLLECTION),
        orderBy('fecha', 'desc'),
        limit(maxResults)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as SimuladorIntento));
}

// ─── Delete attempt ───
export async function eliminarIntento(intentoId: string) {
    await deleteDoc(doc(db, COLLECTION, intentoId));
}

// ═══ TASK ASSIGNMENT SYSTEM ═══

// Save task config (docente only)
export async function guardarTareaConfig(config: SimuladorTareaConfig) {
    await setDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC), {
        ...config,
        actualizadoEn: Timestamp.now(),
    });
}

// Get task config
export async function getTareaConfig(): Promise<SimuladorTareaConfig | null> {
    const snap = await getDoc(doc(db, CONFIG_COLLECTION, CONFIG_DOC));
    if (!snap.exists()) return null;
    return snap.data() as SimuladorTareaConfig;
}

/**
 * CREDIT BANK SYSTEM:
 * 
 * Works like a rolling window:
 * - Counts all simulations done in the last (frecuenciaDias * N) days
 * - Calculates how many "periods" they cover
 * - If they did 2 in one day and frequency is every 2 days, they have 1 credit for the next period
 * 
 * Example: frequency = every 2 days
 *   - Did 3 simulations in the last 2 days → covers 3 periods of 2 days → no debt for next 4 days
 *   - Did 0 in last 2 days → owes 1 simulation
 *   - Did 1 in last 2 days → just on time, 0 credits
 */
export async function verificarCumplimiento(
    userId: string,
    config: SimuladorTareaConfig
): Promise<CumplimientoResult> {
    const ahora = new Date();

    // Fetch enough history to cover potential credit bank (last 30 days)
    const intentos = await getIntentosEstudiante(userId, 50);

    if (intentos.length === 0) {
        return {
            cumple: false,
            ultimoIntento: null,
            diasDesdeUltimo: 999,
            diasRestantes: 0,
            creditosExtraAcumulados: 0,
            descripcion: 'Nunca has realizado una simulación.',
        };
    }

    // Filter by mode if required
    const intentosValidos = config.modoMinimo === 'completo'
        ? intentos.filter(i => i.practiceMode === 'completo')
        : intentos;

    if (intentosValidos.length === 0) {
        return {
            cumple: false,
            ultimoIntento: null,
            diasDesdeUltimo: 999,
            diasRestantes: 0,
            creditosExtraAcumulados: 0,
            descripcion: `No tienes simulaciones en modo "${config.modoMinimo === 'completo' ? 'Examen Completo' : 'cualquiera'}".`,
        };
    }

    // ─── Credit Bank Algorithm ───
    // Count simulations done in the last (frecuenciaDias * 15) days max
    const windowMs = config.frecuenciaDias * 15 * 24 * 60 * 60 * 1000;
    const windowStart = new Date(ahora.getTime() - windowMs);

    const intentosEnVentana = intentosValidos.filter(i => {
        const fecha = i.fecha ? i.fecha.toDate() : new Date(0);
        return fecha >= windowStart;
    });

    // How many "periods" have passed since the start of the tracking window
    // The tracking window starts from the earliest attempt or the config window
    const primerIntento = intentosEnVentana.length > 0
        ? (intentosEnVentana[intentosEnVentana.length - 1].fecha?.toDate() ?? ahora)
        : ahora;

    const diasDesdeInicio = Math.floor((ahora.getTime() - primerIntento.getTime()) / (1000 * 60 * 60 * 24));

    // How many periods have elapsed (minimum 1 — the current period)
    const periodosElapsed = Math.max(1, Math.ceil(diasDesdeInicio / config.frecuenciaDias));

    // How many simulations were required in that time
    const requeridas = periodosElapsed;

    // How many they actually did (valid ones)
    const realizadas = intentosEnVentana.length;

    // Credits = simulations done MINUS required ones
    const creditos = realizadas - requeridas;

    // The current period: when was the last required simulation due?
    const ultimoIntento = intentosValidos[0].fecha ? intentosValidos[0].fecha.toDate() : new Date();
    const diasDesdeUltimo = Math.floor((ahora.getTime() - ultimoIntento.getTime()) / (1000 * 60 * 60 * 24));

    // They comply if:
    // A) They are within the current period (diasDesdeUltimo < frecuenciaDias), OR
    // B) They have positive credits (did extra simulations in advance)
    const cumpleDirecto = diasDesdeUltimo < config.frecuenciaDias;
    const cumplePorCredito = creditos > 0 && diasDesdeUltimo < config.frecuenciaDias + (creditos * config.frecuenciaDias);
    const cumple = cumpleDirecto || cumplePorCredito;

    // Days remaining in current coverage
    const diasCubiertos = creditos > 0
        ? config.frecuenciaDias + (creditos * config.frecuenciaDias)
        : config.frecuenciaDias;
    const diasRestantes = Math.max(0, diasCubiertos - diasDesdeUltimo);

    let descripcion = '';
    if (cumple) {
        if (creditos > 0) {
            descripcion = `✓ Al día. Tienes ${creditos} simulación(es) extra que te cubren los próximos ${diasRestantes} día(s).`;
        } else {
            descripcion = `✓ Al día. Tienes ${diasRestantes} día(s) para tu próxima simulación.`;
        }
    } else {
        descripcion = diasDesdeUltimo >= 999
            ? 'Nunca has realizado una simulación.'
            : `Han pasado ${diasDesdeUltimo} día(s) desde tu última simulación válida (límite: ${config.frecuenciaDias} días).`;
    }

    return {
        cumple,
        ultimoIntento,
        diasDesdeUltimo,
        diasRestantes,
        creditosExtraAcumulados: Math.max(0, creditos),
        descripcion,
    };
}

// ─── Export attempt to PDF format ───
export function exportarIntentoPDF(int: SimuladorIntento) {
    if (typeof window === 'undefined') return;

    const notaFinal = int.notaComision
        ? ((int.notaChilena * 0.7) + (int.notaComision * 0.3)).toFixed(1)
        : int.notaChilena?.toFixed(1);

    const formatTimeHelper = (s: number) => 
        `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

    const labels: Record<string, string> = {
        entrevista: 'Entrevista',
        razonamiento_previo: 'Razonamiento I',
        razonamiento_integrador: 'Razonamiento II',
        examen_fisico: 'Examen Físico',
        intervencion_paciente: 'Intervención',
        diagnostico: 'Diagnóstico',
        objetivos: 'Objetivos',
        plan_fases: 'Plan por Fases',
        reevaluacion: 'Reevaluación',
        intervencion: 'Intervención (legado)',
    };

    const scorecardRows = Object.entries(int.scorecard || {}).map(([k, v]) =>
        `<tr>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:600;">${labels[k] || k.replace(/_/g, ' ').toUpperCase()}</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:center;font-weight:800;font-size:14px;color:${(v as any).puntaje >= 60 ? '#059669' : '#dc2626'}">${(v as any).puntaje}/100</td>
            <td style="padding:8px 10px;border-bottom:1px solid #e2e8f0;font-size:12px;color:#475569;font-style:italic;">${(v as any).comentario || '—'}</td>
        </tr>`
    ).join('');

    const erroresHTML = (int.erroresCriticos || []).map((e: any) =>
        `<div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:10px;margin-bottom:6px;font-size:13px;">
            <strong style="color:#991b1b;">[${e.fase}]</strong> ${e.error}<br/>
            <span style="font-size:12px;color:#64748b;">→ ${e.explicacion_docente}</span>
        </div>`
    ).join('');

    const aciertosHTML = (int.aciertosDestacados || []).map((a: any) =>
        `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px;margin-bottom:6px;font-size:13px;">
            <strong style="color:#166534;">[${a.fase}]</strong> ${a.acierto}<br/>
            <span style="font-size:12px;color:#64748b;">→ ${a.por_que_importa}</span>
        </div>`
    ).join('');

    const areasHTML = (int.areasMejora || []).map((a: string) =>
        `<li style="font-size:13px;margin-bottom:4px;color:#334155;">${a}</li>`
    ).join('');

    const comisionHTML = int.notaComision && int.preguntasComision ? int.preguntasComision.map((q: any, i: number) => {
        const answer = int.commissionAnswers?.[i] || '—';
        return `<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:12px;margin-bottom:8px;font-size:13px;">
            <p style="font-weight:700;color:#1e293b;margin:0 0 4px;">P${i+1}: ${q.pregunta}</p>
            <p style="font-size:13px;color:#334155;margin:0 0 4px;"><strong>Respuesta estudiante:</strong> ${answer}</p>
        </div>`;
    }).join('') : '';

    const fechaStr = int.fecha ? (int.fecha.toDate ? int.fecha.toDate() : new Date(int.fecha as any)).toLocaleDateString('es-CL') : new Date().toLocaleDateString('es-CL');

    // ─── Generate complete session trace ───
    let interactiveHTML = '';
    if (int.fullSessionData) {
        const sd = int.fullSessionData;
        
        // Anamnesis / Entrevista
        let entrevistaSection = '';
        if (sd.studentQuestions || sd.respuestasPaciente) {
            entrevistaSection = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e3a8a;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">🗣️ Fase 1: Anamnesis / Entrevista</h4>
                    <p style="margin:0 0 6px;"><strong>Preguntas formuladas por el estudiante:</strong></p>
                    <p style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:10px;color:#334155;white-space:pre-wrap;margin:0 0 14px;">${sd.studentQuestions || '—'}</p>
                    <p style="margin:0 0 6px;"><strong>Respuestas del paciente (IA):</strong></p>
                    <p style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:10px;color:#334155;white-space:pre-wrap;margin:0;">${sd.respuestasPaciente || '—'}</p>
                </div>
            `;
        }

        // Razonamiento I
        let razonamiento1Section = '';
        if (sd.reasoning) {
            const r1 = sd.reasoning;
            const hipotesisList = (r1.hipotesis || []).map((h: string, idx: number) => `<li><strong>Hipótesis ${idx + 1}:</strong> ${h || '—'}</li>`).join('');
            razonamiento1Section = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e3a8a;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">🧠 Fase 2: Razonamiento Clínico Inicial</h4>
                    <p style="margin:0 0 6px;"><strong>Hipótesis diagnósticas planteadas:</strong></p>
                    <ul style="margin:0 0 14px;padding-left:20px;color:#334155;">${hipotesisList}</ul>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:10px;border-top:1px solid #f1f5f9;padding-top:10px;">
                        <div><strong>Clasificación del Dolor:</strong><br/><span style="color:#475569;">${r1.clasificacion_dolor || '—'}</span></div>
                        <div><strong>Irritabilidad:</strong><br/><span style="color:#475569;">${r1.irritabilidad || '—'}</span></div>
                        <div><strong>Banderas Rojas:</strong><br/><span style="color:#475569;">${r1.banderas_rojas || '—'}</span></div>
                        <div><strong>Factores BPS (Biológico-Psicológico-Social):</strong><br/><span style="color:#475569;">${r1.factores_bps || '—'}</span></div>
                    </div>
                </div>
            `;
        }

        // Examen Físico
        let examenSection = '';
        if (sd.examSelections || sd.hallazgosRevelados) {
            const selections = Object.entries(sd.examSelections || {}).filter(([_, v]: any) => v.selected);
            const selectionsHTML = selections.length > 0 ? selections.map(([k, v]: any) => `
                <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin-bottom:8px;">
                    <p style="margin:0 0 4px;font-weight:700;color:#1e293b;text-transform:capitalize;font-size:12px;">🔍 ${k.replace(/_/g, ' ')}</p>
                    <p style="margin:0 0 4px;color:#475569;font-size:11px;"><strong>Justificación:</strong> ${v.justificacion || '—'}</p>
                    <p style="margin:0;color:#475569;font-size:11px;"><strong>Pruebas específicas:</strong> ${v.pruebas || '—'}</p>
                </div>
            `).join('') : '<p style="color:#94a3b8;font-style:italic;">Ningún módulo seleccionado.</p>';

            const findingsHTML = sd.hallazgosRevelados && Object.keys(sd.hallazgosRevelados).length > 0 
                ? Object.entries(sd.hallazgosRevelados).map(([mod, findings]: any) => `
                    <div style="margin-bottom:8px;padding-left:10px;border-left:2px solid #0f766e;">
                        <strong style="text-transform:capitalize;color:#0f766e;font-size:12px;">${mod.replace(/_/g, ' ')}:</strong>
                        <span style="color:#334155;font-size:12px;">${findings}</span>
                    </div>
                `).join('') 
                : '<p style="color:#94a3b8;font-style:italic;">Sin hallazgos revelados.</p>';

            examenSection = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e3a8a;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">🔍 Fase 3: Examen Físico</h4>
                    <p style="margin:0 0 8px;"><strong>Módulos seleccionados y justificaciones:</strong></p>
                    <div style="margin-bottom:14px;">${selectionsHTML}</div>
                    <p style="margin:0 0 8px;"><strong>Resultados de las pruebas clínicas (IA):</strong></p>
                    <div style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:10px;margin:0;">${findingsHTML}</div>
                </div>
            `;
        }

        // Razonamiento II
        let razonamiento2Section = '';
        if (sd.reasoning2) {
            const r2 = sd.reasoning2;
            razonamiento2Section = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e3a8a;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">🔄 Fase 4: Razonamiento Integrador</h4>
                    <div style="display:flex;flex-direction:column;gap:10px;">
                        <div><strong>¿Se confirman las hipótesis iniciales?:</strong><br/><span style="color:#475569;">${r2.hipotesis_confirmadas || '—'}</span></div>
                        <div><strong>Clasificación Actualizada:</strong><br/><span style="color:#475569;">${r2.clasificacion_actualizada || '—'}</span></div>
                        <div><strong>Diagnóstico Presuntivo (CIF / Kinesiológico):</strong><br/><span style="color:#475569;">${r2.diagnostico_presuntivo || '—'}</span></div>
                        <div><strong>Hallazgos Clave de la Evaluación:</strong><br/><span style="color:#475569;">${r2.hallazgos_clave || '—'}</span></div>
                    </div>
                </div>
            `;
        }

        // Intervenciones
        let intervencionesSection = '';
        if (sd.interventions && sd.interventions.length > 0) {
            const intListHTML = sd.interventions.map((i: any, idx: number) => `
                <tr style="background:${idx % 2 === 0 ? 'white' : '#f8fafc'};">
                    <td style="padding:6px;border:1px solid #e2e8f0;font-size:11px;"><strong>${i.tecnica || '—'}</strong></td>
                    <td style="padding:6px;border:1px solid #e2e8f0;font-size:11px;">${i.objetivo_tecnica || '—'}</td>
                    <td style="padding:6px;border:1px solid #e2e8f0;font-size:11px;">${i.dosis || '—'}</td>
                    <td style="padding:6px;border:1px solid #e2e8f0;font-size:10px;color:#475569;">
                        Terapeuta: ${i.posicion_terapeuta || '—'}<br/>
                        Paciente: ${i.posicion_paciente || '—'}
                    </td>
                    <td style="padding:6px;border:1px solid #e2e8f0;font-size:10px;color:#475569;font-style:italic;">${i.instrucciones_paciente || '—'}</td>
                </tr>
            `).join('');

            intervencionesSection = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:12px;margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e3a8a;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">🛠️ Fase 5: Plan de Intervención / Ejercicios</h4>
                    <table style="width:100%;border-collapse:collapse;margin:0;">
                        <thead>
                            <tr style="background:#cbd5e1;color:#1e293b;text-align:left;font-weight:700;">
                                <th style="padding:6px;border:1px solid #cbd5e1;font-size:11px;">Técnica</th>
                                <th style="padding:6px;border:1px solid #cbd5e1;font-size:11px;">Objetivo</th>
                                <th style="padding:6px;border:1px solid #cbd5e1;font-size:11px;">Dosis</th>
                                <th style="padding:6px;border:1px solid #cbd5e1;font-size:11px;">Posicionamiento</th>
                                <th style="padding:6px;border:1px solid #cbd5e1;font-size:11px;">Instrucciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${intListHTML}
                        </tbody>
                    </table>
                </div>
            `;
        }

        // Construcción de Reporte
        let construccionSection = '';
        if (sd.construction) {
            const c = sd.construction;
            construccionSection = `
                <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;font-size:13px;margin-bottom:16px;">
                    <h4 style="margin:0 0 10px;color:#1e3a8a;font-size:14px;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">📝 Fase 6: Diagnóstico y Objetivos (CIF)</h4>
                    <p style="margin:0 0 6px;"><strong>Diagnóstico Kinesiológico / CIF:</strong></p>
                    <p style="background:white;border:1px solid #e2e8f0;border-radius:8px;padding:10px;color:#334155;white-space:pre-wrap;margin:0 0 12px;">${c.diagnostico || '—'}</p>
                    
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                        <div><strong>Objetivo General:</strong><br/><span style="color:#475569;">${c.objetivo_general || '—'}</span></div>
                        <div><strong>Objetivos Específicos:</strong><br/><span style="color:#475569;">${c.objetivos_especificos || '—'}</span></div>
                    </div>
                    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
                        <div><strong>Objetivos Operacionales:</strong><br/><span style="color:#475569;">${c.objetivos_operacionales || '—'}</span></div>
                        <div><strong>Plan por Fases:</strong><br/><span style="color:#475569;">${c.plan_fases || '—'}</span></div>
                    </div>
                    <div><strong>Criterios de Reevaluación y Alta:</strong><br/><span style="color:#475569;">${c.reevaluacion || '—'}</span></div>
                </div>
            `;
        }

        interactiveHTML = `
            <div style="page-break-before: always; height: 1px;"></div>
            <h2 style="font-size:18px;color:#1e3a8a;border-bottom:3px solid #3b82f6;padding-bottom:6px;margin-top:40px;">📝 Registro Completo de la Sesión (Respuestas del Alumno)</h2>
            <p style="font-size:12px;color:#64748b;margin-bottom:20px;">A continuación se detalla todo el trabajo interactivo realizado por el estudiante durante la simulación.</p>
            ${entrevistaSection}
            ${razonamiento1Section}
            ${examenSection}
            ${razonamiento2Section}
            ${intervencionesSection}
            ${construccionSection}
        `;
    }

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Reporte Simulador - ${int.userName}</title>
    <style>@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;900&display=swap');
    body{font-family:'Inter',sans-serif;max-width:800px;margin:0 auto;padding:40px 30px;color:#1e293b;line-height:1.5;}
    h1{font-size:22px;margin:0;} h2{font-size:16px;border-bottom:2px solid #e2e8f0;padding-bottom:6px;margin-top:28px;color:#334155;}
    h3{font-size:14px;color:#1e3a8a;margin-top:20px;}
    .header{display:flex;justify-content:space-between;align-items:center;border-bottom:3px solid #f59e0b;padding-bottom:16px;margin-bottom:24px;}
    .nota-box{background:linear-gradient(135deg,#fffbeb,#fef3c7);border:2px solid #f59e0b;border-radius:12px;padding:16px 24px;text-align:center;}
    .nota-big{font-size:36px;font-weight:900;color:#92400e;} .grid2{display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:14px;}
    table{width:100%;border-collapse:collapse;margin-top:10px;} th{text-align:left;padding:8px 10px;background:#f1f5f9;font-size:11px;text-transform:uppercase;letter-spacing:0.5px;color:#64748b;}
    @media print{body{padding:20px;} .no-print{display:none;}}
    </style></head><body>
    <div class="header">
        <div>
            <h1>🎓 Reporte de Simulación Clínica</h1>
            <p style="margin:4px 0;font-size:13px;color:#64748b;">Historial de Intentos · ${fechaStr}</p>
            <p style="margin:2px 0;font-size:13px;"><strong>Estudiante:</strong> ${int.userName} (${int.userEmail}) · <strong>Tiempo:</strong> ${formatTimeHelper(int.tiempoSegundos || 0)}</p>
            <p style="margin:2px 0;font-size:13px;"><strong>Modo de Práctica:</strong> <span style="text-transform:capitalize;font-weight:bold;">${int.practiceMode || 'completo'}</span></p>
        </div>
        <div class="nota-box">
            <div class="nota-big">${notaFinal}</div>
            <div style="font-size:12px;font-weight:700;color:#92400e;">NOTA FINAL</div>
        </div>
    </div>
    <h2>📋 Caso Clínico</h2>
    <div class="grid2">
        <div><strong>Paciente:</strong> ${int.pacienteNombre || '—'}</div>
        <div><strong>Área:</strong> ${int.area || 'Aleatoria'}</div>
        <div><strong>Dificultad:</strong> ${int.dificultad || 'Intermedio'}</div>
    </div>
    <p style="font-size:14px;margin-top:8px;"><strong>Motivo de Consulta:</strong> ${int.motivoConsulta || '—'}</p>
    
    <h2>📊 Scorecard por Competencia</h2>
    <table>
        <thead>
            <tr>
                <th>Competencia</th>
                <th style="text-align:center;">Puntaje</th>
                <th>Retroalimentación</th>
            </tr>
        </thead>
        <tbody>
            ${scorecardRows || '<tr><td colspan="3" style="text-align:center;padding:12px;color:#94a3b8;">No hay desglose disponible.</td></tr>'}
        </tbody>
    </table>
    
    <div class="grid2" style="margin-top:20px;">
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#1e293b;">${int.puntajeGlobal}/100</div>
            <div style="font-size:11px;color:#64748b;">Puntaje Evaluación (70%)</div>
        </div>
        ${int.notaComision ? `
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:10px;padding:14px;text-align:center;">
            <div style="font-size:24px;font-weight:900;color:#1e293b;">${int.puntajeComision}/100</div>
            <div style="font-size:11px;color:#64748b;">Puntaje Comisión (30%)</div>
        </div>` : ''}
    </div>
    
    ${erroresHTML ? `<h2>❌ Errores Críticos</h2>${erroresHTML}` : ''}
    ${aciertosHTML ? `<h2>✅ Aciertos Destacados</h2>${aciertosHTML}` : ''}
    ${areasHTML ? `<h2>📈 Áreas de Mejora</h2><ul>${areasHTML}</ul>` : ''}
    ${int.perlaDocente ? `<h2>💎 Perla Docente</h2><p style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;padding:14px;font-size:13px;color:#3730a3;font-style:italic;">${int.perlaDocente}</p>` : ''}
    ${comisionHTML ? `<h2>🎤 Defensa de Comisión</h2>${comisionHTML}` : ''}
    
    ${interactiveHTML}

    <div class="no-print" style="text-align:center;margin-top:32px;">
        <button onclick="window.print()" style="background:#0f172a;color:white;border:none;padding:12px 32px;border-radius:10px;font-weight:700;cursor:pointer;font-size:14px;">📄 Guardar / Imprimir Reporte</button>
    </div>
    </body></html>`;

    const w = window.open('', '_blank');
    if (w) {
        w.document.write(html);
        w.document.close();
    }
}
