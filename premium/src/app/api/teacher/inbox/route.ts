import { getRequestId, apiSuccess, handleApiError } from '@/lib/server/apiResponse';
import { fetchServerInbox } from '@/lib/teacher-inbox/query';
import { requireTeacher } from '@/lib/server/firebaseAdmin';

export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    const authHeader = req.headers.get('authorization');
    await requireTeacher(authHeader);

    const { searchParams } = new URL(req.url);
    const year = searchParams.get('year') || new Date().getFullYear().toString();
    const kind = searchParams.get('kind') as 'EVALUACION' | 'EVOLUCION' | undefined;
    const studentId = searchParams.get('studentId') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    // Calculate "Today" in Chile local time (America/Santiago)
    const now = new Date();
    const from = searchParams.get('from') || new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const to = searchParams.get('to') || now.toISOString();

    const data = await fetchServerInbox({
      year,
      from,
      to,
      limit,
      kind: kind || undefined,
      studentId: studentId || undefined,
    });

    return apiSuccess(data, requestId);
  } catch (error: any) {
    return handleApiError(error, requestId);
  }
}
