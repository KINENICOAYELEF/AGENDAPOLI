import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Ficha de Pasantía – Kinesiología 2º Año",
  description: "Formulario de entrega de ficha de observación, entrevista, evaluación inicial y razonamiento kinésico básico para pasantía de 2º año de Kinesiología.",
};

export default function PasantiaLayout({ children }: { children: React.ReactNode }) {
  // Layout limpio e independiente – no hereda sidebar ni navbar del sistema principal
  return <>{children}</>;
}
