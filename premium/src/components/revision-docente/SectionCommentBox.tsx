"use client";

import { useState } from "react";
import { MessageSquarePlus, Sparkles, X } from "lucide-react";
import { auth } from "@/lib/firebase";
import { RecordCommentsService, type RecordComment } from "@/services/recordComments";

type Props = {
  year: string;
  recordId: string;
  recordKind: "EVALUACION" | "EVOLUCION";
  section: string;
  /** Lo que la estudiante escribió en esta sección: es lo que la IA lee. */
  sectionContent: unknown;
  studentId: string;
  patientId: string;
  patientName?: string;
  existing: RecordComment[];
  onCreated: (comment: RecordComment) => void;
};

/**
 * Comentario al margen de una sección clínica.
 *
 * La IA propone el texto leyendo solo esa sección; el docente lo edita y
 * publica. Nada se guarda sin que él apriete publicar.
 */
export function SectionCommentBox({
  year, recordId, recordKind, section, sectionContent,
  studentId, patientId, patientName, existing, onCreated,
}: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [aiAssisted, setAiAssisted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const draftWithAi = async (intent: "corregir" | "reforzar" | "razonar") => {
    setDrafting(true);
    setError(null);
    try {
      const token = await auth.currentUser?.getIdToken();
      const response = await fetch("/api/teacher/section-comment", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ section, content: sectionContent, recordKind, intent }),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) throw new Error(payload.error || "No se pudo redactar.");
      setText(payload.draft);
      setAiAssisted(true);
    } catch (err: any) {
      setError(err?.message || "No se pudo redactar el comentario.");
    } finally {
      setDrafting(false);
    }
  };

  const publish = async () => {
    if (!text.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const created = await RecordCommentsService.create({
        year,
        recordId,
        recordKind,
        section,
        studentId,
        patientId,
        patientName,
        comment: text.trim(),
        aiAssisted,
        createdBy: auth.currentUser?.uid || "docente",
        createdByName: auth.currentUser?.displayName || auth.currentUser?.email || undefined,
      });
      onCreated(created);
      setText("");
      setAiAssisted(false);
      setOpen(false);
    } catch (err: any) {
      console.error("No se pudo publicar el comentario", err);
      setError("No se pudo publicar. Reintenta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-3 border-t border-slate-200 pt-3">
      {existing.length > 0 && (
        <ul className="mb-3 space-y-2">
          {existing.map(comment => (
            <li
              key={comment.id}
              className={`rounded-xl border-l-4 p-3 text-xs ${
                comment.status === "RESOLVED"
                  ? "border-l-emerald-400 bg-emerald-50/60 text-emerald-900"
                  : "border-l-amber-400 bg-amber-50/60 text-amber-950"
              }`}
            >
              <p className="whitespace-pre-line">{comment.comment}</p>
              <p className="mt-1 text-[10px] font-bold uppercase tracking-wide opacity-60">
                {comment.status === "RESOLVED" ? "Marcado como corregido" : "Esperando corrección"}
                {comment.aiAssisted ? " · borrador IA aprobado" : ""}
              </p>
            </li>
          ))}
        </ul>
      )}

      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-700"
        >
          <MessageSquarePlus className="h-3.5 w-3.5" /> Comentar esta sección
        </button>
      ) : (
        <div className="rounded-xl border border-indigo-200 bg-white p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[11px] font-black uppercase tracking-wide text-indigo-700">Comentario sobre &ldquo;{section}&rdquo;</span>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700"><X className="h-4 w-4" /></button>
          </div>

          <div className="mb-2 flex flex-wrap gap-1.5">
            <button onClick={() => draftWithAi("corregir")} disabled={drafting} className="inline-flex items-center gap-1 rounded-lg bg-rose-50 px-2 py-1 text-[11px] font-bold text-rose-700 hover:bg-rose-100 disabled:opacity-50">
              <Sparkles className="h-3 w-3" /> Corregir
            </button>
            <button onClick={() => draftWithAi("razonar")} disabled={drafting} className="inline-flex items-center gap-1 rounded-lg bg-indigo-50 px-2 py-1 text-[11px] font-bold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50">
              <Sparkles className="h-3 w-3" /> Hacer razonar
            </button>
            <button onClick={() => draftWithAi("reforzar")} disabled={drafting} className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50">
              <Sparkles className="h-3 w-3" /> Reforzar
            </button>
            {drafting && <span className="self-center text-[11px] text-slate-500">Redactando…</span>}
          </div>

          <textarea
            value={text}
            onChange={(event) => setText(event.target.value)}
            rows={4}
            placeholder="Escribe tu comentario, o pide un borrador con los botones de arriba."
            className="w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:border-indigo-400"
          />

          {error && <p className="mt-1 text-[11px] font-semibold text-rose-600">{error}</p>}

          <div className="mt-2 flex items-center justify-between gap-2">
            <p className="text-[10px] text-slate-500">Se publicará en su ficha y le llegará un aviso.</p>
            <button
              onClick={publish}
              disabled={saving || !text.trim()}
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-[11px] font-bold text-white hover:bg-indigo-700 disabled:bg-slate-300"
            >
              {saving ? "Publicando…" : "Publicar comentario"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
