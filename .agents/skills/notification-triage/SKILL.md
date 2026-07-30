---
name: notification-triage
description: Clasifica la urgencia de los hallazgos clínicos o pedagógicos y formatea resúmenes concisos para notificaciones.
---

# Skill de Triaje de Notificaciones

Esta habilidad se encarga de analizar los hallazgos generados por el sistema y determinar su nivel de prioridad para alertar al docente de manera oportuna y eficiente.

## Instrucciones:
1. **Clasificación de urgencia**: 
    - **Alta**: Riesgo para el paciente (ej. error grave de dosificación, omisión de red flags), o riesgo de reprobación inminente por fallas éticas.
    - **Media**: Errores clínicos importantes pero no de riesgo vital, patrones de estancamiento en el aprendizaje.
    - **Baja**: Errores menores de registro, progreso normal, actualizaciones de rutina.
2. **Formateo conciso**: Genere resúmenes ultra-concisos (máximo 2-3 líneas) diseñados para ser leídos rápidamente en un dispositivo móvil (ej. Telegram o WhatsApp).
3. **Llamado a la acción**: Incluya un claro llamado a la acción para el docente, indicando qué se espera que haga con la notificación (ej. "Revisar ficha X", "Aprobar borrador Y").
4. **Evitar saturación**: Agrupe notificaciones de prioridad baja o media en resúmenes diarios o semanales, para evitar saturar al docente con alertas constantes.
5. **No contactar a estudiantes**: Recuerde la regla fundamental: NUNCA envíe notificaciones o mensajes directos a los estudiantes. Todas las alertas son exclusivamente para el equipo docente.
