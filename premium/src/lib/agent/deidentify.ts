/**
 * Módulo de desidentificación — Sección 21 del Plan Maestro.
 *
 * Remueve:
 *   1. Correos electrónicos
 *   2. RUT chileno (xx.xxx.xxx-x y xxxxxxxx-x)
 *   3. Teléfonos chilenos (+56, 9, fijo con código de área)
 *   4. Direcciones (calle/av/pasaje + número)
 *   5. Nombres propios (recibidos como diccionario externo)
 */

// ─── Patterns ──────────────────────────────────────────────────────────────

const EMAIL_RE = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;

// RUT: 12.345.678-K | 12345678-K
const RUT_DOT_RE = /\b\d{1,2}\.\d{3}\.\d{3}-[\dkK]\b/g;
const RUT_COMPACT_RE = /\b\d{7,8}-[\dkK]\b/g;

// Teléfonos chilenos: +56 9 1234 5678 | +569 12345678 | 09 12345678 | (02) 1234 5678
const PHONE_CL_RE =
  /(?:\+56\s*)?(?:\(?\d{1,2}\)?\s*)?(?:\d[\s\-.]?){7,8}\d/g;

// Direcciones: "Av. Siempre Viva 742", "Calle Los Olmos 1234", "Pasaje Norte 56"
const ADDRESS_RE =
  /\b(?:av(?:enida)?|calle|psje|pasaje|pje|camino|ruta|diagonal|bulevar)\b\.?\s+[\w\sáéíóúñÁÉÍÓÚÑ]{2,40}\s+\d{1,5}(?:\s*[-/]\s*\d{1,5})?\b/gi;

// ─── Core function ─────────────────────────────────────────────────────────

/**
 * Desidentifica texto libre eliminando PII.
 *
 * @param text       Texto a limpiar.
 * @param knownNames Opcional: array de nombres propios conocidos del contexto
 *                   (ej. nombres de pacientes o estudiantes extraídos de
 *                   Firestore) para reemplazar de forma determinista.
 */
export function deidentifyText(text: string, knownNames?: string[]): string {
  if (!text) return text;

  let result = text;

  // 1. Correos
  result = result.replace(EMAIL_RE, '[CORREO_REMOVIDO]');

  // 2. RUT
  result = result.replace(RUT_DOT_RE, '[RUT_REMOVIDO]');
  result = result.replace(RUT_COMPACT_RE, '[RUT_REMOVIDO]');

  // 3. Teléfonos
  result = result.replace(PHONE_CL_RE, '[TELEFONO_REMOVIDO]');

  // 4. Direcciones
  result = result.replace(ADDRESS_RE, '[DIRECCION_REMOVIDA]');

  // 5. Nombres propios conocidos (diccionario externo)
  if (knownNames && knownNames.length > 0) {
    // Ordenar de mayor a menor longitud para evitar reemplazos parciales
    const sorted = [...knownNames].sort((a, b) => b.length - a.length);
    for (const name of sorted) {
      if (name.length < 2) continue; // Ignorar iniciales sueltas
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const nameRe = new RegExp(`\\b${escaped}\\b`, 'gi');
      result = result.replace(nameRe, '[NOMBRE_REMOVIDO]');
    }
  }

  return result;
}

// ─── Object wrapper ────────────────────────────────────────────────────────

/**
 * Desidentifica todas las cadenas de texto dentro de un objeto serializable.
 */
export function deidentifyObject<T extends object>(obj: T, knownNames?: string[]): T {
  try {
    const str = JSON.stringify(obj);
    const cleanedStr = deidentifyText(str, knownNames);
    return JSON.parse(cleanedStr);
  } catch {
    return obj;
  }
}
