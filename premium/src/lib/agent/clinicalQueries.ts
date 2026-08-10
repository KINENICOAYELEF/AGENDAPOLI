/**
 * CONSULTAS CLÍNICAS PARA EL ASISTENTE DOCENTE
 *
 * Son las "manos" del agente: hasta ahora, cuando el docente le preguntaba algo
 * por Telegram, el modelo recibía únicamente la transcripción y ningún acceso a
 * la base de datos. Por eso respondía en generalidades — literalmente no tenía
 * los datos. Cada función de aquí es una consulta acotada que el agente puede
 * pedir para responder con hechos.
 *
 * Todas son de solo lectura. Ninguna escribe en fichas ni notifica a nadie.
 */

import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { detectCoverage } from './coverage';

function iso(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value?.toDate === 'function') return value.toDate().toISOString();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000).toISOString();
  return '';
}

function recordAt(data: any): string {
  return iso(data.sessionAt) || iso(data.fechaHoraAtencion) || iso(data.audit?.createdAt) || iso(data.createdAt);
}

function daysSince(value?: string): number | null {
  if (!value) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : Math.floor((Date.now() - time) / 86400000);
}

/** Coincidencia tolerante: el docente dice "la Javiera", no el UID. */
function matches(haystack: string, needle: string): boolean {
  const clean = (value: string) => value.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').trim();
  const target = clean(haystack);
  const terms = clean(needle).split(/\s+/).filter(term => term.length >= 3);
  return terms.length > 0 && terms.every(term => target.includes(term));
}

async function findStudent(db: any, nameOrId: string) {
  const snapshot = await db.collection('users').where('role', '==', 'INTERNO').get();
  const students = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  return students.find((student: any) => student.id === nameOrId)
    || students.find((student: any) => matches(`${student.displayName || ''} ${student.email || ''}`, nameOrId))
    || null;
}

/**
 * El mapa que el docente pidió: qué persona tiene cada interna, qué hace con
 * ella, qué evaluó y qué tan coherente es lo que registra.
 *
 * Es la vista que permite decidir "con esta tengo que hablar de tal cosa".
 */
export async function censoAsignaciones(year: string, studentQuery?: string) {
  const db = getAdminDb();

  const recentCutoff = new Date(Date.now() - 60 * 86400000).toISOString();
  const [studentsSnap, patientsSnap, processesSnap, findingsSnap, evolsSnap] = await Promise.all([
    db.collection('users').where('role', '==', 'INTERNO').get(),
    db.collection(`programs/${year}/usuarias`).get(),
    db.collection(`programs/${year}/procesos`).get(),
    db.collection('teacher_agent_reviews').get(),
    db.collection(`programs/${year}/evoluciones`).where('sessionAt', '>=', recentCutoff).get(),
  ]);

  const students = studentsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const target = studentQuery
    ? students.filter((student: any) => matches(`${student.displayName || ''} ${student.email || ''}`, studentQuery) || student.id === studentQuery)
    : students;
  if (target.length === 0) {
    return { error: `No encontré ninguna estudiante que coincida con "${studentQuery}".` };
  }

  const processByPatient = new Map<string, any>();
  processesSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (!data.personaUsuariaId) return;
    const current = processByPatient.get(data.personaUsuariaId);
    // El proceso activo manda; si no hay, el más reciente.
    if (!current || (data.estado === 'ACTIVO' && current.estado !== 'ACTIVO')) {
      processByPatient.set(data.personaUsuariaId, { id: doc.id, ...data });
    }
  });

  // Incoherencias detectadas por el agente, agrupadas por estudiante.
  const coherenceByStudent = new Map<string, string[]>();
  findingsSnap.docs.forEach((doc: any) => {
    const data = doc.data();
    if (!Array.isArray(data.coherenceFindings) || data.coherenceFindings.length === 0) return;
    const current = coherenceByStudent.get(data.studentId) || [];
    data.coherenceFindings.forEach((finding: any) => current.push(`${finding.type}: ${finding.explanation}`));
    coherenceByStudent.set(data.studentId, current);
  });

  const patients = patientsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  // Quién atiende de verdad. Las internas se cubren entre ellas y la asignación
  // no se mueve, así que preguntar "qué pacientes tiene X" por asignación
  // devolvía a gente que X no está viendo, y omitía a la que sí atiende.
  const processes = processesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const coverage = detectCoverage({
    processes,
    patients,
    evolutions: evolsSnap.docs.map((doc: any) => doc.data()),
  });
  const coverageByProcess = new Map(coverage.map(item => [item.processId, item]));
  const studentNames = new Map(students.map((student: any) => [student.id, student.displayName || student.email || student.id]));

  return {
    year,
    students: target.map((student: any) => {
      // Además de las asignadas, las personas que está atendiendo de hecho
      // aunque figuren a nombre de otra: es trabajo suyo y hay que contarlo.
      const coveredPatientIds = new Set(
        coverage
          .filter(item => item.actualCarerId === student.id)
          .map(item => item.patientId),
      );
      const assigned = patients.filter((patient: any) =>
        patient.meta?.assignedInternId === student.id || coveredPatientIds.has(patient.id));
      return {
        studentId: student.id,
        name: student.displayName || student.email || student.id,
        patientCount: assigned.length,
        coherenceIssues: (coherenceByStudent.get(student.id) || []).slice(0, 6),
        patients: assigned.map((patient: any) => {
          const process = processByPatient.get(patient.id);
          const lastSession = process?.lastClosedEvolution;
          const cover = process?.id ? coverageByProcess.get(process.id) : undefined;
          return {
            name: patient.identity?.fullName || 'Sin nombre',
            // Estas dos claves son distintas a propósito: la asignación puede
            // haber quedado obsoleta tras una suplencia sostenida.
            actuallyTreatedBy: cover && cover.actualCarerId !== student.id
              ? (studentNames.get(cover.actualCarerId) || cover.actualCarerId)
              : 'esta misma estudiante',
            assignmentLooksOutdated: Boolean(cover?.assignmentIsStale),
            hasOccasionalCover: Boolean(cover?.hasOccasionalCover),
            processState: process?.estado || 'sin proceso registrado',
            reasonForAdmission: String(process?.motivoIngresoLibre || '').slice(0, 200),
            currentDiagnosis: String(process?.diagnosisVigente || 'sin diagnóstico vigente registrado').slice(0, 300),
            activeObjectives: (process?.activeObjectiveSet?.objectives || [])
              .map((objective: any) => objective.texto || objective.text || objective.description)
              .filter(Boolean)
              .slice(0, 5),
            lastSessionAt: lastSession?.sessionAt || 'sin sesión firmada registrada',
            daysSinceLastSession: daysSince(lastSession?.sessionAt),
            lastSessionByAnotherStudent: Boolean(lastSession?.authorUid && lastSession.authorUid !== student.id),
          };
        }),
      };
    }),
  };
}

