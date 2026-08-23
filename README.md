# The Night Garden

A living generative artwork in a single self-contained HTML file. Open
`index.html` in any browser — no build step, no dependencies.

Every night the garden is different: the scene is seeded from today's date,
the moon is drawn at its real current phase, and bioluminescent plants grow
from seed via recursive branching, swaying in a procedural wind. Fireflies
wander the dark and gather around open blooms. Occasionally a star falls.

## Interacting

- **Click anywhere** to plant a seed and watch it grow.
- **Press R** to regrow the whole garden from a fresh seed.

## Notes

- The moon phase is computed from the synodic month (29.530589 days) against
  a known new moon epoch, and rendered with a proper elliptical terminator —
  crescent, quarter, and gibbous shapes are all geometrically correct.
- Plants are recursive branch skeletons grown over time; wind sway
  accumulates along each limb so whole branches bend together.
- Respects `prefers-reduced-motion`: the garden renders fully grown and
  still, and clicks plant instantly.
