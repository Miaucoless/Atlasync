/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals'],
  rules: {
    // Warn when useEffect / useCallback / useMemo dependency arrays are
    // incomplete or contain values that are set inside the same effect.
    // Incomplete deps are the #1 cause of infinite fetch loops in this codebase.
    'react-hooks/exhaustive-deps': 'warn',

    // Discourage direct access to browser globals inside component bodies
    // without a client-only guard (e.g. useEffect / typeof checks).
    // These are common sources of SSR errors and unstable effect closures.
    'no-restricted-globals': [
      'warn',
      {
        name: 'window',
        message:
          'Accessing `window` outside useEffect / event handlers can cause SSR errors and unstable effect deps.',
      },
      {
        name: 'document',
        message:
          'Accessing `document` outside useEffect / event handlers can cause SSR errors and unstable effect deps.',
      },
      {
        name: 'localStorage',
        message:
          'Accessing `localStorage` outside useEffect causes SSR errors. Wrap in useEffect or check typeof window.',
      },
    ],
  },
};
