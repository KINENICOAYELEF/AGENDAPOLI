// firebase-config.js
// Configuración e inicialización de Firebase

// Configuración de Firebase
export const firebaseConfig = {
    apiKey: "AIzaSyDD1kjbOr566240HrDtWi5egah47kGZLvQ",
    authDomain: "evoluciones-poli.firebaseapp.com",
    projectId: "evoluciones-poli",
    storageBucket: "evoluciones-poli.appspot.com",
    messagingSenderId: "771046852975",
    appId: "1:771046852975:web:ceedc5c0e5d22ea039809a"
};

// Variables globales para Firebase
export let app, db, storage;

// Inicializar Firebase
export async function initFirebase() {
    console.log("Inicializando Firebase...");
    try {
        const { initializeApp } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js");
        const { getFirestore } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        const { getStorage } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js");
        
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
                window.showToast("Conexión a Firebase establecida", "success");
            }
        } catch (connectionError) {
            console.error("Error verificando conexión:", connectionError);
            window.showToast("Advertencia: La verificación de conexión falló, pero continuando...", "info");
        }
        
        return true;
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
        if (window.showToast) {
            window.showToast("Error al conectar con Firebase: " + error.message, "error");
        }
        // Continuar a pesar del error para que la UI básica funcione
        return false;
    }
}

// Probar conexión con Firebase
export async function testFirebase() {
    try {
        const { collection, getDocs } = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        
        // Probar lectura intentando obtener colección
        const testCollection = collection(db, "patients");
        
        // Simplificar consulta para evitar la necesidad de un índice compuesto
        const snapshot = await getDocs(testCollection);
        
        console.log("Test de Firebase completado: Permisos de lectura OK");
        return true;
    } catch (error) {
        console.error("Error en prueba de Firebase:", error);
        if (window.showToast) {
            window.showToast("Error de conexión a Firebase: " + error.message, "error");
        }
        return false;
    }
}

// Hacer funciones disponibles globalmente
window.initFirebase = initFirebase;
window.testFirebase = testFirebase;