/** Todo lo relevante de una estudiante: actividad, hallazgos y coherencia. */
export async function fichaEstudiante(year: string, studentQuery: string) {
  const db = getAdminDb();
  const student = await findStudent(db, studentQuery);
  if (!student) return { error: `No encontré ninguna estudiante que coincida con "${studentQuery}".` };

  const [evolsSnap, evalsSnap, findingsSnap, osceSnap, defenseSnap] = await Promise.all([
    db.collection(`programs/${year}/evoluciones`).where('audit.createdBy', '==', student.id).get(),
    db.collection(`programs/${year}/evaluaciones`).where('audit.createdBy', '==', student.id).get(),
    db.collection('teacher_agent_reviews').where('studentId', '==', student.id).get(),
    db.collection('simulador_intentos').where('userId', '==', student.id).get(),
    db.collection('defensas_voz_intentos').where('userId', '==', student.id).get(),
  ]);

  const evolutions = evolsSnap.docs.map((doc: any) => doc.data());
  const evaluations = evalsSnap.docs.map((doc: any) => doc.data());
  const lastActivity = [...evolutions, ...evaluations]
    .map(recordAt).filter(Boolean).sort().reverse()[0];

  const findings = findingsSnap.docs.map((doc: any) => doc.data());

  return {
    name: student.displayName || student.email,
    evolutions: evolutions.length,
    draftEvolutions: evolutions.filter((item: any) => item.status === 'DRAFT' || item.estado === 'BORRADOR').length,
    initialEvaluations: evaluations.filter((item: any) => item.type !== 'REEVALUATION').length,
    reassessments: evaluations.filter((item: any) => item.type === 'REEVALUATION').length,
    lastActivityAt: lastActivity || 'sin actividad registrada',
    daysSinceActivity: daysSince(lastActivity),
    simulations: { osce: osceSnap.size, defenses: defenseSnap.size, total: osceSnap.size + defenseSnap.size, requiredMinimum: 15 },
    pendingFindings: findings.filter((item: any) => item.status === 'PENDING_TEACHER').length,
    findings: findings.slice(0, 8).map((item: any) => ({
      priority: item.priority,
      status: item.status,
      observation: String(item.observation || '').slice(0, 300),
      coherence: (item.coherenceFindings || []).map((finding: any) => `${finding.type}: ${finding.explanation}`),
    })),
  };
}

