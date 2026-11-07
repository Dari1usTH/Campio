"""Real UI/API/database smoke. Requires a running app and Mailpit dev inbox.

No API mocks or fixed OTPs for newly registered users. Mailpit is read only;
unique addresses isolate concurrent runs. Screenshots/traces stay ignored.
"""
import json
import os
from pathlib import Path
import re
import shutil
import time
from urllib.request import urlopen
import uuid

from playwright.sync_api import sync_playwright, expect

ROOT = Path(__file__).resolve().parents[2]
BASE = os.environ.get('E2E_BASE_URL', 'http://localhost:8080').rstrip('/')
MAIL = os.environ.get('E2E_MAIL_URL', 'http://localhost:8025').rstrip('/')
REPORT = ROOT / 'test-results'
REPORT.mkdir(exist_ok=True)


def read_json(url):
    with urlopen(url, timeout=10) as response:
        return json.load(response)


def mailbox(email, pattern, timeout=30):
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        for message in read_json(MAIL + '/api/v1/messages')['messages']:
            if not any(recipient.get('Address', '').lower() == email.lower()
                       for recipient in message.get('To', [])):
                continue
            detail = read_json(MAIL + '/api/v1/message/' + message['ID'])
            match = re.search(pattern, detail.get('Text', '') + '\n' + detail.get('HTML', ''))
            if match:
                return match.group(1)
        time.sleep(0.3)
    raise AssertionError('Timed out waiting for expected mail for ' + email)


def translations():
    resources = json.loads((ROOT / 'Frontend/src/i18n/en.json').read_text())
    return resources.get('core', resources)


