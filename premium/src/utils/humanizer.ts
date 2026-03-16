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
    "tiempo": "Barrera: Falta de tiempo",
    "transporte": "Barrera: Transporte difícil u horarios",
    "dinero": "Barrera: Factor económico",
    "turnos": "Barrera: Turnos rotativos o extenuantes",
    "distancia": "Barrera: Distancia / Lejanía",
    "apoyo": "Barrera: Falta de red de apoyo",
    "otra": "Otra barrera",
    
    // Matriz de Carga Laboral
    "bajo": "Bajo / Nulo",
    "medio": "Medio / Mixto",
    "alto": "Alto / Prolongado",
    "no": "No / Nada",
    "ocasional": "Ocasional Liviano",
    "frecuente_pesado": "Frecuente Pesado",
    "ms_sup": "MMSS (Teclado/Fábrica)",
    "ms_inf": "MMII",

    // Turnos
    "diurna_fija": "Diurna Fija",
    "turnos_rotativos": "Turnos Rotativos (Día/Noche)",
    "independiente": "Flexible / Freelance",

    // Contexto Domiciliario
    "escaleras": "Barrera entorno: Escaleras",
    "traslado_largo": "Barrera entorno: Traslado largo",
    "rural": "Barrera entorno: Zona rural/lejana",
    "espacio": "Barrera entorno: Poco espacio en casa",
    "sin_implementos": "Barrera entorno: Sin implementos",
    
    // Tabaquismo
    "ex_fumador": "Ex Fumador",
    "fuma_social": "Fuma Ocasional/Social",
    "fuma_diario": "Fuma Diario",
    "1_5": "1 a 5 diarios",
    "6_10": "6 a 10 diarios",
    "mas_10": "Más de 10 diarios",
    "variable": "Variable",

    // Animo y Soporte
    "fluctuating": "Fluctuante",
    "buena": "Buena / Habitual",
    "intermitente": "Intermitente",
    "baja": "Baja / Suele abandonar",

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
