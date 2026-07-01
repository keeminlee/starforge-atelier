# Voussoir — the statics model, stated honestly

Voussoir is a small browser game in which you shape a masonry arch and *release the
load*. The arch then **stands or collapses by a real (if simplified) line-of-thrust
calculation** — not a scripted verdict. This note records exactly what is modelled,
what is faithful, and what is deliberately simplified, so the physics can be trusted
and checked.

The whole point: you don't read *about* load-bearing. You lose when you misread it —
and you lose for the right reason (the thrust left the stone), never a faked dice-roll.

---

## 1. What the game computes

### The arch
- An arch is a ring of **rigid wedge stones (voussoirs)** between two abutments,
  generated as a circular ring (intrados + extrados radius `R` and `R+t`) through a
  left springing, a right springing and a crown. Joints between stones are **radial**.
- Each voussoir's **weight** is taken proportional to its **cross-sectional area**
  (uniform unit density, unit depth), acting **downward at its centroid** (computed by
  the polygon shoelace formula). Extra **point loads** (a block on the arch's back) are
  added as additional vertical loads at their own `x`.

### The line of thrust
The line of thrust is the locus of the points, joint by joint, through which the
resultant compressive force passes. Under vertical loads the horizontal component of
thrust `H` is **constant** through the whole arch, and between loads the thrust line is
straight, kinking down at each weight. This makes it a **funicular** of the loads:

```
y(x) = b0 + sig·x − S(x)/H ,   where  S(x) = Σ_{x_i < x} W_i·(x − x_i)
```

- `H`  — the horizontal thrust (controls how deeply the line sags between supports).
- `sig` — an overall slope term (lets the line lean for asymmetric loads / supports).
- `b0` — a vertical offset (`b0 = yc + S(0)/H`, with `yc` the crown thrust height).

`−S(x)/H` is concave-down: a **hump**, the inverted hanging chain — exactly the shape an
arch's compressive thrust takes. The three free numbers `(H, yc, sig)` are precisely the
three degrees of freedom of a funicular for a fixed set of vertical loads (horizontal
force + position + slope). This is standard graphic statics.

### Eccentricity and the stand/fall rule
For each joint we find where the thrust line crosses it and express the crossing as a
normalized position `t` along the joint: `t = 0` at the intrados face, `t = 1` at the
extrados face, `t = 0.5` at the centroid. The crossing is measured **along the joint**
from its centroid using the local thrust slope (robust for any joint orientation,
including the horizontal springing joints of a true semicircle — a naive vertical-gap
or segment-intersection test degenerates there, which an early version got wrong):

```
s = (y(cx) − cy) / (u_y − m·u_x) ,   t = 0.5 + s / L
```

where `(cx,cy)` is the joint centroid, `u` the unit joint direction, `L` the joint
length, and `m = sig − W_left/H` the local thrust slope.

The eccentricity from the centre is `e = |t − 0.5|`:
- `e ≤ 1/6` — thrust within the **middle third**: no tension anywhere, the masonry is
  fully in compression (shown **gold**).
- `e ≤ 1/2` — thrust within the **section**: the arch **stands**, though the joint
  cracks on the tension side (shown **brass**).
- `e > 1/2` — thrust has **left the stone**: that joint **hinges** (shown **red**).

### The verdict — Heyman's Safe Theorem
By the **safe (lower-bound) theorem of masonry limit analysis** (Heyman), an arch can
stand **iff at least one thrust line lies everywhere within the masonry**. So the solver
**searches the funicular family** `(H, yc, sig)` (a coarse logarithmic/linear grid,
then five coarse-to-fine refinement passes) for the line of **least maximum
eccentricity**. Then:

- `min over (H,yc,sig) of max_joint |t−0.5|  ≤ 1/2`  →  **STANDS** (a valid equilibrium
  exists; the green/brass line shown is that equilibrium).
- otherwise  →  **COLLAPSES**: even the best-possible line exits the section at the
  marked joints, so **no equilibrium exists** and the ring is a mechanism.

This is why a wrong placement fails for the *right* reason: failure means "there is no
way for the load to reach the ground inside these stones," computed, not asserted.

---

## 2. Faithfulness check (how we know it's real)

The solver was validated in Python and again in the exact JavaScript shipped here:

- **Minimum thickness of a semicircular arch.** Heyman's classic result is that a
  semicircular arch under self-weight needs a thickness-to-radius ratio of about
  **t/R ≈ 0.106** to stand. Our solver's stand/collapse threshold lands at
  **t/R ≈ 0.12–0.13** (with ~15–20 voussoirs) — close agreement; the small excess is
  the discretisation (lumping each stone's weight at a point) and finite search grid.
- **Thicker stands, thinner falls; monotonic eccentricity** in thickness — confirmed.
- **A gentler (segmental) arc tolerates a thinner ring** than a full half-circle —
  confirmed, and used as Chapter II.
- **A concentrated off-centre load** raises the eccentricity and, past a threshold,
  hinges the haunch; a load driven **over a pier** is carried (it goes straight to
  ground) — confirmed, and used as Chapters III and IV.
- **Flat arches under self-weight or a uniform deck load are stable** (their funicular
  is close to their centre-line). The game therefore does **not** pretend "flat = doom";
  that would be false for this model. The honest failure levers are *thinness*, *embrace
  angle*, and *concentrated/asymmetric load*, and the challenges are built only on those.

All four shipped challenges were checked to (a) **collapse in their initial state** and
(b) have a **reachable standing solution** within the control's range.

---

## 3. What is simplified (the honest limits)

This is a teaching model, not a research tool. In particular:

1. **2-D, unit depth.** A slice of arch; no out-of-plane behaviour.
2. **Rigid blocks, infinite compressive strength.** Stones never crush and never elastically
   shorten. Standard for limit analysis, but it means *crushing* failure is not modelled —
   only loss of equilibrium (hinging). Real very-thick/very-flat rings can fail by crushing
   where this model still says "stands."
3. **Friction / sliding — now modelled (Coulomb), optional, off by default.** *(Phase 2)*
   The original engine assumed **infinite friction**: only rotational (hinge) failure was
   considered, and shallow joints could never slip. Finite friction is now a real, tested
   part of the engine, exposed through `solve(arch, extras, passes, {mu})`:
   - **The model.** At each joint the compressive resultant travels along the local thrust
     slope, a direction `f = (1, m)` with `m = sig − W_left/H` (the *same* `m` `eccOf` uses).
     The joint has unit direction `u = (u_x, u_y)` (intrados→extrados) and unit normal
     `n = (−u_y, u_x)`. Decomposing the force: tangential `T = f·u = u_x + m·u_y`, normal
     `N = f·n = m·u_x − u_y`. The ratio `r = |T| / |N| = |tan(angle between the force and the
     joint normal)|` is independent of the force magnitude. **Coulomb:** the joint does **not**
     slide iff `r ≤ μ`, i.e. the force's inclination to the joint normal stays within the
     friction angle `φ = atan μ`. `slideOf(P,H,yc,sig)` reports this ratio joint-by-joint,
     exactly mirroring how `eccOf` reports eccentricity.
   - **The combined verdict.** With finite `μ`, the arch stands iff **some** thrust line lies
     within the section (`e ≤ 1/2` everywhere, no hinge) **and** satisfies no-sliding (`r ≤ μ`
     everywhere). The solver searches the same funicular family `(H, yc, sig)` but minimises the
     worst **combined** violation, each constraint normalised to its own limit and taken
     worst-case (an ∞-norm):

     ```
     score(H,yc,sig) = max( maxe / (1/2) , maxr / μ )      score ≤ 1  ⇔  both constraints met
     ```

     The result reports `stands`, the governing failure `mode` (`"hinge"` / `"slide"` /
     `"stands"`, decided by whichever normalised violation is larger), and which joints hinge
     (`hingeJoints`) vs slide (`slideJoints`). **With `μ` absent or `Infinity` the sliding term
     is zero and `score` reduces to a monotone image of `maxe`, so the search — and every
     existing verdict — is byte-identical to the original hinge-only engine** (regression test (e)).
   - **What this is, honestly.** This is a **first-order combined criterion**, *not* a rigorous
     coupled limit analysis. It looks for a single thrust line admissible for both hinging and
     sliding at once; finding one is a sensible *sufficient* (safe-side) stand condition, but the
     lower-bound (safe) theorem is **not rigorously valid under non-associative Coulomb friction**
     (Livesley) — real sliding can couple to the hinge mechanism in ways a single-line search does
     not capture, and a true bound needs a mixed LP/limit-analysis formulation. When the two
     constraints conflict the search returns a best-compromise line that may exceed *both* limits
     somewhat; the governing `mode` names the larger violation. For the smooth, low-dimensional
     teaching problems here this first-order model reproduces the classic results (below); it is
     deliberately **not** presented as a research-grade friction solver.
   - **What it reproduces (validation (f),(g)).** A semicircular ring that is hinge-safe at
     infinite friction (t = 0.45, `maxe = 0.415`) **slides at its two horizontal springing joints**
     once `μ` drops low — measured threshold `μ* ≈ 0.38` (`φ* ≈ 21°`); at `μ = 0.30` the governing
     mode is `slide` at joints 0 and N. That is the classic Heyman springing-slide: the reaction at
     a semicircle's horizontal springing is steeply inclined, so the force leans well off the joint
     normal. Conversely a well-built arch at realistic masonry `μ ≈ 0.6` (`φ ≈ 31°`) that is simply
     too thin still fails by **hinging**, with no joint sliding — matching Heyman's observation that
     sliding rarely governs sound masonry.
4. **Weight lumped at centroids.** Each voussoir's weight is a point load at its centroid
   rather than distributed; with a dozen-plus stones this is a small error but it shifts the
   computed minimum thickness slightly (see §2).
5. **Abutment / lateral-thrust stability — now modelled (pier limit equilibrium), optional, off by default.** *(Phase 2)*
   The original engine assumed **rigid, immovable abutments**: the piers could take any horizontal
   thrust without complaint, so the classic real danger of a flat arch — a large horizontal thrust
   shoving its supports apart — was never penalised. That check is now a real, tested part of the
   engine, exposed as a **separate, opt-in evaluation** of an already-solved arch:
   `abutmentStability(arch, sol, pier, opts)`. It never runs inside `solve()` and never alters the
   arch verdict — the arch-only stand/fall result is byte-identical whether or not you ever call it
   (regression test (h)).
   - **What the arch hands the pier.** The chosen thrust line delivers to each springing a reaction
     with a horizontal component equal to the constant arch thrust `H` (pushing the pier **outward**,
     away from the span) and a vertical component `V` (that springing's share of the weight). We take
     the vertical reactions from the **same** solved line, so `H` and `V` belong to one equilibrium
     rather than a separate guess: the line `y(x)=b0+sig·x−S(x)/H` has slope `sig` at the left
     springing (nothing to its left) and `sig−W/H` at the right (all weight `W` to its left), so the
     arch's vertical push is `V_left = H·|sig|`, `V_right = |H·sig − W|` (`= W/2` each for a symmetric
     arch), with `V_left + V_right = W` by construction.
   - **The pier.** Each pier is a rigid rectangular block of width `b` and height `h` (springing down
     to the foundation), unit depth and unit density, so its self-weight is `Wp = b·h` acting at its
     centroid. We apply the arch reaction (`H` outward, `V` down) at the springing, taken as the pier's
     **inner top edge**; the pier body extends **outward** by `b` to the outer toe it would overturn
     about. Taking moments about that outer toe (base level, height `h` below the springing) —
     restoring `= V·b + Wp·(b/2)`, overturning `= H·h` — the vertical base reaction `(V + Wp)` crosses
     the base a distance `a` inboard of the toe:

     ```
     a  = ( V·b + Wp·(b/2) − H·h ) / (V + Wp)
     ep = |a − b/2| / (b/2)          (eccentricity of the base resultant, normalised to the half-width)
     ```

     Read exactly like the arch's own middle-third rule: `ep ≤ 1/3` → the resultant is in the **middle
     third** (no tension at the base); `ep ≤ 1` → within the base, the pier **stands**; `ep > 1` → the
     resultant has left the base at the toe and the pier **overturns**. Under this outward-only loading
     `a` only ever moves toward the toe, so `a < 0 ⇔ ep > 1`. If `opts.mu` is finite (reusing the
     rung-b friction `μ`), the pier is also checked for **base sliding** on its foundation:
     it slides iff `H > μ·(V + Wp)`. The result reports, per abutment, `ep`, `overturns`, `slides`,
     the governing `mode` (`"none"`/`"overturn"`/`"slide"`, whichever normalised violation is larger),
     and the smallest safe width `minStableWidth.b`.
   - **What it reproduces (validation (i)–(k)).** Over a **fixed span**, a shallow segmental arch
     (crown 1.2) drives `H ≈ 1.95` into its piers versus `H ≈ 0.88` for the tall semicircle (crown 3.0)
     — about **2.2×** the thrust — while carrying *less* weight, so *less* stabilising `V`. With one
     fixed pier (`b = 1.2, h = 4`) the tall arch's pier stands (`ep ≈ 0.51`) and the flat arch's pier
     **overturns** (`ep ≈ 1.80`); equivalently the flat arch demands a wider pier, minimum stable
     `b* ≈ 1.62` against the semicircle's `b* ≈ 0.88`. Eccentricity is monotone — a **thinner** pier
     (smaller `b`) or a **taller** one (larger `h`) overturns more easily — and a wide, squat pier
     carries the semicircle comfortably inside the middle third (`ep ≈ 0.13`). **This is flat-arch
     danger made honest:** the lesson this note previously said the model *could not carry* is now the
     headline result of a real pier calculation, not an asserted moral.
   - **What this is, honestly — a FIRST-ORDER check.** This is a **decoupled** limit-equilibrium test:
     solve the arch, then load its reaction onto an independent rigid pier. It assumes a **rigid pier
     on a rigid foundation** — no foundation settlement, no pier spread, no passive earth pressure
     behind the pier, static limit equilibrium only. In reality a pier that begins to spread would
     lengthen the span and *change* the arch thrust, feeding back into `H`; a rigorous treatment is a
     **coupled arch+pier limit analysis (a mixed LP)**, not a one-way hand-off. It is deliberately
     **not** presented as that. For the smooth teaching cases here the first-order check reproduces the
     classic flat-arch-thrust result cleanly, and it is honest about being a *sufficient first look* at
     abutment safety rather than a coupled bound.
6. **One thrust line, no thickness of thrust.** We track the resultant's line of action, not a
   stress block; the middle-third / no-tension reading is the usual elastic-core proxy.
7. **The search is a fine grid, not a proof.** A failure verdict means "no thrust line was
   found within the section across a dense coarse-to-fine search of the funicular family."
   For these smooth, low-dimensional problems that reliably finds the true optimum, but it is
   a numerical search, not a closed-form bound.

### The one acknowledged shortcut in the *animation* (a documented v0 cut)
The **stand/fall verdict and the thrust-line visualisation are the real computation.** The
**collapse motion** is *not* a rigid-body dynamics simulation. When the verdict is collapse,
the solver does identify the **actual hinge joints** (where the optimal thrust line exits the
stone) and marks them; the stones are then split into rigid links at those hinges and folded
about them with a scripted rotation plus gravity drop and fade. This reads correctly as a
four-hinge-style mechanism collapsing at the right places, but the exact fold kinematics and
fall timing are illustrative, not solved equations of motion. Per the brief, this is the
accepted v0 cut: *the verdict is honest; the choreography of the fall is not.*

---

## 4. The DOME — a cracked-hemisphere lower bound (capstone)

Name it plainly: **a first-order sliced-lune (Heyman) lower bound for a cracked hemispherical
dome — conservative, membrane, axisymmetric.** It is the honest new mechanic of the capstone,
and its whole point is a genuinely NEW principle the arch never taught: **hoop (circumferential)
force**, the reason domes fail *unlike* arches. `engine/dome.mjs` adds it; `engine/statics.mjs`
is **not touched** — the dome is new INPUT GEOMETRY to the already-validated solver, the
strongest honesty guarantee available.

### The two-way load path, and why domes crack
A dome carries load two ways at once: a **meridional** thrust `N_phi` (crown→base, always
compression, like an arch) and a **hoop** force `N_theta` (circumferential). Membrane theory of
a spherical shell of radius `R` under self-weight `w` per unit area, at angle `phi` from the
crown (sign convention: **negative = compression, positive = tension**):

```
N_phi   = − w·R / (1 + cos phi)                    (meridional, compression everywhere)
N_theta =   w·R · [ 1/(1 + cos phi) − cos phi ]    (hoop)
```

`N_theta` is compression near the crown but turns **tensile** below `cos²phi + cos phi − 1 = 0`,
i.e. `cos phi = (√5 − 1)/2 ≈ 0.618` (the golden ratio), `phi ≈ 51.83°`. Masonry cannot take that
tension, so a real dome **cracks along its meridians** below ~52° into *orange-segment* lunes.
**This is the whole new lesson: a dome does not hinge like an arch — it SPLITS, and the cracked
lunes then act as arches.** `domeMembrane(phi)` and `hoopCrackAngle()` expose these for display
and validation; the stand/fall verdict itself comes from the solver, below.

### The sliced-lune model (Heyman) — same solver, new weights
Assume the dome has **already cracked meridionally**: carry no hoop tension, and —
conservatively — credit **no hoop compression either**. By axisymmetry, analyse ONE diametral
lune: base → up over the pole → down to the opposite base. That lune is a **variable-width plane
arch** — geometrically the same semicircular ring as a plane arch of equal radius, but with each
voussoir's WEIGHT scaled by the **circumferential band width** (∝ `sin phi`: zero at the pole,
max at the base). `buildDomeMeridian(R, t, N)` returns the SAME `{vouss, joints, R, t, ox, oy}`
shape as `buildArch`, changing only `w`; so `prep`, `eccOf`, `slideOf` and `solve` consume it
**verbatim**. Each segment's weight is its exact mid-surface spherical-band area (Archimedes'
hat-box theorem: `∝ |cos phi_a − cos phi_b|`), lumped at the same planar wedge centroid.

