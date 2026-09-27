import { createTimeline, stagger, type Timeline } from 'animejs';
import { useEffect, useRef } from 'react';

// Section 4's claim, drawn to scale: a plain model whose first byte lands at `fast` ms and a
// beautiful one whose first byte lands at `slow` ms, against the `budget` a caller will wait.
// A playhead sweeps the first second; each lane starts speaking when the playhead reaches it.

type Props = { budget: number; fast: number; slow: number };

const BARS = 140;
// A fixed, speech-like envelope, so the bars look like a voice and render the same every time.
const heights = Array.from({ length: BARS }, (_, i) => 0.3 + 0.7 * Math.abs(Math.sin(i * 1.7) * Math.cos(i * 0.6)));

export default function FirstByte({ budget, fast, slow }: Props) {
  const root = useRef<HTMLDivElement>(null);
  // The axis runs past the slow first byte, rounded up to the next 250 ms.
  const span = Math.ceil((slow * 1.15) / 250) * 250;
  const pct = (ms: number) => `${(ms / span) * 100}%`;
  const lanes = [
    { ms: fast, label: `First byte at ${fast} ms`, ok: fast <= budget },
    { ms: slow, label: `First byte at ${slow} ms`, ok: slow <= budget },
  ];

  useEffect(() => {
    const el = root.current;
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const SPEED = 2.4; // real milliseconds per timeline millisecond
    const head = el.querySelector<HTMLElement>('[data-head]');
    const tl: Timeline = createTimeline({ loop: true, autoplay: false });
    tl.set(el.querySelectorAll('[data-bar]'), { scaleY: 0.06 }, 0);
    // Fade what is inside a lane, never the lane or its label: the label's opaque background is
    // what keeps the budget line from running through its text.
    tl.set(el.querySelectorAll('[data-fade]'), { opacity: 0.55 }, 0);
    if (head) tl.add(head, { left: ['0%', '100%'], duration: span * SPEED, ease: 'linear' }, 0);
    el.querySelectorAll<HTMLElement>('[data-lane]').forEach((lane) => {
      const at = Number(lane.dataset.ms) * SPEED;
      tl.add(lane.querySelectorAll('[data-fade]'), { opacity: 1, duration: 200 }, at);
      tl.add(lane.querySelectorAll('[data-bar]'), { scaleY: 1, duration: 260, delay: stagger(28), ease: 'outBack' }, at);
    });
    tl.add({}, { duration: 1400 }, span * SPEED);
    const io = new IntersectionObserver(([e]) => (e?.isIntersecting ? tl.play() : tl.pause()), { threshold: 0.2 });
    io.observe(el);
    return () => {
      io.disconnect();
      tl.revert();
    };
  }, [span]);

  return (
    <div className="fb" ref={root}>
      <div className="fb__plot">
        <span className="fb__budget" style={{ left: pct(budget) }} aria-hidden="true">
          <span className="mono">{budget} ms</span>
        </span>
        <span className="fb__head" data-head aria-hidden="true" />
        {lanes.map((l) => (
          <div key={l.ms} className="fb__lane" data-lane data-ms={l.ms} data-ok={l.ok || undefined}>
            <p className="fb__label">
              <span className="fb__text" data-fade>
                <span className="fb__dot" aria-hidden="true" />
                {l.label}
              </span>
            </p>
            <div className="fb__track" data-fade>
              <span className="fb__wait" style={{ width: pct(l.ms) }} aria-hidden="true" />
              <span className="fb__wave" style={{ left: pct(l.ms) }} aria-hidden="true">
                {heights.map((h, i) => (
                  <i key={i} data-bar style={{ height: `${(h * 100).toFixed(0)}%` }} />
                ))}
              </span>
            </div>
          </div>
        ))}
      </div>
      <div className="fb__axis mono" aria-hidden="true">
        <span>0 ms</span>
        <span>{span} ms</span>
      </div>
    </div>
  );
}
