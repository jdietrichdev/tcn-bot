import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

export const hello = new SlashCommandBuilder()
  .setName('hello')
  .setDescription('Say hello to someone')
  .addUserOption((option) => {
    return option
      .setName('user')
      .setDescription('Who do you want to say hello to?')
      .setRequired(true);
  });

export const link = new SlashCommandBuilder()
  .setName('link')
  .setDescription('Link/Unlink discord to Clash of Clans account')
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('create')
      .setDescription('Create link to Clash of Clans account')
      .addStringOption((option) => {
        return option
          .setName('tag')
          .setDescription('Player tag')
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName('token')
          .setDescription('API token from settings')
          .setRequired(true);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('remove')
      .setDescription('Remove link to Clash of Clans account')
      .addStringOption((option) => {
        return option
          .setName('tag')
          .setDescription('Player tag')
          .setRequired(true)
          .setAutocomplete(true);
      });
  });

export const player = new SlashCommandBuilder()
  .setName('player')
  .setDescription('Interact with players')
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('add')
      .setDescription('Add player to team roster')
      .addStringOption((option) => {
        return option
          .setName('roster')
          .setDescription('Which roster should the player be added to')
          .setRequired(true)
          .setChoices([
            {
              name: 'TCN Tyrants',
              value: 'tyrants',
            },
          ]);
      })
      .addUserOption((option) => {
        return option
          .setName('user')
          .setDescription('Which player needs to be added')
          .setRequired(false);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('away')
      .setDescription('Set player away time')
      .addStringOption((option) => {
        return option
          .setName('startdate')
          .setDescription('First day you will be unavailable (04/03/2024)')
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName('enddate')
          .setDescription('Last day you will be unavailable (04/03/2024')
          .setRequired(false);
      })
      .addUserOption((option) => {
        return option
          .setName('user')
          .setDescription('Player who will be away')
          .setRequired(false);
      });
  });

export const event = new SlashCommandBuilder()
  .setName('event')
  .setDescription('Interact with events')
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('notify')
      .setDescription('Post message about upcoming event')
      .addStringOption((option) => {
        return option
          .setName('name')
          .setDescription('Name of event')
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName('message')
          .setDescription('Message to include with event')
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName('datetime')
          .setDescription('Date and time of event')
          .setRequired(true);
      })
      .addStringOption((option) => {
        return option
          .setName('timezone')
          .setDescription('Timezone for date/time (defaults to UTC)')
          .setRequired(false)
          .setChoices([
            { name: 'Eastern Time (US)', value: 'America/New_York' },
            { name: 'Central Time (US)', value: 'America/Chicago' },
            { name: 'Mountain Time (US)', value: 'America/Denver' },
            { name: 'Pacific Time (US)', value: 'America/Los_Angeles' },
          ]);
      })
      .addAttachmentOption((option) => {
        return option
          .setName('thumbnail')
          .setDescription('Thumbnail for event')
          .setRequired(false);
      });
  });

export const test = new SlashCommandBuilder()
  .setName('test')
  .setDescription('Test commands')
  .addSubcommand((subcommand) => {
    return subcommand.setName('demo').setDescription('Demo test command');
  })
  .addSubcommand((subcommand) => {
    return subcommand
      .setName('string-input')
      .setDescription('Test string input with subcommand')
      .addStringOption((option) => {
        return option
          .setName('input')
          .setDescription('What should I say?')
          .setRequired(true);
      });
  })
  .addSubcommand((subcommand) => {
    return subcommand.setName('emoji').setDescription('Return an emoji');
  });
export const upgrade = new SlashCommandBuilder()
  .setName('upgrade')
  .setDescription('Show upgrade info for selected troop')
  .addStringOption((option) => {
    return option
      .setName('troop')
      .setDescription('Troop to get upgrade information for')
      .setRequired(true)
      .setAutocomplete(true);
  });

export const apply = new SlashCommandBuilder()
  .setName('apply')
  .setDescription('Apply to join This Clan Now');

export const ro = new SlashCommandBuilder()
  .setName('ro')
  .setDescription('Create recruitment opportunity')
  .addStringOption((option) => {
    return option
      .setName('user')
      .setDescription('User ID to reach out to')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('notes')
      .setDescription('Notes about recruit')
      .setRequired(false);
  });

export const leadApply = new SlashCommandBuilder()
  .setName('lead-apply')
  .setDescription('Apply for leadership position with This Clan Now')
  .addStringOption((option) => {
    return option
      .setName('role')
      .setDescription('Role being applied for')
      .setRequired(true)
      .setChoices([
        {
          name: 'General',
          value: 'General',
        },
        {
          name: 'Elder',
          value: 'Elder',
        },
        {
          name: 'Leader',
          value: 'Leader',
        },
      ]);
  });

