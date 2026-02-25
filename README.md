# SISTEMAKINE - Proyecto Polideportivo (Legacy Edition)

⚠️ **IMPORTANTE: ESTE REPOSITORIO ES READ-ONLY** ⚠️

A partir de Febrero de 2026, el código fuente original de este repositorio (basado en HTML/CSS/Vanilla JS) ha sido **OFICIALMENTE CONGELADO**. 

No se realizarán más desarrollos, nuevas funcionalidades ni parches en esta base de código, ya que su arquitectura monolítica se ha considerado no escalable para futuras integraciones de Inteligencia Artificial. 

## Estado Actual
El sistema contenido aquí sigue funcionando **únicamente como referencia histórica** y para mantener la continuidad operativa temporal de los alumnos actuales del Polideportivo. 

El repositorio cuenta con una herramienta integrada y oculta de exportación de datos (`Admin Docente`) que permite extraer la información histórica de las **Personas Usuarias** de forma segura hacia formatos estandarizados (JSON/CSV).

## Próximos Pasos (Premium App 2026)
1. **Nuevo Repositorio:** Se construirá un sistema "Premium" totalmente aparte usando Next.js y React.
2. **Desacoplamiento Base de Datos:** El nuevo sistema utilizará un proyecto fresco en Firebase (con sus propias reglas de Firestore y Auth).
3. **Estructuras de Datos:** El modelo de datos adoptará de forma estandarizada el término "Usuario(a)" o "Persona Usuaria" en pro de la neutralidad. La metadata incluirá una categorización estricta por años (e.g., `programYear: 2026` usando colecciones aisladas `/programs/{year}/...`).
4. **Migración:** Los archivos `.json` extraídos de este sistema legacy servirán de puente semilla para la nueva base de datos.
