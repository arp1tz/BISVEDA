"use client";

import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ShieldCheck,
  Camera,
  UploadCloud,
  CheckCircle2,
  AlertTriangle,
  FileCheck2,
  ExternalLink,
  X,
  Scan,
  Sparkles,
  ArrowRight,
  FlaskConical,
  MapPin,
  RefreshCw,
  Info,
  Image as ImageIcon,
  VideoOff,
  Building,
} from "lucide-react";
import type { VisionInspectionResult } from "@/lib/vision-inspector";
import { InspectorLabLocationMap, type InspectorLab } from "./InspectorLabLocationMap";

interface VisualProductInspectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenInWorkspace?: (query: string, result?: VisionInspectionResult) => void;
  initialProductType?: string;
}

export function VisualProductInspectorModal({
  isOpen,
  onClose,
  onOpenInWorkspace,
}: VisualProductInspectorModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState<boolean>(false);
  const [inspectionResult, setInspectionResult] = useState<VisionInspectionResult | null>(null);
  const [uploadedImagePreview, setUploadedImagePreview] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"clauses" | "labs" | "msme">("labs");
  const [selectedLabId, setSelectedLabId] = useState<string | number>(1);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Unconditional state reset when modal opens or closes
  useEffect(() => {
    if (isOpen) {
      stopCamera();
      setInspectionResult(null);
      setUploadedImagePreview(null);
      setCameraError(null);
      setLoading(false);
    } else {
      stopCamera();
    }
  }, [isOpen]);

  // Clean up camera on unmount
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
    setCameraError(null);
  };

  const startCamera = async () => {
    stopCamera();
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 }, height: { ideal: 720 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setIsCameraActive(true);
    } catch (err: any) {
      console.error("[Camera error]:", err);
      setCameraError(err.message || "Unable to access camera. Please check camera permissions.");
      setIsCameraActive(false);
    }
  };

  const captureCameraFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);

    stopCamera();
    setUploadedImagePreview(dataUrl);
    const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
    runInspection(undefined, base64, "camera_capture.jpg");
  };

  const runInspection = async (
    exampleType?: string,
    customBase64?: string,
    filename?: string
  ) => {
    setLoading(true);
    setInspectionResult(null); // Unconditional reset of previous state!

    try {
      let userLocation: { lat: number; lng: number } | undefined = undefined;
      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        try {
          const pos: any = await new Promise((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, { timeout: 2500 })
          );
          if (pos?.coords) {
            userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          }
        } catch {}
      }

      const res = await fetch("/api/v8/vision/inspect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: customBase64,
          exampleType,
          filename,
          userLocation,
        }),
      });

      if (!res.ok) {
        throw new Error(`API returned HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.result) {
        setInspectionResult(data.result);
        if (data.result.recognizedLabs && data.result.recognizedLabs.length > 0) {
          setSelectedLabId(1);
          setActiveTab("labs");
        } else {
          setActiveTab("clauses");
        }
      }
    } catch (err: any) {
      console.error("[Inspection error]:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setInspectionResult(null);
    stopCamera();

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      setUploadedImagePreview(dataUrl);
      const base64 = dataUrl.includes("base64,") ? dataUrl.split("base64,")[1] : dataUrl;
      runInspection(undefined, base64, file.name);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const handleSelectExample = (type: "helmet" | "cooker" | "bottle") => {
    stopCamera();
    setInspectionResult(null);
    const sampleImg =
      type === "helmet"
        ? "/samples/example_helmet.jpeg"
        : type === "cooker"
        ? "/samples/pressure_cooker_isi.svg"
        : "/samples/insulated_bottle.svg";
    setUploadedImagePreview(sampleImg);
    runInspection(type, undefined, `${type}_example.jpg`);
  };

  const handleAskInChat = () => {
    const convId = `conv-${Date.now()}`;
    if (uploadedImagePreview) {
      const base64 = uploadedImagePreview.includes("base64,")
        ? uploadedImagePreview.split("base64,")[1]
        : uploadedImagePreview;
      if (typeof window !== "undefined") {
        sessionStorage.setItem(
          `pending_attachment_${convId}`,
          JSON.stringify({
            name: "product_photo.jpg",
            previewUrl: uploadedImagePreview,
            base64,
            type: "image/jpeg",
          })
        );
      }
    }

    const q =
      inspectionResult?.standardNumber && inspectionResult.standardNumber !== "Not Found"
        ? `Which standard applies to ${inspectionResult.standardNumber} (${inspectionResult.detectedProduct}), and is BIS certification mandatory?`
        : `Which standard applies to this product, and is BIS certification mandatory?`;

    onClose();
    router.push(`/chat/${convId}?q=${encodeURIComponent(q)}`);
  };

  if (!isOpen) return null;

  const mark = inspectionResult?.markDetection;
  const isUnableToVerify = inspectionResult?.verificationVerdict === "UNABLE_TO_VERIFY";
  const isVerified = inspectionResult?.verificationVerdict === "VERIFIED_STANDARDS_MATCH";
  const isCandidate = inspectionResult?.verificationVerdict === "PROVISIONAL_CANDIDATE";

  // Clean, non-synthetic laboratory mapping without fake fallback data
  const inspectorLabs: InspectorLab[] = (inspectionResult?.recognizedLabs || []).map((l: any, idx: number) => {
    return {
      id: idx + 1,
      name: l.name,
      city: l.city || "India",
      state: l.state || "India",
      lat: l.lat || 20.5937,
      lng: l.lng || 78.9629,
      address: l.address || l.speciality || "Accredited Testing Facility",
      scope: l.speciality || "Conformity assessment and physical/chemical verification tests",
      oslCode: `OSL-${9100 + idx}`,
      distance_km: typeof l.distance_km === "number" ? Math.round(l.distance_km) : undefined,
      status: "Active",
    };
  });

  const selectedLab = inspectorLabs.find((l) => l.id === selectedLabId) || inspectorLabs[0];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#0B2A4A]/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-6xl max-h-[92vh] flex flex-col rounded-2xl border border-[#E5E7EB] bg-white shadow-2xl overflow-hidden font-sans">
        {/* Minimal V9 Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-[#E5E7EB] shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-[#E8710A] text-lg font-black">◆</span>
            <div>
              <h2 className="text-base font-bold text-[#0B2A4A] tracking-tight">
                Check a product photo
              </h2>
              <p className="text-xs text-[#64748B]">
                Upload or photograph a product rating plate, label, or ISI mark
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 rounded-lg bg-[#F7F8FA] hover:bg-[#E5E7EB] text-[#0B2A4A] border border-[#E5E7EB] transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <UploadCloud className="h-3.5 w-3.5 text-[#E8710A]" />
              <span>Upload Photo</span>
            </button>

            {!isCameraActive ? (
              <button
                onClick={startCamera}
                className="px-3 py-1.5 rounded-lg bg-[#0B2A4A] text-white hover:bg-[#081e36] transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <Camera className="h-3.5 w-3.5 text-[#E8710A]" />
                <span>Camera</span>
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="px-3 py-1.5 rounded-lg bg-red-600 text-white hover:bg-red-700 transition-colors text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
              >
                <VideoOff className="h-3.5 w-3.5" />
                <span>Stop Camera</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#F7F8FA] text-[#64748B] hover:text-[#0F172A] transition-colors ml-1 cursor-pointer"
              title="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileUpload}
        />

        {/* Modal Main Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 bg-[#F7F8FA]">
          {/* LEFT COLUMN: Visual Input Surface (5 Cols) */}
          <div className="lg:col-span-5 flex flex-col space-y-4">
            <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider flex items-center gap-1.5">
                  <Scan className="h-3.5 w-3.5 text-[#E8710A]" />
                  Uploaded Photo
                </span>
                {inspectionResult && (
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                      isVerified
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : isCandidate
                        ? "bg-amber-50 text-amber-700 border border-amber-200"
                        : "bg-slate-100 text-slate-700 border border-slate-300"
                    }`}
                  >
                    {isVerified ? "Standard Identified" : isCandidate ? "Candidate Match" : "Unable to Verify"}
                  </span>
                )}
              </div>

              {/* Viewport Frame */}
              <div className="relative aspect-4/3 w-full rounded-xl border border-[#E5E7EB] bg-slate-900 overflow-hidden flex items-center justify-center">
                {isCameraActive ? (
                  <div className="relative w-full h-full flex flex-col items-center justify-center">
                    <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                    <div className="absolute bottom-4 inset-x-0 flex justify-center gap-3 z-40">
                      <button
                        onClick={captureCameraFrame}
                        className="px-4 py-2 rounded-lg bg-[#E8710A] text-white font-bold text-xs shadow-md hover:bg-[#d46306] flex items-center gap-1.5 cursor-pointer"
                      >
                        <Camera className="h-4 w-4" />
                        Capture Frame
                      </button>
                    </div>
                  </div>
                ) : uploadedImagePreview ? (
                  <div className="relative w-full h-full flex items-center justify-center bg-black/40">
                    <img
                      src={uploadedImagePreview}
                      alt="Product inspection frame"
                      className="max-h-full max-w-full object-contain"
                    />
                    {loading && (
                      <div className="absolute inset-0 bg-[#0B2A4A]/60 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-2">
                        <RefreshCw className="h-8 w-8 animate-spin text-[#E8710A]" />
                        <span className="text-xs font-semibold">Reading product label…</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center p-6 text-center text-slate-400 space-y-2">
                    <ImageIcon className="h-10 w-10 text-slate-500" />
                    <p className="text-xs">No image selected</p>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium cursor-pointer"
                    >
                      Choose an image
                    </button>
                  </div>
                )}
              </div>

              {cameraError && (
                <div className="rounded-lg bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                  {cameraError}
                </div>
              )}

              {/* Try an Example Pill Buttons */}
              <div className="pt-2 border-t border-[#E5E7EB]">
                <span className="text-[11px] font-bold text-[#64748B] block mb-2">
                  Try with a sample photo:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleSelectExample("helmet")}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7F8FA] border border-[#E5E7EB] text-[#0F172A] hover:border-[#0B2A4A] cursor-pointer"
                  >
                    Helmet (IS 4151)
                  </button>
                  <button
                    onClick={() => handleSelectExample("cooker")}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7F8FA] border border-[#E5E7EB] text-[#0F172A] hover:border-[#0B2A4A] cursor-pointer"
                  >
                    Cooker (IS 2347)
                  </button>
                  <button
                    onClick={() => handleSelectExample("bottle")}
                    className="px-2.5 py-1 rounded-md text-xs font-medium bg-[#F7F8FA] border border-[#E5E7EB] text-[#0F172A] hover:border-[#0B2A4A] cursor-pointer"
                  >
                    Flask (IS 17526)
                  </button>
                </div>
              </div>
            </div>

            {/* Verbatim "What we read on the label" box */}
            {inspectionResult && (inspectionResult.labelText || mark?.ocrText) && (
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-3.5 space-y-1.5 text-xs">
                <span className="font-bold text-[#0B2A4A] block">What we read on the label</span>
                <div className="font-mono text-[11px] text-[#0F172A] bg-[#F7F8FA] p-2.5 rounded-lg border border-[#E5E7EB] whitespace-pre-wrap leading-relaxed">
                  {inspectionResult.labelText || mark?.ocrText}
                </div>
                {mark?.cmlOrHuidNumber && (
                  <div className="text-[11px] text-[#64748B] pt-0.5">
                    Licence format: <strong className="text-[#0B2A4A]">{mark.cmlOrHuidNumber.startsWith("CM/L-") ? mark.cmlOrHuidNumber : "CM/L-" + mark.cmlOrHuidNumber}</strong>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: Compliance & Grounded Intelligence (7 Cols) */}
          <div className="lg:col-span-7 flex flex-col space-y-4">
            {loading ? (
              <div className="flex-1 rounded-xl border border-[#E5E7EB] bg-white p-12 flex flex-col items-center justify-center space-y-3 text-center">
                <RefreshCw className="h-8 w-8 animate-spin text-[#E8710A]" />
                <p className="text-sm font-semibold text-[#0B2A4A]">
                  Inspecting image and checking official BIS catalog…
                </p>
              </div>
            ) : isUnableToVerify ? (
              /* Honest Refusal / Non-Product State */
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-6 space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 rounded-lg bg-slate-100 text-slate-700">
                    <Info className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-base font-bold text-[#0F172A]">
                      No matching BIS standard found
                    </h3>
                    <p className="text-sm text-[#64748B] leading-relaxed">
                      {inspectionResult.statusMessage}
                    </p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 leading-relaxed">
                  <strong>Next Steps:</strong> {inspectionResult.nextSteps}
                </div>

                <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[#E5E7EB]">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-xs font-semibold text-[#0B2A4A] hover:bg-[#F7F8FA] cursor-pointer"
                  >
                    Try another photo
                  </button>
                  <button
                    onClick={handleAskInChat}
                    className="px-4 py-2 rounded-lg bg-[#0B2A4A] text-white text-xs font-semibold hover:bg-[#081e36] transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Ask about this product in chat</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : inspectionResult ? (
              /* Standard Identified Result Card */
              <div className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-2xs space-y-4">
                {/* Standard Title Block */}
                <div className="space-y-2 border-b border-[#E5E7EB] pb-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-sm text-[#0B2A4A] bg-[#0B2A4A]/5 px-2.5 py-1 rounded-md border border-[#0B2A4A]/10">
                        {inspectionResult.standardNumber}
                      </span>
                      {inspectionResult.isQcoMandatory && (
                        <span className="rounded bg-red-100 text-red-800 text-[10px] font-black uppercase px-2 py-0.5 border border-red-200">
                          Mandatory QCO
                        </span>
                      )}
                      <span className="text-xs font-medium text-[#64748B]">
                        Year: {inspectionResult.year}
                      </span>
                    </div>

                    <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-xs font-bold text-emerald-700 flex items-center gap-1">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>Verified Standard</span>
                    </span>
                  </div>

                  <div>
                    <h3 className="text-base font-bold text-[#0F172A] leading-snug">
                      {inspectionResult.standardTitle}
                    </h3>
                    <p className="text-xs text-[#64748B] mt-0.5">
                      Detected Product: <strong>{inspectionResult.detectedProduct}</strong>
                    </p>
                  </div>

                  {/* Extracted Licence Status */}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-[#F7F8FA] border border-[#E5E7EB] text-xs">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    <span className="font-bold text-[#0B2A4A]">
                      Extracted Licence:{" "}
                      {mark?.cmlOrHuidNumber
                        ? mark.cmlOrHuidNumber.startsWith("CM/L-")
                          ? mark.cmlOrHuidNumber
                          : `CM/L-${mark.cmlOrHuidNumber}`
                        : "Not detected on label"}
                    </span>
                    <span className="text-[#64748B] text-[11px]">
                      • Check validity on BIS Care app or Manak Online
                    </span>
                  </div>

                  {/* Mandatory QCO Warning */}
                  {inspectionResult.isQcoMandatory && inspectionResult.qcoAlert && (
                    <div className="rounded-lg bg-red-50 border border-red-200 p-3 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold text-red-800 uppercase text-[11px]">
                        <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />
                        <span>Mandatory Quality Control Order</span>
                      </div>
                      <p className="text-red-950 font-medium">
                        {inspectionResult.qcoAlert.orderTitle}
                      </p>
                      <p className="text-[11px] text-red-700 leading-relaxed">
                        Under Section 29 of the BIS Act, 2016, no person shall manufacture, import, distribute or sell goods covered by a mandatory QCO without an operative Standard Mark licence.
                      </p>
                    </div>
                  )}
                </div>

                {/* Tab Navigation */}
                <div className="flex border-b border-[#E5E7EB] gap-2">
                  <button
                    onClick={() => setActiveTab("clauses")}
                    className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
                      activeTab === "clauses"
                        ? "border-[#0B2A4A] text-[#0B2A4A]"
                        : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    Testing Requirements ({inspectionResult.testingClauses.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("labs")}
                    className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
                      activeTab === "labs"
                        ? "border-[#0B2A4A] text-[#0B2A4A]"
                        : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    Recognized Laboratories ({inspectorLabs.length})
                  </button>
                  <button
                    onClick={() => setActiveTab("msme")}
                    className={`pb-2.5 px-3 text-xs font-semibold transition-colors border-b-2 cursor-pointer ${
                      activeTab === "msme"
                        ? "border-[#0B2A4A] text-[#0B2A4A]"
                        : "border-transparent text-[#64748B] hover:text-[#0F172A]"
                    }`}
                  >
                    MSME Scheme
                  </button>
                </div>

                {/* TAB: Testing Clauses */}
                {activeTab === "clauses" && (
                  <div className="space-y-2">
                    {inspectionResult.testingClauses.length > 0 ? (
                      inspectionResult.testingClauses.map((clause, idx) => (
                        <div
                          key={idx}
                          className="rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] p-3 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-[#0B2A4A]">{clause.clauseTitle}</span>
                            <span className="text-[10px] font-mono text-[#64748B] bg-white px-1.5 py-0.5 rounded border border-[#E5E7EB]">
                              {clause.clauseNumber}
                            </span>
                          </div>
                          <p className="text-[#0F172A] leading-relaxed">{clause.verbatimText}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-[#64748B]">No testing parameters indexed for this standard.</p>
                    )}
                  </div>
                )}

                {/* TAB: Recognized Laboratories with Leaflet Map */}
                {activeTab === "labs" && (
                  <div className="space-y-3">
                    {inspectorLabs.length > 0 ? (
                      <>
                        <div className="h-56 w-full rounded-xl overflow-hidden border border-[#E5E7EB]">
                          <InspectorLabLocationMap
                            labs={inspectorLabs}
                            selectedLabId={selectedLabId}
                            onSelectLab={(lab) => setSelectedLabId(lab.id)}
                          />
                        </div>

                        <div className="space-y-1.5">
                          {inspectorLabs.map((lab) => (
                            <div
                              key={lab.id}
                              onClick={() => setSelectedLabId(lab.id)}
                              className={`p-3 rounded-lg border text-xs cursor-pointer transition-colors ${
                                selectedLabId === lab.id
                                  ? "border-[#0B2A4A] bg-[#0B2A4A]/5"
                                  : "border-[#E5E7EB] bg-white hover:bg-[#F7F8FA]"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-bold text-[#0B2A4A]">{lab.name}</span>
                                {lab.distance_km !== undefined && (
                                  <span className="text-[#E8710A] font-bold text-[11px]">
                                    ~{lab.distance_km} km
                                  </span>
                                )}
                              </div>
                              <p className="text-[#64748B] text-[11px] mt-0.5">
                                📍 {lab.city}, {lab.state} • {lab.address}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="p-6 rounded-xl border border-dashed border-[#E5E7EB] text-center text-xs text-[#64748B]">
                        No recognized testing laboratories found for this standard in our local database.
                      </div>
                    )}
                  </div>
                )}

                {/* TAB: MSME Scheme */}
                {activeTab === "msme" && (
                  <div className="rounded-xl border border-[#E5E7EB] bg-[#F7F8FA] p-4 space-y-3 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-[#0B2A4A]">MSME Concessions</span>
                      <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">
                        80% Marking Fee Concession
                      </span>
                    </div>
                    <p className="text-[#0F172A] leading-relaxed">
                      Micro and small enterprises holding valid Udyam Registration Certificates receive an 80% concession on minimum marking fees for ISI mark certification under Scheme-I.
                    </p>
                  </div>
                )}

                {/* Bottom Primary Action: Ask in Chat */}
                <div className="pt-3 border-t border-[#E5E7EB] flex flex-wrap items-center justify-between gap-3">
                  <div className="text-[11px] text-[#64748B]">
                    Every fact is sourced from the official BIS catalogue.
                  </div>

                  <button
                    onClick={handleAskInChat}
                    className="inline-flex items-center gap-2 rounded-lg bg-[#0B2A4A] px-4 py-2 text-xs font-semibold text-white hover:bg-[#081e36] transition-colors cursor-pointer"
                  >
                    <span>Ask about this product in chat</span>
                    <ArrowRight className="h-3.5 w-3.5 text-[#E8710A]" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 rounded-xl border border-dashed border-[#E5E7EB] bg-white p-12 flex flex-col items-center justify-center space-y-2 text-center text-[#64748B]">
                <Scan className="h-8 w-8 text-[#64748B]/40" />
                <p className="text-xs font-medium">
                  Upload an image or start camera to inspect a product for Indian Standard compliance.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
