# Protocolo obligatorio para ampliar Repaso Clínico MSK

Versión 1.0 · 14 de septiembre de 2026

## 0. Orden de trabajo para el agente ejecutor

Lee este documento completo y las instrucciones aplicables del repositorio antes de editar. Tu tarea es ampliar o revisar preguntas, no rediseñar la aplicación ni modificar permisos. El pedido actual del usuario determina zonas y cantidad; este documento no autoriza por sí solo todas las ampliaciones futuras.

Si el usuario únicamente dice «sigue este documento», entrega un lote de 35 preguntas nuevas de una zona existente, eligiendo la de menor cobertura verificable. Explica brevemente la elección antes de trabajar. No inventes una zona nueva sin encargo. Para ampliar las tres zonas, entrega lotes separados de 35 por zona.

No declares «a prueba de errores», «validado científicamente», «dominio asegurado» ni «100% funcional». Distingue revisión editorial, evidencia clínica, pruebas de software y validación educativa con estudiantes. Ninguna sustituye a las demás.

## 1. Estado de referencia: volver a verificar antes de actuar

- Aplicación: `premium/`; página: `/app/repaso-msk`.
- Commit de referencia: `498c29fc`. No restaures este commit: trabaja sobre el estado vigente.
- Bancos activos: `knee-v1` (Rodilla), `hip-v1` (Cadera e ingle), `shoulder-v1` (Hombro).
- Referencia inicial: 70 preguntas activas por zona, 210 en total. Existen originales archivados por revisiones: no confundir tamaño de biblioteca con banco activo.
- Cada intento contiene exactamente 35 preguntas. Máximo 60 segundos por pregunta, sin premio por velocidad; permite pasar.
- Preguntas, fundamentos y referencias de un intento terminado permanecen consultables.
- Las familias se reservan al crear un intento, aunque quede pausado. Se priorizan las no usadas. Si quedan menos de 35, no se repite silenciosamente: se necesita consentimiento explícito para ensayo repetido.
- Acceso actual para DOCENTE e INTERNO autenticados; cada persona sólo puede usar su propio historial. No habilitar cuentas `PENDING` ni otros roles como parte de ampliar contenido.
- Persistencia Admin en `msk_quiz_private/{uid}/attempts/{attemptId}` y marcador privado en `msk_quiz_private/{uid}`. No hacer censos de registros clínicos para escribir preguntas.
- La selección mezcla bloques y dominios; aún no ofrece elección individual de condición ni adaptación longitudinal completa a debilidades. No anunciarlas como implementadas.

## 2. Mapa de archivos que debes inspeccionar

Todas estas rutas son relativas a `premium/`:

| Archivo | Responsabilidad |
| --- | --- |
| `src/lib/repaso-msk/types.ts` | Esquemas, versiones admitidas, 35 preguntas y 60 segundos |
| `src/lib/repaso-msk/catalog.ts` | Zonas, bloques y validación de versión |
| `src/lib/repaso-msk/server.ts` | Biblioteca completa, banco activo y proyección pública |
| `src/lib/repaso-msk/knee-bank.json` | 35 preguntas originales de Rodilla: inmutables |
| `src/lib/repaso-msk/hip-bank.json` | 35 preguntas originales de Cadera: inmutables |
| `src/lib/repaso-msk/knee-additional.json` | Ampliación inicial de Rodilla |
| `src/lib/repaso-msk/hip-additional.json` | Ampliación inicial de Cadera |
| `src/lib/repaso-msk/shoulder-bank.json` | Banco inicial de Hombro |
| `src/lib/repaso-msk/revisions.json` | Revisiones inmutables con relación al original |
| `src/lib/repaso-msk/selection.ts` | Familias, equilibrio de selección y repetición explícita |
| `src/lib/repaso-msk/bank-state.ts` | Marcadores y compatibilidad con intentos antiguos |
| `src/lib/repaso-msk/engine.ts` | Respuestas, tiempo, pausa, cierre y conflictos |
| `src/app/api/repaso-msk/route.ts` | Listado privado y creación transaccional |
| `src/app/api/repaso-msk/[attemptId]/route.ts` | Propiedad, validación, guardado e idempotencia |
| `src/app/app/repaso-msk/page.tsx` | Acceso docente a pantalla |
| `src/components/repaso-msk/RepasoMsk.tsx` | Interfaz, historial, contador y respaldo local |
| `src/components/repaso-msk/repaso.module.css` | Estilos móviles y escritorio |
| `tests/repaso-msk.test.js` | Integridad, selección, compatibilidad y API |

