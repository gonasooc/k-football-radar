---
name: Korea Football Radar
description: Readable editorial desk for Korean football governance monitoring
colors:
  ink: "oklch(20% 0.012 70)"
  ink-soft: "oklch(38% 0.012 70)"
  summary: "oklch(48% 0.01 70)"
  muted: "oklch(50% 0.01 70)"
  canvas: "oklch(99% 0.003 80)"
  paper: "oklch(97% 0.004 80)"
  panel: "oklch(99.2% 0.002 80)"
  panel-strong: "oklch(95.5% 0.005 80)"
  line: "oklch(89% 0.006 80)"
  rule: "oklch(83% 0.008 80)"
  accent: "oklch(52% 0.175 28)"
  blush: "oklch(97% 0.018 28)"
  accent-soft: "oklch(88% 0.052 28)"
  official: "oklch(47% 0.105 155)"
  news: "oklch(45% 0.09 240)"
  warning: "oklch(62% 0.12 78)"
  shadow: "oklch(20% 0.012 70)"
colorsDark:
  ink: "oklch(92% 0.008 85)"
  ink-soft: "oklch(75% 0.01 82)"
  summary: "oklch(66% 0.01 82)"
  muted: "oklch(63% 0.012 82)"
  canvas: "oklch(18% 0.006 75)"
  paper: "oklch(21% 0.006 75)"
  panel: "oklch(19.5% 0.006 75)"
  panel-strong: "oklch(25% 0.008 75)"
  line: "oklch(30% 0.008 75)"
  rule: "oklch(40% 0.01 78)"
  accent: "oklch(64% 0.17 28)"
  blush: "oklch(27% 0.04 28)"
  accent-soft: "oklch(43% 0.1 28)"
  official: "oklch(66% 0.11 158)"
  news: "oklch(67% 0.1 240)"
  warning: "oklch(73% 0.12 82)"
  shadow: "oklch(0% 0 0)"
typography:
  display:
    fontFamily: "Pretendard, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "0"
  headline:
    fontFamily: "Pretendard, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 900
    lineHeight: 1.25
    letterSpacing: "0"
  title:
    fontFamily: "Pretendard, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Pretendard, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.75
    letterSpacing: "0"
  label:
    fontFamily: "Pretendard, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.14em"
rounded:
  chip: "3px"
  control: "4px"
  panel: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
    height: "44px"
  button-secondary:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.control}"
    padding: "10px 12px"
    height: "44px"
  panel:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "16px"
  filter-input:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "44px"
---

# Design System: Korea Football Radar

## 1. Overview

**Creative North Star: "The Football Front Page"**

The UI should resemble a clean digital newspaper front page: centered masthead, thin section rules, strong Pretendard headlines, varied story scale, compact briefs, and content-first hierarchy. The reference is closer to a newspaper homepage than a sports scoreboard or SaaS dashboard.

The system must prioritize readability. Titles, summaries, source names, dates, filters, and original links should be immediately legible on desktop and mobile. Decorative sports motifs, dark hero sections, and large metric showpieces are not part of this direction.

**Key Characteristics:**

- White canvas with subtle gray surfaces in the default light theme, and a full dark theme built from the same token names.
- Centered masthead and horizontal section navigation.
- Pretendard typography across headlines, metadata, and controls.
- Compact featured briefs followed by quieter row entries on the same page.
- Red accent used sparingly for brand, actions, and emphasis.
- Neutral, source-first news language.

## 2. Colors

The palette is quiet and editorial: warm white, gray rules, black-brown ink, and a small red accent.

### Primary

- **Editorial Red** (`oklch(52% 0.175 28)`): logo, primary actions, active segmented controls, small emphasis labels.
- **Ink** (`oklch(20% 0.012 70)`): article titles and primary text.
- **Canvas White** (`oklch(99% 0.003 80)`): page background.

### Secondary

- **Official Green** (`oklch(47% 0.105 155)`): official source badge only.
- **News Blue** (`oklch(45% 0.09 240)`): available for news categorization, used lightly.
- **Warm Warning** (`oklch(62% 0.12 78)`): ranking or attention counts when a second accent is needed.

### Neutral

