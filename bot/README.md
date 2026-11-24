# Account links

- `/link create` links and verifies your player tag using your Clash API token.
- `/link verify` verifies an unverified tag already linked to your Discord account.
- `/link add` lets a configured admin or co-leader link a tag to a Discord user without verifying it.
- Point admins and co-leaders, and test server admins, can run `/link import` to import the configured published spreadsheet. The command creates unverified links, skips invalid rows, and leaves existing links unchanged; it reports conflicts and failed writes for review. The spreadsheet's `Verified` column is not used. Both servers use the same link database.

Links created before verification status was recorded are treated as verified. Deploy the bot and register the updated slash commands before using new commands.

# CWL tryout tickets

The assigned player can press **Ready to Try Out** to notify configured CWL tryout staff. Closing a CWL tryout ticket saves its transcript and deletes the channel; other ticket types keep their existing close behavior.
Staff roles must be mentionable, or the bot must have the Mention Everyone permission in the ticket, for Discord to deliver role notifications. The button is added to newly created tickets.
