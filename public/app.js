(() => {
  const $ = s => document.querySelector(s);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const button = (text, fn, cls = 'secondary') => { const b = el('button', cls, text); b.type = 'button'; b.onclick = fn; return b; };
  const roles = {viewer:'ผู้ชม',editor:'เจ้าหน้าที่',admin:'ผู้ดูแล'};
  const titles = {dashboard:'ภาพรวมผู้บริหาร',registry:'ทะเบียนผ่าตัด',followup:'ติดตามผลหลังผ่าตัด',monthly:'สถิติรายเดือน',trend:'แนวโน้มผลลัพธ์',quality:'คุณภาพและการทบทวน',reports:'รายงานผลลัพธ์',users:'จัดการสมาชิก',targets:'เป้าหมาย KPI'};
  const state = {view:'dashboard',cases:[],targets:[],actions:[],users:[],editing:null,user:null,action:null,generation:0,dirty:false,saving:false,search:'',filter:'',page:1,loaded:false};
  const path = name => `/api/collections/${name}/records`;
  const canWrite = () => ['editor','admin'].includes(API.user?.role);
  const targetState = {editing:null,dirty:false,saving:false};
  const mobileLayout = window.matchMedia('(max-width: 760px)');
  const menuDialog = $('#mobile-menu');
  function closeMenu() { if (menuDialog.open) menuDialog.close(); $('#mobile-menu-toggle').setAttribute('aria-expanded', 'false'); }
  function syncMenuLayout() {
    const wasOpen = menuDialog.open;
    closeMenu();
    if (mobileLayout.matches) menuDialog.append($('#sidebar'));
    else {
      $('#workspace').prepend($('#sidebar'));
      if (wasOpen) $('#sidebar .selected')?.focus();
    }
  }
  $('#mobile-menu-toggle').onclick = () => {
    if (!mobileLayout.matches || !API.user?.active) return;
    menuDialog.showModal();
    $('#mobile-menu-toggle').setAttribute('aria-expanded', 'true');
  };
  $('#mobile-menu-close').onclick = closeMenu;
  menuDialog.addEventListener('close', () => $('#mobile-menu-toggle').setAttribute('aria-expanded', 'false'));
  menuDialog.addEventListener('click', event => {
    if (event.target !== menuDialog) return;
    const rect = menuDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) closeMenu();
  });
  mobileLayout.addEventListener('change', syncMenuLayout);
  syncMenuLayout();
  const today = () => new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Bangkok',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const groups = [
    ['01','ข้อมูลผู้ป่วยและการผ่าตัด',[
      ['surgery_date','วันที่ผ่าตัด','date',true],['surgeon','แพทย์ผู้ผ่าตัด','text',true],['hn','HN','text',true,30],['patient_name','ชื่อ-สกุล','text',true,200],['diagnosis','Diagnosis / การวินิจฉัย','text',false,200],['procedure','หัตถการ','text',true],['eye','ข้าง','select',true,['OD','OS','OU']],['anesthesia','Anesthesia / การระงับความรู้สึก','text'],['surgery_time','เวลาผ่าตัด','time'],['preop_va','VA ก่อนผ่าตัด','text',false,30]
    ]],
    ['02','เลนส์และอุปกรณ์', [['implant','Implant (Lens)','text'],['lens_type','Type Lens','text'],['guidance','Callisto / Verion','select',false,['Callisto','Verion','None']]]],
    ['03','ติดตามผลการมองเห็น', [
      ['day1_date','วันที่ติดตาม Day 1','date'],['day1_va','VA Day 1','text',false,30],['week1_date','วันที่ติดตาม 1 สัปดาห์','date'],['week1_va','VA 1 สัปดาห์','text',false,30],['month1_date','วันที่ติดตาม 1 เดือน','date'],['month1_va','VA 1 เดือน','text',false,30],['va_outcome','VA 1 เดือน >6/12','select',false,['pass','fail']]
    ]],
    ['04','ผลลัพธ์และภาวะแทรกซ้อน', [
      ['endophthalmitis','Endophthalmitis','select',false,['yes','no']],['wound_leak','Wound leak','select',false,['yes','no']],['pain_score','Pain score 0–10','number'],['reoperation','Re-operation','select',false,['yes','no']],['biometry','Biometry Target ±0.50D','select',false,['pass','fail']],['refractive','Post-op Refractive Error ±1.0D','select',false,['pass','fail']],['notes','บันทึกเพิ่มเติม','textarea',false,4000]
    ]]
  ];
  const fieldNames = groups.flatMap(g => g[2].map(f => f[0]));
  const labels = {pass:'ผ่าน (Pass)',fail:'ไม่ผ่าน (Fail)',yes:'พบ / Yes',no:'ไม่พบ / No',None:'ไม่ใช้'};
  function buildFields() {
    const root = $('#case-fields');
    groups.forEach(([num,title,fields]) => {
      const section = el('section','form-section'); section.append(el('h3','',`${num}  ${title}`));
      const grid = el('div','form-grid');
      fields.forEach(([name,label,type,required,limit]) => {
        const l = el('label',type === 'textarea' ? 'full-width' : '',label + (required ? ' *' : ''));
        const input = el(type === 'select' ? 'select' : type === 'textarea' ? 'textarea' : 'input'); input.name = name; input.required = Boolean(required);
        if (type === 'select') { const empty = el('option','','ยังไม่ประเมิน / ไม่ระบุ'); empty.value = ''; input.append(empty); limit.forEach(v => { const o = el('option','',labels[v] || v); o.value=v; input.append(o); }); }
        else if (type === 'textarea') {input.rows=3;input.maxLength=limit;}
        else { input.type=type; if(type==='text')input.maxLength=limit||120; if(type==='date'){input.min='1900-01-01';input.max=today();} if(type==='number'){input.min=0;input.max=10;input.step=1;} }
        l.append(input);grid.append(l);
      }); section.append(grid);root.append(section);
    });
  }
  function notice(text, error=false) { $('#notice').textContent=text; $('#notice').className=error?'error notice':'notice'; }
  function sessionUI() {
    const active=Boolean(API.user?.active); $('#login-panel').hidden=active; $('#workspace').hidden=!active; $('#account').hidden=!active;
    $('#mobile-menu-toggle').hidden = !active;
    if (!active) closeMenu();
    $('#account-name').textContent=active?`${API.user.name} · ${roles[API.user.role]}`:'';
    $('#users-tab').hidden=API.user?.role!=='admin'; $('#add-case-button').hidden=!canWrite();
    $('#targets-tab').hidden=API.user?.role!=='admin';
    if (!active) { targetState.dirty=false; targetState.editing=null; }
    if(!active){state.generation++;state.cases=[];state.targets=[];state.actions=[];state.users=[];state.loaded=false;$('#view-content').replaceChildren();document.querySelectorAll('dialog[open]').forEach(d=>d.close());state.dirty=false;}
  }
  async function all(name) {
    let page=1, result=[];
    while(true){const data=await API.request(`${path(name)}?perPage=500&page=${page}&sort=id`);result.push(...data.items);if(page>=data.totalPages)return result;page++;}
  }
  async function load() {
    const gen=++state.generation; state.loaded=false; $('#view-content').replaceChildren(el('p','empty','กำลังโหลดข้อมูล…')); $('#refresh').disabled=true;
    try {
      await API.refresh(); if(gen!==state.generation || !API.user)return;sessionUI();
      if(['users','targets'].includes(state.view) && API.user.role!=='admin')state.view='dashboard';
      const [cases,targets,actions,users]=await Promise.all([all('cases'),all('kpi_targets'),all('quality_actions'),API.user.role==='admin'?all('users'):[]]);
      if(gen!==state.generation)return;
      Object.assign(state,{cases,targets,actions,users,loaded:true});render();
    } catch(e){if(gen===state.generation){$('#view-content').replaceChildren(el('p','empty error',e.message));sessionUI();}}
    finally{if(gen===state.generation)$('#refresh').disabled=false;}
  }
  function selected(){return Clinical.period(state.cases,$('#period-month').value,$('#period-mode').value);}
  const card = (title, value, sub) => {const n=el('article','summary-card');n.append(el('p','muted',title),el('strong','summary-value',value),el('p','muted',sub));return n;};
  function panel(title){const p=el('section','panel padded');p.append(el('h2','section-title',title));return p;}
  function empty(root,text='ยังไม่มีข้อมูลในช่วงเวลานี้'){root.append(el('p','empty',text));}
  function metricCards(cases) {
    const grid=el('div','kpi-grid');
    Clinical.kpis(cases,state.targets).forEach(k=>{
      const c=el('article',`kpi-card ${k.status}`);
      const status={pass:'● ผ่านเป้าหมาย',fail:'● ไม่ผ่านเป้าหมาย',insufficient:'○ ข้อมูลไม่เพียงพอ',unconfigured:'○ ยังไม่ตั้งเป้าหมาย'}[k.status];
      c.append(el('p','kpi-label',k.label),el('span',`status ${k.status}`,status),el('strong','kpi-value',k.value===null?'N/A':k.value.toFixed(1)+'%'),el('p','muted',`${k.numerator} / ${k.denominator} รายที่ประเมิน · ยังไม่ประเมิน ${k.missing}`),el('p','target-note',k.target?.enabled?`เป้าหมาย ${k.target.direction==='gte'?'≥':'≤'} ${k.target.target}% · ขั้นต่ำ ${k.target.min_sample} ราย`:'เป้าหมายรอหน่วยงานรับรอง'));
      grid.append(c);
    });return grid;
  }
  function dataQuality(cases) {
    const p=panel('ความครบถ้วนของข้อมูล');
    const complete=cases.filter(c=>['day1_va','week1_va','month1_va','va_outcome','endophthalmitis','wound_leak','reoperation','biometry','refractive','pain_score'].every(k=>c[k]!=='' && c[k]!=null)).length;
    [['ข้อมูลครบ',`${complete} / ${cases.length}`],['ขาด VA Day 1',cases.filter(c=>!c.day1_va).length],['ขาด VA 1 สัปดาห์',cases.filter(c=>!c.week1_va).length],['ขาด VA 1 เดือน',cases.filter(c=>!c.month1_va).length]].forEach(([l,v])=>{const row=el('div','quality-row');row.append(el('span','',l),el('strong','',v));p.append(row);});
    p.append(el('p','muted','วันที่และค่าผลลัพธ์ตรวจที่เซิร์ฟเวอร์ • ป้องกัน HN + วันผ่าตัด + ข้างซ้ำ • HN เดิมต่างข้าง/ต่างวันบันทึกได้'));
    return p;
  }
  function alertPanel(cases,limit=8){
    const p=panel('Quality Alerts'), alerts=Clinical.alerts(cases,today());
    if(!alerts.length)empty(p,'ไม่มีการแจ้งเตือนจากข้อมูลที่บันทึก');
    alerts.slice(0,limit).forEach(a=>{const row=el('div','alert-row');row.append(el('span',`status ${a.level}`,{critical:'Critical',high:'High',monitor:'Monitor'}[a.level]),el('span','',a.text),button('ดูเคส',()=>openCase(state.cases.find(c=>c.id===a.caseId))));p.append(row);});
    if(alerts.length>limit)p.append(button(`ดูทั้งหมด ${alerts.length} การแจ้งเตือน`,()=>setView('quality')));
    p.append(el('p','muted','การแจ้งเตือนช่วยติดตาม Workflow ไม่ใช่การวินิจฉัยหรือระบบแจ้งเหตุฉุกเฉิน'));
    return p;
  }
  function trend(cases){
    const p=panel('แนวโน้มรายเดือน · ปี '+$('#period-month').value.slice(0,4)), rows=[];
    const year=$('#period-month').value.slice(0,4);
    for(let m=1;m<=12;m++){const month=`${year}-${String(m).padStart(2,'0')}`;const records=Clinical.period(cases,month);const k=Clinical.kpis(records,state.targets)[0];rows.push([month,records.length,k.value===null?'N/A':`${k.value.toFixed(1)}% (${k.numerator}/${k.denominator})`]);}
    const chart=el('div','chart');chart.setAttribute('aria-label','จำนวนผ่าตัดรายเดือน');const max=Math.max(1,...rows.map(r=>r[1]));
    rows.forEach(r=>{const c=el('div','chart-column');c.append(el('span','chart-count',r[1]));const bar=el('div','chart-bar');bar.style.height=`${r[1]/max*100}px`;c.append(bar,el('span','',r[0].slice(5)));chart.append(c);});p.append(chart,table(['เดือน','ผ่าตัด (ราย)','VA ผ่าน / ประเมิน'],rows));return p;
  }
  function table(headers,rows){const wrap=el('div','table-wrap'),t=el('table'),head=el('thead'),tr=el('tr');headers.forEach(h=>tr.append(el('th','',h)));head.append(tr);const body=el('tbody');rows.forEach(values=>{const row=el('tr');values.forEach(v=>{const td=el('td');td.append(v instanceof Node?v:document.createTextNode(String(v)));row.append(td);});body.append(row);});t.append(head,body);wrap.append(t);return wrap;}
  function setView(view){closeMenu();state.view=view;state.page=1;state.search='';state.filter='';notice('');render();}
  function render(){
    if(!state.loaded)return;
    if (['users','targets'].includes(state.view) && API.user?.role!=='admin') state.view='dashboard';
    $('#page-title').textContent=titles[state.view];$('#page-description').textContent=state.view==='users'?'กำหนดบทบาทและสถานะบัญชีของทีม':'ข้อมูลจริงที่บันทึกในระบบ · ไม่ใช้ข้อมูลตัวอย่างคำนวณ KPI';
    document.querySelectorAll('[data-view]').forEach(b=>{b.classList.toggle('selected',b.dataset.view===state.view);b.setAttribute('aria-pressed',String(b.dataset.view===state.view));});
    $('#period-form').hidden=['registry','followup','users','targets'].includes(state.view);
    const root=$('#view-content');root.replaceChildren();const cases=selected();$('#period-summary').textContent=`${cases.length} รายการผ่าตัด · ตามวันที่ผ่าตัด`;
    if(state.view==='users'){renderUsers(root);return;}
    if(state.view==='targets'){renderTargets(root);return;}
    if(['registry','followup'].includes(state.view)){renderRegistry(root);return;}
    if(state.view==='dashboard'){
      const summaries=el('div','summary-grid');summaries.append(card('ผ่าตัดในช่วงเวลา',cases.length,'จำนวนรายการที่ยังใช้งาน'),card('ติดตามครบ 1 เดือน',cases.filter(c=>c.month1_va).length,'มีวันที่และค่า VA'),card('ประเด็นที่ต้องติดตาม',Clinical.alerts(cases,today()).length,'รวมภาวะแทรกซ้อนและข้อมูลขาด'));
      root.append(summaries,metricCards(cases));const split=el('div','dashboard-grid');split.append(trend(state.cases),dataQuality(cases));root.append(split,alertPanel(cases));
    } else if(state.view==='quality'){root.append(alertPanel(cases,Infinity),dataQuality(cases));renderActions(root);}
    else if(state.view==='trend'){root.append(trend(state.cases));const year=Number($('#period-month').value.slice(0,4));const compare=panel('เทียบปีต่อปี');compare.append(table(['ปี','จำนวนผ่าตัด','VA ผ่าน / ประเมิน'],[year-1,year].map(y=>{const list=Clinical.period(state.cases,`${y}-12`,'year'),k=Clinical.kpis(list,state.targets)[0];return [y,list.length,k.value===null?'N/A':`${k.value.toFixed(1)}% (${k.numerator}/${k.denominator})`];})));root.append(compare);}
    else {root.append(metricCards(cases));const p=panel(state.view==='reports'?'Monthly Cataract Outcome Report':'สรุปผลลัพธ์ในช่วงเวลาที่เลือก');p.append(table(['ตัวชี้วัด','ตัวตั้ง','ตัวหาร','ผลลัพธ์','ยังไม่ประเมิน'],Clinical.kpis(cases,state.targets).map(k=>[k.label,k.numerator,k.denominator,k.value===null?'N/A':k.value.toFixed(1)+'%',k.missing])));const assessed=cases.filter(c=>c.pain_score!=='');p.append(el('p','muted',`Pain score เฉลี่ย: ${assessed.length?(assessed.reduce((s,c)=>s+Number(c.pain_score),0)/assessed.length).toFixed(1):'N/A'} · ประเมิน ${assessed.length} ราย`));if(state.view==='reports'){p.append(button('ส่งออกสรุป CSV',()=>exportReport(cases)),button('พิมพ์ / บันทึก PDF',()=>window.print()));p.append(el('p','muted','รายงานส่งออกเป็นสถิติรวม ไม่รวม HN หรือชื่อผู้ป่วย • การสำรองฐานข้อมูลทำโดยผู้ดูแลระบบผ่าน PocketBase dashboard'));}root.append(p,dataQuality(cases));}
  }
  function renderRegistry(root){
    const p=panel(state.view==='followup'?'รายการติดตาม Day 1 · 1 สัปดาห์ · 1 เดือน':'รายการผู้ป่วยทั้งหมด');
    const search=el('form','toolbar');const input=el('input');input.type='search';input.placeholder=API.user.role==='viewer'?'ค้นหารหัสเคส / แพทย์':'ค้นหา HN / ชื่อ / แพทย์';input.setAttribute('aria-label','ค้นหาผู้ป่วย');input.value=state.search;
    const select=el('select');select.setAttribute('aria-label','กรองรายการ');[['','รายการที่ใช้งาน'],['pending','ติดตามยังไม่ครบ'],['complete','ติดตามครบ'],...(API.user.role==='admin'?[['archived','รายการที่ยกเลิก']]:[])].forEach(([v,l])=>{const o=el('option','',l);o.value=v;select.append(o);});select.value=state.filter;
    const submit=el('button','secondary','ค้นหา');submit.type='submit';search.append(input,select,submit);search.onsubmit=e=>{e.preventDefault();state.search=input.value.trim();state.filter=select.value;state.page=1;render();};p.append(search);
    const q=state.search.toLowerCase();let list=state.cases.filter(c=>Boolean(c.archived)===(state.filter==='archived'));
    if(q)list=list.filter(c=>[c.hn,c.patient_name,c.surgeon,c.id].join(' ').toLowerCase().includes(q));
    if(state.filter==='pending')list=list.filter(c=>!c.day1_va||!c.week1_va||!c.month1_va);
    if(state.filter==='complete')list=list.filter(c=>c.day1_va&&c.week1_va&&c.month1_va);
    list.sort((a,b)=>b.surgery_date.localeCompare(a.surgery_date)||b.id.localeCompare(a.id));
    const pages=Math.max(1,Math.ceil(list.length/10));state.page=Math.min(state.page,pages);
    if(!list.length)empty(p,q?'ไม่พบข้อมูลตามคำค้น':'ยังไม่มีรายการ เริ่มบันทึกได้จาก “เพิ่มผู้ป่วยใหม่”');
    else list.slice((state.page-1)*10,state.page*10).forEach(c=>{
      const row=el('article','record'),info=el('div');info.append(el('h2','record-title',`${c.patient_name} · ${c.hn}`),el('div','record-meta',`${c.surgery_date} · ${c.eye} · ${c.surgeon} · ${c.procedure}`),el('div','record-meta',`Case ${c.id}`));
      const badges=el('div','follow-badges');[['day1','D1'],['week1','W1'],['month1','M1']].forEach(([key,label])=>badges.append(el('span',`badge ${c[key+'_va']?'done':''}`,`${label}: ${c[key+'_va']||'รอผล'}`)));
      const actions=el('div','record-actions');actions.append(button(canWrite()?'ดู / แก้ไข':'ดูรายละเอียด',()=>openCase(c)));
      if(API.user.role==='admin')actions.append(button(c.archived?'คืนรายการ':'ยกเลิกรายการ',async()=>{if(!await ask(c.archived?'คืนรายการนี้กลับเข้าการคำนวณ KPI?':'ยกเลิกรายการนี้จาก KPI? ข้อมูลยังเก็บไว้และคืนรายการได้'))return;try{await API.request(`${path('cases')}/${c.id}`,{method:'PATCH',body:{archived:!c.archived,revision:c.revision}});await load();notice('อัปเดตสถานะรายการแล้ว');}catch(e){notice(e.message,true);}} ,'quiet'));
      row.append(info,badges,actions);p.append(row);
    });
    const pager=el('div','pagination');pager.append(el('span','',`${list.length} รายการ · หน้า ${state.page}/${pages}`));const controls=el('div');const prev=button('ก่อนหน้า',()=>{state.page--;render();}),next=button('ถัดไป',()=>{state.page++;render();});prev.disabled=state.page<=1;next.disabled=state.page>=pages;controls.append(prev,next);pager.append(controls);p.append(pager);root.append(p);
  }
  function openCase(record=null){
    closeMenu();
    state.editing=record;state.dirty=false;const form=$('#case-form');form.reset();fieldNames.forEach(k=>{form.elements[k].value=record?.[k]??(k==='surgery_date'?today():'');});
    $('#case-fields').disabled=!canWrite()||Boolean(record?.archived);$('#save-case').hidden=!canWrite()||Boolean(record?.archived);$('#case-title').textContent=record?'รายละเอียด / แก้ไขผู้ป่วย':'เพิ่มผู้ป่วยใหม่';$('#save-case').textContent=record?'บันทึกการแก้ไข':'บันทึกผู้ป่วย';$('#case-error').textContent='';$('#save-state').textContent=record?`บันทึกล่าสุด ${record.updated} · ฉบับที่ ${record.revision}`:'ยังไม่ได้บันทึก';
    $('#case-audit').replaceChildren();if(record){$('#case-audit').append(el('p','',`สร้าง ${record.created} โดย ${record.created_by} · แก้ไขโดย ${record.updated_by}`));if(API.user.role==='admin')$('#case-audit').append(button('ดูประวัติการแก้ไข',async()=>{try{const data=await API.request(`${path('audit_logs')}?perPage=100&sort=-created&filter=${encodeURIComponent(`entity = "cases" && record_id = "${record.id}"`)}`);if(state.editing?.id!==record.id)return;$('#case-audit').replaceChildren(...data.items.map(a=>el('p','',`${a.created} · ${a.actor} · ${a.operation} · ${Object.keys(a.changes||{}).join(', ')}`)));}catch(e){$('#case-error').textContent=e.message;}}));}
    $('#case-dialog').showModal();
  }
  function renderUsers(root){const p=panel('สมาชิกทีม');state.users.forEach(u=>{const r=el('article','record');r.append(el('strong','',u.name),el('span','badge',`${roles[u.role]} · ${u.active?'เปิด':'ปิด'}ใช้งาน`));if(u.id!==API.user.id)r.append(button('แก้ไขสมาชิก',()=>{state.user=u;const f=$('#user-form');f.elements.name.value=u.name;f.elements.role.value=u.role;f.elements.active.checked=u.active;$('#user-error').textContent='';$('#user-dialog').showModal();}));else r.append(el('span','muted','บัญชีของคุณ'));p.append(r);});root.append(p);}
  function renderTargets(root) {
    $('#page-description').textContent='กำหนดเกณฑ์ประเมินผลลัพธ์และจำนวนข้อมูลขั้นต่ำสำหรับทีม';
    const p=panel('เกณฑ์ประเมิน KPI');
    p.append(button('＋ เพิ่มเป้าหมาย KPI',()=>openTarget()),el('p','muted','เพิ่มชื่อ KPI โดยเลือกข้อมูลผลลัพธ์ที่มีอยู่ 6 แบบ ระบบคำนวณจากรายการผ่าตัดเดิมตามสูตรที่แสดง ไม่เพิ่มแบบบันทึกผลลัพธ์ใหม่ ชื่อและสูตรจะเปลี่ยนไม่ได้หลังบันทึก'));
    const grid=el('div','target-grid');
    state.targets.forEach(t=>{
      const card=el('article','target-card');
      card.append(el('span',`badge ${t.enabled?'done':'off'}`,t.enabled?'เปิดประเมิน':'ปิดประเมิน'),el('h3','',t.label),el('p','muted',targetFormula(t.source||t.key)),el('strong','target-value',`${t.direction==='gte'?'≥':'≤'} ${t.target}%`),el('p','muted',`ข้อมูลขั้นต่ำ ${t.min_sample} รายที่ประเมิน`),el('p','record-meta',t.updated?`อัปเดต ${t.updated}`:'ยังไม่มีการแก้ไข'),button('แก้ไขเป้าหมาย',()=>openTarget(t)));
      grid.append(card);
    });
    if (!state.targets.length) empty(p,'ไม่พบรายการเป้าหมาย KPI กรุณาตรวจสอบการติดตั้งฐานข้อมูล');
    p.append(grid);root.append(p);
  }
  function targetFormula(source) {
    const definition=Clinical.definitions.find(d=>d[0]===source);
    if (!definition) return 'ไม่พบข้อมูลผลลัพธ์ที่รองรับ';
    return `${definition[1]}: ${definition[2]==='pass'?'ผ่าน / (ผ่าน + ไม่ผ่าน) × 100 · ผ่านเกณฑ์เมื่อ ≥ เป้าหมาย':'พบ / (พบ + ไม่พบ) × 100 · ผ่านเกณฑ์เมื่อ ≤ เป้าหมาย'} · ไม่นับผลที่ยังไม่ประเมิน`;
  }
  function openTarget(target=null) {
    if (API.user?.role!=='admin') return;
    targetState.editing=target;targetState.dirty=false;
    const f=$('#target-form');f.reset();f.elements.target.value=target?.target??'';f.elements.min_sample.value=target?.min_sample??1;f.elements.enabled.checked=target?.enabled??false;
    f.elements.source.replaceChildren(...Clinical.definitions.map(([key,label])=>{const option=el('option','',label);option.value=key;return option;}));
    f.elements.source.value=target?.source||target?.key||'va_outcome';
    $('#target-title').textContent=target?'แก้ไขเป้าหมาย KPI':'เพิ่มเป้าหมาย KPI';
    $('#target-definition').hidden=Boolean(target);$('#target-definition').disabled=Boolean(target);
    $('#target-label').textContent=target?.label||'กำหนดชื่อและเลือกสูตรก่อนบันทึก';
    $('#target-direction').textContent=targetFormula(f.elements.source.value);
    f.elements.source.onchange=()=>{$('#target-direction').textContent=targetFormula(f.elements.source.value);};
    $('#target-error').textContent='';$('#target-save-state').textContent=target?`บันทึกล่าสุด ${target.updated || 'ยังไม่มี'}`:'ยังไม่ได้บันทึก · เป้าหมายใหม่เริ่มต้นปิดประเมิน';
    $('#target-history').replaceChildren();
    if (target) $('#target-history').append(button('ดูประวัติเป้าหมาย',async()=>{
      try {
        const data=await API.request(`${path('audit_logs')}?perPage=20&sort=-created&filter=${encodeURIComponent(`entity = "kpi_targets" && record_id = "${target.id}"`)}`);
        if (targetState.editing?.id!==target.id) return;
        const names={target:'เป้าหมาย (%)',min_sample:'ข้อมูลขั้นต่ำ',enabled:'เปิดประเมิน'};
        $('#target-history').replaceChildren(...data.items.map(a=>{
          const display=v=>typeof v==='boolean'?(v?'เปิด':'ปิด'):v??'—';
          const changes=Object.entries(a.changes||{}).filter(([k])=>names[k]).map(([k,v])=>`${names[k]}: ${display(v.before)} → ${display(v.after)}`).join(' · ');
          return el('p','',`${a.created} · ผู้แก้ไข ${a.actor} · ${changes}`);
        }));
        if (!data.items.length) $('#target-history').textContent='ยังไม่มีประวัติการแก้ไข';
      } catch(e) { $('#target-error').textContent=e.message; }
    }));
    $('#target-dialog').showModal();
  }
  function renderActions(root){const p=panel('Monthly Quality Review · CQI / PDCA');if(canWrite())p.append(button('＋ เพิ่มแผนปรับปรุง',()=>openAction()));const actions=state.actions.filter(a=>a.month===$('#period-month').value);if(!actions.length)empty(p,'ยังไม่มีแผนทบทวนในเดือนอ้างอิง');actions.forEach(a=>{const row=el('article','record');const info=el('div');info.append(el('h3','record-title',a.title),el('p','muted',`${a.owner} · ครบกำหนด ${a.due_date}`));row.append(info,el('span','badge',a.stage.toUpperCase()),button('เปิดแผน',()=>openAction(a)));p.append(row);});root.append(p);}
  function openAction(record=null){state.action=record;const f=$('#action-form');f.reset();['month','due_date','title','owner','stage','detail'].forEach(k=>{f.elements[k].value=record?.[k]??({month:$('#period-month').value,stage:'plan'}[k]||'');});$('#action-fields').disabled=!canWrite();$('#save-action').hidden=!canWrite();$('#action-error').textContent='';$('#action-dialog').showModal();}
  function exportReport(cases){const rows=[['Cataract Outcome Report'],['ช่วงเวลา',$('#period-month').value,$('#period-mode').value],['วันที่สร้าง',today()],['KPI','Numerator','Denominator','Percent','Missing'],...Clinical.kpis(cases,state.targets).map(k=>[k.label,k.numerator,k.denominator,k.value===null?'N/A':k.value.toFixed(2),k.missing])];const csv='\uFEFF'+rows.map(r=>r.map(v=>'"'+String(v).replace(/^([\s]*[=+@-])/,"'"+'$1').replace(/"/g,'""')+'"').join(',')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));const a=el('a');a.href=url;a.download=`cataract-outcome-${$('#period-month').value}-${$('#period-mode').value}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);notice('ส่งออกสถิติจากข้อมูลที่บันทึกแล้ว');}
  async function submit(event,errorSelector,task){event.preventDefault();const b=event.currentTarget.querySelector('button[type=submit]');if(b.disabled)return;b.disabled=true;$(errorSelector).textContent='';try{await task();}catch(e){$(errorSelector).textContent=e.message;}finally{b.disabled=false;}}
  $('#login-form').onsubmit=e=>{const f=e.currentTarget;submit(e,'#login-error',async()=>{await API.login(f.elements.identity.value.trim(),f.elements.password.value);f.reset();state.view='dashboard';await load();});};
  $('#case-form').oninput=()=>{state.dirty=true;$('#save-state').textContent='มีการแก้ไขที่ยังไม่ได้บันทึก (Unsaved changes)';};
  $('#case-form').onsubmit=e=>{const f=e.currentTarget;submit(e,'#case-error',async()=>{state.saving=true;$('#save-state').textContent='กำลังบันทึก…';try{const body={};fieldNames.forEach(k=>{body[k]=f.elements[k].value.trim();});if(state.editing)body.revision=state.editing.revision;await API.request(path('cases')+(state.editing?'/'+state.editing.id:''),{method:state.editing?'PATCH':'POST',body});state.dirty=false;$('#case-dialog').close();await load();notice('บันทึกสำเร็จ • Dashboard และ KPI อัปเดตแล้ว');}catch(err){$('#save-state').textContent='ยังไม่บันทึก — ตรวจข้อผิดพลาดและลองใหม่';throw err;}finally{state.saving=false;}});};
  $('#user-form').onsubmit=e=>{const f=e.currentTarget;submit(e,'#user-error',async()=>{await API.request(path('users')+'/'+state.user.id,{method:'PATCH',body:{name:f.elements.name.value.trim(),role:f.elements.role.value,active:f.elements.active.checked}});$('#user-dialog').close();await load();notice('บันทึกสมาชิกแล้ว');});};
  $('#target-form').oninput=()=>{targetState.dirty=true;$('#target-save-state').textContent='มีการแก้ไขที่ยังไม่ได้บันทึก';};
  $('#target-form').onsubmit=e=>{
    const f=e.currentTarget;
    submit(e,'#target-error',async()=>{
      const target=Number(f.elements.target.value),min_sample=Number(f.elements.min_sample.value);
      if (!Number.isFinite(target)||target<0||target>100||!Number.isInteger(min_sample)||min_sample<1) throw new Error('เป้าหมายต้องอยู่ระหว่าง 0–100 และจำนวนข้อมูลขั้นต่ำต้องเป็นจำนวนเต็มตั้งแต่ 1');
      targetState.saving=true;$('#target-save-state').textContent='กำลังบันทึก…';
      try {
        const body={target,min_sample,enabled:f.elements.enabled.checked};
        if (!targetState.editing) {body.label=f.elements.label.value.trim();body.source=f.elements.source.value;if(!body.label)throw new Error('กรุณาระบุชื่อ KPI');}
        await API.request(path('kpi_targets')+(targetState.editing?'/'+targetState.editing.id:''),{method:targetState.editing?'PATCH':'POST',body});
        targetState.dirty=false;$('#target-dialog').close();await load();notice('บันทึกเป้าหมาย KPI แล้ว • เกณฑ์ใหม่ใช้กับ Dashboard และรายงาน');
      } catch(error) {$('#target-save-state').textContent='ยังไม่บันทึก กรุณาตรวจสอบและลองใหม่';throw error;}
      finally {targetState.saving=false;}
    });
  };
  $('#action-form').onsubmit=e=>{const f=e.currentTarget;submit(e,'#action-error',async()=>{await API.request(path('quality_actions')+(state.action?'/'+state.action.id:''),{method:state.action?'PATCH':'POST',body:Object.fromEntries(new FormData(f))});$('#action-dialog').close();await load();notice('บันทึกแผนปรับปรุงแล้ว');});};
  function ask(message){return new Promise(resolve=>{const dialog=$('#confirm-dialog');$('#confirm-message').textContent=message;const finish=value=>{dialog.close();resolve(value);};$('#confirm-yes').onclick=()=>finish(true);$('#confirm-no').onclick=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false);};dialog.showModal();});}
  async function closeDialog(id){if(id==='case-dialog' && (state.saving || state.dirty&&!await ask('ยังมีข้อมูลที่ไม่ได้บันทึก ต้องการยกเลิกการแก้ไข?')))return;if(id==='target-dialog' && (targetState.saving || targetState.dirty&&!await ask('ยังมีเป้าหมายที่ไม่ได้บันทึก ต้องการยกเลิกการแก้ไข?')))return;$('#'+id).close();if(id==='case-dialog')state.dirty=false;if(id==='target-dialog')targetState.dirty=false;}
  document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));$('#case-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog('case-dialog');});
  $('#target-dialog').addEventListener('cancel',e=>{e.preventDefault();closeDialog('target-dialog');});
  window.addEventListener('beforeunload',e=>{if(state.dirty||targetState.dirty){e.preventDefault();e.returnValue='';}});
  $('#logout').onclick=async()=>{if(state.dirty&&!await ask('ออกจากระบบและยกเลิกข้อมูลที่ยังไม่บันทึก?'))return;API.logout();sessionUI();};window.addEventListener('session-ended',sessionUI);
  $('#refresh').onclick=()=>load();$('#add-case-button').onclick=()=>openCase();document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>setView(b.dataset.view));
  $('#period-month').value=today().slice(0,7);$('#period-form').onsubmit=e=>{e.preventDefault();render();};
  buildFields();sessionUI();if(API.token)load();
})();
