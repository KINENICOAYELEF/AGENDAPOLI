import { useState, useRef, useCallback, useEffect } from 'react';

type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

interface UseGeminiLiveProps {
    systemInstruction?: string;
    voiceName?: string;
}

interface Parts {
    inlineData?: {
        data?: string;
        mimeType?: string;
    };
    text?: string;
}

interface ModelTurn {
    parts?: Parts[];
}

interface ServerContent {
    modelTurn?: ModelTurn;
    inputTranscription?: {
        text?: string;
    };
    outputTranscription?: {
        text?: string;
    };
    turnComplete?: boolean;
}

interface GeminiLiveMessage {
    setupComplete?: boolean;
    serverContent?: ServerContent;
}

const LIVE_MODEL = "models/gemini-3.1-flash-live-preview";

// ═══ CAPA 3: TRANSCRIPT CLEANING ═══
// Last line of defense — strip any disclaimers that slip through in the transcription.
// The audio may still play the disclaimer (we can't unsay spoken words), but the
// written transcript fed to subsequent evaluation phases will be clean.
const DISCLAIMER_PATTERNS = [
    // Direct disclaimer phrases
    /esta información no constituye consejo médico[^.]*\./gi,
    /no (puedo|debo|me es posible) (dar|proporcionar|ofrecer|brindar)[^.]*?(consejo|asesoramiento|diagnóstico|recomendaci[oó]n)[^.]*\./gi,
    /(siempre )?(busque|consulte|acuda|visite)[^.]*?profesional[^.]*\./gi,
    /es importante (que )?(acud|consult|visit)[^.]*?(médic|profesional|doctor)[^.]*\./gi,
    /(este|esta) (servicio|herramienta|plataforma|conversaci[oó]n|informaci[oó]n|contenido)[^.]*?no (proporciona|reemplaza|sustituye|constituye)[^.]*\./gi,
    /no reemplaza (la )?consulta[^.]*\./gi,
    /para (más )?informaci[oó]n[^.]*?profesional[^.]*\./gi,
    // Meta-references to simulation/acting
    /el actor[^.]*?personaje[^.]*\./gi,
    /esto es una simulaci[oó]n[^.]*\./gi,
    /soy (un modelo|una inteligencia|una IA)[^.]*\./gi,
    // Spoken Spanish variations (voice output tends to use these)
    /le recomiendo (que )?(consulte|acuda|visite|busque)[^.]*?(médic|doctor|profesional|especialista)[^.]*\./gi,
    /no estoy capacitad[oa][^.]*\./gi,
    /no tengo la capacidad[^.]*\./gi,
    /recuerde que[^.]*?profesional[^.]*\./gi,
];

function stripDisclaimers(text: string): string {
    let cleaned = text;
    for (const pattern of DISCLAIMER_PATTERNS) {
        // Reset lastIndex for global regexes reused across calls
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '');
    }
    // Collapse multiple spaces and trim
    return cleaned.replace(/\s{2,}/g, ' ').trim();
}

