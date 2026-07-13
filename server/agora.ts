import AgoraToken from 'agora-token';
const { RtcTokenBuilder, RtcRole } = AgoraToken;

// Read at call time so credentials configured at runtime (via /instalar)
// take effect without a server restart.
function getAgoraCredentials(): { appId: string; appCertificate: string } {
  return {
    appId: process.env.AGORA_APP_ID || '',
    appCertificate: process.env.AGORA_APP_CERTIFICATE || '',
  };
}

export interface AgoraTokenConfig {
  channelName: string;
  uid: number;
  role: 'publisher' | 'subscriber';
  expirationTimeInSeconds?: number;
}

export function generateAgoraToken(config: AgoraTokenConfig): string {
  const { channelName, uid, role, expirationTimeInSeconds = 3600 } = config;
  const { appId, appCertificate } = getAgoraCredentials();

  if (!appId || !appCertificate) {
    throw new Error('Agora credentials not configured. Please set AGORA_APP_ID and AGORA_APP_CERTIFICATE.');
  }

  const currentTimestamp = Math.floor(Date.now() / 1000);
  const privilegeExpiredTs = currentTimestamp + expirationTimeInSeconds;

  const agoraRole = role === 'publisher' ? RtcRole.PUBLISHER : RtcRole.SUBSCRIBER;

  const token = RtcTokenBuilder.buildTokenWithUid(
    appId,
    appCertificate,
    channelName,
    uid,
    agoraRole,
    privilegeExpiredTs,
    privilegeExpiredTs
  );

  return token;
}

export function getAgoraAppId(): string {
  return getAgoraCredentials().appId;
}
