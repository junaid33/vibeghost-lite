import type { ComponentProps } from "react";
import styles from "./markdown-table.module.css";

export { styles as markdownTableStyles };

/** A markdown table at its natural column widths. A wide one scrolls sideways in its own box, so
 *  the chat column never does; each surface's markdown CSS still styles the cells. Streamdown's
 *  own table (Oathkeeper's chat) gets the same sizing from `markdownTableStyles.streamdown`. */
export function MarkdownTable({ node: _node, ...props }: ComponentProps<"table"> & { node?: unknown }) {
  return <div className={styles.scroll} data-markdown-table=""><table {...props}/></div>;
}
