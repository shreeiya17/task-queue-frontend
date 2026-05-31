import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import axios from 'axios';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// ── Colours ───────────────────────────────────────────────────────
const S = {
  waiting:   { bg: '#FFF8ED', text: '#B45309', border: '#F59E0B' },
  active:    { bg: '#EFF6FF', text: '#1D4ED8', border: '#3B82F6' },
  completed: { bg: '#F0FDF4', text: '#15803D', border: '#22C55E' },
  failed:    { bg: '#FEF2F2', text: '#B91C1C', border: '#EF4444' },
  delayed:   { bg: '#F5F3FF', text: '#6D28D9', border: '#8B5CF6' },
  dead:      { bg: '#FFF1F2', text: '#BE123C', border: '#FB7185' },
};

function pri(p) {
  if (p <= 1) return { label: 'CRITICAL', color: '#DC2626' };
  if (p <= 3) return { label: 'HIGH',     color: '#EA580C' };
  if (p <= 5) return { label: 'NORMAL',   color: '#2563EB' };
  if (p <= 8) return { label: 'LOW',      color: '#16A34A' };
  return             { label: 'BULK',     color: '#6B7280' };
}

function Badge({ status }) {
  const c = S[status] || { bg: '#F3F4F6', text: '#374151', border: '#D1D5DB' };
  return (
    <span style={{
      background: c.bg, color: c.text, border: `1px solid ${c.border}`,
      padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
      whiteSpace: 'nowrap',
    }}>
      {status === 'dead' ? 'DLQ' : status.toUpperCase()}
    </span>
  );
}

function Card({ label, value, color, sub, onClick, active }) {
  const c = S[color] || S.waiting;
  return (
    <div onClick={onClick} style={{
      background: '#fff', border: `2px solid ${active ? c.border : '#E5E7EB'}`,
      borderRadius: 12, padding: '14px 18px', flex: 1, minWidth: 110,
      cursor: onClick ? 'pointer' : 'default',
      transition: 'border-color .15s',
      boxShadow: active ? `0 0 0 3px ${c.border}22` : 'none',
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: active ? c.text : '#9CA3AF',
        textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 700, color: c.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 5 }}>{sub}</div>
    </div>
  );
}

// ── Live event feed ───────────────────────────────────────────────
function EventFeed({ events }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, [events]);
  if (!events.length) return (
    <div style={{ padding: '24px 0', textAlign: 'center', color: '#D1D5DB', fontSize: 12 }}>
      Events will appear here as jobs are processed
    </div>
  );
  return (
    <div ref={ref} style={{ maxHeight: 220, overflowY: 'auto' }}>
      {events.map((e, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10, alignItems: 'flex-start',
          padding: '7px 0', borderBottom: '1px solid #F9FAFB',
          opacity: i > 8 ? Math.max(0.3, 1 - (i - 8) * 0.07) : 1,
        }}>
          <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{e.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: e.color, fontWeight: 500 }}>{e.title}</div>
            <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{e.detail}</div>
          </div>
          <span style={{ fontSize: 10, color: '#D1D5DB', flexShrink: 0 }}>{e.time}</span>
        </div>
      ))}
    </div>
  );
}

