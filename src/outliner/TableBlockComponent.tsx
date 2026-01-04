import React from "react";
import { Block } from "./types";

interface TableBlockProps {
  block: Block;
  onCellChange: (rowIndex: number, colIndex: number, value: string) => void;
}

export const TableBlockComponent: React.FC<TableBlockProps> = ({ block, onCellChange }) => {
  if (block.kind !== "table" || !block.tableData) {
    return null;
  }

  const handleBlur = (
    rowIndex: number,
    colIndex: number,
    e: React.FocusEvent<HTMLDivElement>
  ) => {
    onCellChange(rowIndex, colIndex, e.currentTarget.textContent || "");
  };

  return (
    <table className="table-block">
      <tbody>
        {block.tableData.map((row, rowIndex) => (
          <tr key={rowIndex}>
            {row.map((cell, colIndex) => (
              <td key={colIndex}>
                <div
                  contentEditable
                  suppressContentEditableWarning
                  onBlur={(e) => handleBlur(rowIndex, colIndex, e)}
                  dangerouslySetInnerHTML={{ __html: cell }}
                />
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};
