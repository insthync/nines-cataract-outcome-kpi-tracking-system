// Pure calculations: missing values never enter a denominator.
(function(root) {
  const definitions = [
    ["va_outcome", "VA 1 เดือน >6/12", "pass"], ["endophthalmitis", "Endophthalmitis", "yes"],
    ["wound_leak", "Wound leak", "yes"], ["reoperation", "Re-operation", "yes"],
    ["biometry", "Biometry ±0.50D", "pass"], ["refractive", "Refractive ±1.0D", "pass"]
  ];
  function kpis(cases, targets = []) {
    const live = cases.filter(c => !c.archived);
    const custom = targets.filter(t => !definitions.some(d => d[0] === t.key));
    const metrics = [...definitions.map(([key, label, positive]) => ({key, label, source:key, positive})), ...custom.map(t => ({key:t.key, label:t.label, source:t.source, positive:definitions.find(d=>d[0]===t.source)?.[2]}))];
    return metrics.map(({key, label, source, positive}) => {
      const assessed = positive ? live.filter(c => [positive, positive === "pass" ? "fail" : "no"].includes(c[source])) : [];
      const numerator = assessed.filter(c => c[source] === positive).length, denominator = assessed.length;
      const value = denominator ? numerator / denominator * 100 : null;
      const target = targets.find(t => t.key === key);
      const enough = denominator >= (target?.min_sample || 1);
      const status = !denominator || !enough ? "insufficient" : !target?.enabled ? "unconfigured" : (target.direction === "gte" ? value >= target.target : value <= target.target) ? "pass" : "fail";
      return { key, label, numerator, denominator, missing: live.length - denominator, value, target, status };
    });
  }
  function period(cases, month, mode = "monthly") {
    const [year, m] = month.split("-").map(Number);
    return cases.filter(c => {
      if (c.archived) return false;
      const [y, n] = c.surgery_date.split("-").map(Number);
      if (mode === "quarterly") return y === year && Math.floor((n - 1) / 3) === Math.floor((m - 1) / 3);
      if (mode === "ytd") return y === year && n <= m;
      if (mode === "year") return y === year;
      return y === year && n === m;
    });
  }
  function alerts(cases, today) {
    const result = [];
    cases.filter(c => !c.archived).forEach(c => {
      const add = (level, text) => result.push({ caseId: c.id, level, text });
      if (c.endophthalmitis === "yes") add("critical", "พบ Endophthalmitis — ทบทวนเหตุการณ์");
      if (c.reoperation === "yes") add("high", "มีการผ่าตัดซ้ำ");
      if (c.wound_leak === "yes") add("high", "พบ Wound leak");
      if (c.va_outcome === "fail") add("monitor", "VA 1 เดือนไม่ผ่านเกณฑ์ที่บันทึก");
      const age = Math.floor((Date.parse(today) - Date.parse(c.surgery_date)) / 86400000);
      [["day1", 1, "Day 1"], ["week1", 7, "1 สัปดาห์"], ["month1", 30, "1 เดือน"]].forEach(([p, days, label]) => { if (age >= days && !c[p + "_va"]) add("monitor", `ยังไม่มีผลติดตาม ${label}`); });
    });
    return result.sort((a,b) => ["critical","high","monitor"].indexOf(a.level) - ["critical","high","monitor"].indexOf(b.level));
  }
  const api = { definitions, kpis, period, alerts };
  if (typeof module !== "undefined") module.exports = api;
  else root.Clinical = api;
})(typeof window === "undefined" ? globalThis : window);
