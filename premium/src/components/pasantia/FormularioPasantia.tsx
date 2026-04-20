"use client";

import { useState, useEffect, useCallback } from "react";
import { enviarEntrega } from "@/services/pasantia";
import { casoClincoVacio } from "@/types/pasantia";
import type { CasoClinco, DatosDupla, EvaluacionSimple } from "@/types/pasantia";

// ─── Util ────────────────────────────────────────────────────────────────────
function guid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function HelpText({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-1.5 text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2 leading-relaxed">
      {children}
    </p>
  );
}

function Label({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div className="p-5 space-y-4">{children}</div>
    </div>
  );
}

function FieldTA({
  label,
  value,
  onChange,
  required,
  rows = 4,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  rows?: number;
  placeholder?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <textarea
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-none placeholder:text-slate-400"
      />
    </div>
  );
}

function FieldInput({
  label,
  value,
  onChange,
  required,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
  type?: string;
}) {
  return (
    <div>
      <Label required={required}>{label}</Label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition placeholder:text-slate-400"
      />
    </div>
  );
}

// ─── Sección 1: Datos generales de la usuaria ────────────────────────────────
function SeccionDatosGenerales({
  data,
  onChange,
}: {
  data: CasoClinco["datosUsuaria"];
  onChange: (d: CasoClinco["datosUsuaria"]) => void;
}) {
  const set = (key: keyof typeof data, val: string) => onChange({ ...data, [key]: val });
  return (
    <SectionCard title="1. Datos generales de la usuaria/o" icon="🧑‍⚕️">
      <HelpText>
        Registra datos básicos que permitan entender quién es la usuaria/o y por qué está siendo atendida/o. No escribas información innecesaria.
      </HelpText>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldInput label="Nombre de la usuaria/o" value={data.nombre} onChange={(v) => set("nombre", v)} required />
        <FieldInput label="Edad" value={data.edad} onChange={(v) => set("edad", v)} required placeholder="Ej: 42 años" />
        <FieldInput label="Ocupación o actividad principal" value={data.ocupacion} onChange={(v) => set("ocupacion", v)} required placeholder="Ej: Trabajadora de oficina, estudiante..." />
        <FieldInput label="Contexto de atención" value={data.contextoAtencion} onChange={(v) => set("contextoAtencion", v)} required placeholder="Ej: Centro comunitario, CESFAM..." />
      </div>
      <FieldTA label="Motivo principal de consulta o atención" value={data.motivoConsulta} onChange={(v) => set("motivoConsulta", v)} required rows={3} placeholder="Describe brevemente por qué la persona está siendo atendida..." />
    </SectionCard>
  );
}

// ─── Sección 2: Anamnesis ────────────────────────────────────────────────────
function SeccionAnamnesis({
  data,
  onChange,
}: {
  data: { anamnesis: string; interpretacionAnamnesis: string };
  onChange: (k: "anamnesis" | "interpretacionAnamnesis", v: string) => void;
}) {
  return (
    <SectionCard title="2. Anamnesis / Entrevista breve" icon="🗣️">
      <FieldTA
        label="Anamnesis próxima y remota"
        value={data.anamnesis}
        onChange={(v) => onChange("anamnesis", v)}
        required
        rows={7}
        placeholder="Pega o escribe aquí la anamnesis en orden..."
      />
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-800 space-y-1">
        <p className="font-bold mb-2">La anamnesis debe intentar responder, de forma simple:</p>
        {[
          "¿Cuál es el problema principal?",
          "¿Desde cuándo ocurre?",
          "¿Cómo comenzó?",
          "¿Qué actividades le molestan o limitan?",
          "¿Qué cosas alivian o aumentan el problema?",
          "¿Qué antecedentes remotos relevantes tiene?",
          "¿Qué espera lograr?",
        ].map((q) => (
          <p key={q} className="flex gap-2">
            <span className="text-blue-400">›</span> {q}
          </p>
        ))}
      </div>

      <FieldTA
        label="Interpretación de la anamnesis"
        value={data.interpretacionAnamnesis}
        onChange={(v) => onChange("interpretacionAnamnesis", v)}
        required
        rows={5}
        placeholder="No repitas la anamnesis. Explica qué datos te parecen más importantes y por qué..."
      />
      <HelpText>
        No repitas la anamnesis. Explica qué datos te parecen más importantes y por qué. Ejemplo: &quot;Lo más relevante es que el dolor aumenta al subir escaleras y limita su traslado diario, por lo que el problema principal parece estar afectando...&quot;
      </HelpText>
    </SectionCard>
  );
}

