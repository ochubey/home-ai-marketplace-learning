# Cost baseline and one optimization

One fixed scenario, one change, the same measurement before and after. The harness is in `scripts/cost/` (see its README). This document records what was measured, what it can and cannot show.

## Scenario

A fresh scratch repository with a 2-line greeting CLI. Step 1: `sdd-engineering:spec-creator` writes a spec for one fixed feature request (`scripts/cost/request.txt`). The harness then sets the spec status to `approved`, which stands in for the human approval. Step 2: `sdd-engineering:implementation-planner` plans the spec and returns the plan text. Each step is one headless `claude -p --model sonnet` call with the four plugins loaded from the working tree; the agents run on the models set in their own frontmatter (spec-creator and planner on opus). Cost and tokens come from the `total_cost_usd` and `modelUsage` fields of the JSON output.

Quality gate (`check-quality.mjs`, deterministic, no model judge): one new spec file with an ID, at least three acceptance criteria, a verification hint for each, an untrusted-inputs section, an AC for the 40-character limit and the failing exit status; a plan with a coverage table, a task with a test for every AC, and no repository changes by the planner.

## Baseline (5 runs, commit `a88c46a`)

| metric | min | median | max |
|---|---|---|---|
| cost per scenario (USD) | 0.290 | 0.376 | 0.388 |
| duration (s) | 28 | 67 | 73 |
| output tokens | 7,302 | 12,443 | 13,107 |
| cache-read tokens | 108,241 | 116,806 | 119,232 |
| cache-creation tokens | 34,251 | 36,535 | 36,901 |

By model, spec plus plan: sonnet 0.12 to 0.16 USD (median 0.157), opus 0.17 to 0.23 USD (median 0.220). Quality: 4 of 5 runs passed. In run 3 the planner returned no plan (cause not recorded; the raw file was lost, see below).

The raw per-run files of the baseline were lost before they were copied (they sat in a scratch folder that no longer existed when I looked). The numbers above are the summary the harness printed at the time; they can not be re-computed or re-graded. The "after" runs have their raw files.

## The one change

Lever: remove duplicated instructions from an agent prompt. In `spec-creator.md` the self-check repeated the rules for acceptance criteria and provenance that the prompt already states, and workflow step 2 repeated the provenance section. These were replaced by one self-check paragraph that points at the rules above. Net change: 827 to 813 words (14 words, roughly 20 tokens). Nothing else changed: same model, same routing, same scenario, same fixture, same request.

A review of the change found that one item, "no implementation details anywhere in the spec", had lost its spec-wide scope. It was restored afterwards (a few words). The measured "after" prompt is the variant without that sentence.

## After (5 runs, commit `2744874`)

| metric | min | median | max | change in median | verdict |
|---|---|---|---|---|---|
| cost per scenario (USD) | 0.269 | 0.407 | 0.475 | +8.1% | within noise |
| duration (s) | 26 | 71 | 84 | +5.9% | within noise |
| output tokens | 6,709 | 14,068 | 15,527 | +13.1% | within noise |
| cache-read tokens | 108,170 | 116,457 | 122,278 | -0.3% | within noise |
| cache-creation tokens | 32,938 | 37,468 | 46,935 | +2.6% | within noise |

"Within noise" means the min to max ranges of the two labels overlap. Quality: 3 of 5 runs passed.

## What this shows

- The optimization did not measurably change cost. This was expected: 14 words are about 20 tokens against a cached context of roughly 36,000 tokens per scenario. The sign of the median differences (cost up 8%) is not meaningful with five runs and ranges this wide.
- The gate does not say the change is safe. 3 of 5 against 4 of 5 is within what five runs can resolve. The two "after" failures were: run 2 failed the verification-hint check (probably the checker not recognizing the table the model wrote, see below), and run 5 produced no plan.
- No plan was produced in 2 of 10 runs (baseline run 3, after run 5), independent of the change. For the one run whose raw output survives (after run 5) the planner was not at fault: the spec written in step 1 still had two open `[NEEDS CLARIFICATION]` markers although the request said there were no open questions, the harness marked it `approved` anyway, and the planner refused, as its prompt requires, to plan a spec with open markers. An earlier note in this document blamed the planner's "single-agent or multi-agent" question; the saved output shows that was wrong. The cause of baseline run 3 can not be checked. The real finding is about `spec-creator`: it can leave non-blocking markers even when the caller says there are none. Whether to change that is a separate decision (a patch release, measured on its own).
- Real savings would have to come from a bigger lever than prompt wording, for example the model per agent or the size of the loaded context. Changing any of those is a different experiment; only one lever was changed here.

## Limits

- Five runs per label, one fixture, one request, one day. Run-to-run spread (cost 0.27 to 0.48) is larger than any effect this change can have.
- The planner step's cost varies by a factor of two depending on whether it produced a plan, which dominates the spread.
- The harness approves the spec status itself; a human reviewer step is not modeled.
- The quality gate is a set of regular-expression checks. A review found it can pass a spec it should fail and fail a correct one when the model uses a different format (numbered lists, tables, an arrow character). The checker was hardened after the runs; the runs above were graded by the earlier version, and the specs were not saved, so they can not be re-graded. Runs made with the current harness save the generated spec for re-grading.
- Baseline raw files are lost (see above).
- Costs are the figures the API returned for this account on the run day.

## Reproduce

```
node scripts/cost/run-scenario.mjs <label> 5 --out <dir>
node scripts/cost/summarize.mjs <dir> <label>
node scripts/cost/summarize.mjs compare <dir> <labelA> <labelB>
```

Each run costs about 0.4 USD. The runner refuses to write into a folder that already has files for the label.
