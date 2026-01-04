# fortune-generator
# クマ占いジェネレーター（v1.0.0）

## 使い方
1. このフォルダ一式を GitHub リポジトリに入れる
2. GitHub Pages を有効化する
   - Settings → Pages
   - Source: `Deploy from a branch`
   - Branch: `main` / Folder: `/ (root)`
3. 発行されたURLにアクセス

## カスタムする場所（初心者向け）
- デザイン：`css/style.css`
- 文章：`js/data.js`（基本ここだけ触ればOK）
- 占い計算：`js/fortune.js`（根幹。むやみに触らないのが安全）
- UI挙動：`js/app.js`

## 素材置き場
- `assets/illust/`：クマのイラスト
- `assets/bg/`：背景
- `assets/icons/`：アイコン類
