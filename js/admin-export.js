// js/admin-export.js
// Lógica para exportación segura de datos (Tarea Pre-Fase)
import { db } from './firebase-config.js';

// Cache local de datos analizados
let analyzedPatients = [];
let totalEvolutionsCount = 0;
let isExporting = false;
let cancelExportFlag = false;

// Configuración de Seguridad Simulada
const ADMIN_PASSCODE = "docente2026"; // Passcode requerido para mostrar pestaña

document.addEventListener('DOMContentLoaded', () => {
    setupAdminUI();
    loadAuditHistory();
});

function setupAdminUI() {
    const userAvatar = document.getElementById('userAvatarBtn');
    const adminMenuBtn = document.getElementById('adminMenuBtn');

    // 1. Doble clic para activar panel admin (Oculto)
    if (userAvatar) {
        userAvatar.addEventListener('dblclick', () => {
            const code = prompt("Ingrese código de acceso para Admin Docente:");
            if (code === ADMIN_PASSCODE) {
                if (window.showToast) window.showToast("Acceso de Docente Concedido", "success");
                if (adminMenuBtn) adminMenuBtn.style.display = 'flex';

                // Activar comportamiento del botón menú admin
                adminMenuBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    showAdminPanel();
                });
            } else if (code) {
                if (window.showToast) window.showToast("Código incorrecto", "error");
            }
        });
    }

    // Bind de botones del panel
    document.getElementById('btnAdminAnalyze')?.addEventListener('click', analyzeData);
    document.getElementById('btnAdminExportJson')?.addEventListener('click', exportJson);
    document.getElementById('btnAdminExportCsv')?.addEventListener('click', exportCsv);
    document.getElementById('btnAdminCancel')?.addEventListener('click', cancelExport);
    document.getElementById('btnAdminClearAudit')?.addEventListener('click', clearAuditHistory);
}

function showAdminPanel() {
    // Esconder el visor normal de contenido
    const currentContent = document.getElementById('mainContent')?.querySelector('.content');
    if (currentContent) currentContent.style.display = 'none';

    // Quitar active a otros items
    document.querySelectorAll('.menu-item').forEach(i => i.classList.remove('active'));
    document.getElementById('adminMenuBtn').classList.add('active');

    // Mostrar panel
    const adminPanel = document.getElementById('adminPanel');
    if (adminPanel) adminPanel.style.display = 'flex';

    bindAdminButtons();
}

function bindAdminButtons() {
    console.log("Forzando binding de botones admin");
    const bAnalyze = document.getElementById('btnAdminAnalyze');
    const bJson = document.getElementById('btnAdminExportJson');
    const bCsv = document.getElementById('btnAdminExportCsv');
    const bCancel = document.getElementById('btnAdminCancel');
    const bClear = document.getElementById('btnAdminClearAudit');

    if (bAnalyze) {
        const newB = bAnalyze.cloneNode(true);
        bAnalyze.parentNode.replaceChild(newB, bAnalyze);
        newB.addEventListener('click', analyzeData);
    }
    if (bJson) {
        const newJ = bJson.cloneNode(true);
        bJson.parentNode.replaceChild(newJ, bJson);
        newJ.addEventListener('click', exportJson);
    }
    if (bCsv) {
        const newC = bCsv.cloneNode(true);
        bCsv.parentNode.replaceChild(newC, bCsv);
        newC.addEventListener('click', exportCsv);
    }
    if (bCancel) {
        const newCa = bCancel.cloneNode(true);
        bCancel.parentNode.replaceChild(newCa, bCancel);
        newCa.addEventListener('click', cancelExport);
    }
    if (bClear) {
        const newCl = bClear.cloneNode(true);
        bClear.parentNode.replaceChild(newCl, bClear);
        newCl.addEventListener('click', clearAuditHistory);
    }
}

