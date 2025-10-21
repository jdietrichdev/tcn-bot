import { EventBridgeEvent } from "aws-lambda";
import { handleCommand } from "../../src/command-handlers";
import * as commands from "../../src/command-handlers/handlers";
import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10";

jest.mock("../../src/command-handlers/handlers");

test("should run handleHello when event is for hello", async () => {
  const event = buildEvent("hello");
  await handleCommand(event);
  expect(commands.handleHello).toHaveBeenCalledWith(event.detail);
});

test("should run handlePlayer when event is for player", async () => {
  const event = buildEvent("player");
  await handleCommand(event);
  expect(commands.handlePlayer).toHaveBeenCalledWith(event.detail);
});

test("should run handleEvent when event is for event", async () => {
  const event = buildEvent("event");
  await handleCommand(event);
  expect(commands.handleEvent).toHaveBeenCalledWith(event.detail);
});

test("should run handleLink when event is for link", async () => {
  const event = buildEvent("link");
  await handleCommand(event);
  expect(commands.handleLink).toHaveBeenCalledWith(event.detail);
});

test("should run handleTest when event is for test", async () => {
  const event = buildEvent("test");
  await handleCommand(event);
  expect(commands.handleTest).toHaveBeenCalledWith(event.detail);
});

test("should run handleUpgrade when event is for upgrade", async () => {
  const event = buildEvent("upgrade");
  await handleCommand(event);
  expect(commands.handleUpgrade).toHaveBeenCalledWith(event.detail);
});

test("should run handleRecruit when event is for ro", async () => {
  const event = buildEvent("ro");
  await handleCommand(event);
  expect(commands.handleRecruit).toHaveBeenCalledWith(event.detail);
});

test("should run handleRecruiterScore when event is for recruiter-score", async () => {
  const event = buildEvent("recruiter-score");
  await handleCommand(event);
  expect(commands.handleRecruiterScore).toHaveBeenCalledWith(event.detail);
});

test("should run handleCwlRoster when event is for cwl-roster", async () => {
  const event = buildEvent("cwl-roster");
  await handleCommand(event);
  expect(commands.handleCwlRoster).toHaveBeenCalledWith(event.detail);
});

test("should run handleInitiateCwlSignup when event is for initiate-cwl-signup", async () => {
  const event = buildEvent("initiate-cwl-signup");
  await handleCommand(event);
  expect(commands.handleInitiateCwlSignup).toHaveBeenCalledWith(event.detail);
});

test("should run handleCwlQuestions when event is for cwl-questions", async () => {
  const event = buildEvent("cwl-questions");
  await handleCommand(event);
  expect(commands.handleCwlQuestions).toHaveBeenCalledWith(event.detail);
});

test("should run closeTicket when event is for close-ticket", async () => {
  const event = buildEvent("close-ticket");
  await handleCommand(event);
  expect(commands.closeTicket).toHaveBeenCalledWith(event.detail);
});

test("should run deleteTicket when event is for delete-ticket", async () => {
  const event = buildEvent("delete-ticket");
  await handleCommand(event);
  expect(commands.deleteTicket).toHaveBeenCalledWith(event.detail);
});

test("should run handleCreateEvent when event is for create-event", async () => {
  const event = buildEvent("create-event");
  await handleCommand(event);
  expect(commands.handleCreateEvent).toHaveBeenCalledWith(event.detail);
});

test("should run handleQuestionCreate when event is for question-create", async () => {
  const event = buildEvent("question-create");
  await handleCommand(event);
  expect(commands.handleQuestionCreate).toHaveBeenCalledWith(event.detail);
});

test("should run handleQuestionClose when event is for question-close", async () => {
  const event = buildEvent("question-close");
  await handleCommand(event);
  expect(commands.handleQuestionClose).toHaveBeenCalledWith(event.detail);
});

test("should run handleQuestionAnswer when event is for question-answer", async () => {
  const event = buildEvent("question-answer");
  await handleCommand(event);
  expect(commands.handleQuestionAnswer).toHaveBeenCalledWith(event.detail);
});

test("should run handleEventLeaderboard when event is for event-leaderboard", async () => {
  const event = buildEvent("event-leaderboard");
  await handleCommand(event);
  expect(commands.handleEventLeaderboard).toHaveBeenCalledWith(event.detail);
});

test("should run handleEventWinner when event is for event-winner", async () => {
  const event = buildEvent("event-winner");
  await handleCommand(event);
  expect(commands.handleEventWinner).toHaveBeenCalledWith(event.detail);
});

test("should run handleNominate when event is for nominate", async () => {
  const event = buildEvent("nominate");
  await handleCommand(event);
  expect(commands.handleNominate).toHaveBeenCalledWith(event.detail);
});

test("should run handleNominationResult when event is for nomination-result", async () => {
  const event = buildEvent("nomination-result");
  await handleCommand(event);
  expect(commands.handleNominationResult).toHaveBeenCalledWith(event.detail);
});

test("should run handleRankProposalReminder when event is for rank-proposal-reminder", async () => {
  const event = buildEvent("rank-proposal-reminder");
  await handleCommand(event);
  expect(commands.handleRankProposalReminder).toHaveBeenCalledWith(
    event.detail
  );
});

test("should run handleAnnounceRoster when event is for announce-roster", async () => {
  const event = buildEvent("announce-roster");
  await handleCommand(event);
  expect(commands.handleAnnounceRoster).toHaveBeenCalledWith(event.detail);
});

test("should run handleCommandNotFound when event is for invalid command", async () => {
  const event = buildEvent("invalid");
  await handleCommand(event);
  expect(commands.handleCommandNotFound).toHaveBeenCalledWith(event.detail);
});

test("should call handleFailure when failure processing command", async () => {
  jest.mocked(commands.handleTest).mockRejectedValue(new Error("Failed"));
  const event = buildEvent("test");
  await handleCommand(event);
  expect(commands.handleFailure).toHaveBeenCalledWith(event.detail);
});

const buildEvent = (name: string) => {
  return {
    detail: {
      data: {
        name,
      },
    },
  } as EventBridgeEvent<string, APIChatInputApplicationCommandInteraction>;
};
