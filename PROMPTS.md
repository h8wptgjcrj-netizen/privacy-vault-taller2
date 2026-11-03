# Registro de prompts — Taller 2: Privacy Vault

## Prompt 01 — Implementación inicial de Privacy Vault

**Herramienta:** Cursor AI  
**Origen:** Prompt elaborado con asistencia de ChatGPT a partir de los requisitos de la Actividad 1 del enunciado.

### Instrucción utilizada

Actúa como desarrollador Node.js. En este proyecto `privacy-vault`, crea una aplicación mínima con Express que escuche en el puerto 3001 y tenga dos endpoints POST: `/anonymize` y `/deanonymize`.

`/anonymize` debe recibir un JSON con un campo `message` de tipo string, detectar nombres completos, correos electrónicos y teléfonos mediante expresiones regulares y sustituirlos por tokens alfanuméricos con prefijos `NAME_`, `EMAIL_` y `PHONE_`.

`/deanonymize` debe recibir un JSON con `message` que contenga tokens previamente generados y restaurar los valores originales.

Para esta primera actividad, conserva las correspondencias temporalmente en memoria; MongoDB se incorporará en la Actividad 2.

Incluye validación de entrada, manejo básico de errores y el script `npm start`.

No agregues frontend, base de datos ni integración con OpenAI todavía.

Explica los archivos creados y cómo probar ambos endpoints desde CMD con `curl`, utilizando exclusivamente datos ficticios.

### Resultado obtenido

Cursor generó cuatro archivos:

- `package.json`: configuración del proyecto y script de ejecución.
- `src/memoryVault.js`: almacenamiento temporal de correspondencias.
- `src/anonymizer.js`: detección y sustitución de datos personales.
- `src/server.js`: servidor Express y endpoints HTTP.

### Pruebas realizadas

1. Anonimización de un nombre, correo y teléfono: satisfactoria.
2. Desanonimización y recuperación de los tres datos: satisfactoria.
3. Anonimización de dos nombres diferentes en un mensaje: satisfactoria.

### Observaciones

Los tokens se reutilizan para datos previamente procesados mientras el servidor permanece activo. La persistencia después de reiniciar queda pendiente para la Actividad 2.

Las pruebas realizadas no garantizan la detección de todos los formatos de información personal.

### Evidencias

- `01_Anonimizacion.png`
- `02_Desanonimizacion.png`
- `03_DosNombres.png`
## Prompt 02 — Persistencia con MongoDB Atlas

**Herramienta** ChatGPT Work (Codex).

### Instrucción utilizada

> Continúa el Taller 2 Privacy Vault, Actividad 2 MongoDB Atlas. Primero inspecciona el ZIP adjunto privacy-vault-backup.zip, verifica estructura, código y ausencia de secretos; conserva el proyecto original, no reconstruyas la Actividad 1. Explica hallazgos y prepara integración MongoDB con pruebas de persistencia y documentación de prompts/evidencias. No publiques ni compartas archivos, ni crees recursos externos sin aprobación explícita del usuario.

### Resultado y verificación

- El respaldo contiene los manifiestos de Node.js, el código de los dos endpoints, el almacén en memoria y el Prompt 01. La revisión del listado y del contenido no detectó archivos de configuración secretos, claves privadas ni cadenas de conexión. Las capturas de la Actividad 1 se mencionan en el registro y están fuera del ZIP.
- En la copia de trabajo, los dos endpoints conservan sus rutas, validaciones, formato de tokens y respuestas. Se mantienen las expresiones regulares originales. El almacén activo usa MongoDB. El archivo del almacén en memoria se conserva como referencia.
- Se añadió una prueba de recuperación y reutilización después de reiniciar Node.js. La ejecución contra Atlas está pendiente. Consulta README.md para reproducirla y registrar la evidencia.

## Prompt 03 — Consulta protegida con OpenAI

**Herramienta:** Cursor AI

### Instrucción utilizada

Implementar la Actividad 3 del Taller 2 sobre el proyecto actual. Crear `POST /secureChatGPT` para consultar OpenAI sin exponer directamente los datos personales.

Requisitos indicados: conservar `/anonymize` y `/deanonymize` con persistencia en MongoDB; crear una clase independiente para la API de OpenAI; leer `OPENAI_API_KEY` desde `.env`; anonimizar nombres, correos y teléfonos; enviar solo el mensaje anonimizado; restaurar los tokens presentes en la respuesta; usar la API Responses y un modelo de texto económico configurable; validar la entrada y manejar errores; no enviar las correspondencias a OpenAI; actualizar `README.md`, `.env.example` y `PROMPTS.md`; agregar pruebas sin llamadas reales a OpenAI. Antes de editar, se revisó la estructura y se confirmó el diseño.

### Resultado obtenido

- `src/openaiClient.js`: clase `OpenAIClient` para `POST https://api.openai.com/v1/responses`.
- `src/secureChat.js`: anonimiza, consulta y restaura sin reenviar `replacements`.
- `src/server.js`: ruta `POST /secureChatGPT`. El arranque de MongoDB y los endpoints anteriores se mantienen.
- `test/secureChat.test.js`: dobles de prueba, sin red hacia OpenAI y sin MongoDB.
- `README.md` y `.env.example`: uso de `OPENAI_API_KEY` y `OPENAI_MODEL`, más las limitaciones de privacidad.

El modelo por defecto es `gpt-4.1-mini`. La clave no queda en el código. No se publicó el repositorio ni se hicieron llamadas reales a OpenAI.

### Verificación

`npm test` terminó con 7 pruebas aprobadas, 0 fallidas y 1 omitida. Las aprobadas cubren `/secureChatGPT` sin llamar a OpenAI ni a MongoDB. La omitida es la persistencia de la Actividad 2, porque `MONGODB_TEST_DB` no estaba definida.
