import { jsonrepair } from 'jsonrepair';

export interface AntigravityInteractionOptions {
    agent?: string;
    prompt: string;
    systemInstruction?: string;
}

export interface AntigravityInteractionResponse {
    id?: string;
    status?: string;
    textOutput: string;
    thoughts?: string;
    endpointUsed: string;
    rawResponse: any;
}

/**
 * Cliente REST nativo para Google Antigravity Agent Interactions API.
 * Endpoint exacto: POST https://generativelanguage.googleapis.com/v1beta/interactions
 * Headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY }
 * Body: { agent: 'antigravity-preview-05-2026', input: [{ type: 'text', text: prompt }], environment: { type: 'remote' } }
 */
export async function callAntigravityAgent(options: AntigravityInteractionOptions): Promise<AntigravityInteractionResponse> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
        throw new Error('GEMINI_API_KEY no está configurada en el entorno.');
    }

    const endpoint = 'https://generativelanguage.googleapis.com/v1beta/interactions';
    const agentName = options.agent || 'antigravity-preview-05-2026';

    const fullPrompt = options.systemInstruction 
        ? `${options.systemInstruction}\n\n=== INSTRUCCIÓN DEL USUARIO ===\n${options.prompt}`
        : options.prompt;

    const payload = {
        agent: agentName,
        input: [
            {
                type: 'text',
                text: fullPrompt
            }
        ],
        environment: {
            type: 'remote'
        }
    };

    console.log(`[Antigravity REST Request] POST ${endpoint} -> Agent: ${agentName}`);

    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        console.warn(`[Antigravity REST API Status ${response.status}] Error: ${errorText}`);
        throw new Error(`Antigravity HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();

    let textOutput = '';
    let thoughts = '';

    if (Array.isArray(data.outputs)) {
        textOutput = data.outputs
            .filter((o: any) => o.type === 'text' || o.text)
            .map((o: any) => o.text || (typeof o === 'string' ? o : JSON.stringify(o)))
            .join('\n');
    } else if (data.output?.text) {
        textOutput = data.output.text;
    } else if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
        textOutput = data.candidates[0].content.parts[0].text;
    } else {
        textOutput = typeof data === 'string' ? data : JSON.stringify(data);
    }

    if (data.thoughts) {
        thoughts = typeof data.thoughts === 'string' ? data.thoughts : JSON.stringify(data.thoughts);
    }

    return {
        id: data.id || data.name || `antigravity_interaction_${Date.now()}`,
        status: data.status || 'COMPLETED',
        textOutput,
        thoughts,
        endpointUsed: endpoint,
        rawResponse: data
    };
}
