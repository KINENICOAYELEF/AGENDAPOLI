import { NextResponse } from 'next/server';
import { randomInt, randomUUID } from 'node:crypto';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { handleApiError, getRequestId } from '@/lib/server/apiResponse';
import { attemptsRef, bankQuestions, attemptView } from '@/lib/repaso-msk/server';
import { validVersion } from '@/lib/repaso-msk/catalog';
import { readBankState } from '@/lib/repaso-msk/bank-state';
import type { Attempt } from '@/lib/repaso-msk/types';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const { uid } = await requireTeacher(req.headers.get('authorization'));
    const docs = await attemptsRef(uid).orderBy('createdAt', 'desc').limit(40).get();
    return NextResponse.json({ history: docs.docs.map(doc => {
      const a = doc.data() as Attempt;
      return { id: a.id, version: a.version, status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt, repeated: a.repeated,
        answered: a.answers.length, correct: a.status === 'completed' ? a.answers.filter(x => x.correct).length : 0, total: a.questionIds.length };
    }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return handleApiError(e, getRequestId(req)); }
}

export async function POST(req: Request) {
  try {
    const { uid } = await requireTeacher(req.headers.get('authorization'));
    const body = await req.json().catch(() => null);
    if (!body || typeof body !== 'object' || Array.isArray(body) ||
      (body.version !== undefined && !validVersion(body.version)) ||
      (body.replay !== undefined && typeof body.replay !== 'boolean')) {
      return NextResponse.json({ error: 'Banco o solicitud no válidos.' }, { status: 400 });
    }
    const version = body.version ?? 'knee-v1';
    // One active attempt per teacher AND bank. Both banks can be resumed independently.
    const ref = attemptsRef(uid);
    const marker = ref.parent!;
    const attempt = await ref.firestore.runTransaction(async tx => {
      const state = (await tx.get(marker)).data();
      const selectedBank = readBankState(state, version);
      if (selectedBank.activeId) {
        const old = await tx.get(ref.doc(selectedBank.activeId));
        if (old.exists && old.data()?.status === 'active' && old.data()?.version === version) return old.data() as Attempt;
      }
      if (selectedBank.used && body.replay !== true) throw new Error('BANK_USED');
      const ids = bankQuestions(version).map(q => q.id);
      if (ids.length !== 35) throw new Error('Invalid bank size');
      for (let i = ids.length - 1; i > 0; i--) { const j = randomInt(i + 1); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      const now = new Date().toISOString();
      const a: Attempt = { id: randomUUID(), version, questionIds: ids, answers: [], revision: 0,
        status: 'active', remainingMs: 60_000, selected: null, createdAt: now, updatedAt: now, repeated: !!selectedBank.used };
      tx.create(ref.doc(a.id), a);
      tx.set(marker, { banks: { [version]: { activeId: a.id, used: true } } }, { merge: true });
      return a;
    });
    return NextResponse.json(attemptView(attempt));
  } catch (e) {
    if (e instanceof Error && e.message === 'BANK_USED') return NextResponse.json({ error: 'Ya revisaste este banco. Confirma el ensayo docente para repetirlo.' }, { status: 409 });
    return handleApiError(e, getRequestId(req));
  }
}
