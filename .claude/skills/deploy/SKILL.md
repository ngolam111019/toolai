---
name: deploy
description: Skill to automate the full deployment process for Heroku including pre-checks, migrations, release, and verification
---

# Deploy Skill (Heroku)

## Purpose
Automate the deployment pipeline for Heroku: check branch → run tests → push to Heroku → migrate database → health check.

## Prerequisites
- All unit tests passing
- Heroku CLI installed and logged in (`heroku login`)
- Remote git `heroku` configured (`heroku git:remote -a <app-name>`)
- Environment variables configured on Heroku

## Steps

### 1. Verify Clean Git State & Branch
Ensure you are on the release branch or `main` and have no uncommitted changes.
```bash
git status
git pull origin main
```

### 2. Run Test Suite
```bash
npm test
```
If tests fail → **STOP**. Fix failures before deploying.

### 3. Deploy to Heroku
Push your local main/release branch to Heroku's main branch:
```bash
git push heroku main
```
*(If pushing from develop or another local branch, use: `git push heroku branch-name:main`)*

### 4. Database Migrations (Prisma/SQL)
If database schema has changed:
```bash
heroku run npx prisma db push
```

### 5. Health Check Verification
Ping the app root or health check endpoint:
```bash
curl -f https://<your-app-name>.herokuapp.com/ || echo "Health check failed"
```

### 6. Tail Production Logs
Monitor live logs for at least 30 seconds to catch runtime exceptions:
```bash
heroku logs --tail
```

## Rollback
If deployment fails or logs show critical errors, rollback immediately to the previous release:
```bash
heroku rollback
```

## Success Criteria
- HTTP health status returns 200
- Live logs don't show any crash/exception traces
- All core functionalities (login, checkout, socket connection) working
