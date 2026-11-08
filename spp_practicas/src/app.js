'use strict';
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');

const env = require('./config/env');
const { createContainer } = require('./container');
const { createApiRouter, createPagesRouter, createInternalRouter } = require('./routes');
const { securityHeaders } = require('./middlewares/security.middleware');
const { apiNotFound, errorHandler } = require('./middlewares/error.middleware');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
/** Public asset folders. The `pages` folder is deliberately NOT served statically (it is role-protected). */
const STATIC_FOLDERS = ['css', 'img', 'dist'];

/** Builds the Express application (no port is opened here, which makes it easy to test). */
function createApp(container = createContainer()) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1); // behind a proxy (Render, Railway...) so rate limiting sees the real client IP

  app.use(securityHeaders());
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  // Health check endpoint (for reverse proxy, Docker, or monitoring)
  app.get('/healthz', (_req, res) => res.json({ status: 'ok' }));

  // Pages first, so /pages/*.html is never served without a session
  app.use(createPagesRouter(container));
  app.use('/api/internal', createInternalRouter(container));
  app.use('/api', createApiRouter(container));

  // Public configuration for the views (domain of the institutional e-mail addresses)
  app.get('/api/config', (_req, res) => {
    res.json({ institutionalDomain: env.institutionalDomain });
  });
  for (const folder of STATIC_FOLDERS) {
    app.use(`/${folder}`, express.static(path.join(PUBLIC_DIR, folder), { maxAge: env.isProduction ? '1h' : 0 }));
  }

  app.use('/api', apiNotFound);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp };
