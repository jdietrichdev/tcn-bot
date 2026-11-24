import axios from 'axios';
import { parse } from 'csv-parse/sync';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient } from '../clients/dynamodb-client';
import { findPlayerLinks, normalizePlayerTag } from './playerLink';

const CSV_URL =
  'https://docs.google.com/spreadsheets/d/e/2PACX-1vRmeyRyjbJ_y_Bwu7DFZGhUGOjIobx2S8dR5nzDLpF5gInnuc2VSWOM8cBYS71oUV39gRJSjHKk7raq/pub?output=csv';

interface ImportResult {
  created: number;
  existing: number;
  conflicts: number;
  invalid: number;
  failed: number;
}

export const importPointPlayerLinks = async (): Promise<ImportResult> => {
  const response = await axios.get<string>(CSV_URL, {
    responseType: 'text',
    timeout: 15000,
    maxContentLength: 2 * 1024 * 1024,
  });
  const rows = parse(response.data, {
    columns: (columns: string[]) => {
      if (!columns.includes('ID') || !columns.includes('Tag')) {
        throw new Error('Spreadsheet is missing ID or Tag columns');
      }
      return columns;
    },
    bom: true,
    skip_empty_lines: true,
    trim: true,
  }) as { ID: string; Tag: string }[];
  if (!rows.length) throw new Error('Spreadsheet has no rows');

  const result: ImportResult = {
    created: 0, existing: 0, conflicts: 0, invalid: 0, failed: 0,
  };
  const players = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!/^\d{17,20}$/.test(row.ID) || !row.Tag) {
      result.invalid++;
      continue;
    }
    let tag: string;
    try {
      tag = normalizePlayerTag(row.Tag);
    } catch {
      result.invalid++;
      continue;
    }
    const users = players.get(tag) ?? new Set<string>();
    users.add(row.ID);
    players.set(tag, users);
  }

  const entries = [...players.entries()];
  for (let i = 0; i < entries.length; i += 10) {
    await Promise.all(entries.slice(i, i + 10).map(async ([tag, users]) => {
      if (users.size !== 1) {
        result.conflicts++;
        return;
      }
      const user = [...users][0];
      try {
        const links = await findPlayerLinks(tag);
        if (links.length) {
          if (links.every((link) => link.pk === user)) result.existing++;
          else result.conflicts++;
          return;
        }
        await dynamoDbClient.send(new PutCommand({
          TableName: 'BotTable',
          Item: { pk: user, sk: `player#${tag.substring(1)}`, id: user, tag, verified: false },
          ConditionExpression: 'attribute_not_exists(pk)',
        }));
        result.created++;
      } catch (err) {
        console.error('Failed to import a player link:', err);
        result.failed++;
      }
    }));
  }
  return result;
};
