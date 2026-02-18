/**
 * TrueNAS API client for the headlamp-tns-csi-plugin.
 *
 * Uses the TrueNAS WebSocket JSON-RPC 2.0 API to fetch pool-level capacity
 * information (pool.query). Requires a TrueNAS API key configured by the user
 * in plugin settings.
 *
 * The WebSocket connects directly from the browser to the TrueNAS server.
 * The server address comes from the StorageClass parameters (already in context).
 *
 * All operations are read-only (pool.query only).
 */

import { ConfigStore } from '@kinvolk/headlamp-plugin/lib';

// ---------------------------------------------------------------------------
// Config store — persists across sessions via Headlamp Redux store
// ---------------------------------------------------------------------------

export interface TnsCsiConfig {
  truenasApiKey: string;
  /** Override server address (defaults to StorageClass parameter 'server') */
  truenasServerOverride: string;
}

const DEFAULT_CONFIG: TnsCsiConfig = {
  truenasApiKey: '',
  truenasServerOverride: '',
};

const configStore = new ConfigStore<TnsCsiConfig>('headlamp-tns-csi-plugin');

export function getTnsCsiConfig(): TnsCsiConfig {
  return { ...DEFAULT_CONFIG, ...configStore.get() };
}

export function setTnsCsiConfig(partial: Partial<TnsCsiConfig>): void {
  configStore.update(partial);
}

export function useTnsCsiConfig(): () => TnsCsiConfig {
  return configStore.useConfig();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PoolStats {
  name: string;
  /** Total pool capacity in bytes */
  size: number;
  /** Allocated (used) bytes */
  allocated: number;
  /** Free bytes */
  free: number;
  /** Pool health status string */
  status: string;
}

// ---------------------------------------------------------------------------
// TrueNAS WebSocket JSON-RPC client
// ---------------------------------------------------------------------------

/**
 * Opens a WebSocket to TrueNAS, authenticates with the API key, calls
 * pool.query, collects results, and closes the connection.
 *
 * @param server - TrueNAS host/IP (no protocol prefix)
 * @param apiKey - TrueNAS API key
 * @returns Array of pool stats
 */
export function fetchTruenasPoolStats(
  server: string,
  apiKey: string
): Promise<PoolStats[]> {
  return new Promise((resolve, reject) => {
    // TrueNAS WebSocket endpoint — supports both SCALE and CORE
    const url = `wss://${server}/api/current`;
    let ws: WebSocket;

    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error('TrueNAS connection timed out (10s)'));
    }, 10_000);

    try {
      ws = new WebSocket(url);
    } catch (err) {
      clearTimeout(timeout);
      reject(new Error(`Failed to open WebSocket to ${server}: ${String(err)}`));
      return;
    }

    let msgId = 1;
    // State machine: connect → authenticate → query → done
    type Phase = 'connecting' | 'authenticating' | 'querying' | 'done';
    let phase: Phase = 'connecting';

    ws.onopen = () => {
      phase = 'authenticating';
      ws.send(JSON.stringify({
        id: msgId++,
        msg: 'method',
        method: 'auth.login_with_api_key',
        params: [apiKey],
      }));
    };

    ws.onmessage = (event: MessageEvent) => {
      let msg: Record<string, unknown>;
      try {
        msg = JSON.parse(event.data as string) as Record<string, unknown>;
      } catch {
        return;
      }

      if (phase === 'authenticating') {
        const result = msg['result'];
        if (result !== true) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('TrueNAS authentication failed — check your API key'));
          return;
        }
        phase = 'querying';
        ws.send(JSON.stringify({
          id: msgId++,
          msg: 'method',
          method: 'pool.query',
          params: [],
        }));
        return;
      }

      if (phase === 'querying') {
        const result = msg['result'];
        if (!Array.isArray(result)) {
          clearTimeout(timeout);
          ws.close();
          reject(new Error('pool.query returned unexpected result'));
          return;
        }
        phase = 'done';
        clearTimeout(timeout);
        ws.close();

        const pools: PoolStats[] = result.map((pool: unknown) => {
          const p = pool as Record<string, unknown>;
          return {
            name: String(p['name'] ?? ''),
            size: Number(p['size'] ?? 0),
            allocated: Number(p['allocated'] ?? 0),
            free: Number(p['free'] ?? 0),
            status: String(p['status'] ?? 'UNKNOWN'),
          };
        });
        resolve(pools);
      }
    };

    ws.onerror = () => {
      if (phase !== 'done') {
        clearTimeout(timeout);
        reject(new Error(`WebSocket error connecting to ${server} — check the server address and that TrueNAS is reachable`));
      }
    };

    ws.onclose = (event: CloseEvent) => {
      if (phase !== 'done') {
        clearTimeout(timeout);
        reject(new Error(`WebSocket closed unexpectedly (code ${event.code}) while ${phase}`));
      }
    };
  });
}
