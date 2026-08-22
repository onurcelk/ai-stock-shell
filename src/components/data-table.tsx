"use client";

import { motion } from "motion/react";
import { transitionInOut } from "@/lib/motion";

export interface Table {
  columns: string[];
  rows: Record<string, unknown>[];
}

/** Missing is missing. A gap is never filled with a plausible-looking value. */
const EMPTY = "—";

function format(value: unknown): string {
  if (value === null || value === undefined) return EMPTY;
  if (typeof value === "boolean") return value ? "yes" : "no";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return EMPTY;
    if (Number.isInteger(value)) return value.toLocaleString();
    return Math.abs(value) < 1000
      ? value.toFixed(4).replace(/0+$/, "").replace(/\.$/, "")
      : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(value);
}

const isNumeric = (value: unknown) =>
  typeof value === "number" || typeof value === "boolean";

/**
 * A frame, rendered as it came.
 *
 * Columns come from the payload rather than being hardcoded, because these
 * frames genuinely differ in shape and a table that named its own columns
 * would silently drop whatever the record gained.
 */
export function DataTable({
  table,
  empty,
  maxHeight = "26rem",
}: {
  table: Table;
  /** What to say when there is nothing — an empty record is not a poor one. */
  empty?: string;
  maxHeight?: string;
}) {
  if (table.rows.length === 0) {
    return (
      <p className="text-sm text-text-muted">
        {empty ?? "Nothing recorded here yet."}
      </p>
    );
  }

  return (
    <div
      className="overflow-auto rounded-lg border border-border"
      style={{ maxHeight }}
    >
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-surface-raised text-text-muted">
          <tr>
            {table.columns.map((column) => (
              <th
                key={column}
                className={`whitespace-nowrap px-3 py-2 font-normal ${
                  isNumeric(table.rows[0]?.[column]) ? "text-right" : ""
                }`}
              >
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ ...transitionInOut, delay: Math.min(i * 0.01, 0.3) }}
              className="border-t border-border"
            >
              {table.columns.map((column) => {
                const value = row[column];
                return (
                  <td
                    key={column}
                    className={`whitespace-nowrap px-3 py-2 ${
                      isNumeric(value)
                        ? "text-right font-mono text-text"
                        : "text-text-muted"
                    } ${value === null || value === undefined ? "text-text-faint" : ""}`}
                  >
                    {format(value)}
                  </td>
                );
              })}
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
