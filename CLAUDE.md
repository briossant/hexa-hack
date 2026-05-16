# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hexa-Hack** is a real-time multiplayer social deduction game (Werewolf-style) where human players try to identify AI-controlled players. It is also an AI benchmarking platform — every game is fully logged for analysis.

## Development Commands

### Docker (recommended for full stack)
```bash
docker compose up           # Start both backend and frontend
docker compose up --build   # Rebuild images before starting
```

### Backend (`/backend`)
```bash
npm install
npm run dev     # Hot reload via --watch (Node 20+)
npm start       # Production
```
Requires a `.env` file — copy from `.env.example` and set `OPENAI_API_KEY`.

### Frontend (`/frontend`)
```bash
npm install
npm run dev     # Vite dev server (proxies /socket.io → localhost:3001)
npm run build   # Production build (served by Nginx in Docker)
npm run preview # Preview production build locally
```

## Architecture

Two services communicate exclusively through Socket.io WebSockets. All game state lives in the backend.

```
frontend (React SPA, port 80)
    └─ socket.io-client ──► backend (Express + Socket.io, port 3001)
                                 └─ OpenAI API (AI player messages/votes)
```

In production (Docker), Nginx serves the built frontend and proxies `/socket.io` to the backend container.

### Backend (`backend/src/`)

| File | Role |
|------|------|
| `index.js` | Express + Socket.io server setup |
| `ws/handlers.js` | Socket.io event handlers: `queue:join`, `game:message`, `game:vote` |
| `matchmaking/queue.js` | Matchmaking queue; starts game when 4+ humans queue or 30s timer fires |
| `game/GameState.js` | Core state machine — phases, votes, eliminations, win conditions, game log |
| `ai/aiPlayer.js` | OpenAI API integration; generates AI messages and votes with randomized timing |

`GameState` is the heart of the backend. One instance per active game. It orchestrates the full game loop: `mayor_vote → discussion → vote → (next round)` until a win condition triggers. AI players have no socket connection — they are driven entirely by scheduled `setTimeout` calls inside `GameState` that call `aiPlayer.js`.

### Frontend (`frontend/src/`)

| File | Role |
|------|------|
| `App.jsx` | Root state: switches between Lobby and Game views based on `gameData` |
| `socket/index.js` | Singleton Socket.io client instance (imported everywhere) |
| `pages/Lobby.jsx` | Queue join UI, shows queue position |
| `pages/Game.jsx` | Main game view: phase/round tracking, chat, voting |
| `components/GameCircle.jsx` | Circular avatar layout with speech bubbles |
| `components/VotePanel.jsx` | Vote button UI |
| `components/Timer.jsx` | Phase countdown |

### WebSocket Event Contract

The full Socket.io event schema is documented in `/api/asyncapi.yml` (AsyncAPI 3.0). This is the authoritative reference for all events, their payloads, and directions (client→server / server→client).

Key events: `queue:join`, `game:start`, `phase:change`, `game:message`, `game:vote`, `vote:cast`, `mayor:elected`, `round:end`, `game:over`.

## Configuration

Backend is configured via environment variables (see `backend/.env.example`):

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Backend port |
| `OPENAI_API_KEY` | — | Required for AI players |
| `PIONEER_API_KEY` | — | Optional alternative AI provider |
| `PIONEER_BASE_URL` | — | Base URL for Pioneer API |
| `PLAYERS_PER_GAME` | `6` | Total players per game |
| `AI_COUNT` | `2` | Number of AI players per game |
| `DISCUSSION_TIME_MS` | `120000` | Discussion phase duration |
| `VOTE_TIME_MS` | `30000` | Vote phase duration |

## Game Rules (for context when modifying game logic)

- **Win condition (AI):** AI players ≥ human players remaining → AIs win
- **Win condition (humans):** All AI players eliminated → humans win
- **Phases per round:** Mayor vote → Discussion → Vote (elimination)
- **Mayor role:** Breaks vote ties; mayor transfers to next player if eliminated
- **AI scheduling:** AI messages fire 15–110s into discussion; AI votes fire 5–25s into vote phase
- **Matchmaking:** Game starts when queue reaches `PLAYERS_PER_GAME` humans, or after 30s with 1+ human (AI bots fill remaining slots)
