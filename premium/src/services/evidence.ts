import { collection, doc, addDoc, getDoc, getDocs, updateDoc, query, where, orderBy, deleteDoc, arrayUnion, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { EvidenceArticle, EvidenceTask, EvidenceContribution, TaskStatus } from '../types/evidence';

// ─── ARTICLES ───

export const getEvidenceArticles = async (): Promise<EvidenceArticle[]> => {
    const q = query(collection(db, 'evidence_articles'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvidenceArticle));
};

export const saveEvidenceArticle = async (article: EvidenceArticle): Promise<string> => {
    if (article.id) {
        const ref = doc(db, 'evidence_articles', article.id);
        const { id, ...data } = article;
        await updateDoc(ref, { ...data });
        return article.id;
    } else {
        const ref = await addDoc(collection(db, 'evidence_articles'), {
            ...article,
            createdAt: Date.now(),
        });
        return ref.id;
    }
};

export const addContributionToArticle = async (articleId: string, contribution: EvidenceContribution) => {
    const ref = doc(db, 'evidence_articles', articleId);
    await updateDoc(ref, {
        contributions: arrayUnion(contribution)
    });
};

export const updateContributionInArticle = async (articleId: string, contributions: EvidenceContribution[]) => {
    const ref = doc(db, 'evidence_articles', articleId);
    await updateDoc(ref, { contributions });
};

export const deleteEvidenceArticle = async (articleId: string) => {
    await deleteDoc(doc(db, 'evidence_articles', articleId));
};

// ─── TASKS ───

export const createEvidenceTask = async (task: EvidenceTask): Promise<string> => {
    const ref = await addDoc(collection(db, 'evidence_tasks'), {
        ...task,
        createdAt: Date.now()
    });
    return ref.id;
};

export const getStudentTasks = async (studentId: string): Promise<EvidenceTask[]> => {
    // Quitamos orderBy para evitar error de índice compuesto en Firebase
    const q = query(collection(db, 'evidence_tasks'), where('studentId', '==', studentId));
    const snapshot = await getDocs(q);
    const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvidenceTask));
    // Ordenamos en memoria
    return tasks.sort((a, b) => b.createdAt - a.createdAt);
};

export const getAllEvidenceTasks = async (): Promise<EvidenceTask[]> => {
    const q = query(collection(db, 'evidence_tasks'), orderBy('createdAt', 'desc'));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as EvidenceTask));
};

export const updateTaskStatus = async (taskId: string, updates: Partial<EvidenceTask>) => {
    const ref = doc(db, 'evidence_tasks', taskId);
    await updateDoc(ref, updates);
};

export const deleteEvidenceTask = async (taskId: string) => {
    await deleteDoc(doc(db, 'evidence_tasks', taskId));
};
