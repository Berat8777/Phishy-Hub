# Phishy Hub API — CONTRACT.md

> Bu dosya Modül 1'in (Çekirdek API & Gerçek Zamanlı Altyapı) **kodla senkron tek
> doğruluk kaynağıdır**. Diğer 6 modül (Web, Electron, Mobil, vs.) entegrasyon
> için bu dosyaya bakmalı — `docs/module1-architecture.md` tasarım gerekçesini
> anlatır, bu dosya ise **gerçekte ne çalıştığını** anlatır. İkisi çelişirse bu
> dosya geçerlidir.
>
> Son güncelleme: Modül 1 implementasyonu tamamlandığında, uçtan uca doğrulandı
> (bkz. sonundaki "Doğrulama durumu" bölümü).

---

## 0. Genel bakış

- **Base URL**: `http://<host>:3000` (host'ta `npm run dev` ile çalışır, docker-compose'a dahil değil)
- **Versiyonlu API**: `POST/GET/PATCH/DELETE /api/v1/...`
- **Versiyonsuz**: `GET /health`
- **Auth header**: `Authorization: Bearer <accessToken>` (REST). Cookie **kullanılmıyor**.
- **Content-Type**: `application/json`, dosya yükleme hariç (`multipart/form-data`).

### Standart REST response zarfı

Başarılı:
```json
{ "success": true, "data": { /* ... */ }, "meta": { /* opsiyonel, pagination */ } }
```

Hatalı:
```json
{ "success": false, "error": { "code": "VALIDATION_ERROR", "message": "...", "details": [] } }
```

`error.details` her zaman olmayabilir. `error.code` sabit bir string enum'dur (aşağıya bakın), programatik olarak dallanmak için kullanılmalı — `message` insan-okunur, sürüm arası değişebilir.

### Hata kodları → HTTP status

| code | status | Ne zaman |
|---|---|---|
| `VALIDATION_ERROR` | 422 | express-validator kural ihlali |
| `BAD_REQUEST` | 400 | Geçersiz iş kuralı girdisi (örn. olmayan departmentId) |
| `UNAUTHORIZED` | 401 | Token yok/geçersiz/süresi dolmuş, yanlış şifre |
| `FORBIDDEN` | 403 | RBAC/kaynak-seviyeli yetki reddi |
| `NOT_FOUND` | 404 | Kaynak yok |
| `CONFLICT` | 409 | Unique ihlali (örn. email zaten kayıtlı) |
| `TOO_MANY_REQUESTS` | 429 | Rate limit aşıldı |
| `UPLOAD_LIMIT_FILE_SIZE` | 413 | Multer boyut limiti aşıldı |
| `UPLOAD_*` | 400 | Diğer multer hataları |
| `INTERNAL_ERROR` | 500 | Beklenmeyen hata |

---

## 1. Kimlik doğrulama

### Akış

1. `POST /api/v1/auth/register` — self-servis kayıt. Rol her zaman `employee` olarak atanır (client `role` gönderemez), `status: active`. Yükseltilmiş roller sadece admin/HR tarafından `PATCH /users/:id` ile verilir.
2. `POST /api/v1/auth/login` → `{ user, accessToken, refreshToken, accessTokenExpiresIn }`
3. `POST /api/v1/auth/refresh` → aynı zarf (rotation — bkz. §1.3)
4. `POST /api/v1/auth/logout`
5. `GET /api/v1/auth/me` (auth gerekli)

### 1.1 Token ömürleri

| Token | Ömür | Secret env | Payload |
|---|---|---|---|
| Access | **15 dakika** | `JWT_ACCESS_SECRET` | `{ sub: userId, role, orgId, iat, exp }` |
| Refresh | **7 gün** | `JWT_REFRESH_SECRET` | `{ sub: userId, familyId, jti, iat, exp }` |

`jti` = DB'deki `RefreshToken.id`. Access token payload'ındaki `orgId`, tek seed
edilmiş `Organization` satırının id'sidir (multi-org yok, bkz. mimari doc §0).

### 1.2 Saklama yeri

Access + refresh token'lar **response body'de JSON** olarak dönülür — httpOnly
cookie **kullanılmıyor**. Sebep: web/Electron/mobil aynı sözleşmeyi paylaşsın
diye (mimari doc §1.3). Client'lar token'ları kendi güvenli storage'ında
tutmaktan sorumlu (web: memory/localStorage, Electron: keytar/electron-store,
mobil: SecureStore).

### 1.3 Refresh rotation + reuse detection (doğrulandı, çalışıyor)

Her `POST /auth/refresh` çağrısı **tek kullanımlıktır**:

- Başarılı bir refresh, eski kaydı `revoked_at` ile işaretler, aynı `family_id`
  ile **yeni** bir `RefreshToken` satırı + yeni access/refresh çifti üretir.
- Zaten kullanılmış (yani `replaced_by_token_id` set edilmiş) bir refresh
  token tekrar sunulursa: **reuse detected** → o `family_id`'ye ait TÜM
  token'lar iptal edilir → `401 UNAUTHORIZED` ("Refresh token has been
  revoked, please log in again") → kullanıcı yeniden login olmalı.
