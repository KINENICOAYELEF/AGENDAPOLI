'use client';

import { useMemo } from 'react';

type RadarValues = {
  grip: number;
  lowerLimbPower: number;
  mobility: number;
  gait: number;
  balance: number;
};

const axes: Array<{ key: keyof RadarValues; label: string }> = [
  { key: 'grip', label: 'Prensión' },
  { key: 'lowerLimbPower', label: 'Potencia' },
  { key: 'mobility', label: 'Movilidad' },
  { key: 'gait', label: 'Marcha' },
  { key: 'balance', label: 'Equilibrio' },
];

function point(index: number, value: number, radius: number, center = 130) {
  const angle = -Math.PI / 2 + (index * Math.PI * 2) / axes.length;
  const scaled = radius * Math.max(0, Math.min(100, value)) / 100;
  return {
    x: center + Math.cos(angle) * scaled,
    y: center + Math.sin(angle) * scaled,
  };
}

export function FunctionalRadar({ values, previous }: { values: RadarValues; previous?: RadarValues }) {
  const rings = [25, 50, 75, 100];
  const currentPoints = useMemo(
    () => axes.map((axis, index) => point(index, values[axis.key], 86)),
    [values],
  );
  const previousPoints = useMemo(
    () => previous ? axes.map((axis, index) => point(index, previous[axis.key], 86)) : [],
    [previous],
  );

  const polygon = (points: Array<{ x: number; y: number }>) => points.map(item => `${item.x},${item.y}`).join(' ');

  return (
    <div className="mx-auto w-full max-w-[360px]" aria-label="Perfil funcional visual">
      <svg viewBox="0 0 260 260" className="h-auto w-full overflow-visible" role="img">
        <title>Perfil funcional en cinco dimensiones</title>
        {rings.map(ring => {
          const ringPoints = axes.map((_, index) => point(index, ring, 86));
          return <polygon key={ring} points={polygon(ringPoints)} fill="none" stroke="#dbeafe" strokeWidth="1" />;
        })}
        {axes.map((axis, index) => {
          const edge = point(index, 100, 86);
          const label = point(index, 122, 86);
          return (
            <g key={axis.key}>
              <line x1="130" y1="130" x2={edge.x} y2={edge.y} stroke="#dbeafe" strokeWidth="1" />
              <text
                x={label.x}
                y={label.y}
                textAnchor={label.x < 115 ? 'end' : label.x > 145 ? 'start' : 'middle'}
                dominantBaseline="middle"
                className="fill-slate-600 text-[9px] font-bold"
              >
                {axis.label}
              </text>
            </g>
          );
        })}
        {previousPoints.length > 0 && (
          <polygon points={polygon(previousPoints)} fill="rgba(148,163,184,.12)" stroke="#94a3b8" strokeWidth="2" strokeDasharray="5 4" />
        )}
        <polygon points={polygon(currentPoints)} fill="rgba(13,148,136,.2)" stroke="#0f766e" strokeWidth="3" />
        {currentPoints.map((item, index) => (
          <g key={axes[index].key}>
            <circle cx={item.x} cy={item.y} r="4" fill="#0f766e" />
            <title>{`${axes[index].label}: ${values[axes[index].key]} de 100`}</title>
          </g>
        ))}
      </svg>
      <p className="-mt-2 text-center text-[10px] leading-relaxed text-slate-500">
        Perfil comparativo 0–100. Resume pruebas diferentes; no corresponde a un puntaje diagnóstico.
      </p>
    </div>
  );
}

