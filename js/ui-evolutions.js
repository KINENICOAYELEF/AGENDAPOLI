// ui-evolutions.js
// Interfaz de usuario para evoluciones

import { addEvolution, getEvolutions, currentPatientId, getPatient } from './data-services.js';
import { showToast, showLoading, hideLoading, formatDate } from './utils.js';
import { renderExercises, renderScales, renderAttachments, getExercisesData, getPsfsActivities } from './ui-exercises.js';

// Fill evolutions tab
export function fillEvolutionsTab(evolutions) {
    try {
        const timelineContainer = document.getElementById('evolutionTimeline');
        if (!timelineContainer) {
            console.error("Contenedor de timeline de evoluciones no encontrado");
            return;
        }
        
        // Limpiar evoluciones existentes
        timelineContainer.innerHTML = '';
        
        // Añadir evoluciones
        if (evolutions.length === 0) {
            timelineContainer.innerHTML = '<p>No hay evoluciones registradas para este paciente.</p>';
            return;
        }
        
        evolutions.forEach(evolution => {
            const evolutionItem = document.createElement('div');
            evolutionItem.classList.add('evolution-item', 'fade-in');
            
            const formattedDate = formatDate(new Date(evolution.date));
            const formattedTime = evolution.time || '10:00';
            
            evolutionItem.innerHTML = `
                <div class="evolution-dot">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <div class="evolution-content">
                    <div class="evolution-header">
                        <div class="evolution-date">
                            <i class="far fa-calendar-alt"></i>
                            ${formattedDate} - ${formattedTime}
                        </div>
                        <div class="evolution-student">Realizado por: ${evolution.student || 'No registrado'}</div>
                    </div>
                    ${evolution.patientState ? `
                    <div class="evolution-section">
                        <div class="evolution-section-title">Estado del paciente</div>
                        <p>${evolution.patientState}</p>
                    </div>
                    ` : ''}
                    ${evolution.treatment ? `
                    <div class="evolution-section">
                        <div class="evolution-section-title">Tratamiento realizado</div>
                        <p>${evolution.treatment}</p>
                    </div>
                    ` : ''}
                    ${evolution.response ? `
                    <div class="evolution-section">
                        <div class="evolution-section-title">Respuesta al tratamiento</div>
                        <p>${evolution.response}</p>
                    </div>
                    ` : ''}
                    ${evolution.scales ? renderScales(evolution.scales) : ''}
                    ${evolution.exercises && evolution.exercises.length > 0 ? renderExercises(evolution.exercises) : ''}
                    ${evolution.trainingPlan ? `
                    <div class="evolution-section">
                        <div class="evolution-section-title">Plan de entrenamiento</div>
                        <p>${evolution.trainingPlan}</p>
                    </div>
                    ` : ''}
                    ${evolution.observations ? `
                    <div class="evolution-section">
                        <div class="evolution-section-title">Observaciones adicionales</div>
                        <p>${evolution.observations}</p>
                    </div>
                    ` : ''}
                    ${evolution.attachments && evolution.attachments.length > 0 ? renderAttachments(evolution.attachments) : ''}
                </div>
            `;
            
            timelineContainer.appendChild(evolutionItem);
        });
    } catch (error) {
        console.error("Error llenando pestaña de evoluciones:", error);
        showToast("Error al cargar evoluciones: " + error.message, "error");
    }
}

