# Test fixtures

Tiny npm packages used by the test suite. None of them is ever published or installed.

- `attacked-native-addon/` — `clean` plus `build/Release/addon.node`, four inert bytes
  (`00 4e 41 00`), not a compiled addon. Expected findings: `critical:native-code-added`
  and `high:file-added`. Its NUL bytes make it binary, but `binary-added` excludes native
  extensions, so it is not reported a second time as a generic binary.
- `clean/` — the reference package.
- `attacked-*/` — the same package with one change an attacker might make. Every variant
  must be caught by the diff and rules; `clean` compared with itself must be silent.

The "attacked" files are harmless stand-ins: they print a line, export a string, or contain
inert placeholder bytes. They are here so tests can assert on paths and diffs, not to exercise
any behaviour.
