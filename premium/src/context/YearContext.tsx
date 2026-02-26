"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
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
    const [loadingYear, setLoadingYear] = useState(true);

    const fetchActiveYear = async () => {
        try {
            setLoadingYear(true);
            const yearsToCheck = ["2024", "2025", "2026", "2027"]; // Espacios de prueba
            let foundYear = "2026";
            const available: string[] = [];

            // Validamos sin CollectionGroup (para evitar errores de indexación en plan Spark)
            for (const yr of yearsToCheck) {
                const docRef = doc(db, "programs", yr, "meta", "settings");
                const snap = await getDocCounted(docRef);
                if (snap.exists()) {
                    available.push(yr);
                    if (snap.data().isActive === true) {
                        foundYear = yr;
                    }
                }
            }

            if (available.length > 0) {
                setAvailableYears(available);
            } else {
                setAvailableYears(["2025", "2026"]);
            }

            setGlobalActiveYear(foundYear);
            setActiveYear(foundYear); // Predeterminado: te mete en el año activo global
        } catch (error) {
            console.error("Error fetching years from Firebase:", error);
        } finally {
            setLoadingYear(false);
        }
    };

    useEffect(() => {
        // Si no hay usuario, apagamos la carga
        if (!user) {
            setLoadingYear(false);
            return;
        }
        fetchActiveYear();
    }, [user]);

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
