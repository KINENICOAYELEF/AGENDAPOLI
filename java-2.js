// Abrir modal de objetivo
function openObjectiveModal(patientId) {
    // Utilizar el modal predefinido
    const objectiveModal = document.getElementById('objectiveModal');
    
    if (!objectiveModal) {
        console.error("Modal de objetivos no encontrado");
        return;
    }
    
    // Mostrar modal
    objectiveModal.style.display = 'block';
    setTimeout(() => objectiveModal.classList.add('active'), 50);
    
    // Establecer fecha actual
    const today = new Date().toISOString().split('T')[0];
    const startDateInput = document.getElementById('objectiveStartDate');
    if (startDateInput) startDateInput.value = today;
    
    // Establecer fecha estimada en 4 semanas
    const fourWeeksLater = new Date();
    fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);
    const endDateInput = document.getElementById('objectiveEndDate');
    if (endDateInput) endDateInput.value = fourWeeksLater.toISOString().split('T')[0];
    
    // Configurar eventos para botones
    const closeBtn = document.getElementById('closeObjectiveModal');
    if (closeBtn) {
        // Eliminar manejadores previos
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
        newCloseBtn.addEventListener('click', function() {
            objectiveModal.classList.remove('active');
            setTimeout(() => {
                objectiveModal.style.display = 'none';
            }, 300);
        });
    }
    
    const cancelBtn = document.getElementById('cancelObjectiveBtn');
    if (cancelBtn) {
        // Eliminar manejadores previos
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', function() {
            objectiveModal.classList.remove('active');
            setTimeout(() => {
                objectiveModal.style.display = 'none';
            }, 300);
        });
    }
    
    const saveBtn = document.getElementById('saveObjectiveBtn');
    if (saveBtn) {
        // Eliminar manejadores previos
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', function() {
            saveObjective(patientId, objectiveModal);
        });
    }
    
    // Escuchar cambios en el slider para actualizar el SVG
    const progressSlider = document.getElementById('objectiveProgress');
    if (progressSlider) {
        // Eliminar manejadores previos
        const newProgressSlider = progressSlider.cloneNode(true);
        progressSlider.parentNode.replaceChild(newProgressSlider, progressSlider);
        
        newProgressSlider.addEventListener('input', function() {
            updateObjectiveProgressPreview(this.value);
        });
    }
}

// Actualizar vista previa del progreso del objetivo
function updateObjectiveProgressPreview(progress) {
    // En una implementación real, esto actualizaría un SVG o un elemento visual
    console.log(`Progreso actualizado a: ${progress}%`);
}

// Guardar objetivo
function saveObjective(patientId, modal) {
    // Obtener datos del formulario
    const typeSelect = document.getElementById('objectiveType');
    const descTextarea = document.getElementById('objectiveDesc');
    const startDateInput = document.getElementById('objectiveStartDate');
    const endDateInput = document.getElementById('objectiveEndDate');
    const statusSelect = document.getElementById('objectiveStatus');
    const progressSlider = document.getElementById('objectiveProgress');
    
    if (!typeSelect || !descTextarea || !startDateInput || !endDateInput || !statusSelect || !progressSlider) {
        showToast("Error: No se encontraron los elementos del formulario", "error");
        return;
    }
    
    const type = typeSelect.value;
    const description = descTextarea.value;
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    const status = statusSelect.value;
    const progress = progressSlider.value;
    
    if (!description || !startDate || !endDate) {
        showToast("Todos los campos son obligatorios", "error");
        return;
    }
    
    // Añadir objetivo a la lista
    const objectivesList = document.getElementById('objectivesList');
    if (objectivesList) {
        // Determinar clase de estado
        let statusClass = 'status-pending';
        let statusText = 'Pendiente';
        let statusIcon = 'fas fa-clock';
        
        switch(status) {
            case 'inprogress': 
                statusClass = 'status-inprogress';
                statusText = 'En progreso';
                statusIcon = 'fas fa-spinner';
                break;
            case 'completed': 
                statusClass = 'status-completed';
                statusText = 'Completado';
                statusIcon = 'fas fa-check';
                break;
        }
        
        // Crear elemento del objetivo
        const newObjective = document.createElement('div');
        newObjective.className = 'objective-card fade-in';
        
        // Calcular offset para el círculo SVG
        const circumference = 2 * Math.PI * 25;
        const offset = circumference - (circumference * progress / 100);
        
        newObjective.innerHTML = `
            <div class="objective-header">
                <div class="objective-type">
                    <i class="fas fa-bullseye"></i>
                    Objetivo ${type}
                </div>
                <div class="objective-status ${statusClass}">
                    <i class="${statusIcon}"></i> ${statusText}
                </div>
            </div>
            <div class="objective-desc">
                ${description}
            </div>
            <div class="progress-container">
                <div class="progress-circle">
                    <svg width="60" height="60" viewBox="0 0 60 60">
                        <circle cx="30" cy="30" r="25" fill="none" stroke="#E0E0E0" stroke-width="5"/>
                        <circle cx="30" cy="30" r="25" fill="none" stroke="#1E88E5" stroke-width="5" stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" transform="rotate(-90 30 30)"/>
                        <text x="30" y="30" text-anchor="middle" dy=".3em" font-size="14" font-weight="bold" fill="#1E88E5">${progress}%</text>
                    </svg>
                </div>
                <div class="progress-info">
                    <div class="progress-date">
                        <span>Inicio: ${formatDate(new Date(startDate))}</span>
                        <span>Fin: ${formatDate(new Date(endDate))}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-value" style="width: ${progress}%;"></div>
                    </div>
                </div>
            </div>
        `;
        
        // Añadir al inicio para mayor visibilidad
        if (objectivesList.firstChild) {
            objectivesList.insertBefore(newObjective, objectivesList.firstChild);
        } else {
            objectivesList.appendChild(newObjective);
        }
        
        // En una implementación real, aquí se guardarían los datos en Firebase
        
        showToast("Objetivo añadido correctamente", "success");
    }
    
    // Cerrar modal
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

        // Abrir modal de plan de tratamiento
function openTreatmentPlanModal(patientId) {
    // Crear modal para plan de tratamiento
    const planModal = document.createElement('div');
    planModal.className = 'modal-overlay';
    planModal.id = 'treatmentPlanModal';
    
    planModal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Nuevo plan de tratamiento</h2>
                <button class="modal-close" id="closeTreatmentPlanModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="treatmentPlanForm">
                    <div class="form-group">
                        <label class="form-label">Fecha de inicio</label>
                        <input type="date" class="form-control" id="planStartDate" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Frecuencia de sesiones</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="number" class="form-control" id="planFrequency" min="1" max="7" value="3" style="width: 80px;">
                            <select class="form-control" id="planFrequencyUnit">
                                <option value="sesiones por semana">sesiones por semana</option>
                                <option value="sesiones por mes">sesiones por mes</option>
                            </select>
                            <input type="number" class="form-control" id="planDuration" min="1" max="52" value="4" style="width: 80px;">
                            <select class="form-control" id="planDurationUnit">
                                <option value="semanas">semanas</option>
                                <option value="meses">meses</option>
                            </select>
                        </div>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Técnicas a utilizar</label>
                        <div class="techniques-container" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="techniqueTM" checked>
                                <label for="techniqueTM">Terapia manual</label>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="techniqueEJ" checked>
                                <label for="techniqueEJ">Ejercicio terapéutico</label>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="techniqueAG">
                                <label for="techniqueAG">Agentes físicos</label>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="techniqueEN">
                                <label for="techniqueEN">Entrenamiento funcional</label>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="techniquePL">
                                <label for="techniquePL">Propiocepción y equilibrio</label>
                            </div>
                            <div style="display: flex; align-items: center; gap: 5px;">
                                <input type="checkbox" id="techniqueED">
                                <label for="techniqueED">Educación al paciente</label>
                            </div>
                        </div>
                        <input type="text" class="form-control" id="techniquesOther" placeholder="Otras técnicas...">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Observaciones y recomendaciones</label>
                        <textarea class="form-control" id="planObservations" rows="3" placeholder="Detalle observaciones específicas para este plan de tratamiento..."></textarea>
                    </div>
                    <div class="form-group" style="margin-top: 20px; text-align: right;">
                        <button type="button" class="action-btn btn-secondary" style="margin-right: 10px;" id="cancelTreatmentPlanBtn">Cancelar</button>
                        <button type="submit" class="action-btn btn-primary">Guardar plan</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(planModal);
    setTimeout(() => planModal.classList.add('active'), 50);
    
    // Configurar eventos
    document.getElementById('closeTreatmentPlanModal').addEventListener('click', function() {
        planModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(planModal), 300);
    });
    
    document.getElementById('cancelTreatmentPlanBtn').addEventListener('click', function() {
        planModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(planModal), 300);
    });
    
    document.getElementById('treatmentPlanForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        // Obtener datos del formulario
        const startDate = document.getElementById('planStartDate').value;
        const frequency = document.getElementById('planFrequency').value;
        const frequencyUnit = document.getElementById('planFrequencyUnit').value;
        const duration = document.getElementById('planDuration').value;
        const durationUnit = document.getElementById('planDurationUnit').value;
        const observations = document.getElementById('planObservations').value;
        
        // Recopilar técnicas seleccionadas
        const techniques = [];
        if (document.getElementById('techniqueTM').checked) techniques.push('Terapia manual');
        if (document.getElementById('techniqueEJ').checked) techniques.push('Ejercicio terapéutico');
        if (document.getElementById('techniqueAG').checked) techniques.push('Agentes físicos');
        if (document.getElementById('techniqueEN').checked) techniques.push('Entrenamiento funcional');
        if (document.getElementById('techniquePL').checked) techniques.push('Propiocepción y equilibrio');
        if (document.getElementById('techniqueED').checked) techniques.push('Educación al paciente');
        
        const otherTechniques = document.getElementById('techniquesOther').value;
        if (otherTechniques) {
            techniques.push(otherTechniques);
        }
        
        // Añadir plan a la lista
        const treatmentPlanList = document.getElementById('treatmentPlanList');
        if (treatmentPlanList) {
            const newPlan = document.createElement('div');
            newPlan.className = 'plan-card fade-in';
            
            newPlan.innerHTML = `
                <div class="plan-header">
                    <div class="plan-title">
                        <i class="fas fa-clipboard-list"></i>
                        Plan de Tratamiento
                    </div>
                    <div class="plan-date">${formatDate(new Date(startDate))}</div>
                </div>
                <div class="plan-details">
                    <div class="plan-row">
                        <div class="plan-label">Frecuencia:</div>
                        <div class="plan-value">${frequency} ${frequencyUnit} durante ${duration} ${durationUnit}</div>
                    </div>
                    <div class="plan-row">
                        <div class="plan-label">Técnicas:</div>
                        <div class="plan-value">
                            <div class="techniques-list">
                                ${techniques.map(t => `<div class="technique-tag">${t}</div>`).join('')}
                            </div>
                        </div>
                    </div>
                    ${observations ? `
                    <div class="plan-row">
                        <div class="plan-label">Observaciones:</div>
                        <div class="plan-value">
                            ${observations}
                        </div>
                    </div>
                    ` : ''}
                </div>
            `;
            
            // Añadir al inicio para mayor visibilidad
            if (treatmentPlanList.firstChild) {
                treatmentPlanList.insertBefore(newPlan, treatmentPlanList.firstChild);
            } else {
                treatmentPlanList.appendChild(newPlan);
            }
        }
        
        // En una implementación real, aquí se guardarían los datos en Firebase
        
        showToast("Plan de tratamiento guardado correctamente", "success");
        
        // Cerrar modal
        planModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(planModal), 300);
    });
}

