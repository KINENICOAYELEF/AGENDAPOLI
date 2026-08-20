import type { jsPDF as JsPdfDocument } from 'jspdf';
import type { OlderAdultEvaluation } from './types';

type Rgb = [number, number, number];

const COLORS = {
  ink: [15, 23, 42] as Rgb,
  muted: [100, 116, 139] as Rgb,
  line: [226, 232, 240] as Rgb,
  teal: [15, 118, 110] as Rgb,
  tealDark: [4, 47, 46] as Rgb,
  tealSoft: [240, 253, 250] as Rgb,
  amber: [180, 83, 9] as Rgb,
  amberSoft: [255, 251, 235] as Rgb,
  rose: [190, 24, 93] as Rgb,
  roseSoft: [255, 241, 242] as Rgb,
  indigo: [67, 56, 202] as Rgb,
  indigoSoft: [238, 242, 255] as Rgb,
  white: [255, 255, 255] as Rgb,
};

const clean = (value: unknown, fallback = '—') => {
  const text = String(value ?? '').trim();
  return text || fallback;
};

const dateLabel = (value?: string) => value
  ? new Intl.DateTimeFormat('es-CL', { dateStyle: 'long' }).format(new Date(value))
  : 'Sin fecha';

const fileDateLabel = (value?: string) => {
  if (!value) return 'sin-fecha';
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'America/Santiago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
};

const fileSafe = (value: string) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
  .toLowerCase();

function setTextColor(doc: JsPdfDocument, color: Rgb) {
  doc.setTextColor(color[0], color[1], color[2]);
}

function setFillColor(doc: JsPdfDocument, color: Rgb) {
  doc.setFillColor(color[0], color[1], color[2]);
}

function setDrawColor(doc: JsPdfDocument, color: Rgb) {
  doc.setDrawColor(color[0], color[1], color[2]);
}

function addWrappedText(
  doc: JsPdfDocument,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight = 4.5,
) {
  const lines = doc.splitTextToSize(clean(text), maxWidth) as string[];
  doc.text(lines, x, y);
  return y + Math.max(1, lines.length) * lineHeight;
}

function drawMetricCard(doc: JsPdfDocument, options: {
  x: number;
  y: number;
  width: number;
  title: string;
  value: string;
  detail: string;
  accent: Rgb;
  background: Rgb;
}) {
  const { x, y, width, title, value, detail, accent, background } = options;
  setFillColor(doc, background);
  setDrawColor(doc, COLORS.line);
  doc.roundedRect(x, y, width, 29, 3, 3, 'FD');
  setFillColor(doc, accent);
  doc.roundedRect(x + 3, y + 4, 1.5, 21, 0.75, 0.75, 'F');
  setTextColor(doc, accent);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(title.toUpperCase(), x + 8, y + 7);
  setTextColor(doc, COLORS.ink);
  doc.setFontSize(11);
  const valueLines = doc.splitTextToSize(value, width - 13) as string[];
  doc.text(valueLines.slice(0, 2), x + 8, y + 13);
  setTextColor(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  const detailLines = doc.splitTextToSize(detail, width - 13) as string[];
  doc.text(detailLines.slice(0, 2), x + 8, y + 23);
}

function radarPoints(values: number[], cx: number, cy: number, radius: number) {
  return values.map((value, index) => {
    const angle = -Math.PI / 2 + index * ((Math.PI * 2) / values.length);
    const scaledRadius = radius * Math.max(0, Math.min(100, value)) / 100;
    return [cx + Math.cos(angle) * scaledRadius, cy + Math.sin(angle) * scaledRadius] as [number, number];
  });
}

function drawPolygon(doc: JsPdfDocument, points: Array<[number, number]>, color: Rgb, width = 0.7) {
  setDrawColor(doc, color);
  doc.setLineWidth(width);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    doc.line(point[0], point[1], next[0], next[1]);
  });
}

