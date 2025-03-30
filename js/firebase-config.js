// Inicializar Firebase
export async function initFirebase() {
    try {
        // Verificar si Firebase ya está inicializado
        if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
            console.log("Firebase ya inicializado, omitiendo...");
            return true;
        }

        console.log("Inicializando Firebase...");
        
        // Configuración de Firebase desde las variables globales
        const firebaseConfig = {
            apiKey: "AIzaSyDD1kjbOr566240HrDtWi5egah47kGZLvQ",
            authDomain: "evoluciones-poli.firebaseapp.com",
            projectId: "evoluciones-poli",
            storageBucket: "evoluciones-poli.appspot.com",
            messagingSenderId: "771046852975",
            appId: "1:771046852975:web:ceedc5c0e5d22ea039809a"
        };
        
        // Intentar inicializar mediante import dinámico para evitar errores de sintaxis
        try {
            const firebase = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js');
            const { initializeApp } = firebase;
            window.app = initializeApp(firebaseConfig);
            console.log("App inicializada:", window.app);
            
            const firestoreModule = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js');
            window.db = firestoreModule.getFirestore(window.app);
            console.log("Firestore obtenido:", window.db);
            
            const storageModule = await import('https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js');
            window.storage = storageModule.getStorage(window.app);
            console.log("Storage obtenido:", window.storage);
            
            console.log("Firebase inicializado correctamente");
            return true;
        } catch (importError) {
            console.error("Error con import dinámico:", importError);
            
            // Fallback a la inicialización global (versión anterior)
            if (typeof firebase !== 'undefined') {
                window.app = firebase.initializeApp(firebaseConfig);
                window.db = firebase.firestore();
                window.storage = firebase.storage();
                console.log("Firebase inicializado por fallback");
                return true;
            } else {
                throw new Error("Firebase no disponible");
            }
        }
    } catch (error) {
        console.error("Error al inicializar Firebase:", error);
        window.showToast("Error al conectar con Firebase: " + error.message, "error");
        return false;
    }
}

// Importar función showToast desde utils.js
import { showToast } from './utils.js';