export const recruiterScore = new SlashCommandBuilder()
  .setName('recruiter-score')
  .setDescription('Score recruiters based on activity in channels')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const recruiterLeaderboard = new SlashCommandBuilder()
  .setName('recruiter-leaderboard')
  .setDescription('Show the latest recruiter leaderboard')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const cwlRoster = new SlashCommandBuilder()
  .setName('cwl-roster')
  .setDescription('Send reminder for people not in correct clans for CWL')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('roster')
      .setDescription('Roster version to use')
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName('type')
      .setDescription('What type of notification do you want to send out?')
      .setRequired(true)
      .setChoices([
        { name: 'Setup', value: 'Setup' },
        { name: 'Announcement', value: 'Announcement' },
        { name: 'Reminder', value: 'Reminder' },
        { name: 'Cleanup', value: 'Cleanup' },
      ]);
  });

export const initiateCwlSignup = new SlashCommandBuilder()
  .setName('initiate-cwl-signup')
  .setDescription('Create new signup for CWL')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('name')
      .setDescription('Signup name')
      .setRequired(true);
  });

export const cwlQuestions = new SlashCommandBuilder()
  .setName('cwl-questions')
  .setDescription('Ask questions for CWL')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('name')
      .setDescription('Questionnaire name')
      .setRequired(true);
  });

export const closeTicket = new SlashCommandBuilder()
  .setName('close-ticket')
  .setDescription('Close current application ticket');

export const deleteTicket = new SlashCommandBuilder()
  .setName('delete-ticket')
  .setDescription('Delete current application ticket');

export const createEvent = new SlashCommandBuilder()
  .setName('create-event')
  .setDescription('Create a new event')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('name')
      .setDescription('Name of the event')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('type')
      .setDescription('Type of channel for event')
      .setRequired(true)
      .setChoices([
        { name: 'Text', value: 'Text' },
        { name: 'Voice', value: 'Voice' },
        { name: 'Stage', value: 'Stage' },
      ]);
  })
  .addStringOption((option) => {
    return option
      .setName('start')
      .setDescription(
        'Start time in UTC (yyyy-mm-ddThh:mm) - Optional for unscheduled events',
      )
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName('end')
      .setDescription(
        'End time in UTC (yyyy-mm-ddThh:mm) - Optional for unscheduled events',
      )
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName('description')
      .setDescription('Description for the event')
      .setRequired(false);
  })
  .addAttachmentOption((option) => {
    return option
      .setName('thumbnail')
      .setDescription('Thumbnail for the event')
      .setRequired(false);
  });

export const questionCreate = new SlashCommandBuilder()
  .setName('question-create')
  .setDescription('Create question for event participation')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('question')
      .setDescription('Question to be asked')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('option1')
      .setDescription('First response option')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('option2')
      .setDescription('Second response option')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('option3')
      .setDescription('Third response option')
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName('option4')
      .setDescription('Fourth response option')
      .setRequired(false);
  })
  .addAttachmentOption((option) => {
    return option
      .setName('thumbnail')
      .setDescription('Thumbnail for question')
      .setRequired(false);
  });

export const questionClose = new SlashCommandBuilder()
  .setName('question-close')
  .setDescription('Close question to prevent further responses')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('question')
      .setDescription('Which question should be closed')
      .setRequired(true)
      .setAutocomplete(true);
  });

export const questionAnswer = new SlashCommandBuilder()
  .setName('question-answer')
  .setDescription('Set answer for question')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('question')
      .setDescription('Which question should be closed')
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName('answer')
      .setDescription('What is the correct answer')
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName('points')
      .setDescription('How many points should gained for the correct answer')
      .setRequired(false);
  });

export const eventLeaderboard = new SlashCommandBuilder()
  .setName('event-leaderboard')
  .setDescription('Display leaderboard for current event')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const eventWinner = new SlashCommandBuilder()
  .setName('event-winner')
  .setDescription('Create winner for current event')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) => {
    return option
      .setName('winner')
      .setDescription('Winner for event')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('prize')
      .setDescription('What was won?')
      .setRequired(true)
      .setChoices([
        {
          name: 'Gold Pass',
          value: 'GOLD PASS',
        },
        {
          name: 'Event Pass',
          value: 'EVENT PASS',
        },
        {
          name: 'Legends Base Voucher',
          value: 'LEGENDS BASE VOUCHER',
        },
        {
          name: 'Cash',
          value: 'CASH',
        },
      ]);
  })
  .addUserOption((option) => {
    return option
      .setName('sponsor')
      .setDescription('Sponsor for the award being given')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('expiration')
      .setDescription('Time until reward expires in hour (default 24)')
      .setRequired(false);
  });

