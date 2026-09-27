import { NextRequest, NextResponse } from "next/server";
import { inspectProductImage, inspectWithSovereignRules } from "@/lib/vision-inspector";

export async function POST(req: NextRequest) {
  try {
    let payload: any = {};
    const contentType = req.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      payload = await req.json().catch(() => ({}));
    } else if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const file = formData.get("file") as File | null;
      const exampleType = (formData.get("exampleType") as string) || undefined;
      const userCity = (formData.get("userCity") as string) || undefined;
      const latStr = formData.get("userLat") as string | null;
      const lngStr = formData.get("userLng") as string | null;

      let userLocation: { lat: number; lng: number } | undefined = undefined;
      if (latStr && lngStr) {
        const lat = parseFloat(latStr);
        const lng = parseFloat(lngStr);
        if (!isNaN(lat) && !isNaN(lng)) {
          userLocation = { lat, lng };
        }
      }

      if (file) {
        const buffer = await file.arrayBuffer();
        const base64 = Buffer.from(buffer).toString("base64");
        payload = {
          imageBase64: base64,
          mimeType: file.type || "image/jpeg",
          filename: file.name,
          exampleType,
          userCity,
          userLocation,
        };
      } else {
        payload = { exampleType, userCity, userLocation };
      }
    }

    if (!payload.imageBase64 && !payload.exampleType) {
      return NextResponse.json(
        { error: "No image or example type provided for inspection." },
        { status: 400 }
      );
    }

    const result = await inspectProductImage(payload);

    return NextResponse.json({
      success: true,
      result,
    });
  } catch (error: any) {
    console.error("[API v8 vision/inspect] Error processing image:", error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || "Failed to inspect image",
      },
      { status: 500 }
    );
  }
}
