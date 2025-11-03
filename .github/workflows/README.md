# GitHub Actions Workflows

This directory contains GitHub Actions workflows for CI/CD automation.

## Workflows

### 1. CI Pipeline (`ci.yml`)

**Triggers:**
- Push to `main` branch
- Pull requests targeting `main` branch

**Jobs:**
- `lint-typecheck-test`: Runs linting, type checking, building, and testing

**Features:**
- ✅ pnpm dependency caching for faster builds
- ✅ Prisma client caching (when Prisma is used)
- ✅ Automatic Prisma client generation
- ✅ Comprehensive code quality checks

**Duration:** ~3-5 minutes (with cache)

### 2. Build & Deploy Pipeline (`build-deploy.yml`)

**Triggers:**
- Push to `main` branch
- Version tags (e.g., `v1.0.0`)

**Jobs:**

1. **Build**: Builds and pushes Docker images for all services
   - Builds `api`, `bot`, and `worker` services in parallel
   - Pushes images to GitHub Container Registry (GHCR)
   - Uses Docker layer caching for efficiency
   - Generates multiple tags (latest, version, commit SHA)

2. **Migrate**: Runs database migrations
   - Only runs on `main` branch
   - Depends on successful build
   - Uses the migration script at `scripts/db/migrate.sh`

3. **Deploy**: Deploys services to production
   - Only runs on `main` branch
   - Depends on successful build and migration
   - Placeholder for custom deployment logic

**Duration:** ~5-10 minutes (build) + migration time + deployment time

## Docker Image Tags

Images are pushed with multiple tags for flexibility:

- `latest` - Latest build from main branch
- `main` - Latest build from main branch
- `main-<sha>` - Specific commit from main branch
- `v1.2.3` - Semantic version tags
- `1.2` - Major.minor version
- `1` - Major version only

## Caching Strategy

### pnpm Store Cache

Caches the global pnpm store to speed up dependency installation:
```yaml
key: ${{ runner.os }}-pnpm-store-${{ hashFiles('**/pnpm-lock.yaml') }}
```

**Cache hit:** Dependencies are restored in seconds
**Cache miss:** Full installation takes 1-2 minutes

### Prisma Client Cache

Caches generated Prisma clients:
```yaml
key: ${{ runner.os }}-prisma-${{ hashFiles('**/schema.prisma') }}
```

**Cache hit:** Skips Prisma generate step
**Cache miss:** Regenerates Prisma clients (~10-30 seconds)

### Docker Build Cache

Uses GitHub Actions cache for Docker layers:
```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**Benefits:**
- Faster rebuilds when only code changes
- Efficient layer reuse across builds
- Automatic cache management by GitHub

## Required Secrets

Configure these in: **Settings → Secrets and variables → Actions**

### For Migrations & Deployment

| Secret | Description | Required | Example |
|--------|-------------|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Yes (for migrations) | `postgresql://user:pass@host:5432/db` |
| `DEPLOY_KEY` | SSH private key for deployment | Optional | SSH private key content |
| `DEPLOY_HOST` | Deployment server hostname | Optional | `deploy.example.com` |
| `DEPLOY_USER` | SSH username for deployment | Optional | `deployer` |

### Built-in Secrets

- `GITHUB_TOKEN` - Automatically provided by GitHub Actions

## Customizing Deployment

The deployment step in `build-deploy.yml` is a placeholder. Customize it based on your infrastructure:

### SSH Deployment Example

```yaml
- name: Deploy to production
  env:
    DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}
    DEPLOY_HOST: ${{ secrets.DEPLOY_HOST }}
    DEPLOY_USER: ${{ secrets.DEPLOY_USER }}
  run: |
    # Setup SSH
    mkdir -p ~/.ssh
    echo "$DEPLOY_KEY" > ~/.ssh/deploy_key
    chmod 600 ~/.ssh/deploy_key
    
    # Deploy via SSH
    ssh -i ~/.ssh/deploy_key -o StrictHostKeyChecking=no $DEPLOY_USER@$DEPLOY_HOST << 'EOF'
      cd /app
      docker-compose pull
      docker-compose up -d
    EOF
```

### Kubernetes Deployment Example

```yaml
- name: Deploy to Kubernetes
  run: |
    kubectl set image deployment/api api=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-api:latest
    kubectl set image deployment/bot bot=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-bot:latest
    kubectl set image deployment/worker worker=${{ env.REGISTRY }}/${{ env.IMAGE_PREFIX }}-worker:latest
    kubectl rollout status deployment/api
    kubectl rollout status deployment/bot
    kubectl rollout status deployment/worker
```

## Troubleshooting

### Build Failures

1. **Linting errors**: Run `pnpm lint` locally and fix issues
2. **Type errors**: Run `pnpm typecheck` locally
3. **Build errors**: Run `pnpm build` locally to debug

### Docker Build Failures

1. Check Dockerfile syntax
2. Ensure all dependencies are in package.json
3. Verify build context includes necessary files

### Migration Failures

1. Check `DATABASE_URL` secret is set correctly
2. Verify database is accessible from GitHub Actions
3. Test migration script locally: `./scripts/db/migrate.sh`

### Cache Issues

If caches are causing issues, you can clear them:
1. Go to **Actions** tab
2. Click **Caches** in the left sidebar
3. Delete problematic caches

## Best Practices

1. **Always test locally first**: Run all checks locally before pushing
2. **Use semantic versioning**: Tag releases with `v1.0.0` format
3. **Monitor workflow runs**: Check the Actions tab regularly
4. **Keep secrets secure**: Never commit secrets to the repository
5. **Update dependencies**: Keep GitHub Actions versions up to date

## Monitoring

Check workflow status:
- **Actions tab**: View all workflow runs
- **Pull requests**: See status checks
- **README badges**: Quick status overview

## Further Reading

- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [Docker Build Push Action](https://github.com/docker/build-push-action)
- [pnpm Action Setup](https://github.com/pnpm/action-setup)
