/* =============================================================
   prophecy.js —— 预言模式：七日条件推演 / 长期功绩史卷
   Interface: window.App.prophecy.open(container, { onExit })
   ============================================================= */
(function () {
  "use strict";

  var App = window.App;
  var data = App.data;
  var store = App.store;
  var ui = App.ui;
  var WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

  function esc(value) {
    return ui && ui.esc ? ui.esc(String(value == null ? "" : value)) : String(value == null ? "" : value);
  }

  function asNumber(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : 0;
  }

  function dateKey(date) {
    var y = date.getFullYear();
    var m = String(date.getMonth() + 1).padStart(2, "0");
    var d = String(date.getDate()).padStart(2, "0");
    return y + "-" + m + "-" + d;
  }

  function formatMonthDay(date) {
    return (date.getMonth() + 1) + "月" + date.getDate() + "日";
  }

  function parseDeadlineDayIndex(value, today) {
    if (!value) return -1;
    var parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return -1;
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    var target = new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    var delta = Math.round((target.getTime() - start.getTime()) / 86400000);
    return delta >= 0 && delta <= 6 ? delta : -1;
  }

  function economyFor(task) {
    if (task && task.gold != null && task.energy != null && task.restore != null) {
      return {
        durationMinutes: Math.max(5, asNumber(task.durationMinutes) || 30),
        energy: Math.max(0, asNumber(task.energy)),
        gold: Math.max(0, asNumber(task.gold)),
        restore: Math.max(0, asNumber(task.restore)),
        energyTier: task.energyTier || ""
      };
    }
    return App.economy.calculate(task || {}, task && task.cat);
  }

  function outcomeFor(task) {
    if (task.outcome) return task.outcome;
    if (task.cat === "mystic" || task.restore) return "为后续任务保留恢复空间";
    if (task.cat === "explore") return "可能形成新的协作或求教路径";
    if (task.cat === "main") return "更接近一次可验收的关键交付";
    if (task.cat === "delay") return "减少事项继续悬置带来的心智负担";
    return "减少返工、遗漏或临近截止时的赶工";
  }

  function conflictFor(task, values) {
    if (task.conflict) return task.conflict;
    if (values.energy >= 30) return "属于高精力任务，需要预留完整时间块";
    if (values.energy >= 20) return "会占用一段连续注意力";
    if (task.cat === "explore") return "可能与高强度交付争夺社交精力";
    return "当前没有记录依赖关系，仍可能与其他任务相撞";
  }

  function normalizeTask(task, index, isDemo) {
    var values = economyFor(task);
    return {
      id: String(task.id || ("prophecy-task-" + index)),
      title: String(task.title || "未命名任务"),
      cat: String(task.cat || "daily"),
      durationMinutes: values.durationMinutes,
      energy: values.energy,
      gold: values.gold,
      restore: values.restore,
      energyTier: values.energyTier,
      deadline: task.deadline || task.deadlineAt || null,
      deadlineText: String(task.deadlineText || task.deadlineLabel || (isDemo ? "本周内" : "尚未记录截止时间")),
      outcome: String(outcomeFor(task)),
      conflict: String(conflictFor(task, values)),
      tags: Array.isArray(task.tags) ? task.tags.slice() : [],
      sourceKind: String(task.sourceKind || (isDemo ? "prophecy-demo" : "")),
      isDemo: !!isDemo
    };
  }

  function futureDays(today) {
    var days = [];
    for (var i = 0; i < 7; i++) {
      var date = new Date(today);
      date.setDate(today.getDate() + i);
      days.push({
        index: i,
        key: dateKey(date),
        date: date,
        weekday: date.getDay(),
        weekdayLabel: i === 0 ? "今日" : WEEKDAYS[date.getDay()],
        dateLabel: formatMonthDay(date),
        tasks: []
      });
    }
    return days;
  }

  function realTaskDayIndex(task, index, today) {
    var deadlineIndex = parseDeadlineDayIndex(task.deadline, today);
    if (deadlineIndex >= 0) return deadlineIndex;
    return Math.min(index, 6);
  }

  function demoTaskDayIndex(task, days, index) {
    for (var i = 0; i < days.length; i++) {
      if (days[i].weekday === Number(task.weekday)) return i;
    }
    return Math.min(index, 6);
  }

  function aggregateDay(day) {
    var tasks = day.tasks;
    var energy = tasks.reduce(function (sum, task) { return sum + task.energy; }, 0);
    var gold = tasks.reduce(function (sum, task) { return sum + task.gold; }, 0);
    var restore = tasks.reduce(function (sum, task) { return sum + task.restore; }, 0);
    var duration = tasks.reduce(function (sum, task) { return sum + task.durationMinutes; }, 0);
    var isRisk = tasks.length > 1 || energy >= 30;
    var primary = tasks[0] || null;
    return Object.assign(day, {
      energy: energy,
      gold: gold,
      restore: restore,
      durationMinutes: duration,
      isRisk: isRisk,
      primary: primary,
      title: !primary ? "暂无安排" : tasks.map(function (task) { return task.title; }).join("、"),
      additionalTitles: tasks.slice(1).map(function (task) { return task.title; }),
      outcome: !primary ? "给临时事项留出缓冲" : tasks.map(function (task) { return task.outcome; }).join("；"),
      deadlineText: !primary ? "—" : (tasks.length === 1 ? primary.deadlineText : "按当前顺序推演"),
      conflict: !primary ? "无已知冲突" : (tasks.length > 1 ? "同日有 " + tasks.length + " 项任务争夺时间与精力" : primary.conflict),
      cat: primary ? primary.cat : "",
      isRecovery: tasks.length === 1 && primary && (primary.cat === "mystic" || primary.restore > 0)
    });
  }

  function completedTitles(state) {
    var titles = (state.mapTasks || []).filter(function (task) {
      return !!task.done && !/^demo(?:-|$)/.test(String(task.sourceKind || ""));
    }).map(function (task) {
      return String(task.title || "");
    }).filter(Boolean);
    return titles.slice(-3);
  }

  function evidenceFor(model, key) {
    var pending = model.tasks;
    var completed = model.completedTitles;
    var pool = pending.concat(completed.map(function (title, index) {
      return { title: title, cat: "", tags: [], completedEvidence: true, id: "completed-" + index };
    }));
    var matcher = {
      relations: function (task) { return task.cat === "explore" || /mentor|咖啡|前辈|同事|协作|求教/i.test(task.title); },
      money: function (task) { return asNumber(task.gold) > 0 || task.completedEvidence; },
      mainline: function (task) { return task.cat === "main" || /答辩|交付|项目|优先级/.test(task.title); },
      reputation: function (task) { return task.cat === "main" || task.cat === "daily" || /周报|同步|汇报|口径/.test(task.title); },
      energy: function (task) { return task.cat === "mystic" || asNumber(task.restore) > 0 || asNumber(task.energy) >= 20; }
    }[key];
    var labels = pool.filter(matcher).slice(0, 3).map(function (task) { return task.title; });
    if (!labels.length) labels = pending.slice(0, 2).map(function (task) { return task.title; });
    return labels;
  }

  function buildChronicles(model) {
    var sourceNote = model.isDemo ? "当前依据是演示样本，不能当作你的真实经历。" : "当前仅依据任务和完成记录，不替同事或上级作评价。";
    var definitions = {
      relations: {
        label: "人际关系",
        title: "《纳谏成章》",
        text: "若继续主动识别 mentor、同组前辈和关键协作者，长期积累不会表现为一个关系分数，而会表现为：遇事知道问谁、如何问、何时同步风险。协作路径正在形成，但关系质量仍要由后续真实互动确认。",
        unknown: "目前没有真实协作反馈、关系强度与后续帮助记录。" + sourceNote
      },
      money: {
        label: "金钱积累",
        title: "《细流入库》",
        text: "金币来自一张张完成并结算的任务。若关键交付和日常收口都能保持稳定，金库会缓慢增厚；一旦高消耗任务反复延期，预计金币也会随未完成卡片一同停在账外。",
        unknown: "金币只代表产品内结算，并非真实薪酬；目前也没有实际投入与回报比数据。" + sourceNote
      },
      mainline: {
        label: "主线进度",
        title: "《初立朝纲》",
        text: "主线功绩来自关键任务被定义、推进并交出可验收结果。长期关键不是完成所有杂事，而是让真正重要的任务拥有清楚标准、足够精力和可见结果。",
        unknown: "尚未记录任务依赖、上级反馈和真实验收结果，因此不能判断业务影响。" + sourceNote
      },
      reputation: {
        label: "职场声誉",
        title: "《信诺渐成》",
        text: "职场声誉不需要虚构成分数，它会通过准时收口、清晰提问和提前暴露风险留下可观察信号。若这些行为持续出现，可靠交付的印象才可能逐步形成。",
        unknown: "尚无经理和同事的真实反馈；这里只推演可被观察的行为，不预测他人的评价。" + sourceNote
      },
      energy: {
        label: "可持续精力",
        title: "《灯火有度》",
        text: "主动保留恢复空间，是保全判断力而非放弃进度。长期看，它不会立刻带来高金币，却可能减少连续透支，让重要任务更少被低电量状态拖垮。",
        unknown: "当前没有睡眠、实际工时和个人恢复效率，因此不提供精确耗竭概率。" + sourceNote
      }
    };
    Object.keys(definitions).forEach(function (key) {
      definitions[key].evidence = evidenceFor(model, key);
    });
    return definitions;
  }

  function buildConflicts(model, state) {
    var conflicts = [];
    var riskDays = model.days.filter(function (day) { return day.isRisk; });
    riskDays.slice(0, 2).forEach(function (day) {
      conflicts.push(day.weekdayLabel + "预计消耗 " + day.energy + " 点精力" +
        (day.tasks.length > 1 ? "，还有 " + day.tasks.length + " 项任务同日收口。" : "，属于本周高消耗日。"));
    });
    var socialIndex = -10;
    var heavyIndex = -10;
    model.days.forEach(function (day, index) {
      if (day.tasks.some(function (task) { return task.cat === "explore" || /mentor|咖啡|前辈/.test(task.title); })) socialIndex = index;
      if (day.energy >= 30) heavyIndex = index;
    });
    if (Math.abs(socialIndex - heavyIndex) <= 1) conflicts.push("求教或社交安排靠近高消耗任务，可能争夺同一段精力。");
    if (model.energySpend > asNumber(state.energy)) conflicts.push("预计消耗超过当前精力，若全部照原样推进，至少需要一次恢复或调整。");
    if (!model.energyRestore) conflicts.push("未来七日没有明确恢复任务，连续推进时缺少缓冲。");
    if (!model.isDemo && model.missingDeadlineCount) conflicts.push("有 " + model.missingDeadlineCount + " 项任务未记录截止时间，当前星期排布只是推断。");
    return conflicts.slice(0, 3);
  }

  function buildModel(state, options) {
    options = options || {};
    var today = options.today ? new Date(options.today) : new Date();
    var pending = (state.mapTasks || []).filter(function (task) {
      return !task.done && !task.expired && !/^demo(?:-|$)/.test(String(task.sourceKind || ""));
    });
    var isDemo = pending.length === 0;
    var rawTasks = isDemo ? (data.PROPHECY_DEMO_TASKS || []) : pending;
    var tasks = rawTasks.map(function (task, index) { return normalizeTask(task, index, isDemo); });
    var days = futureDays(today);
    var missingDeadlineCount = 0;

    tasks.forEach(function (task, index) {
      var dayIndex;
      if (isDemo) {
        dayIndex = demoTaskDayIndex(rawTasks[index], days, index);
      } else {
        dayIndex = realTaskDayIndex(task, index, today);
        if (!task.deadline) missingDeadlineCount++;
      }
      days[dayIndex].tasks.push(task);
    });
    days = days.map(aggregateDay);

    var model = {
      sourceKey: isDemo ? "newcomer-demo-week" : "pending-tasks:" + tasks.map(function (task) { return task.id; }).join("|"),
      sourceLabel: isDemo ? "演示样本" : "真实任务",
      sourceDetail: isDemo ? "新入职 · 第一周" : "当前未完成任务",
      isDemo: isDemo,
      confidence: isDemo ? "中" : (missingDeadlineCount ? "低" : "中"),
      tasks: tasks,
      days: days,
      taskCount: tasks.length,
      goldGain: tasks.reduce(function (sum, task) { return sum + task.gold; }, 0),
      energySpend: tasks.reduce(function (sum, task) { return sum + task.energy; }, 0),
      energyRestore: tasks.reduce(function (sum, task) { return sum + task.restore; }, 0),
      riskDayCount: days.filter(function (day) { return day.isRisk; }).length,
      missingDeadlineCount: missingDeadlineCount,
      completedTitles: completedTitles(state)
    };
    model.conflicts = buildConflicts(model, state);
    model.chronicles = buildChronicles(model);
    return model;
  }

  function categoryLabel(category) {
    return data.CATEGORIES[category] ? data.CATEGORIES[category].label : "日常";
  }

  function dayCard(day) {
    if (!day.primary) {
      return '<div class="prophecy-day empty">' +
        '<div class="prophecy-day-head"><strong>' + esc(day.weekdayLabel) + '</strong><span>' + esc(day.dateLabel) + '</span></div>' +
        '<span class="prophecy-day-dot"></span><div class="prophecy-day-empty">留作缓冲</div></div>';
    }
    var classes = "prophecy-day-card";
    if (day.isRisk) classes += " conflict";
    if (day.isRecovery) classes += " recovery";
    return '<div class="prophecy-day' + (day.isRisk ? " risky" : "") + '">' +
      '<div class="prophecy-day-head"><strong>' + esc(day.weekdayLabel) + '</strong><span>' + esc(day.dateLabel) + '</span></div>' +
      '<span class="prophecy-day-dot"></span>' +
      '<button class="' + classes + '" type="button" data-prophecy-day="' + day.index + '">' +
        '<span class="prophecy-task-type ' + esc(day.cat) + '">' + esc(day.isRisk ? "高压日" : categoryLabel(day.cat)) + '</span>' +
        '<h3>' + esc(day.primary.title) + '</h3>' +
        (day.additionalTitles.length ? '<span class="prophecy-more-task">＋ ' + esc(day.additionalTitles.join("；")) + '</span>' : '') +
        '<span class="prophecy-task-outcome">' + esc(day.outcome) + '</span>' +
        '<span class="prophecy-task-meta"><span>' + day.durationMinutes + ' 分钟</span><span>' +
          (day.tasks.length > 1 ? day.tasks.length + " 项" : "待完成") + '</span></span>' +
      '</button></div>';
  }

  function renderConflicts(model) {
    if (!model.conflicts.length) return '<div class="prophecy-conflict-item calm">当前任务之间没有发现明显的时间或精力冲突。</div>';
    return model.conflicts.map(function (text) {
      return '<div class="prophecy-conflict-item">' + esc(text) + '</div>';
    }).join("");
  }

  function renderChronicleEvidence(item) {
    if (!item.evidence.length) {
      return '<div class="prophecy-evidence"><i>据</i><div><strong>依据尚浅</strong><span>完成更多真实任务后，这里会出现可追溯依据。</span></div></div>';
    }
    return item.evidence.map(function (title, index) {
      var marks = ["一", "二", "三"];
      return '<div class="prophecy-evidence"><i>' + marks[index] + '</i><div><strong>' + esc(title) + '</strong>' +
        '<span>来自当前任务或已完成记录</span></div></div>';
    }).join("");
  }

  function render(model) {
    var firstDay = model.days.filter(function (day) { return day.primary; })[0] || model.days[0];
    var defaultChronicle = model.chronicles.relations;
    return '<div class="prophecy-v2">' +
      '<button class="prophecy-close" id="prophExit" type="button" aria-label="退出预言">×</button>' +
      '<header class="prophecy-v2-head">' +
        '<div class="prophecy-source"><span>' + esc(model.sourceLabel) + '</span><small>' + esc(model.sourceDetail) + '</small></div>' +
        '<div class="prophecy-title"><small>钦 天 监 · 观 星 录</small><h2>预 言 天 机</h2><p>依据未竟之事，推演条件成立后的可能走向</p></div>' +
        '<div class="prophecy-confidence">当前依据：' + model.taskCount + ' 张任务<strong>置信度 · ' + esc(model.confidence) + '</strong></div>' +
      '</header>' +
      '<nav class="prophecy-tabs" role="tablist" aria-label="预言内容">' +
        '<button class="active" type="button" role="tab" aria-selected="true" data-prophecy-view="weekly">未来七天天象</button>' +
        '<button type="button" role="tab" aria-selected="false" data-prophecy-view="chronicle">功绩史卷</button>' +
      '</nav>' +

      '<section class="prophecy-panel active" data-prophecy-panel="weekly">' +
        '<div class="prophecy-week-layout">' +
          '<div class="prophecy-sky-sheet prophecy-glass">' +
            '<header class="prophecy-week-summary">' +
              '<h3>' + (model.isDemo ? "若案上之事尽数收口，本周可能形成一段“可靠交付”的开局。" :
                "以下是当前未完成任务在七日内的条件推演；没有截止时间的任务按现有顺序排布。") + '</h3>' +
              '<div><strong>' + model.taskCount + '</strong><span>未竟任务</span></div>' +
              '<div><strong>+' + model.goldGain + '</strong><span>预计金币</span></div>' +
              '<div><strong>' + model.riskDayCount + '</strong><span>高压日</span></div>' +
            '</header>' +
            '<div class="prophecy-timeline-wrap"><div class="prophecy-timeline">' +
              model.days.map(dayCard).join("") +
            '</div></div>' +
            '<div class="prophecy-reading" aria-live="polite">' +
              '<div class="prophecy-reading-main"><div class="prophecy-reading-kicker">做成推演 · 情景</div>' +
                '<h3 id="prophecyReadingTitle">完成“' + esc(firstDay.title) + '”</h3>' +
                '<p id="prophecyReadingText">' + esc(firstDay.outcome) + '。这是以任务按当前条件完成为前提的推演，不代表结果一定发生。</p></div>' +
              '<div class="prophecy-reading-cost"><div class="prophecy-reading-kicker">投入与冲突</div>' +
                '<div><span>预计投入</span><strong id="prophecyReadingEffort">' + firstDay.durationMinutes + ' 分钟 · 消耗 ' + firstDay.energy + ' 精力</strong></div>' +
                '<div><span>截止</span><strong id="prophecyReadingDeadline">' + esc(firstDay.deadlineText) + '</strong></div>' +
                '<div><span>主要冲突</span><strong id="prophecyReadingConflict">' + esc(firstDay.conflict) + '</strong></div>' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<aside class="prophecy-oracle-side">' +
            '<section class="prophecy-oracle prophecy-glass">' +
              '<h3>若全数做成，可能留下</h3><p>金币与精力按现有规则计算；其余只描述可观察迹象</p>' +
              '<div class="prophecy-outcomes">' +
                '<div class="numeric"><span>金币</span><strong>预计 +' + model.goldGain + '</strong></div>' +
                '<div class="numeric energy"><span>精力</span><strong>消耗 ' + model.energySpend +
                  (model.energyRestore ? ' · 恢复 ' + model.energyRestore : '') + '</strong></div>' +
                '<div class="people"><span>人际关系</span><strong>' +
                  (model.tasks.some(function (task) { return task.cat === "explore" || /mentor|咖啡|前辈|同事/.test(task.title); }) ?
                    "存在建立或维护求教路径的机会" : "当前任务没有提供明确的人际关系信号") + '</strong></div>' +
                '<div class="people"><span>职场声誉</span><strong>' +
                  (model.tasks.some(function (task) { return task.cat === "main" || task.cat === "daily"; }) ?
                    "按时收口可留下可靠交付的信号" : "当前任务不足以形成明确的交付信号") + '</strong></div>' +
                '<div><span>工作节奏</span><strong>' + (model.riskDayCount ? "有 " + model.riskDayCount + " 个明显承压点" : "目前未发现明显峰值") + '</strong></div>' +
              '</div>' +
            '</section>' +
            '<section class="prophecy-oracle prophecy-glass prophecy-conflicts">' +
              '<h3>星轨相冲</h3><p>需要留意的时间与精力挤压</p>' +
              '<div>' + renderConflicts(model) + '</div>' +
            '</section>' +
          '</aside>' +
        '</div>' +
        '<footer class="prophecy-facts">' +
          '<span class="fact">事实</span><small>任务名称与结算值来自' + (model.isDemo ? "演示样本" : "当前任务池") + '</small>' +
          '<span class="infer">推断</span><small>冲突由任务顺序与精力消耗推导</small>' +
          '<span class="scene">情景</span><small>所有结果都以“任务完成”为前提</small>' +
        '</footer>' +
      '</section>' +

      '<section class="prophecy-panel" data-prophecy-panel="chronicle">' +
        '<div class="prophecy-chronicle">' +
          '<nav class="prophecy-values" aria-label="选择长期方向">' +
            Object.keys(model.chronicles).map(function (key) {
              return '<button class="' + (key === "relations" ? "active" : "") + '" type="button" data-prophecy-value="' + key + '">' +
                esc(model.chronicles[key].label) + '</button>';
            }).join("") +
          '</nav>' +
          '<article class="prophecy-scroll-sheet">' +
            '<div class="prophecy-scroll-copy"><small>功绩史卷 · 初入新朝</small>' +
              '<h3 id="prophecyChronicleTitle">' + esc(defaultChronicle.title) + '</h3><i></i>' +
              '<p id="prophecyChronicleText">' + esc(defaultChronicle.text) + '</p></div>' +
            '<aside class="prophecy-scroll-notes"><h4>史官所据</h4>' +
              '<div id="prophecyEvidence">' + renderChronicleEvidence(defaultChronicle) + '</div>' +
              '<div class="prophecy-unknown"><h4>尚不可知</h4><p id="prophecyUnknown">' + esc(defaultChronicle.unknown) + '</p></div>' +
              '<div class="prophecy-confidence-mark">依据尚浅</div>' +
            '</aside>' +
          '</article>' +
        '</div>' +
        '<footer class="prophecy-facts">' +
          '<span class="fact">依据</span><small>任务池、完成记录与所选方向</small>' +
          '<span class="infer">推断</span><small>长期倾向，不是绩效或晋升预测</small>' +
          '<span class="scene">边界</span><small>互动增多后才会逐步更新</small>' +
        '</footer>' +
      '</section>' +
    '</div>';
  }

  function bind(container, model, options) {
    var exit = container.querySelector("#prophExit");
    if (exit) exit.onclick = function () {
      if (options && typeof options.onExit === "function") options.onExit();
    };

    Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-view]"), function (tab) {
      tab.addEventListener("click", function () {
        var view = tab.getAttribute("data-prophecy-view");
        Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-view]"), function (item) {
          var active = item === tab;
          item.classList.toggle("active", active);
          item.setAttribute("aria-selected", active ? "true" : "false");
        });
        Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-panel]"), function (panel) {
          panel.classList.toggle("active", panel.getAttribute("data-prophecy-panel") === view);
        });
      });
    });

    Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-day]"), function (button) {
      button.addEventListener("click", function () {
        var index = Number(button.getAttribute("data-prophecy-day"));
        var day = model.days[index];
        Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-day]"), function (item) {
          item.classList.toggle("active", item === button);
        });
        container.querySelector("#prophecyReadingTitle").textContent = "完成“" + day.title + "”";
        container.querySelector("#prophecyReadingText").textContent = day.outcome + "。这是以任务按当前条件完成为前提的推演，不代表结果一定发生。";
        container.querySelector("#prophecyReadingEffort").textContent = day.durationMinutes + " 分钟 · 消耗 " + day.energy + " 精力" +
          (day.restore ? " · 恢复 " + day.restore : "");
        container.querySelector("#prophecyReadingDeadline").textContent = day.deadlineText;
        container.querySelector("#prophecyReadingConflict").textContent = day.conflict;
      });
    });

    var firstDayButton = container.querySelector("[data-prophecy-day]");
    if (firstDayButton) firstDayButton.classList.add("active");

    Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-value]"), function (button) {
      button.addEventListener("click", function () {
        var key = button.getAttribute("data-prophecy-value");
        var item = model.chronicles[key];
        Array.prototype.forEach.call(container.querySelectorAll("[data-prophecy-value]"), function (candidate) {
          candidate.classList.toggle("active", candidate === button);
        });
        container.querySelector("#prophecyChronicleTitle").textContent = item.title;
        container.querySelector("#prophecyChronicleText").textContent = item.text;
        container.querySelector("#prophecyUnknown").textContent = item.unknown;
        container.querySelector("#prophecyEvidence").innerHTML = renderChronicleEvidence(item);
      });
    });
  }

  function open(container, options) {
    var state = store.get();
    var model = buildModel(state);
    container.style.backgroundImage = "url('" + data.ASSET_BASE + "场景/钦天监.png')";
    container.innerHTML = render(model);
    bind(container, model, options || {});
    return model;
  }

  function close(container) {
    if (container) container.innerHTML = "";
  }

  App.prophecy = {
    open: open,
    close: close,
    buildModel: buildModel
  };
})();
