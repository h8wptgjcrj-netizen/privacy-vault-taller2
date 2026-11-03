'use strict';

async function secureChat(message, { anonymize, deanonymize, client }) {
  const anonymized = await anonymize(message);
  const generated = await client.complete(anonymized.message);
  const restored = await deanonymize(generated);
  return {
    message: restored.message,
    unresolved: restored.unresolved,
  };
}

module.exports = { secureChat };
