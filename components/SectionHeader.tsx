type SectionHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: React.ReactNode;
};

export function SectionHeader({ eyebrow, title, description, action }: SectionHeaderProps) {
  return (
    <div className="border-b border-line pb-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          {eyebrow ? (
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-accent">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-2 text-3xl font-black leading-tight text-ink">{title}</h1>
          {description ? (
            <p className="mt-3 max-w-3xl text-sm font-medium leading-7 text-ink-soft">
              {description}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
