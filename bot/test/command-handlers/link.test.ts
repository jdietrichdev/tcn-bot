import { APIChatInputApplicationCommandInteraction } from 'discord-api-types/v10';
import { GetCommand, PutCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';
import { handleLink } from '../../src/command-handlers/link';
import { dynamoDbClient } from '../../src/clients/dynamodb-client';
import { verify } from '../../src/adapters/coc-api-adapter';
import { updateResponse } from '../../src/adapters/discord-adapter';
import { importPointPlayerLinks } from '../../src/util/importPointPlayerLinks';

jest.mock('../../src/clients/dynamodb-client', () => ({
  dynamoDbClient: { send: jest.fn() },
}));
jest.mock('../../src/adapters/coc-api-adapter', () => ({ verify: jest.fn() }));
jest.mock('../../src/adapters/discord-adapter', () => ({ updateResponse: jest.fn() }));
jest.mock('../../src/util/importPointPlayerLinks', () => ({ importPointPlayerLinks: jest.fn() }));

const send = dynamoDbClient.send as jest.Mock;
const interaction = (command: string, roles: string[] = []) => ({
  application_id: 'app',
  token: 'interaction-token',
  guild_id: '1310007885656363068',
  member: { user: { id: 'actor' }, roles },
  data: {
    options: [{
      name: command,
      options: [
        { name: 'tag', value: '#abc' },
        { name: 'token', value: 'api-token' },
        { name: 'user', value: 'target' },
      ],
    }],
  },
} as unknown as APIChatInputApplicationCommandInteraction);

beforeEach(() => {
  jest.resetAllMocks();
});

test('co-leader adds an unverified link', async () => {
  send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({});
  await handleLink(interaction('add', ['1459375267255554130']));
  expect(send.mock.calls[0][0]).toBeInstanceOf(QueryCommand);
  const put = send.mock.calls[1][0] as PutCommand;
  expect(put.input.Item).toEqual({
    pk: 'target', sk: 'player#ABC', id: 'target', tag: '#ABC', verified: false,
  });
  expect(put.input.ConditionExpression).toBe('attribute_not_exists(pk)');
  expect(verify).not.toHaveBeenCalled();
});

test('denies a user without a permitted role', async () => {
  await handleLink(interaction('add'));
  expect(send).not.toHaveBeenCalled();
  expect(updateResponse).toHaveBeenCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('Only admins and co-leaders'),
  });
});

test('only Point staff can start the spreadsheet import', async () => {
  await handleLink(interaction('import'));
  expect(importPointPlayerLinks).not.toHaveBeenCalled();
  expect(updateResponse).toHaveBeenCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('Only Point admins and co-leaders'),
  });
  jest.mocked(importPointPlayerLinks).mockResolvedValueOnce({
    created: 1, existing: 2, conflicts: 3, invalid: 4, failed: 5,
  });
  await handleLink(interaction('import', ['1459375267255554130']));
  expect(importPointPlayerLinks).toHaveBeenCalledTimes(1);
  expect(updateResponse).toHaveBeenLastCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('1 linked without verification, 2 already linked, 3 conflicts, 4 invalid or blank rows, 5 failed'),
  });
});

test('does not replace a player linked to another user', async () => {
  send.mockResolvedValueOnce({ Items: [{ pk: 'other' }] });
  await handleLink(interaction('add', ['1459377224699482379']));
  expect(send).toHaveBeenCalledTimes(1);
  expect(updateResponse).toHaveBeenCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('another Discord account'),
  });
});

test("verifies only the invoking user's existing unverified link", async () => {
  send.mockResolvedValueOnce({ Item: { verified: false } }).mockResolvedValueOnce({});
  await handleLink(interaction('verify'));
  const get = send.mock.calls[0][0] as GetCommand;
  expect(get.input.Key).toEqual({ pk: 'actor', sk: 'player#ABC' });
  expect(verify).toHaveBeenCalledWith('#ABC', 'api-token');
  const update = send.mock.calls[1][0] as UpdateCommand;
  expect(update.input.Key).toEqual(get.input.Key);
  expect(update.input.ExpressionAttributeValues).toEqual({
    ':verified': true, ':unverified': false,
  });
});

test.each([
  ['missing', {}],
  ['legacy verified', { Item: {} }],
  ['already verified', { Item: { verified: true } }],
])('does not verify a %s link', async (_label, result) => {
  send.mockResolvedValueOnce(result);
  await handleLink(interaction('verify'));
  expect(verify).not.toHaveBeenCalled();
  expect(send).toHaveBeenCalledTimes(1);
});

test('does not mark a link verified when token verification fails', async () => {
  send.mockResolvedValueOnce({ Item: { verified: false } });
  jest.mocked(verify).mockRejectedValueOnce(new Error('invalid token'));
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  await handleLink(interaction('verify'));
  expect(send).toHaveBeenCalledTimes(1);
  expect(updateResponse).toHaveBeenCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('issue verifying'),
  });
  consoleError.mockRestore();
});

test('create directs an existing unverified link to verification', async () => {
  send.mockResolvedValueOnce({ Items: [{ pk: 'actor', verified: false }] });
  await handleLink(interaction('create'));
  expect(verify).not.toHaveBeenCalled();
  expect(updateResponse).toHaveBeenCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('/link verify'),
  });
});
