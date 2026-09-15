import { NextResponse } from 'next/server';
import { randomInt, randomUUID } from 'node:crypto';
import { getAdminDb, requireRepasoUser } from '@/lib/server/firebaseAdmin';
import { handleApiError, getRequestId } from '@/lib/server/apiResponse';
import { attemptsRef, bankQuestionsVisible, attemptView } from '@/lib/repaso-msk/server';
import { catalog, validVersion, type BankVersion } from '@/lib/repaso-msk/catalog';
import { readBankState, seenFamilies } from '@/lib/repaso-msk/bank-state';
import { family, selectQuestions } from '@/lib/repaso-msk/selection';
import type { Attempt } from '@/lib/repaso-msk/types';

export const dynamic = 'force-dynamic';
export async function GET(req: Request) {
  try {
    const { uid } = await requireRepasoUser(req.headers.get('authorization'));
    const hidden = ((await getAdminDb().collection('app_config').doc('repaso_msk_bank').get()).data()?.hiddenIds ?? []) as string[];
    const ref = attemptsRef(uid);
    const [docs, marker] = await Promise.all([ref.orderBy('createdAt', 'desc').limit(40).get(), ref.parent!.get()]);
    const banks = (Object.keys(catalog) as BankVersion[]).map(version => {
      const questions = bankQuestionsVisible(version, hidden), seen = new Set(seenFamilies(marker.data(), version));
      const used = questions.filter(q => seen.has(family(q))).length;
      return { version, total: questions.length, used, unseen: questions.length - used, activeId: readBankState(marker.data(), version).activeId };
    });
    return NextResponse.json({ banks, history: docs.docs.map(doc => {
      const a = doc.data() as Attempt;
      return { id: a.id, version: a.version, status: a.status, createdAt: a.createdAt, updatedAt: a.updatedAt, repeated: a.repeated,
        answered: a.answers.length, correct: a.status === 'completed' ? a.answers.filter(x => x.correct).length : 0, total: a.questionIds.length };
    }) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (e) { return handleApiError(e, getRequestId(req)); }
}

export async function POST(req: Request) {
  try {
    const { uid } = await requireRepasoUser(req.headers.get('authorization'));
    const hidden = ((await getAdminDb().collection('app_config').doc('repaso_msk_bank').get()).data()?.hiddenIds ?? []) as string[];
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
      const seen = seenFamilies(state, version);
      const selection = selectQuestions(bankQuestionsVisible(version, hidden), seen, body.replay === true, randomInt);
      const ids = selection.questions.map(q => q.id);
      const now = new Date().toISOString();
      const a: Attempt = { id: randomUUID(), version, questionIds: ids, answers: [], revision: 0,
        status: 'active', remainingMs: 60_000, selected: null, createdAt: now, updatedAt: now, repeated: selection.repeated };
      tx.create(ref.doc(a.id), a);
      tx.set(marker, { banks: { [version]: { activeId: a.id, used: true, seenFamilies: [...new Set([...seen, ...selection.questions.map(family)])] } } }, { merge: true });
      return a;
    });
    return NextResponse.json(attemptView(attempt));
  } catch (e) {
    if (e instanceof Error && e.message === 'BANK_USED') return NextResponse.json({ error: 'No quedan 35 preguntas inéditas. Revisa tu historial o autoriza un ensayo con repetición.' }, { status: 409 });
    return handleApiError(e, getRequestId(req));
  }
}
