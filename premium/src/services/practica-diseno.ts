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
import type {
  EntregaPracticaDiseno,
  EntregaDisenoConRevision,
  RevisionDocenteDiseno,
  EstadoEntregaDiseno,
} from '@/types/practica-diseno';

const COL = 'practica_diseno_entregas';

// ── Guardar entrega estudiante (submit) ──────────────────────
export async function enviarEntregaDiseno(
  data: Omit<EntregaPracticaDiseno, 'estado' | 'creadoEn' | 'enviadoEn'>
): Promise<string> {
  const docRef = await addDoc(collection(db, COL), {
    ...data,
    estado: 'entregado' as EstadoEntregaDiseno,
    creadoEn: serverTimestamp(),
    enviadoEn: serverTimestamp(),
  });
  return docRef.id;
}

// ── Leer todas las entregas (docente) ───────────────────────
export async function getTodasLasEntregasDiseno(): Promise<EntregaDisenoConRevision[]> {
  const q = query(collection(db, COL), orderBy('enviadoEn', 'desc'));
  const snap = await getDocs(q);
  return snap.docs.map((d) => {
    const raw = d.data();
    return {
      ...raw,
      id: d.id,
      creadoEn: raw.creadoEn instanceof Timestamp ? raw.creadoEn.toDate().toISOString() : raw.creadoEn,
      enviadoEn: raw.enviadoEn instanceof Timestamp ? raw.enviadoEn.toDate().toISOString() : raw.enviadoEn,
    } as EntregaDisenoConRevision;
  });
}

// ── Leer entrega individual ─────────────────────────────────
export async function getEntregaDisenoById(id: string): Promise<EntregaDisenoConRevision | null> {
  const snap = await getDoc(doc(db, COL, id));
  if (!snap.exists()) return null;
  const raw = snap.data();
  return {
    ...raw,
    id: snap.id,
    creadoEn: raw.creadoEn instanceof Timestamp ? raw.creadoEn.toDate().toISOString() : raw.creadoEn,
    enviadoEn: raw.enviadoEn instanceof Timestamp ? raw.enviadoEn.toDate().toISOString() : raw.enviadoEn,
  } as EntregaDisenoConRevision;
}

// ── Guardar revisión docente ────────────────────────────────
export async function guardarRevisionDocenteDiseno(
  id: string,
  revision: RevisionDocenteDiseno
): Promise<void> {
  await updateDoc(doc(db, COL, id), {
    revision: {
      ...revision,
      revisadoEn: serverTimestamp(),
    },
    estado: revision.estadoRevision,
  });
}