**The stand/fall rule is identical to the arch's** (§1, safe theorem): the dome stands iff a
meridional thrust line lies within the shell thickness at every parallel joint —
`max|t − 0.5| ≤ 1/2`. Minimum thickness = the `t/R` where that threshold is crossed
(`domeMinThickness(R, N)`). **Why it is a rigorous lower bound:** ignoring hoop compression throws
away a *stabilising* effect, so if the cracked, hoop-free dome stands, the real dome stands at
least as well (Heyman). The un-credited hoop compression is the honest *I-don't-know* kept **inside**
the instrument — the bound is deliberately conservative, exactly as the friction (§3.3) and pier
(§3.5) sections keep their own caveats visible.

### Faithfulness check (validation `tests/dome.test.mjs`)
- **Minimum thickness of a hemisphere.** Heyman's classic result is `t/R ≈ 0.042`. The solver's
  stand/collapse threshold lands at **`t/R ≈ 0.052`** (R = 3, N = 24) — the small excess is
  discretisation (weight lumped at band centroids + finite search grid), the *same* pattern the
  arch shows (classic 0.106 → measured ~0.13, §2). Asserted in the sane band `[0.03, 0.065]`, with
  the measured value printed. Headline honesty test.
- **Hoop-crack angle.** `hoopCrackAngle() = 51.83°`, `cos phi = (√5−1)/2 = 0.618034` — asserted
  *exactly*; `domeMembrane` gives `N_theta ≈ 0` there, compression above the crack line, tension below.
