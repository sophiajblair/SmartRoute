import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, Navigate, Route as RouterRoute, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  Activity, AlertTriangle, Bell, BookOpen, Check, ChevronDown,
  ClipboardList, Clock3, FileText, LayoutDashboard, LogOut, Menu, Plus, Search, Settings,
  ShieldCheck, Sparkles, Truck, Users, X,
} from 'lucide-react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, ResponsiveContainer,
  Tooltip, XAxis, YAxis,
} from 'recharts'
import { api, json } from './api'
import type { AllocationRecommendation, Route, User } from './types'

type Toast = { id: number; text: string; kind: 'success' | 'error' }
const titles: Record<string, string> = {
  '/': 'Overview', '/notebooks': 'Smart Notebook', '/requests': 'Replacement requests',
  '/allocation': 'Smart Allocation', '/assignments': 'My assignments', '/reports': 'Delivery reports',
  '/analytics': 'Analytics', '/notifications': 'Notifications', '/settings': 'Settings',
}
const navItems = [
  { path: '/', label: 'Overview', icon: LayoutDashboard, roles: ['director', 'manager', 'postman', 'expert'] },
  { path: '/notebooks', label: 'Smart Notebook', icon: BookOpen, roles: ['director', 'manager', 'postman', 'expert'] },
  { path: '/requests', label: 'Replacement requests', icon: ClipboardList, roles: ['director', 'manager'] },
  { path: '/allocation', label: 'Smart Allocation', icon: Sparkles, roles: ['director'] },
  { path: '/assignments', label: 'My assignments', icon: Truck, roles: ['expert'] },
  { path: '/reports', label: 'Delivery reports', icon: FileText, roles: ['director', 'manager', 'expert'] },
  { path: '/analytics', label: 'Analytics', icon: Activity, roles: ['director', 'manager'] },
  { path: '/notifications', label: 'Notifications', icon: Bell, roles: ['director', 'manager', 'postman', 'expert'] },
  { path: '/settings', label: 'Settings', icon: Settings, roles: ['director', 'manager', 'postman', 'expert'] },
]
const money = (value: number | null) => value === null ? '—' : `${value.toFixed(1)}%`

export default function App() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [toasts, setToasts] = useState<Toast[]>([])
  const location = useLocation()
  const navigate = useNavigate()
  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => {
    const id = Date.now()
    setToasts(current => [...current, { id, text, kind }])
    window.setTimeout(() => setToasts(current => current.filter(item => item.id !== id)), 4200)
  }, [])

  useEffect(() => {
    if (!localStorage.getItem('smartroute_token')) { setLoading(false); return }
    api<User>('/auth/me').then(setUser).catch(() => {
      localStorage.removeItem('smartroute_token')
      localStorage.removeItem('smartroute_user')
    }).finally(() => setLoading(false))
  }, [])
  const logout = () => {
    localStorage.removeItem('smartroute_token')
    localStorage.removeItem('smartroute_user')
    setUser(null)
    navigate('/login')
  }

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Loading SmartRoute…</span></div>
  if (!user) return <Login onLogin={setUser} toast={toast} />
  const title = titles[location.pathname] ?? (location.pathname.startsWith('/notebooks/') ? 'Route notebook' : 'SmartRoute')

  return <div className="app-shell">
    <Sidebar user={user} />
    <main className="main-area">
      <header className="topbar">
        <div className="topbar-title"><span className="eyebrow">OPERATIONS / {user.role.toUpperCase()}</span><h1>{title}</h1></div>
        <div className="topbar-tools">
          <GlobalSearch onGo={navigate} />
          <Link to="/notifications" className="icon-button notification-button" aria-label="Notifications"><Bell size={19} /><UnreadDot /></Link>
          <div className="profile-menu"><span className="avatar">{initials(user.name)}</span><div className="profile-copy"><b>{user.name}</b><span>{roleLabel(user.role)}</span></div><button className="icon-quiet" onClick={logout} title="Sign out"><LogOut size={17} /></button></div>
        </div>
      </header>
      <div className="content">
        <div className="demo-banner"><span className="demo-dot" /> Demonstration Data — Fictional <span>University prototype · Not approved for production use at La Poste</span></div>
        <Routes>
          <RouterRoute path="/" element={user.role === 'expert' || user.role === 'postman' ? <PersonalOverview user={user} /> : <Overview user={user} />} />
          <RouterRoute path="/notebooks" element={<NotebookList user={user} toast={toast} />} />
          <RouterRoute path="/notebooks/:id" element={<NotebookDetail user={user} toast={toast} />} />
          <RouterRoute path="/requests" element={<Requests user={user} toast={toast} />} />
          <RouterRoute path="/allocation" element={<AllocationPage toast={toast} />} />
          <RouterRoute path="/assignments" element={<Assignments user={user} toast={toast} />} />
          <RouterRoute path="/reports" element={<Reports user={user} toast={toast} />} />
          <RouterRoute path="/analytics" element={<Analytics />} />
          <RouterRoute path="/notifications" element={<Notifications toast={toast} />} />
          <RouterRoute path="/settings" element={<SettingsPage user={user} />} />
          <RouterRoute path="*" element={<Navigate to="/" replace />} />
        </Routes>
        <footer className="footer-note">SmartRoute <span>·</span> The right information. The right replacement. The right delivery.</footer>
      </div>
    </main>
    <div className="toast-stack">{toasts.map(item => <div key={item.id} className={`toast ${item.kind}`}><span>{item.kind === 'success' ? <Check size={17} /> : <AlertTriangle size={17} />}</span>{item.text}<button onClick={() => setToasts(current => current.filter(t => t.id !== item.id))}><X size={15} /></button></div>)}</div>
  </div>
}

function Sidebar({ user }: { user: User }) {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const items = navItems.filter(item => item.roles.includes(user.role))
  return <>
    <button className="mobile-menu" onClick={() => setOpen(!open)} aria-label="Toggle navigation"><Menu /></button>
    <aside className={`sidebar ${open ? 'sidebar-open' : ''}`}>
      <Link to="/" className="brand"><span className="brand-mark"><span /></span><span>smart<span className="brand-yellow">route</span><small>POSTAL OPERATIONS</small></span></Link>
      <div className="unit-switch"><span className="unit-icon">SR</span><span><b>{user.role === 'manager' || user.role === 'postman' ? 'My postal unit' : 'France operations'}</b><small>{roleLabel(user.role)}</small></span><ChevronDown size={15} /></div>
      <span className="nav-caption">WORKSPACE</span>
      <nav>{items.map(item => <Link key={item.path} onClick={() => setOpen(false)} to={item.path} className={`nav-link ${location.pathname === item.path || item.path !== '/' && location.pathname.startsWith(item.path) ? 'active' : ''}`}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span></Link>)}</nav>
      <div className="sidebar-bottom"><div className="support-card"><div className="support-icon"><ShieldCheck size={17} /></div><b>Built for better delivery</b><p>Shared route knowledge. Smarter operations.</p><span>SMARTROUTE PROTOTYPE</span></div><div className="sidebar-user"><span className="avatar">{initials(user.name)}</span><span><b>{user.name}</b><small>{roleLabel(user.role)}</small></span><LogOut className="logout-mini" size={16} /></div></div>
    </aside>
  </>
}

function Login({ onLogin, toast }: { onLogin: (user: User) => void; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [email, setEmail] = useState('director@smartroute.demo')
  const [password, setPassword] = useState('SmartRoute2026!')
  const [busy, setBusy] = useState(false)
  const login = async (event: FormEvent) => {
    event.preventDefault()
    setBusy(true)
    try {
      const result = await api<{ access_token: string; user: User }>('/auth/login', json('POST', { email, password }))
      localStorage.setItem('smartroute_token', result.access_token)
      localStorage.setItem('smartroute_user', JSON.stringify(result.user))
      onLogin(result.user)
    } catch (error) { toast(error instanceof Error ? error.message : 'Unable to sign in', 'error') } finally { setBusy(false) }
  }
  const demo = [
    ['Area director', 'director@smartroute.demo'], ['Unit manager', 'manager1@smartroute.demo'],
    ['Regular postman', 'postman1@smartroute.demo'], ['Expert replacement', 'expert1@smartroute.demo'],
  ]
  return <div className="login-page"><div className="login-aside"><Link to="/" className="brand"><span className="brand-mark"><span /></span><span>smart<span className="brand-yellow">route</span></span></Link><div><span className="login-overline">ONE PLATFORM. BETTER DELIVERIES.</span><h1>The right information.<br />The right replacement.<br /><span>The right delivery.</span></h1><p>A shared operational notebook for the people who make every delivery count.</p></div><span className="login-aside-foot">A university prototype · Fictional demonstration data</span></div><div className="login-panel"><div className="login-card"><span className="eyebrow">WELCOME TO SMARTROUTE</span><h2>Sign in to your workspace</h2><p className="muted">Use one of the fictional demo accounts to explore the platform.</p><form onSubmit={login}><label>Email address<input required type="email" autoComplete="username" value={email} onChange={event => setEmail(event.target.value)} /></label><label>Password<input required type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} /></label><button className="button button-primary full-button" disabled={busy}>{busy ? <><span className="button-spinner" /> Signing in…</> : 'Sign in'}<span>→</span></button></form><div className="demo-logins"><b>DEMO ACCOUNTS</b>{demo.map(([label, address]) => <button key={address} onClick={() => setEmail(address)}><span>{label}</span><code>{address}</code></button>)}<small>Shared demo password: <code>SmartRoute2026!</code></small></div></div></div></div>
}

