# Announcing 実装プラン

> 本ドキュメントはサービス「Announcing」の実装プラン（確定版 v1）。
> 背景・思想の詳細は `.temp/idea.md`（git管理外）を参照。本書はその要点と、会話で確定した意思決定・設計を含む。

## 1. プロダクト概要

非営利・寄付モデルの「お知らせ配信」サービス。自治体・企業・サービスなどが、SNSのロックインや広告・トラッキングなしに、ターゲットへ周知できる場を提供する。SNSを置き換えるのではなく**補完**する。

**思想（不変の前提）**

- 広告なし / 寄付モデルで運営
- トラッキングは可能な限り行わない
- 読む人はアカウント登録不要
- いいね / インプレッション機能は作らない（拡散・競争を煽らない）
- 個人情報は可能な限り保存しない
- 世界中で使える（多言語・地域分散）

**ターゲット**

- 読む人: SNSが苦手 / 広告にうんざり / 情報漏洩・行動監視に敏感 / 通知やアプリを増やしたくない
- 書く人: 公式SNSアカウントやHPのお知らせページを補完したい組織（自治体・企業・サービス）

## 2. 確定した意思決定

| 項目 | 決定 |
|---|---|
| MVP方針 | 最小で動かす（ただし下記フェーズで全機能へ段階的に拡張） |
| 認証 | Google SSO のみ（実装は arctic + 自前セッション。将来 IdP は自前追加） |
| 保存する個人情報 | `google_sub`（不変ID）+ 表示名のみ。メール・氏名・写真は保存しない |
| 投稿 | 長さ自由・画像複数・**プレーンテキスト + 自動リンク**（Markdown非対応・動画なし） |
| チャンネル運営 | **複数人運営**（メンバー + 権限 + 招待フロー） |
| データ配置 | **最初から地域分散**・**大陸リージョン単位**（Cloudflare location hint 準拠） |
| 多言語 | i18n基盤を最初から導入（ja / en で開始） |
| ドメイン | `announcing.app` 取得済・Cloudflare管理 → `*.announcing.app` 構成可 |
| グローバル制御層 | **D1 一本**（プライマリ EU=weur 管轄 + read replication）。KVは当面なし |
| チャンネルのデータ層 | **チャンネル = Durable Object(SQLite) 中心**（per-channel・location-hinted） |

## 3. アーキテクチャ

### 3.1 2層構造

地域分散は「グローバル制御層」と「リージョンデータ層」の2層で実現する。

**グローバル制御層（どこからでも同一・個人データ最小）**

- `users`: `google_sub`, `display_name` のみ
- `sessions`: セッション失効管理用（`session_id`, `user_id`, `expires_at`）
- `channels` レジストリ: `subdomain → channelId + region + ownerUserId`（**サブドメイン一意性の保証点**）
- `memberships` 索引: `userId ↔ channelId, role`（ユーザーの所属チャンネル一覧を1クエリで出すため）

実装: **D1 一本**。プライマリは **EU管轄（weur）** に置き、個人データ（`users`/`sessions`）を最も厳しい基準で一元管理 → 非EUユーザー分も包含的に GDPR セーフ。read replication（D1 Sessions API）で各地から低レイテンシ読み取り。サブドメイン解決はさらに Cache を併用。KV は運用コスト最小化のため当面導入せず、必要になってから前段に追加する。

> メンバー権限の source of truth は **ChannelDO 側**（下記）。グローバルの `memberships` はダッシュボード表示用の索引であり、権限判定はチャンネル操作時に ChannelDO で検証する。

**リージョンデータ層（チャンネルの所属大陸）**

- `ChannelDO`（チャンネルごとに1つの Durable Object + SQLite, **location-hinted**）: 投稿本体・メンバー権限・チャンネル設定・通報。**強整合の書き込み先**
- R2（リージョン配置）: 画像バイナリ。EUは `jurisdiction='eu'`、他大陸は location hint
- EUチャンネルの DO は `jurisdiction='eu'` で生成（EU域内保証）、他大陸は `locationHint`

### 3.2 Cloudflare プリミティブの役割

| プリミティブ | 用途 |
|---|---|
| Workers + SvelteKit | SSR + API（`@sveltejs/adapter-cloudflare`） |
| Durable Objects (SQLite) | チャンネル = 1 DO。投稿・メンバー・設定・通報の source of truth |
| D1 | グローバル制御層（users / sessions / channels レジストリ / memberships 索引） |
| R2 | 画像（リージョン別 / EU jurisdiction） |
| Workflows | 予約公開・push配信ファンアウト・通報処理などの非同期処理 |
| Cache (Cache API / Rules) | immutable な公開コンテンツのエッジ配信 |

### 3.3 データフロー

**書き込み（投稿作成）**: 認証済みユーザー → Worker → グローバルD1で権限/リージョン解決 → チャンネルのリージョンの `ChannelDO` に書き込み（DOは単一ロケーションで直列化・強整合）→ 画像は同リージョンR2へ。

