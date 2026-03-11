const fs = require('fs');
const { GoogleGenAI } = require('@google/genai');

const envFile = fs.readFileSync('.env.local', 'utf8');
const match = envFile.match(/GEMINI_API_KEY=["']?([^"'\n\r]+)["']?/);
const apiKey = match ? match[1].trim() : null;

if (!apiKey) {
    console.error("No API key found");
    process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const SYSTEM_PROMPT_P1_SYNTHESIS = `
[RESTRICCIÓN ABSOLUTA Y OBLIGATORIA]
Eres un asistente experto en kinesiología MSK y deportiva.
Funciones: clasificar dolor, irritabilidad, descartar red flags, generar hipótesis orientativas y sugerir enfoques de examen físico para P2.

NO DEBES:
- Entregar un diagnóstico médico definitivo por imágenes
- Escribir texto relleno o narrativo fuera del JSON
- Inventar hipótesis sin fundamento

TU SALIDA DEBE SER EXCLUSIVAMENTE UN JSON VÁLIDO. Piensa primero en descartar cuadros graves y luego en confirmar hipótesis. 
Debe ser especialmente bueno razonando irritabilidad, naturaleza del dolor y qué examen físico aporta realmente.

SIGUE EXACTAMENTE ESTA ESTRUCTURA JSON (devuelve solo esto, sin markdown fences ni explicaciones previas):
{
  "resumen_clinico_editable": "string",
  "resumen_persona_usuaria": { "lo_que_entendi": "string", "lo_que_te_preocupa": "string", "lo_que_haremos_ahora": "string" },
  "alicia": { "agravantes": "string", "atenuantes": "string", "localizacion_extension": "string", "intensidad_actual": "string", "intensidad_mejor_24h": "string", "intensidad_peor_24h": "string", "caracter_naturaleza": "string", "irritabilidad_relato": "string", "antiguedad_inicio": "string", "historia_mecanismo": "string" },
  "sins": { "severidad": "string", "irritabilidad_global": "string", "naturaleza_sugerida": "string", "etapa": "string", "facilidad_provocacion": "string", "momento_aparicion": "string", "tiempo_a_calmarse": "string", "after_effect": "string" },
  "foco_principal": { "region": "string", "lado": "string", "queja_prioritaria": "string", "actividad_indice": "string", "semaforo_carga_sugerido": "string" },
  "hipotesis_orientativas": [ { "ranking": 1, "titulo": "string", "probabilidad": "mas_probable|probable_alternativa|menos_probable", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" }, { "ranking": 2, "titulo": "string", "probabilidad": "probable_alternativa", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" }, { "ranking": 3, "titulo": "string", "probabilidad": "menos_probable", "fundamento_breve": "string", "que_hay_que_descartar": "string", "que_hay_que_confirmar": "string" } ],
  "preguntas_faltantes": [ { "pregunta": "string", "por_que_importa": "string", "prioridad": "alta|media" } ],
  "recomendaciones_p2_por_modulo": { "observacion_movimiento_inicial": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "rango_movimiento_analitico": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "fuerza_tolerancia_carga": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "palpacion": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "neuro_vascular_somatosensorial": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "control_motor_sensoriomotor": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "pruebas_ortopedicas_dirigidas": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" }, "pruebas_funcionales_reintegro": { "objetivo": "string", "que_descarta": "string", "que_confirma": "string", "prioridad": "string" } },
  "factores_contextuales_clave": { "banderas_rojas": ["string"], "banderas_amarillas": ["string"], "facilitadores": ["string"], "barreras": ["string"] }
}
`;

const fakePayload = {
    relatoLibre: "Paciente refiere dolor en la rodilla derecha tras un salto jugando basquetbol. Sintió un pop audible. Hubo inflamación inmediata. Tomó paracetamol.",
    motivoConsultaPrincipal: "Dolor rodilla",
    dolorPrincipal: "Rodilla derecha",
    focos: [{lado: "Derecha", region: "Rodilla", actividadIndice: "Salto"}],
    agravantes: "Bajar escaleras, pivotar",
    atenuantes: "Reposo, hielo",
    intensidadActual: "5",
    intensidadMejor24h: "3",
    intensidadPeor24h: "8",
    irritabilidadRelatada: "Alta inicial, ahora moderada",
    antiguedadInicio: "Hace 2 días",
    mecanismoInicio: "Traumático",
    contextoFuncional: "No puede apoyar bien",
    seguridad: [],
    banderasAmarillas: [],
    antecedentesBasales: "No"
};

async function main() {
    const userPrompt = `
Genera la síntesis de P1 estructurada en json según las reglas. Responde de forma clínica, precisa y compacta.
DATOS CLÍNICOS ESTRUCTURADOS (ANAMNESIS Y MOTIVO DE CONSULTA):
${JSON.stringify(fakePayload)}
    `;

    try {
        console.log("Asking Gemini 3.1 Flash Lite Preview...");
        const response = await ai.models.generateContent({
            model: "gemini-3.1-flash-lite-preview",
            contents: userPrompt,
            config: {
                systemInstruction: SYSTEM_PROMPT_P1_SYNTHESIS,
                temperature: 0.1,
                responseMimeType: "application/json"
            }
        });
        
        const text = response.text;
        console.log("Raw Response length:", text.length);
        
        let cleaned = text.trim();
        if (cleaned.startsWith('```json')) cleaned = cleaned.substring(7);
        if (cleaned.endsWith('```')) cleaned = cleaned.substring(0, cleaned.length - 3);
        cleaned = cleaned.trim();
        
        const parsed = JSON.parse(cleaned);
        console.log("Parsed keys:", Object.keys(parsed));
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