function Overview({ user }: { user: User }) {
  const [data, setData] = useState<any>(null)
  const [requests, setRequests] = useState<any[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    Promise.all([api('/analytics'), api('/requests'), api<Route[]>('/routes')]).then(([a, r, rt]) => {
      setData(a); setRequests(r as any[]); setRoutes(rt as Route[])
    }).catch(e => setError(e.message))
  }, [])
  if (error) return <ErrorState message={error} />
  const kpis = data ? [
    { label: 'Replacement requests', value: data.total_requests, icon: ClipboardList, change: 'Requests in the local database' },
    { label: 'Available experts', value: data.available_experts, icon: Users, change: 'Currently marked available' },
    { label: 'Replacement coverage', value: money(data.coverage_rate), icon: ShieldCheck, change: 'Approved or partly covered' },
    { label: 'Postponed parcels', value: data.postponed_parcels, icon: Truck, change: 'Reported as undelivered' },
  ] : []
  return <><div className="welcome-row"><div><span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span><h2>Good morning, {user.name.split(' ')[0]} <span className="wave">✦</span></h2><p>Here’s the latest view of your postal operations.</p></div>{user.role === 'manager' && <Link to="/requests" className="button button-primary"><Plus size={17} /> New request</Link>}</div>
    <div className="kpi-grid">{data ? kpis.map((item, index) => <div className="kpi-card" key={item.label}><div className={`kpi-icon kpi-${index}`}><item.icon size={19} /></div><span className="kpi-label">{item.label}</span><strong>{item.value ?? '—'}</strong><small>{item.change}</small><span className="kpi-trend">Fictional</span></div>) : <div className="loading-card">Loading operational records…</div>}</div>
    <div className="dashboard-grid"><section className="panel chart-panel"><PanelHeading title="Delivery completion" subtitle="Successful parcels / reported parcels by postal unit" /><div className="chart-area">{data?.completion_by_unit?.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.completion_by_unit} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" /><XAxis dataKey="unit" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} /><Tooltip /><Bar dataKey="completion_rate" fill="#FFCB05" radius={[6, 6, 0, 0]} name="Completion %" /></BarChart></ResponsiveContainer> : <EmptyState text="Delivery reports will appear here when submitted." />}</div></section>
      <section className="panel chart-panel"><PanelHeading title="Request activity" subtitle="Requests grouped by recorded date" /><div className="chart-area">{data?.request_trends?.length ? <ResponsiveContainer width="100%" height="100%"><LineChart data={data.request_trends} margin={{ top: 12, right: 14, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 10 }} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} /><Tooltip /><Line dataKey="count" stroke="#172B4D" strokeWidth={2.5} dot={{ fill: '#FFCB05', strokeWidth: 2, r: 4 }} name="Requests" /></LineChart></ResponsiveContainer> : <EmptyState text="No request trend data yet." />}</div></section></div>
    <div className="dashboard-grid lower-grid"><section className="panel"><PanelHeading title="Incoming requests" subtitle="Recent requests requiring attention" action={<Link to="/requests" className="text-link">View all →</Link>} /><RequestTable requests={requests.slice(0, 5)} /></section><section className="panel"><PanelHeading title="Route notebooks" subtitle="Shared knowledge at a glance" action={<Link to="/notebooks" className="text-link">Browse →</Link>} /><div className="route-mini-list">{routes.slice(0, 5).map(route => <Link key={route.id} to={`/notebooks/${route.id}`} className="route-mini"><span className="route-avatar"><BookOpen size={16} /></span><span><b>{route.code} · {route.name}</b><small>{route.unit} · {route.buildings_count} buildings</small></span><span className="completeness">{route.completeness}%</span></Link>)}</div></section></div>
  </>
}

