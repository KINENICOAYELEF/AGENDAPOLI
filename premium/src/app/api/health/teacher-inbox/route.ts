import { NextResponse } from 'next/server';
import { requireTeacher } from '@/lib/server/firebaseAdmin';

export async function GET(req: Request) {
  try {
    const authHeader = req.headers.get('authorization');
    const authResult = await requireTeacher(authHeader);

    const hasProjectId = Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
    const hasClientEmail = Boolean(process.env.FIREBASE_ADMIN_CLIENT_EMAIL);
    const hasPrivateKey = Boolean(process.env.FIREBASE_ADMIN_PRIVATE_KEY);

    return NextResponse.json({
      status: 'ok',
      service: 'teacher-inbox',
      firebaseAdminStatus: (hasProjectId && hasClientEmail && hasPrivateKey) ? 'configured' : 'degraded',
      teacher: {
        uid: authResult.uid,
        email: authResult.user?.email || null,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Unauthorized' },
      { status: error.message?.includes('Forbidden') ? 403 : 401 }
    );
  }
}
