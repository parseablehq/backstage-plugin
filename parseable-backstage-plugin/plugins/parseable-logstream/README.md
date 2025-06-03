# Parseable Logstream Plugin for Backstage

This plugin allows engineers to pull their own Parseable log-streams directly onto an entity page in Backstage.

## Features

- View log streams from Parseable directly in Backstage
- Select from available datasets the user has access to
- Live tail support with pause/resume functionality
- Copy log entries to clipboard
- Advanced search page with:
  - Time range selection
  - Free-text search
  - Export to CSV

## Installation

1. Install the plugin in your Backstage app:

```bash
# From your Backstage root directory
yarn add --cwd packages/app @internal/plugin-parseable-logstream
```

2. Configure the plugin in your `app-config.yaml`:

```yaml
# app-config.yaml
parseable:
  basicAuthCredential: ${PARSEABLE_B64_CRED}
```

You need to set the `PARSEABLE_B64_CRED` environment variable with the Base64 encoded credentials for Parseable (in the format `username:password`).

3. Add the plugin to your Backstage app:

```tsx
// packages/app/src/App.tsx
import { parseableLogstreamPlugin } from '@internal/plugin-parseable-logstream';

const app = createApp({
  // ...
  plugins: [
    // ...
    parseableLogstreamPlugin,
  ],
});
```

4. Add the plugin to your entity page:

```tsx
// packages/app/src/components/catalog/EntityPage.tsx
import {
  EntityParseableLogstreamContent,
  isParseableLogstreamAvailable,
} from '@internal/plugin-parseable-logstream';

// Add to your entity page layout
const serviceEntityPage = (
  <EntityLayout>
    {/* ... other tabs ... */}
    <EntityLayout.Route
      path="/parseable"
      title="Logs"
      if={isParseableLogstreamAvailable}
    >
      <EntityParseableLogstreamContent />
    </EntityLayout.Route>
  </EntityLayout>
);
```

## Configuration

### Entity Annotation

To enable the Parseable logstream for an entity, add the following annotation to your `catalog-info.yaml`:

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: example-service
  annotations:
    parseable.io/base-url: http://34.235.160.254:8000
  # ...
spec:
  type: service
  # ...
```

### Environment Variables

- `PARSEABLE_B64_CRED`: Base64 encoded credentials for Parseable in the format `username:password`

## Example Entity YAML

```yaml
apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: example-service
  description: An example service with Parseable logs
  annotations:
    parseable.io/base-url: http://34.235.160.254:8000
spec:
  type: service
  lifecycle: production
  owner: team-a
  system: system-a
```

## Development

To start the plugin in development mode:

```bash
# From the plugin directory
yarn start
```

To build the plugin:

```bash
# From the plugin directory
yarn build
```
