'use strict';
const esc = s => String(s||'').replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const fmtBytes = b => { if(!b)return'0 B';const u=['B','KB','MB','GB'];const i=Math.floor(Math.log(b)/Math.log(1024));return(b/Math.pow(1024,i)).toFixed(1)+' '+u[i]; };
const fmtTime = ts => new Date(ts*1000).toLocaleTimeString();
const COLORS=['#58a6ff','#3fb950','#d29922','#bc8cff','#ff7b72','#79c0ff','#56d364','#e3b341','#f78166','#a5f3fc'];
const procColor = i => COLORS[i%COLORS.length];

document.addEventListener('DOMContentLoaded',()=>{
  document.querySelectorAll('.nav-item').forEach(a=>{
    a.addEventListener('click',()=>{
      document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
      document.querySelectorAll('.panel').forEach(x=>x.classList.remove('active'));
      a.classList.add('active');
      const p=document.getElementById('panel-'+a.dataset.panel);
      if(p)p.classList.add('active');
      const id=a.dataset.panel;
      if(id==='wal')DashAPI.loadWal();
      if(id==='audit')DashAPI.loadAudit();
      if(id==='files')FileMgr.loadFiles();
      if(id==='locks')DashAPI.loadLocks();
      if(id==='cluster')DashAPI.loadNodes();
      if(id==='iobuffer'){DashAPI.loadBuffer();DashAPI.loadCache();}
      if(id==='terminal')Terminal.init();
      if(id==='syscall')SyscallSim.init();
    });
  });
  document.querySelectorAll('.sub-tab').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const grp=btn.closest('section');
      grp.querySelectorAll('.sub-tab').forEach(x=>x.classList.remove('active'));
      btn.classList.add('active');
      const k=btn.dataset.mem;
      grp.querySelectorAll('.mem-sub').forEach(x=>x.classList.remove('active'));
      const el=document.getElementById('mem'+k.charAt(0).toUpperCase()+k.slice(1));
      if(el)el.classList.add('active');
    });
  });
  document.querySelectorAll('#csAlgoBtns .algo-btn').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('#csAlgoBtns .algo-btn').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');CpuSched.currentAlgo=b.dataset.algo;
  }));
  ['#dkAlgoBtns .algo-btn','[data-dk]'].forEach(sel=>{
    document.querySelectorAll('#dkAlgoBtns .algo-btn').forEach(b=>b.addEventListener('click',()=>{
      document.querySelectorAll('#dkAlgoBtns .algo-btn').forEach(x=>x.classList.remove('active'));
      b.classList.add('active');DiskSim.currentAlgo=b.dataset.dk;
    }));
  });
  document.querySelectorAll('[data-pr]').forEach(b=>b.addEventListener('click',()=>{
    document.querySelectorAll('[data-pr]').forEach(x=>x.classList.remove('active'));
    b.classList.add('active');PageReplace.currentAlgo=b.dataset.pr;
  }));
  const mm=document.getElementById('memMode');
  if(mm)mm.addEventListener('change',function(){document.getElementById('fixedPartConfig').classList.toggle('hidden',this.value!=='fixed');});
  const sp=document.getElementById('csSpeed');
  if(sp)sp.addEventListener('input',function(){document.getElementById('csSpeedLabel').textContent=(this.value/4).toFixed(2).replace('.00','')+  'x';});
  DashAPI.init();
  Terminal.init();
  SyscallSim.init();
  Banker.loadExample();
  MemSim.initMemory();
  PageReplace.run();
  ProcMgr.init();
});
// ─── DashAPI ──────────────────────────────────────────────────────────────────
const DashAPI={
  _nodes:[],
  init(){
    this.loadStatus();this.loadNodes();this.loadLocks();this.loadBuffer();this.loadCache();
    setInterval(()=>{
      this.loadStatus();this.loadNodes();this.loadLocks();this.loadBuffer();this.loadCache();
      const a=document.querySelector('.nav-item.active');
      const id=a?a.dataset.panel:'';
      if(id==='wal')this.loadWal();
      if(id==='audit')this.loadAudit();
      if(id==='files')FileMgr.loadFiles();
    },3000);
  },
  async get(u){try{const r=await fetch(u);if(!r.ok)return null;return r.json();}catch{return null;}},
  async post(u,b){try{const r=await fetch(u,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});return r.json();}catch{return null;}},
  async loadStatus(){
    const d=await this.get('/api/status');if(!d)return;
    document.getElementById('hdrPid').textContent=d.coordinator_pid||'--';
    document.getElementById('hdrThreads').textContent=d.active_worker_threads||0;
    document.getElementById('ovCoordPid').textContent=d.coordinator_pid||'--';
    document.getElementById('ovThreads').textContent=d.active_worker_threads||0;
    document.getElementById('clusterStatusLabel').textContent='ONLINE';
    document.getElementById('clusterPill').style.color='var(--accent-green)';
  },
  async loadNodes(){
    const nodes=await this.get('/api/nodes');if(!nodes)return;
    this._nodes=nodes;
    const on=nodes.filter(n=>n.status==='ONLINE'||n.is_process_running).length;
    document.getElementById('ovNodes').textContent=on+'/'+nodes.length;
    const g=document.getElementById('nodesGrid');if(!g)return;
    g.innerHTML=nodes.map(n=>{
      const isOn=n.status==='ONLINE'||n.is_process_running;
      const pct=n.total_space>0?Math.min(100,(n.used_space/n.total_space*100)).toFixed(1):0;
      return '<div class="node-card '+(isOn?'online':'offline')+'">'+
        '<div style="display:flex;justify-content:space-between;align-items:center">'+
        '<span class="node-title">'+esc(n.name)+'</span>'+
        '<span class="badge '+(isOn?'green':'red')+'">'+(isOn?'ONLINE':'OFFLINE')+'</span></div>'+
        '<div class="node-meta"><span>Port: '+n.port+'</span><span>PID: '+(n.process_id||'--')+'</span></div>'+
        '<div class="progress-bg"><div class="progress-fill" style="width:'+Math.max(pct,1)+'%"></div></div>'+
        '<div style="font-size:11px;color:var(--text-secondary)">'+fmtBytes(n.used_space)+' / '+fmtBytes(n.total_space)+'</div>'+
        '<div style="margin-top:8px">'+(isOn?
          '<button class="btn btn-sm btn-danger" onclick="DashAPI.killNode('+n.id+')">Simulate Crash</button>':
          '<button class="btn btn-sm btn-success" onclick="DashAPI.startNode('+n.id+')">Revive Node</button>')+
        '</div></div>';
    }).join('');
    this.drawTopology();
  },
  async killNode(id){await this.post('/api/nodes/kill',{node_id:id});this.loadNodes();},
  async startNode(id){await this.post('/api/nodes/start',{node_id:id});this.loadNodes();},
  async loadLocks(){
    const d=await this.get('/api/locks');if(!d)return;
    document.getElementById('ovLocks').textContent=d.active_lock_count||0;
    ['lkActive','lkWaiting','lkAcquired','lkTimeouts','lkPrevented'].forEach((id,i)=>{
      const v=[d.active_lock_count,d.waiting_request_count,d.total_acquired,d.total_timeouts,d.total_deadlocks_prevented][i];
      const el=document.getElementById(id);if(el)el.textContent=v||0;
    });
    const banner=document.getElementById('dlBanner');
    if(banner){
      if(d.has_deadlock_cycle){
        banner.className='dl-banner danger';
        banner.innerHTML='<strong>DEADLOCK DETECTED</strong> &mdash; Cycle: '+esc((d.deadlock_cycle||[]).join(' -> '));
      }else{
        banner.className='dl-banner safe';
        banner.innerHTML='<strong>SAFE</strong> &mdash; No deadlock cycles. Havender lock ordering enforced.';
      }
    }
    const ab=document.getElementById('lkActiveBody');
    if(ab)ab.innerHTML=(d.active_locks||[]).map(l=>'<tr><td>'+esc(l.resource)+'</td><td><span class="badge '+(l.type==='SHARED_READ'?'cyan':'red')+'">'+l.type+'</span></td><td>'+esc(l.client)+'</td><td>'+fmtTime(l.acquired_at)+'</td></tr>').join('')||'<tr><td colspan=4 style="text-align:center;color:var(--text-secondary)">No active locks</td></tr>';
    const wb=document.getElementById('lkWaitBody');
    if(wb)wb.innerHTML=(d.waiting_requests||[]).map(w=>'<tr><td>'+esc(w.resource)+'</td><td><span class="badge amber">'+w.type+'</span></td><td>'+esc(w.client)+'</td><td>'+w.timeout_ms+'ms</td></tr>').join('')||'<tr><td colspan=4 style="text-align:center;color:var(--text-secondary)">No waiting requests</td></tr>';
  },
  async loadBuffer(){
    const b=await this.get('/api/buffer');if(!b)return;
    const pct=b.capacity>0?Math.round(b.current_occupancy/b.capacity*100):0;
    document.getElementById('ovBuffer').textContent=pct+'%';
    const ring=document.getElementById('ringBuf');if(!ring)return;
    ring.innerHTML=Array.from({length:b.capacity},(_, i)=>'<div class="ring-slot'+(i<b.current_occupancy?' filled':'')+'">'+( i<b.current_occupancy?'CHK':''+(i+1))+'</div>').join('');
    const bs=document.getElementById('bufStats');
    if(bs)bs.innerHTML='<span>Capacity: <strong>'+b.capacity+'</strong></span><span>Occupied: <strong>'+b.current_occupancy+'</strong></span><span>Produced: <strong>'+b.total_produced+'</strong></span><span>Consumed: <strong>'+b.total_consumed+'</strong></span><span style="color:var(--accent-red)">Blocked Prod: <strong>'+b.blocked_producers+'</strong></span><span style="color:var(--accent-amber)">HWM: <strong>'+b.high_watermark_pct.toFixed(1)+'%</strong></span>';
  },
  async loadCache(){
    const c=await this.get('/api/cache');if(!c)return;
    document.getElementById('ovCache').textContent=c.hit_ratio_pct.toFixed(1)+'%';
    const cs=document.getElementById('cacheStatsRow');
    if(cs)cs.innerHTML='<div class="cache-stat"><div class="cs-val" style="color:var(--accent-green)">'+c.hit_ratio_pct.toFixed(1)+'%</div><div class="cs-label">Hit Ratio</div></div><div class="cache-stat"><div class="cs-val">'+c.hit_count+'</div><div class="cs-label">Hits</div></div><div class="cache-stat"><div class="cs-val">'+c.miss_count+'</div><div class="cs-label">Misses</div></div><div class="cache-stat"><div class="cs-val">'+c.eviction_count+'</div><div class="cs-label">Evictions</div></div><div class="cache-stat"><div class="cs-val">'+c.current_items+'/'+c.capacity_items+'</div><div class="cs-label">Items</div></div>';
    const chain=document.getElementById('lruChain');
    if(!chain)return;
    if(!c.cached_keys||c.cached_keys.length===0){chain.innerHTML='<span style="color:var(--text-secondary);font-size:12px">Cache is empty</span>';return;}
    chain.innerHTML=c.cached_keys.map((k,i)=>(i>0?'<span class="lru-arrow">&#8594;</span>':'')+'<span class="lru-node">'+esc(k)+'</span>').join('');
  },
  async clearCache(){await this.post('/api/cache/clear',{});this.loadCache();},
  async loadWal(){
    const logs=await this.get('/api/recovery');if(!logs)return;
    const wb=document.getElementById('walBody');if(!wb)return;
    wb.innerHTML=logs.map(w=>{
      const sc=w.state==='COMMITTED'?'green':w.state==='PENDING'?'amber':'red';
      return '<tr><td class="mono">'+w.lsn+'</td><td class="mono" style="font-size:11px">'+esc(w.tx_id)+'</td><td><strong>'+esc(w.operation)+'</strong></td><td>'+esc(w.file_path)+'</td><td><span class="badge '+sc+'">'+esc(w.state)+'</span></td><td>'+fmtTime(w.timestamp)+'</td></tr>';
    }).join('')||'<tr><td colspan=6 style="text-align:center;color:var(--text-secondary)">No WAL entries</td></tr>';
  },
  async runRecovery(){
    const r=await this.post('/api/recovery/run',{});
    if(r)alert('Recovery complete.\nPending: '+r.pending_operations_found+'\nRolled back: '+r.operations_rolled_back);
    this.loadWal();
  },
  async loadAudit(){
    const logs=await this.get('/api/audit');if(!logs)return;
    const filter=document.getElementById('auditFilter').value;
    const fl=filter?logs.filter(a=>a.action===filter):logs;
    const ac={UPLOAD:'blue',DOWNLOAD:'cyan',DELETE:'red',RENAME:'amber',NODE_KILL:'red',RE_REPLICATION:'purple'};
    const ab=document.getElementById('auditBody');if(!ab)return;
    ab.innerHTML=fl.map(a=>'<tr><td>#'+a.id+'</td><td>'+fmtTime(a.timestamp)+'</td><td><strong>'+esc(a.user)+'</strong></td><td><span class="badge '+(ac[a.action]||'blue')+'">'+esc(a.action)+'</span></td><td>'+esc(a.target_path)+'</td><td><span class="badge '+(a.success?'green':'red')+'">'+(a.success?'OK':'DENIED')+'</span></td><td>'+esc(a.client_ip)+'</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(a.details)+'</td></tr>').join('')||'<tr><td colspan=8 style="text-align:center;color:var(--text-secondary)">No audit logs</td></tr>';
  },
  drawTopology(){
    const svg=document.getElementById('topoSvg');if(!svg)return;
    const nodes=this._nodes||[];
    const W=svg.parentElement?svg.parentElement.offsetWidth||500:500,H=220;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    const cx=W/2,cy=80;
    let h='<defs><marker id="arr" markerWidth="8" markerHeight="6" refX="6" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#58a6ff"/></marker></defs>';
    h+='<rect x="'+(cx-70)+'" y="'+(cy-22)+'" width="140" height="44" rx="6" fill="#1c2128" stroke="#58a6ff" stroke-width="1.5"/>';
    h+='<text x="'+cx+'" y="'+(cy-5)+'" text-anchor="middle" fill="#58a6ff" font-size="11" font-weight="700" font-family="JetBrains Mono,monospace">COORDINATOR</text>';
    h+='<text x="'+cx+'" y="'+(cy+12)+'" text-anchor="middle" fill="#8b949e" font-size="10" font-family="monospace">:8080 / :9001</text>';
    if(nodes.length){
      const sp=W/(nodes.length+1);
      nodes.forEach((n,i)=>{
        const nx=sp*(i+1),ny=170;
        const on=n.status==='ONLINE'||n.is_process_running;
        const col=on?'#3fb950':'#f85149';
        h+='<line x1="'+cx+'" y1="'+(cy+22)+'" x2="'+nx+'" y2="'+(ny-22)+'" stroke="#58a6ff" stroke-width="1" '+(on?'':'stroke-dasharray="4,3" ')+' marker-end="url(#arr)"/>';
        h+='<rect x="'+(nx-45)+'" y="'+(ny-22)+'" width="90" height="44" rx="5" fill="#1c2128" stroke="'+col+'" stroke-width="1.5"/>';
        h+='<text x="'+nx+'" y="'+(ny-5)+'" text-anchor="middle" fill="'+col+'" font-size="10" font-weight="700" font-family="JetBrains Mono,monospace">Node '+n.id+'</text>';
        h+='<text x="'+nx+'" y="'+(ny+12)+'" text-anchor="middle" fill="#8b949e" font-size="9" font-family="monospace">:'+n.port+'</text>';
        if(on)h+='<circle cx="'+(nx+38)+'" cy="'+(ny-16)+'" r="4" fill="#3fb950"><animate attributeName="opacity" values="1;0.3;1" dur="2s" repeatCount="indefinite"/></circle>';
      });
    }
    svg.innerHTML=h;
    this._drawEventLog();
  },
  async _drawEventLog(){
    const logs=await this.get('/api/audit');if(!logs)return;
    const el=document.getElementById('ovEventLog');if(!el)return;
    el.innerHTML=logs.slice(0,12).map(a=>'<div class="event-entry"><span class="ev-time">'+fmtTime(a.timestamp)+'</span> <span class="'+(a.success?'ev-ok':'ev-fail')+'">'+(a.success?'[OK]':'[FAIL]')+'</span> '+esc(a.user)+' '+esc(a.action)+' <span style="color:var(--accent-cyan)">'+esc(a.target_path)+'</span></div>').join('');
  }
};
// ─── File Manager ─────────────────────────────────────────────────────────────
const FileMgr={
  _files:[],
  openUpload(){document.getElementById('fileUploadForm').classList.remove('hidden');},
  closeUpload(){document.getElementById('fileUploadForm').classList.add('hidden');},
  async loadFiles(){
    const files=await DashAPI.get('/api/files');if(!files)return;
    this._files=files;this.renderFiles('');
  },
  renderFiles(filter){
    const fl=filter?this._files.filter(f=>f.path.toLowerCase().includes(filter.toLowerCase())):this._files;
    const tb=document.getElementById('filesBody');if(!tb)return;
    tb.innerHTML=fl.map(f=>{
      const perms=this._octalToRwx(f.permissions||0o644);
      const nodes=[...new Set((f.chunks||[]).flatMap(c=>c.replicas||[]))];
      const repls=nodes.length?nodes.map(n=>'<span class="badge green">N'+n+'</span>').join(' '):'<span class="badge amber">none</span>';
      return '<tr><td><strong>'+esc(f.path)+'</strong></td><td class="mono" style="font-size:11px">'+esc(perms)+'</td><td>'+fmtBytes(f.size)+'</td><td>'+esc(f.owner)+'</td><td>v'+f.version+'</td><td class="mono" style="font-size:11px" title="'+esc(f.checksum_sha256)+'">'+esc((f.checksum_sha256||'').substring(0,10))+'...</td><td>'+repls+'</td><td style="white-space:nowrap"><button class="btn btn-sm" onclick="FileMgr.download(\''+esc(f.path)+'\')">&#8595;</button> <button class="btn btn-sm" onclick="FileMgr.versions(\''+esc(f.path)+'\')">Hist</button> <button class="btn btn-sm" onclick="FileMgr.rename(\''+esc(f.path)+'\')">Ren</button> <button class="btn btn-sm btn-danger" onclick="FileMgr.del(\''+esc(f.path)+'\')">Del</button></td></tr>';
    }).join('')||'<tr><td colspan=8 style="text-align:center;color:var(--text-secondary)">No files found</td></tr>';
  },
  _octalToRwx(p){
    const r=['---','--x','-w-','-wx','r--','r-x','rw-','rwx'];
    return r[(p>>6)&7]+r[(p>>3)&7]+r[p&7];
  },
  async upload(){
    const path=document.getElementById('upPath').value;
    const content=document.getElementById('upContent').value;
    const repl=parseInt(document.getElementById('upRepl').value);
    const owner=document.getElementById('upOwner').value;
    if(!path){alert('Path required');return;}
    const r=await DashAPI.post('/api/files/upload',{path,content,replication_factor:repl,owner});
    if(r&&r.status==='OK'){this.closeUpload();document.getElementById('upContent').value='';this.loadFiles();}
    else alert('Upload failed: '+(r&&r.error||'Unknown error'));
  },
  download(path){window.open('/api/files/download?path='+encodeURIComponent(path),'_blank');},
  async del(path){
    if(!confirm('Delete '+path+'?'))return;
    await fetch('/api/files?path='+encodeURIComponent(path),{method:'DELETE'});
    this.loadFiles();
  },
  async rename(oldPath){
    const n=prompt('New path:',oldPath);if(!n||n===oldPath)return;
    const r=await DashAPI.post('/api/files/rename',{old_path:oldPath,new_path:n});
    if(r&&r.status==='OK')this.loadFiles();else alert('Rename failed');
  },
  async versions(path){
    const vs=await DashAPI.get('/api/files/versions?path='+encodeURIComponent(path));
    const vp=document.getElementById('verPanel');if(!vp)return;
    document.getElementById('verPath').textContent=path;
    const vb=document.getElementById('verBody');
    vb.innerHTML=vs&&vs.length?vs.map(v=>'<tr><td>v'+v.version+'</td><td>'+fmtBytes(v.size)+'</td><td class="mono" style="font-size:11px">'+esc((v.checksum||'').substring(0,10))+'...</td><td>'+fmtTime(v.created_at)+'</td><td>'+esc(v.created_by)+'</td><td><button class="btn btn-sm btn-primary" onclick="FileMgr.restore(\''+esc(path)+'\','+v.version+')">Restore</button></td></tr>').join(''):'<tr><td colspan=6 style="text-align:center;color:var(--text-secondary)">No versions</td></tr>';
    vp.classList.remove('hidden');
  },
  async restore(path,ver){
    if(!confirm('Restore v'+ver+'?'))return;
    await DashAPI.post('/api/files/restore',{path,version:ver});
    this.closeVersions();this.loadFiles();
  },
  closeVersions(){document.getElementById('verPanel').classList.add('hidden');}
};
// ─── Process Manager ──────────────────────────────────────────────────────────
const ProcMgr={
  _procs:[],_nextPid:100,
  init(){
    this._procs=[
      {pid:1,ppid:0,name:'systemd',state:'RUNNING',priority:1,burst:0,arrival:0,type:'real'},
      {pid:2,ppid:1,name:'dfs_coordinator',state:'RUNNING',priority:2,burst:0,arrival:0,type:'real'}
    ];
    this.render();
  },
  openCreateForm(){document.getElementById('procCreateForm').classList.remove('hidden');},
  closeCreateForm(){document.getElementById('procCreateForm').classList.add('hidden');},
  createProcess(){
    const name=document.getElementById('pName').value||'proc';
    const arrival=parseInt(document.getElementById('pArrival').value)||0;
    const burst=parseInt(document.getElementById('pBurst').value)||5;
    const priority=parseInt(document.getElementById('pPriority').value)||5;
    const ppid=parseInt(document.getElementById('pPPID').value)||1;
    const pid=this._nextPid++;
    this._procs.push({pid,ppid,name,state:'READY',priority,burst,arrival,type:'sim'});
    this.closeCreateForm();this.render();this.drawTree();
  },
  terminate(pid){
    const p=this._procs.find(x=>x.pid===pid);
    if(p){p.state='TERMINATED';this.render();}
  },
  showPcb(pid){
    const p=this._procs.find(x=>x.pid===pid);if(!p)return;
    const v=document.getElementById('pcbViewer');
    const fields=[
      ['PID',p.pid],['PPID',p.ppid],['Process Name',p.name],
      ['State',p.state],['Priority',p.priority],['Burst Time',p.burst+' time units'],
      ['Arrival Time',p.arrival],['Program Counter','0x'+Math.floor(Math.random()*0xFFFFFF).toString(16).padStart(6,'0').toUpperCase()],
      ['Stack Pointer','0x'+Math.floor(Math.random()*0xFFFF).toString(16).padStart(4,'0').toUpperCase()+'0'],
      ['Base Register','0x'+Math.floor(Math.random()*0xFFFF).toString(16).padStart(4,'0').toUpperCase()+'00'],
      ['Limit Register','0x'+Math.floor(p.burst*4096).toString(16).toUpperCase()],
      ['Open Files',p.type==='real'?'stdin, stdout, stderr':'stdin, stdout, stderr'],
      ['CPU Time Used',p.state==='TERMINATED'?p.burst+' units':'0 units'],
      ['Memory (simulated)',(p.burst*64)+' KB'],
      ['Type',p.type==='real'?'Real DFS Process':'Simulated Process'],
      ['Linux Equivalent',p.type==='real'?'Actual Win32 Process':'fork()+exec() simulation']
    ];
    v.innerHTML=fields.map(([k,val])=>'<div class="pcb-row"><span class="pcb-key">'+k+'</span><span class="pcb-val">'+esc(String(val))+'</span></div>').join('');
  },
  render(){
    const tb=document.getElementById('procTableBody');if(!tb)return;
    const stateColor={READY:'blue',RUNNING:'green',WAITING:'amber',TERMINATED:'red'};
    tb.innerHTML=this._procs.map((p,i)=>{
      const sc=stateColor[p.state]||'blue';
      return '<tr style="cursor:pointer" onclick="ProcMgr.showPcb('+p.pid+')">'+
        '<td class="mono">'+p.pid+'</td><td class="mono">'+p.ppid+'</td>'+
        '<td><strong>'+esc(p.name)+'</strong></td>'+
        '<td><span class="badge '+sc+'">'+p.state+'</span></td>'+
        '<td>'+p.priority+'</td><td>'+p.burst+'</td><td>'+p.arrival+'</td>'+
        '<td>'+(p.type==='sim'&&p.state!=='TERMINATED'?'<button class="btn btn-sm btn-danger" onclick="event.stopPropagation();ProcMgr.terminate('+p.pid+')">Terminate</button>':'<span class="badge '+(p.type==='real'?'green':'red')+'">'+p.state+'</span>')+'</td>'+
        '</tr>';
    }).join('');
    this.drawTree();
  },
  drawTree(){
    const svg=document.getElementById('procTreeSvg');if(!svg)return;
    const W=svg.parentElement?svg.parentElement.offsetWidth||400:400,H=200;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    // build adjacency
    const byPid={};this._procs.forEach(p=>byPid[p.pid]=p);
    const roots=this._procs.filter(p=>!byPid[p.ppid]||p.ppid===0);
    let h='';
    const draw=(p,x,y,level)=>{
      const children=this._procs.filter(c=>c.ppid===p.pid&&c.pid!==p.pid);
      const col=p.state==='RUNNING'?'#3fb950':p.state==='TERMINATED'?'#f85149':'#58a6ff';
      h+='<circle cx="'+x+'" cy="'+y+'" r="18" fill="#1c2128" stroke="'+col+'" stroke-width="1.5"/>';
      h+='<text x="'+x+'" y="'+(y-4)+'" text-anchor="middle" fill="'+col+'" font-size="9" font-family="JetBrains Mono,monospace">'+p.pid+'</text>';
      h+='<text x="'+x+'" y="'+(y+8)+'" text-anchor="middle" fill="#8b949e" font-size="8" font-family="monospace">'+esc(p.name.substring(0,6))+'</text>';
      const cw=W/(children.length+1);
      children.forEach((c,i)=>{
        const cx2=cw*(i+1);const cy2=y+60;
        h+='<line x1="'+x+'" y1="'+(y+18)+'" x2="'+cx2+'" y2="'+(cy2-18)+'" stroke="#30363d" stroke-width="1"/>';
        draw(c,cx2,cy2,level+1);
      });
    };
    const rw=W/(roots.length+1);
    roots.forEach((r,i)=>draw(r,rw*(i+1),30,0));
    svg.innerHTML=h;
  }
};
// ─── CPU Scheduler ────────────────────────────────────────────────────────────
const CpuSched={
  _procs:[],_timeline:[],_step:0,_playing:false,_timer:null,
  currentAlgo:'FCFS',
  openAddForm(){document.getElementById('csAddForm').classList.remove('hidden');},
  addProcess(){
    const n=document.getElementById('csName').value||'P'+(this._procs.length+1);
    const a=parseInt(document.getElementById('csArrival').value)||0;
    const b=parseInt(document.getElementById('csBurst').value)||5;
    const pr=parseInt(document.getElementById('csPriority').value)||3;
    this._procs.push({name:n,arrival:a,burst:b,priority:pr,remaining:b});
    document.getElementById('csAddForm').classList.add('hidden');
    this._renderInput();
  },
  loadSample(){
    this._procs=[
      {name:'P1',arrival:0,burst:8,priority:3,remaining:8},
      {name:'P2',arrival:1,burst:4,priority:1,remaining:4},
      {name:'P3',arrival:2,burst:9,priority:2,remaining:9},
      {name:'P4',arrival:3,burst:5,priority:4,remaining:5},
      {name:'P5',arrival:4,burst:2,priority:5,remaining:2}
    ];
    this._renderInput();
  },
  _renderInput(){
    const tb=document.getElementById('csInputBody');if(!tb)return;
    tb.innerHTML=this._procs.map((p,i)=>
      '<tr><td>'+esc(p.name)+'</td><td>'+p.arrival+'</td><td>'+p.burst+'</td><td>'+p.priority+'</td>'+
      '<td><button class="btn btn-sm btn-danger" onclick="CpuSched._procs.splice('+i+',1);CpuSched._renderInput()">X</button></td></tr>'
    ).join('')||'<tr><td colspan=5 style="text-align:center;color:var(--text-secondary)">No processes</td></tr>';
  },
  run(){
    if(!this._procs.length){alert('Add processes first');return;}
    const ps=this._procs.map((p,i)=>({...p,id:i,remaining:p.burst,startTime:-1,finishTime:-1,responseTime:-1,color:procColor(i)}));
    const algo=this.currentAlgo;
    const q=parseInt(document.getElementById('csQuantum').value)||2;
    this._timeline=this._simulate(ps,algo,q);
    this._step=0;
    document.getElementById('csResultsSection').classList.remove('hidden');
    this._renderStep();
    this._drawGantt();
  },
  _simulate(ps,algo,quantum){
    const tl=[];// each entry: {time,running,readyQueue,waiting,completed,explanation}
    const procs=ps.map(p=>({...p}));
    let t=0,done=0,rrQueue=[],lastRun=null,rrRemaining={};
    procs.forEach(p=>{rrRemaining[p.id]=p.burst;});
    const maxT=procs.reduce((s,p)=>s+p.burst,0)+procs.length+5;
    while(done<procs.length&&t<maxT){
      const arrived=procs.filter(p=>p.arrival<=t&&p.finishTime===-1);
      let running=null;let expl='';
      if(algo==='FCFS'){
        running=arrived.sort((a,b)=>a.arrival-b.arrival||a.id-b.id).find(p=>p.remaining>0);
        if(running)expl='FCFS: '+running.name+' selected (arrived at t='+running.arrival+', FIFO order).';
      } else if(algo==='SJF'){
        running=arrived.filter(p=>p.remaining>0).sort((a,b)=>a.burst-b.burst||a.arrival-b.arrival)[0];
        if(running)expl='SJF: '+running.name+' selected (shortest burst='+running.burst+' among arrived processes).';
      } else if(algo==='SRTF'){
        running=arrived.filter(p=>p.remaining>0).sort((a,b)=>a.remaining-b.remaining||a.arrival-b.arrival)[0];
        if(running)expl='SRTF: '+running.name+' selected (shortest remaining='+running.remaining+').';
      } else if(algo==='RR'){
        // add new arrivals to queue
        procs.filter(p=>p.arrival===t&&p.finishTime===-1).forEach(p=>{if(!rrQueue.find(x=>x.id===p.id))rrQueue.push(p);});
        if(lastRun&&rrRemaining[lastRun.id]>0&&lastRun.finishTime===-1){
          // still has quantum? handled below
        }
        running=rrQueue.length?rrQueue[0]:null;
        if(running)expl='RR: '+running.name+' running (remaining='+rrRemaining[running.id]+', quantum='+quantum+').';
      } else if(algo==='PRI_NP'){
        running=arrived.filter(p=>p.remaining>0&&(lastRun===null||lastRun.finishTime!==-1||lastRun===p)).sort((a,b)=>a.priority-b.priority)[0];
        if(!lastRun||lastRun.finishTime!==-1)running=arrived.filter(p=>p.remaining>0).sort((a,b)=>a.priority-b.priority)[0];
        if(running)expl='Priority NP: '+running.name+' selected (priority='+running.priority+', lower=higher priority).';
      } else if(algo==='PRI_P'){
        running=arrived.filter(p=>p.remaining>0).sort((a,b)=>a.priority-b.priority)[0];
        if(running)expl='Priority P: '+running.name+' (priority='+running.priority+'). '+( lastRun&&lastRun!==running&&lastRun.finishTime===-1?'Preempting '+lastRun.name+'.':'');
      }
      if(!running){t++;continue;}
      if(running.startTime===-1){running.startTime=t;running.responseTime=t-running.arrival;}
      const step={time:t,running:running.name,runningColor:running.color,readyQueue:arrived.filter(p=>p.remaining>0&&p!==running).map(p=>p.name),waiting:procs.filter(p=>p.arrival>t&&p.finishTime===-1).map(p=>p.name),completed:procs.filter(p=>p.finishTime!==-1).map(p=>p.name),explanation:expl};
      tl.push(step);
      if(algo==='RR'){
        rrRemaining[running.id]--;
        let qUsed=1;
        while(qUsed<quantum&&rrRemaining[running.id]>0){
          t++;qUsed++;
          procs.filter(p=>p.arrival===t&&p.finishTime===-1).forEach(p=>{if(!rrQueue.find(x=>x.id===p.id))rrQueue.push(p);});
          tl.push({...step,time:t,explanation:'RR: '+running.name+' using quantum ('+qUsed+'/'+quantum+'), remaining='+rrRemaining[running.id]+'.'});
          rrRemaining[running.id]--;
        }
        if(rrRemaining[running.id]===0){running.finishTime=t+1;running.remaining=0;done++;rrQueue.shift();}
        else{rrQueue.shift();rrQueue.push(running);} // re-queue
        lastRun=running;
      } else {
        running.remaining--;
        if(running.remaining===0){running.finishTime=t+1;done++;}
        lastRun=running;
      }
      t++;
    }
    // compute metrics
    procs.forEach(p=>{
      p.waitingTime=p.startTime-p.arrival;
      p.turnaroundTime=p.finishTime-p.arrival;
    });
    tl._procs=procs;
    return tl;
  },
  _renderStep(){
    const tl=this._timeline;
    if(!tl.length)return;
    const i=Math.min(this._step,tl.length-1);
    const s=tl[i];
    document.getElementById('csTimeLabel').textContent='Time: '+s.time;
    document.getElementById('csRunning').textContent=s.running||'idle';
    document.getElementById('csRunning').style.color=s.runningColor||'var(--accent-green)';
    const chip=(n,ci)=>'<span class="proc-chip pc-'+(ci%8)+'">'+esc(n)+'</span>';
    document.getElementById('csReadyQueue').innerHTML=s.readyQueue.map((n,i)=>chip(n,this._procs.findIndex(p=>p.name===n))).join('');
    document.getElementById('csWaiting').innerHTML=s.waiting.map((n,i)=>chip(n,i)).join('');
    document.getElementById('csCompleted').innerHTML=s.completed.map((n,i)=>'<span class="proc-chip" style="border-color:#3fb950;background:rgba(63,185,80,0.15);color:#3fb950">'+esc(n)+'</span>').join('');
    document.getElementById('csExplanation').textContent=s.explanation||'';
    this._drawGantt();
    // metrics after completion
    if(tl._procs){
      const tb=document.getElementById('csMetricsBody');
      if(tb)tb.innerHTML=tl._procs.map(p=>'<tr><td>'+esc(p.name)+'</td><td>'+p.arrival+'</td><td>'+p.burst+'</td><td>'+(p.startTime>=0?p.startTime:'--')+'</td><td>'+(p.finishTime>0?p.finishTime:'--')+'</td><td>'+(p.waitingTime>=0?p.waitingTime:'--')+'</td><td>'+(p.turnaroundTime>0?p.turnaroundTime:'--')+'</td><td>'+(p.responseTime>=0?p.responseTime:'--')+'</td></tr>').join('');
    }
  },
  _drawGantt(){
    const canvas=document.getElementById('ganttCanvas');if(!canvas)return;
    const tl=this._timeline;if(!tl.length)return;
    const W=canvas.parentElement?canvas.parentElement.offsetWidth||800:800;
    canvas.width=W;const H=90;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const maxT=tl[tl.length-1].time+2;
    const tw=Math.max(12,Math.floor((W-40)/maxT));
    const curStep=Math.min(this._step,tl.length-1);
    tl.forEach((s,idx)=>{
      if(idx>curStep)return;
      const x=20+s.time*tw,y=20,bw=tw,bh=40;
      const pi=this._procs.findIndex(p=>p.name===s.running);
      ctx.fillStyle=pi>=0?procColor(pi)+'33':'#333';
      ctx.fillRect(x,y,bw,bh);
      ctx.strokeStyle=pi>=0?procColor(pi):'#555';
      ctx.lineWidth=1;ctx.strokeRect(x,y,bw,bh);
      if(tw>=16){
        ctx.fillStyle=pi>=0?procColor(pi):'#888';
        ctx.font='bold 9px JetBrains Mono,monospace';
        ctx.textAlign='center';
        ctx.fillText(s.running&&s.running.length>4?s.running.substring(0,3):s.running,x+bw/2,y+bh/2+3);
      }
    });
    // current time marker
    const cx=20+Math.min(this._step,tl.length-1)*tw*(tl[Math.min(this._step,tl.length-1)].time/Math.max(1,tl[Math.min(this._step,tl.length-1)].time+0.001));
    ctx.strokeStyle='#79c0ff';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(20+curStep*tw,10);ctx.lineTo(20+curStep*tw,H-10);ctx.stroke();
    // timeline
    const tln=document.getElementById('ganttTimeline');
    if(tln){let th='';for(let t=0;t<=maxT;t+=2)th+='<span style="width:'+(tw*2)+'px;display:inline-block;text-align:left">'+t+'</span>';tln.innerHTML=th;}
  },
  stepForward(){if(this._step<this._timeline.length-1){this._step++;this._renderStep();}},
  stepBack(){if(this._step>0){this._step--;this._renderStep();}},
  togglePlay(){
    this._playing=!this._playing;
    document.getElementById('csPlayBtn').textContent=this._playing?'⏸ Pause':'▶ Play';
    if(this._playing)this._playLoop();
  },
  _playLoop(){
    if(!this._playing)return;
    if(this._step>=this._timeline.length-1){this._playing=false;document.getElementById('csPlayBtn').textContent='▶ Play';return;}
    this._step++;this._renderStep();
    const spd=parseInt(document.getElementById('csSpeed').value)||4;
    const delay=Math.max(50,500/spd);
    setTimeout(()=>this._playLoop(),delay);
  },
  reset(){
    this._step=0;this._playing=false;
    document.getElementById('csPlayBtn').textContent='▶ Play';
    if(this._timeline.length)this._renderStep();
  },
  compareAll(){
    if(!this._procs.length){alert('Add processes first');return;}
    const algos=['FCFS','SJF','SRTF','RR','PRI_NP','PRI_P'];
    const q=parseInt(document.getElementById('csQuantum').value)||2;
    const results=algos.map(algo=>{
      const ps=this._procs.map((p,i)=>({...p,id:i,remaining:p.burst,startTime:-1,finishTime:-1,responseTime:-1}));
      const tl=this._simulate(ps,algo,q);
      const pr=tl._procs||[];
      const n=pr.length||1;
      const awt=pr.reduce((s,p)=>s+(p.waitingTime||0),0)/n;
      const att=pr.reduce((s,p)=>s+(p.turnaroundTime||0),0)/n;
      const art=pr.reduce((s,p)=>s+(p.responseTime||0),0)/n;
      const cs=tl.filter((s,i)=>i>0&&tl[i-1].running!==s.running).length;
      return{algo,awt:awt.toFixed(2),att:att.toFixed(2),art:art.toFixed(2),cs};
    });
    const best=results.reduce((b,r)=>parseFloat(r.awt)<parseFloat(b.awt)?r:b);
    const html='<table class="compare-table"><thead><tr><th>Algorithm</th><th>Avg Waiting</th><th>Avg Turnaround</th><th>Avg Response</th><th>Context Switches</th></tr></thead><tbody>'+
      results.map(r=>'<tr'+(r.algo===best.algo?' class="best"':'')+'><td><strong>'+r.algo+(r.algo===best.algo?' <span class="badge green">BEST</span>':'')+'</strong></td><td>'+r.awt+'</td><td>'+r.att+'</td><td>'+r.art+'</td><td>'+r.cs+'</td></tr>').join('')+'</tbody></table>'+
      '<div class="explanation-box mt"><strong>Best for this workload: '+best.algo+'</strong> with average waiting time of '+best.awt+' units. '+(best.algo==='SRTF'?'Preemptive SJF minimizes waiting time but has high context switch overhead.':best.algo==='FCFS'?'FCFS is simple but can cause convoy effect with long processes.':best.algo==='RR'?'Round Robin provides fairness and good response time for interactive systems.':'Priority scheduling respects process urgency.')+'</div>';
    document.getElementById('csCompare').innerHTML=html;
  }
};
// ─── Deadlock Playground ──────────────────────────────────────────────────────
const DLPg={
  _procs:[],_res:[],_edges:[],_pid:1,_rid:1,
  addProcess(){this._procs.push({id:'P'+this._pid,pid:this._pid++});this._render();},
  addResource(){
    const inst=parseInt(prompt('Instances for R'+this._rid,1))||1;
    this._res.push({id:'R'+this._rid,rid:this._rid++,instances:inst,available:inst});
    this._render();
  },
  openEdgeForm(){document.getElementById('dlEdgeForm').classList.remove('hidden');this._populateSelects();},
  closeEdgeForm(){document.getElementById('dlEdgeForm').classList.add('hidden');},
  _populateSelects(){
    const ps=document.getElementById('dlEdgeProc');
    const rs=document.getElementById('dlEdgeRes');
    const rr=document.getElementById('dlRecoverProc');
    ps.innerHTML=this._procs.map(p=>'<option value="'+p.id+'">'+p.id+'</option>').join('');
    rs.innerHTML=this._res.map(r=>'<option value="'+r.id+'">'+r.id+' ('+r.instances+' inst)</option>').join('');
    rr.innerHTML=this._procs.map(p=>'<option value="'+p.id+'">'+p.id+'</option>').join('');
  },
  addEdge(){
    const type=document.getElementById('dlEdgeType').value;
    const proc=document.getElementById('dlEdgeProc').value;
    const res=document.getElementById('dlEdgeRes').value;
    const inst=parseInt(document.getElementById('dlEdgeInst').value)||1;
    this._edges.push({type,proc,res,inst});
    this.closeEdgeForm();this._render();
  },
  clearAll(){this._procs=[];this._res=[];this._edges=[];this._pid=1;this._rid=1;this._render();},
  loadPreset(type){
    this.clearAll();
    if(type==='deadlock'){
      this._procs=[{id:'P1',pid:1},{id:'P2',pid:2}];
      this._res=[{id:'R1',rid:1,instances:1,available:0},{id:'R2',rid:2,instances:1,available:0}];
      this._edges=[{type:'alloc',proc:'P1',res:'R1',inst:1},{type:'alloc',proc:'P2',res:'R2',inst:1},{type:'req',proc:'P1',res:'R2',inst:1},{type:'req',proc:'P2',res:'R1',inst:1}];
      this._pid=3;this._rid=3;
    } else {
      this._procs=[{id:'P1',pid:1},{id:'P2',pid:2},{id:'P3',pid:3}];
      this._res=[{id:'R1',rid:1,instances:2,available:1},{id:'R2',rid:2,instances:1,available:0}];
      this._edges=[{type:'alloc',proc:'P1',res:'R1',inst:1},{type:'alloc',proc:'P2',res:'R2',inst:1},{type:'req',proc:'P3',res:'R1',inst:1}];
      this._pid=4;this._rid=3;
    }
    this._render();
  },
  detectDeadlock(){
    // Build wait-for graph
    const wfg={};
    this._procs.forEach(p=>{wfg[p.id]=[];});
    this._edges.filter(e=>e.type==='req').forEach(req=>{
      this._edges.filter(e=>e.type==='alloc'&&e.res===req.res).forEach(alloc=>{
        if(alloc.proc!==req.proc)wfg[req.proc].push(alloc.proc);
      });
    });
    // DFS cycle detection
    const visited={},inStack={};
    const cycle=[];
    const dfs=(node,path)=>{
      visited[node]=true;inStack[node]=true;path.push(node);
      for(const nb of (wfg[node]||[])){
        if(!visited[nb]&&dfs(nb,[...path]))return true;
        if(inStack[nb]){
          cycle.push(...path.slice(path.indexOf(nb)),nb);
          return true;
        }
      }
      inStack[node]=false;return false;
    };
    let deadlock=false;
    for(const p of this._procs){if(!visited[p.id]&&dfs(p.id,[])){deadlock=true;break;}}
    const res=document.getElementById('dlResult');
    if(res){
      res.className='dl-result '+(deadlock?'danger':'safe');
      res.textContent=deadlock?'DEADLOCK DETECTED! Cycle: '+cycle.join(' -> '):'SAFE STATE: No deadlock cycle detected.';
    }
    this._render(deadlock?cycle:[]);
  },
  recoverTerminate(){
    const pid=document.getElementById('dlRecoverProc').value;
    this._procs=this._procs.filter(p=>p.id!==pid);
    this._edges=this._edges.filter(e=>e.proc!==pid);
    this._render();alert('Process '+pid+' terminated. Resources released. Deadlock resolved.');
  },
  _render(cycle){
    // Lists
    const pl=document.getElementById('dlProcessList');
    if(pl)pl.innerHTML=this._procs.map(p=>'<div class="node-list-item"><span>'+p.id+'</span></div>').join('')||'<div style="color:var(--text-secondary);font-size:12px">No processes</div>';
    const rl=document.getElementById('dlResourceList');
    if(rl)rl.innerHTML=this._res.map(r=>'<div class="node-list-item"><span>'+r.id+' ('+r.instances+')</span></div>').join('')||'<div style="color:var(--text-secondary);font-size:12px">No resources</div>';
    const el=document.getElementById('dlEdgeList');
    if(el)el.innerHTML=this._edges.map(e=>'<div class="edge-item">'+(e.type==='alloc'?e.res+' -> '+e.proc+' [allocation '+e.inst+']':e.proc+' -> '+e.res+' [request '+e.inst+']')+'</div>').join('')||'<div style="color:var(--text-secondary);font-size:12px">No edges</div>';
    this._populateSelects();
    this._drawRAG(cycle||[]);
  },
  _drawRAG(cycle){
    const svg=document.getElementById('ragSvg');if(!svg)return;
    const W=svg.parentElement?svg.parentElement.offsetWidth||500:500,H=360;
    svg.setAttribute('viewBox','0 0 '+W+' '+H);
    const pCount=this._procs.length,rCount=this._res.length;
    const positions={};
    // layout: processes top row, resources bottom row
    this._procs.forEach((p,i)=>{positions[p.id]={x:W/(pCount+1)*(i+1),y:80,type:'proc'};});
    this._res.forEach((r,i)=>{positions[r.id]={x:W/(rCount+1)*(i+1),y:260,type:'res'};});
    let h='<defs><marker id="aArr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#58a6ff"/></marker><marker id="rArr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#d29922"/></marker><marker id="cArr" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto"><polygon points="0 0,8 3,0 6" fill="#f85149"/></marker></defs>';
    // edges
    this._edges.forEach(e=>{
      const from=e.type==='alloc'?positions[e.res]:positions[e.proc];
      const to=e.type==='alloc'?positions[e.proc]:positions[e.res];
      if(!from||!to)return;
      const inCycle=cycle.includes(e.proc)&&cycle.includes(e.res);
      const col=inCycle?'#f85149':(e.type==='alloc'?'#58a6ff':'#d29922');
      const mid=e.type==='alloc'?'aArr':'rArr';
      const dm=inCycle?'cArr':mid;
      h+='<line x1="'+from.x+'" y1="'+from.y+'" x2="'+to.x+'" y2="'+to.y+'" stroke="'+col+'" stroke-width="1.5" '+(e.type==='req'?'stroke-dasharray="5,3" ':'')+' marker-end="url(#'+dm+')" opacity="0.85"/>';
      const mx=(from.x+to.x)/2,my=(from.y+to.y)/2;
      h+='<text x="'+mx+'" y="'+my+'" text-anchor="middle" fill="'+col+'" font-size="9" font-family="monospace">'+e.inst+'</text>';
    });
    // resource nodes (rectangles with instance dots)
    this._res.forEach(r=>{
      const pos=positions[r.id];if(!pos)return;
      const inC=cycle.includes(r.id);
      h+='<rect x="'+(pos.x-30)+'" y="'+(pos.y-20)+'" width="60" height="40" rx="4" fill="#1c2128" stroke="'+(inC?'#f85149':'#d29922')+'" stroke-width="1.5"/>';
      h+='<text x="'+pos.x+'" y="'+(pos.y-6)+'" text-anchor="middle" fill="'+(inC?'#f85149':'#d29922')+'" font-size="11" font-weight="700" font-family="JetBrains Mono,monospace">'+r.id+'</text>';
      for(let i=0;i<r.instances;i++)h+='<circle cx="'+(pos.x-8+(i*10))+'" cy="'+(pos.y+10)+'" r="4" fill="'+(inC?'#f85149':'#d29922')+'"/>';
    });
    // process nodes (circles)
    this._procs.forEach(p=>{
      const pos=positions[p.id];if(!pos)return;
      const inC=cycle.includes(p.id);
      h+='<circle cx="'+pos.x+'" cy="'+pos.y+'" r="24" fill="#1c2128" stroke="'+(inC?'#f85149':'#58a6ff')+'" stroke-width="1.5"/>';
      h+='<text x="'+pos.x+'" y="'+(pos.y+5)+'" text-anchor="middle" fill="'+(inC?'#f85149':'#58a6ff')+'" font-size="12" font-weight="700" font-family="JetBrains Mono,monospace">'+p.id+'</text>';
    });
    svg.innerHTML=h;
  }
};
// ─── Banker's Algorithm ───────────────────────────────────────────────────────
const Banker={
  _n:5,_m:3,_alloc:[],_max:[],_avail:[],_safetySteps:[],_safetyIdx:0,
  loadExample(){
    document.getElementById('bkNumProc').value=5;
    document.getElementById('bkNumRes').value=3;
    this._n=5;this._m=3;
    this._alloc=[[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
    this._max=[[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
    this._avail=[3,3,2];
    this._buildTables();
  },
  buildTables(){
    this._n=parseInt(document.getElementById('bkNumProc').value)||5;
    this._m=parseInt(document.getElementById('bkNumRes').value)||3;
    this._alloc=Array.from({length:this._n},()=>Array(this._m).fill(0));
    this._max=Array.from({length:this._n},()=>Array(this._m).fill(0));
    this._avail=Array(this._m).fill(0);
    this._buildTables();
  },
  _buildTables(){
    const n=this._n,m=this._m;
    const resNames=Array.from({length:m},(_,i)=>String.fromCharCode(65+i));
    const mkTable=(id,data,title)=>{
      let h='<div class="matrix-wrap"><div class="card-subtitle">'+title+'</div><table><thead><tr><th>Process</th>'+resNames.map(r=>'<th>'+r+'</th>').join('')+'</tr></thead><tbody>';
      for(let i=0;i<n;i++){
        h+='<tr><td>P'+i+'</td>';
        for(let j=0;j<m;j++){
          h+='<td><input type="number" min="0" value="'+(data[i]?data[i][j]||0:0)+'" onchange="Banker._update(\''+id+'\','+i+','+j+',this.value)"></td>';
        }
        h+='</tr>';
      }
      h+='</tbody></table></div>';
      return h;
    };
    const tables=document.getElementById('bkTables');
    if(tables)tables.innerHTML=mkTable('alloc',this._alloc,'Allocation')+mkTable('max',this._max,'Maximum');
    // Available
    const avRow=document.getElementById('bkAvailable');
    if(avRow)avRow.innerHTML=resNames.map((r,j)=>'<div class="avail-cell"><div class="avail-label">'+r+'</div><input class="avail-input" type="number" min="0" value="'+(this._avail[j]||0)+'" onchange="Banker._avail['+j+']=parseInt(this.value)||0;Banker._calcNeed()"></div>').join('');
    this._calcNeed();
    // request proc select
    const rp=document.getElementById('bkReqProc');
    if(rp)rp.innerHTML=Array.from({length:n},(_,i)=>'<option value="'+i+'">P'+i+'</option>').join('');
  },
  _update(which,i,j,val){
    if(which==='alloc')this._alloc[i][j]=parseInt(val)||0;
    else this._max[i][j]=parseInt(val)||0;
    this._calcNeed();
  },
  _calcNeed(){
    const n=this._n,m=this._m;
    const need=Array.from({length:n},(_,i)=>Array.from({length:m},(_,j)=>(this._max[i]?this._max[i][j]:0)-(this._alloc[i]?this._alloc[i][j]:0)));
    const resNames=Array.from({length:m},(_,i)=>String.fromCharCode(65+i));
    const nt=document.getElementById('bkNeedTable');
    if(!nt)return;
    let h='<div class="matrix-wrap"><table><thead><tr><th>Process</th>'+resNames.map(r=>'<th>'+r+'</th>').join('')+'</tr></thead><tbody>';
    for(let i=0;i<n;i++){
      h+='<tr><td>P'+i+'</td>'+need[i].map(v=>'<td style="color:var(--accent-cyan)">'+Math.max(0,v)+'</td>').join('')+'</tr>';
    }
    h+='</tbody></table></div>';
    nt.innerHTML=h;
    this._need=need;
  },
  runSafety(){
    const n=this._n,m=this._m;
    const work=[...this._avail];
    const finish=Array(n).fill(false);
    const seq=[];
    this._safetySteps=[];
    let progress=true;
    while(progress){
      progress=false;
      for(let i=0;i<n;i++){
        if(!finish[i]){
          const need=this._need?this._need[i]:Array(m).fill(0);
          const canRun=need.every((v,j)=>Math.max(0,v)<=work[j]);
          if(canRun){
            const snap=[...work];
            for(let j=0;j<m;j++)work[j]+=(this._alloc[i]?this._alloc[i][j]:0);
            finish[i]=true;seq.push('P'+i);
            this._safetySteps.push({step:seq.length,proc:'P'+i,work:[...work],finish:[...finish],workBefore:snap,reason:'Need of P'+i+' <= Work. Allocated resources released back to Work.'});
            progress=true;
          }
        }
      }
    }
    this._safetyIdx=0;
    this._renderSafety(finish.every(Boolean),seq);
  },
  _renderSafety(safe,seq){
    const log=document.getElementById('bkSafetyLog');
    const res=document.getElementById('bkSafetyResult');
    if(!log)return;
    const resNames=Array.from({length:this._m},(_,i)=>String.fromCharCode(65+i));
    log.innerHTML='<div class="safety-row safety-header"><span>Step</span><span>Process</span><span>Work Before</span><span>Process Selected</span><span>Reason</span></div>'+
      this._safetySteps.slice(0,this._safetyIdx+1).map((s,i)=>'<div class="safety-row'+(i===this._safetyIdx?' highlight':'')+'"><span>'+s.step+'</span><span style="color:var(--accent-blue)"><strong>'+s.proc+'</strong></span><span class="mono" style="font-size:11px">['+s.workBefore.join(',')+']</span><span style="color:var(--accent-green)">'+s.proc+' allocated</span><span style="font-size:11px">'+esc(s.reason)+'</span></div>').join('');
    if(res){
      res.className='safety-result '+(safe?'safe':'unsafe')+' hidden';
      res.classList.remove('hidden');
      res.textContent=safe?'SAFE STATE — Safe sequence: '+seq.join(' → '):'UNSAFE STATE — System may deadlock. No safe sequence found.';
    }
  },
  stepForward(){
    if(this._safetyIdx<this._safetySteps.length-1){this._safetyIdx++;}
    const safe=this._safetyIdx>=this._safetySteps.length-1;
    this._renderSafety(safe,this._safetySteps.map(s=>s.proc));
  },
  resetSafety(){this._safetyIdx=0;this._calcNeed();const log=document.getElementById('bkSafetyLog');if(log)log.innerHTML='';const res=document.getElementById('bkSafetyResult');if(res)res.classList.add('hidden');},
  requestResources(){
    const pi=parseInt(document.getElementById('bkReqProc').value)||0;
    const reqStr=document.getElementById('bkReqVec').value;
    const req=reqStr.split(',').map(v=>parseInt(v.trim())||0);
    const res=document.getElementById('bkReqResult');if(!res)return;
    res.classList.remove('hidden');
    const need=this._need?this._need[pi]:Array(this._m).fill(0);
    // Check request <= need
    if(req.some((v,j)=>v>Math.max(0,need[j]||0))){res.textContent='DENIED: Request exceeds Need. Process claimed it needs less.';res.style.borderLeftColor='var(--accent-red)';return;}
    // Check request <= available
    if(req.some((v,j)=>v>(this._avail[j]||0))){res.textContent='DENIED: Insufficient resources. Must wait (Available: ['+this._avail.join(',')+'])';res.style.borderLeftColor='var(--accent-amber)';return;}
    // Tentatively allocate
    const newAvail=this._avail.map((v,j)=>v-req[j]);
    const newAlloc=this._alloc.map((row,i)=>i===pi?row.map((v,j)=>v+req[j]):row);
    const newMax=this._max;
    const newNeed=newAlloc.map((row,i)=>row.map((v,j)=>(newMax[i]?newMax[i][j]:0)-v));
    // Safety check on new state
    const work=[...newAvail];const finish=Array(this._n).fill(false);const seq=[];let progress=true;
    while(progress){progress=false;for(let i=0;i<this._n;i++){if(!finish[i]&&newNeed[i].every((v,j)=>Math.max(0,v)<=work[j])){for(let j=0;j<this._m;j++)work[j]+=newAlloc[i][j];finish[i]=true;seq.push('P'+i);progress=true;}}}
    const safe=finish.every(Boolean);
    if(safe){
      this._alloc=newAlloc;this._avail=newAvail;this._need=newNeed;this._buildTables();
      res.textContent='GRANTED: Request satisfies safety check. New safe sequence: '+seq.join(' → ');
      res.style.borderLeftColor='var(--accent-green)';
    } else {
      res.textContent='DENIED: Granting this request leads to an UNSAFE STATE. Request rolled back to prevent potential deadlock.';
      res.style.borderLeftColor='var(--accent-red)';
    }
  }
};
// ─── Memory Simulator ─────────────────────────────────────────────────────────
const MemSim={
  _blocks:[],_total:1024,_algo:'firstfit',_mode:'variable',
  initMemory(){
    this._total=parseInt(document.getElementById('memTotal').value)||1024;
    this._algo=document.getElementById('memAlgo').value;
    this._mode=document.getElementById('memMode').value;
    if(this._mode==='fixed'){
      const sizes=(document.getElementById('fixedPartSizes').value||'256,256,256,256').split(',').map(v=>parseInt(v.trim())||256);
      this._blocks=sizes.map(s=>({size:s,free:true,name:''}));
    } else {
      this._blocks=[{size:this._total,free:true,name:''}];
    }
    this._render();
  },
  allocate(){
    const name=document.getElementById('mpName').value||'P';
    const size=parseInt(document.getElementById('mpSize').value)||100;
    const res=document.getElementById('mpResult');
    const algo=document.getElementById('memAlgo').value;
    let idx=-1;
    if(algo==='firstfit') idx=this._blocks.findIndex(b=>b.free&&b.size>=size);
    else if(algo==='bestfit'){let best=Infinity;this._blocks.forEach((b,i)=>{if(b.free&&b.size>=size&&b.size-size<best){best=b.size-size;idx=i;}});}
    else{let worst=-1;this._blocks.forEach((b,i)=>{if(b.free&&b.size>=size&&b.size>worst){worst=b.size;idx=i;}});}
    if(idx===-1){if(res){res.classList.remove('hidden');res.textContent='Allocation FAILED: No free block large enough for '+size+'KB ('+name+'). External fragmentation detected.';res.style.borderLeftColor='var(--accent-red)';}return;}
    const b=this._blocks[idx];
    const frag=b.size-size;
    if(this._mode==='variable'&&frag>0){
      this._blocks.splice(idx,1,{size,free:false,name,color:procColor(this._blocks.filter(x=>!x.free).length)},{size:frag,free:true,name:''});
    } else {
      b.free=false;b.name=name;b.color=procColor(this._blocks.filter(x=>!x.free).length);
    }
    if(res){res.classList.remove('hidden');res.textContent='Allocated '+size+'KB to '+name+' using '+algo.toUpperCase()+'. Block at index '+idx+'. Internal fragmentation: '+(this._mode==='fixed'?frag:0)+'KB.';res.style.borderLeftColor='var(--accent-green)';}
    this._render();
  },
  compact(){
    if(this._mode!=='variable'){alert('Compaction only for variable partitioning');return;}
    const used=this._blocks.filter(b=>!b.free);
    const totalFree=this._blocks.filter(b=>b.free).reduce((s,b)=>s+b.size,0);
    this._blocks=[...used,{size:totalFree,free:true,name:''}];
    this._render();
  },
  _render(){
    const vis=document.getElementById('memVisual');if(!vis)return;
    const total=this._blocks.reduce((s,b)=>s+b.size,0)||this._total;
    vis.innerHTML=this._blocks.map(b=>{
      const pct=(b.size/total*100).toFixed(1);
      const bg=b.free?'':(b.color||'#58a6ff');
      return '<div class="mem-block '+(b.free?'free':'allocated')+'" style="width:'+pct+'%;'+(bg?'background:'+bg+';':'')+'">'+esc(b.free?'FREE\n'+b.size+'KB':b.name+'\n'+b.size+'KB')+'</div>';
    }).join('');
    const used=this._blocks.filter(b=>!b.free).reduce((s,b)=>s+b.size,0);
    const free=this._blocks.filter(b=>b.free).reduce((s,b)=>s+b.size,0);
    const extFrag=this._blocks.filter(b=>b.free).length>1?'Yes':'No';
    document.getElementById('memStats').innerHTML='<span>Used: <strong>'+used+'KB</strong></span><span>Free: <strong>'+free+'KB</strong></span><span>Blocks: <strong>'+this._blocks.length+'</strong></span><span>Ext Fragmentation: <strong>'+extFrag+'</strong></span>';
  }
};

// ─── Paging Simulator ─────────────────────────────────────────────────────────
const PageSim={
  _frames:[],_numFrames:16,_pageSize:4,_pageTable:{},_procs:{},
  init(){
    this._numFrames=parseInt(document.getElementById('pgFrames').value)||16;
    this._pageSize=parseInt(document.getElementById('pgPageSize').value)||4;
    this._frames=Array(this._numFrames).fill(null);
    this._pageTable={};this._procs={};
    this._render();
  },
  loadProcess(){
    const name=document.getElementById('pgProcName').value||'ProcA';
    const size=parseInt(document.getElementById('pgProcSize').value)||20;
    const pages=Math.ceil(size/this._pageSize);
    let allocated=[];
    for(let i=0;i<pages;i++){
      const frame=this._frames.indexOf(null);
      if(frame===-1){alert('Out of frames');break;}
      this._frames[frame]={proc:name,page:i};
      if(!this._pageTable[name])this._pageTable[name]=[];
      this._pageTable[name][i]=frame;
      allocated.push(frame);
    }
    this._procs[name]={size,pages,color:procColor(Object.keys(this._procs).length)};
    this._render();
    // populate translator
    const tp=document.getElementById('pgTransProc');
    if(tp)tp.innerHTML=Object.keys(this._procs).map(n=>'<option value="'+n+'">'+n+'</option>').join('');
  },
  translate(){
    const va=parseInt(document.getElementById('pgVirtAddr').value)||0;
    const proc=document.getElementById('pgTransProc').value;
    const res=document.getElementById('pgTransResult');
    if(!proc||!this._pageTable[proc]){if(res){res.classList.remove('hidden');res.textContent='No process selected or process not loaded.';}return;}
    const pageNum=Math.floor(va/this._pageSize);
    const offset=va%this._pageSize;
    const frame=this._pageTable[proc][pageNum];
    if(frame===undefined){if(res){res.classList.remove('hidden');res.textContent='PAGE FAULT: Virtual address '+va+' maps to page '+pageNum+' which is not loaded in memory.';}return;}
    const pa=frame*this._pageSize+offset;
    if(res){
      res.classList.remove('hidden');
      res.textContent='Virtual Address: '+va+' | Page Number: '+pageNum+' | Offset: '+offset+' | Frame: '+frame+' | Physical Address: '+pa+' | Calculation: ('+frame+' * '+this._pageSize+' KB) + '+offset+' = '+pa;
      res.style.borderLeftColor='var(--accent-green)';
    }
  },
  _render(){
    const fg=document.getElementById('pgFrameGrid');
    if(fg)fg.innerHTML=this._frames.map((f,i)=>{
      const proc=this._procs[f?f.proc:''];
      const bg=f&&proc?proc.color:'';
      const lbl=f?f.proc.substring(0,3)+'p'+f.page:String(i);
      const st=bg?'background:'+bg+'33;border-color:'+bg+';color:'+bg+';':'';
      return '<div class="frame-cell'+(f?' used':'') +'" style="'+st+'" title="Frame '+i+(f?': '+f.proc+' pg'+f.page:'')+'">'+ lbl+'</div>';
    }).join('');
    const tb=document.getElementById('pgPageTableBody');
    if(tb){
      let rows='';
      Object.keys(this._pageTable).forEach(proc=>{
        (this._pageTable[proc]||[]).forEach((frame,page)=>{
          rows+='<tr><td>'+page+'</td><td>'+frame+'</td><td>'+esc(proc)+'</td><td><span class="badge green">Valid</span></td></tr>';
        });
      });
      tb.innerHTML=rows||'<tr><td colspan=4 style="text-align:center;color:var(--text-secondary)">No pages loaded</td></tr>';
    }
  }
};
// ─── Page Replacement ─────────────────────────────────────────────────────────
const PageReplace={
  _steps:[],_idx:0,_playing:false,currentAlgo:'FIFO',
  loadBelady(){document.getElementById('prRefStr').value='1,2,3,4,1,2,5,1,2,3,4,5';document.getElementById('prFrames').value=3;},
  run(){
    const frames=parseInt(document.getElementById('prFrames').value)||3;
    const refStr=(document.getElementById('prRefStr').value||'').split(',').map(v=>parseInt(v.trim())).filter(v=>!isNaN(v));
    const algo=this.currentAlgo;
    if(!refStr.length){alert('Enter a reference string');return;}
    this._steps=this._simulate(refStr,frames,algo);
    this._idx=this._steps.length-1;
    this._render();
  },
  _simulate(refs,nf,algo){
    const steps=[];let faults=0,hits=0;
    let frameState=Array(nf).fill(null);
    let fifoQueue=[],lruOrder=[],futureUse={};
    if(algo==='OPT'){refs.forEach((r,i)=>{if(!futureUse[r])futureUse[r]=[];futureUse[r].push(i);});}
    refs.forEach((page,i)=>{
      const snap=[...frameState];
      let fault=false,replaced=null;
      if(frameState.includes(page)){hits++;lruOrder=lruOrder.filter(x=>x!==page);lruOrder.push(page);}
      else{
        fault=true;faults++;
        const emptySlot=frameState.indexOf(null);
        if(emptySlot!==-1){
          frameState[emptySlot]=page;
          if(algo==='FIFO')fifoQueue.push(page);
          if(algo==='LRU'){lruOrder=lruOrder.filter(x=>x!==page);lruOrder.push(page);}
        } else {
          if(algo==='FIFO'){replaced=fifoQueue.shift();fifoQueue.push(page);}
          else if(algo==='LRU'){replaced=lruOrder.shift();lruOrder.push(page);}
          else{// OPT
            let maxIdx=-1,victimFrame=0;
            frameState.forEach((f,fi)=>{
              const fu=(futureUse[f]||[]).filter(x=>x>i);
              const next=fu.length?fu[0]:Infinity;
              if(next>maxIdx){maxIdx=next;victimFrame=fi;}
            });
            replaced=frameState[victimFrame];
          }
          frameState=frameState.map(f=>f===replaced?page:f);
          if(algo==='LRU'){lruOrder=lruOrder.filter(x=>x!==replaced&&x!==page);lruOrder.push(page);}
        }
      }
      steps.push({page,frames:[...frameState],fault,hits,faults,replaced});
    });
    steps._faults=faults;steps._hits=hits;
    return steps;
  },
  _render(){
    const steps=this._steps;if(!steps.length)return;
    const vis=this._idx;
    const nf=parseInt(document.getElementById('prFrames').value)||3;
    const faults=steps[vis]?steps[vis].faults:0;
    const hits=steps[vis]?steps[vis].hits:0;
    document.getElementById('prStats').textContent='Faults: '+faults+' | Hits: '+hits+' | Hit Ratio: '+((vis+1>0?hits/(vis+1)*100:0).toFixed(1))+'%';
    // Build header
    const head=document.getElementById('prHead');
    const body=document.getElementById('prBody');
    if(!head||!body)return;
    head.innerHTML='<tr><th>Step</th><th>Page</th>'+Array.from({length:nf},(_,i)=>'<th>F'+i+'</th>').join('')+'<th>Result</th></tr>';
    body.innerHTML=steps.slice(0,vis+1).map((s,i)=>{
      const cells=s.frames.map(f=>'<td class="'+(i===vis?'current':'')+(s.fault&&s.replaced===f?'':'')+'">'+(f!==null?f:'—')+'</td>').join('');
      return '<tr><td>'+(i+1)+'</td><td><strong>'+s.page+'</strong></td>'+cells+'<td class="'+(s.fault?'fault':'hit')+'">'+(s.fault?'FAULT':'HIT')+'</td></tr>';
    }).join('');
    body.scrollTop=body.scrollHeight;
  },
  stepForward(){if(this._idx<this._steps.length-1){this._idx++;this._render();}},
  reset(){this._idx=0;if(this._steps.length)this._render();},
  togglePlay(){
    this._playing=!this._playing;
    document.getElementById('prPlayBtn').textContent=this._playing?'⏸ Pause':'▶ Play';
    if(this._playing)this._loop();
  },
  _loop(){
    if(!this._playing)return;
    if(this._idx>=this._steps.length-1){this._playing=false;document.getElementById('prPlayBtn').textContent='▶ Play';return;}
    this._idx++;this._render();
    setTimeout(()=>this._loop(),400);
  },
  compareAll(){
    const refs=(document.getElementById('prRefStr').value||'').split(',').map(v=>parseInt(v.trim())).filter(v=>!isNaN(v));
    const nf=parseInt(document.getElementById('prFrames').value)||3;
    if(!refs.length)return;
    const algos=['FIFO','LRU','OPT'];
    const res=algos.map(a=>{const s=this._simulate(refs,nf,a);return{algo:a,faults:s._faults,hits:s._hits};});
    const cr=document.getElementById('prCompareResult');
    const cb=document.getElementById('prCompareBody');
    if(!cr||!cb)return;
    cr.classList.remove('hidden');
    const best=res.reduce((b,r)=>r.faults<b.faults?r:b);
    cb.innerHTML='<table class="compare-table"><thead><tr><th>Algorithm</th><th>Page Faults</th><th>Hits</th><th>Hit Ratio</th></tr></thead><tbody>'+
      res.map(r=>'<tr'+(r.algo===best.algo?' class="best"':'')+'><td>'+r.algo+(r.algo===best.algo?' <span class="badge green">BEST</span>':'')+'</td><td style="color:var(--accent-red)"><strong>'+r.faults+'</strong></td><td style="color:var(--accent-green)">'+r.hits+'</td><td>'+(refs.length?((r.hits/refs.length)*100).toFixed(1)+'%':'--')+'</td></tr>').join('')+'</tbody></table>'+
      '<div class="explanation-box mt">Optimal algorithm achieves minimum faults ('+best.faults+') since it replaces the page not needed for the longest time. In practice, Optimal is unrealizable as it requires future knowledge. LRU approximates it using past access patterns.</div>';
  }
};
// ─── Disk Scheduler ───────────────────────────────────────────────────────────
const DiskSim={
  _seq:[],_step:0,_playing:false,currentAlgo:'FCFS',_maxCyl:199,_animId:null,
  run(){
    const start=parseInt(document.getElementById('dkStart').value)||53;
    const reqs=(document.getElementById('dkRequests').value||'').split(',').map(v=>parseInt(v.trim())).filter(v=>!isNaN(v));
    const max=parseInt(document.getElementById('dkMax').value)||199;
    const dir=document.getElementById('dkDir').value==='up';
    this._maxCyl=max;
    const algo=this.currentAlgo;
    let result;
    if(algo==='FCFS')result=this._fcfs(start,reqs);
    else if(algo==='SSTF')result=this._sstf(start,reqs);
    else if(algo==='SCAN')result=this._scan(start,reqs,max,dir);
    else if(algo==='CSCAN')result=this._cscan(start,reqs,max,dir);
    else if(algo==='LOOK')result=this._look(start,reqs,dir);
    else if(algo==='CLOOK')result=this._clook(start,reqs,dir);
    this._seq=result.seq;this._step=0;
    this._renderResults(result);
    this._drawDisk();
  },
  _fcfs(s,reqs){const seq=[s,...reqs];let m=0;for(let i=1;i<seq.length;i++)m+=Math.abs(seq[i]-seq[i-1]);return{seq,total:m,avg:(m/reqs.length).toFixed(1),explain:'FCFS services requests in arrival order. Simple but can cause large head movements (convoy effect). Total: '+m+' cylinders.'};},
  _sstf(s,reqs){const seq=[s],pending=[...reqs];let cur=s,m=0;while(pending.length){const ni=pending.reduce((bi,v,i)=>Math.abs(v-cur)<Math.abs(pending[bi]-cur)?i:bi,0);m+=Math.abs(pending[ni]-cur);cur=pending[ni];seq.push(cur);pending.splice(ni,1);}return{seq,total:m,avg:(m/reqs.length).toFixed(1),explain:'SSTF always serves the nearest pending request. Reduces average seek time but can cause starvation of distant requests. Total: '+m+' cylinders.'};},
  _scan(s,reqs,max,up){const seq=[s];const sorted=[...reqs].sort((a,b)=>a-b);const left=sorted.filter(r=>r<s),right=sorted.filter(r=>r>=s);let m=0,cur=s;
    if(up){right.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});if(left.length){m+=Math.abs(max-cur);cur=max;seq.push(cur);[...left].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}}
    else{[...left].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});if(right.length){m+=Math.abs(0-cur);cur=0;seq.push(cur);right.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}}
    return{seq,total:m,avg:(m/reqs.length).toFixed(1),explain:'SCAN (Elevator) moves in one direction servicing requests, reaches end, then reverses. Avoids starvation. Total: '+m+' cylinders.'};},
  _cscan(s,reqs,max,up){const seq=[s];const sorted=[...reqs].sort((a,b)=>a-b);const left=sorted.filter(r=>r<s),right=sorted.filter(r=>r>=s);let m=0,cur=s;
    if(up){right.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});if(left.length){m+=Math.abs(max-cur);cur=max;seq.push(cur);m+=max;cur=0;seq.push(0);left.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}}
    else{[...left].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});if(right.length){m+=cur;cur=0;seq.push(0);m+=max;cur=max;seq.push(max);[...right].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}}
    return{seq,total:m,avg:(m/reqs.length).toFixed(1),explain:'C-SCAN services only in one direction then jumps back to start. Provides more uniform wait times. Total: '+m+' cylinders.'};},
  _look(s,reqs,up){const seq=[s];const sorted=[...reqs].sort((a,b)=>a-b);const left=sorted.filter(r=>r<s),right=sorted.filter(r=>r>=s);let m=0,cur=s;
    if(up){right.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});[...left].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}
    else{[...left].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});right.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}
    return{seq,total:m,avg:(m/reqs.length).toFixed(1),explain:'LOOK is like SCAN but only goes as far as the last request in each direction (no wasted travel to disk end). Total: '+m+' cylinders.'};},
  _clook(s,reqs,up){const seq=[s];const sorted=[...reqs].sort((a,b)=>a-b);const left=sorted.filter(r=>r<s),right=sorted.filter(r=>r>=s);let m=0,cur=s;
    if(up){right.forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});if(left.length){const jump=cur-left[0];m+=jump;cur=left[0];seq.push(cur);left.slice(1).forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}}
    else{[...left].reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});if(right.length){const last=right[right.length-1];m+=Math.abs(last-cur);cur=last;seq.push(cur);[...right].slice(0,-1).reverse().forEach(r=>{m+=Math.abs(r-cur);cur=r;seq.push(cur);});}}
    return{seq,total:m,avg:(m/reqs.length).toFixed(1),explain:'C-LOOK is like C-SCAN but only travels as far as the last request. Most efficient variant. Total: '+m+' cylinders.'};},
  _renderResults(r){
    document.getElementById('dkStats').innerHTML='<div class="kpi-card"><div class="kpi-val text-cyan">'+r.total+'</div><div class="kpi-label">Total Movement</div></div><div class="kpi-card"><div class="kpi-val">'+r.avg+'</div><div class="kpi-label">Avg Seek</div></div>';
    document.getElementById('dkSequence').textContent=this._seq.join(' -> ');
    document.getElementById('dkExplain').textContent=r.explain;
  },
  stepForward(){if(this._step<this._seq.length-1){this._step++;this._drawDisk();}document.getElementById('dkCurrentLabel').textContent='Head at: '+this._seq[this._step];},
  reset(){this._step=0;this._drawDisk();},
  togglePlay(){
    this._playing=!this._playing;
    document.getElementById('dkPlayBtn').textContent=this._playing?'⏸ Pause':'▶ Play';
    if(this._playing)this._playLoop();
  },
  _playLoop(){
    if(!this._playing)return;
    if(this._step>=this._seq.length-1){this._playing=false;document.getElementById('dkPlayBtn').textContent='▶ Play';return;}
    this._step++;this._drawDisk();
    document.getElementById('dkCurrentLabel').textContent='Head at: '+this._seq[this._step];
    setTimeout(()=>this._playLoop(),300);
  },
  _drawDisk(){
    const canvas=document.getElementById('diskCanvas');if(!canvas||!this._seq.length)return;
    const W=320,H=400;const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);
    const max=this._maxCyl,pad=30,bw=16;
    const toY=c=>pad+(c/max)*(H-2*pad);
    // draw cylinder axis
    ctx.strokeStyle='#30363d';ctx.lineWidth=1;
    ctx.beginPath();ctx.moveTo(bw,pad);ctx.lineTo(bw,H-pad);ctx.stroke();
    // axis labels
    for(let c=0;c<=max;c+=50){const y=toY(c);ctx.fillStyle='#8b949e';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='right';ctx.fillText(c,bw-3,y+3);}
    // draw path
    const visible=this._seq.slice(0,this._step+1);
    if(visible.length>1){
      ctx.strokeStyle='#58a6ff';ctx.lineWidth=1.5;ctx.setLineDash([]);
      ctx.beginPath();
      visible.forEach((c,i)=>{const x=bw+20+i*((W-bw-25)/(Math.max(this._seq.length-1,1)));const y=toY(c);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});
      ctx.stroke();
      // dots
      visible.forEach((c,i)=>{
        const x=bw+20+i*((W-bw-25)/(Math.max(this._seq.length-1,1)));const y=toY(c);
        ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);
        ctx.fillStyle=i===visible.length-1?'#f85149':'#58a6ff';
        ctx.fill();
        ctx.fillStyle='#e6edf3';ctx.font='9px JetBrains Mono,monospace';ctx.textAlign='center';
        ctx.fillText(c,x,y-8);
      });
    }
  },
  compareAll(){
    const start=parseInt(document.getElementById('dkStart').value)||53;
    const reqs=(document.getElementById('dkRequests').value||'').split(',').map(v=>parseInt(v.trim())).filter(v=>!isNaN(v));
    const max=parseInt(document.getElementById('dkMax').value)||199;
    const algos=['FCFS','SSTF','SCAN','CSCAN','LOOK','CLOOK'];
    const fn={FCFS:this._fcfs,SSTF:this._sstf,SCAN:(s,r)=>this._scan(s,r,max,true),CSCAN:(s,r)=>this._cscan(s,r,max,true),LOOK:(s,r)=>this._look(s,r,true),CLOOK:(s,r)=>this._clook(s,r,true)};
    const results=algos.map(a=>({algo:a,...fn[a].call(this,start,reqs)}));
    const best=results.reduce((b,r)=>r.total<b.total?r:b);
    document.getElementById('dkCompare').innerHTML='<table class="compare-table"><thead><tr><th>Algorithm</th><th>Total Movement</th><th>Avg Seek</th></tr></thead><tbody>'+
      results.map(r=>'<tr'+(r.algo===best.algo?' class="best"':'')+'><td>'+r.algo+(r.algo===best.algo?' <span class="badge green">BEST</span>':'')+'</td><td>'+r.total+'</td><td>'+r.avg+'</td></tr>').join('')+'</tbody></table>';
  }
};
// ─── System Call Simulator ────────────────────────────────────────────────────
const SyscallSim={
  _calls:[
    {name:'fork()',num:57,kernel:'Process Management',desc:'Creates a child process by duplicating the calling process.',args:'void',ret:'pid_t: 0 in child, child PID in parent, -1 on error'},
    {name:'exec()',num:59,kernel:'Process Management',desc:'Replaces the current process image with a new program.',args:'const char *pathname, char *const argv[]',ret:'Does not return on success; -1 on error'},
    {name:'exit()',num:60,kernel:'Process Management',desc:'Terminates the calling process with an exit status code.',args:'int status',ret:'Does not return'},
    {name:'open()',num:2,kernel:'VFS / File System',desc:'Opens a file and returns a file descriptor.',args:'const char *pathname, int flags, mode_t mode',ret:'int: file descriptor or -1'},
    {name:'read()',num:0,kernel:'VFS / File System',desc:'Reads bytes from a file descriptor into a buffer.',args:'int fd, void *buf, size_t count',ret:'ssize_t: bytes read or -1'},
    {name:'write()',num:1,kernel:'VFS / File System',desc:'Writes bytes from a buffer to a file descriptor.',args:'int fd, const void *buf, size_t count',ret:'ssize_t: bytes written or -1'},
    {name:'close()',num:3,kernel:'VFS / File System',desc:'Closes a file descriptor, freeing it for reuse.',args:'int fd',ret:'int: 0 on success, -1 on error'},
    {name:'mmap()',num:9,kernel:'Memory Management',desc:'Maps files or devices into virtual memory address space.',args:'void *addr, size_t len, int prot, int flags, int fd, off_t offset',ret:'void*: mapped address or MAP_FAILED'}
  ],
  _active:-1,
  init(){
    const list=document.getElementById('syscallList');if(!list||list.children.length>0)return;
    list.innerHTML=this._calls.map((c,i)=>'<div class="syscall-item" onclick="SyscallSim.invoke('+i+')"><div><div class="sc-name">'+esc(c.name)+'</div><div class="sc-desc">'+esc(c.desc)+'</div></div><span class="sc-num">sys_'+c.num+'</span></div>').join('');
  },
  async invoke(i){
    document.querySelectorAll('.syscall-item').forEach((el,j)=>el.classList.toggle('active',j===i));
    this._active=i;
    const c=this._calls[i];
    const layers=[{id:'sp0',label:'User Application (Ring 3)'},{id:'sp1',label:'System Call Interface — syscall #'+c.num+' ('+c.name.replace('()','')+')'},{id:'sp2',label:'Kernel Subsystem: '+c.kernel},{id:'sp3',label:'Return: '+c.ret}];
    // reset
    layers.forEach(l=>{const el=document.getElementById(l.id);if(el){el.className='sp-layer';el.textContent=l.label;}});
    [0,1,2,3].forEach(j=>{const el=document.getElementById('spa'+j);if(el)el.className='sp-arrow';});
    // animate
    for(let step=0;step<4;step++){
      await new Promise(r=>setTimeout(r,400));
      const el=document.getElementById('sp'+step);
      if(el){el.classList.add('active');el.textContent=layers[step].label;}
      if(step<3){const arr=document.getElementById('spa'+step);if(arr)arr.classList.add('active');}
    }
    const detail=document.getElementById('syscallDetail');
    if(detail){
      detail.classList.remove('hidden');
      detail.textContent='syscall: '+c.name+' | Linux x86-64 number: '+c.num+' | Arguments: '+c.args+' | Returns: '+c.ret+' | Kernel subsystem: '+c.kernel+' | Windows host equivalent: This is an educational simulation. The DFS coordinator uses Win32 API (CreateProcess, ReadFile, WriteFile) to achieve the same goals.';
    }
  }
};

