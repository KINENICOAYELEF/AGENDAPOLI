'use client';

import React, { useState, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { collection, getDocs } from 'firebase/firestore';
import { UsersService } from '@/services/users';
import { UserTrainingProfile, TopicProgress } from '@/services/entrenamientoFirebase';
import { CLINICAL_TOPICS, ClinicalTopic } from '../utils/clinicalTopics';
import { ResponsiveRadar } from '@nivo/radar';

interface StudentData {
    uid: string;
    name: string;
    email: string;
    profile: UserTrainingProfile;
}

export function EntrenamientoDiarioDocenteView() {
    const [students, setStudents] = useState<StudentData[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedStudent, setSelectedStudent] = useState<StudentData | null>(null);
    const [selectedAttempt, setSelectedAttempt] = useState<{ topic: ClinicalTopic; progress: TopicProgress } | null>(null);

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);
        try {
            // Fetch all interns
            const interns = await UsersService.getInterns();
            const internsMap = new Map(interns.map(i => [i.uid, i]));
            
            // Fetch all training profiles
            const profilesSnap = await getDocs(collection(db, 'training_profiles'));
            const profilesMap = new Map<string, UserTrainingProfile>();
            profilesSnap.forEach(d => {
                profilesMap.set(d.id, d.data() as UserTrainingProfile);
            });

            // Merge all practice profiles
            const merged: StudentData[] = [];

            for (const [uid, profile] of profilesMap.entries()) {
                const existingIntern = internsMap.get(uid);
                if (existingIntern) {
                    merged.push({
                        uid: existingIntern.uid,
                        name: existingIntern.displayName || (existingIntern.email ? existingIntern.email.split('@')[0] : 'Sin Email'),
                        email: existingIntern.email || '',
                        profile
                    });
                } else {
                    // Try to fetch information of docente or other user who has practiced
                    try {
                        const userDoc = await UsersService.getById(uid);
                        if (userDoc) {
                            merged.push({
                                uid: userDoc.uid,
                                name: `${userDoc.displayName || (userDoc.email ? userDoc.email.split('@')[0] : 'Docente')} (Docente)`,
                                email: userDoc.email || '',
                                profile
                            });
                        }
                    } catch (e) {
                        console.error("Error cargando detalles del docente:", uid, e);
                    }
                }
            }

            // Also, if there are interns that haven't practiced yet, add them with empty profiles so the teacher can see they have 0 progress
            for (const intern of interns) {
                if (!profilesMap.has(intern.uid)) {
                    merged.push({
                        uid: intern.uid,
                        name: intern.displayName || (intern.email ? intern.email.split('@')[0] : 'Sin Email'),
                        email: intern.email || '',
                        profile: {
                            userId: intern.uid,
                            temas: {},
                            retosCompletadosTotal: 0,
                            ultimaSesionSemana: null,
                            sesionesCompletadasEstaSemana: 0,
                            estiloCognitivo: 'NEUTRO'
                        }
                    });
                }
            }

            setStudents(merged);
        } catch (error) {
            console.error("Error cargando perfiles de entrenamiento:", error);
        } finally {
            setLoading(false);
        }
    };

    // Filter students by name or email
    const filteredStudents = students.filter(s => 
        s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    // Compute cumulative radar for a student
    const computeCumulativeRadar = (temas: Record<string, any>) => {
        const totals = {
            biomecanica: 0,
            diagnostico: 0,
            neurofisiologia: 0,
            dosificacion: 0,
            terapiaManual: 0,
        };
        const counts = {
            biomecanica: 0,
            diagnostico: 0,
            neurofisiologia: 0,
            dosificacion: 0,
            terapiaManual: 0,
        };

        Object.values(temas).forEach((t: any) => {
            if (t.radarUltimo) {
                (Object.keys(totals) as Array<keyof typeof totals>).forEach((key) => {
                    const score = t.radarUltimo[key];
                    if (score !== undefined && score !== null && score !== -1) {
                        totals[key] += score;
                        counts[key] += 1;
                    }
                });
            }
        });

        const hasAnyData = Object.values(counts).some(c => c > 0);

        return {
            scores: {
                biomecanica: counts.biomecanica > 0 ? Math.round(totals.biomecanica / counts.biomecanica) : 0,
                diagnostico: counts.diagnostico > 0 ? Math.round(totals.diagnostico / counts.diagnostico) : 0,
                neurofisiologia: counts.neurofisiologia > 0 ? Math.round(totals.neurofisiologia / counts.neurofisiologia) : 0,
                dosificacion: counts.dosificacion > 0 ? Math.round(totals.dosificacion / counts.dosificacion) : 0,
                terapiaManual: counts.terapiaManual > 0 ? Math.round(totals.terapiaManual / counts.terapiaManual) : 0,
            },
            hasAnyData
        };
    };

    if (loading) {
        return <div className="p-8 text-center text-slate-500 font-medium">Cargando reportes de entrenamiento...</div>;
    }

    return (
        <div className="space-y-6">
            
            {/* Main view listing students */}
            {!selectedStudent ? (
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                        <div>
                            <h2 className="text-xl font-bold text-slate-800">Reportes de Internos</h2>
                            <p className="text-slate-500 text-sm">Monitorea el progreso de los estudiantes en sus interrogaciones socráticas diarias.</p>
                        </div>
                        <input
                            type="text"
                            placeholder="Buscar por nombre o correo..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full md:w-80 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-indigo-500 text-sm text-slate-700"
                        />
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="border-b border-slate-100 text-slate-400 font-bold text-xs uppercase tracking-wider">
                                    <th className="py-3 px-4">Estudiante</th>
                                    <th className="py-3 px-4">Retos Totales</th>
                                    <th className="py-3 px-4">Semana Actual</th>
                                    <th className="py-3 px-4">Estilo Cognitivo</th>
                                    <th className="py-3 px-4">Última Actividad</th>
                                    <th className="py-3 px-4 text-right">Acción</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredStudents.map(student => {
                                    const lastActive = student.profile.ultimaSesionSemana
                                        ? student.profile.ultimaSesionSemana.toDate().toLocaleDateString()
                                        : 'Sin actividad';

                                    return (
                                        <tr key={student.uid} className="hover:bg-slate-50/50 transition-colors text-sm text-slate-700">
                                            <td className="py-4 px-4 font-semibold">
                                                <div>{student.name}</div>
                                                <div className="text-xs text-slate-400 font-normal">{student.email}</div>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-bold text-slate-800">{student.profile.retosCompletadosTotal || 0}</span>
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="font-bold text-slate-800">{student.profile.sesionesCompletadasEstaSemana || 0}</span> / 5
                                            </td>
                                            <td className="py-4 px-4">
                                                <span className="px-2 py-1 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded-lg text-xs">
                                                    {student.profile.estiloCognitivo || 'NEUTRO'}
                                                </span>
                                            </td>
                                            <td className="py-4 px-4 text-slate-500">
                                                {lastActive}
                                            </td>
                                            <td className="py-4 px-4 text-right">
                                                <button
                                                    onClick={() => setSelectedStudent(student)}
                                                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg font-bold text-xs transition"
                                                >
                                                    Ver Detalles
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className="text-center py-8 text-slate-400 italic">
                                            No se encontraron estudiantes.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Detailed view of a single student */
                <div className="space-y-6 animate-in fade-in duration-200">
                    <button
                        onClick={() => setSelectedStudent(null)}
                        className="flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-slate-800 transition"
                    >
                        ◀ Volver a la Lista de Alumnos
                    </button>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        
                        {/* Left Column: Student summary and Radar */}
                        <div className="space-y-6">
                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                                <h3 className="text-xl font-bold text-slate-800 mb-1">{selectedStudent.name}</h3>
                                <p className="text-slate-500 text-sm mb-4">{selectedStudent.email}</p>
                                
                                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-4">
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Retos Totales</span>
                                        <span className="text-lg font-extrabold text-slate-850 block">{selectedStudent.profile.retosCompletadosTotal || 0}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Estilo Sugerido</span>
                                        <span className="text-sm font-bold text-indigo-700 block mt-1">{selectedStudent.profile.estiloCognitivo}</span>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                                <h4 className="font-bold text-slate-800 text-base mb-1 text-center">Rendimiento Histórico</h4>
                                <p className="text-slate-500 text-xs text-center mb-4">Radar de competencias promedio</p>
                                
                                {(() => {
                                    const radar = computeCumulativeRadar(selectedStudent.profile.temas);
                                    const radarData = [
                                        { subject: 'Biomecánica', score: radar.scores.biomecanica },
                                        { subject: 'Diagnóstico', score: radar.scores.diagnostico },
                                        { subject: 'Neurofisiología', score: radar.scores.neurofisiologia },
                                        { subject: 'Dosificación', score: radar.scores.dosificacion },
                                        { subject: 'Terapia Manual', score: radar.scores.terapiaManual },
                                    ];

                                    return radar.hasAnyData ? (
                                        <div className="h-[280px]">
                                            <ResponsiveRadar
                                                data={radarData}
                                                keys={['score']}
                                                indexBy="subject"
                                                maxValue={100}
                                                margin={{ top: 20, right: 30, bottom: 20, left: 30 }}
                                                curve="linearClosed"
                                                borderWidth={2}
                                                borderColor={{ from: 'color' }}
                                                gridLevels={5}
                                                gridShape="circular"
                                                gridLabelOffset={12}
                                                enableDots={true}
                                                dotSize={6}
                                                dotColor={{ theme: 'background' }}
                                                dotBorderWidth={1.5}
                                                dotBorderColor={{ from: 'color' }}
                                                enableDotLabel={true}
                                                dotLabel="value"
                                                dotLabelYOffset={-10}
                                                colors={['#6366f1']}
                                                fillOpacity={0.25}
                                                blendMode="multiply"
                                                animate={true}
                                            />
                                        </div>
                                    ) : (
                                        <div className="py-12 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
                                            Sin datos históricos en el radar.
                                        </div>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* Right Column: List of completed topics */}
                        <div className="lg:col-span-2 bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                            <h3 className="text-lg font-bold text-slate-800 mb-4">Temas Entrenados</h3>
                            
                            <div className="divide-y divide-slate-100 overflow-y-auto max-h-[600px] pr-2">
                                {Object.values(selectedStudent.profile.temas).length === 0 ? (
                                    <div className="p-8 text-center text-slate-400 italic">
                                        Este estudiante aún no ha completado ninguna sesión de entrenamiento diario.
                                    </div>
                                ) : (
                                    Object.values(selectedStudent.profile.temas).map(attempt => {
                                        const topic = CLINICAL_TOPICS.find(t => t.id === attempt.topicId) || ({
                                            id: attempt.topicId,
                                            nombre: `Tema ${attempt.topicId}`,
                                            focoPrincipal: '',
                                            categoria: 'Desconocida'
                                        } as unknown as ClinicalTopic);
                                        
                                        const date = attempt.ultimoRepaso 
                                            ? attempt.ultimoRepaso.toDate().toLocaleDateString()
                                            : 'N/A';

                                        return (
                                            <div key={attempt.topicId} className="py-4 flex justify-between items-center hover:bg-slate-50/40 rounded-xl px-2">
                                                <div className="pr-4 flex-1">
                                                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{topic.categoria}</span>
                                                    <h4 className="font-bold text-slate-700 text-sm mt-0.5">{topic.nombre}</h4>
                                                    <div className="text-xs text-slate-400 mt-1 flex gap-4">
                                                        <span>Intentos: {attempt.vecesCompletado}</span>
                                                        <span>Último: {date}</span>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4">
                                                    <span className={`px-2.5 py-1 text-xs font-bold rounded-lg border ${attempt.ultimoPuntaje >= 4.0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                        Última Nota: {attempt.ultimoPuntaje.toFixed(1)}
                                                    </span>
                                                    <button
                                                        onClick={() => setSelectedAttempt({ topic, progress: attempt })}
                                                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition"
                                                    >
                                                        Ver Historial
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Attempt details Modal */}
            {selectedAttempt && (
                <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex justify-between items-start shrink-0">
                            <div>
                                <span className="px-2.5 py-0.5 bg-indigo-50 border border-indigo-100 text-indigo-700 font-bold rounded-lg text-xs">
                                    {selectedAttempt.topic.categoria}
                                </span>
                                <h3 className="text-lg font-bold text-slate-800 mt-2">Detalles del Intento - {selectedAttempt.topic.nombre}</h3>
                                <p className="text-slate-500 text-xs mt-1">Estudiante: {selectedStudent?.name}</p>
                            </div>
                            <button 
                                onClick={() => setSelectedAttempt(null)}
                                className="text-slate-400 hover:text-slate-600 text-xl font-bold bg-slate-100 hover:bg-slate-200 rounded-full w-8 h-8 flex items-center justify-center transition-colors"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6 overflow-y-auto space-y-6 flex-1">
                            
                            {/* Focus / Pauta de Evaluación */}
                            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
                                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1.5">Foco de la Pauta Docente</h4>
                                <p className="text-slate-700 text-sm leading-relaxed">
                                    {selectedAttempt.topic.focoPrincipal}
                                </p>
                            </div>

                            {/* Attempt stats and Radar */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-4">
                                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Estadísticas y Calificación</h4>
                                    
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nota del Intento</span>
                                            <span className={`text-xl font-extrabold mt-0.5 block ${selectedAttempt.progress.ultimoPuntaje >= 4.0 ? 'text-emerald-600' : 'text-red-600'}`}>
                                                {selectedAttempt.progress.ultimoPuntaje.toFixed(1)}
                                            </span>
                                        </div>
                                        <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nota Promedio</span>
                                            <span className="text-xl font-extrabold text-slate-700 mt-0.5 block">
                                                {selectedAttempt.progress.puntajePromedio.toFixed(1)}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Debilidades Detectadas */}
                                    <div className="bg-red-50/50 border border-red-100 rounded-xl p-4">
                                        <h5 className="text-xs font-bold text-red-800 mb-1.5 flex items-center gap-1.5">
                                            <span>⚠️</span> Errores e Inconsistencias Históricas:
                                        </h5>
                                        {selectedAttempt.progress.erroresHistoricos && selectedAttempt.progress.erroresHistoricos.length > 0 ? (
                                            <ul className="list-disc pl-5 text-red-700 text-xs space-y-1">
                                                {selectedAttempt.progress.erroresHistoricos.map((err, i) => <li key={i}>{err}</li>)}
                                            </ul>
                                        ) : (
                                            <p className="text-xs text-slate-500 italic">No se registran debilidades críticas históricas para este tema.</p>
                                        )}
                                    </div>
                                </div>

                                {/* Radar of this specific attempt */}
                                <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-4 flex flex-col items-center">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Desglose de Competencias del Intento</h4>
                                    
                                    {selectedAttempt.progress.radarUltimo ? (
                                        <div className="w-full space-y-2 text-xs">
                                            {Object.entries(selectedAttempt.progress.radarUltimo).map(([key, val]) => {
                                                const score = val as number;
                                                const label = key === 'biomecanica' ? 'Biomecánica' :
                                                              key === 'diagnostico' ? 'Diagnóstico' :
                                                              key === 'neurofisiologia' ? 'Neurofisiología' :
                                                              key === 'dosificacion' ? 'Dosificación' :
                                                              key === 'terapiaManual' ? 'Terapia Manual' : key;
                                                
                                                return (
                                                    <div key={key} className="flex justify-between items-center py-1 border-b border-slate-100">
                                                        <span className="font-semibold text-slate-650">{label}</span>
                                                        <span className={`font-bold ${score === -1 ? 'text-slate-400 italic' : 'text-slate-800'}`}>
                                                            {score === -1 ? 'No Evaluado' : `${score}%`}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic my-auto">No hay desglose de radar disponible.</p>
                                    )}
                                </div>
                            </div>

                            {/* Full audio transcript */}
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Transcripción Completa del Audio</h4>
                                
                                {selectedAttempt.progress.ultimoTranscript ? (
                                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 max-h-80 overflow-y-auto space-y-3 shadow-inner">
                                        {selectedAttempt.progress.ultimoTranscript.split('\n').map((line, idx) => {
                                            const isTutor = line.startsWith('Tutor:');
                                            const cleanLine = line.replace(/^(Tutor|Estudiante):\s*/i, '');
                                            
                                            return (
                                                <div 
                                                    key={idx} 
                                                    className={`p-3.5 rounded-xl text-xs leading-relaxed ${isTutor ? 'bg-white border border-slate-100 text-slate-850 mr-8 shadow-sm' : 'bg-indigo-50 border border-indigo-100 text-indigo-900 ml-8 shadow-sm'}`}
                                                >
                                                    <strong className="block text-[10px] font-bold uppercase tracking-wider mb-1 opacity-50">
                                                        {isTutor ? 'Tutor Clínico (IA)' : 'Estudiante'}
                                                    </strong>
                                                    {cleanLine}
                                                </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 text-center text-slate-450 border border-dashed border-slate-200 rounded-2xl text-xs italic">
                                        No se guardó transcripción para esta sesión.
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Footer */}
                        <div className="p-6 border-t border-slate-100 bg-slate-50/50 flex justify-end shrink-0">
                            <button 
                                onClick={() => setSelectedAttempt(null)}
                                className="px-6 py-2 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl text-xs transition"
                            >
                                Cerrar
                            </button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
