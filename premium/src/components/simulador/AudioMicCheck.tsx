"use client";

import React, { useState, useEffect } from 'react';
import { Mic, MicOff, Volume2, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

interface AudioMicCheckProps {
  onCheckPassed: () => void;
}

export function AudioMicCheck({ onCheckPassed }: AudioMicCheckProps) {
  const [micActive, setMicActive] = useState(false);
  const [volumeLevel, setVolumeLevel] = useState(0);
  const [disclaimerAccepted, setDisclaimerAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startMicTest = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMicActive(true);

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      microphone.connect(analyser);

      analyser.fftSize = 256;
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const checkVolume = () => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < bufferLength; i++) {
          sum += dataArray[i];
        }
        const average = sum / bufferLength;
        setVolumeLevel(Math.min(100, Math.round(average * 2)));

        if (stream.active) {
          requestAnimationFrame(checkVolume);
        }
      };

      checkVolume();
    } catch (err: any) {
      console.error('Error accediendo al micrófono:', err);
      setError('No se pudo acceder al micrófono. Por favor permite los permisos de audio en tu navegador.');
      setMicActive(false);
    }
  };

  return (
    <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 max-w-lg mx-auto space-y-6 shadow-xl">
      <div className="flex items-center gap-3 border-b border-slate-800 pb-4">
        <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
          <Mic className="w-5 h-5 text-white" />
        </div>
        <div>
          <h3 className="font-bold text-sm">Prueba Previa de Micrófono y Audio</h3>
          <p className="text-xs text-slate-400">Verifica la calidad antes de iniciar tu Defensa Oral de Comisión</p>
        </div>
      </div>

      {/* DISCLAIMER ÚNICO INICIAL */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 text-xs space-y-2 text-slate-300">
        <div className="flex items-center gap-2 text-indigo-400 font-bold">
          <ShieldCheck className="w-4 h-4" />
          <span>Privacidad y Formato de Evaluación</span>
        </div>
        <p>
          Esta defensa de voz es grabada y transcrita exclusivamente para análisis de razonamiento clínico.
          No se requiere cámara web ni software invasivo.
        </p>
      </div>

      {/* ERROR STATUS */}
      {error && (
        <div className="bg-rose-900/40 border border-rose-700/60 rounded-2xl p-3 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* MIC TEST CONTROL */}
      <div className="space-y-4">
        {!micActive ? (
          <button
            onClick={startMicTest}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Mic className="w-4 h-4" />
            <span>Probar Micrófono Ahora</span>
          </button>
        ) : (
          <div className="space-y-3 bg-slate-800 border border-slate-700 p-4 rounded-2xl">
            <div className="flex justify-between items-center text-xs font-bold">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                Micrófono Activo
              </span>
              <span className="text-slate-400 font-mono">Nivel: {volumeLevel}%</span>
            </div>

            {/* BARRA DE NIVEL DE VOLUMEN */}
            <div className="w-full bg-slate-700 h-3 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-75"
                style={{ width: `${volumeLevel}%` }}
              ></div>
            </div>

            {volumeLevel < 5 && (
              <p className="text-[11px] text-amber-400">
                Habla para verificar que la barra se mueva...
              </p>
            )}
          </div>
        )}
      </div>

      {/* CONTINUAR SI PASÓ LA PRUEBA */}
      {micActive && (
        <button
          onClick={onCheckPassed}
          className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-3 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
        >
          <span>Comenzar Defensa Oral</span>
        </button>
      )}
    </div>
  );
}
