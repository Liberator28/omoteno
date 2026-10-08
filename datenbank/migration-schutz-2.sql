-- ═══════════════════════════════════════════════════════════════════
--  migration-schutz-2.sql · Netz-Bremsen für jede offene Gast-Funktion
--
--  STAND 08.10. (Supabase-MCP, Project Blend Hub):
--   ANGEWENDET: schutz_bremsen, slug_frei, bestellung_gefunden,
--     bestellung_status, bestellung_nachrichten, bestellung_restzeit,
--     reservierung_stand, bestellung_stornieren — je genau eine Fassung
--     (§2.1), vorher in zurückgedrehter Transaktion geprüft (120 frei,
--     der 121. gebremst, andere Herkunft frei, ohne Herkunft nie
--     gebremst).
--   NACHGEZOGEN (zweiter Tag): admin_anmelden, tisch_sitzung_start.
--     Der volle Funktionstext kam über das Werkzeug nie an (fünfmal
--     60 s ohne Antwort, keine offene Sitzung, keine Sperre — der
--     Übertragungsweg hielt genau diese beiden Texte an). Eingespielt
--     über einen DO-Block, der die Live-Fassung liest und nur die
--     Bremszeile einsetzt; danach je genau eine Fassung, Körper bis auf
--     diese Zeile gleich. Zurückgedrehte Probe: 20 Anmeldungen frei,
--     die 21. PT429, gefälschtes x-forwarded-for hilft nicht, andere
--     Herkunft frei; echter Tischcode liefert die Sitzung, Aufruf 201
--     PT429.
--   BEFUND dabei: tisch_sitzung_start WARF bei falschem Code eine
--     Ausnahme — und eine Ausnahme dreht auch den Zähler der Bremse
--     zurück. Gezählt wurden nur GÜLTIGE Codes, die Flut falscher nie
--     (gemessen: Aufruf 201 noch P0001 statt PT429). Jetzt: falscher
--     Code → leere Antwort (der Hub liest leer und Fehler gleich, er
--     tut dann still nichts).
--     Die Datei bleibt wiederholbar (z. B. im SQL-Editor).
--
--  Wunsch (08.10.): „ein Sicherheitssystem, das Angriffe blockt“ —
--  Anfragefluten über den öffentlichen anon-Schlüssel, Raten von
--  Nummern und Passwörtern, auch automatisiert mit KI-Werkzeugen.
--
--  BEFUND vorher (Supabase-Berater + pg_get_functiondef, 08.10.):
--   17 security-definer-Funktionen sind für anon ausführbar. Eine
--   Bremse (schutz_zaehlen aus migration-missbrauch.sql) hatten nur
--   bestellung_aufgeben, gast_melden, gast_mail_merken,
--   anfrage_anhang_ok im Körper; bestellungen, anfragen, ereignisse und
--   reservierungen sind zusätzlich per Trigger gebremst. OHNE Bremse:
--     admin_anmelden          (Passwort-Sprühen über viele Konten)
--     slug_frei               (Aufzählen der Kunden)
--     tisch_sitzung_start     (Tischschlüssel raten)
--     bestellung_gefunden     (Quittungsnummern raten)
--     bestellung_stornieren   (Fluten)
--     bestellung_status / _nachrichten / _restzeit, reservierung_stand
--                             (Lesefluten; Nummern sind UUIDs, nicht
--                              zu raten — es geht um Last)
--   Bewusst AUSGENOMMEN: meine_betriebe() und ist_master(). Beide
--   stecken in RLS-Regeln und laufen dort je ZEILE — eine Bremse würde
--   jede Board-Abfrage nach ein paar Hundert Zeilen abbrechen. Für anon
--   liefern sie ohnehin nur „nichts“ bzw. false.
--
--  WIE: ein Helfer schutz_bremsen(ort, grenze) auf den vorhandenen
--  Bausteinen (schutz_herkunft: Hash aus cf-connecting-ip mit Tagessalz,
--  §2.3e — keine IP im Klartext; schutz_zaehlen: Zehn-Minuten-Fenster).
--  Ohne Herkunft (interner Aufruf, Trigger, Probe) bremst er nicht.
--  Über der Grenze: Fehlercode PT429 — PostgREST antwortet damit HTTP 429.
--
--  GRENZEN je Netz und 10 Minuten, großzügig (§7): Ein Restaurant-WLAN
--  ist EIN Netz für alle Gäste. Der Hub fragt den Bestellstand alle 15 s
--  (40 je Gerät und 10 min) — 3000 trägt 75 Gäste gleichzeitig.
--
--  Signaturen bleiben gleich (§2.1). SQL/stable-Funktionen werden
--  plpgsql/volatile, weil der Zähler schreibt — die Körper sind
--  unverändert übernommen (pg_get_functiondef vom 08.10.).
--
--  EHRLICHE GRENZE: admin_anmelden ist eine Vorprüfung im Browser. Wer
--  /auth/v1/token direkt ruft, umgeht sie. Gegen Passwort-Raten wirken
--  dort nur die Auth-Rate-Limits und CAPTCHA von Supabase (Dashboard)
--  und die PIN als zweiter Faktor, die die Datenbank per RLS erzwingt.
-- ═══════════════════════════════════════════════════════════════════

