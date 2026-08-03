"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { AlertTriangle, ArrowRight, ClipboardCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { db } from "@/lib/firebase";
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
    const taskQuery = query(
      collection(db, "student_clinical_tasks"),
      where("studentId", "==", user.uid),
    );
    return onSnapshot(taskQuery, (snapshot) => {
      setTasks(snapshot.docs
        .map((item) => ({ id: item.id, ...(item.data() as StudentClinicalTask) }))
        .filter((task) => task.status === "ACTIVE")
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)));
    }, (error) => console.error("No se pudieron cargar las tareas clínicas del estudiante", error));
  }, [user]);

  const task = tasks[0];
  const tone = useMemo(() => task?.kind === "REEVALUATION_DUE"
    ? "border-violet-300 bg-violet-950"
    : "border-amber-300 bg-slate-950", [task?.kind]);

  if (!task || user?.role !== "INTERNO") return null;

  return (
    <aside className={`fixed inset-x-3 bottom-3 z-[1200] mx-auto max-w-3xl overflow-hidden rounded-2xl border-2 ${tone} text-white shadow-2xl sm:bottom-5`} role="alert" aria-live="assertive">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
          {task.kind === "REEVALUATION_DUE" ? <ClipboardCheck className="h-6 w-6 text-violet-200" /> : <AlertTriangle className="h-6 w-6 text-amber-300" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{task.title}</p>
            {tasks.length > 1 && <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-black">+{tasks.length - 1} pendiente(s)</span>}
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-200">{task.message}</p>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Se cerrará automáticamente al completar y cerrar el registro solicitado.</p>
        </div>
        <button type="button" onClick={() => router.push(task.actionHref)} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-black text-slate-950 hover:bg-slate-100">
          {task.actionLabel}<ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </aside>
  );
}
