"use client";

import { useEffect, useRef, useState } from "react";
import { Capacitor } from "@capacitor/core";
import maps from "../maps.json";
import { addOffice, deleteCustomOffice, loadStore, readImage, saveStore, type OfficeStore } from "./office-store";

// pin.png(119x256)の針先の位置
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const PIN_W = 119;
const PIN_H = 256;
const TIP_X = 55;

// 元画像サイズに対するピンの高さ（画面表示と保存画像で共通）
const pinHeightFor = (w: number, h: number) => Math.min(160, Math.max(60, Math.min(w, h) * 0.14));

// iPadOS は Mac と名乗るため、タッチ対応かどうかも見る
const isIOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const blobToBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });

const shareInApp = async (blob: Blob, fileName: string) => {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const { Share } = await import("@capacitor/share");
  const { uri } = await Filesystem.writeFile({ path: fileName, data: await blobToBase64(blob), directory: Directory.Cache });
  try {
    await Share.share({ title: fileName, files: [uri] });
  } catch {
    // 共有メニューを閉じた場合は何もしない
  }
};

// 画面で扱うオフィス。builtin は最初から入っている拠点、custom はアプリで追加した拠点
type Office = { key: string; name: string; src: string; builtinFile?: string; customId?: string };

const BUILTIN: Office[] = maps.map((m) => ({ key: `b:${m.file}`, name: m.name, src: `${BASE}/maps/${encodeURIComponent(m.file)}`, builtinFile: m.file }));
const DEFAULT_KEY = (BUILTIN.find((o) => o.name === "梅田") ?? BUILTIN[0])?.key ?? "";

