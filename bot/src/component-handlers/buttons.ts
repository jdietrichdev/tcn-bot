import { APIButtonComponentWithCustomId, ButtonStyle, ComponentType } from "discord-api-types/v10";

export const BUTTONS = {
    CLOSE_TICKET: {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: "Close",
        custom_id: "closeTicket",
    } as APIButtonComponentWithCustomId,
    REOPEN_TICKET: {
        type: ComponentType.Button,
        style: ButtonStyle.Secondary,
        label: "Reopen",
        custom_id: "reopenTicket",
    } as APIButtonComponentWithCustomId,
    DELETE_TICKET: {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Delete",
        custom_id: "deleteTicket",
    } as APIButtonComponentWithCustomId,
    GRANT_ROLES: {
        type: ComponentType.Button,
        style: ButtonStyle.Success,
        label: "Grant Roles",
        custom_id: "grantRoles",
    } as APIButtonComponentWithCustomId,
    REMOVE_ROLES: {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Remove Roles",
        custom_id: "removeRoles",
    } as APIButtonComponentWithCustomId,
    APPROVE_APP: {
        type: ComponentType.Button,
        style: ButtonStyle.Success,
        label: "Approve",
        custom_id: "approveApp"
    } as APIButtonComponentWithCustomId,
    DENY_APP: {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Deny",
        custom_id: "denyApp"
    } as APIButtonComponentWithCustomId,
    MESSAGE_RECRUIT: {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: "Messaged",
        custom_id: "messageRecruit",
    } as APIButtonComponentWithCustomId,
    CLOSE_RECRUIT: {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Close",
        custom_id: "closeRecruit",
    } as APIButtonComponentWithCustomId,
}