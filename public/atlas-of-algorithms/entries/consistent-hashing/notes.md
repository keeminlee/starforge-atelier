# consistent-hashing — research notes & provenance

## Sources actually used (web-verifiable)

- **Karger, D. et al. "Consistent Hashing and Random Trees: Distributed Caching Protocols for
  Relieving Hot Spots on the World Wide Web." STOC 1997.** The original.
- **DeCandia, G. et al. "Dynamo: Amazon's Highly Available Key-value Store." SOSP 2007.** Consistent
  hashing + virtual nodes in production (→ Cassandra, Riak).
- **Lamping & Veach, "A Fast, Minimal Memory, Consistent Hash Algorithm" (jump hash), 2014;
  Thaler & Ravishankar, rendezvous/HRW hashing, 1998.** Variants.

## The lens (statistical guarantee — ADR-0005)

Keys + servers on a ring; key owned by next server clockwise. Adding/removing a server only reassigns
its arc ≈ K/n keys (vs `mod n`'s ≈ (n−1)/n). Each server owns ≈ 1/n of the ring in expectation;
**virtual nodes** (R replicas) average many arcs ⇒ load concentrates around K/n. Lookup O(log n).

## Implementation note (this entry)

- Ring in [0,1); R vnodes per physical server, keys + vnodes hashed (seeded). Owner = next vnode
  clockwise (wrap). Animates servers joining one at a time; keys that change owner are ringed white.
  Custom ring draw (points on a circle, vnode ticks, key dots colored by owner via an HSL categorical
  scale, legend with per-server load). Reports keyHash, vnodes, owner, load.

## Verification

`tools/test-consistent-hashing.mjs` — **125 checks green**:
1. **Ownership** matches an independent next-clockwise recompute; owners are valid servers.
2. **Minimal remapping:** removing a server moves ONLY its keys; the average remap fraction ≈ K/n
   (≈ 20% at n=5, within 0.07) and is **far below `mod n`** (≈ (n−1)/n).
3. **Load balance improves with more virtual nodes** (max−min load shrinks).
4. Determinism; draw no-throw.

## Honesty notes

- The "guarantee" is about *minimal movement on resize*, not lookup correctness — framed that way.
  Single-point-per-server imbalance is stated, with virtual nodes as the fix. Notes the trade-offs
  (O(log n) vs mod's O(1), metadata) and points to rendezvous (HRW) and jump consistent hash as variants.
