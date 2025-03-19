import { db } from './firebase-config.js';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp 
} from 'firebase/firestore';

// Funciones para generar estadísticas avanzadas

// Obtener datos de asistencia histórica por mes
export async function getHistoricalAttendanceData() {
  try {
    // Obtener todas las citas
    const appointmentsSnapshot = await getDocs(collection(db, 'appointments'));
    const appointments = [];
    
    appointmentsSnapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Agrupar citas por mes
    const monthlyData = {};
    
    appointments.forEach(appointment => {
      const date = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          total: 0,
          attended: 0,
          missed: 0,
          rescheduled: 0,
          attendanceRate: 0
        };
      }
      
      monthlyData[monthKey].total++;
      
      if (appointment.attendance === 'attended') {
        monthlyData[monthKey].attended++;
      } else if (appointment.attendance === 'missed') {
        monthlyData[monthKey].missed++;
      } else if (appointment.attendance === 'rescheduled') {
        monthlyData[monthKey].rescheduled++;
      }
    });
    
    // Calcular tasa de asistencia
    Object.keys(monthlyData).forEach(month => {
      const data = monthlyData[month];
      const completedAppointments = data.attended + data.missed;
      
      if (completedAppointments > 0) {
        data.attendanceRate = (data.attended / completedAppointments) * 100;
      }
    });
    
    // Convertir a array y ordenar por fecha
    const result = Object.entries(monthlyData).map(([month, data]) => ({
      month,
      ...data
    })).sort((a, b) => a.month.localeCompare(b.month));
    
    return result;
  } catch (error) {
    console.error('Error al obtener datos históricos de asistencia:', error);
    throw error;
  }
}

// Obtener datos de carga de trabajo por día de la semana
export async function getWorkloadByWeekday() {
  try {
    // Obtener todas las citas
    const appointmentsSnapshot = await getDocs(collection(db, 'appointments'));
    const appointments = [];
    
    appointmentsSnapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Inicializar contadores para cada día de la semana
    const weekdayCounts = {
      0: 0, // Domingo
      1: 0, // Lunes
      2: 0, // Martes
      3: 0, // Miércoles
      4: 0, // Jueves
      5: 0, // Viernes
      6: 0  // Sábado
    };
    
    // Contar citas por día de la semana
    appointments.forEach(appointment => {
      const date = appointment.date.toDate ? appointment.date.toDate() : new Date(appointment.date);
      const weekday = date.getDay();
      weekdayCounts[weekday]++;
    });
    
    // Convertir a array con nombres de días
    const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const result = Object.entries(weekdayCounts).map(([day, count]) => ({
      day: weekdayNames[parseInt(day)],
      count
    }));
    
    return result;
  } catch (error) {
    console.error('Error al obtener datos de carga por día de la semana:', error);
    throw error;
  }
}

// Obtener datos de asistencia por hora del día
export async function getAttendanceByHour() {
  try {
    // Obtener todas las citas pasadas
    const now = new Date();
    const appointmentsSnapshot = await getDocs(collection(db, 'appointments'));
    const appointments = [];
    
    appointmentsSnapshot.forEach(doc => {
      const data = doc.data();
      const date = data.date.toDate ? data.date.toDate() : new Date(data.date);
      
      if (date < now) {
        appointments.push({
          id: doc.id,
          ...data,
          date
        });
      }
    });
    
    // Inicializar datos por hora
    const hourlyData = {};
    for (let hour = 8; hour <= 18; hour++) {
      hourlyData[hour] = {
        hour: `${hour}:00`,
        total: 0,
        attended: 0,
        missed: 0,
        attendanceRate: 0
      };
    }
    
    // Procesar citas
    appointments.forEach(appointment => {
      const hour = appointment.date.getHours();
      
      if (hour >= 8 && hour <= 18) {
        hourlyData[hour].total++;
        
        if (appointment.attendance === 'attended') {
          hourlyData[hour].attended++;
        } else if (appointment.attendance === 'missed') {
          hourlyData[hour].missed++;
        }
      }
    });
    
    // Calcular tasas de asistencia
    Object.values(hourlyData).forEach(data => {
      const totalAttendance = data.attended + data.missed;
      if (totalAttendance > 0) {
        data.attendanceRate = (data.attended / totalAttendance) * 100;
      }
    });
    
    return Object.values(hourlyData);
  } catch (error) {
    console.error('Error al obtener datos de asistencia por hora:', error);
    throw error;
  }
}

