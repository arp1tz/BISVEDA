"use client";

import React, { useEffect, useRef, useState } from "react";
import { Camera, X } from "lucide-react";

interface CameraCaptureModalProps {
  onCapture: (file: File) => void;
  onClose: () => void;
  /** Called when the camera can't be opened, so the caller can fall back to a normal file picker. */
  onUnavailable?: () => void;
}

/** Desktop camera: live preview + capture button (phones use the native camera via <input capture>). */
export function CameraCaptureModal({ onCapture, onClose, onUnavailable }: CameraCaptureModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError("This browser can't open the camera.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
          setReady(true);
        }
      } catch (err) {
        const denied = err instanceof DOMException && (err.name === "NotAllowedError" || err.name === "SecurityError");
        setError(denied ? "Camera permission was blocked. Allow camera access in the browser and try again." : "No camera was found on this device.");
      }
    })();
    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, []);

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        onCapture(new File([blob], `camera-${Date.now()}.jpg`, { type: "image/jpeg" }));
      },
      "image/jpeg",
      0.9
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-label="Take a photo">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#E5E7EB] shadow-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#E5E7EB]">
          <h2 className="text-sm font-bold text-[#0B2A4A]">Take a photo</h2>
          <button type="button" onClick={onClose} className="p-1 rounded-md text-[#64748B] hover:bg-[#F7F8FA] cursor-pointer" aria-label="Close camera">
            <X className="h-4 w-4" />
          </button>
        </div>

        {error ? (
          <div className="p-5 space-y-3 text-center">
            <p className="text-sm text-[#0F172A]">{error}</p>
            {onUnavailable && (
              <button
                type="button"
                onClick={onUnavailable}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#0B2A4A] text-white hover:bg-[#081e36] cursor-pointer"
              >
                Choose a photo instead
              </button>
            )}
          </div>
        ) : (
          <div className="p-4 space-y-3">
            <video ref={videoRef} playsInline muted className="w-full aspect-[4/3] rounded-xl bg-black object-cover" />
            <button
              type="button"
              onClick={handleCapture}
              disabled={!ready}
              className="w-full inline-flex items-center justify-center gap-2 py-2 rounded-xl bg-[#0B2A4A] text-white text-sm font-semibold hover:bg-[#081e36] disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            >
              <Camera className="h-4 w-4" />
              <span>Capture</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
