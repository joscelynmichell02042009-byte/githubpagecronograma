(function(){
  const SUPABASE_URL = 'https://ufmjbvidooasyirzatyv.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_3MXo0sSdigFF9B6OTnF2DA_9ZnZ36SV';
  const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  const COLORS = ['#7C93B0','#5FA79A','#D3A24E','#B77FA6','#7FA07C','#C97B58','#6D80B0','#C97D8A'];

  let tasks = [];
  let editingId = null;

  const form = document.getElementById('taskForm');
  const fName = document.getElementById('fName');
  const fStart = document.getElementById('fStart');
  const fEnd = document.getElementById('fEnd');
  const fAssignee = document.getElementById('fAssignee');
  const fPct = document.getElementById('fPct');
  const submitBtn = document.getElementById('submitBtn');
  const cancelEditBtn = document.getElementById('cancelEditBtn');
  const formMsg = document.getElementById('formMsg');
  const ganttScroll = document.getElementById('ganttScroll');
  const statStrip = document.getElementById('statStrip');

  function parseDate(s){ const [y,m,d] = s.split('-').map(Number); return new Date(y, m-1, d); }
  function fmtISO(d){ return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
  function daysBetween(a,b){ return Math.round((b-a)/86400000); }
  function addDays(d,n){ const r = new Date(d); r.setDate(r.getDate()+n); return r; }
  function sameDay(a,b){ return a.getFullYear()===b.getFullYear() && a.getMonth()===b.getMonth() && a.getDate()===b.getDate(); }

  const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const WEEKDAY_SHORT = ['D','L','M','X','J','V','S'];

  async function loadTasks(){
    try{
      const { data, error } = await supabase
        .from('activities')
        .select('*')
        .order('start_date', { ascending: true });

      if(error) throw error;

      tasks = data.map(t => ({
        id: t.id,
        name: t.name,
        start: t.start_date,
        end: t.end_date,
        assignee: t.assignee || '',
        pct: t.progress_pct || 0,
        color: t.color || COLORS[0]
      }));

      render();
    }catch(e){
      console.error('Error cargando actividades:', e);
      formMsg.textContent = 'No se pudieron cargar las actividades desde Supabase.';
      tasks = [];
      render();
    }
  }

  function resetForm(){
    editingId = null;
    form.reset();
    fPct.value = 0;
    submitBtn.textContent = 'Agregar';
    cancelEditBtn.style.display = 'none';
    formMsg.textContent = '';
  }

  form.addEventListener('submit', async function(e){
    e.preventDefault();
    formMsg.textContent = '';
    const name = fName.value.trim();
    const start = fStart.value;
    const end = fEnd.value;
    const assignee = fAssignee.value.trim();
    let pct = Number(fPct.value);
    if(!name || !start || !end){ formMsg.textContent = 'Completa actividad, inicio y fin.'; return; }
    if(parseDate(end) < parseDate(start)){ formMsg.textContent = 'La fecha de fin no puede ser anterior al inicio.'; return; }
    if(isNaN(pct)) pct = 0;
    pct = Math.max(0, Math.min(100, Math.round(pct)));

    try{
      if(editingId){
        const { error } = await supabase
          .from('activities')
          .update({
            name: name,
            start_date: start,
            end_date: end,
            assignee: assignee,
            progress_pct: pct
          })
          .eq('id', editingId);

        if(error) throw error;
      } else {
        const { error } = await supabase
          .from('activities')
          .insert({
            name: name,
            start_date: start,
            end_date: end,
            assignee: assignee,
            progress_pct: pct,
            color: COLORS[tasks.length % COLORS.length]
          });

        if(error) throw error;
      }

      resetForm();
      await loadTasks();
    }catch(e){
      console.error(e);
      formMsg.textContent = 'No se pudo guardar la actividad.';
    }
  });

  cancelEditBtn.addEventListener('click', resetForm);

  function editTask(id){
    const t = tasks.find(x => x.id === id);
    if(!t) return;
    editingId = id;
    fName.value = t.name;
    fStart.value = t.start;
    fEnd.value = t.end;
    fAssignee.value = t.assignee || '';
    fPct.value = t.pct;
    submitBtn.textContent = 'Guardar cambios';
    cancelEditBtn.style.display = 'inline-block';
    fName.focus();
  }

  async function deleteTask(id){
    try{
      const { error } = await supabase
        .from('activities')
        .delete()
        .eq('id', id);

      if(error) throw error;

      await loadTasks();
    }catch(e){
      console.error(e);
      formMsg.textContent = 'No se pudo eliminar la actividad.';
    }
  }

  function hexToRgba(hex, alpha){
    const h = hex.replace('#','');
    const r = parseInt(h.substring(0,2),16), g = parseInt(h.substring(2,4),16), b = parseInt(h.substring(4,6),16);
    return 'rgba('+r+','+g+','+b+','+alpha+')';
  }

  function updateStats(){
    if(tasks.length === 0){ statStrip.innerHTML = ''; return; }
    const avg = Math.round(tasks.reduce((s,t)=>s+t.pct,0) / tasks.length);
    const done = tasks.filter(t => t.pct >= 100).length;
    statStrip.innerHTML =
      '<div><b>'+tasks.length+'</b>actividades</div>'+
      '<div><b>'+avg+'%</b>avance promedio</div>'+
      '<div><b>'+done+'</b>completadas</div>';
  }

  function render(){
    updateStats();

    if(tasks.length === 0){
      ganttScroll.innerHTML = '<div class="empty-state" style="width:100%;"><div class="big">Aún no hay actividades</div>Agrega la primera actividad arriba para ver el cronograma.</div>';
      return;
    }

    let minStart = parseDate(tasks[0].start), maxEnd = parseDate(tasks[0].end);
    tasks.forEach(t => {
      const s = parseDate(t.start), e = parseDate(t.end);
      if(s < minStart) minStart = s;
      if(e > maxEnd) maxEnd = e;
    });
    const rangeStart = addDays(minStart, -2);
    const rangeEnd = addDays(maxEnd, 2);
    const totalDays = daysBetween(rangeStart, rangeEnd) + 1;

    const dayWidth = totalDays > 90 ? 26 : (totalDays > 45 ? 32 : 40);
    const today = new Date(); today.setHours(0,0,0,0);

    let sideHtml = '<div class="side-head">Actividad</div>';
    tasks.forEach(t => {
      sideHtml += '<div class="side-row">'+
        '<div class="task-swatch" style="background:'+t.color+'"></div>'+
        '<div class="task-meta"><div class="task-name">'+escapeHtml(t.name)+'</div>'+
        '<div class="task-assignee">'+(t.assignee ? escapeHtml(t.assignee)+' · ' : '')+t.pct+'%</div></div>'+
        '<div class="row-actions">'+
          '<button class="icon-btn edit" data-id="'+t.id+'" title="Editar" aria-label="Editar '+escapeHtml(t.name)+'">'+
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>'+
          '</button>'+
          '<button class="icon-btn del" data-id="'+t.id+'" title="Eliminar" aria-label="Eliminar '+escapeHtml(t.name)+'">'+
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>'+
          '</button>'+
        '</div>'+
      '</div>';
    });

    let monthHtml = '';
    let cursor = new Date(rangeStart);
    while(cursor <= rangeEnd){
      const m = cursor.getMonth(), y = cursor.getFullYear();
      let daysInThisMonth = 0;
      const scan = new Date(cursor);
      while(scan <= rangeEnd && scan.getMonth() === m && scan.getFullYear() === y){
        daysInThisMonth++; scan.setDate(scan.getDate()+1);
      }
      monthHtml += '<div class="month-cell" style="width:'+(daysInThisMonth*dayWidth)+'px;">'+MONTHS[m]+' '+y+'</div>';
      cursor = scan;
    }

    let dayHtml = '';
    cursor = new Date(rangeStart);
    while(cursor <= rangeEnd){
      const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      const isToday = sameDay(cursor, today);
      dayHtml += '<div class="day-cell'+(isWeekend?' weekend':'')+(isToday?' today':'')+'" style="width:'+dayWidth+'px;">'+cursor.getDate()+'</div>';
      cursor = addDays(cursor, 1);
    }

    let gridBgHtml = '';
    cursor = new Date(rangeStart);
    while(cursor <= rangeEnd){
      const isWeekend = cursor.getDay() === 0 || cursor.getDay() === 6;
      gridBgHtml += '<div class="day-cell'+(isWeekend?' weekend':'')+'" style="width:'+dayWidth+'px;"></div>';
      cursor = addDays(cursor, 1);
    }

    const todayOffset = daysBetween(rangeStart, today) * dayWidth + dayWidth/2;
    const showTodayLine = today >= rangeStart && today <= rangeEnd;

    let rowsHtml = '';
    tasks.forEach(t => {
      const s = parseDate(t.start), e = parseDate(t.end);
      const left = daysBetween(rangeStart, s) * dayWidth;
      const width = (daysBetween(s, e) + 1) * dayWidth - 4;
      const pctWidth = Math.max(0, Math.min(100, t.pct));
      rowsHtml += '<div class="grid-row" style="width:'+(totalDays*dayWidth)+'px;">'+
        '<div class="grid-bg">'+gridBgHtml+'</div>'+
        (showTodayLine ? '<div class="today-line" style="left:'+todayOffset+'px;"></div>' : '')+
        '<div class="bar" style="left:'+left+'px;width:'+width+'px;background:'+hexToRgba(t.color,0.28)+';" data-id="'+t.id+'" title="'+escapeHtml(t.name)+' — '+t.pct+'%">'+
          '<div class="bar-progress" style="width:'+pctWidth+'%;background:'+t.color+';"></div>'+
          '<div class="bar-label">'+escapeHtml(t.name)+'</div>'+
          '<div class="bar-pct">'+t.pct+'%</div>'+
        '</div>'+
      '</div>';
    });

    ganttScroll.innerHTML =
      '<div class="side">'+sideHtml+'</div>'+
      '<div class="timeline"><div class="timeline-inner" style="width:'+(totalDays*dayWidth)+'px;">'+
        '<div class="month-row">'+monthHtml+'</div>'+
        '<div class="day-row">'+dayHtml+'</div>'+
        rowsHtml+
      '</div></div>';

    ganttScroll.querySelectorAll('.icon-btn.edit').forEach(b => b.addEventListener('click', () => editTask(b.dataset.id)));
    ganttScroll.querySelectorAll('.icon-btn.del').forEach(b => b.addEventListener('click', () => deleteTask(b.dataset.id)));
    ganttScroll.querySelectorAll('.bar').forEach(b => b.addEventListener('click', () => editTask(b.dataset.id)));
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  loadTasks();
})();