def run_width(browser, width):
    t = translations()
    context = browser.new_context(viewport={'width': width, 'height': 900},
                                  locale='ro-RO', permissions=['clipboard-read', 'clipboard-write'])
    context.tracing.start(screenshots=True, snapshots=True, sources=False)
    page = context.new_page()
    page.set_default_timeout(20000)
    failures = []
    console_errors = []
    page.on('pageerror', lambda error: failures.append(str(error)))
    page.on('console', lambda message: console_errors.append(message.text) if message.type == 'error' else None)
    # An anonymous bootstrap session probe may return 401, an intentional auth state.
    page.on('response', lambda response: failures.append(f'HTTP {response.status}: {response.url}')
            if response.status >= 400 and not (
                response.status == 401 and re.search(r'/auth/(?:session|me)(?:\?|$)', response.url)) else None)
    email = f'e2e-{width}-{uuid.uuid4().hex[:10]}@campio.test'
    password = 'CampioE2e!' + uuid.uuid4().hex
    try:
        page.goto(BASE + '/')
        expect(page.locator('html')).to_have_attribute('lang', 'en')
        page.get_by_role('button', name='RO', exact=True).first.click()
        expect(page.locator('html')).to_have_attribute('lang', 'ro')
        page.reload()
        expect(page.locator('html')).to_have_attribute('lang', 'ro')
        page.get_by_role('button', name='EN', exact=True).first.click()
        expect(page.locator('html')).to_have_attribute('lang', 'en')

        page.goto(BASE + '/signup')
        page.locator('#email').fill(email)
        page.locator('#password').fill(password)
        page.locator('input[type=checkbox]').check()
        page.locator('form button[type=submit]').click()
        page.wait_for_url('**/verify-2fa')
        code = mailbox(email, r'\b(\d{6})\b')
        for i, digit in enumerate(code):
            page.locator('input[inputmode=numeric]').nth(i).fill(digit)
        page.locator('form button').click()
        page.wait_for_url(re.compile(r'/app/?$'))
        expect(page.locator('html')).to_have_attribute('lang', 'en')

        # Prompt (+ optional photos) -> server generation/polling -> kit rendered from the Kit contract.
        page.goto(BASE + '/app/new')
        page.locator('#prompt').fill(
            'Hand poured soy candle with pine fragrance, burns 45 hours, 89 RON, for thoughtful gifts.')
        page.locator('form button[type=submit]').click()
        page.wait_for_url(re.compile(r'/app/campaigns/[^/?#]+$'), timeout=20000)
        campaign_id = page.url.rsplit('/', 1)[1]
        # MOCK_AI names the product itself; the header shows what the intake understood.
        expect(page.locator('h1')).to_contain_text('Soy candle', timeout=60000)
        page.get_by_role('tab', name=re.compile(r'^Content')).click()
        page.get_by_role('button', name=t['common']['copy'], exact=True).first.click()
        page.wait_for_function('navigator.clipboard.readText().then(text => text.length > 0)')
        # Nothing from the old invented UI (scores, warnings, posters) may come back.
        for gone in ['/ 100', 'Poster', 'Warnings']:
            expect(page.get_by_text(gone)).to_have_count(0)
        page.screenshot(path=str(REPORT / f'report-{width}.png'), full_page=True)

        page.goto(BASE + '/app/campaigns')
        expect(page.get_by_text('Soy candle', exact=True).first).to_be_visible()
        page.goto(BASE + '/app/campaigns/' + campaign_id + '/results')
        values = {'spent': '120', 'impressions': '8000', 'clicks': '240', 'orders': '12', 'revenue': '1068'}
        for key, value in values.items():
            for field in page.locator(f'input[id$="-{key}"]').all():
                field.fill(value)
        page.locator('form button[type=submit]').click()
        expect(page.locator('#results-analysis')).to_be_visible()

        for route in ['/app', '/app/assets', '/app/settings']:
            page.goto(BASE + route)
            expect(page.locator('main')).to_be_visible()
            expect(page.locator('html')).to_have_attribute('lang', 'en')
            assert page.locator('body').evaluate('(el) => el.scrollWidth <= innerWidth + 2'), \
                f'Horizontal page overflow at {route}, width={width}'
        page.goto(BASE + '/app/settings')
        logout = page.get_by_role('button', name=t['nav']['logout'], exact=True)
        if not logout.first.is_visible():
            # Mobile logout is available in settings/security or the account menu.
            page.get_by_role('button', name=re.compile(t['common']['menu'])).first.click()
        page.get_by_role('button', name=t['nav']['logout'], exact=True).first.click()
        page.wait_for_url(re.compile(r'/(?:login)?$'))

        # Recovery uses actual email with a server-issued, single-use token.
        page.goto(BASE + '/forgot-password')
        page.locator('#email').fill(email)
        page.locator('form button').click()
        token = mailbox(email, r'/reset-password\?token=([A-Za-z0-9_-]+)')
        page.goto(BASE + '/reset-password?token=' + token)
        new_password = 'Reset!' + uuid.uuid4().hex
        page.locator('#password').fill(new_password)
        page.locator('#confirm').fill(new_password)
        page.locator('form button[type=submit]').click()
        expect(page.get_by_role('heading', name=t['auth']['resetSuccessTitle'], exact=True)).to_be_visible()
        page.goto(BASE + '/login')
        page.locator('#email').fill(email)
        page.locator('#password').fill(new_password)
        page.locator('form button[type=submit]').click()
        page.wait_for_url('**/verify-2fa')
        code = mailbox(email, r'\b(\d{6})\b')
        for i, digit in enumerate(code):
            page.locator('input[inputmode=numeric]').nth(i).fill(digit)
        page.locator('form button').click()
        page.wait_for_url(re.compile(r'/app/?$'))
        assert not failures, '\n'.join(failures)
        # Chromium reports resource failures for expected anonymous session 401s.
        unexpected_console = [line for line in console_errors
                              if '401 (Unauthorized)' not in line]
        assert not unexpected_console, '\n'.join(unexpected_console)
        print(f'PASS {width}px: language persistence, signup/email 2FA, wizard/generation/report, '
              'clipboard, history, results, assets/settings, logout, reset and login')
        return {'width': width, 'status': 'passed', 'consoleErrors': unexpected_console,
                'networkErrors': failures}
    except Exception:
        page.screenshot(path=str(REPORT / f'failure-{width}.png'), full_page=True)
        print('Page URL:', page.url)
        print('Page alerts:', page.locator('[role=alert]').all_text_contents())
        print('Network errors:', failures)
        raise
    finally:
        context.tracing.stop(path=str(REPORT / f'trace-{width}.zip'))
        context.close()


if __name__ == '__main__':
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium') or shutil.which('chromium-browser')
    with sync_playwright() as playwright:
        options = {'headless': True, 'args': ['--no-sandbox', '--disable-dev-shm-usage']}
        if executable:
            options['executable_path'] = executable
        browser = playwright.chromium.launch(**options)
        results = [run_width(browser, width)
                   for width in map(int, os.environ.get('E2E_WIDTHS', '375,768,1280').split(','))]
        (REPORT / 'smoke.json').write_text(json.dumps(results, indent=2))
        browser.close()
