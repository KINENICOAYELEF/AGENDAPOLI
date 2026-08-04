"use client";

import { useEffect } from "react";

/** Evita que un error de renderizado deje el directorio clínico en blanco. */
export default function UsuariosError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Error recuperable en Directorio Clínico");
  }, []);

  return (
    <main className="mx-auto max-w-xl p-5 sm:p-8">
      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-amber-950 shadow-sm">
        <p className="text-sm font-black uppercase tracking-wide text-amber-700">Directorio clínico</p>
        <h1 className="mt-2 text-xl font-black">No pudimos abrir esta vista temporalmente</h1>
        <p className="mt-2 text-sm leading-6">Tu enlace se mantiene en la barra de direcciones. Reintenta primero; no se eliminó ni modificó ninguna ficha.</p>
        <button type="button" onClick={reset} className="mt-5 min-h-11 rounded-xl bg-amber-800 px-4 text-sm font-bold text-white hover:bg-amber-900">Reintentar abrir</button>
      </section>
    </main>
  );
}
