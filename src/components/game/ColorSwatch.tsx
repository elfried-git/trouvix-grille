import { Check } from "lucide-react";

interface ColorSwatchProps {
  color: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  sizeClass?: string;
}

export function ColorSwatch({ color, selected, disabled = false, onClick, title, sizeClass = "h-12 w-12" }: ColorSwatchProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={title}
      aria-pressed={selected}
      title={title}
      className={`group relative isolate shrink-0 overflow-hidden rounded-full border-0 p-0 shadow-[inset_0_3px_5px_rgba(255,255,255,0.55),inset_0_-7px_12px_rgba(0,0,0,0.38),0_5px_10px_rgba(0,0,0,0.4)] transition duration-200 hover:scale-110 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed ${sizeClass} ${selected ? "scale-110 shadow-[inset_0_3px_5px_rgba(255,255,255,0.6),inset_0_-7px_12px_rgba(0,0,0,0.38),0_0_20px_rgba(255,255,255,0.42)]" : ""} ${disabled ? "opacity-35" : ""}`}
      style={{ backgroundColor: color }}
    >
      <span aria-hidden="true" className="pointer-events-none absolute left-[16%] right-[16%] top-[7%] h-[40%] rounded-[50%] bg-gradient-to-b from-white/85 via-white/40 to-white/0 blur-[0.5px]" />
      <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-gradient-to-b from-white/10 via-transparent to-black/25" />
      <span aria-hidden="true" className="pointer-events-none absolute bottom-[9%] left-[40%] h-[9%] w-[20%] rounded-full bg-white/30 blur-[2px]" />
      {selected && <Check aria-hidden="true" className="absolute inset-0 z-10 m-auto h-5 w-5 text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]" />}
    </button>
  );
}
