import { NextResponse } from 'next/server';

export type ApiSuccess<T> = {
  ok: true;
  data: T;
  requestId: string;
};

export type ApiFailure = {
  ok: false;
  error: {
    code: string;
    message: string;
  };
  requestId: string;
};

export function getRequestId(req: Request): string {
  return req.headers.get('x-request-id') || req.headers.get('x-vercel-id') || crypto.randomUUID();
}

export function apiSuccess<T>(data: T, requestId: string, status: number = 200) {
  const payload: ApiSuccess<T> = {
    ok: true,
    data,
    requestId,
  };
  return NextResponse.json(payload, { status });
}

export function apiFailure(code: string, message: string, requestId: string, status: number = 400) {
  const payload: ApiFailure = {
    ok: false,
    error: {
      code,
      message,
    },
    requestId,
  };
  return NextResponse.json(payload, { status });
}

export function handleApiError(error: any, requestId: string) {
  console.error(`[API Error ${requestId}]:`, error);

  const message = error?.message || 'Error interno del servidor';
  const code = error?.code || '';

  // Auth errors — Firebase Admin and token verification errors
  if (
    message.includes('Unauthorized') ||
    message.includes('token') ||
    message.includes('Missing Bearer') ||
    message.includes('Missing or invalid') ||
    message.includes('Decoding Firebase ID token') ||
    code === 'auth/id-token-expired' ||
    code === 'auth/argument-error'
  ) {
    return apiFailure('UNAUTHORIZED', 'Acceso no autorizado. Token inválido o ausente.', requestId, 401);
  }

  // Permission / Role errors
  if (
    message.includes('Forbidden') ||
    message.includes('Teacher role required') ||
    message.includes('requiere rol')
  ) {
    return apiFailure('FORBIDDEN', 'Acceso denegado. Se requieren permisos docentes.', requestId, 403);
  }

  // Firebase Admin credential / init errors
  if (
    message.includes('FIREBASE_ADMIN') ||
    message.includes('credentials') ||
    message.includes('credential')
  ) {
    return apiFailure('SERVICE_UNAVAILABLE', 'Servicio de autenticación no disponible temporalmente.', requestId, 503);
  }

  return apiFailure('INTERNAL_ERROR', 'No se pudo procesar la solicitud.', requestId, 500);
}