// Obtener estadísticas de pacientes más frecuentes
export async function getFrequentPatientsStats(limit = 10) {
  try {
    // Obtener todas las citas
    const appointmentsSnapshot = await getDocs(collection(db, 'appointments'));
    const appointments = [];
    
    appointmentsSnapshot.forEach(doc => {
      appointments.push({
        id: doc.id,
        ...doc.data()
      });
    });
    
    // Contar citas por paciente
    const patientCounts = {};
    appointments.forEach(appointment => {
      const patientId = appointment.patientId;
      if (!patientId) return;
      
      if (!patientCounts[patientId]) {
        patientCounts[patientId] = {
          patientId,
          totalAppointments: 0,
          attended: 0,
          missed: 0,
          attendanceRate: 0
        };
      }
      
      patientCounts[patientId].totalAppointments++;
      
      if (appointment.attendance === 'attended') {
        patientCounts[patientId].attended++;
      } else if (appointment.attendance === 'missed') {
        patientCounts[patientId].missed++;
      }
    });
    
    // Calcular tasa de asistencia
    Object.values(patientCounts).forEach(patient => {
      const totalAttendance = patient.attended + patient.missed;
      if (totalAttendance > 0) {
        patient.attendanceRate = (patient.attended / totalAttendance) * 100;
      }
    });
    
    // Convertir a array, ordenar por número de citas y limitar
    const result = Object.values(patientCounts)
      .sort((a, b) => b.totalAppointments - a.totalAppointments)
      .slice(0, limit);
    
    // Obtener información de pacientes
    const patientsSnapshot = await getDocs(collection(db, 'patients'));
    const patients = {};
    
    patientsSnapshot.forEach(doc => {
      patients[doc.id] = {
        id: doc.id,
        ...doc.data()
      };
    });
    
    // Adjuntar información de pacientes
    result.forEach(patient => {
      const patientData = patients[patient.patientId];
      if (patientData) {
        patient.name = patientData.name;
        patient.rut = patientData.rut;
      } else {
        patient.name = 'Paciente desconocido';
        patient.rut = '';
      }
    });
    
    return result;
  } catch (error) {
    console.error('Error al obtener estadísticas de pacientes frecuentes:', error);
    throw error;
  }
}