export function useGeminiLive({ systemInstruction, voiceName = "Aoede" }: UseGeminiLiveProps = {}) {
    const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
    const [transcript, setTranscript] = useState<{ role: 'user' | 'model', text: string }[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [volume, setVolume] = useState(0);
    const [isMicOpen, setIsMicOpen] = useState(true);

    const isMicOpenRef = useRef(true);

    const wsRef = useRef<WebSocket | null>(null);
    const audioCtxRef = useRef<AudioContext | null>(null);
    const playbackCtxRef = useRef<AudioContext | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const processorRef = useRef<ScriptProcessorNode | null>(null);
    const setupDoneRef = useRef(false);

    // Sync state with ref for audio loop
    useEffect(() => {
        isMicOpenRef.current = isMicOpen;
    }, [isMicOpen]);

    // Audio playback queue
    const playbackNextTimeRef = useRef<number>(0);

    const playAudio = useCallback((base64Audio: string) => {
        const playbackCtx = playbackCtxRef.current;
        if (!playbackCtx) return;

        const binaryString = atob(base64Audio);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const sampleRate = 24000;
        const pcm16 = new Int16Array(bytes.buffer);
        
        if (pcm16.length === 0) return;
        
        const audioBuffer = playbackCtx.createBuffer(1, pcm16.length, sampleRate);
        const channelData = audioBuffer.getChannelData(0);
        
        for (let i = 0; i < pcm16.length; i++) {
            channelData[i] = pcm16[i] / 32768.0;
        }

        const source = playbackCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(playbackCtx.destination);
        
        if (playbackNextTimeRef.current < playbackCtx.currentTime) {
            playbackNextTimeRef.current = playbackCtx.currentTime;
        }
        
        source.start(playbackNextTimeRef.current);
        playbackNextTimeRef.current += audioBuffer.duration;
        
        source.onended = () => {
            setIsSpeaking(false);
        };
    }, []);

    const handleServerMessage = useCallback((msg: GeminiLiveMessage) => {
        if (msg.serverContent) {
            const sc = msg.serverContent;

            if (sc.modelTurn && sc.modelTurn.parts) {
                setIsSpeaking(true);
                sc.modelTurn.parts.forEach((p) => {
                    if (p.inlineData && p.inlineData.data) {
                        playAudio(p.inlineData.data);
                    }
                });
            }

            // User input transcription
            if (sc.inputTranscription && sc.inputTranscription.text) {
                const fragment = sc.inputTranscription.text;
                setTranscript(prev => {
                    if (prev.length > 0 && prev[prev.length - 1].role === 'user') {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'user',
                            text: updated[updated.length - 1].text + fragment
                        };
                        return updated;
                    }
                    return [...prev, { role: 'user', text: fragment }];
                });
            }

            // Model output transcription — filter disclaimers
            if (sc.outputTranscription && sc.outputTranscription.text) {
                const fragment = sc.outputTranscription.text;
                setTranscript(prev => {
                    if (prev.length > 0 && prev[prev.length - 1].role === 'model') {
                        const updated = [...prev];
                        updated[updated.length - 1] = {
                            role: 'model',
                            text: stripDisclaimers(updated[updated.length - 1].text + fragment)
                        };
                        return updated;
                    }
                    const cleaned = stripDisclaimers(fragment);
                    if (cleaned.length === 0) return prev; // Skip empty disclaimer-only fragments
                    return [...prev, { role: 'model', text: cleaned }];
                });
            }

            if (sc.turnComplete) {
                setIsSpeaking(false);
            }
        }
    }, [playAudio]);

    const stopMicrophone = useCallback(() => {
        if (processorRef.current && audioCtxRef.current) {
            processorRef.current.disconnect();
            audioCtxRef.current.close();
            processorRef.current = null;
            audioCtxRef.current = null;
        }
        if (playbackCtxRef.current) {
            playbackCtxRef.current.close();
            playbackCtxRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startMicrophone = useCallback(async (): Promise<boolean> => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: {
                sampleRate: 16000,
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true
            } });
            streamRef.current = stream;

            const audioCtx = new AudioContext({ sampleRate: 16000 });
            audioCtxRef.current = audioCtx;

            const playbackCtx = new AudioContext({ sampleRate: 24000 });
            playbackCtxRef.current = playbackCtx;

            const source = audioCtx.createMediaStreamSource(stream);
            const processor = audioCtx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;

            source.connect(processor);
            processor.connect(audioCtx.destination);

            processor.onaudioprocess = (e) => {
                if (!setupDoneRef.current) return;
                
                const inputData = e.inputBuffer.getChannelData(0);
                
                // Volume visualization (always calculate, even when muted)
                let sum = 0;
                for (let i = 0; i < inputData.length; i++) {
                    sum += inputData[i] * inputData[i];
                }
                const rms = Math.sqrt(sum / inputData.length);
                setVolume(isMicOpenRef.current ? rms : 0);

                // Send real audio or silence depending on mic state
                const dataToSend = isMicOpenRef.current ? inputData : new Float32Array(inputData.length);

                // Convert float32 to PCM 16-bit little-endian
                const pcm16 = new Int16Array(dataToSend.length);
                for (let i = 0; i < dataToSend.length; i++) {
                    const s = Math.max(-1, Math.min(1, dataToSend[i]));
                    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
                }

                // Convert to base64
                const pcm8 = new Uint8Array(pcm16.buffer);
                let binary = '';
                const len = pcm8.byteLength;
                for (let i = 0; i < len; i++) {
                    binary += String.fromCharCode(pcm8[i]);
                }
                const b64Data = btoa(binary);

                if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
                    wsRef.current.send(JSON.stringify({
                        realtimeInput: {
                            audio: {
                                data: b64Data,
                                mimeType: "audio/pcm;rate=16000"
                            }
                        }
                    }));
                }
            };
            console.log("Microphone started. Streaming audio...");
            return true;
        } catch (e) {
            console.error("Microphone error:", e);
            return false;
        }
    }, []);

    const connect = useCallback(async () => {
        if (connectionState !== 'disconnected') return;
        setConnectionState('connecting');
        setupDoneRef.current = false;

        // Solución Android: Pedir permisos de micrófono INMEDIATAMENTE tras el click
        const micStarted = await startMicrophone();
        if (!micStarted) {
            setConnectionState('error');
            return;
        }

        let apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
        if (!apiKey) {
            console.log("No NEXT_PUBLIC_GEMINI_API_KEY found. Fetching fallback key from backend...");
            try {
                const res = await fetch('/api/ai/key');
                if (res.ok) {
                    const data = await res.json();
                    apiKey = data.apiKey;
                } else {
                    console.error("Backend API key route returned status:", res.status);
                }
            } catch (e) {
                console.error("Failed to fetch API key from backend:", e);
            }
        }

        if (!apiKey) {
            console.error("No Gemini API key found in environment or backend.");
            setConnectionState('error');
            return;
        }

        const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent?key=${apiKey}`;

        try {
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                const setupMsg = {
                    setup: {
                        model: LIVE_MODEL,
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: voiceName
                                    }
                                }
                            }
                        },
                        systemInstruction: {
                            parts: [{ text: systemInstruction || "Eres un paciente de prueba. Responde en español." }]
                        }
                    }
                };
                ws.send(JSON.stringify(setupMsg));
                console.log("Setup message sent for model:", LIVE_MODEL);
            };

            ws.onmessage = async (event) => {
                let msg;
                if (event.data instanceof Blob) {
                    const text = await event.data.text();
                    msg = JSON.parse(text);
                } else {
                    msg = JSON.parse(event.data);
                }
                
                if (msg.setupComplete) {
                    console.log("Setup complete! Sending context priming...");
                    
                    // ═══ CAPA 2: PRIMING via client_content ═══
                    // Seed a fake initial exchange so the model is ALREADY in patient
                    // mode before the student speaks their first word. This dramatically
                    // reduces the chance of disclaimers because the model's first turn
                    // is already "in character" and subsequent turns follow that pattern.
                    ws.send(JSON.stringify({
                        clientContent: {
                            turns: [
                                {
                                    role: "user",
                                    parts: [{ text: "Buenos días, soy su kinesiólogo. Cuénteme, ¿en qué le puedo ayudar hoy?" }]
                                },
                                {
                                    role: "model",
                                    parts: [{ text: "Buenos días. Mire, vengo porque me mandaron para acá por un dolor que tengo hace un tiempo ya. Ojalá me pueda ayudar." }]
                                }
                            ],
                            turnComplete: true
                        }
                    }));
                    console.log("Context priming sent. Session ready.");
                    
                    setupDoneRef.current = true;
                    setConnectionState('connected');
                    return;
                }

                handleServerMessage(msg);
            };

            ws.onerror = (err) => {
                console.error("WebSocket Error:", err);
                setConnectionState('error');
            };

            ws.onclose = (event) => {
                console.log("WebSocket Disconnected. Code:", event.code, "Reason:", event.reason);
                setConnectionState('disconnected');
                stopMicrophone();
            };

        } catch (e) {
            console.error(e);
            setConnectionState('error');
        }
    }, [systemInstruction, voiceName, connectionState, startMicrophone, handleServerMessage, stopMicrophone]);

    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
        stopMicrophone();
        setConnectionState('disconnected');
        setIsMicOpen(false);
    }, [stopMicrophone]);

    const toggleMic = useCallback(() => {
        setIsMicOpen(prev => !prev);
    }, []);

    return {
        connect,
        disconnect,
        connectionState,
        transcript,
        isSpeaking,
        volume,
        isMicOpen,
        toggleMic
    };
}
