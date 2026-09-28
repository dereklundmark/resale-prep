import { useState } from 'react';
import { useStore } from '../data/store';

const NONE = '';
const NEW = '__new__';

interface Props {
  value: string | null;
  onChange(groupId: string | null): void;
  dark?: boolean;
}

/** Native select of None / groups / "+ New group…"; the last swaps in a text field. */
export function GroupSelect({ value, onChange, dark }: Props) {
  const { groups, addGroup } = useStore();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const create = async () => {
    if (!name.trim()) return;
    const g = await addGroup(name);
    onChange(g.id);
    setCreating(false);
    setName('');
  };

  if (creating) {
    return (
      <div className="new-group">
        <input
          className="line-input"
          autoFocus
          value={name}
          placeholder="Group name"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void create();
            if (e.key === 'Escape') setCreating(false);
          }}
        />
        <button type="button" className="mini-btn" onClick={() => void create()}>
          OK
        </button>
        <button type="button" className="mini-btn" aria-label="Cancel" onClick={() => setCreating(false)}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <select
      className={dark ? 'dark-select' : 'line-select'}
      value={value ?? NONE}
      onChange={(e) => {
        if (e.target.value === NEW) setCreating(true);
        else onChange(e.target.value || null);
      }}
    >
      <option value={NONE}>None</option>
      {groups.map((g) => (
        <option key={g.id} value={g.id}>
          {g.name}
        </option>
      ))}
      <option value={NEW}>+ New group…</option>
    </select>
  );
}
