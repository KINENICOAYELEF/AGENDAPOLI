'use client';

import React, { useState, useMemo } from 'react';

// ─── Types ───────────────────────────────────────────────────────────
interface IntentoData {
    fecha: any;
    puntajeGlobal: number;
    notaChilena: number;
    rubricaDetallada?: any;
    competencias?: {
        razonamiento_clinico: { nivel: string; comentario: string };
        comunicacion_profesional: { nivel: string; comentario: string };
        evidencia_cientifica: { nivel: string; comentario: string };
        integracion_biopsicosocial: { nivel: string; comentario: string };
        dosificacion_prescripcion: { nivel: string; comentario: string };
    };
}

interface DefensaVozProgresionProps {
    intentos: IntentoData[];
}

// ─── Helpers ─────────────────────────────────────────────────────────
const NOTA_MIN = 1.0;
const NOTA_MAX = 7.0;
const NOTA_APROBATORIA = 4.0;

function formatFecha(fecha: any): string {
    if (!fecha) return '—';
    try {
        const d = fecha?.toDate ? fecha.toDate() : new Date(fecha);
        return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
        return '—';
    }
}

function nivelToPercent(nivel: string): number {
    const lower = (nivel || '').toLowerCase().trim();
    if (lower.includes('logrado') || lower.includes('competente')) return 100;
    if (lower.includes('desarrollo') || lower.includes('parcial')) return 50;
    return 10; // No demostrado
}

function nivelColor(nivel: string): string {
    const pct = nivelToPercent(nivel);
    if (pct >= 100) return '#10b981'; // emerald-500
    if (pct >= 50) return '#f59e0b';  // amber-500
    return '#ef4444';                  // red-500
}

// ─── Line Chart ──────────────────────────────────────────────────────
const CHART_W = 600;
const CHART_H = 300;
const PAD = { top: 30, right: 30, bottom: 50, left: 50 };
const INNER_W = CHART_W - PAD.left - PAD.right;
const INNER_H = CHART_H - PAD.top - PAD.bottom;

