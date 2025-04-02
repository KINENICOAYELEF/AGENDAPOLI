// Renderizar botones para plantillas personalizadas
function renderCustomTemplateButtons() {
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
function renderSavedTemplatesList() {
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
function loadCustomTemplate(templateId, closeModal = false) {
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
function saveCurrentExercisesAsTemplate() {
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

        // Función para guardar una plantilla en Firebase
async function saveTemplateToFirebase(template) {
    try {
        showLoading();
        
        // Asegurarse de que template tenga una ID única
        if (!template.id) {
            template.id = 'template_' + Date.now();
        }
        
        // Guardar en Firestore
        const templatesRef = collection(db, "exerciseTemplates");
        await addDoc(templatesRef, {
            ...template,
            createdAt: serverTimestamp(),
            userId: "sistema" // En un sistema con autenticación, aquí iría el ID del usuario
        });
        
        hideLoading();
        showToast("Plantilla guardada en la nube correctamente", "success");
        return true;
    } catch (error) {
        console.error("Error al guardar plantilla en Firebase:", error);
        hideLoading();
        showToast("Error al guardar plantilla: " + error.message, "error");
        return false;
    }
}

// Función para obtener todas las plantillas de Firebase
async function getTemplatesFromFirebase() {
    try {
        showLoading();
        
        const templatesRef = collection(db, "exerciseTemplates");
        const querySnapshot = await getDocs(templatesRef);
        
        const templates = [];
        querySnapshot.forEach((doc) => {
            templates.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        hideLoading();
        return templates;
    } catch (error) {
        console.error("Error al obtener plantillas de Firebase:", error);
        hideLoading();
        showToast("Error al cargar plantillas: " + error.message, "error");
        return [];
    }
}

// Función para eliminar una plantilla de Firebase
async function deleteTemplateFromFirebase(templateId) {
    try {
        showLoading();
        
        await deleteDoc(doc(db, "exerciseTemplates", templateId));
        
        hideLoading();
        showToast("Plantilla eliminada correctamente", "success");
        return true;
    } catch (error) {
        console.error("Error al eliminar plantilla de Firebase:", error);
        hideLoading();
        showToast("Error al eliminar plantilla: " + error.message, "error");
        return false;
    }
}


        
// Función para importar plantillas desde un archivo JSON
async function importTemplatesFromJson() {
    try {
        const fileInput = document.getElementById('importTemplatesFile');
        if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
            showToast("Por favor, seleccione un archivo JSON", "error");
            return;
        }
        
        showLoading();
        
        const file = fileInput.files[0];
        const reader = new FileReader();
        
        reader.onload = async (e) => {
            try {
                const jsonData = JSON.parse(e.target.result);
                
                // Validar formato
                if (!jsonData.templates || !Array.isArray(jsonData.templates)) {
                    throw new Error("Formato de archivo inválido");
                }
                
                // Contador de plantillas importadas
                let importedCount = 0;
                let errorCount = 0;
                
                // Importar cada plantilla
                for (const template of jsonData.templates) {
                    if (!template.name || !template.exercises || !Array.isArray(template.exercises)) {
                        errorCount++;
                        continue;
                    }
                    
                    // Generar nuevo ID para evitar colisiones
                    template.id = 'imported_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
                    
                    // Agregar a las plantillas locales
                    customTemplates.push(template);
                    
                    // Intentar guardar en Firebase si la plantilla es válida
                    try {
                        await saveTemplateToFirebase(template);
                        importedCount++;
                    } catch (err) {
                        console.error("Error al guardar plantilla importada en Firebase:", err);
                        errorCount++;
                    }
                }
                
                // Guardar en localStorage
                saveCustomTemplates();
                
                // Actualizar la interfaz
                renderCustomTemplateButtons();
                renderSavedTemplatesList();
                
                // Limpiar input
                fileInput.value = '';
                
                hideLoading();
                
                if (errorCount > 0) {
                    showToast(`Importación parcial: ${importedCount} plantillas importadas, ${errorCount} con errores`, "info");
                } else {
                    showToast(`${importedCount} plantillas importadas correctamente`, "success");
                }
            } catch (error) {
                hideLoading();
                console.error("Error al procesar el archivo JSON:", error);
                showToast("Error al importar plantillas: " + error.message, "error");
            }
        };
        
        reader.onerror = () => {
            hideLoading();
            showToast("Error al leer el archivo", "error");
        };
        
        reader.readAsText(file);
    } catch (error) {
        hideLoading();
        console.error("Error al importar plantillas:", error);
        showToast("Error al importar plantillas: " + error.message, "error");
    }
}

// Función para renderizar lista de plantillas en la nube
async function renderCloudTemplatesList() {
    const container = document.getElementById('cloudTemplatesList');
    if (!container) return;
    
    container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">Cargando plantillas...</p>';
    
    try {
        // Obtener plantillas de Firebase
        const templates = await getTemplatesFromFirebase();
        
        if (templates.length === 0) {
            container.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No hay plantillas guardadas en la nube</p>';
            return;
        }
        
        // Agrupar por categoría
        const groupedTemplates = {};
        templates.forEach(template => {
            const category = template.category || 'Sin categoría';
            if (!groupedTemplates[category]) {
                groupedTemplates[category] = [];
            }
            groupedTemplates[category].push(template);
        });
        
        // Crear contenido HTML
        let html = '';
        
        // Crear acordeón por cada categoría
        for (const [category, categoryTemplates] of Object.entries(groupedTemplates)) {
            html += `
                <div class="accordion">
                    <div class="accordion-header">
                        <span>${category} (${categoryTemplates.length})</span>
                        <i class="fas fa-chevron-down accordion-icon"></i>
                    </div>
                    <div class="accordion-body">
                        <div class="exercise-table-container">
                            <table class="exercise-table">
                                <thead>
                                    <tr>
                                        <th style="width: 30%;">Nombre</th>
                                        <th style="width: 15%;">Ejercicios</th>
                                        <th style="width: 35%;">Descripción</th>
                                        <th style="width: 20%;">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody>
            `;
            
            // Añadir cada plantilla de la categoría
            categoryTemplates.forEach(template => {
                html += `
                    <tr>
                        <td>${template.name || 'Sin nombre'}</td>
                        <td>${template.exercises?.length || 0} ejercicios</td>
                        <td>${template.description || '-'}</td>
                        <td>
                            <button type="button" class="action-btn btn-secondary use-cloud-template-btn" data-id="${template.id}" style="padding: 5px 10px; margin-right: 5px;">
                                <i class="fas fa-play"></i> Usar
                            </button>
                            <button type="button" class="action-btn btn-secondary delete-cloud-template-btn" data-id="${template.id}" style="padding: 5px 10px; background-color: var(--accent2-light);">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            });
            
            html += `
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // Configurar eventos para los acordeones
        container.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', function() {
                this.parentElement.classList.toggle('active');
                const icon = this.querySelector('.accordion-icon');
                if (icon) {
                    icon.style.transform = this.parentElement.classList.contains('active') 
                        ? 'rotate(180deg)' 
                        : 'rotate(0deg)';
                }
            });
        });
        
        // Configurar eventos para los botones
        container.querySelectorAll('.use-cloud-template-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const templateId = this.getAttribute('data-id');
                loadTemplateFromFirebase(templateId);
            });
        });
        
        container.querySelectorAll('.delete-cloud-template-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const templateId = this.getAttribute('data-id');
                deleteTemplateFromFirebase(templateId);
            });
        });
        
    } catch (error) {
        console.error("Error al renderizar plantillas en la nube:", error);
        container.innerHTML = `<p style="color: var(--accent2); font-style: italic;">Error al cargar plantillas: ${error.message}</p>`;
    }
}

