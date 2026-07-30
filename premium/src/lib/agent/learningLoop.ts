import { db } from '../firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export async function getWeeklyCalibrations(): Promise<any[]> {
  const decisionsRef = collection(db, 'teacher_decisions');
  
  // Calculate date a week ago
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  
  const q = query(
    decisionsRef,
    where('timestamp', '>=', oneWeekAgo.toISOString()),
    orderBy('timestamp', 'desc'),
    limit(50)
  );
  
  const snap = await getDocs(q);
  const decisions: any[] = [];
  snap.forEach((doc) => {
    decisions.push({ id: doc.id, ...doc.data() });
  });
  
  return decisions;
}

export function generateCalibrationContext(decisions: any[]): string {
  if (decisions.length === 0) return '';
  
  let context = 'Decisiones recientes del docente para calibración:\n';
  decisions.forEach(d => {
    context += `- Encontró útil: ${d.isUseful ? 'Sí' : 'No'}. Comentario: ${d.feedback || 'N/A'}\n`;
  });
  
  return context;
}
