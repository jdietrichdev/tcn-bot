import {
  APIButtonComponentWithCustomId,
  ButtonStyle,
  ComponentType,
} from "discord-api-types/v10";

export const BUTTONS = {
  CLOSE_TICKET: {
    type: ComponentType.Button,
    style: ButtonStyle.Primary,
    label: "Close",
    custom_id: "closeTicket",
  } as APIButtonComponentWithCustomId,
  CLOSE_LEAD_TICKET: {
    type: ComponentType.Button,
    style: ButtonStyle.Primary,
    label: "Close",
    custom_id: "closeLeadTicket",
  } as APIButtonComponentWithCustomId,
  REOPEN_TICKET: {
    type: ComponentType.Button,
    style: ButtonStyle.Secondary,
    label: "Reopen",
    custom_id: "reopenTicket",
  } as APIButtonComponentWithCustomId,
  REOPEN_LEAD_TICKET: {
    type: ComponentType.Button,
    style: ButtonStyle.Secondary,
    label: "Reopen",
    custom_id: "reopenLeadTicket",
  } as APIButtonComponentWithCustomId,
  DELETE_TICKET: {
    type: ComponentType.Button,
    style: ButtonStyle.Danger,
    label: "Delete",
    custom_id: "deleteTicket",
  } as APIButtonComponentWithCustomId,
  DELETE_LEAD_TICKET: {
    type: ComponentType.Button,
    style: ButtonStyle.Danger,
    label: "Delete",
    custom_id: "deleteLeadTicket",
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
    custom_id: "approveApp",
  } as APIButtonComponentWithCustomId,
  DENY_APP: {
    type: ComponentType.Button,
    style: ButtonStyle.Danger,
    label: "Deny",
    custom_id: "denyApp",
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
  CONFIRM_DELETE: {
    type: ComponentType.Button,
    style: ButtonStyle.Success,
    label: "Yes",
    custom_id: "confirmDelete",
  } as APIButtonComponentWithCustomId,
  REJECT_DELETE: {
    type: ComponentType.Button,
    style: ButtonStyle.Secondary,
    label: "Never mind",
    custom_id: "rejectDelete",
  } as APIButtonComponentWithCustomId,
  CWL_QUESTIONS: {
    type: ComponentType.Button,
    style: ButtonStyle.Success,
    label: "Answer Questions",
    custom_id: "cwlQuestions",
  } as APIButtonComponentWithCustomId,
  EXPORT_CWL_QUESTIONS: {
    type: ComponentType.Button,
    style: ButtonStyle.Secondary,
    label: "Export Responses",
    custom_id: "exportCwlQuestions",
  } as APIButtonComponentWithCustomId,
  SIGNUP_CWL: {
    type: ComponentType.Button,
    style: ButtonStyle.Success,
    label: "Signup",
    custom_id: "signupCwl"
  } as APIButtonComponentWithCustomId,
  CLOSE_CWL_SIGNUP: {
    type: ComponentType.Button,
    style: ButtonStyle.Secondary,
    label: "Close Signup",
    custom_id: "closeSignup"
  } as APIButtonComponentWithCustomId,
};