export default function Page() {
  const [selKey, setSelKey] = useState(DEFAULT_KEY);
  const [isApp, setIsApp] = useState(false);
  const [store, setStore] = useState<OfficeStore>({ custom: [], hidden: [] });
  const [customSrc, setCustomSrc] = useState<Record<string, string>>({});
  const [managing, setManaging] = useState(false);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [natural, setNatural] = useState({ w: 0, h: 0 });
  const [shown, setShown] = useState({ w: 0, h: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const pinRef = useRef<HTMLImageElement | null>(null);
  const offices: Office[] = [
    ...BUILTIN.filter((o) => !store.hidden.includes(o.builtinFile!)),
    ...store.custom.filter((c) => customSrc[c.id]).map((c) => ({ key: `c:${c.id}`, name: c.name, src: customSrc[c.id], customId: c.id })),
  ];
  const current = offices.find((o) => o.key === selKey) ?? offices[0];
  const file = current?.key ?? "";

  // Android アプリ版のときだけ、スマホ内に保存した追加・削除の内容を読み込む
  // 表示するマップが変わったらピンを外す（削除で別のマップに切り替わった場合も含む）
  useEffect(() => setPos(null), [file]);

  // NEXT_PUBLIC_FORCE_APP=1 は、ブラウザで管理画面を動作確認するための開発用スイッチ
  useEffect(() => {
    if (!Capacitor.isNativePlatform() && process.env.NEXT_PUBLIC_FORCE_APP !== "1") return;
    setIsApp(true);
    (async () => {
      const s = await loadStore();
      const srcs: Record<string, string> = {};
      for (const c of s.custom) srcs[c.id] = await readImage(c).catch(() => "");
      setCustomSrc(srcs);
      setStore(s);
    })();
  }, []);

  const select = (key: string) => {
    setSelKey(key);
    setPos(null);
  };

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
    if (el.complete && el.naturalWidth) {
      setNatural({ w: el.naturalWidth, h: el.naturalHeight });
      setShown({ w: el.clientWidth, h: el.clientHeight });
    }
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

    // Android アプリ版はダウンロードが使えないため、共有メニューから保存する
    if (Capacitor.isNativePlatform()) {
      await shareInApp(blob, fileName);
      return;
    }

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
          onChange={(e) => select(e.target.value)}
          style={{ ...btn, minWidth: 160 }}
          aria-label="オフィスを選ぶ"
        >
          {offices.map((o) => (
            <option key={o.key} value={o.key}>{o.name}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        {isApp && (
          <button style={btn} onClick={() => setManaging((v) => !v)}>{managing ? "管理を閉じる" : "オフィスを管理"}</button>
        )}
        <button style={btn} onClick={() => setPos(null)} disabled={!pos}>ピンを消す</button>
        <button style={{ ...btn, background: "#0969da", color: "#fff", borderColor: "#0969da" }} onClick={save}>PNGで保存</button>
      </div>

      {managing && (
        <ManagePanel
          offices={offices}
          store={store}
          btn={btn}
          onChange={(next, srcs, newKey) => {
            setStore(next);
            if (srcs) setCustomSrc((prev) => ({ ...prev, ...srcs }));
            if (newKey) select(newKey);
          }}
        />
      )}

      {current ? (
        <div style={{ position: "relative", display: "inline-block", maxWidth: "100%", lineHeight: 0, background: "#fff", border: "1px solid #d0d7de" }}>
          <img
            key={file}
            ref={imgRef}
            src={current.src}
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
        <p>オフィスがありません。{isApp ? "「オフィスを管理」から追加してください。" : "maps フォルダに画像を入れてください。"}</p>
      )}
    </main>
  );
}

function ManagePanel({
  offices,
  store,
  btn,
  onChange,
}: {
  offices: Office[];
  store: OfficeStore;
  btn: React.CSSProperties;
  onChange: (next: OfficeStore, srcs?: Record<string, string>, newKey?: string) => void;
}) {
  const [name, setName] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const add = async () => {
    const n = name.trim();
    if (!n) return setError("オフィス名を入力してください");
    if (offices.some((o) => o.name === n)) return setError("同じ名前のオフィスがすでにあります");
    if (!image) return setError("マップの画像を選んでください");
    if (!image.type.startsWith("image/")) return setError("画像ファイルを選んでください");
    setBusy(true);
    try {
      const { store: next, office } = await addOffice(store, n, image);
      const src = await readImage(office);
      onChange(next, { [office.id]: src }, `c:${office.id}`);
      setName("");
      setImage(null);
      if (fileRef.current) fileRef.current.value = "";
    } catch {
      setError("保存できませんでした。もう一度お試しください");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (o: Office) => {
    if (!window.confirm(`「${o.name}」を削除しますか？`)) return;
    if (o.customId) {
      onChange(await deleteCustomOffice(store, o.customId));
    } else {
      const next = { ...store, hidden: [...store.hidden, o.builtinFile!] };
      await saveStore(next);
      onChange(next);
    }
  };

  const restore = async () => {
    const next = { ...store, hidden: [] };
    await saveStore(next);
    onChange(next);
  };

  const input: React.CSSProperties = { ...btn, cursor: "text", flex: "1 1 160px", minWidth: 0 };

  return (
    <section style={{ background: "#fff", border: "1px solid #d0d7de", borderRadius: 8, padding: 16, marginBottom: 12 }}>
      <h2 style={{ fontSize: 16, margin: "0 0 12px" }}>オフィスを追加</h2>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input
          value={name}
          onChange={(e) => { setName(e.target.value); setError(""); }}
          placeholder="例：大宮"
          aria-label="オフィス名"
          style={input}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          aria-label="マップの画像"
          onChange={(e) => { setImage(e.target.files?.[0] ?? null); setError(""); }}
          style={{ flex: "1 1 200px", fontSize: 14 }}
        />
        <button style={btn} onClick={add} disabled={busy}>{busy ? "追加中…" : "追加"}</button>
      </div>
      {error && <p style={{ color: "#cf222e", fontSize: 13, margin: "8px 0 0" }}>{error}</p>}

      <h2 style={{ fontSize: 16, margin: "20px 0 8px" }}>オフィス一覧</h2>
      <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
        {offices.map((o) => (
          <li key={o.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0", borderTop: "1px solid #eaeef2" }}>
            <span style={{ flex: 1 }}>
              {o.name}
              {o.customId && <span style={{ fontSize: 12, color: "#57606a", marginLeft: 8 }}>追加分</span>}
            </span>
            <button style={{ ...btn, padding: "4px 12px", color: "#cf222e" }} onClick={() => remove(o)}>削除</button>
          </li>
        ))}
      </ul>
      {store.hidden.length > 0 && (
        <button style={{ ...btn, marginTop: 12 }} onClick={restore}>
          削除した最初の拠点（{store.hidden.length}件）を元に戻す
        </button>
      )}
    </section>
  );
}
