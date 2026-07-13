# The Weaver's Loom

**Weave to specification.** There is no picture to copy. You are told what the cloth
must *be* — real weaving properties — and you drive a four-shaft loom until it is.

Open **`weavers-loom.html`**. Set the tie-up, set the treadling, watch the cloth.

```
node build.mjs          # regenerate the page from weave-core.mjs
node weave-verify.mjs   # prove the engine AND prove the puzzle
```

## What happened to v1 (and why the filed fix was wrong)

v1 showed a target cloth and asked you to set the tie-up that reproduced it. A critic
found it trivial and it was **demoted**: with the threading and the treadling both
given, the answer tie-up was literally the target's top-left 4×4 corner. You copied
what was on the screen. Two of its four "levels" even shared the same answer.

The redesign filed in the bronze was *"use a non-straight threading."*
**That fix does not work,** and proving it is what produced v2.

A drawdown is `tieup[treadling[r]][threading[c]]` — a rank-4 factorisation with every
factor visible. So:

> **Given any two of {threading, tie-up, treadling}, the third is recoverable by
> inspection — for arbitrary drafts, not just straight draws.**

Checked by exhaustion over 4,600+ random valid drafts: recovered **100%** of the time
(`weave-verify.mjs` §1). A non-straight threading creates no deduction; it only
permutes *which cells you read*. **"Reproduce the target" is transcription by
construction.** The frame was broken, not the levels — so v2 leaves the frame.

## What v2 is

No cloth is shown. Each level is a **specification** — computed weaving properties —
and the loom is judged against it:

- **Float length.** A float is a run where one thread stays on top. Long floats snag
  and wear; a 6-float is not usable cloth. This is the most physical constraint in
  weaving, and it is pure combinatorics.
- **Warp fraction.** How much of the face is warp — balanced, or warp-faced.
- **The twill diagonal.** Each row's lift is the row before, shifted one shaft — *and*
  the lifts must be four distinct vectors, not two alternating ones. (My first version
  of this test called plain weave a twill, because `[1,0,1,0]` shifted by one really
  *is* `[0,1,0,1]`: mathematically a 1/1 twill. No weaver calls it one, because the
  shift closes after two rows and no wale is ever visible. The test caught me.)
- **Shafts and treadles earning their keep.** An idle shaft is a shaft you didn't need.

## Honest state

- **The puzzle is real, and it is machine-checked** (`weave-verify.mjs`). For every
  level it proves: satisfiable; that it **admits many structurally distinct cloths** —
  so there is no single right picture, and nothing to copy even in principle; and that
  it **genuinely rejects**, over 99.9% of possible drafts failing.

  | level | solutions | distinct cloths | drafts that pass |
  |---|---|---|---|
  | Plain Weave | 7,728 | 2 | 0.046% |
  | A True Twill | 96 | 4 | 0.001% |
  | Warp-Faced, and Nothing Snags | 576 | 24 | 0.003% |
  | Cloth That Holds Together | 2,112 | **88** | 0.013% |

  (Exhaustive over all 65,536 tie-ups × all 256 period-4 treadlings. Players may use
  longer treadlings, so these are honest *lower bounds*.)

- **The acceptance criterion in the bronze is met** — and met by a route the bronze did
  not propose, because the route it *did* propose is provably broken.

- **Where it is weakest.** *Plain Weave* admits only two distinct cloths (the two
  phases), so it scrapes a bar the others clear easily. *Cloth That Holds Together*
  (88 cloths) is the one that is most genuinely a search.

- **What I still cannot tell you: whether it is FUN.** I have proved it is a *genuine*
  puzzle. That is not the same as proving it is a *good* one, and my evidence for the
  second is much thinner. It plays — I solved three levels by hand through the UI — but
  whether the search is satisfying or merely fiddly wants a person. Same shape as the
  Carillon: check what is checkable, and say plainly where the checking stops.

- **Zero dependencies.** Plain DOM, no canvas, no network. The page inlines the same
  engine the verifier checks headless, so the game and the proof cannot drift apart.

*A Wright-HQ making — the one that was taken down, and then earned its way back against
a criterion written before the attempt.*
