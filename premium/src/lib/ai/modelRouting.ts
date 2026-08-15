export type AIAction = 
    | 'P1_SYNTHESIS'
    | 'P1_EXTRACT' 
    | 'P1_QUESTIONS' 
    | 'P1_EXAM' 
    | 'P3_SYNTHESIS' 
    | 'P4_BASE' 
    | 'P4_PREMIUM'
    | 'EVAL_MINIMO'
    | 'FASE1'
    | 'PLAN'
    | 'SUGGEST'
    | 'GENERAL'
    | 'SIM_GENERATE'
    | 'SIM_INTERVIEW'
    | 'SIM_INTERVIEW_FEEDBACK'
    | 'SIM_EXAM'
    | 'SIM_EVALUATE'
    | 'SIM_COMMISSION'
    | 'SIM_EVAL_DEFENSE'
    | 'SIM_EVAL_TRAINING'
    | 'SUPER_PROFILE_SYNTHESIS'
    | 'EXPRESS_STRUCTURE'
    | 'EXPRESS_GROUNDING'
    | 'EXPRESS_PLAN';

export interface ModelRoute {
    modelId: string;
    thinkingLevel?: 'low' | 'medium' | 'high';
    thinkingBudget?: number;
}

export interface RouteResolution {
    orderedModels: ModelRoute[];
    cacheBucket: string;
    allowStructuredOutput: boolean;
    maxRetries: number;
}

export function resolveModelRoute(screen: string, aiAction: AIAction): RouteResolution {
    let orderedModels: ModelRoute[] = [];
    let cacheBucket = '';
    const allowStructuredOutput = true;
    const maxRetries = 1; // 1 retry per model, max 3 tries total handles by array len

    if (screen === 'P1' || aiAction === 'FASE1' || aiAction === 'EVAL_MINIMO' || aiAction === 'P1_SYNTHESIS' || aiAction === 'EXPRESS_STRUCTURE' || aiAction === 'EXPRESS_GROUNDING') {
        cacheBucket = 'p1_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview' },
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-2.5-flash' }
        ];
    } 
    else if (screen === 'P3' || aiAction === 'P3_SYNTHESIS') {
        cacheBucket = 'p3_ai_cache';
        // gemini-3.1-flash-lite-preview SIN thinkingConfig (lite no lo soporta)
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview' },
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-2.5-flash' }
        ];
    } 
    // NOTA SOBRE EL ORDEN EN LAS PANTALLAS DE PLAN (P4 y Express):
    // El plan de tratamiento es lo que más se beneficia de un modelo con
    // razonamiento, así que gemini-3-flash-preview sigue yendo primero. Pero
    // rinde 20 peticiones diarias, igual que gemini-2.5-flash, que antes iba
    // segundo: agotado el primero se quemaba una llamada más antes de llegar a
    // un modelo con cupo. Y como executeAIAction corta a los 3 intentos, el
    // cuarto de la lista nunca se alcanzaba. Ahora el respaldo inmediato es un
    // Lite de 500/día, que es el que de verdad va a responder el resto del día.
    else if (screen === 'P4' && aiAction === 'P4_BASE') {
        cacheBucket = 'p4_base_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3-flash-preview', thinkingLevel: 'low' },
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-3.1-flash-lite-preview' }
        ];
    }
    else if (screen === 'EXPRESS_V2' && aiAction === 'EXPRESS_PLAN') {
        cacheBucket = 'express_plan_cache';
        orderedModels = [
            { modelId: 'gemini-3-flash-preview', thinkingLevel: 'medium' },
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-3.1-flash-lite-preview' }
        ];
    }
    else if (screen === 'P4' && aiAction === 'P4_PREMIUM') {
        cacheBucket = 'p4_premium_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3-flash-preview', thinkingLevel: 'medium' },
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-3.1-flash-lite-preview' }
        ];
    }
    else if (screen === 'SIMULADOR') {
        cacheBucket = 'sim_ai_cache';
        // Es la pantalla de mayor volumen: necesita el respaldo más ancho.
        orderedModels = [
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-3.1-flash-lite-preview' },
            { modelId: 'gemini-2.5-flash' },
        ];
    }
    else {
        // Fallback for SUGGEST, GENERAL, PLAN
        cacheBucket = 'general_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview' },
            { modelId: 'gemini-3.5-flash-lite' },
            { modelId: 'gemini-2.5-flash', thinkingBudget: 2048 }
        ];
    }

    return {
        orderedModels,
        cacheBucket,
        allowStructuredOutput,
        maxRetries
    };
}