function drawRadar(
  doc: JsPdfDocument,
  values: OlderAdultEvaluation['results']['radar'],
  previous?: OlderAdultEvaluation['results']['radar'],
) {
  const cx = 105;
  const cy = 91;
  const radius = 37;
  const labels = ['Prensión', 'Potencia MMII', 'Movilidad', 'Marcha', 'Equilibrio'];
  const currentValues = [values.grip, values.lowerLimbPower, values.mobility, values.gait, values.balance];
  const previousValues = previous
    ? [previous.grip, previous.lowerLimbPower, previous.mobility, previous.gait, previous.balance]
    : null;

  [25, 50, 75, 100].forEach(level => {
    const frame = radarPoints([level, level, level, level, level], cx, cy, radius);
    drawPolygon(doc, frame, COLORS.line, 0.3);
  });
  const outer = radarPoints([100, 100, 100, 100, 100], cx, cy, radius);
  outer.forEach(point => {
    setDrawColor(doc, COLORS.line);
    doc.setLineWidth(0.3);
    doc.line(cx, cy, point[0], point[1]);
  });
  if (previousValues) drawPolygon(doc, radarPoints(previousValues, cx, cy, radius), COLORS.muted, 0.6);
  drawPolygon(doc, radarPoints(currentValues, cx, cy, radius), COLORS.teal, 1.2);
  radarPoints(currentValues, cx, cy, radius).forEach(point => {
    setFillColor(doc, COLORS.teal);
    doc.circle(point[0], point[1], 1.25, 'F');
  });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  setTextColor(doc, COLORS.ink);
  outer.forEach((point, index) => {
    const label = labels[index];
    const width = doc.getTextWidth(label);
    const dx = point[0] < cx - 2 ? -width - 3 : point[0] > cx + 2 ? 3 : -width / 2;
    const dy = point[1] < cy ? -2.5 : 4.5;
    doc.text(label, point[0] + dx, point[1] + dy);
  });
}

