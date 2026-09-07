# Simulador por estaciones: revisión funcional de voz

## Cambios

- Entrevistas: reutilizan `generateDynamicPatientPrompt`, el mismo generador del OSCE, con una opción aditiva de caso inmutable. Los consumidores anteriores conservan su comportamiento por defecto.
- La conexión espera `setupComplete`, como el hook antiguo. PCM a la frecuencia real del AudioContext; reproducción de todas las partes de cada evento.
- Contextos de audio creados desde el gesto del usuario, antes de esperar el guardado. Recuperación de audio suspendido y botón de reconexión disponible durante la sesión.
- Texto de control mediante `sendRealtimeInput`, compatible con Gemini 3.1. Un control sin respuesta reconecta y reintenta una vez; no hay un bucle ilimitado.
- Socket anterior aislado por generación; límites de reintento no se reinician con aperturas fallidas. Reanudación vinculada a estación, modelo y versión del prompt.
- Transcripción: límites de turnos capturados antes de las actualizaciones diferidas de React. No se eliminan intervenciones repetidas por parecerse a otras.
- Presentación formal: escucha sin reproducir interrupciones del modelo. Resto de roles distinguido por estación.
- Si Gemini devuelve una respuesta transcrita sin PCM, el navegador puede leer exactamente ese texto como voz de respaldo. No crea otra respuesta ni sustituye el razonamiento del estudiante.
- Cierre: resumen solo de datos conversados, con hablantes diferenciados; confirmación después del turno completo. El usuario confirma el resumen. Si no llega, se registra la incidencia, no se inventa un resumen.
- Guardados en cola y transacción Firestore para que un checkpoint no reabra una etapa cerrada. Handles consolidados en el checkpoint, no una escritura por fragmento.
- Ingreso público mediante proyección explícita, con motivo general. Diagnóstico previo solo desde un campo manual. No se expone la rúbrica.

## Evidencia obtenida

`npm test`: 55 pruebas aprobadas, incluido TypeScript. 11 nuevas pruebas ejecutan React/proyecciones/constructores con dependencias controladas; las otras pruebas históricas incluyen verificaciones estáticas y no equivalen a pruebas de uso.

Pruebas opt-in `scripts/check-station-live.cjs`, caso y voz totalmente ficticios, sin escrituras en Firebase:

- Reconocimiento de voz sintética y respuesta audible de anamnesis: observado.
- Examen físico: petición oral de flexión bilateral devolvió 125° derecha/135° izquierda del caso; extensión completa y cierre audible también observados.
- Defensa con token efímero: pregunta dirigida sobre la propuesta, continuación y cierre con audio observados.
- Las primeras pruebas encontraron añadido de información no preguntada en un cierre, una salida fuera de personaje, una respuesta con texto sin PCM y un control sin respuesta. No se contabilizan como éxitos. Motivaron cambios de prompt, reutilización del OSCE, respaldo de voz y recuperación acotada del control.

Pruebas del hook: espera de setup, audio durante reproducción, mute/reanudación, turnos diferidos, socket obsoleto, reintentos acotados, presentación sin interrupciones, respaldo texto-voz y recuperación de control sin bucle. Pruebas del contrato: siete etapas/60 minutos, proyección sin diagnóstico generado y prompt separado de la rúbrica durante entrevista.

## Límites de esta verificación

La voz sintética enviada a Gemini no valida el micrófono físico de cada estudiante ni sustituye una sesión humana de 60 minutos. No se ha demostrado disponibilidad constante del proveedor ni concurrencia real de tres estudiantes. El simulador permanece privado para docentes; no habilitarlo a internos basándose únicamente en este documento.

Referencia de protocolo: https://ai.google.dev/gemini-api/docs/live-api/capabilities — texto realtime, procesamiento de partes, PCM, VAD y audioStreamEnd.
