# Modül 1 — Çekirdek API & Gerçek Zamanlı Altyapı: Mimari Tasarım

> Bu belge architect rolü tarafından üretildi (implementasyondan önce). Kod
> ilerledikçe kesin doğruluk kaynağı `api/CONTRACT.md`/`openapi.yaml` olacak;
> bu dosya tasarım gerekçesini ve implementasyon sırasını kalıcı olarak
> belgeler.

## 0. Doğrulanan mevcut durum (repo okundu)

- `api/package.json`: `type: commonjs`, sadece runtime dependency'ler var (express 5.2.1, sequelize 6.37.8, socket.io 4.8.3, jsonwebtoken, bcrypt, pg/pg-hstore, cors, dotenv). TS toolchain hiç yok. `api/src` yok.
- `docker-compose.yml`: sadece `postgres` ve `minio` servisleri var — **`api` servisi yok**, yani API'yi host makinede (`npm run dev`) çalıştıracağız, container içinde değil. Bu, MinIO endpoint konfigürasyonu için kritik bir detay (bkz. Risk #1).
- Kök `.gitignore` şimdiden `desktop/`, `mobile/` yollarına referans veriyor → monorepo'nun 7 modülü aynı repoda yaşayacak şekilde planlanmış, teyit edildi.
- **Express 5.2.1** kullanılıyor — path-to-regexp v8 tabanlı, `app.get('*')` gibi eski wildcard sözdizimini kabul etmiyor (`/*splat` gibi named wildcard gerekiyor) ve async route handler'larda throw/reject otomatik olarak error middleware'e düşüyor (express-async-handler gibi sarmalayıcılara gerek yok).

## Açık soruların çözümü (spesifikasyondan çıkarıldı, implementer bunlarla ilerlesin)

- **Tek/çoklu organizasyon**: Tek şirket, tek seed `Organization`. Spec "şirketimizin kullanacağı dahili platform" diyor — çoklu-org UI/akışı gerekmiyor, ama şema çoklu-org'u destekliyor (ileride kapatılmaz).
- **Departman hiyerarşisi**: v1'de düz liste (nested/parent-child yok).
- **Grup DM**: **GEREKLİ** — spec Modül 2'de "Birebir (DM) ve grup DM" diye açıkça listeliyor. `Channel.type='dm'` kanalları 2'den fazla üyeye sahip olabilir (isim zorunlu değil, opsiyonel). Ayrı bir `group_dm` tipi açmaya gerek yok.
- **Mobil native push**: Modül 1 kapsamı **DIŞINDA**. Modül 1 sadece socket `notification:new` event'i + kalıcı `Notification` satırı sağlar. Expo push token kaydı ve gerçek push tetikleme, Faz 5'te (Modül 4) API'ye küçük bir ek olarak gelecek — şimdiden tasarlanmıyor.
- **docker-compose'a `api` servisi eklensin mi**: **HAYIR**. Spec "DevOps bu projenin bir parçası değil, altyapıyı basit tutun" diyor. API host makinede `npm run dev` ile çalışacak; postgres+minio container'da kalıyor. Bu, MinIO endpoint kararını belirliyor: `MINIO_INTERNAL_ENDPOINT=localhost:9000` (API de host'ta çalıştığı için), `MINIO_PUBLIC_ENDPOINT` ise demo günü o makinenin LAN IP'si olacak şekilde `.env`'den yapılandırılabilir.

---

## 1. Seçilen yaklaşım ve reddedilen alternatifler

### 1.1 Migration stratejisi: sequelize-cli migration dosyaları (reddedilen: `sequelize.sync({alter:true})`)
Yedi ekip/altı modülün üzerine kurulacağı ortak bir DB şeması var; `sync({alter:true})` demo DB'sinde sessizce kolon silip tip değiştirebilir, rollback yok, hangi değişikliğin ne zaman geldiği izlenemiyor. Migration dosyaları CommonJS/JS olarak yazılacak (TS'e derletmeye gerek yok, `package.json` zaten `commonjs`), modeller ise TS. `sequelize-cli` yeni devDependency olarak eklenmeli.

