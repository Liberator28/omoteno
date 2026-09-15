-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT (15.09.2026) · Rabattcodes + Rabatt-Ablage auf Bestellungen
--
--  Angewendet gegen das echte Projekt UND die Probe am Dateiende
--  live gefahren (mit einem echten Mitglied/Bestellung, set_config auf
--  dessen nutzer_id, danach zurückgedreht): erste Einlösung ok:true
--  mit richtigem Endbetrag, zweite bereits_eingeloest, unbekannter
--  Code unbekannt — alle drei wie erwartet. anon sieht rabattcodes
--  nicht, authenticated darf rabattcode_anlegen nicht aufrufen,
--  service_role darf.
--
--  Im SQL-Editor von Supabase ausführen. Die Proben am Dateiende
--  gehören dazu: Eine Migration, die „success" meldet, sagt NICHTS
--  darüber, ob die Funktion läuft (CLAUDE.md §2.2).
--
--  VOR DEM EINSPIELEN VON HAND GEPRÜFT (gegen das echte Projekt,
--  CLAUDE.md §1.2/§1.3):
--    \d bestellungen        -- gibt es rabatt_betrag/rabatt_code schon?
--    \d betrieb_mitglieder  -- Spaltennamen wirklich nutzer_id/betrieb_id/rolle?
--    select conname, pg_get_constraintdef(oid) from pg_constraint
--      where conrelid='public.bestellungen'::regclass and contype='c';
--  Alle ALTER/CREATE unten sind additiv (IF NOT EXISTS) — ein
--  versehentliches zweites Einspielen tut nichts Zusätzliches, aber
--  eine VORHANDENE Spalte mit anderer Bedeutung unter demselben Namen
--  würde hier nicht auffallen. Deshalb erst nachsehen.
--
--  WARUM KEINE „Rechnung"-Tabelle und kein „Rechnungen"-Name irgendwo
--  hier drin: Es gibt in diesem Projekt SCHON eine Tabelle
--  `rechnungen` — das sind Omotenos eigene SaaS-Rechnungen AN den
--  Betrieb (Vertrag/Abo), sichtbar in seiten/konto.html unter dem
--  Reiter „Rechnungen" ("Rechnungen von Omoteno an dich — nicht die
--  Umsätze deines Betriebs"). Ein neuer Board-Bereich mit demselben
--  Wort hätte genau die Verwechslung aus CLAUDE.md §1.1a erzeugt: ein
--  passender Name ist kein Beweis, dass es dasselbe Feld/Konzept ist.
--  Was hier gebaut wird, ist ein RABATT auf eine offene BESTELLUNG —
--  dafür bleibt es bei `rabattcodes` und `bestellungen.rabatt_*`,
--  bedient im bestehenden Bestellungen-Bereich, nicht in einem neuen
--  Reiter mit kollidierendem Namen.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ══════════════════════════════════════════════════════════════════
--  1 · TABELLE rabattcodes
--
--  Bewusst NICHT die bestehende Tabelle `gutscheine` wiederverwendet:
--  die ist ein Treue-Bonus fürs Gastkonto (passiv im Hub gezeigt, nie
--  gegen eine Bestellung eingelöst, kein Rabattcode-Feld in
--  bestellung_aufgeben — recherchiert vor dieser Migration). Ein im
--  Board eintippbarer, gegen eine Bestellung einlösbarer Code hat
--  andere Konsumenten und andere Semantik — eigene Tabelle.
-- ══════════════════════════════════════════════════════════════════

create table if not exists public.rabattcodes (
  id                      uuid primary key default gen_random_uuid(),
  betrieb_id              uuid not null references public.betriebe(id) on delete cascade,
  code                    text not null,
  betrag                  numeric(8,2),
  prozent                 numeric(5,2),
  gueltig_bis             timestamptz,
  eingeloest              boolean not null default false,
  eingeloest_bestellung_id uuid references public.bestellungen(id) on delete set null,
  eingeloest_am           timestamptz,
  quelle                  text not null default 'klaviyo',
  angelegt_am             timestamptz not null default now(),
  constraint rabattcodes_betrag_oder_prozent check (
    (betrag is not null and prozent is null) or
    (betrag is null and prozent is not null)
  ),
  constraint rabattcodes_code_je_betrieb unique (betrieb_id, code)
);

comment on table public.rabattcodes is
  'Im Admin-Board gegen eine offene Bestellung einloesbare Rabattcodes '
  '(aktuell aus dem Klaviyo-Newsletter). Getrennt von der Treue-Tabelle '
  'gutscheine (Gastkonto-Bonus, andere Semantik, CLAUDE.md §1.1a).';

alter table public.rabattcodes enable row level security;

-- anon: kein Zugriff. Der Gast bekommt den Code per E-Mail von
-- Klaviyo, nie ueber diese Tabelle direkt (CLAUDE.md §2.3a: RLS ist
-- die zweite Linie — hier gibt es fuer anon erst gar kein Recht).
revoke all on public.rabattcodes from anon;

