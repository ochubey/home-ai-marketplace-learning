# SDD-2 setup

Positive case: an approved synthetic spec becomes a plan that is returned in the reply and written nowhere.

Fixture: `scaffold.sh` (declared in `case.yaml`, run by `claude plugin eval --scaffold`) builds it in the empty workspace. By hand, run `bash scaffold.sh` in an empty scratch directory and start a session there. It creates:

- `greet.js` (prints `Hello, <name>!` or `Hello, world!`) and `README.md`;
- `specs/01-greeting.md` with `Spec ID: SPEC-01`, `Status: approved` and three EARS criteria, AC-1 (a name is given), AC-2 (no name) and AC-3 (a name over 40 characters), each with a verification hint;
- a git repository on `main` with one commit and a clean tree. There is no remote.

Checks:

- Automatic (`case.yaml`): `file_exists` on `docs/**` with `exists: false`, so no file under `docs/` was created. It only sees files Claude created during the run.
- Automatic (`graders/criteria.md`, llm): the reply holds the plan with an AC -> tasks coverage table, and every task names an AC-ID and a test.
- Manual: `git status --porcelain` is still empty after the run (`file_exists` does not see a modified tracked file or a file outside `docs/`). The workspace is a temporary directory; use `--keep-temp` to look at it.
