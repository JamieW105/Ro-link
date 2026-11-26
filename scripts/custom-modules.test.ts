import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ModuleKind, transpileModule } from "typescript";
import { NextResponse } from "next/server";
import * as modules from "../lib/modules";

// Exercise the route with an isolated database adapter: no production writes.
function handler(allowed = true) {
  let payload: Record<string, unknown> = {};
  const query = {
    select: () => query,
    eq: () => query,
    neq: () => query,
    insert: (row: Record<string, unknown>) => {
      payload = row;
      return query;
    },
    update: (row: Record<string, unknown>) => {
      payload = row;
      return query;
    },
    maybeSingle: async () => ({ data: null, error: null }),
    single: async () => ({
      data: { id: "custom-1", slug: "my-module", ...payload },
      error: null,
    }),
    then: (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ count: 0, error: null }).then(resolve),
  };
  const dependencies: Record<string, unknown> = {
    "next/server": { NextResponse },
    "next-auth": {
      getServerSession: async () => ({ user: { id: "creator-1" } }),
    },
    "@/app/api/auth/[...nextauth]/route": { authOptions: {} },
    "@/lib/gameAdmin": {
      resolveDashboardUserPermissions: async () => ({
        is_admin: allowed,
        can_manage_settings: false,
      }),
    },
    "@/lib/modules": modules,
    "@/lib/moduleCreatorVerification": {},
    "@/lib/moduleOfficial": {},
    "@/lib/supabase": { supabase: { from: () => query } },
  };
  const source = readFileSync(
    new URL("../app/api/dashboard/modules/route.ts", import.meta.url),
    "utf8",
  );
  const compiled = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS },
  }).outputText;
  const exports = {} as { POST: (req: Request) => Promise<Response> };
  new Function("require", "exports", compiled)((id: string) => {
    assert.ok(id in dependencies, `Unexpected dependency: ${id}`);
    return dependencies[id];
  }, exports);
  return exports.POST;
}

for (const action of ["custom-create", "custom-reupload"]) {
  test(`${action} returns the saved normalized module without source code`, async () => {
    const response = await handler()(
      new Request("https://example.test/api/dashboard/modules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          serverId: "server-1",
          moduleId: "custom-1",
          name: "My module",
          sourceCode: "return {}",
        }),
      }),
    );
    assert.equal(response.status, action === "custom-create" ? 201 : 200);
    const body = await response.json();
    assert.equal(body.success, true);
    assert.equal(body.module.id, "custom-1");
    assert.equal(body.module.name, "My module");
    assert.equal(body.module.serverId, "server-1");
    assert.equal(body.module.isCustom, true);
    assert.equal(body.module.sourceCode, undefined);
  });
}
test("custom module changes still require settings permission", async () => {
  const response = await handler(false)(
    new Request("https://example.test/api/dashboard/modules", {
      method: "POST",
      body: JSON.stringify({ action: "custom-create", serverId: "server-1" }),
    }),
  );
  assert.equal(response.status, 403);
});