- **Paper** (`oklch(97% 0.004 80)`): sidebar and table header backgrounds.
- **Panel** (`oklch(99.2% 0.002 80)`): cards, forms, article rows.
- **Panel Strong** (`oklch(95.5% 0.005 80)`): metadata cells and subtle row sections.
- **Line** (`oklch(89% 0.006 80)`): default borders.
- **Rule** (`oklch(83% 0.008 80)`): stronger table dividers.
- **Summary** (`oklch(48% 0.01 70)`): article and video summary text, one step darker than Muted.
- **Muted** (`oklch(50% 0.01 70)`): captions, helper text, metadata labels.

**The Red Dot Rule.** Red is a small editorial marker, not a background theme. A screen should read as white and black before it reads as red.

### Dark Theme

Both palettes live in [app/globals.css](app/globals.css) as CSS custom properties holding a bare `L C H` triplet. Light is the default on `:root`; `:root[data-theme="dark"]` replaces every value under the same token names, and [tailwind.config.ts](tailwind.config.ts) exposes them as `oklch(var(--token) / <alpha-value>)`. Components never branch on theme: they use the token, and the theme decides the value. Use `dark:` variants only where a value cannot be a token, as with the header logo's `dark:invert dark:hue-rotate-180`.

The dark theme is a dim warm gray desk, not pure black. It keeps the newspaper reading order by inverting lightness while holding hue and chroma close to the light values.

- **Canvas** (`oklch(18% 0.006 75)`) and **Paper** (`oklch(21% 0.006 75)`): page and sidebar surfaces. Panels sit at `19.5%` and panel-strong at `25%`, so surfaces separate by small lightness steps instead of borders alone.
- **Ink** (`oklch(92% 0.008 85)`), **Ink Soft** (`75%`), **Summary** (`66%`), **Muted** (`63%`): the text ramp stays in the same order as light, with each role at least one step apart.
- **Line** (`30%`) and **Rule** (`40%`): rules must stay visible against the dim canvas, so both are lighter relative to their surface than the light theme's are.
- **Editorial Red** (`oklch(64% 0.17 28)`): the accent brightens from `52%` so it keeps its role as an emphasis marker on a dark surface. **Blush** (`27%`) and **Accent Soft** (`43%`) invert with it.
- **Official Green** (`66%`), **News Blue** (`67%`), **Warm Warning** (`73%`): source and status colors brighten together so the badge set stays readable and mutually distinct.
- **Shadow** (`oklch(0% 0 0)`): shadows tint from pure black in dark, where the light theme tints from ink.

**Rules for the dark theme.**

- Add every new color as a token in both blocks. A color defined only in light silently breaks the dark screen.
- Keep the Red Dot Rule. Dark surfaces make red read louder, so accent stays an emphasis marker and never becomes a surface.
- The theme applies before first paint via the inline script in [app/layout.tsx](app/layout.tsx), which reads the stored choice and falls back to `prefers-color-scheme`. Keep that script, the `<meta name="theme-color">` values and [components/ThemeToggle.tsx](components/ThemeToggle.tsx) in sync when the canvas changes.
- Theme switching cross-fades through `.theme-transition`, and `.motion-soft` transitions apply only under `prefers-reduced-motion: no-preference`. New motion follows the same guard.
- WCAG AA contrast is the target in both themes. Check summary and muted text against Panel and Paper, not only against Canvas.

## 3. Typography

**Display Font:** Pretendard, sans-serif
**Headline Font:** Pretendard, sans-serif
**Body Font:** Pretendard, sans-serif
**Label/Mono Font:** same family with tabular numeric styling for counts and dates.

**Character:** Korean readability comes first. Use Pretendard for every live text role: headings, summaries, metadata, filters, controls, and numbers.

### Hierarchy

As implemented, the scale is narrower than the token list above and steps up at `sm`:

- **Page Title** (900, 1.5rem → 1.875rem at `sm`, -0.02em): page `h1` and home section headings ([components/SectionHeader.tsx](components/SectionHeader.tsx), [components/HomeFeedSection.tsx](components/HomeFeedSection.tsx)).
- **Story Title** (900, 1.25rem → 1.375rem at `sm`, -0.018em): article and video headlines, clamped to two lines from `sm` up ([components/ItemCard.tsx](components/ItemCard.tsx), [components/YouTubeCard.tsx](components/YouTubeCard.tsx)).
- **Body** (500, 0.875rem): summaries, descriptions and most controls.
- **Meta** (0.75rem): metadata rows, chips and helper text.
- **Label** (900, 0.6875rem, 0.14em): table headers and section kickers.

