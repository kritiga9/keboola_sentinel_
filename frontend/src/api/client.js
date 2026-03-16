const BASE = ''  // same origin in production; Vite proxy handles /api in dev

async function apiFetch(path) {
  const res = await fetch(`${BASE}${path}`)
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export const fetchStacks = () => apiFetch('/api/stacks')

export const fetchOrganizations = (stack) =>
  apiFetch(`/api/organizations${stack ? '?' + new URLSearchParams({ stack }) : ''}`)

export const fetchRoi = (org, startDate, endDate) => {
  const params = new URLSearchParams({ org })
  if (startDate) params.set('start_date', startDate)
  if (endDate) params.set('end_date', endDate)
  return apiFetch(`/api/roi?${params}`)
}

export const fetchInventory = (org) =>
  apiFetch(`/api/inventory?${new URLSearchParams({ org })}`)

export const fetchImpactTables = (org) =>
  apiFetch(`/api/impact/tables?${new URLSearchParams({ org })}`)

export const fetchImpactAnalysis = (table, org) =>
  apiFetch(`/api/impact/analysis?${new URLSearchParams({ table, org })}`)
