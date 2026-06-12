import { config } from "dotenv";
config({ path: ".env.local" });

async function main() {
  const { fetchProductDetail } = await import("../lib/dabs/detail");
  const sku = process.argv[2] ?? "034006";
  const d = await fetchProductDetail(sku);
  console.log(
    JSON.stringify(
      {
        name: d.name,
        status: d.statusRaw,
        wh: d.warehouseQty,
        onOrder: d.onOrderQty,
        price: d.price,
        desc: d.description?.slice(0, 60),
        storeCount: d.stores.length,
        first: d.stores[0],
        last: d.stores.at(-1),
      },
      null,
      2
    )
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
