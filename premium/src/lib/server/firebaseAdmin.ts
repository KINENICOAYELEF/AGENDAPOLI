/**
 * Backend Seguro Firebase Admin SDK
 * Cumple con la Sección 4.2 y 21 del Plan Maestro.
 * Acceso exclusivo en el servidor. Falla cerrado si faltan credenciales.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

let _adminApp: any = null;
let _adminDb: any = null;

function initAdminApp() {
  if (getApps().length > 0) {
    _adminApp = getApps()[0];
    return _adminApp;
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (clientEmail && privateKey && projectId) {
    _adminApp = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    return _adminApp;
  }

  // Strict server-side security: fail closed if credentials missing
  throw new Error('[Firebase Admin Error] Missing FIREBASE_ADMIN credentials. Server-side access denied.');
}

export function getAdminDb() {
  if (_adminDb) return _adminDb;
  const app = initAdminApp();
  _adminDb = getFirestore(app);
  // Un solo campo opcional sin valor —por ejemplo un hallazgo sin persona
  // asociada— hacía fallar la escritura completa y con ella todo el censo.
  // Firestore ya trata "ausente" y "undefined" como lo mismo al leer; aquí se
  // le pide que lo haga también al escribir, en vez de lanzar una excepción.
  _adminDb.settings({ ignoreUndefinedProperties: true });
  return _adminDb;
}

export function getAdminAuth() {
  const app = initAdminApp();
  return getAuth(app);
}

export async function requireTeacher(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid token');
  }

  const token = authHeader.replace('Bearer ', '');
  const auth = getAdminAuth();
  const decoded = await auth.verifyIdToken(token);

  const db = getAdminDb();
  const userDoc = await db.collection('users').doc(decoded.uid).get();

  if (!userDoc.exists || userDoc.data()?.role !== 'DOCENTE') {
    throw new Error('Forbidden: Teacher role required');
  }

  return { uid: decoded.uid, user: userDoc.data() };
}

export async function requireAuthenticated(authHeader?: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Unauthorized: Missing or invalid token');
  }
  const token = authHeader.replace('Bearer ', '');
  const decoded = await getAdminAuth().verifyIdToken(token);
  const userDoc = await getAdminDb().collection('users').doc(decoded.uid).get();
  if (!userDoc.exists) throw new Error('Forbidden: User profile required');
  return { uid: decoded.uid, user: userDoc.data() };
}

export const adminDb: any = new Proxy({}, {
  get(_target, prop) {
    const instance = getAdminDb();
    const value = instance[prop];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});
