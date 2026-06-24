# bfs — research notes & provenance

## Sources actually used (web-verifiable)

- **CLRS, *Introduction to Algorithms*, 4th ed., §20.2 (Breadth-first search).** The algorithm, the
  O(V+E) bound, the shortest-path-tree property, and the proof that first-discovery distance is the
  true shortest distance (basis for this entry's invariant section).
- **Moore, E. F. "The shortest path through a maze." 1959.** A classic origin of BFS (the maze framing).
- **Sedgewick & Wayne, *Algorithms* 4th ed., §4.1** — https://algs4.cs.princeton.edu/41graph/

## The lens

- BFS with a FIFO queue dequeues cells in nondecreasing distance order ⇒ **first time a cell is
  reached, dist is its true shortest-path distance** (unweighted). Parent links form a shortest-path
  tree; backtracking from the target gives a shortest path. Fails on weighted edges (→ Dijkstra).

## Implementation note (this entry)

- 4-connected grid; walls placed with probability p, then a **monotone path src→tgt is carved**
  (cleared) so the target is always reachable. Animation reveals BFS one distance-layer at a time
  (the wave), then a final frame draws the backtracked shortest path. New grid-maze visualization
  type (sets up Dijkstra / A*).

## Verification

`tools/test-bfs.mjs` — **242 checks green** (60 seeded mazes, widths 12–36, wall density 0–40%):
1. **Distances match an independent BFS oracle** for every cell (true shortest distances).
2. **Target reachable** (carved-path guarantee); **path length = dist+1**.
3. **Path valid:** correct endpoints, each step adjacent (Manhattan 1), no walls.
4. Determinism for a seed; draw no-throw across the whole wave.

## Honesty notes

- The invariant section is explicit that BFS gives shortest paths only for **unweighted** graphs and
  points to Dijkstra for weighted edges — no overclaiming. Grid 4-connectivity (no diagonals) is
  stated (it's why the wave is a diamond).
