import { beforeAll, afterAll, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
const pg = new PGlite();
beforeAll(async () => {
  await pg.exec(
    `create role anon; create role authenticated; create role service_role bypassrls;create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit integer,allowed_mime_types text[]);`,
  );
  await pg.exec(
    readFileSync(
      "supabase/migrations/20260928213455_vanrooz_initial.sql",
      "utf8",
    ),
  );
}, 30000);
afterAll(() => pg.close());
it("public cannot write editions or read internal records or invoke privileged functions", async () => {
  await pg.exec("set role anon");
  for (const sql of [
    "insert into public.editions(day,payload) values('2026-09-27','{}')",
    "select * from public.evidence",
    "select * from public.usage_ledger",
    "select public.claim_run('bad','2026-09-28')",
  ]) {
    await expect(pg.exec(sql)).rejects.toThrow();
  }
  expect((await pg.query("select * from public.editions")).rows).toHaveLength(
    0,
  );
  await pg.exec("reset role");
});
it("job lock excludes concurrent jobs and publication is immutable and atomic", async () => {
  await pg.exec("set role service_role");
  expect(
    (await pg.query("select public.claim_run('run1','2026-09-28') as ok")).rows,
  ).toEqual([{ ok: true }]);
  expect(
    (await pg.query("select public.claim_run('run2','2026-09-28') as ok")).rows,
  ).toEqual([{ ok: false }]);
  const payload = {
    date: "2026-09-28",
    articles: [
      {
        id: "test-article",
        headline: "عنوان آزمایشی معتبر",
        intro: "این مقدمه تنها برای آزمون تراکنش پایگاه داده نوشته شده است.",
        paragraphs: ["جزئیات برای آزمون پایگاه داده"],
        image: { url: "https://image.test" },
      },
    ],
    events: [],
  };
  expect(
    (
      await pg.query("select public.publish_edition($1,$2,$3,$4,$5) as ok", [
        "run1",
        "2026-09-28",
        JSON.stringify(payload),
        "[]",
        "[]",
      ])
    ).rows,
  ).toEqual([{ ok: true }]);
  expect(
    (
      await pg.query("select public.publish_edition($1,$2,$3,$4,$5) as ok", [
        "run1",
        "2026-09-28",
        JSON.stringify(payload),
        "[]",
        "[]",
      ])
    ).rows,
  ).toEqual([{ ok: false }]);
  expect((await pg.query("select * from public.editions")).rows).toHaveLength(
    1,
  );
  await pg.exec("select public.claim_run('run3','2026-09-29')");
  const invalid = {
    ...payload,
    date: "2026-09-29",
    articles: [{ ...payload.articles[0], id: "new-id" }, payload.articles[0]],
  };
  await expect(
    pg.query("select public.publish_edition($1,$2,$3,$4,$5)", [
      "run3",
      "2026-09-29",
      JSON.stringify(invalid),
      "[]",
      "[]",
    ]),
  ).rejects.toThrow();
  expect(
    (await pg.query("select * from public.editions where day='2026-09-29'"))
      .rows,
  ).toHaveLength(0);
  expect(
    (await pg.query("select * from public.articles where id='new-id'")).rows,
  ).toHaveLength(0);
  await pg.exec("select public.fail_run('run3','TEST_FAILURE')");
  expect((await pg.query("select * from public.editions")).rows).toHaveLength(
    1,
  );
  await pg.exec("reset role");
});
it("reserves spend before calls, keeps unknown charges and rejects over budget", async () => {
  await pg.exec("set role service_role");
  await pg.exec("select public.claim_run('budget','2026-09-30')");
  const call = (id: string, amount: number) =>
    pg.query("select public.reserve_usage($1,$2,$3,$4,$5,$6,$7) as ok", [
      id,
      "budget",
      "2026-09-30",
      "test-model",
      amount,
      0.6,
      20,
    ]);
  expect((await call("u1", 0.4)).rows).toEqual([{ ok: true }]);
  expect((await call("u2", 0.3)).rows).toEqual([{ ok: false }]);
  expect((await call("u1", 0.4)).rows).toEqual([{ ok: false }]);
  expect(
    (await pg.query("select count(*)::int as n from public.usage_ledger")).rows,
  ).toEqual([{ n: 1 }]);
  await pg.exec("reset role");
});
