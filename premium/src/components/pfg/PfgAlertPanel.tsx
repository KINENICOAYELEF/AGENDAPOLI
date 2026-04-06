"use client";

import type { PfgAlerta } from "@/lib/pfg/calculations";

interface Props {
  alertas: PfgAlerta[];
}

const ICON_MAP = { warning: "⚠️", error: "🔴", info: "ℹ️" };
const STYLE_MAP = {
  warning: "bg-amber-50 border-amber-200 text-amber-800",
  error: "bg-red-50 border-red-200 text-red-800",
  info: "bg-blue-50 border-blue-200 text-blue-800",
};

export default function PfgAlertPanel({ alertas }: Props) {
  if (alertas.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Alertas</p>
      {alertas.map((a, i) => (
        <div
          key={i}
          className={`flex items-start gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${STYLE_MAP[a.tipo]}`}
        >
          <span className="shrink-0">{ICON_MAP[a.tipo]}</span>
          <span>{a.mensaje}</span>
        </div>
      ))}
    </div>
  );
}
