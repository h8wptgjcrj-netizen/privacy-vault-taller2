'use strict';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1/responses';
const DEFAULT_TIMEOUT_MS = 30000;
const DEFAULT_MAX_OUTPUT_TOKENS = 800;

const INSTRUCTIONS =
  'Responde en el idioma del usuario. Conserva exactamente cualquier token ' +
  'NAME_, EMAIL_ o PHONE_ seguido de 8 caracteres hexadecimales. ' +
  'No intentes identificar a quién corresponde.';

class OpenAIClient {
  constructor({
    apiKey,
    model,
    fetchImpl = globalThis.fetch,
    baseUrl = DEFAULT_BASE_URL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxOutputTokens = DEFAULT_MAX_OUTPUT_TOKENS,
  } = {}) {
    this.apiKey = apiKey;
    this.model = model;
    this.fetchImpl = fetchImpl;
    this.baseUrl = baseUrl;
    this.timeoutMs = timeoutMs;
    this.maxOutputTokens = maxOutputTokens;
  }

  isConfigured() {
    return typeof this.apiKey === 'string' && this.apiKey.length > 0
      && typeof this.model === 'string' && this.model.length > 0;
  }

  async complete(input) {
    if (!this.isConfigured()) {
      const error = new Error('OpenAI no está configurado.');
      error.code = 'OPENAI_CONFIG';
      throw error;
    }

    if (typeof input !== 'string') {
      const error = new Error('La consulta anonimizada debe ser texto.');
      error.code = 'OPENAI_UPSTREAM';
      throw error;
    }

    let response;
    try {
      response = await this.fetchImpl(this.baseUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          instructions: INSTRUCTIONS,
          input,
          max_output_tokens: this.maxOutputTokens,
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (cause) {
      const error = new Error('OpenAI no respondió a tiempo.');
      error.code = cause.name === 'TimeoutError' ? 'OPENAI_TIMEOUT' : 'OPENAI_UPSTREAM';
      throw error;
    }

    if (!response.ok) {
      const error = new Error('OpenAI rechazó la consulta.');
      error.code = 'OPENAI_UPSTREAM';
      throw error;
    }

    let payload;
    try {
      payload = await response.json();
    } catch {
      const error = new Error('OpenAI no devolvió texto.');
      error.code = 'OPENAI_UPSTREAM';
      throw error;
    }

    const text = extractOutputText(payload);
    if (!text) {
      const error = new Error('OpenAI no devolvió texto.');
      error.code = 'OPENAI_UPSTREAM';
      throw error;
    }
    return text;
  }
}

function extractOutputText(payload) {
  const chunks = [];
  for (const item of payload?.output ?? []) {
    for (const part of item?.content ?? []) {
      if (part?.type === 'output_text' && typeof part.text === 'string') {
        chunks.push(part.text);
      }
    }
  }
  const text = chunks.join('');
  return text.length > 0 ? text : null;
}

module.exports = { OpenAIClient, INSTRUCTIONS };
