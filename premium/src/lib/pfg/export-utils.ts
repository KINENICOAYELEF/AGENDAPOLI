// ============================================================
// PFG — UTILIDADES DE EXPORTACIÓN
// CSV/JSON para investigación + PDF para deportista
// ============================================================

import type { PfgDeportista, PfgEvaluacion } from "@/types/pfg";
import { extraerValorMetrica } from "./calculations";

// ── CSV ───────────────────────────────────────────────────────

const CSV_HEADERS = [
  "id", "alias", "edad", "sexo", "peso_kg", "talla_cm", "pierna_dominante",
  "rodilla_indice", "categoria", "nivel", "freq_semanal", "anos_practica",
  "dx_compatible_pfp", "clas_sobrecarga", "clas_deficit_muscular",
  "clas_deficit_control", "clas_deficit_movilidad", "semana", "fecha_eval",
  "evaluador", "kujala", "ena_reposo", "ena_step_down", "calidad_step_down",
  "fuerza_ext_rodilla", "fuerza_abd_cadera", "fuerza_re_cadera",
  "algometria_valor", "algometria_zona", "validez_test", "observaciones",
];

function escapeCSV(val: string | number | boolean | null | undefined): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateCSV(
  deportistas: { deportista: PfgDeportista; evaluaciones: PfgEvaluacion[] }[]
): string {
  const rows: string[] = [CSV_HEADERS.join(",")];

  deportistas.forEach(({ deportista: d, evaluaciones }) => {
    if (evaluaciones.length === 0) {
      // Row with profile only
      rows.push([
        d.id, d.alias, d.edad, d.sexo, d.pesoKg, d.tallaCm, d.piernaDominante,
        d.rodillaIndice, d.categoriaKarate, d.nivelCompetitivo,
        d.frecuenciaSemanalEntrenamiento, d.anosPractica,
        d.diagnosticoOperativo.compatibleDolorPatelofemoral,
        d.clasificacionClinica.sobrecargaSobreuso,
        d.clasificacionClinica.deficitRendimientoMuscular,
        d.clasificacionClinica.deficitControlMovimiento,
        d.clasificacionClinica.deficitMovilidad,
        "", "", "", "", "", "", "", "", "", "", "", "", "",
      ].map(escapeCSV).join(","));
    } else {
      evaluaciones.forEach((ev) => {
        rows.push([
          d.id, d.alias, d.edad, d.sexo, d.pesoKg, d.tallaCm, d.piernaDominante,
          d.rodillaIndice, d.categoriaKarate, d.nivelCompetitivo,
          d.frecuenciaSemanalEntrenamiento, d.anosPractica,
          d.diagnosticoOperativo.compatibleDolorPatelofemoral,
          d.clasificacionClinica.sobrecargaSobreuso,
          d.clasificacionClinica.deficitRendimientoMuscular,
          d.clasificacionClinica.deficitControlMovimiento,
          d.clasificacionClinica.deficitMovilidad,
          ev.semana, ev.fecha, ev.evaluador,
          ev.kujala, ev.enaReposo,
          ev.stepDown.peorDolorENA, ev.stepDown.calidadMovimiento,
          ev.fuerzaExtensionRodilla.mejorValor,
          ev.fuerzaAbduccionCadera.mejorValor,
          ev.fuerzaRotacionExternaCadera.mejorValor,
          ev.algometria?.valorFinal, ev.algometria?.zonaAnatomica,
          ev.validezTest, ev.observaciones,
        ].map(escapeCSV).join(","));
      });
    }
  });

  return rows.join("\n");
}

// ── JSON ─────────────────────────────────────────────────────

export function generateJSON(
  deportistas: { deportista: PfgDeportista; evaluaciones: PfgEvaluacion[] }[],
  exportadoPorUid: string
) {
  return JSON.stringify(
    {
      proyecto: "PFG Dolor Patelofemoral en Karatekas Adolescentes",
      exportadoEn: new Date().toISOString(),
      exportadoPor: exportadoPorUid,
      n_deportistas: deportistas.length,
      deportistas: deportistas.map(({ deportista, evaluaciones }) => ({
        perfil: deportista,
        evaluaciones,
      })),
    },
    null,
    2
  );
}

// ── Download helper ──────────────────────────────────────────

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── PDF via html2canvas + jsPDF ──────────────────────────────

export async function generatePDF(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) {
    alert("No se encontró el contenedor para exportar");
    return;
  }

  const html2canvas = (await import("html2canvas")).default;
  const { jsPDF } = await import("jspdf");

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    backgroundColor: "#ffffff",
    logging: false,
  });

  const imgData = canvas.toDataURL("image/png");
  const imgWidth = 210; // A4 width in mm
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  const pdf = new jsPDF({
    orientation: imgHeight > 297 ? "portrait" : "portrait",
    unit: "mm",
    format: "a4",
  });

  // If content is taller than A4, split into pages
  const pageHeight = 297;
  let position = 0;

  if (imgHeight <= pageHeight) {
    pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight);
  } else {
    let remainingHeight = imgHeight;
    while (remainingHeight > 0) {
      pdf.addImage(imgData, "PNG", 0, position, imgWidth, imgHeight);
      remainingHeight -= pageHeight;
      position -= pageHeight;
      if (remainingHeight > 0) {
        pdf.addPage();
      }
    }
  }

  pdf.save(filename);
}
