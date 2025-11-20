import axios from 'axios';

export const fetchClanRosterFromGoogleSheet = async (url: string) => {
  const response = await axios.get(url);
  return response.data;
--- a/bot/src/command-handlers/clanShow.ts
+++ b/bot/src/command-handlers/clanShow.ts
@@ -26,7 +26,7 @@
     const clan = await getClan(clanName);
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)
@@ -36,7 +36,7 @@
     }
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)
@@ -46,7 +46,7 @@
     }
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)

};--- a/bot/src/command-handlers/clanShow.ts
+++ b/bot/src/command-handlers/clanShow.ts
@@ -26,7 +26,7 @@
     const clan = await getClan(clanName);
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)
@@ -36,7 +36,7 @@
     }
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)
@@ -46,7 +46,7 @@
     }
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)

--- a/bot/src/command-handlers/clanShow.ts
+++ b/bot/src/command-handlers/clanShow.ts
@@ -26,7 +26,7 @@
     const clan = await getClan(clanName);
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)
@@ -36,7 +36,7 @@
     }
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)
@@ -46,7 +46,7 @@
     }
 
     if (clan && clan.sheetId) {
-      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId, 'A', 'B');
+      const roster = await fetchClanRosterFromGoogleSheet(clan.sheetId);
       if (roster) {
         const embed = new EmbedBuilder()
           .setTitle(`${clan.name} Roster`)