- **Monotonicity.** Thicker stands, thinner falls; eccentricity non-increasing in thickness.
- **Dome beats arch.** Same span and solver, the hemisphere admits a **thinner** shell than the
  semicircular arch — measured **`t/R ≈ 0.052` (dome) vs `≈ 0.126` (arch)** — a *computed* proof
  that a dome is more stable than an arch of equal radius, not an asserted moral.
- **Oculus (optional).** An open-crown (Pantheon) dome needs **≥** the closed dome's thickness
  (measured `t/R ≈ 0.085` at a 20° oculus vs `0.052` closed): removing the crown cap removes
  stabilising weight. The opening is spanned at constant `H` — the honest stand-in for the oculus
  **compression ring** carrying the meridional reaction (the ring's own hoop force is *not*
  credited, same conservative spirit as the un-credited hoop compression).

### What is simplified (the dome's honest limits)
1. **Meridional cracking assumed everywhere; hoop compression NOT credited** — a deliberately
   *conservative* lower bound. A less conservative (still valid) refinement would credit hoop
   compression above 51.8°.
2. **Membrane / no-bending;** a single thrust line in the meridian plane (the shell reduced to a
   variable-width plane arch).
3. **Axisymmetric self-weight only** — no wind, no asymmetric loads unless added as arch-style
   point loads.
