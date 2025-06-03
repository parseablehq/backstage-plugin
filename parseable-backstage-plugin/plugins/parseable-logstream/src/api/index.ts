import {
  configApiRef,
  createApiFactory,
  createApiRef,
  discoveryApiRef,
  fetchApiRef,
  identityApiRef,
} from '@backstage/core-plugin-api';
import { ParseableClient } from './ParseableClient';

export const parseableApiRef = createApiRef<ParseableClient>({
  id: 'plugin.parseable-logstream.service',
});

export const parseableApiFactory = createApiFactory({
  api: parseableApiRef,
  deps: {
    discoveryApi: discoveryApiRef,
    fetchApi: fetchApiRef,
    identityApi: identityApiRef,
    configApi: configApiRef,
  },
  factory: deps => {
    return new ParseableClient({
      fetchApi: deps.fetchApi,
      identityApi: deps.identityApi,
      configApi: deps.configApi,
    });
  },
});

export { ParseableClient } from './ParseableClient';
export type { ParseableUserResponse, LogEntry } from './ParseableClient';
