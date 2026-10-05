export function summarizeTasks(widgets) {
  const tasks = widgets.filter((widget) => widget.type === "todo").flatMap((widget) => widget.tasks);
  const total = tasks.length;
  const done = tasks.filter((task) => task.done).length;
  return { total, done, remaining: total - done, percent: total ? Math.round(done / total * 100) : 0 };
}
