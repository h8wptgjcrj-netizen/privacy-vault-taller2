'use strict';

const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { createInterface } = require('node:readline');
const { test } = require('node:test');

async function start() {
  const child = spawn(process.execPath, ['src/server.js'], {
    stdio: ['ignore', 'pipe', 'inherit'],
    env: { ...process.env, MONGODB_DB: process.env.MONGODB_TEST_DB },
  });
  const lines = createInterface({ input: child.stdout });
  const ready = await Promise.race([
    once(lines, 'line').then(([line]) => line === 'privacy-vault listo'),
    once(child, 'exit').then(() => false),
  ]);
  if (!ready) {
    child.kill();
    throw new Error('El servidor de prueba no inició.');
  }
  return child;
}

async function stop(child) {
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

async function post(endpoint, message) {
  const response = await fetch('http://127.0.0.1:3001/' + endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
    signal: AbortSignal.timeout(10000),
  });
  assert.equal(response.status, 200);
  return response.json();
}

test('restaura los datos y reutiliza los tokens tras reiniciar Node.js', {
  skip: !process.env.MONGODB_TEST_DB && 'Define MONGODB_TEST_DB para ejecutar la prueba real.',
  timeout: 60000,
}, async () => {
  assert.match(process.env.MONGODB_TEST_DB, /^privacy_vault_test(?:_[a-z0-9]+)?$/);
  const message = 'Ana Torres, ana@example.test, 3001234567';
  let first;
  let child = await start();
  try {
    const concurrent = await Promise.all(
      Array.from({ length: 4 }, () => post('anonymize', message)),
    );
    [first] = concurrent;
    assert.equal(first.replacements.length, 3);
    for (const result of concurrent) assert.deepEqual(result, first);
    assert.equal(first.message, first.replacements.map(({ token }) => token).join(', '));
  } finally {
    await stop(child);
  }

  child = await start();
  try {
    const result = await post('deanonymize', first.message);
    assert.equal(result.message, message);
    assert.equal(result.restored.length, 3);
    assert.deepEqual(result.unresolved, []);
    assert.deepEqual(await post('anonymize', message), first);
  } finally {
    await stop(child);
  }
});