// ─── Linux Terminal ───────────────────────────────────────────────────────────
const Terminal={
  _history:[],_histIdx:-1,_initialized:false,
  init(){
    if(this._initialized)return;
    this._initialized=true;
    const input=document.getElementById('termInput');
    if(!input)return;
    this._print('Linux OS Concepts Simulator Terminal','hdr');
    this._print('Running on Windows-native DFS | Type "help" for commands','out');
    this._print('','out');
    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){this._exec(input.value.trim());input.value='';this._histIdx=-1;}
      else if(e.key==='ArrowUp'){e.preventDefault();if(this._histIdx<this._history.length-1){this._histIdx++;input.value=this._history[this._history.length-1-this._histIdx]||'';}}
      else if(e.key==='ArrowDown'){e.preventDefault();if(this._histIdx>0){this._histIdx--;input.value=this._history[this._history.length-1-this._histIdx]||'';}else{this._histIdx=-1;input.value='';}}
      else if(e.key==='Tab'){e.preventDefault();this._complete(input);}
    });
    input.focus();
  },
  _print(text,cls='out'){
    const out=document.getElementById('termOutput');if(!out)return;
    const line=document.createElement('div');
    line.className='term-line '+(cls||'out');
    line.textContent=text;
    out.appendChild(line);
    out.scrollTop=out.scrollHeight;
  },
  _printCmd(cmd){
    const out=document.getElementById('termOutput');if(!out)return;
    const line=document.createElement('div');
    line.className='term-line cmd';
    line.innerHTML='<span style="color:var(--accent-green)">root@linux-sim:~#</span> '+esc(cmd);
    out.appendChild(line);
  },
  _complete(input){
    const cmds=['help','ps','ps aux','ps -ef','top','free -h','ls','ls -l','ls -la','ls /proc','pwd','cat /proc/meminfo','cat /proc/cpuinfo','df -h','lsblk','uname -a','whoami','date','uptime','clear','history'];
    const val=input.value;
    const matches=cmds.filter(c=>c.startsWith(val));
    if(matches.length===1)input.value=matches[0];
    else if(matches.length>1)this._print(matches.join('  '),'out');
  },
  async _exec(cmd){
    if(!cmd)return;
    this._history.push(cmd);
    this._printCmd(cmd);
    const parts=cmd.split(/\s+/);
    const c=parts[0];
    if(c==='clear'){document.getElementById('termOutput').innerHTML='';return;}
    if(c==='help'){
      this._print('Available commands:','hdr');
      ['ps [aux|-ef]  Show processes','top           Live process view','free -h       Memory usage','ls [-l|-la]   List DFS files','ls /proc      Show /proc entries','df -h         Storage usage','lsblk         Block devices','cat /proc/meminfo  Memory info','cat /proc/cpuinfo  CPU info','uname -a      Kernel info','whoami        Current user','date          Current date','uptime        System uptime','history       Command history','clear         Clear terminal'].forEach(l=>this._print('  '+l,'out'));
      return;
    }
    if(c==='whoami'){this._print('root','ok');return;}
    if(c==='uname'&&parts[1]==='-a'){this._print('Linux linux-sim 6.1.0-dfs-sim #1 SMP x86_64 GNU/Linux (Windows-native simulation)','ok');return;}
    if(c==='pwd'){this._print('/home/root','ok');return;}
    if(c==='date'){this._print(new Date().toString(),'ok');return;}
    if(c==='uptime'){const s=Math.floor((Date.now()-DashAPI.startTime||0)/1000);this._print('up '+(Math.floor(s/60))+'m '+(s%60)+'s, 1 user, load average: 0.10 0.12 0.08','ok');return;}
    if(c==='history'){this._history.forEach((h,i)=>this._print((i+1).toString().padStart(4)+' '+h,'out'));return;}
    if(c==='ps'){await this._cmdPs(parts);return;}
    if(c==='top'){await this._cmdTop();return;}
    if(c==='free'){await this._cmdFree();return;}
    if(c==='ls'){await this._cmdLs(parts);return;}
    if(c==='df'){await this._cmdDf();return;}
    if(c==='lsblk'){await this._cmdLsblk();return;}
    if(c==='cat'){await this._cmdCat(parts.slice(1).join(' '));return;}
    if(c==='mkdir'||c==='touch'||c==='rm'){this._print((c==='rm'?'rm: cannot remove: permission denied (simulation mode)':c+': created (simulation).'),'ok');return;}
    this._print(c+': command not found','err');
  },
  async _cmdPs(parts){
    const nodes=await DashAPI.get('/api/nodes')||[];
    const flag=parts[1]||'';
    const hdr=flag?'USER       PID  %CPU %MEM    VSZ   RSS STAT START   TIME COMMAND':'  PID TTY          TIME CMD';
    this._print(hdr,'hdr');
    nodes.forEach(n=>{
      const pid=n.process_id||'????';
      if(flag)this._print('root    '+String(pid).padEnd(7)+'  0.2  1.4  12340  4321 S    00:00   0:00 '+n.name,'out');
      else this._print(String(pid).padStart(5)+' pts/0    00:00:00 '+n.name,'out');
    });
    ProcMgr._procs.filter(p=>p.type==='sim').forEach(p=>{
      if(flag)this._print('user    '+String(p.pid).padEnd(7)+'  0.0  0.1   1024   512 '+p.state.charAt(0)+' 00:00   0:00 '+p.name+' [sim]','out');
      else this._print(String(p.pid).padStart(5)+' pts/0    00:00:00 '+p.name+' [sim]','out');
    });
  },
  async _cmdTop(){
    const status=await DashAPI.get('/api/status')||{};
    const nodes=await DashAPI.get('/api/nodes')||[];
    this._print('top - '+new Date().toLocaleTimeString()+' up '+(Math.floor((Date.now()-(DashAPI.startTime||Date.now()))/60000))+'min, load average: 0.08 0.11 0.09','hdr');
    this._print('Tasks: '+(nodes.length+ProcMgr._procs.length)+' total, 1 running, '+(nodes.length+ProcMgr._procs.length-1)+' sleeping','out');
    this._print('%Cpu(s):  2.1 us,  0.8 sy,  0.0 ni, 96.8 id,  0.3 wa','out');
    this._print('MiB Mem:   8192.0 total,   6144.0 free,   1024.0 used','out');
    this._print('','out');
    this._print('  PID USER      PR  NI    VIRT    RES    SHR S  %CPU  %MEM     TIME+ COMMAND','hdr');
    nodes.forEach(n=>{this._print(String(n.process_id||0).padStart(5)+' root      20   0   12340   4320   1024 S   0.3   0.1   0:00.10 '+n.name,'out');});
  },
  async _cmdFree(){
    const buf=await DashAPI.get('/api/buffer')||{};
    this._print('              total        used        free      shared  buff/cache   available','hdr');
    this._print('Mem:          8192M        1024M       6144M        128M        768M       7040M (simulated)','out');
    this._print('Swap:         2048M           0M       2048M','out');
    this._print('Buffer: '+buf.current_occupancy+'/'+buf.capacity+' slots occupied ('+( buf.capacity>0?(buf.current_occupancy/buf.capacity*100).toFixed(0):0)+'%)','out');
  },
  async _cmdLs(parts){
    const flag=parts[1]||'';
    if(parts[1]==='/proc'){['1 (systemd)','2 (dfs_coordinator)','3 (dfs_node_1)','4 (dfs_node_2)','5 (dfs_node_3)','cpuinfo','meminfo','filesystems','mounts','uptime','version'].forEach(e=>this._print(e,'out'));return;}
    const files=await DashAPI.get('/api/files')||[];
    if(!flag){files.forEach(f=>this._print(f.path.split('/').pop(),'out'));return;}
    this._print('total '+(files.length*4),'out');
    files.forEach(f=>{
      const perms=FileMgr._octalToRwx(f.permissions||0o644);
      const d=new Date(f.updated_at*1000||Date.now());
      const ds=d.toLocaleString('en-US',{month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit'});
      this._print('-'+perms+' 1 '+f.owner.padEnd(8)+' dfs '+String(f.size).padStart(8)+' '+ds+' '+f.path,'out');
    });
  },
  async _cmdDf(){
    const nodes=await DashAPI.get('/api/nodes')||[];
    this._print('Filesystem      Size  Used Avail Use% Mounted on','hdr');
    this._print('/dev/sda1        50G  8.2G   42G  17% /','out');
    nodes.forEach(n=>{
      const total=fmtBytes(n.total_space);const used=fmtBytes(n.used_space);
      const free=fmtBytes(n.total_space-n.used_space);
      const pct=n.total_space>0?((n.used_space/n.total_space)*100).toFixed(0):0;
      this._print('dfs://node'+n.id+'  '+total+'  '+used+'  '+free+'  '+pct+'% /dfs/node'+n.id,'out');
    });
  },
  async _cmdLsblk(){
    const nodes=await DashAPI.get('/api/nodes')||[];
    this._print('NAME   MAJ:MIN RM  SIZE RO TYPE MOUNTPOINT','hdr');
    this._print('sda      8:0    0   50G  0 disk','out');
    this._print('-sda1   8:1    0   50G  0 part /','out');
    nodes.forEach((n,i)=>this._print('dfs'+i+'    '+(200+i)+':0    0  100G  0 dfs  /dfs/node'+n.id,'out'));
  },
  async _cmdCat(path){
    if(path.includes('meminfo')){
      this._print('MemTotal:       8388608 kB (simulated)','out');
      this._print('MemFree:        6291456 kB','out');
      this._print('MemAvailable:   7208960 kB','out');
      this._print('Buffers:          131072 kB','out');
      this._print('Cached:           786432 kB','out');
      this._print('SwapTotal:      2097152 kB','out');
      this._print('SwapFree:       2097152 kB','out');
    } else if(path.includes('cpuinfo')){
      this._print('processor    : 0','out');
      this._print('vendor_id    : GenuineIntel','out');
      this._print('cpu family   : 6','out');
      this._print('model name   : Intel(R) Core(TM) Simulated CPU @ 2.50GHz','out');
      this._print('cpu MHz      : 2500.000','out');
      this._print('cache size   : 6144 KB','out');
      this._print('flags        : fpu vme de pse tsc msr pae mce cx8 sep mtrr pge mca cmov','out');
    } else {
      const data=await DashAPI.get('/api/files/download?path='+encodeURIComponent(path)).catch(()=>null);
      if(data)this._print(data,'out');else this._print('cat: '+path+': No such file or directory','err');
    }
  }
};
// ─── Guided DFS Walkthrough ───────────────────────────────────────────────────
const Walkthrough = {
  _step: 0,
  _playing: false,
  _timer: null,
  _stages: [
    {
      num: 1, icon: '&#128196;', label: 'Client Initiates Upload',
      what: 'Client A selects report.pdf (10 MB) and sends an HTTP POST request to the coordinator at http://127.0.0.1:8080/api/files/upload with the file content, target path /docs/report.pdf, and replication factor 2.',
      os: 'Process Management and System Calls. The client runs as an OS process. Sending an HTTP request involves the write() system call (Linux) or WriteFile()/WSASend() (Windows) to write data to a TCP socket. The OS manages process execution, scheduling, and network I/O.',
      dfs: 'The coordinator HTTP server (HttpServer in src/web/http_server.cpp) listens on port 8080. TcpServer::acceptLoop() accepts the connection on a new thread. The request is parsed and routed to the POST /api/files/upload handler in Coordinator::setupWebRoutes().',
      impl: 'src/web/http_server.cpp -> HttpServer::handleSocket()\nsrc/coordinator/coordinator.cpp -> Coordinator::setupWebRoutes() -> POST /api/files/upload\nsrc/networking/tcp_server.cpp -> TcpServer::acceptLoop()',
      module: 'procmgr',
      moduleName: 'Process Manager',
      live: async () => {
        const s = await DashAPI.get('/api/status');
        return s ? 'Coordinator PID: ' + s.coordinator_pid + '\nActive worker threads: ' + s.active_worker_threads + '\nTotal tasks executed: ' + s.total_tasks_executed : 'Backend not reachable';
      }
    },
    {
      num: 2, icon: '&#128190;', label: 'Memory and Buffer Allocation',
      what: 'The coordinator reads the 10 MB file content from the HTTP request body into application memory. The file is then split into 64 KB chunks. Each chunk is pushed into the BoundedBuffer (16-slot ring buffer) to be consumed by the storage node writer threads.',
      os: 'Memory Management. Application buffers are heap-allocated memory regions managed by the C++ runtime. The OS provides virtual memory pages via VirtualAlloc() (Windows) / mmap() (Linux). The bounded buffer implements the Producer-Consumer pattern with condition variables to prevent overflow.',
      dfs: 'SecurityManager::CHUNK_SIZE = 64 KB. The coordinator creates MemoryChunk objects and calls chunk_buffer_->push(mem_chk, 2000) for each chunk. If the buffer is full, push() blocks the upload thread until the consumer drains a slot (backpressure).',
      impl: 'include/buffer/bounded_buffer.h -> BoundedBuffer<T>::push() / pop()\ninclude/buffer/bounded_buffer.h -> MemoryChunk struct\nsrc/security/security_manager.h -> CHUNK_SIZE = 65536 bytes\nsrc/coordinator/coordinator.cpp -> Coordinator::uploadFile() -> chunk_buffer_->push()',
      module: 'iobuffer',
      moduleName: 'I/O Buffer and Cache',
      live: async () => {
        const b = await DashAPI.get('/api/buffer');
        return b ? 'Buffer capacity: ' + b.capacity + ' slots\nCurrent occupancy: ' + b.current_occupancy + '\nTotal produced: ' + b.total_produced + '\nBlocked producers: ' + b.blocked_producers + '\nHigh watermark: ' + b.high_watermark_pct.toFixed(1) + '%' : 'No data';
      }
    },
    {
      num: 3, icon: '&#9881;', label: 'Coordinator Processes Request',
      what: 'The coordinator validates the file path (removes ../ traversal attempts), checks permissions for the requesting user, enqueues the request into the RequestScheduler, and begins the WAL transaction. It then selects the best storage nodes for chunk placement using a least-utilized (most free space) strategy.',
      os: 'CPU Scheduling and Process Management. The upload runs on a worker thread inside the coordinator process. The Windows OS scheduler determines when this thread runs on a CPU core. The DFS application also has its own request scheduler that orders concurrent I/O requests.',
      dfs: 'SecurityManager::sanitizePath() validates path. SecurityManager::checkPermission() checks user access. RequestScheduler::enqueue() adds the request. Coordinator::selectStorageNodesForChunks() sorts nodes by free space and picks the top N nodes for replication.',
      impl: 'src/coordinator/coordinator.cpp -> Coordinator::uploadFile()\nsrc/security/security_manager.cpp -> SecurityManager::sanitizePath()\nsrc/scheduler/request_scheduler.cpp -> RequestScheduler::enqueue() + dequeue()\nsrc/coordinator/coordinator.cpp -> Coordinator::selectStorageNodesForChunks()',
      module: 'cpusched',
      moduleName: 'CPU Scheduler',
      live: async () => {
        const sc = await DashAPI.get('/api/scheduler');
        return sc ? 'Scheduler algorithm: ' + sc.current_algorithm + '\nQueue depth: ' + sc.queue_depth + '\nTotal serviced: ' + sc.total_requests_serviced + '\nAvg wait time: ' + sc.avg_waiting_time_ms.toFixed(2) + ' ms\nThroughput: ' + sc.throughput_ops_sec.toFixed(2) + ' ops/sec' : 'No data';
      }
    },
    {
      num: 4, icon: '&#128274;', label: 'Synchronization and Locking',
      what: 'Before modifying file metadata, the coordinator acquires an EXCLUSIVE_WRITE lock on the file path /docs/report.pdf. Any concurrent readers (downloads of the same file) must wait. The WAL transaction is started with beginTransaction("UPLOAD", path).',
      os: 'Synchronization. Reader-writer locks allow concurrent reads but require exclusive writes. Without synchronization, two simultaneous uploads to the same path could corrupt the metadata. Deadlock is prevented by acquiring multiple locks in alphabetical order (Havender\'s algorithm).',
      dfs: 'LockManager::acquireLock(path, EXCLUSIVE_WRITE, owner, 4000) is called. If another client holds a read lock, this blocks (up to 4 seconds timeout). WalManager::beginTransaction() writes a PENDING entry to the WAL log with an LSN.',
      impl: 'src/sync/lock_manager.cpp -> LockManager::acquireLock()\nsrc/sync/lock_manager.cpp -> LockManager::acquireMultipleLocks() for rename (Havender ordering)\nsrc/recovery/wal_manager.cpp -> WalManager::beginTransaction()\nsrc/coordinator/coordinator.cpp -> Coordinator::uploadFile() lines ~lock + wal',
      module: 'locks',
      moduleName: 'Lock Manager',
      live: async () => {
        const lk = await DashAPI.get('/api/locks');
        return lk ? 'Active locks: ' + lk.active_lock_count + '\nWaiting requests: ' + lk.waiting_request_count + '\nTotal acquired: ' + lk.total_acquired + '\nTimeouts: ' + lk.total_timeouts + '\nDeadlocks prevented: ' + lk.total_deadlocks_prevented + '\nDeadlock detected: ' + (lk.has_deadlock_cycle ? 'YES - ' + lk.deadlock_cycle.join(' -> ') : 'No') : 'No data';
      }
    },
    {
      num: 5, icon: '&#128196;', label: 'File Storage and Disk I/O',
      what: 'Each 64 KB chunk is sent to the selected storage nodes via Winsock2 TCP using the STORE_CHUNK message. Each storage node writes the chunk to its local storage directory (storage/node1/, storage/node2/, etc.) as a binary file. The metadata (chunk ID, offset, size, SHA-256) is recorded in SQLite.',
      os: 'File Systems and Disk I/O. Writing data to disk involves file system calls (CreateFile/WriteFile on Windows, open/write on Linux), which go through the VFS layer, file system driver (NTFS), block device driver, and finally the disk controller. The OS manages buffering and physical I/O scheduling.',
      dfs: 'TcpClient::request() sends DfsMessage with type STORE_CHUNK to each node. StorageNode handles STORE_CHUNK by writing the chunk to disk. MetadataManager::addChunk() + assignReplica() record the chunk and its node locations in SQLite.',
      impl: 'src/coordinator/coordinator.cpp -> Coordinator::uploadFile() -> TcpClient send STORE_CHUNK\nsrc/storage_node/storage_node.cpp -> StorageNode::handleStoreChunk()\nsrc/metadata/metadata_manager.cpp -> MetadataManager::addChunk() + assignReplica()\nsrc/networking/tcp_client.cpp -> TcpClient::request()',
      module: 'disk',
      moduleName: 'Disk Scheduler',
      live: async () => {
        const nodes = await DashAPI.get('/api/nodes');
        if (!nodes) return 'No data';
        return nodes.map(n => 'Node ' + n.id + ' (' + n.name + '): ' + (n.status === 'ONLINE' ? 'ONLINE' : 'OFFLINE') + ' | Used: ' + fmtBytes(n.used_space) + ' / ' + fmtBytes(n.total_space)).join('\n');
      }
    },
    {
      num: 6, icon: '&#128257;', label: 'Replication and Fault Tolerance',
      what: 'The coordinator sends each chunk to multiple storage nodes (replication_factor = 2 by default). Node 1 and Node 2 each store a copy of every chunk independently. Each storage node sends periodic TCP heartbeats back to the coordinator. If a node goes offline, its chunks can still be read from the surviving replica.',
      os: 'Distributed Systems and Fault Tolerance. This directly implements the distributed file system concept: data redundancy across independent processes (on different ports) with automatic failover. The coordinator acts as the central metadata server (like a namenode in HDFS).',
      dfs: 'selectStorageNodesForChunks() picks nodes sorted by most free space. Coordinator::healthMonitorLoop() detects missed heartbeats (>5s) and marks nodes OFFLINE. Coordinator::triggerReReplication() copies under-replicated chunks to healthy nodes automatically.',
      impl: 'src/coordinator/coordinator.cpp -> Coordinator::selectStorageNodesForChunks()\nsrc/coordinator/coordinator.cpp -> Coordinator::healthMonitorLoop() + checkNodeHealth()\nsrc/coordinator/coordinator.cpp -> Coordinator::triggerReReplication()\ninclude/common/types.h -> NodeStatus enum: ONLINE, DEGRADED, OFFLINE',
      module: 'cluster',
      moduleName: 'Cluster Topology',
      live: async () => {
        const nodes = await DashAPI.get('/api/nodes');
        if (!nodes) return 'No data';
        const online = nodes.filter(n => n.status === 'ONLINE' || n.is_process_running).length;
        return 'Online nodes: ' + online + ' / ' + nodes.length + '\n' + nodes.map(n => 'Node ' + n.id + ' PID:' + (n.process_id || '--') + ' Port:' + n.port + ' Heartbeat: ' + (n.last_heartbeat > 0 ? new Date(n.last_heartbeat * 1000).toLocaleTimeString() : 'never')).join('\n');
      }
    },
    {
      num: 7, icon: '&#128203;', label: 'Metadata and WAL Commit',
      what: 'After all chunks are successfully stored and replicated, the coordinator commits the WAL transaction (PENDING -> COMMITTED) and releases the exclusive write lock on the file path. The file metadata (path, size, chunks, replicas, SHA-256, permissions) is now permanently recorded in SQLite.',
      os: 'Write-Ahead Logging and Crash Recovery. WAL ensures atomicity: if the coordinator crashes between chunk storage and metadata update, the recovery scan finds the PENDING entry and rolls it back, leaving the system in a consistent state. This is the same principle used by database systems and journaled file systems.',
      dfs: 'WalManager::commitTransaction(tx_id) updates the WAL entry state to COMMITTED. LockManager::releaseLock() wakes up any waiting readers. LruFileCache::invalidate(path) ensures stale cached data is evicted so the next download fetches the new version.',
      impl: 'src/recovery/wal_manager.cpp -> WalManager::commitTransaction()\nsrc/sync/lock_manager.cpp -> LockManager::releaseLock()\ninclude/cache/lru_cache.h -> LruFileCache::invalidate()\nsrc/metadata/metadata_manager.cpp -> MetadataManager::createFile() + addChunk()',
      module: 'wal',
      moduleName: 'WAL and Recovery',
      live: async () => {
        const logs = await DashAPI.get('/api/recovery');
        if (!logs || !logs.length) return 'No WAL entries yet';
        return logs.slice(0, 5).map(w => 'LSN:' + w.lsn + ' TX:' + w.tx_id.substring(0, 12) + ' Op:' + w.operation + ' State:' + w.state + ' ' + new Date(w.timestamp * 1000).toLocaleTimeString()).join('\n');
      }
    },
    {
      num: 8, icon: '&#9989;', label: 'Upload Complete',
      what: 'The coordinator returns HTTP 200 OK to the client with a success message. The file report.pdf is now stored across 2 storage nodes (replication_factor=2), protected with SHA-256 integrity hashes per chunk, recorded in SQLite metadata, and available for immediate download with cache support.',
      os: 'All major OS concepts were exercised: Process management (Win32 CreateProcess for nodes), CPU scheduling (threads scheduled by Windows OS + application RequestScheduler), Memory management (BoundedBuffer + LRU cache), Synchronization (RW locks + WAL), File systems (SQLite + chunk storage), Disk I/O (fstream writes on storage nodes).',
      dfs: 'The full upload lifecycle in our DFS demonstrates every OS concept simultaneously. This is the core academic value of the project: not just simulating OS theory, but implementing it in a working distributed system where each concept solves a real engineering problem.',
      impl: 'Coordinator::uploadFile() return true\nHTTP response: {"status":"OK","message":"File uploaded successfully"}\nFile available at: GET /api/files\nDownload via: GET /api/files/download?path=/docs/report.pdf',
      module: 'files',
      moduleName: 'File Explorer',
      live: async () => {
        const files = await DashAPI.get('/api/files');
        const audit = await DashAPI.get('/api/audit');
        let out = 'Total files in DFS: ' + (files ? files.length : 0) + '\n';
        if (audit && audit.length) {
          const uploads = audit.filter(a => a.action === 'UPLOAD' && a.success);
          out += 'Successful uploads: ' + uploads.length + '\n';
          if (uploads[0]) out += 'Last upload: ' + uploads[0].target_path + ' at ' + new Date(uploads[0].timestamp * 1000).toLocaleTimeString();
        }
        return out;
      }
    }
  ],

  init() {
    this._renderPipeline();
    this._renderDots();
    this.goTo(0);
  },

  _renderPipeline() {
    const el = document.getElementById('wtPipeline');
    if (!el) return;
    el.innerHTML = this._stages.map((s, i) => {
      return (i > 0 ? '<span class="wt-arrow">&#9654;</span>' : '') +
        '<div class="wt-stage" id="wt-stage-' + i + '" onclick="Walkthrough.goTo(' + i + ')">' +
        '<div class="wt-stage-num">' + s.num + '</div>' +
        '<div class="wt-stage-icon">' + s.icon + '</div>' +
        '<div class="wt-stage-label">' + s.label + '</div>' +
        '</div>';
    }).join('');
  },

  _renderDots() {
    const el = document.getElementById('wtDots');
    if (!el) return;
    el.innerHTML = this._stages.map((_, i) => '<div class="wt-dot" id="wt-dot-' + i + '" onclick="Walkthrough.goTo(' + i + ')"></div>').join('');
  },

  async goTo(idx) {
    if (idx < 0 || idx >= this._stages.length) return;
    this._step = idx;
    const s = this._stages[idx];

    // Update pipeline
    this._stages.forEach((_, i) => {
      const el = document.getElementById('wt-stage-' + i);
      if (!el) return;
      el.className = 'wt-stage' + (i === idx ? ' active' : i < idx ? ' done' : '');
    });

    // Update dots
    this._stages.forEach((_, i) => {
      const el = document.getElementById('wt-dot-' + i);
      if (!el) return;
      el.className = 'wt-dot' + (i === idx ? ' active' : i < idx ? ' done' : '');
    });

    // Update header
    const stageName = document.getElementById('wtStageName');
    const progress = document.getElementById('wtProgress');
    const statusEl = document.getElementById('wtStatus');
    if (stageName) stageName.textContent = 'Stage ' + s.num + ': ' + s.label;
    if (progress) progress.textContent = (idx + 1) + ' / ' + this._stages.length;
    if (statusEl) statusEl.innerHTML = idx === this._stages.length - 1 ? '<span class="badge green">COMPLETE</span>' : '<span class="badge amber">IN PROGRESS</span>';

    // Update detail card
    document.getElementById('wtDetailTitle').textContent = 'Stage ' + s.num + ': ' + s.label;

    const show = (id, textId, text) => {
      document.getElementById(id).classList.remove('hidden');
      document.getElementById(textId).textContent = text;
    };
    show('wtDetailWhat', 'wtDetailWhatText', s.what);
    show('wtDetailOsConcept', 'wtDetailOsText', s.os);
    show('wtDetailDfs', 'wtDetailDfsText', s.dfs);
    show('wtDetailImpl', 'wtDetailImplText', s.impl);

    // Related module link
    const linkSection = document.getElementById('wtDetailLink');
    const linkText = document.getElementById('wtDetailLinkText');
    if (linkSection && linkText) {
      linkSection.classList.remove('hidden');
      linkText.innerHTML = '<button class="btn btn-primary btn-sm" onclick="document.querySelector(\'[data-panel=' + s.module + ']\').click()">Open ' + s.moduleName + ' Module &#9654;</button>';
    }

    // Live backend data
    const liveSection = document.getElementById('wtLiveData');
    const liveText = document.getElementById('wtLiveDataText');
    if (liveSection && liveText && s.live) {
      liveSection.classList.remove('hidden');
      liveText.textContent = 'Loading live data...';
      try {
        const data = await s.live();
        liveText.textContent = data;
      } catch (e) {
        liveText.textContent = 'Could not fetch live data.';
      }
    }
  },

  next() { this.goTo(Math.min(this._step + 1, this._stages.length - 1)); },
  prev() { this.goTo(Math.max(this._step - 1, 0)); },
  reset() { this._playing = false; document.getElementById('wtPlayBtn').textContent = '&#9654; Play'; this.goTo(0); },

  togglePlay() {
    this._playing = !this._playing;
    document.getElementById('wtPlayBtn').textContent = this._playing ? '&#9646;&#9646; Pause' : '&#9654; Play';
    if (this._playing) this._playLoop();
  },

  _playLoop() {
    if (!this._playing) return;
    if (this._step >= this._stages.length - 1) { this._playing = false; document.getElementById('wtPlayBtn').textContent = '&#9654; Play'; return; }
    this.next();
    this._timer = setTimeout(() => this._playLoop(), 3500);
  }
};

// ─── Patch DashAPI.init to also init Walkthrough when on walkthrough panel ──
const _origInit = DashAPI.init.bind(DashAPI);
DashAPI.init = function() {
  _origInit();
  // nav item click handler already calls Walkthrough.init via panel switch
};

// ─── Patch nav handler to init walkthrough ───────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const walkNav = document.querySelector('[data-panel="walkthrough"]');
  if (walkNav) {
    walkNav.addEventListener('click', () => { setTimeout(() => Walkthrough.init(), 50); });
  }
});

