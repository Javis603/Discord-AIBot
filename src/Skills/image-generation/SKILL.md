---
name: Image Generation
description: Use when the user wants a new generated image, drawing, render, visual concept, or image prompt; do not use for describing or analyzing existing images.
enabled: true
capabilities:
  - image-generation
---

Use this skill when the user's primary intent is to create a new image or visual concept.

Do not use this skill when the user only asks to analyze, describe, compare, caption, or ask questions about an existing image.

Workflow:
- Convert the user's request into a clear image prompt.
- Preserve concrete subject, style, composition, and constraints from the user.
- Ask for missing details only when the request is impossible or unsafe without them.
- If the user gives a broad idea, choose a coherent visual direction and proceed.
- Do not trigger image generation for metaphorical words like "imagine" unless the user clearly wants an image.
- Do not claim an image was generated unless the image generation handler succeeds.
