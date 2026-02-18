/**
 * TnsCsiSettings — plugin settings page.
 *
 * Lets users configure the TrueNAS API key and (optionally) a server address
 * override. When configured, the plugin fetches real pool capacity data via
 * the TrueNAS WebSocket JSON-RPC API (pool.query) and displays it on the
 * Overview page.
 *
 * Settings are persisted via Headlamp's ConfigStore (Redux-backed).
 */

import {
  NameValueTable,
  SectionBox,
  StatusLabel,
} from '@kinvolk/headlamp-plugin/lib/CommonComponents';
import React, { useState } from 'react';
import { fetchTruenasPoolStats, getTnsCsiConfig, setTnsCsiConfig } from '../api/truenas';

interface PluginSettingsProps {
  data?: Record<string, string | number | boolean>;
  onDataChange?: (data: Record<string, string | number | boolean>) => void;
}

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  border: '1px solid var(--mui-palette-divider, #e0e0e0)',
  borderRadius: '4px',
  fontSize: '14px',
  backgroundColor: 'var(--mui-palette-background-paper, #fff)',
  color: 'var(--mui-palette-text-primary, #000)',
  boxSizing: 'border-box',
};

const HINT_STYLE: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--mui-palette-text-secondary, #666)',
  marginTop: '4px',
};

export default function TnsCsiSettings({ data, onDataChange }: PluginSettingsProps) {
  const saved = getTnsCsiConfig();

  const [apiKey, setApiKey] = useState<string>(
    (data?.truenasApiKey as string) ?? saved.truenasApiKey ?? ''
  );
  const [serverOverride, setServerOverride] = useState<string>(
    (data?.truenasServerOverride as string) ?? saved.truenasServerOverride ?? ''
  );
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  function handleApiKeyChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setApiKey(val);
    setTnsCsiConfig({ truenasApiKey: val });
    onDataChange?.({ ...data, truenasApiKey: val });
  }

  function handleServerOverrideChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value;
    setServerOverride(val);
    setTnsCsiConfig({ truenasServerOverride: val });
    onDataChange?.({ ...data, truenasServerOverride: val });
  }

  async function testConnection() {
    setTesting(true);
    setTestResult(null);
    const server = serverOverride.trim() || '(from StorageClass)';
    if (!serverOverride.trim()) {
      setTesting(false);
      setTestResult({
        success: false,
        message: 'Enter a Server Address to test the connection.',
      });
      return;
    }
    if (!apiKey.trim()) {
      setTesting(false);
      setTestResult({
        success: false,
        message: 'Enter an API key to test the connection.',
      });
      return;
    }
    try {
      const pools = await fetchTruenasPoolStats(serverOverride.trim(), apiKey.trim());
      const names = pools.map(p => p.name).join(', ');
      setTestResult({
        success: true,
        message: `Connected to ${server}. Found ${pools.length} pool(s): ${names || '(none)'}`,
      });
    } catch (err: unknown) {
      setTestResult({
        success: false,
        message: String(err instanceof Error ? err.message : err),
      });
    } finally {
      setTesting(false);
    }
  }

  return (
    <SectionBox title="TrueNAS API (Optional)">
      <NameValueTable
        rows={[
          {
            name: 'API Key',
            value: (
              <div>
                <input
                  type="password"
                  value={apiKey}
                  onChange={handleApiKeyChange}
                  placeholder="Paste your TrueNAS API key here"
                  style={INPUT_STYLE}
                  autoComplete="off"
                />
                <div style={HINT_STYLE}>
                  Generate in TrueNAS UI → Credentials → API Keys.
                  Required for real pool capacity data on the Overview page.
                </div>
              </div>
            ),
          },
          {
            name: 'Server Address',
            value: (
              <div>
                <input
                  type="text"
                  value={serverOverride}
                  onChange={handleServerOverrideChange}
                  placeholder="e.g. 192.168.1.100 or truenas.local"
                  style={INPUT_STYLE}
                />
                <div style={HINT_STYLE}>
                  TrueNAS host/IP. If blank, the plugin uses the{' '}
                  <code>server</code> parameter from your tns-csi StorageClass.
                </div>
              </div>
            ),
          },
          {
            name: 'Connection Test',
            value: (
              <div>
                <button
                  onClick={() => void testConnection()}
                  disabled={testing}
                  style={{
                    padding: '6px 16px',
                    backgroundColor: testing
                      ? 'var(--mui-palette-action-disabledBackground, #e0e0e0)'
                      : 'var(--mui-palette-primary-main, #1976d2)',
                    color: testing
                      ? 'var(--mui-palette-action-disabled, #9e9e9e)'
                      : 'var(--mui-palette-primary-contrastText, #fff)',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: testing ? 'not-allowed' : 'pointer',
                    fontSize: '13px',
                    fontWeight: 500,
                  }}
                >
                  {testing ? 'Testing…' : 'Test Connection'}
                </button>
                {testResult && (
                  <div style={{ marginTop: '8px' }}>
                    <StatusLabel status={testResult.success ? 'success' : 'error'}>
                      {testResult.message}
                    </StatusLabel>
                  </div>
                )}
              </div>
            ),
          },
        ]}
      />
    </SectionBox>
  );
}
