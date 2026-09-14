"""Deploy the reviewed statistics fix on the existing VPS; no backup/2FA changes."""
import json
import os
import pathlib
import re
import subprocess
import sys

def run(args, **kwargs):
    return subprocess.check_output(args, text=True, timeout=kwargs.pop('timeout', 180), **kwargs).strip()

assert os.geteuid() == 0
assert run(['hostname']) == 'ubuntu-8gb-nbg1-1'
revision = sys.argv[1]
assert re.fullmatch('[0-9a-f]{40}', revision)
root = pathlib.Path('/opt/deutschmit-releases') / revision
assert root.is_dir() and root.resolve() == root
site = pathlib.Path('/opt/quiz-arena-site')
previous = (site / 'current').resolve()
assert previous.parent == root.parent and previous != root
op = str(root / 'deploy/production/operate.sh')
assert sys.argv[2:] in ([], ['--resume'])
resume = sys.argv[2:] == ['--resume']
for shell_script in (root / 'deploy/production').glob('*.sh'):
    shell_script.write_bytes(shell_script.read_bytes().replace(b'\r\n', b'\n'))

def build(label, args):
    if resume:
        image = args[args.index('-t') + 1]
        assert run(['docker', 'image', 'inspect', '--format', '{{index .Config.Labels "org.opencontainers.image.revision"}}', image]) == revision
        print('REUSE_VERIFIED_IMAGE ' + label, flush=True)
        return
    print('BUILD_START ' + label, flush=True)
    with (root / ('build-' + label + '.log')).open('w') as log:
        result = subprocess.run(args, cwd=root, stdout=log, stderr=subprocess.STDOUT, timeout=900)
    if result.returncode:
        print('\n'.join((root / ('build-' + label + '.log')).read_text().splitlines()[-30:]))
        raise RuntimeError('BUILD_FAILED_' + label)
    print('BUILD_OK ' + label, flush=True)

front = 'deutschmit-site:fix-' + revision[:12]
analytics = 'deutschmit-analytics:fix-' + revision[:12]
build('frontend', ['docker', 'build', '--target', 'production', '-t', front,
    '--label', 'org.opencontainers.image.revision=' + revision,
    '--build-arg', 'NEXT_PUBLIC_WEBSITE_ANALYTICS_MODE=new',
    '--build-arg', 'NEXT_PUBLIC_SITE_URL=https://deutschmit.de',
    '--build-arg', 'NEXT_PUBLIC_TELEGRAM_BOT_URL=https://t.me/Deine_Deutsch_Quiz_bot',
    '--build-arg', 'NEXT_PUBLIC_TELEGRAM_CHANNEL_URL=https://t.me/doechkurse',
    '--build-arg', 'NEXT_PUBLIC_DEUTSCH_TRAINER_BOT_URL=https://t.me/Trainer1512_bot',
    '--build-arg', 'NEXT_PUBLIC_CONTACT_EMAIL=info@deutschmit.de', '.'])
build('analytics', ['docker', 'build', '-f', 'services/analytics/Dockerfile', '-t', analytics,
    '--label', 'org.opencontainers.image.revision=' + revision, '.'])
front_id = run(['docker', 'image', 'inspect', '--format', '{{.Id}}', front])
analytics_id = run(['docker', 'image', 'inspect', '--format', '{{.Id}}', analytics])

