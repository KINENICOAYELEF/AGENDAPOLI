import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { PROMPTS, SYSTEM_PROMPT_BASE } from '@/lib/ai/prompts';
import { DiagnosisSchema } from '@/lib/ai/schemas';
import { generateSHA256, normalizePayload } from '@/lib/ai/hash';

const rateLimitCache = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS = 10;

function checkRateLimit(userId: string): boolean {
    const now = Date.now();
    const record = rateLimitCache.get(userId);

    if (!record) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (now - record.timestamp > RATE_LIMIT_WINDOW_MS) {
        rateLimitCache.set(userId, { count: 1, timestamp: now });
        return true;
    }
    if (record.count >= MAX_REQUESTS) return false;
    record.count += 1;
    return true;
}

export async function POST(req: Request) {
    try {
        const { payload, userId } = await req.json();

        if (userId && !checkRateLimit(userId)) {
            return NextResponse.json({ error: 'RATE_LIMIT_EXCEEDED', message: 'Has excedido el límite de peticiones (10 requests / 10 min).' }, { status: 429 });
        }

        // El frontend ahora ensambla la estructura compact_case_package completa
        const normalizedPayload = normalizePayload(payload);

        const inputHash = await generateSHA256(`diagnosis:${normalizedPayload}`);

        const expectedJsonExample = `{
  "snapshot_clinico": { 
    "identificacion": { "nombre": "...", "edad": "...", "sexo": "..." },
    "contexto_basal": { "ocupacion": "...", "deporte_actividad": "...", "demanda_fisica": "...", "ayudas_tecnicas": "" },
    "factores_relevantes": { "comorbilidades": ["..."], "medicamentos": ["..."], "antecedentes_msk": ["..."], "observaciones_seguridad": ["..."] },
    "foco_y_lado": "...", "irritabilidad_sugerida": "...",
    "tolerancia_carga": { "nivel": "...", "explicacion": "..." },
    "tarea_indice": "...", "alertas_clinicas": ["..."]
  },
  "clasificacion_dolor": { 
    "categoria": "nociceptivo", "subtipos": ["Mecánico", "Inflamatorio"], "subtipo_manual": "", 
    "fundamento": { 
      "apoyo": ["Hallazgo 1 P1/P2...", "Hallazgo 2...", "Hallazgo 3...", "Hallazgo 4..."], 
      "duda_mezcla": ["Discordante 1...", "Discordante 2..."], 
      "conclusion": "Párrafo 3-4 oraciones..." 
    }, "nivel_confianza": "Alta" 
  },
  "sistema_y_estructuras": { 
    "sistemas_involucrados": ["musculoesquelético", "neuromuscular", "cardiovascular", "tegumentario", "endocrino", "nervioso periférico"], 
    "estructuras": {
      "principales": [
        { "nombre": "Articulación Principal", "argumento": "3 oraciones cruzando P1+P2..." },
        { "nombre": "Articulación Secundaria", "argumento": "3 oraciones con test/ROM de P2..." }
      ],
      "secundarias": [
        { "nombre": "Ligamento X", "argumento": "Correlación P1/P1.5 con P2..." },
        { "nombre": "Músculo Y", "argumento": "Debilidad en P2 + queja funcional P1..." },
        { "nombre": "Core/Estabilizador", "argumento": "Control motor en P2 + antecedente P1.5..." }
      ],
      "asociadas_moduladoras": [
        { "nombre": "Comorbilidad cardiovascular", "argumento": "Párrafo: medicamento + microperfusión + umbral esfuerzo..." },
        { "nombre": "Cicatriz/Fascia", "argumento": "Párrafo: restricción fascial + transferencia tensional..." },
        { "nombre": "Sistema Endocrino", "argumento": "Párrafo: reparación colágeno + tiempos recuperación..." },
        { "nombre": "Nervios Periféricos", "argumento": "Párrafo: proximidad anatómica + vigilancia..." },
        { "nombre": "Vascular periférico", "argumento": "Párrafo: perfusión + llenado capilar..." }
      ]
    },
    "estructuras_mas_afectan": "Resumen integrador..." 
  },
  "alteraciones_detectadas": { 
    "estructurales": [
      { "estructura": "Articulación X", "alteracion": "Disfunción mecánica...", "certeza": "Probable", "fundamento": "Cluster positivo P2 + mecanismo P1. 2-3 oraciones.", "impacto_caso": "Mucho" },
      { "estructura": "Ligamento Y", "alteracion": "Irritación tisular...", "certeza": "Posible", "fundamento": "Palpación P2 + historial P1. 2-3 oraciones.", "impacto_caso": "Mucho" },
      { "estructura": "Músculo Z", "alteracion": "Atrofia/Hipotrofia...", "certeza": "Posible", "fundamento": "Volumen reducido P2 + desuso P1. 2-3 oraciones.", "impacto_caso": "Mucho" },
      { "estructura": "Sistema Cardiovascular", "alteracion": "Comorbilidad sistémica...", "certeza": "Confirmada", "fundamento": "Antecedente P1.5 + fatiga P2. 2-3 oraciones.", "impacto_caso": "Poco" },
      { "estructura": "Sistema Endocrino", "alteracion": "Metabolismo ralentizado...", "certeza": "Confirmada", "fundamento": "P1.5 + cronicidad del cuadro. 2-3 oraciones.", "impacto_caso": "Poco" },
      { "estructura": "Fascia/Piel", "alteracion": "Fibrosis post-quirúrgica...", "certeza": "Probable", "fundamento": "Cicatriz P1.5 + restricción deslizamiento P2. 2-3 oraciones.", "impacto_caso": "Mucho" },
      { "estructura": "Nervio periférico", "alteracion": "Mecanosensibilidad neural...", "certeza": "Posible", "fundamento": "Tensión posterior P1 + slump P2. 2-3 oraciones.", "impacto_caso": "Medio" },
      { "estructura": "Hueso Subcondral", "alteracion": "Estrés óseo...", "certeza": "Duda", "fundamento": "Dolor post-carga P1 + percusión P2. 2-3 oraciones.", "impacto_caso": "Medio" }
    ], 
    "funcionales": [
      { "funcion_disfuncion": "Dolor somático profundo en zona X", "severidad": "Severa", "fundamento": "EVA 8/10 P1 + reproducción P2. Cruce obligatorio.", "dominio_sugerido": "Dolor" },
      { "funcion_disfuncion": "Irritabilidad mecánica patológica (After-effect >2h)", "severidad": "Severa", "fundamento": "Relato P1 + limitó pruebas P2.", "dominio_sugerido": "Dolor" },
      { "funcion_disfuncion": "Baja tolerancia a carga axial acumulada", "severidad": "Moderada", "fundamento": "Bipedestación limitada P1 + claudicación P2.", "dominio_sugerido": "Carga" },
      { "funcion_disfuncion": "Debilidad de abductores cadera", "severidad": "Moderada", "fundamento": "Inestabilidad escaleras P1 + MMT 3/5 P2.", "dominio_sugerido": "Fuerza" },
      { "funcion_disfuncion": "Déficit de control motor lumbopélvico", "severidad": "Moderada", "fundamento": "Compensaciones puente unilateral P2 + cicatriz abdominal P1.5.", "dominio_sugerido": "Control Motor" },
      { "funcion_disfuncion": "Rigidez articular en rotación", "severidad": "Moderada", "fundamento": "ROM limitado P2 + queja funcional P1.", "dominio_sugerido": "ROM" },
      { "funcion_disfuncion": "Inhibición muscular artrogénica (AMI)", "severidad": "Leve", "fundamento": "Activación tardía en carga monopodal P2.", "dominio_sugerido": "Fuerza" },
      { "funcion_disfuncion": "Desacondicionamiento cardiovascular", "severidad": "Moderada", "fundamento": "HTA P1.5 + fatiga submáxima P2.", "dominio_sugerido": "Resistencia" },
      { "funcion_disfuncion": "Déficit propioceptivo funcional", "severidad": "Leve", "fundamento": "Inestabilidad unipodal P1 + equilibrio P2.", "dominio_sugerido": "Propiocepción" },
      { "funcion_disfuncion": "Kinesiofobia / Evitación al movimiento", "severidad": "Moderada", "fundamento": "Evitación selectiva P1 + conducta protectora P2.", "dominio_sugerido": "Psicosocial" },
      { "funcion_disfuncion": "Alteración calidad de sueño", "severidad": "Leve", "fundamento": "Dolor nocturno P1 + fatiga diurna reportada.", "dominio_sugerido": "Sueño/Recuperación" },
      { "funcion_disfuncion": "Déficit de potencia / RFD", "severidad": "Moderada", "fundamento": "Incapacidad salto P1 + tiempo reacción P2.", "dominio_sugerido": "Rendimiento" },
      { "funcion_disfuncion": "Sensibilización periférica perilesional", "severidad": "Leve", "fundamento": "Hiperalgesia secundaria observada P2.", "dominio_sugerido": "Dolor" }
    ]
  },
  "actividad_y_participacion": { 
    "limitaciones_directas": [
      { "texto": "Dificultad para subir/bajar escaleras con carga", "severidad": "severa", "detalle": "Debilidad de abductores + dolor articular impiden gestión segura de carga en plano inclinado." },
      { "texto": "Incapacidad para mantener sedestación prolongada >30min", "severidad": "moderada", "detalle": "Sobrecarga articular + rigidez post-estática generan dolor creciente." },
      { "texto": "Limitación para agacharse y recoger objetos del suelo", "severidad": "moderada", "detalle": "Déficit de control motor lumbopélvico + dolor en flexión profunda." },
      { "texto": "Dificultad para caminar >20 minutos seguidos", "severidad": "moderada", "detalle": "Claudicación precoz + fatiga cardiovascular + after-effect prolongado." },
      { "texto": "Imposibilidad de correr o trotar", "severidad": "severa", "detalle": "Dolor >7/10 en impacto repetitivo + desacondicionamiento cardiovascular." },
      { "texto": "Dificultad para vestirse (calcetines, zapatos)", "severidad": "leve", "detalle": "ROM limitado en rotación + rigidez matinal." }
    ],
    "restricciones_participacion": [
      { "texto": "Abandono total de actividad deportiva recreativa", "severidad": "severa", "detalle": "No puede correr, trotar ni participar en actividades grupales por dolor e inestabilidad." },
      { "texto": "Limitación en productividad laboral", "severidad": "moderada", "detalle": "Sedestación prolongada provoca dolor creciente, reduciendo concentración y rendimiento." },
      { "texto": "Reducción de participación social/familiar", "severidad": "moderada", "detalle": "Evita paseos familiares, salidas recreativas y actividades que requieran bipedestación." },
      { "texto": "Dificultad en roles domésticos", "severidad": "moderada", "detalle": "Tareas como limpiar, cocinar de pie o cargar bolsas generan after-effect." },
      { "texto": "Alteración del descanso y calidad de vida", "severidad": "leve", "detalle": "Dolor nocturno interrumpe sueño, afectando humor, energía y relaciones interpersonales." },
      { "texto": "Dependencia de transporte para distancias cortas", "severidad": "leve", "detalle": "No puede caminar distancias que antes recorría a pie, necesita auto/bus." }
    ]
  },
  "factores_biopsicosociales": { 
    "factores_personales_positivos": ["Motivación alta para rehabilitación", "Apoyo familiar sólido", "Nivel educativo que facilita comprensión", "Experiencia deportiva previa", "Actitud proactiva hacia el ejercicio"],
    "factores_personales_negativos": ["Kinesiofobia moderada", "Catastrofización ante dolor nocturno", "Frustración por limitación deportiva", "Estrés laboral por rendimiento reducido", "Hábitos sedentarios adquiridos post-lesión"],
    "facilitadores_ambientales": ["Acceso a centro de rehabilitación cercano", "Flexibilidad horaria laboral parcial", "Disponibilidad de equipamiento básico en casa", "Red de apoyo social activa", "Clima templado que favorece actividad al aire libre"],
    "barreras_ambientales": ["Trabajo sedentario sin opción de standing desk", "Escaleras como único acceso al hogar", "Distancia al centro deportivo", "Carga laboral que limita frecuencia de sesiones", "Falta de asesoría nutricional complementaria"],
    "factores_clinicos_moduladores": ["HTA controlada farmacológicamente", "Hipotiroidismo en tratamiento", "Cicatriz quirúrgica abdominal", "Antecedente de fractura antigua", "Cronicidad del cuadro (>3 meses)"],
    "observaciones_bps_integradas": "Texto narrativo de 5-6 oraciones conectando todos los factores con lógica experta biopsicosocial..."
  },
  "recordatorios_y_coherencia": { 
    "recordatorios_clinicos": ["Vigilar PA durante ejercicio por HTA", "Monitorear TSH si recuperación lenta", "Evaluar calzado deportivo antes de reintegro"], 
    "cosas_a_vigilar_en_tratamiento": ["Dolor nocturno: si aumenta, derivar", "After-effect >2h: reducir carga 30%", "Signos neurológicos: vigilar parestesias"], 
    "faltantes_no_criticos": ["Falta test neurodinámico formal", "No se documentó evaluación de piso pélvico"], 
    "incoherencias_detectadas": [] 
  }
}`;

        const userPrompt = `
Genera el output requerido usando EXCLUSIVAMENTE formato JSON parseable y cumpliendo estrictamente con la siguiente estructura.
REGLA CRÍTICA: E1 (estructurales) MÍNIMO 6 ítems. E2 (funcionales) MÍNIMO 12 ítems. F1 (limitaciones) MÍNIMO 5 ítems. F2 (restricciones) MÍNIMO 5 ítems. G cada categoría MÍNIMO 4 ítems. INFIERE impactos clínicos cuando no sean explícitos.

ESTRUCTURA JSON OBLIGATORIA:
${expectedJsonExample}

DATOS CLÍNICOS ESTRUCTURADOS DE ENTRADA (COMPACT CASE PACKAGE):
${normalizedPayload}
    `;

        // Sanitizador: rellena campos que el modelo lite a veces omite, SIN relajar el schema
                const sanitizeP3Response = (data: any) => {
            if (!data) return {};
            
            // A. Clasificación Dolor
            if (!data.clasificacion_dolor) data.clasificacion_dolor = {};
            if (!data.clasificacion_dolor.subtipos) data.clasificacion_dolor.subtipos = [];
            if (!data.clasificacion_dolor.fundamento) data.clasificacion_dolor.fundamento = {};
            if (!data.clasificacion_dolor.fundamento.apoyo) data.clasificacion_dolor.fundamento.apoyo = [];
            if (!data.clasificacion_dolor.fundamento.duda_mezcla) data.clasificacion_dolor.fundamento.duda_mezcla = [];
            if (!data.clasificacion_dolor.fundamento.conclusion) data.clasificacion_dolor.fundamento.conclusion = "";

            // B. Sistemas y Estructuras
            if (!data.sistema_y_estructuras) data.sistema_y_estructuras = {};
            if (!data.sistema_y_estructuras.sistemas_involucrados) data.sistema_y_estructuras.sistemas_involucrados = [];
            if (!data.sistema_y_estructuras.estructuras) data.sistema_y_estructuras.estructuras = {};
            if (!data.sistema_y_estructuras.estructuras.principales) data.sistema_y_estructuras.estructuras.principales = [];
            if (!data.sistema_y_estructuras.estructuras.secundarias) data.sistema_y_estructuras.estructuras.secundarias = [];
            if (!data.sistema_y_estructuras.estructuras.asociadas_moduladoras) data.sistema_y_estructuras.estructuras.asociadas_moduladoras = [];
            if (!data.sistema_y_estructuras.estructuras_mas_afectan) data.sistema_y_estructuras.estructuras_mas_afectan = "";

            // C. Alteraciones
            if (!data.alteraciones_detectadas) data.alteraciones_detectadas = {};
            if (!data.alteraciones_detectadas.estructurales) data.alteraciones_detectadas.estructurales = [];
            if (!data.alteraciones_detectadas.funcionales) data.alteraciones_detectadas.funcionales = [];

            // D. Actividad y Participación
            if (!data.actividad_y_participacion) data.actividad_y_participacion = {};
            if (!data.actividad_y_participacion.limitaciones_directas) data.actividad_y_participacion.limitaciones_directas = [];
            if (!data.actividad_y_participacion.restricciones_participacion) data.actividad_y_participacion.restricciones_participacion = [];

            // E. Factores Biopsicosociales
            if (!data.factores_biopsicosociales) data.factores_biopsicosociales = {};
            if (!data.factores_biopsicosociales.factores_personales_positivos) data.factores_biopsicosociales.factores_personales_positivos = [];
            if (!data.factores_biopsicosociales.factores_personales_negativos) data.factores_biopsicosociales.factores_personales_negativos = [];
            if (!data.factores_biopsicosociales.facilitadores_ambientales) data.factores_biopsicosociales.facilitadores_ambientales = [];
            if (!data.factores_biopsicosociales.barreras_ambientales) data.factores_biopsicosociales.barreras_ambientales = [];
            if (!data.factores_biopsicosociales.factores_clinicos_moduladores) data.factores_biopsicosociales.factores_clinicos_moduladores = [];
            if (!data.factores_biopsicosociales.observaciones_bps_integradas) data.factores_biopsicosociales.observaciones_bps_integradas = "";

            // F. Recordatorios y Coherencia
            if (!data.recordatorios_y_coherencia) data.recordatorios_y_coherencia = {};
            if (!data.recordatorios_y_coherencia.recordatorios_clinicos) data.recordatorios_y_coherencia.recordatorios_clinicos = [];
            if (!data.recordatorios_y_coherencia.cosas_a_vigilar_en_tratamiento) data.recordatorios_y_coherencia.cosas_a_vigilar_en_tratamiento = [];
            if (!data.recordatorios_y_coherencia.faltantes_no_criticos) data.recordatorios_y_coherencia.faltantes_no_criticos = [];
            if (!data.recordatorios_y_coherencia.incoherencias_detectadas) data.recordatorios_y_coherencia.incoherencias_detectadas = [];

            return data;
        };

        const result = await executeAIAction({
            screen: 'P3',
            action: 'P3_SYNTHESIS',
            systemInstruction: SYSTEM_PROMPT_BASE + "\n\n" + PROMPTS.DIAGNOSIS,
            userPrompt,
            inputHash,
            promptVersion: 'v3.9.2',
            temperature: 0.1,
            validator: (data) => DiagnosisSchema.parse(sanitizeP3Response(data))
        });

        // The UI (Screen3_Sintesis) currently expects `{ success: true, data: ..., hash, latencyMs }`
        return NextResponse.json({
            success: true,
            data: result.data,
            hash: result.telemetry.inputHash,
            latencyMs: result.telemetry.latencyMs,
            telemetry: result.telemetry
        });

    } catch (err: any) {
        console.error('Error in /api/ai/diagnosis:', err);
        return NextResponse.json({ error: 'INTERNAL_ERROR', message: err.message }, { status: 500 });
    }
}
