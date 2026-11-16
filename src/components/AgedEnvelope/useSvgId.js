import { useId } from "react";

// React ids contain characters like ":" that break SVG url(#id) references.
export default function useSvgId(prefix) {
  return `${prefix}-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
