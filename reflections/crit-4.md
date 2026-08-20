# Crit 4 — Roundhouse

## What was the breakthrough that moved the work forward?

Realising the agent could not hear. It kept reporting the instrument as
working, and so did `pnpm check`: headless Chrome gives a real `AudioContext`
and no output device, so every timing claim was measured on the clock and
nothing at all was measured by ear. I stopped the build in the middle and gave
it a standing instruction — when something can only be settled by listening,
ask me and wait. The next thing I heard was the loop replaying my own groove
with none of the feedback a live hit gets. I can hear the sound different, but
I didn't hit any pads. Two causes, neither reachable by re-reading the code:
the ring that leaves your finger was drawn only on the live path, and the
playhead ran forty-nine milliseconds ahead of what you heard.

## What did this work change about who I want to be as a software developer?

I stopped writing prompts and started writing tooling. Two skills of my own now
sit in front of every deliverable: `pm-discovery`, which makes an agent
interview me as a product manager until the plan is unambiguous, and
`epic-dispatch`, which cuts that plan into dependency-tagged tasks and an
isolated worktree. Roundhouse was the first build where I wrote almost none of
the instrument — I specified it, then handed the tasks to Sonnet to execute.

The rule about listening is the one I have not finished. It worked, and it
still lives nowhere: I said it once, in the middle of a conversation that
ends. I want to be the kind of developer whose judgement lives in the harness
— a skill, a rule, a test of my own — rather than in a prompt that holds only
until the next task forgets it. I have that habit for what a check can catch.
What no check can catch, I am still carrying by hand.
