import { useState } from "react";

interface ResizableHandleProps {
  onResize: (deltaX: number) => void;
}

export function ResizableHandle({ onResize }: ResizableHandleProps) {
  const [isHovering, setIsHovering] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);

    const startX = e.clientX;

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      onResize(deltaX);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
      style={{
        position: "absolute",
        left: 0,
        top: 0,
        bottom: 0,
        width: "4px",
        cursor: "col-resize",
        backgroundColor: isHovering || isDragging
          ? "var(--color-border-secondary)"
          : "var(--color-border-primary)",
        transition: "background-color var(--transition-fast)",
        zIndex: 10,
      }}
    />
  );
}
