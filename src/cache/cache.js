import { readRow, writeRow } from './db';

const parse = (row) =>
  row ? { payload: JSON.parse(row.payload), updatedAt: row.updated_at } : null;

export async function readDashboardCache(orgId, branchId) {
  return parse(
    await readRow('dashboard_cache', {
      org_id: orgId,
      branch_id: branchId ? String(branchId) : '',
    })
  );
}
export async function writeDashboardCache(orgId, branchId, payload) {
  if (!orgId || payload == null) return;
  await writeRow('dashboard_cache', {
    org_id: String(orgId),
    branch_id: branchId ? String(branchId) : '',
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

export async function readBranchesListCache(orgId, period = 'today') {
  return parse(
    await readRow('branches_list_cache', { org_id: orgId, period })
  );
}
export async function writeBranchesListCache(orgId, period = 'today', payload) {
  if (!orgId || payload == null) return;
  await writeRow('branches_list_cache', {
    org_id: String(orgId),
    period: String(period),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

export async function readBranchHomeCache(orgId, branchId, period = 'today') {
  return parse(
    await readRow('branch_home_cache', {
      org_id: orgId,
      branch_id: branchId,
      period,
    })
  );
}
export async function writeBranchHomeCache(orgId, branchId, period = 'today', payload) {
  if (!orgId || !branchId || payload == null) return;
  await writeRow('branch_home_cache', {
    org_id: String(orgId),
    branch_id: String(branchId),
    period: String(period),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

export async function readBranchSalesCache(orgId, branchId, period = 'today') {
  return parse(
    await readRow('branch_sales_cache', {
      org_id: orgId,
      branch_id: branchId,
      period,
    })
  );
}
export async function writeBranchSalesCache(orgId, branchId, period = 'today', payload) {
  if (!orgId || !branchId || payload == null) return;
  await writeRow('branch_sales_cache', {
    org_id: String(orgId),
    branch_id: String(branchId),
    period: String(period),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}

export async function readSettingsCache(orgId) {
  return parse(await readRow('settings_cache', { org_id: orgId }));
}
export async function writeSettingsCache(orgId, payload) {
  if (!orgId || payload == null) return;
  await writeRow('settings_cache', {
    org_id: String(orgId),
    payload: JSON.stringify(payload),
    updated_at: Date.now(),
  });
}