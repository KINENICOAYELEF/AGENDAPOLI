const BANNED_TERMS = [
    "fármaco",
    "farmaco",
    "medicamento",
    "medicacion",
    "medicación",
    "punción seca",
    "puncion seca",
    "dry needling",
    "taping",
    "vendaje neuromuscular",
    "kinesiotape",
    "electroterapia",
    "emg",
    "tens",
    "corrientes interferenciales",
    "ultrasonido terapeutico",
    "medicamentos",
    "paracetamol",
    "ibuprofeno",
    "aintiinflamatorio"
];

const MEDICAL_DIAGNOSES: string[] = [
    // Se removieron bloqueos estrictos como "rotura completa", "cáncer", etc.
    // para no bloquear la síntesis si el paciente reporta estos antecedentes legítimos.
];

export function validateGuardrails(jsonString: string): { valid: boolean; bannedTermsFound: string[] } {
    const lowerText = jsonString.toLowerCase();
    const found: string[] = [];

    // Use regex with word boundaries to only match standalone words, not accidental substrings 
    // Example: "tens" should NOT block "intensidad" or "extensión".
    for (const term of BANNED_TERMS) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(lowerText)) {
            found.push(term);
        }
    }

    for (const term of MEDICAL_DIAGNOSES) {
        const regex = new RegExp(`\\b${term}\\b`, 'i');
        if (regex.test(lowerText)) {
            found.push(term);
        }
    }

    return {
        valid: found.length === 0,
        bannedTermsFound: found
    };
}
