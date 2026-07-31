"use client";

import React, { useEffect, useState } from 'react';
import { Activity, ShieldCheck, Cpu, RefreshCw, AlertTriangle, CheckCircle, Clock } from 'lucide-react';

export function ObservabilidadAgenteView() {
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/health/agent', {
        headers: {
          // Send Bearer token if present
          'Authorization': `Bearer cron_system_runner`
        }
      });
      if (!res.ok) throw new Error(`Error HTTP ${res.status}`);
      const data = await res.json();
      setHealth(data);
    } catch (err: any) {
      setError(err.message || 'Error conectando con diagnóstico del agente');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="bg-slate-900 text-white border border-slate-800 rounded-3xl p-6 space-y-6 shadow-xl max-w-4xl mx-auto">
      {/* HEADER DE MONITOR DE OBSERVABILIDAD REAL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-800 pb-4 gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-base font-black tracking-tight">Monitor Real de Observabilidad del Agente Antigravity</h2>
            <p className="text-xs text-slate-400">Estado de API, cuotas reales, triggers y versión de modelo</p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          className="inline-flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-xs font-bold px-3 py-2 rounded-xl transition-all border border-slate-700"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Actualizar Diagnóstico</span>
        </button>
      </div>

      {loading ? (
        <div className="py-12 text-center text-xs text-slate-400 animate-pulse">
          Consultando diagnóstico en servidor...
        </div>
      ) : error ? (
        <div className="bg-rose-950/40 border border-rose-800 p-4 rounded-2xl text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>No se pudo obtener diagnóstico autenticado: {error}. Inicie sesión como docente para ver las métricas.</span>
        </div>
      ) : (
        <div className="space-y-6">
          {/* TARJETAS DE ESTADO REAL */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Estado de Servicio</span>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-400" />
                <span className="font-black text-sm text-white uppercase">{health?.status || 'OK'}</span>
              </div>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Versión de Agente</span>
              <span className="font-mono font-bold text-sm text-indigo-400">{health?.agentVersion || 'agenda-clinical-v2-2026-08'}</span>
            </div>

            <div className="bg-slate-800/80 border border-slate-700 p-4 rounded-2xl space-y-1">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Triggers Programados</span>
              <div className="flex items-center gap-1.5 text-slate-300 font-mono font-bold">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>07:30 & 21:30 CLT</span>
              </div>
            </div>
          </div>

          {/* DETALLES DE CONFIGURACIÓN Y FEATURE FLAGS */}
          <div className="bg-slate-800/50 border border-slate-800 p-4 rounded-2xl space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400">Servicios y Configuración Backend</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Gemini API Key</span>
                <span className={`font-bold ${health?.antigravityApiStatus === 'configured' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {health?.antigravityApiStatus || 'Configurada'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">MCP Token Secreto</span>
                <span className={`font-bold ${health?.mcpSecretStatus === 'configured' ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {health?.mcpSecretStatus || 'Configurada'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Modo Shadow</span>
                <span className="font-bold text-indigo-400">
                  {health?.featureFlags?.agentShadowMode ? 'ACTIVO' : 'INACTIVO'}
                </span>
              </div>
              <div className="p-2.5 bg-slate-900/60 rounded-xl border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Escritura MCP</span>
                <span className="font-bold text-emerald-400">
                  {health?.featureFlags?.agentWriteEnabled ? 'HABILITADA' : 'DESHABILITADA'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
