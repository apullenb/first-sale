export interface TaskNode {
  id: string;
  prerequisites: readonly string[];
}

// Prerequisites first; otherwise keeps the given order. Throws on unknown ids or cycles.
export function orderTasks<T extends TaskNode>(tasks: readonly T[]): T[] {
  const byId = new Map(tasks.map((task) => [task.id, task]));
  if (byId.size !== tasks.length) throw new Error("Task ids must be unique");
  for (const task of tasks) {
    for (const prerequisite of task.prerequisites) {
      if (!byId.has(prerequisite)) {
        throw new Error(`Task "${task.id}" depends on unknown task "${prerequisite}"`);
      }
    }
  }

  const ordered: T[] = [];
  const placed = new Set<string>();
  while (ordered.length < tasks.length) {
    const next = tasks.find(
      (task) => !placed.has(task.id) && task.prerequisites.every((id) => placed.has(id)),
    );
    if (!next) {
      const stuck = tasks.filter((task) => !placed.has(task.id)).map((task) => task.id);
      throw new Error(`Tasks have circular prerequisites: ${stuck.join(", ")}`);
    }
    ordered.push(next);
    placed.add(next.id);
  }
  return ordered;
}
