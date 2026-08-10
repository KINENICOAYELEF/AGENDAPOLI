/**
 * QUIÉN ATIENDE DE VERDAD, MÁS ALLÁ DE LA ASIGNACIÓN
 *
 * En la práctica las internas se cubren entre ellas: una no vino, otra está
 * ocupada, y alguien más toma la sesión. Esa suplencia queda registrada en la
 * autoría de la evolución, pero la asignación de la persona no se mueve.
 *
 * Toda la plataforma usaba la asignación como si fuera la realidad, y por eso:
 *   - el mapa "quién atiende a quién" mostraba a alguien que no la está viendo;
 *   - los avisos de continuidad le llegaban a quien ya no la atiende;
 *   - el trabajo de quien sí la atendió no se le contaba a ella.
 *
 * Distinguir ambas cosas permite además detectar el caso importante: cuando la
 * suplencia dejó de ser puntual y la asignación simplemente quedó obsoleta.
 */

/** Cuántas sesiones recientes se miran para decidir quién atiende de verdad. */
const RECENT_SESSIONS_WINDOW = 4;
/** Desde cuántas sesiones seguidas de otra persona se considera obsoleta la asignación. */
const STALE_ASSIGNMENT_SESSIONS = 3;

export type ProcessCoverage = {
  processId: string;
  patientId: string;
  assignedInternId: string;
  /** Quién escribió las sesiones recientes, de la más nueva a la más antigua. */
  recentCarers: string[];
  /** Quien más atendió últimamente, sea o no la asignada. */
  actualCarerId: string;
  /** La asignada no aparece en las últimas sesiones: probablemente quedó obsoleta. */
  assignmentIsStale: boolean;
  /** Hubo suplencias, pero la asignada sigue atendiendo. Es lo normal. */
  hasOccasionalCover: boolean;
  sessionsConsidered: number;
};

type EvolutionLike = {
  procesoId?: string | null;
  usuariaId?: string;
  status?: string;
  estado?: string;
  sessionAt?: string;
  fechaHoraAtencion?: string;
  audit?: { createdBy?: string };
  autorUid?: string;
  clinicianResponsible?: string;
};

function authorOf(evolution: EvolutionLike): string {
  return evolution.audit?.createdBy || evolution.autorUid || evolution.clinicianResponsible || '';
}

function dateOf(evolution: EvolutionLike): string {
  return String(evolution.sessionAt || evolution.fechaHoraAtencion || '');
}

/**
 * Calcula la cobertura real de cada proceso.
 *
 * Es una función pura para que el censo la use con los datos que ya cargó, sin
 * pagar lecturas adicionales.
 */
export function detectCoverage(input: {
  processes: Array<{ id?: string; personaUsuariaId?: string; estado?: string }>;
  patients: Array<{ id?: string; meta?: { assignedInternId?: string } }>;
  evolutions: EvolutionLike[];
}): ProcessCoverage[] {
  const assignedByPatient = new Map<string, string>();
  input.patients.forEach(patient => {
    if (patient.id) assignedByPatient.set(patient.id, patient.meta?.assignedInternId || '');
  });

  const closedByProcess = new Map<string, EvolutionLike[]>();
  input.evolutions.forEach(evolution => {
    const isClosed = evolution.status === 'CLOSED' || evolution.estado === 'CERRADA';
    if (!isClosed || !evolution.procesoId) return;
    const current = closedByProcess.get(evolution.procesoId) || [];
    current.push(evolution);
    closedByProcess.set(evolution.procesoId, current);
  });

  const result: ProcessCoverage[] = [];

  input.processes.forEach(process => {
    if (!process.id || process.estado !== 'ACTIVO') return;

    const sessions = (closedByProcess.get(process.id) || [])
      .sort((a, b) => dateOf(b).localeCompare(dateOf(a)))
      .slice(0, RECENT_SESSIONS_WINDOW);
    if (sessions.length === 0) return;

    const recentCarers = sessions.map(authorOf).filter(Boolean);
    if (recentCarers.length === 0) return;

    const assignedInternId = assignedByPatient.get(process.personaUsuariaId || '') || '';

    // Quien más atendió recientemente.
    const tally = new Map<string, number>();
    recentCarers.forEach(carer => tally.set(carer, (tally.get(carer) || 0) + 1));
    const actualCarerId = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];

    // La asignación se considera obsoleta cuando la asignada no aparece en
    // ninguna de las últimas sesiones y otra persona las tomó de forma
    // sostenida. Una o dos suplencias sueltas no bastan: eso es lo normal.
    const assignedRecentCount = assignedInternId ? (tally.get(assignedInternId) || 0) : 0;
    const assignmentIsStale = Boolean(assignedInternId)
      && assignedRecentCount === 0
      && recentCarers.length >= STALE_ASSIGNMENT_SESSIONS
      && actualCarerId !== assignedInternId;

    result.push({
      processId: process.id,
      patientId: process.personaUsuariaId || '',
      assignedInternId,
      recentCarers,
      actualCarerId,
      assignmentIsStale,
      hasOccasionalCover: !assignmentIsStale
        && assignedRecentCount > 0
        && recentCarers.some(carer => carer !== assignedInternId),
      sessionsConsidered: recentCarers.length,
    });
  });

  return result;
}

/**
 * Personas cuya asignación quedó obsoleta.
 *
 * Es lo accionable: el docente decide si reasigna o si era una suplencia larga
 * que ya terminó. La plataforma nunca reasigna sola.
 */
export function staleAssignments(coverage: ProcessCoverage[]): ProcessCoverage[] {
  return coverage.filter(item => item.assignmentIsStale);
}
