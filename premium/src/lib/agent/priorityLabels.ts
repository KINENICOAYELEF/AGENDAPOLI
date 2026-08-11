/**
 * NOMBRES LEGIBLES DE PRIORIDAD
 *
 * El código usa P0/P1/P2/P3 desde su origen y esa jerga se estaba mostrando
 * tal cual en Telegram y en pantalla. No significa nada para quien lee: hay
 * que decir qué hay que hacer, no un código interno.
 *
 * Los códigos siguen guardándose en la base porque ordenan y filtran bien;
 * solo se traducen al mostrarlos.
 */

export type Priority = 'P0' | 'P1' | 'P2' | 'P3';

const LABELS: Record<Priority, { emoji: string; short: string; long: string }> = {
  P0: { emoji: '🔴', short: 'Seguridad', long: 'Riesgo para la persona atendida' },
  P1: { emoji: '🟠', short: 'Revisar', long: 'Necesita tu revisión' },
  P2: { emoji: '🔵', short: 'Menor', long: 'Detalle por corregir' },
  P3: { emoji: '⚪️', short: 'Informativo', long: 'Solo para tu información' },
};

export function priorityEmoji(priority?: string): string {
  return LABELS[(priority as Priority)]?.emoji || '⚪️';
}

export function priorityLabel(priority?: string): string {
  return LABELS[(priority as Priority)]?.short || 'Informativo';
}

export function priorityDescription(priority?: string): string {
  return LABELS[(priority as Priority)]?.long || 'Solo para tu información';
}
