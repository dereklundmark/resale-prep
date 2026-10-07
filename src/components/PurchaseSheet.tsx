import { useEffect, useState } from 'react';
import { useStore } from '../data/store';
import { today } from '../lib/dates';
import { dayMonthYear, digitsOnly } from '../lib/format';
import { groupSummaries } from '../lib/stats';

interface Props {
  purchaseId: string;
  onClose(): void;
  onToast(msg: string): void;
}

/** Slim sheet for one purchase (design v3): view, edit, move to another group, delete. */
export function PurchaseSheet({ purchaseId, onClose, onToast }: Props) {
  const { items, groups, purchases, money, updatePurchase, deletePurchase } = useStore();
  const p = purchases.find((x) => x.id === purchaseId);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [title, setTitle] = useState(p?.title ?? '');
  const [amount, setAmount] = useState(p ? String(p.amount) : '');
  const [date, setDate] = useState(p?.date ?? today());
  const [groupId, setGroupId] = useState(p?.groupId ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!p) return null;

  const group = groups.find((g) => g.id === p.groupId);
  const fund = groupSummaries(items, groups, purchases).find((s) => s.groupId === p.groupId);
  const left = fund?.left ?? 0;
  const canSave = title.trim() !== '' && amount !== '' && /^\d{4}-\d{2}-\d{2}$/.test(date) && groupId !== '' && !busy;

  const startEdit = () => {
    setTitle(p.title);
    setAmount(String(p.amount));
    setDate(p.date);
    setGroupId(p.groupId);
    setConfirmDelete(false);
    setEditing(true);
  };

  const save = async () => {
    if (!canSave) return;
    setBusy(true);
    try {
      await updatePurchase({ ...p, title: title.trim(), amount: Number(amount), date, groupId });
      setEditing(false);
      onToast('Saved');
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Saving failed');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirmDelete) return setConfirmDelete(true);
    await deletePurchase(p.id);
    onClose();
    onToast('Deleted');
  };

  return (
    <div className="sheet-wrap" role="dialog" aria-modal="true" aria-label={p.title}>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet purchase-sheet">
        <div className="purchase-top">
          <span className="label" style={{ color: editing ? 'var(--ink)' : 'var(--grey)' }}>
            {editing ? 'Editing purchase' : `Purchase · ${group?.name ?? ''}`}
          </span>
          <button type="button" className="purchase-close" aria-label="Close" onClick={onClose}>
            ✕
          </button>
        </div>

        {!editing ? (
          <>
            <span className="sheet-title">{p.title}</span>
            <div className="facts">
              <div className="f">
                <span className="fl">Amount</span>
                <span className="fv">{money(-p.amount, p.currencyCode)}</span>
              </div>
              <div className="f">
                <span className="fl">Date</span>
                <span className="fv">{dayMonthYear(p.date)}</span>
              </div>
              <div className="f">
                <span className="fl">Fund</span>
                <span className="fv" style={{ color: left < 0 ? 'var(--stale)' : 'var(--sold)' }}>
                  {left < 0 ? `${money(-left)} over` : `${money(left)} left`}
                </span>
              </div>
            </div>
            <div className="sheet-links">
              <button type="button" className="edit-link" onClick={startEdit}>
                Edit
              </button>
              <button type="button" className="delete-link" onClick={() => void remove()}>
                {confirmDelete ? 'Tap again to delete' : 'Delete purchase'}
              </button>
            </div>
          </>
        ) : (
          <form
            className="edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              void save();
            }}
          >
            <label className="field">
              <span className="label">What</span>
              <input className="fund-input big" value={title} onChange={(e) => setTitle(e.target.value)} />
            </label>
            <div className="grid2">
              <label className="field">
                <span className="label">Amount, kr</span>
                <input
                  className="line-input"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={amount}
                  onChange={(e) => setAmount(digitsOnly(e.target.value))}
                />
              </label>
              <label className="field">
                <span className="label">Date</span>
                <input className="line-input" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
              </label>
            </div>
            <label className="field">
              <span className="label">Paid from group</span>
              <select className="line-select" value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="edit-actions">
              <button type="submit" className="sheet-sell" disabled={!canSave}>
                {busy ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" className="edit-cancel" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
