import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createModuleReviewHandlers, parseModuleReview, type ReviewSession } from '../lib/moduleReviewApi';

const db = new PGlite();
const moduleId = '11111111-1111-4111-8111-111111111111';
const otherModule = '22222222-2222-4222-8222-222222222222';
let session: ReviewSession | null;
let managed = false;
let visible = ['server-1'];
let configured = true;
function databaseAdapter() {
    return {
        from(table: string) {
            assert.ok(['addon_modules', 'addon_module_reviews', 'server_addon_modules'].includes(table));
            const filters: Array<[string, unknown]> = [];
            let inValues: string[] | null = null;
            let deleting = false;
            const execute = async () => {
                const values: unknown[] = [];
                const where = filters.map(([key,value]) => { assert.ok(['id','module_id','reviewer_discord_id'].includes(key)); values.push(value); return `${key}=$${values.length}`; });
                if (inValues) { values.push(inValues); where.push(`server_id = ANY($${values.length}::text[])`); }
                const result = await db.query(`${deleting?'DELETE FROM':'SELECT * FROM'} public.${table}${where.length?' WHERE '+where.join(' AND '):''}`,values);
                return {data:result.rows,error:null};
            };
            const builder = {
                select: () => builder,
                eq: (key:string,value:unknown) => { filters.push([key,value]); return builder; },
                in: (_key:string, values:string[]) => { inValues=values; return builder; },
                delete: () => { deleting=true; return builder; },
                maybeSingle: async () => { const result=await execute(); return {...result,data:result.data[0]||null}; },
                upsert: async (row:Record<string,unknown>) => {
                    await db.query(`INSERT INTO public.addon_module_reviews(module_id,reviewer_discord_id,reviewer_name,reviewer_avatar_url,rating,comment,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7)
                        ON CONFLICT(module_id,reviewer_discord_id) DO UPDATE SET reviewer_name=excluded.reviewer_name,reviewer_avatar_url=excluded.reviewer_avatar_url,rating=excluded.rating,comment=excluded.comment,updated_at=excluded.updated_at`,[row.module_id,row.reviewer_discord_id,row.reviewer_name,row.reviewer_avatar_url,row.rating,row.comment,row.updated_at]);
                    return {error:null};
                },
                then: (resolve:(value:unknown)=>unknown,reject:(reason:unknown)=>unknown) => execute().then(resolve,reject),
            };
            return builder;
        },
        rpc: async (_name:string,args:{p_module:string;p_discord:string;p_offset:number}) => {
            const result=await db.query<{summary:unknown}>('SELECT public.module_review_summary($1,$2,$3) AS summary',[args.p_module,args.p_discord,args.p_offset]);
            return {data:result.rows[0].summary,error:null};
        },
    } as unknown as SupabaseClient;
}
const handlers=createModuleReviewHandlers({session:async()=>session,db:databaseAdapter,configured:()=>configured,visibleGuildIds:async()=>visible,canManage:async()=>managed});
const request=(method='GET',body?:unknown,offset=0)=>new Request(`https://example.test/api/reviews?offset=${offset}`,{method,...(body===undefined?{}:{body:JSON.stringify(body),headers:{'Content-Type':'application/json'}})});
before(async()=>{
    await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
        CREATE TABLE public.addon_modules(id uuid PRIMARY KEY,status text,author_discord_id text);
        CREATE TABLE public.server_addon_modules(server_id text,module_id uuid);`);
    const files=(await readdir('supabase/migrations')).filter(name=>name.endsWith('_module_reviews.sql')).sort();
    for (const file of files) await db.exec(await readFile(`supabase/migrations/${file}`,'utf8'));
});
after(()=>db.close());
beforeEach(async()=>{
    session={user:{id:'111111111111111111',name:'Fixture reviewer',image:'https://cdn.discordapp.com/avatars/111111111111111111/avatar.png'},accessToken:'fixture-token'};
    managed=false;visible=['server-1'];configured=true;
    await db.exec('TRUNCATE public.addon_modules CASCADE; TRUNCATE public.server_addon_modules;');
    await db.query("INSERT INTO public.addon_modules VALUES($1,'PUBLISHED','creator'),($2,'DRAFT','creator')",[moduleId,otherModule]);
    await db.query('INSERT INTO public.server_addon_modules VALUES($1,$2)',['server-1',moduleId]);
});
test('auth, module visibility, malformed input, and configuration fail closed',async()=>{
    session=null;assert.equal((await handlers.GET(request(),moduleId)).status,401);
    session={user:{id:'111111111111111111'},error:'blocked'};assert.equal((await handlers.POST(request('POST',{rating:5,comment:'Review'}),moduleId)).status,401);
    session={user:{id:'111111111111111111'}};
    assert.equal((await handlers.GET(request(),'bad-module')).status,400);
    for(const method of ['GET','POST','DELETE'] as const) assert.equal((await handlers[method](request(method,method==='GET'?undefined:{rating:5,comment:'Hidden'}),otherModule)).status,404);
    for(const body of [{rating:0,comment:'a'},{rating:6,comment:'a'},{rating:2.5,comment:'a'},{rating:'5',comment:'a'},{rating:5,comment:'  '},{rating:5,comment:'x'.repeat(2001)}]) {
        assert.equal(parseModuleReview(body),null);
        assert.equal((await handlers.POST(request('POST',body),moduleId)).status,400);
    }
    assert.equal((await handlers.GET(request('GET',undefined,-1),moduleId)).status,400);
    configured=false;assert.equal((await handlers.GET(request(),moduleId)).status,503);
});
test('only creators or managers of visible installed servers can publish reviews',async()=>{
    assert.equal((await handlers.POST(request('POST',{rating:5,comment:'Test'}),moduleId)).status,403);
    managed=true;visible=['other-server'];assert.equal((await handlers.POST(request('POST',{rating:5,comment:'Test'}),moduleId)).status,403);
    visible=['server-1'];assert.equal((await handlers.POST(request('POST',{rating:5,comment:'Test'}),moduleId)).status,200);
    const summary=await (await handlers.GET(request(),moduleId)).json();assert.equal(summary.canReview,true);assert.equal(summary.ownModule,false);
    session={user:{id:'creator',name:'Creator'}};managed=false;visible=[];
    assert.equal((await handlers.POST(request('POST',{rating:4,comment:'Own draft'}),otherModule)).status,200);
    const own=await (await handlers.GET(request(),otherModule)).json();assert.equal(own.ownModule,true);assert.equal(own.canReview,true);
});
test('upserts are tied to the session, preserve creation time, and update real averages',async()=>{
    managed=true;
    const forged={rating:4,comment:' First review ',author_discord_id:'victim',module_id:otherModule,reviewer_name:'Forged'};
    assert.equal((await handlers.POST(request('POST',forged),moduleId)).status,200);
    const first=await (await handlers.GET(request(),moduleId)).json();
    assert.equal(first.total,1);assert.equal(first.average,4);assert.equal(first.ownReview.comment,'First review');assert.equal(first.reviews[0].name,'Fixture reviewer');assert.match(first.reviews[0].avatarUrl,/^\/api\/discord\/media/);
    const created=first.reviews[0].createdAt;
    await handlers.POST(request('POST',{rating:2,comment:'Updated review'}),moduleId);
    const updated=await (await handlers.GET(request(),moduleId)).json();assert.equal(updated.total,1);assert.equal(updated.average,2);assert.equal(updated.reviews[0].createdAt,created);
    session={...session!,user:{id:'222222222222222222',name:'Second reviewer'}};
    await handlers.POST(request('POST',{rating:5,comment:'Second rating'}),moduleId);
    const both=await (await handlers.GET(request(),moduleId)).json();assert.equal(both.total,2);assert.equal(both.average,3.5);assert.equal(both.ownReview.comment,'Second rating');assert.equal(JSON.stringify(both).includes('author_discord_id'),false);
});
test('pagination and averages are scoped to the module, with own review outside the page',async()=>{
    for(let index=0;index<13;index++)await db.query("INSERT INTO public.addon_module_reviews(module_id,reviewer_discord_id,reviewer_name,rating,comment,created_at) VALUES($1,$2,'Reviewer',5,'Review',$3)",[moduleId,index===0?session!.user!.id:String(index),new Date(2026,0,index+1).toISOString()]);
    await db.query("INSERT INTO public.addon_module_reviews(module_id,reviewer_discord_id,reviewer_name,rating,comment) VALUES($1,'other','Other',1,'Other module')",[otherModule]);
    const first=await (await handlers.GET(request(),moduleId)).json();assert.equal(first.total,13);assert.equal(first.average,5);assert.equal(first.reviews.length,10);assert.equal(first.hasMore,true);assert.ok(first.ownReview);assert.equal(first.reviews.some((row:{isOwn:boolean})=>row.isOwn),false);
    const second=await (await handlers.GET(request('GET',undefined,10),moduleId)).json();assert.equal(second.reviews.length,3);assert.equal(second.hasMore,false);
});
test('reviewers can withdraw their own review after losing installer access',async()=>{
    managed=true;await handlers.POST(request('POST',{rating:5,comment:'Own review'}),moduleId);
    await db.query("INSERT INTO public.addon_module_reviews(module_id,reviewer_discord_id,reviewer_name,rating,comment) VALUES($1,'someone-else','Other',4,'Keep this review')",[moduleId]);
    managed=false;
    assert.equal((await handlers.POST(request('POST',{rating:1,comment:'Not allowed'}),moduleId)).status,403);
    assert.equal((await handlers.DELETE(request('DELETE',{author_discord_id:'someone-else'}),moduleId)).status,200);
    const data=await (await handlers.GET(request(),moduleId)).json();assert.equal(data.total,1);assert.equal(data.ownReview,null);assert.equal(data.reviews[0].comment,'Keep this review');
});
test('database constraints and grants protect the review table and RPC',async()=>{
    await assert.rejects(db.query("INSERT INTO public.addon_module_reviews(module_id,reviewer_discord_id,reviewer_name,rating,comment) VALUES($1,'bad','Name',6,'Invalid')",[moduleId]));
    await assert.rejects(db.query("INSERT INTO public.addon_module_reviews(module_id,reviewer_discord_id,reviewer_name,rating,comment) VALUES($1,'bad','Name',5,'  ')",[moduleId]));
    for(const role of ['anon','authenticated']){
        await db.exec(`SET ROLE ${role}`);
        try{await assert.rejects(db.query('SELECT * FROM public.addon_module_reviews'));await assert.rejects(db.query('SELECT public.module_review_summary($1,$2,0)',[moduleId,'someone']));}finally{await db.exec('RESET ROLE');}
    }
    const security=await db.query<{rls:boolean;definer:boolean}>("SELECT c.relrowsecurity AS rls,p.prosecdef AS definer FROM pg_class c CROSS JOIN pg_proc p WHERE c.relname='addon_module_reviews' AND p.proname='module_review_summary'");
    assert.equal(security.rows[0].rls,true);assert.equal(security.rows[0].definer,false);
    managed=true;await handlers.POST(request('POST',{rating:5,comment:'Cascade'}),moduleId);
    await db.query('DELETE FROM public.addon_modules WHERE id=$1',[moduleId]);
    assert.equal((await db.query('SELECT * FROM public.addon_module_reviews')).rows.length,0);
});

test('missing database setup returns an actionable error without leaking query details', async () => {
    const broken = createModuleReviewHandlers({session:async()=>session,configured:()=>true,visibleGuildIds:async()=>[],canManage:async()=>false,
        db:()=>({...databaseAdapter(),rpc:async()=>({data:null,error:{code:'PGRST202',message:'private query detail'}})}) as unknown as SupabaseClient});
    const response = await broken.GET(request(),moduleId);
    assert.equal(response.status,503);
    const body=await response.json();
    assert.equal(body.code,'REVIEWS_SCHEMA_MISSING');
    assert.match(body.error,/reconcile_module_reviews/);
    assert.equal(JSON.stringify(body).includes('private query detail'),false);
});
test('repair preserves existing reviews and owner replies across both identity schemas', async () => {
    const migration=await readFile('supabase/migrations/20261025204626_reconcile_module_reviews.sql','utf8');
    await db.exec("ALTER TABLE public.addon_module_reviews ADD COLUMN owner_reply text; ALTER TABLE public.addon_module_reviews RENAME COLUMN reviewer_discord_id TO author_discord_id;");
    await db.query("INSERT INTO public.addon_module_reviews(module_id,author_discord_id,reviewer_name,rating,comment,owner_reply) VALUES($1,'existing','Existing',4,'Keep me','Keep reply')",[moduleId]);
    await db.exec(migration);
    await db.exec(migration);
    const rows=await db.query<{reviewer_discord_id:string;owner_reply:string}>('SELECT reviewer_discord_id,owner_reply FROM public.addon_module_reviews');
    assert.equal(rows.rows[0].reviewer_discord_id,'existing');
    assert.equal(rows.rows[0].owner_reply,'Keep reply');
    assert.equal((await (await handlers.GET(request(),moduleId)).json()).total,1);
});