function PersonalOverview({ user }: { user: User }) {
  const [routes, setRoutes] = useState<Route[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [error, setError] = useState('')
  useEffect(() => {
    const load = user.role === 'expert'
      ? Promise.all([api<Route[]>('/routes'), api<any[]>('/assignments')]).then(([routeRows, assignmentRows]) => {
        setRoutes(routeRows); setAssignments(assignmentRows)
      })
      : api<Route[]>('/routes').then(setRoutes)
    load.catch(e => setError(errorText(e)))
  }, [user.role])
  if (error) return <ErrorState message={error} />
  const averageCompleteness = routes.length
    ? Math.round(routes.reduce((sum, route) => sum + route.completeness, 0) / routes.length)
    : null
  return <><div className="welcome-row"><div><span className="eyebrow">{new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}</span><h2>Good morning, {user.name.split(' ')[0]} <span className="wave">✦</span></h2><p>{user.role === 'expert' ? 'Your assignments and approved route knowledge, all in one place.' : 'Your unit’s shared route knowledge is ready to explore.'}</p></div>{user.role === 'expert' && <Link to="/assignments" className="button button-primary"><Truck size={16} /> My assignments</Link>}</div><div className="kpi-grid"><div className="kpi-card"><div className="kpi-icon"><BookOpen size={19} /></div><span className="kpi-label">Available route notebooks</span><strong>{routes.length}</strong><small>Approved unit knowledge</small></div>{user.role === 'expert' ? <><div className="kpi-card"><div className="kpi-icon kpi-1"><Truck size={19} /></div><span className="kpi-label">My assignments</span><strong>{assignments.length}</strong><small>Personal delivery rounds</small></div><div className="kpi-card"><div className="kpi-icon kpi-2"><Check size={19} /></div><span className="kpi-label">In progress</span><strong>{assignments.filter(a => a.status === 'In Progress').length}</strong><small>Assignments underway</small></div></> : <div className="kpi-card"><div className="kpi-icon kpi-2"><ShieldCheck size={19} /></div><span className="kpi-label">Average route completeness</span><strong>{averageCompleteness === null ? '—' : `${averageCompleteness}%`}</strong><small>Calculated from this unit’s route records</small></div>}</div><section className="panel"><PanelHeading title={user.role === 'expert' ? 'Assigned delivery rounds' : 'Your unit’s route notebooks'} subtitle={user.role === 'expert' ? 'Open a round to review its approved notebook.' : 'Search and maintain shared local delivery knowledge.'} action={<Link to="/notebooks" className="text-link">Browse notebooks →</Link>} />{user.role === 'expert' && assignments.length ? <div className="route-mini-list">{assignments.slice(0, 5).map(item => <Link key={item.id} to={`/notebooks/${item.route_id}`} className="route-mini"><span className="route-avatar"><Truck size={16} /></span><span><b>{item.route_code} · {item.route}</b><small>{item.unit} · {item.date} · {item.status}</small></span><span className="text-link">Open →</span></Link>)}</div> : routes.length ? <div className="route-mini-list">{routes.slice(0, 8).map(route => <Link key={route.id} to={`/notebooks/${route.id}`} className="route-mini"><span className="route-avatar"><BookOpen size={16} /></span><span><b>{route.code} · {route.name}</b><small>{route.unit} · {route.buildings_count} buildings</small></span><span className="completeness">{route.completeness}%</span></Link>)}</div> : <EmptyState text={user.role === 'expert' ? 'No delivery rounds are assigned to you yet.' : 'No route notebooks are available.'} />}</section></>
}

function NotebookList({ user, toast }: { user: User; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [routes, setRoutes] = useState<Route[]>([])
  const location = useLocation()
  const [query, setQuery] = useState(() => new URLSearchParams(location.search).get('q') ?? '')
  const [unitFilter, setUnitFilter] = useState('')
  const [sort, setSort] = useState('completeness')
  const [busy, setBusy] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const load = useCallback(async () => { setBusy(true); try { setRoutes(await api<Route[]>(`/routes?search=${encodeURIComponent(query)}`)) } catch (e) { toast(errorText(e), 'error') } finally { setBusy(false) } }, [query, toast])
  useEffect(() => { const timer = window.setTimeout(load, 180); return () => clearTimeout(timer) }, [load])
  const filteredRoutes = routes
    .filter(route => !unitFilter || String(route.unit_id) === unitFilter)
    .sort((a, b) => sort === 'difficulty' ? b.difficulty - a.difficulty : b.completeness - a.completeness)
  const unitOptions = [...new Map(routes.map(route => [route.unit_id, route.unit])).entries()]
  return <><div className="page-intro"><div><h2>Route notebooks</h2><p>Practical, approved delivery knowledge—kept current by the people who know every round.</p></div>{user.role === 'manager' && <button className="button button-primary" onClick={() => setCreateOpen(true)}><Plus size={17} /> Create notebook</button>}</div><div className="toolbar"><div className="search-field"><Search size={17} /><input placeholder="Search route name or ID…" value={query} onChange={e => setQuery(e.target.value)} /><kbd>⌘ K</kbd></div><span className="muted">{filteredRoutes.length} notebooks</span>{unitOptions.length > 1 && <select className="select-small" value={unitFilter} onChange={e => setUnitFilter(e.target.value)}><option value="">All postal units</option>{unitOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select>}<select className="select-small" value={sort} onChange={e => setSort(e.target.value)}><option value="completeness">Sort: completeness</option><option value="difficulty">Sort: difficulty</option></select></div>{busy ? <LoadingCard /> : filteredRoutes.length ? <div className="notebook-grid">{filteredRoutes.map(route => <NotebookCard key={route.id} route={route} />)}</div> : <EmptyState text="No route notebooks match these filters." />}{createOpen && <Modal title="Create delivery notebook" onClose={() => setCreateOpen(false)}><RouteCreateForm toast={toast} onDone={() => { setCreateOpen(false); load() }} /></Modal>}</>
}

function NotebookCard({ route }: { route: Route }) {
  return <Link to={`/notebooks/${route.id}`} className="notebook-card"><div className="notebook-card-top"><span className="route-tag">{route.code}</span><span className="status-pill status-approved">Approved notebook</span></div><h3>{route.name}</h3><span className="notebook-unit">{route.unit}</span><div className="notebook-stats"><span><Clock3 size={15} />{Math.round(route.duration_minutes / 60)}h {route.duration_minutes % 60}m</span><span><Truck size={15} />{route.parcel_volume} parcels</span></div><div className="route-owner"><span className="avatar avatar-small">{initials(route.postman)}</span><span>Regular postman<strong>{route.postman}</strong></span></div><div className="completeness-row"><span>Information completeness</span><b>{route.completeness}%</b></div><div className="progress-bar"><span style={{ width: `${route.completeness}%` }} /></div><div className="notebook-card-foot"><span><AlertTriangle size={14} /> {route.issues_count} open issues</span><span>Updated {dateLabel(route.updated_at)}</span></div></Link>
}

function NotebookDetail({ user, toast }: { user: User; toast: (text: string, kind?: Toast['kind']) => void }) {
  const { id = '' } = useParams()
  const [data, setData] = useState<any>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<any>(null)
  const [issueOpen, setIssueOpen] = useState(false)
  const [changeOpen, setChangeOpen] = useState(false)
  const [buildingOpen, setBuildingOpen] = useState(false)
  const [editingBuilding, setEditingBuilding] = useState<any>(null)
  const [refresh, setRefresh] = useState(0)
  const load = useCallback(() => api(`/routes/${id}`).then(setData).catch(e => toast(errorText(e), 'error')), [id, toast])
  useEffect(() => { load() }, [load, refresh])
  const doSearch = async (event: FormEvent) => { event.preventDefault(); if (!search.trim()) return; try { setResults(await api(`/routes/${id}/search?q=${encodeURIComponent(search)}`)) } catch (e) { toast(errorText(e), 'error') } }
  if (!data) return <LoadingCard />
  const route: Route = data.route
  const review = async (changeId: number, decision: string) => {
    try { await api(`/notebook-changes/${changeId}/review?decision=${decision}`, json('POST', undefined)); toast(`Notebook update ${decision}d.`); setRefresh(v => v + 1) } catch (e) { toast(errorText(e), 'error') }
  }
  return <><div className="breadcrumbs"><Link to="/notebooks">Smart Notebook</Link><span>/</span>{route.code}</div><div className="route-detail-heading"><div><div className="route-heading-line"><span className="route-tag">{route.code}</span><span className="status-pill status-approved">Official notebook</span></div><h2>{route.name}</h2><p>{route.unit} <span>·</span> Maintained by {route.postman}</p></div><div className="route-heading-actions"><button className="button button-secondary" onClick={() => setIssueOpen(true)}><AlertTriangle size={16} /> Report difficulty</button>{['manager', 'postman'].includes(user.role) && <button className="button button-primary" onClick={() => setChangeOpen(true)}><Plus size={16} /> Suggest update</button>}</div></div>
    <div className="notebook-detail-grid"><div className="detail-main">
      <section className="panel route-overview"><PanelHeading title="Route overview" subtitle="At-a-glance information for this delivery round" /><div className="overview-metrics"><Metric label="Estimated duration" value={`${Math.floor(route.duration_minutes / 60)}h ${route.duration_minutes % 60}m`} /><Metric label="Parcel volume" value={`${route.parcel_volume} parcels`} /><Metric label="Route difficulty" value={`${route.difficulty} / 5`} /><Metric label="Updated" value={dateLabel(route.updated_at)} /></div></section>
      <section className="panel"><PanelHeading title="Smart notebook search" subtitle="Search approved route, building and issue information" /><form className="notebook-search" onSubmit={doSearch}><Search size={18} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Try “entrance”, “works” or a street name…" /><button className="button button-dark">Search</button></form>{results && <div className="search-results"><b>{results.results.length ? `${results.results.length} matching entries` : results.message}</b>{results.results.map((item: any, i: number) => <div key={i} className="search-result"><span>{item.type}</span><b>{item.title}</b><p>{item.content}</p></div>)}</div>}</section>
      <section className="panel"><PanelHeading title="Route information" subtitle="Approved shared instructions" />{[['Description', route.description], ['Recommended sequence', route.sequence], ['Important obstacles', route.obstacles], ['Special delivery instructions', route.instructions]].map(([label, value]) => <div className="info-block" key={label}><span>{label}</span><p>{value || 'No information recorded.'}</p></div>)}</section>
      <section className="panel"><PanelHeading title="Building instructions" subtitle={`${data.buildings.length} structured entries`} action={user.role === 'manager' ? <button className="text-link button-as-link" onClick={() => setBuildingOpen(true)}>+ Add building</button> : null} />{data.buildings.length ? <div className="building-grid">{data.buildings.map((building: any) => <div key={building.id} className="building-card"><div className="building-icon"><span>⌂</span></div><div><b>{building.name}</b><small>{building.address}</small></div><p><strong>Entrance:</strong> {building.entrance || 'Not recorded'}</p><p><strong>Access:</strong> {building.access_instructions || 'Not recorded'}</p><p><strong>Delivery:</strong> {building.delivery_instructions || 'Not recorded'}</p><p><strong>Known difficulty:</strong> {building.difficulties || 'None recorded'}</p>{user.role === 'manager' && <div className="building-actions"><button className="text-link button-as-link" onClick={() => setEditingBuilding(building)}>Edit</button><button className="text-link button-as-link" onClick={async () => { if (!window.confirm(`Delete ${building.name}?`)) return; try { await api(`/buildings/${building.id}`, { method: 'DELETE' }); toast('Building entry deleted.'); setRefresh(v => v + 1) } catch (e) { toast(errorText(e), 'error') } }}>Delete</button></div>}</div>)}</div> : <EmptyState text="No building information has been added." />}</section>
      <section className="panel"><PanelHeading title="Known route issues" subtitle="Reported conditions that may affect delivery" />{data.issues.length ? <div className="issue-list">{data.issues.map((issue: any) => <div key={issue.id} className="issue-row"><span className={`priority-mark ${issue.priority.toLowerCase()}`} /><div><b>{issue.title}</b><p>{issue.description}</p><small>{issue.category} · Reported by {issue.reported_by} · {dateLabel(issue.created_at)}</small>{user.role === 'manager' && issue.status !== 'Resolved' && <button className="text-link button-as-link" onClick={async () => { try { await api(`/issues/${issue.id}?status=Resolved&resolution=${encodeURIComponent('Reviewed by unit manager')}`, json('PATCH')); toast('Route issue marked resolved.'); setRefresh(v => v + 1) } catch (e) { toast(errorText(e), 'error') } }}>Mark resolved</button>}</div><span className={`status-pill status-${issue.status.toLowerCase().replaceAll(' ', '-')}`}>{issue.status}</span></div>)}</div> : <EmptyState text="No known issues recorded for this route." />}</section>
    </div><aside className="detail-side"><section className="panel contact-panel"><PanelHeading title="Support contacts" subtitle="Fictional demo contact details" /><div className="contact-row"><span className="contact-avatar">UM</span><div><small>Unit manager</small><b>{data.manager_contact}</b></div></div><div className="contact-row"><span className="contact-avatar support-avatar">IS</span><div><small>Internal support</small><b>{data.support_contact}</b></div></div><div className="contact-note"><ShieldCheck size={15} /> If a delivery is blocked, report the issue and contact the unit manager.</div></section><section className="panel"><PanelHeading title="Update history" subtitle="Contributor, reviewer and approval trail" />{data.history.length ? data.history.map((item: any, i: number) => <div key={i} className="timeline-item"><span className="timeline-dot" /><b>{item.field.replaceAll('_', ' ')}</b><p>{item.new_value}</p><small>Submitted by {item.submitted_by} · Reviewed by {item.reviewed_by} · {dateLabel(item.created_at)}</small><span className={`status-pill status-${item.approval_status.toLowerCase().replaceAll(' ', '-')}`}>{item.approval_status}</span></div>) : <EmptyState text="No approved updates yet." />}</section>{data.pending_changes.length > 0 && <section className="panel"><PanelHeading title="Awaiting review" subtitle="Unpublished changes" />{data.pending_changes.map((change: any) => <div key={change.id} className="pending-change"><span className="status-pill status-pending">Pending approval</span><b>{change.field}</b><p>{change.value}</p><small>By {change.submitted_by}</small><div className="inline-actions"><button className="button button-primary" onClick={() => review(change.id, 'approve')}>Approve</button><button className="button button-secondary" onClick={() => review(change.id, 'reject')}>Reject</button></div></div>)}</section>}</aside></div>
    {issueOpen && <Modal title="Report route difficulty" onClose={() => setIssueOpen(false)}><IssueForm routeId={route.id} onDone={message => { toast(message); setIssueOpen(false); setRefresh(v => v + 1) }} toast={toast} /></Modal>}
    {changeOpen && <Modal title="Suggest notebook update" onClose={() => setChangeOpen(false)}><ChangeForm routeId={route.id} onDone={() => { toast('Update submitted for manager approval.'); setChangeOpen(false); setRefresh(v => v + 1) }} toast={toast} /></Modal>}
    {buildingOpen && <Modal title="Add building instructions" onClose={() => setBuildingOpen(false)}><BuildingForm routeId={route.id} onDone={() => { toast('Building instructions saved.'); setBuildingOpen(false); setRefresh(v => v + 1) }} toast={toast} /></Modal>}
    {editingBuilding && <Modal title="Edit building instructions" onClose={() => setEditingBuilding(null)}><BuildingForm routeId={route.id} building={editingBuilding} onDone={() => { toast('Building instructions updated.'); setEditingBuilding(null); setRefresh(v => v + 1) }} toast={toast} /></Modal>}
  </>
}

function Requests({ user, toast }: { user: User; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [requests, setRequests] = useState<any[]>([])
  const [showForm, setShowForm] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState<any>(null)
  const [filter, setFilter] = useState('All statuses')
  const load = useCallback(() => api<any[]>('/requests').then(setRequests).catch(e => toast(errorText(e), 'error')), [toast])
  useEffect(() => { load() }, [load])
  const visible = requests.filter(r => filter === 'All statuses' || r.status === filter)
  const review = async (id: number, status: string) => { if (status === 'Rejected' && !window.confirm(`Reject replacement request #${id}?`)) return; try { await api(`/requests/${id}?status=${encodeURIComponent(status)}`, json('PATCH')); toast(`Request moved to ${status.toLowerCase()}.`); load() } catch (e) { toast(errorText(e), 'error') } }
  return <><div className="page-intro"><div><h2>{user.role === 'manager' ? 'Your replacement requests' : 'Incoming replacement requests'}</h2><p>{user.role === 'manager' ? 'Request operational cover for your postal unit.' : 'Review and prioritize requests from postal units.'}</p></div>{user.role === 'manager' && <button className="button button-primary" onClick={() => setShowForm(true)}><Plus size={17} /> New replacement request</button>}</div><div className="summary-strip"><span><b>{requests.filter(r => r.status === 'Pending').length}</b> Pending</span><span><b>{requests.filter(r => r.status === 'Under Review').length}</b> Under review</span><span><b>{requests.filter(r => ['Approved', 'Partially Covered'].includes(r.status)).length}</b> Covered</span><div className="filter-spacer" /><select className="select-small" value={filter} onChange={e => setFilter(e.target.value)}>{['All statuses', 'Pending', 'Under Review', 'Approved', 'Partially Covered', 'Rejected'].map(v => <option key={v}>{v}</option>)}</select></div><div className="panel table-panel"><RequestTable requests={visible} detailed onReview={user.role === 'director' ? review : undefined} onDetails={setSelectedRequest} /></div>{showForm && <Modal title="New replacement request" onClose={() => setShowForm(false)}><RequestForm toast={toast} onDone={() => { setShowForm(false); load() }} /></Modal>}{selectedRequest && <Modal title={`Request REQ-${String(selectedRequest.id).padStart(4, '0')}`} onClose={() => setSelectedRequest(null)}><RequestDetails request={selectedRequest} /></Modal>}</>
}

function AllocationPage({ toast }: { toast: (text: string, kind?: Toast['kind']) => void }) {
  const [recommendations, setRecommendations] = useState<AllocationRecommendation[]>([])
  const [experts, setExperts] = useState<any[]>([])
  const [weights, setWeights] = useState({ urgency: 30, backlog: 30, workload: 25, difficulty: 15 })
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)
  const loadExperts = useCallback(() => api<any[]>('/availability').then(setExperts).catch(e => toast(errorText(e), 'error')), [toast])
  useEffect(() => { loadExperts() }, [loadExperts])
  const weightPayload = () => Object.fromEntries(Object.entries(weights).map(([key, value]) => [key, value / 100]))
  const generate = async () => { setLoading(true); try { const result = await api<{ recommendations: AllocationRecommendation[] }>('/allocation/recommendations', json('POST', { weights: weightPayload() })); setRecommendations(result.recommendations); setGenerated(true) } catch (e) { toast(errorText(e), 'error') } finally { setLoading(false) } }
  const allocate = async (item: AllocationRecommendation, expertId: number | null, reason: string) => {
    if (!expertId) { toast('No eligible expert is available for this request.', 'error'); return }
    try { await api('/allocation/approve', json('POST', { request_id: item.request_id, expert_id: expertId, override_reason: reason, weights: weightPayload() })); toast(`Request #${item.request_id} allocated. The manager and expert were notified.`); await loadExperts(); await generate() } catch (e) { toast(errorText(e), 'error') }
  }
  const toggleExpert = async (expert: any) => { try { await api(`/availability/${expert.user_id}?available=${!expert.available}`, json('PATCH')); toast(`${expert.name} marked ${expert.available ? 'unavailable' : 'available'}.`); loadExperts() } catch (e) { toast(errorText(e), 'error') } }
  const availableCount = experts.filter(e => e.available).length
  return <><div className="page-intro"><div><h2>Intelligent, human-led allocation</h2><p>Transparent recommendations to help the area director make better decisions.</p></div><button className="button button-primary" disabled={loading} onClick={generate}>{loading ? <span className="button-spinner" /> : <Sparkles size={17} />}{generated ? 'Refresh recommendations' : 'Generate allocation recommendations'}</button></div><div className="allocation-stats"><StatBox value={availableCount} label="Available experts" icon={<Users size={18} />} /><StatBox value={recommendations.length} label="Requests to review" icon={<ClipboardList size={18} />} /><StatBox value={recommendations.filter(r => r.priority === 'Critical').length} label="Critical requests" icon={<AlertTriangle size={18} />} /><StatBox value={recommendations.filter(r => !r.expert_id).reduce((sum, r) => sum + r.uncovered_rounds, 0)} label="Uncovered rounds" icon={<Truck size={18} />} /></div><div className="allocation-layout"><section className="panel weights-panel"><PanelHeading title="Scoring assumptions" subtitle="Proposed weights · not validated La Poste rules" /><div className="weight-list">{Object.entries(weights).map(([key, value]) => <label key={key}><span>{key[0].toUpperCase() + key.slice(1)}<small>{weightDescription(key)}</small></span><div className="weight-control"><input type="range" min="0" max="60" value={value} onChange={e => setWeights(current => ({ ...current, [key]: Number(e.target.value) }))} /><b>{value}%</b></div></label>)}</div><div className={`weight-total ${Object.values(weights).reduce((a, b) => a + b, 0) === 100 ? 'valid' : 'invalid'}`}>Total weights <b>{Object.values(weights).reduce((a, b) => a + b, 0)}%</b>{Object.values(weights).reduce((a, b) => a + b, 0) !== 100 && <small>Weights are normalized by the scoring service.</small>}</div><div className="formula-card"><b>How the score works</b><p>Urgency, backlog and workload are scaled to 0–1 against pending requests. Route difficulty is converted from its 1–5 scale to 0–1. Weighted factors produce a score from 0 to 100; directors make every final allocation.</p></div><div className="availability-list"><b>Expert availability</b>{experts.map(expert => <div key={expert.user_id}><span>{expert.name}<small>{expert.skills || 'General delivery'}</small></span><button className={expert.available ? 'available-on' : 'available-off'} onClick={() => toggleExpert(expert)}>{expert.available ? 'Available' : 'Unavailable'}</button></div>)}</div></section><section className="panel"><PanelHeading title="Priority ranking" subtitle={generated ? `${recommendations.length} requests ranked from live records` : 'Generate recommendations to see ranked requests'} />{!generated ? <div className="allocation-empty"><div className="empty-art"><Sparkles size={27} /></div><b>Ready when you are</b><p>Recommendations will use real pending requests, expert availability and recorded allocation constraints.</p><button className="button button-primary" onClick={generate}><Sparkles size={16} /> Generate recommendations</button></div> : recommendations.length ? <div className="recommendation-list">{recommendations.map(item => <RecommendationRow key={item.request_id} item={item} experts={experts} onAllocate={allocate} />)}</div> : <EmptyState text="No pending replacement requests need a recommendation." />}</section></div></>
}

function RecommendationRow({ item, experts, onAllocate }: { item: AllocationRecommendation; experts: any[]; onAllocate: (item: AllocationRecommendation, expert: number | null, reason: string) => void }) {
  const [expert, setExpert] = useState(String(item.expert_id ?? ''))
  const [override, setOverride] = useState('')
  const isOverride = Boolean(expert) && Number(expert) !== item.expert_id
  const confirmAllocation = () => {
    const selected = item.eligible_experts.find(candidate => candidate.user_id === Number(expert))
    if (selected && window.confirm(`Approve ${selected.name} for ${item.unit_name} request #${item.request_id}?`)) {
      onAllocate(item, Number(expert), override)
    }
  }
  return <div className="recommendation-row"><div className="recommendation-main"><span className={`priority-label priority-${item.priority.toLowerCase()}`}><i />{item.priority}</span><div><b>Request #{item.request_id} <span>· {item.unit_name} · {item.uncovered_rounds} uncovered rounds</span></b><small>Score <strong>{item.priority_score.toFixed(1)}</strong> / 100 · {item.request_date}</small></div><div className="score-meter"><span style={{ width: `${item.priority_score}%` }} /></div></div><div className="reasoning"><Sparkles size={14} />{item.reasoning}</div><div className="recommendation-controls"><label>Eligible expert<select value={expert} onChange={e => setExpert(e.target.value)}><option value="">No eligible expert</option>{item.eligible_experts.map(e => <option key={e.user_id} value={e.user_id}>{e.name}{e.user_id === item.expert_id ? ' · Recommended' : ''}</option>)}</select></label>{isOverride && <label>Override reason<input value={override} onChange={e => setOverride(e.target.value)} placeholder="Why is this override needed?" /></label>}<button disabled={!expert || isOverride && override.trim().length < 8} className="button button-dark" onClick={confirmAllocation}><Check size={15} /> Approve</button></div></div>
}

function Assignments({ user, toast }: { user: User; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [assignments, setAssignments] = useState<any[]>([])
  const [report, setReport] = useState<any>(null)
  const load = useCallback(() => api<any[]>('/assignments').then(setAssignments).catch(e => toast(errorText(e), 'error')), [toast])
  useEffect(() => { load() }, [load])
  const update = async (id: number, status: string) => { try { await api(`/assignments/${id}?status=${encodeURIComponent(status)}`, json('PATCH')); toast(`Assignment marked ${status.toLowerCase()}.`); load() } catch (e) { toast(errorText(e), 'error') } }
  return <><div className="page-intro"><div><h2>Your delivery rounds</h2><p>Review approved route knowledge, get the work done, and tell your unit how delivery went.</p></div><span className="date-chip"><Clock3 size={15} /> Today · {new Date().toLocaleDateString('en-GB')}</span></div>{assignments.length ? <div className="assignment-grid">{assignments.map(a => <div className="assignment-card" key={a.id}><div className="assignment-top"><span className="route-tag">{a.route_code || 'ROUTE'}</span><span className={`status-pill status-${a.status.toLowerCase().replaceAll(' ', '-')}`}>{a.status}</span></div><h3>{a.route}</h3><p>{a.unit} <span>·</span> {a.date}</p><div className="assignment-meta"><span><Clock3 size={15} /> {Math.floor((a.duration_minutes ?? 0) / 60)}h {(a.duration_minutes ?? 0) % 60}m</span><span><Truck size={15} /> {a.parcel_volume ?? '—'} parcels</span><span>Difficulty {a.difficulty ?? '—'} / 5</span></div><div className="assignment-manager"><small>Assigned manager</small><b>{a.manager_contact || 'Contact your postal unit'}</b><span><BookOpen size={14} /> Approved notebook available</span></div><div className="assignment-actions"><Link className="button button-secondary" to={`/notebooks/${a.route_id}`}><BookOpen size={15} /> Open Smart Notebook</Link>{a.status === 'Assigned' && <button className="button button-primary" onClick={() => update(a.id, 'In Progress')}>Start delivery</button>}{a.status === 'In Progress' && <><button className="button button-secondary" onClick={() => setReport(a)}>Complete delivery</button><Link className="text-link button-as-link" to={`/notebooks/${a.route_id}`}>Report a problem</Link></>}{a.report_id && <span className="success-text"><Check size={15} /> Delivery report submitted</span>}</div></div>)}</div> : <EmptyState text="No delivery rounds are assigned to your account yet." />}{report && <Modal title="Complete delivery report" onClose={() => setReport(null)}><DeliveryForm allocation={report} toast={toast} onDone={() => { setReport(null); load() }} /></Modal>}</>
}

function Reports({ user, toast }: { user: User; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [reports, setReports] = useState<any[]>([])
  useEffect(() => { api<any[]>('/delivery-reports').then(setReports).catch(e => toast(errorText(e), 'error')) }, [toast])
  const total = reports.reduce((sum, r) => sum + r.assigned, 0)
  return <><div className="page-intro"><div><h2>Delivery outcomes</h2><p>Completion and failure reasons reported by replacement experts.</p></div></div><div className="summary-strip"><span><b>{reports.length}</b> Reports</span><span><b>{total}</b> Parcels assigned</span><span><b>{reports.reduce((sum, r) => sum + r.undelivered, 0)}</b> Postponed parcels</span><span><b>{total ? money(reports.reduce((sum, r) => sum + r.delivered, 0) / total * 100) : '—'}</b> Completion rate</span></div><div className="panel table-panel">{reports.length ? <table className="data-table"><thead><tr><th>Report</th><th>Route</th><th>Assigned</th><th>Delivered</th><th>Undelivered</th><th>Failure reasons</th><th>Comments</th></tr></thead><tbody>{reports.map(r => <tr key={r.id}><td>DR-{String(r.id).padStart(4, '0')}</td><td>{r.route}</td><td>{r.assigned}</td><td><span className="success-text">{r.delivered}</span></td><td><span className={r.undelivered ? 'warning-text' : ''}>{r.undelivered}</span></td><td>{r.failures.map((f: any) => `${f.reason} (${f.parcel_count})`).join(', ') || '—'}</td><td>{r.comments || '—'}</td></tr>)}</tbody></table> : <EmptyState text={user.role === 'expert' ? 'Submit your first delivery report from My Assignments.' : 'Delivery reports will appear here when experts submit them.'} />}</div></>
}

function Analytics() {
  const [data, setData] = useState<any>(null)
  const [error, setError] = useState('')
  const [units, setUnits] = useState<any[]>([])
  const [routes, setRoutes] = useState<Route[]>([])
  const [assignments, setAssignments] = useState<any[]>([])
  const [filters, setFilters] = useState({ start_date: '', end_date: '', unit_id: '', route_id: '', employee_id: '' })
  useEffect(() => {
    api<any[]>('/units').then(setUnits).catch(e => setError(errorText(e)))
    api<Route[]>('/routes').then(setRoutes).catch(e => setError(errorText(e)))
    api<any[]>('/assignments').then(setAssignments).catch(e => setError(errorText(e)))
  }, [])
  useEffect(() => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value))
    api(`/analytics${query.size ? `?${query}` : ''}`).then(setData).catch(e => setError(errorText(e)))
  }, [filters])
  const filteredRoutes = routes.filter(route => !filters.unit_id || String(route.unit_id) === filters.unit_id)
  const filteredAssignments = assignments.filter(item =>
    (!filters.unit_id || item.unit === units.find(unit => String(unit.id) === filters.unit_id)?.name)
    && (!filters.route_id || String(item.route_id) === filters.route_id),
  )
  const employeeOptions = [...new Map(filteredAssignments.map(item => [item.expert_id, item.expert])).entries()]
  if (error) return <ErrorState message={error} />
  if (!data) return <LoadingCard />
  const statusData = Object.entries(data.allocation_status).map(([name, value]) => ({ name, value }))
  const palette = ['#FFCB05', '#172B4D', '#F08A42', '#67B88A', '#AFB9C9']
  return <><div className="page-intro"><div><h2>Operational performance</h2><p>Record-backed views of requests, delivery outcomes and route knowledge.</p></div><button className="button button-secondary" onClick={() => setFilters({ start_date: '', end_date: '', unit_id: '', route_id: '', employee_id: '' })}>Clear filters</button></div><div className="analytics-filters"><label>From<input type="date" max={filters.end_date || undefined} value={filters.start_date} onChange={e => setFilters(current => ({ ...current, start_date: e.target.value }))} /></label><label>To<input type="date" min={filters.start_date || undefined} value={filters.end_date} onChange={e => setFilters(current => ({ ...current, end_date: e.target.value }))} /></label><label>Postal unit<select value={filters.unit_id} onChange={e => setFilters(current => ({ ...current, unit_id: e.target.value, route_id: '', employee_id: '' }))}><option value="">All units</option>{units.map(unit => <option key={unit.id} value={unit.id}>{unit.name}</option>)}</select></label><label>Route<select value={filters.route_id} onChange={e => setFilters(current => ({ ...current, route_id: e.target.value, employee_id: '' }))}><option value="">All routes</option>{filteredRoutes.map(route => <option key={route.id} value={route.id}>{route.code} · {route.name}</option>)}</select></label><label>Employee<select value={filters.employee_id} onChange={e => setFilters(current => ({ ...current, employee_id: e.target.value }))}><option value="">All employees</option>{employeeOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label></div><div className="analytics-kpis"><Metric label="Total replacement requests" value={data.total_requests} /><Metric label="Available experts" value={data.available_experts} /><Metric label="Coverage rate" value={money(data.coverage_rate)} /><Metric label="Postponed parcels" value={data.postponed_parcels} /><Metric label="Delivery completion" value={money(data.completion_rate)} /><Metric label="Avg. allocation time" value={data.average_allocation_time_minutes === null ? 'Not recorded' : `${data.average_allocation_time_minutes} min`} /></div><div className="dashboard-grid analytics-charts"><section className="panel chart-panel"><PanelHeading title="Route performance" subtitle="Delivery completion by postal unit" /><div className="chart-area">{data.completion_by_unit.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.completion_by_unit} margin={{ top: 10, right: 12, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" /><XAxis dataKey="unit" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 11 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="completion_rate" fill="#FFCB05" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState text="No delivery data yet." />}</div></section><section className="panel chart-panel"><PanelHeading title="Allocation status" subtitle="Current request distribution" /><div className="chart-area donut-area">{data.total_requests ? <><ResponsiveContainer width="58%" height="100%"><PieChart><Pie data={statusData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={82} paddingAngle={4}>{statusData.map((_entry: any, i: number) => <Cell key={i} fill={palette[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="chart-legend">{statusData.map((item: any, i: number) => <span key={item.name}><i style={{ background: palette[i] }} />{item.name}<b>{item.value}</b></span>)}</div></> : <EmptyState text="No request records." />}</div></section></div><div className="dashboard-grid"><section className="panel chart-panel"><PanelHeading title="Delivery failure analysis" subtitle="Undelivered parcels grouped by reported reason" /><div className="chart-area">{data.failure_reasons.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.failure_reasons} layout="vertical" margin={{ top: 4, right: 12, bottom: 0, left: 15 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#edf0f5" /><XAxis type="number" allowDecimals={false} axisLine={false} tickLine={false} /><YAxis dataKey="reason" type="category" width={130} axisLine={false} tickLine={false} tick={{ fill: '#647087', fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#F08A42" radius={[0, 5, 5, 0]} /></BarChart></ResponsiveContainer> : <EmptyState text="Failure reasons will appear after reports are submitted." />}</div></section><section className="panel chart-panel"><PanelHeading title="Notebook completeness" subtitle="Route knowledge quality by postal unit" /><div className="chart-area">{data.notebook_completeness.length ? <ResponsiveContainer width="100%" height="100%"><BarChart data={data.notebook_completeness} margin={{ top: 10, right: 10, bottom: 0, left: -18 }}><CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#edf0f5" /><XAxis dataKey="unit" axisLine={false} tickLine={false} tick={{ fill: '#8b94a5', fontSize: 10 }} /><YAxis domain={[0, 100]} axisLine={false} tickLine={false} /><Tooltip /><Bar dataKey="completeness" fill="#5D9D88" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <EmptyState text="No notebooks are available." />}</div></section></div></>
}

function Notifications({ toast }: { toast: (text: string, kind?: Toast['kind']) => void }) {
  const [items, setItems] = useState<any[]>([])
  const load = useCallback(() => api<any[]>('/notifications').then(setItems).catch(e => toast(errorText(e), 'error')), [toast])
  useEffect(() => { load() }, [load])
  const markRead = async (id: number) => { try { await api(`/notifications/${id}/read`, json('PATCH')); load() } catch (e) { toast(errorText(e), 'error') } }
  return <><div className="page-intro"><div><h2>Your notifications</h2><p>Stay on top of approvals, route assignments and notebook changes.</p></div><span className="date-chip">{items.filter(i => !i.read).length} unread</span></div><div className="panel notification-list">{items.length ? items.map(item => <div key={item.id} className={`notification-row ${item.read ? 'is-read' : ''}`}><span className="notification-icon"><Bell size={17} /></span><div><Link to={item.link}><b>{item.message}</b></Link><small>{dateLabel(item.created_at)}</small></div>{!item.read && <button className="button button-secondary" onClick={() => markRead(item.id)}>Mark as read</button>}</div>) : <EmptyState text="You're all caught up. New activity will appear here." />}</div></>
}

function SettingsPage({ user }: { user: User }) {
  return <><div className="page-intro"><div><h2>Workspace settings</h2><p>Your demo profile, access level and configuration guidance.</p></div></div><div className="settings-grid"><section className="panel settings-card"><PanelHeading title="Your profile" subtitle="Authenticated account details" /><div className="settings-profile"><span className="avatar avatar-large">{initials(user.name)}</span><div><h3>{user.name}</h3><span>{user.email}</span></div></div><div className="settings-line"><span>Access role</span><b>{roleLabel(user.role)}</b></div><div className="settings-line"><span>Postal unit</span><b>{user.unit_id ? `Unit #${user.unit_id}` : 'All operations'}</b></div><div className="settings-line"><span>Authentication</span><b><ShieldCheck size={15} /> Secure demo session</b></div></section><section className="panel settings-card"><PanelHeading title="Allocation scoring" subtitle="Editable proposed assumptions" /><p className="muted">Directors can update the proposed weights in Smart Allocation. They are demonstration assumptions only, not validated La Poste policy.</p><div className="formula-card"><b>Urgency · 30%</b><p>Urgent deliveries as a proportion of the highest pending request.</p><b>Existing backlog · 30%</b><p>Current backlog relative to the maximum pending request.</p><b>Workload · 25%</b><p>Absent employees plus uncovered rounds, normalized to pending requests.</p><b>Route difficulty · 15%</b><p>Difficulty recorded on a 1–5 scale.</p></div></section><section className="panel settings-card warning-settings"><PanelHeading title="Prototype safety" subtitle="Please read before any demonstration" /><div className="warning-box"><AlertTriangle size={18} /><p>SmartRoute is a university prototype. Demo records are fictional. This application is not approved for production use at La Poste and must not be used to store real access codes or sensitive personal data.</p></div></section></div></>
}

function RequestTable({ requests, detailed = false, onReview, onDetails }: { requests: any[]; detailed?: boolean; onReview?: (id: number, status: string) => void; onDetails?: (request: any) => void }) {
  if (!requests.length) return <EmptyState text="No replacement requests found." />
  return <div className="table-scroll"><table className="data-table"><thead><tr><th>Request ID</th><th>Postal unit</th><th>Date</th><th>Uncovered</th><th>Parcel volume</th><th>Backlog</th>{detailed && <th>Urgency</th>}<th>Priority</th><th>Score</th><th>Status</th>{(onReview || onDetails) && <th>Actions</th>}</tr></thead><tbody>{requests.map(r => <tr key={r.id}><td><b>REQ-{String(r.id).padStart(4, '0')}</b></td><td>{r.unit}</td><td>{r.request_date}</td><td>{r.uncovered_rounds} rounds</td><td>{r.parcel_volume}</td><td>{r.backlog}</td>{detailed && <td><span className={`urgency-chip ${r.urgent_deliveries > 10 ? 'urgent' : ''}`}>{r.urgent_deliveries} urgent</span></td>}<td>{r.priority ? <span className={`priority-label priority-${r.priority.toLowerCase()}`}>{r.priority}</span> : '—'}</td><td>{r.priority_score === null || r.priority_score === undefined ? '—' : `${r.priority_score.toFixed(1)} / 100`}</td><td><span className={`status-pill status-${r.status.toLowerCase().replaceAll(' ', '-')}`}>{r.status}</span></td>{(onReview || onDetails) && <td><div className="table-actions">{onDetails && <button onClick={() => onDetails(r)}>Details</button>}{onReview && r.status === 'Pending' && <button onClick={() => onReview(r.id, 'Under Review')}>Review</button>}{onReview && ['Pending', 'Under Review'].includes(r.status) && <button className="reject-action" onClick={() => onReview(r.id, 'Rejected')}>Reject</button>}</div></td>}</tr>)}</tbody></table></div>
}

function RequestDetails({ request }: { request: any }) {
  const details = [
    ['Requesting unit', request.unit], ['Request date', request.request_date],
    ['Absent employees', request.absent_employees], ['Uncovered rounds', request.uncovered_rounds],
    ['Estimated parcel volume', request.parcel_volume], ['Existing backlog', request.backlog],
    ['Urgent deliveries', request.urgent_deliveries], ['Route difficulty', `${request.route_difficulty} / 5`],
    ['Priority score', request.priority_score === null ? 'Not ranked' : `${request.priority_score} / 100`],
    ['Comments', request.comments || 'No additional comments.'],
  ]
  return <div className="request-detail-list">{details.map(([label, value]) => <div key={label}><span>{label}</span><b>{value}</b></div>)}</div>
}

function RequestForm({ toast, onDone }: { toast: (text: string, kind?: Toast['kind']) => void; onDone: () => void }) {
  const [form, setForm] = useState({ request_date: new Date().toISOString().slice(0, 10), absent_employees: 1, uncovered_rounds: 1, parcel_volume: 60, backlog: 10, urgent_deliveries: 0, route_difficulty: 3, comments: '' })
  const [busy, setBusy] = useState(false)
  const submit = async (e: FormEvent) => { e.preventDefault(); setBusy(true); try { await api('/requests', json('POST', form)); toast('Replacement request submitted to the area director.'); onDone() } catch (err) { toast(errorText(err), 'error') } finally { setBusy(false) } }
  return <form className="form-grid" onSubmit={submit}><label>Request date<input type="date" required value={form.request_date} onChange={e => setForm({ ...form, request_date: e.target.value })} /></label><label>Absent employees<input type="number" min="0" required value={form.absent_employees} onChange={e => setForm({ ...form, absent_employees: Number(e.target.value) })} /></label><label>Uncovered delivery rounds<input type="number" min="0" required value={form.uncovered_rounds} onChange={e => setForm({ ...form, uncovered_rounds: Number(e.target.value) })} /></label><label>Parcel volume<input type="number" min="0" required value={form.parcel_volume} onChange={e => setForm({ ...form, parcel_volume: Number(e.target.value) })} /></label><label>Existing backlog<input type="number" min="0" required value={form.backlog} onChange={e => setForm({ ...form, backlog: Number(e.target.value) })} /></label><label>Urgent deliveries<input type="number" min="0" required value={form.urgent_deliveries} onChange={e => setForm({ ...form, urgent_deliveries: Number(e.target.value) })} /></label><label>Route difficulty<select value={form.route_difficulty} onChange={e => setForm({ ...form, route_difficulty: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(x => <option key={x} value={x}>{x} / 5</option>)}</select></label><label className="form-full">Additional comments<textarea rows={3} maxLength={2000} value={form.comments} onChange={e => setForm({ ...form, comments: e.target.value })} /></label><div className="modal-actions"><button type="button" className="button button-secondary" onClick={onDone}>Cancel</button><button disabled={busy} className="button button-primary">{busy ? 'Submitting…' : 'Submit replacement request'}</button></div></form>
}

function IssueForm({ routeId, onDone, toast }: { routeId: number; onDone: (message: string) => void; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [form, setForm] = useState({ route_id: routeId, title: '', description: '', category: 'Access', priority: 'Medium' })
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await api('/issues', json('POST', form)); onDone('Route difficulty reported to the unit manager.') } catch (err) { toast(errorText(err), 'error') } }
  return <form className="form-grid" onSubmit={submit}><label>Issue title<input required minLength={3} value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} /></label><label>Category<select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>{['Access', 'Navigation', 'Safety', 'Construction', 'Other'].map(x => <option key={x}>{x}</option>)}</select></label><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}>{['Low', 'Medium', 'High', 'Critical'].map(x => <option key={x}>{x}</option>)}</select></label><label className="form-full">Description<textarea required minLength={3} rows={4} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div className="modal-actions"><button className="button button-primary">Submit issue</button></div></form>
}

function ChangeForm({ routeId, onDone, toast }: { routeId: number; onDone: () => void; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [form, setForm] = useState({ route_id: routeId, field: 'instructions', value: '' })
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await api('/notebook-changes', json('POST', form)); onDone() } catch (err) { toast(errorText(err), 'error') } }
  return <form className="form-grid" onSubmit={submit}><label>Information section<select value={form.field} onChange={e => setForm({ ...form, field: e.target.value })}>{[['description', 'Route description'], ['sequence', 'Recommended sequence'], ['obstacles', 'Known obstacles'], ['instructions', 'Special instructions']].map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="form-full">Proposed information<textarea required minLength={1} maxLength={5000} rows={5} value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} /></label><div className="form-hint">This suggestion stays unpublished until a unit manager approves it.</div><div className="modal-actions"><button className="button button-primary">Submit for approval</button></div></form>
}

function RouteCreateForm({ toast, onDone }: { toast: (text: string, kind?: Toast['kind']) => void; onDone: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', duration_minutes: 360, parcel_volume: 0, difficulty: 3, description: '' })
  const submit = async (e: FormEvent) => { e.preventDefault(); try { await api('/routes', json('POST', form)); toast('Route notebook created.'); onDone() } catch (err) { toast(errorText(err), 'error') } }
  return <form className="form-grid" onSubmit={submit}><label>Route ID<input required minLength={2} maxLength={20} pattern="[A-Za-z0-9-]+" placeholder="R-13" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} /></label><label>Route name<input required minLength={2} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Estimated duration (minutes)<input type="number" min="30" max="1000" value={form.duration_minutes} onChange={e => setForm({ ...form, duration_minutes: Number(e.target.value) })} /></label><label>Estimated parcels<input type="number" min="0" value={form.parcel_volume} onChange={e => setForm({ ...form, parcel_volume: Number(e.target.value) })} /></label><label>Difficulty<select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map(x => <option key={x} value={x}>{x} / 5</option>)}</select></label><label className="form-full">Route description<textarea rows={3} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label><div className="form-hint form-full">This notebook is created in your postal unit. Instructions can be added and reviewed next.</div><div className="modal-actions"><button className="button button-primary">Create notebook</button></div></form>
}

function BuildingForm({ routeId, building, onDone, toast }: { routeId: number; building?: any; onDone: () => void; toast: (text: string, kind?: Toast['kind']) => void }) {
  const [form, setForm] = useState({ route_id: routeId, name: building?.name ?? '', address: building?.address ?? '', entrance: building?.entrance ?? '', access_instructions: building?.access_instructions ?? '', delivery_instructions: building?.delivery_instructions ?? '', difficulties: building?.difficulties ?? '', notes: building?.notes ?? '' })
  const submit = async (e: FormEvent) => { e.preventDefault(); try { if (building) { const { route_id: _routeId, ...updates } = form; await api(`/buildings/${building.id}`, json('PATCH', updates)) } else await api('/buildings', json('POST', form)); onDone() } catch (err) { toast(errorText(err), 'error') } }
  return <form className="form-grid" onSubmit={submit}><label>Building name<input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label>Street address<input required value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} /></label><label>Entrance location<input value={form.entrance} onChange={e => setForm({ ...form, entrance: e.target.value })} /></label><label>Access instructions<input value={form.access_instructions} onChange={e => setForm({ ...form, access_instructions: e.target.value })} /></label><label className="form-full">Delivery instructions<textarea rows={2} value={form.delivery_instructions} onChange={e => setForm({ ...form, delivery_instructions: e.target.value })} /></label><label className="form-full">Known difficulties<textarea rows={2} value={form.difficulties} onChange={e => setForm({ ...form, difficulties: e.target.value })} /></label><label className="form-full">Additional notes<textarea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></label><div className="form-hint form-full">Do not enter door codes or sensitive personal information.</div><div className="modal-actions"><button className="button button-primary">{building ? 'Save building changes' : 'Save building entry'}</button></div></form>
}

function DeliveryForm({ allocation, toast, onDone }: { allocation: any; toast: (text: string, kind?: Toast['kind']) => void; onDone: () => void }) {
  const [assigned, setAssigned] = useState(allocation.parcel_volume ?? 0)
  const [delivered, setDelivered] = useState(allocation.parcel_volume ?? 0)
  const [failures, setFailures] = useState([{ reason: 'Recipient unavailable', parcel_count: 0 }])
  const [comments, setComments] = useState('')
  const [busy, setBusy] = useState(false)
  const undelivered = Math.max(0, assigned - delivered)
  const resizeFailures = (total: number) => setFailures(current => {
    let remaining = total
    const next = current.map((failure, index) => {
      if (index === 0) return failure
      const parcel_count = Math.min(failure.parcel_count, remaining)
      remaining -= parcel_count
      return { ...failure, parcel_count }
    })
    next[0] = { ...next[0], parcel_count: remaining }
    return next
  })
  const updateFailureCount = (index: number, count: number) => setFailures(current => {
    const next = current.map(item => ({ ...item }))
    const otherTotal = next.reduce((sum, item, i) => sum + (i === index ? 0 : item.parcel_count), 0)
    next[index].parcel_count = Math.max(0, Math.min(Math.floor(count), undelivered - otherTotal))
    if (index > 0) next[0].parcel_count = undelivered - next.slice(1).reduce((sum, item) => sum + item.parcel_count, 0)
    return next
  })
  const addFailure = () => {
    if (undelivered <= failures.length) return
    setFailures(current => [{ ...current[0], parcel_count: current[0].parcel_count - 1 }, ...current.slice(1), { reason: 'Other', parcel_count: 1 }])
  }
  const removeFailure = (index: number) => setFailures(current => {
    const removed = current[index]
    const next = current.filter((_item, i) => i !== index)
    next[0] = { ...next[0], parcel_count: next[0].parcel_count + removed.parcel_count }
    return next
  })
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api('/delivery-reports', json('POST', {
        allocation_id: allocation.id, assigned, delivered, undelivered, comments,
        failures: failures.filter(item => item.parcel_count > 0),
      }))
      toast('Delivery report saved. Dashboard figures are now updated.')
      onDone()
    } catch (err) { toast(errorText(err), 'error') } finally { setBusy(false) }
  }
  return <form className="form-grid" onSubmit={submit}><div className="report-route-summary"><span className="route-tag">{allocation.route_code}</span><b>{allocation.route}</b><small>{allocation.unit}</small></div><label>Assigned parcels<input type="number" min="0" required value={assigned} onChange={e => { const next = Math.max(0, Number(e.target.value)); setAssigned(next); const nextDelivered = Math.min(delivered, next); setDelivered(nextDelivered); resizeFailures(next - nextDelivered) }} /></label><label>Successfully delivered<input type="number" min="0" max={assigned} required value={delivered} onChange={e => { const next = Math.max(0, Math.min(assigned, Number(e.target.value))); setDelivered(next); resizeFailures(assigned - next) }} /></label><div className="report-total">Undelivered <b>{undelivered}</b></div>{undelivered > 0 && <div className="failure-editor form-full"><div className="failure-heading"><b>Failure reasons</b><button type="button" className="text-link button-as-link" disabled={undelivered <= failures.length} onClick={addFailure}>+ Add another reason</button></div>{failures.map((failure, index) => <div className="failure-row" key={index}><select aria-label="Failure reason" value={failure.reason} onChange={e => setFailures(current => current.map((item, i) => i === index ? { ...item, reason: e.target.value } : item))}>{['Incorrect address', 'Building inaccessible', 'Navigation difficulty', 'Insufficient time', 'Recipient unavailable', 'Other'].map(x => <option key={x}>{x}</option>)}</select><input aria-label="Parcels for reason" type="number" min="0" max={undelivered} value={failure.parcel_count} readOnly={index === 0} onChange={e => updateFailureCount(index, Number(e.target.value))} />{index > 0 && <button type="button" className="icon-quiet" aria-label="Remove failure reason" onClick={() => removeFailure(index)}><X size={15} /></button>}</div>)}<small>Failure reason parcel counts total {failures.reduce((sum, item) => sum + item.parcel_count, 0)} of {undelivered} undelivered.</small></div>}<label className="form-full">Additional comments<textarea rows={2} maxLength={2000} value={comments} onChange={e => setComments(e.target.value)} /></label><p className="form-hint form-full">Counts are validated by the backend. Failure-reason totals must equal undelivered parcels.</p><div className="modal-actions"><button disabled={busy} className="button button-primary">{busy ? 'Saving…' : 'Submit delivery report'}</button></div></form>
}

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return <div className="modal-backdrop" onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}><section className="modal"><div className="modal-heading"><div><span className="eyebrow">SMARTROUTE WORKFLOW</span><h2>{title}</h2></div><button className="icon-button" onClick={onClose}><X size={18} /></button></div>{children}</section></div>
}

