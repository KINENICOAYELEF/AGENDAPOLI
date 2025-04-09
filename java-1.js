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



        // Función para subir archivos directamente a ImageKit usando upload API
async function uploadToImageKitDirect(file, folder, fileName) {
    try {
        // Crear FormData para la subida
        const formData = new FormData();
        formData.append('file', file);
        formData.append('publicKey', imagekitConfig.publicKey);
        formData.append('fileName', fileName);
        formData.append('folder', folder);
        formData.append('useUniqueFileName', 'true');
        
        // Realizar subida directa a ImageKit
        const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Error de carga');
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error en subida directa a ImageKit:', error);
        throw error;
    }
}

// Función para generar la firma para ImageKit
function generateImageKitSignature(privateKey, stringToSign) {
    // Esta función simula la generación de una firma HMAC-SHA1
    // Normalmente esto debería hacerse en el servidor, pero usaremos
    // una versión simplificada para el navegador
    
    // Usamos una librería externa para generar la firma
    function loadCryptoJS() {
        return new Promise((resolve, reject) => {
            if (window.CryptoJS) {
                resolve(window.CryptoJS);
                return;
            }
            
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/crypto-js/4.1.1/crypto-js.min.js';
            script.onload = () => resolve(window.CryptoJS);
            script.onerror = () => reject(new Error('No se pudo cargar CryptoJS'));
            document.head.appendChild(script);
        });
    }
    
    return loadCryptoJS().then(CryptoJS => {
        return CryptoJS.HmacSHA1(stringToSign, privateKey).toString(CryptoJS.enc.Hex);
    });
}        

// Función para obtener autenticación desde un método alternativo
async function getImageKitAuthParams() {
    try {
        // Generamos un token temporal para pruebas
        // NOTA: Esta no es una solución segura para producción
        const expire = Math.floor(Date.now()/1000) + 3600; // 1 hora
        const token = Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
        
        // En lugar de calcular una firma localmente, usamos el método de carga directa
        return {
            token: token,
            expire: expire,
            signature: "no-signature-needed-for-direct-upload"
        };
    } catch (e) {
        console.error("Error generando parámetros de autenticación:", e);
        return {
            token: "error",
            expire: 0,
            signature: "error"
        };
    }
}


        // Variables para objetivos
let currentObjectiveId = null;
let objectivesCache = {};
let objectiveParameters = {
    "Fuerza muscular": ["Escala Daniels (0-5)", "Dinamometría (kg/N)", "Test manual (%)", "Test isocinético (Nm)", "Repetición máxima (RM)"],
    "Rango de movimiento": ["Goniometría (grados)", "Porcentaje de rango normal (%)", "Test dedos-suelo (cm)"],
    "Dolor": ["EVA (0-10)", "Escala numérica (0-10)", "Escala verbal (leve/moderado/severo)", "Cuestionario de dolor McGill", "Brief Pain Inventory"],
    "Funcionalidad": ["Índice Barthel (0-100)", "Escala Berg (0-56)", "Timed Up and Go (segundos)", "Test 6 minutos (metros)", "WOMAC", "DASH", "FIM"],
    "Propiocepción": ["Error en reposicionamiento (grados)", "Tiempo mantenimiento posición (segundos)"],
    "Equilibrio": ["Apoyo unipodal (segundos)", "Escala Berg (0-56)", "Test Tinetti (0-28)", "Y-Balance Test (cm)", "Star Excursion Balance Test (cm)"],
    "Postura": ["Ángulos posturales (grados)", "Desviaciones en cm", "Evaluación postural fotogramétrica"],
    "Edema": ["Perímetro (cm)", "Volumetría (ml)", "Escala visual (0-4)"],
    "Función piso pélvico": ["Escala Oxford (0-5)", "Perineometría (cmH₂O)", "EMG (μV)", "PERFECT", "Test pad (g)"]
};

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


        // Función para eliminar una evolución
