-- ═══════════════════════════════════════════════════════════════════
--  MIGRATION · Mehr Platz für die eigenen Worte des Betriebs
--
--  Anlass (26.09.2026, Bildschirmfoto vom Betreiber): Der Titel eines
--  Banners brach nach „Probier gerne unsere neuen Speis" ab — 32
--  Zeichen. Der Wunsch: mehr Buchstaben für jede Textfläche im Gast-
--  Hub, mit einer Vorschau, wie es beim Gast aussieht.
--
--  Die alten Zahlen waren GEMESSEN (eine Zeile, zwei Zeilen …) und
--  bleiben als weiche Grenze im Board stehen: Bis dahin schweigt das
--  Feld, darüber warnt es. Hart wird erst hier. Ab jetzt entscheidet
--  die Live-Vorschau im Board, ob etwas beim Gast abgeschnitten wird —
--  die zeigt es am echten Hub, nicht an einer Zeichenzahl.
--
--  Nur gelockert, nie verschärft: Jeder vorhandene Wert liegt unter
--  der alten Grenze und damit unter der neuen (§2.3c). Dieselben Namen,
--  damit die Klartext-Übersetzung im Board (/hub_texte_masse|check/)
--  weiter greift.
--
--  Neue Grenzen (alt → neu):
--    hub_texte.claim            48 →  90
--    hub_texte.gruss            80 → 160
--    hub_texte.runner_titel     24 →  40
--    hub_texte.empfehlung_kennz 22 →  40
--    aktionen.titel             24 →  40
--    gutscheine.titel           60 →  80
--    gutscheine.beschreibung   160 → 240
--    hub_banner (ganze Spalte) 8000 → 16000 Bytes: 12 Banner mit langen
--      Texten und Bildadressen kamen rechnerisch an die alte Grenze.
--  Banner- und Kacheltexte haben keine eigene Längenschranke in der
--  Datenbank; sie sind über die Spaltengröße gedeckelt.
-- ═══════════════════════════════════════════════════════════════════
begin;

alter table public.betriebe drop constraint if exists hub_texte_masse;
alter table public.betriebe add constraint hub_texte_masse check (
      coalesce(length(hub_texte ->> 'claim'), 0)            <= 90
  and coalesce(length(hub_texte ->> 'gruss'), 0)            <= 160
  and coalesce(length(hub_texte ->> 'runner_titel'), 0)     <= 40
  and coalesce(length(hub_texte ->> 'empfehlung_kennz'), 0) <= 40
);

alter table public.betriebe drop constraint if exists betriebe_hub_banner_masse;
alter table public.betriebe add constraint betriebe_hub_banner_masse check (
  hub_banner is null or (
        jsonb_typeof(hub_banner) = 'array'
    and jsonb_array_length(hub_banner) <= 12
    and pg_column_size(hub_banner) < 16000)
);

alter table public.aktionen drop constraint if exists aktionen_titel_mass;
alter table public.aktionen add constraint aktionen_titel_mass check (
  length(btrim(titel)) between 1 and 40
);

alter table public.gutscheine drop constraint if exists gutscheine_masse;
alter table public.gutscheine add constraint gutscheine_masse check (
        char_length(titel) between 1 and 80
    and char_length(beschreibung) <= 240
    and code ~ '^[A-Z0-9-]{3,24}$'
);

commit;

-- Nach dem Einspielen (§2.3c, §2.7):
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--    where conname in ('hub_texte_masse','betriebe_hub_banner_masse',
--                      'aktionen_titel_mass','gutscheine_masse');
-- Und eine ANDERE Spalte derselben Zeile ändern (name) — dort zeigt
-- sich ein Fehler in einer Schranke zuerst.
