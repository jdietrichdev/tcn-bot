import axios from "axios";
import { testCommands } from "./test-commands";
import { tcnCommands } from "./tcn-commands";

const BASE_URL = `https://discord.com/api/v10/applications/${process.env.APPLICATION_ID}`;
const headers = {
  Authorization: `Bot ${process.env.BOT_TOKEN}`,
  "Content-Type": "application/json",
};

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
console.log("Successfully update commands for test server");

axios
  .put(
    `${BASE_URL}/guilds/${process.env.TCN_GUILD_ID}/commands`,
    JSON.stringify(tcnCommands),
    { headers }
  )
  .then(() => console.log("TCN commands updated"))
  .catch((e) => {
    console.log("Failed to update test commands", e);
    throw e;
  });
console.log("Successfully updated commands for TCN server");
