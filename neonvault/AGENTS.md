# NeonVault Agent Rules

## Mission
Maintain a private-only R2-backed vault (vault.neoncovenant.com) with strict access control and auditability.

## Safety
- Default: inspect-only.
- Ask before: deploys, binding changes, secret/env changes, deletes, migrations, Access policy changes, anything cost-increasing.

## Required features
- Access-gated endpoints (defense-in-depth JWT verification)
- Object hashing (sha256) and basic integrity checks
- Audit events for upload/download/delete
- Rollback steps for every deploy
