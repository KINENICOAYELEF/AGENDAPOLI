"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowRight, ClipboardCheck, MessageSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import { auth } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import type { StudentClinicalTask } from "@/types/studentClinicalTask";

type TaskWithId = StudentClinicalTask & { id: string };

/**
 * Aviso persistente creado únicamente después de una decisión docente.
 * El estudiante puede ir al expediente, pero no ocultar ni resolver la tarea.
 */
export function StudentClinicalTaskBanner() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<TaskWithId[]>([]);

  useEffect(() => {
    if (!user || user.role !== "INTERNO") return;
    let active = true;
    let lastLoadedAt = 0;
    const loadTasks = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (!token) return;
        const response = await fetch("/api/student/clinical-tasks", {
          headers: { Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (active) {
          setTasks(Array.isArray(payload.tasks) ? payload.tasks : []);
          lastLoadedAt = Date.now();
        }
      } catch (error) {
        console.error("No se pudieron cargar las tareas clínicas del estudiante", error);
      }
    };
    void loadTasks();
    // Cinco minutos mantiene el aviso persistente y reduce en 80% las consultas
    // periódicas. Al volver a la pestaña se actualiza solo si pasó un minuto.
    const interval = window.setInterval(loadTasks, 5 * 60_000);
    const refreshOnFocus = () => {
      if (Date.now() - lastLoadedAt >= 60_000) void loadTasks();
    };
    const refreshAfterClinicalSave = () => void loadTasks();
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("student-clinical-tasks-changed", refreshAfterClinicalSave);
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("student-clinical-tasks-changed", refreshAfterClinicalSave);
    };
  }, [user]);

  const [acknowledging, setAcknowledging] = useState(false);
  const task = tasks[0];
  const isFeedback = task?.kind === "TEACHER_FEEDBACK";
  const tone = useMemo(() => task?.kind === "REEVALUATION_DUE"
    ? "border-violet-300 bg-violet-950"
    : task?.kind === "TEACHER_FEEDBACK"
      ? "border-emerald-300 bg-emerald-950"
      : "border-amber-300 bg-slate-950", [task?.kind]);

  /**
   * Un feedback no tiene un registro que completar, así que se cierra al
   * leerlo. Sin esta vía quedaría fijo en pantalla para siempre.
   */
  const acknowledge = async () => {
    if (!task?.id) return;
    setAcknowledging(true);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/student/clinical-tasks/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ taskId: task.id }),
      });
      if (!response.ok) throw new Error("No se pudo marcar como leída.");
      setTasks(current => current.filter(item => item.id !== task.id));
    } catch (error) {
      console.error("No se pudo marcar el feedback como leído:", error);
    } finally {
      setAcknowledging(false);
    }
  };

  if (!task || user?.role !== "INTERNO") return null;

  return (
    <aside className={`fixed inset-x-3 bottom-3 z-[1200] mx-auto max-w-3xl overflow-hidden rounded-2xl border-2 ${tone} text-white shadow-2xl sm:bottom-5`} role="alert" aria-live="assertive">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
          {task.kind === "REEVALUATION_DUE"
            ? <ClipboardCheck className="h-6 w-6 text-violet-200" />
            : isFeedback
              ? <MessageSquare className="h-6 w-6 text-emerald-200" />
              : <AlertTriangle className="h-6 w-6 text-amber-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{task.title}</p>
            {tasks.length > 1 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black">+{tasks.length - 1} pendiente(s)</span>}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-200">{task.message}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
            {isFeedback
              ? "Retroalimentación de tu docente. Márcala como leída cuando la hayas revisado."
              : "Se cerrará automáticamente al completar y cerrar el registro solicitado."}
          </p>
        </div>
        {isFeedback ? (
          <button type="button" onClick={acknowledge} disabled={acknowledging} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-emerald-950 hover:bg-emerald-100 disabled:opacity-50">
            {acknowledging ? "Guardando…" : "Entendido"}
          </button>
        ) : (
          <button type="button" onClick={() => router.push(task.actionHref)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-slate-100">
            {task.actionLabel}<ArrowRight className="h-4 w-4" />
          </button>
        )}
      </div>
    </aside>
  );
}
