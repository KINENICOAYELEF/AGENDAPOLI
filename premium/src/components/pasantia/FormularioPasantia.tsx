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
    <div className="mt-2 text-xs text-teal-800 bg-teal-50 border border-teal-200 rounded-lg px-3.5 py-2.5 leading-relaxed">
      {children}
    </div>
  );
}

function GuideBox({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-xs text-blue-900 space-y-1.5 leading-relaxed">
      <p className="font-bold text-sm text-blue-800 mb-2">{title}</p>
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
  rows = 6,
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
        className="w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none transition resize-y placeholder:text-slate-400 min-h-[120px]"
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
    <SectionCard title="1. Datos generales de la persona atendida" icon="🧑‍⚕️">
      <HelpText>
        Registra los datos básicos que permitan entender quién es la persona y por qué está siendo atendida. No escribas información innecesaria ni datos sensibles que no aporten al caso.
      </HelpText>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <FieldInput label="Nombre o iniciales" value={data.nombre} onChange={(v) => set("nombre", v)} required placeholder="Ej: M.G. o María G." />
        <FieldInput label="Edad" value={data.edad} onChange={(v) => set("edad", v)} required placeholder="Ej: 42 años" />
        <FieldInput label="Ocupación o actividad principal" value={data.ocupacion} onChange={(v) => set("ocupacion", v)} required placeholder="Ej: Auxiliar de aseo, estudiante, deportista recreativa..." />
        <FieldInput label="Contexto de atención" value={data.contextoAtencion} onChange={(v) => set("contextoAtencion", v)} required placeholder="Ej: CESFAM, centro comunitario, hospital, clínica privada..." />
      </div>
      <FieldTA
        label="Motivo principal de consulta o atención"
        value={data.motivoConsulta}
        onChange={(v) => set("motivoConsulta", v)}
        required
        rows={4}
        placeholder="Describe brevemente el motivo de la consulta según lo que la persona refiere. Ej: &quot;Consulta por dolor en rodilla derecha que le dificulta caminar y subir escaleras desde hace 3 semanas&quot;..."
      />
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
    <SectionCard title="2. Anamnesis / Entrevista clínica" icon="🗣️">
      <GuideBox title="¿Qué se espera en esta sección?">
        <p>Escriban la <strong>entrevista clínica completa</strong> que realizaron como tratantes. Incluyan la anamnesis próxima (problema actual) y remota (antecedentes). La anamnesis debe intentar responder, de forma simple:</p>
        <div className="mt-2 ml-2 space-y-0.5">
          {[
            "¿Cuál es el problema principal que refiere la persona?",
            "¿Desde cuándo ocurre? ¿Cómo comenzó?",
            "¿Cómo ha evolucionado? ¿Ha cambiado en intensidad o frecuencia?",
            "¿Qué actividades le molestan, le cuestan o ya no puede hacer?",
            "¿Qué cosas alivian o aumentan el problema?",
            "¿Ha tenido tratamientos previos? ¿Cuáles? ¿Funcionaron?",
            "¿Qué antecedentes remotos relevantes tiene (enfermedades, cirugías, otros problemas)?",
            "¿Qué espera lograr con esta atención? ¿Cuáles son sus expectativas?",
          ].map((q) => (
            <p key={q} className="flex gap-2">
              <span className="text-blue-400 shrink-0">›</span> <span>{q}</span>
            </p>
          ))}
        </div>
        <p className="mt-2 font-semibold">Escriban todo lo que obtuvieron, de forma ordenada. No es necesario usar formato de pregunta-respuesta.</p>
      </GuideBox>

      <FieldTA
        label="Anamnesis próxima y remota realizada"
        value={data.anamnesis}
        onChange={(v) => onChange("anamnesis", v)}
        required
        rows={12}
        placeholder="Escriban aquí la entrevista clínica completa que realizaron con la persona atendida. Incluyan tanto la historia del problema actual (anamnesis próxima) como los antecedentes relevantes (anamnesis remota). Pueden usar la guía de arriba como referencia para no olvidar información importante..."
      />

      <div className="border-t border-slate-200 pt-5">
        <GuideBox title="¿Qué es la interpretación de la anamnesis?">
          <p>No repitan la anamnesis. Aquí deben analizar como tratantes: <strong>¿qué datos les parecen más relevantes y por qué?</strong></p>
          <p className="mt-1.5">Piensen: si tuvieran que explicarle a otro kinesiólogo en 30 segundos lo más importante de este caso antes de ver al paciente, ¿qué le dirían?</p>
          <p className="mt-1.5 italic text-blue-700">Ejemplo: &quot;Lo más relevante es que el dolor aumenta al subir escaleras y al ponerse de pie después de estar sentada mucho rato. Lleva 3 semanas y va en aumento. No tiene antecedentes traumáticos, por lo que podría tratarse de una sobrecarga progresiva. La persona trabaja 8 horas sentada y tiene poca actividad física, lo cual es un factor importante a considerar. Quiere volver a caminar sin dolor para retomar sus caminatas con su hija.&quot;</p>
        </GuideBox>

        <div className="mt-4">
          <FieldTA
            label="Interpretación de la anamnesis (análisis del tratante)"
            value={data.interpretacionAnamnesis}
            onChange={(v) => onChange("interpretacionAnamnesis", v)}
            required
            rows={8}
            placeholder="Expliquen como tratantes: ¿Qué datos de la entrevista les parecen más relevantes clínicamente? ¿Por qué? ¿Qué hipótesis empiezan a formarse? ¿Qué datos les faltaron o les gustaría profundizar?..."
          />
        </div>
      </div>
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
    <SectionCard title="3. Evaluaciones simples realizadas por el tratante" icon="📋">
      <GuideBox title="¿Qué tipo de evaluaciones se esperan?">
        <p>Las evaluaciones deben ser <strong>simples, seguras y pertinentes al caso</strong>. Son las que ustedes como tratantes decidieron realizar para obtener información objetiva sobre el problema.</p>
        <p className="mt-1.5">Pueden ser:</p>
        <div className="mt-1 ml-2 space-y-0.5">
          {[
            "Observación del movimiento o la postura",
            "Rango de movimiento activo (ROM)",
            "Evaluación del dolor durante una tarea (EVA, escala numérica)",
            "Prueba de fuerza manual básica",
            "Evaluación de equilibrio básico (Romberg, apoyo unipodal)",
            "Evaluación de marcha",
            "Prueba de transferencias (sentado a parado, etc.)",
            "Tarea funcional relevante (agacharse, alcanzar, subir escalera)",
            "Otra evaluación pertinente al caso",
          ].map((q) => (
            <p key={q} className="flex gap-2">
              <span className="text-blue-400 shrink-0">›</span> <span>{q}</span>
            </p>
          ))}
        </div>
        <p className="mt-2 font-semibold">Registren entre 2 y 4 evaluaciones. Cada una debe tener: nombre, razón de elección, resultado e interpretación.</p>
      </GuideBox>

      <div className="space-y-5">
        {evaluaciones.map((ev, idx) => (
          <div key={ev.id} className="border border-slate-200 rounded-xl p-5 bg-slate-50 relative">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider">Evaluación {idx + 1}</span>
              {evaluaciones.length > 2 && (
                <button type="button" onClick={() => remove(ev.id)} className="text-xs text-red-400 hover:text-red-600 transition font-medium">
                  ✕ Eliminar
                </button>
              )}
            </div>
            <div className="space-y-3">
              <FieldInput label="Nombre de la evaluación" value={ev.nombre} onChange={(v) => update(ev.id, "nombre", v)} required placeholder="Ej: Rango de movimiento activo de flexión de rodilla derecha" />
              <FieldTA label="¿Por qué eligieron esta evaluación?" value={ev.razon} onChange={(v) => update(ev.id, "razon", v)} required rows={3} placeholder="Ej: Porque la persona refiere dolor al flectar la rodilla y queremos cuantificar la limitación de movimiento activo antes de intervenir..." />
              <FieldInput label="Resultado obtenido" value={ev.resultado} onChange={(v) => update(ev.id, "resultado", v)} required placeholder="Ej: Flexión activa 90° (contralateral 135°), dolor 6/10 al final del rango" />
              <FieldTA label="Interpretación inmediata del resultado" value={ev.interpretacion} onChange={(v) => update(ev.id, "interpretacion", v)} required rows={4} placeholder="Ej: La limitación de 90° de flexión activa con dolor al final del rango indica una restricción significativa de movilidad, probablemente asociada a dolor y/o rigidez articular. Esto es relevante porque la persona necesita al menos 110° de flexión para subir escaleras con normalidad, lo cual es su actividad más limitada..." />
            </div>
          </div>
        ))}
      </div>
      {evaluaciones.length < 4 && (
        <button
          type="button"
          onClick={add}
          className="mt-3 w-full py-3 border-2 border-dashed border-teal-300 text-teal-600 font-semibold text-sm rounded-xl hover:bg-teal-50 transition"
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
    <SectionCard title="4. Hallazgos principales del tratante" icon="🔍">
      <GuideBox title="¿Qué poner aquí?">
        <p>Seleccionen <strong>solo los 3 datos más importantes</strong> de la entrevista y la evaluación que hicieron. No escriban todo. Elijan lo que realmente ayuda a entender el caso como tratantes.</p>
        <p className="mt-1.5 italic text-blue-700">Ejemplo de un buen hallazgo: &quot;Limitación significativa de flexión activa de rodilla derecha (90° vs 135° contralateral) con dolor 6/10 al final del rango, lo que dificulta subir escaleras y agacharse.&quot;</p>
      </GuideBox>
      <FieldTA label="Hallazgo 1 (el más relevante)" value={data.hallazgo1} onChange={(v) => onChange("hallazgo1", v)} required rows={3} placeholder="El hallazgo más importante que encontraron como tratantes..." />
      <FieldTA label="Hallazgo 2" value={data.hallazgo2} onChange={(v) => onChange("hallazgo2", v)} required rows={3} placeholder="Segundo hallazgo relevante..." />
      <FieldTA label="Hallazgo 3" value={data.hallazgo3} onChange={(v) => onChange("hallazgo3", v)} required rows={3} placeholder="Tercer hallazgo relevante..." />
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
  return (
    <SectionCard title="5. Tabla CIF – Clasificación del caso" icon="📊">
      <GuideBox title="Guía para completar la CIF">
        <p>La CIF (Clasificación Internacional del Funcionamiento) sirve para <strong>ordenar y organizar el caso de forma profesional</strong>. No es solo poner una lesión o un diagnóstico médico.</p>
        <p className="mt-1.5">Deben separar la información en 6 componentes. Cada componente responde a una pregunta diferente. <strong>No mezclen la información</strong> — lo que va en &quot;estructuras&quot; no va en &quot;funciones&quot;, y lo que va en &quot;actividades&quot; no va en &quot;participación&quot;.</p>
        <div className="mt-2 bg-white border border-blue-200 rounded-lg p-3 space-y-1.5">
          <p className="font-bold text-blue-700">Resumen rápido:</p>
          <p>🦴 <strong>Estructuras</strong> = ¿Qué parte del cuerpo está comprometida? (tejidos físicos)</p>
          <p>⚡ <strong>Funciones</strong> = ¿Qué capacidad está alterada? (dolor, fuerza, movilidad, etc.)</p>
          <p>🚶 <strong>Actividades</strong> = ¿Qué tareas concretas no puede hacer bien? (acciones)</p>
          <p>👥 <strong>Participación</strong> = ¿Cómo afecta esto a su vida real? (roles, rutina)</p>
          <p>🧠 <strong>F. Personales</strong> = ¿Qué características de la persona influyen? (no se codifican en CIF)</p>
          <p>🏠 <strong>F. Ambientales</strong> = ¿Qué del entorno ayuda o dificulta? (recursos, barreras)</p>
        </div>
      </GuideBox>

      {/* Estructuras */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          🦴 A. Estructuras corporales <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-0.5 italic">¿Qué estructuras del cuerpo podrían estar relacionadas con el problema?</p>
        <HelpText>
          Piensen en tejidos, articulaciones, huesos, músculos, tendones, ligamentos, nervios, cápsulas o sistemas que podrían estar comprometidos. Deben tener una razón real para mencionarlos (algo de la entrevista o evaluación que lo sugiera).
          <br/><br/>
          <strong>Ejemplos:</strong> Complejo patelofemoral derecho · Tendón rotuliano · Musculatura cuadricipital · Ligamento colateral medial · Columna lumbar (segmentos L4-L5) · Manguito rotador · Nervio mediano · Fascia plantar · Cápsula articular glenohumeral.
        </HelpText>
        <textarea
          rows={4}
          value={data.estructurasCorporales}
          onChange={(e) => onChange("estructurasCorporales", e.target.value)}
          placeholder="Escriban las estructuras que podrían estar involucradas en el problema, según lo que obtuvieron en la entrevista y evaluación..."
          className="mt-3 w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y placeholder:text-slate-400 min-h-[100px]"
        />
      </div>

      {/* Funciones */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          ⚡ B. Funciones corporales <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-0.5 italic">¿Qué funciones corporales están alteradas?</p>
        <HelpText>
          Las funciones son <strong>capacidades del cuerpo</strong> que están disminuidas o alteradas. No son estructuras ni actividades. Idealmente indiquen la severidad (leve, moderado, severo).
          <br/><br/>
          <strong>Ejemplos:</strong> Dolor moderado en región anterior de rodilla (EVA 6/10) · Disminución moderada de rango de movimiento de flexión de rodilla · Déficit leve de fuerza de cuádriceps · Alteración moderada de control motor dinámico de rodilla · Disminución de tolerancia a carga en miembro inferior · Alteración de equilibrio dinámico · Edema leve periarticular · Alteración de propiocepción.
        </HelpText>
        <textarea
          rows={4}
          value={data.funcionesCorporales}
          onChange={(e) => onChange("funcionesCorporales", e.target.value)}
          placeholder="Escriban las funciones corporales que encontraron alteradas, con severidad si es posible..."
          className="mt-3 w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y placeholder:text-slate-400 min-h-[100px]"
        />
      </div>

      {/* Actividades */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          🚶 C. Actividades limitadas <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-0.5 italic">¿Qué actividades concretas están limitadas?</p>
        <HelpText>
          Las actividades son <strong>tareas y acciones concretas</strong> que la persona tiene dificultad para hacer. Son verbos o acciones, no diagnósticos. Idealmente indiquen la severidad.
          <br/><br/>
          <strong>Ejemplos:</strong> Subir escaleras (limitación moderada) · Caminar distancias largas (&gt;500m, limitación leve) · Agacharse a recoger objetos (limitación moderada) · Sentarse y levantarse de silla baja (limitación severa) · Correr (limitación completa) · Vestirse la parte inferior del cuerpo (limitación leve) · Permanecer de pie por más de 30 minutos.
        </HelpText>
        <textarea
          rows={4}
          value={data.actividades}
          onChange={(e) => onChange("actividades", e.target.value)}
          placeholder="Escriban las actividades concretas que la persona tiene dificultad para realizar..."
          className="mt-3 w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y placeholder:text-slate-400 min-h-[100px]"
        />
      </div>

      {/* Participación */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          👥 D. Restricción de participación <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-0.5 italic">¿En qué roles o situaciones de la vida participa menos o con dificultad?</p>
        <HelpText>
          La participación se refiere al <strong>impacto en la vida real de la persona</strong>: sus roles, su rutina y las cosas que le importan. No es lo mismo que actividades (subir escaleras es una actividad; no poder ir al trabajo porque hay escaleras es participación).
          <br/><br/>
          <strong>Ejemplos:</strong> Restricción moderada en participación laboral (no puede completar jornada por dolor) · No participa en actividades deportivas recreativas · Dificultad para cumplir rol de cuidadora de hijos (no puede agacharse a recogerlos) · Restricción severa en actividades sociales (dejó de salir con amigos) · Limitación en independencia para actividades del hogar.
        </HelpText>
        <textarea
          rows={4}
          value={data.participacion}
          onChange={(e) => onChange("participacion", e.target.value)}
          placeholder="Escriban cómo el problema afecta la participación de la persona en su vida real..."
          className="mt-3 w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y placeholder:text-slate-400 min-h-[100px]"
        />
      </div>

      {/* Factores personales */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          🧠 E. Factores personales <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-0.5 italic">¿Qué factores propios de la persona pueden influir en el caso?</p>
        <HelpText>
          Características internas de la persona que <strong>facilitan o dificultan</strong> su recuperación. Separen facilitadores y barreras si pueden.
          <br/><br/>
          <strong>Facilitadores:</strong> Alta motivación · Buena comprensión del problema · Experiencia deportiva previa · Adherente a indicaciones · Expectativas realistas · Joven y activa.
          <br/>
          <strong>Barreras:</strong> Miedo al movimiento · Baja autoeficacia · Expectativas irreales · Mala adherencia previa · Sedentarismo · Experiencias negativas con tratamientos anteriores · Creencias limitantes sobre el dolor.
        </HelpText>
        <textarea
          rows={4}
          value={data.factoresPersonales}
          onChange={(e) => onChange("factoresPersonales", e.target.value)}
          placeholder="Describan los factores personales de esta persona que podrían facilitar o dificultar su recuperación..."
          className="mt-3 w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y placeholder:text-slate-400 min-h-[100px]"
        />
      </div>

      {/* Factores ambientales */}
      <div className="border border-slate-200 rounded-xl p-5 bg-slate-50">
        <label className="block text-sm font-bold text-slate-700 mb-1.5">
          🏠 F. Factores ambientales <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-slate-500 mb-0.5 italic">¿Qué factores del entorno pueden ayudar o dificultar la situación?</p>
        <HelpText>
          Elementos del <strong>entorno o contexto externo</strong> que facilitan o son barreras para la recuperación.
          <br/><br/>
          <strong>Facilitadores:</strong> Apoyo familiar presente · Acceso a gimnasio o espacio para ejercicio · Entrenador colaborador · Horario flexible · Buena red de apoyo.
          <br/>
          <strong>Barreras:</strong> Trabajo físico pesado que no puede modificar · Vive en tercer piso sin ascensor · Largos traslados diarios · Poco tiempo disponible para rehabilitación · Presión laboral por competir o reintegrarse · Falta de acceso a transporte.
        </HelpText>
        <textarea
          rows={4}
          value={data.factoresAmbientales}
          onChange={(e) => onChange("factoresAmbientales", e.target.value)}
          placeholder="Describan los factores del entorno que podrían facilitar o dificultar la recuperación de esta persona..."
          className="mt-3 w-full px-3.5 py-3 border border-slate-300 rounded-xl text-sm text-slate-800 focus:ring-2 focus:ring-teal-500 focus:border-teal-500 outline-none resize-y placeholder:text-slate-400 min-h-[100px]"
        />
      </div>
    </SectionCard>
  );
}

// ─── Sección 6: Diagnóstico ───────────────────────────────────────────────────
function SeccionDiagnostico({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <SectionCard title="6. Diagnóstico kinesiológico incipiente" icon="🎯">
      <GuideBox title="¿Qué es un diagnóstico kinesiológico?">
        <p>Un diagnóstico kinesiológico <strong>NO es decir &quot;tiene tendinitis&quot;, &quot;tiene esguince&quot; o &quot;tiene dolor lumbar&quot;</strong>. Eso es un diagnóstico médico.</p>
        <p className="mt-1.5">Un diagnóstico kinesiológico desde la perspectiva del tratante debe explicar:</p>
        <div className="mt-1 ml-2 space-y-0.5">
          {[
            "1. Quién es la persona y qué exige su vida.",
            "2. Qué problema refiere (desde su perspectiva).",
            "3. Qué encontramos nosotros como tratantes en la evaluación.",
            "4. Qué estructuras o sistemas podrían estar comprometidos.",
            "5. Qué actividades están limitadas y cómo afecta su vida.",
            "6. Qué factores facilitan o dificultan la situación.",
            "7. Cuál es el problema principal que la kinesiología debe abordar.",
            "8. Qué objetivo general guiará la intervención.",
          ].map((l) => (
            <p key={l} className="flex gap-2">
              <span className="text-blue-400 shrink-0">›</span> <span>{l}</span>
            </p>
          ))}
        </div>
      </GuideBox>

      {/* Plantilla completa visible */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-5 text-xs text-indigo-900 space-y-4">
        <p className="font-bold text-sm text-indigo-800">📝 Plantilla de referencia – úsenla como guía para redactar</p>
        <p className="text-indigo-600 text-xs italic">No tienen que copiarla textualmente. Es una estructura para que no se les olvide ningún componente. Adapten cada sección al caso real.</p>

        <div className="space-y-4 bg-white border border-indigo-200 rounded-lg p-4">
          <div>
            <p className="font-bold text-indigo-700">1. Identificación y contexto relevante</p>
            <p className="text-slate-600 italic mt-1">[Nombre o iniciales], [edad], [sexo], [ocupación o rol principal], [deporte o actividad relevante si aplica], consulta por [motivo principal] de [tiempo de evolución]. El cuadro se asocia a [mecanismo de lesión, sobrecarga, cirugía o antecedente relevante si corresponde].</p>
          </div>
          <div>
            <p className="font-bold text-indigo-700">2. Problemas identificados por la persona (usuario/paciente)</p>
            <p className="text-slate-600 italic mt-1">Desde la perspectiva de la persona atendida, el problema se expresa principalmente como dificultad para [actividad 1], [actividad 2] y [actividad 3], con severidad [leve/moderada/severa/completa]. Esto restringe su participación en [trabajo/deporte/estudio/rol familiar/actividad significativa].</p>
          </div>
          <div>
            <p className="font-bold text-indigo-700">3. Problemas identificados por el tratante</p>
            <p className="text-slate-600 italic mt-1">Desde nuestra evaluación kinesiológica como tratantes, el cuadro compromete predominantemente el sistema [musculoesquelético/neuromuscular/sensorimotor/cardiorrespiratorio/mixto].</p>
            <p className="text-slate-600 italic mt-1">A nivel de <strong>estructuras corporales</strong>, presenta compromiso [confirmado/probable/sospechado] de [estructura o tejido], sustentado por [qué evidencia de la evaluación lo sugiere].</p>
            <p className="text-slate-600 italic mt-1">A nivel de <strong>funciones corporales alteradas</strong>, se identifican: [dolor: severidad], [movilidad: severidad], [fuerza: severidad], [control motor: severidad], [tolerancia a carga: severidad] y/u otros hallazgos como [edema, equilibrio, propiocepción, sensibilidad, coordinación, resistencia].</p>
          </div>
          <div>
            <p className="font-bold text-indigo-700">4. Factores contextuales</p>
            <p className="text-slate-600 italic mt-1">Como factores personales relevantes destacan [facilitadores personales] y [barreras personales]. Como factores ambientales relevantes destacan [facilitadores ambientales] y [barreras ambientales].</p>
          </div>
          <div>
            <p className="font-bold text-indigo-700">5. Problema principal kinesiológico</p>
            <p className="text-slate-600 italic mt-1">El problema principal corresponde a [alteración funcional central] asociada a [hipótesis clínica, estructura o sistema comprometido], lo que limita [actividades principales] y restringe [participación relevante].</p>
          </div>
          <div>
            <p className="font-bold text-indigo-700">6. Objetivo general</p>
            <p className="text-slate-600 italic mt-1">[Verbo] + [problema funcional principal] + para [actividad o participación que se busca recuperar].</p>
            <p className="text-slate-500 italic mt-1">Ejemplo: &quot;Mejorar la tolerancia a carga del miembro inferior derecho para permitir subir escaleras, caminar distancias largas y retomar la jornada laboral completa sin dolor limitante.&quot;</p>
          </div>
        </div>
      </div>

      <div className="mt-5">
        <FieldTA
          label="Diagnóstico kinesiológico incipiente redactado por la dupla"
          value={value}
          onChange={onChange}
          required
          rows={16}
          placeholder="Redacten aquí su diagnóstico kinesiológico completo como tratantes. Usen la plantilla de arriba como guía para no olvidar componentes. Incluyan: identificación del caso, problemas del paciente, hallazgos del tratante (estructuras y funciones), factores contextuales, problema principal kinesiológico y objetivo general..."
        />
      </div>
    </SectionCard>
  );
}

// ─── Bloque Caso completo ────────────────────────────────────────────────────
function BloqueCaso({ numero, caso, onChange }: { numero: number; caso: CasoClinco; onChange: (c: CasoClinco) => void }) {
  const set = <K extends keyof CasoClinco>(key: K, val: CasoClinco[K]) => onChange({ ...caso, [key]: val });

  return (
    <div className="mb-10">
      <div className="flex items-center gap-3 mb-6 sticky top-[72px] bg-gradient-to-r from-slate-50 via-teal-50/30 to-cyan-50/20 py-3 z-10">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-black text-lg shadow-md ring-4 ring-white">
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
    </div>
  );
}

// ─── Validación ──────────────────────────────────────────────────────────────
function validateCaso(caso: CasoClinco, num: number): string[] {
  const errors: string[] = [];
  const p = `Caso ${num}`;
  if (!caso.datosUsuaria.nombre.trim()) errors.push(`${p}: Nombre de la persona atendida`);
  if (!caso.datosUsuaria.edad.trim()) errors.push(`${p}: Edad`);
  if (!caso.datosUsuaria.ocupacion.trim()) errors.push(`${p}: Ocupación`);
  if (!caso.datosUsuaria.contextoAtencion.trim()) errors.push(`${p}: Contexto de atención`);
  if (!caso.datosUsuaria.motivoConsulta.trim()) errors.push(`${p}: Motivo de consulta`);
  if (!caso.anamnesis.trim()) errors.push(`${p}: Anamnesis`);
  if (!caso.interpretacionAnamnesis.trim()) errors.push(`${p}: Interpretación de la anamnesis`);
  if (caso.evaluaciones.length < 2) errors.push(`${p}: Se requieren al menos 2 evaluaciones`);
  caso.evaluaciones.forEach((ev, i) => {
    if (!ev.nombre.trim()) errors.push(`${p} Evaluación ${i + 1}: Nombre`);
    if (!ev.resultado.trim()) errors.push(`${p} Evaluación ${i + 1}: Resultado`);
    if (!ev.interpretacion.trim()) errors.push(`${p} Evaluación ${i + 1}: Interpretación`);
  });
  if (!caso.hallazgo1.trim() || !caso.hallazgo2.trim() || !caso.hallazgo3.trim())
    errors.push(`${p}: Los 3 hallazgos principales son obligatorios`);
  if (Object.values(caso.cif).some((v) => !v.trim())) errors.push(`${p}: Todos los campos de la tabla CIF son obligatorios`);
  if (!caso.diagnosticoKinesiologico.trim()) errors.push(`${p}: Diagnóstico kinesiológico`);
  return errors;
}

// ─── FORMULARIO PRINCIPAL (una sola página) ──────────────────────────────────
export default function FormularioPasantia() {
  const [dupla, setDupla] = useState<DatosDupla>({ estudiante1: "", estudiante2: "", fechaJornada: "", centroAtencion: "" });
  const [caso1, setCaso1] = useState<CasoClinco>(casoClincoVacio);
  const [caso2, setCaso2] = useState<CasoClinco>(casoClincoVacio);
  const [sending, setSending] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const [entregaId, setEntregaId] = useState<string>("");
  const [enviado, setEnviado] = useState(false);

  // AutoSave
  useEffect(() => {
    try { localStorage.setItem("pasantia_draft", JSON.stringify({ dupla, caso1, caso2 })); } catch {/* */}
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
    } catch {/* */}
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
      setEnviado(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      console.error(err);
      setErrors(["Error al enviar: " + (err instanceof Error ? err.message : "Error desconocido")]);
    } finally {
      setSending(false);
    }
  }, [dupla, caso1, caso2]);

  // ─── Pantalla de éxito ──────────────────────────────────────────────────────
  if (enviado) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-100 flex items-center justify-center p-6">
        <div className="bg-white rounded-3xl shadow-xl p-10 max-w-lg w-full text-center space-y-5">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto">
            <span className="text-4xl">✅</span>
          </div>
          <h1 className="text-2xl font-black text-slate-800">¡Entrega enviada con éxito!</h1>
          <p className="text-slate-600">Tu ficha fue registrada correctamente. El docente recibirá tu entrega y la revisará con rúbrica.</p>
          <div className="bg-slate-100 rounded-xl p-4 text-xs text-slate-500 font-mono break-all">
            ID de entrega: {entregaId}
          </div>
          <p className="text-xs text-slate-400">Guarda este ID como comprobante de entrega.</p>
        </div>
      </div>
    );
  }

  // ─── Formulario completo en una sola página ────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-teal-50/30 to-cyan-50/20">
      {/* Header */}
      <header className="bg-gradient-to-r from-teal-700 to-cyan-700 text-white py-6 px-4 shadow-lg">
        <div className="max-w-3xl mx-auto">
          <p className="text-teal-200 text-xs font-semibold uppercase tracking-wider mb-1">Pasantía 2º Año · Kinesiología</p>
          <h1 className="text-lg md:text-xl font-black leading-tight">
            Ficha de Observación, Entrevista, Evaluación Inicial y Razonamiento Kinésico Básico
          </h1>
          <p className="text-teal-100 text-sm mt-2 opacity-80">Entrega por dupla · 2 casos clínicos</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8">
        {/* Error Banner */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-300 rounded-2xl p-5 mb-8">
            <p className="font-bold text-red-700 mb-2">⚠️ Completa los campos obligatorios antes de enviar:</p>
            <ul className="list-disc list-inside space-y-1">
              {errors.map((e) => (
                <li key={e} className="text-sm text-red-600">{e}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Datos Dupla */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4 mb-8">
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">👫 Datos de la dupla</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FieldInput label="Nombre Estudiante 1" value={dupla.estudiante1} onChange={(v) => setDupla({ ...dupla, estudiante1: v })} required />
            <FieldInput label="Nombre Estudiante 2" value={dupla.estudiante2} onChange={(v) => setDupla({ ...dupla, estudiante2: v })} required />
            <FieldInput label="Fecha de la jornada" value={dupla.fechaJornada} onChange={(v) => setDupla({ ...dupla, fechaJornada: v })} required type="date" />
            <FieldInput label="Centro de atención (opcional)" value={dupla.centroAtencion || ""} onChange={(v) => setDupla({ ...dupla, centroAtencion: v })} placeholder="Nombre del centro..." />
          </div>
        </div>

        {/* Instrucciones */}
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5 text-sm text-blue-800 space-y-2 mb-8">
          <p className="font-bold">📋 Instrucciones generales</p>
          <p>Completen <strong>dos casos clínicos</strong> de personas atendidas durante la jornada. Todas las secciones son desde la perspectiva de ustedes como tratantes/kinesiólogos.</p>
          <p>Todos los campos marcados con <span className="text-red-500 font-bold">*</span> son obligatorios. El formulario guarda tu progreso automáticamente en este navegador.</p>
          <p>Al terminar ambos casos, presionen <strong>&quot;Enviar definitivamente&quot;</strong> al final de la página.</p>
        </div>

        {/* Caso 1 */}
        <BloqueCaso numero={1} caso={caso1} onChange={setCaso1} />

        {/* Separador */}
        <div className="flex items-center gap-4 my-12">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
          <span className="text-teal-600 font-black text-sm uppercase tracking-widest">Fin Caso 1 · Inicio Caso 2</span>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />
        </div>

        {/* Caso 2 */}
        <BloqueCaso numero={2} caso={caso2} onChange={setCaso2} />

        {/* Enviar */}
        <div className="mt-10 mb-20">
          <button
            onClick={handleSubmit}
            disabled={sending}
            className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-lg rounded-2xl hover:from-emerald-700 hover:to-teal-700 shadow-xl transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? "Enviando..." : "✅ Enviar definitivamente"}
          </button>
          <p className="text-xs text-slate-400 text-center mt-3">
            Una vez enviado no podrás modificar tu entrega. Asegúrate de que toda la información esté completa.
          </p>
        </div>
      </main>
    </div>
  );
}
