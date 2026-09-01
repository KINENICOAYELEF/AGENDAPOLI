"use client";

import { useState, useEffect, useCallback } from "react";
import { enviarEntregaDiseno } from "@/services/practica-diseno";
import { casoDisenoVacio } from "@/types/practica-diseno";
import type { CasoDisenoIntervencion, DatosEstudianteDupla, EvaluacionDiseno } from "@/types/practica-diseno";

function guid() {
  return typeof crypto !== "undefined" ? crypto.randomUUID() : Math.random().toString(36).slice(2);
}

function HelpText({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
      {children}
    </div>
  );
}

function GuideBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5 leading-relaxed mb-4">
      <p className="font-bold text-sm text-blue-800 mb-1 flex items-center gap-1.5">
        <span>💡</span> {title}
      </p>
      {children}
    </div>
  );
}

function Label({ required, children }: { required?: boolean; children: React.ReactNode }) {
  return (
    <label className="block text-sm font-semibold text-slate-700 mb-1.5">
      {children}
      {required && <span className="text-red-500 ml-1">*</span>}
    </label>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="flex items-center gap-3 px-5 py-4 bg-gradient-to-r from-slate-50 to-white border-b border-slate-200">
        <span className="text-2xl">{icon}</span>
        <h3 className="text-base font-bold text-slate-800">{title}</h3>
      </div>
      <div className="p-5 space-y-5">{children}</div>
    </div>
  );
}

function FieldTA({
  label,
  value,
  onChange,
  required,
  rows = 5,
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
        className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y placeholder:text-slate-400 min-h-[110px]"
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
        className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition placeholder:text-slate-400"
      />
    </div>
  );
}

// ── CIF Componentes con Severidad ────────────────────────────
type Severidad = "" | "leve" | "moderado" | "severo" | "completo";

interface CifItem {
  id: string;
  texto: string;
  severidad: Severidad;
}

function serializeCifItems(items: CifItem[]): string {
  return JSON.stringify(items);
}

function deserializeCifItems(raw: string): CifItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    if (raw.trim()) return [{ id: guid(), texto: raw, severidad: "" }];
  }
  return [];
}

const SEVERIDADES: { val: Severidad; label: string; color: string }[] = [
  { val: "leve", label: "Leve", color: "bg-green-100 text-green-700 border-green-300" },
  { val: "moderado", label: "Moderado", color: "bg-amber-100 text-amber-700 border-amber-300" },
  { val: "severo", label: "Severo", color: "bg-orange-100 text-orange-700 border-orange-300" },
  { val: "completo", label: "Completo", color: "bg-red-100 text-red-700 border-red-300" },
];

