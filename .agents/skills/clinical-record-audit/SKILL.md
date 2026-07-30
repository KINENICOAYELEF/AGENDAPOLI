---
name: clinical-record-audit
description: Auditoría de registros clínicos de evoluciones y evaluaciones para verificar completitud, coherencia entrevista-examen y dosificación EBM.
---

# Clinical Record Audit Skill

## Instrucciones:
1. Examine la ficha clínica o evolución en busca de los 3 Pilares del Razonamiento Clínico:
   - Pilar A: Entrevista BPS, banderas rojas/amarillas.
   - Pilar B: Examen Físico Dirigido y clusters clínicos ortopédicos.
   - Pilar C: Intervención EBM y dosificación FITT-VP / RPE.
2. Identifique omisiones de banderas rojas o uso de lenguaje nocebo.
3. Guarde cada hallazgo llamando a `save_review_finding` con las referencias fuente exactas.
