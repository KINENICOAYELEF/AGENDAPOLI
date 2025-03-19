import { db, auth } from './firebase-config.js';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  getDocs, 
  getDoc, 
  query, 
  where, 
  orderBy,
  Timestamp,
  onSnapshot
} from 'firebase/firestore';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged 
} from 'firebase/auth';

// Colecciones de Firestore
const PATIENTS_COLLECTION = 'patients';
const APPOINTMENTS_COLLECTION = 'appointments';
const EVALUATIONS_COLLECTION = 'evaluations';
const USERS_COLLECTION = 'users';
const HOLIDAYS_COLLECTION = 'holidays';
const COLOR_CODES_COLLECTION = 'colorCodes';
const BLOCKED_TIMES_COLLECTION = 'blockedTimes';

// Referencias globales
let currentUser = null;
let currentWeek = new Date();
let viewMode = 'week';
let isAdmin = false;
let patients = [];
let appointments = [];
let evaluations = [];
let colorCodes = [];
let blockedTimes = [];
let holidays = [];

// Estado de arrastrar y soltar
let draggedAppointment = null;

// Días de la semana en español
const weekDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Inicialización cuando el DOM está listo
document.addEventListener('DOMContentLoaded', () => {
  initializeApp();
});

// Inicialización de la aplicación
function initializeApp() {
  // Verificar autenticación
  onAuthStateChanged(auth, (user) => {
    if (user) {
      currentUser = user;
      checkUserRole();
      loadData();
      setupEventListeners();
      showView('agenda');
    } else {
      // Si no hay usuario autenticado, redireccionar al login
      handleLogout();
    }
  });

  // Login temporal (en producción esto debería estar en otra página)
  // tempLogin('admin@example.com', 'password123');
}

// Función temporal para iniciar sesión (remover en producción)
async function tempLogin(email, password) {
  try {
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Error en inicio de sesión:', error);
    showNotification('Error al iniciar sesión: ' + error.message, 'error');
  }
}

// Verificar rol del usuario
async function checkUserRole() {
  try {
    const userRef = doc(db, USERS_COLLECTION, currentUser.uid);
    const userSnap = await getDoc(userRef);
    
    if (userSnap.exists()) {
      const userData = userSnap.data();
      isAdmin = userData.role === 'admin';
      document.getElementById('user-name').textContent = userData.name || currentUser.email;
    } else {
      // Si el usuario no existe en la colección de usuarios, crear uno con rol básico
      await addDoc(collection(db, USERS_COLLECTION), {
        uid: currentUser.uid,
        email: currentUser.email,
        name: currentUser.displayName || currentUser.email.split('@')[0],
        role: 'basic',
        createdAt: Timestamp.now()
      });
      isAdmin = false;
    }
    
    // Ajustar UI según el rol
    updateUIBasedOnRole();
  } catch (error) {
    console.error('Error al verificar rol de usuario:', error);
    showNotification('Error al cargar datos de usuario', 'error');
  }
}

// Actualizar UI según el rol del usuario
function updateUIBasedOnRole() {
  const adminElements = document.querySelectorAll('.admin-only');
  adminElements.forEach(el => {
    el.style.display = isAdmin ? 'block' : 'none';
  });
}

// Cargar datos iniciales
async function loadData() {
  try {
    await Promise.all([
      loadPatients(),
      loadAppointments(),
      loadColorCodes(),
      loadBlockedTimes(),
      loadHolidays()
    ]);
    
    renderAgenda();
    renderPatientsList();
    initializeCharts();
    
    // Configurar escuchas en tiempo real para actualizar datos
    setupRealTimeListeners();
  } catch (error) {
    console.error('Error al cargar datos iniciales:', error);
    showNotification('Error al cargar datos', 'error');
  }
}

// Configurar escuchas en tiempo real
function setupRealTimeListeners() {
  // Escuchar cambios en citas
  onSnapshot(collection(db, APPOINTMENTS_COLLECTION), (snapshot) => {
    const changes = snapshot.docChanges();
    let shouldUpdateAgenda = false;
    
    changes.forEach(change => {
      if (change.type === 'added' || change.type === 'modified' || change.type === 'removed') {
        shouldUpdateAgenda = true;
      }
    });
    
    if (shouldUpdateAgenda) {
      loadAppointments().then(() => {
        renderAgenda();
        updateChartsData();
      });
    }
  });
  
  // Escuchar cambios en pacientes
  onSnapshot(collection(db, PATIENTS_COLLECTION), (snapshot) => {
    loadPatients().then(() => {
      renderPatientsList();
      populatePatientSelects();
    });
  });
}

// Configurar los event listeners
function setupEventListeners() {
  // Navegación entre vistas
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const view = e.target.dataset.view;
      showView(view);
    });
  });
  
  // Navegación de fechas
  document.getElementById('prev-week').addEventListener('click', () => navigateWeek(-1));
  document.getElementById('next-week').addEventListener('click', () => navigateWeek(1));
  
  // Cambio de modo de vista
  document.getElementById('view-mode').addEventListener('change', (e) => {
    viewMode = e.target.value;
    renderAgenda();
  });
  
  // Botones de acción
  document.getElementById('add-block-btn').addEventListener('click', () => showModal('patient-modal'));
  document.getElementById('block-time-btn').addEventListener('click', () => showModal('block-time-modal'));
  document.getElementById('add-patient-btn').addEventListener('click', () => showModal('patient-modal'));
  document.getElementById('export-patients-btn').addEventListener('click', exportPatientsData);
  document.getElementById('export-stats-btn').addEventListener('click', exportStatistics);
  
  // Cerrar modales
  document.querySelectorAll('.close-modal, .cancel-btn').forEach(el => {
    el.addEventListener('click', closeAllModals);
  });
  
  // Formularios
  document.getElementById('patient-form').addEventListener('submit', handlePatientFormSubmit);
  document.getElementById('appointment-form').addEventListener('submit', handleAppointmentFormSubmit);
  document.getElementById('evaluation-form').addEventListener('submit', handleEvaluationFormSubmit);
  document.getElementById('block-time-form').addEventListener('submit', handleBlockTimeFormSubmit);
  
  // Eliminar cita
  document.getElementById('delete-appointment-btn').addEventListener('click', deleteAppointment);
  
  // Eliminar evaluación
  document.getElementById('delete-evaluation-btn').addEventListener('click', deleteEvaluation);
  
  // Búsqueda de pacientes
  document.getElementById('search-patient').addEventListener('input', filterPatients);
  
  // Logout
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

