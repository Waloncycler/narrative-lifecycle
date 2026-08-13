import { useState, useEffect } from 'react';
import { Activity, Radio, LineChart, FileText, Settings, Menu } from 'lucide-react';
import './App.css'; // Wait, I will use index.css for global and module CSS or inline. Actually, I will write plain CSS in App.css for layout.

function App() {
  const [runs, setRuns] = useState<any[]>([]);
  const [diffs, setDiffs] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState('radar');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  useEffect(() => {
    fetch('/api/runs').then(res => res.json()).then(setRuns).catch(console.error);
    fetch('/api/diffs').then(res => res.json()).then(setDiffs).catch(console.error);
  }, []);

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <aside className={`sidebar glass-panel ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <h2 className="text-gradient">Narrative Lifecycle</h2>
          <button className="icon-btn" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
            <Menu size={20} />
          </button>
        </div>
        
        <nav className="sidebar-nav">
          <button className={`nav-item ${activeTab === 'radar' ? 'active' : ''}`} onClick={() => setActiveTab('radar')}>
            <Radio size={20} className="nav-icon" />
            <span className="nav-label">Narrative Radar</span>
          </button>
          <button className={`nav-item ${activeTab === 'runs' ? 'active' : ''}`} onClick={() => setActiveTab('runs')}>
            <Activity size={20} className="nav-icon" />
            <span className="nav-label">System Runs</span>
          </button>
          <button className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`} onClick={() => setActiveTab('reports')}>
            <FileText size={20} className="nav-icon" />
            <span className="nav-label">Reports & Diffs</span>
          </button>
          <button className={`nav-item ${activeTab === 'metrics' ? 'active' : ''}`} onClick={() => setActiveTab('metrics')}>
            <LineChart size={20} className="nav-icon" />
            <span className="nav-label">Metrics</span>
          </button>
        </nav>
        
        <div className="sidebar-footer">
          <button className="nav-item">
            <Settings size={20} className="nav-icon" />
            <span className="nav-label">Settings</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        <header className="topbar glass-panel flex-between">
          <div>
            <h1 className="page-title">
              {activeTab === 'radar' && 'Narrative Radar'}
              {activeTab === 'runs' && 'System Runs'}
              {activeTab === 'reports' && 'Reports & Diffs'}
              {activeTab === 'metrics' && 'Metrics'}
            </h1>
            <p className="page-subtitle">Real-time narrative intelligence</p>
          </div>
          
          <div className="topbar-actions">
            <div className="status-badge flex-center">
              <div className="status-dot"></div>
              <span>System Online</span>
            </div>
          </div>
        </header>

        <div className="content-area animate-fade-in">
          {activeTab === 'radar' && <RadarView diffs={diffs} />}
          {activeTab === 'runs' && <RunsView runs={runs} />}
        </div>
      </main>
    </div>
  );
}

function RadarView({ diffs }: { diffs: any[] }) {
  const latestDiff = diffs[0];
  
  if (!latestDiff) return <div className="loading flex-center">Loading Radar...</div>;

  return (
    <div className="radar-view grid-layout">
      <div className="radar-main glass-panel">
        <h3 className="panel-title">Active Narratives</h3>
        <div className="radar-visualization">
          {/* We will build a custom CSS node graph here */}
          <div className="node-grid">
             {latestDiff.topic_changes?.map((change: any, i: number) => (
                <div key={i} className={`node-item stage-${change.current_stage?.toLowerCase() || 's0'} ${change.promoted ? 'glow-active' : ''}`}>
                  <div className="node-stage">{change.current_stage || 'S0'}</div>
                  <div className="node-label">{change.topic_id}</div>
                  {change.promoted && <div className="node-badge">UPGRADED</div>}
                </div>
             ))}
             {(!latestDiff.topic_changes || latestDiff.topic_changes.length === 0) && (
               <div className="empty-state">No topic changes in latest run.</div>
             )}
          </div>
        </div>
      </div>
      
      <div className="radar-side flex-col">
        <div className="glass-panel summary-panel">
          <h3 className="panel-title">Run Summary</h3>
          <div className="stat-grid">
            <div className="stat-box">
              <span className="stat-label">Topic Changes</span>
              <span className="stat-value">{latestDiff.summary?.topic_count || 0}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Upgrades</span>
              <span className="stat-value text-green">{latestDiff.summary?.stage_upgrade_count || 0}</span>
            </div>
            <div className="stat-box">
              <span className="stat-label">Evidence Added</span>
              <span className="stat-value text-cyan">{latestDiff.summary?.evidence_added_count || 0}</span>
            </div>
          </div>
        </div>
        
        <div className="glass-panel feed-panel">
          <h3 className="panel-title">Recent Activity</h3>
          <ul className="activity-feed">
             {latestDiff.early_radar_changes?.slice(0, 5).map((radar: any, i: number) => (
               <li key={i} className="activity-item">
                 <div className="activity-icon"><Radio size={14} /></div>
                 <div className="activity-content">
                   <div className="activity-title">Radar Alert: {radar.candidate_id}</div>
                   <div className="activity-desc">{radar.reason}</div>
                 </div>
               </li>
             ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RunsView({ runs }: { runs: any[] }) {
  return (
    <div className="runs-view glass-panel">
      <h3 className="panel-title">Execution History</h3>
      <div className="table-responsive">
        <table className="data-table">
          <thead>
            <tr>
              <th>Run ID</th>
              <th>Generated At</th>
              <th>Status</th>
              <th>Guardrails</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run, i) => (
              <tr key={i}>
                <td className="code-font">{run.run_id}</td>
                <td>{new Date(run.generated_at).toLocaleString()}</td>
                <td>
                  <span className={`status-pill ${run.status === 'ok' ? 'ok' : 'error'}`}>
                    {run.status}
                  </span>
                </td>
                <td>{run.guardrails?.length || 0} checks passed</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default App;
