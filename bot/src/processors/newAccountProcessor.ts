import { getPlayer } from "../adapters/coc-api-adapter";

export const newAccountProcessor = async (event: Record<string, string>) => {
    const { tag } = event;
    const accountData = await getPlayer(tag);
    console.log(JSON.stringify(accountData));
}