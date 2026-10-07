import { useState } from 'react';
import { useStore } from '../data/store';
import { thisMonth, today } from '../lib/dates';
import { digitsOnly } from '../lib/format';
import type { Condition, Item } from '../lib/types';
import { GroupSelect } from './GroupSelect';

interface Props {
  item: Item;
  onCancel(): void;
  onSaved(): void;
}

/** Edit mode of the detail sheet. Fields depend on for-sale vs sold. */
export function EditItemForm({ item, onCancel, onSaved }: Props) {
  const { updateItem, conditions, conditionLabel } = useStore();
  const sold = item.status === 'sold';
  const [title, setTitle] = useState(item.title);
  const [groupId, setGroupId] = useState(item.groupId);
  const [condition, setCondition] = useState<Condition | null>(item.condition);
  const [price, setPrice] = useState(String((sold ? item.priceSold : item.priceListed) ?? ''));
  // Backfilled sales were entered by month only (stored as the 1st), so they
  // get a month picker; everything else has a real date.
  const [dateSold, setDateSold] = useState(item.isBackfill ? (item.dateSold ?? '').slice(0, 7) : (item.dateSold ?? ''));
  const [description, setDescription] = useState(item.description);
  const [saving, setSaving] = useState(false);

  const dateOk = !sold || (item.isBackfill ? /^\d{4}-\d{2}$/ : /^\d{4}-\d{2}-\d{2}$/).test(dateSold);
  const canSave = title.trim() !== '' && price !== '' && dateOk && !saving;

  const save = async () => {
    if (!canSave) return;
    setSaving(true);
    const amount = Number(price);
    try {
      await updateItem({
        ...item,
        title: title.trim(),
        groupId,
        condition,
        description: description.trim(),
        ...(sold
          ? { priceSold: amount, dateSold: item.isBackfill ? `${dateSold}-01` : dateSold }
          : { priceListed: amount }),
      });
      onSaved();
    } catch {
      setSaving(false);
      window.alert("Couldn't save the changes. Try again.");
    }
  };

  return (
    <form
      className="edit-form"
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <label className="field">
        <span className="label">Title</span>
        <textarea className="edit-title" rows={2} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>

      <div className="grid2">
        <label className="field">
          <span className="label">{sold ? 'Sold for, kr' : 'Asking, kr'}</span>
          <input
            className="line-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={price}
            onChange={(e) => setPrice(digitsOnly(e.target.value))}
          />
        </label>
        <div className="field">
          <span className="label">Group</span>
          <GroupSelect value={groupId} onChange={setGroupId} />
        </div>
        <label className="field">
          <span className="label">Condition</span>
          <select
            className="line-select"
            value={condition ?? ''}
            onChange={(e) => setCondition(e.target.value || null)}
          >
            <option value="">—</option>
            {conditions.map((c) => (
              <option key={c.code} value={c.code}>
                {conditionLabel(c.code)}
              </option>
            ))}
          </select>
        </label>
        {sold && (
          <label className="field">
            <span className="label">{item.isBackfill ? 'Sold (month)' : 'Sale date'}</span>
            <input
              className="line-input"
              type={item.isBackfill ? 'month' : 'date'}
              value={dateSold}
              min={item.isBackfill ? undefined : (item.dateListed ?? undefined)}
              max={item.isBackfill ? thisMonth() : today()}
              onChange={(e) => setDateSold(e.target.value)}
            />
          </label>
        )}
      </div>

      <label className="field">
        <span className="label">Description</span>
        <textarea
          className="edit-desc"
          rows={5}
          placeholder="Add a description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <div className="edit-actions">
        <button type="submit" className="sheet-sell" disabled={!canSave}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
        <button type="button" className="edit-cancel" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
