# Research notes — Conway's Game of Life

Provenance for the claims on this entry's page. Keep this honest: list what was
actually used, and flag anything uncertain.

## Key facts used
- **Origin:** Devised by John Horton Conway (Cambridge), 1969–70; popularized by
  Martin Gardner's "Mathematical Games" column, *Scientific American* 223(4),
  October 1970, pp. 120–123.
- **Rule:** B3/S23. Birth on exactly 3 neighbors; survival on 2 or 3. Moore
  neighborhood (8 cells), synchronous update.
- **Universality:** Proved via construction in Berlekamp, Conway & Guy,
  *Winning Ways for Your Mathematical Plays*, Vol. 2 (1982). Gliders as signals,
  glider collisions as logic, guns as clocks.
- **Glider gun:** Bill Gosper (and team) at MIT, 1970, built the first known
  infinite-growth pattern (the Gosper glider gun), winning Conway's \$50 prize.
  Period 30 — emits one glider every 30 generations.
- **Turing machine in Life:** Paul Rendell built and documented an explicit
  Turing machine (and later a universal one) in Life (~2000–2011).
- **Self-replication:** Universal constructor / self-replicating patterns have
  been built (e.g., Gemini, 2010, by Andrew Wade).

## Real-world connections (stated carefully)
- Life is a *toy*, not a biological model — the page says this explicitly.
- *Conus* sea-shell pigmentation patterns resemble 1D cellular automata
  (Wolfram, ANKOS; also Coombes & others on shell-pattern CA models). Stated as
  resemblance, not identity.
- Excitable media (cardiac tissue, Belousov–Zhabotinsky reaction) support
  travelling and spiral waves studied with CA / reaction models — analogy to
  glider propagation. Linked forward to the reaction-diffusion entry.
- Wolfram's *A New Kind of Science* (2002) — the strong "CAs model nature" claim
  is flagged as sweeping and contested, not endorsed.

## Sources
- Gardner, M. (1970). Scientific American 223(4):120–123.
- Berlekamp, Conway, Guy (1982). Winning Ways, Vol. 2. Academic Press.
- Rendell, P. (2011). A Turing Machine in Conway's Game of Life.
- LifeWiki — https://conwaylife.com/wiki/ (Game of Life; Gosper glider gun; Pulsar).
- Wolfram, S. (2002). A New Kind of Science. Wolfram Media.

## TODO / to verify on a later pass
- [ ] Confirm exact date/issue page numbers against a primary scan of the 1970 column.
- [ ] Double-check attribution detail on the Gosper team membership.
- [ ] Consider adding the "Life is omniperiodic" (2023 result: all periods exist) note.
