"""Restore the owner's existing login without exposing credentials to the operator."""
import json
import os
import subprocess
import urllib.error
import urllib.request
from pathlib import Path

SITE = Path('/opt/quiz-arena-site')
OWNER = SITE / '.env.owner'
OP = SITE / 'current/deploy/production/operate.sh'

def login(origin, path, credentials):
    request = urllib.request.Request(origin + path, data=json.dumps(credentials).encode(),
        headers={'Content-Type': 'application/json', 'Origin': origin}, method='POST')
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status
    except urllib.error.HTTPError as error:
        return error.code

def main():
    assert os.geteuid() == 0 and os.uname().nodename == 'ubuntu-8gb-nbg1-1'
    if OWNER.exists():
        print('OWNER_OVERRIDE_ALREADY_EXISTS')
        return 2
    # Read only the named credentials through the running application's settings;
    # capture stdout in memory and never log it or inspect any environment file.
    code = ('import json; from app.core.config import get_settings; s=get_settings(); '
            'print(json.dumps({"email":s.admin_email,"password":s.admin_password_plain}))')
    result = subprocess.run(['docker', 'exec', 'quiz-arena-api-1', 'python', '-c', code],
        capture_output=True, text=True, check=False)
    if result.returncode:
        print('LEGACY_SETTINGS_UNAVAILABLE')
        return 2
    credentials = json.loads(result.stdout)
    password = credentials.get('password')
    if not password:
        print('LEGACY_PASSWORD_IS_HASH_ONLY_SECURE_OWNER_INPUT_REQUIRED')
        return 2
    if len(password) < 12:
        print('LEGACY_PASSWORD_BELOW_SITE_MINIMUM_SECURE_OWNER_INPUT_REQUIRED')
        return 2
    if login('https://deutchquizarena.de', '/api/admin/auth/login', credentials) != 200:
        print('LEGACY_RUNTIME_CREDENTIALS_NOT_CURRENT_NO_SITE_CHANGE')
        return 2
    values = {'SITE_ADMIN_EMAIL': credentials['email'], 'SITE_ADMIN_PASSWORD': password}
    fd = os.open(OWNER, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, 'w') as stream:
        for key, value in values.items():
            stream.write(key + '=' + json.dumps(value.replace('$', '$$'), ensure_ascii=False) + '\n')
    try:
        candidate = subprocess.run([str(OP), 'compose', 'config', '--format', 'json'],
            capture_output=True, text=True, check=True)
        configured = json.loads(candidate.stdout)['services']['frontend']['environment']
        assert all(configured[key] == value for key, value in values.items())
        subprocess.run([str(OP), 'compose', 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'frontend'], check=True)
        assert login('https://deutschmit.de', '/api/admin/login', credentials) == 200
    except Exception:
        OWNER.unlink()
        subprocess.run([str(OP), 'compose', 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'frontend'], check=False)
        print('OWNER_RESTORE_FAILED_PREVIOUS_SITE_CONFIG_RESTORED')
        return 1
    print('EXISTING_OWNER_EMAIL_AND_PASSWORD_RESTORED_SITE_LOGIN_200')
    return 0

if __name__ == '__main__':
    try:
        raise SystemExit(main())
    except SystemExit:
        raise
    except Exception:
        print('OWNER_RESTORE_ERROR_NO_CREDENTIALS_LOGGED')
        raise SystemExit(1)
