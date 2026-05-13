import React, { useRef } from 'react';
import { createPortal } from 'react-dom';
import { useOutsideClick } from '../../hooks/useOutsideClick.ts';

interface PopoverProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  triggerRef: React.RefObject<HTMLElement>;
  className?: string;
}

export const Popover: React.FC<PopoverProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  triggerRef,
  className = '' 
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = React.useState<React.CSSProperties>({ display: 'none' });

  useOutsideClick(popoverRef, onClose);

  React.useLayoutEffect(() => {
    if (isOpen && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setStyle({
        position: 'fixed',
        top: `${rect.bottom + 8}px`,
        left: `${rect.left}px`,
        zIndex: 9999,
      });
    }
  }, [isOpen, triggerRef]);

  if (!isOpen) return null;

  return createPortal(
    <div 
      ref={popoverRef}
      style={style}
      className={`bg-white rounded-xl shadow-2xl border border-slate-200 p-3 animate-in fade-in zoom-in-95 duration-200 ${className}`}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>,
    document.body
  );
};
