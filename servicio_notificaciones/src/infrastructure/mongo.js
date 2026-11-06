'use strict';
const mongoose = require('mongoose');
const env = require('../config/env');

/** Conexión única a la base MongoDB del microservicio (colección `notificaciones`). */
class MongoConnection {
  #connection = null;

  async connect() {
    if (this.#connection) return this.#connection;
    if (!env.mongoUri) throw new Error('Falta la variable MONGO_URI_NOTIFICATIONS');
    this.#connection = mongoose.createConnection(env.mongoUri, { serverSelectionTimeoutMS: 15000 });
    await this.#connection.asPromise();
    console.log('[mongo] conectado');
    return this.#connection;
  }

  get connection() {
    if (!this.#connection) throw new Error('MongoDB no está conectado: llama a connect() al arrancar');
    return this.#connection;
  }

  async close() {
    if (this.#connection) await this.#connection.close();
    this.#connection = null;
  }
}

module.exports = new MongoConnection();