export async function createOlderAdultEvaluationPdf(
  evaluation: OlderAdultEvaluation,
  previous?: OlderAdultEvaluation,
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
  const result = evaluation.results;
  const tests = evaluation.data.tests;
  const pageWidth = 210;
  const margin = 16;
  const contentWidth = pageWidth - margin * 2;

  doc.setProperties({
    title: `Informe funcional - ${evaluation.participantSnapshot.fullName}`,
    subject: 'Evaluación funcional del Taller de Adulto Mayor',
    author: 'Polideportivo',
    creator: 'Agenda Poli',
  });

  setFillColor(doc, COLORS.tealDark);
  doc.rect(0, 0, pageWidth, 43, 'F');
  setFillColor(doc, COLORS.teal);
  doc.circle(194, 5, 34, 'F');
  setTextColor(doc, COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text('POLIDEPORTIVO · TALLER DE ADULTO MAYOR', margin, 13);
  doc.setFontSize(23);
  doc.text('Informe funcional', margin, 25);
  doc.setFontSize(11);
  doc.text(clean(evaluation.participantSnapshot.fullName), margin, 34);

  const metadata = [
    ['Edad', evaluation.participantSnapshot.age != null ? `${evaluation.participantSnapshot.age} años` : 'No registrada'],
    ['Evaluador/a', clean(evaluation.evaluatorName)],
    ['Fecha', dateLabel(evaluation.submittedAt || evaluation.updatedAt)],
    ['Estado', evaluation.status === 'SUBMITTED' ? 'Entregada' : 'Borrador'],
  ];
  const metaWidth = contentWidth / 4;
  metadata.forEach(([label, value], index) => {
    const x = margin + index * metaWidth;
    setTextColor(doc, COLORS.muted);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text(label.toUpperCase(), x, 51);
    setTextColor(doc, COLORS.ink);
    doc.setFontSize(8.5);
    const lines = doc.splitTextToSize(value, metaWidth - 4) as string[];
    doc.text(lines.slice(0, 2), x, 57);
  });

  const cards = [
    {
      title: 'Desempeño SPPB', value: `${result.sppbTotal}/12 · ${result.sppbLabel}`,
      detail: `Equilibrio ${result.balanceScore}/4 · Marcha ${result.gaitScore}/4 · Silla ${result.chairScore}/4`,
      accent: COLORS.teal, background: COLORS.tealSoft,
    },
    {
      title: 'Fuerza y sarcopenia', value: result.sarcopeniaLabel,
      detail: `Mejor prensión: ${result.gripBest ?? '—'} kg`,
      accent: result.probableSarcopenia ? COLORS.amber : COLORS.teal,
      background: result.probableSarcopenia ? COLORS.amberSoft : COLORS.tealSoft,
    },
    {
      title: 'Caídas', value: result.fallRiskLabel,
      detail: `TUG: ${tests.tugUnable ? 'no realizable' : tests.tugSeconds != null ? `${tests.tugSeconds} s` : '—'}`,
      accent: result.fallRiskLevel === 'PRIORITARIO' ? COLORS.rose : result.fallRiskLevel === 'ALTERADO' ? COLORS.amber : COLORS.teal,
      background: result.fallRiskLevel === 'PRIORITARIO' ? COLORS.roseSoft : result.fallRiskLevel === 'ALTERADO' ? COLORS.amberSoft : COLORS.tealSoft,
    },
    {
      title: 'Potencia estimada',
      value: result.estimatedRelativePower != null ? `${result.estimatedRelativePower} W/kg · ${result.powerClassification}` : 'No calculable',
      detail: `STS30: ${tests.sts30Repetitions ?? '—'} repeticiones · ${result.sts30Classification}`,
      accent: COLORS.indigo, background: COLORS.indigoSoft,
    },
    {
      title: 'Fragilidad FRAIL', value: `${result.frailScore}/5 · ${result.frailtyLabel}`,
      detail: 'Cribado funcional breve.',
      accent: result.frailtyLabel === 'FRAGIL' ? COLORS.rose : result.frailtyLabel === 'PREFRAGIL' ? COLORS.amber : COLORS.teal,
      background: result.frailtyLabel === 'FRAGIL' ? COLORS.roseSoft : result.frailtyLabel === 'PREFRAGIL' ? COLORS.amberSoft : COLORS.tealSoft,
    },
    {
      title: 'Cribado cognitivo', value: result.cognitiveLabel,
      detail: 'Orientación, memoria referida y recuerdo breve.',
      accent: result.cognitiveFlag ? COLORS.amber : COLORS.teal,
      background: result.cognitiveFlag ? COLORS.amberSoft : COLORS.tealSoft,
    },
  ];
  cards.forEach((card, index) => drawMetricCard(doc, {
    ...card,
    x: margin + (index % 2) * 91,
    y: 67 + Math.floor(index / 2) * 33,
    width: 87,
  }));

  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text('Resultados observados', margin, 174);
  setDrawColor(doc, COLORS.line);
  doc.line(margin, 178, pageWidth - margin, 178);
  const observed = [
    ['Prensión derecha / izquierda', `${result.gripRightMax ?? '—'} / ${result.gripLeftMax ?? '—'} kg`],
    ['Velocidad de marcha', result.gaitSpeedMps != null ? `${result.gaitSpeedMps} m/s` : '—'],
    ['Cinco levantadas', tests.sppb.chair5.unableWithoutArms ? 'No realizable sin brazos' : tests.sppb.chair5.seconds != null ? `${tests.sppb.chair5.seconds} s` : '—'],
    ['Potencia absoluta estimada', result.estimatedPowerWatts != null ? `${result.estimatedPowerWatts} W` : '—'],
    ['STS30', tests.sts30Repetitions != null ? `${tests.sts30Repetitions} repeticiones` : '—'],
    ['TUG', tests.tugUnable ? 'No realizable' : tests.tugSeconds != null ? `${tests.tugSeconds} s` : '—'],
  ];
  observed.forEach(([label, value], index) => {
    const column = index % 2;
    const row = Math.floor(index / 2);
    const x = margin + column * 91;
    const y = 187 + row * 16;
    setTextColor(doc, COLORS.muted);
    doc.setFontSize(7.5);
    doc.setFont('helvetica', 'bold');
    doc.text(label.toUpperCase(), x, y);
    setTextColor(doc, COLORS.ink);
    doc.setFontSize(10);
    doc.text(value, x, y + 5);
  });

  doc.addPage();
  setFillColor(doc, COLORS.tealDark);
  doc.rect(0, 0, pageWidth, 20, 'F');
  setTextColor(doc, COLORS.white);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('PERFIL FUNCIONAL Y OBSERVACIONES', margin, 13);
  setTextColor(doc, COLORS.ink);
  doc.setFontSize(15);
  doc.text('Perfil de desempeño', margin, 33);
  setTextColor(doc, COLORS.muted);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(previous ? 'Línea teal: evaluación actual · Línea gris: evaluación anterior' : 'Escala relativa de 0 a 100 para facilitar el seguimiento.', margin, 39);
  drawRadar(doc, result.radar, previous?.results.radar);

  let y = 139;
  if (result.warnings.length) {
    setFillColor(doc, COLORS.amberSoft);
    setDrawColor(doc, [253, 230, 138]);
    const warningLines = result.warnings.flatMap(item => doc.splitTextToSize(`• ${item}`, contentWidth - 12) as string[]);
    const warningHeight = Math.max(20, 12 + warningLines.length * 4.2);
    doc.roundedRect(margin, y, contentWidth, warningHeight, 3, 3, 'FD');
    setTextColor(doc, COLORS.amber);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.text('ASPECTOS A CONSIDERAR', margin + 6, y + 7);
    setTextColor(doc, COLORS.ink);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.text(warningLines, margin + 6, y + 13);
    y += warningHeight + 8;
  }

  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Observaciones del evaluador', margin, y);
  y += 7;
  setFillColor(doc, [248, 250, 252]);
  setDrawColor(doc, COLORS.line);
  const observations = clean(evaluation.data.clinicalObservations, 'Sin observaciones adicionales registradas.');
  const observationLines = doc.splitTextToSize(observations, contentWidth - 12) as string[];
  const observationHeight = Math.max(30, 12 + observationLines.length * 4.5);
  if (y + observationHeight > 270) {
    doc.addPage();
    y = 24;
  }
  doc.roundedRect(margin, y, contentWidth, observationHeight, 3, 3, 'FD');
  setTextColor(doc, COLORS.ink);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  addWrappedText(doc, observations, margin + 6, y + 8, contentWidth - 12, 4.5);

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    setDrawColor(doc, COLORS.line);
    doc.line(margin, 282, pageWidth - margin, 282);
    setTextColor(doc, COLORS.muted);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.text('Cribado y desempeño funcional. Interpretar junto con la situación clínica. La potencia es una estimación derivada del STS30.', margin, 287);
    doc.text(`${page}/${pageCount}`, pageWidth - margin, 287, { align: 'right' });
  }

  const date = fileDateLabel(evaluation.submittedAt || evaluation.updatedAt);
  const filename = `informe-funcional-${fileSafe(evaluation.participantSnapshot.fullName) || 'persona'}-${date}.pdf`;
  return { doc, filename };
}

export async function downloadOlderAdultEvaluationPdf(
  evaluation: OlderAdultEvaluation,
  previous?: OlderAdultEvaluation,
) {
  const { doc, filename } = await createOlderAdultEvaluationPdf(evaluation, previous);
  doc.save(filename);
  return filename;
}
