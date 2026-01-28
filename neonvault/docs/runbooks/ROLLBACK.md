# Rollback Runbook

1. `wrangler deployments list`
2. `wrangler rollback` to the previous deployment.
3. If a migration introduced breaking schema:
   - Restore by deploying compatible code (D1 doesn’t support “down” migrations cleanly; prefer forward-fix).
