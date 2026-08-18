#!/usr/bin/env python3
"""
Compila la demo multi-file in un unico HTML autonomo.

    python build.py

Produce  dist/parking_cloud_demo.html : un solo file, apribile con doppio
click e inviabile per email. I sorgenti in src/ restano la versione di lavoro.
"""
import pathlib, re, datetime

BASE = pathlib.Path(__file__).parent
SRC  = BASE / 'src'
DIST = BASE / 'dist'

# stesso ordine di caricamento dichiarato in src/index.html
ORDINE = [
    'state.js', 'ui.js', 'modals.js',
    'fm/dashboard.js', 'fm/mappa.js', 'fm/accessi.js', 'fm/prenotazioni.js',
    'fm/segnalazioni.js', 'fm/dipendenti.js', 'fm/visitatori.js',
    'fm/hardware.js', 'fm/config.js', 'fm/amministrazione.js', 'fm/analytics.js',
    'employee/index.js',
]

def main():
    html = (SRC / 'index.html').read_text(encoding='utf-8')

    # 1. CSS inline al posto del <link>
    css = (SRC / 'styles.css').read_text(encoding='utf-8')
    html = html.replace(
        '<link rel="stylesheet" href="styles.css">',
        '<style>\n' + css + '\n</style>')

    # 2. JS inline al posto dei <script src>
    blocchi = []
    for rel in ORDINE:
        code = (SRC / rel).read_text(encoding='utf-8')
        # una stringa "</script>" dentro al codice chiuderebbe il tag
        code = code.replace('</script>', '<\\/script>')
        blocchi.append(f'/* ===== {rel} ===== */\n{code}')
        html = html.replace(f'<script src="{rel}"></script>', '', 1)

    html = html.replace('<script>\n/* ============',
                        '<script>\n' + '\n'.join(blocchi) + '\n</script>\n<script>\n/* ============', 1)

    # 3. pulizia delle righe vuote lasciate dai tag rimossi
    html = re.sub(r'\n{3,}', '\n\n', html)

    DIST.mkdir(exist_ok=True)
    out = DIST / 'parking_cloud_demo.html'
    out.write_text(html, encoding='utf-8')

    kb = out.stat().st_size / 1024
    print(f'OK  {out}  ({kb:.0f} KB)  {datetime.date.today()}')
    rimasti = re.findall(r'<script src="[^"]+"></script>|<link[^>]+styles\.css', html)
    if rimasti:
        print('  ATTENZIONE, riferimenti esterni residui:', rimasti)

if __name__ == '__main__':
    main()
