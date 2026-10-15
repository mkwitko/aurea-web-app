import { defineConfig } from '@kubb/core';
import { pluginOas } from '@kubb/plugin-oas';
import { pluginReactQuery } from '@kubb/plugin-react-query';
import { pluginTs } from '@kubb/plugin-ts';
import { pluginZod } from '@kubb/plugin-zod';

// Generates types + Zod schemas + TanStack Query hooks from the backend OpenAPI (api.json).
// Flow: `pnpm openapi:dump` in the aurea/back repo -> copy api.json here -> `pnpm api:generate`.
export default defineConfig({
  root: '.',
  input: { path: 'api.json' },
  output: { path: './src/api/generated', clean: true },
  plugins: [
    pluginOas(),
    pluginTs({ output: { path: './types' }, dateType: 'date', enumType: 'asConst' }),
    pluginZod({ output: { path: './zod' }, typed: true }),
    pluginReactQuery({
      output: { path: './hooks' },
      client: { importPath: '@/api/client', dataReturnType: 'data' },
      query: { methods: ['get'], importPath: '@tanstack/react-query' },
      mutation: { methods: ['post', 'put', 'patch', 'delete'] },
      group: { type: 'tag', name: ({ group }) => `${group}Hooks` },
    }),
  ],
});
