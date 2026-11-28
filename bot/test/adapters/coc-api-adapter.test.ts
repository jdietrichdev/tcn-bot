import axios from 'axios';
import { verify } from '../../src/adapters/coc-api-adapter';

jest.mock('axios');

test('accepts only a successful token verification response', async () => {
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { status: 'ok' } });
  await expect(verify('#ABC', 'token')).resolves.toBeUndefined();
});

test.each(['invalid', undefined])('rejects verification status %s', async (status) => {
  jest.mocked(axios.post).mockResolvedValueOnce({ data: { status } });
  const consoleError = jest.spyOn(console, 'error').mockImplementation();
  await expect(verify('#ABC', 'token')).rejects.toThrow('Unable to validate account');
  consoleError.mockRestore();
});
