// world-engine-island — the ONE wiring that lets postmark.town serve the told-world
// viewer as a standalone island, from the SAME files a clone runs.
//
// The viewer (spectator/viewer.mjs) and the engine (tools/*.mjs) live in the
// postmark-world package — one source of truth. This integration makes them serve
// at `/world-engine/**` on the town, WITHOUT copying any engine source into this
// repo's tracked tree (no drift): it copies from node_modules into the BUILD OUTPUT
// (dist-town/world-engine/) at build, and serves them from node_modules via a dev
// middleware in `astro dev`. So world.astro can emit spectator/index.html verbatim
// and its `import "/world-engine/spectator/viewer.mjs"` resolves in both.
//
// If the postmark-world pin lacks spectator/viewer.mjs (pre-bump), the copy warns
// and skips — the page still builds; the island viewer just won't load until the
// dependency is bumped (Wright's step).
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";

const MIME = { ".mjs": "text/javascript; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8" };

function pkgRoot(projectRoot) {
  const p = join(projectRoot, "node_modules", "postmark-world");
  return existsSync(p) ? p : null;
}

// place the viewer module + the four engine tools under <dest>/world-engine/
function stage(pkg, dest) {
  const viewer = join(pkg, "spectator", "viewer.mjs");
  if (!existsSync(viewer)) {
    console.warn("[world-engine-island] postmark-world has no spectator/viewer.mjs — island viewer will not load until the dependency pin is bumped.");
    return false;
  }
  mkdirSync(join(dest, "spectator"), { recursive: true });
  mkdirSync(join(dest, "tools"), { recursive: true });
  cpSync(viewer, join(dest, "spectator", "viewer.mjs"));
  for (const f of ["world-verbs.mjs", "world-engine.mjs", "world-build.mjs", "geometry.mjs"])
    cpSync(join(pkg, "tools", f), join(dest, "tools", f));
  return true;
}

export default function worldEngineIsland() {
  let projectRoot;
  return {
    name: "world-engine-island",
    hooks: {
      "astro:config:setup": ({ config }) => { projectRoot = fileURLToPath(config.root); },
      // dev: serve /world-engine/** straight from node_modules (no copy)
      "astro:server:setup": ({ server }) => {
        server.middlewares.use((req, res, next) => {
          if (!req.url?.startsWith("/world-engine/")) return next();
          const pkg = pkgRoot(projectRoot);
          if (!pkg) return next();
          const rel = req.url.replace(/^\/world-engine\//, "").split("?")[0]
            .replace("spectator/viewer.mjs", "spectator/viewer.mjs")
            .replace(/^tools\//, "tools/");
          const abs = join(pkg, rel);
          if (!abs.startsWith(pkg) || !existsSync(abs) || !statSync(abs).isFile()) return next();
          res.setHeader("content-type", MIME[extname(abs)] ?? "application/octet-stream");
          res.end(readFileSync(abs));
        });
      },
      // build: copy into the emitted output so /world-engine/** is served statically
      "astro:build:done": ({ dir }) => {
        const pkg = pkgRoot(projectRoot);
        if (!pkg) { console.warn("[world-engine-island] postmark-world not installed — skipping island stage."); return; }
        const ok = stage(pkg, join(fileURLToPath(dir), "world-engine"));
        if (ok) console.log("[world-engine-island] staged viewer + engine → dist/world-engine/");
      },
    },
  };
}
