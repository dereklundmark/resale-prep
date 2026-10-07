import { useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { GroupSelect } from '../components/GroupSelect';
import { Pinned } from '../components/Pinned';
import { TagSymbol } from '../components/TagSymbol';
import { useStore } from '../data/store';
import { digitsOnly, num } from '../lib/format';
import { GenerateError, generateSuggestion } from '../lib/generate';
import { newId } from '../lib/id';
import { compressPhoto } from '../lib/image';
import type { Platform } from '../lib/types';
import { emptyDraft, releaseDraftPhotos, type DraftPhoto, type NewDraft } from './newDraft';

const OTHER = '__other__';

interface Props {
  draft: NewDraft;
  setDraft: Dispatch<SetStateAction<NewDraft>>;
  onSaved(): void;
}

export function NewScreen({ draft, setDraft, onSaved }: Props) {
  const { saveListing, activePlatforms, conditions, conditionLabel, market } = useStore();
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const addInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);
  const titleRef = useRef<HTMLTextAreaElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const set = (patch: Partial<NewDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const checked = activePlatforms.filter((p) => !draft.platformsOff.includes(p.code)).map((p) => p.code);
  const platformInfo = (code: Platform) => activePlatforms.find((p) => p.code === code);

  // ---- photos ----
  const readFiles = async (files: FileList | null): Promise<DraftPhoto[]> => {
    if (!files?.length) return [];
    setBusy(true);
    try {
      return await Promise.all(
        Array.from(files).map(async (f) => {
          const { full, thumb } = await compressPhoto(f);
          return { id: newId(), full, thumb, fullUrl: URL.createObjectURL(full), thumbUrl: URL.createObjectURL(thumb) };
        }),
      );
    } catch {
      set({ error: "Couldn't read that photo. Try another one." });
      return [];
    } finally {
      setBusy(false);
    }
  };

  const addPhotos = async (files: FileList | null) => {
    const added = await readFiles(files);
    if (added.length) setDraft((d) => ({ ...d, photos: [...d.photos, ...added], error: null }));
  };

  const replaceFirst = async (files: FileList | null) => {
    const [p] = await readFiles(files);
    if (!p) return;
    setDraft((d) => {
      if (d.photos[0]) releaseDraftPhotos([d.photos[0]]);
      return { ...d, photos: [p, ...d.photos.slice(1)], error: null };
    });
  };

  const removePhoto = (id: string) =>
    setDraft((d) => {
      releaseDraftPhotos(d.photos.filter((p) => p.id === id));
      return { ...d, photos: d.photos.filter((p) => p.id !== id) };
    });

  const makeFirst = (id: string) =>
    setDraft((d) => ({ ...d, photos: [...d.photos.filter((p) => p.id === id), ...d.photos.filter((p) => p.id !== id)] }));

  // ---- generate ----
  const canGenerate = checked.length > 0 && (draft.name.trim() !== '' || draft.photos.length > 0) && !busy;

  const generate = async () => {
    if (!canGenerate) return;
    set({ stage: 'generating', error: null });
    try {
      const s = await generateSuggestion({
        name: draft.name,
        condition: draft.condition,
        platforms: checked,
        photos: draft.photos.map((p) => p.full),
      });
      // Regenerating only replaces what's still an AI draft — anything the
      // user already confirmed stays as they left it.
      setDraft((d) => {
        const categories = { ...d.categories };
        const categoriesOther = { ...d.categoriesOther };
        for (const p of Object.keys(s.categories)) {
          if (!d.categoriesOk[p]) {
            categories[p] = s.categories[p]?.[0];
            categoriesOther[p] = false;
          }
        }
        return {
          ...d,
          stage: 'result',
          title: d.titleOk ? d.title : s.title,
          description: d.descriptionOk ? d.description : s.description,
          categoryOptions: { ...d.categoryOptions, ...s.categories },
          categories,
          categoriesOther,
          estimate: s.estimate,
        };
      });
    } catch (e) {
      // Back to wherever they came from: Redo on the result keeps the result.
      setDraft((d) => ({
        ...d,
        stage: d.title ? 'result' : 'form',
        error: e instanceof GenerateError ? e.message : 'Generate failed. Check your connection and try again.',
      }));
    }
  };

  // ---- save ----
  const canSave = draft.ask !== '' && draft.title.trim() !== '';
  const missingTitle = draft.title.trim() === '';

  // SAVE stays grey until it's ready, but a tap on it jumps to the missing
  // field and opens the keyboard (the price field is easy to miss).
  const showMissing = () => {
    const el = missingTitle ? titleRef.current : priceRef.current;
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    el?.focus({ preventScroll: true });
  };

  const save = async () => {
    if (!canSave || saving) return;
    const categories: Partial<Record<Platform, string>> = {};
    for (const p of checked) {
      const c = draft.categories[p]?.trim();
      if (c) categories[p] = c;
    }
    setSaving(true);
    set({ error: null });
    try {
      await saveListing({
        title: draft.title.trim(),
        description: draft.description.trim(),
        condition: draft.condition,
        groupId: draft.groupId,
        platforms: checked,
        categories,
        priceListed: Number(draft.ask),
        aiEstimate: draft.estimate,
        photos: draft.photos.map(({ id, full, thumb }) => ({ id, full, thumb })),
      });
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Saving failed. Try again.' });
      return;
    } finally {
      setSaving(false);
    }
    releaseDraftPhotos(draft.photos);
    setDraft(emptyDraft());
    onSaved();
  };

  // ---- render ----
  if (draft.stage === 'generating') {
    // A big price tag swaying gently, like it's hanging in a shop, while
    // Gemini writes the listing.
    return (
      <div className="new">
        <div className="tag-wait" role="status" aria-label="Pricing it up">
          <TagSymbol size={180} className="tag-swing" />
          <span className="tag-caption">Pricing it up…</span>
        </div>
      </div>
    );
  }

  if (draft.stage === 'result') {
    return (
      <div className="new">
        <div className="result">
          <div className="legend-row">
            <span style={{ color: 'var(--grey)' }}>Grey = AI draft · Black = yours</span>
            <span className="links">
              <button type="button" onClick={() => void generate()}>
                Redo
              </button>
              <button type="button" onClick={() => set({ stage: 'form' })}>
                Edit item
              </button>
            </span>
          </div>
          <label className="field">
            <span className="label">Title</span>
            <textarea
              ref={titleRef}
              className={`title-area draftable ${draft.titleOk ? 'ok' : ''}`}
              rows={2}
              value={draft.title}
              onChange={(e) => set({ title: e.target.value, titleOk: true })}
            />
          </label>

          <label className="field">
            <span className="label">Description</span>
            <textarea
              className={`desc-area draftable ${draft.descriptionOk ? 'ok' : ''}`}
              rows={6}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value, descriptionOk: true })}
            />
          </label>

          {checked.length > 0 && (
            <div>
              {checked.map((p) => {
                const options = draft.categoryOptions[p] ?? [];
                const other = draft.categoriesOther[p] || (options.length === 0 && draft.categories[p] === undefined);
                const setCat = (patch: Partial<NewDraft>) =>
                  setDraft((d) => ({ ...d, ...patch, categoriesOk: { ...d.categoriesOk, [p]: true } }));
                return (
                  <div key={p} className="cat-row">
                    <div className="cat-stripe" style={{ background: platformInfo(p)?.colorStrong }} />
                    <div className={`cat-body draftable ${draft.categoriesOk[p] ? 'ok' : ''}`}>
                      <span className="label ink">{platformInfo(p)?.name ?? p}</span>
                      <select
                        value={other ? OTHER : (draft.categories[p] ?? '')}
                        onChange={(e) =>
                          e.target.value === OTHER
                            ? setCat({
                                categories: { ...draft.categories, [p]: '' },
                                categoriesOther: { ...draft.categoriesOther, [p]: true },
                              })
                            : setCat({
                                categories: { ...draft.categories, [p]: e.target.value },
                                categoriesOther: { ...draft.categoriesOther, [p]: false },
                              })
                        }
                      >
                        {options.map((o) => (
                          <option key={o} value={o}>
                            {o}
                          </option>
                        ))}
                        <option value={OTHER}>Other…</option>
                      </select>
                      {other && (
                        <input
                          value={draft.categories[p] ?? ''}
                          placeholder="Type the category"
                          onChange={(e) => setCat({ categories: { ...draft.categories, [p]: e.target.value } })}
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {draft.estimate && (
            <div className="estimate">
              <span className="label">AI estimate</span>
              <span className="range">
                {num(draft.estimate.low, market.locale)}–{num(draft.estimate.high, market.locale)}
              </span>
              <span className="why">{draft.estimate.reasoning}</span>
            </div>
          )}

          <label className="field">
            <span className="label ink">Your price, kr</span>
            <input
              ref={priceRef}
              className="price-input"
              inputMode="numeric"
              pattern="[0-9]*"
              placeholder="Type your price"
              value={draft.ask}
              onChange={(e) => set({ ask: digitsOnly(e.target.value) })}
            />
          </label>
        </div>
        <Pinned>
          {draft.error && <div className="pin-error">{draft.error}</div>}
          {/* Not `disabled`: a disabled button can't be tapped, and the tap is
              what takes you to the missing field. */}
          <button
            type="button"
            className={`band ${canSave && !saving ? '' : 'band-waiting'}`}
            aria-disabled={!canSave}
            onClick={() => (canSave ? void save() : showMissing())}
          >
            <span>Save</span>
            <span>→</span>
          </button>
        </Pinned>
      </div>
    );
  }

  const first = draft.photos[0];
  return (
    <div className="new">
      <input
        ref={addInput}
        className="hidden-file"
        type="file"
        accept="image/*"
        multiple
        onChange={(e) => {
          void addPhotos(e.target.files);
          e.target.value = '';
        }}
      />
      <input
        ref={replaceInput}
        className="hidden-file"
        type="file"
        accept="image/*"
        onChange={(e) => {
          void replaceFirst(e.target.files);
          e.target.value = '';
        }}
      />
      <div
        className={`photo-box ${first ? 'has-photo' : ''}`}
        role="button"
        tabIndex={0}
        onClick={() => (first ? replaceInput : addInput).current?.click()}
      >
        {first && <img src={first.fullUrl} alt="" />}
        <span className="photo-caption">
          {busy ? 'processing…' : first ? 'item photo · tap to retake' : 'tap to add photo'}
        </span>
        <button
          type="button"
          className="photo-plus"
          aria-label="Add another photo"
          onClick={(e) => {
            e.stopPropagation();
            addInput.current?.click();
          }}
        >
          +1
        </button>
      </div>
      {draft.photos.length > 1 && (
        <div className="thumb-strip">
          {draft.photos.map((p, i) => (
            <div key={p.id} className={`thumb ${i === 0 ? 'first' : ''}`}>
              <button type="button" aria-label="Use as main photo" onClick={() => makeFirst(p.id)}>
                <img src={p.thumbUrl} alt="" />
              </button>
              <button type="button" className="x" aria-label="Remove photo" onClick={() => removePhoto(p.id)}>
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="fields">
        <input
          className="name-input"
          placeholder="What is it?"
          value={draft.name}
          onChange={(e) => set({ name: e.target.value })}
        />
        <div className="grid2">
          <label className="field">
            <span className="label">Condition</span>
            <select
              className="line-select"
              value={draft.condition}
              onChange={(e) => set({ condition: e.target.value })}
            >
              {conditions.map((c) => (
                <option key={c.code} value={c.code}>
                  {conditionLabel(c.code)}
                </option>
              ))}
            </select>
          </label>
          <div className="field">
            <span className="label">Group</span>
            <GroupSelect value={draft.groupId} onChange={(groupId) => set({ groupId })} />
          </div>
        </div>
      </div>

      <div className="plat-toggles">
        {activePlatforms.map((p) => {
          const on = !draft.platformsOff.includes(p.code);
          return (
            <button
              key={p.code}
              type="button"
              className={`plat-toggle ${on ? 'on' : ''}`}
              aria-pressed={on}
              style={on ? { background: p.colorTint, color: p.colorText } : undefined}
              onClick={() =>
                set({
                  platformsOff: on ? [...draft.platformsOff, p.code] : draft.platformsOff.filter((c) => c !== p.code),
                })
              }
            >
              <span className="name">{p.name}</span>
              <span className="state">{on ? 'On' : 'Off'}</span>
            </button>
          );
        })}
      </div>
      <Pinned>
        {draft.error && <div className="pin-error">{draft.error}</div>}
        <button type="button" className="band" disabled={!canGenerate} onClick={() => void generate()}>
          <span>Generate</span>
          <span>→</span>
        </button>
      </Pinned>
    </div>
  );
}
