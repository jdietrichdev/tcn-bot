import { ScanCommand } from "@aws-sdk/client-dynamodb";
import { marshall, unmarshall } from "@aws-sdk/util-dynamodb";
import { sendMessage } from "../adapters/discord-adapter";
import { dynamoDbClient } from "../clients/dynamodb-client";

export const handleDailyTaskReminders = async (
  eventDetail: Record<string, string>
) => {
  try {
    const { guildId } = eventDetail;
    const channelId = "1435760579213136035";
    
    const result = await dynamoDbClient.send(
      new ScanCommand({
        TableName: "BotTable",
        FilterExpression: "pk = :guildId AND begins_with(sk, :taskPrefix) AND (#status = :claimedStatus OR #status = :pendingStatus)",
        ExpressionAttributeNames: {
          "#status": "status"
        },
        ExpressionAttributeValues: marshall({
          ":guildId": guildId,
          ":taskPrefix": "task#",
          ":claimedStatus": "claimed",
          ":pendingStatus": "pending"
        }),
      })
    );

    if (!result.Items || result.Items.length === 0) {
      console.log("No pending or claimed tasks found for reminders");
      return;
    }

    const tasks = result.Items.map((item) => unmarshall(item));
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const tasksByAssignee = new Map();
    
    for (const task of tasks) {
      let assignee = null;
      let assigneeType = 'none';
      
      if (task.assignedTo || task.claimedBy) {
        assignee = task.assignedTo || task.claimedBy;
        assigneeType = 'user';
      } else if (task.assignedRole) {
        assignee = task.assignedRole;
        assigneeType = 'role';
      }
      
      if (!assignee) continue;
      
      const key = `${assigneeType}:${assignee}`;
      if (!tasksByAssignee.has(key)) {
        tasksByAssignee.set(key, {
          assignee,
          assigneeType,
          overdueTasks: [],
          dueTasks: [],
          pendingTasks: [],
          claimedTasks: []
        });
      }
      
      const assigneeData = tasksByAssignee.get(key);
      
      if (task.dueDate) {
        const dueDate = new Date(task.dueDate + 'T00:00:00.000Z');
        const taskDueDateStr = task.dueDate;
        
        if (taskDueDateStr < todayStr) {
          assigneeData.overdueTasks.push(task);
        } else if (taskDueDateStr === todayStr) {
          assigneeData.dueTasks.push(task);
        } else {
          if (task.status === 'claimed') {
            assigneeData.claimedTasks.push(task);
          } else {
            assigneeData.pendingTasks.push(task);
          }
        }
      } else {
        if (task.status === 'claimed') {
          assigneeData.claimedTasks.push(task);
        } else {
          assigneeData.pendingTasks.push(task);
        }
      }
    }

    if (tasksByAssignee.size === 0) {
      console.log("No assigned tasks found for reminders");
      return;
    }

    for (const [key, data] of tasksByAssignee) {
      const { assignee, assigneeType, overdueTasks, dueTasks, pendingTasks, claimedTasks } = data;
      
      let mention = '';
      if (assigneeType === 'user') {
        mention = `<@${assignee}>`;
      } else if (assigneeType === 'role') {
        mention = `<@&${assignee}>`;
      }
      
      let messageContent = `🔔 **Task Summary** ${mention}\n\n`;
      
      if (overdueTasks.length > 0) {
        messageContent += `⚠️ **OVERDUE TASKS:**\n`;
        for (const task of overdueTasks) {
          const daysPast = Math.floor((new Date().getTime() - new Date(task.dueDate + 'T00:00:00.000Z').getTime()) / (1000 * 60 * 60 * 24));
          const statusEmoji = task.status === 'claimed' ? '📪' : '📬';
          messageContent += `• ${statusEmoji} **${task.title}** - Due ${daysPast} day${daysPast > 1 ? 's' : ''} ago (${task.dueDate})\n`;
        }
        messageContent += '\n';
      }
      
      if (dueTasks.length > 0) {
        messageContent += `📅 **DUE TODAY:**\n`;
        for (const task of dueTasks) {
          const statusEmoji = task.status === 'claimed' ? '📪' : '📬';
          messageContent += `• ${statusEmoji} **${task.title}** - Due today (${task.dueDate})\n`;
        }
        messageContent += '\n';
      }
      
      if (claimedTasks.length > 0) {
        messageContent += `📪 **IN PROGRESS:**\n`;
        for (const task of claimedTasks) {
          const dueDateText = task.dueDate ? ` - Due: ${task.dueDate}` : '';
          messageContent += `• **${task.title}**${dueDateText}\n`;
        }
        messageContent += '\n';
      }
      
      if (pendingTasks.length > 0) {
        messageContent += `📬 **PENDING (Need to Claim):**\n`;
        for (const task of pendingTasks) {
          const dueDateText = task.dueDate ? ` - Due: ${task.dueDate}` : '';
          messageContent += `• **${task.title}**${dueDateText}\n`;
        }
        messageContent += '\n';
      }
      
      const totalTasks = overdueTasks.length + dueTasks.length + claimedTasks.length + pendingTasks.length;
      messageContent += `📊 **Total Tasks: ${totalTasks}**\n\n`;
      messageContent += `Use \`/task-list\` to view all your tasks or visit the [Task Dashboard](${process.env.DASHBOARD_URL || 'https://d19x3gu4qo04f3.cloudfront.net'}/tasks) for more details.`;
      
      await sendMessage(
        {
          content: messageContent,
          allowed_mentions: {
            users: assigneeType === 'user' ? [assignee] : [],
            roles: assigneeType === 'role' ? [assignee] : []
          }
        },
        channelId
      );
      
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    console.log(`Sent task summary reminders for ${tasksByAssignee.size} assignee(s) in guild ${guildId}`);
    
  } catch (err) {
    console.error(`Failed to handle daily task reminders: ${err}`);
    throw err;
  }
};