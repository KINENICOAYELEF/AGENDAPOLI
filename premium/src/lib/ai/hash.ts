// utilidades para normalización y hash
export async function generateSHA256(input: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function normalizePayload(payload: any): string {
    // Ordena las keys recurrentemente para evitar falsos negativos en el cache
    const stringifySorted = (obj: any): string => {
        if (obj === null) return 'null';
        if (typeof obj !== 'object') return JSON.stringify(obj);
        if (Array.isArray(obj)) return `[${obj.map(stringifySorted).join(',')}]`;
        const sortedKeys = Object.keys(obj).sort();
        const sortedObj = sortedKeys.reduce((acc, key) => {
            acc[key] = obj[key];
            return acc;
        }, {} as any);
        return JSON.stringify(sortedObj);
    };
    return stringifySorted(payload);
}
