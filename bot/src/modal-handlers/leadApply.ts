import { APIApplicationCommandInteraction, APIApplicationCommandInteractionDataStringOption, APIChatInputApplicationCommandInteraction, APIMessageComponentInteraction, APIModalSubmitInteraction, ChannelType, ComponentType, InteractionType, OverwriteType, PermissionFlagsBits } from "discord-api-types/v10"
import { getConfig, ServerConfig } from "../util/serverConfig";
import { createChannel, pinMessage, sendMessage, updateResponse } from "../adapters/discord-adapter";
import { BUTTONS } from "../component-handlers/buttons";
import { getCommandOptionData } from "../util/interaction-util";
import { buildModal } from "./utils";

export const createLeadApplyModal = (interaction: APIMessageComponentInteraction | APIApplicationCommandInteraction) => {
    if (interaction.type === InteractionType.ApplicationCommand) {
        const role = getCommandOptionData<APIApplicationCommandInteractionDataStringOption>(
            interaction as APIChatInputApplicationCommandInteraction,
            "role"
        );
        switch (role) {
            default:
                return buildGeneralLeadApplicationModal();
        }
    } else {
        return buildGeneralLeadApplicationModal();
    }
};

const buildGeneralLeadApplicationModal = () => {
    return buildModal(
        "leadApplicationModal", 
        "Apply for leadership with This Clan Now",
        [
            {
                id: "role",
                label: "What role are you applying for?",
            },
            {
                id: "reason",
                label: "Why do you think you deserve this role?"
            },
            {
                id: "value",
                label: "What value would you bring to this role?"
            }
        ]
    );
}

export const submitLeadApplyModal = async (interaction: APIModalSubmitInteraction) => {
    try {
        const config = getConfig(interaction.guild_id!);
        const applicationChannel = await createLeadApplicationChannel(interaction, config);
        const message = await sendMessage(
            {
                content: `<@&${config.ADMIN_ROLE}>\nHey <@${interaction.member!.user.id}> thanks for applying! We've attached your original responses below for reference, but feel free to tell us more about yourself!`,
                embeds: [],
                components: [
                    {
                        type: ComponentType.ActionRow,
                        components: [
                            BUTTONS.CLOSE_LEAD_TICKET,
                            BUTTONS.DELETE_LEAD_TICKET,
                        ]
                    }
                ]
            },
            applicationChannel.id
        );
        await pinMessage(message.channel_id, message.id);
        await updateResponse(interaction.application_id, interaction.token, {
            content: `Thanks for your application ${interaction.member?.user.id}!`,
        })
    } catch (err) {
        console.error(`Failure building lead application channel: ${err}`);
        await updateResponse(interaction.application_id, interaction.token, {
            content: "There was an issue opening your application, if you do not see an application channel please resubmit"
        });
    }
}

const createLeadApplicationChannel = async (
    interaction: APIModalSubmitInteraction,
    config: ServerConfig
) => {
    const applicant = interaction.member!.user;
    const channel = await createChannel(
        {
            name: `\u{1F39F}-lead-${applicant.username}`,
            type: ChannelType.GuildText,
            topic: `Lead Application channel for ${applicant.username}`,
            parent_id: config.LEAD_APPLICATION_CATEGORY,
            permission_overwrites: [
                {
                    id: interaction.guild_id!,
                    type: OverwriteType.Role,
                    allow: "0",
                    deny: PermissionFlagsBits.ViewChannel.toString(),
                },
                {
                    id: applicant.id,
                    type: OverwriteType.Member,
                    allow: (
                        PermissionFlagsBits.ViewChannel |
                        PermissionFlagsBits.AddReactions | 
                        PermissionFlagsBits.SendMessages
                    ).toString(),
                    deny: "0"
                },
                {
                    id: config.BOT_ID,
                    type: OverwriteType.Member,
                    allow: (
                        PermissionFlagsBits.ViewChannel |
                        PermissionFlagsBits.SendMessages
                    ).toString(),
                    deny: "0"
                }
            ]
        },
        interaction.guild_id!
    );
    return channel;
}