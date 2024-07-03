import { updateMessage } from "../../src/adapters/discord-adapter";
import axios from 'axios';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const BASE_URL = 'https://discord.com/api/v10';

test('updateMessage should call patch with correct parameters', async () => {
    await updateMessage('appId', 'token', { type: 1 });
    expect(mockedAxios.patch).toHaveBeenCalledWith(
        `${BASE_URL}/webhooks/appId/token/messages/@original`,
        JSON.stringify({ type: 1 })
    )
});