// Cargar pacientes
async function loadPatients() {
  try {
    const patientsSnapshot = await getDocs(collection(db, PATIENTS_COLLECTION));
    patients = [];
    patientsSnapshot.forEach(doc => {
      patients.push({
        id: doc.id,
        ...doc.data()
      });
    });
    return patients;
  } catch (error) {
    console.error('Error al cargar pacientes:', error);
    showNotification('Error al cargar lista de pacientes', 'error');
    throw error;
  }
}

// Cargar citas
async function loadAppointments() {
  try {
    const appointmentsSnapshot = await getDocs(collection(db, APPOINTMENTS_COLLECTION));
    appointments = [];
    appointmentsSnapshot.forEach(doc => {
      const data = doc.data();
      // Convertir los timestamps a objetos Date para facilitar su manejo
      const appointmentDate = data.date.toDate ? data.date.toDate() : new Date(data.date);
      appointments.push({
        id: doc.id,
        ...data,
        date: appointmentDate
      });
    });
    return appointments;
  } catch (error) {
    console.error('Error al cargar citas:', error);
    showNotification('Error al cargar agenda', 'error');
    throw error;
  }
}

// Cargar bloques de tiempo bloqueados
async function loadBlockedTimes() {
  try {
    const blockedTimesSnapshot = await getDocs(collection(db, BLOCKED_TIMES_COLLECTION));
    blockedTimes = [];
    blockedTimesSnapshot.forEach(doc => {
      const data = doc.data();
      blockedTimes.push({
        id: doc.id,
        ...data,
        startTime: data.startTime.toDate ? data.startTime.toDate() : new Date(data.startTime),
        endTime: data.endTime.toDate ? data.endTime.toDate() : new Date(data.endTime)
      });
    });
    return blockedTimes;
  } catch (error) {
    console.error('Error al cargar tiempos bloqueados:', error);
    showNotification('Error al cargar bloques de tiempo', 'error');
    throw error;
  }
}

// Cargar códigos de color
async function loadColorCodes() {
  try {
    const colorCodesSnapshot = await getDocs(collection(db, COLOR_CODES_COLLECTION));
    colorCodes = [];
    colorCodesSnapshot.forEach(doc => {
      colorCodes.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Si no hay códigos de color, crear algunos por defecto
    if (colorCodes.length === 0) {
      await initializeDefaultColorCodes();
      return loadColorCodes();
    }
    
    return colorCodes;
  } catch (error) {
    console.error('Error al cargar códigos de color:', error);
    showNotification('Error al cargar configuración de colores', 'error');
    throw error;
  }
}

// Inicializar códigos de color por defecto
async function initializeDefaultColorCodes() {
  const defaultCodes = [
    { name: 'Evaluación', color: '#9b59b6', type: 'evaluation' },
    { name: 'Paciente nuevo', color: '#2ecc71', type: 'new-patient' },
    { name: 'Urgente', color: '#e74c3c', type: 'urgent' },
    { name: 'Seguimiento', color: '#f39c12', type: 'follow-up' },
    { name: 'Regular', color: '#3498db', type: 'regular' }
  ];
  
  try {
    for (const code of defaultCodes) {
      await addDoc(collection(db, COLOR_CODES_COLLECTION), code);
    }
    showNotification('Códigos de color inicializados', 'success');
  } catch (error) {
    console.error('Error al inicializar códigos de color:', error);
    showNotification('Error al crear códigos de color por defecto', 'error');
  }
}

// Cargar días feriados
async function loadHolidays() {
  try {
    const holidaysSnapshot = await getDocs(collection(db, HOLIDAYS_COLLECTION));
    holidays = [];
    holidaysSnapshot.forEach(doc => {
      const data = doc.data();
      holidays.push({
        id: doc.id,
        ...data,
        date: data.date.toDate ? data.date.toDate() : new Date(data.date)
      });
    });
    return holidays;
  } catch (error) {
    console.error('Error al cargar días feriados:', error);
    showNotification('Error al cargar días feriados', 'error');
    throw error;
  }
}

// Renderizar la agenda
function renderAgenda() {
  const weeklyGrid = document.getElementById('weekly-grid');
  weeklyGrid.innerHTML = '';
  
  // Generar el rango de fechas para la semana actual
  const weekDates = getWeekDates(currentWeek);
  updateWeekDisplay(weekDates);
  
  // Crear columnas para cada día
  weekDates.forEach(date => {
    const dayColumn = createDayColumn(date);
    weeklyGrid.appendChild(dayColumn);
  });
  
  // Habilitar funcionalidad de arrastrar y soltar
  enableDragAndDrop();
}

// Obtener las fechas de la semana
function getWeekDates(referenceDate) {
  const dates = [];
  const startDate = new Date(referenceDate);
  
  // Ajustar al inicio de la semana (lunes)
  const day = startDate.getDay();
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1);
  startDate.setDate(diff);
  
  // Generar las 7 fechas de la semana
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    dates.push(currentDate);
  }
  
  return dates;
}

// Actualizar la visualización de la semana actual
function updateWeekDisplay(weekDates) {
  const startDate = weekDates[0];
  const endDate = weekDates[6];
  
  const startDay = startDate.getDate();
  const startMonth = monthNames[startDate.getMonth()];
  const endDay = endDate.getDate();
  const endMonth = monthNames[endDate.getMonth()];
  const year = endDate.getFullYear();
  
  let displayText = `Semana del ${startDay}`;
  if (startMonth !== endMonth) {
    displayText += ` de ${startMonth}`;
  }
  displayText += ` al ${endDay} de ${endMonth}, ${year}`;
  
  document.getElementById('current-week-display').textContent = displayText;
}

