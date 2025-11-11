// Datos globales
let students = [];
let charts = {};

// Inicializar iconos de Lucide
document.addEventListener("DOMContentLoaded", () => {
  lucide.createIcons();
  initializeApp();
});

// Inicializar aplicación
function initializeApp() {

  loadData(); 

  // Configurar navegación por pestañas
  setupTabs();

  // Configurar formulario
  setupForm();

  // Configurar CSV
  setupCSV();

  // Inicializar gráficos
  initializeCharts();

  // Actualizar estadísticas
  updateStats();

  // Actualizar tabla de datos
  updateDataTable();
  updatePreviewTable();

  clearAllData();

  // DESPLIEGUE DE MATERIAS
const materiasPorCarrera = {
    "Medicina": ["Anatomía", "Fisiología"],
    "Derecho": ["Derecho Civil", "Derecho Penal"],
    "Ingeniería": ["Matemáticas", "Física"],
    "Administración": ["Contabilidad", "Marketing"]
};

const carreraSelect = document.getElementById('carrera');
const materiaSelect = document.getElementById('materia');

carreraSelect.addEventListener('change', function() {
    const carrera = this.value;
    materiaSelect.innerHTML = '<option value="">Seleccionar...</option>';
    if (carrera && materiasPorCarrera[carrera]) {
        materiasPorCarrera[carrera].forEach(materia => {
            const option = document.createElement('option');
            option.value = materia;
            option.textContent = materia;
            materiaSelect.appendChild(option);
        });
    }
});

}

// Obtener el siguiente ID disponible
function getNextId() {
  if (students.length === 0) return 1;

  // Buscar el ID máximo actual
  const ids = students.map(s => parseInt(s.id)).filter(n => !isNaN(n));
  const maxId = Math.max(...ids);
  return maxId + 1;
}

// Configurar navegación por pestañas
function setupTabs() {
  const tabButtons = document.querySelectorAll(".tab-button");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const targetTab = button.dataset.tab;

      // Actualizar botones
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      button.classList.add("active");

      // Actualizar contenido
      tabContents.forEach((content) => content.classList.remove("active"));
      document.getElementById(targetTab).classList.add("active");

      // Actualizar iconos
      lucide.createIcons();

      // Actualizar gráficos si es necesario
      if (targetTab === "dashboard") {
        updateCharts();
      }
    });
  });
}

// Configurar formulario
function setupForm() {
  const form = document.getElementById("studentForm");

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    if (validateForm()) {
      saveStudent();
    }
  });
}

// Configurar CSV
function setupCSV() {
  const csvInput = document.getElementById("csvInput");
  const btnSelectCSV = document.getElementById("btnSelectCSV");
  const btnImportCSV = document.getElementById("btnImportCSV");
  const btnClearData = document.getElementById("btnClearData");

  btnSelectCSV.addEventListener("click", () => {
    csvInput.click();
  });

  csvInput.addEventListener("change", (e) => {
    if (e.target.files.length > 0) {
      document.getElementById("csvLoadedHint").style.display = "inline";
    }
  });

  btnImportCSV.addEventListener("click", () => {
    if (csvInput.files.length > 0) {
      importCSV(csvInput.files[0]);
    } else {
      alert("Por favor selecciona un archivo CSV primero");
    }
  });

  btnClearData.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que quieres eliminar todos los datos?")) {
      students = [];
      saveData();
      updateStats();
      updateDataTable();
      updatePreviewTable();
      updateCharts();
      alert("Datos eliminados correctamente");
    }
  });
}