4. **Inherits every arch caveat** — rigid blocks, infinite compressive strength, weight lumped at
   centroids, and a fine-grid search (not a closed-form proof), per §3.1–3.2, 3.4, 3.7.

---

## 5. The CATHEDRAL SECTION — a searched safe-theorem load-path (finale)

Name it plainly: **a first-order, searched safe-theorem load-path for a Gothic bay in 2-D section.**
It is the finale, and the most honesty-fragile piece in the engine — precisely where an honest
engine most easily goes quietly fake, so the guard rails are named up front. Unlike the arch (§1) and
the dome (§4), the cathedral introduces **no new physical principle**: it is a *synthesis* of ones you
already own — arch thrust, pier overturning, and a load path. `engine/cathedral.mjs` adds it;
`engine/statics.mjs` is **not touched** — the cathedral only **composes** the already-validated arch
solver and the pier moment-about-toe primitive.

### The chain, and the one indeterminate the engine searches
A cathedral bay is a **chain** of masonry elements that must **all** be simultaneously admissible for
**one** choice of the indeterminate thrust. Horizontal equilibrium of the whole chain forces the
horizontal thrust `H` to be **constant** along the load path: the nave vault delivers `H` at its
springing, the flying buttress must **catch exactly that `H`** and walk it (plus its own weight) down
to the pier, and the pier must resist that same `H` at its toe. **So the single static indeterminate
of the whole bay is this one number `H` — the degree of freedom the engine searches.**