**読み取り（公開閲覧）**: `{channel}.announcing.app` → Worker → D1(replica)+Cache でチャンネル解決 → **immutable URL**（例 `/posts/{postId}` は内容不変）→ Cacheヒットならエッジから即返却。ミス時のみ ChannelDO から取得・レンダリングし長期キャッシュ。**読む人は完全に非トラッキング・登録不要**。

### 3.4 サブドメイン / DNS / TLS

- `*.announcing.app` ワイルドカード。Cloudflare管理済みのため、ワイルドカードDNS + Workers Routes（`*.announcing.app/*`）。TLSはCloudflareのワイルドカードでカバーされTotal TLSで補完。
- ドメイン分離（案）:
  - `announcing.app` / `www`: ランディング
  - `app.announcing.app`: 書く人のダッシュボード（認証あり）
  - `{channel}.announcing.app`: 公開チャンネル（認証なし・キャッシュ配信）
- 予約サブドメイン: `www`, `app`, `api`, `static`, `assets`, `admin`, `mail`, 等はチャンネル名として禁止。

### 3.5 認証 / セッション

- Google OAuth (OIDC) を **arctic** で実装。将来 GitHub/Apple は arctic の各 provider で自前追加。
- セッションは自前管理: グローバルD1の `sessions` に最小情報を保持（失効可能）。Cookie は `session_id` を HttpOnly / Secure / SameSite=Lax で発行。
- 保存するユーザー情報は `google_sub` + `display_name` のみ（初回ログイン時に表示名を設定）。

### 3.6 多言語（i18n）

- UI文字列を最初から外部化（候補: paraglide-js などの型安全・軽量i18n）。`ja` / `en` で開始。
- 公開ページの言語は チャンネル/ユーザー設定 + `Accept-Language` で決定。

## 4. リポジトリ構成（案）

pnpm workspace モノレポ。

```
apps/web            SvelteKit（SSR + API + ダッシュボード + 公開ページ）
packages/core       ドメインロジック・共有型
packages/db         スキーマ/マイグレーション（D1 + DO SQLite）
infra/              wrangler 設定・bindings（DO / D1 / R2 / Workflows）
```

ツール: antfu/eslint-config, vitest（単体）, playwright（E2E）, wrangler。

## 5. フェーズ計画

```
Phase 0  基盤
Phase 1  コア（最小で動くもの）
Phase 2  配信（RSS + 下書き/予約）
Phase 3  健全性（通報 + モデレーション）
Phase 4  通知（Web push）
Phase 5  運営（寄付・分析最小・運用）
```

### Phase 0 — 基盤 ✅（完了）

- [x] pnpm workspace モノレポ初期化
- [x] SvelteKit + `adapter-cloudflare` セットアップ
- [x] antfu/eslint-config / vitest / playwright 導入
- [x] wrangler 設定・bindings 雛形（DO / D1 / R2 / Workflows）
- [x] i18n基盤（ja/en）導入
- [x] CI（lint / typecheck / test）
- [x] ローカル開発環境（wrangler dev / miniflare）

**実装メモ（Phase 0 で確定した事項）**

- **DO/Workflow は専用ワーカー `apps/backend` に分離**。`apps/web`（SvelteKit）から `script_name`
  でクロスワーカー binding する。理由: adapter-cloudflare は default export しか出さないため、
  DO/Workflow の named export をプラグイン依存で混ぜる代わりに、第一者primitivesのみで階層分離。
- **Node >=22 必須**（最新 wrangler/vite の要件）。`.node-version` = `24`、CI も `.node-version` 準拠。
- **`apps/web` は `nodejs_compat` フラグ必須**（paraglide の SSR が `node:async_hooks` を使う）。
- 構成: `apps/web`（SvelteKit Worker）/ `apps/backend`（DO+Workflow Worker）/ `packages/core`
  （ドメイン・型）/ `packages/db`（D1スキーマ・型）/ `infra/`（プロビジョニング手順）。
- Cloudflare リソースは未作成（wrangler.jsonc は **プレースホルダID**）。`infra/provision.sh` で作成し、
  出力された D1 `database_id` を両 wrangler.jsonc に貼る。

### Phase 1 — コア（最小で動くもの） ✅（完了）

- [x] グローバルD1スキーマ: `users` / `sessions` / `channels` / `memberships`
- [x] Google OAuth（arctic）+ セッション（+ ローカル開発用ログイン）
- [x] チャンネル作成: サブドメイン一意性チェック + 予約語 + リージョン選択（大陸）
- [x] `ChannelDO`(SQLite) スキーマ: `posts` / `members` / `settings`（+ `invites`）
- [x] DO の location hint / jurisdiction による地域配置
- [x] メンバー管理: 権限（owner / editor）+ 招待フロー
- [x] 投稿作成/編集/削除（プレーンテキスト + 自動リンク + 画像複数 → R2）
- [x] 公開チャンネルページ `{channel}.announcing.app`（Cache API キャッシュ配信）
- [x] ダッシュボード `app.announcing.app`

**実装メモ（Phase 1 で確定した事項）**

