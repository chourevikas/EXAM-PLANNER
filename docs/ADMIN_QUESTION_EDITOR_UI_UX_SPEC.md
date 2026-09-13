# UI/UX Specification: Admin Question Editor & Review Studio (V2.0)
**ExamPlanner Platform • Admin Suite Design System**  
*Document Version: 2.0 • Status: Ready for Figma Design & Prototyping*

---

## 1. Executive Summary & Design Vision

### 1.1 The Challenge
In the current ExamPlanner admin interface, editing a question takes place inside a **single tall vertical modal** (`QuestionReviewView.tsx` / `QuestionBankManager.tsx`). 

While feature-rich, this modal suffers from severe UX limitations:
- **Reviewer Fatigue**: An exam contains 100 deep UPSC/State PSC questions. Scrolling through a 3,000px-tall modal for each question, closing it, finding the next row in a table, and reopening another modal creates extreme cognitive and physical friction.
- **Blind Editing (No Source Reference)**: Editors cannot see the original scanned PDF page or OCR extraction snippet side-by-side while correcting typos or equations.
- **No Live Student Preview**: Editors cannot verify how their LaTeX formulas, tables, options, or cognitive reverse-logic cards will render to students taking the test.
- **Crammed Information Architecture**: Critical cognitive fields—such as **Why Tempting (Trap)** vs. **What's Actually True (Reality)**—are buried inside nested dropdown accordions.

### 1.2 The Design Mission
Transform the Question Editor into a **world-class "Editorial Studio Workbench"** (inspired by Linear, Notion, and Bloomberg-grade publishing software).

The new interface must deliver:
1. **Zero-Friction Navigation**: Continuous review workflow where admins can cycle through Question 1 to 100 without leaving the screen.
2. **Side-by-Side Dual Pane**: Simultaneous visibility of **Editor Inputs**, **Original PDF Source**, and **Live Student Preview**.
3. **Cognitive Clarity for Reverse Logic**: Highlight ExamPlanner's core differentiator: rich psychological trap analysis ("Why Tempting" vs "What is True") with dedicated visual cards.
4. **Instant Keyboard Productivity**: Fast keyboard shortcuts for power-user reviewers (`Cmd+S`, `Cmd+Enter`, `J/K` navigation).

---

## 2. User Personas & Real-World Workflows

| Persona | Primary Goal | Critical Pain Point Today | UX Need in Redesign |
| :--- | :--- | :--- | :--- |
| **Lead Subject Expert (SME)** | Verify scientific/historical accuracy of questions and write deep solutions. | Has to open multiple accordions to edit Option Traps and Explanations. | Unified editor with auto-expanding distractor cards and live preview. |
| **OCR & Content QA Reviewer** | Fix formatting glitches, broken math formulas, and OCR typos from paper ingestion. | Cannot see the original paper PDF snippet while typing into textareas. | Split-screen source PDF viewer with zoom and copy-paste. |
| **Curriculum Architect** | Tag questions into Subject → Topic → Microtheme and assign difficulty weights. | Taxonomy fields are located at the very bottom of a long scroll. | Quick-tag sidebar or floating inspector panel. |

---

## 3. Recommended Architectural Layout Paradigms (For Figma)

We propose **three Figma layout explorations**, with **Option A (Studio Workbench)** as the strongly recommended primary design:

```
+---------------------------------------------------------------------------------------------------------+
| [Top Bar: Exam Title • Q42 / 100 • Status: Review • [Prev (K)] [Next (J)] • [Save Draft] [Approve (⌘↵)] |
+-----------------------+---------------------------------------------+-----------------------------------+
| 1. QUESTION NAVIGATOR | 2. MAIN EDITING CANVAS                      | 3. CONTEXT & PREVIEW INSPECTOR    |
| (Left Sidebar, 220px) | (Center Workspace, Flex: 1)                 | (Right Panel, 420px - Tabbed)     |
|                       |                                             |                                   |
| [Filter: All/Needs Q] | A. Question Stem & Context Passage          | [Live Preview] [PDF Source] [Tax] |
| Q1  ✓ Done            |    (Rich-text / Markdown / Math tools)      |                                   |
| Q2  ✓ Done            |                                             | [Live Student View Mode]          |
| Q3  ⚠ Needs Review    | B. Option Matrix & Reverse Logic            | Shows exact student UI card:      |
| Q4  • Active (Editing)|    (A, B, C, D with Split Trap/Reality)     | - Question statement              |
| Q5  ○ Pending         |                                             | - Interactive radio choices       |
| ...                   | C. Step-by-Step Comprehensive Solution      | - Reveal Explanation toggle       |
| Q100 ○ Pending        |                                             | - Distractor breakdown pills      |
|                       | D. Points to Remember & Common Traps Chips  |                                   |
+-----------------------+---------------------------------------------+-----------------------------------+
```

