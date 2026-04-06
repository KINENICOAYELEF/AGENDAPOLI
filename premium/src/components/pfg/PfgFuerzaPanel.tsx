"use client";

import type { PfgPruebaFuerza } from "@/types/pfg";
import { calcularMejorValor } from "@/lib/pfg/calculations";

interface Props {
  label: string;
  posicion: string;
  protocolo: string;
  value: PfgPruebaFuerza;
  onChange: (v: PfgPruebaFuerza) => void;
}

export default function PfgFuerzaPanel({ label, posicion, protocolo, value, onChange }: Props) {
  const update = (patch: Partial<PfgPruebaFuerza>) => {
    const next = { ...value, ...patch };
    next.mejorValor = calcularMejorValor(next.intento1, next.intento2, next.intento3);
    onChange(next);
  };

  const numInput = (
    field: 'intento1' | 'intento2' | 'intento3',
    labelText: string
  ) => (
    <div>
      <label className="block text-xs font-semibold text-slate-500 mb-1">{labelText}</label>
      <input
        type="number"
        step="0.1"
        min="0"
        value={value[field] ?? ""}
        onChange={(e) => update({ [field]: e.target.value === "" ? null : parseFloat(e.target.value) })}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
        placeholder="0.0"
      />
    </div>
  );

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
      <div>
        <h4 className="font-bold text-sm text-slate-800">{label}</h4>
        <p className="text-xs text-slate-500 mt-0.5">📐 {posicion}</p>
        <p className="text-xs text-slate-400 mt-0.5">📋 {protocolo}</p>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {numInput("intento1", "Intento 1")}
        {numInput("intento2", "Intento 2")}
        {numInput("intento3", "Intento 3")}
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-100 rounded-xl px-4 py-2 border border-emerald-200">
            <span className="text-xs text-emerald-600 font-bold block">Mejor Valor</span>
            <span className="text-xl font-black font-mono text-emerald-700">
              {value.mejorValor !== null ? value.mejorValor.toFixed(1) : "—"}
            </span>
          </div>
          <select
            value={value.unidad}
            onChange={(e) => update({ unidad: e.target.value as PfgPruebaFuerza["unidad"] })}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 focus:ring-2 focus:ring-emerald-200 outline-none"
          >
            <option value="N">N (Newtons)</option>
            <option value="kg">kg</option>
            <option value="lbs">lbs</option>
          </select>
        </div>

        <div className="w-28">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Torque (Nm)</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={value.torqueNm ?? ""}
            onChange={(e) => update({ torqueNm: e.target.value === "" ? null : parseFloat(e.target.value) })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
            placeholder="Opc."
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-semibold text-slate-500 mb-1">Notas</label>
        <input
          type="text"
          value={value.notas}
          onChange={(e) => update({ notas: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
          placeholder="Observaciones de la prueba..."
        />
      </div>
    </div>
  );
}
