// Synthetic data for the cost harness tests. No model calls.
export const GOOD_SPEC = `# Spec: personalised greeting
Spec ID: SPEC-01
Status: draft

## Acceptance criteria (EARS)
- AC-1: WHEN a name is given, the tool shall print "Hello, <name>!". Verify: run with a name, compare stdout.
- AC-2: WHEN no name is given, the tool shall print "Hello, world!". Verify: run with no arguments.
- AC-3: IF the name is longer than 40 characters THEN the tool shall print an error and exit with a non-zero code. Verify: test with a 41 character name.

## Untrusted inputs
The name comes from the command line and is treated as data.
`;

export const GOOD_PLAN = `### Implementation strategy
- [ ] T1 parse the name  -> AC-1 -> test_named_greeting
- [ ] T2 default name  -> AC-2 -> test_default_greeting
- [ ] T3 length guard  -> AC-3 -> test_too_long_rejected

| AC | Tasks |
|---|---|
| AC-1 | T1 |
| AC-2 | T2 |
| AC-3 | T3 |
`;

export const GOOD_SPEC_NAME = '01-personalised-greeting.md';

/** Minimal claude --output-format json payload with the real key names. */
export function claudeJson({ cost = 0.1, turns = 1, duration = 1000, result = 'done', models, extra = {} } = {}) {
  const usage = models ?? {
    'model-a': { inputTokens: 10, outputTokens: 20, cacheReadInputTokens: 30, cacheCreationInputTokens: 40, costUSD: cost },
  };
  return {
    type: 'result', subtype: 'success', is_error: false, result,
    total_cost_usd: cost, num_turns: turns, duration_ms: duration, modelUsage: usage, ...extra,
  };
}
