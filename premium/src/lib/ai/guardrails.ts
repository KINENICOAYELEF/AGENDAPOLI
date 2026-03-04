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

const MEDICAL_DIAGNOSES = [
    "fractura confirmada",
    "rotura completa",
    "cáncer",
    "tumor",
    "infección sistemática"
];

export function validateGuardrails(jsonString: string): { valid: boolean; bannedTermsFound: string[] } {
    const lowerText = jsonString.toLowerCase();
    const found: string[] = [];

    for (const term of BANNED_TERMS) {
        if (lowerText.includes(term)) {
            found.push(term);
        }
    }

    for (const term of MEDICAL_DIAGNOSES) {
        if (lowerText.includes(term)) {
            found.push(term);
        }
    }

    return {
        valid: found.length === 0,
        bannedTermsFound: found
    };
}