- `POST /auth/logout` çağrısı sadece ilgili tek token'ı revoke eder (family
  geneli değil) — bilinçli bir tasarım: logout kötüye kullanım sinyali
  değildir, tek oturumu kapatır.

Bu davranış e2e test edildi: refresh → reuse dene → 401 + family'deki YENİ
token da artık reddediliyor (doğrulama detayları için implementer HANDOFF'una
bakın).

**Eşzamanlılık garantisi**: `refresh()` DB transaction'ı içinde
`SELECT ... FOR UPDATE` row lock kullanıyor, bu yüzden aynı refresh token ile
**eşzamanlı** (paralel) birden fazla `POST /auth/refresh` çağrısı da güvenli —
sadece biri kazanır, kaybedenler reuse-detected'a düşer. **Ama dikkat**:
kaybedenler "reuse" olarak yorumlandığı için **kazananın yeni token'ı da
dahil tüm family iptal edilir** (canlı test edildi: 5 eşzamanlı istekten 1'i
200 döndü, kazananın yeni refresh token'ı bile hemen ardından denendiğinde
401 "revoked" döndü). Bu kasıtlı ve güvenli bir davranış (şüpheli durumda
oturumu kapat), ama şu sonucu doğuruyor: **client'lar aynı anda birden fazla
refresh çağrısı başlatmamalı** — tek bir "in-flight refresh" promise/mutex
paylaşılmalı (örn. zaten bir refresh sürüyorsa yeni çağrılar onun sonucunu
beklesin, yeni bir istek atmasın). Bu, Modül 2/3/4'ün auth client katmanının
uyması gereken bir kural; özellikle §4.1'deki "socket kopunca reconnect+
refresh" akışında birden fazla bileşen aynı anda refresh tetiklemesin diye.

### 1.4 RBAC rolleri

`employee | developer | sales | hr | admin` — düz liste, hiyerarşi yok
(`admin` her şeye erişebilir ama "developer > employee" gibi bir sıralama
kodda **yok**).

Örnek kaynak-seviyeli kurallar (uygulanmış, `services/authz.service.ts`):

| Aksiyon | Kural |
|---|---|
| Kanal yönetimi (üye ekle/çıkar/arşivle) | `ChannelMember.channelRole=admin` OYA global `admin` |
| Mesaj düzenle/sil | Sadece gönderen VEYA global `admin` |
| Leave request review (approve/reject) | Sadece `hr` veya `admin` |
| Leave request iptal | Sahibi VEYA `hr`/`admin` |
| Ticket kapatma (`status:closed`) | Sadece `assignedToId` VEYA global `admin` |
| Ticket görünürlüğü | **Kısıtlama yok** — herhangi bir authenticated kullanıcı tüm ticket'ları görebilir/listeleyebilir |
| Departman/kullanıcı yönetimi (create/update) | `admin` veya `hr` |
| Kullanıcı silme (soft-delete) | Sadece `admin` |

### 1.5 Şifre kuralları

bcrypt, `BCRYPT_ROUNDS` env (varsayılan 12). Min uzunluk: 8 karakter
(register/change-password validator'ı). Login hatası "Invalid email or
password" olarak döner — kullanıcı var mı yok mu ayrımı yapılmaz.

---

## 2. Pagination — iki farklı standart (kasıtlı)

### 2.1 Offset (kullanıcı/departman/kanal/ticket/leave-request/meeting/notification listeleri)

Query: `?page=1&pageSize=20&sort=<field>&order=ASC|DESC&q=<arama>`
(`pageSize` max 100, default 20).

Response `meta`:
```json
{ "page": 1, "pageSize": 20, "total": 42, "totalPages": 3 }
```

### 2.2 Cursor/keyset (mesaj geçmişi + thread yanıtları)

`GET /channels/:channelId/messages?before=<messageId>&limit=<n>` ve
`GET /messages/:id/replies?before=<messageId>&limit=<n>` (limit max 100,
default 30) — **aynı** cursor parametre adları/response şekli, ikincisi
sadece `replyToMessageId = :id` ile scope'lanmış (bkz §3.6). Sıralama
`createdAt DESC, id DESC` (tiebreaker). Response `meta`: `{ "hasMore": boolean }`.
İlk sayfa için `before` parametresini atlayın.

`GET /messages/search` bu kategoriye **girmiyor** — offset pagination
kullanıyor, bkz §2.1 ve §3.6.

---

## 3. REST Endpoint'leri

Aksi belirtilmedikçe hepsi `Authorization: Bearer <accessToken>` gerektirir ve
`/api/v1` altındadır.

### 3.1 Health (versiyonsuz, auth gerekmez, rate-limit yok)

| Method | Path | Response |
|---|---|---|
| GET | `/health` | `{status, db, uptimeSeconds, timestamp}` |

### 3.2 Auth (`/auth`) — sıkı rate limit: 10 istek/dk/IP+email (register/login/refresh)

| Method | Path | Auth | Body | Not |
|---|---|---|---|---|
| POST | `/auth/register` | - | `{email, password, firstName, lastName, departmentId?}` | 201, role her zaman `employee` |
| POST | `/auth/login` | - | `{email, password}` | 200 → `{user, accessToken, refreshToken, accessTokenExpiresIn}` |
| POST | `/auth/refresh` | - | `{refreshToken}` | 200 → yeni çift. Bkz §1.3 |
| POST | `/auth/logout` | - | `{refreshToken}` | 200, idempotent (geçersiz token da "başarılı" sayılır) |
| GET | `/auth/me` | ✓ | - | Kendi profilini döner |

### 3.3 Users (`/users`)

| Method | Path | Auth/Rol | Body / Query |
|---|---|---|---|
| GET | `/users` | herkes | `?role=&status=&departmentId=&q=` + offset pagination |
| GET | `/users/:id` | herkes | - |
| PATCH | `/users/me` | herkes (kendi) | `{firstName?, lastName?, avatarFileId?}` |
| POST | `/users/me/change-password` | herkes (kendi) | `{currentPassword, newPassword}` |
| POST | `/users` | `admin`,`hr` | `{email, password, firstName, lastName, role?, departmentId?}` |
| PATCH | `/users/:id` | `admin`,`hr` | `{role?, status?, departmentId?}` |
| DELETE | `/users/:id` | `admin` | Soft delete (`paranoid`) |

Kullanıcı DTO'sunda `passwordHash` **hiçbir zaman** dönmez (model `defaultScope`
ile hariç tutuluyor).

