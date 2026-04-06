# Discord AI Bot - Deployment Pipeline Guide

## Overview

This guide covers the complete CI/CD deployment pipeline for Discord-AIBot to Docker Hub.

## Prerequisites

- GitHub repository with GitHub Actions enabled
- Docker Hub account and repository
- Docker installed locally for testing

## Setup

### 1. GitHub Secrets Configuration

Add these secrets to your GitHub repository (`Settings > Secrets and variables > Actions`):

```
DOCKERHUB_USERNAME   - Your Docker Hub username
DOCKERHUB_TOKEN      - Docker Hub Personal Access Token (not password)
```

### 2. Create Docker Hub Repository

1. Go to https://hub.docker.com
2. Click "Create Repository"
3. Name: `discord-aibot`
4. Visibility: Private (recommended) or Public
5. Click Create

### 3. Generate Docker Hub Token

1. Go to https://hub.docker.com/settings/security
2. Click "New Access Token"
3. Give it read/write permissions
4. Copy the token and add to GitHub Secrets as `DOCKERHUB_TOKEN`

## Pipeline Workflow

### Triggers

The pipeline runs on:
- **Push to main/develop**: Builds and pushes with branch tags
- **Pull Requests**: Runs tests and lint checks (no push)
- **Tags (v*)**: Builds and pushes with semantic version tags

### Build Process

1. **Checkout**: Gets latest code from repository
2. **Docker Buildx Setup**: Enables multi-platform builds (AMD64, ARM64)
3. **Login**: Authenticates with Docker Hub
4. **Metadata**: Generates appropriate image tags
5. **Build & Push**: Multi-platform build and push to Docker Hub
6. **Cache Management**: Uses GitHub Actions cache for faster builds

### Tagging Strategy

Images are tagged automatically as:
- `latest` - On main branch pushes
- `develop` - On develop branch pushes
- `v1.2.3` - On version tags (v1.2.3)
- `v1.2` - Major.minor versions
- `sha-abc1234` - Commit SHA (short form)

### Test Process (Pull Requests Only)

1. Runs on Ubuntu latest
2. Sets up Node.js 20
3. Installs dependencies with npm ci
4. Runs ESLint linter
5. Runs Jest tests with coverage
6. Uploads coverage to Codecov

## Local Development

### Build Locally

```bash
# Build for current platform
docker build -t discord-aibot:latest .

# Build multi-platform (requires buildx)
docker buildx build --platform linux/amd64,linux/arm64 -t username/discord-aibot:latest .
```

### Deploy Locally

```bash
# Using development compose
docker compose -f compose-dev.yaml up -d

# Using production compose
docker compose -f docker-compose.deploy.yml up -d
```

### Environment Setup

Create `.env.prod.local` file with required variables:

```
DISCORD_TOKEN=your_token_here
MONGODB_URI=mongodb://host:port/database
LOG_LEVEL=info
NODE_ENV=production
```

## Production Deployment

### Option 1: Docker Compose (Single Host)

```bash
# Pull latest image
docker pull username/discord-aibot:latest

# Deploy using production compose
docker compose -f docker-compose.deploy.yml up -d

# Monitor logs
docker compose -f docker-compose.deploy.yml logs -f discord-aibot

# Update to new version
docker compose -f docker-compose.deploy.yml pull
docker compose -f docker-compose.deploy.yml up -d
```

### Option 2: Docker Compose with Specific Version

```bash
# Deploy specific version
DOCKERHUB_USERNAME=your_username docker compose -f docker-compose.deploy.yml up -d
```

### Option 3: Manual Docker Run

```bash
docker run -d \
  --name discord-aibot \
  --restart always \
  -e DISCORD_TOKEN="your_token" \
  -e MONGODB_URI="mongodb://host:port/db" \
  -e NODE_ENV=production \
  -p 3000:3000 \
  -p 8000:8000 \
  -v bot-data:/app/data \
  -v bot-logs:/app/logs \
  username/discord-aibot:latest
```

## Monitoring & Logs

### View Logs

```bash
# Using docker compose
docker compose -f docker-compose.deploy.yml logs -f discord-aibot

# Using docker
docker logs -f discord-aibot

# Follow last 100 lines
docker logs --tail 100 -f discord-aibot
```

### Health Checks

The container includes automated health checks:

```bash
# Check container health
docker inspect discord-aibot --format='{{.State.Health.Status}}'
```

### Resource Monitoring

```bash
# View container stats
docker stats discord-aibot

# Check allocated resources
docker inspect discord-aibot | grep -A 5 "HostConfig"
```

## Rollback

### Rollback to Previous Version

```bash
# Stop current container
docker compose -f docker-compose.deploy.yml down

# Update image tag in .env or docker-compose.deploy.yml
# Deploy previous version
docker compose -f docker-compose.deploy.yml up -d
```

### View Available Tags

```bash
# On Docker Hub web UI
# Or pull manifest details
docker manifest inspect username/discord-aibot
```

## Troubleshooting

### Build Failures

1. Check GitHub Actions logs: `Actions > Build and Push to Docker Hub > Logs`
2. Review build step output for TypeScript or pnpm errors
3. Common issues:
   - Missing pnpm version compatibility
   - Build scripts not found (db:generate, build)
   - Missing dependencies in pnpm-lock.yaml

### Push Failures

1. Verify `DOCKERHUB_TOKEN` is correct (not password)
2. Ensure `discord-aibot` repository exists on Docker Hub
3. Check Docker Hub account quota

### Runtime Failures

1. Check container logs: `docker logs discord-aibot`
2. Verify MongoDB connection string
3. Confirm Discord token is valid
4. Review volume mount permissions

### Workspace Issues (Monorepo)

If the build fails on workspace packages:

1. Ensure all packages have `package.json` with build script
2. Verify workspace paths in root `package.json`
3. Test locally with: `pnpm -r run build`

## Maintenance

### Update Dependencies

```bash
# Update packages
pnpm update

# Audit for vulnerabilities
pnpm audit

# Fix vulnerabilities
pnpm audit --fix

# Rebuild lock file
pnpm install
```

### Release Process

1. Update version in `package.json`
2. Create git tag: `git tag v1.2.3`
3. Push tag: `git push origin v1.2.3`
4. Pipeline automatically builds and pushes

## Advanced Configuration

### Workspace Package Builds

For monorepo with multiple packages, ensure `.github/workflows/build-push.yml` is updated:

```yaml
- name: Build workspace
  run: pnpm -r run build
```

### Build with Docker Build Cloud

1. Configure Docker Build Cloud in Docker Hub settings
2. Update GitHub Actions to use distributed builders
3. Faster, cached builds across multiple machines

## Security Best Practices

1. **Secrets Management**
   - Never commit `.env` files
   - Use GitHub Secrets for sensitive data
   - Rotate Docker Hub tokens quarterly

2. **Image Security**
   - Keep Node.js base image updated
   - Run security scans: `docker scout cves username/discord-aibot`
   - Pin specific versions in production

3. **Runtime Security**
   - Non-root user already configured
   - Limit CPU and memory allocation
   - Use network policies where applicable

## Sources

- https://docs.docker.com/build/ci/github-actions/
- https://docs.docker.com/compose/
- https://docs.docker.com/engine/security/
- https://hub.docker.com
