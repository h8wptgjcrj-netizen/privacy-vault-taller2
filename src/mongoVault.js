'use strict';

const { randomBytes } = require('node:crypto');

let collection;

async function connectVault(uri, database) {
  if (!uri || !database) {
    throw new Error('Faltan MONGODB_URI o MONGODB_DB.');
  }

  const { MongoClient } = require('mongodb');
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  try {
    await client.connect();
    const tokens = client.db(database).collection('tokens');
    await tokens.createIndex({ type: 1, value: 1 }, { unique: true });
    collection = tokens;
  } catch (error) {
    await client.close();
    throw error;
  }
}

async function tokenFor(type, value) {
  const filter = { type, value };
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const existing = await collection.findOne(filter);
    if (existing) {
      return existing._id;
    }

    const token = `${type}_${randomBytes(4).toString('hex')}`;
    try {
      await collection.insertOne({ _id: token, ...filter });
      return token;
    } catch (error) {
      if (error.code !== 11000) {
        throw error;
      }
    }
  }

  throw new Error('No se pudo asignar un token único.');
}

async function originalFor(token) {
  const mapping = await collection.findOne({ _id: token });
  return mapping?.value ?? null;
}

module.exports = { connectVault, tokenFor, originalFor };
