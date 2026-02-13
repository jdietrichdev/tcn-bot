export interface ClanConfig {
  name: string;
  leadChannel: string;
  clanChannel: string;
}

export interface ApplicationQuestion {
  custom_id: string;
  label: string;
}

export interface ApplicationQuestionConfig {
  title: string;
  questions: ApplicationQuestion[];
}

export interface ServerConfig {
  LEAD_APPLICATION_CATEGORY: string;
  APPLICATION_CATEGORY: string;
  ARCHIVE_CATEGORY: string;
  CWL_CATEGORY: string;
  EVENTS_CATEGORY: string;
  GENERAL_CHANNEL: string;
  ANNOUNCEMENT_CHANNEL: string;
  APP_APPROVAL_CHANNEL: string;
  RECRUITER_CHANNEL: string;
  RECRUITMENT_LEADERBOARD_CHANNEL: string;
  FC_TRACKING_CHANNEL: string;
  RECRUITMENT_OPP_CHANNEL: string;
  CLAN_POSTS_CHANNEL: string;
  GUEST_CHAT_CHANNEL: string;
  TRANSCRIPT_CHANNEL: string;
  CWL_SIGNUP_CHANNEL: string;
  CWL_ROSTER_CHANNEL: string;
  ELDER_PROPOSAL_CHANNEL: string;
  LEAD_PROPOSAL_CHANNEL: string;
  FAMILY_LEAD_CHANNEL: string;
  ADMIN_CHANNEL: string;
  ADMIN_ROLE: string;
  RECRUITER_ROLE: string;
  CLAN_ROLE: string;
  ORES_ROLE: string;
  VISITOR_ROLE: string;
  TRIAL_ELDER_ROLE: string;
  TRIAL_LEAD_ROLE: string;
  CWL_GENERAL_ROLE: string;
  TCN1_ROLE: string;
  TCN2_ROLE: string;
  TCN3_ROLE: string;
  TCN4_ROLE: string;
  TCN5_ROLE: string;
  TCN6_ROLE: string;
  BOT_ID: string;
  CLANS: Record<string, ClanConfig>;
  APPLICATION_QUESTIONS?: ApplicationQuestionConfig;
}

const configMap = new Map<string, ServerConfig>();

// Test Server
configMap.set('1021786969077973022', {
  LEAD_APPLICATION_CATEGORY: '1373114746823512154',
  APPLICATION_CATEGORY: '1367867954577932321',
  ARCHIVE_CATEGORY: '1368787032607817738',
  CWL_CATEGORY: '1404656102225870848',
  EVENTS_CATEGORY: '1408668719890305025',
  GENERAL_CHANNEL: '1021786969077973025',
  ANNOUNCEMENT_CHANNEL: '1280915536976281672',
  APP_APPROVAL_CHANNEL: '1367868025440833576',
  RECRUITER_CHANNEL: '1368573341811740753',
  RECRUITMENT_LEADERBOARD_CHANNEL: '1368573341811740753', // Using recruiter channel as placeholder
  FC_TRACKING_CHANNEL: '1178732997321633883', // Example from previous context
  RECRUITMENT_OPP_CHANNEL: '1437596075337715873',
  CLAN_POSTS_CHANNEL: '1437579053279477823',
  GUEST_CHAT_CHANNEL: '1279032545413038100',
  TRANSCRIPT_CHANNEL: '1377717816823644271',
  CWL_SIGNUP_CHANNEL: '1391983800757518550',
  CWL_ROSTER_CHANNEL: '1383649776284860488',
  ELDER_PROPOSAL_CHANNEL: '1422404233818275860',
  LEAD_PROPOSAL_CHANNEL: '1424834072760291489',
  FAMILY_LEAD_CHANNEL: '1424834072760291489',
  ADMIN_CHANNEL: '',
  ADMIN_ROLE: '1021837760648183910',
  RECRUITER_ROLE: '1367944733204152484',
  CLAN_ROLE: '1369016145419702313',
  ORES_ROLE: '1370001616140501042',
  VISITOR_ROLE: '1382523494402621450',
  TRIAL_ELDER_ROLE: '1424943970810593360',
  TRIAL_LEAD_ROLE: '1424943896743645184',
  CWL_GENERAL_ROLE: '',
  TCN1_ROLE: '',
  TCN2_ROLE: '',
  TCN3_ROLE: '',
  TCN4_ROLE: '',
  TCN5_ROLE: '',
  TCN6_ROLE: '',
  BOT_ID: '1257342457868451920',

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
  APPLICATION_QUESTIONS: {
    title: 'Apply for VXNT',
    questions: [
      {
        custom_id: 'reason',
        label: 'What brings you to our team?'
      },
      {
        custom_id: 'location',
        label: 'Where are you from?'
      },
      {
        custom_id: 'experience',
        label: 'What previous team experience do you have?'
      },
      {
        custom_id: 'goals',
        label: 'What are your goals and expectations?'
      },
      {
        custom_id: 'achievement',
        label: 'What is your biggest achievement in game?'
      }
    ]
  }
});

