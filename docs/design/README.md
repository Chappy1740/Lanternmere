# Lanternmere design specification

## Status and purpose

This is the permanent written companion to the approved Lanternmere visual references. It guides future visual-alignment work; it does not authorize a redesign or change to product behavior.

The reference images are in [`references/`](references/). Supplied raster candidates are preserved in [`public/brand/`](../../public/brand/) for review. Visual verification found that some supplied filenames do not match their rendered content. The verified master crest and the purpose-made Lodge scene listed below are approved for the current product’s runtime use; other candidates remain source material pending content and licensing confirmation.

## Visual language

- **Mood:** a warm, cinematic Lodge at night: lantern light, deep woods, lake and mountain atmosphere, and quiet fantasy detail.
- **Composition:** dark Lodge-themed navigation, an atmospheric header, clear hierarchy, and restrained decoration.
- **Surfaces:** very dark panels with subtle bronze/gold borders and depth. Avoid generic white-card dashboards, excessive glow, or dense ornament.
- **Typography:** the original art direction names Trajan Pro for display use and Cinzel for supporting type. Trajan Pro is not bundled or licensed by this repository. Use the existing licensed web-font path (currently Cinzel with Inter) unless a distribution license is supplied.
- **Responsive intent:** desktop uses the structured Lodge shell; phone layouts preserve hierarchy and touch usability, and may use a simpler visual welcome/home composition with bottom navigation. Never retain a fixed mockup proportion at the cost of reflow, contrast, or accessibility.

## Approved palette

| Role | Hex |
| --- | --- |
| Lantern Gold | `#F2B13D` |
| Warm Amber | `#E08A2E` |
| Hearth Brown | `#7A4A28` |
| Deep Wood | `#2E1E14` |
| Night Navy | `#0F1B2D` |
| Lake Teal | `#1E3D45` |
| Moss Green | `#3A4A2E` |
| Stone | `#A49A8C` |

Treat these as visual-direction references. The implemented token system remains the source of truth until an approved visual-alignment task updates it.

## Asset catalog

| Asset | Location | Intended use |
| --- | --- | --- |
| Verified master crest | `public/brand/lanternmere-master-crest.png` | Product brand mark in the public welcome screen and Lodge navigation |
| Lodge scene | `public/brand/lanternmere-lodge-hero-v1.png` | Purpose-made, text-free atmospheric background for the public welcome screen and Hearth header |
| Illustrated character fallbacks | `public/brand/lanternmere-*-portrait-v1.webp` | Purpose-made portraits used only when a compatible Blizzard portrait is unavailable |
| Other supplied mark candidates | `public/brand/` | Preserved source candidates; verify image content and licensing before runtime use |
| Brand board, palette, navigation, story panel | `references/` | Design direction, not runtime UI dependencies |
| Original brand board | `references/original-brand-board.png` | Historical source reference |

Do not silently substitute other concept images into product screens. An approved design-alignment task should choose verified production assets and confirm their content, responsive behavior, contrast, and licensing.

## Character portrait selection

Blizzard remains the source of truth for a character’s identity. Lanternmere imports the profile’s race and gender/presentation fields with the character data; it does not infer either from class or ask a player to enter them again. If a race portrait library is added in a future approved visual pass, it should use the normalized `race + gender` pair as its first fallback key (for example, `dwarf + male`). The current class library uses Blizzard gender where an explicit male/female variant exists; it is the intentional fallback when no compatible Blizzard portrait is available. Expanding this library is explicitly out of scope for the current pass.

Existing imported snapshots retain the fields available at the time they were saved. Re-importing the same character refreshes the snapshot and adds newer supported profile fields while preserving the character’s Main and Lodge-sharing settings.
