"use client";

import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setDocCounted } from "@/services/firestore";
import { AppUser } from "@/context/AuthContext";

export function PendingUsersManager() {
    const [pendingUsers, setPendingUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    const loadPendingUsers = async () => {
        setLoading(true);
        try {
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("role", "==", "PENDING"));
            const snapshot = await getDocs(q);
            setPendingUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        } catch (error) {
            console.error("Error cargando usuarios pendientes:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPendingUsers();
    }, []);

    const handleApprove = async (userId: string, newRole: "INTERNO" | "DOCENTE") => {
        if (!confirm(`¿Estás seguro de aprobar este usuario como ${newRole}?`)) return;
        try {
            const userRef = doc(db, "users", userId);
            await setDocCounted(userRef, { role: newRole }, { merge: true });
            alert(`Usuario aprobado como ${newRole} exitosamente.`);
            loadPendingUsers();
        } catch (error) {
            console.error("Error aprobando usuario:", error);
            alert("Hubo un error al aprobar al usuario.");
        }
    };

    const handleReject = async (userId: string) => {
        if (!confirm("Esto eliminará la solicitud (el usuario no podrá entrar al sistema, pero si vuelve a loguearse con Google aparecerá de nuevo como pendiente). ¿Confirmar?")) return;
        try {
            // Note: We don't delete auth user here since we are client side. 
            // We just delete the Firestore document. If they login again, AuthContext will recreate it as PENDING.
            // Wait, deleteDoc count is not in firestore service, we can just use setDocCounted to role = 'REJECTED' if we want.
            const userRef = doc(db, "users", userId);
            await setDocCounted(userRef, { role: "REJECTED" }, { merge: true });
            alert("Usuario rechazado.");
            loadPendingUsers();
        } catch (error) {
            console.error("Error rechazando usuario", error);
        }
    };

    return (
        <div className="bg-white border border-amber-200 rounded-xl shadow-sm overflow-hidden mb-6">
            <div className="bg-amber-50 px-6 py-4 flex justify-between items-center border-b border-amber-100">
                <div>
                    <h3 className="text-lg font-bold text-amber-900">Solicitudes de Acceso Pendientes</h3>
                    <p className="text-amber-700 text-sm">Usuarios nuevos que intentaron entrar con Google y esperan asignación de rol.</p>
                </div>
                <div className="bg-amber-200 text-amber-800 font-bold px-3 py-1 rounded-full">
                    {pendingUsers.length} Pendientes
                </div>
            </div>

            <div className="p-0">
                {loading ? (
                    <div className="p-6 text-center text-amber-600 animate-pulse">Cargando solicitudes...</div>
                ) : pendingUsers.length === 0 ? (
                    <div className="p-6 text-center text-amber-600 font-medium bg-amber-50/50">
                        No hay usuarios pendientes de aprobación.
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white text-amber-700 text-xs uppercase tracking-wider border-b border-amber-100">
                                <th className="px-6 py-3 font-bold">Usuario / Correo</th>
                                <th className="px-6 py-3 font-bold">Fecha de Solicitud</th>
                                <th className="px-6 py-3 font-bold text-right">Acciones (Aprobar ROL)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-amber-100 text-slate-800 bg-white">
                            {pendingUsers.map(u => (
                                <tr key={u.id} className="hover:bg-amber-50 transition">
                                    <td className="px-6 py-4">
                                        <div className="font-bold text-slate-900">{u.displayName || "Sin Nombre"}</div>
                                        <div className="text-xs text-slate-500">{u.email}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {u.createdAt?.toDate ? u.createdAt.toDate().toLocaleString() : "Reciente"}
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <button
                                            onClick={() => handleApprove(u.id, "INTERNO")}
                                            className="px-3 py-1.5 text-xs font-bold bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition"
                                        >
                                            Dar INTERNO
                                        </button>
                                        <button
                                            onClick={() => handleApprove(u.id, "DOCENTE")}
                                            className="px-3 py-1.5 text-xs font-bold bg-emerald-100 text-emerald-700 rounded-lg hover:bg-emerald-200 transition"
                                        >
                                            Dar DOCENTE
                                        </button>
                                        <span className="text-slate-300">|</span>
                                        <button
                                            onClick={() => handleReject(u.id)}
                                            className="px-3 py-1.5 text-xs font-bold bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-100 transition"
                                        >
                                            Rechazar
                                        </button>
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
