"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink, X } from "lucide-react";
import type { Guide, GuideStep } from "@/lib/guides";
import { PaletteSphere } from "./PaletteSphere";

export const titleCase = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1);

export function Modal({
  trigger,
  title,
  description,
  children,
  onCloseAutoFocus,
  open,
  onOpenChange,
}: {
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  title: string;
  description: string;
  children: React.ReactNode;
  onCloseAutoFocus?: React.ComponentProps<typeof Dialog.Content>["onCloseAutoFocus"];
}) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>}
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content className="dialog-content" onCloseAutoFocus={onCloseAutoFocus}>
          <div className="dialog-heading flex items-center justify-between gap-4">
            <Dialog.Title>{title}</Dialog.Title>
            <Dialog.Close className="icon-button" aria-label="Close">
              <X size={20} />
            </Dialog.Close>
          </div>
          <div className="dialog-body">
            <Dialog.Description>{description}</Dialog.Description>
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export function Sources({ guide, step }: { guide: Guide; step?: GuideStep }) {
  const sources = step
    ? guide.sources.filter((source) => step.sourceIds.includes(source.id))
    : guide.sources;
  return (
    <details className="sources">
      <summary>
        Lesson sources <ExternalLink size={12} />
      </summary>
      <div>
        {guide.editorialNote && <p>{guide.editorialNote}</p>}
        {sources.length ? (
          sources.map((source) => (
            <a
              key={source.id}
              href={source.url}
              target="_blank"
              rel="noreferrer"
            >
              {source.title}
              <ExternalLink size={12} />
            </a>
          ))
        ) : (
          <p>An original reflection prompt. Your observations belong to you.</p>
        )}
      </div>
    </details>
  );
}

export function ColourStrip({ guide, maxVisible = guide.paints.length }: { guide: Guide; maxVisible?: number }) {
  return (
    <div
      className="colour-strip"
      role="img"
      aria-label={`${guide.paints.length} paints: ${guide.paints.map(paint => paint.name).join(", ")}`}
    >
      {guide.paints.slice(0, maxVisible).map((paint) => (
        <span
          key={paint.id}
          aria-hidden="true"
          style={{ background: paint.hex }}
          title={paint.name}
        >
          <span className="sr-only">{paint.name}</span>
        </span>
      ))}
      {guide.paints.length > maxVisible && <small aria-hidden="true" className="colour-overflow">+{guide.paints.length - maxVisible}</small>}
    </div>
  );
}

export function GuideArtwork({
  guide,
}: {
  guide: Guide;
  priority?: boolean;
}) {
  return (
    <div className="guide-artwork palette-artwork">
      <PaletteSphere guide={guide} />
    </div>
  );
}