// Show new evolution modal with proper validation
function showNewEvolutionModal() {
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

// Función mejorada para cambiar entre vistas
function changeView(viewName) {
    try {
        console.log(`Cambiando a vista: ${viewName}`);
        
        // Validar el nombre de la vista
        const views = {
            dashboard: window.dashboardContent || null,
            pacientes: document.getElementById('pacientesView')?.innerHTML,
            evoluciones: document.getElementById('evolucionesView')?.innerHTML,
            reportes: document.getElementById('reportesView')?.innerHTML,
            configuracion: document.getElementById('configuracionView')?.innerHTML
        };
        
        if (!views.hasOwnProperty(viewName)) {
            console.error(`Nombre de vista inválido: ${viewName}`);
            showToast(`Error: Vista "${viewName}" no encontrada`, "error");
            return;
        }
        
        const mainContent = document.getElementById('mainContent');
        if (!mainContent) {
            console.error("Contenedor principal no encontrado");
            return;
        }
        
        // Guardar la referencia al header
        const header = mainContent.querySelector('.header');
        if (!header) {
            console.error("Elemento header no encontrado");
            return;
        }
        
        // Actualizar título según la vista
        const pageTitle = header.querySelector('.page-title');
        if (pageTitle) {
            // Mantener solo el título sin los badges de paciente
            let newTitle;
            switch(viewName) {
                case 'dashboard': newTitle = 'Evoluciones Polideportivo'; break;
                case 'pacientes': newTitle = 'Gestión de Pacientes'; break;
                case 'evoluciones': newTitle = 'Registro de Evoluciones'; break;
                case 'reportes': newTitle = 'Reportes y Estadísticas'; break;
                case 'configuracion': newTitle = 'Configuración del Sistema'; break;
                default: newTitle = 'Evoluciones Polideportivo';
            }
            pageTitle.innerHTML = newTitle;
            pageTitle.setAttribute('data-original-title', newTitle);
        }
        
        // Eliminar contenido actual
        const currentContent = mainContent.querySelector('.content');
        if (currentContent) {
            currentContent.remove();
        }
        
        // Ocultar botón flotante de evolución en todas las vistas excepto dashboard
        const addEvolutionBtn = document.getElementById('addEvolutionBtn');
        if (addEvolutionBtn) {
            addEvolutionBtn.style.display = viewName === 'dashboard' ? 'flex' : 'none';
        }
        
        // Manejar vista dashboard de forma especial
        if (viewName === 'dashboard') {
            if (window.dashboardContent) {
                // Usar el contenido guardado del dashboard
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = window.dashboardContent;
                
                // Insertar después del header
                header.after(tempDiv.firstElementChild);
                
                // Cargar pacientes para el dashboard
                getPatients().then(patients => {
                    renderPatients(patients);
                    
                    // Reconectar el botón de añadir paciente
                    const addBtn = document.getElementById('addPatientBtn');
                    if (addBtn) {
                        // Eliminar manejadores previos
                        const newAddBtn = addBtn.cloneNode(true);
                        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
                        
                        newAddBtn.addEventListener('click', function() {
                            const modal = document.getElementById('newPatientModal');
                            if (modal) modal.classList.add('active');
                        });
                    }
                    
                    // Reconectar botón de añadir evolución
                    if (addEvolutionBtn) {
                        // Eliminar manejadores previos
                        const newAddEvolutionBtn = addEvolutionBtn.cloneNode(true);
                        addEvolutionBtn.parentNode.replaceChild(newAddEvolutionBtn, addEvolutionBtn);
                        
                        newAddEvolutionBtn.addEventListener('click', showNewEvolutionModal);
                    }
                });
            } else {
                // Si no hay contenido guardado, crear una estructura básica
                const content = document.createElement('div');
                content.className = 'content';
                content.innerHTML = `
                    <!-- Dashboard -->
                    <div class="dashboard">
                        <div class="dashboard-card">
                            <div class="dashboard-icon">
                                <i class="fas fa-users"></i>
                            </div>
                            <div class="dashboard-info">
                                <div class="dashboard-title">Pacientes activos</div>
                                <div class="dashboard-value" id="activePatients">0</div>
                            </div>
                        </div>
                        <div class="dashboard-card">
                            <div class="dashboard-icon">
                                <i class="fas fa-calendar-check"></i>
                            </div>
                            <div class="dashboard-info">
                                <div class="dashboard-title">Evoluciones este mes</div>
                                <div class="dashboard-value" id="monthlyEvolutions">0</div>
                            </div>
                        </div>
                        <div class="dashboard-card">
                            <div class="dashboard-icon">
                                <i class="fas fa-clipboard-check"></i>
                            </div>
                            <div class="dashboard-info">
                                <div class="dashboard-title">Objetivos logrados</div>
                                <div class="dashboard-value" id="completedObjectives">0%</div>
                            </div>
                        </div>
                        <div class="dashboard-card">
                            <div class="dashboard-icon">
                                <i class="fas fa-user-graduate"></i>
                            </div>
                            <div class="dashboard-info">
                                <div class="dashboard-title">Estudiantes activos</div>
                                <div class="dashboard-value" id="activeStudents">0</div>
                            </div>
                        </div>
                    </div>

                    <!-- Patient List -->
                    <div class="section-header">
                        <h2 class="section-title">Pacientes recientes</h2>
                        <button class="action-btn btn-primary" id="addPatientBtn">
                            <i class="fas fa-plus"></i> Nuevo paciente
                        </button>
                    </div>
                    <div class="patient-list" id="patientList">
                        <!-- Patient cards will be generated here -->
                        <div class="patient-card" data-id="loading">
                            <div class="patient-status status-active"></div>
                            <div class="patient-avatar">...</div>
                            <h3 class="patient-name">Cargando pacientes...</h3>
                            <div class="patient-rut">Por favor espere</div>
                            <div class="patient-info">
                                <div>
                                    <div class="patient-label">Última sesión</div>
                                    <div>--/--/----</div>
                                </div>
                                <div>
                                    <div class="patient-label">Progreso</div>
                                    <div>--%</div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
                
                // Insertar después del header
                header.after(content);
                
                // Guardar para futuras referencias
                window.dashboardContent = content.outerHTML;
                
                // Cargar datos
                getPatients().then(patients => {
                    renderPatients(patients);
                    
                    // Reconectar botones
                    const addBtn = document.getElementById('addPatientBtn');
                    if (addBtn) {
                        addBtn.addEventListener('click', function() {
                            const modal = document.getElementById('newPatientModal');
                            if (modal) modal.classList.add('active');
                        });
                    }
                    
                    if (addEvolutionBtn) {
                        addEvolutionBtn.addEventListener('click', showNewEvolutionModal);
                    }
                });
            }
        } else {
            // Para otras vistas, crear un template HTML dinámico
            const tempContent = document.createElement('div');
            tempContent.className = 'content';
            
            // Generar contenido según la vista
            switch(viewName) {
                case 'pacientes':
                    tempContent.innerHTML = `
                        <h1 class="page-title">Gestión de Pacientes</h1>
                        <div class="section-header">
                            <h2 class="section-title">Listado de Pacientes</h2>
                            <button class="action-btn btn-primary" id="addPatientBtnView">
                                <i class="fas fa-plus"></i> Nuevo paciente
                            </button>
                        </div>
                        <div class="patient-list" id="patientListView"></div>
                    `;
                    break;
                    
                case 'evoluciones':
                    tempContent.innerHTML = `
                        <h1 class="page-title">Registro de Evoluciones</h1>
                        
                        <!-- Selector de paciente mejorado -->
                        <div class="patient-selector" id="patientSelector">
                            <div class="patient-selector-header" id="patientSelectorHeader">
                                <i class="fas fa-user-injured"></i>
                                <span>Seleccione un paciente para registrar evoluciones</span>
                                <i class="fas fa-chevron-down" style="margin-left: auto;"></i>
                            </div>
                            <div class="patient-selector-dropdown" id="patientSelectorDropdown">
                                <div class="patient-selector-search">
                                    <input type="text" placeholder="Buscar paciente..." id="patientSelectorSearchInput">
                                </div>
                                <div class="patient-selector-list" id="patientSelectorList">
                                    <!-- Lista de pacientes se cargará aquí -->
                                </div>
                            </div>
                        </div>
                        
                        <div id="selectedPatientInfo" style="display: none; margin: 20px 0; padding: 15px; background-color: var(--background-alt); border-radius: 8px;">
                            <h3 style="margin-bottom: 10px; display: flex; align-items: center;">
                                <i class="fas fa-user-circle" style="margin-right: 10px; color: var(--primary);"></i>
                                <span id="selectedPatientName">Nombre del paciente</span>
                            </h3>
                            <div style="display: flex; flex-wrap: wrap; gap: 15px;">
                                <div style="flex: 1;">
                                    <p style="margin-bottom: 5px;"><strong>RUT:</strong> <span id="selectedPatientRUT"></span></p>
                                    <p style="margin-bottom: 5px;"><strong>Última evolución:</strong> <span id="selectedPatientLastSession"></span></p>
                                </div>
                                <div style="flex: 1;">
                                    <p style="margin-bottom: 5px;"><strong>Total evoluciones:</strong> <span id="selectedPatientTotalEvolutions"></span></p>
                                    <p style="margin-bottom: 5px;"><strong>Progreso:</strong> <span id="selectedPatientProgress"></span></p>
                                </div>
                            </div>
                            <div style="margin-top: 15px; display: flex; justify-content: flex-end;">
                                <button class="action-btn btn-primary" id="addEvolutionForSelectedBtn">
                                    <i class="fas fa-plus"></i> Nueva evolución
                                </button>
                                <button class="action-btn btn-secondary" style="margin-left: 10px;" id="viewPatientDetailsBtn">
                                    <i class="fas fa-eye"></i> Ver detalles
                                </button>
                            </div>
                        </div>
                        
                        <div class="patient-list" id="patientEvolutionsView"></div>
                    `;
                    break;
                    
                case 'reportes':
                    tempContent.innerHTML = `
                        <h1 class="page-title">Reportes y Estadísticas</h1>
                        <div class="dashboard">
                            <div class="dashboard-card">
                                <div class="dashboard-icon">
                                    <i class="fas fa-users"></i>
                                </div>
                                <div class="dashboard-info">
                                    <div class="dashboard-title">Total pacientes</div>
                                    <div class="dashboard-value" id="totalPatientsReport">0</div>
                                </div>
                            </div>
                            <div class="dashboard-card">
                                <div class="dashboard-icon">
                                    <i class="fas fa-clipboard-check"></i>
                                </div>
                                <div class="dashboard-info">
                                    <div class="dashboard-title">Total evoluciones</div>
                                    <div class="dashboard-value" id="totalEvolutionsReport">0</div>
                                </div>
                            </div>
                            <div class="dashboard-card">
                                <div class="dashboard-icon">
                                    <i class="fas fa-chart-line"></i>
                                </div>
                                <div class="dashboard-info">
                                    <div class="dashboard-title">Evoluciones este mes</div>
                                    <div class="dashboard-value" id="monthEvolutionsReport">0</div>
                                </div>
                            </div>
                            <div class="dashboard-card">
                                <div class="dashboard-icon">
                                    <i class="fas fa-user-graduate"></i>
                                </div>
                                <div class="dashboard-info">
                                    <div class="dashboard-title">Estudiantes activos</div>
                                    <div class="dashboard-value" id="activeStudentsReport">0</div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 30px;">
                            <div class="section-header">
                                <h2 class="section-title">Exportar informes</h2>
                            </div>
                            
                            <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                                <div style="flex: 1; min-width: 300px; background-color: var(--background); padding: 20px; border-radius: 12px; box-shadow: var(--shadow);">
                                    <h3 style="margin-bottom: 15px; color: var(--primary);">
                                        <i class="fas fa-file-alt" style="margin-right: 10px;"></i>
                                        Informe de paciente
                                    </h3>
                                    <p style="margin-bottom: 15px; color: var(--text-secondary);">
                                        Genera un informe completo con evolución, diagnóstico y tratamientos de un paciente específico.
                                    </p>
                                    <div class="form-group">
                                        <label class="form-label">Seleccionar paciente</label>
                                        <select class="form-control" id="reportPatientSelect">
                                            <option value="">Seleccionar paciente...</option>
                                            <!-- Se cargará dinámicamente -->
                                        </select>
                                    </div>
                                    <div style="text-align: right; margin-top: 15px;">
                                        <button class="action-btn btn-primary" id="generatePatientReportBtn">
                                            <i class="fas fa-file-pdf"></i> Generar informe
                                        </button>
                                    </div>
                                </div>
                                
                                <div style="flex: 1; min-width: 300px; background-color: var(--background); padding: 20px; border-radius: 12px; box-shadow: var(--shadow);">
                                    <h3 style="margin-bottom: 15px; color: var(--primary);">
                                        <i class="fas fa-chart-pie" style="margin-right: 10px;"></i>
                                        Informe estadístico
                                    </h3>
                                    <p style="margin-bottom: 15px; color: var(--text-secondary);">
                                        Genera un informe con estadísticas de actividad, progresos y evoluciones durante un período.
                                    </p>
                                    <div class="form-row">
                                        <div class="form-col">
                                            <div class="form-group">
                                                <label class="form-label">Desde</label>
                                                <input type="date" class="form-control" id="reportStartDate">
                                            </div>
                                        </div>
                                        <div class="form-col">
                                            <div class="form-group">
                                                <label class="form-label">Hasta</label>
                                                <input type="date" class="form-control" id="reportEndDate">
                                            </div>
                                        </div>
                                    </div>
                                    <div style="text-align: right; margin-top: 15px;">
                                        <button class="action-btn btn-primary" id="generateStatReportBtn">
                                            <i class="fas fa-file-pdf"></i> Generar estadísticas
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    `;
                    break;
                    
                case 'configuracion':
                    tempContent.innerHTML = `
                        <h1 class="page-title">Configuración del Sistema</h1>
                        
                        <div style="display: flex; flex-wrap: wrap; gap: 20px; margin-top: 20px;">
                            <div style="flex: 1; min-width: 300px; background-color: var(--background); padding: 20px; border-radius: 12px; box-shadow: var(--shadow);">
                                <h3 style="margin-bottom: 15px; color: var(--primary);">
                                    <i class="fas fa-clinic-medical" style="margin-right: 10px;"></i>
                                    Información del centro
                                </h3>
                                
                                <div class="form-group">
                                    <label class="form-label">Nombre del centro</label>
                                    <input type="text" class="form-control" id="centerName" value="Polideportivo">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Dirección</label>
                                    <input type="text" class="form-control" id="centerAddress" value="">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Teléfono</label>
                                    <input type="text" class="form-control" id="centerPhone" value="">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Logo del centro</label>
                                    <input type="file" class="form-control" id="centerLogo">
                                </div>
                            </div>
                            
                            <div style="flex: 1; min-width: 300px; background-color: var(--background); padding: 20px; border-radius: 12px; box-shadow: var(--shadow);">
                                <h3 style="margin-bottom: 15px; color: var(--primary);">
                                    <i class="fas fa-user-md" style="margin-right: 10px;"></i>
                                    Profesionales
                                </h3>
                                
                                <div class="form-group">
                                    <label class="form-label">Nombre del kinesiólogo a cargo</label>
                                    <input type="text" class="form-control" id="mainTherapistName" value="Nicolás Ayelef">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Número de registro</label>
                                    <input type="text" class="form-control" id="mainTherapistLicense" value="">
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Correo electrónico</label>
                                    <input type="email" class="form-control" id="mainTherapistEmail" value="">
                                </div>
                            </div>
                        </div>
                        
                        <div style="background-color: var(--background); padding: 20px; border-radius: 12px; box-shadow: var(--shadow); margin-top: 20px;">
                            <h3 style="margin-bottom: 15px; color: var(--primary);">
                                <i class="fas fa-palette" style="margin-right: 10px;"></i>
                                Apariencia
                            </h3>
                            
                            <div style="display: flex; flex-wrap: wrap; gap: 20px;">
                                <div style="flex: 1; min-width: 200px;">
                                    <div class="form-group">
                                        <label class="form-label">Tema de colores</label>
                                        <select class="form-control" id="colorTheme">
                                            <option value="blue" selected>Azul (Predeterminado)</option>
                                            <option value="green">Verde</option>
                                            <option value="purple">Morado</option>
                                            <option value="orange">Naranja</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <div style="flex: 1; min-width: 200px;">
                                    <div class="form-group">
                                        <label class="form-label">Tamaño de fuente</label>
                                        <select class="form-control" id="fontSize">
                                            <option value="small">Pequeño</option>
                                            <option value="medium" selected>Medio (Predeterminado)</option>
                                            <option value="large">Grande</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div style="margin-top: 20px; text-align: right;">
                            <button class="action-btn btn-secondary" style="margin-right: 10px;" id="resetConfigBtn">
                                <i class="fas fa-undo"></i> Restaurar predeterminados
                            </button>
                            <button class="action-btn btn-primary" id="saveConfigBtn">
                                <i class="fas fa-save"></i> Guardar configuración
                            </button>
                        </div>
                    `;
                    break;
                    
                default:
                    tempContent.innerHTML = '<p>Vista no disponible</p>';
            }
            
            // Insertar después del header
            header.after(tempContent);
            
            // Manejar lógica específica de cada vista
            if (viewName === 'pacientes') {
                getPatients().then(patients => {
                    renderPatientsInView('patientListView', patients);
                    
                    // Reconectar botón de nuevo paciente
                    const addBtn = document.getElementById('addPatientBtnView');
                    if (addBtn) {
                        // Eliminar manejadores previos
                        const newAddBtn = addBtn.cloneNode(true);
                        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
                        
                        newAddBtn.addEventListener('click', function() {
                            const modal = document.getElementById('newPatientModal');
                            if (modal) modal.classList.add('active');
                        });
                    }
                });
            } 
            else if (viewName === 'evoluciones') {
                getPatients().then(patients => {
                    // Inicializar selector de pacientes
                    initPatientSelector(patients);
                    
                    // Mostrar pacientes en la vista principal
                    renderPatientsInView('patientEvolutionsView', patients);
                });
            }
            else if (viewName === 'reportes') {
                updateReportStatistics();
                
                // Cargar pacientes para el selector de informes
                getPatients().then(patients => {
                    const reportSelect = document.getElementById('reportPatientSelect');
                    if (reportSelect) {
                        reportSelect.innerHTML = '<option value="">Seleccionar paciente...</option>';
                        
                        patients.forEach(patient => {
                            reportSelect.innerHTML += `<option value="${patient.id}">${patient.name} (${patient.rut})</option>`;
                        });
                    }
                    
                    // Inicializar fechas para informe estadístico
                    const today = new Date();
                    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
                    const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                    
                    const startDateInput = document.getElementById('reportStartDate');
                    const endDateInput = document.getElementById('reportEndDate');
                    
                    if (startDateInput && endDateInput) {
                        startDateInput.value = firstDayOfMonth.toISOString().split('T')[0];
                        endDateInput.value = lastDayOfMonth.toISOString().split('T')[0];
                    }
                    
                    // Configurar botones de generación de informes
                    const patientReportBtn = document.getElementById('generatePatientReportBtn');
                    if (patientReportBtn) {
                        // Eliminar manejadores previos
                        const newPatientReportBtn = patientReportBtn.cloneNode(true);
                        patientReportBtn.parentNode.replaceChild(newPatientReportBtn, patientReportBtn);
                        
                        newPatientReportBtn.addEventListener('click', generatePatientReport);
                    }
                    
                    const statReportBtn = document.getElementById('generateStatReportBtn');
                    if (statReportBtn) {
                        // Eliminar manejadores previos
                        const newStatReportBtn = statReportBtn.cloneNode(true);
                        statReportBtn.parentNode.replaceChild(newStatReportBtn, statReportBtn);
                        
                        newStatReportBtn.addEventListener('click', generateStatisticsReport);
                    }
                });
            }
            else if (viewName === 'configuracion') {
                // Cargar configuración guardada (si existe)
                loadConfiguration();
                
                // Configurar eventos
                const saveConfigBtn = document.getElementById('saveConfigBtn');
                if (saveConfigBtn) {
                    // Eliminar manejadores previos
                    const newSaveConfigBtn = saveConfigBtn.cloneNode(true);
                    saveConfigBtn.parentNode.replaceChild(newSaveConfigBtn, saveConfigBtn);
                    
                    newSaveConfigBtn.addEventListener('click', saveConfiguration);
                }
                
                const resetConfigBtn = document.getElementById('resetConfigBtn');
                if (resetConfigBtn) {
                    // Eliminar manejadores previos
                    const newResetConfigBtn = resetConfigBtn.cloneNode(true);
                    resetConfigBtn.parentNode.replaceChild(newResetConfigBtn, resetConfigBtn);
                    
                    newResetConfigBtn.addEventListener('click', resetConfiguration);
                }
                
                // Inicializar selector de tema
                const colorThemeSelect = document.getElementById('colorTheme');
                if (colorThemeSelect) {
                    // Eliminar manejadores previos
                    const newColorThemeSelect = colorThemeSelect.cloneNode(true);
                    colorThemeSelect.parentNode.replaceChild(newColorThemeSelect, colorThemeSelect);
                    
                    newColorThemeSelect.addEventListener('change', function() {
                        applyColorTheme(this.value);
                    });
                }
            }
        }
        
        // Actualizar barra de navegación
        document.querySelectorAll('.menu-item').forEach(item => {
            item.classList.remove('active');
            
            const itemText = item.querySelector('.menu-item-text');
            if (itemText && itemText.textContent.trim().toLowerCase() === viewName.toLowerCase()) {
                item.classList.add('active');
            } else if (
                (viewName === 'dashboard' && item === document.querySelector('.menu-item:first-child')) ||
                (viewName === 'pacientes' && item.textContent.includes('Pacientes')) ||
                (viewName === 'evoluciones' && item.textContent.includes('Evoluciones')) ||
                (viewName === 'reportes' && item.textContent.includes('Reportes')) ||
                (viewName === 'configuracion' && item.textContent.includes('Configuración'))
            ) {
                item.classList.add('active');
            }
        });
        
        showToast(`Vista cargada: ${viewName}`, "info");
    } catch (error) {
        console.error(`Error cambiando a vista ${viewName}:`, error);
        showToast(`Error al cambiar de vista: ${error.message}`, "error");
    }
}

        // Actualizar estadísticas de reportes
async function updateReportStatistics() {
    try {
        // Obtener todos los pacientes
        const patients = await getPatients();
        const totalElement = document.getElementById('totalPatientsReport');
        if (totalElement) {
            totalElement.textContent = patients.length;
        }
        
        // Contar todas las evoluciones
        let totalEvolutions = 0;
        let monthEvolutions = 0;
        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        
        for (const patient of patients) {
            const evolutions = await getEvolutions(patient.id);
            totalEvolutions += evolutions.length;
            
            // Contar evoluciones del mes actual
            evolutions.forEach(evolution => {
                if (evolution.date) {
                    const evolutionDate = new Date(evolution.date);
                    if (
                        evolutionDate.getMonth() === currentMonth && 
                        evolutionDate.getFullYear() === currentYear
                    ) {
                        monthEvolutions++;
                    }
                }
            });
        }
        
        const evolutionsElement = document.getElementById('totalEvolutionsReport');
        if (evolutionsElement) {
            evolutionsElement.textContent = totalEvolutions;
        }
        
        const monthEvolutionsElement = document.getElementById('monthEvolutionsReport');
        if (monthEvolutionsElement) {
            monthEvolutionsElement.textContent = monthEvolutions;
        }
        
        // Mostrar número de estudiantes activos (simulado)
        const studentsElement = document.getElementById('activeStudentsReport');
        if (studentsElement) {
            studentsElement.textContent = "12";
        }
    } catch (error) {
        console.error('Error actualizando estadísticas de reportes:', error);
        showToast("Error al cargar estadísticas: " + error.message, "error");
    }
}

// Generar informe de paciente
function generatePatientReport() {
    const patientSelect = document.getElementById('reportPatientSelect');
    if (!patientSelect) {
        showToast("Error: Selector de paciente no encontrado", "error");
        return;
    }
    
    const patientId = patientSelect.value;
    
    if (!patientId) {
        showToast("Debe seleccionar un paciente para generar el informe", "error");
        return;
    }
    
    // Redirigir al exportar PDF del paciente
    currentPatientId = patientId;
    
    // Mostrar opciones de exportación
    const pdfOptionsContainer = document.getElementById('pdfOptionsContainer');
    if (pdfOptionsContainer) {
        pdfOptionsContainer.style.display = 'block';
        
        // Configurar botones
        const cancelBtn = document.getElementById('cancelPdfExport');
        if (cancelBtn) {
            // Eliminar manejadores previos
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            newCancelBtn.addEventListener('click', function() {
                pdfOptionsContainer.style.display = 'none';
            });
        }
        
        const generateBtn = document.getElementById('generatePdfBtn');
        if (generateBtn) {
            // Eliminar manejadores previos
            const newGenerateBtn = generateBtn.cloneNode(true);
            generateBtn.parentNode.replaceChild(newGenerateBtn, generateBtn);
            
            newGenerateBtn.addEventListener('click', function() {
                exportToPDF(patientId);
                pdfOptionsContainer.style.display = 'none';
            });
        }
    }
}

// Generar informe estadístico
function generateStatisticsReport() {
    const startDateInput = document.getElementById('reportStartDate');
    const endDateInput = document.getElementById('reportEndDate');
    
    if (!startDateInput || !endDateInput) {
        showToast("Error: Campos de fecha no encontrados", "error");
        return;
    }
    
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (!startDate || !endDate) {
        showToast("Debe seleccionar fechas para generar el informe", "error");
        return;
    }
    
    showToast("Generando informe estadístico...", "info");
    // Aquí iría la lógica para generar un informe estadístico
    setTimeout(() => {
        showToast("Informe estadístico generado correctamente", "success");
    }, 1500);
}

// Export PDF function (mejorada)
async function exportToPDF(patientId) {
    try {
        showLoading();
        
        // Verificar que jsPDF esté disponible
        if (!window.jspdf || !window.jspdf.jsPDF) {
            showToast("Error: Librería jsPDF no disponible. Verifique la conexión a Internet.", "error");
            hideLoading();
            return;
        }
        
        // Get patient data
        const patient = await getPatient(patientId);
        if (!patient) {
            hideLoading();
            return;
        }
        
        // Get evolutions
        const evolutions = await getEvolutions(patientId);
        
        // Leer opciones del formulario
        const includeDiagnosis = document.getElementById('pdfIncludeDiagnosis')?.checked || true;
        const includeEvolutions = document.getElementById('pdfIncludeEvolutions')?.checked || true;
        const includeScales = document.getElementById('pdfIncludeScales')?.checked || true;
        const includeExercises = document.getElementById('pdfIncludeExercises')?.checked || true;
        const includeLogo = document.getElementById('pdfIncludeLogo')?.checked || true;
        const includeFooter = document.getElementById('pdfIncludeFooter')?.checked || true;
        
        // Filtrar evoluciones según período seleccionado
        let filteredEvolutions = [...evolutions];
        const evolutionPeriod = document.getElementById('pdfEvolutionPeriod')?.value || 'all';
        
        if (evolutionPeriod !== 'all') {
            if (evolutionPeriod === 'last-month') {
                const oneMonthAgo = new Date();
                oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
                
                filteredEvolutions = evolutions.filter(ev => {
                    if (!ev.date) return false;
                    return new Date(ev.date) >= oneMonthAgo;
                });
            } else if (evolutionPeriod === 'last-3') {
                filteredEvolutions = evolutions.slice(0, 3);
            } else if (evolutionPeriod === 'custom') {
                const startDate = new Date(document.getElementById('pdfDateFrom')?.value);
                const endDate = new Date(document.getElementById('pdfDateTo')?.value);
                
                if (startDate && endDate) {
                    filteredEvolutions = evolutions.filter(ev => {
                        if (!ev.date) return false;
                        const evDate = new Date(ev.date);
                        return evDate >= startDate && evDate <= endDate;
                    });
                }
            }
        }
        
        // Create a new PDF using jsPDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Get center info from configuration
        let centerName = "Polideportivo";
        let centerAddress = "";
        let therapistName = "Nicolás Ayelef";
        
        try {
            const savedConfig = localStorage.getItem('sistemakineConfig');
            if (savedConfig) {
                const config = JSON.parse(savedConfig);
                if (config.centerName) centerName = config.centerName;
                if (config.centerAddress) centerAddress = config.centerAddress;
                if (config.mainTherapistName) therapistName = config.mainTherapistName;
            }
        } catch (error) {
            console.error("Error al cargar configuración para PDF:", error);
        }
        
        // Add header with logo and title
        doc.setFillColor(30, 136, 229);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(`INFORME KINESIOLÓGICO - ${centerName.toUpperCase()}`, 105, 15, null, null, 'center');
        
        // Add patient info in a box
        doc.setFillColor(245, 247, 250);
        doc.rect(10, 30, 190, 60, 'F');
        
        doc.setTextColor(30, 136, 229);
        doc.setFontSize(14);
        doc.text(`Paciente: ${patient.name || 'Sin nombre'}`, 15, 40);
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`RUT: ${patient.rut || 'No registrado'}`, 15, 50);
        doc.text(`Teléfono: ${patient.phone || 'No registrado'}`, 15, 60);
        doc.text(`Fecha del informe: ${formatDate(new Date())}`, 15, 70);
        
        if (centerAddress) {
            doc.text(`Centro: ${centerName} - ${centerAddress}`, 15, 80);
        }
        
        let yPos = 100;
        
        // Add diagnoses if requested
        if (includeDiagnosis) {
            doc.setFillColor(30, 136, 229);
            doc.rect(10, yPos, 190, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('DIAGNÓSTICO KINESIOLÓGICO', 105, yPos + 7, null, null, 'center');
            
            // Reset font
            doc.setFont(undefined, 'normal');
            yPos += 20;
            
            // Add diagnosis info (if available)
            // In a real implementation, this would fetch the actual diagnosis data
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            doc.text("Diagnóstico kinesiológico funcional del paciente:", 15, yPos);
            yPos += 10;
            
            // Ejemplo de diagnóstico (esto debería venir de la base de datos)
            const diagnosisText = patient.diagnosis || "No se ha registrado un diagnóstico formal para este paciente.";
            const diagnosisLines = doc.splitTextToSize(diagnosisText, 180);
            doc.text(diagnosisLines, 15, yPos);
            yPos += diagnosisLines.length * 7 + 15;
            
            // Check if we need a new page
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
        }
        
        // Add evolutions if requested
        if (includeEvolutions) {
            doc.setFillColor(30, 136, 229);
            doc.rect(10, yPos, 190, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('HISTORIAL DE EVOLUCIONES', 105, yPos + 7, null, null, 'center');
            
            // Reset font
            doc.setFont(undefined, 'normal');
            
            yPos += 20;
            
            if (!filteredEvolutions || filteredEvolutions.length === 0) {
                doc.setFontSize(11);
                doc.setTextColor(0, 0, 0);
                doc.text('No hay evoluciones registradas para este paciente.', 15, yPos);
                yPos += 10;
            } else {
                // Sort evolutions from newest to oldest
                filteredEvolutions.sort((a, b) => {
                    if (!a.date || !b.date) return 0;
                    return new Date(b.date) - new Date(a.date);
                });
                
                for (let i = 0; i < filteredEvolutions.length; i++) {
                    const evolution = filteredEvolutions[i];
                    
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    // Add evolution date with background
                    doc.setFillColor(230, 240, 250);
                    doc.rect(10, yPos - 5, 190, 10, 'F');
                    doc.setTextColor(30, 136, 229);
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    
                    const evolutionDate = evolution.date ? formatDate(new Date(evolution.date)) : 'Fecha no registrada';
                    const evolutionTime = evolution.time || '';
                    doc.text(`${evolutionDate} - ${evolutionTime}`, 15, yPos);
                    yPos += 10;
                    
                    // Reset font
                    doc.setFont(undefined, 'normal');
                    
                    // Add student
                    doc.setFontSize(10);
                    doc.setTextColor(100, 100, 100);
                    doc.text(`Realizado por: ${evolution.student || 'No registrado'}`, 15, yPos);
                    yPos += 10;
                    
                    // Add evolution details
                    doc.setFontSize(11);
                    doc.setTextColor(0, 0, 0);
                    
                    if (evolution.patientState) {
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Estado del paciente:', 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0);
                        const patientStateLines = doc.splitTextToSize(evolution.patientState, 180);
                        doc.text(patientStateLines, 15, yPos);
                        yPos += patientStateLines.length * 7 + 5;
                    }
                    
                    if (evolution.treatment) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Tratamiento realizado:', 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0);
                        const treatmentLines = doc.splitTextToSize(evolution.treatment, 180);
                        doc.text(treatmentLines, 15, yPos);
                        yPos += treatmentLines.length * 7 + 5;
                    }
                    
                    if (evolution.response) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Respuesta al tratamiento:', 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0);
                        const responseLines = doc.splitTextToSize(evolution.response, 180);
                        doc.text(responseLines, 15, yPos);
                        yPos += responseLines.length * 7 + 5;
                    }
                    
                    // Add scales if requested
                    if (includeScales && evolution.scales) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Escalas de evaluación:', 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0);
                        
                        if (evolution.scales.eva !== undefined) {
                            doc.text(`EVA (Dolor): ${evolution.scales.eva}/10`, 20, yPos);
                            yPos += 7;
                        }
                        
                        if (evolution.scales.groc !== undefined) {
                            doc.text(`GROC (Cambio global): ${evolution.scales.groc > 0 ? '+' + evolution.scales.groc : evolution.scales.groc}`, 20, yPos);
                            yPos += 7;
                        }
                        
                        if (evolution.scales.sane !== undefined) {
                            doc.text(`SANE (Evaluación numérica): ${evolution.scales.sane}%`, 20, yPos);
                            yPos += 7;
                        }
                        
                        // PSFS activities
                        if (evolution.scales.psfs && evolution.scales.psfs.length > 0) {
                            yPos += 3;
                            doc.text("PSFS (Funcionalidad):", 20, yPos);
                            yPos += 7;
                            
                            evolution.scales.psfs.forEach(activity => {
                                if (activity && activity.name) {
                                    doc.text(`- ${activity.name}: ${activity.rating || 0}/10`, 25, yPos);
                                    yPos += 7;
                                }
                            });
                        }
                        
                        yPos += 5;
                    }
                    
                    // Add exercises if requested
                    if (includeExercises && evolution.exercises && evolution.exercises.length > 0) {
                        // Check if we need a new page
                        if (yPos > 230) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Ejercicios prescritos:', 15, yPos);
                        yPos += 10;
                        
                        // Simple table for exercises
                        const tableTop = yPos;
                        const cellPadding = 5;
                        const colWidths = [60, 30, 30, 40, 30]; // Adjust widths as needed
                        
                        // Table header
                        doc.setFillColor(230, 240, 250);
                        doc.rect(15, yPos - 7, 180, 10, 'F');
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text("Ejercicio", 15 + cellPadding, yPos);
                        doc.text("Series", 75 + cellPadding, yPos);
                        doc.text("Reps", 105 + cellPadding, yPos);
                        doc.text("Intensidad", 135 + cellPadding, yPos);
                        doc.text("Notas", 175 + cellPadding, yPos);
                        yPos += 10;
                        
                        // Table rows
                        doc.setTextColor(0, 0, 0);
                        doc.setFont(undefined, 'normal');
                        
                        evolution.exercises.forEach((exercise, index) => {
                            // Check if we need a new page
                            if (yPos > 270) {
                                doc.addPage();
                                yPos = 20;
                                
                                // Repeat header on new page
                                doc.setFillColor(230, 240, 250);
                                doc.rect(15, yPos - 7, 180, 10, 'F');
                                doc.setTextColor(30, 136, 229);
                                doc.setFont(undefined, 'bold');
                                doc.text("Ejercicio", 15 + cellPadding, yPos);
                                doc.text("Series", 75 + cellPadding, yPos);
                                doc.text("Reps", 105 + cellPadding, yPos);
                                doc.text("Intensidad", 135 + cellPadding, yPos);
                                doc.text("Notas", 175 + cellPadding, yPos);
                                yPos += 10;
                                
                                doc.setTextColor(0, 0, 0);
                                doc.setFont(undefined, 'normal');
                            }
                            
                            // Row background for even rows
                            if (index % 2 === 1) {
                                doc.setFillColor(245, 247, 250);
                                doc.rect(15, yPos - 7, 180, 10, 'F');
                            }
                            
                            // Cell content
                            doc.text(exercise.name?.substring(0, 20) || 'Sin nombre', 15 + cellPadding, yPos);
                            doc.text(exercise.sets?.toString() || '3', 75 + cellPadding, yPos);
                            doc.text(exercise.reps?.toString() || '10', 105 + cellPadding, yPos);
                            doc.text(exercise.intensity || 'Media', 135 + cellPadding, yPos);
                            
                            // Notes (might need truncation)
                            const notes = exercise.notes?.substring(0, 15) || '';
                            doc.text(notes, 175 + cellPadding, yPos);
                            
                            yPos += 10;
                        });
                        
                        yPos += 5;
                    }
                    
                    if (evolution.trainingPlan) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Plan de entrenamiento:', 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0);
                        const planLines = doc.splitTextToSize(evolution.trainingPlan, 180);
                        doc.text(planLines, 15, yPos);
                        yPos += planLines.length * 7 + 5;
                    }
                    
                    if (evolution.observations) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFontSize(11);
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text('Observaciones adicionales:', 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        doc.setTextColor(0, 0, 0);
                        const observationsLines = doc.splitTextToSize(evolution.observations, 180);
                        doc.text(observationsLines, 15, yPos);
                        yPos += observationsLines.length * 7 + 5;
                    }
                    
                    // Add separator line
                    doc.setDrawColor(200, 200, 200);
                    doc.line(15, yPos, 195, yPos);
                    yPos += 15;
                }
            }
        }
        
        // Add footer if requested
        if (includeFooter) {
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(9);
                doc.setTextColor(150, 150, 150);
                doc.text(`Página ${i} de ${pageCount} - ${centerName}`, 105, 290, null, null, 'center');
                
                // Add timestamp and kinesiólogo
                const timestamp = new Date().toLocaleString();
                doc.text(`Generado: ${timestamp} - Kinesiólogo: ${therapistName}`, 105, 285, null, null, 'center');
            }
        }
        
        // Save the PDF with better filename
        try {
            // In case patient.name is undefined, use "Paciente" as default
            const patientName = patient.name || 'Paciente';
            
            // Sanitize the filename: replace spaces and special characters
            const sanitizedName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
            const today = new Date().toISOString().slice(0, 10);
            
            doc.save(`Informe_${sanitizedName}_${today}.pdf`);
            
            hideLoading();
            showToast('PDF generado correctamente', 'success');
        } catch (error) {
            console.error('Error guardando PDF:', error);
            hideLoading();
            showToast('Error al guardar PDF: ' + error.message, 'error');
        }
    } catch (error) {
        console.error('Error generando PDF:', error);
        hideLoading();
        showToast('Error al generar PDF: ' + error.message, 'error');
    }
}

// Cargar configuración
function loadConfiguration() {
    try {
        // Intentar obtener configuración guardada en localStorage
        const savedConfig = localStorage.getItem('sistemakineConfig');
        if (savedConfig) {
            const config = JSON.parse(savedConfig);
            
            // Llenar campos del formulario
            if (config.centerName && document.getElementById('centerName')) 
                document.getElementById('centerName').value = config.centerName;
                
            if (config.centerAddress && document.getElementById('centerAddress')) 
                document.getElementById('centerAddress').value = config.centerAddress;
                
            if (config.centerPhone && document.getElementById('centerPhone')) 
                document.getElementById('centerPhone').value = config.centerPhone;
            
            if (config.mainTherapistName && document.getElementById('mainTherapistName')) 
                document.getElementById('mainTherapistName').value = config.mainTherapistName;
                
            if (config.mainTherapistLicense && document.getElementById('mainTherapistLicense')) 
                document.getElementById('mainTherapistLicense').value = config.mainTherapistLicense;
                
            if (config.mainTherapistEmail && document.getElementById('mainTherapistEmail')) 
                document.getElementById('mainTherapistEmail').value = config.mainTherapistEmail;
            
            // Aplicar tema de colores si se guardó
            if (config.colorTheme && document.getElementById('colorTheme')) {
                document.getElementById('colorTheme').value = config.colorTheme;
                applyColorTheme(config.colorTheme);
            }
            
            // Aplicar tamaño de fuente si se guardó
            if (config.fontSize && document.getElementById('fontSize')) {
                document.getElementById('fontSize').value = config.fontSize;
                applyFontSize(config.fontSize);
            }
        }
    } catch (error) {
        console.error("Error al cargar configuración:", error);
        showToast("Error al cargar configuración guardada", "error");
    }
}

// Guardar configuración
function saveConfiguration() {
    try {
        const centerName = document.getElementById('centerName')?.value;
        const centerAddress = document.getElementById('centerAddress')?.value;
        const centerPhone = document.getElementById('centerPhone')?.value;
        const mainTherapistName = document.getElementById('mainTherapistName')?.value;
        const mainTherapistLicense = document.getElementById('mainTherapistLicense')?.value;
        const mainTherapistEmail = document.getElementById('mainTherapistEmail')?.value;
        const colorTheme = document.getElementById('colorTheme')?.value;
        const fontSize = document.getElementById('fontSize')?.value;
        
        if (!centerName) {
            showToast("Nombre del centro es obligatorio", "error");
            return;
        }
        
        const config = {
            centerName,
            centerAddress,
            centerPhone,
            mainTherapistName,
            mainTherapistLicense,
            mainTherapistEmail,
            colorTheme,
            fontSize
        };
        
        // Guardar en localStorage
        localStorage.setItem('sistemakineConfig', JSON.stringify(config));
        
        // Aplicar cambios visuales
        if (colorTheme) applyColorTheme(colorTheme);
        if (fontSize) applyFontSize(fontSize);
        
        showToast("Configuración guardada correctamente", "success");
    } catch (error) {
        console.error("Error al guardar configuración:", error);
        showToast("Error al guardar configuración", "error");
    }
}

// Restaurar configuración predeterminada
function resetConfiguration() {
    try {
        if (confirm("¿Está seguro que desea restaurar la configuración predeterminada? Se perderán todos los cambios.")) {
            // Eliminar configuración guardada
            localStorage.removeItem('sistemakineConfig');
            
            // Restaurar valores predeterminados
            const centerNameInput = document.getElementById('centerName');
            const centerAddressInput = document.getElementById('centerAddress');
            const centerPhoneInput = document.getElementById('centerPhone');
            const mainTherapistNameInput = document.getElementById('mainTherapistName');
            const mainTherapistLicenseInput = document.getElementById('mainTherapistLicense');
            const mainTherapistEmailInput = document.getElementById('mainTherapistEmail');
            const colorThemeSelect = document.getElementById('colorTheme');
            const fontSizeSelect = document.getElementById('fontSize');
            
            if (centerNameInput) centerNameInput.value = "Polideportivo";
            if (centerAddressInput) centerAddressInput.value = "";
            if (centerPhoneInput) centerPhoneInput.value = "";
            if (mainTherapistNameInput) mainTherapistNameInput.value = "Nicolás Ayelef";
            if (mainTherapistLicenseInput) mainTherapistLicenseInput.value = "";
            if (mainTherapistEmailInput) mainTherapistEmailInput.value = "";
            if (colorThemeSelect) colorThemeSelect.value = "blue";
            if (fontSizeSelect) fontSizeSelect.value = "medium";
            
            // Aplicar tema predeterminado
            applyColorTheme("blue");
            applyFontSize("medium");
            
            showToast("Configuración restaurada a valores predeterminados", "success");
        }
    } catch (error) {
        console.error("Error al restaurar configuración:", error);
        showToast("Error al restaurar configuración", "error");
    }
}

// Aplicar tema de colores
function applyColorTheme(theme) {
    const root = document.documentElement;
    
    // Definir colores según el tema seleccionado
    switch (theme) {
        case 'green':
            root.style.setProperty('--primary', '#4CAF50');
            root.style.setProperty('--primary-light', '#81C784');
            root.style.setProperty('--primary-dark', '#2E7D32');
            break;
        case 'purple':
            root.style.setProperty('--primary', '#673AB7');
            root.style.setProperty('--primary-light', '#9575CD');
            root.style.setProperty('--primary-dark', '#4527A0');
            break;
        case 'orange':
            root.style.setProperty('--primary', '#FF9800');
            root.style.setProperty('--primary-light', '#FFB74D');
            root.style.setProperty('--primary-dark', '#EF6C00');
            break;
        case 'blue':
        default:
            root.style.setProperty('--primary', '#1E88E5');
            root.style.setProperty('--primary-light', '#64B5F6');
            root.style.setProperty('--primary-dark', '#1565C0');
            break;
    }
}

// Aplicar tamaño de fuente
function applyFontSize(size) {
    const root = document.documentElement;
    
    switch (size) {
        case 'small':
            root.style.fontSize = '14px';
            break;
        case 'large':
            root.style.fontSize = '18px';
            break;
        case 'medium':
        default:
            root.style.fontSize = '16px';
            break;
    }
}

        // Inicializar selector de pacientes mejorado
function initPatientSelector(patients) {
    const patientSelector = document.getElementById('patientSelector');
    const patientSelectorHeader = document.getElementById('patientSelectorHeader');
    const patientSelectorDropdown = document.getElementById('patientSelectorDropdown');
    const patientSelectorList = document.getElementById('patientSelectorList');
    const patientSelectorSearchInput = document.getElementById('patientSelectorSearchInput');
    
    if (!patientSelector || !patientSelectorHeader || !patientSelectorDropdown || !patientSelectorList) {
        return;
    }
    
    // Llenar lista de pacientes
    renderPatientSelectorList(patients);
    
    // Toggle dropdown al hacer clic en el header
    patientSelectorHeader.addEventListener('click', function() {
        patientSelectorDropdown.classList.toggle('show');
    });
    
    // Cerrar dropdown al hacer clic fuera
    document.addEventListener('click', function(event) {
        if (!patientSelector.contains(event.target)) {
            patientSelectorDropdown.classList.remove('show');
        }
    });
    
    // Filtrar pacientes al escribir
    if (patientSelectorSearchInput) {
        patientSelectorSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            const filteredPatients = patients.filter(patient => 
                (patient.name && patient.name.toLowerCase().includes(searchTerm)) || 
                (patient.rut && patient.rut.toLowerCase().includes(searchTerm))
            );
            renderPatientSelectorList(filteredPatients);
        });
    }
}

// Función para renderizar la lista de pacientes en el selector
function renderPatientSelectorList(patientsList) {
    const patientSelectorList = document.getElementById('patientSelectorList');
    if (!patientSelectorList) return;
    
    patientSelectorList.innerHTML = '';
    
    if (patientsList.length === 0) {
        patientSelectorList.innerHTML = '<div style="padding: 15px; text-align: center; color: var(--text-secondary);">No se encontraron pacientes</div>';
        return;
    }
    
    patientsList.forEach(patient => {
        const initials = getInitials(patient.name);
        const patientItem = document.createElement('div');
        patientItem.className = 'patient-selector-item';
        patientItem.dataset.id = patient.id;
        
        patientItem.innerHTML = `
            <div class="patient-selector-avatar">${initials}</div>
            <div class="patient-selector-info">
                <div class="patient-selector-name">${patient.name}</div>
                <div class="patient-selector-rut">${patient.rut}</div>
            </div>
        `;
        
        patientItem.addEventListener('click', function() {
            selectPatient(patient.id);
        });
        
        patientSelectorList.appendChild(patientItem);
    });
}

// Setup scales controls
function setupScalesControls() {
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
function addPsfsActivity() {
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

// Configurar la tabla de ejercicios
function setupExerciseTable() {
    const addExerciseBtn = document.getElementById('addExerciseBtn');
    if (addExerciseBtn) {
        // Eliminar manejadores previos
        const newAddExerciseBtn = addExerciseBtn.cloneNode(true);
        addExerciseBtn.parentNode.replaceChild(newAddExerciseBtn, addExerciseBtn);
        
        newAddExerciseBtn.addEventListener('click', function() {
            addExerciseRow();
        });
    }

    // Configurar plantillas de ejercicios
    const templateBtns = document.querySelectorAll('.template-btn');
    if (templateBtns.length > 0) {
        templateBtns.forEach(btn => {
            // Eliminar manejadores previos
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function() {
                const template = this.getAttribute('data-template');
                if (template) {
                    loadExerciseTemplate(template);
                }
                
                const templateId = this.getAttribute('data-template-id');
                if (templateId) {
                    loadCustomTemplate(templateId);
                }
            });
        });
    }
}

// Función mejorada para añadir una fila de ejercicio con tooltips
function addExerciseRow(exercise = {}) {
    // Obtener la tabla de ejercicios
    const tableBody = document.getElementById('exerciseTableBody');
    if (!tableBody) {
        console.error("No se encontró la tabla de ejercicios");
        return;
    }
    
    // Crear una nueva fila
    const row = document.createElement('tr');
    
    // Información para tooltips
    const tooltips = {
        rpe: "RPE (Rating of Perceived Exertion): Escala de 0-10 que indica qué tan duro fue el ejercicio. 1 = muy fácil, 10 = máximo esfuerzo posible.",
        rir: "RIR (Repeticiones en Reserva): Número de repeticiones que podrías haber hecho pero no hiciste. RIR 2 significa que podrías haber hecho 2 reps más."
    };
    
    // Definir el HTML de la fila con todos los campos y tooltips
    row.innerHTML = `
        <td>
            <input type="text" class="form-control" placeholder="Nombre" 
                   value="${exercise.name || ''}" style="width: 100%;">
        </td>
        <td>
            <select class="form-control" style="width: 100%;">
                <option value="" ${!exercise.implement ? 'selected' : ''}>Ninguno</option>
                <option value="Mancuernas" ${exercise.implement === 'Mancuernas' ? 'selected' : ''}>Mancuernas</option>
                <option value="Bandas" ${exercise.implement === 'Bandas' ? 'selected' : ''}>Bandas</option>
                <option value="Máquina" ${exercise.implement === 'Máquina' ? 'selected' : ''}>Máquina</option>
                <option value="Peso corporal" ${exercise.implement === 'Peso corporal' ? 'selected' : ''}>Peso corporal</option>
                <option value="Otros" ${exercise.implement === 'Otros' ? 'selected' : ''}>Otros</option>
            </select>
        </td>
        <td>
            <input type="number" class="form-control" placeholder="Series" min="1" 
                   value="${exercise.sets || '3'}" style="width: 100%; text-align: center;">
        </td>
        <td>
            <input type="text" class="form-control" placeholder="Reps" 
                   value="${exercise.reps || '10'}" style="width: 100%; text-align: center;">
        </td>
        <td>
            <input type="number" class="form-control" placeholder="kg" min="0" step="0.5"
                   value="${exercise.load || ''}" style="width: 100%; text-align: center;">
        </td>
        <td>
            <div style="display: flex; align-items: center; gap: 5px; position: relative;">
                <select class="form-control effort-type-select" style="flex: 1;">
                    <option value="RPE" ${(exercise.effortType === 'RPE' || !exercise.effortType) ? 'selected' : ''}>RPE</option>
                    <option value="RIR" ${exercise.effortType === 'RIR' ? 'selected' : ''}>RIR</option>
                </select>
                <input type="number" class="form-control" min="0" max="10" step="1"
                       value="${exercise.effortValue || ''}" style="flex: 1; text-align: center;">
                <div class="tooltip-container" style="position: absolute; right: -20px; top: 50%; transform: translateY(-50%);">
                    <i class="fas fa-info-circle tooltip-icon"></i>
                    <div class="tooltip-content" style="width: 250px; right: 0; left: auto; transform: none;">
                        <p><strong>RPE:</strong> Rating of Perceived Exertion (0-10)</p>
                        <p>Escala de percepción del esfuerzo donde:</p>
                        <p>1-3 = Muy fácil</p>
                        <p>4-6 = Moderado</p>
                        <p>7-8 = Difícil</p>
                        <p>9-10 = Máximo esfuerzo</p>
                        <hr style="border-color: rgba(255,255,255,0.2); margin: 5px 0;">
                        <p><strong>RIR:</strong> Repeticiones en Reserva</p>
                        <p>Cuántas repeticiones más podría hacer:</p>
                        <p>0 = No podría hacer más (fallo)</p>
                        <p>1-2 = Cercano al fallo</p>
                        <p>3-4 = Moderadamente difícil</p>
                        <p>5+ = Fácil</p>
                    </div>
                </div>
            </div>
        </td>
        <td>
            <input type="text" class="form-control" placeholder="Notas" 
                   value="${exercise.notes || ''}" style="width: 100%;">
        </td>
        <td style="text-align: center;">
            <button type="button" class="exercise-delete-btn">
                <i class="fas fa-trash-alt"></i>
            </button>
        </td>
    `;
    
    // Añadir tooltip dinámico que cambia según el tipo de esfuerzo seleccionado
    const effortTypeSelect = row.querySelector('.effort-type-select');
    if (effortTypeSelect) {
        effortTypeSelect.addEventListener('change', function() {
            const tooltipIcon = row.querySelector('.tooltip-icon');
            if (tooltipIcon) {
                const tooltipContent = tooltipIcon.nextElementSibling;
                if (tooltipContent) {
                    if (this.value === 'RPE') {
                        tooltipContent.innerHTML = `
                            <p><strong>RPE:</strong> Rating of Perceived Exertion (0-10)</p>
                            <p>Escala de percepción del esfuerzo donde:</p>
                            <p>1-3 = Muy fácil</p>
                            <p>4-6 = Moderado</p>
                            <p>7-8 = Difícil</p>
                            <p>9-10 = Máximo esfuerzo</p>
                            <hr style="border-color: rgba(255,255,255,0.2); margin: 5px 0;">
                            <p><strong>RIR:</strong> Repeticiones en Reserva</p>
                            <p>Cuántas repeticiones más podría hacer</p>
                        `;
                    } else {
                        tooltipContent.innerHTML = `
                            <p><strong>RIR:</strong> Repeticiones en Reserva</p>
                            <p>Cuántas repeticiones más podría hacer:</p>
                            <p>0 = No podría hacer más (fallo)</p>
                            <p>1-2 = Cercano al fallo</p>
                            <p>3-4 = Moderadamente difícil</p>
                            <p>5+ = Fácil</p>
                            <hr style="border-color: rgba(255,255,255,0.2); margin: 5px 0;">
                            <p><strong>RPE:</strong> Rating of Perceived Exertion</p>
                            <p>Escala de percepción del esfuerzo (0-10)</p>
                        `;
                    }
                }
            }
        });
    }
    
    // Añadir evento para eliminar ejercicio
    const deleteBtn = row.querySelector('.exercise-delete-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            tableBody.removeChild(row);
        });
    }
    
    // Añadir la fila a la tabla
    tableBody.appendChild(row);
    
    // Mostrar mensaje de confirmación
    console.log("Ejercicio añadido a la tabla");
}

// Función para cargar plantilla de ejercicios
function loadExerciseTemplate(template) {
    // Limpiar tabla actual
    const tableBody = document.getElementById('exerciseTableBody');
    if (!tableBody) return;
    
    // Confirmar antes de reemplazar ejercicios existentes
    if (tableBody.children.length > 0) {
        if (!confirm('¿Desea reemplazar los ejercicios actuales con la plantilla seleccionada?')) {
            return;
        }
        tableBody.innerHTML = '';
    }
    
    // Plantillas predefinidas actualizadas con los nuevos campos
    const templates = {
        mmss: [
            { name: 'Elevaciones laterales', implement: 'Mancuernas', sets: 3, reps: '12', load: '2', effortType: 'RPE', effortValue: '7', notes: 'Movimiento controlado' },
            { name: 'Curl de bíceps', implement: 'Bandas', sets: 3, reps: '10', load: '', effortType: 'RIR', effortValue: '2', notes: 'Extensión completa' },
            { name: 'Press de hombro', implement: 'Mancuernas', sets: 3, reps: '12', load: '4', effortType: 'RPE', effortValue: '8', notes: 'No bloquear codos' }
        ],
        mmii: [
            { name: 'Sentadillas', implement: 'Peso corporal', sets: 3, reps: '15', load: '', effortType: 'RPE', effortValue: '6', notes: 'Rodillas no sobrepasan punta de pies' },
            { name: 'Estocadas frontales', implement: 'Mancuernas', sets: 3, reps: '10', load: '3', effortType: 'RIR', effortValue: '3', notes: 'Alternar piernas' },
            { name: 'Elevación de talones', implement: 'Peso corporal', sets: 3, reps: '20', load: '', effortType: 'RPE', effortValue: '5', notes: 'Mantener piernas extendidas' }
        ],
        core: [
            { name: 'Plancha frontal', implement: 'Peso corporal', sets: 3, reps: '30 seg', load: '', effortType: 'RPE', effortValue: '7', notes: 'Mantener posición neutra columna' },
            { name: 'Crunch abdominal', implement: 'Peso corporal', sets: 3, reps: '15', load: '', effortType: 'RIR', effortValue: '2', notes: 'Movimiento controlado' },
            { name: 'Puente glúteo', implement: 'Peso corporal', sets: 3, reps: '12', load: '', effortType: 'RPE', effortValue: '6', notes: 'Apretar glúteos al subir' }
        ],
        estiramiento: [
            { name: 'Estiramiento de isquiotibiales', implement: 'Ninguno', sets: 2, reps: '30 seg', load: '', effortType: 'RPE', effortValue: '3', notes: 'No rebotar' },
            { name: 'Estiramiento de cuádriceps', implement: 'Ninguno', sets: 2, reps: '30 seg', load: '', effortType: 'RPE', effortValue: '3', notes: 'Mantener cadera alineada' },
            { name: 'Estiramiento de pectorales', implement: 'Ninguno', sets: 2, reps: '30 seg', load: '', effortType: 'RPE', effortValue: '3', notes: 'Sentir tensión sin dolor' }
        ]
    };
    
    // Cargar la plantilla seleccionada
    if (templates[template]) {
        templates[template].forEach(exercise => {
            addExerciseRow(exercise);
        });
        showToast(`Plantilla de ${getTemplateName(template)} cargada`, 'success');
    } else {
        showToast('Plantilla no encontrada', 'error');
    }
}

// Obtener nombre de plantilla
function getTemplateName(template) {
    switch(template) {
        case 'mmss': return 'miembros superiores';
        case 'mmii': return 'miembros inferiores';
        case 'core': return 'core';
        case 'estiramiento': return 'estiramientos';
        default: return template;
    }
}

// Recopilar datos de ejercicios para guardar
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

// Recopilar datos de PSFS para guardar
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

// Sistema de plantillas de ejercicios personalizadas

// Cargar plantillas personalizadas desde localStorage
function loadCustomTemplates() {
    try {
        const savedTemplates = localStorage.getItem('exerciseTemplates');
        if (savedTemplates) {
            customTemplates = JSON.parse(savedTemplates);
            
            // Renderizar botones para plantillas personalizadas
            renderCustomTemplateButtons();
            
            // Renderizar lista en el modal
            renderSavedTemplatesList();
        }
    } catch (error) {
        console.error("Error cargando plantillas personalizadas:", error);
        showToast("Error al cargar plantillas guardadas", "error");
    }
}

// Guardar plantillas personalizadas en localStorage
function saveCustomTemplates() {
    try {
        localStorage.setItem('exerciseTemplates', JSON.stringify(customTemplates));
        
        // Actualizar interfaz
        renderCustomTemplateButtons();
        renderSavedTemplatesList();
        
        showToast("Plantillas guardadas correctamente", "success");
    } catch (error) {
        console.error("Error guardando plantillas personalizadas:", error);
        showToast("Error al guardar plantillas", "error");
    }
}

