export function getAnalyzableBots(gameData) {
  return gameData.players.filter((p) => p.is_ai);
}

export function buildAnalysisInput(gameData, suspectedPlayerId) {
  const target = gameData.players.find((p) => p.player_id === suspectedPlayerId);
  if (!target) throw new Error(`player ${suspectedPlayerId} not in game`);

  const messagesByRound = groupBy(gameData.messages, (m) => m.round);
  const votesByRound = groupBy(gameData.votes, (v) => v.round);

  const rounds = [];
  const roundNumbers = [...new Set(gameData.messages.map((m) => m.round))].sort((a, b) => a - b);

  for (const round of roundNumbers) {
    rounds.push({
      round,
      messages: (messagesByRound.get(round) ?? []).map((m) => ({
        player: m.player_name,
        text: m.text,
      })),
      votes: (votesByRound.get(round) ?? []).map((v) => ({
        from: nameFromId(gameData.players, v.voter_id),
        to: nameFromId(gameData.players, v.target_id),
      })),
    });
  }

  return {
    game_id: gameData.game.game_id,
    suspected_player: target.name,
    suspected_player_id: target.player_id,
    model_name: target.model_name,
    ground_truth_is_bot: target.is_ai,
    rounds,
  };
}

function nameFromId(players, id) {
  return players.find((p) => p.player_id === id)?.name ?? id;
}

function groupBy(arr, keyFn) {
  const map = new Map();
  for (const item of arr) {
    const k = keyFn(item);
    if (!map.has(k)) map.set(k, []);
    map.get(k).push(item);
  }
  return map;
}
