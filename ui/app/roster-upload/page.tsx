'use client';

import { State, uploadRoster } from "@/lib/actions";
import { useActionState } from "react";

export default function UploadRoster() {
  const initialState: State = { message: null, errors: {}};
  const [state, formAction] = useActionState(uploadRoster, initialState);

  return (
    <>
      <header className="text-center py-8">
        <h1 className="text-bold">Upload CWL Roster</h1>
      </header>
      <form action={formAction} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
        <fieldset>
          <div className="mb-4">
            <label htmlFor="roster" className="block text-sm font-medium text-gray-700">
              Roster File:
            </label>
            <input type="file" accept=".csv" id="roster" name="roster" required className="block w-full text-sm text-slate-500
        file:mr-4 file:py-2 file:px-4 file:rounded-md
        file:border-0 file:text-sm file:font-semibold
        file:bg-gray-50 file:text-gray-700
        hover:file:bg-gray-100" />
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-300" id="file_input_help">CSV only</p>
          </div>
          <div className="mb-4">
            <label htmlFor="server" className="block text-sm font-medium text-gray-700">
              Server:
            </label>
            <select id="server" name="server" defaultValue="" required className="mt-1 p-2 block w-full rounded-md border outline-none border-gray-300 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500">
              <option value="" disabled>
                Select Server
              </option>
              <option value="1021786969077973022">Test Server</option>
              <option value="1111490767991615518">TCN Server</option>
            </select>
          </div>
        </fieldset>
        <div>
            <button type="submit" className="flex justify-center">Upload Roster</button>
        </div>
      </form>
      <div className="text-center">
        {state.message}
      </div>
    </>
  )
}