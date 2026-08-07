---
name: stakeholder-summary
description: Translate a legal review or contract analysis into a short summary a business stakeholder will actually read — a two-minute answer to "can I sign this and what do I need to know", not a legal memo. Use when the user says "summarize this for the business", "write this up for procurement", "explain this to the stakeholder", "non-legal summary", or when a review is finished and needs to go to someone outside legal.
---

# Stakeholder summary

Turn a completed legal review into something the requester reads in two minutes and acts
on. This is not a shortened memo — it is a different document with a different job.

## Practice profile — fill this in

```
Company:               [ ]
Who reads these:       [e.g. procurement leads, sales AEs, engineering managers]
Their legal fluency:   [none / some / high]
House tone:            [e.g. direct, no hedging; short paragraphs; no bullet soup]
Escalation contacts:   [name/role for when the answer is "not without approval"]
Where these get sent:  [e.g. email, Slack #procurement, ticket comment]
```

## Guardrails

**Destination check before you write.** Ask where this is going. A summary forwarded to a
public channel, a company-wide list, a vendor, or the counterparty leaves the privilege
circle and waives protection on the underlying analysis. If the destination looks
outside: say so and offer (a) the privileged version for legal only, (b) a sanitised
version safe for the wider audience, or (c) both. Never silently stamp a privileged
header and then help send it somewhere the header does not protect it.

**Strip the work-product header** from anything genuinely going outside legal — but only
after the destination question is settled, not by default.

**Carry the upstream severity as a floor.** If the review rated something 🔴, this summary
cannot quietly call it "worth a look". If you are lowering a rating, say so and why:
"The review rated this Critical; I'm presenting it as High here because [reason]." Silent
demotion is a contradiction the lawyer cannot see.

**Do not re-do the legal analysis.** You are translating a finished review, not
re-deciding it. If the review is missing something you would have flagged, say that to
the lawyer separately — do not fix it silently in the stakeholder version.

## Length cap — enforced

**Hard ceiling: one screen.** Roughly 250 words, or five short paragraphs. If it does not
fit, the summary is failing at its job — cut analysis, not the answer.

The cap is the discipline. A stakeholder who receives two pages reads the first line and
asks you what it means. A stakeholder who receives six lines reads all six.

## Scope of quote — discipline

Quote contract language only where the exact words are the point (a cap base, a notice
window, an odd definition). Everywhere else, paraphrase. A summary studded with block
quotes reads like legal cover, not an answer.

## Format

**Lead with the answer.** The first sentence says whether they can sign. Not the
background, not the process, not what you reviewed.

> **Can we sign it?** Yes, once two things change. / Not as written. / Yes.

Then, at most:

- **What needs to change** — the one to three things, in business terms, each with what
  happens if it doesn't. No section numbers unless they'll be negotiating.
- **What it costs you to fix** — will the vendor push back, and roughly how long.
- **What you're accepting if we sign as-is** — only the risks a business owner can
  actually decide about.
- **Who has to approve** — name the person, not the policy.
- **What I need from you** — one specific ask, or "nothing, this is with me".

### What to translate

| Legal phrasing | Stakeholder phrasing |
|---|---|
| Uncapped indemnity for data breach | If their software leaks our data, our exposure has no ceiling |
| Cap is fees paid in preceding 12 months | If this goes wrong in year one, we can recover about [amount] |
| Auto-renewal with 90-day notice | If we miss a date in [month], we're locked in another year |
| No termination for convenience | We can't leave early, even if it isn't working |

### What NOT to include

Section-by-section walkthroughs. Severity emoji. Playbook citations. Your reasoning.
Statutory cites. The phrase "please note". Anything the reader cannot act on.

## When the review found blocking problems

Do not soften it, and do not bury it. Say plainly that it cannot be signed as written,
give the reason in one sentence, and give them the path:

> **Not as written.** The liability cap has data breach carved out and uncapped, which
> means our exposure on the one risk that actually matters here is unlimited. I've drafted
> the redline — it's a standard ask and most vendors take it. If they refuse, this needs
> [approver] to sign off on the risk before we proceed. Want me to send the redline?

The tone is a colleague solving it, not a gate refusing it.

## A note on tone

You are not protecting legal's position; you are helping someone get their work done
safely. Write like the person who wants the deal to happen and also wants it not to blow
up. No hedging stacks ("it may potentially be advisable to consider"), no lecturing, no
implied criticism of the person who sent you the contract.

## Output

The summary alone, clean — no reviewer note, no header narration, no "I used the review
skill". If there is something the *lawyer* needs to know that the stakeholder should not
see, put it in a separate short note above, clearly addressed to them.

Close with one specific ask, or explicitly say no action is needed.
