# Hive API Reference

> Base URL: `/api`
> Auth: JWT Bearer Token (Header `Authorization: Bearer <access_token>`)
> Interaktive Docs: `GET /api/docs` (Swagger UI)

---

## Auth

### `POST /api/auth/register`

Neuen Account erstellen.

| Feld       | Typ    | Pflicht | Beschreibung            |
|------------|--------|---------|-------------------------|
| `username` | string | x      | Eindeutiger Benutzername |
| `email`    | string | x      | E-Mail-Adresse           |
| `password` | string | x      | Min. 8 Zeichen           |

**Response** `201` — User-Objekt (`id`, `username`, `email`).

---

### `POST /api/auth/token`

JWT-Login. Gibt Access- und Refresh-Token zurück.

| Feld       | Typ    | Pflicht |
|------------|--------|---------|
| `username` | string | x      |
| `password` | string | x      |

**Response** `200` — `{ "access": "...", "refresh": "..." }`

---

### `POST /api/auth/token/refresh`

Access-Token erneuern.

| Feld      | Typ    | Pflicht |
|-----------|--------|---------|
| `refresh` | string | x      |

**Response** `200` — `{ "access": "..." }`

---

## Events

### `POST /api/events`

Neues Event erstellen. Der eingeloggte User wird automatisch Owner und erster Teilnehmer (RSVP `accepted`).

| Feld          | Typ      | Pflicht | Beschreibung                 |
|---------------|----------|---------|------------------------------|
| `title`       | string   | –       | Titel                        |
| `description` | string   | –       | Beschreibung (Markdown ok)   |
| `location`    | string   | x      | Ort                          |
| `starts_at`   | datetime | x      | Startzeit (ISO 8601)         |
| `ends_at`     | datetime | –       | Endzeit (muss ≥ `starts_at`) |
| `dresscode`   | string   | –       | Dresscode                    |
| `metadata`    | object   | –       | Frei nutzbares JSON-Objekt   |

**Response** `201` — Event-Objekt inkl. `owner`.

---

### `GET /api/events`

Alle Events, auf die der User Zugriff hat (Owner, Teilnehmer oder eingeladen).

**Query-Parameter:** `search`, `location`, `starts_at`, `ordering`, `page`

**Response** `200` — Paginierte Liste.

---

### `GET /api/events/{id}`

Event-Details abrufen. Zugriff: Owner, Teilnehmer oder eingeladener User.

**Response** `200` — Event-Objekt.

---

### `PATCH /api/events/{id}`

Event bearbeiten. **Nur Owner.**

Body: Beliebige Event-Felder (partial update).

**Response** `200` — Aktualisiertes Event-Objekt.

---

## Einladungen

### `POST /api/events/{id}/invites`

Einladungen verschicken (Batch). **Nur Owner.**

| Feld              | Typ      | Pflicht | Beschreibung                          |
|-------------------|----------|---------|---------------------------------------|
| `emails`          | string[] | x*      | Liste von E-Mail-Adressen             |
| `user_ids`        | int[]    | x*      | Liste von User-IDs                    |
| `expires_in_hours`| int      | –       | Gültigkeit in Stunden (Default: 168)  |

*Mindestens `emails` oder `user_ids` muss angegeben werden.

**Flow:**
1. Für jede E-Mail / jeden User wird ein einmaliger Token generiert.
2. Token wird als SHA-256-Hash gespeichert (Plaintext nie persistiert).
3. Response enthält den Plaintext-Token → Frontend baut daraus den Einladungslink.

**Response** `201`
```json
{
  "results": [
    {
      "invitation": { "id": 1, "status": "pending", "expires_at": "..." },
      "token": "abc123..."
    }
  ]
}
```

---

### `POST /api/invites/{token}/respond`

Einladung annehmen oder ablehnen. User muss eingeloggt sein und zur Einladung passen (gleiche E-Mail oder zugewiesener User).

| Feld     | Typ    | Pflicht | Werte                    |
|----------|--------|---------|--------------------------|
| `status` | string | x      | `accepted` / `declined`  |

**Flow:**
1. Token wird gehasht und in der DB gesucht.
2. Expiry-Check → `400` wenn abgelaufen.
3. User-Match-Check → `403` wenn Token einem anderen User/Email gehört.
4. `Invitation.status` wird gesetzt, `Participation` wird erstellt/aktualisiert.

**Response** `200` — `{ "invitation": {...}, "participation": {...} }`

---

## Teilnahme / Self-Management

### `GET /api/events/{id}/participants`

Alle Teilnehmer eines Events inkl. RSVP-Status, +1, Allergien, Contributions und Custom-Field-Werte.

