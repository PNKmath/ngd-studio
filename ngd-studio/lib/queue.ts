// Simple in-memory job queue for sequential execution
// Only one job runs at a time; others wait in queue

type QueuedJob = {
  id: string;
  execute: () => Promise<void>;
};

let queue: QueuedJob[] = [];
let running: string | null = null;
const listeners: Set<() => void> = new Set();

export function getQueueStatus() {
  return {
    running,
    queued: queue.map((j) => j.id),
    queueLength: queue.length,
  };
}

export function onQueueChange(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  listeners.forEach((l) => l());
}

export async function enqueue(id: string, execute: () => Promise<void>) {
  queue.push({ id, execute });
  notify();

  if (!running) {
    processNext();
  }
}

export function cancelQueued(id: string) {
  queue = queue.filter((j) => j.id !== id);
  notify();
}

async function processNext() {
  if (running || queue.length === 0) return;

  const job = queue.shift()!;
  running = job.id;
  notify();

  try {
    await job.execute();
  } catch {
    // error handled by the execute function itself
  } finally {
    running = null;
    notify();
    processNext();
  }
}
