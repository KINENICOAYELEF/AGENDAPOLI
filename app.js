// app.js - Inicialización y control principal de la aplicación

import { initFirebase, testFirebase } from './firebase-config.js';
import { getPatients, addPatient, updatePatient, addEvolution, getEvolutions } from './data-services.js';
import { renderPatients, openPatientModal, fillPersonalData, fillEvolutionsTab } from './ui-patients.js';
import { showNewEvolutionModal, setupScalesControls, addPsfsActivity, setupExerciseTable, setupCommandShortcuts } from './ui-evolutions.js';
import { setupNavigation } from './navigation.js';
import { showLoading, hideLoading, showToast, formatDate } from './utils.js';
import { initDiagnosisTab, saveDiagnosis } from './ui-diagnosis.js';
import { loadCustomTemplates } from './ui-exercises.js';
import { exportToPDF } from './pdf-export.js';

/**
 * Variables globales
 */
let currentPatientId = null;
let patientsCache = []; // Para almacenar pacientes y reducir consultas
let customTemplates = [];

// Exportar para acceso desde otros módulos
export { currentPatientId, patientsCache, customTemplates };

/**
 * Inicializa la aplicación
 */
async function initApp() {
    try {
        console.log("Inicializando aplicación...");
        
        // Inicializar Firebase
        const firebaseInitialized = await initFirebase();
        if (!firebaseInitialized) {
            console.error("Error crítico: No se pudo inicializar Firebase");
            document.body.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h1>Error de conexión</h1>
                    <p>No se pudo conectar con la base de datos. Por favor, intente recargar la página.</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px;">Recargar</button>
                </div>
            `;
            return;
        }
        
        // Guardar el contenido original del dashboard
        const originalContent = document.querySelector('.content');
        if (originalContent) {
            // Guardar el HTML completo para poder restaurarlo después
            const dashboardContent = originalContent.outerHTML;
            window.dashboardContent = dashboardContent;
        }
        
        // Establecer fecha actual para nuevas evoluciones
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
        
        // Establecer valores por defecto en el formulario de evolución
        const dateInput = document.getElementById('evolutionDate');
        if (dateInput) dateInput.value = today;
        
        const timeInput = document.getElementById('evolutionTime');
        if (timeInput) timeInput.value = now;
        
        // Configurar navegación
        setupNavigation();
        
        // Configurar eventos del PDF para opciones personalizadas
        const pdfPeriodSelect = document.getElementById('pdfEvolutionPeriod');
        if (pdfPeriodSelect) {
            pdfPeriodSelect.addEventListener('change', function() {
                const customDateRange = document.getElementById('pdfCustomDateRange');
                if (customDateRange) {
                    customDateRange.style.display = this.value === 'custom' ? 'block' : 'none';
                }
            });
        }
        
        // Configurar previsualización de archivos adjuntos
        const evolutionAttachments = document.getElementById('evolutionAttachments');
        if (evolutionAttachments) {
            evolutionAttachments.addEventListener('change', function() {
                const previewContainer = document.getElementById('attachmentPreview');
                if (!previewContainer) return;
                
                previewContainer.innerHTML = '';
                
                Array.from(this.files).forEach(file => {
                    const isImage = file.type.startsWith('image/');
                    const attachment = document.createElement('div');
                    attachment.className = 'attachment';
                    
                    if (isImage) {
                        const img = document.createElement('img');
                        img.src = URL.createObjectURL(file);
                        img.alt = file.name;
                        attachment.appendChild(img);
                    } else {
                        attachment.innerHTML = `<img src="https://via.placeholder.com/100x100/e9ecef/495057?text=${file.name.split('.').pop().toUpperCase()}" alt="${file.name}">`;
                    }
                    
                    const typeLabel = document.createElement('div');
                    typeLabel.className = 'attachment-type';
                    typeLabel.textContent = isImage ? 'Foto' : file.name.split('.').pop().toUpperCase();
                    attachment.appendChild(typeLabel);
                    
                    previewContainer.appendChild(attachment);
                });
            });
        }
        
        // Configurar controles de escalas
        setupScalesControls();
        
        // Configurar tabla de ejercicios
        setupExerciseTable();
        
        // Configurar comandos rápidos
        setupCommandShortcuts();
        
        // Añadir event listener para pestañas
        const tabs = document.querySelectorAll('.tab');
        const tabContents = document.querySelectorAll('.tab-content');
        
        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                // Remover clase activa de todas las pestañas y contenidos
                tabs.forEach(t => t.classList.remove('active'));
                tabContents.forEach(c => c.classList.remove('active'));
                
                // Añadir clase activa a la pestaña clicada y su contenido correspondiente
                this.classList.add('active');
                const tabId = this.getAttribute('data-tab');
                const targetTab = document.getElementById(tabId + 'Tab');
                if (targetTab) targetTab.classList.add('active');
            });
        });
        
        // Añadir event listener para cabeceras de acordeón
        const accordions = document.querySelectorAll('.accordion-header');
        
        accordions.forEach(accordion => {
            accordion.addEventListener('click', function() {
                this.parentElement.classList.toggle('active');
            });
        });
        
        // Añadir event listener para formulario de nuevo paciente
        const patientForm = document.getElementById('patientForm');
        if (patientForm) {
            patientForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const formData = new FormData(this);
                const patientData = {};
                
                for (const [key, value] of formData.entries()) {
                    patientData[key] = value;
                }
                
                // Añadir paciente a Firebase
                const patientId = await addPatient(patientData);
                
                if (patientId) {
                    // Cerrar modal
                    const modal = document.getElementById('newPatientModal');
                    if (modal) modal.classList.remove('active');
                    
                    // Limpiar formulario
                    this.reset();
                    
                    // Abrir modal del nuevo paciente
                    setTimeout(() => {
                        openPatientModal(patientId);
                    }, 500);
                }
            });
        }
        
        // Añadir event listener para botón de añadir paciente en página principal
        const addPatientBtn = document.getElementById('addPatientBtn');
        if (addPatientBtn) {
            addPatientBtn.addEventListener('click', function() {
                const modal = document.getElementById('newPatientModal');
                if (modal) modal.classList.add('active');
            });
        }
        
        // Añadir event listener para botón de añadir evolución en página principal
        const addEvolutionBtn = document.getElementById('addEvolutionBtn');
        if (addEvolutionBtn) {
            addEvolutionBtn.addEventListener('click', showNewEvolutionModal);
        }
        
        // Botones de cerrar modales
        document.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', function() {
                // Encontrar el ancestro modal-overlay y quitarle la clase active
                let parent = this.closest('.modal-overlay');
                if (parent) {
                    parent.classList.remove('active');
                }
            });
        });
        
        // Botones de cancelar específicos
        const cancelEvolutionBtn = document.getElementById('cancelEvolutionBtn');
        if (cancelEvolutionBtn) {
            cancelEvolutionBtn.addEventListener('click', function() {
                const modal = document.getElementById('newEvolutionModal');
                if (modal) modal.classList.remove('active');
            });
        }
        
        const cancelPatientBtn = document.getElementById('cancelPatientBtn');
        if (cancelPatientBtn) {
            cancelPatientBtn.addEventListener('click', function() {
                const modal = document.getElementById('newPatientModal');
                if (modal) modal.classList.remove('active');
            });
        }
        
        // Añadir event listener para guardar datos del paciente
        const savePatientBtn = document.getElementById('savePatientBtn');
        if (savePatientBtn) {
            savePatientBtn.addEventListener('click', async function() {
                if (!currentPatientId) {
                    showToast("Error: No hay paciente seleccionado", "error");
                    return;
                }
                
                // Obtener datos del paciente del formulario
                const patientData = {
                    name: document.getElementById('patientName')?.value,
                    rut: document.getElementById('patientRut')?.value,
                    birthDate: document.getElementById('patientBirthDate')?.value,
                    phone: document.getElementById('patientPhone')?.value,
                    email: document.getElementById('patientEmail')?.value || '',
                    address: document.getElementById('patientAddress')?.value || '',
                    medicalHistory: document.getElementById('patientMedicalHistory')?.value || '',
                    medications: document.getElementById('patientMedications')?.value || '',
                    allergies: document.getElementById('patientAllergies')?.value || '',
                    emergencyContact: document.getElementById('patientEmergencyContact')?.value || '',
                    emergencyPhone: document.getElementById('patientEmergencyPhone')?.value || ''
                };
                
                // Actualizar datos del paciente
                await updatePatient(currentPatientId, patientData);
                
                // Refrescar lista de pacientes
                await getPatients();
            });
        }
        
        // Añadir event listener para búsqueda
        const searchInput = document.getElementById('searchPatient');
        if (searchInput) {
            searchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const patientCards = document.querySelectorAll('.patient-card');
                
                patientCards.forEach(card => {
                    const name = card.querySelector('.patient-name')?.textContent.toLowerCase() || '';
                    const rut = card.querySelector('.patient-rut')?.textContent.toLowerCase() || '';
                    
                    if (name.includes(searchTerm) || rut.includes(searchTerm)) {
                        card.style.display = 'block';
                    } else {
                        card.style.display = 'none';
                    }
                });
            });
        }
        
        // Añadir event listener para botón de exportar PDF
        const exportPdfBtn = document.getElementById('exportPdfBtn');
        if (exportPdfBtn) {
            exportPdfBtn.addEventListener('click', function() {
                if (!currentPatientId) {
                    showToast("Error: No hay paciente seleccionado", "error");
                    return;
                }
                
                // Mostrar opciones de exportación
                const pdfOptionsContainer = document.getElementById('pdfOptionsContainer');
                if (pdfOptionsContainer) {
                    pdfOptionsContainer.style.display = 'block';
                }
            });
        }
        
        // Configurar botones de opciones de PDF
        const cancelPdfExportBtn = document.getElementById('cancelPdfExport');
        if (cancelPdfExportBtn) {
            cancelPdfExportBtn.addEventListener('click', function() {
                const pdfOptionsContainer = document.getElementById('pdfOptionsContainer');
                if (pdfOptionsContainer) {
                    pdfOptionsContainer.style.display = 'none';
                }
            });
        }
        
        const generatePdfBtn = document.getElementById('generatePdfBtn');
        if (generatePdfBtn) {
            generatePdfBtn.addEventListener('click', function() {
                exportToPDF(currentPatientId);
                const pdfOptionsContainer = document.getElementById('pdfOptionsContainer');
                if (pdfOptionsContainer) {
                    pdfOptionsContainer.style.display = 'none';
                }
            });
        }

        // Añadir event listener para formulario de nueva evolución
        const evolutionForm = document.getElementById('evolutionForm');
        if (evolutionForm) {
            evolutionForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                if (!currentPatientId) {
                    showToast("Error: No hay paciente seleccionado", "error");
                    return;
                }
                
                try {
                    showLoading();
                    
                    // Recopilar datos de actividades PSFS
                    const psfsActivities = getPsfsActivities();
                    
                    // Recopilar datos de ejercicios
                    const exercises = getExercisesData();
                    
                    // Obtener valores de los controles de formulario
                    const evolutionData = {
                        date: document.getElementById('evolutionDate')?.value,
                        time: document.getElementById('evolutionTime')?.value,
                        student: document.getElementById('evolutionStudent')?.value,
                        patientState: document.getElementById('evolutionPatientState')?.value,
                        treatment: document.getElementById('evolutionTreatment')?.value,
                        response: document.getElementById('evolutionResponse')?.value,
                        scales: {
                            eva: parseInt(document.getElementById('evaRange')?.value),
                            groc: parseInt(document.getElementById('grocRange')?.value),
                            sane: parseInt(document.getElementById('saneRange')?.value),
                            saneText: document.getElementById('saneCustomText')?.value,
                            psfs: psfsActivities
                        },
                        exercises: exercises,
                        trainingPlan: document.getElementById('evolutionTrainingPlan')?.value || '',
                        observations: document.getElementById('evolutionObservations')?.value || '',
                        attachments: []
                    };
                    
                    console.log("Datos de evolución a guardar:", evolutionData);
                    
                    // Añadir evolución a Firebase
                    const evolutionId = await addEvolution(currentPatientId, evolutionData);
                    
                    if (evolutionId) {
                        // Cerrar modal
                        const evolutionModal = document.getElementById('newEvolutionModal');
                        if (evolutionModal) evolutionModal.classList.remove('active');
                        
                        // Limpiar formulario
                        this.reset();
                        
                        // Restablecer campos con valores por defecto
                        const today = new Date().toISOString().split('T')[0];
                        const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
                        
                        const dateInput = document.getElementById('evolutionDate');
                        const timeInput = document.getElementById('evolutionTime');
                        const evaRange = document.getElementById('evaRange');
                        const evaValue = document.getElementById('evaValue');
                        const grocRange = document.getElementById('grocRange');
                        const grocValue = document.getElementById('grocValue');
                        const saneRange = document.getElementById('saneRange');
                        const saneValue = document.getElementById('saneValue');
                        
                        if (dateInput) dateInput.value = today;
                        if (timeInput) timeInput.value = now;
                        if (evaRange) evaRange.value = 5;
                        if (evaValue) evaValue.textContent = '5/10';
                        if (grocRange) grocRange.value = 3;
                        if (grocValue) grocValue.textContent = '+3';
                        if (saneRange) saneRange.value = 70;
                        if (saneValue) saneValue.textContent = '70%';
                        
                        // Limpiar actividades PSFS
                        const psfsContainer = document.getElementById('psfsActivities');
                        if (psfsContainer) psfsContainer.innerHTML = '';
                        
                        // Limpiar ejercicios
                        const exerciseTableBody = document.getElementById('exerciseTableBody');
                        if (exerciseTableBody) exerciseTableBody.innerHTML = '';
                        
                        // Refrescar evoluciones si el modal de paciente está abierto
                        if (document.getElementById('patientModal')?.classList.contains('active')) {
                            const evolutions = await getEvolutions(currentPatientId);
                            fillEvolutionsTab(evolutions);
                        }
                        
                        // Refrescar lista de pacientes
                        await getPatients();
                        
                        showToast("Evolución registrada correctamente", "success");
                    }
                    
                    hideLoading();
                } catch (error) {
                    hideLoading();
                    console.error("Error al guardar evolución:", error);
                    showToast("Error al guardar evolución: " + error.message, "error");
                }
            });
        }
        
        // Cargar plantillas personalizadas
        loadCustomTemplates();
        
        // Cargar pacientes iniciales
        await getPatients();
        
        console.log("Inicialización completada correctamente");
        showToast("Sistema iniciado correctamente", "success");
    } catch (error) {
        console.error("Error durante la inicialización:", error);
        showToast("Error de inicialización: " + error.message, "error");
    }
}

/**
 * Funciones de recopilación de datos de formularios
 */

// Recopilar datos de actividades PSFS
function getPsfsActivities() {
    const activities = [];
    const activityElements = document.querySelectorAll('#psfsActivities .psfs-activity');
    
    activityElements.forEach(element => {
        const nameInput = element.querySelector('.psfs-activity-input');
        const nameSpan = element.querySelector('.activity-name span');
        const slider = element.querySelector('.psfs-slider');
        
        let name = '';
        if (nameInput && nameInput.value) {
            name = nameInput.value;
        } else if (nameSpan) {
            name = nameSpan.textContent;
        }
        
        if (name && name.trim() !== '') {
            activities.push({
                name: name,
                rating: slider ? parseInt(slider.value) : 5
            });
        }
    });
    
    return activities;
}

// Recopilar datos de ejercicios
function getExercisesData() {
    const exercises = [];
    const rows = document.querySelectorAll('#exerciseTableBody tr');
    
    rows.forEach(row => {
        const nameInput = row.querySelector('td:nth-child(1) input');
        const implementSelect = row.querySelector('td:nth-child(2) select');
        const setsInput = row.querySelector('td:nth-child(3) input');
        const repsInput = row.querySelector('td:nth-child(4) input');
        const loadInput = row.querySelector('td:nth-child(5) input');
        const effortTypeSelect = row.querySelector('td:nth-child(6) select');
        const effortValueInput = row.querySelector('td:nth-child(6) input[type="number"]');
        const notesInput = row.querySelector('td:nth-child(7) input');
        
        if (nameInput && nameInput.value.trim() !== '') {
            // Construir cadena de intensidad combinando carga y esfuerzo
            let intensityStr = '';
            if (loadInput && loadInput.value) {
                intensityStr = loadInput.value + 'kg';
            }
            
            if (effortTypeSelect && effortValueInput && effortValueInput.value) {
                if (intensityStr) intensityStr += ' - ';
                intensityStr += effortTypeSelect.value + ' ' + effortValueInput.value;
            }
            
            // Si no hay intensidad especificada, usar valor legacy
            if (!intensityStr) {
                intensityStr = 'Media';
            }
            
            exercises.push({
                name: nameInput.value,
                implement: implementSelect ? implementSelect.value : '',
                sets: setsInput ? setsInput.value : '3',
                reps: repsInput ? repsInput.value : '10',
                intensity: intensityStr, // Para compatibilidad con versiones anteriores
                load: loadInput ? loadInput.value : '',
                effortType: effortTypeSelect ? effortTypeSelect.value : 'RPE',
                effortValue: effortValueInput ? effortValueInput.value : '',
                notes: notesInput ? notesInput.value : ''
            });
        }
    });
    
    return exercises;
}

/**
 * Inicializar la aplicación cuando se cargue el DOM
 */
document.addEventListener('DOMContentLoaded', function() {
    // Guardar una referencia al contenido original del dashboard
    const originalContent = document.querySelector('.content');
    if (originalContent) {
        window.dashboardContent = originalContent.outerHTML;
    }
    
    // Añadir manejador global de errores para facilitar la depuración
    window.addEventListener('error', function(event) {
        console.error('Error capturado:', event.error);
        showToast("Error detectado: " + (event.error?.message || "Error desconocido"), "error");
    });
    
    // Inicializar la aplicación con mejor manejo de errores
    initApp().catch(error => {
        console.error("Error al inicializar la aplicación:", error);
        showToast("Error crítico de inicialización: " + error.message, "error");
        
        // Mostrar mensaje de error en la página para el usuario
        document.body.innerHTML = `
            <div style="text-align: center; padding: 50px; font-family: Arial, sans-serif;">
                <h1>Error al cargar el sistema</h1>
                <p>Ha ocurrido un error al inicializar la aplicación: ${error.message}</p>
                <p>Por favor, intenta recargar la página:</p>
                <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; background-color: #1E88E5; color: white; border: none; border-radius: 4px; cursor: pointer;">
                    Recargar página
                </button>
            </div>
        `;
    });
});

// Exportar las funciones relevantes
export {
    initApp,
    getPsfsActivities,
    getExercisesData
};

// Exportar variables para global
window.currentPatientId = currentPatientId;
window.patientsCache = patientsCache;
window.customTemplates = customTemplates;

// Función para alternar entre vistas de ejercicios
window.toggleExerciseView = function(button) {
    try {
        const currentView = button.getAttribute('data-view');
        const section = button.closest('.evolution-section');
        
        if (!section) {
            console.error("No se encontró el contenedor de sección");
            return;
        }
        
        const columnView = section.querySelector('.exercise-two-columns');
        const tableView = section.querySelector('.exercise-table-view');
        
        if (!columnView || !tableView) {
            console.error("No se encontraron las vistas de columnas o tabla");
            return;
        }
        
        if (currentView === 'column') {
            // Cambiar a vista de tabla
            columnView.style.display = 'none';
            tableView.style.display = 'block';
        } else {
            // Cambiar a vista de columnas
            columnView.style.display = 'grid';
            tableView.style.display = 'none';
        }
    } catch (error) {
        console.error("Error al cambiar vista de ejercicios:", error);
    }
};

// Exportar para compatibilidad con código existente
window.showPatientStateExample = function() {
    const example = "Paciente refiere dolor lumbar de intensidad 6/10 en región L4-L5, con irradiación hacia EID°. Reporta mejoría desde última sesión (antes 8/10). Limitación para inclinarse hacia adelante y dificultad para permanecer sentado >30 minutos. Dolor aumenta al final del día y con actividades que implican flexión lumbar.";
    window.showExampleModal("Ejemplo de Estado del Paciente", example, "evolutionPatientState");
};

window.showTreatmentExample = function() {
    const example = "Terapia manual: Movilización de segmentos L4-L5, técnicas de presión isquémica en paravertebrales y piramidal derecho. Educación: posiciones durante el trabajo para el manejo sintomátologico.";
    window.showExampleModal("Ejemplo de Tratamiento", example, "evolutionTreatment");
};

window.showResponseExample = function() {
    const example = "Respuesta favorable durante sesión. Dolor disminuyó de 6/10 a 3/10 post-tratamiento. Mejoró ROM lumbar en flexión. Sin eventos adversos. Paciente refiere mayor sensación de estabilidad al caminar. Se observa disminución de tensión en musculatura paravertebral. Persistente limitación leve para movimientos rotacionales.";
    window.showExampleModal("Ejemplo de Respuesta al Tratamiento", example, "evolutionResponse");
};
