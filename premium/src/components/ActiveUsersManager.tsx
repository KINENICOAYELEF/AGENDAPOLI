"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { useAuth } from "@/context/AuthContext";

export function ActiveUsersManager() {
    const { user: currentUser } = useAuth();
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadActiveUsers = async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, "users");
            // Nota: Firebase in no tolera queries complejas sin índices compuestos a veces, 
            // pero para simplificar, bajaremos todos los usuarios y filtraremos localmente, 
            // o usaremos un query simple de 'in'.
            const q = query(usersRef, where("role", "in", ["INTERNO", "DOCENTE"]));
            const snapshot = await getDocs(q);
            setActiveUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error cargando usuarios activos:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadActiveUsers();
    }, []);

    const handleChangeRole = async (userId: string, newRole: "INTERNO" | "DOCENTE") => {
        if (!confirm(`¿Estás seguro de cambiar el rol de este usuario a ${newRole}?`)) return;
        try {
            const userRef = doc(db, "users", userId);
            await setDocCounted(userRef, { role: newRole }, { merge: true });
            alert(`Rol cambiado exitosamente a ${newRole}.`);
            loadActiveUsers();
        } catch (error) {
            console.error("Error cambiando rol:", error);
            alert("Hubo un error al cambiar el rol. Revisa las reglas de seguridad.");
        }
    };

    const handleRevoke = async (userId: string) => {
        if (!confirm("Esto revocará el acceso del usuario, devolviéndolo al estado 'PENDING'. ¿Estás seguro?")) return;
        try {
            const userRef = doc(db, "users", userId);
            await setDocCounted(userRef, { role: "PENDING" }, { merge: true });
            alert("Acceso revocado exitosamente.");
            loadActiveUsers();
        } catch (error) {
            console.error("Error revocando acceso", error);
            alert("Hubo un error al revocar el acceso.");
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="bg-slate-50 px-6 py-4 flex justify-between items-center border-b border-slate-200">
                <div>
                    <h3 className="text-lg font-bold text-slate-800">Miembros del Personal</h3>
                    <p className="text-slate-500 text-sm">Gestiona Internos y Docentes activos dentro de la plataforma.</p>
                </div>
                <div className="bg-indigo-100 text-indigo-700 font-bold px-3 py-1 rounded-full text-sm">
                    {activeUsers.length} Activos
                </div>
            </div>

            <div className="p-0">
                {loading ? (
                    <div className="p-6 text-center text-slate-500 animate-pulse">Cargando cuentas reales...</div>
                ) : activeUsers.length === 0 ? (
                    <div className="p-6 text-center text-slate-500 font-medium">
                        No hay personal activo registrado aún.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-slate-500 text-xs uppercase tracking-wider border-b border-slate-100">
                                <th className="px-6 py-3 font-semibold">Usuario / Correo</th>
                                <th className="px-6 py-3 font-semibold">Rol Actual</th>
                                <th className="px-6 py-3 font-semibold text-right">Controles Administrativos</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-800 bg-white">
                            {activeUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                            {u.displayName || "Sin Nombre"}
                                            {u.id === currentUser?.uid && (
                                                <span className="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full uppercase font-bold tracking-wider">Tú</span>
                                            )}
                                        </div>
                                        <div className="text-xs text-slate-500">{u.email}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 text-[11px] font-black uppercase rounded ${
                                            u.role === 'DOCENTE' ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-blue-100 text-blue-700 border border-blue-200'
                                        }`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        {u.id !== currentUser?.uid && (
                                            <>
                                                {u.role === "INTERNO" ? (
                                                    <button
                                                        onClick={() => handleChangeRole(u.id, "DOCENTE")}
                                                        className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition"
                                                    >
                                                        Ascender a DOCENTE
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleChangeRole(u.id, "INTERNO")}
                                                        className="px-3 py-1.5 text-xs font-bold bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-50 transition"
                                                    >
                                                        Degradar a INTERNO
                                                    </button>
                                                )}
                                                <span className="text-slate-300">|</span>
                                                <button
                                                    onClick={() => handleRevoke(u.id)}
                                                    className="px-3 py-1.5 text-xs font-bold text-rose-600 hover:bg-rose-50 rounded transition border border-transparent hover:border-rose-100"
                                                >
                                                    Revocar
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
}