// Crear una columna para un día específico
function createDayColumn(date) {
  const dayColumn = document.createElement('div');
  dayColumn.className = 'day-column';
  
  // Encabezado del día
  const dayHeader = document.createElement('div');
  dayHeader.className = 'day-header';
  
  const dayName = document.createElement('div');
  dayName.className = 'day-name';
  dayName.textContent = weekDays[date.getDay()];
  
  const dayDate = document.createElement('div');
  dayDate.className = 'day-date';
  dayDate.textContent = `${date.getDate()} ${monthNames[date.getMonth()]}`;
  
  dayHeader.appendChild(dayName);
  dayHeader.appendChild(dayDate);
  dayColumn.appendChild(dayHeader);
  
  // Verificar si es día feriado
  const isHoliday = holidays.some(holiday => {
    const holidayDate = holiday.date;
    return holidayDate.getDate() === date.getDate() && 
           holidayDate.getMonth() === date.getMonth() &&
           holidayDate.getFullYear() === date.getFullYear();
  });
  
  if (isHoliday) {
    dayColumn.classList.add('holiday');
    const holiday = holidays.find(h => {
      const hDate = h.date;
      return hDate.getDate() === date.getDate() && 
             hDate.getMonth() === date.getMonth() &&
             hDate.getFullYear() === date.getFullYear();
    });
    
    const holidayIndicator = document.createElement('div');
    holidayIndicator.className = 'holiday-indicator';
    holidayIndicator.textContent = holiday.name;
    dayHeader.appendChild(holidayIndicator);
  }
  
  // Horas del día (8:00 - 18:00)
  for (let hour = 8; hour <= 18; hour++) {
    const timeSlot = document.createElement('div');
    timeSlot.className = 'time-slot';
    timeSlot.dataset.hour = hour;
    timeSlot.dataset.date = date.toISOString();
    
    // Evento para agregar cita al hacer clic en un espacio vacío
    timeSlot.addEventListener('click', (e) => {
      if (e.target === timeSlot) { // Solo si se hizo clic en el espacio vacío, no en una cita
        openNewAppointmentModal(date, hour);
      }
    });
    
    // Renderizar citas para esta hora y fecha
    renderAppointmentsForTimeSlot(timeSlot, date, hour);
    
    // Renderizar tiempos bloqueados
    renderBlockedTimesForSlot(timeSlot, date, hour);
    
    dayColumn.appendChild(timeSlot);
  }
  
  return dayColumn;
}

// Renderizar citas para un slot de tiempo específico
function renderAppointmentsForTimeSlot(timeSlot, date, hour) {
  // Filtrar citas para esta fecha y hora
  const slotAppointments = appointments.filter(appointment => {
    const appointmentDate = appointment.date;
    const appointmentHour = appointmentDate.getHours();
    
    return appointmentDate.getDate() === date.getDate() && 
           appointmentDate.getMonth() === date.getMonth() &&
           appointmentDate.getFullYear() === date.getFullYear() &&
           appointmentHour === hour;
  });
  
  // Crear elementos para cada cita
  slotAppointments.forEach(appointment => {
    const appointmentElement = createAppointmentElement(appointment);
    timeSlot.appendChild(appointmentElement);
  });
}

// Crear elemento para una cita
function createAppointmentElement(appointment) {
  const appointmentEl = document.createElement('div');
  appointmentEl.className = 'appointment';
  appointmentEl.dataset.id = appointment.id;
  appointmentEl.draggable = true;
  
  // Agregar clase según el tipo (si existe)
  if (appointment.type) {
    appointmentEl.classList.add(appointment.type);
  }
  
  // Buscar paciente relacionado
  const patient = patients.find(p => p.id === appointment.patientId);
  const patientName = patient ? patient.name : 'Paciente no encontrado';
  
  const nameEl = document.createElement('div');
  nameEl.className = 'patient-name';
  nameEl.textContent = patientName;
  
  const timeEl = document.createElement('div');
  timeEl.className = 'appointment-time';
  timeEl.textContent = `${formatTime(appointment.date)} - ${appointment.duration} min`;
  
  // Indicador de asistencia
  const attendanceIndicator = document.createElement('div');
  attendanceIndicator.className = `attendance-indicator ${appointment.attendance || 'pending'}`;
  
  appointmentEl.appendChild(nameEl);
  appointmentEl.appendChild(timeEl);
  appointmentEl.appendChild(attendanceIndicator);
  
  // Evento para abrir modal de cita
  appointmentEl.addEventListener('click', () => openAppointmentModal(appointment.id));
  
  // Eventos para arrastrar y soltar
  appointmentEl.addEventListener('dragstart', handleDragStart);
  
  return appointmentEl;
}

// Renderizar tiempos bloqueados
function renderBlockedTimesForSlot(timeSlot, date, hour) {
  // Filtrar bloques que intersectan con este slot
  const intersectingBlocks = blockedTimes.filter(block => {
    const blockStartDate = block.startTime;
    const blockEndDate = block.endTime;
    
    // Verificar si la fecha coincide
    const dateMatches = 
      blockStartDate.getDate() === date.getDate() && 
      blockStartDate.getMonth() === date.getMonth() &&
      blockStartDate.getFullYear() === date.getFullYear();
    
    if (!dateMatches) return false;
    
    // Verificar si la hora está dentro del rango bloqueado
    const blockStartHour = blockStartDate.getHours();
    const blockEndHour = blockEndDate.getHours();
    
    return hour >= blockStartHour && hour < blockEndHour;
  });
  
  // Si hay bloques intersectantes, mostrar indicador
  if (intersectingBlocks.length > 0) {
    const block = intersectingBlocks[0]; // Tomamos el primero si hay varios
    
    const blockedEl = document.createElement('div');
    blockedEl.className = 'blocked-time';
    blockedEl.textContent = block.reason || 'Horario bloqueado';
    
    timeSlot.appendChild(blockedEl);
    timeSlot.classList.add('blocked');
  }
}

// Habilitar funcionalidad de arrastrar y soltar
function enableDragAndDrop() {
  // Agregar listeners a los slots de tiempo
  document.querySelectorAll('.time-slot').forEach(slot => {
    slot.addEventListener('dragover', handleDragOver);
    slot.addEventListener('drop', handleDrop);
  });
}

// Handler para iniciar arrastre
function handleDragStart(e) {
  draggedAppointment = {
    id: e.target.dataset.id,
    element: e.target
  };
  
  // Agregar efecto visual
  e.target.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
}

// Handler para el evento dragover
function handleDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  return false;
}

// Handler para el evento drop
async function handleDrop(e) {
  e.preventDefault();
  
  if (!draggedAppointment) return;
  
  // Eliminar clase de arrastre
  draggedAppointment.element.classList.remove('dragging');
  
  // Obtener información del slot donde se soltó
  const targetSlot = e.currentTarget;
  const targetDate = new Date(targetSlot.dataset.date);
  const targetHour = parseInt(targetSlot.dataset.hour);
  
  // Buscar la cita que se está moviendo
  const appointment = appointments.find(a => a.id === draggedAppointment.id);
  if (!appointment) return;
  
  // Crear nueva fecha para la cita
  const newDate = new Date(targetDate);
  newDate.setHours(targetHour);
  newDate.setMinutes(appointment.date.getMinutes());
  
  try {
    // Actualizar la cita en Firestore
    const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointment.id);
    await updateDoc(appointmentRef, {
      date: Timestamp.fromDate(newDate)
    });
    
    showNotification('Cita reubicada correctamente', 'success');
  } catch (error) {
    console.error('Error al reubicar cita:', error);
    showNotification('Error al reubicar la cita', 'error');
  }
  
  // Resetear variable de arrastre
  draggedAppointment = null;
}

