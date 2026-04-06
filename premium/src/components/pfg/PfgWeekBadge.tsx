"use client";

import type { PfgSemana } from "@/types/pfg";

const WEEK_CONFIG: Record<number, { label: string; bg: string; text: string; border: string }> = {
  0: { label: "S0", bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
  5: { label: "S5", bg: "bg-amber-100", text: "text-amber-700", border: "border-amber-200" },
  10: { label: "S10", bg: "bg-emerald-100", text: "text-emerald-700", border: "border-emerald-200" },
};

const STATUS_DOT: Record<string, string> = {
  pendiente: "bg-slate-300",
  completa: "bg-green-500",
  parcial: "bg-amber-400",
};

interface PfgWeekBadgeProps {
  semana: PfgSemana;
  status?: "pendiente" | "completa" | "parcial";
  size?: "sm" | "md";
}

export default function PfgWeekBadge({ semana, status, size = "md" }: PfgWeekBadgeProps) {
  const cfg = WEEK_CONFIG[semana] || WEEK_CONFIG[0];
  const sizeClass = size === "sm" ? "px-2 py-0.5 text-xs" : "px-3 py-1 text-sm";

  return (
    <span
      className={`inline-flex items-center gap-1.5 font-bold rounded-full border ${cfg.bg} ${cfg.text} ${cfg.border} ${sizeClass}`}
    >
      {status && <span className={`w-2 h-2 rounded-full ${STATUS_DOT[status]}`} />}
      {cfg.label}
    </span>
  );
}
