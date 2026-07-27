import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combina clases condicionales de Tailwind CSS evitando colisiones y duplicados.
 * Estándar oficial de componentes shadcn/ui.
 */
export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
