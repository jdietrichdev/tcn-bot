import { ChatInputCommandInteraction, Client, Events } from "discord.js";
import { handleTest } from "./handlers/test";

const client = new Client({ intents: [] });

client.once(Events.ClientReady, (readyClient) => {
  console.log(`Bot logged in as ${readyClient.user.tag}`);
});

client.on(Events.InteractionCreate, async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  switch ((interaction as ChatInputCommandInteraction).commandName) {
    case "test": {
      handleTest(interaction);
      break;
    }
  }
});

client.login(process.env.BOT_TOKEN);
