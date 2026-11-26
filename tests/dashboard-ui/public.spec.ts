import { expect, test, type Page, type Locator } from '@playwright/test';
const job={id:'job-1',title:'Community support',description:'Support our community.',requirements:'Be helpful.',tags:['Support'],status:'OPEN',questions:[{id:'name',label:'Your experience',type:'short_answer',required:true},{id:'role',label:'Preferred team',type:'multi_choice',required:true,options:['Support','Development']},{id:'agree',label:'Community guidelines',type:'checkbox',required:true}]};
const post={id:'post-1',slug:'ui-update',title:'A clearer interface',description:'Our latest improvements.',created_at:'2026-10-01',published_at:'2026-10-01',rolink_version:'1.0',plugin_version:'1.0',major_features:[{title:'Theme options',description:'Choose your preferred appearance.',subFeatures:[]}],minor_updates:[],qol_updates:[],bug_fixes:[],status:'PUBLISHED'};
async function fixtures(page:Page, signedIn=true) {
  const errors:string[]=[];const writes:Array<{path:string;body:Record<string,unknown>}>=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async route=>{
    const path=new URL(route.request().url()).pathname;
    let body:unknown={};
    if(path==='/api/auth/session')body=signedIn?{user:{id:'test-user',name:'UI Tester'},expires:'2099-01-01T00:00:00Z'}:{};
    else if(path==='/api/site-banners')body=[];
    else if(path==='/api/custom-dashboard/resolve')body={found:false};
    else if(path==='/api/stats')body={guild_count:42,command_count:1024};
    else if(path==='/api/careers')body=[job];
    else if(path==='/api/careers/job-1')body=job;
    else if(path==='/api/posts')body=[post];
    else if(path==='/api/posts/ui-update')body=post;
    else if(path==='/api/verify/linked-account')body={roblox_id:'42',roblox_username:'RobloxTester',username:'RobloxTester',headshot_url:null};
    else if(path==='/api/moderation-appeals')body={linked:true,identity:{discordId:'test-user',robloxId:'42'},options:[{key:'moderation-1',targetLabel:'RobloxTester',reason:'Review fixture',moderatedAt:null}]};
    if(route.request().method()==='POST'&&['/api/public-reports','/api/moderation-appeals','/api/careers/job-1/submit'].includes(path)){
      writes.push({path,body:route.request().postDataJSON()});body=path==='/api/public-reports'?{reportId:'report-1'}:path==='/api/moderation-appeals'?{appealId:'appeal-1'}:{ok:true};
    }
    await route.fulfill({json:body});
  });return {errors,writes};
}
async function color(locator:Locator,property:'backgroundColor'|'color',expected:string) {
  const result=await locator.evaluate((node,{property,expected})=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=1;const context=canvas.getContext('2d')!;
    const rgba=(value:string)=>{context.clearRect(0,0,1,1);context.fillStyle=value;context.fillRect(0,0,1,1);return [...context.getImageData(0,0,1,1).data];};
    return {actual:rgba(getComputedStyle(node)[property]),expected:rgba(expected)};
  },{property,expected});expect(result.actual).toEqual(result.expected);
}
for(const theme of ['light','dark']) {
  test(`public pages use Dice surfaces and persist ${theme} mode`,async({page})=>{
    test.setTimeout(180_000);const {errors}=await fixtures(page);
    await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    for(const path of ['/','/features','/pricing','/careers','/careers/job-1','/posts','/posts/ui-update','/report','/verify','/privacy','/terms','/terms/modules/create','/terms/modules/use','/dgsu','/auth/signin','/plugin/connect','/site-testing-access']) {
      await page.goto(path);await expect(page.locator('[data-public-theme]')).toBeVisible();
      await expect(page.locator('h1').first()).toBeVisible();
      await color(page.locator('[data-public-theme]'),'backgroundColor',theme==='dark'?'oklch(0.145 0 0)':'oklch(1 0 0)');
      await color(page.locator('[data-public-header]'),'backgroundColor',theme==='dark'?'oklch(0.145 0 0)':'oklch(1 0 0)');
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      await expect(page.locator('[data-public-header]').getByRole('button',{name:/Switch to .* mode/})).toBeEnabled();
    }
    await page.goto('/');await expect(page.locator('[data-slot="stat"]')).toHaveCount(3);
    await expect(page.locator('[data-slot="card"]')).not.toHaveCount(0);
    await page.getByRole('button',{name:/Switch to .* mode/}).click();
    await color(page.locator('[data-public-theme]'),'backgroundColor',theme==='light'?'oklch(0.145 0 0)':'oklch(1 0 0)');
    await page.getByRole('button',{name:/Switch to .* mode/}).click();
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-public-home-${test.info().project.name}.png`,fullPage:true});
    expect(errors).toEqual([]);
  });
  test(`public navigation menus preserve ${theme} mode`,async({page})=>{
    const {errors}=await fixtures(page);await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/');
    const mobile=page.getByRole('button',{name:'Open navigation menu'});
    await (await mobile.isVisible()?mobile:page.getByRole('button',{name:'Help',exact:true})).click();
    const menu=page.getByRole('menu');await expect(menu).toBeVisible();
    await color(menu,'backgroundColor',theme==='dark'?'oklch(0.205 0 0)':'oklch(1 0 0)');
    await menu.getByRole('menuitem',{name:'Careers',exact:true}).click();
    await expect(page).toHaveURL(/\/careers$/);await expect(page.getByRole('heading',{level:1})).toBeVisible();
    expect(await page.evaluate(()=>localStorage.getItem('rolink-theme'))).toBe(theme);
    expect(errors).toEqual([]);
  });
  test(`public forms preserve report, appeal and career payloads in ${theme} mode`,async({page})=>{
    const {errors,writes}=await fixtures(page);await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/report');await page.getByRole('combobox',{name:'Platform',exact:true}).fill('Discord');
    await page.getByRole('option',{name:'Discord',exact:true}).click();
    await page.locator('#report-target-id').fill('123456789012345678');
    await page.locator('#report-reason').fill('A report with enough information to review.');
    await page.locator('#report-evidence').fill('https://example.test/evidence');
    await page.getByRole('button',{name:'Submit report',exact:true}).click();
    await expect.poll(()=>writes.length).toBe(1);expect(writes[0].body).toMatchObject({userPlatform:'discord',targetId:'123456789012345678'});
    await page.getByRole('group',{name:'Choose reports or appeals'}).getByRole('button',{name:/^Appeal/}).click();
    await expect(page.getByRole('combobox',{name:'Moderation action',exact:true})).toBeVisible();
    await page.locator('#appeal-reason').fill('Please review this moderation with the attached context.');
    await page.getByRole('button',{name:'Submit appeal',exact:true}).click();await expect.poll(()=>writes.length).toBe(2);
    expect(writes[1].body).toMatchObject({moderationKey:'moderation-1'});
    await page.goto('/careers/job-1');await page.locator('#application-name').fill('I have supported several communities.');
    await page.getByRole('combobox',{name:'Preferred team',exact:true}).fill('Support');await page.getByRole('option',{name:'Support',exact:true}).click();
    await page.getByRole('checkbox').check();await page.getByRole('button',{name:/Submit application/i}).click();
    await expect.poll(()=>writes.length).toBe(3);expect(writes[2].body).toEqual({answers:{name:'I have supported several communities.',role:'Support',agree:true}});
    expect(errors).toEqual([]);
  });
  test(`documentation navigation, search and tables follow ${theme} Dice styling`,async({page})=>{
    const {errors}=await fixtures(page);await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/docs');await expect(page.locator('h1')).toBeVisible();
    await color(page.locator('[data-public-theme]'),'backgroundColor',theme==='dark'?'oklch(0.145 0 0)':'oklch(1 0 0)');
    await page.keyboard.press('Control+k');const dialog=page.getByRole('dialog',{name:'Search documentation'});await expect(dialog).toBeVisible();
    await dialog.getByRole('textbox',{name:'Search documentation'}).fill('API');
    await expect(dialog.getByRole('button').filter({hasText:/API/}).first()).toBeVisible();
    await page.keyboard.press('Escape');await expect(dialog).not.toBeVisible();
    const menu=page.getByRole('button',{name:'Open documentation navigation'});if(await menu.isVisible())await menu.click();
    await page.getByRole('navigation',{name:'Documentation pages'}).getByRole('button',{name:'Public API',exact:true}).click();
    await expect(page.locator('[data-slot="table"]').first()).toBeVisible();
    await color(page.locator('[data-slot="card"]').first(),'backgroundColor',theme==='dark'?'oklch(0.205 0 0)':'oklch(1 0 0)');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-public-docs-${test.info().project.name}.png`,fullPage:true});
    expect(errors).toEqual([]);
  });
}
