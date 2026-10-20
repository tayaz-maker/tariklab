from pathlib import Path
import sys,json,re
stage,main,root=sys.argv[1:];root=Path(root)
assert stage in ['a','b','c'] and re.fullmatch(r'[0-9a-f]{40}',main)
files=[]
for name in ['racon-region']+([] if stage=='a' else ['racon-crew-police']):
 p=root/'scripts'/(name+'-browser.mjs');s=p.read_text();old='const origin=`http://127.0.0.1:${server.address().port}`;';assert s.count(old)==1
 s=s.replace(old,'const origin=process.env.RACON_BASE||`http://127.0.0.1:${server.address().port}`;')
 files.append({'path':'scripts/'+name+'-production.mjs','mode':'100644','type':'blob','content':s})
files.append({'path':'scripts/racon-release-production.mjs','mode':'100644','type':'blob','content':Path(__file__).with_name('racon-release-production.mjs').read_text()})
yml='''name: Racon @STAGE@ production acceptance
on:
  push:
    branches: [qa/racon-@STAGE@-production-20261020]
permissions:
  contents: read
jobs:
  production:
    strategy:
      fail-fast: false
      matrix:
        include:
          - label: www
            origin: https://www.tariklab.com
          - label: workers
            origin: https://tariklab.tayaz29.workers.dev
    runs-on: ubuntu-latest
    timeout-minutes: 12
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: {node-version: '22', cache: npm}
      - run: npm ci
      - run: npx playwright install --with-deps chromium --only-shell
      - name: Exact deployed files and real manager decisions and portal save/reload
        env:
          BROWSER_ALLOW_EXTERNAL_HOST: '1'
          RACON_BASE: ${{ matrix.origin }}
          RACON_LABEL: ${{ matrix.label }}
          RELEASE_STAGE: @STAGE@
          RELEASE_MAIN: @MAIN@
        run: node scripts/racon-release-production.mjs
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: racon-@STAGE@-production-${{ matrix.label }}
          path: |
            ${{ runner.temp }}/screenshots/racon-production
            ${{ runner.temp }}/screenshots/racon-region
            ${{ runner.temp }}/screenshots/racon-crew-police
            ${{ runner.temp }}/screenshots/racon-language
'''.replace('@STAGE@',stage).replace('@MAIN@',main)
files.append({'path':'.github/workflows/racon-'+stage+'-production.yml','mode':'100644','type':'blob','content':yml})
print(json.dumps(files,ensure_ascii=False))
