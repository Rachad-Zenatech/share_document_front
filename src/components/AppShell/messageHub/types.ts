export interface HubQueueOrStreamItem {
  name: string;
  type: string;
  state: string;
  consumers: number;
  messages: number;
  working: boolean;
}

export interface HubChannelGroupStatus {
  working: boolean;
  topology_ready: boolean;
  status: "online" | "ready" | "offline";
  consumers: number;
  items: HubQueueOrStreamItem[];
  roundtrip_ms?: number | null;
}

export interface HubConnectedServer {
  id: string;
  name: string;
  service_user: string;
  port: number;
  is_self: boolean;
  online: boolean;
  status: "online" | "degraded" | "offline";
  connection_state: string;
  connections_count: number;
  client_name?: string | null;
  queues: HubChannelGroupStatus;
  streams: HubChannelGroupStatus;
  last_seen?: string | null;
}

export interface MessageHubStatusResponse {
  status: "online" | "degraded" | "offline";
  connected: boolean;
  checked_at: string;
  hub: {
    name: string;
    status: "online" | "offline";
    connected: boolean;
    host: string;
    management_url: string;
    management_api_reachable: boolean;
    vhost: string;
    version: string;
    total_connections: number;
    online_servers: number;
    total_servers: number;
  };
  active_test?: {
    tested_at: string;
    queue_roundtrip_ok: boolean;
    queue_roundtrip_ms: number | null;
    stream_publish_ok: boolean;
    stream_roundtrip_ms: number | null;
  } | null;
  servers: HubConnectedServer[];
}