if not resume:
    # Exercise the reporting view on synthetic records in an inaccessible disposable DB.
    network = 'deutschmit-stats-check-' + revision[:12]
    container = network + '-db'
    assert subprocess.run(['docker', 'container', 'inspect', container], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0
    assert subprocess.run(['docker', 'network', 'inspect', network], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL).returncode != 0
    run(['docker', 'network', 'create', '--internal', network])
    try:
        run(['docker', 'run', '-d', '--name', container, '--network', network,
            '-e', 'POSTGRES_USER=analytics_user', '-e', 'POSTGRES_DB=deutschmit_analytics',
            '-e', 'POSTGRES_PASSWORD=synthetic-statistics-check-only', 'postgres:16-alpine'])
        run(['docker', 'exec', container, 'sh', '-ec', 'for i in $(seq 1 30); do pg_isready -h 127.0.0.1 -U analytics_user -d deutschmit_analytics && exit 0; sleep 1; done; exit 1'], timeout=40)
        for migration in sorted((root / 'services/analytics/db/migrations').glob('*.sql')):
            run(['docker', 'exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'analytics_user', '-d', 'deutschmit_analytics'], input=migration.read_text())
        print(run(['docker', 'run', '--rm', '-i', '--network', network,
            '-e', 'ANALYTICS_DATABASE_URL=postgresql://analytics_user:synthetic-statistics-check-only@' + container + ':5432/deutschmit_analytics',
            analytics_id, 'node', '--input-type=module'], input=(root / 'deploy/production/check-report-exclusions.mjs').read_text()), flush=True)
    finally:
        subprocess.run(['docker', 'rm', '-f', container], stdout=subprocess.DEVNULL)
        subprocess.run(['docker', 'network', 'rm', network], stdout=subprocess.DEVNULL)

release = site / 'release.env'
old_release = release.read_text()
old_state = root / 'previous-release.env'
old_state.write_text(old_release)
old_state.chmod(0o600)
(root / 'previous-root.txt').write_text(str(previous))
new_release = old_release
for name, value in [('FRONTEND_IMAGE', front_id), ('ANALYTICS_IMAGE', analytics_id)]:
    new_release, count = re.subn('(?m)^' + name + '=.*$', name + '=' + value, new_release)
    assert count == 1
try:
    release.write_text(new_release)
    run([op, 'compose', 'run', '--rm', '--no-deps', 'site-migrate'])
    run([op, 'compose', 'run', '--rm', '--no-deps', 'analytics', 'npm', 'run', 'migrate'])
    exclusion_sql = """BEGIN;
    INSERT INTO analytics_excluded_visitors(product_id,visitor_id,reason) VALUES
      ('deutschmit','434173f3-3430-41a8-8822-bd491f7361f1','deployment_test_pr22'),
      ('deutschmit','3857c94b-83d1-4d4c-ad9e-b642cd8383f2','deployment_test_pr22_contact'),
      ('deutschmit','9c4dca54-f89b-4bf6-a920-151958810abc','statistics_fix_browser_check')
    ON CONFLICT (product_id,visitor_id) DO NOTHING;
    COMMIT;"""
    run([op, 'compose', 'exec', '-T', 'analytics-db', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'analytics_user', '-d', 'deutschmit_analytics'], input=exclusion_sql)
    contact_sql = """BEGIN;
    DO $$ BEGIN IF (SELECT count(*) FROM contact_requests WHERE name='DEPLOYMENT TEST PR22' AND contact='deployment-test@example.invalid') <> 1 THEN RAISE EXCEPTION 'Expected exact deployment test contact'; END IF; END $$;
    UPDATE contact_requests SET is_test=true WHERE name='DEPLOYMENT TEST PR22' AND contact='deployment-test@example.invalid'; COMMIT;"""
    run([op, 'compose', 'exec', '-T', 'site-db', 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'site_user', '-d', 'deutschmit_site'], input=contact_sql)
    run([op, 'compose', 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'analytics', 'frontend', 'analytics-retention'])
    print(run(['docker', 'exec', '-i', 'quiz-arena-site-frontend-1', 'node', '--input-type=module'], input=(root / 'deploy/production/check-runtime.mjs').read_text()), flush=True)
    temporary = site / ('current-' + revision[:12])
    temporary.symlink_to(root)
    temporary.replace(site / 'current')
    state = {'revision': revision, 'frontend_image': front_id, 'analytics_image': analytics_id, 'previous_root': str(previous), 'status': 'runtime_verified'}
    (site / 'deployment-state/statistics-fix.json').write_text(json.dumps(state, indent=2))
    import hashlib
    manifest = ''.join(hashlib.sha256(p.read_bytes()).hexdigest() + '  ' + str(p) + '\n' for p in sorted((root / 'deploy/production').glob('*')) if p.is_file())
    (site / 'deployment-state/operations.sha256').write_text(manifest)
    print(json.dumps(state), flush=True)
except BaseException:
    release.write_text(old_release)
    run([str(previous / 'deploy/production/operate.sh'), 'compose', 'up', '-d', '--no-deps', '--wait', '--wait-timeout', '120', 'frontend', 'analytics', 'analytics-retention'])
    print('PREVIOUS_IMAGES_RESTORED_ADDITIVE_MIGRATIONS_RETAINED', flush=True)
    raise
