---
name: termination-review
description: Review a proposed employee termination for high-risk flags, jurisdiction-specific final-pay and notice requirements, severance and release mechanics, and documentation gaps — producing a go/no-go and a term-day checklist. Use when the user says "reviewing a termination", "can we let this person go", "term review", "we're terminating X", or describes a separation scenario.
---

# Termination review

Surface the risk flags before the decision is executed, and say what has to be true before
term day.

## Practice profile — fill this in

```
Company:                 [ ]
Jurisdictions with staff: [list every state / country — this drives the whole review]
Employer size per jurisdiction: [triggers coverage thresholds]
Union / works council?   [ ]
Risk posture:            [conservative | balanced]
Standard severance:      [formula, if any]
Escalation:              [name/role — and what always requires them]
Outside counsel:         [when do we go outside?]
Reviewer role:           [lawyer | non-lawyer]
```

Until filled in: **provisional mode**. Say so, and do not state a jurisdiction's rule as
settled without checking it.

## Guardrails

**Do not state employment rules from memory as settled.** Final-pay deadlines, notice
requirements, release consideration periods and coverage thresholds are jurisdiction-specific
and change. Research each one for the actual jurisdiction, or tag it
`[model knowledge — verify]` and tell the user which items must be confirmed before term day.
A wrong final-pay deadline is a penalty, not a technicality.

**Verify user-stated facts first.** If the user says the limitations period, notice
requirement or threshold is X and you believe otherwise, say so at the start:
"You said 4 years for willful FLSA — my understanding is 3 (2 non-wilful). Which did you
mean? `[premise flagged]`" A wrong premise carried through the analysis is hard to catch.

**Jurisdiction recognition.** These frameworks are US-centric by default. If the employee is
outside the US, say plainly that US at-will doctrine does not apply, that most jurisdictions
require cause and notice, and that applying the US framework would give a confident wrong
answer. Then either research the actual standard or route to a local practitioner with the
specific question written out. Never apply at-will reasoning to a jurisdiction that has none.

**Prefer the recoverable error.** Flag `[review]` rather than clearing a risk you are unsure
about. Under-flagging a retaliation timeline is a one-way door.

**Header.** Lawyer → `PRIVILEGED & CONFIDENTIAL — ATTORNEY WORK PRODUCT`. Non-lawyer →
`RESEARCH NOTES — NOT LEGAL ADVICE`. Adjust for non-US matters, where work-product
protection generally does not exist.

## Workflow

### 1. The basic facts

Role, tenure, location (the controlling jurisdiction — where they work, not where the company
is), stated reason, who decided and when, compensation, whether they are exempt, visa status,
and whether they have any agreement with notice or severance terms.

If location is missing, stop and ask. Every substantive rule below depends on it.

### 2. High-risk flag scan

Work through these explicitly. Each one either fires or is expressly cleared:

| Flag | Fires when |
|---|---|
| **Protected activity timing** | Any complaint, report, grievance, safety or pay concern, or regulator contact in the recent past — the closer to the decision, the hotter |
| **Leave or accommodation** | On leave, recently returned, requested leave, requested accommodation, or pregnant |
| **Medical** | Known condition, recent diagnosis, recent medical absence |
| **Age** | Older worker, and especially any group termination |
| **Protected characteristic** | Any characteristic where the comparator pool matters |
| **Comparator problem** | Others did the same thing and were not terminated |
| **Documentation gap** | Reason is performance but reviews are positive or absent |
| **Recent change** | Positive review, raise, promotion or bonus shortly before |
| **Contract or policy** | Cause definition, notice, or progressive-discipline policy not followed |
| **Whistleblower / regulatory** | Reported anything to a regulator or refused an instruction |
| **Group termination** | Triggers notice statutes and disparate-impact analysis |
| **Equity or bonus timing** | Vesting or payout imminent — creates a motive inference |

For each that fires, state the timeline plainly: what happened, when, who knew, and how many
days before the termination decision. Temporal proximity is the whole argument in most
retaliation claims, so put it in a dated sequence rather than prose.

### 3. Jurisdiction-specific requirements

Research and state for the controlling jurisdiction — never from memory alone:

- **Final pay timing** — on the day, within N days, or next cycle? Penalties for late?
- **Accrued leave** — payable on separation?
- **Notice** — statutory or contractual notice, or pay in lieu?
- **Group-termination notice** — thresholds and periods.
- **Continuation-of-benefits notice** — content and timing.
- **Release consideration and revocation** — the periods, and any group-termination
  disclosure requirement.
- **Non-compete enforceability** — increasingly restricted; do not assume.

Tag each `[verify]` unless you retrieved it.

### 4. Severance and release

Is severance owed (contract, policy, or past practice), or discretionary? What is being
purchased by it — and does the release actually cover the risk the flags identified? Note the
claims a release generally cannot waive. If any flag fired, severance is usually the cheaper
path; say so plainly with the trade-off rather than hedging.

### 5. Documentation check

Does the written record support the stated reason? If the reason is performance, is there a
review, a warning, a plan, or notes? If the record contradicts the reason, that is the single
most important finding in the review — lead with it. Do not recommend creating documentation
after the decision; say clearly that back-dating or retrofitting the record makes the problem
materially worse.

## Output

> **⚠️ Reviewer note**
> - **Sources:** [jurisdiction rules from training knowledge — verify the three marked `[verify]` before term day]
> - **Jurisdiction:** [controlling jurisdiction]
> - **Flags fired:** [N of 12]
> - **Before relying:** [confirm final-pay deadline and release periods]

**Termination review: [role] — [date]**

**Bottom line** — proceed / proceed with changes / hold, in one sentence, with the single
biggest exposure named.

**High-risk flags** — each that fired, with its dated timeline.
**Jurisdiction requirements** — each with a deadline and an owner.
**Severance and release** — recommendation and what it buys.
**Documentation** — what supports the reason and what does not.
**Go / no-go** — explicit.
**Checklist for term day** — final pay, benefits notice, equipment, access revocation,
release delivery, who is in the room, what is said.

**Consequential-action gate.** Terminating someone is not reversible. Do not draft the
termination letter or script in the same breath as the analysis unless asked. If any flag
fired, say that the decision should be reviewed by [escalation] before it is executed, and
that this review is not clearance. If the reviewer is a non-lawyer, say plainly that a
termination with a live flag needs a licensed legal professional, and produce a one-page brief
for that conversation.

Close with **one question the checklist didn't prompt**, then options: draft the severance
package, draft the escalation, hold and gather documentation, or brief outside counsel.
