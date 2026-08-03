"use client";

import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';

type TelegramStatus = {
  enabled: boolean;
  expectedWebhookUrl: string;
  configuredWebhookUrl?: string;
  isWebhookConnected: boolean;
  menuReady: boolean;
  securityReady: boolean;
  missing: string[];
  pendingUpdates?: number;
  lastError?: string;
  lastErrorAt?: string;
  detail?: string;
};

async function teacherRequest(path: string, init?: RequestInit) {
  const token = await auth.currentUser?.getIdToken();
  if (!token) throw new Error('Tu sesión docente no está disponible. Recarga la página e inténtalo nuevamente.');
  const response = await fetch(path, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init?.headers || {}) },
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload?.error?.message || 'No fue posible completar la acción.');
  return payload.data;
}

export function TelegramAdminPanel() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<'configure' | 'test' | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const refresh = async () => {
    setLoading(true);
    setMessage(null);
    try {
      setStatus(await teacherRequest('/api/teacher/telegram'));
    } catch (error: any) {
      setMessage(error?.message || 'No fue posible consultar Telegram.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, []);

  const runAction = async (action: 'configure' | 'test') => {
    if (action === 'configure' && !window.confirm('Esto conectará o reparará el webhook de este bot privado con Agenda Poli. ¿Deseas continuar?')) return;
    if (action === 'test' && !window.confirm('Esto enviará un mensaje de prueba únicamente a tu chat docente autorizado de Telegram. ¿Deseas continuar?')) return;

    setActionLoading(action);
    setMessage(null);
    try {
      const result = await teacherRequest('/api/teacher/telegram', {
        method: 'POST', body: JSON.stringify({ action }),
      });
      if (action === 'configure') setStatus(result);
      setMessage(action === 'configure' ? 'Webhook conectado. Ahora usa “Enviar prueba privada” para confirmar que Telegram responde.' : 'Mensaje de prueba enviado a tu chat docente.');
    } catch (error: any) {
      setMessage(error?.message || 'La acción no pudo completarse.');
    } finally {
      setActionLoading(null);
    }
  };

  const connected = Boolean(status?.isWebhookConnected && status?.securityReady && status?.menuReady);

  return (
    <section className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
      <div className="bg-slate-900 px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-bold text-white">Bot Telegram Docente</h3>
          <p className="text-slate-400 text-sm">Diagnóstico privado, conexión segura y prueba controlada.</p>
        </div>
        <span className={`rounded-full px-3 py-1 text-xs font-black ${connected ? 'bg-emerald-400/15 text-emerald-300' : 'bg-amber-400/15 text-amber-200'}`}>
          {loading ? 'COMPROBANDO…' : connected ? 'CONECTADO' : 'REQUIERE ATENCIÓN'}
        </span>
      </div>

      <div className="p-6 space-y-4">
        {message && <p className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">{message}</p>}

        {status && (
          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div className="rounded-lg border border-slate-200 p-3"><span className="block text-slate-500">Webhook esperado</span><span className="font-mono text-xs break-all text-slate-800">{status.expectedWebhookUrl}</span></div>
            <div className="rounded-lg border border-slate-200 p-3"><span className="block text-slate-500">Webhook informado por Telegram</span><span className="font-mono text-xs break-all text-slate-800">{status.configuredWebhookUrl || 'Aún no conectado'}</span></div>
            <div className="rounded-lg border border-slate-200 p-3"><span className="block text-slate-500">Seguridad y menú</span><span className="font-bold text-slate-800">{status.securityReady ? (status.menuReady ? 'Token, chat autorizado, secreto y botones activos' : 'Seguridad lista; falta activar botones') : `Falta: ${status.missing.join(', ')}`}</span></div>
            <div className="rounded-lg border border-slate-200 p-3"><span className="block text-slate-500">Actualizaciones pendientes</span><span className="font-bold text-slate-800">{status.pendingUpdates ?? '—'}</span></div>
          </div>
        )}

        {status?.lastError && <p className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">Último error de Telegram: {status.lastError}{status.lastErrorAt ? ` (${new Date(status.lastErrorAt).toLocaleString('es-CL')})` : ''}</p>}
        {status?.detail && <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Diagnóstico: {status.detail}</p>}

        <div className="flex flex-wrap gap-3 pt-1">
          <button onClick={() => void refresh()} disabled={loading || actionLoading !== null} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-bold text-sm hover:bg-slate-50 disabled:opacity-50">Actualizar diagnóstico</button>
          <button onClick={() => void runAction('configure')} disabled={loading || actionLoading !== null || !status?.securityReady} className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50">{actionLoading === 'configure' ? 'Conectando…' : 'Conectar / reparar webhook'}</button>
          <button onClick={() => void runAction('test')} disabled={!connected || actionLoading !== null} className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 disabled:opacity-50">{actionLoading === 'test' ? 'Enviando…' : 'Enviar prueba privada'}</button>
        </div>
        <p className="text-xs text-slate-500">La prueba se envía solo al chat docente autorizado. Las notas de voz se registran, pero no se transcriben ni ejecutan acciones clínicas todavía.</p>
      </div>
    </section>
  );
}
