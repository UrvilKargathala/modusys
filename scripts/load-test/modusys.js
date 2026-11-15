// k6 load test: pretend signed-in users on the STAGING copy (never production).
// Run by scripts/load-test/night-run.sh; see docs/SCALING_PLAN.md, Phase 0.
// Env: BASE (staging app URL), TOKEN (staging session token), USERS, DURATION, CUSTOMERS (comma-separated ids).
import http from "k6/http";
import { sleep } from "k6";

const BASE = __ENV.BASE;
const HEADERS = { headers: { Cookie: `modusys_session=${__ENV.TOKEN}` } };
const CUSTOMERS = (__ENV.CUSTOMERS || "").split(",").filter(Boolean);

export const options = {
  scenarios: {
    users: { executor: "constant-vus", vus: Number(__ENV.USERS || 1), duration: __ENV.DURATION || "1m", gracefulStop: "10s" },
  },
  summaryTrendStats: ["avg", "med", "p(95)", "max"],
};

// The requests the app makes when a page opens (from the dev server log of a dashboard load).
const PAGE = ["/api/auth/session", "/api/notifications", "/api/quotes", "/api/customers", "/api/tasks", "/api/users",
  "/api/architects", "/api/pipeline-stages", "/api/quote-template", "/api/pricing/furniture", "/api/pricing/hardware"];
const CLICKS = ["/api/quotes", "/api/customers", "/api/tasks", "/api/purchase-orders", "/api/vendors"];

const get = (p) => ["GET", BASE + p, null, HEADERS];

// One iteration = one minute of one person's work.
export default function () {
  const chat = __VU % 5 === 0 && CUSTOMERS.length > 0; // 1 in 5 people has a customer chat open
  const customer = CUSTOMERS[__VU % (CUSTOMERS.length || 1)];
  if (__ITER % 10 === 0) http.batch(PAGE.map(get)); // opens / reloads a page every 10 minutes
  for (let t = 0; t < 60; t++) {
    sleep(1);
    if (t % 30 === 0) http.get(BASE + "/api/notifications", HEADERS); // the bell
    if (t % 15 === 7) http.get(BASE + CLICKS[(__VU + __ITER + t) % CLICKS.length], HEADERS); // a click
    if (t % 15 === 11 && customer) http.get(`${BASE}/api/customers/${customer}`, HEADERS); // opens a customer
    if (chat && t % 4 === 0) http.batch([get(`/api/customers/${customer}/presence`), get(`/api/customers/${customer}/messages`)]);
    if (chat && t % 10 === 0) http.post(`${BASE}/api/customers/${customer}/presence`, null, HEADERS);
  }
}
