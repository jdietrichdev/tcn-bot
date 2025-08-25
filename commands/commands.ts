import { PermissionFlagsBits, SlashCommandBuilder } from "discord.js";

export const hello = new SlashCommandBuilder()
  .setName("hello")
  .setDescription("Say hello to someone")
  .addUserOption((option) => {
    return option
      .setName("user")
      .setDescription("Who do you want to say hello to?")
      .setRequired(true);
  });

export const link = new SlashCommandBuilder()
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
          .setRequired(true)
          .setAutocomplete(true);
      });
  });

export const player = new SlashCommandBuilder()
  .setName("player")
  .setDescription("Interact with players")
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("add")
      .setDescription("Add player to team roster")
      .addStringOption((option) => {
        return option
          .setName("roster")
          .setDescription("Which roster should the player be added to")
          .setRequired(true)
          .setChoices([
            {
              name: "TCN Tyrants",
              value: "tyrants",
            },
          ]);
      })
      .addUserOption((option) => {
        return option
          .setName("user")
          .setDescription("Which player needs to be added")
          .setRequired(false);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("away")
      .setDescription("Set player away time")
      .addStringOption((option) => {
        return option
          .setName("startdate")
          .setDescription("First day you will be unavailable (04/03/2024)")
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName("enddate")
          .setDescription("Last day you will be unavailable (04/03/2024")
          .setRequired(false);
      })
      .addUserOption((option) => {
        return option
          .setName("user")
          .setDescription("Player who will be away")
          .setRequired(false);
      });
  });

export const event = new SlashCommandBuilder()
  .setName("event")
  .setDescription("Interact with events")
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("notify")
      .setDescription("Post message about upcoming event")
      .addStringOption((option) => {
        return option
          .setName("name")
          .setDescription("Name of event")
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName("message")
          .setDescription("Message to include with event")
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName("datetime")
          .setDescription("Date and time of event")
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName("timezone")
          .setDescription("Timezone for date/time (defaults to UTC)")
          .setRequired(false)
          .setChoices([
            { name: "Eastern Time (US)", value: "America/New_York" },
            { name: "Central Time (US)", value: "America/Chicago" },
            { name: "Mountain Time (US)", value: "America/Denver" },
            { name: "Pacific Time (US)", value: "America/Los_Angeles" },
          ]);
      })
      .addAttachmentOption((option) => {
        return option
          .setName("thumbnail")
          .setDescription("Thumbnail for event")
          .setRequired(false);
      });
  });

export const test = new SlashCommandBuilder()
  .setName("test")
  .setDescription("Test commands")
  .addSubcommand((subcommand) => {
    return subcommand.setName("demo").setDescription("Demo test command");
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName("string-input")
      .setDescription("Test string input with subcommand")
      .addStringOption((option) => {
        return option
          .setName("input")
          .setDescription("What should I say?")
          .setRequired(true);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand.setName("emoji").setDescription("Return an emoji");
  });
export const upgrade = new SlashCommandBuilder()
  .setName("upgrade")
  .setDescription("Show upgrade info for selected troop")
  .addStringOption((option) => {
    return option
      .setName("troop")
      .setDescription("Troop to get upgrade information for")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const apply = new SlashCommandBuilder()
  .setName("apply")
  .setDescription("Apply to join This Clan Now");

export const ro = new SlashCommandBuilder()
  .setName("ro")
  .setDescription("Create recruitment opportunity")
  .addStringOption((option) => {
    return option
      .setName("user")
      .setDescription("User ID to reach out to")
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName("notes")
      .setDescription("Notes about recruit")
      .setRequired(false);
  });

export const leadApply = new SlashCommandBuilder()
  .setName("lead-apply")
  .setDescription("Apply for leadership position with This Clan Now")
  .addStringOption((option) => {
    return option
      .setName("role")
      .setDescription("Role being applied for")
      .setRequired(true)
      .setChoices([
        {
          name: "General",
          value: "General",
        },
        {
          name: "Elder",
          value: "Elder",
        },
        {
          name: "Leader",
          value: "Leader",
        },
      ]);
  });

export const recruiterScore = new SlashCommandBuilder()
  .setName("recruiter-score")
  .setDescription("Score recruiters based on activity in channels")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const cwlRoster = new SlashCommandBuilder()
  .setName("cwl-roster")
  .setDescription("Send reminder for people not in correct clans for CWL")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("roster")
      .setDescription("Roster version to use")
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName("type")
      .setDescription("What type of notification do you want to send out?")
      .setRequired(true)
      .setChoices([
        { name: "Setup", value: "Setup" },
        { name: "Announcement", value: "Announcement" },
        { name: "Reminder", value: "Reminder" },
        { name: "Cleanup", value: "Cleanup" },
      ]);
  });

export const initiateCwlSignup = new SlashCommandBuilder()
  .setName("initiate-cwl-signup")
  .setDescription("Create new signup for CWL")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("name")
      .setDescription("Signup name")
      .setRequired(true);
  });

export const cwlQuestions = new SlashCommandBuilder()
  .setName("cwl-questions")
  .setDescription("Ask questions for CWL")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("name")
      .setDescription("Questionnaire name")
      .setRequired(true);
  });

export const closeTicket = new SlashCommandBuilder()
  .setName("close-ticket")
  .setDescription("Close current application ticket");

export const deleteTicket = new SlashCommandBuilder()
  .setName("delete-ticket")
  .setDescription("Delete current application ticket");

export const createEvent = new SlashCommandBuilder()
  .setName("create-event")
  .setDescription("Create a new event")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("name")
      .setDescription("Name of the event")
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName("type")
      .setDescription("Type of channel for event")
      .setRequired(true)
      .setChoices([
        { name: "Text", value: "Text" },
        { name: "Voice", value: "Voice" },
        { name: "Stage", value: "Stage" },
      ]);
  })
  .addStringOption((option) => {
    return option
      .setName("start")
      .setDescription("Start time in UTC (yyyy-mm-ddThh:mm")
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName("end")
      .setDescription("End time in UTC (yyyy-mm-ddThh:mm")
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName("description")
      .setDescription("Description for the event")
      .setRequired(false);
  })
  .addAttachmentOption((option) => {
    return option
      .setName("thumbnail")
      .setDescription("Thumbnail for the event")
      .setRequired(false);
  })
  .addUserOption((option) => {
    return option
      .setName("sponsor")
      .setDescription("Sponsor for the event")
      .setRequired(false);
  });

export const eventWinner = new SlashCommandBuilder()
  .setName("event-winner")
  .setDescription("Create winner for current event")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) => {
    return option
      .setName("winner")
      .setDescription("Winner for event")
      .setRequired(true)
  });
