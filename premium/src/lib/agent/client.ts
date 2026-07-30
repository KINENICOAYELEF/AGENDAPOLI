import { agentConfig } from './config';
import { GoogleGenAI } from '@google/genai';
import { deidentifyText } from './deidentify';

// Initialize the SDK. Ensure NEXT_PUBLIC_GEMINI_API_KEY is available or set it appropriately
// In a server environment, you'd typically use process.env.GEMINI_API_KEY
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

export async function runAgent(prompt: string, context?: any) {
  const deidentifiedContext = context ? deidentifyText(JSON.stringify(context)) : '';
  const finalPrompt = `
Contexto:
${deidentifiedContext}

Instrucción:
${prompt}
  `;

  try {
    const response = await ai.models.generateContent({
      model: agentConfig.model,
      contents: finalPrompt,
      config: {
        systemInstruction: agentConfig.system_instruction,
      }
    });

    return {
      status: 'success',
      result: response.text,
    };
  } catch (error: any) {
    console.error('Agent execution error:', error);
    return {
      status: 'error',
      message: error.message || 'Error executing agent',
    };
  }
}
