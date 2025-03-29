    <!-- Script for Firebase -->
    <script type="module">
        // Import the functions you need from the SDKs you need
        import { initializeApp } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-app.js";
        import { getFirestore, collection, addDoc, getDocs, doc, getDoc, updateDoc, query, orderBy, serverTimestamp, deleteDoc } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-firestore.js";
        import { getStorage, ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/9.15.0/firebase-storage.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDD1kjbOr566240HrDtWi5egah47kGZLvQ",
            authDomain: "evoluciones-poli.firebaseapp.com",
            projectId: "evoluciones-poli",
            storageBucket: "evoluciones-poli.appspot.com",
            messagingSenderId: "771046852975",
            appId: "1:771046852975:web:ceedc5c0e5d22ea039809a"
        };

        // Inicializar Firebase con mejor manejo de errores
        console.log("Inicializando Firebase...");
        let app, db, storage;
        try {
            app = initializeApp(firebaseConfig);
            console.log("App inicializada:", app);
            
            db = getFirestore(app);
            console.log("Firestore obtenido:", db);
            
            // Verificar conexión
            const pathRef = doc(db, "test/connection");
            console.log("Path de referencia creado:", pathRef);
            
            storage = getStorage(app);
            console.log("Storage obtenido:", storage);
            
            console.log("Firebase inicializado correctamente");
            showToast("Conexión a Firebase establecida", "success");
        } catch (error) {
            console.error("Error al inicializar Firebase:", error);
            showToast("Error al conectar con Firebase: " + error.message, "error");
        }

        // Definir vistas globalmente para que sean accesibles en todo el script
        const views = {
            dashboard: null, // Se establecerá durante la inicialización
            pacientes: `
                <div class="content">
                    <h1 class="page-title">Gestión de Pacientes</h1>
                    <div class="section-header">
                        <h2 class="section-title">Listado de Pacientes</h2>
                        <button class="action-btn btn-primary" id="addPatientBtnView">
                            <i class="fas fa-plus"></i> Nuevo paciente
                        </button>
                    </div>
                    <div class="patient-list" id="patientListView"></div>
                </div>
            `,
            evoluciones: `
                <div class="content">
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
                </div>
            `,
            reportes: `
                <div class="content">
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
                </div>
            `,
            configuracion: `
                <div class="content">
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
                </div>
            `
        };

        // Initialize global variables
        let currentPatientId = null;
        let patientsCache = []; // Para almacenar pacientes y reducir consultas
        
        // Show loading spinner
        function showLoading() {
            document.getElementById('loadingSpinner').classList.add('show');
        }

        // Hide loading spinner
        function hideLoading() {
            document.getElementById('loadingSpinner').classList.remove('show');
        }

        // Show toast notification
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

        // Format date helper
        function formatDate(date) {
            if (!date) return 'No registrada';
            
            try {
                const d = new Date(date);
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

        // Test Firebase connection
        async function testFirebase() {
            try {
                // Probar lectura
                const testCollection = collection(db, "patients");
                
                // Probar escritura con un documento temporal
                const testDoc = await addDoc(testCollection, {
                    test: true,
                    createdAt: new Date().toISOString(),
                    message: "Test connection"
                });
                
                // Eliminar el documento de prueba para no dejar basura
                await deleteDoc(doc(db, "patients", testDoc.id));
                
                console.log("Test de Firebase completado: Permisos de lectura y escritura OK");
                showToast("Conexión a Firebase verificada", "success");
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
                document.getElementById('patientModal').classList.add('active');
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

        // Función para renderizar ejercicios
function renderExercises(exercises) {
    if (!exercises || exercises.length === 0) return '';
    
    let exercisesHTML = `
        <div class="evolution-section">
            <div class="evolution-section-title">Ejercicios prescritos</div>
            <div class="exercise-table-container" style="margin-top: 10px; overflow-x: auto;">
                <table class="exercise-table">
                    <thead>
                        <tr>
                            <th>Ejercicio</th>
                            <th>Implemento</th>
                            <th>Series x Reps</th>
                            <th>Carga</th>
                            <th>Esfuerzo</th>
                            <th>Observaciones</th>
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
        </div>
    `;
    
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
                    
                    // Añadir evento para abrir modal de paciente
                    patientCard.addEventListener('click', ()=> {
                        // Selección de paciente en vista de Evoluciones
                        selectPatient(patient.id);
                    });
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
                        document.getElementById('selectedPatientName').textContent = patient.name;
                        document.getElementById('selectedPatientRUT').textContent = patient.rut;
                        document.getElementById('selectedPatientLastSession').textContent = patient.lastSession || 'No hay sesiones registradas';
                        
                        // Obtener conteo de evoluciones
                        const evolutionsCount = await getEvolutionsCount(patientId);
                        document.getElementById('selectedPatientTotalEvolutions').textContent = evolutionsCount;
                        
                        // Calcular y mostrar progreso
                        const progress = calculatePatientProgress(patient);
                        document.getElementById('selectedPatientProgress').textContent = `${progress}%`;
                        
                        // Configurar botones
                        document.getElementById('addEvolutionForSelectedBtn').onclick = () => showNewEvolutionModal();
                        document.getElementById('viewPatientDetailsBtn').onclick = () => openPatientModal(patientId);
                    }
                }
            } catch (error) {
                console.error("Error al seleccionar paciente:", error);
                showToast("Error al seleccionar paciente: " + error.message, "error");
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

        // Change view function - función mejorada para navegación
        function changeView(viewName) {
            try {
                console.log(`Cambiando a vista: ${viewName}`);
                
                // Validar el nombre de la vista
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
                    if (viewName === 'dashboard') {
                        addEvolutionBtn.style.display = 'flex';
                    } else {
                        addEvolutionBtn.style.display = 'none';
                    }
                }
                
                // Manejar vista dashboard de forma especial
                if (viewName === 'dashboard' && views.dashboard) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = views.dashboard;
                    
                    // Insertar después del header
                    header.after(tempDiv.firstElementChild);
                    
                    // Cargar pacientes para el dashboard
                    getPatients().then(patients => {
                        renderPatients(patients);
                        
                        // Reconectar el botón de añadir paciente
                        const addBtn = document.getElementById('addPatientBtn');
                        if (addBtn) {
                            addBtn.addEventListener('click', function() {
                                document.getElementById('newPatientModal').classList.add('active');
                            });
                        }
                        
                        // Reconectar botón de añadir evolución
                        const addEvolutionBtn = document.getElementById('addEvolutionBtn');
                        if (addEvolutionBtn) {
                            addEvolutionBtn.addEventListener('click', showNewEvolutionModal);
                        }
                    });
                } else {
                    // Para otras vistas, usar la plantilla
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = views[viewName];
                    
                    // Insertar después del header
                    header.after(tempDiv.firstElementChild);
                    
                    // Manejar lógica específica de cada vista
                    if (viewName === 'pacientes') {
                        getPatients().then(patients => {
                            renderPatientsInView('patientListView', patients);
                            
                            // Reconectar botón de nuevo paciente
                            const addBtn = document.getElementById('addPatientBtnView');
                            if (addBtn) {
                                addBtn.addEventListener('click', function() {
                                    document.getElementById('newPatientModal').classList.add('active');
                                });
                            }
                        });
                    } 
                    else if (viewName === 'evoluciones') {
                        getPatients().then(patients => {
                            renderPatientsInView('patientEvolutionsView', patients);
                            
                            // Inicializar selector de pacientes
                            initPatientSelector(patients);
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
                                patientReportBtn.addEventListener('click', generatePatientReport);
                            }
                            
                            const statReportBtn = document.getElementById('generateStatReportBtn');
                            if (statReportBtn) {
                                statReportBtn.addEventListener('click', generateStatisticsReport);
                            }
                        });
                    }
                    else if (viewName === 'configuracion') {
                        // Cargar configuración guardada (si existe)
                        loadConfiguration();
                        
                        // Configurar eventos
                        const saveConfigBtn = document.getElementById('saveConfigBtn');
                        if (saveConfigBtn) {
                            saveConfigBtn.addEventListener('click', saveConfiguration);
                        }
                        
                        const resetConfigBtn = document.getElementById('resetConfigBtn');
                        if (resetConfigBtn) {
                            resetConfigBtn.addEventListener('click', resetConfiguration);
                        }
                        
                        // Inicializar selector de tema
                        const colorThemeSelect = document.getElementById('colorTheme');
                        if (colorThemeSelect) {
                            colorThemeSelect.addEventListener('change', function() {
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
            patientSelectorSearchInput.addEventListener('input', function() {
                const searchTerm = this.value.toLowerCase();
                const filteredPatients = patients.filter(patient => 
                    patient.name.toLowerCase().includes(searchTerm) || 
                    patient.rut.toLowerCase().includes(searchTerm)
                );
                renderPatientSelectorList(filteredPatients);
            });
            
            // Función para renderizar la lista de pacientes en el selector
            function renderPatientSelectorList(patientsList) {
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
        }

        // Cargar configuración
        function loadConfiguration() {
            try {
                // Intentar obtener configuración guardada en localStorage
                const savedConfig = localStorage.getItem('sistemakineConfig');
                if (savedConfig) {
                    const config = JSON.parse(savedConfig);
                    
                    // Llenar campos del formulario
                    if (config.centerName) document.getElementById('centerName').value = config.centerName;
                    if (config.centerAddress) document.getElementById('centerAddress').value = config.centerAddress;
                    if (config.centerPhone) document.getElementById('centerPhone').value = config.centerPhone;
                    
                    if (config.mainTherapistName) document.getElementById('mainTherapistName').value = config.mainTherapistName;
                    if (config.mainTherapistLicense) document.getElementById('mainTherapistLicense').value = config.mainTherapistLicense;
                    if (config.mainTherapistEmail) document.getElementById('mainTherapistEmail').value = config.mainTherapistEmail;
                    
                    // Aplicar tema de colores si se guardó
                    if (config.colorTheme) {
                        document.getElementById('colorTheme').value = config.colorTheme;
                        applyColorTheme(config.colorTheme);
                    }
                    
                    // Aplicar tamaño de fuente si se guardó
                    if (config.fontSize) {
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
                const config = {
                    centerName: document.getElementById('centerName').value,
                    centerAddress: document.getElementById('centerAddress').value,
                    centerPhone: document.getElementById('centerPhone').value,
                    
                    mainTherapistName: document.getElementById('mainTherapistName').value,
                    mainTherapistLicense: document.getElementById('mainTherapistLicense').value,
                    mainTherapistEmail: document.getElementById('mainTherapistEmail').value,
                    
                    colorTheme: document.getElementById('colorTheme').value,
                    fontSize: document.getElementById('fontSize').value
                };
                
                // Guardar en localStorage
                localStorage.setItem('sistemakineConfig', JSON.stringify(config));
                
                // Aplicar cambios visuales
                applyColorTheme(config.colorTheme);
                applyFontSize(config.fontSize);
                
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
                    document.getElementById('centerName').value = "Polideportivo";
                    document.getElementById('centerAddress').value = "";
                    document.getElementById('centerPhone').value = "";
                    
                    document.getElementById('mainTherapistName').value = "Nicolás Ayelef";
                    document.getElementById('mainTherapistLicense').value = "";
                    document.getElementById('mainTherapistEmail').value = "";
                    
                    document.getElementById('colorTheme').value = "blue";
                    document.getElementById('fontSize').value = "medium";
                    
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

        // Generar informe de paciente
        function generatePatientReport() {
            const patientId = document.getElementById('reportPatientSelect').value;
            
            if (!patientId) {
                showToast("Debe seleccionar un paciente para generar el informe", "error");
                return;
            }
            
            // Redirigir al exportar PDF del paciente
            currentPatientId = patientId;
            
            // Mostrar opciones de exportación
            document.getElementById('pdfOptionsContainer').style.display = 'block';
            
            // Configurar botones
            document.getElementById('cancelPdfExport').addEventListener('click', function() {
                document.getElementById('pdfOptionsContainer').style.display = 'none';
            });
            
            document.getElementById('generatePdfBtn').addEventListener('click', function() {
                exportToPDF(patientId);
                document.getElementById('pdfOptionsContainer').style.display = 'none';
            });
        }

        // Generar informe estadístico
        function generateStatisticsReport() {
            const startDate = document.getElementById('reportStartDate').value;
            const endDate = document.getElementById('reportEndDate').value;
            
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
                        const menuText = this.querySelector('.menu-item-text').textContent.trim();
                        const viewName = menuToView[menuText] || menuText.toLowerCase();
                        
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
                
                // Leer opciones del formulario
                const includeDiagnosis = document.getElementById('pdfIncludeDiagnosis')?.checked || true;
                const includeEvolutions = document.getElementById('pdfIncludeEvolutions')?.checked || true;
                const includeScales = document.getElementById('pdfIncludeScales')?.checked || true;
                const includeExercises = document.getElementById('pdfIncludeExercises')?.checked || true;
                const includeLogo = document.getElementById('pdfIncludeLogo')?.checked || true;
                const includeFooter = document.getElementById('pdfIncludeFooter')?.checked || true;
                
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
                        const startDate = new Date(document.getElementById('pdfDateFrom').value);
                        const endDate = new Date(document.getElementById('pdfDateTo').value);
                        
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
                doc.setFontSize(14);doc.text(`Paciente: ${patient.name || 'Sin nombre'}`, 15, 40);
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
                
                document.getElementById('evolutionDate').value = today;
                document.getElementById('evolutionTime').value = now;
                
                // Limpiar campos previos
                document.getElementById('evolutionPatientState').value = '';
                document.getElementById('evolutionTreatment').value = '';
                document.getElementById('evolutionResponse').value = '';
                document.getElementById('evolutionTrainingPlan').value = '';
                document.getElementById('evolutionObservations').value = '';
                
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
                document.getElementById('evolutionStudent').value = currentUser;
                
                // Actualizar título del modal con el nombre del paciente
                getPatient(currentPatientId).then(patient => {
                    const patientName = patient ? patient.name : "paciente";
                    document.getElementById('evolutionModalTitle').textContent = `Nueva evolución - ${patientName}`;
                });
                
                // Restablecer valores predeterminados de las escalas
                document.getElementById('evaRange').value = 5;
                document.getElementById('evaValue').textContent = '5/10';
                
                document.getElementById('grocRange').value = 3;
                document.getElementById('grocValue').textContent = '+3';
                
                document.getElementById('saneRange').value = 70;
                document.getElementById('saneValue').textContent = '70%';
                
                // Limpiar actividades PSFS previas
                document.getElementById('psfsActivities').innerHTML = '';
                
                // Limpiar ejercicios previos
                document.getElementById('exerciseTableBody').innerHTML = '';
                
                // Limpiar vista previa de adjuntos
                document.getElementById('attachmentPreview').innerHTML = '';
                
                // Mostrar modal
                document.getElementById('newEvolutionModal').classList.add('active');
            } catch (error) {
                console.error("Error al mostrar modal de nueva evolución:", error);
                showToast("Error al abrir formulario de evolución", "error");
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
        addPsfsBtn.addEventListener('click', addPsfsActivity);
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
            slider.addEventListener('input', function() {
                const value = this.value;
                const ratingNumber = newActivity.querySelector('.rating-number');
                const ratingBar = newActivity.querySelector('.rating-value');
                
                if (ratingNumber) ratingNumber.textContent = value;
                if (ratingBar) ratingBar.style.width = (value * 10) + '%';
            });
            
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
                addExerciseBtn.addEventListener('click', function() {
                    addExerciseRow();
                });
            }

            // Configurar plantillas de ejercicios
            const templateBtns = document.querySelectorAll('.template-btn');
            if (templateBtns) {
                templateBtns.forEach(btn => {
                    btn.addEventListener('click', function() {
                        const template = this.getAttribute('data-template');
                        loadExerciseTemplate(template);
                    });
                });
            }
        }

        // Función para añadir una fila de ejercicio
        // Función para añadir una fila de ejercicio
// Función para añadir una fila de ejercicio
function addExerciseRow(exercise = {}) {
    // Obtener la tabla de ejercicios
    const tableBody = document.getElementById('exerciseTableBody');
    if (!tableBody) {
        console.error("No se encontró la tabla de ejercicios");
        return;
    }
    
    // Crear una nueva fila
    const row = document.createElement('tr');
    
    // Definir el HTML de la fila con todos los campos
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
            <div style="display: flex; align-items: center; gap: 5px;">
                <select class="form-control" style="flex: 1;">
                    <option value="RPE" ${(exercise.effortType === 'RPE' || !exercise.effortType) ? 'selected' : ''}>RPE</option>
                    <option value="RIR" ${exercise.effortType === 'RIR' ? 'selected' : ''}>RIR</option>
                </select>
                <input type="number" class="form-control" min="0" max="10" step="1"
                       value="${exercise.effortValue || ''}" style="flex: 1; text-align: center;">
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
                                <div class="timeline-item fade-in">
                                    <div class="timeline-dot">
                                        <i class="fas fa-file-medical"></i>
                                    </div>
                                    <div class="timeline-content">
                                        <div class="timeline-date">Ejemplo - ${formatDate(new Date())}</div>
                                        <h3 class="timeline-title">Diagnóstico demo</h3>
                                        <p>Este es un ejemplo de diagnóstico. Puede añadir diagnósticos reales utilizando el botón de "Nuevo diagnóstico".</p>
                                    </div>
                                </div>
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
                
                // Agregar funcionalidad a "Añadir diagnóstico"
                const addDiagnosisBtn = document.getElementById('addDiagnosisBtn');
                if (addDiagnosisBtn) {
                    addDiagnosisBtn.addEventListener('click', function() {
                        openDiagnosisModal(patientId);
                    });
                }
                
                // Configurar componentes CIF
                setupCifCategories(patientId);
                
                // Inicializar botón de guardar diagnóstico
                const saveDiagnosisBtn = document.getElementById('saveDiagnosisBtn');
                if (saveDiagnosisBtn) {
                    saveDiagnosisBtn.addEventListener('click', function() {
                        saveDiagnosisChanges(patientId);
                    });
                }
                
                // Inicializar botón de añadir objetivo
                const addObjectiveBtn = document.getElementById('addObjectiveBtn');
                if (addObjectiveBtn) {
                    addObjectiveBtn.addEventListener('click', function() {
                        openObjectiveModal(patientId);
                    });
                }
                
                // Inicializar botón de añadir plan de tratamiento
                const addTreatmentPlanBtn = document.getElementById('addTreatmentPlanBtn');
                if (addTreatmentPlanBtn) {
                    addTreatmentPlanBtn.addEventListener('click', function() {
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
                // En una implementación real, esto obtendría los diagnósticos de Firebase
                // Por ahora, devolvemos datos de ejemplo
                return [
                    {
                        id: '1',
                        date: new Date().toISOString(),
                        code: 'M54.5 Lumbago',
                        description: 'Paciente presenta dolor lumbar mecánico asociado a sobrecarga por actividad deportiva.',
                        createdAt: new Date().toISOString()
                    }
                ];
            } catch (error) {
                console.error("Error obteniendo diagnósticos:", error);
                return [];
            }
        }

        // Abrir modal de nuevo diagnóstico
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
                            <div class="form-group">
                                <label class="form-label">Diagnóstico médico (CIE-10)</label>
                                <div class="cif-search" style="margin-bottom: 10px;">
                                    <i class="fas fa-search"></i>
                                    <input type="text" class="form-control" id="cieSearchInput" placeholder="Buscar código CIE-10...">
                                </div>
                                <input type="text" class="form-control" id="diagnosisCIE" placeholder="Ej: M54.5 Lumbago" required>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Diagnóstico kinesiológico</label>
                                <textarea class="form-control" id="diagnosisText" rows="5" placeholder="Ingrese el diagnóstico kinesiológico detallado" required></textarea>
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
            
            // Eventos para el modal
            document.getElementById('closeDiagnosisModal').addEventListener('click', function() {
                diagnosisModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(diagnosisModal), 300);
            });
            
            document.getElementById('cancelDiagnosisBtn').addEventListener('click', function() {
                diagnosisModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(diagnosisModal), 300);
            });
            
            // Añadir funcionalidad para búsqueda de códigos CIE
            const cieSearchInput = document.getElementById('cieSearchInput');
            if (cieSearchInput) {
                cieSearchInput.addEventListener('input', function() {
                    // En una implementación real, esto buscaría en una base de datos de códigos CIE
                    const searchTerm = this.value.toLowerCase();
                    if (searchTerm.length < 2) return;
                    
                    // Códigos CIE de ejemplo
                    const cieCodes = [
                        { code: 'M54.5', desc: 'Lumbago' },
                        { code: 'M54.4', desc: 'Lumbago con ciática' },
                        { code: 'M54.1', desc: 'Radiculopatía' },
                        { code: 'M25.5', desc: 'Dolor articular' },
                        { code: 'M79.1', desc: 'Mialgia' }
                    ];
                    
                    const results = cieCodes.filter(item => 
                        item.code.toLowerCase().includes(searchTerm) ||
                        item.desc.toLowerCase().includes(searchTerm)
                    );
                    
                    // Mostrar resultados
                    let resultHTML = '';
                    if (results.length > 0) {
                        resultHTML = '<div style="border: 1px solid var(--border); border-radius: 4px; margin-top: 5px; max-height: 150px; overflow-y: auto;">';
                        results.forEach(result => {
                            resultHTML += `<div style="padding: 8px 12px; cursor: pointer; border-bottom: 1px solid var(--border);" 
                                            onclick="document.getElementById('diagnosisCIE').value = '${result.code} ${result.desc}'">
                                            <strong>${result.code}</strong>: ${result.desc}
                                          </div>`;
                        });
                        resultHTML += '</div>';
                    }
                    
                    // Añadir resultados debajo del input
                    const resultsContainer = document.getElementById('cieSearchResults');
                    if (!resultsContainer) {
                        const container = document.createElement('div');
                        container.id = 'cieSearchResults';
                        cieSearchInput.insertAdjacentElement('afterend', container);
                    }
                    
                    document.getElementById('cieSearchResults').innerHTML = resultHTML;
                });
            }
            
            document.getElementById('diagnosisForm').addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Obtener datos del formulario
                const diagnosisDate = document.getElementById('diagnosisDate').value;
                const diagnosisCIE = document.getElementById('diagnosisCIE').value;
                const diagnosisText = document.getElementById('diagnosisText').value;
                
                // En una implementación real, esto guardaría el diagnóstico en Firebase
                // Por ahora, solo actualizamos la interfaz
                
                // Añadir diagnóstico a la línea de tiempo
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
                
                // Cerrar modal
                diagnosisModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(diagnosisModal), 300);
            });
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
                
                // Implementar funcionalidad del botón para añadir nuevos elementos
                addBtn.addEventListener('click', function() {
                    showCifSelectorModal(categoryType, containerId, patientId);
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

        // Obtener funciones CIF del paciente
        function getCifFunctions(patientId) {
            // En una implementación real, esto obtendría datos de Firebase
            // Por ahora, devolvemos datos de ejemplo
            return [
                { id: 'f1', code: "b280", name: "Sensación de dolor", description: "Sensaciones desagradables que indican daño potencial o real en alguna estructura corporal.", value: 2 },
                { id: 'f2', code: "b730", name: "Funciones de fuerza muscular", description: "Funciones relacionadas con la fuerza generada por la contracción de un músculo o grupo de músculos.", value: 1 }
            ];
        }

        // Obtener estructuras CIF del paciente
        function getCifStructures(patientId) {
            return [
                { id: 's1', code: "s750", name: "Estructura extremidad inferior", description: "Estructura de la pierna y el pie.", value: 1 }
            ];
        }

        // Obtener actividades CIF del paciente
        function getCifActivities(patientId) {
            return [
                { id: 'a1', code: "d450", name: "Caminar", description: "Andar sobre una superficie a pie, paso a paso.", value: 2 }
            ];
        }

        // Obtener factores CIF del paciente
        function getCifFactors(patientId) {
            return [
                { id: 'e1', code: "e110", name: "Productos para consumo personal", description: "Cualquier sustancia natural o fabricada por el hombre, recogida, procesada o manufacturada para la ingesta.", value: 1 }
            ];
        }

        // Cargar factores personales
        function loadPersonalFactors(patientId) {
            // En una implementación real, esto obtendría datos de Firebase
            const cifPersonalFactors = document.getElementById('cifPersonalFactors');
            if (cifPersonalFactors) {
                cifPersonalFactors.value = "Paciente de 35 años, deportista amateur, trabaja en oficina con postura sedentaria prolongada.";
            }
        }

        // Mostrar selector de CIF
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
            
            // Mostrar modal
            cifModal.style.display = 'block';
            setTimeout(() => cifModal.classList.add('active'), 50);
            
            // Configurar campo de búsqueda
            const searchInput = document.getElementById('cifSearchInput');
            if (searchInput) {
                searchInput.value = '';
                searchInput.placeholder = `Buscar código CIF ${categoryType.toLowerCase()}...`;
                
                // Limpiar resultados anteriores
                const resultsContainer = document.getElementById('cifSearchResults');
                if (resultsContainer) {
                    resultsContainer.innerHTML = '';
                }
                
                // Configurar evento de búsqueda
                searchInput.addEventListener('input', function() {
                    const searchTerm = this.value.toLowerCase();
                    if (searchTerm.length < 2) {
                        resultsContainer.innerHTML = '';
                        return;
                    }
                    
                    // Obtener datos de ejemplo según categoría
                    let cifCodes = [];
                    switch(categoryType) {
                        case 'Función':
                            cifCodes = [
                                { code: 'b280', name: 'Sensación de dolor', desc: 'Sensaciones desagradables que indican daño potencial o real en alguna estructura corporal.' },
                                { code: 'b710', name: 'Funciones de movilidad articular', desc: 'Funciones relacionadas con el rango y facilidad de movimiento de una articulación.' },
                                { code: 'b730', name: 'Funciones de fuerza muscular', desc: 'Funciones relacionadas con la fuerza generada por la contracción de un músculo o grupo de músculos.' },
                                { code: 'b740', name: 'Funciones de resistencia muscular', desc: 'Funciones relacionadas con el mantenimiento de la contracción muscular durante un período de tiempo determinado.' }
                            ];
                            break;
                        case 'Estructura':
                            cifCodes = [
                                { code: 's750', name: 'Estructura extremidad inferior', desc: 'Estructura de la pierna y el pie.' },
                                { code: 's760', name: 'Estructura del tronco', desc: 'Estructura del tronco, espalda, incluida la pelvis.' },
                                { code: 's770', name: 'Estructuras musculoesqueléticas adicionales', desc: 'Estructuras relacionadas con el movimiento.' }
                            ];
                            break;
                        case 'Actividad':
                            cifCodes = [
                                { code: 'd450', name: 'Caminar', desc: 'Andar sobre una superficie a pie, paso a paso.' },
                                { code: 'd455', name: 'Desplazarse', desc: 'Mover todo el cuerpo de un sitio a otro sin caminar.' },
                                { code: 'd430', name: 'Levantar y llevar objetos', desc: 'Levantar un objeto o llevar algo de un sitio a otro.' }
                            ];
                            break;
                        case 'Factor':
                            cifCodes = [
                                { code: 'e110', name: 'Productos para consumo personal', desc: 'Cualquier sustancia natural o fabricada por el hombre para la ingesta.' },
                                { code: 'e115', name: 'Productos para uso personal', desc: 'Equipamiento, productos y tecnologías utilizados en las actividades cotidianas.' },
                                { code: 'e120', name: 'Movilidad personal', desc: 'Equipamiento, productos y tecnologías utilizados para facilitar el movimiento.' }
                            ];
                            break;
                    }
                    
                    // Filtrar resultados
                    const results = cifCodes.filter(item => 
                        item.code.toLowerCase().includes(searchTerm) ||
                        item.name.toLowerCase().includes(searchTerm) ||
                        item.desc.toLowerCase().includes(searchTerm)
                    );
                    
                    // Mostrar resultados
                    resultsContainer.innerHTML = '';
                    if (results.length > 0) {
                        results.forEach(result => {
                            const resultItem = document.createElement('div');
                            resultItem.className = 'cif-result-item';
                            resultItem.innerHTML = `
                                <div class="cif-result-code">${result.code}: ${result.name}</div>
                                <div class="cif-result-desc">${result.desc}</div>
                            `;
                            
                            resultItem.addEventListener('click', function() {
                                // Llenar campos del formulario
                                document.getElementById('cifCodeInput').value = result.code;
                                document.getElementById('cifNameInput').value = result.name;
                                document.getElementById('cifDescInput').value = result.desc;
                                
                                // Resaltar selección
                                resultsContainer.querySelectorAll('.cif-result-item').forEach(item => {
                                    item.style.backgroundColor = '';
                                });
                                this.style.backgroundColor = 'rgba(30, 136, 229, 0.1)';
                            });
                            
                            resultsContainer.appendChild(resultItem);
                        });
                    } else {
                        resultsContainer.innerHTML = '<div style="padding: 10px; color: var(--text-secondary); font-style: italic;">No se encontraron resultados</div>';
                    }
                });
            }
            
            // Configurar campos de formulario
            document.getElementById('cifCodeInput').value = '';
            document.getElementById('cifNameInput').value = '';
            document.getElementById('cifDescInput').value = '';
            document.getElementById('cifValueInput').value = '2';
            
            // Guardar referencias para el botón de guardar
            cifModal.setAttribute('data-target', targetContainerId);
            cifModal.setAttribute('data-category', categoryType);
            cifModal.setAttribute('data-patient', patientId);
            
            // Configurar evento para botones
            document.getElementById('closeCifModal').addEventListener('click', function() {
                cifModal.classList.remove('active');
                setTimeout(() => {
                    cifModal.style.display = 'none';
                }, 300);
            });
            
            document.getElementById('cancelCifBtn').addEventListener('click', function() {
                cifModal.classList.remove('active');
                setTimeout(() => {
                    cifModal.style.display = 'none';
                }, 300);
            });
            
            document.getElementById('saveCifBtn').addEventListener('click', function() {
                addCifItem(cifModal);
            });
        }

        // Añadir un elemento CIF
        function addCifItem(modal){
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
            
            const container = document.getElementById(targetContainerId);
            if (container) {
                // Generar un ID único para este elemento (en una implementación real se usaría el ID de Firebase)
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
                        }
                    });
                });
                
                // Añadir al inicio para mayor visibilidad
                if (container.firstChild) {
                    container.insertBefore(newItem, container.firstChild);
                } else {
                    container.appendChild(newItem);
                }
                
                // En una implementación real, aquí se guardarían los datos en memoria
                // hasta que el usuario haga clic en "Guardar cambios"
                
                showToast(`Elemento CIF ${categoryType} añadido correctamente`, "success");
            }
            
            // Cerrar modal
            modal.classList.remove('active');
            setTimeout(() => {
                modal.style.display = 'none';
            }, 300);
        }

        // Guardar cambios en diagnóstico
        function saveDiagnosisChanges(patientId) {
            // En una implementación real, aquí se guardarían todos los cambios en Firebase
            
            // Obtener factores personales
            const personalFactors = document.getElementById('cifPersonalFactors').value;
            
            // Simular guardado exitoso
            showToast("Diagnóstico guardado correctamente", "success");
        }

        // Abrir modal de objetivo
        function openObjectiveModal(patientId) {
            // Utilizar el modal predefinido
            const objectiveModal = document.getElementById('objectiveModal');
            
            if (!objectiveModal) {
                console.error("Modal de objetivos no encontrado");
                return;
            }
            
            // Mostrar modal
            objectiveModal.style.display = 'block';
            setTimeout(() => objectiveModal.classList.add('active'), 50);
            
            // Establecer fecha actual
            const today = new Date().toISOString().split('T')[0];
            document.getElementById('objectiveStartDate').value = today;
            
            // Establecer fecha estimada en 4 semanas
            const fourWeeksLater = new Date();
            fourWeeksLater.setDate(fourWeeksLater.getDate() + 28);
            document.getElementById('objectiveEndDate').value = fourWeeksLater.toISOString().split('T')[0];
            
            // Configurar eventos para botones
            document.getElementById('closeObjectiveModal').addEventListener('click', function() {
                objectiveModal.classList.remove('active');
                setTimeout(() => {
                    objectiveModal.style.display = 'none';
                }, 300);
            });
            
            document.getElementById('cancelObjectiveBtn').addEventListener('click', function() {
                objectiveModal.classList.remove('active');
                setTimeout(() => {
                    objectiveModal.style.display = 'none';
                }, 300);
            });
            
            document.getElementById('saveObjectiveBtn').addEventListener('click', function() {
                saveObjective(patientId, objectiveModal);
            });
            
            // Escuchar cambios en el slider para actualizar el SVG
            const progressSlider = document.getElementById('objectiveProgress');
            if (progressSlider) {
                progressSlider.addEventListener('input', function() {
                    updateObjectiveProgressPreview(this.value);
                });
            }
        }

        // Actualizar vista previa del progreso del objetivo
        function updateObjectiveProgressPreview(progress) {
            // En una implementación real, esto actualizaría un SVG o un elemento visual
            console.log(`Progreso actualizado a: ${progress}%`);
        }

        // Guardar objetivo
        function saveObjective(patientId, modal) {
            // Obtener datos del formulario
            const type = document.getElementById('objectiveType').value;
            const description = document.getElementById('objectiveDesc').value;
            const startDate = document.getElementById('objectiveStartDate').value;
            const endDate = document.getElementById('objectiveEndDate').value;
            const status = document.getElementById('objectiveStatus').value;
            const progress = document.getElementById('objectiveProgress').value;
            
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
                                <label class="form-label">Frecuencia de sesiones</label>
                                <div style="display: flex; gap: 10px;">
                                    <input type="number" class="form-control" id="planFrequency" min="1" max="7" value="3" style="width: 80px;">
                                    <select class="form-control" id="planFrequencyUnit">
                                        <option value="sesiones por semana">sesiones por semana</option>
                                        <option value="sesiones por mes">sesiones por mes</option>
                                    </select>
                                    <input type="number" class="form-control" id="planDuration" min="1" max="52" value="4" style="width: 80px;">
                                    <select class="form-control" id="planDurationUnit">
                                        <option value="semanas">semanas</option>
                                        <option value="meses">meses</option>
                                    </select>
                                </div>
                            </div>
                            <div class="form-group">
                                <label class="form-label">Técnicas a utilizar</label>
                                <div class="techniques-container" style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 10px;">
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="checkbox" id="techniqueTM" checked>
                                        <label for="techniqueTM">Terapia manual</label>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="checkbox" id="techniqueEJ" checked>
                                        <label for="techniqueEJ">Ejercicio terapéutico</label>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="checkbox" id="techniqueAG">
                                        <label for="techniqueAG">Agentes físicos</label>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="checkbox" id="techniqueEN">
                                        <label for="techniqueEN">Entrenamiento funcional</label>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="checkbox" id="techniquePL">
                                        <label for="techniquePL">Propiocepción y equilibrio</label>
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 5px;">
                                        <input type="checkbox" id="techniqueED">
                                        <label for="techniqueED">Educación al paciente</label>
                                    </div>
                                </div>
                                <input type="text" class="form-control" id="techniquesOther" placeholder="Otras técnicas...">
                            </div>
                            <div class="form-group">
                                <label class="form-label">Observaciones y recomendaciones</label>
                                <textarea class="form-control" id="planObservations" rows="3" placeholder="Detalle observaciones específicas para este plan de tratamiento..."></textarea>
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
            
            // Configurar eventos
            document.getElementById('closeTreatmentPlanModal').addEventListener('click', function() {
                planModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(planModal), 300);
            });
            
            document.getElementById('cancelTreatmentPlanBtn').addEventListener('click', function() {
                planModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(planModal), 300);
            });
            
            document.getElementById('treatmentPlanForm').addEventListener('submit', function(e) {
                e.preventDefault();
                
                // Obtener datos del formulario
                const startDate = document.getElementById('planStartDate').value;
                const frequency = document.getElementById('planFrequency').value;
                const frequencyUnit = document.getElementById('planFrequencyUnit').value;
                const duration = document.getElementById('planDuration').value;
                const durationUnit = document.getElementById('planDurationUnit').value;
                const observations = document.getElementById('planObservations').value;
                
                // Recopilar técnicas seleccionadas
                const techniques = [];
                if (document.getElementById('techniqueTM').checked) techniques.push('Terapia manual');
                if (document.getElementById('techniqueEJ').checked) techniques.push('Ejercicio terapéutico');
                if (document.getElementById('techniqueAG').checked) techniques.push('Agentes físicos');
                if (document.getElementById('techniqueEN').checked) techniques.push('Entrenamiento funcional');
                if (document.getElementById('techniquePL').checked) techniques.push('Propiocepción y equilibrio');
                if (document.getElementById('techniqueED').checked) techniques.push('Educación al paciente');
                
                const otherTechniques = document.getElementById('techniquesOther').value;
                if (otherTechniques) {
                    techniques.push(otherTechniques);
                }
                
                // Añadir plan a la lista
                const treatmentPlanList = document.getElementById('treatmentPlanList');
                if (treatmentPlanList) {
                    const newPlan = document.createElement('div');
                    newPlan.className = 'plan-card fade-in';
                    
                    newPlan.innerHTML = `
                        <div class="plan-header">
                            <div class="plan-title">
                                <i class="fas fa-clipboard-list"></i>
                                Plan de Tratamiento
                            </div>
                            <div class="plan-date">${formatDate(new Date(startDate))}</div>
                        </div>
                        <div class="plan-details">
                            <div class="plan-row">
                                <div class="plan-label">Frecuencia:</div>
                                <div class="plan-value">${frequency} ${frequencyUnit} durante ${duration} ${durationUnit}</div>
                            </div>
                            <div class="plan-row">
                                <div class="plan-label">Técnicas:</div>
                                <div class="plan-value">
                                    <div class="techniques-list">
                                        ${techniques.map(t => `<div class="technique-tag">${t}</div>`).join('')}
                                    </div>
                                </div>
                            </div>
                            ${observations ? `
                            <div class="plan-row">
                                <div class="plan-label">Observaciones:</div>
                                <div class="plan-value">
                                    ${observations}
                                </div>
                            </div>
                            ` : ''}
                        </div>
                    `;
                    
                    // Añadir al inicio para mayor visibilidad
                    if (treatmentPlanList.firstChild) {
                        treatmentPlanList.insertBefore(newPlan, treatmentPlanList.firstChild);
                    } else {
                        treatmentPlanList.appendChild(newPlan);
                    }
                }
                
                // En una implementación real, aquí se guardarían los datos en Firebase
                
                showToast("Plan de tratamiento guardado correctamente", "success");
                
                // Cerrar modal
                planModal.classList.remove('active');
                setTimeout(() => document.body.removeChild(planModal), 300);
            });
        }

        async function initApp() {
            try {
                console.log("Inicializando aplicación...");
                
                // Guardar el contenido original del dashboard
                const originalContent = document.querySelector('.content');
                if (originalContent) {
                    views.dashboard = originalContent.outerHTML;
                }
                
                // Establecer fecha actual para nuevas evoluciones
                const today = new Date().toISOString().split('T')[0];
                const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
                
                // Verificar conexión a Firebase
                const connected = await testFirebase();
                if (!connected) {
                    showToast("Advertencia: Problemas de conexión con Firebase", "error");
                }
                
                // Establecer valores por defecto en el formulario de evolución
                if (document.getElementById('evolutionDate')) {
                    document.getElementById('evolutionDate').value = today;
                }
                
                if (document.getElementById('evolutionTime')) {
                    document.getElementById('evolutionTime').value = now;
                }
                
                // Configurar navegación
                setupNavigation();
                
                // Configurar eventos del PDF para opciones personalizadas
                document.getElementById('pdfEvolutionPeriod').addEventListener('change', function() {
                    const customDateRange = document.getElementById('pdfCustomDateRange');
                    if (customDateRange) {
                        customDateRange.style.display = this.value === 'custom' ? 'block' : 'none';
                    }
                });
                
                // Configurar previsualización de archivos adjuntos
                const evolutionAttachments = document.getElementById('evolutionAttachments');
                if (evolutionAttachments) {
                    evolutionAttachments.addEventListener('change', function() {
                        const previewContainer = document.getElementById('attachmentPreview');
                        if (!previewContainer) return;
                        
                        previewContainer.innerHTML = '';
                        
                        Array.from(this.files).forEach(file => {
                            const isImage = file.type.startsWith('image/');
                            const attachment = document.createElement('div');
                            attachment.className = 'attachment';
                            
                            if (isImage) {
                                const img = document.createElement('img');
                                img.src = URL.createObjectURL(file);
                                img.alt = file.name;
                                attachment.appendChild(img);
                            } else {
                                attachment.innerHTML = `<img src="https://via.placeholder.com/100x100/e9ecef/495057?text=${file.name.split('.').pop().toUpperCase()}" alt="${file.name}">`;
                            }
                            
                            const typeLabel = document.createElement('div');
                            typeLabel.className = 'attachment-type';
                            typeLabel.textContent = isImage ? 'Foto' : file.name.split('.').pop().toUpperCase();
                            attachment.appendChild(typeLabel);
                            
                            previewContainer.appendChild(attachment);
                        });
                    });
                }
                
                // Configurar controles de escalas
                setupScalesControls();
                
                // Configurar tabla de ejercicios
                setupExerciseTable();
                
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
                        document.getElementById(tabId + 'Tab').classList.add('active');
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
                            document.getElementById('newPatientModal').classList.remove('active');
                            
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
                        document.getElementById('newPatientModal').classList.add('active');
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
                        }
                    });
                });
                
                // Botones de cancelar específicos
                const cancelEvolutionBtn = document.getElementById('cancelEvolutionBtn');
                if (cancelEvolutionBtn) {
                    cancelEvolutionBtn.addEventListener('click', function() {
                        document.getElementById('newEvolutionModal').classList.remove('active');
                    });
                }
                
                const cancelPatientBtn = document.getElementById('cancelPatientBtn');
                if (cancelPatientBtn) {
                    cancelPatientBtn.addEventListener('click', function() {
                        document.getElementById('newPatientModal').classList.remove('active');
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
                            name: document.getElementById('patientName').value,
                            rut: document.getElementById('patientRut').value,
                            birthDate: document.getElementById('patientBirthDate').value,
                            phone: document.getElementById('patientPhone').value,
                            email: document.getElementById('patientEmail').value || '',
                            address: document.getElementById('patientAddress').value || '',
                            medicalHistory: document.getElementById('patientMedicalHistory').value || '',
                            medications: document.getElementById('patientMedications').value || '',
                            allergies: document.getElementById('patientAllergies').value || '',
                            emergencyContact: document.getElementById('patientEmergencyContact').value || '',
                            emergencyPhone: document.getElementById('patientEmergencyPhone').value || ''
                        };
                        
                        // Actualizar datos del paciente
                        await updatePatient(currentPatientId, patientData);
                        
                        // Refrescar lista de pacientes
                        await getPatients();
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
                        document.getElementById('pdfOptionsContainer').style.display = 'block';
                    });
                }
                
                // Configurar botones de opciones de PDF
                document.getElementById('cancelPdfExport').addEventListener('click', function() {
                    document.getElementById('pdfOptionsContainer').style.display = 'none';
                });
                
                document.getElementById('generatePdfBtn').addEventListener('click', function() {
                    exportToPDF(currentPatientId);
                    document.getElementById('pdfOptionsContainer').style.display = 'none';
                });

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
                                date: document.getElementById('evolutionDate').value,
                                time: document.getElementById('evolutionTime').value,
                                student: document.getElementById('evolutionStudent').value,
                                patientState: document.getElementById('evolutionPatientState').value,
                                treatment: document.getElementById('evolutionTreatment').value,
                                response: document.getElementById('evolutionResponse').value,
                                scales: {
                                    eva: parseInt(document.getElementById('evaRange').value),
                                    groc: parseInt(document.getElementById('grocRange').value),
                                    sane: parseInt(document.getElementById('saneRange').value),
                                    saneText: document.getElementById('saneCustomText').value,
                                    psfs: psfsActivities
                                },
                                exercises: exercises,
                                trainingPlan: document.getElementById('evolutionTrainingPlan').value || '',
                                observations: document.getElementById('evolutionObservations').value || '',
                                attachments: []
                            };
                            
                            console.log("Datos de evolución a guardar:", evolutionData);
                            
                            // Añadir evolución a Firebase
                            const evolutionId = await addEvolution(currentPatientId, evolutionData);
                            
                            if (evolutionId) {
                                // Cerrar modal
                                document.getElementById('newEvolutionModal').classList.remove('active');
                                
                                // Limpiar formulario
                                this.reset();
                                
                                // Restablecer campos con valores por defecto
                                const today = new Date().toISOString().split('T')[0];
                                const now = new Date().toTimeString().split(' ')[0].substring(0, 5);
                                
                                document.getElementById('evolutionDate').value = today;
                                document.getElementById('evolutionTime').value = now;
                                document.getElementById('evaRange').value = 5;
                                document.getElementById('evaValue').textContent = '5/10';
                                document.getElementById('grocRange').value = 3;
                                document.getElementById('grocValue').textContent = '+3';
                                document.getElementById('saneRange').value = 70;
                                document.getElementById('saneValue').textContent = '70%';
                                
                                // Limpiar actividades PSFS
                                document.getElementById('psfsActivities').innerHTML = '';
                                
                                // Limpiar ejercicios
                                document.getElementById('exerciseTableBody').innerHTML = '';
                                
                                // Refrescar evoluciones si el modal de paciente está abierto
                                if (document.getElementById('patientModal').classList.contains('active')) {
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
                
                // Cargar pacientes iniciales
                await getPatients();
                
                console.log("Inicialización completada correctamente");
                showToast("Sistema iniciado correctamente", "success");
            } catch (error) {
                console.error("Error durante la inicialización:", error);
                showToast("Error de inicialización: " + error.message, "error");
            }

            // Ejecutar la configuración cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Obtener referencia a la función original
    const originalInitApp = window.initApp || initApp;
    
    // Reemplazar con nuestra versión extendida
    window.initApp = async function() {
        // Primero ejecutar la inicialización original
        await originalInitApp.apply(this, arguments);
        
        // Después inicializar nuestras funcionalidades adicionales
        try {
            console.log("Inicializando funcionalidades adicionales...");
            
            // Configurar comandos rápidos
            setupCommandShortcuts();
            console.log("Comandos rápidos configurados");
            
            // Configurar botones para ejemplos
            document.querySelectorAll('.btn-example').forEach(btn => {
                if (btn.onclick === null) {
                    const funcName = btn.getAttribute('onclick')?.replace(/[()]/g, '');
                    if (funcName && typeof window[funcName] === 'function') {
                        btn.addEventListener('click', window[funcName]);
                    }
                }
            });
            console.log("Botones de ejemplo configurados");
            
            // Cargar plantillas personalizadas
            loadCustomTemplates();
            console.log("Plantillas personalizadas cargadas");
            
            // Configurar botón para gestionar plantillas
            const manageTemplatesBtn = document.getElementById('manageCustomTemplatesBtn');
            if (manageTemplatesBtn) {
                manageTemplatesBtn.addEventListener('click', function() {
                    const modal = document.getElementById('templatesModal');
                    if (modal) {
                        modal.style.display = 'block';
                        setTimeout(() => modal.classList.add('active'), 50);
                    }
                });
                console.log("Botón de gestión de plantillas configurado");
            }
            
            // Configurar botones del formulario de plantillas
            const saveCurrentAsTemplateBtn = document.getElementById('saveCurrentAsTemplateBtn');
            if (saveCurrentAsTemplateBtn) {
                saveCurrentAsTemplateBtn.addEventListener('click', saveCurrentExercisesAsTemplate);
            }
            
            const confirmSaveTemplateBtn = document.getElementById('confirmSaveTemplateBtn');
            if (confirmSaveTemplateBtn) {
                confirmSaveTemplateBtn.addEventListener('click', confirmSaveTemplate);
            }
            
            const cancelSaveTemplateBtn = document.getElementById('cancelSaveTemplateBtn');
            if (cancelSaveTemplateBtn) {
                cancelSaveTemplateBtn.addEventListener('click', function() {
                    document.getElementById('saveTemplateForm').style.display = 'none';
                });
            }
            
            showToast("Funcionalidades adicionales inicializadas correctamente", "success");
        } catch (error) {
            console.error("Error al inicializar funcionalidades adicionales:", error);
            showToast("Error en la inicialización de funcionalidades: " + error.message, "error");
        }
    };
    
    // Si ya estamos después de la inicialización, aplicar directamente
    if (document.readyState === 'complete') {
        setupCommandShortcuts();
        loadCustomTemplates();
    }
});
        }

        // Inicializar la aplicación cuando el DOM esté cargado
        document.addEventListener('DOMContentLoaded', function() {
            initApp().catch(error => {
                console.error("Error al inicializar la aplicación:", error);
                showToast("Error crítico de inicialización: " + error.message, "error");
            });
        });


