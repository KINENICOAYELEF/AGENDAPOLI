/**
 * COMENTARIOS ANCLADOS A UNA SECCIÓN DE LA FICHA
 *
 * El feedback llegaba como un texto suelto y la estudiante no sabía a qué parte
 * de su registro se refería. Estos comentarios quedan pegados a la sección
 * exacta —"Examen físico", "Plan terapéutico"— igual que un comentario al
 * margen de un documento.
 *
 * El docente los escribe o los aprueba; la IA nunca publica sola.
 */

import {
  collection,
  doc,
  getDocs,
  limit,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

export type RecordCommentStatus = "OPEN" | "RESOLVED";

export type RecordComment = {
  id: string;
  year: string;
  recordId: string;
  recordKind: "EVALUACION" | "EVOLUCION";
  /** Título exacto de la sección comentada, tal como se muestra en el visor. */
  section: string;
  studentId: string;
  patientId: string;
  patientName?: string;
  comment: string;
  /** Si el borrador lo escribió la IA y el docente lo aprobó tal cual o ajustado. */
  aiAssisted: boolean;
  status: RecordCommentStatus;
  createdBy: string;
  createdByName?: string;
  createdAt: string;
  resolvedAt?: string;
};

const COLLECTION = "record_comments";

function newId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export const RecordCommentsService = {
  /** Publica un comentario. El docente ya revisó el texto en pantalla. */
  async create(input: Omit<RecordComment, "id" | "createdAt" | "status">): Promise<RecordComment> {
    const id = newId();
    const payload: RecordComment = {
      ...input,
      id,
      status: "OPEN",
      createdAt: new Date().toISOString(),
    };
    await setDoc(doc(db, COLLECTION, id), { ...payload, serverCreatedAt: serverTimestamp() });
    return payload;
  },

  /** Comentarios de un registro concreto, para pintarlos junto a sus secciones. */
  async listByRecord(recordId: string): Promise<RecordComment[]> {
    if (!recordId) return [];
    const snapshot = await getDocs(query(
      collection(db, COLLECTION),
      where("recordId", "==", recordId),
      limit(100),
    ));
    return snapshot.docs
      .map(snap => snap.data() as RecordComment)
      .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  },

  /**
   * Comentarios abiertos de una estudiante.
   *
   * Alimenta el aviso de su dashboard: el punto es que le lleguen a la pantalla,
   * no que los descubra por casualidad al abrir una ficha.
   */
  async listOpenForStudent(studentId: string, year: string): Promise<RecordComment[]> {
    if (!studentId) return [];
    const snapshot = await getDocs(query(
      collection(db, COLLECTION),
      where("studentId", "==", studentId),
      where("status", "==", "OPEN"),
      limit(50),
    ));
    return snapshot.docs
      .map(snap => snap.data() as RecordComment)
      .filter(comment => !year || comment.year === year)
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  /** La estudiante marca que ya lo corrigió; el docente lo ve resuelto. */
  async resolve(commentId: string): Promise<void> {
    await updateDoc(doc(db, COLLECTION, commentId), {
      status: "RESOLVED",
      resolvedAt: new Date().toISOString(),
    });
  },
};
