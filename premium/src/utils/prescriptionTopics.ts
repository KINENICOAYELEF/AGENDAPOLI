import type { HipTopic } from './hipTopics';
import type { KneeTopic } from './kneeTopics';

type PrescriptionDescriptor = {
    id: string;
    categoria: string;
    cuadro: string;
    objetivos: string;
    intervenciones: string;
    vigilancia: string;
    fuente: string;
};

const buildPrescriptionTopic = (d: PrescriptionDescriptor) => ({
    id: d.id,
    nombre: `Prescripción clínica EBM — ${d.cuadro}`,
    categoria: d.categoria,
    contenidoBase: `
- PROPÓSITO: integrar objetivos, intervención y seguimiento de ${d.cuadro}; no memorizar una receta.
- OBJETIVOS QUE PRIORIZAR: ${d.objetivos}
- INTERVENCIONES CON SENTIDO CLÍNICO: ${d.intervenciones}
- VARIABLES QUE DEBES JUSTIFICAR: selección de tarea/ejercicio, frecuencia, intensidad (esfuerzo, carga o tolerancia), volumen, rango, velocidad, pausas, contexto domiciliario y supervisión.
- VIGILANCIA Y AJUSTE: ${d.vigilancia}
- REGLA DE RAZONAMIENTO: una intervención se indica porque responde a un objetivo y a un hallazgo modificable. Educación, ejercicio, terapia manual o una ayuda técnica no se prescriben por rutina ni se prometen como corrección estructural.
- FUENTE ORIENTADORA PARA EL TUTOR: ${d.fuente}
`,
    preguntasEtapa2: [
        `Formula un objetivo funcional y uno clínico para ${d.cuadro}; explica por qué no son lo mismo.`,
        'Elige las intervenciones prioritarias y justifica qué hallazgo, fase o preferencia las sostiene.',
        'Defiende frecuencia, intensidad, volumen, rango y progresión. Si no tienes un número exacto, explica qué medirías para individualizarlo.',
        '¿Qué respuesta te haría mantener, progresar, reducir o derivar en vez de repetir la pauta?',
        '¿Qué intervención evitarías presentar como indispensable o curativa y cómo se lo explicarías a la persona?'
    ],
    casoEtapa3: `"Persona con ${d.cuadro}. Tiene un objetivo funcional relevante, tolerancia variable a la carga y preocupación por empeorar." Diseña y defiende una primera pauta: objetivo, intervención, variables, educación, medida de seguimiento y condición para modificarla.`,
    preguntasEtapa4: [
        'Distingue una intervención con respaldo, una intervención complementaria posible y una intervención sin justificación suficiente para este caso.',
        'Explica por qué un protocolo temporal o una cifra aislada no reemplazan la respuesta clínica y el objetivo funcional.',
        'Resume: hallazgo → objetivo → intervención → variables → vigilancia → siguiente decisión.'
    ]
});

