"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_LABELS } from "@/lib/config";

/** Filter/sort bar for classic search. State lives in the URL. */
export function SearchControls({ categories }: { categories: string[] }) {
  const router = useRouter();
  const params = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);

  function submit(formData: FormData) {
    const next = new URLSearchParams();
    for (const key of ["q", "category", "status", "sort"]) {
      const value = String(formData.get(key) ?? "").trim();
      if (value) next.set(key, value);
    }
    if (formData.get("instock")) next.set("instock", "1");
    router.push(`/?${next.toString()}`);
  }

  return (
    <form ref={formRef} action={submit} className="space-y-3">
      <div className="flex gap-2">
        <Input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Search every DABS product — try “makers mark” or “eagle rare”"
          className="h-11 text-base"
          autoFocus
        />
        <Button type="submit" className="h-11 px-6">
          Search
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select
          name="category"
          defaultValue={params.get("category") ?? ""}
          className="h-8 max-w-60 rounded-md border border-input bg-transparent px-2 text-sm"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={params.get("status") ?? ""}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="">Any status</option>
          {Object.entries(STATUS_LABELS).map(([code, label]) => (
            <option key={code} value={code}>
              {label}
            </option>
          ))}
        </select>
        <select
          name="sort"
          defaultValue={params.get("sort") ?? ""}
          className="h-8 rounded-md border border-input bg-transparent px-2 text-sm"
          onChange={() => formRef.current?.requestSubmit()}
        >
          <option value="">Best match</option>
          <option value="name">Name A–Z</option>
          <option value="price_asc">Price: low → high</option>
          <option value="price_desc">Price: high → low</option>
          <option value="qty">Most stock</option>
        </select>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            name="instock"
            defaultChecked={params.get("instock") === "1"}
            onChange={() => formRef.current?.requestSubmit()}
          />
          In stock only
        </label>
      </div>
    </form>
  );
}
