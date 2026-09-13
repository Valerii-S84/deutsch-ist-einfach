// Supplemental v1 cases against the isolated, built site, synthetic DBs and real browser.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { chromium } from '../.verification/browser/node_modules/playwright/index.mjs';
const origin='https://localhost:44453', output='.verification/website-analytics/v1';
mkdirSync(output,{recursive:true});
const sql=postgres('postgresql://analytics_user:synthetic-analytics-only@127.0.0.1:45442/deutschmit_analytics',{connect_timeout:3});
const site=postgres('postgresql://site_test:synthetic-site-only@127.0.0.1:45443/site_analytics_acceptance',{connect_timeout:10,max:1});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({ignoreHTTPSErrors:true});
await context.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
await context.addInitScript(()=>document.addEventListener('click',event=>{const a=event.target.closest?.('a');if(a&&new URL(a.href).origin!==location.origin)event.preventDefault();},true));
const page=await context.newPage(); page.setDefaultTimeout(20000);
const results=[], payloads=[]; let stopped;
page.on('request',request=>{if(request.url().endsWith('/api/public/analytics/events')&&request.postData())payloads.push(request.postDataJSON());});
function service(action,name){assert(['start','stop'].includes(action));assert(['website-analytics-acceptance-analytics-1','website-analytics-acceptance-analytics-db-1','admin-acceptance-test-backend-1'].includes(name));const result=spawnSync('docker',['--config',resolve('.docker-test-config'),action,name],{encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(result.status,0);stopped=action==='stop'?name:undefined;}
async function check(name,fn){try{const evidence=await fn();results.push({name,status:'PASS',evidence});console.log(`PASS: ${name}`);}catch(error){results.push({name,status:'FAIL',error:error.message});throw error;}finally{writeFileSync(`${output}/supplemental-browser.json`,JSON.stringify({generated_at:new Date().toISOString(),browser:browser.version(),results},null,2));}}
async function login(){const r=await context.request.post(origin+'/api/admin/login',{headers:{Origin:origin},data:{email:'site@example.test',password:'synthetic-site-password'}});assert.equal(r.status(),200);}
async function waitForAnalytics(){
  const deadline=Date.now()+20000;
  do{
    const response=await context.request.get(origin+'/api/admin/analytics/deutschmit/overview?days=7');
    if(response.status()===200)return;
    assert.equal(response.status(),503);
    await new Promise(resolve=>setTimeout(resolve,250));
  }while(Date.now()<deadline);
  throw new Error('Synthetic Analytics did not recover within 20 seconds');
}
try{
  assert.equal((await site`SELECT current_database() AS name`)[0].name,'site_analytics_acceptance');
  if(!process.argv.includes('--outages-only')) await check('unregistered Unicode campaign survives; private UTM field becomes unknown without dropping event; payload/rows/logs have no private markers',async()=>{
    const campaign=`Neue-Kampagne-東京-${randomUUID().slice(0,8)}`;
    await page.goto(origin+`/?utm_source=synthetic-person%40example.test&utm_medium=Paid%20Social&utm_campaign=${encodeURIComponent(campaign)}&private=SYNTHETIC_PRIVATE_QUERY#SYNTHETIC_PRIVATE_HASH`);
    await page.getByRole('button',{name:'Analytics erlauben',exact:true}).click();
    await page.waitForFunction(()=>JSON.parse(sessionStorage.getItem('deutschmit_analytics_session_v2'))?.sequence>=2);
    const visitor=await page.evaluate(()=>JSON.parse(localStorage.getItem('deutschmit_analytics_visitor_v2')).id);
    await page.evaluate(()=>window.dispatchEvent(new ErrorEvent('error',{message:'SYNTHETIC_PRIVATE_ERROR_TEXT',error:new Error('SYNTHETIC_PRIVATE_STACK')})));
    const response=page.waitForResponse(r=>r.url().endsWith('/api/public/analytics/events')&&r.status()===200);
    await page.locator("header a[data-analytics-id='telegram_bot']:visible").first().click();await response;
    const rows=await sql`SELECT * FROM analytics_events WHERE visitor_id=${visitor}`;assert(rows.length>=2);
    for(const row of rows){assert.equal(row.metadata.utm_source,'unknown');assert.equal(row.metadata.utm_medium,'paid-social');assert.equal(row.metadata.utm_campaign,campaign);assert.equal(row.path,'/');}
    const strings=[JSON.stringify(rows),JSON.stringify(payloads),readFileSync(`${output}/site.log`,'utf8'),readFileSync(`${output}/site-error.log`,'utf8')];
    const logs=spawnSync('docker',['--config',resolve('.docker-test-config'),'logs','website-analytics-acceptance-analytics-1'],{encoding:'utf8',windowsHide:true});assert.equal(logs.status,0);strings.push(logs.stdout,logs.stderr);
    for(const text of strings)for(const marker of ['synthetic-person@example.test','SYNTHETIC_PRIVATE_QUERY','SYNTHETIC_PRIVATE_HASH','SYNTHETIC_PRIVATE_ERROR_TEXT','SYNTHETIC_PRIVATE_STACK','SYNTHETIC_PRIVATE_FORM_TEXT'])assert(!text.includes(marker));
    await login();await page.goto(origin+'/admin/deutschmit/traffic');await page.getByText(campaign,{exact:true}).waitFor();
    const row=page.locator('tr').filter({hasText:campaign});assert((await row.innerText()).includes('unknown'));assert((await row.innerText()).includes('paid-social'));
    await page.screenshot({path:`${output}/new-campaign.png`,fullPage:true});return{storedRows:rows.length,campaign,source:'unknown',medium:'paid-social',privateMarkersFound:0};
  });
  await login();await waitForAnalytics();
  for(const dependency of ['website-analytics-acceptance-analytics-1','website-analytics-acceptance-analytics-db-1','admin-acceptance-test-backend-1'])await check(`isolated ${dependency} outage: public pages, both persisted forms, login and other products remain usable`,async()=>{
    service('stop',dependency);
    try{
      await login(); for(const path of ['/','/contact','/admin/products','/admin/deutsch-trainer','/admin/shorts-blocker-kids'])assert.equal((await context.request.get(origin+path)).status(),200);
      for(const type of ['student','partner']){
        const name=`Step7-${type}-${randomUUID()}`;
        const contact=type==='student'?{type,name,ageGroup:'16_25',level:'B1',goals:['alltag'],format:'individual',timeSlots:['evening'],frequency:'twice',budget:'50_100',contact:'synthetic@example.test',message:'SYNTHETIC_PRIVATE_FORM_TEXT',company:''}:{type,name,partnerType:'tutor',country:'DE',studentCount:'bis_10',offerings:['teaching'],contact:'synthetic@example.test',website:'',idea:'SYNTHETIC_PRIVATE_FORM_TEXT',startTimeline:'asap',company:''};
        contact.analytics={consent:'granted',schema_version:1,visitor_id:randomUUID(),session_id:randomUUID(),page_view_id:randomUUID(),path:'/contact',entry_path:'/contact',form_id:type,form_instance_id:randomUUID(),submission_attempt_id:randomUUID()};
        const response=await context.request.post(origin+'/api/contact',{headers:{Origin:origin},data:contact});assert.equal(response.status(),202);
        assert.equal((await site`SELECT count(*)::int AS count FROM contact_requests WHERE name=${name}`)[0].count,1);
        assert.equal((await context.request.get(origin+'/api/admin/contact-requests')).status(),200);
      }
      if(dependency.includes('analytics')){assert.equal((await context.request.get(origin+'/api/admin/analytics/deutschmit/overview?days=7')).status(),503);assert.equal((await context.request.get(origin+'/api/admin/website-analytics/overview?days=7')).status(),200);}
      else assert.equal((await context.request.get(origin+'/api/admin/analytics/deutschmit/overview?days=7')).status(),200);
      return{formsPersisted:2,login:true,productsAvailable:true};
    }finally{service('start',dependency);if(dependency.includes('analytics'))await waitForAnalytics();}
  });
}finally{if(stopped)service('start',stopped);await browser.close();await sql.end();await site.end();}
