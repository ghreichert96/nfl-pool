import { Children, cloneElement, isValidElement } from "react";
import type { ReactElement, ReactNode } from "react";
import { StickyTableFrame } from "./sticky-table-frame";

type TableProps = {
  children?: ReactNode;
  className?: string;
  style?: React.CSSProperties;
};

export function StickyTableHeader({
  children,
  columnWidths,
}: {
  children: ReactElement<TableProps>;
  columnWidths: number[];
}) {
  const sections = Children.toArray(children.props.children);
  const head = sections.find(
    (child) => isValidElement(child) && child.type === "thead",
  ) as ReactElement<TableProps>;
  const body = sections.filter(
    (child) => isValidElement(child) && child.type === "tbody",
  );
  const columns = (
    <colgroup>
      {columnWidths.map((width, index) => (
        <col
          key={index}
          style={index < columnWidths.length - 1 ? { width } : undefined}
        />
      ))}
    </colgroup>
  );
  const props = {
    className: `${children.props.className ?? ""} table-fixed`,
    style: {
      width: "100%",
      minWidth: columnWidths.reduce((sum, width) => sum + width, 0),
    },
  };

  return (
    <StickyTableFrame header={cloneElement(children, props, columns, head)}>
      {cloneElement(
        children,
        props,
        columns,
        cloneElement(head, { className: "sr-only" }),
        ...body,
      )}
    </StickyTableFrame>
  );
}