// Abrir modal para crear nueva cita
function openNewAppointmentModal(date, hour) {
  const modal = document.getElementById('appointment-modal');
  const modalTitle = document.getElementById('appointment-modal-title');
  const form = document.getElementById('appointment-form');
  const dateInput = document.getElementById('appointment-date');
  const timeInput = document.getElementById('appointment-time');
  const deleteBtn = document.getElementById('delete-appointment-btn');
  
  // Configurar modal para nueva cita
  modalTitle.textContent = 'Nueva Cita';
  form.dataset.id = '';
  form.reset();
  
  // Establecer fecha y hora seleccionadas
  const formattedDate = formatDateForInput(date);
  dateInput.value = formattedDate;
  
  const formattedTime = `${hour.toString().padStart(2, '0')}:00`;
  timeInput.value = formattedTime;
  
  // Ocultar botón de eliminar para nueva cita
  deleteBtn.style.display = 'none';
  
  // Poblar select de pacientes
  populatePatientSelects();
  
  // Mostrar modal
  showModal('appointment-modal');
}

// Abrir modal para editar cita existente
async function openAppointmentModal(appointmentId) {
  const modal = document.getElementById('appointment-modal');
  const modalTitle = document.getElementById('appointment-modal-title');
  const form = document.getElementById('appointment-form');
  const deleteBtn = document.getElementById('delete-appointment-btn');
  
  // Buscar la cita
  const appointment = appointments.find(a => a.id === appointmentId);
  if (!appointment) return;
  
  // Configurar modal para editar cita
  modalTitle.textContent = 'Editar Cita';
  form.dataset.id = appointmentId;
  
  // Poblar select de pacientes antes de establecer valores
  await populatePatientSelects();
  
  // Establecer valores del formulario
  document.getElementById('appointment-patient').value = appointment.patientId;
  document.getElementById('appointment-date').value = formatDateForInput(appointment.date);
  document.getElementById('appointment-time').value = formatTimeForInput(appointment.date);
  document.getElementById('appointment-duration').value = appointment.duration || 60;
  document.getElementById('appointment-notes').value = appointment.notes || '';
  document.getElementById('appointment-recurrence').value = appointment.recurrence || 'none';
  document.getElementById('appointment-attendance').value = appointment.attendance || 'pending';
  
  // Mostrar botón de eliminar
  deleteBtn.style.display = 'block';
  
  // Mostrar modal
  showModal('appointment-modal');
}

// Manejar envío del formulario de cita
async function handleAppointmentFormSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const appointmentId = form.dataset.id;
  const isNewAppointment = !appointmentId;
  
  // Obtener valores del formulario
  const patientId = document.getElementById('appointment-patient').value;
  const dateStr = document.getElementById('appointment-date').value;
  const timeStr = document.getElementById('appointment-time').value;
  const duration = parseInt(document.getElementById('appointment-duration').value);
  const notes = document.getElementById('appointment-notes').value;
  const recurrence = document.getElementById('appointment-recurrence').value;
  const attendance = document.getElementById('appointment-attendance').value;
  
  // Crear objeto Date a partir de fecha y hora
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = timeStr.split(':').map(Number);
  const date = new Date(year, month - 1, day, hours, minutes);
  
  try {
    // Datos de la cita
    const appointmentData = {
      patientId,
      date: Timestamp.fromDate(date),
      duration,
      notes,
      recurrence,
      attendance,
      createdBy: currentUser.uid,
      updatedAt: Timestamp.now()
    };
    
    if (isNewAppointment) {
      // Crear nueva cita
      appointmentData.createdAt = Timestamp.now();
      await addDoc(collection(db, APPOINTMENTS_COLLECTION), appointmentData);
      showNotification('Cita creada correctamente', 'success');
    } else {
      // Actualizar cita existente
      const appointmentRef = doc(db, APPOINTMENTS_COLLECTION, appointmentId);
      await updateDoc(appointmentRef, appointmentData);
      showNotification('Cita actualizada correctamente', 'success');
    }
    
    // Si hay recurrencia, crear citas adicionales
    if (recurrence !== 'none' && isNewAppointment) {
      await createRecurringAppointments(appointmentData, recurrence);
    }
    
    // Cerrar modal y actualizar vista
    closeAllModals();
  } catch (error) {
    console.error('Error al guardar cita:', error);
    showNotification('Error al guardar la cita', 'error');
  }
}

// Crear citas recurrentes
async function createRecurringAppointments(baseAppointment, recurrence) {
  const baseDate = baseAppointment.date.toDate();
  const recurringAppointments = [];
  
  // Determinar incremento según tipo de recurrencia
  let dateIncrement;
  let maxRecurrences;
  
  switch (recurrence) {
    case 'daily':
      dateIncrement = day => new Date(day.setDate(day.getDate() + 1));
      maxRecurrences = 30; // Un mes de citas diarias
      break;
    case 'weekly':
      dateIncrement = day => new Date(day.setDate(day.getDate() + 7));
      maxRecurrences = 12; // Tres meses de citas semanales
      break;
    case 'monthly':
      dateIncrement = day => new Date(day.setMonth(day.getMonth() + 1));
      maxRecurrences = 6; // Seis meses de citas mensuales
      break;
    default:
      return; // No hay recurrencia, salir
  }
  
  let currentDate = dateIncrement(new Date(baseDate));
  
  // Crear citas recurrentes
  for (let i = 0; i < maxRecurrences; i++) {
    // Verificar si el día es feriado
    const isHoliday = holidays.some(holiday => {
      const holidayDate = holiday.date;
      return holidayDate.getDate() === currentDate.getDate() && 
             holidayDate.getMonth() === currentDate.getMonth();
    });
    
    // Solo crear cita si no es feriado
    if (!isHoliday) {
      const appointmentData = {
        ...baseAppointment,
        date: Timestamp.fromDate(currentDate),
        createdAt: Timestamp.now(),
        isRecurring: true,
        parentAppointmentId: baseAppointment.id
      };
      
      recurringAppointments.push(appointmentData);
    }
    
    // Avanzar a la siguiente fecha
    currentDate = dateIncrement(new Date(currentDate));
  }
  
  // Guardar citas recurrentes en batch
  try {
    for (const appointment of recurringAppointments) {
      await addDoc(collection(db, APPOINTMENTS_COLLECTION), appointment);
    }
    
    showNotification(`Se crearon ${recurringAppointments.length} citas recurrentes`, 'success');
  } catch (error) {
    console.error('Error al crear citas recurrentes:', error);
    showNotification('Error al crear citas recurrentes', 'error');
  }
}