### 3.4 Departments (`/departments`)

| Method | Path | Auth/Rol |
|---|---|---|
| GET | `/departments` | herkes, offset pagination |
| GET | `/departments/:id` | herkes |
| POST | `/departments` | `admin`,`hr` — body `{name}` |
| PATCH | `/departments/:id` | `admin`,`hr` — body `{name}` |
| DELETE | `/departments/:id` | `admin` |

### 3.5 Channels (`/channels`) — düz departman modeli, DM = `type:'dm'` (2+ üye)

| Method | Path | Auth/Rol | Not |
|---|---|---|---|
| GET | `/channels` | herkes | Sadece **kendi üye olduğu** kanallar; `?type=public\|private\|dm`. DTO'da her kanala `unreadCount`, `lastReadMessageId`, `lastMessage` eklendi — bkz aşağı |
| POST | `/channels` | herkes | `{type, name?, departmentId?, memberIds?}`. `type≠dm` ise `name` zorunlu. Oluşturan otomatik `channelRole:admin` üye olur. Grup DM: `type:'dm'` + 2'den fazla `memberIds` |
| POST | `/channels/dm` | herkes | `{userIds: [...]}` — **get-or-create**. Çağıran + `userIds` tam olarak aynı üye setine sahip bir DM kanalı zaten varsa onu döner (`200`), yoksa oluşturur (`201`). Bkz aşağı |
| GET | `/channels/:channelId` | üye | 403 üye değilse |
| GET | `/channels/:channelId/members` | üye | |
| POST | `/channels/:channelId/join` | herkes | Sadece `type:'public'` kanallar için — private/dm'e sadece admin ekleyebilir |
| POST | `/channels/:channelId/leave` | üye | |
| POST | `/channels/:channelId/members` | kanal-admin veya global-admin | body `{userId}` |
| DELETE | `/channels/:channelId/members/:userId` | kanal-admin veya global-admin | |
| POST | `/channels/:channelId/archive` | kanal-admin veya global-admin | |

**`GET /channels` DTO ek alanları** (sadece liste endpoint'inde, `GET /channels/:channelId`'de yok):
- `unreadCount`: o kanalda, çağıranın `lastReadMessageId`'sinden sonra
  gelen, çağırana ait olmayan, üst-seviye (thread yanıtı olmayan) mesaj
  sayısı.
- `lastReadMessageId`: çağıranın o kanaldaki `ChannelMember.lastReadMessageId`'si (`null` olabilir).
- `lastMessage`: `{id, body, senderId, createdAt}` — kanaldaki en son
  üst-seviye mesajın önizlemesi, hiç mesaj yoksa `null`.

Bu üç alan, sayfadaki **tüm kanallar için tek bir ek sorgu** ile hesaplanıyor
(kanal başına değil) — `channel.service.ts::attachChannelListMeta()`, ham SQL
(`DISTINCT ON` + `channel_members`/`messages` join) kullanıyor çünkü her
kanalın "okunmamış" eşiği farklı bir `lastReadMessageId`'ye bağlı ve
`pagination.service.ts::paginate()` bunu ifade edemiyor.

