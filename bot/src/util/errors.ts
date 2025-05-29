export class DiscordError extends Error {
    public statusCode: number;
    public message: string;
    public reason: string;

    constructor(message: string, reason: string, statusCode: number) {
        super(message);
        this.name = 'DiscordError';
        this.statusCode = statusCode;
        this.reason = reason;
        this.message = message;
    }

    toString(): string {
        return `${this.message}: [${this.statusCode}] ${this.reason}`;
    }
}