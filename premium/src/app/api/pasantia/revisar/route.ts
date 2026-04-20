import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import type { EntregaPasantia, RevisionIAResultado } from '@/types/pasantia';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { entrega }: { entrega: EntregaPasantia } = body;

    const systemInstruction = `
Eres un docente universitario experto en Kinesiología clínica evaluando una entrega de estudiantes de 2º año en pasantía.
El modelo de IA que estás usando es Gemini 2.5 Flash.
Tu tarea es revisar de manera global la entrega completa (que consta de DOS casos clínicos) y entregar retroalimentación pedagógica clara, honesta y constructiva que englobe el desempeño del estudiante en ambos casos en conjunto.

REGLAS ABSOLUTAS:
1. Evalúa SOLO lo que los estudiantes escribieron en ambos casos. No inventes datos clínicos, no supongas información no escrita.
2. Sé específico al señalar errores: cita de qué caso y qué sección es el problema principal.
3. Usa lenguaje académico pero directo, entendible para estudiantes de 2º año.
4. No seas condescendiente, pero sé honesto con las debilidades globales.
5. Responde SIEMPRE en JSON válido con la estructura exacta solicitada.
6. Los puntajes sugeridos son solo orientativos y deben representar la evaluación GLOBAL de la entrega considerando ambos casos (promedio o apreciación general).
7. Escala de puntaje sugerido por criterio: 1 (no cumple) a 5 (cumple a cabalidad).
`;

    const formatCaso = (caso: any, num: number) => `
=== CASO CLÍNICO ${num} ===
DATOS USUARIA: ${caso.datosUsuaria.nombre}, ${caso.datosUsuaria.edad}, ${caso.datosUsuaria.ocupacion}, ${caso.datosUsuaria.motivoConsulta}.
ANAMNESIS: ${caso.anamnesis}
INTERPRETACIÓN: ${caso.interpretacionAnamnesis}

EVALUACIONES REALIZADAS:
${caso.evaluaciones.map((e: any, i: number) => `Eval ${i + 1}: ${e.nombre} | Resultado: ${e.resultado} | Int: ${e.interpretacion}`).join('\n')}

HALLAZGOS: 1. ${caso.hallazgo1} | 2. ${caso.hallazgo2} | 3. ${caso.hallazgo3}

TABLA CIF:
- Estructuras: ${caso.cif.estructurasCorporales}
- Funciones: ${caso.cif.funcionesCorporales}
- Actividades: ${caso.cif.actividades}
- Participación: ${caso.cif.participacion}
- F. Personales: ${caso.cif.factoresPersonales}
- F. Ambientales: ${caso.cif.factoresAmbientales}

DIAGNÓSTICO KINESIOLÓGICO:
${caso.diagnosticoKinesiologico}
`;

    const userPrompt = `
Revisa la siguiente ENTREGA COMPLETA de pasantía de 2º año, de los estudiantes: ${entrega.dupla.estudiante1} y ${entrega.dupla.estudiante2}.

${formatCaso(entrega.caso1, 1)}

${formatCaso(entrega.caso2, 2)}

---

Evalúa los 4 dominios técnicos (c3 a c6) DE FORMA GLOBAL PARA AMBOS CASOS según la siguiente rúbrica:
- c3: La entrevista/anamnesis es pertinente, está ejecutada correctamente y los datos se ordenan de manera correcta.
- c4: Las evaluaciones iniciales son pertinentes, se ejecutan correctamente y los resultados se interpretan de manera correcta.
- c5: La tabla CIF es coherente con la observación, entrevista y evaluación.
- c6: El diagnóstico kinesiológico incipiente es coherente con el modelo de acción profesional y prioriza las necesidades de la persona.

Responde ÚNICAMENTE con este JSON:
{
  "fortalezas": "Párrafo breve sobre lo que el estudiante hizo bien (máx 100 palabras)",
  "errores": "Párrafo breve describiendo errores o vacíos principales (máx 120 palabras)",
  "sugerencia": "Sugerencia concreta de mejora (máx 80 palabras)",
  "puntajesSugeridos": {
    "c3": <número 1-5>,
    "c4": <número 1-5>,
    "c5": <número 1-5>,
    "c6": <número 1-5>
  },
  "comentarioRetroalimentacion": "Comentario breve y constructivo para devolver a la dupla (máx 80 palabras)"
}
`;

    const rawText = await callGemini({
      systemInstruction,
      userPrompt,
      temperature: 0.3,
      responseMimeType: 'application/json',
    });

    let parsed: RevisionIAResultado;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No se pudo extraer JSON de la respuesta IA');
      parsed = JSON.parse(match[0]);
    }

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Error desconocido';
    console.error('[Pasantía IA] Error:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
