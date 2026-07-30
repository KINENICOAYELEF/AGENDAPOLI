import { db } from '../firebase';
import { collection, addDoc, updateDoc, doc, getDoc } from 'firebase/firestore';

export async function createAgentRun(payload: any): Promise<string> {
  const runsRef = collection(db, 'agent_runs');
  const docRef = await addDoc(runsRef, {
    status: 'pending',
    payload,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  return docRef.id;
}

export async function updateAgentRun(runId: string, status: string, result?: any): Promise<void> {
  const runRef = doc(db, 'agent_runs', runId);
  await updateDoc(runRef, {
    status,
    ...(result !== undefined && { result }),
    updatedAt: new Date().toISOString(),
  });
}

export async function getAgentRun(runId: string): Promise<any> {
  const runRef = doc(db, 'agent_runs', runId);
  const snap = await getDoc(runRef);
  if (snap.exists()) {
    return snap.data();
  }
  return null;
}
