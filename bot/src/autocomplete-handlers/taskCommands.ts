import {
  APIApplicationCommandAutocompleteInteraction,
  APIApplicationCommandInteractionDataStringOption,
  APICommandAutocompleteInteractionResponseCallbackData,
  InteractionResponseType,
} from "discord-api-types/v10";
import { dynamoDbClient } from "../clients/dynamodb-client";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";

export const handleTaskClaim = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!focused || !guildId || focused.name !== "task") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "task#",
        },
      })
    );

    const tasks = queryResult.Items || [];
    const searchTerm = focused.value?.toLowerCase() || '';
    
    const availableTasks = tasks
      .filter((task) => task.status === 'pending')
      .filter((task) => {
        return !task.assignedRole || true;
      })
      .filter((task) => task.title?.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.title?.toLowerCase() || '';
        const bLower = b.title?.toLowerCase() || '';
        
        if (aLower === searchTerm) return -1;
        if (bLower === searchTerm) return 1;
        
        if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
        if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
        
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
        
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    options.choices = availableTasks.slice(0, 25).map((task) => {
      const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
      const dueDate = task.dueDate ? ` (Due: ${task.dueDate})` : '';
      return {
        name: `${task.title}${priority}${dueDate}`,
        value: task.taskId,
      };
    });
  } catch (error) {
    console.error("Error in task-claim autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleTaskComplete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!focused || !guildId || !userId || focused.name !== "task") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "task#",
        },
      })
    );

    const tasks = queryResult.Items || [];
    const searchTerm = focused.value?.toLowerCase() || '';
    
    const userTasks = tasks
      .filter((task) => task.status === 'claimed' && task.claimedBy === userId)
      .filter((task) => task.title?.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.title?.toLowerCase() || '';
        const bLower = b.title?.toLowerCase() || '';
        
        if (aLower === searchTerm) return -1;
        if (bLower === searchTerm) return 1;
        
        if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
        if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
        
        return new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime();
      });

    options.choices = userTasks.slice(0, 25).map((task) => {
      const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
      const claimed = task.claimedAt ? ` (Claimed: ${new Date(task.claimedAt).toLocaleDateString()})` : '';
      return {
        name: `${task.title}${priority}${claimed}`,
        value: task.taskId,
      };
    });
  } catch (error) {
    console.error("Error in task-complete autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleTaskApprove = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;

  if (!focused || !guildId || focused.name !== "task") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "task#",
        },
      })
    );

    const tasks = queryResult.Items || [];
    const searchTerm = focused.value?.toLowerCase() || '';
    
    const completedTasks = tasks
      .filter((task) => task.status === 'completed')
      .filter((task) => task.title?.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.title?.toLowerCase() || '';
        const bLower = b.title?.toLowerCase() || '';
        
        if (aLower === searchTerm) return -1;
        if (bLower === searchTerm) return 1;
        
        if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
        if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
        
        return new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime();
      });

    options.choices = completedTasks.slice(0, 25).map((task) => {
      const completedBy = task.completedBy ? ` (by <@${task.completedBy}>)` : '';
      const completed = task.completedAt ? ` - ${new Date(task.completedAt).toLocaleDateString()}` : '';
      return {
        name: `${task.title}${completedBy}${completed}`,
        value: task.taskId,
      };
    });
  } catch (error) {
    console.error("Error in task-approve autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleTaskUnclaim = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;
  const userId = interaction.member?.user?.id || interaction.user?.id;

  if (!focused || !guildId || !userId || focused.name !== "task") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "task#",
        },
      })
    );

    const tasks = queryResult.Items || [];
    const searchTerm = focused.value?.toLowerCase() || '';
    
    const userTasks = tasks
      .filter((task) => task.status === 'claimed' && task.claimedBy === userId)
      .filter((task) => task.title?.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.title?.toLowerCase() || '';
        const bLower = b.title?.toLowerCase() || '';
        
        if (aLower === searchTerm) return -1;
        if (bLower === searchTerm) return 1;
        
        if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
        if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
        
        return new Date(a.claimedAt).getTime() - new Date(b.claimedAt).getTime();
      });

    options.choices = userTasks.slice(0, 25).map((task) => {
      const priority = task.priority ? ` [${task.priority.toUpperCase()}]` : '';
      const claimed = task.claimedAt ? ` (Claimed: ${new Date(task.claimedAt).toLocaleDateString()})` : '';
      return {
        name: `${task.title}${priority}${claimed}`,
        value: task.taskId,
      };
    });
  } catch (error) {
    console.error("Error in task-unclaim autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleTaskDelete = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;

  if (!focused || !guildId || focused.name !== "task") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "task#",
        },
      })
    );

    const tasks = queryResult.Items || [];
    const searchTerm = focused.value?.toLowerCase() || '';
    
    const filteredTasks = tasks
      .filter((task) => task.title?.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.title?.toLowerCase() || '';
        const bLower = b.title?.toLowerCase() || '';
        
        if (aLower === searchTerm) return -1;
        if (bLower === searchTerm) return 1;
        
        if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
        if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
        
        const statusOrder = { pending: 1, claimed: 2, completed: 3 };
        const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 4;
        const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 4;
        
        if (aStatus !== bStatus) return aStatus - bStatus;
        
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });

    options.choices = filteredTasks.slice(0, 25).map((task) => {
      const status = task.status ? ` [${task.status.toUpperCase()}]` : '';
      const claimedBy = task.claimedBy ? ` (by <@${task.claimedBy}>)` : '';
      return {
        name: `${task.title}${status}${claimedBy}`,
        value: task.taskId,
      };
    });
  } catch (error) {
    console.error("Error in task-delete autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};

export const handleTaskNotify = async (
  interaction: APIApplicationCommandAutocompleteInteraction
) => {
  const options: APICommandAutocompleteInteractionResponseCallbackData = {
    choices: [],
  };

  const focused = (interaction.data.options as APIApplicationCommandInteractionDataStringOption[])?.find(
    (option) => option.focused
  );

  const guildId = interaction.guild_id;

  if (!focused || !guildId || focused.name !== "task") {
    return {
      type: InteractionResponseType.ApplicationCommandAutocompleteResult,
      data: options,
    };
  }

  try {
    const queryResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: "BotTable",
        KeyConditionExpression: "pk = :pk AND begins_with(sk, :sk)",
        ExpressionAttributeValues: {
          ":pk": guildId,
          ":sk": "task#",
        },
      })
    );

    const tasks = queryResult.Items || [];
    const searchTerm = focused.value?.toLowerCase() || '';
    
    const filteredTasks = tasks
      .filter((task) => task.title?.toLowerCase().includes(searchTerm))
      .sort((a, b) => {
        const aLower = a.title?.toLowerCase() || '';
        const bLower = b.title?.toLowerCase() || '';
        
        if (aLower === searchTerm) return -1;
        if (bLower === searchTerm) return 1;
        
        if (aLower.startsWith(searchTerm) && !bLower.startsWith(searchTerm)) return -1;
        if (bLower.startsWith(searchTerm) && !aLower.startsWith(searchTerm)) return 1;
        
        const statusOrder = { pending: 1, claimed: 2, completed: 3 };
        const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 4;
        const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 4;
        
        if (aStatus !== bStatus) return aStatus - bStatus;
        
        const priorityOrder = { high: 1, medium: 2, low: 3 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 4;
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 4;
        
        if (aPriority !== bPriority) return aPriority - bPriority;
        
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

    options.choices = filteredTasks.slice(0, 25).map((task) => {
      const status = task.status ? ` [${task.status.toUpperCase()}]` : '';
      const priority = task.priority ? ` ${task.priority.toUpperCase()}` : '';
      const assignment = task.assignedRoles && task.assignedRoles.length > 0 
        ? ` (${task.assignedRoles.length} role${task.assignedRoles.length > 1 ? 's' : ''})` 
        : '';
      return {
        name: `${task.title}${status}${priority}${assignment}`,
        value: task.taskId,
      };
    });
  } catch (error) {
    console.error("Error in task-notify autocomplete:", error);
  }

  return {
    type: InteractionResponseType.ApplicationCommandAutocompleteResult,
    data: options,
  };
};