# WebAR development and releases

- Develop features and fixes on `pre-release`. Keep `main` for versions the user has approved for release.
- Do not promote application code to `main` unless the user explicitly requests a release or promotion. The request on 2026-11-20 authorizes releasing the existing gearbox animation work.
- Production URL: https://n0tea.github.io/webar-model-viewer/
- Preview URL: https://n0tea.github.io/webar-model-viewer/pre-release/
- GitHub Pages publishes one combined artifact. A preview deployment must preserve production from `main`; never publish a preview build to the site root.
- The active dual-branch workflow is `.github/workflows/deploy.yml` (reference copy: `deployment/deploy.yml`). Both branches contain it. Existing Git credentials lack the `workflow` scope, so workflow modifications may require the user to save the prepared content through GitHub.
- Do not commit compiled preview snapshots into `public/pre-release`. The workflow builds both source branches and `scripts/assemble-pages.mjs` generates the combined deployment, including `/pre-release/`.
- Preserve untracked user artwork such as PSD files. Do not stage unrelated files.
- Honor a user request to skip tests for small UI edits. Building the application for publication is still necessary.
