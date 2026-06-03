---
name: Playwright smoke tests vs live DB
description: Why e2e smoke tests go stale here and how to keep them robust
---

The dev servers (`frontend` :5000, `backend` :3001) run against the **live DigitalOcean DB**, so e2e smoke tests see real, changing production data — not a seed/fixture DB.

**Rule:** smoke assertions must target stable UI structure and permanent fixtures (e.g. the `System Admin` account), never volatile production values (specific person names, exact rand amounts) or a previous UI shape.

**Why:** tests broke without the app being broken — some hard-coded an ambassador name + exact earnings that were later removed from the DB (the ambassador/agent table holds only the `System Admin` fixture; the 85K records are clients, not agents), others asserted an old layout after a FoxPro-operations UI redesign.

**Caveat:** pages with hard-coded fallback content (e.g. Premium Changes worksheet rows) can render even if their backend fetch fails, so a render-only smoke check there does NOT prove the API works — needs route interception to verify data flow.

**How to apply:** anchor waits on static headings/fixtures, then assert structure; if real data legitimately appears missing, raise it with the user rather than silently relaxing the test.
