<!-- Script for Firebase -->
    <script type="module">


        // Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
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
        
        console.log("Firebase inicializado correctamente");
        
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

// Add new patient to Firebase
async function addPatient(patientData) {
    try {
        showLoading();
        
        // Validar datos mínimos requeridos
        if (!patientData.name || !patientData.rut) {
            hideLoading();
            showToast("Nombre y RUT son campos obligatorios", "error");
            return null;
        }
        
        // Crear documento del paciente
        const patientDoc = {
            name: patientData.name,
            rut: patientData.rut,
            birthDate: patientData.birthDate || "",
            phone: patientData.phone || "",
            email: patientData.email || "",
            address: patientData.address || "",
            medicalHistory: patientData.medicalHistory || "",
            medications: patientData.medications || "",
            student: patientData.student || "",
            progress: 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        console.log("Registrando paciente:", patientDoc);
        
        // Usar colección de pacientes
        const patientsRef = collection(db, "patients");
        const docRef = await addDoc(patientsRef, patientDoc);
        
        console.log("Paciente registrado con ID:", docRef.id);
        
        hideLoading();
        showToast("Paciente registrado correctamente", "success");
        
        // Recargar pacientes
        await getPatients();
        
        return docRef.id;
    } catch (error) {
        console.error("Error al registrar paciente:", error);
        hideLoading();
        showToast(`Error al registrar: ${error.message}`, "error");
        return null;
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

// Update dashboard statistics
function updateDashboardStats(patients) {
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

        // AÑADIR ESTA LÍNEA: Cargar datos CIF del paciente
        await loadAllCifData(patientId);
        
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

// Render attachments
function renderAttachments(attachments) {
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

        // Initialize diagnosis tab
function initDiagnosisTab(patientId) {
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
function openDiagnosisModal(patientId) {
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
        } catch (error) {
            hideLoading();
            console.error("Error al guardar diagnóstico:", error);
            showToast("Error al guardar diagnóstico: " + error.message, "error");
        }
    });
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
function setupCifCategories(patientId) {
    // Implementar selección básica de códigos CIF para cada categoría
    setupCifCategory('addCifFunctionBtn', 'cifFunctions', 'Función', getCifFunctions(patientId));
    setupCifCategory('addCifStructureBtn', 'cifStructures', 'Estructura', getCifStructures(patientId));
    setupCifCategory('addCifActivityBtn', 'cifActivities', 'Actividad', getCifActivities(patientId));
    setupCifCategory('addCifFactorBtn', 'cifFactors', 'Factor', getCifFactors(patientId));
    
    // Cargar factores personales
    loadPersonalFactors(patientId);
}

// Configurar una categoría CIF específica
function setupCifCategory(buttonId, containerId, categoryType, items) {
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
function renderCifItems(container, items) {
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

// Obtener funciones CIF del paciente desde Firebase
async function getCifFunctions(patientId) {
    try {
        if (!patientId) return [];
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) return [];
        
        const patientData = patientDoc.data();
        
        // Verificar si existen datos CIF
        if (!patientData.cifItems || !patientData.cifItems.función) return [];
        
        return patientData.cifItems.función;
    } catch (error) {
        console.error("Error al obtener funciones CIF:", error);
        return [];
    }
}

// Obtener estructuras CIF del paciente desde Firebase
async function getCifStructures(patientId) {
    try {
        if (!patientId) return [];
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) return [];
        
        const patientData = patientDoc.data();
        
        // Verificar si existen datos CIF
        if (!patientData.cifItems || !patientData.cifItems.estructura) return [];
        
        return patientData.cifItems.estructura;
    } catch (error) {
        console.error("Error al obtener estructuras CIF:", error);
        return [];
    }
}

// Obtener actividades CIF del paciente desde Firebase
async function getCifActivities(patientId) {
    try {
        if (!patientId) return [];
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) return [];
        
        const patientData = patientDoc.data();
        
        // Verificar si existen datos CIF
        if (!patientData.cifItems || !patientData.cifItems.actividad) return [];
        
        return patientData.cifItems.actividad;
    } catch (error) {
        console.error("Error al obtener actividades CIF:", error);
        return [];
    }
}

// Obtener factores CIF del paciente desde Firebase
async function getCifFactors(patientId) {
    try {
        if (!patientId) return [];
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) return [];
        
        const patientData = patientDoc.data();
        
        // Verificar si existen datos CIF
        if (!patientData.cifItems || !patientData.cifItems.factor) return [];
        
        return patientData.cifItems.factor;
    } catch (error) {
        console.error("Error al obtener factores CIF:", error);
        return [];
    }
}

// Cargar todos los datos CIF del paciente
async function loadAllCifData(patientId) {
    try {
        if (!patientId) return;
        
        showLoading();
        
        // Cargar funciones
        const functions = await getCifFunctions(patientId);
        displayCifItems('cifFunctions', functions);
        
        // Cargar estructuras
        const structures = await getCifStructures(patientId);
        displayCifItems('cifStructures', structures);
        
        // Cargar actividades
        const activities = await getCifActivities(patientId);
        displayCifItems('cifActivities', activities);
        
        // Cargar factores
        const factors = await getCifFactors(patientId);
        displayCifItems('cifFactors', factors);
        
        // Cargar factores personales
        await loadPersonalFactors(patientId);
        
        hideLoading();
    } catch (error) {
        console.error("Error al cargar datos CIF:", error);
        hideLoading();
    }
}

// Mostrar elementos CIF en la interfaz
function displayCifItems(containerId, items) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    // Limpiar contenedor
    container.innerHTML = '';
    
    // Mostrar mensaje si no hay elementos
    if (!items || items.length === 0) {
        const emptyMessage = document.createElement('p');
        emptyMessage.textContent = 'No hay elementos registrados';
        emptyMessage.className = 'empty-message';
        container.appendChild(emptyMessage);
        return;
    }
    
    // Mostrar elementos
    items.forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.className = 'cif-item';
        itemElement.dataset.id = item.id || `cif-${item.code}`;
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
                    
                    // Actualizar valor en Firebase (en tiempo real)
                    const categoryType = containerId.replace('cif', '').toLowerCase();
                    updateCifItemValue(currentPatientId, categoryType, itemElement.dataset.id, parseInt(this.textContent));
                }
            });
        });
        
        container.appendChild(itemElement);
    });
}
        