// Fase 1: Análisis (Solo lectura de usuarias)
async function analyzeData() {
    console.log("==> analyzeData EJECUTADO <==");
    if (window.showToast) window.showToast("Iniciando análisis...", "info");

    if (!db) {
        if (window.showToast) window.showToast("Error: Base de datos no inicializada", "error");
        alert("Error crítico: Firebase DB no cargada");
        return;
    }

    try {
        const analyzeBtn = document.getElementById('btnAdminAnalyze');
        const jsonBtn = document.getElementById('btnAdminExportJson');
        const csvBtn = document.getElementById('btnAdminExportCsv');

        analyzeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Analizando...';
        analyzeBtn.disabled = true;
        jsonBtn.disabled = true;
        csvBtn.disabled = true;

        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        const patientsRef = collection(db, "patients");
        const snapshot = await getDocs(patientsRef);

        analyzedPatients = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const totalCount = analyzedPatients.length;
        if (window.showToast) window.showToast(`Análisis completado: Se detectaron ${totalCount} usuarias.`, "info");

        const exportBy = document.getElementById('exportExportedBy');
        if (!exportBy.value) {
            const userRole = document.querySelector('.user-name')?.innerText || 'Docente';
            exportBy.value = userRole;
        }

        analyzeBtn.innerHTML = '<i class="fas fa-check"></i> Análisis Listo (' + totalCount + ' usuarias)';
        jsonBtn.disabled = false;
        csvBtn.disabled = false;

    } catch (error) {
        console.error("Error en análisis:", error);
        if (window.showToast) window.showToast("Error al analizar datos: " + error.message, "error");
        document.getElementById('btnAdminAnalyze').innerHTML = '<i class="fas fa-search"></i> 1. Analizar Datos';
        document.getElementById('btnAdminAnalyze').disabled = false;
    }
}

// Función común de extracción profunda (Secuencial y Segura)
async function performDeepExtraction() {
    if (isExporting) return null;
    isExporting = true;
    cancelExportFlag = false;

    const progressContainer = document.getElementById('adminProgressContainer');
    const progressBar = document.getElementById('adminProgressBar');
    const progressText = document.getElementById('adminProgressText');
    const progressPercentage = document.getElementById('adminProgressPercentage');
    const errorsContainer = document.getElementById('adminExportErrors');

    progressContainer.style.display = 'block';
    errorsContainer.style.display = 'none';
    errorsContainer.innerHTML = '';

    const errors = [];
    const total = analyzedPatients.length;
    let completed = 0;
    let totalEvolutions = 0;
    const programYear = parseInt(document.getElementById('exportProgramYear').value) || new Date().getFullYear();

    const fullData = [];

    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");

        for (const patient of analyzedPatients) {
            if (cancelExportFlag) {
                progressText.innerText = "Operación cancelada por el usuario.";
                break;
            }

            try {
                // Actualizar interfaz
                progressText.innerText = `Cargando evoluciones: ${patient.name} (${completed + 1}/${total})...`;
                const percentage = Math.round((completed / total) * 100);
                progressBar.style.width = `${percentage}%`;
                progressPercentage.innerText = `${percentage}%`;

                // Inyectar programYear a la usuaria
                patient.programYear = programYear;

                // Cargar Subcolección
                const evolutionsRef = collection(db, "patients", patient.id, "evolutions");
                const evoSnapshot = await getDocs(evolutionsRef);

                const patientEvolutions = evoSnapshot.docs.map(evoDoc => {
                    const data = evoDoc.data();
                    // Normalizar Fechas y añadir programYear
                    data.programYear = programYear;
                    data.normalizedDate = normalizeIsoDate(data.date, data.createdAt);
                    return { id: evoDoc.id, ...data };
                });

                // Ordenar cronológicamente
                patientEvolutions.sort((a, b) => new Date(a.normalizedDate) - new Date(b.normalizedDate));

                totalEvolutions += patientEvolutions.length;

                fullData.push({
                    usuaria: patient,
                    evoluciones: patientEvolutions
                });

            } catch (err) {
                console.error(`Error procesando usuaria ${patient.id}`, err);
                errors.push(`Fallo al cargar usuaria ${patient.name || patient.id}: ${err.message}`);
                errorsContainer.style.display = 'block';
                errorsContainer.innerHTML += `<div>Fallo en ${patient.name || patient.id}</div>`;
            }

            completed++;
        }

        if (!cancelExportFlag) {
            progressBar.style.width = `100%`;
            progressPercentage.innerText = `100%`;
            progressText.innerText = `Extracción completa: ${totalEvolutions} evoluciones listas.`;
        }

    } catch (globalError) {
        console.error("Error global de extracción:", globalError);
        errors.push("Error fatal en ciclo de extracción: " + globalError.message);
    }

    isExporting = false;

    if (cancelExportFlag) {
        setTimeout(() => { progressContainer.style.display = 'none'; }, 2000);
        return null;
    }

    // Registrar en auditoría
    const exportedBy = document.getElementById('exportExportedBy').value || 'Docente Anónimo';
    recordAudit(exportedBy, programYear, completed, totalEvolutions, errors.length > 0 ? "Completado con errores" : "Exitoso", errors);

    return {
        programYear,
        exportedBy,
        counts: { usuarias: completed, evoluciones: totalEvolutions },
        errors,
        data: fullData
    };
}

