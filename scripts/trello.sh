#!/usr/bin/env bash
# Lead-owned helper to mirror the shared task list onto Trello.
# Needs TRELLO_KEY / TRELLO_TOKEN in .env.local (gitignored) and TRELLO_BOARD_ID.
# Usage:
#   scripts/trello.sh lists                      -> list ids of the board's lists
#   scripts/trello.sh add "<list>" "<title>" "<desc>" [label]   -> prints card id
#   scripts/trello.sh move <cardId> "<list>"
#   scripts/trello.sh comment <cardId> "<text>"
#   scripts/trello.sh cards                      -> id | list | name
set -euo pipefail
cd "$(dirname "$0")/.."
set -a; . ./.env.local; set +a
: "${TRELLO_BOARD_ID:?set TRELLO_BOARD_ID in .env.local}"
API=https://api.trello.com/1
AUTH="key=$TRELLO_KEY&token=$TRELLO_TOKEN"
list_id() { curl -s "$API/boards/$TRELLO_BOARD_ID/lists?$AUTH" | jq -r --arg n "$1" '.[]|select(.name==$n)|.id'; }
case "${1:-}" in
  lists) curl -s "$API/boards/$TRELLO_BOARD_ID/lists?$AUTH" | jq -r '.[]|"\(.id) \(.name)"' ;;
  add)
    lid=$(list_id "$2")
    args=(--data-urlencode "name=$3" --data-urlencode "desc=${4:-}" --data-urlencode "idList=$lid")
    if [ -n "${5:-}" ]; then
      lab=$(curl -s "$API/boards/$TRELLO_BOARD_ID/labels?$AUTH" | jq -r --arg n "$5" '.[]|select(.name==$n)|.id' | head -1)
      [ -n "$lab" ] && args+=(--data-urlencode "idLabels=$lab")
    fi
    curl -s -X POST "$API/cards?$AUTH" "${args[@]}" | jq -r .id ;;
  move) curl -s -X PUT "$API/cards/$2?$AUTH" --data-urlencode "idList=$(list_id "$3")" -o /dev/null && echo moved ;;
  comment) curl -s -X POST "$API/cards/$2/actions/comments?$AUTH" --data-urlencode "text=$3" -o /dev/null && echo commented ;;
  cards) curl -s "$API/boards/$TRELLO_BOARD_ID/cards?$AUTH&fields=name,idList" > /tmp/.tc.$$; curl -s "$API/boards/$TRELLO_BOARD_ID/lists?$AUTH" | jq -r --slurpfile c /tmp/.tc.$$ '. as $l | $c[0][] | . as $card | "\($card.id) | \($l[]|select(.id==$card.idList)|.name) | \($card.name)"'; rm -f /tmp/.tc.$$ ;;
  *) sed -n '2,10p' "$0"; exit 1 ;;
esac
