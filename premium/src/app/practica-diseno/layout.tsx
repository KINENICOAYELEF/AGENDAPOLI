import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Práctica Diseño de Intervención – Kinesiología UMCE",
  description: "Formulario de entrega de informe de práctica enfocado en diseño de intervención, objetivos CIF y pronóstico kinesiológico.",
};

export default function PracticaDisenoLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
