import axios from "axios";
import { commands } from "./commands";
import { testCommands } from "./test-commands";

const BASE_URL = `https://discord.com/api/v10/applications/${process.env.APPLICATION_ID}`;
const headers = {
  Authorization: `Bot ${process.env.BOT_TOKEN}`,
  "Content-Type": "application/json",
};
axios
  .put(`${BASE_URL}/commands`, JSON.stringify(commands), { headers })
  .then(() => console.log("Commands updated"))
  .catch((e) => {
    console.log("Failed to update commands", e);
    throw e;
  });

axios
  .put(
    `${BASE_URL}/guilds/${process.env.TEST_GUILD_ID}/commands`,
    JSON.stringify(testCommands),
    { headers }
  )
  .then(() => console.log("Test commands updated"))
  .catch((e) => {
    console.log("Failed to update test commands", e);
    throw e;
  });
