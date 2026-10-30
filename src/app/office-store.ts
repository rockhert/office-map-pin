// Android アプリ版だけで使う、スマホ内へのオフィス追加・削除の保存処理
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";

export type CustomOffice = { id: string; name: string; file: string; mime: string };
// custom: 追加したオフィス / hidden: 非表示にした最初からある拠点（ファイル名）
export type OfficeStore = { custom: CustomOffice[]; hidden: string[] };

const DIR = "offices";
const INDEX = `${DIR}/index.json`;
const EMPTY: OfficeStore = { custom: [], hidden: [] };

export const loadStore = async (): Promise<OfficeStore> => {
  try {
    const { data } = await Filesystem.readFile({ path: INDEX, directory: Directory.Data, encoding: Encoding.UTF8 });
    return { ...EMPTY, ...JSON.parse(data as string) };
  } catch {
    return EMPTY;
  }
};

export const saveStore = async (store: OfficeStore) => {
  await Filesystem.writeFile({
    path: INDEX,
    data: JSON.stringify(store),
    directory: Directory.Data,
    encoding: Encoding.UTF8,
    recursive: true,
  });
};

// 画面表示とPNG保存の両方で使えるよう、data URL で返す
export const readImage = async (office: CustomOffice) => {
  const { data } = await Filesystem.readFile({ path: `${DIR}/${office.file}`, directory: Directory.Data });
  return `data:${office.mime};base64,${data}`;
};

const fileToBase64 = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1]);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

export const addOffice = async (store: OfficeStore, name: string, image: File) => {
  const id = Date.now().toString(36);
  const ext = image.type.split("/")[1]?.replace("jpeg", "jpg") || "img";
  const office: CustomOffice = { id, name, file: `${id}.${ext}`, mime: image.type };
  await Filesystem.writeFile({ path: `${DIR}/${office.file}`, data: await fileToBase64(image), directory: Directory.Data, recursive: true });
  const next = { ...store, custom: [...store.custom, office] };
  await saveStore(next);
  return { store: next, office };
};

export const deleteCustomOffice = async (store: OfficeStore, id: string) => {
  const office = store.custom.find((o) => o.id === id);
  if (office) await Filesystem.deleteFile({ path: `${DIR}/${office.file}`, directory: Directory.Data }).catch(() => {});
  const next = { ...store, custom: store.custom.filter((o) => o.id !== id) };
  await saveStore(next);
  return next;
};
