const test = require("node:test");
const assert = require("node:assert/strict");
const { NextRequest } = require("next/server");
const { GET, POST } = require("../.next/server/app/api/route.js").routeModule
  .userland;
const session = "a".repeat(64),
  other = "b".repeat(64);
const headers = {
  "Content-Type": "application/json",
  "x-podwise-session": session,
};
const source =
  "Active recall means retrieving information from memory before checking your notes. Spaced practice means returning to material across separate sessions. Repeat small, manageable sessions and correct mistakes.";
process.env.SUPABASE_URL = "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-server-key";
process.env.GEMINI_API_KEY = "test-gemini-key";
let rows = [];
let limit = false;
let started = 0;
let workerRequests = [];
const actualFetch = global.fetch;
global.fetch = async (url, init = {}) => {
  const u = new URL(url);
  let data;
  if (u.pathname.endsWith("/rpc/podwise_reserve")) data = !limit;
  else if (u.pathname.includes("/functions/v1/")) {
    started++;
    workerRequests.push(JSON.parse(init.body));
    data = { accepted: true };
  } else if (u.pathname.includes("/storage/v1/object/upload/sign/"))
    data = { url: "/object/upload/sign/podwise-audio/test?token=test-token" };
  else if (u.pathname.includes("/storage/v1/object/sign/")) data = {signedURL:"/object/sign/podwise-audio/test?token=test-token"};
  else if (u.pathname.endsWith("/storage/v1/object/podwise-audio") && init.method === "DELETE") data = [];
  else if (u.pathname.endsWith("/podwise_jobs")) {
    const body = init.body ? JSON.parse(init.body) : null;
    if (init.method === "POST") {
      rows.push({
        ...body,
        created_at: new Date().toISOString(),
        attempts: 0,
        revisions: [],
      });
      data = [rows.at(-1)];
    } else {
      data = rows.filter(
        (r) =>
          (!u.searchParams.get("id") ||
            "eq." + r.id === u.searchParams.get("id")) &&
          (!u.searchParams.get("owner_hash") ||
            "eq." + r.owner_hash === u.searchParams.get("owner_hash")) &&
          (!u.searchParams.get("status") || "eq." + r.status === u.searchParams.get("status")),
      );
      if(init.method === "PATCH") for(const row of data) Object.assign(row,body);
      if(init.method === "DELETE") rows=rows.filter(row=>!data.includes(row));
    }
  } else throw Error("Unexpected mock URL " + u.pathname);
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json" },
  });
};
const post = (b) =>
  POST(
    new NextRequest("http://localhost:3000/api", {
      method: "POST",
      headers,
      body: JSON.stringify(b),
    }),
  );
test("health exposes readiness without secret values", async () => {
  const r = await GET(new NextRequest("http://localhost:3000/api?health=1"));
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.equal(d.ready, true);
  assert.ok(!JSON.stringify(d).includes("test-server-key"));
});
test("requires a valid anonymous capability", async () => {
  const r = await GET(new NextRequest("http://localhost:3000/api"));
  assert.equal(r.status, 400);
});
test("rejects cross-site mutations", async () => {
  const r = await POST(
    new NextRequest("http://localhost:3000/api", {
      method: "POST",
      headers: { ...headers, origin: "https://attacker.example" },
      body: "{}",
    }),
  );
  assert.equal(r.status, 403);
});
test("invalid transcript and audio metadata never start a worker", async () => {
  const before = started;
  assert.equal(
    (
      await post({
        action: "create",
        kind: "transcript",
        title: "Test",
        permission: true,
        transcript: "short",
      })
    ).status,
    400,
  );
  assert.equal(
    (
      await post({
        action: "create",
        kind: "audio",
        title: "Test",
        permission: true,
        mime: "application/exe",
        size: 100,
        duration: 30,
      })
    ).status,
    400,
  );
  assert.equal(started, before);
});
test("creates a transcript job and starts analysis with the source saved", async () => {
  const r = await post({
    action: "create",
    kind: "transcript",
    title: "Learning",
    permission: true,
    transcript: source,
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.match(d.id, /^[0-9a-f-]{36}$/);
  assert.equal(rows[0].transcript, source);
  assert.equal(started, 1);
});
test("another browser capability cannot retrieve the job", async () => {
  const r = await GET(
    new NextRequest("http://localhost:3000/api?id=" + rows[0].id, {
      headers: { "x-podwise-session": other },
    }),
  );
  assert.equal(r.status, 404);
});
test("quota failure does not create another job or call AI", async () => {
  limit = true;
  const n = rows.length;
  const r = await post({
    action: "create",
    kind: "transcript",
    title: "Learning",
    permission: true,
    transcript: source,
  });
  assert.equal(r.status, 429);
  assert.equal(rows.length, n);
  assert.equal(started, 1);
  limit = false;
});
test("audio uses a signed direct-storage upload URL", async () => {
  const r = await post({
    action: "create",
    kind: "audio",
    title: "Recording",
    permission: true,
    mime: "audio/mpeg",
    size: 1200,
    duration: 30,
  });
  assert.equal(r.status, 200);
  const d = await r.json();
  assert.match(
    d.uploadUrl,
    /^https:\/\/example.supabase.co\/storage\/v1\/object\/upload\/sign\//,
  );
  assert.equal(rows.at(-1).status, "awaiting_upload");
});
test("retry reuses saved transcript and reserves a new attempt",async()=>{
 const row=rows[0];row.status="failed";row.error="Temporary provider failure";const before=started;
 const r=await post({action:"retry",id:row.id});assert.equal(r.status,200);assert.equal(row.attempts,1);assert.equal(row.transcript,source);assert.equal(started,before+1);assert.equal(workerRequests.at(-1).stage,"analyze");
});
test("retry refuses exhausted attempts without starting a worker",async()=>{
 const row=rows[0];row.status="failed";row.attempts=3;const before=started;
 assert.equal((await post({action:"retry",id:row.id})).status,400);assert.equal(started,before);
});
test("revision targets only a completed episode and preserves saved source",async()=>{
 const row=rows[0];row.status="completed";const before=started;
 assert.equal((await post({action:"revise",id:row.id,target:"quiz",instruction:"Make it more challenging"})).status,200);
 assert.equal(workerRequests.at(-1).target,"quiz");assert.equal(workerRequests.at(-1).stage,"revise");assert.equal(row.transcript,source);assert.equal(started,before+1);
});
test("signed audio access stays server mediated",async()=>{
 const row=rows.at(-1);const r=await post({action:"audio",id:row.id});assert.equal(r.status,200);assert.match((await r.json()).url,/storage\/v1\/object\/sign\//);
});
test("another browser cannot delete an episode",async()=>{
 const r=await POST(new NextRequest("http://localhost:3000/api",{method:"POST",headers:{...headers,"x-podwise-session":other},body:JSON.stringify({action:"delete",id:rows[0].id})}));assert.equal(r.status,404);
});
test("owner can delete an episode and revoke future reads",async()=>{
 const id=rows[0].id;assert.equal((await post({action:"delete",id})).status,200);
 assert.equal((await GET(new NextRequest("http://localhost:3000/api?id="+id,{headers}))).status,404);
});
test.after(() => {
  global.fetch = actualFetch;
});
