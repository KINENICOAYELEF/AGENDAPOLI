import { NextResponse } from 'next/server';
import { executeAIAction } from '@/lib/ai/geminiClient';
import { SIM_EVAL_SUPER_PROFILE_PROMPT } from '@/lib/ai/simuladorPrompts';
import { SimSuperProfileSchema } from '@/lib/ai/simuladorSchemas';
import { getSuperProfile, saveSuperProfile } from '@/services/superProfileService';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { action, userId, estudianteNombre, recentTranscript, recentErrors } = body;

        if (!userId) {
            return NextResponse.json({ error: 'MISSING_USER_ID', message: 'userId es requerido.' }, { status: 400 });
        }

        const currentProfile = await getSuperProfile(userId, estudianteNombre || 'Interno');

        if (action === 'SYNTHESIZE') {
            const userPrompt = `
PERFIL SUPERIOR PREVIO EN FIRESTORE:
${JSON.stringify(currentProfile)}

NUEVA TRANSCRIPCIÓN DE SESIÓN / DESEMPEÑO RECIENTE:
${recentTranscript || '(Sin transcripción adicional)'}

DETALLE DE ERRORES/ACIERTOS RECIENTES:
${JSON.stringify(recentErrors || [])}

Analiza de manera holística el desempeño longitudinal del estudiante.
Calcula sus nuevos puntajes en los 3 Pilares (Entrevista, Examen Físico, Intervención), clasifica su Nivel Cognitivo (NOVATO, INTERMEDIO o RESIDENTE), actualiza el estado de las EPAs y genera la directiva 'miniPromptDinamico' de 3-5 líneas para sus próximas sesiones por voz.
`;

            const result = await executeAIAction({
                screen: 'SIMULADOR',
                action: 'SUPER_PROFILE_SYNTHESIS',
                systemInstruction: SIM_EVAL_SUPER_PROFILE_PROMPT,
                userPrompt,
                inputHash: `super_profile_${Date.now()}_${userId}`,
                promptVersion: 'super_v1',
                temperature: 0.2,
                validator: (data) => SimSuperProfileSchema.parse(data),
                skipGuardrails: true,
            });

            const updatedData = result.data;
            const finalProfile = {
                ...currentProfile,
                nivelCognitivo: updatedData.nivelCognitivo,
                pilares: updatedData.pilares,
                epas: updatedData.epas,
                sesgosCognitivosDetectados: updatedData.sesgosCognitivosDetectados || [],
                fortalezasLongitudinales: updatedData.fortalezasLongitudinales || [],
                brechasLongitudinales: updatedData.brechasLongitudinales || [],
                miniPromptDinamico: updatedData.miniPromptDinamico || currentProfile.miniPromptDinamico,
                totalSimulacionesCompletadas: (currentProfile.totalSimulacionesCompletadas || 0) + 1,
                fechaUltimaSintesis: new Date().toISOString()
            };

            await saveSuperProfile(userId, finalProfile);

            return NextResponse.json({
                success: true,
                profile: finalProfile
            });
        }

        return NextResponse.json({
            success: true,
            profile: currentProfile
        });

    } catch (err: any) {
        console.error('[SuperProfile API Error]', err);
        return NextResponse.json({
            error: 'INTERNAL_ERROR',
            message: err.message || 'Error sintetizando Super Profile.'
        }, { status: 500 });
    }
}
