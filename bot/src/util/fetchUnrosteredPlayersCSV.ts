import { parse } from 'csv-parse/sync';
import https from 'https';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTL3sSwoCebgxF1B9-3e-HMumXEN9FM7k8AkirJX0RDA-S2u1QiwMYoiGD83VCdtgKBNA8EEqZaASf9/pub?gid=0&single=true&output=csv';

export interface PlayerData {
  name: string;
  discord: string;
  avgStars: string;
  defenseAvgStars: string;
}

export async function fetchUnrosteredPlayersFromCSV(): Promise<string[]> {
  const fileContent: string = await new Promise((resolve, reject) => {
    const fetchWithRedirect = (url: string, maxRedirects = 5) => {
      if (maxRedirects === 0) {
        reject(new Error('Too many redirects'));
        return;
      }
      let data = '';
      https
        .get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            if (res.headers.location) {
              fetchWithRedirect(res.headers.location, maxRedirects - 1);
            } else {
              reject(new Error('Redirect without location header'));
            }
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch CSV: HTTP ${res.statusCode}`));
            return;
          }
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        })
        .on('error', reject);
    };
    fetchWithRedirect(CSV_URL);
  });
  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
  });
  return records
    .slice(2) // Skip first 2 rows (headers are in row 2, so skip rows 1 and 2)
    .map((row: string[]) => row[0])
    .filter((name: string) => {
      if (!name || name.trim() === '') return false;
      const trimmedName = name.trim();
      return trimmedName !== 'A2' && trimmedName !== 'Name' && trimmedName !== 'name';
    });
}

export async function fetchPlayersWithDetailsFromCSV(): Promise<PlayerData[]> {
  const fileContent: string = await new Promise((resolve, reject) => {
    const fetchWithRedirect = (url: string, maxRedirects = 5) => {
      if (maxRedirects === 0) {
        reject(new Error('Too many redirects'));
        return;
      }
      let data = '';
      https
        .get(url, (res) => {
          if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
            if (res.headers.location) {
              fetchWithRedirect(res.headers.location, maxRedirects - 1);
            } else {
              reject(new Error('Redirect without location header'));
            }
            return;
          }
          if (res.statusCode !== 200) {
            reject(new Error(`Failed to fetch CSV: HTTP ${res.statusCode}`));
            return;
          }
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => resolve(data));
          res.on('error', reject);
        })
        .on('error', reject);
    };
    fetchWithRedirect(CSV_URL);
  });
  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
  });
  
  // Skip first 2 rows (headers are in row 2)
  return records
    .slice(2)
    .map((row: string[]) => ({
      name: row[0] || '',           // Column A (index 0)
      discord: row[5] || '',         // Column F (index 5)
      avgStars: row[12] || '',       // Column M (index 12)
      defenseAvgStars: row[21] || '', // Column V (index 21)
    }))
    .filter((player: PlayerData) => {
      if (!player.name || player.name.trim() === '') return false;
      const trimmedName = player.name.trim();
      return trimmedName !== 'A2' && trimmedName !== 'Name' && trimmedName !== 'name';
    });
}
