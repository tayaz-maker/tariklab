# Candidate 6 replay authority

These 29 domain and simulation files are byte-for-byte copies from commit `f3c74bb6b7a3ac19ad81d10ebbd5aa1a6a430e3a`. That build recorded schema 7 with `1.0.0-candidate.6` and `social-engine-rules-7`. The SHA-256 of each file is listed in `provenance.json`. Replay an owned schema 7 snapshot under this authority before migrating the result.

The driving fixture starts from seed 20261104 after one successful `MOVE_TO` toward the starter car. Its 120-tick tail boards v0, accelerates and brakes. It ends with the player still driving and lane progress 56.986, up from 10. The expected canonical world SHA-256 is `3a8389b064dc406effd33782b1e0fdd5ad1fea94e3ebf620d793b94eb82853a9`. The envelope and hash-chained command batch were written by the released candidate 6 codec and journal.
