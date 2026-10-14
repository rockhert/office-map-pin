"use client";

import { useEffect, useRef, useState } from "react";
import maps from "../maps.json";

// pin.png(119x256)の針先の位置
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PIN_W = 119;
const PIN_H = 256;
const TIP_X = 55;

// 元画像サイズに対するピンの高さ（画面表示と保存画像で共通）
const pinHeightFor = (w: number, h: number) => Math.min(160, Math.max(60, Math.min(w, h) * 0.14));

// iPadOS は Mac と名乗るため、タッチ対応かどうかも見る
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

export default function Page() {
  const [file, setFile] = useState((maps.find((m) => m.name === "梅田") ?? maps[0])?.file ?? "");
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [shown, setShown] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const pinRef = useRef<HTMLImageElement | null>(null);
  const current = maps.find((m) => m.file === file);

  useEffect(() => {
    // 保存時にすぐ使えるよう、ピン画像を先に読み込んでおく
    const pin = new Image();
    pin.src = `${BASE}/pin.png`;
    pinRef.current = pin;
  }, []);

  useEffect(() => {
    const el = imgRef.current;
    if (!el) return;
    // 読み込みが画面の準備より先に終わっていた場合に備える
    if (el.complete && el.naturalWidth) setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    const ro = new ResizeObserver(() => setShown({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, [file]);

  const onLoad = () => {
    const el = imgRef.current!;
    setNatural({ w: el.naturalWidth, h: el.naturalHeight });
    setShown({ w: el.clientWidth, h: el.clientHeight });
  };

  const place = (e: React.MouseEvent<HTMLImageElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
  };

  const save = async () => {
    const img = imgRef.current;
    if (!img || !current) return;
    const { naturalWidth: w, naturalHeight: h } = img;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(img, 0, 0);
    if (pos) {
      const pin = pinRef.current!;
      await pin.decode();
      const ph = pinHeightFor(w, h);
      const pw = (ph * PIN_W) / PIN_H;
      ctx.drawImage(pin, pos.x * w - (ph * TIP_X) / PIN_H, pos.y * h - ph, pw, ph);
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) return;
    const fileName = `${current.name}.png`;

    // iPhone / iPad は共有メニュー（「画像を保存」が選べる）を使う
    const file = new File([blob], fileName, { type: "image/png" });
    if (isIOS() && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        return;
      } catch (e) {
        if ((e as Error).name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = fileName;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  };

  const scale = natural.w ? shown.w / natural.w : 0;
  const ph = pinHeightFor(natural.w, natural.h) * scale;
  const pw = (ph * PIN_W) / PIN_H;

  const btn: React.CSSProperties = { padding: "8px 16px", borderRadius: 8, border: "1px solid #c8cdd3", background: "#fff", cursor: "pointer", fontSize: 14 };

  return (
    <main style={{ maxWidth: 1200, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <h1 style={{ fontSize: 18, margin: 0 }}>オフィスマップ</h1>
        <select
          value={file}
          onChange={(e) => { setFile(e.target.value); setPos(null); }}
          style={{ ...btn, minWidth: 160 }}
          aria-label="オフィスを選ぶ"
        >
          {maps.map((m) => (
            <option key={m.file} value={m.file}>{m.name}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button style={btn} onClick={() => setPos(null)} disabled={!pos}>ピンを消す</button>
        <button style={{ ...btn, background: "#0969da", color: "#fff", borderColor: "#0969da" }} onClick={save}>PNGで保存</button>
      </div>

      {current ? (
        <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", lineHeight: 0, background: "#fff", border: "1px solid #d0d7de" }}>
          <img
            key={file}
            ref={imgRef}
            src={`${BASE}/maps/${encodeURIComponent(current.file)}`}
            alt={`${current.name}のマップ`}
            onLoad={onLoad}
            onClick={place}
            style={{ maxWidth: "100%", maxHeight: "80vh", cursor: "crosshair", display: "block" }}
          />
          {pos && scale > 0 && (
            <img
              src={`${BASE}/pin.png`}
              alt="ピン"
              style={{
                position: "absolute",
                pointerEvents: "none",
                left: pos.x * shown.w - (ph * TIP_X) / PIN_H,
                top: pos.y * shown.h - ph,
                width: pw,
                height: ph,
              }}
            />
          )}
        </div>
      ) : (
        <p>maps フォルダに画像を入れてください。</p>
      )}
    </main>
  );
}
