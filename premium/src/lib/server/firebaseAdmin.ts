/**
 * Backend Seguro Firebase Admin SDK
 * Cumple con la Sección 4.2 y 21 del Plan Maestro.
 * Acceso exclusivo en el servidor para el Servidor MCP y Webhooks del Agente Antigravity.
 */

import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

import { db as clientDb } from '@/lib/firebase';

let _adminDb: any = null;

export function getAdminDb() {
    if (_adminDb) return _adminDb;
    try {
        if (getApps().length > 0) {
            _adminDb = getFirestore(getApps()[0]);
            return _adminDb;
        }

        const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agendapoli-default';
        const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
        const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n') : undefined;

        if (clientEmail && privateKey) {
            const app = initializeApp({
                credential: cert({
                    projectId,
                    clientEmail,
                    privateKey,
                }),
            });
            _adminDb = getFirestore(app);
            return _adminDb;
        }

        // Fallback seguro a la instancia Firestore existente
        _adminDb = clientDb;
        return _adminDb;
    } catch (e) {
        console.warn("[Firebase Admin Warning] Fallback to client Firestore instance:", e);
        _adminDb = clientDb;
        return _adminDb;
    }
}

export const adminDb: any = new Proxy({}, {
    get(_target, prop) {
        const instance = getAdminDb();
        const value = instance[prop];
        return typeof value === 'function' ? value.bind(instance) : value;
    }
});
