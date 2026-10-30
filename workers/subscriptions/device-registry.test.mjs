import test from "node:test";
import assert from "node:assert/strict";
import { authenticate, registerUserDevice, listUserDevices, revokeUserDevice } from "./src/index.mjs";

async function sha256Hex(value) {
  const digest=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
}

function makeEnv() {
  const state = { devices: new Map(), token: null, revokedTokens: 0 };
  const DB = {
    prepare(sql) {
      return { bind(...args) {
        return {
          async first() {
            if (sql.includes("RETURNING request_count")) return { request_count: 1 };
            if (sql.includes("SELECT user_id, revoked_at FROM user_devices")) {
              const row = state.devices.get(args[0]);
              return row ? { user_id: row.user_id, revoked_at: row.revoked_at } : null;
            }
            if (sql.includes("SELECT user_id, expires_at, revoked_at, device_id_hash FROM api_tokens")) {
              return state.token && state.token.token_hash === args[0] ? state.token : null;
            }
            if (sql.includes("SELECT user_id, revoked_at FROM user_devices")) {
              const row = state.devices.get(args[0]);
              return row ? { user_id: row.user_id, revoked_at: row.revoked_at } : null;
            }
            throw new Error("Unexpected first SQL: " + sql);
          },
          async all() {
            if (sql.includes("FROM user_devices WHERE user_id")) {
              return { results: [...state.devices.values()].filter(x => x.user_id === args[0]) };
            }
            throw new Error("Unexpected all SQL: " + sql);
          },
          async run() {
            if (sql.includes("INSERT INTO user_devices")) {
              const [hash,userId,label,firstSeen,lastSeen,created,updated] = args;
              if (!state.devices.has(hash)) state.devices.set(hash,{device_id_hash:hash,user_id:userId,label,first_seen_at:firstSeen,last_seen_at:lastSeen,revoked_at:null,created_at:created,updated_at:updated});
              else Object.assign(state.devices.get(hash),{label,last_seen_at:lastSeen,updated_at:updated});
              return { meta:{changes:1} };
            }
            if (sql.includes("UPDATE api_tokens SET device_id_hash")) {
              state.token.device_id_hash=args[0];
              return { meta:{changes:1} };
            }
            if (sql.includes("UPDATE user_devices SET revoked_at")) {
              const row=state.devices.get(args[2]);
              if(row && row.user_id===args[3] && !row.revoked_at){row.revoked_at=args[0];row.updated_at=args[1];return {meta:{changes:1}};}
              return {meta:{changes:0}};
            }
            if (sql.includes("UPDATE api_tokens SET revoked_at")) {
              state.revokedTokens++;
              if(state.token)state.token.revoked_at=args[0];
              return {meta:{changes:1}};
            }
            if (sql.includes("UPDATE api_tokens SET last_used_at")) return {meta:{changes:1}};
            throw new Error("Unexpected run SQL: " + sql);
          }
        };
      }};
    }
  };
  return { DB, state };
}

test("device registration binds current bearer token to account device hash", async () => {
  const env=makeEnv();
  env.state.token={token_hash:await sha256Hex("a".repeat(64)),user_id:"user-1",expires_at:Math.floor(Date.now()/1000)+3600,revoked_at:null,device_id_hash:null};
  const response=await registerUserDevice(new Request("https://api.example/api/devices/register",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({deviceId:"0123456789abcdef0123456789abcdef",label:"Android"})}),env,{userId:"user-1",tokenHash:env.state.token.token_hash});
  assert.equal(response.status,200);
  const data=await response.json();
  assert.equal(data.ok,true);
  assert.match(env.state.token.device_id_hash,/^[a-f0-9]{64}$/);
  assert.equal(env.state.devices.size,1);
});

test("revoked device invalidates its bound bearer token", async () => {
  const env=makeEnv();
  const hash="a".repeat(64);
  env.state.devices.set(hash,{device_id_hash:hash,user_id:"user-1",label:"Android",first_seen_at:1,last_seen_at:1,revoked_at:null});
  env.state.token={token_hash:await sha256Hex("a".repeat(64)),user_id:"user-1",expires_at:Math.floor(Date.now()/1000)+3600,revoked_at:null,device_id_hash:hash};
  const response=await revokeUserDevice(new Request("https://api.example/api/devices/revoke",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({deviceRef:hash})}),env,{userId:"user-1"});
  assert.equal(response.status,200);
  assert.ok(env.state.devices.get(hash).revoked_at);
  assert.equal(env.state.revokedTokens,1);
  assert.equal(await authenticate(new Request("https://api.example",{headers:{Authorization:"Bearer "+"a".repeat(64)}}),env),null);
});

test("device inventory is scoped to the authenticated account", async () => {
  const env=makeEnv();
  env.state.devices.set("b".repeat(64),{device_id_hash:"b".repeat(64),user_id:"user-1",label:"Android",first_seen_at:100,last_seen_at:200,revoked_at:null});
  env.state.devices.set("c".repeat(64),{device_id_hash:"c".repeat(64),user_id:"user-2",label:"Windows",first_seen_at:100,last_seen_at:200,revoked_at:null});
  const response=await listUserDevices(env,{userId:"user-1"});
  const data=await response.json();
  assert.equal(data.devices.length,1);
  assert.equal(data.devices[0].label,"Android");
  assert.equal(data.devices[0].deviceRef,"b".repeat(64));
});
