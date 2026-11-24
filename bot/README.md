# Account links

- `/link create` links and verifies your player tag using your Clash API token.
- `/link verify` verifies an unverified tag already linked to your Discord account.
- `/link add` lets a configured admin or co-leader link a tag to a Discord user without verifying it.
- In the Point server, admins and co-leaders can run `/link import` to import the configured published spreadsheet. The command creates unverified links, skips invalid rows, and leaves existing links unchanged; it reports conflicts and failed writes for review. The spreadsheet's `Verified` column is not used.

Links created before verification status was recorded are treated as verified. Deploy the bot and register the updated slash commands before using new commands.
