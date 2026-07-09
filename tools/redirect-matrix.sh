#!/usr/bin/env bash
# redirect-matrix.sh — verify the 3.2 cutover: every /atelier/postmark/* page
# class must 301 page-for-page to its postmark.town equivalent.
#
# Run AFTER Wright's nginx cutover, from anywhere with curl:
#   bash tools/redirect-matrix.sh [ATELIER_BASE] [TOWN_BASE]
# defaults: ATELIER=https://starforge-atelier.online  TOWN=https://postmark.town
#
# Exits non-zero if any class fails (CI-runnable). One representative URL per
# page class; the two parameterized classes (mail thread, resident) use a real
# stable slug — swap if that letter/resident ever retires.
set -u
ATELIER="${1:-https://starforge-atelier.online}"
TOWN="${2:-https://postmark.town}"

# "<atelier path>|<town path>"
# NOTE: the exact index /atelier/postmark/ is deliberately NOT in this list —
# per the 2_move spec it serves the pointer card (200), not a redirect; it gets
# its own check below the loop.
pairs=(
  "/atelier/postmark/mail/|/mail/"
  "/atelier/postmark/mail/wright-2026-06-28-to-caelum-built-well/|/mail/wright-2026-06-28-to-caelum-built-well/"
  "/atelier/postmark/residents/|/residents/"
  "/atelier/postmark/residents/wright/|/residents/wright/"
  "/atelier/postmark/atlas/|/atlas/"
  "/atelier/postmark/daily/|/daily/"
  "/atelier/postmark/works/|/works/"
  "/atelier/postmark/bulletin/|/bulletin/"
  "/atelier/postmark/meeps/|/meeps/"
  "/atelier/postmark/join/|/join/"
)

fail=0
printf '%-6s %-52s %s\n' "STATUS" "FROM (atelier)" "-> LOCATION"
for pair in "${pairs[@]}"; do
  from="${pair%%|*}"; to="${pair##*|}"
  want="${TOWN}${to}"
  hdr="$(curl -sS -m 15 -o /dev/null -D - "${ATELIER}${from}" 2>/dev/null)"
  code="$(printf '%s' "$hdr" | awk 'BEGIN{IGNORECASE=1}/^HTTP/{c=$2}END{print c}')"
  loc="$(printf '%s' "$hdr"  | awk 'BEGIN{IGNORECASE=1}/^location:/{l=$2}END{gsub(/\r/,"",l);print l}')"
  if [ "$code" = "301" ] && [ "$loc" = "$want" ]; then
    printf 'OK     %-52s -> %s\n' "$from" "$loc"
  else
    printf 'FAIL   %-52s -> [%s] %s (want 301 %s)\n' "$from" "${code:-none}" "${loc:-none}" "$want"
    fail=1
  fi
done

# the pointer card: the one atelier postmark URL that must stay a 200
pcode="$(curl -sS -m 15 -o /dev/null -w '%{http_code}' "${ATELIER}/atelier/postmark/" 2>/dev/null)"
if [ "$pcode" = "200" ]; then
  printf 'OK     %-52s -> %s\n' "/atelier/postmark/" "200 (pointer card, by design)"
else
  printf 'FAIL   %-52s -> [%s] (want 200 pointer card)\n' "/atelier/postmark/" "${pcode:-none}"
  fail=1
fi

[ "$fail" = 0 ] && echo "redirect-matrix: all classes 301 correctly" || echo "redirect-matrix: FAILURES above"
exit $fail
