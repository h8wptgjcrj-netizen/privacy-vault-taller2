# Privacy Vault · Actividades 2 y 3

Esta copia integra MongoDB en los endpoints de la Actividad 1. El servidor escucha en 127.0.0.1:3001 después de conectar con la base. La colección `tokens` guarda el token como `_id`, el tipo y el valor original. El índice único por tipo y valor permite reutilizar el mismo token incluso con peticiones simultáneas. Los datos de la Actividad 1 residían en el proceso original. Para persistirlos, vuelve a anonimizar los mensajes ficticios con la nueva versión.

## Ejecución local

1. Usa Node.js 24 con npm disponible. En esta carpeta, ejecuta `npm install`.
2. Cuando tengas acceso autorizado a MongoDB, configura `MONGODB_URI` y `MONGODB_DB` como variables de entorno. También puedes usar un `.env` basado en `.env.example` en una copia fuera de OneDrive. Mantén la URI y las credenciales fuera de capturas y entregables.
3. Ejecuta `npm start`. Comprueba que aparece `privacy-vault listo`.

La cuenta, el clúster, el usuario y el acceso de red de Atlas se gestionan con autorización. La aplicación almacena el valor original en forma recuperable y el endpoint de restauración carece de autenticación. Usa exclusivamente datos ficticios en el taller.

## Prueba de persistencia

Con el puerto 3001 libre y la URI configurada, define una base de prueba autorizada. En PowerShell:

```powershell
$env:MONGODB_TEST_DB = 'privacy_vault_test'
npm test
```

La prueba envía cuatro solicitudes concurrentes con un nombre, un correo y un teléfono ficticios. Comprueba que cada respuesta usa los mismos tres tokens. Detiene Node.js, inicia otro proceso con la misma base, restaura el mensaje con los tokens previos y verifica que la anonimización devuelve los mismos tokens. La prueba escribe correspondencias ficticias en la base de prueba y las conserva para inspección.

## Registro de evidencias

| Evidencia | Qué debe mostrar | Estado |
| --- | --- | --- |
| 04_Anonimizacion_MongoDB.png | Los tres tokens obtenidos antes de detener el servidor | Pendiente |
| 05_Reinicio_Restauracion.png | El reinicio y la recuperación exacta del mensaje ficticio con los tokens previos | Pendiente |
| 06_Prueba_Persistencia.png | Resultado de `npm test` con una prueba aprobada y cero omitidas | Pendiente |

Para capturar los pasos manuales, envía el JSON `{"message":"Ana Torres, ana@example.test, 3001234567"}` a `POST /anonymize`. Guarda el campo `message` devuelto, detén el servidor con Ctrl+C y vuelve a ejecutar `npm start`. Envía el campo guardado en un JSON a `POST /deanonymize`. Comprueba el mensaje original y que `unresolved` sea un arreglo vacío.

## Actividad 3 — POST /secureChatGPT

El endpoint recibe un JSON con `message`. Anonimiza nombres, correos y teléfonos con la misma bóveda de MongoDB, envía únicamente el texto anonimizado a la API Responses de OpenAI y restaura los tokens que el modelo conserve. La correspondencia entre tokens y datos personales no sale de la aplicación.

Configura `OPENAI_API_KEY` en el entorno o en `.env`. `OPENAI_MODEL` es opcional; si no está definida, se usa `gpt-4.1-mini`. No escribas la clave en el código, en capturas ni en entregables.

Con el servidor iniciado y MongoDB disponible, puedes probarlo con datos ficticios:

```powershell
curl -s http://127.0.0.1:3001/secureChatGPT -H "Content-Type: application/json" -d "{\"message\":\"Ana Torres escribio a ana@example.test desde 3001234567\"}"
```

La respuesta contiene `message`, con el texto ya restaurado, y `unresolved`, con los tokens de la respuesta que no existen en la bóveda. Esta llamada sí contacta a OpenAI. Las pruebas de `npm test` no lo hacen: sustituyen la API por un doble de prueba.

Sin `MONGODB_TEST_DB`, la prueba de persistencia de la Actividad 2 se omite. Las pruebas de `/secureChatGPT` se ejecutan igual.

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

- Las expresiones regulares no detectan documentos, direcciones, nombres de una sola palabra ni datos que identifiquen a alguien de forma indirecta.
- OpenAI recibe el texto anonimizado. Su registro y su retención quedan fuera de esta aplicación.
- Si el modelo reescribe o divide un token, la restauración no puede recuperar el dato.
- La bóveda sigue guardando el valor original de forma recuperable. `/deanonymize` y `/secureChatGPT` no autentican a quien llama. Usa exclusivamente datos ficticios en el taller.
