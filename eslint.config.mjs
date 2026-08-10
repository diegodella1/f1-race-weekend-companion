import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

const eslintConfig = [
  { ignores: ['**/.next/**', '**/coverage/**', '**/playwright-report/**', '**/test-results/**', '**/node_modules/**'] },
  ...nextCoreWebVitals,
  { rules: { '@next/next/no-html-link-for-pages': 'off' } }
];

export default eslintConfig;
