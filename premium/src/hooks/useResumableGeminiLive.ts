'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { GoogleGenAI, type Session, type LiveServerMessage } from '@google/genai';
import { auth } from '@/lib/firebase';
import type { TranscriptTurn, VoiceStationKey } from '@/lib/simulador-estaciones/types';

type LiveState = 'IDLE' | 'REQUESTING_MIC' | 'CONNECTING' | 'CONNECTED' | 'RECONNECTING' | 'ERROR';

type TokenPayload = {
  token: string;
  model: string;
  expiresAt: string;
  resumed: boolean;
  openingInstruction: string;
  promptVersion: string;
};

type Props = {
  sessionId: string;
  station: VoiceStationKey;
  initialTranscript?: TranscriptTurn[];
  listenOnly?: boolean;
  onResumeHandle?: (handle: string, promptVersion: string) => Promise<void> | void;
  onReconnectCount?: (count: number) => void;
  onBeforeReconnect?: () => Promise<void> | void;
};

function joinFragment(turns: TranscriptTurn[], role: TranscriptTurn['role'], text: string, startedAt: number, forceNew = false) {
  const normalized = text.replace(/\s+/g, ' ');
  if (!normalized.trim()) return turns;
  const previous = turns.at(-1);
  if (!forceNew && previous?.role === role) {
    const updated = [...turns];
    updated[updated.length - 1] = {
      ...previous,
      text: `${previous.text}${normalized}`.replace(/\s+/g, ' ').trim(),
    };
    return updated;
  }
  return [
    ...turns,
    {
      id: crypto.randomUUID(),
      role,
      text: normalized.trim(),
      atMs: Math.max(0, Date.now() - startedAt),
    },
  ];
}