Lee también el enlace del módulo en `src/app/app/layout.tsx` si añades zonas o ajustas textos de navegación. No edites simuladores de voz, Telegram, evaluaciones clínicas, reglas de Firebase ni otras funciones por conveniencia.

## 3. Qué deben aprender los internos

Pasantía corta; necesitan conocimientos esenciales de MSK y deportiva, no sólo reconocer patrones. Mantén preguntas de:

1. Definiciones y distinciones entre cuadro clínico, hallazgo, disfunción e imagen.
2. Anatomía funcional, fisiología, fisiopatología y adaptación tisular relevantes.
3. Reconocimiento de cuadros frecuentes y diagnósticos diferenciales plausibles.
4. Interpretación de entrevista, examen, medidas y cambios longitudinales.
5. Objetivos, elección de intervención, dosis, progresión/regresión y reevaluación.
6. Seguridad, límites de interpretación y derivación cuando corresponda.

Retorno deportivo avanzado es secundario. No añadir currículo respiratorio ni neurológico; sí considerar diferenciales neurológicos o sistémicos relevantes para la seguridad de una consulta MSK.

### Matriz obligatoria antes de redactar

Cuenta ítems activos por condición y dominio. Identifica vacíos y duplicaciones semánticas. Para un lote mixto de 35, usa como objetivo editorial inicial: 9 fundamentos, 8 reconocimiento/diferenciales, 8 interpretación, 7 intervención/dosis y 3 seguridad. Es una distribución editorial, no una proporción demostrada por la literatura. Puede ajustarse con justificación concreta de cobertura.

Distribuye el lote entre los bloques existentes; no llenes casi todo con el cuadro más fácil. Mantén los nombres del catálogo y dominios normalizados: `Fundamentos`, `Reconocimiento`, `Interpretación`, `Intervención`, `Seguridad`. No renombres categorías de preguntas antiguas. Los alias heredados se normalizan en selección; revisa cómo quedan agrupados en resultados.

## 4. Reglas de evidencia: ninguna cita ornamental

- Toda pregunta publicable tendrá al menos una fuente identificable que respalde la respuesta y las afirmaciones centrales del feedback.
- Busca y lee la fuente: no cites de memoria ni uses una respuesta de otro LLM como evidencia.
- Prioriza guías clínicas metodológicamente pertinentes y vigentes, revisiones sistemáticas de calidad, ensayos originales relevantes y consensos bien identificados. Para anatomía/fisiología estable, fuentes académicas autorizadas. No confundas una página divulgativa con un ensayo.
- Comprueba autoría/título, año, URL o DOI, población, intervención, comparador, desenlace y límites pertinentes. Una URL existente no acredita que apoye la afirmación.
- Busca si la guía fue reemplazada, el artículo corregido o retractado. «Moderno» no equivale automáticamente a «mejor»; una fuente antigua puede seguir siendo apropiada si no se extrapola indebidamente.
- Si sólo puedes leer un resumen, limita las afirmaciones a lo que éste permite verificar. No atribuyas tablas, dosis o análisis que no viste. Si falta soporte suficiente, deja el ítem fuera del banco activo.
- Ante evidencia contradictoria, no fuerces una única respuesta. Define el contexto que resuelve la discrepancia o descarta el ítem.
- No transfieras umbrales o protocolos entre edades, cuadros, procedimientos y fases como si fueran universales.
- Prohibido inventar sensibilidad, especificidad, likelihood ratios, MCID, pronóstico, efecto, dosis o prevalencia. Si se usan cifras, registra fuente exacta, unidades, población y contexto.
- No presentar una mejoría inmediata como prueba de corrección estructural. No tratar imagen, test aislado o asimetría como diagnóstico causal automático.
- No usar «síndrome de Janda», acortamientos, desalineación, pinzamiento o contractura como explicación universal. Tampoco negar de forma absoluta hallazgos clínicos reales: distingue restricciones objetivas de teorías causales no sustentadas.
- Explicaciones como «nutre», «centra», «descomprime», «rompe adherencias» requieren especificar qué se midió, mecanismo propuesto y relevancia clínica demostrada. No convertir plausibilidad fisiológica en eficacia clínica.
- Si se pregunta sobre terapia manual, educación u otros complementos, describe alcance y limitaciones sin venderlos como corrección anatómica ni excluirlos por prejuicio.

