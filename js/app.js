// app.js

// app.js (actualizado)
// Importar todos los módulos que necesitamos
import './utils.js';
import './firebase-config.js';
import './data-services.js';
import './ui-patients.js';
import './ui-evolutions.js';
import './ui-diagnosis.js';
import './ui-exercises.js';
import './pdf-export.js';
import './navigation.js';

// Continuar con el resto del código de app.js...
// Inicialización y control principal de la aplicación
import { initFirebase } from './firebase-config.js';
import { getPatients, setCurrentPatientId } from './data-services.js';
import { renderPatients } from './ui-patients.js';
import { exportToPDF } from './pdf-export.js';
import { setupExerciseTable, loadCustomTemplates, showCustomTemplatesModal } from './ui-exercises.js';
import { 
    showToast, showLoading, hideLoading, setupScalesControls, 
    setupCommandShortcuts, loadConfiguration, saveConfiguration, 
    resetConfiguration, applyColorTheme, getPsfsActivities, getExercisesData
} from './utils.js';
import { 
    setupNavigation, changeView, showNewEvolutionModal, 
    generatePatientReport, generateStatisticsReport
} from './navigation.js';

// Almacenar referencia global para el ID de paciente activo
let currentPatientId = null;

// Actualizar currentPatientId cuando cambie en data-services
document.addEventListener('currentPatientChanged', (event) => {
    currentPatientId = event.detail;
});

// Inicializar la aplicación cuando el DOM esté cargado
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

// Función principal para inicializar la aplicación
async function initApp() {
    try {
        console.log("Inicializando aplicación...");
        
        // Inicializar Firebase
        const firebaseResult = await initFirebase();
        if (!firebaseResult.success) {
            console.error("Error crítico: No se pudo inicializar Firebase");
            document.body.innerHTML = `
                <div style="text-align: center; padding: 50px;">
                    <h1>Error de conexión</h1>
                    <p>No se pudo conectar con la base de datos. Por favor, intente recargar la página.</p>
                    <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px;">Recargar</button>
                </div>
            `;
            return;
        } else if (firebaseResult.message) {
            showToast(firebaseResult.message, firebaseResult.success ? "success" : "info");
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
        setupPdfOptions();
        
        // Configurar previsualización de archivos adjuntos
        setupAttachmentPreview();
        
        // Configurar controles de escalas
        setupScalesControls();
        
        // Configurar tabla de ejercicios
        setupExerciseTable();
        
        // Configurar comandos rápidos
        setupCommandShortcuts();
        
        // Inicializar eventos de pestañas
        setupTabsEvents();
        
        // Inicializar eventos de acordeones
        setupAccordionEvents();
        
        // Configurar formulario de nuevo paciente
        setupNewPatientForm();
        
        // Configurar botones principales
        setupMainButtons();
        
        // Configurar búsqueda
        setupSearchFunctionality();
        
        // Configurar formulario de nueva evolución
        setupNewEvolutionForm();
        
        // Cargar plantillas personalizadas
        loadCustomTemplates();
        
        // Cargar pacientes iniciales
        const patients = await getPatients();
        renderPatients(patients);
        
        console.log("Inicialización completada correctamente");
        showToast("Sistema iniciado correctamente", "success");
    } catch (error) {
        console.error("Error durante la inicialización:", error);
        showToast("Error de inicialización: " + error.message, "error");
    }
}

// Configurar opciones de PDF
function setupPdfOptions() {
    const pdfPeriodSelect = document.getElementById('pdfEvolutionPeriod');
    if (pdfPeriodSelect) {
        pdfPeriodSelect.addEventListener('change', function() {
            const customDateRange = document.getElementById('pdfCustomDateRange');
            if (customDateRange) {
                customDateRange.style.display = this.value === 'custom' ? 'block' : 'none';
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
            if (currentPatientId) {
                exportToPDF(currentPatientId);
                const pdfOptionsContainer = document.getElementById('pdfOptionsContainer');
                if (pdfOptionsContainer) {
                    pdfOptionsContainer.style.display = 'none';
                }
            } else {
                showToast("Error: No hay paciente seleccionado", "error");
            }
        });
    }
}

// Configurar previsualización de archivos adjuntos
function setupAttachmentPreview() {
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
}

// Configurar eventos de pestañas
function setupTabsEvents() {
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
}

// Configurar eventos de acordeones
function setupAccordionEvents() {
    const accordions = document.querySelectorAll('.accordion-header');
    
    accordions.forEach(accordion => {
        accordion.addEventListener('click', function() {
            this.parentElement.classList.toggle('active');
        });
    });
}

// Configurar formulario de nuevo paciente
function setupNewPatientForm() {
    const patientForm = document.getElementById('patientForm');
    if (patientForm) {
        patientForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const formData = new FormData(this);
            const patientData = {};
            
            for (const [key, value] of formData.entries()) {
                patientData[key] = value;
            }
            
            // Importar función para evitar dependencias circulares
            const { addPatient } = await import('./data-services.js');
            const { openPatientModal } = await import('./ui-patients.js');
            
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
}

// Configurar botones principales
function setupMainButtons() {
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
        addEvolutionBtn.addEventListener('click', function() {
            showNewEvolutionModal();
        });
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
            
            // Importar función
            const { updatePatient } = await import('./data-services.js');
            
            // Actualizar datos del paciente
            await updatePatient(currentPatientId, patientData);
            
            // Refrescar lista de pacientes
            await getPatients();
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
}

// Configurar búsqueda de pacientes
function setupSearchFunctionality() {
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
}

// Configurar formulario de nueva evolución
function setupNewEvolutionForm() {
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
                
                // Importar funciones necesarias
                const { addEvolution, getEvolutions } = await import('./data-services.js');
                const { fillEvolutionsTab } = await import('./ui-evolutions.js');
                
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
}

// Controlador para el botón de gestión de plantillas
document.addEventListener('DOMContentLoaded', function() {
    const manageCustomTemplatesBtn = document.getElementById('manageCustomTemplatesBtn');
    if (manageCustomTemplatesBtn) {
        manageCustomTemplatesBtn.addEventListener('click', function() {
            try {
                showCustomTemplatesModal();
            } catch (error) {
                console.error("Error al mostrar gestor de plantillas:", error);
                showToast("Error al abrir gestor de plantillas", "error");
            }
        });
    }
});

// Exportar funciones para el acceso global requerido desde HTML
window.showNewEvolutionModal = showNewEvolutionModal;
window.generatePatientReport = generatePatientReport;
window.generateStatisticsReport = generateStatisticsReport;
window.saveConfiguration = saveConfiguration;
window.resetConfiguration = resetConfiguration;
window.applyColorTheme = applyColorTheme;
window.changeView = changeView; // Necesario para enlaces de navegación en HTML
window.showCustomTemplatesModal = showCustomTemplatesModal; // Para botón de plantillas
