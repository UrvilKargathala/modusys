"use client";

import { useEffect, useState } from "react";

const dateFmt = new Intl.DateTimeFormat("en-IN", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
  timeZone: "Asia/Kolkata",
});
const timeFmt = new Intl.DateTimeFormat("en-IN", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: true,
  timeZone: "Asia/Kolkata",
});

// Renders nothing until mounted so the server-rendered (or absent) markup
// matches the client's first paint — the actual clock only ever exists
// client-side, ticking every second.
export function LiveClock() {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return null;

  // formatToParts so the numeric day/year render in font-number (Outfit)
  // while the weekday/month names stay font-body (Raleway) — a plain
  // dateFmt.format() string mixes both under one font.
  const dateParts = dateFmt.formatToParts(now).map((part, i) =>
    part.type === "day" || part.type === "year" ? (
      <span key={i} className="font-number font-light">{part.value}</span>
    ) : (
      <span key={i}>{part.value}</span>
    )
  );

  return (
    <p className="text-xs font-body text-grey-500">
      {dateParts} · <span className="font-number font-light">{timeFmt.format(now)}</span> IST
    </p>
  );
}
