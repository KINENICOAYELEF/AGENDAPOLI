# Sistema Médico Polideportivo (Legacy 2024-2025)

> ⚠️ **ESTADO DEL PROYECTO: CONGELADO (READ-ONLY)** ⚠️

Este repositorio contiene la versión original (Legacy) del Sistema Clínico del Polideportivo construida con Vanilla JavaScript, HTML y CSS.

## Declaración de Arquitectura (FASE 0.0)

Según las directrices establecidas en la Fase 0.0 de la migración:
1. **Este proyecto Legacy queda intacto y en modo de solo lectura.**
2. **No se vuelve a desarrollar ni se añadirán nuevas funcionalidades a este código.**
3. Este sistema sirve única y exclusivamente como referencia histórica y puente de extracción de los registros de las usuarias y evoluciones mediante la herramienta exportadora (Admin Docente).

## Migración a Premium 2026

El sistema se migrará a una nueva plataforma "Premium 2026" (Next.js + TypeScript + Tailwind) en un proyecto y repositorio **completamente separados**.

### Convenciones de Datos de la Nueva Arquitectura
- El nuevo sistema no dependerá de las estructuras de datos anidadas antiguas.
- **Colecciones por Año:** Los datos estarán segmentados fuertemente por cohorte, utilizando rutas como `/programs/{year}/...`.
- **Año Activo por Defecto:** Se establece `programYear = 2026` como el año en curso para la nueva plataforma.

---
*Este repositorio permanecerá activo únicamente para asegurar la continuidad del servicio de los alumnos de la cohorte anterior hasta que la nueva plataforma esté completamente operativa.*
