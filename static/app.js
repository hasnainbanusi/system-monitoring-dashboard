const $ = (id) => document.getElementById(id);
const MAX_POINTS = 30;
let previousNetwork = null;
let previousTime = null;

const labels = [];
const resourceData = {
  cpu: [],
  memory: [],
  download: [],
  upload: []
};

const commonOptions = {
  responsive: true,
  maintainAspectRatio: false,
  animation: false,
  interaction: { mode: "index", intersect: false },
  plugins: {
    legend: { display: false },
    tooltip: {
      backgroundColor: "#182130",
      titleColor: "#fff",
      bodyColor: "#cbd5e1",
      borderColor: "#344054",
      borderWidth: 1,
      padding: 10
    }
  },
  scales: {
    x: {
      grid: { color: "#202735" },
      ticks: { color: "#7d899e", maxTicksLimit: 6, maxRotation: 0 }
    },
    y: {
      beginAtZero: true,
      grid: { color: "#202735" },
      ticks: { color: "#7d899e" }
    }
  }
};

function createChart(id, datasets, maxY) {
  return new Chart($(id), {
    type: "line",
    data: { labels: [], datasets },
    options: {
      ...commonOptions,
      scales: {
        ...commonOptions.scales,
        y: {
          ...commonOptions.scales.y,
          ...(maxY ? { max: maxY } : {})
        }
      }
    }
  });
}

const resourceChart = createChart("resourceChart", [
  {
    label: "CPU",
    data: [],
    borderColor: "#5b9cff",
    backgroundColor: "#5b9cff18",
    fill: true,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.35
  },
  {
    label: "Memory",
    data: [],
    borderColor: "#ad86ff",
    backgroundColor: "#ad86ff12",
    fill: true,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.35
  }
], 100);

const networkChart = createChart("networkChart", [
  {
    label: "Download",
    data: [],
    borderColor: "#4bd6a0",
    backgroundColor: "#4bd6a012",
    fill: true,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.35
  },
  {
    label: "Upload",
    data: [],
    borderColor: "#ffb46a",
    backgroundColor: "#ffb46a12",
    fill: true,
    borderWidth: 2,
    pointRadius: 0,
    tension: 0.35
  }
]);

function mb(value) {
  return (value / 1024).toFixed(1) + " GB";
}

function bytes(value) {
  if (value < 1024) return value + " B";
  if (value < 1024 ** 2) return (value / 1024).toFixed(1) + " KB";
  if (value < 1024 ** 3) return (value / 1024 ** 2).toFixed(1) + " MB";
  return (value / 1024 ** 3).toFixed(2) + " GB";
}

function setMetric(valueId, barId, value) {
  $(valueId).textContent = value.toFixed(1);
  $(barId).style.width = Math.min(100, Math.max(0, value)) + "%";
}

function appendChartPoint(label, cpu, memory, download, upload) {
  labels.push(label);
  resourceData.cpu.push(cpu);
  resourceData.memory.push(memory);
  resourceData.download.push(download);
  resourceData.upload.push(upload);

  while (labels.length > MAX_POINTS) {
    labels.shift();
    for (const series of Object.values(resourceData)) {
      series.shift();
    }
  }

  resourceChart.data.labels = [...labels];
  resourceChart.data.datasets[0].data = [...resourceData.cpu];
  resourceChart.data.datasets[1].data = [...resourceData.memory];
  resourceChart.update("none");

  networkChart.data.labels = [...labels];
  networkChart.data.datasets[0].data = [...resourceData.download];
  networkChart.data.datasets[1].data = [...resourceData.upload];
  networkChart.update("none");
}

function renderProcesses(processes) {
  const table = $("processTable");
  table.replaceChildren();

  for (const process of processes) {
    const tr = document.createElement("tr");
    const name = document.createElement("td");
    name.className = "process-name";
    name.textContent = process.name;

    const pid = document.createElement("td");
    pid.className = "pid";
    pid.textContent = process.pid;

    const memory = document.createElement("td");
    memory.className = "mem-cell";

    const row = document.createElement("div");
    row.className = "mini-progress";

    const track = document.createElement("div");
    track.className = "mini-track";

    const fill = document.createElement("div");
    fill.className = "mini-fill";
    fill.style.width = Math.min(100, process.memory) + "%";

    track.appendChild(fill);

    const percentage = document.createElement("span");
    percentage.textContent = process.memory.toFixed(2) + "%";

    row.append(track, percentage);
    memory.appendChild(row);

    const status = document.createElement("td");
    const state = document.createElement("span");
    state.className = "state";
    state.textContent = "Running";
    status.appendChild(state);

    tr.append(name, pid, memory, status);
    table.appendChild(tr);
  }

  if (!processes.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 4;
    cell.textContent = "No process information available.";
    row.appendChild(cell);
    table.appendChild(row);
  }
}

async function refreshMetrics() {
  try {
    const response = await fetch("/api/metrics", { cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);

    const data = await response.json();

    $("hostname").textContent = data.hostname;
    $("platform").textContent = data.platform;
    $("uptime").textContent = data.uptime;
    $("processCount").textContent = data.process_count;
    $("cpuCores").textContent = data.cpu.cores;

    setMetric("cpuValue", "cpuBar", data.cpu.percent);
    setMetric("memoryValue", "memoryBar", data.memory.percent);
    setMetric("diskValue", "diskBar", data.disk.percent);

    $("memoryUsed").textContent = mb(data.memory.used) + " used";
    $("memoryTotal").textContent = mb(data.memory.total) + " total";
    $("diskUsed").textContent = mb(data.disk.used) + " used";
    $("diskTotal").textContent = mb(data.disk.total) + " total";
    $("receivedTotal").textContent = bytes(data.network.bytes_recv);

    let download = 0;
    let upload = 0;

    if (previousNetwork !== null && previousTime !== null) {
      const elapsed = (data.timestamp - previousTime);
      if (elapsed > 0) {
        download = Math.max(
          0, data.network.bytes_recv - previousNetwork.received
        ) / elapsed / 1024;

        upload = Math.max(
          0, data.network.bytes_sent - previousNetwork.sent
        ) / elapsed / 1024;
      }
    }

    previousNetwork = {
      sent: data.network.bytes_sent,
      received: data.network.bytes_recv
    };
    previousTime = data.timestamp;

    $("downloadRate").textContent = download.toFixed(1) + " KB/s";
    $("uploadRate").textContent = upload.toFixed(1) + " KB/s";
    $("networkValue").textContent = (download + upload).toFixed(1);
    $("updated").textContent = new Date(data.timestamp * 1000)
      .toLocaleTimeString();

    appendChartPoint(
      new Date(data.timestamp * 1000).toLocaleTimeString(),
      data.cpu.percent,
      data.memory.percent,
      download,
      upload
    );

    renderProcesses(data.processes);
  } catch (error) {
    $("updated").textContent = "Connection error";
    console.error("Metrics refresh failed:", error);
  }
}

refreshMetrics();
setInterval(refreshMetrics, 2000);