### Registro de trazabilidad obligatorio por lote

Crea `docs/repaso-msk/evidencia-<zona>-<fecha>-<lote>.md`. Para CADA ítem incluye:

| Campo | Contenido obligatorio |
| --- | --- |
| ID, familia, condición, dominio, objetivo | Una habilidad o concepto verificable |
| Afirmación central y respuesta correcta | Qué debe estar respaldado |
| Fuentes | Título, año, tipo, URL/DOI y fecha de consulta |
| Localización | Sección, recomendación, tabla o página realmente revisada |
| Soporte | Paráfrasis breve de qué respalda la fuente; no copiar preguntas ni largos extractos |
| Aplicabilidad | Población, fase y límites; certeza declarada si la fuente la informa |
| Distractores | Por qué cada uno es incorrecto o menos adecuado EN ESTE CASO |
| Verificación | Texto completo/resumen, incertidumbres, aprobación o exclusión editorial |

Puede haber una ficha bibliográfica común, pero cada pregunta debe enlazar su afirmación específica a ella. No basta un listado general de artículos al final.

## 5. Contrato de redacción y revisión crítica

- Una única mejor respuesta, cuatro alternativas A–D, lenguaje español claro y profesional.
- El caso proporciona lo necesario para decidir. No se penaliza adivinar un dato ausente.
- Objetivo orientativo de lectura: enunciado de hasta 90 palabras, alternativas de hasta 25 palabras cada una. Revisa que se pueda comprender y razonar en 60 segundos; recorta si no. No sustituye prueba de usabilidad.
- No hacer depender la clave de una trampa gramatical, doble negación o matiz lingüístico irrelevante.
- Alternativas paralelas, de longitud similar y del mismo nivel conceptual. Evita que la correcta sea siempre la más larga, prudente o llena de matices.
- Distractores basados en errores clínicos plausibles; no opciones absurdas, humorísticas ni ajenas al problema. Evita «todas/ninguna» y absolutos usados sólo para señalar el error.
- No dar el diagnóstico buscado en el enunciado. Sí puede proporcionarse cuando lo evaluado sea manejo de un diagnóstico ya establecido.
- Casos ficticios, sin copiar historias de pacientes reales. No acceder a Firebase para obtener material clínico.
- En dosis, especificar objetivo, fase, irritabilidad/capacidad y restricciones pertinentes. No convertir «3 × 10» en receta universal. Distingue ejemplo razonable, protocolo estudiado y recomendación general.
- Cálculos: proporcionar todos los datos, supuestos y unidades. Recalcular independientemente; verificar redondeo. No introducir cálculos largos incompatibles con un minuto.
- Fundamento orientativo: 60–130 palabras, sin relleno. Explica el vínculo entre datos y conclusión, el principal error de los distractores y un límite o dato útil transferible. No repetir simplemente la alternativa correcta.
- La extensión del feedback y mezcla de dominios son reglas editoriales de este protocolo, no afirmaciones de eficacia educativa demostrada.
- Balancea claves en el lote; diferencias de frecuencia A–D de no más de dos, sin secuencia repetitiva obvia. La distribución nunca prevalece sobre una clave correcta.

Haz una segunda pasada crítica separada de la redacción. Para cada ítem intenta defender un distractor con los datos dados. Si dos opciones son defendibles, reescribe o excluye. No marques «aprobado» sólo porque otro modelo estuvo de acuerdo.

## 6. No repetición real e inmutabilidad

Cambiar nombre, edad, orden o redacción manteniendo la misma decisión no crea una pregunta nueva. Una variante debe introducir un contraste educativo relevante: otro diferencial plausible, fase, hallazgo discordante, restricción, objetivo o decisión. Repetir el concepto con transferencia puede ser útil, pero repetir el mismo ítem disfrazado no satisface el requisito del usuario.

El selector vigente admite UNA pregunta activa por `familyId` (o `id` si no existe). No agregues varias variantes activas de la misma familia: produce `INVALID_BANK`. No inventes familias diferentes para eludir ese control. Si necesitas varias variantes activas por familia, eso requiere otro encargo y rediseño probado del selector.

