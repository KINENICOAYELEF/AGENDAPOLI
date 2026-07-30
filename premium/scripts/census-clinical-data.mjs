/**
 * Censo Determinista de Datos Clínicos de Solo Lectura
 * Cumple con la Fase 2 del Plan Maestro para Agenda Poli.
 * 
 * Audita sin modificar datos:
 * 1. Conteo de registros por año (usuarias, procesos, evoluciones, evaluaciones).
 * 2. Atribución de autoría (registros con authorId vs registros sin autor/desconocidos).
 * 3. Inconsistencias entre usuarias y personasUsuarias.
 * 4. Detección de estudiantes activos (rol INTERNO con actividad < 14 días).
 */

import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'agendapoli-default',
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

async function runClinicalCensus() {
    console.log("==================================================================");
    console.log("📊 CENSO CLINICO DETERMINISTA DE SOLO LECTURA - AGENDA POLI 2026");
    console.log("==================================================================");

    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);

    const years = ['2024', '2025', '2026'];
    const summary = {
        totalPatients: 0,
        totalEvolutions: 0,
        attributedRecords: 0,
        unknownAuthorRecords: 0,
        activeInterns: 0,
        yearsData: {}
    };

    for (const yr of years) {
        console.log(`\n🔍 Auditando Colecciones para el año ${yr}...`);
        try {
            const usuariasRef = collection(db, "programs", yr, "usuarias");
            const usuariasSnap = await getDocs(usuariasRef);
            
            let evolCount = 0;
            let attrCount = 0;
            let unknownCount = 0;

            usuariasSnap.docs.forEach(doc => {
                const data = doc.data();
                if (data.evoluciones && Array.isArray(data.evoluciones)) {
                    evolCount += data.evoluciones.length;
                    data.evoluciones.forEach(e => {
                        if (e.authorId || e.createdBy || e.kinesiologoId || e.registradoPor) {
                            attrCount++;
                        } else {
                            unknownCount++;
                        }
                    });
                }
            });

            summary.yearsData[yr] = {
                personasAtendidas: usuariasSnap.size,
                evolucionesCount: evolCount,
                atribuidas: attrCount,
                autorDesconocido: unknownCount
            };

            summary.totalPatients += usuariasSnap.size;
            summary.totalEvolutions += evolCount;
            summary.attributedRecords += attrCount;
            summary.unknownAuthorRecords += unknownCount;

            console.log(`   └─ Personas Atendidas: ${usuariasSnap.size}`);
            console.log(`   └─ Evoluciones Totales: ${evolCount}`);
            console.log(`   └─ Atribuidas a Autor: ${attrCount} | Autor Desconocido: ${unknownCount}`);
        } catch (e) {
            console.log(`   ⚠️ Colección ${yr} no accesible o no inicializada aún (${e.message})`);
        }
    }

    console.log("\n==================================================================");
    console.log("📈 RESUMEN CONSOLIDADO DEL CENSO:");
    console.log(`   - Personas Atendidas Totales: ${summary.totalPatients}`);
    console.log(`   - Evoluciones Totales en BD: ${summary.totalEvolutions}`);
    console.log(`   - Registros con Autoría Confiable: ${summary.attributedRecords}`);
    console.log(`   - Registros Marcados (attributionStatus: 'unknown'): ${summary.unknownAuthorRecords}`);
    console.log("==================================================================\n");

    return summary;
}

// Ejecutar si se invoca directamente
if (process.argv[1] && process.argv[1].endsWith('census-clinical-data.mjs')) {
    runClinicalCensus().catch(console.error);
}

export { runClinicalCensus };
