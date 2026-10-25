-- ═══════════════════════════════════════════════════════════════════
--  EINGESPIELT 24.10.2026 (live gelesen: Spalte, Schranke, Rechte; Probe zurückgedreht) · Aufbau der Startseite aus Blöcken
--
--  Der Gast-Hub zeichnet die Startseite aus Blöcken: Schnellzugriff,
--  Begleiter (Figur mit Satz), Aktion/Top-Runner, Banner-Rad, „Nochmal“,
--  Empfehlung, jede Rubrik der Kacheln und eigene Textblöcke. Der Wirt
--  stellt im Board Reihenfolge, Sichtbarkeit, Breite und Größe ein und
--  legt eigene Textblöcke an. Der Hub liest die Liste zur Laufzeit.
--
--  WARUM EINE EIGENE SPALTE (CLAUDE.md §1.1a). Nachgesehen, was in Frage
--  kam: hub_stil ist auf 2500 Bytes gedeckelt und trägt schon Schrift,
--  Farben, Szene, Kartenstil, Kopf — eine Blockliste mit Texten passt dort
--  nicht hinein; hub_kacheln ist die Liste der KACHELN (jeder Eintrag ein
--  Schlüssel aus KACHELARTEN), ein Block ist keine Kachel. Eine eigene
--  Spalte ist die einzige, die nichts Fremdes verbiegt.
--
--  ADDITIV (§2.5): Spalte anlegen, niemand liest sie, bis der Hub sie
--  kennt. Ohne Eintrag (NULL) bleibt die Startseite Zeichen für Zeichen
--  die von vorher.
--
--  RECHTE. Lesen: anon (der Gast), spaltenweise wie hub_kacheln — „select *“
--  auf betriebe bleibt verboten (§2.3a). Schreiben: authenticated, und die
--  vorhandene Wache betrieb_rolle_wache() lässt NUR den Inhaber an jede
--  Spalte außer bestell_pause*; die neue Spalte ist damit ohne weiteres
--  Zutun Besitzersache (in der lokalen Probe gemessen, nicht angenommen).
--
--  INHALT PRÜFT DER HUB, nicht die Datenbank: Er nimmt nur Felder aus
--  seiner Positivliste an (§2.3a/§8.1w). Die Schranke hier hält nur die
--  FORM — ein Array, höchstens 40 Blöcke, unter 10 kB — damit niemand die
--  Spalte als Ablage benutzt.
-- ═══════════════════════════════════════════════════════════════════

begin;

alter table public.betriebe
  add column if not exists hub_bloecke jsonb;

comment on column public.betriebe.hub_bloecke is
  'Aufbau der Startseite im Gaeste-Hub: Liste von {id, an, breite, groesse, '
  'titel, text, knopf, ziel, look}. Der Hub liest sie zur Laufzeit und nimmt '
  'nur Felder aus seiner eigenen Positivliste an. NULL = Vorgabe-Reihenfolge.';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'betriebe_hub_bloecke_form') then
    alter table public.betriebe
      add constraint betriebe_hub_bloecke_form check (
        hub_bloecke is null or (
          jsonb_typeof(hub_bloecke) = 'array'
          and jsonb_array_length(hub_bloecke) <= 40
          and pg_column_size(hub_bloecke) < 10000
        ));
  end if;
end $$;

grant select (hub_bloecke) on public.betriebe to anon;
grant update (hub_bloecke) on public.betriebe to authenticated;

commit;

-- ── PROBE (zurückgedreht; die lokale Fassung mit Rollen: datenbank/pruef-bloecke-lokal.sql) ──
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$ declare v_id uuid; v_n int; begin
--     select id into v_id from public.betriebe limit 1;
--     update public.betriebe set hub_bloecke = '[{"id":"begleiter"}]'::jsonb where id = v_id;
--     get diagnostics v_n = row_count; insert into probe values ('schreiben', v_n || ' Zeile(n)');
--     begin update public.betriebe set hub_bloecke = '{"id":"x"}'::jsonb where id = v_id;
--           insert into probe values ('Objekt statt Liste','DURCHGELASSEN');
--     exception when check_violation then insert into probe values ('Objekt statt Liste','abgelehnt, richtig'); end;
--     begin update public.betriebe set hub_bloecke = to_jsonb(array_fill('x'::text, array[41])) where id = v_id;
--           insert into probe values ('41 Eintraege','DURCHGELASSEN');
--     exception when check_violation then insert into probe values ('41 Eintraege','abgelehnt, richtig'); end;
--     begin update public.betriebe set hub_bloecke = jsonb_build_array(repeat('x', 12000)) where id = v_id;
--           insert into probe values ('zu gross','DURCHGELASSEN');
--     exception when check_violation then insert into probe values ('zu gross','abgelehnt, richtig'); end;
--   end $$;
--   select * from probe;
--   rollback;
