# Monorepo Branching & Commit Strategy

This document outlines the standard Git branching and commit message conventions for the Exam Planner monorepo. Because multiple applications and packages reside in the same repository, strict naming conventions are necessary to maintain a clear history and trigger correct CI/CD pipelines.

## 1. Branching Strategy (GitHub Flow)

We follow a simplified GitHub Flow model. The `main` branch is the single source of truth, and all active development happens on feature branches.

### Branch Naming Convention

Format: `<type>/<scope>/<short-description>`

**Types:**
- `feat/`: For new features.
- `fix/`: For bug fixes.
- `chore/`: For routine tasks, dependency updates, or tool configurations.
- `docs/`: For documentation changes.
- `refactor/`: For code refactoring.

**Scopes (Monorepo Specific):**
The scope should match the name of the app or package you are primarily modifying. If the change spans multiple areas, use `core` or `global`.

**Examples:**
- `feat/web/user-dashboard` (Adding a feature to the frontend app)
- `fix/api/auth-middleware` (Fixing a bug in the backend API)
- `feat/exam-config/add-neet-schema` (Adding a new exam config)
- `chore/global/update-deps` (Updating dependencies across the monorepo)

## 2. Commit Message Convention (Conventional Commits)

We enforce the [Conventional Commits](https://www.conventionalcommits.org/) specification. This helps automatically generate changelogs and determine semantic version bumps for individual packages.

Format:
```text
<type>(<scope>): <subject>

[optional body]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `perf`, `test`, `chore`.
**Scope:** `web`, `api`, `shared`, `database`, `exam-config`, `repo`.

**Examples:**
- `feat(web): add login page UI components`
- `fix(api): resolve JWT expiration crash in auth controller`
- `feat(exam-config): register NEET exam configuration`
- `chore(repo): configure pnpm workspace settings`

## 3. Pull Request Workflow

1. **Branch off `main`**: Always ensure your local `main` is up to date.
2. **Develop**: Keep commits focused and well-scoped to the app/package being modified.
3. **Open a PR**: Target the `main` branch. 
   - Ensure the PR title follows the Conventional Commits format (e.g., `feat(api): add user profile endpoint`).
   - Mention the specific apps/packages affected in the PR description.
4. **CI/CD Checks**: Turborepo / CI will detect which packages changed and only run tests/builds for those specific packages.
5. **Merge**: Once approved, use "Squash and Merge" or "Rebase and Merge" to keep the `main` history clean.