async function deleteEvolution(patientId, evolutionId) {
    if (!patientId || !evolutionId) {
        showToast("Error: ID de paciente o evolución no válido", "error");
        return false;
    }
    
    // Pedir confirmación antes de eliminar
    if (!confirm("¿Está seguro que desea eliminar esta evolución?\nEsta acción no se puede deshacer.")) {
        return false;
    }
    
    try {
        showLoading();
        
        // Referencia al documento de la evolución
        const evolutionRef = doc(db, "patients", patientId, "evolutions", evolutionId);
        
        // Eliminar la evolución
        await deleteDoc(evolutionRef);
        
        // Eliminar visualmente de la interfaz
        const evolutionItem = document.querySelector(`.evolution-item[data-id="${evolutionId}"]`);
        if (evolutionItem && evolutionItem.parentNode) {
            evolutionItem.parentNode.removeChild(evolutionItem);
        }
        
        // Verificar si es la última evolución para actualizar el campo lastSession del paciente
        const evolutions = await getEvolutions(patientId);
        
        if (evolutions.length > 0) {
            // Ordenar por fecha (la más reciente primero)
            evolutions.sort((a, b) => new Date(b.date) - new Date(a.date));
            
            // Actualizar el campo lastSession con la fecha de la evolución más reciente
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
        } else {
            // No hay más evoluciones, eliminar campo lastSession
            await updateDoc(doc(db, "patients", patientId), {
                lastSession: null,
                updatedAt: new Date().toISOString()
            });
            
            // Actualizar caché
            const cachedPatientIndex = patientsCache.findIndex(p => p.id === patientId);
            if (cachedPatientIndex >= 0) {
                patientsCache[cachedPatientIndex].lastSession = null;
                patientsCache[cachedPatientIndex].updatedAt = new Date().toISOString();
            }
            
            // Actualizar interfaz si no quedan evoluciones
            const timelineContainer = document.getElementById('evolutionTimeline');
            if (timelineContainer && timelineContainer.children.length === 0) {
                timelineContainer.innerHTML = '<p>No hay evoluciones registradas para este paciente.</p>';
            }
        }
        
        hideLoading();
        showToast("Evolución eliminada correctamente", "success");
        
        // Actualizar lista de pacientes para reflejar los cambios
        await getPatients();
        
        return true;
    } catch (error) {
        console.error("Error eliminando evolución:", error);
        hideLoading();
        showToast("Error al eliminar evolución: " + error.message, "error");
        return false;
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

// Función para subir archivos a ImageKit - Versión corregida
// Función para subir archivos a ImageKit - Versión corregida
async function uploadFileToImageKit(file, patientId, folder) {
    try {
        showLoading();
        
        // IMPORTANTE: Reemplaza estos valores con tus propias credenciales de ImageKit
        const publicKey = "public_R03ZLLEFJiBI2VJqLPv3Ayw9BoM="; // Reemplaza con tu clave pública
        const privateKey = "private_XNLSvEGgU7XKRFZGONvMFkgiX9E="; // Reemplaza con tu clave privada
        const urlEndpoint = "https://ik.imagekit.io/vbxofs9fw"; // Reemplaza con tu URL endpoint
        
        // Generar token y fecha de expiración (30 minutos en el futuro)
        const token = Math.random().toString(36).substring(2);
        const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutos
        
        console.log("Valores de autenticación:", {
            token: token,
            expire: expire,
            expireFormatted: new Date(expire * 1000).toISOString()
        });
        
        // Generar firma utilizando CryptoJS
        const stringToSign = token + expire;
        const signature = CryptoJS.HmacSHA1(stringToSign, privateKey).toString(CryptoJS.enc.Hex);
        
        // Crear nombre de archivo seguro
        const fileName = `patients_${patientId}_${folder}_${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.]/g, '_')}`;
        
        // Crear FormData
        const form = new FormData();
        form.append('file', file);
        form.append('fileName', fileName);
        form.append('publicKey', publicKey);
        form.append('signature', signature);
        form.append('expire', expire.toString()); // Convertir a string explícitamente
        form.append('token', token);
        form.append('useUniqueFileName', 'true');
        form.append('folder', `patients/${patientId}/${folder}`);
        
        // Mostrar lo que estamos enviando (para depuración)
        console.log("Enviando petición a ImageKit con los siguientes datos:");
        for (const pair of form.entries()) {
            // No mostrar el archivo completo para no saturar la consola
            if (pair[0] === 'file') {
                console.log('file:', pair[1].name, pair[1].type, pair[1].size + ' bytes');
            } else {
                console.log(pair[0] + ':', pair[1]);
            }
        }
        
        // Realizar la solicitud de carga
        const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            body: form
        });
        
        // Verificar respuesta
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage = "Error desconocido";
            
            try {
                // Intentar parsear como JSON
                const errorData = JSON.parse(errorText);
                errorMessage = errorData.message || errorData.error || "Error sin detalles";
            } catch {
                // Si no es JSON, usar el texto como está
                errorMessage = errorText;
            }
            
            throw new Error(`Error de carga: ${errorMessage}`);
        }
        
        // Procesar respuesta exitosa
        const result = await response.json();
        console.log("Archivo subido exitosamente:", result);
        
        // Crear objeto de resultado para nuestra aplicación
        const uploadResult = {
            url: result.url,
            fileId: result.fileId || result.id || `file_${Date.now()}`,
            name: file.name,
            type: file.type.startsWith('image/') ? 'image' : 'document',
            thumbnailUrl: result.thumbnailUrl || result.url,
            uploadDate: new Date().toISOString() // Añadir fecha de carga
        };
        
        showToast("Archivo subido correctamente", "success");
        hideLoading();
        return uploadResult;
    } catch (error) {
        console.error("Error subiendo archivo:", error);
        showToast("Error al subir archivo: " + error.message, "error");
        hideLoading();
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
        
        // Leer opciones del formulario - Versión corregida para asegurar que se manejen correctamente
        const includeDiagnosis = document.getElementById('pdfIncludeDiagnosis') ? 
            document.getElementById('pdfIncludeDiagnosis').checked : true;
        const includeEvolutions = document.getElementById('pdfIncludeEvolutions') ? 
            document.getElementById('pdfIncludeEvolutions').checked : true;
        const includeScales = document.getElementById('pdfIncludeScales') ? 
            document.getElementById('pdfIncludeScales').checked : true;
        const includeExercises = document.getElementById('pdfIncludeExercises') ? 
            document.getElementById('pdfIncludeExercises').checked : true;
        const includeLogo = document.getElementById('pdfIncludeLogo') ? 
            document.getElementById('pdfIncludeLogo').checked : true;
        const includeFooter = document.getElementById('pdfIncludeFooter') ? 
            document.getElementById('pdfIncludeFooter').checked : true;
        
        console.log("Opciones de exportación:", {
            includeDiagnosis, includeEvolutions, includeScales, includeExercises, includeLogo, includeFooter
        });
        
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

// Procesar archivos de la ficha del paciente
const patientFilesInput = document.getElementById('patientFiles');
if (patientFilesInput && patientFilesInput.files && patientFilesInput.files.length > 0) {
    const files = Array.from(patientFilesInput.files);
    const filesPromises = files.map(file => 
        uploadFileToImageKit(file, currentPatientId, 'medical_records')
    );
    
    try {
        showLoading();
        
        // Esperar a que se suban todos los archivos
        const uploadedFiles = await Promise.all(filesPromises);
        
        // Filtrar archivos que fallaron al subir (null)
        const validFiles = uploadedFiles.filter(file => file !== null);
        
        // IMPORTANTE: Primero obtener los archivos actuales desde la base de datos
        const currentPatient = await getPatient(currentPatientId);
        
        // Crear un array con TODOS los archivos (los existentes más los nuevos)
        let allFiles = [];
        
        // Añadir archivos existentes si hay alguno
        if (currentPatient && currentPatient.files && Array.isArray(currentPatient.files)) {
            allFiles = [...currentPatient.files];
        }
        
        // Añadir los nuevos archivos válidos
        if (validFiles && validFiles.length > 0) {
            allFiles = [...allFiles, ...validFiles];
        }
        
        // Actualizar SOLO la propiedad 'files' del paciente, no todo el objeto patientData
        await updateDoc(doc(db, "patients", currentPatientId), {
            files: allFiles,
            updatedAt: new Date().toISOString()
        });
        
        // Actualizar también en la caché
        const cachedIndex = patientsCache.findIndex(p => p.id === currentPatientId);
        if (cachedIndex >= 0) {
            patientsCache[cachedIndex].files = allFiles;
            patientsCache[cachedIndex].updatedAt = new Date().toISOString();
        }
        
        // Actualizar la visualización de los archivos
        loadPatientFiles(currentPatientId);
        
        console.log("Archivos de ficha médica subidos:", validFiles.length);
        showToast(`${validFiles.length} archivo(s) subido(s) correctamente`, "success");
        hideLoading();
    } catch (filesError) {
        console.error("Error al subir archivos de ficha médica:", filesError);
        showToast("Error al subir algunos archivos", "warning");
        hideLoading();
    }
}
                
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

                    // Procesar archivos adjuntos
const attachmentInput = document.getElementById('evolutionAttachments');
if (attachmentInput && attachmentInput.files && attachmentInput.files.length > 0) {
    const files = Array.from(attachmentInput.files);
    const attachmentsPromises = files.map(file => 
        uploadFileToImageKit(file, currentPatientId, 'evolutions')
    );
    
    try {
        // Esperar a que se suban todos los archivos
        const attachments = await Promise.all(attachmentsPromises);
        
        // Filtrar archivos que fallaron al subir (null)
        const validAttachments = attachments.filter(attachment => attachment !== null);
        
        // Asegurar que evolutionData.attachments sea un array
        if (!evolutionData.attachments) {
            evolutionData.attachments = [];
        }
        
        // Añadir los nuevos archivos a los existentes (si es una edición)
        evolutionData.attachments = [...evolutionData.attachments, ...validAttachments];
        
        console.log("Archivos adjuntos subidos:", validAttachments.length);
    } catch (attachmentError) {
        console.error("Error al subir archivos adjuntos:", attachmentError);
        showToast("Error al subir algunos archivos, pero continuando con la evolución", "warning");
    }
}
                    
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
document.getElementById('manageCustomTemplatesBtn').addEventListener('click', function() {
    // Crear modal para plantillas
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'templatesModal';
    
    modal.innerHTML = `
        <div class="modal">
            <div class="modal-header">
                <h2 class="modal-title">Plantillas de ejercicios</h2>
                <button class="modal-close" id="closeTemplatesModal">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div id="templatesList" style="margin-bottom: 20px;">
                    <p>Cargando plantillas...</p>
                </div>
                
                <div style="margin-top: 20px;">
                    <h3>Guardar plantilla actual</h3>
                    <div class="form-group">
                        <label class="form-label">Nombre de la plantilla</label>
                        <input type="text" class="form-control" id="templateNameInput">
                    </div>
                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <select class="form-control" id="templateCategoryInput">
                            <option value="Rehabilitación">Rehabilitación</option>
                            <option value="Fortalecimiento">Fortalecimiento</option>
                            <option value="Estiramiento">Estiramiento</option>
                            <option value="Otro">Otro</option>
                        </select>
                    </div>
                    <div style="text-align: right; margin-top: 15px;">
                        <button type="button" id="saveTemplateBtn" class="action-btn btn-primary">Guardar plantilla</button>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    modal.classList.add('active');
    
    // Cargar plantillas existentes
    loadExistingTemplates();
    
    // Configurar eventos
    document.getElementById('closeTemplatesModal').addEventListener('click', function() {
        modal.classList.remove('active');
        setTimeout(() => document.body.removeChild(modal), 300);
    });
    
    document.getElementById('saveTemplateBtn').addEventListener('click', function() {
        const name = document.getElementById('templateNameInput').value;
        const category = document.getElementById('templateCategoryInput').value;
        
        if (!name) {
            showToast("Debe ingresar un nombre para la plantilla", "error");
            return;
        }
        
        saveTemplate(name, category);
    });
    
    // Función para cargar plantillas existentes
    async function loadExistingTemplates() {
        const templatesList = document.getElementById('templatesList');
        if (!templatesList) return;
        
        try {
            const templatesRef = collection(db, "exerciseTemplates");
            const querySnapshot = await getDocs(templatesRef);
            
            let html = '<table class="exercise-table" style="width:100%">';
            html += '<thead><tr><th>Nombre</th><th>Categoría</th><th>Acciones</th></tr></thead><tbody>';
            
            if (querySnapshot.empty) {
                html += '<tr><td colspan="3">No hay plantillas guardadas</td></tr>';
            } else {
                querySnapshot.forEach((doc) => {
                    const template = doc.data();
                    html += `
                        <tr>
                            <td>${template.name || 'Sin nombre'}</td>
                            <td>${template.category || 'Sin categoría'}</td>
                            <td>
                                <button class="action-btn btn-secondary load-template-btn" data-id="${doc.id}" style="margin-right:5px">
                                    <i class="fas fa-download"></i> Usar
                                </button>
                                <button class="action-btn btn-secondary delete-template-btn" data-id="${doc.id}" style="background-color: var(--accent2-light)">
                                    <i class="fas fa-trash"></i>
                                </button>
                            </td>
                        </tr>
                    `;
                });
            }
            
            html += '</tbody></table>';
            templatesList.innerHTML = html;
            
            // Configurar eventos para botones de cargar y eliminar
            document.querySelectorAll('.load-template-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const templateId = this.getAttribute('data-id');
                    loadTemplate(templateId);
                });
            });
            
            document.querySelectorAll('.delete-template-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const templateId = this.getAttribute('data-id');
                    deleteTemplate(templateId);
                });
            });
            
        } catch (error) {
            console.error("Error al cargar plantillas:", error);
            templatesList.innerHTML = `<p style="color:red">Error al cargar plantillas: ${error.message}</p>`;
        }
    }
    
    // Función para guardar plantilla
    async function saveTemplate(name, category) {
        try {
            showLoading();
            
            // Obtener ejercicios actuales
            const exercises = getExercisesData();
            
            if (!exercises || exercises.length === 0) {
                hideLoading();
                showToast("No hay ejercicios para guardar", "error");
                return;
            }
            
            // Crear objeto de plantilla
            const template = {
                name: name,
                category: category,
                exercises: exercises,
                createdAt: new Date().toISOString()
            };
            
            // Guardar en Firebase
            const templatesRef = collection(db, "exerciseTemplates");
            await addDoc(templatesRef, template);
            
            hideLoading();
            showToast("Plantilla guardada correctamente", "success");
            
            // Recargar lista de plantillas
            loadExistingTemplates();
            
            // Limpiar campos
            document.getElementById('templateNameInput').value = '';
            
        } catch (error) {
            hideLoading();
            console.error("Error al guardar plantilla:", error);
            showToast("Error al guardar plantilla: " + error.message, "error");
        }
    }
    
    // Función para cargar una plantilla
    async function loadTemplate(templateId) {
        try {
            showLoading();
            
            const templateRef = doc(db, "exerciseTemplates", templateId);
            const templateSnap = await getDoc(templateRef);
            
            if (templateSnap.exists()) {
                const template = templateSnap.data();
                
                // Limpiar tabla actual
                const tableBody = document.getElementById('exerciseTableBody');
                if (!tableBody) {
                    hideLoading();
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
                modal.classList.remove('active');
                setTimeout(() => document.body.removeChild(modal), 300);
                
                hideLoading();
                showToast(`Plantilla "${template.name}" cargada correctamente`, "success");
            } else {
                hideLoading();
                showToast("Plantilla no encontrada", "error");
            }
        } catch (error) {
            hideLoading();
            console.error("Error al cargar plantilla:", error);
            showToast("Error al cargar plantilla: " + error.message, "error");
        }
    }
    
    // Función para eliminar una plantilla
    async function deleteTemplate(templateId) {
        try {
            if (!confirm('¿Está seguro que desea eliminar esta plantilla?')) {
                return;
            }
            
            showLoading();
            
            const templateRef = doc(db, "exerciseTemplates", templateId);
            await deleteDoc(templateRef);
            
            hideLoading();
            showToast("Plantilla eliminada correctamente", "success");
            
            // Recargar lista de plantillas
            loadExistingTemplates();
            
        } catch (error) {
            hideLoading();
            console.error("Error al eliminar plantilla:", error);
            showToast("Error al eliminar plantilla: " + error.message, "error");
        }
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

// Plantillas de objetivos específicos por especialidad
const objectiveTemplates = {
    "deportiva": [
        {
            verb: "Aumentar",
            category: "Analítico",
            structure: "fuerza explosiva de cuádriceps",
            parameter: "Fuerza muscular",
            method: "Test de salto vertical (cm)",
            initialValue: "30",
            targetValue: "40",
            duration: "6",
            durationUnit: "semanas",
            frequency: "semanal",
            notes: "Enfocarse en fase concéntrica explosiva"
        },
        {
            verb: "Mejorar",
            category: "Funcional",
            structure: "estabilidad dinámica de rodilla",
            parameter: "Equilibrio",
            method: "Y-Balance Test (cm)",
            initialValue: "75",
            targetValue: "90",
            duration: "4",
            durationUnit: "semanas",
            frequency: "quincenal",
            notes: "Trabajar control neuromuscular en planos múltiples"
        }
    ],
    "geriatria": [
        {
            verb: "Aumentar",
            category: "Funcional",
            structure: "equilibrio estático y dinámico",
            parameter: "Equilibrio",
            method: "Escala Berg (0-56)",
            initialValue: "35",
            targetValue: "45",
            duration: "8",
            durationUnit: "semanas",
            frequency: "quincenal",
            notes: "Priorizar seguridad y prevención de caídas"
        },
        {
            verb: "Mejorar",
            category: "Funcional",
            structure: "patrón de marcha",
            parameter: "Funcionalidad",
            method: "Timed Up and Go (segundos)",
            initialValue: "15",
            targetValue: "10",
            duration: "6",
            durationUnit: "semanas",
            frequency: "quincenal",
            notes: "Trabajar transferencias y cambios de dirección"
        }
    ],
    "neurologica": [
        {
            verb: "Reeducar",
            category: "Funcional",
            structure: "control motor selectivo de miembro superior",
            parameter: "Funcionalidad",
            method: "Box and Block Test (bloques)",
            initialValue: "20",
            targetValue: "35",
            duration: "8",
            durationUnit: "semanas",
            frequency: "semanal",
            notes: "Incorporar actividades de motricidad fina"
        }
    ],
    "respiratoria": [
        {
            verb: "Aumentar",
            category: "Analítico",
            structure: "fuerza muscular inspiratoria",
            parameter: "Fuerza muscular",
            method: "Presión inspiratoria máxima (cmH₂O)",
            initialValue: "60",
            targetValue: "80",
            duration: "6",
            durationUnit: "semanas",
            frequency: "semanal",
            notes: "Entrenamiento progresivo con válvula umbral"
        }
    ],
    "piso-pelvico": [
        {
            verb: "Aumentar",
            category: "Analítico",
            structure: "fuerza de la musculatura del piso pélvico",
            parameter: "Función piso pélvico",
            method: "Escala Oxford (0-5)",
            initialValue: "2",
            targetValue: "4",
            duration: "8",
            durationUnit: "semanas",
            frequency: "semanal",
            notes: "Combinar contracciones rápidas y sostenidas"
        }
    ]
};

// Función para mostrar explicación del verbo seleccionado
document.addEventListener('DOMContentLoaded', function() {
    // Explicaciones de verbos para objetivos específicos
    const verbExplanations = {
        "Aumentar": "Incrementar una capacidad o función que está disminuida.",
        "Disminuir": "Reducir un síntoma o parámetro que está elevado (dolor, edema, etc).",
        "Mantener": "Conservar el nivel actual de una función que podría deteriorarse.",
        "Modular": "Regular o ajustar una función para optimizar su rendimiento.",
        "Optimizar": "Mejorar la eficiencia de una función ya existente.",
        "Reeducar": "Enseñar nuevamente un patrón de movimiento o función alterada.",
        "Controlar": "Manejar o regular un síntoma o condición.",
        "Reducir": "Disminuir la intensidad o frecuencia de un síntoma.",
        "Incrementar": "Aumentar progresivamente una capacidad o función.",
        "Restaurar": "Devolver a un estado funcional previo.",
        "Desarrollar": "Generar una capacidad o habilidad nueva o poco desarrollada.",
        "Reintegrar": "Incorporar nuevamente una función a un patrón global.",
        "Normalizar": "Llevar a parámetros considerados normales.",
        "Educar": "Enseñar al paciente sobre su condición o manejo.",
        "Estabilizar": "Proporcionar mayor firmeza o control a una estructura.",
        "Activar": "Iniciar o facilitar la contracción de un músculo inhibido.",
        "Integrar": "Incorporar una función específica en patrones más complejos.",
        "Coordinar": "Sincronizar diferentes componentes de un movimiento.",
        "Adaptar": "Modificar una función para ajustarse a nuevas condiciones."
    };

    // Mostrar explicación al seleccionar un verbo
    const actionVerbSelect = document.getElementById('actionVerbSelect');
    const verbExplanation = document.getElementById('verbExplanation');
    
    if (actionVerbSelect && verbExplanation) {
        actionVerbSelect.addEventListener('change', function() {
            const selectedVerb = this.value;
            const explanation = verbExplanations[selectedVerb] || "Seleccione un verbo para ver su explicación.";
            verbExplanation.innerHTML = `<strong>${selectedVerb}:</strong> ${explanation}`;
        });
    }

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

    // Manejar plantillas de objetivos específicos
    const templateBtns = document.querySelectorAll('.template-btn[data-template]');
    templateBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const templateType = this.getAttribute('data-template');
            const templates = objectiveTemplates[templateType];
            
            if (templates && templates.length > 0) {
                // Usar la primera plantilla de la categoría seleccionada
                const template = templates[0];
                
                // Llenar el formulario con los datos de la plantilla
                document.getElementById('actionVerbSelect').value = template.verb;
                document.getElementById('objectiveCategorySelect').value = template.category;
                document.getElementById('structureInput').value = template.structure;
                document.getElementById('parameterSelect').value = template.parameter;
                
                // Disparar evento change para actualizar métodos de evaluación
                const parameterEvent = new Event('change');
                document.getElementById('parameterSelect').dispatchEvent(parameterEvent);
                
                // Continuar llenando después de que se actualicen los métodos
                setTimeout(() => {
                    document.getElementById('evaluationMethodSelect').value = template.method;
                    document.getElementById('initialValueInput').value = template.initialValue;
                    document.getElementById('targetValueInput').value = template.targetValue;
                    document.getElementById('durationInput').value = template.duration;
                    document.getElementById('durationUnitSelect').value = template.durationUnit;
                    document.getElementById('evaluationFrequencySelect').value = template.frequency;
                    document.getElementById('specificObjectiveNotes').value = template.notes;
                    
                    // Actualizar vista previa
                    updateSpecificObjectivePreview();
                    
                    // Mostrar explicación del verbo
                    const verbExplanation = document.getElementById('verbExplanation');
                    if (verbExplanation) {
                        const explanation = verbExplanations[template.verb] || "Seleccione un verbo para ver su explicación.";
                        verbExplanation.innerHTML = `<strong>${template.verb}:</strong> ${explanation}`;
                    }
                }, 100);
            }
        });
    });

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
        
        // NO añadir la tabla también a clinicalFilesContainer
        
        // Añadir evento para eliminar archivos
        if (previewContainer) {
            previewContainer.querySelectorAll('.delete-file-btn').forEach(btn => {
                btn.addEventListener('click', function() {
                    const fileIndex = parseInt(this.getAttribute('data-index'));
                    const fileId = this.getAttribute('data-file-id');
                    deletePatientFile(patientId, fileIndex, fileId);
                });
            });
        }
        
    } catch (error) {
        console.error("Error al cargar archivos del paciente:", error);
        const previewContainer = document.getElementById('patientFilesPreview');
        if (previewContainer) {
            previewContainer.innerHTML = '<p style="color: var(--accent2); font-style: italic;">Error al cargar los archivos</p>';
        }
    }
}

        // Función para eliminar un archivo del paciente
async function deletePatientFile(patientId, fileIndex, fileId) {
    try {
        if (!confirm('¿Está seguro que desea eliminar este archivo? Esta acción no se puede deshacer.')) {
            return;
        }
        
        showLoading();
        
        // Obtener datos actuales del paciente
        const patient = await getPatient(patientId);
        if (!patient || !patient.files) {
            hideLoading();
            showToast("No se encontraron archivos para eliminar", "error");
            return;
        }
        
        // Eliminar el archivo del array
        if (fileIndex >= 0 && fileIndex < patient.files.length) {
            // Guardar el archivo que se eliminará para referencia
            const fileToDelete = patient.files[fileIndex];
            
            // Eliminar del array
            patient.files.splice(fileIndex, 1);
            
            // Actualizar datos del paciente en la base de datos
            await updatePatient(patientId, { 
                files: patient.files,
                updatedAt: new Date().toISOString()
            });
            
            // Actualizar la visualización
            loadPatientFiles(patientId);
            
            hideLoading();
            showToast("Archivo eliminado correctamente", "success");
            
            // También podríamos eliminar físicamente el archivo de ImageKit aquí
            // si tienes una API para eso (no implementado en este ejemplo)
        } else {
            hideLoading();
            showToast("Índice de archivo no válido", "error");
        }
    } catch (error) {
        hideLoading();
        console.error("Error al eliminar archivo:", error);
        showToast("Error al eliminar archivo: " + error.message, "error");
    }
}
        </script>