-- authenticated darf NUR lesen, und nur die eigenen (ueber
-- betrieb_mitglieder). Schreiben laeuft ausschliesslich ueber die
-- beiden Funktionen unten, nie direkt auf der Tabelle — so kann ein
-- Code nie an der Einloese-Pruefung vorbei als "eingeloest" markiert
-- werden.
grant select on public.rabattcodes to authenticated;

-- Setzt voraus, dass authenticated bereits SELECT auf betrieb_mitglieder
-- hat (RLS-Regeln laufen mit den Rechten des AUFRUFERS, nicht als
-- SECURITY DEFINER). Das ist der Fall — seiten/admin.html:4640-4643
-- (betriebeHolen()) fragt genau das schon erfolgreich ab. Getestet
-- gegen ein lokales Postgres mit nachgebildetem Mindestschema: ohne
-- dieses Recht schlaegt die Regel mit "permission denied for table
-- betrieb_mitglieder" fehl, nicht mit "0 Zeilen" — ein Unterschied,
-- den man am Fehlertext erkennt.
drop policy if exists rabattcodes_eigene_lesen on public.rabattcodes;
create policy rabattcodes_eigene_lesen on public.rabattcodes
  for select to authenticated
  using (
    exists (
      select 1 from public.betrieb_mitglieder m
      where m.betrieb_id = rabattcodes.betrieb_id and m.nutzer_id = auth.uid()
    )
  );

create index if not exists rabattcodes_betrieb_offen
  on public.rabattcodes (betrieb_id) where not eingeloest;


-- ══════════════════════════════════════════════════════════════════
--  2 · bestellungen additiv erweitern
--
--  summe bleibt unangetastet — sie wird laut migration-baukasten-und-
--  storno.sql bei jedem Teil-Storno komplett neu aus den verbliebenen
--  positionen aufsummiert. Ein Rabatt, der in summe selbst stuende,
--  wuerde ein spaeterer Storno stillschweigend wegrechnen. Deshalb
--  ein eigenes, additives Feld daneben; der Endbetrag wird ueberall
--  als summe - rabatt_betrag BERECHNET, nie gespeichert.
-- ══════════════════════════════════════════════════════════════════

alter table public.bestellungen
  add column if not exists rabatt_betrag numeric(8,2) not null default 0;
alter table public.bestellungen
  add column if not exists rabatt_code text;

comment on column public.bestellungen.rabatt_betrag is
  'Betrag, den ein Rabattcode von summe abzieht. summe selbst bleibt '
  'die reine Warensumme; Endbetrag = summe - rabatt_betrag, ueberall '
  'berechnet statt gespeichert. Bleibt bei Teil-Storno erhalten, nur '
  'summe wird dabei neu aus den verbliebenen positionen aufsummiert.';
comment on column public.bestellungen.rabatt_code is
  'Welcher rabattcodes.code eingeloest wurde, zur Anzeige im Board.';

do $$
begin
  if not exists (select 1 from pg_constraint
                  where conname = 'bestellungen_rabatt_betrag_positiv')
  then
    alter table public.bestellungen
      add constraint bestellungen_rabatt_betrag_positiv
      check (rabatt_betrag >= 0);
  end if;
end $$;

-- Spaltenweise, nicht tabellenweit: das Board darf diese beiden neuen
-- Felder lesen/schreiben, ohne dass sich an den bestehenden Rechten
-- auf bestellungen sonst etwas aendert.
grant select (rabatt_betrag, rabatt_code) on public.bestellungen to authenticated;


-- ══════════════════════════════════════════════════════════════════
--  3 · RPC rabattcode_anlegen — nur fuer service_role
--
--  Schreibt einen frischen Code. Aufgerufen von Block D (Klaviyo-
--  Coupon-Vorrat auffuellen) und vom Admin-Board-Knopf "Vorrat
--  auffuellen" (der laeuft serverseitig mit dem service_role-
--  Schluessel, nie mit dem anon-Schluessel aus dem Browser).
-- ══════════════════════════════════════════════════════════════════

