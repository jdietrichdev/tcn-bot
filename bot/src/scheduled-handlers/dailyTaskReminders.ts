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
        FilterExpression: "pk = :guildId AND begins_with(sk, :taskPrefix) AND attribute_exists(dueDate) AND (#status = :claimedStatus OR #status = :pendingStatus)",
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
      console.log("No tasks with due dates found for reminders");
      return;
    }

    const tasks = result.Items.map((item) => unmarshall(item));
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    
    const dueTasks = tasks.filter(task => {
      if (!task.dueDate) return false;
      
      const dueDate = new Date(task.dueDate + 'T00:00:00.000Z');
      const taskDueDateStr = task.dueDate;
      
      return taskDueDateStr <= todayStr;
    });

    if (dueTasks.length === 0) {
      console.log("No tasks due today or overdue");
      return;
    }

    const tasksByAssignee = new Map();
    
    for (const task of dueTasks) {
      const today = new Date().toISOString().split('T')[0];
      const isOverdue = task.dueDate < today;
      const isDueToday = task.dueDate === today;
      
      if (!isDueToday && !isOverdue) continue;
      
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
          dueTasks: [],
          overdueTasks: []
        });
      }
      
      const assigneeData = tasksByAssignee.get(key);
      if (isOverdue) {
        assigneeData.overdueTasks.push(task);
      } else {
        assigneeData.dueTasks.push(task);
      }
    }

    for (const [key, data] of tasksByAssignee) {
      const { assignee, assigneeType, dueTasks, overdueTasks } = data;
      
      let mention = '';
      if (assigneeType === 'user') {
        mention = `<@${assignee}>`;
      } else if (assigneeType === 'role') {
        mention = `<@&${assignee}>`;
      }
      
      let messageContent = `🔔 **Task Reminder** ${mention}\n\n`;
      
      if (overdueTasks.length > 0) {
        messageContent += `⚠️ **OVERDUE TASKS:**\n`;
        for (const task of overdueTasks) {
          const daysPast = Math.floor((new Date().getTime() - new Date(task.dueDate + 'T00:00:00.000Z').getTime()) / (1000 * 60 * 60 * 24));
          messageContent += `• **${task.title}** - Due ${daysPast} day${daysPast > 1 ? 's' : ''} ago (${task.dueDate})\n`;
        }
        messageContent += '\n';
      }
      
      if (dueTasks.length > 0) {
        messageContent += `📅 **DUE TODAY:**\n`;
        for (const task of dueTasks) {
          messageContent += `• **${task.title}** - Due today (${task.dueDate})\n`;
        }
        messageContent += '\n';
      }
      
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

    console.log(`Sent task reminders for ${tasksByAssignee.size} assignee(s) in guild ${guildId}`);
    
  } catch (err) {
    console.error(`Failed to handle daily task reminders: ${err}`);
    throw err;
  }
};