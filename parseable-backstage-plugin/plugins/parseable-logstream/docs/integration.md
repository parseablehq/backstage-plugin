# Integrating the Parseable Logstream Plugin

This guide provides detailed instructions on how to integrate the Parseable logstream plugin into your Backstage instance.

## Prerequisites

- A running Backstage instance
- Access to a Parseable server
- Basic auth credentials for Parseable

## Step 1: Install the Plugin

From your Backstage root directory, run:

```bash
yarn add --cwd packages/app @internal/plugin-parseable-logstream
```

## Step 2: Configure Authentication

The plugin requires Basic Authentication credentials to connect to Parseable. Add the following to your `app-config.yaml`:

```yaml
parseable:
  basicAuthCredential: ${PARSEABLE_B64_CRED}
```

You'll need to set the `PARSEABLE_B64_CRED` environment variable with the Base64 encoded credentials for Parseable. You can generate this with:

```bash
echo -n "username:password" | base64
```

## Step 3: Register the Plugin

Add the plugin to your Backstage app:

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

## Step 4: Add to Entity Page

Add the plugin to your entity page to display log streams:

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

## Step 5: Add Required Annotations

For each entity that should have access to Parseable logs, add the following annotation to its `catalog-info.yaml`:

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

## Troubleshooting

### Authentication Issues

If you encounter authentication errors:

1. Verify your Base64 encoded credentials are correct
2. Ensure the `PARSEABLE_B64_CRED` environment variable is set
3. Check that the user has access to the Parseable server

### No Datasets Available

If no datasets are shown:

1. Verify the user has permissions to access datasets in Parseable
2. Check that the Parseable base URL is correct
3. Ensure the Parseable server is running and accessible

### API Connection Issues

If the plugin cannot connect to the Parseable API:

1. Check network connectivity to the Parseable server
2. Verify the Parseable server is running
3. Ensure the base URL is correctly formatted with protocol (http/https)