/** Una persona atendida: quién la ve, en qué está y cuándo fue su última sesión. */
export async function fichaPersona(year: string, patientQuery: string) {
  const db = getAdminDb();
  const patientsSnap = await db.collection(`programs/${year}/usuarias`).get();
  const patients = patientsSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const patient = patients.find((item: any) =>
    matches(`${item.identity?.fullName || ''} ${item.identity?.rut || ''}`, patientQuery));
  if (!patient) return { error: `No encontré ninguna persona que coincida con "${patientQuery}".` };

  const [processesSnap, evolsSnap] = await Promise.all([
    db.collection(`programs/${year}/procesos`).where('personaUsuariaId', '==', patient.id).get(),
    db.collection(`programs/${year}/evoluciones`).where('usuariaId', '==', patient.id).get(),
  ]);

  const processes = processesSnap.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));
  const active = processes.find((item: any) => item.estado === 'ACTIVO') || processes[0];
  const evolutions = evolsSnap.docs
    .map((doc: any) => doc.data())
    .sort((a: any, b: any) => recordAt(b).localeCompare(recordAt(a)));

  return {
    name: patient.identity?.fullName || 'Sin nombre',
    assignedTo: patient.meta?.assignedInternName || 'sin interna asignada',
    processState: active?.estado || 'sin proceso',
    reasonForAdmission: String(active?.motivoIngresoLibre || '').slice(0, 300),
    currentDiagnosis: String(active?.diagnosisVigente || 'sin diagnóstico vigente registrado').slice(0, 400),
    totalSessions: evolutions.length,
    draftSessions: evolutions.filter((item: any) => item.status === 'DRAFT').length,
    lastSessionAt: recordAt(evolutions[0] || {}) || 'sin sesiones',
    daysSinceLastSession: daysSince(recordAt(evolutions[0] || {})),
    recentSessions: evolutions.slice(0, 5).map((item: any) => ({
      date: recordAt(item),
      goal: String(item.sessionGoal || '').slice(0, 160),
      status: item.status || item.estado,
    })),
  };
}

/** Estado de la agenda: lo que el agente nunca había mirado. */
export async function estadoAgenda(year: string, dateStr?: string) {
  const db = getAdminDb();
  const date = dateStr || new Date().toLocaleDateString('en-CA', { timeZone: 'America/Santiago' });
  const snapshot = await db.collection(`programs/${year}/citas`).where('date', '==', date).get();
  const appointments = snapshot.docs.map((doc: any) => ({ id: doc.id, ...doc.data() }));

  return {
    date,
    total: appointments.length,
    completed: appointments.filter((item: any) => item.status === 'COMPLETED').length,
    scheduled: appointments.filter((item: any) => item.status === 'SCHEDULED').length,
    noShow: appointments.filter((item: any) => item.status === 'NO_SHOW').length,
    // Citas ya pasadas que siguen sin evolucionar: el hueco más común.
    pendingToEvolve: appointments
      .filter((item: any) => item.status === 'SCHEDULED')
      .slice(0, 15)
      .map((item: any) => ({
        time: item.time || 'sin hora',
        patientName: item.usuariaName || item.usuariaId,
        internName: item.internoPlanificadoName || item.internoPlanificadoId || 'sin asignar',
      })),
  };
}

/** Personas que dejaron de recibir sesiones. */
export async function personasAbandonadas(year: string, minDays = 14) {
  const db = getAdminDb();
  const snapshot = await db.collection(`programs/${year}/procesos`).where('estado', '==', 'ACTIVO').get();

  const abandoned = snapshot.docs
    .map((doc: any) => ({ id: doc.id, ...doc.data() }))
    .map((process: any) => ({
      processId: process.id,
      patientId: process.personaUsuariaId,
      lastSessionAt: process.lastClosedEvolution?.sessionAt || process.fechaInicio,
      internName: process.lastClosedEvolution?.authorName || 'sin registro',
      days: daysSince(process.lastClosedEvolution?.sessionAt || process.fechaInicio),
    }))
    .filter((item: any) => item.days !== null && item.days >= minDays)
    .sort((a: any, b: any) => (b.days || 0) - (a.days || 0));

  // Los nombres solo de lo que se va a mostrar.
  const top = abandoned.slice(0, 12);
  await Promise.all(top.map(async (item: any) => {
    try {
      const snap = await db.doc(`programs/${year}/usuarias/${item.patientId}`).get();
      item.patientName = snap.data()?.identity?.fullName || item.patientId;
    } catch { item.patientName = item.patientId; }
  }));

  return { minDays, total: abandoned.length, cases: top };
}

/** Rotaciones y qué tan cerca están sus exámenes. */
export async function estadoRotaciones(year: string) {
  const db = getAdminDb();
  const snapshot = await db.collection(`programs/${year}/rotations`).get();
  return {
    total: snapshot.size,
    rotations: snapshot.docs.map((doc: any) => {
      const data = doc.data();
      const end = iso(data.endDate || data.fechaTermino);
      const remaining = end ? -(daysSince(end) ?? 0) : null;
      return {
        name: data.name || data.nombre || 'Sin nombre',
        university: data.university || data.universidad || '',
        startDate: iso(data.startDate || data.fechaInicio),
        endDate: end,
        daysRemaining: remaining,
        examWindow: data.examWindow || data.rangoExamen || null,
      };
    }),
  };
}
