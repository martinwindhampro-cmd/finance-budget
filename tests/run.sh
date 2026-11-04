#!/usr/bin/env bash
# Lance tous les scénarios sur ../index.html (à reconstruire avant : python3 ../src/build.py)
# Usage : ./run.sh            → tous les tests
#         ./run.sh t29 t31    → seulement ceux-là
cd "$(dirname "$0")"
[ -d node_modules ] || npm install --silent
list=${@:-$(ls t*.js | sed 's/\.js$//' | sort -V)}
fail=0
for t in $list; do
  out=$(timeout 300 node "$t.js" ../index.html 2>&1)
  n=$(echo "$out" | grep -c '^❌'); c=$(echo "$out" | grep -c 'CRASH')
  if [ "$n$c" = "00" ]; then echo "✅ $t"; else echo "❌ $t ($n échec(s)$([ $c != 0 ] && echo ', CRASH'))"; echo "$out" | grep -E '^❌|CRASH' | head -5; fail=1; fi
done
exit $fail
