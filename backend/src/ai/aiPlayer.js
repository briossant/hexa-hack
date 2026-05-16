const OpenAI = require('openai');

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const pioneerClient = process.env.PIONEER_API_KEY
  ? new OpenAI({
      apiKey: process.env.PIONEER_API_KEY,
      baseURL: process.env.PIONEER_BASE_URL,
    })
  : null;

function getClient(modelName) {
  if (modelName?.startsWith('pioneer-') && pioneerClient) return pioneerClient;
  return openaiClient;
}

async function generateAIMessage(aiPlayer, messageHistory, allPlayers) {
  const recentMessages = messageHistory.slice(-15);
  const conversation = recentMessages.map((m) => `${m.playerName}: ${m.text}`).join('\n');
  const otherNames = allPlayers
    .filter((p) => p.isAlive && p.id !== aiPlayer.id)
    .map((p) => p.name)
    .join(', ');

  try {
    const client = getClient(aiPlayer.modelName);
    const res = await client.chat.completions.create({
      model: aiPlayer.modelName || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are playing a social deduction game called "Hunt the Bot". Your name is ${aiPlayer.name}.
Your goal is to blend in as a human player and avoid being detected as an AI.
Other players: ${otherNames}.
Rules: be natural and conversational, react to what others say, have opinions, make occasional hesitations.
Keep messages short (1-2 sentences). Never reveal you are an AI. Don't be too formal or perfect.`,
        },
        {
          role: 'user',
          content: conversation
            ? `Current conversation:\n${conversation}\n\nYour next message as ${aiPlayer.name}:`
            : `The discussion just started. Write a short opening message as ${aiPlayer.name}:`,
        },
      ],
      max_tokens: 80,
      temperature: 0.9,
    });
    return res.choices[0].message.content.trim();
  } catch (err) {
    console.error('AI message failed:', err.message);
    return 'hmm, not sure what to think yet...';
  }
}

async function generateAIVote(aiPlayer, alivePlayers) {
  // Simple strategy: vote for a random human
  const humans = alivePlayers.filter((p) => !p.isAI && p.id !== aiPlayer.id);
  if (humans.length === 0) return null;
  return humans[Math.floor(Math.random() * humans.length)].id;
}

module.exports = { generateAIMessage, generateAIVote };