Reglas técnicas obligatorias:

1. Nunca alterar ni eliminar una pregunta cuyo ID pueda estar en un intento guardado: incluye enunciado, opciones, clave, feedback y fuentes.
2. Preguntas realmente nuevas: ID único con prefijo de versión exacto, numeración no reutilizada. Comprueba TODA la biblioteca, no sólo un archivo.
3. Revisión: ID nuevo como `hip-v1-12-r3`, misma familia original y `replaces` apuntando a la versión sustituida. Conserva originales y revisiones previas importadas para resolver historiales y cadenas de sustitución.
4. `bank` debe resolver todas las IDs históricas; `bankQuestions(version)` sólo las activas. Ninguna revisión sustituida debe seguir seleccionable.
5. Una familia ya reservada sigue usada aunque cambie el ID de revisión. Nunca vaciar `seenFamilies`, cambiar el UID ni reiniciar marcadores.
6. La migración actual de `bank-state.ts` reconoce los 35 originales usados por los bancos antiguos. No ampliarla ciegamente a 70 o 105: marcaría preguntas nuevas como usadas.
7. No renombrar `knee-v1`, `hip-v1` o `shoulder-v1` para ampliar cantidades. Son claves de compatibilidad, no contadores de publicaciones.

## 7. Integración: cambios mínimos y completos

Para ampliar una zona existente, añade un JSON separado por lote, impórtalo en `server.ts` y verifica totales activos/familias. Respeta el esquema real de `ReviewedQuestion`; no añadas campos obligatorios sin compatibilidad.

Si se autorizó una zona nueva: actualizar `catalog.ts`, `validVersion`, unión `Attempt.version`, importación del banco, tarjetas y pruebas. Revisa los nombres y agrupaciones sin modificar resultados antiguos.

Advertencias del estado de referencia:

- Hay textos fijos «70 preguntas», «03 / 08» y nombres de zonas en `RepasoMsk.tsx`. Al ampliar, deben reflejar datos reales; preferir derivarlos de catálogo/disponibilidad antes que inventar otro número fijo.
- Tests actuales contienen expectativas de 70 por zona. Actualiza la cardinalidad esperada de bancos ampliados; NO cambiar los 35 del tamaño del intento ni los tests de originales históricos de 35.
- Agregar JSON sin importarlo en `server.ts` no publica contenido.
- El feedback no se importa en componentes cliente ni se devuelve en intentos activos. No filtrar claves/explanaciones al navegador antes de finalizar.
- No afirmar protección antitrampas de examen de alto impacto: el modo vigente es formativo y recuperable.
- No ampliar consultas masivas, generar preguntas por LLM durante cada intento, agregar listeners ni depender de censos. El contenido se valida antes de desplegar.

## 8. Pruebas: todas son puertas de aceptación

Antes de editar, registra `git status`, banco activo y resultado base de pruebas. Conserva cambios ajenos. Después:

### Contenido y selección

- JSON válido; IDs únicos en biblioteca y familias únicas en cada banco activo.
- Cuatro opciones distintas A–D y clave válida; objetivo, condición, dominio, explicación y fuentes presentes.
- Fuentes verificadas semánticamente mediante registro de trazabilidad; HTTPS por sí solo no basta.
- Conteos por zona, condición y dominio; detección de duplicados textuales y revisión semántica manual.
- Para N preguntas, generar tests sucesivos con distintas semillas hasta agotar grupos completos de 35; ninguno comparte familias previamente reservadas.
- No repetir sin consentimiento cuando quedan menos de 35. Con consentimiento: incluir todas las inéditas disponibles y completar con usadas, marcar repetición correctamente.
- Comprobar equilibrio posible de bloques sin sacrificar exclusión de usados. No exigir coberturas imposibles cuando queda un remanente sesgado.
- Revisiones: originales siguen corrigiendo históricamente igual; nuevas sesiones seleccionan la revisión; usados antiguos no la reciben como inédita.

### Persistencia y permisos