// ─── Sección 3: Evaluaciones ─────────────────────────────────────────────────
function SeccionEvaluaciones({
  evaluaciones,
  onChange,
}: {
  evaluaciones: EvaluacionSimple[];
  onChange: (evals: EvaluacionSimple[]) => void;
}) {
  const update = (id: string, key: keyof EvaluacionSimple, val: string) =>
    onChange(evaluaciones.map((e) => (e.id === id ? { ...e, [key]: val } : e)));
  const add = () => {
    if (evaluaciones.length >= 4) return;
    onChange([...evaluaciones, { id: guid(), nombre: "", razon: "", resultado: "", interpretacion: "" }]);
  };
  const remove = (id: string) => {
    if (evaluaciones.length <= 2) return;
    onChange(evaluaciones.filter((e) => e.id !== id));
  };

  return (
    <SectionCard title="3. Evaluaciones simples realizadas" icon="📋">
      <HelpText>
        Las evaluaciones deben ser simples y seguras. Pueden ser observación del movimiento, rango de movimiento activo, dolor durante una tarea, fuerza manual simple, equilibrio básico, marcha, transferencia, tarea funcional u otra evaluación pertinente al caso. Registra entre 2 y 4 evaluaciones.
      </HelpText>
      <div className="space-y-5">
        {evaluaciones.map((ev, idx) => (
          <div key={ev.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Evaluación {idx + 1}</span>
              {evaluaciones.length > 2 && (
                <button
                  type="button"
                  onClick={() => remove(ev.id)}
                  className="text-xs text-red-400 hover:text-red-600 transition font-medium"
                >
                  Eliminar
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FieldInput label="Nombre de la evaluación" value={ev.nombre} onChange={(v) => update(ev.id, "nombre", v)} required placeholder="Ej: Rango de movimiento activo de hombro" />
              <FieldTA label="¿Por qué eligieron esta evaluación?" value={ev.razon} onChange={(v) => update(ev.id, "razon", v)} required rows={2} placeholder="Explica la razón clínica..." />
              <FieldInput label="Resultado obtenido" value={ev.resultado} onChange={(v) => update(ev.id, "resultado", v)} required placeholder="Ej: 90° de flexión, dolor 6/10, etc." />
              <FieldTA label="Interpretación inmediata del resultado" value={ev.interpretacion} onChange={(v) => update(ev.id, "interpretacion", v)} required rows={2} placeholder="¿Qué significa este resultado para el caso?" />
            </div>
            <HelpText>
              No basta con escribir el resultado. Expliquen qué significa. Ejemplo: &quot;La limitación de 90° de flexión es significativa porque esta persona trabaja con los brazos elevados durante su jornada laboral...&quot;
            </HelpText>
          </div>
        ))}
      </div>
      {evaluaciones.length < 4 && (
        <button
          type="button"
          onClick={add}
          className="mt-2 w-full py-2.5 border-2 border-dashed border-teal-300 text-teal-600 font-semibold text-sm rounded-xl hover:bg-teal-50 transition"
        >
          + Agregar evaluación ({evaluaciones.length}/4)
        </button>
      )}
    </SectionCard>
  );
}

// ─── Sección 4: Hallazgos ────────────────────────────────────────────────────
function SeccionHallazgos({
  data,
  onChange,
}: {
  data: { hallazgo1: string; hallazgo2: string; hallazgo3: string };
  onChange: (k: keyof typeof data, v: string) => void;
}) {
  return (
    <SectionCard title="4. Hallazgos principales" icon="🔍">
      <HelpText>
        Selecciona solo los datos más importantes de la entrevista y evaluación. No escribas todo. Elige lo que realmente ayuda a entender el caso.
      </HelpText>
      <FieldTA label="Hallazgo 1" value={data.hallazgo1} onChange={(v) => onChange("hallazgo1", v)} required rows={2} placeholder="El hallazgo más relevante..." />
      <FieldTA label="Hallazgo 2" value={data.hallazgo2} onChange={(v) => onChange("hallazgo2", v)} required rows={2} placeholder="Segundo hallazgo importante..." />
      <FieldTA label="Hallazgo 3" value={data.hallazgo3} onChange={(v) => onChange("hallazgo3", v)} required rows={2} placeholder="Tercer hallazgo relevante..." />
    </SectionCard>
  );
}

// ─── Sección 5: CIF ──────────────────────────────────────────────────────────
function SeccionCIF({
  data,
  onChange,
}: {
  data: CasoClinco["cif"];
  onChange: (k: keyof CasoClinco["cif"], v: string) => void;
}) {
  const items: { key: keyof typeof data; label: string; icon: string; help: string; placeholder: string }[] = [
    {
      key: "estructurasCorporales",
      label: "A. Estructuras corporales",
      icon: "🦴",
      help: "Ejemplo: estructuras que podrían estar relacionadas con el problema (tejidos, articulaciones, nervios, etc.).",
      placeholder: "¿Qué estructuras podrían estar relacionadas con el problema?",
    },
    {
      key: "funcionesCorporales",
      label: "B. Funciones corporales",
      icon: "⚡",
      help: "Ejemplos: dolor, movilidad, fuerza, equilibrio, control motor, tolerancia al esfuerzo, sensibilidad, coordinación.",
      placeholder: "¿Qué funciones están alteradas?",
    },
    {
      key: "actividades",
      label: "C. Actividades",
      icon: "🚶",
      help: "Ejemplo: caminar, subir escaleras, levantar objetos, vestirse, correr, sentarse y pararse, trabajar, hacer ejercicio.",
      placeholder: "¿Qué actividades están limitadas?",
    },
    {
      key: "participacion",
      label: "D. Participación",
      icon: "👥",
      help: "Ejemplo: trabajo, deporte, estudios, cuidado del hogar, actividades sociales, independencia en la vida diaria.",
      placeholder: "¿En qué roles o situaciones de la vida participa menos o con dificultad?",
    },
    {
      key: "factoresPersonales",
      label: "E. Factores personales",
      icon: "🧠",
      help: "Ejemplo: edad, hábitos, nivel de actividad, miedo al movimiento, experiencia previa, adherencia, expectativas, condición física.",
      placeholder: "¿Qué factores propios de la persona pueden influir?",
    },
    {
      key: "factoresAmbientales",
      label: "F. Factores ambientales",
      icon: "🏠",
      help: "Ejemplo: apoyo familiar, trabajo, escaleras en casa, acceso a transporte, tiempo disponible, recursos, barreras del lugar.",
      placeholder: "¿Qué factores del entorno pueden ayudar o dificultar?",
    },
  ];

  return (
    <SectionCard title="5. Tabla CIF" icon="📊">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 space-y-1 mb-4">
        <p className="font-bold mb-2">Guía para completar la CIF:</p>
        <p>La CIF sirve para ordenar el caso. No es solo poner una lesión. Deben separar:</p>
        {[
          "Estructuras: partes del cuerpo posiblemente involucradas.",
          "Funciones: capacidades o funciones alteradas.",
          "Actividades: tareas que la persona tiene dificultad para hacer.",
          "Participación: impacto en su vida real, roles o rutina.",
          "Factores personales: características de la persona que influyen.",
          "Factores ambientales: elementos del entorno que ayudan o dificultan.",
        ].map((l) => (
          <p key={l} className="flex gap-2">
            <span>›</span> {l}
          </p>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => (
          <div key={item.key} className="border border-slate-200 rounded-xl p-4 bg-slate-50">
            <label className="block text-sm font-bold text-slate-700 mb-1">
              {item.icon} {item.label} <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={data[item.key]}
              onChange={(e) => onChange(item.key, e.target.value)}
              placeholder={item.placeholder}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-none placeholder:text-slate-400 bg-white"
            />
            <HelpText>{item.help}</HelpText>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

// ─── Sección 6: Diagnóstico ───────────────────────────────────────────────────
function SeccionDiagnostico({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [showGuide, setShowGuide] = useState(false);

  return (
    <SectionCard title="6. Diagnóstico kinesiológico incipiente" icon="🎯">
      <button
        type="button"
        onClick={() => setShowGuide(!showGuide)}
        className="text-sm font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-2 transition"
      >
        {showGuide ? "▼" : "▶"} {showGuide ? "Ocultar" : "Ver"} guía educativa completa
      </button>

      {showGuide && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-xs text-indigo-900 space-y-3 max-h-[500px] overflow-y-auto">
          <p className="font-bold text-sm text-indigo-800">Guía para construir el diagnóstico kinesiológico</p>
          <p className="font-semibold text-indigo-700">Este diagnóstico no es solo decir &quot;tiene tendinitis&quot; o &quot;tiene dolor lumbar&quot;. Un diagnóstico kinesiológico debe explicar:</p>
          {[
            "1. Quién es la persona.",
            "2. Qué problema refiere.",
            "3. Qué actividades no puede hacer bien.",
            "4. Qué encontró el tratante en la evaluación.",
            "5. Qué estructura o sistema podría estar comprometido.",
            "6. Qué factores ayudan o dificultan la recuperación.",
            "7. Cuál es el problema principal que la kinesiología debe abordar.",
            "8. Qué objetivo general guiará la intervención.",
          ].map((l) => (<p key={l}>› {l}</p>))}

          <div className="border-t border-indigo-200 pt-3">
            <p className="font-bold text-indigo-700 mb-2">PLANTILLA DE REFERENCIA</p>
            <div className="bg-white border border-indigo-200 rounded-lg p-3 space-y-2 text-indigo-800">
              <p><strong>1. Identificación y contexto relevante</strong></p>
              <p className="italic text-slate-600">[Nombre o iniciales], [edad], [sexo], [ocupación o rol principal], consulta por [motivo principal] de [tiempo de evolución]...</p>
              <p><strong>2. Problemas identificados por el usuario/paciente</strong></p>
              <p className="italic text-slate-600">Desde la perspectiva del usuario, el problema se expresa principalmente como dificultad para [actividad 1], [actividad 2]...</p>
              <p><strong>3. Problemas identificados por el tratante</strong></p>
              <p className="italic text-slate-600">Desde la evaluación kinesiológica, el cuadro compromete predominantemente el sistema [musculoesquelético/neuromuscular...]...</p>
              <p><strong>4. Factores contextuales</strong></p>
              <p className="italic text-slate-600">Como factores personales relevantes destacan [facilitadores] y [barreras]. Como factores ambientales...</p>
              <p><strong>5. Problema principal kinesiológico</strong></p>
              <p className="italic text-slate-600">El problema principal corresponde a [alteración funcional central] asociada a [hipótesis clínica], lo que limita [actividades] y restringe [participación].</p>
              <p><strong>6. Objetivo general</strong></p>
              <p className="italic text-slate-600">[Verbo] + [problema funcional principal] + para [actividad o participación que se busca recuperar].</p>
            </div>
          </div>
        </div>
      )}

      <FieldTA
        label="Diagnóstico kinesiológico incipiente redactado por la dupla"
        value={value}
        onChange={onChange}
        required
        rows={10}
        placeholder="Escribe aquí el diagnóstico kinesiológico completo siguiendo la estructura de la guía..."
      />
    </SectionCard>
  );
}

// ─── Sección 7: Autoevaluación ───────────────────────────────────────────────
function SeccionAutoevaluacion({
  data,
  onChange,
}: {
  data: CasoClinco["autoevaluacion"];
  onChange: (k: keyof CasoClinco["autoevaluacion"], v: string) => void;
}) {
  return (
    <SectionCard title="7. Autoevaluación breve de la dupla" icon="💬">
      <p className="text-xs text-slate-500 italic">Estas respuestas son visibles para el docente pero no forman parte de la rúbrica principal. Respondan con honestidad.</p>
      <FieldTA label="¿Qué parte del caso les costó más interpretar?" value={data.mayorDificultad} onChange={(v) => onChange("mayorDificultad", v)} rows={3} placeholder="Describe qué fue lo más difícil de este caso..." />
      <FieldTA label="¿Qué información creen que les faltó obtener?" value={data.informacionFaltante} onChange={(v) => onChange("informacionFaltante", v)} rows={3} placeholder="¿Hubo preguntas que no hicieron? ¿Info que no pudieron recopilar?" />
      <FieldTA label="¿Qué mejorarían en una próxima entrevista o evaluación?" value={data.mejoras} onChange={(v) => onChange("mejoras", v)} rows={3} placeholder="¿Qué harían diferente la próxima vez?" />
    </SectionCard>
  );
}

// ─── Bloque Caso ─────────────────────────────────────────────────────────────
function BloqueCaso({ numero, caso, onChange }: { numero: number; caso: CasoClinco; onChange: (c: CasoClinco) => void }) {
  const set = <K extends keyof CasoClinco>(key: K, val: CasoClinco[K]) => onChange({ ...caso, [key]: val });

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-black text-lg shadow-md">
          {numero}
        </div>
        <h2 className="text-xl font-black text-slate-800">Caso Clínico {numero}</h2>
      </div>

      <SeccionDatosGenerales data={caso.datosUsuaria} onChange={(d) => set("datosUsuaria", d)} />
      <SeccionAnamnesis
        data={{ anamnesis: caso.anamnesis, interpretacionAnamnesis: caso.interpretacionAnamnesis }}
        onChange={(k, v) => set(k, v)}
      />
      <SeccionEvaluaciones evaluaciones={caso.evaluaciones} onChange={(evals) => set("evaluaciones", evals)} />
      <SeccionHallazgos
        data={{ hallazgo1: caso.hallazgo1, hallazgo2: caso.hallazgo2, hallazgo3: caso.hallazgo3 }}
        onChange={(k, v) => set(k, v)}
      />
      <SeccionCIF data={caso.cif} onChange={(k, v) => set("cif", { ...caso.cif, [k]: v })} />
      <SeccionDiagnostico value={caso.diagnosticoKinesiologico} onChange={(v) => set("diagnosticoKinesiologico", v)} />
      <SeccionAutoevaluacion data={caso.autoevaluacion} onChange={(k, v) => set("autoevaluacion", { ...caso.autoevaluacion, [k]: v })} />
    </div>
  );
}

// ─── Validación ──────────────────────────────────────────────────────────────
function validateCaso(caso: CasoClinco, num: number): string[] {
  const errors: string[] = [];
  const prefix = `Caso ${num}`;
  if (!caso.datosUsuaria.nombre.trim()) errors.push(`${prefix}: Nombre de la usuaria`);
  if (!caso.datosUsuaria.edad.trim()) errors.push(`${prefix}: Edad`);
  if (!caso.datosUsuaria.ocupacion.trim()) errors.push(`${prefix}: Ocupación`);
  if (!caso.datosUsuaria.contextoAtencion.trim()) errors.push(`${prefix}: Contexto de atención`);
  if (!caso.datosUsuaria.motivoConsulta.trim()) errors.push(`${prefix}: Motivo de consulta`);
  if (!caso.anamnesis.trim()) errors.push(`${prefix}: Anamnesis`);
  if (!caso.interpretacionAnamnesis.trim()) errors.push(`${prefix}: Interpretación de la anamnesis`);
  caso.evaluaciones.forEach((ev, i) => {
    if (!ev.nombre.trim()) errors.push(`${prefix} Evaluación ${i + 1}: Nombre`);
    if (!ev.resultado.trim()) errors.push(`${prefix} Evaluación ${i + 1}: Resultado`);
    if (!ev.interpretacion.trim()) errors.push(`${prefix} Evaluación ${i + 1}: Interpretación`);
  });
  if (!caso.hallazgo1.trim() || !caso.hallazgo2.trim() || !caso.hallazgo3.trim())
    errors.push(`${prefix}: Los 3 hallazgos principales son obligatorios`);
  const cifFields = Object.values(caso.cif);
  if (cifFields.some((v) => !v.trim())) errors.push(`${prefix}: Todos los campos de la CIF son obligatorios`);
  if (!caso.diagnosticoKinesiologico.trim()) errors.push(`${prefix}: Diagnóstico kinesiológico`);
  return errors;
}

// ─── Formulario Principal ────────────────────────────────────────────────────
export default function FormularioPasantia() {
  const [dupla, setDupla] = useState<DatosDupla>({ estudiante1: "", estudiante2: "", fechaJornada: "", centroAtencion: "" });
  const [caso1, setCaso1] = useState<CasoClinco>(casoClincoVacio);
  const [caso2, setCaso2] = useState<CasoClinco>(casoClincoVacio);
  const [step, setStep] = useState<"info" | "caso1" | "caso2" | "enviado">("info");
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [entregaId, setEntregaId] = useState<string>("");

  // AutoSave to localStorage
  useEffect(() => {
    try {
      localStorage.setItem("pasantia_draft", JSON.stringify({ dupla, caso1, caso2 }));
    } catch { /* ignore */ }
  }, [dupla, caso1, caso2]);

  // Restore draft
  useEffect(() => {
    try {
      const raw = localStorage.getItem("pasantia_draft");
      if (raw) {
        const saved = JSON.parse(raw);
        if (saved.dupla) setDupla(saved.dupla);
        if (saved.caso1) setCaso1(saved.caso1);
        if (saved.caso2) setCaso2(saved.caso2);
      }
    } catch { /* ignore */ }
  }, []);

  const handleSubmit = useCallback(async () => {
    const allErrors = [
      ...(!dupla.estudiante1.trim() ? ["Nombre del Estudiante 1"] : []),
      ...(!dupla.estudiante2.trim() ? ["Nombre del Estudiante 2"] : []),
      ...(!dupla.fechaJornada ? ["Fecha de la jornada"] : []),
      ...validateCaso(caso1, 1),
      ...validateCaso(caso2, 2),
    ];

    if (allErrors.length > 0) {
      setErrors(allErrors);
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    setErrors([]);
    setSending(true);

    try {
      const id = await enviarEntrega({ dupla, caso1, caso2 });
      setEntregaId(id);
      localStorage.removeItem("pasantia_draft");
      setStep("enviado");
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setErrors(["Error al enviar: " + (err instanceof Error ? err.message : "Error desconocido")]);
    } finally {
      setSending(false);
    }
  }, [dupla, caso1, caso2]);

  const steps = [
    { id: "info", label: "Datos dupla" },
    { id: "caso1", label: "Caso 1" },
    { id: "caso2", label: "Caso 2" },
  ];

  if (step === "enviado") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg w-full text-center space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">¡Entrega enviada con éxito!</h1>
          <p className="text-slate-600">Tu tarea fue registrada correctamente. El docente recibirá tu ficha y la revisará con rúbrica.</p>
          <div className="bg-slate-100 rounded-xl p-4 text-xs text-slate-500 font-mono break-all">
            ID de entrega: {entregaId}
          </div>
          <p className="text-xs text-slate-400">Guarda este ID como comprobante de entrega.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/20">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-700 to-cyan-700 text-white py-6 px-4 shadow-lg sticky top-0 z-30">
        <div className="max-w-3xl mx-auto">
          <p className="text-teal-200 text-xs font-semibold uppercase tracking-wider mb-1">Pasantía 2º Año · Kinesiología</p>
          <h1 className="text-lg md:text-xl font-black leading-tight">
            Ficha de Observación, Entrevista, Evaluación Inicial y Razonamiento Kinésico Básico
          </h1>
        </div>
      </header>

      {/* Progress Steps */}
      <div className="bg-white border-b border-slate-200 sticky top-[88px] z-20 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <div className="flex items-center gap-1">
            {steps.map((s, idx) => (
              <div key={s.id} className="flex items-center gap-1 flex-1">
                <button
                  type="button"
                  onClick={() => setStep(s.id as typeof step)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition ${
                    step === s.id
                      ? "bg-teal-600 text-white"
                      : "text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${step === s.id ? "bg-white text-teal-600" : "bg-slate-200 text-slate-500"}`}>
                    {idx + 1}
                  </span>
                  <span className="hidden sm:inline">{s.label}</span>
                </button>
                {idx < steps.length - 1 && <div className="flex-1 h-px bg-slate-200 mx-1" />}
              </div>
            ))}
          </div>
        </div>
      </div>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Error Banner */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-6">
            <p className="font-bold text-red-700 mb-2">⚠️ Completa los campos obligatorios antes de enviar:</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e) => (
                <li key={e} className="text-sm text-red-600">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Step: Datos Dupla */}
        {step === "info" && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
              <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">👫 Datos de la dupla</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FieldInput label="Nombre Estudiante 1" value={dupla.estudiante1} onChange={(v) => setDupla({ ...dupla, estudiante1: v })} required />
                <FieldInput label="Nombre Estudiante 2" value={dupla.estudiante2} onChange={(v) => setDupla({ ...dupla, estudiante2: v })} required />
                <FieldInput label="Fecha de la jornada" value={dupla.fechaJornada} onChange={(v) => setDupla({ ...dupla, fechaJornada: v })} required type="date" />
                <FieldInput label="Centro de atención (opcional)" value={dupla.centroAtencion || ""} onChange={(v) => setDupla({ ...dupla, centroAtencion: v })} placeholder="Nombre del centro..." />
              </div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800 space-y-2">
              <p className="font-bold">📋 Instrucciones generales</p>
              <p>Deben completar <strong>dos casos clínicos</strong>. Cada caso tiene 7 secciones. Todos los campos marcados con <span className="text-red-500">*</span> son obligatorios para enviar.</p>
              <p>El formulario guarda tu progreso automáticamente en este navegador. Al terminar ambos casos, haz clic en &quot;Enviar definitivamente&quot;.</p>
            </div>
            <button onClick={() => setStep("caso1")} className="w-full py-4 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-black text-base rounded-2xl hover:from-teal-700 hover:to-cyan-700 shadow-lg transition">
              Continuar → Caso 1
            </button>
          </div>
        )}

        {/* Step: Caso 1 */}
        {step === "caso1" && (
          <div>
            <BloqueCaso numero={1} caso={caso1} onChange={setCaso1} />
            <div className="flex gap-3">
              <button onClick={() => setStep("info")} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition">
                ← Volver
              </button>
              <button onClick={() => { setStep("caso2"); window.scrollTo({ top: 0 }); }} className="flex-1 py-3.5 bg-gradient-to-r from-teal-600 to-cyan-600 text-white font-black rounded-2xl hover:from-teal-700 hover:to-cyan-700 shadow-lg transition">
                Continuar → Caso 2
              </button>
            </div>
          </div>
        )}

        {/* Step: Caso 2 */}
        {step === "caso2" && (
          <div>
            <BloqueCaso numero={2} caso={caso2} onChange={setCaso2} />
            <div className="flex gap-3">
              <button onClick={() => setStep("caso1")} className="flex-1 py-3.5 bg-white border-2 border-slate-300 text-slate-700 font-bold rounded-2xl hover:bg-slate-50 transition">
                ← Volver
              </button>
              <button
                onClick={handleSubmit}
                disabled={sending}
                className="flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black rounded-2xl hover:from-emerald-700 hover:to-teal-700 shadow-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {sending ? "Enviando..." : "✅ Enviar definitivamente"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