create or replace function public.schutz_bremsen(p_ort text, p_grenze integer, p_min integer default 10)
returns void language plpgsql volatile security definer set search_path = public as $$
declare v_h text; v_n integer;
begin
  v_h := schutz_herkunft();
  if v_h is null then return; end if;
  v_n := schutz_zaehlen(p_ort || ':' || v_h, p_min);
  if v_n > p_grenze then
    raise exception 'zu_viele_anfragen' using errcode = 'PT429',
      hint = 'Zu viele Anfragen aus diesem Netz. Bitte in einigen Minuten erneut.';
  end if;
end $$;
revoke execute on function public.schutz_bremsen(text, integer, integer) from public, anon, authenticated;

-- ── admin_anmelden: 20 Versuche je Netz und 10 Minuten ───────────────
create or replace function public.admin_anmelden(p_email text, p_passwort text)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_nutzer    auth.users%rowtype;
  v_schutz    public.admin_login_schutz%rowtype;
  v_richtig   boolean := false;
begin
  perform schutz_bremsen('anmelden', 20);
  if p_email is null or p_passwort is null or btrim(p_email) = '' or p_passwort = '' then
    return jsonb_build_object('erlaubt', false, 'gesperrt', false,
      'nachricht', 'Bitte E-Mail und Passwort eintragen.');
  end if;

  select * into v_nutzer from auth.users where lower(email) = lower(btrim(p_email));

  if v_nutzer.id is null then
    return jsonb_build_object('erlaubt', false, 'gesperrt', false,
      'nachricht', 'E-Mail oder Passwort stimmt nicht.');
  end if;

  select * into v_schutz from public.admin_login_schutz where nutzer_id = v_nutzer.id;
  if v_schutz.nutzer_id is null then
    insert into public.admin_login_schutz(nutzer_id) values (v_nutzer.id)
      returning * into v_schutz;
  end if;

  if v_schutz.gesperrt then
    return jsonb_build_object('erlaubt', false, 'gesperrt', true,
      'nachricht', 'Zu viele falsche Versuche. Bitte über „Passwort vergessen" die E-Mail bestätigen, um den Zugang wieder freizuschalten.');
  end if;

  if v_nutzer.encrypted_password is not null then
    begin
      v_richtig := (v_nutzer.encrypted_password = extensions.crypt(p_passwort, v_nutzer.encrypted_password));
    exception when others then
      v_richtig := false;
    end;
  end if;

  if v_richtig then
    update public.admin_login_schutz
      set fehlversuche = 0, aktualisiert = now()
      where nutzer_id = v_nutzer.id;
    return jsonb_build_object('erlaubt', true, 'gesperrt', false, 'nachricht', '');
  end if;

  update public.admin_login_schutz
    set fehlversuche = fehlversuche + 1,
        gesperrt      = (fehlversuche + 1) >= 3,
        gesperrt_seit = case when (fehlversuche + 1) >= 3 then now() else gesperrt_seit end,
        aktualisiert  = now()
    where nutzer_id = v_nutzer.id
    returning * into v_schutz;

  if v_schutz.gesperrt then
    return jsonb_build_object('erlaubt', false, 'gesperrt', true,
      'nachricht', 'Das war der dritte Fehlversuch. Der Zugang ist jetzt gesperrt — bitte über „Passwort vergessen" die E-Mail bestätigen.');
  end if;

  return jsonb_build_object('erlaubt', false, 'gesperrt', false,
    'nachricht', 'E-Mail oder Passwort stimmt nicht.',
    'verbleibend', 3 - v_schutz.fehlversuche);