1. **The nave vault** stands with a *family* of thrust lines — a **range** `H ∈ [Hmin, Hmax]` of
   horizontal thrusts for which some line of thrust fits inside the nave ring (Heyman's minimum- and
   maximum-thrust states). This range **is** the indeterminacy. `naveThrustRange(arch, extras)` computes
   it by sweeping `H` and testing each with `solveFixedThrust` (H pinned); an empty range means the nave
   cannot stand at all.
2. **The flying buttress** is a half-arch that must **accept** the nave's thrust at its upper end: it is
   solved with `H` **fixed** = the candidate `H` (not free). `solveFixedThrust(arch, extras, H)` searches
   only the remaining two funicular DOF — crown height `yc` and slope `sig` — for the line of least
   maximum eccentricity **at that fixed `H`**; the flyer is admissible iff that line lies within the
   flyer ring (`maxe ≤ 1/2`, the identical safe-theorem test). Its outer end delivers `(H` outward, `V`
   down`)` to the pier, `V = |H·sig − W_flyer|` read from the **same** solved line.
3. **The buttress pier**, loaded at its top by the flyer's `(H, V)` **plus a pinnacle** vertical weight,
   must not overturn about its outer toe. The pinnacle is the real Gothic structural logic made honest:
   its added vertical load steers the `(H, V + pinnacle)` resultant **down inside the pier** rather than
   out over the toe. Same moment-about-toe / base-eccentricity formula as `abutmentStability` (§3.5),
   here carrying the **stacked** flyer + pinnacle load (`pierOverturn`, generalised to a load list).