function pcmFloatToBase64(samples: Float32Array) {
  const pcm = new Int16Array(samples.length);
  for (let index = 0; index < samples.length; index += 1) {
    const bounded = Math.max(-1, Math.min(1, samples[index]));
    pcm[index] = bounded < 0 ? bounded * 0x8000 : bounded * 0x7fff;
  }
  const bytes = new Uint8Array(pcm.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

export function useResumableGeminiLive({
  sessionId,
  station,
  initialTranscript = [],
  listenOnly = false,
  onResumeHandle,
  onReconnectCount,
  onBeforeReconnect,
}: Props) {
  const [state, setState] = useState<LiveState>('IDLE');
  const [transcript, setTranscript] = useState<TranscriptTurn[]>(initialTranscript);
  const [volume, setVolume] = useState(0);
  const [isMicOpen, setIsMicOpen] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [error, setError] = useState('');
  const [reconnectCount, setReconnectCount] = useState(0);
  const [activeModel, setActiveModel] = useState('');
  const [completedTurns, setCompletedTurns] = useState(0);
  const [audioHealth, setAudioHealth] = useState('');
  const [usingFallbackVoice, setUsingFallbackVoice] = useState(false);

  const liveSessionRef = useRef<Session | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const inputContextRef = useRef<AudioContext | null>(null);
  const outputContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const playbackTimeRef = useRef(0);
  const activeAudioRef = useRef(0);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const manualCloseRef = useRef(false);
  const connectingRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const micOpenRef = useRef(true);
  const startedAtRef = useRef(Date.now());
  const openingSentRef = useRef(false);
  const inputNeedsNewTurnRef = useRef(true);
  const outputNeedsNewTurnRef = useRef(true);
  const currentModelRef = useRef('');
  const promptVersionRef = useRef('');
  const failedModelsRef = useRef<Set<string>>(new Set());
  const gracefulGoAwayRef = useRef(false);
  const listenOnlyRef = useRef(listenOnly);
  listenOnlyRef.current = listenOnly;
  const outputTextRef = useRef('');
  const receivedPcmRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackSpeakingRef = useRef(false);
  const controlTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingControlRef = useRef<{ text: string; retries: number } | null>(null);
  const sendControlRef = useRef<(text: string, retry?: boolean) => boolean>(() => false);
  const generationRef = useRef(0);
  const setupReadyRef = useRef(false);
  const lastFrameRef = useRef(0);
  const callbacksRef = useRef({ onResumeHandle, onReconnectCount, onBeforeReconnect });
  callbacksRef.current = { onResumeHandle, onReconnectCount, onBeforeReconnect };
  const reconnectRef = useRef<(retry: boolean) => Promise<void>>(async () => {});

  useEffect(() => {
    micOpenRef.current = isMicOpen;
  }, [isMicOpen]);

  useEffect(() => {
    setTranscript(initialTranscript);
  }, [sessionId, station]); // eslint-disable-line react-hooks/exhaustive-deps

  const getToken = useCallback(async (): Promise<TokenPayload> => {
    const idToken = await auth.currentUser?.getIdToken();
    if (!idToken) throw new Error('Tu sesión de acceso expiró. Vuelve a iniciar sesión.');
    const response = await fetch(`/api/simulador-estaciones/sessions/${sessionId}/live-token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ station, excludeModels: [...failedModelsRef.current] }),
    });
    const payload = await response.json();
    if (!response.ok || !payload.ok) throw new Error(payload.error || 'No se pudo abrir el canal de voz.');
    return payload.data;
  }, [sessionId, station]);

  const stopPlayback = useCallback(() => {
    if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
    if (fallbackSpeakingRef.current && typeof speechSynthesis !== 'undefined') speechSynthesis.cancel();
    fallbackSpeakingRef.current = false;
    setUsingFallbackVoice(false);
    outputTextRef.current = '';
    receivedPcmRef.current = false;
    audioSourcesRef.current.forEach((source) => {
      source.onended = null;
      try { source.stop(); } catch { /* La fuente ya pudo terminar. */ }
    });
    audioSourcesRef.current.clear();
    activeAudioRef.current = 0;
    playbackTimeRef.current = outputContextRef.current?.currentTime || 0;
    setIsSpeaking(false);
  }, []);

  const playAudio = useCallback((base64: string) => {
    const context = outputContextRef.current;
    if (!context || !base64) return;
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
    const pcm = new Int16Array(bytes.buffer);
    if (!pcm.length) return;
    const buffer = context.createBuffer(1, pcm.length, 24000);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 32768;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    playbackTimeRef.current = Math.max(playbackTimeRef.current, context.currentTime);
    source.start(playbackTimeRef.current);
    playbackTimeRef.current += buffer.duration;
    audioSourcesRef.current.add(source);
    activeAudioRef.current += 1;
    setIsSpeaking(true);
    source.onended = () => {
      audioSourcesRef.current.delete(source);
      activeAudioRef.current = Math.max(0, activeAudioRef.current - 1);
      if (activeAudioRef.current === 0) setIsSpeaking(false);
    };
  }, []);

  const handleMessage = useCallback((message: LiveServerMessage) => {
    if (message.serverContent?.interrupted) stopPlayback();
    const content = message.serverContent;
    if (content?.outputTranscription?.text || content?.modelTurn?.parts?.some((part) => part.inlineData?.data)) {
      if (controlTimerRef.current) clearTimeout(controlTimerRef.current);
      pendingControlRef.current = null;
    }
    // Igual que el simulador OSCE: procesar todas las partes, también cuando
    // Gemini envía audio y transcripciones juntos en un mismo evento.
    for (const part of content?.modelTurn?.parts || []) {
      if (part.inlineData?.data) {
        receivedPcmRef.current = true;
        if (fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
        if (!listenOnlyRef.current) playAudio(part.inlineData.data);
      }
    }
    if (content?.inputTranscription?.text) {
      if (inputNeedsNewTurnRef.current && fallbackTimerRef.current) clearTimeout(fallbackTimerRef.current);
      const newTurn = inputNeedsNewTurnRef.current;
      setTranscript((current) => joinFragment(current, 'STUDENT', content.inputTranscription!.text!, startedAtRef.current, newTurn));
      inputNeedsNewTurnRef.current = false;
    }
    if (!listenOnlyRef.current && content?.outputTranscription?.text) {
      outputTextRef.current += content.outputTranscription.text;
      const role: TranscriptTurn['role'] = station === 'ANAMNESIS_PROXIMA' || station === 'ANAMNESIS_REMOTA' ? 'PATIENT' : 'EXAMINER';
      const newTurn = outputNeedsNewTurnRef.current;
      setTranscript((current) => joinFragment(current, role, content.outputTranscription!.text!, startedAtRef.current, newTurn));
      outputNeedsNewTurnRef.current = false;
    }
    if (content?.turnComplete) {
      const textOnlyReply = outputTextRef.current.trim();
      const shouldFallback = Boolean(textOnlyReply && !receivedPcmRef.current && !listenOnlyRef.current);
      if (shouldFallback) {
        setIsSpeaking(true);
        const generation = generationRef.current;
        fallbackTimerRef.current = setTimeout(() => {
          if (manualCloseRef.current || generation !== generationRef.current || listenOnlyRef.current) return;
          if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') {
            setError('La respuesta llegó escrita, pero no se recibió audio. Está disponible en la transcripción.');
            setIsSpeaking(false);
            return;
          }
          // Lee exactamente la salida recibida; no genera otra respuesta clínica.
          const utterance = new SpeechSynthesisUtterance(textOnlyReply);
          utterance.lang = 'es-CL';
          fallbackSpeakingRef.current = true;
          setUsingFallbackVoice(true);
          setIsSpeaking(true);
          const done = () => { fallbackSpeakingRef.current = false; setUsingFallbackVoice(false); setIsSpeaking(false); };
          utterance.onend = done;
          utterance.onerror = done;
          speechSynthesis.speak(utterance);
        }, 700);
      }
      outputTextRef.current = '';
      receivedPcmRef.current = false;
      setCompletedTurns((count) => count + 1);
      inputNeedsNewTurnRef.current = true;
      outputNeedsNewTurnRef.current = true;
      if (activeAudioRef.current === 0 && !shouldFallback) setIsSpeaking(false);
    }
    const handle = message.sessionResumptionUpdate?.newHandle;
    if (handle && message.sessionResumptionUpdate?.resumable !== false) {
      void Promise.resolve(callbacksRef.current.onResumeHandle?.(handle, promptVersionRef.current)).catch(() => {
        setError('No se pudo guardar el punto de reconexión. Se conserva la transcripción.');
      });
    }
    if (message.goAway) {
      gracefulGoAwayRef.current = true;
      setState('RECONNECTING');
      liveSessionRef.current?.close();
    }
  }, [playAudio, station, stopPlayback]);

  const openLiveSession = useCallback(async (isReconnect: boolean) => {
    if (connectingRef.current || manualCloseRef.current) return;
    connectingRef.current = true;
    const generation = ++generationRef.current;
    setupReadyRef.current = false;
    let closed = false;
    let stableTimer: ReturnType<typeof setTimeout> | undefined;
    let setupTimer: ReturnType<typeof setTimeout> | undefined;
    const recover = () => {
      if (closed || generation !== generationRef.current || manualCloseRef.current) return;
      closed = true;
      clearTimeout(stableTimer);
      clearTimeout(setupTimer);
      setupReadyRef.current = false;
      connectingRef.current = false;
      liveSessionRef.current = null;
      stopPlayback();
      const attempt = ++reconnectAttemptRef.current;
      if (attempt > 5) {
        setState('ERROR');
        setError('No se pudo recuperar la voz. El reloj está detenido. Reintenta la conexión.');
        return;
      }
      setReconnectCount((count) => count + 1);
      setState('RECONNECTING');
      reconnectTimerRef.current = setTimeout(() => {
        void Promise.resolve(callbacksRef.current.onBeforeReconnect?.())
          .catch(() => setError('El guardado está pendiente. No cierres esta pestaña.'))
          .then(() => reconnectRef.current(true));
      }, Math.min(8000, 500 * (2 ** (attempt - 1))));
    };
    setError('');
    setState(isReconnect ? 'RECONNECTING' : 'CONNECTING');
    try {
      const token = await getToken();
      if (generation !== generationRef.current || manualCloseRef.current) return;
      currentModelRef.current = token.model;
      promptVersionRef.current = token.promptVersion;
      setActiveModel(token.model);
      const ai = new GoogleGenAI({
        apiKey: token.token,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      const sendOpening = () => {
        if (setupReadyRef.current && liveSessionRef.current && pendingControlRef.current) {
          sendControlRef.current(pendingControlRef.current.text, true);
          return;
        }
        if (setupReadyRef.current && liveSessionRef.current && token.openingInstruction && !token.resumed && !openingSentRef.current) {
          openingSentRef.current = true;
          liveSessionRef.current.sendRealtimeInput({ text: token.openingInstruction });
        }
      };
      const session = await ai.live.connect({
        model: token.model,
        callbacks: {
          onopen: () => {}, // Socket abierto no implica que Gemini acepte audio.
          onmessage: (message) => {
            if (closed || generation !== generationRef.current || manualCloseRef.current) return;
            if (message.setupComplete) {
              setupReadyRef.current = true;
              clearTimeout(setupTimer);
              setState('CONNECTED');
              sendOpening();
              // Un socket que abre y cae inmediatamente no reinicia el presupuesto.
              stableTimer = setTimeout(() => { if (generation === generationRef.current) reconnectAttemptRef.current = 0; }, 30000);
            }
            handleMessage(message);
          },
          onerror: (event) => {
            if (generation !== generationRef.current) return;
            console.error('[simulador-estaciones] Live error', event);
            try { liveSessionRef.current?.close(); } catch { /* onclose gestiona el reintento. */ }
            recover();
          },
          onclose: () => {
            if (closed || generation !== generationRef.current || manualCloseRef.current) return;
            if (!gracefulGoAwayRef.current && currentModelRef.current) {
              failedModelsRef.current.add(currentModelRef.current);
              // Solo existen dos modelos Live verificados. Tras probar ambos se
              // reinicia el ciclo para tolerar fallos de red transitorios.
              if (failedModelsRef.current.size >= 2) failedModelsRef.current.clear();
            }
            gracefulGoAwayRef.current = false;
            recover();
          },
        },
      });
      if (closed || generation !== generationRef.current || manualCloseRef.current) {
        session.close();
        return;
      }
      liveSessionRef.current = session;
      if (!setupReadyRef.current) setupTimer = setTimeout(() => { session.close(); recover(); }, 12000);
      sendOpening();
    } catch (reason) {
      const message = String((reason as Error)?.message || reason);
      if (currentModelRef.current) {
        failedModelsRef.current.add(currentModelRef.current);
        if (failedModelsRef.current.size >= 2) failedModelsRef.current.clear();
      }
      if (generation !== generationRef.current || manualCloseRef.current) return;
      if (isReconnect) {
        recover();
      } else {
        setState('ERROR');
        setError(message);
      }
    } finally {
      if (generation === generationRef.current) connectingRef.current = false;
    }
  }, [getToken, handleMessage, stopPlayback]);
  reconnectRef.current = openLiveSession;

  useEffect(() => { callbacksRef.current.onReconnectCount?.(reconnectCount); }, [reconnectCount]);

  const ensureMicrophone = useCallback(async () => {
    // Crear/reanudar dentro del clic, antes de cualquier petición HTTP.
    const inputContext = inputContextRef.current ?? new AudioContext({ sampleRate: 16000 });
    const outputContext = outputContextRef.current ?? new AudioContext({ sampleRate: 24000 });
    inputContextRef.current = inputContext;
    outputContextRef.current = outputContext;
    await Promise.all([inputContext.resume(), outputContext.resume()]);
    if (streamRef.current?.active) return;
    setState('REQUESTING_MIC');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: 16000,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.current = stream;
    const source = inputContext.createMediaStreamSource(stream);
    const processor = inputContext.createScriptProcessor(4096, 1, 1);
    sourceRef.current = source;
    processorRef.current = processor;
    source.connect(processor);
    processor.connect(inputContext.destination);
    processor.onaudioprocess = (event) => {
      lastFrameRef.current = Date.now();
      const samples = event.inputBuffer.getChannelData(0);
      let energy = 0;
      for (let index = 0; index < samples.length; index += 1) energy += samples[index] ** 2;
      setVolume(micOpenRef.current ? Math.sqrt(energy / samples.length) : 0);
      const session = liveSessionRef.current;
      // No descartamos el micrófono durante la reproducción. Ese bloqueo
      // podía comerse frases completas si el estudiante empezaba apenas
      // terminaba de hablar el paciente. La cancelación de eco del navegador
      // y las reglas de turnos se encargan de diferenciar la voz reproducida.
      if (!session || !setupReadyRef.current || !micOpenRef.current) return;
      try {
        session.sendRealtimeInput({
          audio: {
            data: pcmFloatToBase64(samples),
            mimeType: `audio/pcm;rate=${inputContext.sampleRate}`,
          },
        });
      } catch {
        setAudioHealth('El audio no se está enviando. Reconecta la voz; el reloj se detendrá.');
        session.close();
      }
    };
  }, []);

  const connect = useCallback(async () => {
    manualCloseRef.current = false;
    startedAtRef.current = Date.now();
    failedModelsRef.current.clear();
    setIsMicOpen(true);
    micOpenRef.current = true;
    try {
      await ensureMicrophone();
      await openLiveSession(false);
    } catch (reason) {
      setState('ERROR');
      setError(String((reason as Error)?.message || reason));
    }
  }, [ensureMicrophone, openLiveSession]);

  const disconnect = useCallback((stopMic = true) => {
    manualCloseRef.current = true;
    generationRef.current += 1;
    setupReadyRef.current = false;
    connectingRef.current = false;
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
    if (controlTimerRef.current) clearTimeout(controlTimerRef.current);
    if (stopMic) pendingControlRef.current = null;
    try {
      liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true });
      liveSessionRef.current?.close();
    } catch {
      // Cierre idempotente.
    }
    liveSessionRef.current = null;
    stopPlayback();
    if (stopMic) {
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      void inputContextRef.current?.close();
      void outputContextRef.current?.close();
      streamRef.current?.getTracks().forEach((track) => track.stop());
      processorRef.current = null;
      sourceRef.current = null;
      inputContextRef.current = null;
      outputContextRef.current = null;
      streamRef.current = null;
    }
    setState('IDLE');
    setIsSpeaking(false);
    setVolume(0);
    setAudioHealth('');
  }, [stopPlayback]);

  const retry = useCallback(async () => {
    disconnect(false);
    manualCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    await ensureMicrophone();
    await openLiveSession(true);
  }, [disconnect, ensureMicrophone, openLiveSession]);

  const sendText = useCallback((text: string, retry = false) => {
    if (!liveSessionRef.current || !setupReadyRef.current) return false;
    try {
      if (controlTimerRef.current) clearTimeout(controlTimerRef.current);
      pendingControlRef.current = { text, retries: retry ? (pendingControlRef.current?.retries || 0) + 1 : 0 };
      liveSessionRef.current.sendRealtimeInput({ text });
      controlTimerRef.current = setTimeout(() => {
        const pending = pendingControlRef.current;
        if (!pending || manualCloseRef.current) return;
        if (pending.retries >= 1) {
          pendingControlRef.current = null;
          setError('Gemini no respondió al control de esta etapa. Puedes reconectar; el cierre conservará la incidencia de audio.');
          return;
        }
        // Un único reintento tras reconectar, nunca un bucle de prompts.
        gracefulGoAwayRef.current = true;
        liveSessionRef.current?.close();
      }, 12000);
      return true;
    } catch { return false; }
  }, []);
  sendControlRef.current = sendText;

  const toggleMic = useCallback(() => {
    const next = !micOpenRef.current;
    micOpenRef.current = next;
    setIsMicOpen(next);
    if (!next) {
      setVolume(0);
      try { liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* La reconexión mantiene el estado. */ }
    } else {
      void inputContextRef.current?.resume();
      void outputContextRef.current?.resume();
    }
  }, []);

  useEffect(() => () => disconnect(true), [disconnect]);

  useEffect(() => {
    if (state !== 'CONNECTED') return;
    const timer = setInterval(() => {
      const suspended = inputContextRef.current?.state !== 'running' || outputContextRef.current?.state !== 'running';
      const noFrames = lastFrameRef.current > 0 && Date.now() - lastFrameRef.current > 3000;
      const ended = streamRef.current?.getAudioTracks().every((track) => track.readyState === 'ended');
      setAudioHealth(suspended || noFrames || ended
        ? 'El navegador detuvo el audio. Pulsa “Reconectar voz” para recuperarlo.' : '');
    }, 1000);
    return () => clearInterval(timer);
  }, [state]);

  return {
    state,
    transcript,
    volume,
    isMicOpen,
    isSpeaking,
    error,
    reconnectCount,
    activeModel,
    completedTurns,
    audioHealth,
    usingFallbackVoice,
    prepareMicrophone: ensureMicrophone,
    connect,
    retry,
    disconnect,
    sendText,
    toggleMic,
  };
}