### 1.2 Dosya yükleme: API üzerinden proxy upload + presigned GET download (reddedilen: uçtan uca presigned PUT/GET)
Tam presigned akış (client doğrudan MinIO'ya PUT eder) daha "production-grade" olsa da, spesifikasyon açıkça **"farklı bilgisayarlardan bağlanılacak, dağıtık demo"** diyor. Bu senaryoda client makinelerinin API'nin `host:3000` portuna ek olarak MinIO'nun `host:9000` portuna da doğrudan ağ erişimi olması gerekir — bu, demo günü kırılma riski yüksek bir bağımlılık. Bunun yerine: **upload multer ile API'ye gelir, API sunucu tarafında MinIO'ya `putObject` yapar** (MinIO hiçbir zaman client'lara doğrudan açılmaz, sadece API-MinIO arası). **Download ise presigned GET URL** ile yapılır.

### 1.3 Refresh token: hibrit JWT + DB kaydı (reddedilen: saf stateless JWT refresh, reddedilen: httpOnly-cookie-only)
Saf stateless JWT refresh token iptal edilemez. Refresh token hem JWT olarak imzalanacak hem de DB'de (`RefreshToken` tablosu, hash'lenmiş halde) tutulacak — rotation + reuse-detection mümkün olsun diye. Saklama yeri: **httpOnly cookie DEĞİL**, response body'de JSON olarak dönecek — web (Modül 2), Electron (Modül 3), Expo mobil (Modül 4) aynı sözleşmeyi (`Authorization: Bearer`) paylaşmalı.

### 1.4 Dosya/attachment ilişkisi: polymorphic `FileAttachment` join tablosu (reddedilen: her entity için ayrı join tablosu)
Tek bir `FileAttachment(fileId, attachableType, attachableId)` tablosu — DB seviyesinde FK zorlanamaz (kabul edilen kısıtlama) ama tek bir `FileService.attach()` fonksiyonu her yerde tekrar kullanılabiliyor.

### 1.5 Pagination: iki farklı standart, kasıtlı (reddedilen: tek tip offset pagination her yerde)
Liste ekranları (kullanıcı/ticket/izin/kanal) → **offset tabanlı** (`?page&pageSize&sort&order&q`). Mesaj geçmişi → **cursor/keyset tabanlı** (`?before=<messageId>&limit=`). Bu, CONTRACT.md'de gerekçesiyle belgelenmeli.

### 1.6 Logger: pino (reddedilen: winston, reddedilen: çıplak console.log)
"Hassas veri loglanmıyor" gereksinimi pino'nun yerleşik `redact` özelliğiyle karşılanıyor (`password`, `passwordHash`, `authorization`, `refreshToken` path'leri config'de bir kere tanımlanır).

---

## 2. Sequelize veri modeli

Tüm PK'ler `UUID` (`DataTypes.UUIDV4`). Tüm tarih alanları Sequelize `createdAt/updatedAt` otomatik. `User`, `Channel`, `Message`, `LeaveRequest`, `Ticket` üzerinde **`paranoid: true`** (soft delete).

