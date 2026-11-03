'use strict';

const crypto = require('crypto');

/**
 * Correspondencias de la Actividad 1.
 * Viven solo en este proceso y se pierden al reiniciar el servidor.
 * En la Actividad 2 este modulo se reemplaza por MongoDB.
 */
const tokenToOriginal = new Map();
const originalToToken = new Map();

function tokenFor(type, value) {
  const key = `${type}\0${value}`;
  const existing = originalToToken.get(key);
  if (existing) {
    return existing;
  }

  let token;
  do {
    token = `${type}_${crypto.randomBytes(4).toString('hex')}`;
  } while (tokenToOriginal.has(token));

  originalToToken.set(key, token);
  tokenToOriginal.set(token, value);
  return token;
}

function originalFor(token) {
  return tokenToOriginal.has(token) ? tokenToOriginal.get(token) : null;
}

module.exports = {
  tokenFor,
  originalFor,
};
