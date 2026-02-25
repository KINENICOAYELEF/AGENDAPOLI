// ui-diagnosis.js
// Interfaz de usuario para diagnósticos

import { currentPatientId, getDiagnoses } from './data-services.js';
import { showToast, formatDate } from './utils.js';

// Initialize diagnosis tab
export function initDiagnosisTab(patientId) {
    try {
        // Cargar diagnósticos y CIF del paciente
        const diagnosisTimeline = document.getElementById('diagnosisTimeline');
        if (diagnosisTimeline) {
            diagnosisTimeline.innerHTML = '<p>Cargando diagnósticos...</p>';
            
            // Consultar diagnósticos del paciente
            getDiagnoses(patientId).then(diagnoses => {
                if (diagnoses.length === 0) {
                    diagnosisTimeline.innerHTML = `
                        <p>No hay diagnósticos registrados para este paciente.</p>
                    `;
                } else {
                    diagnosisTimeline.innerHTML = '';
                    
                    diagnoses.forEach(diagnosis => {
                        const diagnosisItem = document.createElement('div');
                        diagnosisItem.className = 'timeline-item fade-in';
                        
                        const formattedDate = formatDate(new Date(diagnosis.date));
                        
                        diagnosisItem.innerHTML = `
                            <div class="timeline-dot">
                                <i class="fas fa-file-medical"></i>
                            </div>
                            <div class="timeline-content">
                                <div class="timeline-date">Evaluación - ${formattedDate}</div>
                                <h3 class="timeline-title">${diagnosis.code || 'Sin código CIE'}</h3>
                                <p>${diagnosis.description || 'Sin descripción'}</p>
                            </div>
                        `;
                        
                        diagnosisTimeline.appendChild(diagnosisItem);
                    });
                }
            });
        }
        
        // Configurar botones solo si existen
        const addDiagnosisBtn = document.getElementById('addDiagnosisBtn');
        if (addDiagnosisBtn) {
            // Eliminar cualquier manejador previo
            const newAddDiagnosisBtn = addDiagnosisBtn.cloneNode(true);
            addDiagnosisBtn.parentNode.replaceChild(newAddDiagnosisBtn, addDiagnosisBtn);
            
            newAddDiagnosisBtn.addEventListener('click', function() {
                openDiagnosisModal(patientId);
            });
        }
        
        // Configurar componentes CIF
        setupCifCategories(patientId);
        
        // Inicializar botón de guardar diagnóstico
        const saveDiagnosisBtn = document.getElementById('saveDiagnosisBtn');
        if (saveDiagnosisBtn) {
            // Eliminar cualquier manejador previo
            const newSaveDiagnosisBtn = saveDiagnosisBtn.cloneNode(true);
            saveDiagnosisBtn.parentNode.replaceChild(newSaveDiagnosisBtn, saveDiagnosisBtn);
            
            newSaveDiagnosisBtn.addEventListener('click', function() {
                saveDiagnosisChanges(patientId);
            });
        }
        
        // Inicializar botón de añadir objetivo
        const addObjectiveBtn = document.getElementById('addObjectiveBtn');
        if (addObjectiveBtn) {
            // Eliminar cualquier manejador previo
            const newAddObjectiveBtn = addObjectiveBtn.cloneNode(true);
            addObjectiveBtn.parentNode.replaceChild(newAddObjectiveBtn, addObjectiveBtn);
            
            newAddObjectiveBtn.addEventListener('click', function() {
                openObjectiveModal(patientId);
            });
        }
        
        // Inicializar botón de añadir plan de tratamiento
        const addTreatmentPlanBtn = document.getElementById('addTreatmentPlanBtn');
        if (addTreatmentPlanBtn) {
            // Eliminar cualquier manejador previo
            const newAddTreatmentPlanBtn = addTreatmentPlanBtn.cloneNode(true);
            addTreatmentPlanBtn.parentNode.replaceChild(newAddTreatmentPlanBtn, addTreatmentPlanBtn);
            
            newAddTreatmentPlanBtn.addEventListener('click', function() {
                openTreatmentPlanModal(patientId);
            });
        }
    } catch (error) {
        console.error("Error inicializando pestaña de diagnóstico:", error);
        showToast("Error al cargar diagnósticos", "error");
    }
}

