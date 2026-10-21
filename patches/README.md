# Dependency security patches

## braces 3.0.3 — GHSA-vfj7-8cjw-p6xm

The registry's latest braces release is still 3.0.3, and the latest
`http-proxy-middleware`, `fast-glob`, and `micromatch` releases still depend on it.
The pnpm patch imposes a hard nesting limit of 128 on parsing and on the recursive
compile, expand, and stringify walkers, including callers supplying ASTs directly.
Excessive nesting raises a controlled `SyntaxError` rather than exhausting the
JavaScript call stack. Normal glob matching and expansion are unchanged.

The patch is installed for both the production proxy and the design sandbox.
Keep the patch until upstream releases a fix; then upgrade and remove it together.
Version-only dependency scanners may continue to flag 3.0.3 because applying a
source patch does not change its upstream version. Do not suppress the advisory
or relabel the package version to hide it.

Regression coverage lives in the application's dependency-security tests and runs
with its regular test suite.

After restoring cached or pre-provisioned `node_modules`, run those tests rather
than trusting the patched path name alone. If they still report `RangeError:
Maximum call stack size exceeded`, reinstall with
`CI=true pnpm install --frozen-lockfile --force` and rerun the tests. An ordinary
frozen install can report "Already up to date" while leaving stale, unpatched
files in place.

## postcss-selector-parser — GHSA-rj75-hqrm-r3gf

The latest `@tailwindcss/typography` release pins the vulnerable 6.0.10 parser.
A parent-scoped pnpm override selects patched 7.1.7 (the fix starts at 7.1.6).
The production build and a large-selector regression test verify compatibility.
Remove the override once typography depends on a patched release itself.