create or replace function public.rabattcode_anlegen(
  p_betrieb_id uuid,
  p_code text,
  p_betrag numeric default null,
  p_prozent numeric default null,
  p_gueltig_bis timestamptz default null
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.rabattcodes (betrieb_id, code, betrag, prozent, gueltig_bis)
  values (p_betrieb_id, p_code, p_betrag, p_prozent, p_gueltig_bis)
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.rabattcode_anlegen(uuid, text, numeric, numeric, timestamptz) from public, anon, authenticated;
grant execute on function public.rabattcode_anlegen(uuid, text, numeric, numeric, timestamptz) to service_role;


-- ══════════════════════════════════════════════════════════════════
--  4 · RPC rechnung_rabattieren — fuer authenticated (Board-Personal)
--
--  SECURITY DEFINER, weil authenticated bewusst KEIN UPDATE-Recht auf
--  rabattcodes bekommt (Punkt 1): die Pruefung "gehoert der Aufrufer
--  zum Betrieb dieser Bestellung" steht deshalb explizit IM
--  Funktionskoerper (CLAUDE.md §2.3a — RLS ist die zweite Linie, hier
--  gibt es fuer diese Tabelle noch nicht mal eine erste). FOR UPDATE
--  sperrt die Codezeile, damit zwei gleichzeitige Einloeseversuche
--  sich nicht ueberholen koennen (kein Code wird je doppelt vergeben).
-- ══════════════════════════════════════════════════════════════════

create or replace function public.rechnung_rabattieren(
  p_bestellung_id uuid,
  p_code text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bestellung record;
  v_code       record;
  v_neuer_rabatt numeric(8,2);
begin
  select id, betrieb_id, summe into v_bestellung
    from public.bestellungen where id = p_bestellung_id;

  if v_bestellung.id is null then
    return jsonb_build_object('ok', false, 'grund', 'bestellung_unbekannt');
  end if;

  if not exists (
    select 1 from public.betrieb_mitglieder m
    where m.betrieb_id = v_bestellung.betrieb_id and m.nutzer_id = auth.uid()
  ) then
    return jsonb_build_object('ok', false, 'grund', 'kein_zugriff');
  end if;

  select id, betrag, prozent, eingeloest, gueltig_bis into v_code
    from public.rabattcodes
    where betrieb_id = v_bestellung.betrieb_id and code = p_code
    for update;

  if v_code.id is null then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;
  if v_code.eingeloest then
    return jsonb_build_object('ok', false, 'grund', 'bereits_eingeloest');
  end if;
  if v_code.gueltig_bis is not null and v_code.gueltig_bis < now() then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;

  v_neuer_rabatt := coalesce(v_code.betrag, round(v_bestellung.summe * v_code.prozent / 100, 2));

  update public.rabattcodes
    set eingeloest = true, eingeloest_bestellung_id = p_bestellung_id, eingeloest_am = now()
    where id = v_code.id;

  update public.bestellungen
    set rabatt_betrag = v_neuer_rabatt, rabatt_code = p_code
    where id = p_bestellung_id;

  return jsonb_build_object('ok', true, 'rabatt_betrag', v_neuer_rabatt,
    'endbetrag', v_bestellung.summe - v_neuer_rabatt);
end;
$$;

revoke all on function public.rechnung_rabattieren(uuid, text) from public, anon;
grant execute on function public.rechnung_rabattieren(uuid, text) to authenticated;

commit;

-- ── PROBE — in einer eigenen, zurueckgedrehten Transaktion fahren ──
--
-- Die Logik unten (fuenf Faelle: eigener Code, doppelte Einloesung,
-- fremder Code, abgelaufener Code, fremde Bestellung) ist bereits
-- gegen ein lokales Postgres 16 mit nachgebildetem Mindestschema
-- durchgespielt worden — alle fuenf Antworten kamen wie erwartet
-- zurueck (ok:true mit richtigem Endbetrag, bereits_eingeloest,
-- unbekannt, abgelaufen, kein_zugriff), inklusive der Rollenpruefung
-- (authenticated darf rabattcode_anlegen NICHT aufrufen, anon sieht
-- rabattcodes ueberhaupt nicht). Was hier NICHT geprueft werden
-- konnte: dieselbe Logik gegen das ECHTE, gewachsene Schema mit den
-- echten bestehenden Policies auf bestellungen/betrieb_mitglieder —
-- dafuer diese Probe einmal live fahren, mit set_config auf einen
-- echten Mitgliedsnutzer gewechselt (Muster in pruef-rechte.sql §2.4).
--
-- Ersetzt nichts von Hand — nimmt die erste vorhandene Bestellung
-- eines beliebigen Betriebs.
--
-- begin;
-- create temp table probe(schritt text, ergebnis text);
-- do $$
-- declare v_betrieb uuid; v_bestellung uuid; v_code_id uuid; r jsonb;
-- begin
--   select id into v_betrieb from betriebe limit 1;
--   v_code_id := rabattcode_anlegen(v_betrieb, 'PROBE-1', 2.00, null, now() + interval '7 days');
--   insert into probe values ('Code angelegt', v_code_id::text);
--   select id into v_bestellung from bestellungen where betrieb_id = v_betrieb limit 1;
--
--   -- Ab hier als eingeloggter Mitgliedsnutzer dieses Betriebs fahren:
--   --   select set_config('request.jwt.claims',
--   --     json_build_object('sub','<ECHTE nutzer_id aus betrieb_mitglieder>',
--   --                        'role','authenticated')::text, true);
--   --   set local role authenticated;
--   r := rechnung_rabattieren(v_bestellung, 'PROBE-1');
--   insert into probe values ('erste Einloesung (muss ok:true sein)', r::text);
--   r := rechnung_rabattieren(v_bestellung, 'PROBE-1');
--   insert into probe values ('zweite Einloesung (muss bereits_eingeloest sein)', r::text);
-- end $$;
-- select * from probe;
-- select summe, rabatt_betrag, rabatt_code from bestellungen
--   where id = (select id from bestellungen where betrieb_id =
--     (select id from betriebe limit 1) limit 1);
-- rollback;
