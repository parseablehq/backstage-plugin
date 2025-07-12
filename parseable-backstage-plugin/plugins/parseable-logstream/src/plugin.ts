import {
  createPlugin,
  createRoutableExtension,
  createComponentExtension,
} from '@backstage/core-plugin-api';

import { parseableApiFactory } from './api';

import { rootRouteRef } from './routes';

export const parseableLogstreamPlugin = createPlugin({
  id: 'parseable-logstream',
  routes: {
    root: rootRouteRef,
  },
  apis: [
    parseableApiFactory,
  ],
});

export const ParseableLogstreamPage = parseableLogstreamPlugin.provide(
  createRoutableExtension({
    name: 'ParseableLogstreamPage',
    component: () =>
      import('./components/ParseableLogstreamPage').then(m => m.ParseableLogstreamPage),
    mountPoint: rootRouteRef,
  }),
);

export const EntityParseableLogstreamContent = parseableLogstreamPlugin.provide(
  createComponentExtension({
    name: 'EntityParseableLogstreamContent',
    component: {
      lazy: () =>
        import('./components/EntityParseableLogstreamContent').then(
          m => m.EntityParseableLogstreamContent,
        ),
    },
  }),
);
