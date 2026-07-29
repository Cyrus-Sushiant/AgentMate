import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/dist-electron/**', '**/out/**', '**/release/**', '**/node_modules/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        ...globals.node,
        ...globals.es2022,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      'no-console': 'warn',
    },
  },
  {
    files: ['**/*.tsx', '**/*.jsx'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      // The browser's native `title` tooltip can't be styled and ignores the
      // app's theme, so hover hints go through <SimpleTooltip> instead. Only
      // lowercase (real DOM) elements are flagged; `title` stays fair game as
      // a prop on our own components.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'JSXOpeningElement[name.type="JSXIdentifier"][name.name=/^[a-z]/] > JSXAttribute[name.name="title"]',
          message:
            'Wrap the element in <SimpleTooltip label="…"> instead of using the native `title` attribute.',
        },
      ],
    },
  },
);
