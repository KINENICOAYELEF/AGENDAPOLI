"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getDocCounted } from "@/services/firestore";
import { useAuth } from "./AuthContext";

interface YearContextType {
    activeYear: string;
    globalActiveYear: string;
    setWorkingYear: (year: string) => void;
    availableYears: string[];
    loadingYear: boolean;
    refreshYears: () => Promise<void>;
}

const YearContext = createContext<YearContextType>({
    activeYear: "2026",
    globalActiveYear: "2026",
    setWorkingYear: () => { },
    availableYears: ["2026"],
    loadingYear: true,
    refreshYears: async () => { },
});

export const useYear = () => useContext(YearContext);

export const YearProvider = ({ children }: { children: ReactNode }) => {
    const { user } = useAuth();
    const [globalActiveYear, setGlobalActiveYear] = useState<string>("2026");
    const [activeYear, setActiveYear] = useState<string>("2026");
    const [availableYears, setAvailableYears] = useState<string[]>(["2025", "2026"]);
    const [loadingYear, setLoadingYear] = useState(false);

    const fetchedUserUidRef = useRef<string>("");

    const fetchActiveYear = async () => {
        try {
            // Evaluamos de forma paralela los años clave para evitar latencia de for-loop secuencial
            const yearsToCheck = ["2025", "2026", "2027"];
            const available: string[] = [];
            let foundYear = "2026";

            const results = await Promise.all(
                yearsToCheck.map(async (yr) => {
                    try {
                        const docRef = doc(db, "programs", yr, "meta", "settings");
                        const snap = await getDocCounted(docRef);
                        if (snap.exists()) {
                            return { yr, isActive: snap.data().isActive === true };
                        }
                    } catch (e) {
                        return null;
                    }
                    return null;
                })
            );

            results.forEach(res => {
                if (res) {
                    available.push(res.yr);
                    if (res.isActive) foundYear = res.yr;
                }
            });

            if (available.length > 0) {
                setAvailableYears(available);
            }
            setGlobalActiveYear(foundYear);
            setActiveYear(foundYear);
        } catch (error) {
            console.error("Error fetching years from Firebase:", error);
        } finally {
            setLoadingYear(false);
        }
    };

    useEffect(() => {
        // Si no hay usuario, apagamos la carga y reseteamos la ref
        if (!user?.uid) {
            setLoadingYear(false);
            fetchedUserUidRef.current = "";
            return;
        }

        // Evitar ejecuciones repetidas continuas si el UID ya fue procesado en este ciclo de sesión
        if (fetchedUserUidRef.current === user.uid) {
            return;
        }

        fetchedUserUidRef.current = user.uid;
        fetchActiveYear();
    }, [user?.uid]);

    const setWorkingYear = (year: string) => {
        // Solo permitimos el cambio local en memoria si el rol es DOCENTE.
        if (user?.role === "DOCENTE") {
            setActiveYear(year);
        }
    };

    return (
        <YearContext.Provider value={{ activeYear, globalActiveYear, setWorkingYear, availableYears, loadingYear, refreshYears: fetchActiveYear }}>
            {children}
        </YearContext.Provider>
    );
};
