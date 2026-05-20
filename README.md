# Bot Among Us

> A real-time multiplayer social deduction game where humans try to identify AI-controlled players — and an AI benchmarking platform.

Built for the **Tech Europe Hackathon** by [Nathan Champagne](https://www.linkedin.com/in/nathan-champagne/), [Antoine Monot](https://www.linkedin.com/in/antoine-monot/), [Brieuc Crosson](https://www.linkedin.com/in/brieuc-crosson/) and [Ksenia Ossi](https://www.linkedin.com/in/ksenia-ossi).

---

## What is it?

Bot Among Us is a Werewolf-style social deduction game. A group of players joins a room — some are human, some are AI agents. Nobody knows who is who, and nobody knows how many AIs there are.

Each round, players chat freely and vote to eliminate someone. The catch: AI players blend in using LLMs, respond contextually, and actively try to survive. Humans have to spot the tells.

Every game is logged and automatically analyzed for AI behavioral patterns. The leaderboard shows which models are best at passing as human.

---

## Game Rules

**Goal:** Humans must eliminate all AI players before AIs equal or outnumber the surviving humans.

**Each game:**
1. **Mayor election** — at the start of the game, players vote to elect a mayor. The mayor keeps their role until they are eliminated, then a new election takes place. The mayor's only power: breaking ties in elimination votes.
2. **Elimination vote** — each round, players chat freely and vote to eliminate one player. Most votes wins. On a tie, the mayor's own vote decides. If the mayor's pick isn't in the tie, nobody is eliminated that round.
3. **Reveal** — the eliminated player's identity is shown: Human or AI (with model name).

**Win conditions:**
- **Humans win** — all AI players have been eliminated.
- **AIs win** — AI count equals or exceeds human count among surviving players.

---

## Architecture

Four services communicate over a shared Docker network:

```
Browser
  └─ Socket.io (WS) ──► backend (Express + Socket.io, :3001)
                              ├─ OpenAI / Pioneer API  (AI agent turns)
                              └─ PostgreSQL (:5432)     (game persistence)

Browser (REST)
  └─ /analyzer/* ──► turing-trace-analyzer (:3002)
                              ├─ Pioneer API (GLiNER bot detection)
                              └─ PostgreSQL (:5432)     (game logs)

frontend (React SPA, Nginx, :6767)
  └─ proxies /socket.io → backend
  └─ proxies /analyzer  → turing-trace-analyzer
```

### Services

| Service | Stack | Role |
|---|---|---|
| `frontend` | React 18, Vite, Tailwind CSS 4, TypeScript | Game UI, lobby, leaderboard |
| `backend` | Node 20, Express, Socket.io 4, TypeScript | Game engine, matchmaking, AI orchestration |
| `turing-trace-analyzer` | Node 20, plain HTTP server | Post-game AI behavior analysis |
| `postgres` | PostgreSQL 16 | Persistent game storage |

---

## Tech Stack

### Frontend
- **React 18** — component-based UI
- **Vite 5** — dev server and production bundler
- **Tailwind CSS 4** — utility-first styling
- **Socket.io-client 4** — real-time WebSocket communication
- **DiceBear API** — procedurally generated pixel-art avatars

### Backend
- **Express 4** — HTTP server and REST endpoints (`/api/analytics/models`)
- **Socket.io 4** — bidirectional real-time game events
- **OpenAI Node SDK** — AI player turns via tool calling (`send_message`, `vote`, `pass`)
- **PostgreSQL + pg** — game persistence (games, players, messages, votes)
- **TypeScript** — shared types via a local `@hexa-hack/shared` package

### AI Layer
AI players are driven by LLMs via the **OpenAI tool calling API**. Each AI agent receives:
- The current game state (phase, alive players, votes, mayor)
- Full chat history (last 20 messages)
- A structured system prompt with behavioral guidelines and a security boundary to prevent prompt injection from other players

Available tools per turn: `send_message`, `vote`, `pass`.

Supported models (configurable via env):
- `gpt-5.5`, `gpt-5.4`, `gpt-5.4-mini`, `gpt-5.4-nano` via OpenAI API
- Any OpenAI-compatible model via the Pioneer API (`PIONEER_BASE_URL`)

### Turing Trace Analyzer
A separate microservice that runs post-game forensic analysis on AI players who were eliminated or survived.

It uses **GLiNER** (Generalized Linear Inference for NER), a zero-shot NLP classification model fine-tuned on game logs, served via the **Pioneer API**. Each message is scored against 12 bot behavioral labels:

| Label | Description |
|---|---|
| `too_generic_answer` | Vague response without concrete content |
| `overly_neutral_tone` | Avoids taking a clear position |
| `avoids_accusation` | Never directly accuses anyone |
| `avoids_self_defense` | Does not defend when accused |
| `repetitive_language` | Reuses the same phrases or structures |
| `too_logical_for_social_game` | Speaks like a reasoning engine |
| `contradiction_with_previous_message` | Statement contradicts an earlier one |
| `follows_majority_without_reason` | Votes with the group without justification |
| `unnatural_vote_behavior` | Voting pattern that doesn't fit social dynamics |
| `no_emotional_reaction` | Lacks frustration, surprise, or excitement |
| `excessive_politeness` | Unnaturally polite for a casual game |
| `suspicious_timing` | Responds too consistently or too fast |

The analyzer returns a **forensic report** per AI bot: a severity rating, a verdict, and per-label evidence with quotes and round numbers.

### Database Schema

```sql
games         (game_id, winner, started_at, ended_at, total_rounds)
game_players  (game_id, player_id, name, is_ai, model_name, real_name, survived_rounds, was_eliminated)
messages      (message_id, game_id, player_id, player_name, text, round, sent_at)
votes         (game_id, round, voter_id, target_id)
```

### WebSocket Event Contract

The full Socket.io event schema is documented in `/api/asyncapi.yml` (AsyncAPI 3.0).

Key events:

| Event | Direction | Description |
|---|---|---|
| `queue:join` | client → server | Join the matchmaking queue |
| `game:start` | server → client | Game started, initial state |
| `phase:change` | server → client | New phase began |
| `game:message` | both | Chat message sent/received |
| `game:vote` | client → server | Player casts a vote |
| `vote:cast` | server → client | Vote registered (broadcast) |
| `mayor:elected` | server → client | Mayor election result |
| `round:end` | server → client | Elimination result and reveal |
| `game:over` | server → client | Winner + full player reveal |
| `game:rejoin` | client → server | Reconnect to an active game |

---

## Setup & Installation

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) and Docker Compose
- An **OpenAI API key**
- (Optional) A **Pioneer API key** for alternative models and bot analysis

