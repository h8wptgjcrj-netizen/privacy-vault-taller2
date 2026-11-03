'use strict';

const assert = require('node:assert/strict');
const { once } = require('node:events');
const { test } = require('node:test');
const { OpenAIClient, INSTRUCTIONS } = require('../src/openaiClient');
const { secureChat } = require('../src/secureChat');
const { createApp } = require('../src/server');

const ORIGINAL = 'Ana Torres, ana@example.test, 3001234567';
const ANONYMIZED = 'NAME_11111111, EMAIL_22222222, PHONE_33333333';
const FAKE_KEY = 'test-key-not-real';
const FAKE_MODEL = 'gpt-4.1-mini';

function fakeAnonymizer() {
  return {
    async anonymize(message) {
      assert.equal(message, ORIGINAL);
      return {
        message: ANONYMIZED,
        replacements: [
          { type: 'NAME', token: 'NAME_11111111', value: 'Ana Torres' },
          { type: 'EMAIL', token: 'EMAIL_22222222', value: 'ana@example.test' },
          { type: 'PHONE', token: 'PHONE_33333333', value: '3001234567' },
        ],
      };
    },
    async deanonymize(message) {
      return {
        message: message
          .replaceAll('NAME_11111111', 'Ana Torres')
          .replaceAll('EMAIL_22222222', 'ana@example.test')
          .replaceAll('PHONE_33333333', '3001234567'),
        restored: [],
        unresolved: message.includes('NAME_99999999') ? ['NAME_99999999'] : [],
      };
    },
  };
}

async function withServer(app, fn) {
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    await fn(server.address().port);
  } finally {
    server.close();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await once(server, 'close');
  }
}

async function post(port, body, headers = { 'Content-Type': 'application/json' }) {
  const response = await fetch(`http://127.0.0.1:${port}/secureChatGPT`, {
    method: 'POST',
    headers,
    body,
  });
  return { status: response.status, body: await response.json() };
}

test('envía a OpenAI solo el texto anonimizado y restaura los tokens', async () => {
  let sent;
  const vault = fakeAnonymizer();
  const result = await secureChat(ORIGINAL, {
    anonymize: vault.anonymize,
    deanonymize: vault.deanonymize,
    client: {
      async complete(input) {
        assert.equal(arguments.length, 1);
        sent = input;
        return `Recibido ${input}`;
      },
    },
  });

  assert.equal(sent, ANONYMIZED);
  assert.equal(sent.includes('Ana Torres'), false);
  assert.equal(sent.includes('ana@example.test'), false);
  assert.equal(sent.includes('3001234567'), false);
  assert.equal(result.message, `Recibido ${ORIGINAL}`);
  assert.deepEqual(result.unresolved, []);
});

test('conserva la respuesta cuando el modelo no repite tokens', async () => {
  const vault = fakeAnonymizer();
  const result = await secureChat(ORIGINAL, {
    anonymize: vault.anonymize,
    deanonymize: async (message) => ({ message, restored: [], unresolved: [] }),
    client: {
      async complete() {
        return 'Puedo ayudarte con eso.';
      },
    },
  });

  assert.equal(result.message, 'Puedo ayudarte con eso.');
  assert.deepEqual(result.unresolved, []);
});

test('la petición a la API Responses no incluye correspondencias ni datos ficticios', async () => {
  let captured;
  const client = new OpenAIClient({
    apiKey: FAKE_KEY,
    model: FAKE_MODEL,
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return {
        ok: true,
        json: async () => ({
          output: [
            {
              type: 'message',
              content: [
                { type: 'output_text', text: 'Hola ' },
                { type: 'output_text', text: 'NAME_11111111' },
              ],
            },
            { type: 'reasoning' },
          ],
        }),
      };
    },
  });

  const text = await client.complete(ANONYMIZED);
  const body = JSON.parse(captured.options.body);

  assert.equal(text, 'Hola NAME_11111111');
  assert.equal(captured.url, 'https://api.openai.com/v1/responses');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers.Authorization, `Bearer ${FAKE_KEY}`);
  assert.deepEqual(Object.keys(body).sort(), ['input', 'instructions', 'max_output_tokens', 'model']);
  assert.equal(body.model, FAKE_MODEL);
  assert.equal(body.input, ANONYMIZED);
  assert.equal(body.instructions, INSTRUCTIONS);
  assert.equal(body.max_output_tokens, 800);
  assert.equal(JSON.stringify(body).includes('Ana Torres'), false);
  assert.equal(JSON.stringify(body).includes('ana@example.test'), false);
  assert.equal(JSON.stringify(body).includes('3001234567'), false);
  assert.equal(JSON.stringify(body).includes('replacements'), false);
  assert.equal(body.instructions.includes('@'), false);
});

