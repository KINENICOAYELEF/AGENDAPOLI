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
    | 'GENERAL';

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

    if (screen === 'P1' || aiAction === 'FASE1' || aiAction === 'EVAL_MINIMO' || aiAction === 'P1_SYNTHESIS') {
        cacheBucket = 'p1_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview' },
            { modelId: 'gemini-2.5-flash-lite' },
            { modelId: 'gemini-2.5-flash' }
        ];
    } 
    else if (screen === 'P3' || aiAction === 'P3_SYNTHESIS') {
        cacheBucket = 'p3_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview', thinkingLevel: 'low' },
            { modelId: 'gemini-3.1-flash-lite', thinkingLevel: 'low' },
            { modelId: 'gemini-2.5-flash' }
        ];
    } 
    else if (screen === 'P4' && aiAction === 'P4_BASE') {
        cacheBucket = 'p4_base_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview', thinkingLevel: 'low' },
            { modelId: 'gemini-3.1-flash-lite', thinkingLevel: 'low' },
            { modelId: 'gemini-2.5-flash' }
        ];
    }
    else if (screen === 'P4' && aiAction === 'P4_PREMIUM') {
        cacheBucket = 'p4_premium_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3-flash-preview', thinkingLevel: 'medium' },
            { modelId: 'gemini-3-flash', thinkingLevel: 'medium' },
            { modelId: 'gemini-2.5-flash' }
        ];
    }
    else {
        // Fallback for SUGGEST, GENERAL, PLAN
        cacheBucket = 'general_ai_cache';
        orderedModels = [
            { modelId: 'gemini-3.1-flash-lite-preview', thinkingLevel: 'low' },
            { modelId: 'gemini-2.5-flash-lite', thinkingBudget: 1024 },
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
