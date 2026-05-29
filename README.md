# Starforge Site

Astro public atelier site for Starforge.

Canonical path:

```text
G:/content-creation/starforge-site/
```

This site is the public-facing atelier: home, Star rooms, projects/exhibits, field notes, and boundaries. It is distinct from:

- `G:/content-creation/starforge-atelier-seed/` — seed assets / staging materials before they are folded into the site.
- `G:/content-creation/starforge-studio-first-light/` — older HTML-first First Light receipt room / source artifacts.
- `G:/Starstory/EPICS/CONTENT-CREATION/` — governance / EPIC scope.

## Routes

Astro file routing under `src/pages/`:

- `src/pages/index.astro` → `/`
- `src/pages/atelier/index.astro` → `/atelier/`
- `src/pages/atelier/first-light.astro` → `/atelier/first-light/`
- `src/pages/stars/rei.astro` → `/stars/rei/`
- `src/pages/stars/wright.astro` → `/stars/wright/`
- `src/pages/field-notes/index.astro` → `/field-notes/`
- `src/pages/about.astro` → `/about/`

## Commands

Run commands from `G:/content-creation/starforge-site/` using PowerShell on Windows (not Git Bash; npm postinstall scripts need `cmd.exe`).

```sh
npm install
npm run dev
npm run build
npm run preview
```

## Publish notes

- Local preview serves at `/`, so it will not catch GitHub Pages project-subpath breakage.
- If publishing to root Pages/custom domain, root-absolute links are fine.
- If publishing to a project URL like `https://keeminlee.github.io/<repo>/`, set Astro `site`/`base` and make links/assets base-aware before publish.
- Publishing remains deliberate and Keemin-gated.

## Hygiene

`node_modules/`, `dist/`, and `.astro/` are intentionally ignored by the nested `.gitignore`.
