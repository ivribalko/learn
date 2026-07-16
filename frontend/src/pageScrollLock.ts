import { useEffect } from "react";

const PAGE_SCROLL_LOCK_CLASS = "page-scroll-locked";
let activeLockCount = 0;

/** Prevents a full-screen overlay's touch scrolling from moving the page behind it. */
export function usePageScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return undefined;
    }

    activeLockCount += 1;
    document.documentElement.classList.add(PAGE_SCROLL_LOCK_CLASS);
    document.body.classList.add(PAGE_SCROLL_LOCK_CLASS);

    return () => {
      activeLockCount = Math.max(0, activeLockCount - 1);
      if (activeLockCount === 0) {
        document.documentElement.classList.remove(PAGE_SCROLL_LOCK_CLASS);
        document.body.classList.remove(PAGE_SCROLL_LOCK_CLASS);
      }
    };
  }, [locked]);
}