// TCN Server
configMap.set('1111490767991615518', {
  LEAD_APPLICATION_CATEGORY: '1155173782537895998',
  APPLICATION_CATEGORY: '1155232622738423819',
  ARCHIVE_CATEGORY: '1231389832186433576',
  CWL_CATEGORY: '1207393534567522324',
  EVENTS_CATEGORY: '1405657092794224660',
  GENERAL_CHANNEL: '1111490768436199565',
  ANNOUNCEMENT_CHANNEL: '1274985481842589758',
  APP_APPROVAL_CHANNEL: '1369675072364740679',
  RECRUITER_CHANNEL: '1203481934471368776',
  RECRUITMENT_LEADERBOARD_CHANNEL: '1410700087771926578',
  FC_TRACKING_CHANNEL: '1403846063328329768',
  RECRUITMENT_OPP_CHANNEL: '1369041471075782686',
  CLAN_POSTS_CHANNEL: '1403846063328329768',
  GUEST_CHAT_CHANNEL: '1112859424193777814',
  TRANSCRIPT_CHANNEL: '1179098134975107173',
  CWL_SIGNUP_CHANNEL: '1155987285184106626',
  CWL_ROSTER_CHANNEL: '1377795905612152924',
  ELDER_PROPOSAL_CHANNEL: '1424861717011235010',
  LEAD_PROPOSAL_CHANNEL: '1441524134428282910',  
  FAMILY_LEAD_CHANNEL: '1276364688288124949',
  ADMIN_CHANNEL:'1155173881443799100',
  ADMIN_ROLE: '1155171137500741722',
  RECRUITER_ROLE: '1162202780845482024',
  CLAN_ROLE: '1112857721910341703',
  ORES_ROLE: '1191947010350264340',
  VISITOR_ROLE: '1112859520989925436',
  TRIAL_ELDER_ROLE: '1358235739824979978',
  TRIAL_LEAD_ROLE: '1358287688343621882',
  CWL_GENERAL_ROLE: '1155169688476061736',
  TCN1_ROLE: '1155235238049611857',
  TCN2_ROLE: '1175917644286087168',
  TCN3_ROLE: '1208563965325971517',
  TCN4_ROLE: '1232441851803070506',
  TCN5_ROLE: '1358285748039475231',
  TCN6_ROLE: '1389606577419767898',
  BOT_ID: '1257342457868451920',
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
  APPLICATION_QUESTIONS: {
    title: 'Apply for This Clan Now',
    questions: [
      {
        custom_id: 'tags',
        label: 'Player tag(s)'
      },
      {
        custom_id: 'source',
        label: 'Where/Who did you learn about us from?'
      },
      {
        custom_id: 'leaveClan',
        label: "What's wrong with your current/previous clan?"
      },
      {
        custom_id: 'clanWants',
        label: 'What do you want in a clan?'
      },
      {
        custom_id: 'competition',
        label: 'Competition level/favorite strategies?'
      }
    ]
  }
});

export const getConfig = (guidId: string): ServerConfig => {
  const config = configMap.get(guidId);
  if (config) return config;
  else throw new Error('No config defined for server');
};