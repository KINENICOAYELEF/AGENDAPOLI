with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'r') as f:
    text = f.read()

# Fix Array length
text = text.replace("useState<boolean[]>(Array(14).fill(false));", "useState<boolean[]>(Array(15).fill(false));")

# Irritabilidad (75 -> 8)
text = text.replace("activeAccordions[75] || true", "activeAccordions[8] || true")
text = text.replace("toggleAccordion(75)", "toggleAccordion(8)")

# Síntomas Asociados (8 -> 9)
irrit_end = text.find("SÍNTOMAS ASOCIADOS Y COMPORTAMIENTO 24H")
if irrit_end != -1:
    before = text[:irrit_end]
    after = text[irrit_end:]
    after = after.replace("activeAccordions[8]", "activeAccordions[9]", 1)
    after = after.replace("toggleAccordion(8)", "toggleAccordion(9)", 1)
    text = before + after

# Signo Comparable (9 -> 10)
signo_idx = text.find("SIGNO COMPARABLE / ASTERISCO")
if signo_idx != -1:
    before = text[:signo_idx]
    after = text[signo_idx:]
    after = after.replace("activeAccordions[9]", "activeAccordions[10]", 1)
    after = after.replace("toggleAccordion(9)", "toggleAccordion(10)", 1)
    text = before + after

# PSFS (10 -> 11)
psfs_idx = text.find("ESCALA FUNCIONAL ESPECÍFICA (PSFS)")
if psfs_idx != -1:
    before = text[:psfs_idx]
    after = text[psfs_idx:]
    after = after.replace("activeAccordions[10] || true", "activeAccordions[11] || true", 1)
    after = after.replace("toggleAccordion(10)", "toggleAccordion(11)", 1)
    text = before + after

# BPS (11 -> 12)  BPS is still badge 11
bps_idx = text.find("BPS & FACTORES PSICOSOCIALES")
if bps_idx != -1:
    before = text[:bps_idx]
    after = text[bps_idx:]
    after = after.replace("activeAccordions[11]", "activeAccordions[12]", 1)
    after = after.replace("toggleAccordion(11)", "toggleAccordion(12)", 1)
    text = before + after

# Contexto (11 -> 13) and badge 11 -> 12
ctx_idx = text.find("CONTEXTO DEPORTIVO Y TRABAJO")
if ctx_idx != -1:
    before = text[:ctx_idx]
    after = text[ctx_idx:]
    after = after.replace("activeAccordions[11]", "activeAccordions[13]", 1)
    after = after.replace("toggleAccordion(11)", "toggleAccordion(13)", 1)
    after = after.replace(">11</span>", ">12</span>", 1)
    text = before + after

# Cierre (13 -> 14) badge 13 stays 13
cierre_idx = text.find("CIERRE, TRIAGE Y PASE A P2")
if cierre_idx != -1:
    before = text[:cierre_idx]
    after = text[cierre_idx:]
    after = after.replace("activeAccordions[13] || true", "activeAccordions[14] || true", 1)
    after = after.replace("toggleAccordion(13)", "toggleAccordion(14)", 1)
    text = before + after

with open('src/components/evaluacion-steps/Screen1_Entrevista.tsx', 'w') as f:
    f.write(text)
