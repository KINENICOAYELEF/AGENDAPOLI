import { getDoc, getDocs, setDoc, onSnapshot, DocumentReference, Query, QuerySnapshot, FirestoreError, DocumentData, SetOptions } from "firebase/firestore";

// Tipo para el evento de telemetría interno
export type TelemetryEvent = {
    operation: "GET" | "QUERY" | "SET" | "SNAPSHOT";
    path: string;
    queries: number;
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

export const getDocCounted = async <T = DocumentData>(
    docRef: DocumentReference<T>
) => {
    emitTelemetry({
        operation: "GET",
        path: docRef.path,
        queries: 1,
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
        queries: 0,
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

/**
 * Wrapper sobre getDocs para contabilizar listas.
 */
export const getDocsCounted = async <T = DocumentData>(
    query: Query<T>,
    stringPath: string // Firebase Queries no exponen un path fácil, pasarlo a mano para debug
) => {
    const snap = await getDocs(query);
    emitTelemetry({
        operation: "QUERY",
        path: stringPath,
        queries: 1,
        // Firestore cobra mínimo 1 lectura aunque venga vacía.
        estimatedReads: snap.empty ? 1 : snap.size,
        estimatedWrites: 0,
    });
    return snap;
};

/**
 * Wrapper sobre onSnapshot para suscripciones en vivo.
 */
export const onSnapshotCounted = <T = DocumentData>(
    queryObj: Query<T>,
    stringPath: string,
    onNext: (snapshot: QuerySnapshot<T>) => void,
    onError?: (error: FirestoreError) => void
) => {
    let isFirstCall = true;

    return onSnapshot(queryObj, (snapshot) => {
        emitTelemetry({
            operation: "SNAPSHOT",
            path: stringPath,
            queries: isFirstCall ? 1 : 0,
            // En snapshots posteriores, solo cobra los documentos que cambiaron
            estimatedReads: snapshot.empty ? 1 : snapshot.docChanges().length,
            estimatedWrites: 0,
        });
        isFirstCall = false;
        onNext(snapshot);
    }, onError);
};
