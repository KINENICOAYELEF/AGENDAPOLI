// app.js
// Inicialización y control principal de la aplicación

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
        if (window.showToast) {
            window.showToast("Error detectado: " + (event.error?.message || "Error desconocido"), "error");
        }
    });
    
    // Inicializar la aplicación con mejor manejo de errores
    initApp().catch(error => {
        console.error("Error al inicializar la aplicación:", error);
        if (window.showToast) {
            window.showToast("Error crítico de inicialización: " + error.message, "error");
        }
        
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

// Función principal para inicializar la aplicación
async function initApp() {
    try {
        console.log("Inicializando aplicación...");
        
        // Inicializar Firebase
        if (window.initFirebase) {
            const firebaseInitialized = await window.initFirebase();
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
        }
        
        // Esperar a que las funciones esenciales estén disponibles
        await waitForDependencies();
        
        // Cargar pacientes iniciales
        if (window.getPatients) {
            const patients = await window.getPatients();
            if (window.renderPatients) {
                window.renderPatients(patients);
            }
        }
        
        console.log("Inicialización completada correctamente");
        if (window.showToast) {
            window.showToast("Sistema iniciado correctamente", "success");
        }
    } catch (error) {
        console.error("Error durante la inicialización:", error);
        if (window.showToast) {
            window.showToast("Error de inicialización: " + error.message, "error");
        }
    }
}

// Función para esperar a que las dependencias estén disponibles
async function waitForDependencies() {
    return new Promise((resolve) => {
        // Función recursiva para comprobar si las dependencias están disponibles
        const checkDependencies = () => {
            const requiredFunctions = [
                'showToast', 'hideLoading', 'showLoading', 'formatDate',
                'getPatients', 'renderPatients'
            ];
            
            // Comprobar si todas las funciones están disponibles
            const allAvailable = requiredFunctions.every(func => typeof window[func] === 'function');
            
            if (allAvailable) {
                resolve();
            } else {
                // Volver a comprobar después de un breve retraso
                setTimeout(checkDependencies, 100);
            }
        };
        
        // Iniciar la comprobación
        checkDependencies();
    });
}

// Hacer que initApp esté disponible globalmente
window.initApp = initApp;