**Query-Parameter:** `rsvp_status` (Filter), `ordering`, `page`

**Response** `200` — Paginierte Teilnehmer-Liste.

---

### `PATCH /api/events/{id}/me`

Eigene Teilnahme-Daten aktualisieren. Erstellt automatisch eine `Participation`, falls noch keine existiert (Einladung muss vorliegen).

| Feld                  | Typ      | Pflicht | Beschreibung                            |
|-----------------------|----------|---------|----------------------------------------|
| `rsvp_status`         | string   | –       | `pending` / `accepted` / `declined`    |
| `plus_one_count`      | int      | –       | Anzahl Begleitpersonen                 |
| `allergies`           | string   | –       | Allergien / Unverträglichkeiten        |
| `notes`               | string   | –       | Persönliche Notizen                    |
| `dresscode_visible`   | bool     | –       | Dresscode-Sichtbarkeit                 |
| `contributions`       | array    | –       | Bring-Liste (ersetzt bisherige Einträge) |
| `custom_field_answers` | object  | –       | `{ "field_key": value }` — Custom-Field-Antworten |

**Flow bei `contributions`:**
- Alle bisherigen Contributions des Users werden gelöscht und durch die neuen ersetzt (Replace-Semantik).

**Flow bei `custom_field_answers`:**
- Werte werden gegen die `CustomFieldDefinition` validiert (Typ, required, enum-Options).
- Upsert pro `(definition, participation)`.

**Response** `200` — Vollständiges Participation-Objekt.

---

## Contributions (Bring-Liste)

### `GET /api/events/{id}/contributions`

Alle Contributions eines Events auflisten.

**Response** `200` — Paginierte Liste.

---

### `POST /api/events/{id}/contributions`

Einzelne Contribution hinzufügen. Wird automatisch der eigenen Participation zugeordnet (Owner kann auch für andere erstellen).

| Feld            | Typ    | Pflicht | Beschreibung        |
|-----------------|--------|---------|---------------------|
| `item_name`     | string | x      | Was wird mitgebracht |
| `quantity`      | int    | –       | Menge (Default: 1)  |
| `notes`         | string | –       | Anmerkungen          |
| `participation` | int    | –       | Nur für Owner        |

**Response** `201` — Contribution-Objekt.

---

## Custom Fields

### `GET /api/events/{id}/custom-fields`

Alle Custom-Field-Definitionen eines Events auflisten.

**Response** `200` — Paginierte Liste.

---

### `POST /api/events/{id}/custom-fields`

Neues Custom Field definieren. **Nur Owner.**

| Feld        | Typ      | Pflicht | Beschreibung                                    |
|-------------|----------|---------|------------------------------------------------|
| `key`       | slug     | x      | Eindeutiger Schlüssel pro Event                 |
| `label`     | string   | x      | Anzeigename                                     |
| `field_type`| string   | x      | `text` / `number` / `bool` / `enum`             |
| `required`  | bool     | –       | Pflichtfeld? (Default: false)                   |
| `options`   | string[] | –       | Nur bei `enum` — Liste erlaubter Werte          |
| `position`  | int      | –       | Sortierung                                       |

**Validierung:** `enum` muss `options` haben; andere Typen dürfen keine `options` setzen.

**Response** `201` — CustomFieldDefinition-Objekt.

---

## Polls (Abstimmungen)

### `GET /api/events/{id}/polls`

Alle Polls eines Events auflisten (inkl. Optionen).

**Response** `200` — Paginierte Liste.

---

### `POST /api/events/{id}/polls`

Neue Abstimmung erstellen. **Nur Owner.** Mindestens 2 Optionen.

| Feld              | Typ      | Pflicht | Beschreibung              |
|-------------------|----------|---------|---------------------------|
| `question`        | string   | x      | Fragestellung              |
| `allows_multiple` | bool     | –       | Mehrfachauswahl? (Default: false) |
| `opens_at`        | datetime | –       | Abstimmung öffnet          |
| `closes_at`       | datetime | –       | Abstimmung schließt        |
| `options`         | array    | x      | `[{ "label": "..." }, ...]` |

**Response** `201` — Poll-Objekt mit Optionen.

---

### `POST /api/polls/{id}/vote`

Abstimmen. Ersetzt vorherige Stimmen des Users.

| Feld         | Typ   | Pflicht | Beschreibung                              |
|--------------|-------|---------|-------------------------------------------|
| `option_ids` | int[] | x      | Gewählte Option(en). Bei Single-Choice nur 1. |

**Flow:**
1. Prüfung ob Poll geöffnet ist (`opens_at` / `closes_at`).
2. Bei `allows_multiple=false` → genau 1 Option erlaubt.
3. Alle bisherigen Votes des Users werden gelöscht, neue erstellt.

