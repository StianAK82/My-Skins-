# AI Creative Intelligence

## Product objective

My Skins must compete with an excellent character concept artist and fashion
designer, not with an asset picker. A child writes one sentence; the system must
invent a memorable, original direction before Roblox implementation constraints
are applied.

The first production slice changes the active `/api/ai/generate` flow from one
design attempt into a taste-driven funnel. The breadth is adaptive: a focused
request such as "white hoodie" uses three candidates and one finalist, while an
open request such as "make the coolest knight" uses eight candidates and three
finalists.

1. Interpret the request and the desired emotional response for ages 8–12.
2. Generate three to eight deliberately different, silhouette-first concepts.
3. Give every concept a story and exactly one dominant hero element.
4. Use an independent taste-jury prompt to select and improve three finalists.
5. Compare finalists using private preference signals across eight dimensions.
6. Select the winner deterministically with product-owned weighting.
7. Send the winning art direction into the existing outfit builder.
8. Preserve the canonical validation, Roblox compiler, review, and repair layers
   as safety rails after the creative decision.

Revisions intentionally skip concept divergence. A request such as "make only the
wings larger" must preserve the chosen design instead of initiating a new concept
competition.

## Design principles

- **Silhouette first:** large shapes are decided before surface detail.
- **One hero element:** every design has one dominant memory hook.
- **Visible storytelling:** story must be evident in wear, forms, materials, and
  symbols rather than existing only in prose.
- **Child delight:** power, magic, motion, contrast, and controlled exaggeration
  are evaluated for the target audience.
- **Taste over completeness:** generic costume checklists and detail everywhere
  are explicitly penalized.
- **Originality:** references may inform abstract principles but must not reproduce
  protected logos, exact costumes, signature symbols, or character identity.
- **Implementation follows design:** registry availability is not allowed to shape
  the initial concepts. Unsupported details must be disclosed during construction,
  never silently replaced with a generic garment.

## Internal preference, not a skin quality score

The jury emits private comparison signals. They are combined with server-owned
weights only to order candidates in the same generation:

| Dimension                    | Weight |
| ---------------------------- | -----: |
| Prompt faithfulness          |    20% |
| Child wow                    |    20% |
| Silhouette strength          |    14% |
| Hero-element strength        |    14% |
| Storytelling                 |    10% |
| Originality                  |     9% |
| Roblox thumbnail readability |     8% |
| Buildability                 |     5% |

Faithfulness and delight dominate. Buildability remains visible but cannot force a
strong concept into an existing generic asset.

These values are deliberately not exposed in the API response, persisted as a
quality claim, or shown to the child. The API only exposes:

- number of generated concepts;
- number of evaluated finalists;
- selected concept ID and title;
- whether focused or exploratory concept generation was used;
- compact finalist identities; and
- the complete selected creative direction.

The final skin uses categorical states instead of a creative number:

- `CHECKING`
- `NEEDS_REPAIR`
- `READY`
- `MANUAL_REVIEW`
- `UNSUPPORTED`

The current synchronous endpoint returns `READY`, `NEEDS_REPAIR`, or `UNSUPPORTED`.
`CHECKING` and `MANUAL_REVIEW` are reserved for the asynchronous multi-view review
flow. Internal preference signals must never be merged with geometry or export
validity.

`UniversalOutfitSpec.quality` remains in the compatibility contract for the
existing compiler and clients, but Creative Intelligence does not expose a new
numeric rating and `finalSkinStatus` is derived from explicit failure conditions,
unsupported state, and carry-through evidence—not from the numeric aggregate.

## Design carry-through

Describing a good concept is not enough. After the winner is sent to the builder,
the service verifies that the structured result contains evidence of:

- the selected palette;
- the hero element; and
- the selected silhouette or material direction.

If evidence is missing, the builder receives one focused repair request. If the
repaired plan still loses the direction, the result is `NEEDS_REPAIR` rather than
being presented as ready.

This gate proves that direction survives into structured materials, design
elements, modules, placement, accessories, custom parts, and universal items. It
does not prove that the rendered mesh visually matches the concept; that requires
the planned multi-view vision benchmark.

The permanent benchmark manifest is
`artifacts/api-server/quality-tests/creative-intelligence-suite.json`. It covers a
knight, ordinary clothing, princess, pirate, robot, football kit, and an original
spider-inspired hero. Every case requires front and back evidence; relevant cases
also require silhouette, large forms, material treatment, color blocking,
ornament, asymmetry, and hero-element evidence. The spider-inspired case explicitly
requires absence of protected logos and exact costume reproduction.

## North-star measurement: Child Wow Rate

Offline and production evaluation should measure **Child Wow Rate**: the percentage
of safe, consented evaluations where the target audience prefers the My Skins
result and describes it as exciting, memorable, or better than expected.

The evaluation protocol should use blind A/B comparisons and keep these metrics
separate:

- first-generation preference;
- prompt faithfulness;
- hero-element recall after a delay;
- silhouette recognition at thumbnail size;
- originality and visual coherence;
- design-to-build fidelity;
- Roblox export success;
- regeneration rate; and
- share/save rate.

Internal model preference is useful for candidate selection, but only blind human
preference can validate taste. No "world's best" claim should be made until My
Skins wins a preregistered benchmark against strong external baselines.

## Next implementation slices

1. Persist creative metrics and anonymized user preference feedback by model and
   prompt cohort.
2. Add blind A/B evaluation tooling and a fixed, versioned creative benchmark.
3. Replace fixed garment-kind construction with a safe parametric operation graph:
   profile, loft, extrude, bend, mirror, repeat, shell, bevel, cutout, attach, and
   material zones.
4. Add material graphs for base color, roughness, metalness, normal, emissive, and
   controlled wear.
5. Generate Roblox classic artwork per UV zone rather than reusing one square image
   on every garment surface.
6. Make multi-view vision review mandatory before a generation can receive visual
   acceptance.
