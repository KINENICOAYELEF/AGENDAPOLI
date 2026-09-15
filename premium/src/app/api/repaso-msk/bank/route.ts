import { NextResponse } from 'next/server';
import { getAdminDb, requireRepasoUser } from '@/lib/server/firebaseAdmin';
import { handleApiError, getRequestId } from '@/lib/server/apiResponse';
import { bankQuestions } from '@/lib/repaso-msk/server';

// The teacher must review the same resolved bank that a new attempt receives:
// originals superseded by a revision are historical records, not active items.
const activeBank = () => (['knee-v1', 'hip-v1', 'shoulder-v1'] as const).flatMap(bankQuestions);

const settings = () => getAdminDb().collection('app_config').doc('repaso_msk_bank');
const teacher = async (headers: Headers) => {
  const auth = await requireRepasoUser(headers.get('authorization'));
  if (auth.user?.role !== 'DOCENTE') throw new Error('FORBIDDEN');
  return auth;
};

export async function GET(req: Request) {
  try {
    await teacher(req.headers);
    const hidden = new Set(((await settings().get()).data()?.hiddenIds ?? []) as string[]);
    return NextResponse.json({ questions: activeBank().map(q => ({ ...q, hidden: hidden.has(q.id) })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return handleApiError(error, getRequestId(req)); }
}

export async function PATCH(req: Request) {
  try {
    await teacher(req.headers);
    const body = await req.json().catch(() => null);
    if (!body || typeof body.id !== 'string' || typeof body.hidden !== 'boolean' || !activeBank().some(q => q.id === body.id)) return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
    const ref = settings(); const current = new Set(((await ref.get()).data()?.hiddenIds ?? []) as string[]);
    body.hidden ? current.add(body.id) : current.delete(body.id);
    await ref.set({ hiddenIds: [...current], updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ id: body.id, hidden: body.hidden });
  } catch (error) { return handleApiError(error, getRequestId(req)); }
}
