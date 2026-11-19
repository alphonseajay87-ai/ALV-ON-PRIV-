"""Smoke test: loads every tab on a phone viewport, fails on any console/page error.
Usage: python3 -m http.server 8765 (from project root), then python3 tests/smoke.py [outdir]"""
import sys, json, os
from playwright.sync_api import sync_playwright
out = sys.argv[1] if len(sys.argv) > 1 else '/tmp/shots'; os.makedirs(out, exist_ok=True)
errs = []
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, service_workers='block')
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append('pageerror: %s' % e))
    pg.on('console', lambda m: errs.append('console: %s' % m.text) if m.type == 'error' else None)
    pg.goto('http://localhost:8765/'); pg.wait_for_timeout(300)
    pg.goto('http://localhost:8765/?nosplash'); pg.wait_for_timeout(1500)
    pg.screenshot(path=f'{out}/onboarding.png')
    pg.click('#skip'); pg.wait_for_timeout(700)
    for t in ['today', 'train', 'body', 'fuel', 'coach']:
        pg.evaluate("h=>location.hash=h", '#' + t); pg.wait_for_timeout(900)
        pg.screenshot(path=f'{out}/{t}.png')
    # interactions
    pg.evaluate("location.hash='#body'"); pg.wait_for_timeout(700)
    pg.click('.hit[data-m=chest]', force=True); pg.wait_for_timeout(400); pg.screenshot(path=f'{out}/body-sel.png')
    pg.evaluate("location.hash='#today'"); pg.wait_for_timeout(700)
    pg.click('#gear'); pg.wait_for_timeout(700); pg.screenshot(path=f'{out}/settings.png'); pg.keyboard.press('Escape'); pg.wait_for_timeout(500)
    pg.click('#begin'); pg.wait_for_timeout(1200); pg.screenshot(path=f'{out}/session.png')
    pg.click('.chk >> nth=0'); pg.wait_for_timeout(600); pg.screenshot(path=f'{out}/session-rest.png')
    b.close()
print('\n'.join(errs) or 'NO ERRORS')
