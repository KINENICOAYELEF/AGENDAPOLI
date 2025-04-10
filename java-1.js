 <!-- Script for Firebase -->
    <script type="module">


        // Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy, serverTimestamp, deleteDoc, setDoc, where, documentId } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

// Variables globales
let app, db, storage;
let currentPatientId = null;
let patientsCache = []; // Para almacenar pacientes y reducir consultas
let customTemplates = [];

// Configuración de Firebase
const firebaseConfig = {
    apiKey: "AIzaSyDD1kjbOr566240HrDtWi5egah47kGZLvQ",
    authDomain: "evoluciones-poli.firebaseapp.com",
    projectId: "evoluciones-poli",
    storageBucket: "evoluciones-poli.appspot.com",
    messagingSenderId: "771046852975",
    appId: "1:771046852975:web:ceedc5c0e5d22ea039809a"
};

// Funciones de utilidad
function showLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.add('show');
}

function hideLoading() {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) spinner.classList.remove('show');
}

function showToast(message, type = 'info') {
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

function formatDate(date) {
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

// Inicializar Firebase
async function initFirebase() {
    console.log("Inicializando Firebase...");
    try {
        app = initializeApp(firebaseConfig);
        console.log("App inicializada:", app);
        
        db = getFirestore(app);
        console.log("Firestore obtenido:", db);
        
        storage = getStorage(app);
        console.log("Storage obtenido:", storage);

        // No necesitamos inicializar ImageKit
        console.log("Sistema de archivos configurado para usar ImageKit directamente");
        
        // Verificar conexión
        try {
            const connectionOk = await testFirebase();
            if (connectionOk) {
                showToast("Conexión a Firebase establecida", "success");
            }
        } catch (connectionError) {
            console.error("Error verificando conexión:", connectionError);
            showToast("Advertencia: La verificación de conexión falló, pero continuando...", "info");
        }
        
        return true;
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
        showToast("Error al conectar con Firebase: " + error.message, "error");
        // Continuar a pesar del error para que la UI básica funcione
        return false;
    }
}

async function testFirebase() {
    try {
        // Probar lectura intentando obtener colección
        const testCollection = collection(db, "patients");
        
        // Simplificar consulta para evitar la necesidad de un índice compuesto
        const snapshot = await getDocs(testCollection);
        
        console.log("Test de Firebase completado: Permisos de lectura OK");
        return true;
    } catch (error) {
        console.error("Error en prueba de Firebase:", error);
        showToast("Error de conexión a Firebase: " + error.message, "error");
        return false;
    }
}

        // Get patients from Firebase
async function getPatients() {
    try {
        showLoading();
        const patientsCollection = collection(db, "patients");
        const patientSnapshot = await getDocs(patientsCollection);
        const patientList = patientSnapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() };
        });
        
        // Ordenar pacientes por fecha de última sesión (más reciente primero)
        patientList.sort((a, b) => {
            // Si no hay lastSession, colocar al final de la lista
            if (!a.lastSession && !b.lastSession) return 0;
            if (!a.lastSession) return 1;
            if (!b.lastSession) return -1;
            
            try {
                // Convertir formato dd/mm/yyyy a yyyy-mm-dd para comparación
                const dateA = a.lastSession.split('/').reverse().join('-');
                const dateB = b.lastSession.split('/').reverse().join('-');
                return new Date(dateB) - new Date(dateA);
            } catch (error) {
                console.error("Error al ordenar fechas:", error);
                return 0;
            }
        });
        
        // Actualizar caché de pacientes
        patientsCache = patientList;
        
        // Renderizar pacientes en la UI
        renderPatients(patientList);
        
        // Actualizar estadísticas del dashboard
        updateDashboardStats(patientList);
        
        hideLoading();
        return patientList;
    } catch (error) {
        console.error("Error obteniendo pacientes: ", error);
        showToast("Error al cargar pacientes: " + error.message, "error");
        hideLoading();
        return [];
    }
}


// Get patient by ID
async function getPatient(patientId) {
    try {
        showLoading();
        
        // Primero buscar en la caché de pacientes
        const cachedPatient = patientsCache.find(p => p.id === patientId);
        if (cachedPatient) {
            hideLoading();
            return cachedPatient;
        }
        
        // Si no está en caché, buscarlo en Firebase
        const patientRef = doc(db, "patients", patientId);
        const patientSnap = await getDoc(patientRef);
        
        if (patientSnap.exists()) {
            const patient = { id: patientSnap.id, ...patientSnap.data() };
            
            // Añadir a la caché
            const existingIndex = patientsCache.findIndex(p => p.id === patientId);
            if (existingIndex >= 0) {
                patientsCache[existingIndex] = patient;
            } else {
                patientsCache.push(patient);
            }
            
            hideLoading();
            return patient;
        } else {
            hideLoading();
            showToast("Paciente no encontrado", "error");
            return null;
        }
    } catch (error) {
        console.error("Error obteniendo paciente: ", error);
        hideLoading();
        showToast("Error al cargar datos del paciente: " + error.message, "error");
        return null;
    }
}

// Update patient
async function updatePatient(patientId, patientData) {
    try {
        showLoading();

// Antes de llamar a updateDoc, añade esta verificación
Object.keys(patientData).forEach(key => {
    if (patientData[key] === undefined) {
        console.warn(`Valor undefined detectado en patientData.${key}, estableciendo a null`);
        patientData[key] = null; // Firebase acepta null pero no undefined
    }
});
        
        // Añadir timestamp de actualización
        patientData.updatedAt = new Date().toISOString();
        
        const patientRef = doc(db, "patients", patientId);
        await updateDoc(patientRef, patientData);
        
        // Actualizar también en la caché
        const cachedIndex = patientsCache.findIndex(p => p.id === patientId);
        if (cachedIndex >= 0) {
            patientsCache[cachedIndex] = { 
                ...patientsCache[cachedIndex], 
                ...patientData 
            };
        }
        
        hideLoading();
        showToast("Paciente actualizado correctamente", "success");
        return true;
    } catch (error) {
        console.error("Error actualizando paciente: ", error);
        hideLoading();
        showToast("Error al actualizar paciente: " + error.message, "error");
        return false;
    }
}

 // Delete patient
async function deletePatient(patientId) {
    try {
        showLoading();
        
        if (!patientId) {
            hideLoading();
            showToast("Error: ID de paciente no válido", "error");
            return false;
        }
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Eliminar el paciente
        await deleteDoc(patientRef);
        
        // Eliminar de la caché
        const cachedIndex = patientsCache.findIndex(p => p.id === patientId);
        if (cachedIndex >= 0) {
            patientsCache.splice(cachedIndex, 1);
        }
        
        // Si el paciente eliminado era el actual, resetear currentPatientId
        if (currentPatientId === patientId) {
            currentPatientId = null;
        }
        
        hideLoading();
        showToast("Paciente eliminado correctamente", "success");
        
        // Recargar la lista de pacientes
        await getPatients();
        
        return true;
    } catch (error) {
        console.error("Error eliminando paciente: ", error);
        hideLoading();
        showToast("Error al eliminar paciente: " + error.message, "error");
        return false;
    }
}       

// Add evolution to patient
async function addEvolution(patientId, evolutionData) {
    try {
        showLoading();
        
        // Añadir timestamp de creación
        evolutionData.createdAt = new Date().toISOString();
        
        const evolutionsRef = collection(db, "patients", patientId, "evolutions");
        const docRef = await addDoc(evolutionsRef, evolutionData);
        
        // Actualizar lastSession del paciente
        const formattedDate = formatDate(new Date(evolutionData.date));
        await updateDoc(doc(db, "patients", patientId), {
            lastSession: formattedDate,
            updatedAt: new Date().toISOString()
        });
        
        // Actualizar caché
        const cachedPatientIndex = patientsCache.findIndex(p => p.id === patientId);
        if (cachedPatientIndex >= 0) {
            patientsCache[cachedPatientIndex].lastSession = formattedDate;
            patientsCache[cachedPatientIndex].updatedAt = new Date().toISOString();
        }
        
        hideLoading();
        showToast("Evolución registrada correctamente", "success");
        return docRef.id;
    } catch (error) {
        console.error("Error añadiendo evolución: ", error);
        hideLoading();
        showToast("Error al registrar evolución: " + error.message, "error");
        return null;
    }
}


        
// Get patient evolutions
async function getEvolutions(patientId) {
    try {
        showLoading();
        const evolutionsRef = collection(db, "patients", patientId, "evolutions");
        const evolutionsQuery = query(evolutionsRef, orderBy("date", "desc"));
        const evolutionsSnapshot = await getDocs(evolutionsQuery);
        
        const evolutionsList = evolutionsSnapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() };
        });
        
        hideLoading();
        return evolutionsList;
    } catch (error) {
        console.error("Error obteniendo evoluciones: ", error);
        hideLoading();
        showToast("Error al cargar evoluciones: " + error.message, "error");
        return [];
    }
}


     
        
// Get total evolutions count for a patient
async function getEvolutionsCount(patientId) {
    try {
        const evolutionsRef = collection(db, "patients", patientId, "evolutions");
        const evolutionsSnapshot = await getDocs(evolutionsRef);
        return evolutionsSnapshot.size;
    } catch (error) {
        console.error("Error obteniendo conteo de evoluciones: ", error);
        return 0;
    }
}

// Upload file to Firebase Storage
async function uploadFile(file, patientId, folder) {
    try {
        const fileRef = ref(storage, `patients/${patientId}/${folder}/${file.name}`);
        await uploadBytes(fileRef, file);
        const downloadURL = await getDownloadURL(fileRef);
        return downloadURL;
    } catch (error) {
        console.error("Error subiendo archivo: ", error);
        showToast("Error al subir archivo: " + error.message, "error");
        return null;
    }
}


        // Render patients in the main patient list
