/**
 * Deeply sanitizes an object for Firestore by removing all properties with 'undefined' values.
 * Firestore throws "Unsupported field value: undefined" if these persist.
 */
export function sanitizeForFirestoreDeep<T>(obj: T): T {
    if (obj === undefined) return null as any;
    if (obj === null || typeof obj !== 'object') return obj;

    if (obj instanceof Date) return obj as any;

    if (Array.isArray(obj)) {
        return obj
            .filter(item => item !== undefined)
            .map(item => sanitizeForFirestoreDeep(item)) as any;
    }

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

/**
 * Resolves a createdAt timestamp safely from existing or local data.
 */
export function resolveSafeCreatedAt(existingDoc: any, localDoc: any): string {
    return (
        existingDoc?.audit?.createdAt || 
        localDoc?.audit?.createdAt || 
        existingDoc?.createdAt || 
        localDoc?.createdAt || 
        new Date().toISOString()
    );
}

/**
 * Resolves an audit object safely, ensuring createdAt is preserved or created once.
 */
export function resolveSafeAudit(existingAudit: any, localAudit: any, userId: string, isClosing: boolean = false): any {
    const now = new Date().toISOString();
    
    // Use resolveSafeCreatedAt logic internally but wrapped in audit if needed
    const createdAt = existingAudit?.createdAt || localAudit?.createdAt || now;
    const createdBy = existingAudit?.createdBy || localAudit?.createdBy || userId;

    const audit: any = {
        ...(existingAudit || {}),
        ...(localAudit || {}),
        createdAt,
        createdBy,
        lastEditedAt: now,
        updatedBy: userId
    };

    if (isClosing && !audit.closedAt) {
        audit.closedAt = now;
        audit.closedBy = userId;
    }

    return audit;
}

/**
 * Formats a date string safely from a document using prioritized metadata.
 */
export function formatSafeDate(docData: any): string {
    if (!docData) return "Sin fecha";
    
    const dateStr = 
        docData.updatedAt || 
        docData.audit?.lastEditedAt || 
        docData.audit?.createdAt || 
        docData.createdAt || 
        docData.sessionAt || 
        docData.date;
        
    if (!dateStr) return "Sin fecha";
    
    try {
        const date = new Date(dateStr);
        if (isNaN(date.getTime())) return "Fecha inválida";
        return date.toLocaleDateString();
    } catch (e) {
        return "Fecha inválida";
    }
}
