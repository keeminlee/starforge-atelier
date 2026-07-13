# The Justified Line

**A paragraph is one object.** Greedy line-breaking fills each line as far as it will
go and moves on — it cannot look ahead, because it has already committed. So a bad
break made at the second line is paid for at the ninth, by someone who was never
consulted.

Knuth–Plass (TeX, 1981) treats the whole paragraph as a **shortest-path problem**:
every legal break is a node, and dynamic programming finds the set of breaks that
minimises total demerits over the paragraph entire. It will deliberately make an
early line *worse* to save a later one.

It is a load-path for text. Badness distributes like stress, and the best solution
is the one where no single line carries more than it must.

Open **`the-justified-line.html`** and drag the column.

```
node build.mjs          # regenerate the page from break-core.mjs
node break-verify.mjs   # prove the paragraph holds
```

## The two exponents are the whole aesthetic

A line's **adjustment ratio** `r` says how hard you had to pull its spaces to make it
fit. Then:

- **badness = `100 · |r|³`** — cubed. A little stretch costs almost nothing; a lot is
  punished out of all proportion.
- **demerits = `(1 + badness)²`** — squared *again*. So the optimiser hates **one**
  terrible line far more than several mediocre ones.

That second exponent is why it spreads the load. It isn't a metaphor laid on top of
the algorithm; it is what those two exponents *do*.

## The claim is a theorem, not a taste

> **Optimal total demerits can never exceed greedy's.**

Both are scored on the same yardstick, and the dynamic program searches every legal
set of breaks. `break-verify.mjs` checks it exhaustively over a corpus at every column
width from 20 to 90, and again over 400 random paragraphs at random widths:

- **332 corpus (paragraph, width) pairs — zero violations.** Strictly better in 187;
  tied in 145 (the widths where greedy happens to land on the optimum — it does
  sometimes; it just cannot *know* that it has).
- **307 random paragraphs — zero violations.**
- **Every emitted line is feasible** — none overfull, none stretched past tolerance.
- Biggest gap found: greedy **23,747,614** demerits against the optimiser's **262**.
  Greedy committed early and one line downstream paid catastrophically for it.

Live in the browser, sweeping 40 column widths through the actual UI: **zero
violations**, largest gap **greedy 3,040,829 vs optimal 14**.

## Honest state

- **What it is not.** Real TeX **hyphenates**, which lets it break inside words; this
  breaks only at spaces. No widow/orphan penalties, no looseness parameter, no
  font-metric subtleties. Both algorithms are handicapped identically so the comparison
  stays fair — but this is the *essential idea*, not the whole of Knuth–Plass, and it
  does not claim to be.
- **The bug worth recording.** The lines overflowed the paper by 44px, because `.sheet`
  is `border-box` and its content box is narrower than the column I laid out to. Every
  number on the page was correct. **The numbers were all correct and all beside the
  point** — only *looking at it* found this. Same lesson as the rest of the night:
  a green check that cannot see the thing it is checking is not a check.
- **Zero dependencies.** Plain DOM; the page inlines the same engine the verifier checks
  headless, so the demo and the proof cannot drift apart.

*A Wright-HQ making. Structure is the standing interest — Gothic vaults, why a dome
doesn't fall — and a paragraph turns out to be a small frame that either distributes
its load or buckles.*