function renderPatients(patients) {
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

// Calculate patient progress
function calculatePatientProgress(patient) {
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

// Get status class based on progress
function getStatusClass(progress) {
    if (progress >= 80) return 'status-active';
    if (progress >= 30) return 'status-pending';
    return 'status-inactive';
}

// Get initials from name
function getInitials(name) {
    if (!name) return 'NA';
    
    // Dividir por espacios y tomar la primera letra de cada palabra
    const parts = name.split(' ');
    if (parts.length >= 2) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    
    // Si solo hay una palabra, tomar las dos primeras letras
    return name.substring(0, 2).toUpperCase();
}

// Renderizar pacientes en una vista específica
function renderPatientsInView(containerId, patients) {
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
async function selectPatient(patientId) {
    try {
        // Actualizar ID del paciente actual
        currentPatientId = patientId;
        
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
async function openPatientModal(patientId) {
    try {
        // Quitar selección anterior
        document.querySelectorAll('.patient-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        // Añadir selección al paciente actual
        document.querySelectorAll('.patient-card[data-id="' + patientId + '"]').forEach(card => {
            card.classList.add('selected');
        });
        
        currentPatientId = patientId;
        
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
        
        // Cargar archivos del paciente (explícitamente con el ID correcto)
        loadPatientFiles(patientId);
        
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
function fillPersonalData(patient) {
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
        // Cargar archivos del paciente si existen
        loadPatientFiles(patient.id);
    } catch (error) {
        console.error("Error llenando datos personales:", error);
        showToast("Error al cargar datos personales", "error");
    }
}

// Fill evolutions tab
function fillEvolutionsTab(evolutions) {
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
            evolutionItem.dataset.id = evolution.id;
            
            const formattedDate = formatDate(new Date(evolution.date));
            const formattedTime = evolution.time || '10:00';
            
            // Añadir botones de acción
            const actionButtons = `
                <div class="evolution-actions" style="margin-left: 10px; display: flex; gap: 5px;">
                    <button class="action-btn btn-secondary edit-evolution-btn" style="padding: 3px 8px; font-size: 12px;">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button class="action-btn btn-secondary delete-evolution-btn" style="padding: 3px 8px; font-size: 12px; background-color: var(--accent2-light);">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            evolutionItem.innerHTML = `
                <div class="evolution-dot">
                    <i class="fas fa-clipboard-check"></i>
                </div>
                <div class="evolution-content">
                    <div class="evolution-header" style="display: flex; align-items: center; justify-content: space-between;">
                        <div style="display: flex; align-items: center;">
                            <div class="evolution-date">
                                <i class="far fa-calendar-alt"></i>
                                ${formattedDate} - ${formattedTime}
                            </div>
                        </div>
                        ${actionButtons}
                    </div>
                    <div class="evolution-student">Realizado por: ${evolution.student || 'No registrado'}</div>
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
            
            // Añadir event listeners a los botones
            const editBtn = evolutionItem.querySelector('.edit-evolution-btn');
            const deleteBtn = evolutionItem.querySelector('.delete-evolution-btn');
            
            if (editBtn) {
                editBtn.addEventListener('click', function(e) {
                    e.stopPropagation(); // Evitar propagación del evento
                    editEvolution(currentPatientId, evolution);
                });
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', function(e) {
                    e.stopPropagation(); // Evitar propagación del evento
                    deleteEvolution(currentPatientId, evolution.id);
                });
            }
        });
    } catch (error) {
        console.error("Error llenando pestaña de evoluciones:", error);
        showToast("Error al cargar evoluciones: " + error.message, "error");
    }
}

// Función mejorada para renderizar ejercicios con tooltips y 2 columnas
function renderExercises(exercises) {
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
                    <div class="tooltip-container" style="display: inline-block;">
                        <span class="intensity-badge ${intensityClass}">
                            ${effortStr}
                        </span>
                        <div class="tooltip-content" style="width: 280px; left: -120px; top: 25px;">
                            ${exercise.effortType === 'RIR' ? `
                                <p><strong>RIR: Repeticiones en Reserva</strong></p>
                                <p>0 = No podría realizar ni una repetición más (fallo muscular)</p>
                                <p>1 = Podría realizar 1 repetición más</p>
                                <p>2 = Podría realizar 2 repeticiones más</p>
                                <p>3 = Podría realizar 3 repeticiones más</p>
                                <p>4 = Podría realizar 4 repeticiones más</p>
                                <p>5+ = Podría realizar 5 o más repeticiones adicionales</p>
                            ` : `
                                <p><strong>RPE: Rating of Perceived Exertion (0-10)</strong></p>
                                <p>0 = Reposo absoluto</p>
                                <p>1 = Esfuerzo muy, muy ligero</p>
                                <p>2 = Esfuerzo muy ligero</p>
                                <p>3 = Esfuerzo ligero</p>
                                <p>4 = Esfuerzo moderado</p>
                                <p>5 = Esfuerzo algo duro</p>
                                <p>6 = Esfuerzo duro</p>
                                <p>7-8 = Esfuerzo muy duro</p>
                                <p>9 = Esfuerzo extremadamente duro</p>
                                <p>10 = Esfuerzo máximo (imposible continuar)</p>
                            `}
                        </div>
                    </div>
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
    
    // Añadir función global para alternar entre vistas
    if (typeof window.toggleExerciseView !== 'function') {
        window.toggleExerciseView = function(button) {
            const currentView = button.getAttribute('data-view');
            const columnView = button.closest('.evolution-section').querySelector('.exercise-two-columns');
            const tableView = button.closest('.evolution-section').querySelector('.exercise-table-view');
            
            if (currentView === 'column') {
                // Cambiar a vista de tabla
                columnView.style.display = 'none';
                tableView.style.display = 'block';
            } else {
                // Cambiar a vista de columnas
                columnView.style.display = 'grid';
                tableView.style.display = 'none';
            }
        };
    }
    
    return exercisesHTML;
}

// Obtener clase CSS según intensidad
function getIntensityClass(intensity) {
    switch(intensity) {
        case 'Baja': return 'intensity-low';
        case 'Media': return 'intensity-medium';
        case 'Alta': return 'intensity-high';
        default: return 'intensity-medium';
    }
}

// Render scales
function renderScales(scales) {
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

// Función mejorada para mostrar archivos adjuntos
// Función mejorada para mostrar archivos adjuntos
function renderAttachments(attachments) {
    try {
        // Si no hay adjuntos, devolver un mensaje vacío o de "no hay adjuntos"
        if (!attachments || attachments.length === 0) {
            return '<div class="evolution-section">No hay archivos adjuntos</div>';
        }
        
        let attachmentsHTML = `
            <div class="evolution-section">
                <div class="evolution-section-title">Archivos adjuntos</div>
                <div class="attachments-table-container" style="margin-top: 10px; overflow-x: auto;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr>
                                <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border);">Archivo</th>
                                <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border);">Tipo</th>
                                <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border);">Fecha</th>
                                <th style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border);">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        attachments.forEach(attachment => {
            const isImage = attachment.type === 'image';
            const isPDF = attachment.name && attachment.name.toLowerCase().endsWith('.pdf');
            
            // Determinar icono según tipo de archivo
            let fileIcon = '<i class="fas fa-file" style="color: #3498db;"></i>';
            if (isImage) {
                fileIcon = '<i class="fas fa-image" style="color: #2ecc71;"></i>';
            } else if (isPDF) {
                fileIcon = '<i class="fas fa-file-pdf" style="color: #e74c3c;"></i>';
            }
            
            // Formatear fecha si existe
            const uploadDate = attachment.uploadDate ? formatDate(new Date(attachment.uploadDate)) : 'No disponible';
            
            attachmentsHTML += `
                <tr style="border-bottom: 1px solid var(--border-light);">
                    <td style="padding: 8px;">${fileIcon} ${attachment.name || 'Archivo sin nombre'}</td>
                    <td style="padding: 8px;">${isImage ? 'Imagen' : (isPDF ? 'PDF' : 'Documento')}</td>
                    <td style="padding: 8px;">${uploadDate}</td>
                    <td style="padding: 8px; text-align: right;">
                        <a href="${attachment.url}" target="_blank" title="Ver" class="file-action-btn">
                            <i class="fas fa-eye"></i>
                        </a>
                        <a href="${attachment.url}" download="${attachment.name}" title="Descargar" class="file-action-btn">
                            <i class="fas fa-download"></i>
                        </a>
                    </td>
                </tr>
            `;
        });
        
        attachmentsHTML += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
        
        return attachmentsHTML;
    } catch (error) {
        console.error("Error renderizando adjuntos:", error);
        return '<div class="evolution-section">Error al renderizar adjuntos</div>';
    }
}

// Initialize diagnosis tab
async function initDiagnosisTab(patientId) {
    try {
        // Cargar diagnósticos y CIF del paciente
        const diagnosisTimeline = document.getElementById('diagnosisTimeline');
        if (diagnosisTimeline) {
            diagnosisTimeline.innerHTML = '<p>Cargando diagnósticos...</p>';
            
            // Consultar diagnósticos del paciente
            const diagnoses = await getDiagnoses(patientId);
            
            if (diagnoses.length === 0) {
                diagnosisTimeline.innerHTML = `
                    <p>No hay diagnósticos registrados para este paciente.</p>
                `;
            } else {
                diagnosisTimeline.innerHTML = '';
                
                diagnoses.forEach(diagnosis => {
                const diagnosisItem = document.createElement('div');
                diagnosisItem.className = 'timeline-item fade-in';
                diagnosisItem.dataset.id = diagnosis.id;
                
                const formattedDate = formatDate(new Date(diagnosis.date));
                
                diagnosisItem.innerHTML = `
                    <div class="timeline-dot">
                        <i class="fas fa-file-medical"></i>
                    </div>
                    <div class="timeline-content">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div class="timeline-date">Evaluación - ${formattedDate}</div>
                            <div class="timeline-actions">
                                <button class="action-btn btn-secondary view-diagnosis-btn" style="padding: 3px 8px; margin-right: 5px; font-size: 12px;">
                                    <i class="fas fa-eye"></i> Ver
                                </button>
                                <button class="action-btn btn-secondary edit-diagnosis-btn" style="padding: 3px 8px; margin-right: 5px; font-size: 12px;">
                                    <i class="fas fa-edit"></i> Editar
                                </button>
                                <button class="action-btn btn-secondary delete-diagnosis-btn" style="padding: 3px 8px; font-size: 12px; background-color: var(--accent2-light);">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </div>
                        </div>
                        <h3 class="timeline-title">${diagnosis.code || 'Sin código CIE'}</h3>
                        <p>${diagnosis.description || 'Sin descripción'}</p>
                    </div>
                `;
                
                diagnosisTimeline.appendChild(diagnosisItem);
                
                // Añadir event listeners para los botones
                const viewBtn = diagnosisItem.querySelector('.view-diagnosis-btn');
                const editBtn = diagnosisItem.querySelector('.edit-diagnosis-btn');
                const deleteBtn = diagnosisItem.querySelector('.delete-diagnosis-btn');
                
                if (viewBtn) {
                    viewBtn.addEventListener('click', function() {
                        viewDiagnosis(patientId, diagnosis.id);
                    });
                }
                
                if (editBtn) {
                    editBtn.addEventListener('click', function() {
                        openDiagnosisModal(patientId, diagnosis);
                    });
                }
                
                if (deleteBtn) {
                    deleteBtn.addEventListener('click', function() {
                        deleteDiagnosis(patientId, diagnosis.id);
                    });
                }
            });
            }
        }

        // Cargar planes de tratamiento existentes
        await loadTreatmentPlans(patientId);



        
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
        await setupCifCategories(patientId);
        
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

// Obtener diagnósticos del paciente
async function getDiagnoses(patientId) {
    try {
        showLoading();
        
        // Obtener diagnósticos de Firebase
        const diagnosesRef = collection(db, "patients", patientId, "diagnoses");
        const diagnosesQuery = query(diagnosesRef, orderBy("createdAt", "desc"));
        const diagnosesSnapshot = await getDocs(diagnosesQuery);
        
        const diagnosesList = diagnosesSnapshot.docs.map(doc => {
            return { id: doc.id, ...doc.data() };
        });
        
        hideLoading();
        return diagnosesList;
    } catch (error) {
        console.error("Error obteniendo diagnósticos:", error);
        hideLoading();
        return [];
    }
}

// Función mejorada para abrir el modal de diagnóstico
// Función mejorada para abrir el modal de diagnóstico (con soporte para edición)
function openDiagnosisModal(patientId, existingDiagnosis = null) {
    // Determinar si es edición o nuevo diagnóstico
    const isEditing = existingDiagnosis !== null;
    
    // Crear modal de diagnóstico
    const diagnosisModal = document.createElement('div');
    diagnosisModal.className = 'modal-overlay';
    diagnosisModal.id = 'diagnosisFormModal';
    
    diagnosisModal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">${isEditing ? 'Editar diagnóstico kinesiológico' : 'Nuevo diagnóstico kinesiológico'}</h2>
                <button class="modal-close" id="closeDiagnosisModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <form id="diagnosisForm">
                    <div class="form-group">
                        <label class="form-label">Fecha de evaluación</label>
                        <input type="date" class="form-control" id="diagnosisDate" value="${isEditing ? existingDiagnosis.date : new Date().toISOString().split('T')[0]}" required>
                    </div>
                    
                    <div class="accordion active">
                        <div class="accordion-header">
                            <span>Información médica</span>
                            <i class="fas fa-chevron-down accordion-icon"></i>
                        </div>
                        <div class="accordion-body">
                            <div class="form-group">
                                <label class="form-label">Diagnóstico médico</label>
                                <input type="text" class="form-control" id="diagnosisCIE" value="${isEditing ? existingDiagnosis.code || '' : ''}" placeholder="Ej: Lumbago, Cervicalgia, Tendinitis, etc." required>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Motivo de consulta</label>
                                <textarea class="form-control" id="consultReason" rows="2" placeholder="Descripción del motivo por el que el paciente acude a kinesiología">${isEditing ? existingDiagnosis.consultReason || '' : ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Antecedentes relevantes</label>
                                <textarea class="form-control" id="medicalBackground" rows="2" placeholder="Antecedentes médicos relevantes para el caso">${isEditing ? existingDiagnosis.medicalBackground || '' : ''}</textarea>
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
                                <textarea class="form-control" id="diagnosisText" rows="5" placeholder="Ingrese el diagnóstico kinesiológico detallado en términos de limitación funcional, restricción de participación y alteraciones estructurales según el modelo CIF" required>${isEditing ? existingDiagnosis.description || '' : ''}</textarea>
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
                        <button type="submit" class="action-btn btn-primary">
                            ${isEditing ? 'Actualizar diagnóstico' : 'Guardar diagnóstico'}
                        </button>
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
            updatedAt: new Date().toISOString()
        };
        
        // Si no estamos editando, añadir campo createdAt
        if (!isEditing) {
            diagnosisData.createdAt = new Date().toISOString();
        }

        // Mostrar loading mientras se guarda
        showLoading();

        try {
            if (isEditing) {
                // Actualizar diagnóstico existente
                const diagnosisRef = doc(db, "patients", patientId, "diagnoses", existingDiagnosis.id);
                updateDoc(diagnosisRef, diagnosisData)
                    .then(() => {
                        hideLoading();
                        
                        // Actualizar la entrada en la línea de tiempo (interfaz visual)
                        const diagnosisItem = document.querySelector(`.timeline-item[data-id="${existingDiagnosis.id}"]`);
                        if (diagnosisItem) {
                            const titleElement = diagnosisItem.querySelector('.timeline-title');
                            const descElement = diagnosisItem.querySelector('.timeline-content p');
                            
                            if (titleElement) titleElement.textContent = diagnosisCIE;
                            if (descElement) descElement.textContent = diagnosisText;
                        }
                        
                        // Mostrar mensaje de éxito
                        showToast("Diagnóstico actualizado correctamente", "success");
                        
                        // Cerrar modal
                        diagnosisModal.classList.remove('active');
                        setTimeout(() => {
                            if (document.body.contains(diagnosisModal)) {
                                document.body.removeChild(diagnosisModal);
                            }
                        }, 300);
                    })
                    .catch(error => {
                        hideLoading();
                        console.error("Error al actualizar diagnóstico:", error);
                        showToast("Error al actualizar diagnóstico: " + error.message, "error");
                    });
            } else {
                // Guardar nuevo diagnóstico
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
                            
                            // Crear nuevo elemento con el mismo formato que usamos en initDiagnosisTab
                            const newDiagnosis = document.createElement('div');
                            newDiagnosis.className = 'timeline-item fade-in';
                            newDiagnosis.dataset.id = docRef.id;
                            
                            newDiagnosis.innerHTML = `
                                <div class="timeline-dot">
                                    <i class="fas fa-file-medical"></i>
                                </div>
                                <div class="timeline-content">
                                    <div style="display: flex; justify-content: space-between; align-items: center;">
                                        <div class="timeline-date">Evaluación - ${formatDate(new Date(diagnosisDate))}</div>
                                        <div class="timeline-actions">
                                            <button class="action-btn btn-secondary view-diagnosis-btn" style="padding: 3px 8px; margin-right: 5px; font-size: 12px;">
                                                <i class="fas fa-eye"></i> Ver
                                            </button>
                                            <button class="action-btn btn-secondary edit-diagnosis-btn" style="padding: 3px 8px; margin-right: 5px; font-size: 12px;">
                                                <i class="fas fa-edit"></i> Editar
                                            </button>
                                            <button class="action-btn btn-secondary delete-diagnosis-btn" style="padding: 3px 8px; font-size: 12px; background-color: var(--accent2-light);">
                                                <i class="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <h3 class="timeline-title">${diagnosisCIE}</h3>
                                    <p>${diagnosisText}</p>
                                </div>
                            `;
                            
                            // Añadir event listeners para los botones
                            const fullDiagnosis = {
                                id: docRef.id,
                                ...diagnosisData
                            };
                            
                            const viewBtn = newDiagnosis.querySelector('.view-diagnosis-btn');
                            const editBtn = newDiagnosis.querySelector('.edit-diagnosis-btn');
                            const deleteBtn = newDiagnosis.querySelector('.delete-diagnosis-btn');
                            
                            if (viewBtn) {
                                viewBtn.addEventListener('click', function() {
                                    viewDiagnosis(patientId, docRef.id);
                                });
                            }
                            
                            if (editBtn) {
                                editBtn.addEventListener('click', function() {
                                    openDiagnosisModal(patientId, fullDiagnosis);
                                });
                            }
                            
                            if (deleteBtn) {
                                deleteBtn.addEventListener('click', function() {
                                    deleteDiagnosis(patientId, docRef.id);
                                });
                            }
                            
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
                                if (diagnosisModal && document.body.contains(diagnosisModal)) {
                                    try {
                                        document.body.removeChild(diagnosisModal);
                                    } catch (e) {
                                        console.log("Modal ya eliminado, ignorando operación");
                                        diagnosisModal.style.display = 'none';
                                    }
                                }
                            }, 300);
                        } catch (error) {
                            console.error("Error al cerrar modal:", error);
                            // En caso de error, intentar ocultar el modal
                            if (diagnosisModal) diagnosisModal.style.display = 'none';
                        }
                    })
                    .catch(error => {
                        hideLoading();
                        console.error("Error al guardar diagnóstico:", error);
                        showToast("Error al guardar diagnóstico: " + error.message, "error");
                    });
            }
        } catch (error) {
            hideLoading();
            console.error("Error al guardar diagnóstico:", error);
            showToast("Error al guardar diagnóstico: " + error.message, "error");
        }
    });
}

        // Función para eliminar un diagnóstico
async function deleteDiagnosis(patientId, diagnosisId) {
    if (!patientId || !diagnosisId) {
        showToast("Error: ID de paciente o diagnóstico no válido", "error");
        return false;
    }
    
    // Pedir confirmación antes de eliminar
    if (!confirm("¿Está seguro que desea eliminar este diagnóstico kinesiológico?\nEsta acción no se puede deshacer.")) {
        return false;
    }
    
    try {
        showLoading();
        
        // Referencia al documento del diagnóstico
        const diagnosisRef = doc(db, "patients", patientId, "diagnoses", diagnosisId);
        
        // Eliminar el diagnóstico
        await deleteDoc(diagnosisRef);
        
        // Eliminar visualmente de la interfaz
        const diagnosisItem = document.querySelector(`.timeline-item[data-id="${diagnosisId}"]`);
        if (diagnosisItem && diagnosisItem.parentNode) {
            diagnosisItem.parentNode.removeChild(diagnosisItem);
        }
        
        hideLoading();
        showToast("Diagnóstico eliminado correctamente", "success");
        
        // Verificar si no quedan diagnósticos
        const diagnosisTimeline = document.getElementById('diagnosisTimeline');
        if (diagnosisTimeline && diagnosisTimeline.children.length === 0) {
            diagnosisTimeline.innerHTML = `
                <p>No hay diagnósticos registrados para este paciente.</p>
            `;
        }
        
        return true;
    } catch (error) {
        console.error("Error eliminando diagnóstico:", error);
        hideLoading();
        showToast("Error al eliminar diagnóstico: " + error.message, "error");
        return false;
    }
}


        // Función para ver el diagnóstico completo
async function viewDiagnosis(patientId, diagnosisId) {
    try {
        showLoading();
        
        // Obtener el diagnóstico de Firebase
        const diagnosisRef = doc(db, "patients", patientId, "diagnoses", diagnosisId);
        const diagnosisSnap = await getDoc(diagnosisRef);
        
        if (!diagnosisSnap.exists()) {
            hideLoading();
            showToast("Error: Diagnóstico no encontrado", "error");
            return;
        }
        
        const diagnosis = { id: diagnosisSnap.id, ...diagnosisSnap.data() };
        
        // Crear modal para mostrar diagnóstico
        const diagnosisViewModal = document.createElement('div');
        diagnosisViewModal.className = 'modal-overlay';
        diagnosisViewModal.id = 'diagnosisViewModal';
        
        const formattedDate = formatDate(new Date(diagnosis.date));
        
        diagnosisViewModal.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <h2 class="modal-title">Diagnóstico Kinesiológico - ${formattedDate}</h2>
                    <button class="modal-close" id="closeDiagnosisViewModal">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
                <div class="modal-body">
                    <div class="form-group">
                        <label class="form-label">Fecha de evaluación</label>
                        <input type="text" class="form-control" value="${formattedDate}" readonly>
                    </div>
                    
                    <div class="accordion active">
                        <div class="accordion-header">
                            <span>Información médica</span>
                            <i class="fas fa-chevron-down accordion-icon"></i>
                        </div>
                        <div class="accordion-body">
                            <div class="form-group">
                                <label class="form-label">Diagnóstico médico</label>
                                <input type="text" class="form-control" value="${diagnosis.code || ''}" readonly>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Motivo de consulta</label>
                                <textarea class="form-control" rows="2" readonly>${diagnosis.consultReason || ''}</textarea>
                            </div>
                            
                            <div class="form-group">
                                <label class="form-label">Antecedentes relevantes</label>
                                <textarea class="form-control" rows="2" readonly>${diagnosis.medicalBackground || ''}</textarea>
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
                                <label class="form-label">Descripción funcional</label>
                                <textarea class="form-control" rows="6" readonly>${diagnosis.description || ''}</textarea>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group" style="margin-top: 20px; text-align: right;">
                        <button type="button" class="action-btn btn-secondary" id="closeViewBtn">Cerrar</button>
                        <button type="button" class="action-btn btn-primary" id="editFromViewBtn">
                            <i class="fas fa-edit"></i> Editar diagnóstico
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(diagnosisViewModal);
        hideLoading();
        
        setTimeout(() => diagnosisViewModal.classList.add('active'), 50);
        
        // Configurar eventos para acordeones
        diagnosisViewModal.querySelectorAll('.accordion-header').forEach(header => {
            header.addEventListener('click', function() {
                this.parentElement.classList.toggle('active');
            });
        });
        
        // Configurar evento para cerrar modal
        document.getElementById('closeDiagnosisViewModal').addEventListener('click', function() {
            diagnosisViewModal.classList.remove('active');
            setTimeout(() => document.body.removeChild(diagnosisViewModal), 300);
        });
        
        document.getElementById('closeViewBtn').addEventListener('click', function() {
            diagnosisViewModal.classList.remove('active');
            setTimeout(() => document.body.removeChild(diagnosisViewModal), 300);
        });
        
        // Configurar evento para editar desde la vista
        document.getElementById('editFromViewBtn').addEventListener('click', function() {
            diagnosisViewModal.classList.remove('active');
            setTimeout(() => {
                document.body.removeChild(diagnosisViewModal);
                openDiagnosisModal(patientId, diagnosis);
            }, 300);
        });
        
    } catch (error) {
        console.error("Error al mostrar diagnóstico:", error);
        hideLoading();
        showToast("Error al mostrar diagnóstico: " + error.message, "error");
    }
}

        

// Función para generar diagnóstico funcional basado en las selecciones del asistente
function generateFunctionalDiagnosis() {
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
    
 


// Abrir modal de objetivo general
function openGeneralObjectiveModal(patientId) {
    try {
        // Mostrar modal
        const modal = document.getElementById('generalObjectiveModal');
        if (!modal) {
            console.error("Modal de objetivo general no encontrado");
            return;
        }
        
        // Mostrar modal
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('active'), 50);
        
        // Establecer fecha actual para el campo de fecha
        const today = new Date();
        const endDate = new Date();
        endDate.setMonth(today.getMonth() + 3); // Fecha estimada por defecto: 3 meses después
        
        // Convertir a formato YYYY-MM-DD para input type="date"
        const endDateStr = endDate.toISOString().split('T')[0];
        
        const endDateInput = document.getElementById('generalObjectiveEndDateInput');
        if (endDateInput) endDateInput.value = endDateStr;
        
        // Limpiar campo de descripción
        const descInput = document.getElementById('generalObjectiveDescInput');
        if (descInput) descInput.value = '';
        
        // Cargar objetivo general existente si hay
        loadGeneralObjective(patientId);
        
        // Configurar eventos de botones
        const saveBtn = document.getElementById('saveGeneralObjectiveBtn');
        if (saveBtn) {
            // Eliminar manejadores previos
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.addEventListener('click', function() {
                saveGeneralObjective(patientId);
            });
        }
        
        const cancelBtn = document.getElementById('cancelGeneralObjectiveBtn');
        if (cancelBtn) {
            // Eliminar manejadores previos
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            newCancelBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
        
        const closeBtn = document.getElementById('closeGeneralObjectiveModal');
        if (closeBtn) {
            // Eliminar manejadores previos
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            newCloseBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
        
        // Configurar botones de plantillas SMART
        const templateBtns = document.querySelectorAll('.smart-template-btn');
        templateBtns.forEach(btn => {
            // Eliminar manejadores previos
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', function() {
                const template = this.getAttribute('data-template');
                if (template) {
                    showGeneralObjectiveAssistant(template);
                }
            });
        });
        
        // Configurar evento para botón de cancelar asistente
        const cancelAssistantBtn = document.getElementById('cancelAssistantBtn');
        if (cancelAssistantBtn) {
            // Eliminar manejadores previos
            const newCancelAssistantBtn = cancelAssistantBtn.cloneNode(true);
            cancelAssistantBtn.parentNode.replaceChild(newCancelAssistantBtn, cancelAssistantBtn);
            
            newCancelAssistantBtn.addEventListener('click', function() {
                const assistantPanel = document.getElementById('generalObjectiveAssistant');
                if (assistantPanel) assistantPanel.style.display = 'none';
            });
        }
        
        // Configurar evento para usar resultado del asistente
        const useResultBtn = document.getElementById('useAssistantResultBtn');
        if (useResultBtn) {
            // Eliminar manejadores previos
            const newUseResultBtn = useResultBtn.cloneNode(true);
            useResultBtn.parentNode.replaceChild(newUseResultBtn, useResultBtn);
            
            newUseResultBtn.addEventListener('click', function() {
                const preview = document.getElementById('objectivePreview');
                const descInput = document.getElementById('generalObjectiveDescInput');
                
                if (preview && descInput) {
                    descInput.value = preview.textContent;
                    
                    // Actualizar fecha estimada basada en el plazo del asistente
                    const timeFrame = parseInt(document.getElementById('timeFrameInput')?.value || 4);
                    const timeUnit = document.getElementById('timeUnitSelect')?.value || 'semanas';
                    
                    const endDate = new Date();
                    if (timeUnit === 'semanas') {
                        endDate.setDate(endDate.getDate() + timeFrame * 7);
                    } else {
                        endDate.setMonth(endDate.getMonth() + timeFrame);
                    }
                    
                    const endDateInput = document.getElementById('generalObjectiveEndDateInput');
                    if (endDateInput) endDateInput.value = endDate.toISOString().split('T')[0];
                    
                    // Ocultar panel del asistente
                    const assistantPanel = document.getElementById('generalObjectiveAssistant');
                    if (assistantPanel) assistantPanel.style.display = 'none';
                }
            });
        }
        
        // Configurar eventos para previsualización en tiempo real
        configureGeneralObjectivePreview();
        
    } catch (error) {
        console.error("Error al abrir modal de objetivo general:", error);
        showToast("Error al abrir formulario de objetivo", "error");
    }
}

// Cargar objetivo general existente
async function loadGeneralObjective(patientId) {
    try {
        // Verificar si ya tenemos el objetivo en caché
        if (objectivesCache[patientId] && objectivesCache[patientId].general) {
            fillGeneralObjectiveForm(objectivesCache[patientId].general);
            return;
        }
        
        // Obtener de Firebase
        const objectiveRef = doc(db, "patients", patientId, "objectives", "general");
        const objectiveSnap = await getDoc(objectiveRef);
        
        if (objectiveSnap.exists()) {
            const generalObjective = objectiveSnap.data();
            
            // Guardar en caché
            if (!objectivesCache[patientId]) objectivesCache[patientId] = {};
            objectivesCache[patientId].general = generalObjective;
            
            // Llenar formulario
            fillGeneralObjectiveForm(generalObjective);
        }
    } catch (error) {
        console.error("Error al cargar objetivo general:", error);
    }
}

// Llenar formulario de objetivo general
function fillGeneralObjectiveForm(objective) {
    if (!objective) return;
    
    const descInput = document.getElementById('generalObjectiveDescInput');
    const endDateInput = document.getElementById('generalObjectiveEndDateInput');
    
    if (descInput) descInput.value = objective.description || '';
    if (endDateInput && objective.endDate) endDateInput.value = objective.endDate;
}

// Configurar previsualización de objetivo general
function configureGeneralObjectivePreview() {
    // Obtener elementos del asistente
    const mainGoalSelect = document.getElementById('mainGoalSelect');
    const functionalAspectSelect = document.getElementById('functionalAspectSelect');
    const bodyAreaInput = document.getElementById('bodyAreaInput');
    const participationSelect = document.getElementById('participationSelect');
    const timeFrameInput = document.getElementById('timeFrameInput');
    const timeUnitSelect = document.getElementById('timeUnitSelect');
    const previewElement = document.getElementById('objectivePreview');
    
    // Función para actualizar vista previa
    function updateObjectivePreview() {
        if (!previewElement) return;
        
        const action = mainGoalSelect?.value || 'Mejorar';
        const functionalAspect = functionalAspectSelect?.value || 'la capacidad funcional';
        const bodyArea = bodyAreaInput?.value?.trim() || '';
        const participation = participationSelect?.value || 'para la realización autónoma de actividades de la vida diaria';
        const timeFrame = timeFrameInput?.value || '4';
        const timeUnit = timeUnitSelect?.value || 'semanas';
        
        let previewText = `${action} ${functionalAspect}`;
        
        if (bodyArea) {
            previewText += ` ${bodyArea}`;
        }
        
        previewText += ` ${participation} en un plazo de ${timeFrame} ${timeUnit}.`;
        
        previewElement.textContent = previewText;
    }
    
    // Configurar eventos para actualización en tiempo real
    const inputs = [mainGoalSelect, functionalAspectSelect, participationSelect, timeFrameInput, timeUnitSelect];
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('change', updateObjectivePreview);
        }
    });
    
    if (bodyAreaInput) {
        bodyAreaInput.addEventListener('input', updateObjectivePreview);
    }
    
    // Añadir la función al objeto window para que esté disponible globalmente
    window.updateObjectivePreview = updateObjectivePreview;
    
    // Actualización inicial
    updateObjectivePreview();
}

// Mostrar asistente de objetivo general
function showGeneralObjectiveAssistant(template) {
    const assistantPanel = document.getElementById('generalObjectiveAssistant');
    if (!assistantPanel) return;
    
    // Mostrar panel
    assistantPanel.style.display = 'block';
    
    // Configurar valores según la plantilla
    const mainGoalSelect = document.getElementById('mainGoalSelect');
    const functionalAspectSelect = document.getElementById('functionalAspectSelect');
    const bodyAreaInput = document.getElementById('bodyAreaInput');
    const participationSelect = document.getElementById('participationSelect');
    const timeFrameInput = document.getElementById('timeFrameInput');
    const timeUnitSelect = document.getElementById('timeUnitSelect');
    
    // Valores predeterminados según especialidad
    switch(template) {
        case 'msq-general': // Musculoesquelético
            if (mainGoalSelect) mainGoalSelect.value = 'Recuperar';
            if (functionalAspectSelect) functionalAspectSelect.value = 'la capacidad funcional';
            if (bodyAreaInput) bodyAreaInput.value = 'del hombro';
            if (participationSelect) participationSelect.value = 'para la realización autónoma de actividades de la vida diaria';
            if (timeFrameInput) timeFrameInput.value = '4';
            if (timeUnitSelect) timeUnitSelect.value = 'semanas';
            break;
        case 'deportiva-general': // Deportiva
            if (mainGoalSelect) mainGoalSelect.value = 'Optimizar';
            if (functionalAspectSelect) functionalAspectSelect.value = 'la capacidad de carga progresiva';
            if (bodyAreaInput) bodyAreaInput.value = '';
            if (participationSelect) participationSelect.value = 'para el retorno seguro a la práctica deportiva';
            if (timeFrameInput) timeFrameInput.value = '6';
            if (timeUnitSelect) timeUnitSelect.value = 'semanas';
            break;
        case 'geriatria-general': // Geriatría
            if (mainGoalSelect) mainGoalSelect.value = 'Mejorar';
            if (functionalAspectSelect) functionalAspectSelect.value = 'la estabilidad postural durante transferencias y giros';
            if (bodyAreaInput) bodyAreaInput.value = '';
            if (participationSelect) participationSelect.value = 'para la movilidad segura e independiente dentro del hogar';
            if (timeFrameInput) timeFrameInput.value = '2';
            if (timeUnitSelect) timeUnitSelect.value = 'meses';
            break;
        case 'piso-pelvico-general': // Piso pélvico
            if (mainGoalSelect) mainGoalSelect.value = 'Restaurar';
            if (functionalAspectSelect) functionalAspectSelect.value = 'la función de soporte y continencia activa del piso pélvico';
            if (bodyAreaInput) bodyAreaInput.value = '';
            if (participationSelect) participationSelect.value = 'para la participación en actividades deportivas sin escapes de orina';
            if (timeFrameInput) timeFrameInput.value = '6';
            if (timeUnitSelect) timeUnitSelect.value = 'semanas';
            break;
    }
    
    // Actualizar vista previa
    updateObjectivePreview();
}

// Guardar objetivo general
async function saveGeneralObjective(patientId) {
    try {
        // Verificar que hay un paciente seleccionado
        if (!patientId) {
            showToast("Error: No hay paciente seleccionado", "error");
            return;
        }
        
        // Obtener valores del formulario
        const description = document.getElementById('generalObjectiveDescInput')?.value;
        const endDate = document.getElementById('generalObjectiveEndDateInput')?.value;
        
        if (!description) {
            showToast("La descripción del objetivo es obligatoria", "error");
            return;
        }
        
        showLoading();
        
        // Crear objeto con los datos
        const objectiveData = {
            description: description,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            endDate: endDate,
            progress: 0
        };
        
        // Guardar en Firebase
        const objectiveRef = doc(db, "patients", patientId, "objectives", "general");
        await setDoc(objectiveRef, objectiveData);
        
        // Actualizar caché
        if (!objectivesCache[patientId]) objectivesCache[patientId] = {};
        objectivesCache[patientId].general = objectiveData;
        
        // Actualizar UI
        updateObjectivesUI(patientId);
        
        // Cerrar modal
        const modal = document.getElementById('generalObjectiveModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        
        hideLoading();
        showToast("Objetivo general guardado correctamente", "success");
    } catch (error) {
        hideLoading();
        console.error("Error al guardar objetivo general:", error);
        showToast("Error al guardar objetivo: " + error.message, "error");
    }
}

// Abrir modal de objetivo específico
function openSpecificObjectiveModal(patientId, objectiveId = null) {
    try {
        // Guardar referencia del ID del objetivo si se está editando
        currentObjectiveId = objectiveId;
        
        // Mostrar modal
        const modal = document.getElementById('specificObjectiveModal');
        if (!modal) {
            console.error("Modal de objetivo específico no encontrado");
            return;
        }
        
        // Resetear formulario
        resetSpecificObjectiveForm();
        
        // Mostrar modal
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('active'), 50);

        // Generar un ejemplo predeterminado en la vista previa
        const previewElement = document.getElementById('specificObjectivePreview');
        if (previewElement) {
            const defaultExample = "Aumentar la fuerza de abductores de hombro derecho de 3/5 a 4/5 en escala de Daniels en 2 semanas.";
            previewElement.textContent = defaultExample;
        }
        
        // Si es edición, cargar los datos del objetivo
        if (objectiveId) {
            loadSpecificObjective(patientId, objectiveId);
            
            // Cambiar título del modal
            const modalTitle = modal.querySelector('.modal-title');
            if (modalTitle) modalTitle.textContent = "Editar Objetivo Terapéutico Específico";
        } else {
            // Es un nuevo objetivo, establecer fecha actual
            const today = new Date();
            
            // Establecer duración predeterminada: 2 semanas
            const endDate = new Date();
            endDate.setDate(today.getDate() + 14);
            
            // Calcular fecha automáticamente al cambiar la duración
            const durationInput = document.getElementById('durationInput');
            const durationUnitSelect = document.getElementById('durationUnitSelect');
            
            if (durationInput && durationUnitSelect) {
                const updateEndDate = function() {
                    const duration = parseInt(durationInput.value) || 0;
                    const unit = durationUnitSelect.value;
                    
                    const projectedEndDate = new Date();
                    
                    if (unit === 'semanas') {
                        projectedEndDate.setDate(projectedEndDate.getDate() + (duration * 7));
                    } else {
                        projectedEndDate.setMonth(projectedEndDate.getMonth() + duration);
                    }
                    
                    // No hay un input directo para la fecha final, ya que se calcula automáticamente
                    console.log("Fecha final calculada:", projectedEndDate.toISOString().split('T')[0]);
                };
                
                // Configurar eventos
                durationInput.addEventListener('input', updateEndDate);
                durationUnitSelect.addEventListener('change', updateEndDate);
            }
        }
        
        // Configurar eventos para el parámetro y método de evaluación
        configureParameterEvents();
        
        // Configurar eventos para previsualización en tiempo real
        configureSpecificObjectivePreview();
        
        // Configurar botones
        const saveBtn = document.getElementById('saveSpecificObjectiveBtn');
        const cancelBtn = document.getElementById('cancelSpecificObjectiveBtn');
        const closeBtn = document.getElementById('closeSpecificObjectiveModal');
        
        if (saveBtn) {
            // Eliminar manejadores previos
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.addEventListener('click', function() {
                saveSpecificObjective(patientId);
            });
        }
        
        if (cancelBtn) {
            // Eliminar manejadores previos
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            newCancelBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
        
        if (closeBtn) {
            // Eliminar manejadores previos
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            newCloseBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
    } catch (error) {
        console.error("Error al abrir modal de objetivo específico:", error);
        showToast("Error al abrir formulario de objetivo", "error");
    }
}

// Resetear formulario de objetivo específico
function resetSpecificObjectiveForm() {
    // Limpiar campos del formulario
    const actionVerbSelect = document.getElementById('actionVerbSelect');
    const objectiveCategorySelect = document.getElementById('objectiveCategorySelect');
    const structureInput = document.getElementById('structureInput');
    const parameterSelect = document.getElementById('parameterSelect');
    const evaluationMethodSelect = document.getElementById('evaluationMethodSelect');
    const initialValueInput = document.getElementById('initialValueInput');
    const targetValueInput = document.getElementById('targetValueInput');
    const durationInput = document.getElementById('durationInput');
    const durationUnitSelect = document.getElementById('durationUnitSelect');
    const evaluationFrequencySelect = document.getElementById('evaluationFrequencySelect');
    const specificObjectiveNotes = document.getElementById('specificObjectiveNotes');
    
    // Restablecer valores
    if (actionVerbSelect) actionVerbSelect.value = 'Aumentar';
    if (objectiveCategorySelect) objectiveCategorySelect.value = 'Analítico';
    if (structureInput) structureInput.value = '';
    if (parameterSelect) parameterSelect.value = 'Fuerza muscular';
    // evaluationMethodSelect se actualizará al cambiar parameterSelect
    if (initialValueInput) initialValueInput.value = '';
    if (targetValueInput) targetValueInput.value = '';
    if (durationInput) durationInput.value = '2';
    if (durationUnitSelect) durationUnitSelect.value = 'semanas';
    if (evaluationFrequencySelect) evaluationFrequencySelect.value = 'quincenal';
    if (specificObjectiveNotes) specificObjectiveNotes.value = '';
    
    // Mostrar campo normal del parámetro, ocultar campo personalizado
    const customParameterInput = document.getElementById('customParameterInput');
    if (customParameterInput) customParameterInput.style.display = 'none';
    
    // Mostrar campo normal del método, ocultar campo personalizado
    const customMethodInput = document.getElementById('customMethodInput');
    if (customMethodInput) customMethodInput.style.display = 'none';
    
    // Restablecer ID del objetivo actual
    currentObjectiveId = null;
    
    // Actualizar métodos de evaluación para el parámetro predeterminado
    updateEvaluationMethods('Fuerza muscular');
}

// Configurar eventos para parámetro y método de evaluación
function configureParameterEvents() {
    const parameterSelect = document.getElementById('parameterSelect');
    const customParameterInput = document.getElementById('customParameterInput');
    const evaluationMethodSelect = document.getElementById('evaluationMethodSelect');
    const customMethodInput = document.getElementById('customMethodInput');
    
    if (parameterSelect) {
        // Eliminar manejadores previos
        const newParameterSelect = parameterSelect.cloneNode(true);
        parameterSelect.parentNode.replaceChild(newParameterSelect, parameterSelect);
        
        // Añadir nuevo manejador
        newParameterSelect.addEventListener('change', function() {
            const parameter = this.value;
            
            // Mostrar/ocultar campo personalizado
            if (customParameterInput) {
                customParameterInput.style.display = parameter === 'custom' ? 'block' : 'none';
            }
            
            // Actualizar métodos de evaluación
            updateEvaluationMethods(parameter);
        });
        
        // Disparar evento para inicializar
        newParameterSelect.dispatchEvent(new Event('change'));
    }
    
    if (evaluationMethodSelect) {
        // Eliminar manejadores previos
        const newMethodSelect = evaluationMethodSelect.cloneNode(true);
        evaluationMethodSelect.parentNode.replaceChild(newMethodSelect, evaluationMethodSelect);
        
        // Añadir nuevo manejador
        newMethodSelect.addEventListener('change', function() {
            const method = this.value;
            
            // Mostrar/ocultar campo personalizado
            if (customMethodInput) {
                customMethodInput.style.display = method === 'custom' ? 'block' : 'none';
            }
            
            // Actualizar unidades según el método
            updateUnits(method);
        });
    }
}

// Actualizar métodos de evaluación según el parámetro
function updateEvaluationMethods(parameter) {
    const evaluationMethodSelect = document.getElementById('evaluationMethodSelect');
    if (!evaluationMethodSelect) return;
    
    // Limpiar opciones actuales
    evaluationMethodSelect.innerHTML = '';
    
    // Añadir opción por defecto
    let option = document.createElement('option');
    option.value = '';
    option.textContent = 'Seleccione un método...';
    evaluationMethodSelect.appendChild(option);
    
    // Si es parámetro personalizado, solo añadir opción personalizada
    if (parameter === 'custom') {
        option = document.createElement('option');
        option.value = 'custom';
        option.textContent = 'Método personalizado';
        evaluationMethodSelect.appendChild(option);
        evaluationMethodSelect.value = 'custom';
        return;
    }
    
    // Añadir métodos según el parámetro
    const methods = objectiveParameters[parameter] || [];
    
    methods.forEach(method => {
        option = document.createElement('option');
        option.value = method;
        option.textContent = method;
        evaluationMethodSelect.appendChild(option);
    });
    
    // Añadir opción personalizada
    option = document.createElement('option');
    option.value = 'custom';
    option.textContent = 'Otro método...';
    evaluationMethodSelect.appendChild(option);
    
    // Seleccionar primer método si hay
    if (methods.length > 0) {
        evaluationMethodSelect.value = methods[0];
    }
    
    // Disparar evento para actualizar unidades
    evaluationMethodSelect.dispatchEvent(new Event('change'));
}

// Actualizar unidades según el método
function updateUnits(method) {
    const unitLabel = document.getElementById('unitLabel');
    const unitLabel2 = document.getElementById('unitLabel2');
    
    if (!unitLabel || !unitLabel2) return;
    
    let unit = '';
    
    // Extraer unidad del método (generalmente entre paréntesis)
    if (method) {
        const match = method.match(/\(([^)]+)\)/);
        if (match && match[1]) {
            unit = match[1];
        }
    }
    
    // Si no se encontró unidad, usar texto genérico
    if (!unit) unit = 'unidad';
    
    // Actualizar etiquetas
    unitLabel.textContent = unit;
    unitLabel2.textContent = unit;
}

function configureSpecificObjectivePreview() {
    // Obtener elementos del formulario
    const actionVerbSelect = document.getElementById('actionVerbSelect');
    const structureInput = document.getElementById('structureInput');
    const initialValueInput = document.getElementById('initialValueInput');
    const targetValueInput = document.getElementById('targetValueInput');
    const evaluationMethodSelect = document.getElementById('evaluationMethodSelect');
    const customMethodInput = document.getElementById('customMethodInput');
    const durationInput = document.getElementById('durationInput');
    const durationUnitSelect = document.getElementById('durationUnitSelect');
    const previewElement = document.getElementById('specificObjectivePreview');
    
    // Función para actualizar vista previa
    function updatePreview() {
        if (!previewElement) return;
        
        const verb = actionVerbSelect?.value || 'Aumentar';
        const structure = structureInput?.value || 'la fuerza de abductores de hombro derecho';
        const initialValue = initialValueInput?.value || '3/5';
        const targetValue = targetValueInput?.value || '4/5';
        
        let methodText = '';
        if (evaluationMethodSelect?.value === 'custom') {
            methodText = customMethodInput?.value || 'método personalizado';
        } else {
            methodText = evaluationMethodSelect?.value || 'escala de Daniels';
        }
        
        const duration = durationInput?.value || '2';
        const durationUnit = durationUnitSelect?.value || 'semanas';
        
        let previewText = `${verb} ${structure} de ${initialValue} a ${targetValue} en ${methodText} en un plazo de ${duration} ${durationUnit}.`;
        
        previewElement.textContent = previewText;
    }
    
    // Configurar eventos para actualización en tiempo real
    const inputs = [
        actionVerbSelect, evaluationMethodSelect, 
        customMethodInput, durationInput, durationUnitSelect
    ];
    
    inputs.forEach(input => {
        if (input) {
            input.addEventListener('change', updatePreview);
        }
    });
    
    // Campos de texto con evento input
    const textInputs = [structureInput, initialValueInput, targetValueInput];
    
    textInputs.forEach(input => {
        if (input) {
            input.addEventListener('input', updatePreview);
        }
    });
    
    // Añadir botón para usar ejemplo si no existe ya
    const previewContainer = previewElement?.parentNode;
    if (previewContainer && !previewContainer.querySelector('.use-example-btn')) {
        const useExampleBtn = document.createElement('button');
        useExampleBtn.type = 'button';
        useExampleBtn.className = 'action-btn btn-secondary use-example-btn';
        useExampleBtn.style.marginTop = '10px';
        useExampleBtn.innerHTML = '<i class="fas fa-check"></i> Usar este ejemplo';
        
        previewContainer.appendChild(useExampleBtn);
        
        useExampleBtn.addEventListener('click', function() {
            // Usar el ejemplo en el campo de descripción específico, no en observaciones
            const descInput = document.getElementById('specificObjectiveDescription');
            if (descInput && previewElement) {
                descInput.value = previewElement.textContent;
                showToast("Ejemplo copiado a la descripción del objetivo", "success");
            }
        });
    }
    
    // Actualización inicial
    updatePreview();
}

// Cargar objetivo específico para edición
async function loadSpecificObjective(patientId, objectiveId) {
    try {
        showLoading();
        
        // Verificar si ya tenemos el objetivo en caché
        if (objectivesCache[patientId] && 
            objectivesCache[patientId].specific && 
            objectivesCache[patientId].specific[objectiveId]) {
            
            fillSpecificObjectiveForm(objectivesCache[patientId].specific[objectiveId]);
            hideLoading();
            return;
        }
        
        // Obtener de Firebase
        const objectiveRef = doc(db, "patients", patientId, "objectives", objectiveId);
        const objectiveSnap = await getDoc(objectiveRef);
        
        if (objectiveSnap.exists()) {
            const objective = objectiveSnap.data();
            
            // Guardar en caché
            if (!objectivesCache[patientId]) objectivesCache[patientId] = {};
            if (!objectivesCache[patientId].specific) objectivesCache[patientId].specific = {};
            objectivesCache[patientId].specific[objectiveId] = objective;
            
            // Llenar formulario
            fillSpecificObjectiveForm(objective);
        } else {
            console.error("Objetivo específico no encontrado:", objectiveId);
            showToast("Error: Objetivo no encontrado", "error");
        }
        
        hideLoading();
    } catch (error) {
        hideLoading();
        console.error("Error al cargar objetivo específico:", error);
        showToast("Error al cargar objetivo: " + error.message, "error");
    }
}

// Llenar formulario de objetivo específico
function fillSpecificObjectiveForm(objective) {
    if (!objective) return;
    
    const actionVerbSelect = document.getElementById('actionVerbSelect');
    const objectiveCategorySelect = document.getElementById('objectiveCategorySelect');
    const structureInput = document.getElementById('structureInput');
    const parameterSelect = document.getElementById('parameterSelect');
    const evaluationMethodSelect = document.getElementById('evaluationMethodSelect');
    const customParameterInput = document.getElementById('customParameterInput');
    const customMethodInput = document.getElementById('customMethodInput');
    const initialValueInput = document.getElementById('initialValueInput');
    const targetValueInput = document.getElementById('targetValueInput');
    const durationInput = document.getElementById('durationInput');
    const durationUnitSelect = document.getElementById('durationUnitSelect');
    const evaluationFrequencySelect = document.getElementById('evaluationFrequencySelect');
    const specificObjectiveNotes = document.getElementById('specificObjectiveNotes');
    
    // Establecer valores
    if (actionVerbSelect) actionVerbSelect.value = objective.verb || 'Aumentar';
    if (objectiveCategorySelect) objectiveCategorySelect.value = objective.category || 'Analítico';
    if (structureInput) structureInput.value = objective.structure || '';
    
    // Configurar parámetro y método
    if (parameterSelect) {
        if (objective.isCustomParameter) {
            parameterSelect.value = 'custom';
            if (customParameterInput) {
                customParameterInput.style.display = 'block';
                customParameterInput.value = objective.parameter || '';
            }
        } else {
            parameterSelect.value = objective.parameter || 'Fuerza muscular';
            if (customParameterInput) customParameterInput.style.display = 'none';
        }
        
        // Actualizar métodos disponibles
        updateEvaluationMethods(parameterSelect.value);
    }
    
    // Establecer método de evaluación
    if (evaluationMethodSelect) {
        if (objective.isCustomMethod) {
            evaluationMethodSelect.value = 'custom';
            if (customMethodInput) {
                customMethodInput.style.display = 'block';
                customMethodInput.value = objective.evaluationMethod || '';
            }
        } else {
            // Intentar encontrar el método en la lista
            const methodExists = Array.from(evaluationMethodSelect.options).some(option => 
                option.value === objective.evaluationMethod
            );
            
            if (methodExists) {
                evaluationMethodSelect.value = objective.evaluationMethod;
            } else if (evaluationMethodSelect.options.length > 0) {
                evaluationMethodSelect.selectedIndex = 1; // Primer método real
            }
            
            if (customMethodInput) customMethodInput.style.display = 'none';
        }
        
        // Actualizar unidades
        updateUnits(evaluationMethodSelect.value);
    }
    
    // Establecer valores iniciales y objetivo
    if (initialValueInput) initialValueInput.value = objective.initialValue || '';
    if (targetValueInput) targetValueInput.value = objective.targetValue || '';
    
    // Calcular duración desde fechas
    if (durationInput && durationUnitSelect) {
        if (objective.duration && objective.durationUnit) {
            durationInput.value = objective.duration;
            durationUnitSelect.value = objective.durationUnit;
        } else {
            // Valores predeterminados
            durationInput.value = '2';
            durationUnitSelect.value = 'semanas';
        }
    }
    // Añade esto donde se asignan los valores a los campos del formulario
if (document.getElementById('specificObjectiveDescription')) 
    document.getElementById('specificObjectiveDescription').value = objective.description || '';
    
    if (evaluationFrequencySelect) evaluationFrequencySelect.value = objective.evaluationFrequency || 'quincenal';
    if (specificObjectiveNotes) specificObjectiveNotes.value = objective.notes || '';
    
    // Actualizar vista previa
    configureSpecificObjectivePreview();
}

// Guardar objetivo específico
async function saveSpecificObjective(patientId) {
    try {
        // Verificar que hay un paciente seleccionado
        if (!patientId) {
            showToast("Error: No hay paciente seleccionado", "error");
            return;
        }
        
        // Obtener valores del formulario
        const verb = document.getElementById('actionVerbSelect')?.value;
        const category = document.getElementById('objectiveCategorySelect')?.value;
        const structure = document.getElementById('structureInput')?.value;
        const parameter = document.getElementById('parameterSelect')?.value;
        const customParameter = document.getElementById('customParameterInput')?.value;
        const evaluationMethod = document.getElementById('evaluationMethodSelect')?.value;
        const customMethod = document.getElementById('customMethodInput')?.value;
        const initialValue = document.getElementById('initialValueInput')?.value;
        const targetValue = document.getElementById('targetValueInput')?.value;
        const duration = document.getElementById('durationInput')?.value;
        const durationUnit = document.getElementById('durationUnitSelect')?.value;
        const evaluationFrequency = document.getElementById('evaluationFrequencySelect')?.value;
        const notes = document.getElementById('specificObjectiveNotes')?.value;
        
        // Validar campos requeridos
        if (!structure) {
            showToast("La estructura o función es obligatoria", "error");
            return;
        }
        
        if (!initialValue) {
            showToast("El valor inicial es obligatorio", "error");
            return;
        }
        
        if (!targetValue) {
            showToast("El valor objetivo es obligatorio", "error");
            return;
        }
        
        showLoading();
        
        // Determinar si se están usando campos personalizados
        const isCustomParameter = parameter === 'custom';
        const isCustomMethod = evaluationMethod === 'custom';
        
        // Determinar el parámetro y método reales
        const actualParameter = isCustomParameter ? customParameter : parameter;
        const actualMethod = isCustomMethod ? customMethod : evaluationMethod;
        
        // Calcular fecha de inicio y fecha estimada de finalización
        const startDate = new Date().toISOString().split('T')[0];
        const endDate = new Date();
        
        if (durationUnit === 'semanas') {
            endDate.setDate(endDate.getDate() + (parseInt(duration) * 7));
        } else {
            endDate.setMonth(endDate.getMonth() + parseInt(duration));
        }
        
        const endDateStr = endDate.toISOString().split('T')[0];
        
        // Crear objeto con los datos
const objectiveData = {
    verb: verb,
    category: category,
    structure: structure,
    parameter: actualParameter,
    isCustomParameter: isCustomParameter,
    evaluationMethod: actualMethod,
    isCustomMethod: isCustomMethod,
    initialValue: initialValue,
    targetValue: targetValue,
    currentValue: initialValue, // Al crear, el valor actual es igual al inicial
    duration: duration,
    durationUnit: durationUnit,
    startDate: startDate,
    endDate: endDateStr,
    evaluationFrequency: evaluationFrequency,
    description: document.getElementById('specificObjectiveDescription')?.value || '',  // Añadir esta línea
    notes: notes,
    progress: 0,
    status: 'pending',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    progressHistory: [
        {
            date: startDate,
            value: initialValue,
            notes: "Valor inicial"
        }
    ]
};
        
        // ID del documento (nuevo o existente)
        let objectiveId = currentObjectiveId;
        
        // Guardar en Firebase
        if (objectiveId) {
            // Actualizar objetivo existente
            const objectiveRef = doc(db, "patients", patientId, "objectives", objectiveId);
            await updateDoc(objectiveRef, objectiveData);
        } else {
            // Crear nuevo objetivo
            const objectivesRef = collection(db, "patients", patientId, "objectives");
            const docRef = await addDoc(objectivesRef, objectiveData);
            objectiveId = docRef.id;
        }
        
        // Actualizar caché
        if (!objectivesCache[patientId]) objectivesCache[patientId] = {};
        if (!objectivesCache[patientId].specific) objectivesCache[patientId].specific = {};
        objectivesCache[patientId].specific[objectiveId] = objectiveData;
        
        // Actualizar UI
        updateObjectivesUI(patientId);
        
        // Cerrar modal
        const modal = document.getElementById('specificObjectiveModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        
        hideLoading();
        showToast("Objetivo específico guardado correctamente", "success");
    } catch (error) {
        hideLoading();
        console.error("Error al guardar objetivo específico:", error);
        showToast("Error al guardar objetivo: " + error.message, "error");
    }
}

// Actualizar interfaz de objetivos
async function updateObjectivesUI(patientId) {
    try {
        if (!patientId) {
            console.error("No hay paciente seleccionado para actualizar objetivos");
            return;
        }
        
        // Cargar objetivo general
        await loadGeneralObjectiveDisplay(patientId);
        
        // Cargar objetivos específicos
        await loadSpecificObjectivesDisplay(patientId);
        
        // Actualizar estadísticas
        updateObjectivesStatistics(patientId);
    } catch (error) {
        console.error("Error al actualizar interfaz de objetivos:", error);
        showToast("Error al actualizar objetivos: " + error.message, "error");
    }
}

// Cargar objetivo general para mostrar
async function loadGeneralObjectiveDisplay(patientId) {
    try {
        const noGeneralObjective = document.getElementById('noGeneralObjective');
        const generalObjectiveContent = document.getElementById('generalObjectiveContent');
        const generalObjectiveContainer = document.getElementById('generalObjectiveContainer');
        
        if (generalObjectiveContainer) {
            generalObjectiveContainer.style.display = 'block';
        }
        
        // Verificar si ya tenemos el objetivo en caché
        if (objectivesCache[patientId] && objectivesCache[patientId].general) {
            showGeneralObjectiveDisplay(objectivesCache[patientId].general);
            return;
        }
        
        // Obtener de Firebase
        const objectiveRef = doc(db, "patients", patientId, "objectives", "general");
        const objectiveSnap = await getDoc(objectiveRef);
        
        if (objectiveSnap.exists()) {
            const generalObjective = objectiveSnap.data();
            
            // Guardar en caché
            if (!objectivesCache[patientId]) objectivesCache[patientId] = {};
            objectivesCache[patientId].general = generalObjective;
            
            // Mostrar en UI
            showGeneralObjectiveDisplay(generalObjective);
        } else {
            // No hay objetivo general
            if (noGeneralObjective) noGeneralObjective.style.display = 'block';
            if (generalObjectiveContent) generalObjectiveContent.style.display = 'none';
        }
    } catch (error) {
        console.error("Error al cargar objetivo general:", error);
        // Mostrar mensaje de error
        if (noGeneralObjective) {
            noGeneralObjective.style.display = 'block';
            noGeneralObjective.innerHTML = `
                <i class="fas fa-exclamation-triangle" style="font-size: 30px; color: var(--accent2); margin-bottom: 10px;"></i>
                <p style="color: var(--accent2);">Error al cargar el objetivo general.</p>
            `;
        }
        if (generalObjectiveContent) generalObjectiveContent.style.display = 'none';
    }
}

// Mostrar objetivo general en la UI
function showGeneralObjectiveDisplay(objective) {
    const noGeneralObjective = document.getElementById('noGeneralObjective');
    const generalObjectiveContent = document.getElementById('generalObjectiveContent');
    const generalObjectiveTitle = document.getElementById('generalObjectiveTitle');
    const generalObjectiveDesc = document.getElementById('generalObjectiveDesc');
    const generalObjectiveDate = document.getElementById('generalObjectiveDate');
    const generalObjectiveEndDate = document.getElementById('generalObjectiveEndDate');
    const generalObjectiveProgressBar = document.getElementById('generalObjectiveProgressBar');
    const generalObjectiveProgressText = document.getElementById('generalObjectiveProgressText');
    
    // Ocultar mensaje de "no hay objetivo"
    if (noGeneralObjective) noGeneralObjective.style.display = 'none';
    
    // Mostrar contenido del objetivo
    if (generalObjectiveContent) generalObjectiveContent.style.display = 'block';
    
    // Establecer título
    if (generalObjectiveTitle) generalObjectiveTitle.textContent = 'Objetivo terapéutico principal';
    
    // Establecer descripción
    if (generalObjectiveDesc) generalObjectiveDesc.textContent = objective.description || 'Sin descripción';
    
    // Establecer fechas
    if (generalObjectiveDate) {
        const createdDate = objective.createdAt ? new Date(objective.createdAt) : new Date();
        generalObjectiveDate.textContent = formatDate(createdDate);
    }
    
    if (generalObjectiveEndDate) {
        const endDate = objective.endDate ? new Date(objective.endDate) : new Date();
        generalObjectiveEndDate.textContent = formatDate(endDate);
    }
    
    // Establecer progreso
    const progress = objective.progress || 0;
    if (generalObjectiveProgressBar) generalObjectiveProgressBar.style.width = `${progress}%`;
    if (generalObjectiveProgressText) generalObjectiveProgressText.textContent = `${progress}%`;
}

// Cargar objetivos específicos para mostrar
async function loadSpecificObjectivesDisplay(patientId) {
    try {
        const specificObjectivesList = document.getElementById('specificObjectivesList');
        const noSpecificObjectives = document.getElementById('noSpecificObjectives');
        const objectivesStatsPanel = document.getElementById('objectivesStatsPanel');
        
        if (!specificObjectivesList) return;
        
        // Limpiar lista actual (excepto el mensaje de "no hay objetivos")
        Array.from(specificObjectivesList.children).forEach(child => {
            if (child.id !== 'noSpecificObjectives') {
                specificObjectivesList.removeChild(child);
            }
        });
        
        // Verificar si ya tenemos los objetivos en caché
        let specificObjectives = [];
        
        if (objectivesCache[patientId] && objectivesCache[patientId].specific) {
            specificObjectives = Object.entries(objectivesCache[patientId].specific).map(([id, obj]) => ({
                id,
                ...obj
            }));
        } else {
            // Obtener de Firebase
            const objectivesRef = collection(db, "patients", patientId, "objectives");
            // No incluir el objetivo general
            const objectivesQuery = query(objectivesRef, where(documentId(), "!=", "general"));
            const objectivesSnap = await getDocs(objectivesQuery);
            
            if (!objectivesSnap.empty) {
                specificObjectives = objectivesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                
                // Guardar en caché
                if (!objectivesCache[patientId]) objectivesCache[patientId] = {};
                if (!objectivesCache[patientId].specific) objectivesCache[patientId].specific = {};
                
                specificObjectives.forEach(obj => {
                    objectivesCache[patientId].specific[obj.id] = obj;
                });
            }
        }
        
        // Mostrar/ocultar mensaje de "no hay objetivos"
        if (noSpecificObjectives) {
            noSpecificObjectives.style.display = specificObjectives.length === 0 ? 'block' : 'none';
        }
        
        // Mostrar/ocultar panel de estadísticas
        if (objectivesStatsPanel) {
            objectivesStatsPanel.style.display = specificObjectives.length > 0 ? 'block' : 'none';
        }
        
        // Ordenar objetivos: pendientes primero, luego en progreso, luego completados
        specificObjectives.sort((a, b) => {
            const statusOrder = { 'completed': 2, 'inprogress': 1, 'pending': 0 };
            return statusOrder[a.status || 'pending'] - statusOrder[b.status || 'pending'];
        });
        
        // Mostrar objetivos
        specificObjectives.forEach(objective => {
            const objectiveCard = createSpecificObjectiveCard(objective);
            specificObjectivesList.appendChild(objectiveCard);
        });
    } catch (error) {
        console.error("Error al cargar objetivos específicos:", error);
        
        // Mostrar mensaje de error
        if (specificObjectivesList) {
            specificObjectivesList.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--accent2);">
                    <i class="fas fa-exclamation-triangle" style="font-size: 30px; margin-bottom: 10px;"></i>
                    <p>Error al cargar los objetivos específicos.</p>
                </div>
            `;
        }
    }
}

// Crear tarjeta de objetivo específico
// Crear tarjeta de objetivo específico
// Crear tarjeta de objetivo específico
function createSpecificObjectiveCard(objective) {
    // Determinar clase y color según el estado
    let statusClass = 'status-pending';
    let statusText = 'Pendiente';
    let statusIcon = 'fas fa-clock';
    let borderColor = '#9E9E9E'; // Gris para pendientes
    
    switch(objective.status) {
        case 'inprogress':
            statusClass = 'status-inprogress';
            statusText = 'En progreso';
            statusIcon = 'fas fa-spinner';
            borderColor = '#2196F3'; // Azul para en progreso
            break;
        case 'completed':
            statusClass = 'status-completed';
            statusText = 'Completado';
            statusIcon = 'fas fa-check';
            borderColor = '#4CAF50'; // Verde para completados
            break;
    }
    
    // Crear elemento
    const card = document.createElement('div');
    card.className = 'objective-card';
    card.setAttribute('data-id', objective.id);
    card.style.backgroundColor = 'var(--background-alt)';
    card.style.borderLeft = `4px solid ${borderColor}`;
    card.style.padding = '15px';
    card.style.borderRadius = '5px';
    card.style.marginBottom = '15px';
    card.style.transition = 'all 0.3s ease';
    card.style.boxShadow = 'var(--shadow-sm)';
    card.style.cursor = 'pointer';
    
    // Hover effect
    card.addEventListener('mouseenter', function() {
        this.style.boxShadow = 'var(--shadow)';
        this.style.transform = 'translateY(-2px)';
    });
    
    card.addEventListener('mouseleave', function() {
        this.style.boxShadow = 'var(--shadow-sm)';
        this.style.transform = 'translateY(0)';
    });
    
    // Construir contenido
    const title = `${objective.verb} ${objective.structure}`;
    const details = `${objective.initialValue} → ${objective.targetValue} (${objective.evaluationMethod})`;
    const progress = objective.progress || 0;
    
    // Mostrar la descripción si existe
    const description = objective.description || title;
    
    // Calcular días restantes
    let daysRemaining = "";
    if (objective.endDate) {
        const endDate = new Date(objective.endDate);
        const today = new Date();
        const diffTime = endDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 0) {
            daysRemaining = `<div style="font-size: 12px; color: var(--text-secondary);"><i class="far fa-clock"></i> ${diffDays} días restantes</div>`;
        } else if (diffDays < 0 && objective.status !== 'completed') {
            daysRemaining = `<div style="font-size: 12px; color: #F44336;"><i class="fas fa-exclamation-circle"></i> Vencido hace ${Math.abs(diffDays)} días</div>`;
        }
    }
    
    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
            <div style="flex-grow: 1;">
                <h4 style="margin: 0; font-size: 16px; color: var(--text-primary);">${description}</h4>
                <div style="font-size: 13px; color: var(--text-secondary); margin-top: 3px;">${details}</div>
            </div>
            <div class="objective-badge ${statusClass}" style="font-size: 12px; padding: 3px 8px; border-radius: 12px; display: flex; align-items: center; gap: 5px;">
                <i class="${statusIcon}"></i>
                ${statusText}
            </div>
        </div>
        
        <div style="margin-top: 10px;">
            <div style="display: flex; justify-content: space-between; margin-bottom: 5px; font-size: 13px;">
                <div style="color: var(--text-secondary);">Progreso</div>
                <div>${progress}%</div>
            </div>
            <div style="height: 6px; background-color: var(--background); border-radius: 3px; overflow: hidden;">
                <div style="height: 100%; width: ${progress}%; background-color: ${borderColor}; border-radius: 3px;"></div>
            </div>
        </div>
        
        <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 12px; color: var(--text-secondary);">
            <div>${objective.category}</div>
            ${daysRemaining || `<div><i class="far fa-calendar-alt"></i> ${formatDate(new Date(objective.endDate))}</div>`}
        </div>
        
        <div style="margin-top: 10px; display: flex; justify-content: flex-end; gap: 5px;">
            <button type="button" class="action-btn btn-secondary edit-objective-btn" style="padding: 3px 8px; font-size: 12px;">
                <i class="fas fa-edit"></i> Editar
            </button>
            <button type="button" class="action-btn btn-secondary delete-objective-btn" style="padding: 3px 8px; font-size: 12px; background-color: var(--accent2-light);">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    // Añadir evento de clic para ver detalles
    card.addEventListener('click', function(e) {
        // Ignorar si hicieron clic en un botón
        if (e.target.closest('button')) return;
        
        openViewSpecificObjectiveModal(objective);
    });
    
    // Añadir eventos para los botones
    const editBtn = card.querySelector('.edit-objective-btn');
    if (editBtn) {
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Evitar que se abra el modal de detalles
            openSpecificObjectiveModal(currentPatientId, objective.id);
        });
    }
    
    const deleteBtn = card.querySelector('.delete-objective-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation(); // Evitar que se abra el modal de detalles
            deleteSpecificObjective(currentPatientId, objective.id);
        });
    }
    
    return card;
}

