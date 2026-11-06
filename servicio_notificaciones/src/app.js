'use strict';
const express = require('express');
const createRoutes = require('./routes');
const { notFound, errorHandler } = require('./middlewares/error');

/** Construye la app de Express (sin abrir puerto) a partir de un contenedor de dependencias. */
function createApp(container) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '100kb' }));
  app.use(createRoutes(container));
  app.use(notFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
