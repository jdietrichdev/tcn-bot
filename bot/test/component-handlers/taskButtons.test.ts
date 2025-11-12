import { handleTaskButtonInteraction } from '../../src/component-handlers/taskButtons';
import { APIMessageComponentInteraction, InteractionResponseType } from 'discord-api-types/v10';

// Mock the discord adapter
jest.mock('../../src/adapters/discord-adapter');
jest.mock('../../src/clients/dynamodb-client');
jest.mock('../../src/command-handlers/taskList');

// Mock the taskListButton module for refreshTaskListMessages
jest.mock('../../src/component-handlers/taskListButton');

const mockUpdateResponse = jest.fn();
const mockGenerateTaskListResponse = jest.fn();

// Mock DynamoDB client before importing taskButtons
const mockDynamoDbClient = {
  send: jest.fn(),
};

jest.mock('../../src/clients/dynamodb-client', () => ({
  dynamoDbClient: mockDynamoDbClient,
}), { virtual: true });

// Mock import for taskListButton
jest.mock('../../src/component-handlers/taskListButton', () => ({
  refreshTaskListMessages: jest.fn().mockResolvedValue(undefined),
}));

describe('handleTaskButtonInteraction', () => {
  const mockInteraction = {
    data: {
      custom_id: 'task_claim_123',
    },
    guild_id: 'guild123',
    member: {
      user: {
        id: 'user123',
      },
    },
    user: {
      id: 'user123',
    },
  } as APIMessageComponentInteraction;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  test('should handle claim button interaction successfully', async () => {
    // Mock the DynamoDB get command to return a task
    mockDynamoDbClient.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetCommand') {
        return Promise.resolve({
          Item: {
            pk: 'guild123',
            sk: 'task#123',
            status: 'pending',
            multipleClaimsAllowed: false,
          },
        });
      }
      if (command.constructor.name === 'UpdateCommand') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    mockGenerateTaskListResponse.mockResolvedValue({
      embeds: [],
      components: [],
    });

    const result = await handleTaskButtonInteraction(mockInteraction);

    expect(result.type).toBe(InteractionResponseType.UpdateMessage);
    expect(mockDynamoDbClient.send).toHaveBeenCalledTimes(2); // Get and Update
  });

  test('should handle claim button when task is already claimed', async () => {
    mockDynamoDbClient.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetCommand') {
        return Promise.resolve({
          Item: {
            pk: 'guild123',
            sk: 'task#123',
            status: 'claimed',
            multipleClaimsAllowed: false,
          },
        });
      }
      return Promise.resolve({});
    });

    const result = await handleTaskButtonInteraction(mockInteraction);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ This task has already been claimed.');
    expect(result.data.flags).toBe(64);
  });

  test('should handle claim button for multiple claims allowed', async () => {
    mockDynamoDbClient.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetCommand') {
        return Promise.resolve({
          Item: {
            pk: 'guild123',
            sk: 'task#123',
            status: 'claimed',
            multipleClaimsAllowed: true,
          },
        });
      }
      if (command.constructor.name === 'UpdateCommand') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    mockGenerateTaskListResponse.mockResolvedValue({
      embeds: [],
      components: [],
    });

    const result = await handleTaskButtonInteraction(mockInteraction);

    expect(result.type).toBe(InteractionResponseType.UpdateMessage);
  });

  test('should handle complete button interaction', async () => {
    const completeInteraction = {
      ...mockInteraction,
      data: {
        custom_id: 'task_complete_123',
        component_type: 2, // Button component type
      },
    } as APIMessageComponentInteraction;

    mockDynamoDbClient.send.mockResolvedValue({});
    mockGenerateTaskListResponse.mockResolvedValue({
      embeds: [],
      components: [],
    });

    const result = await handleTaskButtonInteraction(completeInteraction);

    expect(result.type).toBe(InteractionResponseType.UpdateMessage);
  });

  test('should handle unclaim button interaction', async () => {
    const unclaimInteraction = {
      ...mockInteraction,
      data: {
        custom_id: 'task_unclaim_123',
        component_type: 2, // Button component type
      },
    } as APIMessageComponentInteraction;

    mockDynamoDbClient.send.mockResolvedValue({});
    mockGenerateTaskListResponse.mockResolvedValue({
      embeds: [],
      components: [],
    });

    const result = await handleTaskButtonInteraction(unclaimInteraction);

    expect(result.type).toBe(InteractionResponseType.UpdateMessage);
  });

  test('should reject approve button on ephemeral message', async () => {
    const approveInteraction = {
      ...mockInteraction,
      data: {
        custom_id: 'task_approve_123',
      },
      message: {
        flags: 64, // ephemeral flag
      },
    };

    const result = await handleTaskButtonInteraction(approveInteraction as any);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ Approval actions must be performed on public messages.');
    expect(result.data.flags).toBe(64);
  });

  test('should handle approve button on public message', async () => {
    const approveInteraction = {
      ...mockInteraction,
      data: {
        custom_id: 'task_approve_123',
      },
      message: {
        flags: 0, // public message
      },
    };

    mockDynamoDbClient.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetCommand') {
        return Promise.resolve({
          Item: {
            pk: 'guild123',
            sk: 'task#123',
            title: 'Test Task',
          },
        });
      }
      return Promise.resolve({});
    });

    const result = await handleTaskButtonInteraction(approveInteraction as any);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.flags).toBe(64);
  });

  test('should handle navigation buttons by returning error since they are now routed elsewhere', async () => {
    const navInteractions = [
      { custom_id: 'task_list_my' },
      { custom_id: 'task_list_completed' },
      { custom_id: 'task_list_all' },
    ];

    for (const nav of navInteractions) {
      const interaction = {
        ...mockInteraction,
        data: {
          custom_id: nav.custom_id,
          component_type: 2, // Button component type
        },
      } as APIMessageComponentInteraction;

      // Since navigation buttons are now routed to handleTaskListPagination,
      // they should not reach handleTaskButtonInteraction anymore
      const result = await handleTaskButtonInteraction(interaction);

      expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
      expect(result.data.content).toBe('❌ Unknown button interaction.');
      expect(result.data.flags).toBe(64);
    }
  });

  test('should handle invalid task ID', async () => {
    const invalidInteraction = {
      ...mockInteraction,
      data: {
        custom_id: 'task_claim_',
      },
    };

    const result = await handleTaskButtonInteraction(invalidInteraction as any);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ Invalid task ID.');
    expect(result.data.flags).toBe(64);
  });

  test('should handle unknown button interaction', async () => {
    const unknownInteraction = {
      ...mockInteraction,
      data: {
        custom_id: 'task_unknown_123',
      },
    };

    const result = await handleTaskButtonInteraction(unknownInteraction as any);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ Unknown button interaction.');
    expect(result.data.flags).toBe(64);
  });

  test('should handle database connectivity failure on claim', async () => {
    mockDynamoDbClient.send.mockRejectedValue(new Error('Database connection failed'));

    const result = await handleTaskButtonInteraction(mockInteraction);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ An error occurred while processing your request.');
    expect(result.data.flags).toBe(64);
  });

  test('should handle task not found', async () => {
    mockDynamoDbClient.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetCommand') {
        return Promise.resolve({ Item: null });
      }
      return Promise.resolve({});
    });

    const result = await handleTaskButtonInteraction(mockInteraction);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ Task not found.');
    expect(result.data.flags).toBe(64);
  });

  test('should handle generateTaskListResponse failure', async () => {
    mockDynamoDbClient.send.mockImplementation((command) => {
      if (command.constructor.name === 'GetCommand') {
        return Promise.resolve({
          Item: {
            pk: 'guild123',
            sk: 'task#123',
            status: 'pending',
            multipleClaimsAllowed: false,
          },
        });
      }
      if (command.constructor.name === 'UpdateCommand') {
        return Promise.resolve({});
      }
      return Promise.resolve({});
    });

    mockGenerateTaskListResponse.mockRejectedValue(new Error('Task list generation failed'));

    const result = await handleTaskButtonInteraction(mockInteraction);

    expect(result.type).toBe(InteractionResponseType.ChannelMessageWithSource);
    expect(result.data.content).toBe('❌ An error occurred while processing your request.');
    expect(result.data.flags).toBe(64);
  });
});