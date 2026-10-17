# 30-day rollout plan

How the four plugins (`engineering-paved-path`, `research-tools`, `architecture-review`,
`sdd-engineering`) move from "published" to something a team relies on. The plan has four stages,
a gate between each, and one way back. It assumes a small team with one marketplace owner; role names
below are roles, not people.

## Roles

| Role | Does | Today |
|---|---|---|
| Marketplace owner | Merges to `main`, tags releases, moves the `stable` branch, decides every gate | repository owner |
| Plugin owner | Owns one plugin's content and evals (see CODEOWNERS) | repository owner |
| Pilot users | Use the plugins on real work and report problems | to be named at day 1 |
| Reviewer | Second pair of eyes on gate decisions | to be named; none exists yet |

A gate decision needs the marketplace owner plus one other person. Until a second person exists, the
owner records the decision and the evidence in the rollout log (below) and the team treats the gate as
provisional.

## Stages

The names follow the stage ladder from the course: experimental, opt-in, approved, default-on, required.
This plan covers the first three and ends with a decision about the fourth; "required" is out of scope.

| Days | Stage | Who | What happens |
|---|---|---|---|
| 1-7 | Experimental (internal) | owner and pilot users | Install from the main channel. Run the five evals by hand. Collect problems. Fix forward with patch releases. |
| 8-14 | Opt-in | any team member who asks | Publish the install instructions (README and the catalog site). Keep the `stable` channel pinned to the last verified release. Support by issue. |
| 15-21 | Approved | the whole team may use it | Announce it as the recommended workflow for new features. Add the marketplace to project settings of the pilot repositories so installation is prompted. |
| 22-30 | Decision | owner and reviewer | Review the evidence and decide: stay approved, make default-on for selected repositories, or pause. |

## Gates

A gate passes only if every line is true. A line that cannot be checked counts as not passed.

### Gate 1 (day 7, experimental to opt-in)

- All four plugins pass `claude plugin validate`, the validator and the test suite on `main`.
- The five behavior evals were run by hand against the released version; results are in the rollout log.
  The negative cases (SDD-3, SDD-4) passed. A failing negative case blocks the stage.
- Install into a project that has no local copy of the agents works, and `claude plugin list --json`
  shows no unsatisfied dependency.
- The rollback procedure in `RELEASES.md` was rehearsed on the release being promoted.
- No open problem of severity high (data loss, wrong files written, a commit or push the agent was
  told not to make).

### Gate 2 (day 14, opt-in to approved)

- At least three real features went through the full chain (spec, plan, implement, verify) by people
  other than the owner, or, if there are fewer users, the owner states why the sample is small.
- The fraction of runs that end without a plan is below the level the owner accepts (baseline measured:
  2 of 10; the one cause that could be checked was a spec left with open `[NEEDS CLARIFICATION]` markers;
  the target is written down at day 1).
- Cost per scenario is within the range recorded in `COST-BASELINE.md`, or the difference is explained.
- Every problem reported in the opt-in stage has an owner and either a fix or a documented workaround.

### Gate 3 (day 21, approved to decision)

- No high-severity problem is open.
- Two consecutive releases went out without a rollback.
- The documentation matches the behavior: a new user installed from the README without help.

## Metrics

This marketplace has no usage telemetry and the site has no backend, so install counts and download
statistics do not exist and are not invented. What can be measured:

| Metric | How | Where |
|---|---|---|
| Behavior eval pass rate | Run the five cases by hand per release | rollout log |
| Cost and duration per scenario | `scripts/cost/run-scenario.mjs`, five runs | `COST-BASELINE.md` |
| Planner delivered a plan | Quality gate of the same harness | `COST-BASELINE.md` |
| Features that used the full chain | Specs and plans in the pilot repositories | pilot repositories |
| Problems reported, time to fix | Issue tracker of this repository | issues |
| Rollbacks performed | Count of stable-channel installs after an upgrade | rollout log |

## Rollback path

Follow `RELEASES.md`, section Rollback: add the stable channel, uninstall the bad version, install from
the stable channel, run `claude plugin prune -y`, check `claude plugin list --json`. The stable branch is
moved forward only to a release that passed Gate 1 and was smoke-checked. After a rollback the fix ships
as a new patch version, never as a re-used number.

A rollback is triggered by any of: data loss, an agent writing outside its allowed boundary, a commit or
push the agent was told not to make, a plugin that fails to load after an update. The owner may roll
back first and investigate after.

## Communication

- Day 1: announce the experimental stage to the pilot users with install steps and where to report.
- Day 8: announce the opt-in stage; link the catalog site.
- Day 15: announce approval; list known limits (see below).
- Day 30: publish the decision and the evidence.

## Known limits to state in every announcement

- The implementer's "do not commit or push" rule is a prompt rule, not enforced by the tool list.
- Calling an agent of another plugin through `run-plan` is documented as untested.
- The minimum Claude Code version is not confirmed; the plugins were tested with 2.1.302.
- The cost experiment was small (five runs per label) and its quality gate is approximate.
- A spec can be written with open `[NEEDS CLARIFICATION]` markers even when the request says there are none; the planner then correctly refuses to plan it until the markers are resolved.

## Rollout log

Keep one entry per gate: date, who decided, evidence (links to eval results, cost summary, issues),
decision. Store it in this file under a new heading when the first gate is reached.
