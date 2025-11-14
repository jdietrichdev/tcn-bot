export interface ClanConfig {
  name: string;
  leadChannel: string;
  clanChannel: string;
}

export interface ServerConfig {
  leadApplicationCategory: string;
  applicationCategory: string;
  archiveCategory: string;
  cwlCategory: string;
  eventsCategory: string;
  GENERAL_CHANNEL: string;
  ANNOUNCEMENT_CHANNEL: string;
  APP_APPROVAL_CHANNEL: string;
  recruiterChannel: string;
  recruiterLeaderboardChannel: string;
  fcTrackingChannel: string;
  recruitmentOppChannel: string;
  clanPostsChannel: string;
  GUEST_CHAT_CHANNEL: string;
  TRANSCRIPT_CHANNEL: string;
  CWL_SIGNUP_CHANNEL: string;
  CWL_ROSTER_CHANNEL: string;
  RANK_PROPOSAL_CHANNEL: string;
  FAMILY_LEAD_CHANNEL: string;
  adminRole: string;
  recruiterRole: string;
  clanRole: string;
  oresRole: string;
  visitorRole: string;
  trialElderRole: string;
  trialLeadRole: string;
  botId: string;
  CLANS: Record<string, ClanConfig>;
}

const configMap = new Map<string, ServerConfig>();

// Test Server
configMap.set('1021786969077973022', {
  leadApplicationCategory: '1373114746823512154',
  applicationCategory: '1367867954577932321',
  archiveCategory: '1368787032607817738',
  cwlCategory: '1404656102225870848',
  eventsCategory: '1408668719890305025',
  GENERAL_CHANNEL: '1021786969077973025',
  ANNOUNCEMENT_CHANNEL: '1280915536976281672',
  APP_APPROVAL_CHANNEL: '1367868025440833576',
  recruiterChannel: '1368573341811740753',
  recruiterLeaderboardChannel: '1368573341811740753', // Using recruiter channel as placeholder
  fcTrackingChannel: '1178732997321633883', // Example from previous context
  recruitmentOppChannel: '1437596075337715873',
  clanPostsChannel: '1437579053279477823',
  GUEST_CHAT_CHANNEL: '1279032545413038100',
  TRANSCRIPT_CHANNEL: '1377717816823644271',
  CWL_SIGNUP_CHANNEL: '1391983800757518550',
  CWL_ROSTER_CHANNEL: '1383649776284860488',
  RANK_PROPOSAL_CHANNEL: '1422404233818275860',
  FAMILY_LEAD_CHANNEL: '1424834072760291489',
  adminRole: '1021837760648183910',
  recruiterRole: '1367944733204152484',
  clanRole: '1369016145419702313',
  oresRole: '1370001616140501042',
  visitorRole: '1382523494402621450',
  trialElderRole: '1424943970810593360',
  trialLeadRole: '1424943896743645184',
  botId: '1257342457868451920',

  CLANS: {
    TCN1: {
      name: 'TCN1',
      leadChannel: '1348703240744734802',
      clanChannel: '1155234422640082944',
    },
    TCN2: {
      name: 'TCN2',
      leadChannel: '1205399715533819985',
      clanChannel: '1175919814481555466',
    },
    TCN3: {
      name: 'TCN3',
      leadChannel: '1227636785031549050',
      clanChannel: '1208565052102156378',
    },
    TCN4: {
      name: 'TCN4',
      leadChannel: '1247610244864016384',
      clanChannel: '1232442920062156800',
    },
  },
});

// TCN Server
configMap.set('1111490767991615518', {
  leadApplicationCategory: '1155173782537895998',
  applicationCategory: '1155232622738423819',
  archiveCategory: '1231389832186433576',
  cwlCategory: '1207393534567522324',
  eventsCategory: '1405657092794224660',
  GENERAL_CHANNEL: '1111490768436199565',
  ANNOUNCEMENT_CHANNEL: '1274985481842589758',
  APP_APPROVAL_CHANNEL: '1369675072364740679',
  recruiterChannel: '1203481934471368776',
  recruiterLeaderboardChannel: '1410700087771926578',
  fcTrackingChannel: '1403846063328329768',
  recruitmentOppChannel: '1369041471075782686',
  clanPostsChannel: '1407761503435755601',
  GUEST_CHAT_CHANNEL: '1112859424193777814',
  TRANSCRIPT_CHANNEL: '1179098134975107173',
  CWL_SIGNUP_CHANNEL: '1155987285184106626',
  CWL_ROSTER_CHANNEL: '1377795905612152924',
  RANK_PROPOSAL_CHANNEL: '1424861717011235010',
  FAMILY_LEAD_CHANNEL: '1276364688288124949',
  adminRole: '1155171137500741722',
  recruiterRole: '1162202780845482024',
  clanRole: '1112857721910341703',
  oresRole: '1191947010350264340',
  visitorRole: '1112859520989925436',
  trialElderRole: '1358235739824979978',
  trialLeadRole: '1358287688343621882',
  botId: '1257342457868451920',
  CLANS: {
    TCN1: {
      name: 'TCN1',
      leadChannel: '1348703240744734802',
      clanChannel: '1155234422640082944',
    },
    TCN2: {
      name: 'TCN2',
      leadChannel: '1205399715533819985',
      clanChannel: '1175919814481555466',
    },
    TCN3: {
      name: 'TCN3',
      leadChannel: '1227636785031549050',
      clanChannel: '1208565052102156378',
    },
    TCN4: {
      name: 'TCN4',
      leadChannel: '1247610244864016384',
      clanChannel: '1232442920062156800',
    },
  },
});

export const getConfig = (guidId: string): ServerConfig => {
  const config = configMap.get(guidId);
  if (config) return config;
  else throw new Error('No config defined for server');
};
