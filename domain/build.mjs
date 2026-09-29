import { mkdir, copyFile, writeFile } from "node:fs/promises";
await mkdir("dist", { recursive: true });
await copyFile("gateway.mjs", "dist/_worker.js");
await writeFile("dist/404.html", '<!doctype html><html lang="fa" dir="rtl"><meta charset="utf-8"><title>ون‌روز</title><p>دریافت خبرها ممکن نشد. لطفاً کمی بعد دوباره تلاش کنید.</p></html>');
console.log("Vanrooz Pages gateway built.");
