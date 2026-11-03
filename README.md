# Privacy Vault · Taller 2 — Actividades 1, 2 y 3

API de anonimización reversible en Node.js con Express. El servidor escucha en `127.0.0.1:3001` después de conectar con MongoDB. Usa exclusivamente datos ficticios en el taller. La aplicación almacena el valor original en forma recuperable y los endpoints de restauración carecen de autenticación. Mantén las credenciales fuera de capturas y entregables.

El entorno utilizado en esta entrega fue **Node.js 26.13.0** con npm. No se afirma compatibilidad con otras versiones no verificadas.

## Actividad 1 — Anonimización y restauración

`POST /anonymize` recibe un JSON con el campo `message` (string). Detecta nombres, correos electrónicos y teléfonos mediante expresiones regulares y los sustituye por tokens alfanuméricos con prefijos `NAME_`, `EMAIL_` y `PHONE_`, seguidos de 8 caracteres hexadecimales.

`POST /deanonymize` recibe un JSON con `message` que contiene tokens previamente generados y restaura los valores originales. La respuesta incluye `restored` (tokens recuperados) y `unresolved` (tokens desconocidos).

En la Actividad 1 las correspondencias vivían en memoria (`src/memoryVault.js`) y se perdían al reiniciar el proceso. Ese módulo se conserva como referencia. La bóveda activa en este proyecto es MongoDB.

Validación compartida: el cuerpo debe ser un objeto JSON; `message` es obligatorio, no vacío y de máximo 10000 caracteres. El límite del cuerpo es 100 kb.

Ejemplo ficticio:

```json
{"message":"Ana Torres, ana@example.test, 3001234567"}
```

## Actividad 2 — Persistencia con MongoDB

Esta copia integra MongoDB en los endpoints de la Actividad 1. La colección `tokens` guarda el token como `_id`, el tipo y el valor original. El índice único por tipo y valor permite reutilizar el mismo token incluso con peticiones simultáneas. Los datos que solo existían en memoria no migran solos: para persistirlos, vuelve a anonimizar los mensajes ficticios con la versión actual.

### Ejecución local

1. En esta carpeta, con Node.js 26.13.0 y npm disponibles, ejecuta `npm install`.
2. Cuando tengas acceso autorizado a MongoDB, configura `MONGODB_URI` y `MONGODB_DB` como variables de entorno. También puedes usar un `.env` basado en `.env.example`. Mantén la URI y las credenciales fuera de capturas y entregables.
3. Ejecuta `npm start`. Comprueba que aparece `privacy-vault listo`.

La cuenta, el clúster, el usuario y el acceso de red de Atlas se gestionan con autorización.

### Prueba automatizada de persistencia

Con el puerto 3001 libre y la URI configurada, define una base de prueba autorizada. En PowerShell:

```powershell
$env:MONGODB_TEST_DB = 'privacy_vault_test'
npm test
```

La prueba envía cuatro solicitudes concurrentes con un nombre, un correo y un teléfono ficticios. Comprueba que cada respuesta usa los mismos tres tokens. Detiene Node.js, inicia otro proceso con la misma base, restaura el mensaje con los tokens previos y verifica que la anonimización devuelve los mismos tokens. La prueba escribe correspondencias ficticias en la base de prueba y las conserva para inspección.

Sin `MONGODB_TEST_DB`, esa prueba se omite. Las pruebas de `/secureChatGPT` se ejecutan igual.

### Verificación manual de persistencia

Envía el JSON `{"message":"Ana Torres, ana@example.test, 3001234567"}` a `POST /anonymize`. Guarda el campo `message` devuelto, detén el servidor con Ctrl+C y vuelve a ejecutar `npm start`. Envía el campo guardado en un JSON a `POST /deanonymize`. Comprueba el mensaje original y que `unresolved` sea un arreglo vacío.

**Resultado confirmado:** la persistencia en MongoDB se verificó manualmente, incluso después de reiniciar el servidor.

## Actividad 3 — POST /secureChatGPT

El endpoint recibe un JSON con `message`. Anonimiza nombres, correos y teléfonos con la misma bóveda de MongoDB, envía únicamente el texto anonimizado a la API Responses de OpenAI y restaura los tokens que el modelo conserve. La correspondencia entre tokens y datos personales no sale de la aplicación.

Configura `OPENAI_API_KEY` en el entorno o en `.env`. `OPENAI_MODEL` es opcional; si no está definida, se usa `gpt-4.1-mini`. No escribas la clave en el código, en capturas ni en entregables.

Con el servidor iniciado y MongoDB disponible, puedes probarlo con datos ficticios. Comando para CMD de Windows:

```
curl -X POST -s http://127.0.0.1:3001/secureChatGPT -H "Content-Type: application/json" -d "{\"message\":\"Ana Torres escribio a ana@example.test desde 3001234567\"}"
```

La respuesta contiene `message`, con el texto ya restaurado, y `unresolved`, con los tokens de la respuesta que no existen en la bóveda. Esta llamada sí contacta a OpenAI. Las pruebas de `npm test` no lo hacen: sustituyen la API por un doble de prueba.

### Errores

| Situación | HTTP |
| --- | --- |
| JSON inválido, `message` ausente, vacío o de más de 10000 caracteres | 400 |
| Falta `OPENAI_API_KEY` o el modelo | 503 |
| OpenAI rechaza la consulta o no devuelve texto | 502 |
| OpenAI no responde en 30 segundos | 504 |
| Fallo interno, incluido MongoDB | 500 |

El proceso no registra el mensaje, la respuesta del modelo ni la clave.

### Limitaciones de privacidad

- La aplicación no envía deliberadamente la tabla de correspondencias a OpenAI. Aun así, las expresiones regulares pueden dejar información personal sin detectar (por ejemplo, documentos, direcciones, nombres de una sola palabra o datos que identifiquen a alguien de forma indirecta).
- OpenAI recibe el texto anonimizado. Su registro y su retención quedan fuera de esta aplicación.
- Si el modelo reescribe o divide un token, la restauración no puede recuperar el dato.
- La bóveda sigue guardando el valor original de forma recuperable. `/deanonymize` y `/secureChatGPT` no autentican a quien llama. Usa exclusivamente datos ficticios en el taller.

## Resultados técnicos confirmados

| Verificación | Resultado |
| --- | --- |
| Persistencia en MongoDB (manual, con reinicio del servidor) | Confirmada |
| `npm test` | 7 pruebas aprobadas, 0 fallidas, 1 omitida |
| Prueba automatizada de persistencia | Omitida (no se definió `MONGODB_TEST_DB`); no se declara aprobada |
| Integración real con OpenAI (`POST /secureChatGPT`) | HTTP 200 y `unresolved: []` |
| Publicación del repositorio en GitHub | Confirmada |

Las capturas de pantalla asociadas a estas verificaciones quedan pendientes de validación; este README no inventa nombres de archivo de evidencia.
