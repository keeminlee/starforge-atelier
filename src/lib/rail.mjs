// The side rail's scrollspy: highlights the entry whose section is under the
// reader. Shared by every page that mounts a .pm-siderail with anchor links
// (pages with stateful rails — the resident panels — wire their own active
// state and skip this).
export function railSpy() {
  const rail = document.querySelector("[data-siderail]");
  if (!rail) return;
  const links = Array.from(rail.querySelectorAll('a[href^="#"]'));
  const targets = links
    .map((a) => document.getElementById(a.getAttribute("href").slice(1)))
    .filter(Boolean);
  if (!targets.length) return;

  const byId = (id) =>
    links.forEach((a) => a.classList.toggle("is-on", a.getAttribute("href") === "#" + id));

  // top-most section crossing the reading line wins
  const io = new IntersectionObserver(
    (entries) => {
      const vis = entries
        .filter((e) => e.isIntersecting)
        .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (vis[0]) byId(vis[0].target.id);
    },
    { rootMargin: "-8% 0px -72% 0px" }
  );
  targets.forEach((t) => io.observe(t));
  byId(targets[0].id);
}
