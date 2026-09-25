-- ═══════════════════════════════════════════════════════════════════
--  ANGEWENDET (quxwweuvdqtjsdwgjdrh) · betriebe.hub_stil — Schalter
--  für die Anmutung des Gäste-Hubs, zuerst: bewegte Emojis an/aus
--
--  Die bewegten Zeichen (Noto-Lottie) sind für jedes Haus Standard.
--  Ein Haus mit eigenem, edlem Stil (Minhkeey „kaiserlich") soll im
--  Board auf die gezeichneten Striche zurückschalten können — live,
--  ohne dass der Hub neu erzeugt wird. Dieselbe Bauart wie hub_avatar
--  und hub_banner: jsonb-Objekt, spaltenweise Rechte, keine neue RLS.
--
--  Form: {"emoji": true|false}. Der Hub nimmt NUR ein echtes boolean
--  (strikt typeof === "boolean"); alles andere fällt still auf das
--  Markenblatt bzw. „an" zurück.
--
--  REIHENFOLGE ZÄHLT (CLAUDE.md §2.5): Der Hub fragt die Spalte in
--  seinem select AUSDRÜCKLICH ab. Fehlt sie, scheitert die GANZE
--  Abfrage (HTTP 400) und der Hub verliert die Live-Karte. Diese
--  Migration muss also VOR der Auslieferung des Hubs laufen.
--
--  Additiv: legt nur an, ändert nichts Bestehendes.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists hub_stil jsonb;

comment on column public.betriebe.hub_stil is
  'Anmutung des Gaeste-Hubs, im Admin-Board eingestellt. {"emoji": bool} '
  '— bewegte Noto-Emojis an Kacheln/Servicerufen/Kategorien. Fehlt der '
  'Schluessel, gilt das Markenblatt (bewegteZeichen), sonst an.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'betriebe_hub_stil_form') then
    alter table public.betriebe
      add constraint betriebe_hub_stil_form check (
        hub_stil is null or (
          jsonb_typeof(hub_stil) = 'object'
          and pg_column_size(hub_stil) < 1000
          and (not hub_stil ? 'emoji' or jsonb_typeof(hub_stil->'emoji') = 'boolean')
        ));
  end if;
end $$;

grant select (hub_stil) on public.betriebe to anon;
grant update (hub_stil) on public.betriebe to authenticated;

commit;

-- ── PROBE (vor dem Anwenden in einer zurückgedrehten Transaktion) ──
--   {"emoji":false}             → angenommen
--   {"emoji":"false"}           → check_violation (Zeichenkette statt boolean)
--   [1,2]                       → check_violation (kein Objekt)
--   anon: select hub_stil       → geht
--   anon: update hub_stil       → permission denied
-- ═══════════════════════════════════════════════════════════════════
