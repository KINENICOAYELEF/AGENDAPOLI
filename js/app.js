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
    
    // Pequeño retraso para asegurar que todas las dependencias estén cargadas
    setTimeout(() => {
        console.log("Iniciando la aplicación después de cargar las dependencias...");
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
    }, 500); // Pequeño retraso para asegurar que todos los scripts se han cargado
});

// Función principal para inicializar la aplicación
async function initApp() {
    try {
        console.log("Inicializando aplicación...");
        
        // Verificar si showToast está disponible
        if (!window.showToast) {
            console.error("Error: La función showToast no está disponible");
            alert("Error: Algunas funciones críticas no están disponibles. Por favor, recarga la página.");
            return;
        }
        
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
        } else {
            console.error("Error: initFirebase no está disponible");
            window.showToast("Error: Firebase no se ha inicializado correctamente", "error");
            return;
        }
        
        // Cargar pacientes iniciales
        if (window.getPatients) {
            console.log("Cargando pacientes...");
            const patients = await window.getPatients();
            if (window.renderPatients) {
                console.log(`Renderizando ${patients.length} pacientes...`);
                window.renderPatients(patients);
            } else {
                console.error("Error: renderPatients no está disponible");
            }
        } else {
            console.error("Error: getPatients no está disponible");
        }
        
        // Verificación explícita de funciones cruciales
        const criticalFunctions = [
            { name: 'showToast', available: !!window.showToast },
            { name: 'hideLoading', available: !!window.hideLoading },
            { name: 'showLoading', available: !!window.showLoading },
            { name: 'getPatients', available: !!window.getPatients },
            { name: 'renderPatients', available: !!window.renderPatients }
        ];
        
        const unavailableFunctions = criticalFunctions.filter(f => !f.available);
        if (unavailableFunctions.length > 0) {
            console.error("Las siguientes funciones críticas no están disponibles:", 
                unavailableFunctions.map(f => f.name).join(', '));
        }
        
        console.log("Inicialización completada correctamente");
        
        // Mostrar mensaje de éxito (usando la función directamente para evitar problemas)
        if (typeof window.showToast === 'function') {
            // Pequeño retraso para asegurar que se muestre después de otros mensajes
            setTimeout(() => {
                window.showToast("Sistema iniciado correctamente", "success");
            }, 100);
        } else {
            console.error("No se pudo mostrar el mensaje de éxito porque showToast no está disponible");
        }
        
        return true;
    } catch (error) {
        console.error("Error durante la inicialización:", error);
        if (window.showToast) {
            window.showToast("Error de inicialización: " + error.message, "error");
        } else {
            alert("Error durante la inicialización: " + error.message);
        }
        return false;
    }
}

// Hacer que initApp esté disponible globalmente
window.initApp = initApp;
