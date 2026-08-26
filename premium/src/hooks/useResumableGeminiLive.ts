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
};

type Props = {
  sessionId: string;
  station: VoiceStationKey;
  initialTranscript?: TranscriptTurn[];
  onResumeHandle?: (handle: string) => Promise<void> | void;
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
  const failedModelsRef = useRef<Set<string>>(new Set());
  const gracefulGoAwayRef = useRef(false);

  useEffect(() => {
    micOpenRef.current = isMicOpen;
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = isMicOpen;
    });
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
    audioSourcesRef.current.forEach((source) => {
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
    if (message.data) playAudio(message.data);
    const content = message.serverContent;
    if (content?.inputTranscription?.text) {
      setTranscript((current) => joinFragment(current, 'STUDENT', content.inputTranscription!.text!, startedAtRef.current, inputNeedsNewTurnRef.current));
      inputNeedsNewTurnRef.current = false;
    }
    if (content?.outputTranscription?.text) {
      const role: TranscriptTurn['role'] = station === 'DEFENSA' || station === 'INTERVENCIONES'
        ? 'EXAMINER'
        : 'PATIENT';
      setTranscript((current) => joinFragment(current, role, content.outputTranscription!.text!, startedAtRef.current, outputNeedsNewTurnRef.current));
      outputNeedsNewTurnRef.current = false;
    }
    if (content?.turnComplete) {
      inputNeedsNewTurnRef.current = true;
      outputNeedsNewTurnRef.current = true;
      if (activeAudioRef.current === 0) setIsSpeaking(false);
    }
    const handle = message.sessionResumptionUpdate?.newHandle;
    if (handle && message.sessionResumptionUpdate?.resumable !== false) {
      void onResumeHandle?.(handle);
    }
    if (message.goAway) {
      gracefulGoAwayRef.current = true;
      setState('RECONNECTING');
    }
  }, [onResumeHandle, playAudio, station, stopPlayback]);

  const openLiveSession = useCallback(async (isReconnect: boolean) => {
    if (connectingRef.current || manualCloseRef.current) return;
    connectingRef.current = true;
    setError('');
    setState(isReconnect ? 'RECONNECTING' : 'CONNECTING');
    try {
      const token = await getToken();
      currentModelRef.current = token.model;
      setActiveModel(token.model);
      const ai = new GoogleGenAI({
        apiKey: token.token,
        httpOptions: { apiVersion: 'v1alpha' },
      });
      const session = await ai.live.connect({
        model: token.model,
        callbacks: {
          onopen: () => setState('CONNECTED'),
          onmessage: handleMessage,
          onerror: (event) => {
            console.error('[simulador-estaciones] Live error', event);
            setState('RECONNECTING');
            try { liveSessionRef.current?.close(); } catch { /* onclose gestiona el reintento. */ }
          },
          onclose: () => {
            liveSessionRef.current = null;
            if (manualCloseRef.current) return;
            if (!gracefulGoAwayRef.current && currentModelRef.current) {
              failedModelsRef.current.add(currentModelRef.current);
              // Solo existen dos modelos Live verificados. Tras probar ambos se
              // reinicia el ciclo para tolerar fallos de red transitorios.
              if (failedModelsRef.current.size >= 2) failedModelsRef.current.clear();
            }
            gracefulGoAwayRef.current = false;
            reconnectAttemptRef.current += 1;
            const attempt = reconnectAttemptRef.current;
            if (attempt > 5) {
              setState('ERROR');
              setError('La voz no pudo reconectarse. Tu progreso está guardado; puedes reintentar sin perder la estación.');
              return;
            }
            setReconnectCount((count) => {
              const next = count + 1;
              onReconnectCount?.(next);
              return next;
            });
            setState('RECONNECTING');
            reconnectTimerRef.current = setTimeout(
              () => void Promise.resolve(onBeforeReconnect?.()).catch(() => undefined).then(() => openLiveSession(true)),
              Math.min(8000, 500 * (2 ** (attempt - 1))),
            );
          },
        },
      });
      liveSessionRef.current = session;
      reconnectAttemptRef.current = 0;
      setState('CONNECTED');
      if (token.openingInstruction && !openingSentRef.current) {
        openingSentRef.current = true;
        session.sendClientContent({ turns: token.openingInstruction, turnComplete: true });
      }
    } catch (reason) {
      const message = String((reason as Error)?.message || reason);
      if (currentModelRef.current) {
        failedModelsRef.current.add(currentModelRef.current);
        if (failedModelsRef.current.size >= 2) failedModelsRef.current.clear();
      }
      if (isReconnect && reconnectAttemptRef.current < 5) {
        reconnectAttemptRef.current += 1;
        reconnectTimerRef.current = setTimeout(
          () => void Promise.resolve(onBeforeReconnect?.()).catch(() => undefined).then(() => openLiveSession(true)),
          Math.min(8000, 500 * (2 ** reconnectAttemptRef.current)),
        );
      } else {
        setState('ERROR');
        setError(message);
      }
    } finally {
      connectingRef.current = false;
    }
  }, [getToken, handleMessage, onBeforeReconnect, onReconnectCount]);

  const ensureMicrophone = useCallback(async () => {
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
    const inputContext = new AudioContext({ sampleRate: 16000 });
    const outputContext = new AudioContext({ sampleRate: 24000 });
    inputContextRef.current = inputContext;
    outputContextRef.current = outputContext;
    const source = inputContext.createMediaStreamSource(stream);
    const processor = inputContext.createScriptProcessor(4096, 1, 1);
    sourceRef.current = source;
    processorRef.current = processor;
    source.connect(processor);
    processor.connect(inputContext.destination);
    processor.onaudioprocess = (event) => {
      const samples = event.inputBuffer.getChannelData(0);
      let energy = 0;
      for (let index = 0; index < samples.length; index += 1) energy += samples[index] ** 2;
      setVolume(micOpenRef.current ? Math.sqrt(energy / samples.length) : 0);
      const session = liveSessionRef.current;
      // Evita que la voz del paciente reproducida por los parlantes vuelva a
      // entrar al modelo como si fuera una intervención del estudiante.
      if (!session || !micOpenRef.current || activeAudioRef.current > 0) return;
      try {
        session.sendRealtimeInput({
          audio: {
            data: pcmFloatToBase64(samples),
            mimeType: 'audio/pcm;rate=16000',
          },
        });
      } catch {
        // El callback de cierre inicia la recuperación. El audio posterior
        // sigue disponible desde el mismo micrófono cuando vuelve el socket.
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
    if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
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
  }, [stopPlayback]);

  const retry = useCallback(async () => {
    manualCloseRef.current = false;
    reconnectAttemptRef.current = 0;
    await ensureMicrophone();
    await openLiveSession(true);
  }, [ensureMicrophone, openLiveSession]);

  const sendText = useCallback((text: string) => {
    if (!liveSessionRef.current) return false;
    liveSessionRef.current.sendClientContent({ turns: text, turnComplete: true });
    return true;
  }, []);

  const toggleMic = useCallback(() => {
    const next = !micOpenRef.current;
    micOpenRef.current = next;
    setIsMicOpen(next);
    streamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = next;
    });
    if (!next) {
      setVolume(0);
      try { liveSessionRef.current?.sendRealtimeInput({ audioStreamEnd: true }); } catch { /* La reconexión mantiene el estado. */ }
    }
  }, []);

  useEffect(() => () => disconnect(true), [disconnect]);

  return {
    state,
    transcript,
    volume,
    isMicOpen,
    isSpeaking,
    error,
    reconnectCount,
    activeModel,
    connect,
    retry,
    disconnect,
    sendText,
    toggleMic,
  };
}
