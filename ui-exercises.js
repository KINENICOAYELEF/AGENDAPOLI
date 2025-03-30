// ui-exercises.js
// Interfaz de usuario para ejercicios y plantillas

import { showToast } from './utils.js';

// Variables globales para plantillas personalizadas
let customTemplates = [];

// Configurar la tabla de ejercicios
export function setupExerciseTable() {
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
export function addExerciseRow(exercise = {}) {
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
export function loadExerciseTemplate(template) {
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
export function getTemplateName(template) {
    switch(template) {
        case 'mmss': return 'miembros superiores';
        case 'mmii': return 'miembros inferiores';
        case 'core': return 'core';
        case 'estiramiento': return 'estiramientos';
        default: return template;
    }
}

// Recopilar datos de ejercicios para guardar
export function getExercisesData() {
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
export function getPsfsActivities() {
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

// Función mejorada para renderizar ejercicios en la visualización de evoluciones
export function renderExercises(exercises) {
    if (!exercises || exercises.length === 0) return '';
    
    // Información para tooltips
    const tooltips = {
        rpe: "RPE (Rating of Perceived Exertion): Escala de 0-10 que indica qué tan duro fue el ejercicio. 1 = muy fácil, 10 = máximo esfuerzo posible.",
        rir: "RIR (Repeticiones en Reserva): Número de repeticiones que podrías haber hecho pero no hiciste. RIR 2 significa que podrías haber hecho 2 reps más.",
        series: "Número de veces que se realiza el conjunto completo de repeticiones.",
        reps: "Número de movimientos completos o repeticiones por serie.",
        carga: "Peso o resistencia utilizada durante el ejercicio."
    };
    
    let exercisesHTML = `
        <div class="evolution-section">
            <div class="evolution-section-title">
                <div class="tooltip-container">
                    Ejercicios prescritos
                    <i class="fas fa-info-circle tooltip-icon"></i>
                    <div class="tooltip-content">
                        <p><strong>Ejercicios personalizados para la rehabilitación y/o entrenamiento del paciente.</strong></p>
                        <p><strong>RPE:</strong> Rating of Perceived Exertion (0-10)</p>
                        <p><strong>RIR:</strong> Repeticiones en Reserva</p>
                    </div>
                </div>
            </div>
    `;
    
    // Crear vista en dos columnas
    exercisesHTML += `<div class="exercise-two-columns">`;
    
    exercises.forEach((exercise, index) => {
        // Determinar valores para mostrar
        const implementStr = exercise.implement || '-';
        const loadStr = exercise.load ? exercise.load + ' kg' : '-';
        let effortStr = '';
        let effortType = exercise.effortType || 'RPE';
        let effortValue = exercise.effortValue || '';
        
        if (exercise.effortType && exercise.effortValue) {
            effortStr = `${exercise.effortType} ${exercise.effortValue}`;
        } else if (exercise.intensity) {
            // Parsear la intensidad para retrocompatibilidad
            if (exercise.intensity === 'Baja' || exercise.intensity === 'Media' || exercise.intensity === 'Alta') {
                effortStr = exercise.intensity;
            } else {
                effortStr = exercise.intensity;
            }
        }
        
        // Si effortStr está vacío, usar un valor por defecto
        if (!effortStr) effortStr = '-';
        
        // Determinar la clase de intensidad para colores
        let intensityClass = 'intensity-medium-value';
        if (effortType === 'RPE' && effortValue) {
            if (effortValue <= 4) {
                intensityClass = 'intensity-low-value';
            } else if (effortValue >= 8) {
                intensityClass = 'intensity-high-value';
            }
        } else if (effortType === 'RIR' && effortValue) {
            if (effortValue >= 4) {
                intensityClass = 'intensity-low-value';
            } else if (effortValue <= 1) {
                intensityClass = 'intensity-high-value';
            }
        } else if (exercise.intensity) {
            if (exercise.intensity === 'Baja') {
                intensityClass = 'intensity-low-value';
            } else if (exercise.intensity === 'Alta') {
                intensityClass = 'intensity-high-value';
            }
        }
        
        exercisesHTML += `
            <div class="exercise-column">
                <h4>
                    <i class="fas fa-dumbbell"></i>
                    ${exercise.name || 'Ejercicio sin nombre'}
                </h4>
                <div class="exercise-detail-grid">
                    <div class="exercise-detail-item">
                        <div class="exercise-detail-label">
                            <div class="tooltip-container">
                                Series
                                <i class="fas fa-info-circle tooltip-icon"></i>
                                <div class="tooltip-content">${tooltips.series}</div>
                            </div>
                        </div>
                        <div class="exercise-detail-value">${exercise.sets || '3'}</div>
                    </div>
                    <div class="exercise-detail-item">
                        <div class="exercise-detail-label">
                            <div class="tooltip-container">
                                Repeticiones
                                <i class="fas fa-info-circle tooltip-icon"></i>
                                <div class="tooltip-content">${tooltips.reps}</div>
                            </div>
                        </div>
                        <div class="exercise-detail-value">${exercise.reps || '10'}</div>
                    </div>
                    <div class="exercise-detail-item">
                        <div class="exercise-detail-label">
                            <div class="tooltip-container">
                                Implemento
                                <i class="fas fa-info-circle tooltip-icon"></i>
                                <div class="tooltip-content">Material o equipo utilizado para realizar el ejercicio.</div>
                            </div>
                        </div>
                        <div class="exercise-detail-value">${implementStr}</div>
                    </div>
                    <div class="exercise-detail-item">
                        <div class="exercise-detail-label">
                            <div class="tooltip-container">
                                Carga
                                <i class="fas fa-info-circle tooltip-icon"></i>
                                <div class="tooltip-content">${tooltips.carga}</div>
                            </div>
                        </div>
                        <div class="exercise-detail-value">${loadStr}</div>
                    </div>
                    <div class="exercise-detail-item">
                        <div class="exercise-detail-label">
                            <div class="tooltip-container">
                                Intensidad
                                <i class="fas fa-info-circle tooltip-icon"></i>
                                <div class="tooltip-content">
                                    ${effortType === 'RPE' ? tooltips.rpe : tooltips.rir}
                                </div>
                            </div>
                        </div>
                        <div class="exercise-detail-value ${intensityClass}">${effortStr}</div>
                    </div>
                </div>
                ${exercise.notes ? `
                <div class="exercise-detail-item" style="margin-top: 10px;">
                    <div class="exercise-detail-label">Observaciones</div>
                    <div class="exercise-detail-value" style="font-size: 13px;">${exercise.notes}</div>
                </div>
                ` : ''}
            </div>
        `;
    });
    
    exercisesHTML += `</div>`;
    
    // Incluir la tabla tradicional como opción alternativa con un botón para cambiar la vista
    exercisesHTML += `
        <div class="tab-view-toggle" style="text-align: right; margin-top: 5px;">
            <button type="button" class="btn-example toggle-exercise-view" onclick="toggleExerciseView(this)" data-view="column">
                <i class="fas fa-table"></i> Cambiar a vista de tabla
            </button>
        </div>
        
        <div class="exercise-table-view" style="display: none; margin-top: 15px;">
            <div class="exercise-table-container" style="margin-bottom: 15px; overflow-x: auto;">
                <table class="exercise-table">
                    <thead>
                        <tr>
                            <th style="width: 25%;">Ejercicio</th>
                            <th style="width: 15%;">Implemento</th>
                            <th style="width: 10%;">Series x Reps</th>
                            <th style="width: 10%;">Carga</th>
                            <th style="width: 15%;">Intensidad</th>
                            <th style="width: 25%;">Observaciones</th>
                        </tr>
                    </thead>
                    <tbody>
    `;
    
    exercises.forEach(exercise => {
        // Compatibilidad con versiones anteriores y nuevas
        let implementStr = exercise.implement || '-';
        let loadStr = exercise.load ? exercise.load + ' kg' : '-';
        let effortStr = '';
        
        if (exercise.effortType && exercise.effortValue) {
            effortStr = `${exercise.effortType} ${exercise.effortValue}`;
        } else if (exercise.intensity) {
            effortStr = exercise.intensity;
        }
        
        // Si effortStr está vacío, usar un valor por defecto
        if (!effortStr) effortStr = '-';
        
        // Determinar la clase de intensidad para colores
        let intensityClass = 'intensity-medium';
        if (exercise.intensity === 'Baja' || (exercise.effortValue && exercise.effortValue <= 4)) {
            intensityClass = 'intensity-low';
        } else if (exercise.intensity === 'Alta' || (exercise.effortValue && exercise.effortValue >= 8)) {
            intensityClass = 'intensity-high';
        }
        
        exercisesHTML += `
            <tr>
                <td>${exercise.name || 'Ejercicio sin nombre'}</td>
                <td>${implementStr}</td>
                <td>${exercise.sets || '3'} x ${exercise.reps || '10'}</td>
                <td>${loadStr}</td>
                <td>
                    <span class="intensity-badge ${intensityClass}">
                        ${effortStr}
                    </span>
                </td>
                <td>${exercise.notes || ''}</td>
            </tr>
        `;
    });
    
    exercisesHTML += `
                    </tbody>
                </table>
            </div>
            <div class="tab-view-toggle" style="text-align: right; margin-top: 5px;">
                <button type="button" class="btn-example toggle-exercise-view" onclick="toggleExerciseView(this)" data-view="table">
                    <i class="fas fa-columns"></i> Cambiar a vista de columnas
                </button>
            </div>
        </div>
    </div>
    `;
    
    return exercisesHTML;
}

// Obtener clase CSS según intensidad
export function getIntensityClass(intensity) {
    switch(intensity) {
        case 'Baja': return 'intensity-low';
        case 'Media': return 'intensity-medium';
        case 'Alta': return 'intensity-high';
        default: return 'intensity-medium';
    }
}

// Render scales
export function renderScales(scales) {
    try {
        if (!scales) return '';
        
        let scalesHTML = `
            <div class="evolution-section">
                <div class="evolution-section-title">Escalas de evaluación</div>
                <div class="scales-container">
        `;
        
        // EVA Scale
        if (scales.eva !== undefined) {
            scalesHTML += `
                <div class="scale-card eva-scale">
                    <div class="scale-header">
                        <div class="scale-name">EVA (Dolor)</div>
                        <div>${scales.eva}/10</div>
                    </div>
                    <div class="scale-bar">
                        <div class="scale-marker" style="left: ${scales.eva * 10}%;"></div>
                    </div>
                    <div class="scale-values">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                    </div>
                </div>
            `;
        }
        
        // PSFS Scale
        if (scales.psfs && scales.psfs.length > 0) {
            scalesHTML += `
                <div class="scale-card">
                    <div class="scale-header">
                        <div class="scale-name">PSFS (Funcionalidad)</div>
                    </div>
                    <div class="psfs-activities">
            `;
            
            scales.psfs.forEach(activity => {
                if (!activity || !activity.name) return;
                
                const rating = activity.rating || 0;
                scalesHTML += `
                    <div class="psfs-activity">
                        <div class="activity-name">${activity.name}</div>
                        <div class="activity-rating">
                            <div class="rating-number">${rating}</div>
                            <div class="rating-bar">
                                <div class="rating-value" style="width: ${rating * 10}%;"></div>
                            </div>
                            <div class="rating-number">10</div>
                        </div>
                    </div>
                `;
            });
            
            scalesHTML += `
                    </div>
                </div>
            `;
        }
        
        scalesHTML += `
            </div>
        `;
        
        // GROC & SANE Scales
        if (scales.groc !== undefined || scales.sane !== undefined) {
            scalesHTML += `
                <div class="scales-container">
            `;
            
            // GROC Scale
            if (scales.groc !== undefined) {
                const grocPercentage = ((parseInt(scales.groc) + 7) / 14) * 100;
                scalesHTML += `
                    <div class="scale-card">
                        <div class="scale-header">
                            <div class="scale-name">GROC (Cambio global)</div>
                            <div>${scales.groc > 0 ? '+' + scales.groc : scales.groc}</div>
                        </div>
                        <div class="groc-scale">
                            <div class="groc-bar"></div>
                            <div class="groc-marker" style="left: ${grocPercentage}%;"></div>
                        </div>
                        <div class="groc-labels">
                            <span>-7</span>
                            <span>-3</span>
                            <span>0</span>
                            <span>+3</span>
                            <span>+7</span>
                        </div>
                    </div>
                `;
            }
            
            // SANE Scale
            if (scales.sane !== undefined) {
                const circumference = 2 * Math.PI * 35;
                const offset = circumference - (circumference * scales.sane / 100);
                const saneText = scales.saneText || "¿Cómo evaluaría la función actual de la región afectada?";
                
                scalesHTML += `
                    <div class="scale-card">
                        <div class="scale-header">
                            <div class="scale-name">SANE (Evaluación numérica)</div>
                            <div>${scales.sane}%</div>
                        </div>
                        <div class="sane-scale">
                            <div class="sane-circle">
                                <svg width="80" height="80" viewBox="0 0 80 80">
                                    <circle cx="40" cy="40" r="35" fill="none" stroke="#E0E0E0" stroke-width="5"/>
                                    <circle cx="40" cy="40" r="35" fill="none" stroke="#1E88E5" stroke-width="5" stroke-dasharray="220" stroke-dashoffset="${offset}" transform="rotate(-90 40 40)"/>
                                </svg>
                                <div class="sane-value">${scales.sane}%</div>
                            </div>
                            <div class="sane-info">
                                <div class="sane-label">${saneText}</div>
                                <div class="sane-progress">
                                    <div class="sane-bar" style="width: ${scales.sane}%;"></div>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
            }
            
            scalesHTML += `
                </div>
            `;
        }
        
        return scalesHTML;
    } catch (error) {
        console.error("Error renderizando escalas:", error);
        return '<div class="evolution-section">Error al renderizar escalas</div>';
    }
}

// Render attachments
export function renderAttachments(attachments) {
    try {
        if (!attachments || attachments.length === 0) return '';
        
        let attachmentsHTML = `
            <div class="evolution-section">
                <div class="evolution-section-title">Adjuntos</div>
                <div class="attachments">
        `;
        
        attachments.forEach(attachment => {
            const isImage = attachment.type === 'image';
            
            attachmentsHTML += `
                <div class="attachment">
                    ${isImage 
                        ? `<img src="${attachment.url}" alt="${attachment.name}">`
                        : `<img src="https://via.placeholder.com/100x100/e9ecef/495057?text=${attachment.name.split('.').pop().toUpperCase()}" alt="${attachment.name}">`
                    }
                    <div class="attachment-type">${isImage ? 'Foto' : attachment.type.toUpperCase()}</div>
                </div>
            `;
        });
        
        attachmentsHTML += `
                </div>
            </div>
        `;
        
        return attachmentsHTML;
    } catch (error) {
        console.error("Error renderizando adjuntos:", error);
        return '<div class="evolution-section">Error al renderizar adjuntos</div>';
    }
}

// Cargar plantillas personalizadas desde localStorage
export function loadCustomTemplates() {
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
export function saveCustomTemplates() {
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

// Renderizar botones para plantillas personalizadas
export function renderCustomTemplateButtons() {
    const container = document.getElementById('customTemplatesContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (customTemplates.length === 0) {
        return;
    }
    
    // Agrupar por categoría
    const categorized = {};
    customTemplates.forEach(template => {
        const category = template.category || 'Otras';
        if (!categorized[category]) {
            categorized[category] = [];
        }
        categorized[category].push(template);
    });
    
    // Crear secciones por categoría
    Object.keys(categorized).forEach(category => {
        const categoryDiv = document.createElement('div');
        categoryDiv.style.marginBottom = '10px';
        categoryDiv.style.width = '100%';
        
        if (Object.keys(categorized).length > 1) {
            categoryDiv.innerHTML = `<div style="color: var(--text-secondary); font-size: 0.9em; margin-bottom: 5px;">${category}</div>`;
        }
        
        const buttonsDiv = document.createElement('div');
        buttonsDiv.style.display = 'flex';
        buttonsDiv.style.flexWrap = 'wrap';
        buttonsDiv.style.gap = '10px';
        
        categorized[category].forEach(template => {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'template-btn';
            btn.setAttribute('data-template-id', template.id);
            btn.innerHTML = `<i class="fas fa-dumbbell"></i> ${template.name}`;
            btn.style.padding = '8px 15px';
            btn.style.backgroundColor = 'var(--primary-light)';
            btn.style.color = 'white';
            btn.style.border = '1px solid var(--primary)';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            
            btn.addEventListener('click', function() {
                loadCustomTemplate(template.id);
            });
            
            buttonsDiv.appendChild(btn);
        });
        
        categoryDiv.appendChild(buttonsDiv);
        container.appendChild(categoryDiv);
    });
}

// Renderizar lista de plantillas guardadas en el modal
export function renderSavedTemplatesList() {
    const container = document.getElementById('savedTemplatesList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (customTemplates.length === 0) {
        container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No hay plantillas personalizadas guardadas</p>';
        return;
    }
    
    // Crear tabla de plantillas
    const table = document.createElement('table');
    table.className = 'exercise-table';
    table.style.width = '100%';
    
    // Cabecera
    const thead = document.createElement('thead');
    thead.innerHTML = `
        <tr>
            <th style="width: 35%;">Nombre</th>
            <th style="width: 20%;">Categoría</th>
            <th style="width: 15%;">Ejercicios</th>
            <th style="width: 30%;">Acciones</th>
        </tr>
    `;
    table.appendChild(thead);
    
    // Cuerpo de la tabla
    const tbody = document.createElement('tbody');
    customTemplates.forEach(template => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${template.name}</td>
            <td>${template.category || '-'}</td>
            <td>${template.exercises.length}</td>
            <td>
                <button type="button" class="action-btn btn-secondary use-template-btn" data-id="${template.id}" style="padding: 5px 10px; margin-right: 5px;">
                    <i class="fas fa-play"></i> Usar
                </button>
                <button type="button" class="action-btn btn-secondary edit-template-btn" data-id="${template.id}" style="padding: 5px 10px; margin-right: 5px;">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button type="button" class="action-btn btn-secondary delete-template-btn" data-id="${template.id}" style="padding: 5px 10px; background-color: var(--accent2-light);">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    
    container.appendChild(table);
    
    // Añadir eventos a los botones
    container.querySelectorAll('.use-template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const templateId = this.getAttribute('data-id');
            loadCustomTemplate(templateId, true);
        });
    });
    
    container.querySelectorAll('.edit-template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const templateId = this.getAttribute('data-id');
            editCustomTemplate(templateId);
        });
    });
    
    container.querySelectorAll('.delete-template-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const templateId = this.getAttribute('data-id');
            deleteCustomTemplate(templateId);
        });
    });
}

// Cargar plantilla personalizada
export function loadCustomTemplate(templateId, closeModal = false) {
    const template = customTemplates.find(t => t.id === templateId);
    if (!template) {
        showToast("Plantilla no encontrada", "error");
        return;
    }
    
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
    
    // Cargar ejercicios de la plantilla
    template.exercises.forEach(exercise => {
        addExerciseRow(exercise);
    });
    
    showToast(`Plantilla "${template.name}" cargada`, "success");
    
    // Cerrar modal si es necesario
    if (closeModal) {
        const templatesModal = document.getElementById('templatesModal');
        if (templatesModal) {
            templatesModal.classList.remove('active');
            setTimeout(() => {
                templatesModal.style.display = 'none';
            }, 300);
        }
    }
}

// Guardar ejercicios actuales como plantilla
export function saveCurrentExercisesAsTemplate() {
    const exercises = getExercisesData();
    
    if (exercises.length === 0) {
        showToast("No hay ejercicios para guardar como plantilla", "error");
        return;
    }
    
    // Mostrar formulario de guardado
    const saveTemplateForm = document.getElementById('saveTemplateForm');
    if (saveTemplateForm) {
        saveTemplateForm.style.display = 'block';
        
        const templateNameInput = document.getElementById('templateNameInput');
        if (templateNameInput) {
            templateNameInput.focus();
        }
    }
}

// Mostrar modal de plantillas personalizadas
export function showCustomTemplatesModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'templatesModal';
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Mis plantillas de ejercicios</h2>
                <button class="modal-close" id="closeTemplatesModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div style="display: flex; justify-content: space-between; margin-bottom: 15px;">
                    <h3 style="margin: 0;">Plantillas guardadas</h3>
                    <button type="button" id="saveCurrentAsTemplateBtn" class="action-btn btn-primary">
                        <i class="fas fa-plus"></i> Guardar ejercicios actuales
                    </button>
                </div>
                
                <div id="savedTemplatesList" style="margin-bottom: 20px;">
                    <p style="color: var(--text-secondary); font-style: italic;">No hay plantillas personalizadas guardadas</p>
                </div>
                
                <div id="saveTemplateForm" style="display: none; background-color: var(--background-alt); padding: 15px; border-radius: 6px; margin-top: 20px;">
                    <h4 style="margin-top: 0;">Guardar como plantilla</h4>
                    <div class="form-group">
                        <label class="form-label">Nombre de la plantilla</label>
                        <input type="text" class="form-control" id="templateNameInput" placeholder="Ej: Mi rutina de hombro">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Categoría (opcional)</label>
                        <input type="text" class="form-control" id="templateCategoryInput" placeholder="Ej: Rehabilitación, Fortalecimiento, etc.">
                    </div>
                    <div style="text-align: right; margin-top: 15px;">
                        <button type="button" id="cancelSaveTemplateBtn" class="action-btn btn-secondary" style="margin-right: 10px;">Cancelar</button>
                        <button type="button" id="confirmSaveTemplateBtn" class="action-btn btn-primary">Guardar plantilla</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    setTimeout(() => modal.classList.add('active'), 50);
    
    // Renderizar lista de plantillas
    renderSavedTemplatesList();
    
    // Configurar eventos
    document.getElementById('closeTemplatesModal').addEventListener('click', function() {
        modal.classList.remove('active');
        setTimeout(() => {
            document.body.removeChild(modal);
        }, 300);
    });
    
    document.getElementById('saveCurrentAsTemplateBtn').addEventListener('click', saveCurrentExercisesAsTemplate);
    
    document.getElementById('confirmSaveTemplateBtn').addEventListener('click', confirmSaveTemplate);
    
    document.getElementById('cancelSaveTemplateBtn').addEventListener('click', function() {
        document.getElementById('saveTemplateForm').style.display = 'none';
    });
}

// Confirmar guardado de plantilla personalizada
export function confirmSaveTemplate() {
    const nameInput = document.getElementById('templateNameInput');
    const categoryInput = document.getElementById('templateCategoryInput');
    
    if (!nameInput || !nameInput.value.trim()) {
        showToast("Debe ingresar un nombre para la plantilla", "error");
        return;
    }
    
    const exercises = getExercisesData();
    
    if (exercises.length === 0) {
        showToast("No hay ejercicios para guardar", "error");
        return;
    }
    
    // Crear objeto de plantilla
    const newTemplate = {
        id: 'template_' + Date.now(),
        name: nameInput.value.trim(),
        category: categoryInput ? categoryInput.value.trim() : '',
        exercises: exercises,
        createdAt: new Date().toISOString()
    };
    
    // Añadir a la lista de plantillas
    customTemplates.push(newTemplate);
    
    // Guardar en localStorage
    saveCustomTemplates();
    
    // Ocultar formulario
    const saveTemplateForm = document.getElementById('saveTemplateForm');
    if (saveTemplateForm) {
        saveTemplateForm.style.display = 'none';
    }
    
    // Limpiar campos
    if (nameInput) nameInput.value = '';
    if (categoryInput) categoryInput.value = '';
    
    showToast("Plantilla guardada correctamente", "success");
}

// Exportar función para el toggle de vista
export function toggleExerciseView(button) {
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
}
