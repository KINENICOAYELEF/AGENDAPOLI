"use client";

import type { PfgAlgometria } from "@/types/pfg";

interface Props {
  value: PfgAlgometria;
  onChange: (v: PfgAlgometria) => void;
}

export default function PfgAlgometriaPanel({ value, onChange }: Props) {
  const update = (patch: Partial<PfgAlgometria>) => {
    onChange({ ...value, ...patch });
  };

  return (
    <div className="bg-slate-50 rounded-2xl border border-slate-200 p-4 space-y-4">
      <div>
        <h4 className="font-bold text-sm text-slate-800">Algometría (PPT)</h4>
        <p className="text-xs text-slate-500 mt-0.5">Umbral de dolor a presión — Solo semana 0 y 10</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
        <p className="text-xs text-amber-700 font-semibold">
          ⚠️ El valor corresponde al primer momento en que la presión pasa a dolor
        </p>
      </div>

      {/* Zona anatómica + Unidad */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Zona Anatómica</label>
          <input
            type="text"
            value={value.zonaAnatomica}
            onChange={(e) => update({ zonaAnatomica: e.target.value })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 outline-none"
            placeholder="Ej: Polo inferior rótula derecha"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-500 mb-1">Unidad de Medida</label>
          <select
            value={value.unidad}
            onChange={(e) => update({ unidad: e.target.value as PfgAlgometria["unidad"] })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 focus:ring-2 focus:ring-emerald-200 outline-none"
          >
            <option value="kg">kg (kilogramos)</option>
            <option value="kPa">kPa (kilopascales)</option>
            <option value="kg_cm2">kg/cm²</option>
            <option value="N">N (Newtons)</option>
            <option value="lbs">lbs</option>
          </select>
        </div>
      </div>

      {/* 3 intentos */}
      <div className="grid grid-cols-3 gap-3">
        {(['intento1', 'intento2', 'intento3'] as const).map((field, i) => (
          <div key={field}>
            <label className="block text-xs font-semibold text-slate-500 mb-1">Intento {i + 1}</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={value[field] ?? ""}
              onChange={(e) => update({ [field]: e.target.value === "" ? null : parseFloat(e.target.value) })}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
              placeholder="0.0"
            />
          </div>
        ))}
      </div>

      {/* Valor final */}
      <div className="flex items-center gap-3">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-slate-500 mb-1">Valor Final</label>
          <input
            type="number"
            step="0.1"
            min="0"
            value={value.valorFinal ?? ""}
            onChange={(e) => update({ valorFinal: e.target.value === "" ? null : parseFloat(e.target.value) })}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-700 focus:ring-2 focus:ring-emerald-200 outline-none"
            placeholder="Valor seleccionado"
          />
        </div>
        <div className="bg-emerald-100 rounded-xl px-4 py-2 border border-emerald-200 text-center">
          <span className="text-xs text-emerald-600 font-bold block">{value.unidad === 'kg_cm2' ? 'kg/cm²' : value.unidad}</span>
          <span className="text-xl font-black font-mono text-emerald-700">
            {value.valorFinal !== null ? value.valorFinal.toFixed(1) : "—"}
          </span>
        </div>
      </div>
    </div>
  );
}
