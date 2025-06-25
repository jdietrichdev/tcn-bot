import { fetchTranscript } from "@/utils/transcriptHelper";
import { DiscordAttachments, DiscordCommand, DiscordEmbed, DiscordEmbedDescription, DiscordEmbedField, DiscordEmbedFields, DiscordImageAttachment, DiscordMessage, DiscordMessages, DiscordReaction, DiscordReactions } from "@skyra/discord-components-react";
import { Metadata } from "next";
import { notFound } from "next/navigation";

export const metadata: Metadata = {
  title: "Application Transcript"
}

export default async function Transcript({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let transcript;

  try {
    transcript = await fetchTranscript(`${id}.json`);
  } catch (err) {
    console.error(`Failed to fetch transcript ${err}`);
    notFound();
  }

  const getAvatar = (userId: string, avatar: string | null) => {
    if (!avatar) {
      const defaultAvatar = BigInt(userId) % BigInt(6);
      return `https://cdn.discordapp.com/embed/avatars/${defaultAvatar}.png`;
    } else {
      return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.${avatar.startsWith('a_') ? 'gif' : 'png'}`
    }
  }

  const getEmoji = (emoji: Record<string, any>) => {
    return `https://cdn.discordapp.com/emojis/${emoji.id}.${emoji.animated ? 'gif' : 'png'}`
  }

  return (
    <DiscordMessages>
      {transcript.map((message) => {
        if (message.type !== 6) {
          message.mentions.forEach((mention: Record<string, any>) => message.content = message.content.replace(`<@${mention.id}>`, `@${mention.global_name ?? mention.username}`));
          return <DiscordMessage key={message.id} content={message.content} author={message.author.global_name ?? message.author.username}
            timestamp={message.timestamp} avatar={getAvatar(message.author.id, message.author.avatar)}>
              {message.interaction && <DiscordCommand slot="reply" author={message.interaction.user.global_name ?? message.interaction.user.username} command={`/${message.interaction.name}`} />}
              {message.content}
              {message.embeds && message.embeds.map((embed: Record<string, any>, index: number) => (
                <DiscordEmbed slot="embeds" embedTitle={embed.title} key={index}>
                  <DiscordEmbedDescription slot="description">
                    {embed.description}
                  </DiscordEmbedDescription>
                  <DiscordEmbedFields slot="fields">
                    {embed.fields && embed.fields.map((field: Record<string, any>) => {
                      return <DiscordEmbedField fieldTitle={field.name} key={field.name}>
                        {field.value}
                      </DiscordEmbedField>
                    })}
                  </DiscordEmbedFields>
                </DiscordEmbed>
              ))}
              <DiscordAttachments slot="attachments">
                {message.attachments && message.attachments.map((attachment: Record<string, any>) => (
                    <DiscordImageAttachment url={attachment.url} height={100} width={100} alt={attachment.filename}  key={attachment.id}/>
                ))}
              </DiscordAttachments>
              <DiscordReactions slot="reactions">
                {message.reactions && message.reactions.map((reaction: Record<string, any>) => (
                  <DiscordReaction name={reaction.emoji.name} emoji={getEmoji(reaction.emoji)} count={reaction.count} key={reaction.emoji.id} />
                ))}
              </DiscordReactions>
          </DiscordMessage>;
        }
      })}
    </DiscordMessages>
  )
}