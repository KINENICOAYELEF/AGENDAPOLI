import { getRequestId, apiSuccess, handleApiError } from '@/lib/server/apiResponse';
import { requireTeacher } from '@/lib/server/firebaseAdmin';
import { buildStudentDossier } from '@/lib/teacher-inbox/studentDossier';

/**
 * Ficha longitudinal de una estudiante. Solo docentes.
 *
 * Es de lectura estricta: nunca escribe en fichas clínicas ni notifica a nadie.
 */
export async function GET(req: Request) {
  const requestId = getRequestId(req);
  try {
    await requireTeacher(req.headers.get('authorization'));

    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get('studentId');
    const year = searchParams.get('year') || new Date().getFullYear().toString();

    if (!studentId) {
      return handleApiError(new Error('Falta el identificador de la estudiante.'), requestId);
    }

    const dossier = await buildStudentDossier(studentId, year);
    return apiSuccess(dossier, requestId);
  } catch (error: any) {
    return handleApiError(error, requestId);
  }
}