function LineChart({ intentos }: { intentos: IntentoData[] }) {
    const [tooltip, setTooltip] = useState<{ x: number; y: number; intento: IntentoData; idx: number } | null>(null);

    const data = useMemo(() => intentos.slice(-10), [intentos]);
    const n = data.length;

    const xScale = (i: number) => PAD.left + (n === 1 ? INNER_W / 2 : (i / (n - 1)) * INNER_W);
    const yScale = (nota: number) => PAD.top + INNER_H - ((nota - NOTA_MIN) / (NOTA_MAX - NOTA_MIN)) * INNER_H;

    // Y-axis ticks
    const yTicks = [1, 2, 3, 4, 5, 6, 7];

    // Build polyline
    const points = data.map((d, i) => `${xScale(i)},${yScale(d.notaChilena)}`).join(' ');

    // Aprobatoria line
    const aprobY = yScale(NOTA_APROBATORIA);

    return (
        <div className="relative w-full overflow-x-auto">
            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                className="w-full max-w-2xl mx-auto"
                style={{ minWidth: 400 }}
            >
                {/* Grid lines */}
                {yTicks.map(t => (
                    <line
                        key={t}
                        x1={PAD.left} y1={yScale(t)}
                        x2={CHART_W - PAD.right} y2={yScale(t)}
                        stroke="#374151" strokeWidth={0.5} opacity={0.3}
                    />
                ))}

                {/* Y-axis labels */}
                {yTicks.map(t => (
                    <text
                        key={t}
                        x={PAD.left - 10} y={yScale(t) + 4}
                        textAnchor="end" fontSize={11} fill="#9ca3af"
                    >
                        {t.toFixed(1)}
                    </text>
                ))}

                {/* X-axis labels */}
                {data.map((_, i) => (
                    <text
                        key={i}
                        x={xScale(i)} y={CHART_H - PAD.bottom + 20}
                        textAnchor="middle" fontSize={10} fill="#9ca3af"
                    >
                        {`Int. ${intentos.length - data.length + i + 1}`}
                    </text>
                ))}

                {/* Nota aprobatoria line */}
                <line
                    x1={PAD.left} y1={aprobY}
                    x2={CHART_W - PAD.right} y2={aprobY}
                    stroke="#f59e0b" strokeWidth={1.5}
                    strokeDasharray="6 4" opacity={0.8}
                />
                <text
                    x={CHART_W - PAD.right + 4} y={aprobY + 4}
                    fontSize={9} fill="#f59e0b" fontWeight="bold"
                >
                    4.0
                </text>

                {/* Line */}
                {n > 1 && (
                    <polyline
                        points={points}
                        fill="none"
                        stroke="url(#lineGradient)"
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />
                )}

                {/* Gradient def */}
                <defs>
                    <linearGradient id="lineGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#6366f1" />
                        <stop offset="100%" stopColor="#10b981" />
                    </linearGradient>
                </defs>

                {/* Data points */}
                {data.map((d, i) => {
                    const cx = xScale(i);
                    const cy = yScale(d.notaChilena);
                    const isAprobado = d.notaChilena >= NOTA_APROBATORIA;
                    return (
                        <g key={i}>
                            {/* Hover area */}
                            <circle
                                cx={cx} cy={cy} r={14}
                                fill="transparent"
                                className="cursor-pointer"
                                onMouseEnter={() => setTooltip({ x: cx, y: cy, intento: d, idx: i })}
                                onMouseLeave={() => setTooltip(null)}
                                onClick={() => setTooltip(prev => prev?.idx === i ? null : { x: cx, y: cy, intento: d, idx: i })}
                            />
                            {/* Outer ring */}
                            <circle
                                cx={cx} cy={cy} r={6}
                                fill={isAprobado ? '#10b981' : '#ef4444'}
                                opacity={0.2}
                            />
                            {/* Inner dot */}
                            <circle
                                cx={cx} cy={cy} r={4}
                                fill={isAprobado ? '#10b981' : '#ef4444'}
                                stroke="#1f2937" strokeWidth={1.5}
                            />
                        </g>
                    );
                })}

                {/* Tooltip */}
                {tooltip && (
                    <g>
                        <rect
                            x={tooltip.x - 70} y={tooltip.y - 52}
                            width={140} height={42}
                            rx={6} fill="#111827" stroke="#374151" strokeWidth={1}
                            opacity={0.95}
                        />
                        <text
                            x={tooltip.x} y={tooltip.y - 35}
                            textAnchor="middle" fontSize={10} fill="#d1d5db"
                        >
                            {formatFecha(tooltip.intento.fecha)}
                        </text>
                        <text
                            x={tooltip.x} y={tooltip.y - 20}
                            textAnchor="middle" fontSize={12} fill="#ffffff" fontWeight="bold"
                        >
                            Nota: {tooltip.intento.notaChilena.toFixed(1)} — {tooltip.intento.puntajeGlobal}%
                        </text>
                    </g>
                )}

                {/* Axis titles */}
                <text
                    x={CHART_W / 2} y={CHART_H - 4}
                    textAnchor="middle" fontSize={11} fill="#6b7280"
                >
                    Intentos
                </text>
                <text
                    x={12} y={CHART_H / 2}
                    textAnchor="middle" fontSize={11} fill="#6b7280"
                    transform={`rotate(-90, 12, ${CHART_H / 2})`}
                >
                    Nota
                </text>
            </svg>
        </div>
    );
}

// ─── Radar Chart ─────────────────────────────────────────────────────
const RADAR_SIZE = 280;
const RADAR_CENTER = RADAR_SIZE / 2;
const RADAR_R = 100;

const COMPETENCIA_LABELS: { key: string; label: string }[] = [
    { key: 'razonamiento_clinico', label: 'Razonamiento' },
    { key: 'comunicacion_profesional', label: 'Comunicación' },
    { key: 'evidencia_cientifica', label: 'Evidencia' },
    { key: 'integracion_biopsicosocial', label: 'BPS' },
    { key: 'dosificacion_prescripcion', label: 'Dosificación' },
];