### The verdict — a *searched* safe theorem (computed, not assumed)
The bay **STANDS** iff **there exists** an `H` in the nave's admissible range such that *(nave admissible
at `H`)* **and** *(flyer admissible at fixed `H`)* **and** *(pier does not overturn under the flyer +
pinnacle load)*. `solveCathedralSection(spec)` **scans** the nave range and returns the first such `H`
(`chosenH`, governing `"none"`), or reports **COLLAPSE** with the governing element named — `"nave"` (no
admissible nave line at any `H`), `"flyer"` (no flyer line fits for **any** `H` in the range — the thrust
is uncaught; a removed flyer is the degenerate case, and the un-redirected thrust is shown overturning
the bare clerestory wall), or `"pier-overturn"` (a flyer line exists for some `H`, but the pier overturns
under every one). Because the safe theorem needs only **one** admissible whole-system equilibrium to
**exist**, a genuine scan that exhibits one — or proves none exists — is the honest computation. **This is
the honesty-fragile heart of the mechanic, and it is a real search over the true degree of indeterminacy,
not a convenient assumed split.**

### Faithfulness check (validation `tests/cathedral.test.mjs`) — qualitative-but-computed
The cathedral has **no single classical constant** (no arch `t/R ≈ 0.106`, no dome `0.042`). Its
validation is therefore *qualitative-but-computed*: every verdict is produced by the real whole-system
search, and each test prints its measured numbers.
- **Known-good bay stands.** The canonical bay (semicircular nave R = 4, t = 0.9; raking flyer; buttress
  `b = 1.4, h = 6`; pinnacle 12) returns `stands=true` with `chosenH ≈ 2.077` inside the computed nave
  range `[1.995, 3.084]`; the flyer is admissible there (`maxe ≈ 0.48`) and the pier sits at `ep ≈ 0.64`.
