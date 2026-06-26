"use client";

import type { TransactionHistoryItem } from "@/schemas/apiContract";

interface TransactionRowProps {
  index: number;
  item: TransactionHistoryItem & { localTime?: string };
  isHighlighted: boolean;
  onUpdate: (index: number, updated: Partial<TransactionHistoryItem & { localTime?: string }>) => void;
  onRemove: (index: number) => void;
}

export default function TransactionRow({
  index,
  item,
  isHighlighted,
  onUpdate,
  onRemove,
}: TransactionRowProps) {
  return (
    <tr
      className={`border-b border-zinc-200 transition-colors ${
        isHighlighted
          ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-300 dark:border-emerald-800"
          : "hover:bg-zinc-50/50"
      }`}
    >
      {/* Transaction ID */}
      <td className="p-3">
        <input
          type="text"
          value={item.transaction_id || ""}
          onChange={(e) => onUpdate(index, { transaction_id: e.target.value })}
          placeholder="TXN-101"
          className={`w-full px-2.5 py-1.5 text-sm bg-white border rounded-md transition-shadow focus:outline-none focus:ring-2 ${
            isHighlighted
              ? "border-emerald-300 focus:ring-emerald-400"
              : "border-zinc-300 focus:ring-blue-500"
          }`}
          aria-label={`Row ${index + 1} Transaction ID`}
          required
        />
      </td>

      {/* Timestamp */}
      <td className="p-3">
        <input
          type="datetime-local"
          value={item.localTime || ""}
          onChange={(e) => onUpdate(index, { localTime: e.target.value })}
          className={`w-full px-2.5 py-1.5 text-sm bg-white border rounded-md transition-shadow focus:outline-none focus:ring-2 ${
            isHighlighted
              ? "border-emerald-300 focus:ring-emerald-400"
              : "border-zinc-300 focus:ring-blue-500"
          }`}
          aria-label={`Row ${index + 1} Date and Time`}
          required
        />
      </td>

      {/* Type */}
      <td className="p-3">
        <select
          value={item.type || "transfer"}
          onChange={(e) => onUpdate(index, { type: e.target.value as any })}
          className={`w-full px-2.5 py-1.5 text-sm bg-white border rounded-md transition-shadow focus:outline-none focus:ring-2 ${
            isHighlighted
              ? "border-emerald-300 focus:ring-emerald-400"
              : "border-zinc-300 focus:ring-blue-500"
          }`}
          aria-label={`Row ${index + 1} Transaction Type`}
        >
          <option value="transfer">transfer</option>
          <option value="payment">payment</option>
          <option value="cash_in">cash_in</option>
          <option value="cash_out">cash_out</option>
          <option value="settlement">settlement</option>
          <option value="refund">refund</option>
        </select>
      </td>

      {/* Amount */}
      <td className="p-3">
        <input
          type="number"
          min="0"
          step="any"
          value={item.amount === undefined ? "" : item.amount}
          onChange={(e) =>
            onUpdate(index, { amount: e.target.value === "" ? undefined : Number(e.target.value) })
          }
          placeholder="0.00"
          className={`w-full px-2.5 py-1.5 text-sm bg-white border rounded-md transition-shadow focus:outline-none focus:ring-2 ${
            isHighlighted
              ? "border-emerald-300 focus:ring-emerald-400"
              : "border-zinc-300 focus:ring-blue-500"
          }`}
          aria-label={`Row ${index + 1} Amount`}
          required
        />
      </td>

      {/* Counterparty */}
      <td className="p-3">
        <input
          type="text"
          value={item.counterparty || ""}
          onChange={(e) => onUpdate(index, { counterparty: e.target.value })}
          placeholder="+880171..."
          className={`w-full px-2.5 py-1.5 text-sm bg-white border rounded-md transition-shadow focus:outline-none focus:ring-2 ${
            isHighlighted
              ? "border-emerald-300 focus:ring-emerald-400"
              : "border-zinc-300 focus:ring-blue-500"
          }`}
          aria-label={`Row ${index + 1} Counterparty`}
          required
        />
      </td>

      {/* Status */}
      <td className="p-3">
        <select
          value={item.status || "completed"}
          onChange={(e) => onUpdate(index, { status: e.target.value as any })}
          className={`w-full px-2.5 py-1.5 text-sm bg-white border rounded-md transition-shadow focus:outline-none focus:ring-2 ${
            isHighlighted
              ? "border-emerald-300 focus:ring-emerald-400"
              : "border-zinc-300 focus:ring-blue-500"
          }`}
          aria-label={`Row ${index + 1} Status`}
        >
          <option value="completed">completed</option>
          <option value="failed">failed</option>
          <option value="pending">pending</option>
          <option value="reversed">reversed</option>
        </select>
      </td>

      {/* Remove Control */}
      <td className="p-3 text-center">
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors"
          title="Remove transaction"
          aria-label={`Remove row ${index + 1}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2.5"
            stroke="currentColor"
            className="h-4.5 w-4.5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0"
            />
          </svg>
        </button>
      </td>
    </tr>
  );
}
