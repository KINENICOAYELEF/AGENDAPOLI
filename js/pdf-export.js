// pdf-export.js
// Funcionalidad de exportación de PDF

import { currentPatientId, getPatient, getEvolutions } from './data-services.js';
import { showToast, showLoading, hideLoading, formatDate, calculatePatientProgress } from './utils.js';
import { renderExercises, renderScales } from './ui-exercises.js';

// Export PDF function (mejorada)
export async function exportToPDF(patientId) {
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
                const startDate = new Date(document.getElementById('pdfDateFrom')?.value);
                const endDate = new Date(document.getElementById('pdfDateTo')?.value);
                
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
        doc.setFontSize(14);
        doc.text(`Paciente: ${patient.name || 'Sin nombre'}`, 15, 40);
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
