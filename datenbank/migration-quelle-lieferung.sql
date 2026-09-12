-- ═══════════════════════════════════════════════════════════════════
--  NOCH NICHT ANGEWENDET · 'lieferung' in die erlaubten Quellen
--
--  ┌───────────────────────────────────────────────────────────────┐
--  │  DIESE DATEI GEHT VOR migration-lieferung.sql.                │
--  │  Ohne sie legt jene Datei bestellung_liefern() an, und der    │
--  │  erste echte Gast scheitert an der Bedingung unten — nach     │
--  │  Adresse, nach Korb, nach allem.                              │
--  └───────────────────────────────────────────────────────────────┘
--
--  ── WARUM ES DIESE DATEI ÜBERHAUPT GIBT ───────────────────────
--  bestellungen.quelle trägt eine CHECK-Bedingung:
--
--    bestellungen_quelle_check:
--      CHECK (quelle = ANY (ARRAY['tisch','telefon','reservierung','service']))
--
--  Sie steht NIRGENDS in diesem Verzeichnis. Es gibt kein
--  „create table bestellungen" — die Tabelle ist älter als diese
--  Dateien, und die Liste lebt nur im Katalog von Postgres. Kein
--  grep dieses Projekts hätte sie finden können.
--
--  Deshalb stand am Kopf von migration-lieferung.sql eine
--  Vorabfrage, und deshalb war sie berechtigt: Sie hat genau diesen
--  Fall gefunden. Die Telefon-Migration hatte dieselbe Frage schon
--  richtig gestellt (migration-telefonbestellung.sql:19-23) — daraus
--  wurde die Vorlage.
--
--  ── WAS DER FEHLER GEKOSTET HÄTTE ─────────────────────────────
--  Nichts beim Anlegen. Ein Funktionskörper wird beim „create" nicht
--  geprüft (§2.2), und die Migration hätte „success: true" gemeldet.
--  Erst der erste Gast im Liefermodus hätte es gemerkt: Adresse
--  getippt, Korb gefüllt, Knopf gedrückt — und dann ein Fehler aus
--  dem insert, den niemand erwartet hat. Der Betrieb hätte den
--  Fehler bei sich gesucht.
-- ═══════════════════════════════════════════════════════════════════

begin;

-- ── 1 · Erst beweisen, dass die Liste die GELESENE ist ─────────────
--
--  Ich habe diese Bedingung nicht selbst gemessen — der Datenbank-
--  zugang ist aus meiner Umgebung gesperrt. Sie wurde mir gemeldet.
--
--  Eine Liste zu ersetzen, die sich seit dem Ablesen geändert hat,
--  würde einen erlaubten Wert STILL wegnehmen. Der Einwurf, der ihn
--  braucht, fällt dann irgendwann später aus, und niemand verbindet
--  es mehr mit dieser Datei. Also bricht die Migration ab, statt zu
--  raten — und weil sie in einer Transaktion läuft, bleibt dann
--  alles, wie es war.
do $$
declare
  v_def text;
begin
  select pg_get_constraintdef(oid) into v_def
    from pg_constraint
   where conrelid = 'public.bestellungen'::regclass
     and conname  = 'bestellungen_quelle_check';

  if v_def is null then
    raise exception
      'bestellungen_quelle_check gibt es nicht (mehr). Bitte pruef-bestand.sql erneut fahren und mir Abschnitt 3 schicken.';
  end if;

  -- Schon erledigt? Dann nichts tun statt einen Fehler werfen: Eine
  -- Migration, die man zweimal fahren kann, ohne Schaden anzurichten,
  -- ist die einzige, die man beruhigt fährt.
  if v_def ~ 'lieferung' then
    raise notice 'lieferung steht bereits in der Liste — nichts zu tun.';
    return;
  end if;

  -- Alle vier gelesenen Werte müssen da sein. Fehlt einer, ist die
  -- Liste eine andere als die, auf der diese Datei beruht.
  if v_def !~ 'tisch' or v_def !~ 'telefon'
     or v_def !~ 'reservierung' or v_def !~ 'service' then
    raise exception
      'Andere Liste als die gelesene, hier wird nichts ersetzt. Gefunden: %', v_def;
  end if;

  -- ── 2 · Dieselbe Liste, plus 'lieferung' ────────────────────────
  --
  --  'reservierung' bleibt drin, obwohl heute keine einzige Zeile
  --  diesen Wert trägt. Einen erlaubten Wert beim Erweitern zu
  --  verlieren, wäre schlimmer als der fehlende neue: Der neue fehlt
  --  laut, der alte fehlt still.
  --
  --  Der Name bleibt bewusst derselbe, damit die nächste
  --  Bestandsaufnahme dieselbe Zeile findet und nicht zwei
  --  nebeneinander stehen (§2.1 sinngemäß — zwei Fassungen desselben
  --  Dings sind immer die teurere Variante).
  execute 'alter table public.bestellungen drop constraint bestellungen_quelle_check';

  execute $ct$
    alter table public.bestellungen add constraint bestellungen_quelle_check
      check (quelle = any (array['tisch','telefon','reservierung','service','lieferung']))
  $ct$;
