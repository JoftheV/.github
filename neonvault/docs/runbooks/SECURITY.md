# Security Runbook

- Never log JWT, secrets, raw IP.
- Require Access for all `/v1/*`.
- Keep `ACCESS_AUD` pinned to the Access application.
- Optional: require device posture rules in Access for admin usage.
