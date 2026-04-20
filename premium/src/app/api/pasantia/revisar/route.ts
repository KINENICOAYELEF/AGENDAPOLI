import { NextResponse } from 'next/server';
import { callGemini } from '@/lib/ai/geminiClient';
import type { CasoClinco, RevisionIAResultado } from '@/types/pasantia';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { caso, numeroCaso }: { caso: CasoClinco; numeroCaso: number } = body;

    const systemInstruction = `
Eres un docente universitario experto en Kinesiología clínica evaluando una entrega de estudiantes de 2º año en pasantía.
Tu tarea es revisar el caso clínico registrado y entregar retroalimentación pedagógica clara, honesta y constructiva.

REGLAS ABSOLUTAS:
1. Evalúa SOLO lo que el estudiante escribió. No inventes datos clínicos, no supongas información no escrita.
2. Sé específico al señalar errores: cita el campo o sección problemática.
3. Usa lenguaje académico pero directo, entendible para estudiantes de 2º año.
4. No seas condescendiente, pero sé honesto con las debilidades.
5. Responde SIEMPRE en JSON válido con la estructura exacta solicitada.
6. Los puntajes sugeridos son solo orientativos (el docente decide el final).
7. Escala de puntaje sugerido por criterio: 1 (no cumple) a 5 (cumple a cabalidad).
`;

    const userPrompt = `
Revisa el siguiente CASO ${numeroCaso} de una entrega de pasantía de 2º año de Kinesiología.

=== DATOS DE LA USUARIA ===
Nombre: ${caso.datosUsuaria.nombre}
Edad: ${caso.datosUsuaria.edad}
Ocupación: ${caso.datosUsuaria.ocupacion}
Contexto: ${caso.datosUsuaria.contextoAtencion}
Motivo de consulta: ${caso.datosUsuaria.motivoConsulta}

=== ANAMNESIS ===
${caso.anamnesis}

=== INTERPRETACIÓN DE LA ANAMNESIS ===
${caso.interpretacionAnamnesis}

=== EVALUACIONES REALIZADAS ===
${caso.evaluaciones.map((e, i) => `
Evaluación ${i + 1}: ${e.nombre}
  Por qué: ${e.razon}
  Resultado: ${e.resultado}
  Interpretación: ${e.interpretacion}
`).join('\n')}

=== HALLAZGOS PRINCIPALES ===
1. ${caso.hallazgo1}
2. ${caso.hallazgo2}
3. ${caso.hallazgo3}

=== TABLA CIF ===
Estructuras corporales: ${caso.cif.estructurasCorporales}
Funciones corporales: ${caso.cif.funcionesCorporales}
Actividades: ${caso.cif.actividades}
Participación: ${caso.cif.participacion}
Factores personales: ${caso.cif.factoresPersonales}
Factores ambientales: ${caso.cif.factoresAmbientales}

=== DIAGNÓSTICO KINESIOLÓGICO INCIPIENTE ===
${caso.diagnosticoKinesiologico}

---

Evalúa los 4 dominios técnicos (c3 a c6) según la siguiente rúbrica:
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