function RadarChart({ competencias }: { competencias: NonNullable<IntentoData['competencias']> }) {
    const n = COMPETENCIA_LABELS.length;
    const angleStep = (2 * Math.PI) / n;
    const startAngle = -Math.PI / 2; // Start from top

    const getPoint = (i: number, r: number) => {
        const angle = startAngle + i * angleStep;
        return {
            x: RADAR_CENTER + r * Math.cos(angle),
            y: RADAR_CENTER + r * Math.sin(angle),
        };
    };

    // Grid rings at 25%, 50%, 75%, 100%
    const rings = [0.25, 0.5, 0.75, 1.0];

    // Data polygon
    const dataPoints = COMPETENCIA_LABELS.map((c, i) => {
        const comp = competencias[c.key as keyof typeof competencias];
        const pct = nivelToPercent(comp?.nivel || '') / 100;
        return getPoint(i, RADAR_R * pct);
    });
    const dataPath = dataPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

    return (
        <div className="flex flex-col items-center">
            <svg viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`} className="w-64 h-64 mx-auto">
                {/* Grid rings */}
                {rings.map(r => {
                    const ringPath = COMPETENCIA_LABELS.map((_, i) => {
                        const p = getPoint(i, RADAR_R * r);
                        return `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`;
                    }).join(' ') + ' Z';
                    return (
                        <path
                            key={r}
                            d={ringPath}
                            fill="none" stroke="#374151" strokeWidth={0.7} opacity={0.4}
                        />
                    );
                })}

                {/* Axis lines */}
                {COMPETENCIA_LABELS.map((_, i) => {
                    const outer = getPoint(i, RADAR_R);
                    return (
                        <line
                            key={i}
                            x1={RADAR_CENTER} y1={RADAR_CENTER}
                            x2={outer.x} y2={outer.y}
                            stroke="#374151" strokeWidth={0.7} opacity={0.4}
                        />
                    );
                })}

                {/* Data fill */}
                <path d={dataPath} fill="#10b981" opacity={0.2} />
                <path d={dataPath} fill="none" stroke="#10b981" strokeWidth={2} />

                {/* Data points */}
                {dataPoints.map((p, i) => {
                    const comp = competencias[COMPETENCIA_LABELS[i].key as keyof typeof competencias];
                    return (
                        <circle
                            key={i}
                            cx={p.x} cy={p.y} r={4}
                            fill={nivelColor(comp?.nivel || '')}
                            stroke="#1f2937" strokeWidth={1.5}
                        />
                    );
                })}

                {/* Labels */}
                {COMPETENCIA_LABELS.map((c, i) => {
                    const p = getPoint(i, RADAR_R + 22);
                    const comp = competencias[c.key as keyof typeof competencias];
                    return (
                        <text
                            key={i}
                            x={p.x} y={p.y}
                            textAnchor="middle" dominantBaseline="middle"
                            fontSize={10} fill="#d1d5db" fontWeight="500"
                        >
                            <tspan x={p.x} dy="0">{c.label}</tspan>
                            <tspan x={p.x} dy="13" fontSize={8} fill={nivelColor(comp?.nivel || '')}>
                                {comp?.nivel || '—'}
                            </tspan>
                        </text>
                    );
                })}
            </svg>

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs">
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
                    Logrado
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" />
                    En desarrollo
                </span>
                <span className="flex items-center gap-1">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" />
                    No demostrado
                </span>
            </div>
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────
export default function DefensaVozProgresion({ intentos }: DefensaVozProgresionProps) {
    if (!intentos || intentos.length < 2) {
        return (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-8 text-center">
                <div className="text-4xl mb-3">📊</div>
                <p className="text-gray-400 text-sm">
                    Se necesitan al menos 2 intentos para ver la progresión.
                </p>
                <p className="text-gray-500 text-xs mt-1">
                    Completados: {intentos?.length ?? 0} de 2
                </p>
            </div>
        );
    }

    const ultimoIntento = intentos[intentos.length - 1];
    const primerNota = intentos[0].notaChilena;
    const ultimaNota = ultimoIntento.notaChilena;
    const tendencia = ultimaNota - primerNota;

    return (
        <div className="space-y-6">
            {/* Header stats */}
            <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Intentos</p>
                    <p className="text-xl font-bold text-white">{intentos.length}</p>
                </div>
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Última Nota</p>
                    <p className={`text-xl font-bold ${ultimaNota >= NOTA_APROBATORIA ? 'text-emerald-400' : 'text-red-400'}`}>
                        {ultimaNota.toFixed(1)}
                    </p>
                </div>
                <div className="rounded-lg bg-gray-800/60 border border-gray-700 p-3 text-center">
                    <p className="text-xs text-gray-400 mb-1">Tendencia</p>
                    <p className={`text-xl font-bold ${tendencia > 0 ? 'text-emerald-400' : tendencia < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        {tendencia > 0 ? '↑' : tendencia < 0 ? '↓' : '→'} {Math.abs(tendencia).toFixed(1)}
                    </p>
                </div>
            </div>

            {/* Line Chart */}
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <span>📈</span> Progresión de Notas
                </h3>
                <LineChart intentos={intentos} />
            </div>

            {/* Radar Chart - Competencies */}
            {ultimoIntento.competencias && (
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <span>🎯</span> Competencias — Último Intento
                    </h3>
                    <RadarChart competencias={ultimoIntento.competencias} />
                </div>
            )}
        </div>
    );
}
