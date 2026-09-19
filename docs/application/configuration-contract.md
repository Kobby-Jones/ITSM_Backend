# ITSM Backend Runtime Configuration Contract

## Runtime

- Application runtime: Node.js 24
- Container base image: `node:24-alpine`
- Application port: `3000`
- Production environment: `NODE_ENV=production`
- Container process runs as non-root user:
  - UID: `1001`
  - GID: `1001`
  - User: `nodeapp`
  - Group: `nodejs`

## Application Startup

The production application starts with:

```text
node src/server.js