// Obtener datos de historial de asistencia para un paciente específico
export async function getPatientAttendanceHistory(patientId) {
  try {
    // Verificar que se proporcionó un ID de paciente
    if (!patientId) {
      throw new Error('Se requiere un ID de paciente');
    }
    
    // Consultar citas del paciente
    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('patientId', '==', patientId)
    );
    
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    const appointments = [];
    
    appointmentsSnapshot.forEach(doc => {
      const data = doc.data();
      appointments.push({
        id: doc.id,
        ...data,
        date: data.date.toDate ? data.date.toDate() : new Date(data.date)
      });
    });
    
    // Ordenar por fecha
    appointments.sort((a, b) => a.date - b.date);
    
    // Agrupar por mes
    const monthlyData = {};
    
    appointments.forEach(appointment => {
      const monthKey = `${appointment.date.getFullYear()}-${String(appointment.date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          total: 0,
          attended: 0,
          missed: 0,
          rescheduled: 0,
          pending: 0
        };
      }
      
      monthlyData[monthKey].total++;
      
      if (appointment.attendance === 'attended') {
        monthlyData[monthKey].attended++;
      } else if (appointment.attendance === 'missed') {
        monthlyData[monthKey].missed++;
      } else if (appointment.attendance === 'rescheduled') {
        monthlyData[monthKey].rescheduled++;
      } else {
        monthlyData[monthKey].pending++;
      }
    });
    
    // Convertir a array y ordenar
    return Object.values(monthlyData).sort((a, b) => a.month.localeCompare(b.month));
  } catch (error) {
    console.error('Error al obtener historial de asistencia del paciente:', error);
    throw error;
  }
}

// Generar reporte completo de actividad
export async function generateActivityReport(startDate, endDate) {
  try {
    // Convertir fechas a Timestamp para consulta
    const startTimestamp = Timestamp.fromDate(startDate);
    const endTimestamp = Timestamp.fromDate(endDate);
    
    // Consultar citas en el rango de fechas
    const appointmentsQuery = query(
      collection(db, 'appointments'),
      where('date', '>=', startTimestamp),
      where('date', '<=', endTimestamp)
    );
    
    const appointmentsSnapshot = await getDocs(appointmentsQuery);
    const appointments = [];
    
    appointmentsSnapshot.forEach(doc => {
      const data = doc.data();
      appointments.push({
        id: doc.id,
        ...data,
        date: data.date.toDate ? data.date.toDate() : new Date(data.date)
      });
    });
    
    // Obtener datos de pacientes
    const patientsSnapshot = await getDocs(collection(db, 'patients'));
    const patients = {};
    
    patientsSnapshot.forEach(doc => {
      patients[doc.id] = {
        id: doc.id,
        ...doc.data()
      };
    });
    
    // Procesar datos para el reporte
    const totalAppointments = appointments.length;
    const attendedAppointments = appointments.filter(a => a.attendance === 'attended').length;
    const missedAppointments = appointments.filter(a => a.attendance === 'missed').length;
    const rescheduledAppointments = appointments.filter(a => a.attendance === 'rescheduled').length;
    const pendingAppointments = appointments.filter(a => a.attendance === 'pending').length;
    
    // Calcular tasa de asistencia
    const completedAppointments = attendedAppointments + missedAppointments;
    const attendanceRate = completedAppointments > 0 
      ? (attendedAppointments / completedAppointments) * 100 
      : 0;
    
    // Contar citas por paciente
    const appointmentsByPatient = {};
    
    appointments.forEach(appointment => {
      const patientId = appointment.patientId;
      if (!patientId) return;
      
      if (!appointmentsByPatient[patientId]) {
        appointmentsByPatient[patientId] = {
          patientId,
          name: patients[patientId] ? patients[patientId].name : 'Paciente desconocido',
          rut: patients[patientId] ? patients[patientId].rut : '',
          total: 0,
          attended: 0,
          missed: 0,
          rescheduled: 0,
          pending: 0
        };
      }
      
      appointmentsByPatient[patientId].total++;
      
      if (appointment.attendance === 'attended') {
        appointmentsByPatient[patientId].attended++;
      } else if (appointment.attendance === 'missed') {
        appointmentsByPatient[patientId].missed++;
      } else if (appointment.attendance === 'rescheduled') {
        appointmentsByPatient[patientId].rescheduled++;
      } else {
        appointmentsByPatient[patientId].pending++;
      }
    });
    
    // Calcular distribución por día de la semana
    const weekdayCounts = {
      0: 0, // Domingo
      1: 0, // Lunes
      2: 0, // Martes
      3: 0, // Miércoles
      4: 0, // Jueves
      5: 0, // Viernes
      6: 0  // Sábado
    };
    
    appointments.forEach(appointment => {
      const weekday = appointment.date.getDay();
      weekdayCounts[weekday]++;
    });
    
    const weekdayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const appointmentsByWeekday = Object.entries(weekdayCounts).map(([day, count]) => ({
      day: weekdayNames[parseInt(day)],
      count
    }));
    
    // Crear objeto de reporte
    return {
      periodStart: startDate,
      periodEnd: endDate,
      totalDays: Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)),
      summaryStats: {
        totalAppointments,
        attendedAppointments,
        missedAppointments,
        rescheduledAppointments,
        pendingAppointments,
        attendanceRate
      },
      patientStats: Object.values(appointmentsByPatient).sort((a, b) => b.total - a.total),
      weekdayDistribution: appointmentsByWeekday,
      rawAppointments: appointments.map(appointment => ({
        ...appointment,
        patientName: patients[appointment.patientId] ? patients[appointment.patientId].name : 'Paciente desconocido'
      }))
    };
  } catch (error) {
    console.error('Error al generar reporte de actividad:', error);
    throw error;
  }
}

// Exportar reporte a CSV
export function exportReportToCSV(reportData) {
  try {
    // Formatear fechas
    const startDate = reportData.periodStart.toLocaleDateString('es-CL');
    const endDate = reportData.periodEnd.toLocaleDateString('es-CL');
    
    // Crear encabezado del CSV
    let csv = `Reporte de Actividad: ${startDate} al ${endDate}\n\n`;
    
    // Agregar resumen
    csv += 'Resumen\n';
    csv += 'Total de citas,Asistieron,No asistieron,Reprogramadas,Pendientes,Tasa de asistencia\n';
    csv += `${reportData.summaryStats.totalAppointments},`;
    csv += `${reportData.summaryStats.attendedAppointments},`;
    csv += `${reportData.summaryStats.missedAppointments},`;
    csv += `${reportData.summaryStats.rescheduledAppointments},`;
    csv += `${reportData.summaryStats.pendingAppointments},`;
    csv += `${reportData.summaryStats.attendanceRate.toFixed(2)}%\n\n`;
    
    // Agregar estadísticas por paciente
    csv += 'Estadísticas por Paciente\n';
    csv += 'Nombre,RUT,Total citas,Asistieron,No asistieron,Reprogramadas,Pendientes\n';
    
    reportData.patientStats.forEach(patient => {
      csv += `"${patient.name}",`;
      csv += `"${patient.rut}",`;
      csv += `${patient.total},`;
      csv += `${patient.attended},`;
      csv += `${patient.missed},`;
      csv += `${patient.rescheduled},`;
      csv += `${patient.pending}\n`;
    });
    
    csv += '\nDistribución por día de la semana\n';
    csv += 'Día,Cantidad\n';
    
    reportData.weekdayDistribution.forEach(day => {
      csv += `${day.day},${day.count}\n`;
    });
    
    // Agregar listado detallado de citas
    csv += '\nListado de Citas\n';
    csv += 'Fecha,Hora,Paciente,Estado,Notas\n';
    
    reportData.rawAppointments.forEach(appointment => {
      const date = appointment.date.toLocaleDateString('es-CL');
      const time = appointment.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      
      csv += `"${date}",`;
      csv += `"${time}",`;
      csv += `"${appointment.patientName}",`;
      csv += `"${formatAttendanceStatus(appointment.attendance)}",`;
      csv += `"${appointment.notes || ''}"\n`;
    });
    
    return csv;
  } catch (error) {
    console.error('Error al exportar reporte a CSV:', error);
    throw error;
  }
}

// Exportar reporte a PDF (usando la API html2pdf)
export function exportReportToPDF(reportData) {
  try {
    // Generar HTML para el PDF
    const startDate = reportData.periodStart.toLocaleDateString('es-CL');
    const endDate = reportData.periodEnd.toLocaleDateString('es-CL');
    
    let html = `
      <div class="report-container">
        <h1>Reporte de Actividad</h1>
        <h2>${startDate} al ${endDate}</h2>
        
        <div class="report-section">
          <h3>Resumen</h3>
          <table class="report-table">
            <tr>
              <th>Total de citas</th>
              <th>Asistieron</th>
              <th>No asistieron</th>
              <th>Reprogramadas</th>
              <th>Pendientes</th>
              <th>Tasa de asistencia</th>
            </tr>
            <tr>
              <td>${reportData.summaryStats.totalAppointments}</td>
              <td>${reportData.summaryStats.attendedAppointments}</td>
              <td>${reportData.summaryStats.missedAppointments}</td>
              <td>${reportData.summaryStats.rescheduledAppointments}</td>
              <td>${reportData.summaryStats.pendingAppointments}</td>
              <td>${reportData.summaryStats.attendanceRate.toFixed(2)}%</td>
            </tr>
          </table>
        </div>
        
        <div class="report-section">
          <h3>Estadísticas por Paciente</h3>
          <table class="report-table">
            <tr>
              <th>Nombre</th>
              <th>RUT</th>
              <th>Total</th>
              <th>Asistieron</th>
              <th>No asistieron</th>
              <th>Reprogramadas</th>
              <th>Pendientes</th>
            </tr>
    `;
    
    // Agregar filas de pacientes (limitar a los 20 primeros para evitar PDFs muy grandes)
    reportData.patientStats.slice(0, 20).forEach(patient => {
      html += `
        <tr>
          <td>${patient.name}</td>
          <td>${patient.rut}</td>
          <td>${patient.total}</td>
          <td>${patient.attended}</td>
          <td>${patient.missed}</td>
          <td>${patient.rescheduled}</td>
          <td>${patient.pending}</td>
        </tr>
      `;
    });
    
    html += `
          </table>
        </div>
        
        <div class="report-section">
          <h3>Distribución por Día de la Semana</h3>
          <table class="report-table">
            <tr>
              <th>Día</th>
              <th>Cantidad</th>
            </tr>
    `;
    
    reportData.weekdayDistribution.forEach(day => {
      html += `
        <tr>
          <td>${day.day}</td>
          <td>${day.count}</td>
        </tr>
      `;
    });
    
    html += `
          </table>
        </div>
        
        <div class="report-section">
          <h3>Listado de Citas</h3>
          <table class="report-table appointments-table">
            <tr>
              <th>Fecha</th>
              <th>Hora</th>
              <th>Paciente</th>
              <th>Estado</th>
              <th>Notas</th>
            </tr>
    `;
    
    // Agregar filas de citas (limitar a las 50 primeras para evitar PDFs muy grandes)
    reportData.rawAppointments.slice(0, 50).forEach(appointment => {
      const date = appointment.date.toLocaleDateString('es-CL');
      const time = appointment.date.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
      
      html += `
        <tr>
          <td>${date}</td>
          <td>${time}</td>
          <td>${appointment.patientName}</td>
          <td>${formatAttendanceStatus(appointment.attendance)}</td>
          <td>${appointment.notes || ''}</td>
        </tr>
      `;
    });
    
    html += `
          </table>
        </div>
      </div>
    `;
    
    // Estilos CSS para el PDF
    const styles = `
      <style>
        .report-container {
          font-family: Arial, sans-serif;
          max-width: 1000px;
          margin: 0 auto;
          padding: 20px;
        }
        
        h1, h2 {
          text-align: center;
          color: #3498db;
        }
        
        h2 {
          margin-bottom: 30px;
          font-weight: normal;
        }
        
        .report-section {
          margin-bottom: 30px;
        }
        
        h3 {
          color: #2980b9;
          border-bottom: 1px solid #ddd;
          padding-bottom: 5px;
          margin-bottom: 10px;
        }
        
        .report-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
        }
        
        .report-table th, .report-table td {
          border: 1px solid #ddd;
          padding: 8px;
          text-align: center;
        }
        
        .report-table th {
          background-color: #f8f9fa;
          font-weight: bold;
        }
        
        .report-table tr:nth-child(even) {
          background-color: #f2f2f2;
        }
        
        .appointments-table td:nth-child(5) {
          max-width: 200px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      </style>
    `;
    
    // Combinar HTML y CSS
    const content = styles + html;
    
    return content;
  } catch (error) {
    console.error('Error al exportar reporte a PDF:', error);
    throw error;
  }
}

// Formatear estado de asistencia
function formatAttendanceStatus(status) {
  switch (status) {
    case 'attended': return 'Asistió';
    case 'missed': return 'No asistió';
    case 'rescheduled': return 'Reprogramada';
    case 'pending': return 'Pendiente';
    default: return status;
  }
}

// Generar datos simulados para gráficos (útil para pruebas)
export function generateMockData() {
  // Datos de asistencia simulados
  const attendanceData = {
    attended: Math.floor(Math.random() * 50) + 50, // Entre 50 y 100
    missed: Math.floor(Math.random() * 30) + 10,   // Entre 10 y 40
    rescheduled: Math.floor(Math.random() * 20) + 5, // Entre 5 y 25
    pending: Math.floor(Math.random() * 15) + 5    // Entre 5 y 20
  };
  
  // Datos de distribución horaria simulados
  const timeDistribution = {
    labels: [],
    data: []
  };
  
  for (let hour = 8; hour <= 18; hour++) {
    timeDistribution.labels.push(`${hour}:00`);
    timeDistribution.data.push(Math.floor(Math.random() * 15) + 1); // Entre 1 y 16 por hora
  }
  
  // Datos de pacientes frecuentes simulados
  const frequentPatients = {
    labels: [],
    data: []
  };
  
  const patientNames = [
    'Juan Pérez', 'María González', 'Carlos Rodríguez', 'Ana Martínez',
    'Pedro Sánchez', 'Lucía Fernández', 'José López', 'Carmen Díaz',
    'Luis Torres', 'Laura Ramírez'
  ];
  
  patientNames.forEach(name => {
    frequentPatients.labels.push(name);
    frequentPatients.data.push(Math.floor(Math.random() * 20) + 1); // Entre 1 y 21 citas
  });
  
  // Datos de carga semanal simulados
  const workloadData = {
    labels: [],
    data: []
  };
  
  const today = new Date();
  for (let i = 0; i < 30; i++) {
    const date = new Date(today);
    date.setDate(today.getDate() + i);
    workloadData.labels.push(date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }));
    workloadData.data.push(Math.floor(Math.random() * 12) + 1); // Entre 1 y 13 citas por día
  }
  
  return {
    attendanceData,
    timeDistribution,
    frequentPatients,
    workloadData
  };
}
