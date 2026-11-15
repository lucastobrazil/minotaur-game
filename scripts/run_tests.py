"""Run every headless browser test (tests/t*.py) for one game against its dist/index.html.
Usage (from a game folder): python3 ../../scripts/run_tests.py tests   (run `npm run build` first)
Each test prints its checks; a test fails if it exits non-zero or reports page errors."""
import glob, os, subprocess, sys
here = os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'tests')
failed = []
for path in sorted(glob.glob(os.path.join(here, 't*.py'))):
    name = os.path.basename(path)
    if name == 'run_all.py':
        continue
    r = subprocess.run([sys.executable, path], capture_output=True, text=True, timeout=300)
    out = r.stdout.strip().splitlines()
    page_errors = [l for l in out if l.startswith('[') and l.endswith(']') and ('Error' in l or 'error' in l)]
    ok = r.returncode == 0 and not page_errors
    print(('PASS ' if ok else 'FAIL ') + name)
    for l in out[-6:]:
        print('    ' + l)
    if not ok:
        failed.append(name)
        print(r.stderr[-1500:])
print('\n%d failed' % len(failed) if failed else '\nall passed')
sys.exit(1 if failed else 0)
