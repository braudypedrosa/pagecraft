# Additional native Hover and reload evidence

This addendum accepts nine further assertions without changing the prior 20-assertion candidate audit or its historical limitations.

Actual candidate tab 87 reports the target as both hovered and focused. It renders the copied green background (`rgb(49, 81, 61)`) with a 24px radius. The source is neither hovered nor focused and retains its resting Ink background with an 18px radius. The actual JPEG was opened and visually inspected: source is dark and target is green. This supplies the native interaction evidence absent from the earlier audit. The fixture has no Focus override, so the capture does not establish precedence between competing Hover and Focus rules.

After the native candidate reload, the supplied DOM record shows both original source and pasted target still render Ink (`rgb(36, 44, 39)`) with an 18px radius. This confirms those rendered resting values survive reload. It does not establish a newly exported whole-project persisted boundary, because no additional post-reload project export was supplied for this addendum.

The screenshot also contains an image-loading warning. That warning is outside this bounded style-copy acceptance and is not silently accepted as healthy preview imagery. Mobile, WordPress, deployment and full QA acceptance remain outside this evidence.

Run `python3 candidate-hover-reload-assertions.py` from this directory. `candidate-hover-reload-verdict.json` records the complete checks and input hashes. The independent auditor performed no browser actions or source changes.
