import { useEffect, useRef } from "react";

export function useAutoplayVideo() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const play = () => { const video = ref.current; if (!video) return; video.muted = true; void video.play().catch(() => undefined); };
    play();
    const timer = window.setInterval(play, 1000);
    document.addEventListener("click", play, { once: true });
    document.addEventListener("touchstart", play, { once: true });
    return () => { window.clearInterval(timer); document.removeEventListener("click", play); document.removeEventListener("touchstart", play); };
  }, []);
  return ref;
}