// Eliminar una cita
async function deleteAppointment() {
  const form = document.getElementById('appointment-form');
  const appointmentId = form.dataset.id;
  
  if (!appointmentId) return;
  
  if (confirm('¿Está seguro de eliminar esta cita?')) {
    try {
      await deleteDoc(doc(db, APPOINTMENTS_COLLECTION, appointmentId));
      showNotification('Cita eliminada correctamente', 'success');
      closeAllModals();
    } catch (error) {
      console.error('Error al eliminar cita:', error);
      showNotification('Error al eliminar la cita', 'error');
    }
  }
}

// Manejar envío del formulario de paciente
async function handlePatientFormSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const patientId = form.dataset.id;
  const isNewPatient = !patientId;
  
  // Obtener valores del formulario
  const name = document.getElementById('patient-name').value;
  const rut = document.getElementById('patient-rut').value;
  const phone = document.getElementById('patient-phone').value;
  const email = document.getElementById('patient-email').value;
  const diagnosis = document.getElementById('patient-diagnosis').value;
  const notes = document.getElementById('patient-notes').value;
  const status = document.getElementById('patient-status').value;
  const colorCode = document.getElementById('patient-color').value;
  
  try {
    // Datos del paciente
    const patientData = {
      name,
      rut,
      phone,
      email,
      diagnosis,
      notes,
      status,
      colorCode,
      updatedAt: Timestamp.now(),
      updatedBy: currentUser.uid
    };
    
    if (isNewPatient) {
      // Crear nuevo paciente
      patientData.createdAt = Timestamp.now();
      patientData.createdBy = currentUser.uid;
      await addDoc(collection(db, PATIENTS_COLLECTION), patientData);
      showNotification('Paciente creado correctamente', 'success');
    } else {
      // Actualizar paciente existente
      const patientRef = doc(db, PATIENTS_COLLECTION, patientId);
      await updateDoc(patientRef, patientData);
      showNotification('Paciente actualizado correctamente', 'success');
    }
    
    // Cerrar modal y actualizar vista
    closeAllModals();
    await loadPatients();
    renderPatientsList();
  } catch (error) {
    console.error('Error al guardar paciente:', error);
    showNotification('Error al guardar datos del paciente', 'error');
  }
}

// Manejar envío del formulario de evaluación
async function handleEvaluationFormSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const evaluationId = form.dataset.id;
  const isNewEvaluation = !evaluationId;
  
  // Obtener valores del formulario
  const patientId = document.getElementById('evaluation-patient').value;
  const dateStr = document.getElementById('evaluation-date').value;
  const type = document.getElementById('evaluation-type').value;
  const notes = document.getElementById('evaluation-notes').value;
  const findings = document.getElementById('evaluation-findings').value;
  const plan = document.getElementById('evaluation-plan').value;
  
  // Crear objeto Date a partir de fecha
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  
  try {
    // Datos de la evaluación
    const evaluationData = {
      patientId,
      date: Timestamp.fromDate(date),
      type,
      notes,
      findings,
      plan,
      createdBy: currentUser.uid,
      updatedAt: Timestamp.now()
    };
    
    if (isNewEvaluation) {
      // Crear nueva evaluación
      evaluationData.createdAt = Timestamp.now();
      await addDoc(collection(db, EVALUATIONS_COLLECTION), evaluationData);
      showNotification('Evaluación registrada correctamente', 'success');
    } else {
      // Actualizar evaluación existente
      const evaluationRef = doc(db, EVALUATIONS_COLLECTION, evaluationId);
      await updateDoc(evaluationRef, evaluationData);
      showNotification('Evaluación actualizada correctamente', 'success');
    }
    
    // Cerrar modal
    closeAllModals();
  } catch (error) {
    console.error('Error al guardar evaluación:', error);
    showNotification('Error al guardar la evaluación', 'error');
  }
}

// Eliminar una evaluación
async function deleteEvaluation() {
  const form = document.getElementById('evaluation-form');
  const evaluationId = form.dataset.id;
  
  if (!evaluationId) return;
  
  if (confirm('¿Está seguro de eliminar esta evaluación?')) {
    try {
      await deleteDoc(doc(db, EVALUATIONS_COLLECTION, evaluationId));
      showNotification('Evaluación eliminada correctamente', 'success');
      closeAllModals();
    } catch (error) {
      console.error('Error al eliminar evaluación:', error);
      showNotification('Error al eliminar la evaluación', 'error');
    }
  }
}

// Manejar envío del formulario de bloqueo de tiempo
async function handleBlockTimeFormSubmit(e) {
  e.preventDefault();
  
  const form = e.target;
  const blockId = form.dataset.id;
  const isNewBlock = !blockId;
  
  // Obtener valores del formulario
  const dateStr = document.getElementById('block-date').value;
  const startTimeStr = document.getElementById('block-start-time').value;
  const endTimeStr = document.getElementById('block-end-time').value;
  const reason = document.getElementById('block-reason').value;
  const recurrence = document.getElementById('block-recurrence').value;
  
  // Crear objetos Date a partir de fecha y horas
  const [year, month, day] = dateStr.split('-').map(Number);
  const [startHours, startMinutes] = startTimeStr.split(':').map(Number);
  const [endHours, endMinutes] = endTimeStr.split(':').map(Number);
  
  const startTime = new Date(year, month - 1, day, startHours, startMinutes);
  const endTime = new Date(year, month - 1, day, endHours, endMinutes);
  
  // Validar que la hora de fin sea posterior a la de inicio
  if (endTime <= startTime) {
    showNotification('La hora de fin debe ser posterior a la hora de inicio', 'error');
    return;
  }
  
  try {
    // Datos del bloqueo
    const blockData = {
      startTime: Timestamp.fromDate(startTime),
      endTime: Timestamp.fromDate(endTime),
      reason,
      recurrence,
      createdBy: currentUser.uid,
      updatedAt: Timestamp.now()
    };
    
    if (isNewBlock) {
      // Crear nuevo bloqueo
      blockData.createdAt = Timestamp.now();
      await addDoc(collection(db, BLOCKED_TIMES_COLLECTION), blockData);
      showNotification('Horario bloqueado correctamente', 'success');
    } else {
      // Actualizar bloqueo existente
      const blockRef = doc(db, BLOCKED_TIMES_COLLECTION, blockId);
      await updateDoc(blockRef, blockData);
      showNotification('Bloqueo actualizado correctamente', 'success');
    }
    
    // Si hay recurrencia, crear bloqueos adicionales
    if (recurrence !== 'none' && isNewBlock) {
      await createRecurringBlocks(blockData, recurrence);
    }
    
    // Cerrar modal y actualizar vista
    closeAllModals();
    await loadBlockedTimes();
    renderAgenda();
  } catch (error) {
    console.error('Error al guardar bloqueo:', error);
    showNotification('Error al bloquear horario', 'error');
  }
}