end $$;

commit;


-- ═══════════════════════════════════════════════════════════════════
--  DANACH PRÜFEN · aus dem Katalog gelesen, nicht behauptet
--
--  Ein „success: true" sagt nichts darüber, ob die Bedingung jetzt
--  trägt (§0). Diese Abfrage liest, was wirklich dasteht.
-- ═══════════════════════════════════════════════════════════════════
--
--   select conname,
--          pg_get_constraintdef(oid)      as definition,
--          pg_get_constraintdef(oid) ~ 'lieferung' as lieferung_erlaubt
--   from pg_constraint
--   where conrelid = 'public.bestellungen'::regclass
--     and contype = 'c'
--   order by conname;
--
--   Erwartet: GENAU EINE Zeile mit Namen bestellungen_quelle_check,
--   lieferung_erlaubt = true, und alle vier alten Werte noch drin.
--
--   Zwei Zeilen desselben Namens kann es nicht geben — aber eine
--   ZWEITE Bedingung auf quelle unter anderem Namen schon. Dann
--   greifen beide mit UND, und die strengere gewinnt. Deshalb wird
--   hier nicht nur nach dem einen Namen gefragt, sondern alle
--   CHECK-Bedingungen der Tabelle aufgelistet — dieselbe Lehre wie
--   §2.3: Nie nur die Richtigkeit einer Regel prüfen, immer auch die
--   Anhäufung.
--
--
--  ── DER STÄRKERE BEWEIS, falls du ihn willst ─────────────────────
--  Dreht sich selbst zurück, schreibt also nichts. Der Umweg über
--  eine temporäre Tabelle ist nötig, weil „raise notice" über MCP
--  nicht erscheint (§2.2).
--
--   begin;
--   create temp table probe(schritt text, ergebnis text);
--   do $$
--   declare v_bid uuid;
--   begin
--     select id into v_bid from public.betriebe limit 1;
--
--     begin
--       insert into public.bestellungen (betrieb_id, quelle)
--       values (v_bid, 'lieferung');
--       insert into probe values ('lieferung', 'erlaubt');
--     exception when others then
--       insert into probe values ('lieferung', sqlstate || ' ' || sqlerrm);
--     end;
--
--     begin
--       insert into public.bestellungen (betrieb_id, quelle)
--       values (v_bid, 'unfug');
--       insert into probe values ('unfug', 'GING DURCH — die Bedingung greift nicht');
--     exception when others then
--       insert into probe values ('unfug', sqlstate || ' ' || sqlerrm);
--     end;
--   end $$;
--   select * from probe;
--   rollback;
--
--   So liest man das Ergebnis:
--     • 'lieferung' = „erlaubt"  → fertig.
--     • 'lieferung' = 23502 …    → NOT-NULL-Verletzung, also hat die
--       CHECK-Bedingung den Wert DURCHGELASSEN und eine andere Spalte
--       gebremst. Auch gut; der Wert ist erlaubt.
--     • 'lieferung' = 23514 …    → CHECK-Verletzung. Die Bedingung
--       blockiert weiterhin, die Migration hat nicht gegriffen.
--     • 'unfug'     = 23514 …    → genau richtig, sie greift noch.
--
--   Die Unterscheidung nach sqlstate steht hier, weil mein erster
--   Entwurf nur „ging durch / ging nicht durch" gemeldet hätte. Eine
--   NOT-NULL-Verletzung hätte dann wie eine haltende CHECK-Bedingung
--   ausgesehen — zwei völlig verschiedene Befunde unter demselben
--   Wort (§2.3b: Beim Schreibtest misst man leicht etwas anderes, als
--   man glaubt).
-- ═══════════════════════════════════════════════════════════════════
