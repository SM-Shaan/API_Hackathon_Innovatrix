# CI/CD Troubleshooting Guide

## Known Issues and Solutions

### Issue 1: npm Cache Error in CI Pipeline

**Error Message:**
```
Error: Some specified paths were not resolved, unable to cache dependencies.
```

**Cause:**
The `cache-dependency-path` in GitHub Actions is pointing to missing `package-lock.json` files.

**Solutions:**

#### Option A: Use package.json for cache key (Recommended)
Replace `cache-dependency-path` from `package-lock.json` to `package.json`:

```yaml
- uses: actions/setup-node@v4
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: services/user-service/package.json
```

#### Option B: Add lockfiles to repository
Commit `package-lock.json` files to each service directory:
```bash
cd services/user-service && npm install
cd services/campaign-service && npm install
# ... repeat for all services
git add services/*/package-lock.json
git commit -m "Add package-lock.json files"
```

#### Option C: Conditional caching
Add a check before the setup-node step:

```yaml
- name: Check for package-lock.json
  id: check-lock
  run: |
    if [ -f services/user-service/package-lock.json ]; then
      echo "has_lock=true" >> $GITHUB_OUTPUT
    else
      echo "has_lock=false" >> $GITHUB_OUTPUT
    fi

- uses: actions/setup-node@v4
  if: steps.check-lock.outputs.has_lock == 'true'
  with:
    node-version: '20'
    cache: 'npm'
    cache-dependency-path: services/user-service/package-lock.json
```

---

### Affected Jobs

| Job Name | Service |
|----------|---------|
| test-user-service | services/user-service |
| test-campaign-service | services/campaign-service |
| test-pledge-service | services/pledge-service |
| test-payment-service | services/payment-service |
| test-totals-service | services/totals-service |
| test-notification-service | services/notification-service |

---

### Reference

Workflow file: `.github/workflows/ci.yml`

---

*Last updated: Based on CI run with package.json cache fix*