// Funciones para los botones de ejemplo
function showPatientStateExample() {
    const example = "Paciente refiere dolor lumbar de intensidad 6/10 en región L4-L5, con irradiación hacia EID°. Reporta mejoría desde última sesión (antes 8/10). Limitación para inclinarse hacia adelante y dificultad para permanecer sentado >30 minutos. Dolor aumenta al final del día y con actividades que implican flexión lumbar.";
    
    // Mostrar ejemplo en un modal pequeño
    showExampleModal("Ejemplo de Estado del Paciente", example, "evolutionPatientState");
}

function showTreatmentExample() {
    const example = "Terapia manual: Movilización de segmentos L4-L5, técnicas de presión isquémica en paravertebrales y piramidal derecho. Educación: posiciones durante el trabajo para el manejo sintomátologico.";
    
    showExampleModal("Ejemplo de Tratamiento", example, "evolutionTreatment");
}

function showResponseExample() {
    const example = "Respuesta favorable durante sesión. Dolor disminuyó de 6/10 a 3/10 post-tratamiento. Mejoró ROM lumbar en flexión. Sin eventos adversos. Paciente refiere mayor sensación de estabilidad al caminar. Se observa disminución de tensión en musculatura paravertebral. Persistente limitación leve para movimientos rotacionales.";
    
    showExampleModal("Ejemplo de Respuesta al Tratamiento", example, "evolutionResponse");
}

