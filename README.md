# Hackathon Paris — Hunt the Bot

## Concept

A social deduction game where players must identify and eliminate the AIs hidden among them before the AIs reach parity with the humans.

Inspired by Werewolf, but with a twist: instead of hidden roles hunting at night, all players (humans and AIs alike) discuss openly and vote to eliminate one player per round. The challenge for humans is to spot who is an AI through conversation alone — a real-time Turing test.

As a secondary dimension, the game serves as an AI benchmark: different models can be pitted against each other to see which ones are hardest to detect, how long they survive, and what behavioral patterns give them away.

---

## Game Rules

### Setup
- A lobby of players is created, with more humans than AIs (exact ratio determined through playtesting).
- At the start of the game, a **mayor** is elected through a dedicated vote round. The mayor's only power is to break ties during elimination votes. Any player — human or AI — can be elected mayor.

### Each Round
1. **Discussion phase**: All players discuss freely via text messages. A timer limits this phase (around 2-3 minutes).
2. **Vote phase**: Each player votes to eliminate one other player (30 seconds). Votes are public and visible to everyone.
3. **Elimination**: The player with the most votes is eliminated. In case of a tie, the mayor decides.
4. The eliminated player's identity (human or AI) is revealed.

### Win Conditions
- **Humans win** if all AIs are eliminated.
- **AIs win** if the number of AIs still in the game is equal to or greater than the number of humans remaining.

### Night Phase (optional, to be tested)
A night phase may be added where AIs can secretly eliminate a human between rounds, closer to the original Werewolf format. Both modes will be playtested to determine which is more fun and balanced.

---

## UI

A webapp with:
- Players displayed as avatars arranged in a circle.
- The local player's avatar anchored at the bottom of the circle.
- Each message a player sends appears as a speech bubble above their avatar.
- A visible vote history panel showing who voted for whom each round.
- A round timer displayed prominently during discussion and vote phases.

---

## AI Benchmark Dimension

Every game is logged with structured data:
- Which AI model played each bot role
- Full message history per round
- Vote choices per player per round
- Whether each AI was caught and in which round

This allows comparison across models: which ones blend in longest, which behavioral patterns betray them, and how detection rates change as players get more experienced.

---

## Open Questions / To Playtest
- Optimal human-to-AI ratio
- Discussion phase duration
- Whether the night phase improves or complicates the experience
- AI prompting strategy (passive blending vs. active misdirection)