// Abrir modal para ver detalles de objetivo específico
function openViewSpecificObjectiveModal(objective) {
    try {
        const modal = document.getElementById('viewSpecificObjectiveModal');
        if (!modal) {
            console.error("Modal de visualización de objetivo no encontrado");
            return;
        }
        
        // Llenar el modal con los datos del objetivo
        fillViewSpecificObjectiveModal(objective);
        
        // Mostrar modal
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('active'), 50);
        
        // Configurar eventos para botones
        const closeBtn = document.getElementById('closeViewSpecificModal');
        if (closeBtn) {
            // Eliminar manejadores previos
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            newCloseBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
        
        // Botón de editar
        const editBtn = document.getElementById('editSpecificObjectiveBtn');
        if (editBtn) {
            // Eliminar manejadores previos
            const newEditBtn = editBtn.cloneNode(true);
            editBtn.parentNode.replaceChild(newEditBtn, editBtn);
            
            newEditBtn.addEventListener('click', function() {
                // Cerrar este modal primero
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    // Abrir modal de edición
                    openSpecificObjectiveModal(currentPatientId, objective.id);
                }, 300);
            });
        }
        
        // Botón de eliminar
        const deleteBtn = document.getElementById('deleteSpecificObjectiveBtn');
        if (deleteBtn) {
            // Eliminar manejadores previos
            const newDeleteBtn = deleteBtn.cloneNode(true);
            deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
            
            newDeleteBtn.addEventListener('click', function() {
                // Confirmar eliminación
                if (confirm('¿Está seguro que desea eliminar este objetivo específico?')) {
                    deleteSpecificObjective(currentPatientId, objective.id);
                    // Cerrar modal
                    modal.classList.remove('active');
                    setTimeout(() => {
                        modal.style.display = 'none';
                    }, 300);
                }
            });
        }
        
        // Botón de registro de progreso
        const recordBtn = document.getElementById('recordProgressBtn');
        if (recordBtn) {
            // Eliminar manejadores previos
            const newRecordBtn = recordBtn.cloneNode(true);
            recordBtn.parentNode.replaceChild(newRecordBtn, recordBtn);
            
            newRecordBtn.addEventListener('click', function() {
                // Cerrar este modal primero
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                    // Abrir modal de registro de progreso
                    openRecordProgressModal(currentPatientId, objective);
                }, 300);
            });
        }
    } catch (error) {
        console.error("Error al abrir modal de detalle de objetivo:", error);
        showToast("Error al mostrar detalles del objetivo", "error");
    }
}

// Llenar modal de visualización de objetivo específico
function fillViewSpecificObjectiveModal(objective) {
    // Título y descripción
    const titleElement = document.getElementById('viewObjectiveTitle');
    if (titleElement) titleElement.textContent = `${objective.verb} ${objective.structure}`;
    
    // Metadatos
    const categoryElement = document.getElementById('viewObjectiveCategory');
    const dateElement = document.getElementById('viewObjectiveDate');
    const endDateElement = document.getElementById('viewObjectiveEndDate');
    
    if (categoryElement) categoryElement.textContent = objective.category || 'No especificada';
    if (dateElement) dateElement.textContent = formatDate(new Date(objective.createdAt));
    if (endDateElement) endDateElement.textContent = formatDate(new Date(objective.endDate));
    
    // Detalles
    const parameterElement = document.getElementById('viewObjectiveParameter');
    const methodElement = document.getElementById('viewObjectiveMethod');
    const initialValueElement = document.getElementById('viewObjectiveInitialValue');
    const targetValueElement = document.getElementById('viewObjectiveTargetValue');
    const frequencyElement = document.getElementById('viewObjectiveFrequency');
    const notesElement = document.getElementById('viewObjectiveNotes');
    
    if (parameterElement) parameterElement.textContent = objective.parameter || 'No especificado';
    if (methodElement) methodElement.textContent = objective.evaluationMethod || 'No especificado';
    if (initialValueElement) initialValueElement.textContent = objective.initialValue || 'No especificado';
    if (targetValueElement) targetValueElement.textContent = objective.targetValue || 'No especificado';
    if (frequencyElement) frequencyElement.textContent = objective.evaluationFrequency || 'No especificada';
    if (notesElement) notesElement.textContent = objective.notes || 'Sin observaciones';
    
    // Progreso
    const progressCircle = document.getElementById('viewProgressCircle');
    const progressText = document.getElementById('viewProgressText');
    const progressBar = document.getElementById('viewProgressBar');
    const progressValue = document.getElementById('viewProgressValue');
    const currentValue = document.getElementById('viewCurrentValue');
    const objectiveStatus = document.getElementById('viewObjectiveStatus');
    
    const progress = objective.progress || 0;
    
    if (progressCircle) {
        // Calcular offset para el círculo SVG (el círculo tiene radio 35, así que la circunferencia es 2πr)
        const circumference = 2 * Math.PI * 35;
        const offset = circumference - (circumference * progress / 100);
        progressCircle.setAttribute('stroke-dasharray', circumference);
        progressCircle.setAttribute('stroke-dashoffset', offset);
    }
    
    if (progressText) progressText.textContent = `${progress}%`;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressValue) progressValue.textContent = `${progress}%`;
    
    if (currentValue) {
        const current = objective.currentValue || objective.initialValue || 'No disponible';
        currentValue.textContent = `Actual: ${current}`;
    }
    
    if (objectiveStatus) {
        let statusText = 'Pendiente';
        switch(objective.status) {
            case 'inprogress': statusText = 'En progreso'; break;
            case 'completed': statusText = 'Completado'; break;
        }
        objectiveStatus.textContent = statusText;
    }
    
    // Fechas de evaluación
    const lastEvaluationElement = document.getElementById('viewLastEvaluation');
    const nextEvaluationElement = document.getElementById('viewNextEvaluation');
    
    if (lastEvaluationElement) {
        let lastEvalDate = 'No evaluado';
        if (objective.progressHistory && objective.progressHistory.length > 0) {
            const lastEntry = objective.progressHistory[objective.progressHistory.length - 1];
            lastEvalDate = formatDate(new Date(lastEntry.date));
        }
        lastEvaluationElement.textContent = lastEvalDate;
    }
    
    if (nextEvaluationElement) {
        // Calcular próxima fecha según frecuencia
        let nextDate = new Date();
        if (objective.progressHistory && objective.progressHistory.length > 0) {
            const lastEntry = objective.progressHistory[objective.progressHistory.length - 1];
            nextDate = new Date(lastEntry.date);
        }
        
        switch(objective.evaluationFrequency) {
            case 'semanal':
                nextDate.setDate(nextDate.getDate() + 7);
                break;
            case 'quincenal':
                nextDate.setDate(nextDate.getDate() + 14);
                break;
            case 'mensual':
                nextDate.setMonth(nextDate.getMonth() + 1);
                break;
            default:
                nextDate.setDate(nextDate.getDate() + 14); // Predeterminado: quincenal
        }
        
        nextEvaluationElement.textContent = formatDate(nextDate);
    }
}