// ── Progress bar ──────────────────────────────────────────────────
function Progress({ job }) {
  if (job.status === 'completed') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: '100%', height: '100%', background: '#22C55E', borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 30 }}>100%</span>
    </div>
  );
  if (job.status === 'active') return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, background: '#E5E7EB', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${job.progress || 0}%`, height: '100%',
          background: '#3B82F6', borderRadius: 3, transition: 'width .3s' }} />
      </div>
      <span style={{ fontSize: 10, color: '#9CA3AF', minWidth: 30 }}>{job.progress || 0}%</span>
    </div>
  );
  if (job.status === 'failed') return (
    <span style={{ fontSize: 11, color: '#EF4444' }}>↻ retrying</span>
  );
  if (job.status === 'dead') return (
    <span style={{ fontSize: 11, color: '#FB7185' }}>→ DLQ</span>
  );
  return <span style={{ fontSize: 11, color: '#D1D5DB' }}>—</span>;
}

// ── DEMO SCENARIOS ────────────────────────────────────────────────
const SCENARIOS = [
  {
    id: 'payment',
    label: '💳 Payment Notification',
    type: 'email',
    priority: 1,
    desc: 'Critical priority — jumps queue instantly',
    bg: '#FEF2F2', border: '#FCA5A5', text: '#DC2626',
    makeData: () => ({
      to: `customer${Date.now()}@bank.com`,
      subject: 'Payment of ₹2,499 confirmed',
      template: 'payment_confirmation',
    }),
    eventTitle: 'Payment notification enqueued',
    eventDetail: 'Priority 1 — will process before all other jobs',
  },
  {
    id: 'order',
    label: '📦 Order Confirmation',
    type: 'email',
    priority: 5,
    desc: 'Standard priority — normal queue',
    bg: '#EFF6FF', border: '#93C5FD', text: '#1D4ED8',
    makeData: () => ({
      to: `user${Date.now()}@shop.com`,
      subject: `Order #${Math.floor(Math.random()*90000+10000)} confirmed`,
      template: 'order_confirmation',
    }),
    eventTitle: 'Order confirmation enqueued',
    eventDetail: 'Priority 5 — standard processing queue',
  },
  {
    id: 'report',
    label: '📊 Analytics Report',
    type: 'report',
    priority: 5,
    desc: 'Heavy job — takes ~1.3s to generate',
    bg: '#F0FDF4', border: '#86EFAC', text: '#15803D',
    makeData: () => ({
      userId: `user_${Math.floor(Math.random()*1000)}`,
      reportType: 'monthly_analytics',
      month: new Date().toLocaleString('default', { month: 'long' }),
    }),
    eventTitle: 'Analytics report generation queued',
    eventDetail: 'CPU-intensive job — ~1.3s processing time',
  },
  {
    id: 'flaky',
    label: '⚡ Flaky API Call',
    type: 'test',
    priority: 5,
    desc: 'Fails 2× then succeeds — shows retry',
    bg: '#FFFBEB', border: '#FCD34D', text: '#B45309',
    makeData: () => ({
      failTimes: 2,
      jobName: `payment-gateway-${Date.now()}`,
      service: 'Razorpay webhook',
    }),
    eventTitle: 'Flaky API call queued',
    eventDetail: 'Will fail 2× with backoff retry, then succeed',
  },
  {
    id: 'exhausted',
    label: '💀 Simulate DLQ',
    type: 'test',
    priority: 5,
    desc: 'Fails all retries → Dead Letter Queue',
    bg: '#FFF1F2', border: '#FB7185', text: '#BE123C',
    makeData: () => ({
      failTimes: 99,
      jobName: `dead-service-${Date.now()}`,
      service: 'Unavailable external API',
    }),
    eventTitle: 'Unreachable service queued',
    eventDetail: 'Will exhaust all 3 retries → moves to DLQ',
  },
];

