import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import sharp from 'sharp';
import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createModuleCoverReadHandler, createModuleCoverUploadHandler, encodeModuleCover, validateModuleCoverSelection } from '../lib/moduleCoverServer';
import { isModuleCoverPath, parseModuleCoverPaths, MAX_COVER_SOURCE_BYTES, MAX_COVER_STORED_BYTES } from '../lib/moduleCovers';
import { sanitizeAddonModuleInput, normalizeAddonModule } from '../lib/modules';
const db = new PGlite();
const owner='111111111111111111';
const path=`${owner}/11111111-1111-4111-8111-111111111111.webp`;
let identity: {user:{id:string};error?:string} | null;
let blocked=false, configured=true, recordFails=false, storageFails=false;
const files=new Map<string,Buffer>();
function adapter() {
    return {
        from(table:string) {
            if(table==='addon_module_creator_blocks') {
                const builder={select:()=>builder,eq:()=>builder,maybeSingle:async()=>({data:blocked?{discord_id:owner}:null,error:null})};return builder;
            }
            if(table==='addon_modules') {
                let covers:string[]=[];
                const builder={select:()=>builder,contains:(_key:string,value:string[])=>{covers=value;return builder;},eq:()=>builder,limit:async()=>({data:(await db.query("SELECT id FROM public.addon_modules WHERE status='PUBLISHED' AND cover_images @> $1::text[] LIMIT 1",[covers])).rows,error:null})};return builder;
            }
            assert.equal(table,'addon_module_cover_uploads');
            let selectedOwner='',selectedPaths:string[]=[];
            const builder={
                select:()=>builder,
                eq:(_key:string,value:string)=>{selectedOwner=value;return builder;},
                in:(_key:string,value:string[])=>{selectedPaths=value;return builder;},
                insert:async(row:{path:string;owner_discord_id:string;size_bytes:number})=>{
                    if(recordFails)return {error:{code:'fixture-record-failure'}};
                    await db.query('INSERT INTO public.addon_module_cover_uploads(path,owner_discord_id,size_bytes) VALUES($1,$2,$3)',[row.path,row.owner_discord_id,row.size_bytes]);return {error:null};
                },
                then:(resolve:(value:unknown)=>unknown,reject:(error:unknown)=>unknown)=>db.query('SELECT path FROM public.addon_module_cover_uploads WHERE owner_discord_id=$1 AND path=ANY($2::text[])',[selectedOwner,selectedPaths]).then(result=>({data:result.rows,error:null})).then(resolve,reject),
            };return builder;
        },
        storage:{from:(bucket:string)=>{assert.equal(bucket,'module-covers');return {
            upload:async(key:string,bytes:Buffer,options:{contentType:string;upsert:boolean})=>{assert.equal(options.contentType,'image/webp');assert.equal(options.upsert,false);if(storageFails)return {error:{code:'fixture-storage-failure'}};files.set(key,bytes);return {error:null};},
            download:async(key:string)=>({data:files.has(key)?new Blob([new Uint8Array(files.get(key)!)],{type:'image/webp'}):null,error:null}),
            remove:async(keys:string[])=>{keys.forEach(key=>files.delete(key));return {error:null};},
        };}},
    } as unknown as SupabaseClient;
}
const upload=createModuleCoverUploadHandler({session:async()=>identity,db:adapter,configured:()=>configured});
async function image(){return sharp({create:{width:128,height:96,channels:3,background:'#059669'}}).png().toBuffer();}
function request(bytes:Buffer, type='image/png') {const form=new FormData();form.append('file',new File([new Uint8Array(bytes)],'image.png',{type}));return new Request('https://example.test/upload',{method:'POST',body:form});}
before(async()=>{
    await db.exec("CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA storage; CREATE TABLE storage.buckets(id text PRIMARY KEY,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); CREATE TABLE public.addon_modules(id uuid PRIMARY KEY,status text);");
    await db.exec(await readFile('supabase/migrations/20261025211211_module_cover_images.sql','utf8'));
});
after(()=>db.close());
beforeEach(async()=>{identity={user:{id:owner}};blocked=false;configured=true;recordFails=false;storageFails=false;files.clear();await db.exec('TRUNCATE public.addon_module_cover_uploads; TRUNCATE public.addon_modules;');});
test('only active, authenticated creators can upload',async()=>{
    identity=null;assert.equal((await upload(request(await image()))).status,401);
    identity={user:{id:owner},error:'expired'};assert.equal((await upload(request(await image()))).status,401);
    identity={user:{id:owner}};configured=false;assert.equal((await upload(request(await image()))).status,503);
    configured=true;blocked=true;assert.equal((await upload(request(await image()))).status,403);assert.equal(files.size,0);
});
test('server validates image bytes and source size rather than trusting names and MIME types',async()=>{
    assert.equal((await upload(request(Buffer.from('<svg onload="alert(1)"></svg>')))).status,400);
    assert.equal((await upload(request(Buffer.alloc(MAX_COVER_SOURCE_BYTES+1)))).status,413);
    const exact=Buffer.concat([await image(),Buffer.alloc(MAX_COVER_SOURCE_BYTES-(await image()).length)]);
    assert.equal((await upload(request(exact))).status,201);
    const tooManyPixels=await sharp({create:{width:7000,height:6000,channels:3,background:'white'}}).png().toBuffer();
    await assert.rejects(encodeModuleCover(tooManyPixels));
});
test('real noisy images are compressed to WebP below 2 MB with bounded dimensions',async()=>{
    const png=await sharp(randomBytes(1600*1600*3),{raw:{width:1600,height:1600,channels:3}}).png().toBuffer();
    assert.ok(png.length>MAX_COVER_STORED_BYTES && png.length<MAX_COVER_SOURCE_BYTES);
    const response=await upload(request(png));assert.equal(response.status,201);
    const result=await response.json();assert.ok(result.path.startsWith(`${owner}/`));assert.ok(isModuleCoverPath(result.path));
    const output=files.get(result.path)!;assert.ok(output.length<=MAX_COVER_STORED_BYTES);assert.equal(result.size,output.length);
    const metadata=await sharp(output).metadata();assert.equal(metadata.format,'webp');assert.ok(metadata.width!<=2048);assert.ok(metadata.height!<=2048);
    assert.equal(await validateModuleCoverSelection(adapter(),[result.path],owner),true);
});
test('selection rejects forged, duplicate, foreign, and more than four cover paths',async()=>{
    await db.query('INSERT INTO public.addon_module_cover_uploads(path,owner_discord_id,size_bytes) VALUES($1,$2,100)',[path,owner]);
    assert.equal(await validateModuleCoverSelection(adapter(),[path],owner),true);
    assert.equal(await validateModuleCoverSelection(adapter(),[path],'other'),false);
    assert.equal(await validateModuleCoverSelection(adapter(),[path.replace('11111111-','22222222-')],owner),false);
    assert.equal(parseModuleCoverPaths([path,path]),null);assert.equal(parseModuleCoverPaths(Array(5).fill(path)),null);
    assert.equal(parseModuleCoverPaths(['https://example.test/cover.png']),null);assert.equal(parseModuleCoverPaths(['../secret']),null);
    assert.equal(await validateModuleCoverSelection(adapter(),[],owner),true);
    const sanitized=sanitizeAddonModuleInput({coverImages:[path]},true);assert.deepEqual(sanitized,{input:{coverImages:[path]}});
    assert.ok('errors' in sanitizeAddonModuleInput({coverImages:[path,path]},true));
    assert.deepEqual(normalizeAddonModule({cover_images:[path]})!.coverImages,[path]);assert.deepEqual(normalizeAddonModule({})!.coverImages,[]);
});
test('failed persistence removes an uploaded object and storage failures do not create records',async()=>{
    recordFails=true;assert.equal((await upload(request(await image()))).status,503);assert.equal(files.size,0);
    recordFails=false;storageFails=true;assert.equal((await upload(request(await image()))).status,503);
    assert.equal((await db.query('SELECT * FROM public.addon_module_cover_uploads')).rows.length,0);
});
test('schema enforces four covers, a private 2 MB WebP bucket, and service-only metadata',async()=>{
    await assert.rejects(db.query('INSERT INTO public.addon_modules(id,cover_images) VALUES(gen_random_uuid(),$1)',[Array(5).fill(path)]));
    await assert.rejects(db.query('INSERT INTO public.addon_modules(id,cover_images) VALUES(gen_random_uuid(),ARRAY[NULL]::text[])'));
    const bucket=await db.query<{public:boolean;file_size_limit:number;allowed_mime_types:string[]}>('SELECT * FROM storage.buckets');
    assert.equal(bucket.rows[0].public,false);assert.equal(Number(bucket.rows[0].file_size_limit),MAX_COVER_STORED_BYTES);assert.deepEqual(bucket.rows[0].allowed_mime_types,['image/webp']);
    for(const role of ['anon','authenticated']) {await db.exec(`SET ROLE ${role}`);try{await assert.rejects(db.query('SELECT * FROM public.addon_module_cover_uploads'));}finally{await db.exec('RESET ROLE');}}
});

test('private drafts are visible to their creator, while published covers are visible to marketplace users',async()=>{
    const read=createModuleCoverReadHandler({session:async()=>identity,db:adapter,configured:()=>configured});
    files.set(path,await encodeModuleCover(await image()));
    assert.equal((await read(path)).status,200);
    assert.equal((await read(path)).headers.get('cache-control'),'private, no-store');
    identity={user:{id:'another-user'}};
    assert.equal((await read(path)).status,404);
    await db.query("INSERT INTO public.addon_modules(id,status,cover_images) VALUES(gen_random_uuid(),'DRAFT',$1)",[[path]]);
    assert.equal((await read(path)).status,404);
    await db.exec("UPDATE public.addon_modules SET status='PUBLISHED'");
    const response=await read(path);assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'image/webp');
    assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format,'webp');
    assert.equal((await read('../private.webp')).status,404);
    identity=null;assert.equal((await read(path)).status,401);
});
