const schedules = {
  weekday: {
    label: "Weekday",
    startHour: 16,
    classes: 3,
    segments: [
      { name: "Warm Up", minutes: 8, color: "#76e4f7" },
      { name: "1st Rotation", minutes: 16, color: "#6dc9ff" },
      { name: "2nd Rotation", minutes: 16, color: "#7da0ff" },
      { name: "3rd Rotation", minutes: 16, color: "#9481ff" },
      { name: "Warm Down", minutes: 4, color: "#ff7ec9" },
    ],
  },
  saturday: {
    label: "Saturday",
    classes: 4,
    classStarts: [9, 9.75, 10.75, 11.75],
    segments: [
      { name: "Warm Up", minutes: 8, color: "#7dffce" },
      { name: "1st Rotation", minutes: 11, color: "#7ce6ff" },
      { name: "2nd Rotation", minutes: 11, color: "#75b5ff" },
      { name: "3rd Rotation", minutes: 11, color: "#6d8dff" },
      { name: "Warm Down", minutes: 4, color: "#ffa8de" },
    ],
  },
  sunday: {
    label: "Sunday",
    classes: 3,
    classStarts: [9, 10, 11],
    segments: [
      { name: "Warm Up", minutes: 8, color: "#ffe89a" },
      { name: "1st Rotation", minutes: 11, color: "#ffcb7d" },
      { name: "2nd Rotation", minutes: 11, color: "#ff9e7d" },
      { name: "3rd Rotation", minutes: 11, color: "#f47791" },
      { name: "Warm Down", minutes: 4, color: "#d378ff" },
    ],
  },
};

const state = {
  active: "weekday",
};

const elements = {
  buttons: [...document.querySelectorAll(".schedule-button")],
  segmentArcs: document.getElementById("segmentArcs"),
  segmentLabel: document.getElementById("segmentLabel"),
  segmentTimeLeft: document.getElementById("segmentTimeLeft"),
  classMeta: document.getElementById("classMeta"),
  currentTime: document.getElementById("currentTime"),
  classStart: document.getElementById("classStartTime"),
  classEnd: document.getElementById("classEndTime"),
  timelineList: document.getElementById("timelineList"),
  coachNotes: document.getElementById("coachNotes"),
};

function decimalHoursToDate(baseDate, decimalHours) {
  const d = new Date(baseDate);
  const hour = Math.floor(decimalHours);
  const minutes = Math.round((decimalHours - hour) * 60);
  d.setHours(hour, minutes, 0, 0);
  return d;
}

function formatTime(date) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false });
}

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function buildClassWindows(schedule, now) {
  const durations = schedule.segments.reduce((sum, s) => sum + s.minutes, 0);
  const windows = [];

  if (schedule.classStarts) {
    schedule.classStarts.forEach((time) => {
      const start = decimalHoursToDate(now, time);
      const end = new Date(start.getTime() + durations * 60000);
      windows.push({ start, end });
    });
  } else {
    const firstStart = new Date(now);
    firstStart.setHours(schedule.startHour, 0, 0, 0);
    for (let i = 0; i < schedule.classes; i += 1) {
      const start = new Date(firstStart.getTime() + i * durations * 60000);
      const end = new Date(start.getTime() + durations * 60000);
      windows.push({ start, end });
    }
  }

  return windows;
}

function getCurrentPosition(schedule, windows, now) {
  const classIndex = windows.findIndex((window) => now >= window.start && now < window.end);

  if (classIndex === -1) {
    return { classIndex: 0, segmentIndex: 0, timeLeft: schedule.segments[0].minutes * 60, status: "outside" };
  }

  const classWindow = windows[classIndex];
  const elapsedSeconds = Math.floor((now - classWindow.start) / 1000);
  let walk = 0;

  for (let i = 0; i < schedule.segments.length; i += 1) {
    const segmentSeconds = schedule.segments[i].minutes * 60;
    if (elapsedSeconds < walk + segmentSeconds) {
      return {
        classIndex,
        segmentIndex: i,
        timeLeft: walk + segmentSeconds - elapsedSeconds,
        status: "active",
      };
    }
    walk += segmentSeconds;
  }

  return { classIndex, segmentIndex: schedule.segments.length - 1, timeLeft: 0, status: "active" };
}

function buildArcs(schedule, activeSegmentIndex, segmentProgress) {
  const cx = 160;
  const cy = 160;
  const r = 128;
  const total = schedule.segments.reduce((sum, seg) => sum + seg.minutes, 0);

  let startAngle = -Math.PI / 2;
  const arcs = schedule.segments
    .map((segment, index) => {
      const angle = (segment.minutes / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      const x1 = cx + r * Math.cos(startAngle);
      const y1 = cy + r * Math.sin(startAngle);
      const x2 = cx + r * Math.cos(endAngle);
      const y2 = cy + r * Math.sin(endAngle);
      const largeArcFlag = angle > Math.PI ? 1 : 0;
      const progressOpacity = index === activeSegmentIndex ? 0.95 : 0.35;
      const dash = index === activeSegmentIndex ? `${Math.max(5, segmentProgress * 810)} 1000` : "none";
      const path = `<path class="segment-arc" d="M ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2}" stroke="${segment.color}" opacity="${progressOpacity}" stroke-dasharray="${dash}" />`;

      startAngle = endAngle;
      return path;
    })
    .join("");

  elements.segmentArcs.innerHTML = arcs;
}

function renderTimeline(schedule, windows) {
  const entries = [];

  windows.forEach((window, i) => {
    let marker = new Date(window.start);
    schedule.segments.forEach((segment) => {
      const end = new Date(marker.getTime() + segment.minutes * 60000);
      entries.push(
        `<li><strong>Class ${i + 1} ${segment.name}:</strong> ${formatTime(marker)} - ${formatTime(end)}</li>`,
      );
      marker = end;
    });
  });

  elements.timelineList.innerHTML = entries.join("");
}

function tick() {
  const schedule = schedules[state.active];
  const now = new Date();
  const windows = buildClassWindows(schedule, now);
  const position = getCurrentPosition(schedule, windows, now);
  const currentWindow = windows[position.classIndex];
  const currentSegment = schedule.segments[position.segmentIndex];

  elements.currentTime.textContent = formatTime(now);
  elements.classStart.textContent = formatTime(currentWindow.start);
  elements.classEnd.textContent = formatTime(currentWindow.end);

  elements.segmentLabel.textContent =
    position.status === "outside" ? "Waiting to Start" : currentSegment.name;
  elements.segmentTimeLeft.textContent =
    position.status === "outside"
      ? `Starts ${formatCountdown(Math.floor((currentWindow.start - now) / 1000))}`
      : formatCountdown(position.timeLeft);
  elements.classMeta.textContent = `Class ${position.classIndex + 1} • ${schedule.label}`;

  const segDuration = currentSegment.minutes * 60;
  const segProgress = position.status === "outside" ? 0 : 1 - position.timeLeft / segDuration;
  buildArcs(schedule, position.segmentIndex, segProgress);

  renderTimeline(schedule, windows);
}

function setSchedule(scheduleKey) {
  state.active = scheduleKey;
  elements.buttons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.schedule === scheduleKey);
  });
  tick();
}

function initNotes() {
  const key = "gym-coach-notes";
  elements.coachNotes.value = localStorage.getItem(key) || "";
  elements.coachNotes.addEventListener("input", () => {
    localStorage.setItem(key, elements.coachNotes.value);
  });
}

elements.buttons.forEach((btn) => {
  btn.addEventListener("click", () => setSchedule(btn.dataset.schedule));
});

initNotes();
setSchedule("weekday");
setInterval(tick, 1000);