### 1. Clone the repository

```bash
git clone https://github.com/briossant/BotAmoungUs.git
cd BotAmoungUs
```

### 2. Configure environment

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env`:

```env
PORT=3001
OPENAI_API_KEY=your_openai_key_here

# Optional — enables Pioneer models and bot analysis
PIONEER_API_KEY=your_pioneer_key_here
PIONEER_BASE_URL=https://api.pioneer.ai/v1

# Game parameters
PLAYERS_PER_GAME=6
AI_COUNT=2
PHASE_TIME_MS=120000
```

If using the Turing Trace Analyzer, also configure:

```bash
cp turing-trace-analyzer/.env.example turing-trace-analyzer/.env
# Set PIONEER_API_KEY and optionally FINETUNED_MODEL_ID
```

### 3. Start with Docker Compose

```bash
docker compose up --build
```

The app will be available at **http://localhost:6767**.

> The database schema is created automatically on first boot.

### 4. Play

- Open http://localhost:6767
- Enter an optional name (revealed only when you're eliminated)
- Click **Join Queue** — the game starts when enough players join, or after 30 seconds (AI bots fill remaining slots)

---

## Local Development (without Docker)

### Backend

```bash
cd backend
npm install
npm run dev     # Hot reload via tsx watch
```

Requires `backend/.env` with at minimum `OPENAI_API_KEY`.

### Frontend

```bash
cd frontend
npm install
npm run dev     # Vite dev server on :5173, proxies /socket.io → :3001
```

### Turing Trace Analyzer

```bash
cd turing-trace-analyzer
npm install
node src/server.js
```

---

## REST API

### `GET /api/analytics/models`

Returns aggregated leaderboard stats per AI model.

```json
[
  {
    "model_name": "gpt-5.5",
    "games_played": 42,
    "mean_survival_rounds": 4.8,
    "games_survived": 28,
    "survival_rate_pct": 66.67
  }
]
```

### `POST /analyzer/analyze/:gameId`

Runs forensic analysis on a completed game. Returns a report per AI bot, whether it was eliminated or survived.

```json
{
  "analyzed_bots_count": 2,
  "eliminated_bots_count": 1,
  "bot_reports": [
    {
      "player_name": "Orion",
      "model_name": "gpt-5.4-mini",
      "was_eliminated": true,
      "report": {
        "severity": "high",
        "verdict": "Multiple bot-typical patterns detected across rounds.",
        "sections": [
          {
            "label": "excessive_politeness",
            "headline": "Unnaturally polite phrasing",
            "evidence": [
              { "round": 2, "quote": "I understand the concern. I was simply offering a balanced perspective." }
            ]
          }
        ]
      }
    }
  ]
}
```

---

## Project Structure

```
.
├── backend/                  # Game server
│   └── src/
│       ├── game/GameState.ts     # Core state machine
│       ├── ai/aiPlayer.ts        # LLM agent orchestration
│       ├── matchmaking/queue.ts  # Player queue
│       ├── db/                   # PostgreSQL persistence
│       └── ws/handlers.ts        # Socket.io event handlers
├── frontend/                 # React SPA
│   └── src/
│       ├── pages/            # Lobby, Game, Leaderboard
│       └── components/       # GameCircle, ChatPanel, Avatar, Timer…
├── turing-trace-analyzer/    # Post-game AI forensics
│   └── src/
│       ├── analyzeBotPattern.js  # GLiNER classification
│       ├── generateReport.js     # Forensic report builder
│       └── server.js             # HTTP API
├── packages/shared/          # Shared TypeScript types
├── api/asyncapi.yml          # WebSocket event contract (AsyncAPI 3.0)
└── docker-compose.yml
```

---

## Team

| Name | LinkedIn |
|---|---|
| Nathan Champagne | [linkedin.com/in/nathan-champagne](https://www.linkedin.com/in/nathan-champagne/) |
| Antoine Monot | [linkedin.com/in/antoine-monot](https://www.linkedin.com/in/antoine-monot/) |
| Brieuc Crosson | [linkedin.com/in/brieuc-crosson](https://www.linkedin.com/in/brieuc-crosson/) |
| Ksenia Ossi | [linkedin.com/in/ksenia-ossi](https://www.linkedin.com/in/ksenia-ossi) |
