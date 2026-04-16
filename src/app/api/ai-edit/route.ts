import { NextRequest, NextResponse } from "next/server";

const REPLICATE_BASE = "https://api.replicate.com/v1";

function getToken() {
  return process.env.REPLICATE_API_TOKEN ?? "";
}

function headers() {
  return {
    Authorization: `Bearer ${getToken()}`,
    "Content-Type": "application/json",
  };
}

// POST — create prediction (img2img via SDXL)
export async function POST(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN not configured" },
      { status: 503 },
    );
  }

  const { image, subject } = (await req.json()) as {
    image: string;
    subject: string;
  };

  const prompt = [
    `high quality photograph, exact same image,`,
    `${subject} wearing a blue baseball cap with $MTONGA text,`,
    "same pose, same background, same lighting, same framing,",
    "slightly soften edges of the cap, subtle shadow under cap,",
    "photorealistic, keep everything identical",
  ].join(" ");

  const res = await fetch(`${REPLICATE_BASE}/predictions`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({
      version:
        "39ed52f2a78e934b3ba6e2a89f5b1c712de7dfea535525255b1aa35c5565e08b",
      input: {
        prompt,
        negative_prompt: [
          "different subject, different background, different pose,",
          "changed face, different person, different animal,",
          "wrong text, extra text, misspelled, watermark,",
          "cartoon, painting, illustration, low quality, blurry",
        ].join(" "),
        image,
        prompt_strength: 0.08,
        num_inference_steps: 50,
        guidance_scale: 15,
        width: 1024,
        height: 1024,
      },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    return NextResponse.json(
      { error: `Replicate error: ${res.status} ${body}` },
      { status: 502 },
    );
  }

  const prediction = await res.json();
  return NextResponse.json({ id: prediction.id, status: prediction.status });
}

// GET — poll prediction status, proxy result image to avoid CORS
export async function GET(req: NextRequest) {
  const token = getToken();
  if (!token) {
    return NextResponse.json(
      { error: "REPLICATE_API_TOKEN not configured" },
      { status: 503 },
    );
  }

  const id = req.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const res = await fetch(`${REPLICATE_BASE}/predictions/${id}`, {
    headers: headers(),
  });

  if (!res.ok) {
    return NextResponse.json(
      { error: `Replicate error: ${res.status}` },
      { status: 502 },
    );
  }

  const prediction = await res.json();

  if (prediction.status === "succeeded" && prediction.output?.[0]) {
    // Proxy the result image as base64 to avoid CORS
    const imgRes = await fetch(prediction.output[0]);
    const buffer = await imgRes.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const mime = imgRes.headers.get("content-type") ?? "image/png";
    return NextResponse.json({
      status: "succeeded",
      output: `data:${mime};base64,${base64}`,
    });
  }

  return NextResponse.json({
    status: prediction.status,
    output: null,
    error: prediction.error ?? null,
  });
}
