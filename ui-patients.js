// ui-patients.js
// Interfaz de usuario para gestión de pacientes

import { getPatient, getPatients, updatePatient, addPatient, currentPatientId, setCurrentPatientId, getEvolutions, getEvolutionsCount } from './data-services.js';
import { showToast, formatDate, calculatePatientProgress, getStatusClass, getInitials } from './utils.js';
import { fillEvolutionsTab } from './ui-evolutions.js';
import { initDiagnosisTab } from './ui-diagnosis.js';

// Render patients in the main patient list
export function renderPatients(patients) {
    const patientListContainer = document.getElementById('patientList');
    if (!patientListContainer) {
        console.log("Contenedor de lista de pacientes no encontrado");
        return;
    }
    
    // Limpiar pacientes existentes
    patientListContainer.innerHTML = '';
    
    if (patients.length === 0) {
        patientListContainer.innerHTML = `
            <div class="patient-card">
                <div class="patient-avatar">
                    <i class="fas fa-user-injured"></i>
                </div>
                <h3 class="patient-name">No hay pacientes registrados</h3>
                <div class="patient-rut">Agregue un nuevo paciente para comenzar</div>
            </div>
        `;
        return;
    }
    
    // Añadir pacientes
    patients.forEach(patient => {
        const progress = calculatePatientProgress(patient);
        const statusClass = getStatusClass(progress);
        
        const patientCard = document.createElement('div');
        patientCard.classList.add('patient-card');
        patientCard.setAttribute('data-id', patient.id);
        
        // Si este es el paciente seleccionado actualmente, añadir clase 'selected'
        if (patient.id === currentPatientId) {
            patientCard.classList.add('selected');
        }
        
        const initials = getInitials(patient.name);
        
        patientCard.innerHTML = `
            <div class="patient-status ${statusClass}"></div>
            <div class="patient-avatar">${initials}</div>
            <h3 class="patient-name">${patient.name}</h3>
            <div class="patient-rut">${patient.rut}</div>
            <div class="patient-info">
                <div>
                    <div class="patient-label">Última sesión</div>
                    <div>${patient.lastSession || 'Ninguna'}</div>
                </div>
                <div>
                    <div class="patient-label">Progreso</div>
                    <div>${progress}%</div>
                </div>
            </div>
        `;
        
        patientListContainer.appendChild(patientCard);
        
        // Añadir event listener para abrir modal de paciente
        patientCard.addEventListener('click', () => openPatientModal(patient.id));
    });
}

// Update dashboard statistics
export function updateDashboardStats(patients) {
    // Contar pacientes activos (progreso >= 50%)
    const activePatients = patients.filter(p => calculatePatientProgress(p) >= 50).length;
    const activeElement = document.getElementById('activePatients');
    if (activeElement) {
        activeElement.textContent = activePatients;
    }
    
    // Contar evoluciones mensuales
    // Por ahora usamos un estimado, en el futuro contaremos las evoluciones reales
    const monthlyElement = document.getElementById('monthlyEvolutions');
    if (monthlyElement) {
        monthlyElement.textContent = Math.floor(patients.length * 1.5);
    }
    
    // Establecer porcentaje de objetivos completados
    const objectivesElement = document.getElementById('completedObjectives');
    if (objectivesElement) {
        // Simulación: Suponemos que el 65% de los objetivos están completados
        objectivesElement.textContent = '65%';
    }
    
    // Establecer número de estudiantes activos
    const studentsElement = document.getElementById('activeStudents');
    if (studentsElement) {
        // Simulación: Suponemos que hay 12 estudiantes activos
        studentsElement.textContent = '12';
    }
}

