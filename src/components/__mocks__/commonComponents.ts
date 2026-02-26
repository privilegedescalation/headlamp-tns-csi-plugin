/**
 * Lightweight mock implementations of @kinvolk/headlamp-plugin/lib/CommonComponents.
 * Used via vi.mock('@kinvolk/headlamp-plugin/lib/CommonComponents', () => commonComponentsMock).
 *
 * Uses React.createElement instead of JSX since this file is .ts (not .tsx).
 */

import React from 'react';

type RC = React.ReactNode;

export const Loader = ({ title }: { title?: string }) =>
  React.createElement('div', { 'data-testid': 'loader' }, title);

export const SectionBox = ({ title, children }: { title?: string; children?: RC }) =>
  React.createElement('div', { 'data-testid': 'section-box', 'data-title': title },
    title ? React.createElement('h3', null, title) : null,
    children
  );

export const SectionHeader = ({ title }: { title: string }) =>
  React.createElement('h1', { 'data-testid': 'section-header' }, title);

export const SimpleTable = ({
  columns,
  data,
  emptyMessage,
}: {
  columns: Array<{ label: string; getter: (item: unknown) => RC }>;
  data: unknown[];
  emptyMessage?: string;
}) => {
  if (data.length === 0 && emptyMessage) {
    return React.createElement('div', { 'data-testid': 'empty-table' }, emptyMessage);
  }
  return React.createElement('table', { 'data-testid': 'simple-table' },
    React.createElement('thead', null,
      React.createElement('tr', null,
        columns.map(col => React.createElement('th', { key: col.label }, col.label))
      )
    ),
    React.createElement('tbody', null,
      data.map((item, i) =>
        React.createElement('tr', { key: i },
          columns.map(col => React.createElement('td', { key: col.label }, col.getter(item)))
        )
      )
    )
  );
};

export const NameValueTable = ({
  rows,
}: {
  rows: Array<{ name: string; value: RC }>;
}) =>
  React.createElement('table', { 'data-testid': 'name-value-table' },
    React.createElement('tbody', null,
      rows.map(row =>
        React.createElement('tr', { key: row.name },
          React.createElement('td', null, row.name),
          React.createElement('td', null, row.value)
        )
      )
    )
  );

export const StatusLabel = ({
  status,
  children,
}: {
  status: string;
  children?: RC;
}) =>
  React.createElement('span', { 'data-testid': 'status-label', 'data-status': status }, children);

export const PercentageBar = ({
  data,
}: {
  data: Array<{ name: string; value: number }>;
  total: number;
}) =>
  React.createElement('div', { 'data-testid': 'percentage-bar' },
    data.map(d =>
      React.createElement('span', { key: d.name }, `${d.name}: ${d.value}`)
    )
  );
