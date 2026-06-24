# binary-heap — research notes & provenance

## Sources actually used (web-verifiable)

- **Williams, J. W. J. "Algorithm 232: Heapsort." CACM 7(6):347–348, 1964.** The binary heap and heapsort.
- **CLRS, *Introduction to Algorithms*, 4th ed., §6 (Heapsort) + §6.5 (Priority queues).** Array
  layout (children 2i+1/2i+2), sift up/down, O(log n) ops, O(n) bottom-up build, the priority-queue role.
- **Sedgewick & Wayne, *Algorithms* 4th ed., §2.4** — https://algs4.cs.princeton.edu/24pq/

## The lens

- Heap property: every node ≤ its children ⇒ min at the root. Each op breaks it in one place and
  sifts the violation along one root-to-leaf path; complete tree ⇒ height ⌊log₂ n⌋ ⇒ O(log n) per op.
  Draining with n extract-mins = heapsort.

## Implementation note (this entry)

- Array-backed min-heap; insert (append + sift-up), extract-min (root out, last→root, sift-down).
  Sequence: insert n random values, then extract all. Tree viz (nodes positioned by level, edges by
  index) + the backing array + the sorted output row. Root green, sifting node blue, compared node
  orange. Custom tree draw.

## Verification

`tools/test-binary-heap.mjs` — **402 checks green** (100 runs, n=5–18):
1. **Heap property holds after every settled operation.**
2. **Extract-min drains in sorted order**; output is a **permutation of the inserts**.
3. The **root is always the minimum** of the live heap (settled frames).
4. Determinism; draw no-throw.

## Honesty notes

- Notes that bottom-up heapify is O(n) (vs O(n log n) by repeated insert), and that d-ary / pairing /
  Fibonacci heaps trade constants (faster decrease-key) — the binary heap is the simple, cache-friendly
  default, not universally optimal. Cross-links to Dijkstra/A* (its main consumers).
