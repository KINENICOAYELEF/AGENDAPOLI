import { randomBytes, createHash } from 'node:crypto';
import { getAdminDb, requireAuthenticated } from '@/lib/server/firebaseAdmin';
import { ExternalEvaluator } from '@/lib/adultoMayor/types';

export const AM_COLLECTIONS = {
  config: 'adulto_mayor_config',
  evaluators: 'adulto_mayor_evaluators',
  participants: 'adulto_mayor_participants',
  evaluations: 'adulto_mayor_evaluations',
  attendance: 'adulto_mayor_attendance',
  workshopEvolutions: 'adulto_mayor_workshop_evolutions',
} as const;

export const EVALUATOR_COOKIE = 'am_evaluator_session';
export const PORTAL_COOKIE = 'am_portal_access';

export function createSecureToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readCookie(req: Request, name: string): string {
  const raw = req.headers.get('cookie') || '';
  const prefix = `${name}=`;
  const part = raw.split(';').map(item => item.trim()).find(item => item.startsWith(prefix));
  if (!part) return '';
  try {
    return decodeURIComponent(part.slice(prefix.length));
  } catch {
    return '';
  }
}

export async function requireWorkshopStaff(authHeader?: string | null) {
  const authenticated = await requireAuthenticated(authHeader);
  const role = String(authenticated.user?.role || '');
  if (role !== 'DOCENTE' && role !== 'INTERNO') {
    throw new Error('Forbidden: Workshop staff role required');
  }
  return authenticated;
}

export async function ensurePortalConfig(): Promise<{ portalToken: string; updatedAt: string }> {
  const db = getAdminDb();
  const ref = db.collection(AM_COLLECTIONS.config).doc('portal');
  const snap = await ref.get();
  const existing = snap.data();
  if (existing?.portalToken) {
    return { portalToken: String(existing.portalToken), updatedAt: String(existing.updatedAt || '') };
  }

  const portalToken = createSecureToken(24);
  const updatedAt = new Date().toISOString();
  await ref.set({ portalToken, portalTokenHash: hashToken(portalToken), updatedAt }, { merge: true });
  return { portalToken, updatedAt };
}

export async function rotatePortalConfig(): Promise<{ portalToken: string; updatedAt: string }> {
  const db = getAdminDb();
  const portalToken = createSecureToken(24);
  const updatedAt = new Date().toISOString();
  await db.collection(AM_COLLECTIONS.config).doc('portal').set({
    portalToken,
    portalTokenHash: hashToken(portalToken),
    updatedAt,
  }, { merge: true });
  return { portalToken, updatedAt };
}

export async function validatePortalAccess(req: Request, explicitToken?: string): Promise<boolean> {
  const token = String(explicitToken || readCookie(req, PORTAL_COOKIE) || '');
  if (!token) return false;
  const config = await ensurePortalConfig();
  return token.length >= 20 && hashToken(token) === hashToken(config.portalToken);
}

export async function requireExternalEvaluator(req: Request): Promise<{ evaluator: ExternalEvaluator; rawToken: string }> {
  const rawToken = readCookie(req, EVALUATOR_COOKIE);
  if (!rawToken) throw new Error('Unauthorized: Evaluator session required');

  const db = getAdminDb();
  const snapshot = await db.collection(AM_COLLECTIONS.evaluators)
    .where('tokenHash', '==', hashToken(rawToken))
    .limit(1)
    .get();
  if (snapshot.empty) throw new Error('Unauthorized: Evaluator session invalid');

  const doc = snapshot.docs[0];
  const evaluator = { id: doc.id, ...doc.data() } as ExternalEvaluator;
  if (!evaluator.active) throw new Error('Forbidden: Evaluator access revoked');

  // No bloquea la respuesta si la marca de actividad no se puede actualizar.
  void doc.ref.update({ lastAccessAt: new Date().toISOString() }).catch(() => undefined);
  return { evaluator, rawToken };
}

export function publicEvaluator(evaluator: ExternalEvaluator): Omit<ExternalEvaluator, 'tokenHash'> {
  const { tokenHash: _tokenHash, ...safe } = evaluator;
  return safe;
}

export function publicBaseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (configured) return configured.replace(/\/$/, '');
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

