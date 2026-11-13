import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'core',
          include: ['**/*.spec.ts'],
          // tmp/ holds local checkouts, such as the admin app used by `mise run migrate`
          exclude: ['**/node_modules/**', 'tmp/**'],
          environment: 'node',
          setupFiles: ['./setup.node.ts'],
        },
      },
    ],
  },
});
