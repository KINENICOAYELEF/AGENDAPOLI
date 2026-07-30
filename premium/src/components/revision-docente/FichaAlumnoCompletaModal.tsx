"use client";

import React, { useState } from 'react';
import { X, User, Activity, Users, Brain, ActivitySquare, MessageSquare, ClipboardCheck, History } from 'lucide-react';
import { StudentLearningProfile } from '@/types/agentDataFoundation';

interface Props {
  studentId: string;
  profile?: StudentLearningProfile | null;
  onClose: () => void;
}

export function FichaAlumnoCompletaModal({ studentId, profile, onClose }: Props) {
  const [activeTab, setActiveTab] = useState(0);

  const tabs = [
    { label: 'Resumen', icon: Activity },
    { label: 'Registros Clínicos', icon: ClipboardCheck },
    { label: 'Personas Atendidas', icon: Users },
    { label: 'Patrones de Razonamiento', icon: Brain },
    { label: 'Simulaciones & OSCE', icon: ActivitySquare },
    { label: 'Feedback', icon: MessageSquare },
    { label: 'Evaluaciones Formales', icon: ClipboardCheck },
    { label: 'Historial de Decisiones', icon: History }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 bg-slate-50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shadow-inner">
              <User className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight">Expediente Clínico: {studentId}</h2>
              <p className="text-sm font-medium text-slate-500">Evaluación Longitudinal del Agente Autónomo</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 overflow-x-auto bg-white custom-scrollbar">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
                activeTab === idx 
                  ? 'border-indigo-600 text-indigo-600 bg-indigo-50/30' 
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
              }`}
            >
              <tab.icon className={`w-4 h-4 ${activeTab === idx ? 'text-indigo-600' : 'text-slate-400'}`} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
           {activeTab === 0 && (
             <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="space-y-2">
                  <h3 className="text-lg font-black text-slate-900">Resumen de Nivel Cognitivo</h3>
                  <p className="text-sm text-slate-600">Basado en la evaluación de los 3 pilares clínicos.</p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Pillar metrics based on profile */}
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Entrevista BPS</h4>
                    <p className="text-3xl font-black text-indigo-600">
                      {profile?.competencies?.pilarA_entrevistaBPS?.status || 'N/D'}
                    </p>
                    <div className="mt-4 text-xs font-medium text-slate-500 flex justify-between">
                      <span>Confianza: {profile?.competencies?.pilarA_entrevistaBPS?.confidence ? Math.round(profile.competencies.pilarA_entrevistaBPS.confidence * 100) : 0}%</span>
                      <span>Evidencias: {profile?.competencies?.pilarA_entrevistaBPS?.evidenceCount || 0}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Examen Dirigido</h4>
                    <p className="text-3xl font-black text-indigo-600">
                      {profile?.competencies?.pilarB_examenDirigido?.status || 'N/D'}
                    </p>
                    <div className="mt-4 text-xs font-medium text-slate-500 flex justify-between">
                      <span>Confianza: {profile?.competencies?.pilarB_examenDirigido?.confidence ? Math.round(profile.competencies.pilarB_examenDirigido.confidence * 100) : 0}%</span>
                      <span>Evidencias: {profile?.competencies?.pilarB_examenDirigido?.evidenceCount || 0}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                    <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Intervención EBM</h4>
                    <p className="text-3xl font-black text-indigo-600">
                      {profile?.competencies?.pilarC_intervencionEBM?.status || 'N/D'}
                    </p>
                    <div className="mt-4 text-xs font-medium text-slate-500 flex justify-between">
                      <span>Confianza: {profile?.competencies?.pilarC_intervencionEBM?.confidence ? Math.round(profile.competencies.pilarC_intervencionEBM.confidence * 100) : 0}%</span>
                      <span>Evidencias: {profile?.competencies?.pilarC_intervencionEBM?.evidenceCount || 0}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-emerald-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Fortalezas Detectadas
                    </h4>
                    {profile?.strengths && profile.strengths.length > 0 ? (
                      <ul className="space-y-2">
                        {profile.strengths.map((str, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-emerald-500 mt-0.5">•</span> {str}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No hay suficientes datos procesados.</p>
                    )}
                  </div>

                  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                    <h4 className="text-sm font-bold text-amber-700 uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Brain className="w-4 h-4" />
                      Brechas & Patrones
                    </h4>
                    {profile?.gaps && profile.gaps.length > 0 ? (
                      <ul className="space-y-2">
                        {profile.gaps.map((gap, i) => (
                          <li key={i} className="text-sm text-slate-700 flex items-start gap-2">
                            <span className="text-amber-500 mt-0.5">•</span> {gap}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-slate-500 italic">No se han detectado brechas consistentes.</p>
                    )}
                  </div>
                </div>
             </div>
           )}
           {activeTab === 1 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <ClipboardCheck className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Registros Clínicos en desarrollo</p>
             </div>
           )}
           {activeTab === 2 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <Users className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Trayectoria de Personas Atendidas en desarrollo</p>
             </div>
           )}
           {activeTab === 3 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <Brain className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Patrones de Razonamiento en desarrollo</p>
             </div>
           )}
           {activeTab === 4 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <ActivitySquare className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Simulaciones & OSCE en desarrollo</p>
             </div>
           )}
           {activeTab === 5 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <MessageSquare className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Feedback Privado y Aprobado en desarrollo</p>
             </div>
           )}
           {activeTab === 6 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <ClipboardCheck className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Mapeo de Rúbricas Universitarias en desarrollo</p>
             </div>
           )}
           {activeTab === 7 && (
             <div className="animate-in fade-in duration-300 flex flex-col items-center justify-center h-full text-slate-500 min-h-[300px]">
               <History className="w-12 h-12 mb-4 text-slate-300" />
               <p className="font-medium">Módulo de Historial de Calibración Docente en desarrollo</p>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