// Función para cargar una plantilla específica desde Firebase
async function loadTemplateFromFirebase(templateId) {
    try {
        showLoading();
        
        const templateDoc = await getDoc(doc(db, "exerciseTemplates", templateId));
        
        if (!templateDoc.exists()) {
            hideLoading();
            showToast("Plantilla no encontrada", "error");
            return;
        }
        
        const template = {
            id: templateDoc.id,
            ...templateDoc.data()
        };
        
        // Cargar ejercicios de la plantilla
        const tableBody = document.getElementById('exerciseTableBody');
        if (!tableBody) {
            hideLoading();
            showToast("No se encontró la tabla de ejercicios", "error");
            return;
        }
        
        // Confirmar antes de reemplazar ejercicios existentes
        if (tableBody.children.length > 0) {
            if (!confirm('¿Desea reemplazar los ejercicios actuales con la plantilla seleccionada?')) {
                hideLoading();
                return;
            }
            tableBody.innerHTML = '';
        }
        
        // Cargar ejercicios de la plantilla
        if (template.exercises && Array.isArray(template.exercises)) {
            template.exercises.forEach(exercise => {
                addExerciseRow(exercise);
            });
        }
        
        // Cerrar modal
        const modal = document.getElementById('cloudTemplatesModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        
        hideLoading();
        showToast(`Plantilla "${template.name}" cargada correctamente`, "success");
    } catch (error) {
        hideLoading();
        console.error("Error al cargar plantilla desde Firebase:", error);
        showToast("Error al cargar plantilla: " + error.message, "error");
    }
}

// Mostrar modal de plantillas personalizadas
function showCustomTemplatesModal() {
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

        // Funciones para ejemplos
window.showPatientStateExample = function() {
    const example = "Paciente refiere dolor lumbar de intensidad 6/10 en región L4-L5, con irradiación hacia EID°. Reporta mejoría desde última sesión (antes 8/10). Limitación para inclinarse hacia adelante y dificultad para permanecer sentado >30 minutos. Dolor aumenta al final del día y con actividades que implican flexión lumbar.";
    
    // Mostrar ejemplo en un modal pequeño
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

// Función para mostrar el modal con ejemplo
window.showExampleModal = function(title, text, targetFieldId) {
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
        window.useExample(text, targetFieldId);
    });
};

// Función para usar el ejemplo
window.useExample = function(text, fieldId) {
    const field = document.getElementById(fieldId);
    if (field) field.value = text;
    
    const modal = document.getElementById('exampleModal');
    if (modal) {
        modal.classList.remove('active');
        setTimeout(() => document.body.removeChild(modal), 300);
    }
};

// Implementar comandos rápidos con "/texto"
function setupCommandShortcuts() {
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

// Initialize app
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

        // Evento para el botón de eliminar paciente
const deletePatientBtn = document.getElementById('deletePatientBtn');
if (deletePatientBtn) {
    deletePatientBtn.addEventListener('click', async function() {
        if (!currentPatientId) {
            showToast("No hay paciente seleccionado para eliminar", "error");
            return;
        }
        
        // Obtener datos del paciente para mostrar en la confirmación
        const patient = await getPatient(currentPatientId);
        if (!patient) {
            showToast("Error: No se pudo obtener información del paciente", "error");
            return;
        }
        
        // Pedir confirmación
        if (confirm(`¿Está seguro que desea eliminar al paciente ${patient.name}?\nEsta acción no se puede deshacer y se perderán todos los datos asociados.`)) {
            // Cerrar el modal de paciente
            const patientModal = document.getElementById('patientModal');
            if (patientModal) {
                patientModal.classList.remove('active');
            }
            
            // Eliminar el paciente
            const deleted = await deletePatient(currentPatientId);
            if (deleted) {
                // Recargar la lista de pacientes
                await getPatients();
            }
        }
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

// Configurar navegación
function setupNavigation() {
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



        // Controlador para el botón de gestión de plantillas
document.addEventListener('DOMContentLoaded', function() {
    const manageCustomTemplatesBtn = document.getElementById('manageCustomTemplatesBtn');
    if (manageCustomTemplatesBtn) {
        manageCustomTemplatesBtn.addEventListener('click', function() {
            try {
                // Intentar mostrar el modal de plantillas
                const modal = document.getElementById('cloudTemplatesModal') || document.getElementById('templatesModal');
                if (modal) {
                    modal.style.display = 'block';
                    setTimeout(() => modal.classList.add('active'), 50);
                    
                    // Intentar renderizar plantillas
                    try {
                        if (typeof renderCloudTemplatesList === 'function') {
                            renderCloudTemplatesList();
                        }
                        if (typeof renderSavedTemplatesList === 'function') {
                            renderSavedTemplatesList();
                        }
                    } catch (renderError) {
                        console.error("Error al renderizar plantillas:", renderError);
                    }
                    
                    // Configurar pestañas si existen
                    const tabs = modal.querySelectorAll('.tab');
                    if (tabs.length > 0) {
                        tabs.forEach(tab => {
                            tab.addEventListener('click', function() {
                                // Gestionar pestañas
                                modal.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
                                modal.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
                                
                                this.classList.add('active');
                                const tabId = this.getAttribute('data-tab');
                                const targetTab = document.getElementById(tabId + 'Tab');
                                if (targetTab) targetTab.classList.add('active');
                            });
                        });
                    }
                    
                    // Configurar cierre del modal
                    const closeBtn = modal.querySelector('.modal-close');
                    if (closeBtn) {
                        closeBtn.addEventListener('click', function() {
                            modal.classList.remove('active');
                            setTimeout(() => {
                                modal.style.display = 'none';
                            }, 300);
                        });
                    }
                } else {
                    // Fallback a método antiguo
                    if (typeof showCustomTemplatesModal === 'function') {
                        showCustomTemplatesModal();
                    } else {
                        showToast("Error: No se encontró el modal de plantillas", "error");
                    }
                }
            } catch (error) {
                console.error("Error al mostrar gestor de plantillas:", error);
                showToast("Error al abrir gestor de plantillas", "error");
            }
        });
    }
});
        

        // Función global para alternar entre vistas de ejercicios
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

// Funciones globales para ejemplos
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

window.showExampleModal = function(title, text, targetFieldId) {
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
            window.useExample(text, targetFieldId);
        });
    } catch (error) {
        console.error("Error al mostrar ejemplo modal:", error);
        alert("No se pudo mostrar el ejemplo. Error: " + error.message);
    }
};

window.useExample = function(text, fieldId) {
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
};

        </script>