export const nominate = new SlashCommandBuilder()
  .setName('nominate')
  .setDescription('Nominate a member for promotion/demotion')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addUserOption((option) => {
    return option
      .setName('user')
      .setDescription('Who we talkin about?')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('type')
      .setDescription('Promotion or demotion')
      .setRequired(true)
      .setChoices([
        {
          name: 'Promotion',
          value: 'Promotion',
        },
        {
          name: 'Demotion',
          value: 'Demotion',
        },
      ]);
  })
  .addStringOption((option) => {
    return option
      .setName('reason')
      .setDescription('Reason for proposal')
      .setRequired(true);
  });

export const nominationResult = new SlashCommandBuilder()
  .setName('nomination-result')
  .setDescription('Set result of nomination')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('proposal')
      .setDescription('Which proposal?')
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName('result')
      .setDescription('What is the result?')
      .setRequired(true)
      .setChoices([
        {
          name: 'Approve',
          value: 'Approve',
        },
        {
          name: 'Deny',
          value: 'Deny',
        },
      ]);
  })
  .addRoleOption((option) => {
    return option
      .setName('role')
      .setDescription('Role to add/remove')
      .setRequired(false);
  });

export const rankProposalReminder = new SlashCommandBuilder()
  .setName('rank-proposal-reminder')
  .setDescription('Reminder to check proposals')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const announceRoster = new SlashCommandBuilder()
  .setName('announce-roster')
  .setDescription(
    'Pull roster data from sheet and send to announcement channel',
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const scheduleEvent = new SlashCommandBuilder()
  .setName('schedule-event')
  .setDescription('Schedule or update times for an existing event')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName('start')
      .setDescription('Start time in UTC (yyyy-mm-ddThh:mm)')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('end')
      .setDescription('End time in UTC (yyyy-mm-ddThh:mm)')
      .setRequired(true);
  });

export const unrostered = new SlashCommandBuilder()
  .setName('unrostered')
  .setDescription('List all unrostered players');

export const createRoster = new SlashCommandBuilder()
  .setName('create-roster')
  .setDescription('Create a new roster for CWL')
  .addStringOption((option) => {
    return option
      .setName('clan-name')
      .setDescription('Name of the clan')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('clan-rank')
      .setDescription('Clan rank (ex: C1, M2, etc.)')
      .setRequired(true);
  });

export const rosterAdd = new SlashCommandBuilder()
  .setName('roster-add')
  .setDescription('Add a player to a roster')
  .addStringOption((option) => {
    return option
      .setName('player-name')
      .setDescription('Name of the player to add')
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName('roster-name')
      .setDescription('Name of the roster to add to')
      .setRequired(true)
      .setAutocomplete(true);
  });

export const rosterShow = new SlashCommandBuilder()
  .setName('roster-show')
  .setDescription('Show the details of a roster')
  .addStringOption((option) => {
    return option
      .setName('roster-name')
      .setDescription('Name of the roster to show')
      .setRequired(true)
      .setAutocomplete(true);
  });

export const rosterRemove = new SlashCommandBuilder()
  .setName('roster-remove')
  .setDescription('Remove a player from a roster')
  .addStringOption((option) => {
    return option
      .setName('roster-name')
      .setDescription('Name of the roster to remove from')
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName('player-name')
      .setDescription('Name of the player to remove')
      .setRequired(true)
      .setAutocomplete(true);
  });

export const rosterDelete = new SlashCommandBuilder()
  .setName('roster-delete')
  .setDescription('Delete an entire roster and all its players')
  .addStringOption((option) => {
    return option
      .setName('roster-name')
      .setDescription('Name of the roster to delete')
      .setRequired(true)
      .setAutocomplete(true);
  });

export const exportRosters = new SlashCommandBuilder()
  .setName('export-rosters')
  .setDescription('Export all rosters with player stats to a CSV file')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const cwlResponse = new SlashCommandBuilder()
  .setName('cwl-response')
  .setDescription("View a user's CWL signup response")
  .addStringOption((option) => {
    return option
      .setName('user')
      .setDescription('Username to lookup')
      .setRequired(true)
      .setAutocomplete(true);
  });

// Task Management Commands
export const taskCreate = new SlashCommandBuilder()
  .setName("task-create")
  .setDescription("Create a new task")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("title")
      .setDescription("Title of the task")
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName("description")
      .setDescription("Detailed description of the task")
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName("assigned-roles")
      .setDescription("Roles that can claim this task (mention multiple: @role1 @role2)")
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName("assign-users")
      .setDescription("Users to assign this task to (mention multiple: @user1 @user2)")
      .setRequired(false);
  })
  .addStringOption((option) => {
    return option
      .setName("priority")
      .setDescription("Priority level of the task")
      .setRequired(false)
      .setChoices([
        { name: "Low", value: "low" },
        { name: "Medium", value: "medium" },
        { name: "High", value: "high" },
      ]);
  })
  .addStringOption((option) => {
    return option
      .setName("due-date")
      .setDescription("Due date for the task (YYYY-MM-DD)")
      .setRequired(false);
  });

