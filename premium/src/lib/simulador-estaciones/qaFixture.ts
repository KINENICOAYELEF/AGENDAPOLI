import {
  STATION_DEFINITIONS,
  STATION_KEYS,
  type PlanningDraft,
  type PublicStationSession,
  type StationKey,
  type TranscriptTurn,
} from './types';

export const STATION_QA_PREFIX = 'QA-E2E-STATIONS:';

const QA_PLANNING: PlanningDraft = {
  diagnosticoKinesiologico: 'Persona con dolor musculoesquelético persistente de la región evaluada, asociado a menor tolerancia a la carga y limitación para actividades funcionales relevantes, con factores contextuales que deben considerarse en la progresión.',
  problemaPrincipal: 'Limitación funcional por dolor y baja tolerancia a las demandas que la persona necesita recuperar.',
  objetivoGeneral: 'Recuperar la participación funcional relevante mediante educación, exposición progresiva y aumento de la capacidad física durante las próximas ocho semanas.',
  objetivosEspecificos: '1. Mejorar tolerancia a la actividad provocadora. 2. Aumentar fuerza y capacidad de carga. 3. Mejorar autogestión y comprensión del cuadro. 4. Recuperar una actividad prioritaria de la persona.',
  objetivosOperacionales: 'Ejercicio de fuerza específico 3 series de 8 a 12 repeticiones, RPE 6 a 8/10, dos a tres veces por semana, ajustado por respuesta a 24 horas. Educación breve sobre dosificación y manejo de síntomas. Exposición funcional progresiva con volumen semanal registrado.',
  planTratamiento: 'Dos sesiones semanales de 45 a 60 minutos durante ocho semanas, organizadas en fase inicial de modulación y aprendizaje, fase de desarrollo de capacidad y fase de reintegro funcional. Programa domiciliario dos a tres días por semana y ajuste según respuesta.',
  reevaluacion: 'Reevaluar cada cuatro sesiones y formalmente en la semana cuatro: dolor y respuesta a 24 horas, prueba funcional principal, fuerza/capacidad de carga y actividad prioritaria. Modificar dosis si no existe progreso clínicamente relevante.',
  pronostico: 'Favorable si existe adherencia y progresión gradual; puede enlentecerse por persistencia de síntomas, baja recuperación o barreras contextuales. El pronóstico se actualizará con la respuesta de las primeras cuatro semanas.',
};

function turn(station: StationKey, index: number, role: TranscriptTurn['role'], text: string): TranscriptTurn {
  return {
    id: `qa-${station.toLowerCase()}-${index}`,
    role,
    text,
    atMs: index * 15_000,
    confirmed: true,
  };
}

function caseText(session: PublicStationSession) {
  const visible = session.visibleCase as Record<string, unknown>;
  return {
    person: String(visible.nombre || 'persona del caso'),
    motive: String(visible.motivo_consulta || 'dolor y limitación funcional musculoesquelética'),
    evolution: String(visible.tiempo_evolucion || 'evolución no precisada'),
    occupation: String(visible.ocupacion || 'actividad habitual no precisada'),
  };
}

export function buildQaPlanningDraft(): PlanningDraft {
  return { ...QA_PLANNING };
}

