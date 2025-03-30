// Funciones de utilidad para el sistema kinesiológico

// Mostrar indicador de carga
export function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.add('show');
}

// Ocultar indicador de carga
export function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.remove('show');
}

// Mostrar mensaje emergente
export function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.classList.add('toast', `toast-${type}`);
    toast.innerHTML = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.classList.add('show');
    }, 100);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            document.body.removeChild(toast);
        }, 300);
    }, 3000);
}

// Formatear fecha
export function formatDate(date) {
    if (!date) return 'No registrada';
    
    try {
        let d = new Date(date);
        if (isNaN(d.getTime())) {
            // Intenta parsear formato dd/mm/yyyy
            const parts = date.split('/');
            if (parts.length === 3) {
                d = new Date(parts[2], parts[1] - 1, parts[0]);
            }
            
            if (isNaN(d.getTime())) {
                return 'Fecha inválida';
            }
        }
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const year = d.getFullYear();
        return `${day}/${month}/${year}`;
    } catch (error) {
        console.error("Error al formatear fecha:", error);
        return 'Error de formato';
    }
}

// Obtener iniciales de un nombre
export function getInitials(name) {
    if (!name) return 'NA';
    
    // Dividir por espacios y tomar la primera letra de cada palabra
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    
    // Si solo hay una palabra, tomar las dos primeras letras
    return name.substring(0, 2).toUpperCase();
}

// Calcular progreso del paciente
export function calculatePatientProgress(patient) {
    // Usar progreso existente si está disponible
    if (patient.progress !== undefined) {
        return patient.progress;
    }
    
    // De lo contrario, generar un valor aleatorio pero consistente basado en el id del paciente
    // Esto es temporal hasta que implementemos el cálculo real del progreso
    let seed = 0;
    if (patient.id) {
        for (let i = 0; i < patient.id.length; i++) {
            seed += patient.id.charCodeAt(i);
        }
    }
    
    // Generar un número entre 20 y 90 usando la semilla
    return 20 + (seed % 70);
}

// Obtener clase CSS según progreso
export function getStatusClass(progress) {
    if (progress >= 80) return 'status-active';
    if (progress >= 30) return 'status-pending';
    return 'status-inactive';
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

// Aplicar tema de colores
export function applyColorTheme(theme) {
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
export function applyFontSize(size) {
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

// Mostrar modal con ejemplo
export function showExampleModal(title, text, targetFieldId) {
    try {
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
    } catch (error) {
        console.error("Error al mostrar ejemplo modal:", error);
        alert("No se pudo mostrar el ejemplo. Error: " + error.message);
    }
}

// Usar ejemplo en campo
export function useExample(text, fieldId) {
    try {
        const field = document.getElementById(fieldId);
        if (field) field.value = text;
        
        const modal = document.getElementById('exampleModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => document.body.removeChild(modal), 300);
        }
    } catch (error) {
        console.error("Error al usar ejemplo:", error);
    }
}

// Alternar entre vistas de ejercicios
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

// Configurar controles de escalas
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

// Actualizar visualización de las escalas
function updateScaleDisplays() {
    // EVA
    const evaRange = document.getElementById('evaRange');
    const evaValue = document.getElementById('evaValue');
    const evaMarker = document.querySelector('.eva-scale .scale-marker');
    
    if (evaRange && evaValue && evaMarker) {
        const value = evaRange.value;
        evaValue.textContent = value + '/10';
        const percentage = (value / 10) * 100;
        evaMarker.style.left = percentage + '%';
    }
    
    // GROC
    const grocRange = document.getElementById('grocRange');
    const grocValue = document.getElementById('grocValue');
    const grocMarker = document.querySelector('.groc-marker');
    
    if (grocRange && grocValue && grocMarker) {
        const value = grocRange.value;
        grocValue.textContent = value > 0 ? '+' + value : value;
        const percentage = ((parseFloat(value) + 7) / 14) * 100;
        grocMarker.style.left = percentage + '%';
    }
    
    // SANE
    const saneRange = document.getElementById('saneRange');
    const saneValue = document.getElementById('saneValue');
    const saneCircleValue = document.querySelector('.sane-value');
    const saneBar = document.querySelector('.sane-bar');
    
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

// Añadir actividad PSFS
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

// Cargar configuración
export function loadConfiguration() {
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
export function saveConfiguration() {
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
export function resetConfiguration() {
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

// Establecer funciones globales para compatibilidad
window.showPatientStateExample = function() {
    const example = "Paciente refiere dolor lumbar de intensidad 6/10 en región L4-L5, con irradiación hacia EID°. Reporta mejoría desde última sesión (antes 8/10). Limitación para inclinarse hacia adelante y dificultad para permanecer sentado >30 minutos. Dolor aumenta al final del día y con actividades que implican flexión lumbar.";
    showExampleModal("Ejemplo de Estado del Paciente", example, "evolutionPatientState");
};

window.showTreatmentExample = function() {
    const example = "Terapia manual: Movilización de segmentos L4-L5, técnicas de presión isquémica en paravertebrales y piramidal derecho. Educación: posiciones durante el trabajo para el manejo sintomátologico.";
    showExampleModal("Ejemplo de Tratamiento", example, "evolutionTreatment");
};

window.showResponseExample = function() {
    const example = "Respuesta favorable durante sesión. Dolor disminuyó de 6/10 a 3/10 post-tratamiento. Mejoró ROM lumbar en flexión. Sin eventos adversos. Paciente refiere mayor sensación de estabilidad al caminar. Se observa disminución de tensión en musculatura paravertebral. Persistente limitación leve para movimientos rotacionales.";
    showExampleModal("Ejemplo de Respuesta al Tratamiento", example, "evolutionResponse");
};

window.showExampleModal = showExampleModal;
window.useExample = useExample;
window.toggleExerciseView = toggleExerciseView;
