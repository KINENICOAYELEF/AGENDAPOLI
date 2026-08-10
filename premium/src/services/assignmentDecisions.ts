/**
 * DECISIÓN DE ASIGNACIÓN TRAS ATENDER A ALGUIEN QUE NO ES TUYO
 *
 * Las internas se cubren entre ellas y la asignación nunca se actualiza. El
 * resultado es que nadie sabe con certeza quién lleva a cada persona: los
 * avisos de continuidad van a quien ya no atiende, y el trabajo de la suplente
 * no se le cuenta.
 *
 * En vez de adivinarlo desde el servidor, se le pregunta a quien sabe: cuando
 * alguien registra dos sesiones con una persona que no tiene asignada, se le
 * exige declarar si la tomó a su cargo o está cubriendo a una compañera.
 *
 * La pregunta bloquea la plataforma a propósito: si se pudiera postergar, se
 * postergaría siempre y volveríamos al mismo problema.
 */

import { collection, doc, getDoc, getDocs, limit, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Desde cuántas sesiones propias se pregunta. */
export const SESSIONS_BEFORE_ASKING = 2;
/** Cada cuánto se vuelve a preguntar si sigue declarándose suplencia. */
const RE_ASK_AFTER_DAYS = 21;

export type AssignmentDecisionStatus = "PENDING" | "ASSIGNED" | "COVERING";

export type AssignmentDecision = {
  id: string;
  year: string;
  studentId: string;
  studentName?: string;
  patientId: string;
  patientName: string;
  processId?: string;
  /** Quién figura asignada en la ficha al momento de preguntar. */
  assignedInternId?: string;
  assignedInternName?: string;
  sessionsByStudent: number;
  status: AssignmentDecisionStatus;
  createdAt: string;
  resolvedAt?: string;
};

const COLLECTION = "pending_assignment_decisions";

/** Un documento por estudiante y persona: no se acumulan preguntas repetidas. */
function decisionId(studentId: string, patientId: string) {
  return `${studentId}_${patientId}`;
}

export const AssignmentDecisionsService = {
  /**
   * Registra que hay que preguntar, si corresponde.
   *
   * Se llama al cerrar una evolución, momento en que ya se conocen la persona,
   * el proceso y la autoría, así que no cuesta ninguna lectura adicional salvo
   * comprobar si la pregunta ya existe.
   */
  async requestIfNeeded(input: {
    year: string;
    studentId: string;
    studentName?: string;
    patientId: string;
    patientName: string;
    processId?: string;
    assignedInternId?: string;
    assignedInternName?: string;
    sessionsByStudent: number;
  }): Promise<void> {
    const { year, studentId, patientId, sessionsByStudent } = input;
    if (!year || !studentId || !patientId) return;
    if (sessionsByStudent < SESSIONS_BEFORE_ASKING) return;
    // Si ya está asignada a ella, no hay nada que preguntar.
    if (input.assignedInternId === studentId) return;

    const ref = doc(db, COLLECTION, decisionId(studentId, patientId));

    try {
      const existing = await getDoc(ref);
      if (existing.exists()) {
        const data = existing.data() as AssignmentDecision;
        if (data.status === "PENDING") return;
        if (data.status === "ASSIGNED") return;
        // Declaró suplencia hace tiempo y sigue atendiendo: vuelve a preguntar,
        // porque a esta altura probablemente ya no sea una suplencia.
        const resolvedAt = new Date(data.resolvedAt || data.createdAt).getTime();
        const daysSince = (Date.now() - resolvedAt) / 86400000;
        if (daysSince < RE_ASK_AFTER_DAYS) return;
      }

      await setDoc(ref, {
        ...input,
        id: decisionId(studentId, patientId),
        status: "PENDING" as const,
        createdAt: new Date().toISOString(),
      }, { merge: true });
    } catch (error) {
      // Nunca debe impedir que la evolución se firme.
      console.warn("No se pudo registrar la pregunta de asignación:", error);
    }
  },

  /** Preguntas sin responder de esta estudiante. */
  async listPending(studentId: string, year: string): Promise<AssignmentDecision[]> {
    if (!studentId) return [];
    const snapshot = await getDocs(query(
      collection(db, COLLECTION),
      where("studentId", "==", studentId),
      where("status", "==", "PENDING"),
      limit(10),
    ));
    return snapshot.docs
      .map(snap => snap.data() as AssignmentDecision)
      .filter(decision => !year || decision.year === year);
  },

  /** La toma a su cargo: la asignación pasa a ella. */
  async takeOver(decision: AssignmentDecision, studentName: string): Promise<void> {
    const assignedAt = new Date().toISOString();
    await updateDoc(doc(db, "programs", decision.year, "usuarias", decision.patientId), {
      "meta.assignedInternId": decision.studentId,
      "meta.assignedInternName": studentName,
      "meta.assignmentStartedAt": assignedAt,
      "meta.updatedAt": assignedAt,
    });
    await updateDoc(doc(db, COLLECTION, decision.id), {
      status: "ASSIGNED",
      resolvedAt: assignedAt,
    });
  },

  /** Está cubriendo a una compañera: la asignación no se toca. */
  async declareCover(decision: AssignmentDecision, note?: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, decision.id), {
      status: "COVERING",
      coveringNote: note || null,
      resolvedAt: new Date().toISOString(),
    });
  },
};
