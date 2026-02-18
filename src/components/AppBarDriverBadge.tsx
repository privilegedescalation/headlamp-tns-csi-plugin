/**
 * AppBarDriverBadge — registerAppBarAction driver health badge.
 *
 * Displays "tns-csi: N/N" in the Headlamp top nav bar showing
 * ready controller + node pod counts. Color-coded:
 *   green  = all pods ready
 *   orange = some pods degraded
 *   red    = no pods ready or driver missing
 *
 * Returns null if the driver is not installed (no CSIDriver object) --
 * no clutter in clusters where tns-csi is absent.
 *
 * Wrapped in TnsCsiDataProvider at registration time (index.tsx).
 */

import React from 'react';
import { useHistory } from 'react-router-dom';
import { isPodReady, TnsCsiPod } from '../api/k8s';
import { useTnsCsiContext } from '../api/TnsCsiDataContext';

function countReady(pods: TnsCsiPod[]): number {
  return pods.filter(isPodReady).length;
}

function getBadgeColor(ready: number, total: number): string {
  if (total === 0) return '#9e9e9e';
  if (ready === total) return '#4caf50';
  if (ready > 0) return '#ff9800';
  return '#f44336';
}

export default function AppBarDriverBadge() {
  const { driverInstalled, controllerPods, nodePods, loading } = useTnsCsiContext();
  const history = useHistory();

  if (loading || !driverInstalled) {
    return null;
  }

  const controllerReady = countReady(controllerPods);
  const controllerTotal = controllerPods.length;
  const nodeReady = countReady(nodePods);
  const nodeTotal = nodePods.length;

  const totalReady = controllerReady + nodeReady;
  const totalPods = controllerTotal + nodeTotal;

  const color = getBadgeColor(totalReady, totalPods);

  const handleClick = () => {
    history.push('/tns-csi');
  };

  const labelText = `tns-csi: ${controllerReady}/${controllerTotal}c ${nodeReady}/${nodeTotal}n`;
  const ariaLabel = `TNS-CSI driver: ${controllerReady} of ${controllerTotal} controller pods ready, ${nodeReady} of ${nodeTotal} node pods ready`;

  return (
    <button
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        marginRight: '8px',
        padding: '4px 12px',
        borderRadius: '16px',
        border: 'none',
        backgroundColor: color,
        color: 'white',
        fontSize: '13px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
      }}
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <span>tns-csi: {controllerReady}/{controllerTotal}c {nodeReady}/{nodeTotal}n</span>
    </button>
  );
}