// Cargar factores personales desde Firebase
async function loadPersonalFactors(patientId) {
    try {
        if (!patientId) return;
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) return;
        
        const patientData = patientDoc.data();
        
        // Cargar factores personales
        const cifPersonalFactors = document.getElementById('cifPersonalFactors');
        if (cifPersonalFactors && patientData.personalFactors) {
            cifPersonalFactors.value = patientData.personalFactors;
        }
    } catch (error) {
        console.error("Error al cargar factores personales:", error);
    }
}

// Mostrar selector de CIF
// Mostrar selector de CIF
// Mostrar selector de CIF con lista desplegable
function showCifSelectorModal(categoryType, targetContainerId, patientId) {
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
    
    // Guardar información para uso posterior
    cifModal.setAttribute('data-target', targetContainerId);
    cifModal.setAttribute('data-category', categoryType);
    cifModal.setAttribute('data-patient', patientId);
    
    // Mostrar modal
    cifModal.style.display = 'block';
    setTimeout(() => cifModal.classList.add('active'), 50);
    
    // Obtener datos de ejemplo según categoría
    let cifCodes = [];
    switch(categoryType) {
        case 'Función':
            cifCodes = [
                { code: 'b280', name: 'Sensación de dolor', desc: 'Sensaciones desagradables que indican daño potencial o real en alguna estructura corporal.' },
                { code: 'b455', name: 'Funciones relacionadas con la tolerancia al ejercicio', desc: 'Funciones relacionadas con la capacidad respiratoria y cardiovascular necesaria para resistir el ejercicio físico.' },
                { code: 'b730', name: 'Funciones de fuerza muscular', desc: 'Funciones relacionadas con la fuerza generada por la contracción de un músculo o grupo de músculos.' },
                { code: 'b735', name: 'Funciones relacionadas con el tono muscular', desc: 'Funciones relacionadas con la tensión presente en los músculos cuando están en reposo y la resistencia que ofrecen al intentar moverlos pasivamente.' },
                { code: 'b740', name: 'Funciones relacionadas con la resistencia muscular', desc: 'Funciones relacionadas con el mantenimiento de la contracción muscular durante un período de tiempo determinado.' }
            ];
            break;
        case 'Estructura':
            cifCodes = [
                { code: 's710', name: 'Estructura de la cabeza y cuello', desc: 'Estructura del cráneo, cara, y región cervical.' },
                { code: 's720', name: 'Estructura de la región del hombro', desc: 'Estructura de la escápula, clavícula, articulación glenohumeral y tejidos relacionados.' },
                { code: 's730', name: 'Estructura de la extremidad superior', desc: 'Estructura del brazo, antebrazo y mano.' },
                { code: 's740', name: 'Estructura de la región pélvica', desc: 'Estructura de la pelvis, articulación de la cadera y tejidos relacionados.' },
                { code: 's750', name: 'Estructura de la extremidad inferior', desc: 'Estructura del muslo, pierna y pie.' }
            ];
            break;
        case 'Actividad':
            cifCodes = [
                { code: 'd410', name: 'Cambiar las posturas corporales básicas', desc: 'Adoptar o abandonar una postura, pasar de un lugar a otro.' },
                { code: 'd415', name: 'Mantener la posición del cuerpo', desc: 'Mantener el cuerpo en la misma posición durante el tiempo necesario.' },
                { code: 'd430', name: 'Levantar y llevar objetos', desc: 'Levantar un objeto o llevar algo de un sitio a otro.' },
                { code: 'd450', name: 'Caminar', desc: 'Andar sobre una superficie a pie, paso a paso.' },
                { code: 'd455', name: 'Desplazarse por el entorno', desc: 'Mover todo el cuerpo de un sitio a otro sin caminar.' }
            ];
            break;
        case 'Factor':
            cifCodes = [
                { code: 'e110', name: 'Productos para consumo personal', desc: 'Cualquier sustancia natural o fabricada por el hombre, recogida, procesada o manufacturada para la ingesta.' },
                { code: 'e115', name: 'Productos y tecnología para uso personal en la vida diaria', desc: 'Equipamiento, productos y tecnología utilizados por las personas en las actividades cotidianas.' },
                { code: 'e120', name: 'Productos y tecnología para la movilidad y el transporte personal', desc: 'Equipamiento, productos y tecnología utilizados por las personas para desplazarse dentro y fuera de los edificios.' },
                { code: 'e310', name: 'Familiares cercanos', desc: 'Individuos emparentados por el nacimiento, el matrimonio o cualquier relación reconocida por la cultura como familia cercana.' },
                { code: 'e355', name: 'Profesionales de la salud', desc: 'Todos los proveedores de servicios que trabajan en el contexto del sistema sanitario.' }
            ];
            break;
    }
    
    // Crear lista desplegable
    const codeInput = document.getElementById('cifCodeInput');
    const nameInput = document.getElementById('cifNameInput');
    const descInput = document.getElementById('cifDescInput');
    
    // Reemplazar el campo de búsqueda con un select
    const codeSelect = document.createElement('select');
    codeSelect.className = 'form-control';
    codeSelect.id = 'cifCodeSelect';
    
    // Añadir opción por defecto
    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = `-- Seleccionar código CIF ${categoryType.toLowerCase()} --`;
    codeSelect.appendChild(defaultOption);
    
    // Añadir opciones de códigos CIF
    cifCodes.forEach(code => {
        const option = document.createElement('option');
        option.value = code.code;
        option.textContent = `${code.code} - ${code.name}`;
        option.dataset.name = code.name;
        option.dataset.desc = code.desc;
        codeSelect.appendChild(option);
    });
    
    // Reemplazar el input con el select
    if (codeInput && codeInput.parentNode) {
        codeInput.parentNode.replaceChild(codeSelect, codeInput);
    }
    
    // Evento para actualizar los campos cuando se selecciona un código
    codeSelect.addEventListener('change', function() {
        const selectedOption = this.options[this.selectedIndex];
        if (selectedOption.value) {
            // Actualizar campo de código
            const codeInputHidden = document.createElement('input');
            codeInputHidden.type = 'hidden';
            codeInputHidden.id = 'cifCodeInput';
            codeInputHidden.value = selectedOption.value;
            if (document.getElementById('cifCodeInput')) {
                document.getElementById('cifCodeInput').remove();
            }
            this.parentNode.appendChild(codeInputHidden);
            
            // Actualizar nombre y descripción
            if (nameInput) nameInput.value = selectedOption.dataset.name || '';
            if (descInput) descInput.value = selectedOption.dataset.desc || '';
        } else {
            // Limpiar campos si se selecciona la opción por defecto
            if (nameInput) nameInput.value = '';
            if (descInput) descInput.value = '';
        }
    });
    
    // Configurar botones del modal
    const closeBtn = document.getElementById('closeCifModal');
    if (closeBtn) {
        const newCloseBtn = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newCloseBtn, closeBtn);
        
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

// Función para obtener códigos CIF según categoría
function getCifCodesByCategory(categoryType) {
    let cifCodes = [];
    
    switch(categoryType) {
        case 'Función':
            cifCodes = [
                { code: 'b130', name: 'Funciones de la energía y los impulsos', desc: 'Funciones mentales generales de los mecanismos fisiológicos y psicológicos que empujan al individuo a satisfacer necesidades específicas y objetivos generales de forma persistente.' },
                { code: 'b134', name: 'Funciones del sueño', desc: 'Funciones mentales generales de desconexión física y mental periódica, reversible y selectiva, del entorno inmediato de la persona, acompañada de cambios fisiológicos característicos.' },
                { code: 'b152', name: 'Funciones emocionales', desc: 'Funciones mentales específicas relacionadas con los sentimientos y los componentes afectivos de los procesos mentales.' },
                { code: 'b280', name: 'Sensación de dolor', desc: 'Sensaciones desagradables que indican daño potencial o real en alguna estructura corporal.' },
                { code: 'b455', name: 'Funciones relacionadas con la tolerancia al ejercicio', desc: 'Funciones relacionadas con la capacidad respiratoria y cardiovascular necesaria para resistir el ejercicio físico.' },
                { code: 'b620', name: 'Funciones urinarias', desc: 'Funciones relacionadas con la excreción de la orina.' },
                { code: 'b710', name: 'Funciones relacionadas con la movilidad de las articulaciones', desc: 'Funciones relacionadas con la extensión y la facilidad de movimiento de una articulación.' },
                { code: 'b715', name: 'Funciones relacionadas con la estabilidad de las articulaciones', desc: 'Funciones relacionadas con el mantenimiento de la integridad estructural de las articulaciones.' },
                { code: 'b720', name: 'Funciones relacionadas con la movilidad de los huesos', desc: 'Funciones relacionadas con la facilidad de movimiento de la escápula, pelvis, huesos carpianos y tarsianos.' },
                { code: 'b730', name: 'Funciones relacionadas con la fuerza muscular', desc: 'Funciones relacionadas con la fuerza generada por la contracción de un músculo o grupo de músculos.' },
                { code: 'b735', name: 'Funciones relacionadas con el tono muscular', desc: 'Funciones relacionadas con la tensión presente en los músculos cuando están en reposo y la resistencia que ofrecen al intentar moverlos pasivamente.' },
                { code: 'b740', name: 'Funciones relacionadas con la resistencia muscular', desc: 'Funciones relacionadas con el mantenimiento de la contracción muscular durante un período de tiempo determinado.' },
                { code: 'b755', name: 'Funciones relacionadas con los reflejos motores', desc: 'Funciones relacionadas con la contracción involuntaria de los músculos, inducida automáticamente por estímulos específicos.' },
                { code: 'b760', name: 'Funciones relacionadas con el control de los movimientos voluntarios', desc: 'Funciones asociadas con el control sobre los movimientos voluntarios y la coordinación de los mismos.' },
                { code: 'b765', name: 'Funciones relacionadas con los movimientos involuntarios', desc: 'Funciones relacionadas con contracciones no intencionadas, involuntarias sin propósito final o con algo de propósito final.' },
                { code: 'b770', name: 'Funciones relacionadas con el patrón de la marcha', desc: 'Funciones relacionadas con los patrones de movimiento al caminar, correr u otros movimientos de todo el cuerpo.' },
                { code: 'b780', name: 'Sensaciones relacionadas con los músculos y las funciones del movimiento', desc: 'Sensaciones asociadas con los músculos o grupo de músculos del cuerpo y su movimiento.' }
            ];
            break;
        case 'Estructura':
            cifCodes = [
                { code: 's710', name: 'Estructura de la región de la cabeza y del cuello', desc: 'Estructura del cráneo, cara, y región del cuello.' },
                { code: 's720', name: 'Estructura de la región del hombro', desc: 'Estructura de la región del hombro.' },
                { code: 's730', name: 'Estructura de la extremidad superior', desc: 'Estructura del brazo, mano y dedos.' },
                { code: 's740', name: 'Estructura de la región pélvica', desc: 'Estructura de la región pélvica.' },
                { code: 's750', name: 'Estructura de la extremidad inferior', desc: 'Estructura de la pierna, pie y dedos del pie.' },
                { code: 's760', name: 'Estructura del tronco', desc: 'Estructura del tronco, espalda, incluida la pelvis.' },
                { code: 's770', name: 'Estructuras musculoesqueléticas adicionales relacionadas con el movimiento', desc: 'Huesos, articulaciones, músculos, ligamentos y fascias.' }
            ];
            break;
        case 'Actividad':
            cifCodes = [
                { code: 'd410', name: 'Cambiar las posturas corporales básicas', desc: 'Adoptar o abandonar una postura, pasar de un lugar a otro, como levantarse de una silla para tumbarse en una cama.' },
                { code: 'd415', name: 'Mantener la posición del cuerpo', desc: 'Mantener el cuerpo en la misma posición durante el tiempo necesario, como permanecer sentado o de pie en el trabajo o en el colegio.' },
                { code: 'd420', name: 'Transferir el propio cuerpo', desc: 'Moverse de una superficie a otra, como deslizarse a lo largo de un banco o pasar de estar sentado en la cama a sentarse en una silla.' },
                { code: 'd430', name: 'Levantar y llevar objetos', desc: 'Levantar un objeto o llevar algo de un sitio a otro, como ocurre al levantar una taza o llevar a un niño de una habitación a otra.' },
                { code: 'd435', name: 'Mover objetos con las extremidades inferiores', desc: 'Realizar acciones coordinadas con el fin de mover un objeto utilizando las piernas y los pies, como ocurre al dar patadas a un balón o pedalear en una bicicleta.' },
                { code: 'd440', name: 'Uso fino de la mano', desc: 'Realizar acciones coordinadas relacionadas con manejar, recoger, manipular y soltar objetos, utilizando la mano y los dedos incluyendo el pulgar, como es necesario para recoger monedas de una mesa, marcar un número de teléfono o girar una perilla.' },
                { code: 'd445', name: 'Uso de la mano y el brazo', desc: 'Realizar las acciones coordinadas que se requieren para manipular y mover objetos utilizando las manos y los brazos, como ocurre al girar picaportes o lanzar o atrapar un objeto.' },
                { code: 'd450', name: 'Caminar', desc: 'Andar sobre una superficie a pie, paso a paso, de manera que al menos un pie esté siempre en el suelo, como pasear, deambular, caminar hacia adelante, hacia atrás o de lado.' },
                { code: 'd455', name: 'Desplazarse por el entorno', desc: 'Mover todo el cuerpo de un sitio a otro siempre que no sea andando, como escalar una roca, correr por una calle, brincar, corretear, saltar, dar volteretas o correr esquivando obstáculos.' },
                { code: 'd460', name: 'Desplazarse por distintos lugares', desc: 'Andar y moverse por varios lugares y situaciones, como andar entre habitaciones en una casa, dentro de un edificio o por la calle de una ciudad.' },
                { code: 'd465', name: 'Desplazarse utilizando algún tipo de equipamiento', desc: 'Mover todo el cuerpo de un lugar a otro, sobre cualquier superficie o espacio, utilizando dispositivos específicos diseñados para facilitar el movimiento o crear métodos distintos de moverse, como patines, esquís, equipo de buceo, o desplazarse por una calle en una silla de ruedas o con un andador.' },
                { code: 'd470', name: 'Utilización de medios de transporte', desc: 'Utilizar medios de transporte para desplazarse como pasajero, como ser llevado en un coche, autobús, rickshaw, furgoneta, vehículo de tracción animal, taxi, tren, tranvía, metro, barco o avión.' },
                { code: 'd475', name: 'Conducción', desc: 'Dirigir y mover un vehículo o el animal que lo empuja, viajar bajo el control de uno mismo, o disponer de cualquier medio de transporte, como un coche, bicicleta, barco o animal.' }
            ];
            break;
        case 'Factor':
            cifCodes = [
                { code: 'e110', name: 'Productos o sustancias para el consumo personal', desc: 'Cualquier sustancia natural o fabricada por el hombre, recogida, procesada o manufacturada para la ingesta.' },
                { code: 'e115', name: 'Productos y tecnología para uso personal en la vida diaria', desc: 'Equipamiento, productos y tecnologías utilizados por las personas en las actividades cotidianas, incluyendo aquellos adaptados o diseñados específicamente, situados en, sobre o cerca de la persona que los utiliza.' },
                { code: 'e120', name: 'Productos y tecnología para la movilidad y el transporte personal en espacios cerrados y abiertos', desc: 'Equipamiento, productos y tecnologías utilizados por las personas para desplazarse dentro y fuera de los edificios incluyendo aquellos adaptados o diseñados específicamente, situados en, sobre o cerca de la persona que los utiliza.' },
                { code: 'e125', name: 'Productos y tecnología para la comunicación', desc: 'Equipamiento, productos y tecnologías utilizados por las personas para transmitir y recibir información, incluyendo aquellos adaptados o diseñados específicamente, situados en, sobre o cerca de la persona que los utiliza.' },
                { code: 'e135', name: 'Productos y tecnología para el empleo', desc: 'Equipamiento, productos y tecnología utilizados en el empleo para facilitar las actividades laborales.' },
                { code: 'e140', name: 'Productos y tecnología para las actividades culturales, recreativas y deportivas', desc: 'Equipamiento, productos y tecnología utilizados para la realización y mejora de las actividades culturales, recreativas y deportivas, incluyendo aquellos adaptados o diseñados específicamente.' },
                { code: 'e150', name: 'Diseño, construcción, materiales de construcción y tecnología arquitectónica para edificios de uso público', desc: 'Productos y tecnología que constituyen el ambiente fabricado por el hombre y que abarca aquellos espacios que han sido diseñados y construidos para uso público.' },
                { code: 'e155', name: 'Diseño, construcción, materiales de construcción y tecnología arquitectónica para edificios de uso privado', desc: 'Productos y tecnología que constituyen el ambiente fabricado por el hombre y que abarca aquellos espacios que han sido diseñados y construidos para uso privado.' },
                { code: 'e310', name: 'Familiares cercanos', desc: 'Individuos emparentados por el nacimiento, el matrimonio o cualquier relación reconocida por la cultura como familia cercana, como esposos, pareja, padres, hermanos, hijos, padres de acogida, padres adoptivos y abuelos.' },
                { code: 'e320', name: 'Amigos', desc: 'Individuos que son cercanos y que participan continuamente en relaciones caracterizadas por la confianza y el apoyo mutuo.' },
                { code: 'e325', name: 'Conocidos, compañeros, colegas, vecinos y miembros de la comunidad', desc: 'Individuos que mantienen una relación de familiaridad los unos con los otros, como conocidos, compañeros, colegas, vecinos, y miembros de la comunidad.' },
                { code: 'e355', name: 'Profesionales de la salud', desc: 'Todos los proveedores de servicios que trabajan en el contexto del sistema sanitario, como médicos, enfermeras, fisioterapeutas, terapeutas ocupacionales, logopedas, audiólogos, ortopedas, auxiliares sanitarios.' },
                { code: 'e410', name: 'Actitudes individuales de miembros de la familia cercana', desc: 'Opiniones y creencias generales o específicas de miembros de la familia cercana sobre la persona o sobre otras cuestiones (ej. cuestiones sociales, políticas y económicas) que influyen en el comportamiento y las acciones individuales.' },
                { code: 'e450', name: 'Actitudes individuales de profesionales de la salud', desc: 'Opiniones y creencias generales o específicas de profesionales de la salud, sobre la persona o sobre otras cuestiones (ej. cuestiones sociales, políticas y económicas), que influyen en el comportamiento y las acciones individuales.' },
                { code: 'e580', name: 'Servicios, sistemas y políticas sanitarias', desc: 'Servicios, sistemas y políticas para prevenir y tratar problemas de salud, proporcionando rehabilitación médica y promoviendo un estilo de vida saludable.' }
            ];
            break;
        default:
            cifCodes = [];
    }
    
    return cifCodes;
}

// Añadir un elemento CIF
async function addCifItem(modal) {
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
    
    if (!patientId) {
        showToast("Error: ID de paciente no encontrado", "error");
        return;
    }
    
    try {
        showLoading();
        
        // Crear objeto CIF para guardar
        const cifItem = {
            code: code,
            name: name,
            description: description,
            value: value,
            categoryType: categoryType,
            createdAt: new Date().toISOString()
        };
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos actuales del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) {
            showToast("Error: Paciente no encontrado", "error");
            hideLoading();
            return;
        }
        
        // Obtener datos del paciente
        const patientData = patientDoc.data();
        
        // Inicializar arrays CIF si no existen
        if (!patientData.cifItems) patientData.cifItems = {};
        if (!patientData.cifItems[categoryType.toLowerCase()]) patientData.cifItems[categoryType.toLowerCase()] = [];
        
        // Añadir nuevo elemento CIF
        patientData.cifItems[categoryType.toLowerCase()].push(cifItem);
        
        // Actualizar documento del paciente
        await updateDoc(patientRef, {
            [`cifItems.${categoryType.toLowerCase()}`]: patientData.cifItems[categoryType.toLowerCase()],
            updatedAt: new Date().toISOString()
        });
        
        // Actualizar UI
        const container = document.getElementById(targetContainerId);
        if (container) {
            // Generar un ID único para este elemento
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
                        
                        // Actualizar valor en Firebase (en tiempo real)
                        updateCifItemValue(patientId, categoryType.toLowerCase(), itemId, parseInt(this.textContent));
                    }
                });
            });
            
            // Añadir al inicio para mayor visibilidad
            if (container.firstChild) {
                container.insertBefore(newItem, container.firstChild);
            } else {
                container.appendChild(newItem);
            }
        }
        
        hideLoading();
        showToast(`Elemento CIF ${categoryType} añadido correctamente`, "success");
        
        // Cerrar modal
        modal.classList.remove('active');
        setTimeout(() => {
            modal.style.display = 'none';
        }, 300);
        
    } catch (error) {
        console.error("Error al guardar elemento CIF:", error);
        hideLoading();
        showToast("Error al guardar: " + error.message, "error");
    }
}

