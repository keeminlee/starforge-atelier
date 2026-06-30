# Percolation — research notes & provenance

## Model
Site percolation on the 2D square lattice. Each site is independently occupied
with probability `p`. Occupied sites sharing an orthogonal edge (4-connectivity)
form connected clusters. The grid **percolates** when a single cluster reaches
both the top and bottom rows (top↔bottom spanning); left↔right spanning is also
computed and shown in the readout for context.

Cluster-finding algorithm: **weighted union-find** (union by size + path
compression), single raster pass merging each occupied site with its left and
upper neighbors. Iterative, no recursion — safe for large grids.

## Key facts used in the entry
- **Site-percolation threshold, square lattice, 4-connectivity:**
  `p_c ≈ 0.5927` (often quoted 0.592746…). This is a high-precision *numerical*
  estimate, not a closed-form exact value.
- At p_c the incipient spanning cluster is a **fractal** (fractal dimension
  91/48 ≈ 1.896 in 2D) and cluster sizes are power-law (scale-free).
- The transition is **continuous** (second-order); the order parameter (the
  fraction of sites in the infinite/giant cluster) rises continuously from zero
  above p_c, but the *existence* of large-scale connectivity is sharp in the
  infinite-system limit.

## Caveats (stated honestly in the prose / here)
- **p_c ≈ 0.5927 is specific** to *site* percolation on the *square* lattice with
  *4-connectivity*. Other choices give different thresholds:
  - Square-lattice **bond** percolation: `p_c = 1/2` exactly (Kesten 1980).
  - Triangular-lattice site percolation: `p_c = 1/2` exactly.
  - Honeycomb, cubic, etc. all differ; connectivity definition (e.g. including
    diagonals / 8-connectivity) changes the threshold too.
- The **sharp** transition is a *large-system (thermodynamic) limit*. On a finite
  grid the crossover is *rounded*: spanning has a nonzero probability slightly
  below p_c and isn't certain slightly above it. The grid here (~190×114 at
  default width) is large enough to show a clear crossover but is still finite,
  so the "snap" near 0.59 is a steep S-curve, not a true step.
- Spanning is detected top↔bottom on a non-wrapping (open-boundary) grid, the
  standard convention for measuring crossing.

## Sources
1. Broadbent, S. R. & Hammersley, J. M. (1957). "Percolation processes I.
   Crystals and mazes." *Math. Proc. Cambridge Phil. Soc.* 53(3), 629–641.
   https://doi.org/10.1017/S0305004100032680  — origin of the model.
2. Stauffer, D. & Aharony, A. (1994). *Introduction to Percolation Theory*,
   2nd ed. Taylor & Francis. — thresholds, scaling, universality, fractal dim.
3. Threshold value p_c ≈ 0.5927: widely cited numerical estimate; see Newman &
   Ziff (2000) "Efficient Monte Carlo algorithm and high-precision results for
   percolation", Phys. Rev. Lett. 85, 4104 (p_c = 0.592746…), and the Wikipedia
   "Percolation threshold" compilation. https://en.wikipedia.org/wiki/Percolation_threshold
4. Kesten, H. (1980). "The critical probability of bond percolation on the square
   lattice equals 1/2." *Commun. Math. Phys.* 74, 41–59. — exact bond result.
5. Grimmett, G. (1999). *Percolation*, 2nd ed. Springer. — rigorous treatment.

## Cross-links
Conceptually tied to the `ising` entry (another Criticality grid model, shares
the universality story) and the `site/edge-of-chaos.html` essay (phase
transitions / the order–disorder boundary). The related nav is auto-generated
from the manifest, so the page only carries the empty `<nav data-atlas-nav>`.
