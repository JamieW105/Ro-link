import { expect, test, type Page } from '@playwright/test';
import sharp from 'sharp';
import { randomBytes } from 'node:crypto';
const owner='test-user';
const paths=Array.from({length:4},(_,index)=>`${owner}/00000000-0000-4000-8000-${String(index+1).padStart(12,'0')}.webp`);
const addon={id:'cover-module',slug:'cover-module',name:'Cover module',description:'Module with cover images.',version:'1.0.0',category:'General',status:'DRAFT',sourceCode:'return {}',configSchema:{},authorDiscordId:owner,coverImages:[] as string[],isOfficial:false,creatorIsVerified:false};
const coverSource=(path:string)=>new RegExp('/api/module-covers/'+path.replace('.webp','\\.webp')+'$');
const png=()=>sharp({create:{width:320,height:180,channels:3,background:'#059669'}}).png().toBuffer();
async function mocks(page:Page, current:()=>typeof addon) {
  const images=new Map<string,Buffer>();
  const errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/api/**',async route=>{
    const pathname=new URL(route.request().url()).pathname;
    let body:unknown={};
    if(pathname==='/api/auth/session')body={user:{id:owner,name:'Creator'},expires:'2099-01-01T00:00:00Z'};
    if(pathname==='/api/site-banners')body={banners:[]};
    if(pathname==='/api/custom-dashboard/resolve')body={isCustomDashboard:false};
    if(pathname==='/api/dashboard/creator/modules')body={modules:[current()]};
    if(pathname==='/api/dashboard/marketplace')body={modules:[current()],installTargets:[]};
    if(pathname.endsWith('/reviews'))body={reviews:[],ownReview:null,average:0,total:0,hasMore:false,canReview:true,ownModule:true};
    if(pathname.startsWith('/api/module-covers/'))return route.fulfill({contentType:'image/webp',body:images.get(pathname.slice('/api/module-covers/'.length))||await sharp(await png()).webp().toBuffer()});
    return route.fulfill({json:body});
  });
  return {images,errors};
}
for(const theme of ['light','dark']) {
  test(`module covers upload, reorder, persist, and remove in ${theme} mode`,async({page})=>{
    test.setTimeout(120_000);
    let saved={...addon,coverImages:[] as string[]};
    const {images,errors}=await mocks(page,()=>saved);
    let uploaded=0,failUpload=false;
    const writes:Record<string,unknown>[]=[];
    await page.route('**/api/dashboard/creator/module-covers',async route=>{
      if(failUpload)return route.fulfill({status:503,json:{error:'Please retry your cover upload.'}});
      const body=await new Response(new Uint8Array(route.request().postDataBuffer()!),{headers:{'Content-Type':route.request().headers()['content-type']}}).formData();
      const file=body.get('file') as File;
      expect(file.size).toBeLessThanOrEqual(2*1024*1024);
      const bytes=Buffer.from(await file.arrayBuffer());
      expect((await sharp(bytes).metadata()).format).toBe('webp');
      const path=paths[uploaded++];images.set(path,bytes);
      await new Promise(resolve=>setTimeout(resolve,150));
      return route.fulfill({status:201,json:{path,size:bytes.length}});
    });
    await page.route('**/api/dashboard/creator/modules',async route=>{
      if(route.request().method()==='POST') {
        const payload=route.request().postDataJSON();writes.push(payload);saved={...saved,...payload};return route.fulfill({json:{module:saved}});
      }
      return route.fulfill({json:{modules:[saved]}});
    });
    await page.route('**/api/dashboard/creator/modules/cover-module',async route=>{
      const payload=route.request().postDataJSON();writes.push(payload);saved={...saved,...payload};return route.fulfill({json:{module:saved}});
    });
    await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/dashboard/creator/modules/new');
    await expect(page.getByText('No images uploaded. The default module preview will be shown.')).toBeVisible();
    await page.getByLabel('Name',{exact:true}).fill('Cover module');
    await page.getByLabel('Description',{exact:true}).fill('Module with covers');
    await page.getByLabel('Module source code').fill('return { covers = true }');
    const noisy=await sharp(randomBytes(1500*1500*3),{raw:{width:1500,height:1500,channels:3}}).png().toBuffer();
    expect(noisy.length).toBeGreaterThan(2*1024*1024);
    await page.getByLabel('Upload cover images',{exact:true}).setInputFiles({name:'large.png',mimeType:'image/png',buffer:noisy});
    await expect(page.getByRole('status').filter({hasText:'Compressing and uploading'})).toBeVisible();
    await expect(page.getByRole('button',{name:'Save Draft',exact:true})).toBeDisabled();
    await expect(page.getByRole('img',{name:'Cover 1',exact:true})).toBeVisible();
    const small=await png();
    await page.getByLabel('Upload cover images',{exact:true}).setInputFiles(Array.from({length:3},(_,index)=>({name:`cover-${index}.png`,mimeType:'image/png',buffer:small})));
    await expect(page.getByRole('img',{name:'Cover 4',exact:true})).toBeVisible();
    await expect(page.getByRole('button',{name:'Choose cover images',exact:true})).toBeDisabled();
    await page.getByRole('button',{name:'Move cover 2 earlier',exact:true}).focus();await page.keyboard.press('Space');
    await expect(page.getByRole('img',{name:'Cover 1',exact:true})).toHaveAttribute('src',coverSource(paths[1]));
    await page.getByRole('button',{name:'Save Draft',exact:true}).click();
    await expect(page).toHaveURL(/\/creator\/modules\/cover-module\/edit$/);
    expect(writes[0].coverImages).toEqual([paths[1],paths[0],paths[2],paths[3]]);
    await page.reload();
    await expect(page.getByRole('img',{name:'Cover 1',exact:true})).toHaveAttribute('src',coverSource(paths[1]));
    await page.getByRole('button',{name:'Remove cover 1',exact:true}).click();
    const input=page.getByLabel('Upload cover images',{exact:true});
    await input.setInputFiles({name:'too-large.png',mimeType:'image/png',buffer:Buffer.alloc(9*1024*1024+1)});
    await expect(page.locator('[data-slot="status"][role="alert"]')).toContainText(/large|size|9 MB/i);
    expect(uploaded).toBe(4);
    failUpload=true;
    await input.setInputFiles({name:'retry.png',mimeType:'image/png',buffer:small});
    await expect(page.locator('[data-slot="status"][role="alert"]')).toContainText('Please retry your cover upload.');
    await expect(page.getByRole('img',{name:'Cover 3',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Save Draft',exact:true}).click();
    await expect.poll(()=>writes.length).toBe(2);
    expect(saved.coverImages).toEqual([paths[0],paths[2],paths[3]]);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-module-cover-editor-${test.info().project.name}.png`,fullPage:true});
    expect(errors).toEqual([]);
  });
  test(`marketplace cover and product gallery follow saved order in ${theme} mode`,async({page})=>{
    let saved={...addon,coverImages:[...paths]};
    const {errors}=await mocks(page,()=>saved);
    await page.addInitScript(value=>localStorage.setItem('rolink-theme',value),theme);
    await page.goto('/dashboard/marketplace');
    await expect(page.getByRole('img',{name:'Cover module cover',exact:true})).toHaveAttribute('src',coverSource(paths[0]));
    await page.getByRole('link',{name:'Cover module',exact:true}).click();
    await expect(page.getByRole('img',{name:'Cover module cover 1',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Show cover 4',exact:true}).click();
    await expect(page.getByRole('img',{name:'Cover module cover 4',exact:true})).toHaveAttribute('src',coverSource(paths[3]));
    await expect(page.getByRole('button',{name:'Show cover 4',exact:true})).toHaveAttribute('aria-pressed','true');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`/workspace/artifacts/dice-${theme}-module-cover-gallery-${test.info().project.name}.png`,fullPage:true});
    saved={...saved,coverImages:[]};await page.reload();
    await expect(page.getByRole('region',{name:'Module preview',exact:true})).toContainText('No preview image available');
    await expect(page.getByRole('button',{name:'Show cover 1',exact:true})).toHaveCount(0);
    await page.goto('/dashboard/marketplace/create');
    await expect(page.getByRole('button',{name:'Choose cover images',exact:true})).toBeVisible();
    expect(errors).toEqual([]);
  });
}

test('Dice cover drag handles support keyboard sorting',async({page})=>{
  const saved={...addon,coverImages:[...paths]};
  const {errors}=await mocks(page,()=>saved);
  await page.goto('/dashboard/creator/modules/cover-module/edit');
  const handle=page.getByRole('button',{name:'Drag cover 4 to reorder',exact:true});
  await handle.scrollIntoViewIfNeeded();
  await handle.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-slot="sortable-item"][data-dragging]')).toHaveCount(1);
  await page.keyboard.press((page.viewportSize()?.width||0)<640?'ArrowUp':'ArrowLeft');
  await expect(page.locator('[id^="DndLiveRegion"]')).toContainText('position 3 of 4');
  await page.keyboard.press('Space');
  await expect(page.getByRole('img',{name:'Cover 3',exact:true})).toHaveAttribute('src',coverSource(paths[3]));
  await expect(page.getByRole('img',{name:'Cover 4',exact:true})).toHaveAttribute('src',coverSource(paths[2]));
  expect(errors).toEqual([]);
});
