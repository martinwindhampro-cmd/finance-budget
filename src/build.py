# Assemble l'application : src/shell.html (HTML + CSS) + src/app*.js (JavaScript) → index.html à la racine (servi par GitHub Pages).
# Usage (depuis la racine du dépôt) : python3 src/build.py
import os
here = os.path.dirname(os.path.abspath(__file__))
ORDER = ['app1.js', 'app2.js', 'app3.js', 'app6.js', 'app7.js', 'app8.js', 'app9.js', 'app10.js', 'app11.js', 'app12.js', 'app13.js', 'app14.js', 'app15.js', 'app16.js', 'app5.js', 'app4.js']
sh = open(os.path.join(here, 'shell.html'), encoding='utf-8').read()
assert sh.count('/*APP_JS*/') == 1, 'shell.html doit contenir une seule fois /*APP_JS*/'
js = '\n'.join(open(os.path.join(here, f), encoding='utf-8').read() for f in ORDER)
out = os.path.join(here, '..', 'index.html')
open(out, 'w', encoding='utf-8').write(sh.replace('/*APP_JS*/', js))
print('index.html généré :', os.path.getsize(out), 'octets')
