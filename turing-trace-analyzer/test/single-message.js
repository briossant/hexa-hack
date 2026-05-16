import "dotenv/config";
import { analyzeMessage } from "../src/analyzeBotPattern.js";

const sample = {
  playerId: "player_3",
  round: 1,
  message:
    "I do not have enough information to accuse anyone yet. I think we should wait and observe more before voting.",
};

const result = await analyzeMessage(sample);
console.log(JSON.stringify(result, null, 2));