end;
$function$;

-- ── slug_frei: 120 (Konto prüft beim Tippen) ─────────────────────────
create or replace function public.slug_frei(p_slug text)
 returns boolean language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  perform schutz_bremsen('slug', 120);
  return not exists (select 1 from betriebe where slug = lower(btrim(p_slug)));
end $function$;

-- ── tisch_sitzung_start: 200 ─────────────────────────────────────────
create or replace function public.tisch_sitzung_start(p_schluessel text)
 returns table(token text, tisch text, gueltig_bis timestamp with time zone)
 language plpgsql security definer set search_path to 'public' as $function$
declare
  t         record;
  vorhanden record;
  neu       text;
  frist     interval := interval '4 hours';
begin
  perform schutz_bremsen('tisch', 200);
  if p_schluessel is null or length(p_schluessel) < 8 or length(p_schluessel) > 200 then
    return;   -- leer statt Ausnahme: sonst dreht sie den Zähler zurück
  end if;

  select ti.id, ti.betrieb_id, ti.nummer, ti.aktiv
    into t
    from tische ti
   where ti.schluessel = p_schluessel
   limit 1;

  if not found or not t.aktiv then
    return;
  end if;

  delete from tisch_sitzungen s
   where s.betrieb_id = t.betrieb_id and s.gueltig_bis < now();

  perform pg_advisory_xact_lock(hashtext('tischsitzung:' || t.id::text));

  select s.* into vorhanden
    from tisch_sitzungen s
   where s.tisch_id = t.id and s.gueltig_bis > now()
   order by s.gueltig_bis desc
   limit 1;

  if found then
    update tisch_sitzungen s
       set letzte_aktivitaet = now(),
           gueltig_bis       = now() + frist
     where s.id = vorhanden.id;
    return query select vorhanden.token, t.nummer, (now() + frist);
    return;
  end if;

  neu := replace(gen_random_uuid()::text, '-', '')
      || replace(gen_random_uuid()::text, '-', '');

  insert into tisch_sitzungen (betrieb_id, tisch_id, token, gueltig_bis)
  values (t.betrieb_id, t.id, neu, now() + frist);

  return query select neu, t.nummer, (now() + frist);
end;
$function$;

-- ── bestellung_gefunden: 1500 ────────────────────────────────────────
create or replace function public.bestellung_gefunden(kennung text)
 returns table(id uuid, status text, wartezeit_min smallint, tagesnummer smallint)
 language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  perform schutz_bremsen('gefunden', 1500);
  return query
  select b.id, b.status, b.wartezeit_min, b.tagesnummer
  from bestellungen b
  where b.gast_kennung = kennung
    and b.zeitpunkt > now() - interval '6 hours'
  limit 1;
end $function$;

-- ── Lesefluten: 3000 ─────────────────────────────────────────────────
create or replace function public.bestellung_status(nummer uuid)
 returns table(status text, wartezeit_min smallint, tagesnummer smallint)
 language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  perform schutz_bremsen('lesen', 3000);
  return query
  select b.status, b.wartezeit_min, b.tagesnummer
  from bestellungen b
  where b.id = nummer
    and b.zeitpunkt > now() - interval '6 hours';
end $function$;

create or replace function public.bestellung_nachrichten(nummer uuid)
 returns jsonb language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  perform schutz_bremsen('lesen', 3000);
  return (
  select coalesce(jsonb_agg(jsonb_build_object(
           'text', n.gesendet_text, 'am', n.gesendet_am,
           'bearbeitet', n.gesendet_mal > 1)
         order by n.gesendet_am, n.id), '[]'::jsonb)
    from notizen n
    join bestellungen b on b.id = n.bestellung_id
   where b.id = nummer
     and n.an = 'gast' and not n.geloescht and n.gesendet_am is not null
     and b.zeitpunkt > now() - interval '24 hours');
end $function$;

create or replace function public.bestellung_restzeit(nummer text)
 returns integer language plpgsql volatile security definer set search_path to 'public' as $function$
declare
  v_rest integer;
begin
  perform schutz_bremsen('lesen', 3000);
  if nummer is null or nummer !~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return null;
  end if;

  select case
           when b.status = 'fertig' then 0
           when b.wartezeit_min is null or b.bestaetigt_um is null then null
           else greatest(0, ceil(extract(epoch from
                  (b.bestaetigt_um + make_interval(mins => b.wartezeit_min)) - now()
                ))::integer)
         end
    into v_rest
    from public.bestellungen b
   where b.id = nummer::uuid
   limit 1;

  return v_rest;
