import React, { useState, useEffect } from "react";

interface EvaSliderProps {
    label: string;
    value: number | undefined;
    onChange: (val: number | undefined) => void;
    disabled?: boolean;
    isEnd?: boolean;
    onSameAsStart?: () => void;
}

export function EvaSlider({ label, value, onChange, disabled, isEnd, onSameAsStart }: EvaSliderProps) {
    const [localVal, setLocalVal] = useState<number | undefined>(value);

    // Sync from parent
    useEffect(() => {
        setLocalVal(value);
    }, [value]);

    const handleLocalChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setLocalVal(Number(e.target.value));
    };

    const handleCommit = () => {
        if (localVal !== undefined) {
            const finalVal = Math.round(localVal);
            if (finalVal !== value) {
                onChange(finalVal);
            }
        }
    };

    const setQuickValue = (val: number) => {
        if (disabled) return;
        setLocalVal(val);
        onChange(val);
    };

    const getBgColor = (val: number) => {
        if (val <= 3) return "bg-emerald-500";
        if (val <= 6) return "bg-amber-400";
        return "bg-rose-500";
    };

    const getTextColor = (val: number) => {
        if (val <= 3) return "text-emerald-600";
        if (val <= 6) return "text-amber-500";
        return "text-rose-600";
    };

    return (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 mb-4 shadow-sm">
            <div className="flex justify-between items-center mb-4">
                <label className="block text-[11px] font-black text-slate-700 uppercase tracking-wider">
                    {label} <span className="text-rose-600">*</span>
                </label>
                {isEnd && onSameAsStart && (
                    <button
                        type="button"
                        onClick={onSameAsStart}
                        disabled={disabled}
                        className="text-[10px] bg-indigo-100 text-indigo-700 hover:bg-indigo-200 font-bold px-3 py-1 rounded-full transition-colors disabled:opacity-50"
                    >
                        Igual que Inicio
                    </button>
                )}
            </div>

            {/* Slider Track */}
            <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner font-black text-xl text-white transition-colors duration-300 ${localVal !== undefined ? getBgColor(Math.round(localVal)) : "bg-slate-300"}`}>
                    {localVal !== undefined ? Math.round(localVal) : "-"}
                </div>

                <div className="flex-1 relative pb-1">
                    <input
                        type="range"
                        min="0"
                        max="10"
                        step="0.01"
                        value={localVal !== undefined ? localVal : 0}
                        onChange={handleLocalChange}
                        onMouseUp={handleCommit}
                        onTouchEnd={handleCommit}
                        disabled={disabled}
                        className="w-full accent-indigo-600 h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 touch-pan-y"
                    />
                    <div className="flex justify-between text-[9px] font-black text-slate-400 mt-2 px-1">
                        <span>0 (Nada)</span>
                        <span>5</span>
                        <span>10 (Insoportable)</span>
                    </div>
                </div>
            </div>

            {/* Quick Buttons */}
            <div className="flex gap-2 mt-5">
                {[0, 3, 5, 7, 10].map(v => (
                    <button
                        key={v}
                        type="button"
                        disabled={disabled}
                        onClick={() => setQuickValue(v)}
                        className={`flex-1 py-2 rounded-xl text-xs font-black transition-all border shadow-sm active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${localVal !== undefined && Math.round(localVal) === v ? 'bg-slate-800 text-white border-slate-800 scale-105' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}
                    >
                        {v}
                    </button>
                ))}
            </div>

        </div >
    );
}
