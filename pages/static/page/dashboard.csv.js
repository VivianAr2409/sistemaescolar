(() => {
  // === Config ===
  const MONTH_LABELS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const CSV_REQUIRED_HEADERS = [
    "idAlumno","nombreAlumno","carrera","semestre","materia","unidad","calificacion",
    "asistenciasTotales","fechaRegistro",
    "riesgo_academico","riesgo_economico","riesgo_psicosocial",
    "riesgo_institucional","riesgo_tecnologico","riesgo_contextual","riesgos_totales"
  ];

  // === Estado ===
  let rawRows = [];
  let perStudent = new Map();

  // === DOM ===
  const $ = (s) => document.querySelector(s);
  const elKpiTotal = $("#totalStudents");
  const elKpiRiesgos = $("#riskFactors");
  const elKpiTasa = $("#kpiTasaExito");
  const elKpiProm = $("#kpiPromedioGeneral");
  const elHint = $("#csvLoadedHint");
  const inputCSV = $("#csvInput");
  const btnSelect = $("#btnSelectCSV");
  if (btnSelect && inputCSV) btnSelect.addEventListener("click", () => inputCSV.click());

  // === Utilidades para manejar Charts existentes ===

// Obtiene un chart si ya existe para ese canvas
function getChart(canvas) {
  if (!window.Chart || !canvas) return null;
  // Chart.js v3+
  if (Chart.getChart) return Chart.getChart(canvas);
  // fallback para versiones antiguas
  return canvas._chart || null;
}

// Crea o reutiliza un chart existente
function getOrCreateChart(canvasId, type, labels, datasetLabel) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return null;

  let ch = getChart(canvas);
  if (ch) {
    // Reusar: solo sincroniza labels
    if (labels) ch.data.labels = labels;
    return ch;
  }

  // Crear uno nuevo
  ch = new Chart(canvas, {
    type,
    data: { labels: labels || [], datasets: [{ label: datasetLabel || "", data: [] }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: type === 'doughnut' ? { position: 'right' } : undefined },
      scales: type === 'bar' ? { y: { beginAtZero: true } } : undefined
    }
  });

  // fallback v2
  if (!Chart.getChart) canvas._chart = ch;
  return ch;
}


  // === CSV parser básico con comillas ===
  function parseCSV(text) {
    const rows = []; let i=0, field="", row=[], inside=false;
    const pushF=()=>{row.push(field);field="";}, pushR=()=>{rows.push(row);row=[];};
    while(i<text.length){const c=text[i];
      if(c==='"'){ if(inside&&text[i+1]==='"'){field+='"';i++;} else inside=!inside; }
      else if(c===','&&!inside){ pushF(); }
      else if((c==='\n'||c==='\r')&&!inside){ pushF(); if(c==='\r'&&text[i+1]==='\n') i++; pushR(); }
      else { field+=c; }
      i++;
    }
    if(field.length||row.length){ pushF(); pushR(); }
    const nonEmpty = rows.filter(r=>r.some(v=>(v??"").toString().trim()!==""));
    if(!nonEmpty.length) return {headers:[],rows:[]};
    const headers = nonEmpty[0].map(h=>h.trim());
    const data = nonEmpty.slice(1).map(r=>{const o={}; headers.forEach((h,idx)=>o[h]=r[idx]??""); return o;});
    return { headers, rows: data };
  }

  function validateHeaders(h){ 
    const miss=CSV_REQUIRED_HEADERS.filter(x=>!h.includes(x));
    if(miss.length) throw new Error("Faltan columnas requeridas: "+miss.join(", "));
  }

  function toDate(iso){ const [y,m,d]=(iso||"").split("-").map(Number); return (y&&m&&d)?new Date(y,m-1,d):null; }

  // Agrupar por alumno
  function buildPerStudent(){
    perStudent.clear();
    rawRows.forEach(r=>{
      const id=String(r.idAlumno||"").trim(); if(!id) return;
      const cal=Number(r.calificacion); const d=toDate(r.fechaRegistro);
      const e=perStudent.get(id)||{ califs:[], firstDate:d||null, risks:{academico:0,economico:0,psicosocial:0,institucional:0,tecnologico:0,contextual:0} };
      if(!Number.isNaN(cal)) e.califs.push(cal);
      if(d && (!e.firstDate || d<e.firstDate)) e.firstDate=d;
      e.risks.academico     |= Number(r.riesgo_academico)?1:0;
      e.risks.economico     |= Number(r.riesgo_economico)?1:0;
      e.risks.psicosocial   |= Number(r.riesgo_psicosocial)?1:0;
      e.risks.institucional |= Number(r.riesgo_institucional)?1:0;
      e.risks.tecnologico   |= Number(r.riesgo_tecnologico)?1:0;
      e.risks.contextual    |= Number(r.riesgo_contextual)?1:0;
      perStudent.set(id,e);
    });
  }

  // KPIs
  function computeKPIs(){
    const totalEst=perStudent.size;
    let sumaProm=0, aprob=0, totalRiesgos=0;
    perStudent.forEach(s=>{
      const prom=s.califs.length?(s.califs.reduce((a,b)=>a+b,0)/s.califs.length):0;
      sumaProm+=prom; if(prom>=7) aprob++;
      totalRiesgos += (s.risks.academico?1:0)+(s.risks.economico?1:0)+(s.risks.psicosocial?1:0)+
                      (s.risks.institucional?1:0)+(s.risks.tecnologico?1:0)+(s.risks.contextual?1:0);
    });
    const tasaExito = totalEst ? Math.round(aprob*100/totalEst) : 0;
    const promedioGeneral = totalEst ? (sumaProm/totalEst) : 0;
    return { totalEst, totalRiesgos, tasaExito, promedioGeneral };
  }

  // Series gráficas
  function buildSeriesMeses(){
    const arr=new Array(12).fill(0);
    perStudent.forEach(s=>{ if(s.firstDate) arr[s.firstDate.getMonth()]++; });
    return arr;
  }
  function buildSeriesRiesgos(){
    const cats={"Académico":0,"Económico":0,"Psicosocial":0,"Institucional":0,"Tecnológico":0,"Contextual":0};
    perStudent.forEach(s=>{
      if(s.risks.academico)cats["Académico"]++;
      if(s.risks.economico)cats["Económico"]++;
      if(s.risks.psicosocial)cats["Psicosocial"]++;
      if(s.risks.institucional)cats["Institucional"]++;
      if(s.risks.tecnologico)cats["Tecnológico"]++;
      if(s.risks.contextual)cats["Contextual"]++;
    });
    return cats;
  }

  // UI
  function setText(el,val){ if(el) el.textContent = val; }
  function updateKPIs({totalEst,totalRiesgos,tasaExito,promedioGeneral}){
    setText(elKpiTotal, totalEst||0);
    setText(elKpiRiesgos, totalRiesgos||0);
    setText(elKpiTasa, (tasaExito||0).toString());
    setText(elKpiProm, (Math.round((promedioGeneral+Number.EPSILON)*10)/10).toFixed(1));
  }

function updateCharts() {
  // --- Distribución por mes ---
  const mesesData = buildSeriesMeses();
  const chMeses = getOrCreateChart('studentsChart', 'bar', MONTH_LABELS, 'Estudiantes');
  if (chMeses) {
    chMeses.data.datasets[0].data = mesesData;
    chMeses.update();
  }

  // --- Riesgos más comunes ---
  const riesgos = buildSeriesRiesgos();
  const labels = Object.keys(riesgos);
  const chRiesgos = getOrCreateChart('riskChart', 'doughnut', labels, '');
  if (chRiesgos) {
    chRiesgos.data.labels = labels;
    chRiesgos.data.datasets[0].data = labels.map(l => riesgos[l]);
    chRiesgos.update();
  }
}


  function refreshUI(){ updateKPIs(computeKPIs()); updateCharts(); if(elHint) elHint.style.display = rawRows.length?"inline":"none"; }

  // Persistencia ligera
  function saveToLocal(){ try{ localStorage.setItem("dashCsvData", JSON.stringify(rawRows)); }catch(e){} }
  function loadFromLocal(){ try{ const t=localStorage.getItem("dashCsvData"); if(!t) return false;
      const arr=JSON.parse(t); if(!Array.isArray(arr)||!arr.length) return false; rawRows=arr; buildPerStudent(); refreshUI(); return true; }catch(e){return false;} }

  function clearAll(){
    rawRows=[]; perStudent.clear();
    try{localStorage.removeItem("dashCsvData");}catch(e){}
    updateKPIs({totalEst:0,totalRiesgos:0,tasaExito:0,promedioGeneral:0});
    if(chartMeses){ chartMeses.data.datasets[0].data=[]; chartMeses.update(); }
    if(chartRiesgos){ chartRiesgos.data.datasets[0].data=[]; chartRiesgos.update(); }
    if(elHint) elHint.style.display="none"; if(inputCSV) inputCSV.value="";
  }

  // Exponer para los botones del HTML
  window.__dashImport = async function(){
    try{
      if(!inputCSV || !inputCSV.files || !inputCSV.files[0]) { alert("Selecciona un archivo CSV primero."); return; }
      const file=inputCSV.files[0]; const text=await file.text();
      const {headers, rows}=parseCSV(text); validateHeaders(headers);

      // Normaliza tipos
      rawRows = rows.map(r=>({
        idAlumno:r.idAlumno, nombreAlumno:r.nombreAlumno, carrera:r.carrera, semestre:Number(r.semestre),
        materia:r.materia, unidad:Number(r.unidad), calificacion:Number(r.calificacion),
        asistenciasTotales:Number(r.asistenciasTotales), fechaRegistro:r.fechaRegistro,
        riesgo_academico:Number(r.riesgo_academico), riesgo_economico:Number(r.riesgo_economico),
        riesgo_psicosocial:Number(r.riesgo_psicosocial), riesgo_institucional:Number(r.riesgo_institucional),
        riesgo_tecnologico:Number(r.riesgo_tecnologico), riesgo_contextual:Number(r.riesgo_contextual),
        riesgos_totales:Number(r.riesgos_totales)
      }));

      buildPerStudent();
      refreshUI();
      saveToLocal();
    }catch(err){ console.error(err); alert("No se pudo cargar el CSV: "+err.message); }
  };

  window.__dashClear = function(){ if(confirm("¿Deseas limpiar los datos del dashboard?")) clearAll(); };

  // Auto-carga si quedó algo guardado
  // loadFromLocal();
})();
