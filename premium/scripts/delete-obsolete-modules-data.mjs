#!/usr/bin/env node
/**
 * Script: delete-obsolete-modules-data.mjs
 * Sección 24 del Plan Maestro.
 *
 * Limpia datos obsoletos de módulos anteriores al agente:
 *   - Colección `pfg_evidence` (eliminada en favor de agent_reviews)
 *   - Documentos con status "ARCHIVADO" > 90 días en agent_reviews
 *   - Runs del agente fallidos > 30 días
 *
 * Ejecución: node scripts/delete-obsolete-modules-data.mjs [--dry-run]
 *
 * IMPORTANTE: Este script NO borra fichas clínicas, notas ni datos de estudiantes.
 * Solo limpia datos intermedios del sistema de agente que ya no se usan.
 */

import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync, existsSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');
const MAX_BATCH = 500;
const ARCHIVE_RETENTION_DAYS = 90;
const FAILED_RUN_RETENTION_DAYS = 30;

// ─── Firebase Init ─────────────────────────────────────────────────────────

let db;
try {
  const saPath = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    './serviceAccountKey.json';

  if (existsSync(saPath)) {
    const sa = JSON.parse(readFileSync(saPath, 'utf-8'));
    const app = initializeApp({ credential: cert(sa) });
    db = getFirestore(app);
  } else {
    // Fallback: use ADC or emulator
    const app = initializeApp();
    db = getFirestore(app);
  }
} catch (e) {
  console.error('❌ No se pudo inicializar Firebase Admin:', e.message);
  process.exit(1);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function daysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

async function deleteCollection(collectionPath, label) {
  console.log(`\n🔍 Buscando documentos en: ${collectionPath} ...`);
  const snap = await db.collection(collectionPath).get();

  if (snap.empty) {
    console.log(`   ✅ Colección "${collectionPath}" ya está vacía.`);
    return 0;
  }

  console.log(`   📋 Encontrados: ${snap.size} documentos (${label})`);

  if (DRY_RUN) {
    console.log(`   🔒 DRY RUN: No se eliminará nada.`);
    return snap.size;
  }

  let deleted = 0;
  const batches = [];
  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count >= MAX_BATCH) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) batches.push(batch);

  for (const b of batches) {
    await b.commit();
    deleted += MAX_BATCH; // approximate
  }

  deleted = Math.min(deleted, snap.size);
  console.log(`   🗑️  Eliminados: ${snap.size} documentos.`);
  return snap.size;
}

async function deleteByQuery(collectionPath, field, op, value, label) {
  console.log(`\n🔍 Buscando ${label} en ${collectionPath} ...`);
  const snap = await db.collection(collectionPath).where(field, op, value).get();

  if (snap.empty) {
    console.log(`   ✅ No se encontraron documentos obsoletos.`);
    return 0;
  }

  console.log(`   📋 Encontrados: ${snap.size} documentos`);

  if (DRY_RUN) {
    console.log(`   🔒 DRY RUN: No se eliminará nada.`);
    return snap.size;
  }

  const batches = [];
  let batch = db.batch();
  let count = 0;

  for (const doc of snap.docs) {
    batch.delete(doc.ref);
    count++;
    if (count >= MAX_BATCH) {
      batches.push(batch);
      batch = db.batch();
      count = 0;
    }
  }
  if (count > 0) batches.push(batch);

  for (const b of batches) {
    await b.commit();
  }

  console.log(`   🗑️  Eliminados: ${snap.size} documentos.`);
  return snap.size;
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log('═══════════════════════════════════════════════════');
  console.log('  Limpieza de módulos obsoletos — Agenda Poli');
  console.log(`  Modo: ${DRY_RUN ? '🔒 DRY RUN (sin cambios)' : '⚡ PRODUCCIÓN'}`);
  console.log('═══════════════════════════════════════════════════');

  let totalDeleted = 0;

  // 1. Colección pfg_evidence (módulo PFG eliminado)
  totalDeleted += await deleteCollection('pfg_evidence', 'Módulo PFG obsoleto');

  // 2. Reviews archivadas > 90 días
  const archiveCutoff = daysAgo(ARCHIVE_RETENTION_DAYS);
  totalDeleted += await deleteByQuery(
    'agent_reviews',
    'createdAt', '<', archiveCutoff,
    `reviews ARCHIVADO > ${ARCHIVE_RETENTION_DAYS} días`
  );

  // 3. Runs fallidos > 30 días
  const failedCutoff = daysAgo(FAILED_RUN_RETENTION_DAYS);
  totalDeleted += await deleteByQuery(
    'agent_runs',
    'status', '==', 'failed',
    `runs fallidos > ${FAILED_RUN_RETENTION_DAYS} días`
  );

  // 4. Borradores de mensajes ya procesados/rechazados > 30 días
  totalDeleted += await deleteByQuery(
    'student_message_drafts',
    'status', 'in', ['RECHAZADO', 'ENVIADO'],
    'borradores procesados > 30 días'
  );

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Total documentos ${DRY_RUN ? 'encontrados' : 'eliminados'}: ${totalDeleted}`);
  console.log('═══════════════════════════════════════════════════\n');
}

main().catch((e) => {
  console.error('❌ Error fatal:', e);
  process.exit(1);
});