test('traduce fallos de OpenAI sin propagar el cuerpo remoto', async () => {
  const rejected = new OpenAIClient({
    apiKey: FAKE_KEY,
    model: FAKE_MODEL,
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: 'incorrect api key sk-secret Ana Torres' } }),
    }),
  });
  await assert.rejects(rejected.complete(ANONYMIZED), (error) => {
    assert.equal(error.code, 'OPENAI_UPSTREAM');
    assert.equal(error.message.includes('sk-secret'), false);
    assert.equal(error.message.includes('Ana Torres'), false);
    return true;
  });

  const timedOut = new OpenAIClient({
    apiKey: FAKE_KEY,
    model: FAKE_MODEL,
    fetchImpl: async () => {
      const error = new Error('timeout Ana Torres');
      error.name = 'TimeoutError';
      throw error;
    },
  });
  await assert.rejects(timedOut.complete(ANONYMIZED), (error) => {
    assert.equal(error.code, 'OPENAI_TIMEOUT');
    assert.equal(error.message.includes('Ana Torres'), false);
    return true;
  });

  const unconfigured = new OpenAIClient({ apiKey: '', model: FAKE_MODEL });
  await assert.rejects(unconfigured.complete(ANONYMIZED), (error) => {
    assert.equal(error.code, 'OPENAI_CONFIG');
    return true;
  });
});

test('POST /secureChatGPT valida la entrada y no llama a OpenAI si es inválida', async () => {
  let called = false;
  const app = createApp({
    openAIClient: {
      isConfigured: () => true,
      async complete() {
        called = true;
        return 'no deberia usarse';
      },
    },
    anonymize: async () => {
      called = true;
      return { message: ANONYMIZED, replacements: [] };
    },
  });

  await withServer(app, async (port) => {
    const empty = await post(port, JSON.stringify({}));
    assert.equal(empty.status, 400);
    assert.match(empty.body.error, /message/);

    const blank = await post(port, JSON.stringify({ message: '   ' }));
    assert.equal(blank.status, 400);

    const invalid = await post(port, '{');
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.error, 'El cuerpo de la petición no es JSON válido.');
  });
  assert.equal(called, false);
});

test('POST /secureChatGPT restaura la respuesta y reporta errores sin datos sensibles', async () => {
  const vault = fakeAnonymizer();
  let sent;
  const app = createApp({
    anonymize: vault.anonymize,
    deanonymize: vault.deanonymize,
    openAIClient: {
      isConfigured: () => true,
      async complete(input) {
        sent = input;
        return `Listo: ${input} NAME_99999999`;
      },
    },
  });

  await withServer(app, async (port) => {
    const success = await post(port, JSON.stringify({ message: ORIGINAL }));
    assert.equal(success.status, 200);
    assert.equal(sent, ANONYMIZED);
    assert.equal(success.body.message, `Listo: ${ORIGINAL} NAME_99999999`);
    assert.deepEqual(success.body.unresolved, ['NAME_99999999']);
    assert.equal(JSON.stringify(success.body).includes('replacements'), false);
  });

  const missing = createApp({
    openAIClient: { isConfigured: () => false, async complete() { throw new Error('no'); } },
  });
  await withServer(missing, async (port) => {
    const response = await post(port, JSON.stringify({ message: ORIGINAL }));
    assert.equal(response.status, 503);
    assert.equal(response.body.error, 'El servicio de OpenAI no está configurado.');
  });

  const upstream = createApp({
    anonymize: vault.anonymize,
    openAIClient: {
      isConfigured: () => true,
      async complete() {
        const error = new Error('boom Ana Torres sk-secret');
        error.code = 'OPENAI_UPSTREAM';
        throw error;
      },
    },
  });
  await withServer(upstream, async (port) => {
    const response = await post(port, JSON.stringify({ message: ORIGINAL }));
    assert.equal(response.status, 502);
    assert.equal(response.body.error, 'OpenAI rechazó o no pudo completar la consulta.');
    assert.equal(JSON.stringify(response.body).includes('Ana Torres'), false);
    assert.equal(JSON.stringify(response.body).includes('sk-secret'), false);
  });

  const timeout = createApp({
    anonymize: vault.anonymize,
    openAIClient: {
      isConfigured: () => true,
      async complete() {
        const error = new Error('timeout');
        error.code = 'OPENAI_TIMEOUT';
        throw error;
      },
    },
  });
  await withServer(timeout, async (port) => {
    const response = await post(port, JSON.stringify({ message: ORIGINAL }));
    assert.equal(response.status, 504);
    assert.equal(response.body.error, 'OpenAI no respondió a tiempo.');
  });
});

test('las rutas anteriores conservan la validación y la ruta desconocida sigue en 404', async () => {
  const app = createApp();
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const port = server.address().port;
    const anonymize = await fetch(`http://127.0.0.1:${port}/anonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: '' }),
    });
    assert.equal(anonymize.status, 400);
    const deanonymize = await fetch(`http://127.0.0.1:${port}/deanonymize`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 15 }),
    });
    assert.equal(deanonymize.status, 400);
    const missing = await fetch(`http://127.0.0.1:${port}/otra`, { method: 'POST' });
    assert.equal(missing.status, 404);
  } finally {
    server.close();
    if (typeof server.closeAllConnections === 'function') {
      server.closeAllConnections();
    }
    await once(server, 'close');
  }
});
