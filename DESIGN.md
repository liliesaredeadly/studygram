---
version: alpha
colors:
  background: "#FAF7F0"
  surface: "#F3ECE0"
  text: "#2C2318"
  secondary: "#6B5D4F"
  primary: "#8B7355"
  success: "#5C7E66"
typography:
  display:
    fontFamily: "Cormorant Garamond, Georgia, serif"
  body:
    fontFamily: "Jost, Georgia, sans-serif"
rounded:
  field: "6px"
  panel: "20px"
omitted:
  - section: spacing
    reason: "Existing page layouts own responsive spacing; use shared CSS tokens where defined."
  - section: components
    reason: "Vanilla HTML components use shared classes rather than generated component tokens."
---

## Overview

Studygram's product screens resemble a personal learning notebook: warm paper, restrained brown rules, serif headings and readable sans-serif controls. Extend the existing style rather than rebrand for an individual feature. Settings prioritizes clear connection state and form behavior.

## Colors

`style.css :root` is the runtime source of truth. The frontmatter records existing `--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--accent`, and `--accent-emerald` values in order. New Settings styles reference those variables directly. Do not change shared colors for a page-specific preference.

## Typography

Use existing Jost body and Cormorant Garamond headings, loaded by `style.css`; retain system fallbacks. Labels and statuses use the body face.

## Layout

Keep a bounded reading width, shared navigation, one main page heading and a single connection workflow. At narrow widths, stack actions and preserve readable help text. Existing Growth and Student Passport pages are sibling references, not new token sources.

## Elevation & Depth

Use the existing warm border and card shadow sparingly. Connection state should be legible in text without relying on color.

## Shapes

Use `--radius-sm` for fields and `--radius-lg` for the Settings panel.

## Components

`js/app.js` owns common navigation and profile access. `style.css` owns base controls and tokens. `js/ai.js` owns AI connection credentials; `js/settings.js` owns the Settings form lifecycle. Secrets are masked initially, never placed into feedback text, and never saved in persistent account data. Forms prevent duplicate submission and expose field errors and live status.

## Do's and Don'ts

- Use real labels, visible keyboard focus and plain action names.
- Explain exactly where a connection lasts and whose Meta usage is charged.
- Preserve offline samples and keep key setup separate from student work.
- Do not add decorative dashboards, provider selectors or model pickers for this single-provider connection.