const HIP_DESCRIPTORS: PrescriptionDescriptor[] = [
    { id: 'cp-hip-oa', categoria: 'Coxartrosis', cuadro: 'Coxartrosis', objetivos: 'dolor y función percibida, marcha, escaleras, transferencias, capacidad de fuerza y actividad física elegida por la persona.', intervenciones: 'educación que reduzca nocebo, fortalecimiento y ejercicio aeróbico adaptados; terapia manual solo como complemento de ejercicio si aporta una ganancia funcional comprobable; apoyo para actividad física y manejo de peso cuando sea pertinente.', vigilancia: 'síntomas, función priorizada, recuperación posterior, adherencia y medidas basales/follow-up. No prometas “reparar” cartílago ni uses imagen como dosificador.', fuente: 'APTA Hip OA 2025 y NICE NG226 2022.' },
    { id: 'cp-hip-ptc', categoria: 'Artroplastia (PTC)', cuadro: 'artroplastia total de cadera', objetivos: 'seguridad, autonomía, marcha, transferencias, fuerza y retorno a actividades significativas según la evolución y restricciones del equipo quirúrgico.', intervenciones: 'educación de precauciones individualizadas, exposición progresiva a movilidad, marcha, fuerza y tarea funcional; ayudas técnicas mientras mejoren seguridad y función.', vigilancia: 'dolor desproporcionado, herida, signos sistémicos, síntomas vasculares, respuesta a carga, desempeño y restricciones quirúrgicas explícitas. No indiques por semana calendario solamente.', fuente: 'guías de rehabilitación postoperatoria y decisiones del equipo quirúrgico.' },
    { id: 'cp-hip-fai', categoria: 'FAI y Labrum', cuadro: 'dolor articular no artrítico, FAI y labrum', objetivos: 'tolerancia a tareas provocadoras, fuerza/capacidad, función deportiva u ocupacional y comprensión de síntomas sin reducir el cuadro a una forma ósea.', intervenciones: 'educación, modificación temporal de tarea, fortalecimiento y exposición progresiva; terapia manual solo como complemento cuando responda a un objetivo medible.', vigilancia: 'irritabilidad, respuesta a rangos y tareas, función y signos que cambien el diagnóstico o justifiquen evaluación médica.', fuente: 'APTA Nonarthritic Hip Joint Pain 2023.' },
    { id: 'cp-hip-instability', categoria: 'Displasia e Inestabilidad', cuadro: 'displasia y microinestabilidad de cadera', objetivos: 'función, tolerancia a carga, fuerza y confianza sin perseguir rangos extremos ni atribuir toda la clínica a “inestabilidad”.', intervenciones: 'educación, selección de tareas tolerables, fuerza y progresión coordinada con el equipo tratante; evitar provocaciones repetidas no justificadas.', vigilancia: 'síntomas de inestabilidad, irritabilidad, respuesta funcional y necesidad de reevaluación médica.', fuente: 'APTA Nonarthritic Hip Joint Pain 2023 y evaluación interdisciplinaria.' },
    { id: 'cp-hip-lateral', categoria: 'Dolor Lateral de Cadera', cuadro: 'dolor lateral de cadera', objetivos: 'tolerar decúbito, marcha, escaleras y carga unipodal, reduciendo sensibilidad y recuperando capacidad sin culpar una postura aislada.', intervenciones: 'educación, modificación de carga irritante, fortalecimiento progresivo y exposición funcional; las terapias pasivas solo son complementarias y deben reevaluarse.', vigilancia: 'respuesta a carga, sueño, función y diferenciales lumbares/intraarticulares u otros si el patrón no encaja.', fuente: 'principios de manejo de tendinopatía y guías de dolor de cadera.' },
    { id: 'cp-hip-ing', categoria: 'Dolor Inguinal y Extraarticular', cuadro: 'dolor inguinal y extraarticular de cadera', objetivos: 'identificar el generador clínico probable, recuperar función relevante y no prescribir ejercicio sobre una hipótesis insegura.', intervenciones: 'educación y ejercicio dirigidos al hallazgo modificable solo después de descartar banderas, dolor referido o condición médica relevante.', vigilancia: 'evolución, síntomas neurológicos/sistémicos, dolor no mecánico y respuesta a la intervención; deriva cuando la presentación no sea compatible con manejo kinésico.', fuente: 'APTA Nonarthritic Hip Joint Pain 2023.' },
    { id: 'cp-hip-fracture', categoria: 'Geriatría y Fractura de Cadera', cuadro: 'geriatría y fractura de cadera', objetivos: 'seguridad, movilidad, transferencias, fuerza, balance, participación y prevención de caídas según tolerancia y orden médica.', intervenciones: 'movilización y entrenamiento funcional progresivos, fuerza, balance y educación a persona/cuidador; coordinación interprofesional.', vigilancia: 'restricciones de carga, delirium, dolor, signos médicos, fatiga, riesgo de caída y apoyo social. No apliques una dosis deportiva.', fuente: 'guías de rehabilitación de fractura de cadera y recomendaciones OMS para personas mayores.' },
    { id: 'cp-hip-pediatric', categoria: 'Cadera Pediátrica y Deportiva', cuadro: 'cadera pediátrica y deportiva', objetivos: 'seguridad diagnóstica, retorno gradual a escuela/deporte y capacidad acorde a etapa de desarrollo.', intervenciones: 'educación a familia/deportista, adaptación de actividad, fuerza y tareas progresivas cuando el diagnóstico y equipo tratante lo permitan.', vigilancia: 'dolor nocturno, incapacidad de carga, cojera progresiva, síntomas sistémicos y restricciones de crecimiento o cirugía.', fuente: 'evaluación pediátrica y deportiva interdisciplinaria.' },
    { id: 'cp-hip-neuro', categoria: 'Neuropatías Periféricas', cuadro: 'neuropatías periféricas relacionadas a cadera', objetivos: 'diferenciar dolor neuropático/referido, conservar función y evitar atribuirlo automáticamente a debilidad o acortamiento.', intervenciones: 'educación, manejo de carga y ejercicio funcional solo si es seguro; coordinación médica cuando existan déficits progresivos o etiología no clara.', vigilancia: 'distribución sensitiva, déficit motor, progresión, banderas sistémicas y tolerancia neural.', fuente: 'razonamiento neurológico periférico y derivación clínica.' },
    { id: 'cp-hip-rtp', categoria: 'Criterios Avanzados de RTP', cuadro: 'retorno a actividad y deporte de cadera', objetivos: 'recuperar capacidad específica de tarea, exposición, confianza y desempeño relevante, no cumplir una fecha ni una cifra aislada.', intervenciones: 'fuerza, acondicionamiento, tareas específicas y exposición progresiva al deporte/ocupación; educación de autorregulación.', vigilancia: 'síntomas, desempeño, fatiga, calidad de tarea, confianza y contexto deportivo. Los test apoyan la decisión, no la garantizan.', fuente: 'principios de retorno a deporte y decisión compartida.' }
];

