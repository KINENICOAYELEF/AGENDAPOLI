// data-services.js
// Servicios para acceso a datos de Firebase

import { db, storage } from './firebase-config.js';
import { showToast, hideLoading, showLoading, formatDate } from './utils.js';

// Pre-cargar módulos Firebase que usaremos frecuentemente
let firebaseCollection, firebaseDoc, firebaseAddDoc, firebaseGetDoc, 
    firebaseUpdateDoc, firebaseGetDocs, firebaseQuery, firebaseOrderBy, 
    firebaseServerTimestamp, firebaseDeleteDoc, firebaseRef, 
    firebaseUploadBytes, firebaseGetDownloadURL;

// Cargar los módulos Firebase al inicio
async function loadFirebaseModules() {
    try {
        const firestoreModule = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        firebaseCollection = firestoreModule.collection;
        firebaseDoc = firestoreModule.doc;
        firebaseAddDoc = firestoreModule.addDoc;
        firebaseGetDoc = firestoreModule.getDoc;
        firebaseUpdateDoc = firestoreModule.updateDoc;
        firebaseGetDocs = firestoreModule.getDocs;
        firebaseQuery = firestoreModule.query;
        firebaseOrderBy = firestoreModule.orderBy;
        firebaseServerTimestamp = firestoreModule.serverTimestamp;
        firebaseDeleteDoc = firestoreModule.deleteDoc;
        
        const storageModule = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js");
        firebaseRef = storageModule.ref;
        firebaseUploadBytes = storageModule.uploadBytes;
        firebaseGetDownloadURL = storageModule.getDownloadURL;
        
        return true;
    } catch (error) {
        console.error("Error cargando módulos Firebase:", error);
        return false;
    }
}

// Iniciar carga inmediatamente
loadFirebaseModules();

// Variables globales compartidas
let patientsCache = []; // Para almacenar pacientes y reducir consultas
export let currentPatientId = null;

// Función auxiliar para asegurar que los módulos estén cargados
async function ensureModulesLoaded() {
    if (!firebaseCollection) {
        await loadFirebaseModules();
    }
}

// Get patients from Firebase
export async function getPatients() {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        const patientsCollection = firebaseCollection(db, "patients");
        const patientSnapshot = await firebaseGetDocs(patientsCollection);
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
export async function addPatient(patientData) {
    try {
        await ensureModulesLoaded();
        
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
        const patientsRef = firebaseCollection(db, "patients");
        const docRef = await firebaseAddDoc(patientsRef, patientDoc);
        
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
export async function getPatient(patientId) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        // Primero buscar en la caché de pacientes
        const cachedPatient = patientsCache.find(p => p.id === patientId);
        if (cachedPatient) {
            hideLoading();
            return cachedPatient;
        }
        
        // Si no está en caché, buscarlo en Firebase
        const patientRef = firebaseDoc(db, "patients", patientId);
        const patientSnap = await firebaseGetDoc(patientRef);
        
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
export async function updatePatient(patientId, patientData) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        // Añadir timestamp de actualización
        patientData.updatedAt = new Date().toISOString();
        
        const patientRef = firebaseDoc(db, "patients", patientId);
        await firebaseUpdateDoc(patientRef, patientData);
        
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

// Add evolution to patient
export async function addEvolution(patientId, evolutionData) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        // Añadir timestamp de creación
        evolutionData.createdAt = new Date().toISOString();
        
        const evolutionsRef = firebaseCollection(db, "patients", patientId, "evolutions");
        const docRef = await firebaseAddDoc(evolutionsRef, evolutionData);
        
        // Actualizar lastSession del paciente
        const formattedDate = formatDate(new Date(evolutionData.date));
        await firebaseUpdateDoc(firebaseDoc(db, "patients", patientId), {
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
export async function getEvolutions(patientId) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        const evolutionsRef = firebaseCollection(db, "patients", patientId, "evolutions");
        const evolutionsQuery = firebaseQuery(evolutionsRef, firebaseOrderBy("date", "desc"));
        const evolutionsSnapshot = await firebaseGetDocs(evolutionsQuery);
        
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
export async function getEvolutionsCount(patientId) {
    try {
        await ensureModulesLoaded();
        
        const evolutionsRef = firebaseCollection(db, "patients", patientId, "evolutions");
        const evolutionsSnapshot = await firebaseGetDocs(evolutionsRef);
        return evolutionsSnapshot.size;
    } catch (error) {
        console.error("Error obteniendo conteo de evoluciones: ", error);
        return 0;
    }
}

// Upload file to Firebase Storage
export async function uploadFile(file, patientId, folder) {
    try {
        await ensureModulesLoaded();
        
        const fileRef = firebaseRef(storage, `patients/${patientId}/${folder}/${file.name}`);
        await firebaseUploadBytes(fileRef, file);
        const downloadURL = await firebaseGetDownloadURL(fileRef);
        return downloadURL;
    } catch (error) {
        console.error("Error subiendo archivo: ", error);
        showToast("Error al subir archivo: " + error.message, "error");
        return null;
    }
}

// Obtener diagnósticos del paciente
export async function getDiagnoses(patientId) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        // Obtener diagnósticos de Firebase
        const diagnosesRef = firebaseCollection(db, "patients", patientId, "diagnoses");
        const diagnosesQuery = firebaseQuery(diagnosesRef, firebaseOrderBy("createdAt", "desc"));
        const diagnosesSnapshot = await firebaseGetDocs(diagnosesQuery);
        
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

// Guardar una plantilla en Firebase
export async function saveTemplateToFirebase(template) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        // Asegurarse de que template tenga una ID única
        if (!template.id) {
            template.id = 'template_' + Date.now();
        }
        
        // Guardar en Firestore
        const templatesRef = firebaseCollection(db, "exerciseTemplates");
        await firebaseAddDoc(templatesRef, {
            ...template,
            createdAt: firebaseServerTimestamp(),
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

// Obtener todas las plantillas de Firebase
export async function getTemplatesFromFirebase() {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        const templatesRef = firebaseCollection(db, "exerciseTemplates");
        const querySnapshot = await firebaseGetDocs(templatesRef);
        
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

// Eliminar una plantilla de Firebase
export async function deleteTemplateFromFirebase(templateId) {
    try {
        await ensureModulesLoaded();
        
        showLoading();
        
        await firebaseDeleteDoc(firebaseDoc(db, "exerciseTemplates", templateId));
        
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

// Obtener la caché de pacientes (útil para otras partes de la aplicación)
export function getPatientsCache() {
    return patientsCache;
}

// Establecer el ID del paciente actual
export function setCurrentPatientId(patientId) {
    currentPatientId = patientId;
    // Disparar un evento personalizado para notificar del cambio
    document.dispatchEvent(new CustomEvent('currentPatientChanged', { detail: patientId }));
}
