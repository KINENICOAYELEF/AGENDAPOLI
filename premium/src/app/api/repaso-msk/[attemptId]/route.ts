import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireRepasoUser } from '@/lib/server/firebaseAdmin';
import { handleApiError, getRequestId } from '@/lib/server/apiResponse';
import { attemptsRef, bank, attemptView } from '@/lib/repaso-msk/server';
import { advanceAttempt } from '@/lib/repaso-msk/engine';
import type { Attempt } from '@/lib/repaso-msk/types';

export const dynamic = 'force-dynamic';
const option = z.enum(['A', 'B', 'C', 'D']).nullable();
const common = { revision: z.number().int().nonnegative(), index: z.number().int().min(0).max(34), requestId: z.string().uuid() };
const schema = z.discriminatedUnion('type', [
  z.object({ ...common, type: z.literal('answer'), option, reason: z.enum(['answer', 'skip', 'timeout']), elapsedMs: z.number().int().min(0).max(60000) }),
  z.object({ ...common, type: z.literal('checkpoint'), selected: option, remainingMs: z.number().int().min(0).max(60000) }),
]);
type Context = { params: Promise<{ attemptId: string }> };
async function getRef(req: Request, context: Context) {
  const { uid } = await requireRepasoUser(req.headers.get('authorization'));
  const { attemptId } = await context.params;
  if (!z.string().uuid().safeParse(attemptId).success) throw new Error('NOT_FOUND');
  return attemptsRef(uid).doc(attemptId);
}
function failure(e: unknown, req: Request) {
  const msg = e instanceof Error ? e.message : '';
  if (msg === 'NOT_FOUND') return NextResponse.json({ error: 'Intento no encontrado.' }, { status: 404 });
  if (msg === 'CONFLICT') return NextResponse.json({ error: 'El intento cambió en otra pestaña. Recarga para recuperar la versión guardada.' }, { status: 409 });
  if (msg === 'INVALID') return NextResponse.json({ error: 'Respuesta no válida.' }, { status: 400 });
  return handleApiError(e, getRequestId(req));
}
export async function GET(req: Request, ctx: Context) {
  try {
    const doc = await (await getRef(req, ctx)).get();
    if (!doc.exists) throw new Error('NOT_FOUND');
    return NextResponse.json(attemptView(doc.data() as Attempt), { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return failure(e, req); }
}
export async function POST(req: Request, ctx: Context) {
  try {
    const ref = await getRef(req, ctx);
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) throw new Error('INVALID');
    const action = parsed.data;
    const updated = await ref.firestore.runTransaction(async tx => {
      const doc = await tx.get(ref);
      if (!doc.exists) throw new Error('NOT_FOUND');
      const old = doc.data() as Attempt & { lastRequestId?: string };
      // A lost HTTP response may be retried without advancing twice.
      if (old.lastRequestId === action.requestId) return old;
      const next = advanceAttempt(old, action, bank, new Date().toISOString());
      tx.update(ref, { ...next, lastRequestId: action.requestId });
      return next;
    });
    return NextResponse.json(attemptView(updated));
  } catch (e) { return failure(e, req); }
}