// Función mejorada para abrir el modal de diagnóstico
export function openDiagnosisModal(patientId) {
    // Crear modal de diagnóstico
    const diagnosisModal = document.createElement('div');
    diagnosisModal.className = 'modal-overlay';
    diagnosisModal.id = 'diagnosisFormModal';
    
    diagnosisModal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Nuevo diagnóstico kinesiológico</h2>
                <button class="modal-close" id="closeDiagnosisModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="diagnosisForm">
                    <div class="form-group">
                        <label class="form-label">Fecha de evaluación</label>
                        <input type="date" class="form-control" id="diagnosisDate" value="${new Date().toISOString().split('T')[0]}" required>
                    </div>
                    
                    <div class="accordion active">
                        <div class="accordion-header">
                            <span>Información médica</span>
                            <i class="fas fa-chevron-down accordion-icon"></i>
                        </div>
                        <div class="accordion-body">
                            <div class="form-group">
                                <label class="form-label">Diagnóstico médico</label>
                                <input type="text" class="form-control" id="diagnosisCIE" placeholder="Ej: Lumbago, Cervicalgia, Tendinitis, etc." required>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Motivo de consulta</label>
                                <textarea class="form-control" id="consultReason" rows="2" placeholder="Descripción del motivo por el que el paciente acude a kinesiología"></textarea>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Antecedentes relevantes</label>
                                <textarea class="form-control" id="medicalBackground" rows="2" placeholder="Antecedentes médicos relevantes para el caso"></textarea>
                            </div>
                        </div>
                    </div>
                    
                    <div class="accordion active">
                        <div class="accordion-header">
                            <span>Diagnóstico kinesiológico funcional</span>
                            <i class="fas fa-chevron-down accordion-icon"></i>
                        </div>
                        <div class="accordion-body">
                            <div class="form-group">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <label class="form-label">Descripción funcional</label>
                                    <button type="button" class="btn-example" style="font-size: 13px; color: var(--primary);" id="diagnosisAssistantBtn">
                                        <i class="fas fa-magic"></i> Asistente de diagnóstico
                                    </button>
                                </div>
                                <textarea class="form-control" id="diagnosisText" rows="5" placeholder="Ingrese el diagnóstico kinesiológico detallado en términos de limitación funcional, restricción de participación y alteraciones estructurales según el modelo CIF" required></textarea>
                            </div>
                            
                            <div id="diagnosisAssistantContainer" style="display: none; background-color: var(--background-alt); padding: 15px; border-radius: 8px; margin-top: 15px;">
                                <h4 style="margin-top: 0; color: var(--primary);">Asistente de Diagnóstico Funcional</h4>
                                <p style="margin-bottom: 15px; font-size: 14px;">Seleccione las opciones que mejor describan al paciente para generar un diagnóstico funcional según el modelo CIF.</p>
                                
                                <div class="form-group">
                                    <label class="form-label">Región anatómica principal</label>
                                    <select class="form-control" id="assistantRegion">
                                        <option value="">Seleccione región...</option>
                                        <option value="cervical">Columna cervical</option>
                                        <option value="dorsal">Columna dorsal</option>
                                        <option value="lumbar">Columna lumbar</option>
                                        <option value="hombro">Hombro</option>
                                        <option value="codo">Codo</option>
                                        <option value="muñeca">Muñeca y mano</option>
                                        <option value="cadera">Cadera</option>
                                        <option value="rodilla">Rodilla</option>
                                        <option value="tobillo">Tobillo y pie</option>
                                    </select>
                                </div>
                                
                                <div class="form-row">
                                    <div class="form-col">
                                        <div class="form-group">
                                            <label class="form-label">Intensidad del dolor (EVA)</label>
                                            <select class="form-control" id="assistantPain">
                                                <option value="">Seleccione...</option>
                                                <option value="leve">Leve (1-3)</option>
                                                <option value="moderado">Moderado (4-6)</option>
                                                <option value="severo">Severo (7-10)</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div class="form-col">
                                        <div class="form-group">
                                            <label class="form-label">Tipo de dolor</label>
                                            <select class="form-control" id="assistantPainType">
                                                <option value="">Seleccione...</option>
                                                <option value="mecanico">Mecánico</option>
                                                <option value="neuropatico">Neuropático</option>
                                                <option value="inflamatorio">Inflamatorio</option>
                                                <option value="miofascial">Miofascial</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Limitaciones funcionales</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 5px;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="limitMovilidad" class="assistant-checkbox">
                                            <label for="limitMovilidad">Movilidad</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="limitFuerza" class="assistant-checkbox">
                                            <label for="limitFuerza">Fuerza</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="limitEstabilidad" class="assistant-checkbox">
                                            <label for="limitEstabilidad">Estabilidad</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="limitPropiocepcion" class="assistant-checkbox">
                                            <label for="limitPropiocepcion">Propiocepción</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="limitResistencia" class="assistant-checkbox">
                                            <label for="limitResistencia">Resistencia</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="limitEquilibrio" class="assistant-checkbox">
                                            <label for="limitEquilibrio">Equilibrio</label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Estructuras anatómicas afectadas</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 5px;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="estructuraMuscular" class="assistant-checkbox">
                                            <label for="estructuraMuscular">Muscular</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="estructuraArticular" class="assistant-checkbox">
                                            <label for="estructuraArticular">Articular</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="estructuraTendinosa" class="assistant-checkbox">
                                            <label for="estructuraTendinosa">Tendinosa</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="estructuraNervio" class="assistant-checkbox">
                                            <label for="estructuraNervio">Nerviosa</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="estructuraLigamento" class="assistant-checkbox">
                                            <label for="estructuraLigamento">Ligamentosa</label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div class="form-group">
                                    <label class="form-label">Restricciones de participación</label>
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 5px;">
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="restriccionLaboral" class="assistant-checkbox">
                                            <label for="restriccionLaboral">Laboral</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="restriccionDeportiva" class="assistant-checkbox">
                                            <label for="restriccionDeportiva">Deportiva</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="restriccionAVD" class="assistant-checkbox">
                                            <label for="restriccionAVD">Actividades cotidianas</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px;">
                                            <input type="checkbox" id="restriccionSocial" class="assistant-checkbox">
                                            <label for="restriccionSocial">Social</label>
                                        </div>
                                    </div>
                                </div>
                                
                                <div style="margin-top: 15px; display: flex; justify-content: space-between;">
                                    <button type="button" class="action-btn btn-secondary" id="cancelAssistantBtn">
                                        Cancelar
                                    </button>
                                    <button type="button" class="action-btn btn-primary" id="generateDiagnosisBtn">
                                        <i class="fas fa-magic"></i> Generar diagnóstico
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 20px; text-align: right;">
                        <button type="button" class="action-btn btn-secondary" style="margin-right: 10px;" id="cancelDiagnosisBtn">Cancelar</button>
                        <button type="submit" class="action-btn btn-primary">Guardar diagnóstico</button>
                    </div>
                </form>
            </div>
        </div>
    `;
    
    document.body.appendChild(diagnosisModal);
    setTimeout(() => diagnosisModal.classList.add('active'), 50);
    
    // Eventos para los acordeones
    diagnosisModal.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function() {
            this.parentElement.classList.toggle('active');
        });
    });
    
    // Eventos para el modal
    document.getElementById('closeDiagnosisModal').addEventListener('click', function() {
        diagnosisModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(diagnosisModal), 300);
    });
    
    document.getElementById('cancelDiagnosisBtn').addEventListener('click', function() {
        diagnosisModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(diagnosisModal), 300);
    });
    
    // Evento para mostrar/ocultar el asistente de diagnóstico
    document.getElementById('diagnosisAssistantBtn').addEventListener('click', function() {
        const container = document.getElementById('diagnosisAssistantContainer');
        if (container) {
            container.style.display = container.style.display === 'none' ? 'block' : 'none';
        }
    });
    
    // Evento para cancelar el asistente
    document.getElementById('cancelAssistantBtn').addEventListener('click', function() {
        document.getElementById('diagnosisAssistantContainer').style.display = 'none';
    });
    
    // Evento para generar diagnóstico con el asistente
    document.getElementById('generateDiagnosisBtn').addEventListener('click', function() {
        generateFunctionalDiagnosis();
    });
    
    // Evento para el envío del formulario
    document.getElementById('diagnosisForm').addEventListener('submit', function(e) {
        e.preventDefault();

        // Obtener datos del formulario
        const diagnosisDate = document.getElementById('diagnosisDate').value;
        const diagnosisCIE = document.getElementById('diagnosisCIE').value;
        const diagnosisText = document.getElementById('diagnosisText').value;
        const consultReason = document.getElementById('consultReason')?.value || '';
        const medicalBackground = document.getElementById('medicalBackground')?.value || '';

        // Crear objeto de diagnóstico
        const diagnosisData = {
            date: diagnosisDate,
            code: diagnosisCIE,
            description: diagnosisText,
            consultReason: consultReason,
            medicalBackground: medicalBackground,
            createdAt: new Date().toISOString()
        };

        // Mostrar loading mientras se guarda
        showLoading();

        try {
            // Importar funciones necesarias para Firebase
            import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js").then(({ collection, addDoc }) => {
                // Guardar en Firebase - Colección de diagnósticos dentro del paciente
                const diagnosisRef = collection(db, "patients", patientId, "diagnoses");
                addDoc(diagnosisRef, diagnosisData)
                    .then(docRef => {
                        hideLoading();
                        
                        // Añadir diagnóstico a la línea de tiempo (interfaz visual)
                        const diagnosisTimeline = document.getElementById('diagnosisTimeline');
                        if (diagnosisTimeline) {
                            // Remover mensaje "no hay diagnósticos"
                            const noDataMessage = diagnosisTimeline.querySelector('p');
                            if (noDataMessage) {
                                diagnosisTimeline.removeChild(noDataMessage);
                            }
                            
                            const newDiagnosis = document.createElement('div');
                            newDiagnosis.className = 'timeline-item fade-in';
                            newDiagnosis.innerHTML = `
                                <div class="timeline-dot">
                                    <i class="fas fa-file-medical"></i>
                                </div>
                                <div class="timeline-content">
                                    <div class="timeline-date">Evaluación - ${formatDate(new Date(diagnosisDate))}</div>
                                    <h3 class="timeline-title">${diagnosisCIE}</h3>
                                    <p>${diagnosisText}</p>
                                    ${consultReason ? `<div style="margin-top: 10px;"><strong>Motivo de consulta:</strong> ${consultReason}</div>` : ''}
                                    ${medicalBackground ? `<div style="margin-top: 5px;"><strong>Antecedentes:</strong> ${medicalBackground}</div>` : ''}
                                </div>
                            `;
                            
                            // Añadir al inicio de la lista para que aparezca primero
                            if (diagnosisTimeline.firstChild) {
                                diagnosisTimeline.insertBefore(newDiagnosis, diagnosisTimeline.firstChild);
                            } else {
                                diagnosisTimeline.appendChild(newDiagnosis);
                            }
                        }
                        
                        // Mostrar mensaje de éxito
                        showToast("Diagnóstico guardado correctamente", "success");
                        
                        // Cerrar modal - Versión mejorada para evitar el error
                        try {
                            diagnosisModal.classList.remove('active');
                            setTimeout(() => {
                                if (document.body.contains(diagnosisModal)) {
                                    document.body.removeChild(diagnosisModal);
                                }
                            }, 300);
                        } catch (error) {
                            console.error("Error al cerrar modal:", error);
                            // En caso de error, intentar ocultar el modal
                            diagnosisModal.style.display = 'none';
                        }
                    })
                    .catch(error => {
                        hideLoading();
                        console.error("Error al guardar diagnóstico:", error);
                        showToast("Error al guardar diagnóstico: " + error.message, "error");
                    });
            }).catch(error => {
                hideLoading();
                console.error("Error al importar funciones Firebase:", error);
                showToast("Error al guardar diagnóstico: " + error.message, "error");
            });
        } catch (error) {
            hideLoading();
            console.error("Error al guardar diagnóstico:", error);
            showToast("Error al guardar diagnóstico: " + error.message, "error");
        }
    });
}

// Función para generar diagnóstico funcional basado en las selecciones del asistente
export function generateFunctionalDiagnosis() {
    // Obtener valores seleccionados
    const region = document.getElementById('assistantRegion').value;
    const painIntensity = document.getElementById('assistantPain').value;
    const painType = document.getElementById('assistantPainType').value;
    
    // Obtener limitaciones funcionales seleccionadas
    const limitations = [];
    document.querySelectorAll('[id^="limit"]:checked').forEach(el => {
        limitations.push(el.id.replace('limit', '').toLowerCase());
    });
    
    // Obtener estructuras afectadas seleccionadas
    const structures = [];
    document.querySelectorAll('[id^="estructura"]:checked').forEach(el => {
        structures.push(el.id.replace('estructura', '').toLowerCase());
    });
    
    // Obtener restricciones de participación seleccionadas
    const restrictions = [];
    document.querySelectorAll('[id^="restriccion"]:checked').forEach(el => {
        restrictions.push(el.id.replace('restriccion', '').toLowerCase());
    });
    
    // Verificar que se hayan seleccionado los campos mínimos necesarios
    if (!region) {
        showToast("Debe seleccionar la región anatómica", "error");
        return;
    }
    
    if (!painIntensity) {
        showToast("Debe seleccionar la intensidad del dolor", "error");
        return;
    }
    
    if (limitations.length === 0) {
        showToast("Debe seleccionar al menos una limitación funcional", "error");
        return;
    }
    
    if (structures.length === 0) {
        showToast("Debe seleccionar al menos una estructura afectada", "error");
        return;
    }
    
    // Mapeo de valores para el texto
    const regionMap = {
        'cervical': 'región cervical',
        'dorsal': 'región dorsal',
        'lumbar': 'región lumbar',
        'hombro': 'articulación del hombro',
        'codo': 'articulación del codo',
        'muñeca': 'articulación de la muñeca y mano',
        'cadera': 'articulación de la cadera',
        'rodilla': 'articulación de la rodilla',
        'tobillo': 'complejo articular del tobillo y pie'
    };
    
    const painMap = {
        'leve': 'de intensidad leve (EVA 1-3/10)',
        'moderado': 'de intensidad moderada (EVA 4-6/10)',
        'severo': 'de intensidad severa (EVA 7-10/10)'
    };
    
    const painTypeMap = {
        'mecanico': 'de características mecánicas',
        'neuropatico': 'de características neuropáticas',
        'inflamatorio': 'de características inflamatorias',
        'miofascial': 'de origen miofascial'
    };
    
    // Mapeo de limitaciones
    const limitationDescriptions = {
        'movilidad': 'rango de movimiento articular',
        'fuerza': 'fuerza muscular',
        'estabilidad': 'estabilidad articular',
        'propiocepcion': 'propiocepción',
        'resistencia': 'resistencia muscular',
        'equilibrio': 'equilibrio'
    };
    
    // Mapeo de estructuras
    const structureDescriptions = {
        'muscular': 'musculatura',
        'articular': 'componentes articulares',
        'tendinosa': 'estructuras tendinosas',
        'nervio': 'tejido nervioso',
        'ligamento': 'estructuras ligamentosas'
    };
    
    // Mapeo de restricciones
    const restrictionDescriptions = {
        'laboral': 'actividades laborales',
        'deportiva': 'actividades deportivas',
        'avd': 'actividades de la vida diaria',
        'social': 'participación social'
    };
    
    // Construir el diagnóstico
    let diagnosis = `Paciente presenta disfunción ${regionMap[region] || region} con dolor ${painMap[painIntensity] || painIntensity}`;
    
    // Añadir tipo de dolor si está seleccionado
    if (painType) {
        diagnosis += ` ${painTypeMap[painType] || painType}`;
    }
    
    // Añadir estructuras afectadas
    if (structures.length > 0) {
        diagnosis += `, asociado a compromiso de `;
        const structureTexts = structures.map(s => structureDescriptions[s] || s);
        
        if (structureTexts.length === 1) {
            diagnosis += structureTexts[0];
        } else if (structureTexts.length === 2) {
            diagnosis += `${structureTexts[0]} y ${structureTexts[1]}`;
        } else {
            const lastStructure = structureTexts.pop();
            diagnosis += `${structureTexts.join(', ')} y ${lastStructure}`;
        }
    }
    
    // Añadir limitaciones funcionales
    if (limitations.length > 0) {
        diagnosis += `. Se evidencia alteración en `;
        const limitationTexts = limitations.map(l => limitationDescriptions[l] || l);
        
        if (limitationTexts.length === 1) {
            diagnosis += limitationTexts[0];
        } else if (limitationTexts.length === 2) {
            diagnosis += `${limitationTexts[0]} y ${limitationTexts[1]}`;
        } else {
            const lastLimitation = limitationTexts.pop();
            diagnosis += `${limitationTexts.join(', ')} y ${lastLimitation}`;
        }
    }
    
    // Añadir restricciones de participación
    if (restrictions.length > 0) {
        diagnosis += `, generando restricción en `;
        const restrictionTexts = restrictions.map(r => restrictionDescriptions[r] || r);
        
        if (restrictionTexts.length === 1) {
            diagnosis += restrictionTexts[0];
        } else if (restrictionTexts.length === 2) {
            diagnosis += `${restrictionTexts[0]} y ${restrictionTexts[1]}`;
        } else {
            const lastRestriction = restrictionTexts.pop();
            diagnosis += `${restrictionTexts.join(', ')} y ${lastRestriction}`;
        }
    }
    
    diagnosis += '.';
    
    // Añadir recomendación basada en CIF
    diagnosis += ` Según la Clasificación Internacional del Funcionamiento (CIF), presenta alteraciones en funciones corporales (b) y estructuras (s) que afectan su capacidad en actividades y participación (d).`;
    
    // Establecer el diagnóstico en el campo de texto
    const diagnosisTextElement = document.getElementById('diagnosisText');
    if (diagnosisTextElement) {
        diagnosisTextElement.value = diagnosis;
    }
    
    // Ocultar el asistente
    document.getElementById('diagnosisAssistantContainer').style.display = 'none';
    
    // Mostrar mensaje
    showToast("Diagnóstico generado correctamente", "success");
}

// Configurar categorías CIF
export function setupCifCategories(patientId) {
    // Implementar selección básica de códigos CIF para cada categoría
    setupCifCategory('addCifFunctionBtn', 'cifFunctions', 'Función', getCifFunctions(patientId));
    setupCifCategory('addCifStructureBtn', 'cifStructures', 'Estructura', getCifStructures(patientId));
    setupCifCategory('addCifActivityBtn', 'cifActivities', 'Actividad', getCifActivities(patientId));
    setupCifCategory('addCifFactorBtn', 'cifFactors', 'Factor', getCifFactors(patientId));
    
    // Cargar factores personales
    loadPersonalFactors(patientId);
}

// Configurar una categoría CIF específica
export function setupCifCategory(buttonId, containerId, categoryType, items) {
    const addBtn = document.getElementById(buttonId);
    const container = document.getElementById(containerId);
    
    if (addBtn && container) {
        // Mostrar elementos existentes
        renderCifItems(container, items);
        
        // Eliminar manejadores existentes
        const newAddBtn = addBtn.cloneNode(true);
        addBtn.parentNode.replaceChild(newAddBtn, addBtn);
        
        // Implementar funcionalidad del botón para añadir nuevos elementos
        newAddBtn.addEventListener('click', function() {
            showCifSelectorModal(categoryType, containerId, currentPatientId);
        });
    }
}

// Renderizar elementos CIF
export function renderCifItems(container, items) {
    container.innerHTML = '';
    
    if (items.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No hay elementos registrados.</p>';
        return;
    }
    
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cif-item';
        itemElement.dataset.id = item.id;
        
        itemElement.innerHTML = `
            <div class="cif-code">
                ${item.code}: ${item.name}
                <button class="scale-value active">${item.value}</button>
            </div>
            <div class="cif-desc">${item.description}</div>
            <div class="cif-scale">
                Escala:
                <div class="scale-values">
                    <button class="scale-value ${item.value === 0 ? 'active' : ''}">0</button>
                    <button class="scale-value ${item.value === 1 ? 'active' : ''}">1</button>
                    <button class="scale-value ${item.value === 2 ? 'active' : ''}">2</button>
                    <button class="scale-value ${item.value === 3 ? 'active' : ''}">3</button>
                    <button class="scale-value ${item.value === 4 ? 'active' : ''}">4</button>
                </div>
            </div>
        `;
        
        // Añadir interactividad a los botones de escala
        itemElement.querySelectorAll('.scale-value').forEach(button => {
            button.addEventListener('click', function() {
                // Desactivar otros botones del mismo grupo
                const scaleValues = this.closest('.scale-values');
                if (scaleValues) {
                    scaleValues.querySelectorAll('.scale-value').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    // Actualizar valor en el título
                    const cifCode = this.closest('.cif-item').querySelector('.cif-code');
                    const valueBtn = cifCode.querySelector('.scale-value');
                    valueBtn.textContent = this.textContent;
                    
                    // Actualizar datos en memoria (no se guarda hasta hacer clic en "Guardar cambios")
                    // En una implementación real, esto actualizaría un objeto en memoria
                }
            });
        });
        
        container.appendChild(itemElement);
    });
}

// Obtener funciones CIF del paciente
export function getCifFunctions(patientId) {
    // En una implementación real, esto obtendría datos de Firebase
    // Por ahora, devolvemos datos de ejemplo
    return [
        { id: 'f1', code: "b280", name: "Sensación de dolor", description: "Sensaciones desagradables que indican daño potencial o real en alguna estructura corporal.", value: 2 },
        { id: 'f2', code: "b730", name: "Funciones de fuerza muscular", description: "Funciones relacionadas con la fuerza generada por la contracción de un músculo o grupo de músculos.", value: 1 }
    ];
}

// Obtener estructuras CIF del paciente
export function getCifStructures(patientId) {
    return [
        { id: 's1', code: "s750", name: "Estructura extremidad inferior", description: "Estructura de la pierna y el pie.", value: 1 }
    ];
}

// Obtener actividades CIF del paciente
export function getCifActivities(patientId) {
    return [
        { id: 'a1', code: "d450", name: "Caminar", description: "Andar sobre una superficie a pie, paso a paso.", value: 2 }
    ];
}

// Obtener factores CIF del paciente
export function getCifFactors(patientId) {
    return [
        { id: 'e1', code: "e110", name: "Productos para consumo personal", description: "Cualquier sustancia natural o fabricada por el hombre, recogida, procesada o manufacturada para la ingesta.", value: 1 }
    ];
}

// Cargar factores personales
export function loadPersonalFactors(patientId) {
    // En una implementación real, esto obtendría datos de Firebase
    const cifPersonalFactors = document.getElementById('cifPersonalFactors');
    if (cifPersonalFactors) {
        cifPersonalFactors.value = "Paciente de 35 años, deportista amateur, trabaja en oficina con postura sedentaria prolongada.";
    }
}

// Mostrar selector de CIF
export function showCifSelectorModal(categoryType, targetContainerId, patientId) {
    // Reconfigurar el modal existente
    const cifModal = document.getElementById('cifSelectorModal');
    
    if (!cifModal) {
        console.error("Modal de selector CIF no encontrado");
        return;
    }
    
    // Actualizar título
    const modalTitle = cifModal.querySelector('.modal-title');
    if (modalTitle) {
        modalTitle.textContent = `Seleccionar código CIF - ${categoryType}`;
    }
    
    // Mostrar modal
    cifModal.style.display = 'block';
    setTimeout(() => cifModal.classList.add('active'), 50);
    
    // Configurar campo de búsqueda
    const searchInput = document.getElementById('cifSearchInput');
    if (searchInput) {
        searchInput.value = '';
        searchInput.placeholder = `Buscar código CIF ${categoryType.toLowerCase()}...`;
        
        // Limpiar resultados anteriores
        const resultsContainer = document.getElementById('cifSearchResults');
        if (resultsContainer) {
            resultsContainer.innerHTML = '';
        }
        
        // Eliminar manejadores previos
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);
        
        // Configurar evento de búsqueda
        newSearchInput.addEventListener('input', function() {
            const searchTerm = this.value.toLowerCase();
            if (searchTerm.length < 2) {
                const resultsContainer = document.getElementById('cifSearchResults');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                }
                return;
            }
            
            // Obtener datos de ejemplo según categoría
            let cifCodes = [];
            switch(categoryType) {
                case 'Función':
                    cifCodes = [
                        { code: 'b280', name: 'Sensación de dolor', desc: 'Sensaciones desagradables que indican daño potencial o real en alguna estructura corporal.' },
                        { code: 'b710', name: 'Funciones de movilidad articular', desc: 'Funciones relacionadas con el rango y facilidad de movimiento de una articulación.' },
                        { code: 'b730', name: 'Funciones de fuerza muscular', desc: 'Funciones relacionadas con la fuerza generada por la contracción de un músculo o grupo de músculos.' },
                        { code: 'b740', name: 'Funciones de resistencia muscular', desc: 'Funciones relacionadas con el mantenimiento de la contracción muscular durante un período de tiempo determinado.' }
                    ];
                    break;
                case 'Estructura':
                    cifCodes = [
                        { code: 's750', name: 'Estructura extremidad inferior', desc: 'Estructura de la pierna y el pie.' },
                        { code: 's760', name: 'Estructura del tronco', desc: 'Estructura del tronco, espalda, incluida la pelvis.' },
                        { code: 's770', name: 'Estructuras musculoesqueléticas adicionales', desc: 'Estructuras relacionadas con el movimiento.' }
                    ];
                    break;
                case 'Actividad':
                    cifCodes = [
                        { code: 'd450', name: 'Caminar', desc: 'Andar sobre una superficie a pie, paso a paso.' },
                        { code: 'd455', name: 'Desplazarse', desc: 'Mover todo el cuerpo de un sitio a otro sin caminar.' },
                        { code: 'd430', name: 'Levantar y llevar objetos', desc: 'Levantar un objeto o llevar algo de un sitio a otro.' }
                    ];
                    break;
                case 'Factor':
                    cifCodes = [
                        { code: 'e110', name: 'Productos para consumo personal', desc: 'Cualquier sustancia natural o fabricada por el hombre para la ingesta.' },
                        { code: 'e115', name: 'Productos para uso personal', desc: 'Equipamiento, productos y tecnologías utilizados en las actividades cotidianas.' },
                        { code: 'e120', name: 'Movilidad personal', desc: 'Equipamiento, productos y tecnologías utilizados para facilitar el movimiento.' }
                    ];
                    break;
            }
            
            // Filtrar resultados
            const results = cifCodes.filter(item => 
                item.code.toLowerCase().includes(searchTerm) ||
                item.name.toLowerCase().includes(searchTerm) ||
                item.desc.toLowerCase().includes(searchTerm)
            );
            
            // Mostrar resultados
            const resultsContainer = document.getElementById('cifSearchResults');
            if (resultsContainer) {
                resultsContainer.innerHTML = '';
                if (results.length > 0) {
                    results.forEach(result => {
                        const resultItem = document.createElement('div');
                        resultItem.className = 'cif-result-item';
                        resultItem.innerHTML = `
                            <div class="cif-result-code">${result.code}: ${result.name}</div>
                            <div class="cif-result-desc">${result.desc}</div>
                        `;
                        
                        resultItem.addEventListener('click', function() {
                            // Llenar campos del formulario
                            const codeInput = document.getElementById('cifCodeInput');
                            const nameInput = document.getElementById('cifNameInput');
                            const descInput = document.getElementById('cifDescInput');
                            
                            if (codeInput) codeInput.value = result.code;
                            if (nameInput) nameInput.value = result.name;
                            if (descInput) descInput.value = result.desc;
                            
                            // Resaltar selección
                            resultsContainer.querySelectorAll('.cif-result-item').forEach(item => {
                                item.style.backgroundColor = '';
                            });
                            this.style.backgroundColor = 'rgba(30, 136, 229, 0.1)';
                        });
                        
                        resultsContainer.appendChild(resultItem);
                    });
                } else {
                    resultsContainer.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-style: italic;">No se encontraron resultados</div>';
                }
            }
        });
    }
    
    // Configurar campos de formulario
    const codeInput = document.getElementById('cifCodeInput');
    const nameInput = document.getElementById('cifNameInput');
    const descInput = document.getElementById('cifDescInput');
    const valueInput = document.getElementById('cifValueInput');
    
    if (codeInput) codeInput.value = '';
    if (nameInput) nameInput.value = '';
    if (descInput) descInput.value = '';
    if (valueInput) valueInput.value = '2';
    
    // Guardar referencias para el botón de guardar
    cifModal.setAttribute('data-target', targetContainerId);
    cifModal.setAttribute('data-category', categoryType);
    cifModal.setAttribute('data-patient', patientId);
    
    // Configurar evento para botones
    const closeModalBtn = document.getElementById('closeCifModal');
    if (closeModalBtn) {
        const newCloseBtn = closeModalBtn.cloneNode(true);
        closeModalBtn.parentNode.replaceChild(newCloseBtn, closeModalBtn);
        
        newCloseBtn.addEventListener('click', function() {
            cifModal.classList.remove('active');
            setTimeout(() => {
                cifModal.style.display = 'none';
            }, 300);
        });
    }
    
    const cancelBtn = document.getElementById('cancelCifBtn');
    if (cancelBtn) {
        const newCancelBtn = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
        
        newCancelBtn.addEventListener('click', function() {
            cifModal.classList.remove('active');
            setTimeout(() => {
                cifModal.style.display = 'none';
            }, 300);
        });
    }
    
    const saveBtn = document.getElementById('saveCifBtn');
    if (saveBtn) {
        const newSaveBtn = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
        
        newSaveBtn.addEventListener('click', function() {
            addCifItem(cifModal);
        });
    }
}

// Añadir un elemento CIF
export function addCifItem(modal){
    // Obtener datos del formulario
    const code = document.getElementById('cifCodeInput').value;
    const name = document.getElementById('cifNameInput').value;
    const description = document.getElementById('cifDescInput').value;
    const value = parseInt(document.getElementById('cifValueInput').value);
    
    if (!code || !name) {
        showToast("Código y nombre son obligatorios", "error");
        return;
    }
    
    // Obtener información del contenedor destino
    const targetContainerId = modal.getAttribute('data-target');
    const categoryType = modal.getAttribute('data-category');
    const patientId = modal.getAttribute('data-patient');
    
    const container = document.getElementById(targetContainerId);
    if (container) {
        // Generar un ID único para este elemento (en una implementación real se usaría el ID de Firebase)
        const itemId = `cif-${Date.now()}`;
        
        const newItem = document.createElement('div');
        newItem.className = 'cif-item';
        newItem.dataset.id = itemId;
        newItem.innerHTML = `
            <div class="cif-code">
                ${code}: ${name}
                <button class="scale-value active">${value}</button>
            </div>
            <div class="cif-desc">${description}</div>
            <div class="cif-scale">
                Escala:
                <div class="scale-values">
                    <button class="scale-value ${value === 0 ? 'active' : ''}">0</button>
                    <button class="scale-value ${value === 1 ? 'active' : ''}">1</button>
                    <button class="scale-value ${value === 2 ? 'active' : ''}">2</button>
                    <button class="scale-value ${value === 3 ? 'active' : ''}">3</button>
                    <button class="scale-value ${value === 4 ? 'active' : ''}">4</button>
                </div>
            </div>
        `;
        
        // Eliminar mensaje "no hay elementos" si existe
        const emptyMessage = container.querySelector('p');
        if (emptyMessage) {
            container.removeChild(emptyMessage);
        }
        
        // Añadir interactividad a los botones de escala
        newItem.querySelectorAll('.scale-value').forEach(button => {
            button.addEventListener('click', function() {
                // Desactivar otros botones del mismo grupo
                const scaleValues = this.closest('.scale-values');
                if (scaleValues) {
                    scaleValues.querySelectorAll('.scale-value').forEach(btn => {
                        btn.classList.remove('active');
                    });
                    this.classList.add('active');
                    
                    // Actualizar valor en el título
                    const cifCode = this.closest('.cif-item').querySelector('.cif-code');
                    const valueBtn = cifCode.querySelector('.scale-value');
                    valueBtn.textContent = this.textContent;
                }
            });
        });
        
        // Añadir al inicio para mayor visibilidad
        if (container.firstChild) {
            container.insertBefore(newItem, container.firstChild);
        } else {
            container.appendChild(newItem);
        }
        
        // En una implementación real, aquí se guardarían los datos en memoria
        // hasta que el usuario haga clic en "Guardar cambios"
        
        showToast(`Elemento CIF ${categoryType} añadido correctamente`, "success");
    }
    
    // Cerrar modal
    modal.classList.remove('active');
    setTimeout(() => {
        modal.style.display = 'none';
    }, 300);
}

// Guardar cambios en diagnóstico
export function saveDiagnosisChanges(patientId) {
    // En una implementación real, aquí se guardarían todos los cambios en Firebase
    
    // Obtener factores personales
    const personalFactors = document.getElementById('cifPersonalFactors')?.value || '';
    
    // Simular guardado exitoso
    showToast("Diagnóstico guardado correctamente", "success");
}

// Abrir modal de objetivo
export function openObjectiveModal(patientId) {
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
export function updateObjectiveProgressPreview(progress) {
    // En una implementación real, esto actualizaría un SVG o un elemento visual
    console.log(`Progreso actualizado a: ${progress}%`);
}

// Guardar objetivo
export function saveObjective(patientId, modal) {
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
export function openTreatmentPlanModal(patientId) {
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

// Importar las funciones necesarias
import { db } from './firebase-config.js';
import { showToast, showLoading, hideLoading, formatDate } from './utils.js';