- Crear, retomar, seleccionar, responder, pasar, agotar tiempo, pausar, recargar y completar un intento.
- Comprobar selección y tiempo tras pausa; no recuperar tiempo consumido.
- Doble envío/reintento de red no avanza dos veces; pestaña desfasada no sobrescribe progreso.
- Otro UID no puede leer ni modificar el intento. Anónimo e INTERNO siguen bloqueados mientras la beta sea docente.
- Historial anterior conserva preguntas, claves, resultados y fundamentos.
- Validar nuevas rutas de catálogo tanto en GET como POST; entradas inválidas se rechazan.

### Comandos desde `premium/`

```sh
npm test
npx eslint src/lib/repaso-msk/*.ts src/components/repaso-msk/RepasoMsk.tsx src/app/api/repaso-msk/route.ts
npm run build
git diff --check
```

`npm test` incluye TypeScript en el estado de referencia. Añade a ESLint otros archivos TS/TSX modificados. No debilites ni borres assertions para lograr verde. Si hay fallo previo ajeno, informa cuál; no presentes un resultado parcial como éxito total.

### Navegador y publicación

- Inspeccionar escritorio y móvil: 390×844 y al menos un ancho cercano a 360 px; alternativas legibles, botones accesibles, sin recortes horizontales ni modal inaccesible.
- Verificar contadores, cambio de zona, instrucciones, guardado/recuperación y revisión de un historial propio. Cuando se cambie autorización, comprobar por separado DOCENTE e INTERNO.
- No simular decenas de intentos en la cuenta real del docente para agotar el banco. Usar fixtures o entorno de pruebas para pruebas exhaustivas.
- Si se autoriza un intento docente real de comprobación, comunicarlo; no mezclar sus respuestas con una evaluación académica ni borrar registros reales.
- Publicación autorizada: commit sólo de archivos pertinentes, push final a `main` por el flujo Git permitido; nunca force-push ni incluir secretos o cambios ajenos. Si no hay autoridad de publicación, entregar cambios verificados sin push.
- Esperar despliegue exitoso del SHA exacto y comprobar la versión publicada. Push exitoso no equivale a deployment exitoso.

## 9. Casos que obligan a excluir o detener el lote

Ítem sin evidencia comprobable, dos respuestas razonables, cifra no trazable, duplicado disfrazado, contradicción no resuelta, claves históricas alteradas, pérdida de persistencia, permisos debilitados, prueba fallida relevante o cambios de otro autor que se pisan.

Puedes excluir preguntas defectuosas y entregar menos de la cantidad solicitada, explicando exactamente cuáles faltan. No rellenes el cupo con contenido débil. No publiques preguntas dudosas como «provisionales» dentro del banco activo.

## 10. Entrega obligatoria, breve y verificable

- Qué zonas y cuántas preguntas NUEVAS activas se agregaron; revisiones y archivadas por separado.
- Totales activos antes/después; recordar tests de 35, no confundir banco con intento.
- Rutas de contenido y del registro de evidencia.
- Resultado de pruebas, TypeScript, build y comprobaciones web realmente efectuadas.
- Commit, push y deployment sólo si ocurrieron.
- Límites pendientes y cola, sin inventar validaciones ni funcionalidades.

## 11. Permisos actuales

La página y API permiten `DOCENTE` e `INTERNO` autenticados mediante `requireRepasoUser`. Cada solicitud resuelve la colección privada desde el UID verificado en el servidor; no acepta un UID indicado por el navegador. Las cuentas `PENDING` quedan bloqueadas. `msk_quiz_private` permanece cerrado al SDK cliente: Firebase Admin, después de verificar token y rol, guarda el progreso. No sustituir esta autorización explícita por una regla Firestore abierta.

El banco es utilizable para revisión docente, pero ni los aciertos ni la velocidad por sí solos certifican competencia clínica. La calidad psicométrica, dificultad real y utilidad para estudiantes requieren observación posterior de uso, sin convertir pocos ítems por dominio en conclusiones fuertes.

## Prompt corto para encargar el siguiente lote

> Lee completo `premium/docs/PROTOCOLO-BANCO-REPASO-MSK.md`. Amplía [ZONA] con [CANTIDAD] preguntas nuevas siguiendo sus puertas de aceptación y registro de evidencia. Conserva preguntas e historiales previos y el acceso sólo docente. No modifiques otros módulos. Entrega el lote implementado, pruebas y límites reales; no te limites a proponerlo. Publica a main sólo si está autorizado en este encargo o en las instrucciones vigentes.