// Abrir modal para registrar progreso
function openRecordProgressModal(patientId, objective) {
    try {
        const modal = document.getElementById('recordProgressModal');
        if (!modal) {
            console.error("Modal de registro de progreso no encontrado");
            return;
        }
        
        // Llenar el modal con los datos del objetivo
        fillRecordProgressModal(objective);
        
        // Mostrar modal
        modal.style.display = 'block';
        setTimeout(() => modal.classList.add('active'), 50);
        
        // Configurar eventos para botones
        const closeBtn = document.getElementById('closeRecordProgressModal');
        if (closeBtn) {
            // Eliminar manejadores previos
            const newCloseBtn = closeBtn.cloneNode(true);
            closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
            
            newCloseBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
        
        // Cancelar
        const cancelBtn = document.getElementById('cancelProgressBtn');
        if (cancelBtn) {
            // Eliminar manejadores previos
            const newCancelBtn = cancelBtn.cloneNode(true);
            cancelBtn.parentNode.replaceChild(newCancelBtn, cancelBtn);
            
            newCancelBtn.addEventListener('click', function() {
                modal.classList.remove('active');
                setTimeout(() => {
                    modal.style.display = 'none';
                }, 300);
            });
        }
        
        // Guardar progreso
        const saveBtn = document.getElementById('saveProgressBtn');
        if (saveBtn) {
            // Eliminar manejadores previos
            const newSaveBtn = saveBtn.cloneNode(true);
            saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);
            
            newSaveBtn.addEventListener('click', function() {
                saveObjectiveProgress(patientId, objective.id);
            });
        }
        
        // Configurar eventos para calcular progreso en tiempo real
        const currentValueInput = document.getElementById('currentValueInput');
        if (currentValueInput) {
            // Eliminar manejadores previos
            const newCurrentValueInput = currentValueInput.cloneNode(true);
            currentValueInput.parentNode.replaceChild(newCurrentValueInput, currentValueInput);
            
            newCurrentValueInput.addEventListener('input', function() {
                calculateProgress(objective);
            });
            
            // Disparar evento para inicializar
            newCurrentValueInput.dispatchEvent(new Event('input'));
        }
    } catch (error) {
        console.error("Error al abrir modal de registro de progreso:", error);
        showToast("Error al abrir formulario de progreso", "error");
    }
}

// Llenar modal de registro de progreso
function fillRecordProgressModal(objective) {
    // Título y detalles
    const titleElement = document.getElementById('progressObjectiveTitle');
    const detailElement = document.getElementById('progressObjectiveDetail');
    
    if (titleElement) titleElement.textContent = `${objective.verb} ${objective.structure}`;
    if (detailElement) {
        detailElement.textContent = `Valor inicial: ${objective.initialValue} → Valor objetivo: ${objective.targetValue} (${objective.evaluationMethod})`;
    }
    
    // Fecha actual
    const dateInput = document.getElementById('progressDateInput');
    if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
    
    // Valor actual
    const currentValueInput = document.getElementById('currentValueInput');
    const unitLabel = document.getElementById('progressUnitLabel');
    
    if (currentValueInput) currentValueInput.value = objective.currentValue || objective.initialValue || '';
    
    if (unitLabel) {
        // Extraer unidad del método (generalmente entre paréntesis)
        let unit = '';
        if (objective.evaluationMethod) {
            const match = objective.evaluationMethod.match(/\(([^)]+)\)/);
            if (match && match[1]) {
                unit = match[1];
            }
        }
        
        // Si no se encontró unidad, usar texto genérico
        if (!unit) unit = 'unidad';
        
        unitLabel.textContent = unit;
    }
    
    // Notas
    const notesInput = document.getElementById('progressNotes');
    if (notesInput) notesInput.value = '';
}

// Calcular progreso en tiempo real
function calculateProgress(objective) {
    try {
        const currentValueInput = document.getElementById('currentValueInput');
        if (!currentValueInput) return;
        
        const currentValue = currentValueInput.value;
        if (!currentValue) return;
        
        // Obtener elementos de UI
        const progressCircle = document.getElementById('progressCircle');
        const progressText = document.getElementById('progressText');
        const progressBar = document.getElementById('progressBar');
        const progressPercentage = document.getElementById('progressPercentage');
        const progressIncrease = document.getElementById('progressIncrease');
        const progressStatus = document.getElementById('progressStatus');
        
        // Extraer valores numéricos
        let initialNum = extractNumericValue(objective.initialValue);
        let targetNum = extractNumericValue(objective.targetValue);
        let currentNum = extractNumericValue(currentValue);
        
        if (initialNum === null || targetNum === null || currentNum === null) {
            // No se pueden extraer valores numéricos, usar progreso manual
            let manualProgress = 0;
            
            // Intentar identificar si es un valor de escala tipo "3/5"
            const initialScale = parseScale(objective.initialValue);
            const targetScale = parseScale(objective.targetValue);
            const currentScale = parseScale(currentValue);
            
            if (initialScale && targetScale && currentScale) {
                // Calcular progreso proporcional
                const totalRange = targetScale - initialScale;
                const currentProgress = currentScale - initialScale;
                
                if (totalRange !== 0) {
                    manualProgress = (currentProgress / totalRange) * 100;
                }
            }
            
            // Limitar a valores entre 0 y 100
            manualProgress = Math.max(0, Math.min(100, manualProgress));
            
            // Actualizar UI
            updateProgressUI(manualProgress);
            return;
        }
        
        // Calcular progreso
        let progress = 0;
        
        // Si el objetivo es aumentar un valor
        if (targetNum > initialNum) {
            progress = ((currentNum - initialNum) / (targetNum - initialNum)) * 100;
        }
        // Si el objetivo es disminuir un valor
        else if (targetNum < initialNum) {
            progress = ((initialNum - currentNum) / (initialNum - targetNum)) * 100;
        }
        // Si inicial y objetivo son iguales
        else {
            progress = currentNum >= targetNum ? 100 : 0;
        }
        
        // Limitar a valores entre 0 y 100
        progress = Math.max(0, Math.min(100, progress));
        
        // Redondear a entero
        progress = Math.round(progress);
        
        // Actualizar UI
        updateProgressUI(progress);
        
        // Determinar estado
        const previousValue = objective.currentValue || objective.initialValue;
        let previousNum = extractNumericValue(previousValue);
        
        if (previousNum === null) {
            previousNum = parseScale(previousValue) || 0;
        }
        
        // Calcular cambio desde la última evaluación
        let change = 0;
        
        if (targetNum > initialNum) {
            // El objetivo es aumentar
            change = currentNum - previousNum;
        } else {
            // El objetivo es disminuir
            change = previousNum - currentNum;
        }
        
        // Actualizar texto de incremento
        if (progressIncrease) {
            if (change > 0) {
                progressIncrease.textContent = `+${change.toFixed(1)} desde última evaluación`;
                progressIncrease.style.color = '#4CAF50'; // Verde para mejora
            } else if (change < 0) {
                progressIncrease.textContent = `${change.toFixed(1)} desde última evaluación`;
                progressIncrease.style.color = '#F44336'; // Rojo para retroceso
            } else {
                progressIncrease.textContent = 'Sin cambios desde última evaluación';
                progressIncrease.style.color = '#9E9E9E'; // Gris para sin cambios
            }
        }
        
        // Actualizar estado
        if (progressStatus) {
            if (progress >= 100) {
                progressStatus.textContent = 'Completado';
                progressStatus.style.color = '#4CAF50'; // Verde para completado
            } else if (progress > 0) {
                progressStatus.textContent = 'En progreso';
                progressStatus.style.color = '#2196F3'; // Azul para en progreso
            } else {
                progressStatus.textContent = 'Pendiente';
                progressStatus.style.color = '#9E9E9E'; // Gris para pendiente
            }
        }
    } catch (error) {
        console.error("Error al calcular progreso:", error);
    }
}

// Actualizar UI de progreso
function updateProgressUI(progress) {
    const progressCircle = document.getElementById('progressCircle');
    const progressText = document.getElementById('progressText');
    const progressBar = document.getElementById('progressBar');
    const progressPercentage = document.getElementById('progressPercentage');
    
    // Actualizar círculo de progreso
    if (progressCircle) {
        const circumference = 2 * Math.PI * 35;
        const offset = circumference - (circumference * progress / 100);
        progressCircle.setAttribute('stroke-dasharray', circumference);
        progressCircle.setAttribute('stroke-dashoffset', offset);
    }
    
    // Actualizar texto de porcentaje
    if (progressText) progressText.textContent = `${progress}%`;
    if (progressPercentage) progressPercentage.textContent = `${progress}%`;
    
    // Actualizar barra de progreso
    if (progressBar) progressBar.style.width = `${progress}%`;
}

// Extraer valor numérico de un texto
function extractNumericValue(text) {
    if (!text) return null;
    
    // Intentar convertir directamente a número
    const directNum = parseFloat(text);
    if (!isNaN(directNum)) return directNum;
    
    // Buscar números en el texto
    const numMatch = text.match(/-?\d+(\.\d+)?/);
    if (numMatch) return parseFloat(numMatch[0]);
    
    return null;
}

// Analizar valor de escala (ej: "3/5" -> 3)
function parseScale(text) {
    if (!text) return null;
    
    // Buscar patrón de escala: número/número
    const scaleMatch = text.match(/(\d+)\/(\d+)/);
    if (scaleMatch) {
        const numerator = parseInt(scaleMatch[1]);
        return numerator;
    }
    
    return null;
}

// Guardar progreso de objetivo
async function saveObjectiveProgress(patientId, objectiveId) {
    try {
        if (!patientId || !objectiveId) {
            showToast("Error: Faltan datos para guardar progreso", "error");
            return;
        }
        
        // Obtener valores del formulario
        const progressDate = document.getElementById('progressDateInput')?.value;
        const currentValue = document.getElementById('currentValueInput')?.value;
        const notes = document.getElementById('progressNotes')?.value || '';
        
        if (!progressDate) {
            showToast("La fecha de evaluación es obligatoria", "error");
            return;
        }
        
        if (!currentValue) {
            showToast("El valor actual es obligatorio", "error");
            return;
        }
        
        showLoading();
        
        // Obtener objetivo actual
        const objectiveRef = doc(db, "patients", patientId, "objectives", objectiveId);
        const objectiveSnap = await getDoc(objectiveRef);
        
        if (!objectiveSnap.exists()) {
            hideLoading();
            showToast("Error: Objetivo no encontrado", "error");
            return;
        }
        
        const objective = objectiveSnap.data();
        
        // Calcular progreso
        const initialVal = objective.initialValue;
        const targetVal = objective.targetValue;
        
        // Extraer valores numéricos
        let initialNum = extractNumericValue(initialVal);
        let targetNum = extractNumericValue(targetVal);
        let currentNum = extractNumericValue(currentValue);
        
        let progress = 0;
        let status = 'pending';
        
        if (initialNum !== null && targetNum !== null && currentNum !== null) {
            // Si el objetivo es aumentar un valor
            if (targetNum > initialNum) {
                progress = ((currentNum - initialNum) / (targetNum - initialNum)) * 100;
            }
            // Si el objetivo es disminuir un valor
            else if (targetNum < initialNum) {
                progress = ((initialNum - currentNum) / (initialNum - targetNum)) * 100;
            }
            // Si inicial y objetivo son iguales
            else {
                progress = currentNum >= targetNum ? 100 : 0;
            }
        } else {
            // Intentar con valores de escala
            const initialScale = parseScale(initialVal);
            const targetScale = parseScale(targetVal);
            const currentScale = parseScale(currentValue);
            
            if (initialScale !== null && targetScale !== null && currentScale !== null) {
                const totalRange = targetScale - initialScale;
                const currentProgress = currentScale - initialScale;
                
                if (totalRange !== 0) {
                    progress = (currentProgress / totalRange) * 100;
                }
            }
        }
        
        // Limitar a valores entre 0 y 100
        progress = Math.max(0, Math.min(100, Math.round(progress)));
        
        // Determinar estado
        if (progress >= 100) {
            status = 'completed';
        } else if (progress > 0) {
            status = 'inprogress';
        }
        
        // Crear entrada de historial
        const progressEntry = {
            date: progressDate,
            value: currentValue,
            notes: notes
        };
        
        // Actualizar objeto de objetivo
        const progressHistory = objective.progressHistory || [];
        progressHistory.push(progressEntry);
        
        const updatedData = {
            currentValue: currentValue,
            progress: progress,
            status: status,
            updatedAt: new Date().toISOString(),
            progressHistory: progressHistory
        };
        
        // Guardar en Firebase
        await updateDoc(objectiveRef, updatedData);
        
        // Actualizar caché
        if (objectivesCache[patientId] && 
            objectivesCache[patientId].specific && 
            objectivesCache[patientId].specific[objectiveId]) {
            
            objectivesCache[patientId].specific[objectiveId] = {
                ...objectivesCache[patientId].specific[objectiveId],
                ...updatedData
            };
        }
        
        // Actualizar progreso general
        await updateGeneralObjectiveProgress(patientId);
        
        // Actualizar UI
        updateObjectivesUI(patientId);
        
        // Cerrar modal
        const modal = document.getElementById('recordProgressModal');
        if (modal) {
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }
        
        hideLoading();
        showToast("Progreso guardado correctamente", "success");
    } catch (error) {
        hideLoading();
        console.error("Error al guardar progreso:", error);
        showToast("Error al guardar progreso: " + error.message, "error");
    }
}

// Actualizar progreso del objetivo general
async function updateGeneralObjectiveProgress(patientId) {
    try {
        if (!patientId) return;
        
        // Obtener todos los objetivos específicos
        const objectivesRef = collection(db, "patients", patientId, "objectives");
        // No incluir el objetivo general
        const objectivesQuery = query(objectivesRef, where(documentId(), "!=", "general"));
        const objectivesSnap = await getDocs(objectivesQuery);
        
        if (objectivesSnap.empty) return;
        
        // Calcular progreso general
        let totalProgress = 0;
        let objectivesCount = 0;
        
        objectivesSnap.docs.forEach(doc => {
            const obj = doc.data();
            totalProgress += (obj.progress || 0);
            objectivesCount++;
        });
        
        // Calcular promedio
        const avgProgress = objectivesCount > 0 ? Math.round(totalProgress / objectivesCount) : 0;
        
        // Actualizar objetivo general
        const generalRef = doc(db, "patients", patientId, "objectives", "general");
        const generalSnap = await getDoc(generalRef);
        
        if (generalSnap.exists()) {
            await updateDoc(generalRef, {
                progress: avgProgress,
                updatedAt: new Date().toISOString()
            });
            
            // Actualizar caché
            if (objectivesCache[patientId] && objectivesCache[patientId].general) {
                objectivesCache[patientId].general = {
                    ...objectivesCache[patientId].general,
                    progress: avgProgress,
                    updatedAt: new Date().toISOString()
                };
            }
        }
    } catch (error) {
        console.error("Error al actualizar progreso general:", error);
    }
}

// Eliminar objetivo específico
async function deleteSpecificObjective(patientId, objectiveId) {
    try {
        if (!patientId || !objectiveId) {
            showToast("Error: Faltan datos para eliminar objetivo", "error");
            return;
        }
        
        showLoading();
        
        // Eliminar de Firebase
        const objectiveRef = doc(db, "patients", patientId, "objectives", objectiveId);
        await deleteDoc(objectiveRef);
        
        // Eliminar de caché
        if (objectivesCache[patientId] && 
            objectivesCache[patientId].specific && 
            objectivesCache[patientId].specific[objectiveId]) {
            
            delete objectivesCache[patientId].specific[objectiveId];
        }
        
        // Actualizar progreso general
        await updateGeneralObjectiveProgress(patientId);
        
        // Actualizar UI
        updateObjectivesUI(patientId);
        
        hideLoading();
        showToast("Objetivo eliminado correctamente", "success");
    } catch (error) {
        hideLoading();
        console.error("Error al eliminar objetivo:", error);
        showToast("Error al eliminar objetivo: " + error.message, "error");
    }
}

// Actualizar estadísticas de objetivos
function updateObjectivesStatistics(patientId) {
    try {
        if (!patientId) return;
        
        // Verificar si hay objetivos en caché
        if (!objectivesCache[patientId] || !objectivesCache[patientId].specific) return;
        
        const specificObjectives = Object.values(objectivesCache[patientId].specific);
        if (specificObjectives.length === 0) return;
        
        // Contar objetivos por estado
        let completed = 0;
        let inProgress = 0;
        let pending = 0;
        
        specificObjectives.forEach(obj => {
            switch(obj.status) {
                case 'completed': completed++; break;
                case 'inprogress': inProgress++; break;
                default: pending++; break;
            }
        });
        
        // Actualizar contadores
        const completedElement = document.getElementById('completedObjectivesCount');
        const inProgressElement = document.getElementById('inProgressObjectivesCount');
        const pendingElement = document.getElementById('pendingObjectivesCount');
        
        if (completedElement) completedElement.textContent = completed;
        if (inProgressElement) inProgressElement.textContent = inProgress;
        if (pendingElement) pendingElement.textContent = pending;
        
        // Actualizar gráfico de dona
        updateDonutChart(completed, inProgress, pending);
        
        // Actualizar velocímetro de progreso general
        updateGaugeChart();
        
        // Actualizar tiempo restante estimado
        updateRemainingTime(patientId);
    } catch (error) {
        console.error("Error al actualizar estadísticas:", error);
    }
}

// Actualizar gráfico de dona
function updateDonutChart(completed, inProgress, pending) {
    try {
        const container = document.getElementById('objectivesDonutChart');
        if (!container) return;
        
        const total = completed + inProgress + pending;
        if (total === 0) return;
        
        // Calcular porcentajes
        const completedPerc = (completed / total) * 100;
        const inProgressPerc = (inProgress / total) * 100;
        const pendingPerc = (pending / total) * 100;
        
        // Calcular longitudes de arco (la circunferencia completa es 502.4 = 2 * PI * 80)
        const circumference = 2 * Math.PI * 80;
        const completedLength = (completedPerc / 100) * circumference;
        const inProgressLength = (inProgressPerc / 100) * circumference;
        const pendingLength = (pendingPerc / 100) * circumference;
        
        // Calcular offsets
        const completedOffset = 0;
        const inProgressOffset = -completedLength;
        const pendingOffset = -(completedLength + inProgressLength);
        
        // Generar SVG
        container.innerHTML = `
            <svg width="200" height="200" viewBox="0 0 200 200">
                <!-- Círculo de fondo -->
                <circle cx="100" cy="100" r="80" fill="none" stroke="#e0e0e0" stroke-width="20"/>
                
                <!-- Segmentos de progreso -->
                ${completedPerc > 0 ? `
                <!-- Completados (verde) -->
                <circle cx="100" cy="100" r="80" fill="none" stroke="#4CAF50" stroke-width="20" 
                        stroke-dasharray="${completedLength} ${circumference}" stroke-dashoffset="${completedOffset}"
                        transform="rotate(-90 100 100)"/>
                ` : ''}
                
                ${inProgressPerc > 0 ? `
                <!-- En progreso (azul) -->
                <circle cx="100" cy="100" r="80" fill="none" stroke="#2196F3" stroke-width="20" 
                        stroke-dasharray="${inProgressLength} ${circumference}" stroke-dashoffset="${inProgressOffset}"
                        transform="rotate(-90 100 100)"/>
                ` : ''}
                
                ${pendingPerc > 0 ? `
                <!-- Pendientes (gris) -->
                <circle cx="100" cy="100" r="80" fill="none" stroke="#9E9E9E" stroke-width="20" 
                        stroke-dasharray="${pendingLength} ${circumference}" stroke-dashoffset="${pendingOffset}"
                        transform="rotate(-90 100 100)"/>
                ` : ''}
                
                <!-- Texto central -->
                <text x="100" y="95" text-anchor="middle" font-size="16" font-weight="bold">${completed}/${total}</text>
                <text x="100" y="115" text-anchor="middle" font-size="12">objetivos</text>
            </svg>
        `;
    } catch (error) {
        console.error("Error al actualizar gráfico de dona:", error);
    }
}

// Actualizar gráfico de velocímetro
function updateGaugeChart() {
    try {
        const container = document.getElementById('objectivesGaugeChart');
        if (!container) return;
        
        // Obtener progreso general
        let generalProgress = 0;
        
        if (objectivesCache[currentPatientId] && objectivesCache[currentPatientId].general) {
            generalProgress = objectivesCache[currentPatientId].general.progress || 0;
        }
        
        // Calcular ángulo para la aguja (el arco va de 0 a 180 grados)
        const angle = (generalProgress / 100) * 180 - 90;
        const radians = angle * Math.PI / 180;
        const x = 100 + 70 * Math.cos(radians);
        const y = 100 + 70 * Math.sin(radians);
        
        // Calcular longitud del arco (la circunferencia de medio círculo es PI * r)
        const arcLength = Math.PI * 90;
        const progressArcLength = (generalProgress / 100) * arcLength;
        
        // Determinar color según progreso
        let progressColor = '#9E9E9E'; // Gris por defecto
        
        if (generalProgress >= 75) {
            progressColor = '#4CAF50'; // Verde para buen progreso
        } else if (generalProgress >= 25) {
            progressColor = '#2196F3'; // Azul para progreso moderado
        } else if (generalProgress > 0) {
            progressColor = '#FFC107'; // Ámbar para progreso bajo
        }
        
        // Generar SVG
        container.innerHTML = `
            <svg width="200" height="115" viewBox="0 0 200 115">
                <!-- Arco de fondo -->
                <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#e0e0e0" stroke-width="10"/>
                
                <!-- Arco de progreso -->
                <path d="M 10 100 A 90 90 0 0 1 ${generalProgress > 0 ? ((generalProgress >= 100 ? 190 : 10 + 180 * generalProgress/100)) : 10} 100" 
                      fill="none" stroke="${progressColor}" stroke-width="10"/>
                
                <!-- Aguja indicadora -->
                <line x1="100" y1="100" x2="${x}" y2="${y}" stroke="#333" stroke-width="2"/>
                <circle cx="100" cy="100" r="5" fill="#333"/>
                
                <!-- Texto de porcentaje -->
                <text x="100" y="130" text-anchor="middle" font-size="16" font-weight="bold" id="generalProgressText">${generalProgress}%</text>
            </svg>
        `;
        
        // Actualizar texto de progreso en otros lugares
        const generalProgressText = document.getElementById('generalProgressText');
        if (generalProgressText && generalProgressText.id !== 'generalProgressText') {
            generalProgressText.textContent = `${generalProgress}%`;
        }
    } catch (error) {
        console.error("Error al actualizar gráfico de velocímetro:", error);
    }
}

// Calcular tiempo restante estimado
function updateRemainingTime(patientId) {
    try {
        const remainingTimeText = document.getElementById('remainingTimeText');
        const estimatedEndDateText = document.getElementById('estimatedEndDateText');
        
        if (!remainingTimeText || !estimatedEndDateText) return;
        
        // Verificar si hay objetivos específicos
        if (!objectivesCache[patientId] || !objectivesCache[patientId].specific) {
            remainingTimeText.textContent = 'No hay objetivos específicos';
            estimatedEndDateText.textContent = '-';
            return;
        }
        
        const specificObjectives = Object.values(objectivesCache[patientId].specific);
        if (specificObjectives.length === 0) {
            remainingTimeText.textContent = 'No hay objetivos específicos';
            estimatedEndDateText.textContent = '-';
            return;
        }
        
        // Encontrar la fecha de finalización más lejana
        let latestEndDate = null;
        
        specificObjectives.forEach(obj => {
            if (obj.status !== 'completed' && obj.endDate) {
                const endDate = new Date(obj.endDate);
                
                if (!latestEndDate || endDate > latestEndDate) {
                    latestEndDate = endDate;
                }
            }
        });
        
        if (!latestEndDate) {
            // No hay objetivos pendientes o en progreso con fecha de finalización
            remainingTimeText.textContent = 'Todos los objetivos completados';
            estimatedEndDateText.textContent = '-';
            return;
        }
        
        // Calcular tiempo restante
        const today = new Date();
        const diffTime = latestEndDate - today;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays <= 0) {
            remainingTimeText.textContent = 'Fecha objetivo vencida';
            estimatedEndDateText.textContent = formatDate(latestEndDate);
            remainingTimeText.style.color = '#F44336'; // Rojo para vencido
            return;
        }
        
        // Convertir días a formato legible
        let timeText = '';
        
        if (diffDays >= 30) {
            const months = Math.floor(diffDays / 30);
            const remainingDays = diffDays % 30;
            
            timeText = `${months} ${months === 1 ? 'mes' : 'meses'}`;
            
            if (remainingDays > 0) {
                timeText += ` y ${remainingDays} ${remainingDays === 1 ? 'día' : 'días'}`;
            }
        } else {
            timeText = `${diffDays} ${diffDays === 1 ? 'día' : 'días'}`;
        }
        
        remainingTimeText.textContent = timeText;
        estimatedEndDateText.textContent = formatDate(latestEndDate);
        remainingTimeText.style.color = ''; // Color por defecto
    } catch (error) {
        console.error("Error al calcular tiempo restante:", error);
    }
}


        
// Botón para editar objetivo general
document.getElementById('editGeneralObjectiveBtn').addEventListener('click', function() {
    openGeneralObjectiveModal(currentPatientId);
});

// Botón para añadir objetivo específico
document.getElementById('addSpecificObjectiveBtn').addEventListener('click', function() {
    openSpecificObjectiveModal(currentPatientId);
});

// Botón para actualizar estado de objetivos
document.getElementById('refreshObjectivesBtn').addEventListener('click', function() {
    updateObjectivesUI(currentPatientId);
    showToast("Objetivos actualizados", "info");
});

