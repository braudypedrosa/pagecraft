import { render } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

const BUILDER_URL = 'https://build.itspagecraft.com/';

function Mark() {
  return <svg aria-hidden="true" viewBox="0 0 73 95"><use href="#pagecraft-mark" /></svg>;
}

function Arrow() {
  return <svg aria-hidden="true"><use href="#arrow-up-right" /></svg>;
}

function ViewportSwitch() {
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');

  useEffect(() => {
    const editor = document.querySelector<HTMLElement>('.hero .editor');
    if (editor) editor.dataset.preview = viewport;
  }, [viewport]);

  return (
    <div class="viewport-switch" aria-label="Preview width">
      {(['desktop', 'tablet', 'mobile'] as const).map(value => (
        <button
          type="button"
          class={viewport === value ? 'active' : ''}
          aria-label={`${value} preview`}
          aria-pressed={viewport === value}
          onClick={() => setViewport(value)}
          key={value}
        />
      ))}
    </div>
  );
}

function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState('');
  const shell = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    const closeOutside = (event: PointerEvent) => {
      if (open && shell.current && !shell.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOutside);
    return () => {
      document.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOutside);
    };
  }, [open]);

  useEffect(() => {
    const header = document.querySelector<HTMLElement>('.site-header');
    const sections = ['workflow', 'capabilities', 'ownership']
      .map(id => document.getElementById(id))
      .filter((section): section is HTMLElement => Boolean(section));

    const updateProgress = () => {
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      header?.style.setProperty('--page-progress', String(progress));
      header?.toggleAttribute('data-scrolled', window.scrollY > 18);
    };
    const observer = new IntersectionObserver(entries => {
      const visible = entries
        .filter(entry => entry.isIntersecting)
        .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
      if (visible) setActive((visible.target as HTMLElement).id);
    }, { rootMargin: '-22% 0px -62% 0px', threshold: [0, .2, .5] });

    sections.forEach(section => observer.observe(section));
    updateProgress();
    window.addEventListener('scroll', updateProgress, { passive: true });
    window.addEventListener('resize', updateProgress);
    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', updateProgress);
      window.removeEventListener('resize', updateProgress);
    };
  }, []);

  return (
    <div class="header-shell" ref={shell}>
      <a class="brand" href="#main" aria-label="Pagecraft home"><Mark /><span>Pagecraft</span></a>
      <nav class="nav" id="site-nav" aria-label="Primary navigation" data-open={open || undefined}>
        <a href="#workflow" aria-current={active === 'workflow' ? 'location' : undefined} onClick={() => setOpen(false)}>How it works</a>
        <a href="#capabilities" aria-current={active === 'capabilities' ? 'location' : undefined} onClick={() => setOpen(false)}>What it handles</a>
        <a href="#ownership" aria-current={active === 'ownership' ? 'location' : undefined} onClick={() => setOpen(false)}>Why Pagecraft</a>
        <a class="nav-cta" href={BUILDER_URL}>Open the builder</a>
      </nav>
      <a class="button button--green header-cta" href={BUILDER_URL}>Open the builder</a>
      <button
        class="menu-button"
        type="button"
        aria-expanded={open}
        aria-controls="site-nav"
        aria-label={open ? 'Close menu' : 'Open menu'}
        onClick={() => setOpen(value => !value)}
      >
        <svg class="menu-icon" aria-hidden="true"><use href="#menu" /></svg>
        <svg class="close-icon" aria-hidden="true"><use href="#close" /></svg>
      </button>
    </div>
  );
}

const workflow = [
  {
    title: 'Choose a useful starting point',
    body: 'Begin with a full-page template, a ready-made section, or an empty canvas. Every starting point inherits your project’s own type and colour system.'
  },
  {
    title: 'Shape it where it lives',
    body: 'Edit copy, layout, imagery, responsive styles, forms, and reusable components on the canvas. The structure stays visible while you work.'
  },
  {
    title: 'Review before you release',
    body: 'Pagecraft checks missing destinations, image descriptions, heading structure, contrast, and the other details that make a site dependable.'
  },
  {
    title: 'Publish a version you can trust',
    body: 'A draft stays private until you publish it. The release is deliberate, portable, and separate from whatever you change next.'
  }
];

function Workflow() {
  const list = useRef<HTMLOListElement>(null);
  const [current, setCurrent] = useState(0);
  const [visible, setVisible] = useState(() => new Set<number>());

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      setVisible(new Set(workflow.map((_, index) => index)));
      return;
    }

    let frame = 0;
    const update = () => {
      const rows = Array.from(list.current?.children ?? []) as HTMLElement[];
      const header = Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--header-height')) || 68;
      const line = header + window.innerHeight * 0.3;
      let nearest = 0;
      let distance = Number.POSITIVE_INFINITY;
      const seen = new Set<number>();

      rows.forEach((row, index) => {
        const rect = row.getBoundingClientRect();
        if (rect.top < window.innerHeight * 0.92 && rect.bottom > 0) seen.add(index);
        const nextDistance = Math.abs(rect.top - line);
        if (nextDistance < distance) {
          distance = nextDistance;
          nearest = index;
        }
      });
      setCurrent(nearest);
      setVisible(seen);
      frame = 0;
    };
    const requestUpdate = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, []);

  return (
    <>
      <div class="section-heading">
        <h2>A faster route from idea to live site.</h2>
        <p>Start with more than an empty box, make every detail yours, and publish only when the page is ready.</p>
      </div>
      <ol class="process motion-ready" ref={list}>
        {workflow.map((step, index) => (
          <li class={`${index === current ? 'is-current ' : ''}${visible.has(index) ? 'is-visible' : ''}`} key={step.title}>
            <span class="process-number">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{step.title}</h3><p>{step.body}</p></div>
          </li>
        ))}
      </ol>
    </>
  );
}

function RevealSystem() {
  useEffect(() => {
    const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]'));
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      nodes.forEach(node => node.dataset.revealed = 'true');
      return;
    }
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.revealed = 'true';
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    nodes.forEach(node => observer.observe(node));
    return () => observer.disconnect();
  }, []);
  return null;
}

const header = document.getElementById('site-header-app');
const workflowRoot = document.getElementById('workflow-app');
const viewportRoot = document.getElementById('viewport-switch-app');
const framework = document.getElementById('framework-root');

if (header) render(<SiteHeader />, header);
if (workflowRoot) render(<Workflow />, workflowRoot);
if (viewportRoot) render(<ViewportSwitch />, viewportRoot);
if (framework) render(<RevealSystem />, framework);
document.documentElement.classList.add('framework-ready');
