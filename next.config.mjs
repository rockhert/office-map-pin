// GitHub Pages では https://ユーザー名.github.io/リポジトリ名/ になるため、公開時だけ basePath を付ける
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** @type {import('next').NextConfig} */
export default { output: "export", images: { unoptimized: true }, basePath };