// Show new evolution modal with proper validation
export function showNewEvolutionModal() {
    try {
        if (!currentPatientId) {
            // Si no hay paciente seleccionado, mostrar mensaje para seleccionar uno
            const patientCards = document.querySelectorAll('.patient-card');
            if (patientCards.length > 0) {
                showToast("Por favor, seleccione un paciente primero", "info");
                
                // Destacar visualmente las tarjetas de pacientes para indicar que debe seleccionar uno
                patientCards.forEach(card => {
                    card.style.animation = 'pulse 1s';
                    setTimeout(() => {
                        card.style.animation = '';
                    }, 1000);
                });
            } else {
                // Si no hay pacientes, sugerir crear uno
                showToast("No hay pacientes registrados. Añada un paciente primero", "info");
                
                // Destacar el botón de añadir paciente
                const addPatientBtn = document.getElementById('addPatientBtn');
                if (addPatientBtn) {
                    addPatientBtn.style.animation = 'pulse 1s';
                    setTimeout(() => {
                        addPatientBtn.style.animation = '';
                    }, 1000);
                }
            }
            return;
        }
        
        // Establecer fecha y hora actuales
        const today = new Date().toISOString().split('T')[0];
        const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
        
        const dateInput = document.getElementById('evolutionDate');
        const timeInput = document.getElementById('evolutionTime');
        
        if (dateInput) dateInput.value = today;
        if (timeInput) timeInput.value = now;
        
        // Limpiar campos previos
        const stateInput = document.getElementById('evolutionPatientState');
        const treatmentInput = document.getElementById('evolutionTreatment');
        const responseInput = document.getElementById('evolutionResponse');
        const planInput = document.getElementById('evolutionTrainingPlan');
        const observationsInput = document.getElementById('evolutionObservations');
        
        if (stateInput) stateInput.value = '';
        if (treatmentInput) treatmentInput.value = '';
        if (responseInput) responseInput.value = '';
        if (planInput) planInput.value = '';
        if (observationsInput) observationsInput.value = '';
        
        // Obtener el usuario actual (kinesiólogo/estudiante) de la configuración o usar valor predeterminado
        let currentUser = "Estudiante";
        try {
            const savedConfig = localStorage.getItem('sistemakineConfig');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.mainTherapistName) currentUser = config.mainTherapistName;
            }
        } catch (e) {
            console.error("Error al obtener usuario de configuración:", e);
        }
        
        const studentInput = document.getElementById('evolutionStudent');
        if (studentInput) studentInput.value = currentUser;
        
        // Actualizar título del modal con el nombre del paciente
        getPatient(currentPatientId).then(patient => {
            const patientName = patient ? patient.name : "paciente";
            const modalTitle = document.getElementById('evolutionModalTitle');
            if (modalTitle) modalTitle.textContent = `Nueva evolución - ${patientName}`;
        });
        
        // Restablecer valores predeterminados de las escalas
        const evaRange = document.getElementById('evaRange');
        const evaValue = document.getElementById('evaValue');
        
        if (evaRange) evaRange.value = 5;
        if (evaValue) evaValue.textContent = '5/10';
        
        const grocRange = document.getElementById('grocRange');
        const grocValue = document.getElementById('grocValue');
        
        if (grocRange) grocRange.value = 3;
        if (grocValue) grocValue.textContent = '+3';
        
        const saneRange = document.getElementById('saneRange');
        const saneValue = document.getElementById('saneValue');
        
        if (saneRange) saneRange.value = 70;
        if (saneValue) saneValue.textContent = '70%';
        
        // Limpiar actividades PSFS previas
        const psfsContainer = document.getElementById('psfsActivities');
        if (psfsContainer) psfsContainer.innerHTML = '';
        
        // Limpiar ejercicios previos
        const exerciseTableBody = document.getElementById('exerciseTableBody');
        if (exerciseTableBody) exerciseTableBody.innerHTML = '';
        
        // Limpiar vista previa de adjuntos
        const attachmentPreview = document.getElementById('attachmentPreview');
        if (attachmentPreview) attachmentPreview.innerHTML = '';
        
        // Mostrar modal
        const newEvolutionModal = document.getElementById('newEvolutionModal');
        if (newEvolutionModal) newEvolutionModal.classList.add('active');
    } catch (error) {
        console.error("Error al mostrar modal de nueva evolución:", error);
        showToast("Error al abrir formulario de evolución", "error");
    }
}

