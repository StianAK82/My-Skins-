# Classic texture quality test protocol

## Running the manual suite

The prompts and empty scorecards are in
`artifacts/api-server/quality-tests/classic-texture-suite.json`. Run them only
against a configured database and OpenAI integration. For each case create a
directory named with the case ID and save `request.json` (original prompt),
`enhanced.json`, `final-prompt.txt`, `raw-model.png`, `final-585x559.png`,
`front.png`, `back.png`, and `result.json` (generation time, retry count, model
metadata, scores, average, and problems). Never substitute fabricated output.

Review the same final PNG used by preview, download, and upload. Score realism,
UV placement, front/back consistency, sleeve/leg consistency, fabric detail,
construction, text accuracy (use `null` when not applicable), and overall
usability from 1–5. The average excludes `null`. Record visible problems in
plain language.

Image generation models can misspell or distort even explicitly constrained
text. Text accuracy therefore remains a manual score and a known limitation.

