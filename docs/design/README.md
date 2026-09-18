# Lanternmere design specification

## Status and purpose

This is the permanent written companion to the approved Lanternmere visual references. It guides future visual-alignment work; it does not authorize a redesign or change to product behavior.

The reference images are in [\`references/\`](references/). Production raster brand assets are in [\`public/brand/\`](../../public/brand/). The provided artwork is approved concept artwork; preserve it as the current direction, but replace it with cleared vector deliverables before commercial publication.

## Visual language

- **Mood:** a warm, cinematic Lodge at night: lantern light, deep woods, lake and mountain atmosphere, and quiet fantasy detail.
- **Composition:** dark Lodge-themed navigation, an atmospheric header, clear hierarchy, and restrained decoration.
- **Surfaces:** very dark panels with subtle bronze/gold borders and depth. Avoid generic white-card dashboards, excessive glow, or dense ornament.
- **Typography:** the original art direction names Trajan Pro for display use and Cinzel for supporting type. Trajan Pro is not bundled or licensed by this repository. Use the existing licensed web-font path (currently Cinzel with Inter) unless a distribution license is supplied.
- **Responsive intent:** desktop uses the structured Lodge shell; phone layouts preserve hierarchy and touch usability, and may use a simpler visual welcome/home composition with bottom navigation. Never retain a fixed mockup proportion at the cost of reflow, contrast, or accessibility.

## Approved palette

| Role | Hex |
| --- | --- |
| Lantern Gold | \`#F2B13D\` |
| Warm Amber | \`#E08A2E\` |
| Hearth Brown | \`#7A4A28\` |
| Deep Wood | \`#2E1E14\` |
| Night Navy | \`#0F1B2D\` |
| Lake Teal | \`#1E3D45\` |
| Moss Green | \`#3A4A2E\` |
| Stone | \`#A49A8C\` |

Treat these as visual-direction references. The implemented token system remains the source of truth until an approved visual-alignment task updates it.

## Asset catalog

| Asset | Location | Intended use |
| --- | --- | --- |
| Wordmark | \`public/brand/lanternmere-wordmark.png\` | Product brand mark |
| Primary crest | \`public/brand/lanternmere-crest.png\` | Product brand mark |
| Guild seal | \`public/brand/lanternmere-guild-seal.png\` | Product brand mark |
| Crest variants | \`public/brand/crest/\` | Practical production variants |
| Brand board, palette, navigation, story panel | \`references/\` | Design direction, not runtime UI dependencies |
| Original brand board | \`references/original-brand-board.png\` | Historical source reference |

Do not silently substitute these concept images into product screens. An approved design-alignment task should choose which production assets to wire into the app and verify responsive behavior, contrast, and licensing.
