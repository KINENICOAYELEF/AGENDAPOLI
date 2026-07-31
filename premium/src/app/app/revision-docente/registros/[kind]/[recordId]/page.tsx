"use client";

import React, { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { useYear } from '@/context/YearContext';
import { ShieldCheck, ArrowLeft, Clock, UserCheck, AlertTriangle, FileText, CheckCircle } from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export default function VisorRegistroSoloLecturaPage() {
  const { user } = useAuth();
  const { globalActiveYear } = useYear();
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();

  const kind = (params.kind as string)?.toUpperCase();
  const recordId = params.recordId as string;
  const returnTo = searchParams.get('returnTo') || 'revision-docente';

  const [recordData, setRecordData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!globalActiveYear || !recordId || !kind) return;
    const fetchRecord = async () => {
      setLoading(true);
      try {
        const collectionName = kind === 'EVALUACION' ? 'evaluaciones' : 'evoluciones';
        const docRef = doc(db, 'programs', globalActiveYear, collectionName, recordId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setRecordData({ id: docSnap.id, ...docSnap.data() });
        } else {
          setError('El registro clínico no fue encontrado en este año de trabajo.');
        }
      } catch (err: any) {
        console.error('Error cargando registro en visor de solo lectura:', err);
        setError('Ocurrió un error al conectar con la base de datos.');
      } finally {
        setLoading(false);
      }
    };

    fetchRecord();
  }, [globalActiveYear, recordId, kind]);

  if (user?.role !== 'DOCENTE') {
    return (
      <div className="max-w-md mx-auto my-12 p-6 bg-amber-50 border border-amber-200 rounded-2xl text-center space-y-3 text-amber-900 shadow-sm">
        <ShieldCheck className="w-10 h-10 mx-auto text-amber-600" />
        <h3 className="font-bold text-base">Acceso Exclusivo Docente</h3>
        <p className="text-xs text-slate-600">Este visor de supervisión clínica requiere permisos de docente.</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* HEADER DE NAVEGACIÓN Y RETORNO SEGURO */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-4">
        <button
          onClick={() => router.push(`/app/${returnTo}`)}
          className="inline-flex items-center gap-2 text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-3.5 py-2 rounded-xl border border-indigo-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a la Bandeja Docente</span>
        </button>

        <div className="flex items-center gap-2 bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1.5 rounded-full text-xs font-bold">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Visor de Supervisión (Modo Solo Lectura)</span>
        </div>
      </div>

      {loading ? (
        <div className="py-20 flex flex-col items-center justify-center space-y-3 animate-pulse">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs text-slate-500 font-medium">Cargando expediente clínico...</p>
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center text-rose-900 space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-rose-600" />
          <h3 className="font-bold text-base">{error}</h3>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-3xl shadow-sm overflow-hidden p-6 sm:p-8 space-y-6">
          {/* DETALLES ENCABEZADO */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-slate-100 pb-6 gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="bg-indigo-100 text-indigo-800 text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md">
                  {kind}
                </span>
                <span className="text-slate-400 text-xs font-mono">ID: {recordData.id}</span>
              </div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight">
                {recordData.patientName || `Paciente ${recordData.usuariaId || ''}`}
              </h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Proceso Clínico ID: <span className="font-bold text-slate-700">{recordData.procesoId || 'Sin ID de Proceso'}</span>
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-100 p-3 rounded-2xl text-right shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-slate-500 font-bold mb-0.5 justify-end">
                <Clock className="w-3.5 h-3.5" />
                <span>Fecha de Atención</span>
              </div>
              <span className="text-xs font-mono font-bold text-slate-800">
                {recordData.sessionAt ? new Date(recordData.sessionAt).toLocaleString('es-CL') : 'Fecha no especificada'}
              </span>
            </div>
          </div>

          {/* DETALLES DE AUTORÍA REAL Y BOTÓN DE SALIDA */}
          <div className="bg-indigo-50/40 border border-indigo-100 rounded-2xl p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-indigo-600 text-white rounded-xl flex items-center justify-center font-black">
                <UserCheck className="w-5 h-5" />
              </div>
              <div>
                <span className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-600 block">Autor Registrado</span>
                <h4 className="text-sm font-bold text-slate-900">
                  {recordData.clinicianResponsible || recordData.autorName || recordData.audit?.createdBy || 'Autoría no determinada'}
                </h4>
                <p className="text-[11px] text-slate-500 font-mono">
                  UID: {recordData.audit?.createdBy || recordData.autorUid || 'No registrado'}
                </p>
              </div>
            </div>

            {/* SEPARACIÓN CLARA: ENLACE PARA SALIR MODO SUPERVISIÓN Y EDITAR */}
            {recordData.usuariaId && (
              <button
                onClick={() => router.push(`/app/usuarios?id=${recordData.usuariaId}&procesoId=${recordData.procesoId || ''}`)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 px-3 py-2 rounded-xl transition-colors shrink-0 shadow-xs"
              >
                <span>Abrir Expediente Completo (Salir de Modo Supervisión) ↗</span>
              </button>
            )}
          </div>

          {/* ALERTAS Y CAMPOS FALTANTES */}
          {(recordData.alerts?.length > 0 || recordData.missing?.length > 0) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {recordData.alerts?.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 space-y-1">
                  <h4 className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    <span>Alertas Registradas</span>
                  </h4>
                  <ul className="text-xs text-amber-800 list-disc list-inside space-y-0.5">
                    {recordData.alerts.map((a: string, idx: number) => (
                      <li key={idx}>{a}</li>
                    ))}
                  </ul>
                </div>
              )}
              {recordData.missing?.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 space-y-1">
                  <h4 className="text-xs font-bold text-rose-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-rose-600" />
                    <span>Campos Faltantes</span>
                  </h4>
                  <ul className="text-xs text-rose-800 list-disc list-inside space-y-0.5">
                    {recordData.missing.map((m: string, idx: number) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* RESUMEN CLÍNICO */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <span>Contenido Clínico del Registro</span>
            </h3>

            {kind === 'EVALUACION' ? (
              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                {recordData.interview && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <h5 className="font-bold text-slate-900 mb-1">Anamnesis e Entrevista</h5>
                    <p>{typeof recordData.interview === 'string' ? recordData.interview : JSON.stringify(recordData.interview)}</p>
                  </div>
                )}
                {recordData.guidedExam && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <h5 className="font-bold text-slate-900 mb-1">Examen Físico Guiado</h5>
                    <p>{typeof recordData.guidedExam === 'string' ? recordData.guidedExam : JSON.stringify(recordData.guidedExam)}</p>
                  </div>
                )}
                {recordData.p4_plan_structured && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <h5 className="font-bold text-slate-900 mb-1">Plan Terapéutico EBM</h5>
                    <p>{typeof recordData.p4_plan_structured === 'string' ? recordData.p4_plan_structured : JSON.stringify(recordData.p4_plan_structured)}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-4 text-xs text-slate-700 leading-relaxed">
                <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                  <h5 className="font-bold text-slate-900 mb-1">Objetivo de la Sesión</h5>
                  <p>{recordData.sessionGoal || recordData.objetivoSesion || 'Sin objetivo registrado'}</p>
                </div>
                {recordData.interventions && (
                  <div className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4">
                    <h5 className="font-bold text-slate-900 mb-1">Intervenciones Realizadas</h5>
                    <p>{typeof recordData.interventions === 'string' ? recordData.interventions : JSON.stringify(recordData.interventions)}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
