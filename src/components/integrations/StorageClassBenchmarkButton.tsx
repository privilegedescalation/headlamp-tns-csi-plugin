/**
 * StorageClassBenchmarkButton — registerDetailsViewHeaderAction for StorageClass pages.
 *
 * Adds a "Benchmark" button to the detail page header of tns-csi StorageClasses.
 * Navigates to /tns-csi/benchmark so the user can run a FIO benchmark
 * against that storage class.
 */

import React from 'react';
import { useHistory } from 'react-router-dom';
import { TNS_CSI_PROVISIONER } from '../../api/k8s';

interface StorageClassBenchmarkButtonProps {
  resource: {
    provisioner?: string;
    metadata?: { name?: string };
    // KubeObject instance — provisioner may be a direct getter or under jsonData
    jsonData?: {
      provisioner?: string;
      metadata?: { name?: string };
    };
  };
}

export default function StorageClassBenchmarkButton({ resource }: StorageClassBenchmarkButtonProps) {
  const history = useHistory();

  // provisioner is one of the fields Headlamp's StorageClass class exposes as a getter,
  // so it's accessible directly. jsonData fallback for safety.
  const provisioner =
    resource?.provisioner ??
    resource?.jsonData?.provisioner;

  if (provisioner !== TNS_CSI_PROVISIONER) {
    return null;
  }

  const scName =
    resource?.metadata?.name ??
    resource?.jsonData?.metadata?.name ??
    '';

  const handleClick = () => {
    // Navigate to benchmark page; user selects the SC in the benchmark form.
    // Pass the SC name via hash so BenchmarkPage can pre-select it if desired.
    history.push(`/tns-csi/benchmark#${scName}`);
  };

  return (
    <button
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        padding: '6px 16px',
        borderRadius: '4px',
        border: '1px solid currentColor',
        backgroundColor: 'transparent',
        color: 'inherit',
        fontSize: '0.875rem',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        opacity: 0.85,
      }}
      aria-label={`Run benchmark on ${scName}`}
      title={`Run FIO benchmark on storage class ${scName}`}
    >
      <span>⚡</span>
      <span>Benchmark</span>
    </button>
  );
}
