# gstack

This environment has [gstack](https://github.com/garrytan/gstack) installed — a suite of Claude Code skills.

- Use the `/browse` skill for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
- Available skills: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/design-consultation`, `/design-shotgun`, `/design-html`, `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/browse`, `/connect-chrome`, `/qa`, `/qa-only`, `/design-review`, `/setup-browser-cookies`, `/setup-deploy`, `/setup-gbrain`, `/retro`, `/investigate`, `/document-release`, `/document-generate`, `/codex`, `/cso`, `/autoplan`, `/plan-devex-review`, `/devex-review`, `/careful`, `/freeze`, `/guard`, `/unfreeze`, `/gstack-upgrade`, `/learn`.

Note: this container's network policy blocks the Chromium build gstack's `/browse` skill downloads (`cdn.playwright.dev`), so browser-driven skills may not work here until that's allowlisted or gstack is run in an environment with network access to it.
