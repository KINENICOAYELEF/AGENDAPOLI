import { NextResponse } from 'next/server';

export function stationApiError(error: unknown) {
  const message = String((error as Error)?.message || error || 'Error desconocido');
  const status = message.startsWith('Unauthorized')
    ? 401
    : message.startsWith('Forbidden') || message.startsWith('FORBIDDEN')
      ? 403
      : message.startsWith('NOT_FOUND')
        ? 404
        : message.startsWith('INCOMPLETE')
          ? 409
          : message.includes('Zod') || message.includes('validation')
            ? 400
            : 500;

  const safeMessage = status >= 500
    ? 'No pudimos completar esta operación. La sesión guardada no se perdió.'
    : message.replace(/^[A-Z_]+:\s*/, '');

  if (status >= 500) console.error('[simulador-estaciones]', error);
  return NextResponse.json({ ok: false, error: safeMessage }, { status });
}

export function stationApiSuccess<T>(data: T, status = 200) {
  return NextResponse.json({ ok: true, data }, { status });
}
