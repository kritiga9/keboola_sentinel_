import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar.jsx'
import ROIAnalysis from './pages/ROIAnalysis.jsx'
import AssetInventory from './pages/AssetInventory.jsx'
import ImpactAnalysis from './pages/ImpactAnalysis.jsx'
import { fetchStacks, fetchOrganizations } from './api/client.js'

export default function App() {
  const [page, setPage] = useState('roi')

  const [stacks, setStacks] = useState([])
  const [selectedStack, setSelectedStack] = useState('')

  const [orgs, setOrgs] = useState([])
  const [selectedOrg, setSelectedOrg] = useState('All Organizations')

  // Load stack list once on mount
  useEffect(() => {
    fetchStacks().catch(console.error).then(s => setStacks(s ?? []))
  }, [])

  // When stack changes, reset org and reload org list
  useEffect(() => {
    setSelectedOrg('All Organizations')
    setOrgs([])
    if (!selectedStack) return
    fetchOrganizations(selectedStack)
      .then(o => setOrgs(o ?? []))
      .catch(console.error)
  }, [selectedStack])

  const pages = {
    roi:       <ROIAnalysis selectedOrg={selectedOrg} selectedStack={selectedStack} />,
    inventory: <AssetInventory selectedOrg={selectedOrg} selectedStack={selectedStack} />,
    impact:    <ImpactAnalysis selectedOrg={selectedOrg} selectedStack={selectedStack} />,
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        page={page}
        setPage={setPage}
        stacks={stacks}
        selectedStack={selectedStack}
        setSelectedStack={setSelectedStack}
        orgs={orgs}
        selectedOrg={selectedOrg}
        setSelectedOrg={setSelectedOrg}
      />
      <main className="ml-64 flex-1 min-w-0">
        <div className="max-w-7xl mx-auto px-8 py-8">
          {pages[page]}
        </div>
      </main>
    </div>
  )
}
