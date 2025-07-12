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
yarn add --cwd packages/app @parseable/backstage-plugin-logstream
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
import { parseableLogstreamPlugin } from '@parseable/backstage-plugin-logstream';

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
} from '@parseable/backstage-plugin-logstream';

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
    parseable.io/base-url: https://demo.parseable.com
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
    parseable.io/base-url: https://demo.parseable.com
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

## Publishing

This plugin is published to the npm registry under the `@parseable` organization. To publish a new version:

```bash
# From the plugin directory
yarn build
npm publish
```

Note: You need to be a member of the @parseable organization on npm and logged in via `npm login` to publish.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

Apache-2.0
