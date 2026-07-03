---
name: comment-writer
description: Add or update code comments in Python and JavaScript/TypeScript files. Use when asked to "add comments", "explain", "annotate", or "document" code, and apply these rules whenever writing new code. Produces sparse, plain-English comments — most lines get none.
---

# Comment Style

Comment because the code needs it, not to hit a ratio. Most lines need nothing.

## Language rules

- Do not remove comments in the code until asked specifically, but while generating code add comments WHERE REQUIRED explaining what and why in plain english — comments should feel like reading a friendly novel, no tech jargon, no heavy vocabulary. Even a non-tech person should be able to read a comment and understand what's happening and why.
- **Plain, casual English — like you're talking to a person.** If a comment uses words a non-programmer friend wouldn't understand, it's failed. Tech jargon makes comments as unreadable as the code they're trying to explain. Write the way you'd say it out loud.
- **Explain the why, not the what.** "Format Indian phone numbers to include country code +91 before saving to database" — not "convert phone."
- **Self-contained.** Never write "same as above", "see line 42", or "like we did for Campaigns." Each comment stands on its own.
- **Use `#` for Python, `//` for JS/TS.** Multi-line = stacked `#`/`//`. Never docstrings or `/* */` blocks.

### Casual vs jargon — read these out loud

Jargon (bad):
```python
# Coalesce nullable fields and propagate the resolved value downstream
# Instantiate the handler and invoke the lifecycle hook
# Memoize the computed property to mitigate redundant re-evaluation
```

Casual (good — sounds like a person talking):
```python
# If the value is missing, treat it as zero so the math doesn't blow up
# Set up the handler and kick off the first run
# Save the result so we don't redo the same work every time
```

The test: if you read the comment out loud to a smart friend who doesn't code, would they nod or would they ask "what does that word mean?" If they'd ask — rewrite it.

## When to comment

Skip the comment if a competent reader could guess the intent from the code. Add one when something is non-obvious: a business rule, a platform quirk, a workaround, a default with a reason, a unit or scale that isn't visible from the code, a choice that looks wrong but is intentional.

Comment-worthy:
```python
# Indian SME phone numbers often start without +91 or are missing the country code,
# so we validate and format them to prevent calling failures.
if not is_valid_indian_phone(phone):
    raise ValidationError(...)
```

Leave alone:
```python
queryset = Customer.objects.filter(...)
serializer = CustomerSerializer(queryset, many=True)
return Response(serializer.data)
```

## Put comments next to what they explain

When code has multiple branches or sections that each need explaining, don't pile all the explanations into one giant comment at the top. Put each comment directly above the branch it describes. The reader sees the explanation right when they need it, instead of scrolling up and mapping "case 2" onto the right `if`.

Bad — one big block at the top, reader has to keep cross-referencing:

```javascript
// Watches the latest calling simulation session — handles three cases:
//   1) It's still pending → make sure polling is running so we'll notice when it finishes.
//   2) It just turned into failed → stop polling, drop the text into the input, show a toast (once).
//   3) The one we were waiting on turned into completed → stop polling, the transcript is already in localTranscripts.
// This same effect also handles page reloads: if you reload while a call is mid-flight,
// we pick it up here and resume polling. If you reload after a failure, we restore the state.
useEffect(() => {
    if (!sessionDetail?.calls) return
    const lastCall = sessionDetail.calls[sessionDetail.calls.length - 1]
    if (!lastCall) return

    if (lastCall.status === 'pending') { ... }
    if (lastCall.status === 'failed') { ... }
    if (lastCall.status === 'completed' && ...) { ... }
}, [sessionDetail])
```

Good — short header sets the scene, each branch carries its own story right where you read it:

```javascript
// React to status changes on the latest call in the current campaign.
// Also recovers state on page reload — resumes polling for mid-flight calls,
// or displays an error if the call failed so the user knows.
useEffect(() => {
    if (!sessionDetail?.calls) return
    const lastCall = sessionDetail.calls[sessionDetail.calls.length - 1]
    if (!lastCall) return

    // Still waiting on a connection — keep polling on so we notice when it answers
    if (lastCall.status === 'pending') { ... }

    // Call failed to connect — let's display a toast warning the user
    if (lastCall.status === 'failed') { ... }

    // Call successfully answered and completed — turn off polling
    if (lastCall.status === 'completed' && ...) { ... }
}, [sessionDetail])
```

The function-header comment still does its job (what does this effect do overall?), but the *per-branch* details now live next to the branches. Each comment can be read in isolation without needing the header.

## Pass labels for multi-step code

When a function does 3+ distinct steps in sequence, label each one with `# --- name pass ---`. Name the behavior, not the mechanism ("validation pass", not "loop through fields pass"). Add an explanation line below only if the label doesn't carry the whole story.

```python
# --- validation pass ---
...

# --- formatting pass ---
# Standardize all phone numbers to Indian E.164 format and filter duplicates
...

# --- database insert pass ---
...
```

## Function and class headers

1–2 lines above the definition explaining what it does and why it exists. Skip if the name already says it all (`get_username()` needs nothing; `_format_and_dedupe_customers()` does).

```python
# Parses and cleans CSV rows of Indian phone numbers and customer details,
# ensuring phone validation and converting tags list to comma-separated text.
def _format_and_dedupe_customers(...):
```

## Existing comments

Keep ones with real context. Rewrite ones with jargon or "see above" references. Delete ones that just restate the code.