// Crear bloqueos recurrentes
async function createRecurringBlocks(baseBlock, recurrence) {
  const baseStartTime = baseBlock.startTime.toDate();
  const baseEndTime = baseBlock.endTime.toDate();
  const recurringBlocks = [];
  
  // Determinar incremento según tipo de recurrencia
  let dateIncrement;
  let maxRecurrences;
  
  switch (recurrence) {
    case 'daily':
      dateIncrement = day => new Date(day.setDate(day.getDate() + 1));
      maxRecurrences = 30; // Un mes de bloqueos diarios
      break;
    case 'weekly':
      dateIncrement = day => new Date(day.setDate(day.getDate() + 7));
      maxRecurrences = 12; // Tres meses de bloqueos semanales
      break;
    case 'monthly':
      dateIncrement = day => new Date(day.setMonth(day.getMonth() + 1));
      maxRecurrences = 6; // Seis meses de bloqueos mensuales
      break;
    default:
      return; // No hay recurrencia, salir
  }
  
  // Crear fechas para bloqueos recurrentes
  for (let i = 0; i < maxRecurrences; i++) {
    const nextStartTime = dateIncrement(new Date(baseStartTime));
    baseStartTime.setTime(nextStartTime.getTime());
    
    const nextEndTime = dateIncrement(new Date(baseEndTime));
    baseEndTime.setTime(nextEndTime.getTime());
    
    // Verificar si el día es feriado
    const isHoliday = holidays.some(holiday => {
      const holidayDate = holiday.date;
      return holidayDate.getDate() === nextStartTime.getDate() && 
             holidayDate.getMonth() === nextStartTime.getMonth();
    });
    
    // Solo crear bloqueo si no es feriado
    if (!isHoliday) {
      const blockData = {
        ...baseBlock,
        startTime: Timestamp.fromDate(nextStartTime),
        endTime: Timestamp.fromDate(nextEndTime),
        createdAt: Timestamp.now(),
        isRecurring: true,
        parentBlockId: baseBlock.id
      };
      
      recurringBlocks.push(blockData);
    }
  }
  
  // Guardar bloqueos recurrentes
  try {
    for (const block of recurringBlocks) {
      await addDoc(collection(db, BLOCKED_TIMES_COLLECTION), block);
    }
    
    showNotification(`Se crearon ${recurringBlocks.length} bloqueos recurrentes`, 'success');
  } catch (error) {
    console.error('Error al crear bloqueos recurrentes:', error);
    showNotification('Error al crear bloqueos recurrentes', 'error');
  }
}

// Renderizar lista de pacientes
function renderPatientsList() {
  const patientsList = document.getElementById('patients-list');
  patientsList.innerHTML = '';
  
  patients.forEach(patient => {
    const row = document.createElement('tr');
    
    const nameCell = document.createElement('td');
    nameCell.textContent = patient.name;
    
    const rutCell = document.createElement('td');
    rutCell.textContent = patient.rut;
    
    const phoneCell = document.createElement('td');
    phoneCell.textContent = patient.phone || '-';
    
    const diagnosisCell = document.createElement('td');
    diagnosisCell.textContent = patient.diagnosis || '-';
    
    const statusCell = document.createElement('td');
    const statusSpan = document.createElement('span');
    statusSpan.className = `patient-status ${patient.status}`;
    statusSpan.textContent = formatStatus(patient.status);
    statusCell.appendChild(statusSpan);
    
    const lastVisitCell = document.createElement('td');
    lastVisitCell.textContent = getLastVisitDate(patient.id) || '-';
    
    const nextAppointmentCell = document.createElement('td');
    nextAppointmentCell.textContent = getNextAppointmentDate(patient.id) || '-';
    
    const actionsCell = document.createElement('td');
    actionsCell.className = 'patient-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'patient-action-btn edit';
    editBtn.innerHTML = '<i class="fas fa-edit"></i>';
    editBtn.addEventListener('click', () => openPatientModal(patient.id));
    
    const viewBtn = document.createElement('button');
    viewBtn.className = 'patient-action-btn view';
    viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    viewBtn.addEventListener('click', () => viewPatientDetails(patient.id));
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'patient-action-btn delete';
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.addEventListener('click', () => deletePatient(patient.id));
    
    actionsCell.appendChild(editBtn);
    actionsCell.appendChild(viewBtn);
    actionsCell.appendChild(deleteBtn);
    
    row.appendChild(nameCell);
    row.appendChild(rutCell);
    row.appendChild(phoneCell);
    row.appendChild(diagnosisCell);
    row.appendChild(statusCell);
    row.appendChild(lastVisitCell);
    row.appendChild(nextAppointmentCell);
    row.appendChild(actionsCell);
    
    patientsList.appendChild(row);
  });
}

// Obtener fecha de última visita para un paciente
function getLastVisitDate(patientId) {
  const patientAppointments = appointments.filter(a => 
    a.patientId === patientId && 
    a.attendance === 'attended' &&
    a.date < new Date()
  );
  
  if (patientAppointments.length === 0) return null;
  
  const sortedAppointments = patientAppointments.sort((a, b) => b.date - a.date);
  return formatDate(sortedAppointments[0].date);
}

// Obtener fecha de próxima cita para un paciente
function getNextAppointmentDate(patientId) {
  const now = new Date();
  const futureAppointments = appointments.filter(a => 
    a.patientId === patientId && 
    a.date > now
  );
  
  if (futureAppointments.length === 0) return null;
  
  const sortedAppointments = futureAppointments.sort((a, b) => a.date - b.date);
  return formatDate(sortedAppointments[0].date);
}

// Abrir modal para editar paciente
function openPatientModal(patientId) {
  const modal = document.getElementById('patient-modal');
  const modalTitle = document.getElementById('patient-modal-title');
  const form = document.getElementById('patient-form');
  
  if (patientId) {
    // Editar paciente existente
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;
    
    modalTitle.textContent = 'Editar Paciente';
    form.dataset.id = patientId;
    
    // Establecer valores del formulario
    document.getElementById('patient-name').value = patient.name;
    document.getElementById('patient-rut').value = patient.rut;
    document.getElementById('patient-phone').value = patient.phone || '';
    document.getElementById('patient-email').value = patient.email || '';
    document.getElementById('patient-diagnosis').value = patient.diagnosis || '';
    document.getElementById('patient-notes').value = patient.notes || '';
    document.getElementById('patient-status').value = patient.status;
    
    // Poblar y establecer código de color
    populateColorSelect();
    if (patient.colorCode) {
      document.getElementById('patient-color').value = patient.colorCode;
    }
  } else {
    // Nuevo paciente
    modalTitle.textContent = 'Nuevo Paciente';
    form.dataset.id = '';
    form.reset();
    
    // Poblar selects
    populateColorSelect();
  }
  
  showModal('patient-modal');
}