// Setup scales controls
export function setupScalesControls() {
    // EVA Range
    const evaRange = document.getElementById('evaRange');
    const evaValue = document.getElementById('evaValue');
    const evaMarker = document.querySelector('.eva-scale .scale-marker');
    
    if (evaRange && evaValue && evaMarker) {
        evaRange.addEventListener('input', function() {
            const value = this.value;
            evaValue.textContent = value + '/10';
            const percentage = (value / 10) * 100;
            evaMarker.style.left = percentage + '%';
        });
    }
    
    // GROC Range
    const grocRange = document.getElementById('grocRange');
    const grocValue = document.getElementById('grocValue');
    const grocMarker = document.querySelector('.groc-marker');
    
    if (grocRange && grocValue && grocMarker) {
        grocRange.addEventListener('input', function() {
            const value = this.value;
            grocValue.textContent = value > 0 ? '+' + value : value;
            const percentage = ((parseFloat(value) + 7) / 14) * 100;
            grocMarker.style.left = percentage + '%';
        });
    }
    
    // SANE Range
    const saneRange = document.getElementById('saneRange');
    const saneValue = document.getElementById('saneValue');
    const saneCircleValue = document.querySelector('.sane-value');
    const saneBar = document.querySelector('.sane-bar');
    
    if (saneRange && saneValue && saneCircleValue && saneBar) {
        saneRange.addEventListener('input', function() {
            const value = this.value;
            saneValue.textContent = value + '%';
            saneCircleValue.textContent = value + '%';
            
            // Actualizar barra de progreso
            saneBar.style.width = value + '%';
            
            // Actualizar círculo SVG
            const circle = document.querySelector('.sane-circle svg circle:nth-child(2)');
            if (circle) {
                const circumference = 2 * Math.PI * 35;
                const offset = circumference - (circumference * value / 100);
                circle.setAttribute('stroke-dashoffset', offset);
            }
        });
    }
    
    // Asegurar que las actualizaciones de escala funcionen también cuando se cambia el valor programáticamente
    function updateScaleDisplays() {
        // EVA
        if (evaRange && evaValue && evaMarker) {
            const value = evaRange.value;
            evaValue.textContent = value + '/10';
            const percentage = (value / 10) * 100;
            evaMarker.style.left = percentage + '%';
        }
        
        // GROC
        if (grocRange && grocValue && grocMarker) {
            const value = grocRange.value;
            grocValue.textContent = value > 0 ? '+' + value : value;
            const percentage = ((parseFloat(value) + 7) / 14) * 100;
            grocMarker.style.left = percentage + '%';
        }
        
        // SANE
        if (saneRange && saneValue && saneCircleValue && saneBar) {
            const value = saneRange.value;
            saneValue.textContent = value + '%';
            saneCircleValue.textContent = value + '%';
            saneBar.style.width = value + '%';
            
            const circle = document.querySelector('.sane-circle svg circle:nth-child(2)');
            if (circle) {
                const circumference = 2 * Math.PI * 35;
                const offset = circumference - (circumference * value / 100);
                circle.setAttribute('stroke-dashoffset', offset);
            }
        }
    }
    
    // Ejecutar una actualización inicial para asegurar que todo esté sincronizado
    updateScaleDisplays();
    
    // Añadir evento al botón para añadir actividad PSFS
    const addPsfsBtn = document.getElementById('addPsfsActivityBtn');
    if (addPsfsBtn) {
        // Eliminar manejadores previos
        const newAddPsfsBtn = addPsfsBtn.cloneNode(true);
        addPsfsBtn.parentNode.replaceChild(newAddPsfsBtn, addPsfsBtn);
        
        newAddPsfsBtn.addEventListener('click', addPsfsActivity);
    }
    
    // También actualizar cuando se abre el modal
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.addEventListener('transitionend', function() {
            if (this.classList.contains('active')) {
                setTimeout(updateScaleDisplays, 100);
            }
        });
    });
}

