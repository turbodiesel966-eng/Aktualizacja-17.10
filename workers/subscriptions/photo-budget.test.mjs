import test from "node:test";
import assert from "node:assert/strict";
import {
  photoBudgetConfig,
  estimatePhotoCostMicrousd,
  reservePhotoBudget,
  settlePhotoBudget,
  photoImageDimensions
} from "./src/index.mjs";

test("budżet AI ma mały bezpieczny domyślny limit i odrzuca nieprawidłową konfigurację", () => {
  assert.deepEqual(photoBudgetConfig({}), { budgetMicrousd: 5_000_000, reserveMicrousd: 250_000 });
  assert.deepEqual(photoBudgetConfig({ PHOTO_MONTHLY_BUDGET_USD: "2", PHOTO_REQUEST_RESERVE_USD: "0.1" }), {
    budgetMicrousd: 2_000_000, reserveMicrousd: 100_000
  });
  assert.equal(photoBudgetConfig({ PHOTO_MONTHLY_BUDGET_USD: "1000" }), null);
  assert.equal(photoBudgetConfig({ PHOTO_MONTHLY_BUDGET_USD: "2", PHOTO_REQUEST_RESERVE_USD: "3" }), null);
});

test("koszt szacowany korzysta z jawnych stawek obsługiwanych modeli", () => {
  assert.equal(estimatePhotoCostMicrousd("gpt-6-luna", 100_000, 1_000), 10_000 + 500);
  assert.equal(estimatePhotoCostMicrousd("gpt-4.1-mini", 100_000, 1_000), 40_000 + 1_600);
  assert.equal(estimatePhotoCostMicrousd("unknown-model", 100, 100), null);
  assert.equal(estimatePhotoCostMicrousd("gpt-6-luna", -1, 100), null);
});

function fakeBudgetDb() {
  const state = { row: null, deleted: false };
  return {
    state,
    prepare(sql) {
      return {
        bind(...args) {
          return {
            async first() {
              if (!sql.includes("INSERT INTO photo_usage_budget")) throw new Error("Unexpected first SQL: " + sql);
              const [periodStart,budget,reserve,now] = args;
              if (!state.row) {
                state.row = { period_start:periodStart,budget_microusd:budget,reserved_microusd:reserve,actual_microusd:0,request_count:1,updated_at:now };
                return { period_start:periodStart,budget_microusd:budget };
              }
              if (state.row.actual_microusd + state.row.reserved_microusd + reserve > budget) return null;
              state.row.budget_microusd=budget;
              state.row.reserved_microusd+=reserve;
              state.row.request_count+=1;
              state.row.updated_at=now;
              return { period_start:periodStart,budget_microusd:budget };
            },
            async run() {
              if (sql.includes("UPDATE photo_usage_budget")) {
                const [reserve,actual,updatedAt,periodStart] = args;
                if (!state.row || state.row.period_start !== periodStart) return { meta:{changes:0} };
                state.row.reserved_microusd=Math.max(0,state.row.reserved_microusd-reserve);
                state.row.actual_microusd+=actual;
                state.row.updated_at=updatedAt;
                return { meta:{changes:1} };
              }
              if (sql.includes("DELETE FROM photo_usage_budget")) { state.deleted=true; return {meta:{changes:1}}; }
              throw new Error("Unexpected run SQL: " + sql);
            }
          };
        }
      };
    }
  };
}

test("budżet rezerwuje koszt atomowo i blokuje kolejne wywołania ponad limit", async () => {
  const DB=fakeBudgetDb();
  const env={DB,PHOTO_MONTHLY_BUDGET_USD:"0.5",PHOTO_REQUEST_RESERVE_USD:"0.25"};
  const first=await reservePhotoBudget(env);
  const second=await reservePhotoBudget(env);
  const third=await reservePhotoBudget(env);
  assert.ok(first);
  assert.ok(second);
  assert.equal(third,null);
  assert.equal(DB.state.row.reserved_microusd,500_000);
  await settlePhotoBudget(env,first,80_000);
  assert.equal(DB.state.row.reserved_microusd,250_000);
  assert.equal(DB.state.row.actual_microusd,80_000);
  await settlePhotoBudget(env,second,100_000);
  assert.equal(DB.state.row.reserved_microusd,0);
  const fourth=await reservePhotoBudget(env);
  assert.ok(fourth);
  assert.equal(DB.state.row.request_count,3);
});

test("brak storage budżetu ma się zakończyć błędem, a nie zgodą na analizę", async () => {
  const env={PHOTO_MONTHLY_BUDGET_USD:"5",PHOTO_REQUEST_RESERVE_USD:"0.25",DB:{prepare(){throw new Error("D1 offline");}}};
  await assert.rejects(()=>reservePhotoBudget(env),/D1 offline/);
});

test("odczyt wymiarów PNG jest ograniczony do nagłówka obrazu", () => {
  const png = new Uint8Array(24);
  png.set([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a],0);
  png.set([0,0,4,0],16);
  png.set([0,0,3,0],20);
  assert.deepEqual(photoImageDimensions(png,"image/png"),{width:1024,height:768});
  assert.equal(photoImageDimensions(new Uint8Array(10),"image/png"),null);
});
