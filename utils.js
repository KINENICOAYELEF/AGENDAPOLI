// utils.js - Funciones de utilidad general

/**
 * Muestra el indicador de carga
 */
export function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.add('show');
}

/**
 * Oculta el indicador de carga
 */
export function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.remove('show');
}

/**
 * Muestra una notificación toast
 * @param {string} message - Mensaje a mostrar
 * @param {string} type - Tipo de toast (info, success, error)
 */
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

/**
 * Formatea una fecha para mostrar
 * @param {Date|string} date - La fecha a formatear
 * @returns {string} - Fecha formateada como dd/mm/yyyy
 */
export function formatDate(date) {
    if (!date) return 'No registrada';
    
    try {
        let d = new Date(date); // Cambiado a let en lugar de const
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

/**
 * Obtiene las iniciales del nombre de una persona
 * @param {string} name - Nombre completo
 * @returns {string} - Iniciales (2 caracteres)
 */
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

/**
 * Determina la clase CSS de estado basado en el progreso
 * @param {number} progress - Valor de progreso (0-100)
 * @returns {string} - Nombre de clase CSS
 */
export function getStatusClass(progress) {
    if (progress >= 80) return 'status-active';
    if (progress >= 30) return 'status-pending';
    return 'status-inactive';
}

/**
 * Calcula el progreso de un paciente
 * @param {Object} patient - Datos del paciente
 * @returns {number} - Porcentaje de progreso (0-100)
 */
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

/**
 * Obtiene la clase CSS según intensidad
 * @param {string} intensity - Nivel de intensidad
 * @returns {string} - Nombre de clase CSS
 */
export function getIntensityClass(intensity) {
    switch(intensity) {
        case 'Baja': return 'intensity-low';
        case 'Media': return 'intensity-medium';
        case 'Alta': return 'intensity-high';
        default: return 'intensity-medium';
    }
}

/**
 * Obtiene el nombre descriptivo de una plantilla
 * @param {string} template - Código de plantilla
 * @returns {string} - Nombre descriptivo
 */
export function getTemplateName(template) {
    switch(template) {
        case 'mmss': return 'miembros superiores';
        case 'mmii': return 'miembros inferiores';
        case 'core': return 'core';
        case 'estiramiento': return 'estiramientos';
        default: return template;
    }
}

// Funciones para ejemplos de evoluciones
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

// Exportar también para compatibilidad global
window.showExampleModal = showExampleModal;
window.useExample = useExample;