// Actualizar configuración inicial al cargar pestaña de diagnóstico
const oldInitDiagnosisTab = initDiagnosisTab;
initDiagnosisTab = async function(patientId) {
    await oldInitDiagnosisTab(patientId);
    updateObjectivesUI(patientId);
};

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
                        <label class="form-label">Duración estimada</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="number" class="form-control" id="planDuration" min="1" max="52" value="4" style="width: 80px;">
                            <select class="form-control" id="planDurationUnit">
                                <option value="semanas">semanas</option>
                                <option value="meses">meses</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Frecuencia de sesiones</label>
                        <div style="display: flex; gap: 10px;">
                            <input type="number" class="form-control" id="planFrequency" min="1" max="7" value="3" style="width: 80px;">
                            <select class="form-control" id="planFrequencyUnit">
                                <option value="sesiones por semana">sesiones por semana</option>
                                <option value="sesiones por mes">sesiones por mes</option>
                            </select>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Objetivos del tratamiento</label>
                        <textarea class="form-control" id="planObjectives" rows="2" placeholder="Defina los objetivos principales de este plan de tratamiento..."></textarea>
                    </div>
                    
                    <div class="accordion active">
                        <div class="accordion-header">
                            <span>Técnicas a utilizar</span>
                            <i class="fas fa-chevron-down accordion-icon"></i>
                        </div>
                        <div class="accordion-body">
                            <!-- Técnicas Manuales -->
                            <div class="techniques-category">
                                <div class="techniques-header">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <input type="checkbox" id="techniqueTM" class="technique-main-check">
                                        <label for="techniqueTM" class="technique-main-label"><strong>Terapia manual</strong></label>
                                    </div>
                                </div>
                                <div class="techniques-subcategories" id="techniqueTMSub" style="display: none; margin-left: 25px; margin-top: 5px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="tmJointMob" class="technique-sub-check">
                                            <label for="tmJointMob">Movilización articular</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="tmJointManip" class="technique-sub-check">
                                            <label for="tmJointManip">Manipulación articular</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="tmMyofascial" class="technique-sub-check">
                                            <label for="tmMyofascial">Liberación miofascial</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="tmNeurodyn" class="technique-sub-check">
                                            <label for="tmNeurodyn">Neurodinamia</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="tmMuscleEnergy" class="technique-sub-check">
                                            <label for="tmMuscleEnergy">Técnicas de energía muscular</label>
                                        </div>
                                    </div>
                                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                                        <label style="font-size: 13px;">Detalles:</label>
                                        <input type="text" class="form-control" id="tmDetails" placeholder="Especifique técnicas, regiones o detalles adicionales..." style="flex-grow: 1;">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Ejercicio Terapéutico -->
                            <div class="techniques-category" style="margin-top: 15px;">
                                <div class="techniques-header">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <input type="checkbox" id="techniqueEJ" class="technique-main-check">
                                        <label for="techniqueEJ" class="technique-main-label"><strong>Ejercicio terapéutico</strong></label>
                                    </div>
                                </div>
                                <div class="techniques-subcategories" id="techniqueEJSub" style="display: none; margin-left: 25px; margin-top: 5px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="ejStrength" class="technique-sub-check">
                                            <label for="ejStrength">Fortalecimiento</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="ejFlex" class="technique-sub-check">
                                            <label for="ejFlex">Flexibilidad</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="ejPropio" class="technique-sub-check">
                                            <label for="ejPropio">Propiocepción</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="ejBalance" class="technique-sub-check">
                                            <label for="ejBalance">Equilibrio</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="ejCardio" class="technique-sub-check">
                                            <label for="ejCardio">Cardiovascular</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="ejFunctional" class="technique-sub-check">
                                            <label for="ejFunctional">Funcional</label>
                                        </div>
                                    </div>
                                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                                        <label style="font-size: 13px;">Detalles:</label>
                                        <input type="text" class="form-control" id="ejDetails" placeholder="Especifique tipos de ejercicios, progresiones, etc..." style="flex-grow: 1;">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Agentes Físicos -->
                            <div class="techniques-category" style="margin-top: 15px;">
                                <div class="techniques-header">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <input type="checkbox" id="techniqueAG" class="technique-main-check">
                                        <label for="techniqueAG" class="technique-main-label"><strong>Agentes físicos</strong></label>
                                    </div>
                                </div>
                                <div class="techniques-subcategories" id="techniqueAGSub" style="display: none; margin-left: 25px; margin-top: 5px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="agThermotherapy" class="technique-sub-check">
                                            <label for="agThermotherapy">Termoterapia</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="agCryotherapy" class="technique-sub-check">
                                            <label for="agCryotherapy">Crioterapia</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="agElectrotherapy" class="technique-sub-check">
                                            <label for="agElectrotherapy">Electroterapia</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="agUltrasound" class="technique-sub-check">
                                            <label for="agUltrasound">Ultrasonido</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="agLaser" class="technique-sub-check">
                                            <label for="agLaser">Láser</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="agShockwave" class="technique-sub-check">
                                            <label for="agShockwave">Ondas de choque</label>
                                        </div>
                                    </div>
                                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                                        <label style="font-size: 13px;">Parámetros:</label>
                                        <input type="text" class="form-control" id="agDetails" placeholder="Especifique parámetros, duración, intensidad, etc..." style="flex-grow: 1;">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Educación al Paciente -->
                            <div class="techniques-category" style="margin-top: 15px;">
                                <div class="techniques-header">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <input type="checkbox" id="techniqueED" class="technique-main-check">
                                        <label for="techniqueED" class="technique-main-label"><strong>Educación al paciente</strong></label>
                                    </div>
                                </div>
                                <div class="techniques-subcategories" id="techniqueEDSub" style="display: none; margin-left: 25px; margin-top: 5px;">
                                    <div style="display: flex; flex-wrap: wrap; gap: 10px;">
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="edPainScience" class="technique-sub-check">
                                            <label for="edPainScience">Educación en neurociencia del dolor</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="edPosture" class="technique-sub-check">
                                            <label for="edPosture">Higiene postural</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="edErgonomics" class="technique-sub-check">
                                            <label for="edErgonomics">Ergonomía</label>
                                        </div>
                                        <div style="display: flex; align-items: center; gap: 5px; min-width: 200px;">
                                            <input type="checkbox" id="edSelfManagement" class="technique-sub-check">
                                            <label for="edSelfManagement">Automanejo</label>
                                        </div>
                                    </div>
                                    <div style="margin-top: 5px; display: flex; align-items: center; gap: 5px;">
                                        <label style="font-size: 13px;">Contenido:</label>
                                        <input type="text" class="form-control" id="edDetails" placeholder="Especifique temas, materiales, estrategias..." style="flex-grow: 1;">
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Otras Técnicas -->
                            <div class="techniques-category" style="margin-top: 15px;">
                                <div class="techniques-header">
                                    <div style="display: flex; align-items: center; gap: 10px;">
                                        <input type="checkbox" id="techniqueOT" class="technique-main-check">
                                        <label for="techniqueOT" class="technique-main-label"><strong>Otras técnicas</strong></label>
                                    </div>
                                </div>
                                <div class="techniques-subcategories" id="techniqueOTSub" style="display: none; margin-left: 25px; margin-top: 5px;">
                                    <input type="text" class="form-control" id="otherTechniques" placeholder="Especifique otras técnicas o enfoques terapéuticos...">
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Progresión planificada</label>
                        <textarea class="form-control" id="planProgression" rows="2" placeholder="Describa cómo se progresará el tratamiento a lo largo del tiempo..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Observaciones y recomendaciones</label>
                        <textarea class="form-control" id="planObservations" rows="3" placeholder="Detalle observaciones específicas para este plan de tratamiento..."></textarea>
                    </div>
                    
                    <div class="form-group">
                        <label class="form-label">Criterios de alta</label>
                        <textarea class="form-control" id="planDischargeGoals" rows="2" placeholder="Defina los criterios para finalizar el tratamiento o dar de alta al paciente..."></textarea>
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
    
    // Configurar eventos para los acordeones
    planModal.querySelectorAll('.accordion-header').forEach(header => {
        header.addEventListener('click', function() {
            this.parentElement.classList.toggle('active');
        });
    });
    
    // Configurar eventos para mostrar/ocultar subcategorías
    planModal.querySelectorAll('.technique-main-check').forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const subcategoryId = this.id + 'Sub';
            const subcategoryContainer = document.getElementById(subcategoryId);
            if (subcategoryContainer) {
                subcategoryContainer.style.display = this.checked ? 'block' : 'none';
            }
        });
    });
    
    // Configurar eventos
    document.getElementById('closeTreatmentPlanModal').addEventListener('click', function() {
        planModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(planModal), 300);
    });
    
    document.getElementById('cancelTreatmentPlanBtn').addEventListener('click', function() {
        planModal.classList.remove('active');
        setTimeout(() => document.body.removeChild(planModal), 300);
    });
    
    document.getElementById('treatmentPlanForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Obtener datos del formulario
        const startDate = document.getElementById('planStartDate').value;
        const duration = document.getElementById('planDuration').value;
        const durationUnit = document.getElementById('planDurationUnit').value;
        const frequency = document.getElementById('planFrequency').value;
        const frequencyUnit = document.getElementById('planFrequencyUnit').value;
        const objectives = document.getElementById('planObjectives').value;
        const progression = document.getElementById('planProgression').value;
        const observations = document.getElementById('planObservations').value;
        const dischargeGoals = document.getElementById('planDischargeGoals').value;
        
        // Recopilar técnicas seleccionadas con sus subcategorías
        const techniques = {};
        
        // Terapia Manual
        if (document.getElementById('techniqueTM').checked) {
            techniques.manual = {
                active: true,
                details: document.getElementById('tmDetails').value,
                subtechniques: {
                    jointMobilization: document.getElementById('tmJointMob').checked,
                    jointManipulation: document.getElementById('tmJointManip').checked,
                    myofascial: document.getElementById('tmMyofascial').checked,
                    neurodynamics: document.getElementById('tmNeurodyn').checked,
                    muscleEnergy: document.getElementById('tmMuscleEnergy').checked
                }
            };
        }
        
        // Ejercicio Terapéutico
        if (document.getElementById('techniqueEJ').checked) {
            techniques.exercise = {
                active: true,
                details: document.getElementById('ejDetails').value,
                subtechniques: {
                    strength: document.getElementById('ejStrength').checked,
                    flexibility: document.getElementById('ejFlex').checked,
                    proprioception: document.getElementById('ejPropio').checked,
                    balance: document.getElementById('ejBalance').checked,
                    cardiovascular: document.getElementById('ejCardio').checked,
                    functional: document.getElementById('ejFunctional').checked
                }
            };
        }
        
        // Agentes Físicos
        if (document.getElementById('techniqueAG').checked) {
            techniques.physical = {
                active: true,
                details: document.getElementById('agDetails').value,
                subtechniques: {
                    thermotherapy: document.getElementById('agThermotherapy').checked,
                    cryotherapy: document.getElementById('agCryotherapy').checked,
                    electrotherapy: document.getElementById('agElectrotherapy').checked,
                    ultrasound: document.getElementById('agUltrasound').checked,
                    laser: document.getElementById('agLaser').checked,
                    shockwave: document.getElementById('agShockwave').checked
                }
            };
        }
        
        // Educación al Paciente
        if (document.getElementById('techniqueED').checked) {
            techniques.education = {
                active: true,
                details: document.getElementById('edDetails').value,
                subtechniques: {
                    painEducation: document.getElementById('edPainScience').checked,
                    posture: document.getElementById('edPosture').checked,
                    ergonomics: document.getElementById('edErgonomics').checked,
                    selfManagement: document.getElementById('edSelfManagement').checked
                }
            };
        }
        
        // Otras Técnicas
        if (document.getElementById('techniqueOT').checked) {
            techniques.other = {
                active: true,
                details: document.getElementById('otherTechniques').value
            };
        }
        
        // Crear estructura para el plan de tratamiento
        const treatmentPlanData = {
            startDate: startDate,
            duration: duration,
            durationUnit: durationUnit,
            frequency: frequency,
            frequencyUnit: frequencyUnit,
            objectives: objectives,
            techniques: techniques,
            progression: progression,
            observations: observations,
            dischargeGoals: dischargeGoals,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        // Guardar en Firebase
        try {
            showLoading();
            
            // Crear referencia a la colección de planes de tratamiento
            const plansRef = collection(db, "patients", patientId, "treatmentPlans");
            
            // Añadir el plan
            const docRef = await addDoc(plansRef, treatmentPlanData);
            
            hideLoading();
            showToast("Plan de tratamiento guardado correctamente", "success");
            
            // Añadir plan a la interfaz
            addTreatmentPlanToUI(treatmentPlanData, docRef.id);
            
            // Cerrar modal
            planModal.classList.remove('active');
            setTimeout(() => document.body.removeChild(planModal), 300);
            
        } catch (error) {
            hideLoading();
            console.error("Error al guardar plan de tratamiento:", error);
            showToast("Error al guardar plan: " + error.message, "error");
        }
    });
}

        // Función para añadir el plan de tratamiento a la UI
function addTreatmentPlanToUI(plan, planId) {
    const treatmentPlanList = document.getElementById('treatmentPlanList');
    if (!treatmentPlanList) return;
    
    const newPlan = document.createElement('div');
    newPlan.className = 'plan-card fade-in';
    newPlan.dataset.id = planId;
    
    // Generar HTML para las técnicas
    let techniquesHTML = '<div class="techniques-list">';
    
    if (plan.techniques.manual && plan.techniques.manual.active) {
        techniquesHTML += '<div class="technique-tag">Terapia manual</div>';
    }
    
    if (plan.techniques.exercise && plan.techniques.exercise.active) {
        techniquesHTML += '<div class="technique-tag">Ejercicio terapéutico</div>';
    }
    
    if (plan.techniques.physical && plan.techniques.physical.active) {
        techniquesHTML += '<div class="technique-tag">Agentes físicos</div>';
    }
    
    if (plan.techniques.education && plan.techniques.education.active) {
        techniquesHTML += '<div class="technique-tag">Educación al paciente</div>';
    }
    
    if (plan.techniques.other && plan.techniques.other.active) {
        techniquesHTML += '<div class="technique-tag">Otras técnicas</div>';
    }
    
    techniquesHTML += '</div>';
    
    newPlan.innerHTML = `
        <div class="plan-header">
            <div class="plan-title">
                <i class="fas fa-clipboard-list"></i>
                Plan de Tratamiento
            </div>
            <div class="plan-date">${formatDate(new Date(plan.startDate))}</div>
        </div>
        <div class="plan-details">
            <div class="plan-row">
                <div class="plan-label">Duración:</div>
                <div class="plan-value">${plan.duration} ${plan.durationUnit}</div>
            </div>
            <div class="plan-row">
                <div class="plan-label">Frecuencia:</div>
                <div class="plan-value">${plan.frequency} ${plan.frequencyUnit}</div>
            </div>
            <div class="plan-row">
                <div class="plan-label">Técnicas:</div>
                <div class="plan-value">
                    ${techniquesHTML}
                </div>
            </div>
            ${plan.objectives ? `
            <div class="plan-row">
                <div class="plan-label">Objetivos:</div>
                <div class="plan-value">
                    ${plan.objectives}
                </div>
            </div>
            ` : ''}
            ${plan.observations ? `
            <div class="plan-row">
                <div class="plan-label">Observaciones:</div>
                <div class="plan-value">
                    ${plan.observations}
                </div>
            </div>
            ` : ''}
        </div>
        <div class="plan-actions" style="text-align: right; margin-top: 10px;">
            <button class="action-btn btn-secondary view-plan-btn">
                <i class="fas fa-eye"></i> Ver detalles
            </button>
            <button class="action-btn btn-secondary delete-plan-btn" style="background-color: var(--accent2-light);">
                <i class="fas fa-trash"></i> Eliminar
            </button>
        </div>
    `;
    
    // Añadir al inicio para mayor visibilidad
    if (treatmentPlanList.firstChild) {
        treatmentPlanList.insertBefore(newPlan, treatmentPlanList.firstChild);
    } else {
        treatmentPlanList.appendChild(newPlan);
    }
    
    // Añadir eventos a los botones
    const viewBtn = newPlan.querySelector('.view-plan-btn');
    const deleteBtn = newPlan.querySelector('.delete-plan-btn');
    
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            // Implementar vista detallada del plan
            viewTreatmentPlan(planId);
        });
    }
    
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            // Implementar eliminación del plan
            deleteTreatmentPlan(planId);
        });
    }
}

        // Ver detalles del plan de tratamiento
