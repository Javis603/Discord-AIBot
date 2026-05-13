---
name: Web Search
description: Use when the user asks for current, recent, external, source-backed, or verifiable facts; do not use for stable knowledge or casual chat.
enabled: true
capabilities:
  - web-search
---

Use this skill when the user asks for information that may have changed, asks for sources, or asks to verify a factual claim.

Do not use this skill for stable knowledge, roleplay, translation, rewriting, coding help that does not need current documentation, or casual conversation.

Workflow:
- Prefer a focused query that captures the user's actual intent.
- Use search results as context, not as the final answer by themselves.
- If the user asks for "latest", "today", prices, releases, policy, schedules, or availability, treat freshness as important.
- Mention uncertainty when sources are weak or conflicting.
- Keep the final Discord response concise and useful.
- Do not fabricate citations, dates, prices, product details, or source claims.

When search results are injected into the conversation, ground the answer in those results and avoid treating older conversation memory as more authoritative than fresh search context.
