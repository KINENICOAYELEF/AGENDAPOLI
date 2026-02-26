import { getDoc, setDoc, DocumentReference, DocumentData, SetOptions } from "firebase/firestore";

// Tipo para el evento de telemetría interno
export type TelemetryEvent = {
    operation: "GET" | "SET" | "QUERY";
    path: string;
    estimatedReads: number;
    estimatedWrites: number;
};

// Función para emitir el gasto a la interface (DOM)
const emitTelemetry = (payload: TelemetryEvent) => {
    if (typeof window !== "undefined") {
        const event = new CustomEvent("FIREBASE_TELEMETRY", { detail: payload });
        window.dispatchEvent(event);
    }
};

/**
 * Wrapper sobre getDoc para contabilizar 1 lectura.
 */
export const getDocCounted = async <T = DocumentData>(
    docRef: DocumentReference<T>
) => {
    emitTelemetry({
        operation: "GET",
        path: docRef.path,
        estimatedReads: 1,
        estimatedWrites: 0,
    });
    return await getDoc(docRef);
};

/**
 * Wrapper sobre setDoc para contabilizar 1 escritura.
 */
export const setDocCounted = async <T = DocumentData>(
    docRef: DocumentReference<T>,
    data: Partial<T> | T,
    options?: SetOptions
) => {
    emitTelemetry({
        operation: "SET",
        path: docRef.path,
        estimatedReads: 0,
        estimatedWrites: 1, // Ignoramos merge a efectos matemáticos básicos de Spark
    });

    if (options) {
        return await setDoc(docRef, data, options);
    } else {
        // TypeScript safety para el casting de setDoc sin options
        return await setDoc(docRef, data as T);
    }
};
