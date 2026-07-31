import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { Rotation, RotationMember, PatientAssignment } from '@/types/rotation';

export async function createRotation(year: string, rotationData: Omit<Rotation, 'id' | 'year' | 'createdAt'>): Promise<string> {
  const db = getAdminDb();
  const docRef = await db.collection(`programs/${year}/rotations`).add({
    ...rotationData,
    year,
    createdAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function getActiveRotations(year: string): Promise<Rotation[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(`programs/${year}/rotations`)
    .where('status', '==', 'ACTIVE')
    .get();

  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Rotation));
}

export async function addStudentToRotation(
  year: string,
  member: Omit<RotationMember, 'id'>
): Promise<string> {
  const db = getAdminDb();
  const docId = `${member.rotationId}_${member.studentId}`;
  await db.collection(`programs/${year}/rotation_members`).doc(docId).set(
    {
      ...member,
      id: docId,
    },
    { merge: true }
  );
  return docId;
}

export async function assignPatientToStudent(
  year: string,
  assignment: Omit<PatientAssignment, 'id'>
): Promise<string> {
  const db = getAdminDb();
  const ref = await db.collection(`programs/${year}/patient_assignments`).add({
    ...assignment,
    active: true,
  });
  return ref.id;
}

export async function getActiveAssignmentsForStudent(year: string, studentId: string): Promise<PatientAssignment[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(`programs/${year}/patient_assignments`)
    .where('studentId', '==', studentId)
    .where('active', '==', true)
    .get();

  return snap.docs.map((d: any) => ({ id: d.id, ...d.data() } as PatientAssignment));
}
