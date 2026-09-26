---
name: OBD report evidence policy
description: Why extracted scanner candidates are stored separately from reportable diagnostic evidence
---

The original scanner file and unreviewed extraction candidates may remain in the inspection record for audit. Buyer-facing interpretation should use manual entries or human-accepted extracted codes only when the extraction has adequate confidence and its original file is still present. An unlabeled historical structured code is not automatically assumed to be a manual entry.

**Why:** Earlier submissions did not retain reliable manual/AI provenance. Treating missing provenance as confirmed would silently convert a machine-generated candidate into a RideChecker observation; deleting the candidate would discard potentially useful original evidence. This deliberately favors a limited report over false certainty.

**How to apply:** Whenever diagnostic data takes a new path into report generation or a schema evolves, preserve the raw evidence while enforcing the same confirmation/provenance boundary before Claude, PDF, risk language, or repair context. Keep test-performed scope distinct from extracted-code review status.