// Renderizar pacientes en una vista específica
export function renderPatientsInView(containerId, patients) {
    try {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Contenedor ${containerId} no encontrado`);
            return;
        }
        
        // Limpiar contenedor
        container.innerHTML = '';
        
        if (patients.length === 0) {
            container.innerHTML = `
                <div class="patient-card">
                    <div class="patient-avatar">
                        <i class="fas fa-user-injured"></i>
                    </div>
                    <h3 class="patient-name">No hay pacientes registrados</h3>
                    <div class="patient-rut">Agregue un nuevo paciente para comenzar</div>
                </div>
            `;
            return;
        }
        
        // Añadir pacientes
        patients.forEach(patient => {
            const progress = calculatePatientProgress(patient);
            const statusClass = getStatusClass(progress);
            
            const patientCard = document.createElement('div');
            patientCard.classList.add('patient-card');
            patientCard.setAttribute('data-id', patient.id);
            
            // Si este es el paciente seleccionado actualmente, añadir clase 'selected'
            if (patient.id === currentPatientId) {
                patientCard.classList.add('selected');
            }
            
            const initials = getInitials(patient.name);
            
            patientCard.innerHTML = `
                <div class="patient-status ${statusClass}"></div>
                <div class="patient-avatar">${initials}</div>
                <h3 class="patient-name">${patient.name}</h3>
                <div class="patient-rut">${patient.rut}</div>
                <div class="patient-info">
                    <div>
                        <div class="patient-label">Última sesión</div>
                        <div>${patient.lastSession || 'Ninguna'}</div>
                    </div>
                    <div>
                        <div class="patient-label">Progreso</div>
                        <div>${progress}%</div>
                    </div>
                </div>
            `;
            
            container.appendChild(patientCard);
            
            // Añadir evento para seleccionar paciente
            patientCard.addEventListener('click', () => selectPatient(patient.id));
        });
    } catch (error) {
        console.error("Error renderizando pacientes en vista:", error);
        showToast("Error al mostrar pacientes: " + error.message, "error");
    }
}

// Función para manejar selección de paciente en la vista de Evoluciones
export async function selectPatient(patientId) {
    try {
        // Actualizar ID del paciente actual
        setCurrentPatientId(patientId);
        
        // Marcar visualmente el paciente seleccionado
        document.querySelectorAll('.patient-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        document.querySelectorAll(`.patient-card[data-id="${patientId}"]`).forEach(card => {
            card.classList.add('selected');
        });
        
        // Obtener datos del paciente
        const patient = await getPatient(patientId);
        if (!patient) {
            showToast("Error: Paciente no encontrado", "error");
            return;
        }
        
        // Si estamos en la vista de evoluciones, actualizar selector
        const patientSelectorHeader = document.getElementById('patientSelectorHeader');
        if (patientSelectorHeader) {
            patientSelectorHeader.innerHTML = `
                <i class="fas fa-user-injured"></i>
                <span>Paciente: ${patient.name}</span>
                <i class="fas fa-chevron-down" style="margin-left: auto;"></i>
            `;
            
            // Cerrar el dropdown si está abierto
            const dropdown = document.getElementById('patientSelectorDropdown');
            if (dropdown) {
                dropdown.classList.remove('show');
            }
            
            // Mostrar información del paciente seleccionado
            const selectedPatientInfo = document.getElementById('selectedPatientInfo');
            if (selectedPatientInfo) {
                selectedPatientInfo.style.display = 'block';
                
                // Actualizar información
                const nameElement = document.getElementById('selectedPatientName');
                if (nameElement) nameElement.textContent = patient.name;
                
                const rutElement = document.getElementById('selectedPatientRUT');
                if (rutElement) rutElement.textContent = patient.rut;
                
                const lastSessionElement = document.getElementById('selectedPatientLastSession');
                if (lastSessionElement) lastSessionElement.textContent = patient.lastSession || 'No hay sesiones registradas';
                
                // Obtener conteo de evoluciones
                const evolutionsCount = await getEvolutionsCount(patientId);
                const totalEvolutionsElement = document.getElementById('selectedPatientTotalEvolutions');
                if (totalEvolutionsElement) totalEvolutionsElement.textContent = evolutionsCount;
                
                // Calcular y mostrar progreso
                const progress = calculatePatientProgress(patient);
                const progressElement = document.getElementById('selectedPatientProgress');
                if (progressElement) progressElement.textContent = `${progress}%`;
                
                // Configurar botones
                const addEvolutionBtn = document.getElementById('addEvolutionForSelectedBtn');
                if (addEvolutionBtn) {
                    addEvolutionBtn.onclick = () => showNewEvolutionModal();
                }
                
                const viewDetailsBtn = document.getElementById('viewPatientDetailsBtn');
                if (viewDetailsBtn) {
                    viewDetailsBtn.onclick = () => openPatientModal(patientId);
                }
            }
        }
    } catch (error) {
        console.error("Error al seleccionar paciente:", error);
        showToast("Error al seleccionar paciente: " + error.message, "error");
    }
}

// Open patient modal
export async function openPatientModal(patientId) {
    try {
        // Quitar selección anterior
        document.querySelectorAll('.patient-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Añadir selección al paciente actual
        document.querySelectorAll('.patient-card[data-id="' + patientId + '"]').forEach(card => {
            card.classList.add('selected');
        });
        
        setCurrentPatientId(patientId);
        
        // Mostrar indicador en la interfaz
        const headerTitle = document.querySelector('.page-title');
        if (headerTitle) {
            const patient = await getPatient(patientId);
            const originalTitle = headerTitle.getAttribute('data-original-title') || headerTitle.textContent;
            headerTitle.setAttribute('data-original-title', originalTitle);
            headerTitle.innerHTML = `
                ${originalTitle} 
                <span class="patient-active-badge">
                    <i class="fas fa-user"></i> Paciente: ${patient ? patient.name : 'Seleccionado'}
                </span>
            `;
        }
        
        // Obtener datos del paciente
        const patient = await getPatient(patientId);
        if (!patient) return;
        
        // Actualizar título del modal
        const titleElement = document.getElementById('patientModalTitle');
        if (titleElement) {
            titleElement.textContent = patient.name;
        }
        
        // Llenar datos personales
        fillPersonalData(patient);
        
        // Obtener evoluciones
        const evolutions = await getEvolutions(patientId);
        
        // Llenar pestaña de evoluciones
        fillEvolutionsTab(evolutions);

        // Inicializar pestaña de diagnóstico
        initDiagnosisTab(patientId);
        
        // Abrir modal
        const patientModal = document.getElementById('patientModal');
        if (patientModal) {
            patientModal.classList.add('active');
        }
    } catch (error) {
        console.error("Error al abrir modal de paciente:", error);
        showToast("Error al abrir ficha del paciente: " + error.message, "error");
    }
}

// Fill personal data tab
export function fillPersonalData(patient) {
    try {
        // Establecer avatar
        const avatar = document.getElementById('patientAvatar');
        if (avatar) {
            avatar.textContent = getInitials(patient.name);
        }
        
        // Llenar campos del formulario
        const fields = {
            'patientName': patient.name || '',
            'patientRut': patient.rut || '',
            'patientBirthDate': patient.birthDate || '',
            'patientPhone': patient.phone || '',
            'patientEmail': patient.email || '',
            'patientAddress': patient.address || '',
            'patientMedicalHistory': patient.medicalHistory || '',
            'patientMedications': patient.medications || '',
            'patientAllergies': patient.allergies || '',
            'patientEmergencyContact': patient.emergencyContact || '',
            'patientEmergencyPhone': patient.emergencyPhone || ''
        };
        
        // Establecer cada campo si el elemento existe
        for (const [id, value] of Object.entries(fields)) {
            const element = document.getElementById(id);
            if (element) {
                element.value = value;
            }
        }
    } catch (error) {
        console.error("Error llenando datos personales:", error);
        showToast("Error al cargar datos personales", "error");
    }
}

// Inicializar selector de pacientes mejorado
export function initPatientSelector(patients) {
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
export function renderPatientSelectorList(patientsList) {
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

// Exportar funciones necesarias para otras partes de la aplicación
export { showNewEvolutionModal } from './ui-evolutions.js';
