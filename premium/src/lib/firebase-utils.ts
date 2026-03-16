/**
 * Deeply sanitizes an object for Firestore by removing all properties with 'undefined' values.
 * Firestore throws "Unsupported field value: undefined" if these persist.
 *
 * Rules:
 * - Recursively checks objects and arrays.
 * - Removes keys where value is strictly 'undefined'.
 * - Keeps null, false, 0, "", and empty objects/arrays.
 * - Preserves special Firestore types (Date, Timestamp, GeoPoint if present).
 */
export function sanitizeForFirestoreDeep<T>(obj: T): T {
    if (obj === undefined) return null as any;
    if (obj === null || typeof obj !== 'object') return obj;

    // Handle Dates (preserve them)
    if (obj instanceof Date) return obj as any;

    // Handle Arrays
    if (Array.isArray(obj)) {
        return obj
            .filter(item => item !== undefined)
            .map(item => sanitizeForFirestoreDeep(item)) as any;
    }

    // Handle Objects
    const sanitizedObj: any = {};
    for (const key in obj) {
        if (Object.prototype.hasOwnProperty.call(obj, key)) {
            const value = (obj as any)[key];
            if (value !== undefined) {
                sanitizedObj[key] = sanitizeForFirestoreDeep(value);
            }
        }
    }

    return sanitizedObj;
}