async function exportJson() {
    const extracted = await performDeepExtraction();
    if (!extracted) return;

    const payload = {
        exportMeta: {
            programYear: extracted.programYear,
            exportedAtISO: new Date().toISOString(),
            exportedBy: extracted.exportedBy,
            schemaVersion: "1.0-legacy",
            counts: extracted.counts,
            legacySourcePathSummary: "Firebase/patients->evolutions",
            errors: extracted.errors
        },
        data: extracted.data
    };

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(payload, null, 2));
    triggerDownload(dataStr, `Respaldo_SISTEMAKINE_${extracted.programYear}_JSON.json`);
}

async function exportCsv() {
    const extracted = await performDeepExtraction();
    if (!extracted) return;

    // Resumen: Nombre Usuaria | RUT | Cantidad Evoluciones | Fecha Primera ISO | Fecha Última ISO | Año Programa
    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Nombre Usuaria,Identificador (RUT),Cantidad Evoluciones,Fecha Primera Ev.,Fecha Ultima Ev.,Año Programa\n";

    extracted.data.forEach(item => {
        const u = item.usuaria;
        const evos = item.evoluciones;

        const name = escapeCsvRule(u.name || "Sin nombre");
        const rut = escapeCsvRule(u.rut || u.id);
        const count = evos.length;
        const first = evos.length > 0 ? evos[0].normalizedDate : "N/A";
        const last = evos.length > 0 ? evos[evos.length - 1].normalizedDate : "N/A";

        csvContent += `${name},${rut},${count},${first},${last},${extracted.programYear}\n`;
    });

    triggerDownload(csvContent, `Resumen_SISTEMAKINE_${extracted.programYear}_CSV.csv`);
}

function cancelExport() {
    if (isExporting) {
        cancelExportFlag = true;
    }
}

// Utilidades de Normalización y Descarga
function normalizeIsoDate(possibleDate, possibleTimestamp) {
    if (possibleDate && possibleDate.length >= 10) {
        // Asumiendo YYYY-MM-DD
        return new Date(possibleDate).toISOString();
    }
    if (possibleTimestamp) {
        return new Date(possibleTimestamp).toISOString();
    }
    return new Date().toISOString();
}

function escapeCsvRule(field) {
    if (field == null) return '""';
    const str = String(field);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

function triggerDownload(dataUri, filename) {
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataUri);
    downloadAnchorNode.setAttribute("download", filename);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

// Auditoría
function recordAudit(exportedBy, year, usuariasCount, evosCount, status, errors) {
    const history = JSON.parse(localStorage.getItem('exportAuditHist') || '[]');
    history.unshift({
        exportedAtISO: new Date().toISOString(),
        exportedBy,
        programYear: year,
        usuariasCount,
        evolucionesCount: evosCount,
        status,
        errorIfAny: errors.length > 0 ? errors.length + " errores" : null
    });

    // Mantener los últimos 50
    if (history.length > 50) history.pop();

    localStorage.setItem('exportAuditHist', JSON.stringify(history));
    loadAuditHistory();
}

function loadAuditHistory() {
    const tbody = document.getElementById('adminAuditTableBody');
    if (!tbody) return;

    const history = JSON.parse(localStorage.getItem('exportAuditHist') || '[]');

    if (history.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="padding: 15px; text-align: center; color: var(--text-secondary);">No hay registros de auditoría locales.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    history.forEach(log => {
        const dateStr = new Date(log.exportedAtISO).toLocaleString();
        const tr = document.createElement('tr');
        tr.style.borderBottom = "1px solid var(--border-color)";
        tr.innerHTML = `
            <td style="padding: 10px;">${dateStr}</td>
            <td style="padding: 10px;">${log.exportedBy}</td>
            <td style="padding: 10px;">${log.programYear}</td>
            <td style="padding: 10px;">${log.usuariasCount}</td>
            <td style="padding: 10px;">${log.evolucionesCount}</td>
            <td style="padding: 10px;">
                <span style="color: ${log.status.includes('Exito') ? '#4CAF50' : '#FF9800'}">${log.status}</span>
                ${log.errorIfAny ? `<div style="font-size:11px;color:#F44336">${log.errorIfAny}</div>` : ''}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function clearAuditHistory() {
    if (confirm("¿Está seguro que desea borrar todo el historial de auditoría de este navegador?")) {
        localStorage.removeItem('exportAuditHist');
        loadAuditHistory();
    }
}
