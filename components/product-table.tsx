import Link from "next/link";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/status-badge";
import { displayName, formatPrice, formatQty } from "@/lib/format";
import type { ProductRow } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function ProductTable({ rows }: { rows: ProductRow[] }) {
  if (rows.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center text-muted-foreground">
        No products match. Try fewer words or just the brand — e.g.
        &ldquo;eagle rare&rdquo; instead of &ldquo;Eagle Rare Bourbon 10 Year&rdquo;.
      </div>
    );
  }
  return (
    <>
      {/* Phones: one card row per product with the numbers that matter. */}
      <ul className="divide-y rounded-lg border sm:hidden">
        {rows.map((p) => (
          <li key={p.csc} className={cn(!p.in_stock && "opacity-70")}>
            <Link href={`/product/${p.csc}`} className="flex items-start justify-between gap-3 px-3 py-3">
              <div className="min-w-0 space-y-1">
                <div className="font-medium leading-snug">{displayName(p.name)}</div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
                  <StatusBadge status={p.status} />
                  <span>{p.category ?? "—"}</span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="font-semibold tabular-nums">
                  {formatPrice(p.current_price)}
                  {p.is_spa ? <span className="ml-1 text-xs text-destructive">SPA</span> : null}
                </div>
                <div className="text-xs tabular-nums text-muted-foreground">
                  {p.in_stock ? `${formatQty(p.store_qty)} in stores` : "out of stock"}
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>

    <div className="hidden overflow-x-auto rounded-lg border sm:block">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <TableHead>Product</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="text-right">Price</TableHead>
            <TableHead className="text-right">Stores</TableHead>
            <TableHead className="text-right">Warehouse</TableHead>
            <TableHead className="text-right">On Order</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((p) => (
            <TableRow key={p.csc} className={cn(!p.in_stock && "opacity-55")}>
              <TableCell className="max-w-90">
                <Link
                  href={`/product/${p.csc}`}
                  className="font-medium hover:underline"
                >
                  {displayName(p.name)}
                </Link>
                <span className="ml-2 font-mono text-xs text-muted-foreground">
                  {p.csc}
                </span>
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                {p.category ?? "—"}
              </TableCell>
              <TableCell>
                <StatusBadge status={p.status} />
              </TableCell>
              <TableCell className="text-right tabular-nums">
                {formatPrice(p.current_price)}
                {p.is_spa ? (
                  <span className="ml-1 text-xs text-destructive" title="Special Price Allowance">
                    SPA
                  </span>
                ) : null}
              </TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(p.store_qty)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(p.warehouse_qty)}</TableCell>
              <TableCell className="text-right tabular-nums">{formatQty(p.on_order_qty)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
    </>
  );
}
