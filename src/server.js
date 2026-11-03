'use strict';

require('dotenv').config({ quiet: true });
const { connectVault } = require('./mongoVault');
const express = require('express');
const { anonymize, deanonymize } = require('./anonymizer');
const { OpenAIClient } = require('./openaiClient');
const { secureChat } = require('./secureChat');

const PORT = 3001;
const MAX_MESSAGE_LENGTH = 10000;
const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

function validateMessage(req, res, next) {
  if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({
      error: 'El cuerpo debe ser un objeto JSON con el campo "message".',
    });
  }

  const { message } = req.body;
  if (typeof message !== 'string') {
    return res.status(400).json({
      error: 'El campo "message" es obligatorio y debe ser un string.',
    });
  }

  if (message.trim().length === 0) {
    return res.status(400).json({
      error: 'El campo "message" no puede estar vacío.',
    });
  }

  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({
      error: `El campo "message" supera el límite de ${MAX_MESSAGE_LENGTH} caracteres.`,
    });
  }

  return next();
}

function createApp({
  anonymize: anonymizeMessage = anonymize,
  deanonymize: deanonymizeMessage = deanonymize,
  openAIClient,
} = {}) {
  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.post('/anonymize', validateMessage, async (req, res) => {
    res.json(await anonymizeMessage(req.body.message));
  });

  app.post('/deanonymize', validateMessage, async (req, res) => {
    res.json(await deanonymizeMessage(req.body.message));
  });

  app.post('/secureChatGPT', validateMessage, async (req, res) => {
    if (!openAIClient || !openAIClient.isConfigured()) {
      return res.status(503).json({
        error: 'El servicio de OpenAI no está configurado.',
      });
    }

    try {
      const result = await secureChat(req.body.message, {
        anonymize: anonymizeMessage,
        deanonymize: deanonymizeMessage,
        client: openAIClient,
      });
      return res.json(result);
    } catch (error) {
      if (error.code === 'OPENAI_CONFIG') {
        return res.status(503).json({ error: 'El servicio de OpenAI no está configurado.' });
      }
      if (error.code === 'OPENAI_TIMEOUT') {
        return res.status(504).json({ error: 'OpenAI no respondió a tiempo.' });
      }
      if (error.code === 'OPENAI_UPSTREAM') {
        return res.status(502).json({ error: 'OpenAI rechazó o no pudo completar la consulta.' });
      }
      throw error;
    }
  });

  app.use((req, res) => {
    res.status(404).json({ error: 'Ruta no encontrada.' });
  });

  app.use((err, req, res, next) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err.type === 'entity.parse.failed' || (err instanceof SyntaxError && err.status === 400)) {
      return res.status(400).json({ error: 'El cuerpo de la petición no es JSON válido.' });
    }

    console.error('Fallo al procesar la petición.');
    return res.status(500).json({ error: 'Error interno del servidor.' });
  });

  return app;
}

if (require.main === module) {
  const openAIClient = new OpenAIClient({
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || DEFAULT_OPENAI_MODEL,
  });
  const app = createApp({ openAIClient });

  connectVault(process.env.MONGODB_URI, process.env.MONGODB_DB)
    .then(() => {
      app.listen(PORT, '127.0.0.1', () => {
        console.log('privacy-vault listo');
      });
    })
    .catch(() => {
      console.error('No se pudo iniciar MongoDB. Revisa la configuración y el acceso.');
      process.exitCode = 1;
    });
}

module.exports = { createApp };
