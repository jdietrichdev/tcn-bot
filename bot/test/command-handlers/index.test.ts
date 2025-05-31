import { EventBridgeEvent } from "aws-lambda"
import { handleCommand } from "../../src/command-handlers"
import * as commands from "../../src/command-handlers/handlers"
import { APIChatInputApplicationCommandInteraction } from "discord-api-types/v10"

jest.mock("../../src/command-handlers/handlers");

test('handleCommand should run handleHello when event is for hello', async () => {
    const event = buildEvent("hello");
    await handleCommand(event)
    expect(commands.handleHello).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should run handlePlayer when event is for player', async () => {
    const event = buildEvent("player");
    await handleCommand(event);
    expect(commands.handlePlayer).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should run handleEvent when event is for event', async () => {
    const event = buildEvent("event");
    await handleCommand(event);
    expect(commands.handleEvent).toHaveBeenCalledWith(event.detail);
});

test("handleCommand should run handleLink when event is for link", async () => {
    const event = buildEvent("link");
    await handleCommand(event);
    expect(commands.handleLink).toHaveBeenCalledWith(event.detail);
});

test("handleCommand should run handleTest when event is for test", async () => {
    const event = buildEvent("test");
    await handleCommand(event);
    expect(commands.handleTest).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should run handleUpgrade when event is for upgrade', async () => {
    const event = buildEvent("test");
    await handleCommand(event);
    expect(commands.handleTest).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should run handleRecruit when event is for ro', async () => {
    const event = buildEvent("ro");
    await handleCommand(event);
    expect(commands.handleRecruit).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should run handleRecruiterScore when event is for recruiter-score', async () => {
    const event = buildEvent("recruiter-score");
    await handleCommand(event);
    expect(commands.handleRecruiterScore).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should run handleCommandNotFound when event is for invalid command', async () => {
    const event = buildEvent("invalid");
    await handleCommand(event);
    expect(commands.handleCommandNotFound).toHaveBeenCalledWith(event.detail);
});

test('handleCommand should call handleFailure when failure processing command', async () => {
    jest.mocked(commands.handleTest).mockRejectedValue(new Error("Failed"));
    const event = buildEvent("test");
    await handleCommand(event);
    expect(commands.handleFailure).toHaveBeenCalledWith(event.detail);

})

const buildEvent = (name: string) => {
    return {
        detail: {
            data: {
                name
            }
        }
    } as EventBridgeEvent<string, APIChatInputApplicationCommandInteraction>
}