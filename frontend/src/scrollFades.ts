/** Returns edge classes for content that remains outside a scroll container's viewport. */
export function getScrollFadeClass(element: HTMLElement): string {
  const threshold = 1;
  const canScrollUp = element.scrollTop > threshold;
  const canScrollDown = element.scrollTop + element.clientHeight < element.scrollHeight - threshold;
  const canScrollLeft = element.scrollLeft > threshold;
  const canScrollRight = element.scrollLeft + element.clientWidth < element.scrollWidth - threshold;
  return [
    canScrollUp ? "can-scroll-up" : "",
    canScrollDown ? "can-scroll-down" : "",
    canScrollLeft ? "can-scroll-left" : "",
    canScrollRight ? "can-scroll-right" : ""
  ].filter(Boolean).join(" ");
}
