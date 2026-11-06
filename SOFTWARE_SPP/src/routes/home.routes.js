'use strict';
const express = require('express');
const asyncHandler = require('../utils/async-handler');

/** /api/home — any authenticated user; the service decides what each role sees. */
function createHomeRoutes({ controllers: { home }, guard }) {
  const router = express.Router();
  router.get('/', guard(), asyncHandler(home.get));
  return router;
}

module.exports = createHomeRoutes;
