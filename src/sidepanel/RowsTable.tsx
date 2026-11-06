import type { Row } from "../lib/types";

interface Props {
  columns: string[];
  rows: Row[];
  onChange: (rows: Row[]) => void;
  /** Mark empty cells so the user can see what the AI could not find. */
  highlightEmpty?: boolean;
}

export function RowsTable({ columns, rows, onChange, highlightEmpty = false }: Props) {
  function setCell(index: number, column: string, value: string) {
    onChange(rows.map((r, i) => (i === index ? { ...r, [column]: value } : r)));
  }
  function removeRow(index: number) {
    onChange(rows.filter((_, i) => i !== index));
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
            <th aria-label="Remove" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {columns.map((c) => (
                <td key={c} className={highlightEmpty && !row[c] ? "empty" : ""}>
                  <input value={row[c] ?? ""} onChange={(e) => setCell(i, c, e.target.value)} aria-label={`${c}, row ${i + 1}`} />
                </td>
              ))}
              <td>
                <button className="icon" onClick={() => removeRow(i)} aria-label={`Remove row ${i + 1}`} title="Remove row">
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
