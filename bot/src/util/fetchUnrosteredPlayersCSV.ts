import { parse } from 'csv-parse/sync';
import https from 'https';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vTL3sSwoCebgxF1B9-3e-HMumXEN9FM7k8AkirJX0RDA-S2u1QiwMYoiGD83VCdtgKBNA8EEqZaASf9/pub?gid=0&single=true&output=csv';

export async function fetchUnrosteredPlayersFromCSV(): Promise<string[]> {
  const fileContent: string = await new Promise((resolve, reject) => {
    let data = '';
    https
      .get(CSV_URL, (res) => {
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
  });
  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
  });
  return records
    .map((row: string[]) => row[0])
    .filter((name: string) => name && name.trim() !== '');
}