async function viewTreatmentPlan(planId) {
    try {
        showLoading();
        
        // Obtener el plan desde Firebase
        const planRef = doc(db, "patients", currentPatientId, "treatmentPlans", planId);
        const planSnap = await getDoc(planRef);
        
        if (planSnap.exists()) {
            const plan = planSnap.data();
            
            // Crear modal para mostrar detalles
            const viewModal = document.createElement('div');
            viewModal.className = 'modal-overlay';
            viewModal.id = 'viewTreatmentPlanModal';
            
            // Generar HTML para técnicas
            let techniquesHTML = '';
            
            if (plan.techniques.manual && plan.techniques.manual.active) {
                const subs = plan.techniques.manual.subtechniques || {};
                const subTechniques = [];
                
                if (subs.jointMobilization) subTechniques.push("Movilización articular");
                if (subs.jointManipulation) subTechniques.push("Manipulación articular");
                if (subs.myofascial) subTechniques.push("Liberación miofascial");
                if (subs.neurodynamics) subTechniques.push("Neurodinamia");
                if (subs.muscleEnergy) subTechniques.push("Técnicas de energía muscular");
                
                techniquesHTML += `
                    <div class="technique-detail">
                        <div class="technique-title"><i class="fas fa-hands"></i> Terapia manual</div>
                        ${subTechniques.length > 0 ? `
                            <div class="technique-subtechniques">
                                ${subTechniques.map(sub => `<div class="subtechnique-item">${sub}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${plan.techniques.manual.details ? `
                            <div class="technique-notes">
                                <strong>Detalles:</strong> ${plan.techniques.manual.details}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            if (plan.techniques.exercise && plan.techniques.exercise.active) {
                const subs = plan.techniques.exercise.subtechniques || {};
                const subTechniques = [];
                
                if (subs.strength) subTechniques.push("Fortalecimiento");
                if (subs.flexibility) subTechniques.push("Flexibilidad");
                if (subs.proprioception) subTechniques.push("Propiocepción");
                if (subs.balance) subTechniques.push("Equilibrio");
                if (subs.cardiovascular) subTechniques.push("Cardiovascular");
                if (subs.functional) subTechniques.push("Funcional");
                
                techniquesHTML += `
                    <div class="technique-detail">
                        <div class="technique-title"><i class="fas fa-dumbbell"></i> Ejercicio terapéutico</div>
                        ${subTechniques.length > 0 ? `
                            <div class="technique-subtechniques">
                                ${subTechniques.map(sub => `<div class="subtechnique-item">${sub}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${plan.techniques.exercise.details ? `
                            <div class="technique-notes">
                                <strong>Detalles:</strong> ${plan.techniques.exercise.details}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            if (plan.techniques.physical && plan.techniques.physical.active) {
                const subs = plan.techniques.physical.subtechniques || {};
                const subTechniques = [];
                
                if (subs.thermotherapy) subTechniques.push("Termoterapia");
                if (subs.cryotherapy) subTechniques.push("Crioterapia");
                if (subs.electrotherapy) subTechniques.push("Electroterapia");
                if (subs.ultrasound) subTechniques.push("Ultrasonido");
                if (subs.laser) subTechniques.push("Láser");
                if (subs.shockwave) subTechniques.push("Ondas de choque");
                
                techniquesHTML += `
                    <div class="technique-detail">
                        <div class="technique-title"><i class="fas fa-bolt"></i> Agentes físicos</div>
                        ${subTechniques.length > 0 ? `
                            <div class="technique-subtechniques">
                                ${subTechniques.map(sub => `<div class="subtechnique-item">${sub}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${plan.techniques.physical.details ? `
                            <div class="technique-notes">
                                <strong>Parámetros:</strong> ${plan.techniques.physical.details}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            if (plan.techniques.education && plan.techniques.education.active) {
                const subs = plan.techniques.education.subtechniques || {};
                const subTechniques = [];
                
                if (subs.painEducation) subTechniques.push("Educación en neurociencia del dolor");
                if (subs.posture) subTechniques.push("Higiene postural");
                if (subs.ergonomics) subTechniques.push("Ergonomía");
                if (subs.selfManagement) subTechniques.push("Automanejo");
                
                techniquesHTML += `
                    <div class="technique-detail">
                        <div class="technique-title"><i class="fas fa-chalkboard-teacher"></i> Educación al paciente</div>
                        ${subTechniques.length > 0 ? `
                            <div class="technique-subtechniques">
                                ${subTechniques.map(sub => `<div class="subtechnique-item">${sub}</div>`).join('')}
                            </div>
                        ` : ''}
                        ${plan.techniques.education.details ? `
                            <div class="technique-notes">
                                <strong>Contenido:</strong> ${plan.techniques.education.details}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            if (plan.techniques.other && plan.techniques.other.active) {
                techniquesHTML += `
                    <div class="technique-detail">
                        <div class="technique-title"><i class="fas fa-plus-circle"></i> Otras técnicas</div>
                        ${plan.techniques.other.details ? `
                            <div class="technique-notes">
                                ${plan.techniques.other.details}
                            </div>
                        ` : ''}
                    </div>
                `;
            }
            
            viewModal.innerHTML = `
                <div class="modal">
                    <div class="modal-header">
                        <h2 class="modal-title">Plan de tratamiento</h2>
                        <button class="modal-close" id="closeViewPlanModal">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                    <div class="modal-body">
                        <div style="background-color: var(--background-alt); padding: 15px; border-radius: 8px; margin-bottom: 20px;">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <div style="font-size: 18px; font-weight: bold; color: var(--primary);">
                                    <i class="fas fa-calendar-alt"></i> Detalles del plan
                                </div>
                                <div style="font-size: 14px;">
                                    Inicio: ${formatDate(new Date(plan.startDate))}
                                </div>
                            </div>
                            <div style="margin-top: 10px; display: flex; flex-wrap: wrap; gap: 15px;">
                                <div style="flex: 1; min-width: 150px;">
                                    <div style="font-weight: bold; margin-bottom: 5px;">Duración</div>
                                    <div>${plan.duration} ${plan.durationUnit}</div>
                                </div>
                                <div style="flex: 1; min-width: 150px;">
                                    <div style="font-weight: bold; margin-bottom: 5px;">Frecuencia</div>
                                    <div>${plan.frequency} ${plan.frequencyUnit}</div>
                                </div>
                            </div>
                        </div>
                        
                        ${plan.objectives ? `
                        <div class="detail-section">
                            <div class="detail-title">Objetivos</div>
                            <div class="detail-content">${plan.objectives}</div>
                        </div>
                        ` : ''}
                        
                        <div class="detail-section">
                            <div class="detail-title">Técnicas de tratamiento</div>
                            <div class="detail-content" style="padding: 5px 0;">
                                ${techniquesHTML || 'No se especificaron técnicas.'}
                            </div>
                        </div>
                        
                        ${plan.progression ? `
                        <div class="detail-section">
                            <div class="detail-title">Progresión planificada</div>
                            <div class="detail-content">${plan.progression}</div>
                        </div>
                        ` : ''}
                        
                        ${plan.observations ? `
                        <div class="detail-section">
                            <div class="detail-title">Observaciones</div>
                            <div class="detail-content">${plan.observations}</div>
                        </div>
                        ` : ''}
                        
                        ${plan.dischargeGoals ? `
                        <div class="detail-section">
                            <div class="detail-title">Criterios de alta</div>
                            <div class="detail-content">${plan.dischargeGoals}</div>
                        </div>
                        ` : ''}
                        
                        <div style="margin-top: 20px; text-align: right;">
                            <button class="action-btn btn-secondary" id="closeViewPlanBtn">Cerrar</button>
                        </div>
                    </div>
                </div>
            `;
            
            document.body.appendChild(viewModal);
            
            // Añadir estilos para esta vista específica
            const styleEl = document.createElement('style');
            styleEl.innerHTML = `
                .detail-section {
                    margin-bottom: 15px;
                    border-bottom: 1px solid var(--border);
                    padding-bottom: 15px;
                }
                .detail-title {
                    font-weight: bold;
                    color: var(--primary);
                    margin-bottom: 5px;
                    font-size: 16px;
                }
                .technique-detail {
                    margin-bottom: 15px;
                    background-color: var(--background);
                    border-radius: 6px;
                    padding: 10px;
                }
                .technique-title {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                .technique-subtechniques {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 5px;
                    margin: 5px 0;
                }
                .subtechnique-item {
                    background-color: var(--background-alt);
                    border-radius: 4px;
                    padding: 3px 8px;
                    font-size: 13px;
                }
                .technique-notes {
                    font-size: 14px;
                    margin-top: 5px;
                    color: var(--text-secondary);
                }
            `;
            viewModal.appendChild(styleEl);
            
            setTimeout(() => viewModal.classList.add('active'), 50);
            
            // Añadir eventos a los botones
            document.getElementById('closeViewPlanModal').addEventListener('click', function() {
                viewModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(viewModal), 300);
            });
            
            document.getElementById('closeViewPlanBtn').addEventListener('click', function() {
                viewModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(viewModal), 300);
            });
            
            hideLoading();
        } else {
            hideLoading();
            showToast("Plan de tratamiento no encontrado", "error");
        }
    } catch (error) {
        hideLoading();
        console.error("Error al cargar plan de tratamiento:", error);
        showToast("Error al cargar plan: " + error.message, "error");
    }
}

// Eliminar plan de tratamiento
async function deleteTreatmentPlan(planId) {
    if (!confirm("¿Está seguro que desea eliminar este plan de tratamiento? Esta acción no se puede deshacer.")) {
        return;
    }
    
    try {
        showLoading();
        
        // Eliminar de Firebase
        const planRef = doc(db, "patients", currentPatientId, "treatmentPlans", planId);
        await deleteDoc(planRef);
        
        // Eliminar de la interfaz
        const planElement = document.querySelector(`.plan-card[data-id="${planId}"]`);
        if (planElement && planElement.parentNode) {
            planElement.parentNode.removeChild(planElement);
        }
        
        hideLoading();
        showToast("Plan de tratamiento eliminado correctamente", "success");
    } catch (error) {
        hideLoading();
        console.error("Error al eliminar plan de tratamiento:", error);
        showToast("Error al eliminar plan: " + error.message, "error");
    }
}

        // Cargar planes de tratamiento
async function loadTreatmentPlans(patientId) {
    try {
        const treatmentPlanList = document.getElementById('treatmentPlanList');
        if (!treatmentPlanList) return;
        
        // Limpiar lista actual
        treatmentPlanList.innerHTML = '';
        
        // Obtener planes desde Firebase
        const plansRef = collection(db, "patients", patientId, "treatmentPlans");
        const plansQuery = query(plansRef, orderBy("createdAt", "desc"));
        const plansSnapshot = await getDocs(plansQuery);
        
        if (plansSnapshot.empty) {
            treatmentPlanList.innerHTML = '<p style="color: var(--text-secondary); font-style: italic;">No hay planes de tratamiento registrados.</p>';
            return;
        }
        
        // Mostrar cada plan
        plansSnapshot.docs.forEach(doc => {
            const plan = doc.data();
            addTreatmentPlanToUI(plan, doc.id);
        });
    } catch (error) {
        console.error("Error al cargar planes de tratamiento:", error);
        const treatmentPlanList = document.getElementById('treatmentPlanList');
        if (treatmentPlanList) {
            treatmentPlanList.innerHTML = '<p style="color: var(--accent2); font-style: italic;">Error al cargar planes de tratamiento.</p>';
        }
    }
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

        // Función para editar una evolución existente
function editEvolution(patientId, evolution) {
    try {
        if (!patientId || !evolution) {
            showToast("Error: Datos de evolución incompletos", "error");
            return;
        }
        
        // Usando la misma modal pero con datos prellenados
        const modal = document.getElementById('newEvolutionModal');
        if (!modal) {
            showToast("Error: Modal de evolución no encontrada", "error");
            return;
        }
        
        // Cambiar título para indicar edición
        const modalTitle = document.getElementById('evolutionModalTitle');
        if (modalTitle) {
            modalTitle.textContent = `Editar evolución - ${formatDate(new Date(evolution.date))}`;
        }
        
        // Llenar formulario con datos existentes
        const dateInput = document.getElementById('evolutionDate');
        const timeInput = document.getElementById('evolutionTime');
        const studentInput = document.getElementById('evolutionStudent');
        const stateInput = document.getElementById('evolutionPatientState');
        const treatmentInput = document.getElementById('evolutionTreatment');
        const responseInput = document.getElementById('evolutionResponse');
        const trainPlanInput = document.getElementById('evolutionTrainingPlan');
        const observationsInput = document.getElementById('evolutionObservations');
        
        if (dateInput) dateInput.value = evolution.date || '';
        if (timeInput) timeInput.value = evolution.time || '';
        if (studentInput) studentInput.value = evolution.student || '';
        if (stateInput) stateInput.value = evolution.patientState || '';
        if (treatmentInput) treatmentInput.value = evolution.treatment || '';
        if (responseInput) responseInput.value = evolution.response || '';
        if (trainPlanInput) trainPlanInput.value = evolution.trainingPlan || '';
        if (observationsInput) observationsInput.value = evolution.observations || '';
        
        // Configurar escalas si existen
        if (evolution.scales) {
            // EVA (dolor)
            const evaRange = document.getElementById('evaRange');
            const evaValue = document.getElementById('evaValue');
            const evaMarker = document.querySelector('.eva-scale .scale-marker');
            
            if (evaRange && evolution.scales.eva !== undefined) {
                evaRange.value = evolution.scales.eva;
                if (evaValue) evaValue.textContent = `${evolution.scales.eva}/10`;
                if (evaMarker) evaMarker.style.left = `${evolution.scales.eva * 10}%`;
            }
            
            // GROC (cambio global)
            const grocRange = document.getElementById('grocRange');
            const grocValue = document.getElementById('grocValue');
            const grocMarker = document.querySelector('.groc-marker');
            
            if (grocRange && evolution.scales.groc !== undefined) {
                grocRange.value = evolution.scales.groc;
                if (grocValue) grocValue.textContent = evolution.scales.groc > 0 ? `+${evolution.scales.groc}` : `${evolution.scales.groc}`;
                const percentage = ((parseFloat(evolution.scales.groc) + 7) / 14) * 100;
                if (grocMarker) grocMarker.style.left = `${percentage}%`;
            }
            
            // SANE (evaluación numérica)
            const saneRange = document.getElementById('saneRange');
            const saneValue = document.getElementById('saneValue');
            const saneCircleValue = document.querySelector('.sane-value');
            const saneBar = document.querySelector('.sane-bar');
            
            if (saneRange && evolution.scales.sane !== undefined) {
                saneRange.value = evolution.scales.sane;
                if (saneValue) saneValue.textContent = `${evolution.scales.sane}%`;
                if (saneCircleValue) saneCircleValue.textContent = `${evolution.scales.sane}%`;
                if (saneBar) saneBar.style.width = `${evolution.scales.sane}%`;
                
                // Actualizar círculo SVG
                const circle = document.querySelector('.sane-circle svg circle:nth-child(2)');
                if (circle) {
                    const circumference = 2 * Math.PI * 35;
                    const offset = circumference - (circumference * evolution.scales.sane / 100);
                    circle.setAttribute('stroke-dashoffset', offset);
                }
            }
            
            // PSFS (actividades)
            const psfsContainer = document.getElementById('psfsActivities');
            if (psfsContainer && evolution.scales.psfs && evolution.scales.psfs.length > 0) {
                // Limpiar actividades existentes
                psfsContainer.innerHTML = '';
                
                // Añadir actividades de la evolución
                evolution.scales.psfs.forEach(activity => {
                    if (!activity || !activity.name) return;
                    
                    const newActivity = document.createElement('div');
                    newActivity.className = 'psfs-activity';
                    
                    newActivity.innerHTML = `
                        <div class="activity-name" style="display: flex; align-items: center; gap: 5px;">
                            <input type="text" class="psfs-activity-input" value="${activity.name}" style="flex-grow: 1;">
                            <button type="button" class="delete-activity-btn">
                                <i class="fas fa-times"></i>
                            </button>
                        </div>
                        <div class="activity-rating" style="margin-top: 5px;">
                            <div class="rating-number">${activity.rating || 5}</div>
                            <div class="rating-bar">
                                <div class="rating-value" style="width: ${(activity.rating || 5) * 10}%;"></div>
                            </div>
                            <div class="rating-number">10</div>
                        </div>
                        <input type="range" min="0" max="10" value="${activity.rating || 5}" class="psfs-slider">
                    `;
                    
                    psfsContainer.appendChild(newActivity);
                    
                    // Añadir evento al slider
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
                            psfsContainer.removeChild(newActivity);
                        });
                    }
                });
            }
        }
        
        // Cargar ejercicios si existen
        const exerciseTableBody = document.getElementById('exerciseTableBody');
        if (exerciseTableBody && evolution.exercises && evolution.exercises.length > 0) {
            // Limpiar tabla de ejercicios
            exerciseTableBody.innerHTML = '';
            
            // Añadir ejercicios existentes
            evolution.exercises.forEach(exercise => {
                addExerciseRow(exercise);
            });
        } else if (exerciseTableBody) {
            // Limpiar tabla si no hay ejercicios
            exerciseTableBody.innerHTML = '';
        }
        
        // Modificar evento de envío del formulario para actualizar en lugar de crear
        const form = document.getElementById('evolutionForm');
        if (form) {
            // Clonar y reemplazar para eliminar event listeners anteriores
            const newForm = form.cloneNode(true);
            form.parentNode.replaceChild(newForm, form);
            
            // Añadir nuevo event listener
            newForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                
                try {
                    showLoading();
                    
                    // Recopilar datos
                    const psfsActivities = getPsfsActivities();
                    const exercises = getExercisesData();
                    
                    // Construir datos actualizados
                    const updatedData = {
                        date: document.getElementById('evolutionDate')?.value || evolution.date,
                        time: document.getElementById('evolutionTime')?.value || evolution.time,
                        student: document.getElementById('evolutionStudent')?.value || evolution.student,
                        patientState: document.getElementById('evolutionPatientState')?.value || evolution.patientState,
                        treatment: document.getElementById('evolutionTreatment')?.value || evolution.treatment,
                        response: document.getElementById('evolutionResponse')?.value || evolution.response,
                        scales: {
                            eva: parseInt(document.getElementById('evaRange')?.value || evolution.scales?.eva || 5),
                            groc: parseInt(document.getElementById('grocRange')?.value || evolution.scales?.groc || 0),
                            sane: parseInt(document.getElementById('saneRange')?.value || evolution.scales?.sane || 70),
                            saneText: document.getElementById('saneCustomText')?.value || evolution.scales?.saneText || '',
                            psfs: psfsActivities
                        },
                        exercises: exercises,
                        trainingPlan: document.getElementById('evolutionTrainingPlan')?.value || evolution.trainingPlan || '',
                        observations: document.getElementById('evolutionObservations')?.value || evolution.observations || '',
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Actualizar en Firebase
                    const evolutionRef = doc(db, "patients", patientId, "evolutions", evolution.id);
                    await updateDoc(evolutionRef, updatedData);
                    
                    // Verificar si la fecha cambió y es la última evolución
                    if (updatedData.date !== evolution.date) {
                        const evolutions = await getEvolutions(patientId);
                        
                        if (evolutions.length > 0) {
                            // Ordenar por fecha (la más reciente primero)
                            evolutions.sort((a, b) => new Date(b.date) - new Date(a.date));
                            
                            // Actualizar lastSession si esta evolución es ahora la más reciente
                            const formattedDate = formatDate(new Date(evolutions[0].date));
                            await updateDoc(doc(db, "patients", patientId), {
                                lastSession: formattedDate,
                                updatedAt: new Date().toISOString()
                            });
                            
                            // Actualizar caché
                            const cachedPatientIndex = patientsCache.findIndex(p => p.id === patientId);
                            if (cachedPatientIndex >= 0) {
                                patientsCache[cachedPatientIndex].lastSession = formattedDate;
                                patientsCache[cachedPatientIndex].updatedAt = new Date().toISOString();
                            }
                        }
                    }
                    
                    // Actualizar la interfaz
                    const updatedEvolutions = await getEvolutions(patientId);
                    fillEvolutionsTab(updatedEvolutions);
                    
                    // Cerrar modal
                    modal.classList.remove('active');
                    
                    // Refrescar lista de pacientes
                    await getPatients();
                    
                    hideLoading();
                    showToast("Evolución actualizada correctamente", "success");
                } catch (error) {
                    hideLoading();
                    console.error("Error al actualizar evolución:", error);
                    showToast("Error al actualizar evolución: " + error.message, "error");
                }
            });
        }
        
        // Mostrar modal
        modal.classList.add('active');
        
    } catch (error) {
        console.error("Error al editar evolución:", error);
        showToast("Error al abrir formulario de edición: " + error.message, "error");
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



async function exportToPDF(patientId) {
    try {
        showLoading();
        console.log("=== INICIANDO EXPORTACIÓN A PDF ===");
        
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
            showToast("Error: No se pudo obtener datos del paciente", "error");
            return;
        }
        
        console.log("Paciente recuperado:", patient.name);
        
        // Get evolutions
        const evolutions = await getEvolutions(patientId);
        console.log(`Evoluciones recuperadas: ${evolutions.length}`);
        
        // Obtener diagnósticos del paciente
        console.log("Obteniendo diagnósticos...");
        const diagnosesRef = collection(db, "patients", patientId, "diagnoses");
        const diagnosesQuery = query(diagnosesRef, orderBy("createdAt", "desc"));
        const diagnosesSnapshot = await getDocs(diagnosesQuery);
        
        let diagnoses = [];
        if (!diagnosesSnapshot.empty) {
            diagnoses = diagnosesSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`Diagnósticos recuperados: ${diagnoses.length}`);
        } else {
            console.log("No se encontraron diagnósticos");
        }
        
        // Obtener datos CIF
        console.log("Obteniendo datos CIF...");
        const cifFunctions = await getCifFunctions(patientId);
        const cifStructures = await getCifStructures(patientId);
        const cifActivities = await getCifActivities(patientId);
        const cifFactors = await getCifFactors(patientId);
        
        console.log(`Datos CIF recuperados: 
            - Funciones: ${cifFunctions.length}
            - Estructuras: ${cifStructures.length}
            - Actividades: ${cifActivities.length}
            - Factores: ${cifFactors.length}`);
        
        // Obtener objetivos terapéuticos - MEJORADO
        console.log("Obteniendo objetivos terapéuticos...");
        let generalObjective = null;
        let specificObjectives = [];
        
        try {
            // Objetivo general
            const generalRef = doc(db, "patients", patientId, "objectives", "general");
            const generalSnap = await getDoc(generalRef);
            if (generalSnap.exists()) {
                generalObjective = generalSnap.data();
                console.log("✅ Objetivo general encontrado");
            } else {
                console.log("⚠️ No se encontró objetivo general");
            }
            
            // Objetivos específicos
            const objectivesRef = collection(db, "patients", patientId, "objectives");
            const objectivesQuery = query(objectivesRef, where(documentId(), "!=", "general"));
            const objectivesSnap = await getDocs(objectivesQuery);
            
            if (!objectivesSnap.empty) {
                specificObjectives = objectivesSnap.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`✅ Se encontraron ${specificObjectives.length} objetivos específicos`);
            } else {
                console.log("⚠️ No se encontraron objetivos específicos");
            }
        } catch (error) {
            console.error("❌ Error al obtener objetivos:", error);
        }
        
        // Obtener planes de tratamiento - MEJORADO
        console.log("Obteniendo planes de tratamiento...");
        let treatmentPlans = [];
        try {
            const plansRef = collection(db, "patients", patientId, "treatmentPlans");
            const plansQuery = query(plansRef, orderBy("createdAt", "desc"));
            const plansSnapshot = await getDocs(plansQuery);
            
            if (!plansSnapshot.empty) {
                treatmentPlans = plansSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                console.log(`✅ Se encontraron ${treatmentPlans.length} planes de tratamiento`);
            } else {
                console.log("⚠️ No se encontraron planes de tratamiento");
            }
        } catch (error) {
            console.error("❌ Error al obtener planes de tratamiento:", error);
        }
        
        // Leer opciones del formulario
        console.log("Leyendo opciones del formulario PDF...");
        const pdfForm = document.getElementById('pdfOptionsForm');
        
        function getCheckboxValue(id) {
            const checkbox = document.getElementById(id);
            if (checkbox) {
                console.log(`Checkbox ${id}: ${checkbox.checked}`);
                return checkbox.checked;
            }
            console.log(`Checkbox ${id} no encontrado, usando valor predeterminado: true`);
            return true;
        }
        
        // IMPORTANTE: Forzar inclusión de estas secciones
        const includeDiagnosis = true; // Siempre incluir diagnósticos
        const includeObjectives = true; // Siempre incluir objetivos
        const includePlans = true; // Siempre incluir planes
        
        // Estas opciones sí se leen del formulario
        const includeEvolutions = getCheckboxValue('pdfIncludeEvolutions');
        const includeScales = getCheckboxValue('pdfIncludeScales');
        const includeExercises = getCheckboxValue('pdfIncludeExercises');
        const includeLogo = getCheckboxValue('pdfIncludeLogo');
        const includeFooter = getCheckboxValue('pdfIncludeFooter');
        
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
        
        console.log(`Usando ${filteredEvolutions.length} evoluciones de un total de ${evolutions.length}`);
        
        // Create a new PDF using jsPDF
        console.log("Creando documento PDF...");
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
        doc.text(`Teléfono: ${patient.phone || 'No reporta'}`, 15, 60);
        doc.text(`Fecha del informe: ${formatDate(new Date())}`, 15, 70);
        
        if (centerAddress) {
            doc.text(`Centro: ${centerName} - ${centerAddress}`, 15, 80);
        }
        
        // Añadir información adicional del paciente
        let yPos = 100;
        
        // Sección de datos personales
        doc.setFillColor(30, 136, 229);
        doc.rect(10, yPos, 190, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('DATOS PERSONALES', 105, yPos + 7, null, null, 'center');
        
        yPos += 20;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        // Fecha de nacimiento
        if (patient.birthDate) {
            doc.text(`Fecha de nacimiento: ${formatDate(new Date(patient.birthDate))}`, 15, yPos);
        } else {
            doc.text("Fecha de nacimiento: No reporta", 15, yPos);
        }
        yPos += 10;
        
        // Email y dirección
        doc.text(`Email: ${patient.email || 'No reporta'}`, 15, yPos);
        yPos += 10;
        doc.text(`Dirección: ${patient.address || 'No reporta'}`, 15, yPos);
        yPos += 10;
        
        // Historia médica
        doc.setFont(undefined, 'bold');
        doc.text("Historia médica:", 15, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        
        if (patient.medicalHistory) {
            const historyLines = doc.splitTextToSize(patient.medicalHistory, 180);
            doc.text(historyLines, 15, yPos);
            yPos += historyLines.length * 7 + 5;
        } else {
            doc.text("No reporta", 15, yPos);
            yPos += 10;
        }
        
        // Medicamentos
        doc.setFont(undefined, 'bold');
        doc.text("Medicamentos:", 15, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        
        if (patient.medications) {
            const medicationsLines = doc.splitTextToSize(patient.medications, 180);
            doc.text(medicationsLines, 15, yPos);
            yPos += medicationsLines.length * 7 + 5;
        } else {
            doc.text("No reporta", 15, yPos);
            yPos += 10;
        }
        
        // Alergias
        doc.setFont(undefined, 'bold');
        doc.text("Alergias:", 15, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        
        if (patient.allergies) {
            const allergiesLines = doc.splitTextToSize(patient.allergies, 180);
            doc.text(allergiesLines, 15, yPos);
            yPos += allergiesLines.length * 7 + 5;
        } else {
            doc.text("No reporta", 15, yPos);
            yPos += 10;
        }
        
        // Contacto de emergencia
        doc.setFont(undefined, 'bold');
        doc.text("Contacto de emergencia:", 15, yPos);
        yPos += 7;
        doc.setFont(undefined, 'normal');
        
        if (patient.emergencyContact || patient.emergencyPhone) {
            doc.text(`${patient.emergencyContact || 'No reporta'} - ${patient.emergencyPhone || 'No reporta'}`, 15, yPos);
        } else {
            doc.text("No reporta", 15, yPos);
        }
        yPos += 15;
        
        // === SECCIÓN DE DIAGNÓSTICOS ===
        if (includeDiagnosis) {
            console.log("Añadiendo sección de diagnósticos al PDF...");
            // Check if we need a new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFillColor(30, 136, 229);
            doc.rect(10, yPos, 190, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('DIAGNÓSTICO KINESIOLÓGICO', 105, yPos + 7, null, null, 'center');
            
            // Reset font
            doc.setFont(undefined, 'normal');
            yPos += 20;
            
            // Add diagnosis info
            doc.setFontSize(11);
            doc.setTextColor(0, 0, 0);
            
            if (diagnoses && diagnoses.length > 0) {
                // Sort diagnoses from newest to oldest
                diagnoses.sort((a, b) => {
                    if (!a.date || !b.date) return 0;
                    return new Date(b.date) - new Date(a.date);
                });
                
                // Mostrar TODOS los diagnósticos, no solo el más reciente
                for (let i = 0; i < diagnoses.length; i++) {
                    const diagnosis = diagnoses[i];
                    
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    // Date with background
                    doc.setFillColor(230, 240, 250);
                    doc.rect(10, yPos - 5, 190, 10, 'F');
                    doc.setTextColor(30, 136, 229);
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    doc.text(`Evaluación: ${formatDate(new Date(diagnosis.date))}`, 15, yPos);
                    yPos += 15;
                    
                    // Reset font
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(11);
                    
                    // Código CIE
                    if (diagnosis.code) {
                        doc.setFont(undefined, 'bold');
                        doc.text(`Diagnóstico médico:`, 15, yPos);
                        doc.setFont(undefined, 'normal');
                        doc.text(diagnosis.code, 80, yPos);
                        yPos += 10;
                    }
                    
                    // Motivo de consulta
                    if (diagnosis.consultReason) {
                        doc.setFont(undefined, 'bold');
                        doc.text("Motivo de consulta:", 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        const reasonLines = doc.splitTextToSize(diagnosis.consultReason, 180);
                        doc.text(reasonLines, 15, yPos);
                        yPos += reasonLines.length * 7 + 5;
                    }
                    
                    // Antecedentes médicos
                    if (diagnosis.medicalBackground) {
                        doc.setFont(undefined, 'bold');
                        doc.text("Antecedentes relevantes:", 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        const backgroundLines = doc.splitTextToSize(diagnosis.medicalBackground, 180);
                        doc.text(backgroundLines, 15, yPos);
                        yPos += backgroundLines.length * 7 + 5;
                    }
                    
                    // Descripción del diagnóstico - ASEGURANDO QUE APAREZCA COMPLETO
                    doc.setFont(undefined, 'bold');
                    doc.text("Diagnóstico kinesiológico funcional:", 15, yPos);
                    yPos += 7;
                    
                    doc.setFont(undefined, 'normal');
                    if (diagnosis.description) {
                        const diagnosisLines = doc.splitTextToSize(diagnosis.description, 180);
                        doc.text(diagnosisLines, 15, yPos);
                        yPos += diagnosisLines.length * 7 + 10;
                    } else {
                        doc.text("No se ha registrado descripción del diagnóstico", 15, yPos);
                        yPos += 10;
                    }
                    
                    // Add separator line between diagnoses
                    if (i < diagnoses.length - 1) {
                        doc.setDrawColor(200, 200, 200);
                        doc.line(15, yPos - 5, 195, yPos - 5);
                        yPos += 5;
                    }
                }
            } else {
                doc.text("No se ha registrado un diagnóstico formal para este paciente.", 15, yPos);
                yPos += 10;
            }
            
            // Check if we need a new page
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
            // AÑADIR SECCIÓN DE CIF
            if (cifFunctions.length > 0 || cifStructures.length > 0 || cifActivities.length > 0 || cifFactors.length > 0) {
                doc.setFillColor(30, 136, 229);
                doc.rect(10, yPos, 190, 10, 'F');
                doc.setTextColor(255, 255, 255);
                doc.setFontSize(12);
                doc.setFont(undefined, 'bold');
                doc.text('CLASIFICACIÓN INTERNACIONAL DEL FUNCIONAMIENTO (CIF)', 105, yPos + 7, null, null, 'center');
                yPos += 20;
                
                doc.setTextColor(0, 0, 0);
                
                // Funciones corporales
                if (cifFunctions.length > 0) {
                    doc.setFont(undefined, 'bold');
                    doc.text("Funciones corporales (b):", 15, yPos);
                    yPos += 7;
                    doc.setFont(undefined, 'normal');
                    
                    cifFunctions.forEach(func => {
                        doc.text(`${func.code}: ${func.name} - Valor: ${func.value}`, 20, yPos);
                        yPos += 7;
                        
                        if (func.description) {
                            const descLines = doc.splitTextToSize(func.description, 175);
                            doc.text(descLines, 25, yPos);
                            yPos += descLines.length * 7 + 3;
                        }
                    });
                    
                    yPos += 5;
                }
                
                // Estructuras corporales
                if (cifStructures.length > 0) {
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFont(undefined, 'bold');
                    doc.text("Estructuras corporales (s):", 15, yPos);
                    yPos += 7;
                    doc.setFont(undefined, 'normal');
                    
                    cifStructures.forEach(struct => {
                        doc.text(`${struct.code}: ${struct.name} - Valor: ${struct.value}`, 20, yPos);
                        yPos += 7;
                        
                        if (struct.description) {
                            const descLines = doc.splitTextToSize(struct.description, 175);
                            doc.text(descLines, 25, yPos);
                            yPos += descLines.length * 7 + 3;
                        }
                    });
                    
                    yPos += 5;
                }
                
                // Actividades y participación
                if (cifActivities.length > 0) {
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFont(undefined, 'bold');
                    doc.text("Actividades y participación (d):", 15, yPos);
                    yPos += 7;
                    doc.setFont(undefined, 'normal');
                    
                    cifActivities.forEach(activity => {
                        doc.text(`${activity.code}: ${activity.name} - Valor: ${activity.value}`, 20, yPos);
                        yPos += 7;
                        
                        if (activity.description) {
                            const descLines = doc.splitTextToSize(activity.description, 175);
                            doc.text(descLines, 25, yPos);
                            yPos += descLines.length * 7 + 3;
                        }
                    });
                    
                    yPos += 5;
                }
                
                // Factores ambientales
                if (cifFactors.length > 0) {
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFont(undefined, 'bold');
                    doc.text("Factores ambientales (e):", 15, yPos);
                    yPos += 7;
                    doc.setFont(undefined, 'normal');
                    
                    cifFactors.forEach(factor => {
                        doc.text(`${factor.code}: ${factor.name} - Valor: ${factor.value}`, 20, yPos);
                        yPos += 7;
                        
                        if (factor.description) {
                            const descLines = doc.splitTextToSize(factor.description, 175);
                            doc.text(descLines, 25, yPos);
                            yPos += descLines.length * 7 + 3;
                        }
                    });
                    
                    yPos += 5;
                }
                
                // Factores personales (desde el paciente)
                if (patient.personalFactors) {
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFont(undefined, 'bold');
                    doc.text("Factores personales (fp):", 15, yPos);
                    yPos += 7;
                    doc.setFont(undefined, 'normal');
                    
                    const factorLines = doc.splitTextToSize(patient.personalFactors, 180);
                    doc.text(factorLines, 15, yPos);
                    yPos += factorLines.length * 7 + 10;
                }
            }
        }
        
        // === SECCIÓN DE OBJETIVOS TERAPÉUTICOS ===
        if (includeObjectives) {
            console.log("Añadiendo sección de objetivos al PDF...");
            // Check if we need a new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFillColor(30, 136, 229);
            doc.rect(10, yPos, 190, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('OBJETIVOS TERAPÉUTICOS', 105, yPos + 7, null, null, 'center');
            yPos += 20;
            
            doc.setTextColor(0, 0, 0);
            
            // Objetivo general
            if (generalObjective) {
                console.log("Añadiendo objetivo general al PDF");
                doc.setFont(undefined, 'bold');
                doc.text("Objetivo general:", 15, yPos);
                yPos += 7;
                
                doc.setFont(undefined, 'normal');
                const generalLines = doc.splitTextToSize(generalObjective.description || "No definido", 180);
                doc.text(generalLines, 15, yPos);
                yPos += generalLines.length * 7 + 5;
                
                if (generalObjective.endDate) {
                    doc.text(`Fecha objetivo: ${formatDate(new Date(generalObjective.endDate))}`, 15, yPos);
                    yPos += 7;
                }
                
                // Mostrar progreso
                doc.text(`Progreso: ${generalObjective.progress || 0}%`, 15, yPos);
                yPos += 10;
            } else {
                console.log("No hay objetivo general para añadir al PDF");
                doc.setFont(undefined, 'normal');
                doc.text("No se ha definido un objetivo general para este paciente.", 15, yPos);
                yPos += 10;
            }
            
            // Objetivos específicos
            if (specificObjectives.length > 0) {
                console.log(`Añadiendo ${specificObjectives.length} objetivos específicos al PDF`);
                // Check if we need a new page
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFont(undefined, 'bold');
                doc.text("Objetivos específicos:", 15, yPos);
                yPos += 10;
                
                // Agrupar por categoría
                const categorized = {};
                specificObjectives.forEach(obj => {
                    const category = obj.category || "Sin categoría";
                    if (!categorized[category]) {
                        categorized[category] = [];
                    }
                    categorized[category].push(obj);
                });
                
                // Mostrar por categoría
                for (const [category, objectives] of Object.entries(categorized)) {
                    // Check if we need a new page
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    doc.setFillColor(240, 240, 240);
                    doc.rect(10, yPos - 5, 190, 10, 'F');
                    doc.setFont(undefined, 'bold');
                    doc.setTextColor(30, 136, 229);
                    doc.text(`Categoría: ${category}`, 15, yPos);
                    doc.setFont(undefined, 'normal');
                    doc.setTextColor(0, 0, 0);
                    
                    yPos += 10;
                    
                    // Mostrar cada objetivo
                    objectives.forEach((obj, index) => {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        // Si hay descripción explícita, usarla
                        if (obj.description) {
                            doc.setFont(undefined, 'bold');
                            doc.text(`${index + 1}. ${obj.description}`, 15, yPos);
                            yPos += 10;
                        } else {
                            // Si no, construir la descripción a partir de los componentes
                            const title = `${obj.verb || 'Objetivo'} ${obj.structure || ''}`;
                            doc.setFont(undefined, 'bold');
                            doc.text(`${index + 1}. ${title}`, 15, yPos);
                            yPos += 7;
                        }
                        
                        // Detalles adicionales
                        doc.setFont(undefined, 'normal');
                        
                        const details = `${obj.initialValue || ''} → ${obj.targetValue || ''} (${obj.evaluationMethod || ''})`;
                        doc.text(`Medida: ${details}`, 20, yPos);
                        yPos += 7;
                        
                        // Estado
                        let statusText = "Pendiente";
                        if (obj.status === 'completed') statusText = "Completado";
                        else if (obj.status === 'inprogress') statusText = "En progreso";
                        
                        const progress = obj.progress || 0;
                        doc.text(`Estado: ${statusText} - Progreso: ${progress}%`, 20, yPos);
                        yPos += 7;
                        
                        // Fechas
                        const startDate = obj.startDate ? formatDate(new Date(obj.startDate)) : 'No definido';
                        const endDate = obj.endDate ? formatDate(new Date(obj.endDate)) : 'No definido';
                        doc.text(`Inicio: ${startDate} - Fecha objetivo: ${endDate}`, 20, yPos);
                        yPos += 10;
                    });
                }
            } else {
                console.log("No hay objetivos específicos para añadir al PDF");
                doc.setFont(undefined, 'normal');
                doc.text("No hay objetivos específicos definidos para este paciente.", 15, yPos);
                yPos += 10;
            }
        }
        
        // === SECCIÓN DE PLANES DE TRATAMIENTO ===
        if (includePlans) {
            console.log(`Añadiendo ${treatmentPlans.length} planes de tratamiento al PDF`);
            // Check if we need a new page
            if (yPos > 250) {
                doc.addPage();
                yPos = 20;
            }
            
            doc.setFillColor(30, 136, 229);
            doc.rect(10, yPos, 190, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('PLANES DE TRATAMIENTO', 105, yPos + 7, null, null, 'center');
            yPos += 20;
            
            doc.setTextColor(0, 0, 0);
            
            // Mostrar cada plan
            if (treatmentPlans.length === 0) {
                doc.setFont(undefined, 'normal');
                doc.text("No hay planes de tratamiento registrados para este paciente.", 15, yPos);
                yPos += 10;
            } else {
                for (let i = 0; i < treatmentPlans.length; i++) {
                    const plan = treatmentPlans[i];
                    console.log(`Procesando plan de tratamiento #${i+1}`);
                    
                    // Check if we need a new page
                    if (yPos > 230) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    // Encabezado con fecha
                    doc.setFillColor(230, 240, 250);
                    doc.rect(10, yPos - 5, 190, 10, 'F');
                    doc.setTextColor(30, 136, 229);
                    doc.setFontSize(12);
                    doc.setFont(undefined, 'bold');
                    
                    const planDate = plan.startDate || plan.createdAt || new Date().toISOString();
                    doc.text(`Plan de tratamiento: ${formatDate(new Date(planDate))}`, 15, yPos);
                    yPos += 15;
                    
                    // Reset font
                    doc.setTextColor(0, 0, 0);
                    doc.setFontSize(11);
                    doc.setFont(undefined, 'normal');
                    
                    // Duración y frecuencia
                    doc.text(`Duración: ${plan.duration || '?'} ${plan.durationUnit || 'semanas'} - Frecuencia: ${plan.frequency || '?'} ${plan.frequencyUnit || 'sesiones por semana'}`, 15, yPos);
                    yPos += 10;
                    
                    // Objetivos del plan
                    if (plan.objectives) {
                        doc.setFont(undefined, 'bold');
                        doc.text("Objetivos del tratamiento:", 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        const objectivesLines = doc.splitTextToSize(plan.objectives, 180);
                        doc.text(objectivesLines, 15, yPos);
                        yPos += objectivesLines.length * 7 + 5;
                    }
                    
                    // Técnicas
                    doc.setFont(undefined, 'bold');
                    doc.text("Técnicas utilizadas:", 15, yPos);
                    yPos += 7;
                    doc.setFont(undefined, 'normal');
                    
                    if (plan.techniques) {
                        // Terapia manual
                        if (plan.techniques.manual && plan.techniques.manual.active) {
                            doc.text("• Terapia manual", 20, yPos);
                            yPos += 7;
                            
                            // Subtécnicas
                            if (plan.techniques.manual.subtechniques) {
                                const subs = plan.techniques.manual.subtechniques;
                                const activeSubs = [];
                                
                                if (subs.jointMobilization) activeSubs.push("Movilización articular");
                                if (subs.jointManipulation) activeSubs.push("Manipulación articular");
                                if (subs.myofascial) activeSubs.push("Liberación miofascial");
                                if (subs.neurodynamics) activeSubs.push("Neurodinamia");
                                if (subs.muscleEnergy) activeSubs.push("Técnicas de energía muscular");
                                
                                if (activeSubs.length > 0) {
                                    doc.text(`  - ${activeSubs.join(', ')}`, 25, yPos);
                                    yPos += 7;
                                }
                            }
                            
                            // Detalles
                            if (plan.techniques.manual.details) {
                                const detailLines = doc.splitTextToSize(`  Detalles: ${plan.techniques.manual.details}`, 175);
                                doc.text(detailLines, 25, yPos);
                                yPos += detailLines.length * 7 + 3;
                            }
                        }
                        
                        // Ejercicio terapéutico
                        if (plan.techniques.exercise && plan.techniques.exercise.active) {
                            doc.text("• Ejercicio terapéutico", 20, yPos);
                            yPos += 7;
                            
                            // Subtécnicas
                            if (plan.techniques.exercise.subtechniques) {
                                const subs = plan.techniques.exercise.subtechniques;
                                const activeSubs = [];
                                
                                if (subs.strength) activeSubs.push("Fortalecimiento");
                                if (subs.flexibility) activeSubs.push("Flexibilidad");
                                if (subs.proprioception) activeSubs.push("Propiocepción");
                                if (subs.balance) activeSubs.push("Equilibrio");
                                if (subs.cardiovascular) activeSubs.push("Cardiovascular");
                                if (subs.functional) activeSubs.push("Funcional");
                                
                                if (activeSubs.length > 0) {
                                    doc.text(`  - ${activeSubs.join(', ')}`, 25, yPos);
                                    yPos += 7;
                                }
                            }
                            
                            // Detalles
                            if (plan.techniques.exercise.details) {
                                const detailLines = doc.splitTextToSize(`  Detalles: ${plan.techniques.exercise.details}`, 175);
                                doc.text(detailLines, 25, yPos);
                                yPos += detailLines.length * 7 + 3;
                            }
                        }
                        
                        // Agentes físicos
                        if (plan.techniques.physical && plan.techniques.physical.active) {
                            // Check if we need a new page
                            if (yPos > 250) {
                                doc.addPage();
                                yPos = 20;
                            }
                            
                            doc.text("• Agentes físicos", 20, yPos);
                            yPos += 7;
                            
                            // Subtécnicas
                            if (plan.techniques.physical.subtechniques) {
                                const subs = plan.techniques.physical.subtechniques;
                                const activeSubs = [];
                                
                                if (subs.thermotherapy) activeSubs.push("Termoterapia");
                                if (subs.cryotherapy) activeSubs.push("Crioterapia");
                                if (subs.electrotherapy) activeSubs.push("Electroterapia");
                                if (subs.ultrasound) activeSubs.push("Ultrasonido");
                                if (subs.laser) activeSubs.push("Láser");
                                if (subs.shockwave) activeSubs.push("Ondas de choque");
                                
                                if (activeSubs.length > 0) {
                                    doc.text(`  - ${activeSubs.join(', ')}`, 25, yPos);
                                    yPos += 7;
                                }
                            }
                            
                            // Detalles
                            if (plan.techniques.physical.details) {
                                const detailLines = doc.splitTextToSize(`  Detalles: ${plan.techniques.physical.details}`, 175);
                                doc.text(detailLines, 25, yPos);
                                yPos += detailLines.length * 7 + 3;
                            }
                        }
                        
                        // Educación al paciente
                        if (plan.techniques.education && plan.techniques.education.active) {
                            // Check if we need a new page
                            if (yPos > 250) {
                                doc.addPage();
                                yPos = 20;
                            }
                            
                            doc.text("• Educación al paciente", 20, yPos);
                            yPos += 7;
                            
                            // Subtécnicas
                            if (plan.techniques.education.subtechniques) {
                                const subs = plan.techniques.education.subtechniques;
                                const activeSubs = [];
                                
                                if (subs.painEducation) activeSubs.push("Educación en neurociencia del dolor");
                                if (subs.posture) activeSubs.push("Higiene postural");
                                if (subs.ergonomics) activeSubs.push("Ergonomía");
                                if (subs.selfManagement) activeSubs.push("Automanejo");
                                
                                if (activeSubs.length > 0) {
                                    doc.text(`  - ${activeSubs.join(', ')}`, 25, yPos);
                                    yPos += 7;
                                }
                            }
                            
                            // Detalles
                            if (plan.techniques.education.details) {
                                const detailLines = doc.splitTextToSize(`  Detalles: ${plan.techniques.education.details}`, 175);
                                doc.text(detailLines, 25, yPos);
                                yPos += detailLines.length * 7 + 3;
                            }
                        }
                        
                        // Otras técnicas
                        if (plan.techniques.other && plan.techniques.other.active) {
                            // Check if we need a new page
                            if (yPos > 250) {
                                doc.addPage();
                                yPos = 20;
                            }
                            
                            doc.text("• Otras técnicas", 20, yPos);
                            yPos += 7;
                            
                            // Detalles
                            if (plan.techniques.other.details) {
                                const detailLines = doc.splitTextToSize(`  ${plan.techniques.other.details}`, 175);
                                doc.text(detailLines, 25, yPos);
                                yPos += detailLines.length * 7 + 3;
                            }
                        }
                    } else {
                        doc.text("No se han registrado técnicas para este plan", 20, yPos);
                        yPos += 7;
                    }
                    
                    // Progresión planificada
                    if (plan.progression) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFont(undefined, 'bold');
                        doc.text("Progresión planificada:", 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        const progressionLines = doc.splitTextToSize(plan.progression, 180);
                        doc.text(progressionLines, 15, yPos);
                        yPos += progressionLines.length * 7 + 5;
                    }
                    
                    // Observaciones
                    if (plan.observations) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFont(undefined, 'bold');
                        doc.text("Observaciones:", 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        const observationsLines = doc.splitTextToSize(plan.observations, 180);
                        doc.text(observationsLines, 15, yPos);
                        yPos += observationsLines.length * 7 + 5;
                    }
                    
                    // Criterios de alta
                    if (plan.dischargeGoals) {
                        // Check if we need a new page
                        if (yPos > 250) {
                            doc.addPage();
                            yPos = 20;
                        }
                        
                        doc.setFont(undefined, 'bold');
                        doc.text("Criterios de alta:", 15, yPos);
                        yPos += 7;
                        
                        doc.setFont(undefined, 'normal');
                        const goalsLines = doc.splitTextToSize(plan.dischargeGoals, 180);
                        doc.text(goalsLines, 15, yPos);
                        yPos += goalsLines.length * 7 + 5;
                    }
                    
                    // Add separator line between planes
                    if (i < treatmentPlans.length - 1) {
                        doc.setDrawColor(200, 200, 200);
                        doc.line(15, yPos, 195, yPos);
                        yPos += 10;
                    }
                }
            }
        }
        
        // Add evolutions if requested
        if (includeEvolutions) {
            console.log(`Añadiendo ${filteredEvolutions.length} evoluciones al PDF`);
            // Check if we need a new page
            if (yPos > 270) {
                doc.addPage();
                yPos = 20;
            }
            
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
                        
                        // Table for exercises
                        const cellPadding = 3;
                        
                        // Table header
                        doc.setFillColor(230, 240, 250);
                        doc.rect(15, yPos - 7, 180, 10, 'F');
                        doc.setTextColor(30, 136, 229);
                        doc.setFont(undefined, 'bold');
                        doc.text("Ejercicio", 15 + cellPadding, yPos);
                        doc.text("Series", 75 + cellPadding, yPos);
                        doc.text("Reps", 95 + cellPadding, yPos);
                        doc.text("Intens.", 115 + cellPadding, yPos);
                        doc.text("Notas", 140 + cellPadding, yPos);
                        yPos += 10;
                        
                        // Table rows
                        doc.setTextColor(0, 0, 0);
                        doc.setFont(undefined, 'normal');
                        doc.setFontSize(9);
                        
                        evolution.exercises.forEach((exercise, index) => {
                            // Check if we need a new page
                            if (yPos > 270) {
                                doc.addPage();
                                yPos = 20;
                                
                                // Repeat header on new page
                                doc.setFontSize(11);
                                doc.setFillColor(230, 240, 250);
                                doc.rect(15, yPos - 7, 180, 10, 'F');
                                doc.setTextColor(30, 136, 229);
                                doc.setFont(undefined, 'bold');
                                doc.text("Ejercicio", 15 + cellPadding, yPos);
                                doc.text("Series", 75 + cellPadding, yPos);
                                doc.text("Reps", 95 + cellPadding, yPos);
                                doc.text("Intens.", 115 + cellPadding, yPos);
                                doc.text("Notas", 140 + cellPadding, yPos);
                                yPos += 10;
                                
                                doc.setFontSize(9);
                                doc.setTextColor(0, 0, 0);
                                doc.setFont(undefined, 'normal');
                            }
                            
                            // Row background for even rows
                            if (index % 2 === 1) {
                                doc.setFillColor(245, 247, 250);
                                doc.rect(15, yPos - 7, 180, 10, 'F');
                            }
                            
                            // Ejercicio (primera columna)
                            const nombreEjercicio = exercise.name || 'Sin nombre';
                            const nombreMostrado = nombreEjercicio.length > 25 ? 
                                nombreEjercicio.substring(0, 22) + '...' : nombreEjercicio;
                            doc.text(nombreMostrado, 15 + cellPadding, yPos);
                            
                            // Series
                            doc.text(exercise.sets?.toString() || '3', 75 + cellPadding, yPos);
                            
                            // Repeticiones
                            doc.text(exercise.reps?.toString() || '10', 95 + cellPadding, yPos);
                            
                            // Intensidad (formato corto)
                            let intensityText = '';
                            if (exercise.effortType && exercise.effortValue) {
                                intensityText = `${exercise.effortType} ${exercise.effortValue}`;
                            } else if (exercise.intensity) {
                                intensityText = exercise.intensity;
                            } else {
                                intensityText = '-';
                            }
                            
                            // Acortar el texto de intensidad si es necesario
                            if (intensityText.length > 10) {
                                intensityText = intensityText.substring(0, 8) + '..';
                            }
                            
                            doc.text(intensityText, 115 + cellPadding, yPos);
                            
                            // Notas - multiples líneas si es necesario
                            if (exercise.notes) {
                                if (exercise.notes.length > 25) {
                                    const notesLines = doc.splitTextToSize(exercise.notes, 50);
                                    const limitedLines = notesLines.slice(0, 2);
                                    
                                    doc.text(limitedLines, 140 + cellPadding, yPos - 3);
                                    
                                    if (notesLines.length > 2) {
                                        doc.text("...", 140 + cellPadding, yPos + 4);
                                    }
                                    
                                    yPos += (limitedLines.length * 7);
                                } else {
                                    doc.text(exercise.notes, 140 + cellPadding, yPos);
                                    yPos += 10;
                                }
                            } else {
                                doc.text("-", 140 + cellPadding, yPos);
                                yPos += 10;
                            }
                        });
                        
                        // Restaurar tamaño de fuente
                        doc.setFontSize(11);
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
            
            console.log("=== PDF GENERADO CORRECTAMENTE ===");
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
    
    // Definir el HTML de la fila con todos los campos y tooltips
    row.innerHTML = `
        <td>
            <textarea class="form-control" placeholder="Nombre" 
                   style="width: 100%; min-height: 60px; resize: vertical;">${exercise.name || ''}</textarea>
        </td>
        <td>
            <select class="form-control" style="width: 100%;">
                <option value="" ${!exercise.implement ? 'selected' : ''}>Ninguno</option>
                <option value="Mancuernas" ${exercise.implement === 'Mancuernas' ? 'selected' : ''}>Mancuernas</option>
                <option value="Bandas" ${exercise.implement === 'Bandas' ? 'selected' : ''}>Bandas</option>
                <option value="Máquina" ${exercise.implement === 'Máquina' ? 'selected' : ''}>Máquina</option>
                <option value="Peso corporal" ${exercise.implement === 'Peso corporal' ? 'selected' : ''}>Peso corporal</option>
                <option value="Barra olímpica" ${exercise.implement === 'Barra olímpica' ? 'selected' : ''}>Barra olímpica</option>
                <option value="Barra preolímpica" ${exercise.implement === 'Barra preolímpica' ? 'selected' : ''}>Barra preolímpica</option>
                <option value="Kettlebell" ${exercise.implement === 'Kettlebell' ? 'selected' : ''}>Kettlebell</option>
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
    <div style="display: flex; flex-direction: column; gap: 5px;">
        <div style="display: flex; align-items: center; gap: 5px;">
            <select class="form-control effort-type-select" style="flex: 1; min-width: 60px;" onchange="this.nextElementSibling.setAttribute('onclick', 'mostrarInfoIntensidad(\''+this.value+'\')'); document.querySelector('[data-effort-desc='+this.closest('tr').rowIndex+']').textContent = this.value === 'RPE' ? 'Percepción de esfuerzo' : 'Repeticiones en reserva';">
                <option value="RPE" ${(exercise.effortType === 'RPE' || !exercise.effortType) ? 'selected' : ''}>RPE</option>
                <option value="RIR" ${exercise.effortType === 'RIR' ? 'selected' : ''}>RIR</option>
            </select>
            <button type="button" class="info-button" onclick="mostrarInfoIntensidad('${(exercise.effortType === 'RPE' || !exercise.effortType) ? 'RPE' : 'RIR'}')" style="background: none; border: none; padding: 0; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-info-circle" style="color: var(--primary); font-size: 18px;"></i>
            </button>
        </div>
        <div data-effort-desc="${row ? row.rowIndex : 0}" style="font-size: 12px; text-align: center; color: var(--text-secondary);">
            ${(exercise.effortType === 'RPE' || !exercise.effortType) ? 'Percepción de esfuerzo' : 'Repeticiones en reserva'}
        </div>
        <input type="number" class="form-control" min="0" max="10" step="1"
               value="${exercise.effortValue || ''}" style="text-align: center; width: 100%;">
    </div>
</td>
        <td>
           <textarea class="form-control" placeholder="Notas" 
          style="width: 100%; min-height: 60px; resize: vertical;">${exercise.notes || ''}</textarea>
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
        // Actualizar la etiqueta descriptiva
        const descriptionDiv = row.querySelector('div[style*="text-align: center; font-size: 11px;"]');
        if (descriptionDiv) {
            descriptionDiv.textContent = this.value === 'RPE' ? 'Percepción de esfuerzo' : 'Repeticiones en reserva';
        }
        
        // Actualizar el tooltip
        const tooltipIcon = row.querySelector('.tooltip-icon');
        if (tooltipIcon) {
            const tooltipContent = tooltipIcon.nextElementSibling;
            if (tooltipContent) {
                if (this.value === 'RPE') {
                    tooltipContent.innerHTML = `
                        <p><strong>RPE: Rating of Perceived Exertion (0-10)</strong></p>
                        <p>0 = Reposo absoluto</p>
                        <p>1 = Esfuerzo muy, muy ligero</p>
                        <p>2 = Esfuerzo muy ligero</p>
                        <p>3 = Esfuerzo ligero</p>
                        <p>4 = Esfuerzo moderado</p>
                        <p>5 = Esfuerzo algo duro</p>
                        <p>6 = Esfuerzo duro</p>
                        <p>7-8 = Esfuerzo muy duro</p>
                        <p>9 = Esfuerzo extremadamente duro</p>
                        <p>10 = Esfuerzo máximo (imposible continuar)</p>
                    `;
                } else {
                    tooltipContent.innerHTML = `
                        <p><strong>RIR: Repeticiones en Reserva</strong></p>
                        <p>0 = No podría realizar ni una repetición más (fallo muscular)</p>
                        <p>1 = Podría realizar 1 repetición más</p>
                        <p>2 = Podría realizar 2 repeticiones más</p>
                        <p>3 = Podría realizar 3 repeticiones más</p>
                        <p>4 = Podría realizar 4 repeticiones más</p>
                        <p>5+ = Podría realizar 5 o más repeticiones adicionales</p>
                    `;
                }
            }
        }
    });
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





        // Botón para exportar objetivos a PDF
document.getElementById('exportObjectivesPdfBtn').addEventListener('click', function() {
    if (!currentPatientId) {
        showToast("Error: No hay paciente seleccionado", "error");
        return;
    }
    
    exportObjectivesToPDF(currentPatientId);
});

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
        
        // Configurar previsualización mejorada de archivos adjuntos
const evolutionAttachments = document.getElementById('evolutionAttachments');
if (evolutionAttachments) {
    evolutionAttachments.addEventListener('change', function() {
        const previewContainer = document.getElementById('attachmentPreview');
        if (!previewContainer) return;
        
        previewContainer.innerHTML = '';
        
        Array.from(this.files).forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isPDF = file.name.toLowerCase().endsWith('.pdf');
            const attachment = document.createElement('div');
            attachment.className = 'attachment';
            attachment.style.position = 'relative';
            
            if (isImage) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = file.name;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                attachment.appendChild(img);
            } else if (isPDF) {
                // Icono especial para PDF
                attachment.innerHTML = `
                    <div style="text-align: center; padding: 10px;">
                        <i class="fas fa-file-pdf" style="font-size: 40px; color: #e74c3c;"></i>
                        <div style="margin-top: 5px; font-size: 12px; word-break: break-word;">
                            ${file.name}
                        </div>
                    </div>
                `;
            } else {
                // Ícono genérico para otros tipos de archivo
                const fileExtension = file.name.split('.').pop().toUpperCase();
                attachment.innerHTML = `
                    <div style="text-align: center; padding: 10px;">
                        <i class="fas fa-file" style="font-size: 40px; color: #3498db;"></i>
                        <div style="margin-top: 5px; font-size: 12px; word-break: break-word;">
                            ${file.name}
                        </div>
                        <div style="font-weight: bold; margin-top: 3px;">${fileExtension}</div>
                    </div>
                `;
            }
            
            // Botón para eliminar de la previsualización
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.className = 'remove-attachment-btn';
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '5px';
            removeBtn.style.right = '5px';
            removeBtn.style.background = 'rgba(0,0,0,0.5)';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.width = '24px';
            removeBtn.style.height = '24px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.title = 'Eliminar';
            
            removeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                attachment.remove();
                
                // Si no quedan archivos, mostrar un mensaje
                if (previewContainer.children.length === 0) {
                    previewContainer.innerHTML = '<p style="color: #888; font-style: italic;">No hay archivos seleccionados</p>';
                }
            });
            
            attachment.appendChild(removeBtn);
            
            const typeLabel = document.createElement('div');
            typeLabel.className = 'attachment-type';
            typeLabel.textContent = isImage ? 'Foto' : (isPDF ? 'PDF' : file.name.split('.').pop().toUpperCase());
            attachment.appendChild(typeLabel);
            
            previewContainer.appendChild(attachment);
        });
    });
}

// También configurar lo mismo para archivos de paciente
const patientFilesInput = document.getElementById('patientFiles');
if (patientFilesInput) {
    patientFilesInput.addEventListener('change', function() {
        const previewContainer = document.getElementById('patientFilesPreview');
        if (!previewContainer) return;
        
        previewContainer.innerHTML = '';
        
        Array.from(this.files).forEach(file => {
            const isImage = file.type.startsWith('image/');
            const isPDF = file.name.toLowerCase().endsWith('.pdf');
            const attachment = document.createElement('div');
            attachment.className = 'attachment';
            attachment.style.position = 'relative';
            
            if (isImage) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                img.alt = file.name;
                img.style.maxWidth = '100%';
                img.style.height = 'auto';
                attachment.appendChild(img);
            } else if (isPDF) {
                // Icono especial para PDF
                attachment.innerHTML = `
                    <div style="text-align: center; padding: 10px;">
                        <i class="fas fa-file-pdf" style="font-size: 40px; color: #e74c3c;"></i>
                        <div style="margin-top: 5px; font-size: 12px; word-break: break-word;">
                            ${file.name}
                        </div>
                    </div>
                `;
            } else {
                // Ícono genérico para otros tipos de archivo
                const fileExtension = file.name.split('.').pop().toUpperCase();
                attachment.innerHTML = `
                    <div style="text-align: center; padding: 10px;">
                        <i class="fas fa-file" style="font-size: 40px; color: #3498db;"></i>
                        <div style="margin-top: 5px; font-size: 12px; word-break: break-word;">
                            ${file.name}
                        </div>
                        <div style="font-weight: bold; margin-top: 3px;">${fileExtension}</div>
                    </div>
                `;
            }
            
            // Botón para eliminar de la previsualización
            const removeBtn = document.createElement('button');
            removeBtn.innerHTML = '<i class="fas fa-times"></i>';
            removeBtn.className = 'remove-attachment-btn';
            removeBtn.style.position = 'absolute';
            removeBtn.style.top = '5px';
            removeBtn.style.right = '5px';
            removeBtn.style.background = 'rgba(0,0,0,0.5)';
            removeBtn.style.color = 'white';
            removeBtn.style.border = 'none';
            removeBtn.style.borderRadius = '50%';
            removeBtn.style.width = '24px';
            removeBtn.style.height = '24px';
            removeBtn.style.cursor = 'pointer';
            removeBtn.title = 'Eliminar';
            
            removeBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                attachment.remove();
                
                // Si no quedan archivos, mostrar un mensaje
                if (previewContainer.children.length === 0) {
                    previewContainer.innerHTML = '<p style="color: #888; font-style: italic;">No hay archivos seleccionados</p>';
                }
            });
            
            attachment.appendChild(removeBtn);
            
            const typeLabel = document.createElement('div');
            typeLabel.className = 'attachment-type';
            typeLabel.textContent = isImage ? 'Foto' : (isPDF ? 'PDF' : file.name.split('.').pop().toUpperCase());
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
                    
                    // Limpiar contenedores de archivos
                    const patientFilesPreview = document.getElementById('patientFilesPreview');
                    if (patientFilesPreview) {
                        patientFilesPreview.innerHTML = '';
                    }
                    
                    // También limpiar otros contenedores relevantes
                    const attachmentPreview = document.getElementById('attachmentPreview');
                    if (attachmentPreview) {
                        attachmentPreview.innerHTML = '';
                    }
                }
            });
        });
        
        // Botones de cancelar específicos
        const cancelEvolutionBtn = document.getElementById('cancelEvolutionBtn');
if (cancelEvolutionBtn) {
    // Eliminar manejadores previos
    const newCancelEvolutionBtn = cancelEvolutionBtn.cloneNode(true);
    cancelEvolutionBtn.parentNode.replaceChild(newCancelEvolutionBtn, cancelEvolutionBtn);
    
    newCancelEvolutionBtn.addEventListener('click', function() {
        const modal = document.getElementById('newEvolutionModal');
        if (modal) {
            modal.classList.remove('active');
            
            // Recargar el formulario después de un breve retraso para que se limpie
            setTimeout(() => {
                const form = document.getElementById('evolutionForm');
                if (form) form.reset();
                
                // Restablecer el título
                const modalTitle = document.getElementById('evolutionModalTitle');
                if (modalTitle) modalTitle.textContent = 'Nueva evolución';
                
                // Restablecer valores predeterminados de escalas
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
                
                // Limpiar actividades PSFS
                const psfsContainer = document.getElementById('psfsActivities');
                if (psfsContainer) psfsContainer.innerHTML = '';
                
                // Limpiar ejercicios
                const exerciseTableBody = document.getElementById('exerciseTableBody');
                if (exerciseTableBody) exerciseTableBody.innerHTML = '';
            }, 300);
        }
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






      

        // Función para exportar objetivos a PDF
async function exportObjectivesToPDF(patientId) {
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
        
        // Obtener objetivo general
        let generalObjective = null;
        try {
            const generalRef = doc(db, "patients", patientId, "objectives", "general");
            const generalSnap = await getDoc(generalRef);
            if (generalSnap.exists()) {
                generalObjective = generalSnap.data();
            }
        } catch (error) {
            console.error("Error al obtener objetivo general:", error);
        }
        
        // Obtener objetivos específicos
        const objectivesRef = collection(db, "patients", patientId, "objectives");
        const objectivesQuery = query(objectivesRef, where(documentId(), "!=", "general"));
        const objectivesSnap = await getDocs(objectivesQuery);
        
        const specificObjectives = objectivesSnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        // Crear PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Obtener información del centro (desde la configuración)
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
        
        // Header
        doc.setFillColor(30, 136, 229);
        doc.rect(0, 0, 210, 25, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(18);
        doc.setFont(undefined, 'bold');
        doc.text(`OBJETIVOS TERAPÉUTICOS - ${centerName.toUpperCase()}`, 105, 15, null, null, 'center');
        
        // Información del paciente
        doc.setFillColor(245, 247, 250);
        doc.rect(10, 30, 190, 40, 'F');
        
        doc.setTextColor(30, 136, 229);
        doc.setFontSize(14);
        doc.text(`Paciente: ${patient.name || 'Sin nombre'}`, 15, 40);
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        doc.text(`RUT: ${patient.rut || 'No registrado'}`, 15, 50);
        doc.text(`Fecha del informe: ${formatDate(new Date())}`, 15, 60);
        
        let yPos = 80;
        
        // Objetivo general
        doc.setFillColor(30, 136, 229);
        doc.rect(10, yPos, 190, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('OBJETIVO GENERAL', 105, yPos + 7, null, null, 'center');
        
        yPos += 20;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        if (generalObjective) {
            const description = generalObjective.description || "No se ha definido un objetivo general.";
            const descLines = doc.splitTextToSize(description, 180);
            doc.text(descLines, 15, yPos);
            yPos += descLines.length * 7 + 5;
            
            // Agregar detalles adicionales
            if (generalObjective.endDate) {
                doc.text(`Fecha objetivo: ${formatDate(new Date(generalObjective.endDate))}`, 15, yPos);
                yPos += 7;
            }
            
            // Progreso
            const progress = generalObjective.progress || 0;
            doc.text(`Progreso actual: ${progress}%`, 15, yPos);
            yPos += 7;
            
            // Barra de progreso
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(220, 220, 220);
            doc.roundedRect(15, yPos, 180, 5, 1, 1, 'F');
            
            if (progress > 0) {
                const progressWidth = (progress / 100) * 180;
                doc.setDrawColor(30, 136, 229);
                doc.setFillColor(30, 136, 229);
                doc.roundedRect(15, yPos, progressWidth, 5, 1, 1, 'F');
            }
            
            yPos += 15;
        } else {
            doc.text("No se ha definido un objetivo general para este paciente.", 15, yPos);
            yPos += 10;
        }
        
        // Nueva página si es necesario
        if (yPos > 250) {
            doc.addPage();
            yPos = 20;
        }
        
        // Objetivos específicos
        doc.setFillColor(30, 136, 229);
        doc.rect(10, yPos, 190, 10, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(12);
        doc.setFont(undefined, 'bold');
        doc.text('OBJETIVOS ESPECÍFICOS', 105, yPos + 7, null, null, 'center');
        
        yPos += 20;
        doc.setTextColor(0, 0, 0);
        doc.setFont(undefined, 'normal');
        
        if (specificObjectives.length === 0) {
            doc.text("No hay objetivos específicos definidos para este paciente.", 15, yPos);
            yPos += 10;
        } else {
            // Agrupar por categoría
            const categorized = {};
            specificObjectives.forEach(obj => {
                const category = obj.category || "Sin categoría";
                if (!categorized[category]) {
                    categorized[category] = [];
                }
                categorized[category].push(obj);
            });
            
            // Mostrar por categoría
            for (const [category, objectives] of Object.entries(categorized)) {
                // Nueva página si es necesario
                if (yPos > 250) {
                    doc.addPage();
                    yPos = 20;
                }
                
                doc.setFillColor(240, 240, 240);
                doc.rect(10, yPos - 5, 190, 10, 'F');
                doc.setFont(undefined, 'bold');
                doc.setTextColor(30, 136, 229);
                doc.text(`Categoría: ${category}`, 15, yPos);
                doc.setFont(undefined, 'normal');
                doc.setTextColor(0, 0, 0);
                
                yPos += 10;
                
                // Mostrar cada objetivo
                objectives.forEach((obj, index) => {
                    // Nueva página si es necesario
                    if (yPos > 250) {
                        doc.addPage();
                        yPos = 20;
                    }
                    
                    const title = `${obj.verb || 'Objetivo'} ${obj.structure || ''}`;
                    const details = `${obj.initialValue || ''} → ${obj.targetValue || ''} (${obj.evaluationMethod || ''})`;
                    const progress = obj.progress || 0;
                    
                    // Estado
                    let statusText = "Pendiente";
                    if (obj.status === 'completed') statusText = "Completado";
                    else if (obj.status === 'inprogress') statusText = "En progreso";
                    
                    doc.setFont(undefined, 'bold');
                    doc.text(`${index + 1}. ${title}`, 15, yPos);
                    yPos += 7;
                    
                    doc.setFont(undefined, 'normal');
                    doc.text(`Medida: ${details}`, 20, yPos);
                    yPos += 7;
                    
                    doc.text(`Estado: ${statusText} - Progreso: ${progress}%`, 20, yPos);
                    yPos += 7;
                    
                    // Fechas
                    const startDate = obj.startDate ? formatDate(new Date(obj.startDate)) : 'N/A';
                    const endDate = obj.endDate ? formatDate(new Date(obj.endDate)) : 'N/A';
                    doc.text(`Inicio: ${startDate} - Fecha objetivo: ${endDate}`, 20, yPos);
                    yPos += 7;
                    
                    // Barra de progreso
                    doc.setDrawColor(220, 220, 220);
                    doc.setFillColor(220, 220, 220);
                    doc.roundedRect(20, yPos, 170, 4, 1, 1, 'F');
                    
                    if (progress > 0) {
                        const progressWidth = (progress / 100) * 170;
                        
                        // Color según estado
                        if (obj.status === 'completed') {
                            doc.setDrawColor(76, 175, 80);
                            doc.setFillColor(76, 175, 80);
                        } else if (obj.status === 'inprogress') {
                            doc.setDrawColor(33, 150, 243);
                            doc.setFillColor(33, 150, 243);
                        } else {
                            doc.setDrawColor(158, 158, 158);
                            doc.setFillColor(158, 158, 158);
                        }
                        
                        doc.roundedRect(20, yPos, progressWidth, 4, 1, 1, 'F');
                    }
                    
                    yPos += 12;
                });
            }
        }
        
        // Gráficos de estadísticas
        if (specificObjectives.length > 0) {
            // Nueva página para gráficos
            doc.addPage();
            yPos = 20;
            
            doc.setFillColor(30, 136, 229);
            doc.rect(10, yPos, 190, 10, 'F');
            doc.setTextColor(255, 255, 255);
            doc.setFontSize(12);
            doc.setFont(undefined, 'bold');
            doc.text('RESUMEN DE OBJETIVOS', 105, yPos + 7, null, null, 'center');
            
            yPos += 20;
            doc.setTextColor(0, 0, 0);
            
            // Contar objetivos por estado
            let completed = 0;
            let inProgress = 0;
            let pending = 0;
            
            specificObjectives.forEach(obj => {
                switch(obj.status) {
                    case 'completed': completed++; break;
                    case 'inprogress': inProgress++; break;
                    default: pending++; break;
                }
            });
            
            const total = completed + inProgress + pending;
            
            // Crear gráfico de dona manualmente (sin canvas)
            doc.setFont(undefined, 'bold');
            doc.text('Estado de objetivos', 105, yPos, null, null, 'center');
            yPos += 15;
            
            // Estadísticas de texto
            doc.setFont(undefined, 'normal');
            doc.text(`Total de objetivos: ${total}`, 65, yPos);
            yPos += 7;
            
            doc.setFillColor(76, 175, 80); // Verde
            doc.circle(60, yPos, 3, 'F');
            doc.text(`Completados: ${completed} (${Math.round(completed/total*100)}%)`, 65, yPos);
            yPos += 7;
            
            doc.setFillColor(33, 150, 243); // Azul
            doc.circle(60, yPos, 3, 'F');
            doc.text(`En progreso: ${inProgress} (${Math.round(inProgress/total*100)}%)`, 65, yPos);
            yPos += 7;
            
            doc.setFillColor(158, 158, 158); // Gris
            doc.circle(60, yPos, 3, 'F');
            doc.text(`Pendientes: ${pending} (${Math.round(pending/total*100)}%)`, 65, yPos);
            yPos += 20;
            
            // Información de progreso global
            const overallProgress = specificObjectives.reduce((sum, obj) => sum + (obj.progress || 0), 0) / total;
            
            doc.setFont(undefined, 'bold');
            doc.text(`Progreso general: ${Math.round(overallProgress)}%`, 65, yPos);
            yPos += 10;
            
            // Barra de progreso general
            doc.setDrawColor(220, 220, 220);
            doc.setFillColor(220, 220, 220);
            doc.roundedRect(65, yPos, 100, 8, 1, 1, 'F');
            
            if (overallProgress > 0) {
                const progressWidth = (overallProgress / 100) * 100;
                doc.setDrawColor(33, 150, 243);
                doc.setFillColor(33, 150, 243);
                doc.roundedRect(65, yPos, progressWidth, 8, 1, 1, 'F');
            }
        }
        
        // Añadir pie de página
        const pageCount = doc.getNumberOfPages();
        for (let i = 1; i <= pageCount; i++) {
            doc.setPage(i);
            
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.text(`Página ${i} de ${pageCount} - ${centerName}`, 105, 290, null, null, 'center');
            
            // Añadir timestamp y profesional
            const timestamp = new Date().toLocaleString();
            doc.text(`Generado: ${timestamp} - Kinesiólogo: ${therapistName}`, 105, 285, null, null, 'center');
        }
        
        // Guardar el PDF
        try {
            const patientName = patient.name || 'Paciente';
            const sanitizedName = patientName.replace(/[^a-zA-Z0-9]/g, '_');
            const today = new Date().toISOString().slice(0, 10);
            
            doc.save(`Objetivos_${sanitizedName}_${today}.pdf`);
            
            hideLoading();
            showToast('PDF de objetivos generado correctamente', 'success');
        } catch (error) {
            hideLoading();
            console.error('Error guardando PDF:', error);
            showToast('Error al guardar PDF: ' + error.message, 'error');
        }
    } catch (error) {
        hideLoading();
        console.error('Error generando PDF de objetivos:', error);
        showToast('Error al generar PDF: ' + error.message, 'error');
    }
}



        // Datos para estructuras anatómicas y funciones
const anatomicalStructures = {
    "Miembro superior": ["Hombro", "Codo", "Muñeca", "Mano", "Dedos", "Manguito rotador", "Bíceps", "Tríceps", "Deltoides", "Trapecio", "Serrato anterior", "Supraespinoso", "Infraespinoso", "Redondo menor", "Subescapular"],
    "Miembro inferior": ["Cadera", "Rodilla", "Tobillo", "Pie", "Cuádriceps", "Isquiotibiales", "Glúteos", "Aductores", "Abductores", "Gastrocnemios", "Sóleo", "Tibial anterior", "Peroneos"],
    "Columna": ["Cervical", "Dorsal", "Lumbar", "Sacro", "Coccix", "Paravertebrales", "Multífidos", "Transverso abdominal", "Oblicuos", "Recto abdominal"],
    "Articulaciones": ["Glenohumeral", "Acromioclavicular", "Esternoclavicular", "Coxofemoral", "Femorotibial", "Tibioperonea", "Tibioperoneoastragalina", "Subastragalina", "Temporomandibular"]
};

const functionalCapabilities = {
    "Movilidad": ["Flexibilidad", "Amplitud articular", "Movilidad activa", "Movilidad pasiva", "Deslizamiento articular"],
    "Fuerza": ["Fuerza muscular", "Resistencia muscular", "Potencia", "Estabilidad", "Capacidad de carga"],
    "Control motor": ["Coordinación", "Equilibrio", "Propiocepción", "Control postural", "Estabilidad dinámica", "Reclutamiento muscular"],
    "Función cardiorrespiratoria": ["Capacidad aeróbica", "Resistencia", "Mecánica respiratoria", "Expansión torácica", "Patrón respiratorio"],
    "Marcha y locomoción": ["Patrón de marcha", "Transferencias", "Subir/bajar escaleras", "Carrera", "Salto"]
};


    // Botones para mostrar estructuras y funciones en objetivo general
    const showStructuresBtn = document.getElementById('showStructuresBtn');
    const showFunctionsBtn = document.getElementById('showFunctionsBtn');
    const structuresFunctionsList = document.getElementById('structuresFunctionsList');
    const bodyAreaInput = document.getElementById('bodyAreaInput');
    
    if (showStructuresBtn && showFunctionsBtn && structuresFunctionsList && bodyAreaInput) {
        showStructuresBtn.addEventListener('click', function() {
            structuresFunctionsList.style.display = 'block';
            structuresFunctionsList.innerHTML = '';
            
            // Crear lista de estructuras
            for (const category in anatomicalStructures) {
                const categoryDiv = document.createElement('div');
                categoryDiv.innerHTML = `<strong>${category}:</strong>`;
                structuresFunctionsList.appendChild(categoryDiv);
                
                const structuresList = document.createElement('div');
                structuresList.style.display = 'flex';
                structuresList.style.flexWrap = 'wrap';
                structuresList.style.gap = '5px';
                structuresList.style.marginBottom = '10px';
                
                anatomicalStructures[category].forEach(structure => {
                    const structureBtn = document.createElement('button');
                    structureBtn.type = 'button';
                    structureBtn.className = 'structure-btn';
                    structureBtn.textContent = structure;
                    structureBtn.style.padding = '3px 8px';
                    structureBtn.style.fontSize = '12px';
                    structureBtn.style.backgroundColor = 'var(--background)';
                    structureBtn.style.border = '1px solid var(--border)';
                    structureBtn.style.borderRadius = '4px';
                    structureBtn.style.cursor = 'pointer';
                    
                    structureBtn.addEventListener('click', function() {
                        bodyAreaInput.value = structure.toLowerCase();
                        structuresFunctionsList.style.display = 'none';
                    });
                    
                    structuresList.appendChild(structureBtn);
                });
                
                structuresFunctionsList.appendChild(structuresList);
            }
        });
        
        showFunctionsBtn.addEventListener('click', function() {
            structuresFunctionsList.style.display = 'block';
            structuresFunctionsList.innerHTML = '';
            
            // Crear lista de funciones
            for (const category in functionalCapabilities) {
                const categoryDiv = document.createElement('div');
                categoryDiv.innerHTML = `<strong>${category}:</strong>`;
                structuresFunctionsList.appendChild(categoryDiv);
                
                const functionsList = document.createElement('div');
                functionsList.style.display = 'flex';
                functionsList.style.flexWrap = 'wrap';
                functionsList.style.gap = '5px';
                functionsList.style.marginBottom = '10px';
                
                functionalCapabilities[category].forEach(func => {
                    const funcBtn = document.createElement('button');
                    funcBtn.type = 'button';
                    funcBtn.className = 'function-btn';
                    funcBtn.textContent = func;
                    funcBtn.style.padding = '3px 8px';
                    funcBtn.style.fontSize = '12px';
                    funcBtn.style.backgroundColor = 'var(--background)';
                    funcBtn.style.border = '1px solid var(--border)';
                    funcBtn.style.borderRadius = '4px';
                    funcBtn.style.cursor = 'pointer';
                    
                    funcBtn.addEventListener('click', function() {
                        bodyAreaInput.value = func.toLowerCase();
                        structuresFunctionsList.style.display = 'none';
                    });
                    
                    functionsList.appendChild(funcBtn);
                });
                
                structuresFunctionsList.appendChild(functionsList);
            }
        });
    }

    // Botones para mostrar estructuras y funciones en objetivo específico
    const showSpecificStructuresBtn = document.getElementById('showSpecificStructuresBtn');
    const showSpecificFunctionsBtn = document.getElementById('showSpecificFunctionsBtn');
    const specificStructuresList = document.getElementById('specificStructuresList');
    const structureInput = document.getElementById('structureInput');
    
    if (showSpecificStructuresBtn && showSpecificFunctionsBtn && specificStructuresList && structureInput) {
        showSpecificStructuresBtn.addEventListener('click', function() {
            specificStructuresList.style.display = 'block';
            specificStructuresList.innerHTML = '';
            
            // Crear lista de estructuras
            for (const category in anatomicalStructures) {
                const categoryDiv = document.createElement('div');
                categoryDiv.innerHTML = `<strong>${category}:</strong>`;
                specificStructuresList.appendChild(categoryDiv);
                
                const structuresList = document.createElement('div');
                structuresList.style.display = 'flex';
                structuresList.style.flexWrap = 'wrap';
                structuresList.style.gap = '5px';
                structuresList.style.marginBottom = '10px';
                
                anatomicalStructures[category].forEach(structure => {
                    const structureBtn = document.createElement('button');
                    structureBtn.type = 'button';
                    structureBtn.className = 'structure-btn';
                    structureBtn.textContent = structure;
                    structureBtn.style.padding = '3px 8px';
                    structureBtn.style.fontSize = '12px';
                    structureBtn.style.backgroundColor = 'var(--background)';
                    structureBtn.style.border = '1px solid var(--border)';
                    structureBtn.style.borderRadius = '4px';
                    structureBtn.style.cursor = 'pointer';
                    
                    structureBtn.addEventListener('click', function() {
                        structureInput.value = structure.toLowerCase();
                        specificStructuresList.style.display = 'none';
                    });
                    
                    structuresList.appendChild(structureBtn);
                });
                
                specificStructuresList.appendChild(structuresList);
            }
        });
        
        showSpecificFunctionsBtn.addEventListener('click', function() {
            specificStructuresList.style.display = 'block';
            specificStructuresList.innerHTML = '';
            
            // Crear lista de funciones
            for (const category in functionalCapabilities) {
                const categoryDiv = document.createElement('div');
                categoryDiv.innerHTML = `<strong>${category}:</strong>`;
                specificStructuresList.appendChild(categoryDiv);
                
                const functionsList = document.createElement('div');
                functionsList.style.display = 'flex';
                functionsList.style.flexWrap = 'wrap';
                functionsList.style.gap = '5px';
                functionsList.style.marginBottom = '10px';
                
                functionalCapabilities[category].forEach(func => {
                    const funcBtn = document.createElement('button');
                    funcBtn.type = 'button';
                    funcBtn.className = 'function-btn';
                    funcBtn.textContent = func;
                    funcBtn.style.padding = '3px 8px';
                    funcBtn.style.fontSize = '12px';
                    funcBtn.style.backgroundColor = 'var(--background)';
                    funcBtn.style.border = '1px solid var(--border)';
                    funcBtn.style.borderRadius = '4px';
                    funcBtn.style.cursor = 'pointer';
                    
                    funcBtn.addEventListener('click', function() {
                        structureInput.value = func.toLowerCase();
                        specificStructuresList.style.display = 'none';
                    });
                    
                    functionsList.appendChild(funcBtn);
                });
                
                specificStructuresList.appendChild(functionsList);
            }
        });
    }

    // Botón para eliminar objetivo general
const deleteGeneralObjectiveBtn = document.getElementById('deleteGeneralObjectiveBtn');
if (deleteGeneralObjectiveBtn) {
    // Clonar el botón para eliminar event listeners anteriores
    const newBtn = deleteGeneralObjectiveBtn.cloneNode(true);
    deleteGeneralObjectiveBtn.parentNode.replaceChild(newBtn, deleteGeneralObjectiveBtn);
    
    newBtn.addEventListener('click', async function() {
        if (!currentPatientId) {
            showToast("Error: No hay paciente seleccionado", "error");
            return;
        }
        
        if (confirm("¿Está seguro que desea eliminar el objetivo general? Esta acción no se puede deshacer.")) {
            try {
                showLoading();
                
                // Eliminar directamente el documento de objetivo general
                const objectiveRef = doc(db, "patients", currentPatientId, "objectives", "general");
                await deleteDoc(objectiveRef);
                
                // Limpiar caché
                if (objectivesCache[currentPatientId] && objectivesCache[currentPatientId].general) {
                    delete objectivesCache[currentPatientId].general;
                }
                
                // Actualizar la interfaz
                const noGeneralObjective = document.getElementById('noGeneralObjective');
                const generalObjectiveContent = document.getElementById('generalObjectiveContent');
                
                if (noGeneralObjective) noGeneralObjective.style.display = 'block';
                if (generalObjectiveContent) generalObjectiveContent.style.display = 'none';
                
                hideLoading();
                showToast("Objetivo general eliminado correctamente", "success");
            } catch (error) {
                hideLoading();
                console.error("Error eliminando objetivo general:", error);
                showToast("Error al eliminar objetivo general: " + error.message, "error");
            }
        }
    });
}

   

    // Función para actualizar la vista previa del objetivo específico
    function updateSpecificObjectivePreview() {
        const verb = document.getElementById('actionVerbSelect').value;
        const structure = document.getElementById('structureInput').value;
        const initialValue = document.getElementById('initialValueInput').value;
        const targetValue = document.getElementById('targetValueInput').value;
        const method = document.getElementById('evaluationMethodSelect').value;
        const duration = document.getElementById('durationInput').value;
        const durationUnit = document.getElementById('durationUnitSelect').value;
        
        const preview = document.getElementById('specificObjectivePreview');
        if (preview) {
            preview.textContent = `${verb} ${structure ? 'la ' + structure : 'la estructura/función'} de ${initialValue || 'valor inicial'} a ${targetValue || 'valor objetivo'} en ${method || 'método de evaluación'} en ${duration || '2'} ${durationUnit || 'semanas'}.`;
        }
    }

    // Actualizar vista previa al cambiar cualquier campo
    const specificObjectiveInputs = [
        'actionVerbSelect', 'structureInput', 'initialValueInput', 
        'targetValueInput', 'evaluationMethodSelect', 'durationInput', 
        'durationUnitSelect'
    ];
    
    specificObjectiveInputs.forEach(inputId => {
        const element = document.getElementById(inputId);
        if (element) {
            element.addEventListener('input', updateSpecificObjectivePreview);
            element.addEventListener('change', updateSpecificObjectivePreview);
        }
    });
});




        // Habilitar reordenamiento de objetivos (drag and drop)
function setupObjectiveReordering() {
    const objectivesList = document.getElementById('specificObjectivesList');
    if (!objectivesList) return;
    
    // Comprobar si ya se configuró antes para evitar duplicar
    if (objectivesList.getAttribute('data-sortable-initialized') === 'true') return;
    objectivesList.setAttribute('data-sortable-initialized', 'true');
    
    // Hacer que los elementos sean arrastrables
    const cards = objectivesList.querySelectorAll('.objective-card');
    cards.forEach(card => {
        card.setAttribute('draggable', 'true');
        
        // Añadir indicador visual de "arrastrable"
        const dragHandle = document.createElement('div');
        dragHandle.className = 'drag-handle';
        dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
        dragHandle.style.position = 'absolute';
        dragHandle.style.top = '15px';
        dragHandle.style.left = '5px';
        dragHandle.style.color = 'var(--text-secondary)';
        dragHandle.style.opacity = '0.5';
        dragHandle.style.cursor = 'move';
        
        // Asegurar que la card tiene posición relativa para posicionar el handle
        card.style.position = 'relative';
        card.style.paddingLeft = '25px';
        
        card.appendChild(dragHandle);
        
        // Eventos de arrastrar
        card.addEventListener('dragstart', function(e) {
            e.dataTransfer.setData('text/plain', this.getAttribute('data-id'));
            this.classList.add('dragging');
            setTimeout(() => this.style.opacity = '0.4', 0);
        });
        
        card.addEventListener('dragend', function() {
            this.classList.remove('dragging');
            this.style.opacity = '1';
        });
    });
    
    // Eventos para la zona donde se sueltan
    objectivesList.addEventListener('dragover', function(e) {
        e.preventDefault();
        const draggable = document.querySelector('.dragging');
        if (!draggable) return;
        
        const afterElement = getDragAfterElement(objectivesList, e.clientY);
        if (afterElement) {
            objectivesList.insertBefore(draggable, afterElement);
        } else {
            objectivesList.appendChild(draggable);
        }
    });
    
    objectivesList.addEventListener('drop', function(e) {
        e.preventDefault();
        // Aquí podrías guardar el nuevo orden en la base de datos si es necesario
    });
    
    // Función para determinar después de qué elemento insertar
    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.objective-card:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }
}

// Llamar a esta función cuando se cargan los objetivos específicos
document.addEventListener('DOMContentLoaded', function() {
    // Añadir observer para detectar cuando se agregan objetivos a la lista
    const objectivesList = document.getElementById('specificObjectivesList');
    if (objectivesList) {
        const observer = new MutationObserver(function(mutations) {
            setupObjectiveReordering();
        });
        
        observer.observe(objectivesList, { childList: true });
    }
});



// Función para cargar y mostrar archivos guardados del paciente
// Función para cargar y mostrar archivos guardados del paciente
async function loadPatientFiles(patientId) {
    try {
        // Siempre limpiar TODOS los posibles contenedores de archivos primero
        const previewContainer = document.getElementById('patientFilesPreview');
        const clinicalFilesContainer = document.getElementById('clinicalFiles');
        
        // Limpiar todos los contenedores posibles
        if (previewContainer) previewContainer.innerHTML = '';
        if (clinicalFilesContainer) clinicalFilesContainer.innerHTML = '';
        
        // Si no hay ID de paciente válido, terminar aquí
        if (!patientId) return;
        
        // Obtener datos del paciente
        const patient = await getPatient(patientId);
        
        // Si el paciente no existe o no tiene archivos, mostrar mensaje y terminar
        if (!patient || !patient.files || !patient.files.length) {
            const noFilesMessage = '<p style="color: var(--text-secondary); font-style: italic;">No hay documentos cargados para este paciente.</p>';
            if (previewContainer) previewContainer.innerHTML = noFilesMessage;
            return;
        }
        
        console.log(`Mostrando ${patient.files.length} archivos para el paciente ${patientId}`);
        
        // Crear tabla para mostrar los archivos - SOLO USAREMOS UN CONTENEDOR
        const table = document.createElement('table');
        table.className = 'files-table';
        table.style.width = '100%';
        table.style.borderCollapse = 'collapse';
        table.style.marginTop = '10px';
        
        // Cabecera de la tabla
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border);">Nombre</th>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border);">Tipo</th>
                <th style="text-align: left; padding: 8px; border-bottom: 1px solid var(--border);">Fecha</th>
                <th style="text-align: right; padding: 8px; border-bottom: 1px solid var(--border);">Acciones</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Cuerpo de la tabla
        const tbody = document.createElement('tbody');
        
        patient.files.forEach((file, index) => {
            const row = document.createElement('tr');
            row.style.borderBottom = '1px solid var(--border-light)';
            
            // Determinar el tipo de archivo
            const isImage = file.type === 'image';
            const isPDF = file.name && file.name.toLowerCase().endsWith('.pdf');
            let fileIcon = '<i class="fas fa-file" style="color: #3498db;"></i>';
            if (isImage) {
                fileIcon = '<i class="fas fa-image" style="color: #2ecc71;"></i>';
            } else if (isPDF) {
                fileIcon = '<i class="fas fa-file-pdf" style="color: #e74c3c;"></i>';
            }
            
            // Formatear fecha
            const uploadDate = file.uploadDate ? formatDate(new Date(file.uploadDate)) : 'No disponible';
            
            row.innerHTML = `
                <td style="padding: 8px;">${fileIcon} ${file.name || 'Archivo sin nombre'}</td>
                <td style="padding: 8px;">${isImage ? 'Imagen' : (isPDF ? 'PDF' : 'Documento')}</td>
                <td style="padding: 8px;">${uploadDate}</td>
                <td style="padding: 8px; text-align: right;">
                    <a href="${file.url}" target="_blank" title="Ver" class="file-action-btn">
                        <i class="fas fa-eye"></i>
                    </a>
                    <a href="${file.url}" download="${file.name}" title="Descargar" class="file-action-btn">
                        <i class="fas fa-download"></i>
                    </a>
                    <button type="button" class="file-action-btn delete-file-btn" data-index="${index}" data-file-id="${file.fileId || ''}">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </td>
            `;
            
            tbody.appendChild(row);
        });
        
        table.appendChild(tbody);
        
        // IMPORTANTE: Solo añadir la tabla a un contenedor (previewContainer)
        if (previewContainer) {
            previewContainer.innerHTML = '';
            previewContainer.appendChild(table);
        }
        
       
        </script>


          // Función de prueba para verificar datos del paciente
async function verificarDatosPaciente(patientId) {
    try {
        console.log("============ VERIFICACIÓN DE DATOS DEL PACIENTE ============");
        console.log("ID del paciente:", patientId);
        
        // Verificar objetivos
        console.log("VERIFICANDO OBJETIVOS...");
        
        // Objetivo general
        const generalRef = doc(db, "patients", patientId, "objectives", "general");
        const generalSnap = await getDoc(generalRef);
        if (generalSnap.exists()) {
            console.log("✅ OBJETIVO GENERAL ENCONTRADO:", generalSnap.data());
        } else {
            console.log("❌ NO SE ENCONTRÓ OBJETIVO GENERAL");
        }
        
        // Objetivos específicos
        const objectivesRef = collection(db, "patients", patientId, "objectives");
        const objectivesQuery = query(objectivesRef, where(documentId(), "!=", "general"));
        const objectivesSnap = await getDocs(objectivesQuery);
        
        if (objectivesSnap.empty) {
            console.log("❌ NO SE ENCONTRARON OBJETIVOS ESPECÍFICOS");
        } else {
            const specificObjectives = objectivesSnap.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ SE ENCONTRARON ${specificObjectives.length} OBJETIVOS ESPECÍFICOS:`, specificObjectives);
        }
        
        // Verificar planes de tratamiento
        console.log("VERIFICANDO PLANES DE TRATAMIENTO...");
        
        const plansRef = collection(db, "patients", patientId, "treatmentPlans");
        const plansQuery = query(plansRef, orderBy("createdAt", "desc"));
        const plansSnapshot = await getDocs(plansQuery);
        
        if (plansSnapshot.empty) {
            console.log("❌ NO SE ENCONTRARON PLANES DE TRATAMIENTO");
        } else {
            const treatmentPlans = plansSnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            console.log(`✅ SE ENCONTRARON ${treatmentPlans.length} PLANES DE TRATAMIENTO:`, treatmentPlans);
        }
        
        console.log("============ FIN DE VERIFICACIÓN ============");
        
        return true;
    } catch (error) {
        console.error("❌ ERROR EN LA VERIFICACIÓN:", error);
        return false;
    }
}

// Modificación de la función exportToPDF para asegurar que llame a verificarDatosPaciente primero
const originalExportToPDF = exportToPDF;
exportToPDF = async function(patientId) {
    console.log("Iniciando verificación de datos antes de generar PDF");
    await verificarDatosPaciente(patientId);
    console.log("Verificación completada, procediendo a generar PDF");
    return await originalExportToPDF(patientId);
};





        // Configurar botón de diagnóstico
document.addEventListener('DOMContentLoaded', function() {
    const diagButton = document.getElementById('diagnosisButton');
    if (diagButton) {
        diagButton.addEventListener('click', function() {
            verificarDatosPaciente(currentPatientId).then(result => {
                showToast("Diagnóstico completado, revisa la consola (F12)", "info");
            });
        });
    }
});


        
        </script>

    <script>
// Función para mostrar información de intensidad
function mostrarInfoIntensidad(tipo) {
    let mensaje = "";
    
    if (tipo === 'RPE') {
        mensaje = "ESCALA RPE (Rating of Perceived Exertion)\n\n" +
            "0 = Reposo absoluto\n" +
            "1 = Esfuerzo muy, muy ligero\n" +
            "2 = Esfuerzo muy ligero\n" +
            "3 = Esfuerzo ligero\n" +
            "4 = Esfuerzo moderado\n" +
            "5 = Esfuerzo algo duro\n" +
            "6 = Esfuerzo duro\n" +
            "7-8 = Esfuerzo muy duro\n" +
            "9 = Esfuerzo extremadamente duro\n" +
            "10 = Esfuerzo máximo (imposible continuar)";
    } else {
        mensaje = "ESCALA RIR (Repeticiones en Reserva)\n\n" +
            "0 = No podría realizar ni una repetición más (fallo muscular)\n" +
            "1 = Podría realizar 1 repetición más\n" +
            "2 = Podría realizar 2 repeticiones más\n" +
            "3 = Podría realizar 3 repeticiones más\n" +
            "4 = Podría realizar 4 repeticiones más\n" +
            "5+ = Podría realizar 5 o más repeticiones adicionales";
    }
    
    alert(mensaje);
}
</script>
  
</script>