### Layout Option A: 3-Column "Editorial Studio" (Recommended)
- **Left Column (Navigator, 220px)**: Compact vertical list of Q1 to Q100 with quick status dots (Green = Published, Yellow = Needs Review, Red = Rejected, Gray = Pending). Includes search and filter (`Incomplete Traps`, `Missing Keys`).
- **Center Column (Focus Canvas, ~60–65% width)**: The main scrollable editing area with spacious typography, auto-resizing text fields, and distinct visual blocks for stem, options, and solution.
- **Right Column (Inspector / Reference Panel, 380–440px)**: A multi-mode side pane with 3 tabs:
  - **Tab 1: Live Student Preview** (Renders markdown, LaTeX, and candidate response layout in real-time).
  - **Tab 2: Source Paper PDF** (Embedded PDF viewport focused on this question's cropped bounding box).
  - **Tab 3: Taxonomy & Metadata** (Subject, Topic, Nano-theme, Marks, Difficulty, and Multi-concept weights).

### Layout Option B: 2-Column Split Screen with Slide-Out Drawer (Alternative)
- Left 50%: Original Question Paper PDF with zoom/pan controls.
- Right 50%: The Question Editor Canvas with sticky header action bar.

### Layout Option C: Floating Zen Modal with Live Flip-Card (Mobile/Tablet Friendly)
- Clean, focused overlay with tabs: `[Edit Question]` ↔ `[Student Preview]`.

---

## 4. Complete Field Schema & UI Component Breakdown

### Component 1: Sticky Top Navigation & Review Header
- **Breadcrumb**: `Admin / UPSC CSE Prelims 2024 / Question #42`
- **Question Selector**: Quick dropdown or jump input: `Go to Q: [ 42 ] / 100`
- **Status Pill**: 
  - `PUBLISHED` (Emerald Green)
  - `PENDING_HUMAN_REVIEW` (Amber)
  - `REJECTED` (Crimson Red)
  - `DRAFT` (Slate Gray)
- **Navigation Controls**:
  - `[← Previous (K)]` button
  - `[Next → (J)]` button
- **Primary Actions**:
  - `[Cancel / Esc]` (Outlined neutral)
  - `[Save Draft (⌘S)]` (Subtle blue)
  - `[Approve & Next (⌘↵)]` (Vibrant Emerald Green with checkmark)

---

### Component 2: Question Stem & Context Passage

#### Context Passage / Comprehension Container (Conditional)
- Toggle button: `+ Add Reading Passage` (turns to `− Remove Passage` when active).
- Background: Soft subtle slate (`#F8FAFC`), bordered with subtle dashed border.
- Helper note: *"Used for CSAT reading comprehension or case-study context common across multiple questions."*

#### Question Stem Textarea & Formatting Toolbar
- **Editor Toolbar**:
  - `[ B ]` Bold
  - `[ I ]` Italic
  - `[ √x ]` Insert LaTeX Math Formula
  - `[ ≡ ]` Bullet List
  - `[ ⊞ ]` Insert Table
  - `[ 🖼 ]` Attach Diagram / Image
- **Live Counters**:
  - Real-time Word Count & Character Count badge (e.g. `48 words • 312 characters`).
- **Typography**: 15px Inter/Outfit, 1.6 line height for effortless readability.

---

### Component 3: The Option Matrix & Cognitive Reverse Logic (Core Differentiator)

This is the most critical innovation of ExamPlanner. Every question has **4 choices (A, B, C, D)**, but each choice is treated as an active learning diagnostic.

#### Option Card Structure
Each option is represented as a structured card:

1. **Option Letter Avatar**:
   - Circular/Rounded badge: `A`, `B`, `C`, `D`.
   - Normal State: Dark Slate (`#475569`).
   - Correct State: Vibrant Green (`#16A34A`) with checkmark `✓`.

2. **Option Text Input**:
   - Full-width text field with support for inline formulas.

3. **Correct Answer Toggle**:
   - Single-click radio button or pill: `Mark as Correct Answer`.
   - When selected, the entire card shifts to a soft mint background (`#F0FDF4`) with an emerald green border (`#16A34A`).

4. **Correct Option Rationale (Appears when `is_correct = true`)**:
   - Card Header: `✓ Correct Answer Rationale & Factual Verification`
   - Content: Explains why this choice is strictly true according to authoritative syllabus sources (NCERT, Gazette, Standard Texts).
   - Color: Mint green container (`#F0FDF4`), emerald border (`#86EFAC`).

5. **Incorrect Option Reverse Logic (Appears when `is_correct = false`)**:
   - **Mode Switcher (Segmented Control)**:
     - `⚡ Split (Trap & Reality)` [Default]
     - `📄 Single Field`

   - **Split Mode Layout (Dual Card Grid)**:
     - **Card A: "Why Candidates Find It Tempting (Psychological Trap)"**
       - Icon: 💭 (Thought Bubble)
       - Color: Soft Amber background (`#FFFBEB`), Amber border (`#FDE68A`).
       - Placeholder: *"e.g., Aspirants confuse this because Gandhara is a prominent ancient Buddhist art centre, creating a false geographical association with Andhra."*
       - Purpose: Captures cognitive illusions, keyword tricks, and partial-knowledge traps.
     - **Card B: "What Is Actually True (Factual Correction)"**
       - Icon: 💡 (Lightbulb)
       - Color: Soft Sky Blue background (`#F0F9FF`), Sky Blue border (`#BAE6FD`).
       - Placeholder: *"e.g., Dhanyakataka is actually located in the Krishna-Guntur valley of Andhra (Amaravati school), whereas Gandhara is located in the far northwest (Peshawar/Rawalpindi)."*
       - Purpose: Provides the definitive factual counter-evidence that permanently resolves the misconception.

   - **Single Field Mode**:
     - Standard unified textarea for straightforward factual questions.

---

### Component 4: Step-by-Step Comprehensive Solution & Traps

1. **Detailed Solution Canvas**:
   - Supports markdown, numbered derivations, and historical chronology.
   - Quick formatting pills: `+ Insert Key Takeaway Box`, `+ Bullet Step`.
   - Visual styling: Clean white surface with subtle divider lines.

2. **Points to Remember & Common Traps (Chip Tag Input)**:
   - Header: `Points to Remember & Common Traps ({count})`
   - Input field: `Type a mnemonic or examination warning and press [Enter]...`
   - Chip Tags:
     - Soft amber badge with remove icon: `[ ⚠ Don't confuse Amaravati with Gandhara  × ]`
     - Click to delete or drag to reorder.

---

### Component 5: Curriculum Taxonomy, Scoring & Metadata Inspector

Organized inside the Right-Hand Inspector panel:

1. **Curriculum Hierarchy (Cascading Selectors)**:
   - **Exam / Subject**: Dropdown (e.g. `History & Culture`, `Indian Polity`, `Geography & Environment`).
   - **Topic / Microtheme**: Input/Autocomplete (e.g. `Ancient India → Buddhism & Jainism`).
   - **Subtopic / Nano Theme**: Input/Autocomplete (e.g. `Buddhist Architecture & Monastic Centres`).

2. **Scoring & Difficulty Matrix**:
   - **Difficulty Selector**: Segmented control with 3 states:
     - `Easy` (Green tint)
     - `Medium` (Amber tint)
     - `Hard` (Rose red tint)
   - **Positive Marks**: Number input (Default `+2.00`).
   - **Negative Marks**: Number input (Default `-0.66`).
   - **Ideal Time to Solve**: Number input in seconds (Default `60s`).

3. **Advanced: Interdisciplinary Concept Relevance (Relevance Sliders)**:
   - For complex questions touching multiple subjects (e.g. Economy + Environment):
     - Secondary Concept: `Environmental Economics`
     - Relevance Weight Slider: `10% ---------●--- 100%` (Sets 75% weight).

---

## 5. Visual Design System & Figma Tokens

To ensure 100% alignment with ExamPlanner's design identity, apply the following design tokens:

### 5.1 Color Palette

```
/* Primary Brand & Actions */
--accent-primary:      #2563EB;   /* Royal Blue */
--accent-hover:        #1D4ED8;   /* Deep Blue */
--accent-subtle:       #EFF6FF;   /* Soft Blue Tint */
--accent-border:       #93C5FD;

/* Success (Correct Option / Published / Approval) */
--success-primary:     #16A34A;   /* Emerald Green */
--success-dark:        #15803D;
--success-bg:          #F0FDF4;   /* Mint Background */
--success-border:      #86EFAC;

/* Warning & Trap Callout (Why Tempting) */
--trap-amber-primary:  #D97706;   /* Rich Amber */
--trap-amber-text:     #92400E;   /* Dark Amber Text */
--trap-amber-bg:       #FFFBEB;   /* Warm Butter Cream */
--trap-amber-border:   #FDE68A;

/* Reality / Factual Disproof (What is Actually True) */
--reality-blue-primary:#0284C7;   /* Cyan Sky */
--reality-blue-text:   #0369A1;
--reality-blue-bg:     #F0F9FF;   /* Pale Ice Blue */
--reality-blue-border: #BAE6FD;

/* Danger / Rejected State */
--danger-primary:      #DC2626;   /* Crimson Red */
--danger-bg:           #FEF2F2;
--danger-border:       #FECACA;

/* Surfaces & Typography */
--bg-studio:           #F8FAFC;   /* Slate 50 Neutral Canvas */
--bg-card:             #FFFFFF;   /* Pure White Surfaces */
--text-heading:        #0F172A;   /* Slate 900 */
--text-body:           #334155;   /* Slate 700 */
--text-muted:          #64748B;   /* Slate 500 */
--border-subtle:       #E2E8F0;   /* Slate 200 */
```

### 5.2 Typography System
- **Headings & Badges**: `Outfit` or `Inter`, Bold/Semi-Bold (`font-weight: 700 / 600`).
- **Body & Inputs**: `Inter`, Regular/Medium (`font-weight: 400 / 500`), size `13.5px / 14px`, line-height `1.55`.
- **Formulas & Code**: `KaTeX` / `JetBrains Mono` for math formulas and code snippets.

### 5.3 Elevation & Shapes
- **Card Corners**: `border-radius: 8px` (clean, contemporary enterprise feel).
- **Buttons & Inputs**: `border-radius: 6px`.
- **Pills & Badges**: `border-radius: 20px`.
- **Shadows**: 
  - Standard card: `0 1px 3px rgba(15, 23, 42, 0.04)`
  - Elevated modal/panel: `0 10px 25px -5px rgba(15, 23, 42, 0.1), 0 8px 10px -6px rgba(15, 23, 42, 0.05)`

---

## 6. Micro-Interactions & Power-User Keyboard Shortcuts

| Shortcut | Action | Visual Feedback in UI |
| :--- | :--- | :--- |
| `⌘ + S` / `Ctrl + S` | **Save Draft** | Small toast: *"Draft saved locally"* + subtle green flash on save button. |
| `⌘ + Enter` / `Ctrl + Enter` | **Approve & Next Question** | Current question turns green in navigator; smooth slide transition to Q+1. |
| `J` or `↓` | **Next Question** | Instant load without page reload. |
| `K` or `↑` | **Previous Question** | Instant load. |
| `1`, `2`, `3`, `4` (with Alt) | **Mark Option A, B, C, D as Correct** | Instant radio switch + green card glow. |
| `Tab` | **Cycle Input Fields** | Focused border with high-contrast accent ring. |
| `Esc` | **Close Studio / Exit** | Confirmation if unsaved changes exist: *"Discard changes?"* |

---

## 7. Direct Figma Prompt / Creative Brief (Copy-Paste Ready)

> **Copy and paste the following prompt into Figma AI, Galileo AI, v0.dev, or hand it directly to your UI/UX designer:**

```text
Design a modern, high-density "Question Review & Editorial Studio" web interface for ExamPlanner, an ed-tech test preparation platform for UPSC & Civil Services examinations.

Layout:
A 3-column desktop layout (1440px wide viewport):
1. Left Sidebar (220px): Question Navigator. A vertical list of Question 1 through 100 with status indicators (Green checkmark for Published, Yellow dot for Needs Review, Red dot for Rejected). Includes a search bar and a quick filter pill selector ('All', 'Flagged', 'Incomplete Traps'). Active question item (e.g. Q42) is highlighted with a blue border and soft blue background.

2. Center Canvas (Main Editorial Workspace, ~800px):
- Header Bar: Question Title ('Question #42'), Word count indicator, and an expandable contextual 'Reading Comprehension Passage' box.
- Question Stem Editor: A clean rich-text card with Markdown and Math formula tools (Bold, Italic, LaTeX, List, Table).
- Option Choices Matrix (A, B, C, D):
  - Each choice is an interactive card.
  - Option A is marked 'Correct Answer' with an emerald green border, mint background, and a dedicated 'Correct Answer Rationale' box.
  - Options B, C, and D are marked incorrect. Each contains ExamPlanner's signature 'Reverse Logic' split container:
    * Left Box (Amber/Yellow tint with thought bubble icon): 'Why Candidates Find It Tempting (Trap)' - explaining the psychological distractor.
    * Right Box (Sky Blue tint with lightbulb icon): 'What Is Actually True (Reality)' - providing the authoritative factual correction.
- Comprehensive Solution Editor: Multi-paragraph explanation card with '+ Insert Bullet' quick action.
- 'Points to Remember & Common Traps': Interactive chip tags that can be added or deleted.

3. Right Sidebar (Inspector & Live Preview, 380px):
- Tabbed selector: [Live Student Preview] | [Original Paper PDF] | [Taxonomy].
- Under 'Live Student Preview', show a realistic, high-fidelity mock of how this exact question, its choices, and explanation modal look on a student's tablet/desktop screen.
- Under 'Taxonomy', show clean dropdowns for Subject ('Ancient History'), Topic ('Buddhism'), Difficulty level (Easy/Medium/Hard pills), and Marks (+2.00 / -0.66).

Top Bar:
- Sticky header with breadcrumbs: 'Exams / UPSC CSE Prelims 2024 / Q42'.
- Navigation buttons: '← Prev (K)' and 'Next → (J)'.
- Action buttons: 'Save Draft (⌘S)' and a prominent emerald green button 'Approve & Next (⌘↵)'.

Aesthetic & Style:
- Professional, Linear/Notion-inspired modern SaaS aesthetic.
- Colors: Pure white (#FFFFFF) cards on light slate (#F8FAFC) canvas, Royal Blue (#2563EB) accents, Emerald Green (#16A34A) for correct items, Warm Amber (#D97706) for traps, Sky Blue (#0284C7) for factual corrections.
- Typography: Clean Inter / Outfit sans-serif with crisp hierarchy and subtle 8px border radius on cards.
```

---

## 8. Summary Checklist for Design Approval

- [ ] **3-Column Studio Layout** supported (Navigator + Editor + Inspector).
- [ ] **Dual-Pane Split** for Reverse Logic clearly visible (Amber "Trap" vs. Sky Blue "Reality").
- [ ] **Real-time Student Preview** tab showing the candidate test-taking view.
- [ ] **OCR / Original PDF Reference** viewer easily accessible.
- [ ] **Keyboard Shortcuts** legend visible in a help tooltip (`?` key).
- [ ] **Clean Responsive Adaptation** for tablet / 13" laptop screens (collapsible side panels).