- **Remove the flyer ⇒ collapse.** With no catcher the load path has a gap: the un-redirected nave thrust
  overturns the bare clerestory wall (`ep ≈ 2.04 > 1` across the whole range), `governing="flyer"`.
- **Remove the pinnacle ⇒ the pier overturns.** The *same* bay stands with the pinnacle (`ep ≈ 0.64`) and
  collapses without it (`ep ≈ 1.33 > 1`, `governing="pier-overturn"`) — a **computed** proof that
  *pinnacles are structural, not decoration*, not an asserted moral.
- **Monotone trends.** A taller or thinner buttress overturns more easily (`ep` rises), a wider one or a
  heavier pinnacle helps (`ep` falls); measured thresholds — minimum stable width `b* ≈ 1.05`, minimum
  pinnacle `≈ 10.5` on a marginal pier — are printed.
- **Honesty anchor.** The composed pier check is shown **byte-identical** to the validated
  `abutmentStability` for the no-pinnacle case; the pinnacle vertical is the only addition.

### What is simplified (the cathedral's honest limits — softer than the arch/dome, said plainly)
1. **First-order, element-by-element decoupling.** Solve each element, hand its reaction to the next.
   There is **no elastic coupling** and **no arch↔pier feedback** — a spreading pier would in reality
   lengthen the vault span and change `H`; a rigorous treatment is a **coupled whole-frame limit-analysis
   LP**, not a one-way hand-off. This is the same caveat as §3.5, now spanning three elements.
2. **The pinnacle is lumped at the pier centroid** (arm `b/2` from the toe) — a neutral, defensible
   choice, not tuned to force a pass.
3. **The nave delivers only `H` to the flyer;** its vertical reaction runs down the nave wall, taken as
   able to provide it. The flyer's inner-end vertical is a nave-side reaction, not tracked on the pier.
4. **Qualitative (not single-constant) validation.** There is no one classical number to hit; the tests
   assert computed *trends* and the pinnacle-on/off verdict flip, every number printed.
5. **Inherits every arch and pier caveat** — rigid blocks, infinite compressive strength, weight lumped
   at centroids, a fine-grid search (not a closed-form proof), rigid pier on a rigid foundation
   (§3.1–3.2, 3.4–3.5, 3.7).

Said plainly: the whole-system **search is real** and the safe-theorem logic is **sound**; the honesty
softness lives in the first-order decoupling and the qualitative validation — **not** in a faked verdict.
The one temptation refused: no coupled-elastic frame analysis, out of scope for a small self-contained
honest engine. The searched safe-theorem load-path is the classical, sufficient, honest choice that keeps
the verdict **computed, not asserted** — and where the honest answer would have been "this doesn't close
as a clean lower bound," the instrument was built to be able to say so.

---

## 6. Files
- `voussoir.html` — the whole game: inline CSS + JS + `<canvas>`, **zero external
  dependencies**, no image files. Open it in any modern browser.
- `voussoir.NOTES.md` — this document.

> *It holds because nothing was asked to carry more than it could, and the thrust came
> home to the ground.*
