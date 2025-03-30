// firebase-config.js
// Configuración e inicialización de Firebase

// Variables para Firebase que se exportarán
export let app, db, storage;

// Configuración de Firebase
export const firebaseConfig = {
    apiKey: "AIzaSyDD1kjbOr566240HrDtWi5egah47kGZLvQ",
    authDomain: "evoluciones-poli.firebaseapp.com",
    projectId: "evoluciones-poli",
    storageBucket: "evoluciones-poli.appspot.com",
    messagingSenderId: "771046852975",
    appId: "1:771046852975:web:ceedc5c0e5d22ea039809a"
};

// Importaciones estáticas para Firebase (pre-cargar los módulos)
let firebaseApp, firestore, firebaseStorage, firebaseCollection, firebaseGetDocs;

// Función para pre-cargar módulos Firebase
async function preloadFirebaseModules() {
    try {
        const appModule = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js");
        const firestoreModule = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
        const storageModule = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js");

        firebaseApp = appModule.initializeApp;
        firestore = firestoreModule.getFirestore;
        firebaseStorage = storageModule.getStorage;
        firebaseCollection = firestoreModule.collection;
        firebaseGetDocs = firestoreModule.getDocs;
        
        return true;
    } catch (error) {
        console.error("Error pre-cargando módulos Firebase:", error);
        return false;
    }
}

// Pre-cargar módulos al inicio
preloadFirebaseModules();

// Inicializar Firebase
export async function initFirebase() {
    console.log("Inicializando Firebase...");
    try {
        // Asegurarnos que los módulos estén cargados
        if (!firebaseApp) {
            await preloadFirebaseModules();
        }
        
        app = firebaseApp(firebaseConfig);
        console.log("App inicializada:", app);
        
        db = firestore(app);
        console.log("Firestore obtenido:", db);
        
        storage = firebaseStorage(app);
        console.log("Storage obtenido:", storage);
        
        console.log("Firebase inicializado correctamente");
        
        // Verificar conexión sin dependencia circular
        try {
            const connectionOk = await testFirebase();
            if (connectionOk) {
                // Usamos console.log en lugar de showToast para evitar dependencia circular
                console.log("Conexión a Firebase establecida");
                // La función que llama a initFirebase debería mostrar el toast
                return { success: true, message: "Conexión a Firebase establecida" };
            }
        } catch (connectionError) {
            console.error("Error verificando conexión:", connectionError);
            return { success: false, message: "La verificación de conexión falló, pero continuando..." };
        }
        
        return { success: true };
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
        return { success: false, message: "Error al conectar con Firebase: " + error.message };
    }
}

// Probar conexión con Firebase
export async function testFirebase() {
    try {
        if (!firebaseCollection || !firebaseGetDocs) {
            const firestoreModule = await import("https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js");
            firebaseCollection = firestoreModule.collection;
            firebaseGetDocs = firestoreModule.getDocs;
        }
        
        // Probar lectura intentando obtener colección
        const testCollection = firebaseCollection(db, "patients");
        
        // Simplificar consulta para evitar la necesidad de un índice compuesto
        const snapshot = await firebaseGetDocs(testCollection);
        
        console.log("Test de Firebase completado: Permisos de lectura OK");
        return true;
    } catch (error) {
        console.error("Error en prueba de Firebase:", error);
        return false;
    }
}
