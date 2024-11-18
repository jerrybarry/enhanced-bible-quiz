module.exports = {
    extends: ['next/core-web-vitals', 'plugin:@typescript-eslint/recommended'],
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-unused-expressions': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  };