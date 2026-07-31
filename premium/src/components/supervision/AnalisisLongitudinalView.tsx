"use client";

import React, { useState } from 'react';
import { UserCheck, HeartPulse, ShieldAlert, Award, FileText, Activity } from 'lucide-react';

interface AnalisisLongitudinalViewProps {
  studentProfile?: {
    studentId: string;
    displayName: string;
    universityCode: string;
    auditedRecordsCount: number;
    strengths: string[];
    improvementGaps: string[];
    recurringErrors: { description: string; occurrences: number }[];
    simulationStats: { attemptsCompleted: number; oralVsWrittenConcordance?: number };
  };
  patientTimeline?: {
    patientId: string;
    patientName: string;
    initialCondition: string;
    episodes: { date: string; summary: string; clinician: string; outcome: string }[];
  };
}

export function AnalisisLongitudinalView({ studentProfile, patientTimeline }: AnalisisLongitudinalViewProps) {
  const [activeTab, setActiveTab] = useState<'ESTUDIANTE' | 'PACIENTE'>('ESTUDIANTE');

  return (
    <div className="space-y-6 bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      {/* SECTOR DE PESTAÑAS SEPARADAS */}
      <div className="flex border-b border-slate-100 gap-4">
        <button
          onClick={() => setActiveTab('ESTUDIANTE')}
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-xs font-bold transition-all ${
            activeTab === 'ESTUDIANTE'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <UserCheck className="w-4 h-4" />
          <span>Perfil de Aprendizaje del Estudiante</span>
        </button>

        <button
          onClick={() => setActiveTab('PACIENTE')}
          className={`flex items-center gap-2 pb-3 px-1 border-b-2 text-xs font-bold transition-all ${
            activeTab === 'PACIENTE'
              ? 'border-teal-600 text-teal-600'
              : 'border-transparent text-slate-400 hover:text-slate-700'
          }`}
        >
          <HeartPulse className="w-4 h-4" />
          <span>Trayectoria de Continuidad del Paciente</span>
        </button>
      </div>

      {/* CONTENIDO PESTAÑA ESTUDIANTE */}
      {activeTab === 'ESTUDIANTE' && (
        <div className="space-y-6">
          <div className="bg-indigo-50/50 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Estudiante Auditado</span>
              <h3 className="text-base font-black text-slate-900">{studentProfile?.displayName || 'Estudiante en Rotación'}</h3>
              <p className="text-xs text-slate-500">
                Universidad: <span className="font-bold text-slate-700">{studentProfile?.universityCode || 'No especificada'}</span> | Atenciones Auditadas: <span className="font-bold text-indigo-600">{studentProfile?.auditedRecordsCount || 0}</span>
              </p>
            </div>
            <div className="bg-white border border-indigo-100 px-3 py-2 rounded-xl text-center shadow-xs">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block">Concordancia Escrito/Oral</span>
              <span className="text-sm font-black text-indigo-600">
                {studentProfile?.simulationStats?.oralVsWrittenConcordance ? `${Math.round(studentProfile.simulationStats.oralVsWrittenConcordance * 100)}%` : 'Sin datos orales'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <Award className="w-4 h-4 text-emerald-600" />
                <span>Fortalezas Clínicas Identificadas</span>
              </h4>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {studentProfile?.strengths?.map((s, idx) => (
                  <li key={idx}>{s}</li>
                )) || <li>Coherencia en anamnesis inicial</li>}
              </ul>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2">
              <h4 className="font-bold text-slate-900 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-amber-600" />
                <span>Oportunidades de Mejora y Brechas</span>
              </h4>
              <ul className="space-y-1 text-slate-600 list-disc list-inside">
                {studentProfile?.improvementGaps?.map((g, idx) => (
                  <li key={idx}>{g}</li>
                )) || <li>Profundizar dosificación en ejercicios terapéuticos</li>}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* CONTENIDO PESTAÑA PACIENTE */}
      {activeTab === 'PACIENTE' && (
        <div className="space-y-6">
          <div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-4">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-teal-600">Historial Clínico Continuo</span>
            <h3 className="text-base font-black text-slate-900">{patientTimeline?.patientName || 'Persona Usuaria en Seguimiento'}</h3>
            <p className="text-xs text-slate-500 mt-1">
              Condición de Ingreso: <span className="font-bold text-slate-700">{patientTimeline?.initialCondition || 'Kinesiología Musculoesquelética / Respiratoria'}</span>
            </p>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>Cronología de Episodios (Separados de Evaluación Estudiantil)</span>
            </h4>

            <div className="border-l-2 border-teal-200 pl-4 space-y-4">
              {patientTimeline?.episodes?.map((ep, idx) => (
                <div key={idx} className="bg-slate-50 border border-slate-200 rounded-2xl p-3 text-xs space-y-1">
                  <div className="flex justify-between items-center text-slate-500 text-[11px] font-mono">
                    <span>{ep.date}</span>
                    <span>Tratante: {ep.clinician}</span>
                  </div>
                  <p className="font-bold text-slate-800">{ep.summary}</p>
                  <span className="inline-block bg-teal-100 text-teal-800 px-2 py-0.5 rounded text-[10px] font-bold">
                    Resultado: {ep.outcome}
                  </span>
                </div>
              )) || (
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs text-slate-500 text-center">
                  Continuidad activa sin abandono. La cronicidad del caso se evalúa independientemente de la nota del estudiante.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
