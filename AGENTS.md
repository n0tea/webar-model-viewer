# WebAR development and releases

- Develop features and fixes on `pre-release`. Keep `main` for versions the user has approved for release.
- Do not promote application code to `main` unless the user explicitly requests a release or promotion. The request on 2026-11-20 authorizes releasing the existing gearbox animation work.
- Production URL: https://n0tea.github.io/webar-model-viewer/
- Preview URL: https://n0tea.github.io/webar-model-viewer/pre-release/
- GitHub Pages publishes one combined artifact. A preview deployment must preserve production from `main`; never publish a preview build to the site root.
- The prepared dual-branch workflow is `deployment/deploy.yml`. Automatic preview publication is not active until the user saves it as `.github/workflows/deploy.yml` on GitHub and both branches contain that workflow. Existing Git credentials lack the `workflow` scope.
- `public/pre-release` is a transitional compiled snapshot, not editable source. Animation source and the Blender export instructions belong to the application source branch.
- Preserve untracked user artwork such as PSD files. Do not stage unrelated files.
- Honor a user request to skip tests for small UI edits. Building the application for publication is still necessary.