end $function$;

create or replace function public.reservierung_stand(nummer uuid)
 returns jsonb language plpgsql volatile security definer set search_path to 'public' as $function$
begin
  perform schutz_bremsen('lesen', 3000);
  return (
  select jsonb_build_object(
           'ok', true, 'status', r.status, 'wunsch', r.wunsch, 'personen', r.personen,
           'nachrichten', coalesce((
             select jsonb_agg(jsonb_build_object('text', n.gesendet_text, 'am', n.gesendet_am,
                                                 'bearbeitet', n.gesendet_mal > 1)
                              order by n.gesendet_am, n.id)
               from notizen n
              where n.reservierung_id = r.id and n.an = 'gast'
                and not n.geloescht and n.gesendet_am is not null), '[]'::jsonb))
    from reservierungen r
   where r.id = nummer and r.wunsch > now() - interval '1 day');
end $function$;

-- ── bestellung_stornieren: 60 ────────────────────────────────────────
-- Körper unverändert; nur die erste Zeile nach begin ist neu. Der
-- vollständige Text steht unten, damit die Datei allein ausführbar ist.
create or replace function public.bestellung_stornieren(nummer text, posten jsonb default null::jsonb)
 returns jsonb language plpgsql security definer set search_path to 'public' as $function$
declare
  v_b        bestellungen%rowtype;
  v_frist    constant interval := interval '2 minutes';
  v_bleibt   jsonb := '[]'::jsonb;
  v_weg      jsonb := '[]'::jsonb;
  v_zeile    jsonb;
  v_summe    numeric := 0;
  v_treffer  boolean;
  v_i        int;
begin
  perform schutz_bremsen('storno', 60);
  if nummer is null or nummer !~*
     '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;

  select * into v_b from bestellungen where id = nummer::uuid;
  if not found then
    return jsonb_build_object('ok', false, 'grund', 'unbekannt');
  end if;

  if now() - v_b.zeitpunkt > v_frist then
    return jsonb_build_object('ok', false, 'grund', 'frist');
  end if;

  if v_b.status in ('fertig', 'storniert') then
    return jsonb_build_object('ok', false, 'grund', 'zu_spaet',
                              'status', v_b.status);
  end if;

  if posten is null or jsonb_array_length(coalesce(posten, '[]'::jsonb)) = 0 then
    update bestellungen
       set status = 'storniert',
           storno = coalesce(v_b.storno, '[]'::jsonb) || coalesce(v_b.positionen, '[]'::jsonb),
           positionen = '[]'::jsonb,
           summe = 0
     where id = v_b.id;
    return jsonb_build_object('ok', true, 'alles', true, 'rest', 0, 'summe', 0);
  end if;

  for v_i in 0 .. jsonb_array_length(coalesce(v_b.positionen, '[]'::jsonb)) - 1
  loop
    v_zeile := v_b.positionen -> v_i;
    select exists (
      select 1 from jsonb_array_elements_text(posten) n
       where n = v_i::text
    ) into v_treffer;

    if v_treffer then
      v_weg := v_weg || jsonb_build_array(v_zeile);
    else
      v_bleibt := v_bleibt || jsonb_build_array(v_zeile);
      v_summe  := v_summe
                + coalesce((v_zeile->>'preis')::numeric, 0)
                * coalesce((v_zeile->>'menge')::numeric, 1);
    end if;
  end loop;

  if jsonb_array_length(v_weg) = 0 then
    return jsonb_build_object('ok', false, 'grund', 'nichts_getroffen');
  end if;

  if jsonb_array_length(v_bleibt) = 0 then
    update bestellungen
       set status = 'storniert',
           storno = coalesce(v_b.storno, '[]'::jsonb) || v_weg,
           positionen = '[]'::jsonb,
           summe = 0
     where id = v_b.id;
    return jsonb_build_object('ok', true, 'alles', true, 'rest', 0, 'summe', 0);
  end if;

  update bestellungen
     set storno = coalesce(v_b.storno, '[]'::jsonb) || v_weg,
         positionen = v_bleibt,
         summe = v_summe
   where id = v_b.id;

  return jsonb_build_object('ok', true, 'alles', false,
                            'rest', jsonb_array_length(v_bleibt),
                            'summe', v_summe,
                            'positionen', v_bleibt);
end $function$;
