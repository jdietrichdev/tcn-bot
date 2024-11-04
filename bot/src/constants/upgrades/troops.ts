import { RESOURCES } from "../emojis/resources";
import { DARK_ELIXIR_TROOPS } from "../emojis/troops";

const MINION = {
  name: "Minion",
  type: RESOURCES.DARK_ELIXIR,
  emoji: DARK_ELIXIR_TROOPS.MINION,
  wikiUrl: "https://clashofclans.fandom.com/wiki/Minion",
  upgrades: [
    {
      level: 1,
      cost: 0,
      time: 0,
      labLevelRequired: 0,
      dps: 38,
      dph: 38,
      hp: 58,
    },
    {
      level: 2,
      cost: 2000,
      time: 28800,
      labLevelRequired: 5,
      dps: 41,
      dph: 41,
      hp: 63,
    },
    {
      level: 3,
      cost: 5000,
      time: 57600,
      labLevelRequired: 6,
      dps: 44,
      dph: 44,
      hp: 68,
    },
    {
      level: 4,
      cost: 10000,
      time: 86400,
      labLevelRequired: 6,
      dps: 47,
      dph: 47,
      hp: 73,
    },
    {
      level: 5,
      cost: 20000,
      time: 172800,
      labLevelRequired: 7,
      dps: 50,
      dph: 50,
      hp: 78,
    },
  ],
};

export const TROOPS: Record<string, any> = {
  MINION,
};
