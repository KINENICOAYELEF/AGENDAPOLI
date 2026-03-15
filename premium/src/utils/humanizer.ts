export const codeToHumanMap: Record<string, string> = {
    // Sleep
    "poor": "Mala / Pobre",
    "ok": "Regular / OK",
    "good": "Buena / Reparadora",

    // Stress / Mood
    "high": "Alto",
    "med": "Medio",
    "low": "Bajo",

    // Activity Levels
    "level_1": "Sedentario",
    "level_2": "Ocasional",
    "level_3": "Amateur / Recreativo",
    "level_4": "Amateur Competitivo",
    "level_5": "Profesional",
    "level_6": "Élite",

    // Occupations & Logistics (from checkboxes or enums)
    "timeBarrier": "Barrera: Falta de tiempo",
    "transportBarrier": "Barrera: Transporte difícil",
    "gymAccess": "Barrera: Sin acceso a gimnasio",
    "equipmentAccess": "Barrera: Sin equipamiento en casa",

    "standing": "Bipedestación prolongada",
    "sitting": "Sedente prolongado",
    "lifting": "Levantamiento de cargas",
    "repetitive": "Movimientos repetitivos",

    // General fallback for booleans/raws if needed
    "true": "Sí",
    "false": "No"
};

/**
 * Convierte un código interno a texto humano. Si no lo encuentra, asume que ya
 * está en formato humano y devuelve el mismo texto capitalizado si es posible.
 */
export function humanize(code: string | boolean | null | undefined): string {
    if (code === null || code === undefined || code === "") return "-";
    
    const strCode = String(code);
    
    // Exact match
    if (codeToHumanMap[strCode]) {
        return codeToHumanMap[strCode];
    }
    
    // Lowercase match
    const lowerCode = strCode.toLowerCase();
    if (codeToHumanMap[lowerCode]) {
        return codeToHumanMap[lowerCode];
    }

    // Return original, maybe capitalized first letter if it doesn't look like a long sentence
    if (strCode.length < 20 && !strCode.includes(" ")) {
        return strCode.charAt(0).toUpperCase() + strCode.slice(1);
    }
    
    return strCode;
}
