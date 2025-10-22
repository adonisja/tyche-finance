
import React, { useEffect, useRef } from 'react';
import { useAnalytics } from '../hooks/useAnalytics';
import { useAuth } from '../hooks/useAuth';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import '../pages/AnalyticsPage.css';
import * as d3 from 'd3';


export default function AnalyticsPage() {
  const { progress, goals, snapshots, loading, error, refreshProgress } = useAnalytics();
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="dashboard-container">
      <nav className="dashboard-nav">
        <h1>💎 Tyche</h1>
        <div className="nav-links">
          <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
          <Link to="/cards" className={location.pathname === '/cards' ? 'active' : ''}>Cards</Link>
          <Link to="/budget" className={location.pathname === '/budget' ? 'active' : ''}>Budget</Link>
          <Link to="/spending" className={location.pathname.startsWith('/spending') ? 'active' : ''}>Spending</Link>
          <Link to="/chat" className={location.pathname === '/chat' ? 'active' : ''}>AI Chat</Link>
          <Link to="/analytics" className={location.pathname === '/analytics' ? 'active' : ''}>Analytics</Link>
        </div>
        <div className="nav-right">
          <span className="user-email">{user?.email}</span>
          <button onClick={logout} className="btn-logout">Logout</button>
        </div>
      </nav>

      <div className="analytics-page">
        <header className="analytics-header">
          <p>Visualize your financial progress, goals, and spending insights powered by AI.</p>
          <button onClick={refreshProgress} disabled={loading} className="btn-refresh-analytics">
            {loading ? 'Refreshing...' : '🔄 Refresh Analytics'}
          </button>
        </header>
        {error && <div className="analytics-error">❌ {error}</div>}
        <section className="analytics-content">
          {loading && <div>Loading analytics...</div>}
          {!loading && progress && (
            <>
              {/* Summary Stat Cards */}
              <div className="analytics-summary-cards" style={{display:'flex',gap:'1rem',flexWrap:'wrap',marginBottom:'1.5rem'}}>
                <div className="stat-card"><div className="stat-label">Total Snapshots</div><div className="stat-value">{progress.summary?.totalSnapshots ?? 0}</div></div>
                <div className="stat-card"><div className="stat-label">Active Goals</div><div className="stat-value">{progress.summary?.activeGoals ?? 0}</div></div>
                <div className="stat-card"><div className="stat-label">Completed Goals</div><div className="stat-value">{progress.summary?.completedGoals ?? 0}</div></div>
                <div className="stat-card"><div className="stat-label">First Snapshot</div><div className="stat-value">{progress.summary?.firstSnapshotDate ? new Date(progress.summary.firstSnapshotDate).toLocaleDateString() : '-'}</div></div>
                <div className="stat-card"><div className="stat-label">Latest Snapshot</div><div className="stat-value">{progress.summary?.latestSnapshotDate ? new Date(progress.summary.latestSnapshotDate).toLocaleDateString() : '-'}</div></div>
              </div>
              {/* Spending Trends D3 Line Chart */}
              <TrendsChart trends={progress.trends} />
              {/* Financial Goals Progress Bars */}
              <div className="analytics-section">
                <h2>Financial Goals</h2>
                {Array.isArray(progress.goals) && progress.goals.length > 0 ? (
                  <div style={{display:'flex',flexDirection:'column',gap:'1rem'}}>
                    {progress.goals.map((goal:any) => (
                      <div key={goal.id} style={{background:'#f3f4f6',padding:'1rem',borderRadius:'8px'}}>
                        <div style={{fontWeight:'bold'}}>{goal.title || goal.type}</div>
                        <div style={{margin:'0.5rem 0'}}>{goal.description}</div>
                        <div style={{display:'flex',alignItems:'center',gap:'1rem'}}>
                          <div style={{flex:1,background:'#ddd',borderRadius:'4px',overflow:'hidden',height:'16px'}}>
                            <div style={{width:`${Math.round((goal.progress||0)*100)}%`,background:'#6d28d9',height:'100%'}}></div>
                          </div>
                          <span style={{minWidth:'40px',textAlign:'right'}}>{Math.round((goal.progress||0)*100)}%</span>
                        </div>
                        <div style={{fontSize:'0.9em',color:'#666'}}>Status: {goal.status}</div>
                      </div>
                    ))}
                  </div>
                ) : <div>No goals found.</div>}
              </div>
              {/* Milestones as Badges */}
              <div className="analytics-section">
                <h2>Milestones</h2>
                {Array.isArray(progress.milestones) && progress.milestones.length > 0 ? (
                  <div style={{display:'flex',gap:'0.5rem',flexWrap:'wrap'}}>
                    {progress.milestones.map((m:string,i:number) => (
                      <span key={i} style={{background:'#e0e7ff',color:'#3730a3',padding:'0.4em 1em',borderRadius:'999px',fontWeight:'bold'}}>{m}</span>
                    ))}
                  </div>
                ) : <div>No milestones yet.</div>}
              </div>
              {/* Projections Forecast Card */}
              <div className="analytics-section">
                <h2>Projections</h2>
                {progress.projections ? (
                  <div style={{background:'#f1f5f9',padding:'1rem',borderRadius:'8px'}}>
                    <div>Projected Debt-Free Date: <b>{progress.projections.projectedDebtFreeDate ? new Date(progress.projections.projectedDebtFreeDate).toLocaleDateString() : '-'}</b></div>
                    <div>Months to Debt-Free: <b>{progress.projections.projectedMonthsToDebtFree ?? '-'}</b></div>
                    <div>Based on Avg Monthly Reduction: <b>{progress.projections.basedOnAvgMonthlyReduction ?? '-'}</b></div>
                  </div>
                ) : <div>No projections available.</div>}
              </div>
              {/* Snapshots Table */}
              <div className="analytics-section">
                <h2>Snapshots</h2>
                {Array.isArray(snapshots) && snapshots.length > 0 ? (
                  <table style={{width:'100%',borderCollapse:'collapse',fontSize:'0.95em'}}>
                    <thead>
                      <tr style={{background:'#f3f4f6'}}>
                        <th>Date</th>
                        <th>Total Debt</th>
                        <th>Utilization</th>
                        <th>Cards</th>
                      </tr>
                    </thead>
                    <tbody>
                      {snapshots.map((s:any) => (
                        <tr key={s.id}>
                          <td>{s.snapshotDate ? new Date(s.snapshotDate).toLocaleDateString() : (s.timestamp ? new Date(s.timestamp).toLocaleDateString() : '-')}</td>
                          <td>${s.totalDebt?.toLocaleString() ?? '-'}</td>
                          <td>{s.creditUtilization !== undefined ? (s.creditUtilization*100).toFixed(1)+'%' : '-'}</td>
                          <td>{s.metadata?.cardsCount ?? s.numberOfCards ?? '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <div>No snapshots found.</div>}
              </div>
              {/* AgentKit-powered AI Insights */}
              {progress.agentkit && (
                <div className="analytics-section" style={{background:'#f3f4f6',borderLeft:'6px solid #6d28d9'}}>
                  <h2>AI Insights</h2>
                  <div style={{whiteSpace:'pre-wrap',fontSize:'1.1em',color:'#3730a3'}}>{progress.agentkit}</div>
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

// D3 Line Chart for Spending Trends (debt/utilization over time)
function TrendsChart({ trends }: { trends: any }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!trends || !Array.isArray(trends.debtOverTime) || !ref.current) return;
    // Type-safe data
    type TrendDatum = { date: Date; value: number };
    const data: TrendDatum[] = trends.debtOverTime.map((d: any) => ({
      date: new Date(d.date || d[0]),
      value: typeof d.value === 'number' ? d.value : (typeof d[1] === 'number' ? d[1] : 0)
    }));
    const width = 420, height = 180, margin = {top:20,right:20,bottom:30,left:40};
    // Safely get x domain
    const extent = d3.extent(data, (d: TrendDatum) => d.date);
    const xDomain: [Date, Date] = [
      extent[0] instanceof Date ? extent[0] : new Date(),
      extent[1] instanceof Date ? extent[1] : new Date()
    ];
    const x = d3.scaleTime()
      .domain(xDomain)
      .range([margin.left, width - margin.right]);
    // Safely get y domain
    const maxY = d3.max(data, (d: TrendDatum) => d.value) ?? 1;
    const y = d3.scaleLinear()
      .domain([0, maxY]).nice()
      .range([height - margin.bottom, margin.top]);
    // Clear previous chart
    ref.current.innerHTML = '';
    // Draw axes and line
    const svg = d3.select(ref.current)
      .append('svg')
      .attr('width', width)
      .attr('height', height);
    svg.append('g')
      .attr('transform', `translate(0,${height - margin.bottom})`)
      .call(d3.axisBottom(x).ticks(5));
    svg.append('g')
      .attr('transform', `translate(${margin.left},0)`)
      .call(d3.axisLeft(y));
    svg.append('path')
      .datum(data)
      .attr('fill', 'none')
      .attr('stroke', '#6d28d9')
      .attr('stroke-width', 2)
      .attr('d', d3.line<TrendDatum>()
        .x(d => x(d.date))
        .y(d => y(d.value))
      );
    svg.selectAll('circle')
      .data(data)
      .enter()
      .append('circle')
      .attr('cx', d => x(d.date))
      .attr('cy', d => y(d.value))
      .attr('r', 3)
      .attr('fill', '#6d28d9');
  }, [trends]);
  return (
    <div className="analytics-section">
      <h2>Spending Trends</h2>
      {trends && Array.isArray(trends.debtOverTime) && trends.debtOverTime.length > 0 ? (
        <div ref={ref}></div>
      ) : <div>No trend data available.</div>}
    </div>
  );
}