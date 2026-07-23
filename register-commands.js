/**
 * Laxmi | AstralyxPvP Assistant — Register Slash Commands
 * Run once: node register-commands.js
 */

import fetch from 'node-fetch';
import 'dotenv/config';

const TOKEN = process.env.DISCORD_TOKEN;
const APP_ID = process.env.DISCORD_APPLICATION_ID;

const commands = [
  {
    name: 'welcome-role-options',
    description: 'Post the notification role selector in the welcome channel [Staff only]'
  },
  {
    name: 'ignore-add',
    description: 'Add a channel to Laxmi ignore list [Staff only]',
    options: [{
      name: 'channel',
      description: 'Channel to ignore',
      type: 7, // CHANNEL
      required: true
    }]
  },
  {
    name: 'ignore-remove',
    description: 'Remove a channel from Laxmi ignore list [Staff only]',
    options: [{
      name: 'channel',
      description: 'Channel to unignore',
      type: 7, // CHANNEL
      required: true
    }]
  }
];

const res = await fetch(`https://discord.com/api/v10/applications/${APP_ID}/commands`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bot ${TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify(commands)
});

const data = await res.json();
if (res.ok) {
  console.log(`✅ Registered ${data.length} commands successfully!`);
  data.forEach(c => console.log(`  - /${c.name}`));
} else {
  console.error('❌ Failed:', data);
}
