# Existing Color Scheme & Visual Guidelines

This document details the existing design color palette, CSS variable design tokens, and semantic state mapping rules for the **ExamPlanner** application interface.

---

## 1. Core Color System Tokens

The application defines a centralized CSS custom variable token system in `apps/frontend/src/index.css`.

### Primary Brand & Interactive Tokens (Blue)
| CSS Variable Name | Hex Code | Visual Preview / Description | Primary Application |
| :--- | :--- | :--- | :--- |
| `--accent-primary` | `#2563EB` | **Royal Blue** | Primary buttons, active tabs, main badges, brand accents |
| `--accent-bg` | `#EFF6FF` | **Subtle Blue Tint** | Active item background, selected card state |
| `--accent-border` | `#93C5FD` | **Light Blue Border** | Highlighted card borders, active input focus |
| `--accent-hover` | `#1D4ED8` | **Deep Blue** | Primary button hover state |
| `--accent-darker` | `#1E3A8A` | **Navy Blue** | Gradient end state for CTA banners & hero sections |

---

### Semantic State Palette

#### A. Success & Completed States (Green)
> **Rule**: Green indicates **Completed Activities**, **Correct Question Answers**, **High Accuracy (≥70%)**, and **Synced Sessions**.

| CSS Variable Name | Hex Code | Visual Description | Usage Area |
| :--- | :--- | :--- | :--- |
| `--success-primary` | `#059669` | **Emerald Green** | Success text, completed task indicators |
| `--success-icon` | `#10B981` | **Vibrant Green** | Checkmarks, streak icons, success badges |
| `--success-bg` | `#ECFDF5` | **Mint Tint** | Completed attempt background pill, correct option box |
| `--success-text` | `#047857` | **Dark Emerald** | High-contrast status labels on light mint bg |

#### B. Warning & Partial States (Amber / Yellow)
> **Rule**: Amber indicates **In-Progress Activities**, **Moderate Accuracy (40–69%)**, and **Revision Reminders**.

| CSS Variable Name | Hex Code | Visual Description | Usage Area |
| :--- | :--- | :--- | :--- |
| `--warning-primary` | `#D97706` | **Amber** | Partial accuracy metrics, caution callouts |
| `--warning-bg` | `#FEF3C7` | **Light Amber Tint** | Review required badge background, pending items |
| `--warning-border` | `#FDE68A` | **Soft Amber Border** | In-progress test attempt outlines |
| `--warning-text-dark` | `#92400E` | **Dark Amber** | Warning text headers |

#### C. Danger & Incomplete States (Red)
> **Rule**: Red indicates **Incomplete Tasks**, **Incorrect Answers**, **Low Accuracy (<40%)**, and **Destructive Actions**.

| CSS Variable Name | Hex Code | Visual Description | Usage Area |
| :--- | :--- | :--- | :--- |
| `--danger-primary` | `#DC2626` | **Bright Red** | Incorrect answer tags, error alerts, logout action |
| `--danger-bg` | `#FEF2F2` | **Light Red Tint** | Incorrect answer container, error notice background |
| `--danger-border` | `#FECACA` | **Soft Red Border** | Error box outline, failed validation state |
| `--danger-text-dark` | `#7F1D1D` | **Dark Red** | Error notification message text |

#### D. Specialized Activity Colors
| Category | Hex Code | Soft Background | Usage Area |
| :--- | :--- | :--- | :--- |
| **PYQ / Past Papers** | `#A855F7` (Purple) | `#F3E8FF` | Previous Year Questions tags & badges |
| **Mock Tests** | `#EAB308` (Gold) | `#FEF9C3` | Mock Exam highlight badges & trophies |
| **Revision** | `#22C55E` (Light Green) | `#DCFCE7` | Spaced repetition revision tasks |
| **Streak / Fire** | `#F97316` (Orange) | `#FFEDD5` | Daily streak counter and level achievements |

---

### Surface & Typography Neutrals

| CSS Variable Name | Hex Code | Role |
| :--- | :--- | :--- |
| `--bg-page` | `#F4F6F9` | Default layout background behind dashboard cards |
| `--bg-card` | `#FFFFFF` | Standard white surface background for dashboard cards & modals |
| `--bg-subtle` | `#F1F5F9` | Subtle background for list item rows and nested panels |
| `--text-primary` | `#0F172A` | Primary headings, body copy, and main data numbers |
| `--text-secondary` | `#334155` | Secondary captions, subtitle labels |
| `--text-muted` | `#64748B` | Helper text, timestamp metadata, placeholder text |
| `--border-default` | `#E2E8F0` | Card borders, table dividers, header lines |

---

## 2. Standardized Color Mapping Matrix Across Dashboard Pages

| Dashboard Section / Component | State | Assigned Color Scheme |
| :--- | :--- | :--- |
| **Question Accuracy** | High Accuracy (≥ 70%) | Green (`#059669` / `#ECFDF5`) |
| | Moderate Accuracy (40–69%) | Amber (`#D97706` / `#FEF3C7`) |
| | Low Accuracy (< 40%) | Red (`#DC2626` / `#FEF2F2`) |
| **Exam Session Badges** | Completed / Registered Attempt | Green (`#10B981` / `#ECFDF5`) |
| | Guest Synced Session | Blue (`#2563EB` / `#EFF6FF`) |
| | Pending / Incomplete Test | Red (`#DC2626` / `#FEF2F2`) |
| **Today's Study Log** | Mock Test | Gold (`#EAB308`) |
| | PYQ Session | Purple (`#A855F7`) |
| | Revision Completed | Green (`#22C55E`) |
| **Navigation Headers & User Avatar** | Active Tab / Logged In | Blue (`#2563EB` gradient circle) |

---
