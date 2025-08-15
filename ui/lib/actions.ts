"use server";

import { storeRoster } from "./data";

export type State = {
  errors?: {
    roster?: string[];
    server?: string[];
  };
  message?: string | null;
};

export async function uploadRoster(
  prevState: State,
  formData: FormData
): Promise<State> {
  const roster = formData.get("roster") as File;
  const server = formData.get("server") as string;
  try {
    await storeRoster(roster, server);
  } catch (err) {
    console.log(err);
    return {
      errors: {},
      message: "Failed to upload roster, please try again",
    };
  }

  return {
    errors: {},
    message: "Successfully uploaded roster",
  };
}