export const taskClaim = new SlashCommandBuilder()
  .setName("task-claim")
  .setDescription("Claim a task to work on")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to claim")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const taskComplete = new SlashCommandBuilder()
  .setName("task-complete")
  .setDescription("Mark your claimed task as completed")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to mark as completed")
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName("notes")
      .setDescription("Completion notes or comments")
      .setRequired(false);
  });

export const taskApprove = new SlashCommandBuilder()
  .setName("task-approve")
  .setDescription("Approve a completed task and remove it from the board")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to approve")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const taskList = new SlashCommandBuilder()
  .setName("task-list")
  .setDescription("List all tasks with optional filtering")
  .addStringOption((option) => {
    return option
      .setName("status")
      .setDescription("Filter by task status")
      .setRequired(false)
      .setChoices([
        { name: "Pending", value: "pending" },
        { name: "Claimed", value: "claimed" },
        { name: "Completed", value: "completed" },
      ]);
  })
  .addRoleOption((option) => {
    return option
      .setName("role")
      .setDescription("Filter by assigned role")
      .setRequired(false);
  })
  .addUserOption((option) => {
    return option
      .setName("user")
      .setDescription("Filter by user (claimed by or created by)")
      .setRequired(false);
  });

export const taskUnclaim = new SlashCommandBuilder()
  .setName("task-unclaim")
  .setDescription("Unclaim a task you previously claimed")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to unclaim")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const taskDelete = new SlashCommandBuilder()
  .setName("task-delete")
  .setDescription("Delete a task permanently")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to delete")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const taskDashboard = new SlashCommandBuilder()
  .setName("task-dashboard")
  .setDescription("Get a link to the task management dashboard");

export const taskNotify = new SlashCommandBuilder()
  .setName("task-notify")
  .setDescription("Send task notifications and ping assigned roles")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to notify about")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const taskSetDueDate = new SlashCommandBuilder()
  .setName("task-set-due-date")
  .setDescription("Set or update the due date for a task")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to set due date for")
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addStringOption((option) => {
    return option
      .setName("due_date")
      .setDescription("Due date (YYYY-MM-DD format, e.g., 2025-11-15)")
      .setRequired(true);
  });

export const taskAssign = new SlashCommandBuilder()
  .setName("task-assign")
  .setDescription("Assign a task to a specific user")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to assign")
      .setRequired(true)
      .setAutocomplete(true);
  })
  .addUserOption((option) => {
    return option
      .setName("user")
      .setDescription("User to assign the task to")
      .setRequired(true);
  });

export const taskReminders = new SlashCommandBuilder()
  .setName("task-reminders")
  .setDescription("Send task summaries to all assignees showing their pending and claimed tasks")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

export const taskAdminUnclaim = new SlashCommandBuilder()
  .setName("task-admin-unclaim")
  .setDescription("Admin command to forcibly unclaim a task from a user")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to unclaim from the current user")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const taskOverview = new SlashCommandBuilder()
  .setName("task-overview")
  .setDescription("View detailed information about a specific task")
  .addStringOption((option) => {
    return option
      .setName("task")
      .setDescription("Task to view details for")
      .setRequired(true)
      .setAutocomplete(true);
  });

export const registerSubs = new SlashCommandBuilder()
  .setName('register-subs')
  .setDescription('Register player substitutions between clans')
  .addStringOption((option) => {
    return option
      .setName('clan-out')
      .setDescription('Clan losing players')
      .setChoices([
        {
          name: 'TCN1',
          value: 'TCN1',
        },
        {
          name: 'TCN2',
          value: 'TCN2',
        },
        {
          name: 'TCN3',
          value: 'TCN3',
        },
        {
          name: 'TCN4',
          value: 'TCN4',
        },
      ])
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('clan-out-players')
      .setDescription('Players leaving (mention: @user1 @user2)')
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('clan-in')
      .setDescription('Clan gaining players')
      .setChoices([
        {
          name: 'TCN1',
          value: 'TCN1',
        },
        {
          name: 'TCN2',
          value: 'TCN2',
        },
        {
          name: 'TCN3',
          value: 'TCN3',
        },
        {
          name: 'TCN4',
          value: 'TCN4',
        },
      ])
      .setRequired(true);
  })
  .addStringOption((option) => {
    return option
      .setName('clan-in-players')
      .setDescription('Players joining (mention: @user1 @user2)')
      .setRequired(true);
  });
