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
        className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y placeholder:text-slate-400 min-h-[100px]"
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

// ── CIF Componentes ──────────────────────────────────────────
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
    // Si era texto plano antiguo
    if (raw.trim()) return [{ id: guid(), texto: raw, severidad: "" }];
  }
  return [];
}

function CifCategoryEditor({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: string;
  onChange: (val: string) => void;
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
    <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50">
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
      <p className="text-xs text-slate-500 mb-3">{subtitle}</p>

      {items.length === 0 ? (
        <p className="text-xs text-slate-400 italic bg-white p-3 rounded-lg border border-dashed border-slate-200 text-center">
          No se han agregado ítems. Haz clic en "+ Agregar hallazgo".
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex items-center gap-2 bg-white p-2 rounded-lg border border-slate-200">
              <input
                type="text"
                value={item.texto}
                onChange={(e) => updateItemText(item.id, e.target.value)}
                placeholder="Ej: Restricción en flexión de hombro a 90°..."
                className="flex-1 text-xs text-slate-800 bg-transparent outline-none px-2 py-1"
              />
              <select
                value={item.severidad}
                onChange={(e) => updateItemSeveridad(item.id, e.target.value as Severidad)}
                className="text-xs text-slate-700 border border-slate-200 rounded-md px-2 py-1 outline-none bg-slate-50"
              >
                <option value="">Severidad...</option>
                <option value="leve">Leve</option>
                <option value="moderado">Moderado</option>
                <option value="severo">Severo</option>
                <option value="completo">Completo</option>
              </select>
              <button
                type="button"
                onClick={() => removeItem(item.id)}
                className="text-slate-400 hover:text-red-500 text-sm px-1.5"
                title="Eliminar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── FORMULARIO PRINCIPAL ───────────────────────────────────────────────────
export default function FormularioPracticaDiseno() {
  const STORAGE_KEY = "practica_diseno_borrador_v1";

  const [dupla, setDupla] = useState<DatosEstudianteDupla>({
    estudiante1: "",
    estudiante2: "",
    fechaJornada: new Date().toISOString().split("T")[0],
    centroAtencion: "",
  });

  const [caso, setCaso] = useState<CasoDisenoIntervencion>(casoDisenoVacio());

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

  // Manejo de evaluaciones en el caso
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
      setErrorMsg("Por favor complete los datos básicos de la usuaria y el enunciado diagnóstico.");
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
        <h2 className="text-2xl font-bold text-slate-800">¡Entrega Enviada con Éxito!</h2>
        <p className="text-slate-600 text-sm leading-relaxed">
          Tu informe de <strong>Práctica de Diseño de Intervención</strong> ha sido registrado en la plataforma.
          Tu docente revisará la entrega con la rúbrica de evaluación oficial.
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
      {/* Header */}
      <div className="bg-gradient-to-r from-teal-800 to-slate-900 rounded-3xl p-8 text-white mb-8 shadow-xl">
        <div className="inline-block bg-teal-500/30 text-teal-200 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-3">
          Licenciatura en Kinesiología · UMCE
        </div>
        <h1 className="text-2xl md:text-3xl font-extrabold mb-2">
          Informe de Práctica: Diseño de Intervención
        </h1>
        <p className="text-teal-100/90 text-sm max-w-2xl">
          Módulo de evaluación clínica kinesiológica enfocado en el diagnóstico, objetivos por dimensiones CIF,
          plan estratégico de intervención y pronóstico incipiente.
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        {/* 1. Datos del Estudiante y Centro */}
        <SectionCard title="1. Identificación del Estudiante / Dupla y Centro" icon="👤">
          <GuideBox title="Instrucciones de Identificación">
            <p>
              Indica los nombres completos de los estudiantes a cargo del caso clínico y la institución o centro
              de atención donde se lleva a cabo la práctica.
            </p>
          </GuideBox>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              placeholder="Ej: Polideportivo UMCE, Cesfam, etc."
            />
          </div>
        </SectionCard>

        {/* 2. Datos Usuaria y Motivo Consulta */}
        <SectionCard title="2. Datos de la Persona Atendida y Motivo de Consulta" icon="🩺">
          <GuideBox title="Resguardo de Confidencialidad y Trato Empático">
            <p>
              Resguarda rigurosamente la identidad real de la persona atendida (puedes usar iniciales o primer nombre).
              Describe el contexto de atención y el motivo de consulta expresado de manera directa o funcional.
            </p>
          </GuideBox>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <FieldInput
              label="Nombre / Iniciales de la Persona"
              required
              value={caso.datosUsuaria.nombre}
              onChange={(v) =>
                setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, nombre: v } })
              }
              placeholder="Ej: M.G.O. o María..."
            />
            <FieldInput
              label="Edad"
              value={caso.datosUsuaria.edad}
              onChange={(v) =>
                setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, edad: v } })
              }
              placeholder="Ej: 54 años..."
            />
            <FieldInput
              label="Ocupación"
              value={caso.datosUsuaria.ocupacion}
              onChange={(v) =>
                setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, ocupacion: v } })
              }
              placeholder="Ej: Docente de educación básica..."
            />
            <FieldInput
              label="Contexto de Atención"
              value={caso.datosUsuaria.contextoAtencion}
              onChange={(v) =>
                setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, contextoAtencion: v } })
              }
              placeholder="Ej: Atención ambulatoria kinesiológica..."
            />
          </div>

          <FieldTA
            label="Motivo de Consulta"
            required
            value={caso.datosUsuaria.motivoConsulta}
            onChange={(v) =>
              setCaso({ ...caso, datosUsuaria: { ...caso.datosUsuaria, motivoConsulta: v } })
            }
            placeholder="Describe qué refiere la persona y por qué acude a kinesioterapia..."
          />
        </SectionCard>

        {/* 3. Anamnesis e Interpretación */}
        <SectionCard title="3. Anamnesis e Interpretación Clínico-Funcional" icon="📝">
          <GuideBox title="Guía para la Anamnesis">
            <p>
              Ordena la historia actual, antecedentes mórbidos, hábitos, fármacos y barreras/facilitadores iniciales.
              En la <strong>Interpretación</strong>, explica qué significan clínicamente estos datos para la funcionalidad de la persona.
            </p>
          </GuideBox>

          <FieldTA
            label="Anamnesis Próxima y Remota"
            rows={5}
            value={caso.anamnesis}
            onChange={(v) => setCaso({ ...caso, anamnesis: v })}
            placeholder="Historia clínica, tiempo de evolución, características del dolor o molestia, antecedentes..."
          />

          <FieldTA
            label="Interpretación Clínico-Funcional de la Anamnesis"
            rows={4}
            value={caso.interpretacionAnamnesis}
            onChange={(v) => setCaso({ ...caso, interpretacionAnamnesis: v })}
            placeholder="Relaciona los hallazgos de la anamnesis con la hipótesis kinésica inicial..."
          />
        </SectionCard>

        {/* 4. Evaluaciones Desarrolladas */}
        <SectionCard title="4. Evaluaciones Desarrolladas en el Proceso" icon="📊">
          <GuideBox title="Evaluaciones (Pertinencia, Ejecución e Interpretación)">
            <p>
              <strong>Criterio 3 de Rúbrica:</strong> Se evalúa si las pruebas/tests seleccionados son pertinentes al caso,
              si se ejecutan correctamente y si logras interpretar sus resultados de manera oportuna y fundamentada.
            </p>
          </GuideBox>

          {caso.evaluaciones.map((ev, idx) => (
            <div key={ev.id} className="border border-slate-200 rounded-2xl p-4 bg-slate-50/60 mb-4 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                <span className="font-bold text-slate-800 text-sm">Evaluación #{idx + 1}</span>
                {caso.evaluaciones.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeEvaluacion(ev.id)}
                    className="text-xs text-red-600 hover:underline font-semibold"
                  >
                    Eliminar evaluación
                  </button>
                )}
              </div>

              <FieldInput
                label="Nombre de la Evaluación / Test"
                value={ev.nombre}
                onChange={(v) => updateEvaluacion(ev.id, "nombre", v)}
                placeholder="Ej: Test de Thomas, Goniometría de flexión de cadera, EVA, etc."
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <FieldTA
                  label="Razón / Justificación Clínico-Funcional"
                  rows={2}
                  value={ev.razon}
                  onChange={(v) => updateEvaluacion(ev.id, "razon", v)}
                  placeholder="¿Por qué es pertinente realizar esta prueba en esta persona?"
                />
                <FieldTA
                  label="Resultado Obtenido"
                  rows={2}
                  value={ev.resultado}
                  onChange={(v) => updateEvaluacion(ev.id, "resultado", v)}
                  placeholder="Valores numéricos, rango articular, respuesta al test..."
                />
              </div>

              <FieldTA
                label="Interpretación Oportuna del Resultado"
                rows={2}
                value={ev.interpretacion}
                onChange={(v) => updateEvaluacion(ev.id, "interpretacion", v)}
                placeholder="¿Qué significa este resultado para la capacidad o estructura del usuario?"
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addEvaluacion}
            className="w-full py-2.5 border-2 border-dashed border-teal-300 text-teal-700 font-semibold text-sm rounded-xl hover:bg-teal-50 transition"
          >
            + Agregar otra evaluación
          </button>
        </SectionCard>

        {/* 5. Tabla CIF */}
        <SectionCard title="5. Clasificación Internacional del Funcionamiento (CIF)" icon="🌐">
          <GuideBox title="Matriz CIF y Severidad">
            <p>
              Organiza los hallazgos según el modelo CIF. Selecciona la severidad (Leve, Moderado, Severo, Completo)
              en las dimensiones que corresponda.
            </p>
          </GuideBox>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <CifCategoryEditor
              title="Estructuras Corporales"
              subtitle="Órganos, extremidades y sus componentes"
              value={caso.cif.estructurasCorporales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, estructurasCorporales: val } })}
            />
            <CifCategoryEditor
              title="Funciones Corporales"
              subtitle="Funciones fisiológicas de los sistemas corporales"
              value={caso.cif.funcionesCorporales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, funcionesCorporales: val } })}
            />
            <CifCategoryEditor
              title="Actividades"
              subtitle="Realización de tareas o acciones en la vida cotidiana"
              value={caso.cif.actividades}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, actividades: val } })}
            />
            <CifCategoryEditor
              title="Participación"
              subtitle="Involucramiento en situaciones vitales y roles sociales"
              value={caso.cif.participacion}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, participacion: val } })}
            />
            <CifCategoryEditor
              title="Factores Personales"
              subtitle="Edad, motivación, expectativas, estilo de vida"
              value={caso.cif.factoresPersonales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, factoresPersonales: val } })}
            />
            <CifCategoryEditor
              title="Factores Ambientales"
              subtitle="Entorno físico, apoyo social, barreras/facilitadores"
              value={caso.cif.factoresAmbientales}
              onChange={(val) => setCaso({ ...caso, cif: { ...caso.cif, factoresAmbientales: val } })}
            />
          </div>
        </SectionCard>

        {/* 6. Enunciado Diagnóstico y Objetivos CIF */}
        <SectionCard title="6. Enunciado Diagnóstico y Objetivos de Intervención" icon="🎯">
          <GuideBox title="Guía para Criterio 4: Objetivos de Intervención">
            <p>
              <strong>Requisito Rúbrica:</strong> Los objetivos deben relacionarse claramente con el enunciado diagnóstico
              (clínico o situacional), ser <em>"alcanzables"</em>, y plantear tanto un <strong>Objetivo General</strong> como
              <strong>Objetivos Específicos</strong> orientados a las dimensiones CIF.
            </p>
          </GuideBox>

          <FieldTA
            label="Enunciado Diagnóstico Kinesiológico (Clínico o Situacional)"
            required
            rows={4}
            value={caso.enunciadoDiagnostico}
            onChange={(v) => setCaso({ ...caso, enunciadoDiagnostico: v })}
            placeholder="Formula el diagnóstico kinesiológico relacionando la deficiencia estructural/funcional con la limitación en actividad y restricción en participación..."
          />

          <div className="border-t border-slate-200 pt-4 space-y-4">
            <FieldTA
              label="Objetivo General de Intervención"
              required
              rows={3}
              value={caso.objetivos.objetivoGeneral}
              onChange={(v) =>
                setCaso({ ...caso, objetivos: { ...caso.objetivos, objetivoGeneral: v } })
              }
              placeholder="Formula el objetivo general de manera SMART y centrado en la persona..."
            />

            <h4 className="font-bold text-slate-800 text-sm pt-2">Objetivos Específicos por Dimensión CIF:</h4>

            <FieldTA
              label="Objetivo Específico: Estructuras y Funciones Corporales"
              rows={2}
              value={caso.objetivos.estructurasFunciones}
              onChange={(v) =>
                setCaso({ ...caso, objetivos: { ...caso.objetivos, estructurasFunciones: v } })
              }
              placeholder="Ej: Aumentar rango de movimiento articular en flexión de hombro a 140°..."
            />

            <FieldTA
              label="Objetivo Específico: Actividades"
              rows={2}
              value={caso.objetivos.actividades}
              onChange={(v) =>
                setCaso({ ...caso, objetivos: { ...caso.objetivos, actividades: v } })
              }
              placeholder="Ej: Mejorar la capacidad de vestirse de manera independiente..."
            />

            <FieldTA
              label="Objetivo Específico: Participación"
              rows={2}
              value={caso.objetivos.participacion}
              onChange={(v) =>
                setCaso({ ...caso, objetivos: { ...caso.objetivos, participacion: v } })
              }
              placeholder="Ej: Reintegrar a la persona en sus actividades laborales/recreativas..."
            />
          </div>
        </SectionCard>

        {/* 7. Plan de Intervención */}
        <SectionCard title="7. Plan de Intervención Propuesto (Estrategias CIF)" icon="🛠️">
          <GuideBox title="Guía para Criterio 5: Plan de Intervención (Máx 3 pts)">
            <p>
              El plan de intervención propuesto debe ser <strong>coherente con los objetivos propuestos</strong> y
              considerar <strong>al menos una estrategia de intervención para cada dimensión CIF</strong> (Estructuras/Funciones,
              Actividades y Participación).
            </p>
          </GuideBox>

          <div className="space-y-4">
            <FieldTA
              label="Estrategia(s) para Estructuras y Funciones Corporales"
              required
              rows={3}
              value={caso.planIntervencion.estructurasFunciones}
              onChange={(v) =>
                setCaso({
                  ...caso,
                  planIntervencion: { ...caso.planIntervencion, estructurasFunciones: v },
                })
              }
              placeholder="Ej: Movilización articular pasiva/activa, dosificación de ejercicio terapéutico, agentes electrofísicos..."
            />

            <FieldTA
              label="Estrategia(s) para Actividades"
              required
              rows={3}
              value={caso.planIntervencion.actividades}
              onChange={(v) =>
                setCaso({
                  ...caso,
                  planIntervencion: { ...caso.planIntervencion, actividades: v },
                })
              }
              placeholder="Ej: Entrenamiento funcional de AVD, reeducación del patrón de marcha, tareas orientadas a metas..."
            />

            <FieldTA
              label="Estrategia(s) para Participación"
              required
              rows={3}
              value={caso.planIntervencion.participacion}
              onChange={(v) =>
                setCaso({
                  ...caso,
                  planIntervencion: { ...caso.planIntervencion, participacion: v },
                })
              }
              placeholder="Ej: Adaptación ergonómica del puesto de trabajo, educación a cuidadores/familia, plan de pausas activas..."
            />
          </div>
        </SectionCard>

        {/* 8. Pronóstico Incipiente Final */}
        <SectionCard title="8. Pronóstico (Incipiente) Final y Factores Pronósticos" icon="🔮">
          <GuideBox title="Guía para Criterio 6: Pronóstico Incipiente (5 pts)">
            <p>
              Para obtener la máxima calificación, el pronóstico debe estar <strong>fundamentado</strong>,
              mantener relación con el <strong>diagnóstico y la intervención propuesta</strong>, e incluir la declaración explícita de
              <strong> al menos 3 factores pronósticos</strong> (favorables o desfavorables).
            </p>
          </GuideBox>

          <FieldTA
            label="Fundamentación del Pronóstico Incipiente"
            required
            rows={4}
            value={caso.pronostico.fundamentacion}
            onChange={(v) =>
              setCaso({
                ...caso,
                pronostico: { ...caso.pronostico, fundamentacion: v },
              })
            }
            placeholder="Explica la expectativa de recuperación funcional basándote en la evidencia, la respuesta biológica esperada y la adaptabilidad de la persona..."
          />

          <FieldTA
            label="Relación con el Diagnóstico e Intervención Propuesta"
            required
            rows={3}
            value={caso.pronostico.relacionDiagnosticoEIntervencion}
            onChange={(v) =>
              setCaso({
                ...caso,
                pronostico: { ...caso.pronostico, relacionDiagnosticoEIntervencion: v },
              })
            }
            placeholder="¿Por qué las estrategias seleccionadas respaldan este pronóstico?"
          />

          <div className="pt-2">
            <Label required>Factores Pronósticos (Al menos 3 requeridos):</Label>
            <div className="space-y-3 mt-2">
              <FieldInput
                label="Factor Pronóstico 1"
                required
                value={caso.pronostico.factorPronostico1}
                onChange={(v) =>
                  setCaso({
                    ...caso,
                    pronostico: { ...caso.pronostico, factorPronostico1: v },
                  })
                }
                placeholder="Ej: Alta motivación y adherencia al tratamiento (Favorables)..."
              />
              <FieldInput
                label="Factor Pronóstico 2"
                required
                value={caso.pronostico.factorPronostico2}
                onChange={(v) =>
                  setCaso({
                    ...caso,
                    pronostico: { ...caso.pronostico, factorPronostico2: v },
                  })
                }
                placeholder="Ej: Presencia de comorbilidad metabólica descompensada (Desfavorable)..."
              />
              <FieldInput
                label="Factor Pronóstico 3"
                required
                value={caso.pronostico.factorPronostico3}
                onChange={(v) =>
                  setCaso({
                    ...caso,
                    pronostico: { ...caso.pronostico, factorPronostico3: v },
                  })
                }
                placeholder="Ej: Excelente red de apoyo familiar (Favorable)..."
              />
            </div>
          </div>
        </SectionCard>

        {/* 9. Autoevaluación */}
        <SectionCard title="9. Autoevaluación de la Práctica" icon="🧠">
          <FieldTA
            label="¿Cuál fue la mayor dificultad experimentada en el diseño de esta intervención?"
            rows={3}
            value={caso.autoevaluacion.mayorDificultad}
            onChange={(v) =>
              setCaso({
                ...caso,
                autoevaluacion: { ...caso.autoevaluacion, mayorDificultad: v },
              })
            }
          />
          <FieldTA
            label="¿Qué información o datos consideras que hicieron falta durante la evaluación?"
            rows={3}
            value={caso.autoevaluacion.informacionFaltante}
            onChange={(v) =>
              setCaso({
                ...caso,
                autoevaluacion: { ...caso.autoevaluacion, informacionFaltante: v },
              })
            }
          />
          <FieldTA
            label="¿Qué mejoras aplicarías para futuras intervenciones kinesiológicas similares?"
            rows={3}
            value={caso.autoevaluacion.mejoras}
            onChange={(v) =>
              setCaso({
                ...caso,
                autoevaluacion: { ...caso.autoevaluacion, mejoras: v },
              })
            }
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
