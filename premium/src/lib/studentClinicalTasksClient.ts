import { auth } from '@/lib/firebase';

export async function resolveClinicalTasksAfterEvaluation(input: {
  year: string;
  patientId: string;
  processId?: string;
  recordId: string;
  recordType: 'INITIAL' | 'REEVALUATION';
}) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) return { success: false, resolved: 0 };
  const response = await fetch('/api/student/clinical-tasks/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || 'No se pudo cerrar la tarea clínica asociada.');
  }
  const result = await response.json();
  if (result?.success) {
    window.dispatchEvent(new CustomEvent('student-clinical-tasks-changed', {
      detail: { patientId: input.patientId, processId: input.processId, recordType: input.recordType },
    }));
  }
  return result;
}