// Función para añadir una actividad PSFS
export function addPsfsActivity() {
    const container = document.getElementById('psfsActivities');
    if (!container) return;
    
    const newActivity = document.createElement('div');
    newActivity.className = 'psfs-activity';
    newActivity.innerHTML = `
        <div class="activity-name" style="display: flex; align-items: center; gap: 5px;">
            <input type="text" class="psfs-activity-input" placeholder="Describa la actividad" style="flex-grow: 1;">
            <button type="button" class="delete-activity-btn">
                <i class="fas fa-times"></i>
            </button>
        </div>
        <div class="activity-rating" style="margin-top: 5px;">
            <div class="rating-number">5</div>
            <div class="rating-bar">
                <div class="rating-value" style="width: 50%;"></div>
            </div>
            <div class="rating-number">10</div>
        </div>
        <input type="range" min="0" max="10" value="5" class="psfs-slider">
    `;
    
    container.appendChild(newActivity);
    
    // Añadir evento al slider para actualizar la barra visual
    const slider = newActivity.querySelector('.psfs-slider');
    if (slider) {
        slider.addEventListener('input', function() {
            const value = this.value;
            const ratingNumber = newActivity.querySelector('.rating-number');
            const ratingBar = newActivity.querySelector('.rating-value');
            
            if (ratingNumber) ratingNumber.textContent = value;
            if (ratingBar) ratingBar.style.width = (value * 10) + '%';
        });
    }
    
    // Añadir evento para eliminar actividad
    const deleteBtn = newActivity.querySelector('.delete-activity-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            container.removeChild(newActivity);
        });
    }
    
    // Manejar el evento de entrada de texto
    const input = newActivity.querySelector('.psfs-activity-input');
    if (input) {
        input.addEventListener('blur', function() {
            if (this.value.trim() === '') {
                this.value = 'Actividad sin especificar';
            }
        });
        
        // Dar foco para que el usuario empiece a escribir inmediatamente
        input.focus();
    }
}

// Implementar comandos rápidos con "/texto"
export function setupCommandShortcuts() {
    const fieldsToWatch = ['evolutionPatientState', 'evolutionTreatment', 'evolutionResponse'];
    
    fieldsToWatch.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        // Eliminar manejadores previos
        const newField = field.cloneNode(true);
        field.parentNode.replaceChild(newField, field);
        
        newField.addEventListener('input', function(e) {
            const text = this.value;
            const cursorPosition = this.selectionStart;
            
            // Verificar si hay un comando "/" reciente
            if (cursorPosition > 1 && text.charAt(cursorPosition - 1) === ' ' && text.substring(0, cursorPosition).includes('/')) {
                // Encontrar el último comando
                const lastCommandStart = text.substring(0, cursorPosition).lastIndexOf('/');
                const command = text.substring(lastCommandStart, cursorPosition).trim();
                
                // Si el comando termina con espacio, procesar
                if (command.length > 1 && text.charAt(cursorPosition - 1) === ' ') {
                    const commandText = command.substring(1); // quitar el "/"
                    let replacement = '';
                    
                    // Comandos para Estado del Paciente
                    if (fieldId === 'evolutionPatientState') {
                        switch(commandText) {
                            case 'dolor':
                                replacement = 'Dolor de intensidad [X]/10 en [región], caracterizado por [descripción]. ';
                                break;
                            case 'avance':
                                replacement = 'Paciente refiere [mejoría/mantenimiento/empeoramiento] desde última sesión en [aspecto específico]. ';
                                break;
                            case 'limitacion':
                                replacement = 'Presenta limitación funcional para [actividades específicas]. ';
                                break;
                        }
                    }
                    
                    // Comandos para Tratamiento
                    else if (fieldId === 'evolutionTreatment') {
                        switch(commandText) {
                            case 'manual':
                                replacement = 'Terapia manual: [técnicas específicas aplicadas en región]. ';
                                break;
                            case 'agentes':
                                replacement = 'Agentes físicos: [tipo] aplicado en [región] durante [tiempo] minutos. ';
                                break;
                            case 'educacion':
                                replacement = 'Educación al paciente: [contenido específico enseñado]. ';
                                break;
                        }
                    }
                    
                    // Comandos para Respuesta al tratamiento
                    else if (fieldId === 'evolutionResponse') {
                        switch(commandText) {
                            case 'inmediata':
                                replacement = 'Respuesta inmediata durante sesión: [descripción]. ';
                                break;
                            case 'eva':
                                replacement = 'Dolor pre-tratamiento: [X]/10, post-tratamiento: [Y]/10. ';
                                break;
                            case 'adm':
                                replacement = 'Amplitud de movimiento [aumentó/se mantuvo/disminuyó] en [dirección/plano]. ';
                                break;
                        }
                    }
                    
                    // Si hay un reemplazo, aplicarlo
                    if (replacement) {
                        const newText = text.substring(0, lastCommandStart) + replacement + text.substring(cursorPosition);
                        this.value = newText;
                        // Posicionar cursor después del reemplazo
                        const newPosition = lastCommandStart + replacement.length;
                        this.setSelectionRange(newPosition, newPosition);
                        e.preventDefault();
                    }
                }
            }
        });
    });
}

