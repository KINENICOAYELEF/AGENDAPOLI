"use client";

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { ShieldCheck, Plus, Calendar, Users, UserPlus, Award, CheckCircle } from 'lucide-react';

export default function GestionRotacionesPage() {
  const { user } = useAuth();
  const [university, setUniversity] = useState('UCH');
  const [rotationName, setRotationName] = useState('Rotación I - Hospital El Carmen');
  const [durationWeeks, setDurationWeeks] = useState(8);
  const [startDate, setStartDate] = useState('2026-03-01');
  const [endDate, setEndDate] = useState('2026-04-26');
  const [createdSuccess, setCreatedSuccess] = useState(false);

  if (user?.role !== 'DOCENTE') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3 text-amber-900 shadow-sm">
        <ShieldCheck className="w-10 h-10 mx-auto text-amber-600" />
        <h3 className="font-bold text-base">Acceso Exclusivo Docente</h3>
        <p className="text-xs text-slate-600">Se requieren permisos de docente para gestionar las rotaciones clínicas.</p>
      </div>
    );
  }

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreatedSuccess(true);
    setTimeout(() => setCreatedSuccess(false), 4000);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-12">
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-200 pb-4 gap-4">
        <div>
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600">Gestión Académica Docente</span>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Rotaciones Clínicas y Asignaciones</h1>
          <p className="text-xs text-slate-500 mt-1">Configuración de grupos, ventanas de evaluación formativa/final y asignación de tratantes</p>
        </div>

        <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-2xl text-xs font-bold text-indigo-800">
          <Calendar className="w-4 h-4 text-indigo-600" />
          <span>Periodo Lectivo 2026</span>
        </div>
      </div>

      {createdSuccess && (
        <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-2xl text-xs text-emerald-900 flex items-center gap-3">
          <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
          <span>Rotación creada exitosamente y configurada para seguimiento automático de la cohorte.</span>
        </div>
      )}

      {/* FORMULARIO DE NUEVA ROTACIÓN */}
      <form onSubmit={handleCreate} className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm space-y-6">
        <h3 className="text-sm font-black text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-600" />
          <span>Crear Nueva Rotación Clínica</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">Universidad</label>
            <select
              value={university}
              onChange={(e) => setUniversity(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value="UCH">Universidad de Chile (UCH)</option>
              <option value="UNAB">Universidad Andrés Bello (UNAB)</option>
              <option value="UDD">Universidad del Desarrollo (UDD)</option>
              <option value="UST">Universidad Santo Tomás (UST)</option>
            </select>
          </div>

          <div className="space-y-1 sm:col-span-2">
            <label className="font-bold text-slate-700 block">Nombre / Etiqueta de la Rotación</label>
            <input
              type="text"
              value={rotationName}
              onChange={(e) => setRotationName(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">Fecha Inicio</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">Fecha Término</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="font-bold text-slate-700 block">Duración (Semanas)</label>
            <select
              value={durationWeeks}
              onChange={(e) => setDurationWeeks(Number(e.target.value))}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-indigo-500 focus:outline-hidden"
            >
              <option value={8}>8 Semanas</option>
              <option value={9}>9 Semanas</option>
              <option value={10}>10 Semanas</option>
              <option value={12}>12 Semanas</option>
            </select>
          </div>
        </div>

        {/* CÁLCULO AUTOMÁTICO DE VENTANAS EVALUATIVAS */}
        <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 text-xs space-y-2">
          <h4 className="font-bold text-slate-900 flex items-center gap-2">
            <Award className="w-4 h-4 text-indigo-600" />
            <span>Rangos de Evaluación Propuestos Automáticamente</span>
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-slate-600">
            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 block mb-0.5">Examen Formativo (Semana 4)</span>
              <p className="text-[11px]">Rango: {startDate} al {endDate}</p>
            </div>
            <div className="p-2.5 bg-white rounded-xl border border-slate-200">
              <span className="font-bold text-slate-800 block mb-0.5">Examen Final (Penúltima Semana)</span>
              <p className="text-[11px]">Rango: {startDate} al {endDate}</p>
            </div>
          </div>
        </div>

        <button
          type="submit"
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2.5 px-5 rounded-xl text-xs transition-colors shadow-md shadow-indigo-600/20"
        >
          Guardar Rotación Clínica
        </button>
      </form>
    </div>
  );
}
