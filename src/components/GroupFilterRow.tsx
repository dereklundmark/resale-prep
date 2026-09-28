import { useStore } from '../data/store';
import { sameFilter } from '../lib/stats';
import type { GroupFilter } from '../lib/types';

interface Props {
  value: GroupFilter;
  onChange(f: GroupFilter): void;
  className?: string;
}

export function GroupFilterRow({ value, onChange, className }: Props) {
  const { groups } = useStore();
  const options: { label: string; filter: GroupFilter }[] = [
    { label: 'All', filter: 'all' },
    ...groups.map((g) => ({ label: g.name, filter: { groupId: g.id } })),
    { label: 'Ungrouped', filter: 'ungrouped' },
  ];
  return (
    <div className={`filters ${className ?? ''}`}>
      {options.map((o) => (
        <button
          key={o.label + (typeof o.filter === 'string' ? '' : o.filter.groupId)}
          type="button"
          className={sameFilter(value, o.filter) ? 'on' : ''}
          onClick={() => onChange(o.filter)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