// Importar CSV - ADAPTADO PARA TU ESTRUCTURA
function importCSV(file) {
  const reader = new FileReader();

  reader.onload = function (e) {
    try {
      const csvData = e.target.result;
      const rows = csvData.split("\n").filter((row) => row.trim() !== "");
      const headers = rows[0].split(",").map((h) => h.trim().replace(/"/g, ""));

      const importedStudents = [];

      for (let i = 1; i < rows.length; i++) {
        const values = rows[i]
          .split(",")
          .map((v) => v.trim().replace(/"/g, ""));

        // Convertir riesgos booleanos a array de textos
        const riesgosArray = [];
        if (values[9] === "1"){ riesgosArray.push("Académico"); }
        if (values[10] === "1"){ riesgosArray.push("Económico");}
        if (values[11] === "1"){ riesgosArray.push("Psicosocial");}
        if (values[12] === "1"){ riesgosArray.push("Institucional");}
        if (values[13] === "1"){ riesgosArray.push("Tecnológico");}
        if (values[14] === "1"){ riesgosArray.push("Contextual");}

        const student = {
          id: values[0] && !isNaN(values[0]) ? parseInt(values[0]) : getNextId(),
          nombreAlumno: values[1] || "",
          carrera: values[2] || "",
          semestre: parseInt(values[3]) || 1,
          materia: values[4] || "",
          unidad: values[5] || "",
          calificacion: parseFloat(values[6]) || 0,
          asistenciasTotales: parseInt(values[7]) || 0,
          fechaRegistro: values[8] || "",
          riesgo_academico: values[9],
          riesgo_economico: values[10],
          riesgo_psicosocial: values[11],
          riesgo_institucional: values[12],
          riesgo_tecnologico: values[13],
          riesgo_contextual: values[14],
          riesgos: riesgosArray,
          riesgos_totales: parseInt(values[15]) || riesgosArray.length,
          fecha: new Date().toISOString(),
        };

        importedStudents.push(student);
      }

      // --- LIMPIAR LOS DATOS ANTERIORES ANTES DE AGREGAR LOS NUEVOS ---
      students = [];
      saveData();

      students = [...students, ...importedStudents];
      saveData();
      updateStats();
      updateDataTable();
      updatePreviewTable();
      updateCharts();

      alert(
        `Se importaron ${importedStudents.length} estudiantes correctamente`
      );
    } catch (error) {
      console.error("Error al importar CSV:", error);
      alert("Error al importar el archivo CSV. Verifica el formato.");
    }
  };

  reader.onerror = function () {
    alert("Error al leer el archivo CSV");
  };

  reader.readAsText(file);
}

// Validar formulario
function validateForm() {
  let isValid = true;
  const form = document.getElementById("studentForm");
  const formGroups = form.querySelectorAll(".form-group");

  formGroups.forEach((group) => {
    const input = group.querySelector("input, select");
    const errorMessage = group.querySelector(".error-message");

    group.classList.remove("error");

    if (input.hasAttribute("required") && !input.value) {
      group.classList.add("error");
      errorMessage.textContent = "Este campo es requerido";
      isValid = false;
    } /*else if (
      input.type === "email" &&
      input.value &&
      !isValidEmail(input.value)
    ) {
      group.classList.add("error");
      errorMessage.textContent = "Email inválido";
      isValid = false;
    }*/ else if (input.type === "number" && input.value) {
      const value = parseFloat(input.value);
      const min = parseFloat(input.min);
      const max = parseFloat(input.max);
      
      if (min && value < min) {
        group.classList.add("error");
        errorMessage.textContent = `El valor mínimo es ${min}`;
        isValid = false;
      } else if (max && value > max) {
        group.classList.add("error");
        errorMessage.textContent = `El valor máximo es ${max}`;
        isValid = false;
      }
    }
  });

  return isValid;
}

// Validar email
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Guardar estudiante
function saveStudent() {
  const form = document.getElementById("studentForm");
  const formData = new FormData(form);

   // --- CREAR ARRAY DE RIESGOS ---
  const riesgosArray = [];
  if (formData.get("riesgo_academico") === "1") riesgosArray.push("Académico");
  if (formData.get("riesgo_economico") === "1") riesgosArray.push("Económico");
  if (formData.get("riesgo_psicosocial") === "1") riesgosArray.push("Psicosocial");
  if (formData.get("riesgo_institucional") === "1") riesgosArray.push("Institucional");
  if (formData.get("riesgo_tecnologico") === "1") riesgosArray.push("Tecnológico");
  if (formData.get("riesgo_contextual") === "1") riesgosArray.push("Contextual");

  const student = {
    id: getNextId(),
    nombreAlumno: formData.get("nombreAlumno"),
    carrera: formData.get("carrera"),
    semestre: parseInt(formData.get("semestre")),
    materia: formData.get("materia") || "",
    unidad: parseInt(formData.get("unidad")) || 0,
    calificacion: parseFloat(formData.get("promedio")) || 0,
    asistenciasTotales: parseInt(formData.get("asistencias")) || 0,
    fechaRegistro: new Date().toISOString(),
    riesgo_academico: formData.get("riesgo_academico")|| '0',
    riesgo_economico: formData.get("riesgo_economico")|| '0',
    riesgo_psicosocial: formData.get("riesgo_psicosocial"),
    riesgo_institucional: formData.get("riesgo_institucional")|| '0',
    riesgo_tecnologico: formData.get("riesgo_tecnologico")|| '0',
    riesgo_contextual: formData.get("riesgo_contextual")|| '0',
    riesgos: riesgosArray, 
    riesgos_totales: riesgosArray.length,
  };

  students.push(student);
  saveData();

  // Mostrar mensaje de éxito
  showSuccessMessage();

  // Limpiar formulario
  resetForm();

  // Actualizar estadísticas y gráficos
  updateStats();
  updateCharts();
  updateDataTable();
  updatePreviewTable();
}


// Mostrar mensaje de éxito
function showSuccessMessage() {
  const message = document.getElementById("successMessage");
  message.style.display = "flex";

  setTimeout(() => {
    message.style.display = "none";
  }, 3000);

  lucide.createIcons();
}

// Limpiar formulario
function resetForm() {
  document.getElementById("studentForm").reset();
  document.querySelectorAll(".form-group").forEach((group) => {
    group.classList.remove("error");
  });
}

// Actualizar estadísticas
function updateStats() {
  const totalStudents = students.length;
  const totalRiskFactors = students.reduce(
    (sum, s) => sum + s.riesgos_totales,
    0
  );
  const promedioGeneral =
    students.length > 0
      ? (
          students.reduce((sum, s) => sum + s.calificacion, 0) / students.length
        ).toFixed(1)
      : 0;
  const asistenciaPromedio =
    students.length > 0
      ? Math.round(
          students.reduce((sum, s) => sum + s.asistenciasTotales, 0) /
            students.length
        )
      : 0;

  document.getElementById("totalStudents").textContent = totalStudents;
  document.getElementById("riskFactors").textContent = totalRiskFactors;
  document.getElementById("kpiPromedioGeneral").textContent = promedioGeneral;
  document.getElementById(
    "kpiAsistencia"
  ).textContent = `${asistenciaPromedio}%`;
}

// Inicializar gráficos
function initializeCharts() {
  // Gráfico de distribución por carrera
  const carreraCtx = document.getElementById("carreraChart").getContext("2d");
  charts.carrera = new Chart(carreraCtx, {
    type: "bar",
    data: {
      labels: ["Medicina", "Derecho", "Ingeniería", "Administración"],
      datasets: [
        {
          label: "Estudiantes por Carrera",
          data: [0, 0, 0, 0],
          backgroundColor: "rgba(102, 126, 234, 0.8)",
          borderColor: "rgba(102, 126, 234, 1)",
          borderWidth: 2,
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          display: false,
        },
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(0, 0, 0, 0.05)",
          },
        },
        x: {
          grid: {
            display: false,
          },
        },
      },
    },
  });

  // Gráfico de factores de riesgo
  const riskCtx = document.getElementById("riskChart").getContext("2d");
  charts.risk = new Chart(riskCtx, {
    type: "doughnut",
    data: {
      labels: [
        "Académico",
        "Económico",
        "Psicosocial",
        "Institucional",
        "Tecnológico",
        "Contextual",
      ],
      datasets: [
        {
          data: [0, 0, 0, 0, 0, 0],
          backgroundColor: [
            "rgba(102, 126, 234, 0.8)",
            "rgba(240, 147, 251, 0.8)",
            "rgba(79, 172, 254, 0.8)",
            "rgba(250, 112, 154, 0.8)",
            "rgba(254, 225, 64, 0.8)",
            "rgba(16, 185, 129, 0.8)",
          ],
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          position: "right",
        },
      },
    },
  });

  // Actualizar gráficos con datos reales
  updateCharts();
}

// Actualizar gráficos
function updateCharts() {
  if (students.length === 0) {
    // Vaciar gráfico de carreras
    charts.carrera.data.datasets[0].data = [0, 0, 0, 0];
    charts.carrera.update();

    // Vaciar gráfico de riesgos
    charts.risk.data.datasets[0].data = [0, 0, 0, 0, 0, 0];
    charts.risk.update();
    return;
  }

  // Actualizar gráfico de carreras
  const carreraCount = {
    Medicina: 0,
    Derecho: 0,
    Ingeniería: 0,
    Administración: 0,
  };

  students.forEach((s) => {
    if (carreraCount.hasOwnProperty(s.carrera)) {
      carreraCount[s.carrera]++;
    }
  });

  charts.carrera.data.datasets[0].data = Object.values(carreraCount);
  charts.carrera.update();

  // Actualizar gráfico de factores de riesgo
  const riskCounts = {
    Académico: 0,
    Económico: 0,
    Psicosocial: 0,
    Institucional: 0,
    Tecnológico: 0,
    Contextual: 0,
  };

  students.forEach((s) => {
    s.riesgos.forEach((r) => {
      if (riskCounts.hasOwnProperty(r)) {
        riskCounts[r]++;
      }
    });
  });

  charts.risk.data.datasets[0].data = Object.values(riskCounts);
  charts.risk.update();
}

// Actualizar tabla de datos principal
function updateDataTable() {
  const tbody = document.getElementById("dataTableBody");

  if (students.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="no-data">No hay datos para mostrar</td></tr>';
    return;
  }

  tbody.innerHTML = students
    .map(
      (s) => `
        <tr>
            <td>${s.id}</td>
            <td>${s.nombreAlumno}</td>
            <td>${s.carrera}</td>
            <td>${s.semestre}</td>
            <td>${s.materia}</td>
            <td>${s.unidad}</td>
            <td>${s.calificacion}</td>
            <td>${s.asistenciasTotales}</td> 
            <td>${s.fechaRegistro}</td> 
            <td>${s.riesgo_academico || "0"}</td> 
            <td>${s.riesgo_economico || "0"}</td>
            <td>${s.riesgo_psicosocial || "0"}</td>
            <td>${s.riesgo_institucional || "0"}</td>
            <td>${s.riesgo_tecnologico || "0"}</td>
            <td>${s.riesgo_contextual || "0"}</td> 
            <td>${s.riesgos_totales}</td>
        </tr>
    `
    )
    .join("");
}

// Actualizar tabla de vista previa
function updatePreviewTable() {
  const tbody = document.getElementById("previewTableBody");

  if (students.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="5" class="no-data">No hay datos para mostrar</td></tr>';
    return;
  }

  // Mostrar solo los primeros 5 registros en la vista previa
  const previewStudents = students.slice(0, 5);

  tbody.innerHTML = previewStudents
    .map(
      (s) => `
        <tr>
            <td>${s.id}</td>
            <td>${s.nombreAlumno}</td>
            <td>${s.carrera}</td>
            <td>${s.semestre}</td>
            <td>${s.materia}</td>
            <td>${s.unidad}</td>
            <td>${s.calificacion}</td>
             <td>${s.asistenciasTotales}</td> 
            <td>${s.fechaRegistro}</td>
            <td>${s.riesgo_academico || "0"}</td> 
            <td>${s.riesgo_economico || "0"}</td>
            <td>${s.riesgo_psicosocial || "0"}</td>
            <td>${s.riesgo_institucional || "0"}</td>
            <td>${s.riesgo_tecnologico || "0"}</td>
            <td>${s.riesgo_contextual || "0"}</td> 
            <td>${s.riesgos_totales}</td>
        </tr>
    `
    )
    .join("");
} 
    

// EXPORTAR DATOS - FUNCIONES MEJORADAS PARA TU CSV

// Exportar datos
function exportData(format) {
  if (students.length === 0) {
    alert("No hay datos para exportar");
    return;
  }

  switch (format) {
    case "json":
      exportJSON();
      break;
    case "csv":
      exportCSV();
      break;
    case "excel":
      exportExcel();
      break;
  }
}

// Exportar JSON
function exportJSON() {
  const dataStr = JSON.stringify(students, null, 2);
  const dataBlob = new Blob([dataStr], { type: "application/json" });
  downloadFile(dataBlob, "estudiantes.json");
}

// Exportar CSV
function exportCSV() {
  const headers = [
    'ID',
    "Nombre",
    "Carrera",
    "Semestre",
    "Materia",
    "Unidad",
    "Calificación",
    "Asistencias",
    "Fecha Registro",
    "Riesgo Académico",
    "Riesgo Económico",
    "Riesgo Psicosocial",
    "Riesgo Institucional",
    "Riesgo Tecnológico",
    "Riesgo Contextual",
    "Total Riesgos",
  ];
  const rows = students.map((s) => [
    s.id || "",
    s.nombreAlumno || "",
    s.carrera || "",
    s.semestre || "",
    s.materia || "",
    s.unidad || "",
    s.calificacion || "",
    s.asistenciasTotales || "",
    s.fechaRegistro || "",
    s.riesgo_academico || "0",
    s.riesgo_economico || "0",
    s.riesgo_psicosocial || "0",
    s.riesgo_institucional || "0",
    s.riesgo_tecnologico || "0",
    s.riesgo_contextual || "0",
    s.riesgos_totales || "",
  ]);

  let csvContent = headers.map((header) => `"${header}"`).join(",") + "\n";
  rows.forEach((row) => {
    const escapedRow = row.map((cell) => {
      if (cell === null || cell === undefined) return '""';
      const cellString = String(cell);
      return `"${cellString.replace(/"/g, '""')}"`;
    });
    csvContent += escapedRow.join(",") + "\n";
  });

  const dataBlob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  downloadFile(
    dataBlob,
    `estudiantes_${new Date().toISOString().split("T")[0]}.csv`
  );
}

// Exportar a Excel - COMPLETAMENTE ADAPTADO PARA TU CSV
function exportExcel() {
  try {
    // Preparar los datos para Excel
    const headers = [
      "ID",
      "Nombre",
      "Carrera",
      "Semestre",
      "Materia",
      "Unidad",
      "Calificación",
      "Asistencias Totales",
      "Fecha Registro",
      "Riesgo Académico",
      "Riesgo Económico",
      "Riesgo Psicosocial",
      "Riesgo Institucional",
      "Riesgo Tecnológico",
      "Riesgo Contextual",
      "Total Riesgos",
    ];

    const dataForExcel = students.map((student) => [
      student.id,
      student.nombreAlumno,
      student.carrera,
      student.semestre,
      student.materia,
      student.unidad || "",
      student.calificacion,
      student.asistenciasTotales,
      student.fechaRegistro || new Date().toISOString().split("T")[0],
      student.riesgo_academico || "0",
      student.riesgo_economico || "0",
      student.riesgo_psicosocial || "0",
      student.riesgo_institucional || "0",
      student.riesgo_tecnologico || "0",
      student.riesgo_contextual || "0",
      student.riesgos_totales || "",
    ]);

    // Crear libro de trabajo
    const wb = XLSX.utils.book_new();

    // Crear hoja de datos principales
    const wsData = [headers, ...dataForExcel];
    const ws = XLSX.utils.aoa_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Estudiantes");

    // Crear hoja de resumen estadístico
    const summaryData = [
      ["RESUMEN ESTADÍSTICO - SISTEMA ESCOLAR", ""],
      ["", ""],
      ["Total Estudiantes", students.length],
      [
        "Promedio General de Calificaciones",
        (
          students.reduce((sum, s) => sum + s.calificacion, 0) / students.length
        ).toFixed(2),
      ],
      [
        "Total Factores de Riesgo Identificados",
        students.reduce((sum, s) => sum + s.riesgos_totales, 0),
      ],
      [
        "Asistencia Promedio",
        Math.round(
          students.reduce((sum, s) => sum + s.asistenciasTotales, 0) /
            students.length
        ) + "%",
      ],
      ["", ""],
      ["DISTRIBUCIÓN POR CARRERA", ""],
    ];

    // Agregar distribución por carrera
    const careerCount = {};
    students.forEach((s) => {
      careerCount[s.carrera] = (careerCount[s.carrera] || 0) + 1;
    });

    Object.entries(careerCount).forEach(([carrera, count]) => {
      summaryData.push([carrera, count]);
    });

    summaryData.push(["", ""]);
    summaryData.push(["DISTRIBUCIÓN DE RIESGOS", ""]);

    // Agregar distribución de riesgos
    const riskCounts = {
      Académico: 0,
      Económico: 0,
      Psicosocial: 0,
      Institucional: 0,
      Tecnológico: 0,
      Contextual: 0,
    };

    students.forEach((s) => {
      if (s.riesgo_academico === '1') riskCounts['Académico']++;
      if (s.riesgo_economico === '1') riskCounts['Económico']++;
      if (s.riesgo_psicosocial === '1') riskCounts['Psicosocial']++;
      if (s.riesgo_institucional === '1') riskCounts['Institucional']++;
      if (s.riesgo_tecnologico === '1') riskCounts['Tecnológico']++;
      if (s.riesgo_contextual === '1') riskCounts['Contextual']++;
    });

    Object.entries(riskCounts).forEach(([riesgo, count]) => {
      summaryData.push([riesgo, count]);
    });

    summaryData.push(["", ""]);
    summaryData.push(["ANÁLISIS POR SEMESTRE", ""]);

    // Agregar distribución por semestre
    const semesterCount = {};
    students.forEach((s) => {
      semesterCount[`Semestre ${s.semestre}`] =
        (semesterCount[`Semestre ${s.semestre}`] || 0) + 1;
    });

    Object.entries(semesterCount).forEach(([semestre, count]) => {
      summaryData.push([semestre, count]);
    });

    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, "Resumen Estadístico");

    // Generar archivo Excel
    const fileName = `reporte_estudiantes_${
      new Date().toISOString().split("T")[0]
    }.xlsx`;
    XLSX.writeFile(wb, fileName);

    console.log("Archivo Excel exportado exitosamente");
  } catch (error) {
    console.error("Error al exportar a Excel:", error);
    alert("Error al exportar a Excel. Verifica la consola para más detalles.");
  }
}

// Descargar archivo
function downloadFile(blob, filename) {
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// Guardar datos en localStorage
function saveData() {
  localStorage.setItem("students", JSON.stringify(students));
}

// Cargar datos de localStorage
function loadData() {
  const saved = localStorage.getItem("students");
  if (saved) {
    students = JSON.parse(saved);
  }
}

// Limpiar todos los datos
function clearAllData() {
  students = [];
  saveData(); 
  updateStats();       
  updateDataTable();   
  updatePreviewTable();
  updateCharts();      
}