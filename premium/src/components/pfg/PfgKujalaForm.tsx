"use client";

import { useState, useMemo } from "react";
import { KUJALA_AKPS_ES } from "@/lib/pfg/kujala-config";
import {
  KujalaAnswers,
  calculateKujalaScore,
  getKujalaCompletion,
} from "@/lib/pfg/kujala-utils";

interface Props {
  initialAnswers?: KujalaAnswers;
  onComplete: (score: number, answers: KujalaAnswers) => void;
  onCancel: () => void;
}

export default function PfgKujalaForm({ initialAnswers, onComplete, onCancel }: Props) {
  const instrument = KUJALA_AKPS_ES;
  const [answers, setAnswers] = useState<KujalaAnswers>(initialAnswers || {});

  const completion = useMemo(() => getKujalaCompletion(answers, instrument), [answers]);
  const score = useMemo(() => calculateKujalaScore(answers, instrument), [answers]);

  const handleSelect = (itemId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleClear = () => {
    setAnswers({});
  };

  const handleSave = () => {
    if (!completion.complete) {
      alert(`Faltan ${completion.total - completion.answered} preguntas por responder.`);
      return;
    }
    onComplete(score, answers);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-slate-800">{instrument.title}</h2>
              <p className="text-xs text-slate-500 mt-0.5">{instrument.description}</p>
            </div>
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-600 transition p-1">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Score bar sticky */}
        <div className="px-6 py-3 border-b border-slate-100 bg-slate-50 shrink-0">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 rounded-xl px-3 py-1.5 border border-emerald-200">
                <span className="text-xs text-emerald-600 font-bold">Puntaje</span>
                <span className="text-xl font-black font-mono text-emerald-700 ml-2">
                  {score}<span className="text-sm font-semibold text-emerald-500">/100</span>
                </span>
              </div>
              <div className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                completion.complete
                  ? "bg-green-100 text-green-700 border-green-300"
                  : "bg-amber-100 text-amber-700 border-amber-300"
              }`}>
                {completion.complete ? "✅ Completo" : `⏳ ${completion.answered}/${completion.total}`}
              </div>
            </div>
            {/* Progress bar */}
            <div className="flex-1 max-w-[200px]">
              <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                  style={{ width: `${completion.percent}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right mt-0.5 font-bold">{completion.percent}%</p>
            </div>
          </div>
        </div>

        {/* Questions */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {instrument.items.map((item, idx) => {
            const selectedValue = answers[item.id] || null;
            const isAnswered = !!selectedValue;

            return (
              <div
                key={item.id}
                className={`rounded-2xl border-2 p-4 transition-all ${
                  isAnswered
                    ? "border-emerald-200 bg-emerald-50/30"
                    : "border-slate-200 bg-white"
                }`}
              >
                <p className="text-sm font-bold text-slate-700 mb-3">
                  <span className="inline-flex w-7 h-7 rounded-full bg-slate-800 text-white text-xs font-bold items-center justify-center mr-2">
                    {idx + 1}
                  </span>
                  {item.text}
                </p>
                <div className="space-y-2 ml-9">
                  {item.options.map((opt) => {
                    const isSelected = selectedValue === opt.value;
                    return (
                      <label
                        key={opt.value}
                        className={`flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition-all border ${
                          isSelected
                            ? "bg-emerald-100 border-emerald-300 text-emerald-800"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50 hover:border-slate-300"
                        }`}
                      >
                        <input
                          type="radio"
                          name={item.id}
                          value={opt.value}
                          checked={isSelected}
                          onChange={() => handleSelect(item.id, opt.value)}
                          className="accent-emerald-600 w-4 h-4"
                        />
                        <span className="text-sm font-medium flex-1">{opt.label}</span>
                        <span className="text-xs font-mono font-bold text-slate-400">
                          {opt.score} pts
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
          <button
            onClick={handleClear}
            className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
          >
            🗑️ Limpiar todo
          </button>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={!completion.complete}
              className={`px-5 py-2 text-sm font-bold rounded-xl transition shadow-sm ${
                completion.complete
                  ? "bg-emerald-600 text-white hover:bg-emerald-700"
                  : "bg-slate-200 text-slate-400 cursor-not-allowed"
              }`}
            >
              ✅ Usar puntaje ({score}/100)
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
