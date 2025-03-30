// navigation.js - Sistema de navegación y cambio de vistas

import { showToast } from './utils.js';
import { getPatients } from './data-services.js';
import { renderPatients, renderPatientsInView } from './ui-patients.js';
import { initPatientSelector, showNewEvolutionModal } from './ui-evolutions.js';
import { updateReportStatistics, generatePatientReport, generateStatisticsReport } from './ui-diagnosis.js';
import { loadConfiguration, saveConfiguration, resetConfiguration, applyColorTheme } from './ui-config.js';

/**
 * Cambia entre diferentes vistas de la aplicación
 * @param {string} viewName - Nombre de la vista a mostrar
 */
export function changeView(viewName) {
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

/**
 * Configura los eventos de navegación
 */
export function setupNavigation() {
    try {
        // Mapeo de textos de menú a nombres de vistas
        const menuToView = {
            "Dashboard": "dashboard",
            "Pacientes": "pacientes",
            "Evoluciones": "evoluciones",
            "Reportes": "reportes",
            "Configuración": "configuracion"
        };
        
        // Configurar eventos para cada ítem del menú
        document.querySelectorAll('.menu-item').forEach(item => {
            item.addEventListener('click', function(e) {
                e.preventDefault();
                
                // Quitar clase active de todos los ítems
                document.querySelectorAll('.menu-item').forEach(mi => {
                    mi.classList.remove('active');
                });
                
                // Añadir clase active al ítem clicado
                this.classList.add('active');
                
                // Obtener el texto del ítem y convertirlo al nombre de vista correspondiente
                const menuText = this.querySelector('.menu-item-text')?.textContent.trim();
                const viewName = menuToView[menuText] || (menuText ? menuText.toLowerCase() : 'dashboard');
                
                console.log("Cambiando a vista:", viewName);
                changeView(viewName);
            });
        });
        
        // Manejar toggle del sidebar
        const toggleSidebarBtn = document.getElementById('toggleSidebar');
        const sidebar = document.getElementById('sidebar');
        const mainContent = document.getElementById('mainContent');
        
        if (toggleSidebarBtn && sidebar && mainContent) {
            toggleSidebarBtn.addEventListener('click', function() {
                sidebar.classList.toggle('sidebar-collapsed');
                mainContent.classList.toggle('main-content-expanded');
            });
        }
    } catch (error) {
        console.error("Error configurando navegación:", error);
        showToast("Error al configurar navegación: " + error.message, "error");
    }
}

// Exportar también para compatibilidad global
window.changeView = changeView;
window.setupNavigation = setupNavigation;
