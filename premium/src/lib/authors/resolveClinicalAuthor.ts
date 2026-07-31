import { getAdminDb } from '@/lib/server/firebaseAdmin';
import { ResolvedAuthor } from '@/types/clinicalAuthor';

const authorCache = new Map<string, ResolvedAuthor>();

export async function resolveClinicalAuthor(
  authorUid?: string,
  rawAuthorName?: string
): Promise<ResolvedAuthor> {
  const cacheKey = `${authorUid || ''}:${rawAuthorName || ''}`;
  if (authorCache.has(cacheKey)) {
    return authorCache.get(cacheKey)!;
  }

  const db = getAdminDb();

  // 1. Try UID lookup
  if (authorUid) {
    try {
      const userDoc = await db.collection('users').doc(authorUid).get();
      if (userDoc.exists) {
        const data = userDoc.data() as any;
        const resolved: ResolvedAuthor = {
          uid: authorUid,
          displayName: data.displayName || data.nombreCompleto || data.email || 'Interno Registrado',
          studentCode: data.studentCode || undefined,
          universityCode: data.university || data.universityCode || undefined,
          attributionStatus: 'VERIFIED',
        };
        authorCache.set(cacheKey, resolved);
        return resolved;
      }
    } catch (e) {
      console.warn(`Error resolving author UID ${authorUid}:`, e);
    }
  }

  // 2. Fallback to name/legacy lookup if present
  if (rawAuthorName && rawAuthorName !== 'Profesional no identificado') {
    const resolved: ResolvedAuthor = {
      uid: authorUid || null,
      displayName: rawAuthorName,
      studentCode: undefined,
      universityCode: undefined,
      attributionStatus: 'LEGACY_MATCH',
    };
    authorCache.set(cacheKey, resolved);
    return resolved;
  }

  // 3. Unknown author
  const unknownAuthor: ResolvedAuthor = {
    uid: null,
    displayName: 'Autoría no determinada',
    studentCode: 'INT-UNKNOWN',
    attributionStatus: 'UNKNOWN',
  };
  authorCache.set(cacheKey, unknownAuthor);
  return unknownAuthor;
}
