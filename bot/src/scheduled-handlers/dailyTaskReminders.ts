import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { sendMessage } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { APIEmbed } from "discord-api-types/v10";

// Function to create a formatted string for a list of tasks
const formatTasks = (tasks: any[], includeStatus = false) => {
  if (tasks.length === 0) return '`None`';
  return tasks.map(task => {
    const statusEmoji = includeStatus ? (task.status === 'claimed' ? '📪' : '📬') : '';
    const dueDateText = task.dueDate ? ` (Due: ${task.dueDate})` : '';
    return `• ${statusEmoji} **${task.title}**${dueDateText}`.trim();
  }).join('\n');
};

export const handleDailyTaskReminders = async (
  eventDetail: Record<string, string>
) => {
  try {
    const { guildId } = eventDetail;
    const channelId = "1438383813662347274"; // New Channel ID

    const result = await dynamoDbClient.send(
      new ScanCommand({
        TableName: "BotTable",
        FilterExpression: "pk = :guildId AND begins_with(sk, :taskPrefix) AND (#status = :claimedStatus OR #status = :pendingStatus)",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: marshall({
          ":guildId": guildId,
          ":taskPrefix": "task#",
          ":claimedStatus": "claimed",
          ":pendingStatus": "pending"
        }),
      })
    );

    if (!result.Items || result.Items.length === 0) {
      console.log("No pending or claimed tasks found for reminders.");
      return;
    }

    const tasks = result.Items.map((item) => unmarshall(item));
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const tasksByAssignee = new Map<string, {
      assignee: string;
      assigneeType: 'user' | 'role';
      overdueTasks: any[];
      dueTodayTasks: any[];
      pendingTasks: any[];
      claimedTasks: any[];
    }>();

    for (const task of tasks) {
      const assigneeId = task.claimedBy || task.assignedTo || task.assignedRole;
      if (!assigneeId) continue;

      const assigneeType = task.claimedBy || task.assignedTo ? 'user' : 'role';
      const key = `${assigneeType}:${assigneeId}`;

      if (!tasksByAssignee.has(key)) {
        tasksByAssignee.set(key, {
          assignee: assigneeId,
          assigneeType,
          overdueTasks: [],
          dueTodayTasks: [],
          pendingTasks: [],
          claimedTasks: []
        });
      }

      const group = tasksByAssignee.get(key)!;
      const taskDueDate = task.dueDate ? new Date(task.dueDate + 'T00:00:00.000Z') : null;

      if (taskDueDate) {
        if (taskDueDate < today) {
          group.overdueTasks.push(task);
        } else if (taskDueDate.getTime() === today.getTime()) {
          group.dueTodayTasks.push(task);
        } else {
          if (task.status === 'claimed') group.claimedTasks.push(task);
          else group.pendingTasks.push(task);
        }
      } else {
        if (task.status === 'claimed') group.claimedTasks.push(task);
        else group.pendingTasks.push(task);
      }
    }

    if (tasksByAssignee.size === 0) {
      console.log("No assigned tasks to send reminders for.");
      return;
    }

    for (const [, data] of tasksByAssignee) {
      const { assignee, assigneeType, overdueTasks, dueTodayTasks, pendingTasks, claimedTasks } = data;
      
      const mention = assigneeType === 'user' ? `<@${assignee}>` : `<@&${assignee}>`;
      const totalTasks = overdueTasks.length + dueTodayTasks.length + pendingTasks.length + claimedTasks.length;

      if (totalTasks === 0) continue;

      const embed: APIEmbed = {
        title: `🔔 Daily Task Summary for ${assigneeType === 'user' ? 'You' : 'Your Role'}`,
        description: `Here is a summary of your **${totalTasks}** assigned task(s).`,
        color: overdueTasks.length > 0 ? 0xff0000 : (dueTodayTasks.length > 0 ? 0xffa500 : 0x5865F2),
        fields: [],
        footer: {
          text: "Use /task-list or the dashboard to manage your tasks.",
        },
        timestamp: new Date().toISOString(),
      };

      if (overdueTasks.length > 0) {
        embed.fields!.push({
          name: `⚠️ Overdue Tasks (${overdueTasks.length})`,
          value: formatTasks(overdueTasks, true),
          inline: false,
        });
      }
      if (dueTodayTasks.length > 0) {
        embed.fields!.push({
          name: `📅 Due Today (${dueTodayTasks.length})`,
          value: formatTasks(dueTodayTasks, true),
          inline: false,
        });
      }
      if (claimedTasks.length > 0) {
        embed.fields!.push({
          name: `📪 In Progress (${claimedTasks.length})`,
          value: formatTasks(claimedTasks),
          inline: false,
        });
      }
      if (pendingTasks.length > 0) {
        embed.fields!.push({
          name: `📬 Pending & Needs Claiming (${pendingTasks.length})`,
          value: formatTasks(pendingTasks),
          inline: false,
        });
      }

      await sendMessage(
        {
          content: mention,
          embeds: [embed],
          allowed_mentions: {
            users: assigneeType === 'user' ? [assignee] : [],
            roles: assigneeType === 'role' ? [assignee] : [],
          }
        },
        channelId
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000)); // Avoid rate limiting
    }

    console.log(`Sent task summary reminders for ${tasksByAssignee.size} assignee(s) in guild ${guildId}`);
    
  } catch (err) {
    console.error(`Failed to handle daily task reminders: ${err}`);
    throw err;
  }
};