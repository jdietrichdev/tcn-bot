import { parse } from 'csv-parse/sync';
import https from 'https';

const CWL_RESPONSES_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vSA-XND1cdl7eIX4B65CFXVNvX9w9ZVSqAz3smHOO9dU9NpOb50rItnV_8wykS995fBESuABePaP99x/pub?gid=696085494&single=true&output=csv';

export interface CWLResponse {
  discordId: string;
  username: string;
  league: string;
  availability: string;
  competitiveness: string;
  otherNotes: string;
}

export async function fetchCWLResponses(): Promise<CWLResponse[]> {
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
    fetchWithRedirect(CWL_RESPONSES_URL);
  });

  const records = parse(fileContent, {
    columns: false,
    skip_empty_lines: true,
  });

  const parseNotes = (notes: string) => {
    const league = notes.match(/League:\s*([^/]+)/)?.[1]?.trim() || 'Not specified';
    const availability = notes.match(/Availability:\s*([^/]+)/)?.[1]?.trim() || 'Not specified';
    const competitiveness = notes.match(/Competitiveness:\s*([^/]+)/)?.[1]?.trim() || 'Not specified';
    const otherNotes = notes.match(/Other notes:\s*(.+)$/)?.[1]?.trim() || 'None';

    return {
      league,
      availability,
      competitiveness,
      otherNotes,
    };
  };

  return records
    .slice(1) 
    .map((row: string[]) => {
      const parsed = parseNotes(row[2] || '');
      return {
        discordId: row[0] || '',
        username: row[1] || '',
        league: parsed.league,
        availability: parsed.availability,
        competitiveness: parsed.competitiveness,
        otherNotes: parsed.otherNotes,
      };
    })
    .filter((response: CWLResponse) => response.discordId && response.username);
}