// Función para actualizar el valor de un elemento CIF
async function updateCifItemValue(patientId, category, itemId, newValue) {
    try {
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Obtener datos actuales del paciente
        const patientDoc = await getDoc(patientRef);
        
        if (!patientDoc.exists()) return;
        
        // Obtener datos del paciente
        const patientData = patientDoc.data();
        
        // Verificar si existen los arrays CIF
        if (!patientData.cifItems || !patientData.cifItems[category]) return;
        
        // Encontrar el índice del elemento por su ID
        const itemIndex = patientData.cifItems[category].findIndex(item => 
            item.id === itemId || item.code === itemId.replace('cif-', '')
        );
        
        if (itemIndex !== -1) {
            // Actualizar el valor
            patientData.cifItems[category][itemIndex].value = newValue;
            
            // Actualizar documento del paciente
            await updateDoc(patientRef, {
                [`cifItems.${category}`]: patientData.cifItems[category],
                updatedAt: new Date().toISOString()
            });
        }
    } catch (error) {
        console.error("Error al actualizar valor CIF:", error);
    }
}

// Función para simular el guardado en Firebase
function saveCifItemToFirebase(cifItem) {
    // En una implementación real, aquí se guardarían los datos en Firebase
    console.log('Guardando elemento CIF en Firebase:', {
        id: cifItem.dataset.id,
        code: cifItem.dataset.code,
        name: cifItem.dataset.name,
        description: cifItem.dataset.description,
        value: parseInt(cifItem.dataset.value)
    });
    
    // Simulamos que se ha guardado correctamente
    return true;
}

