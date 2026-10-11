-- DABS vendor for each product, from the monthly product-list XLSX ("Vendor
-- Name" / "Vendor Cd"). Links Utah makers to their bottles (/makers): most
-- distilleries, wineries and cideries sell to DABS under their own vendor
-- account. vendor_code is the Vendor Cd digits without leading zeros
-- ("001788" and "VC0000200479" -> "1788", "200479"); see lib/dabs/xlsx.ts.
alter table products add column if not exists vendor text;
alter table products add column if not exists vendor_code text;
create index if not exists products_vendor_code on products (vendor_code) where vendor_code is not null;