**Response** `200` — `{ "poll_id": 1, "selected_option_ids": [3] }`

---

### `GET /api/polls/{id}/results`

Ergebnisse einer Abstimmung abrufen.

**Response** `200`
```json
{
  "poll_id": 1,
  "question": "Welcher Tag?",
  "allows_multiple": false,
  "total_votes": 5,
  "unique_voters": 5,
  "options": [
    { "id": 1, "label": "Montag", "vote_count": 3 },
    { "id": 2, "label": "Dienstag", "vote_count": 2 }
  ]
}
```

---

## Kommentare

### `GET /api/events/{id}/comments`

Top-Level-Kommentare auflisten (inkl. Reactions und Reply-Count).

**Response** `200` — Paginierte Liste.

---

### `POST /api/events/{id}/comments`

Kommentar erstellen. Optional als Reply auf einen anderen Kommentar (max. 1 Ebene tief).

| Feld     | Typ    | Pflicht | Beschreibung                     |
|----------|--------|---------|----------------------------------|
| `text`   | string | x      | Kommentartext (max. 2000 Zeichen) |
| `parent` | int    | –       | ID des Eltern-Kommentars          |

**Response** `201` — Kommentar-Objekt.

---

## Reaktionen

### `POST /api/comments/{id}/reactions`

Reaktion auf einen Kommentar togglen. Gleicher Emoji = entfernen, neuer Emoji = hinzufügen.

| Feld    | Typ    | Pflicht | Beschreibung           |
|---------|--------|---------|------------------------|
| `emoji` | string | x      | z.B. `:fire:` |

**Response** `201` (hinzugefügt) oder `200` mit `{ "removed": true }` (entfernt).

---

## Dokumente

### `GET /api/events/{id}/documents`

Alle Dokumente eines Events auflisten.

**Response** `200` — Paginierte Liste.

---

### `POST /api/events/{id}/documents`

Datei hochladen (multipart/form-data). Max. 10 MB.

| Feld    | Typ    | Pflicht | Beschreibung      |
|---------|--------|---------|-------------------|
| `file`  | file   | x      | Die Datei          |
| `title` | string | –       | Titel / Dateiname  |

**Response** `201` — Dokument-Objekt mit Download-URL.

---

## Galerie

### `GET /api/events/{id}/gallery`

Alle Bilder eines Events auflisten.

**Response** `200` — Paginierte Liste.

---

### `POST /api/events/{id}/gallery`

Bild hochladen (multipart/form-data). Max. 10 MB.

| Feld      | Typ    | Pflicht | Beschreibung |
|-----------|--------|---------|--------------|
| `image`   | file   | x      | Bilddatei     |
| `caption` | string | –       | Bildunterschrift |

**Response** `201` — EventImage-Objekt mit Bild-URL.

---

## Schema / Docs

| Methode | Pfad           | Beschreibung                 |
|---------|----------------|------------------------------|
| `GET`   | `/api/schema`  | OpenAPI 3.0 YAML/JSON Schema |
| `GET`   | `/api/docs`    | Swagger UI                   |

---

## Permission-Übersicht

| Aktion                         | Wer darf?                            |
|--------------------------------|--------------------------------------|
| Event erstellen                | Jeder eingeloggte User               |
| Event bearbeiten               | Nur Owner                            |
| Event ansehen                  | Owner, Teilnehmer, Eingeladene       |
| Einladungen erstellen          | Nur Owner                            |
| Einladung beantworten          | Eingeladener User (E-Mail/ID-Match)  |
| Eigene Teilnahme bearbeiten    | Teilnehmer selbst                    |
| Custom Fields definieren       | Nur Owner                            |
| Custom Fields beantworten      | Teilnehmer (via `/me`)               |
| Polls erstellen                | Nur Owner                            |
| Abstimmen                      | Alle Event-Teilnehmer                |
| Kommentare / Reaktionen        | Alle Event-Teilnehmer                |
| Dokumente / Bilder hochladen   | Alle Event-Teilnehmer                |

---

## Statuscodes

| Code  | Bedeutung                                  |
|-------|--------------------------------------------|
| `200` | Erfolg (GET, PATCH, Responses)             |
| `201` | Erstellt (POST)                            |
| `400` | Validierungsfehler / abgelaufener Token    |
| `401` | Nicht eingeloggt                           |
| `403` | Keine Berechtigung                         |
| `404` | Ressource nicht gefunden / Feature deaktiviert |

---

## Error-Format

Alle Fehler folgen dem gleichen Schema:

```json
{
  "error": {
    "code": "validation_error",
    "detail": { "field_name": ["Fehlermeldung"] }
  }
}
```