// Ver detalles de un paciente
function viewPatientDetails(patientId) {
  // Implementar vista detallada de paciente con historial de citas y evaluaciones
  // Por ahora redirigimos a editar
  openPatientModal(patientId);
}

// Eliminar un paciente
async function deletePatient(patientId) {
  if (confirm('¿Está seguro de eliminar este paciente? Esta acción no se puede deshacer.')) {
    try {
      // Verificar si el paciente tiene citas pendientes
      const patientAppointments = appointments.filter(a => 
        a.patientId === patientId && 
        a.date > new Date()
      );
      
      if (patientAppointments.length > 0) {
        if (!confirm(`Este paciente tiene ${patientAppointments.length} citas pendientes. ¿Desea eliminar el paciente y todas sus citas?`)) {
          return;
        }
        
        // Eliminar citas del paciente
        for (const appointment of patientAppointments) {
          await deleteDoc(doc(db, APPOINTMENTS_COLLECTION, appointment.id));
        }
      }
      
      // Eliminar paciente
      await deleteDoc(doc(db, PATIENTS_COLLECTION, patientId));
      showNotification('Paciente eliminado correctamente', 'success');
      
      // Recargar datos
      await loadPatients();
      await loadAppointments();
      renderPatientsList();
      renderAgenda();
    } catch (error) {
      console.error('Error al eliminar paciente:', error);
      showNotification('Error al eliminar el paciente', 'error');
    }
  }
}

// Navegar entre semanas
function navigateWeek(direction) {
  const newWeek = new Date(currentWeek);
  newWeek.setDate(newWeek.getDate() + (direction * 7));
  currentWeek = newWeek;
  renderAgenda();
}

// Filtrar pacientes
function filterPatients() {
  const searchInput = document.getElementById('search-patient');
  const query = searchInput.value.toLowerCase();
  
  const rows = document.querySelectorAll('#patients-table tbody tr');
  
  rows.forEach(row => {
    const name = row.cells[0].textContent.toLowerCase();
    const rut = row.cells[1].textContent.toLowerCase();
    const diagnosis = row.cells[3].textContent.toLowerCase();
    
    if (name.includes(query) || rut.includes(query) || diagnosis.includes(query)) {
      row.style.display = '';
    } else {
      row.style.display = 'none';
    }
  });
}

// Poblar select de pacientes
function populatePatientSelects() {
  const patientSelects = [
    document.getElementById('appointment-patient'),
    document.getElementById('evaluation-patient')
  ];
  
  patientSelects.forEach(select => {
    if (!select) return;
    
    // Guardar valor actual
    const currentValue = select.value;
    
    // Vaciar select
    select.innerHTML = '';
    
    // Opción vacía
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '-- Seleccionar paciente --';
    select.appendChild(emptyOption);
    
    // Agregar opciones para cada paciente
    patients.forEach(patient => {
      const option = document.createElement('option');
      option.value = patient.id;
      option.textContent = `${patient.name} (${patient.rut})`;
      select.appendChild(option);
    });
    
    // Restaurar valor actual si existe
    if (currentValue && select.querySelector(`option[value="${currentValue}"]`)) {
      select.value = currentValue;
    }
  });
}

// Poblar select de códigos de color
function populateColorSelect() {
  const colorSelect = document.getElementById('patient-color');
  if (!colorSelect) return;
  
  // Guardar valor actual
  const currentValue = colorSelect.value;
  
  // Vaciar select
  colorSelect.innerHTML = '';
  
  // Opción vacía
  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = '-- Ninguno --';
  colorSelect.appendChild(emptyOption);
  
  // Agregar opciones para cada código de color
  colorCodes.forEach(code => {
    const option = document.createElement('option');
    option.value = code.id;
    option.textContent = code.name;
    option.style.backgroundColor = code.color;
    colorSelect.appendChild(option);
  });
  
  // Restaurar valor actual si existe
  if (currentValue && colorSelect.querySelector(`option[value="${currentValue}"]`)) {
    colorSelect.value = currentValue;
  }
}

