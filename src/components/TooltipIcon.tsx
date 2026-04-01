import { useState, useId } from 'react';
import { Info } from 'lucide-react';

interface Props {
  text: React.ReactNode;
}

export default function TooltipIcon({ text }: Props) {
  const [open, setOpen] = useState(false);
  const tooltipId = `tooltip-${useId()}`;

  return (
    <span className="relative inline-flex items-center">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        className="ml-1 text-gray-500 hover:text-cyan-400 transition-colors focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:rounded"
        aria-label="More information"
        aria-expanded={open}
        aria-describedby={tooltipId}
      >
        <Info size={12} />
      </button>
      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className="absolute left-0 top-5 z-50 w-52 rounded border border-gray-700 bg-[#0a0f1e] px-2 py-1.5 text-xs text-gray-300 shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