function CifCategoryEditor({
  title,
  subtitle,
  helpText,
  value,
  onChange,
  showSeveridad = true,
}: {
  title: string;
  subtitle: string;
  helpText: React.ReactNode;
  value: string;
  onChange: (val: string) => void;
  showSeveridad?: boolean;
}) {
  const [items, setItems] = useState<CifItem[]>(() => deserializeCifItems(value));

  useEffect(() => {
    setItems(deserializeCifItems(value));
  }, [value]);

  const updateItems = (newItems: CifItem[]) => {
    setItems(newItems);
    onChange(serializeCifItems(newItems));
  };

  const addItem = () => {
    updateItems([...items, { id: guid(), texto: "", severidad: "" }]);
  };

  const removeItem = (id: string) => {
    updateItems(items.filter((i) => i.id !== id));
  };

  const updateItemText = (id: string, texto: string) => {
    updateItems(items.map((i) => (i.id === id ? { ...i, texto } : i)));
  };

  const updateItemSeveridad = (id: string, severidad: Severidad) => {
    updateItems(items.map((i) => (i.id === id ? { ...i, severidad } : i)));
  };

  return (
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-bold text-slate-800 text-sm">{title}</h4>
        <button
          type="button"
          onClick={addItem}
          className="text-xs font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 px-2.5 py-1 rounded-lg transition"
        >
          + Agregar hallazgo
        </button>
      </div>
      <p className="text-xs text-slate-500 mb-2">{subtitle}</p>
      <div className="mb-3">{helpText}</div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-white p-3 rounded-lg border border-dashed border-slate-200 text-center">
          No se han agregado ítems. Haz clic en "+ Agregar hallazgo".
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-col gap-1.5 bg-white p-3 rounded-lg border border-slate-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={item.texto}
                  onChange={(e) => updateItemText(item.id, e.target.value)}
                  placeholder="Escribe el ítem hallado..."
                  className="flex-1 text-xs text-slate-800 outline-none px-2 py-1 border border-slate-200 rounded-md"
                />
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className="text-slate-400 hover:text-red-500 text-sm px-1"
                  title="Eliminar"
                >
                  ✕
                </button>
              </div>
              {showSeveridad && (
                <div className="flex items-center gap-1.5 pt-1">
                  <span className="text-[11px] text-slate-400 font-medium">Severidad:</span>
                  {SEVERIDADES.map((s) => (
                    <button
                      key={s.val}
                      type="button"
                      onClick={() => updateItemSeveridad(item.id, item.severidad === s.val ? "" : s.val)}
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition ${
                        item.severidad === s.val
                          ? s.color
                          : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FORMULARIO PRINCIPAL CON GUÍAS COMPLETAS Y EJEMPLOS ───────────────────
export default function FormularioPracticaDiseno() {
  const STORAGE_KEY = "practica_diseno_borrador_v2";

  const [dupla, setDupla] = useState<DatosEstudianteDupla>({
    estudiante1: "",
    estudiante2: "",
    fechaJornada: new Date().toISOString().split("T")[0],
    centroAtencion: "",
  });

  const [caso, setCaso] = useState<CasoDisenoIntervencion>(casoDisenoVacio());

  // Estados de ejemplos desplegables
  const [showAnamnesisExample, setShowAnamnesisExample] = useState(false);
  const [showDiagExample, setShowDiagExample] = useState(false);
  const [showObjExample, setShowObjExample] = useState(false);
  const [showPlanExample, setShowPlanExample] = useState(false);
  const [showPronosticoExample, setShowPronosticoExample] = useState(false);

  const [enviando, setEnviando] = useState(false);
  const [enviadoExito, setEnviadoExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Cargar borrador local
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.dupla) setDupla(parsed.dupla);
        if (parsed.caso) setCaso(parsed.caso);
      }
    } catch {
      // ignore
    }
  }, []);

  // Auto-guardar borrador
  const guardarBorrador = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ dupla, caso }));
    } catch {
      // ignore
    }
  }, [dupla, caso]);

  useEffect(() => {
    const timer = setTimeout(guardarBorrador, 1000);
    return () => clearTimeout(timer);
  }, [dupla, caso, guardarBorrador]);

  // Manejo de evaluaciones
  const addEvaluacion = () => {
    setCaso((prev) => ({
      ...prev,
      evaluaciones: [
        ...prev.evaluaciones,
        { id: guid(), nombre: "", razon: "", resultado: "", interpretacion: "" },
      ],
    }));
  };

  const removeEvaluacion = (id: string) => {
    if (caso.evaluaciones.length <= 1) return;
    setCaso((prev) => ({
      ...prev,
      evaluaciones: prev.evaluaciones.filter((ev) => ev.id !== id),
    }));
  };

  const updateEvaluacion = (id: string, field: keyof EvaluacionDiseno, val: string) => {
    setCaso((prev) => ({
      ...prev,
      evaluaciones: prev.evaluaciones.map((ev) => (ev.id === id ? { ...ev, [field]: val } : ev)),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!dupla.estudiante1.trim()) {
      setErrorMsg("Debe ingresar al menos el nombre del Estudiante 1.");
      return;
    }

    if (!caso.datosUsuaria.nombre.trim() || !caso.enunciadoDiagnostico.trim()) {
      setErrorMsg("Por favor complete los datos básicos de la persona y el enunciado diagnóstico.");
      return;
    }

    if (!caso.pronostico.factorPronostico1.trim() || !caso.pronostico.factorPronostico2.trim() || !caso.pronostico.factorPronostico3.trim()) {
      setErrorMsg("Debes declarar al menos 3 factores pronósticos en la sección de Pronóstico Incipiente.");
      return;
    }

    setEnviando(true);
    try {
      await enviarEntregaDiseno({
        estudiante: dupla,
        caso,
      });

      localStorage.removeItem(STORAGE_KEY);
      setEnviadoExito(true);
    } catch (err: unknown) {
      console.error(err);
      setErrorMsg("Ocurrió un error al enviar la práctica. Por favor intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (enviadoExito) {
    return (
      <div className="max-w-2xl mx-auto my-12 p-8 bg-white rounded-3xl border border-slate-200 shadow-xl text-center space-y-4">
        <div className="w-16 h-16 bg-teal-100 text-teal-700 rounded-full flex items-center justify-center text-3xl mx-auto mb-2">
          ✓
        </div>
        <h2 className="text-2xl font-bold text-slate-800">¡Informe de Práctica Enviado!</h2>
        <p className="text-slate-600 text-sm leading-relaxed">
          Tu informe de <strong>Práctica Diseño de Intervención (UMCE)</strong> ha sido registrado con éxito.
          El docente revisará tu entrega evaluando con la rúbrica oficial de 28 puntos.
        </p>
        <button
          type="button"
          onClick={() => {
            setEnviadoExito(false);
            setCaso(casoDisenoVacio());
          }}
          className="mt-4 px-6 py-2.5 bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold rounded-xl transition"
        >
          Enviar otro informe
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-800 via-slate-900 to-slate-900 rounded-3xl p-8 text-white mb-8 shadow-xl">
        <div className="inline-block bg-teal-500/30 text-teal-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          Licenciatura en Kinesiología · UMCE
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
          Informe de Práctica: Diseño de Intervención
        </h1>
        <p className="text-teal-100/90 text-sm max-w-2xl">
          Coordinación de Prácticas Curriculares: Klgo. Juan César Henríquez Peñailillo.
          Módulo de evaluación enfocado en el diagnóstico clínico, matriz CIF, objetivos de intervención, estrategias y pronóstico incipiente.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 1. Datos Identificación */}
        <SectionCard title="1. Datos generales de la persona atendida e identificación" icon="🧑‍⚕️">
          <GuideBox title="Resguardo de Confidencialidad y Trato Empático">
            <p>
              Registren datos básicos que permitan entender quién es la persona y por qué fue atendida.
              <strong> Resguarden rigurosamente la confidencialidad</strong> (pueden usar iniciales o primer nombre).
            </p>
          </GuideBox>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Estudiante 1 (Obligatorio)"
              required
              value={dupla.estudiante1}
              onChange={(v) => setDupla({ ...dupla, estudiante1: v })}
              placeholder="Nombre y Apellido..."
            />
            <FieldInput
              label="Estudiante 2 (Opcional si es individual)"
              value={dupla.estudiante2 || ""}
              onChange={(v) => setDupla({ ...dupla, estudiante2: v })}
              placeholder="Nombre y Apellido..."
            />
            <FieldInput
              label="Fecha de la Jornada / Atención"
              type="date"
              value={dupla.fechaJornada}
              onChange={(v) => setDupla({ ...dupla, fechaJornada: v })}
            />
            <FieldInput
              label="Centro de Atención / Institución"
              value={dupla.centroAtencion}
              onChange={(v) => setDupla({ ...dupla, centroAtencion: v })}
              placeholder="Ej: Polideportivo UMCE, Cesfam..."
            />
          </div>

          <div className="border-t border-slate-200 pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput
              label="Nombre o iniciales de la persona"
              required
              value={caso.datosUsuaria.nombre}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, nombre: v } })}
              placeholder="Ej: M.G.O. o María..."
            />
            <FieldInput
              label="Edad"
              required
              value={caso.datosUsuaria.edad}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, edad: v } })}
              placeholder="Ej: 52 años..."
            />
            <FieldInput
              label="Ocupación o actividad principal"
              required
              value={caso.datosUsuaria.ocupacion}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, ocupacion: v } })}
              placeholder="Ej: Auxiliar de aseo, estudiante..."
            />
            <FieldInput
              label="Contexto de atención"
              required
              value={caso.datosUsuaria.contextoAtencion}
              onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, contextoAtencion: v } })}
              placeholder="Ej: Ambulatorio kinesiológico..."
            />
          </div>

          <FieldTA
            label="Motivo principal de consulta o atención"
            required
            value={caso.datosUsuaria.motivoConsulta}
            onChange={(v) => setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, motivoConsulta: v } })}
            placeholder="Describe el motivo según lo que la persona refiere. Ej: Consulta por dolor en rodilla derecha de 4 semanas de evolución que le dificulta subir escaleras..."
          />
        </SectionCard>

        {/* 2. Anamnesis e Interpretación */}
        <SectionCard title="2. Anamnesis e Interpretación Clínico-Funcional" icon="🗣️">
          <GuideBox title="¿Qué se espera en la Anamnesis?">
            <p>Escriban la <strong>entrevista clínica completa</strong> que realizaron como tratantes (anamnesis próxima y remota). Debe responder:</p>
            <div className="mt-2 ml-2 space-y-0.5 text-xs text-blue-900">
              <p>› ¿Cuál es el problema principal que refiere la persona?</p>
              <p>› ¿Desde cuándo ocurre y cuál fue el mecanismo de inicio?</p>
              <p>› ¿Cómo ha evolucionado? ¿Qué actividades agravan o alivian el dolor/molestia?</p>
              <p>› ¿Qué tratamientos previos ha tenido y cuáles son sus antecedentes remotos?</p>
            </div>
          </GuideBox>

          {/* Ejemplo desplegable Anamnesis */}
          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowAnamnesisExample(!showAnamnesisExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>📄 {showAnamnesisExample ? "Ocultar" : "Ver"} ejemplo de anamnesis profesional</span>
              <span>{showAnamnesisExample ? "▲" : "▼"}</span>
            </button>
            {showAnamnesisExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-3 leading-relaxed border-t border-indigo-200">
                <p className="font-bold text-indigo-700">Ejemplo de anamnesis registrada:</p>
                <div className="bg-slate-50 rounded-lg p-4 space-y-2 border border-slate-200">
                  <p><strong>Anamnesis próxima:</strong> Usuaria de 52 años, trabajadora de aseo, consulta por dolor en cara anterior de rodilla derecha de 4 semanas. Inicio insidioso sin trauma, asociado a sobrecarga laboral. Dolor aumenta al subir/bajar escaleras y al agacharse (EVA 6/10 en carga, 2/10 en reposo). Mejora con reposo.</p>
                  <p><strong>Anamnesis remota:</strong> Hipertensión controlada (losartán). Sin cirugías previas. Sedentaria. Vive en 1º piso pero su trabajo exige subir escaleras frecuentemente. Alta motivación por recuperarse.</p>
                </div>
              </div>
            )}
          </div>

          <FieldTA
            label="Anamnesis Próxima y Remota"
            required
            rows={8}
            value={caso.anamnesis}
            onChange={(v) => setCaso({ ...caso, anamnesis: v })}
            placeholder="Registren la entrevista clínica ordenada profesionalmente (próxima y remota)..."
          />

          <div className="border-t border-slate-200 pt-4">
            <GuideBox title="Interpretación de la Anamnesis (Análisis del Tratante)">
              <p><strong>No repitan la anamnesis.</strong> Expliquen como tratantes qué datos son clínicamente más relevantes y qué hipótesis diagnóstica o de sobreuso orienta el caso.</p>
              <p className="mt-1 italic text-blue-700">
                Ejemplo: "Lo más relevante es el dolor anterior de rodilla de inicio insidioso asociado a sobrecarga funcional en flexión. La ausencia de trauma sugiere disfunción patelofemoral por sobreuso. La prioridad es evaluar la movilidad y la tolerancia a la carga."
              </p>
            </GuideBox>

            <FieldTA
              label="Interpretación Clínico-Funcional de la Anamnesis"
              required
              rows={5}
              value={caso.interpretacionAnamnesis}
              onChange={(v) => setCaso({ ...caso, interpretacionAnamnesis: v })}
              placeholder="Analicen como tratantes: ¿Qué significan estos datos para la hipótesis clínica?"
            />
          </div>
        </SectionCard>

        {/* 3. Evaluaciones Desarrolladas */}
        <SectionCard title="3. Evaluaciones Desarrolladas en el Proceso" icon="📋">
          <GuideBox title="Criterio 3 de Rúbrica: Evaluaciones (5 Puntos)">
            <p>
              Registren las evaluaciones clínicas aplicadas. Para obtener el máximo puntaje, deben ser
              <strong> pertinentes al caso</strong>, estar <strong>ejecutadas correctamente</strong> y lograr una
              <strong> interpretación de resultados correcta y oportuna</strong>.
            </p>
          </GuideBox>

          <div className="space-y-5">
            {caso.evaluaciones.map((ev, idx) => (
              <div key={ev.id} className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                    Evaluación #{idx + 1}
                  </span>
                  {caso.evaluaciones.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeEvaluacion(ev.id)}
                      className="text-xs text-red-500 hover:underline font-semibold"
                    >
                      Eliminar
                    </button>
                  )}
                </div>

                <FieldInput
                  label="Nombre de la Evaluación / Test"
                  required
                  value={ev.nombre}
                  onChange={(v) => updateEvaluacion(ev.id, "nombre", v)}
                  placeholder="Ej: Goniometría de flexión de rodilla, EVA, Test de Step..."
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <FieldTA
                    label="Razón / Justificación Clínico-Funcional"
                    required
                    rows={2}
                    value={ev.razon}
                    onChange={(v) => updateEvaluacion(ev.id, "razon", v)}
                    placeholder="¿Por qué es pertinente realizar esta prueba?"
                  />
                  <FieldTA
                    label="Resultado Obtenido (Cuali/Cuantitativo)"
                    required
                    rows={2}
                    value={ev.resultado}
                    onChange={(v) => updateEvaluacion(ev.id, "resultado", v)}
                    placeholder="Ej: 90° de flexión activa (contralateral 135°), dolor 6/10 al final del rango..."
                  />
                </div>

                <FieldTA
                  label="Interpretación Oportuna del Resultado"
                  required
                  rows={2}
                  value={ev.interpretacion}
                  onChange={(v) => updateEvaluacion(ev.id, "interpretacion", v)}
                  placeholder="¿Qué significa este resultado para la funcionalidad del usuario?"
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addEvaluacion}
            className="mt-3 w-full py-2.5 border-2 border-dashed border-teal-300 text-teal-700 font-semibold text-xs rounded-xl hover:bg-teal-50 transition"
          >
            + Agregar otra evaluación
          </button>
        </SectionCard>

        {/* 4. Tabla CIF */}
        <SectionCard title="4. Clasificación Internacional del Funcionamiento (CIF)" icon="🌐">
          <GuideBox title="Guía para la Clasificación CIF y Severidad">
            <p>La CIF permite ordenar profesionalmente el caso. Clasifiquen los ítems encontrados y asignen la severidad correspondiente:</p>
            <div className="mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-[11px]">
              <div className="bg-green-100 text-green-800 p-2 rounded-lg font-medium">Leve: Molestia o alteración menor.</div>
              <div className="bg-amber-100 text-amber-800 p-2 rounded-lg font-medium">Moderado: Dificultad o limitación evidente.</div>
              <div className="bg-orange-100 text-orange-800 p-2 rounded-lg font-medium">Severo: Gran alteración o casi incapacidad.</div>
              <div className="bg-red-100 text-red-800 p-2 rounded-lg font-medium">Completo: Alteración o bloqueo total.</div>
            </div>
          </GuideBox>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CifCategoryEditor
              title="🦴 A. Estructuras Corporales"
              subtitle="Tejidos, articulaciones o estructuras comprometidas"
              helpText={<HelpText>Ej: Complejo patelofemoral derecho, tendón rotuliano, fascia plantar...</HelpText>}
              value={caso.cif.estructurasCorporales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, estructurasCorporales: val } })}
              showSeveridad={false}
            />

            <CifCategoryEditor
              title="⚡ B. Funciones Corporales Alteradas"
              subtitle="Capacidades fisiológicas disminuidas (con severidad)"
              helpText={<HelpText>Ej: Dolor anterior de rodilla, Rango de movimiento en flexión, Fuerza muscular...</HelpText>}
              value={caso.cif.funcionesCorporales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, funcionesCorporales: val } })}
              showSeveridad={true}
            />

            <CifCategoryEditor
              title="🚶 C. Actividades Limitadas"
              subtitle="Tareas concretas que cuestan realizar (con severidad)"
              helpText={<HelpText>Ej: Subir/bajar escaleras, Caminar distancias largas (&gt;500m), Agacharse...</HelpText>}
              value={caso.cif.actividades}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, actividades: val } })}
              showSeveridad={true}
            />

            <CifCategoryEditor
              title="👥 D. Restricción de Participación"
              subtitle="Impacto en roles de la vida real (con severidad)"
              helpText={<HelpText>Ej: Cumplir jornada laboral completa, Participar en actividades recreativas...</HelpText>}
              value={caso.cif.participacion}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, participacion: val } })}
              showSeveridad={true}
            />

            <CifCategoryEditor
              title="🧠 E. Factores Personales"
              subtitle="Escribir facilitadores (+) y barreras (-)"
              helpText={<HelpText>Ej: (+) Alta motivación por mejorar | (-) Sedentarismo previo, temor al movimiento...</HelpText>}
              value={caso.cif.factoresPersonales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, factoresPersonales: val } })}
              showSeveridad={false}
            />

            <CifCategoryEditor
              title="🏠 F. Factores Ambientales"
              subtitle="Escribir facilitadores (+) y barreras (-)"
              helpText={<HelpText>Ej: (+) Apoyo familiar | (-) Trabajo físico pesado con escaleras sin ascensor...</HelpText>}
              value={caso.cif.factoresAmbientales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, factoresAmbientales: val } })}
              showSeveridad={false}
            />
          </div>
        </SectionCard>

        {/* 5. Enunciado Diagnóstico y Objetivos CIF */}
        <SectionCard title="5. Enunciado Diagnóstico y Objetivos de Intervención" icon="🎯">
          <GuideBox title="Criterio 4 de Rúbrica: Objetivos de Intervención (5 Puntos)">
            <p>
              El enunciado diagnóstico debe formularse integrando las dimensiones CIF (Clínico o Situacional).
              Los objetivos deben ser <strong>"alcanzables"</strong>, plantear un <strong>Objetivo General SMART</strong>
              y <strong>Objetivos Específicos acordes a las dimensiones CIF</strong>.
            </p>
          </GuideBox>

          {/* Plantilla Enunciado Diagnóstico */}
          <div className="border border-indigo-200 rounded-xl overflow-hidden mb-4">
            <button
              type="button"
              onClick={() => setShowDiagExample(!showDiagExample)}
              className="w-full flex items-center justify-between px-4 py-3 bg-indigo-50 hover:bg-indigo-100 transition text-sm font-semibold text-indigo-700"
            >
              <span>📝 {showDiagExample ? "Ocultar" : "Ver"} plantilla y ejemplo de Enunciado Diagnóstico</span>
              <span>{showDiagExample ? "▲" : "▼"}</span>
            </button>
            {showDiagExample && (
              <div className="px-4 py-4 bg-white text-xs text-slate-700 space-y-3 leading-relaxed border-t border-indigo-200">
                <p className="font-bold text-indigo-700">Ejemplo de Enunciado Diagnóstico Kinesiológico:</p>
                <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                  "Persona de 52 años, trabajadora de aseo, que presenta disfunción musculoesquelética caracterizada por probable compromiso patelofemoral derecho por sobreuso funcional. Manifiesta dolor moderado (6/10) y limitación en el rango de flexión activa de rodilla (90°), lo cual limita sus actividades de subir/bajar escaleras y agacharse, restringiendo su participación en la jornada laboral. Presenta como facilitador su alta motivación y como barrera la alta exigencia de carga articular en su entorno laboral."
                </div>
              </div>
            )}
          </div>

          <FieldTA
            label="Enunciado Diagnóstico Kinesiológico (Clínico o Situacional)"
            required
            rows={5}
            value={caso.enunciadoDiagnostico}
            onChange={(v) => setCaso({ ...caso, enunciadoDiagnostico: v })}
            placeholder="Redacten el diagnóstico integrando quién es la persona, la estructura/función comprometida, la actividad limitada y la restricción en participación..."
          />

          <div className="border-t border-slate-200 pt-5 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-slate-800 text-sm">Objetivos de Intervención:</h4>
              <button
                type="button"
                onClick={() => setShowObjExample(!showObjExample)}
                className="text-xs font-semibold text-indigo-600 hover:underline"
              >
                {showObjExample ? "Ocultar ejemplos" : "💡 Ver ejemplos de objetivos SMART"}
              </button>
            </div>

            {showObjExample && (
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-200 text-xs text-blue-900 space-y-2">
                <p><strong>Ejemplo Objetivo General:</strong> "Mejorar la capacidad funcional del miembro inferior derecho para permitir subir y bajar escaleras sin dolor en un plazo de 4 semanas."</p>
                <p><strong>Ejemplo Específico Estructuras/Funciones:</strong> "Aumentar el rango de movimiento activo de flexión de rodilla de 90° a 120° y disminuir el dolor a ≤ 2/10 en EVA en 3 semanas."</p>
                <p><strong>Ejemplo Específico Actividades:</strong> "Reeducar la transferencia de sedente a bípedo y la técnica de marcha en escaleras sin compensación antálgica en 2 semanas."</p>
                <p><strong>Ejemplo Específico Participación:</strong> "Reintegrar a la persona a su jornada laboral completa con pautas de dosificación de carga en 4 semanas."</p>
              </div>
            )}

            <FieldTA
              label="Objetivo General de Intervención"
              required
              rows={3}
              value={caso.objetivos.objetivoGeneral}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })}
              placeholder="Formula el objetivo general enfocado en la funcionalidad de la persona..."
            />

            <FieldTA
              label="Objetivo Específico: Estructuras y Funciones Corporales"
              required
              rows={2}
              value={caso.objetivos.estructurasFunciones}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, estructurasFunciones: v } })}
              placeholder="Objetivo enfocado en dolor, ROM, fuerza, control motor..."
            />

            <FieldTA
              label="Objetivo Específico: Actividades"
              required
              rows={2}
              value={caso.objetivos.actividades}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, actividades: v } })}
              placeholder="Objetivo enfocado en tareas concretas (marcha, escaleras, agacharse)..."
            />

            <FieldTA
              label="Objetivo Específico: Participación"
              required
              rows={2}
              value={caso.objetivos.participacion}
              onChange={(v) => setCaso({ ...caso, objetivos: { ...caso.objetivos, participacion: v } })}
              placeholder="Objetivo enfocado en roles sociales, laborales o recreativos..."
            />
          </div>
        </SectionCard>

        {/* 6. Plan de Intervención */}
        <SectionCard title="6. Plan de Intervención Propuesto (Estrategias CIF)" icon="🛠️">
          <GuideBox title="Criterio 5 de Rúbrica: Plan de Intervención (3 Puntos Máximo)">
            <p>
              Para obtener el puntaje máximo (3 pts), el plan debe ser <strong>coherente con los objetivos</strong> Y
              considerar <strong>al menos una estrategia de intervención para cada dimensión CIF</strong> (Estructuras/Funciones, Actividades y Participación).
            </p>
          </GuideBox>

          <button
            type="button"
            onClick={() => setShowPlanExample(!showPlanExample)}
            className="text-xs font-semibold text-indigo-600 hover:underline mb-2 block"
          >
            {showPlanExample ? "Ocultar ejemplos de estrategias" : "💡 Ver ejemplos de estrategias por dimensión CIF"}
          </button>

          {showPlanExample && (
            <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 mb-4">
              <p><strong>Estrategias Estructuras/Funciones:</strong> Terapia manual de deslizamiento patelar, ejercicio terapéutico de fortalecimiento isométrico y concéntrico de cuádriceps y glúteo medio (3 series x 10 reps, 3 veces/semana), agachamiento controlado.</p>
              <p><strong>Estrategias Actividades:</strong> Entrenamiento de la tarea de subir/bajar escaleras con progresión de altura de peldaño, reeducación del patrón de marcha.</p>
              <p><strong>Estrategias Participación:</strong> Educación ergonómica en el puesto de trabajo, pauta de pausas activas cada 2 horas y plan de ejercicios en el hogar.</p>
            </div>
          )}

          <div className="space-y-4">
            <FieldTA
              label="Estrategia(s) de Intervención: Estructuras y Funciones Corporales"
              required
              rows={3}
              value={caso.planIntervencion.estructurasFunciones}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, estructurasFunciones: v } })
              }
              placeholder="Ej: Movilización articular, ejercicio terapéutico, agentes físicos, dosificación..."
            />

            <FieldTA
              label="Estrategia(s) de Intervención: Actividades"
              required
              rows={3}
              value={caso.planIntervencion.actividades}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, actividades: v } })
              }
              placeholder="Ej: Entrenamiento funcional de AVD, reeducación de marchas y escaleras..."
            />

            <FieldTA
              label="Estrategia(s) de Intervención: Participación"
              required
              rows={3}
              value={caso.planIntervencion.participacion}
              onChange={(v) =>
                setCaso({ ...caso, planIntervencion: { ...caso.planIntervencion, participacion: v } })
              }
              placeholder="Ej: Adaptación de la pauta laboral, educación a familiares, plan de pausas activas..."
            />
          </div>
        </SectionCard>

        {/* 7. Pronóstico Incipiente Final */}
        <SectionCard title="7. Pronóstico (Incipiente) Final y Factores Pronósticos" icon="🔮">
          <GuideBox title="Criterio 6 de Rúbrica: Pronóstico Incipiente (5 Puntos)">
            <p>
              El pronóstico debe estar <strong>fundamentado</strong>, guardar relación directa con el <strong>diagnóstico e intervención</strong>,
              e incluir la declaración explícita de <strong>al menos 3 factores pronósticos</strong> (favorables o desfavorables).
            </p>
          </GuideBox>

          <button
            type="button"
            onClick={() => setShowPronosticoExample(!showPronosticoExample)}
            className="text-xs font-semibold text-indigo-600 hover:underline mb-2 block"
          >
            {showPronosticoExample ? "Ocultar ejemplo de pronóstico" : "💡 Ver ejemplo de pronóstico fundamentado"}
          </button>

          {showPronosticoExample && (
            <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 text-xs text-purple-900 space-y-2 mb-4">
              <p><strong>Fundamentación:</strong> "Pronóstico favorable a mediano plazo (4 a 6 semanas) para la recuperación funcional de la marcha y escaleras, sustentado en la respuesta positiva a la modificación de carga y la ausencia de daño estructural irreversible."</p>
              <p><strong>Relación con Diagnóstico/Intervención:</strong> "El plan enfocado en fortalecer el complejo cuádriceps-glúteo ataca directamente el déficit de control motor patelofemoral identificado."</p>
            </div>
          )}

          <FieldTA
            label="Fundamentación del Pronóstico Incipiente"
            required
            rows={4}
            value={caso.pronostico.fundamentacion}
            onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, fundamentacion: v } })}
            placeholder="Fundamenta las expectativas de recuperación del usuario..."
          />

          <FieldTA
            label="Relación con el Diagnóstico e Intervención Propuesta"
            required
            rows={3}
            value={caso.pronostico.relacionDiagnosticoEIntervencion}
            onChange={(v) =>
              setCaso({ ...caso, pronostico: { ...caso.pronostico, relacionDiagnosticoEIntervencion: v } })
            }
            placeholder="Explica cómo las estrategias propuestas respaldan este pronóstico..."
          />

          <div className="pt-2">
            <Label required>Declaración de Factores Pronósticos (Obligatorio al menos 3):</Label>
            <p className="text-xs text-slate-500 mb-3">Indica 3 factores (favorables o desfavorables) que influyen en el pronóstico.</p>
            <div className="space-y-3">
              <FieldInput
                label="Factor Pronóstico 1"
                required
                value={caso.pronostico.factorPronostico1}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico1: v } })}
                placeholder="Ej: (+) Alta motivación y buena adherencia al tratamiento..."
              />
              <FieldInput
                label="Factor Pronóstico 2"
                required
                value={caso.pronostico.factorPronostico2}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico2: v } })}
                placeholder="Ej: (-) Alta exigencia de carga laboral no modificable..."
              />
              <FieldInput
                label="Factor Pronóstico 3"
                required
                value={caso.pronostico.factorPronostico3}
                onChange={(v) => setCaso({ ...caso, pronostico: { ...caso.pronostico, factorPronostico3: v } })}
                placeholder="Ej: (+) Ausencia de comorbilidades estructurales graves..."
              />
            </div>
          </div>
        </SectionCard>

        {/* 8. Autoevaluación */}
        <SectionCard title="8. Autoevaluación de la Práctica" icon="🧠">
          <FieldTA
            label="¿Cuál fue la mayor dificultad experimentada en el diseño de esta intervención?"
            rows={3}
            value={caso.autoevaluacion.mayorDificultad}
            onChange={(v) => setCaso({ ...caso, autoevaluacion: { ...caso.autoevaluacion, mayorDificultad: v } })}
          />
          <FieldTA
            label="¿Qué información o datos consideras que hicieron falta durante la evaluación?"
            rows={3}
            value={caso.autoevaluacion.informacionFaltante}
            onChange={(v) => setCaso({ ...caso, autoevaluacion: { ...caso.autoevaluacion, informacionFaltante: v } })}
          />
          <FieldTA
            label="¿Qué mejoras aplicarías para futuras intervenciones kinesiológicas similares?"
            rows={3}
            value={caso.autoevaluacion.mejoras}
            onChange={(v) => setCaso({ ...caso, autoevaluacion: { ...caso.autoevaluacion, mejoras: v } })}
          />
        </SectionCard>

        {/* Mensaje de error si aplica */}
        {errorMsg && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm font-semibold">
            ⚠️ {errorMsg}
          </div>
        )}

        {/* Botón de Enviar */}
        <div className="flex items-center justify-end gap-4 pb-12">
          <button
            type="submit"
            disabled={enviando}
            className="px-8 py-3.5 bg-gradient-to-r from-teal-600 to-teal-700 hover:from-teal-700 hover:to-teal-800 text-white font-bold text-base rounded-2xl shadow-lg hover:shadow-xl transition disabled:opacity-50 flex items-center gap-2"
          >
            {enviando ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Enviando práctica...
              </>
            ) : (
              <>
                <span>Enviar Informe de Práctica</span>
                <span>➔</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
