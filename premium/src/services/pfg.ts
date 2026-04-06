// ============================================================
// PFG — SERVICIO CRUD FIRESTORE
// Completamente aislado del sistema clínico principal
// ============================================================

import { collection, doc, query, getDocs, deleteDoc, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { setDocCounted, getDocCounted } from '@/services/firestore';
import type { PfgDeportista, PfgEvaluacion } from '@/types/pfg';

export const PfgService = {
  // ── Deportistas ──────────────────────────────────────────
  async getAll(year: string): Promise<PfgDeportista[]> {
    if (!year) throw new Error('Año requerido');
    const ref = collection(db, 'programs', year, 'pfg_deportistas');
    const snap = await getDocs(ref);
    const data = snap.docs.map((d) => ({ ...d.data(), id: d.id } as PfgDeportista));
    data.sort((a, b) => a.alias.localeCompare(b.alias));
    return data;
  },

  async getById(year: string, id: string): Promise<PfgDeportista | null> {
    if (!year || !id) return null;
    const ref = doc(db, 'programs', year, 'pfg_deportistas', id);
    const snap = await getDocCounted(ref);
    return snap.exists() ? ({ ...snap.data(), id: snap.id } as PfgDeportista) : null;
  },

  async saveDeportista(year: string, data: PfgDeportista): Promise<void> {
    if (!year || !data.id) throw new Error('Año e ID requeridos');
    const ref = doc(db, 'programs', year, 'pfg_deportistas', data.id);
    await setDocCounted(ref, data, { merge: true });
  },

  async deleteDeportista(year: string, id: string): Promise<void> {
    if (!year || !id) throw new Error('Año e ID requeridos');
    // Cascade: borrar evaluaciones primero
    const evalsRef = collection(db, 'programs', year, 'pfg_deportistas', id, 'evaluaciones');
    const evalsSnap = await getDocs(evalsRef);
    for (const d of evalsSnap.docs) {
      await deleteDoc(d.ref);
    }
    await deleteDoc(doc(db, 'programs', year, 'pfg_deportistas', id));
  },

  // ── Evaluaciones ────────────────────────────────────────
  async getEvaluaciones(year: string, deportistaId: string): Promise<PfgEvaluacion[]> {
    if (!year || !deportistaId) throw new Error('Año e ID deportista requeridos');
    const ref = collection(db, 'programs', year, 'pfg_deportistas', deportistaId, 'evaluaciones');
    const q = query(ref, orderBy('semana', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ ...d.data(), id: d.id } as PfgEvaluacion));
  },

  async saveEvaluacion(year: string, deportistaId: string, data: PfgEvaluacion): Promise<void> {
    if (!year || !deportistaId || !data.id) throw new Error('Año, ID deportista e ID evaluación requeridos');
    const ref = doc(db, 'programs', year, 'pfg_deportistas', deportistaId, 'evaluaciones', data.id);
    await setDocCounted(ref, data, { merge: true });
  },

  async deleteEvaluacion(year: string, deportistaId: string, evalId: string): Promise<void> {
    if (!year || !deportistaId || !evalId) throw new Error('Parámetros incompletos');
    await deleteDoc(doc(db, 'programs', year, 'pfg_deportistas', deportistaId, 'evaluaciones', evalId));
  },
};