const KNEE_DESCRIPTORS: PrescriptionDescriptor[] = [
    { id: 'cp-knee-oa', categoria: 'Gonartrosis', cuadro: 'gonartrosis', objetivos: 'dolor, caminata, escaleras, transferencias, fuerza y actividad física significativa.', intervenciones: 'educación y ejercicio terapéutico individualizado: fortalecimiento local y capacidad aeróbica; terapia manual solo junto a ejercicio y si aporta valor funcional; ayudas si mejoran función en el caso concreto.', vigilancia: 'función, síntomas, adherencia, respuesta posterior y preferencias. No prometer “nutrir” o regenerar cartílago.', fuente: 'NICE NG226 2022 y guías de OA.' },
    { id: 'cp-knee-ptr', categoria: 'Artroplastia (PTR)', cuadro: 'artroplastia total de rodilla', objetivos: 'seguridad, extensión/rango funcional, marcha, transferencias, escaleras, fuerza, autonomía y metas personales.', intervenciones: 'educación, movilidad y fuerza progresivas, marcha y tareas funcionales según evolución y equipo quirúrgico; no depender de una intervención pasiva aislada.', vigilancia: 'herida, infección/TVP, derrame, dolor, respuesta a carga y desempeño. Evita altas por una semana o LSI aislado.', fuente: 'rehabilitación postoperatoria individualizada y medidas funcionales.' },
    { id: 'cp-knee-pfp', categoria: 'Dolor Patelofemoral', cuadro: 'dolor patelofemoral', objetivos: 'tolerar sentarse, escaleras, carrera o salto según la meta de la persona.', intervenciones: 'educación, modificación temporal de actividad y ejercicio de rodilla y/o cadera según capacidad y tarea; taping u ortesis solo como complemento si facilitan actividad.', vigilancia: 'síntomas, derrame, desempeño y confianza; no explicar el cuadro por “mal tracking” ni buscar recolocar una patela.', fuente: 'APTA Patellofemoral Pain 2019.' },
    { id: 'cp-knee-acl', categoria: 'LCA y retorno al deporte', cuadro: 'LCA y retorno al deporte', objetivos: 'resolver déficits clínicos, recuperar fuerza, capacidad de desacelerar/cambiar dirección, exposición específica y confianza.', intervenciones: 'fuerza, tareas neuromusculares, salto/aterrizaje y progresión específica a deporte según fase y respuesta; coordinación con cirugía/equipo deportivo.', vigilancia: 'derrame, síntomas, rendimiento, fatiga, adherencia, preparación psicológica y exposición. No retornar por tiempo, LSI o un test único.', fuente: 'APTA Knee Ligament Sprain 2017 y prevención de lesión de rodilla/LCA 2023.' },
    { id: 'cp-knee-meniscus', categoria: 'Menisco y Cartílago', cuadro: 'menisco y cartílago', objetivos: 'seguridad, rango, fuerza, función y retorno gradual, diferenciando manejo conservador, lesión aguda y restricciones postquirúrgicas.', intervenciones: 'educación, movimiento/carga progresivos y fuerza según diagnóstico, cirugía y evolución; coordinación con equipo tratante.', vigilancia: 'bloqueo verdadero, derrame, pérdida de extensión, dolor desproporcionado y restricciones quirúrgicas.', fuente: 'APTA Knee Pain and Mobility Impairments: Meniscal and Articular Cartilage Lesions 2018.' },
    { id: 'cp-knee-tendon', categoria: 'Tendón Patelar', cuadro: 'tendón patelar', objetivos: 'tolerancia a carga del tendón, fuerza, salto/carrera y retorno a la demanda relevante.', intervenciones: 'educación, ajuste de carga y fortalecimiento progresivo elegido por tolerancia y objetivo; no presentar una modalidad única como curativa.', vigilancia: 'respuesta de síntomas, desempeño, carga deportiva y diferenciales si el patrón no corresponde.', fuente: 'principios contemporáneos de manejo de tendinopatía y revisión clínica.' }
];

export const HIP_PRESCRIPTION_TOPICS: HipTopic[] = HIP_DESCRIPTORS.map(buildPrescriptionTopic) as HipTopic[];
export const KNEE_PRESCRIPTION_TOPICS: KneeTopic[] = KNEE_DESCRIPTORS.map(buildPrescriptionTopic) as KneeTopic[];
