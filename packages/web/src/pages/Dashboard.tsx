import { useEffect, useState } from 'react';
import { api, type Item } from '../api/client';

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.items.list().then(({ data }) => {
      if (data) setItems(data.items);
      setLoading(false);
    });
  }, []);

  const todo = items.filter(i => i.status === 'todo').length;
  const doing = items.filter(i => i.status === 'doing').length;
  const done = items.filter(i => i.status === 'done').length;

  if (loading) {
    return <div className="p-8 text-accent animate-pulse">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Dashboard</h1>
        <p className="text-text-muted text-sm mt-1">Overview of your items</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="border border-border bg-surface-card p-6 rounded">
          <p className="text-xs font-mono text-text-muted uppercase mb-1">To Do</p>
          <p className="text-3xl font-semibold text-text-primary">{todo}</p>
        </div>
        <div className="border border-border bg-surface-card p-6 rounded">
          <p className="text-xs font-mono text-text-muted uppercase mb-1">In Progress</p>
          <p className="text-3xl font-semibold text-accent">{doing}</p>
        </div>
        <div className="border border-border bg-surface-card p-6 rounded">
          <p className="text-xs font-mono text-text-muted uppercase mb-1">Done</p>
          <p className="text-3xl font-semibold text-green-400">{done}</p>
        </div>
      </div>

      <div className="border border-border bg-surface-card p-6 rounded">
        <p className="text-xs font-mono text-text-muted uppercase mb-3">Recent Items</p>
        {items.length === 0 ? (
          <p className="text-text-muted text-sm">No items yet. Create one from the Items page.</p>
        ) : (
          <div className="space-y-2">
            {items.slice(0, 5).map(item => (
              <div key={item.id} className="flex items-center justify-between py-2 border-b border-border/50 last:border-0">
                <span className="text-sm text-text-primary">{item.title}</span>
                <span className={`text-xs font-mono px-2 py-0.5 rounded ${
                  item.status === 'done' ? 'bg-green-400/10 text-green-400' :
                  item.status === 'doing' ? 'bg-accent/10 text-accent' :
                  'bg-surface-tertiary text-text-muted'
                }`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
