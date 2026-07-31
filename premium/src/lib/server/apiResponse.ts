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
  
  if (message.includes('Unauthorized') || message.includes('token') || message.includes('Missing Bearer')) {
    return apiFailure('UNAUTHORIZED', 'Acceso no autorizado. Token inválido o ausente.', requestId, 401);
  }
  if (message.includes('Forbidden') || message.includes('requiere rol')) {
    return apiFailure('FORBIDDEN', 'Acceso denegado. Se requieren permisos docentes.', requestId, 403);
  }

  return apiFailure('INTERNAL_ERROR', 'No se pudo procesar la solicitud.', requestId, 500);
}
