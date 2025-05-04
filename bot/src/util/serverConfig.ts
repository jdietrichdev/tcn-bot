export interface ServerConfig {
    APPLICATION_CATEGORY: string;
    APP_APPROVAL_CHANNEL: string;
    RECRUITMENT_OPP_CHANNEL: string;
    GUEST_CHAT_CHANNEL: string;
    RECRUITER_ROLE: string;
}

const configMap = new Map<string, ServerConfig>();

// Test Server
configMap.set('1021786969077973022', {
    APPLICATION_CATEGORY: '1367867954577932321',
    APP_APPROVAL_CHANNEL: '1367868025440833576',
    RECRUITMENT_OPP_CHANNEL: '1368573341811740753',
    GUEST_CHAT_CHANNEL: '1279032545413038100',
    RECRUITER_ROLE: '1367944733204152484'
})

// TCN Server
configMap.set('1111490767991615518', {
    APPLICATION_CATEGORY: '1155232622738423819',
    APP_APPROVAL_CHANNEL: '1203481934471368776',
    RECRUITMENT_OPP_CHANNEL: '1203481934471368776',
    GUEST_CHAT_CHANNEL: '1112859424193777814',
    RECRUITER_ROLE: '1162202780845482024'
})

export const getConfig = (guidId: string): ServerConfig => {
    const config = configMap.get(guidId);
    if (config) return config;
    else throw new Error('No config defined for server');
}