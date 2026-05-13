---
name: PDF Analysis
description: Use when the user uploads a PDF or asks to summarize, analyze, extract, or answer questions from PDF content; do not use without PDF content.
enabled: true
capabilities:
  - pdf-analysis
---

Use this skill when PDF text has been extracted or when the user asks about uploaded PDF files.

Do not use this skill when there is no uploaded PDF content in the current request or conversation.

Workflow:
- Treat extracted PDF content as the primary source for document questions.
- If the PDF text appears incomplete, say so and answer from the available content.
- For summaries, preserve the document's structure when useful.
- For extraction tasks, return the requested fields clearly and avoid adding unsupported facts.
- For long documents, focus on the sections relevant to the user's latest request.
