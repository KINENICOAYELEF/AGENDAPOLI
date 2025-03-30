// data-services.js
// Servicios para acceso a datos de Firebase

import { db, storage } from './firebase-config.js';

// Variables globales compartidas
let patientsCache = []; // Para almacenar pacientes y reducir consultas
export let currentPatientId = null;

// Get patients from Firebase
export async function getPatients() {
    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        
        window.showLoading();
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
        
        window.hideLoading();
        return patientList;
    } catch (error) {
        console.error("Error obteniendo pacientes: ", error);
        window.showToast("Error al cargar pacientes: " + error.message, "error");
        window.hideLoading();
        return [];
    }
}

// Add new patient to Firebase
export async function addPatient(patientData) {
    try {
        const { collection, addDoc } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        
        window.showLoading();
        
        // Validar datos mínimos requeridos
        if (!patientData.name || !patientData.rut) {
            window.hideLoading();
            window.showToast("Nombre y RUT son campos obligatorios", "error");
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
        
        window.hideLoading();
        window.showToast("Paciente registrado correctamente", "success");
        
        // Recargar pacientes
        await getPatients();
        
        return docRef.id;
    } catch (error) {
        console.error("Error al registrar paciente:", error);
        window.hideLoading();
        window.showToast(`Error al registrar: ${error.message}`, "error");
        return null;
    }
}

// Get patient by ID
export async function getPatient(patientId) {
    try {
        const { doc, getDoc } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        
        window.showLoading();
        
        // Primero buscar en la caché de pacientes
        const cachedPatient = patientsCache.find(p => p.id === patientId);
        if (cachedPatient) {
            window.hideLoading();
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
            
            window.hideLoading();
            return patient;
        } else {
            window.hideLoading();
            window.showToast("Paciente no encontrado", "error");
            return null;
        }
    } catch (error) {
        console.error("Error obteniendo paciente: ", error);
        window.hideLoading();
        window.showToast("Error al cargar datos del paciente: " + error.message, "error");
        return null;
    }
}

// Update patient
export async function updatePatient(patientId, patientData) {
    try {
        const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        
        window.showLoading();
        
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
        
        window.hideLoading();
        window.showToast("Paciente actualizado correctamente", "success");
        return true;
    } catch (error) {
        console.error("Error actualizando paciente: ", error);
        window.hideLoading();
        window.showToast("Error al actualizar paciente: " + error.message, "error");
        return false;
    }
}

// Add evolution to patient
export async function addEvolution(patientId, evolutionData) {
    try {
        const { collection, addDoc, doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        
        window.showLoading();
        
        // Añadir timestamp de creación
        evolutionData.createdAt = new Date().toISOString();
        
        const evolutionsRef = collection(db, "patients", patientId, "evolutions");
        const docRef = await addDoc(evolutionsRef, evolutionData);
        
        // Actualizar lastSession del paciente
        const formattedDate = window.formatDate(new Date(evolutionData.date));
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
        
        window.hideLoading();
        window.showToast("Evolución registrada correctamente", "success");
        return docRef.id;
    } catch (error) {
        console.error("Error añadiendo evolución: ", error);
        window.hideLoading();
        window.showToast("Error al registrar evolución: " + error.message, "error");
        return null;
    }
}

// Hacer disponibles globalmente las funciones
window.getPatients = getPatients;
window.addPatient = addPatient;
window.getPatient = getPatient;
window.updatePatient = updatePatient;
window.addEvolution = addEvolution;
window.currentPatientId = currentPatientId;
