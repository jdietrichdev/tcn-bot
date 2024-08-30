import { SlashCommandBuilder } from "discord.js";

const helloCommand = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("Say hello to someone")
  .addUserOption((option) => {
    return option
      .setName("user")
      .setDescription("Who do you want to say hello to?")
      .setRequired(true);
  });

const linkCommands = new SlashCommandBuilder()
  .setName("link")
  .setDescription("Link/Unlink discord to Clash of Clans account")
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("create")
      .setDescription("Create link to Clash of Clans account")
      .addStringOption((option) => {
        return option
          .setName("tag")
          .setDescription("Player tag")
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName("token")
          .setDescription("API token from settings")
          .setRequired(true);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("remove")
      .setDescription("Remove link to Clash of Clans account")
      .addStringOption((option) => {
        return option
          .setName("tag")
          .setDescription("Player tag")
          .setRequired(true);
      });
  });

// const playerCommands = new SlashCommandBuilder()
//   .setName("player")
//   .setDescription("Interact with players")
//   .addSubcommand((subcommand) => {
//     return subcommand
//       .setName("add")
//       .setDescription("Add player to team roster")
//       .addStringOption((option) => {
//         return option
//           .setName("roster")
//           .setDescription("Which roster should the player be added to")
//           .setRequired(true)
//           .setChoices([
//             {
//               name: "TCN Tyrants",
//               value: "tyrants",
//             },
//           ]);
//       })
//       .addUserOption((option) => {
//         return option
//           .setName("user")
//           .setDescription("Which player needs to be added")
//           .setRequired(false);
//       });
//   })
//   .addSubcommand((subcommand) => {
//     return subcommand
//       .setName("away")
//       .setDescription("Set player away time")
//       .addStringOption((option) => {
//         return option
//           .setName("startdate")
//           .setDescription("First day you will be unavailable (04/03/2024)")
//           .setRequired(true);
//       })
//       .addStringOption((option) => {
//         return option
//           .setName("enddate")
//           .setDescription("Last day you will be unavailable (04/03/2024")
//           .setRequired(false);
//       })
//       .addUserOption((option) => {
//         return option
//           .setName("user")
//           .setDescription("Player who will be away")
//           .setRequired(false);
//       });
//   });

// const eventCommands = new SlashCommandBuilder()
//   .setName("event")
//   .setDescription("Interact with events")
//   .addSubcommand((subcommand) => {
//     return subcommand
//       .setName("notify")
//       .setDescription("Post message about upcoming event")
//       .addStringOption((option) => {
//         return option
//           .setName("name")
//           .setDescription("Name of event")
//           .setRequired(true);
//       })
//       .addStringOption((option) => {
//         return option
//           .setName("message")
//           .setDescription("Message to include with event")
//           .setRequired(true);
//       })
//       .addStringOption((option) => {
//         return option
//           .setName("datetime")
//           .setDescription("Date and time of event")
//           .setRequired(true);
//       })
//       .addStringOption((option) => {
//         return option
//           .setName("timezone")
//           .setDescription("Timezone for date/time (defaults to UTC)")
//           .setRequired(false)
//           .setChoices([
//             { name: "Eastern Time (US)", value: "America/New_York" },
//             { name: "Central Time (US)", value: "America/Chicago" },
//             { name: "Mountain Time (US)", value: "America/Denver" },
//             { name: "Pacific Time (US)", value: "America/Los_Angeles" },
//           ]);
//       })
//       .addAttachmentOption((option) => {
//         return option
//           .setName("thumbnail")
//           .setDescription("Thumbnail for event")
//           .setRequired(false);
//       });
//   });

export const commands = [
  helloCommand,
  linkCommands,
  // playerCommands,
  // eventCommands,
];
