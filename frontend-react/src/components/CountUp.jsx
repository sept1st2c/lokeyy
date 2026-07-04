import { useEffect, useRef, useState } from "react";

export default function CountUp({ value, duration = 1200 }) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(0);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setStarted(true);
          obs.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!started || typeof value !== "number") return;
    let raf;
    const t0 = performance.now();
    function tick(now) {
      const p = Math.min(1, (now - t0) / duration);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value, duration]);

  return <span ref={ref}>{typeof value === "number" ? display : value ?? "—"}</span>;
}