function GlobalSearch({ onGo }: { onGo: (path: string) => void }) {
  const [value, setValue] = useState('')
  const location = useLocation()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (value.trim()) { onGo(`/notebooks?q=${encodeURIComponent(value.trim())}`); setValue('') }
  }
  useEffect(() => {
    const handle = (event: KeyboardEvent) => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); document.getElementById('global-search')?.focus() } }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [])
  return <form className="global-search" onSubmit={submit}><Search size={17} /><input id="global-search" value={value} onChange={e => setValue(e.target.value)} placeholder="Search routes…" /><kbd>⌘ K</kbd><span className="sr-only">{location.pathname}</span></form>
}

function UnreadDot() {
  const [unread, setUnread] = useState(false)
  useEffect(() => { if (localStorage.getItem('smartroute_token')) api<any[]>('/notifications').then(data => setUnread(data.some(n => !n.read))).catch(() => undefined) }, [])
  return unread ? <i className="unread-dot" /> : null
}

function PanelHeading({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return <div className="panel-heading"><div><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>{action}</div>
}
function Metric({ label, value }: { label: string; value: ReactNode }) { return <div className="metric"><span>{label}</span><b>{value}</b></div> }
function StatBox({ value, label, icon }: { value: ReactNode; label: string; icon: ReactNode }) { return <div className="stat-box"><span>{icon}</span><div><b>{value}</b><small>{label}</small></div></div> }
function LoadingCard() { return <div className="panel loading-card"><div className="spinner" /> Loading records…</div> }
function ErrorState({ message }: { message: string }) { return <div className="panel empty-state"><AlertTriangle size={23} /><b>We couldn’t load this information</b><p>{message}</p><small>Check that the SmartRoute API is running, then refresh.</small></div> }
function EmptyState({ text }: { text: string }) { return <div className="empty-state"><div className="empty-icon"><FileText size={20} /></div><b>Nothing here yet</b><p>{text}</p></div> }
function initials(name: string) { return name.split(/\s+/).slice(0, 2).map(part => part[0]).join('').toUpperCase() }
function roleLabel(role: string) { return ({ director: 'Area director', manager: 'Unit manager', postman: 'Regular postman', expert: 'Expert replacement' } as Record<string, string>)[role] ?? role }
function dateLabel(value: string) { return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) }
function errorText(error: unknown) { return error instanceof Error ? error.message : 'Something went wrong.' }
function weightDescription(key: string) { return ({ urgency: 'Urgent delivery volume', backlog: 'Existing postponed work', workload: 'Absences and uncovered routes', difficulty: 'Recorded route difficulty' } as Record<string, string>)[key] }
