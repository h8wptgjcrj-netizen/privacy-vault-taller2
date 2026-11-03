'use strict';

const { tokenFor, originalFor } = require('./mongoVault');

const EMAIL_REGEX = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// Numero con separadores (opcional codigo de pais) o bloque compacto de 10 a 13 digitos.
const PHONE_REGEX =
  /(?:\+\d{1,3}[\s.-])?(?:\(?\d{2,4}\)?[\s.-])\d{3,4}[\s.-]\d{3,4}\b|\b\d{10,13}\b/g;

// Al menos dos palabras capitalizadas. Admite particulas espanolas entre ellas: de, del, la, las, los, y.
const NAME_REGEX =
  /\b[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+(?:\s+(?:(?:de|del|la|las|los|y)\s+)*[A-ZÁÉÍÓÚÜÑ][a-záéíóúüñ]+){1,4}\b/g;

const TOKEN_REGEX = /\b(?:NAME|EMAIL|PHONE)_[a-f0-9]{8}\b/g;

const LEADING_SKIP = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'hola',
  'estimado',
  'estimada',
  'senor',
  'señor',
  'señora',
  'senora',
  'sr',
  'sra',
  'doctor',
  'doctora',
  'don',
  'dona',
  'doña',
]);

function refineName(match) {
  const parts = match.split(/\s+/);
  let start = 0;
  while (start < parts.length && LEADING_SKIP.has(parts[start].toLowerCase())) {
    start += 1;
  }

  const kept = parts.slice(start);
  const capitalWords = kept.filter((word) => /^[A-ZÁÉÍÓÚÜÑ]/.test(word));
  if (capitalWords.length < 2) {
    return null;
  }

  return kept.join(' ');
}

async function applyPattern(text, pattern, type, replacements) {
  const regex = new RegExp(pattern.source, pattern.flags);
  let result = ''; 
  let end = 0;
  for (const entry of text.matchAll(regex)) {
    const [match] = entry;
    result += text.slice(end, entry.index);
    end = entry.index + match.length;
    let value = match;
    let prefix = '';

    if (type === 'NAME') {
      const refined = refineName(match);
      if (!refined || !match.endsWith(refined)) {
        result += match;
        continue;
      }
      prefix = match.slice(0, match.length - refined.length);
      value = refined;
    }

    const token = await tokenFor(type, value);
    if (!replacements.some((item) => item.token === token)) {
      replacements.push({ type, token });
    }
    result += prefix + token;
  }
  return result + text.slice(end);
}

async function anonymize(message) {
  const replacements = [];
  let text = message;
  text = await applyPattern(text, EMAIL_REGEX, 'EMAIL', replacements);
  text = await applyPattern(text, PHONE_REGEX, 'PHONE', replacements);
  text = await applyPattern(text, NAME_REGEX, 'NAME', replacements);
  return { message: text, replacements };
}

async function deanonymize(message) {
  const restored = [];
  const unresolved = [];
  const regex = new RegExp(TOKEN_REGEX.source, TOKEN_REGEX.flags);

  const originals = new Map();
  for (const token of new Set(message.match(regex) ?? [])) {
    originals.set(token, await originalFor(token));
  }
  const text = message.replace(regex, (token) => {
    const original = originals.get(token);
    if (original === null) {
      if (!unresolved.includes(token)) {
        unresolved.push(token);
      }
      return token;
    }

    const type = token.slice(0, token.indexOf('_'));
    if (!restored.some((item) => item.token === token)) {
      restored.push({ type, token });
    }
    return original;
  });

  return { message: text, restored, unresolved };
}

module.exports = {
  anonymize,
  deanonymize,
};
