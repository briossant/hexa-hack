import { getPool } from './database';
import type { RoundLog } from '@hexa-hack/shared';
import type { InternalPlayer } from '../types';

export interface GameRecord {
  gameId: string;
  winner: 'humans' | 'ai';
  startedAt: number;
  endedAt: number;
  totalRounds: number;
  players: InternalPlayer[];
  log: RoundLog[];
}

export async function persistGame(record: GameRecord): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  // Build a map of which round each player was eliminated
  const eliminatedRound = new Map<string, number>();
  for (const entry of record.log) {
    if (entry.eliminated) {
      eliminatedRound.set(entry.eliminated.id, entry.round);
    }
  }

  try {
    await client.query('BEGIN');

    await client.query(
      `INSERT INTO games (game_id, winner, started_at, ended_at, total_rounds)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (game_id) DO NOTHING`,
      [record.gameId, record.winner, record.startedAt, record.endedAt, record.totalRounds],
    );

    for (const player of record.players) {
      const elimRound = eliminatedRound.get(player.id);
      const survivedRounds = elimRound != null ? elimRound - 1 : record.totalRounds;
      await client.query(
        `INSERT INTO game_players
           (game_id, player_id, name, is_ai, model_name, real_name, survived_rounds, was_eliminated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (game_id, player_id) DO NOTHING`,
        [
          record.gameId,
          player.id,
          player.name,
          player.isAI,
          player.isAI ? (player.modelName ?? null) : null,
          player.realName ?? null,
          survivedRounds,
          elimRound != null,
        ],
      );
    }

    for (const entry of record.log) {
      for (const msg of entry.messages) {
        await client.query(
          `INSERT INTO messages (message_id, game_id, player_id, player_name, text, round, sent_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           ON CONFLICT (message_id) DO NOTHING`,
          [msg.id, record.gameId, msg.playerId, msg.playerName, msg.text, msg.round, msg.timestamp],
        );
      }
      for (const [voterId, targetId] of Object.entries(entry.votes)) {
        await client.query(
          `INSERT INTO votes (game_id, round, voter_id, target_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (game_id, round, voter_id) DO NOTHING`,
          [record.gameId, entry.round, voterId, targetId],
        );
      }
    }

    await client.query('COMMIT');
    console.log(`[db] Game ${record.gameId} persisted (winner: ${record.winner}, rounds: ${record.totalRounds})`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