| Model | Alanlar | İlişkiler |
|---|---|---|
| **Organization** | id, name, slug (unique) | hasMany Department, hasMany Channel |
| **Department** | id, organizationId FK, name | belongsTo Organization, hasMany User |
| **User** | id, email (unique, partial index `WHERE deleted_at IS NULL`), passwordHash, firstName, lastName, role ENUM(employee,developer,sales,hr,admin), departmentId FK (nullable), status ENUM(active,suspended,pending), avatarFileId FK→File (nullable), lastSeenAt (nullable) | belongsTo Department, hasMany RefreshToken, hasMany Message (as sender), belongsToMany Channel through ChannelMember |
| **RefreshToken** | id, userId FK, tokenHash, familyId, expiresAt, revokedAt (nullable), replacedByTokenId FK→self (nullable), userAgent, ip | belongsTo User |
| **Channel** | id, organizationId FK, name (nullable — DM'de null/opsiyonel), type ENUM(public,private,dm), departmentId FK (nullable), createdBy FK→User, isArchived boolean | belongsToMany User through ChannelMember, hasMany Message |
| **ChannelMember** | id, channelId FK, userId FK, channelRole ENUM(member,admin), lastReadMessageId FK (nullable), lastReadAt (nullable), joinedAt — unique(channelId,userId) | belongsTo Channel, belongsTo User |
| **Message** | id, channelId FK, senderId FK→User, body (text, nullable), type ENUM(text,system), replyToMessageId FK→self (nullable), editedAt (nullable) | belongsTo Channel, belongsTo User (sender), hasMany FileAttachment (via attachableType='message') |
| **File** | id, storageKey, originalName, mimeType, sizeBytes, uploadedById FK→User, thumbnailKey (nullable), status ENUM(uploading,ready,failed) | belongsTo User (uploadedBy) |
| **FileAttachment** | id, fileId FK→File, attachableType ENUM(message,ticket,leave_request,meeting,user_avatar), attachableId UUID — index(attachableType,attachableId) | belongsTo File |
| **LeaveRequest** | id, userId FK, type ENUM(annual,sick,unpaid,other), startDate, endDate, reason, status ENUM(pending,approved,rejected,cancelled), reviewedById FK→User (nullable), reviewedAt, reviewNote | belongsTo User (requester), belongsTo User (reviewer) |
| **Ticket** | id, title, description, status ENUM(open,in_progress,resolved,closed), priority ENUM(low,medium,high,urgent), createdById FK→User, assignedToId FK→User (nullable), departmentId FK (nullable) | belongsTo User x2 |
| **Meeting** | id, title, description, organizerId FK→User, startTime, endTime, location, channelId FK (nullable) | belongsTo User, hasMany MeetingParticipant |
| **MeetingParticipant** | id, meetingId FK, userId FK, rsvpStatus ENUM(invited,accepted,declined,tentative) — unique(meetingId,userId) | belongsTo Meeting, belongsTo User |
| **Notification** | id, userId FK (alıcı), type varchar, payload JSONB, isRead boolean default false | belongsTo User |

TS tarafında model tanımı: `class User extends Model<InferAttributes<User>, InferCreationAttributes<User>>` + `declare` alanlar + `.init()` — Sequelize 6.37 bunu native destekliyor, ek `sequelize-typescript` paketine gerek yok.

---

## 3. JWT auth akışı

- **Access token**: HS256, `JWT_ACCESS_SECRET`, ömür **15 dakika**, payload `{ sub: userId, role, orgId }`.
- **Refresh token**: HS256, ayrı secret `JWT_REFRESH_SECRET`, ömür **7 gün**, payload `{ sub: userId, familyId, jti }` (`jti` = `RefreshToken.id`).
- **Rotation + reuse detection akışı** (`POST /api/v1/auth/refresh`):
  1. JWT imza+exp doğrula.
  2. `RefreshToken` kaydını `jti`'den bul; `revokedAt` null mu, hash eşleşiyor mu kontrol et.
  3. Eğer kayıt zaten `replacedByTokenId` set edilmişse (daha önce kullanılmış) → çalıntı token tekrar kullanımı algılandı → aynı `familyId`'ye sahip tüm token'lar iptal edilir → 401, kullanıcı yeniden login olmaya zorlanır.
  4. Aksi halde: mevcut kayıt revoke edilir, aynı `familyId` ile yeni kayıt oluşturulur, yeni access+refresh çifti dönülür.
- **Saklama yeri**: Access + refresh token'lar **response body'de JSON** olarak dönülür (cookie değil).
- **Middleware yapısı**:
  - `middleware/authenticate.ts` — `Authorization` header'dan access token doğrular, `req.user = {id, role, orgId}` set eder.
  - `middleware/authorize.ts` — `authorize('admin','hr')` factory, kaba RBAC kontrol.
  - Kaynak-seviyeli yetkilendirme `services/authz.service.ts` içinde `assertChannelMember(userId, channelId)` gibi helper fonksiyonlar olarak.
- **RBAC rolleri**: `employee | developer | sales | hr | admin`. Örnek matris: LeaveRequest onayı → sadece `hr`/`admin`; Ticket kapatma → atanan kişi veya `admin`; kanal yönetimi → kanal-seviyeli `channelRole=admin` veya global `admin`.
- **Şifre hash**: bcrypt, `BCRYPT_ROUNDS` env (varsayılan 12).
- **Rate limiting**: `/auth/login`, `/auth/register` üzerinde sıkı limit (örn. 10 istek/dk/IP), genel API'de daha gevşek global limit.

---

## 4. Socket.IO olay sözleşmesi

**Bağlantı/auth**: `io(url, { auth: { token: accessToken } })` → sunucu `io.use()` middleware'inde aynı `token.service.ts` ile doğrular, `socket.data.user` set eder, geçersizse bağlantıyı reddeder. **Bilinen kısıtlama**: access token 15 dk'da bir dolduğu için soket bu sürede kopar; client'ların token yenileyip yeniden bağlanması gerekir.

**Odalar**: bağlantıda otomatik `user:{userId}` odasına + üye olunan her `channel:{channelId}` odasına katılım.

| Yön | Event | Payload |
|---|---|---|
| C→S | `channel:join` | `{ channelId }` (ack) |
| C→S | `channel:leave` | `{ channelId }` |
| C→S | `message:send` | `{ channelId, body, replyToMessageId?, tempId? }` (ack: `{success, data}`) |
| C→S | `message:read` | `{ channelId, lastReadMessageId }` |
| C→S | `typing:start` / `typing:stop` | `{ channelId }` |
| S→C | `message:new` | `{ message, tempId? }` → `channel:{id}` odasına |
| S→C | `message:updated` / `message:deleted` | `{ message }` / `{ messageId, channelId }` |
| S→C | `message:read` | `{ channelId, userId, lastReadMessageId, readAt }` |
| S→C | `typing` | `{ channelId, userId, isTyping }` (gönderen hariç broadcast) |
| S→C | `presence:update` | `{ userId, status, lastSeenAt }` |
| S→C | `notification:new` | `{ notification }` → `user:{id}` odasına |

Client-initiated event'ler **ack callback** ile cevap alır (`{success, data|error}`); global `error` event'i sadece bağlantı/auth seviyesi hatalara ayrılır.

**Presence**: v1'de bellek-içi `Map<userId, Set<socketId>>`, tek process (Redis adapter yok — çoklu API instance kapsam dışı). Son soket kopunca kısa bir gecikmeyle (5-10sn) offline işaretlenir, `User.lastSeenAt` güncellenir.

**Mesaj yaratma tekilleştirmesi**: hem `message:send` socket event'i hem `POST /channels/:id/messages` REST endpoint'i aynı `services/message.service.ts::createMessage()` fonksiyonunu çağırır.

---

## 5. Dosya yükleme/indirme akışı

1. **Upload**: `multer` (memory storage, boyut limiti env'den `MAX_UPLOAD_SIZE_MB`) → mime/boyut doğrulama (magic-byte kontrolü için `file-type` paketi) → `storage.service.ts` MinIO'ya `putObject` (`uploads/{userId}/{fileId}/{filename}` key'i) → resim tipiyse `sharp` ile senkron thumbnail üretimi (256x256 webp) → `File` satırı DB'ye yazılır.
2. **Download**: `GET /files/:id` — önce yetkilendirme (`authz.service`), sonra MinIO `presignedGetObject` ile kısa ömürlü URL (`SIGNED_URL_EXPIRY_SECONDS`, örn. 15dk) üretilip JSON içinde dönülür (`{url}`).
3. **Kova (bucket)**: tek bucket, env'den `MINIO_BUCKET`, API başlangıcında `bucketExists`/`makeBucket` idempotent kontrolü.

**Kritik risk**: presigned URL'in host'u MinIO client'ın `endPoint` config'ine göre üretilir. **İç bağlantı endpoint'i (`MINIO_INTERNAL_ENDPOINT=localhost:9000`) ile presigned URL'lerin kullanacağı dışa-açık endpoint (`MINIO_PUBLIC_ENDPOINT`, demo günü LAN IP) ayrı env değişkenleri olmalı.**

---

## 6. `api/src/` dosya/klasör listesi

```
api/
  .env.example
  tsconfig.json
  .sequelizerc
  package.json                      (+devDeps: typescript, tsx, @types/node,
                                      @types/express, @types/cors, @types/jsonwebtoken,
                                      @types/bcrypt, @types/multer, sequelize-cli
                                      +deps: multer, sharp, minio, express-validator,
                                      express-rate-limit, pino, pino-http, helmet, file-type)
  docs/
    module1-architecture.md         (bu dosya)
  src/
    server.ts                       — HTTP+Socket.IO server bootstrap, graceful shutdown
    app.ts                          — Express app: middleware zinciri, route mount, error handler
    config/
      env.ts                        — process.env okuma+doğrulama (fail-fast), tipli config export
      database.ts                   — Sequelize instance
      minio.ts                      — MinIO client instance (internal+public endpoint ayrımı)
    database/
      migrations/                   — sequelize-cli migration dosyaları (sıralı)
      seeders/                      — demo org/departman/admin kullanıcı
    models/
      index.ts                      — model init + tüm association wiring
      user.model.ts, organization.model.ts, department.model.ts, channel.model.ts,
      channelMember.model.ts, message.model.ts, file.model.ts, fileAttachment.model.ts,
      leaveRequest.model.ts, ticket.model.ts, meeting.model.ts, meetingParticipant.model.ts,
      refreshToken.model.ts, notification.model.ts
    middleware/
      authenticate.ts, authorize.ts, validate.ts, rateLimit.ts, errorHandler.ts, notFound.ts
    routes/
      index.ts                      — /api/v1 altında tüm alt router mount
      auth.routes.ts, user.routes.ts, department.routes.ts, channel.routes.ts,
      message.routes.ts, file.routes.ts, leaveRequest.routes.ts, ticket.routes.ts,
      meeting.routes.ts, notification.routes.ts, health.routes.ts (versiyonsuz /health)
    controllers/                    — routes ile aynı isimlendirme, ince katman
    services/
      token.service.ts              — JWT sign/verify (REST middleware + socket auth ortak kullanır)
      auth.service.ts, authz.service.ts, user.service.ts, channel.service.ts,
      message.service.ts            — createMessage() REST+socket ortak giriş noktası
      storage.service.ts, thumbnail.service.ts, leaveRequest.service.ts, ticket.service.ts,
      meeting.service.ts, notification.service.ts, pagination.service.ts
    sockets/
      index.ts                      — io server setup, auth middleware, connection wiring
      handlers/channel.handler.ts, message.handler.ts, typing.handler.ts, presence.handler.ts
    validators/                     — express-validator zincirleri (auth, message, ...)
    utils/
      logger.ts                     — pino + redact config
      errors.ts                     — AppError hiyerarşisi
      constants.ts
    types/
      express.d.ts                  — Request.user tip augmentasyonu
      index.ts                      — paylaşılan DTO/interface'ler
  CONTRACT.md (veya openapi.yaml)   — yayınlanacak REST+WS sözleşmesi, diğer 6 modülün tek doğruluk kaynağı
```

---

## 7. Riskler, uç durumlar

**Riskler**
1. **MinIO presigned URL host sorunu** — demo günü en yıkıcı olabilecek hata; internal vs public endpoint ayrımı şart, erken test edilmeli.
2. Express 5 + path-to-regexp v8: `app.get('*')` çalışmaz, `/*splat` gibi yeni sözdizimi gerekir.
3. Refresh rotation'da reuse-detection'ın yanlış implement edilmesi (family revoke unutulursa) güvenlik açığı doğurur — dikkatli test gerekli.
4. Socket.IO CORS ayrı bir `cors` config'i alır, Express CORS'tan bağımsız — ikisi de aynı env kaynağından okunmazsa demo'da farklı makineden bağlanamama sorunu çıkar.
5. Soft-delete (`paranoid`) + `User.email` unique index: partial index (`WHERE deleted_at IS NULL`) gerekli, yoksa silinen email'le yeniden kayıt başarısız olur.
6. Polymorphic `FileAttachment`: DB seviyesinde FK yok, cascade silme app-level (Sequelize hook) yapılmalı.
7. Tek-process presence/Socket.IO — yatay ölçeklenmez (bu proje kapsamında sorun değil).
8. Uzun ömürlü soket bağlantısı 15dk'lık access token ile çakışır — client reconnect-with-refresh mantığı yazılmazsa kullanıcılar sessizce "offline" görünür.

**Uç durumlar**
- DM/grup DM kanalı ikilenmesi: race condition ile ikilenme — v1 için kabul edilebilir düşük öncelikli risk.
- Multer boyut limiti aşımı: standart hata zarfına eşlenmeli.
- Mesaj düzenleme/silme yetkisi: sadece gönderen + kanal/global admin.

---

## 8. Uygulama sırası (implementer için)

1. **Bootstrap**: TS devDeps ekle, `tsconfig.json`, npm script'leri (`dev`=tsx watch, `build`=tsc, `start`), boş `server.ts`/`app.ts` + `/health` — Postgres/MinIO'ya bağlanabildiğini doğrula.
2. **Altyapı**: `config/env.ts`, `utils/logger.ts` (redact dahil), `utils/errors.ts`, standart response zarfı, `middleware/errorHandler.ts`.
3. **DB**: `config/database.ts`, `.sequelizerc` + sequelize-cli config, ilk migration ile bağlantı testi.
4. **Modeller + migration'lar** bağımlılık sırasıyla: Organization → Department → User → RefreshToken → Channel → ChannelMember → Message → File → FileAttachment → LeaveRequest → Ticket → Meeting → MeetingParticipant → Notification, + `models/index.ts` association wiring + demo seeder.
5. **Auth** (en riskli/temel parça): `token.service`, `auth.service` (register/login/refresh-rotation/logout), `authenticate`/`authorize` middleware, validator zincirleri, auth rate limiting — uçtan uca doğrula.
6. **Temel CRUD (REST only)**: users, departments, channels+members, leave-requests, tickets, meetings, notifications.
7. **Socket.IO**: `sockets/index.ts` auth middleware, presence, channel join/leave, message send/read/typing.
8. **Dosya servisi**: `storage.service`, multer config, `thumbnail.service`, file routes, mesaj/avatar/ticket'a `FileAttachment` bağlama.
9. **CONTRACT.md/openapi.yaml**: kod ilerledikçe sürekli güncelle, en son tam senkron hale getir.
10. **Son geçiş**: rate limiting kapsam kontrolü, log'larda hassas veri taraması, CORS+MinIO endpoint env doğrulaması, uçtan uca smoke test (register→login→kanal aç→socket'ten mesaj→dosya yükle→presigned indir→refresh→logout).
