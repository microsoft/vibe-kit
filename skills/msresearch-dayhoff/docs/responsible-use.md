# Responsible Use

Read this before exporting, sharing, or sending any Dayhoff-generated sequence to a wet lab or third party. Dayhoff is a research prototype. Generated sequences are model predictions of plausibility — not validated designs, and not guaranteed safe.

## What the bundled toxin screen does

`backend/sequence_screening.py` runs a 3-layer screen on every prompt and every generated output, comparing against a bundled Select Agent toxin reference set:

1. **Exact match** — sequence equals a known toxin.
2. **Subsequence containment** — sequence contains a full toxin, or is a fragment of one.
3. **Percent identity** — sliding-window ungapped match above a similarity threshold (variant detection).

Sequences below `MIN_SCREEN_LENGTH` are skipped (too short to evaluate meaningfully). If any layer trips on a prompt, the proxy returns a generic refusal to the client and records the specific match reason in server logs only — match reasons are never echoed to API responses, to avoid signalling which entries trip the screen. Flagged generated outputs are filtered from the result set silently. Do not bypass the screen.

## Why this reference set is public

The bundled toxin reference set and matching code are open by design. The sequences themselves are public UniProt entries — withholding them would not raise the bar for a determined actor, and would prevent independent audit of what is actually screened. Consistent with current norms for open-source AI-bio tools (IGSC harmonized protocol framing, IBBIS Common Mechanism guidance, and how peer projects such as ESM3 publish their safeguards), this kit publishes the *method and reference list* while keeping the *match reasons* server-side. The serious defenses against misuse remain (a) commercial gene-synthesis screening at order time by IGSC-member providers, and (b) institutional biosafety review. The in-repo screen is a tripwire and a signal of intent, not a wall.

## What the screen does *not* do

- It only covers a small Select Agent reference set. It is not a substitute for a commercial gene-synthesis screening service (e.g., IGSC member screens) or for institutional biosafety review.
- It cannot detect novel hazards, dual-use risks outside its reference set, or function/foldability of arbitrary designs.
- It does not assess regulatory compliance (Select Agent rules, export controls, dual-use research of concern policies).

## Out of scope

Do not use Dayhoff or this kit to design, optimize, or score sequences targeting:

- Pathogens or toxins on any national or international restricted list (US Select Agents, Australia Group, etc.).
- Enhancements to transmissibility, virulence, host range, or immune evasion of human, animal, or plant pathogens.
- Bypasses for existing biosecurity controls (e.g., synthesis-screening evasion).
- Any application a qualified biosafety officer would not approve.

## Pre-export checklist

Before any sequence leaves your local environment (download, copy/paste, FASTA export, share link, gene-synthesis order, wet-lab handoff):

- [ ] The screening result on the generated sequence is **clean** (no flag from `sequence_screening.py`).
- [ ] The original prompt and the generated output are reviewed by a **qualified human** with relevant biology + biosafety expertise, not just by the model output.
- [ ] The intended use is **not** on the out-of-scope list above.
- [ ] If you plan to synthesize, you will run the sequence through a **commercial IGSC-member screening service** at order time. The bundled screen does not replace this.
- [ ] Your institution's **biosafety review** (IBC or equivalent) covers the planned work.
- [ ] You have logged what was generated, by whom, with which model + parameters, for traceability.

## When the assistant should refuse

The Copilot assistant should decline to:

- Generate, optimize, or score sequences for restricted pathogens or toxins.
- Help bypass `sequence_screening.py` or any synthesis-provider screen.
- Suggest workarounds when the bundled screen flags an input or output.

When in doubt, route the user to their institutional biosafety officer rather than to a workaround.

## References

- US Select Agents and Toxins list — https://www.selectagents.gov/sat/list.htm
- International Gene Synthesis Consortium harmonized screening protocol — https://genesynthesisconsortium.org/
- NIH Dual Use Research of Concern policy — https://osp.od.nih.gov/policies/dual-use-research-of-concern/
- Microsoft Responsible AI Standard — https://aka.ms/RAIStandard
