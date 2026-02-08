import { useEffect, useState } from 'react';
import { api, type Item, type ItemStatus } from '../api/client';

const STATUS_OPTIONS: { value: ItemStatus; label: string }[] = [
  { value: 'todo', label: 'To Do' },
  { value: 'doing', label: 'In Progress' },
  { value: 'done', label: 'Done' },
];

const STATUS_COLORS: Record<ItemStatus, string> = {
  todo: 'bg-surface-tertiary text-text-muted',
  doing: 'bg-accent/10 text-accent',
  done: 'bg-green-400/10 text-green-400',
};

export default function Items() {
  const [items, setItems] = useState<Item[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ title: '', description: '', status: 'todo' as ItemStatus });
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(true);

  const fetchItems = async () => {
    const params = filter ? { status: filter } : undefined;
    const { data } = await api.items.list(params);
    if (data) setItems(data.items);
    setLoading(false);
  };

  useEffect(() => { fetchItems(); }, [filter]);

  const handleCreate = async () => {
    if (!formData.title) return;
    await api.items.create(formData);
    setFormData({ title: '', description: '', status: 'todo' });
    setShowForm(false);
    fetchItems();
  };

  const handleStatusChange = async (id: string, status: ItemStatus) => {
    await api.items.update(id, { status });
    fetchItems();
  };

  const handleDelete = async (id: string) => {
    await api.items.delete(id);
    fetchItems();
  };

  if (loading) {
    return <div className="p-8 text-accent animate-pulse">Loading...</div>;
  }

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Items</h1>
          <p className="text-text-muted text-sm mt-1">{items.length} items</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-accent text-white text-sm hover:bg-accent-light transition-colors rounded"
        >
          + New Item
        </button>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        <button
          onClick={() => setFilter('')}
          className={`text-xs px-3 py-1.5 rounded transition-colors ${
            !filter ? 'bg-accent text-white' : 'bg-surface-tertiary text-text-muted hover:text-text-secondary'
          }`}
        >
          All
        </button>
        {STATUS_OPTIONS.map(s => (
          <button
            key={s.value}
            onClick={() => setFilter(s.value)}
            className={`text-xs px-3 py-1.5 rounded transition-colors ${
              filter === s.value ? 'bg-accent text-white' : 'bg-surface-tertiary text-text-muted hover:text-text-secondary'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="border border-accent/30 bg-surface-card p-6 space-y-4 rounded">
          <input
            type="text"
            placeholder="Item title"
            value={formData.title}
            onChange={e => setFormData({ ...formData, title: e.target.value })}
            className="w-full bg-surface-tertiary border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent rounded"
            autoFocus
          />
          <textarea
            placeholder="Description (optional)"
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            className="w-full bg-surface-tertiary border border-border px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent h-20 rounded"
          />
          <div className="flex items-center gap-4">
            <select
              value={formData.status}
              onChange={e => setFormData({ ...formData, status: e.target.value as ItemStatus })}
              className="bg-surface-tertiary border border-border px-3 py-2 text-sm text-text-primary rounded"
            >
              {STATUS_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <div className="flex gap-2 ml-auto">
              <button onClick={handleCreate} className="px-4 py-2 bg-accent text-white text-sm hover:bg-accent-light rounded">
                Create
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 border border-border text-text-muted text-sm hover:text-text-primary rounded">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Items list */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-text-muted text-sm py-8 text-center">No items found. Create one to get started.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="border border-border bg-surface-card p-4 rounded flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary font-medium">{item.title}</p>
              {item.description && (
                <p className="text-xs text-text-muted mt-1">{item.description}</p>
              )}
              <p className="text-xs text-text-muted mt-2">
                {new Date(item.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <select
                value={item.status}
                onChange={e => handleStatusChange(item.id, e.target.value as ItemStatus)}
                className={`text-xs px-2 py-1 rounded border-0 ${STATUS_COLORS[item.status]}`}
              >
                {STATUS_OPTIONS.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                onClick={() => handleDelete(item.id)}
                className="text-xs text-text-muted hover:text-red-400 transition-colors px-2 py-1"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
