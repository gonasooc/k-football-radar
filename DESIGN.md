---
name: Korea Football Radar
description: Readable editorial desk for Korean football governance monitoring
colors:
  ink: "oklch(20% 0.012 70)"
  ink-soft: "oklch(38% 0.012 70)"
  muted: "oklch(55% 0.01 70)"
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
typography:
  display:
    fontFamily: "Pretendard, SUIT, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1.875rem"
    fontWeight: 900
    lineHeight: 1.15
    letterSpacing: "0"
  title:
    fontFamily: "Pretendard, SUIT, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 900
    lineHeight: 1.35
    letterSpacing: "0"
  body:
    fontFamily: "Pretendard, SUIT, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.75
    letterSpacing: "0"
  label:
    fontFamily: "Pretendard, SUIT, Apple SD Gothic Neo, Malgun Gothic, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 900
    lineHeight: 1.2
    letterSpacing: "0.18em"
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

**Creative North Star: "The Editorial Wire Desk"**

The UI should resemble a clean editorial workflow product: white workspace, light gray side navigation, thin table rules, small red brand accents, and content-first hierarchy. The reference is closer to a news desk or publishing CMS than a sports scoreboard.

The system must prioritize readability. Titles, summaries, source names, dates, filters, and original links should be immediately legible on desktop and mobile. Decorative sports motifs, dark hero sections, and large metric showpieces are not part of this direction.

**Key Characteristics:**

- White canvas with subtle gray surfaces.
- Left editor-style navigation on desktop.
- Compact summary cards, tables, and ledger rows.
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
- **Muted** (`oklch(55% 0.01 70)`): captions, helper text, metadata labels.

**The Red Dot Rule.** Red is a small editorial marker, not a background theme. A screen should read as white and black before it reads as red.

## 3. Typography

**Display Font:** Pretendard, SUIT, Apple SD Gothic Neo, Malgun Gothic, sans-serif
**Body Font:** Pretendard, SUIT, Apple SD Gothic Neo, Malgun Gothic, sans-serif
**Label/Mono Font:** same family with tabular numeric styling for counts and dates.

**Character:** Korean readability comes first. Use moderate sizes, strong title weight, generous body line-height, and avoid viewport-scaled type.

### Hierarchy

- **Display** (900, 1.875rem, 1.15): page titles.
- **Headline** (900, 1.25rem, 1.3): section headings.
- **Title** (900, 1.125rem, 1.35): article titles and row names.
- **Body** (500, 0.875rem, 1.75): summaries and descriptions.
- **Label** (900, 0.6875rem, 0.18em uppercase): table headers and section kickers.

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

### Cards / Containers

- **Corner Style:** panels use 6px, controls use 4px, chips use 3px. Avoid large rounded cards.
- **Background:** panel on canvas, paper for sidebars and metadata.
- **Shadow Strategy:** only major panels use soft shadow.
- **Border:** line-colored full borders. Never colored side stripes.
- **Internal Padding:** 16px to 20px; avoid padded marketing-card proportions.

### Inputs / Fields

- **Style:** white panel background, line border, 44px height, label above.
- **Focus:** editorial red focus outline.
- **Error / Disabled:** use accent only for true error states.

### Navigation

- **Desktop:** left sidebar with logo, short product statement, stacked nav links.
- **Mobile:** sidebar content becomes top stacked navigation. Links wrap naturally.
- **Active State:** future active links should use blush background and red icon/text.

### Article Rows

- **Structure:** metadata column, article body, action link.
- **Metadata:** source type, date, publisher, collected time.
- **Body:** title first, summary second, tags third.
- **Action:** original link remains a visible red button.

## 6. Do's and Don'ts

Do:

- Use white space, thin rules, and readable line-height.
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