- **ホストベースルーティング**: 単一の web ワーカーが `reroute` フック（`src/hooks.ts`）で
  3面を配信する。`app.{base}` → `/app/*`、`{channel}.{base}` → `/c/{channel}/*`、apex → landing。
  ローカルは `*.localhost` で本番同型（`localhost:5173` / `app.localhost:5173` / `{ch}.localhost:5173`）。
  本番の base は wrangler vars `PUBLIC_BASE_HOST`。
- **ローカル開発は2プロセス**: `pnpm dev`（web, vite）+ `pnpm dev:backend`（backend, wrangler dev）。
  dev registry 経由でクロスワーカー DO RPC が解決される。e2e / preview は
  マルチconfig `wrangler dev -c wrangler.jsonc -c ../backend/wrangler.jsonc`（1プロセス）。
- **DO RPC の失敗は値で返す**（`ChannelResult<T> = {ok:true,value} | {ok:false,code}`、契約は
  core の `ChannelApi`）。throw は miniflare の dev registry プロキシを通らない（assertion 死）ため。
  本番でもエラーメッセージ文字列へのトンネリング依存が消えるので採用。
- **権限判定は常に ChannelDO 内**（caller userId を渡して members テーブルで検証）。D1 の
  `memberships` は「自分のチャンネル一覧」用インデックスで、DO 操作成功後に web が同期する。
- **CONTINENTS は Cloudflare 公式 location hint に一致**させた（`afr`/`wnam` 含む9種。
  Phase 0 の `af` 8種は API と不一致だった）。`weur`/`eeur` は `jurisdiction: 'eu'` で DO 生成、
  他は `locationHint`。**jurisdiction はローカル workerd 未実装**のため dev のみ平常 namespace に
  フォールバック（`lib/server/channel.ts`、該当エラー時のみ・警告ログ付き）。
- **認証**: Google OIDC は scope `openid` のみ（保存は `google_sub` だけ・profile も取らない）。
  表示名は初回ログイン後の onboarding で本人入力。セッションは D1 に sha256(token) を保存、
  Cookie はダッシュボードホストのみ（公開ページは Cookie レス維持）。開発用ログイン
  （`dev:{name}` ユーザー）は vite dev で自動有効、built 環境では `DEV_AUTH=1`（.dev.vars / --var）。
- **招待**: URL は `/invites/{channelId}.{secret}`。DO には sha256 のみ保存・7日期限・1回使い切り。
  リンクは作成直後に1度だけ表示。
- **公開ページのキャッシュ**: Cache API（hooks）+ `cache-control: public, max-age=60`。
  画像は immutable（imageId 一意）。投稿 URL の rev 付き immutable 化とパージは Phase 2 の
  revision 設計と一緒に行う。公開ページの言語はチャンネル設定の locale（Accept-Language 非依存で
  キャッシュ安定・読者トラッキングなし）。
- **D1 マイグレーション**: `packages/db/migrations/d1` を両 wrangler.jsonc の `migrations_dir` に設定。
  ローカルは `pnpm db:migrate`（`pnpm dev` / `pnpm preview` が自動実行）。

### Phase 2 — 配信

- [ ] RSS / Atom フィード生成（公開・キャッシュ可）
- [ ] 投稿状態 `draft / scheduled / published`
- [ ] 予約公開（Workflows によるスケジュール実行）

### Phase 3 — 健全性

- [ ] 投稿の通報受付（読む人は登録不要で報告可能）
- [ ] モデレーションUI（チャンネル運営者 / 運営）
- [ ] 通報処理フロー（Workflows）

### Phase 4 — 通知

- [ ] Service Worker + Web Push 購読管理（VAPID）
- [ ] 配信ファンアウト（Workflows）
- [ ] 購読は登録不要（push購読のみで読む人を追跡しない設計）

### Phase 5 — 運営

- [ ] 寄付 / 決済（要選定）
- [ ] 最小限の分析（非個人・集計のみ）
- [ ] 運用ダッシュボード

## 6. 横断的な決定事項

- チャンネルのリージョンは **作成後は変更不可**（データ移行を伴うため）。
- 投稿の公開URLは **immutable**（内容変更時は新リビジョン or キャッシュパージ）。
- 読む人に対する Cookie / トラッキングは設定しない（公開ページは完全キャッシュ可能に保つ）。
- 画像はサーバ側でサイズ・形式を検証（詳細は実装時）。

## 7. 未決事項（今後詰める）

- [ ] 寄付 / 決済プロバイダの選定（Stripe 等）と非営利運営との整合（Phase 5）
- [ ] モデレーションの運用主体・基準（チャンネル運営者 vs サービス運営）
- [ ] i18n ライブラリの最終選定
- [ ] 画像処理（リサイズ/最適化）に Cloudflare Images を使うか自前か
- [ ] EU read replica における個人データ複製範囲の厳密設計（非個人データのみレプリカ等）
- [ ] チャンネルの命名規約・予約語の最終リスト
- [ ] アカウント削除 / データ削除（GDPR「忘れられる権利」）フロー