// Exportar datos de pacientes
function exportPatientsData() {
  // Preparar datos para exportar
  const exportData = patients.map(patient => {
    return {
      nombre: patient.name,
      rut: patient.rut,
      telefono: patient.phone || '',
      email: patient.email || '',
      diagnostico: patient.diagnosis || '',
      estado: formatStatus(patient.status),
      ultima_visita: getLastVisitDate(patient.id) || ''
    };
  });
  
  // Generar CSV
  let csv = 'Nombre,RUT,Teléfono,Email,Diagnóstico,Estado,Última Visita\n';
  
  exportData.forEach(patient => {
    csv += Object.values(patient).map(value => `"${value}"`).join(',') + '\n';
  });
  
  // Crear blob y descargar
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `pacientes_${formatDateForFilename(new Date())}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Exportar estadísticas
function exportStatistics() {
  // Implementar exportación de estadísticas a PDF o Excel
  showNotification('Funcionalidad en desarrollo', 'info');
}

// Inicializar gráficos para estadísticas
function initializeCharts() {
  // Crear gráficos con Chart.js
  createAttendanceChart();
  createFrequentPatientsChart();
  createTimeDistributionChart();
  createWorkloadChart();
}

// Actualizar datos de los gráficos
function updateChartsData() {
  // Actualizar datos de todos los gráficos
  createAttendanceChart();
  createFrequentPatientsChart();
  createTimeDistributionChart();
  createWorkloadChart();
}

// Crear gráfico de asistencia
function createAttendanceChart() {
  const canvas = document.getElementById('attendance-chart');
  if (!canvas) return;
  
  // Limpiar gráfico anterior si existe
  if (canvas._chart) {
    canvas._chart.destroy();
  }
  
  // Calcular datos de asistencia
  const attendanceData = calculateAttendanceData();
  
  // Crear nuevo gráfico
  canvas._chart = new Chart(canvas, {
    type: 'pie',
    data: {
      labels: ['Asistieron', 'No asistieron', 'Reprogramadas', 'Pendientes'],
      datasets: [{
        data: [
          attendanceData.attended,
          attendanceData.missed,
          attendanceData.rescheduled,
          attendanceData.pending
        ],
        backgroundColor: [
          '#2ecc71',
          '#e74c3c',
          '#f39c12',
          '#95a5a6'
        ]
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom'
        }
      }
    }
  });
}

// Calcular datos de asistencia
function calculateAttendanceData() {
  // Filtrar citas pasadas
  const pastAppointments = appointments.filter(a => a.date < new Date());
  
  // Contar por tipo de asistencia
  const attended = pastAppointments.filter(a => a.attendance === 'attended').length;
  const missed = pastAppointments.filter(a => a.attendance === 'missed').length;
  const rescheduled = pastAppointments.filter(a => a.attendance === 'rescheduled').length;
  const pending = pastAppointments.filter(a => a.attendance === 'pending').length;
  
  return { attended, missed, rescheduled, pending };
}

// Crear gráfico de pacientes frecuentes
function createFrequentPatientsChart() {
  const canvas = document.getElementById('frequent-patients-chart');
  if (!canvas) return;
  
  // Limpiar gráfico anterior si existe
  if (canvas._chart) {
    canvas._chart.destroy();
  }
  
  // Calcular pacientes frecuentes
  const frequentPatientsData = calculateFrequentPatientsData();
  
  // Crear nuevo gráfico
  canvas._chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: frequentPatientsData.labels,
      datasets: [{
        label: 'Número de citas',
        data: frequentPatientsData.data,
        backgroundColor: '#3498db'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// Calcular datos de pacientes frecuentes
function calculateFrequentPatientsData() {
  // Contar citas por paciente
  const appointmentsByPatient = {};
  
  appointments.forEach(appointment => {
    if (!appointmentsByPatient[appointment.patientId]) {
      appointmentsByPatient[appointment.patientId] = 0;
    }
    appointmentsByPatient[appointment.patientId]++;
  });
  
  // Convertir a array y ordenar
  const patientsCount = Object.entries(appointmentsByPatient)
    .map(([patientId, count]) => {
      const patient = patients.find(p => p.id === patientId);
      return {
        patientId,
        name: patient ? patient.name : 'Paciente desconocido',
        count
      };
    })
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // Tomar los 10 más frecuentes
  
  return {
    labels: patientsCount.map(p => p.name),
    data: patientsCount.map(p => p.count)
  };
}

// Crear gráfico de distribución horaria
function createTimeDistributionChart() {
  const canvas = document.getElementById('time-distribution-chart');
  if (!canvas) return;
  
  // Limpiar gráfico anterior si existe
  if (canvas._chart) {
    canvas._chart.destroy();
  }
  
  // Calcular distribución horaria
  const timeDistribution = calculateTimeDistributionData();
  
  // Crear nuevo gráfico
  canvas._chart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: timeDistribution.labels,
      datasets: [{
        label: 'Número de citas',
        data: timeDistribution.data,
        backgroundColor: '#9b59b6'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      },
      plugins: {
        legend: {
          display: false
        }
      }
    }
  });
}

// Calcular datos de distribución horaria
function calculateTimeDistributionData() {
  // Inicializar contadores para cada hora
  const hourCounts = {};
  for (let hour = 8; hour <= 18; hour++) {
    hourCounts[hour] = 0;
  }
  
  // Contar citas por hora
  appointments.forEach(appointment => {
    const hour = appointment.date.getHours();
    if (hour >= 8 && hour <= 18) {
      hourCounts[hour]++;
    }
  });
  
  return {
    labels: Object.keys(hourCounts).map(hour => `${hour}:00`),
    data: Object.values(hourCounts)
  };
}

// Crear gráfico de carga de trabajo
function createWorkloadChart() {
  const canvas = document.getElementById('workload-chart');
  if (!canvas) return;
  
  // Limpiar gráfico anterior si existe
  if (canvas._chart) {
    canvas._chart.destroy();
  }
  
  // Calcular carga de trabajo
  const workloadData = calculateWorkloadData();
  
  // Crear nuevo gráfico
  canvas._chart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: workloadData.labels,
      datasets: [{
        label: 'Número de citas',
        data: workloadData.data,
        fill: false,
        borderColor: '#2ecc71',
        tension: 0.1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            precision: 0
          }
        }
      }
    }
  });
}

// Calcular datos de carga de trabajo
function calculateWorkloadData() {
  // Inicializar datos para los próximos 30 días
  const today = new Date();
  const dates = [];
  const counts = [];
  
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    
    // Formatear fecha como YYYY-MM-DD para agrupar
    const dateKey = formatDateForKey(date);
    dates.push(formatDate(date));
    
    // Contar citas para esta fecha
    const count = appointments.filter(a => formatDateForKey(a.date) === dateKey).length;
    counts.push(count);
  }
  
  return {
    labels: dates,
    data: counts
  };
}

// Mostrar una vista específica
function showView(viewName) {
  // Ocultar todas las vistas
  document.querySelectorAll('.view').forEach(view => {
    view.classList.remove('active');
  });
  
  // Mostrar la vista seleccionada
  const selectedView = document.getElementById(`${viewName}-view`);
  if (selectedView) {
    selectedView.classList.add('active');
  }
  
  // Actualizar navegación
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  
  const activeNavBtn = document.querySelector(`.nav-btn[data-view="${viewName}"]`);
  if (activeNavBtn) {
    activeNavBtn.classList.add('active');
  }
  
  // Acciones específicas según la vista
  if (viewName === 'agenda') {
    renderAgenda();
  } else if (viewName === 'pacientes') {
    renderPatientsList();
  } else if (viewName === 'estadisticas') {
    updateChartsData();
  }
}

// Mostrar un modal
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'block';
  }
}

// Cerrar todos los modales
function closeAllModals() {
  document.querySelectorAll('.modal').forEach(modal => {
    modal.style.display = 'none';
  });
}

// Cerrar sesión
function handleLogout() {
  signOut(auth).then(() => {
    window.location.href = 'login.html'; // Redireccionar a la página de login
  }).catch((error) => {
    console.error('Error al cerrar sesión:', error);
  });
}

// Mostrar notificación
function showNotification(message, type = 'info') {
  const notificationCenter = document.getElementById('notification-center');
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  notification.innerHTML = `
    <span class="close-notification">&times;</span>
    <p>${message}</p>
  `;
  
  // Evento para cerrar notificación
  notification.querySelector('.close-notification').addEventListener('click', () => {
    notification.remove();
  });
  
  // Agregar al centro de notificaciones
  notificationCenter.appendChild(notification);
  
  // Auto-cerrar después de 5 segundos
  setTimeout(() => {
    notification.remove();
  }, 5000);
}

// Utilidades de formato
function formatDate(date) {
  return `${date.getDate()} ${monthNames[date.getMonth()]} ${date.getFullYear()}`;
}

function formatTime(date) {
  return date.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  });
}

function formatDateForInput(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatTimeForInput(date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function formatDateForKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function formatDateForFilename(date) {
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
}

function formatStatus(status) {
  switch (status) {
    case 'activo': return 'Activo';
    case 'en_espera': return 'En espera';
    case 'de_alta': return 'De alta';
    case 'cancelado': return 'Cancelado';
    default: return status;
  }
}
