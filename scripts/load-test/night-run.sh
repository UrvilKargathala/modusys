#!/usr/bin/env bash
# Phase 0 night run (docs/SCALING_PLAN.md). Runs ON THE SERVER, against the STAGING app only.
# Usage: night-run.sh "100 200 300" 8m
#   Needs ~/loadtest/env with TOKEN=... and CUSTOMERS=... (staging values, owner-only file).
# Safety: a watcher checks the live site every 10 s; one answer slower than 2 s (or no answer) stops everything.
set -u
STEPS="${1:-100 200 300}"; DURATION="${2:-8m}"
DIR=~/loadtest; OUT="$DIR/results-$(date -u +%Y%m%d-%H%M)"; mkdir -p "$OUT"
source "$DIR/env"
LIVE=https://modusys.co.in/sign-in
APP=$(docker ps --format '{{.Names}}' | grep '^vxf9hslzcmkiitczhg6hlw6s' | head -1)
[ -n "$APP" ] || { echo "staging app not running" | tee "$OUT/ABORTED"; exit 1; }
log() { echo "$(date -u +%H:%M:%S) $*" | tee -a "$OUT/run.log"; }

log "staging app: $APP; steps: $STEPS x $DURATION"

# 1. Office internet speed (Cloudflare's public test; sends no data of ours).
if [ "${SKIP_SPEED:-0}" = 1 ]; then log "speed test skipped"; else
log "speed test"
# Cloudflare refuses single downloads over ~25 MB, so take the best of four 25 MB downloads.
for i in 1 2 3 4; do curl -s -o /dev/null -w "%{speed_download}\n" "https://speed.cloudflare.com/__down?bytes=25000000"; done \
  | sort -n | tail -1 | awk '{printf "download: %.1f Mbit/s\n", $1*8/1e6}' | tee -a "$OUT/speed.txt"
head -c 25000000 /dev/zero | curl -s -o /dev/null -w "%{speed_upload}\n" --data-binary @- "https://speed.cloudflare.com/__up" | awk '{printf "upload: %.1f Mbit/s\n", $1*8/1e6}' | tee -a "$OUT/speed.txt"
fi

# 2. Watcher, every 10 s, two checks of the LIVE site:
#    - direct, inside the server: over 1 s or no answer = the server is struggling -> stop at once
#    - through internet + Cloudflare (as a visitor): over 2 s or no answer TWICE IN A ROW -> stop
#      (one slow answer alone is usually an internet blip, seen on 13/11 with the server nearly idle)
#    Stopping uses `docker stop`, so k6 still saves what it measured.
LIVE_APP=$(docker ps --format '{{.Names}}' | grep '^xmddvcyq' | head -1)
LIVE_DIRECT="http://$(docker inspect -f '{{range .NetworkSettings.Networks}}{{.IPAddress}}{{end}}' "$LIVE_APP"):3000/sign-in"
( slow=0
  while [ ! -f "$OUT/DONE" ]; do
    d=$(curl -s -o /dev/null -m 10 -w "%{http_code} %{time_total}" "$LIVE_DIRECT")
    e=$(curl -s -o /dev/null -m 10 -w "%{http_code} %{time_total}" "$LIVE")
    echo "$(date -u +%H:%M:%S) direct=$d internet=$e" >> "$OUT/live.log"
    ok() { awk -v max="$2" '{exit !($1==200 && $2<=max)}' <<<"$1"; }
    if ! ok "$d" 1; then reason="live site slow inside the server: $d"
    elif ! ok "$e" 2; then slow=$((slow+1)); [ $slow -ge 2 ] && reason="live site slow through the internet twice: $e"
    else slow=0; fi
    if [ -n "${reason:-}" ]; then
      echo "$reason" > "$OUT/STOP"; docker stop -t 20 k6-run >/dev/null 2>&1; break
    fi
    sleep 10
  done ) &

# 3. Resource use every 15 s (staging app + db, live app + db).
( while [ ! -f "$OUT/DONE" ]; do
    docker stats --no-stream --format "$(date -u +%H:%M:%S),{{.Name}},{{.CPUPerc}},{{.MemUsage}}" \
      "$APP" modusys-staging-db segwdaxi0ijhaieqjhgopp7u $(docker ps --format '{{.Names}}' | grep '^xmddvcyq' | head -1) >> "$OUT/stats.csv" 2>/dev/null
    echo "$(date -u +%H:%M:%S),$(docker exec modusys-staging-db psql -U modusys -d modusys_staging -Atc "select count(*) from pg_stat_activity where datname='modusys_staging'")" >> "$OUT/db-connections.csv"
    sleep 15
  done ) &

# 4. Load steps.
for U in $STEPS; do
  [ -f "$OUT/STOP" ] && { log "stopped before $U users: $(cat "$OUT/STOP")"; break; }
  log "start $U users"
  START=$(date -u +%Y-%m-%dT%H:%M:%SZ)
  docker run --rm --name k6-run --network coolify --user "$(id -u):$(id -g)" -v "$DIR:/work" \
    -e BASE="http://$APP:3000" -e TOKEN="$TOKEN" -e CUSTOMERS="$CUSTOMERS" -e USERS="$U" -e DURATION="$DURATION" \
    grafana/k6:0.54.0 run --quiet --summary-export "/work/$(basename "$OUT")/summary-$U.json" /work/modusys.js > "$OUT/k6-$U.txt" 2>&1
  log "end $U users (k6 exit $?)"
  docker logs --since "$START" "$APP" 2>&1 | grep -ciE "timeout exceeded|error" | sed "s/^/app error lines: /" | tee -a "$OUT/run.log"
  sleep 60 # let the server settle between steps
done

touch "$OUT/DONE"; wait
docker rmi grafana/k6:0.54.0 >/dev/null 2>&1
log "finished; results in $OUT"
