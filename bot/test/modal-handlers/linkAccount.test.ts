import { APIModalSubmitInteraction } from 'discord-api-types/v10';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { submitLinkAccountModal } from '../../src/modal-handlers/linkAccount';
import { dynamoDbClient } from '../../src/clients/dynamodb-client';
import { getModalTextInputValue } from '../../src/util/modalComponents';
import { verify } from '../../src/adapters/coc-api-adapter';
import { updateResponse } from '../../src/adapters/discord-adapter';

jest.mock('../../src/clients/dynamodb-client', () => ({
  dynamoDbClient: { send: jest.fn() },
}));
jest.mock('../../src/adapters/coc-api-adapter', () => ({ verify: jest.fn() }));
jest.mock('../../src/adapters/discord-adapter', () => ({ updateResponse: jest.fn() }));
jest.mock('../../src/util/modalComponents', () => ({ getModalTextInputValue: jest.fn() }));

const send = dynamoDbClient.send as jest.Mock;
const interaction = {
  application_id: 'app',
  token: 'interaction-token',
  member: { user: { id: 'actor' } },
} as unknown as APIModalSubmitInteraction;

beforeEach(() => {
  jest.resetAllMocks();
  jest.mocked(getModalTextInputValue).mockReturnValueOnce('#abc').mockReturnValueOnce('token');
});

test('stores token-verified modal links as verified', async () => {
  send.mockResolvedValueOnce({ Items: [] }).mockResolvedValueOnce({});
  await submitLinkAccountModal(interaction);
  expect(verify).toHaveBeenCalledWith('#ABC', 'token');
  const put = send.mock.calls[1][0] as PutCommand;
  expect(put.input.Item).toMatchObject({ pk: 'actor', tag: '#ABC', verified: true });
});

test('directs an existing unverified modal link to verification', async () => {
  send.mockResolvedValueOnce({ Items: [{ pk: 'actor', verified: false }] });
  await submitLinkAccountModal(interaction);
  expect(verify).not.toHaveBeenCalled();
  expect(updateResponse).toHaveBeenCalledWith('app', 'interaction-token', {
    content: expect.stringContaining('/link verify'),
  });
});
