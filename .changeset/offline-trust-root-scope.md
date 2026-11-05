---
"releaseproof": patch
---

Clarify that `--offline` only uses the cached Sigstore trust root; other registry,
source, image, dependency and staged Rekor requests can still use the network.
