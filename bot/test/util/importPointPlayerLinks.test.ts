import axios from 'axios';
import { PutCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../../src/clients/dynamodb-client';
import { importPointPlayerLinks } from '../../src/util/importPointPlayerLinks';

jest.mock('axios');
jest.mock('../../src/clients/dynamodb-client', () => ({
  dynamoDbClient: { send: jest.fn() },
}));

const send = dynamoDbClient.send as jest.Mock;

beforeEach(() => jest.resetAllMocks());

test('imports unverified links, preserves existing records, and reports conflicts and failures', async () => {
  jest.mocked(axios.get).mockResolvedValueOnce({ data: [
    'ID,Tag,Verified',
    '12345678901234567,#AAA,Yes',
    '12345678901234567,#AAA,Yes',
    '12345678901234567,#BBB,No',
    '12345678901234567,#CCC,No',
    '12345678901234567,,No',
    '12345678901234567,#DDD,No',
    '22345678901234567,#DDD,No',
    '12345678901234567,#EEE,No',
  ].join('\n') });
  send.mockImplementation(async (command: QueryCommand | PutCommand) => {
    if (command instanceof QueryCommand) {
      const key = command.input.ExpressionAttributeValues?.[':sk'];
      if (key === 'player#BBB') return { Items: [{ pk: '12345678901234567', verified: true }] };
      if (key === 'player#CCC') return { Items: [{ pk: '22345678901234567' }] };
      return { Items: [] };
    }
    if (command.input.Item?.tag === '#EEE') throw new Error('database error');
    return {};
  });
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  await expect(importPointPlayerLinks()).resolves.toEqual({
    created: 1, existing: 1, conflicts: 2, invalid: 1, failed: 1,
  });
  const puts = send.mock.calls.map(([command]) => command).filter(
    (command): command is PutCommand => command instanceof PutCommand,
  );
  expect(puts).toHaveLength(2);
  expect(puts.find((put) => put.input.Item?.tag === '#AAA')?.input).toMatchObject({
    Item: { pk: '12345678901234567', sk: 'player#AAA', verified: false },
    ConditionExpression: 'attribute_not_exists(pk)',
  });
  consoleError.mockRestore();
});

test('rejects a spreadsheet with missing columns before writing', async () => {
  jest.mocked(axios.get).mockResolvedValueOnce({ data: 'ID,Name\n12345678901234567,Player' });
  await expect(importPointPlayerLinks()).rejects.toThrow('missing ID or Tag');
  expect(send).not.toHaveBeenCalled();
});