// Funciones de ejemplo para mostrar
export function showPatientStateExample() {
    const example = "Paciente refiere dolor lumbar de intensidad 6/10 en región L4-L5, con irradiación hacia EID°. Reporta mejoría desde última sesión (antes 8/10). Limitación para inclinarse hacia adelante y dificultad para permanecer sentado >30 minutos. Dolor aumenta al final del día y con actividades que implican flexión lumbar.";
    
    // Mostrar ejemplo en un modal pequeño
    showExampleModal("Ejemplo de Estado del Paciente", example, "evolutionPatientState");
}

export function showTreatmentExample() {
    const example = "Terapia manual: Movilización de segmentos L4-L5, técnicas de presión isquémica en paravertebrales y piramidal derecho. Educación: posiciones durante el trabajo para el manejo sintomátologico.";
    
    showExampleModal("Ejemplo de Tratamiento", example, "evolutionTreatment");
}

export function showResponseExample() {
    const example = "Respuesta favorable durante sesión. Dolor disminuyó de 6/10 a 3/10 post-tratamiento. Mejoró ROM lumbar en flexión. Sin eventos adversos. Paciente refiere mayor sensación de estabilidad al caminar. Se observa disminución de tensión en musculatura paravertebral. Persistente limitación leve para movimientos rotacionales.";
    
    showExampleModal("Ejemplo de Respuesta al Tratamiento", example, "evolutionResponse");
}

// Función para mostrar el modal con ejemplo
export function showExampleModal(title, text, targetFieldId) {
    // Crear modal para mostrar ejemplo
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.id = 'exampleModal';
    modalDiv.style.zIndex = '2000';
    
    modalDiv.innerHTML = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" id="closeExampleModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>${text}</p>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="action-btn btn-secondary" id="closeExampleBtn">Cerrar</button>
                    <button class="action-btn btn-primary" id="useExampleBtn">Usar este ejemplo</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
    setTimeout(() => modalDiv.classList.add('active'), 50);
    
    // Configurar botones
    document.getElementById('closeExampleModal').addEventListener('click', function() {
        modalDiv.classList.remove('active');
        setTimeout(() => document.body.removeChild(modalDiv), 300);
    });
    
    document.getElementById('closeExampleBtn').addEventListener('click', function() {
        modalDiv.classList.remove('active');
        setTimeout(() => document.body.removeChild(modalDiv), 300);
    });
    
    document.getElementById('useExampleBtn').addEventListener('click', function() {
        useExample(text, targetFieldId);
    });
}

// Función para usar el ejemplo
export function useExample(text, fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.value = text;
    
    const modal = document.getElementById('exampleModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => document.body.removeChild(modal), 300);
    }
}