// Función para mostrar el modal con ejemplo
function showExampleModal(title, text, targetFieldId) {
    // Crear modal para mostrar ejemplo
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.id = 'exampleModal';
    modalDiv.style.zIndex = '2000';
    
    modalDiv.innerHTML = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" onclick="document.getElementById('exampleModal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>${text}</p>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="action-btn btn-secondary" onclick="document.getElementById('exampleModal').remove()">Cerrar</button>
                    <button class="action-btn btn-primary" onclick="useExample('${text}', '${targetFieldId}')">Usar este ejemplo</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
    setTimeout(() => modalDiv.classList.add('active'), 50);
}

// Función para usar el ejemplo
function useExample(text, fieldId) {
    document.getElementById(fieldId).value = text;
    document.getElementById('exampleModal').remove();
}

// Función para mostrar el modal con ejemplo
function showExampleModal(title, text, targetFieldId) {
    // Crear modal para mostrar ejemplo
    const modalDiv = document.createElement('div');
    modalDiv.className = 'modal-overlay';
    modalDiv.id = 'exampleModal';
    modalDiv.style.zIndex = '2000';
    
    modalDiv.innerHTML = `
        <div class="modal" style="max-width: 600px;">
            <div class="modal-header">
                <h2 class="modal-title">${title}</h2>
                <button class="modal-close" onclick="document.getElementById('exampleModal').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <p>${text}</p>
                <div style="margin-top: 15px; text-align: right;">
                    <button class="action-btn btn-secondary" onclick="document.getElementById('exampleModal').remove()">Cerrar</button>
                    <button class="action-btn btn-primary" onclick="useExample('${text}', '${targetFieldId}')">Usar este ejemplo</button>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(modalDiv);
    setTimeout(() => modalDiv.classList.add('active'), 50);
}

// Función para usar el ejemplo
function useExample(text, fieldId) {
    document.getElementById(fieldId).value = text;
    document.getElementById('exampleModal').remove();
}

// Implementar comandos rápidos con "/texto"
function setupCommandShortcuts() {
    const fieldsToWatch = ['evolutionPatientState', 'evolutionTreatment', 'evolutionResponse'];
    
    fieldsToWatch.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (!field) return;
        
        field.addEventListener('input', function(e) {
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

// Ejecutar la configuración cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Llamar a setupCommandShortcuts después de que se inicialice la app
    const originalInitApp = initApp;
    initApp = function() {
        originalInitApp.apply(this, arguments).then(() => {
            setupCommandShortcuts();
            console.log("Comandos rápidos configurados");
        });
    };
});


// Sistema de plantillas de ejercicios personalizadas
let customTemplates = [];

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
                <button type="button" class="action-btn btn-secondary" style="padding: 5px 10px; margin-right: 5px;" onclick="loadCustomTemplate('${template.id}', true)">
                    <i class="fas fa-play"></i> Usar
                </button>
                <button type="button" class="action-btn btn-secondary" style="padding: 5px 10px; margin-right: 5px;" onclick="editCustomTemplate('${template.id}')">
                    <i class="fas fa-edit"></i> Editar
                </button>
                <button type="button" class="action-btn btn-secondary" style="padding: 5px 10px; background-color: var(--accent2-light);" onclick="deleteCustomTemplate('${template.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    
    container.appendChild(table);
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
        document.getElementById('templatesModal').classList.remove('active');
        setTimeout(() => {
            document.getElementById('templatesModal').style.display = 'none';
        }, 300);
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
    document.getElementById('saveTemplateForm').style.display = 'block';
    document.getElementById('templateNameInput').focus();
}

// Confirmar guardado de plantilla
function confirmSaveTemplate() {
    const name = document.getElementById('templateNameInput').value.trim();
    const category = document.getElementById('templateCategoryInput').value.trim();
    
    if (!name) {
        showToast("Debe ingresar un nombre para la plantilla", "error");
        return;
    }
    
    const exercises = getExercisesData();
    
    // Generar ID único
    const templateId = 'template_' + Date.now();
    
    // Crear objeto de plantilla
    const newTemplate = {
        id: templateId,
        name: name,
        category: category,
        exercises: exercises,
        createdAt: new Date().toISOString()
    };
    
    // Añadir a la lista de plantillas
    customTemplates.push(newTemplate);
    
    // Guardar en localStorage
    saveCustomTemplates();
    
    // Ocultar formulario
    document.getElementById('saveTemplateForm').style.display = 'none';
    document.getElementById('templateNameInput').value = '';
    document.getElementById('templateCategoryInput').value = '';
    
    showToast("Plantilla guardada correctamente", "success");
}

// Eliminar plantilla personalizada
function deleteCustomTemplate(templateId) {
    if (confirm('¿Está seguro que desea eliminar esta plantilla? Esta acción no se puede deshacer.')) {
        customTemplates = customTemplates.filter(t => t.id !== templateId);
        saveCustomTemplates();
        showToast("Plantilla eliminada correctamente", "success");
    }
}

// Editar plantilla personalizada (cargar y preparar para editar)
function editCustomTemplate(templateId) {
    // Primero cargar la plantilla
    loadCustomTemplate(templateId, true);
    
    // Luego mostrar el formulario para guardar con los datos precargados
    const template = customTemplates.find(t => t.id === templateId);
    if (template) {
        // Eliminar la plantilla original (será reemplazada)
        customTemplates = customTemplates.filter(t => t.id !== templateId);
        saveCustomTemplates();
        
        // Mostrar formulario con datos precargados
        document.getElementById('templateNameInput').value = template.name;
        document.getElementById('templateCategoryInput').value = template.category || '';
        document.getElementById('saveTemplateForm').style.display = 'block';
        
        showToast("Plantilla cargada para editar", "info");
    }
}

// Configurar eventos al cargar la página
document.addEventListener('DOMContentLoaded', function() {
    // Configurar el sistema de plantillas personalizadas
    const originalInitApp = initApp;
    initApp = function() {
        originalInitApp.apply(this, arguments).then(() => {
            loadCustomTemplates();
            
            // Botón para abrir modal de plantillas
            const manageTemplatesBtn = document.getElementById('manageTemplatesBtn');
            if (manageTemplatesBtn) {
                manageTemplatesBtn.addEventListener('click', function() {
                    const modal = document.getElementById('templatesModal');
                    if (modal) {
                        modal.style.display = 'block';
                        setTimeout(() => modal.classList.add('active'), 50);
                    }
                });
            }
            
            // Botón para cerrar modal
            const closeTemplatesModalBtn = document.getElementById('closeTemplatesModal');
            if (closeTemplatesModalBtn) {
                closeTemplatesModalBtn.addEventListener('click', function() {
                    const modal = document.getElementById('templatesModal');
                    if (modal) {
                        modal.classList.remove('active');
                        setTimeout(() => modal.style.display = 'none', 300);
                    }
                });
            }
            
            // Botón para guardar ejercicios actuales como plantilla
            const saveCurrentAsTemplateBtn = document.getElementById('saveCurrentAsTemplateBtn');
            if (saveCurrentAsTemplateBtn) {
                saveCurrentAsTemplateBtn.addEventListener('click', saveCurrentExercisesAsTemplate);
            }
            
            // Botón para confirmar guardado de plantilla
            const confirmSaveTemplateBtn = document.getElementById('confirmSaveTemplateBtn');
            if (confirmSaveTemplateBtn) {
                confirmSaveTemplateBtn.addEventListener('click', confirmSaveTemplate);
            }
            
            // Botón para cancelar guardado de plantilla
            const cancelSaveTemplateBtn = document.getElementById('cancelSaveTemplateBtn');
            if (cancelSaveTemplateBtn) {
                cancelSaveTemplateBtn.addEventListener('click', function() {
                    document.getElementById('saveTemplateForm').style.display = 'none';
                    document.getElementById('templateNameInput').value = '';
                    document.getElementById('templateCategoryInput').value = '';
                });
            }
            
            console.log("Sistema de plantillas personalizadas inicializado");
        });
    };
});

        // Funciones para los botones de ejemplo
function showPatientStateExample() {
    alert("Ejemplo de Estado del Paciente:\n\nPaciente refiere dolor lumbar de intensidad 6/10 en región L4-L5, con irradiación hacia MID. Reporta mejoría desde última sesión (antes 8/10). Limitación para inclinarse hacia adelante y dificultad para permanecer sentado >30 minutos.");
}

function showTreatmentExample() {
    alert("Ejemplo de Tratamiento:\n\nTerapia manual: Movilización de segmentos L4-L5, técnicas de liberación miofascial en paravertebrales.\nEjercicios: Estabilización core (3x10), puente glúteo (3x15).\nAgente físico: Compresas húmedo-calientes 15 min previo a manipulación.\nEducación: Pautas ergonómicas para posición sentada.");
}

function showResponseExample() {
    alert("Ejemplo de Respuesta al Tratamiento:\n\nRespuesta favorable durante sesión. Dolor disminuyó de 6/10 a 3/10 post-tratamiento. Mejoró ROM lumbar en flexión. Sin eventos adversos. Paciente refiere mayor sensación de estabilidad al caminar.");
}

// Inicializar los manejadores de eventos una vez que se carga la página
document.addEventListener('DOMContentLoaded', function() {
    // Botón para abrir modal de plantillas personalizadas
    const manageTemplatesBtn = document.getElementById('manageCustomTemplatesBtn');
    if (manageTemplatesBtn) {
        manageTemplatesBtn.addEventListener('click', showCustomTemplatesModal);
    }
    
    // Botón para cerrar modal
    const closeCustomTemplatesModalBtn = document.getElementById('closeCustomTemplatesModal');
    if (closeCustomTemplatesModalBtn) {
        closeCustomTemplatesModalBtn.addEventListener('click', function() {
            document.getElementById('customTemplatesModal').classList.remove('active');
        });
    }
    
    // Botón para guardar ejercicios actuales como plantilla
    const saveCurrentAsTemplateBtn = document.getElementById('saveCurrentAsTemplateBtn');
    if (saveCurrentAsTemplateBtn) {
        saveCurrentAsTemplateBtn.addEventListener('click', saveCurrentExercisesAsTemplate);
    }
    
    // Botón para confirmar guardado de plantilla
    const confirmSaveTemplateBtn = document.getElementById('confirmSaveTemplateBtn');
    if (confirmSaveTemplateBtn) {
        confirmSaveTemplateBtn.addEventListener('click', confirmSaveTemplate);
    }
    
    // Botón para cancelar guardado de plantilla
    const cancelSaveTemplateBtn = document.getElementById('cancelSaveTemplateBtn');
    if (cancelSaveTemplateBtn) {
        cancelSaveTemplateBtn.addEventListener('click', function() {
            document.getElementById('saveTemplateForm').style.display = 'none';
        });
    }
});

        
    </script>
