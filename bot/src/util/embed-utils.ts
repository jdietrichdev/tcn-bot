import { APIEmbed } from 'discord-api-types/v10';

export function createErrorEmbed(title: string, description: string): APIEmbed {
  return {
    color: 0xff0000,
    title,
    description,
    timestamp: new Date().toISOString()
  };
}

export function createSuccessEmbed(title: string, description: string, fields: any[], footerText: string): APIEmbed {
  return {
    color: 0x00ff00,
    title,
    description,
    fields,
    timestamp: new Date().toISOString(),
    footer: {
      text: footerText
    }
  };
}

export function getStatusEmoji(status: string): string {
  const statusEmojis = {
    pending: '📬',
    claimed: '📪',
    completed: '✅',
    approved: '☑️'
  };
  return statusEmojis[status as keyof typeof statusEmojis] || '❓';
}

export function getStatusText(status: string): string {
  const statusTexts = {
    pending: 'Pending',
    claimed: 'Claimed',
    completed: 'Ready for Review',
    approved: 'Approved'
  };
  return statusTexts[status as keyof typeof statusTexts] || 'Unknown';
}

export function getPriorityEmoji(priority: string): string {
  const priorityEmojis = {
    high: '🔴',
    medium: '🟡',
    low: '🟢'
  };
  return priorityEmojis[priority as keyof typeof priorityEmojis] || '🟡';
}
