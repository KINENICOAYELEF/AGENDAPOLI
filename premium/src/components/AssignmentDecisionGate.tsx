"use client";

import { useCallback, useEffect, useState } from "react";
import { UserCheck, Users } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useYear } from "@/context/YearContext";
import {
  AssignmentDecisionsService,
  SESSIONS_BEFORE_ASKING,
  type AssignmentDecision,
} from "@/services/assignmentDecisions";

/**
 * Bloqueo hasta declarar a cargo de quién está una persona.
 *
 * Aparece cuando la estudiante ya registró dos sesiones con alguien que no
 * tiene asignado. Bloquea a propósito: si se pudiera postergar, se postergaría
 * siempre, y volveríamos a no saber quién lleva a cada persona.
 *
 * Se muestra sobre el dashboard y no dentro del formulario clínico: interrumpir
 * a alguien a mitad de una evolución arriesga perder lo que estaba escribiendo.
 */
export function AssignmentDecisionGate() {
  const { user } = useAuth();
  const { globalActiveYear } = useYear();
  const [pending, setPending] = useState<AssignmentDecision[]>([]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user || user.role !== "INTERNO" || !globalActiveYear) return;
    try {
      setPending(await AssignmentDecisionsService.listPending(user.uid, globalActiveYear));
    } catch (loadError) {
      // Si esto falla, la plataforma sigue usable: no se bloquea por un error
      // de lectura.
      console.error("No se pudieron cargar las decisiones de asignación:", loadError);
    }
  }, [user, globalActiveYear]);

  useEffect(() => { load(); }, [load]);

  const current = pending[0];
  if (!current) return null;

  const resolve = async (action: "TAKE" | "COVER") => {
    setWorking(true);
    setError(null);
    try {
      if (action === "TAKE") {
        await AssignmentDecisionsService.takeOver(
          current,
          user?.displayName || user?.email || "Interna",
        );
      } else {
        await AssignmentDecisionsService.declareCover(current);
      }
      setPending(prev => prev.filter(item => item.id !== current.id));
    } catch (resolveError) {
      console.error("No se pudo guardar la decisión:", resolveError);
      setError("No se pudo guardar. Revisa tu conexión y reintenta.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-900/70 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-xl bg-indigo-100 p-2.5 text-indigo-700">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-black text-slate-900">¿Esta persona quedó a tu cargo?</h2>
            <p className="mt-1 text-sm text-slate-600">
              Registraste {current.sessionsByStudent} sesiones con{" "}
              <strong>{current.patientName}</strong>, pero en la ficha figura
              {current.assignedInternName
                ? <> a nombre de <strong>{current.assignedInternName}</strong>.</>
                : <> sin interna asignada.</>}
            </p>
          </div>
        </div>

        <p className="mb-5 rounded-xl bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
          Necesitamos saberlo para que los avisos de reevaluación y continuidad
          le lleguen a quien de verdad la está atendiendo, y para que tu trabajo
          quede contabilizado a tu nombre.
        </p>

        {error && <p className="mb-3 text-sm font-semibold text-rose-600">{error}</p>}

        <div className="space-y-2.5">
          <button
            onClick={() => resolve("TAKE")}
            disabled={working}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-indigo-200 bg-indigo-50 p-4 text-left transition hover:border-indigo-400 disabled:opacity-50"
          >
            <UserCheck className="h-5 w-5 shrink-0 text-indigo-700" />
            <span>
              <span className="block text-sm font-black text-indigo-900">Sí, ahora es mi paciente</span>
              <span className="block text-xs text-indigo-700">
                Pasa a mi lista y quedo a cargo de su continuidad.
              </span>
            </span>
          </button>

          <button
            onClick={() => resolve("COVER")}
            disabled={working}
            className="flex w-full items-center gap-3 rounded-xl border-2 border-slate-200 bg-white p-4 text-left transition hover:border-slate-400 disabled:opacity-50"
          >
            <Users className="h-5 w-5 shrink-0 text-slate-600" />
            <span>
              <span className="block text-sm font-black text-slate-800">
                No, estoy cubriendo a {current.assignedInternName || "una compañera"}
              </span>
              <span className="block text-xs text-slate-600">
                La asignación no cambia. Te preguntaremos de nuevo si sigues atendiéndola.
              </span>
            </span>
          </button>
        </div>

        {pending.length > 1 && (
          <p className="mt-4 text-center text-xs font-semibold text-slate-500">
            Quedan {pending.length - 1} por responder.
          </p>
        )}
        <p className="mt-3 text-center text-[11px] text-slate-400">
          Aparece después de {SESSIONS_BEFORE_ASKING} sesiones y no se puede posponer.
        </p>
      </div>
    </div>
  );
}