// Función para simular la eliminación en Firebase
function deleteCifItemFromFirebase(itemId) {
    // En una implementación real, aquí se eliminaría el elemento de Firebase
    console.log('Eliminando elemento CIF de Firebase:', itemId);
    
    // Simulamos que se ha eliminado correctamente
    return true;
}

// Guardar cambios en diagnóstico
// Guardar cambios en diagnóstico
async function saveDiagnosisChanges(patientId) {
    try {
        if (!patientId) {
            showToast("Error: ID de paciente no encontrado", "error");
            return;
        }
        
        showLoading();
        
        // Obtener factores personales
        const personalFactors = document.getElementById('cifPersonalFactors')?.value || '';
        
        // Referencia al documento del paciente
        const patientRef = doc(db, "patients", patientId);
        
        // Actualizar factores personales
        await updateDoc(patientRef, {
            'personalFactors': personalFactors,
            'updatedAt': new Date().toISOString()
        });
        
        hideLoading();
        showToast("Diagnóstico guardado correctamente", "success");
        
        // Recargar datos CIF para mostrar los cambios
        await loadAllCifData(patientId);
    } catch (error) {
        console.error("Error al guardar diagnóstico:", error);
        hideLoading();
        showToast("Error al guardar: " + error.message, "error");
    }
}
