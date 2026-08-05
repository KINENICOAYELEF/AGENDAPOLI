import React from "react";

type NarrativeSection = {
    title: string;
    body: string[];
};

const SECTION_STYLES = [
    { icon: "🩺", accent: "border-rose-200", iconBg: "bg-rose-50", iconText: "text-rose-700" },
    { icon: "🦴", accent: "border-slate-200", iconBg: "bg-slate-100", iconText: "text-slate-700" },
    { icon: "🏃", accent: "border-emerald-200", iconBg: "bg-emerald-50", iconText: "text-emerald-700" },
    { icon: "💼", accent: "border-sky-200", iconBg: "bg-sky-50", iconText: "text-sky-700" },
    { icon: "🧠", accent: "border-amber-200", iconBg: "bg-amber-50", iconText: "text-amber-700" },
    { icon: "📝", accent: "border-indigo-200", iconBg: "bg-indigo-50", iconText: "text-indigo-700" },
];

function normalizeHeading(line: string) {
    return line
        .replace(/^\s*(?:#{1,6}|■|●|◆|\d+[.)])\s*/u, "")
        .replace(/\s*[.:]\s*$/u, "")
        .trim();
}

function isHeading(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return false;
    if (/^(?:#{1,6}\s+|■\s*|◆\s*)/u.test(trimmed)) return true;
    if (/^[A-ZÁÉÍÓÚÜÑ0-9][A-ZÁÉÍÓÚÜÑ0-9 /(),.-]{3,}:?$/u.test(trimmed) && trimmed.length <= 90) return true;
    if (trimmed.endsWith(":") && trimmed.length <= 90) return true;

    const normalized = normalizeHeading(trimmed).replace(/[.]$/u, "").toLocaleLowerCase("es");
    if (/^(?:antecedentes?(?: médicos?| familiares?)?|medicamentos?|exámenes?(?: \/ diagnósticos?)?|diagnósticos?|historial de tratamientos?|deporte|actividad física|contexto (?:académico|laboral|ocupacional|social)|sueño(?: y alimentación)?|alimentación|red de apoyo|traslado|ocupación(?: y entorno)?|hábitos(?: basales)?|síntesis(?: clínica)?|notas adicionales)$/u.test(normalized)) return true;
    return false;
}

export function parseClinicalNarrative(text?: string | null): NarrativeSection[] {
    const clean = String(text || "").replace(/\r\n?/g, "\n").trim();
    if (!clean) return [];

    const sections: NarrativeSection[] = [];
    let current: NarrativeSection = { title: "Resumen clínico", body: [] };

    for (const rawLine of clean.split("\n")) {
        const line = rawLine.trim();
        if (!line) continue;
        if (isHeading(line)) {
            if (current.body.length > 0) sections.push(current);
            current = { title: normalizeHeading(line), body: [] };
            continue;
        }
        current.body.push(line.replace(/^(?:[-•·]|[.])\s*/u, "").trim());
    }

    if (current.body.length > 0 || sections.length === 0) sections.push(current);
    return sections.filter(section => section.body.some(Boolean));
}

export function ClinicalNarrativeCards({ text, emptyText = "Sin información registrada." }: { text?: string | null; emptyText?: string }) {
    const sections = parseClinicalNarrative(text);

    if (sections.length === 0) {
        return <p className="text-sm italic text-slate-400">{emptyText}</p>;
    }

    return (
        <div className="grid grid-cols-1 gap-3 sm:gap-4 lg:grid-cols-2" data-testid="clinical-narrative-cards">
            {sections.map((section, index) => {
                const style = SECTION_STYLES[index % SECTION_STYLES.length];
                return (
                    <section key={`${section.title}-${index}`} className={`min-w-0 rounded-2xl border bg-white p-4 shadow-sm sm:p-5 ${style.accent}`}>
                        <div className="mb-3 flex items-start gap-3 border-b border-slate-100 pb-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ${style.iconBg} ${style.iconText}`} aria-hidden="true">
                                {style.icon}
                            </span>
                            <h4 className="min-w-0 break-words text-xs font-black uppercase leading-5 tracking-[0.12em] text-slate-800">
                                {section.title}
                            </h4>
                        </div>
                        <div className="space-y-2">
                            {section.body.map((paragraph, paragraphIndex) => {
                                const colonIndex = paragraph.indexOf(":");
                                const hasShortLabel = colonIndex > 0 && colonIndex < 45;
                                return (
                                    <p key={paragraphIndex} className="break-words text-[13px] font-medium leading-6 text-slate-700">
                                        {hasShortLabel ? (
                                            <>
                                                <strong className="font-bold text-slate-900">{paragraph.slice(0, colonIndex + 1)}</strong>{" "}
                                                {paragraph.slice(colonIndex + 1).trim() || "No registrado"}
                                            </>
                                        ) : paragraph}
                                    </p>
                                );
                            })}
                        </div>
                    </section>
                );
            })}
        </div>
    );
}
