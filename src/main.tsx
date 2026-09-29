import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource-variable/vazirmatn";
import "./style.css";
import {
  dateLabels,
  localDay,
  shiftDay,
  occurrenceStatus,
  TZ,
  validDay,
} from "../shared/date";
import {
  editionSchema,
  type Article,
  type Edition,
  type EventItem,
  type ImageAsset,
} from "../shared/schema";
const tabs = [
  ["all", "گزیدهٔ روز"],
  ["vancouver", "ونکوور"],
  ["canada", "کانادا"],
  ["events", "رویدادها"],
] as const;
const faNum = (n: number) => n.toLocaleString("fa-IR");
function Photo({ image, hero = false }: { image: ImageAsset; hero?: boolean }) {
  return (
    <figure className={hero ? "photo hero-photo" : "photo"}>
      <img src={image.url} alt={image.alt} loading={hero ? "eager" : "lazy"} />
      {image.related && <span className="related">عکس مرتبط</span>}
      <figcaption>
        عکس: {image.creator} ·{" "}
        <a href={image.sourceUrl} target="_blank" rel="noopener noreferrer">
          منبع عکس
        </a>{" "}
        ·{" "}
        <a href={image.licenceUrl} target="_blank" rel="noopener noreferrer">
          {image.licence}
        </a>
        {image.changes && ` · ${image.changes}`}
      </figcaption>
    </figure>
  );
}
function Meta({ a }: { a: Article }) {
  return (
    <div className="meta">
      <span>{a.category}</span>
      <time dateTime={a.publishedAt}>
        {dateLabels(localDay(new Date(a.publishedAt))).fa}
      </time>
    </div>
  );
}
function Story({
  a,
  lead = false,
  compact = false,
  onOpen,
}: {
  a: Article;
  lead?: boolean;
  compact?: boolean;
  onOpen: () => void;
}) {
  return (
    <article
      className={`story ${lead ? "lead" : ""} ${compact ? "compact" : ""}`}
    >
      <Photo image={a.image} hero={lead} />
      <div className="story-copy">
        {lead && <span className="pill">در کانون توجه</span>}
        <Meta a={a} />
        <h2>
          <a
            href={`?article=${a.id}`}
            onClick={(e) => {
              e.preventDefault();
              onOpen();
            }}
          >
            {a.headline}
          </a>
        </h2>
        {!compact && <p>{a.intro}</p>}
        <span className="source">{a.sourceName}</span>
        {a.olderReason && <small className="older">{a.olderReason}</small>}
      </div>
    </article>
  );
}
function EventCard({ e, onOpen }: { e: EventItem; onOpen: () => void }) {
  const status = occurrenceStatus(e.occurrences);
  return (
    <article className="event-card">
      <Photo image={e.image} />
      <div className="event-copy">
        <span className={`badge ${status}`}>
          {
            {
              upcoming: "پیش رو",
              ongoing: "در حال برگزاری",
              finished: "پایان‌یافته",
            }[status]
          }
        </span>
        <h3>
          <a
            href={`?event=${e.id}`}
            onClick={(x) => {
              x.preventDefault();
              onOpen();
            }}
          >
            {e.title}
          </a>
        </h3>
        <p>{e.scheduleLabel}</p>
        <p>{e.venue}</p>
        <small>{e.priceLabel}</small>
      </div>
    </article>
  );
}
function App() {
  const [today, setToday] = useState(localDay()),
    [day, setDay] = useState(() => {
      const q = new URLSearchParams(location.search).get("date");
      return q && validDay(q) ? q : localDay();
    }),
    [tab, setTab] = useState("all"),
    [edition, setEdition] = useState<Edition | null>(null),
    [dates, setDates] = useState<string[]>([]),
    [latest, setLatest] = useState<string | null>(null),
    [status, setStatus] = useState("loading"),
    [detail, setDetail] = useState<{
      type: "article" | "event";
      id: string;
    } | null>(null);
  useEffect(() => {
    const id = setInterval(() => setToday(localDay()), 30000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    const f = () => {
      const q = new URLSearchParams(location.search);
      setDay(q.get("date") || localDay());
      const a = q.get("article"),
        e = q.get("event");
      setDetail(
        a ? { type: "article", id: a } : e ? { type: "event", id: e } : null,
      );
    };
    window.addEventListener("popstate", f);
    f();
    return () => window.removeEventListener("popstate", f);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    setStatus("loading");
    setEdition(null);
    fetch(`/api/editions/${day}`, { signal: c.signal })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((d: any) => {
        setDates(d.dates);
        setLatest(d.latest);
        setEdition(d.edition ? editionSchema.parse(d.edition) : null);
        setStatus(d.status);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setStatus("error");
      });
    return () => c.abort();
  }, [day]);
  function choose(d: string) {
    setDay(d);
    setDetail(null);
    history.pushState({}, "", `?date=${d}`);
  }
  function open(type: "article" | "event", id: string) {
    setDetail({ type, id });
    history.pushState({}, "", `?date=${day}&${type}=${id}`);
    window.scrollTo(0, 0);
  }
  const a =
      detail?.type === "article"
        ? edition?.articles.find((a) => a.id === detail.id)
        : null,
    e =
      detail?.type === "event"
        ? edition?.events.find((e) => e.id === detail.id)
        : null;
  const news =
    edition?.articles.filter((a) => tab === "all" || a.section === tab) || [];
  return (
    <>
      <a className="skip" href="#content">
        رفتن به خبرها
      </a>
      <header>
        <div className="masthead">
          <a href="/" className="brand" aria-label="ون‌روز، صفحهٔ اصلی">
            <span className="brand-mark">و</span>
            <span>
              ون‌روز<small lang="en">VANROOZ</small>
            </span>
          </a>
          <span className="tagline">ونکوور، به وقت فارسی</span>
          <span className="city">
            ونکوور، کانادا<small>به وقت محلی ونکوور</small>
          </span>
        </div>
      </header>
      <main>
        <section aria-label="تقویم ده روز اخیر" className="calendar-section">
          <div className="calendar-label">
            <span>
              انتخاب روز <small lang="en">Select a day</small>
            </span>
            <span>{dateLabels(day).fa}</span>
          </div>
          <div className="calendar">
            {Array.from({ length: 10 }, (_, i) => shiftDay(today, -i)).map(
              (d) => {
                const l = dateLabels(d),
                  exists = dates.includes(d);
                return (
                  <button
                    key={d}
                    className={`day ${d === day ? "selected" : ""}`}
                    aria-pressed={d === day}
                    onClick={() => choose(d)}
                    aria-label={`${l.faDay} ${l.fa} / ${l.en}، ${exists ? "نسخه موجود" : "بدون نسخه"}`}
                  >
                    <span>{d === today ? "امروز / Today" : l.faDay}</span>
                    {d === today && <span>{l.faDay}</span>}
                    <strong>{l.faNumber}</strong>
                    <span>{l.faMonth}</span>
                    <small lang="en" dir="ltr">
                      {l.en}
                    </small>
                    <span className="availability">
                      {exists ? "نسخه موجود" : "—"}
                    </span>
                  </button>
                );
              },
            )}
          </div>
        </section>
        <nav aria-label="بخش‌های خبری">
          <div role="tablist" aria-label="دسته‌بندی">
            {tabs.map(([key, label]) => (
              <button
                role="tab"
                key={key}
                aria-selected={tab === key}
                id={`tab-${key}`}
                aria-controls="content"
                onClick={() => {
                  setTab(key);
                  setDetail(null);
                  history.replaceState({}, "", `?date=${day}`);
                }}
                onKeyDown={(x) => {
                  if (x.key === "ArrowLeft" || x.key === "ArrowRight") {
                    x.preventDefault();
                    const i = tabs.findIndex((t) => t[0] === tab),
                      n = (i + (x.key === "ArrowLeft" ? 1 : -1) + 4) % 4;
                    setTab(tabs[n][0]);
                    document.getElementById(`tab-${tabs[n][0]}`)?.focus();
                  }
                }}
              >
                {label}
              </button>
            ))}
          </div>
          <span className="update">
            {edition
              ? `انتشار ${new Intl.DateTimeFormat("fa-IR", { timeZone: TZ, hour: "2-digit", minute: "2-digit" }).format(new Date(edition.publishedAt))}`
              : "نسخهٔ روزانه"}
          </span>
        </nav>
        <div
          id="content"
          role="tabpanel"
          aria-labelledby={`tab-${tab}`}
          aria-live="polite"
        >
          {status === "loading" ? (
            <div className="empty">
              <span className="spinner" />
              <h1>در حال دریافت نسخه…</h1>
            </div>
          ) : status === "error" ? (
            <div className="empty">
              <h1>دریافت خبرها ممکن نشد</h1>
              <p>لطفاً کمی بعد دوباره تلاش کنید.</p>
              <button className="action" onClick={() => location.reload()}>
                تلاش دوباره
              </button>
            </div>
          ) : !edition ? (
            <div className="empty">
              <span className="eyebrow">ون‌روز / {dateLabels(day).fa}</span>
              <h1>
                {day === today
                  ? "نسخهٔ امروز هنوز منتشر نشده است"
                  : "برای این روز نسخه‌ای ثبت نشده است"}
              </h1>
              <p>
                {status === "running"
                  ? "خبرها در حال بررسی و آماده‌سازی هستند."
                  : status === "failed"
                    ? "به‌روزرسانی این روز کامل نشد. نسخه‌های منتشرشده همچنان در دسترس‌اند."
                    : day === today
                      ? "پس از تکمیل بررسی منابع، خبرها و رویدادهای تأییدشده اینجا نمایش داده می‌شوند."
                      : "برای خواندن خبرها، یکی از روزهای دارای نسخه را انتخاب کنید."}
              </p>
              {latest && (
                <button className="action" onClick={() => choose(latest!)}>
                  خواندن آخرین نسخهٔ منتشرشده
                </button>
              )}
              <div className="empty-rule" />
            </div>
          ) : detail ? (
            a ? (
              <article className="reader">
                <button className="back" onClick={() => choose(day)}>
                  بازگشت به خبرها ←
                </button>
                <Meta a={a} />
                <h1>{a.headline}</h1>
                <p className="intro">{a.intro}</p>
                <Photo image={a.image} hero />
                <div className="article-body">
                  {a.paragraphs.map((p, i) => (
                    <p key={i}>{p}</p>
                  ))}
                </div>
                {a.olderReason && <p className="notice">{a.olderReason}</p>}
                <footer className="article-source">
                  منبع: {a.sourceName}
                  <br />
                  انتشار اصلی:{" "}
                  {dateLabels(localDay(new Date(a.publishedAt))).fa}
                  <br />
                  گزارش فارسی ون‌روز بر پایهٔ اطلاعات منبع، با کمک هوش مصنوعی.
                </footer>
              </article>
            ) : e ? (
              <article className="reader">
                <button className="back" onClick={() => choose(day)}>
                  بازگشت به رویدادها ←
                </button>
                <h1>{e.title}</h1>
                <Photo image={e.image} />
                <p className="intro">{e.description}</p>
                <p>
                  {e.venue} · {e.address}
                </p>
                <p>{e.scheduleLabel}</p>
                <p>{e.priceLabel}</p>
                <h2>نوبت‌های برگزاری</h2>
                <ul className="occurrences">
                  {e.occurrences.map((o) => (
                    <li key={o.start}>
                      {new Intl.DateTimeFormat("fa-IR", {
                        timeZone: TZ,
                        dateStyle: "full",
                        timeStyle: "short",
                      }).format(new Date(o.start))}{" "}
                      تا{" "}
                      {new Intl.DateTimeFormat("fa-IR", {
                        timeZone: TZ,
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(o.end))}
                    </li>
                  ))}
                </ul>
                <a
                  className="action"
                  target="_blank"
                  rel="noopener noreferrer"
                  href={e.bookingUrl}
                >
                  اطلاعات و رزرو در سایت برگزارکننده ↗
                </a>
                <p className="source">{e.sourceName}</p>
              </article>
            ) : (
              <div className="empty">
                <h1>این مطلب در نسخهٔ انتخاب‌شده وجود ندارد</h1>
                <button onClick={() => choose(day)}>بازگشت</button>
              </div>
            )
          ) : (
            <>
              <div className="section-head">
                <div>
                  <span className="eyebrow">
                    {tab === "events" ? "در شهر چه می‌گذرد؟" : "امروز در شهر"}
                  </span>
                  <h1>{tab === "events" ? "از شهر لذت ببر" : "شهر چه خبر؟"}</h1>
                </div>
                <span className="counts">
                  {faNum(
                    edition.articles.filter((a) => a.section === "vancouver")
                      .length,
                  )}{" "}
                  خبر ونکوور ·{" "}
                  {faNum(
                    edition.articles.filter((a) => a.section === "canada")
                      .length,
                  )}{" "}
                  خبر کانادا · {faNum(edition.events.length)} رویداد
                </span>
              </div>
              {edition.note && <p className="notice">{edition.note}</p>}
              {tab !== "events" && news.length > 0 && (
                <section className="top-stories" aria-label="خبرهای منتخب">
                  <Story
                    a={news[0]}
                    lead
                    onOpen={() => open("article", news[0].id)}
                  />
                  <div className="supporting">
                    {news.slice(1, 4).map((a) => (
                      <Story
                        key={a.id}
                        a={a}
                        compact
                        onOpen={() => open("article", a.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
              {(tab === "all" || tab === "events") && (
                <section className="events">
                  <div className="section-title">
                    <h2>رویدادهای منتخب</h2>
                    {tab === "all" && (
                      <button onClick={() => setTab("events")}>
                        همهٔ رویدادها ←
                      </button>
                    )}
                  </div>
                  {edition.events.length ? (
                    <div className="event-grid">
                      {edition.events.map((e) => (
                        <EventCard
                          key={e.id}
                          e={e}
                          onOpen={() => open("event", e.id)}
                        />
                      ))}
                    </div>
                  ) : (
                    <p>
                      رویدادی با جزئیات قابل تأیید برای این نسخه انتخاب نشده
                      است.
                    </p>
                  )}
                </section>
              )}
              {tab !== "events" && news.length > 4 && (
                <section>
                  <div className="section-title">
                    <h2>خبرهای بیشتر</h2>
                    <span>{dateLabels(day).fa}</span>
                  </div>
                  <div className="news-grid">
                    {news.slice(4).map((a) => (
                      <Story
                        key={a.id}
                        a={a}
                        onOpen={() => open("article", a.id)}
                      />
                    ))}
                  </div>
                </section>
              )}
            </>
          )}
        </div>
      </main>
      <footer className="site-footer">
        <div className="brand footer-brand">
          ون‌روز <small>VANROOZ</small>
        </div>
        <p>گزارش‌های فارسی بر پایهٔ منابع خبری، با کمک هوش مصنوعی.</p>
        <p>
          «عکس مرتبط» تصویر مستند خبر یا رویداد نیست. تاریخ و ساعت رویدادها به
          وقت ونکوور است.
        </p>
      </footer>
    </>
  );
}
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
