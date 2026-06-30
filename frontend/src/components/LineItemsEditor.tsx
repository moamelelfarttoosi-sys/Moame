import type { LineItem } from "../types";
import { money } from "./ui";

interface Props {
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  showReceived?: boolean;
}

const blank: LineItem = {
  description: "",
  quantity: 1,
  unit: "",
  unit_price: 0,
  received_quantity: 0,
};

export function LineItemsEditor({ items, onChange, showReceived }: Props) {
  function update(idx: number, patch: Partial<LineItem>) {
    onChange(items.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  }
  function add() {
    onChange([...items, { ...blank }]);
  }
  function remove(idx: number) {
    onChange(items.filter((_, i) => i !== idx));
  }

  const total = items.reduce((s, it) => s + it.quantity * it.unit_price, 0);

  return (
    <div>
      <table className="line-items-table">
        <thead>
          <tr>
            <th style={{ width: "40%" }}>Description</th>
            <th>Qty</th>
            <th>Unit</th>
            <th>Unit Price</th>
            {showReceived && <th>Received</th>}
            <th>Total</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={showReceived ? 7 : 6} style={{ color: "var(--muted)" }}>
                No line items yet.
              </td>
            </tr>
          ) : (
            items.map((it, idx) => (
              <tr key={idx}>
                <td>
                  <input
                    value={it.description}
                    onChange={(e) => update(idx, { description: e.target.value })}
                    placeholder="Item description"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 70 }}
                    value={it.quantity}
                    onChange={(e) =>
                      update(idx, { quantity: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                <td>
                  <input
                    style={{ width: 70 }}
                    value={it.unit ?? ""}
                    onChange={(e) => update(idx, { unit: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    type="number"
                    style={{ width: 90 }}
                    value={it.unit_price}
                    onChange={(e) =>
                      update(idx, { unit_price: parseFloat(e.target.value) || 0 })
                    }
                  />
                </td>
                {showReceived && (
                  <td>
                    <input
                      type="number"
                      style={{ width: 80 }}
                      value={it.received_quantity ?? 0}
                      onChange={(e) =>
                        update(idx, {
                          received_quantity: parseFloat(e.target.value) || 0,
                        })
                      }
                    />
                  </td>
                )}
                <td>{money(it.quantity * it.unit_price)}</td>
                <td>
                  <button className="icon-btn" onClick={() => remove(idx)}>
                    ×
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginTop: 10,
        }}
      >
        <button className="btn secondary small" type="button" onClick={add}>
          + Add line
        </button>
        <strong>Total: {money(total)}</strong>
      </div>
    </div>
  );
}
