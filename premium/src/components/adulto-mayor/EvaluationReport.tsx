'use client';

import { Download, AlertTriangle, CheckCircle2, Activity, Brain, PersonStanding, Zap } from 'lucide-react';
import { OlderAdultEvaluation } from '@/lib/adultoMayor/types';
import { FunctionalRadar } from './FunctionalRadar';

const dateLabel = (value?: string) => value
  ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(value))
  : 'Sin fecha';

function ResultCard({ icon, title, value, detail, tone = 'teal' }: {
  icon: React.ReactNode;
  title: string;
  value: string;
  detail?: string;
  tone?: 'teal' | 'amber' | 'rose' | 'indigo';
}) {
  const tones = {
    teal: 'border-teal-100 bg-teal-50 text-teal-900',
    amber: 'border-amber-100 bg-amber-50 text-amber-900',
    rose: 'border-rose-100 bg-rose-50 text-rose-900',
    indigo: 'border-indigo-100 bg-indigo-50 text-indigo-900',
  };
  return (
    <article className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider opacity-70">{icon}{title}</div>
      <p className="mt-2 text-base font-black leading-snug">{value}</p>
      {detail && <p className="mt-1 text-xs leading-relaxed opacity-75">{detail}</p>}
    </article>
  );
}

export function EvaluationReport({ evaluation, previous }: { evaluation: OlderAdultEvaluation; previous?: OlderAdultEvaluation }) {
  const result = evaluation.results;
  const tests = evaluation.data.tests;
  const printReport = () => {
    document.body.classList.add('am-printing');
    const cleanup = () => document.body.classList.remove('am-printing');
    window.addEventListener('afterprint', cleanup, { once: true });
    window.print();
    window.setTimeout(cleanup, 1500);
  };
  return (
    <section data-adulto-mayor-report className="am-print-report overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <header className="bg-gradient-to-br from-teal-950 via-teal-900 to-emerald-800 px-5 py-6 text-white sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[.22em] text-teal-200">Taller de Adulto Mayor</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight">Informe funcional</h2>
            <p className="mt-1 text-sm text-teal-100">{evaluation.participantSnapshot.fullName}</p>
          </div>
          <button
            type="button"
            onClick={printReport}
            data-no-print
            className="am-no-print inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-black text-teal-900 shadow-lg shadow-black/10 transition hover:bg-teal-50"
          >
            <Download className="h-4 w-4" /> Exportar PDF
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <div><span className="block text-teal-200">Edad</span><strong>{evaluation.participantSnapshot.age ?? '—'} años</strong></div>
          <div><span className="block text-teal-200">Evaluador/a</span><strong>{evaluation.evaluatorName}</strong></div>
          <div><span className="block text-teal-200">Fecha</span><strong>{dateLabel(evaluation.submittedAt || evaluation.updatedAt)}</strong></div>
          <div><span className="block text-teal-200">Estado</span><strong>{evaluation.status === 'SUBMITTED' ? 'Entregada' : 'Borrador'}</strong></div>
        </div>
      </header>

      <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <ResultCard
              icon={<Activity className="h-4 w-4" />}
              title="Desempeño SPPB"
              value={`${result.sppbTotal}/12 · ${result.sppbLabel}`}
              detail={`Equilibrio ${result.balanceScore}/4 · Marcha ${result.gaitScore}/4 · Silla ${result.chairScore}/4`}
            />
            <ResultCard
              icon={<PersonStanding className="h-4 w-4" />}
              title="Fuerza y sarcopenia"
              value={result.sarcopeniaLabel}
              detail={`Mejor prensión: ${result.gripBest ?? '—'} kg`}
              tone={result.probableSarcopenia ? 'amber' : 'teal'}
            />
            <ResultCard
              icon={<AlertTriangle className="h-4 w-4" />}
              title="Caídas"
              value={result.fallRiskLabel}
              detail={`TUG: ${tests.tugUnable ? 'no realizable' : tests.tugSeconds != null ? `${tests.tugSeconds} s` : '—'}`}
              tone={result.fallRiskLevel === 'PRIORITARIO' ? 'rose' : result.fallRiskLevel === 'ALTERADO' ? 'amber' : 'teal'}
            />
            <ResultCard
              icon={<Zap className="h-4 w-4" />}
              title="Potencia estimada"
              value={result.estimatedRelativePower != null ? `${result.estimatedRelativePower} W/kg · ${result.powerClassification}` : 'No calculable'}
              detail={`STS30: ${tests.sts30Repetitions ?? '—'} repeticiones · ${result.sts30Classification}`}
              tone="indigo"
            />
            <ResultCard
              icon={<CheckCircle2 className="h-4 w-4" />}
              title="Fragilidad FRAIL"
              value={`${result.frailScore}/5 · ${result.frailtyLabel}`}
              tone={result.frailtyLabel === 'FRAGIL' ? 'rose' : result.frailtyLabel === 'PREFRAGIL' ? 'amber' : 'teal'}
            />
            <ResultCard
              icon={<Brain className="h-4 w-4" />}
              title="Cribado cognitivo"
              value={result.cognitiveLabel}
              detail="Cribado breve; no corresponde a diagnóstico neurocognitivo."
              tone={result.cognitiveFlag ? 'amber' : 'teal'}
            />
          </div>

          <section className="rounded-2xl border border-slate-200 p-4">
            <h3 className="text-sm font-black text-slate-900">Resultados observados</h3>
            <dl className="mt-3 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-xs font-bold text-slate-400">Prensión derecha / izquierda</dt><dd className="font-bold text-slate-800">{result.gripRightMax ?? '—'} / {result.gripLeftMax ?? '—'} kg</dd></div>
              <div><dt className="text-xs font-bold text-slate-400">Velocidad de marcha</dt><dd className="font-bold text-slate-800">{result.gaitSpeedMps != null ? `${result.gaitSpeedMps} m/s` : '—'}</dd></div>
              <div><dt className="text-xs font-bold text-slate-400">Cinco levantadas</dt><dd className="font-bold text-slate-800">{tests.sppb.chair5.unableWithoutArms ? 'No realizable sin brazos' : tests.sppb.chair5.seconds != null ? `${tests.sppb.chair5.seconds} s` : '—'}</dd></div>
              <div><dt className="text-xs font-bold text-slate-400">Potencia absoluta estimada</dt><dd className="font-bold text-slate-800">{result.estimatedPowerWatts != null ? `${result.estimatedPowerWatts} W` : '—'}</dd></div>
            </dl>
          </section>

          {evaluation.data.clinicalObservations && (
            <section className="rounded-2xl border border-slate-200 p-4">
              <h3 className="text-sm font-black text-slate-900">Observaciones del evaluador</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{evaluation.data.clinicalObservations}</p>
            </section>
          )}
        </div>

        <aside className="rounded-3xl bg-slate-50 p-4">
          <h3 className="text-center text-sm font-black text-slate-900">Perfil funcional</h3>
          <FunctionalRadar values={result.radar} previous={previous?.results.radar} />
          {result.warnings.length > 0 && (
            <div className="mt-4 space-y-2">
              {result.warnings.map(warning => (
                <p key={warning} className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">
                  {warning}
                </p>
              ))}
            </div>
          )}
        </aside>
      </div>
      <footer className="border-t border-slate-100 px-5 py-4 text-[10px] leading-relaxed text-slate-400 sm:px-8">
        Resultados de cribado y desempeño funcional. Deben interpretarse junto con la situación clínica de la persona. La potencia mostrada es una estimación derivada del STS30 y no una medición instrumental directa.
      </footer>
    </section>
  );
}