// ─── DFS Terminal Commands ────────────────────────────────────────────────────
// Extend existing Terminal._exec with DFS-specific commands
const _origExec = Terminal._exec.bind(Terminal);
Terminal._exec = async function(cmd) {
  const parts = cmd.trim().split(/\s+/);
  if (parts[0] === 'dfs') {
    await this._dfsCommand(parts.slice(1));
    return;
  }
  return _origExec(cmd);
};

Terminal._dfsCommand = async function(args) {
  const sub = args[0] || 'help';
  if (sub === 'help' || !sub) {
    this._print('DFS Commands:', 'hdr');
    this._print('  dfs status     -- cluster status and coordinator info', 'out');
    this._print('  dfs nodes      -- list all storage nodes with health', 'out');
    this._print('  dfs files      -- list all files in DFS', 'out');
    this._print('  dfs stats      -- buffer, cache, and scheduler statistics', 'out');
    this._print('  dfs locks      -- active locks and deadlock status', 'out');
    this._print('  dfs wal        -- recent WAL journal entries', 'out');
    return;
  }
  if (sub === 'status') {
    const s = await DashAPI.get('/api/status');
    if (!s) { this._print('Cannot reach coordinator', 'err'); return; }
    this._print('DFS Cluster Status', 'hdr');
    this._print('  Status       : ' + s.status, 'ok');
    this._print('  Coordinator  : PID ' + s.coordinator_pid, 'out');
    this._print('  Web Port     : ' + s.web_port, 'out');
    this._print('  RPC Port     : ' + s.rpc_port, 'out');
    this._print('  Worker Threads: ' + s.active_worker_threads, 'out');
    this._print('  Tasks Done   : ' + s.total_tasks_executed, 'out');
    return;
  }
  if (sub === 'nodes') {
    const nodes = await DashAPI.get('/api/nodes');
    if (!nodes) { this._print('Cannot reach coordinator', 'err'); return; }
    this._print('NODE  PORT   STATUS   PID      USED/TOTAL', 'hdr');
    nodes.forEach(n => {
      const on = n.status === 'ONLINE' || n.is_process_running;
      this._print(
        ('Node' + n.id).padEnd(6) + String(n.port).padEnd(7) +
        (on ? 'ONLINE ' : 'OFFLINE').padEnd(9) +
        String(n.process_id || '--').padEnd(9) +
        fmtBytes(n.used_space) + ' / ' + fmtBytes(n.total_space),
        on ? 'ok' : 'err'
      );
    });
    return;
  }
  if (sub === 'files') {
    const files = await DashAPI.get('/api/files');
    if (!files) { this._print('Cannot reach coordinator', 'err'); return; }
    if (!files.length) { this._print('No files in DFS', 'out'); return; }
    this._print('PATH                           SIZE       OWNER   VER  REPLICAS', 'hdr');
    files.forEach(f => {
      const nodes = [...new Set((f.chunks || []).flatMap(c => c.replicas || []))];
      this._print(
        f.path.substring(0, 30).padEnd(31) +
        fmtBytes(f.size).padEnd(11) +
        (f.owner || '--').padEnd(8) +
        ('v' + f.version).padEnd(5) +
        'Nodes: ' + (nodes.join(',') || 'none'),
        'out'
      );
    });
    return;
  }
  if (sub === 'stats') {
    const [buf, cache, sched] = await Promise.all([
      DashAPI.get('/api/buffer'),
      DashAPI.get('/api/cache'),
      DashAPI.get('/api/scheduler')
    ]);
    this._print('DFS Statistics', 'hdr');
    if (buf) {
      this._print('  Buffer: ' + buf.current_occupancy + '/' + buf.capacity + ' slots occupied | HWM: ' + buf.high_watermark_pct.toFixed(1) + '%', 'out');
    }
    if (cache) {
      this._print('  Cache:  ' + cache.hit_ratio_pct.toFixed(1) + '% hit ratio | ' + cache.current_items + '/' + cache.capacity_items + ' items | ' + cache.eviction_count + ' evictions', 'out');
    }
    if (sched) {
      this._print('  Sched:  ' + sched.current_algorithm + ' | ' + sched.total_requests_serviced + ' serviced | ' + sched.throughput_ops_sec.toFixed(2) + ' ops/sec', 'out');
    }
    return;
  }
  if (sub === 'locks') {
    const lk = await DashAPI.get('/api/locks');
    if (!lk) { this._print('Cannot reach coordinator', 'err'); return; }
    this._print('Lock Manager', 'hdr');
    this._print('  Active locks: ' + lk.active_lock_count, 'out');
    this._print('  Waiting     : ' + lk.waiting_request_count, 'out');
    this._print('  Deadlock    : ' + (lk.has_deadlock_cycle ? 'DETECTED - ' + lk.deadlock_cycle.join(' -> ') : 'None'), lk.has_deadlock_cycle ? 'err' : 'ok');
    this._print('  Prevented   : ' + lk.total_deadlocks_prevented, 'ok');
    return;
  }
  if (sub === 'wal') {
    const logs = await DashAPI.get('/api/recovery');
    if (!logs || !logs.length) { this._print('No WAL entries', 'out'); return; }
    this._print('LSN   TX-ID           OP               STATE       TIME', 'hdr');
    logs.slice(0, 10).forEach(w => {
      const sc = w.state === 'COMMITTED' ? 'ok' : w.state === 'PENDING' ? 'out' : 'err';
      this._print(
        String(w.lsn).padEnd(6) +
        w.tx_id.substring(0, 14).padEnd(16) +
        (w.operation || '--').padEnd(17) +
        w.state.padEnd(12) +
        new Date(w.timestamp * 1000).toLocaleTimeString(),
        sc
      );
    });
    return;
  }
  this._print('dfs: unknown subcommand: ' + sub + '. Try: dfs help', 'err');
};