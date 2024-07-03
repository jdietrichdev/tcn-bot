import axios from 'axios';
import { commands } from './commands';

const url = `https://discord.com/api/v10/applications/${process.env.APPLICATION_ID}/commands`;
console.log(url);
const headers = {
    Authorization: `Bot ${process.env.BOT_TOKEN}`,
    'Content-Type': 'application/json'
};
console.log(process.env.BOT_TOKEN);
axios.put(url, JSON.stringify(commands), { headers })
    .then(() => console.log('Commands updated'))
    .catch(e => {
        console.log('Failed to update commands', e);
        throw e;
    });