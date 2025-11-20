
import { parse } from 'csv-parse/sync';
import https from 'https';

const CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRckzbRnsega-kND3dWkpaeMe78An7gD6Z3YM-vkaxTyXf1KMXDIgNB917_sJ5zyhNT7LKwK6fWstnJ/pub?gid=1984635118&single=true&output=csv';

export interface ClanPlayer {
  accountName: string;
  playerTag: string;
  discordUsername: string;
}

export interface ClanRoster {
  clanName: string;
  players: ClanPlayer[];
}

export async function fetchClanRoster(): Promise<ClanRoster> {
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

  const clanName = records[1][1]; // Cell B2
  const players: ClanPlayer[] = records
    .slice(2, 49) // Rows 3 to 48
    .map((row: any) => ({
      accountName: row[1], // Column B
      playerTag: row[2], // Column C
      discordUsername: row[3], // Column D
    }))
    .filter((player: ClanPlayer) => player.playerTag && player.playerTag.trim() !== '');

  return {
    clanName,
    players,
  };
}
