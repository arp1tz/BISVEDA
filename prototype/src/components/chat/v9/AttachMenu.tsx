"use client";

import React, { useEffect, useRef, useState } from "react";
import { Plus, Camera, Image as ImageIcon, FileText } from "lucide-react";
import { ATTACH_ACCEPT_FILES, ATTACH_ACCEPT_PHOTOS, hasCoarsePointer } from "@/lib/attachments";
import { CameraCaptureModal } from "./CameraCaptureModal";

interface AttachMenuProps {
  /** Called with the raw File the user picked or captured. */
  onFile: (file: File) => void;
  disabled?: boolean;
  /** Which way the popover opens. Use "up" when the button sits at the bottom of the screen. */
  direction?: "up" | "down";
  className?: string;
}

/** "+" button that opens a small menu: Camera, Photos, Files. */
export function AttachMenu({ onFile, disabled = false, direction = "down", className = "" }: AttachMenuProps) {
  const [open, setOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onFile(file);
  };

  const handleCamera = () => {
    setOpen(false);
    // Phones: the native camera app via <input capture>. Desktops: live preview modal.
    if (hasCoarsePointer()) cameraInputRef.current?.click();
    else setCameraOpen(true);
  };

  const items = [
    { label: "Camera", hint: "Take a photo", icon: Camera, onClick: handleCamera },
    { label: "Photos", hint: "Pick an image", icon: ImageIcon, onClick: () => { setOpen(false); photoInputRef.current?.click(); } },
    { label: "Files", hint: "PDF or document", icon: FileText, onClick: () => { setOpen(false); fileInputRef.current?.click(); } },
  ];

  return (
    <div ref={rootRef} className={`relative shrink-0 ${className}`}>
      <input ref={cameraInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleInput} />
      <input ref={photoInputRef} type="file" accept={ATTACH_ACCEPT_PHOTOS} className="hidden" onChange={handleInput} />
      <input ref={fileInputRef} type="file" accept={ATTACH_ACCEPT_FILES} className="hidden" onChange={handleInput} />

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Add attachment"
        title="Add a photo or file"
        className={`h-8 w-8 inline-flex items-center justify-center rounded-lg border border-[#E5E7EB] bg-white text-[#0B2A4A] hover:bg-[#F7F8FA] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer ${
          open ? "bg-[#F7F8FA]" : ""
        }`}
      >
        <Plus className={`h-4 w-4 transition-transform ${open ? "rotate-45" : ""}`} />
      </button>

      {open && (
        <div
          role="menu"
          className={`absolute left-0 z-30 w-48 rounded-xl border border-[#E5E7EB] bg-white shadow-md p-1 ${
            direction === "up" ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {items.map(({ label, hint, icon: Icon, onClick }) => (
            <button
              key={label}
              type="button"
              role="menuitem"
              onClick={onClick}
              className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left hover:bg-[#F7F8FA] cursor-pointer"
            >
              <Icon className="h-4 w-4 text-[#0B2A4A] shrink-0" />
              <span className="min-w-0">
                <span className="block text-xs font-semibold text-[#0F172A]">{label}</span>
                <span className="block text-[10px] text-[#64748B]">{hint}</span>
              </span>
            </button>
          ))}
        </div>
      )}

      {cameraOpen && (
        <CameraCaptureModal
          onClose={() => setCameraOpen(false)}
          onCapture={(file) => {
            setCameraOpen(false);
            onFile(file);
          }}
          onUnavailable={() => {
            setCameraOpen(false);
            photoInputRef.current?.click();
          }}
        />
      )}
    </div>
  );
}
