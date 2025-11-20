import axios from 'axios';

export const fetchClanRosterFromGoogleSheet = async (url: string) => {
  const response = await axios.get(url);
  return response.data;
};
