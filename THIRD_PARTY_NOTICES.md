# Third-party notices

## Redakt

The Oathkeeper Email mini-app visual treatment and interaction patterns are adapted from the public Redakt repository:

- Source: https://trylle.com/stylessh/redakt
- Reference commit: `ac766cd7ea6c9fe2cfb490015a4770f7d045b8e3`
- License: MIT

No Redakt mail transport, Gmail, JMAP, IMAP, Stalwart, authentication, database, deployment, or provider code is included.

```text
MIT License

Copyright (c) 2026 Alan Daniel and Redakt contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## TuffUI

`features/oathkeeper/components/dual-sidebar/mcp-servers-panel.tsx` is rebuilt from the TuffUI `mcp-servers` component (https://tuffui.com).

MIT License. Copyright (c) 2026 TUFFUI contributors.

## Phosphor Icons

The same file inlines icons from `@phosphor-icons/core` 2.1.1 (https://phosphoricons.com), unchanged.

MIT License. Copyright (c) 2023 Phosphor Icons.

Both are licensed under the MIT License; permission is granted, free of charge, to use, copy, modify, merge, publish, distribute, sublicense and sell copies, provided the copyright notice and this permission notice are included in all copies. The software is provided "as is", without warranty of any kind.

## T3 Code and TuffUI (Canvas)

The Canvas mini app and MCP (`lib/oathkeeper-canvas/`) follow the design of T3 Code's `html_preview` / `html_render` tools (https://github.com/pingdotgg/t3code, MIT, Copyright (c) 2025 T3 Tools Inc.): a preview-then-publish flow with a reusable preview id, a theme bootstrap injected before paint that is re-themed by a JSON-RPC `host-context-changed` message, a `size-changed` message from the page, heights measured at several widths, and the layout rules written into the tool descriptions. The bootstrap script is a rewrite for Oathkeeper's tokens and drops T3's link, image and shortcut forwarding.

The catalog renderers (`lib/oathkeeper-canvas/catalog.ts`) follow the layouts of TuffUI (https://tuffui.com, MIT, Copyright (c) 2026 TUFFUI contributors): stat-grid, chart-card, data-table, radar-chart, dot-histogram, tick-gauge, result-carousel, slot-picker and form-card, re-implemented as dependency-free HTML and SVG.

## TuffUI, Phosphor Icons and glimm (CRM v2)

`features/oathkeeper/components/crm-v2/` (the view and its CSS module) is rebuilt from TuffUI (https://tuffui.com, MIT, Copyright (c) 2026 TUFFUI contributors): theme tokens, surface (Shell, Panel, IconTile, ShellHeader), conversation-list, text-field (SearchField), form-card (summary list), empty-state, action-button, loader (Spinner), loading-skeleton and tab-panels (the section tabs, pills variant), translated to plain CSS.

`crm-v2-icons.tsx` inlines icons from `@phosphor-icons/core` 2.1.1 (https://phosphoricons.com), unchanged. MIT License. Copyright (c) 2023 Phosphor Icons.

`crm-v2-glow.tsx` drives the `glimm` package (https://glimm.dev, MIT, Copyright (c) Noman Ijaz) through its framework-agnostic core (`createShader`) on one canvas sized to the enrichment card.

All three are licensed under the MIT License; the permission notice above applies.

## voice-glow (dictation)

`features/oathkeeper/vendor/voice-glow/` is voice-glow 0.5.0 (https://libraries.dev/voice, npm `voice-glow`, MIT, Copyright (c) 2026 Jakub Antalik), its built ESM bundle and types unchanged, with its LICENSE. `features/oathkeeper/components/dictation-glow.tsx` renders its `VoiceBeam` with the dither look along the composer's bottom edge while the mic listens. It replaces the glimm band that used to glow there; glimm itself remains in use for the CRM v2 enrich glow above.

## TuffUI (Curator)

`features/oathkeeper/components/curator-view.module.css` (the empty state, loading skeleton, dialog buttons and phone sheet) follows TuffUI (https://tuffui.com, MIT, Copyright (c) 2026 TUFFUI contributors): empty-state, loading-skeleton, action-button and modal-sheet, translated to plain CSS.
