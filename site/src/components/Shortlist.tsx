import * as ToggleGroup from '@radix-ui/react-toggle-group';
import { animate, stagger } from 'animejs';
import { useEffect, useRef, useState } from 'react';

// A README table cut down to one filter. The providers table filters by lean (a "both" provider
// belongs to either side), the open model table by what its weight license allows.

type Row = { name: string; tag: string; tagLabel: string; note?: string; html: string };
type Option = { value: string; label: string; tags: string[] };

export default function Shortlist({
  rows,
  options,
  label,
  count,
  initial = 'all',
}: {
  rows: Row[];
  options: Option[];
  label: string;
  /** "{n} of {total} ..." with {n} and {total} filled in here. */
  count: string;
  initial?: string;
}) {
  const [value, setValue] = useState(initial);
  const list = useRef<HTMLUListElement>(null);
  const first = useRef(true);
  const opt = options.find((o) => o.value === value);
  const shown = rows.filter((r) => !opt || opt.tags.includes(r.tag));

  useEffect(() => {
    if (first.current || !list.current || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      first.current = false;
      return;
    }
    animate(list.current.querySelectorAll('[data-row]'), { opacity: [0, 1], translateY: [6, 0], duration: 420, delay: stagger(30), ease: 'outExpo' });
  }, [value]);

  return (
    <div className="short">
      <ToggleGroup.Root type="single" value={value} onValueChange={(v) => v && setValue(v)} aria-label={label} className="seg short__bar">
        <ToggleGroup.Item value="all" className="seg__item">
          All
        </ToggleGroup.Item>
        {options.map((o) => (
          <ToggleGroup.Item key={o.value} value={o.value} className="seg__item">
            {o.label}
          </ToggleGroup.Item>
        ))}
      </ToggleGroup.Root>
      <p className="short__count mono" aria-live="polite">
        {count.replace('{n}', String(shown.length)).replace('{total}', String(rows.length))}
      </p>
      <ul className="short__list" ref={list}>
        {shown.map((r) => (
          <li key={r.name} className="short__row" data-row>
            <span className="short__name">{r.name}</span>
            <span className="short__tag" data-tag={r.tag}>
              {r.tagLabel}
            </span>
            <span className="short__desc">
              {r.note && <span className="short__note">{r.note}</span>}
              <span dangerouslySetInnerHTML={{ __html: r.html }} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
