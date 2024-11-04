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
  ],
};

export const TROOPS: Record<string, any> = {
  MINION,
};
