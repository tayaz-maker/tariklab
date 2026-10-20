// Workers Builds starts alongside Actions. Wait only for the same main SHA;
// failures, stale branches and API errors still stop publication immediately.
export async function waitForRelease({sha, main, runs, read, verify, delay, attempts=17}) {
  for(let attempt=0;;attempt++) {
    if(sha!==main)throw new Error('Main moved; refuse a stale production release');
    const paths=['.github/workflows/ci.yml','.github/workflows/tc-job-start-outcome.yml'];
    const selected=paths.map(path=>runs.filter(r=>r.path===path&&r.event==='push'&&r.head_branch==='main'&&r.head_sha===sha).sort((a,b)=>b.id-a.id)[0]);
    for(const run of selected) {
      if(run?.status==='completed'&&run.conclusion!=='success')throw new Error(`${run.path} must PASS before production`);
    }
    if(selected.every(r=>r?.status==='completed'))return verify({sha,main,runs});
    if(attempt>=attempts)throw new Error('Exact-main CI/TC did not finish within the production build budget');
    console.log(`Exact-main CI/TC pending; publication remains blocked (${attempt+1}/${attempts})`);
    await delay(45000);
    const [branch,workflows]=await Promise.all([read('branches/main'),read(`actions/runs?head_sha=${sha}&event=push&per_page=100`)]);
    main=branch.commit.sha;runs=workflows.workflow_runs;
  }
}
