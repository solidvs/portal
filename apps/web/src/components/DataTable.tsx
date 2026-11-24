import { Box, Text, token } from '@solidvs/ui';
import type { ReactNode } from 'react';

export type Column<T> = {
  id: string;
  header: string;
  cell: (row: T) => ReactNode;
  width?: string;
};

/**
 * List table of the platform's list pattern (design-system/layout-and-navigation.md): container
 * with 12 px radius and border, 40 px sunken header with 12/16 bold subtle text, 40 px rows with
 * vertical separators.
 */
export function DataTable<T>({ columns, rows, rowKey, empty }: { columns: Column<T>[]; rows: T[]; rowKey: (row: T) => string; empty: string }) {
  const cellStyle = {
    paddingInline: token('space.8'),
    height: '40px',
    borderBlockEnd: `${token('border.width')} solid ${token('border')}`,
    borderInlineEnd: `${token('border.width')} solid ${token('border')}`,
    textAlign: 'start' as const,
    verticalAlign: 'middle' as const,
  };
  return (
    <Box
      style={{
        border: `${token('border.width')} solid ${token('border')}`,
        borderRadius: token('radius.12'),
        overflow: 'hidden',
        backgroundColor: token('surface'),
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ backgroundColor: token('surface.sunken') }}>
            {columns.map((column) => (
              <th key={column.id} scope="col" style={{ ...cellStyle, width: column.width, font: token('font.body.s'), fontWeight: token('font.weight.bold'), color: token('text.muted') }}>
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} style={cellStyle}>
                <Text color="text.faint">{empty}</Text>
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr key={rowKey(row)}>
                {columns.map((column) => (
                  <td key={column.id} style={cellStyle}>
                    {column.cell(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </Box>
  );
}