**Not**: DM kanal de-duplication artık `POST /channels/dm` üzerinden
routed — `channel.service.ts::findExistingDmChannel()` bu endpoint'in
içinde çağrılıyor. Yine de **race condition riski tam çözülmedi** (mimari
doc §7'de kabul edilmiş): eşzamanlı iki `POST /channels/dm` çağrısı
teorik olarak iki ayrı DM kanalı oluşturabilir (unique constraint yok);
pratikte düşük olasılıklı.

### 3.6 Messages (kanal alt-kaynağı + doğrudan `/messages/:id`)

| Method | Path | Auth | Not |
|---|---|---|---|
| GET | `/channels/:channelId/messages` | üye | Cursor pagination, bkz §2.2. **Sadece üst-seviye mesajlar** — `replyToMessageId IS NOT NULL` olan thread yanıtları artık bu listede yok, bkz "Threads" altında |
| POST | `/channels/:channelId/messages` | üye | `{body?, replyToMessageId?, fileIds?}`. `body` boşsa `fileIds` zorunlu. **Socket'e de broadcast eder** (`message:new`) |
| GET | `/messages/search` | herkes | `?q=<terim>&channelId=<opsiyonel>` + offset pagination (§2.1). Bkz "Search" altında |
| GET | `/messages/:messageId/replies` | üye | Cursor pagination, bkz §2.2. `replyToMessageId = :messageId` olan mesajlar |
| PUT | `/messages/:messageId/reactions` | üye | `{emoji}` — bkz "Reactions" altında |
| DELETE | `/messages/:messageId/reactions` | üye | `{emoji}` (body veya query) — bkz "Reactions" altında |
| PATCH | `/messages/:messageId` | gönderen veya admin | `{body}` |
| DELETE | `/messages/:messageId` | gönderen veya admin | Soft delete |

`createMessage()` REST ve `message:send` socket event'i tarafından **aynı**
`services/message.service.ts` fonksiyonu üzerinden çağrılır — tekilleştirme
doğrulandı.

**Mesaj DTO'suna eklenen alanlar** (`toMessageDTO()`, tüm mesaj listeleme/get
endpoint'lerinde):
- `reactions`: `[{emoji, count, userIds: [...], reactedByMe: boolean}]` —
  emoji'ye göre gruplanmış. `reactedByMe`, çağıranın kendi user id'sinin
  `userIds` içinde olup olmadığına bakar. **Önemli**: bu alan sadece REST
  list/get çağrılarında (çağıranın kimliği bilindiğinde) doğru hesaplanır.
  Socket broadcast'leri (`message:new`/`message:updated`) aynı DTO'yu
  **tüm** `channel:{id}` odasına tek bir payload olarak yayınladığı için
  (viewer-özel hesaplama yok — bu, gönderen bilgisi gibi diğer DTO
  alanlarının da zaten viewer-agnostik olduğu bu kod tabanındaki mevcut
  yayın modeliyle tutarlı), broadcast edilen kopyalarda `reactedByMe` her
  zaman `false` döner. Client'lar kendi kullanıcı id'lerini `userIds`'e
  karşı kontrol ederek daha güvenilir sonuç alabilir.
- `replyCount` / `lastReplyAt`: bu mesaja `replyToMessageId` ile işaret eden
  mesaj sayısı ve en son yanıtın `createdAt`'i (`null` olabilir).

**Reactions**: `PUT /messages/:messageId/reactions` idempotent — aynı emoji
zaten varsa no-op (yine `200` + güncel mesaj DTO'su döner). Caller,
mesajın kanalının üyesi olmalı (aynı `assertChannelMember` kontrolü,
`createMessage()` ile aynı yetkilendirme). `(messageId, userId, emoji)`
üzerinde unique constraint var — bir kullanıcı aynı mesaja aynı emoji ile
sadece bir kez reaksiyon verebilir, farklı emoji'lerle birden fazla
reaksiyon verebilir. Socket'e `reaction:added`/`reaction:removed` broadcast
edilir (sadece gerçekten bir satır eklendiğinde/silindiğinde — idempotent
no-op'ta broadcast yok), bkz §4.3.

**Threads**: `GET /messages/:messageId/replies`, ana kanal timeline'ıyla
**aynı** cursor pagination mantığını kullanır (`before`/`limit` parametre
adları, `{hasMore}` response şekli), sadece `channelId` yerine
`replyToMessageId = :messageId` ile filtrelenmiş. Ana timeline
(`GET /channels/:channelId/messages`) artık thread yanıtlarını
**içermiyor** — `replyToMessageId IS NOT NULL` olan mesajlar sadece bu yeni
endpoint üzerinden erişilebilir. Bu filtre cursor karşılaştırmasının
çalıştığı WHERE clause'un **parçası** (post-filter değil), yani sayfalama
matematiği bozulmuyor.

**Search**: `GET /messages/search?q=&channelId=` — Postgres
`ILIKE '%terim%'` (v1, `tsvector` kolonu yok, kapsam dışı). `channelId`
verilirse sadece o kanalda (üyelik kontrol edilir), verilmezse çağıranın
üye olduğu **tüm** kanallarda arar. Offset pagination kullanır
(`pagination.service.ts::paginate()` — bu, mesajın kendi attribute'ları
üzerinde filtrelenmiş sıradan bir sorgu olduğu için doğrudan uyuyor, cross-table
agregasyon gerektiren §3.5'teki `unreadCount` hesaplamasının aksine).
Thread yanıtları da arama sonuçlarına dahil (ana timeline'dan hariç
tutulmasıyla karıştırılmamalı — arama farklı bir kullanım senaryosu).

### 3.7 Files (`/files`) — bkz. §5 için tam akış

| Method | Path | Auth | Not |
|---|---|---|---|
| POST | `/files` | herkes | `multipart/form-data`, alan adı **`file`**. Opsiyonel `attachableType`+`attachableId` body alanları ile tek istekte attach de yapılabilir |
| GET | `/files/:id` | yetkiliyse | `{url, expiresInSeconds, file}` — presigned GET URL. `?variant=thumbnail` verilirse (sadece resim dosyaları, 256×256 webp) orijinal yerine thumbnail nesnesine işaret eden presigned URL döner — thumbnail'i olmayan bir dosya için `variant=thumbnail` `400 BAD_REQUEST` döner |
| POST | `/files/:id/attach` | yetkiliyse | `{attachableType, attachableId}` |
| DELETE | `/files/:id` | uploader veya admin | MinIO + DB'den siler |

### 3.8 Leave Requests (`/leave-requests`)

| Method | Path | Auth/Rol |
|---|---|---|
| GET | `/leave-requests` | herkes → sadece kendisininkiler; `hr`/`admin` → hepsi, `?status=&userId=` |
| POST | `/leave-requests` | herkes — `{type, startDate, endDate, reason?}` (ISO 8601 tarih) |
| GET | `/leave-requests/:id` | sahibi veya `hr`/`admin` |
| POST | `/leave-requests/:id/review` | `hr`,`admin` — `{status:'approved'|'rejected', reviewNote?}`. Sadece `pending` iken |
| POST | `/leave-requests/:id/cancel` | sahibi veya `hr`/`admin` — sadece `pending` iken |

Review sonrası talep sahibine `leave_request_reviewed` notification'ı +
socket `notification:new` gönderilir (doğrulandı).

### 3.9 Tickets (`/tickets`)

| Method | Path | Auth/Rol |
|---|---|---|
| GET | `/tickets` | herkes — **görünürlük kısıtlaması yok**, `?status=&priority=&assignedToId=&departmentId=` |
| POST | `/tickets` | herkes — `{title, description?, priority?, departmentId?}` |
| GET | `/tickets/:id` | herkes |
| PATCH | `/tickets/:id` | herkes (kısıtlama yok — Modül'ün ötesinde bir UI/iş kuralı gerekiyorsa sonraki modülde eklenebilir) |
| POST | `/tickets/:id/assign` | herkes — `{assignedToId}`. Atanan kişiye `ticket_assigned` notification gider |
| POST | `/tickets/:id/status` | herkes, ama `status:'closed'` sadece assignee/admin |

### 3.10 Meetings (`/meetings`)

| Method | Path | Auth/Rol |
|---|---|---|
| GET | `/meetings` | herkes → sadece davetli olduğu toplantılar; `?from=&to=` (ISO 8601) |
| POST | `/meetings` | herkes — `{title, description?, startTime, endTime, location?, channelId?, participantIds?}`. Organizatör otomatik `accepted` katılımcı |
| GET | `/meetings/:id` | herkes (kısıtlama yok) |
| POST | `/meetings/:id/respond` | davetli — `{rsvpStatus: invited\|accepted\|declined\|tentative}` |

Davet edilenlere `meeting_invite` notification + socket `notification:new`.

### 3.11 Notifications (`/notifications`)

| Method | Path | Auth |
|---|---|---|
| GET | `/notifications` | herkes — sadece kendisininkiler, `?isRead=true\|false` |
| POST | `/notifications/read-all` | herkes |
| POST | `/notifications/:id/read` | sahibi |

---

## 4. Socket.IO sözleşmesi

### 4.1 Bağlantı

```js
const socket = io('http://<host>:3000', { auth: { token: accessToken } });
```

- Sunucu `io.use()` middleware'inde `token.service.ts::verifyAccessToken()` ile
  doğrular; geçersiz/eksikse bağlantı reddedilir (`connect_error`).
- **Bilinen kısıtlama (doğrulandı, tasarım gereği)**: access token 15
  dakikada bir dolar, socket bu noktada kopar. Client'lar refresh token ile
  yeni access token alıp **yeniden bağlanmalı** (otomatik reconnect + token
  yenileme mantığı client tarafında implement edilmeli — Modül 1 bunu
  sağlamıyor).
- Bağlantıda otomatik katılınan odalar: `user:{userId}` + o an üye olunan
  **her** `channel:{channelId}`.

### 4.2 Client → Server event'leri

| Event | Payload | Ack |
|---|---|---|
| `channel:join` | `{channelId}` | `{success:true, data:{channelId}}` veya `{success:false, error:{code,message}}` |
| `channel:leave` | `{channelId}` | aynı şekilde |
| `message:send` | `{channelId, body?, replyToMessageId?, tempId?}` | `{success, data:<message DTO>}` |
| `message:read` | `{channelId, lastReadMessageId}` | `{success, data:{channelId,userId,lastReadMessageId,readAt}}` |
| `typing:start` | `{channelId}` | **ack yok** |
| `typing:stop` | `{channelId}` | **ack yok** |

Ack formatı `sockets/ack.ts`'te merkezi: `{success:true,data}` /
`{success:false,error:{code,message}}` — REST zarfıyla aynı `code` değerleri.

### 4.3 Server → Client event'leri

| Event | Payload | Hedef oda |
|---|---|---|
| `message:new` | `{message, tempId?}` | `channel:{id}` |
| `message:updated` | `{message}` | `channel:{id}` |
| `message:deleted` | `{messageId, channelId}` | `channel:{id}` |
| `message:read` | `{channelId, userId, lastReadMessageId, readAt}` | `channel:{id}` (gönderen dahil herkese) |
| `typing` | `{channelId, userId, isTyping}` | `channel:{id}`, **gönderen hariç** (`socket.to()`) |
| `presence:update` | `{userId, status:'online'\|'offline', lastSeenAt}` | **TÜM bağlı client'lara** (`io.emit`) — kanal/organizasyon bazlı filtreleme yok, tasarım kararı: v1'de "kim kimin presence'ını görebilir" kısıtlaması yok |
| `notification:new` | `{notification}` | `user:{id}` |
| `reaction:added` | `{messageId, emoji, userId}` | `channel:{id}` |
| `reaction:removed` | `{messageId, emoji, userId}` | `channel:{id}` |

REST üzerinden mesaj oluşturma/güncelleme/silme de **aynı event'leri**
socket'e broadcast eder (`sockets/broadcast.ts` merkezi helper'ları
kullanılıyor) — yani bir client REST ile mesaj gönderirse, socket'e bağlı
diğer client'lar da gerçek zamanlı görür.

### 4.4 Presence

- Bellek-içi `Map<userId, Set<socketId>>`, **tek process** (mimari doc §4 —
  Redis adapter yok, yatay ölçeklenmez).
- Bir kullanıcının son socket'i koptuğunda **8 saniyelik** grace period
  (`OFFLINE_GRACE_MS`) beklenir; bu süre içinde yeniden bağlanırsa (örn. token
  yenileme sonrası reconnect) "offline" hiç yayınlanmaz. Süre dolarsa
  `User.lastSeenAt` DB'ye yazılır ve `presence:update{status:'offline'}`
  yayınlanır.
- Doğrulandı: 2 client testinde, biri disconnect olduktan ~8sn sonra diğer
  client `presence:update{status:'offline'}` aldı.

### 4.5 Bilinen client kütüphanesi notu (implementasyon sırasında keşfedildi)

`socket.io-client`'ta aynı Node.js prosesinde birden fazla soket açarken
`transports: ['websocket']` ile transport'u zorlamak, ikinci bağlantının
paketlerinin sunucuya hiç ulaşmamasına yol açtı (sadece test script'inde —
sunucu tarafında hiçbir sorun yok, izole tek-soket testi ack mekanizmasının
sorunsuz çalıştığını kanıtladı). Varsayılan transport negotiation (`polling`
→ `websocket` upgrade) kullanıldığında sorun kayboldu. Diğer modüllerin
socket.io-client kurulumlarında `transports: ['websocket']`'i zorlamamaları,
ya da zorlarlarsa tek client/tek sekme başına test etmeleri önerilir — bu
muhtemelen bu ortamdaki `engine.io-client`/`ws` sürüm kombinasyonuna özgü bir
davranış, API'de değil.

---

## 5. Dosya yükleme/indirme akışı (doğrulandı, uçtan uca)

1. **Upload**: `POST /files` (`multipart/form-data`, alan adı `file`) →
   multer memory storage → `file-type` paketiyle magic-byte tespiti (declared
   Content-Type'a değil, gerçek byte'lara bakar; metin-benzeri formatlarda
   declared type'a fallback) → MinIO'ya `uploads/{userId}/{fileId}/{filename}`
   key'iyle yazılır → resimse (`image/*`) senkron 256×256 webp thumbnail
   üretilip `uploads/{userId}/{fileId}/thumbnail.webp` olarak ayrıca yazılır
   → `File` satırı `status:'ready'` ile oluşturulur.
2. **Download**: `GET /files/:id` → yetkilendirme (`authz.service.ts::assertCanAccessFile`,
   bkz. altta) → MinIO `presignedGetObject` (`SIGNED_URL_EXPIRY_SECONDS`,
   varsayılan 900sn) → `{url, expiresInSeconds, file}` JSON olarak döner.
   Client bu URL'e doğrudan GET atar (API'den geçmez).
3. **Attach**: Bir dosyayı bir kayda (mesaj/ticket/leave-request/meeting/avatar)
   bağlamak için ya upload isteğinde `attachableType`+`attachableId` gönderin
   ya da ayrıca `POST /files/:id/attach`.

### Dosya erişim yetkisi (`assertCanAccessFile`, doğrulandı)

- Yükleyen kişi veya global `admin` → her zaman erişebilir.
- Aksi halde, dosyanın **herhangi bir** `FileAttachment` bağlantısı üzerinden
  erişim aranır:
  - `message` → o mesajın olduğu kanalın üyesi mi?
  - `leave_request` → sahibi mi, `hr`/`admin` mi?
  - `meeting` → katılımcı mı?
  - `ticket` → **kısıtlama yok** (ticket görünürlüğü zaten global)
  - `user_avatar` → **kısıtlama yok** (org-wide görünür)
- Hiçbir attachment yoksa (henüz hiçbir yere bağlanmamış "yetim" dosya) →
  sadece uploader/admin görebilir.

Bu mantık iki ayrı senaryoda e2e test edildi: (a) kanal üyesi ekli dosyaya
erişebiliyor → 200, (b) kanal-dışı kullanıcı erişemiyor → 403.

### Kritik env ayrımı (mimari doc §5 riski — doğrulandı çalışıyor)

```
MINIO_INTERNAL_ENDPOINT / MINIO_INTERNAL_PORT   → API'nin MinIO'ya gerçek I/O için kullandığı adres
MINIO_PUBLIC_ENDPOINT   / MINIO_PUBLIC_PORT     → presigned URL'lerin içine gömülen adres
```

Demo günü tek makinede çalışıyorsa ikisi de `localhost:9000` olabilir (varsayılan
`.env.example`). **Farklı makinelerden bağlanılacaksa `MINIO_PUBLIC_ENDPOINT`
API'yi çalıştıran makinenin LAN IP'sine ayarlanmalı**, yoksa diğer
bilgisayarlardaki client'lar indirilen presigned URL'lere ulaşamaz (`localhost`
kendi makinelerini işaret eder).

---

## 6. CORS ve ağ konfigürasyonu

- Express CORS ve Socket.IO CORS **aynı** `CORS_ORIGIN` env değişkeninden
  okunur (virgülle ayrılmış origin listesi, veya `*`) — mimari doc §7 risk
  #4'ün önlendiği doğrulandı (`app.ts` ve `sockets/index.ts` ikisi de
  `env.corsOrigin`'i kullanıyor).
- API `helmet()` ile güvenlik header'ları ekliyor (CSP, HSTS, vs. — varsayılan
  ayarlar, sıkılaştırma gerekiyorsa Modül 2/3 kendi domain'ine göre override
  edebilir).
- Rate limit: genel `/api/v1/*` → `RATE_LIMIT_MAX` istek / `RATE_LIMIT_WINDOW_MS`
  (varsayılan 300/dk); `/auth/login`,`/auth/register`,`/auth/refresh` →
  `AUTH_RATE_LIMIT_MAX` (varsayılan 10/dk), IP+email bileşik anahtarla.
  `/health` rate-limitsiz.

---

## 7. Ortam değişkenleri (`.env.example`'da tam liste)

Diğer modüllerin bilmesi gereken kritik olanlar:

| Değişken | Amaç |
|---|---|
| `CORS_ORIGIN` | Web/Electron client'ların origin'i (virgülle ayrık liste) |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | Sadece API'nin bilmesi gerekir, client'lara sızmamalı |
| `MINIO_PUBLIC_ENDPOINT` / `MINIO_PUBLIC_PORT` | Demo günü LAN IP'ye göre ayarlanmalı (bkz §5) |
| `MAX_UPLOAD_SIZE_MB` | Client-side dosya boyutu ön-kontrolü için referans (varsayılan 25MB) |
| `SIGNED_URL_EXPIRY_SECONDS` | Presigned indirme URL'lerinin ömrü (varsayılan 900sn) |

---

## 8. Demo hesapları (seeder)

Tüm demo kullanıcılar şifre: **`Password123!`**

| email | rol | departman |
|---|---|---|
| admin@phishyhub.local | admin | Engineering |
| hr@phishyhub.local | hr | Human Resources |
| dev1@phishyhub.local | developer | Engineering |
| dev2@phishyhub.local | developer | Engineering |
| sales1@phishyhub.local | sales | Sales |
| employee1@phishyhub.local | employee | Support |

Seed kanalları: `#general` (public, herkes üye), `#engineering` (private,
admin+dev1+dev2 üye). `#general`'da bir karşılama mesajı var.

---

## 9. Mimari dosyadan sapmalar

Aşağıdakiler `docs/module1-architecture.md`'de belirtilmeyen, implementasyon
sırasında alınan kararlardır — mimariyle çelişmiyor ama netleştirme gerektirir:

1. **docker-compose.yml postgres portu 5432→5433 host mapping'ine değiştirildi**
   (implementer'ın geliştirme makinesinde farklı bir projeden zaten 5432'yi
   kullanan bir Postgres container'ı vardı). Container-içi port hâlâ 5432,
   sadece host-mapping değişti. `.env`'de `DB_PORT=5433`. **Demo makinesinde
   port 5432 boşsa bu satırı `docker-compose.yml`'de `"5432:5432"` olarak geri
   almak ve `.env`'i buna göre güncellemek serbesttir** — API kodu bu konuda
   agnostik, sadece env okuyor.
2. **`file-type` paketi v22 (ESM-only)** — CommonJS `services/file.service.ts`
   içinden `await import('file-type')` dinamik import'u ile kullanılıyor.
3. **Refresh token hash'leme**: bcrypt değil **SHA-256** kullanıldı (gerekçe:
   girdi zaten yüksek entropili bir JWT, bcrypt'in yavaşlığına gerek yok —
   `token.service.ts::hashRefreshToken`). Mimari doc sadece "hash'lenmiş"
   diyor, algoritma belirtmiyordu.
4. **`User` modelinde `defaultScope`** eklendi: `passwordHash` varsayılan
   sorgularda hiç dönmüyor (login için ayrı `withPassword` scope'u var). Şema
   değişmedi, sadece ekstra bir güvenlik katmanı.
5. **Ticket ve meeting görünürlüğü kısıtlanmadı** (herhangi bir authenticated
   kullanıcı tüm ticket/meeting'leri görebilir) — mimari doc bunun için
   spesifik bir kural vermiyordu, "dahili küçük şirket aracı" varsayımıyla en
   basit seçenek alındı. İleride departman-bazlı kısıtlama gerekirse bu bir
   sonraki modülde eklenebilir.
6. **`presence:update` tüm bağlı client'lara broadcast ediliyor** (oda-bazlı
   değil) — mimari doc'ta hedef oda belirtilmemişti, en basit seçenek alındı.
7. **Reactions/Threads/Search/Unread-counts/DM get-or-create/thumbnail URL**
   (frontend mimari review'inde eksik bulunan 4 özellik + 2 küçük düzeltme)
   eklendi. Alınan kararlar:
   - `reactedByMe`, sadece REST list/get çağrılarında doğru — socket
     broadcast'lerinde her zaman `false` (bkz §3.6, "viewer-özel hesaplama
     yok" notu).
   - `unreadCount`/`lastMessage`, sayfa başına tek ham SQL sorgusu ile
     hesaplanıyor (`channel.service.ts::attachChannelListMeta()`) — hem bu
     hem de mesaj arama, thread yanıtlarının ana timeline'dan hariç
     tutulmasıyla tutarlı olacak şekilde `replyToMessageId IS NOT NULL`
     olan mesajları saymıyor/göstermiyor.
   - `GET /messages/search` `pagination.service.ts::paginate()`'i olduğu
     gibi reuse ediyor — mesajın kendi attribute'ları üzerinde filtrelenmiş
     sıradan bir sorgu olduğu için ayrı bir pagination implementasyonuna
     gerek kalmadı.
   - Mention formatı (`<@uuid>` — client-side parse edilecek, frontend'in
     ayrı bir işi) bu turda **hiç** ele alınmadı; `body` alanı ham metin
     olarak saklanmaya devam ediyor, sunucu tarafında hiçbir mention
     parse/notification mantığı eklenmedi.

---

## 10. Doğrulama durumu (implementasyon sonunda gerçek testlerle kanıtlandı)

- [x] `docker compose up -d` → postgres + minio ayakta
- [x] 16 migration çalıştı, şema mimari doc §2/§6 ile birebir eşleşiyor
      (partial unique index, forward-reference FK'lar dahil)
- [x] Demo seeder çalıştı (1 org, 4 departman, 6 kullanıcı, 2 kanal, 9 üyelik, 1 mesaj)
- [x] `npm run dev` → `/health` → `{status:"ok", db:"ok"}`
- [x] REST e2e: register → login → me → kanal listele → mesaj gönder → mesaj
      listele (cursor pagination) → refresh → refresh **reuse detection**
      (family revoke doğrulandı) → logout → logout sonrası refresh reddedildi
- [x] Leave request: oluştur → hr onayladı → notification oluştu
- [x] Ticket: oluştur → non-assignee kapatma denemesi 403 döndü
- [x] Dosya: text dosyası yükle → presigned URL al → **gerçekten indir** →
      byte-byte orijinaliyle eşleşti; PNG yükle → thumbnail üretildi (MinIO'da
      doğrulandı); mesaja dosya ekleme (`fileIds`) → kanal üyesi erişebildi
      (200) → kanal-dışı kullanıcı erişemedi (403)
- [x] Socket.IO gerçek client (socket.io-client) ile: bağlan (auth token) →
      `channel:join` (ack) → `message:send` (ack) → diğer client `message:new`
      aldı → `typing:start` diğer client'a ulaştı, gönderene ulaşmadı →
      `message:read` ack alındı → disconnect sonrası ~8sn'de diğer client
      `presence:update{offline}` aldı
- [x] Reactions/Threads/DM get-or-create eklentileri: `npm test` (vitest,
      gerçek Postgres'e karşı) yeşil — 7 test dosyası, 64 test, dahil yeni
      `tests/messageFeatures.test.ts` (reaction toggle idempotency, thread
      exclusion from main timeline + replies endpoint, DM get-or-create
      returning the same channel on repeat calls). `tsc --noEmit` ve
      `npm run build` temiz.
