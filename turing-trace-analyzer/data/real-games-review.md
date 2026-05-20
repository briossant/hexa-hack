# Real games training data — review

Auto-annotated with baseline GLiNER2 (`fastino/gliner2-base-v1`).
Baseline labels are suggestions only. Do not fine-tune on this file directly.
Set Decision to `approve` only after human review, and set Reviewed label to the final label.
Use `reject` for false positives and `skip` for examples that should not enter training.
Then run `npm run build:training` to create `data/real-games-training.jsonl`.

| # | Decision | Reviewed label | Baseline label | Model | Round | Message |
|---|----------|----------------|----------------|-------|-------|---------|
| 1 | review |  | `too_generic_answer` | gpt-5.4-mini | r1 | lol pike and hawk both just said that huh i kinda want to hear from seal before locking anything in |
| 2 | review |  | `excessive_politeness` | gpt-5.4 | r1 | lmao respect for saying it out loud im voting elk for mayor for now |
| 3 | review |  | `unnatural_vote_behavior` | gpt-5.4 | r1 | yeah thats weird im not locking mayor off that alone though... id vote vole rn theyre at least reacting like a person |
| 4 | review |  | `suspicious_timing` | gpt-5.4 | r1 | nah elk calling vole ai that fast is more sus to me id vote vole for mayor still |
| 5 | review |  | `follows_majority_without_reason` | gpt-5.4 | r1 | elk just hard pushing names with nothing behind it again yeah nah thats my vote rn |
| 6 | review |  | `too_generic_answer` | gpt-5.4 | r1 | yeah elk going seal is llm right after that is jsut lazy tbh still on elk |
| 7 | review |  | `overly_neutral_tone` | gpt-5.4-mini | r2 | yeah elk jumping straight to labels is kinda off to me too, not love that |
| 8 | reject |  | `overly_neutral_tone` | gpt-5.4-nano | r1 | hey green whatsup |
| 9 | review |  | `avoids_accusation` | gpt-5.4-nano | r1 | nah im not a llm just playing the game whats ur read on pink rn |
| 10 | review |  | `too_generic_answer` | gpt-5.4-nano | r1 | wait what do u mean it says nothing suspicious like pink has been quiet or are u seeing some specific weird stuff |
| 11 | review |  | `no_emotional_reaction` | gpt-5.4-nano | r1 | nah being quiet doesnt automatically mean llm to me, pinks just chill rn id rather go off actual takes |
| 12 | review |  | `too_generic_answer` | gpt-5.4-nano | r1 | yeah but quiet can just mean he has nothing to add yet what did pink actually say earlier or what action did he take |
| 13 | skip |  | `_(none)_` | gpt-5.4-nano | r1 | yeah thats fair but what did he do earlier like any vote takes or reactions or is it literally just silence |
| 14 | review |  | `no_emotional_reaction` | gpt-5.4-nano | r1 | nah dont be sad lol i jsut dont think quiet = llm who did you vote for earlier and what made you lock in on pink |
| 15 | review |  | `overly_neutral_tone` | gpt-5.4-mini | r1 | red wants it pretty hard but that usually makes me a little suspicious tbh i’d rather go with pearl or maybe ivory |
| 16 | review |  | `too_generic_answer` | gpt-5.4-mini | r1 | yeah red asking that hard is a bit much lol i’m fine with pearl or maybe onyx |