// ── Main App ──────────────────────────────────────────────────────
export default function App() {
  const [jobs,      setJobs]      = useState([]);
  const [stats,     setStats]     = useState({ waiting:0, active:0, completed:0, failed:0, delayed:0, dlq:0 });
  const [history,   setHistory]   = useState([]);
  const [connected, setConnected] = useState(false);
  const [events,    setEvents]    = useState([]);
  const [filter,    setFilter]    = useState('all');
  const [loading,   setLoading]   = useState(false);
  const socketRef = useRef(null);

  const addEvent = useCallback((icon, title, detail, color = '#374151') => {
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setEvents(p => [{ icon, title, detail, color, time }, ...p].slice(0, 30));
  }, []);

  // Load jobs when filter changes
  useEffect(() => {
    const statusParam = filter === 'dlq' ? 'dead' : filter;
    const url = filter === 'all'
      ? `${API}/api/jobs?limit=50`
      : `${API}/api/jobs?status=${statusParam}&limit=50`;
    axios.get(url).then(r => setJobs(r.data.jobs || []));
  }, [filter]);

  // Load initial stats
  useEffect(() => {
    axios.get(`${API}/api/jobs/stats`).then(r => setStats(r.data));
  }, []);

  // WebSocket Mounting Lifecycle
  useEffect(() => {
    socketRef.current = io(API, {
      transports: ['websocket', 'polling']
    });
    const socket = socketRef.current;

    socket.on('connect',    () => { setConnected(true);  addEvent('🔌', 'Dashboard connected', 'Real-time updates active', '#15803D'); });
    socket.on('disconnect', () => { setConnected(false); addEvent('⚠️', 'Dashboard disconnected', 'Attempting to reconnect...', '#B91C1C'); });

    socket.on('job:completed', u => {
      const ms = u.completed_at && u.created_at
        ? Math.round(new Date(u.completed_at) - new Date(u.created_at))
        : u.processingMs;
      addEvent('✅', `Job completed in ${ms ? ms + 'ms' : '—'}`,
        `ID: ${String(u.id).slice(0,12)}… | Type: ${u.type || ''}`, '#15803D');
      setJobs(p => p.map(j => j.id === u.id ? { ...j, ...u, status: 'completed', progress: 100 } : j));
    });

    socket.on('job:failed', u => {
      if (u.isDead) {
        addEvent('💀', 'Job moved to Dead Letter Queue',
          `ID: ${String(u.id).slice(0,12)}… | All ${u.attempts} retries exhausted`, '#BE123C');
      } else {
        addEvent('🔄', `Job failed — retry ${u.attempts}/${u.max_attempts}`,
          `ID: ${String(u.id).slice(0,12)}… | ${u.error || 'Will retry with backoff'}`, '#B91C1C');
      }
      setJobs(p => p.map(j => j.id === u.id ? { ...j, ...u } : j));
    });

    socket.on('job:progress', ({ id, progress, type }) => {
      setJobs(p => p.map(j => j.id === id ? { ...j, progress, status: 'active' } : j));
    });

    socket.on('queue:stats', s => {
      setStats(s);
      setHistory(prev => [...prev.slice(-29), {
        time: new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' }),
        ...s,
      }]);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [addEvent]);

  // Add a job
  const addJob = useCallback(async (scenario) => {
    setLoading(true);
    try {
      const data = scenario.makeData();
      const { data: res } = await axios.post(`${API}/api/jobs`, {
        type: scenario.type,
        priority: scenario.priority,
        data,
      });
      addEvent('📥', scenario.eventTitle, scenario.eventDetail, '#1D4ED8');
      const newJob = {
        id: res.jobId, type: scenario.type,
        status: 'waiting', priority: scenario.priority,
        created_at: new Date().toISOString(), progress: 0,
        attempts: 0, max_attempts: 3,
      };
      setJobs(p => {
        if (filter !== 'all' && filter !== 'waiting') return p;
        return [newJob, ...p].slice(0, 50);
      });
    } catch (e) {
      addEvent('❌', 'Failed to enqueue job', e.message, '#B91C1C');
    }
    setLoading(false);
  }, [filter, addEvent]);

  const filteredJobs = jobs;

  const filterLabels = [
    { key: 'all',       label: 'All' },
    { key: 'waiting',   label: 'Waiting' },
    { key: 'active',    label: 'Active' },
    { key: 'completed', label: 'Completed' },
    { key: 'failed',    label: 'Failed' },
    { key: 'dlq',       label: 'DLQ' },
  ];

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: '#F9FAFB',
      minHeight: '100vh', padding: '20px 28px' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#111827' }}>
            Distributed Task Queue
          </h1>
          <p style={{ margin: '3px 0 0', fontSize: 12, color: '#6B7280' }}>
            Priority queues · Exponential backoff retry · Dead letter queue · Real-time monitoring
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '6px 14px', borderRadius: 8,
          background: connected ? '#F0FDF4' : '#FEF2F2',
          border: `1.5px solid ${connected ? '#22C55E' : '#EF4444'}`,
          fontSize: 12, fontWeight: 600,
          color: connected ? '#15803D' : '#B91C1C',
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: connected ? '#22C55E' : '#EF4444',
            animation: connected ? 'pulse 2s infinite' : 'none',
          }} />
          {connected ? 'Live' : 'Disconnected'}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label:'Waiting',   value:stats.waiting,   color:'waiting',   sub:'In queue', key:'waiting' },
          { label:'Active',    value:stats.active,    color:'active',    sub:'Processing now', key:'active' },
          { label:'Completed', value:stats.completed, color:'completed', sub:'Successfully done', key:'completed' },
          { label:'Failed',    value:stats.failed,    color:'failed',    sub:'Will retry', key:'failed' },
          { label:'Delayed',   value:stats.delayed,   color:'delayed',   sub:'Scheduled', key:'delayed' },
          { label:'DLQ',       value:stats.dlq,       color:'dead',      sub:'Exhausted retries', key:'dlq' },
        ].map(c => (
          <Card key={c.key} {...c}
            active={filter === c.key}
            onClick={() => setFilter(p => p === c.key ? 'all' : c.key)}
          />
        ))}
      </div>

      {/* Middle row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 12, marginBottom: 16 }}>

        {/* Chart */}
        <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:'1px solid #E5E7EB' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:12 }}>
            Queue Activity — live
          </div>
          {history.length > 1 ? (
            <ResponsiveContainer width="100%" height={160}>
              <AreaChart data={history}>
                <defs>
                  {[['gC','#22C55E'],['gW','#F59E0B'],['gA','#3B82F6'],['gD','#FB7185']].map(([id,c])=>(
                    <linearGradient key={id} id={id} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={c} stopOpacity={0.18}/>
                      <stop offset="95%" stopColor={c} stopOpacity={0}/>
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6"/>
                <XAxis dataKey="time" tick={{fontSize:8,fill:'#9CA3AF'}} interval="preserveStartEnd"/>
                <YAxis tick={{fontSize:8,fill:'#9CA3AF'}}/>
                <Tooltip contentStyle={{fontSize:11,borderRadius:8,border:'1px solid #E5E7EB'}}/>
                <Area type="monotone" dataKey="completed" stroke="#22C55E" fill="url(#gC)" strokeWidth={2} name="Completed" isAnimationActive={false}/>
                <Area type="monotone" dataKey="waiting"   stroke="#F59E0B" fill="url(#gW)" strokeWidth={2} name="Waiting" isAnimationActive={false}/>
                <Area type="monotone" dataKey="active"    stroke="#3B82F6" fill="url(#gA)" strokeWidth={2} name="Active" isAnimationActive={false}/>
                <Area type="monotone" dataKey="dlq"       stroke="#FB7185" fill="url(#gD)" strokeWidth={2} name="DLQ" isAnimationActive={false}/>
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div style={{height:160,display:'flex',alignItems:'center',justifyContent:'center',color:'#D1D5DB',fontSize:12}}>
              Add jobs to see live activity
            </div>
          )}
        </div>

        {/* Live Event Feed */}
        <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:'1px solid #E5E7EB' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:12 }}>
            Live Event Feed
          </div>
          <EventFeed events={events}/>
        </div>

        {/* Scenarios */}
        <div style={{ background:'#fff', borderRadius:12, padding:'16px 20px', border:'1px solid #E5E7EB' }}>
          <div style={{ fontSize:12, fontWeight:600, color:'#374151', marginBottom:4 }}>
            Add Jobs
          </div>
          <div style={{ fontSize:10, color:'#9CA3AF', marginBottom:12 }}>
            Click any scenario to enqueue
          </div>
          {SCENARIOS.map(sc => (
            <button key={sc.id} onClick={() => addJob(sc)} disabled={loading}
              style={{
                width:'100%', marginBottom:7, padding:'8px 12px',
                background: sc.bg, border:`1px solid ${sc.border}`,
                borderRadius:8, cursor:'pointer', textAlign:'left',
                display:'flex', justifyContent:'space-between', alignItems:'center',
                opacity: loading ? 0.6 : 1,
              }}>
              <span style={{fontSize:12,fontWeight:500,color:sc.text}}>{sc.label}</span>
              <span style={{fontSize:10,color:'#9CA3AF',maxWidth:110,textAlign:'right',lineHeight:1.3}}>{sc.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Jobs table */}
      <div style={{ background:'#fff', borderRadius:12, border:'1px solid #E5E7EB', overflow:'hidden' }}>
        <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F4F6',
          display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <div>
            <div style={{fontSize:13,fontWeight:600,color:'#374151'}}>Job Log</div>
            <div style={{fontSize:11,color:'#9CA3AF',marginTop:2}}>
              {filter === 'all' ? 'All jobs — newest first' : `Filtered: ${filter.toUpperCase()}`}
            </div>
          </div>
          <div style={{display:'flex',gap:5}}>
            {filterLabels.map(f => (
              <button key={f.key} onClick={() => setFilter(f.key)}
                style={{
                  padding:'4px 10px', borderRadius:6, cursor:'pointer', fontSize:11,
                  fontWeight: filter===f.key ? 600 : 400,
                  background: filter===f.key ? '#111827' : '#F9FAFB',
                  color: filter===f.key ? '#fff' : '#6B7280',
                  border:`1px solid ${filter===f.key ? '#111827' : '#E5E7EB'}`,
                }}>
                {f.label}
                {f.key !== 'all' && stats[f.key === 'dlq' ? 'dlq' : f.key] > 0 && (
                  <span style={{
                    marginLeft:4, fontSize:9, fontWeight:700,
                    background: filter===f.key ? '#fff3' : '#E5E7EB',
                    padding:'1px 5px', borderRadius:8,
                    color: filter===f.key ? '#fff' : '#6B7280',
                  }}>
                    {f.key === 'dlq' ? stats.dlq : stats[f.key]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse',fontSize:12}}>
            <thead>
              <tr style={{background:'#F9FAFB'}}>
                {['Job ID','Scenario / Type','Status','Priority','Progress','Attempts','Created','Duration'].map(h=>(
                  <th key={h} style={{padding:'9px 14px',textAlign:'left',fontWeight:600,
                    color:'#6B7280',fontSize:11,borderBottom:'1px solid #F3F4F6',whiteSpace:'nowrap'}}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredJobs.length === 0 ? (
                <tr><td colSpan={8} style={{padding:28,textAlign:'center',color:'#D1D5DB',fontSize:12}}>
                  {filter === 'all' ? 'No jobs yet — click a scenario above to add one' : `No ${filter} jobs`}
                </td></tr>
              ) : filteredJobs.map((job, i) => {
                const p = pri(job.priority);
                const duration = job.completed_at && job.created_at
                  ? Math.round(new Date(job.completed_at) - new Date(job.created_at))
                  : null;
                const scenarioLabel = SCENARIOS.find(s => s.type === job.type)?.label || job.type;
                return (
                  <tr key={job.id} style={{borderBottom:'1px solid #F9FAFB',
                    background: job.status === 'active' ? '#EFF6FF' :
                                job.status === 'dead'   ? '#FFF1F2' :
                                i % 2 === 0 ? '#fff' : '#FAFAFA'}}>
                    <td style={{padding:'9px 14px',fontFamily:'monospace',color:'#9CA3AF',fontSize:10,
                      maxWidth:120,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                      {String(job.id).slice(0,14)}…
                    </td>
                    <td style={{padding:'9px 14px'}}>
                      <div style={{fontSize:12,fontWeight:500,color:'#374151'}}>{job.type}</div>
                      {job.data?.service && (
                        <div style={{fontSize:10,color:'#9CA3AF',marginTop:1}}>{job.data.service}</div>
                      )}
                    </td>
                    <td style={{padding:'9px 14px'}}><Badge status={job.status}/></td>
                    <td style={{padding:'9px 14px'}}>
                      <span style={{color:p.color,fontWeight:700,fontSize:11}}>{p.label}</span>
                    </td>
                    <td style={{padding:'9px 14px',minWidth:110}}><Progress job={job}/></td>
                    <td style={{padding:'9px 14px',color:'#6B7280',textAlign:'center'}}>
                      {job.attempts || 0}/{job.max_attempts || 3}
                    </td>
                    <td style={{padding:'9px 14px',color:'#9CA3AF',whiteSpace:'nowrap'}}>
                      {job.created_at ? new Date(job.created_at).toLocaleTimeString() : 'just now'}
                    </td>
                    <td style={{padding:'9px 14px',
                      color: duration ? '#15803D' : '#D1D5DB',
                      fontWeight: duration ? 600 : 400}}>
                      {duration ? `${duration}ms` : '—'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }
        button:hover { opacity:.88 !important; }
        *{box-sizing:border-box;}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-track{background:#F9FAFB}
        ::-webkit-scrollbar-thumb{background:#E5E7EB;border-radius:4px}
      `}</style>
    </div>
  );
}