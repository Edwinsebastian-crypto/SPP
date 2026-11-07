'use strict';
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  { ignores: ['node_modules/**', 'public/css/**', 'public/dist/**', 'frontend/dist/**'] },
  js.configs.recommended,
  {
    // Server code, scripts and tests run on Node (CommonJS)
    files: ['src/**/*.js', 'scripts/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      eqeqeq: ['error', 'always', { null: 'ignore' }]
    }
  },
  {
    // Frontend ES modules and React components
    files: ['frontend/src/**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: { jsx: true }
      },
      globals: { ...globals.browser }
    },
    rules: {
      'no-unused-vars': ['warn', { varsIgnorePattern: '^React$', argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-restricted-properties': [
        'error',
        { object: 'window', property: 'SPP', message: 'Importa desde core/ en lugar de usar window.SPP' }
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: "MemberExpression[object.name='window'][property.name=/^(SPP_|Eval|updateStudentQuestionsPill)/]",
          message: 'Usa core/registry, core/practiceStore o imports; no globales en window'
        }
      ]
    }
  }
];
