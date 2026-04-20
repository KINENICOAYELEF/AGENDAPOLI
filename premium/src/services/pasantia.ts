import {
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  getDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import type { EntregaPasantia, EntregaConRevision, RevisionDocente, EstadoEntrega } from '@/types/pasantia';

const COL = 'pasantia_entregas';

// ── Guardar entrega (submit final) ──────────────────────────
export async function enviarEntrega(data: Omit<EntregaPasantia, 'estado' | 'creadoEn' | 'enviadoEn'>): Promise<string> {
  const docRef = await addDoc(collection(db, COL), {
    ...data,
    estado: 'entregado' as EstadoEntrega,
    creadoEn: serverTimestamp(),
    enviadoEn: serverTimestamp(),
  });
  return docRef.id;
}

// ── Leer todas las entregas (docente) ───────────────────────
export async function getTodasLasEntregas(): Promise<EntregaConRevision[]> {
  const q = query(collection(db, COL), orderBy('enviadoEn', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      ...raw,
      id: d.id,
      creadoEn: raw.creadoEn instanceof Timestamp ? raw.creadoEn.toDate().toISOString() : raw.creadoEn,
      enviadoEn: raw.enviadoEn instanceof Timestamp ? raw.enviadoEn.toDate().toISOString() : raw.enviadoEn,
    } as EntregaConRevision;
  });
}

// ── Leer entrega individual ─────────────────────────────────
export async function getEntregaById(id: string): Promise<EntregaConRevision | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  const raw = snap.data();
  return {
    ...raw,
    id: snap.id,
    creadoEn: raw.creadoEn instanceof Timestamp ? raw.creadoEn.toDate().toISOString() : raw.creadoEn,
    enviadoEn: raw.enviadoEn instanceof Timestamp ? raw.enviadoEn.toDate().toISOString() : raw.enviadoEn,
  } as EntregaConRevision;
}

// ── Guardar revisión docente ────────────────────────────────
export async function guardarRevisionDocente(id: string, revision: RevisionDocente): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    revision: {
      ...revision,
      revisadoEn: serverTimestamp(),
    },
    estado: revision.estadoRevision,
  });
}