The masthead is the logo image, not text, so the `display` (3rem) and lead-headline (2.25rem) sizes are not used by any screen today. Keep them out of new work unless a text masthead or lead story is actually introduced.

**The Reading Column Rule.** Summary text should stay below 75 characters per line where possible. Tables may be wider, but prose should not sprawl.

## 4. Elevation

Elevation is minimal. The interface relies on rules, spacing, and tonal contrast. Shadows appear only on major dashboard panels or hover states where they clarify interactivity.

### Shadow Vocabulary

- **Panel** (`0 18px 48px oklch(20% 0.012 70 / 0.055)`): major dashboard and filter panels.
- **Lift** (`0 12px 28px oklch(20% 0.012 70 / 0.075)`): article row hover only.

**The Rule-First Principle.** If a surface can be separated by a 1px rule, use the rule before using shadow.

## 5. Components

### Buttons

- **Shape:** small editorial radius, compact height, no pill styling.
- **Primary:** editorial red background with canvas text, minimum 44px touch height.
- **Hover / Focus:** hover shifts to ink; focus uses red outline.
- **Secondary:** white or paper background with gray border and ink-soft text.

### Chips

- **Style:** small bordered labels with neutral text and very light background.
- **State:** official source may use green text; news/source labels otherwise stay quiet.

### Article Blocks

- **Featured:** the home sections show three compact briefs in a ruled three-column grid at `lg`, followed by three quieter entries in the same grid. Below `lg` both rows stack into one readable column ([components/HomeFeedSection.tsx](components/HomeFeedSection.tsx)).
- **Row:** source-first metadata, article body, limited tags, and a visible original link.
- **Corner Style:** article blocks generally use no visible rounding. Controls use 4px and chips use 3px.
- **Border:** thin horizontal and vertical rules. Never colored side stripes.
- **Shadow Strategy:** avoid shadows on article lists. Let type scale, rules, and columns create hierarchy.
- **Diagnostic Rule:** collection keywords, scores, and timestamps do not repeat in the default reading flow.

### Inputs / Fields

- **Style:** white panel background, line border, 44px height, label above.
- **Focus:** editorial red focus outline.
- **Error / Disabled:** use accent only for true error states.

### Navigation

- **Desktop:** centered masthead, small utility row, horizontal section navigation.
- **Mobile:** masthead scales down and the five primary destinations stay in a fixed bottom navigation.
- **Active State:** active section uses an accent underline and darker text.

### Article Rows

- **Structure:** `row` and `compact` variants. Feeds and timelines use `row`; the home grid uses `compact`, which also tightens the tag limit from six to four. There is no separate lead variant.
- **Metadata:** source type, date, publisher, collected time.
- **Body:** title first, summary second, tags third.
- **Action:** every headline is the original link and carries a small external-link glyph; avoid a duplicate CTA in the same item.

### Video Rows

- **Structure:** preserve the article metadata, headline, summary, and tag rhythm, adding a 16:9 thumbnail before the text.
- **Metadata:** show the YouTube source badge, channel, publication date, and duration without inventing a separate visual language.
- **Shorts:** treat Shorts like any other video; duration is informative, not a filter.
- **Live media:** live, upcoming and completed-live videos are collected and shown like any other video. Status and duration are informative, not filters.

## 6. Do's and Don'ts

Do:

- Use white space, thin rules, and readable line-height.
- Use masthead, section nav, compact briefs, and rows to create a newspaper rhythm.
- Keep article summaries easy to scan.
- Make original links obvious.
- Keep filters in predictable form controls.
- Use red sparingly for editorial emphasis.

Don't:

- Use dark hero panels, sports scoreboard styling, pitch grids, or neon accents.
- Use decorative gradients, gradient text, glassmorphism, or colored side stripes.
- Overload pages with repeated floating cards.
- Hide metadata behind icons alone.
- Shrink Korean body text below readable sizes.
