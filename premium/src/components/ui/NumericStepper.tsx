import React, { useState, useEffect } from "react";
import { PlusIcon, MinusIcon } from "@heroicons/react/20/solid";

interface NumericStepperProps {
    label: string;
    value: string | number | undefined;
    onChange: (val: string) => void;
    placeholder?: string;
    disabled?: boolean;
    step?: number;
    min?: number;
    max?: number;
}

export function NumericStepper({ label, value, onChange, placeholder, disabled, step = 1, min = 0, max = 999 }: NumericStepperProps) {
    const [localVal, setLocalVal] = useState<string>(value !== undefined ? String(value) : "");

    useEffect(() => {
        setLocalVal(value !== undefined ? String(value) : "");
    }, [value]);

    const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setLocalVal(val);
        // Desacoplamos la validación bloqueante: permitimos tipeo y propagamos
        // asumiendo que el padre tolera strings numéricos o vacíos.
        onChange(val);
    };

    const handleStep = (direction: 1 | -1) => {
        if (disabled) return;

        // Parsear el valor actual, si no es numérico, asumir 0
        const currentNum = parseFloat(localVal);
        let base = isNaN(currentNum) ? 0 : currentNum;

        let nextVal = base + (step * direction);

        if (nextVal < min) nextVal = min;
        if (nextVal > max) nextVal = max;

        // Si tiene decimales, redondear a 1 decimal máximo para pesos/cargas
        nextVal = Math.round(nextVal * 10) / 10;

        const strVal = String(nextVal);
        setLocalVal(strVal);
        onChange(strVal);
    };

    return (
        <div>
            <label className="block text-[9px] font-bold text-indigo-400 mb-1.5 ml-1 uppercase tracking-wider">{label}</label>
            <div className="flex bg-slate-950/50 border border-indigo-800/50 rounded-xl overflow-hidden focus-within:border-indigo-400 focus-within:bg-slate-900 transition-all h-11">
                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleStep(-1)}
                    className="w-10 flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-700/60 transition-colors disabled:opacity-30 disabled:hover:bg-indigo-900/40 text-indigo-300"
                >
                    <MinusIcon className="w-5 h-5" />
                </button>

                <input
                    type="text"
                    inputMode="decimal"
                    disabled={disabled}
                    placeholder={placeholder}
                    value={localVal}
                    onChange={handleTextChange}
                    className="flex-1 w-full bg-transparent text-center text-sm font-bold text-indigo-50 outline-none placeholder:text-indigo-400/40 disabled:opacity-50"
                />

                <button
                    type="button"
                    disabled={disabled}
                    onClick={() => handleStep(1)}
                    className="w-10 flex items-center justify-center bg-indigo-900/40 hover:bg-indigo-700/60 transition-colors disabled:opacity-30 disabled:hover:bg-indigo-900/40 text-indigo-300"
                >
                    <PlusIcon className="w-5 h-5" />
                </button>
            </div>
        </div>
    );
}
