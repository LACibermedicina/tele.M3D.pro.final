---
name: Video channel unification
description: How Agora room names are resolved server-side and the consultation_sessions FK quirk
---

# Canonical Agora channel resolution

The two Agora token routes (`/api/agora/generate-token`, `/api/video-consultations/agora-token`) do not trust the client's requested channel. They run it through `resolveVideoChannelAccess` in `server/routes.ts`, which authorizes the caller AND returns the canonical channel the client must join (clients always join the server-returned `channelName`).

**Why:** doctor and patient historically ended up in different rooms (session.id vs vc.id vs doctor-office-<docId>). The server is the single source of truth: a live consultation's `agora_channel_name` overrides its id, which is how office admission remaps a patient into `doctor-office-<doctorId>`.

**How to apply:** any new video entry point must NOT invent its own channel name. Request a token with whatever identifier it has (vc UUID, `consultation-<id>`, session id, office channel) and join the returned channel. To route a patient into a room, set `video_consultations.agora_channel_name` on a waiting/active row — authorization for office channels is derived from that column.

# consultation_sessions FK quirk

`consultation_sessions.consultationId` declares an FK to `video_consultations` in the schema, but the create route actually stores the **consultation_request id** there. Any lookup by that column must treat it as a requestId.