export function buildQaStationPatch(session: PublicStationSession, station: StationKey) {
  const context = caseText(session);
  const messages: Record<Exclude<StationKey, 'PLANIFICACION_ESCRITA'>, TranscriptTurn[]> = {
    ANAMNESIS_PROXIMA: [
      turn(station, 1, 'STUDENT', `Confirmo identidad y consentimiento de ${context.person}. Exploro el motivo de consulta, inicio, evolución de ${context.evolution}, localización, intensidad, comportamiento de 24 horas, factores agravantes y aliviantes, irritabilidad, limitaciones funcionales, expectativas y señales de alarma.`),
      turn(station, 2, 'PATIENT', `El motivo principal es ${context.motive}. Entrego los datos preguntados y no refiero una señal de alarma nueva en esta entrevista.`),
      turn(station, 3, 'STUDENT', 'Sintetizo lo entendido, verifico el impacto sobre la actividad prioritaria y explico que la evaluación física se ajustará a la irritabilidad y seguridad observadas.'),
    ],
    ANAMNESIS_REMOTA: [
      turn(station, 1, 'STUDENT', `Pregunto antecedentes personales y familiares pertinentes, medicamentos, exámenes, tratamientos previos, actividad física, sueño, recuperación, estrés, creencias, apoyo y exigencias de su ocupación: ${context.occupation}.`),
      turn(station, 2, 'PATIENT', 'Respondo los antecedentes y factores contextuales solicitados. Aclaro qué tratamientos se han realizado y cómo fue la respuesta.'),
      turn(station, 3, 'STUDENT', 'Diferencio antecedentes que modifican seguridad, pronóstico o dosificación de aquellos que no explican por sí solos el problema actual.'),
    ],
    EXAMEN_FISICO: [
      turn(station, 1, 'STUDENT', 'Antes de medir explico el procedimiento, solicito consentimiento, observo la función elegida por la persona y registro una medida basal reproducible.'),
      turn(station, 2, 'EXAMINER', 'Se entregan los hallazgos del movimiento funcional, rango, fuerza y tolerancia a la carga correspondientes al caso.'),
      turn(station, 3, 'STUDENT', 'Selecciono rango activo y pasivo si es pertinente, fuerza o capacidad de carga, pruebas clínicas solo cuando cambian una hipótesis y una prueba funcional relacionada con la limitación. Interpreto los hallazgos en conjunto y no por una prueba aislada.'),
      turn(station, 4, 'STUDENT', 'Repito la medida prioritaria cuando corresponde y dejo registradas respuesta inmediata, seguridad y variables para reevaluación.'),
    ],
    INTERVENCIONES: [
      turn(station, 1, 'STUDENT', 'Intervención uno: educación sobre manejo de carga y respuesta a 24 horas, vinculada a la actividad prioritaria y sin mensajes de fragilidad.'),
      turn(station, 2, 'STUDENT', 'Intervención dos: ejercicio de fuerza específico, 3 series de 8 a 12 repeticiones, RPE 6 a 8 de 10, descanso de 90 a 120 segundos, dos a tres veces por semana, con técnica segura y monitoreo de síntomas.'),
      turn(station, 3, 'STUDENT', 'La progresión aumenta primero repeticiones dentro del rango y luego carga entre 5 y 10 por ciento si la técnica es estable y la respuesta a 24 horas es aceptable. Regresaría volumen, rango o carga ante exacerbación no tolerable.'),
      turn(station, 4, 'EXAMINER', 'La comisión registra objetivo, ejecución, dosis, criterio de respuesta, progresión y fundamento fisiológico presentados.'),
    ],
    PRESENTACION_FORMAL: [
      turn(station, 1, 'STUDENT', `Presento formalmente a ${context.person}, cuyo motivo de consulta es ${context.motive}. Integro anamnesis, contexto, hallazgos relevantes, hipótesis principal y diferenciales sin leer una lista inconexa.`),
      turn(station, 2, 'STUDENT', 'Expongo diagnóstico kinesiológico, problema principal, objetivos, intervenciones dosificadas, plan temporal, criterios de progresión, reevaluación y pronóstico, señalando las limitaciones de la información disponible.'),
      turn(station, 3, 'EXAMINER', 'Presentación registrada. Pasaremos a la defensa.'),
    ],
    DEFENSA: [
      turn(station, 1, 'EXAMINER', '¿Qué hallazgos aumentaron o disminuyeron el peso de su hipótesis principal?'),
      turn(station, 2, 'STUDENT', 'La hipótesis gana peso por la concordancia entre comportamiento de síntomas, demanda funcional y hallazgos de carga. Disminuye si aparecen datos incompatibles, déficit neurológico progresivo o ausencia de relación con la función. No baso la conclusión en una prueba aislada.'),
      turn(station, 3, 'EXAMINER', '¿Cómo modificaría el plan si la persona no mejora tras cuatro sesiones?'),
      turn(station, 4, 'STUDENT', 'Revisaría adherencia, dosis real, recuperación, evolución, barreras, hipótesis y medidas basales. Ajustaría una variable por vez, repetiría el examen pertinente y derivaría si aparecen señales de seguridad o una evolución incompatible.'),
      turn(station, 5, 'EXAMINER', 'Justifique la dosis y la progresión.'),
      turn(station, 6, 'STUDENT', 'La dosis busca un estímulo suficiente de adaptación sin exceder la tolerancia actual. La progresión depende de técnica, esfuerzo, respuesta durante la sesión y recuperación a 24 horas; no depende solo de que el dolor sea cero.'),
    ],
  };

  const definition = STATION_DEFINITIONS.find((item) => item.key === station)!;
  if (station === 'PLANIFICACION_ESCRITA') {
    return {
      action: 'COMPLETE_STATION' as const,
      station,
      remainingSeconds: 0,
      elapsedSeconds: 6 * 60,
      planningDraft: buildQaPlanningDraft(),
    };
  }

  const transcript = messages[station];
  const hasAudioUncertainty = station === 'EXAMEN_FISICO';
  const summary = `QA confirmado: la estación ${definition.title} quedó registrada con ${transcript.length} turnos y cierre semántico.`;
  return {
    action: 'COMPLETE_STATION' as const,
    station,
    remainingSeconds: 0,
    elapsedSeconds: Math.max(90, Math.min(definition.durationSeconds, 4 * 60)),
    transcript,
    semanticSummary: summary,
    semanticConfirmation: {
      status: hasAudioUncertainty ? 'PARTIAL' as const : 'CONFIRMED' as const,
      summary,
      studentCorrections: hasAudioUncertainty ? ['Se corrigió una palabra de la prueba funcional antes de cerrar.'] : [],
      unresolvedAudio: hasAudioUncertainty ? ['Un segmento breve de audio no fue evaluable y no debe penalizarse.'] : [],
      capturedAtMs: Date.now(),
    },
    audioUncertainties: hasAudioUncertainty ? ['Segmento QA de audio deliberadamente incierto.'] : [],
    reconnectCount: station === 'EXAMEN_FISICO' ? 2 : 0,
  };
}

export function validateQaSession(session: PublicStationSession) {
  const stationChecks = STATION_KEYS.map((key) => {
    const progress = session.stations[key];
    return {
      key,
      completed: progress.status === 'COMPLETED',
      hasEvidence: key === 'PLANIFICACION_ESCRITA'
        ? Object.values(session.planningDraft).join(' ').length > 80
        : progress.transcript.some((item) => item.role === 'STUDENT' && item.text.length > 10),
      hasSemanticClosure: key === 'PLANIFICACION_ESCRITA' || progress.semanticConfirmation.status !== 'PENDING',
    };
  });
  return {
    stationChecks,
    allStationsCompleted: stationChecks.every((item) => item.completed),
    allEvidencePresent: stationChecks.every((item) => item.hasEvidence),
    semanticClosuresPresent: stationChecks.every((item) => item.hasSemanticClosure),
    reconnectPersisted: session.stations.EXAMEN_FISICO.reconnectCount === 2,
    audioUncertaintyPersisted: session.stations.EXAMEN_FISICO.semanticConfirmation.status === 'PARTIAL',
    finalEvaluationPresent: Boolean(session.evaluation),
    modelTracePresent: Boolean(session.modelTrace?.caseGeneration && session.modelTrace?.finalEvaluation),
  };
}
